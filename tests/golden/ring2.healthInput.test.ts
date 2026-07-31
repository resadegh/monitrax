/**
 * NEOAUDIT RING 2 — the canonical `buildHealthInput` on the Golden Household
 * (CLAUDE.md Part 23 Ring 2; NEOAUDIT.md §8 step-5; MON-030 stage 1).
 *
 * MON-030 stage 1 extracted the ONE canonical `buildHealthInput` into
 * `lib/health/` (it was duplicated verbatim in the financial-health + insights
 * routes — §12.2.1). This is a PURE REFACTOR: the two copies were verified
 * line-by-line equivalent, so the extraction changes no number. This test locks
 * that the ONE builder assembles the expected input and that BOTH engine entry
 * points (`generateHealthReport` + `quickHealthCheck`) agree on the score from
 * it — the cross-surface consistency the dedup guarantees.
 *
 * It ALSO records the golden health score as a REGRESSION BASELINE, so MON-030
 * stage 2 (re-sourcing the CFO score from this same engine — a deliberate number
 * change) is measured against a known "before".
 *
 * Coverage boundary (§20.6 / §22.2.4): verifies the builder's assembled
 * portfolioSnapshot fields + that the two engine paths agree on the score, on
 * golden data. It does NOT hand-derive the health SCORE from first principles
 * (the 7-category bucketing + modifiers are the engine's own category-test
 * territory) — the score value here is a locked regression baseline, not a
 * §19.2 worked example. `buildHealthInput`'s asset scope (properties + accounts
 * + holdings-at-cost; EXCLUDES super + personal assets) is its own long-standing
 * basis, asserted as-is — reconciling it to the canonical net worth is a separate
 * question, NOT this refactor's scope.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createGoldenDb } = await import('./goldenHousehold');
  const db = createGoldenDb();
  return { default: db, prisma: db };
});

import { buildHealthInput, generateHealthReport, quickHealthCheck } from '@/lib/health';
import type { FinancialHealthInput } from '@/lib/health';
import { EXPECTED, GOLDEN_USER_ID } from './goldenHousehold';

let input: FinancialHealthInput;

beforeAll(async () => {
  input = await buildHealthInput(GOLDEN_USER_ID);
});

describe('MON-030 stage 1 — canonical buildHealthInput assembles the golden input', () => {
  it('portfolioSnapshot counts + liabilities are correct', () => {
    const s = input.portfolioSnapshot;
    expect(s.properties).toHaveLength(EXPECTED.counts.properties); // 1
    expect(s.loans).toHaveLength(EXPECTED.counts.loans); // 2
    expect(s.accounts).toHaveLength(EXPECTED.counts.accounts); // 2
    expect(s.totalLiabilities).toBeCloseTo(EXPECTED.liabilities.total, 2); // 520,000
  });

  it('assets use the health basis (properties + accounts + holdings-AT-COST; super + personal EXCLUDED)', () => {
    const s = input.portfolioSnapshot;
    // Holdings are valued at COST (units × averagePrice) = 4,000 on the golden
    // book — NOT the manifest's 7,000 MARKET value (units × currentPrice). That
    // cost-vs-market gap is buildHealthInput's long-standing "Simplified" basis
    // (a separate correctness question, a future MON — NOT this refactor's scope).
    const HOLDINGS_AT_COST = 4_000;
    const healthAssets = EXPECTED.assets.properties + EXPECTED.assets.accounts + HOLDINGS_AT_COST; // 854,000
    // Deliberately NOT the master's 992,000 (which also includes super 120,000 +
    // personal 15,000, and holdings at market) — the health scope is unchanged here.
    expect(s.investments.reduce((a, h) => a + h.value, 0)).toBeCloseTo(HOLDINGS_AT_COST, 2);
    expect(s.totalAssets).toBeCloseTo(healthAssets, 2); // 854,000
    expect(s.netWorth).toBeCloseTo(healthAssets - EXPECTED.liabilities.total, 2); // 334,000
  });
});

describe('MON-030 stage 1 — the two engine entry points agree on the ONE input (the dedup guarantee)', () => {
  it('generateHealthReport score === quickHealthCheck score', () => {
    const full = generateHealthReport(input).healthScore.score;
    const quick = quickHealthCheck(input).score;
    expect(quick).toBe(full); // same input, same engine path → identical
  });

  it('the health score is a finite 0–100 value (regression baseline recorded below)', () => {
    const score = quickHealthCheck(input).score;
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    // REGRESSION BASELINE — the golden household's health score BEFORE MON-030
    // stage 2. If this changes unexpectedly, a refactor altered the score.
    expect(score).toBe(GOLDEN_HEALTH_SCORE_BASELINE);
  });
});

// Locked after running the real engine on the golden input (see the finite/range
// assertions above). This is a regression pin, not a hand-derived §19.2 value.
// 72 → 73 on MON-131 T1-B: buildHealthInput's income rows re-fed with BANKED
// per-row values from the ONE producer (declared move — expected-moves-t1.json
// buildHealthInput.portfolioSnapshot.income + the bounded healthScore prefix).
const GOLDEN_HEALTH_SCORE_BASELINE = 73;
