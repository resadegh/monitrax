/**
 * Neobrain AI-usage metrics API (Phase 54 — instrumentation).
 *
 * GET /api/admin/ai-usage?days=30
 * Aggregates the `AiUsageEvent` telemetry log into the measurable baseline for
 * the model-tiering cost/quality decision: total spend + tokens + call volume,
 * broken down BY SURFACE and BY MODEL, plus the success rate, over a window.
 *
 * Thin wrapper (CLAUDE.md §12.3): auth + Prisma groupBy + shape — no business
 * logic. Cost is the already-stored `estimatedCostUsd` (no re-derivation).
 * No CDR data is read or returned (the table holds counts + cost only, §13.3).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { toBreakdownRows, successRatePct, type AiUsageBreakdownRow } from '@/lib/ai/usage/summariseAiUsage';

export interface AiUsageMetricsResponse {
  windowDays: number;
  totals: {
    calls: number;
    totalTokens: number;
    estimatedCostUsd: number;
    failedCalls: number;
    successRatePct: number;
  };
  bySurface: AiUsageBreakdownRow[];
  byModel: AiUsageBreakdownRow[];
}

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 },
    );
  }

  try {
    const authResult = await verifyAdminGCPAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }
    if (!hasPermission(authResult.context.role, 'analytics:read')) {
      return NextResponse.json(
        { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // Window: default 30 days, clamped to [1, 365].
    const daysParam = Number(new URL(request.url).searchParams.get('days') ?? 30);
    const windowDays = Number.isFinite(daysParam) ? Math.min(365, Math.max(1, Math.round(daysParam))) : 30;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const where = { createdAt: { gte: since } };

    const [overall, failed, bySurfaceRaw, byModelRaw] = await Promise.all([
      prisma.aiUsageEvent.aggregate({
        where,
        _count: { _all: true },
        _sum: { totalTokens: true, estimatedCostUsd: true },
      }),
      prisma.aiUsageEvent.count({ where: { ...where, success: false } }),
      prisma.aiUsageEvent.groupBy({
        by: ['surface'],
        where,
        _count: { _all: true },
        _sum: { totalTokens: true, estimatedCostUsd: true },
      }),
      prisma.aiUsageEvent.groupBy({
        by: ['model'],
        where,
        _count: { _all: true },
        _sum: { totalTokens: true, estimatedCostUsd: true },
      }),
    ]);

    const totalCalls = overall._count._all;
    const totalCost = overall._sum.estimatedCostUsd ?? 0;
    const totalTokens = overall._sum.totalTokens ?? 0;

    const flatten = (
      rows: Array<{
        surface?: string;
        model?: string;
        _count: { _all: number };
        _sum: { totalTokens: number | null; estimatedCostUsd: number | null };
      }>,
      keyField: 'surface' | 'model',
    ) =>
      rows.map((r) => ({
        key: String(r[keyField] ?? 'unknown'),
        calls: r._count._all,
        totalTokens: r._sum.totalTokens ?? 0,
        estimatedCostUsd: r._sum.estimatedCostUsd ?? 0,
      }));

    const data: AiUsageMetricsResponse = {
      windowDays,
      totals: {
        calls: totalCalls,
        totalTokens,
        estimatedCostUsd: totalCost,
        failedCalls: failed,
        successRatePct: successRatePct(totalCalls, failed),
      },
      bySurface: toBreakdownRows(flatten(bySurfaceRaw, 'surface'), totalCost),
      byModel: toBreakdownRows(flatten(byModelRaw, 'model'), totalCost),
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[admin/ai-usage] failed:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR ?? 'INTERNAL_ERROR', message: 'Failed to load AI usage metrics' } },
      { status: 500 },
    );
  }
}
