/**
 * Phase 32C PR4b — Ask-a-Professional candidate resolver endpoint.
 *
 * GET /api/ask-a-pro/candidates?context=<context>
 *
 * Returns the picker contents for `<AskAProfessionalButton />`. Two
 * shapes depending on the user's relationship with any orgs:
 *
 *   - Org-attached → `{ scope: 'org', orgCandidates: [...] }`
 *   - D2C          → `{ scope: 'public', listings: [...], totalAvailable }`
 *
 * Server enforces the "leaky funnel" guardrail (CLAUDE.md §0 + Up Next #15
 * 2026-05-04 strategic decision): org-attached users never see public
 * marketplace listings via this endpoint. Orgs pay for Monitrax to be
 * their CRM + comms channel, not a funnel to competitors.
 *
 * Auth: requires the user to be signed in. Permission: `report.read` (the
 * lightest-touch permission every authenticated role has — the picker is
 * a discovery surface, not a CDR-data surface).
 */
import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getCandidatesForUser } from '@/lib/services/askAProfessionalService';

export const GET = withPermission('report.read', async (request, auth) => {
  const { searchParams } = new URL(request.url);
  const context = searchParams.get('context') ?? undefined;

  try {
    const result = await getCandidatesForUser(auth.userId, context);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to resolve candidates';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});
