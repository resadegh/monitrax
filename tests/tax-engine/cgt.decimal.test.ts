/**
 * Q-DEC PR 2.D.3b — Shadow + contract tests for CGT division engines.
 */

import { describe, it, expect } from 'vitest';
import {
  cgtDiscountShadow,
  capitalLossNettingShadow,
  taxEngineCgtShadowEngines,
} from '@/lib/calc-audit/engines/decimal-tax-engine-cgt';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';
import {
  calculateCgtDiscountDecimal,
} from '@/lib/tax-engine/divisions/cgtDiscount';
import {
  applyCapitalLossNettingDecimal,
} from '@/lib/tax-engine/divisions/capitalLossNetting';
import { applyCgtIndexationDecimal } from '@/lib/tax-engine/divisions/cgtIndexation';
import { applyCgtMinimumRateDecimal } from '@/lib/tax-engine/divisions/cgtMinimumRate';
import { applyForeignResidentCgtDecimal } from '@/lib/tax-engine/divisions/foreignResidentCgt';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';

const config = getCurrentTaxYearConfig();

describe('cgtDiscount — Float vs Decimal shadow', () => {
  it.each(cgtDiscountShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(cgtDiscountShadow, fixture);
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

describe('capitalLossNetting — Float vs Decimal shadow', () => {
  it.each(capitalLossNettingShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(capitalLossNettingShadow, fixture);
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

describe('cgtDiscountDecimal contracts', () => {
  it('PERSONAL_NAME 50% on $100k = $50k discounted', () => {
    const r = calculateCgtDiscountDecimal({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 24,
      nominalGain: 100_000,
    });
    expect(r.discountRate.toString()).toBe('0.5');
    expect(r.discountAmount.toString()).toBe('50000');
    expect(r.discountedGain.toString()).toBe('50000');
  });

  it('COMPANY no discount on $100k', () => {
    const r = calculateCgtDiscountDecimal({
      entityType: 'COMPANY',
      monthsHeld: 36,
      nominalGain: 100_000,
    });
    expect(r.discountRate.toString()).toBe('0');
    expect(r.discountAmount.toString()).toBe('0');
    expect(r.discountedGain.toString()).toBe('100000');
  });

  it('held < 12 months = no discount even for individual', () => {
    const r = calculateCgtDiscountDecimal({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 6,
      nominalGain: 50_000,
    });
    expect(r.metHoldingPeriod).toBe(false);
    expect(r.discountAmount.toString()).toBe('0');
    expect(r.discountedGain.toString()).toBe('50000');
  });

  it('negative gain → discountAmount floored at 0', () => {
    const r = calculateCgtDiscountDecimal({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 24,
      nominalGain: -5000,
    });
    expect(r.discountAmount.toString()).toBe('0');
    expect(r.discountedGain.toString()).toBe('-5000');
  });

  it('SMSF complying 1/3 discount preserves precision', () => {
    const r = calculateCgtDiscountDecimal({
      entityType: 'SMSF',
      monthsHeld: 24,
      nominalGain: 90_000,
    });
    // 90000 × (1/3) = 30000.
    expect(r.discountAmount.toDecimalPlaces(2).toString()).toBe('30000');
    expect(r.discountedGain.toDecimalPlaces(2).toString()).toBe('60000');
  });
});

describe('capitalLossNetting Decimal contracts', () => {
  it('gain only → discounted, no carry-forward', () => {
    const r = applyCapitalLossNettingDecimal({
      entityType: 'PERSONAL_NAME',
      events: [{ id: 'e1', monthsHeld: 24, nominalAmount: 100_000 }],
    });
    expect(r.totalNominalGains.toString()).toBe('100000');
    expect(r.netGainBeforeDiscount.toString()).toBe('100000');
    expect(r.assessableNetCapitalGain.toString()).toBe('50000');
    expect(r.carryForwardOut.toString()).toBe('0');
  });

  it('losses > gains → 0 assessable, residual to carry-forward', () => {
    const r = applyCapitalLossNettingDecimal({
      entityType: 'PERSONAL_NAME',
      events: [
        { id: 'e1', monthsHeld: 24, nominalAmount: 30_000 },
        { id: 'e2', monthsHeld: 18, nominalAmount: -50_000 },
      ],
    });
    expect(r.netGainBeforeDiscount.toString()).toBe('0');
    expect(r.assessableNetCapitalGain.toString()).toBe('0');
    expect(r.carryForwardOut.toString()).toBe('20000');
  });

  it('prior-year + current-year losses both reduce gains', () => {
    const r = applyCapitalLossNettingDecimal({
      entityType: 'PERSONAL_NAME',
      events: [
        { id: 'e1', monthsHeld: 24, nominalAmount: 80_000 },
        { id: 'e2', monthsHeld: 12, nominalAmount: -20_000 },
      ],
      carryForwardLosses: [
        { financialYear: '2022-23', amount: 15_000 },
        { financialYear: '2023-24', amount: 15_000 },
      ],
    });
    expect(r.totalPriorYearLosses.toString()).toBe('30000');
    expect(r.netGainBeforeDiscount.toString()).toBe('30000');
    expect(r.assessableNetCapitalGain.toString()).toBe('15000'); // 50% discount on $30k
  });

  it('mixed holding periods surfaces UC-CGT-MIXED-HOLDING', () => {
    const r = applyCapitalLossNettingDecimal({
      entityType: 'PERSONAL_NAME',
      events: [
        { id: 'e1', monthsHeld: 24, nominalAmount: 50_000 },
        { id: 'e2', monthsHeld: 8, nominalAmount: 30_000 },
      ],
    });
    expect(r.uncomputed.find((u) => u.id === 'UC-CGT-MIXED-HOLDING')).toBeTruthy();
  });
});

describe('Skeleton modules — Stage 1 UNCOMPUTED preserved (§12.14 FW-2)', () => {
  it('cgtIndexationDecimal returns UNCOMPUTED when commencement unverified', () => {
    const r = applyCgtIndexationDecimal({
      costBase: 100_000,
      acquisitionQuarter: '2027-Q3',
      disposalQuarter: '2030-Q1',
      saleProceeds: 200_000,
      config: { ...config, cgtIndexationCommencementVerified: false },
    });
    expect(r.computed).toBe(false);
    expect(r.indexedCostBase.toString()).toBe('0');
    expect(r.indexedGain.toString()).toBe('0');
    expect(r.uncomputed.find((u) => u.id === 'UC-CGT-INDEXATION-PENDING-EXPOSURE-DRAFT')).toBeTruthy();
  });

  it('cgtMinimumRateDecimal returns UNCOMPUTED when commencement unverified', () => {
    const r = applyCgtMinimumRateDecimal({
      indexedGain: 50_000,
      marginalRate: 0.30,
      config: { ...config, cgtMinRateCommencementVerified: false },
    });
    expect(r.computed).toBe(false);
    expect(r.taxPayable.toString()).toBe('0');
    expect(r.uncomputed.find((u) => u.id === 'UC-CGT-MIN-RATE-PENDING-EXPOSURE-DRAFT')).toBeTruthy();
  });

  it('foreignResidentCgtDecimal — domestic entity returns inScope=false', () => {
    const r = applyForeignResidentCgtDecimal({
      entityId: 'entity-A',
      isForeignResident: false,
      nominalGain: 100_000,
      disposalValue: 60_000_000,
      config,
      fy: '2027-28',
    });
    expect(r.inScope).toBe(false);
    expect(r.computed).toBe(true);
    expect(r.taxPayable.toString()).toBe('0');
  });

  it('foreignResidentCgtDecimal — foreign + unverified → UNCOMPUTED, surfaces >$50M flag', () => {
    const r = applyForeignResidentCgtDecimal({
      entityId: 'entity-B',
      isForeignResident: true,
      nominalGain: 5_000_000,
      disposalValue: 75_000_000,
      config: { ...config, foreignResidentCgtCommencementVerified: false },
      fy: '2027-28',
    });
    expect(r.inScope).toBe(true);
    expect(r.computed).toBe(false);
    expect(r.triggersNotification).toBe(true);
    expect(r.uncomputed.find((u) => u.id === 'UC-FR-CGT-PENDING-ROYAL-ASSENT')).toBeTruthy();
  });
});

describe('§12.14 FW-1 reform regime guard preserved on Decimal sibling', () => {
  it('cgtDiscountDecimal POST_REFORM branch fires when all 3 gates align', () => {
    const POST_REFORM_DATE = new Date('2026-06-01T00:00:00Z'); // after 2026-05-12T09:30:00Z cut-over
    const r = calculateCgtDiscountDecimal({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 24,
      nominalGain: 100_000,
      acquisitionContractDate: POST_REFORM_DATE,
      disposalFy: '2027-28',
      config: { ...config, cgtIndexationCommencementVerified: true },
    });
    expect(r.discountRate.toString()).toBe('0');
    expect(r.discountAmount.toString()).toBe('0');
    expect(r.discountedGain.toString()).toBe('100000');
    expect(r.reason).toContain('POST_REFORM');
  });

  it('cgtDiscountDecimal POST_REFORM does NOT fire when commencement unverified (FW-2)', () => {
    const POST_REFORM_DATE = new Date('2026-06-01T00:00:00Z');
    const r = calculateCgtDiscountDecimal({
      entityType: 'PERSONAL_NAME',
      monthsHeld: 24,
      nominalGain: 100_000,
      acquisitionContractDate: POST_REFORM_DATE,
      disposalFy: '2027-28',
      config: { ...config, cgtIndexationCommencementVerified: false },
    });
    expect(r.discountRate.toString()).toBe('0.5');
    expect(r.discountAmount.toString()).toBe('50000');
  });
});

describe('PR 2.D.3b — full shadow report', () => {
  it('every fixture across both CGT shadow engines PASSes', async () => {
    const report = await runShadowComparisonReport([...taxEngineCgtShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map(
          (r) =>
            `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`,
        )
        .join('\n');
      throw new Error(`PR 2.D.3b shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
