/**
 * Phase 41E reform 2026-27 — Stage 1 foundation tests.
 *
 * Pins the canonical cut-over moment + per-measure commencement helpers
 * against the spec in `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10.
 *
 * **Boundary-day discipline:** these tests are the wall between "user
 * is grandfathered" and "user is post-reform restricted" — getting any
 * second wrong here moves real users into the wrong regime. Each
 * boundary is tested at the second.
 */

import { describe, it, expect } from 'vitest';
import {
  REFORM_CUT_OVER_UTC,
  REFORM_CUT_OVER_AEST_LABEL,
  MEASURE_COMMENCEMENT,
  MEASURE_LABEL,
  classifyAcquisitionGrandfathering,
  isPostCommencementFy,
  type ReformMeasure,
} from '@/lib/tax-engine/config/reformConstants';

describe('Phase 41E — REFORM_CUT_OVER_UTC', () => {
  it('is exactly 7:30pm AEST on 12 May 2026 = 2026-05-12T09:30:00Z UTC', () => {
    // AEST is UTC+10. 7:30pm AEST = 09:30 UTC same day. By 12 May
    // daylight saving (AEDT, UTC+11) has ended (first Sunday of April).
    expect(REFORM_CUT_OVER_UTC.toISOString()).toBe('2026-05-12T09:30:00.000Z');
  });

  it('label reads naturally to AU users (AEST not UTC)', () => {
    expect(REFORM_CUT_OVER_AEST_LABEL).toBe('7:30pm AEST 12 May 2026');
  });
});

describe('Phase 41E — classifyAcquisitionGrandfathering', () => {
  it('null contract date returns UNKNOWN', () => {
    expect(classifyAcquisitionGrandfathering(null)).toBe('UNKNOWN');
    expect(classifyAcquisitionGrandfathering(undefined)).toBe('UNKNOWN');
  });

  it('contract signed at the exact cut-over moment is GRANDFATHERED (inclusive)', () => {
    // Treasury fact sheet: "at or before 7:30pm AEST on 12 May 2026"
    // — the boundary is inclusive of grandfathering.
    const exactCutOver = new Date('2026-05-12T09:30:00Z');
    expect(classifyAcquisitionGrandfathering(exactCutOver)).toBe('GRANDFATHERED');
  });

  it('contract signed ONE SECOND before the cut-over is GRANDFATHERED', () => {
    const oneSecondBefore = new Date('2026-05-12T09:29:59Z');
    expect(classifyAcquisitionGrandfathering(oneSecondBefore)).toBe('GRANDFATHERED');
  });

  it('contract signed ONE SECOND after the cut-over is POST_REFORM', () => {
    // This is the most important boundary in the entire reform.
    // A property contracted at 09:30:01 UTC on 12 May 2026 falls
    // under the new regime. Getting this wrong by a second moves a
    // real user from grandfathered (untouchable) to post-reform
    // (restricted negative gearing + indexation CGT).
    const oneSecondAfter = new Date('2026-05-12T09:30:01Z');
    expect(classifyAcquisitionGrandfathering(oneSecondAfter)).toBe('POST_REFORM');
  });

  it('contracts well before the cut-over are GRANDFATHERED', () => {
    expect(classifyAcquisitionGrandfathering(new Date('2020-01-01T00:00:00Z'))).toBe('GRANDFATHERED');
    expect(classifyAcquisitionGrandfathering(new Date('2025-12-31T23:59:59Z'))).toBe('GRANDFATHERED');
    expect(classifyAcquisitionGrandfathering(new Date('2026-05-11T00:00:00Z'))).toBe('GRANDFATHERED');
  });

  it('contracts well after the cut-over are POST_REFORM', () => {
    expect(classifyAcquisitionGrandfathering(new Date('2026-05-13T00:00:00Z'))).toBe('POST_REFORM');
    expect(classifyAcquisitionGrandfathering(new Date('2026-07-01T00:00:00Z'))).toBe('POST_REFORM');
    expect(classifyAcquisitionGrandfathering(new Date('2030-01-01T00:00:00Z'))).toBe('POST_REFORM');
  });
});

describe('Phase 41E — MEASURE_COMMENCEMENT', () => {
  it('covers all 9 measures (closed discriminant)', () => {
    const measures: ReformMeasure[] = [
      'NEGATIVE_GEARING_NEW_BUILDS_ONLY',
      'CGT_INDEXATION_PLUS_MIN_RATE',
      'TRUST_MINIMUM_TAX',
      'FOREIGN_RESIDENT_CGT',
      'LOSS_REFUNDABILITY',
      'FOREIGN_PURCHASE_BAN',
      'VC_CAPS_LIFTED',
      'EV_FBT_PHASED',
      'DYNAMIC_PAYG',
    ];
    for (const m of measures) {
      expect(MEASURE_COMMENCEMENT[m]).toBeInstanceOf(Date);
      expect(MEASURE_LABEL[m]).toMatch(/Phase 41E Measure/);
    }
  });

  it('M1 (negative gearing) commences 1 Jul 2027 AEST', () => {
    // 1 Jul 2027 00:00 AEST = 30 Jun 2027 14:00 UTC
    expect(MEASURE_COMMENCEMENT.NEGATIVE_GEARING_NEW_BUILDS_ONLY.toISOString()).toBe(
      '2027-06-30T14:00:00.000Z',
    );
  });

  it('M2 (CGT indexation + 30% floor) commences 1 Jul 2027 AEST', () => {
    expect(MEASURE_COMMENCEMENT.CGT_INDEXATION_PLUS_MIN_RATE.toISOString()).toBe(
      '2027-06-30T14:00:00.000Z',
    );
  });

  it('M3 (trust 30% min tax) commences 1 Jul 2028 AEST', () => {
    expect(MEASURE_COMMENCEMENT.TRUST_MINIMUM_TAX.toISOString()).toBe(
      '2028-06-30T14:00:00.000Z',
    );
  });

  it('M5 (loss carry-back) commences 1 Jul 2026 AEST — current FY 2026-27', () => {
    expect(MEASURE_COMMENCEMENT.LOSS_REFUNDABILITY.toISOString()).toBe(
      '2026-06-30T14:00:00.000Z',
    );
  });
});

describe('Phase 41E — isPostCommencementFy', () => {
  it('FY 2025-26 is pre-commencement for every Tier 1 measure', () => {
    expect(isPostCommencementFy('2025-26', 'NEGATIVE_GEARING_NEW_BUILDS_ONLY')).toBe(false);
    expect(isPostCommencementFy('2025-26', 'CGT_INDEXATION_PLUS_MIN_RATE')).toBe(false);
    expect(isPostCommencementFy('2025-26', 'TRUST_MINIMUM_TAX')).toBe(false);
    expect(isPostCommencementFy('2025-26', 'LOSS_REFUNDABILITY')).toBe(false);
  });

  it('FY 2026-27 is post-commencement for M5 (loss refundability) only among Tier 1', () => {
    expect(isPostCommencementFy('2026-27', 'LOSS_REFUNDABILITY')).toBe(true);
    expect(isPostCommencementFy('2026-27', 'NEGATIVE_GEARING_NEW_BUILDS_ONLY')).toBe(false);
    expect(isPostCommencementFy('2026-27', 'CGT_INDEXATION_PLUS_MIN_RATE')).toBe(false);
    expect(isPostCommencementFy('2026-27', 'TRUST_MINIMUM_TAX')).toBe(false);
  });

  it('FY 2027-28 is post-commencement for M1 + M2 + M5 + M7 + M9 but NOT M3', () => {
    expect(isPostCommencementFy('2027-28', 'NEGATIVE_GEARING_NEW_BUILDS_ONLY')).toBe(true);
    expect(isPostCommencementFy('2027-28', 'CGT_INDEXATION_PLUS_MIN_RATE')).toBe(true);
    expect(isPostCommencementFy('2027-28', 'LOSS_REFUNDABILITY')).toBe(true);
    expect(isPostCommencementFy('2027-28', 'VC_CAPS_LIFTED')).toBe(true);
    expect(isPostCommencementFy('2027-28', 'DYNAMIC_PAYG')).toBe(true);
    expect(isPostCommencementFy('2027-28', 'TRUST_MINIMUM_TAX')).toBe(false); // M3 commences FY28-29
  });

  it('FY 2028-29 is post-commencement for every measure', () => {
    expect(isPostCommencementFy('2028-29', 'NEGATIVE_GEARING_NEW_BUILDS_ONLY')).toBe(true);
    expect(isPostCommencementFy('2028-29', 'CGT_INDEXATION_PLUS_MIN_RATE')).toBe(true);
    expect(isPostCommencementFy('2028-29', 'TRUST_MINIMUM_TAX')).toBe(true);
    expect(isPostCommencementFy('2028-29', 'LOSS_REFUNDABILITY')).toBe(true);
  });

  it('throws on invalid FY format', () => {
    expect(() => isPostCommencementFy('2025', 'NEGATIVE_GEARING_NEW_BUILDS_ONLY')).toThrow(
      /Invalid FY format/,
    );
    expect(() => isPostCommencementFy('FY25-26', 'NEGATIVE_GEARING_NEW_BUILDS_ONLY')).toThrow(
      /Invalid FY format/,
    );
    expect(() => isPostCommencementFy('', 'NEGATIVE_GEARING_NEW_BUILDS_ONLY')).toThrow(
      /Invalid FY format/,
    );
  });
});

describe('Phase 41E — MEASURE_LABEL', () => {
  it('every measure has a label naming "Phase 41E Measure N"', () => {
    expect(MEASURE_LABEL.NEGATIVE_GEARING_NEW_BUILDS_ONLY).toMatch(/Measure 1/);
    expect(MEASURE_LABEL.CGT_INDEXATION_PLUS_MIN_RATE).toMatch(/Measure 2/);
    expect(MEASURE_LABEL.TRUST_MINIMUM_TAX).toMatch(/Measure 3/);
    expect(MEASURE_LABEL.FOREIGN_RESIDENT_CGT).toMatch(/Measure 4/);
    expect(MEASURE_LABEL.LOSS_REFUNDABILITY).toMatch(/Measure 5/);
    expect(MEASURE_LABEL.FOREIGN_PURCHASE_BAN).toMatch(/Measure 6/);
    expect(MEASURE_LABEL.VC_CAPS_LIFTED).toMatch(/Measure 7/);
    expect(MEASURE_LABEL.EV_FBT_PHASED).toMatch(/Measure 8/);
    expect(MEASURE_LABEL.DYNAMIC_PAYG).toMatch(/Measure 9/);
  });
});
