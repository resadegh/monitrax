/**
 * Phase 32B PR2 — Practice dashboard.
 *
 * Renders the assembled Practice view: KPI strip + alert stream + client
 * book table. Driven by the lighthouse fixture dataset until Phase 32C PR3+
 * wires real snapshot deltas; the fixture also serves as the empty-state
 * preview for orgs that haven't onboarded a real client yet.
 *
 * Reza directive 2026-05-04: skip the demo-mode profession switcher and
 * build the complete capabilities. The lighthouse pitch happens against
 * THE REAL APP populated with realistic seeded users (Up Next #33), not
 * a demo skin. This page therefore reads `currentOrg.profession` from the
 * Organization record exclusively — no toggle, no env-gated mode, no
 * runtime switching.
 *
 * Fallback: if `currentOrg.profession` is unset (legacy org pre-PR1
 * migration) we fall back to `currentOrg.organizationType` (the legacy
 * shadow column on `OrganizationPortalSettings`). If both are unset we
 * default to `FINANCIAL_ADVISOR` so the surface still renders correctly.
 *
 * Profession is forced at registration; once set, it cannot be flipped
 * by an in-page toggle.
 */
'use client';

import type { OrganizationType } from '@prisma/client';
import {
  PracticeHeader,
  PracticeKpiStrip,
  PracticeAlertStream,
  PracticeClientBookTable,
} from '@/components/portal/practice';
import {
  LIGHTHOUSE_CLIENTS,
  LIGHTHOUSE_ALERTS,
  computeKpis,
  getPracticeProfessionConfig,
} from '@/lib/portal/practice';
import { useOrganization } from '@/lib/portal';

export default function PortalDashboardPage() {
  const { currentOrg } = useOrganization();

  // Profession resolution chain:
  //   1. Organization.profession (canonical, Phase 32B PR1)
  //   2. OrganizationPortalSettings.organizationType (legacy shadow)
  //   3. FINANCIAL_ADVISOR (catch-all default)
  const profession: OrganizationType =
    (currentOrg?.profession as OrganizationType | undefined) ??
    (currentOrg?.organizationType as OrganizationType | undefined) ??
    'FINANCIAL_ADVISOR';

  const config = getPracticeProfessionConfig(profession);
  const kpis = computeKpis(LIGHTHOUSE_CLIENTS, LIGHTHOUSE_ALERTS);

  const orgName = currentOrg?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-8">
        <PracticeHeader
          organisationName={orgName}
          profession={profession}
          practiceLabel={config.practiceLabel}
        />

        <PracticeKpiStrip kpis={kpis} />

        <PracticeAlertStream
          alerts={LIGHTHOUSE_ALERTS}
          clients={LIGHTHOUSE_CLIENTS}
          profession={config}
        />

        <PracticeClientBookTable
          clients={LIGHTHOUSE_CLIENTS}
          profession={config}
        />

        <footer className="pt-6 pb-2 border-t border-slate-200/70">
          <p className="text-[11px] text-slate-500 leading-relaxed max-w-3xl">
            {config.complianceFootnote}
          </p>
        </footer>
      </div>
    </div>
  );
}
