/**
 * Q-DEC PR 2.B — Shadow comparison adapters for the rest of
 * `lib/calculations/*`.
 *
 * Four engines, all extending the same pattern PR 2.A established for
 * `netWorthCalculator`:
 *   - `expense.aggregate` → `aggregateExpenses` vs `aggregateExpensesDecimal`
 *   - `income.aggregate`  → `aggregateIncome`   vs `aggregateIncomeDecimal`
 *   - `loan.aggregate`    → `aggregateLoanRepayments` vs `aggregateLoanRepaymentsDecimal`
 *   - `cashflow.compute`  → `calculateCashflow` vs `calculateCashflowDecimal`
 *
 * Each engine returns a flat output object that flattens cleanly. The
 * `fieldPolicy` map carries the per-field rounding policy — most fields
 * are currency; ratios (`savingsRate`, `expenseRatio`, etc.) are
 * percentages; `weightedInterestRate` is a rate.
 */

import {
  aggregateExpenses,
  aggregateExpensesDecimal,
  type ExpenseInput,
} from '@/lib/calculations/expenseAggregator';
import {
  aggregateIncome,
  aggregateIncomeDecimal,
  type IncomeInput,
} from '@/lib/calculations/incomeAggregator';
import {
  aggregateLoanRepayments,
  aggregateLoanRepaymentsDecimal,
  type LoanInput as LoanAggregatorInput,
} from '@/lib/calculations/loanAggregator';
import {
  calculateCashflow,
  calculateCashflowDecimal,
  type CashflowInput,
} from '@/lib/calculations/cashflowOrchestrator';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';
import {
  buildBankedIncome,
  buildBankedIncomeDecimal,
  bankedTotalsFromResult,
  bankedTotalsFromResultDecimal,
} from '@/lib/income/banked/aggregator';
import type { BankedIncomeRow } from '@/lib/income/banked/types';
import { TAX_YEAR_2026_27 } from '@/lib/tax-engine/config/taxYearConfig';

// ---------------------------------------------------------------------------
// Fixtures shared across engines (mass-affluent persona + edge cases)
// ---------------------------------------------------------------------------

const SALARY_INCOME: IncomeInput[] = [
  {
    amount: 9500,
    frequency: 'MONTHLY',
    type: 'SALARY',
    salaryType: 'GROSS',
    paygWithholding: 28500,
    isTaxable: true,
  },
  {
    amount: 850,
    frequency: 'MONTHLY',
    type: 'RENTAL',
    isTaxable: true,
  },
];

const MIXED_EXPENSES: ExpenseInput[] = [
  { amount: 3200, frequency: 'MONTHLY', category: 'Housing', isEssential: true },
  { amount: 1100, frequency: 'MONTHLY', category: 'Groceries', isEssential: true },
  { amount: 250, frequency: 'WEEKLY', category: 'Discretionary', isEssential: false },
  { amount: 4500, frequency: 'ANNUAL', category: 'Insurance', isEssential: true, isTaxDeductible: true },
];

const TWO_LOANS: LoanAggregatorInput[] = [
  {
    principal: 743210.11,
    minRepayment: 4650,
    repaymentFrequency: 'MONTHLY',
    interestRateAnnual: 0.0625, // P0 fix 2026-06-23: decimal (was 6.25 percent, which masked the loanAggregator /100 bug)
    type: 'HOME',
  },
  {
    principal: 543210.99,
    minRepayment: 3200,
    repaymentFrequency: 'MONTHLY',
    interestRateAnnual: 0.0685, // P0 fix 2026-06-23: decimal (was 6.85 percent)
    type: 'INVESTMENT',
  },
];

// ---------------------------------------------------------------------------
// expense.aggregate
// ---------------------------------------------------------------------------

export const expenseAggregatorShadow: ShadowEngine<
  { expenses: ExpenseInput[]; targetFrequency?: 'monthly' | 'annual' },
  ReturnType<typeof aggregateExpenses>,
  ReturnType<typeof aggregateExpensesDecimal>
> = {
  name: 'core.expenseAggregator.shadow',
  description: 'Shadow Float vs Decimal `aggregateExpenses` (PR 2.B).',
  sourcePath: 'lib/calculations/expenseAggregator.ts',
  floatExecute: ({ expenses, targetFrequency }) => aggregateExpenses(expenses, targetFrequency),
  decimalExecute: ({ expenses, targetFrequency }) => aggregateExpensesDecimal(expenses, targetFrequency),
  fieldPolicy: {},
  fixtures: [
    { name: 'empty', description: 'No expenses.', input: { expenses: [] } },
    { name: 'mixed monthly', description: 'Housing/groceries/discretionary/insurance.', input: { expenses: MIXED_EXPENSES } },
    { name: 'mixed annual target', description: 'Same expenses but annual frequency target.', input: { expenses: MIXED_EXPENSES, targetFrequency: 'annual' } },
  ],
};

// ---------------------------------------------------------------------------
// income.aggregate
// ---------------------------------------------------------------------------

export const incomeAggregatorShadow: ShadowEngine<
  { income: IncomeInput[]; targetFrequency?: 'monthly' | 'annual' },
  ReturnType<typeof aggregateIncome>,
  ReturnType<typeof aggregateIncomeDecimal>
> = {
  name: 'core.incomeAggregator.shadow',
  description: 'Shadow Float vs Decimal `aggregateIncome` — salary GROSS + non-salary rental.',
  sourcePath: 'lib/calculations/incomeAggregator.ts',
  floatExecute: ({ income, targetFrequency }) => aggregateIncome(income, targetFrequency),
  decimalExecute: ({ income, targetFrequency }) => aggregateIncomeDecimal(income, targetFrequency),
  fieldPolicy: {},
  fixtures: [
    { name: 'empty', description: 'No income.', input: { income: [] } },
    { name: 'salary GROSS + rental monthly', description: 'PAYG asymmetry exercised.', input: { income: SALARY_INCOME } },
    { name: 'salary GROSS + rental annual', description: 'Same income annual target.', input: { income: SALARY_INCOME, targetFrequency: 'annual' } },
    {
      name: 'salary NET with stored grossAmount',
      description: 'salaryType=NET + grossAmount preset (skips take-home calc).',
      input: {
        income: [
          {
            amount: 7800,
            frequency: 'MONTHLY',
            type: 'SALARY',
            salaryType: 'NET',
            grossAmount: 114000, // already-annual gross
            isTaxable: true,
          },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// loan.aggregate
// ---------------------------------------------------------------------------

export const loanAggregatorShadow: ShadowEngine<
  { loans: LoanAggregatorInput[]; targetFrequency?: 'monthly' | 'annual' },
  ReturnType<typeof aggregateLoanRepayments>,
  ReturnType<typeof aggregateLoanRepaymentsDecimal>
> = {
  name: 'core.loanAggregator.shadow',
  description: 'Shadow Float vs Decimal `aggregateLoanRepayments`.',
  sourcePath: 'lib/calculations/loanAggregator.ts',
  floatExecute: ({ loans, targetFrequency }) => aggregateLoanRepayments(loans, targetFrequency),
  decimalExecute: ({ loans, targetFrequency }) => aggregateLoanRepaymentsDecimal(loans, targetFrequency),
  // weightedInterestRate is a rate (4 dp tolerance), not currency.
  fieldPolicy: {
    weightedInterestRate: 'rate',
  },
  fixtures: [
    { name: 'empty', description: 'No loans.', input: { loans: [] } },
    { name: 'two loans monthly', description: 'Home + IP mortgage.', input: { loans: TWO_LOANS } },
    { name: 'two loans annual', description: 'Same loans annual target.', input: { loans: TWO_LOANS, targetFrequency: 'annual' } },
  ],
};

// ---------------------------------------------------------------------------
// cashflow.compute (the composer)
// ---------------------------------------------------------------------------
// MON-131 T1-B: the orchestrator takes pre-computed BANKED totals (MON-137
// culprit removed). The shadow now exercises the REAL end-to-end path both
// ways: rows -> banked engine (Float/Decimal) -> the ONE totals mapping ->
// calculateCashflow(Decimal). repaymentIncome null => HELP undetermined.

const CASHFLOW_ROWS = {
  income: SALARY_INCOME.map((i) => ({ ...i })),
  expenses: MIXED_EXPENSES,
  loans: TWO_LOANS.map((l) => ({
    minRepayment: l.minRepayment,
    repaymentFrequency: l.repaymentFrequency,
    name: l.type,
  })),
};

const BANKED_CTX = { config: TAX_YEAR_2026_27, repaymentIncome: null };

function bankedInputFromRows(income: Array<Record<string, unknown>>) {
  return {
    income: income as unknown as BankedIncomeRow[],
    properties: [],
    derivedAgentExpenses: [],
    transactions: [],
    ctx: BANKED_CTX,
  };
}

export const cashflowOrchestratorShadow: ShadowEngine<
  { input: { income: Array<Record<string, unknown>>; expenses: typeof MIXED_EXPENSES; loans: Array<{ minRepayment: number; repaymentFrequency: string; name?: string }> } },
  ReturnType<typeof calculateCashflow>,
  ReturnType<typeof calculateCashflowDecimal>
> = {
  name: 'core.cashflowOrchestrator.shadow',
  description: 'Shadow Float vs Decimal `calculateCashflow` — banked totals in, full composition.',
  sourcePath: 'lib/calculations/cashflowOrchestrator.ts',
  floatExecute: ({ input }) =>
    calculateCashflow({
      incomeTotals: bankedTotalsFromResult(buildBankedIncome(bankedInputFromRows(input.income))),
      expenses: input.expenses,
      loans: input.loans,
    }),
  decimalExecute: ({ input }) =>
    calculateCashflowDecimal({
      incomeTotals: bankedTotalsFromResultDecimal(buildBankedIncomeDecimal(bankedInputFromRows(input.income))),
      expenses: input.expenses,
      loans: input.loans,
    }),
  // Every cashflow output field is pre-rounded by Float's `round()` to 2 dp,
  // so they all behave like currency at the shadow boundary — including the
  // ratio fields (savingsRate, expenseRatio, debtServiceRatio).
  fieldPolicy: {},
  fixtures: [
    {
      name: 'empty input',
      description: 'No income/expenses/loans.',
      input: { input: { income: [], expenses: [], loans: [] } },
    },
    {
      name: 'mass-affluent persona',
      description: 'Salary GROSS + rental + mixed expenses + two mortgages — full banked path.',
      input: { input: CASHFLOW_ROWS },
    },
    {
      name: 'salary NET no gross stored',
      description: 'salaryType=NET without grossAmount — banked = amount, gross UNDETERMINED (floors at banked, flagged).',
      input: {
        input: {
          income: [{ amount: 8000, frequency: 'MONTHLY', type: 'SALARY', salaryType: 'NET' }],
          expenses: [{ amount: 2500, frequency: 'MONTHLY', category: 'Housing', isEssential: true }],
          loans: [],
        },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Convenience: full set
// ---------------------------------------------------------------------------

export const calculationsShadowEngines = [
  expenseAggregatorShadow,
  incomeAggregatorShadow,
  loanAggregatorShadow,
  cashflowOrchestratorShadow,
] as const;
