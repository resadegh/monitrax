/**
 * MON-182 — the ONE portfolio-LVR producer (M3 punch-list §C-3).
 *
 * Ring 0: §19.2 worked example on the canonical formula — owned-only basis,
 * property-attached principal, producer-owned 2dp rounding.
 * Ring 1 (the Ratchet for this class): a source-scan proving BOTH live
 * surfaces read the one producer and neither re-derives the ratio inline —
 * the defect was two live bases (snapshot all-liabilities/all-value 41.3%
 * vs page owned-only screen arithmetic 40.8%) disagreeing on the same data.
 *
 * Coverage: proves the formula on fixtures and the static wiring at HEAD.
 * Does NOT prove the rendered figures converge on live data — that is
 * RING3_M3_PUNCH_FIXES.md Part 2 (the Matrix runs it post-merge).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculateOwnedPortfolioLvr } from '@/lib/calculations/portfolioLvr';

describe('MON-182 Ring 0 — calculateOwnedPortfolioLvr worked example (§19.2)', () => {
  it('owned-only basis: RENTAL rows leave BOTH sides of the ratio with their loans', () => {
    // Hand-computed: owned value 900k + 600k = 1,500,000;
    // attached debt 500k + (250k + 50k) = 800,000 → 53.333…% → 53.33 (2dp).
    const lvr = calculateOwnedPortfolioLvr([
      { type: 'HOME', currentValue: 900_000, loans: [{ principal: 500_000 }] },
      { type: 'INVESTMENT', currentValue: 600_000, loans: [{ principal: 250_000 }, { principal: 50_000 }] },
      { type: 'RENTAL', currentValue: 380_000, loans: [{ principal: 100_000 }] },
    ]);
    expect(lvr).toBe(53.33);
  });

  it('a property with no loans contributes value only; missing arrays are 0 debt', () => {
    expect(
      calculateOwnedPortfolioLvr([
        { type: 'HOME', currentValue: 1_000_000 },
        { type: 'INVESTMENT', currentValue: 0, loans: null },
      ])
    ).toBe(0);
  });

  it('no owned value → 0 (never NaN/Infinity), even with RENTAL rows present', () => {
    expect(calculateOwnedPortfolioLvr([])).toBe(0);
    expect(
      calculateOwnedPortfolioLvr([{ type: 'RENTAL', currentValue: 380_000, loans: [{ principal: 100_000 }] }])
    ).toBe(0);
  });

  it('the producer owns its rounding: 2dp, half-up (MON-154 lesson)', () => {
    // 408.49 / 1000 = 40.849% → 40.85 at the producer (never a second
    // rounding downstream — both surfaces format the SAME 2dp value).
    expect(
      calculateOwnedPortfolioLvr([{ type: 'HOME', currentValue: 1_000, loans: [{ principal: 408.49 }] }])
    ).toBe(40.85);
  });
});

describe('MON-182 Ring 1 — both surfaces read the ONE producer (no inline ratio)', () => {
  it('/api/portfolio/snapshot gearing reads calculateOwnedPortfolioLvr', () => {
    const src = readFileSync('app/api/portfolio/snapshot/route.ts', 'utf8');
    expect(src).toContain("from '@/lib/calculations/portfolioLvr'");
    expect(src).toMatch(/portfolioLVR:\s*calculateOwnedPortfolioLvr\(/);
    // The old basis must be gone: no liabilities-over-property-value division.
    expect(src).not.toMatch(/totalLiabilities\s*\/\s*totalPropertyValue/);
  });

  it('the properties page reads the producer; its screen arithmetic is deleted', () => {
    const src = readFileSync('app/dashboard/properties/page.tsx', 'utf8');
    expect(src).toContain("from '@/lib/calculations/portfolioLvr'");
    expect(src).toMatch(/averageLvr\s*=\s*calculateOwnedPortfolioLvr\(/);
    expect(src).not.toMatch(/totalLoans\s*\/\s*totalValue/);
  });

  it('both render labels name the basis (owned)', () => {
    expect(readFileSync('components/properties/PropertiesHero.tsx', 'utf8')).toContain(
      'Portfolio LVR — owned'
    );
    expect(readFileSync('app/dashboard/ScoreboardClient.tsx', 'utf8')).toContain(
      'Portfolio LVR — owned'
    );
  });
});
