/**
 * NEOAUDIT RING 2 route-tier — the ACTUAL `GET /api/safety-net` handler
 * invoked in-process on the Golden Household (CLAUDE.md Part 23 Ring 2).
 *
 * This is the MON-017 surface ("Safety Net score was fiction on real data").
 * The route runs the REAL chain end-to-end: getMasterFinancialSnapshot (all 12
 * golden queries) → canonical emergency-fund block → getCanonicalMonthlyCashflow
 * → computeSafetyScore → serialized JSON. Hand-computed expectation: EF 40 +
 * bills 0 (zero tracked bills is NOT full marks) + noNewDebt 15 + cashflow 15
 * = 70 BUILDING.
 *
 * Mocked (honest scope): `withPermission` injects the golden user;
 * `@/lib/db` serves the golden rows (incl. recurringPayment: []).
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
    withPermission: (_permission: string, handler: (req: unknown, auth: unknown) => Promise<Response>) =>
      (request: unknown) =>
        handler(request, { userId: GOLDEN_USER_ID, email: 'golden@household.test', role: 'USER', emailVerified: true }),
  };
});

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/safety-net/route';
import { EXPECTED } from './goldenHousehold';

describe('Ring 2 route-tier: GET /api/safety-net on the Golden Household', () => {
  it('serialized emergency-fund block matches the manifest', async () => {
    const res = await GET(new NextRequest('http://localhost/api/safety-net'), undefined as never);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.emergencyFund.liquidCash).toBe(EXPECTED.liquidCash);
    expect(data.emergencyFund.monthlyOutgoings).toBe(EXPECTED.expensesMonthly.total);
    expect(data.emergencyFund.monthsCovered).toBe(EXPECTED.safetyNet.monthsCoveredRounded);
    expect(data.emergencyFund.targetMonths).toBe(6);
    expect(data.emergencyFund.gap).toBe(0);
    expect(data.emergencyFund.monthlySurplus).toBe(EXPECTED.safetyNet.monthlySurplus);
    expect(data.emergencyFund.weeksToTarget).toBe(EXPECTED.safetyNet.weeksToTarget);
  });

  it('safety score = 70 BUILDING exactly (MON-017: zero tracked bills scores 0)', async () => {
    const res = await GET(new NextRequest('http://localhost/api/safety-net'), undefined as never);
    const { data } = await res.json();
    expect(data.safetyScore.total).toBe(EXPECTED.safetyNet.total);
    expect(data.safetyScore.grade).toBe(EXPECTED.safetyNet.grade);
    expect(data.bills.total).toBe(0);
    expect(data.bills.onTime).toBe(0);
  });
});
