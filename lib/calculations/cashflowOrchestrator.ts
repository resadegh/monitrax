/**
 * Cashflow Orchestrator
 *
 * Single source of truth for cashflow calculations.
 * Blueprint §5.1: Never Duplicate Logic
 *
 * Replaces scattered cashflow calculations in:
 * - app/api/calculate/cashflow/route.ts
 * - app/api/financial-health/route.ts
 * - app/api/cashflow/route.ts
 * - app/api/portfolio/snapshot/route.ts
 *
 * Formula: Cashflow = Net Income - Expenses - Loan Repayments
 */

import { toMonthly, toMonthlyDecimal } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
import { Decimal, toDecimal } from '@/lib/decimal';

// =============================================================================
// TYPES
// =============================================================================

/**
 * MON-131 T1-B (MON-137 culprit REMOVED): the orchestrator no longer computes
 * income. Its second withholding producer (`calculateIncomeAmounts` +
 * `calculateTakeHomePay`) — the origin of the gross-carries-net mislabel, the
 * 36,197.69 third PAYG value and the double deduction (VR-042 V2/V3) — is
 * DELETED, not wrapped. Income arrives as pre-computed BANKED totals from the
 * ONE L2 aggregator (`lib/income/banked/aggregator.ts`, D17/D20); the
 * identity `cashflow.grossIncome ≡ income.grossTotal` holds by construction
 * because both read the same producer. Contract authority:
 * docs/architecture/contracts/monthly-cashflow-declared.md (DR-4 collapse) +
 * income-net-run-rate.md (variant C deleted).
 */
export interface BankedIncomeTotals {
  /** Monthly gross run-rate (banked-engine basis). */
  monthlyGross: number;
  /** Monthly banked (cash reaching the account — D17; NOT "net income"). */
  monthlyBanked: number;
  /** Monthly withholding wedge (PAYG + HELP). */
  monthlyWithholding: number;
  /** Annual gross over isTaxable !== false rows (legacy taxableIncome field
   *  semantic ONLY — the tax engine owns the real base; T4 renames). */
  grossTaxableAnnual: number;
  /** Monthly banked per income type (SALARY/RENTAL/INVESTMENT/OTHER). */
  byTypeMonthlyBanked: Record<string, number>;
}

export interface ExpenseItem {
  amount: number;
  frequency: string;
  isEssential?: boolean;
  isTaxDeductible?: boolean;
  category?: string;
  name?: string;
  ownerEntityId?: string | null;
}

export interface LoanItem {
  minRepayment: number;
  repaymentFrequency: string;
  name?: string;
  principal?: number;
  interestRate?: number;
  offsetBalance?: number;
  ownerEntityId?: string | null;
}

export interface CashflowInput {
  /** Pre-computed banked income totals from the ONE L2 aggregator. Callers
   *  derive these via `bankedTotalsFromResult()` — never hand-rolled. The
   *  `ownerEntityId` filter below applies to expenses/loans only; income
   *  totals are pre-scoped by the caller (entity slices come from the
   *  banked per-row attribution, the same one producer). */
  incomeTotals: BankedIncomeTotals;
  expenses: ExpenseItem[];
  loans: LoanItem[];
}

export interface CashflowResult {
  // Monthly figures (gross/net separation)
  monthlyGrossIncome: number;
  monthlyNetIncome: number;
  monthlyIncome: number; // Alias for monthlyNetIncome
  monthlyPaygWithholding: number;
  monthlyExpenses: number;
  monthlyLoanRepayments: number;
  monthlyCashflow: number;
  monthlySurplus: number; // Alias for monthlyCashflow

  // Annual figures
  annualGrossIncome: number;
  annualNetIncome: number;
  annualIncome: number; // Alias for annualNetIncome
  annualPaygWithholding: number;
  annualExpenses: number;
  annualLoanRepayments: number;
  annualCashflow: number;
  annualSurplus: number; // Alias for annualCashflow

  // Metrics
  savingsRate: number; // Percentage of income saved
  expenseRatio: number; // Expenses as % of income
  debtServiceRatio: number; // Loan repayments as % of income

  // Breakdown
  essentialExpenses: number;
  discretionaryExpenses: number;
  incomeByType: Record<string, number>;
  expensesByCategory: Record<string, number>;

  // Tax-related
  taxableIncome: number;
  taxDeductibleExpenses: number;
}

// Simple result for basic use cases
export interface SimpleCashflowResult {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyLoanRepayments: number;
  monthlyCashflow: number;
  annualIncome: number;
  annualExpenses: number;
  annualLoanRepayments: number;
  annualCashflow: number;
  savingsRate: number;
  expenseRatio: number;
  debtServiceRatio: number;
  essentialExpenses: number;
  discretionaryExpenses: number;
}

// =============================================================================
// MAIN CALCULATIONS
// =============================================================================
// The DR-4 internal duplication (calculateMonthlyCashflow /
// calculateAnnualCashflow re-implementing the same math) is COLLAPSED:
// calculateSimpleCashflow is now a pure projection of calculateCashflow
// (monthly-cashflow-declared contract, T1-B).

/**
 * Calculate simple cashflow result — a projection of `calculateCashflow`.
 */
export function calculateSimpleCashflow(input: CashflowInput): SimpleCashflowResult {
  const full = calculateCashflow(input);
  return {
    monthlyIncome: full.monthlyIncome,
    monthlyExpenses: full.monthlyExpenses,
    monthlyLoanRepayments: full.monthlyLoanRepayments,
    monthlyCashflow: full.monthlyCashflow,
    annualIncome: full.annualIncome,
    annualExpenses: full.annualExpenses,
    annualLoanRepayments: full.annualLoanRepayments,
    annualCashflow: full.annualCashflow,
    savingsRate: full.savingsRate,
    expenseRatio: full.expenseRatio,
    debtServiceRatio: full.debtServiceRatio,
    essentialExpenses: full.essentialExpenses,
    discretionaryExpenses: full.discretionaryExpenses,
  };
}

/**
 * Calculate complete cashflow analysis with all breakdowns.
 *
 * This is the canonical cashflow calculation used throughout the app.
 *
 * `ownerEntityId` (Phase 41e.0 audit C-3): when provided, only items
 * whose `ownerEntityId` matches are included in the result. Default =
 * no filter for backward-compat — every existing caller continues to
 * receive household-wide totals exactly as before.
 *
 * Per `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §6.3.
 */
export function calculateCashflow(
  input: CashflowInput,
  ownerEntityId?: string,
): CashflowResult {
  // Apply optional entity filter once at the top so every downstream
  // loop sees the scoped set. `ownerEntityId === undefined` ⇒ no filter.
  // Income totals are pre-scoped by the caller (see CashflowInput JSDoc).
  const expensesFiltered = ownerEntityId
    ? input.expenses.filter((e) => e.ownerEntityId === ownerEntityId)
    : input.expenses;
  const loansFiltered = ownerEntityId
    ? input.loans.filter((l) => l.ownerEntityId === ownerEntityId)
    : input.loans;

  // Income: the pre-computed banked totals (D17 — the "net" fields carry
  // BANKED; the field names survive this tranche for path continuity).
  const monthlyGrossIncome = input.incomeTotals.monthlyGross;
  const monthlyNetIncome = input.incomeTotals.monthlyBanked;
  const monthlyPaygWithholding = input.incomeTotals.monthlyWithholding;
  const taxableIncome = input.incomeTotals.grossTaxableAnnual;
  const incomeByType: Record<string, number> = { ...input.incomeTotals.byTypeMonthlyBanked };

  // Calculate expenses with breakdowns
  let monthlyExpenses = 0;
  let essentialExpenses = 0;
  let discretionaryExpenses = 0;
  let taxDeductibleExpenses = 0;
  const expensesByCategory: Record<string, number> = {};

  for (const expense of expensesFiltered) {
    const monthly = toMonthly(expense.amount, expense.frequency as Frequency);
    monthlyExpenses += monthly;

    if (expense.isEssential) {
      essentialExpenses += monthly;
    } else {
      discretionaryExpenses += monthly;
    }

    if (expense.isTaxDeductible) {
      taxDeductibleExpenses += monthly * 12;
    }

    const category = expense.category || 'OTHER';
    expensesByCategory[category] = (expensesByCategory[category] || 0) + monthly;
  }

  // Calculate loan repayments
  let monthlyLoanRepayments = 0;
  for (const loan of loansFiltered) {
    const monthly = toMonthly(loan.minRepayment, loan.repaymentFrequency as Frequency);
    monthlyLoanRepayments += monthly;
  }

  // Calculate cashflow (using NET income)
  const monthlyCashflow = monthlyNetIncome - monthlyExpenses - monthlyLoanRepayments;

  // Calculate ratios (avoid division by zero)
  const savingsRate =
    monthlyNetIncome > 0 ? (monthlyCashflow / monthlyNetIncome) * 100 : 0;

  const expenseRatio =
    monthlyNetIncome > 0 ? (monthlyExpenses / monthlyNetIncome) * 100 : 0;

  const debtServiceRatio =
    monthlyNetIncome > 0 ? (monthlyLoanRepayments / monthlyNetIncome) * 100 : 0;

  // Round all values to 2 decimal places
  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    // Monthly (gross/net separation)
    monthlyGrossIncome: round(monthlyGrossIncome),
    monthlyNetIncome: round(monthlyNetIncome),
    monthlyIncome: round(monthlyNetIncome), // Alias
    monthlyPaygWithholding: round(monthlyPaygWithholding),
    monthlyExpenses: round(monthlyExpenses),
    monthlyLoanRepayments: round(monthlyLoanRepayments),
    monthlyCashflow: round(monthlyCashflow),
    monthlySurplus: round(monthlyCashflow), // Alias

    // Annual
    annualGrossIncome: round(monthlyGrossIncome * 12),
    annualNetIncome: round(monthlyNetIncome * 12),
    annualIncome: round(monthlyNetIncome * 12), // Alias
    annualPaygWithholding: round(monthlyPaygWithholding * 12),
    annualExpenses: round(monthlyExpenses * 12),
    annualLoanRepayments: round(monthlyLoanRepayments * 12),
    annualCashflow: round(monthlyCashflow * 12),
    annualSurplus: round(monthlyCashflow * 12), // Alias

    // Metrics
    savingsRate: round(savingsRate),
    expenseRatio: round(expenseRatio),
    debtServiceRatio: round(debtServiceRatio),

    // Breakdown
    essentialExpenses: round(essentialExpenses),
    discretionaryExpenses: round(discretionaryExpenses),
    incomeByType,
    expensesByCategory,

    // Tax-related
    taxableIncome: round(taxableIncome),
    taxDeductibleExpenses: round(taxDeductibleExpenses),
  };
}

// =============================================================================
// Q-DEC PR 2.B — Decimal sibling path
// =============================================================================
//
// End-to-end Decimal version of `calculateCashflow`. Three notes on the
// shadow contract:
//
// 1. **No pre-rounding mid-calc.** The Float `calculateCashflow` calls
//    `Math.round(n * 100) / 100` on every output field. The Decimal
//    sibling does NOT — rounding happens only at the OUTPUT boundary
//    when a caller invokes `fromDecimal(value, 'currency')`. This
//    introduces small (sub-cent) diffs between the paths, which are
//    expected and within currency tolerance (0.005). The shadow harness
//    PASS proves we agree to-the-cent at the user-facing surface.
//
// 2. **`calculateTakeHomePay` Decimal sibling landed in PR 2.C.** The
//    old PR 2.B Float-bridge is gone — `calculateIncomeAmountsDecimal`
//    now calls `calculateTakeHomePayDecimal` directly. The inner tax
//    calculations (PAYG / Medicare / LITO) still go through the Float
//    `TaxEngine` for now; PR 2.D provides Decimal siblings for those
//    and the chain becomes end-to-end Decimal.
//
// 3. **Aliases are dropped.** The Float result has aliases
//    (`monthlyIncome === monthlyNetIncome`, `monthlySurplus === monthlyCashflow`,
//    `annualIncome === annualNetIncome`, `annualSurplus === annualCashflow`).
//    The Decimal result keeps them too — same shape for the shadow
//    flatten to compare field-by-field.

export interface CashflowResultDecimal {
  monthlyGrossIncome: Decimal;
  monthlyNetIncome: Decimal;
  monthlyIncome: Decimal;
  monthlyPaygWithholding: Decimal;
  monthlyExpenses: Decimal;
  monthlyLoanRepayments: Decimal;
  monthlyCashflow: Decimal;
  monthlySurplus: Decimal;

  annualGrossIncome: Decimal;
  annualNetIncome: Decimal;
  annualIncome: Decimal;
  annualPaygWithholding: Decimal;
  annualExpenses: Decimal;
  annualLoanRepayments: Decimal;
  annualCashflow: Decimal;
  annualSurplus: Decimal;

  savingsRate: Decimal;
  expenseRatio: Decimal;
  debtServiceRatio: Decimal;

  essentialExpenses: Decimal;
  discretionaryExpenses: Decimal;
  incomeByType: Record<string, Decimal>;
  expensesByCategory: Record<string, Decimal>;

  taxableIncome: Decimal;
  taxDeductibleExpenses: Decimal;
}

/** Decimal twin of `BankedIncomeTotals` — derived via
 *  `bankedTotalsFromResultDecimal()`, never hand-rolled. */
export interface BankedIncomeTotalsDecimal {
  monthlyGross: Decimal;
  monthlyBanked: Decimal;
  monthlyWithholding: Decimal;
  grossTaxableAnnual: Decimal;
  byTypeMonthlyBanked: Record<string, Decimal>;
}

export interface CashflowInputDecimal {
  incomeTotals: BankedIncomeTotalsDecimal;
  expenses: ExpenseItem[];
  loans: LoanItem[];
}

/**
 * Decimal sibling of `calculateCashflow`. Same shape, same contract,
 * end-to-end Decimal arithmetic with no mid-computation rounding.
 */
export function calculateCashflowDecimal(
  input: CashflowInputDecimal,
  ownerEntityId?: string,
): CashflowResultDecimal {
  const expensesFiltered = ownerEntityId
    ? input.expenses.filter((e) => e.ownerEntityId === ownerEntityId)
    : input.expenses;
  const loansFiltered = ownerEntityId
    ? input.loans.filter((l) => l.ownerEntityId === ownerEntityId)
    : input.loans;

  const monthlyGrossIncome = input.incomeTotals.monthlyGross;
  const monthlyNetIncome = input.incomeTotals.monthlyBanked;
  const monthlyPaygWithholding = input.incomeTotals.monthlyWithholding;
  const taxableIncome = input.incomeTotals.grossTaxableAnnual;
  const incomeByType: Record<string, Decimal> = { ...input.incomeTotals.byTypeMonthlyBanked };

  let monthlyExpenses = new Decimal(0);
  let essentialExpenses = new Decimal(0);
  let discretionaryExpenses = new Decimal(0);
  let taxDeductibleExpenses = new Decimal(0);
  const expensesByCategory: Record<string, Decimal> = {};

  for (const expense of expensesFiltered) {
    const monthly = toMonthlyDecimal(expense.amount, expense.frequency as Frequency);
    monthlyExpenses = monthlyExpenses.plus(monthly);

    if (expense.isEssential) {
      essentialExpenses = essentialExpenses.plus(monthly);
    } else {
      discretionaryExpenses = discretionaryExpenses.plus(monthly);
    }
    if (expense.isTaxDeductible) {
      taxDeductibleExpenses = taxDeductibleExpenses.plus(monthly.times(12));
    }

    const category = expense.category || 'OTHER';
    expensesByCategory[category] = (expensesByCategory[category] ?? new Decimal(0)).plus(monthly);
  }

  let monthlyLoanRepayments = new Decimal(0);
  for (const loan of loansFiltered) {
    monthlyLoanRepayments = monthlyLoanRepayments.plus(
      toMonthlyDecimal(loan.minRepayment, loan.repaymentFrequency as Frequency),
    );
  }

  const monthlyCashflow = monthlyNetIncome.minus(monthlyExpenses).minus(monthlyLoanRepayments);

  const savingsRate = monthlyNetIncome.gt(0)
    ? monthlyCashflow.div(monthlyNetIncome).times(100)
    : new Decimal(0);
  const expenseRatio = monthlyNetIncome.gt(0)
    ? monthlyExpenses.div(monthlyNetIncome).times(100)
    : new Decimal(0);
  const debtServiceRatio = monthlyNetIncome.gt(0)
    ? monthlyLoanRepayments.div(monthlyNetIncome).times(100)
    : new Decimal(0);

  return {
    monthlyGrossIncome,
    monthlyNetIncome,
    monthlyIncome: monthlyNetIncome,
    monthlyPaygWithholding,
    monthlyExpenses,
    monthlyLoanRepayments,
    monthlyCashflow,
    monthlySurplus: monthlyCashflow,

    annualGrossIncome: monthlyGrossIncome.times(12),
    annualNetIncome: monthlyNetIncome.times(12),
    annualIncome: monthlyNetIncome.times(12),
    annualPaygWithholding: monthlyPaygWithholding.times(12),
    annualExpenses: monthlyExpenses.times(12),
    annualLoanRepayments: monthlyLoanRepayments.times(12),
    annualCashflow: monthlyCashflow.times(12),
    annualSurplus: monthlyCashflow.times(12),

    savingsRate,
    expenseRatio,
    debtServiceRatio,

    essentialExpenses,
    discretionaryExpenses,
    incomeByType,
    expensesByCategory,

    taxableIncome,
    taxDeductibleExpenses,
  };
}
