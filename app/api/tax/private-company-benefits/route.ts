/**
 * /api/tax/private-company-benefits — Phase 44 Part 2b
 *
 * GET  — list the caller's `PrivateCompanyBenefit` rows, optionally
 *        filtered via `?companyEntityId=&financialYear=`.
 * POST — record a Div 7A benefit (loan / payment / forgiveness / UPE /
 *        sub-trust) from a private company to a shareholder / associate.
 *
 * SSOT: thin handler over `privateCompanyBenefitService` (the only
 * writer). No tax arithmetic (PHASE_44_PART_2 §8.3) — the engine
 * computes the LOAN limb; the others return UNCOMPUTED (§7.1).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  createPrivateCompanyBenefit,
  listPrivateCompanyBenefits,
  PrivateCompanyBenefitValidationError,
  type CreatePrivateCompanyBenefitInput,
} from '@/lib/services/privateCompanyBenefitService';
import type { PrivateCompanyBenefitType } from '@prisma/client';

const VALID_BENEFIT_TYPES: ReadonlySet<PrivateCompanyBenefitType> =
  new Set<PrivateCompanyBenefitType>([
    'LOAN',
    'PAYMENT',
    'DEBT_FORGIVENESS',
    'UPE',
    'SUB_TRUST_ARRANGEMENT',
  ]);

function statusFor(code: PrivateCompanyBenefitValidationError['code']): number {
  return code === 'BENEFIT_NOT_FOUND' || code === 'ENTITY_NOT_FOUND' ? 404 : 400;
}

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

export const GET = withPermission('tax_data.read', async (request: NextRequest, auth) => {
  try {
    const url = new URL(request.url);
    const companyEntityId = url.searchParams.get('companyEntityId') ?? undefined;
    const financialYear = url.searchParams.get('financialYear') ?? undefined;
    const rows = await listPrivateCompanyBenefits(auth.userId, {
      companyEntityId,
      financialYear,
    });
    return NextResponse.json({ data: rows, _meta: { count: rows.length } });
  } catch (error) {
    console.error('List private-company benefits error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list benefits.';
    return NextResponse.json(
      { error: { code: 'BENEFITS_LOAD_FAILED', message } },
      { status: 500 },
    );
  }
});

interface CreateBody {
  companyEntityId?: unknown;
  recipientEntityId?: unknown;
  financialYear?: unknown;
  benefitType?: unknown;
  amount?: unknown;
  openingBalance?: unknown;
  loanTermYears?: unknown;
  benchmarkRate?: unknown;
  repaymentsThisFy?: unknown;
  hasComplianceAgreement?: unknown;
  isSubTrustUpe?: unknown;
}

export const POST = withPermission('tax_data.write', async (request: NextRequest, auth) => {
  try {
    const body = (await request.json()) as CreateBody;

    const companyEntityId =
      typeof body.companyEntityId === 'string' ? body.companyEntityId : '';
    const recipientEntityId =
      typeof body.recipientEntityId === 'string' ? body.recipientEntityId : '';
    const financialYear = typeof body.financialYear === 'string' ? body.financialYear : '';
    if (!companyEntityId || !recipientEntityId || !financialYear) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'companyEntityId, recipientEntityId and financialYear are required.',
          },
        },
        { status: 400 },
      );
    }
    if (!VALID_BENEFIT_TYPES.has(body.benefitType as PrivateCompanyBenefitType)) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'benefitType is not a valid value.' } },
        { status: 400 },
      );
    }
    if (typeof body.amount !== 'number') {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'amount (number) is required.' } },
        { status: 400 },
      );
    }

    const input: CreatePrivateCompanyBenefitInput = {
      companyEntityId,
      recipientEntityId,
      financialYear,
      benefitType: body.benefitType as PrivateCompanyBenefitType,
      amount: body.amount,
      openingBalance: num(body.openingBalance),
      loanTermYears: typeof body.loanTermYears === 'number' ? body.loanTermYears : null,
      benchmarkRate: num(body.benchmarkRate),
      repaymentsThisFy: num(body.repaymentsThisFy),
      hasComplianceAgreement:
        typeof body.hasComplianceAgreement === 'boolean' ? body.hasComplianceAgreement : false,
      isSubTrustUpe: typeof body.isSubTrustUpe === 'boolean' ? body.isSubTrustUpe : false,
    };

    const result = await createPrivateCompanyBenefit(auth.userId, input, {
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof PrivateCompanyBenefitValidationError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: statusFor(error.code) },
      );
    }
    console.error('Create private-company benefit error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create benefit.';
    return NextResponse.json(
      { error: { code: 'BENEFIT_CREATE_FAILED', message } },
      { status: 500 },
    );
  }
});
