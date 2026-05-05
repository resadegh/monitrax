/**
 * Phase 41e.13 — Cross-state land tax aggregator tests.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCrossStateLandTax,
  type CrossStateLandTaxInput,
  type PortfolioProperty,
} from '@/lib/tax-engine/landTax/crossStateAggregator';

const prop = (
  o: Partial<PortfolioProperty> & Pick<PortfolioProperty, 'state'>,
): PortfolioProperty => ({
  propertyId: o.propertyId ?? 'p1',
  state: o.state,
  taxableLandValue: o.taxableLandValue ?? 1_000_000,
  isResidential: o.isResidential ?? true,
});

const input = (
  o: Partial<CrossStateLandTaxInput> = {},
): CrossStateLandTaxInput => ({
  properties: o.properties ?? [],
  ownershipType: o.ownershipType ?? 'INDIVIDUAL',
  isForeignOwner: o.isForeignOwner ?? false,
  configOverrides: o.configOverrides,
});

describe('calculateCrossStateLandTax — single state', () => {
  it('one NSW property @ $1.5M = same as direct calc', () => {
    const r = calculateCrossStateLandTax(
      input({
        properties: [prop({ state: 'NSW', taxableLandValue: 1_500_000 })],
      }),
    );
    expect(r.statesAssessed).toBe(1);
    expect(r.perStateAssessments[0].state).toBe('NSW');
    expect(r.perStateAssessments[0].aggregatedValue).toBe(1_500_000);
    expect(r.grandTotalGeneralTax).toBeCloseTo(6_900, 2);
    expect(r.grandTotalTax).toBeCloseTo(6_900, 2);
  });
});

describe('calculateCrossStateLandTax — within-state aggregation', () => {
  it('two VIC parcels at $400k each = aggregated to $800k for assessment', () => {
    const r = calculateCrossStateLandTax(
      input({
        properties: [
          prop({ propertyId: 'v1', state: 'VIC', taxableLandValue: 400_000 }),
          prop({ propertyId: 'v2', state: 'VIC', taxableLandValue: 400_000 }),
        ],
      }),
    );
    expect(r.statesAssessed).toBe(1);
    expect(r.perStateAssessments[0].aggregatedValue).toBe(800_000);
    expect(r.perStateAssessments[0].parcelCount).toBe(2);
    // VIC @ $800k = $3,950 + 1.25% × $200k = $6,450
    expect(r.grandTotalGeneralTax).toBeCloseTo(6_450, 2);
  });

  it('three VIC parcels each below threshold → assessed against aggregated value', () => {
    const r = calculateCrossStateLandTax(
      input({
        properties: [
          prop({ propertyId: 'v1', state: 'VIC', taxableLandValue: 30_000 }),
          prop({ propertyId: 'v2', state: 'VIC', taxableLandValue: 30_000 }),
          prop({ propertyId: 'v3', state: 'VIC', taxableLandValue: 30_000 }),
        ],
      }),
    );
    // Aggregated $90k > $50k VIC threshold → tax applies even though each parcel alone wouldn't
    expect(r.perStateAssessments[0].aggregatedValue).toBe(90_000);
    expect(r.grandTotalGeneralTax).toBeGreaterThan(0);
  });
});

describe('calculateCrossStateLandTax — across-state independent assessment', () => {
  it('NSW + VIC + QLD individual @ $1.5M each → independent thresholds', () => {
    const r = calculateCrossStateLandTax(
      input({
        properties: [
          prop({ propertyId: 'n1', state: 'NSW', taxableLandValue: 1_500_000 }),
          prop({ propertyId: 'v1', state: 'VIC', taxableLandValue: 1_500_000 }),
          prop({ propertyId: 'q1', state: 'QLD', taxableLandValue: 1_500_000 }),
        ],
      }),
    );
    expect(r.statesAssessed).toBe(3);
    // NSW @ $1.5M: $100 + 1.6% × $425k = $6,900
    // VIC @ $1.5M: $8,950 + 1.75% × $500k = $17,700
    // QLD @ $1.5M: $4,500 + 1.65% × $500k = $12,750
    // Total = $37,350
    expect(r.grandTotalGeneralTax).toBeCloseTo(6_900 + 17_700 + 12_750, 2);
  });

  it('per-state assessments returned in alphabetical order (NSW, QLD, VIC)', () => {
    const r = calculateCrossStateLandTax(
      input({
        properties: [
          prop({ state: 'VIC' }),
          prop({ state: 'NSW' }),
          prop({ state: 'QLD' }),
        ],
      }),
    );
    expect(r.perStateAssessments.map((a) => a.state)).toEqual(['NSW', 'QLD', 'VIC']);
  });
});

describe('calculateCrossStateLandTax — NT structural zero', () => {
  it('NT-only portfolio → $0 grand total + UC-NT-NO-LAND-TAX', () => {
    const r = calculateCrossStateLandTax(
      input({
        properties: [prop({ state: 'NT', taxableLandValue: 2_000_000 })],
      }),
    );
    expect(r.grandTotalTax).toBe(0);
    expect(r.uncomputed.some((u) => u.id === 'UC-NT-NO-LAND-TAX')).toBe(true);
  });

  it('mixed portfolio with NT property → NT contributes $0; other states unaffected', () => {
    const r = calculateCrossStateLandTax(
      input({
        properties: [
          prop({ state: 'NSW', taxableLandValue: 1_500_000 }),
          prop({ state: 'NT', taxableLandValue: 5_000_000 }),
        ],
      }),
    );
    expect(r.statesAssessed).toBe(2);
    expect(r.grandTotalGeneralTax).toBeCloseTo(6_900, 2); // only NSW
  });
});

describe('calculateCrossStateLandTax — foreign owner across states', () => {
  it('foreign individual: NSW residential surcharges, SA does not', () => {
    const r = calculateCrossStateLandTax(
      input({
        isForeignOwner: true,
        properties: [
          prop({ state: 'NSW', taxableLandValue: 1_000_000, isResidential: true }),
          prop({ state: 'SA', taxableLandValue: 1_000_000, isResidential: true }),
        ],
      }),
    );
    // NSW: 4% × $1M = $40,000
    // SA: $0 (no foreign land tax surcharge)
    expect(r.grandTotalForeignSurcharge).toBeCloseTo(40_000, 2);
  });

  it('foreign individual: VIC absentee covers all land (commercial too)', () => {
    const r = calculateCrossStateLandTax(
      input({
        isForeignOwner: true,
        properties: [
          prop({
            state: 'VIC',
            taxableLandValue: 1_000_000,
            isResidential: false,
          }),
        ],
      }),
    );
    // VIC: 4% × $1M = $40,000 (covers commercial)
    expect(r.grandTotalForeignSurcharge).toBeCloseTo(40_000, 2);
  });
});

describe('calculateCrossStateLandTax — citation + UNCOMPUTED de-dup', () => {
  it('multi-state portfolio de-dupes shared UC flags', () => {
    const r = calculateCrossStateLandTax(
      input({
        properties: [
          prop({ state: 'NSW', taxableLandValue: 1_500_000 }),
          prop({ state: 'VIC', taxableLandValue: 1_500_000 }),
        ],
      }),
    );
    // UC-MULTI-STATE-LAND-TAX should appear exactly once after de-dup
    const multiStateCount = r.uncomputed.filter(
      (u) => u.id === 'UC-MULTI-STATE-LAND-TAX',
    ).length;
    expect(multiStateCount).toBe(1);
  });

  it('always emits UC-LAND-TAX-JOINT-OWNERSHIP when at least one property', () => {
    const r = calculateCrossStateLandTax(
      input({
        properties: [prop({ state: 'NSW', taxableLandValue: 1_500_000 })],
      }),
    );
    expect(
      r.uncomputed.some((u) => u.id === 'UC-LAND-TAX-JOINT-OWNERSHIP'),
    ).toBe(true);
  });

  it('citations include all assessed states', () => {
    const r = calculateCrossStateLandTax(
      input({
        properties: [
          prop({ state: 'NSW', taxableLandValue: 1_500_000 }),
          prop({ state: 'VIC', taxableLandValue: 600_000 }),
        ],
      }),
    );
    expect(r.citations.some((c) => c.reference.includes('NSW Land Tax'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('VIC Land Tax'))).toBe(true);
  });
});

describe('calculateCrossStateLandTax — empty input', () => {
  it('empty portfolio → zeros, no states assessed, no UC flag from aggregator', () => {
    const r = calculateCrossStateLandTax(input({ properties: [] }));
    expect(r.statesAssessed).toBe(0);
    expect(r.grandTotalTax).toBe(0);
    expect(r.perStateAssessments).toEqual([]);
    // Empty portfolio doesn't surface UC-LAND-TAX-JOINT-OWNERSHIP
    expect(
      r.uncomputed.some((u) => u.id === 'UC-LAND-TAX-JOINT-OWNERSHIP'),
    ).toBe(false);
  });
});
