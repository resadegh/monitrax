/**
 * MON-039c — the property LIST tile omitted "Cashflow / yr" for Guildford (a
 * PRIMARY RESIDENCE that collects $26,089 rent + carries a loan) while the
 * detail page (-$7,387) and Home tile (-$7,392) showed it — the same number
 * present on 2 of 3 surfaces (a §19.4 cross-surface omission).
 *
 * This locks the ONE visibility rule: cashflow shows for a genuine INVESTMENT,
 * OR for any property carrying rental income (incomeCount > 0) even when typed
 * HOME/primary-residence; a true owner-occupied home with no rent shows none.
 */
import { describe, it, expect } from 'vitest';
import { shouldShowPropertyCashflow } from '../../lib/properties/propertyCashflowVisibility';

describe('MON-039c · property cashflow visibility is one cross-surface rule', () => {
  it('a HOME with rental income (the Guildford case) SHOWS cashflow', () => {
    expect(shouldShowPropertyCashflow({ type: 'HOME', incomeCount: 1 })).toBe(true);
  });

  it('a true owner-occupied HOME with no rent shows NO cashflow', () => {
    expect(shouldShowPropertyCashflow({ type: 'HOME', incomeCount: 0 })).toBe(false);
  });

  it('an INVESTMENT always shows cashflow, even with no income rows yet', () => {
    expect(shouldShowPropertyCashflow({ type: 'INVESTMENT', incomeCount: 0 })).toBe(true);
    expect(shouldShowPropertyCashflow({ type: 'INVESTMENT', incomeCount: 3 })).toBe(true);
  });

  it('a RENTAL with income shows cashflow', () => {
    expect(shouldShowPropertyCashflow({ type: 'RENTAL', incomeCount: 2 })).toBe(true);
  });
});
