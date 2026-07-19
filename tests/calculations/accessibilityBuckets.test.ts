/**
 * MON-012 — the Hidden Wealth buckets must tie out to NET WORTH
 * (§19.2 worked examples + §19.4 cross-surface reconciliation).
 *
 * WHAT WAS WRONG (on real data): Liquid + Accessible + Locked = $3,398,482 but
 * net worth was $3,333,910 — a $64,572 hole. Three causes: floored property
 * equity (+$37,076, MON-011), the credit card (−$2,496) not netted from liquid
 * cash, and HECS (−$25,000) in no bucket at all. Non-liquid cash (term
 * deposits) was a latent 4th gap — dropped entirely.
 *
 * THE FIX: one engine partitions net worth, netting every liability against its
 * time-horizon bucket, sourcing every value from the canonical NetWorthResult —
 * so the buckets ALWAYS sum to net worth by construction.
 */
import { describe, it, expect } from 'vitest';
import { computeAccessibilityBuckets } from '../../lib/calculations/accessibilityBuckets';
import {
  calculateNetWorth,
  type NetWorthResult,
} from '../../lib/calculations/netWorthCalculator';

/** Build a full canonical NetWorthResult from the parts the engine reads. */
function nw(parts: {
  accounts: number;
  investments: number;
  properties: number;
  superannuation: number;
  personalAssets: number;
  mortgages: number;
  personalLoans: number;
  creditCards: number;
}): NetWorthResult {
  const assetsTotal =
    parts.accounts +
    parts.investments +
    parts.properties +
    parts.superannuation +
    parts.personalAssets;
  const liabTotal = parts.mortgages + parts.personalLoans + parts.creditCards;
  return {
    netWorth: assetsTotal - liabTotal,
    assets: {
      properties: parts.properties,
      accounts: parts.accounts,
      investments: parts.investments,
      superannuation: parts.superannuation,
      personalAssets: parts.personalAssets,
      total: assetsTotal,
    },
    liabilities: {
      mortgages: parts.mortgages,
      personalLoans: parts.personalLoans,
      creditCards: parts.creditCards,
      total: liabTotal,
    },
    breakdown: {
      propertyEquity: parts.properties - parts.mortgages, // unfloored, canonical
      liquidAssets: parts.accounts,
      investmentAssets: parts.investments + parts.superannuation,
    },
  };
}

const sum = (b: { liquidToday: number; accessible: number; lockedLongTerm: number }) =>
  b.liquidToday + b.accessible + b.lockedLongTerm;

describe('MON-012: accessibility buckets tie out to net worth', () => {
  it('the reported shape — buckets sum to net worth, not $27,496 over', () => {
    const result = nw({
      accounts: 50_000, // all liquid
      investments: 100_000,
      properties: 3_000_000,
      superannuation: 200_000,
      personalAssets: 40_000,
      mortgages: 1_500_000,
      personalLoans: 25_000, // HECS
      creditCards: 2_496,
    });
    const b = computeAccessibilityBuckets(result, /* liquidCash */ 50_000);

    // Liquid nets the credit card; Locked nets HECS; mortgages already inside equity.
    expect(b.liquidToday).toBe(50_000 - 2_496); // 47,504
    expect(b.accessible).toBe(100_000); // no term deposits here
    expect(b.lockedLongTerm).toBe(1_500_000 + 200_000 + 40_000 - 25_000); // 1,715,000

    // TIE-OUT: the whole point.
    expect(sum(b)).toBe(result.netWorth);

    // The OLD (broken) gross-ish sum overstated by exactly credit card + HECS.
    const oldSum = 50_000 + 100_000 + (1_500_000 + 200_000 + 40_000);
    expect(oldSum - result.netWorth).toBe(2_496 + 25_000); // 27,496
  });

  it('non-liquid cash (term deposits) routes to Accessible, not Liquid', () => {
    const result = nw({
      accounts: 80_000, // of which only 30k is spendable today
      investments: 20_000,
      properties: 0,
      superannuation: 0,
      personalAssets: 0,
      mortgages: 0,
      personalLoans: 0,
      creditCards: 0,
    });
    const b = computeAccessibilityBuckets(result, /* liquidCash */ 30_000);
    expect(b.nonLiquidCash).toBe(50_000); // the term deposit
    expect(b.liquidToday).toBe(30_000);
    expect(b.accessible).toBe(20_000 + 50_000); // investments + term deposit
    expect(sum(b)).toBe(result.netWorth); // 100,000
  });

  it('credit cards net from Liquid; personal/HECS loans net from Locked', () => {
    const result = nw({
      accounts: 10_000,
      investments: 0,
      properties: 500_000,
      superannuation: 0,
      personalAssets: 0,
      mortgages: 0,
      personalLoans: 40_000,
      creditCards: 6_000,
    });
    const b = computeAccessibilityBuckets(result, 10_000);
    expect(b.liquidToday).toBe(10_000 - 6_000); // 4,000
    expect(b.lockedLongTerm).toBe(500_000 - 40_000); // 460,000
    expect(sum(b)).toBe(result.netWorth);
  });

  it('an underwater property (negative equity) still ties out', () => {
    const result = nw({
      accounts: 5_000,
      investments: 0,
      properties: 750_000,
      superannuation: 0,
      personalAssets: 0,
      mortgages: 787_076, // underwater → equity −37,076
      personalLoans: 0,
      creditCards: 0,
    });
    const b = computeAccessibilityBuckets(result, 5_000);
    expect(b.propertyEquity).toBe(-37_076);
    expect(b.lockedLongTerm).toBe(-37_076);
    expect(sum(b)).toBe(result.netWorth);
  });

  it('composes with the real calculateNetWorth engine (§19.4 end-to-end)', () => {
    const real = calculateNetWorth(
      [{ currentValue: 900_000 }, { currentValue: 400_000 }] as any,
      [
        { type: 'SAVINGS', currentBalance: 25_000 },
        { type: 'TERM_DEPOSIT', currentBalance: 15_000 },
      ] as any,
      [{ units: 100, currentPrice: 50 }] as any, // 5,000 investments
      [
        { type: 'HOME', principal: 600_000, propertyId: 'p1' },
        { type: 'CREDIT_CARD', principal: 3_000 },
        { type: 'HECS', principal: 22_000 }, // → personalLoans (else branch)
      ] as any,
      [{ balance: 120_000, fundType: 'RETAIL' }] as any,
      [{ currentValue: 8_000 }] as any,
    );
    // MON-031/064: the parameter is THE canonical DEPLOYABLE liquid cash —
    // the liquid subset (SAVINGS 25,000) NET of credit cards (3,000) = 22,000.
    // The engine reconstructs the gross basis internally (22,000 + 3,000), so
    // the term deposit still partitions into `accessible`.
    const b = computeAccessibilityBuckets(real, /* canonical net liquidCash */ 22_000);
    expect(b.longTermDebt).toBe(22_000); // HECS landed in personalLoans
    expect(b.creditCards).toBe(3_000);
    expect(b.nonLiquidCash).toBe(15_000); // the term deposit → accessible
    expect(sum(b)).toBeCloseTo(real.netWorth, 6);
  });

  it('ties out across 200 random portfolios (fuzz)', () => {
    let seed = 12345;
    const rand = (max: number) => {
      // deterministic LCG — no Math.random (repeatable)
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed / 0x7fffffff) * max;
    };
    for (let i = 0; i < 200; i++) {
      const result = nw({
        accounts: rand(200_000),
        investments: rand(300_000),
        properties: rand(2_000_000),
        superannuation: rand(400_000),
        personalAssets: rand(80_000),
        mortgages: rand(1_500_000),
        personalLoans: rand(60_000),
        creditCards: rand(15_000),
      });
      const liquidCash = Math.min(result.assets.accounts, rand(200_000));
      const b = computeAccessibilityBuckets(result, liquidCash);
      expect(sum(b)).toBeCloseTo(result.netWorth, 6);
    }
  });
});
