/**
 * MON-031/064 Ratchet #2 — the VR-017 topology: the credit card is an
 * ACCOUNT, not a loan (CLAUDE.md §12.2.1; FIX_PROTOCOL §1 F2 "same engine,
 * different inputs"; Part 23 Ratchet).
 *
 * WHY THIS FILE EXISTS: #1452 netted `quickMetrics.liquidCash` by subtracting
 * `netWorth.liabilities.creditCards` — which is LOANS-only
 * (`calculateTotalLiabilities`, netWorthCalculator.ts). On live data the
 * Qantas card is a CREDIT_CARD-typed ACCOUNT with a NEGATIVE balance (VR-007
 * capture: 3 accounts = NAB Everyday + Guildford Offset + Qantas), so the
 * subtraction was silently 0 and Ring-3 VR-017 still saw Safety Net "Liquid
 * savings" GROSS ($304,304 vs $301,808 net; months 11.7 vs 11.6). The sibling
 * golden (`ring2.liquidCashParity.test.ts`) modelled the card as a LOAN and
 * passed — same engine, different inputs. This file locks the ACCOUNT
 * topology so that class of miss can never ship again.
 *
 * §19.2 worked example (golden): cash 50,000 (8,000 + 42,000) + a CREDIT_CARD
 * ACCOUNT at −2,496 → canonical deployable liquid = 47,504; declared burn
 * 1,700/mo → monthsCovered = 47,504 ÷ 1,700 = 27.94…
 * Topology signature: liabilities.creditCards = 0 (no card LOAN) and the
 * −2,496 lives inside assets.accounts (= 47,504).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

const CC = 2_496;

vi.mock('@/lib/db', async () => {
  const { createGoldenDbFrom, GOLDEN_DB } = await import('./goldenHousehold');
  const rows = structuredClone(GOLDEN_DB) as unknown as Record<string, { id?: string }[]>;
  (rows.account as Record<string, unknown>[]).push({
    id: 'a-qantas-card',
    ownerEntityId: null,
    name: 'Qantas card',
    type: 'CREDIT_CARD',
    currentBalance: -2_496, // literal — vi.mock factories are hoisted above `CC`
    balanceSource: 'MANUAL',
    balanceLastUpdatedAt: new Date('2026-07-01T00:00:00Z'),
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

const GROSS_CASH = 50_000; // 8,000 everyday + 42,000 savings
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

describe('MON-031/064 — account-typed credit card (the VR-017 live topology)', () => {
  it('topology signature: the card is NOT a loan — liabilities.creditCards is 0', () => {
    // This is the exact condition that made the #1452 netting inert. If this
    // assertion ever fails, the fixture no longer reproduces the VR-017 class.
    expect(snapshot.netWorth.liabilities.creditCards).toBe(0);
    // …and the −2,496 is embedded in the accounts asset total instead.
    expect(snapshot.netWorth.assets.accounts).toBeCloseTo(GROSS_CASH - CC, 2);
  });

  it('quickMetrics.liquidCash nets the ACCOUNT-typed card (47,504) — the VR-017 fix', () => {
    expect(snapshot.quickMetrics.liquidCash).toBeCloseTo(CANONICAL_LIQUID, 2);
  });

  it('emergency monthsCovered == net liquid ÷ burn (the I9 identity VR-017 saw broken)', () => {
    const ef = snapshot.emergencyFund;
    expect(ef.monthsCovered).toBeCloseTo(
      snapshot.quickMetrics.liquidCash / ef.monthlyExpenses,
      6,
    );
    // Hand-computed: 47,504 ÷ 1,700 declared burn.
    expect(ef.monthsCovered).toBeCloseTo(CANONICAL_LIQUID / EXPECTED.emergencyFund.monthlyExpenses, 6);
  });

  it("the REAL safety-net route's 'Liquid savings' + months read the same canonical figures", () => {
    expect(safetyNetJson.data.emergencyFund.liquidCash).toBe(Math.round(CANONICAL_LIQUID));
    expect(safetyNetJson.data.emergencyFund.monthsCovered).toBeCloseTo(
      Math.round((CANONICAL_LIQUID / EXPECTED.emergencyFund.monthlyExpenses) * 10) / 10,
      6,
    );
  });

  it('buckets.liquidToday === quickMetrics.liquidCash and the tie-out holds', () => {
    const buckets = computeAccessibilityBuckets(snapshot.netWorth, snapshot.quickMetrics.liquidCash);
    expect(buckets.liquidToday).toBeCloseTo(snapshot.quickMetrics.liquidCash, 6);
    expect(buckets.liquidToday + buckets.accessible + buckets.lockedLongTerm)
      .toBeCloseTo(snapshot.netWorth.netWorth, 2);
  });

  it('net worth carries the card through assets (472,000 − 2,496)', () => {
    expect(snapshot.netWorth.netWorth).toBeCloseTo(EXPECTED.netWorth - CC, 2);
  });
});
