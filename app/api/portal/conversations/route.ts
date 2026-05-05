/**
 * Phase 32C PR4d — Portal-side conversation inbox.
 *
 * GET /api/portal/conversations?organizationId=...
 *
 * Returns conversations the caller can see in their organisation. Caller
 * must be an active member of the org (verified at the service layer).
 * Sort: most-recent message first.
 */
import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  ConversationServiceError,
  listConversationsForOrg,
} from '@/lib/services/conversationService';

export const GET = withPermission('org.read', async (request, auth) => {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'organizationId required' } },
      { status: 400 },
    );
  }
  try {
    const items = await listConversationsForOrg(organizationId, auth.userId);
    return NextResponse.json({ success: true, data: { items } });
  } catch (err) {
    if (err instanceof ConversationServiceError) {
      const status = err.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : 'Failed to load inbox';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});
