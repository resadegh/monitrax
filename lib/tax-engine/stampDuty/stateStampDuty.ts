/**
 * Phase 41e.14 — Stamp duty (transfer duty) + foreign purchaser surcharge.
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11. Stamp
 * duty is a **point-of-sale** state tax — different cadence from the
 * annual land tax in 41e.12-13. Each state's Duties Act levies a
 * progressive scale on the dutiable value, plus (in most states) a
 * foreign purchaser additional duty (FPAD).
 *
 * AU primary authority:
 *   - **NSW** Duties Act 1997 — Sch 1 (general scale); Ch 2 Pt 4 Div 4 (foreign surcharge 8%)
 *   - **VIC** Duties Act 2000 — Sch 1; Pt 5 (FPAD 8%, raised 2024 from 7%)
 *   - **QLD** Duties Act 2001 — s24-s26 (general); Ch 4 (AFAD 8%, raised 2024)
 *   - **SA** Stamp Duties Act 1923 — Sch 2 (general); Pt 4 (foreign 7%)
 *   - **WA** Duties Act 2008 — Sch 2 (general); Ch 3 Pt 5 (foreign 7%)
 *   - **TAS** Duties Act 2001 — Sch 2 (general); Ch 4 Pt 6 (FBI 8% from 2024)
 *   - **ACT** Duties Act 1999 — Pt 3 (general); Pt 5A (foreign 0.75%)
 *   - **NT** Stamp Duty Act 1978 — Sch 1 (general; **no FPAD regime**)
 *
 * **v1 simplifications:**
 *   - First-home-buyer + off-the-plan + principal-place-of-residence
 *     concessions surface UNCOMPUTED (UC-STAMP-DUTY-CONCESSION).
 *   - Multi-purchaser apportionment (joint purchasers, foreign-share
 *     calc) NOT computed — UC-STAMP-DUTY-MULTI-PURCHASER.
 *   - Off-the-plan / new-build concessions are highly state-specific
 *     and indexed annually — UC-STAMP-DUTY-NEW-BUILD covers this.
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';
import type { AustralianState } from '../landTax/stateLandTax';

export interface StampDutyBracket {
  /** Lower bound (inclusive). */
  min: number;
  /** Upper bound (null = no cap / top bracket). */
  max: number | null;
  /** Base duty at the bracket's lower bound. */
  baseAmount: number;
  /** Marginal rate above `min`. */
  rate: number;
}

export interface StampDutyConfig {
  state: AustralianState;
  /** Plain-English label (e.g. "NSW FY24-25"). */
  label: string;
  /** Progressive duty brackets sorted by `min` ascending. */
  brackets: StampDutyBracket[];
  /**
   * Foreign purchaser additional duty (FPAD / AFAD / FBI) rate. 0 if
   * the state has no FPAD regime (NT).
   */
  foreignPurchaserSurchargeRate: number;
  /** Citations for the AFSL footer. */
  citations: AuthorityCitation[];
}

export type PurchaserType =
  | 'INDIVIDUAL'
  | 'COMPANY'
  | 'DISCRETIONARY_TRUST'
  | 'UNIT_TRUST_FIXED'
  | 'UNIT_TRUST_NON_FIXED'
  | 'SMSF';

export interface StampDutyInput {
  /** Dutiable value (typically purchase price; the higher of contract price or unencumbered market value). */
  dutiableValue: number;
  purchaserType: PurchaserType;
  /** `true` if at least one purchaser is a foreign person under the state's definition. */
  isForeignPurchaser: boolean;
  /** `true` if residential land (drives FPAD scope in most states). */
  isResidential: boolean;
  /**
   * `true` if the buyer asserts a concession (first-home-buyer,
   * off-the-plan, PPR). v1 surfaces UC-STAMP-DUTY-CONCESSION rather
   * than computing it.
   */
  assertsFirstHomeOrConcession?: boolean;
}

export interface StampDutyResult {
  generalDuty: number;
  foreignPurchaserSurcharge: number;
  totalDuty: number;
  breakdown: Array<{
    label: string;
    amount: number;
    citation: string;
  }>;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

// ============================================================
// Per-state configs (FY24-25 as of 2026-05-05).
// ============================================================

export const NSW_STAMP_DUTY_FY2024_25: StampDutyConfig = {
  state: 'NSW',
  label: 'NSW FY24-25',
  // Per Duties Act 1997 (NSW) Sch 1 (current rates).
  brackets: [
    { min: 0, max: 15_000, baseAmount: 0, rate: 0.0125 },
    { min: 15_001, max: 32_000, baseAmount: 187, rate: 0.015 },
    { min: 32_001, max: 87_000, baseAmount: 442, rate: 0.0175 },
    { min: 87_001, max: 327_000, baseAmount: 1_405, rate: 0.035 },
    { min: 327_001, max: 1_089_000, baseAmount: 9_805, rate: 0.045 },
    { min: 1_089_001, max: 3_268_000, baseAmount: 44_095, rate: 0.055 },
    { min: 3_268_001, max: null, baseAmount: 163_940, rate: 0.07 }, // premium duty
  ],
  foreignPurchaserSurchargeRate: 0.08, // FPAD 8% on residential land
  citations: [
    { kind: 'STATE_DUTIES_ACT', reference: 'NSW Duties Act 1997 Sch 1', lastReviewed: '2026-05-05' },
    { kind: 'STATE_DUTIES_ACT', reference: 'NSW Duties Act 1997 Ch 2 Pt 4 Div 4 (FPAD)', lastReviewed: '2026-05-05' },
  ],
};

export const VIC_STAMP_DUTY_FY2024_25: StampDutyConfig = {
  state: 'VIC',
  label: 'VIC FY24-25',
  brackets: [
    { min: 0, max: 25_000, baseAmount: 0, rate: 0.014 },
    { min: 25_001, max: 130_000, baseAmount: 350, rate: 0.024 },
    { min: 130_001, max: 960_000, baseAmount: 2_870, rate: 0.06 },
    { min: 960_001, max: 2_000_000, baseAmount: 52_670, rate: 0.055 },
    { min: 2_000_001, max: null, baseAmount: 110_270, rate: 0.065 },
  ],
  foreignPurchaserSurchargeRate: 0.08, // FPAD 8% (raised from 7% in 2024)
  citations: [
    { kind: 'STATE_DUTIES_ACT', reference: 'VIC Duties Act 2000 Sch 1', lastReviewed: '2026-05-05' },
    { kind: 'STATE_DUTIES_ACT', reference: 'VIC Duties Act 2000 Pt 5 (FPAD)', lastReviewed: '2026-05-05' },
  ],
};

export const QLD_STAMP_DUTY_FY2024_25: StampDutyConfig = {
  state: 'QLD',
  label: 'QLD FY24-25',
  brackets: [
    { min: 0, max: 5_000, baseAmount: 0, rate: 0 },
    { min: 5_001, max: 75_000, baseAmount: 0, rate: 0.015 },
    { min: 75_001, max: 540_000, baseAmount: 1_050, rate: 0.035 },
    { min: 540_001, max: 1_000_000, baseAmount: 17_325, rate: 0.045 },
    { min: 1_000_001, max: null, baseAmount: 38_025, rate: 0.0575 },
  ],
  foreignPurchaserSurchargeRate: 0.08, // AFAD 8% (raised 2024 from 7%)
  citations: [
    { kind: 'STATE_DUTIES_ACT', reference: 'QLD Duties Act 2001 s24-s26', lastReviewed: '2026-05-05' },
    { kind: 'STATE_DUTIES_ACT', reference: 'QLD Duties Act 2001 Ch 4 (AFAD)', lastReviewed: '2026-05-05' },
  ],
};

export const SA_STAMP_DUTY_FY2024_25: StampDutyConfig = {
  state: 'SA',
  label: 'SA FY24-25',
  brackets: [
    { min: 0, max: 12_000, baseAmount: 0, rate: 0.01 },
    { min: 12_001, max: 30_000, baseAmount: 120, rate: 0.02 },
    { min: 30_001, max: 50_000, baseAmount: 480, rate: 0.03 },
    { min: 50_001, max: 100_000, baseAmount: 1_080, rate: 0.035 },
    { min: 100_001, max: 200_000, baseAmount: 2_830, rate: 0.04 },
    { min: 200_001, max: 250_000, baseAmount: 6_830, rate: 0.0425 },
    { min: 250_001, max: 300_000, baseAmount: 8_955, rate: 0.0475 },
    { min: 300_001, max: 500_000, baseAmount: 11_330, rate: 0.05 },
    { min: 500_001, max: null, baseAmount: 21_330, rate: 0.055 },
  ],
  foreignPurchaserSurchargeRate: 0.07, // SA foreign surcharge 7%
  citations: [
    { kind: 'STATE_DUTIES_ACT', reference: 'SA Stamp Duties Act 1923 Sch 2', lastReviewed: '2026-05-05' },
    { kind: 'STATE_DUTIES_ACT', reference: 'SA Stamp Duties Act 1923 Pt 4 (foreign)', lastReviewed: '2026-05-05' },
  ],
};

export const WA_STAMP_DUTY_FY2024_25: StampDutyConfig = {
  state: 'WA',
  label: 'WA FY24-25',
  brackets: [
    { min: 0, max: 120_000, baseAmount: 0, rate: 0.019 },
    { min: 120_001, max: 150_000, baseAmount: 2_280, rate: 0.0285 },
    { min: 150_001, max: 360_000, baseAmount: 3_135, rate: 0.038 },
    { min: 360_001, max: 725_000, baseAmount: 11_115, rate: 0.0475 },
    { min: 725_001, max: null, baseAmount: 28_453, rate: 0.0515 },
  ],
  foreignPurchaserSurchargeRate: 0.07, // WA foreign 7%
  citations: [
    { kind: 'STATE_DUTIES_ACT', reference: 'WA Duties Act 2008 Sch 2', lastReviewed: '2026-05-05' },
    { kind: 'STATE_DUTIES_ACT', reference: 'WA Duties Act 2008 Ch 3 Pt 5 (foreign)', lastReviewed: '2026-05-05' },
  ],
};

export const TAS_STAMP_DUTY_FY2024_25: StampDutyConfig = {
  state: 'TAS',
  label: 'TAS FY24-25',
  brackets: [
    { min: 0, max: 3_000, baseAmount: 50, rate: 0 },
    { min: 3_001, max: 25_000, baseAmount: 50, rate: 0.0175 },
    { min: 25_001, max: 75_000, baseAmount: 435, rate: 0.0225 },
    { min: 75_001, max: 200_000, baseAmount: 1_560, rate: 0.035 },
    { min: 200_001, max: 375_000, baseAmount: 5_935, rate: 0.04 },
    { min: 375_001, max: 725_000, baseAmount: 12_935, rate: 0.0425 },
    { min: 725_001, max: null, baseAmount: 27_810, rate: 0.045 },
  ],
  foreignPurchaserSurchargeRate: 0.08, // TAS FBI raised to 8% in 2024
  citations: [
    { kind: 'STATE_DUTIES_ACT', reference: 'TAS Duties Act 2001 Sch 2', lastReviewed: '2026-05-05' },
    { kind: 'STATE_DUTIES_ACT', reference: 'TAS Duties Act 2001 Ch 4 Pt 6 (FBI)', lastReviewed: '2026-05-05' },
  ],
};

export const ACT_STAMP_DUTY_FY2024_25: StampDutyConfig = {
  state: 'ACT',
  label: 'ACT FY24-25',
  brackets: [
    { min: 0, max: 260_000, baseAmount: 0, rate: 0.0049 },
    { min: 260_001, max: 300_000, baseAmount: 1_274, rate: 0.022 },
    { min: 300_001, max: 500_000, baseAmount: 2_154, rate: 0.034 },
    { min: 500_001, max: 750_000, baseAmount: 8_954, rate: 0.0432 },
    { min: 750_001, max: 1_000_000, baseAmount: 19_754, rate: 0.059 },
    { min: 1_000_001, max: 1_455_000, baseAmount: 34_504, rate: 0.0654 },
    { min: 1_455_001, max: null, baseAmount: 64_271, rate: 0.0454 }, // ACT flat top
  ],
  foreignPurchaserSurchargeRate: 0.0075, // ACT foreign 0.75% (lowest in AU)
  citations: [
    { kind: 'STATE_DUTIES_ACT', reference: 'ACT Duties Act 1999 Pt 3', lastReviewed: '2026-05-05' },
    { kind: 'STATE_DUTIES_ACT', reference: 'ACT Duties Act 1999 Pt 5A (foreign)', lastReviewed: '2026-05-05' },
  ],
};

export const NT_STAMP_DUTY_FY2024_25: StampDutyConfig = {
  state: 'NT',
  label: 'NT FY24-25',
  // NT uses a continuous formula, not progressive brackets per se.
  // v1 simplification: 5-bracket approximation. UC flag covers exact-formula nuance.
  brackets: [
    { min: 0, max: 525_000, baseAmount: 0, rate: 0.0349 }, // simplified — actual is a continuous formula
    { min: 525_001, max: 3_000_000, baseAmount: 18_322.5, rate: 0.0495 },
    { min: 3_000_001, max: 5_000_000, baseAmount: 140_835, rate: 0.0575 },
    { min: 5_000_001, max: null, baseAmount: 255_835, rate: 0.0595 },
  ],
  foreignPurchaserSurchargeRate: 0, // NT has no FPAD regime
  citations: [
    { kind: 'STATE_DUTIES_ACT', reference: 'NT Stamp Duty Act 1978 Sch 1', lastReviewed: '2026-05-05' },
  ],
};

const STAMP_DUTY_REGISTRY: Record<AustralianState, StampDutyConfig> = {
  NSW: NSW_STAMP_DUTY_FY2024_25,
  VIC: VIC_STAMP_DUTY_FY2024_25,
  QLD: QLD_STAMP_DUTY_FY2024_25,
  SA: SA_STAMP_DUTY_FY2024_25,
  WA: WA_STAMP_DUTY_FY2024_25,
  TAS: TAS_STAMP_DUTY_FY2024_25,
  ACT: ACT_STAMP_DUTY_FY2024_25,
  NT: NT_STAMP_DUTY_FY2024_25,
};

export function getStampDutyConfig(state: AustralianState): StampDutyConfig {
  return STAMP_DUTY_REGISTRY[state];
}

function applyBrackets(value: number, brackets: StampDutyBracket[]): number {
  if (value <= 0) return 0;
  for (const b of brackets) {
    const max = b.max ?? Infinity;
    if (value <= max) {
      const inBracket = value - b.min + 1;
      return b.baseAmount + Math.max(0, inBracket) * b.rate;
    }
  }
  const top = brackets[brackets.length - 1];
  const inBracket = value - top.min + 1;
  return top.baseAmount + Math.max(0, inBracket) * top.rate;
}

/**
 * Calculate stamp duty + foreign purchaser surcharge.
 *
 * Order of operations:
 *   1. General duty per state's progressive bracket scale.
 *   2. Foreign purchaser surcharge (FPAD/AFAD/FBI) on residential
 *      land if `isForeignPurchaser`. NT is the only state with no
 *      FPAD regime.
 */
export function calculateStampDuty(
  input: StampDutyInput,
  config: StampDutyConfig,
): StampDutyResult {
  const { dutiableValue, isForeignPurchaser, isResidential } = input;

  const breakdown: StampDutyResult['breakdown'] = [];
  const citations = [...config.citations];
  const uncomputed: UncomputedFlag[] = [];

  // 1. General duty.
  const generalDuty = applyBrackets(dutiableValue, config.brackets);
  if (generalDuty > 0) {
    breakdown.push({
      label: `${config.state} general transfer duty`,
      amount: generalDuty,
      citation: config.citations[0]?.reference ?? `${config.state} Duties Act`,
    });
  }

  // 2. Foreign purchaser surcharge (FPAD).
  let foreignPurchaserSurcharge = 0;
  if (
    isForeignPurchaser &&
    isResidential &&
    config.foreignPurchaserSurchargeRate > 0
  ) {
    foreignPurchaserSurcharge =
      dutiableValue * config.foreignPurchaserSurchargeRate;
    breakdown.push({
      label: `${config.state} foreign purchaser additional duty (${(config.foreignPurchaserSurchargeRate * 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}%)`,
      amount: foreignPurchaserSurcharge,
      citation:
        config.citations.find((c) => c.reference.toLowerCase().includes('foreign') || c.reference.toLowerCase().includes('fpad') || c.reference.toLowerCase().includes('afad') || c.reference.toLowerCase().includes('fbi'))?.reference ?? `${config.state} foreign surcharge`,
    });
  }

  // NT-specific: no FPAD regime — surface for foreign purchasers.
  if (config.state === 'NT' && isForeignPurchaser) {
    uncomputed.push({
      id: 'UC-STAMP-DUTY-NT-NO-FPAD',
      rationale:
        'NT does not levy a foreign purchaser additional duty. NT is the only Australian jurisdiction without an FPAD/AFAD/FBI regime as of 2026-05-05.',
    });
  }

  // Concession nudge — caller asserts; v1 does not compute.
  if (input.assertsFirstHomeOrConcession) {
    uncomputed.push({
      id: 'UC-STAMP-DUTY-CONCESSION',
      rationale:
        'First-home-buyer / off-the-plan / PPR concessions are state-specific, indexed annually, and conditional on facts (purchase price thresholds, residence requirements). v1 does not compute the concession amount — engage a registered conveyancer or tax agent for the exact figure. Buyer-asserted concession was flagged.',
    });
  }

  // Always surface joint-purchaser apportionment + new-build nuance.
  uncomputed.push({
    id: 'UC-STAMP-DUTY-MULTI-PURCHASER',
    rationale:
      'Multi-purchaser apportionment NOT computed in v1. When multiple purchasers buy together (e.g. spouses, partnership), each state apportions FPAD by foreign-share — NSW Duties Act 1997 s104X (foreign-share calc), VIC Duties Act 2000 s28A. v1 treats the entire dutiable value as foreign or domestic uniformly.',
  });

  uncomputed.push({
    id: 'UC-STAMP-DUTY-NEW-BUILD',
    rationale:
      'Off-the-plan / new-build / vacant-land concessions vary materially by state and indexation year. v1 does not detect or apply new-build concessions — caller must assert via a conveyancer-confirmed reduction in `dutiableValue`.',
  });

  return {
    generalDuty,
    foreignPurchaserSurcharge,
    totalDuty: generalDuty + foreignPurchaserSurcharge,
    breakdown,
    citations,
    uncomputed,
  };
}
