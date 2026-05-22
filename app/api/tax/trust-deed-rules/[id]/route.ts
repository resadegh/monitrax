/**
 * /api/tax/trust-deed-rules/[id] — Phase 44 Part 2b
 *
 * PATCH  — end a deed rule by setting `effectiveTo` (the deed was varied
 *          / superseded). The row is retained for history.
 * DELETE — hard-delete a deed rule (a mistaken entry).
 *
 * SSOT: thin handler over `trustDeedRuleService`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  endTrustDeedRule,
  deleteTrustDeedRule,
  TrustDeedRuleValidationError,
} from '@/lib/services/trustDeedRuleService';

type RouteContext = { params: Promise<{ id: string }> };

function statusFor(code: TrustDeedRuleValidationError['code']): number {
  return code === 'RULE_NOT_FOUND' || code === 'ENTITY_NOT_FOUND' ? 404 : 400;
}

export const PATCH = withPermission<RouteContext>(
  'tax_data.write',
  async (request: NextRequest, auth, context) => {
    const { id } = await context!.params;
    try {
      const body = (await request.json()) as { effectiveTo?: unknown };
      const raw = body.effectiveTo;
      const effectiveTo =
        typeof raw === 'string' && raw.length > 0 ? new Date(raw) : new Date();
      if (Number.isNaN(effectiveTo.getTime())) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'effectiveTo is not a valid date.' } },
          { status: 400 },
        );
      }
      await endTrustDeedRule(auth.userId, id, effectiveTo, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, effectiveTo: effectiveTo.toISOString() } });
    } catch (error) {
      if (error instanceof TrustDeedRuleValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusFor(error.code) },
        );
      }
      console.error('End trust-deed rule error:', error);
      const message = error instanceof Error ? error.message : 'Failed to end deed rule.';
      return NextResponse.json(
        { error: { code: 'DEED_RULE_END_FAILED', message } },
        { status: 500 },
      );
    }
  },
);

export const DELETE = withPermission<RouteContext>(
  'tax_data.write',
  async (request: NextRequest, auth, context) => {
    const { id } = await context!.params;
    try {
      await deleteTrustDeedRule(auth.userId, id, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, deleted: true } });
    } catch (error) {
      if (error instanceof TrustDeedRuleValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: statusFor(error.code) },
        );
      }
      console.error('Delete trust-deed rule error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete deed rule.';
      return NextResponse.json(
        { error: { code: 'DEED_RULE_DELETE_FAILED', message } },
        { status: 500 },
      );
    }
  },
);
