/**
 * MON-134 / D15 — the health-score trend is derived from STORED monthly
 * snapshots, never generated (was: Math.random fabrication found by the Matrix
 * Relay's first A3 self-diff — 15 leaves moved on an unchanged database).
 *
 * Proves (precisely — §22.2.4):
 *  (1) `calculateTrend` on real snapshot rows: worked-example direction +
 *      changePercent + periodMonths (§19.2 examples inline), the
 *      INSUFFICIENT_HISTORY contract at 0 and 1 rows (no changePercent, no
 *      'STABLE' fallback), and the D15 formula-version break marking.
 *  (2) `generateHealthReport` is DETERMINISTIC: two calls on identical input
 *      (fixed `asOf`) are byte-identical (brief §4.4).
 *  (3) The write-once recorder: one create; a P2002 duplicate is a no-op
 *      return-false; NO update path exists to call (brief §4.2/§5).
 *  (4) The Math.random ratchet: no NEW `Math.random(` under lib/ beyond the
 *      reviewed id/nonce/retry-jitter allowlist — and ZERO in lib/health/.
 * Does NOT prove: any live captured number is correct (relay A3 self-diff on
 * real data is the acceptance test — brief §5), nor the monthly writer against
 * a real database (CI has none).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const h = vi.hoisted(() => {
  const state = { created: [] as unknown[], failNextWithP2002: false };
  const prismaMock = {
    healthScoreSnapshot: {
      create: async (args: { data: unknown }) => {
        if (state.failNextWithP2002) {
          const err = new Error('Unique constraint failed') as Error & { code: string };
          err.code = 'P2002';
          throw err;
        }
        state.created.push(args.data);
        return args.data;
      },
    },
  };
  return { state, prismaMock };
});

vi.mock('@/lib/db', () => ({ default: h.prismaMock, prisma: h.prismaMock }));

import {
  calculateTrend,
  generateHealthReport,
  HEALTH_FORMULA_VERSION,
} from '@/lib/health/aggregateEngine';
import { recordHealthScoreSnapshot } from '@/lib/services/healthScoreSnapshotRecorder';
import type { FinancialHealthInput, HealthScoreHistoryPoint } from '@/lib/health/types';

const ROOT = resolve(__dirname, '../..');

const snap = (iso: string, score: number, formulaVersion = 1): HealthScoreHistoryPoint => ({
  snapshotDate: new Date(iso),
  score,
  formulaVersion,
});

/** Minimal typed engine input — empty book, fixed clock. */
const minimalInput = (history: HealthScoreHistoryPoint[]): FinancialHealthInput => ({
  userId: 'user-mon134',
  portfolioSnapshot: {
    netWorth: 0, totalAssets: 0, totalLiabilities: 0,
    properties: [], loans: [], accounts: [], investments: [], income: [], expenses: [],
  },
  insights: [],
  healthScoreHistory: history,
  asOf: new Date('2026-07-29T00:00:00Z'),
});

describe('calculateTrend — real snapshots only (MON-134)', () => {
  it('0 snapshots → INSUFFICIENT_HISTORY, empty history, NO changePercent', () => {
    const t = calculateTrend([]);
    expect(t.direction).toBe('INSUFFICIENT_HISTORY');
    expect(t.history).toEqual([]);
    expect(t.changePercent).toBeUndefined();
    expect(t.periodMonths).toBe(0);
  });

  it('1 snapshot → still INSUFFICIENT_HISTORY — never a number, never STABLE', () => {
    const t = calculateTrend([snap('2026-07-01', 63)]);
    expect(t.direction).toBe('INSUFFICIENT_HISTORY');
    expect(t.changePercent).toBeUndefined();
  });

  it('worked example (§19.2): 54 (Jan) → 61 (Jul) = +7 → IMPROVING, changePercent 7, periodMonths 6', () => {
    const t = calculateTrend([
      snap('2026-01-01', 54),
      snap('2026-04-01', 58),
      snap('2026-07-01', 61),
    ]);
    expect(t.direction).toBe('IMPROVING');
    expect(t.changePercent).toBe(7); // 61 − 54
    expect(t.periodMonths).toBe(6); // Jan→Jul
    expect(t.history.map((p) => p.score)).toEqual([54, 58, 61]);
    expect(t.formulaBreaks).toBeUndefined();
  });

  it('worked example: 70 → 65 = −5 → DECLINING; ±2 band → STABLE', () => {
    expect(calculateTrend([snap('2026-05-01', 70), snap('2026-07-01', 65)]).direction).toBe('DECLINING');
    const stable = calculateTrend([snap('2026-05-01', 63), snap('2026-07-01', 64.5)]);
    expect(stable.direction).toBe('STABLE');
    expect(stable.changePercent).toBe(1.5);
  });

  it('unsorted input is sorted by date — order of rows never changes the answer', () => {
    const t = calculateTrend([snap('2026-07-01', 61), snap('2026-01-01', 54)]);
    expect(t.direction).toBe('IMPROVING');
    expect(t.changePercent).toBe(7);
  });

  it('D15: a formulaVersion change between consecutive snapshots is marked as a break', () => {
    const t = calculateTrend([
      snap('2026-04-01', 58, 1),
      snap('2026-05-01', 59, 1),
      snap('2026-06-01', 66, 2), // MON-131 tranche changed the formula
      snap('2026-07-01', 67, 2),
    ]);
    expect(t.formulaBreaks).toEqual([new Date('2026-06-01').toISOString()]);
  });
});

describe('generateHealthReport — deterministic for a fixed input (brief §4.4)', () => {
  it('two calls on identical input are byte-identical', () => {
    const input = minimalInput([snap('2026-05-01', 60), snap('2026-07-01', 64)]);
    const a = JSON.stringify(generateHealthReport(input));
    const b = JSON.stringify(generateHealthReport(input));
    expect(a).toBe(b);
  });

  it('the trend inside the report comes from the stored history, not the live score', () => {
    const r = generateHealthReport(minimalInput([snap('2026-05-01', 10), snap('2026-07-01', 90)]));
    expect(r.healthScore.trend.direction).toBe('IMPROVING');
    expect(r.healthScore.trend.changePercent).toBe(80);
    const empty = generateHealthReport(minimalInput([]));
    expect(empty.healthScore.trend.direction).toBe('INSUFFICIENT_HISTORY');
  });
});

describe('write-once recorder (brief §4.2/§5)', () => {
  it('first run creates exactly one row at the month anchor with the formula version', async () => {
    h.state.created = [];
    h.state.failNextWithP2002 = false;
    const wrote = await recordHealthScoreSnapshot({ userId: 'u1', score: 63, riskBand: 'MODERATE' });
    expect(wrote).toBe(true);
    expect(h.state.created).toHaveLength(1);
    const row = h.state.created[0] as Record<string, unknown>;
    expect(row.formulaVersion).toBe(HEALTH_FORMULA_VERSION);
    const anchor = row.snapshotDate as Date;
    expect(anchor.getUTCDate()).toBe(1); // first-of-month UTC
  });

  it('a duplicate month is a P2002 no-op — returns false, mutates nothing', async () => {
    h.state.created = [];
    h.state.failNextWithP2002 = true;
    const wrote = await recordHealthScoreSnapshot({ userId: 'u1', score: 99, riskBand: 'LOW' });
    expect(wrote).toBe(false);
    expect(h.state.created).toHaveLength(0);
    // The recorder has NO update path at all — write-once by construction
    // (call-shape check; the JSDoc legitimately mentions the word "upsert").
    const src = readFileSync(resolve(ROOT, 'lib/services/healthScoreSnapshotRecorder.ts'), 'utf8');
    expect(src).not.toMatch(/\.(upsert|update|updateMany)\s*\(/);
  });
});

describe('Math.random ratchet (brief §4.4 — this class must not return)', () => {
  // Reviewed 2026-07-29: every entry is id/nonce/retry-jitter generation —
  // never a money value. RATCHET-DOWN-ONLY: fixing one requires removing its
  // entry here in the same PR; a NEW Math.random under lib/ fails this test.
  const ALLOWLIST: Record<string, number> = {
    'lib/ai/tax-advisor/gateway.ts': 1, // request-id nonce
    'lib/ai/google/geminiClient.ts': 1, // retry backoff jitter
    'lib/auth/oauth.ts': 1, // OAuth state nonce
    'lib/tie/ingestion.ts': 1, // batch id
    'lib/calc-audit/anomalyDetection.ts': 1, // scan id
    'lib/reports/generators/index.ts': 1, // RPT- reference-number nonce
    'lib/analytics/navigationAnalytics.ts': 2, // nav session + event ids
    'lib/onboarding/accountsSync.ts': 1, // temp client-side id
    'lib/onboarding/investmentsSync.ts': 1, // temp client-side id
    'lib/onboarding/propertiesSync.ts': 1, // temp client-side id
    'lib/cfo/aiAdvisor.ts': 1, // hash salt for cache key
    'lib/onboarding/assetsSync.ts': 1, // temp client-side id
    'lib/onboarding/debtsSync.ts': 1,
    'lib/onboarding/entitiesSync.ts': 1,
    'lib/onboarding/superSync.ts': 1,
    'lib/onboarding/householdSync.ts': 2, // member + pet temp ids
    'lib/onboarding/incomeExpensesSync.ts': 1,
  };

  function* walk(dir: string): Generator<string> {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) yield* walk(p);
      else if (/\.ts$/.test(ent.name) && !/\.(test|spec)\.ts$/.test(ent.name)) yield p;
    }
  }

  it('no Math.random under lib/ beyond the reviewed allowlist — and none in lib/health', () => {
    const offenders: string[] = [];
    for (const file of walk(resolve(ROOT, 'lib'))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const count = (readFileSync(file, 'utf8').match(/Math\.random\s*\(/g) ?? []).length;
      if (count === 0) continue;
      if (rel.startsWith('lib/health/')) { offenders.push(`${rel} (${count}) — the MON-134 class itself`); continue; }
      const allowed = ALLOWLIST[rel] ?? 0;
      if (count > allowed) offenders.push(`${rel} (${count} > allowed ${allowed})`);
      if (count < allowed) offenders.push(`${rel} (${count} < allowed ${allowed} — ratchet DOWN: shrink the allowlist)`);
    }
    expect(offenders, `Math.random drift under lib/:\n${offenders.join('\n')}`).toEqual([]);
  });
});
