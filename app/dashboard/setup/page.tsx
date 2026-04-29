'use client';

/**
 * /dashboard/setup — Phase 12 v3 dedicated setup page
 *
 * The dashboard-as-onboarding experience lives here. This page is
 * the dedicated surface for the v3 Setup Tray + Basiq hero + empty-
 * state tile grid, intentionally kept OFF the main /dashboard page
 * so the existing dashboard design (StatCards, insight widgets,
 * populated empty-state card) stays untouched.
 *
 * Routing:
 *   - Users land here via the welcome modal's "Start setup" CTA
 *     (DashboardLayout.handleStartSetup now routes to /dashboard/setup
 *     instead of opening the legacy WizardContainer).
 *   - Users on /dashboard with no data see a "Set up Monitrax" button
 *     inside the existing legacy Welcome card, which also routes here.
 *   - The legacy linear wizard is still reachable from DashboardLayout
 *     via the ?legacy=wizard URL param for support/QA.
 *
 * What renders:
 *   1. BasiqHeroCard — full-width §2.3 "Basiq as hero" connection
 *      card. Auto-hides once the user has an ACTIVE Basiq connection
 *      (reads the connect-bank task state from useSetupState).
 *   2. SetupTray — adaptive checklist with progress meter. Same
 *      component used for the dashboard chrome in the original v3
 *      plan, now mounted page-level instead of layout-level.
 *   3. DashboardEmptyStateGrid — six empty-state tiles (Properties,
 *      Accounts, Income, Expenses, Investments, Loans) deep-linking
 *      to the real entity dialogs on their respective sub-pages.
 *   4. A "Done setting up? → Go to dashboard" link at the bottom so
 *      users always have a clear way out.
 *
 * Architecture notes:
 *   - Inherits DashboardLayout (auth gate, sidebar, header) via the
 *     Next.js app-router nested layout system. No new auth code.
 *   - Pure presentational composition. Each mounted component is a
 *     self-contained consumer of useSetupState and handles its own
 *     loading/error states — this page just arranges them in a
 *     vertical stack with consistent spacing.
 *   - CDR-safe: no CDR data flows through this page (CLAUDE.md §13.3).
 *     All state comes from the Setup Tray task booleans derived
 *     server-side by setupStateService.
 *
 * See:
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §2.1 (Setup Tray)
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §2.2 (empty-state tiles)
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §2.3 (Basiq hero)
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §5 (migration strategy)
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { BasiqHeroCard } from '@/components/dashboard/BasiqHeroCard';
import { DashboardEmptyStateGrid } from '@/components/dashboard/DashboardEmptyStateGrid';
import SetupTray from '@/components/setup/SetupTray';
// Phase 12 twin-track (A.2): top-of-page one-recommended-action panel.
// Reads moduleProgress from useSetupState and renders the single
// highest-leverage next step based on the Missing/Estimated state.
import { SetupNextActionPanel } from '@/components/setup/SetupNextActionPanel';

export default function DashboardSetupPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Set up your TRAIL"
          description="Connect your bank, add your properties, and tell us about your household. Each step takes you further on your TRAIL to financial freedom."
        />

        <div className="mt-6 space-y-6">
          {/* Phase 12 twin-track (A.2) — one recommended next action
              at the top of the setup page. Computes the highest-
              leverage action from moduleProgress and routes to the
              same href as the matching Setup Tray task (SSOT). */}
          <SetupNextActionPanel />

          {/* Phase 12 v3 §2.3 — Basiq hero. Full-width top-of-page
              connection card. Auto-hides once the connect-bank task
              flips to isDone, so users who have already connected a
              bank see the grid + tray without the hero. */}
          <BasiqHeroCard />

          {/* Phase 12 v3 §2.1 — Setup Tray. Collapsible checklist
              with progress meter. Mounted page-level (not chrome-
              level) so it only appears on this setup page and does
              not pollute the main /dashboard view. */}
          <SetupTray />

          {/* Phase 12 v3 §2.2 — Empty-state tile grid. Six tiles
              (Properties, Accounts, Income, Expenses, Investments,
              Loans) deep-linking to the real entity dialogs. Uses
              placeholder illustrations, never fake data. */}
          <DashboardEmptyStateGrid />

          {/* Exit affordance — always give users a clear way back to
              the main dashboard. Matches CLAUDE.md §6.7 "no dead-ends —
              every screen leads somewhere". */}
          <div className="flex justify-center pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 motion-reduce:transition-none dark:text-slate-400 dark:hover:text-slate-200 dark:focus-visible:ring-slate-600"
            >
              Done setting up? Go to dashboard
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
