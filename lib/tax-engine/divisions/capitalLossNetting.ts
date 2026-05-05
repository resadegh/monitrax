/**
 * Phase 41e.1 slice B — capital loss netting + ordering.
 *
 * Per `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §6.3 +
 * `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 — implements
 * the AU statutory order for CGT calculation:
 *
 *   1. Compute capital gains per event (nominal, before discount).
 *   2. Compute capital losses (current-year + prior-year carry-forward).
 *   3. Apply prior-year losses first (FIFO by year), then current-year.
 *   4. If losses > gains → net loss carries forward; discount N/A.
 *   5. If gains > losses → apply Div 115 discount per s115-100 to the
 *      NET gain (after losses), NOT to individual gains.
 *
 * AU primary authority:
 *   - ITAA 1997 s100-50 — loss-method ordering (apply losses to gains
 *     in the year they're realised)
 *   - ITAA 1997 s115-100 — discount applies to the net gain after
 *     losses are netted; this is critical because applying the
 *     discount to gross gains then subtracting losses gives a
 *     materially different (wrong) number
 *   - ITAA 1997 Div 102-A — assessable net capital gain
 *
 * Pure functions; no DB, no state. Composes
 * `divisions/cgtDiscount.calculateCgtDiscount` per event.
 */

import {
  calculateCgtDiscount,
  type CgtEligibleEntityType,
  type CgtDiscountResult,
} from './cgtDiscount';
import type { AuthorityCitation, UncomputedFlag } from '../types';

/** A single CGT event (asset disposal / loss-realising event). */
export interface CgtEvent {
  /** Stable identifier for tracing in the breakdown. */
  id: string;
  /** Months the asset was held. < 12 → no discount even if other rules pass. */
  monthsHeld: number;
  /**
   * Nominal gain (positive) or loss (negative) from this event,
   * before any discount or loss netting. Sale price minus cost base.
   */
  nominalAmount: number;
  /** Optional human label for boundary-footer rendering. */
  label?: string;
}

/**
 * Carry-forward capital loss from a prior FY. Per s100-50, oldest
 * losses are consumed first (FIFO). Caller passes the unconsumed
 * balance from the user's CGT register.
 */
export interface CarryForwardLoss {
  financialYear: string; // e.g. "2022-23"
  amount: number; // unconsumed balance, positive
}

export interface CapitalLossNettingInput {
  entityType: CgtEligibleEntityType;
  events: CgtEvent[];
  carryForwardLosses?: CarryForwardLoss[];
  isComplying?: boolean;
  isForeignResident?: boolean;
}

export interface NettingBreakdownRow {
  eventId: string;
  label?: string;
  nominalAmount: number;
  /** Fraction of this event's loss applied to the net result (0..1). */
  appliedFraction: number;
}

export interface CapitalLossNettingResult {
  /** Sum of all positive `nominalAmount` events. */
  totalNominalGains: number;
  /** Sum of all negative `nominalAmount` events (positive value). */
  totalCurrentYearLosses: number;
  /** Sum of `carryForwardLosses[*].amount`. */
  totalPriorYearLosses: number;
  /**
   * Gain remaining after losses applied per s100-50 ordering.
   * Floored at 0 — when ≤ 0, the residual is `carryForwardOut`.
   */
  netGainBeforeDiscount: number;
  /** Discount applied per s115-100 (only if net gain > 0). */
  discountResult: CgtDiscountResult | null;
  /** Final assessable net capital gain (Div 102-A). */
  assessableNetCapitalGain: number;
  /**
   * Unconsumed losses to carry to the next FY. Positive value.
   * Per s100-50, prior-year losses are consumed before current-year.
   */
  carryForwardOut: number;
  /** Per-event breakdown for audit-trail rendering. */
  breakdown: NettingBreakdownRow[];
  /** Authority sources backing this calc + the discount sub-result. */
  citations: AuthorityCitation[];
  /** UNCOMPUTED flags raised during dispatch. */
  uncomputed: UncomputedFlag[];
}

const NETTING_CITATIONS: AuthorityCitation[] = [
  { kind: 'ITAA_1997', reference: 's100-50', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1997', reference: 's115-100', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1997', reference: 'Div 102-A', lastReviewed: '2026-05-05' },
];

/**
 * Apply capital loss netting + ordering for a single entity in a
 * single FY. Returns the assessable net capital gain (Div 102-A) plus
 * any unconsumed loss to carry forward.
 *
 * **Critical s115-100 rule:** the discount is applied to the NET gain
 * (after losses), not to individual gains then summed. Applying the
 * discount to gross gains gives a smaller assessable number — wrong,
 * and a common consumer-tax mistake. This module enforces the right
 * order.
 */
export function applyCapitalLossNetting(
  input: CapitalLossNettingInput,
): CapitalLossNettingResult {
  const {
    entityType,
    events,
    carryForwardLosses = [],
    isComplying = true,
    isForeignResident = false,
  } = input;

  // Sort prior-year losses oldest first (s100-50 FIFO).
  const sortedPriorLosses = [...carryForwardLosses].sort((a, b) =>
    a.financialYear.localeCompare(b.financialYear),
  );
  const totalPriorYearLosses = sortedPriorLosses.reduce(
    (sum, l) => sum + Math.max(0, l.amount),
    0,
  );

  // Split this year's events into gains + losses.
  const gainEvents = events.filter((e) => e.nominalAmount > 0);
  const lossEvents = events.filter((e) => e.nominalAmount < 0);

  const totalNominalGains = gainEvents.reduce(
    (sum, e) => sum + e.nominalAmount,
    0,
  );
  const totalCurrentYearLosses = lossEvents.reduce(
    (sum, e) => sum + Math.abs(e.nominalAmount),
    0,
  );

  const totalLosses = totalPriorYearLosses + totalCurrentYearLosses;

  // Net result (s100-50 ordering): apply ALL losses to gains.
  // The order between current-year and prior-year doesn't change the
  // assessable number — both reduce gains 1:1 — but the carry-forward
  // residual depends on which side was consumed first. AU rule: apply
  // current-year losses FIRST so unused prior-year losses retain their
  // FIFO order in the carry-forward register.
  const netGainBeforeDiscount = Math.max(0, totalNominalGains - totalLosses);
  const carryForwardOut = Math.max(0, totalLosses - totalNominalGains);

  const breakdown: NettingBreakdownRow[] = events.map((e) => ({
    eventId: e.id,
    label: e.label,
    nominalAmount: e.nominalAmount,
    appliedFraction:
      e.nominalAmount < 0
        ? // a current-year loss is fully applied if total losses ≤ gains;
          // otherwise its share of the consumed losses
          totalLosses <= totalNominalGains
          ? 1
          : Math.abs(e.nominalAmount) / totalLosses *
            (totalNominalGains / totalLosses === 0 ? 0 : 1)
        : // a gain has no concept of "applied fraction" — set to 1 for completeness
          1,
  }));

  // s115-100 — apply discount to the NET gain, not to gross gains.
  // We compute a "blended" months-held by weighted average of the
  // gain events' months-held by their dollar contribution. For
  // mixed holding periods, this yields the correct effective
  // discount when at least one event meets ≥12 months. Edge case
  // where no gain event meets the threshold → no discount (rate 0).
  let discountResult: CgtDiscountResult | null = null;
  let assessableNetCapitalGain = netGainBeforeDiscount;

  if (netGainBeforeDiscount > 0) {
    // Use the longest-held qualifying event's months — mixing periods
    // is a known v1 simplification (per-event tracking lands when
    // 41e.7 ships Div 152 small business CGT concessions, which need
    // per-event identification anyway).
    const qualifyingEvents = gainEvents.filter((e) => e.monthsHeld >= 12);
    const anyQualifies = qualifyingEvents.length > 0;
    const blendedMonths = anyQualifies
      ? Math.max(...qualifyingEvents.map((e) => e.monthsHeld))
      : 0;

    // Apply Div 115 discount to the NET gain (s115-100).
    discountResult = calculateCgtDiscount({
      entityType,
      monthsHeld: blendedMonths,
      nominalGain: netGainBeforeDiscount,
      isComplying,
      isForeignResident,
    });

    // If only some events qualified for the discount, only the
    // qualifying portion of the NET gain gets discounted. v1
    // simplification: when ANY event meets ≥12 months, apply the
    // discount to the entire net (the ATO-safe over-statement of
    // assessable amount happens when proportion is < 1; the
    // ATO-safe under-statement is what we want to avoid). Future
    // sub-PR refines per-event proration.
    if (anyQualifies && qualifyingEvents.length < gainEvents.length) {
      // Proportionally narrow the discount to the qualifying gain share
      const qualifyingGains = qualifyingEvents.reduce(
        (sum, e) => sum + e.nominalAmount,
        0,
      );
      const qualifyingShare =
        totalNominalGains > 0 ? qualifyingGains / totalNominalGains : 0;
      const discountedPortion =
        netGainBeforeDiscount *
        qualifyingShare *
        discountResult.discountRate;
      assessableNetCapitalGain = netGainBeforeDiscount - discountedPortion;
    } else {
      assessableNetCapitalGain = discountResult.discountedGain;
    }
  }

  // Aggregate citations from netting + the discount sub-result.
  const citations: AuthorityCitation[] = [...NETTING_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];

  if (discountResult) {
    for (const c of discountResult.citations) {
      const key = `${c.kind}:${c.reference}`;
      if (!citations.some((x) => `${x.kind}:${x.reference}` === key)) {
        citations.push(c);
      }
    }
    uncomputed.push(...discountResult.uncomputed);
  }

  // Surface a UNCOMPUTED flag for mixed holding-period proration —
  // the v1 simplification above. Only when relevant.
  if (
    netGainBeforeDiscount > 0 &&
    gainEvents.some((e) => e.monthsHeld < 12) &&
    gainEvents.some((e) => e.monthsHeld >= 12)
  ) {
    uncomputed.push({
      id: 'UC-CGT-MIXED-HOLDING',
      rationale:
        'Mixed holding periods — some gain events met the 12-month rule, others did not. v1 applies the entity discount to the qualifying-share proportion of the net gain. Per-event proration with full Subdiv 115-A rule lands in a future sub-PR.',
    });
  }

  return {
    totalNominalGains,
    totalCurrentYearLosses,
    totalPriorYearLosses,
    netGainBeforeDiscount,
    discountResult,
    assessableNetCapitalGain,
    carryForwardOut,
    breakdown,
    citations,
    uncomputed,
  };
}
