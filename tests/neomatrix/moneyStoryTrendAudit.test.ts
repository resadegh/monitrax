/**
 * Neomatrix A1 — moneyStoryTrend (DB-bound engine; prisma boundary mocked +
 * deterministic clock).
 *
 * `getMoneyStoryTrend` reads `prisma.unifiedTransaction` (the SSOT — §12.2; the
 * legacy `Transaction` table it used to read was dead/empty) and buckets it into a 12-month
 * earned-vs-spent ribbon + KPI deltas. Its month window is anchored to "now", so
 * we (a) mock ONLY the DB boundary and (b) pin the clock with fake timers — then
 * run the REAL engine over law-derived fixtures. This is an audit, NOT a
 * re-implementation: the bucketing + margin/delta math we assert is the engine's
 * own code.
 *
 * Law (the authority, external to the code):
 *   - CLAUDE.md §0 honesty contract: never invent data; a month with no activity
 *     renders zero (not interpolated); <2 months of activity ⇒ empty trend.
 *   - §19.1 actuals: each bucket is a literal sum of the user's own transactions
 *     (IN → earned, OUT → +|amount| spent).
 *   - kept = max(0, round(earned − spent)); currentMargin = round(last.kept/lastEarned×100);
 *     incomeDeltaPct = round((earnedLast−earnedFirst)/earnedFirst×1000)/10;
 *     cashflowDeltaMonthly = last − prev month net; outgoingsDeltaVsAvg = round(lastSpent − windowAvg).
 *
 * A mismatch is a `suspected-issue` raised with Reza — never a licence to change
 * the engine (CLAUDE.md §10 / §19). Model + test only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('@/lib/db', () => ({
  prisma: { unifiedTransaction: { findMany: vi.fn() } },
}));

import { getMoneyStoryTrend } from '@/lib/calculations/moneyStoryTrend';
import { prisma } from '@/lib/db';

const findMany = prisma.unifiedTransaction.findMany as unknown as ReturnType<typeof vi.fn>;

const graph = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/financial-logic/graph/financial-graph.json'), 'utf8'),
);
const nodeIds = new Set(graph.nodes.map((n: { id: string }) => n.id));

// A transaction the way Prisma returns it (date is a Date). Use the local Date
// constructor so it matches the engine's local getFullYear()/getMonth() bucketing.
const tx = (year: number, monthIdx: number, amount: number, direction: 'IN' | 'OUT') => ({
  date: new Date(year, monthIdx, 15),
  amount,
  direction,
});

beforeEach(() => {
  vi.useFakeTimers();
  // Mid-month, midday — keeps the window + bucketing TZ-safe (no boundary cross).
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0)); // June 15, 2026 local
  findMany.mockReset();
});
afterEach(() => vi.useRealTimers());

// Canonical fixture: May earned 10k/spent 6k, June earned 12k/spent 6k.
const baseRows = () => [
  tx(2026, 4, 10000, 'IN'),
  tx(2026, 4, 6000, 'OUT'),
  tx(2026, 5, 12000, 'IN'),
  tx(2026, 5, 6000, 'OUT'),
];

// Phase 57 (2026-07-02) — realistic partial-current-month fixture. The clock is
// pinned to June 15 (below), so June is the IN-PROGRESS current month. Complete
// months Mar/Apr/May carry full data; June has only a tiny partial OUT and NO
// income yet — the real start-of-month situation that made the KPI tiles read
// $0 / -100% / 0%. The trailing annual basis + the delta pills must EXCLUDE the
// in-progress June bucket.
const partialCurrentRows = () => [
  tx(2026, 2, 38000, 'IN'),  // Mar (complete)
  tx(2026, 2, 30000, 'OUT'),
  tx(2026, 3, 40000, 'IN'),  // Apr (complete)
  tx(2026, 3, 28000, 'OUT'),
  tx(2026, 4, 42000, 'IN'),  // May (complete)
  tx(2026, 4, 32000, 'OUT'),
  tx(2026, 5, 200, 'OUT'),   // Jun (current, in-progress) — partial, no income yet
];

describe('Neomatrix A1 — moneyStoryTrend (model refs the code; DB + clock pinned)', () => {
  it('the engine node exists in financial-graph.json (audit tied to the model)', () => {
    expect(nodeIds.has('engine.moneyStoryTrend.getMoneyStoryTrend')).toBe(true);
    expect(nodeIds.has('number.moneyStoryMargin')).toBe(true);
    expect(nodeIds.has('input.UnifiedTransaction')).toBe(true);
  });

  it('currentMargin = round(last.kept / (kept+spent) × 100)', async () => {
    findMany.mockResolvedValue(baseRows());
    const r = await getMoneyStoryTrend('u1', 12);
    // June: kept 6,000 / earned 12,000 × 100 = 50
    expect(r.currentMargin).toBe(50);
  });

  it('baselineMargin = the first active month\'s kept margin', async () => {
    findMany.mockResolvedValue(baseRows());
    const r = await getMoneyStoryTrend('u1', 12);
    // May: kept 4,000 / earned 10,000 × 100 = 40
    expect(r.baselineMargin).toBe(40);
  });

  it('marginDeltaPoints = current − baseline (percentage points)', async () => {
    findMany.mockResolvedValue(baseRows());
    const r = await getMoneyStoryTrend('u1', 12);
    expect(r.marginDeltaPoints).toBe(10); // 50 − 40
  });

  // Phase 57 (2026-07-02) — deltas + the trailing annual basis are computed over
  // COMPLETE months only; the in-progress current month (June) is excluded. This
  // is the fix for the dashboard tiles that read $0 / -100% / 0% in the first
  // days of a month. The partialCurrentRows fixture is the §19.2 worked example.
  it('incomeDeltaPct excludes the in-progress current month (never a false -100%)', async () => {
    findMany.mockResolvedValue(partialCurrentRows());
    const r = await getMoneyStoryTrend('u1', 12);
    // Complete Mar/Apr/May earned 38k/40k/42k; June ($0 income) EXCLUDED.
    // (42,000 − 38,000) / 38,000 × 100 = 10.526 → 10.5.
    expect(r.incomeDeltaPct).toBe(10.5);
  });

  it('cashflowDeltaMonthly = last COMPLETE month net − prior complete month net', async () => {
    findMany.mockResolvedValue(partialCurrentRows());
    const r = await getMoneyStoryTrend('u1', 12);
    // May net 10,000 − Apr net 12,000 = -2,000 (June excluded).
    expect(r.cashflowDeltaMonthly).toBe(-2000);
  });

  it('outgoingsDeltaVsAvg = last complete month spent − complete-month average', async () => {
    findMany.mockResolvedValue(partialCurrentRows());
    const r = await getMoneyStoryTrend('u1', 12);
    // May spent 32,000 − avg(30k, 28k, 32k = 30,000) = 2,000.
    expect(r.outgoingsDeltaVsAvg).toBe(2000);
  });

  it('§19.2 trailing annual basis = avg of COMPLETE populated months × 12 (the tile headline)', async () => {
    findMany.mockResolvedValue(partialCurrentRows());
    const r = await getMoneyStoryTrend('u1', 12);
    // avg income 40,000 × 12 = 480,000; avg outgoings 30,000 × 12 = 360,000.
    expect(r.annualIncome).toBe(480000);
    expect(r.annualOutgoings).toBe(360000);
    expect(r.annualNet).toBe(120000);
    expect(r.avgMonthlyNet).toBe(10000);
    expect(r.savingsRateTrailing).toBe(25);
    expect(r.trailingMonthsWithData).toBe(3);
  });

  it('regression: a near-empty in-progress month does NOT zero the annual tiles', async () => {
    findMany.mockResolvedValue(partialCurrentRows());
    const r = await getMoneyStoryTrend('u1', 12);
    // The bug produced $0 income / -100% YoY / 0% savings from current-month×12.
    expect(r.annualIncome).toBeGreaterThan(0);
    expect(r.savingsRateTrailing).toBeGreaterThan(0);
    expect(r.incomeDeltaPct).not.toBe(-100);
  });

  it('kept clamps ≥ 0: a month that spent more than it earned shows kept 0 (never negative)', async () => {
    findMany.mockResolvedValue([
      tx(2026, 4, 5000, 'IN'),
      tx(2026, 4, 8000, 'OUT'), // May spent > earned
      tx(2026, 5, 12000, 'IN'),
      tx(2026, 5, 6000, 'OUT'),
    ]);
    const r = await getMoneyStoryTrend('u1', 12);
    const may = r.trend.find((p) => p.label === 'May')!;
    expect(may.kept).toBe(0); // max(0, round(5,000 − 8,000))
    expect(may.spent).toBe(8000); // spend is still real
  });

  it('honesty gate: <2 months of activity ⇒ empty trend + zero margin (never fabricate)', async () => {
    findMany.mockResolvedValue([tx(2026, 5, 12000, 'IN'), tx(2026, 5, 6000, 'OUT')]); // June only
    const r = await getMoneyStoryTrend('u1', 12);
    expect(r.trend).toEqual([]);
    expect(r.currentMargin).toBe(0);
    expect(r.monthlyEarned).toEqual([]);
  });
});
