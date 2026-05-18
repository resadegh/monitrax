/**
 * Phase 12 PR 3c.1 — StaleBalanceNudge.
 *
 * Dashboard-level callout that fires when the user has ≥1 MANUAL
 * account whose balance hasn't been refreshed in
 * `MANUAL_STALE_THRESHOLD_DAYS` (14 days). Same staleness rule the
 * inline `<DataSourceChip>` uses — single SSOT via `isBalanceStale`.
 *
 * Behaviour:
 *   - Dismissed via the X — persists for the SESSION only
 *     (sessionStorage). Reappears next session if the condition
 *     still holds, which is the right cadence for a hygiene nudge
 *     (not a one-and-done modal).
 *   - Renders nothing when zero stale MANUAL accounts.
 *   - CTAs deep-link to the canonical accounts surface
 *     (`/dashboard/balances?action=…`) — no parallel routes.
 *
 * Per CLAUDE.md §0 behaviour-psychologist lens — language is calm +
 * normalising ("Your balances are getting stale" — observational, not
 * accusatory). Per §13.3, no balance amounts surface in the copy —
 * only the count of accounts.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, X, Zap, Upload } from 'lucide-react';
import { isBalanceStale } from '@/components/accounts/DataSourceChip';
import { useBasiqEnabled } from '@/lib/featureFlags/BasiqGateContext';

const DISMISS_KEY = 'monitrax:staleBalanceNudge:dismissed';

interface StaleAccountSummary {
  balanceSource?: string | null;
  balanceLastUpdatedAt?: string | Date | null;
}

interface StaleBalanceNudgeProps {
  accounts: StaleAccountSummary[];
  /** Optional override for tests / Storybook. Defaults to sessionStorage. */
  initiallyDismissed?: boolean;
}

export function StaleBalanceNudge({ accounts, initiallyDismissed }: StaleBalanceNudgeProps) {
  const basiqEnabled = useBasiqEnabled();
  // Start `null` to defer the render until the client check completes
  // (avoids SSR/CSR mismatch — `window` isn't available server-side).
  const [dismissed, setDismissed] = useState<boolean | null>(
    initiallyDismissed === undefined ? null : initiallyDismissed
  );

  useEffect(() => {
    if (initiallyDismissed !== undefined) return; // controlled
    try {
      setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, [initiallyDismissed]);

  const staleCount = accounts.filter((a) => isBalanceStale(a.balanceSource, a.balanceLastUpdatedAt)).length;

  if (dismissed !== false) return null;
  if (staleCount === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sessionStorage may be unavailable (private mode); dismiss in-memory only */
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex items-start gap-3">
      <div className="rounded-lg bg-amber-100 p-1.5 mt-0.5">
        <RefreshCw aria-hidden className="h-4 w-4 text-amber-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900">
          {staleCount === 1
            ? "1 account hasn't been refreshed in over 2 weeks"
            : `${staleCount} accounts haven't been refreshed in over 2 weeks`}
        </p>
        <p className="mt-0.5 text-xs text-amber-800/80">
          Your dashboard reads from these balances — keeping them fresh keeps every number it shows you accurate.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {basiqEnabled && (
            <Link
              href="/dashboard/balances?action=connect-basiq"
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white"
            >
              <Zap aria-hidden className="h-3 w-3" />
              Connect via Basiq
            </Link>
          )}
          <Link
            href="/dashboard/balances?action=import"
            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white hover:bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900"
          >
            <Upload aria-hidden className="h-3 w-3" />
            Upload a statement
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="rounded-md p-1 text-amber-700 hover:bg-amber-100"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
