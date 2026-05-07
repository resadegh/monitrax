/**
 * Phase 42 PR1 — Monthly Review pill (minimal UI affordance).
 *
 * Lives on the Activity page header. Shows the user the current
 * month's review state and lets them mark it as reviewed in one
 * click. The full engagement surface (Daily Pulse card on Home,
 * streak, micro-celebrations, completion confetti) ships in PR6.
 * This is the foundational hook so the API + period state machine
 * have a real consumer from day one.
 *
 * Three visual states map to BookkeepingPeriodStatus:
 *   OPEN     — soft slate pill: "Mark October reviewed →"
 *   REVIEWED — emerald pill with ✓: "October reviewed"
 *   LOCKED   — amber pill with lock icon: "October locked"
 *
 * Per the PR6 chore-vs-ritual test (§6.9 of the spec), this pill is
 * deliberately one-tap: no confirmation modal, no second-tier UI.
 * Toast confirms the transition (5s undo window).
 */

'use client';

import { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface MonthlyReviewPillProps {
  /** "YYYY-MM" — defaults to the current month if omitted */
  month?: string;
  /** Called after the API mutation succeeds, so the parent can refresh counters / show a toast */
  onChange?: (status: PeriodStatus, transitioned: boolean) => void;
}

type PeriodStatus = 'OPEN' | 'REVIEWED' | 'LOCKED';

interface PeriodResponse {
  success: boolean;
  data?: {
    status: PeriodStatus;
    periodMonth: string;
    reviewedTransactionCount: number;
    totalTransactionCount: number;
    transitioned?: boolean;
  };
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map((s) => Number.parseInt(s, 10));
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString('en-AU', { month: 'long', timeZone: 'UTC' });
}

export function MonthlyReviewPill({ month, onChange }: MonthlyReviewPillProps) {
  const { token } = useAuth();
  const monthKey = month ?? currentMonthKey();
  const [status, setStatus] = useState<PeriodStatus | null>(null);
  const [counts, setCounts] = useState<{ reviewed: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/bookkeeping/periods/${monthKey}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        const json = (await res.json()) as PeriodResponse;
        if (cancelled || !json.success || !json.data) return;
        setStatus(json.data.status);
        setCounts({
          reviewed: json.data.reviewedTransactionCount,
          total: json.data.totalTransactionCount,
        });
      } catch {
        // Quiet failure — the pill simply doesn't render
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [monthKey, token]);

  if (status === null) return null;

  async function transition(action: 'mark_reviewed' | 'unlock') {
    if (busy || !token) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bookkeeping/periods/${monthKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as PeriodResponse;
      if (json.success && json.data) {
        setStatus(json.data.status);
        onChange?.(json.data.status, json.data.transitioned ?? false);
      }
    } finally {
      setBusy(false);
    }
  }

  const label = monthLabel(monthKey);
  const completionPct =
    counts && counts.total > 0 ? Math.round((counts.reviewed / counts.total) * 100) : 0;

  if (status === 'LOCKED') {
    return (
      <button
        type="button"
        onClick={() => transition('unlock')}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-60"
        title="Unlock this month to allow edits again"
      >
        <Lock className="w-3.5 h-3.5" aria-hidden />
        {label} locked · tap to unlock
      </button>
    );
  }

  if (status === 'REVIEWED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Check className="w-3.5 h-3.5" aria-hidden />
        {label} reviewed
      </span>
    );
  }

  // OPEN — invite, don't shame
  return (
    <button
      type="button"
      onClick={() => transition('mark_reviewed')}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-colors disabled:opacity-60"
    >
      {counts && counts.total > 0
        ? `Mark ${label} reviewed · ${completionPct}% caught up`
        : `Mark ${label} reviewed`}
    </button>
  );
}
