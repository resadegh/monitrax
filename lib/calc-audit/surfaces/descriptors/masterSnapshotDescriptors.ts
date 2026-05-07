/**
 * Phase 41i.6a — Surface descriptors backed by the canonical
 * MasterFinancialSnapshot (CLAUDE.md §6.1 SSOT).
 *
 * Six of the top-10 highest-impact tiles already consume from
 * `getMasterFinancialSnapshot()`:
 *
 *   1. Net-worth tile      (`netWorth.netWorth`)
 *   2. Health-score tile   (`healthScore.score`)
 *   3. Emergency-fund tile (`emergencyFund.monthsCovered`)
 *   4. Investment-total    (`investments.totalValue`)
 *   5. Property-equity     (`propertyPortfolioEquity`)
 *   6. Tax estimated refund (`tax.estimatedRefund`)
 *
 * The other 4 tiles (cashflow, expense, income, debt-freedom) consume
 * from separate endpoints — see `nonMasterDescriptors.ts`. Future
 * follow-ups will migrate them to consume from master per CLAUDE.md
 * §6.1; the registry will then update each descriptor's
 * `canonicalSource` + `invokeCanonicalSource` and the audit catches
 * any rendered-value drift during the migration.
 */

import 'server-only';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import type { SurfaceDescriptor } from '../types';

const MASTER_SERVICE = 'lib/services/masterFinancialService.ts';
const MASTER_METHOD = 'getMasterFinancialSnapshot';

type MasterSnapshot = Awaited<ReturnType<typeof getMasterFinancialSnapshot>>;

/**
 * Shared invoker — every master-backed descriptor calls the same
 * snapshot service. The harness will memoise per-userId per-run so
 * we don't pay the cost 6 times per user during a Full Scan.
 */
async function invokeMaster(userId: string): Promise<unknown> {
  return getMasterFinancialSnapshot(userId);
}

export const netWorthTile: SurfaceDescriptor = {
  surfaceId: 'tile.networth.total',
  description: 'Total net worth tile on /dashboard home',
  route: '/dashboard',
  kind: 'AUD',
  canonicalSource: {
    service: MASTER_SERVICE,
    method: MASTER_METHOD,
    fieldPath: 'netWorth.netWorth',
  },
  invokeCanonicalSource: invokeMaster,
  extractRenderedValue: (snap) => {
    const s = snap as MasterSnapshot;
    return s?.netWorth?.netWorth ?? null;
  },
  renderConditions: { skipWhenNull: true },
};

export const healthScoreTile: SurfaceDescriptor = {
  surfaceId: 'tile.health.score',
  description: 'Financial health score tile on /dashboard/cfo (0–100)',
  route: '/dashboard/cfo',
  kind: 'SCORE',
  canonicalSource: {
    service: MASTER_SERVICE,
    method: MASTER_METHOD,
    fieldPath: 'healthScore.score',
  },
  invokeCanonicalSource: invokeMaster,
  extractRenderedValue: (snap) => {
    const s = snap as MasterSnapshot;
    return s?.healthScore?.score ?? null;
  },
  renderConditions: { skipWhenNull: true },
};

export const emergencyFundTile: SurfaceDescriptor = {
  surfaceId: 'tile.emergencyfund.monthsCovered',
  description: 'Emergency fund "months covered" tile on /dashboard/safety-net',
  route: '/dashboard/safety-net',
  kind: 'MONTHS',
  canonicalSource: {
    service: MASTER_SERVICE,
    method: MASTER_METHOD,
    fieldPath: 'emergencyFund.monthsCovered',
  },
  invokeCanonicalSource: invokeMaster,
  extractRenderedValue: (snap) => {
    const s = snap as MasterSnapshot;
    return s?.emergencyFund?.monthsCovered ?? null;
  },
  renderConditions: { skipWhenNull: true },
};

export const investmentTotalTile: SurfaceDescriptor = {
  surfaceId: 'tile.investments.totalValue',
  description: 'Total investment portfolio value tile on /dashboard/investments/accounts',
  route: '/dashboard/investments/accounts',
  kind: 'AUD',
  canonicalSource: {
    service: MASTER_SERVICE,
    method: MASTER_METHOD,
    fieldPath: 'investments.totalValue',
  },
  invokeCanonicalSource: invokeMaster,
  extractRenderedValue: (snap) => {
    const s = snap as MasterSnapshot;
    return s?.investments?.totalValue ?? null;
  },
  renderConditions: { skipWhenNull: true, skipWhenZero: true },
};

export const propertyEquityTile: SurfaceDescriptor = {
  surfaceId: 'tile.property.portfolioEquity',
  description: 'Total property-portfolio equity tile on /dashboard/properties',
  route: '/dashboard/properties',
  kind: 'AUD',
  canonicalSource: {
    service: MASTER_SERVICE,
    method: MASTER_METHOD,
    fieldPath: 'propertyPortfolioEquity',
  },
  invokeCanonicalSource: invokeMaster,
  extractRenderedValue: (snap) => {
    const s = snap as MasterSnapshot;
    return (s as { propertyPortfolioEquity?: number })?.propertyPortfolioEquity ?? null;
  },
  renderConditions: { skipWhenNull: true, skipWhenZero: true },
};

export const taxEstimatedRefundTile: SurfaceDescriptor = {
  surfaceId: 'tile.tax.estimatedRefund',
  description: 'Estimated tax refund tile on /dashboard/tax (master-snapshot slice)',
  route: '/dashboard/tax',
  kind: 'AUD',
  canonicalSource: {
    service: MASTER_SERVICE,
    method: MASTER_METHOD,
    fieldPath: 'tax.estimatedRefund',
  },
  invokeCanonicalSource: invokeMaster,
  extractRenderedValue: (snap) => {
    const s = snap as MasterSnapshot;
    return (s?.tax as { estimatedRefund?: number } | undefined)?.estimatedRefund ?? null;
  },
  renderConditions: { skipWhenNull: true },
};

export const MASTER_SNAPSHOT_DESCRIPTORS: readonly SurfaceDescriptor[] = [
  netWorthTile,
  healthScoreTile,
  emergencyFundTile,
  investmentTotalTile,
  propertyEquityTile,
  taxEstimatedRefundTile,
];
