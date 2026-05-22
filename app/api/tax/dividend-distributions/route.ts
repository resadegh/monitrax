/**
 * /api/tax/dividend-distributions — Phase 44 Part 2b
 *
 * GET  — list the caller's `DividendDistribution` rows, optionally
 *        filtered via `?companyEntityId=&financialYear=`.
 * POST — create an actual company dividend + its per-shareholder payments.
 *
 * SSOT: thin handler over `dividendDistributionService` (the only
 * writer). No tax arithmetic (PHASE_44_PART_2 §8.3).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  createDividendDistribution,
  listDividendDistributions,
  DividendDistributionValidationError,
  type CreateDividendDistributionInput,
  type DividendPaymentInput,
} from '@/lib/services/dividendDistributionService';

function statusFor(code: DividendDistributionValidationError['code']): number {
  return code === 'DIVIDEND_NOT_FOUND' || code === 'ENTITY_NOT_FOUND' ? 404 : 400;
}

export const GET = withPermission('tax_data.read', async (request: NextRequest, auth) => {
  try {
    const url = new URL(request.url);
    const companyEntityId = url.searchParams.get('companyEntityId') ?? undefined;
    const financialYear = url.searchParams.get('financialYear') ?? undefined;
    const rows = await listDividendDistributions(auth.userId, {
      companyEntityId,
      financialYear,
    });
    return NextResponse.json({ data: rows, _meta: { count: rows.length } });
  } catch (error) {
    console.error('List dividend distributions error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list dividends.';
    return NextResponse.json(
      { error: { code: 'DIVIDENDS_LOAD_FAILED', message } },
      { status: 500 },
    );
  }
});

interface CreateBody {
  companyEntityId?: unknown;
  financialYear?: unknown;
  declaredDate?: unknown;
  paymentDate?: unknown;
  totalAmount?: unknown;
  frankingPercentage?: unknown;
  frankingCreditsTotal?: unknown;
  payments?: unknown;
}

export const POST = withPermission('tax_data.write', async (request: NextRequest, auth) => {
  try {
    const body = (await request.json()) as CreateBody;

    const companyEntityId =
      typeof body.companyEntityId === 'string' ? body.companyEntityId : '';
    const financialYear = typeof body.financialYear === 'string' ? body.financialYear : '';
    if (!companyEntityId || !financialYear) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'companyEntityId and financialYear are required.' } },
        { status: 400 },
      );
    }
    if (
      typeof body.totalAmount !== 'number' ||
      typeof body.frankingPercentage !== 'number' ||
      typeof body.frankingCreditsTotal !== 'number'
    ) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'totalAmount, frankingPercentage and frankingCreditsTotal (numbers) are required.',
          },
        },
        { status: 400 },
      );
    }
    if (typeof body.declaredDate !== 'string' || body.declaredDate.length === 0) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'declaredDate (ISO date) is required.' } },
        { status: 400 },
      );
    }
    const declaredDate = new Date(body.declaredDate);
    if (Number.isNaN(declaredDate.getTime())) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'declaredDate is not a valid date.' } },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.payments) || body.payments.length === 0) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'At least one shareholder payment is required.' } },
        { status: 400 },
      );
    }

    const payments: DividendPaymentInput[] = [];
    for (const raw of body.payments as Record<string, unknown>[]) {
      if (
        !raw ||
        typeof raw.shareholderEntityId !== 'string' ||
        typeof raw.amount !== 'number' ||
        typeof raw.frankingCredits !== 'number'
      ) {
        return NextResponse.json(
          {
            error: {
              code: 'BAD_REQUEST',
              message:
                'Each payment needs shareholderEntityId (string), amount (number) and frankingCredits (number).',
            },
          },
          { status: 400 },
        );
      }
      payments.push({
        shareholderEntityId: raw.shareholderEntityId,
        amount: raw.amount,
        frankingCredits: raw.frankingCredits,
      });
    }

    const input: CreateDividendDistributionInput = {
      companyEntityId,
      financialYear,
      declaredDate,
      paymentDate:
        typeof body.paymentDate === 'string' && body.paymentDate.length > 0
          ? new Date(body.paymentDate)
          : null,
      totalAmount: body.totalAmount,
      frankingPercentage: body.frankingPercentage,
      frankingCreditsTotal: body.frankingCreditsTotal,
      payments,
    };

    const result = await createDividendDistribution(auth.userId, input, {
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof DividendDistributionValidationError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: statusFor(error.code) },
      );
    }
    console.error('Create dividend distribution error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create dividend.';
    return NextResponse.json(
      { error: { code: 'DIVIDEND_CREATE_FAILED', message } },
      { status: 500 },
    );
  }
});
