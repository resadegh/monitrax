/**
 * Phase 32-design-A1 — Practice dashboard rebuilt against the shared
 * shell layer (`components/shell/*`).
 *
 * Hero: GlassHero with sky/indigo atmosphere, Apple-spring entry,
 * gradient-text headline (active client count), KPI grid (need-attention /
 * TRAIL advanced / avg health). Slow-breathing background glow.
 *
 * Below the hero: three click-through MetricTiles — Active Clients,
 * Need Attention, Conversations — each with a tone-appropriate
 * filled-silhouette glyph watermark and Apple-spring hover lift.
 *
 * Below the tiles: PracticeAlertStream + PracticeClientBookTable
 * preserved unchanged. Those surfaces are dense data (Linear-style)
 * and stay outside the glass redesign by design — see CLAUDE.md
 * §16 design-alignment recommendation.
 *
 * Reza directive 2026-05-04: skip the demo-mode profession switcher,
 * build the complete capabilities. Pitch happens against the real app
 * populated with realistic seeded users, not a demo skin.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OrganizationType } from '@prisma/client';
import { MessageSquarePlus } from 'lucide-react';
import Link from 'next/link';
import {
  PracticeAlertStream,
  PracticeClientBookTable,
  type AlertClientSummary,
} from '@/components/portal/practice';
import {
  GlassHero,
  GlassHeroEyebrow,
  GlassHeroHeadline,
  GlassHeroKpiCell,
  MetricTile,
  MetricTileHeadline,
  ClientsGlyph,
  RequestsGlyph,
  ConversationsGlyph,
} from '@/components/shell';
import {
  LIGHTHOUSE_CLIENTS,
  LIGHTHOUSE_ALERTS,
  computeKpis,
  getPracticeProfessionConfig,
  type DemoAlert,
} from '@/lib/portal/practice';
import { useOrganization } from '@/lib/portal';

interface RealKpis {
  activeClients: number;
  needsAttention: number;
  trailAdvancedThisWeek: number;
  averageHealth: number;
  averageHealthDelta: number;
}
interface RealClientSummary {
  id: string;
  name: string;
  initials: string;
  trailStage: string | null;
  healthScore: number | null;
  healthDelta: number | null;
  activeAlertCount: number;
}
interface ClientSummaryResponse {
  hasRealClients: boolean;
  lastSweptAt: string | null;
  kpis: RealKpis;
  clients: RealClientSummary[];
}

export default function PortalDashboardPage() {
  const router = useRouter();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  // Phase 32B PR3 #9b + post-#9b polish part 2 — the Practice dashboard
  // shows EITHER your real book OR the LIGHTHOUSE demo preview, never a
  // half-and-half. The master switch is `GET /api/portal/clients`'s
  // `hasRealClients` (true once the alert sweep has computed a health
  // score for at least one of the org's active clients — run it via
  // /admin/scheduler before the Cloud Scheduler job is wired). When real:
  // hero KPIs, the alert stream (even if empty → genuine "all quiet"),
  // and the client book all come from real data. When not: the fixture.
  const [clientSummary, setClientSummary] = useState<ClientSummaryResponse | null>(null);
  const [realAlerts, setRealAlerts] = useState<DemoAlert[] | null>(null);
  const [realAlertClients, setRealAlertClients] = useState<AlertClientSummary[]>([]);

  const refetchAlerts = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/portal/alerts?organizationId=${encodeURIComponent(orgId)}`);
      if (!res.ok) return;
      const j = (await res.json()) as {
        success?: boolean;
        data?: { alerts: DemoAlert[]; clients: AlertClientSummary[] };
      };
      if (!j?.success || !j.data) return;
      setRealAlerts(j.data.alerts);
      setRealAlertClients(j.data.clients);
    } catch {
      // Silent — keeps whatever's there on a fetch failure.
    }
  }, [orgId]);

  const refetchClientSummary = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/portal/clients?organizationId=${encodeURIComponent(orgId)}`);
      if (!res.ok) return;
      const j = (await res.json()) as { success?: boolean; data?: ClientSummaryResponse };
      if (j?.success && j.data) setClientSummary(j.data);
    } catch {
      // Silent — keeps the fixture preview on a fetch failure.
    }
  }, [orgId]);

  useEffect(() => {
    void refetchClientSummary();
    void refetchAlerts();
  }, [refetchClientSummary, refetchAlerts]);

  const handleDismissAlert = useCallback(
    async (alertId: string) => {
      // Optimistic — drop the row immediately, then reconcile both.
      setRealAlerts((prev) => (prev ? prev.filter((a) => a.id !== alertId) : prev));
      try {
        await fetch(`/api/portal/alerts/${encodeURIComponent(alertId)}/dismiss`, { method: 'POST' });
      } finally {
        void refetchAlerts();
        void refetchClientSummary();
      }
    },
    [refetchAlerts, refetchClientSummary],
  );

  const usingRealData = clientSummary?.hasRealClients === true;
  const alertStreamAlerts: DemoAlert[] = usingRealData ? (realAlerts ?? []) : LIGHTHOUSE_ALERTS;
  // In real mode the alert stream's per-client summaries come from the
  // /clients response (covers clients with no active alert too); when an
  // alert references a client not in that list (race during onboarding),
  // the stream falls back to the alert payload's own clientId.
  const alertStreamClients: AlertClientSummary[] = usingRealData
    ? (clientSummary?.clients ?? realAlertClients)
    : LIGHTHOUSE_CLIENTS;

  // Profession resolution chain (unchanged from PR2):
  //   1. Organization.profession (canonical)
  //   2. OrganizationPortalSettings.organizationType (legacy shadow)
  //   3. FINANCIAL_ADVISOR (catch-all)
  const profession: OrganizationType =
    (currentOrg?.profession as OrganizationType | undefined) ??
    (currentOrg?.organizationType as OrganizationType | undefined) ??
    'FINANCIAL_ADVISOR';

  const config = getPracticeProfessionConfig(profession);
  const kpis: RealKpis = usingRealData && clientSummary
    ? clientSummary.kpis
    : computeKpis(LIGHTHOUSE_CLIENTS, LIGHTHOUSE_ALERTS);

  const orgName = currentOrg?.name?.split(' ')[0] ?? 'there';

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const deltaWindowLabel = usingRealData ? 'vs last sweep' : 'vs 30d';
  const healthDeltaSub =
    kpis.averageHealthDelta > 0
      ? `↑ ${kpis.averageHealthDelta.toFixed(1)} ${deltaWindowLabel}`
      : kpis.averageHealthDelta < 0
        ? `↓ ${Math.abs(kpis.averageHealthDelta).toFixed(1)} ${deltaWindowLabel}`
        : 'stable';
  const healthDeltaTone: 'positive' | 'attention' | 'neutral' =
    kpis.averageHealthDelta > 0 ? 'positive' : kpis.averageHealthDelta < 0 ? 'attention' : 'neutral';

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-8">
        {/* Hero — replaces PracticeHeader + PracticeKpiStrip with the
            shared GlassHero pattern from the consumer app. */}
        <GlassHero atmosphere="sky">
          <GlassHeroEyebrow
            label={`${greeting}, ${orgName}`}
            badge={
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                  {config.practiceLabel}
                </span>
                <Link
                  href="/portal/feedback?route=%2Fportal%2Fdashboard"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/85 ring-1 ring-slate-900/[0.08] px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
                >
                  <MessageSquarePlus className="h-3 w-3" />
                  Feedback
                </Link>
              </div>
            }
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <GlassHeroHeadline
              label="Active clients on your book"
              value={String(kpis.activeClients)}
              gradientClassName="bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-700"
            />

            <dl className="grid grid-cols-3 gap-4 sm:gap-6 lg:min-w-[420px]">
              <GlassHeroKpiCell
                label="Need attention"
                value={String(kpis.needsAttention)}
                tone={kpis.needsAttention > 0 ? 'attention' : 'neutral'}
                sub="today"
              />
              <GlassHeroKpiCell
                label="TRAIL advanced"
                value={String(kpis.trailAdvancedThisWeek)}
                tone={kpis.trailAdvancedThisWeek > 0 ? 'positive' : 'neutral'}
                sub="this week"
              />
              <GlassHeroKpiCell
                label="Avg client health"
                value={`${kpis.averageHealth}`}
                tone={healthDeltaTone}
                sub={healthDeltaSub}
              />
            </dl>
          </div>
        </GlassHero>

        {/* Three click-through metric tiles — drill-ins to the most
            common adviser actions. */}
        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <MetricTile
            tone="sky"
            index={0}
            watermark={<ClientsGlyph />}
            onClick={() => router.push('/portal/clients')}
            ariaLabel={`Open client book — ${kpis.activeClients} active`}
          >
            <MetricTileHeadline
              label="Active clients"
              value={String(kpis.activeClients)}
              sub="View full client book →"
            />
          </MetricTile>

          <MetricTile
            tone="rose"
            index={1}
            watermark={<RequestsGlyph />}
            onClick={() => router.push('/portal/requests')}
            ariaLabel={`Open requests — ${kpis.needsAttention} need attention`}
          >
            <MetricTileHeadline
              label="Need attention"
              value={String(kpis.needsAttention)}
              sub={kpis.needsAttention > 0 ? 'Review requests →' : 'All clear'}
              subTone={kpis.needsAttention > 0 ? 'attention' : 'positive'}
            />
          </MetricTile>

          <MetricTile
            tone="violet"
            index={2}
            watermark={<ConversationsGlyph />}
            onClick={() => router.push('/portal/conversations')}
            ariaLabel="Open client conversations"
          >
            <MetricTileHeadline
              label="Conversations"
              value="Inbox"
              sub="View threads →"
            />
          </MetricTile>
        </div>

        <PracticeAlertStream
          alerts={alertStreamAlerts}
          clients={alertStreamClients}
          profession={config}
          onDismiss={usingRealData ? handleDismissAlert : undefined}
        />

        {/* Client book — the fixture table is the demo preview; in real
            mode the full book lives at /portal/clients (the "Active
            clients" tile above links there). The real-data version of
            this table — health / TRAIL stage / last contact + a drill-in,
            without the demo's financial columns — is a follow-up
            (see PHASE_32B_PR3_ALERT_ENGINE.md §6b "part 3"). */}
        {usingRealData ? (
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-sm px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Your client book</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {kpis.activeClients} active {kpis.activeClients === 1 ? 'client' : 'clients'}
                  {kpis.needsAttention > 0 ? ` · ${kpis.needsAttention} need attention` : ' · all clear'}
                  {clientSummary?.lastSweptAt
                    ? ` · last refreshed ${new Date(clientSummary.lastSweptAt).toLocaleDateString('en-AU')}`
                    : ''}
                </p>
              </div>
              <Link
                href="/portal/clients"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
              >
                Open the full client book →
              </Link>
            </div>
          </div>
        ) : (
          <PracticeClientBookTable clients={LIGHTHOUSE_CLIENTS} profession={config} />
        )}

        <footer className="pt-6 pb-2 border-t border-slate-200/60">
          <p className="text-[11px] text-slate-500 leading-relaxed max-w-3xl">
            {config.complianceFootnote}
          </p>
        </footer>
      </div>
    </div>
  );
}
