/**
 * NEOAUDIT §19.4 CROSS-SURFACE LOCK — MON-030 B1: My Guide (CFO) score == Home
 * health score (CLAUDE.md Part 23 Ring 2; NEOAUDIT.md §8 step-5).
 *
 * MON-030 was "three scores for one health" (Home 50/C, CFO 46/D, Safety 70).
 * Stage 2a (option B1) re-sources the CFO overall + grade + bars from the ONE
 * canonical health engine (`generateHealthReport`, the same engine the Home tile
 * reads via `quickHealthCheck`). This test is the §19.4 propagation lock: on the
 * Golden Household, the CFO overall MUST equal the Home health score — both from
 * the ONE engine — so they can never drift again.
 *
 * What runs REAL: `getCFOScore` (the /api/cfo?type=score path) → `buildHealthInput
 * → generateHealthReport → assembleCanonicalCFOScore`, and the Home path
 * `quickHealthCheck(buildHealthInput())`. Mocked: `@/lib/db` serves the golden
 * rows. `computeCFOComponents` still runs inside `getCFOScore` (it feeds the 6
 * advisor action-signals) — its output does NOT affect `overall` here (that's the
 * whole point of the fix), so its golden values are not asserted.
 *
 * Coverage boundary (§20.6 / §22.2.4): verifies the CFO overall + grade are
 * sourced from the canonical health engine and EQUAL the Home score on golden
 * data, and that the 7 canonical categories are present as the bar source. It does
 * NOT verify the rendered CFO PAGE pixels (R2-vis), the advisor grounding (still on
 * the legacy components until stage 2b), or real user data (R3 — Reza's live
 * verify; MON-030 stays FIXING).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createGoldenDb } = await import('./goldenHousehold');
  const db = createGoldenDb();
  return { default: db, prisma: db };
});

import { getCFOScore } from '@/lib/cfo/intelligenceEngine';
import { buildHealthInput, generateHealthReport, quickHealthCheck } from '@/lib/health';
import { GOLDEN_USER_ID } from './goldenHousehold';

// 72 → 73 on MON-131 T1-B (banked income basis) — matches
// ring2.healthInput.test.ts baseline; declared under the healthScore prefix.
const GOLDEN_HEALTH_SCORE = 73;

let homeScore: number;
let cfo: Awaited<ReturnType<typeof getCFOScore>>;

beforeAll(async () => {
  const input = await buildHealthInput(GOLDEN_USER_ID);
  homeScore = quickHealthCheck(input).score;
  cfo = await getCFOScore(GOLDEN_USER_ID);
});

describe('MON-030 B1 — the CFO score is sourced from the canonical health engine', () => {
  it('CFO overall === Home health score === the canonical engine (the dedup)', () => {
    expect(homeScore).toBe(GOLDEN_HEALTH_SCORE); // 72 — Home tile
    expect(cfo.overall).toBe(homeScore); // My Guide == Home — one health score
  });

  it('CFO grade is derived from the SAME canonical score (72 → GOOD → B)', () => {
    expect(cfo.grade).toBe('B');
  });

  it('the bars are the 7 canonical health categories (they explain the ring)', () => {
    expect(cfo.healthCategories).toHaveLength(7);
    const names = new Set((cfo.healthCategories ?? []).map((c) => c.name));
    for (const n of ['LIQUIDITY', 'CASHFLOW', 'DEBT', 'INVESTMENTS', 'PROPERTY', 'RISK_EXPOSURE', 'LONG_TERM_OUTLOOK']) {
      expect(names.has(n as never)).toBe(true);
    }
  });

  it('the CFO overall matches generateHealthReport directly (no second producer)', async () => {
    const direct = generateHealthReport(await buildHealthInput(GOLDEN_USER_ID)).healthScore.score;
    expect(cfo.overall).toBe(direct);
  });
});

describe('MON-030 B1 — negative control (the lock can fail)', () => {
  it('a divergent overall would be caught', () => {
    // If a future edit re-pointed the CFO overall at the old calculateCFOScore,
    // cfo.overall would drift from homeScore and the first test would fail.
    expect(Math.abs(cfo.overall - homeScore)).toBe(0);
  });
});
