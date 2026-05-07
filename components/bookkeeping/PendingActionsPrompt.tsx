/**
 * Phase 42 PR6.5e — Persistent reconciliation nudge.
 *
 * Per Reza directive 2026-05-08: *"a message on login: you have
 * few unreconsiled transactions, fix them now?"* — make the strip
 * visible **every session**, not once per UTC day. Reconciliation
 * is the most-recurring user task; the rule for recurring tasks
 * is *"a small, persistent, scannable counter on every visit"*
 * (YNAB / Mint / Pocketbook / Slack-badge / Mail-badge pattern).
 *
 * Per Reza decision PR6.5b lesson preserved: this stays a
 * **non-modal in-flow strip**, NOT a modal. Modal-on-arrival is
 * still in `↩️ Reversed Decisions`. The pivot here is purely
 * about *cadence* — once-per-UTC-day gate → per-session collapse.
 *
 * Per CLAUDE.md §0:
 *   - Designer lens: top-of-page placement (above TRAIL hero on
 *     Home, like YNAB's "X unapproved" banner). Apple-glass tile;
 *     ≥44pt tap targets per Apple HIG; tabular-nums on counts.
 *   - Behaviour-psychologist: leans into the "fix it now" framing
 *     the user requested — *"X transactions to reconcile — fix
 *     now"*. Collapse + opt-out always reachable so it never
 *     feels like a nag.
 *   - Architect (CLAUDE.md §12.3): same SSOT aggregator + same
 *     API; only the gate behaviour swaps.
 *
 * Cadence (the load-bearing change in PR6.5e):
 *   - **Per session** via `sessionStorage` — collapse persists
 *     while the tab is open; clears on tab close → fresh prompt
 *     on next visit. (Replaces the prior once-per-UTC-day server
 *     gate.)
 *   - `promptOptedOut` global off-switch is preserved — the user
 *     can still permanently dismiss with "Don't show me this
 *     again."
 *   - The server gate (`?action=shown` write) is now *advisory*
 *     telemetry — fired-and-forgotten so we still know how
 *     often the strip surfaces, but it does not block re-render.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bell, Receipt, Repeat, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

type PendingActionKind = 'CATEGORISE' | 'ANOMALY' | 'RECURRING' | 'RECEIPT';

interface PendingAction {
  kind: PendingActionKind;
  label: string;
  href: string;
  count: number;
}

interface PendingActionsResult {
  actions: PendingAction[];
  totalCount: number;
  alreadyShownToday: boolean;
  optedOut: boolean;
}

const ICONS: Record<PendingActionKind, typeof Sparkles> = {
  CATEGORISE: Sparkles,
  ANOMALY: Bell,
  RECURRING: Repeat,
  RECEIPT: Receipt,
};

/** Per-session collapse key — clears when the tab closes. */
const SESSION_COLLAPSE_KEY = 'monitrax.pendingActions.collapsedThisSession';

export function PendingActionsPrompt() {
  const { token } = useAuth();
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<PendingActionsResult | null>(null);

  useEffect(() => {
    // Wait for the auth context to resolve a Firebase ID token —
    // bookkeeping routes require Bearer auth and return 401
    // without it. (See the 2026-05-08 fix that moved both this
    // strip and `usePendingReconciliationCount()` off
    // `localStorage.getItem('token')` and onto `useAuth().token`.)
    if (!token) {
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/bookkeeping/engagement/pending-actions', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        if (cancelled) return;
        if (!res.ok) return;
        const json = (await res.json()) as { success?: boolean; data?: PendingActionsResult };
        if (cancelled || !json?.data) return;
        const payload = json.data;
        setData(payload);

        // Per-session collapse — replaces the prior once-per-UTC-day gate.
        const collapsedThisSession =
          typeof window !== 'undefined' && sessionStorage.getItem(SESSION_COLLAPSE_KEY) === '1';

        if (
          !payload.optedOut &&
          !collapsedThisSession &&
          payload.actions.length > 0 &&
          payload.totalCount > 0
        ) {
          setVisible(true);
          // Advisory telemetry — fire-and-forget; does NOT gate re-render.
          fetch('/api/bookkeeping/engagement/pending-actions?action=shown', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
          }).catch(() => {});
        }
      } catch {
        // Silent — engagement layer must never break the dashboard.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleCollapse() {
    setVisible(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_COLLAPSE_KEY, '1');
    }
    // Server-side dismiss is now advisory — keep the audit trail
    // by writing it, but it does NOT gate re-display.
    if (!token) return;
    fetch('/api/bookkeeping/engagement/pending-actions?action=dismiss', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    }).catch(() => {});
  }

  function handleOptOut() {
    setVisible(false);
    if (!token) return;
    fetch('/api/bookkeeping/engagement/pending-actions?action=opt-out', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    }).catch(() => {});
  }

  if (!visible || !data || data.actions.length === 0) return null;

  // Lead with the categorise count (the load-bearing reconciliation
  // signal); fold the rest into the chip row below.
  const categoriseAction = data.actions.find((a) => a.kind === 'CATEGORISE');
  const otherActions = data.actions.filter((a) => a.kind !== 'CATEGORISE');

  return (
    <section
      aria-label="Pending reconciliation actions"
      className="rounded-3xl border border-amber-200 bg-amber-50/70 px-4 sm:px-5 py-4 mb-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-300"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Welcome back
          </p>
          <p className="text-base sm:text-[17px] font-semibold text-amber-950 mt-0.5 leading-snug">
            {leadCopy(categoriseAction, otherActions, data.totalCount)}
          </p>
          {categoriseAction && (
            <Link
              href={categoriseAction.href}
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-2 rounded-full bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 active:bg-amber-800 transition-colors min-h-[40px]"
            >
              Fix now
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={handleCollapse}
          aria-label="Hide for this session"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-amber-700/60 hover:bg-amber-100 active:bg-amber-200 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Other action chips — anomalies / recurring / receipts */}
      {otherActions.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          {otherActions.map((a) => {
            const Icon = ICONS[a.kind];
            return (
              <li key={a.kind}>
                <Link
                  href={a.href}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white hover:bg-amber-50 active:bg-amber-100 border border-amber-100 transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 group"
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex-1 text-sm text-slate-900 tabular-nums truncate">
                    {a.label}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:text-amber-600 transition-colors" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={handleOptOut}
        className="text-xs text-amber-700/50 hover:text-amber-800 mt-3 py-1 min-h-[28px]"
      >
        Don&rsquo;t show me this again
      </button>
    </section>
  );
}

function leadCopy(
  categorise: PendingAction | undefined,
  others: PendingAction[],
  totalCount: number
): string {
  if (categorise) {
    const n = categorise.count;
    if (others.length === 0) {
      return n === 1
        ? 'You have 1 unreconciled transaction.'
        : `You have ${n} unreconciled transactions.`;
    }
    return n === 1
      ? `1 unreconciled transaction · ${totalCount - n} other to-do${totalCount - n === 1 ? '' : 's'}.`
      : `${n} unreconciled transactions · ${totalCount - n} other to-do${totalCount - n === 1 ? '' : 's'}.`;
  }
  // No categorise but other things pending — softer copy.
  return totalCount === 1
    ? 'One thing waiting for you.'
    : `${totalCount} small things waiting for you.`;
}
