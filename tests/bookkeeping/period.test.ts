/**
 * Phase 42 PR1 — Tests for the BookkeepingPeriod state machine.
 *
 * The state machine is small and pure. The DB-touching path (getOrCreate,
 * markReviewed, etc.) is integration-tested elsewhere; this file covers
 * the deterministic helpers + transition logic.
 */

import { describe, it, expect } from 'vitest';
import { toPeriodMonthKey, formatPeriodMonth } from '../../lib/bookkeeping/period';

describe('toPeriodMonthKey', () => {
  it('parses YYYY-MM strings to UTC first-of-month', () => {
    const date = toPeriodMonthKey('2026-10');
    expect(date.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('parses YYYY-MM-DD strings, ignoring the day', () => {
    const date = toPeriodMonthKey('2026-10-22');
    expect(date.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('normalises Date inputs to UTC first-of-month', () => {
    const input = new Date(Date.UTC(2026, 9, 22, 13, 45, 30));
    const key = toPeriodMonthKey(input);
    expect(key.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('throws on malformed strings', () => {
    expect(() => toPeriodMonthKey('not-a-month')).toThrow();
    expect(() => toPeriodMonthKey('2026/10')).toThrow();
  });

  it('handles January correctly (UTC month 0 boundary)', () => {
    const date = toPeriodMonthKey('2026-01');
    expect(date.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('handles December correctly (UTC month 11)', () => {
    const date = toPeriodMonthKey('2026-12');
    expect(date.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
});

describe('formatPeriodMonth', () => {
  it('round-trips through toPeriodMonthKey', () => {
    expect(formatPeriodMonth(toPeriodMonthKey('2026-10'))).toBe('2026-10');
    expect(formatPeriodMonth(toPeriodMonthKey('2026-01'))).toBe('2026-01');
    expect(formatPeriodMonth(toPeriodMonthKey('2026-12'))).toBe('2026-12');
  });

  it('zero-pads single-digit months', () => {
    const date = new Date(Date.UTC(2026, 2, 1)); // March
    expect(formatPeriodMonth(date)).toBe('2026-03');
  });
});
