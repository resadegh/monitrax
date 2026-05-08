/**
 * GET /api/portal/practice/alerts?organizationId=...
 *
 * Returns OPEN PracticeAlert rows for the caller's org, mapped to the
 * shape `PracticeAlertStream` consumes (matches the legacy `DemoAlert`
 * structure so the dashboard component doesn't need to refactor).
 *
 * Auth: `withPermission('org.read')` + active OrganizationMember check.
 *
 * Response:
 *   { success: true, data: { items: AlertItem[], count: number } }
 *
 * AlertItem shape:
 *   {
 *     id, clientId,            // clientId = OrganizationClient.userId (matches DemoClient.id pattern)
 *     triggerKind,             // 'TRAIL_ADVANCED' | 'HEALTH_DROP' | ...
 *     severity,                // 'critical' | 'opportunity' | 'milestone' (lowercased to match DemoAlert)
 *     headline, body, context, primaryActionLabel,
 *     detectedAt,              // ISO string
 *   }
 *
 * Closes Phase 32B PR3 item #9 (read side).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';

// DB severity (`CRITICAL` | `OPPORTUNITY` | `MILESTONE`) → `DemoAlert`
// shape (`critical` | `opportunity` | `milestone`). Pure mapping —
// keeps `PracticeAlertStream` component unchanged from the demo era.
const SEVERITY_MAP = {
  CRITICAL: 'critical' as const,
  OPPORTUNITY: 'opportunity' as const,
  MILESTONE: 'milestone' as const,
};

export const GET = withPermission('org.read', async (request, auth) => {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'organizationId required' },
      },
      { status: 400 },
    );
  }

  // Verify caller is an active member of the org. Same pattern as
  // /api/portal/conversations — leaky-funnel guardrail at the route
  // boundary.
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: auth.userId,
      isActive: true,
    },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a member of this organisation' },
      },
      { status: 403 },
    );
  }

  // Pull OPEN alerts for the org, severity-sorted (CRITICAL first, then
  // OPPORTUNITY, then MILESTONE — the call-sheet ordering Phase 32B
  // PR2 established). NB: `OrganizationClient` has no Prisma `@relation`
  // back to `User` (only the `userId` FK column), so we resolve the
  // underlying user in two follow-up queries instead of a single
  // nested include. Two extra round-trips, but the lists are tiny
  // (one row per active alert).
  const alerts = await prisma.practiceAlert.findMany({
    where: {
      organizationId,
      status: 'OPEN',
    },
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
    },
    orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
  });

  // Resolve OrganizationClientId → User mapping in two batched queries.
  const uniqueOrgClientIds = Array.from(new Set(alerts.map((a) => a.organizationClientId)));
  const orgClients = uniqueOrgClientIds.length
    ? await prisma.organizationClient.findMany({
        where: { id: { in: uniqueOrgClientIds } },
        select: { id: true, userId: true },
      })
    : [];
  const orgClientToUserId = new Map(orgClients.map((c) => [c.id, c.userId]));

  const uniqueUserIds = Array.from(new Set(orgClients.map((c) => c.userId)));
  const users = uniqueUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: uniqueUserIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  // Map DB shape → component-friendly DemoAlert-compatible shape.
  // `clientId` is the User.id of the underlying client — matches the
  // `DemoClient.id` pattern the existing `PracticeAlertStream` uses.
  const items = alerts.map((a) => {
    const userId = orgClientToUserId.get(a.organizationClientId) ?? a.organizationClientId;
    return {
      id: a.id,
      clientId: userId,
      triggerKind: a.triggerKind,
      severity: SEVERITY_MAP[a.severity],
      headline: a.headline,
      body: a.body,
      context: a.context,
      primaryActionLabel: a.primaryActionLabel,
      detectedAt: a.detectedAt.toISOString(),
    };
  });

  // Parallel client lookup — only the clients referenced by returned
  // alerts. PracticeAlertStream merges this with whatever client list
  // the dashboard already has so the avatar + name renders correctly
  // for real alerts. Dedup by userId.
  const clientsSeen = new Map<string, { id: string; name: string; initials: string; email: string }>();
  for (const userId of uniqueUserIds) {
    const u = userById.get(userId);
    const name = u?.name ?? 'Client';
    clientsSeen.set(userId, {
      id: userId,
      name,
      email: u?.email ?? '',
      initials: deriveInitials(name),
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      items,
      count: items.length,
      clients: Array.from(clientsSeen.values()),
    },
  });
});

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
