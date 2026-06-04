/**
 * Q-DEC PR 2.D.1 — Shadow + contract tests for `lib/tax-engine/core/*`.
 */

import { describe, it, expect } from 'vitest';
import {
  incomeTaxShadow,
  paygShadow,
  medicareLevyShadow,
  taxOffsetsShadow,
  taxEngineCoreShadowEngines,
} from '@/lib/calc-audit/engines/decimal-tax-engine-core';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';
import { calculateIncomeTaxDecimal } from '@/lib/tax-engine/core/incomeTaxCalculator';
import { calculatePAYGDecimal } from '@/lib/tax-engine/core/paygCalculator';
import { calculateMedicareLevyDecimal } from '@/lib/tax-engine/core/medicareLevyCalculator';
import {
  calculateAllOffsetsDecimal,
  applyOffsetsDecimal,
  calculateLITODecimal,
} from '@/lib/tax-engine/core/taxOffsets';

describe('incomeTax — Float vs Decimal shadow', () => {
  it.each(incomeTaxShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(incomeTaxShadow, fixture);
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

describe('payg — Float vs Decimal shadow', () => {
  it.each(paygShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(paygShadow, fixture);
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

describe('medicareLevy — Float vs Decimal shadow', () => {
  it.each(medicareLevyShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(medicareLevyShadow, fixture);
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

describe('taxOffsets — Float vs Decimal shadow', () => {
  it.each(taxOffsetsShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(taxOffsetsShadow, fixture);
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
// Decimal contract checks
// ---------------------------------------------------------------------------

describe('Decimal contracts', () => {
  it('incomeTax: tax-free threshold returns zero tax', () => {
    const r = calculateIncomeTaxDecimal(15000);
    expect(r.taxPayable.toString()).toBe('0');
    expect(r.effectiveRate.toString()).toBe('0');
  });

  it('payg: tax-free under-threshold weekly returns zero withholding', () => {
    const r = calculatePAYGDecimal({ grossIncome: 300, frequency: 'WEEKLY' });
    expect(r.weeklyWithholding.toString()).toBe('0');
    expect(r.annualWithholding.toString()).toBe('0');
  });

  it('payg: weekly withholding always rounds to whole dollar (ATO NAT 1004)', () => {
    const r = calculatePAYGDecimal({ grossIncome: 1500, frequency: 'WEEKLY' });
    expect(r.weeklyWithholding.toDecimalPlaces(0).equals(r.weeklyWithholding)).toBe(true);
  });

  it('medicareLevy: exemption returns all-zero', () => {
    const r = calculateMedicareLevyDecimal({ taxableIncome: 90000, hasMedicareExemption: true });
    expect(r.total.toString()).toBe('0');
    expect(r.isExempt).toBe(true);
  });

  it('medicareLevy: high earner without PHI gets surcharge', () => {
    const r = calculateMedicareLevyDecimal({ taxableIncome: 150000, hasPrivateHealthInsurance: false });
    expect(r.medicareSurcharge.gt(0)).toBe(true);
  });

  it('LITO: full offset under threshold', () => {
    const r = calculateLITODecimal(30000);
    expect(r.offset.gt(0)).toBe(true);
  });

  it('LITO: zero offset above cutoff', () => {
    const r = calculateLITODecimal(80000);
    expect(r.offset.toString()).toBe('0');
  });

  it('applyOffsetsDecimal: non-refundable offsets floor at zero', () => {
    const grossTax = new Decimal(500);
    const result = applyOffsetsDecimal(grossTax, {
      lito: new Decimal(700),
      sapto: new Decimal(0),
      frankingCredits: new Decimal(0),
      foreignTax: new Decimal(0),
      other: new Decimal(0),
      total: new Decimal(700),
    });
    // LITO is non-refundable; can reduce 500 → 0 but not into negative.
    expect(result.netTax.toString()).toBe('0');
    expect(result.refundableAmount.toString()).toBe('0');
    expect(result.usedOffsets.lito.toString()).toBe('500'); // capped at grossTax
  });

  it('applyOffsetsDecimal: franking credits create refund when they exceed remaining tax', () => {
    const grossTax = new Decimal(500);
    const result = applyOffsetsDecimal(grossTax, {
      lito: new Decimal(0),
      sapto: new Decimal(0),
      frankingCredits: new Decimal(1500),
      foreignTax: new Decimal(0),
      other: new Decimal(0),
      total: new Decimal(1500),
    });
    expect(result.netTax.toString()).toBe('-1000'); // 500 - 1500
    expect(result.refundableAmount.toString()).toBe('1000');
  });
});

// ---------------------------------------------------------------------------
// Aggregate report
// ---------------------------------------------------------------------------

describe('PR 2.D.1 — full shadow report', () => {
  it('every fixture across all 4 engines PASSes', async () => {
    const report = await runShadowComparisonReport([...taxEngineCoreShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map(
          (r) =>
            `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`,
        )
        .join('\n');
      throw new Error(`PR 2.D.1 shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
