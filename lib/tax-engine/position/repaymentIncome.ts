/**
 * MON-131 Tranche 1 (D42 C3) — "repayment income" for study-loan (HELP/STSL)
 * purposes. THE one producer of this quantity.
 *
 * Definition (ATO, study-and-training-support-loans rates page, verified
 * 2026-07-30): repayment income = the sum of
 *   1. taxable income (EXCLUDING assessable First Home Super Saver released
 *      amounts)
 *   2. reportable fringe benefits (regardless of employer exempt status)
 *   3. total net investment loss (INCLUDING net rental losses — the add-back
 *      that makes a negatively geared portfolio RAISE repayment income, D42
 *      C3's material consequence)
 *   4. reportable super contributions (salary sacrifice + personal deductible)
 *   5. exempt foreign employment income
 *
 * Pure function (CLAUDE.md §6.4): callers assemble the components — taxable
 * income and net investment loss from the canonical tax position
 * (`getUserTaxPosition`), reportable super from the row's salary sacrifice —
 * and this module only sums with the FHSS exclusion.
 *
 * HONESTY CONTRACT: components Monitrax does not model (reportable fringe
 * benefits, exempt foreign employment income, FHSS released amounts) may be
 * omitted by the caller; each omission is recorded in `componentBasis` as
 * 'DEFAULT_ZERO' so no surface can present the sum as complete when it is
 * not (§22.2.4 — coverage stated precisely, never as prose). D42 C3's
 * instruction for Reza's own figure stands: establish from the notice of
 * assessment; this derived quantity is an estimate and is labelled as one.
 *
 * Consumed by: lib/income/banked/salaryBanked.ts (HELP band input, X2).
 */

import { Decimal, toDecimal } from '@/lib/decimal';

export interface RepaymentIncomeComponents {
  /** Taxable income for the FY (before the FHSS exclusion is applied here). */
  taxableIncome: number;
  /** Assessable FHSS released amounts INCLUDED in taxableIncome (excluded here). */
  fhssReleasedAmounts?: number | null;
  reportableFringeBenefits?: number | null;
  /** Total net investment loss, incl. net rental losses, as a POSITIVE number. */
  totalNetInvestmentLoss?: number | null;
  /** Reportable super contributions (salary sacrifice + personal deductible). */
  reportableSuperContributions?: number | null;
  exemptForeignEmploymentIncome?: number | null;
}

export type ComponentBasis = 'PROVIDED' | 'DEFAULT_ZERO';

export interface RepaymentIncomeResult {
  repaymentIncome: number;
  /** Per-component provenance — 'DEFAULT_ZERO' marks an unmodelled omission. */
  componentBasis: Record<keyof Omit<RepaymentIncomeComponents, 'taxableIncome'>, ComponentBasis>;
  /** True when every component was provided (never asserted by default). */
  complete: boolean;
}

export function computeRepaymentIncome(c: RepaymentIncomeComponents): RepaymentIncomeResult {
  const basis = (v: number | null | undefined): ComponentBasis =>
    v === null || v === undefined ? 'DEFAULT_ZERO' : 'PROVIDED';

  const componentBasis = {
    fhssReleasedAmounts: basis(c.fhssReleasedAmounts),
    reportableFringeBenefits: basis(c.reportableFringeBenefits),
    totalNetInvestmentLoss: basis(c.totalNetInvestmentLoss),
    reportableSuperContributions: basis(c.reportableSuperContributions),
    exemptForeignEmploymentIncome: basis(c.exemptForeignEmploymentIncome),
  } as const;

  const repaymentIncome =
    c.taxableIncome -
    (c.fhssReleasedAmounts ?? 0) +
    (c.reportableFringeBenefits ?? 0) +
    (c.totalNetInvestmentLoss ?? 0) +
    (c.reportableSuperContributions ?? 0) +
    (c.exemptForeignEmploymentIncome ?? 0);

  return {
    repaymentIncome,
    componentBasis,
    complete: Object.values(componentBasis).every((b) => b === 'PROVIDED'),
  };
}

// =============================================================================
// Decimal sibling — same contract.
// =============================================================================

export interface RepaymentIncomeResultDecimal {
  repaymentIncome: Decimal;
  componentBasis: RepaymentIncomeResult['componentBasis'];
  complete: boolean;
}

export function computeRepaymentIncomeDecimal(
  c: RepaymentIncomeComponents,
): RepaymentIncomeResultDecimal {
  const float = computeRepaymentIncome(c);
  const dec = (v: number | null | undefined) => toDecimal(v ?? 0) ?? new Decimal(0);

  const repaymentIncome = dec(c.taxableIncome)
    .minus(dec(c.fhssReleasedAmounts))
    .plus(dec(c.reportableFringeBenefits))
    .plus(dec(c.totalNetInvestmentLoss))
    .plus(dec(c.reportableSuperContributions))
    .plus(dec(c.exemptForeignEmploymentIncome));

  return {
    repaymentIncome,
    componentBasis: float.componentBasis,
    complete: float.complete,
  };
}
