/**
 * MON-011 — property equity is SIGNED; the portfolio total is not overstated
 * (§19.2 worked example + §19.4 convergence).
 *
 * WHAT WAS WRONG: `calculateEquity` floored at 0 (`Math.max(0, value − loan)`),
 * so an underwater property (loan > value, e.g. −$37,076) counted as $0. Because
 * `propertyPortfolioEquity` SUMS per-property equity, the total was overstated by
 * exactly that floored shortfall — and it disagreed with net worth (which uses
 * global unfloored Σvalue − Σmortgages) and with the properties page (already
 * signed), and left `sellProperty`'s `equity < 0` branch dead.
 *
 * THE FIX: `calculateEquity` is signed (value − loan). One source for every
 * surface: master `propertyPortfolioEquity`, the properties page total, and net
 * worth's property equity all agree.
 */
import { describe, it, expect } from 'vitest';
import { calculateEquity } from '../../lib/utils/calculations';
import { calculateNetWorth } from '../../lib/calculations/netWorthCalculator';

describe('MON-011: property equity is signed', () => {
  it('an underwater property returns NEGATIVE equity (was floored to 0)', () => {
    expect(calculateEquity(750_000, 787_076)).toBe(-37_076);
    // Positive case unchanged.
    expect(calculateEquity(800_000, 400_000)).toBe(400_000);
  });

  it('portfolio equity sums SIGNED — the underwater property subtracts (removes the $37,076 overstatement)', () => {
    const props = [
      { value: 800_000, loan: 400_000 }, //  +400,000
      { value: 750_000, loan: 787_076 }, //  −37,076 (underwater)
      { value: 500_000, loan: 0 },        //  +500,000
    ];
    const signedSum = props.reduce((s, p) => s + calculateEquity(p.value, p.loan), 0);
    const flooredSum = props.reduce((s, p) => s + Math.max(0, p.value - p.loan), 0); // the OLD behaviour
    expect(signedSum).toBe(862_924);
    expect(flooredSum).toBe(900_000);
    expect(flooredSum - signedSum).toBe(37_076); // exactly the overstatement the floor caused
  });

  it('§19.4 convergence: signed portfolio equity === net worth property equity (one number)', () => {
    const properties = [
      { currentValue: 800_000 },
      { currentValue: 750_000 },
      { currentValue: 500_000 },
    ];
    const loans = [
      { principal: 400_000, propertyId: 'p1' },
      { principal: 787_076, propertyId: 'p2' },
    ];
    const nw = calculateNetWorth(properties, [], [], loans);
    // Σ per-property signed equity …
    const signedSum = calculateEquity(800_000, 400_000) + calculateEquity(750_000, 787_076) + calculateEquity(500_000, 0);
    // … equals net worth's property equity (Σvalue − Σmortgages, always unfloored).
    expect(nw.breakdown.propertyEquity).toBe(signedSum);
    expect(nw.breakdown.propertyEquity).toBe(862_924);
  });
});
