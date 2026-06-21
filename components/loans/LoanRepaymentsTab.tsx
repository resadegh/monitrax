'use client';

/**
 * Phase 51.1 — Loan Repayments tab (build increment 4).
 *
 * The loan-detail "Repayments" tab. Renders the loan's own ledger
 * (interest charged + repayments received), the FY summary (interest = the
 * actual deductible figure), and an INLINE import affordance — folded in here
 * per Reza's decision (no standalone dialog). Suggested offset↔loan matches are
 * confirmed inline (one tap), mirroring the bulk-approve pattern.
 *
 * Stitch design: screen 309e4b0c5df54b38936fb07af5ed140b (Repayments tab) +
 * f160bad2…b8d (import affordance) — project 1859462351962811110. Uses semantic
 * tokens (bg-card / foreground / muted) so it renders in both light + dark.
 * Loan accent = amber→rose; emerald reserved for the deductible-interest signal.
 *
 * See docs/blueprint/PHASE_51_LOAN_LEDGER_AND_CATEGORISATION.md §9.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Link2, Loader2, Check, X, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { formatCurrency } from '@/lib/utils/formatters';

interface LedgerRow {
  id: string;
  date: string;
  amount: number;
  direction: 'IN' | 'OUT';
  kind: 'INTEREST_CHARGED' | 'REPAYMENT_RECEIVED' | 'FEE' | 'REDRAW' | 'OTHER';
  description: string | null;
  balanceAfter: number | null;
  interestPortion: number | null;
  principalPortion: number | null;
  matchStatus: 'UNMATCHED' | 'SUGGESTED' | 'LINKED' | 'DISMISSED';
  matchConfidence: number | null;
  matchedTransactionId: string | null;
}

interface LedgerSummary {
  fyLabel: string;
  interestThisFy: number;
  principalPaid: number;
  currentBalance: number;
  suggestedCount: number;
}

const KIND_LABEL: Record<LedgerRow['kind'], string> = {
  INTEREST_CHARGED: 'Interest',
  REPAYMENT_RECEIVED: 'Repayment',
  FEE: 'Fee',
  REDRAW: 'Redraw',
  OTHER: 'Other',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function LoanRepaymentsTab({ loanId }: { loanId: string }) {
  const { token } = useAuth();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | 'import' | 'match'>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const authHeaders = useCallback(
    (): HeadersInit | undefined => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/loans/${loanId}/ledger`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not load the ledger');
      setRows(json.data.rows);
      setSummary(json.data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the ledger');
    } finally {
      setLoading(false);
    }
  }, [loanId, authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFile = async (file: File) => {
    setBusy('import');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/loans/${loanId}/ledger/import`, { method: 'POST', headers: authHeaders(), body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Import failed');
      await load();
      // After importing, immediately look for offset matches.
      await findMatches();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const findMatches = async () => {
    setBusy('match');
    try {
      const res = await fetch(`/api/loans/${loanId}/ledger/match`, { method: 'POST', headers: authHeaders() });
      if (res.ok) await load();
    } finally {
      setBusy(null);
    }
  };

  const resolve = async (loanTransactionId: string, accept: boolean) => {
    const res = await fetch(`/api/loans/${loanId}/ledger/match`, {
      method: 'PATCH',
      headers: { ...(authHeaders() ?? {}), 'Content-Type': 'application/json' },
      body: JSON.stringify({ loanTransactionId, accept }),
    });
    if (res.ok) await load();
  };

  return (
    <div className="space-y-4 pt-4">
      {/* Inline import affordance (folded in — no separate dialog) */}
      <div className="rounded-[14px] border border-rose-500/20 bg-gradient-to-br from-amber-50/60 to-rose-50/40 dark:from-amber-500/[0.06] dark:to-rose-500/[0.06] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-sm">
            <Upload className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Import this loan&rsquo;s statement</p>
            <p className="text-xs text-muted-foreground">QIF, CSV or OFX — interest + repayments</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".qif,.csv,.ofx,.qfx,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-[14px] bg-gradient-to-br from-amber-500 to-rose-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === 'import' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {busy === 'import' ? 'Importing…' : 'Choose file'}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          These stay on the loan — out of your spending and categories.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 dark:bg-rose-950/40 p-2 text-xs text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-900">
          {error}
        </div>
      )}

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-[14px] border border-border bg-card/70 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Interest this FY</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-semibold tabular-nums text-foreground">{formatCurrency(summary.interestThisFy)}</span>
              {summary.interestThisFy > 0 && (
                <span className="rounded-full bg-emerald-500/14 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
                  Deductible
                </span>
              )}
            </div>
          </div>
          <div className="rounded-[14px] border border-border bg-card/70 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Principal paid</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatCurrency(summary.principalPaid)}</p>
            <p className="text-[11px] text-muted-foreground">reduces balance</p>
          </div>
          <div className="rounded-[14px] border border-border bg-card/70 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Current balance</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatCurrency(summary.currentBalance)}</p>
          </div>
        </div>
      )}

      {/* Ledger */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No loan transactions yet — import this loan&rsquo;s statement above to track repayments and interest.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-right font-medium">Interest</th>
                <th className="px-3 py-2 text-right font-medium">Principal</th>
                <th className="px-3 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2 text-foreground">{KIND_LABEL[r.kind]}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">{formatCurrency(r.amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {r.interestPortion != null ? formatCurrency(r.interestPortion) : r.kind === 'INTEREST_CHARGED' ? formatCurrency(r.amount) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {r.principalPortion != null ? formatCurrency(r.principalPortion) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.kind !== 'REPAYMENT_RECEIVED' ? (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    ) : r.matchStatus === 'LINKED' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-300">
                        <Link2 className="h-3 w-3" /> Linked
                      </span>
                    ) : r.matchStatus === 'SUGGESTED' ? (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void resolve(r.id, true)}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-500/14 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
                          title="Confirm this match"
                        >
                          <Check className="h-3 w-3" /> Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => void resolve(r.id, false)}
                          className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                          title="Not a match"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Unmatched</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer + find-matches */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Interest shown is the actual amount charged on your statement — the figure your accountant uses.
        </p>
        {rows.some((r) => r.kind === 'REPAYMENT_RECEIVED') && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void findMatches()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[14px] border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {busy === 'match' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Find offset matches
          </button>
        )}
      </div>
    </div>
  );
}
