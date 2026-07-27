/**
 * /api/tax/entity/[entityId]/psi-assessment — persist & read the entity's
 * PSI self-assessment facts (MON-102, capture Stage 2).
 *
 * These are the inputs to the wired `classifyPsi` overlay (ITAA 1997
 * Part 2-42 — MON-097). `assemblePsiInput` reads the persisted row and
 * feeds `input.psiByEntity` on the entity-tax GET path — but ONLY when
 * the three numerics (totalPsiIncome, incomeFromLargestClient,
 * unrelatedClientCount) are all set (the all-or-nothing numerics gate,
 * Reza GO 2026-07-27). Unanswered test booleans persist as null and pass
 * through as not-established — the engine's own contract and the ATO's
 * posture (a PSB test must be positively demonstrable), which can only
 * move the result toward MORE attribution, never hide one.
 *
 *   GET — return the saved assessment for ?fy= (or current FY) to prefill.
 *   PUT — upsert the assessment for the entity + FY (ownership-guarded;
 *         any LegalEntity type the caller owns — PSI can flow through a
 *         company, trust, partnership, or sole trader).
 *
 * §13.3: no financial values in audit metadata. §12.11: the upsert is
 * keyed by (entityId, financialYear) on an entity verified to be the
 * caller's own; this route is the exclusive writer of `psi_assessments`.
 * Stitch design: project 1859462351962811110, screen
 * 73a1f75151a24eadb9dd179cd307d533 (§18.8 9.1/10, Reza-approved).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';

type RouteContext = { params: Promise<{ entityId: string }> };

function resolveFy(request: NextRequest): string {
  const fy = new URL(request.url).searchParams.get('fy');
  return fy ?? getCurrentTaxYearConfig().financialYear;
}

async function verifyOwnedEntity(entityId: string, userId: string) {
  return prisma.legalEntity.findFirst({
    where: { id: entityId, userId },
    select: { id: true },
  });
}

/** null-preserving coercions: null/absent = never-asked, NEVER defaulted. */
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const intOrNull = (v: unknown): number | null => {
  const n = numOrNull(v);
  return n === null ? null : Math.floor(n);
};
const boolOrNull = (v: unknown): boolean | null =>
  typeof v === 'boolean' ? v : null;

export const GET = withPermission<RouteContext>(
  'tax_data.read',
  async (request, auth, context) => {
    const { entityId } = await context!.params;
    const financialYear = resolveFy(request);

    const entity = await verifyOwnedEntity(entityId, auth.userId);
    if (!entity) {
      return NextResponse.json(
        { success: false, error: 'Entity not found.' },
        { status: 404 },
      );
    }

    const assessment = await prisma.psiAssessment.findUnique({
      where: { entityId_financialYear: { entityId, financialYear } },
    });

    return NextResponse.json({ success: true, data: { financialYear, assessment } });
  },
);

export const PUT = withPermission<RouteContext>(
  'tax_data.write',
  async (request, auth, context) => {
    const { entityId } = await context!.params;
    const financialYear = resolveFy(request);

    const entity = await verifyOwnedEntity(entityId, auth.userId);
    if (!entity) {
      return NextResponse.json(
        { success: false, error: 'Entity not found.' },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid request body.' },
        { status: 400 },
      );
    }

    const data = {
      totalPsiIncome: numOrNull(body.totalPsiIncome),
      incomeFromLargestClient: numOrNull(body.incomeFromLargestClient),
      unrelatedClientCount: intOrNull(body.unrelatedClientCount),
      gainedClientsViaDirectAdvertising: boolOrNull(body.gainedClientsViaDirectAdvertising),
      meetsResultsTest: boolOrNull(body.meetsResultsTest),
      meetsEmploymentTest: boolOrNull(body.meetsEmploymentTest),
      meetsBusinessPremisesTest: boolOrNull(body.meetsBusinessPremisesTest),
      hasPsbDetermination: boolOrNull(body.hasPsbDetermination),
    };

    // §12.11: keyed by (entityId, financialYear) on the caller's own verified
    // entity; this route is the exclusive writer of this row.
    const saved = await prisma.psiAssessment.upsert({
      where: { entityId_financialYear: { entityId, financialYear } },
      create: { userId: auth.userId, entityId, financialYear, ...data },
      update: data,
    });

    // Audit — no financial values in metadata (§13.3).
    void createAuditLog({
      userId: auth.userId,
      action: 'PSI_ASSESSMENT_SAVED',
      status: 'SUCCESS',
      entityType: 'PsiAssessment',
      entityId: saved.id,
      metadata: sanitizeCdrMetadata({ legalEntityId: entityId, financialYear }),
    });

    return NextResponse.json({ success: true, data: { financialYear, assessment: saved } });
  },
);
