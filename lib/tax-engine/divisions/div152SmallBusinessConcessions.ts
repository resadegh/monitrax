/**
 * Phase 41e.7 — Division 152 small business CGT concessions.
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 +
 * `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §5.5 — the
 * four small-business CGT concessions stack with Div 115 (50% discount)
 * to dramatically reduce or eliminate gain on disposal of an active
 * business asset.
 *
 * AU primary authority:
 *   - ITAA 1997 Div 152 — Small business CGT relief
 *   - s152-10 — basic conditions (taxpayer is a CGT small business
 *     entity OR meets MNAV test, asset is active, additional conditions
 *     for shares/units)
 *   - s152-15 — Maximum Net Asset Value test ($6M aggregated)
 *   - s152-20 — aggregated turnover test ($2M for SBE concessions)
 *   - s152-35 — active asset test (used in business ≥ ½ ownership period
 *     for assets held ≤ 15yr; ≥ 7.5yr for >15yr assets)
 *   - s152-105 — 15-year exemption (asset held 15+ years AND CGT event
 *     in connection with retirement OR taxpayer is permanently
 *     incapacitated; gain entirely disregarded)
 *   - s152-205 — 50% active asset reduction
 *   - s152-305 — retirement exemption (capped at $500k lifetime)
 *   - s152-410 — small business rollover (defer all/part of gain by
 *     acquiring replacement asset within 2yr; flagged UNCOMPUTED for
 *     v1 — needs replacement-asset tracking)
 *
 * **Stacking order (s152-10(1A)):**
 *   1. Div 115 50% CGT discount (already applied if eligible — comes
 *      from 41e.1 cgtDiscount module)
 *   2. 15-year exemption — if eligible, gain entirely disregarded;
 *      other concessions don't apply
 *   3. 50% active asset reduction
 *   4. Retirement exemption (lifetime cap $500k)
 *   5. Rollover (defer remaining)
 *
 * Pure functions; no DB. Composed by `entityTaxRouter` for
 * COMPANY/SOLE_TRADER/PARTNERSHIP/DISCRETIONARY_TRUST entities
 * disposing of an active business asset.
 *
 * v1 input model: caller supplies the gain (post Div 115 discount if
 * applicable) + eligibility facts. The output reports each concession's
 * impact step by step + the final assessable amount.
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';
import { Decimal, toDecimal } from '@/lib/decimal';

export interface Div152Input {
  /**
   * The capital gain BEFORE Div 152 concessions but AFTER any Div 115
   * 50% discount has already been applied. Caller routes through
   * `cgtDiscount` first; this module composes on top.
   */
  gainAfterDiv115: number;
  /**
   * Maximum Net Asset Value of the taxpayer + connected entities +
   * affiliates. Below $6M → SBE concessions available via MNAV test.
   * Caller passes the aggregated number; v1 doesn't aggregate
   * connected entities (UNCOMPUTED — flagged when MNAV close to threshold).
   */
  maxNetAssetValue: number;
  /**
   * Aggregated annual turnover (revenue) of the taxpayer + connected
   * entities + affiliates. Below $2M → CGT small business entity. v1
   * doesn't aggregate connected entities (UNCOMPUTED — same as MNAV).
   */
  aggregatedTurnover: number;
  /** `true` if the asset meets the s152-35 active-asset test. */
  isActiveAsset: boolean;
  /** Months the asset was held. Used for s152-105 15-year test. */
  monthsHeld: number;
  /**
   * `true` if the disposal is in connection with retirement OR taxpayer
   * is permanently incapacitated (s152-105). Required for the 15-year
   * exemption.
   */
  isRetirementOrIncapacity: boolean;
  /**
   * Election to apply 50% active asset reduction. Default `true`
   * (taxpayer almost always benefits — opt-out only useful in edge
   * cases where keeping a higher base for retirement-exemption
   * apportionment changes things).
   */
  electActiveAssetReduction?: boolean;
  /**
   * Election to apply retirement exemption. When `true`, caller must
   * provide `retirementExemptionUsedToDate` so the lifetime cap is
   * respected.
   */
  electRetirementExemption?: boolean;
  /**
   * Lifetime retirement-exemption already used by this taxpayer.
   * The cap is $500,000 — cannot exceed this across all CGT events.
   */
  retirementExemptionUsedToDate?: number;
  /**
   * Election to roll over the remaining gain (s152-410). When `true`,
   * the calc reports the rollover amount + flags it as UNCOMPUTED
   * (UC-DIV152-ROLLOVER) — replacement-asset tracking lands in a
   * future sub-PR.
   */
  electRollover?: boolean;
}

export interface Div152Result {
  /** Did the taxpayer satisfy the basic conditions (MNAV OR turnover + active)? */
  basicConditionsMet: boolean;
  /** 15-year exemption applied → gain entirely disregarded. */
  fifteenYearExemptionApplied: boolean;
  /** 50% active asset reduction applied. */
  activeAssetReductionApplied: boolean;
  /** Retirement exemption amount applied (capped at $500k lifetime). */
  retirementExemptionApplied: number;
  /** Rollover amount (deferred). */
  rolloverApplied: number;
  /** Final assessable gain after all concessions. */
  assessableGain: number;
  /**
   * MON-110 — the gain the concession ladder operates on (the input gain
   * clamped at 0), exposed so the surface RENDERS it instead of
   * reconstructing it from step arithmetic (Calc-SSOT wall §8.3).
   */
  gainBeforeConcessions: number;
  /**
   * Per-concession breakdown — useful for AFSL footer rendering.
   * Each step shows the running gain + which concession applied.
   * MON-108: `concession` is a clean human label with NO embedded citation —
   * `citation` is the sole carrier (the surface renders it exactly once).
   */
  steps: Array<{
    concession: string;
    /** Reduction applied at this step. */
    reduction: number;
    /** Running gain after this step. */
    runningGain: number;
    /** Citation reference for this concession. */
    citation: string;
  }>;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

// MON-109: exported — the capture layer (Div152AssessmentCard) reads THESE
// for its comparisons AND its display copy; legislated thresholds are never
// re-typed outside the engine (tests/tax/mon109ThresholdTrace.test.ts).
export const MNAV_THRESHOLD = 6_000_000; // s152-15 maximum net asset value
export const TURNOVER_THRESHOLD = 2_000_000; // s152-20 CGT small business entity
export const RETIREMENT_LIFETIME_CAP = 500_000; // s152-310 lifetime cap
export const FIFTEEN_YEAR_MONTHS = 15 * 12; // s152-105 15-year exemption

const BASE_CITATIONS: AuthorityCitation[] = [
  { kind: 'ITAA_1997', reference: 'Div 152', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1997', reference: 's152-10', lastReviewed: '2026-05-05' },
];

/**
 * Apply Div 152 small business CGT concessions to a gain that has
 * already been Div 115 discounted (where applicable).
 */
export function applyDiv152(input: Div152Input): Div152Result {
  const {
    gainAfterDiv115,
    maxNetAssetValue,
    aggregatedTurnover,
    isActiveAsset,
    monthsHeld,
    isRetirementOrIncapacity,
    electActiveAssetReduction = true,
    electRetirementExemption = false,
    retirementExemptionUsedToDate = 0,
    electRollover = false,
  } = input;

  const citations: AuthorityCitation[] = [...BASE_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];
  const steps: Div152Result['steps'] = [];
  // MON-110: the ONE stated starting point for the ladder (and the surface).
  const gainBeforeConcessions = Math.max(0, gainAfterDiv115);

  // Basic conditions: MNAV ≤ $6M OR aggregated turnover ≤ $2M, AND
  // asset is active (s152-10).
  const passesMnav = maxNetAssetValue <= MNAV_THRESHOLD;
  const passesTurnover = aggregatedTurnover <= TURNOVER_THRESHOLD;
  const basicConditionsMet =
    isActiveAsset && (passesMnav || passesTurnover);

  // Aggregation flag — when MNAV/turnover is close to threshold,
  // user must aggregate connected entities + affiliates per
  // s152-15(2). v1 trusts the caller's inputs; flag the boundary case.
  if (
    (maxNetAssetValue >= MNAV_THRESHOLD * 0.8 &&
      maxNetAssetValue <= MNAV_THRESHOLD * 1.2) ||
    (aggregatedTurnover >= TURNOVER_THRESHOLD * 0.8 &&
      aggregatedTurnover <= TURNOVER_THRESHOLD * 1.2)
  ) {
    uncomputed.push({
      id: 'UC-DIV152-AGGREGATION',
      rationale:
        'MNAV or aggregated turnover is near the s152-15/s152-20 threshold. Per s152-15(2) the taxpayer must aggregate connected entities + affiliates — v1 takes caller-provided figures at face value. Engage a registered tax agent to confirm aggregation before claiming Div 152 concessions.',
      citation: { kind: 'ITAA_1997', reference: 's152-15', lastReviewed: '2026-05-05' },
    });
  }

  if (!basicConditionsMet) {
    return {
      basicConditionsMet: false,
      fifteenYearExemptionApplied: false,
      activeAssetReductionApplied: false,
      retirementExemptionApplied: 0,
      rolloverApplied: 0,
      assessableGain: gainAfterDiv115,
      gainBeforeConcessions,
      steps: [
        {
          concession: 'Basic conditions not met',
          reduction: 0,
          runningGain: gainAfterDiv115,
          citation: 's152-10',
        },
      ],
      citations,
      uncomputed,
    };
  }

  let runningGain = gainBeforeConcessions;

  // Step 1: 15-year exemption (s152-105). Gain entirely disregarded.
  // Requires (a) asset held ≥ 15 years AND (b) retirement OR incapacity.
  if (monthsHeld >= FIFTEEN_YEAR_MONTHS && isRetirementOrIncapacity) {
    citations.push({ kind: 'ITAA_1997', reference: 's152-105', lastReviewed: '2026-05-05' });
    steps.push({
      concession: '15-year exemption',
      reduction: runningGain,
      runningGain: 0,
      citation: 's152-105',
    });
    return {
      basicConditionsMet: true,
      fifteenYearExemptionApplied: true,
      activeAssetReductionApplied: false,
      retirementExemptionApplied: 0,
      rolloverApplied: 0,
      assessableGain: 0,
      gainBeforeConcessions,
      steps,
      citations,
      uncomputed,
    };
  }

  // Step 2: 50% active asset reduction (s152-205).
  let activeAssetReductionApplied = false;
  if (electActiveAssetReduction) {
    citations.push({ kind: 'ITAA_1997', reference: 's152-205', lastReviewed: '2026-05-05' });
    const reduction = runningGain * 0.5;
    runningGain -= reduction;
    activeAssetReductionApplied = true;
    steps.push({
      concession: '50% active asset reduction',
      reduction,
      runningGain,
      citation: 's152-205',
    });
  }

  // Step 3: Retirement exemption (s152-305). Capped at $500k lifetime.
  let retirementExemptionApplied = 0;
  if (electRetirementExemption && runningGain > 0) {
    citations.push({ kind: 'ITAA_1997', reference: 's152-305', lastReviewed: '2026-05-05' });
    const remainingLifetimeCap = Math.max(
      0,
      RETIREMENT_LIFETIME_CAP - retirementExemptionUsedToDate,
    );
    retirementExemptionApplied = Math.min(runningGain, remainingLifetimeCap);
    runningGain -= retirementExemptionApplied;
    steps.push({
      concession: 'Retirement exemption',
      reduction: retirementExemptionApplied,
      runningGain,
      citation: 's152-305',
    });
    if (retirementExemptionApplied < runningGain + retirementExemptionApplied) {
      // Lifetime cap was the binding constraint
      if (remainingLifetimeCap < runningGain + retirementExemptionApplied) {
        uncomputed.push({
          id: 'UC-DIV152-RETIREMENT-CAP',
          rationale: `Retirement exemption capped at $${remainingLifetimeCap.toLocaleString()} (remaining lifetime cap). Cumulative cap is $${RETIREMENT_LIFETIME_CAP.toLocaleString()} per s152-310.`,
          citation: { kind: 'ITAA_1997', reference: 's152-310', lastReviewed: '2026-05-05' },
        });
      }
    }
  }

  // Step 4: Rollover (s152-410). v1 reports the rollover amount but
  // doesn't track replacement-asset acquisition (UNCOMPUTED).
  let rolloverApplied = 0;
  if (electRollover && runningGain > 0) {
    citations.push({ kind: 'ITAA_1997', reference: 's152-410', lastReviewed: '2026-05-05' });
    rolloverApplied = runningGain;
    runningGain = 0;
    steps.push({
      concession: 'Small business rollover',
      reduction: rolloverApplied,
      runningGain,
      citation: 's152-410',
    });
    uncomputed.push({
      id: 'UC-DIV152-ROLLOVER',
      rationale:
        'Small business rollover under s152-410 deferred. Caller must acquire replacement asset (or improve existing) within 2 years OR the deferred gain is recognised in the FY the replacement period ends. Replacement-asset tracking lands in a future sub-PR.',
      citation: { kind: 'ITAA_1997', reference: 's152-410', lastReviewed: '2026-05-05' },
    });
  }

  return {
    basicConditionsMet: true,
    fifteenYearExemptionApplied: false,
    activeAssetReductionApplied,
    retirementExemptionApplied,
    rolloverApplied,
    assessableGain: runningGain,
    gainBeforeConcessions,
    steps,
    citations,
    uncomputed,
  };
}

// =============================================================================
// Q-DEC PR 2.D.3c2 — Decimal sibling path
// =============================================================================

export interface Div152InputDecimal {
  gainAfterDiv115: number | string | Decimal;
  maxNetAssetValue: number | string | Decimal;
  aggregatedTurnover: number | string | Decimal;
  isActiveAsset: boolean;
  monthsHeld: number;
  isRetirementOrIncapacity: boolean;
  electActiveAssetReduction?: boolean;
  electRetirementExemption?: boolean;
  retirementExemptionUsedToDate?: number | string | Decimal;
  electRollover?: boolean;
}

export interface Div152ResultDecimal {
  basicConditionsMet: boolean;
  fifteenYearExemptionApplied: boolean;
  activeAssetReductionApplied: boolean;
  retirementExemptionApplied: Decimal;
  rolloverApplied: Decimal;
  assessableGain: Decimal;
  /** MON-110 — see Div152Result.gainBeforeConcessions. */
  gainBeforeConcessions: Decimal;
  steps: Array<{
    concession: string;
    reduction: Decimal;
    runningGain: Decimal;
    citation: string;
  }>;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * Decimal sibling of `applyDiv152`. Stacks: 15-year exemption → 50%
 * active asset reduction → retirement exemption (capped $500k lifetime)
 * → rollover. Preserves the s152-310 lifetime cap arithmetic via
 * `Decimal.min` + `Decimal.max`.
 */
export function applyDiv152Decimal(input: Div152InputDecimal): Div152ResultDecimal {
  const zero = new Decimal(0);
  const gainAfterDiv115 = toDecimal(input.gainAfterDiv115) ?? zero;
  const maxNetAssetValue = toDecimal(input.maxNetAssetValue) ?? zero;
  const aggregatedTurnover = toDecimal(input.aggregatedTurnover) ?? zero;
  const retirementExemptionUsedToDate = toDecimal(input.retirementExemptionUsedToDate ?? 0) ?? zero;
  const {
    isActiveAsset,
    monthsHeld,
    isRetirementOrIncapacity,
    electActiveAssetReduction = true,
    electRetirementExemption = false,
    electRollover = false,
  } = input;

  const citations: AuthorityCitation[] = [...BASE_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];
  const steps: Div152ResultDecimal['steps'] = [];
  // MON-110: the ONE stated starting point for the ladder (and the surface).
  const gainBeforeConcessions = Decimal.max(zero, gainAfterDiv115);

  const mnavThreshold = new Decimal(MNAV_THRESHOLD);
  const turnoverThreshold = new Decimal(TURNOVER_THRESHOLD);
  const passesMnav = maxNetAssetValue.lte(mnavThreshold);
  const passesTurnover = aggregatedTurnover.lte(turnoverThreshold);
  const basicConditionsMet = isActiveAsset && (passesMnav || passesTurnover);

  // Boundary-aggregation warning — same 80%-120% range as Float.
  const mnavLow = mnavThreshold.times('0.8');
  const mnavHigh = mnavThreshold.times('1.2');
  const turnoverLow = turnoverThreshold.times('0.8');
  const turnoverHigh = turnoverThreshold.times('1.2');
  if (
    (maxNetAssetValue.gte(mnavLow) && maxNetAssetValue.lte(mnavHigh)) ||
    (aggregatedTurnover.gte(turnoverLow) && aggregatedTurnover.lte(turnoverHigh))
  ) {
    uncomputed.push({
      id: 'UC-DIV152-AGGREGATION',
      rationale:
        'MNAV or aggregated turnover is near the s152-15/s152-20 threshold. Per s152-15(2) the taxpayer must aggregate connected entities + affiliates — v1 takes caller-provided figures at face value. Engage a registered tax agent to confirm aggregation before claiming Div 152 concessions.',
      citation: { kind: 'ITAA_1997', reference: 's152-15', lastReviewed: '2026-05-05' },
    });
  }

  if (!basicConditionsMet) {
    return {
      basicConditionsMet: false,
      fifteenYearExemptionApplied: false,
      activeAssetReductionApplied: false,
      retirementExemptionApplied: zero,
      rolloverApplied: zero,
      assessableGain: gainAfterDiv115,
      gainBeforeConcessions,
      steps: [
        { concession: 'Basic conditions not met', reduction: zero, runningGain: gainAfterDiv115, citation: 's152-10' },
      ],
      citations,
      uncomputed,
    };
  }

  let runningGain = gainBeforeConcessions;

  // 15-year exemption.
  if (monthsHeld >= FIFTEEN_YEAR_MONTHS && isRetirementOrIncapacity) {
    citations.push({ kind: 'ITAA_1997', reference: 's152-105', lastReviewed: '2026-05-05' });
    steps.push({
      concession: '15-year exemption',
      reduction: runningGain,
      runningGain: zero,
      citation: 's152-105',
    });
    return {
      basicConditionsMet: true,
      fifteenYearExemptionApplied: true,
      activeAssetReductionApplied: false,
      retirementExemptionApplied: zero,
      rolloverApplied: zero,
      assessableGain: zero,
      gainBeforeConcessions,
      steps,
      citations,
      uncomputed,
    };
  }

  // 50% active asset reduction.
  let activeAssetReductionApplied = false;
  if (electActiveAssetReduction) {
    citations.push({ kind: 'ITAA_1997', reference: 's152-205', lastReviewed: '2026-05-05' });
    const reduction = runningGain.times('0.5');
    runningGain = runningGain.minus(reduction);
    activeAssetReductionApplied = true;
    steps.push({
      concession: '50% active asset reduction',
      reduction,
      runningGain,
      citation: 's152-205',
    });
  }

  // Retirement exemption — capped at $500k lifetime.
  let retirementExemptionApplied = zero;
  if (electRetirementExemption && runningGain.gt(0)) {
    citations.push({ kind: 'ITAA_1997', reference: 's152-305', lastReviewed: '2026-05-05' });
    const cap = new Decimal(RETIREMENT_LIFETIME_CAP);
    const remainingLifetimeCap = Decimal.max(zero, cap.minus(retirementExemptionUsedToDate));
    retirementExemptionApplied = Decimal.min(runningGain, remainingLifetimeCap);
    const gainBeforeRetirementExemption = runningGain;
    runningGain = runningGain.minus(retirementExemptionApplied);
    steps.push({
      concession: 'Retirement exemption',
      reduction: retirementExemptionApplied,
      runningGain,
      citation: 's152-305',
    });
    // Float's lifetime-cap warning fires when remaining cap < pre-exemption gain.
    if (remainingLifetimeCap.lt(gainBeforeRetirementExemption)) {
      uncomputed.push({
        id: 'UC-DIV152-RETIREMENT-CAP',
        rationale: `Retirement exemption capped at $${remainingLifetimeCap.toDecimalPlaces(0).toString()} (remaining lifetime cap). Cumulative cap is $${RETIREMENT_LIFETIME_CAP.toLocaleString()} per s152-310.`,
        citation: { kind: 'ITAA_1997', reference: 's152-310', lastReviewed: '2026-05-05' },
      });
    }
  }

  // Rollover.
  let rolloverApplied = zero;
  if (electRollover && runningGain.gt(0)) {
    citations.push({ kind: 'ITAA_1997', reference: 's152-410', lastReviewed: '2026-05-05' });
    rolloverApplied = runningGain;
    runningGain = zero;
    steps.push({
      concession: 'Small business rollover',
      reduction: rolloverApplied,
      runningGain,
      citation: 's152-410',
    });
    uncomputed.push({
      id: 'UC-DIV152-ROLLOVER',
      rationale:
        'Small business rollover under s152-410 deferred. Caller must acquire replacement asset (or improve existing) within 2 years OR the deferred gain is recognised in the FY the replacement period ends. Replacement-asset tracking lands in a future sub-PR.',
      citation: { kind: 'ITAA_1997', reference: 's152-410', lastReviewed: '2026-05-05' },
    });
  }

  return {
    basicConditionsMet: true,
    fifteenYearExemptionApplied: false,
    activeAssetReductionApplied,
    retirementExemptionApplied,
    rolloverApplied,
    assessableGain: runningGain,
    gainBeforeConcessions,
    steps,
    citations,
    uncomputed,
  };
}
