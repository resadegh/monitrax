'use client';

/**
 * Housekeeping → Duplicate records — same-source duplicate groups with the
 * Reza-gated per-group MERGE-WITH-EDIT (Mechanism A Part 2 + Fix B).
 *
 * Fix B (2026-07-23): the flat kept/removed table became the approved
 * two-zone composition — a dominant emerald "KEEPING" panel where the
 * surviving row's Amount / Frequency / One-off⇄Recurring are inline-editable
 * (corrections apply AS PART OF the merge — QBE monthly→one-off, Mate
 * one-off→recurring), and a muted "REMOVING" panel with struck-through
 * rows. A recap chip makes any survivor edit explicit at confirm time; the
 * typed-MERGE gate and per-group-only confirm are unchanged (§12.11).
 * Tab renamed "Duplicate income" → "Duplicate records" (the list holds
 * expense groups too).
 *
 * Merge + edit semantics live server-side: `lib/intake/duplicateMerge.ts`
 * via `GET/POST /api/intake/duplicates` (server re-derivation + GROUP_STALE,
 * survivorEdits validated + applied to the survivor only, same transaction).
 *
 * Design: Stitch screen 1ebd1ea29fb0434d8268d9d9d1b45e38, project
 * 1859462351962811110 (§18.8 9.1/10, PR #1486) — supersedes the table view
 * from screen 124c6e36… (PR #1477) for this tab.
 *
 * @see docs/issues/handoffs/HANDOFF_dedup-accuracy-and-merge-edit.md (Fix B)
 * @see app/api/intake/duplicates/route.ts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatters';
import { HousekeepingShell } from '../HousekeepingShell';
import { VALID_FREQUENCIES } from '@/lib/intake/duplicateMerge';

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

interface EditState {
  amount: string;
  frequency: string;
  isRecurring: boolean;
}

const FREQ_LABELS: Record<string, string> = {
  WEEKLY: 'Weekly',
  FORTNIGHTLY: 'Fortnightly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUAL: 'Annual',
  HALF_YEARLY: 'Half-yearly',
};

const cadenceLabel = (r: { frequency: string; isRecurring?: boolean | null }) =>
  r.isRecurring === false ? 'One-off' : (FREQ_LABELS[r.frequency] ?? r.frequency);

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
  const [edits, setEdits] = useState<Record<string, EditState>>({});

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

  const survivorOf = (g: PreviewGroup) => g.rows.find((r) => r.id === g.survivorId);

  const editFor = (g: PreviewGroup): EditState => {
    const existing = edits[g.groupId];
    if (existing) return existing;
    const s = survivorOf(g);
    return {
      amount: String(s?.amount ?? 0),
      frequency: s?.frequency ?? 'MONTHLY',
      isRecurring: s?.isRecurring !== false,
    };
  };

  const setEdit = (groupId: string, patch: Partial<EditState>, g: PreviewGroup) =>
    setEdits((e) => ({ ...e, [groupId]: { ...editFor(g), ...(e[groupId] ?? {}), ...patch } }));

  /** The fields that actually differ from the survivor's current values —
   *  drives the recap chip AND the request payload (untouched merge sends
   *  no survivorEdits and behaves exactly as before). */
  const changedEdits = (g: PreviewGroup) => {
    const s = survivorOf(g);
    if (!s) return null;
    const e = editFor(g);
    const out: { amount?: number; frequency?: string; isRecurring?: boolean } = {};
    const parsed = Number.parseFloat(e.amount);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed !== s.amount) out.amount = parsed;
    if (e.frequency !== s.frequency) out.frequency = e.frequency;
    if (e.isRecurring !== (s.isRecurring !== false)) out.isRecurring = e.isRecurring;
    return Object.keys(out).length > 0 ? out : null;
  };

  const recapText = (g: PreviewGroup) => {
    const c = changedEdits(g);
    if (!c) return null;
    const parts: string[] = [];
    if (c.amount !== undefined) parts.push(`amount → ${formatCurrency(c.amount)}`);
    if (c.isRecurring !== undefined && c.isRecurring === false) parts.push('type → One-off');
    else if (c.frequency !== undefined) parts.push(`frequency → ${FREQ_LABELS[c.frequency] ?? c.frequency}`);
    else if (c.isRecurring === true) parts.push(`type → Recurring (${FREQ_LABELS[editFor(g).frequency] ?? editFor(g).frequency})`);
    return parts.length > 0 ? `will also update: ${parts.join(' · ')}` : null;
  };

  const runMerge = async (g: PreviewGroup) => {
    if (!token) return;
    setMerging(g.groupId);
    setError(null);
    try {
      const survivorEdits = changedEdits(g);
      const res = await fetch('/api/intake/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind: g.kind,
          survivorId: g.survivorId,
          mergeIds: g.mergeIds,
          confirm: 'MERGE',
          ...(survivorEdits ? { survivorEdits } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.data) throw new Error(body?.error || 'Merge failed — no rows were changed');
      const editedNote = (body.data.survivorEditedFields ?? []).length > 0
        ? ` · kept record updated (${(body.data.survivorEditedFields as string[]).join(', ')})`
        : '';
      setDone((d) => ({
        ...d,
        [g.groupId]: `Merged — ${body.data.deleted} duplicate row(s) removed${editedNote}`,
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
        When the same real source is recorded more than once, the copies inflate your totals. Merge
        each group into one row — links are repointed, nothing is lost, and nothing merges until
        you confirm.
      </p>

      {error && (
        <p className="mb-4 rounded-[14px] border border-red-500/20 bg-red-500/5 p-4 text-[14px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {loading && <p className="text-[14px] text-muted-foreground">Scanning your income and expense rows…</p>}

      {!loading && groups && groups.length === 0 && (
        <div className="rounded-[22px] border border-foreground/10 bg-card/70 p-10 text-center backdrop-blur-xl">
          <p className="text-[18px] font-semibold text-foreground">Nothing to merge</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">
            No records look like duplicates right now.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {groups?.map((g) => {
          const expanded = confirming === g.groupId;
          const survivor = survivorOf(g);
          const removed = g.rows.filter((r) => r.id !== g.survivorId);
          const e = editFor(g);
          const recap = recapText(g);
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
                {survivor?.name ?? g.rows[0]?.name ?? ''} — {g.rows.length} copies → 1 record
              </p>

              {expanded ? (
                <>
                  {/* KEEPING — the surviving record, inline-editable */}
                  <div className="mt-4 rounded-[14px] border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                        Keeping
                      </span>
                      <span className="text-[15px] font-semibold text-foreground">{survivor?.name}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-[12px] font-medium text-muted-foreground">Amount</span>
                        <input
                          value={e.amount}
                          onChange={(ev) => setEdit(g.groupId, { amount: ev.target.value }, g)}
                          inputMode="decimal"
                          className="w-32 rounded-[12px] border border-foreground/15 bg-background px-3 py-2 text-[14px] tabular-nums text-foreground focus:border-emerald-500/60 focus:outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[12px] font-medium text-muted-foreground">Frequency</span>
                        <select
                          value={e.frequency}
                          onChange={(ev) => setEdit(g.groupId, { frequency: ev.target.value }, g)}
                          disabled={!e.isRecurring}
                          className="rounded-[12px] border border-foreground/15 bg-background px-3 py-2 text-[14px] text-foreground focus:border-emerald-500/60 focus:outline-none disabled:opacity-50"
                        >
                          {VALID_FREQUENCIES.map((f) => (
                            <option key={f} value={f}>{FREQ_LABELS[f] ?? f}</option>
                          ))}
                        </select>
                      </label>
                      <div className="flex flex-col gap-1">
                        <span className="text-[12px] font-medium text-muted-foreground">Type</span>
                        <div className="flex rounded-full border border-foreground/15 bg-background p-0.5">
                          {([['One-off', false], ['Recurring', true]] as const).map(([label, rec]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setEdit(g.groupId, { isRecurring: rec }, g)}
                              className={cn(
                                'rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                                e.isRecurring === rec
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="mt-2.5 text-[12px] italic text-muted-foreground">
                      This is the record you&apos;ll keep — correct its amount or how often it repeats if needed.
                    </p>
                  </div>

                  {/* REMOVING — the copies that fold into the record above */}
                  <div className="mt-3 rounded-[14px] border border-foreground/10 bg-foreground/[0.04] p-4">
                    <span className="rounded-full bg-foreground/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Removing
                    </span>
                    <ul className="mt-2.5 space-y-1.5">
                      {removed.map((r) => (
                        <li key={r.id} className="text-[14px] text-muted-foreground">
                          <span className="line-through decoration-foreground/30">
                            {r.name} · <span className="tabular-nums">{formatCurrency(r.amount)}</span> · {cadenceLabel(r)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[12px] text-muted-foreground/80">
                      merges into the record above · links repointed
                    </p>
                  </div>

                  <p className="mt-3 text-[13px] text-muted-foreground">
                    Declared annual effect:{' '}
                    <span className="tabular-nums font-medium text-foreground">{formatCurrency(g.annualDeclaredEffect)}</span>
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Keeping: <span className="tabular-nums">{formatCurrency(survivor?.amount ?? 0)}</span> ·{' '}
                  {survivor ? cadenceLabel(survivor) : ''} — Removing: {removed.length}{' '}
                  {removed.length === 1 ? 'copy' : 'copies'}
                </p>
              )}

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
                    {recap && (
                      <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[12px] font-medium text-amber-700 dark:text-amber-300">
                        {recap}
                      </span>
                    )}
                    <input
                      value={confirmText}
                      onChange={(ev) => setConfirmText(ev.target.value)}
                      placeholder="Type MERGE to confirm"
                      className="w-56 rounded-[14px] border border-foreground/15 bg-background px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:border-emerald-500/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void runMerge(g)}
                      disabled={confirmText !== 'MERGE' || merging === g.groupId}
                      className={cn(
                        'rounded-[14px] px-4 py-2 text-[14px] font-medium transition-colors',
                        confirmText === 'MERGE' && merging !== g.groupId
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'cursor-not-allowed bg-foreground/10 text-muted-foreground',
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
                    <span className="basis-full text-[12px] text-muted-foreground/80">
                      Nothing merges until you confirm.
                    </span>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(g.groupId)}
                    className="rounded-[14px] border border-emerald-600/40 bg-background/60 px-4 py-2 text-[14px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/5 dark:text-emerald-300"
                  >
                    Review &amp; merge
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
