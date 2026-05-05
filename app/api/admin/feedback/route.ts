/**
 * Phase 33g — Admin (Reza) feedback inbox: list.
 *
 *   GET /api/admin/feedback?status=&surfaceTag=&severity=&organizationId=
 *
 * Returns every thread across every adviser. Default sort: oldest open first
 * so nothing rots. Auth: GCP Identity Platform admin via `verifyAdminGCPAuth`
 * (CLAUDE.md §13.4 — admin route, MFA enforced for SUPER_ADMIN/BILLING_ADMIN).
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth, mfaSetupRequiredResponse } from '@/lib/admin/auth';
import { listAdminThreads } from '@/lib/services/feedbackService';
import type {
  FeedbackStatus,
  FeedbackSurfaceTag,
  FeedbackSeverity,
} from '@prisma/client';

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
const VALID_TAGS: FeedbackSurfaceTag[] = [
  'BUG',
  'FEATURE',
  'UX',
  'PRAISE',
  'QUESTION',
  'COMPLIANCE',
];
const VALID_SEVERITIES: FeedbackSeverity[] = ['LOW', 'MEDIUM', 'HIGH'];

export async function GET(request: NextRequest) {
  const auth = await verifyAdminGCPAuth(request);
  if (!auth.success || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  if (auth.context.mfaSetupRequired) {
    return mfaSetupRequiredResponse();
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const surfaceTag = url.searchParams.get('surfaceTag');
  const severity = url.searchParams.get('severity');
  const organizationId = url.searchParams.get('organizationId');

  const threads = await listAdminThreads({
    ...(status && VALID_STATUSES.includes(status as FeedbackStatus)
      ? { status: status as FeedbackStatus }
      : {}),
    ...(surfaceTag && VALID_TAGS.includes(surfaceTag as FeedbackSurfaceTag)
      ? { surfaceTag: surfaceTag as FeedbackSurfaceTag }
      : {}),
    ...(severity && VALID_SEVERITIES.includes(severity as FeedbackSeverity)
      ? { severity: severity as FeedbackSeverity }
      : {}),
    ...(organizationId ? { organizationId } : {}),
  });

  return NextResponse.json({ success: true, data: { threads } });
}
