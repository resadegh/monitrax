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
      name: 'Single home + cash + home loan',
      description: '$800k property, $50k cash, $400k home loan. Loan type "HOME" classifies as mortgage per app-wide convention (intelligence/portfolioEngine, health/types, testing/types).',
      input: {
        properties: [{ currentValue: 800_000 }],
        accounts: [{ currentBalance: 50_000, type: 'SAVINGS' }],
        investments: [],
        loans: [{ principal: 400_000, type: 'HOME' }],
      },
      assertions: [
        {
          description: 'Assets total = $850,000 ($800k property + $50k cash)',
          check: (r) => Math.round(r.assets.total) === 850_000,
        },
        {
          description: 'Liabilities mortgages = $400,000 (HOME loan correctly classified)',
          check: (r) => Math.round(r.liabilities.mortgages) === 400_000,
        },
        {
          description: 'Liabilities total = $400,000',
          check: (r) => Math.round(r.liabilities.total) === 400_000,
        },
        {
          description: 'Net worth = $450,000',
          check: (r) => Math.round(r.netWorth) === 450_000,
        },
        {
          description: 'Property equity = $400,000 ($800k value − $400k mortgage)',
          check: (r) => Math.round(r.breakdown.propertyEquity) === 400_000,
        },
      ],
      authoritySource: 'Hand-calculation: assets $850k − liabilities $400k = $450k net worth; property equity $800k − $400k mortgage = $400k. Loan type vocabulary verified against intelligence/portfolioEngine.ts and health/types.ts.',
    },
    {
      name: 'Loan with unrecognised type → personal loan (negative test)',
      description: 'Locks in current classifier behaviour: any loan type other than HOME/INVESTMENT/CREDIT_CARD (case-insensitive) falls through to personalLoans bucket. Captures the contract so any future change to the classifier is detected.',
      input: {
        properties: [],
        accounts: [],
        investments: [],
        loans: [{ principal: 50_000, type: 'PERSONAL' }],
      },
      assertions: [
        {
          description: 'Mortgages = $0 (PERSONAL is not a mortgage type)',
          check: (r) => r.liabilities.mortgages === 0,
        },
        {
          description: 'Personal loans = $50,000',
          check: (r) => r.liabilities.personalLoans === 50_000,
        },
      ],
      authoritySource: 'Engine contract: calculateTotalLiabilities classifies HOME/INVESTMENT/property-bound → mortgages; CREDIT_CARD → creditCards; everything else → personalLoans.',
    },
  ],
});

// ============================================================
// Income aggregator — DELETED (MON-131 T1-B)
// ============================================================
// `core.incomeAggregator` is retired WITH its engine: `aggregateIncome`
// (the legacy income run-rate producer) is deleted from
// lib/calculations/incomeAggregator.ts. Its correctness surface is now
// `income.salaryBanked` / `income.bankedAggregate` in
// engines/banked-income.ts (the ONE producer, D17/D20) — not a parallel
// silo (§22.2.2): the inventory entry moved with the producer.

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
      name: '$2k/month rent + $1k/month food → annual = $36,000',
      description: 'Two MONTHLY expenses (UPPERCASE Frequency enum required by toAnnual). Annual total: ($2k + $1k) × 12 = $36,000.',
      input: {
        items: [
          { amount: 2_000, frequency: 'MONTHLY', category: 'HOUSING', isEssential: true, isTaxDeductible: false },
          { amount: 1_000, frequency: 'MONTHLY', category: 'FOOD', isEssential: true, isTaxDeductible: false },
        ],
        targetFrequency: 'annual',
      },
      assertions: [
        {
          description: 'Total annual expense = $36,000 (($2k + $1k) × 12)',
          check: (r) => Math.round(r.total) === 36_000,
        },
        {
          description: 'Essential = $36,000 (both flagged isEssential)',
          check: (r) => Math.round(r.essential) === 36_000,
        },
        {
          description: 'Tax deductible = $0 (neither isTaxDeductible)',
          check: (r) => r.taxDeductible === 0,
        },
        {
          description: 'HOUSING category = $24,000',
          check: (r) => r.byCategory.HOUSING === 24_000,
        },
        {
          description: 'FOOD category = $12,000',
          check: (r) => r.byCategory.FOOD === 12_000,
        },
      ],
      authoritySource: 'Hand-calc: ($2,000 + $1,000) × 12 = $36,000. Engine contract: frequency uses UPPERCASE Frequency enum.',
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
      name: '$2,500/month mortgage → $30,000/year',
      description: '$400k principal at 6% with $2,500 MONTHLY repayments (UPPERCASE RepaymentFrequency enum). Annual: $2,500 × 12 = $30,000.',
      input: {
        loans: [
          {
            principal: 400_000,
            minRepayment: 2_500,
            repaymentFrequency: 'MONTHLY',
            interestRateAnnual: 6,
            type: 'HOME',
          },
        ],
        targetFrequency: 'annual',
      },
      assertions: [
        {
          description: 'Total annual repayments = $30,000 ($2,500 × 12)',
          check: (r) => Math.round(r.totalRepayments) === 30_000,
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
      authoritySource: 'Hand-calc: $2,500 × 12 = $30,000. Engine contract: repaymentFrequency uses UPPERCASE RepaymentFrequency enum.',
    },
  ],
});
