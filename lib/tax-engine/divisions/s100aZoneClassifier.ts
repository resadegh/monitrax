/**
 * Phase 41e.5 — s100A reimbursement-agreement zone classifier.
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 — turns
 * the always-on `UC-S100A-RISK` flag from 41e.1 slice C into a real
 * white/green/blue/red zone classification per ATO PCG 2022/2.
 *
 * AU primary authority:
 *   - ITAA 1936 s100A — reimbursement-agreement anti-avoidance
 *   - TR 2022/4 — Commissioner's view on s100A reimbursement agreements
 *   - PCG 2022/2 — zone framework (white / green / blue / red)
 *
 * Zones (PCG 2022/2):
 *   - WHITE — historic arrangements; not within s100A's scope.
 *   - GREEN — low-risk facts (e.g. genuine ordinary family/commercial
 *     dealing, beneficiary materially benefits).
 *   - BLUE — neither obviously low- nor high-risk. Default. Review
 *     warranted but no commissioner action expected on facts alone.
 *   - RED — high-risk features common in reimbursement schemes
 *     (presently-entitled adult beneficiary doesn't receive funds;
 *     UPE used by trustee or another adult; circular flows).
 *
 * v1 is **deliberately conservative**: it classifies WHITE / GREEN /
 * RED only when the input data carries strong signals. Everything
 * else falls into BLUE — review-warranted-but-not-flagged. This
 * matches the "never false numbers, never false silence" pattern —
 * the calc only emits a strong-zone classification when the evidence
 * supports it.
 *
 * Pure functions; no DB. Composed by `entityTaxRouter` for
 * DISCRETIONARY_TRUST entities.
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';

export type S100AZone = 'WHITE' | 'GREEN' | 'BLUE' | 'RED';

export interface S100ABeneficiaryFacts {
  /** Stable id matching the trust beneficiary. */
  beneficiaryId: string;
  /** Display name for boundary footer rendering. */
  beneficiaryName: string;
  /** Distributed amount (post-allocation). */
  amount: number;
  /**
   * Beneficiary's relationship to the trust controller(s):
   *   - 'CONTROLLER' — themselves a trustee / appointor / settlor
   *   - 'IMMEDIATE_FAMILY' — spouse, parent, child of controller
   *   - 'EXTENDED_FAMILY' — sibling, cousin, etc. of controller
   *   - 'UNRELATED' — non-family
   * Used to refine the WHITE/GREEN/RED dispatch.
   */
  relationshipToController?:
    | 'CONTROLLER'
    | 'IMMEDIATE_FAMILY'
    | 'EXTENDED_FAMILY'
    | 'UNRELATED';
  /**
   * `true` if beneficiary is a minor (< 18 at distribution date).
   * Minor beneficiaries with adult-rate amounts are a common s100A
   * red-flag (the trustee distributes to a tax-free-threshold child,
   * but the funds are used by the controller).
   */
  isMinor?: boolean;
  /**
   * `true` if the beneficiary actually received the funds (cash, bank
   * transfer, application to their education, etc.). When `false`,
   * combined with `unpaidPresentEntitlement`, the distribution is a
   * RED zone candidate.
   */
  beneficiaryReceivedFunds?: boolean;
  /**
   * `true` if there's a recorded UPE (unpaid present entitlement) at
   * year-end — the beneficiary is entitled but the trust hasn't paid.
   * Triggers Div 7A risk on its own; combined with funds-not-received
   * and use-by-controller, becomes RED zone.
   */
  unpaidPresentEntitlement?: boolean;
  /**
   * `true` if funds (or an asset purchased with them) are used by the
   * trustee / controller / another adult beneficiary instead of the
   * named beneficiary. Strongest RED signal in PCG 2022/2.
   */
  fundsUsedByOther?: boolean;
}

export interface S100AInput {
  /** Per-beneficiary facts. */
  beneficiaries: S100ABeneficiaryFacts[];
  /** Trust has a Family Trust Election (Sch 2F ITAA 1936). */
  hasFamilyTrustElection?: boolean;
  /** Trust is a testamentary trust (deceased-estate route). */
  isTestamentaryTrust?: boolean;
}

export interface S100ABeneficiaryClassification {
  beneficiaryId: string;
  beneficiaryName: string;
  zone: S100AZone;
  /** Plain-English reasoning for the zone — surfaced in AFSL footer. */
  reason: string;
  /** Specific PCG 2022/2 ¶ refs that drove the classification. */
  pcgReferences: string[];
  /** When BLUE/RED, recommend review with a tax agent. */
  requiresAgentReview: boolean;
}

export interface S100AClassificationResult {
  /** Per-beneficiary classifications. */
  classifications: S100ABeneficiaryClassification[];
  /**
   * Highest-risk zone across all beneficiaries. Order:
   * RED > BLUE > GREEN > WHITE. Useful for headline rendering.
   */
  highestZone: S100AZone;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

const ZONE_RANK: Record<S100AZone, number> = {
  WHITE: 0,
  GREEN: 1,
  BLUE: 2,
  RED: 3,
};

const BASE_CITATIONS: AuthorityCitation[] = [
  { kind: 'ITAA_1936', reference: 's100A', lastReviewed: '2026-05-05' },
  { kind: 'TR', reference: '2022/4', lastReviewed: '2026-05-05' },
  { kind: 'PCG', reference: '2022/2', lastReviewed: '2026-05-05' },
];

/**
 * Classify a single beneficiary's distribution into a PCG 2022/2 zone.
 *
 * Decision priority (highest → lowest):
 *   1. RED if `unpaidPresentEntitlement && (fundsUsedByOther || beneficiaryReceivedFunds === false)`
 *   2. RED if `fundsUsedByOther === true`
 *   3. RED if `isMinor && fundsUsedByOther`
 *   4. WHITE if `isTestamentaryTrust` (always — deceased-estate route)
 *   5. GREEN if FTE + immediate-family + beneficiaryReceivedFunds === true
 *   6. BLUE — default for everything else
 *
 * The "WHITE for testamentary" rule is conservative: testamentary
 * trusts are explicitly mentioned in PCG 2022/2 ¶13 as outside s100A
 * scope. Other WHITE cases (pre-1979 arrangements etc.) are vanishingly
 * rare for our user base and stay BLUE rather than misclassified.
 */
function classifyBeneficiary(
  facts: S100ABeneficiaryFacts,
  options: {
    hasFamilyTrustElection: boolean;
    isTestamentaryTrust: boolean;
  },
): S100ABeneficiaryClassification {
  const { hasFamilyTrustElection, isTestamentaryTrust } = options;
  const refs: string[] = [];

  // RED-zone signals (priority 1) — strong evidence of reimbursement scheme.
  if (
    facts.unpaidPresentEntitlement &&
    (facts.fundsUsedByOther || facts.beneficiaryReceivedFunds === false)
  ) {
    refs.push('PCG 2022/2 ¶22-25 (red zone)');
    return {
      beneficiaryId: facts.beneficiaryId,
      beneficiaryName: facts.beneficiaryName,
      zone: 'RED',
      reason:
        "Unpaid present entitlement combined with funds NOT received by beneficiary or used by another adult — a feature of arrangements PCG 2022/2 classifies as red zone. Engage a registered tax agent before lodgement.",
      pcgReferences: refs,
      requiresAgentReview: true,
    };
  }

  // RED-zone signal (priority 2) — funds used by trustee/controller directly.
  if (facts.fundsUsedByOther === true) {
    refs.push('PCG 2022/2 ¶22-25 (red zone)');
    return {
      beneficiaryId: facts.beneficiaryId,
      beneficiaryName: facts.beneficiaryName,
      zone: 'RED',
      reason:
        "Distribution funds used by trustee/controller/another adult instead of the named beneficiary — PCG 2022/2 red-zone feature. Engage a registered tax agent.",
      pcgReferences: refs,
      requiresAgentReview: true,
    };
  }

  // RED-zone signal (priority 3) — minor with funds-used-by-other.
  if (facts.isMinor && facts.fundsUsedByOther) {
    refs.push('PCG 2022/2 ¶25 (red zone — minor + diverted funds)');
    return {
      beneficiaryId: facts.beneficiaryId,
      beneficiaryName: facts.beneficiaryName,
      zone: 'RED',
      reason:
        'Minor beneficiary with funds used by another adult — common s100A pattern (kiddie-tax avoidance with diverted economic benefit).',
      pcgReferences: refs,
      requiresAgentReview: true,
    };
  }

  // WHITE — testamentary trusts / deceased-estate routes.
  if (isTestamentaryTrust) {
    refs.push('PCG 2022/2 ¶13 (white zone — testamentary)');
    return {
      beneficiaryId: facts.beneficiaryId,
      beneficiaryName: facts.beneficiaryName,
      zone: 'WHITE',
      reason:
        'Testamentary trust / deceased-estate distribution — explicitly outside s100A scope per PCG 2022/2 ¶13.',
      pcgReferences: refs,
      requiresAgentReview: false,
    };
  }

  // GREEN — FTE + immediate-family + beneficiary materially benefits.
  if (
    hasFamilyTrustElection &&
    (facts.relationshipToController === 'IMMEDIATE_FAMILY' ||
      facts.relationshipToController === 'CONTROLLER') &&
    facts.beneficiaryReceivedFunds === true &&
    !facts.unpaidPresentEntitlement
  ) {
    refs.push('PCG 2022/2 ¶17-19 (green zone — ordinary family dealing)');
    return {
      beneficiaryId: facts.beneficiaryId,
      beneficiaryName: facts.beneficiaryName,
      zone: 'GREEN',
      reason:
        'FTE family-group distribution to immediate family with funds materially received — ordinary family dealing per PCG 2022/2 green zone.',
      pcgReferences: refs,
      requiresAgentReview: false,
    };
  }

  // BLUE — default.
  refs.push('PCG 2022/2 ¶20-21 (blue zone — review recommended)');
  return {
    beneficiaryId: facts.beneficiaryId,
    beneficiaryName: facts.beneficiaryName,
    zone: 'BLUE',
    reason:
      'Distribution facts do not match strong WHITE/GREEN/RED signals — PCG 2022/2 blue zone. Standard review with a registered tax agent recommended.',
    pcgReferences: refs,
    requiresAgentReview: true,
  };
}

/**
 * Classify a trust's distributions across all beneficiaries.
 */
export function classifyS100AZones(
  input: S100AInput,
): S100AClassificationResult {
  const options = {
    hasFamilyTrustElection: !!input.hasFamilyTrustElection,
    isTestamentaryTrust: !!input.isTestamentaryTrust,
  };

  const classifications = input.beneficiaries.map((b) =>
    classifyBeneficiary(b, options),
  );

  // Highest-risk zone across the trust.
  const highestZone: S100AZone = classifications.reduce<S100AZone>((acc, c) => {
    return ZONE_RANK[c.zone] > ZONE_RANK[acc] ? c.zone : acc;
  }, 'WHITE');

  const uncomputed: UncomputedFlag[] = [];

  // Surface UC-S100A-NUANCED when classifier hits BLUE — the v1
  // classifier is conservative, and BLUE means "we don't know enough
  // to confidently classify". Replaces the always-on UC-S100A-RISK
  // from 41e.1 slice C with a more specific call-to-action.
  if (
    classifications.some((c) => c.zone === 'BLUE') ||
    classifications.some((c) => c.zone === 'RED')
  ) {
    uncomputed.push({
      id: 'UC-S100A-NUANCED',
      rationale:
        'One or more beneficiary distributions classified as BLUE or RED zone under PCG 2022/2. The v1 classifier evaluates the strongest signals (funds-not-received, used-by-other, UPE patterns); nuanced cases such as the "ordinary family or commercial dealing" carve-out require facts the user must volunteer to a registered tax agent. Highest zone shown is the headline; per-beneficiary detail is in `classifications[]`.',
      citation: { kind: 'PCG', reference: '2022/2 ¶20', lastReviewed: '2026-05-05' },
    });
  }

  return {
    classifications,
    highestZone,
    citations: BASE_CITATIONS,
    uncomputed,
  };
}
