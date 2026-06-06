/**
 * Q-DEC PR 2.D.3d — Shadow + contract tests for the two composer-tier
 * engines that ship a Decimal sibling:
 *   - `calculateSmsfIncomeTax`          (Div 295 / NALI / ECPI / franking)
 *   - `processSalary`                   (NET→GROSS reverse + PAYG + Medicare + super)
 *
 * `entityTaxRouter` and `masterTaxPosition` aggregate engines already
 * shipped on the Decimal path — they cut over via PR 3 alongside the
 * route handlers, not here.
 */

import { describe, it, expect } from 'vitest';
import {
  smsfIncomeTaxShadow,
  processSalaryShadow,
  taxEngineComposerShadowEngines,
} from '@/lib/calc-audit/engines/decimal-tax-engine-composers';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';
import { calculateSmsfIncomeTaxDecimal } from '@/lib/tax-engine/super/smsfIncomeTax';
import { processSalaryDecimal } from '@/lib/tax-engine/income/salaryProcessor';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';

const config = getCurrentTaxYearConfig();

describe('smsfIncomeTax — Float vs Decimal shadow', () => {
  it.each(smsfIncomeTaxShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(smsfIncomeTaxShadow, fixture);
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

describe('processSalary — Float vs Decimal shadow', () => {
  it.each(processSalaryShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(processSalaryShadow, fixture);
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

describe('calculateSmsfIncomeTaxDecimal — contract', () => {
  it('complying accumulation phase: contributionsTax = contributions × 15%', () => {
    const r = calculateSmsfIncomeTaxDecimal(
      {
        assessableInvestmentIncome: 50_000,
        deductions: 5_000,
        assessableContributions: 25_000,
        nonArmsLengthIncome: 0,
        isComplying: true,
        isInPensionPhase: false,
      },
      config,
    );
    // 25_000 × 0.15 = 3750
    expect(r.contributionsTax.toString()).toBe('3750');
    // (50_000 − 5_000) × 0.15 = 6750
    expect(r.investmentIncomeTax?.toString()).toBe('6750');
    expect(r.tax?.toString()).toBe('10500');
    expect(r.ecpiExemptAmount?.toString()).toBe('0');
  });

  it('complying pension 100% ECPI: investmentIncomeTax = 0', () => {
    const r = calculateSmsfIncomeTaxDecimal(
      {
        assessableInvestmentIncome: 50_000,
        deductions: 5_000,
        assessableContributions: 0,
        nonArmsLengthIncome: 0,
        isComplying: true,
        isInPensionPhase: true,
        ecpiExemptProportion: 1,
      },
      config,
    );
    expect(r.investmentIncomeTax?.toString()).toBe('0');
    expect(r.tax?.toString()).toBe('0');
    expect(r.ecpiExemptAmount?.toString()).toBe('45000');
  });

  it('pension phase + undefined ecpiExemptProportion → UNCOMPUTED, never guesses', () => {
    const r = calculateSmsfIncomeTaxDecimal(
      {
        assessableInvestmentIncome: 50_000,
        deductions: 5_000,
        assessableContributions: 25_000,
        nonArmsLengthIncome: 0,
        isComplying: true,
        isInPensionPhase: true,
        // ecpiExemptProportion deliberately omitted
      },
      config,
    );
    expect(r.tax).toBeNull();
    expect(r.investmentIncomeTax).toBeNull();
    expect(r.ecpiExemptAmount).toBeNull();
    expect(r.netTaxPayable).toBeNull();
    expect(r.frankingRefund).toBeNull();
    // Contributions tax + NALI tax are still surfaced (ECPI never applies).
    expect(r.contributionsTax.toString()).toBe('3750');
    expect(r.uncomputed.find((u) => u.id === 'UC-SMSF-ECPI-PROPORTION')).toBeTruthy();
  });

  it('NALI taxed at top rate, ECPI does not apply (s295-550)', () => {
    const r = calculateSmsfIncomeTaxDecimal(
      {
        assessableInvestmentIncome: 30_000,
        deductions: 0,
        assessableContributions: 15_000,
        nonArmsLengthIncome: 25_000,
        isComplying: true,
        isInPensionPhase: false,
      },
      config,
    );
    const topRate = new Decimal(config.brackets[config.brackets.length - 1]!.rate);
    // 25_000 × topRate
    expect(r.naliTax.equals(topRate.times(25_000))).toBe(true);
  });

  it('non-complying fund: top rate on all assessable income', () => {
    const r = calculateSmsfIncomeTaxDecimal(
      {
        assessableInvestmentIncome: 50_000,
        deductions: 5_000,
        assessableContributions: 25_000,
        nonArmsLengthIncome: 10_000,
        isComplying: false,
        isInPensionPhase: false,
      },
      config,
    );
    const topRate = new Decimal(config.brackets[config.brackets.length - 1]!.rate);
    expect(r.isComplying).toBe(false);
    // (45_000 + 25_000 + 10_000) × topRate
    expect(r.tax?.equals(topRate.times(80_000))).toBe(true);
    expect(r.ecpiExemptAmount?.toString()).toBe('0');
  });

  it('complying with franking refund: pension phase + credits > gross tax → cash refund', () => {
    const r = calculateSmsfIncomeTaxDecimal(
      {
        assessableInvestmentIncome: 20_000,
        deductions: 0,
        assessableContributions: 0,
        nonArmsLengthIncome: 0,
        isComplying: true,
        isInPensionPhase: true,
        ecpiExemptProportion: 1,
        frankingCredits: 8_000,
      },
      config,
    );
    // 100% ECPI → gross tax = 0
    expect(r.tax?.toString()).toBe('0');
    // Refundable: netTaxPayable = 0 − 8000 = −8000
    expect(r.netTaxPayable?.toString()).toBe('-8000');
    // frankingRefund = max(0, 8000 − 0) = 8000
    expect(r.frankingRefund?.toString()).toBe('8000');
  });
});

describe('processSalaryDecimal — contract', () => {
  it('GROSS annual basic: super = gross × SG rate, taxable = gross', () => {
    const r = processSalaryDecimal(
      { amount: 90_000, salaryType: 'GROSS', payFrequency: 'ANNUALLY' },
      config,
    );
    expect(r.grossSalary.toString()).toBe('90000');
    expect(r.taxableIncome.toString()).toBe('90000');
    expect(r.salarySacrifice.toString()).toBe('0');
    // SG = 90_000 × config.superGuaranteeRate
    const expectedSG = new Decimal(90_000)
      .times(config.superGuaranteeRate)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
    expect(r.superGuarantee.equals(expectedSG)).toBe(true);
    expect(r.totalSuper.equals(expectedSG)).toBe(true);
    expect(r.totalTax.gt(0)).toBe(true);
    expect(r.netSalary.lt(r.grossSalary)).toBe(true);
  });

  it('NET annual reverse-calculation returns gross > net', () => {
    const r = processSalaryDecimal(
      { amount: 67_200, salaryType: 'NET', payFrequency: 'ANNUALLY' },
      config,
    );
    expect(r.netSalary.toString()).toBe('67200');
    expect(r.grossSalary.gt(r.netSalary)).toBe(true);
    // Binary search iterates against PAYG only (Medicare is layered on top
    // after the gross is locked), so gross − PAYG should land within $1 of
    // the user-provided net. Mirrors the Float-side contract.
    const netImpliedByPayg = r.grossSalary.minus(r.paygWithholding);
    expect(netImpliedByPayg.minus(r.netSalary).abs().lt(1)).toBe(true);
  });

  it('salary sacrifice reduces taxable income', () => {
    const base = processSalaryDecimal(
      { amount: 120_000, salaryType: 'GROSS', payFrequency: 'ANNUALLY' },
      config,
    );
    const withSacrifice = processSalaryDecimal(
      {
        amount: 120_000,
        salaryType: 'GROSS',
        payFrequency: 'ANNUALLY',
        salarySacrifice: 6_000,
        salarySacrificeFrequency: 'ANNUALLY',
      },
      config,
    );
    expect(withSacrifice.taxableIncome.toString()).toBe('114000');
    expect(withSacrifice.salarySacrifice.toString()).toBe('6000');
    // Sacrifice shifts pre-tax dollars to super → total super rises by 6k.
    expect(
      withSacrifice.totalSuper.minus(base.totalSuper).toDecimalPlaces(2).toString(),
    ).toBe('6000');
    // Sacrifice reduces PAYG (lower taxable income).
    expect(withSacrifice.paygWithholding.lt(base.paygWithholding)).toBe(true);
  });

  it('monthly GROSS annualises to amount × 12', () => {
    const r = processSalaryDecimal(
      { amount: 7_500, salaryType: 'GROSS', payFrequency: 'MONTHLY' },
      config,
    );
    expect(r.grossSalary.toString()).toBe('90000');
    expect(r.perPeriod.frequency).toBe('MONTHLY');
    // perPeriod.gross = 90_000 / 12 = 7500
    expect(r.perPeriod.gross.toString()).toBe('7500');
  });
});

describe('PR 2.D.3d — full shadow report', () => {
  it('every fixture across both composer engines PASSes', async () => {
    const report = await runShadowComparisonReport([...taxEngineComposerShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map(
          (r) =>
            `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`,
        )
        .join('\n');
      throw new Error(`PR 2.D.3d shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
