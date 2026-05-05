/**
 * Phase 41e.10 — Family Trust Election (FTE) + Interposed Entity
 * Election (IEE) + 46.5% TFN withholding on non-quoting beneficiaries.
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.
 *
 * AU primary authority:
 *   - ITAA 1936 Sch 2F — Family Trust + Interposed Entity Elections
 *   - Sch 2F s272-75 — Family Trust Election (declares the family group;
 *     locks the trust to distribute only within the family group)
 *   - Sch 2F s272-85 — Interposed Entity Election (extends the family
 *     group to include an interposed entity for distribution purposes)
 *   - Sch 2F s272-95 — Family group definition (test individual + their
 *     family members + entities the test individual / family controls)
 *   - ITAA 1936 s100A + Sch 2F operate together — FTE is one of the
 *     ways a trust qualifies as low s100A risk per PCG 2022/2 (41e.5)
 *   - Family Trust Distribution Tax (FTDT) — 47% (was 46.5%, indexed) on
 *     distributions OUTSIDE the family group from an FTE-electing trust
 *   - TFN withholding — 47% on trust distributions where beneficiary
 *     hasn't quoted a TFN (Sch 2F + ITAA 1936 s202D / Pt VA)
 *
 * **Family group definition (Sch 2F s272-95):**
 *   The "family" of the test individual = test individual + their:
 *     - spouse / former spouse
 *     - parent, grandparent
 *     - brother, sister
 *     - nephew, niece
 *     - lineal descendant of any of the above (children, grandchildren)
 *     - spouse of any of the above
 *
 *   Plus entities the test individual / family controls (companies,
 *   trusts, partnerships) — control here is the >50% ownership /
 *   distribution-power test.
 *
 * **Operative effects:**
 *   - Distribution INSIDE the family group → normal trust assessment
 *   - Distribution OUTSIDE the family group → Family Trust Distribution
 *     Tax (FTDT) at 47% to the trustee
 *   - Beneficiary not quoting TFN → 47% TFN withholding by trustee
 *
 * v1: classifies a single distribution as INSIDE / OUTSIDE / TFN-WITHHELD
 * and computes the FTDT or withholding amount. Caller passes:
 *   - Whether the trust has an FTE in force
 *   - The beneficiary's relationship to the test individual
 *   - Whether the beneficiary has quoted a TFN
 *
 * Pure functions; no DB. Pairs with `trustDistribution` (41e.1 C +
 * 41e.5 s100A).
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';

/**
 * 47% FTDT rate (Sch 2F s271-15). Indexed to top marginal rate +
 * Medicare. Caller can override per-FY if a future change happens.
 */
export const FAMILY_TRUST_DISTRIBUTION_TAX_RATE = 0.47;

/**
 * 47% TFN withholding on non-quoting beneficiaries (ITAA 1936 Pt VA).
 */
export const TFN_WITHHOLDING_RATE = 0.47;

export type FamilyGroupRelationship =
  /** Test individual themselves. */
  | 'TEST_INDIVIDUAL'
  /** Within Sch 2F s272-95 family — spouse / parent / sibling / lineal descendant / their spouses. */
  | 'FAMILY_MEMBER'
  /** Entity controlled by test individual or their family (>50% ownership or distribution power). */
  | 'CONTROLLED_ENTITY'
  /** Outside the family group entirely. */
  | 'OUTSIDE_FAMILY';

export interface FteIeeBeneficiaryInput {
  /** Stable id matching the trust beneficiary. */
  beneficiaryId: string;
  /** Display name. */
  beneficiaryName: string;
  /** Distributed amount (post-allocation). */
  distributionAmount: number;
  /** Relationship to the test individual under Sch 2F s272-95. */
  relationship: FamilyGroupRelationship;
  /**
   * `true` if beneficiary has quoted a valid TFN. When `false`, 47%
   * is withheld by the trustee per Pt VA ITAA 1936 (regardless of
   * whether they're inside the family group or not).
   */
  hasQuotedTfn: boolean;
  /**
   * `true` if beneficiary is also covered by an Interposed Entity
   * Election (IEE) extending the family group to them. Used when
   * `relationship === 'OUTSIDE_FAMILY'` would otherwise apply but
   * the IEE has been validly made.
   */
  coveredByIee?: boolean;
}

export interface FteIeeInput {
  /**
   * `true` if the trust has a Family Trust Election in force for
   * the FY of the distribution. When `false`, this module is not
   * relevant — caller should NOT have invoked it.
   */
  hasFamilyTrustElection: boolean;
  /** Per-beneficiary distribution facts. */
  beneficiaries: FteIeeBeneficiaryInput[];
  /**
   * Override for FTDT rate (Sch 2F s271-15). Defaults to 47%. v1
   * passes through; caller computes per-FY rate from FY config.
   */
  ftdtRate?: number;
}

export type FteIeeOutcome =
  /** In family group — normal trust assessment, no extra tax. */
  | 'INSIDE_FAMILY'
  /** Covered by IEE — treated as inside family group. */
  | 'INSIDE_VIA_IEE'
  /** Outside family group → FTDT 47% on distribution. */
  | 'OUTSIDE_FAMILY_FTDT'
  /** TFN not quoted → 47% withholding regardless of relationship. */
  | 'TFN_WITHHOLDING';

export interface FteIeeBeneficiaryClassification {
  beneficiaryId: string;
  beneficiaryName: string;
  outcome: FteIeeOutcome;
  /** Distribution amount that flows to the beneficiary (gross). */
  grossDistribution: number;
  /**
   * Family Trust Distribution Tax payable by trustee on this
   * distribution (47% × grossDistribution when OUTSIDE_FAMILY_FTDT).
   * Trustee bears this — beneficiary still receives gross less
   * any TFN withholding.
   */
  ftdtPayableByTrustee: number;
  /**
   * TFN withholding deducted by trustee from beneficiary's
   * distribution (47% × grossDistribution when TFN_WITHHOLDING).
   * Beneficiary claims credit on their personal return.
   */
  tfnWithholdingDeducted: number;
  /** Net amount beneficiary actually receives. */
  netToBeneficiary: number;
  reason: string;
}

export interface FteIeeClassificationResult {
  classifications: FteIeeBeneficiaryClassification[];
  totalFtdtPayable: number;
  totalTfnWithholding: number;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

const BASE_CITATIONS: AuthorityCitation[] = [
  { kind: 'ITAA_1936', reference: 'Sch 2F', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1936', reference: 's272-75 (FTE)', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1936', reference: 's272-95 (family group)', lastReviewed: '2026-05-05' },
];

/**
 * Classify FTE/IEE distributions for a trust with an FTE in force.
 * Computes FTDT + TFN withholding per beneficiary and aggregates.
 */
export function classifyFteIeeDistributions(
  input: FteIeeInput,
): FteIeeClassificationResult {
  const { hasFamilyTrustElection, beneficiaries, ftdtRate = FAMILY_TRUST_DISTRIBUTION_TAX_RATE } =
    input;

  const citations = [...BASE_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];

  if (!hasFamilyTrustElection) {
    // Caller should not have invoked this module — surface a warning.
    return {
      classifications: beneficiaries.map((b) => ({
        beneficiaryId: b.beneficiaryId,
        beneficiaryName: b.beneficiaryName,
        outcome: 'INSIDE_FAMILY' as FteIeeOutcome, // FTE not in force — no FTDT
        grossDistribution: b.distributionAmount,
        ftdtPayableByTrustee: 0,
        tfnWithholdingDeducted: b.hasQuotedTfn ? 0 : b.distributionAmount * TFN_WITHHOLDING_RATE,
        netToBeneficiary: b.hasQuotedTfn
          ? b.distributionAmount
          : b.distributionAmount * (1 - TFN_WITHHOLDING_RATE),
        reason: 'No FTE in force — FTE/IEE rules N/A. TFN withholding applies if beneficiary did not quote TFN.',
      })),
      totalFtdtPayable: 0,
      totalTfnWithholding: beneficiaries.reduce(
        (sum, b) =>
          sum + (b.hasQuotedTfn ? 0 : b.distributionAmount * TFN_WITHHOLDING_RATE),
        0,
      ),
      citations: [
        { kind: 'ITAA_1936', reference: 'Pt VA (TFN withholding)', lastReviewed: '2026-05-05' },
      ],
      uncomputed,
    };
  }

  let anyOutsideFamily = false;
  let anyTfnWithheld = false;

  const classifications: FteIeeBeneficiaryClassification[] = beneficiaries.map(
    (b) => {
      const gross = b.distributionAmount;

      // TFN withholding applies first — regardless of family-group status.
      // (TFN-withheld beneficiary inside family still has 47% withheld;
      // they claim credit on their return — no FTDT applies because
      // they're in family group.)
      if (!b.hasQuotedTfn) {
        anyTfnWithheld = true;
        return {
          beneficiaryId: b.beneficiaryId,
          beneficiaryName: b.beneficiaryName,
          outcome: 'TFN_WITHHOLDING',
          grossDistribution: gross,
          ftdtPayableByTrustee: 0,
          tfnWithholdingDeducted: gross * TFN_WITHHOLDING_RATE,
          netToBeneficiary: gross * (1 - TFN_WITHHOLDING_RATE),
          reason: `Beneficiary has not quoted TFN — 47% withheld by trustee per ITAA 1936 Pt VA. Beneficiary claims the withholding as a credit on their personal return.`,
        };
      }

      // Inside family group — normal assessment.
      if (
        b.relationship === 'TEST_INDIVIDUAL' ||
        b.relationship === 'FAMILY_MEMBER' ||
        b.relationship === 'CONTROLLED_ENTITY'
      ) {
        return {
          beneficiaryId: b.beneficiaryId,
          beneficiaryName: b.beneficiaryName,
          outcome: 'INSIDE_FAMILY',
          grossDistribution: gross,
          ftdtPayableByTrustee: 0,
          tfnWithholdingDeducted: 0,
          netToBeneficiary: gross,
          reason: `Distribution to ${b.relationship.toLowerCase().replace('_', ' ')} — inside Sch 2F family group. Normal trust assessment.`,
        };
      }

      // Outside family — but covered by IEE?
      if (b.coveredByIee) {
        citations.push({
          kind: 'ITAA_1936',
          reference: 's272-85 (IEE)',
          lastReviewed: '2026-05-05',
        });
        return {
          beneficiaryId: b.beneficiaryId,
          beneficiaryName: b.beneficiaryName,
          outcome: 'INSIDE_VIA_IEE',
          grossDistribution: gross,
          ftdtPayableByTrustee: 0,
          tfnWithholdingDeducted: 0,
          netToBeneficiary: gross,
          reason: `Distribution to outside-family entity covered by Interposed Entity Election (s272-85). Treated as inside family group.`,
        };
      }

      // OUTSIDE_FAMILY — FTDT applies.
      anyOutsideFamily = true;
      return {
        beneficiaryId: b.beneficiaryId,
        beneficiaryName: b.beneficiaryName,
        outcome: 'OUTSIDE_FAMILY_FTDT',
        grossDistribution: gross,
        ftdtPayableByTrustee: gross * ftdtRate,
        tfnWithholdingDeducted: 0,
        netToBeneficiary: gross,
        reason: `Distribution OUTSIDE the Sch 2F family group — Family Trust Distribution Tax of ${(ftdtRate * 100).toFixed(0)}% (${(gross * ftdtRate).toLocaleString()}) payable by trustee per s271-15.`,
      };
    },
  );

  // Citations and UNCOMPUTED for the various paths
  if (anyOutsideFamily) {
    citations.push({
      kind: 'ITAA_1936',
      reference: 's271-15 (FTDT)',
      lastReviewed: '2026-05-05',
    });
    uncomputed.push({
      id: 'UC-FTDT-OUTSIDE-FAMILY',
      rationale:
        'Family Trust Distribution Tax of 47% applies to distributions outside the Sch 2F family group. Trustee is liable. v1 reports the FTDT amount; the FTDT return + payment timing (BAS / annual) is procedural and out of scope.',
      citation: { kind: 'ITAA_1936', reference: 's271-15', lastReviewed: '2026-05-05' },
    });
  }
  if (anyTfnWithheld) {
    citations.push({
      kind: 'ITAA_1936',
      reference: 'Pt VA (TFN withholding)',
      lastReviewed: '2026-05-05',
    });
  }

  // Family-control test is non-trivial — flag for nuanced cases.
  if (beneficiaries.some((b) => b.relationship === 'CONTROLLED_ENTITY')) {
    uncomputed.push({
      id: 'UC-FTE-CONTROL-TEST',
      rationale:
        'Sch 2F family-group "control" test (s272-95) is fact-dependent — requires >50% beneficial ownership OR distribution-power control of the entity by the test individual or their family. v1 trusts caller-asserted CONTROLLED_ENTITY classification; engage a registered tax agent to confirm control if unclear.',
      citation: { kind: 'ITAA_1936', reference: 's272-95', lastReviewed: '2026-05-05' },
    });
  }

  return {
    classifications,
    totalFtdtPayable: classifications.reduce(
      (sum, c) => sum + c.ftdtPayableByTrustee,
      0,
    ),
    totalTfnWithholding: classifications.reduce(
      (sum, c) => sum + c.tfnWithholdingDeducted,
      0,
    ),
    citations,
    uncomputed,
  };
}
