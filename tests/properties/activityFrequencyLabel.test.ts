/**
 * MON-048 — the property "Cashflow rhythm / Recent Activity" list showed EVERY
 * expense as "Monthly", including one-off costs (Battery System −$11,385,
 * Hunter Premium −$812), because the badge read the raw declared
 * `expense.frequency` (which defaults to MONTHLY) instead of the categorisation
 * signal `isRecurring`.
 *
 * This locks the ONE label rule: a one-off (`isRecurring === false`) reads
 * "One-off", never a frequency; recurring rows read their humanised cadence.
 */
import { describe, it, expect } from 'vitest';
import { activityFrequencyLabel } from '../../lib/properties/activityFrequencyLabel';

describe('MON-048 · activity frequency badge reads isRecurring, not the declared default', () => {
  it('a one-off (isRecurring === false) reads "One-off", never its declared frequency', () => {
    // The exact bug: a one-off battery stored with frequency MONTHLY.
    expect(activityFrequencyLabel({ frequency: 'MONTHLY', isRecurring: false })).toBe('One-off');
    expect(activityFrequencyLabel({ frequency: 'ANNUAL', isRecurring: false })).toBe('One-off');
  });

  it('a recurring expense reads its humanised declared frequency', () => {
    expect(activityFrequencyLabel({ frequency: 'MONTHLY', isRecurring: true })).toBe('Monthly');
    expect(activityFrequencyLabel({ frequency: 'WEEKLY', isRecurring: true })).toBe('Weekly');
    expect(activityFrequencyLabel({ frequency: 'ANNUAL', isRecurring: true })).toBe('Annual');
  });

  it('undefined/null isRecurring defaults to recurring (null-safe gate)', () => {
    expect(activityFrequencyLabel({ frequency: 'MONTHLY' })).toBe('Monthly');
    expect(activityFrequencyLabel({ frequency: 'QUARTERLY', isRecurring: null })).toBe('Quarterly');
  });

  it('missing frequency falls back to Monthly for a recurring row', () => {
    expect(activityFrequencyLabel({ isRecurring: true })).toBe('Monthly');
  });
});
