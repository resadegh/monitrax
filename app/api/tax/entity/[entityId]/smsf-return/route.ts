/**
 * /api/tax/entity/[entityId]/smsf-return — persist & read the SMSF's
 * declared annual fund-tax figures (Phase 44.2).
 *
 * These are the inputs to `calculateSmsfIncomeTax` (Div 295 / ECPI / NALI).
 * `assembleEntityTaxFacts` reads the persisted row so the GET entity-tax
 * path returns a real number instead of UNCOMPUTED. They are an ESTIMATE
 * input, never tax advice — the entity tax view surfaces the canonical
 * boundary footnote alongside the result.
 *
 *   GET — return the saved figures for ?fy= (or current FY) to prefill.
 *   PUT — upsert the figures for the entity + FY (ownership-guarded;
 *         the entity must be a LegalEntity(type=SMSF) owned by the caller).
 *
 * §13.3: no financial values in audit metadata. §12.11: the upsert is keyed
 * by (legalEntityId, financialYear) on an entity verified to be the caller's
 * own SMSF — this route is the exclusive writer of `smsf_annual_returns`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getAvailableTaxYears, resolveRequestedTaxYear } from '@/lib/tax-engine/config/taxYearConfig';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';

type RouteContext = { params: Promise<{ entityId: string }> };

/**
 * MON-104 — FY resolves through THE canonical resolver (the same normaliser
 * the read path uses), and an unresolvable FY is REJECTED at the boundary
 * rather than persisted as an orphaned, permanently-invisible row.
 */
function resolveFy(request: NextRequest): { financialYear: string } | { reject: NextResponse } {
  const requested = new URL(request.url).searchParams.get('fy');
  const config = resolveRequestedTaxYear(requested);
  if (!config) {
    return {
      reject: NextResponse.json(
        {
          success: false,
          error: `"${requested}" is not a configured financial year, so nothing was saved. Configured years: ${getAvailableTaxYears().join(', ')} (omit fy for the current year).`,
        },
        { status: 400 },
      ),
    };
  }
  return { financialYear: config.financialYear };
}

// Verify the entity is a LegalEntity(type=SMSF) owned by the caller.
async function verifyOwnedSmsf(entityId: string, userId: string) {
  return prisma.legalEntity.findFirst({
    where: { id: entityId, userId, type: 'SMSF' },
    select: { id: true },
  });
}

export const GET = withPermission<RouteContext>(
  'tax_data.read',
  async (request, auth, context) => {
    const { entityId } = await context!.params;
    const fy = resolveFy(request);
    if ('reject' in fy) return fy.reject;
    const { financialYear } = fy;

    const smsf = await verifyOwnedSmsf(entityId, auth.userId);
    if (!smsf) {
      return NextResponse.json(
        { success: false, error: 'SMSF entity not found.' },
        { status: 404 },
      );
    }

    const ret = await prisma.smsfAnnualReturn.findUnique({
      where: { legalEntityId_financialYear: { legalEntityId: entityId, financialYear } },
    });

    return NextResponse.json({ success: true, data: { financialYear, return: ret } });
  },
);

export const PUT = withPermission<RouteContext>(
  'tax_data.write',
  async (request, auth, context) => {
    const { entityId } = await context!.params;
    const fy = resolveFy(request);
    if ('reject' in fy) return fy.reject;
    const { financialYear } = fy;

    const smsf = await verifyOwnedSmsf(entityId, auth.userId);
    if (!smsf) {
      return NextResponse.json(
        { success: false, error: 'SMSF entity not found.' },
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

    // Validate + coerce. Money fields = non-negative numbers; flags = boolean;
    // ecpiExemptProportion optional 0..1 (clamped) or null.
    const num = (v: unknown): number => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    const ecpiRaw = body.ecpiExemptProportion;
    const ecpiExemptProportion =
      ecpiRaw === null || ecpiRaw === undefined || ecpiRaw === ''
        ? null
        : Math.max(0, Math.min(1, Number(ecpiRaw)));
    if (ecpiExemptProportion !== null && !Number.isFinite(ecpiExemptProportion)) {
      return NextResponse.json(
        { success: false, error: 'ecpiExemptProportion must be between 0 and 1.' },
        { status: 400 },
      );
    }

    const data = {
      assessableInvestmentIncome: num(body.assessableInvestmentIncome),
      deductions: num(body.deductions),
      assessableContributions: num(body.assessableContributions),
      nonArmsLengthIncome: num(body.nonArmsLengthIncome),
      frankingCredits: num(body.frankingCredits),
      isComplying: body.isComplying !== false, // default complying
      isInPensionPhase: body.isInPensionPhase === true,
      ecpiExemptProportion,
    };

    // §12.11: keyed by (legalEntityId, financialYear) on the caller's own
    // verified SMSF; this route is the exclusive writer of this row.
    const saved = await prisma.smsfAnnualReturn.upsert({
      where: { legalEntityId_financialYear: { legalEntityId: entityId, financialYear } },
      create: { userId: auth.userId, legalEntityId: entityId, financialYear, ...data },
      update: data,
    });

    // Audit — no financial values in metadata (§13.3).
    void createAuditLog({
      userId: auth.userId,
      action: 'SMSF_RETURN_SAVED',
      status: 'SUCCESS',
      entityType: 'SmsfAnnualReturn',
      entityId: saved.id,
      metadata: sanitizeCdrMetadata({ legalEntityId: entityId, financialYear }),
    });

    return NextResponse.json({ success: true, data: { financialYear, return: saved } });
  },
);
