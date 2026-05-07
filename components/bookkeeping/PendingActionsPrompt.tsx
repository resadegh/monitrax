/**
 * Phase 42 PR6.5b — Pending-actions popup.
 *
 * Per Reza idea 2026-05-07: *"have the transaction reconciliation and
 * categorisation be popup when user login to be completed"* /
 * *"something like a pending actions popup at first login?"*
 *
 * Mounted once at the dashboard root. On mount, fetches the
 * pending-actions payload; if `shouldShowPromptToday()` agrees, opens
 * a centred dialog (≥sm) / full-height bottom-sheet (mobile) with up
 * to 3 actions, a "Not today" snooze, and a "Don't show me this again"
 * opt-out.
 *
 * Per CLAUDE.md §0 behaviour-psychologist lens — three actions max
 * (Hick's Law); pending-actions framing, NOT categorise-only; warm
 * copy; snooze + opt-out always reachable so we never feel like a nag.
 *
 * Per CLAUDE.md §0 designer lens — Apple-glass tile, 28px-radius,
 * 220ms slide-up; ≥44pt tap targets per Apple HIG; tabular-nums on
 * all counts; `prefers-reduced-motion` collapses motion to fade.
 *
 * Per CLAUDE.md §12.3 — composes existing
 * `/api/bookkeeping/engagement/pending-actions` route. No parallel
 * aggregator path. The popup itself is a thin presenter.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bell, Receipt, Repeat, Sparkles, X } from 'lucide-react';

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

/**
 * Drop-in mount. Place once on the dashboard tree (e.g. inside
 * `DashboardLayout`); it manages its own lifecycle.
 */
export function PendingActionsPrompt() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PendingActionsResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch('/api/bookkeeping/engagement/pending-actions', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: 'include',
        });
        if (cancelled) return;
        if (!res.ok) return;
        const json = (await res.json()) as { success?: boolean; data?: PendingActionsResult };
        if (cancelled || !json?.data) return;
        const payload = json.data;
        setData(payload);
        if (
          !payload.optedOut &&
          !payload.alreadyShownToday &&
          payload.actions.length > 0 &&
          payload.totalCount > 0
        ) {
          setOpen(true);
          // Fire-and-forget — mark shown so we don't repeat in the same day.
          fetch('/api/bookkeeping/engagement/pending-actions?action=shown', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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
  }, []);

  // Esc to dismiss (desktop accessibility).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSnooze();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSnooze() {
    setOpen(false);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch('/api/bookkeeping/engagement/pending-actions?action=dismiss', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
    }).catch(() => {});
  }

  function handleOptOut() {
    setOpen(false);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch('/api/bookkeeping/engagement/pending-actions?action=opt-out', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
    }).catch(() => {});
  }

  if (!open || !data || data.actions.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close prompt"
        onClick={handleSnooze}
        className="fixed inset-0 z-40 bg-slate-900/40 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      />

      {/* Sheet — bottom-sheet on mobile, centred dialog on ≥sm */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pending actions for today"
        className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 px-5 sm:px-6 pt-3 pb-6 sm:pb-7 max-h-[85vh] overflow-y-auto motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:sm:slide-in-from-bottom-2 motion-safe:duration-300"
        >
          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-1 pb-2 sm:hidden">
            <span className="block w-10 h-1 rounded-full bg-slate-300" aria-hidden />
          </div>

          {/* Header */}
          <header className="flex items-start justify-between gap-3 mb-4 mt-1 sm:mt-0">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                Welcome back
              </p>
              <p className="text-lg sm:text-xl font-semibold text-slate-900 mt-1">
                {headerCopy(data.actions.length, data.totalCount)}
              </p>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                Five seconds each — pick one or come back later.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSnooze}
              aria-label="Close"
              className="inline-flex items-center justify-center w-11 h-11 rounded-full text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Action chips */}
          <ul className="space-y-2.5 mb-5">
            {data.actions.map((a) => {
              const Icon = ICONS[a.kind];
              return (
                <li key={a.kind}>
                  <Link
                    href={a.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                  >
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 text-sm font-medium text-slate-900 tabular-nums">
                      {a.label}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Footer — snooze + opt-out */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSnooze}
              className="text-sm text-slate-600 hover:text-slate-900 font-medium py-2.5 sm:py-1 text-left min-h-[44px] sm:min-h-0"
            >
              Not today
            </button>
            <button
              type="button"
              onClick={handleOptOut}
              className="text-xs text-slate-400 hover:text-slate-600 py-2.5 sm:py-1 text-left sm:text-right min-h-[44px] sm:min-h-0"
            >
              Don&rsquo;t show me this again
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function headerCopy(actionCount: number, totalCount: number): string {
  if (actionCount === 1) {
    return `One thing waiting for you`;
  }
  // tabular-nums in className keeps the number alignment crisp.
  return `${totalCount} things waiting for you`;
}
