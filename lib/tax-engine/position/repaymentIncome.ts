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
// Canonical assembler from the tax position (moved here from
// lib/income/banked/assembly.ts in T1-B so the pure two-pass in
// getUserTaxPosition can use it without a module cycle — assembly.ts
// re-exports it; ONE producer either way, §12.2.1).
// =============================================================================

/**
 * D42 C3 — assemble repayment income from the CANONICAL tax position.
 * Derivations (each labelled in componentBasis by `computeRepaymentIncome`):
 *   - taxableIncome           ← taxPosition.tax.taxableIncome
 *   - totalNetInvestmentLoss  ← net rental loss (property + depreciation
 *     deductions over rental income) + net financial-investment loss
 *     (investment deductions over dividends + interest), each floored at 0 —
 *     the ATO IT7/IT8 add-back classes, derived from the position breakdown.
 *   - reportableSuperContributions ← Σ Income.salarySacrifice (salary
 *     sacrifice is reportable; SG is NOT and is never included; personal
 *     deductible contributions are not separable from the position and are
 *     therefore OMITTED — an under-estimate, not a guess).
 *   - FHSS / reportable fringe benefits / exempt foreign employment income —
 *     not modelled → DEFAULT_ZERO, carried in componentBasis (the result is
 *     an estimate and says so; D42 C3: Reza's own figure comes from the
 *     notice of assessment, never this derivation).
 */
export function assembleRepaymentIncome(
  taxPosition: {
    tax: { taxableIncome: number };
    income: { rental: number; dividends: number; interest: number };
    deductions: { property: number; depreciation: number; investment: number };
  },
  incomeRows: Array<{ type: string; salarySacrifice?: number | null }>,
): RepaymentIncomeResult {
  const netRentalLoss = Math.max(
    0,
    taxPosition.deductions.property +
      taxPosition.deductions.depreciation -
      taxPosition.income.rental,
  );
  const netFinancialInvestmentLoss = Math.max(
    0,
    taxPosition.deductions.investment -
      (taxPosition.income.dividends + taxPosition.income.interest),
  );
  const reportableSuper = incomeRows
    .filter((r) => r.type === 'SALARY')
    .reduce((sum, r) => sum + (r.salarySacrifice ?? 0), 0);

  return computeRepaymentIncome({
    taxableIncome: taxPosition.tax.taxableIncome,
    totalNetInvestmentLoss: netRentalLoss + netFinancialInvestmentLoss,
    reportableSuperContributions: reportableSuper,
    // FHSS / RFB / exempt foreign employment — unmodelled, DEFAULT_ZERO.
  });
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
