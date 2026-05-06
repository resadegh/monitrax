/**
 * Phase 41f.3 — GET /api/entities/[id]/accounting/snapshots
 *
 * Lists the latest N (default 12) `EntityAccountingSnapshot` rows for
 * this entity, newest first. Used by the connect-bookkeeping page to
 * render the latest snapshot card and a small history strip.
 *
 * USER_ENTITY scope only. Defence-in-depth ownership check via
 * `listEntitiesForUser` matches the rest of `/api/entities/[id]/*`.
 *
 * Raw provider payload is excluded from the response — it's a forensic
 * column, not user-facing data.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { listEntitiesForUser } from '@/lib/services/legalEntityService';
import prisma from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 12;

export const GET = withPermission<RouteContext>(
  'entity.read',
  async (request: NextRequest, auth, context) => {
    try {
      const { id } = await context!.params;

      const entities = await listEntitiesForUser(auth.userId);
      const entity = entities.find((e) => e.id === id);
      if (!entity) {
        return NextResponse.json(
          { error: 'Entity not found.' },
          { status: 404 },
        );
      }

      const url = new URL(request.url);
      const limitParam = Number(url.searchParams.get('limit'));
      const limit =
        Number.isFinite(limitParam) && limitParam > 0
          ? Math.min(MAX_PAGE_SIZE, Math.floor(limitParam))
          : DEFAULT_PAGE_SIZE;

      const rows = await prisma.entityAccountingSnapshot.findMany({
        where: { legalEntityId: id },
        orderBy: { pulledAt: 'desc' },
        take: limit,
      });

      const decimal = (v: unknown) => (v == null ? null : Number(v));
      const snapshots = rows.map((s) => ({
        id: s.id,
        legalEntityId: s.legalEntityId,
        sourceProvider: s.sourceProvider,
        sourceTenantId: s.sourceTenantId,
        pulledAt: s.pulledAt.toISOString(),
        fiscalPeriod: s.fiscalPeriod,
        periodStartDate: s.periodStartDate.toISOString(),
        periodEndDate: s.periodEndDate.toISOString(),

        totalAssets: decimal(s.totalAssets),
        totalLiabilities: decimal(s.totalLiabilities),
        totalEquity: decimal(s.totalEquity),
        retainedEarnings: decimal(s.retainedEarnings),

        revenue: decimal(s.revenue),
        operatingExpenses: decimal(s.operatingExpenses),
        netProfitBeforeTax: decimal(s.netProfitBeforeTax),
        netProfitAfterTax: decimal(s.netProfitAfterTax),

        distributableSurplus: decimal(s.distributableSurplus),
        trustNetIncome: decimal(s.trustNetIncome),
      }));

      return NextResponse.json({ snapshots, count: snapshots.length });
    } catch (error) {
      console.error('List snapshots error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  },
);
