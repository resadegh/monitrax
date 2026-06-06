/**
 * Q-DEC PR 2.E.1 — Shadow + contract tests for `lib/cfo/scenarios/*`.
 *
 * Covers the 6 deterministic scenario engines + their 3 supporting
 * `lib/utils/calculations.ts` primitive Decimal siblings. These are the
 * Phase 45 What-If critical path: every lever the UI exposes runs through
 * one of these engines, and the 10-year projection composer (Phase 45
 * PR 1) consumes the Decimal outputs.
 */

import { describe, it, expect } from 'vitest';
import {
  refinanceLoanShadow,
  payDownLoanShadow,
  redirectToOffsetShadow,
  sellPropertyShadow,
  cutSpendCategoryShadow,
  addInvestmentShadow,
  cfoScenarioShadowEngines,
} from '@/lib/calc-audit/engines/decimal-cfo-scenarios';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';
import {
  calculatePIRepayment,
  calculatePIRepaymentDecimal,
  calculateInterestForPeriod,
  calculateInterestForPeriodDecimal,
  calculateEffectivePrincipal,
  calculateEffectivePrincipalDecimal,
} from '@/lib/utils/calculations';
import { refinanceLoanScenarioDecimal } from '@/lib/cfo/scenarios/refinanceLoan';
import { payDownLoanScenarioDecimal } from '@/lib/cfo/scenarios/payDownLoan';
import { redirectToOffsetScenarioDecimal } from '@/lib/cfo/scenarios/redirectToOffset';
import { sellPropertyScenarioDecimal } from '@/lib/cfo/scenarios/sellProperty';
import { cutSpendCategoryScenarioDecimal } from '@/lib/cfo/scenarios/cutSpendCategory';
import { addInvestmentScenarioDecimal } from '@/lib/cfo/scenarios/addInvestment';
import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';

// ---------------------------------------------------------------------------
// Minimal snapshot helper (mirrors the shadow file's)
// ---------------------------------------------------------------------------

function makeMinimalSnapshot(partial: Partial<{
  monthlyCashflow: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyLoanRepayments: number;
  savingsRate: number;
  liquidCash: number;
  netWorth: number;
  propertyPortfolioValue: number;
  investmentsTotal: number;
  emergencyMonthsCovered: number;
}> = {}): MasterFinancialSnapshot {
  const liquidCash = partial.liquidCash ?? 0;
  const monthlyExpenses = partial.monthlyExpenses ?? 0;
  return {
    quickMetrics: {
      monthlyIncome: partial.monthlyIncome ?? 0,
      monthlyGrossIncome: 0,
      monthlyExpenses,
      monthlyCashflow: partial.monthlyCashflow ?? 0,
      monthlyLoanRepayments: partial.monthlyLoanRepayments ?? 0,
      totalAssets: 0,
      totalLiabilities: 0,
      netWorthValue: partial.netWorth ?? 0,
      savingsRate: partial.savingsRate ?? 0,
      liquidCash,
      keptAfterEssentials: 0,
      keptMargin: 0,
      freeCashDays: 0,
    },
    netWorth: { netWorth: partial.netWorth ?? 0 } as MasterFinancialSnapshot['netWorth'],
    propertyPortfolioValue: partial.propertyPortfolioValue ?? 0,
    properties: [],
    investments: {
      totalValue: partial.investmentsTotal ?? 0,
      totalCostBase: 0,
      unrealisedGain: 0,
      unrealisedGainPercent: 0,
      holdingsCount: 0,
      byType: {},
    },
    emergencyFund: {
      liquidCash,
      monthlyExpenses,
      monthsCovered: partial.emergencyMonthsCovered ?? 0,
      targetMonths: 3,
      gap: 0,
      status: 'good',
    },
    expenses: {
      monthly: { total: monthlyExpenses, byCategory: [] } as unknown as MasterFinancialSnapshot['expenses']['monthly'],
      annual: { total: 0, byCategory: [] } as unknown as MasterFinancialSnapshot['expenses']['annual'],
    },
  } as MasterFinancialSnapshot;
}

// ---------------------------------------------------------------------------
// Primitive Decimal siblings — contract
// ---------------------------------------------------------------------------

describe('Decimal sibling primitives', () => {
  it('calculateEffectivePrincipalDecimal floors at 0', () => {
    expect(calculateEffectivePrincipalDecimal(500_000, 600_000).toString()).toBe('0');
    expect(calculateEffectivePrincipalDecimal(500_000, 100_000).toString()).toBe('400000');
  });

  it('calculateInterestForPeriodDecimal: monthly interest at 6.5%', () => {
    // 500_000 × 0.065 / 12 = 2708.333...
    const r = calculateInterestForPeriodDecimal(500_000, 0.065, 12);
    expect(r.toDecimalPlaces(4).toString()).toBe('2708.3333');
  });

  it('calculateInterestForPeriodDecimal: zero periodsPerYear guards', () => {
    expect(calculateInterestForPeriodDecimal(500_000, 0.065, 0).toString()).toBe('0');
  });

  it('calculatePIRepaymentDecimal: $500k @ 6.5% over 300 months ≈ Float result', () => {
    const float = calculatePIRepayment(500_000, 0.065, 300);
    const decimal = calculatePIRepaymentDecimal(500_000, 0.065, 300);
    expect(Math.abs(decimal.toNumber() - float)).toBeLessThan(0.005);
  });

  it('calculatePIRepaymentDecimal: zero rate falls back to straight-line', () => {
    // 600_000 / 300 = 2000
    expect(calculatePIRepaymentDecimal(600_000, 0, 300).toString()).toBe('2000');
  });

  it('calculatePIRepaymentDecimal: zero term floors at max(1, term)', () => {
    // termMonths=0 → principal / 1 = principal
    expect(calculatePIRepaymentDecimal(500_000, 0.065, 0).toString()).toBe('500000');
  });
});

// ---------------------------------------------------------------------------
// Shadow tests — one describe per engine
// ---------------------------------------------------------------------------

const ENGINES_SHADOW = [
  ['refinanceLoan', refinanceLoanShadow] as const,
  ['payDownLoan', payDownLoanShadow] as const,
  ['redirectToOffset', redirectToOffsetShadow] as const,
  ['sellProperty', sellPropertyShadow] as const,
  ['cutSpendCategory', cutSpendCategoryShadow] as const,
  ['addInvestment', addInvestmentShadow] as const,
];

for (const [label, engine] of ENGINES_SHADOW) {
  describe(`${label} — Float vs Decimal shadow`, () => {
    it.each(engine.fixtures.map((f) => [f.name, f] as const))(
      'fixture %s — paths agree within tolerance',
      async (_name, fixture) => {
        const result = await runShadowComparison(engine, fixture);
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
}

// ---------------------------------------------------------------------------
// Contract tests
// ---------------------------------------------------------------------------

describe('refinanceLoanScenarioDecimal — contract', () => {
  const loan = {
    id: 'loan-1',
    name: 'Test Loan',
    principal: 500_000,
    interestRate: 0.065,
    termMonths: 360,
    remainingMonths: 300,
    monthlyRepayment: 3_400,
    loanType: 'VARIABLE_PI',
    offsetBalance: 0,
  };

  it('positive savings produces 3 impacts with Decimal types', () => {
    const r = refinanceLoanScenarioDecimal(
      { snapshot: makeMinimalSnapshot({ monthlyCashflow: 1_500 }), loans: [loan] },
      { loanId: 'loan-1', newRate: 0.055 },
    );
    expect(r.impacts.length).toBe(3);
    expect(r.impacts[0]!.before instanceof Decimal).toBe(true);
    expect(r.impacts[0]!.delta.lt(0)).toBe(true); // repayment decreases (delta = -savings)
    expect(r.impacts[1]!.delta.gt(0)).toBe(true); // cashflow increases
  });

  it('loan not found returns empty impacts + critical warning', () => {
    const r = refinanceLoanScenarioDecimal(
      { snapshot: makeMinimalSnapshot(), loans: [loan] },
      { loanId: 'missing', newRate: 0.055 },
    );
    expect(r.impacts.length).toBe(0);
    expect(r.warnings.some((w) => w.severity === 'critical')).toBe(true);
  });
});

describe('payDownLoanScenarioDecimal — contract', () => {
  const loan = {
    id: 'loan-1',
    name: 'Test Loan',
    principal: 500_000,
    interestRate: 0.065,
    termMonths: 360,
    remainingMonths: 300,
    monthlyRepayment: 3_400,
    loanType: 'VARIABLE_PI',
    offsetBalance: 0,
  };

  it('extra repayments reduce both lifetime interest and months', () => {
    const r = payDownLoanScenarioDecimal(
      { snapshot: makeMinimalSnapshot({ monthlyCashflow: 2_000 }), loans: [loan] },
      { loanId: 'loan-1', extraMonthly: 200 },
    );
    // impacts[0] = interest saved (delta < 0 means saved)
    expect(r.impacts[0]!.delta.lt(0)).toBe(true);
    // impacts[1] = months reduced (delta < 0 = fewer months)
    expect(r.impacts[1]!.delta.lt(0)).toBe(true);
    // impacts[2] = monthly cashflow (delta = −extra, negative)
    expect(r.impacts[2]!.delta.equals(-200)).toBe(true);
  });

  it('extra payment exceeding cashflow surfaces caution', () => {
    const r = payDownLoanScenarioDecimal(
      { snapshot: makeMinimalSnapshot({ monthlyCashflow: 100 }), loans: [loan] },
      { loanId: 'loan-1', extraMonthly: 500 },
    );
    expect(r.warnings.some((w) => w.severity === 'caution' && /deficit/.test(w.message))).toBe(true);
  });
});

describe('redirectToOffsetScenarioDecimal — contract', () => {
  const loan = {
    id: 'loan-1',
    name: 'Test Loan',
    principal: 500_000,
    interestRate: 0.065,
    termMonths: 360,
    remainingMonths: 300,
    monthlyRepayment: 3_400,
    loanType: 'VARIABLE_PI',
    offsetBalance: 0,
  };

  it('parking cash produces monthly + annual savings, liquid unchanged', () => {
    const r = redirectToOffsetScenarioDecimal(
      { snapshot: makeMinimalSnapshot({ liquidCash: 100_000 }), loans: [loan] },
      { loanId: 'loan-1', amount: 50_000 },
    );
    // 50_000 × 0.065 / 12 = 270.833...
    expect(r.impacts[0]!.after.toDecimalPlaces(2).toString()).toBe('270.83');
    // annual = monthly × 12
    expect(r.impacts[1]!.after.equals(r.impacts[0]!.after.times(12))).toBe(true);
    expect(r.impacts[2]!.delta.equals(0)).toBe(true);
  });

  it('fully offset loan → zero saving + caution', () => {
    const r = redirectToOffsetScenarioDecimal(
      { snapshot: makeMinimalSnapshot({ liquidCash: 100_000 }), loans: [{ ...loan, offsetBalance: 500_000 }] },
      { loanId: 'loan-1', amount: 10_000 },
    );
    expect(r.impacts[0]!.after.toString()).toBe('0');
    expect(r.warnings.some((w) => /fully offset/.test(w.message))).toBe(true);
  });
});

describe('sellPropertyScenarioDecimal — contract', () => {
  function snapshotWithProp(monthlyCashflow: number, equity: number) {
    const s = makeMinimalSnapshot({
      monthlyCashflow: 2_000,
      liquidCash: 50_000,
      netWorth: 400_000,
      propertyPortfolioValue: 800_000,
    });
    return {
      ...s,
      properties: [
        {
          id: 'prop-1',
          name: 'Test IP',
          currentValue: 800_000,
          purchasePrice: 0,
          loanBalance: 800_000 - equity,
          equity,
          lvr: 0,
          annualRentalIncome: 0,
          rentalYield: 0,
          monthlyExpenses: 0,
          monthlyCashflow,
          capitalGrowth: 0,
          capitalGrowthPercent: 0,
        },
      ],
    } as MasterFinancialSnapshot;
  }

  it('positive-equity sale produces positive netCashFreed', () => {
    const r = sellPropertyScenarioDecimal({ snapshot: snapshotWithProp(0, 300_000) }, { propertyId: 'prop-1' });
    // 800k − 800k × 0.025 − 500k = 280k freed
    expect(r.impacts[0]!.delta.toString()).toBe('280000');
  });

  it('negative-equity sale surfaces critical warning', () => {
    const r = sellPropertyScenarioDecimal({ snapshot: snapshotWithProp(-200, -100_000) }, { propertyId: 'prop-1' });
    expect(r.warnings.some((w) => w.severity === 'critical' && /negative equity/.test(w.message))).toBe(true);
  });

  it('CGT caution always present', () => {
    const r = sellPropertyScenarioDecimal({ snapshot: snapshotWithProp(0, 300_000) }, { propertyId: 'prop-1' });
    expect(r.warnings.some((w) => /Capital Gains Tax/.test(w.message))).toBe(true);
  });
});

describe('cutSpendCategoryScenarioDecimal — contract', () => {
  function snapshotWithCategory(category: string, amount: number) {
    const s = makeMinimalSnapshot({
      monthlyIncome: 7_000,
      monthlyExpenses: 4_500,
      monthlyCashflow: 1_000,
      monthlyLoanRepayments: 1_500,
      savingsRate: 14.3,
      liquidCash: 15_000,
      emergencyMonthsCovered: 3.3,
    });
    return {
      ...s,
      expenses: {
        ...s.expenses,
        monthly: {
          ...s.expenses.monthly,
          byCategory: [{ category, amount } as { category: string; amount: number }],
        },
      } as MasterFinancialSnapshot['expenses'],
    } as MasterFinancialSnapshot;
  }

  it('cut within spend produces realised reduction = requested', () => {
    const r = cutSpendCategoryScenarioDecimal(
      { snapshot: snapshotWithCategory('Dining', 400) },
      { category: 'Dining', monthlyReduction: 200 },
    );
    expect(r.impacts[0]!.delta.toString()).toBe('200'); // cashflow up $200
    expect(r.impacts[1]!.delta.toString()).toBe('2400'); // annual = 200 × 12
  });

  it('cut exceeding spend caps at actual spend + info warning', () => {
    const r = cutSpendCategoryScenarioDecimal(
      { snapshot: snapshotWithCategory('Dining', 400) },
      { category: 'Dining', monthlyReduction: 500 },
    );
    // Realised = min(500, 400) = 400 → cashflow delta = 400
    expect(r.impacts[0]!.delta.toString()).toBe('400');
    expect(r.warnings.some((w) => w.severity === 'info' && /Capped/.test(w.message))).toBe(true);
  });

  it('category not found surfaces caution', () => {
    const r = cutSpendCategoryScenarioDecimal(
      { snapshot: snapshotWithCategory('Dining', 400) },
      { category: 'Crypto', monthlyReduction: 200 },
    );
    expect(r.warnings.some((w) => /No recorded spending/.test(w.message))).toBe(true);
    expect(r.impacts[0]!.delta.toString()).toBe('0');
  });

  it('zero income guards savings-rate divide-by-zero', () => {
    const s = makeMinimalSnapshot({
      monthlyIncome: 0,
      monthlyExpenses: 2_000,
      monthlyLoanRepayments: 0,
      savingsRate: 0,
      liquidCash: 5_000,
      emergencyMonthsCovered: 2.5,
    });
    const withCat = {
      ...s,
      expenses: {
        ...s.expenses,
        monthly: {
          ...s.expenses.monthly,
          byCategory: [{ category: 'Groceries', amount: 800 }],
        },
      } as MasterFinancialSnapshot['expenses'],
    } as MasterFinancialSnapshot;
    const r = cutSpendCategoryScenarioDecimal(
      { snapshot: withCat },
      { category: 'Groceries', monthlyReduction: 100 },
    );
    expect(r.impacts[2]!.after.toString()).toBe('0'); // savings rate stays 0
  });
});

describe('addInvestmentScenarioDecimal — contract', () => {
  it('zero return falls back to amount × months', () => {
    const r = addInvestmentScenarioDecimal(
      { snapshot: makeMinimalSnapshot({ monthlyCashflow: 1_500, emergencyMonthsCovered: 3 }) },
      { monthlyAmount: 500, expectedAnnualReturn: 0, years: 5 },
    );
    // 500 × 60 = 30000; growth = 0
    expect(r.impacts[1]!.after.toString()).toBe('0');
  });

  it('compound growth at 7% / 10y exceeds contributions', () => {
    const r = addInvestmentScenarioDecimal(
      { snapshot: makeMinimalSnapshot({ monthlyCashflow: 1_500, emergencyMonthsCovered: 3 }) },
      { monthlyAmount: 500 },
    );
    // 500/mo × 120 months = $60k contributions
    // FV @ 7% should be ~ $86.5k → growth ~ $26.5k
    expect(r.impacts[1]!.after.gt(20_000)).toBe(true);
    expect(r.impacts[1]!.after.lt(35_000)).toBe(true);
  });

  it('low emergency fund surfaces TRAIL Anchor caution', () => {
    const r = addInvestmentScenarioDecimal(
      { snapshot: makeMinimalSnapshot({ monthlyCashflow: 1_500, emergencyMonthsCovered: 1.5 }) },
      { monthlyAmount: 500 },
    );
    expect(r.warnings.some((w) => /TRAIL framework/.test(w.message))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Aggregate shadow report
// ---------------------------------------------------------------------------

describe('PR 2.E.1 — full shadow report', () => {
  it('every fixture across all 6 scenarios PASSes', async () => {
    const report = await runShadowComparisonReport([...cfoScenarioShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map((r) => `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`)
        .join('\n');
      throw new Error(`PR 2.E.1 shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
