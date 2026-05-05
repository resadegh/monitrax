/**
 * Phase 41e.11 — SMSF triumvirate compliance classifier.
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 +
 * `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §5.5 #5.
 *
 * Three intertwined SMSF compliance regimes:
 *
 *   1. **Sole purpose test** (SIS Act s62) — fund must be maintained
 *      solely for retirement-benefit purposes. Failing → fund non-
 *      complying → loses 15% concessional rate, taxed at 45% on
 *      everything.
 *   2. **In-house asset 5% cap** (SIS Act Pt 8, ss70-85) — value of
 *      "in-house assets" (loans / investments / leases involving
 *      related parties) cannot exceed 5% of total fund market value
 *      at end of FY. Breach triggers a written plan to dispose.
 *   3. **LRBA — Limited Recourse Borrowing Arrangement** (s67A) —
 *      SMSFs can only borrow under strict bare-trust + non-recourse
 *      rules per PCG 2016/5. Plus the **BRP (Business Real Property)
 *      exception** to the in-house asset rule (s71(1)(b)) lets SMSF
 *      acquire BRP from related party. Plus **NALI at 45%** per
 *      s295-550 if income/expenses are non-arm's-length.
 *
 * v1: classifies a single SMSF's compliance state across these three
 * regimes given caller-asserted facts. Returns per-regime status +
 * citations + UNCOMPUTED for nuanced cases.
 *
 * Pure functions; no DB. Pairs with 41e.2 (SMSF caps) + 41e.3 (Div 293/296).
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';

/** Top marginal rate applied to non-complying SMSFs (s295-160). */
export const NON_COMPLYING_SMSF_RATE = 0.45;

/** NALI rate per s295-550 — 45% on non-arm's-length income. */
export const NALI_RATE = 0.45;

/** In-house asset cap — 5% of fund value at FY-end (Pt 8 SIS). */
export const IN_HOUSE_ASSET_CAP = 0.05;

export interface InHouseAsset {
  /** Asset id for breakdown. */
  assetId: string;
  /** Display label. */
  label?: string;
  /** Market value at FY-end. */
  marketValue: number;
  /**
   * `true` if asset qualifies for the BRP exception (s71(1)(b)) —
   * Business Real Property used wholly + exclusively in business at
   * acquisition. BRP is excluded from the 5% cap.
   */
  isBrpException?: boolean;
}

export interface LrbaArrangement {
  /** Loan id for breakdown. */
  loanId: string;
  /** Loan amount currently outstanding. */
  outstandingBalance: number;
  /**
   * `true` if loan is held under a bare trust per s67A (the
   * "single acquirable asset" requirement).
   */
  hasBareTrust: boolean;
  /** `true` if loan terms are non-recourse to other fund assets. */
  isNonRecourse: boolean;
  /**
   * `true` if loan terms are at arm's-length (commercial rate +
   * commercial term). When `false`, NALI applies to the asset's
   * income per PCG 2016/5 + s295-550.
   */
  isArmsLength: boolean;
  /**
   * `true` if loan was used to acquire a single acquirable asset.
   * Multiple assets per LRBA → breach unless explicitly permitted
   * (e.g. shares in a single company).
   */
  isSingleAcquirableAsset: boolean;
}

export interface SmsfTriumvirateInput {
  /** Total fund market value at FY-end (denominator for in-house cap). */
  totalFundValue: number;
  /** In-house assets at FY-end (loans / investments / leases to related parties). */
  inHouseAssets?: InHouseAsset[];
  /** LRBA arrangements held by the SMSF. */
  lrbaArrangements?: LrbaArrangement[];
  /**
   * `true` if fund is being maintained solely for retirement-benefit
   * purposes per s62 SIS Act. Caller asserts (the test is fact-
   * dependent — early-access schemes, member-use of fund assets, etc.).
   */
  meetsSolePurposeTest: boolean;
  /**
   * Income earned during the FY. NALI rate applies if income is
   * non-arm's-length (e.g. distributions from a related-party trust
   * at higher than arm's-length rates).
   */
  fyIncome: number;
  /**
   * `true` if any income or expense during the FY was non-arm's-length
   * per s295-550 (e.g. limited recourse on related-party LRBA, or
   * non-commercial rent from member). When `true`, NALI applies.
   */
  hasNonArmsLengthIncome: boolean;
}

export type SoleStatus = 'PASS' | 'FAIL';
export type InHouseStatus = 'COMPLIANT' | 'BREACH' | 'NO_IN_HOUSE_ASSETS';
export type LrbaStatus = 'COMPLIANT' | 'BREACH_BARE_TRUST' | 'BREACH_RECOURSE' | 'BREACH_MULTI_ASSET' | 'NALI_RISK' | 'NO_LRBA';

export interface SmsfTriumvirateResult {
  /** Sole purpose test outcome. */
  solePurpose: { status: SoleStatus; reason: string };
  /** In-house asset cap outcome. */
  inHouseAsset: {
    status: InHouseStatus;
    inHouseValue: number;
    fundValue: number;
    capValue: number;
    breachAmount: number;
    breachPercentage: number;
    reason: string;
  };
  /** LRBA compliance per loan. */
  lrba: {
    status: LrbaStatus;
    perLoan: Array<{
      loanId: string;
      status: LrbaStatus;
      reason: string;
    }>;
  };
  /** NALI tax (separate from main fund income). */
  naliTax: number;
  /**
   * Effective income tax rate applied to fund income. 15% if
   * complying + sole-purpose, 45% if non-complying.
   */
  applicableIncomeRate: number;
  /** Has any breach across any regime? */
  anyBreach: boolean;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

const BASE_CITATIONS: AuthorityCitation[] = [
  { kind: 'SIS_ACT', reference: 's62 (sole purpose)', lastReviewed: '2026-05-05' },
  { kind: 'SIS_ACT', reference: 'Pt 8 (in-house asset)', lastReviewed: '2026-05-05' },
  { kind: 'SIS_ACT', reference: 's67A (LRBA)', lastReviewed: '2026-05-05' },
  { kind: 'PCG', reference: '2016/5 (LRBA safe harbour)', lastReviewed: '2026-05-05' },
];

/**
 * Run the SMSF triumvirate compliance check.
 */
export function classifySmsfTriumvirate(
  input: SmsfTriumvirateInput,
): SmsfTriumvirateResult {
  const {
    totalFundValue,
    inHouseAssets = [],
    lrbaArrangements = [],
    meetsSolePurposeTest,
    fyIncome,
    hasNonArmsLengthIncome,
  } = input;

  const citations = [...BASE_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];

  // -- Sole purpose test --------------------------------------------
  const soleStatus: SoleStatus = meetsSolePurposeTest ? 'PASS' : 'FAIL';
  const soleReason = meetsSolePurposeTest
    ? 'Fund maintained solely for retirement-benefit purposes per s62 SIS Act.'
    : 'Sole purpose test FAILED — fund maintained for purposes other than retirement (e.g. early access, member use of fund assets). Fund risks non-complying status — taxed at 45% on all income (s295-160).';

  // -- In-house asset cap (Pt 8 SIS) --------------------------------
  // Excludes BRP-exception assets (s71(1)(b)).
  const inHouseValue = inHouseAssets.reduce(
    (sum, a) => (a.isBrpException ? sum : sum + a.marketValue),
    0,
  );
  const capValue = totalFundValue * IN_HOUSE_ASSET_CAP;
  const inHousePercentage =
    totalFundValue > 0 ? inHouseValue / totalFundValue : 0;
  const inHouseBreach = inHouseValue > capValue;
  const inHouseStatus: InHouseStatus =
    inHouseAssets.length === 0
      ? 'NO_IN_HOUSE_ASSETS'
      : inHouseBreach
      ? 'BREACH'
      : 'COMPLIANT';
  const inHouseReason =
    inHouseStatus === 'NO_IN_HOUSE_ASSETS'
      ? 'No in-house assets reported.'
      : inHouseBreach
      ? `In-house assets ($${Math.round(inHouseValue).toLocaleString()}) exceed 5% cap ($${Math.round(capValue).toLocaleString()}) — ${(inHousePercentage * 100).toFixed(2)}% of fund. Trustee must prepare a written plan to dispose of the excess (Pt 8 SIS).`
      : `In-house assets ($${Math.round(inHouseValue).toLocaleString()}) within 5% cap ($${Math.round(capValue).toLocaleString()}) — ${(inHousePercentage * 100).toFixed(2)}% of fund.`;

  if (inHouseAssets.some((a) => a.isBrpException)) {
    citations.push({
      kind: 'SIS_ACT',
      reference: 's71(1)(b) (BRP exception)',
      lastReviewed: '2026-05-05',
    });
  }

  // -- LRBA compliance per loan ------------------------------------
  const perLoan = lrbaArrangements.map((l) => {
    if (!l.isSingleAcquirableAsset) {
      return {
        loanId: l.loanId,
        status: 'BREACH_MULTI_ASSET' as LrbaStatus,
        reason:
          'LRBA must be used to acquire a single acquirable asset (s67A SIS). Multiple-asset LRBAs are non-compliant.',
      };
    }
    if (!l.hasBareTrust) {
      return {
        loanId: l.loanId,
        status: 'BREACH_BARE_TRUST' as LrbaStatus,
        reason:
          'LRBA must hold the asset via a bare trust per s67A. Direct SMSF ownership while loan is outstanding is non-compliant.',
      };
    }
    if (!l.isNonRecourse) {
      return {
        loanId: l.loanId,
        status: 'BREACH_RECOURSE' as LrbaStatus,
        reason:
          'LRBA must be non-recourse to other fund assets per s67A. Recourse beyond the acquired asset is non-compliant.',
      };
    }
    if (!l.isArmsLength) {
      return {
        loanId: l.loanId,
        status: 'NALI_RISK' as LrbaStatus,
        reason:
          'LRBA terms NOT at arm\'s-length (e.g. below-market rate, deferred interest, or related-party lender on non-commercial terms). NALI per s295-550 applies to ALL income from the asset — taxed at 45%.',
      };
    }
    return {
      loanId: l.loanId,
      status: 'COMPLIANT' as LrbaStatus,
      reason: 'LRBA satisfies s67A — bare trust, non-recourse, single acquirable asset, arm\'s-length terms.',
    };
  });

  const lrbaStatus: LrbaStatus =
    perLoan.length === 0
      ? 'NO_LRBA'
      : perLoan.find((l) => l.status !== 'COMPLIANT')?.status ?? 'COMPLIANT';

  // -- NALI tax ----------------------------------------------------
  // NALI applies to non-arm's-length income at 45%. The base 15%
  // (or 0% if pension) is replaced — NALI rate is the WHOLE rate,
  // not additive.
  const naliApplies =
    hasNonArmsLengthIncome ||
    perLoan.some((l) => l.status === 'NALI_RISK');
  const naliTax = naliApplies ? Math.max(0, fyIncome) * NALI_RATE : 0;

  if (naliApplies) {
    citations.push({
      kind: 'ITAA_1997',
      reference: 's295-550 (NALI)',
      lastReviewed: '2026-05-05',
    });
  }

  // -- Applicable income rate --------------------------------------
  // Non-complying (sole-purpose fail) → 45%.
  // Otherwise complying → 15% (caller may apply 0% if pension phase
  // — that's a future sub-PR feature).
  const applicableIncomeRate = meetsSolePurposeTest
    ? 0.15
    : NON_COMPLYING_SMSF_RATE;

  if (!meetsSolePurposeTest) {
    citations.push({
      kind: 'ITAA_1997',
      reference: 's295-160 (non-complying)',
      lastReviewed: '2026-05-05',
    });
    uncomputed.push({
      id: 'UC-SMSF-NON-COMPLYING',
      rationale:
        'Sole purpose test failed — fund risks non-complying status. ATO disqualification is procedural; the calc here applies 45% to fund income reflecting the worst-case rate. Engage an SMSF auditor + registered tax agent immediately.',
      citation: { kind: 'SIS_ACT', reference: 's62', lastReviewed: '2026-05-05' },
    });
  }

  if (inHouseBreach) {
    uncomputed.push({
      id: 'UC-SMSF-IN-HOUSE-BREACH',
      rationale: `In-house asset cap breached. Trustee must prepare a written plan to dispose of the excess by year-end. v1 reports the breach amount; the disposal-plan template + procedural compliance lands in a future sub-PR.`,
      citation: { kind: 'SIS_ACT', reference: 'Pt 8 SIS', lastReviewed: '2026-05-05' },
    });
  }

  if (perLoan.some((l) => l.status !== 'COMPLIANT' && l.status !== 'NALI_RISK')) {
    uncomputed.push({
      id: 'UC-SMSF-LRBA-BREACH',
      rationale:
        'One or more LRBA arrangements breach s67A SIS structural requirements (bare trust / non-recourse / single acquirable asset). Engage SMSF auditor immediately — breach exposure can be severe and may require unwinding.',
      citation: { kind: 'SIS_ACT', reference: 's67A', lastReviewed: '2026-05-05' },
    });
  }

  if (naliApplies) {
    uncomputed.push({
      id: 'UC-SMSF-NALI',
      rationale:
        'Non-arm\'s-length income detected — taxed at 45% per s295-550. Common triggers: related-party rent below market, related-party LRBA on non-commercial terms, distributions from related-party trust on non-arm\'s-length basis. v1 reports the NALI tax; the income-attribution detail (which transactions trigger NALI) lands in a future sub-PR.',
      citation: { kind: 'ITAA_1997', reference: 's295-550', lastReviewed: '2026-05-05' },
    });
  }

  const anyBreach =
    soleStatus === 'FAIL' ||
    inHouseStatus === 'BREACH' ||
    (lrbaStatus !== 'COMPLIANT' && lrbaStatus !== 'NO_LRBA') ||
    naliApplies;

  return {
    solePurpose: { status: soleStatus, reason: soleReason },
    inHouseAsset: {
      status: inHouseStatus,
      inHouseValue,
      fundValue: totalFundValue,
      capValue,
      breachAmount: Math.max(0, inHouseValue - capValue),
      breachPercentage: inHousePercentage,
      reason: inHouseReason,
    },
    lrba: {
      status: lrbaStatus,
      perLoan,
    },
    naliTax,
    applicableIncomeRate,
    anyBreach,
    citations,
    uncomputed,
  };
}
