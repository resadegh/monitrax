/**
 * Phase 41f.3 — POST /api/entities/[id]/accounting/refresh
 *
 * Manually triggers a Xero snapshot pull for this entity. Idempotent:
 * pulling the same fiscal period overwrites the existing
 * `EntityAccountingSnapshot` row (the unique key is
 * `(legalEntityId, fiscalPeriod)` per the 41f.1 migration).
 *
 * Body (optional):
 *   { fiscalPeriod?: string }   — e.g. "FY24-25"; defaults to the
 *                                 current AU fiscal year.
 *
 * Returns the persisted snapshot. Surfaces 4xx with typed error
 * codes so the connect-bookkeeping page can render the right
 * messaging:
 *   - 404 ENTITY_NOT_FOUND / NO_INTEGRATION
 *   - 409 NOT_CONNECTED        — integration row exists but isConnected = false
 *   - 502 XERO_API_ERROR       — Xero refused the request
 *   - 500 PARSE_ERROR          — Xero returned an unexpected report shape
 *   - 503 XERO_NOT_CONFIGURED  — env vars unset (token refresh impossible)
 *
 * Per CLAUDE.md §12.10 audit logging is fire-and-forget. CDR
 * sanitisation per §13.3 — no balances or P&L line items in the
 * audit metadata; only entity / tenant / fiscal-period identifiers.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { listEntitiesForUser } from '@/lib/services/legalEntityService';
import prisma from '@/lib/db';
import { pullSnapshot, SnapshotPullError } from '@/lib/integrations/xero';
import { logCRUD } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';

type RouteContext = { params: Promise<{ id: string }> };

interface RefreshRequestBody {
  fiscalPeriod?: unknown;
}

export const POST = withPermission<RouteContext>(
  'entity.write',
  async (request: NextRequest, auth, context) => {
    try {
      const { id } = await context!.params;

      const entities = await listEntitiesForUser(auth.userId);
      const entity = entities.find((e) => e.id === id);
      if (!entity) {
        return NextResponse.json(
          { error: 'Entity not found.', code: 'ENTITY_NOT_FOUND' },
          { status: 404 },
        );
      }

      const integration = await prisma.accountingIntegration.findFirst({
        where: {
          scope: 'USER_ENTITY',
          legalEntityId: id,
          userId: auth.userId,
        },
        select: { id: true, isConnected: true },
      });
      if (!integration) {
        return NextResponse.json(
          { error: 'No bookkeeping integration on this entity.', code: 'NO_INTEGRATION' },
          { status: 404 },
        );
      }
      if (!integration.isConnected) {
        return NextResponse.json(
          {
            error: 'Re-connect Xero before refreshing.',
            code: 'NOT_CONNECTED',
          },
          { status: 409 },
        );
      }

      let body: RefreshRequestBody = {};
      try {
        body = (await request.json()) as RefreshRequestBody;
      } catch {
        // No body is fine — defaults apply
      }
      const fiscalPeriod =
        typeof body.fiscalPeriod === 'string' && body.fiscalPeriod.trim().length > 0
          ? body.fiscalPeriod.trim()
          : undefined;

      let result;
      try {
        result = await pullSnapshot({
          integrationId: integration.id,
          fiscalPeriod,
          pulledByUserId: auth.userId,
        });
      } catch (err) {
        if (err instanceof SnapshotPullError) {
          const status = mapErrorCodeToStatus(err.code);
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status },
          );
        }
        throw err;
      }

      // Audit — CDR-safe metadata only (no balances / line items).
      logCRUD({
        userId: auth.userId,
        action: 'CREATE',
        entityType: 'EntityAccountingSnapshot',
        entityId: result.snapshot.id,
        metadata: sanitizeCdrMetadata({
          legalEntityId: entity.id,
          legalEntityName: entity.name,
          legalEntityType: entity.type,
          fiscalPeriod: result.snapshot.fiscalPeriod,
          sourceProvider: result.snapshot.sourceProvider,
          // Note: tenant id is a Xero org identifier, not customer data.
          sourceTenantId: result.snapshot.sourceTenantId,
        }),
      }).catch(() => {});

      return NextResponse.json({
        snapshot: serializeSnapshot(result.snapshot),
      });
    } catch (error) {
      console.error('Refresh snapshot error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  },
);

function mapErrorCodeToStatus(code: SnapshotPullError['code']): number {
  switch (code) {
    case 'NOT_CONNECTED':
      return 409;
    case 'TOKEN_REFRESH_FAILED':
      return 401;
    case 'XERO_API_ERROR':
      return 502;
    case 'PARSE_ERROR':
      return 500;
    default:
      return 500;
  }
}

// We intentionally serialise Decimal columns as numbers + Date columns
// as ISO strings so the JSON response is plain. Raw provider payload
// is omitted from the response (it's only for forensic re-derivation
// and not user-facing).
function serializeSnapshot(s: import('@prisma/client').EntityAccountingSnapshot) {
  const decimal = (v: unknown) => (v == null ? null : Number(v));
  return {
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
    cashAndEquivalents: decimal(s.cashAndEquivalents),
    tradeReceivables: decimal(s.tradeReceivables),
    inventoryValue: decimal(s.inventoryValue),
    fixedAssetsNet: decimal(s.fixedAssetsNet),
    tradePayables: decimal(s.tradePayables),
    shortTermDebt: decimal(s.shortTermDebt),
    longTermDebt: decimal(s.longTermDebt),
    retainedEarnings: decimal(s.retainedEarnings),

    revenue: decimal(s.revenue),
    costOfGoodsSold: decimal(s.costOfGoodsSold),
    operatingExpenses: decimal(s.operatingExpenses),
    netProfitBeforeTax: decimal(s.netProfitBeforeTax),
    taxExpense: decimal(s.taxExpense),
    netProfitAfterTax: decimal(s.netProfitAfterTax),
    depreciation: decimal(s.depreciation),
    interest: decimal(s.interest),

    distributableSurplus: decimal(s.distributableSurplus),
    trustNetIncome: decimal(s.trustNetIncome),
  };
}
