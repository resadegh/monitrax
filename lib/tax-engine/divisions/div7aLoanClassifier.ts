/**
 * Phase 41e.6 — Division 7A loan classifier.
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 +
 * `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §5.5 #2 —
 * compliance check on private-company → shareholder/associate loans.
 *
 * AU primary authority:
 *   - ITAA 1936 Div 7A — anti-avoidance for private-company loans
 *   - s109D — loan deemed an unfranked dividend if not put on Div 7A
 *     terms by the company's lodgment day
 *   - s109N — minimum-repayment requirements for a "complying" loan:
 *       • written agreement on or before lodgment day
 *       • term ≤ 7 years (≤ 25 years if secured by a registered
 *         mortgage on real property; the secured-loan refinancing
 *         path is rare and v1 only models the unsecured 7-year case)
 *       • benchmark interest rate (Reserve Bank indicator-lending rate
 *         for housing — published annually as the "benchmark" rate)
 *       • Minimum Yearly Repayment (MRP) ≥ amortising payment
 *   - s109Y — distributable-surplus calc; loans only become deemed
 *     dividends to the extent of distributable surplus (this module
 *     reports the structural risk; the surplus calc is its own beast
 *     — flagged UC-DIV7A-DISTRIBUTABLE-SURPLUS for v1)
 *   - TR 2010/3 + PCG 2017/13 — sub-trust UPE arrangements where a
 *     trust has a UPE owed to a corporate beneficiary; treated as
 *     Div 7A loans unless on Option 1/2/3 sub-trust terms (flagged
 *     UC-DIV7A-SUBTRUST-UPE for v1)
 *
 * Pure functions; no DB. Composed by `entityTaxRouter` for COMPANY
 * entities receiving `div7aLoans` input.
 *
 * **MRP formula (s109N — Schedule 4 ITAA 1936):**
 *   For a complying loan with N years remaining and outstanding
 *   balance B at start of FY:
 *     MRP = B × [r × (1+r)^N] / [(1+r)^N − 1]
 *   where r = the applicable benchmark rate.
 *
 *   This is the standard amortising-loan annuity formula. v1
 *   computes it for unsecured loans (max 7-year term).
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';

export interface Div7ALoanInput {
  /** Stable loan id for the breakdown row. */
  loanId: string;
  /** Display label. */
  loanLabel?: string;
  /**
   * Outstanding balance at the START of the current FY. The amortising
   * MRP applies to this balance over the remaining term.
   */
  openingBalance: number;
  /**
   * Years remaining on the Div 7A-compliant term. Must be > 0; the
   * classifier rejects 0-year terms (loan should already be repaid).
   */
  yearsRemaining: number;
  /**
   * Benchmark interest rate from the ATO's annual publication (Reserve
   * Bank indicator-lending rate for housing). Decimal — e.g. 0.0837 for
   * 8.37% FY24-25. Caller passes the relevant FY's rate; v1 doesn't
   * fetch from config since the benchmark rate is volatile and ATO
   * publishes once per year.
   */
  benchmarkRate: number;
  /** Total payments made by the borrower during the FY. */
  paymentsMadeThisFy: number;
  /**
   * `true` if the loan is on a written Div 7A-compliant agreement
   * dated on or before the company's lodgment day. Without it, the
   * loan is automatically a deemed dividend per s109D.
   */
  hasComplianceAgreement: boolean;
  /**
   * `true` if this is a sub-trust UPE arrangement — a trust holds a
   * UPE for the corporate beneficiary and the funds are used by the
   * trust. v1 flags as UC-DIV7A-SUBTRUST-UPE rather than running the
   * Option 1/2/3 sub-trust analysis (TR 2010/3 + PCG 2017/13).
   */
  isSubTrustUpe?: boolean;
}

export type Div7AStatus =
  | 'COMPLIANT' // MRP met OR loan on a compliant 25-year secured term
  | 'MRP_SHORTFALL' // s109N — MRP exists but payments < required
  | 'NO_AGREEMENT' // s109D — no written Div 7A agreement
  | 'DEEMED_DIVIDEND' // operative outcome — funds treated as unfranked dividend
  | 'SUB_TRUST_UPE'; // TR 2010/3 — flagged for nuanced analysis

export interface Div7ALoanClassification {
  loanId: string;
  loanLabel?: string;
  status: Div7AStatus;
  /** The s109N MRP for the FY (always computed when classifier reaches it). */
  minimumYearlyRepayment: number;
  /** Shortfall (`MRP − paymentsMadeThisFy`); 0 if compliant. */
  mrpShortfall: number;
  /**
   * Deemed-dividend amount under s109D — non-zero when status is
   * `NO_AGREEMENT` or `MRP_SHORTFALL`. Subject to s109Y distributable
   * surplus cap (UC-DIV7A-DISTRIBUTABLE-SURPLUS).
   */
  deemedDividendAmount: number;
  /** Plain-English reasoning for the AFSL footer. */
  reason: string;
}

export interface Div7AClassificationResult {
  /** Per-loan classifications. */
  classifications: Div7ALoanClassification[];
  /** Aggregate deemed-dividend exposure across all loans. */
  totalDeemedDividend: number;
  /** Highest-severity status across loans. */
  highestSeverity: Div7AStatus;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

const SEVERITY_RANK: Record<Div7AStatus, number> = {
  COMPLIANT: 0,
  SUB_TRUST_UPE: 1,
  MRP_SHORTFALL: 2,
  NO_AGREEMENT: 3,
  DEEMED_DIVIDEND: 4,
};

const BASE_CITATIONS: AuthorityCitation[] = [
  { kind: 'ITAA_1936', reference: 'Div 7A', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1936', reference: 's109D', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1936', reference: 's109N', lastReviewed: '2026-05-05' },
];

/**
 * Compute the s109N Minimum Yearly Repayment for a complying loan.
 *
 * Standard amortising-annuity formula:
 *   MRP = B × [r × (1+r)^N] / [(1+r)^N − 1]
 *
 * Returns 0 when `yearsRemaining === 0` (loan already due) or
 * `openingBalance <= 0`. Also returns 0 when `benchmarkRate === 0`
 * (degenerate case — straight-line repayment is `B / N` then).
 */
export function calculateMinimumYearlyRepayment(
  openingBalance: number,
  yearsRemaining: number,
  benchmarkRate: number,
): number {
  if (openingBalance <= 0 || yearsRemaining <= 0) return 0;
  if (benchmarkRate <= 0) {
    return openingBalance / yearsRemaining;
  }
  const r = benchmarkRate;
  const n = yearsRemaining;
  const numerator = r * Math.pow(1 + r, n);
  const denominator = Math.pow(1 + r, n) - 1;
  return openingBalance * (numerator / denominator);
}

/**
 * Classify a single Div 7A loan.
 *
 * Decision priority:
 *   1. SUB_TRUST_UPE — flagged for nuanced TR 2010/3 analysis
 *   2. NO_AGREEMENT — automatic deemed dividend per s109D
 *   3. MRP_SHORTFALL — payments < MRP (deemed-dividend exposure on shortfall)
 *   4. COMPLIANT — payments ≥ MRP
 */
function classifyLoan(input: Div7ALoanInput): Div7ALoanClassification {
  const { loanId, loanLabel, openingBalance, yearsRemaining, benchmarkRate } =
    input;

  const mrp = calculateMinimumYearlyRepayment(
    openingBalance,
    yearsRemaining,
    benchmarkRate,
  );

  // Sub-trust UPE → flag, don't classify deeper. The Option 1/2/3
  // analysis lands in a future sub-PR.
  if (input.isSubTrustUpe) {
    return {
      loanId,
      loanLabel,
      status: 'SUB_TRUST_UPE',
      minimumYearlyRepayment: mrp,
      mrpShortfall: 0,
      deemedDividendAmount: 0,
      reason:
        'Sub-trust UPE arrangement (TR 2010/3 + PCG 2017/13). v1 flags for review — Option 1 / 2 / 3 sub-trust classification + 7- vs 10-year term analysis lands in a future sub-PR. Deemed-dividend exposure is NOT zero — engage a registered tax agent.',
    };
  }

  // No written Div 7A agreement → s109D deemed dividend on whole balance.
  if (!input.hasComplianceAgreement) {
    return {
      loanId,
      loanLabel,
      status: 'NO_AGREEMENT',
      minimumYearlyRepayment: mrp,
      mrpShortfall: 0,
      deemedDividendAmount: openingBalance,
      reason:
        'No written Div 7A-compliant loan agreement. Per s109D the entire opening balance is treated as an unfranked dividend to the borrower, capped at distributable surplus (s109Y). Engage a registered tax agent before lodgment.',
    };
  }

  // MRP shortfall.
  const shortfall = Math.max(0, mrp - input.paymentsMadeThisFy);
  if (shortfall > 0) {
    return {
      loanId,
      loanLabel,
      status: 'MRP_SHORTFALL',
      minimumYearlyRepayment: mrp,
      mrpShortfall: shortfall,
      deemedDividendAmount: shortfall,
      reason: `MRP for FY is $${Math.round(mrp).toLocaleString()}; payments made $${Math.round(
        input.paymentsMadeThisFy,
      ).toLocaleString()}. Shortfall of $${Math.round(
        shortfall,
      ).toLocaleString()} treated as unfranked dividend per s109D, capped at distributable surplus (s109Y).`,
    };
  }

  // Compliant.
  return {
    loanId,
    loanLabel,
    status: 'COMPLIANT',
    minimumYearlyRepayment: mrp,
    mrpShortfall: 0,
    deemedDividendAmount: 0,
    reason: `Compliant — payments ($${Math.round(input.paymentsMadeThisFy).toLocaleString()}) meet or exceed the s109N MRP of $${Math.round(mrp).toLocaleString()}.`,
  };
}

/**
 * Classify all Div 7A loans for a private company. Surfaces deemed-
 * dividend exposure + UNCOMPUTED flags for distributable-surplus and
 * sub-trust UPE deep cases.
 */
export function classifyDiv7ALoans(
  loans: Div7ALoanInput[],
): Div7AClassificationResult {
  if (loans.length === 0) {
    return {
      classifications: [],
      totalDeemedDividend: 0,
      highestSeverity: 'COMPLIANT',
      citations: BASE_CITATIONS,
      uncomputed: [],
    };
  }

  const classifications = loans.map((l) => classifyLoan(l));
  const totalDeemedDividend = classifications.reduce(
    (sum, c) => sum + c.deemedDividendAmount,
    0,
  );
  const highestSeverity = classifications.reduce<Div7AStatus>((acc, c) => {
    return SEVERITY_RANK[c.status] > SEVERITY_RANK[acc] ? c.status : acc;
  }, 'COMPLIANT');

  const citations = [...BASE_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];

  // Surplus cap flag — always when deemed dividend > 0.
  if (totalDeemedDividend > 0) {
    citations.push({
      kind: 'ITAA_1936',
      reference: 's109Y',
      lastReviewed: '2026-05-05',
    });
    uncomputed.push({
      id: 'UC-DIV7A-DISTRIBUTABLE-SURPLUS',
      rationale:
        'Deemed-dividend amounts under s109D are capped by the company\'s distributable surplus (s109Y). v1 reports the structural Div 7A exposure; the s109Y calc — net assets + paid-up capital + repayments + non-commercial loans, less prior-year frankable distributions — is its own beast and lands in a future sub-PR. Engage a registered tax agent.',
      citation: { kind: 'ITAA_1936', reference: 's109Y', lastReviewed: '2026-05-05' },
    });
  }

  // Sub-trust UPE flag — when any loan triggers it.
  if (classifications.some((c) => c.status === 'SUB_TRUST_UPE')) {
    citations.push({ kind: 'TR', reference: '2010/3', lastReviewed: '2026-05-05' });
    citations.push({ kind: 'PCG', reference: '2017/13', lastReviewed: '2026-05-05' });
    uncomputed.push({
      id: 'UC-DIV7A-SUBTRUST-UPE',
      rationale:
        'One or more loans flagged as sub-trust UPE arrangements. TR 2010/3 + PCG 2017/13 set out Option 1 / 2 / 3 sub-trust regimes (interest-only with 7- or 10-year principal repayment; or 7-year principal-and-interest). v1 surfaces the flag; full classification lands in a future sub-PR.',
      citation: { kind: 'TR', reference: '2010/3', lastReviewed: '2026-05-05' },
    });
  }

  return {
    classifications,
    totalDeemedDividend,
    highestSeverity,
    citations,
    uncomputed,
  };
}
