/**
 * Phase 42 PR6.5b — Pending-actions strip (non-modal).
 *
 * Per Reza idea 2026-05-07 (the *what*): *"have the transaction
 * reconciliation and categorisation be popup when user login to be
 * completed"* — surface pending bundle at the right moment.
 *
 * Per Reza decision 2026-05-07 on review (the *how*, after Claude
 * pushed back on the modal pattern): "go with the non-modal strip."
 * Modal-on-login was flagged for behavioural-friction risk —
 * defensive-dismiss reflex (years of cookie banners), inbox-zero
 * anxiety as the daily first impression, anti-flow framing where
 * the app asks the user for chores before showing them value.
 *
 * Option A landed instead: a compact, *non-blocking* strip anchored
 * at the top of `/dashboard` that surfaces the same up-to-3 actions
 * (CATEGORISE > ANOMALY > RECURRING > RECEIPT). The user can scan,
 * tap, collapse, or ignore — the page remains fully interactive.
 *
 * Per CLAUDE.md §0:
 *   - Designer lens: Apple-glass tile; restraint over interruption;
 *     ≥44pt tap targets per Apple HIG; tabular-nums on counts.
 *   - Behaviour-psychologist lens: warm copy ("Today's quick wins"),
 *     present in flow rather than blocking it. Reduces cognitive tax
 *     by bundling, but never exacts an interruption cost. Collapse
 *     and opt-out always reachable so the strip never feels like a nag.
 *   - Architect lens: composes existing
 *     `/api/bookkeeping/engagement/pending-actions` route. Same SSOT
 *     aggregator + same once-per-day gate as the modal version. Per
 *     CLAUDE.md §12.3 — no parallel data path.
 *
 * Once-per-day gate behaviour preserved: `?action=shown` is still
 * fired on first render so the strip auto-collapses tomorrow if the
 * user manually collapses today (intentional — daily users don't
 * need both the strip and the Daily Pulse card asking for the same
 * thing).
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
 * Non-modal pending-actions strip. Drop-in mount on the dashboard
 * tree (e.g. above `<DailyPulseCard />`); manages its own lifecycle.
 */
export function PendingActionsPrompt() {
  const [visible, setVisible] = useState(false);
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
          setVisible(true);
          // Fire-and-forget — same once-per-day gate as the modal version.
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

  function handleCollapse() {
    setVisible(false);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch('/api/bookkeeping/engagement/pending-actions?action=dismiss', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
    }).catch(() => {});
  }

  function handleOptOut() {
    setVisible(false);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch('/api/bookkeeping/engagement/pending-actions?action=opt-out', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
    }).catch(() => {});
  }

  if (!visible || !data || data.actions.length === 0) return null;

  return (
    <section
      aria-label="Today's pending actions"
      className="rounded-3xl border border-emerald-100 bg-emerald-50/60 px-4 sm:px-5 py-4 mb-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-300"
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Today&rsquo;s quick wins
          </p>
          <p className="text-sm text-emerald-900/80 mt-0.5 leading-relaxed">
            {headerCopy(data.actions.length, data.totalCount)} — five seconds each.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCollapse}
          aria-label="Hide for today"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-emerald-700/60 hover:bg-emerald-100 active:bg-emerald-200 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {data.actions.map((a) => {
          const Icon = ICONS[a.kind];
          return (
            <li key={a.kind}>
              <Link
                href={a.href}
                className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl bg-white hover:bg-emerald-50 active:bg-emerald-100 border border-emerald-100 transition-colors min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 group"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="flex-1 text-sm font-medium text-slate-900 tabular-nums truncate">
                  {a.label}
                </span>
                <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0 group-hover:text-emerald-600 transition-colors" />
              </Link>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={handleOptOut}
        className="text-xs text-emerald-700/50 hover:text-emerald-800 mt-3 py-1 min-h-[28px]"
      >
        Don&rsquo;t show me this again
      </button>
    </section>
  );
}

function headerCopy(actionCount: number, totalCount: number): string {
  if (actionCount === 1) {
    return `One thing to clean up`;
  }
  return `${totalCount} small things to clean up`;
}
