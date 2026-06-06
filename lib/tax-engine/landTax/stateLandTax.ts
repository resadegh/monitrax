/**
 * Phase 41e.12 (NSW + VIC) + Phase 41e.13 (QLD + SA + WA + TAS + ACT + NT).
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11. All
 * eight Australian states + territories ship per-state `LandTaxConfig`.
 * NT is a structural zero (no land tax regime) so the cross-state
 * aggregator can iterate uniformly. Cross-state aggregation lands
 * in `crossStateAggregator.ts` (this PR).
 *
 * AU primary authority:
 *   - **NSW** Land Tax Act 1956 (No 26)
 *     - s10 — taxable land value (excludes PPOR per Sch 1A)
 *     - s27 — general thresholds + rates
 *     - s5A — special trust surcharge
 *     - Sch 1A — foreign person surcharge
 *   - **VIC** Land Tax Act 2005
 *     - Schedule 1 — general rates
 *     - s46IB — trust surcharge rates
 *     - s46IC — absentee owner surcharge
 *     - Vacant Residential Land Tax (separate)
 *
 * **2025 thresholds (calendar-year basis for NSW; financial-year for VIC):**
 *
 * NSW (CY2025):
 *   - General threshold: $1,075,000
 *   - Below threshold: 0%
 *   - Threshold to $6,571,000: $100 + 1.6% on excess over $1.075M
 *   - Above $6,571,000: $88,036 + 2% on excess
 *   - Special trust surcharge: 1.5% × first $1.075M (no threshold)
 *   - Foreign person surcharge: 4% on residential land taxable value
 *
 * VIC (FY24-25):
 *   - General tax-free up to $50,000
 *   - Progressive brackets to $3,000,000
 *   - Above $3,000,000: $24,975 + 2.65% on excess
 *   - Trust surcharge schedule (separate, no $50k threshold)
 *   - Absentee owner surcharge: 4% on all taxable land
 *
 * v1 design: per-state `LandTaxConfig` + a single `calculateLandTax`
 * dispatcher. Single-state assessment per call — multi-state
 * aggregation lands UNCOMPUTED (UC-MULTI-STATE-LAND-TAX) until
 * 41e.13 ships the cross-state aggregator.
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';
import { Decimal, toDecimal } from '@/lib/decimal';

export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'ACT' | 'NT';

export type LandTaxOwnershipType =
  | 'INDIVIDUAL'
  | 'COMPANY'
  | 'DISCRETIONARY_TRUST'
  | 'UNIT_TRUST_FIXED' // fixed unit trust — NOT subject to special trust surcharge
  | 'UNIT_TRUST_NON_FIXED' // non-fixed → subject to special trust surcharge
  | 'SMSF';

export interface LandTaxBracket {
  /** Lower bound of the bracket (inclusive). */
  min: number;
  /** Upper bound (null = no cap). */
  max: number | null;
  /** Base tax at the bracket's lower bound. */
  baseAmount: number;
  /** Marginal rate above `min`. */
  rate: number;
}

/**
 * Per-state config. Each state has its own thresholds + surcharges.
 * Caller passes the current state's config to `calculateLandTax`.
 */
export interface LandTaxConfig {
  state: AustralianState;
  /** Plain-English label (e.g. "NSW CY2025"). */
  label: string;
  /** General threshold below which no tax (0 for VIC). */
  generalThreshold: number;
  /** Progressive brackets sorted by `min` ascending. */
  brackets: LandTaxBracket[];
  /**
   * Surcharge rate on non-fixed trusts (NSW special trust surcharge,
   * VIC trust surcharge). Applied per-state-specific basis.
   */
  trustSurchargeRate: number;
  /**
   * Foreign / absentee owner surcharge rate (typically 2-4%). Applied
   * to taxable land value when owner is non-resident. 0 = state has
   * no land tax foreign surcharge (e.g. SA, WA — those are stamp-duty
   * only).
   */
  foreignOwnerSurchargeRate: number;
  /**
   * `true` if the foreign surcharge applies ONLY to residential land
   * (NSW Sch 1A, TAS, ACT). `false` if it applies to ALL taxable
   * land (VIC absentee, QLD absentee).
   */
  foreignSurchargeResidentialOnly?: boolean;
  /** Citations to surface in the AFSL footer. */
  citations: AuthorityCitation[];
}

export interface LandTaxInput {
  /**
   * Taxable land value (unimproved value at year-end). PPOR exemption
   * (NSW Sch 1A; VIC s47-50) is the caller's responsibility — pass
   * 0 if the property is the principal residence and qualifies.
   */
  taxableLandValue: number;
  ownershipType: LandTaxOwnershipType;
  /** `true` if owner is a foreign person / absentee. */
  isForeignOwner: boolean;
  /** `true` if property is residential (foreign surcharge in NSW + VIC limited to residential). */
  isResidential: boolean;
}

export interface LandTaxResult {
  generalLandTax: number;
  trustSurcharge: number;
  foreignOwnerSurcharge: number;
  totalTax: number;
  /** Step-by-step breakdown for AFSL footer. */
  breakdown: Array<{
    label: string;
    amount: number;
    citation: string;
  }>;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

// ============================================================
// Per-state configs (CY2025 thresholds — caller passes the right
// FY/CY config; v1 hard-codes the current values, future sub-PR
// indexes them annually via the FY config pattern).
// ============================================================

export const NSW_LAND_TAX_CY2025: LandTaxConfig = {
  state: 'NSW',
  label: 'NSW CY2025',
  generalThreshold: 1_075_000,
  brackets: [
    { min: 0, max: 1_075_000, baseAmount: 0, rate: 0 },
    { min: 1_075_001, max: 6_571_000, baseAmount: 100, rate: 0.016 },
    { min: 6_571_001, max: null, baseAmount: 88_036, rate: 0.02 },
  ],
  trustSurchargeRate: 0.0075, // 1.5% on first $1.075M = effective 0.75% × 2 — see calc; NSW special trust adds the standard rate to the trust scale; v1 simplifies to 1.5% × value when value ≤ $1.075M
  foreignOwnerSurchargeRate: 0.04, // 4% NSW
  foreignSurchargeResidentialOnly: true,
  citations: [
    { kind: 'STATE_LAND_TAX_ACT', reference: 'NSW Land Tax Act 1956 s10', lastReviewed: '2026-05-05' },
    { kind: 'STATE_LAND_TAX_ACT', reference: 'NSW Land Tax Act 1956 s27', lastReviewed: '2026-05-05' },
    { kind: 'STATE_LAND_TAX_ACT', reference: 'NSW Land Tax Act 1956 s5A (special trust)', lastReviewed: '2026-05-05' },
    { kind: 'STATE_LAND_TAX_ACT', reference: 'NSW Land Tax Act 1956 Sch 1A (foreign surcharge)', lastReviewed: '2026-05-05' },
  ],
};

export const VIC_LAND_TAX_FY2024_25: LandTaxConfig = {
  state: 'VIC',
  label: 'VIC FY24-25',
  generalThreshold: 50_000,
  brackets: [
    { min: 0, max: 50_000, baseAmount: 0, rate: 0 },
    { min: 50_001, max: 100_000, baseAmount: 0, rate: 0.002 }, // $0 + 0.2% over $50k
    { min: 100_001, max: 300_000, baseAmount: 100, rate: 0.005 },
    { min: 300_001, max: 600_000, baseAmount: 1_100, rate: 0.0095 },
    { min: 600_001, max: 1_000_000, baseAmount: 3_950, rate: 0.0125 },
    { min: 1_000_001, max: 1_800_000, baseAmount: 8_950, rate: 0.0175 },
    { min: 1_800_001, max: 3_000_000, baseAmount: 22_950, rate: 0.02 },
    { min: 3_000_001, max: null, baseAmount: 46_950, rate: 0.0265 },
  ],
  trustSurchargeRate: 0.005, // VIC has a separate trust scale; v1 uses simplified 0.5% surcharge over base
  foreignOwnerSurchargeRate: 0.04, // 4% VIC absentee owner surcharge (was 2%, raised 2024)
  foreignSurchargeResidentialOnly: false, // VIC absentee covers all taxable land
  citations: [
    { kind: 'STATE_LAND_TAX_ACT', reference: 'VIC Land Tax Act 2005 Schedule 1', lastReviewed: '2026-05-05' },
    { kind: 'STATE_LAND_TAX_ACT', reference: 'VIC Land Tax Act 2005 s46IB (trust)', lastReviewed: '2026-05-05' },
    { kind: 'STATE_LAND_TAX_ACT', reference: 'VIC Land Tax Act 2005 s46IC (absentee)', lastReviewed: '2026-05-05' },
  ],
};

// ============================================================
// 41e.13 — rest-of-states (QLD / SA / WA / TAS / ACT / NT).
// Same per-state config pattern. Trust scales + grouping
// nuance still surface UC-LAND-TAX-TRUST-SURCHARGE-NUANCE.
// ============================================================

export const QLD_LAND_TAX_CY2025: LandTaxConfig = {
  state: 'QLD',
  label: 'QLD CY2025',
  generalThreshold: 600_000,
  // Resident individual scale per Land Tax Act 2010 (QLD) Sch 1.
  brackets: [
    { min: 0, max: 600_000, baseAmount: 0, rate: 0 },
    { min: 600_001, max: 1_000_000, baseAmount: 500, rate: 0.01 },
    { min: 1_000_001, max: 3_000_000, baseAmount: 4_500, rate: 0.0165 },
    { min: 3_000_001, max: 5_000_000, baseAmount: 37_500, rate: 0.0125 },
    { min: 5_000_001, max: 10_000_000, baseAmount: 62_500, rate: 0.0175 },
    { min: 10_000_001, max: null, baseAmount: 150_000, rate: 0.0225 },
  ],
  trustSurchargeRate: 0.0175, // QLD trust/company scale uses lower threshold ($350k) and steeper top rate; v1 simplification — UC flag covers nuance
  foreignOwnerSurchargeRate: 0.02, // QLD absentee owner surcharge — 2% on resident-equivalent assessment
  foreignSurchargeResidentialOnly: false, // QLD absentee covers all taxable land
  citations: [
    { kind: 'STATE_LAND_TAX_ACT', reference: 'QLD Land Tax Act 2010 s32 (taxable value)', lastReviewed: '2026-05-05' },
    { kind: 'STATE_LAND_TAX_ACT', reference: 'QLD Land Tax Act 2010 Sch 1 (resident scale)', lastReviewed: '2026-05-05' },
    { kind: 'STATE_LAND_TAX_ACT', reference: 'QLD Land Tax Act 2010 Sch 3 (absentee surcharge)', lastReviewed: '2026-05-05' },
  ],
};

export const SA_LAND_TAX_FY2024_25: LandTaxConfig = {
  state: 'SA',
  label: 'SA FY24-25',
  generalThreshold: 755_000,
  brackets: [
    { min: 0, max: 755_000, baseAmount: 0, rate: 0 },
    { min: 755_001, max: 1_098_000, baseAmount: 0, rate: 0.005 },
    { min: 1_098_001, max: 1_672_000, baseAmount: 1_715, rate: 0.01 },
    { min: 1_672_001, max: 2_500_000, baseAmount: 7_455, rate: 0.02 },
    { min: 2_500_001, max: null, baseAmount: 24_015, rate: 0.024 },
  ],
  trustSurchargeRate: 0.005, // SA trust surcharge — 0.5% v1 simplification
  foreignOwnerSurchargeRate: 0, // SA has no foreign / absentee land tax surcharge (foreign surcharge is on stamp duty only)
  citations: [
    { kind: 'STATE_LAND_TAX_ACT', reference: 'SA Land Tax Act 1936 s5 (general scale)', lastReviewed: '2026-05-05' },
    { kind: 'STATE_LAND_TAX_ACT', reference: 'SA Land Tax Act 1936 s13 (trust)', lastReviewed: '2026-05-05' },
  ],
};

export const WA_LAND_TAX_FY2024_25: LandTaxConfig = {
  state: 'WA',
  label: 'WA FY24-25',
  generalThreshold: 300_000,
  brackets: [
    { min: 0, max: 300_000, baseAmount: 0, rate: 0 },
    { min: 300_001, max: 420_000, baseAmount: 300, rate: 0.0025 },
    { min: 420_001, max: 1_000_000, baseAmount: 600, rate: 0.004 },
    { min: 1_000_001, max: 1_800_000, baseAmount: 2_920, rate: 0.0065 },
    { min: 1_800_001, max: 5_000_000, baseAmount: 8_120, rate: 0.013 },
    { min: 5_000_001, max: 11_000_000, baseAmount: 49_720, rate: 0.0155 },
    { min: 11_000_001, max: null, baseAmount: 142_720, rate: 0.0267 },
  ],
  trustSurchargeRate: 0, // WA has no separate trust surcharge — trusts assessed on standard scale
  foreignOwnerSurchargeRate: 0, // WA has no land tax foreign surcharge (only on stamp duty)
  citations: [
    { kind: 'STATE_LAND_TAX_ACT', reference: 'WA Land Tax Act 2002 s5 (general scale)', lastReviewed: '2026-05-05' },
    { kind: 'STATE_LAND_TAX_ACT', reference: 'WA Land Tax Assessment Act 2002 (assessment)', lastReviewed: '2026-05-05' },
  ],
};

export const TAS_LAND_TAX_FY2024_25: LandTaxConfig = {
  state: 'TAS',
  label: 'TAS FY24-25',
  generalThreshold: 100_000,
  brackets: [
    { min: 0, max: 100_000, baseAmount: 0, rate: 0 },
    { min: 100_001, max: 500_000, baseAmount: 50, rate: 0.0045 },
    { min: 500_001, max: null, baseAmount: 1_837.5, rate: 0.015 },
  ],
  trustSurchargeRate: 0, // TAS trusts assessed on standard scale; absentee landholder duty is separate
  foreignOwnerSurchargeRate: 0.02, // TAS foreign investor land tax surcharge — 2% (since 2022)
  foreignSurchargeResidentialOnly: true, // TAS surcharge limited to residential land
  citations: [
    { kind: 'STATE_LAND_TAX_ACT', reference: 'TAS Land Tax Act 2000 s11 (general scale)', lastReviewed: '2026-05-05' },
    { kind: 'STATE_LAND_TAX_ACT', reference: 'TAS Land Tax Rating Act 2000 (foreign surcharge)', lastReviewed: '2026-05-05' },
  ],
};

export const ACT_LAND_TAX_FY2024_25: LandTaxConfig = {
  state: 'ACT',
  label: 'ACT FY24-25',
  // ACT doesn't run a "land tax" in the same shape as NSW/VIC. ACT's
  // Rates Act 2004 charges (a) annual general rates on every parcel
  // (separate from this calc) plus (b) a residential land tax that
  // only applies to non-owner-occupied (rental / vacant) residential
  // properties. v1 simplification: 1.0% flat where applicable, with
  // UC-ACT-RATES-VS-LAND-TAX surfacing the structural mismatch.
  generalThreshold: 0,
  brackets: [
    { min: 0, max: 150_000, baseAmount: 0, rate: 0.0054 },
    { min: 150_001, max: 275_000, baseAmount: 810, rate: 0.0062 },
    { min: 275_001, max: 2_000_000, baseAmount: 1_585, rate: 0.0114 },
    { min: 2_000_001, max: null, baseAmount: 21_250, rate: 0.0114 },
  ],
  trustSurchargeRate: 0,
  foreignOwnerSurchargeRate: 0.0075, // ACT foreign ownership surcharge — 0.75%
  foreignSurchargeResidentialOnly: true,
  citations: [
    { kind: 'STATE_LAND_TAX_ACT', reference: 'ACT Rates Act 2004 (rates + land tax)', lastReviewed: '2026-05-05' },
    { kind: 'STATE_LAND_TAX_ACT', reference: 'ACT Land Tax Act 2004 (residential rental land tax)', lastReviewed: '2026-05-05' },
  ],
};

/**
 * NT does not levy land tax. Config is a structural zero so the
 * cross-state aggregator can iterate uniformly. UC-NT-NO-LAND-TAX
 * surfaces in `calculateLandTax` to make the absence explicit.
 */
export const NT_LAND_TAX_FY2024_25: LandTaxConfig = {
  state: 'NT',
  label: 'NT FY24-25',
  generalThreshold: Infinity, // never crossed — no tax
  brackets: [{ min: 0, max: null, baseAmount: 0, rate: 0 }],
  trustSurchargeRate: 0,
  foreignOwnerSurchargeRate: 0,
  citations: [
    { kind: 'STATE_LAND_TAX_ACT', reference: 'NT — no land tax regime', lastReviewed: '2026-05-05' },
  ],
};

const STATE_CONFIG_REGISTRY: Partial<Record<AustralianState, LandTaxConfig>> = {
  NSW: NSW_LAND_TAX_CY2025,
  VIC: VIC_LAND_TAX_FY2024_25,
  QLD: QLD_LAND_TAX_CY2025,
  SA: SA_LAND_TAX_FY2024_25,
  WA: WA_LAND_TAX_FY2024_25,
  TAS: TAS_LAND_TAX_FY2024_25,
  ACT: ACT_LAND_TAX_FY2024_25,
  NT: NT_LAND_TAX_FY2024_25,
};

/**
 * Resolve config for a state. Every Australian state ships a config
 * post-41e.13 (NT ships a structural zero — no land tax regime).
 */
export function getLandTaxConfig(state: AustralianState): LandTaxConfig {
  const config = STATE_CONFIG_REGISTRY[state];
  if (!config) {
    throw new Error(`Land tax config missing for ${state}.`);
  }
  return config;
}

export function getSupportedStates(): AustralianState[] {
  return Object.keys(STATE_CONFIG_REGISTRY) as AustralianState[];
}

/**
 * Apply a progressive bracket schedule to a value. Returns the total
 * tax. Brackets must be sorted by `min` ascending.
 */
function applyBrackets(value: number, brackets: LandTaxBracket[]): number {
  if (value <= 0) return 0;
  for (const b of brackets) {
    const max = b.max ?? Infinity;
    if (value <= max) {
      const incomeInBracket = value - b.min + 1;
      return b.baseAmount + Math.max(0, incomeInBracket) * b.rate;
    }
  }
  // Fallback to top bracket
  const top = brackets[brackets.length - 1];
  const incomeInBracket = value - top.min + 1;
  return top.baseAmount + Math.max(0, incomeInBracket) * top.rate;
}

/**
 * Calculate land tax for a single property in a single state.
 *
 * **Order of operations:**
 *   1. Apply general progressive brackets to taxable land value.
 *      Below the general threshold → $0 general tax.
 *   2. If non-fixed trust → apply trust surcharge (varies by state).
 *   3. If foreign / absentee owner → apply foreign surcharge (typically
 *      4%) on residential land.
 *   4. Sum the three. Total tax = general + trust + foreign.
 *
 * **Multi-state aggregation NOT computed.** When the same owner has
 * land in multiple states, each state assesses independently — but
 * for compounded threshold / aggregation rules (e.g. NSW grouping
 * provisions in Pt 4 of the Act), the v1 calc trusts the caller's
 * state-specific values. UC-MULTI-STATE-LAND-TAX surfaces this.
 */
export function calculateLandTax(
  input: LandTaxInput,
  config: LandTaxConfig,
): LandTaxResult {
  const { taxableLandValue, ownershipType, isForeignOwner, isResidential } =
    input;

  const breakdown: LandTaxResult['breakdown'] = [];
  const citations = [...config.citations];
  const uncomputed: UncomputedFlag[] = [];

  // 1. General progressive bracket calc.
  const generalLandTax =
    taxableLandValue >= config.generalThreshold
      ? applyBrackets(taxableLandValue, config.brackets)
      : 0;

  if (generalLandTax > 0) {
    breakdown.push({
      label: 'General land tax (progressive scale)',
      amount: generalLandTax,
      citation:
        config.state === 'NSW'
          ? 'NSW Land Tax Act 1956 s27'
          : 'VIC Land Tax Act 2005 Schedule 1',
    });
  } else if (taxableLandValue > 0 && taxableLandValue < config.generalThreshold) {
    breakdown.push({
      label: `Below ${config.label} threshold of $${config.generalThreshold.toLocaleString()} — no general tax`,
      amount: 0,
      citation:
        config.state === 'NSW'
          ? 'NSW Land Tax Act 1956 s27'
          : 'VIC Land Tax Act 2005 Schedule 1',
    });
  }

  // 2. Trust surcharge (non-fixed trusts only).
  let trustSurcharge = 0;
  const isTrustOwner =
    ownershipType === 'DISCRETIONARY_TRUST' ||
    ownershipType === 'UNIT_TRUST_NON_FIXED';
  if (isTrustOwner && config.trustSurchargeRate > 0) {
    if (config.state === 'NSW') {
      // NSW special trust surcharge: 1.5% on first $1.075M, then standard rate above.
      // v1 simplification: 1.5% × min(value, $1.075M).
      trustSurcharge = Math.min(taxableLandValue, 1_075_000) * 0.015;
    } else {
      trustSurcharge = taxableLandValue * config.trustSurchargeRate;
    }
    if (trustSurcharge > 0) {
      const trustCitation =
        config.state === 'NSW'
          ? 'NSW Land Tax Act 1956 s5A'
          : config.state === 'VIC'
          ? 'VIC Land Tax Act 2005 s46IB'
          : config.state === 'QLD'
          ? 'QLD Land Tax Act 2010 (trust scale)'
          : config.state === 'SA'
          ? 'SA Land Tax Act 1936 s13'
          : `${config.state} trust scale`;
      breakdown.push({
        label: `${config.state} trust surcharge (non-fixed trust)`,
        amount: trustSurcharge,
        citation: trustCitation,
      });
    }
    uncomputed.push({
      id: 'UC-LAND-TAX-TRUST-SURCHARGE-NUANCE',
      rationale:
        'Trust surcharge calculation simplified in v1 to a flat % over the taxable value (NSW: 1.5% on first $1.075M; VIC/QLD/SA: flat % over base). Real-world calc uses a progressive trust-specific scale that varies by state. Engage a registered tax agent for exact figure on trust-held property.',
      citation:
        config.state === 'NSW'
          ? { kind: 'STATE_LAND_TAX_ACT', reference: 'NSW Land Tax Act 1956 s5A', lastReviewed: '2026-05-05' }
          : config.state === 'VIC'
          ? { kind: 'STATE_LAND_TAX_ACT', reference: 'VIC Land Tax Act 2005 s46IB', lastReviewed: '2026-05-05' }
          : { kind: 'STATE_LAND_TAX_ACT', reference: `${config.state} trust scale`, lastReviewed: '2026-05-05' },
    });
  }

  // 3. Foreign / absentee owner surcharge — data-driven from config.
  let foreignOwnerSurcharge = 0;
  if (isForeignOwner && config.foreignOwnerSurchargeRate > 0) {
    const residentialOnly = config.foreignSurchargeResidentialOnly ?? false;
    const surchargeApplies = !residentialOnly || isResidential;
    if (surchargeApplies) {
      foreignOwnerSurcharge =
        taxableLandValue * config.foreignOwnerSurchargeRate;
    }
    if (foreignOwnerSurcharge > 0) {
      const pct = (config.foreignOwnerSurchargeRate * 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
      breakdown.push({
        label: `${config.state} foreign / absentee owner surcharge (${pct}%)`,
        amount: foreignOwnerSurcharge,
        citation:
          config.state === 'NSW'
            ? 'NSW Land Tax Act 1956 Sch 1A'
            : config.state === 'VIC'
            ? 'VIC Land Tax Act 2005 s46IC'
            : config.state === 'QLD'
            ? 'QLD Land Tax Act 2010 Sch 3'
            : config.state === 'TAS'
            ? 'TAS Land Tax Rating Act 2000 (foreign surcharge)'
            : config.state === 'ACT'
            ? 'ACT Rates Act 2004 (foreign ownership)'
            : `${config.state} foreign owner surcharge`,
      });
    }
  }

  // ACT structural disclosure — Rates vs Land Tax mismatch.
  if (config.state === 'ACT' && taxableLandValue > 0) {
    uncomputed.push({
      id: 'UC-ACT-RATES-VS-LAND-TAX',
      rationale:
        'ACT does not run a "land tax" in the same shape as NSW/VIC. ACT Rates Act 2004 charges (a) annual general rates on every parcel (separate from this calc) and (b) a residential land tax that only applies to non-owner-occupied residential properties. v1 calc applies a flat-bracketed approximation; for an exact figure consult the ACT Revenue Office or a registered tax agent.',
      citation: { kind: 'STATE_LAND_TAX_ACT', reference: 'ACT Rates Act 2004', lastReviewed: '2026-05-05' },
    });
  }

  // NT structural disclosure — no land tax.
  if (config.state === 'NT') {
    uncomputed.push({
      id: 'UC-NT-NO-LAND-TAX',
      rationale:
        'NT does not levy land tax. This config returns $0 for structural completeness in the cross-state aggregator. NT does levy stamp duty (lands in 41e.14).',
    });
  }

  // Multi-state aggregation flag — always surface so callers know.
  uncomputed.push({
    id: 'UC-MULTI-STATE-LAND-TAX',
    rationale:
      'Land tax is assessed per-state. Multi-state aggregation rules (NSW grouping in Pt 4, VIC trustee aggregation in Pt 3 Div 4) require facts the caller must supply per state. v1 calc covers a single-state assessment; cross-state owner aggregation lands with 41e.13 (rest-of-states + cross-state aggregator).',
  });

  // PPOR exemption — surfaced as nudge: caller is responsible for
  // passing 0 if PPOR. v1 doesn't compute PPOR partial exemption
  // (e.g. converted-to-rental within the FY).
  if (taxableLandValue > 0) {
    uncomputed.push({
      id: 'UC-LAND-TAX-PPOR-EXEMPTION',
      rationale:
        'PPOR (principal place of residence) exemption is the caller\'s responsibility — pass `taxableLandValue: 0` if the property qualifies under NSW Sch 1A or VIC s47-s50. v1 does not compute partial PPOR exemption (e.g. property converted from PPOR to rental within the FY).',
    });
  }

  return {
    generalLandTax,
    trustSurcharge,
    foreignOwnerSurcharge,
    totalTax: generalLandTax + trustSurcharge + foreignOwnerSurcharge,
    breakdown,
    citations,
    uncomputed,
  };
}

// =============================================================================
// Q-DEC PR 2.D.3a — Decimal sibling path
// =============================================================================

export interface LandTaxInputDecimal {
  taxableLandValue: number | string | Decimal;
  ownershipType: LandTaxOwnershipType;
  isForeignOwner: boolean;
  isResidential: boolean;
}

export interface LandTaxResultDecimal {
  generalLandTax: Decimal;
  trustSurcharge: Decimal;
  foreignOwnerSurcharge: Decimal;
  totalTax: Decimal;
  breakdown: Array<{ label: string; amount: Decimal; citation: string }>;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

function applyBracketsDecimal(value: Decimal, brackets: LandTaxBracket[]): Decimal {
  if (value.lte(0)) return new Decimal(0);
  for (const b of brackets) {
    const max = b.max == null ? null : new Decimal(b.max);
    if (max == null || value.lte(max)) {
      const inBracket = value.minus(b.min).plus(1);
      const overBracket = Decimal.max(new Decimal(0), inBracket.times(b.rate));
      return new Decimal(b.baseAmount).plus(overBracket);
    }
  }
  const top = brackets[brackets.length - 1];
  const inBracket = value.minus(top.min).plus(1);
  const overBracket = Decimal.max(new Decimal(0), inBracket.times(top.rate));
  return new Decimal(top.baseAmount).plus(overBracket);
}

/**
 * Decimal sibling of `calculateLandTax`. End-to-end Decimal arithmetic;
 * Float doesn't round so neither does the Decimal sibling.
 *
 * NSW special trust surcharge preserves the Float formula:
 *   `min(taxableLandValue, 1075000) × 0.015`.
 */
export function calculateLandTaxDecimal(
  input: LandTaxInputDecimal,
  config: LandTaxConfig,
): LandTaxResultDecimal {
  const { ownershipType, isForeignOwner, isResidential } = input;
  const taxableLandValue = toDecimal(input.taxableLandValue) ?? new Decimal(0);

  const breakdown: LandTaxResultDecimal['breakdown'] = [];
  const citations = [...config.citations];
  const uncomputed: UncomputedFlag[] = [];

  // 1. General progressive bracket.
  const generalLandTax = taxableLandValue.gte(config.generalThreshold)
    ? applyBracketsDecimal(taxableLandValue, config.brackets)
    : new Decimal(0);

  if (generalLandTax.gt(0)) {
    breakdown.push({
      label: 'General land tax (progressive scale)',
      amount: generalLandTax,
      citation:
        config.state === 'NSW' ? 'NSW Land Tax Act 1956 s27' : 'VIC Land Tax Act 2005 Schedule 1',
    });
  } else if (taxableLandValue.gt(0) && taxableLandValue.lt(config.generalThreshold)) {
    breakdown.push({
      label: `Below ${config.label} threshold of $${config.generalThreshold.toLocaleString()} — no general tax`,
      amount: new Decimal(0),
      citation:
        config.state === 'NSW' ? 'NSW Land Tax Act 1956 s27' : 'VIC Land Tax Act 2005 Schedule 1',
    });
  }

  // 2. Trust surcharge.
  let trustSurcharge = new Decimal(0);
  const isTrustOwner =
    ownershipType === 'DISCRETIONARY_TRUST' || ownershipType === 'UNIT_TRUST_NON_FIXED';
  if (isTrustOwner && config.trustSurchargeRate > 0) {
    if (config.state === 'NSW') {
      const nswCap = new Decimal(1_075_000);
      trustSurcharge = Decimal.min(taxableLandValue, nswCap).times('0.015');
    } else {
      trustSurcharge = taxableLandValue.times(config.trustSurchargeRate);
    }
    if (trustSurcharge.gt(0)) {
      const trustCitation =
        config.state === 'NSW'
          ? 'NSW Land Tax Act 1956 s5A'
          : config.state === 'VIC'
          ? 'VIC Land Tax Act 2005 s46IB'
          : config.state === 'QLD'
          ? 'QLD Land Tax Act 2010 (trust scale)'
          : config.state === 'SA'
          ? 'SA Land Tax Act 1936 s13'
          : `${config.state} trust scale`;
      breakdown.push({
        label: `${config.state} trust surcharge (non-fixed trust)`,
        amount: trustSurcharge,
        citation: trustCitation,
      });
    }
    uncomputed.push({
      id: 'UC-LAND-TAX-TRUST-SURCHARGE-NUANCE',
      rationale:
        'Trust surcharge calculation simplified in v1 to a flat % over the taxable value (NSW: 1.5% on first $1.075M; VIC/QLD/SA: flat % over base). Real-world calc uses a progressive trust-specific scale that varies by state. Engage a registered tax agent for exact figure on trust-held property.',
      citation:
        config.state === 'NSW'
          ? { kind: 'STATE_LAND_TAX_ACT', reference: 'NSW Land Tax Act 1956 s5A', lastReviewed: '2026-05-05' }
          : config.state === 'VIC'
          ? { kind: 'STATE_LAND_TAX_ACT', reference: 'VIC Land Tax Act 2005 s46IB', lastReviewed: '2026-05-05' }
          : { kind: 'STATE_LAND_TAX_ACT', reference: `${config.state} trust scale`, lastReviewed: '2026-05-05' },
    });
  }

  // 3. Foreign / absentee surcharge.
  let foreignOwnerSurcharge = new Decimal(0);
  if (isForeignOwner && config.foreignOwnerSurchargeRate > 0) {
    const residentialOnly = config.foreignSurchargeResidentialOnly ?? false;
    const surchargeApplies = !residentialOnly || isResidential;
    if (surchargeApplies) {
      foreignOwnerSurcharge = taxableLandValue.times(config.foreignOwnerSurchargeRate);
    }
    if (foreignOwnerSurcharge.gt(0)) {
      const pct = (config.foreignOwnerSurchargeRate * 100)
        .toFixed(2)
        .replace(/\.00$/, '')
        .replace(/(\.\d)0$/, '$1');
      breakdown.push({
        label: `${config.state} foreign / absentee owner surcharge (${pct}%)`,
        amount: foreignOwnerSurcharge,
        citation:
          config.state === 'NSW'
            ? 'NSW Land Tax Act 1956 Sch 1A'
            : config.state === 'VIC'
            ? 'VIC Land Tax Act 2005 s46IC'
            : config.state === 'QLD'
            ? 'QLD Land Tax Act 2010 Sch 3'
            : config.state === 'TAS'
            ? 'TAS Land Tax Rating Act 2000 (foreign surcharge)'
            : config.state === 'ACT'
            ? 'ACT Rates Act 2004 (foreign ownership)'
            : `${config.state} foreign owner surcharge`,
      });
    }
  }

  if (config.state === 'ACT' && taxableLandValue.gt(0)) {
    uncomputed.push({
      id: 'UC-ACT-RATES-VS-LAND-TAX',
      rationale:
        'ACT does not run a "land tax" in the same shape as NSW/VIC. ACT Rates Act 2004 charges (a) annual general rates on every parcel (separate from this calc) and (b) a residential land tax that only applies to non-owner-occupied residential properties. v1 calc applies a flat-bracketed approximation; for an exact figure consult the ACT Revenue Office or a registered tax agent.',
      citation: { kind: 'STATE_LAND_TAX_ACT', reference: 'ACT Rates Act 2004', lastReviewed: '2026-05-05' },
    });
  }

  if (config.state === 'NT') {
    uncomputed.push({
      id: 'UC-NT-NO-LAND-TAX',
      rationale:
        'NT does not levy land tax. This config returns $0 for structural completeness in the cross-state aggregator. NT does levy stamp duty (lands in 41e.14).',
    });
  }

  // Q-DEC PR 3.D — parity fix with Float sibling (line 504): always
  // surface the multi-state aggregation flag so callers know.
  uncomputed.push({
    id: 'UC-MULTI-STATE-LAND-TAX',
    rationale:
      'Land tax is assessed per-state. Multi-state aggregation rules (NSW grouping in Pt 4, VIC trustee aggregation in Pt 3 Div 4) require facts the caller must supply per state. v1 calc covers a single-state assessment; cross-state owner aggregation lands with 41e.13 (rest-of-states + cross-state aggregator).',
  });

  return {
    generalLandTax,
    trustSurcharge,
    foreignOwnerSurcharge,
    totalTax: generalLandTax.plus(trustSurcharge).plus(foreignOwnerSurcharge),
    breakdown,
    citations,
    uncomputed,
  };
}
