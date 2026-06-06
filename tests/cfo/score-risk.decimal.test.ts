/**
 * Q-DEC PR 2.E.2 — Shadow + contract tests for `scoreCalculator` + `riskRadar` summary.
 *
 * scoreCalculator: 6 component sub-scores (cashflow strength / debt coverage /
 * emergency buffer / investment diversification / spending control / savings
 * rate) + the weighted-overall composer.
 *
 * riskRadar: summary aggregator (counts + totalImpact + topRisk).
 */

import { describe, it, expect } from 'vitest';
import {
  cashflowStrengthShadow,
  debtCoverageShadow,
  emergencyBufferShadow,
  investmentDiversificationShadow,
  spendingControlShadow,
  savingsRateShadow,
  overallScoreShadow,
  riskSummaryShadow,
  cfoScoreRiskShadowEngines,
} from '@/lib/calc-audit/engines/decimal-cfo-score-risk';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';
import {
  calculateCashflowStrengthDecimal,
  calculateDebtCoverageDecimal,
  calculateEmergencyBufferDecimal,
  calculateInvestmentDiversificationDecimal,
  calculateSpendingControlDecimal,
  calculateSavingsRateDecimal,
  calculateComponentsDecimal,
  calculateOverallScoreDecimal,
} from '@/lib/cfo/scoreCalculator';
import { calculateSummaryDecimal } from '@/lib/cfo/riskRadar';
import { Frequency, RepaymentFrequency } from '@/lib/types/prisma-enums';
import type { FinancialRisk } from '@/lib/cfo/types';

// ---------------------------------------------------------------------------
// Shadow sweeps
// ---------------------------------------------------------------------------

const ENGINES = [
  ['cashflowStrength', cashflowStrengthShadow] as const,
  ['debtCoverage', debtCoverageShadow] as const,
  ['emergencyBuffer', emergencyBufferShadow] as const,
  ['investmentDiversification', investmentDiversificationShadow] as const,
  ['spendingControl', spendingControlShadow] as const,
  ['savingsRate', savingsRateShadow] as const,
  ['overallScore', overallScoreShadow] as const,
  ['riskSummary', riskSummaryShadow] as const,
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

const monthly = (amount: number, isEssential = true) => ({
  id: 'e' + amount + (isEssential ? 'E' : 'D'),
  amount,
  frequency: 'MONTHLY' as Frequency,
  isEssential,
});
const monthlyIncome = (amount: number) => ({
  id: 'i' + amount,
  amount,
  frequency: 'MONTHLY' as Frequency,
});
const monthlyLoan = (principal: number, repayment: number) => ({
  id: 'l' + principal,
  principal,
  interestRateAnnual: 0.06,
  minRepayment: repayment,
  repaymentFrequency: 'MONTHLY' as RepaymentFrequency,
});

describe('cashflowStrengthDecimal — contract', () => {
  it('strong surplus → 100', () => {
    const r = calculateCashflowStrengthDecimal(
      [monthlyIncome(10_000)],
      [monthly(2_000), monthly(1_000, false)],
      [],
    );
    expect(r.toString()).toBe('100');
  });

  it('zero income returns exact 0 (divide-by-zero guard)', () => {
    const r = calculateCashflowStrengthDecimal([], [monthly(1_000)], []);
    expect(r.toString()).toBe('0');
  });

  it('break-even returns exact 50', () => {
    const r = calculateCashflowStrengthDecimal(
      [monthlyIncome(5_000)],
      [monthly(3_000), monthly(2_000, false)],
      [],
    );
    expect(r.toString()).toBe('50');
  });
});

describe('debtCoverageDecimal — contract', () => {
  it('no loans → 100', () => {
    const r = calculateDebtCoverageDecimal([monthlyIncome(10_000)], []);
    expect(r.toString()).toBe('100');
  });

  it('zero income, zero loan → 100 (debt-free special)', () => {
    const r = calculateDebtCoverageDecimal([], []);
    expect(r.toString()).toBe('100');
  });

  it('zero income with loan → 0', () => {
    const r = calculateDebtCoverageDecimal([], [monthlyLoan(100_000, 500)]);
    expect(r.toString()).toBe('0');
  });

  it('DSR > 60% → 0 floor', () => {
    const r = calculateDebtCoverageDecimal(
      [monthlyIncome(5_000)],
      [monthlyLoan(500_000, 3_500)],
    );
    expect(r.toString()).toBe('0');
  });
});

describe('emergencyBufferDecimal — contract', () => {
  it('6+ months → 100', () => {
    const r = calculateEmergencyBufferDecimal(
      [{ id: 'a1', currentBalance: 18_000, type: 'SAVINGS' }],
      [monthly(2_000)],
    );
    expect(r.toString()).toBe('100');
  });

  it('non-liquid account excluded', () => {
    const r = calculateEmergencyBufferDecimal(
      [{ id: 'a1', currentBalance: 100_000, type: 'INVESTMENT' }],
      [monthly(2_000)],
    );
    // 0 liquid / 2000 essential → 0 covered → 0 * 40 = 0
    expect(r.toString()).toBe('0');
  });

  it('no essential expenses + has liquid → 100', () => {
    const r = calculateEmergencyBufferDecimal(
      [{ id: 'a1', currentBalance: 5_000, type: 'SAVINGS' }],
      [monthly(500, false)],
    );
    expect(r.toString()).toBe('100');
  });

  it('no essential expenses + no liquid → 50', () => {
    const r = calculateEmergencyBufferDecimal([], [monthly(500, false)]);
    expect(r.toString()).toBe('50');
  });
});

describe('investmentDiversificationDecimal — contract', () => {
  it('no investments → 50', () => {
    expect(calculateInvestmentDiversificationDecimal([], []).toString()).toBe('50');
  });

  it('property-only single class → low diversification', () => {
    const r = calculateInvestmentDiversificationDecimal(
      [],
      [{ id: 'p1', currentValue: 500_000, type: 'INVESTMENT' }],
    );
    // 1 asset class × 10 = 10 + balanceScore 0 (max 100% > 0.8) + penalty 0 = 10
    expect(r.toString()).toBe('10');
  });
});

describe('spendingControlDecimal — contract', () => {
  it('no discretionary → 100', () => {
    expect(
      calculateSpendingControlDecimal(
        [monthlyIncome(7_000)],
        [monthly(3_000)],
      ).toString(),
    ).toBe('100');
  });

  it('zero income + zero discretionary → 100', () => {
    expect(calculateSpendingControlDecimal([], [monthly(1_000)]).toString()).toBe('100');
  });

  it('zero income + discretionary → 0', () => {
    expect(
      calculateSpendingControlDecimal([], [monthly(1_000), monthly(500, false)]).toString(),
    ).toBe('0');
  });
});

describe('savingsRateDecimal — contract', () => {
  it('30%+ savings → 100', () => {
    expect(
      calculateSavingsRateDecimal(
        [monthlyIncome(10_000)],
        [monthly(3_000), monthly(1_000, false)],
        [],
      ).toString(),
    ).toBe('100');
  });

  it('negative savings → 0', () => {
    expect(
      calculateSavingsRateDecimal(
        [monthlyIncome(5_000)],
        [monthly(4_000), monthly(1_500, false)],
        [],
      ).toString(),
    ).toBe('0');
  });

  it('zero income → 0', () => {
    expect(calculateSavingsRateDecimal([], [monthly(1_000)], []).toString()).toBe('0');
  });

  it('loan repayments reduce savings rate', () => {
    const withoutLoan = calculateSavingsRateDecimal(
      [monthlyIncome(8_000)],
      [monthly(3_000), monthly(1_500, false)],
      [],
    );
    const withLoan = calculateSavingsRateDecimal(
      [monthlyIncome(8_000)],
      [monthly(3_000), monthly(1_500, false)],
      [monthlyLoan(300_000, 1_500)],
    );
    expect(withoutLoan.gt(withLoan)).toBe(true);
  });
});

describe('calculateComponentsDecimal — composer', () => {
  it('returns all 6 component sub-scores as Decimal', () => {
    const r = calculateComponentsDecimal(
      [{ id: 'a1', currentBalance: 10_000, type: 'SAVINGS' }],
      [monthlyLoan(200_000, 1_200)],
      [monthlyIncome(8_000)],
      [monthly(2_500), monthly(1_500, false)],
      [],
      [],
    );
    expect(r.cashflowStrength instanceof Decimal).toBe(true);
    expect(r.debtCoverage instanceof Decimal).toBe(true);
    expect(r.emergencyBuffer instanceof Decimal).toBe(true);
    expect(r.investmentDiversification instanceof Decimal).toBe(true);
    expect(r.spendingControl instanceof Decimal).toBe(true);
    expect(r.savingsRate instanceof Decimal).toBe(true);
  });
});

describe('calculateOverallScoreDecimal — weighted composer', () => {
  it('all 100s → 100', () => {
    const r = calculateOverallScoreDecimal({
      cashflowStrength: new Decimal(100),
      debtCoverage: new Decimal(100),
      emergencyBuffer: new Decimal(100),
      investmentDiversification: new Decimal(100),
      spendingControl: new Decimal(100),
      savingsRate: new Decimal(100),
    });
    expect(r.toString()).toBe('100');
  });

  it('weights sum to 1 — mid-bracket case', () => {
    // 73*0.25 + 65*0.20 + 82*0.15 + 60*0.15 + 71*0.15 + 50*0.10 = 18.25 + 13 + 12.3 + 9 + 10.65 + 5 = 68.2
    const r = calculateOverallScoreDecimal({
      cashflowStrength: new Decimal(73),
      debtCoverage: new Decimal(65),
      emergencyBuffer: new Decimal(82),
      investmentDiversification: new Decimal(60),
      spendingControl: new Decimal(71),
      savingsRate: new Decimal(50),
    });
    expect(r.toDecimalPlaces(2).toString()).toBe('68.2');
  });
});

describe('calculateSummaryDecimal — riskRadar', () => {
  function buildRisk(severity: 'critical' | 'high' | 'medium' | 'low', impact: number): FinancialRisk {
    return {
      id: 'r-' + Math.random(),
      type: 'low_balance',
      severity,
      timeframe: 'short',
      title: 'test',
      description: 'test',
      impact,
      probability: 0.5,
      detectedAt: new Date(),
      relatedEntities: [],
      suggestedActions: [],
    };
  }

  it('empty risks → zero counts + zero totalImpact', () => {
    const r = calculateSummaryDecimal([]);
    expect(r.critical).toBe(0);
    expect(r.totalImpact.toString()).toBe('0');
    expect(r.topRisk).toBeNull();
  });

  it('mixed severities counted correctly', () => {
    const r = calculateSummaryDecimal([
      buildRisk('critical', 5_000),
      buildRisk('high', 3_000),
      buildRisk('high', 2_000),
      buildRisk('medium', 1_000),
      buildRisk('low', 100),
    ]);
    expect(r.critical).toBe(1);
    expect(r.high).toBe(2);
    expect(r.medium).toBe(1);
    expect(r.low).toBe(1);
    expect(r.totalImpact.toString()).toBe('11100');
  });

  it('Decimal accumulator stays exact for many small impacts', () => {
    // 10 risks at $123.45 each = $1,234.50 — Float `0.1+0.2 !== 0.3` drift category.
    const risks = Array.from({ length: 10 }, () => buildRisk('medium', 123.45));
    const r = calculateSummaryDecimal(risks);
    expect(r.totalImpact.toString()).toBe('1234.5');
  });

  it('first risk preserved as topRisk', () => {
    const r1 = buildRisk('critical', 5_000);
    const r2 = buildRisk('high', 3_000);
    expect(calculateSummaryDecimal([r1, r2]).topRisk).toBe(r1);
  });
});

// ---------------------------------------------------------------------------
// Aggregate shadow report
// ---------------------------------------------------------------------------

describe('PR 2.E.2 — full shadow report', () => {
  it('every fixture across 8 shadow engines PASSes', async () => {
    const report = await runShadowComparisonReport([...cfoScoreRiskShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map((r) => `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`)
        .join('\n');
      throw new Error(`PR 2.E.2 shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
