'use client';

/**
 * SmartInbox — Phase 50 D.6 (bulk-approve), 2026-06-18.
 *
 * The "review what the AI found" surface for My Vault. Lists documents the
 * Document Intelligence Engine has recognised but the user hasn't confirmed yet
 * (analysis COMPLETED && !userVerified), and lets the user **bulk-approve** the
 * ones they're happy with — while keeping every item explicit and editable.
 *
 * AUTONOMY CONTRACT (Reza decision 2026-06-18 — load-bearing): the AI only
 * SUGGESTS. High-confidence (D.3 AUTO band) rows are PRE-SELECTED as a
 * convenience, but (a) the user always taps Approve, (b) any row can be unticked,
 * and (c) any row's fields can be edited before approving. Nothing is written
 * until the user approves. Bulk-approve is the ONLY convenience — it loops the
 * SAME per-item confirm path (no silent/background writes, no batch shortcut that
 * skips the confirm logic).
 *
 * SSOT: this component adds NO new write logic. It calls `onConfirm` (the page's
 * `handleConfirmAnalysis` → POST /api/documents/analyze/confirm) once per
 * approved item, so D.2 reconciliation + the receipt-matcher run per item exactly
 * as for a single confirm. No new endpoint (§12.4) — it reads the same
 * `/api/documents` analysis payload the page already has.
 *
 * MON-187/188 (M2 kept-depth PR-1): the row model + approve payload moved to
 * lib/documents/intelligence/inboxModel.ts — pure, typed against the
 * analyzer's OWN SuggestedAction shape (`action`, not the phantom `type` this
 * component used to read, which left every checkbox disabled), and the
 * payload is FLATTENED to the confirm route's flat contract. Done now
 * PERSISTS edits via `onPersistEdits` (PATCH /api/documents/analyze) so
 * corrections survive reload instead of living only in component state.
 *
 * Design: in-app "My Wealth glass" Track vocabulary (CLAUDE.md §18.7.2) — warm
 * ivory / deep-navy ground, sky→indigo Track mesh-glow header, glass card, 22px
 * radii, emerald/amber/slate confidence palette from `confidencePolicy` (D.3).
 * Stitch (project 1859462351962811110, §18.2.1): desktop light
 * `ded7fd42483e4944978eaec88e2d283e` · desktop dark `939521f984694b55984d3c423c28003a`
 * · mobile light `6ae7b7cb73874bae82e5d1d751d284b2` · mobile dark
 * `da7e1e4903c34517b0b26e79a32f74e8`. Artefacts: `.stitch/designs/phase50-smart-inbox/`.
 */

import { useMemo, useState, useCallback } from 'react';
import {
  Inbox,
  Sparkles,
  Check,
  Loader2,
  Pencil,
  ExternalLink,
  X,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildInboxRows,
  payloadFor as buildPayload,
  type InboxDocument,
  type InboxEdits,
  type InboxRowModel as RowModel,
} from '@/lib/documents/intelligence/inboxModel';

export type { InboxDocument };

interface SmartInboxProps {
  /** Documents awaiting review (analysis COMPLETED && !userVerified). */
  docs: InboxDocument[];
  /** SSOT confirm — POST /api/documents/analyze/confirm. Returns ok. */
  onConfirm: (analysisId: string, action: string, data: Record<string, unknown>) => Promise<boolean>;
  /** MON-188: persist inline edits (PATCH /api/documents/analyze) so Done
   *  survives reload. Returns ok; on false the edit panel stays open. */
  onPersistEdits: (analysisId: string, fields: InboxEdits) => Promise<boolean>;
  /** Open the source file (signed URL) in a new tab, by document id. */
  onOpen: (docId: string) => void;
}

function formatMoney(raw: string): string {
  const n = Number(String(raw).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n) || n === 0) return '';
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

const TONE_PILL: Record<RowModel['tone'], string> = {
  emerald: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25',
  amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-500/25',
  slate: 'bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/25',
};
const SHORT_BAND: Record<RowModel['band'], string> = { AUTO: 'High', CONFIRM: 'Check', ASK: 'Review' };

export function SmartInbox({ docs, onConfirm, onPersistEdits, onOpen }: SmartInboxProps) {
  // View model per doc — the PURE, analyzer-typed builder (MON-187: reads the
  // real `action` field; the local `.type` read left every checkbox disabled).
  const rows = useMemo<RowModel[]>(() => buildInboxRows(docs), [docs]);

  // Selection — AUTO-band rows pre-selected (earned-autonomy convenience).
  // Recomputed when the row set changes; user toggles override within a render.
  const autoIds = useMemo(
    () => rows.filter((r) => r.band === 'AUTO' && r.action).map((r) => r.doc.id),
    [rows],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(autoIds));
  const [syncedKey, setSyncedKey] = useState('');
  const rowsKey = rows.map((r) => r.doc.id).join(',');
  // Re-seed the pre-selection when the underlying inbox changes (e.g. after a
  // batch approves and the list shrinks) — without clobbering an in-flight edit.
  if (rowsKey !== syncedKey) {
    setSyncedKey(rowsKey);
    setSelected(new Set(autoIds));
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, InboxEdits>>({});
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const counts = useMemo(() => {
    let high = 0, check = 0, review = 0;
    for (const r of rows) {
      if (r.band === 'AUTO') high++;
      else if (r.band === 'CONFIRM') check++;
      else review++;
    }
    return { high, check, review };
  }, [rows]);

  /** Confirm payload — FLATTENED extractedData + the user's edits on top
   *  (inboxModel.payloadFor: the confirm route reads flat scalars; the
   *  wrapped-object spread this used to do would have written NaN). */
  const approveRow = useCallback(
    async (r: RowModel): Promise<boolean> => {
      if (!r.action) return false;
      return onConfirm(r.analysisId, r.action, buildPayload(r, edits[r.doc.id]));
    },
    [onConfirm, edits],
  );

  /** MON-188 — Done persists the edit server-side, then closes the panel. */
  const saveEdits = useCallback(
    async (r: RowModel) => {
      const e = edits[r.doc.id];
      if (!e || Object.keys(e).length === 0) {
        setEditingId(null);
        return;
      }
      setSavingEditId(r.doc.id);
      setEditError(null);
      try {
        const ok = await onPersistEdits(r.analysisId, e);
        if (ok) setEditingId(null);
        else setEditError('That change didn\u2019t save — please try again.');
      } finally {
        setSavingEditId(null);
      }
    },
    [edits, onPersistEdits],
  );

  const approveSelected = useCallback(async () => {
    const toApprove = rows.filter((r) => selected.has(r.doc.id) && r.action);
    if (toApprove.length === 0 || approving) return;
    setApproving(true);
    try {
      // Sequential, not Promise.all — keeps DB load sane and lets each item's
      // reconcile/receipt-match run cleanly; each is still an explicit confirm.
      for (const r of toApprove) await approveRow(r);
    } finally {
      setApproving(false);
    }
  }, [rows, selected, approving, approveRow]);

  if (rows.length === 0) return null;

  const selectedCount = rows.filter((r) => selected.has(r.doc.id) && r.action).length;
  const allSelected = selectedCount === rows.filter((r) => r.action).length && selectedCount > 0;

  return (
    <section
      className="relative isolate overflow-hidden rounded-[22px] border border-foreground/10 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.04)]"
      aria-label="Smart Inbox"
    >
      {/* Track atmosphere — sky→indigo mesh glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 left-0 right-0 -z-10 h-40 bg-gradient-to-br from-sky-400/15 to-indigo-500/15 blur-[60px] dark:from-sky-400/8 dark:to-indigo-500/8"
      />

      {/* Header */}
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md ring-1 ring-white/20">
          <Inbox className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">
              Smart Inbox
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
              Track
            </span>
          </div>
          <h3 className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-foreground">
            Review what we found
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
            We&apos;ve pre-selected the confident ones — edit any, then approve. Nothing is saved until you do.
          </p>
          {/* Confidence summary chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            {counts.high > 0 && <SummaryChip tone="emerald" label={`${counts.high} high confidence`} />}
            {counts.check > 0 && <SummaryChip tone="amber" label={`${counts.check} worth a check`} />}
            {counts.review > 0 && <SummaryChip tone="slate" label={`${counts.review} needs review`} />}
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="border-t border-foreground/10 px-2 sm:px-3 pb-2">
        {rows.map((r) => {
          const isEditing = editingId === r.doc.id;
          const isSel = selected.has(r.doc.id);
          const e = edits[r.doc.id] ?? {};
          const shownVendor = e.vendor ?? r.vendor;
          const shownAmount = e.amount ?? r.amount;
          const shownDate = e.date ?? r.date;
          const moneyLabel = formatMoney(shownAmount);

          return (
            <div
              key={r.doc.id}
              className="mt-1 rounded-[14px] transition-colors hover:bg-background/50"
            >
              <div className="flex items-center gap-3 px-3 py-3">
                {/* Checkbox (disabled when there's no actionable suggestion) */}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSel}
                  aria-label={isSel ? 'Deselect' : 'Select'}
                  disabled={!r.action}
                  onClick={() => r.action && toggle(r.doc.id)}
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                    !r.action
                      ? 'border-foreground/15 opacity-40'
                      : isSel
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-foreground/25 hover:border-sky-400',
                  )}
                >
                  {isSel && <Check className="h-3.5 w-3.5" />}
                </button>

                {/* Vendor + meta */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium tracking-[-0.01em] text-foreground">
                    {shownVendor}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
                    {[r.actionLabel, moneyLabel, shownDate].filter(Boolean).join(' · ') || r.doc.originalFilename}
                  </p>
                </div>

                {/* Confidence pill */}
                <span
                  className={cn(
                    'hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1',
                    TONE_PILL[r.tone],
                  )}
                  title={r.confidenceLabel}
                >
                  {r.band === 'AUTO' && <Sparkles className="h-3 w-3" />}
                  {SHORT_BAND[r.band]}
                </span>

                {/* Edit + Open */}
                <button
                  type="button"
                  onClick={() => setEditingId(isEditing ? null : r.doc.id)}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  aria-label={isEditing ? 'Close edit' : 'Edit'}
                  title="Edit"
                >
                  {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => onOpen(r.doc.id)}
                  className="hidden sm:inline-flex shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  aria-label="Open document"
                  title="Open"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>

              {/* Inline edit panel */}
              {isEditing && (
                <div className="mx-3 mb-3 rounded-[12px] border border-sky-400/20 bg-sky-500/[0.04] p-3">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <EditField label="Vendor" value={shownVendor} onChange={(v) => setEdits((p) => ({ ...p, [r.doc.id]: { ...p[r.doc.id], vendor: v } }))} />
                    <EditField label="Amount" value={shownAmount} onChange={(v) => setEdits((p) => ({ ...p, [r.doc.id]: { ...p[r.doc.id], amount: v } }))} inputMode="decimal" />
                    <EditField label="Date" value={shownDate} onChange={(v) => setEdits((p) => ({ ...p, [r.doc.id]: { ...p[r.doc.id], date: v } }))} placeholder="YYYY-MM-DD" />
                    <EditField label="Category" value={e.category ?? r.category} onChange={(v) => setEdits((p) => ({ ...p, [r.doc.id]: { ...p[r.doc.id], category: v } }))} />
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    {editError && editingId === r.doc.id && (
                      <span className="mr-auto text-[12px] text-amber-700 dark:text-amber-300">{editError}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setEdits((p) => { const n = { ...p }; delete n[r.doc.id]; return n; }); setEditingId(null); setEditError(null); }}
                      className="rounded-[10px] px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-foreground/5"
                    >
                      Cancel
                    </button>
                    {/* MON-188: Done PERSISTS (PATCH via onPersistEdits) — it is
                        never again a local-close that loses the correction. */}
                    <button
                      type="button"
                      disabled={savingEditId === r.doc.id}
                      onClick={() => void saveEdits(r)}
                      className="inline-flex items-center gap-1.5 rounded-[10px] bg-foreground/5 px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-foreground/10 disabled:opacity-60"
                    >
                      {savingEditId === r.doc.id && <Loader2 className="h-3 w-3 animate-spin" />}
                      {savingEditId === r.doc.id ? 'Saving\u2026' : 'Done'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-foreground/10 bg-card/80 px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-[13px]">
          <button
            type="button"
            onClick={() => setSelected(allSelected ? new Set() : new Set(rows.filter((r) => r.action).map((r) => r.doc.id)))}
            className="font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
          >
            {allSelected ? 'Clear' : 'Select all'}
          </button>
          <span className="text-muted-foreground tabular-nums">{selectedCount} selected</span>
        </div>
        <button
          type="button"
          onClick={approveSelected}
          disabled={selectedCount === 0 || approving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-sky-500 to-indigo-600 px-5 text-[14px] font-semibold text-white shadow-md shadow-indigo-500/25 transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {approving ? 'Approving…' : `Approve ${selectedCount} selected`}
          {!approving && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
      <p className="px-4 pb-3 text-center text-[11px] text-muted-foreground sm:text-right">
        Each item is saved as you approve — you stay in control.
      </p>
    </section>
  );
}

function SummaryChip({ tone, label }: { tone: 'emerald' | 'amber' | 'slate'; label: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1', TONE_PILL[tone])}>
      {label}
    </span>
  );
}

function EditField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'decimal';
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(ev) => onChange(ev.target.value)}
        className="w-full rounded-[10px] border border-foreground/15 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40"
      />
    </label>
  );
}

export default SmartInbox;
