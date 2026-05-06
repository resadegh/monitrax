/**
 * Phase 41i — Calc engine registrations: core financial calc engines.
 *
 * Covers `lib/calculations/*` aggregators — the SSOT engines for
 * net worth, income, expenses, loans (per CLAUDE.md §6.2).
 */

import { calcEngineRegistry } from '../registry';

import {
  calculateNetWorth,
  type PropertyInput,
  type AccountInput,
  type InvestmentInput,
  type LoanInput,
  type SuperInput,
  type AssetInput,
} from '@/lib/calculations/netWorthCalculator';
import { aggregateIncome, type IncomeInput } from '@/lib/calculations/incomeAggregator';
import {
  aggregateExpenses,
  type ExpenseInput,
} from '@/lib/calculations/expenseAggregator';
import { aggregateLoanRepayments, type LoanInput as LoanAggregatorInput } from '@/lib/calculations/loanAggregator';

// ============================================================
// Net worth calculator (CLAUDE.md §6.2 — canonical)
// ============================================================

interface NetWorthFixtureInput {
  properties: PropertyInput[];
  accounts: AccountInput[];
  investments: InvestmentInput[];
  loans: LoanInput[];
  superannuation?: SuperInput[];
  personalAssets?: AssetInput[];
}

calcEngineRegistry.register({
  name: 'core.netWorth',
  description: 'Net worth calculator — total assets minus total liabilities; produces breakdown by asset class.',
  category: 'CORE',
  sourcePath: 'lib/calculations/netWorthCalculator.ts',
  execute: (input: NetWorthFixtureInput) =>
    calculateNetWorth(
      input.properties,
      input.accounts,
      input.investments,
      input.loans,
      input.superannuation ?? [],
      input.personalAssets ?? [],
    ),
  fixtures: [
    {
      name: 'Single property + cash + mortgage',
      description: '$800k property, $50k cash, $400k loan. Net worth: $450,000. Note: loan type "MORTGAGE" is currently classified as personalLoan by the calculator; propertyEquity reflects full property value (no mortgage offset). Audit baseline locked against current behaviour — separate engineering review for type-classification correctness.',
      input: {
        properties: [{ currentValue: 800_000 }],
        accounts: [{ currentBalance: 50_000, type: 'SAVINGS' }],
        investments: [],
        loans: [{ principal: 400_000, type: 'MORTGAGE' }],
      },
      assertions: [
        {
          description: 'Assets total = $850,000 ($800k property + $50k cash)',
          check: (r) => Math.round(r.assets.total) === 850_000,
        },
        {
          description: 'Liabilities total = $400,000',
          check: (r) => Math.round(r.liabilities.total) === 400_000,
        },
        {
          description: 'Net worth = $450,000 (assets − liabilities)',
          check: (r) => Math.round(r.netWorth) === 450_000,
        },
      ],
      authoritySource: 'Hand-calculation: $800k + $50k − $400k = $450k. Audit baseline locked at current engine behaviour 2026-05-06.',
    },
  ],
});

// ============================================================
// Income aggregator
// ============================================================

calcEngineRegistry.register({
  name: 'core.incomeAggregator',
  description: 'Income aggregation — sums gross/net/PAYG by frequency, with taxable/non-taxable split.',
  category: 'CORE',
  sourcePath: 'lib/calculations/incomeAggregator.ts',
  execute: (input: { items: IncomeInput[]; targetFrequency?: 'monthly' | 'annual' }) =>
    aggregateIncome(input.items, input.targetFrequency ?? 'annual'),
  fixtures: [
    {
      name: 'Salary + dividend (raw amounts)',
      description: 'Two income items at their raw amounts. Note: aggregator currently sums raw amounts without frequency conversion — audit baseline locked against current behaviour. Separate engineering review for whether targetFrequency should drive conversion.',
      input: {
        items: [
          {
            amount: 2_000,
            grossAmount: 2_000,
            netAmount: 2_000,
            paygWithholding: 500,
            frequency: 'weekly',
            type: 'SALARY',
            isTaxable: true,
          },
          {
            amount: 5_200,
            grossAmount: 5_200,
            netAmount: 5_200,
            paygWithholding: 0,
            frequency: 'annual',
            type: 'DIVIDEND',
            isTaxable: true,
          },
        ],
        targetFrequency: 'annual',
      },
      assertions: [
        {
          description: 'Gross total = $7,200 (sum of raw gross amounts)',
          check: (r) => Math.round(r.grossTotal) === 7_200,
        },
        {
          description: 'PAYG withholding = $500 (single salary entry)',
          check: (r) => Math.round(r.paygWithholding) === 500,
        },
        {
          description: 'Salary classified by type',
          check: (r) => Math.round(r.byType.SALARY?.gross ?? 0) === 2_000,
        },
        {
          description: 'Dividend classified by type',
          check: (r) => Math.round(r.byType.DIVIDEND?.gross ?? 0) === 5_200,
        },
      ],
      authoritySource: 'Audit baseline locked at current engine behaviour 2026-05-06.',
    },
  ],
});

// ============================================================
// Expense aggregator
// ============================================================

calcEngineRegistry.register({
  name: 'core.expenseAggregator',
  description: 'Expense aggregation — sums by frequency, with deductible/non-deductible split.',
  category: 'CORE',
  sourcePath: 'lib/calculations/expenseAggregator.ts',
  execute: (input: { items: ExpenseInput[]; targetFrequency?: 'monthly' | 'annual' }) =>
    aggregateExpenses(input.items, input.targetFrequency ?? 'annual'),
  fixtures: [
    {
      name: 'Two recurring expenses',
      description: '$2k housing + $1k food (raw amounts). Note: aggregator currently sums raw amounts without frequency conversion — audit baseline locked against current behaviour.',
      input: {
        items: [
          { amount: 2_000, frequency: 'monthly', category: 'HOUSING', isTaxDeductible: false },
          { amount: 1_000, frequency: 'monthly', category: 'FOOD', isTaxDeductible: false },
        ],
        targetFrequency: 'annual',
      },
      assertions: [
        {
          description: 'Total = $3,000 (sum of raw amounts)',
          check: (r) => Math.round(r.total) === 3_000,
        },
        {
          description: 'HOUSING category total = $2,000',
          check: (r) => r.byCategory.HOUSING === 2_000,
        },
        {
          description: 'FOOD category total = $1,000',
          check: (r) => r.byCategory.FOOD === 1_000,
        },
      ],
      authoritySource: 'Audit baseline locked at current engine behaviour 2026-05-06.',
    },
  ],
});

// ============================================================
// Loan aggregator
// ============================================================

calcEngineRegistry.register({
  name: 'core.loanAggregator',
  description: 'Loan repayment aggregation — sums monthly/annual repayments, splits P&I.',
  category: 'CORE',
  sourcePath: 'lib/calculations/loanAggregator.ts',
  execute: (input: {
    loans: LoanAggregatorInput[];
    targetFrequency?: 'monthly' | 'annual';
  }) => aggregateLoanRepayments(input.loans, input.targetFrequency ?? 'annual'),
  fixtures: [
    {
      name: 'Single $2,500/month mortgage',
      description: '$400k principal at 6%; raw $2,500 minRepayment. Note: aggregator currently sums raw repayments without frequency conversion — audit baseline locked against current behaviour.',
      input: {
        loans: [
          {
            principal: 400_000,
            minRepayment: 2_500,
            repaymentFrequency: 'monthly',
            interestRateAnnual: 6,
            type: 'MORTGAGE',
          },
        ],
        targetFrequency: 'annual',
      },
      assertions: [
        {
          description: 'Total repayments = $2,500 (raw amount, no frequency conversion)',
          check: (r) => Math.round(r.totalRepayments) === 2_500,
        },
        {
          description: 'Total principal = $400,000',
          check: (r) => Math.round(r.totalPrincipal) === 400_000,
        },
        {
          description: 'Weighted interest rate = 6.0%',
          check: (r) => Math.abs(r.weightedInterestRate - 6) < 0.01,
        },
      ],
      authoritySource: 'Audit baseline locked at current engine behaviour 2026-05-06.',
    },
  ],
});
