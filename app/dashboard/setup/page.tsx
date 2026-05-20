/**
 * /dashboard/setup — RETIRED 2026-05-20 (Phase 12 Track F precursor).
 *
 * This page WAS the "Phase 12 v3 dedicated setup page" — a legacy
 * welcome/onboarding surface with its own Setup Tray checklist
 * ("Set up Monitrax — X of 7 done"), one-recommended-action panel,
 * Basiq hero, and empty-state tile grid.
 *
 * Reza decision 2026-05-20 (Open Question Q-CONV-2): that whole
 * surface is a DUPLICATE of the canonical onboarding wizard at
 * `/onboarding` (the form + AI-chat flow). Two setup surfaces for
 * the same job is a §12.2 SSOT violation — confusing, and they drift
 * (the legacy "0 of 7" tracker disagreed with the wizard's progress).
 *
 * So `/dashboard/setup` now simply redirects to `/onboarding`. Every
 * historical entry point (welcome-modal "Start setup" CTA, the
 * `/dashboard` "Set up Monitrax" button, the OnboardingResumeBanner
 * "Start over" button) lands on the one canonical wizard.
 *
 * The legacy component island is now orphaned — unreachable, not
 * deleted ("mark and hide", per Reza). Tracked for a delete pass in
 * `docs/IMPLEMENTATION_PLAN.md` → Dead Code backlog:
 *   - components/setup/SetupTray.tsx
 *   - components/setup/SetupNextActionPanel.tsx
 *   - components/dashboard/DashboardEmptyStateGrid.tsx
 *   - components/dashboard/BasiqHeroCard.tsx
 *   - lib/setup/* (tasks registry + useSetupState hook)
 *   - /api/setup/state route
 *
 * Auth: no gate needed here — `/onboarding` runs its own auth gate
 * (redirects to /signin when there is no user).
 *
 * See: docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md (Track F —
 * the wizard becomes the single canonical setup surface over the
 * real entity tables).
 */

import { redirect } from 'next/navigation';

export default function DashboardSetupPage() {
  redirect('/onboarding');
}
