/**
 * Phase 32C PR4d — Conversation messages.
 *
 * GET  /api/conversations/[id]/messages?since=<iso>&markAsRead=true
 *      Returns messages in chronological order. Optional `since` lets the
 *      poll loop fetch only new messages on each tick. `markAsRead=true`
 *      bumps the participant's lastReadAt for unread badge tracking.
 *
 * POST /api/conversations/[id]/messages
 *      Body: { body: string }. Posts an in-app message; auto-mirrors out
 *      via email if the sender is the professional side (consumer→pro
 *      messages skip mirroring — the pro is in-app).
 */
import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  ConversationServiceError,
  listMessages,
  postMessage,
} from '@/lib/services/conversationService';
import { createAuditLog } from '@/lib/security/auditLog';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission<RouteContext>('report.read', async (request, auth, context) => {
  const { id } = await context!.params;
  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get('since');
  const markAsRead = searchParams.get('markAsRead') === 'true';
  const since = sinceParam ? new Date(sinceParam) : undefined;
  if (sinceParam && (!since || isNaN(since.getTime()))) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'since must be a valid ISO date' } },
      { status: 400 },
    );
  }

  try {
    const messages = await listMessages(id, auth.userId, { since, markAsRead });
    return NextResponse.json({ success: true, data: { messages } });
  } catch (err) {
    if (err instanceof ConversationServiceError) {
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status: err.code === 'NOT_FOUND' ? 404 : 403 },
      );
    }
    const message = err instanceof Error ? err.message : 'Failed to load messages';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});

interface PostBody {
  body: string;
  /** Override the default mirror behaviour. */
  mirrorViaEmail?: boolean;
}

export const POST = withPermission<RouteContext>('report.read', async (request, auth, context) => {
  const { id } = await context!.params;
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
      { status: 400 },
    );
  }
  if (!body.body || typeof body.body !== 'string') {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'body required' } },
      { status: 400 },
    );
  }

  try {
    const created = await postMessage({
      conversationId: id,
      senderUserId: auth.userId,
      body: body.body,
      mirrorViaEmail: body.mirrorViaEmail,
    });
    createAuditLog({
      userId: auth.userId,
      action: 'CONVERSATION_MESSAGE_SENT',
      entityType: 'CONVERSATION_MESSAGE',
      entityId: created.id,
      metadata: { conversationId: id, channel: created.channel },
    }).catch(() => {});
    return NextResponse.json({ success: true, data: { message: created } });
  } catch (err) {
    if (err instanceof ConversationServiceError) {
      const status =
        err.code === 'NOT_FOUND' ? 404
          : err.code === 'FORBIDDEN' ? 403
          : err.code === 'CLOSED' ? 409
          : err.code === 'PAYLOAD_TOO_LARGE' ? 413
          : 400;
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : 'Send failed';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});
