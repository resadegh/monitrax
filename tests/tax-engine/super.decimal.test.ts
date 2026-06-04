/**
 * Q-DEC PR 2.D.2 — Shadow + contract tests for `lib/tax-engine/super/*`.
 */

import { describe, it, expect } from 'vitest';
import {
  capTrackerShadow,
  superContributionsShadow,
  highIncomeSuperTaxShadow,
  taxEngineSuperShadowEngines,
} from '@/lib/calc-audit/engines/decimal-tax-engine-super';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';
import {
  trackContributionCapsDecimal,
  concessionalCapHeadroomDecimal,
  calculateCarryForwardDecimal,
  calculateBringForwardDecimal,
} from '@/lib/tax-engine/super/capTracker';
import {
  calculateSuperContributionsDecimal,
  calculateDivision293TaxDecimal,
} from '@/lib/tax-engine/super/contributionCalculator';
import {
  calculateHighIncomeSuperTaxDecimal,
} from '@/lib/tax-engine/super/highIncomeSuperTax';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';

const config = getCurrentTaxYearConfig();

describe('capTracker — Float vs Decimal shadow', () => {
  it.each(capTrackerShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(capTrackerShadow, fixture);
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

describe('superContributions — Float vs Decimal shadow', () => {
  it.each(superContributionsShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(superContributionsShadow, fixture);
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

describe('highIncomeSuperTax — Float vs Decimal shadow', () => {
  it.each(highIncomeSuperTaxShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(highIncomeSuperTaxShadow, fixture);
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

describe('H3 hardening anchor — concessionalCapHeadroomDecimal', () => {
  it('full headroom at zero YTD', () => {
    const r = concessionalCapHeadroomDecimal(0, config);
    expect(r.headroomRemaining.equals(r.capLimit)).toBe(true);
    expect(r.isExceeded).toBe(false);
  });

  it('partial usage shows correct remaining', () => {
    const r = concessionalCapHeadroomDecimal(11500, config);
    expect(r.headroomRemaining.equals(r.capLimit.minus(11500))).toBe(true);
    expect(r.isExceeded).toBe(false);
  });

  it('exceeded triggers isExceeded flag', () => {
    const r = concessionalCapHeadroomDecimal(35000, config);
    expect(r.headroomRemaining.lt(0)).toBe(true);
    expect(r.isExceeded).toBe(true);
  });

  it('carry-forward adds to totalAvailable when TSB eligible', () => {
    const r = concessionalCapHeadroomDecimal(0, config, {
      carryForwardAmounts: [
        { financialYear: '2023-24', unusedAmount: 5000 },
        { financialYear: '2024-25', unusedAmount: 10000 },
      ],
      totalSuperBalance: 250000,
    });
    expect(r.carryForwardAvailable.toString()).toBe('15000');
    expect(r.totalAvailable.equals(r.capLimit.plus(15000))).toBe(true);
  });

  it('carry-forward zero when TSB ≥ $500k', () => {
    const r = concessionalCapHeadroomDecimal(0, config, {
      carryForwardAmounts: [{ financialYear: '2024-25', unusedAmount: 10000 }],
      totalSuperBalance: 600000,
    });
    expect(r.carryForwardAvailable.toString()).toBe('0');
    expect(r.totalAvailable.equals(r.capLimit)).toBe(true);
  });
});

describe('Decimal contracts', () => {
  it('calculateBringForwardDecimal: low TSB → 3 years available', () => {
    const r = calculateBringForwardDecimal(500000, config);
    expect(r.yearsAvailable).toBe(3);
    expect(r.eligible).toBe(true);
    expect(r.totalCap.equals(new Decimal(config.nonConcessionalCap).times(3))).toBe(true);
  });

  it('calculateBringForwardDecimal: high TSB → 1 year only', () => {
    const r = calculateBringForwardDecimal(2000000, config);
    expect(r.yearsAvailable).toBe(1);
    expect(r.eligible).toBe(false);
    expect(r.totalCap.equals(new Decimal(config.nonConcessionalCap))).toBe(true);
  });

  it('calculateDivision293TaxDecimal: below threshold returns 0', () => {
    const tax = calculateDivision293TaxDecimal(200000, 20000, config);
    expect(tax.toString()).toBe('0');
  });

  it('calculateDivision293TaxDecimal: above threshold applies 15% on lesser', () => {
    // $300k income + $30k CC → combined $330k → excess $80k.
    // taxable = min(CC=30k, excess=80k) = 30k. tax = 30k × 0.15 = 4500.
    const tax = calculateDivision293TaxDecimal(300000, 30000, config);
    expect(tax.toString()).toBe('4500');
  });

  it('calculateSuperContributionsDecimal: salary-sacrifice tax savings = sacrifice × (marginal − 15%)', () => {
    // $6k sacrifice at 32% marginal → savings = 6000 × (0.32 - 0.15) = $1,020.
    const r = calculateSuperContributionsDecimal(
      { grossSalary: 90000, salarySacrifice: 6000 },
      0.32,
      config,
    );
    expect(r.taxSavingsFromSalarySacrifice.toString()).toBe('1020');
  });

  it('calculateHighIncomeSuperTaxDecimal: Div 296 pending leaves earningsTaxed at 0', () => {
    // Default config has div296CommencementVerified=false → pending.
    const r = calculateHighIncomeSuperTaxDecimal(
      { div293Income: 200000, concessionalContributions: 25000, totalSuperBalance: 4000000, tsbEarnings: 200000 },
      config,
    );
    expect(r.div296.isPending).toBe(true);
    expect(r.div296.tax.toString()).toBe('0');
    expect(r.uncomputed.find((u) => u.id === 'UC-DIV-296-PENDING')).toBeTruthy();
  });

  it('trackContributionCapsDecimal: excess concessional surfaces excessAmount + warning', () => {
    const r = trackContributionCapsDecimal({ concessionalYTD: 35000, nonConcessionalYTD: 0 }, config);
    expect(r.concessional.isExceeded).toBe(true);
    expect(r.concessional.excessAmount.gt(0)).toBe(true);
    expect(r.warnings.some((w) => w.toLowerCase().includes('excess concessional'))).toBe(true);
  });
});

describe('PR 2.D.2 — full shadow report', () => {
  it('every fixture across all 3 super engines PASSes', async () => {
    const report = await runShadowComparisonReport([...taxEngineSuperShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map(
          (r) =>
            `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`,
        )
        .join('\n');
      throw new Error(`PR 2.D.2 shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
