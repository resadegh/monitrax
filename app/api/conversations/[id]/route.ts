/**
 * Phase 32C PR4d — Single conversation operations.
 *
 * GET    /api/conversations/[id]  — conversation details (participants, request linkage, org)
 * POST   /api/conversations/[id]  — actions: { action: 'softDelete' | 'close' }
 *
 * Both consumer and professional sides hit this endpoint; participant check
 * runs in `assertParticipant` at the service layer.
 */
import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  closeConversation,
  ConversationServiceError,
  getConversationDetails,
  softDeleteFromUserView,
} from '@/lib/services/conversationService';
import { createAuditLog } from '@/lib/security/auditLog';

type RouteContext = { params: Promise<{ id: string }> };

interface ActionBody {
  action: 'softDelete' | 'close';
}

export const GET = withPermission<RouteContext>('report.read', async (_request, auth, context) => {
  const { id } = await context!.params;
  try {
    const conversation = await getConversationDetails(id, auth.userId);
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: { conversation } });
  } catch (err) {
    if (err instanceof ConversationServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.code === 'NOT_FOUND' ? 404 : 403 },
      );
    }
    const message = err instanceof Error ? err.message : 'Failed to load conversation';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});

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

  try {
    if (body.action === 'softDelete') {
      await softDeleteFromUserView(id, auth.userId);
      createAuditLog({
        userId: auth.userId,
        action: 'CONVERSATION_SOFT_DELETED_FROM_USER',
        entityType: 'PROFESSIONAL_CONVERSATION',
        entityId: id,
      }).catch(() => {});
      return NextResponse.json({ success: true });
    }
    if (body.action === 'close') {
      const updated = await closeConversation(id, auth.userId);
      return NextResponse.json({ success: true, data: { conversation: updated } });
    }
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'action must be softDelete or close' } },
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof ConversationServiceError) {
      const status =
        err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : 'Action failed';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});
