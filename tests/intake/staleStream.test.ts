/**
 * MON-090 — detectStaleStream (date + frequency awareness, Reza 2026-07-20).
 *
 * ONE producer decides "this recurring stream has gone quiet": newest linked
 * payment older than 1.5× the row's own cadence interval. Income, expenses
 * and loans routes all call this — the threshold can never drift per surface.
 */
import { describe, it, expect } from 'vitest';
import { detectStaleStream } from '../../lib/intake/detectors';

const NOW = new Date('2026-07-20T00:00:00Z');

describe('detectStaleStream — frequency-aware quiet-stream nudge', () => {
  it("Reza's Transport case: MONTHLY stream, last payment 12 Jun, today 20 Jul → STALE (38d > 45.7×… no wait, 1.5×30.4=45.7 — NOT stale)", () => {
    // 12 Jun → 20 Jul = 38 days; monthly interval 30.44 → threshold 45.66d.
    // 38 < 45.66 — the stream is late but within tolerance: NO nudge yet.
    const r = detectStaleStream({
      frequency: 'MONTHLY',
      isRecurring: true,
      lastTransactionAt: new Date('2026-06-12'),
      now: NOW,
    });
    expect(r).toBeNull();
  });

  it('MONTHLY stream silent since 20 May → stale (61d > 45.7d threshold), with the evidence fields', () => {
    const r = detectStaleStream({
      frequency: 'MONTHLY',
      isRecurring: true,
      lastTransactionAt: new Date('2026-05-20'),
      now: NOW,
    });
    expect(r).not.toBeNull();
    expect(r!.daysSince).toBe(61);
    expect(r!.expectedIntervalDays).toBeCloseTo(365.25 / 12, 1);
    expect(r!.lastPaymentAt).toContain('2026-05-20');
  });

  it('FORTNIGHTLY stream: 22 days quiet → stale (threshold 1.5×14 = 21d); 20 days quiet → not stale', () => {
    expect(
      detectStaleStream({
        frequency: 'FORTNIGHTLY',
        isRecurring: true,
        lastTransactionAt: new Date('2026-06-28'), // 22 days before NOW
        now: NOW,
      }),
    ).not.toBeNull();
    expect(
      detectStaleStream({
        frequency: 'FORTNIGHTLY',
        isRecurring: true,
        lastTransactionAt: new Date('2026-06-30'), // 20 days before NOW
        now: NOW,
      }),
    ).toBeNull();
  });

  it('ANNUAL stream is patient: 6 months quiet is fine (threshold ~548d)', () => {
    expect(
      detectStaleStream({
        frequency: 'ANNUAL',
        isRecurring: true,
        lastTransactionAt: new Date('2026-01-20'),
        now: NOW,
      }),
    ).toBeNull();
  });

  it('never fires for one-offs, missing dates, or unknown frequencies', () => {
    expect(
      detectStaleStream({ frequency: 'MONTHLY', isRecurring: false, lastTransactionAt: new Date('2025-01-01'), now: NOW }),
    ).toBeNull();
    expect(
      detectStaleStream({ frequency: 'MONTHLY', isRecurring: true, lastTransactionAt: null, now: NOW }),
    ).toBeNull();
    expect(
      detectStaleStream({ frequency: 'SOMETIMES', isRecurring: true, lastTransactionAt: new Date('2025-01-01'), now: NOW }),
    ).toBeNull();
  });
});
