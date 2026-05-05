/**
 * Phase 33g — Admin feedback inbox: admin reply.
 *
 *   POST /api/admin/feedback/[id]/reply
 *
 * Reza posts a `MONITRAX_ADMIN`-role reply to a thread. Auto-flips OPEN →
 * IN_REVIEW on first admin reply (handled in the service layer).
 *
 * The author of a `FeedbackMessage` is a `User` row — there's no separate
 * `AdminUser`-as-author concept, because admins authenticate via Firebase
 * (per `verifyAdminGCPAuth`) and have a corresponding `User` row created
 * during signup. We resolve the admin's `User.id` from `AuthContext.email`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminGCPAuth, mfaSetupRequiredResponse } from '@/lib/admin/auth';
import { appendReply } from '@/lib/services/feedbackService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'syd1';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, ctx: RouteContext) {
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
  const { body: messageBody } = (body ?? {}) as { body?: string };
  if (typeof messageBody !== 'string' || messageBody.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'Body is required' } },
      { status: 400 },
    );
  }

  // Resolve the admin's User.id by email — every admin signs in via the
  // same Firebase Identity Platform flow consumers use, so a User row
  // exists with the same email.
  const userRow = await prisma.user.findUnique({
    where: { email: auth.context.email },
    select: { id: true },
  });
  if (!userRow) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NO_USER_RECORD',
          message: 'Admin email has no matching User record — log into the consumer app once to provision it',
        },
      },
      { status: 409 },
    );
  }

  try {
    const message = await appendReply({
      threadId: id,
      authorId: userRow.id,
      authorRole: 'MONITRAX_ADMIN',
      body: messageBody,
    });
    return NextResponse.json({ success: true, data: { messageId: message.id } }, { status: 201 });
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
