/**
 * D2 — cadence-mismatch detector (MON-001, INTAKE_INTEGRITY_GUARDRAIL.md §4 R2).
 *
 * The census case: "Rent - Broadbeach $2,947/wk" and "Rent - Thornland Lot 2
 * $2,817/wk" — weekly payment streams stored `MONTHLY`, annualising ×12
 * instead of ×52 (~4.3× understated rental income → understated tax).
 * The detector flags exactly this shape for user review.
 */
import { describe, it, expect } from 'vitest';
import { detectCadenceMismatch } from '../../lib/intake/detectors';

const weekly = (n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 0, 2 + i * 7)));
const monthly = (n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, i, 2)));

describe('MON-001 · D2 detectCadenceMismatch', () => {
  it('census case: weekly payments on a MONTHLY row → flagged WEEKLY', () => {
    const flag = detectCadenceMismatch({
      frequency: 'MONTHLY',
      isRecurring: true,
      transactionDates: weekly(6),
    });
    expect(flag).not.toBeNull();
    expect(flag!.stored).toBe('MONTHLY');
    expect(flag!.implied).toBe('WEEKLY');
    expect(flag!.transactionCount).toBe(6);
    expect(flag!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('agreement is silent: monthly payments on a MONTHLY row → null', () => {
    expect(
      detectCadenceMismatch({ frequency: 'MONTHLY', isRecurring: true, transactionDates: monthly(6) }),
    ).toBe(null);
  });

  it('a WEEKLY row with weekly payments → null (correctly stored)', () => {
    expect(
      detectCadenceMismatch({ frequency: 'WEEKLY', isRecurring: true, transactionDates: weekly(6) }),
    ).toBe(null);
  });

  it('one-off rows never flag (cadence is moot when counted once)', () => {
    expect(
      detectCadenceMismatch({ frequency: 'MONTHLY', isRecurring: false, transactionDates: weekly(6) }),
    ).toBe(null);
  });

  it('needs ≥3 transactions (2 dates = 1 interval — too noisy)', () => {
    expect(
      detectCadenceMismatch({ frequency: 'MONTHLY', isRecurring: true, transactionDates: weekly(2) }),
    ).toBe(null);
  });

  it('inconsistent intervals (low confidence) never flag', () => {
    // 3, 40, 90-day gaps — no coherent cadence.
    const erratic = [
      new Date('2026-01-01'), new Date('2026-01-04'),
      new Date('2026-02-13'), new Date('2026-05-14'),
    ];
    expect(
      detectCadenceMismatch({ frequency: 'MONTHLY', isRecurring: true, transactionDates: erratic }),
    ).toBe(null);
  });

  it('junk stored frequency or invalid dates → null (no crash)', () => {
    expect(detectCadenceMismatch({ frequency: null, transactionDates: weekly(4) })).toBe(null);
    expect(
      detectCadenceMismatch({ frequency: 'MONTHLY', isRecurring: true, transactionDates: ['x', 'y', 'z'] }),
    ).toBe(null);
  });
});
