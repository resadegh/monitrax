/**
 * MON-031/064 Ratchet — ONE canonical "liquid cash", every surface
 * (CLAUDE.md §12.2.1; MATRIX_FIX_DISCIPLINE gate 4).
 *
 * The live defect: quickMetrics.liquidCash was GROSS spendable-account cash
 * (Safety Net showed $304,304) while the MON-012 accessibility buckets netted
 * credit cards (Balances/Home//cashflow showed $301,808) — two variants of one
 * concept under one label; the gap was exactly the Qantas card ($2,496).
 *
 * Canonical definition (Reza, 2026-07-18): DEPLOYABLE cash — spendable-account
 * balances NET of revolving credit. This suite runs the REAL master service +
 * the REAL safety-net route on a golden variant WITH a credit card and locks:
 *   • quickMetrics.liquidCash = gross spendable cash − credit cards
 *   • buckets.liquidToday === quickMetrics.liquidCash (by construction)
 *   • the safety-net route's emergencyFund.liquidCash === the same figure
 *   • bucket tie-out to net worth still holds (the MON-012 invariant)
 *
 * §19.2 worked example: golden cash 50,000 (8,000 + 42,000) + a $2,496
 * CREDIT_CARD loan → canonical liquid = 47,504.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

const CC = 2_496;

vi.mock('@/lib/db', async () => {
  const { createGoldenDbFrom, GOLDEN_DB } = await import('./goldenHousehold');
  const rows = structuredClone(GOLDEN_DB) as unknown as Record<string, { id?: string }[]>;
  (rows.loan as Record<string, unknown>[]).push({
    id: 'l-qantas-card',
    ownerEntityId: null,
    name: 'Qantas card',
    principal: 2_496,
    minRepayment: 100,
    repaymentFrequency: 'MONTHLY',
    interestRateAnnual: 0.20,
    type: 'CREDIT_CARD',
    isInterestOnly: false,
    propertyId: null,
    offsetAccountId: null,
  });
  const db = createGoldenDbFrom(rows);
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

vi.mock('@/lib/security/auditLog', () => ({ createAuditLog: async () => undefined }));

import { NextRequest } from 'next/server';
import { getMasterFinancialSnapshot, type MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { computeAccessibilityBuckets } from '@/lib/calculations/accessibilityBuckets';
import { GET as safetyNetGET } from '@/app/api/safety-net/route';
import { GOLDEN_USER_ID, EXPECTED } from './goldenHousehold';

const GROSS_CASH = 50_000; // golden: 8,000 everyday + 42,000 savings
const CANONICAL_LIQUID = GROSS_CASH - CC; // 47,504

let snapshot: MasterFinancialSnapshot;
let safetyNetJson: any;

beforeAll(async () => {
  snapshot = await getMasterFinancialSnapshot(GOLDEN_USER_ID);
  const res = await (safetyNetGET as unknown as (req: NextRequest) => Promise<Response>)(
    new NextRequest('http://localhost/api/safety-net'),
  );
  safetyNetJson = await res.json();
});

describe('MON-031/064 — one canonical liquid cash (deployable, net of revolving credit)', () => {
  it('quickMetrics.liquidCash = gross spendable cash − credit cards (47,504)', () => {
    expect(snapshot.quickMetrics.liquidCash).toBeCloseTo(CANONICAL_LIQUID, 2);
  });

  it('buckets.liquidToday === quickMetrics.liquidCash — by construction, no second variant', () => {
    const buckets = computeAccessibilityBuckets(snapshot.netWorth, snapshot.quickMetrics.liquidCash);
    expect(buckets.liquidToday).toBeCloseTo(snapshot.quickMetrics.liquidCash, 6);
    expect(buckets.creditCards).toBeCloseTo(CC, 2);
  });

  it('the MON-012 tie-out still holds with the net input (buckets sum to net worth)', () => {
    const buckets = computeAccessibilityBuckets(snapshot.netWorth, snapshot.quickMetrics.liquidCash);
    expect(buckets.liquidToday + buckets.accessible + buckets.lockedLongTerm)
      .toBeCloseTo(snapshot.netWorth.netWorth, 2);
  });

  it("the REAL safety-net route's emergencyFund.liquidCash reads the same canonical figure", () => {
    expect(safetyNetJson.data.emergencyFund.liquidCash).toBe(Math.round(CANONICAL_LIQUID));
  });

  it('regression guard: without a credit card the golden numbers are untouched (gross == net)', () => {
    // The base golden household has no credit cards — its liquidCash stays
    // 50,000 and every EXPECTED anchor holds (asserted by ring2.masterSnapshot).
    expect(EXPECTED.liquidCash).toBe(GROSS_CASH);
    // Net worth here reflects the added card as a liability (472,000 − 2,496).
    expect(snapshot.netWorth.netWorth).toBeCloseTo(EXPECTED.netWorth - CC, 2);
  });
});
