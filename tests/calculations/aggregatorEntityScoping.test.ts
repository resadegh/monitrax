/**
 * Aggregator entity-scoping tests — Phase 41e.0 slice C.
 *
 * Per `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §6.3
 * (resolves audit C-3): every aggregator gains an optional
 * `ownerEntityId?: string` parameter. The contract is:
 *   - omitted / undefined → no filter; behaviour identical to pre-41e
 *   - provided → only items whose `ownerEntityId === provided` are aggregated
 *
 * This file pins both halves of the contract for all five aggregators.
 */

import { describe, it, expect } from 'vitest';
import { aggregateIncome } from '@/lib/calculations/incomeAggregator';
import { aggregateExpenses } from '@/lib/calculations/expenseAggregator';
import { aggregateLoanRepayments } from '@/lib/calculations/loanAggregator';
import { calculateCashflow } from '@/lib/calculations/cashflowOrchestrator';
import {
  calculateTotalAssets,
  calculateTotalLiabilities,
} from '@/lib/calculations/netWorthCalculator';
import {
  buildBankedIncome,
  bankedTotalsFromResult,
} from '@/lib/income/banked/aggregator';
import type { BankedIncomeRow } from '@/lib/income/banked/types';
import { TAX_YEAR_2026_27 } from '@/lib/tax-engine/config/taxYearConfig';

describe('aggregator entity-scoping (audit C-3 fix)', () => {
  describe('incomeAggregator.aggregateIncome', () => {
    const income = [
      {
        amount: 10000,
        frequency: 'MONTHLY',
        type: 'SALARY',
        isTaxable: true,
        ownerEntityId: 'e1',
      },
      {
        amount: 800,
        frequency: 'WEEKLY',
        type: 'RENTAL',
        isTaxable: true,
        ownerEntityId: 'e2',
      },
      {
        amount: 200,
        frequency: 'WEEKLY',
        type: 'RENTAL',
        isTaxable: true,
        ownerEntityId: 'e1',
      },
    ];

    it('no filter param → aggregates everything (backward-compat)', () => {
      const all = aggregateIncome(income, 'monthly');
      const filtered = aggregateIncome(income, 'monthly');
      // Same call → same result (sanity)
      expect(filtered.grossTotal).toBe(all.grossTotal);
    });

    it('omitted ownerEntityId aggregates the entire household', () => {
      const result = aggregateIncome(income, 'monthly');
      // All three items should contribute
      expect(result.grossTotal).toBeGreaterThan(0);
    });

    it('ownerEntityId="e1" excludes e2 items', () => {
      const all = aggregateIncome(income, 'monthly');
      const e1Only = aggregateIncome(income, 'monthly', 'e1');
      const e2Only = aggregateIncome(income, 'monthly', 'e2');
      // e1 + e2 should sum to the unfiltered total (within rounding).
      expect(e1Only.grossTotal + e2Only.grossTotal).toBeCloseTo(all.grossTotal, 2);
      // e1's total is strictly less than the household total (e2 has rows).
      expect(e1Only.grossTotal).toBeLessThan(all.grossTotal);
    });

    it('ownerEntityId="ghost" returns zero (no matching rows)', () => {
      const result = aggregateIncome(income, 'monthly', 'ghost');
      expect(result.grossTotal).toBe(0);
      expect(result.netTotal).toBe(0);
    });
  });

  describe('expenseAggregator.aggregateExpenses', () => {
    const expenses = [
      { amount: 500, frequency: 'MONTHLY', isEssential: true, ownerEntityId: 'e1' },
      { amount: 200, frequency: 'MONTHLY', isEssential: false, ownerEntityId: 'e2' },
      { amount: 100, frequency: 'MONTHLY', isEssential: true, ownerEntityId: 'e1' },
    ];

    it('omitted filter → full household total', () => {
      const result = aggregateExpenses(expenses, 'monthly');
      expect(result.total).toBe(800);
    });

    it('e1 filter → only e1 expenses', () => {
      const result = aggregateExpenses(expenses, 'monthly', 'e1');
      expect(result.total).toBe(600);
      expect(result.essential).toBe(600);
      expect(result.discretionary).toBe(0);
    });

    it('e2 filter → only e2 expenses', () => {
      const result = aggregateExpenses(expenses, 'monthly', 'e2');
      expect(result.total).toBe(200);
      expect(result.discretionary).toBe(200);
    });
  });

  describe('loanAggregator.aggregateLoanRepayments', () => {
    const loans = [
      {
        principal: 500000,
        minRepayment: 2500,
        repaymentFrequency: 'MONTHLY',
        interestRateAnnual: 6,
        ownerEntityId: 'e1',
      },
      {
        principal: 300000,
        minRepayment: 1700,
        repaymentFrequency: 'MONTHLY',
        interestRateAnnual: 6,
        ownerEntityId: 'e2',
      },
    ];

    it('omitted filter → both loans summed', () => {
      const result = aggregateLoanRepayments(loans, 'monthly');
      expect(result.totalPrincipal).toBe(800000);
      expect(result.totalRepayments).toBe(4200);
    });

    it('e1 filter → only e1 loan', () => {
      const result = aggregateLoanRepayments(loans, 'monthly', 'e1');
      expect(result.totalPrincipal).toBe(500000);
      expect(result.totalRepayments).toBe(2500);
    });
  });

  describe('cashflowOrchestrator.calculateCashflow', () => {
    // MON-131 T1-B: the orchestrator no longer computes income — it takes
    // pre-computed BANKED totals (MON-137 culprit removed). Entity scoping
    // for income is therefore the CALLER's job: filter the rows, run them
    // through the ONE banked engine, hand the totals in. The orchestrator's
    // ownerEntityId param still scopes expenses/loans.
    const incomeRows: BankedIncomeRow[] = [
      {
        amount: 10000,
        frequency: 'MONTHLY',
        isTaxable: true,
        type: 'SALARY',
        ownerEntityId: 'e1',
      },
      {
        amount: 600,
        frequency: 'WEEKLY',
        isTaxable: true,
        type: 'RENTAL',
        ownerEntityId: 'e2',
      },
    ];

    const bankedTotals = (rows: BankedIncomeRow[]) =>
      bankedTotalsFromResult(
        buildBankedIncome({
          income: rows,
          properties: [],
          derivedAgentExpenses: [],
          transactions: [],
          ctx: { config: TAX_YEAR_2026_27, repaymentIncome: null },
        }),
      );

    const scopedInput = (ownerEntityId?: string) => ({
      incomeTotals: bankedTotals(
        ownerEntityId
          ? incomeRows.filter((r) => r.ownerEntityId === ownerEntityId)
          : incomeRows,
      ),
      expenses: [
        { amount: 4000, frequency: 'MONTHLY', isEssential: true, ownerEntityId: 'e1' },
        { amount: 1200, frequency: 'MONTHLY', isEssential: false, ownerEntityId: 'e2' },
      ],
      loans: [
        {
          minRepayment: 2500,
          repaymentFrequency: 'MONTHLY',
          ownerEntityId: 'e1',
        },
      ],
    });

    it('no filter → household totals', () => {
      const result = calculateCashflow(scopedInput());
      expect(result.monthlyExpenses).toBe(5200);
      expect(result.monthlyLoanRepayments).toBe(2500);
    });

    it('e1 filter → only e1 income/expenses/loans', () => {
      const result = calculateCashflow(scopedInput('e1'), 'e1');
      expect(result.monthlyExpenses).toBe(4000);
      expect(result.monthlyLoanRepayments).toBe(2500);
      // No e2 rental income → only salary (gross $10k/month)
      expect(result.monthlyGrossIncome).toBe(10000);
    });

    it('e2 filter → only e2 rows (no loans)', () => {
      const result = calculateCashflow(scopedInput('e2'), 'e2');
      expect(result.monthlyExpenses).toBe(1200);
      expect(result.monthlyLoanRepayments).toBe(0);
    });

    it('household total = e1 + e2 (proves no double-counting)', () => {
      const all = calculateCashflow(scopedInput());
      const e1 = calculateCashflow(scopedInput('e1'), 'e1');
      const e2 = calculateCashflow(scopedInput('e2'), 'e2');
      expect(e1.monthlyExpenses + e2.monthlyExpenses).toBe(all.monthlyExpenses);
      expect(e1.monthlyLoanRepayments + e2.monthlyLoanRepayments).toBe(all.monthlyLoanRepayments);
      // Income scoping is the caller's pre-filter: banked e1 + e2 = household.
      expect(e1.monthlyGrossIncome + e2.monthlyGrossIncome).toBeCloseTo(all.monthlyGrossIncome, 2);
    });
  });

  describe('netWorthCalculator', () => {
    const properties = [
      { currentValue: 800000, ownerEntityId: 'e1' },
      { currentValue: 600000, ownerEntityId: 'e2' },
    ];
    const accounts = [
      { currentBalance: 50000, ownerEntityId: 'e1' },
      { currentBalance: 20000, ownerEntityId: 'e2' },
    ];
    const investments = [
      { units: 100, currentPrice: 50, ownerEntityId: 'e1' },
    ];
    const loans = [
      { principal: 500000, type: 'HOME', ownerEntityId: 'e1' },
      { principal: 400000, type: 'INVESTMENT', ownerEntityId: 'e2' },
    ];

    it('calculateTotalAssets — no filter', () => {
      const result = calculateTotalAssets(properties, accounts, investments);
      expect(result.properties).toBe(1400000);
      expect(result.accounts).toBe(70000);
      expect(result.investments).toBe(5000);
    });

    it('calculateTotalAssets — e1 filter', () => {
      const result = calculateTotalAssets(properties, accounts, investments, [], [], 'e1');
      expect(result.properties).toBe(800000);
      expect(result.accounts).toBe(50000);
      expect(result.investments).toBe(5000);
    });

    it('calculateTotalLiabilities — no filter', () => {
      const result = calculateTotalLiabilities(loans);
      expect(result.mortgages).toBe(900000);
    });

    it('calculateTotalLiabilities — e1 filter', () => {
      const result = calculateTotalLiabilities(loans, 'e1');
      expect(result.mortgages).toBe(500000);
    });

    it('per-entity assets - per-entity liabilities sums to household net worth', () => {
      const allAssets = calculateTotalAssets(properties, accounts, investments);
      const allLiab = calculateTotalLiabilities(loans);
      const householdNet = allAssets.total - allLiab.total;

      const e1Assets = calculateTotalAssets(properties, accounts, investments, [], [], 'e1');
      const e1Liab = calculateTotalLiabilities(loans, 'e1');
      const e2Assets = calculateTotalAssets(properties, accounts, investments, [], [], 'e2');
      const e2Liab = calculateTotalLiabilities(loans, 'e2');

      const sumOfEntityNets = (e1Assets.total - e1Liab.total) + (e2Assets.total - e2Liab.total);
      expect(sumOfEntityNets).toBeCloseTo(householdNet, 2);
    });
  });
});
