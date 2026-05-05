/**
 * Phase 33g — Admin feedback inbox: Markdown export for Claude synthesis.
 *
 *   GET /api/admin/feedback/export?since=YYYY-MM-DD&taggedOnly=true
 *
 * Returns a `text/markdown` file Reza saves locally and pastes into a
 * fresh Claude Code session for theme synthesis + draft plan against
 * `IMPLEMENTATION_PLAN.md`. `internalNotes` are excluded by the service
 * layer; `taggedOnly=true` is the recommended scope so Reza picks which
 * threads are AI-eligible per CLAUDE.md §13 CDR posture.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth, mfaSetupRequiredResponse } from '@/lib/admin/auth';
import { exportThreadsAsMarkdown } from '@/lib/services/feedbackService';
import { logExport } from '@/lib/security/auditLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'syd1';

export async function GET(request: NextRequest) {
  const auth = await verifyAdminGCPAuth(request);
  if (!auth.success || !auth.context) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  if (auth.context.mfaSetupRequired) return mfaSetupRequiredResponse();

  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get('since');
  const taggedOnly = url.searchParams.get('taggedOnly') === 'true';

  let since: Date | undefined;
  if (sinceRaw) {
    const parsed = new Date(sinceRaw);
    if (!isNaN(parsed.getTime())) since = parsed;
  }

  const md = await exportThreadsAsMarkdown({ since, taggedOnly });
  const filename = `monitrax-feedback-${new Date().toISOString().slice(0, 10)}${
    taggedOnly ? '-tagged' : ''
  }.md`;

  void logExport({
    userId: auth.context.adminId,
    entityType: 'FeedbackThread',
    format: 'markdown',
    ipAddress: auth.context.ipAddress,
  });

  return new NextResponse(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
