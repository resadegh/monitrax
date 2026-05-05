/**
 * Capital loss netting + ordering tests — Phase 41e.1 slice B.
 *
 * Pins the s100-50 / s115-100 / Div 102-A contract:
 *   - prior-year + current-year losses applied to gains (FIFO order
 *     for the carry-forward residual)
 *   - discount applied to the NET gain after losses, NOT to gross gains
 *   - net loss → carry forward, no discount
 *   - mixed holding periods proration with UNCOMPUTED flag
 */

import { describe, it, expect } from 'vitest';
import { applyCapitalLossNetting } from '@/lib/tax-engine/divisions/capitalLossNetting';

describe('applyCapitalLossNetting — basic gain only', () => {
  it('single gain event, > 12 months, individual → 50% discount on net', () => {
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [{ id: 'e1', monthsHeld: 24, nominalAmount: 100000 }],
    });
    expect(r.totalNominalGains).toBe(100000);
    expect(r.totalCurrentYearLosses).toBe(0);
    expect(r.totalPriorYearLosses).toBe(0);
    expect(r.netGainBeforeDiscount).toBe(100000);
    expect(r.discountResult?.discountRate).toBe(0.5);
    expect(r.assessableNetCapitalGain).toBe(50000);
    expect(r.carryForwardOut).toBe(0);
  });

  it('single gain event, < 12 months → no discount, full nominal taxable', () => {
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [{ id: 'e1', monthsHeld: 6, nominalAmount: 50000 }],
    });
    expect(r.assessableNetCapitalGain).toBe(50000);
    expect(r.discountResult?.discountRate).toBe(0);
  });
});

describe('applyCapitalLossNetting — current-year loss netting', () => {
  it('gain $100k + loss $30k → net $70k → discount on $70k = $35k assessable', () => {
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [
        { id: 'g1', monthsHeld: 24, nominalAmount: 100000 },
        { id: 'l1', monthsHeld: 18, nominalAmount: -30000 },
      ],
    });
    expect(r.netGainBeforeDiscount).toBe(70000);
    expect(r.assessableNetCapitalGain).toBe(35000);
    expect(r.carryForwardOut).toBe(0);
  });

  it('CRITICAL: discount applied AFTER netting, not before (s115-100)', () => {
    // This test catches the most common consumer-tax mistake:
    // wrong: ($100k * 0.5) - $30k = $20k taxable
    // right: ($100k - $30k) * 0.5 = $35k taxable
    // The right answer is HIGHER because the discount only applies to
    // the net gain, not to a gross gain that's reduced by losses.
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [
        { id: 'g1', monthsHeld: 24, nominalAmount: 100000 },
        { id: 'l1', monthsHeld: 18, nominalAmount: -30000 },
      ],
    });
    expect(r.assessableNetCapitalGain).toBe(35000); // not 20000
    expect(r.assessableNetCapitalGain).not.toBe(20000);
  });

  it('losses > gains → net loss carries forward, discount not applied', () => {
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [
        { id: 'g1', monthsHeld: 24, nominalAmount: 30000 },
        { id: 'l1', monthsHeld: 18, nominalAmount: -50000 },
      ],
    });
    expect(r.netGainBeforeDiscount).toBe(0);
    expect(r.assessableNetCapitalGain).toBe(0);
    expect(r.carryForwardOut).toBe(20000);
    expect(r.discountResult).toBeNull();
  });
});

describe('applyCapitalLossNetting — prior-year carry-forward losses', () => {
  it('prior-year loss applied, no current-year losses', () => {
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [{ id: 'g1', monthsHeld: 24, nominalAmount: 80000 }],
      carryForwardLosses: [{ financialYear: '2022-23', amount: 20000 }],
    });
    expect(r.totalPriorYearLosses).toBe(20000);
    expect(r.netGainBeforeDiscount).toBe(60000);
    expect(r.assessableNetCapitalGain).toBe(30000); // $60k * 50% discount
  });

  it('prior + current losses both consumed (still net gain)', () => {
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [
        { id: 'g1', monthsHeld: 24, nominalAmount: 100000 },
        { id: 'l1', monthsHeld: 6, nominalAmount: -10000 },
      ],
      carryForwardLosses: [{ financialYear: '2022-23', amount: 20000 }],
    });
    expect(r.totalPriorYearLosses).toBe(20000);
    expect(r.totalCurrentYearLosses).toBe(10000);
    expect(r.netGainBeforeDiscount).toBe(70000);
    expect(r.assessableNetCapitalGain).toBe(35000);
    expect(r.carryForwardOut).toBe(0);
  });

  it('losses exceed gains → unused losses carry forward', () => {
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [{ id: 'g1', monthsHeld: 24, nominalAmount: 30000 }],
      carryForwardLosses: [
        { financialYear: '2021-22', amount: 15000 },
        { financialYear: '2022-23', amount: 25000 },
      ],
    });
    expect(r.totalPriorYearLosses).toBe(40000);
    expect(r.netGainBeforeDiscount).toBe(0);
    expect(r.carryForwardOut).toBe(10000);
  });

  it('FIFO ordering — older prior-year losses sorted first', () => {
    // Pass losses in non-chronological order; service should sort
    // them oldest-first internally.
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [{ id: 'g1', monthsHeld: 24, nominalAmount: 50000 }],
      carryForwardLosses: [
        { financialYear: '2023-24', amount: 30000 },
        { financialYear: '2021-22', amount: 20000 }, // older — should consume first conceptually
      ],
    });
    // Both losses still apply to the net result the same way; this test
    // pins that the totals are unaffected by input order.
    expect(r.totalPriorYearLosses).toBe(50000);
    expect(r.netGainBeforeDiscount).toBe(0);
  });
});

describe('applyCapitalLossNetting — entity-type dispatch', () => {
  it('SMSF — 33⅓% discount on net gain', () => {
    const r = applyCapitalLossNetting({
      entityType: 'SMSF',
      events: [{ id: 'g1', monthsHeld: 24, nominalAmount: 90000 }],
      isComplying: true,
    });
    expect(r.discountResult?.discountRate).toBeCloseTo(1 / 3, 6);
    expect(r.assessableNetCapitalGain).toBeCloseTo(60000, 2);
  });

  it('COMPANY — 0% discount; full net gain taxable', () => {
    const r = applyCapitalLossNetting({
      entityType: 'COMPANY',
      events: [
        { id: 'g1', monthsHeld: 60, nominalAmount: 200000 },
        { id: 'l1', monthsHeld: 24, nominalAmount: -50000 },
      ],
    });
    expect(r.discountResult?.discountRate).toBe(0);
    expect(r.assessableNetCapitalGain).toBe(150000);
  });

  it('DISCRETIONARY_TRUST — 50% discount', () => {
    const r = applyCapitalLossNetting({
      entityType: 'DISCRETIONARY_TRUST',
      events: [{ id: 'g1', monthsHeld: 36, nominalAmount: 200000 }],
    });
    expect(r.discountResult?.discountRate).toBe(0.5);
    expect(r.assessableNetCapitalGain).toBe(100000);
  });
});

describe('applyCapitalLossNetting — mixed holding periods', () => {
  it('some events < 12 months, some ≥ 12 → UC-CGT-MIXED-HOLDING flagged', () => {
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [
        { id: 'short', monthsHeld: 6, nominalAmount: 40000 },
        { id: 'long', monthsHeld: 24, nominalAmount: 60000 },
      ],
    });
    expect(r.uncomputed.some((u) => u.id === 'UC-CGT-MIXED-HOLDING')).toBe(true);
    // Discount applied to long-held proportion (60% of net): 60% * 50% * 100k = 30k
    // assessableNetCapitalGain = 100000 - 30000 = 70000
    expect(r.assessableNetCapitalGain).toBe(70000);
  });

  it('all events ≥ 12 months → no UNCOMPUTED flag', () => {
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [
        { id: 'a', monthsHeld: 18, nominalAmount: 30000 },
        { id: 'b', monthsHeld: 36, nominalAmount: 50000 },
      ],
    });
    expect(r.uncomputed.find((u) => u.id === 'UC-CGT-MIXED-HOLDING')).toBeUndefined();
  });
});

describe('applyCapitalLossNetting — citations + breakdown', () => {
  it('always includes s100-50, s115-100, Div 102-A in citations', () => {
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [{ id: 'g1', monthsHeld: 24, nominalAmount: 50000 }],
    });
    const refs = r.citations.map((c) => c.reference);
    expect(refs).toContain('s100-50');
    expect(refs).toContain('s115-100');
    expect(refs).toContain('Div 102-A');
  });

  it('breakdown row per event', () => {
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [
        { id: 'g1', monthsHeld: 24, nominalAmount: 50000, label: 'BHP shares' },
        { id: 'l1', monthsHeld: 18, nominalAmount: -10000 },
      ],
    });
    expect(r.breakdown.length).toBe(2);
    expect(r.breakdown[0].label).toBe('BHP shares');
    expect(r.breakdown[1].nominalAmount).toBe(-10000);
  });
});

describe('applyCapitalLossNetting — edge cases', () => {
  it('no events → zero everywhere', () => {
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [],
    });
    expect(r.totalNominalGains).toBe(0);
    expect(r.assessableNetCapitalGain).toBe(0);
    expect(r.carryForwardOut).toBe(0);
    expect(r.discountResult).toBeNull();
  });

  it('only prior-year losses, no events → losses carry forward unchanged', () => {
    const r = applyCapitalLossNetting({
      entityType: 'PERSONAL_NAME',
      events: [],
      carryForwardLosses: [{ financialYear: '2022-23', amount: 50000 }],
    });
    expect(r.carryForwardOut).toBe(50000);
    expect(r.assessableNetCapitalGain).toBe(0);
  });
});
