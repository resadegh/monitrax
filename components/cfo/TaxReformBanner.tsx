'use client';

/**
 * Phase 41E.3 — "Tax rules are changing — and you're already protected"
 * one-time CFO Guide banner.
 *
 * Per `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §11.1 risk
 * mitigation (the calm-copy specification) + §12.1 cross-cutting
 * matrix row "CFO Guide" + Reza's 5-point confirmation 2026-05-16
 * (calm copy beats urgency framing — most users are grandfathered,
 * so the banner leads with "you're already protected").
 *
 * **Copy spec (per §11.1):**
 *   - Headline: "Tax rules are changing — and you're already protected."
 *   - Body: "If you bought your properties before 12 May 2026, the old
 *     rules keep applying — your negative gearing and 50% CGT discount
 *     don't change. For investments you make from now on, the rules
 *     are different."
 *   - CTA: "Show me my position" → `/dashboard/cfo/ask?q=…` prefilled
 *     with the reform-impact question.
 *   - Dismiss: small "Dismiss" affordance, always reachable.
 *
 * **Behavioural-psychologist lens (CLAUDE.md §0 + §14):**
 *   - Lead with the good news (grandfathering protects most users).
 *   - Never manufactured urgency (no countdown, no FOMO).
 *   - Never shame ("you should have…", "you missed…").
 *   - Always One Clear Action (the CTA).
 *
 * **Visual vocabulary:**
 *   - Sky-50/sky-100 background — calm, informational (NOT amber,
 *     NOT rose — those tones would push users toward panic).
 *   - Restrained iconography (one Info icon).
 *   - No animation — the banner is information, not a moment.
 *
 * Mounted on `/dashboard/cfo` at the top (above existing CFO content).
 * Dismissal state lives on `UserPreference.dismissedReformBanner`
 * (migration `20260516200000_phase_41e_3_reform_banner_dismissal`).
 * The banner re-fetches state on mount; loading-flash is suppressed
 * via the initial null state.
 */

import { useEffect, useState } from 'react';
import { Info, X, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface ReformBannerState {
  status: 'loading' | 'visible' | 'dismissed';
}

const PREFILLED_QUESTION = 'How do the new tax laws affect me?';
const ASK_URL = `/dashboard/cfo/ask?q=${encodeURIComponent(PREFILLED_QUESTION)}`;

export function TaxReformBanner() {
  const { token } = useAuth();
  const [state, setState] = useState<ReformBannerState>({ status: 'loading' });

  // Fetch dismissal state once on mount.
  // Hotfix 2026-05-18: MUST pass Authorization header on every API
  // call — otherwise 401 → SessionExpiryHandler logs the user out.
  // (Pre-existing same-pattern bug as today's PR K modal; both fixed
  // in the same hotfix PR for the same reason.)
  useEffect(() => {
    let active = true;
    fetch('/api/settings/reform-banner', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((r) => (r.ok ? r.json() : { dismissed: false }))
      .then((data: { dismissed: boolean }) => {
        if (!active) return;
        setState({ status: data.dismissed ? 'dismissed' : 'visible' });
      })
      .catch(() => {
        if (active) setState({ status: 'visible' });
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleDismiss = async (): Promise<void> => {
    // Optimistic — hide first, then persist. If persist fails the
    // banner re-appears on next refresh; not catastrophic.
    setState({ status: 'dismissed' });
    try {
      await fetch('/api/settings/reform-banner', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch {
      // Swallow — user already sees the banner dismissed; the next
      // refresh will re-fetch state and restore it if persist failed.
    }
  };

  if (state.status === 'loading' || state.status === 'dismissed') {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl ring-1 ring-inset ring-sky-200 dark:ring-sky-800/60 bg-sky-50 dark:bg-sky-950/30 p-4 sm:p-5"
      data-testid="tax-reform-banner"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 rounded-lg bg-sky-100 dark:bg-sky-900/50 p-2">
          <Info aria-hidden className="h-5 w-5 text-sky-700 dark:text-sky-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
            Tax rules are changing — and you&apos;re already protected.
          </h3>
          <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            If you bought your properties before 12 May 2026 7:30pm AEST, the old
            rules keep applying — your negative gearing and 50% CGT discount
            don&apos;t change. For investments you make from now on, the rules
            are different.
          </p>
          <a
            href={ASK_URL}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-700 dark:bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 dark:hover:bg-sky-500 transition-colors"
            data-testid="tax-reform-banner-cta"
          >
            Show me my position
            <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </a>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-shrink-0 -m-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Dismiss this notice"
          data-testid="tax-reform-banner-dismiss"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
