/**
 * MON-104 — the capture write path and the read path resolve FY through THE
 * one canonical resolver, and an unresolvable FY is REJECTED at the write
 * boundary instead of persisting an orphaned, permanently-invisible row
 * (VR-037 finding 1).
 *
 * Three locks:
 *  1. RESOLVER — `resolveRequestedTaxYear` unit contract: configured FY →
 *     that config (identity); absent → the current-FY config (which itself
 *     normalises an unconfigured current year to the latest available, so
 *     the default WRITE key always equals the default READ key); anything
 *     else → null.
 *  2. ROUND-TRIP — the REAL psi-assessment route handlers (mocked auth +
 *     in-memory prisma): a PUT persists under exactly the FY key the GET
 *     resolves to, for an explicit configured FY and for the default; an
 *     unconfigured FY is 400-rejected and NOTHING is persisted.
 *  3. TOPOLOGY — all three capture/assessment routes (psi-assessment,
 *     div152-assessment, smsf-return) import the canonical resolver and no
 *     longer carry the raw `fy ?? getCurrentTaxYearConfig()` fallback.
 *
 * Coverage (precise): verifies the resolver contract, the psi-assessment
 * route's write/read key identity + write-boundary rejection in-process,
 * and the source topology of all three routes. Does NOT verify the real
 * Prisma layer or the rendered questionnaire (Ring-3 owns those).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TEST_USER = 'u-mon104';

// In-memory psi_assessments book keyed by entityId|financialYear.
const saved = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/db', () => ({
  prisma: {
    legalEntity: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
        where.userId === TEST_USER ? { id: where.id } : null,
    },
    psiAssessment: {
      findUnique: async ({ where }: { where: { entityId_financialYear: { entityId: string; financialYear: string } } }) => {
        const k = `${where.entityId_financialYear.entityId}|${where.entityId_financialYear.financialYear}`;
        return saved.get(k) ?? null;
      },
      upsert: async ({ where, create }: {
        where: { entityId_financialYear: { entityId: string; financialYear: string } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const k = `${where.entityId_financialYear.entityId}|${where.entityId_financialYear.financialYear}`;
        const row = { id: `psi-${k}`, ...create };
        saved.set(k, row);
        return row;
      },
    },
  },
}));

vi.mock('@/lib/auth/guards', () => ({
  withPermission:
    (_permission: string, handler: (req: unknown, auth: unknown, ctx: unknown) => Promise<Response>) =>
    (request: unknown, ctx: unknown) =>
      handler(request, { userId: TEST_USER, email: 'mon104@test', role: 'USER', emailVerified: true }, ctx),
}));

vi.mock('@/lib/security/auditLog', () => ({ createAuditLog: async () => undefined }));

import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/tax/entity/[entityId]/psi-assessment/route';
import {
  getAvailableTaxYears,
  getCurrentTaxYearConfig,
  getTaxYearConfig,
  isTaxYearConfigured,
  resolveRequestedTaxYear,
} from '@/lib/tax-engine/config/taxYearConfig';

const ENTITY = 'ent-mon104';

const put = (fyParam: string | null, body: Record<string, unknown>) =>
  PUT(
    new NextRequest(`http://localhost/api/tax/entity/${ENTITY}/psi-assessment${fyParam ? `?fy=${fyParam}` : ''}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ entityId: ENTITY }) },
  );

const get = (fyParam: string | null) =>
  GET(
    new NextRequest(`http://localhost/api/tax/entity/${ENTITY}/psi-assessment${fyParam ? `?fy=${fyParam}` : ''}`),
    { params: Promise.resolve({ entityId: ENTITY }) },
  );

beforeEach(() => saved.clear());

describe('MON-104 · resolver contract (the ONE FY producer)', () => {
  it('every configured FY resolves to itself — write key === read key by construction', () => {
    for (const fy of getAvailableTaxYears()) {
      const config = resolveRequestedTaxYear(fy);
      expect(config?.financialYear).toBe(fy);
      expect(isTaxYearConfigured(fy)).toBe(true);
    }
  });

  it('absent fy → the current-FY config (already normalised to a configured year)', () => {
    const config = resolveRequestedTaxYear(null);
    expect(config).not.toBeNull();
    expect(config!.financialYear).toBe(getCurrentTaxYearConfig().financialYear);
    expect(isTaxYearConfigured(config!.financialYear)).toBe(true);
  });

  it('an unconfigured or malformed FY resolves to null — never a silent substitute', () => {
    for (const bad of ['2031-32', '1999-00', 'not-a-year', '2025']) {
      expect(resolveRequestedTaxYear(bad)).toBeNull();
      expect(isTaxYearConfigured(bad)).toBe(false);
    }
  });

  it('the read-path normaliser (getTaxYearConfig fallback) lands on a key the resolver also accepts', () => {
    // The silent read-side fallback goes to the LATEST configured year —
    // which the write side can also reach. No write key can exist that the
    // read side never asks for.
    const fallback = getTaxYearConfig('2031-32');
    expect(isTaxYearConfigured(fallback.financialYear)).toBe(true);
  });
});

describe('MON-104 · round-trip identity through the REAL route handlers', () => {
  const body = { totalPsiIncome: 150_000, incomeFromLargestClient: 135_000, unrelatedClientCount: 1 };

  it('explicit configured FY: PUT persists under the key GET reads back', async () => {
    const fy = getAvailableTaxYears()[0];
    const putRes = await put(fy, body);
    expect(putRes.status).toBe(200);
    const putJson = await putRes.json();
    expect(putJson.data.financialYear).toBe(fy);

    const getRes = await get(fy);
    const getJson = await getRes.json();
    expect(getJson.data.financialYear).toBe(fy);
    expect(getJson.data.assessment).not.toBeNull();
    expect(getJson.data.assessment.totalPsiIncome).toBe(150_000);
  });

  it('default FY: PUT (no fy) and GET (no fy) resolve to the SAME normalised key', async () => {
    const putRes = await put(null, body);
    expect(putRes.status).toBe(200);
    const putJson = await putRes.json();
    // The write landed on the normalised current-FY key…
    expect(putJson.data.financialYear).toBe(getCurrentTaxYearConfig().financialYear);
    // …and the read path asks for exactly that key.
    const getJson = await (await get(null)).json();
    expect(getJson.data.financialYear).toBe(putJson.data.financialYear);
    expect(getJson.data.assessment).not.toBeNull();
  });

  it('unconfigured FY: PUT is 400-rejected and NOTHING is persisted (the orphan is impossible)', async () => {
    const res = await put('2031-32', body);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(String(json.error)).toContain('2031-32');
    expect(saved.size).toBe(0);
  });

  it('unconfigured FY: GET is 400-rejected too — the prefill can never read a key the writer cannot produce', async () => {
    const res = await get('not-a-year');
    expect(res.status).toBe(400);
  });
});

describe('MON-104 · topology — all three capture routes use THE canonical resolver', () => {
  const ROUTES = [
    'app/api/tax/entity/[entityId]/psi-assessment/route.ts',
    'app/api/tax/entity/[entityId]/div152-assessment/route.ts',
    'app/api/tax/entity/[entityId]/smsf-return/route.ts',
  ];

  it.each(ROUTES)('%s resolves FY via resolveRequestedTaxYear and carries no raw fallback', (route) => {
    const src = readFileSync(join(process.cwd(), route), 'utf8');
    expect(src).toContain('resolveRequestedTaxYear(');
    // The pre-fix pattern: persist the raw query value with a current-FY fallback.
    expect(src).not.toMatch(/fy\s*\?\?\s*getCurrentTaxYearConfig\(\)/);
  });
});
