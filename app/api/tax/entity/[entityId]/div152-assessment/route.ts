/**
 * /api/tax/entity/[entityId]/div152-assessment — persist & read the entity's
 * Div 152 small-business CGT concession self-assessment facts (MON-103,
 * capture Stage 3).
 *
 * These are the inputs to the wired `applyDiv152` overlay (ITAA 1997
 * Div 152 — MON-099). `assembleDiv152Input` reads the persisted row and
 * feeds `input.div152ByEntity` on the entity-tax GET path — but ONLY when
 * the four numerics (gainAfterDiv115, maxNetAssetValue, aggregatedTurnover,
 * monthsHeld) AND the two eligibility answers (isActiveAsset,
 * isRetirementOrIncapacity) are all explicitly set (the all-or-nothing
 * gate, Reza standing GO 2026-07-27). For those two booleans NEITHER
 * default is safe — false denies real concessions on display, true
 * fabricates them — so "Not sure" keeps the overlay inert. Electing the
 * retirement exemption additionally REQUIRES retirementExemptionUsedToDate
 * (a blank can never assume $0 of the $500k lifetime cap already used).
 *
 *   GET — return the saved assessment for ?fy= (or current FY) to prefill.
 *   PUT — upsert the assessment for the entity + FY (ownership-guarded;
 *         any LegalEntity type the caller owns — Div 152 can apply through
 *         a company, trust, partnership, or sole trader).
 *
 * §13.3: no financial values in audit metadata. §12.11: the upsert is
 * keyed by (entityId, financialYear) on an entity verified to be the
 * caller's own; this route is the exclusive writer of `div152_assessments`.
 * Stitch design: project 1859462351962811110, screen
 * 8ff4092f751544688de33f8574c1232b (§18.8 9.2/10).
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

    const assessment = await prisma.div152Assessment.findUnique({
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
      gainAfterDiv115: numOrNull(body.gainAfterDiv115),
      maxNetAssetValue: numOrNull(body.maxNetAssetValue),
      aggregatedTurnover: numOrNull(body.aggregatedTurnover),
      monthsHeld: intOrNull(body.monthsHeld),
      isActiveAsset: boolOrNull(body.isActiveAsset),
      isRetirementOrIncapacity: boolOrNull(body.isRetirementOrIncapacity),
      electActiveAssetReduction: boolOrNull(body.electActiveAssetReduction),
      electRetirementExemption: boolOrNull(body.electRetirementExemption),
      electRollover: boolOrNull(body.electRollover),
      retirementExemptionUsedToDate: numOrNull(body.retirementExemptionUsedToDate),
    };

    // §12.11: keyed by (entityId, financialYear) on the caller's own verified
    // entity; this route is the exclusive writer of this row.
    const saved = await prisma.div152Assessment.upsert({
      where: { entityId_financialYear: { entityId, financialYear } },
      create: { userId: auth.userId, entityId, financialYear, ...data },
      update: data,
    });

    // Audit — no financial values in metadata (§13.3).
    void createAuditLog({
      userId: auth.userId,
      action: 'DIV152_ASSESSMENT_SAVED',
      status: 'SUCCESS',
      entityType: 'Div152Assessment',
      entityId: saved.id,
      metadata: sanitizeCdrMetadata({ legalEntityId: entityId, financialYear }),
    });

    return NextResponse.json({ success: true, data: { financialYear, assessment: saved } });
  },
);
