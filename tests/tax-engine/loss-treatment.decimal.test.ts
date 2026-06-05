/**
 * Q-DEC PR 2.D.3c — Shadow + contract tests for loss-treatment engines.
 */

import { describe, it, expect } from 'vitest';
import {
  negativeGearingShadow,
  taxEngineLossShadowEngines,
} from '@/lib/calc-audit/engines/decimal-tax-engine-loss';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';
import { applyNegativeGearingDecimal } from '@/lib/tax-engine/divisions/negativeGearing';
import { applyCompanyLossRulesDecimal } from '@/lib/tax-engine/divisions/companyLossRules';
import { applyTrustLossRulesDecimal } from '@/lib/tax-engine/divisions/trustLossRules';
import { applyTrustMinimumTaxDecimal } from '@/lib/tax-engine/divisions/trustMinimumTax';
import { applyLossRefundabilityDecimal } from '@/lib/tax-engine/divisions/lossRefundability';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';

const config = getCurrentTaxYearConfig();

describe('negativeGearing — Float vs Decimal shadow', () => {
  it.each(negativeGearingShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(negativeGearingShadow, fixture);
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

describe('negativeGearingDecimal contracts', () => {
  it('net gain → NO_LOSS', () => {
    const r = applyNegativeGearingDecimal({
      entityType: 'PERSONAL_NAME',
      grossIncome: 24_000,
      deductibleExpenses: 20_000,
      otherIncome: 90_000,
    });
    expect(r.lossTreatment).toBe('NO_LOSS');
    expect(r.netResult.toString()).toBe('4000');
    expect(r.taxableIncomeAtEntity.toString()).toBe('94000');
  });

  it('individual loss < otherIncome → OFFSET_OTHER_INCOME, fully absorbed', () => {
    const r = applyNegativeGearingDecimal({
      entityType: 'PERSONAL_NAME',
      grossIncome: 24_000,
      deductibleExpenses: 34_000,
      otherIncome: 90_000,
    });
    expect(r.lossTreatment).toBe('OFFSET_OTHER_INCOME');
    expect(r.netResult.toString()).toBe('-10000');
    expect(r.lossAbsorbedThisFy.toString()).toBe('10000');
    expect(r.lossCarriedForward.toString()).toBe('0');
    expect(r.taxableIncomeAtEntity.toString()).toBe('80000');
  });

  it('individual loss > otherIncome → carry-forward + UC-TAX-LOSS-CARRY-FORWARD', () => {
    const r = applyNegativeGearingDecimal({
      entityType: 'PERSONAL_NAME',
      grossIncome: 24_000,
      deductibleExpenses: 144_000,
      otherIncome: 90_000,
    });
    expect(r.lossAbsorbedThisFy.toString()).toBe('90000');
    expect(r.lossCarriedForward.toString()).toBe('30000');
    expect(r.uncomputed.find((u) => u.id === 'UC-TAX-LOSS-CARRY-FORWARD')).toBeTruthy();
  });

  it('discretionary trust → TRAPPED_AT_ENTITY, otherIncome taxed independently', () => {
    const r = applyNegativeGearingDecimal({
      entityType: 'DISCRETIONARY_TRUST',
      grossIncome: 24_000,
      deductibleExpenses: 34_000,
      otherIncome: 50_000,
    });
    expect(r.lossTreatment).toBe('TRAPPED_AT_ENTITY');
    expect(r.lossCarriedForward.toString()).toBe('10000');
    expect(r.taxableIncomeAtEntity.toString()).toBe('50000');
    expect(r.uncomputed.find((u) => u.id === 'UC-TRUST-LOSS-TESTS')).toBeTruthy();
  });

  it('FW-1: POST_REFORM_RESTRICTED individual quarantines loss', () => {
    const r = applyNegativeGearingDecimal({
      entityType: 'PERSONAL_NAME',
      grossIncome: 24_000,
      deductibleExpenses: 34_000,
      otherIncome: 90_000,
      regime: 'POST_REFORM_RESTRICTED',
    });
    expect(r.lossTreatment).toBe('TRAPPED_AT_ENTITY');
    expect(r.lossCarriedForward.toString()).toBe('10000');
    expect(r.taxableIncomeAtEntity.toString()).toBe('90000');
    expect(r.uncomputed.find((u) => u.id === 'UC-NEG-GEARING-QUARANTINE-SCOPE-PENDING-DRAFT')).toBeTruthy();
  });

  it('FW-1: UC_PROPERTY_CONTRACT_DATE_UNKNOWN falls back to pre-reform + UC flag', () => {
    const r = applyNegativeGearingDecimal({
      entityType: 'PERSONAL_NAME',
      grossIncome: 24_000,
      deductibleExpenses: 34_000,
      otherIncome: 90_000,
      regime: 'UC_PROPERTY_CONTRACT_DATE_UNKNOWN',
    });
    // Falls back to pre-reform: loss offsets other income.
    expect(r.lossTreatment).toBe('OFFSET_OTHER_INCOME');
    expect(r.lossAbsorbedThisFy.toString()).toBe('10000');
    expect(r.uncomputed.find((u) => u.id === 'UC-PROPERTY-CONTRACT-DATE-UNKNOWN')).toBeTruthy();
  });
});

describe('companyLossRulesDecimal contracts', () => {
  it('COT PASS → LOSSES_DEDUCTIBLE_VIA_COT, full amount through', () => {
    const r = applyCompanyLossRulesDecimal({
      priorYearLossAmount: 100_000,
      cotOutcome: 'PASS',
    });
    expect(r.outcome).toBe('LOSSES_DEDUCTIBLE_VIA_COT');
    expect(r.deductibleLossAmount.toString()).toBe('100000');
  });

  it('COT FAIL + BCT PASS → LOSSES_DEDUCTIBLE_VIA_BCT', () => {
    const r = applyCompanyLossRulesDecimal({
      priorYearLossAmount: 100_000,
      cotOutcome: 'FAIL',
      bctOutcome: 'PASS',
      bctTestType: 'SBT',
    });
    expect(r.outcome).toBe('LOSSES_DEDUCTIBLE_VIA_BCT');
    expect(r.deductibleLossAmount.toString()).toBe('100000');
  });

  it('COT FAIL + BCT FAIL → LOSSES_DENIED', () => {
    const r = applyCompanyLossRulesDecimal({
      priorYearLossAmount: 100_000,
      cotOutcome: 'FAIL',
      bctOutcome: 'FAIL',
      bctTestType: 'SBT',
    });
    expect(r.outcome).toBe('LOSSES_DENIED');
    expect(r.deductibleLossAmount.toString()).toBe('0');
    expect(r.uncomputed.find((u) => u.id === 'UC-COMPANY-LOSS-DENIED')).toBeTruthy();
  });

  it('COT NOT_ASSERTED → INCONCLUSIVE', () => {
    const r = applyCompanyLossRulesDecimal({
      priorYearLossAmount: 100_000,
      cotOutcome: 'NOT_ASSERTED',
    });
    expect(r.outcome).toBe('INCONCLUSIVE');
    expect(r.deductibleLossAmount.toString()).toBe('0');
  });
});

describe('trustLossRulesDecimal contracts', () => {
  it('Family trust FTE with IIT PASS → LOSSES_DEDUCTIBLE', () => {
    const r = applyTrustLossRulesDecimal({
      trustType: 'FAMILY_TRUST_FTE',
      lossAmount: 50_000,
      testOutcomes: { incomeInjectionTest: 'PASS' },
    });
    expect(r.outcome).toBe('LOSSES_DEDUCTIBLE');
    expect(r.deductibleLossAmount.toString()).toBe('50000');
  });

  it('Non-fixed trust missing assertions → INCONCLUSIVE', () => {
    const r = applyTrustLossRulesDecimal({
      trustType: 'NON_FIXED_TRUST',
      lossAmount: 30_000,
      testOutcomes: { incomeInjectionTest: 'PASS' }, // missing 3 others
    });
    expect(r.outcome).toBe('INCONCLUSIVE');
    expect(r.deductibleLossAmount.toString()).toBe('0');
  });

  it('Excepted trust → LOSSES_DEDUCTIBLE (no tests required)', () => {
    const r = applyTrustLossRulesDecimal({
      trustType: 'EXCEPTED_TRUST',
      lossAmount: 25_000,
      testOutcomes: {},
    });
    expect(r.outcome).toBe('LOSSES_DEDUCTIBLE');
    expect(r.deductibleLossAmount.toString()).toBe('25000');
  });

  it('Any FAIL → LOSSES_DENIED', () => {
    const r = applyTrustLossRulesDecimal({
      trustType: 'FAMILY_TRUST_FTE',
      lossAmount: 50_000,
      testOutcomes: { incomeInjectionTest: 'FAIL' },
    });
    expect(r.outcome).toBe('LOSSES_DENIED');
    expect(r.deductibleLossAmount.toString()).toBe('0');
  });
});

describe('Skeleton modules — Stage 1 UNCOMPUTED preserved (§12.14 FW-2)', () => {
  it('trustMinimumTaxDecimal: non-DISCRETIONARY → out-of-scope (inScope=false, computed=true)', () => {
    const r = applyTrustMinimumTaxDecimal({
      trustEntityId: 'trust-1',
      trustType: 'FIXED',
      taxableIncome: 100_000,
      actualBeneficiaryTax: 25_000,
      config,
      fy: '2028-29',
    });
    expect(r.inScope).toBe(false);
    expect(r.computed).toBe(true);
    expect(r.topUpTax.toString()).toBe('0');
  });

  it('trustMinimumTaxDecimal: DISCRETIONARY + unverified commencement → UNCOMPUTED', () => {
    const r = applyTrustMinimumTaxDecimal({
      trustEntityId: 'trust-1',
      trustType: 'DISCRETIONARY',
      taxableIncome: 100_000,
      actualBeneficiaryTax: 25_000,
      config: { ...config, trustMinTaxCommencementVerified: false },
      fy: '2028-29',
    });
    expect(r.inScope).toBe(true);
    expect(r.computed).toBe(false);
    expect(r.topUpTax.toString()).toBe('0');
    expect(r.uncomputed.find((u) => u.id === 'UC-TRUST-MIN-TAX-PENDING-EXPOSURE-DRAFT')).toBeTruthy();
  });

  it('trustMinimumTaxDecimal: null trustType surfaces UC-TRUST-TYPE-UNKNOWN', () => {
    const r = applyTrustMinimumTaxDecimal({
      trustEntityId: 'trust-1',
      trustType: null,
      taxableIncome: 100_000,
      actualBeneficiaryTax: 25_000,
      config,
      fy: '2028-29',
    });
    expect(r.inScope).toBe(false);
    expect(r.uncomputed.find((u) => u.id === 'UC-TRUST-TYPE-UNKNOWN')).toBeTruthy();
  });

  it('lossRefundabilityDecimal: non-COMPANY → out-of-scope', () => {
    const r = applyLossRefundabilityDecimal({
      entityId: 'entity-1',
      entityType: 'OTHER',
      annualTurnoverCurrentFy: 500_000_000,
      currentFy: { fy: '2026-27', taxablePosition: -100_000, taxPaid: 0, frankingAccountBalance: 50_000 },
      config,
    });
    expect(r.inScope).toBe(false);
    expect(r.refundEligible.toString()).toBe('0');
  });

  it('lossRefundabilityDecimal: turnover > $1B → out-of-scope', () => {
    const r = applyLossRefundabilityDecimal({
      entityId: 'company-1',
      entityType: 'COMPANY',
      annualTurnoverCurrentFy: 2_000_000_000,
      currentFy: { fy: '2026-27', taxablePosition: -100_000, taxPaid: 0, frankingAccountBalance: 50_000 },
      config,
    });
    expect(r.inScope).toBe(false);
    expect(r.refundEligible.toString()).toBe('0');
  });

  it('lossRefundabilityDecimal: company + loss + unverified commencement → UNCOMPUTED', () => {
    const r = applyLossRefundabilityDecimal({
      entityId: 'company-1',
      entityType: 'COMPANY',
      annualTurnoverCurrentFy: 500_000_000,
      currentFy: { fy: '2026-27', taxablePosition: -200_000, taxPaid: 0, frankingAccountBalance: 100_000 },
      priorFy1: { fy: '2025-26', taxablePosition: 500_000, taxPaid: 125_000, frankingAccountBalance: 80_000 },
      config: { ...config, lossCarryBackCommencementVerified: false },
    });
    expect(r.inScope).toBe(true);
    expect(r.computed).toBe(false);
    expect(r.refundEligible.toString()).toBe('0');
    expect(r.uncomputed.find((u) => u.id === 'UC-LOSS-CARRYBACK-PENDING-BILL')).toBeTruthy();
  });

  it('lossRefundabilityDecimal: company with no loss → out-of-scope (no carry-back needed)', () => {
    const r = applyLossRefundabilityDecimal({
      entityId: 'company-1',
      entityType: 'COMPANY',
      annualTurnoverCurrentFy: 500_000_000,
      currentFy: { fy: '2026-27', taxablePosition: 100_000, taxPaid: 25_000, frankingAccountBalance: 50_000 },
      config,
    });
    expect(r.inScope).toBe(false);
    expect(r.refundEligible.toString()).toBe('0');
  });
});

describe('PR 2.D.3c — full shadow report', () => {
  it('every fixture across the negativeGearing shadow engine PASSes', async () => {
    const report = await runShadowComparisonReport([...taxEngineLossShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map(
          (r) =>
            `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`,
        )
        .join('\n');
      throw new Error(`PR 2.D.3c shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
