/**
 * /api/tax/trust-deed-rules — Phase 44 Part 2b
 *
 * GET  — list the caller's `TrustDeedRule` rows, optionally filtered via
 *        `?trustEntityId=`.
 * POST — record a structured trust-deed rule (the typed promotion of a
 *        `TrustDeedExtractedRules` JSON column).
 *
 * SSOT: thin handler over `trustDeedRuleService` (the only writer).
 * No tax arithmetic (PHASE_44_PART_2 §8.3).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  createTrustDeedRule,
  listTrustDeedRules,
  TrustDeedRuleValidationError,
  type CreateTrustDeedRuleInput,
} from '@/lib/services/trustDeedRuleService';
import type { TrustDeedRuleType } from '@prisma/client';

const VALID_RULE_TYPES: ReadonlySet<TrustDeedRuleType> = new Set<TrustDeedRuleType>([
  'BENEFICIARY_CLASS',
  'DISTRIBUTION_METHOD',
  'DEFAULT_BENEFICIARY',
  'STREAMING_POWER',
  'VESTING_DATE',
  'INCOME_DEFINITION',
  'SUB_TRUST_UPE_CLAUSE',
]);

function statusFor(code: TrustDeedRuleValidationError['code']): number {
  return code === 'RULE_NOT_FOUND' || code === 'ENTITY_NOT_FOUND' ? 404 : 400;
}

export const GET = withPermission('tax_data.read', async (request: NextRequest, auth) => {
  try {
    const url = new URL(request.url);
    const trustEntityId = url.searchParams.get('trustEntityId') ?? undefined;
    const rows = await listTrustDeedRules(auth.userId, { trustEntityId });
    return NextResponse.json({ data: rows, _meta: { count: rows.length } });
  } catch (error) {
    console.error('List trust-deed rules error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list deed rules.';
    return NextResponse.json(
      { error: { code: 'DEED_RULES_LOAD_FAILED', message } },
      { status: 500 },
    );
  }
});

interface CreateBody {
  trustEntityId?: unknown;
  ruleType?: unknown;
  ruleValue?: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
  sourceExtractionId?: unknown;
  extractedConfidence?: unknown;
}

export const POST = withPermission('tax_data.write', async (request: NextRequest, auth) => {
  try {
    const body = (await request.json()) as CreateBody;

    const trustEntityId = typeof body.trustEntityId === 'string' ? body.trustEntityId : '';
    if (!trustEntityId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'trustEntityId is required.' } },
        { status: 400 },
      );
    }
    if (!VALID_RULE_TYPES.has(body.ruleType as TrustDeedRuleType)) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'ruleType is not a valid value.' } },
        { status: 400 },
      );
    }
    if (
      body.ruleValue === null ||
      typeof body.ruleValue !== 'object' ||
      Array.isArray(body.ruleValue)
    ) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'ruleValue must be a non-null JSON object.' } },
        { status: 400 },
      );
    }

    const input: CreateTrustDeedRuleInput = {
      trustEntityId,
      ruleType: body.ruleType as TrustDeedRuleType,
      ruleValue: body.ruleValue as Record<string, unknown>,
      effectiveFrom:
        typeof body.effectiveFrom === 'string' && body.effectiveFrom.length > 0
          ? new Date(body.effectiveFrom)
          : undefined,
      effectiveTo:
        typeof body.effectiveTo === 'string' && body.effectiveTo.length > 0
          ? new Date(body.effectiveTo)
          : null,
      sourceExtractionId:
        typeof body.sourceExtractionId === 'string' ? body.sourceExtractionId : null,
      extractedConfidence:
        typeof body.extractedConfidence === 'number' ? body.extractedConfidence : null,
    };

    const id = await createTrustDeedRule(auth.userId, input, {
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (error) {
    if (error instanceof TrustDeedRuleValidationError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: statusFor(error.code) },
      );
    }
    console.error('Create trust-deed rule error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create deed rule.';
    return NextResponse.json(
      { error: { code: 'DEED_RULE_CREATE_FAILED', message } },
      { status: 500 },
    );
  }
});
