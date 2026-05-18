/**
 * Phase 12 PR 3c.2b — First-visit balance-upgrade nudge modal.
 *
 * Shown ONCE to existing users with ≥1 MANUAL account on their first
 * dashboard visit after this PR deploys. Persistence:
 *
 *   - Server-side: `UserPreference.dismissedBalanceUpgradeNudge` flag
 *     (POST `/api/settings/balance-upgrade-nudge` flips it to true).
 *   - Any of the three buttons flips the flag — Connect via Basiq /
 *     Upload statement / Keep manual. The modal never auto-shows again
 *     for this user.
 *   - Still reachable via Settings > Data Health (PR J) for users who
 *     want to revisit the choice — that surface doesn't gate on the
 *     flag.
 *
 * UX (CLAUDE.md §0):
 *   - Architect — composes the existing `?action=` deep-link handlers
 *     on `/dashboard/balances`. No parallel flows.
 *   - Financial adviser — neutral framing; "Keep manual" is a
 *     first-class option, not a guilt-trip "skip" link. Users with
 *     cash / crypto / foreign accounts who legitimately need MANUAL
 *     can pick it without feeling lectured.
 *   - Behaviour psychologist — modal opens in a calm-state (not as a
 *     red alarm); copy says "We can keep your balances fresh
 *     automatically" — invites, not demands. Three CTAs side-by-side
 *     so no option feels primary-by-default.
 *   - Designer — Apple-quiet: rounded card, slate ink, emerald accent
 *     for Basiq (the freshest tier), restrained motion.
 *
 * Privacy posture (CLAUDE.md §13.3): no balance amounts in copy.
 * Only the count of manual accounts surfaces ("You have N accounts
 * with manually-entered balances").
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Zap, Upload, Hand } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface BalanceUpgradeNudgeModalProps {
  manualAccountCount: number;
  basiqEnabled: boolean;
  onDismiss: () => void;
}

export function BalanceUpgradeNudgeModal({
  manualAccountCount,
  basiqEnabled,
  onDismiss,
}: BalanceUpgradeNudgeModalProps) {
  const router = useRouter();
  const { token } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  /**
   * Single SSOT for flipping the dismissal flag. Every CTA calls it.
   * On failure, we still let the user proceed (dismiss the modal) —
   * a transient API hiccup shouldn't trap them in a modal forever;
   * the modal stays gone for the session because the parent removes
   * it, and will retry on next page load.
   *
   * MUST pass the Authorization header — without it, the endpoint
   * returns 401, which `SessionExpiryHandler` (app/layout.tsx) treats
   * as "session is gone" and logs the user out. Hotfix shipped
   * 2026-05-18 after a production sign-out bug surfaced.
   */
  const flipDismissedFlag = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await fetch('/api/settings/balance-upgrade-nudge', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch (err) {
      console.warn('[BalanceUpgradeNudgeModal] dismiss flag flip failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConnectBasiq = async () => {
    await flipDismissedFlag();
    onDismiss();
    router.push('/dashboard/balances?action=connect-basiq');
  };

  const handleUploadStatement = async () => {
    await flipDismissedFlag();
    onDismiss();
    router.push('/dashboard/balances?action=import');
  };

  const handleKeepManual = async () => {
    await flipDismissedFlag();
    onDismiss();
  };

  // ESC to close (treated as "Keep manual" — flips the flag).
  // Declared AFTER the handlers so TypeScript doesn't flag a
  // TS2448 "used before declaration" against `handleKeepManual`.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void handleKeepManual();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="balance-upgrade-nudge-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) void handleKeepManual();
      }}
    >
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl ring-1 ring-slate-200/60 dark:ring-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2
              id="balance-upgrade-nudge-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Keep your balances fresh
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {manualAccountCount === 1
                ? 'You have 1 account with a manually-entered balance.'
                : `You have ${manualAccountCount} accounts with manually-entered balances.`}{' '}
              We can keep them fresh automatically — or you can keep entering them yourself.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleKeepManual()}
            aria-label="Close"
            disabled={submitting}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        {/* Three options */}
        <div className="px-5 py-4 space-y-2.5">
          {basiqEnabled && (
            <button
              type="button"
              onClick={() => void handleConnectBasiq()}
              disabled={submitting}
              className="group w-full flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 px-4 py-3 text-left transition-colors disabled:opacity-50"
            >
              <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900 p-1.5 mt-0.5">
                <Zap aria-hidden className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  Connect via Basiq
                </p>
                <p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-200/70">
                  Live Open Banking sync. Your balances refresh automatically every day.
                </p>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleUploadStatement()}
            disabled={submitting}
            className="group w-full flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/60 hover:bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40 px-4 py-3 text-left transition-colors disabled:opacity-50"
          >
            <div className="rounded-lg bg-sky-100 dark:bg-sky-900 p-1.5 mt-0.5">
              <Upload aria-hidden className="h-4 w-4 text-sky-700 dark:text-sky-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                Upload a statement
              </p>
              <p className="mt-0.5 text-xs text-sky-800/80 dark:text-sky-200/70">
                One-off CSV / QIF / OFX import. Refresh whenever you upload again.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleKeepManual()}
            disabled={submitting}
            className="group w-full flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 px-4 py-3 text-left transition-colors disabled:opacity-50"
          >
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-1.5 mt-0.5">
              <Hand aria-hidden className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Keep entering balances manually
              </p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Some accounts (cash, crypto, foreign) don't have a feed. You can always change this later.
              </p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          You can revisit this choice anytime in <span className="font-medium">Settings &middot; Data Health</span>.
        </div>
      </div>
    </div>
  );
}
