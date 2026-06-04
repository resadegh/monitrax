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
    interestRateAnnual: 6.25,
    type: 'HOME',
  },
  {
    principal: 543210.99,
    minRepayment: 3200,
    repaymentFrequency: 'MONTHLY',
    interestRateAnnual: 6.85,
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

const CASHFLOW_INPUT_BASE: CashflowInput = {
  income: SALARY_INCOME,
  expenses: MIXED_EXPENSES,
  loans: TWO_LOANS.map((l) => ({
    minRepayment: l.minRepayment,
    repaymentFrequency: l.repaymentFrequency,
    name: l.type,
  })),
};

export const cashflowOrchestratorShadow: ShadowEngine<
  { input: CashflowInput },
  ReturnType<typeof calculateCashflow>,
  ReturnType<typeof calculateCashflowDecimal>
> = {
  name: 'core.cashflowOrchestrator.shadow',
  description: 'Shadow Float vs Decimal `calculateCashflow` — full composition.',
  sourcePath: 'lib/calculations/cashflowOrchestrator.ts',
  floatExecute: ({ input }) => calculateCashflow(input),
  decimalExecute: ({ input }) => calculateCashflowDecimal(input),
  // Every cashflow output field is pre-rounded by Float's `round()` to 2 dp,
  // so they all behave like currency at the shadow boundary — including the
  // ratio fields (savingsRate / expenseRatio / debtServiceRatio).
  fieldPolicy: {},
  fixtures: [
    {
      name: 'empty input',
      description: 'No income/expenses/loans.',
      input: { input: { income: [], expenses: [], loans: [] } },
    },
    {
      name: 'mass-affluent persona',
      description: 'Salary GROSS + rental + mixed expenses + two mortgages — full path.',
      input: { input: CASHFLOW_INPUT_BASE },
    },
    {
      name: 'salary NET no PAYG branch',
      description: 'salaryType=NET without grossAmount — gross=net=amount, PAYG=0.',
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
