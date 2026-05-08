/**
 * Phase 33g — Admin feedback inbox: thread detail + status/notes update.
 *
 *   GET   /api/admin/feedback/[id]   — full thread incl. internal notes + author info
 *   PATCH /api/admin/feedback/[id]   — flip status / edit internal notes / toggle taggedForAi
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth, mfaSetupRequiredResponse } from '@/lib/admin/auth';
import {
  getAdminThread,
  updateAdminFields,
} from '@/lib/services/feedbackService';
import type { FeedbackStatus } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'syd1';

const VALID_STATUSES: FeedbackStatus[] = [
  'OPEN',
  'IN_REVIEW',
  'PLANNED',
  'SHIPPED',
  'WONT_FIX',
  'DUPLICATE',
];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  const auth = await verifyAdminGCPAuth(request);
  if (!auth.success || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  if (auth.context.mfaSetupRequired) return mfaSetupRequiredResponse();

  const { id } = await ctx.params;
  const thread = await getAdminThread(id);
  if (!thread) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Thread not found' } },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: { thread } });
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const auth = await verifyAdminGCPAuth(request);
  if (!auth.success || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  if (auth.context.mfaSetupRequired) return mfaSetupRequiredResponse();

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON' } },
      { status: 400 },
    );
  }

  const { status, internalNotes, taggedForAi, aiDisabled } = (body ?? {}) as {
    status?: string;
    internalNotes?: string | null;
    taggedForAi?: boolean;
    aiDisabled?: boolean;
  };

  if (status !== undefined && !VALID_STATUSES.includes(status as FeedbackStatus)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_STATUS', message: 'Invalid status' } },
      { status: 400 },
    );
  }

  try {
    const updated = await updateAdminFields({
      threadId: id,
      adminUserId: auth.context.adminId,
      ...(status !== undefined ? { status: status as FeedbackStatus } : {}),
      ...(internalNotes !== undefined ? { internalNotes } : {}),
      ...(taggedForAi !== undefined ? { taggedForAi } : {}),
      ...(aiDisabled !== undefined ? { aiDisabled } : {}),
    });
    return NextResponse.json({ success: true, data: { thread: updated } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    if (msg.includes('not found')) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Thread not found' } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: msg } },
      { status: 500 },
    );
  }
}
