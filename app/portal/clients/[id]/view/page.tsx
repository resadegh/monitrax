/**
 * Phase 32B PR3 — Drill-in canonical client view.
 * Phase 41g — Entity tree + Money Flow Sankey added above the canonical
 *             dashboard as the primary diagnostic. 3-tab toggle:
 *             Structure (default — entity tree) | Money Flow (Sankey)
 *             | Dashboard (the existing ClientCanonicalDashboard).
 *
 * Renders the SAME canonical consumer dashboard for the named client,
 * with an adviser overlay docked right (desktop, ≥md) or as a bottom-
 * sheet (mobile). The page itself is a thin orchestrator — it fetches
 * `/api/portal/clients/[id]/snapshot` (which calls
 * `getMasterFinancialSnapshot()` with a viewerContext, applying the
 * service-layer scope filter and writing the per-view audit row) and
 * hands the snapshot + overlay support data to the canonical primitives.
 *
 * Phase 41g adds two parallel fetches:
 *   - `/api/portal/clients/[id]/entities` → entity tree + members
 *   - `/api/portal/clients/[id]/money-flow` → Sankey data
 * Both routes use `verifyAdviserClientAccess` so the same consent +
 * membership + role + assignment guard applies. Snapshot endpoint
 * already wrote the `PRO_DASHBOARD_VIEW` audit row for this view
 * session — entities/money-flow piggyback (no audit row spam).
 *
 * Per Phase 32B hard constraints (CLAUDE.md §0 architect lens):
 *   - One canonical engine — viewerContext is a parameter, not a fork
 *   - Scope filter at the service layer, not the UI
 *   - Three-layer consent model preserved (CDR / professional / per-view)
 *   - No `mode: 'professional'` conditional inside `app/dashboard/*`
 */

'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { TreePine, TrendingUp, LayoutDashboard } from 'lucide-react';
import type { OrganizationType, DataAccessScope } from '@prisma/client';
import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import type { PortalClient, ClientNote, ClientTask } from '@/lib/portal/types';
import type { MoneyFlowResult } from '@/lib/services/moneyFlowService';
import type { Entity, HouseholdMember } from '@/components/entities/types';
import { ClientCanonicalDashboard } from '@/components/portal/clients/ClientCanonicalDashboard';
import { AdviserOverlay } from '@/components/portal/clients/AdviserOverlay';
import { EntityTree } from '@/components/entities/EntityTree';
import { MoneyFlowSankey } from '@/components/entities/MoneyFlowSankey';

interface SnapshotResponse {
  success: boolean;
  data?: {
    snapshot: MasterFinancialSnapshot;
    organizationClientId: string;
    client: PortalClient | null;
    notes: ClientNote[];
    tasks: ClientTask[];
    lastReviewedAt: string | null;
    organization: { name: string; profession: OrganizationType } | null;
  };
  error?: { code: string; message: string };
}

interface EntitiesResponse {
  success: boolean;
  data?: { entities: Entity[]; members: HouseholdMember[] };
  error?: { code: string; message: string };
}

interface MoneyFlowResponse {
  success: boolean;
  data?: MoneyFlowResult;
  error?: { code: string; message: string };
}

type DrillInTab = 'structure' | 'flow' | 'dashboard';

export default function ClientDrillInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<SnapshotResponse['data'] | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [flow, setFlow] = useState<MoneyFlowResult | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Phase 41g: tab state lives at the page level. Default to 'structure'
  // — the entity tree is the *primary diagnostic* per the brief, and
  // it's the moat moment in the lighthouse pitch (Step 3). Adviser
  // clicks 'Money Flow' for Step 4, 'Dashboard' for the canonical
  // consumer view (Step 2's drill-in body).
  const [tab, setTab] = useState<DrillInTab>('structure');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        // Phase 41g: parallel fetch of snapshot + entities + money-flow.
        // All three routes share the same `verifyAdviserClientAccess`
        // guard, so any failure on the OrganizationClient layer fails
        // identically across all three. Snapshot is treated as the
        // primary load (its failure blocks the page); entities + flow
        // failures are tracked but the page still renders the dashboard.
        const [snapshotRes, entitiesRes, flowRes] = await Promise.all([
          fetch(`/api/portal/clients/${id}/snapshot`, { headers, credentials: 'include' }),
          fetch(`/api/portal/clients/${id}/entities`, { headers, credentials: 'include' }),
          fetch(`/api/portal/clients/${id}/money-flow`, { headers, credentials: 'include' }),
        ]);
        const snapshotJson = (await snapshotRes.json()) as SnapshotResponse;
        if (cancelled) return;
        if (!snapshotJson.success || !snapshotJson.data) {
          setError(
            snapshotJson.error ?? { code: 'UNKNOWN', message: 'Failed to load client view' },
          );
          return;
        }
        setData(snapshotJson.data);

        // Entities + flow are best-effort — if either 4xx/5xx the
        // corresponding tab will surface its own empty state (the
        // EntityTree handles zero entities; MoneyFlowSankey handles
        // isEmpty). Failure here doesn't block the dashboard tab.
        if (entitiesRes.ok) {
          const entitiesJson = (await entitiesRes.json()) as EntitiesResponse;
          if (entitiesJson.success && entitiesJson.data) {
            setEntities(entitiesJson.data.entities);
            setMembers(entitiesJson.data.members);
          }
        }
        if (flowRes.ok) {
          const flowJson = (await flowRes.json()) as MoneyFlowResponse;
          if (flowJson.success && flowJson.data) {
            setFlow(flowJson.data);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError({
            code: 'NETWORK',
            message: err instanceof Error ? err.message : 'Failed to load',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading client view…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/portal/clients" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to clients
        </Link>
        <div className="mt-6 rounded-2xl bg-rose-50 border border-rose-200 p-6">
          <p className="font-semibold text-rose-900">Cannot view this client</p>
          <p className="text-sm text-rose-700 mt-2">{error.message}</p>
          {error.code === 'CONSENT_NOT_GRANTED' && (
            <p className="text-xs text-rose-600 mt-3">
              Send a consent request from the client list to begin reviewing their data.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!data || !data.client || !data.organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-500">No data available.</p>
      </div>
    );
  }

  const appliedScopes: DataAccessScope[] = data.snapshot.viewer?.accessScopes ?? data.client.accessScopes;
  const appliedScopeFilter = data.snapshot.viewer?.appliedScopeFilter ?? false;

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 pb-24 md:pb-10 max-w-7xl mx-auto">
      {/* Sticky page header — keeps the back link + client identity visible while scrolling */}
      <header className="flex items-start justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <Link
            href="/portal/clients"
            className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
          >
            ← Clients
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            {data.client.user?.name ?? 'Unknown client'}
          </h1>
          <p className="text-sm text-slate-500">{data.client.user?.email}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-slate-500">{data.organization.name}</p>
          <p className="text-xs text-slate-400 mt-1">
            Calculated {new Date(data.snapshot.calculatedAt).toLocaleString('en-AU', {
              hour: 'numeric',
              minute: '2-digit',
              day: 'numeric',
              month: 'short',
            })}
          </p>
        </div>
      </header>

      {/* Phase 41g: tab toggle — Structure (entity tree, default), Money
          Flow (Sankey), Dashboard (the existing canonical view).
          Default is Structure because the entity tree is the *primary
          diagnostic* the adviser wants to see first; the canonical
          dashboard is one click away when they need detail. */}
      <div
        role="tablist"
        aria-label="Drill-in views"
        className="inline-flex items-center gap-1 mb-5 rounded-full border border-slate-200/70 bg-white/70 p-1 text-sm shadow-sm ring-1 ring-slate-900/[0.04] backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/70"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'structure'}
          onClick={() => setTab('structure')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${
            tab === 'structure'
              ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
          }`}
        >
          <TreePine className="h-3.5 w-3.5" />
          Structure
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'flow'}
          onClick={() => setTab('flow')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${
            tab === 'flow'
              ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Money Flow
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'dashboard'}
          onClick={() => setTab('dashboard')}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${
            tab === 'dashboard'
              ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
          }`}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Dashboard
        </button>
      </div>

      <div className="md:flex md:gap-8 md:items-start">
        <main className="flex-1 min-w-0">
          {/* Phase 41g: Structure tab — entity tree as primary diagnostic.
              The adviser sees the client's structure FIRST, then drills
              into specific assets via the tile-click → consumer dashboard
              route (Money Flow + Dashboard tabs). Read-only here:
              `onEntityClick` is a no-op (advisers can't edit a client's
              structure; they request changes via Ask-a-Pro / consent),
              and `onAdd` similarly opens the same explainer copy. */}
          {tab === 'structure' && (
            <div className="space-y-4">
              <EntityTree
                entities={entities}
                members={members}
                onEntityClick={() => {
                  /* Read-only in adviser view — Phase 41 doesn't yet allow
                     advisers to edit a client's entity layer. Future:
                     surface a 'Suggest a structural change' affordance
                     that opens an Ask-a-Pro thread. */
                }}
                onAdd={() => {
                  /* Read-only — see comment above. */
                }}
              />
              {entities.length === 0 && (
                <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                  This client hasn&rsquo;t added any structure yet. Their wealth is
                  held in their personal name.
                </p>
              )}
            </div>
          )}

          {/* Phase 41g: Money Flow tab — same Sankey the consumer page
              renders, populated with the client's data. Empty state is
              handled by MoneyFlowSankey itself. */}
          {tab === 'flow' && (
            <>
              {flow ? (
                <MoneyFlowSankey flow={flow} />
              ) : (
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-8 text-center text-sm text-slate-500 dark:border-slate-700/50 dark:bg-slate-900/70 dark:text-slate-400">
                  No money flow data available for this client yet.
                </div>
              )}
            </>
          )}

          {/* Dashboard tab — the canonical consumer view (32B PR3). */}
          {tab === 'dashboard' && (
            <ClientCanonicalDashboard
              snapshot={data.snapshot}
              appliedScopes={appliedScopes}
            />
          )}
        </main>
        <AdviserOverlay
          client={data.client}
          notes={data.notes}
          tasks={data.tasks}
          appliedScopes={appliedScopes}
          appliedScopeFilter={appliedScopeFilter}
          profession={data.organization.profession}
          lastReviewedAt={data.lastReviewedAt}
        />
      </div>
    </div>
  );
}
