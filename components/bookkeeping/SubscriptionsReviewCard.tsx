'use client';

/**
 * Phase 49.11 — "Possible subscriptions" review card.
 *
 * The dedicated confirm-subscriptions surface Reza approved 2026-06-11
 * ("a dedicated tile will be great"). Lists the detected recurring-payment
 * patterns that aren't linked to a bill yet (RecurringPayment with
 * matchStatus UNMATCHED/SUGGESTED — the exact pile the Home pending-actions
 * tile counts) and offers ONE clear action per pattern: Confirm bill
 * (creates a SUBSCRIPTION expense and links it — feeding the bills
 * forecast) or dismiss. When the matcher found an existing expense, the
 * row shows the match hint and the action becomes "Link bill".
 *
 * Stitch design source (CLAUDE.md §18.4 / §18.2.1): project
 * 1859462351962811110, screens 9195bf71fd7f4e2595194746dfe59f51 (desktop
 * light) / 3fd759a52bdc432ea0e817f2080b4efb (desktop dark) /
 * 72af31e22ae3466e9d65cd46b95bb438 (mobile light) /
 * afec464ced754c72b7df7510f2db9cdd (mobile dark).
 * Artefacts: .stitch/designs/phase49.11/.
 *
 * Glass vocabulary per CLAUDE.md §18.7.2 — 28px radius, bg-card/70 +
 * backdrop-blur-xl, 3px teal→cyan top-accent (the recurring sub-palette,
 * distinct from the sky→indigo AI-bookkeeper card), 1px inner-top
 * highlight. Composes the canonical Phase 29 endpoints
 * (GET /api/recurring-payments/match, POST/PATCH
 * /api/recurring-payments/[id]/link) — no new business logic (§12.3).
 *
 * Self-hides when there is nothing to confirm.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarSync, Check, Link2, Loader2, X } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface SuggestedExpense {
  id: string;
  name: string;
}

interface MatchResultItem {
  recurringPaymentId: string;
  confidence: number;
  suggestedExpense: SuggestedExpense | null;
  recurringPayment: {
    id: string;
    merchantStandardised: string;
    pattern: string;
    expectedAmount: number;
    nextExpected: string | null;
    occurrenceCount: number;
    matchStatus: string;
  } | null;
}

const CADENCE_SUFFIX: Record<string, string> = {
  WEEKLY: '/wk',
  FORTNIGHTLY: '/fn',
  MONTHLY: '/mo',
  QUARTERLY: '/qtr',
  ANNUALLY: '/yr',
  IRREGULAR: '',
};

const CADENCE_LABEL: Record<string, string> = {
  WEEKLY: 'Weekly',
  FORTNIGHTLY: 'Fortnightly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUALLY: 'Annual',
  IRREGULAR: 'Irregular',
};

function formatAud(n: number): string {
  return Math.abs(n).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function SubscriptionsReviewCard({
  refreshKey,
  onActioned,
}: {
  /** Bump to re-fetch (e.g. after an import). */
  refreshKey?: number;
  /** Called after a confirm/link/dismiss so the parent can refresh counts. */
  onActioned?: () => void;
}) {
  const { token } = useAuth();
  const [items, setItems] = useState<MatchResultItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/recurring-payments/match', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setItems(
          (json.data as MatchResultItem[]).filter(
            (r) => r.recurringPayment && r.recurringPayment.matchStatus !== 'LINKED'
          )
        );
      }
    } catch {
      // Quiet — the card simply doesn't render without data.
    }
  }, [token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey]);

  const action = useCallback(
    async (item: MatchResultItem, kind: 'confirm' | 'dismiss') => {
      if (!token || busyId) return;
      const id = item.recurringPaymentId;
      setBusyId(id);
      try {
        const url = `/api/recurring-payments/${id}/link`;
        const res =
          kind === 'dismiss'
            ? await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
            : await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(
                  item.suggestedExpense
                    ? { expenseId: item.suggestedExpense.id, confidence: item.confidence }
                    : // No existing bill matched → create one. SUBSCRIPTION
                      // category + non-essential default (financial-adviser
                      // lens: a streaming/membership charge is discretionary
                      // until the user says otherwise).
                      { createExpense: true, category: 'SUBSCRIPTION', isEssential: false }
                ),
              });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) {
          setItems((prev) => prev?.filter((r) => r.recurringPaymentId !== id) ?? null);
          onActioned?.();
        }
      } catch {
        // Leave the row; the user can retry.
      } finally {
        setBusyId(null);
      }
    },
    [token, busyId, onActioned]
  );

  if (!items || items.length === 0) return null;

  return (
    <section className="relative mb-6 overflow-hidden rounded-[28px] border border-foreground/10 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)] anim-rise">
      {/* 3px teal→cyan top-accent strip — the recurring sub-palette */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal-400 to-cyan-500" />
      {/* 1px inner-top curved-glass highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-[3px] h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" />

      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent dark:from-teal-300 dark:to-cyan-300">
              Possible subscriptions
            </p>
            <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight">
              {items.length === 1
                ? '1 pattern looks like a subscription'
                : `${items.length} patterns look like subscriptions`}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Confirming adds them to your bills forecast — dismiss the ones that aren&apos;t really
              recurring.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center justify-center w-11 h-11 rounded-[14px] bg-gradient-to-br from-teal-400 to-cyan-500 text-white shadow-lg shadow-cyan-500/20 shrink-0">
            <CalendarSync className="w-5 h-5" />
          </span>
        </div>

        <div className="mt-4 divide-y divide-foreground/5">
          {items.map((item) => {
            const rp = item.recurringPayment!;
            const nextExpected = formatShortDate(rp.nextExpected);
            const busy = busyId === item.recurringPaymentId;
            const linkExisting = Boolean(item.suggestedExpense);
            return (
              <div key={item.recurringPaymentId} className="py-3 first:pt-0 last:pb-0">
                {/* Line 1 — identity + amount (mobile keeps these together,
                    actions drop to line 2; desktop is a single row) */}
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-[12px] bg-teal-500/10 text-teal-600 dark:text-teal-300 shrink-0">
                    <CalendarSync className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{rp.merchantStandardised}</p>
                    <p className="text-xs text-muted-foreground">
                      {CADENCE_LABEL[rp.pattern] ?? rp.pattern} · seen {rp.occurrenceCount} time
                      {rp.occurrenceCount === 1 ? '' : 's'}
                      {nextExpected ? ` · next expected ${nextExpected}` : ''}
                    </p>
                    {linkExisting && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-400/25">
                        <Link2 className="w-3 h-3" />
                        Matches your existing bill &lsquo;{item.suggestedExpense!.name}&rsquo;
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold tabular-nums shrink-0">
                    {formatAud(rp.expectedAmount)}
                    <span className="text-muted-foreground font-normal">
                      {CADENCE_SUFFIX[rp.pattern] ?? ''}
                    </span>
                  </p>
                  {/* Desktop actions inline */}
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => action(item, 'confirm')}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      {linkExisting ? 'Link bill' : 'Confirm bill'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => action(item, 'dismiss')}
                      aria-label={`Dismiss ${rp.merchantStandardised}`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground transition hover:text-foreground hover:bg-foreground/5 disabled:opacity-60"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Mobile actions — second line, ≥44px tap targets */}
                <div className="mt-2 flex items-center justify-end gap-2 sm:hidden">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => action(item, 'confirm')}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-md shadow-cyan-500/20 transition active:scale-[0.99] disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {linkExisting ? 'Link bill' : 'Confirm bill'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => action(item, 'dismiss')}
                    aria-label={`Dismiss ${rp.merchantStandardised}`}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground hover:bg-foreground/5 disabled:opacity-60"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 border-t border-foreground/5 pt-3 text-xs text-muted-foreground/80">
          Confirmed subscriptions feed your bills forecast in My Safety Net.
        </p>
      </div>
    </section>
  );
}
