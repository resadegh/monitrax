'use client';

/**
 * M3.4 — the v1 SCOREBOARD (D-16) rendered from the D-19 tile registry.
 *
 * A NEW client, deliberately NOT composed from HomeClient's widgets (the
 * plan's M3.4 build rule): every tile reads a KEPT engine —
 *   portfolio        → /api/portfolio/snapshot (netWorth · property value · LVR)
 *   property-cashflow→ /api/properties rows through computePropertyCashflow
 *                      (the ONE per-property cashflow engine — same as the
 *                      properties list + detail pages; screens only read)
 *   eofy-readiness   → the D-12 pack's reconciliation block (M3 PR-1) —
 *                      "N rows aren't tax-ready yet → review". MON-180: in the
 *                      EOFY season an empty current FY defers to the just-ended
 *                      FY window (rule in lib/dashboard/scoreboardDisplay.ts)
 *   documents-status → /api/documents count
 *   intake-queue     → /api/unified-transactions/review-queue, medium+low
 *                      bands summed (MON-181 — the route requires a band)
 *
 * Stage tiles are registered DARK in lib/dashboard/tileRegistry.ts and render
 * here as link tiles the moment their module flips — no deploy. The
 * visibility law (isTileVisible) is the ONLY gate consulted; this component
 * never re-derives module state.
 *
 * NOTE on the portfolio tile's third figure: the brief's parenthetical said
 * "value · equity · LVR", but the snapshot API exposes no portfolioEquity
 * field and deriving it here would mint a second producer (§12.2.1 — the
 * canonical per-property equity lives on the properties page). The tile
 * renders netWorth (a direct snapshot field) instead; surfaced in the PR for
 * Reza's call.
 *
 * Design: in-app glass vocabulary (§18.7.2 polished-tile recipe). Stitch
 * artefact: BACKFILL DUE per §18.2.1 — recorded in the PR + plan; the
 * MODULE_HOME acceptance pass is the natural moment.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { useEnabledModules } from '@/lib/featureFlags/ModuleGateContext';
import {
  TILE_REGISTRY,
  isTileVisible,
  type TileDef,
  type TileId,
} from '@/lib/dashboard/tileRegistry';
import { computePropertyCashflow } from '@/lib/calculations/propertyCashflow';
import {
  auFyLabel,
  auFyStartYear,
  isEofySeason,
  orderStripWorstFirst,
  resolveEofyTileState,
  type EofyTileState,
  type EofyWindowSlice,
} from '@/lib/dashboard/scoreboardDisplay';
import { formatCurrency } from '@/lib/utils/formatters';
import { LoadFailedState } from '@/components/ui/LoadFailedState';

interface SnapshotSlice {
  netWorth: number;
  propertyValue: number;
  propertyCount: number;
  portfolioLVR: number;
}

interface PropertyRow {
  id: string;
  name: string;
  type: string;
  income?: unknown[];
  expenses?: unknown[];
  loans?: unknown[];
  linkedTransactions?: unknown[];
}

interface ScoreboardData {
  snapshot: SnapshotSlice | null;
  properties: PropertyRow[];
  eofy: EofyTileState;
  documentsCount: number | null;
  intakeCount: number | null;
}

export default function ScoreboardClient() {
  const { token } = useAuth();
  const enabledModules = useEnabledModules();
  const [suppressed, setSuppressed] = useState<ReadonlySet<string>>(new Set());
  const [data, setData] = useState<ScoreboardData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(false);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      // MON-180 (§C-1): during the EOFY work season (Jul–Oct) the tile also
      // reads the JUST-ENDED FY via the export route's existing ?fy= param —
      // same producer, second window — so an empty new FY can't render a
      // vacuous "all tax-ready" while last year's rows still need review.
      const now = new Date();
      const justEndedFy = auFyLabel(auFyStartYear(now) - 1);

      // Each fetch degrades independently — one slow feed must not blank the
      // scoreboard; only total failure shows LoadFailedState.
      // MON-181 (§C-2): the review-queue route REQUIRES band=medium|low (400s
      // otherwise), so the tile fetches BOTH bands and sums — same route, no
      // second producer.
      const [snapshotRes, propertiesRes, packRes, packPrevRes, documentsRes, intakeMedRes, intakeLowRes, flagsRes] =
        await Promise.allSettled([
          fetch('/api/portfolio/snapshot', { headers }),
          fetch('/api/properties', { headers }),
          fetch('/api/bookkeeping/tax-pack/export?format=json', { headers }),
          isEofySeason(now)
            ? fetch(`/api/bookkeeping/tax-pack/export?format=json&fy=${justEndedFy}`, { headers })
            : Promise.reject(new Error('out of EOFY season — just-ended window not fetched')),
          fetch('/api/documents?limit=1', { headers }),
          fetch('/api/unified-transactions/review-queue?band=medium', { headers }),
          fetch('/api/unified-transactions/review-queue?band=low', { headers }),
          fetch('/api/feature-flags/modules', { headers, cache: 'no-store' }),
        ]);

      const json = async (r: PromiseSettledResult<Response>) =>
        r.status === 'fulfilled' && r.value.ok ? r.value.json() : null;

      const snapshotJson = await json(snapshotRes);
      const propertiesJson = await json(propertiesRes);
      const packJson = await json(packRes);
      const packPrevJson = await json(packPrevRes);
      const documentsJson = await json(documentsRes);
      const intakeMedJson = await json(intakeMedRes);
      const intakeLowJson = await json(intakeLowRes);
      const flagsJson = await json(flagsRes);

      if (flagsJson?.suppressedTiles) setSuppressed(new Set(flagsJson.suppressedTiles));

      const eofySlice = (packPayload: unknown): EofyWindowSlice | null => {
        const summary = (packPayload as { data?: { window?: { label?: string }; reconciliation?: {
          transactionsTotal?: number;
          included?: { count?: number };
          atoLabelling?: { noCategory?: { count?: number }; noAtoMapping?: { count?: number } };
        } } } | null)?.data;
        const rec = summary?.reconciliation;
        if (!rec) return null;
        return {
          fyLabel: summary?.window?.label ?? '',
          notReadyCount:
            (rec.atoLabelling?.noCategory?.count ?? 0) +
            (rec.atoLabelling?.noAtoMapping?.count ?? 0),
          includedCount: rec.included?.count ?? 0,
          transactionsTotal: rec.transactionsTotal ?? 0,
        };
      };

      const intakeMedItems = intakeMedJson?.data?.items;
      const intakeLowItems = intakeLowJson?.data?.items;
      const next: ScoreboardData = {
        snapshot: snapshotJson
          ? {
              netWorth: snapshotJson.netWorth ?? 0,
              propertyValue: snapshotJson.assets?.properties?.totalValue ?? 0,
              propertyCount: snapshotJson.assets?.properties?.count ?? 0,
              portfolioLVR: snapshotJson.gearing?.portfolioLVR ?? 0,
            }
          : null,
        properties: propertiesJson?.data ?? [],
        eofy: resolveEofyTileState({
          now,
          current: eofySlice(packJson),
          justEnded: eofySlice(packPrevJson),
        }),
        documentsCount:
          documentsJson?.pagination?.total ??
          documentsJson?.total ??
          (Array.isArray(documentsJson?.documents) ? documentsJson.documents.length : null),
        // A real 0 renders as 0; '—' only when BOTH band fetches genuinely failed.
        intakeCount:
          Array.isArray(intakeMedItems) || Array.isArray(intakeLowItems)
            ? (Array.isArray(intakeMedItems) ? intakeMedItems.length : 0) +
              (Array.isArray(intakeLowItems) ? intakeLowItems.length : 0)
            : null,
      };
      const allFailed =
        !next.snapshot && next.properties.length === 0 && next.eofy.kind === 'unavailable' &&
        next.documentsCount === null && next.intakeCount === null;
      if (allFailed) {
        setLoadError(true);
      } else {
        setData(next);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const visibleTiles = TILE_REGISTRY.filter((t) => isTileVisible(t, enabledModules, suppressed));
  const visibleIds = new Set<TileId>(visibleTiles.map((t) => t.id));
  const stageTiles = visibleTiles.filter((t) => t.requires !== null);

  if (loadError) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
          <LoadFailedState what="your scoreboard" onRetry={fetchAll} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Your scoreboard
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleIds.has('portfolio') && (
          <ScoreTile
            href="/dashboard/properties"
            eyebrow="Portfolio"
            accent="from-sky-400 to-indigo-500"
            loading={loading}
          >
            <BigNumber label="Property value" value={formatCurrency(data?.snapshot?.propertyValue ?? 0)} />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MiniStat label="Portfolio LVR" value={`${(data?.snapshot?.portfolioLVR ?? 0).toFixed(1)}%`} />
              <MiniStat
                label="Net worth"
                value={formatCurrency(data?.snapshot?.netWorth ?? 0)}
                testId="scoreboard-net-worth"
              />
            </div>
          </ScoreTile>
        )}

        {visibleIds.has('property-cashflow') && (
          <ScoreTile
            href="/dashboard/properties"
            eyebrow="Per-property cashflow"
            accent="from-teal-400 to-cyan-500"
            loading={loading}
          >
            {data && data.properties.length === 0 ? (
              <EmptyLine text="Add your first property to see its cashflow here." />
            ) : (
              <ul className="space-y-2">
                {/* MON-183 (§C-4): ALL properties render — no silent cap —
                    ordered worst monthly figure first (orderStripWorstFirst). */}
                {orderStripWorstFirst(
                  (data?.properties ?? []).map((p) => {
                    // The ONE engine — identical inputs to the properties list page.
                    const cf = computePropertyCashflow({
                      income: (p.income ?? []) as never,
                      expenses: (p.expenses ?? []) as never,
                      loans: (p.loans ?? []) as never,
                      transactions: (p.linkedTransactions ?? []) as never,
                    });
                    return { id: p.id, name: p.name, monthly: cf.monthlyCashflow };
                  })
                ).map(({ id, name, monthly }) => (
                  <li key={id} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm text-muted-foreground">{name}</span>
                    <span
                      className={`tabular-nums text-sm font-semibold ${
                        monthly >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'
                      }`}
                    >
                      {monthly >= 0 ? '+' : ''}
                      {formatCurrency(monthly)}/mo
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ScoreTile>
        )}

        {visibleIds.has('eofy-readiness') && (
          <ScoreTile
            href="/dashboard/reports"
            eyebrow={`EOFY readiness${eofyLabelOf(data?.eofy) ? ` · ${eofyLabelOf(data?.eofy)}` : ''}`}
            accent="from-amber-400 to-orange-500"
            loading={loading}
          >
            <EofyTileBody state={data?.eofy ?? { kind: 'unavailable' }} />
          </ScoreTile>
        )}

        {visibleIds.has('documents-status') && (
          <ScoreTile
            href="/dashboard/documents"
            eyebrow="Documents & evidence"
            accent="from-violet-400 to-purple-500"
            loading={loading}
          >
            <BigNumber
              label="In the vault"
              value={data?.documentsCount === null || data?.documentsCount === undefined ? '—' : String(data.documentsCount)}
            />
          </ScoreTile>
        )}

        {visibleIds.has('intake-queue') && (
          <ScoreTile
            href="/dashboard/activity"
            eyebrow="Intake queue"
            accent="from-rose-400 to-pink-500"
            loading={loading}
          >
            <BigNumber
              label="Waiting for your confirm"
              value={data?.intakeCount === null || data?.intakeCount === undefined ? '—' : String(data.intakeCount)}
            />
          </ScoreTile>
        )}

        {stageTiles.map((t) => (
          <StageLinkTile key={t.id} tile={t} />
        ))}
      </div>
    </div>
    </DashboardLayout>
  );
}

/* ── presentational pieces (glass vocabulary, §18.7.2) ──────────────────── */

function eofyLabelOf(state: EofyTileState | undefined): string {
  if (!state) return '';
  if (state.kind === 'lead-just-ended' || state.kind === 'current') return state.slice.fyLabel;
  if (state.kind === 'no-rows-yet') return state.fyLabel;
  return '';
}

/**
 * MON-180 (§C-1) render states. The season/lead rule itself lives in
 * lib/dashboard/scoreboardDisplay.ts (resolveEofyTileState) — this component
 * only renders the resolved state.
 */
function EofyTileBody({ state }: { state: EofyTileState }) {
  switch (state.kind) {
    case 'lead-just-ended':
    case 'current': {
      const s = state.slice;
      const yearWord = state.kind === 'lead-just-ended' ? 'last FY' : 'this year';
      return s.notReadyCount > 0 ? (
        <>
          <BigNumber label="Rows not tax-ready yet" value={String(s.notReadyCount)} />
          <p className="mt-2 text-xs text-muted-foreground">
            Of {s.includedCount} property rows {yearWord} — review before the pack.
          </p>
        </>
      ) : (
        <>
          <BigNumber label="Tax-ready" value="All rows" />
          <p className="mt-2 text-xs text-muted-foreground">
            Every property row {yearWord} reaches an ATO label.
          </p>
        </>
      );
    }
    case 'no-rows-yet':
      return <EmptyLine text="No property rows yet this FY." />;
    case 'unavailable':
      return <EmptyLine text="The readiness check appears once transactions are in." />;
  }
}

function ScoreTile({
  href,
  eyebrow,
  accent,
  loading,
  children,
}: {
  href: string;
  eyebrow: string;
  accent: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[22px] border border-foreground/10 bg-card/70 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_36px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-transform hover:-translate-y-0.5 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]"
    >
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${accent}`}
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {eyebrow}
      </p>
      <div className={`mt-3 ${loading ? 'opacity-50' : ''}`}>{children}</div>
    </Link>
  );
}

function StageLinkTile({ tile }: { tile: TileDef }) {
  return (
    <Link
      href={tile.href}
      className="group relative overflow-hidden rounded-[22px] border border-foreground/10 bg-card/70 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-transform hover:-translate-y-0.5 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {tile.label}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{tile.description}</p>
      <p className="mt-3 text-sm font-medium text-foreground group-hover:underline">Open →</p>
    </Link>
  );
}

function BigNumber({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="tabular-nums text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function MiniStat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-[12px] border border-foreground/10 bg-background/50 px-3 py-2">
      <p className="tabular-nums text-sm font-semibold text-foreground" data-testid={testId}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
