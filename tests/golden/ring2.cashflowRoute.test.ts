/**
 * NEOAUDIT RING 2 route-tier — the ACTUAL `GET /api/cashflow` handler on the
 * Golden Household (CLAUDE.md Part 23 Ring 2; NEOAUDIT.md §8 step-3 backlog).
 *
 * The /cashflow page is the MON-020/021/027/029 surface. This route has two
 * shapes we test at DIFFERENT rigor, honestly:
 *
 *  - LITE mode (?type=lite): a crude fallback — raw `toMonthly` sums. Every
 *    summary figure is HAND-COMPUTABLE (§19.2), so we assert exact values.
 *  - FULL mode (default): runs the real `buildCFEInput → generateForecast →
 *    buildCOEInput → generateOptimisations` pipeline end-to-end. The day-by-day
 *    projection is NOT hand-computable, so we DON'T assert exact forecast
 *    values — we assert it RUNS on golden data (catches the crash/plumbing
 *    class, MON-028-style) and that the summary honours the accounting identity
 *    (net = income − expenses) with all-finite numbers.
 *
 * Coverage boundary (§20.6): LITE summary is verified EXACTLY; FULL mode is
 * verified as "executes end-to-end + identity + finite", NOT exact projection
 * values (those are Ring-0 fixture territory if/when the CFE engine is fixtured).
 *
 * Mocked (honest scope): `withPermission` injects the golden user; `@/lib/db`
 * serves the golden rows (Proxy throws on any un-served model).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createGoldenDb } = await import('./goldenHousehold');
  const db = createGoldenDb();
  return { default: db, prisma: db };
});

vi.mock('@/lib/auth/guards', async () => {
  const { GOLDEN_USER_ID } = await import('./goldenHousehold');
  return {
    withPermission: (_permission: string, handler: (req: unknown, auth: unknown, params: unknown) => Promise<Response>) =>
      (request: unknown, params: unknown) =>
        handler(request, { userId: GOLDEN_USER_ID, email: 'golden@household.test', role: 'USER', emailVerified: true }, params),
  };
});

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cashflow/route';
import { EXPECTED } from './goldenHousehold';

const call = (query = '') => GET(new NextRequest(`http://localhost/api/cashflow${query}`), undefined as never);

describe('Ring 2 route-tier: GET /api/cashflow LITE mode — exact summary', () => {
  it('lite summary matches the hand-computed manifest', async () => {
    const res = await call('?type=lite');
    expect(res.status).toBe(200);
    const { data } = await res.json();
    const s = data.forecast.summary;
    const e = EXPECTED.cashflowLite;
    expect(s.totalIncome30).toBeCloseTo(e.totalIncome30, 2); // 10,400
    expect(s.totalExpenses30).toBeCloseTo(e.totalExpenses30, 2); // 1,700
    expect(s.netCashflow30).toBeCloseTo(e.netCashflow30, 2); // 8,700
    expect(s.monthlyBurnRate).toBeCloseTo(e.monthlyBurnRate, 2); // 1,700
    expect(s.threeMonthBurnRate).toBeCloseTo(e.threeMonthBurnRate, 2); // 5,100
    expect(s.withdrawableCash).toBeCloseTo(e.withdrawableCash, 2); // 44,900
    expect(data.optimisations.breakEvenDay).toBe(e.breakEvenDay); // 5
  });

  it('lite 90-day figures are exactly 3× the 30-day figures', async () => {
    const { data } = await (await call('?type=lite')).json();
    const s = data.forecast.summary;
    expect(s.totalIncome90).toBeCloseTo(s.totalIncome30 * 3, 2);
    expect(s.totalExpenses90).toBeCloseTo(s.totalExpenses30 * 3, 2);
    expect(s.netCashflow90).toBeCloseTo(s.netCashflow30 * 3, 2);
  });
});

describe('Ring 2 route-tier: GET /api/cashflow FULL mode — runs end-to-end + invariants (not exact projection)', () => {
  it('the full CFE→COE pipeline executes on golden data (200, catches the crash/plumbing class)', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.forecast).toBeTruthy();
    expect(json.data.forecast.summary).toBeTruthy();
  });

  it('summary honours the accounting identity and is all-finite (no NaN forecast leak)', async () => {
    const { data } = await (await call()).json();
    const s = data.forecast.summary;
    // Identity that must hold regardless of the exact projection.
    expect(s.netCashflow30).toBeCloseTo(s.totalIncome30 - s.totalExpenses30, 2);
    // No NaN/Infinity leaking from the projection into headline figures.
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === 'number') expect(Number.isFinite(v), `summary.${k} must be finite`).toBe(true);
    }
  });
});
