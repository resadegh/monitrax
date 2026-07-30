/**
 * Q-DEC PR 2.B — Shadow comparison + contract tests for the rest of
 * `lib/calculations/*`:
 *   - expenseAggregator
 *   - incomeAggregator
 *   - loanAggregator
 *   - cashflowOrchestrator
 *
 * Each engine has its shadow registered in
 * `lib/calc-audit/engines/decimal-calculations.ts`. This file runs the
 * shadow report and adds a small number of targeted contract checks on
 * the Decimal path that the shadow report doesn't enforce (e.g. that
 * the IEEE-754 trap exists on Float but not Decimal).
 */

import { describe, it, expect } from 'vitest';
import {
  expenseAggregatorShadow,
  incomeAggregatorShadow,
  loanAggregatorShadow,
  cashflowOrchestratorShadow,
  calculationsShadowEngines,
} from '@/lib/calc-audit/engines/decimal-calculations';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';
import {
  aggregateExpensesDecimal,
  type ExpenseInput,
} from '@/lib/calculations/expenseAggregator';
import {
  aggregateIncomeDecimal,
} from '@/lib/calculations/incomeAggregator';
import {
  aggregateLoanRepaymentsDecimal,
} from '@/lib/calculations/loanAggregator';
import {
  calculateCashflowDecimal,
} from '@/lib/calculations/cashflowOrchestrator';
import {
  buildBankedIncomeDecimal,
  bankedTotalsFromResultDecimal,
} from '@/lib/income/banked/aggregator';
import type { BankedIncomeRow } from '@/lib/income/banked/types';
import { TAX_YEAR_2026_27 } from '@/lib/tax-engine/config/taxYearConfig';

// ---------------------------------------------------------------------------
// Shadow comparison runs — per-engine, per-fixture
// ---------------------------------------------------------------------------

describe('expenseAggregator — Float vs Decimal shadow', () => {
  it.each(expenseAggregatorShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within currency tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(expenseAggregatorShadow, fixture);
      if (result.status !== 'PASS') {
        const detail = result.failedFields
          .map((f) => `${f}: |Δ|=${result.diffs[f]?.absDiff.toString() ?? 'n/a'}`)
          .join('; ');
        throw new Error(`${result.status} on ${fixture.name}: ${detail || result.errorMessage}`);
      }
      expect(result.status).toBe('PASS');
    },
  );
});

describe('incomeAggregator — Float vs Decimal shadow', () => {
  it.each(incomeAggregatorShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within currency tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(incomeAggregatorShadow, fixture);
      if (result.status !== 'PASS') {
        const detail = result.failedFields
          .map((f) => `${f}: |Δ|=${result.diffs[f]?.absDiff.toString() ?? 'n/a'}`)
          .join('; ');
        throw new Error(`${result.status} on ${fixture.name}: ${detail || result.errorMessage}`);
      }
      expect(result.status).toBe('PASS');
    },
  );
});

describe('loanAggregator — Float vs Decimal shadow', () => {
  it.each(loanAggregatorShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within currency tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(loanAggregatorShadow, fixture);
      if (result.status !== 'PASS') {
        const detail = result.failedFields
          .map((f) => `${f}: |Δ|=${result.diffs[f]?.absDiff.toString() ?? 'n/a'}`)
          .join('; ');
        throw new Error(`${result.status} on ${fixture.name}: ${detail || result.errorMessage}`);
      }
      expect(result.status).toBe('PASS');
    },
  );
});

describe('cashflowOrchestrator — Float vs Decimal shadow', () => {
  it.each(cashflowOrchestratorShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(cashflowOrchestratorShadow, fixture);
      if (result.status !== 'PASS') {
        const detail = result.failedFields
          .map((f) => `${f}: |Δ|=${result.diffs[f]?.absDiff.toString() ?? 'n/a'}`)
          .join('; ');
        throw new Error(`${result.status} on ${fixture.name}: ${detail || result.errorMessage}`);
      }
      expect(result.status).toBe('PASS');
    },
  );
});

// ---------------------------------------------------------------------------
// Decimal-path contract checks (parity properties the shadow won't catch)
// ---------------------------------------------------------------------------

describe('Decimal path stays EXACT on IEEE-754 territory', () => {
  it('expenseAggregator — 100 × $0.10 weekly → exact $5,200 annual / $433.33… monthly', () => {
    const expenses: ExpenseInput[] = Array.from({ length: 100 }, () => ({
      amount: 0.1,
      frequency: 'WEEKLY',
      isEssential: false,
    }));
    const annual = aggregateExpensesDecimal(expenses, 'annual');
    expect(annual.total.toString()).toBe(new Decimal('0.1').times(52).times(100).toString());
    expect(annual.total.toString()).toBe('520');
  });

  it('incomeAggregator — sums 1000 × $0.01 monthly → exact $10/mo, $120/yr', () => {
    const income = Array.from({ length: 1000 }, () => ({
      amount: 0.01,
      frequency: 'MONTHLY',
      type: 'OTHER',
      isTaxable: true,
    }));
    const monthly = aggregateIncomeDecimal(income, 'monthly');
    const annual = aggregateIncomeDecimal(income, 'annual');
    expect(monthly.grossTotal.toString()).toBe('10');
    expect(annual.grossTotal.toString()).toBe('120');
  });

  it('loanAggregator — weighted rate is exact at small principal increments', () => {
    const loans = [
      { principal: 100000, minRepayment: 0, repaymentFrequency: 'MONTHLY', interestRateAnnual: 5 },
      { principal: 100000, minRepayment: 0, repaymentFrequency: 'MONTHLY', interestRateAnnual: 7 },
    ];
    const result = aggregateLoanRepaymentsDecimal(loans, 'monthly');
    // weightedRateSum = 100000*5 + 100000*7 = 1,200,000
    // totalPrincipal  = 200,000
    // weightedRate    = 6
    expect(result.weightedInterestRate.toString()).toBe('6');
  });
});

describe('cashflowOrchestrator Decimal — no mid-computation rounding', () => {
  it('values are not pre-rounded to 2 dp (Float path uses Math.round; Decimal preserves precision)', () => {
    // Inputs chosen to exercise non-clean division: WEEKLY → MONTHLY divides
    // by 12, so 250/week × 52 / 12 = 1083.333… with full precision.
    // MON-131 T1-B: income enters as banked totals from the ONE engine —
    // the Decimal banked path must preserve the recurring digits end-to-end.
    const rows: BankedIncomeRow[] = [
      { amount: 250, frequency: 'WEEKLY', type: 'OTHER', isTaxable: true },
    ];
    const result = calculateCashflowDecimal({
      incomeTotals: bankedTotalsFromResultDecimal(
        buildBankedIncomeDecimal({
          income: rows,
          properties: [],
          derivedAgentExpenses: [],
          transactions: [],
          ctx: { config: TAX_YEAR_2026_27, repaymentIncome: null },
        }),
      ),
      expenses: [],
      loans: [],
    });
    // 250 × 52 / 12 = 1083.333... — Decimal keeps the recurring digits.
    expect(result.monthlyGrossIncome.toDecimalPlaces(2).toString()).toBe('1083.33');
    // Confirm it's NOT pre-rounded by checking the full-precision tail.
    expect(result.monthlyGrossIncome.toString()).not.toBe('1083.33');
  });
});

// ---------------------------------------------------------------------------
// Aggregate report
// ---------------------------------------------------------------------------

describe('PR 2.B — full shadow report across all 4 engines', () => {
  it('every fixture across every engine PASSes', async () => {
    const report = await runShadowComparisonReport([...calculationsShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map(
          (r) =>
            `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`,
        )
        .join('\n');
      throw new Error(`PR 2.B shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
