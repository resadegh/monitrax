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

  it('incomeDeltaPct = round((earnedLast − earnedFirst)/earnedFirst × 1000)/10', async () => {
    findMany.mockResolvedValue(baseRows());
    const r = await getMoneyStoryTrend('u1', 12);
    // (12,000 − 10,000) / 10,000 × 100 = 20.0
    expect(r.incomeDeltaPct).toBe(20);
  });

  it('cashflowDeltaMonthly = latest month net − previous month net', async () => {
    findMany.mockResolvedValue(baseRows());
    const r = await getMoneyStoryTrend('u1', 12);
    // June net 6,000 − May net 4,000 = 2,000
    expect(r.cashflowDeltaMonthly).toBe(2000);
  });

  it('outgoingsDeltaVsAvg = round(latest spent − window average spent)', async () => {
    findMany.mockResolvedValue(baseRows());
    const r = await getMoneyStoryTrend('u1', 12);
    // spent total 12,000 / 12 months = 1,000 avg; latest 6,000 → +5,000
    expect(r.outgoingsDeltaVsAvg).toBe(5000);
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
