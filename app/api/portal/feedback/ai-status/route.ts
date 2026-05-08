/**
 * Phase 33g.2 — Feedback AI status check.
 *
 * Returns whether the live AI triage is currently enabled (i.e. whether
 * `ANTHROPIC_API_KEY` is configured server-side). Consumer-side feedback
 * drawer hits this on mount to decide between chat-style UI (AI on) and
 * form-only fallback (AI off) — no UI swap, just a different success
 * message + no AI-typing indicator.
 *
 * Auth: requires `feedback.read` (every role has it). The endpoint
 * returns ONLY a boolean — no model names, no key fragments, no spend
 * data — so it's safe to expose to any authenticated user.
 */
import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { isFeedbackAiEnabled } from '@/lib/services/feedbackService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'syd1';

export const GET = withPermission('feedback.read', async () => {
  return NextResponse.json({
    success: true,
    data: { aiEnabled: isFeedbackAiEnabled() },
  });
});
