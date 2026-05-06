/**
 * Phase 41f.3 — Xero snapshot puller.
 *
 * Orchestrates a single end-to-end pull:
 *   1. Resolve (or refresh) the access token.
 *   2. Fetch the Xero Balance Sheet + Profit & Loss for the requested
 *      fiscal period (defaults to the current Australian FY).
 *   3. Parse both reports into typed shapes.
 *   4. Compute the simplified s109Y distributable surplus per spec
 *      doc §9 (UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE — full s109Y
 *      requires off-Xero franking-account data; v1 surfaces the
 *      best-estimate with that caveat preserved upstream in the
 *      Div 7A classifier).
 *   5. Persist the result idempotently to `EntityAccountingSnapshot`
 *      (overwrite on `(legalEntityId, fiscalPeriod)` per the unique
 *      key shipped in 41f.1).
 *   6. Stamp `lastSyncAt` + `lastSyncStatus` on the integration row.
 *
 * Per spec doc §1.1 — read-only. We never write back to Xero.
 *
 * Per spec doc §1 strategic positioning — every persisted number
 * carries `sourceProvider + sourceTenantId + pulledAt + pulledByUserId`
 * so downstream Phase 41e tax engines have the full audit trail.
 */

import 'server-only';
import type { AccountingIntegration, EntityAccountingSnapshot } from '@prisma/client';
import prisma from '@/lib/db';
import { getValidAccessToken, TokenRefreshError } from './tokenRefresh';
import {
  parseBalanceSheet,
  parseProfitAndLoss,
  type XeroBalanceSheet,
  type XeroProfitAndLoss,
  XeroReportParseError,
} from './reportParser';

const XERO_REPORT_BS = 'https://api.xero.com/api.xro/2.0/Reports/BalanceSheet';
const XERO_REPORT_PL = 'https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss';

export class SnapshotPullError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_CONNECTED'
      | 'TOKEN_REFRESH_FAILED'
      | 'XERO_API_ERROR'
      | 'PARSE_ERROR',
  ) {
    super(message);
    this.name = 'SnapshotPullError';
  }
}

export interface PullSnapshotInput {
  /** The AccountingIntegration row id (USER_ENTITY scope). */
  integrationId: string;
  /** Optional explicit fiscal period — defaults to the current AU FY. */
  fiscalPeriod?: string;
  /** UserId triggering the pull — stamped onto the snapshot for audit. */
  pulledByUserId: string;
}

export interface PullSnapshotResult {
  snapshot: EntityAccountingSnapshot;
  parsedBalanceSheet: XeroBalanceSheet;
  parsedProfitAndLoss: XeroProfitAndLoss;
}

/**
 * Pull a snapshot end-to-end. Throws `SnapshotPullError` with a typed
 * `code` on any failure so callers can render specific UI errors.
 */
export async function pullSnapshot(
  input: PullSnapshotInput,
): Promise<PullSnapshotResult> {
  const integration = await prisma.accountingIntegration.findUnique({
    where: { id: input.integrationId },
  });
  if (!integration) {
    throw new SnapshotPullError(
      'Integration not found.',
      'NOT_CONNECTED',
    );
  }
  if (integration.scope !== 'USER_ENTITY' || !integration.legalEntityId) {
    throw new SnapshotPullError(
      'Snapshot pulls are USER_ENTITY-scope only.',
      'NOT_CONNECTED',
    );
  }
  if (!integration.providerTenantId) {
    throw new SnapshotPullError(
      'Integration has no Xero tenant on file.',
      'NOT_CONNECTED',
    );
  }

  const period = resolveFiscalPeriod(input.fiscalPeriod);

  // 1. Refresh-if-needed access token.
  let accessToken: string;
  try {
    const tokens = await getValidAccessToken(integration);
    accessToken = tokens.accessToken;
  } catch (err) {
    if (err instanceof TokenRefreshError) {
      throw new SnapshotPullError(err.message, 'TOKEN_REFRESH_FAILED');
    }
    throw err;
  }

  // 2. Fetch BS + P&L in parallel.
  let bsRaw: unknown;
  let plRaw: unknown;
  try {
    [bsRaw, plRaw] = await Promise.all([
      fetchXeroReport(XERO_REPORT_BS, integration.providerTenantId, accessToken, {
        date: period.toDate,
      }),
      fetchXeroReport(XERO_REPORT_PL, integration.providerTenantId, accessToken, {
        fromDate: period.fromDate,
        toDate: period.toDate,
      }),
    ]);
  } catch (err) {
    await stampSyncError(input.integrationId, err);
    throw err instanceof SnapshotPullError
      ? err
      : new SnapshotPullError(
          err instanceof Error ? err.message : 'Xero API error',
          'XERO_API_ERROR',
        );
  }

  // 3. Parse.
  let bs: XeroBalanceSheet;
  let pl: XeroProfitAndLoss;
  try {
    bs = parseBalanceSheet(bsRaw);
    pl = parseProfitAndLoss(plRaw);
  } catch (err) {
    await stampSyncError(input.integrationId, err);
    throw err instanceof XeroReportParseError
      ? new SnapshotPullError(err.message, 'PARSE_ERROR')
      : new SnapshotPullError(
          err instanceof Error ? err.message : 'Parse error',
          'PARSE_ERROR',
        );
  }

  // 4. Compute simplified s109Y distributable surplus (per spec
  // doc §9 UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE).
  const distributableSurplus = computeSimplifiedDistributableSurplus(bs, pl);

  // 5. Idempotent persist (overwrite on legalEntityId + fiscalPeriod
  // per the unique index from 41f.1).
  const existing = await prisma.entityAccountingSnapshot.findUnique({
    where: {
      legalEntityId_fiscalPeriod: {
        legalEntityId: integration.legalEntityId,
        fiscalPeriod: period.label,
      },
    },
    select: { id: true },
  });

  const persistedFields = {
    sourceProvider: integration.provider,
    sourceTenantId: integration.providerTenantId,
    pulledAt: new Date(),
    pulledByUserId: input.pulledByUserId,
    fiscalPeriod: period.label,
    periodStartDate: new Date(period.fromDate),
    periodEndDate: new Date(period.toDate),

    totalAssets: bs.totalAssets,
    totalLiabilities: bs.totalLiabilities,
    totalEquity: bs.totalEquity,
    cashAndEquivalents: bs.cashAndEquivalents ?? null,
    tradeReceivables: bs.tradeReceivables ?? null,
    inventoryValue: bs.inventoryValue ?? null,
    fixedAssetsNet: bs.fixedAssetsNet ?? null,
    tradePayables: bs.tradePayables ?? null,
    shortTermDebt: bs.shortTermDebt ?? null,
    longTermDebt: bs.longTermDebt ?? null,
    retainedEarnings: bs.retainedEarnings ?? null,

    revenue: pl.revenue,
    costOfGoodsSold: pl.costOfGoodsSold ?? null,
    operatingExpenses: pl.operatingExpenses,
    netProfitBeforeTax: pl.netProfitBeforeTax,
    taxExpense: pl.taxExpense ?? null,
    netProfitAfterTax: pl.netProfitAfterTax,
    depreciation: pl.depreciation ?? null,
    interest: pl.interest ?? null,

    distributableSurplus: distributableSurplus,
    trustNetIncome: null, // Phase 41f.4 trust-deed parser will populate this when applicable
    smsfMemberBalances: null as unknown as undefined, // Same — populated when 41f.4 SMSF flow lands

    rawProviderPayload: { bs: bsRaw, pl: plRaw } as unknown as object,
  };

  let snapshot: EntityAccountingSnapshot;
  if (existing) {
    snapshot = await prisma.entityAccountingSnapshot.update({
      where: { id: existing.id },
      data: persistedFields,
    });
  } else {
    snapshot = await prisma.entityAccountingSnapshot.create({
      data: {
        legalEntityId: integration.legalEntityId,
        ...persistedFields,
      },
    });
  }

  // 6. Stamp success on the integration.
  await prisma.accountingIntegration.update({
    where: { id: integration.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: 'COMPLETED',
      lastSyncError: null,
    },
  });

  return { snapshot, parsedBalanceSheet: bs, parsedProfitAndLoss: pl };
}

// =============================================================================
// Public helpers
// =============================================================================

export interface FiscalPeriod {
  /** Label persisted on the snapshot row, e.g. "FY24-25". */
  label: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string;
}

/**
 * Resolve `fiscalPeriod` to a concrete from/to range. Accepts:
 *   - `"FY24-25"` style strings
 *   - undefined → defaults to the AU FY containing today
 */
export function resolveFiscalPeriod(label?: string): FiscalPeriod {
  if (label) {
    const m = label.match(/^FY(\d{2})-(\d{2})$/i);
    if (m) {
      const startYear = 2000 + Number(m[1]);
      const endYear = 2000 + Number(m[2]);
      return {
        label: `FY${m[1]}-${m[2]}`,
        fromDate: `${startYear}-07-01`,
        toDate: `${endYear}-06-30`,
      };
    }
    // Allow callers to pass an explicit ISO range like "2024-07-01..2025-06-30"
    const iso = label.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
    if (iso) {
      return {
        label,
        fromDate: iso[1],
        toDate: iso[2],
      };
    }
  }
  // Default — current AU FY.
  return currentAustralianFY();
}

export function currentAustralianFY(now: Date = new Date()): FiscalPeriod {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  // AU FY runs 1 Jul → 30 Jun; FY24-25 = 1 Jul 2024 → 30 Jun 2025.
  const isAfterJune = m >= 6;
  const startYear = isAfterJune ? y : y - 1;
  const endYear = startYear + 1;
  return {
    label: `FY${String(startYear).slice(2)}-${String(endYear).slice(2)}`,
    fromDate: `${startYear}-07-01`,
    toDate: `${endYear}-06-30`,
  };
}

/**
 * Phase 41f.3 simplified s109Y distributable surplus.
 *
 * Returns the conservative best-estimate per spec doc §9
 * (UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE):
 *
 *   simplifiedSurplus = max(0,
 *     (retainedEarnings ?? 0) + netProfitAfterTax
 *   )
 *
 * Why this shape:
 * - The full s109Y formula requires the prior-year franking account
 *   balance + paid-up capital separation, which Xero does not expose
 *   in a structured way at v1.
 * - A negative surplus is meaningless for the Div 7A cap (the cap is
 *   "company can't be deemed to dividend more than it could
 *   franked-distribute") so floor at 0.
 * - When `retainedEarnings` is missing, fall back to net profit
 *   alone — still conservative, since real distributable surplus
 *   includes accumulated retained earnings.
 */
export function computeSimplifiedDistributableSurplus(
  bs: XeroBalanceSheet,
  pl: XeroProfitAndLoss,
): number {
  const retained = bs.retainedEarnings ?? 0;
  const net = pl.netProfitAfterTax ?? 0;
  return Math.max(0, retained + net);
}

// =============================================================================
// Internal
// =============================================================================

async function fetchXeroReport(
  url: string,
  tenantId: string,
  accessToken: string,
  params: Record<string, string>,
): Promise<unknown> {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);

  const res = await fetch(u.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Xero-tenant-id': tenantId,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new SnapshotPullError(
      `Xero ${url} returned ${res.status}: ${detail.slice(0, 200)}`,
      'XERO_API_ERROR',
    );
  }
  return res.json();
}

async function stampSyncError(integrationId: string, err: unknown): Promise<void> {
  const message =
    err instanceof Error ? err.message.slice(0, 500) : 'Unknown sync error';
  await prisma.accountingIntegration
    .update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'FAILED',
        lastSyncError: message,
      },
    })
    .catch(() => {});
}
