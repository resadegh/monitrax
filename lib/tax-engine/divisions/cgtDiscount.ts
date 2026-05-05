/**
 * Phase 41e.1 slice A — CGT discount (Div 115).
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 +
 * `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §5.2 — the
 * entity-aware CGT discount rate dispatch.
 *
 * AU primary authority:
 *   - ITAA 1997 s115-25 — basic 50% discount for individuals + trusts
 *   - ITAA 1997 s115-100 — discount percentage table
 *   - ITAA 1997 s115-280 — companies are NOT eligible for the discount
 *   - ITAA 1997 Subdiv 115-A — 12-month holding period rule
 *   - ITAA 1997 s295-105 — SMSF complying-fund discount (1/3 = 33⅓%)
 *
 * **Per-entity rate dispatch**:
 *   - PERSONAL_NAME / SOLE_TRADER / DISCRETIONARY_TRUST / UNIT_TRUST → 50%
 *   - SMSF (complying) → 33⅓% (1/3)
 *   - COMPANY → 0% (not eligible — full nominal gain taxed)
 *   - PARTNERSHIP → 50% but applied at partner level (s115-30)
 *   - Foreign-resident individual → 0% on the foreign-resident period
 *     (Subdiv 115-D, post 8 May 2012). v1 ignores the foreign-resident
 *     proportional rule; flagged as UNCOMPUTED `UC-FOREIGN-RESIDENT-CGT`.
 *
 * Pure functions — no DB, no state, no side effects. Composed by 41e.1
 * slice B (capital loss netting) and slice D (entityTaxRouter wiring).
 */

import type {
  AuthorityCitation,
  UncomputedFlag,
} from '../types';

export type CgtEligibleEntityType =
  | 'PERSONAL_NAME'
  | 'SOLE_TRADER'
  | 'PARTNERSHIP'
  | 'COMPANY'
  | 'DISCRETIONARY_TRUST'
  | 'UNIT_TRUST'
  | 'SMSF';

export interface CgtDiscountInput {
  /** The entity type that owns the asset being disposed. */
  entityType: CgtEligibleEntityType;
  /**
   * Months held between acquisition and CGT event A1. Discount only
   * applies when ≥ 12 (s115-25). Pre-Sept-1985 assets are out of CGT
   * scope entirely (handled by caller; this function trusts the input).
   */
  monthsHeld: number;
  /**
   * Nominal gain in dollars (sale price − cost base, before discount).
   * Negative values are losses — caller routes losses through the
   * loss-netting module (slice B), not this function.
   */
  nominalGain: number;
  /**
   * `true` if this is a complying superannuation fund. Only meaningful
   * when `entityType === 'SMSF'`. Default `true` — non-complying SMSFs
   * are vanishingly rare and lose the discount entirely (s115-100).
   */
  isComplying?: boolean;
  /**
   * `true` if the entity is foreign-resident at any point during the
   * asset's holding period (Subdiv 115-D). v1 surfaces this as an
   * UNCOMPUTED flag rather than computing the proportional rule.
   */
  isForeignResident?: boolean;
}

export interface CgtDiscountResult {
  /** The applicable discount rate as a decimal (0.5 / 0.3333... / 0). */
  discountRate: number;
  /** Discount amount in dollars (nominalGain × discountRate, capped at gain). */
  discountAmount: number;
  /** Discounted (taxable) capital gain. */
  discountedGain: number;
  /**
   * `true` if the asset met the 12-month holding rule. When `false`,
   * `discountRate` is 0 regardless of entity type.
   */
  metHoldingPeriod: boolean;
  /** Why the rate was what it was — surfaced in the boundary footer. */
  reason: string;
  /** Authority sources that backed the calculation. */
  citations: AuthorityCitation[];
  /** UNCOMPUTED flags raised during dispatch (foreign-resident etc). */
  uncomputed: UncomputedFlag[];
}

/**
 * 12-month holding period threshold per s115-25. Stored as a constant
 * here for clarity even though it's invariant — if AU policy ever
 * changes (it won't, but), this is the single home.
 */
const MIN_HOLDING_MONTHS = 12;

/**
 * Per-entity discount rates per Div 115. Rates are decimal (0.5 = 50%)
 * to match the existing `TaxYearConfig.cgtDiscount` convention.
 */
const ENTITY_DISCOUNT_RATE: Record<CgtEligibleEntityType, number> = {
  PERSONAL_NAME: 0.5,
  SOLE_TRADER: 0.5,
  PARTNERSHIP: 0.5,
  COMPANY: 0,
  DISCRETIONARY_TRUST: 0.5,
  UNIT_TRUST: 0.5,
  SMSF: 1 / 3, // 33⅓% per s115-100
};

const PER_ENTITY_REASON: Record<CgtEligibleEntityType, string> = {
  PERSONAL_NAME: '50% discount per ITAA 1997 s115-25 — individual.',
  SOLE_TRADER: '50% discount per ITAA 1997 s115-25 — sole trader (taxed as individual).',
  PARTNERSHIP: '50% discount per ITAA 1997 s115-25 — applied at the partner level (s115-30).',
  COMPANY: 'No discount — companies are not eligible (ITAA 1997 s115-280).',
  DISCRETIONARY_TRUST: '50% discount per ITAA 1997 s115-25 — flows to beneficiary on streamed distribution.',
  UNIT_TRUST: '50% discount per ITAA 1997 s115-25 — flows pro-rata to unit-holders.',
  SMSF: '33⅓% discount per ITAA 1997 s115-100 — complying superannuation fund.',
};

const COMMON_CITATIONS: AuthorityCitation[] = [
  { kind: 'ITAA_1997', reference: 's115-25', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1997', reference: 's115-100', lastReviewed: '2026-05-05' },
];

/**
 * Compute the CGT discount for a single disposal event.
 *
 * Returns a structurally complete `CgtDiscountResult` regardless of
 * input — the caller decides what to do with the discount (apply it,
 * stream it through Div 6, etc.). When `monthsHeld < 12`, the result
 * has `discountRate: 0` + reason `"Held < 12 months — full nominal gain
 * is taxable per s115-25."` rather than throwing — this keeps the
 * calc engine pure and makes the < 12-month case auditable in the
 * same way as the discounted case.
 */
export function calculateCgtDiscount(input: CgtDiscountInput): CgtDiscountResult {
  const {
    entityType,
    monthsHeld,
    nominalGain,
    isComplying = true,
    isForeignResident = false,
  } = input;

  const uncomputed: UncomputedFlag[] = [];
  const citations: AuthorityCitation[] = [...COMMON_CITATIONS];

  // Holding-period gate (s115-25). Applies regardless of entity type.
  if (monthsHeld < MIN_HOLDING_MONTHS) {
    return {
      discountRate: 0,
      discountAmount: 0,
      discountedGain: nominalGain,
      metHoldingPeriod: false,
      reason: `Held ${monthsHeld} months — full nominal gain is taxable per ITAA 1997 s115-25 (12-month rule).`,
      citations,
      uncomputed,
    };
  }

  // Non-complying SMSF → no discount (s115-100 carve-out).
  if (entityType === 'SMSF' && !isComplying) {
    return {
      discountRate: 0,
      discountAmount: 0,
      discountedGain: nominalGain,
      metHoldingPeriod: true,
      reason: 'No discount — non-complying SMSF (ITAA 1997 s115-100 carve-out).',
      citations: [
        ...citations,
        { kind: 'ITAA_1997', reference: 's115-100', lastReviewed: '2026-05-05' },
      ],
      uncomputed,
    };
  }

  // Foreign-resident discount apportionment (Subdiv 115-D) — flagged
  // UNCOMPUTED in v1. The full apportionment rule needs the asset's
  // foreign-resident days vs total holding days; this lands in a
  // future sub-PR (UC-FOREIGN-RESIDENT-CGT in audit §10.3).
  if (isForeignResident) {
    uncomputed.push({
      id: 'UC-FOREIGN-RESIDENT-CGT',
      rationale:
        'Foreign-resident CGT discount apportionment (Subdiv 115-D, post 8 May 2012) is not computed in v1. The full nominal gain may be taxable depending on residency dates. Confirm with a registered tax agent.',
      citation: { kind: 'ITAA_1997', reference: 'Subdiv 115-D', lastReviewed: '2026-05-05' },
    });
  }

  // Entity-aware rate dispatch.
  const discountRate = ENTITY_DISCOUNT_RATE[entityType];
  const discountAmount = Math.max(0, nominalGain) * discountRate;
  const discountedGain = nominalGain - discountAmount;
  const reason = PER_ENTITY_REASON[entityType];

  // Add the carve-out citation for COMPANY (s115-280) so the boundary
  // footer can show users exactly why no discount applied.
  if (entityType === 'COMPANY') {
    citations.push({
      kind: 'ITAA_1997',
      reference: 's115-280',
      lastReviewed: '2026-05-05',
    });
  }

  return {
    discountRate,
    discountAmount,
    discountedGain,
    metHoldingPeriod: true,
    reason,
    citations,
    uncomputed,
  };
}

/**
 * Helper — returns just the discount rate for an entity type, without
 * running a full calculation. Useful when callers (UI tooltips, AI
 * advisor narration) want to render "your trust gets 50% off".
 */
export function getCgtDiscountRate(
  entityType: CgtEligibleEntityType,
  isComplying = true,
): number {
  if (entityType === 'SMSF' && !isComplying) return 0;
  return ENTITY_DISCOUNT_RATE[entityType];
}
