/**
 * /api/tax/distribution-resolutions — Phase 44 Part 2b
 *
 * GET  — list the caller's `DistributionResolution` rows, optionally
 *        filtered via `?trustEntityId=&financialYear=`.
 * POST — create a trust's per-FY distribution resolution + allocations.
 *
 * SSOT: thin handler. All writes go through
 * `lib/services/distributionResolutionService.ts` — the only writer.
 * No tax arithmetic (PHASE_44_PART_2 §8.3).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  createDistributionResolution,
  listDistributionResolutions,
  DistributionResolutionValidationError,
  type CreateDistributionResolutionInput,
  type DistributionAllocationInput,
} from '@/lib/services/distributionResolutionService';

function statusFor(code: DistributionResolutionValidationError['code']): number {
  switch (code) {
    case 'ENTITY_NOT_FOUND':
    case 'RESOLUTION_NOT_FOUND':
      return 404;
    default:
      return 400;
  }
}

export const GET = withPermission('tax_data.read', async (request: NextRequest, auth) => {
  try {
    const url = new URL(request.url);
    const trustEntityId = url.searchParams.get('trustEntityId') ?? undefined;
    const financialYear = url.searchParams.get('financialYear') ?? undefined;
    const rows = await listDistributionResolutions(auth.userId, {
      trustEntityId,
      financialYear,
    });
    return NextResponse.json({ data: rows, _meta: { count: rows.length } });
  } catch (error) {
    console.error('List distribution resolutions error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list resolutions.';
    return NextResponse.json(
      { error: { code: 'RESOLUTIONS_LOAD_FAILED', message } },
      { status: 500 },
    );
  }
});

interface CreateBody {
  trustEntityId?: unknown;
  financialYear?: unknown;
  trustNetIncome?: unknown;
  distributableIncome?: unknown;
  resolutionDate?: unknown;
  frankedDividendPool?: unknown;
  capitalGainPool?: unknown;
  hasFamilyTrustElection?: unknown;
  sourceDocumentId?: unknown;
  allocations?: unknown;
}

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

export const POST = withPermission('tax_data.write', async (request: NextRequest, auth) => {
  try {
    const body = (await request.json()) as CreateBody;

    const trustEntityId = typeof body.trustEntityId === 'string' ? body.trustEntityId : '';
    const financialYear = typeof body.financialYear === 'string' ? body.financialYear : '';
    if (!trustEntityId || !financialYear) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'trustEntityId and financialYear are required.' } },
        { status: 400 },
      );
    }
    if (typeof body.trustNetIncome !== 'number') {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'trustNetIncome (number) is required.' } },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.allocations) || body.allocations.length === 0) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'At least one allocation is required.' } },
        { status: 400 },
      );
    }

    const allocations: DistributionAllocationInput[] = [];
    for (const raw of body.allocations as Record<string, unknown>[]) {
      if (
        !raw ||
        typeof raw.beneficiaryEntityId !== 'string' ||
        typeof raw.presentlyEntitledShare !== 'number'
      ) {
        return NextResponse.json(
          {
            error: {
              code: 'BAD_REQUEST',
              message:
                'Each allocation needs beneficiaryEntityId (string) and presentlyEntitledShare (number).',
            },
          },
          { status: 400 },
        );
      }
      // MON-101 — FTE/IEE beneficiary facts. Only the four known enum
      // values are accepted; anything else (incl. absent) stays null =
      // never-asked. Booleans accepted as-is; null/absent = "Not sure".
      const relationship =
        raw.relationship === 'TEST_INDIVIDUAL' ||
        raw.relationship === 'FAMILY_MEMBER' ||
        raw.relationship === 'CONTROLLED_ENTITY' ||
        raw.relationship === 'OUTSIDE_FAMILY'
          ? raw.relationship
          : null;
      allocations.push({
        beneficiaryEntityId: raw.beneficiaryEntityId,
        presentlyEntitledShare: raw.presentlyEntitledShare,
        streamedFrankedDividends: num(raw.streamedFrankedDividends),
        streamedCapitalGains: num(raw.streamedCapitalGains),
        notes: typeof raw.notes === 'string' ? raw.notes : null,
        relationship,
        hasQuotedTfn: typeof raw.hasQuotedTfn === 'boolean' ? raw.hasQuotedTfn : null,
        coveredByIee: typeof raw.coveredByIee === 'boolean' ? raw.coveredByIee : null,
      });
    }

    const input: CreateDistributionResolutionInput = {
      trustEntityId,
      financialYear,
      trustNetIncome: body.trustNetIncome,
      distributableIncome: num(body.distributableIncome),
      resolutionDate:
        typeof body.resolutionDate === 'string' && body.resolutionDate.length > 0
          ? new Date(body.resolutionDate)
          : null,
      frankedDividendPool: num(body.frankedDividendPool),
      capitalGainPool: num(body.capitalGainPool),
      hasFamilyTrustElection:
        typeof body.hasFamilyTrustElection === 'boolean' ? body.hasFamilyTrustElection : false,
      sourceDocumentId:
        typeof body.sourceDocumentId === 'string' ? body.sourceDocumentId : null,
      allocations,
    };

    const result = await createDistributionResolution(auth.userId, input, {
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof DistributionResolutionValidationError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: statusFor(error.code) },
      );
    }
    console.error('Create distribution resolution error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create resolution.';
    return NextResponse.json(
      { error: { code: 'RESOLUTION_CREATE_FAILED', message } },
      { status: 500 },
    );
  }
});
