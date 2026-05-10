/**
 * GET /api/portal/alerts?organizationId=… — Phase 32B PR3 #9b
 *
 * Returns the org's currently-ACTIVE client alerts (computed by the
 * sweep cron — see `app/api/portal/alerts/sweep/route.ts` and the
 * pure engine `lib/portal/alerts/alertEngine.ts`), each joined to a
 * thin client summary (initials / display name) so the Practice
 * dashboard's `<PracticeAlertStream>` can render the call sheet.
 *
 * Auth: `withPermission('org.read', …)` + an inline active-membership
 * check against the requested org (mirrors `/api/portal/conversations`).
 * A caller can only see alerts for an org they belong to.
 *
 * `OrganizationClient` has no `user` relation in the schema (it's a
 * loose `userId` FK), so the client display names are resolved with a
 * single follow-up `prisma.user.findMany({ where: { id: { in: … } } })`.
 *
 * Response shape — projected to the `DemoAlert` / client-summary shapes
 * the existing component already renders, so the dashboard can swap in
 * real data without a component rewrite:
 *   {
 *     success: true,
 *     data: {
 *       alerts: Array<{ id, clientId, triggerKind, severity, headline,
 *                       body, context, primaryActionLabel, detectedAt }>,
 *       clients: Array<{ id, initials, name }>,
 *     }
 *   }
 *   — `clientId` on an alert == the `organizationClientId` == the `id`
 *     on the matching client-summary row, so the component's
 *     `clientById` lookup map works unchanged.
 *
 * Privacy (CLAUDE.md §13.3): only the aggregate alert fields + the
 * client's display name + initials leave this endpoint — no raw CDR
 * data, no balances. The `payload` JSON column is NOT returned (it's
 * for future per-trigger drill-ins; not needed by the stream).
 *
 * Phase 32B PR3 #9b also ships `POST /api/portal/alerts/[id]/dismiss`.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import prisma from '@/lib/db';

/** Display name from a User row — prefers `name`, falls back to the email local-part. */
function displayName(user: { name?: string | null; email?: string | null } | undefined): string {
  const n = user?.name?.trim();
  if (n) return n;
  if (user?.email) return user.email.split('@')[0];
  return 'Client';
}

/** Two-letter initials from a display name. */
function initialsFor(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const GET = withPermission('org.read', async (request, auth) => {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'organizationId required' } },
      { status: 400 },
    );
  }

  // Active-membership check — caller must belong to this org.
  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId, userId: auth.userId, isActive: true },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this organisation' } },
      { status: 403 },
    );
  }

  try {
    const rows = await prisma.clientAlert.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: {
        id: true,
        organizationClientId: true,
        triggerKind: true,
        severity: true,
        headline: true,
        body: true,
        context: true,
        primaryActionLabel: true,
        detectedAt: true,
        organizationClient: { select: { id: true, userId: true } },
      },
      orderBy: { detectedAt: 'desc' },
    });

    // Resolve client display names in one follow-up query (no `user`
    // relation on OrganizationClient — it's a loose FK).
    const userIds = Array.from(new Set(rows.map((r) => r.organizationClient.userId)));
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    const clientMap = new Map<string, { id: string; initials: string; name: string }>();
    const alerts = rows.map((r) => {
      const ocId = r.organizationClientId;
      if (!clientMap.has(ocId)) {
        const name = displayName(userById.get(r.organizationClient.userId));
        clientMap.set(ocId, { id: ocId, initials: initialsFor(name), name });
      }
      return {
        id: r.id,
        clientId: ocId,
        triggerKind: r.triggerKind,
        severity: r.severity,
        headline: r.headline,
        body: r.body,
        context: r.context,
        primaryActionLabel: r.primaryActionLabel,
        detectedAt: r.detectedAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: { alerts, clients: Array.from(clientMap.values()) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load alerts';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});
