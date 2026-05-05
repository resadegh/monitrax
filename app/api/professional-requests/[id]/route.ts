/**
 * Phase 32C PR4c — D2C-side request detail / withdraw.
 *
 * POST /api/professional-requests/[id]    — actions: { action: 'withdraw' }
 *
 * Withdraw is the only D2C-controlled lifecycle transition. Accept and
 * decline live on the portal-side endpoint (only org members can fire those).
 */
import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  withdrawRequest,
  ProfessionalRequestServiceError,
} from '@/lib/services/professionalRequestService';
import { createAuditLog } from '@/lib/security/auditLog';

type RouteContext = { params: Promise<{ id: string }> };

interface ActionBody {
  action: 'withdraw';
}

export const POST = withPermission<RouteContext>('report.read', async (request, auth, context) => {
  const { id } = await context!.params;
  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
      { status: 400 },
    );
  }
  if (body.action !== 'withdraw') {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Only withdraw is supported here' } },
      { status: 400 },
    );
  }

  try {
    const updated = await withdrawRequest(id, auth.userId);
    createAuditLog({
      userId: auth.userId,
      action: 'PROFESSIONAL_REQUEST_WITHDRAWN',
      entityType: 'PROFESSIONAL_REQUEST',
      entityId: id,
    }).catch(() => {});
    return NextResponse.json({ success: true, data: { request: updated } });
  } catch (err) {
    if (err instanceof ProfessionalRequestServiceError) {
      const status =
        err.code === 'NOT_FOUND'
          ? 404
          : err.code === 'FORBIDDEN'
            ? 403
            : 400;
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : 'Withdraw failed';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});
