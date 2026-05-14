/**
 * GET /api/portal/clients?organizationId=… — Phase 32B PR3 post-#9b polish part 2
 *
 * Aggregate-only summary of an org's client book, sized for the Practice
 * dashboard hero KPI strip. Reads cheaply from the rows the alert sweep
 * already maintains — no live `getMasterFinancialSnapshot()` per client:
 *   - `OrganizationClient` (status = ACTIVE) — "clients on the book"
 *   - `ClientSnapshotMarker` (lastHealthScore / lastTrailStage /
 *     previousHealthScore) — health + TRAIL stage + the change since the
 *     previous sweep, written by `runPortalAlertSweep`
 *   - `ClientAlert` (status = ACTIVE) — "needs attention" + TRAIL-advanced
 *
 * Auth: `withPermission('org.read', …)` + an inline active-membership
 * check against the requested org (mirrors `/api/portal/alerts`).
 *
 * Response (a superset of the existing `PracticeKpis` shape so the
 * dashboard can swap in real data without a component rewrite):
 *   {
 *     success: true,
 *     data: {
 *       hasRealClients: boolean,          // activeClients > 0
 *       lastSweptAt: string | null,       // most-recent marker.lastSweptAt (ISO)
 *       kpis: { activeClients, needsAttention, trailAdvancedThisWeek,
 *               averageHealth, averageHealthDelta },
 *       clients: Array<{ id, name, initials, trailStage, healthScore,
 *                        healthDelta, activeAlertCount }>,
 *     }
 *   }
 *   — `id` is the `organizationClientId` (== the `clientId` on alerts
 *     from `/api/portal/alerts`), so the two responses join cleanly.
 *
 * Privacy (CLAUDE.md §13.3): only aggregate scalars leave this endpoint
 * — a 0–100 health score, a TRAIL-stage letter→label, an alert count,
 * and the client's display name + initials. No balances, no CDR data.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import prisma from '@/lib/db';

/** Marker stores 'T'|'R'|'A'|'I'|'L'; the Practice surface uses the warm names. */
const STAGE_BY_LETTER: Record<string, 'TRACK' | 'REDUCE' | 'ANCHOR' | 'INVEST' | 'LIVE'> = {
  T: 'TRACK',
  R: 'REDUCE',
  A: 'ANCHOR',
  I: 'INVEST',
  L: 'LIVE',
};

function displayName(user: { name?: string | null; email?: string | null } | undefined): string {
  const n = user?.name?.trim();
  if (n) return n;
  if (user?.email) return user.email.split('@')[0];
  return 'Client';
}

function initialsFor(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const GET = withPermission('org.read', async (request, auth) => {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'organizationId required' } },
      { status: 400 },
    );
  }

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
    const orgClients = await prisma.organizationClient.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: { id: true, userId: true, alertMarker: true },
    });

    const ocIds = orgClients.map((c) => c.id);

    // ACTIVE alerts for these clients — one query, then bucket in JS.
    const alerts = ocIds.length
      ? await prisma.clientAlert.findMany({
          where: { organizationClientId: { in: ocIds }, status: 'ACTIVE' },
          select: { organizationClientId: true, severity: true, triggerKind: true, detectedAt: true },
        })
      : [];

    const alertCountByClient = new Map<string, number>();
    const attentionClients = new Set<string>(); // critical | opportunity
    const since = Date.now() - SEVEN_DAYS_MS;
    let trailAdvancedThisWeek = 0;
    for (const a of alerts) {
      alertCountByClient.set(a.organizationClientId, (alertCountByClient.get(a.organizationClientId) ?? 0) + 1);
      if (a.severity === 'critical' || a.severity === 'opportunity') {
        attentionClients.add(a.organizationClientId);
      }
      if (a.triggerKind === 'TRAIL_ADVANCED' && a.detectedAt.getTime() >= since) {
        trailAdvancedThisWeek += 1;
      }
    }

    // Client display names — one follow-up query (no `user` relation on OrganizationClient).
    const userIds = Array.from(new Set(orgClients.map((c) => c.userId)));
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    let healthSum = 0;
    let healthCount = 0;
    let deltaSum = 0;
    let deltaCount = 0;
    let lastSweptAtMs = 0;

    const clients = orgClients.map((c) => {
      const name = displayName(userById.get(c.userId));
      const m = c.alertMarker;
      const healthScore = m?.lastHealthScore ?? null;
      const healthDelta =
        m && m.lastHealthScore != null && m.previousHealthScore != null
          ? m.lastHealthScore - m.previousHealthScore
          : null;
      const trailStage = m?.lastTrailStage ? STAGE_BY_LETTER[m.lastTrailStage] ?? null : null;
      if (healthScore != null) {
        healthSum += healthScore;
        healthCount += 1;
      }
      if (healthDelta != null) {
        deltaSum += healthDelta;
        deltaCount += 1;
      }
      if (m?.lastSweptAt) lastSweptAtMs = Math.max(lastSweptAtMs, m.lastSweptAt.getTime());
      return {
        id: c.id,
        name,
        initials: initialsFor(name),
        trailStage,
        healthScore,
        healthDelta,
        activeAlertCount: alertCountByClient.get(c.id) ?? 0,
      };
    });

    const kpis = {
      activeClients: orgClients.length,
      needsAttention: attentionClients.size,
      trailAdvancedThisWeek,
      averageHealth: healthCount > 0 ? Math.round(healthSum / healthCount) : 0,
      averageHealthDelta: deltaCount > 0 ? Math.round((deltaSum / deltaCount) * 10) / 10 : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        hasRealClients: orgClients.length > 0,
        lastSweptAt: lastSweptAtMs > 0 ? new Date(lastSweptAtMs).toISOString() : null,
        kpis,
        clients,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load client summary';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});
