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

  // ---------------------------------------------------------------------
  // MA.1-005 (2026-06-07): ATO Schedule 1 NAT 1004 canonical formula
  //   y = a × x − b   where x = (whole dollars of weekly earnings) + 0.99
  // The "+ 0.99" trick means any cent-value within $X.00 – $X.99 produces
  // the SAME withholding. These tests pin that behaviour.
  // ---------------------------------------------------------------------

  it('payg MA.1-005: cents within $X.00–$X.99 produce the same withholding', () => {
    // $1500.00, $1500.50, $1500.99 should all yield identical weekly withholding
    // (per ATO §4 "x = whole dollars + 0.99").
    const r0 = calculatePAYGDecimal({ grossIncome: 1500.00, frequency: 'WEEKLY' });
    const r1 = calculatePAYGDecimal({ grossIncome: 1500.50, frequency: 'WEEKLY' });
    const r2 = calculatePAYGDecimal({ grossIncome: 1500.99, frequency: 'WEEKLY' });
    expect(r0.weeklyWithholding.toString()).toBe(r1.weeklyWithholding.toString());
    expect(r0.weeklyWithholding.toString()).toBe(r2.weeklyWithholding.toString());
    // $1501.00 lands in the NEXT whole-dollar band per ATO — should differ
    // from $1500.99 by approximately 1 × a (one cent up of band 866-2596).
    const r3 = calculatePAYGDecimal({ grossIncome: 1501.00, frequency: 'WEEKLY' });
    // Same rounded-dollar value most of the time (since a ≈ 0.32 < $0.50);
    // assertion is only "next whole dollar produces ≥ same withholding".
    expect(r3.weeklyWithholding.gte(r2.weeklyWithholding)).toBe(true);
  });

  it('payg MA.1-005: bracket-boundary $361.99 yields zero (boundary equivalence)', () => {
    // weeklyEarnings 361.99 falls through bracket-1 (max=361) and
    // bracket-2 (min=362) — withholding stays at the initialised 0.
    // ATO truth: $361.99 is in bracket 1 (≤ $361.99), a=0 → y=0. Same.
    // See MA.1-002 (boundary equivalence note in paygCalculator.ts header).
    const r = calculatePAYGDecimal({ grossIncome: 361.99, frequency: 'WEEKLY' });
    expect(r.weeklyWithholding.toString()).toBe('0');
  });

  it('payg MA.1-005: $362.00 enters bracket 2 (a=0.16, b=57.8462)', () => {
    // x = floor(362) + 0.99 = 362.99
    // raw = 0.16 × 362.99 - 57.8462 = 58.0784 - 57.8462 = 0.2322
    // round HALF_EVEN → 0
    const r = calculatePAYGDecimal({ grossIncome: 362.00, frequency: 'WEEKLY' });
    expect(r.weeklyWithholding.toString()).toBe('0');
  });

  it('payg MA.1-005: high-band boundary case $4000 (top bracket a=0.45)', () => {
    // x = 4000.99
    // raw = 0.45 × 4000.99 - 595.1058 = 1800.4455 - 595.1058 = 1205.3397
    // round HALF_EVEN → $1205
    const r = calculatePAYGDecimal({ grossIncome: 4000, frequency: 'WEEKLY' });
    expect(r.weeklyWithholding.toString()).toBe('1205');
  });

  it('payg MA.1-005: divergence point — $869.39 produces $101 (was $100 pre-fix)', () => {
    // Constructed boundary case demonstrating that the fix changes
    // rounded outcomes. At $869.39:
    //   Pre-fix:  0.3227 × 869.39 - 180.04 = $100.49 → round → $100
    //   Post-fix: x = floor(869.39) + 0.99 = 869.99
    //             0.3227 × 869.99 - 180.04 = $100.69 → round → $101
    // This is the canonical ATO answer per Schedule 1 NAT 1004.
    const r = calculatePAYGDecimal({ grossIncome: 869.39, frequency: 'WEEKLY' });
    expect(r.weeklyWithholding.toString()).toBe('101');
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
