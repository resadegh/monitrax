/**
 * Q-DEC PR 2.D.2b — Shadow + contract tests for `lib/tax-engine/income/*`
 * and `lib/tax-engine/position/*`.
 */

import { describe, it, expect } from 'vitest';
import {
  frankingCreditsShadow,
  quickTaxPositionShadow,
  taxEngineIncomePositionShadowEngines,
} from '@/lib/calc-audit/engines/decimal-tax-engine-income-position';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';
import {
  calculateFrankingCreditsDecimal,
  determineTaxabilityDecimal,
} from '@/lib/tax-engine/income/taxabilityRules';
import {
  calculateTaxPosition,
  calculateTaxPositionDecimal,
  calculateQuickTaxPositionDecimal,
} from '@/lib/tax-engine/position/taxPositionCalculator';

describe('frankingCredits — Float vs Decimal shadow', () => {
  it.each(frankingCreditsShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(frankingCreditsShadow, fixture);
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

describe('quickTaxPosition — Float vs Decimal shadow', () => {
  it.each(quickTaxPositionShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(quickTaxPositionShadow, fixture);
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

describe('Decimal taxability contract', () => {
  it('SALARY: full taxable amount', () => {
    const r = determineTaxabilityDecimal({ incomeType: 'SALARY', amount: 90000 });
    expect(r.taxableAmount.toString()).toBe('90000');
    expect(r.exemptAmount.toString()).toBe('0');
    expect(r.frankingCredits.toString()).toBe('0');
  });

  it('RENTAL: full taxable amount', () => {
    const r = determineTaxabilityDecimal({ incomeType: 'RENTAL', amount: 24000 });
    expect(r.taxableAmount.toString()).toBe('24000');
  });

  it('DIVIDEND with 100% franking: grossed-up taxable', () => {
    const r = determineTaxabilityDecimal({
      incomeType: 'DIVIDEND',
      amount: 700,
      frankingPercentage: 100,
    });
    // 700 × 1.0 × (0.30 / 0.70) = 300 (exact)
    expect(r.frankingCredits.toString()).toBe('300');
    expect(r.grossedUpAmount.toString()).toBe('1000');
    expect(r.taxableAmount.toString()).toBe('1000');
  });

  it('DIVIDEND unfranked: no gross-up', () => {
    const r = determineTaxabilityDecimal({ incomeType: 'DIVIDEND', amount: 700 });
    expect(r.frankingCredits.toString()).toBe('0');
    expect(r.taxableAmount.toString()).toBe('700');
  });

  it('GIFT: exempt, not taxable', () => {
    const r = determineTaxabilityDecimal({ incomeType: 'GIFT', amount: 5000 });
    expect(r.taxableAmount.toString()).toBe('0');
    expect(r.exemptAmount.toString()).toBe('5000');
  });

  it('INHERITANCE: exempt', () => {
    const r = determineTaxabilityDecimal({ incomeType: 'INHERITANCE', amount: 50000 });
    expect(r.taxableAmount.toString()).toBe('0');
    expect(r.exemptAmount.toString()).toBe('50000');
  });

  it('CENTRELINK FAMILY_TAX_BENEFIT: exempt', () => {
    const r = determineTaxabilityDecimal({
      incomeType: 'CENTRELINK',
      amount: 8000,
      paymentType: 'FAMILY_TAX_BENEFIT',
    });
    expect(r.taxableAmount.toString()).toBe('0');
    expect(r.exemptAmount.toString()).toBe('8000');
  });

  it('CENTRELINK JOBSEEKER: taxable', () => {
    const r = determineTaxabilityDecimal({
      incomeType: 'CENTRELINK',
      amount: 12000,
      paymentType: 'JOBSEEKER',
    });
    expect(r.taxableAmount.toString()).toBe('12000');
  });

  it('calculateFrankingCreditsDecimal: exact 100% × $700 = $300', () => {
    const credits = calculateFrankingCreditsDecimal(700, 100);
    expect(credits.toString()).toBe('300');
  });

  it('calculateFrankingCreditsDecimal: 50% × $1000 = $214.29 (rounded)', () => {
    // 1000 × 0.5 × (0.30 / 0.70) = 214.2857... → 214.29 cents.
    const credits = calculateFrankingCreditsDecimal(1000, 50);
    expect(credits.toString()).toBe('214.29');
  });
});

describe('Decimal full tax position contract', () => {
  it('empty input → all zeros', () => {
    const r = calculateTaxPositionDecimal({ incomes: [], expenses: [], depreciations: [] });
    expect(r.income.total.toString()).toBe('0');
    expect(r.deductions.total.toString()).toBe('0');
    expect(r.tax.taxableIncome.toString()).toBe('0');
    expect(r.tax.netTax.toString()).toBe('0');
    expect(r.estimatedRefund.toString()).toBe('0');
  });

  it('salary only — single SALARY income', () => {
    const r = calculateTaxPositionDecimal({
      incomes: [{ id: 's1', name: 'Job', type: 'SALARY', amount: 90000, frequency: 'ANNUALLY', paygWithholding: 18000 }],
      expenses: [],
      depreciations: [],
    });
    expect(r.income.salary.toString()).toBe('90000');
    expect(r.income.total.toString()).toBe('90000');
    expect(r.tax.taxableIncome.toString()).toBe('90000');
    expect(r.paygWithheld.toString()).toBe('18000');
    expect(r.tax.netTax.gt(0)).toBe(true);
  });

  it('salary + rental + deductions — matches Float netTax within $1', () => {
    const input = {
      incomes: [
        { id: 's1', name: 'Job', type: 'SALARY', amount: 120000, frequency: 'ANNUALLY' },
        { id: 'r1', name: 'IP rent', type: 'RENTAL', amount: 24000, frequency: 'ANNUALLY' },
      ],
      expenses: [
        { id: 'e1', name: 'IP interest', category: 'LOAN_INTEREST', amount: 18000, frequency: 'ANNUALLY', isTaxDeductible: true, propertyId: 'p1' },
        { id: 'e2', name: 'Council rates', category: 'OTHER', amount: 2500, frequency: 'ANNUALLY', isTaxDeductible: true, propertyId: 'p1' },
      ],
      depreciations: [{ id: 'd1', propertyId: 'p1', currentYearDeduction: 3500, type: 'DIV_43' }],
    };
    const dec = calculateTaxPositionDecimal(input);
    const float = calculateTaxPosition(input);
    expect(dec.tax.netTax.minus(float.tax.netTax).abs().lte(new Decimal(1))).toBe(true);
    expect(dec.tax.taxableIncome.minus(float.tax.taxableIncome).abs().lte(new Decimal(1))).toBe(true);
    expect(dec.income.rental.toString()).toBe('24000');
  });

  it('dividend with franking: franking credits flow through to offset', () => {
    const r = calculateTaxPositionDecimal({
      incomes: [
        { id: 's1', name: 'Job', type: 'SALARY', amount: 90000, frequency: 'ANNUALLY' },
        { id: 'd1', name: 'Dividend', type: 'DIVIDEND', amount: 700, frequency: 'ANNUALLY', frankingPercentage: 100 },
      ],
      expenses: [],
      depreciations: [],
    });
    expect(r.income.frankingCredits.toString()).toBe('300');
    expect(r.tax.offsets.frankingCredits.toString()).toBe('300');
  });

  it('division 293 triggers when income + super > $250k', () => {
    const r = calculateTaxPositionDecimal({
      incomes: [{ id: 's1', name: 'Job', type: 'SALARY', amount: 240000, frequency: 'ANNUALLY' }],
      expenses: [],
      depreciations: [],
      superContributions: { concessional: 30000, nonConcessional: 0 },
    });
    expect(r.superContributions.division293Tax.gt(0)).toBe(true);
  });
});

describe('Decimal quick tax position contract', () => {
  it('low income agrees with Float netTax', () => {
    const dec = calculateQuickTaxPositionDecimal(15000);
    expect(dec.netTax.toString()).toBe('0');
    expect(dec.taxPayable.toString()).toBe('0');
  });

  it('high income with deductions + franking', () => {
    const r = calculateQuickTaxPositionDecimal(250000, 35000, 5000);
    // Franking credits subtract from tax owing.
    expect(r.netTax.gt(0)).toBe(true);
    expect(r.taxableIncome.toString()).toBe('215000');
  });
});

describe('PR 2.D.2b — full shadow report', () => {
  it('every fixture across both shadow engines PASSes', async () => {
    const report = await runShadowComparisonReport([...taxEngineIncomePositionShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map(
          (r) =>
            `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`,
        )
        .join('\n');
      throw new Error(`PR 2.D.2b shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
