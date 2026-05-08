/**
 * Phase 33g — Adviser feedback inbox: list + create.
 *
 *   GET  /api/portal/feedback          — adviser lists own threads
 *   POST /api/portal/feedback          — adviser creates a new thread
 *
 * Service-layer scoping enforces "own threads only" — see
 * `lib/services/feedbackService.ts`. CLAUDE.md §12.3 (thin wrapper).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  createThread,
  listAdviserThreads,
  respondToFeedbackThread,
} from '@/lib/services/feedbackService';
import type {
  FeedbackSurfaceTag,
  FeedbackSeverity,
} from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'syd1';

const VALID_TAGS: FeedbackSurfaceTag[] = [
  'BUG',
  'FEATURE',
  'UX',
  'PRAISE',
  'QUESTION',
  'COMPLIANCE',
];
const VALID_SEVERITIES: FeedbackSeverity[] = ['LOW', 'MEDIUM', 'HIGH'];

export const GET = withPermission('feedback.read', async (_request, auth) => {
  const threads = await listAdviserThreads(auth.userId);
  return NextResponse.json({ success: true, data: { threads } });
});

export const POST = withPermission('feedback.write', async (request, auth) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON' } },
      { status: 400 },
    );
  }

  const { subject, surfaceTag, severity, surfaceRoute, organizationId, body: messageBody, authorRole } =
    (body ?? {}) as {
      subject?: string;
      surfaceTag?: string;
      severity?: string;
      surfaceRoute?: string | null;
      organizationId?: string | null;
      body?: string;
      authorRole?: 'ADVISER' | 'CONSUMER';
    };

  // Phase 33g.2 — `authorRole` defaults to ADVISER for backward compat with
  // existing portal callers. The consumer floating-button drawer passes
  // CONSUMER explicitly. Any other value is rejected.
  const effectiveAuthorRole: 'ADVISER' | 'CONSUMER' =
    authorRole === 'CONSUMER' ? 'CONSUMER' : 'ADVISER';

  if (typeof subject !== 'string' || subject.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_SUBJECT', message: 'Subject is required' } },
      { status: 400 },
    );
  }
  if (subject.trim().length > 140) {
    return NextResponse.json(
      { success: false, error: { code: 'SUBJECT_TOO_LONG', message: 'Subject must be ≤140 characters' } },
      { status: 400 },
    );
  }
  if (typeof messageBody !== 'string' || messageBody.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'Body is required' } },
      { status: 400 },
    );
  }
  if (!VALID_TAGS.includes(surfaceTag as FeedbackSurfaceTag)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_TAG', message: 'Invalid surface tag' } },
      { status: 400 },
    );
  }
  if (severity !== undefined && !VALID_SEVERITIES.includes(severity as FeedbackSeverity)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_SEVERITY', message: 'Invalid severity' } },
      { status: 400 },
    );
  }

  const thread = await createThread({
    userId: auth.userId,
    organizationId: typeof organizationId === 'string' ? organizationId : null,
    subject,
    surfaceTag: surfaceTag as FeedbackSurfaceTag,
    severity: (severity as FeedbackSeverity | undefined) ?? 'MEDIUM',
    surfaceRoute: surfaceRoute ?? null,
    body: messageBody,
    authorRole: effectiveAuthorRole,
  });

  // Phase 33g.2 — trigger AI triage on first message (fire-and-forget).
  // No-op when ANTHROPIC_API_KEY absent.
  void respondToFeedbackThread(thread.id);

  return NextResponse.json({ success: true, data: { threadId: thread.id } }, { status: 201 });
});
