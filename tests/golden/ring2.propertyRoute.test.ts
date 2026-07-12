/**
 * NEOAUDIT RING 2 route-tier — the ACTUAL `GET /api/properties/[id]` handler
 * invoked in-process on the Golden Household (CLAUDE.md Part 23 Ring 2;
 * NEOAUDIT.md §8 step 3).
 *
 * This is the MON-028 type specimen: the engine was correct on every surface,
 * but this route's select dropped `linkedTransactions` from its JSON — so the
 * detail page fed the engine partial inputs and drifted +$34K. Only invoking
 * the REAL route and asserting the SERIALIZED payload catches that class.
 *
 * What runs REAL here: the route handler body, `verifyOwnership`,
 * `enrichPropertiesWithActuals` (its prisma reads served by the golden DB),
 * and NextResponse JSON serialization. What is mocked (with the honest scope
 * that implies): `withPermission` (token verification is Ring-1/unit
 * territory — this test injects the authenticated golden user) and
 * `@/lib/db` (serves the golden rows; `findUnique` honours `where.id` so the
 * ownership/404 path stays live).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { GOLDEN_DB, GOLDEN_USER_ID } = await import('./goldenHousehold');
  const propertyRow = {
    ...GOLDEN_DB.property[0],
    userId: GOLDEN_USER_ID,
    heroImageMime: null, // heroImage bytea omitted at query time (route `omit`)
    loans: GOLDEN_DB.loan.filter((l) => l.propertyId === 'p-avalon'),
    income: GOLDEN_DB.income.filter((i) => i.propertyId === 'p-avalon'),
    expenses: GOLDEN_DB.expense.filter((e) => e.propertyId === 'p-avalon'),
    depreciationSchedules: [],
  };
  const db = {
    property: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === 'p-avalon' ? structuredClone(propertyRow) : null,
    },
    unifiedTransaction: { findMany: async () => [] }, // declared basis
  };
  return { default: db, prisma: db };
});

vi.mock('@/lib/auth/guards', async () => {
  const { GOLDEN_USER_ID } = await import('./goldenHousehold');
  return {
    // Inject the authenticated golden user; keep the real handler signature.
    withPermission: (_permission: string, handler: (req: unknown, auth: unknown, params: unknown) => Promise<Response>) =>
      (request: unknown, params: unknown) =>
        handler(request, { userId: GOLDEN_USER_ID, email: 'golden@household.test', role: 'USER', emailVerified: true }, params),
  };
});

vi.mock('@/lib/security/auditLog', () => ({ createAuditLog: async () => undefined }));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/properties/[id]/route';
import { computePropertyCashflow } from '@/lib/calculations/propertyCashflow';
import { EXPECTED } from './goldenHousehold';

const call = (id: string) =>
  GET(new NextRequest(`http://localhost/api/properties/${id}`), {
    params: Promise.resolve({ id }),
  });

describe('Ring 2 route-tier: GET /api/properties/[id] on the Golden Household', () => {
  it('200 with the full serialized payload', async () => {
    const res = await call('p-avalon');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('p-avalon');
    expect(json.currentValue).toBe(800_000);
    expect(json.hasHeroImage).toBe(false);
    expect(json.heroImage).toBeUndefined(); // bytea never serialized
  });

  it('MON-028 lock: linkedTransactions is present in the JSON (the dropped-field regression)', async () => {
    const json = await (await call('p-avalon')).json();
    expect(Array.isArray(json.linkedTransactions)).toBe(true);
    // Relations survive serialization with the fields the page's engine needs.
    expect(json.loans).toHaveLength(1);
    expect(json.loans[0].minRepayment).toBe(3_000);
    expect(json.loans[0].principal).toBe(500_000);
    expect(json.income).toHaveLength(1);
    expect(json.income[0].frequency).toBe('WEEKLY');
  });

  it('page-level parity: the SERIALIZED payload fed to the engine reproduces the manifest numbers', async () => {
    // Exactly what the detail page does with this response (§19.4): feed the
    // serialized income/expenses/loans/linkedTransactions to the ONE engine.
    const json = await (await call('p-avalon')).json();
    const cf = computePropertyCashflow({
      income: json.income,
      expenses: json.expenses,
      loans: json.loans,
      transactions: json.linkedTransactions,
    });
    expect(cf.annualRent).toBeCloseTo(EXPECTED.property.annualRentalIncome, 2);
    expect(cf.monthlyLoanRepayment).toBeCloseTo(3_000, 2);
    expect(cf.monthlyCashflow).toBeCloseTo(EXPECTED.property.monthlyCashflow, 2);
    expect(cf.basis).toBe('declared');
  });

  it("ownership: another user's / unknown property id → 404 (existence masked)", async () => {
    const res = await call('p-someone-elses');
    expect(res.status).toBe(404);
  });
});
