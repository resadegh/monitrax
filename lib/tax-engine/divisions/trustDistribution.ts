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
import {
  classifyS100AZones,
  type S100AClassificationResult,
} from './s100aZoneClassifier';
import { Decimal, toDecimal } from '@/lib/decimal';

/**
 * Penalty rate applied by s99A to undistributed net income of a
 * discretionary trust where no beneficiary is presently entitled at
 * year-end. Stored as a constant so the boundary footer can show users
 * exactly the rate that triggered.
 */
export const S99A_TRUSTEE_PENALTY_RATE = 0.47;

/**
 * Phase 41e.4 — Validate that a streaming resolution date falls within
 * the AU FY. AU FY runs 1 July YEAR1 → 30 June YEAR2. A resolution
 * passed in the FY (or by 30 June) is valid; later than 30 June is
 * invalid (s207-58 + s115-228).
 *
 * If `financialYear` is omitted, the resolution is treated as
 * potentially-valid (the calc trusts the caller — typically the router
 * gets this from the FY config).
 */
function isResolutionValidForFy(
  resolutionAt: string | undefined,
  financialYear: string | undefined,
): boolean {
  if (!resolutionAt) return false;
  const resolutionDate = new Date(resolutionAt);
  if (isNaN(resolutionDate.getTime())) return false;
  if (!financialYear) return true; // trust caller
  // Parse "2024-25" → FY ends 30 June 2025
  const [startStr] = financialYear.split('-');
  const startYear = parseInt(startStr, 10);
  if (Number.isNaN(startYear)) return true;
  const fyStart = new Date(startYear, 6, 1); // July 1
  const fyEnd = new Date(startYear + 1, 5, 30, 23, 59, 59); // June 30
  return resolutionDate >= fyStart && resolutionDate <= fyEnd;
}

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
  /**
   * Phase 41e.4 — Div 6E streaming allocation override. When provided,
   * this beneficiary receives the named character (franked dividends,
   * capital gains) in absolute dollar amounts, instead of pro-rata. A
   * valid streaming resolution must exist on or before 30 June (per
   * s207-58 / s115-228) — caller passes via the input's
   * `streamingResolutionAt` field.
   *
   * If the sum of streaming allocations across beneficiaries doesn't
   * match the trust's character pools exactly, the residual is
   * distributed pro-rata to non-streaming beneficiaries.
   */
  streaming?: {
    /** Absolute $ of franked dividends streamed to this beneficiary. */
    frankedDividends?: number;
    /** Absolute $ of capital gains streamed to this beneficiary. */
    capitalGains?: number;
  };
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
   * Phase 41e.4 — Div 6E character pools. Pass when there are franked
   * dividends or capital gains in `trustNetIncome` and at least one
   * beneficiary has a `streaming` allocation. Without these pools,
   * streaming is silently ignored and pro-rata applies.
   */
  characterPools?: {
    frankedDividends?: number;
    capitalGains?: number;
  };
  /**
   * Phase 41e.4 — ISO date the streaming resolution was passed by the
   * trustee. Per s207-58 (franked dividends) + s115-228 (capital
   * gains), the resolution must be in writing by 30 June. The router
   * uses this to flip UC-DIV-6E-STREAMING off only when the date is
   * within the FY (otherwise the resolution is invalid → flag stays).
   */
  streamingResolutionAt?: string;
  /**
   * Phase 41e.4 — FY label (e.g. "2024-25") used to validate the
   * streaming resolution date. AU FY runs 1 July → 30 June.
   */
  financialYear?: string;
  /**
   * `true` if the trust is a complying discretionary trust under a
   * Family Trust Election (Sch 2F ITAA 1936). Affects reimbursement-
   * agreement risk surfaced as UNCOMPUTED. v1 doesn't change the
   * calc — flag is for the AFSL footer + audit trail.
   */
  hasFamilyTrustElection?: boolean;
  /**
   * Phase 41e.5 — `true` if the trust is testamentary / deceased-estate.
   * Drives WHITE-zone classification per PCG 2022/2 ¶13.
   */
  isTestamentaryTrust?: boolean;
  /**
   * Phase 41e.5 — per-beneficiary s100A facts. When supplied, the
   * always-on UC-S100A-RISK flag is replaced with a real PCG 2022/2
   * zone classification (white/green/blue/red) attached to
   * `s100aClassification` on the result.
   */
  s100aFacts?: ReadonlyArray<{
    beneficiaryId: string;
    relationshipToController?:
      | 'CONTROLLER'
      | 'IMMEDIATE_FAMILY'
      | 'EXTENDED_FAMILY'
      | 'UNRELATED';
    isMinor?: boolean;
    beneficiaryReceivedFunds?: boolean;
    unpaidPresentEntitlement?: boolean;
    fundsUsedByOther?: boolean;
  }>;
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
  /**
   * Phase 41e.4 — Div 6E character composition. Reports how this
   * beneficiary's `amount` is composed across the streamed character
   * pools. When no streaming was requested, the pools split pro-rata.
   * Sum of `frankedDividends` + `capitalGains` + `ordinaryIncome` ≤ `amount`
   * (could be < if part of the amount is unstreamable income types).
   */
  character: {
    frankedDividends: number;
    capitalGains: number;
    ordinaryIncome: number;
  };
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
  /**
   * Phase 41e.5 — s100A classifier result. Populated when caller
   * supplies `s100aFacts` for at least one beneficiary; otherwise
   * `undefined` and the always-on UC-S100A-RISK flag remains.
   */
  s100aClassification?: S100AClassificationResult;
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

  // ============================================================
  // Phase 41e.4 — Div 6E character streaming
  // ============================================================
  //
  // Determine per-beneficiary character composition (franked
  // dividends, capital gains, ordinary income). Two paths:
  //
  //   A) Streaming valid → caller supplied characterPools + at
  //      least one beneficiary has a `streaming` allocation +
  //      `streamingResolutionAt` is within the FY. Apply
  //      streaming explicitly; residual character flows pro-rata.
  //   B) No valid streaming → all character flows pro-rata to
  //      net-income shares (the v1 default). UC-DIV-6E-STREAMING
  //      flag stays.
  const pools = input.characterPools ?? {};
  const totalFrankedPool = Math.max(0, pools.frankedDividends ?? 0);
  const totalCapitalGainsPool = Math.max(0, pools.capitalGains ?? 0);
  const totalCharacterPool = totalFrankedPool + totalCapitalGainsPool;
  const totalOrdinaryPool = Math.max(0, trustNetIncome - totalCharacterPool);

  const hasStreamingAllocation = beneficiaries.some(
    (b) => b.streaming?.frankedDividends || b.streaming?.capitalGains,
  );
  const resolutionValid = isResolutionValidForFy(
    input.streamingResolutionAt,
    input.financialYear,
  );
  const streamingApplies =
    hasStreamingAllocation &&
    resolutionValid &&
    (totalFrankedPool > 0 || totalCapitalGainsPool > 0);

  const distributions: BeneficiaryDistribution[] = beneficiaries.map((b) => {
    const amount = trustNetIncome * b.presentlyEntitledShare;
    let frankedDividends = 0;
    let capitalGains = 0;
    if (streamingApplies) {
      // Explicit streaming — apply allocations directly. Residual
      // pools (after streaming) are then distributed pro-rata.
      frankedDividends = Math.max(0, b.streaming?.frankedDividends ?? 0);
      capitalGains = Math.max(0, b.streaming?.capitalGains ?? 0);
    } else {
      // Pro-rata across pools.
      frankedDividends = totalFrankedPool * b.presentlyEntitledShare;
      capitalGains = totalCapitalGainsPool * b.presentlyEntitledShare;
    }
    const ordinaryIncome = Math.max(0, amount - frankedDividends - capitalGains);
    return {
      beneficiaryId: b.id,
      beneficiaryName: b.name,
      share: b.presentlyEntitledShare,
      amount,
      trusteeAssessedUnderS98: !!b.isNonResidentOrDisabled,
      character: { frankedDividends, capitalGains, ordinaryIncome },
    };
  });

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

  // Phase 41e.4 — when streaming applies, cite Div 6E + s207-58 + s115-228.
  if (streamingApplies) {
    citations.push(
      { kind: 'ITAA_1997', reference: 'Div 6E', lastReviewed: '2026-05-05' },
      { kind: 'ITAA_1997', reference: 's207-58', lastReviewed: '2026-05-05' },
      { kind: 'ITAA_1997', reference: 's115-228', lastReviewed: '2026-05-05' },
    );
  }

  // Phase 41e.5 — s100A zone classification.
  // When `s100aFacts` is provided for at least one beneficiary, run
  // the classifier and attach the result. Replaces the always-on
  // UC-S100A-RISK flag with real per-beneficiary WHITE/GREEN/BLUE/RED
  // zones per PCG 2022/2.
  // Without facts, fall back to the conservative blanket flag.
  let s100aClassification: S100AClassificationResult | undefined;
  if (input.s100aFacts && input.s100aFacts.length > 0) {
    const factsByBenId = new Map(
      input.s100aFacts.map((f) => [f.beneficiaryId, f]),
    );
    const classifierInput = {
      beneficiaries: distributions.map((d) => {
        const f = factsByBenId.get(d.beneficiaryId);
        return {
          beneficiaryId: d.beneficiaryId,
          beneficiaryName: d.beneficiaryName,
          amount: d.amount,
          relationshipToController: f?.relationshipToController,
          isMinor: f?.isMinor,
          beneficiaryReceivedFunds: f?.beneficiaryReceivedFunds,
          unpaidPresentEntitlement: f?.unpaidPresentEntitlement,
          fundsUsedByOther: f?.fundsUsedByOther,
        };
      }),
      hasFamilyTrustElection,
      isTestamentaryTrust: !!input.isTestamentaryTrust,
    };
    s100aClassification = classifyS100AZones(classifierInput);
    // Merge classifier citations + uncomputed
    for (const c of s100aClassification.citations) {
      const exists = citations.some(
        (x) => x.kind === c.kind && x.reference === c.reference,
      );
      if (!exists) citations.push(c);
    }
    uncomputed.push(...s100aClassification.uncomputed);
  } else {
    // Fallback — caller didn't supply classifier facts. Keep the
    // 41e.1-slice-C wording but add the 41e.5 doc-pointer.
    uncomputed.push({
      id: 'UC-S100A-RISK',
      rationale: hasFamilyTrustElection
        ? 'Family Trust Election trust — s100A reimbursement-agreement risk is generally low but not zero. Phase 41e.5 zone classifier shipped — pass `s100aFacts` per beneficiary to get a real PCG 2022/2 zone classification. Without facts, the conservative blanket flag stays.'
        : 's100A reimbursement-agreement risk per TR 2022/4 + PCG 2022/2 — Phase 41e.5 zone classifier shipped. Pass `s100aFacts` per beneficiary (relationshipToController, beneficiaryReceivedFunds, unpaidPresentEntitlement, fundsUsedByOther) to receive a real WHITE/GREEN/BLUE/RED zone. Without facts, distributions to non-FTE adult beneficiaries should be reviewed by a registered tax agent.',
      citation: { kind: 'TR', reference: '2022/4', lastReviewed: '2026-05-05' },
    });
  }

  // Phase 41e.4 — UC-DIV-6E-STREAMING only surfaces when streaming is
  // NOT applied (no allocations OR invalid/missing resolution). When
  // streaming applies, the flag flips off — character is allocated
  // explicitly per the resolution.
  if (!streamingApplies) {
    if (hasStreamingAllocation && !resolutionValid) {
      uncomputed.push({
        id: 'UC-DIV-6E-STREAMING-INVALID-RESOLUTION',
        rationale:
          'Beneficiaries have streaming allocations but `streamingResolutionAt` is missing or outside the FY. Per s207-58 + s115-228 the trustee resolution must be in writing on or before 30 June. Streaming ignored; character flows pro-rata. Pass a valid `streamingResolutionAt` to activate Div 6E.',
        citation: { kind: 'ITAA_1997', reference: 's207-58', lastReviewed: '2026-05-05' },
      });
    } else {
      uncomputed.push({
        id: 'UC-DIV-6E-STREAMING',
        rationale:
          'No Div 6E streaming requested for this distribution — character (franked dividends, capital gains) flows pro-rata to net-income share. Pass `characterPools` + per-beneficiary `streaming` + `streamingResolutionAt` to activate explicit streaming under Div 6E.',
        citation: { kind: 'ITAA_1997', reference: 'Div 6E', lastReviewed: '2026-05-05' },
      });
    }
  }

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
    s100aClassification,
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

// =============================================================================
// Q-DEC PR 2.D.3c2 — Decimal sibling path
// =============================================================================

export interface TrustBeneficiaryDecimal {
  id: string;
  name: string;
  /** Decimal fraction (0..1). Decimal-typed so callers can preserve precision. */
  presentlyEntitledShare: number | string | Decimal;
  isNonResidentOrDisabled?: boolean;
  streaming?: {
    frankedDividends?: number | string | Decimal;
    capitalGains?: number | string | Decimal;
  };
}

export interface TrustDistributionInputDecimal {
  trustNetIncome: number | string | Decimal;
  beneficiaries: TrustBeneficiaryDecimal[];
  characterPools?: {
    frankedDividends?: number | string | Decimal;
    capitalGains?: number | string | Decimal;
  };
  streamingResolutionAt?: string;
  financialYear?: string;
  hasFamilyTrustElection?: boolean;
  isTestamentaryTrust?: boolean;
  s100aFacts?: TrustDistributionInput['s100aFacts'];
}

export interface BeneficiaryDistributionDecimal {
  beneficiaryId: string;
  beneficiaryName: string;
  share: Decimal;
  amount: Decimal;
  trusteeAssessedUnderS98: boolean;
  character: {
    frankedDividends: Decimal;
    capitalGains: Decimal;
    ordinaryIncome: Decimal;
  };
}

export interface TrustDistributionResultDecimal {
  distributions: BeneficiaryDistributionDecimal[];
  trusteeRetainedAmount: Decimal;
  trusteePenaltyTax: Decimal;
  totalAccountedFor: Decimal;
  s100aClassification?: S100AClassificationResult;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * Decimal sibling of `allocateTrustDistribution`. Validates beneficiary
 * shares + applies Div 6 mechanics in Decimal. Preserves the `totalShare
 * > 1.0 + 1e-9` over-distribution throw (Float epsilon tolerance — we
 * use `1e-9` literal directly).
 *
 * **`classifyS100AZones` is a categorical classifier** — we call the
 * Float version inline (with amounts converted to numbers at the
 * boundary) to inherit the WHITE/GREEN/BLUE/RED zone classification.
 * The classifier doesn't do money arithmetic; only categorical logic
 * + warning text. Same defensible bridge pattern as taxabilityRules
 * (PR 2.D.2b).
 */
export function allocateTrustDistributionDecimal(
  input: TrustDistributionInputDecimal,
): TrustDistributionResultDecimal {
  const zero = new Decimal(0);
  const trustNetIncome = toDecimal(input.trustNetIncome) ?? zero;
  const hasFamilyTrustElection = input.hasFamilyTrustElection ?? false;

  // Validate beneficiary shares (mirror Float validation).
  const beneficiariesDec = input.beneficiaries.map((b) => ({
    id: b.id,
    name: b.name,
    presentlyEntitledShare: toDecimal(b.presentlyEntitledShare) ?? zero,
    isNonResidentOrDisabled: b.isNonResidentOrDisabled,
    streaming: b.streaming,
  }));
  for (const b of beneficiariesDec) {
    if (b.presentlyEntitledShare.lt(0)) {
      throw new Error(
        `Beneficiary "${b.name}" (id=${b.id}) has negative share ${b.presentlyEntitledShare.toString()}. Shares must be ≥ 0.`,
      );
    }
  }

  let totalShare = new Decimal(0);
  for (const b of beneficiariesDec) totalShare = totalShare.plus(b.presentlyEntitledShare);

  const oneWithEpsilon = new Decimal(1).plus('1e-9');
  if (totalShare.gt(oneWithEpsilon)) {
    throw new Error(
      `Sum of presently-entitled shares is ${totalShare.toString()} (> 1.0). Trust deed over-distribution.`,
    );
  }

  // Character pools (Decimal).
  const pools = input.characterPools ?? {};
  const totalFrankedPool = Decimal.max(zero, toDecimal(pools.frankedDividends ?? 0) ?? zero);
  const totalCapitalGainsPool = Decimal.max(zero, toDecimal(pools.capitalGains ?? 0) ?? zero);

  const hasStreamingAllocation = beneficiariesDec.some(
    (b) =>
      (b.streaming?.frankedDividends != null && b.streaming.frankedDividends !== 0) ||
      (b.streaming?.capitalGains != null && b.streaming.capitalGains !== 0),
  );
  const resolutionValid = isResolutionValidForFy(
    input.streamingResolutionAt,
    input.financialYear,
  );
  const streamingApplies =
    hasStreamingAllocation &&
    resolutionValid &&
    (totalFrankedPool.gt(0) || totalCapitalGainsPool.gt(0));

  const distributions: BeneficiaryDistributionDecimal[] = beneficiariesDec.map((b) => {
    const amount = trustNetIncome.times(b.presentlyEntitledShare);
    let frankedDividends: Decimal;
    let capitalGains: Decimal;
    if (streamingApplies) {
      frankedDividends = Decimal.max(zero, toDecimal(b.streaming?.frankedDividends ?? 0) ?? zero);
      capitalGains = Decimal.max(zero, toDecimal(b.streaming?.capitalGains ?? 0) ?? zero);
    } else {
      frankedDividends = totalFrankedPool.times(b.presentlyEntitledShare);
      capitalGains = totalCapitalGainsPool.times(b.presentlyEntitledShare);
    }
    const ordinaryIncome = Decimal.max(zero, amount.minus(frankedDividends).minus(capitalGains));
    return {
      beneficiaryId: b.id,
      beneficiaryName: b.name,
      share: b.presentlyEntitledShare,
      amount,
      trusteeAssessedUnderS98: !!b.isNonResidentOrDisabled,
      character: { frankedDividends, capitalGains, ordinaryIncome },
    };
  });

  const undistributedShare = Decimal.max(zero, new Decimal(1).minus(totalShare));
  const trusteeRetainedAmount = trustNetIncome.times(undistributedShare);
  const trusteePenaltyTax = trusteeRetainedAmount.times(S99A_TRUSTEE_PENALTY_RATE);

  let totalAccountedFor = trusteeRetainedAmount;
  for (const d of distributions) totalAccountedFor = totalAccountedFor.plus(d.amount);

  const citations: AuthorityCitation[] = [...DIV6_BASE_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];

  if (trusteeRetainedAmount.gt(0)) {
    citations.push({ kind: 'ITAA_1936', reference: 's99A', lastReviewed: '2026-05-05' });
  }

  if (streamingApplies) {
    citations.push(
      { kind: 'ITAA_1997', reference: 'Div 6E', lastReviewed: '2026-05-05' },
      { kind: 'ITAA_1997', reference: 's207-58', lastReviewed: '2026-05-05' },
      { kind: 'ITAA_1997', reference: 's115-228', lastReviewed: '2026-05-05' },
    );
  }

  // s100A — Float classifier inherited via boundary conversion.
  let s100aClassification: S100AClassificationResult | undefined;
  if (input.s100aFacts && input.s100aFacts.length > 0) {
    const factsByBenId = new Map(
      input.s100aFacts.map((f) => [f.beneficiaryId, f]),
    );
    const classifierInput = {
      beneficiaries: distributions.map((d) => {
        const f = factsByBenId.get(d.beneficiaryId);
        return {
          beneficiaryId: d.beneficiaryId,
          beneficiaryName: d.beneficiaryName,
          amount: d.amount.toNumber(),
          relationshipToController: f?.relationshipToController,
          isMinor: f?.isMinor,
          beneficiaryReceivedFunds: f?.beneficiaryReceivedFunds,
          unpaidPresentEntitlement: f?.unpaidPresentEntitlement,
          fundsUsedByOther: f?.fundsUsedByOther,
        };
      }),
      hasFamilyTrustElection,
      isTestamentaryTrust: !!input.isTestamentaryTrust,
    };
    s100aClassification = classifyS100AZones(classifierInput);
    for (const c of s100aClassification.citations) {
      const exists = citations.some(
        (x) => x.kind === c.kind && x.reference === c.reference,
      );
      if (!exists) citations.push(c);
    }
    uncomputed.push(...s100aClassification.uncomputed);
  } else {
    uncomputed.push({
      id: 'UC-S100A-RISK',
      rationale: hasFamilyTrustElection
        ? 'Family Trust Election trust — s100A reimbursement-agreement risk is generally low but not zero. Phase 41e.5 zone classifier shipped — pass `s100aFacts` per beneficiary to get a real PCG 2022/2 zone classification. Without facts, the conservative blanket flag stays.'
        : 's100A reimbursement-agreement risk per TR 2022/4 + PCG 2022/2 — Phase 41e.5 zone classifier shipped. Pass `s100aFacts` per beneficiary (relationshipToController, beneficiaryReceivedFunds, unpaidPresentEntitlement, fundsUsedByOther) to receive a real WHITE/GREEN/BLUE/RED zone. Without facts, distributions to non-FTE adult beneficiaries should be reviewed by a registered tax agent.',
      citation: { kind: 'TR', reference: '2022/4', lastReviewed: '2026-05-05' },
    });
  }

  // Div 6E streaming guards.
  if (!streamingApplies) {
    if (hasStreamingAllocation && !resolutionValid) {
      uncomputed.push({
        id: 'UC-DIV-6E-STREAMING-INVALID-RESOLUTION',
        rationale:
          'Beneficiaries have streaming allocations but `streamingResolutionAt` is missing or outside the FY. Per s207-58 + s115-228 the trustee resolution must be in writing on or before 30 June. Streaming ignored; character flows pro-rata. Pass a valid `streamingResolutionAt` to activate Div 6E.',
        citation: { kind: 'ITAA_1997', reference: 's207-58', lastReviewed: '2026-05-05' },
      });
    } else {
      uncomputed.push({
        id: 'UC-DIV-6E-STREAMING',
        rationale:
          'No Div 6E streaming requested for this distribution — character (franked dividends, capital gains) flows pro-rata to net-income share. Pass `characterPools` + per-beneficiary `streaming` + `streamingResolutionAt` to activate explicit streaming under Div 6E.',
        citation: { kind: 'ITAA_1997', reference: 'Div 6E', lastReviewed: '2026-05-05' },
      });
    }
  }

  if (beneficiariesDec.some((b) => b.isNonResidentOrDisabled)) {
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
    s100aClassification,
    citations,
    uncomputed,
  };
}
