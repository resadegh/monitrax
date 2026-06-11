/**
 * Phase 42 PR6.5 — Consumer money-flow card.
 *
 * Reuses the Phase 41g `<MoneyFlowSankey />` rendering primitive by
 * projecting a `MasterFinancialSnapshot` into the same `MoneyFlowResult`
 * shape with a single synthetic "You" entity.
 *
 * Per CLAUDE.md §12.3 — no new chart engine, no parallel aggregator.
 * The component composes:
 *   - canonical `getMasterFinancialSnapshot()` (via `/api/master-snapshot`)
 *   - existing `<MoneyFlowSankey />` rendering primitive (opt-in "flow detail")
 *
 * Phase 49.2 (2026-06-11) — redesigned to the §18.7.2 glass vocabulary.
 * Default view is now a modern Apple-Health-style DONUT + legend (the old
 * grey Sankey read dated against the rest of the page). The Sankey is kept
 * as an opt-in behind "View flow detail". Stitch-first per §18:
 * project 1859462351962811110, screens 6b3ab0e0b5494d109d6954e781a1fd27
 * (desktop light) / 7b9c9445bd364b42b972ad19cbea3319 (desktop dark) /
 * 86078d1815a54d68a6f0f198732cf25c (mobile light); artefacts
 * .stitch/designs/money-flow-redesign/.
 *
 * Donut = the gestalt (proportions at a glance, Surplus the emerald hero);
 * legend = the precision (exact amounts + %). Center celebrates what's KEPT
 * (behaviour-psychology lens — anchor on achievement, not leakage).
 *
 * Period: values come from the canonical *annual* snapshot, labelled
 * "Year to date" to match the framing the user has already seen.
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

  const [showDetail, setShowDetail] = useState(false);

  if (error || !snapshot) return null;

  const flow = projectSnapshotToMoneyFlow(snapshot);
  if (flow.isEmpty) return null;

  const { totalIncome, outflows } = flow;
  // Legend rows largest-first (financial-adviser lens — biggest first), with
  // Surplus always rendered last as the celebrated hero regardless of size.
  const rows = [...outflows]
    .filter((o) => o.label !== 'Surplus')
    .sort((a, b) => b.amount - a.amount);
  const surplus = outflows.find((o) => o.label === 'Surplus');
  const surplusAmount = surplus?.amount ?? 0;
  const keptPct = totalIncome > 0 ? Math.round((surplusAmount / totalIncome) * 100) : 0;
  const orderedForDonut = surplus ? [...rows, surplus] : rows;

  return (
    <section
      aria-label="Where your money goes"
      className="relative overflow-hidden rounded-[28px] border border-foreground/10 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]"
    >
      {/* 3px sky→indigo top-accent + curved-glass highlight (§18.7.2) */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 to-indigo-500" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-[3px] h-[30%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" aria-hidden />

      <div className="relative p-5 sm:p-6">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Where your money goes
            </p>
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight mt-0.5">Year to date</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur transition hover:text-foreground hover:border-foreground/25 shrink-0"
            aria-expanded={showDetail}
          >
            {showDetail ? 'Hide flow detail' : 'View flow detail'}
            <span aria-hidden>{showDetail ? '⌃' : '›'}</span>
          </button>
        </header>

        {showDetail ? (
          // Opt-in: the original Sankey (desktop) / vertical bars (mobile).
          <>
            <div className="hidden sm:block">
              <MoneyFlowSankey flow={flow} />
            </div>
            <div className="sm:hidden">
              <MobileMoneyFlowSummary flow={flow} />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
            {/* Donut */}
            <MoneyDonut
              segments={orderedForDonut}
              total={totalIncome}
              keptPct={keptPct}
              surplusAmount={surplusAmount}
            />
            {/* Legend */}
            <div className="w-full sm:flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Total income{' '}
                <span className="text-foreground tabular-nums">{fmtAUD0(totalIncome)}</span>
                <span className="text-muted-foreground"> / year</span>
              </p>
              <ul>
                {orderedForDonut.map((o) => {
                  const meta = SEGMENT_META[o.label] ?? FALLBACK_META;
                  const pct = totalIncome > 0 ? (o.amount / totalIncome) * 100 : 0;
                  const isSurplus = o.label === 'Surplus';
                  return (
                    <li
                      key={o.label}
                      className={`flex items-center gap-3 border-b border-foreground/5 py-2.5 last:border-0 ${
                        isSurplus ? '-mx-2 rounded-lg bg-emerald-500/[0.06] px-2' : ''
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.swatch}`} aria-hidden />
                      <span
                        className={`flex-1 text-sm ${
                          isSurplus ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'text-foreground'
                        }`}
                      >
                        {meta.display}
                      </span>
                      <span
                        className={`text-sm tabular-nums ${
                          isSurplus ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'text-foreground'
                        }`}
                      >
                        {fmtAUD0(o.amount)}
                      </span>
                      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                        {pct.toFixed(0)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {!showDetail && (
          <p className="mt-4 text-center text-xs text-muted-foreground/80">
            You keep {keptPct}% of what you earn — every dollar of surplus is future freedom.
          </p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Donut + segment metadata (Phase 49.2)
// ---------------------------------------------------------------------------

const fmtAUD0 = (n: number) =>
  Math.abs(n) >= 1000
    ? `$${Math.round(Math.abs(n) / 1000).toLocaleString('en-AU')}K`
    : Math.abs(n).toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

/**
 * Per-outflow visual metadata. `swatch` = legend dot colour;
 * `stroke` = donut arc colour (Tailwind text class + stroke=currentColor so
 * dark-mode variants apply). TRAIL palette per §18.7.2.
 */
const SEGMENT_META: Record<string, { display: string; swatch: string; stroke: string }> = {
  'Loan repayments': { display: 'Loans', swatch: 'bg-sky-500', stroke: 'text-sky-500 dark:text-sky-400' },
  'Essential expenses': { display: 'Essentials', swatch: 'bg-amber-500', stroke: 'text-amber-500 dark:text-amber-400' },
  Tax: { display: 'Tax', swatch: 'bg-rose-500', stroke: 'text-rose-500 dark:text-rose-400' },
  Discretionary: { display: 'Discretionary', swatch: 'bg-violet-500', stroke: 'text-violet-500 dark:text-violet-400' },
  Surplus: { display: 'Surplus', swatch: 'bg-emerald-500', stroke: 'text-emerald-500 dark:text-emerald-400' },
};
const FALLBACK_META = { display: 'Other', swatch: 'bg-slate-400', stroke: 'text-slate-400' };

/**
 * Inline-SVG donut — no chart-library dependency (§12.7 simplicity).
 * Arcs drawn via stroke-dasharray on stacked circles; rounded caps; small
 * gaps between segments. The emerald Surplus arc is thicker for emphasis.
 * Center celebrates the KEPT %.
 */
function MoneyDonut({
  segments,
  total,
  keptPct,
  surplusAmount,
}: {
  segments: MoneyFlowOutflow[];
  total: number;
  keptPct: number;
  surplusAmount: number;
}) {
  const size = 180;
  const stroke = 22;
  const r = (size - stroke) / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const GAP = 2; // px gap between segments

  let offset = 0;
  const arcs = segments
    .filter((s) => s.amount > 0)
    .map((s) => {
      const frac = total > 0 ? s.amount / total : 0;
      const len = Math.max(0, frac * C - GAP);
      const meta = SEGMENT_META[s.label] ?? FALLBACK_META;
      const isSurplus = s.label === 'Surplus';
      const arc = {
        key: s.label,
        len,
        offset,
        stroke: meta.stroke,
        width: isSurplus ? stroke + 4 : stroke,
        glow: isSurplus,
      };
      offset += frac * C;
      return arc;
    });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* track */}
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={stroke} className="text-foreground/5" stroke="currentColor" />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={a.width}
            strokeLinecap="round"
            strokeDasharray={`${a.len} ${C - a.len}`}
            strokeDashoffset={-a.offset}
            className={a.stroke}
            style={a.glow ? { filter: 'drop-shadow(0 0 5px rgba(16,163,74,0.45))' } : undefined}
          />
        ))}
      </svg>
      {/* center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Kept</span>
        <span className="text-3xl font-semibold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
          {keptPct}%
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">{fmtAUD0(surplusAmount)} surplus</span>
      </div>
    </div>
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
