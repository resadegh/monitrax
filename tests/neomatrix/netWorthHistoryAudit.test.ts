/**
 * Neomatrix A1 — netWorthHistory (DB-bound engine, prisma boundary mocked).
 *
 * `getNetWorthHistory` reads `prisma.netWorthSnapshot` and then computes a trend
 * + deltas. We mock ONLY the DB boundary (the input source) and run the REAL
 * engine over law-derived fixtures — this is an audit, NOT a re-implementation:
 * the delta math + honesty gate that we assert is the engine's own code.
 *
 * Law (the authority, external to the code):
 *   - CLAUDE.md §0 financial-adviser honesty contract: never invent data — a
 *     single point is not a trend, so <2 rows ⇒ empty trend + zero deltas.
 *   - deltaAbsolute = last.netWorth − first.netWorth
 *   - deltaPct = first ≠ 0 ? round((deltaAbsolute / |first|) × 1000) / 10 : 0
 *     (one-decimal %, absolute baseline, no divide-by-zero).
 *
 * A mismatch here is a `suspected-issue` raised with Reza — never a licence to
 * change the engine (CLAUDE.md §10 / §19). Model + test only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock ONLY the DB boundary. The engine's computation runs for real.
vi.mock('@/lib/db', () => ({
  prisma: { netWorthSnapshot: { findMany: vi.fn() } },
}));

import { getNetWorthHistory } from '@/lib/calculations/netWorthHistory';
import { prisma } from '@/lib/db';

const findMany = prisma.netWorthSnapshot.findMany as unknown as ReturnType<typeof vi.fn>;

const graph = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/financial-logic/graph/financial-graph.json'), 'utf8'),
);
const nodeIds = new Set(graph.nodes.map((n: { id: string }) => n.id));

/** Build a stored-snapshot row the way Prisma returns it (snapshotDate is a Date). */
const row = (month: string, netWorth: number, totalAssets = netWorth + 100000, totalLiabilities = 100000) => ({
  snapshotDate: new Date(`${month}T00:00:00.000Z`),
  netWorth,
  totalAssets,
  totalLiabilities,
});

beforeEach(() => findMany.mockReset());

describe('Neomatrix A1 — netWorthHistory (model refs the code; DB boundary mocked)', () => {
  it('the engine node exists in financial-graph.json (audit tied to the model)', () => {
    expect(nodeIds.has('engine.netWorthHistory.getNetWorthHistory')).toBe(true);
    expect(nodeIds.has('number.netWorthTrendDelta')).toBe(true);
  });

  it('deltaAbsolute = last − first (law: simple difference of stored points)', async () => {
    findMany.mockResolvedValue([row('2026-01-01', 100000), row('2026-02-01', 120000)]);
    const res = await getNetWorthHistory('u1', 12);
    // 120,000 − 100,000 = 20,000
    expect(res.deltaAbsolute).toBe(20000);
    expect(res.trend).toHaveLength(2);
  });

  it('deltaPct = round((Δ/|first|)×1000)/10 (law: one-decimal %)', async () => {
    findMany.mockResolvedValue([row('2026-01-01', 100000), row('2026-02-01', 120000)]);
    const res = await getNetWorthHistory('u1', 12);
    // 20,000 / 100,000 × 100 = 20.0
    expect(res.deltaPct).toBe(20);
  });

  it('honesty gate: <2 rows ⇒ empty trend + zero deltas (never fabricate a curve)', async () => {
    findMany.mockResolvedValue([row('2026-02-01', 120000)]);
    const res = await getNetWorthHistory('u1', 12);
    expect(res.trend).toEqual([]);
    expect(res.deltaAbsolute).toBe(0);
    expect(res.deltaPct).toBe(0);
  });

  it('no divide-by-zero: first netWorth 0 ⇒ deltaPct 0 (deltaAbsolute still real)', async () => {
    findMany.mockResolvedValue([row('2026-01-01', 0), row('2026-02-01', 5000)]);
    const res = await getNetWorthHistory('u1', 12);
    expect(res.deltaAbsolute).toBe(5000);
    expect(res.deltaPct).toBe(0);
  });

  it('absolute baseline: a negative first point uses |first| (a recovery is a positive %)', async () => {
    findMany.mockResolvedValue([row('2026-01-01', -10000), row('2026-02-01', -5000)]);
    const res = await getNetWorthHistory('u1', 12);
    // Δ = −5,000 − (−10,000) = +5,000; 5,000 / |−10,000| × 100 = +50.0
    expect(res.deltaAbsolute).toBe(5000);
    expect(res.deltaPct).toBe(50);
  });

  it('empty store ⇒ honesty gate (0 rows)', async () => {
    findMany.mockResolvedValue([]);
    const res = await getNetWorthHistory('u1', 12);
    expect(res.trend).toEqual([]);
    expect(res.deltaAbsolute).toBe(0);
    expect(res.deltaPct).toBe(0);
  });
});
