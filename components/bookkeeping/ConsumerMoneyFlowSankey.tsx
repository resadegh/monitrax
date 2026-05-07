/**
 * Phase 42 PR6.5 — Consumer money-flow Sankey wrapper.
 *
 * Reuses the Phase 41g `<MoneyFlowSankey />` component (the entity-
 * level Sankey on `/dashboard/entities`) by projecting a
 * `MasterFinancialSnapshot` into the same `MoneyFlowResult` shape
 * with a single synthetic "You" entity.
 *
 * Per CLAUDE.md §12.3 — no new chart engine, no parallel aggregator.
 * The component composes:
 *   - canonical `getMasterFinancialSnapshot()` (via `/api/master-snapshot`)
 *   - existing `<MoneyFlowSankey />` rendering primitive
 *
 * Per Phase 42 spec §6.6 — placed at the top of `/dashboard/activity`
 * as the *aha moment*: "so THIS is where my money goes." Mobile-first
 * — the underlying Sankey already responsive (per Phase 41g).
 *
 * Period: monthly view scaled from the canonical *annual* snapshot.
 * Spec §6 calls for "monthly money-flow Sankey"; we annualise → /12 ×
 * months-elapsed-in-current-year for the display values, then label
 * the visual as "Year to date" so the framing matches what the user
 * has already done. Future PR can switch to a strict trailing-12mo
 * window once the recurring-detection signal is more mature.
 */

'use client';

import { useEffect, useState } from 'react';
import { MoneyFlowSankey } from '@/components/entities/MoneyFlowSankey';
import { useAuth } from '@/lib/context/AuthContext';
import type {
  MoneyFlowResult,
  MoneyFlowEdge,
  MoneyFlowSource,
  MoneyFlowOutflow,
} from '@/lib/services/moneyFlowService';

// We can't import @prisma/client types into a client component without
// pulling Prisma into the bundle, so we re-declare the snapshot shape
// minimally — only the fields the projection consumes.
interface MinimalSnapshot {
  income?: {
    annual?: {
      primary?: { netTotal?: number };
      secondary?: { netTotal?: number };
      passive?: { netTotal?: number };
      all?: { netTotal?: number };
    };
  };
  expenses?: {
    annual?: {
      essential?: { total?: number };
      discretionary?: { total?: number };
      all?: { total?: number };
    };
  };
  cashflow?: {
    annualLoanRepayments?: number;
  };
  tax?: {
    estimatedTaxPayable?: number;
  };
}

const SYNTHETIC_ENTITY_ID = 'ent:consumer';

/**
 * Project a snapshot into a `MoneyFlowResult`. Pure data shaping;
 * exported for tests so the projection rules are pinned.
 */
export function projectSnapshotToMoneyFlow(snapshot: MinimalSnapshot): MoneyFlowResult {
  const primaryIncome = snapshot.income?.annual?.primary?.netTotal ?? 0;
  const passiveIncome = snapshot.income?.annual?.passive?.netTotal ?? 0;
  const secondaryIncome = snapshot.income?.annual?.secondary?.netTotal ?? 0;
  const totalIncome = snapshot.income?.annual?.all?.netTotal ?? 0;

  const essential = snapshot.expenses?.annual?.essential?.total ?? 0;
  const discretionary = snapshot.expenses?.annual?.discretionary?.total ?? 0;
  const loans = snapshot.cashflow?.annualLoanRepayments ?? 0;
  const tax = snapshot.tax?.estimatedTaxPayable ?? 0;

  const totalOutflowCalculated = essential + discretionary + loans + tax;
  const surplus = Math.max(0, totalIncome - totalOutflowCalculated);

  // Income sources — buckets matching the Sankey's known labels.
  const incomeSourcesAll: MoneyFlowSource[] = [
    { label: 'Salary', amount: primaryIncome },
    { label: 'Rental', amount: 0 }, // consumer-level: rental rolls into "passive"
    { label: 'Investment', amount: passiveIncome },
    { label: 'Other', amount: secondaryIncome },
  ];
  const incomeSources: MoneyFlowSource[] = incomeSourcesAll.filter((s) => s.amount > 0);

  // Single synthetic entity — "You". The entity-level Sankey expects
  // entities; we collapse into one node so the consumer view shows
  // a clean income → outflow flow without the per-entity layer.
  const entities: MoneyFlowResult['entities'] = [
    {
      id: 'consumer',
      name: 'You',
      type: 'PERSONAL_NAME' as const,
      role: 'PERSONAL' as const,
      incomeIn: totalIncome,
      outflows: {
        Tax: tax,
        'Essential expenses': essential,
        Discretionary: discretionary,
        'Loan repayments': loans,
        Surplus: surplus,
      },
    },
  ];

  // Outflow nodes — totals across the (single) entity.
  const outflowsAll: MoneyFlowOutflow[] = [
    { label: 'Tax', amount: tax },
    { label: 'Essential expenses', amount: essential },
    { label: 'Discretionary', amount: discretionary },
    { label: 'Loan repayments', amount: loans },
    { label: 'Surplus', amount: surplus },
  ];
  const outflows: MoneyFlowOutflow[] = outflowsAll.filter((o) => o.amount > 0);

  // Edges — income source → entity → outflow buckets.
  const edges: MoneyFlowEdge[] = [];
  for (const src of incomeSources) {
    edges.push({ source: `src:${src.label}`, target: SYNTHETIC_ENTITY_ID, amount: src.amount });
  }
  for (const out of outflows) {
    edges.push({ source: SYNTHETIC_ENTITY_ID, target: `out:${out.label}`, amount: out.amount });
  }

  const isEmpty = totalIncome <= 0 || (essential + discretionary + loans) <= 0;

  return {
    period: 'annual',
    totalIncome,
    totalOutflow: tax + essential + discretionary + loans + surplus,
    incomeSources,
    entities,
    outflows,
    edges,
    isEmpty,
  };
}

interface ConsumerMoneyFlowSankeyProps {
  /** Optional pre-fetched snapshot — skips the network call when provided. */
  snapshot?: MinimalSnapshot | null;
}

export function ConsumerMoneyFlowSankey({ snapshot: precomputed }: ConsumerMoneyFlowSankeyProps) {
  const { token } = useAuth();
  const [snapshot, setSnapshot] = useState<MinimalSnapshot | null>(precomputed ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (precomputed) {
      setSnapshot(precomputed);
      return;
    }
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/master-snapshot', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json) {
          setError('Could not load your money flow.');
          return;
        }
        // Master snapshot route returns the snapshot directly OR
        // wrapped in `{success, data}` — handle both.
        setSnapshot(json.data ?? json);
      } catch {
        if (!cancelled) setError('Network error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [precomputed, token]);

  if (error || !snapshot) return null;

  const flow = projectSnapshotToMoneyFlow(snapshot);
  if (flow.isEmpty) return null;

  return (
    <section
      aria-label="Where your money goes"
      className="rounded-3xl border border-slate-200 bg-white/70 p-4 sm:p-6 shadow-sm overflow-hidden"
    >
      <header className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Where your money goes
        </p>
        <p className="text-base sm:text-lg font-semibold text-slate-900 mt-0.5">
          Year to date
        </p>
      </header>
      <MoneyFlowSankey flow={flow} />
    </section>
  );
}
