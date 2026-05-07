/**
 * Phase 41i.6a — Cashflow / income / expense / debt-freedom surface
 * descriptors.
 *
 * These four tiles consume from various endpoints today (per the
 * recon for 41i.6a) — `/api/cfo`, `/api/calculate/cashflow`,
 * `/api/ai/debt-analysis`, `/api/safety-net`. Per CLAUDE.md §6.1
 * the **canonical** SSOT is `getMasterFinancialSnapshot()` — every
 * one of these values is available on `quickMetrics` or the typed
 * snapshot fields.
 *
 * Registering against master means: when the runtime audit harness
 * (41i.6c) runs, it re-derives from master. The static-analysis pass
 * (41i.6b) catches any component that imports a different service
 * than `lib/services/masterFinancialService.ts` for these tiles —
 * that's the bug class we want to surface to drive migration to the
 * SSOT.
 */

import 'server-only';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import type { SurfaceDescriptor } from '../types';

const MASTER_SERVICE = 'lib/services/masterFinancialService.ts';
const MASTER_METHOD = 'getMasterFinancialSnapshot';

type MasterSnapshot = Awaited<ReturnType<typeof getMasterFinancialSnapshot>>;

async function invokeMaster(userId: string): Promise<unknown> {
  return getMasterFinancialSnapshot(userId);
}

export const cashflowMonthlyTile: SurfaceDescriptor = {
  surfaceId: 'tile.cashflow.monthly',
  description: 'Monthly cashflow tile on /dashboard/cfo (income − expenses − loan repayments)',
  route: '/dashboard/cfo',
  kind: 'AUD',
  canonicalSource: {
    service: MASTER_SERVICE,
    method: MASTER_METHOD,
    fieldPath: 'quickMetrics.monthlyCashflow',
  },
  invokeCanonicalSource: invokeMaster,
  extractRenderedValue: (snap) => {
    const s = snap as MasterSnapshot;
    return s?.quickMetrics?.monthlyCashflow ?? null;
  },
  renderConditions: { skipWhenNull: true },
};

export const incomeMonthlyTile: SurfaceDescriptor = {
  surfaceId: 'tile.income.monthly',
  description: 'Monthly income tile on /dashboard/cfo + /dashboard/income',
  route: '/dashboard/cfo',
  kind: 'AUD',
  canonicalSource: {
    service: MASTER_SERVICE,
    method: MASTER_METHOD,
    fieldPath: 'quickMetrics.monthlyIncome',
  },
  invokeCanonicalSource: invokeMaster,
  extractRenderedValue: (snap) => {
    const s = snap as MasterSnapshot;
    return s?.quickMetrics?.monthlyIncome ?? null;
  },
  renderConditions: { skipWhenNull: true, skipWhenZero: true },
};

export const expenseMonthlyTile: SurfaceDescriptor = {
  surfaceId: 'tile.expense.monthly',
  description: 'Monthly expense tile on /dashboard/cfo + /dashboard/expenses',
  route: '/dashboard/cfo',
  kind: 'AUD',
  canonicalSource: {
    service: MASTER_SERVICE,
    method: MASTER_METHOD,
    fieldPath: 'quickMetrics.monthlyExpenses',
  },
  invokeCanonicalSource: invokeMaster,
  extractRenderedValue: (snap) => {
    const s = snap as MasterSnapshot;
    return s?.quickMetrics?.monthlyExpenses ?? null;
  },
  renderConditions: { skipWhenNull: true, skipWhenZero: true },
};

export const debtTotalTile: SurfaceDescriptor = {
  surfaceId: 'tile.debt.total',
  description: 'Total debt tile on /dashboard/debt-planner (sum of outstanding loan principals)',
  route: '/dashboard/debt-planner',
  kind: 'AUD',
  canonicalSource: {
    service: MASTER_SERVICE,
    method: MASTER_METHOD,
    fieldPath: 'debt.metrics.totalDebt',
  },
  invokeCanonicalSource: invokeMaster,
  extractRenderedValue: (snap) => {
    const s = snap as MasterSnapshot;
    return s?.debt?.metrics?.totalDebt ?? null;
  },
  renderConditions: { skipWhenNull: true, skipWhenZero: true },
};

export const CASHFLOW_DESCRIPTORS: readonly SurfaceDescriptor[] = [
  cashflowMonthlyTile,
  incomeMonthlyTile,
  expenseMonthlyTile,
  debtTotalTile,
];
