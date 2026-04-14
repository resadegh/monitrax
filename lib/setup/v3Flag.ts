'use client';

/**
 * v3 feature flag helper — Phase 12 v3 (F)
 *
 * Single source of truth for the `NEXT_PUBLIC_ONBOARDING_V3` feature
 * flag. Two consumers today:
 *
 *   - `components/DashboardLayout.tsx` — decides whether to mount the
 *     Setup Tray or the legacy resume banner + ambient tint.
 *   - `app/dashboard/page.tsx` — decides whether to render the v3
 *     empty-state grid + Basiq hero or the legacy "Welcome to
 *     Monitrax" card in the `isEmpty` branch.
 *
 * Both consumers must agree on the flag value at all times — if they
 * drift, a user could end up with the Setup Tray in the chrome AND
 * the legacy welcome card in the body, or vice versa. Defining the
 * flag in one place and importing it from both eliminates that risk
 * (CLAUDE.md §12.2 SSOT).
 *
 * Phase F semantics (default flip)
 * ================================
 *
 * Before Phase F the flag defaulted OFF — users saw the legacy
 * experience unless the env var was explicitly set to `'true'`:
 *
 *     process.env.NEXT_PUBLIC_ONBOARDING_V3 === 'true'
 *
 * After Phase F the flag defaults ON — users see the v3 experience
 * unless the env var is explicitly set to `'false'`:
 *
 *     process.env.NEXT_PUBLIC_ONBOARDING_V3 !== 'false'
 *
 * This is the "default flip" per PHASE_12_REDESIGN_V3.md §5 Phase F:
 * new users land on v3; the legacy wizard is deprecated but NOT yet
 * deleted (Phase G cleanup). Rollback is still a single env-var
 * change away: set `NEXT_PUBLIC_ONBOARDING_V3=false` and redeploy.
 *
 * URL escape hatch
 * ================
 *
 * Phase F also introduces a `?legacy=wizard` URL parameter that
 * forces the legacy experience for a single session, regardless of
 * the build-time default. Use cases:
 *
 *   - Support staff reproducing an issue reported against the
 *     legacy flow.
 *   - QA smoke-testing the legacy path before Phase G cleanup.
 *   - Emergency rollback for a specific user if the v3 flow breaks
 *     for them but works for everyone else (saves a redeploy).
 *
 * The escape hatch is session-scoped and client-side only — it does
 * not persist beyond the tab, does not write to storage, and is
 * never sent to the server. Reload without the param → v3 returns.
 *
 * SSR + hydration safety
 * ======================
 *
 * `useV3Enabled` reads `window.location.search` in a client-only
 * `useEffect`. The initial render (both SSR and first client
 * render) uses the build-time default; the post-hydration render
 * applies the URL override if present. This avoids hydration
 * mismatches because the first render is deterministic regardless
 * of the URL, and the URL-aware re-render happens after React has
 * taken over the DOM.
 *
 * Users hitting `?legacy=wizard` will see the v3 experience for a
 * single paint before it flips to legacy. That is acceptable for an
 * escape-hatch used by support/QA — it is not an affordance users
 * will interact with as part of normal navigation.
 */

import { useEffect, useState } from 'react';

/**
 * The build-time default. `true` means "v3 is on unless explicitly
 * disabled"; `false` means "v3 is off unless explicitly enabled".
 *
 * Phase F flipped this from `=== 'true'` (off-by-default) to
 * `!== 'false'` (on-by-default). Set `NEXT_PUBLIC_ONBOARDING_V3=false`
 * in the deployment env to roll back.
 */
export const ONBOARDING_V3_DEFAULT =
  process.env.NEXT_PUBLIC_ONBOARDING_V3 !== 'false';

/**
 * Returns true if the v3 dashboard-as-onboarding experience is
 * active for the current render. Combines the build-time default
 * with the per-session `?legacy=wizard` URL escape hatch.
 *
 * Callers should place this at the top of their component body and
 * use the returned boolean to gate v3-specific UI. The hook is safe
 * to call from any client component; on the server it returns the
 * build-time default.
 */
export function useV3Enabled(): boolean {
  // Start with the build-time default so SSR and the first client
  // render agree. A mismatched first render would produce a React
  // hydration warning.
  const [v3Enabled, setV3Enabled] = useState<boolean>(ONBOARDING_V3_DEFAULT);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Parse once on mount. The escape hatch is session-scoped and
    // does not need to react to URL changes mid-session — a reload
    // without the param restores the default.
    const params = new URLSearchParams(window.location.search);
    const legacyOverride = params.get('legacy') === 'wizard';
    setV3Enabled(ONBOARDING_V3_DEFAULT && !legacyOverride);
  }, []);

  return v3Enabled;
}
