/**
 * Phase 41e.12 — State land tax (NSW + VIC).
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11. First
 * of the per-state regimes. NSW + VIC first because they're the
 * largest states by taxable-land value; per-state config pattern
 * locked in here, then 41e.13 ships QLD/SA/WA/TAS/ACT/NT.
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
   * Foreign / absentee owner surcharge rate (typically 4%). Applied
   * to taxable land value when owner is non-resident.
   */
  foreignOwnerSurchargeRate: number;
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
  citations: [
    { kind: 'STATE_LAND_TAX_ACT', reference: 'VIC Land Tax Act 2005 Schedule 1', lastReviewed: '2026-05-05' },
    { kind: 'STATE_LAND_TAX_ACT', reference: 'VIC Land Tax Act 2005 s46IB (trust)', lastReviewed: '2026-05-05' },
    { kind: 'STATE_LAND_TAX_ACT', reference: 'VIC Land Tax Act 2005 s46IC (absentee)', lastReviewed: '2026-05-05' },
  ],
};

const STATE_CONFIG_REGISTRY: Partial<Record<AustralianState, LandTaxConfig>> = {
  NSW: NSW_LAND_TAX_CY2025,
  VIC: VIC_LAND_TAX_FY2024_25,
};

/**
 * Resolve config for a state. Throws if unsupported in v1 — caller
 * checks `getSupportedStates()` first.
 */
export function getLandTaxConfig(state: AustralianState): LandTaxConfig {
  const config = STATE_CONFIG_REGISTRY[state];
  if (!config) {
    throw new Error(
      `Land tax not yet implemented for ${state}. NSW + VIC ship in 41e.12; QLD/SA/WA/TAS/ACT/NT in 41e.13.`,
    );
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
  if (
    ownershipType === 'DISCRETIONARY_TRUST' ||
    ownershipType === 'UNIT_TRUST_NON_FIXED'
  ) {
    if (config.state === 'NSW') {
      // NSW special trust surcharge: 1.5% on first $1.075M, then standard rate above.
      // v1 simplification: 1.5% × min(value, $1.075M).
      trustSurcharge =
        Math.min(taxableLandValue, 1_075_000) * 0.015;
    } else if (config.state === 'VIC') {
      // VIC trust surcharge: progressive scale above 0 with no
      // tax-free threshold. v1 simplification: 0.5% × value.
      trustSurcharge = taxableLandValue * config.trustSurchargeRate;
    } else {
      trustSurcharge = taxableLandValue * config.trustSurchargeRate;
    }
    if (trustSurcharge > 0) {
      breakdown.push({
        label: `${config.state} trust surcharge (non-fixed trust)`,
        amount: trustSurcharge,
        citation:
          config.state === 'NSW'
            ? 'NSW Land Tax Act 1956 s5A'
            : 'VIC Land Tax Act 2005 s46IB',
      });
    }
    uncomputed.push({
      id: 'UC-LAND-TAX-TRUST-SURCHARGE-NUANCE',
      rationale:
        'Trust surcharge calculation simplified in v1 to a flat % over the taxable value (NSW: 1.5% on first $1.075M; VIC: 0.5% over base). Real-world calc uses a progressive trust-specific scale that varies by state. Engage a registered tax agent for exact figure on trust-held property.',
      citation:
        config.state === 'NSW'
          ? { kind: 'STATE_LAND_TAX_ACT', reference: 'NSW Land Tax Act 1956 s5A', lastReviewed: '2026-05-05' }
          : { kind: 'STATE_LAND_TAX_ACT', reference: 'VIC Land Tax Act 2005 s46IB', lastReviewed: '2026-05-05' },
    });
  }

  // 3. Foreign / absentee owner surcharge.
  let foreignOwnerSurcharge = 0;
  if (isForeignOwner) {
    if (config.state === 'NSW' && isResidential) {
      foreignOwnerSurcharge = taxableLandValue * config.foreignOwnerSurchargeRate;
    } else if (config.state === 'VIC') {
      // VIC absentee owner surcharge applies to ALL taxable land
      // (not just residential).
      foreignOwnerSurcharge = taxableLandValue * config.foreignOwnerSurchargeRate;
    }
    if (foreignOwnerSurcharge > 0) {
      breakdown.push({
        label: `${config.state} foreign / absentee owner surcharge (${(config.foreignOwnerSurchargeRate * 100).toFixed(0)}%)`,
        amount: foreignOwnerSurcharge,
        citation:
          config.state === 'NSW'
            ? 'NSW Land Tax Act 1956 Sch 1A'
            : 'VIC Land Tax Act 2005 s46IC',
      });
    }
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
