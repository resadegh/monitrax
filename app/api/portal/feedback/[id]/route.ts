/**
 * Phase 33g — Adviser feedback inbox: thread detail.
 *
 *   GET /api/portal/feedback/[id]      — adviser reads own thread (404 if not theirs)
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getAdviserThread } from '@/lib/services/feedbackService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'syd1';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withPermission<RouteContext>(
  'feedback.read',
  async (_request, auth, ctx) => {
    if (!ctx) return NextResponse.json({ success: false }, { status: 400 });
    const { id } = await ctx.params;
    const thread = await getAdviserThread(id, auth.userId);
    if (!thread) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Thread not found' } },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: { thread } });
  },
);
