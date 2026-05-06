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

import { useRouter } from 'next/navigation';
import type { OrganizationType } from '@prisma/client';
import { MessageSquarePlus } from 'lucide-react';
import Link from 'next/link';
import {
  PracticeAlertStream,
  PracticeClientBookTable,
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
} from '@/lib/portal/practice';
import { useOrganization } from '@/lib/portal';

export default function PortalDashboardPage() {
  const router = useRouter();
  const { currentOrg } = useOrganization();

  // Profession resolution chain (unchanged from PR2):
  //   1. Organization.profession (canonical)
  //   2. OrganizationPortalSettings.organizationType (legacy shadow)
  //   3. FINANCIAL_ADVISOR (catch-all)
  const profession: OrganizationType =
    (currentOrg?.profession as OrganizationType | undefined) ??
    (currentOrg?.organizationType as OrganizationType | undefined) ??
    'FINANCIAL_ADVISOR';

  const config = getPracticeProfessionConfig(profession);
  const kpis = computeKpis(LIGHTHOUSE_CLIENTS, LIGHTHOUSE_ALERTS);

  const orgName = currentOrg?.name?.split(' ')[0] ?? 'there';

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const healthDeltaSub =
    kpis.averageHealthDelta >= 0
      ? `↑ ${kpis.averageHealthDelta.toFixed(1)} vs 30d`
      : `↓ ${Math.abs(kpis.averageHealthDelta).toFixed(1)} vs 30d`;

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
                tone={kpis.averageHealthDelta >= 0 ? 'positive' : 'attention'}
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
          alerts={LIGHTHOUSE_ALERTS}
          clients={LIGHTHOUSE_CLIENTS}
          profession={config}
        />

        <PracticeClientBookTable
          clients={LIGHTHOUSE_CLIENTS}
          profession={config}
        />

        <footer className="pt-6 pb-2 border-t border-slate-200/60">
          <p className="text-[11px] text-slate-500 leading-relaxed max-w-3xl">
            {config.complianceFootnote}
          </p>
        </footer>
      </div>
    </div>
  );
}
