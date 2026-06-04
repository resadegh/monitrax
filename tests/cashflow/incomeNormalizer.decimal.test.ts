/**
 * Q-DEC PR 2.C — Shadow + contract tests for `lib/cashflow/incomeNormalizer.ts`.
 *
 * Two engines under test:
 *   - calculateTakeHomePay (the critical PR 2.B Float-bridge unblocker)
 *   - normalizeAllIncome (salary GROSS/NET + non-salary paths)
 *
 * Plus targeted contract checks that the Decimal path stays exact through
 * the TaxEngine composition.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTakeHomePayShadow,
  normalizeAllIncomeShadow,
  cashflowShadowEngines,
} from '@/lib/calc-audit/engines/decimal-cashflow';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import {
  calculateTakeHomePay,
  calculateTakeHomePayDecimal,
  normalizeIncomeStreamDecimal,
  getEffectiveMonthlyIncomeDecimal,
} from '@/lib/cashflow/incomeNormalizer';
import { Decimal } from '@/lib/decimal';
import type { IncomeStream } from '@/lib/cashflow/types';

// ---------------------------------------------------------------------------
// Shadow comparisons
// ---------------------------------------------------------------------------

describe('calculateTakeHomePay — Float vs Decimal shadow', () => {
  it.each(calculateTakeHomePayShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(calculateTakeHomePayShadow, fixture);
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

describe('normalizeAllIncome — Float vs Decimal shadow', () => {
  it.each(normalizeAllIncomeShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(normalizeAllIncomeShadow, fixture);
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
// Decimal-path contract checks
// ---------------------------------------------------------------------------

describe('calculateTakeHomePayDecimal contract', () => {
  it('low-income tax-free threshold: PAYG=0, netAmount=grossAmount', () => {
    const result = calculateTakeHomePayDecimal(15000, 'ANNUAL');
    expect(result.paygWithholding.toString()).toBe('0');
    expect(result.grossAmount.equals(new Decimal(15000))).toBe(true);
    expect(result.netAmount.equals(new Decimal(15000))).toBe(true);
    expect(result.effectiveTaxRate.toString()).toBe('0');
  });

  it('round-trip: monthly grossAmount → divisor=12 → reverse via *12 = same grossAmount × 12', () => {
    const result = calculateTakeHomePayDecimal(7500, 'MONTHLY');
    expect(result.grossAmount.equals(new Decimal(7500))).toBe(true);
    // netAmount + (PAYG + Medicare) × 12 = annualGross (modulo LITO offset)
    const annualNet = result.netAmount.times(12);
    const annualPAYG = result.paygWithholding.times(12);
    const annualMedicare = result.medicareLevy.times(12);
    const annualGross = new Decimal(90000); // 7500 × 12
    const annualTakeHome = annualNet.plus(annualPAYG).plus(annualMedicare);
    // LITO can take takeHome > grossAmount by up to the LITO amount.
    expect(annualTakeHome.minus(annualGross).abs().lessThanOrEqualTo(new Decimal(1000))).toBe(true);
  });

  it('high income — effectiveTaxRate is positive and >25%', () => {
    const result = calculateTakeHomePayDecimal(250000, 'ANNUAL');
    expect(result.effectiveTaxRate.gt(25)).toBe(true);
    expect(result.netAmount.lt(new Decimal(250000))).toBe(true);
  });

  it('agrees with Float calculateTakeHomePay on a typical salary', () => {
    const float = calculateTakeHomePay(90000, 'ANNUAL');
    const dec = calculateTakeHomePayDecimal(90000, 'ANNUAL');
    expect(dec.netAmount.minus(float.netAmount).abs().lessThanOrEqualTo(new Decimal('0.005'))).toBe(true);
    expect(dec.paygWithholding.minus(float.paygWithholding).abs().lessThanOrEqualTo(new Decimal('0.005'))).toBe(true);
    expect(dec.medicareLevy.minus(float.medicareLevy).abs().lessThanOrEqualTo(new Decimal('0.005'))).toBe(true);
  });
});

describe('normalizeIncomeStreamDecimal — branch coverage', () => {
  const base: IncomeStream = {
    id: 'a',
    userId: 'u',
    name: 'fixture',
    type: 'OTHER',
    frequency: 'MONTHLY',
    monthlyAmount: 0,
    annualAmount: 0,
    nextPaymentDate: new Date('2026-06-01'),
    isActive: true,
  } as IncomeStream;

  it('SALARY/NET branch uses stored netAmount when present', () => {
    const result = normalizeIncomeStreamDecimal({
      ...base,
      type: 'SALARY',
      salaryType: 'NET',
      monthlyAmount: 6000,
      netAmount: 72000,
      grossAmount: 96000,
      paygWithholding: 24000,
    });
    expect(result.netMonthlyAmount.toString()).toBe('6000');
    expect(result.grossMonthlyAmount.toString()).toBe('8000');
    expect(result.monthlyPaygWithholding.toString()).toBe('2000');
    expect(result.isAfterTax).toBe(true);
  });

  it('SALARY/GROSS branch with stored netAmount/paygWithholding', () => {
    const result = normalizeIncomeStreamDecimal({
      ...base,
      type: 'SALARY',
      salaryType: 'GROSS',
      monthlyAmount: 8000,
      netAmount: 72000,
      paygWithholding: 24000,
    });
    expect(result.grossMonthlyAmount.toString()).toBe('8000');
    expect(result.netMonthlyAmount.toString()).toBe('6000');
    expect(result.monthlyPaygWithholding.toString()).toBe('2000');
    expect(result.isAfterTax).toBe(true);
  });

  it('RENTAL: gross = net, payg = 0, isAfterTax = false', () => {
    const result = normalizeIncomeStreamDecimal({ ...base, type: 'RENTAL', monthlyAmount: 850 });
    expect(result.grossMonthlyAmount.toString()).toBe('850');
    expect(result.netMonthlyAmount.toString()).toBe('850');
    expect(result.monthlyPaygWithholding.toString()).toBe('0');
    expect(result.isAfterTax).toBe(false);
  });

  it('INVESTMENT: same shape as RENTAL', () => {
    const result = normalizeIncomeStreamDecimal({ ...base, type: 'INVESTMENT', monthlyAmount: 420 });
    expect(result.grossMonthlyAmount.toString()).toBe('420');
    expect(result.netMonthlyAmount.toString()).toBe('420');
    expect(result.monthlyPaygWithholding.toString()).toBe('0');
    expect(result.isAfterTax).toBe(false);
  });
});

describe('getEffectiveMonthlyIncomeDecimal — wraps normalizeIncomeStreamDecimal', () => {
  it('returns netMonthlyAmount for SALARY/NET', () => {
    const result = getEffectiveMonthlyIncomeDecimal({
      id: 'a',
      userId: 'u',
      name: 'fx',
      type: 'SALARY',
      salaryType: 'NET',
      frequency: 'MONTHLY',
      monthlyAmount: 6000,
      annualAmount: 72000,
      nextPaymentDate: new Date('2026-06-01'),
      isActive: true,
      netAmount: 72000,
      grossAmount: 96000,
      paygWithholding: 24000,
    } as IncomeStream);
    expect(result.toString()).toBe('6000');
  });
});

// ---------------------------------------------------------------------------
// Aggregate report
// ---------------------------------------------------------------------------

describe('PR 2.C — full shadow report', () => {
  it('every fixture across both engines PASSes', async () => {
    const report = await runShadowComparisonReport([...cashflowShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map(
          (r) => `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`,
        )
        .join('\n');
      throw new Error(`PR 2.C shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
