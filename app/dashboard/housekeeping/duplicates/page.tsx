'use client';

/**
 * Housekeeping → Duplicate income — same-source duplicate groups with the
 * Reza-gated per-group merge (Mechanism A Part 2, MON-074/076).
 *
 * MON-094 relocation: this page REPLACES the deleted staff-admin
 * `/admin/intake-duplicates` surface (VR-021 principal-mismatch class) —
 * it runs under the user's OWN session token, so the groups are the
 * user's own income/expense rows. Merge SEMANTICS ARE UNCHANGED: the
 * preview + execution live in `lib/intake/duplicateMerge.ts` via
 * `GET/POST /api/intake/duplicates` (user-permissioned, per-group typed
 * MERGE confirm, server-side re-derivation, NO merge-all).
 *
 * Design: Stitch screen 124c6e36cc8d4289ad7d152edd29d1ef, project
 * 1859462351962811110 (PR #1477, §18.8 9.2/10) — the Duplicate-income
 * tab of the Housekeeping hub.
 *
 * @see docs/issues/ISSUES.md MON-094 · MON-074/076 (merge tool KEPT permanently)
 * @see app/api/intake/duplicates/route.ts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatters';
import { HousekeepingShell } from '../HousekeepingShell';

interface PreviewRow {
  id: string;
  name: string;
  type?: string | null;
  amount: number;
  frequency: string;
  isRecurring?: boolean | null;
  propertyId?: string | null;
  loanId?: string | null;
  assetId?: string | null;
  investmentAccountId?: string | null;
  createdAt: string;
}

interface PreviewGroup {
  groupId: string;
  kind: 'income' | 'expense';
  type: string;
  survivorId: string;
  rows: PreviewRow[];
  mergeIds: string[];
  annualDeclaredEffect: number;
  warnings: string[];
}

export default function HousekeepingDuplicatesPage() {
  const { token } = useAuth();
  const [groups, setGroups] = useState<PreviewGroup[] | null>(null);
  const [taxCount, setTaxCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [merging, setMerging] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});

  const fetchPreview = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [dupRes, taxRes] = await Promise.all([
        fetch('/api/intake/duplicates', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/tax/non-assessable-review', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const dup = await dupRes.json();
      if (!dupRes.ok || !dup?.data) throw new Error(dup?.error || 'Failed to load');
      setGroups(dup.data.groups);
      const tax = await taxRes.json().catch(() => null);
      setTaxCount(tax?.data?.suggestions?.length ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the duplicate preview');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  const runMerge = async (g: PreviewGroup) => {
    if (!token) return;
    setMerging(g.groupId);
    setError(null);
    try {
      const res = await fetch('/api/intake/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind: g.kind,
          survivorId: g.survivorId,
          mergeIds: g.mergeIds,
          confirm: 'MERGE',
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.data) throw new Error(body?.error || 'Merge failed — no rows were changed');
      setDone((d) => ({
        ...d,
        [g.groupId]: `Merged — ${body.data.deleted} duplicate row(s) removed`,
      }));
      void fetchPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed');
    } finally {
      setMerging(null);
      setConfirming(null);
      setConfirmText('');
    }
  };

  return (
    <HousekeepingShell
      counts={{
        '/dashboard/housekeeping/tax': taxCount,
        '/dashboard/housekeeping/duplicates': groups?.length ?? 0,
      }}
    >
      <p className="mb-6 max-w-3xl rounded-[14px] border border-foreground/10 bg-card/70 p-5 text-[14px] leading-relaxed text-muted-foreground backdrop-blur-xl">
        When the same real income or expense source ends up as more than one record, the copies
        inflate your declared totals. Each group below merges into one canonical row — links are
        repointed, nothing is lost, and nothing merges without your confirmation.
      </p>

      {error && (
        <p className="mb-4 rounded-[14px] border border-red-500/20 bg-red-500/5 p-4 text-[14px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {loading && <p className="text-[14px] text-muted-foreground">Scanning your income and expense rows…</p>}

      {!loading && groups && groups.length === 0 && (
        <div className="rounded-[22px] border border-foreground/10 bg-card/70 p-10 text-center backdrop-blur-xl">
          <p className="text-[18px] font-semibold text-foreground">No duplicate income sources found</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">
            Every income and expense source resolves to one canonical row.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {groups?.map((g) => {
          const expanded = confirming === g.groupId;
          return (
            <div
              key={g.groupId}
              className="relative overflow-hidden rounded-[22px] border border-foreground/10 bg-card/70 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
            >
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 to-rose-400" />

              <p className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                {g.kind === 'income' ? 'Income' : 'Expense'} · {g.type}
              </p>
              <p className="mt-1 text-[18px] font-semibold text-foreground">
                {g.rows[0]?.name ?? ''} — {g.rows.length} copies → 1 canonical row
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Declared annual effect: <span className="tabular-nums">{formatCurrency(g.annualDeclaredEffect)}</span>
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1.5 pr-4 font-medium">Row</th>
                      <th className="py-1.5 pr-4 font-medium">Amount</th>
                      <th className="py-1.5 pr-4 font-medium">Cadence</th>
                      <th className="py-1.5 pr-4 font-medium">Scope</th>
                      <th className="py-1.5 font-medium">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => {
                      const survivor = r.id === g.survivorId;
                      const scope =
                        r.propertyId ?? r.loanId ?? r.investmentAccountId ?? r.assetId ?? null;
                      return (
                        <tr key={r.id} className="border-t border-foreground/5">
                          <td className="py-2 pr-4 font-medium text-foreground">{r.name}</td>
                          <td className="py-2 pr-4 tabular-nums text-foreground">{formatCurrency(r.amount)}</td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {r.isRecurring === false ? 'One-off' : r.frequency}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">{scope ? 'Scoped' : 'General'}</td>
                          <td className="py-2">
                            {survivor ? (
                              <span className="rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
                                Kept (canonical)
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-500/12 px-2.5 py-0.5 text-[12px] font-medium text-amber-700 dark:text-amber-300">
                                Removed — links repointed
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {g.warnings.length > 0 && (
                <ul className="mt-3 space-y-0.5 text-[12px] text-amber-700 dark:text-amber-300">
                  {g.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {done[g.groupId] ? (
                  <p className="text-[14px] font-medium text-emerald-600 dark:text-emerald-400">
                    {done[g.groupId]}
                  </p>
                ) : expanded ? (
                  <>
                    <input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Type MERGE to confirm"
                      className="w-56 rounded-[14px] border border-foreground/15 bg-background px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:border-amber-500/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void runMerge(g)}
                      disabled={confirmText !== 'MERGE' || merging === g.groupId}
                      className={cn(
                        'rounded-[14px] px-4 py-2 text-[14px] font-medium transition-colors',
                        confirmText === 'MERGE' && merging !== g.groupId
                          ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white hover:opacity-90'
                          : 'cursor-not-allowed bg-foreground/10 text-muted-foreground'
                      )}
                    >
                      {merging === g.groupId ? 'Merging…' : 'Confirm merge'}
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
                    onClick={() => setConfirming(g.groupId)}
                    className="rounded-[14px] border border-foreground/15 bg-background/60 px-4 py-2 text-[14px] font-medium text-foreground transition-colors hover:bg-background"
                  >
                    Review &amp; merge…
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </HousekeepingShell>
  );
}
