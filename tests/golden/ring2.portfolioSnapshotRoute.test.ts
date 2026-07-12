/**
 * NEOAUDIT RING 2 route-tier — the ACTUAL `GET /api/portfolio/snapshot` handler
 * on the Golden Household (CLAUDE.md Part 23 Ring 2; NEOAUDIT.md §8 step-3 backlog).
 *
 * This route is the Home "Assets" / net-worth source and the MON-013/MON-014
 * type specimen: it once diverged from the master snapshot (omitted super,
 * valued holdings at cost, counted SOLD assets) → Home net worth drifted from
 * Balances/Investments. MON-013/014 unified it onto the ONE `calculateNetWorth`
 * engine with the SAME inputs as master. This LOCKS that convergence: on the
 * golden household the route MUST produce the exact master manifest
 * (netWorth 472,000 / assets 992,000). Drift again → this fails.
 *
 * Mocked (honest scope): `withPermission` injects the golden user; `@/lib/db`
 * serves the golden rows (Proxy throws on any un-served model; include-shaped
 * queries get empty nested relations per INCLUDE_KINDS).
 *
 * Coverage boundary (§20.6): verifies the route's HEADLINE net-worth / asset /
 * liability figures agree with the hand-computed master manifest (the
 * cross-surface convergence lock). It does NOT verify the SnapshotV2 GRDCS
 * `_links`/`_meta` relational layer — those nested includes are served EMPTY by
 * this harness (a later FK-resolved fixture capability).
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
import { GET } from '@/app/api/portfolio/snapshot/route';
import { EXPECTED } from './goldenHousehold';

const call = () => GET(new NextRequest('http://localhost/api/portfolio/snapshot'), undefined as never);

describe('Ring 2 route-tier: GET /api/portfolio/snapshot on the Golden Household', () => {
  it('200 with a serialized snapshot', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.netWorth).toBe('number');
  });

  it('MON-013/014 lock: net worth + total assets equal the master manifest (cross-surface convergence)', async () => {
    const json = await (await call()).json();
    // Same canonical calculateNetWorth + same inputs as master → same numbers.
    expect(json.netWorth).toBeCloseTo(EXPECTED.netWorth, 2); // 472,000
    expect(json.totalAssets).toBeCloseTo(EXPECTED.assets.total, 2); // 992,000
  });

  it('liabilities + net-worth identity tie out (SMSF excluded, SOLD excluded, holdings@market + cash)', async () => {
    const json = await (await call()).json();
    expect(json.totalLiabilities).toBeCloseTo(EXPECTED.liabilities.total, 2); // 520,000
    // If the route reverted to cost basis, dropped cash, counted SMSF/SOLD, or
    // omitted super, netWorth would already fail above — this pins the identity.
    expect(json.netWorth).toBeCloseTo(EXPECTED.assets.total - EXPECTED.liabilities.total, 2);
  });
});
