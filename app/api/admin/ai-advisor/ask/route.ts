/**
 * Phase 41h.3 / 41h.4 — AI advisor admin API endpoint.
 *
 * `POST /api/admin/ai-advisor/ask` — admin-only demo surface for
 * exercising the gateway end-to-end. The user-facing equivalent
 * lives at `/api/ai-advisor/ask` (Phase 41h.4); both delegate to
 * the shared `runAdvisorQuery` helper so provider wiring stays in
 * one place.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { runAdvisorQuery } from '@/lib/ai/tax-advisor/runAdvisorQuery';

interface AskRequestBody {
  question: string;
  fyLabel?: string;
}

export async function POST(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      {
        error: {
          code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED,
          message: 'Admin portal is not enabled',
        },
      },
      { status: 503 },
    );
  }

  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  if (!hasPermission(authResult.context.role, 'audit:read')) {
    return NextResponse.json(
      {
        error: {
          code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          message: 'Insufficient permissions',
        },
      },
      { status: 403 },
    );
  }

  let body: AskRequestBody;
  try {
    body = (await request.json()) as AskRequestBody;
  } catch {
    return NextResponse.json(
      {
        error: { code: 'INVALID_REQUEST_BODY', message: 'Request body must be valid JSON.' },
      },
      { status: 400 },
    );
  }

  const outcome = await runAdvisorQuery({
    userId: authResult.context.email,
    question: body.question,
    fyLabel: body.fyLabel,
  });

  switch (outcome.kind) {
    case 'INVALID_INPUT':
      return NextResponse.json(
        {
          error: {
            code: outcome.field === 'question' && outcome.message.includes('required')
              ? 'QUESTION_REQUIRED'
              : 'QUESTION_TOO_LONG',
            message: outcome.message,
          },
        },
        { status: 400 },
      );
    case 'NOT_CONFIGURED':
      return NextResponse.json(
        { error: { code: 'AI_ADVISOR_NOT_CONFIGURED', message: outcome.message } },
        { status: 503 },
      );
    case 'OK':
      return NextResponse.json({
        success: true,
        data: outcome.response,
        meta: { timestamp: new Date().toISOString() },
      });
  }
}
