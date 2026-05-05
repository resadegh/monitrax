/**
 * Phase 41e.16 — GST / BAS calculator tests.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateGst,
  GST_RATE,
  GST_REGISTRATION_THRESHOLD,
  type GstInput,
} from '@/lib/tax-engine/gst/gstCalculator';

const baseInput = (o: Partial<GstInput> = {}): GstInput => ({
  transactions: [],
  annualTurnover: 100_000,
  isRegistered: true,
  ...o,
});

describe('calculateGst — constants', () => {
  it('GST_RATE = 10%', () => {
    expect(GST_RATE).toBe(0.1);
  });

  it('Registration threshold = $75,000', () => {
    expect(GST_REGISTRATION_THRESHOLD).toBe(75_000);
  });
});

describe('calculateGst — taxable sales (output GST)', () => {
  it('$1,000 taxable sale → $100 GST collected, $1,100 G1', () => {
    const r = calculateGst(
      baseInput({
        transactions: [
          {
            transactionId: 's1',
            supplyType: 'SALE',
            classification: 'TAXABLE',
            amountExcludingGst: 1_000,
          },
        ],
      }),
    );
    expect(r.gstCollected).toBe(100);
    expect(r.basLabels.G1).toBe(1_100);
    expect(r.basLabels.label_1A).toBe(100);
  });
});

describe('calculateGst — taxable purchases (input tax credits)', () => {
  it('$500 capital purchase → $50 ITC, $550 G10', () => {
    const r = calculateGst(
      baseInput({
        transactions: [
          {
            transactionId: 'p1',
            supplyType: 'CAPITAL_PURCHASE',
            classification: 'TAXABLE',
            amountExcludingGst: 500,
          },
        ],
      }),
    );
    expect(r.gstCreditsClaimable).toBe(50);
    expect(r.basLabels.G10).toBe(550);
    expect(r.basLabels.label_1B).toBe(50);
  });

  it('$200 non-capital purchase → $20 ITC, $220 G11', () => {
    const r = calculateGst(
      baseInput({
        transactions: [
          {
            transactionId: 'p2',
            supplyType: 'NON_CAPITAL_PURCHASE',
            classification: 'TAXABLE',
            amountExcludingGst: 200,
          },
        ],
      }),
    );
    expect(r.gstCreditsClaimable).toBe(20);
    expect(r.basLabels.G11).toBe(220);
  });
});

describe('calculateGst — GST-free supplies (s38)', () => {
  it('$1,000 GST-free export → G1 + G2 += 1000, no GST', () => {
    const r = calculateGst(
      baseInput({
        transactions: [
          {
            transactionId: 'exp1',
            supplyType: 'SALE',
            classification: 'GST_FREE',
            amountExcludingGst: 1_000,
            isExport: true,
          },
        ],
      }),
    );
    expect(r.gstCollected).toBe(0);
    expect(r.basLabels.G1).toBe(1_000);
    expect(r.basLabels.G2).toBe(1_000);
    expect(r.basLabels.G3).toBe(0);
  });

  it('$500 GST-free domestic sale → G1 + G3 += 500, no GST', () => {
    const r = calculateGst(
      baseInput({
        transactions: [
          {
            transactionId: 'food1',
            supplyType: 'SALE',
            classification: 'GST_FREE',
            amountExcludingGst: 500,
          },
        ],
      }),
    );
    expect(r.gstCollected).toBe(0);
    expect(r.basLabels.G3).toBe(500);
  });
});

describe('calculateGst — input-taxed supplies (s40)', () => {
  it('input-taxed sale (residential rent) → no GST collected, no G1 contribution', () => {
    const r = calculateGst(
      baseInput({
        transactions: [
          {
            transactionId: 'rent1',
            supplyType: 'SALE',
            classification: 'INPUT_TAXED',
            amountExcludingGst: 2_500,
          },
        ],
      }),
    );
    expect(r.gstCollected).toBe(0);
    expect(r.basLabels.G1).toBe(0); // input-taxed excluded from G1
  });

  it('input-taxed acquisition → no ITC, surfaces UC-GST-INPUT-TAXED-DENIAL', () => {
    const r = calculateGst(
      baseInput({
        transactions: [
          {
            transactionId: 'acq1',
            supplyType: 'NON_CAPITAL_PURCHASE',
            classification: 'INPUT_TAXED',
            amountExcludingGst: 1_000,
          },
        ],
      }),
    );
    expect(r.gstCreditsClaimable).toBe(0);
    expect(r.uncomputed.some((u) => u.id === 'UC-GST-INPUT-TAXED-DENIAL')).toBe(true);
  });
});

describe('calculateGst — reverse charge (Div 84)', () => {
  it('reverse-charge purchase → GST self-assessed + offsetting ITC, net 0', () => {
    const r = calculateGst(
      baseInput({
        transactions: [
          {
            transactionId: 'rc1',
            supplyType: 'NON_CAPITAL_PURCHASE',
            classification: 'TAXABLE',
            amountExcludingGst: 1_000,
            isReverseCharge: true,
          },
        ],
      }),
    );
    expect(r.gstCollected).toBe(100); // self-assessed
    expect(r.gstCreditsClaimable).toBe(100); // offsetting ITC
    expect(r.netGst).toBe(0);
  });
});

describe('calculateGst — net GST (1A - 1B)', () => {
  it('output > input → positive net GST (payable)', () => {
    const r = calculateGst(
      baseInput({
        transactions: [
          { transactionId: 's1', supplyType: 'SALE', classification: 'TAXABLE', amountExcludingGst: 10_000 },
          { transactionId: 'p1', supplyType: 'NON_CAPITAL_PURCHASE', classification: 'TAXABLE', amountExcludingGst: 3_000 },
        ],
      }),
    );
    expect(r.netGst).toBe(700); // 1000 - 300
  });

  it('input > output → negative net GST (refundable)', () => {
    const r = calculateGst(
      baseInput({
        transactions: [
          { transactionId: 's1', supplyType: 'SALE', classification: 'TAXABLE', amountExcludingGst: 1_000 },
          { transactionId: 'p1', supplyType: 'CAPITAL_PURCHASE', classification: 'TAXABLE', amountExcludingGst: 5_000 },
        ],
      }),
    );
    expect(r.netGst).toBe(-400); // 100 - 500
  });
});

describe('calculateGst — registration threshold', () => {
  it('unregistered + turnover ≥ $75k → UC-GST-REGISTRATION-REQUIRED', () => {
    const r = calculateGst(
      baseInput({
        annualTurnover: 80_000,
        isRegistered: false,
      }),
    );
    expect(r.uncomputed.some((u) => u.id === 'UC-GST-REGISTRATION-REQUIRED')).toBe(true);
  });

  it('unregistered + turnover < $75k → no registration UC', () => {
    const r = calculateGst(
      baseInput({
        annualTurnover: 50_000,
        isRegistered: false,
      }),
    );
    expect(r.uncomputed.some((u) => u.id === 'UC-GST-REGISTRATION-REQUIRED')).toBe(false);
  });

  it('registered + turnover ≥ $75k → no UC (compliant)', () => {
    const r = calculateGst(
      baseInput({
        annualTurnover: 200_000,
        isRegistered: true,
      }),
    );
    expect(r.uncomputed.some((u) => u.id === 'UC-GST-REGISTRATION-REQUIRED')).toBe(false);
  });
});

describe('calculateGst — UNCOMPUTED + citations', () => {
  it('always surfaces UC-GST-ADVANCED-DIVISIONS', () => {
    const r = calculateGst(baseInput());
    expect(r.uncomputed.some((u) => u.id === 'UC-GST-ADVANCED-DIVISIONS')).toBe(true);
  });

  it('cites GST Act s9-70 + s38 + s40 + s23-15', () => {
    const r = calculateGst(baseInput());
    expect(r.citations.some((c) => c.reference.includes('s9-70'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('s38'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('s40'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('s23-15'))).toBe(true);
  });
});

describe('calculateGst — empty input', () => {
  it('no transactions → zeros across all BAS labels', () => {
    const r = calculateGst(baseInput({ transactions: [] }));
    expect(r.gstCollected).toBe(0);
    expect(r.gstCreditsClaimable).toBe(0);
    expect(r.netGst).toBe(0);
    expect(r.basLabels.G1).toBe(0);
  });
});
