/**
 * Phase 41h.3 — AI advisor admin API endpoint.
 *
 * `POST /api/admin/ai-advisor/ask` — runs a single AI advisor query
 * through the gateway and returns the typed `GatewayResponse`.
 *
 * **Admin-only for now** (gated by `audit:read` permission).
 * Once 41h.4 (Ask-a-Pro routing) and 41h.5 (tool registry expansion)
 * land + we have production confidence, this graduates to a
 * user-facing endpoint at `/api/ai-advisor/ask`.
 *
 * **Provider selection:**
 *   - If `GEMINI_API_KEY` is configured → uses `GeminiProvider`
 *   - Otherwise → returns 503 with a clear "AI advisor not
 *     configured" message
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import {
  createTaxAdvisorGateway,
  GeminiProvider,
  ProductionAuditSink,
  ProviderError,
} from '@/lib/ai/tax-advisor';

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

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      {
        error: {
          code: 'AI_ADVISOR_NOT_CONFIGURED',
          message:
            'AI advisor is not configured: GEMINI_API_KEY is not set. The advisor surface will become available once the API key is wired in production.',
        },
      },
      { status: 503 },
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

  const question = (body.question ?? '').toString().trim();
  if (!question) {
    return NextResponse.json(
      {
        error: { code: 'QUESTION_REQUIRED', message: 'A `question` field is required.' },
      },
      { status: 400 },
    );
  }
  if (question.length > 2_000) {
    return NextResponse.json(
      {
        error: {
          code: 'QUESTION_TOO_LONG',
          message: 'Question must be 2,000 characters or fewer.',
        },
      },
      { status: 400 },
    );
  }

  let provider: GeminiProvider;
  try {
    provider = new GeminiProvider();
  } catch (err) {
    if (err instanceof ProviderError) {
      return NextResponse.json(
        {
          error: { code: 'AI_ADVISOR_NOT_CONFIGURED', message: err.message },
        },
        { status: 503 },
      );
    }
    throw err;
  }

  const gateway = createTaxAdvisorGateway({
    provider,
    auditSink: new ProductionAuditSink(),
  });

  const response = await gateway.ask({
    userId: authResult.context.email,
    question,
    fyLabel: body.fyLabel,
  });

  return NextResponse.json({
    success: true,
    data: response,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}
