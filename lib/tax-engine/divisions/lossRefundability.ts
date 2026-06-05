/**
 * Phase 41E.1 — Loss refundability + carry-back (Measure 5, skeleton).
 *
 * **STAGE 1 SKELETON.** Returns `UC-LOSS-CARRYBACK-PENDING-BILL` until
 * the implementing Bill assents. Per CLAUDE.md §12.14 FW-2 — no silent
 * post-reform numbers. The carry-back mechanic IS code-ready (mirrors
 * the 2020-22 COVID stimulus mechanic verbatim per Treasury), but the
 * Royal Assent gate keeps this a skeleton in Stage 1.
 *
 * Per `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10.5.
 *
 * **What this module will do (Stage 2 — mechanic ships when Bill assents):**
 *   1. Check eligibility: COMPANY entity + turnover < $1B + has a loss
 *      in current FY + has tax paid in either of the prior 2 FYs.
 *   2. Read `CompanyTaxHistory` rows for the entity + prior 2 FYs
 *      (this is the new model added in 41E.0 schema migration).
 *   3. Compute refund = `min(loss × priorYearRate, priorYearFrankingBalance)`.
 *   4. The carry-back is ELECTIVE — return the eligible refund + let
 *      the caller surface it as an opt-in affordance (never auto-apply).
 *
 * **Three components, three commencements:**
 *   - Loss carry-back (companies < $1B): CURRENT FY 2026-27 (this FY!).
 *   - Start-up loss refundability (up to FBT + withholding paid): FY 2028-29.
 *   - R&D Tax Incentive rework: FY 2028-29.
 *
 * Stage 1 ships only the carry-back skeleton. Start-up + R&DTI rework
 * are queued for later Stage-2 sub-PRs.
 *
 * **Open questions resolved at Stage 2 (§3 Measure 5):**
 *   - Q1 — does the new measure resurrect the 2020-22 mechanic verbatim
 *     or modify it? Treasury indicated mirror; confirm via Bill text.
 *   - Q2 — start-up FBT+withholding cap: gross or net of refunds?
 *   - Q3 — R&DTI activity-eligibility test changes.
 *
 * Scope: only COMPANY entities (LegalEntityType.COMPANY).
 */

import type { AuthorityCitation, TaxYearConfig, UncomputedFlag } from '../types';
import { Decimal, toDecimal } from '@/lib/decimal';

export type LossRefundabilityEntityType = 'COMPANY' | 'OTHER';

/**
 * Per-FY tax-position snapshot for a company entity. Caller composes
 * from `CompanyTaxHistory` (Prisma model added in 41E.0 schema).
 */
export interface CompanyFyTaxPosition {
  fy: string; // "2024-25" / "2025-26" / "2026-27"
  taxablePosition: number; // negative = loss; positive = profit
  taxPaid: number;
  frankingAccountBalance: number;
}

export interface LossRefundabilityInput {
  /** Entity ID (for tracing). */
  entityId: string;
  /** Entity type — only COMPANY is in scope. */
  entityType: LossRefundabilityEntityType;
  /** Annual turnover for the current FY (must be < $1B for carry-back eligibility). */
  annualTurnoverCurrentFy: number;
  /**
   * Current FY tax position. The loss-carry-back applies when
   * `taxablePosition < 0`.
   */
  currentFy: CompanyFyTaxPosition;
  /**
   * Prior 2 FYs' tax history. Carry-back may apply against either or both.
   */
  priorFy1?: CompanyFyTaxPosition; // immediately prior FY
  priorFy2?: CompanyFyTaxPosition; // 2 FYs prior
  /** Resolved `TaxYearConfig` for the current FY. */
  config: TaxYearConfig;
}

export interface LossRefundabilityResult {
  /** Whether the entity is in scope of Measure 5 carry-back. */
  inScope: boolean;
  /** Whether the module produced a real number or returned UNCOMPUTED. */
  computed: boolean;
  /** Refund eligible under carry-back election. 0 when UNCOMPUTED or out-of-scope. */
  refundEligible: number;
  /**
   * Breakdown of refund per prior FY. Empty array when UNCOMPUTED.
   * Caller surfaces this as the "you could claim back $X from FY 2024-25
   * + $Y from FY 2025-26" UI breakdown.
   */
  perPriorFyBreakdown: Array<{
    fy: string;
    refundFromThisFy: number;
    cappedByFrankingBalance: boolean;
  }>;
  reason: string;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

const TURNOVER_CAP_AUD = 1_000_000_000; // $1B turnover ceiling for carry-back eligibility

const STAGE_1_CITATION: AuthorityCitation = {
  kind: 'ITAA_1997',
  reference: 'Loss carry-back amendments (proposed Phase 41E Measure 5)',
  lastReviewed: '2026-05-16',
};

/**
 * Apply Measure 5 carry-back to a company's current-FY loss.
 *
 * **Stage 1 behaviour:** returns UNCOMPUTED for every eligible call.
 * The company's existing Phase 41e.15 loss-carry-forward flow is
 * unaffected — this module is purely additive.
 */
export function applyLossRefundability(input: LossRefundabilityInput): LossRefundabilityResult {
  // Scope gate 1 — non-companies are out of scope.
  if (input.entityType !== 'COMPANY') {
    return {
      inScope: false,
      computed: true,
      refundEligible: 0,
      perPriorFyBreakdown: [],
      reason: `Entity ${input.entityId} is ${input.entityType} — Measure 5 carry-back applies only to COMPANY entities with turnover < $${TURNOVER_CAP_AUD.toLocaleString()}.`,
      citations: [],
      uncomputed: [],
    };
  }

  // Scope gate 2 — turnover ceiling.
  if (input.annualTurnoverCurrentFy >= TURNOVER_CAP_AUD) {
    return {
      inScope: false,
      computed: true,
      refundEligible: 0,
      perPriorFyBreakdown: [],
      reason: `Company turnover $${Math.round(input.annualTurnoverCurrentFy).toLocaleString()} exceeds the $${TURNOVER_CAP_AUD.toLocaleString()} carry-back ceiling. Existing loss-carry-forward (Phase 41e.15) applies.`,
      citations: [STAGE_1_CITATION],
      uncomputed: [],
    };
  }

  // Scope gate 3 — no current-FY loss → no carry-back eligible.
  if (input.currentFy.taxablePosition >= 0) {
    return {
      inScope: true,
      computed: true,
      refundEligible: 0,
      perPriorFyBreakdown: [],
      reason: `Company has no loss in FY ${input.currentFy.fy} (taxable position $${Math.round(input.currentFy.taxablePosition).toLocaleString()}). Carry-back election is not relevant.`,
      citations: [STAGE_1_CITATION],
      uncomputed: [],
    };
  }

  // Scope gate 4 — commencement not yet verified → UNCOMPUTED.
  // FW-2 (CLAUDE.md §12.14): never silent post-reform numbers.
  if (!input.config.lossCarryBackCommencementVerified) {
    const lossAmount = Math.abs(input.currentFy.taxablePosition);
    return {
      inScope: true,
      computed: false,
      refundEligible: 0,
      perPriorFyBreakdown: [],
      reason:
        'Loss carry-back refund (Phase 41E Measure 5) — awaiting Royal Assent of the implementing Bill (Treasury announced the carry-back mirror of the 2020-22 mechanic; Bill not yet introduced). Existing loss-carry-forward (Phase 41e.15) applies as fallback.',
      citations: [STAGE_1_CITATION],
      uncomputed: [
        {
          id: 'UC-LOSS-CARRYBACK-PENDING-BILL',
          rationale: `Phase 41E Measure 5 (company loss carry-back, turnover < $${TURNOVER_CAP_AUD.toLocaleString()}, current FY 2026-27 onwards). Company ${input.entityId} has loss $${Math.round(lossAmount).toLocaleString()} in FY ${input.currentFy.fy}; prior 2 FYs available for carry-back when the Bill assents.`,
          citation: STAGE_1_CITATION,
        },
      ],
    };
  }

  // Stage 2 — mechanic ships when commencementVerified flips to true.
  throw new Error(
    '[Phase 41E.1] lossCarryBackCommencementVerified is true but the Measure 5 mechanic is not yet implemented. Do NOT flip the flag until Stage 2 lands the per-FY refund calculation + the franking-account cap (per the published Bill — mirrors 2020-22 COVID stimulus).',
  );
}

/** Convenience — turnover ceiling for AI advisor narration. */
export function getLossCarryBackTurnoverCapAud(): number {
  return TURNOVER_CAP_AUD;
}

// =============================================================================
// Q-DEC PR 2.D.3c — Decimal sibling path (§12.14 FW-2 preserved)
// =============================================================================

export interface CompanyFyTaxPositionDecimal {
  fy: string;
  taxablePosition: number | string | Decimal;
  taxPaid: number | string | Decimal;
  frankingAccountBalance: number | string | Decimal;
}

export interface LossRefundabilityInputDecimal {
  entityId: string;
  entityType: LossRefundabilityEntityType;
  annualTurnoverCurrentFy: number | string | Decimal;
  currentFy: CompanyFyTaxPositionDecimal;
  priorFy1?: CompanyFyTaxPositionDecimal;
  priorFy2?: CompanyFyTaxPositionDecimal;
  config: TaxYearConfig;
}

export interface LossRefundabilityResultDecimal {
  inScope: boolean;
  computed: boolean;
  refundEligible: Decimal;
  perPriorFyBreakdown: Array<{
    fy: string;
    refundFromThisFy: Decimal;
    cappedByFrankingBalance: boolean;
  }>;
  reason: string;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * Decimal sibling of `applyLossRefundability`. **Stage 1 behaviour
 * preserved** — out-of-scope for non-COMPANY / over-$1B turnover /
 * no current-FY loss; UNCOMPUTED when carry-back commencement
 * unverified. Stage 2 throws.
 */
export function applyLossRefundabilityDecimal(input: LossRefundabilityInputDecimal): LossRefundabilityResultDecimal {
  const zero = new Decimal(0);
  const turnover = toDecimal(input.annualTurnoverCurrentFy) ?? zero;
  const currentTaxablePosition = toDecimal(input.currentFy.taxablePosition) ?? zero;

  if (input.entityType !== 'COMPANY') {
    return {
      inScope: false,
      computed: true,
      refundEligible: zero,
      perPriorFyBreakdown: [],
      reason: `Entity ${input.entityId} is ${input.entityType} — Measure 5 carry-back applies only to COMPANY entities with turnover < $${TURNOVER_CAP_AUD.toLocaleString()}.`,
      citations: [],
      uncomputed: [],
    };
  }

  if (turnover.gte(TURNOVER_CAP_AUD)) {
    return {
      inScope: false,
      computed: true,
      refundEligible: zero,
      perPriorFyBreakdown: [],
      reason: `Company turnover $${turnover.toDecimalPlaces(0).toString()} exceeds the $${TURNOVER_CAP_AUD.toLocaleString()} carry-back ceiling. Existing loss-carry-forward (Phase 41e.15) applies.`,
      citations: [STAGE_1_CITATION],
      uncomputed: [],
    };
  }

  if (currentTaxablePosition.gte(0)) {
    return {
      inScope: false,
      computed: true,
      refundEligible: zero,
      perPriorFyBreakdown: [],
      reason: `Company ${input.entityId} has no current-FY loss (taxable position $${currentTaxablePosition.toDecimalPlaces(0).toString()}). Carry-back not applicable.`,
      citations: [STAGE_1_CITATION],
      uncomputed: [],
    };
  }

  if (!input.config.lossCarryBackCommencementVerified) {
    return {
      inScope: true,
      computed: false,
      refundEligible: zero,
      perPriorFyBreakdown: [],
      reason:
        'Loss carry-back (Phase 41E Measure 5) — awaiting Royal Assent of the implementing Bill. Existing loss-carry-forward flow applies until commencement is verified.',
      citations: [STAGE_1_CITATION],
      uncomputed: [
        {
          id: 'UC-LOSS-CARRYBACK-PENDING-BILL',
          rationale: `Phase 41E Measure 5 (loss carry-back for companies < $1B turnover) — Royal Assent of the implementing Bill not yet confirmed. Company ${input.entityId} eligible by turnover ($${turnover.toDecimalPlaces(0).toString()}) and current-FY loss ($${currentTaxablePosition.toDecimalPlaces(0).toString()}). Will compute eligible refund once commencement verified.`,
          citation: STAGE_1_CITATION,
        },
      ],
    };
  }

  throw new Error(
    '[Phase 41E.1] lossCarryBackCommencementVerified is true but the Measure 5 mechanic is not yet implemented. Do NOT flip the flag until Stage 2 lands the carry-back mechanic + franking-balance cap (per the published Bill).',
  );
}
