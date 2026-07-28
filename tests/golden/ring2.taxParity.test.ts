/**
 * MON-020/060 Ratchet — ONE tax producer, every surface (CLAUDE.md §12.2.1;
 * MATRIX_FIX_DISCIPLINE gate 4).
 *
 * The MON-060 class: master's `buildTaxSummary` was a SECOND tax assembler
 * (no depreciation, no MON-045 loan interest, no super, no franking) so the
 * activity Sankey's "Tax" diverged from /dashboard/tax and /cashflow — same
 * engine, different inputs (FIX_PROTOCOL §1 F2). After the collapse, the tax
 * page route, the canonical `getUserTaxPosition` bundle, and the master
 * snapshot's tax summary MUST all be the same number by construction — this
 * suite locks that so a second assembler can never silently reappear.
 *
 * §19.2 hand-computed pin (golden household, FY25-26 resident brackets):
 *   salary 7,800/mo = 93,600 + rent 600/wk = 31,200 → taxable 124,800.
 *   Tax: (45,000−18,200)×16% = 4,288 + (124,800−45,000)×30% = 23,940
 *   + Medicare levy 2% = 2,496
 *   + MON-088 Medicare levy SURCHARGE: the golden household has NO
 *     HouseholdProfile (no cover recorded → conservatively uncovered,
 *     a blank never silently asserts cover) and is SINGLE; 124,800 sits
 *     in the 113,001–151,000 tier → 1.25% × 124,800 = 1,560
 *   → NET TAX 32,284.
 *
 * Honest coverage: the golden fixture has no loan-ledger rows and its
 * property-loans include resolves empty, so the MON-045 deductible-interest
 * leg contributes 0 here (parity of the PLUMBING is what this locks; the
 * MON-045 math has its own suite). It does NOT verify live-data numbers —
 * that is the Matrix's cross-surface Ring-3.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

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

vi.mock('@/lib/security/auditLog', () => ({ createAuditLog: async () => undefined }));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/tax/position/route';
import { getUserTaxPosition } from '@/lib/tax-engine/position/userTaxPosition';
import { getMasterFinancialSnapshot, type MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { GOLDEN_USER_ID } from './goldenHousehold';

// The §19.2 hand-computed pin (see file header).
// MON-106 re-pin (2026-07-28): the FY2026-27 config landed with the
// legislated 15% band (was 16%), so current-FY income tax on the golden's
// $124,800 taxable falls by exactly (45,000 − 18,201 + 1) × 1% = $268:
// 4,020 + 79,800 × 30% = 27,960 (was 28,228) → netTax 32,284 → 32,016.
const PIN = { taxableIncome: 124_800, netTax: 32_016, totalDeductions: 0 };

let bundleNetTax: number;
let bundleTaxable: number;
let bundleDeductions: number;
let routeJson: any;
let master: MasterFinancialSnapshot;

beforeAll(async () => {
  const bundle = await getUserTaxPosition(GOLDEN_USER_ID);
  bundleNetTax = Math.round(bundle.taxPosition.tax.netTax);
  bundleTaxable = Math.round(bundle.taxPosition.tax.taxableIncome);
  bundleDeductions = Math.round(bundle.taxPosition.deductions.total);

  const res = await (GET as unknown as (req: NextRequest, p?: unknown) => Promise<Response>)(
    new NextRequest('http://localhost/api/tax/position'),
  );
  routeJson = await res.json();

  master = await getMasterFinancialSnapshot(GOLDEN_USER_ID);
});

describe('MON-020/060 — one tax producer, every surface (golden household)', () => {
  it('the canonical bundle lands the hand-computed pin exactly', () => {
    expect(bundleTaxable).toBe(PIN.taxableIncome);
    expect(bundleNetTax).toBe(PIN.netTax);
    expect(bundleDeductions).toBe(PIN.totalDeductions);
  });

  it('the tax page route (Float warnings + Decimal numbers) equals the bundle', () => {
    // The route computes its Decimal twin from bundle.engineInputs — same
    // inputs by construction; Float↔Decimal may differ by rounding only.
    expect(routeJson.summary.taxableIncome).toBe(PIN.taxableIncome);
    expect(Math.abs(routeJson.summary.taxPayable - bundleNetTax)).toBeLessThanOrEqual(1);
    expect(routeJson.summary.totalDeductions).toBe(bundleDeductions);
  });

  it("the master snapshot's tax summary (activity Sankey / dashboard tiles) equals the bundle", () => {
    expect(master.tax.estimatedTaxableIncome).toBe(bundleTaxable);
    expect(master.tax.estimatedTaxPayable).toBe(bundleNetTax);
    expect(master.tax.totalDeductions).toBe(bundleDeductions);
  });

  it('all three surfaces agree with each other (the A3-convergence lock)', () => {
    expect(master.tax.estimatedTaxPayable - Math.round(routeJson.summary.taxPayable)).toBeGreaterThanOrEqual(-1);
    expect(master.tax.estimatedTaxPayable - Math.round(routeJson.summary.taxPayable)).toBeLessThanOrEqual(1);
    expect(master.tax.estimatedTaxableIncome).toBe(routeJson.summary.taxableIncome);
  });
});
