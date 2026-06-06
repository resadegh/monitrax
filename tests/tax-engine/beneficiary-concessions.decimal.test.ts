/**
 * Q-DEC PR 2.D.3c2 — Shadow + contract tests for beneficiary allocation
 * + business concessions (trustDistribution, div7a, div152).
 */

import { describe, it, expect } from 'vitest';
import {
  trustDistributionShadow,
  div7aLoanShadow,
  div152Shadow,
  taxEngineBeneficiaryConcessionsShadowEngines,
} from '@/lib/calc-audit/engines/decimal-tax-engine-beneficiary-concessions';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';
import { allocateTrustDistributionDecimal } from '@/lib/tax-engine/divisions/trustDistribution';
import {
  classifyDiv7ALoansDecimal,
  calculateMinimumYearlyRepaymentDecimal,
} from '@/lib/tax-engine/divisions/div7aLoanClassifier';
import { applyDiv152Decimal } from '@/lib/tax-engine/divisions/div152SmallBusinessConcessions';

describe('trustDistribution — Float vs Decimal shadow', () => {
  it.each(trustDistributionShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(trustDistributionShadow, fixture);
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

describe('div7a — Float vs Decimal shadow', () => {
  it.each(div7aLoanShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(div7aLoanShadow, fixture);
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

describe('div152 — Float vs Decimal shadow', () => {
  it.each(div152Shadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(div152Shadow, fixture);
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

describe('trustDistributionDecimal contracts', () => {
  it('single beneficiary 100% → trustee retained 0', () => {
    const r = allocateTrustDistributionDecimal({
      trustNetIncome: 100_000,
      beneficiaries: [{ id: 'b1', name: 'Alice', presentlyEntitledShare: 1 }],
    });
    expect(r.distributions[0].amount.toString()).toBe('100000');
    expect(r.trusteeRetainedAmount.toString()).toBe('0');
    expect(r.trusteePenaltyTax.toString()).toBe('0');
  });

  it('partial distribution triggers s99A penalty', () => {
    const r = allocateTrustDistributionDecimal({
      trustNetIncome: 100_000,
      beneficiaries: [
        { id: 'b1', name: 'Alice', presentlyEntitledShare: 0.5 },
        { id: 'b2', name: 'Bob', presentlyEntitledShare: 0.2 },
      ],
    });
    expect(r.trusteeRetainedAmount.toString()).toBe('30000');
    // 30000 × 0.47 = 14100
    expect(r.trusteePenaltyTax.toString()).toBe('14100');
  });

  it('negative share throws', () => {
    expect(() => {
      allocateTrustDistributionDecimal({
        trustNetIncome: 100_000,
        beneficiaries: [{ id: 'b1', name: 'Bad', presentlyEntitledShare: -0.1 }],
      });
    }).toThrow(/negative share/);
  });

  it('over-distribution throws (totalShare > 1.0 + 1e-9)', () => {
    expect(() => {
      allocateTrustDistributionDecimal({
        trustNetIncome: 100_000,
        beneficiaries: [
          { id: 'b1', name: 'Alice', presentlyEntitledShare: 0.6 },
          { id: 'b2', name: 'Bob', presentlyEntitledShare: 0.6 },
        ],
      });
    }).toThrow(/over-distribution/);
  });

  it('character pools pro-rata distribution when no streaming', () => {
    const r = allocateTrustDistributionDecimal({
      trustNetIncome: 100_000,
      beneficiaries: [
        { id: 'b1', name: 'Alice', presentlyEntitledShare: 0.6 },
        { id: 'b2', name: 'Bob', presentlyEntitledShare: 0.4 },
      ],
      characterPools: { frankedDividends: 20_000, capitalGains: 10_000 },
    });
    // Pro-rata: Alice gets 60% of each pool, Bob 40%.
    expect(r.distributions[0].character.frankedDividends.toString()).toBe('12000');
    expect(r.distributions[0].character.capitalGains.toString()).toBe('6000');
    expect(r.distributions[1].character.frankedDividends.toString()).toBe('8000');
    expect(r.distributions[1].character.capitalGains.toString()).toBe('4000');
  });
});

describe('div7a Decimal contracts', () => {
  it('MRP formula exact: $50k @ 8% over 7 years', () => {
    const mrp = calculateMinimumYearlyRepaymentDecimal(50_000, 7, 0.08);
    // 50000 × (0.08 × 1.08^7) / (1.08^7 − 1) ≈ 9603.62 (verified against
    // the Float path; both stay in agreement to within currency tolerance).
    expect(mrp.toDecimalPlaces(2).toNumber()).toBeCloseTo(9603.62, 1);
  });

  it('MRP zero-rate degenerate case = balance / years', () => {
    const mrp = calculateMinimumYearlyRepaymentDecimal(70_000, 7, 0);
    expect(mrp.toString()).toBe('10000');
  });

  it('MRP zero balance → 0', () => {
    expect(calculateMinimumYearlyRepaymentDecimal(0, 7, 0.08).toString()).toBe('0');
  });

  it('MRP zero years → 0', () => {
    expect(calculateMinimumYearlyRepaymentDecimal(50_000, 0, 0.08).toString()).toBe('0');
  });

  it('no agreement → full balance deemed dividend', () => {
    const r = classifyDiv7ALoansDecimal([
      { loanId: 'l1', openingBalance: 50_000, yearsRemaining: 5, benchmarkRate: 0.0837, paymentsMadeThisFy: 0, hasComplianceAgreement: false },
    ]);
    expect(r.classifications[0].status).toBe('NO_AGREEMENT');
    expect(r.classifications[0].deemedDividendAmount.toString()).toBe('50000');
    expect(r.totalDeemedDividend.toString()).toBe('50000');
  });

  it('surplus cap prorates deemed-dividend exposure to cap', () => {
    const r = classifyDiv7ALoansDecimal(
      [
        { loanId: 'l1', openingBalance: 50_000, yearsRemaining: 5, benchmarkRate: 0.0837, paymentsMadeThisFy: 0, hasComplianceAgreement: false },
        { loanId: 'l2', openingBalance: 50_000, yearsRemaining: 5, benchmarkRate: 0.0837, paymentsMadeThisFy: 0, hasComplianceAgreement: false },
      ],
      { distributableSurplus: 30_000 },
    );
    expect(r.totalDeemedDividend.toString()).toBe('30000');
    expect(r.uncomputed.find((u) => u.id === 'UC-DIV7A-SURPLUS-CAPPED')).toBeTruthy();
  });
});

describe('div152 Decimal contracts', () => {
  it('15-year exemption disregards entire gain', () => {
    const r = applyDiv152Decimal({
      gainAfterDiv115: 800_000,
      maxNetAssetValue: 3_000_000,
      aggregatedTurnover: 1_000_000,
      isActiveAsset: true,
      monthsHeld: 16 * 12,
      isRetirementOrIncapacity: true,
    });
    expect(r.fifteenYearExemptionApplied).toBe(true);
    expect(r.assessableGain.toString()).toBe('0');
  });

  it('50% reduction: $200k → $100k', () => {
    const r = applyDiv152Decimal({
      gainAfterDiv115: 200_000,
      maxNetAssetValue: 3_000_000,
      aggregatedTurnover: 1_000_000,
      isActiveAsset: true,
      monthsHeld: 60,
      isRetirementOrIncapacity: false,
    });
    expect(r.activeAssetReductionApplied).toBe(true);
    expect(r.assessableGain.toString()).toBe('100000');
  });

  it('retirement cap binding: only $100k of lifetime remaining', () => {
    const r = applyDiv152Decimal({
      gainAfterDiv115: 600_000,
      maxNetAssetValue: 3_000_000,
      aggregatedTurnover: 1_000_000,
      isActiveAsset: true,
      monthsHeld: 60,
      isRetirementOrIncapacity: false,
      electRetirementExemption: true,
      retirementExemptionUsedToDate: 400_000,
    });
    // 600k after 50% = 300k. Cap remaining = 100k → exemption = 100k → assessable = 200k.
    expect(r.retirementExemptionApplied.toString()).toBe('100000');
    expect(r.assessableGain.toString()).toBe('200000');
    expect(r.uncomputed.find((u) => u.id === 'UC-DIV152-RETIREMENT-CAP')).toBeTruthy();
  });

  it('basic conditions not met: gain passes through unchanged', () => {
    const r = applyDiv152Decimal({
      gainAfterDiv115: 500_000,
      maxNetAssetValue: 3_000_000,
      aggregatedTurnover: 1_000_000,
      isActiveAsset: false,
      monthsHeld: 60,
      isRetirementOrIncapacity: false,
    });
    expect(r.basicConditionsMet).toBe(false);
    expect(r.assessableGain.toString()).toBe('500000');
  });

  it('rollover defers remaining gain', () => {
    const r = applyDiv152Decimal({
      gainAfterDiv115: 400_000,
      maxNetAssetValue: 3_000_000,
      aggregatedTurnover: 1_000_000,
      isActiveAsset: true,
      monthsHeld: 60,
      isRetirementOrIncapacity: false,
      electRollover: true,
    });
    // 400k → 200k after 50%; rollover defers 200k.
    expect(r.rolloverApplied.toString()).toBe('200000');
    expect(r.assessableGain.toString()).toBe('0');
    expect(r.uncomputed.find((u) => u.id === 'UC-DIV152-ROLLOVER')).toBeTruthy();
  });
});

describe('PR 2.D.3c2 — full shadow report', () => {
  it('every fixture across all 3 beneficiary-concessions engines PASSes', async () => {
    const report = await runShadowComparisonReport([...taxEngineBeneficiaryConcessionsShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map(
          (r) =>
            `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`,
        )
        .join('\n');
      throw new Error(`PR 2.D.3c2 shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
