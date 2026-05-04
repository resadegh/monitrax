/**
 * Phase 32B PR2 — Practice dashboard.
 *
 * Replaces the previous Phase 32 "Coming Soon" stub with the assembled
 * Practice view: KPI strip + alert stream + client book table, all driven
 * by the lighthouse demo dataset (5 fictitious AU property-investor clients
 * across all 5 TRAIL stages, 7 alerts spanning every v1 trigger kind).
 *
 * Demo-mode profession switcher in the header lets the lighthouse pitch
 * cycle through `FINANCIAL_ADVISOR` → `MORTGAGE_BROKER` → `ACCOUNTING_FIRM`
 * to demonstrate the same engine producing role-flavoured columns + alert
 * filtering. **Production hides the switcher entirely** — production reads
 * `org.profession` from the resolved `Organization` record (Phase 32B PR1
 * schema). The `?profession=…` query parameter only takes effect in demo
 * mode, gated by `NEXT_PUBLIC_PORTAL_DEMO_MODE=1` in the build env.
 *
 * Real data wires in PR3 alongside the canonical client drill-in surface.
 */
'use client';

import { useState } from 'react';
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

const isDemoMode =
  typeof process !== 'undefined' &&
  process.env?.NEXT_PUBLIC_PORTAL_DEMO_MODE === '1';

export default function PortalDashboardPage() {
  const { currentOrg } = useOrganization();

  // Demo mode lets us cycle the profession on the same page without re-onboarding
  // an org. Production reads `currentOrg.profession` and ignores the switcher.
  const [demoProfession, setDemoProfession] =
    useState<OrganizationType>('FINANCIAL_ADVISOR');

  // Production: read profession from the org (canonical
  // `Organization.profession` field added in Phase 32B PR1; falls back to
  // legacy `organizationType` for orgs created before the migration; falls
  // back to `FINANCIAL_ADVISOR` for orgs that have neither yet).
  // Demo: switcher controls local state, ignoring org.profession.
  const orgProfession =
    (currentOrg?.profession as OrganizationType | undefined) ??
    (currentOrg?.organizationType as OrganizationType | undefined) ??
    'FINANCIAL_ADVISOR';
  const profession: OrganizationType = isDemoMode ? demoProfession : orgProfession;

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
          onProfessionChange={isDemoMode ? setDemoProfession : undefined}
          demoMode={isDemoMode}
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
