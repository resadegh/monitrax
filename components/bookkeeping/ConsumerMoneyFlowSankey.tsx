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
        // A consumer collapses to one synthetic entity — there are no
        // inter-entity distributions to record (Phase 44 Part 2d).
        Distributions: 0,
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
    // Consumer view has no inter-entity distributions (Phase 44 Part 2d).
    distributions: [],
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
      {/* Phase 42 PR6.5h — mobile vs desktop fork.
          Sankey diagrams need horizontal width to be readable; on
          mobile the labels overlap and bands compress to invisible.
          Per Reza directive 2026-05-08 — hide the Sankey on
          mobile and show a clean vertical breakdown instead. The
          Sankey returns above `sm:` where the canvas has room. */}
      <div className="hidden sm:block">
        <MoneyFlowSankey flow={flow} />
      </div>
      <div className="sm:hidden">
        <MobileMoneyFlowSummary flow={flow} />
      </div>
    </section>
  );
}

/**
 * Phase 42 PR6.5h — Mobile money-flow summary.
 *
 * Vertical alternative to the desktop Sankey. Renders income
 * total at the top, then a colour-coded list of outflows
 * (amount + horizontal proportional bar + share %). Reads cleanly
 * at mobile widths where the Sankey's horizontal layout collapses.
 *
 * Per CLAUDE.md §12.3 — composes the same `flow` shape the Sankey
 * consumes; no new data path. Pure presentation.
 */
function MobileMoneyFlowSummary({ flow }: { flow: MoneyFlowResult }) {
  const { totalIncome, outflows } = flow;
  // Sort outflows largest-first so the user sees their biggest
  // category at the top (the financial-adviser lens — surface what
  // matters most for tax-pack accuracy first).
  const sortedOutflows = [...outflows].sort((a, b) => b.amount - a.amount);

  const fmtAUD = (n: number) =>
    Math.abs(n).toLocaleString('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    });

  // Mirror the desktop Sankey's outflow palette so the colour
  // language stays consistent across breakpoints.
  const colorByLabel: Record<string, string> = {
    Tax: 'bg-rose-500',
    'Essential expenses': 'bg-orange-500',
    Discretionary: 'bg-amber-500',
    'Loan repayments': 'bg-violet-500',
    Surplus: 'bg-emerald-500',
  };

  return (
    <div className="space-y-3">
      {/* Income headline */}
      <div className="rounded-2xl bg-slate-50 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Total income
        </p>
        <p className="text-2xl font-semibold tabular-nums text-slate-900 mt-0.5">
          {fmtAUD(totalIncome)}
        </p>
      </div>

      {/* Outflows list — proportional bars */}
      <ul className="space-y-2.5">
        {sortedOutflows.map((o) => {
          const pct = totalIncome > 0 ? (o.amount / totalIncome) * 100 : 0;
          const bar = colorByLabel[o.label] ?? 'bg-slate-400';
          return (
            <li key={o.label}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-sm font-medium text-slate-900 truncate">
                  {o.label}
                </span>
                <span className="text-sm font-semibold tabular-nums text-slate-900 shrink-0">
                  {fmtAUD(o.amount)}
                  <span className="ml-1.5 text-xs font-normal text-slate-500">
                    {pct.toFixed(0)}%
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${bar} transition-all`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                  aria-hidden
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
