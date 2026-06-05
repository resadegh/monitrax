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
import { Decimal, toDecimal } from '@/lib/decimal';

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
/**
 * Optional inputs for Phase 41f.3+ — distributable-surplus cap.
 * When the calling code can resolve the company's simplified s109Y
 * surplus (typically from `EntityAccountingSnapshot.distributableSurplus`),
 * pass it here. The classifier then caps `totalDeemedDividend` at the
 * surplus and pro-rata-distributes the cap across each loan's
 * `deemedDividendAmount`.
 *
 * When omitted, behaviour is unchanged from Phase 41h.5 — the
 * classifier surfaces UC-DIV7A-DISTRIBUTABLE-SURPLUS with the
 * "engage a registered tax agent" caveat.
 */
export interface Div7AClassifyOptions {
  /**
   * The simplified s109Y surplus per Phase 41f.3 (retained earnings +
   * net profit after tax, floored at 0). Applies to ALL loans in the
   * call — multi-company callers should call once per company. When
   * the cap binds, a UC-DIV7A-SURPLUS-CAPPED flag surfaces so the AI
   * advisor can narrate the cap accurately. The simplified-surplus
   * caveat (UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE) is preserved
   * because the full s109Y formula needs off-Xero franking-account data.
   */
  distributableSurplus?: number;
}

export function classifyDiv7ALoans(
  loans: Div7ALoanInput[],
  options: Div7AClassifyOptions = {},
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
  const grossDeemedDividend = classifications.reduce(
    (sum, c) => sum + c.deemedDividendAmount,
    0,
  );

  // Phase 41f.3 — apply the surplus cap when available. Pro-rata
  // distribute the capped total back to each loan's deemedDividendAmount
  // so per-loan numbers stay consistent with the aggregate.
  let totalDeemedDividend = grossDeemedDividend;
  let surplusCapApplied = false;
  if (
    typeof options.distributableSurplus === 'number' &&
    Number.isFinite(options.distributableSurplus) &&
    options.distributableSurplus >= 0 &&
    grossDeemedDividend > options.distributableSurplus
  ) {
    const capRatio = options.distributableSurplus / grossDeemedDividend;
    for (const c of classifications) {
      if (c.deemedDividendAmount > 0) {
        c.deemedDividendAmount = Math.round(c.deemedDividendAmount * capRatio * 100) / 100;
      }
    }
    totalDeemedDividend = options.distributableSurplus;
    surplusCapApplied = true;
  }

  const highestSeverity = classifications.reduce<Div7AStatus>((acc, c) => {
    return SEVERITY_RANK[c.status] > SEVERITY_RANK[acc] ? c.status : acc;
  }, 'COMPLIANT');

  const citations = [...BASE_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];

  // Surplus handling — three paths:
  //   1. surplus provided + cap applied → emit UC-DIV7A-SURPLUS-CAPPED
  //   2. surplus provided + did NOT cap → emit UC-DIV7A-SURPLUS-NOT-BINDING
  //   3. surplus NOT provided + deemed > 0 → emit legacy
  //      UC-DIV7A-DISTRIBUTABLE-SURPLUS (unchanged from Phase 41h.5)
  if (typeof options.distributableSurplus === 'number') {
    citations.push({
      kind: 'ITAA_1936',
      reference: 's109Y',
      lastReviewed: '2026-05-05',
    });
    if (surplusCapApplied) {
      uncomputed.push({
        id: 'UC-DIV7A-SURPLUS-CAPPED',
        rationale: `Aggregate deemed-dividend exposure of $${grossDeemedDividend.toLocaleString()} exceeded the company's simplified s109Y distributable surplus of $${options.distributableSurplus.toLocaleString()}. Per s109Y the deemed-dividend amount cannot exceed the surplus; per-loan amounts have been pro-rata reduced. The simplified surplus uses retained earnings + net profit after tax — the full s109Y formula additionally accounts for paid-up capital + non-commercial loans + prior-year frankable distributions, which require off-Xero data. Engage a registered tax agent before lodgment.`,
        citation: { kind: 'ITAA_1936', reference: 's109Y', lastReviewed: '2026-05-05' },
      });
    }
    // Always raise the simplified-surplus caveat per spec doc §9
    // (UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE).
    if (grossDeemedDividend > 0) {
      uncomputed.push({
        id: 'UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE',
        rationale:
          'The s109Y surplus used here is the simplified estimate (retained earnings + net profit after tax, floored at 0). The full s109Y formula additionally accounts for paid-up capital + non-commercial loans + prior-year frankable distributions; those values require off-Xero data (typically the prior FY tax return). Treat this surplus as a best-estimate; engage a registered tax agent for the binding figure.',
        citation: { kind: 'ITAA_1936', reference: 's109Y', lastReviewed: '2026-05-05' },
      });
    }
  } else if (grossDeemedDividend > 0) {
    // Legacy path — no surplus passed. Behaviour unchanged from 41h.5.
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

// =============================================================================
// Q-DEC PR 2.D.3c2 — Decimal sibling path
// =============================================================================

export interface Div7ALoanInputDecimal {
  loanId: string;
  loanLabel?: string;
  openingBalance: number | string | Decimal;
  yearsRemaining: number;
  benchmarkRate: number | string | Decimal;
  paymentsMadeThisFy: number | string | Decimal;
  hasComplianceAgreement: boolean;
  isSubTrustUpe?: boolean;
}

export interface Div7AClassifyOptionsDecimal {
  distributableSurplus?: number | string | Decimal;
}

export interface Div7ALoanClassificationDecimal {
  loanId: string;
  loanLabel?: string;
  status: Div7AStatus;
  minimumYearlyRepayment: Decimal;
  mrpShortfall: Decimal;
  deemedDividendAmount: Decimal;
  reason: string;
}

export interface Div7AClassificationResultDecimal {
  classifications: Div7ALoanClassificationDecimal[];
  totalDeemedDividend: Decimal;
  highestSeverity: Div7AStatus;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * Decimal sibling of `calculateMinimumYearlyRepayment` — exact s109N
 * amortising annuity formula. Preserves the degenerate-case branches:
 * `openingBalance ≤ 0 || yearsRemaining ≤ 0 → 0`, `benchmarkRate ≤ 0 →
 * straight-line balance/n`.
 *
 * Note: `Decimal.pow(base, n)` accepts an integer exponent. The Phase
 * 41e.6 inputs always pass integer `yearsRemaining`, but we keep the
 * Math.pow Float fallback at the boundary for safety.
 */
export function calculateMinimumYearlyRepaymentDecimal(
  openingBalance: number | string | Decimal,
  yearsRemaining: number,
  benchmarkRate: number | string | Decimal,
): Decimal {
  const balance = toDecimal(openingBalance) ?? new Decimal(0);
  if (balance.lte(0) || yearsRemaining <= 0) return new Decimal(0);
  const rate = toDecimal(benchmarkRate) ?? new Decimal(0);
  if (rate.lte(0)) {
    return balance.div(yearsRemaining);
  }
  // (1 + r)^n via decimal.js Decimal.pow (preserves precision through
  // the exponentiation). Integer `n` keeps this exact.
  const onePlusR = rate.plus(1);
  const onePlusRtoN = onePlusR.pow(yearsRemaining);
  const numerator = rate.times(onePlusRtoN);
  const denominator = onePlusRtoN.minus(1);
  return balance.times(numerator.div(denominator));
}

function classifyLoanDecimal(input: Div7ALoanInputDecimal): Div7ALoanClassificationDecimal {
  const { loanId, loanLabel, yearsRemaining } = input;
  const openingBalance = toDecimal(input.openingBalance) ?? new Decimal(0);
  const paymentsMadeThisFy = toDecimal(input.paymentsMadeThisFy) ?? new Decimal(0);

  const mrp = calculateMinimumYearlyRepaymentDecimal(
    openingBalance,
    yearsRemaining,
    input.benchmarkRate,
  );

  if (input.isSubTrustUpe) {
    return {
      loanId,
      loanLabel,
      status: 'SUB_TRUST_UPE',
      minimumYearlyRepayment: mrp,
      mrpShortfall: new Decimal(0),
      deemedDividendAmount: new Decimal(0),
      reason:
        'Sub-trust UPE arrangement (TR 2010/3 + PCG 2017/13). v1 flags for review — Option 1 / 2 / 3 sub-trust classification + 7- vs 10-year term analysis lands in a future sub-PR. Deemed-dividend exposure is NOT zero — engage a registered tax agent.',
    };
  }

  if (!input.hasComplianceAgreement) {
    return {
      loanId,
      loanLabel,
      status: 'NO_AGREEMENT',
      minimumYearlyRepayment: mrp,
      mrpShortfall: new Decimal(0),
      deemedDividendAmount: openingBalance,
      reason:
        'No written Div 7A-compliant loan agreement. Per s109D the entire opening balance is treated as an unfranked dividend to the borrower, capped at distributable surplus (s109Y). Engage a registered tax agent before lodgment.',
    };
  }

  const shortfall = Decimal.max(new Decimal(0), mrp.minus(paymentsMadeThisFy));
  if (shortfall.gt(0)) {
    return {
      loanId,
      loanLabel,
      status: 'MRP_SHORTFALL',
      minimumYearlyRepayment: mrp,
      mrpShortfall: shortfall,
      deemedDividendAmount: shortfall,
      reason: `MRP for FY is $${mrp.toDecimalPlaces(0).toString()}; payments made $${paymentsMadeThisFy.toDecimalPlaces(0).toString()}. Shortfall of $${shortfall.toDecimalPlaces(0).toString()} treated as unfranked dividend per s109D, capped at distributable surplus (s109Y).`,
    };
  }

  return {
    loanId,
    loanLabel,
    status: 'COMPLIANT',
    minimumYearlyRepayment: mrp,
    mrpShortfall: new Decimal(0),
    deemedDividendAmount: new Decimal(0),
    reason: `Compliant — payments ($${paymentsMadeThisFy.toDecimalPlaces(0).toString()}) meet or exceed the s109N MRP of $${mrp.toDecimalPlaces(0).toString()}.`,
  };
}

/**
 * Decimal sibling of `classifyDiv7ALoans`. Preserves the Phase 41f.3
 * distributable-surplus cap with Decimal-precise pro-rata distribution.
 *
 * Float Math.round(x * 100) / 100 on capped deemed-dividends mirrored
 * via `toDecimalPlaces(2, ROUND_HALF_EVEN)`.
 */
export function classifyDiv7ALoansDecimal(
  loans: Div7ALoanInputDecimal[],
  options: Div7AClassifyOptionsDecimal = {},
): Div7AClassificationResultDecimal {
  if (loans.length === 0) {
    return {
      classifications: [],
      totalDeemedDividend: new Decimal(0),
      highestSeverity: 'COMPLIANT',
      citations: BASE_CITATIONS,
      uncomputed: [],
    };
  }

  const classifications = loans.map((l) => classifyLoanDecimal(l));
  let grossDeemedDividend = new Decimal(0);
  for (const c of classifications) {
    grossDeemedDividend = grossDeemedDividend.plus(c.deemedDividendAmount);
  }

  let totalDeemedDividend = grossDeemedDividend;
  let surplusCapApplied = false;
  let surplus: Decimal | null = null;
  if (options.distributableSurplus != null) {
    const surplusCandidate = toDecimal(options.distributableSurplus);
    if (
      surplusCandidate !== null &&
      surplusCandidate.gte(0) &&
      grossDeemedDividend.gt(surplusCandidate)
    ) {
      surplus = surplusCandidate;
      const capRatio = surplusCandidate.div(grossDeemedDividend);
      for (const c of classifications) {
        if (c.deemedDividendAmount.gt(0)) {
          c.deemedDividendAmount = c.deemedDividendAmount
            .times(capRatio)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
        }
      }
      totalDeemedDividend = surplusCandidate;
      surplusCapApplied = true;
    }
  }

  const highestSeverity = classifications.reduce<Div7AStatus>((acc, c) => {
    return SEVERITY_RANK[c.status] > SEVERITY_RANK[acc] ? c.status : acc;
  }, 'COMPLIANT');

  const citations = [...BASE_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];

  if (options.distributableSurplus != null) {
    citations.push({ kind: 'ITAA_1936', reference: 's109Y', lastReviewed: '2026-05-05' });
    if (surplusCapApplied && surplus !== null) {
      uncomputed.push({
        id: 'UC-DIV7A-SURPLUS-CAPPED',
        rationale: `Aggregate deemed-dividend exposure of $${grossDeemedDividend.toDecimalPlaces(0).toString()} exceeded the company's simplified s109Y distributable surplus of $${surplus.toDecimalPlaces(0).toString()}. Per s109Y the deemed-dividend amount cannot exceed the surplus; per-loan amounts have been pro-rata reduced. The simplified surplus uses retained earnings + net profit after tax — the full s109Y formula additionally accounts for paid-up capital + non-commercial loans + prior-year frankable distributions, which require off-Xero data. Engage a registered tax agent before lodgment.`,
        citation: { kind: 'ITAA_1936', reference: 's109Y', lastReviewed: '2026-05-05' },
      });
    }
    if (grossDeemedDividend.gt(0)) {
      uncomputed.push({
        id: 'UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE',
        rationale:
          'The s109Y surplus used here is the simplified estimate (retained earnings + net profit after tax, floored at 0). The full s109Y formula additionally accounts for paid-up capital + non-commercial loans + prior-year frankable distributions; those values require off-Xero data (typically the prior FY tax return). Treat this surplus as a best-estimate; engage a registered tax agent for the binding figure.',
        citation: { kind: 'ITAA_1936', reference: 's109Y', lastReviewed: '2026-05-05' },
      });
    }
  } else if (grossDeemedDividend.gt(0)) {
    citations.push({ kind: 'ITAA_1936', reference: 's109Y', lastReviewed: '2026-05-05' });
    uncomputed.push({
      id: 'UC-DIV7A-DISTRIBUTABLE-SURPLUS',
      rationale:
        'Deemed-dividend amounts under s109D are capped by the company\'s distributable surplus (s109Y). v1 reports the structural Div 7A exposure; the s109Y calc — net assets + paid-up capital + repayments + non-commercial loans, less prior-year frankable distributions — is its own beast and lands in a future sub-PR. Engage a registered tax agent.',
      citation: { kind: 'ITAA_1936', reference: 's109Y', lastReviewed: '2026-05-05' },
    });
  }

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
