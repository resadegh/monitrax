/**
 * Phase 32C PR4d — User-side conversation list + ensure-org-scoped.
 *
 * GET  /api/conversations         — list conversations the caller participates in (CONSUMER role)
 * POST /api/conversations          — ensure-or-create an org-scoped conversation
 *      Body: { orgClientId, memberId, subject? }
 *
 * The POST flow exists so the AskAPro picker (org-scope) can land users
 * directly on a conversation thread. Server verifies the caller owns the
 * org client link (so a logged-in user can't open a conversation against
 * an arbitrary OrganizationClient), then creates-or-returns the existing
 * conversation between (orgClient.userId, memberId).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  ConversationServiceError,
  createOrgScopedConversation,
  listConversationsForUser,
} from '@/lib/services/conversationService';
import { createAuditLog } from '@/lib/security/auditLog';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

export const GET = withPermission('report.read', async (request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_SOCIAL', auth.userId);
    if (gateBlocked) return gateBlocked;
  const { searchParams } = new URL(request.url);
  const hidden = searchParams.get('hidden') === 'true';

  try {
    const items = await listConversationsForUser(auth.userId, { hidden });
    return NextResponse.json({ success: true, data: { items } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load conversations';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});

interface EnsureBody {
  orgClientId: string;
  memberId: string;
  subject?: string;
}

export const POST = withPermission('report.read', async (request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_SOCIAL', auth.userId);
    if (gateBlocked) return gateBlocked;
  let body: EnsureBody;
  try {
    body = (await request.json()) as EnsureBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
      { status: 400 },
    );
  }
  if (!body.orgClientId || !body.memberId) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'orgClientId and memberId required' } },
      { status: 400 },
    );
  }

  // Verify the caller owns the org client link
  const orgClient = await prisma.organizationClient.findUnique({
    where: { id: body.orgClientId },
    select: { id: true, userId: true },
  });
  if (!orgClient) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Org link not found' } },
      { status: 404 },
    );
  }
  if (orgClient.userId !== auth.userId) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Not your org link' } },
      { status: 403 },
    );
  }

  try {
    const conv = await createOrgScopedConversation({
      orgClientId: body.orgClientId,
      memberId: body.memberId,
      subject: (body.subject ?? 'New conversation').slice(0, 160),
    });
    createAuditLog({
      userId: auth.userId,
      organizationId: conv.organizationId,
      action: 'CONVERSATION_CREATED',
      entityType: 'PROFESSIONAL_CONVERSATION',
      entityId: conv.id,
      metadata: { source: 'org-scoped-askapro' },
    }).catch(() => {});
    return NextResponse.json({ success: true, data: { conversation: conv } });
  } catch (err) {
    if (err instanceof ConversationServiceError) {
      const status =
        err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : 'Failed to create conversation';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});
