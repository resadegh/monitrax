/**
 * Phase 41h.4 — User-facing AI advisor API.
 *
 * `POST /api/ai-advisor/ask` — user-facing endpoint. The graduated
 * version of the admin demo route from 41h.3.
 *
 * Auth: `report.read` permission (lightest authenticated touch —
 * surface returns facts, not CDR-protected data; HR-1 + HR-2
 * structurally enforce that the AI never invents either).
 *
 * Behaviour mirrors the admin route — both delegate to
 * `runAdvisorQuery`. Only the auth surface differs.
 *
 * **HR-3 alignment**: this is a user-facing surface, but the AI's
 * outputs are bounded by HR-1/HR-2/D-2 (no fabricated numbers /
 * citations / recommendations). Calc errors that escape past those
 * boundaries are caught silently by the calc-audit system in 41i.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { runAdvisorQuery } from '@/lib/ai/tax-advisor/runAdvisorQuery';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

interface AskRequestBody {
  question: string;
  fyLabel?: string;
}

export const POST = withPermission('report.read', async (request: NextRequest, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_CFO', auth.userId);
    if (gateBlocked) return gateBlocked;
  let body: AskRequestBody;
  try {
    body = (await request.json()) as AskRequestBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INVALID_REQUEST_BODY', message: 'Request body must be valid JSON.' },
      },
      { status: 400 },
    );
  }

  const outcome = await runAdvisorQuery({
    userId: auth.userId,
    question: body.question,
    fyLabel: body.fyLabel,
  });

  switch (outcome.kind) {
    case 'INVALID_INPUT':
      return NextResponse.json(
        {
          success: false,
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
        {
          success: false,
          error: { code: 'AI_ADVISOR_NOT_CONFIGURED', message: outcome.message },
        },
        { status: 503 },
      );
    case 'OK':
      return NextResponse.json({
        success: true,
        data: outcome.response,
        meta: { timestamp: new Date().toISOString() },
      });
  }
});
