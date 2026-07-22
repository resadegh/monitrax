'use client';

/**
 * Housekeeping → Tax classification — non-assessable receipt review.
 *
 * MON-094 relocation: this page REPLACES the deleted staff-admin
 * `/admin/tax-review` surface (VR-021 FAIL — the admin portal
 * authenticates as a different principal, so the user-scoped query ran
 * empty). Here the page runs under the user's OWN session token, so the
 * suggestions are the user's own income rows.
 *
 * Consumes `GET/POST /api/tax/non-assessable-review` (user-permissioned:
 * income.read / income.write, keyed on the session's userId). Detection +
 * assessability are decided server-side (the ONE detector + the ONE tax
 * engine); this page only renders and carries the per-row typed
 * RECLASSIFY confirmation — there is deliberately no confirm-all.
 *
 * Design: Stitch screen 124c6e36cc8d4289ad7d152edd29d1ef, project
 * 1859462351962811110 (PR #1477, §18.8 9.2/10).
 *
 * @see docs/issues/ISSUES.md MON-094
 * @see app/api/tax/non-assessable-review/route.ts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { Landmark, ArrowRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatters';
import { HousekeepingShell } from '../HousekeepingShell';

interface Suggestion {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
  isRecurring: boolean | null;
  currentTaxCategory: string | null;
  suggestedTaxCategory: string;
  kind: 'ATO_REFUND' | 'INTERNAL_TRANSFER' | 'LOAN_DRAWDOWN';
  reason: string;
  annualEffect: number;
}

const KIND_LABEL: Record<Suggestion['kind'], string> = {
  ATO_REFUND: 'ATO tax refund',
  INTERNAL_TRANSFER: 'Internal transfer',
  LOAN_DRAWDOWN: 'Loan drawdown',
};

export default function HousekeepingTaxPage() {
  const { token } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [totalEffect, setTotalEffect] = useState(0);
  const [dupCount, setDupCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [applying, setApplying] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const fetchPreview = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [reviewRes, dupRes] = await Promise.all([
        fetch('/api/tax/non-assessable-review', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/intake/duplicates', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const review = await reviewRes.json();
      if (!reviewRes.ok || !review?.data) throw new Error(review?.error || 'Failed to load');
      setSuggestions(review.data.suggestions);
      setTotalEffect(review.data.totalAnnualEffect ?? 0);
      const dup = await dupRes.json().catch(() => null);
      setDupCount(dup?.data?.groups?.length ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the review');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  const runReclassify = async (s: Suggestion) => {
    if (!token) return;
    setApplying(s.id);
    setError(null);
    try {
      const res = await fetch('/api/tax/non-assessable-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: [s.id], confirm: 'RECLASSIFY' }),
      });
      const body = await res.json();
      if (!res.ok || !body?.data) throw new Error(body?.error || 'Reclassification failed — no rows were changed');
      setDone((d) => ({ ...d, [s.id]: true }));
      void fetchPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reclassification failed');
    } finally {
      setApplying(null);
      setConfirming(null);
      setConfirmText('');
    }
  };

  const pending = suggestions?.filter((s) => !done[s.id]) ?? [];

  return (
    <HousekeepingShell
      counts={{
        '/dashboard/housekeeping/tax': pending.length,
        '/dashboard/housekeeping/duplicates': dupCount,
      }}
    >
      <p className="mb-6 max-w-3xl rounded-[14px] border border-foreground/10 bg-card/70 p-5 text-[14px] leading-relaxed text-muted-foreground backdrop-blur-xl">
        Some receipts look like they aren&apos;t assessable income — ATO refunds, transfers
        between your own accounts, or loan drawdowns. Confirm each one to leave it out of your
        taxable income.
      </p>

      {error && (
        <p className="mb-4 rounded-[14px] border border-red-500/20 bg-red-500/5 p-4 text-[14px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {loading && <p className="text-[14px] text-muted-foreground">Scanning your income rows…</p>}

      {!loading && pending.length > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-[14px] border border-foreground/10 bg-card/70 p-4 backdrop-blur-xl">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-[14px] text-muted-foreground">
            Confirming the flagged receipts below removes about{' '}
            <span className="bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text font-semibold tabular-nums text-transparent">
              {formatCurrency(totalEffect)}
            </span>{' '}
            from your taxable income.
          </p>
        </div>
      )}

      {!loading && suggestions && pending.length === 0 && (
        <div className="rounded-[22px] border border-foreground/10 bg-card/70 p-10 text-center backdrop-blur-xl">
          <p className="text-[18px] font-semibold text-foreground">Nothing to review</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">
            No receipt matches the non-assessable detector, or every match already carries its
            classification.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {pending.map((s) => {
          const expanded = confirming === s.id;
          return (
            <div
              key={s.id}
              className="relative overflow-hidden rounded-[22px] border border-foreground/10 bg-card/70 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
            >
              {/* 3px amber→rose top-accent — the Housekeeping identity */}
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 to-rose-400" />

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                    {s.name}
                  </p>
                  <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-foreground">
                    {formatCurrency(s.amount)}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[12px] font-medium text-amber-700 dark:text-amber-300">
                  <Landmark className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {KIND_LABEL[s.kind]}
                </span>
              </div>

              <p className="mt-2 max-w-2xl text-[13px] text-muted-foreground">{s.reason}</p>

              {/* Before → after (neutral until confirmed — emerald is for done) */}
              <div className="mt-4 flex items-center gap-4 rounded-[12px] border border-foreground/10 bg-background/50 p-4">
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-muted-foreground">Currently</p>
                  <p className="text-[14px] text-foreground">Counted as taxable</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-muted-foreground">After confirmation</p>
                  <p className="text-[14px] font-medium text-foreground">
                    <span className="tabular-nums">$0</span> taxable
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {expanded ? (
                  <>
                    <input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Type RECLASSIFY to confirm"
                      className="w-64 rounded-[14px] border border-foreground/15 bg-background px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:border-amber-500/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void runReclassify(s)}
                      disabled={confirmText !== 'RECLASSIFY' || applying === s.id}
                      className={cn(
                        'rounded-[14px] px-4 py-2 text-[14px] font-medium transition-colors',
                        confirmText === 'RECLASSIFY' && applying !== s.id
                          ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white hover:opacity-90'
                          : 'cursor-not-allowed bg-foreground/10 text-muted-foreground'
                      )}
                    >
                      {applying === s.id ? 'Applying…' : 'Confirm — not taxable income'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(null);
                        setConfirmText('');
                      }}
                      className="text-[14px] text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(s.id)}
                    className="rounded-[14px] border border-foreground/15 bg-background/60 px-4 py-2 text-[14px] font-medium text-foreground transition-colors hover:bg-background"
                  >
                    Reclassify…
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {Object.keys(done).length > 0 && (
        <p className="mt-6 text-[14px] font-medium text-emerald-600 dark:text-emerald-400">
          Reclassified — these receipts no longer count in your taxable income.
        </p>
      )}
    </HousekeepingShell>
  );
}
