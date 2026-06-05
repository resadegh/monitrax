/**
 * Q-DEC PR 2.D.3a — Shadow + contract tests for state-tax engines
 * (gst + stampDuty + landTax + crossStateAggregator).
 */

import { describe, it, expect } from 'vitest';
import {
  gstShadow,
  stampDutyShadow,
  landTaxShadow,
  crossStateLandTaxShadow,
  taxEngineStateShadowEngines,
} from '@/lib/calc-audit/engines/decimal-tax-engine-state';
import {
  runShadowComparison,
  runShadowComparisonReport,
} from '@/lib/calc-audit/shadowComparison';
import { Decimal } from '@/lib/decimal';
import { calculateGstDecimal } from '@/lib/tax-engine/gst/gstCalculator';
import {
  calculateStampDutyDecimal,
  getStampDutyConfig,
} from '@/lib/tax-engine/stampDuty/stateStampDuty';
import {
  calculateLandTaxDecimal,
  getLandTaxConfig,
} from '@/lib/tax-engine/landTax/stateLandTax';
import { calculateCrossStateLandTaxDecimal } from '@/lib/tax-engine/landTax/crossStateAggregator';

describe('gst — Float vs Decimal shadow', () => {
  it.each(gstShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(gstShadow, fixture);
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

describe('stampDuty — Float vs Decimal shadow', () => {
  it.each(stampDutyShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(stampDutyShadow, fixture);
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

describe('landTax — Float vs Decimal shadow', () => {
  it.each(landTaxShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(landTaxShadow, fixture);
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

describe('crossStateLandTax — Float vs Decimal shadow', () => {
  it.each(crossStateLandTaxShadow.fixtures.map((f) => [f.name, f] as const))(
    'fixture %s — paths agree within tolerance',
    async (_name, fixture) => {
      const result = await runShadowComparison(crossStateLandTaxShadow, fixture);
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

describe('Decimal contracts', () => {
  it('GST: 10% on $1000 = exact $100', () => {
    const r = calculateGstDecimal({
      transactions: [
        { transactionId: 's1', supplyType: 'SALE', classification: 'TAXABLE', amountExcludingGst: 1000 },
      ],
      annualTurnover: 100000,
      isRegistered: true,
    });
    expect(r.gstCollected.toString()).toBe('100');
    expect(r.netGst.toString()).toBe('100');
  });

  it('GST: registration warning surfaces when turnover ≥ $75k unregistered', () => {
    const r = calculateGstDecimal({
      transactions: [],
      annualTurnover: 100000,
      isRegistered: false,
    });
    expect(r.uncomputed.find((u) => u.id === 'UC-GST-REGISTRATION-REQUIRED')).toBeTruthy();
  });

  it('Stamp duty NSW $1M owner-occupier — known result', () => {
    const r = calculateStampDutyDecimal(
      { dutiableValue: 1_000_000, purchaserType: 'INDIVIDUAL', isForeignPurchaser: false, isResidential: true },
      getStampDutyConfig('NSW'),
    );
    // Falls in $327,001-$1,089,000 bracket: 9,805 + (1,000,000 - 327,001 + 1) × 0.045 = 40,090.
    expect(r.generalDuty.toString()).toBe('40090');
    expect(r.foreignPurchaserSurcharge.toString()).toBe('0');
  });

  it('Stamp duty NT foreign purchaser surfaces UC-STAMP-DUTY-NT-NO-FPAD', () => {
    const r = calculateStampDutyDecimal(
      { dutiableValue: 700_000, purchaserType: 'INDIVIDUAL', isForeignPurchaser: true, isResidential: true },
      getStampDutyConfig('NT'),
    );
    expect(r.foreignPurchaserSurcharge.toString()).toBe('0');
    expect(r.uncomputed.find((u) => u.id === 'UC-STAMP-DUTY-NT-NO-FPAD')).toBeTruthy();
  });

  it('Land tax NSW below threshold = 0 general tax', () => {
    const r = calculateLandTaxDecimal(
      { taxableLandValue: 800_000, ownershipType: 'INDIVIDUAL', isForeignOwner: false, isResidential: true },
      getLandTaxConfig('NSW'),
    );
    expect(r.generalLandTax.toString()).toBe('0');
    expect(r.totalTax.toString()).toBe('0');
  });

  it('Land tax NSW $500k trust → 1.5% × min(value, $1.075M) = $7,500', () => {
    const r = calculateLandTaxDecimal(
      { taxableLandValue: 500_000, ownershipType: 'DISCRETIONARY_TRUST', isForeignOwner: false, isResidential: true },
      getLandTaxConfig('NSW'),
    );
    expect(r.trustSurcharge.toString()).toBe('7500');
  });

  it('Land tax NT structural zero + UC-NT-NO-LAND-TAX', () => {
    const r = calculateLandTaxDecimal(
      { taxableLandValue: 5_000_000, ownershipType: 'INDIVIDUAL', isForeignOwner: false, isResidential: true },
      getLandTaxConfig('NT'),
    );
    expect(r.totalTax.toString()).toBe('0');
    expect(r.uncomputed.find((u) => u.id === 'UC-NT-NO-LAND-TAX')).toBeTruthy();
  });

  it('Cross-state aggregates within-state, sorts alphabetically', () => {
    const r = calculateCrossStateLandTaxDecimal({
      properties: [
        { propertyId: 'p1', state: 'VIC', taxableLandValue: 400_000, isResidential: true },
        { propertyId: 'p2', state: 'NSW', taxableLandValue: 600_000, isResidential: true },
        { propertyId: 'p3', state: 'VIC', taxableLandValue: 400_000, isResidential: true },
      ],
      ownershipType: 'INDIVIDUAL',
      isForeignOwner: false,
    });
    expect(r.statesAssessed).toBe(2);
    // Sorted alphabetically: NSW first, VIC second.
    expect(r.perStateAssessments[0].state).toBe('NSW');
    expect(r.perStateAssessments[1].state).toBe('VIC');
    expect(r.perStateAssessments[0].aggregatedValue.toString()).toBe('600000');
    expect(r.perStateAssessments[1].aggregatedValue.toString()).toBe('800000'); // VIC parcels aggregated
  });
});

describe('PR 2.D.3a — full shadow report', () => {
  it('every fixture across all 4 state-tax engines PASSes', async () => {
    const report = await runShadowComparisonReport([...taxEngineStateShadowEngines]);
    expect(report.errored).toBe(0);
    if (report.diffed > 0) {
      const failures = report.results
        .filter((r) => r.status !== 'PASS')
        .map(
          (r) =>
            `${r.engineName}/${r.fixtureName}: ${r.failedFields.join(', ')}`,
        )
        .join('\n');
      throw new Error(`PR 2.D.3a shadow report had ${report.diffed} DIFFs:\n${failures}`);
    }
    expect(report.diffed).toBe(0);
    expect(report.passed).toBe(report.totalFixtures);
  });
});
