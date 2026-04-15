'use client';

/**
 * /onboarding page — TEMPORARILY DISABLED (2026-04-15 R12 remediation)
 *
 * The linear wizard (Phase 12 Track B) is disabled at the route
 * level until Phase 12 A.0 is re-applied with the hardened
 * `source === 'ONBOARDING'` guard on the destructive upserts in
 * `onboardingEstimateService.ts`. See:
 *   - docs/changelog/CHANGELOG_2026_04_15.md
 *   - docs/quality/PHASE_12_DESIGN_AUDIT.md §11.1
 *   - docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md §11 R12
 *   - CLAUDE.md §12.11
 *
 * The write path is stubbed (`OnboardingDisabledError` thrown from
 * every function in `onboardingEstimateService.ts` per PR #524),
 * which means any wizard step submit returns a 500. Rather than
 * show users "Could not save. Please try again." on every step,
 * we redirect them to `/dashboard/setup` where they can enter
 * financial data via the refinement tiles with real guided flows.
 *
 * When Phase 12 A.0 is re-applied (via a new PR with the §12.11
 * checklist filled in), revert this file to the original wizard
 * render + auth/completion gates. The rest of the wizard code
 * (`LinearWizardContainer`, step components, primitives, hook)
 * is intentionally preserved so the revert is one file.
 *
 * Pre-R12 version of this file: see commit e1f2440 (2026-04-15).
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/setup');
  }, [router]);

  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent motion-reduce:animate-none" />
    </section>
  );
}
