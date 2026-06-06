/**
 * Q-DEC PR 2.E.4 — Shadow + contract tests for `intelligenceEngine`
 * (final 2.E sub-PR).
 *
 * actionEngine + aiAdvisor are intentionally NOT shadow-tested — their
 * numeric leaves are categorical/display values, not compounding math.
 * See `lib/calc-audit/engines/decimal-cfo-actions-ai-intel.ts` header
 * for the full scope rationale.
 */

import { describe, it, expect } from 'vitest';
import {
  projectedMonthEndBalanceShadow,
  monthlyProgressNetWorthShadow,
  cfoActionsAiIntelShadowEngines,
} from '@/lib/calc-audit/engines/decimal-cfo-actions-ai-intel';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';
import {
  calculateProjectedMonthEndBalanceDecimal,
  calculateMonthlyProgressNetWorthDecimal,
} from '@/lib/cfo/intelligenceEngine';

const ENGINES = [
  ['projectedMonthEndBalance', projectedMonthEndBalanceShadow] as const,
  ['monthlyProgressNetWorth', monthlyProgressNetWorthShadow] as const,
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

describe('calculateProjectedMonthEndBalanceDecimal — contract', () => {
  it('liquid minus burn × days', () => {
    expect(
      calculateProjectedMonthEndBalanceDecimal(5_000, 150, 12).toString(),
    ).toBe('3200');
  });

  it('zero days remaining → liquid unchanged', () => {
    expect(
      calculateProjectedMonthEndBalanceDecimal(5_000, 150, 0).toString(),
    ).toBe('5000');
  });

  it('zero burn → liquid unchanged', () => {
    expect(
      calculateProjectedMonthEndBalanceDecimal(5_000, 0, 15).toString(),
    ).toBe('5000');
  });

  it('overdraft case → negative result', () => {
    expect(
      calculateProjectedMonthEndBalanceDecimal(1_000, 200, 10).toString(),
    ).toBe('-1000');
  });
});

describe('calculateMonthlyProgressNetWorthDecimal — contract', () => {
  it('empty portfolio with debt → negative net worth', () => {
    const r = calculateMonthlyProgressNetWorthDecimal({
      accountBalances: [],
      propertyValues: [],
      investmentHoldings: [],
      totalDebt: 50_000,
    });
    expect(r.toString()).toBe('-50000');
  });

  it('sums assets + holdings × price, subtracts debt', () => {
    const r = calculateMonthlyProgressNetWorthDecimal({
      accountBalances: [{ currentBalance: 25_000 }, { currentBalance: 5_000 }],
      propertyValues: [{ currentValue: 800_000 }],
      investmentHoldings: [{ units: 200, averagePrice: 150 }],
      totalDebt: 500_000,
    });
    // 25000 + 5000 + 800000 + 30000 − 500000 = 360000
    expect(r.toString()).toBe('360000');
  });

  it('Decimal accumulator stays exact on fractional holdings', () => {
    // 20 × 0.1234 × 123.45 = 304.7766 (Float would drift by epsilon at this scale)
    const r = calculateMonthlyProgressNetWorthDecimal({
      accountBalances: [],
      propertyValues: [],
      investmentHoldings: Array.from({ length: 20 }, () => ({
        units: 0.1234,
        averagePrice: 123.45,
      })),
      totalDebt: 0,
    });
    // Per fixture: 20 × (0.1234 × 123.45) = 20 × 15.23373 = 304.6746 exact
    expect(r.toDecimalPlaces(4).toString()).toBe('304.6746');
  });

  it('underwater case', () => {
    const r = calculateMonthlyProgressNetWorthDecimal({
      accountBalances: [{ currentBalance: 2_000 }],
      propertyValues: [{ currentValue: 600_000 }],
      investmentHoldings: [],
      totalDebt: 700_000,
    });
    expect(r.toString()).toBe('-98000');
  });
});

describe('PR 2.E.4 — full shadow report', () => {
  it('every fixture across 2 shadow engines PASSes', async () => {
    const report = await runShadowComparisonReport([...cfoActionsAiIntelShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map((r) => `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`)
        .join('\n');
      throw new Error(`PR 2.E.4 shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
