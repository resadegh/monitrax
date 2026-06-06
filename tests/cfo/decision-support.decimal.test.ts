/**
 * Q-DEC PR 2.E.3 — Shadow + contract tests for `lib/cfo/decisionSupport/*`.
 *
 * Pure-math helpers across all 4 decision-support files:
 *   - propertyDecisionSupport.calculatePortfolioSummaryDecimal
 *   - loanDecisionSupport.{calculateMonthlyPayment, calculatePayoffMonths,
 *     calculateTotalInterest}Decimal
 *   - investmentDecisionSupport.{calculateDividendYield, calculateMaxConcentration}Decimal
 *   - taxIntegration.{calculateUnrealisedCGT, calculateNegativeGearingBenefit}Decimal
 */

import { describe, it, expect } from 'vitest';
import {
  propertyPortfolioSummaryShadow,
  monthlyPaymentShadow,
  payoffMonthsShadow,
  totalInterestShadow,
  dividendYieldShadow,
  maxConcentrationShadow,
  unrealisedCGTShadow,
  negativeGearingBenefitShadow,
  cfoDecisionSupportShadowEngines,
} from '@/lib/calc-audit/engines/decimal-cfo-decision-support';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';
import { calculatePortfolioSummaryDecimal } from '@/lib/cfo/decisionSupport/propertyDecisionSupport';
import {
  calculateMonthlyPaymentDecimal,
  calculatePayoffMonthsDecimal,
  calculateTotalInterestDecimal,
} from '@/lib/cfo/decisionSupport/loanDecisionSupport';
import {
  calculateDividendYieldDecimal,
  calculateMaxConcentrationDecimal,
} from '@/lib/cfo/decisionSupport/investmentDecisionSupport';
import {
  calculateUnrealisedCGTDecimal,
  calculateNegativeGearingBenefitDecimal,
} from '@/lib/cfo/decisionSupport/taxIntegration';

// ---------------------------------------------------------------------------
// Shadow sweeps
// ---------------------------------------------------------------------------

const ENGINES = [
  ['propertyPortfolioSummary', propertyPortfolioSummaryShadow] as const,
  ['monthlyPayment', monthlyPaymentShadow] as const,
  ['payoffMonths', payoffMonthsShadow] as const,
  ['totalInterest', totalInterestShadow] as const,
  ['dividendYield', dividendYieldShadow] as const,
  ['maxConcentration', maxConcentrationShadow] as const,
  ['unrealisedCGT', unrealisedCGTShadow] as const,
  ['negativeGearingBenefit', negativeGearingBenefitShadow] as const,
];

for (const [label, engine] of ENGINES) {
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

describe('calculatePortfolioSummaryDecimal — contract', () => {
  it('empty portfolio returns all zeros', () => {
    const r = calculatePortfolioSummaryDecimal([]);
    expect(r.totalProperties).toBe(0);
    expect(r.totalValue.toString()).toBe('0');
    expect(r.averageLVR.toString()).toBe('0');
  });

  it('LVR = totalLoan / totalValue × 100', () => {
    const r = calculatePortfolioSummaryDecimal([
      {
        id: 'p1',
        name: 'IP',
        currentValue: 1_000_000,
        purchasePrice: 800_000,
        loanBalance: 600_000,
        equity: 400_000,
        lvr: 60,
        annualRentalIncome: 0,
        rentalYield: 0,
        monthlyExpenses: 0,
        monthlyCashflow: 0,
        capitalGrowth: 200_000,
        capitalGrowthPercent: 25,
      },
    ]);
    expect(r.averageLVR.toString()).toBe('60');
  });

  it('annualRentalIncome / 12 aggregates correctly', () => {
    const r = calculatePortfolioSummaryDecimal([
      {
        id: 'p1',
        name: 'IP1',
        currentValue: 800_000,
        purchasePrice: 600_000,
        loanBalance: 400_000,
        equity: 400_000,
        lvr: 50,
        annualRentalIncome: 24_000,
        rentalYield: 3,
        monthlyExpenses: 0,
        monthlyCashflow: 0,
        capitalGrowth: 0,
        capitalGrowthPercent: 0,
      },
    ]);
    expect(r.totalMonthlyIncome.toString()).toBe('2000');
  });
});

describe('calculateMonthlyPaymentDecimal — contract', () => {
  it('zero rate + months > 0 → straight-line', () => {
    expect(calculateMonthlyPaymentDecimal(600_000, 0, 300).toString()).toBe('2000');
  });

  it('zero months → 0', () => {
    expect(calculateMonthlyPaymentDecimal(600_000, 0.065, 0).toString()).toBe('0');
  });

  it('agrees with Float on standard $500k @ 6.5% / 300 mo', () => {
    // Float: 500000 * (0.065/12) * (1+0.065/12)^300 / ((1+0.065/12)^300 - 1) ≈ $3,376.04
    const r = calculateMonthlyPaymentDecimal(500_000, 0.065, 300);
    expect(r.toDecimalPlaces(2).toString()).toBe('3376.04');
  });
});

describe('calculatePayoffMonthsDecimal — contract', () => {
  it('zero payment → 999', () => {
    expect(calculatePayoffMonthsDecimal(500_000, 0.065, 0)).toBe(999);
  });

  it('payment below interest → 999', () => {
    expect(calculatePayoffMonthsDecimal(500_000, 0.065, 2_700)).toBe(999);
  });

  it('aggressive paydown converges', () => {
    const r = calculatePayoffMonthsDecimal(500_000, 0.065, 5_000);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(200);
  });

  it('capped at 600', () => {
    // Tiny payment just above interest → many months but capped
    const r = calculatePayoffMonthsDecimal(500_000, 0.065, 2_710);
    expect(r).toBeLessThanOrEqual(600);
  });
});

describe('calculateTotalInterestDecimal — contract', () => {
  it('floors at 0 when payments × months < principal', () => {
    expect(calculateTotalInterestDecimal(500_000, 0.065, 1_000, 100).toString()).toBe('0');
  });

  it('standard term', () => {
    // 3400 × 360 = 1224000 − 500000 = 724000
    expect(calculateTotalInterestDecimal(500_000, 0.065, 3_400, 360).toString()).toBe('724000');
  });
});

describe('calculateDividendYieldDecimal — contract', () => {
  it('zero total value → 0', () => {
    expect(calculateDividendYieldDecimal([], 0).toString()).toBe('0');
  });

  it('all unfranked → 2.00%', () => {
    const r = calculateDividendYieldDecimal(
      [{ currentValue: 100_000, frankingPercentage: 0 }],
      100_000,
    );
    expect(r.toString()).toBe('2');
  });

  it('all franked → 4.00%', () => {
    const r = calculateDividendYieldDecimal(
      [{ currentValue: 100_000, frankingPercentage: 100 }],
      100_000,
    );
    expect(r.toString()).toBe('4');
  });

  it('60/40 split → 3.2%', () => {
    // 60k @ 4% = 2400, 40k @ 2% = 800, total 3200 / 100k = 3.2%
    const r = calculateDividendYieldDecimal(
      [
        { currentValue: 60_000, frankingPercentage: 100 },
        { currentValue: 40_000, frankingPercentage: null },
      ],
      100_000,
    );
    expect(r.toString()).toBe('3.2');
  });
});

describe('calculateMaxConcentrationDecimal — contract', () => {
  it('empty → 0', () => {
    expect(calculateMaxConcentrationDecimal([], 0).toString()).toBe('0');
  });

  it('balanced 4-pack → 25', () => {
    const r = calculateMaxConcentrationDecimal(
      [
        { currentValue: 25_000 },
        { currentValue: 25_000 },
        { currentValue: 25_000 },
        { currentValue: 25_000 },
      ],
      100_000,
    );
    expect(r.toString()).toBe('25');
  });

  it('max wins over later positions', () => {
    const r = calculateMaxConcentrationDecimal(
      [{ currentValue: 60_000 }, { currentValue: 30_000 }, { currentValue: 10_000 }],
      100_000,
    );
    expect(r.toString()).toBe('60');
  });
});

describe('calculateUnrealisedCGTDecimal — contract', () => {
  it('empty → 0', () => {
    expect(calculateUnrealisedCGTDecimal([]).toString()).toBe('0');
  });

  it('gain applies 50% discount', () => {
    // 100 × (80 − 50) = 3000; × 0.5 = 1500
    const r = calculateUnrealisedCGTDecimal([
      { units: 100, averagePrice: 50, currentPrice: 80 },
    ]);
    expect(r.toString()).toBe('1500');
  });

  it('loss excluded entirely', () => {
    const r = calculateUnrealisedCGTDecimal([
      { units: 100, averagePrice: 100, currentPrice: 50 }, // -5000
      { units: 100, averagePrice: 50, currentPrice: 80 }, // +3000 → +1500
    ]);
    expect(r.toString()).toBe('1500');
  });

  it('null currentPrice → no gain', () => {
    const r = calculateUnrealisedCGTDecimal([
      { units: 100, averagePrice: 50, currentPrice: null },
    ]);
    expect(r.toString()).toBe('0');
  });
});

describe('calculateNegativeGearingBenefitDecimal — contract', () => {
  it('empty → 0', () => {
    expect(calculateNegativeGearingBenefitDecimal([], 37).toString()).toBe('0');
  });

  it('OO property excluded', () => {
    const r = calculateNegativeGearingBenefitDecimal(
      [
        {
          type: 'OWNER_OCCUPIED',
          income: [],
          expenses: [{ amount: 1_000, frequency: 'MONTHLY' }],
          loans: [{ principal: 500_000, interestRateAnnual: 0.065 }],
        },
      ],
      37,
    );
    expect(r.toString()).toBe('0');
  });

  it('positively geared IP → 0 benefit', () => {
    const r = calculateNegativeGearingBenefitDecimal(
      [
        {
          type: 'INVESTMENT',
          income: [{ amount: 3_000, frequency: 'MONTHLY' }],
          expenses: [{ amount: 500, frequency: 'MONTHLY' }],
          loans: [{ principal: 200_000, interestRateAnnual: 0.05 }],
        },
      ],
      45,
    );
    expect(r.toString()).toBe('0');
  });

  it('negatively geared IP at 37% marginal rate', () => {
    // Annual income: 2000 × 12 = 24000
    // Annual expenses: 800 × 12 = 9600
    // Loan interest: 400000 × 0.06 = 24000
    // Net: 24000 − 9600 − 24000 = −9600 → benefit = 9600 × 0.37 = 3552
    const r = calculateNegativeGearingBenefitDecimal(
      [
        {
          type: 'INVESTMENT',
          income: [{ amount: 2_000, frequency: 'MONTHLY' }],
          expenses: [{ amount: 800, frequency: 'MONTHLY' }],
          loans: [{ principal: 400_000, interestRateAnnual: 0.06 }],
        },
      ],
      37,
    );
    expect(r.toString()).toBe('3552');
  });
});

// ---------------------------------------------------------------------------
// Aggregate shadow report
// ---------------------------------------------------------------------------

describe('PR 2.E.3 — full shadow report', () => {
  it('every fixture across 8 decision-support engines PASSes', async () => {
    const report = await runShadowComparisonReport([...cfoDecisionSupportShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map((r) => `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`)
        .join('\n');
      throw new Error(`PR 2.E.3 shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
