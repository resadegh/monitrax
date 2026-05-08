/**
 * Phase 33g — Adviser feedback inbox: adviser reply.
 *
 *   POST /api/portal/feedback/[id]/reply
 *
 * Adviser appends a reply to one of their own threads. The service layer
 * enforces ownership — non-owner replies throw and we 403.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { appendReply, respondToFeedbackThread } from '@/lib/services/feedbackService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'syd1';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withPermission<RouteContext>(
  'feedback.write',
  async (request, auth, ctx) => {
    if (!ctx) return NextResponse.json({ success: false }, { status: 400 });
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

    try {
      const message = await appendReply({
        threadId: id,
        authorId: auth.userId,
        authorRole: 'ADVISER',
        body: messageBody,
      });
      // Phase 33g.2: trigger AI triage response asynchronously. No-op when
      // ANTHROPIC_API_KEY is absent; failures are caught + logged inside
      // respondToFeedbackThread() so they never break the user-facing path.
      void respondToFeedbackThread(id);
      return NextResponse.json({ success: true, data: { messageId: message.id } }, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      if (msg.includes('forbidden')) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Cannot reply on this thread' } },
          { status: 403 },
        );
      }
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
  },
);
