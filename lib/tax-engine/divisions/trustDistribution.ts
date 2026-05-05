/**
 * Phase 41e.1 slice C — trust distribution (Div 6 basic).
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 +
 * `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §5.5 — the
 * basic mechanism for allocating trust net income to beneficiaries
 * who are **presently entitled** at year-end.
 *
 * AU primary authority:
 *   - ITAA 1936 s95 — definition of "net income of the trust estate"
 *   - ITAA 1936 s97 — beneficiary presently entitled is assessed on
 *     their share of net income at the beneficiary's marginal rate
 *   - ITAA 1936 s98 — trustee assessed on a beneficiary's share where
 *     the beneficiary is a non-resident or under legal disability
 *   - ITAA 1936 s99 — trustee assessed on undistributed net income
 *     where some beneficiaries are presently entitled (lower rates)
 *   - ITAA 1936 s99A — **trustee assessed at penalty rate (47%)** on
 *     undistributed net income where NO beneficiary is presently
 *     entitled at year-end (default beneficiary clause failures)
 *   - ITAA 1936 s99B — corpus distribution to beneficiary; not
 *     assessable except for accumulated income
 *
 * **What this slice ships (basic):**
 *   - Allocate net income proportionally to beneficiaries' presently-
 *     entitled shares
 *   - Validate that shares sum to ≤ 1.0 (residual = undistributed)
 *   - Apply s99A penalty rate to any undistributed residual
 *   - Flag the s100A reimbursement-agreement risk as UNCOMPUTED
 *     (zone classifier lands in 41e.5)
 *
 * **What this slice does NOT ship:**
 *   - Div 6E streaming of franked dividends + capital gains to
 *     specific beneficiaries (lands in 41e.4) — basic v1 distributes
 *     character generically (everyone gets a slice of everything in
 *     the same proportion as their share)
 *   - s100A zone classification (TR 2022/4, PCG 2022/2) — lands in 41e.5
 *   - Non-resident / legal-disability beneficiary trustee assessment
 *     under s98 — flagged UNCOMPUTED
 *   - FTE / IEE chain rules — lands in 41e.10
 *
 * Pure functions. Composes nothing yet (slice D wires this in).
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';

/**
 * Penalty rate applied by s99A to undistributed net income of a
 * discretionary trust where no beneficiary is presently entitled at
 * year-end. Stored as a constant so the boundary footer can show users
 * exactly the rate that triggered.
 */
export const S99A_TRUSTEE_PENALTY_RATE = 0.47;

export interface TrustBeneficiary {
  /** Stable identifier for the beneficiary (e.g. linked LegalEntity id). */
  id: string;
  /** Display name for boundary footer + UI rendering. */
  name: string;
  /**
   * Beneficiary's presently-entitled share of trust net income, as a
   * decimal fraction (0.0 to 1.0). Sum across all beneficiaries should
   * be ≤ 1.0; any residual goes to the trustee at s99A penalty rate.
   */
  presentlyEntitledShare: number;
  /**
   * Optional flag — beneficiary is non-resident or under legal
   * disability (minor, bankrupt). When `true`, the trustee is assessed
   * on their share per s98 instead of the beneficiary. v1 surfaces
   * this as UNCOMPUTED `UC-S98-TRUSTEE-ASSESSMENT`; the calc still
   * reports the share to the named beneficiary.
   */
  isNonResidentOrDisabled?: boolean;
}

export interface TrustDistributionInput {
  /** The trust's net income per s95 (already computed by caller). */
  trustNetIncome: number;
  /**
   * Beneficiaries presently entitled at year-end. If empty AND
   * `trustNetIncome > 0`, the entire amount triggers s99A penalty.
   */
  beneficiaries: TrustBeneficiary[];
  /**
   * `true` if the trust is a complying discretionary trust under a
   * Family Trust Election (Sch 2F ITAA 1936). Affects reimbursement-
   * agreement risk surfaced as UNCOMPUTED. v1 doesn't change the
   * calc — flag is for the AFSL footer + audit trail.
   */
  hasFamilyTrustElection?: boolean;
}

export interface BeneficiaryDistribution {
  beneficiaryId: string;
  beneficiaryName: string;
  /** Share of net income at this beneficiary's marginal rate (s97). */
  share: number;
  /** Amount in dollars (trustNetIncome × share). */
  amount: number;
  /**
   * `true` when this beneficiary's share is assessed at the trustee
   * level under s98 (non-resident / legal disability). v1 surfaces but
   * doesn't compute the trustee tax — caller routes via UNCOMPUTED.
   */
  trusteeAssessedUnderS98: boolean;
}

export interface TrustDistributionResult {
  /** Per-beneficiary breakdown. */
  distributions: BeneficiaryDistribution[];
  /**
   * Net income retained by the trustee where no beneficiary is
   * presently entitled. Subject to s99A penalty rate.
   */
  trusteeRetainedAmount: number;
  /** Tax payable by the trustee on retained amount (s99A 47%). */
  trusteePenaltyTax: number;
  /** Sum of all `distributions[*].amount` + `trusteeRetainedAmount`. */
  totalAccountedFor: number;
  /** Authority sources backing this calc. */
  citations: AuthorityCitation[];
  /** UNCOMPUTED flags raised during dispatch (s100A, s98, etc.). */
  uncomputed: UncomputedFlag[];
}

const DIV6_BASE_CITATIONS: AuthorityCitation[] = [
  { kind: 'ITAA_1936', reference: 's95', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1936', reference: 's97', lastReviewed: '2026-05-05' },
];

/**
 * Allocate trust net income to presently-entitled beneficiaries per
 * the basic Div 6 mechanism. Returns per-beneficiary distribution +
 * any trustee-retained residual subject to s99A penalty rate.
 *
 * **Validation:**
 *   - Negative shares throw (caller must zero them).
 *   - Sum of shares > 1.0 throws (over-distribution is a deed error).
 *   - Sum of shares < 1.0 → the unused fraction is trustee-retained
 *     and taxed at s99A penalty rate.
 *
 * **What gets surfaced as UNCOMPUTED:**
 *   - `UC-S100A-RISK` — s100A reimbursement-agreement zone classifier
 *     (TR 2022/4, PCG 2022/2). Always flagged on any non-FTE trust
 *     distribution; flagged on FTE trusts only when there's a
 *     significant beneficiary share that may not match economic
 *     benefit. Zone classification lands in 41e.5.
 *   - `UC-S98-TRUSTEE-ASSESSMENT` — when any beneficiary is flagged
 *     non-resident or under legal disability.
 *   - `UC-DIV-6E-STREAMING` — character allocation (franked dividends,
 *     capital gains) lands in 41e.4. Until then, all character flows
 *     generically.
 */
export function allocateTrustDistribution(
  input: TrustDistributionInput,
): TrustDistributionResult {
  const {
    trustNetIncome,
    beneficiaries,
    hasFamilyTrustElection = false,
  } = input;

  // Validate beneficiary shares.
  for (const b of beneficiaries) {
    if (b.presentlyEntitledShare < 0) {
      throw new Error(
        `Beneficiary "${b.name}" (id=${b.id}) has negative share ${b.presentlyEntitledShare}. Shares must be ≥ 0.`,
      );
    }
  }

  const totalShare = beneficiaries.reduce(
    (sum, b) => sum + b.presentlyEntitledShare,
    0,
  );

  if (totalShare > 1.0 + 1e-9) {
    throw new Error(
      `Sum of presently-entitled shares is ${totalShare} (> 1.0). Trust deed over-distribution.`,
    );
  }

  const distributions: BeneficiaryDistribution[] = beneficiaries.map((b) => ({
    beneficiaryId: b.id,
    beneficiaryName: b.name,
    share: b.presentlyEntitledShare,
    amount: trustNetIncome * b.presentlyEntitledShare,
    trusteeAssessedUnderS98: !!b.isNonResidentOrDisabled,
  }));

  const undistributedShare = Math.max(0, 1.0 - totalShare);
  const trusteeRetainedAmount = trustNetIncome * undistributedShare;
  const trusteePenaltyTax = trusteeRetainedAmount * S99A_TRUSTEE_PENALTY_RATE;

  const totalAccountedFor =
    distributions.reduce((sum, d) => sum + d.amount, 0) + trusteeRetainedAmount;

  // Build citations + UNCOMPUTED flags.
  const citations: AuthorityCitation[] = [...DIV6_BASE_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];

  if (trusteeRetainedAmount > 0) {
    citations.push({
      kind: 'ITAA_1936',
      reference: 's99A',
      lastReviewed: '2026-05-05',
    });
  }

  // s100A risk — always flag on basic-distribution trusts. The full
  // zone classifier (white / blue / green / red per PCG 2022/2) lands
  // in 41e.5. FTE trusts get a narrower flag wording.
  uncomputed.push({
    id: 'UC-S100A-RISK',
    rationale: hasFamilyTrustElection
      ? 'Family Trust Election trust — s100A reimbursement-agreement risk is generally low but not zero. Full zone classifier per TR 2022/4 + PCG 2022/2 lands with Phase 41e.5. Confirm with a registered tax agent if any beneficiary share materially exceeds their economic benefit.'
      : 's100A reimbursement-agreement risk per TR 2022/4 + PCG 2022/2 — zone classification (white/blue/green/red) lands with Phase 41e.5. Until then, distributions to non-FTE adult beneficiaries should be reviewed by a registered tax agent for the "ordinary family or commercial dealing" carve-out.',
    citation: { kind: 'TR', reference: '2022/4', lastReviewed: '2026-05-05' },
  });

  // Div 6E character streaming — flagged on every distribution.
  uncomputed.push({
    id: 'UC-DIV-6E-STREAMING',
    rationale:
      'Trust character (franked dividends, capital gains) is allocated generically in v1 — every beneficiary receives the same proportional mix as their net-income share. Per-beneficiary streaming under Div 6E lands with Phase 41e.4; until then, franking credits and capital gains pass through pro-rata only.',
    citation: { kind: 'ITAA_1997', reference: 'Div 6E', lastReviewed: '2026-05-05' },
  });

  // s98 trustee assessment — flag if any beneficiary is non-resident
  // or under legal disability.
  if (beneficiaries.some((b) => b.isNonResidentOrDisabled)) {
    uncomputed.push({
      id: 'UC-S98-TRUSTEE-ASSESSMENT',
      rationale:
        'One or more beneficiaries are non-resident or under legal disability — under s98 ITAA 1936 the trustee is assessed on their share at trustee rates. v1 reports the share to the named beneficiary; the trustee-level reassessment lands in a future sub-PR.',
      citation: { kind: 'ITAA_1936', reference: 's98', lastReviewed: '2026-05-05' },
    });
  }

  return {
    distributions,
    trusteeRetainedAmount,
    trusteePenaltyTax,
    totalAccountedFor,
    citations,
    uncomputed,
  };
}

/**
 * Helper — total distributable amount (trust net income that flows
 * through to beneficiaries, after s99A residual). Useful for callers
 * comparing intended vs actual distribution.
 */
export function getDistributableAmount(
  result: TrustDistributionResult,
): number {
  return result.totalAccountedFor - result.trusteeRetainedAmount;
}
