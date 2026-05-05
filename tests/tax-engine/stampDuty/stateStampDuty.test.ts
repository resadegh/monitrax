/**
 * Phase 41e.14 — Stamp duty + foreign purchaser surcharge tests.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateStampDuty,
  getStampDutyConfig,
  NSW_STAMP_DUTY_FY2024_25,
  VIC_STAMP_DUTY_FY2024_25,
  QLD_STAMP_DUTY_FY2024_25,
  SA_STAMP_DUTY_FY2024_25,
  WA_STAMP_DUTY_FY2024_25,
  TAS_STAMP_DUTY_FY2024_25,
  ACT_STAMP_DUTY_FY2024_25,
  NT_STAMP_DUTY_FY2024_25,
  type StampDutyInput,
} from '@/lib/tax-engine/stampDuty/stateStampDuty';

const baseInput = (
  o: Partial<StampDutyInput> = {},
): StampDutyInput => ({
  dutiableValue: 0,
  purchaserType: 'INDIVIDUAL',
  isForeignPurchaser: false,
  isResidential: true,
  ...o,
});

describe('calculateStampDuty — NSW', () => {
  it('NSW @ $500k → $9,805 + 4.5% × $173k = $17,590', () => {
    const r = calculateStampDuty(baseInput({ dutiableValue: 500_000 }), NSW_STAMP_DUTY_FY2024_25);
    expect(r.generalDuty).toBeCloseTo(17_590, 2);
  });

  it('NSW @ $1M → $9,805 + 4.5% × $673k = $40,090', () => {
    const r = calculateStampDuty(baseInput({ dutiableValue: 1_000_000 }), NSW_STAMP_DUTY_FY2024_25);
    expect(r.generalDuty).toBeCloseTo(40_090, 2);
  });

  it('NSW foreign + residential @ $1M → 8% FPAD = $80,000', () => {
    const r = calculateStampDuty(
      baseInput({ dutiableValue: 1_000_000, isForeignPurchaser: true, isResidential: true }),
      NSW_STAMP_DUTY_FY2024_25,
    );
    expect(r.foreignPurchaserSurcharge).toBeCloseTo(80_000, 2);
    expect(r.totalDuty).toBeCloseTo(40_090 + 80_000, 2);
  });

  it('NSW foreign + non-residential → no FPAD', () => {
    const r = calculateStampDuty(
      baseInput({ dutiableValue: 1_000_000, isForeignPurchaser: true, isResidential: false }),
      NSW_STAMP_DUTY_FY2024_25,
    );
    expect(r.foreignPurchaserSurcharge).toBe(0);
  });
});

describe('calculateStampDuty — VIC', () => {
  it('VIC @ $500k → $2,870 + 6% × $370k = $25,070', () => {
    const r = calculateStampDuty(baseInput({ dutiableValue: 500_000 }), VIC_STAMP_DUTY_FY2024_25);
    expect(r.generalDuty).toBeCloseTo(25_070, 2);
  });

  it('VIC foreign 8% (raised from 7% in 2024)', () => {
    const r = calculateStampDuty(
      baseInput({ dutiableValue: 1_000_000, isForeignPurchaser: true, isResidential: true }),
      VIC_STAMP_DUTY_FY2024_25,
    );
    expect(r.foreignPurchaserSurcharge).toBeCloseTo(80_000, 2);
  });
});

describe('calculateStampDuty — QLD', () => {
  it('QLD @ $540k → $1,050 + 3.5% × $465k = $17,325', () => {
    const r = calculateStampDuty(baseInput({ dutiableValue: 540_000 }), QLD_STAMP_DUTY_FY2024_25);
    expect(r.generalDuty).toBeCloseTo(17_325, 2);
  });

  it('QLD AFAD 8% (raised 2024)', () => {
    const r = calculateStampDuty(
      baseInput({ dutiableValue: 1_000_000, isForeignPurchaser: true, isResidential: true }),
      QLD_STAMP_DUTY_FY2024_25,
    );
    expect(r.foreignPurchaserSurcharge).toBeCloseTo(80_000, 2);
  });
});

describe('calculateStampDuty — SA / WA / TAS / ACT', () => {
  it('SA @ $500k → $11,330 + 5% × $200k = $21,330', () => {
    const r = calculateStampDuty(baseInput({ dutiableValue: 500_000 }), SA_STAMP_DUTY_FY2024_25);
    expect(r.generalDuty).toBeCloseTo(21_330, 2);
  });

  it('SA foreign 7%', () => {
    const r = calculateStampDuty(
      baseInput({ dutiableValue: 1_000_000, isForeignPurchaser: true, isResidential: true }),
      SA_STAMP_DUTY_FY2024_25,
    );
    expect(r.foreignPurchaserSurcharge).toBeCloseTo(70_000, 2);
  });

  it('WA foreign 7%', () => {
    const r = calculateStampDuty(
      baseInput({ dutiableValue: 1_000_000, isForeignPurchaser: true, isResidential: true }),
      WA_STAMP_DUTY_FY2024_25,
    );
    expect(r.foreignPurchaserSurcharge).toBeCloseTo(70_000, 2);
  });

  it('TAS FBI 8% (raised 2024)', () => {
    const r = calculateStampDuty(
      baseInput({ dutiableValue: 1_000_000, isForeignPurchaser: true, isResidential: true }),
      TAS_STAMP_DUTY_FY2024_25,
    );
    expect(r.foreignPurchaserSurcharge).toBeCloseTo(80_000, 2);
  });

  it('ACT foreign 0.75% (lowest in AU)', () => {
    const r = calculateStampDuty(
      baseInput({ dutiableValue: 1_000_000, isForeignPurchaser: true, isResidential: true }),
      ACT_STAMP_DUTY_FY2024_25,
    );
    expect(r.foreignPurchaserSurcharge).toBeCloseTo(7_500, 2);
  });
});

describe('calculateStampDuty — NT (no FPAD)', () => {
  it('NT @ $500k still has general duty', () => {
    const r = calculateStampDuty(baseInput({ dutiableValue: 500_000 }), NT_STAMP_DUTY_FY2024_25);
    expect(r.generalDuty).toBeGreaterThan(0);
  });

  it('NT foreign purchaser → no FPAD + UC-STAMP-DUTY-NT-NO-FPAD', () => {
    const r = calculateStampDuty(
      baseInput({ dutiableValue: 1_000_000, isForeignPurchaser: true, isResidential: true }),
      NT_STAMP_DUTY_FY2024_25,
    );
    expect(r.foreignPurchaserSurcharge).toBe(0);
    expect(r.uncomputed.some((u) => u.id === 'UC-STAMP-DUTY-NT-NO-FPAD')).toBe(true);
  });
});

describe('calculateStampDuty — concessions + UNCOMPUTED', () => {
  it('asserted concession surfaces UC-STAMP-DUTY-CONCESSION', () => {
    const r = calculateStampDuty(
      baseInput({ dutiableValue: 500_000, assertsFirstHomeOrConcession: true }),
      NSW_STAMP_DUTY_FY2024_25,
    );
    expect(r.uncomputed.some((u) => u.id === 'UC-STAMP-DUTY-CONCESSION')).toBe(true);
  });

  it('always surfaces UC-STAMP-DUTY-MULTI-PURCHASER + UC-STAMP-DUTY-NEW-BUILD', () => {
    const r = calculateStampDuty(baseInput({ dutiableValue: 500_000 }), NSW_STAMP_DUTY_FY2024_25);
    expect(r.uncomputed.some((u) => u.id === 'UC-STAMP-DUTY-MULTI-PURCHASER')).toBe(true);
    expect(r.uncomputed.some((u) => u.id === 'UC-STAMP-DUTY-NEW-BUILD')).toBe(true);
  });
});

describe('getStampDutyConfig', () => {
  it('returns correct config per state', () => {
    expect(getStampDutyConfig('NSW')).toBe(NSW_STAMP_DUTY_FY2024_25);
    expect(getStampDutyConfig('VIC')).toBe(VIC_STAMP_DUTY_FY2024_25);
    expect(getStampDutyConfig('QLD')).toBe(QLD_STAMP_DUTY_FY2024_25);
    expect(getStampDutyConfig('NT')).toBe(NT_STAMP_DUTY_FY2024_25);
  });

  it('all 8 states/territories supported', () => {
    expect(getStampDutyConfig('SA').state).toBe('SA');
    expect(getStampDutyConfig('WA').state).toBe('WA');
    expect(getStampDutyConfig('TAS').state).toBe('TAS');
    expect(getStampDutyConfig('ACT').state).toBe('ACT');
  });
});
