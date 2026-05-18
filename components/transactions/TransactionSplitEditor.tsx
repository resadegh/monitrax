'use client';

/**
 * Phase 42 PR 2.5 — Inline split editor.
 *
 * Mounted inside `TransactionLinkDialog` as the 4th tab. Lets the
 * user split a single transaction (e.g. Bunnings $850) into N rows
 * (e.g. $600 to Investment Property + $250 to Personal), each with
 * its own category + optional per-line property/loan attribution
 * + tax-deductible flag.
 *
 * Backend contract (Phase 42 PR2, route + service shipped 2026-05-XX):
 *   PUT /api/unified-transactions/[id]/splits
 *   body: { splits: SplitInput[] }
 *
 * - "Replace" semantics — POSTing a fresh array swaps the whole set.
 * - Sum(splits[].amount) MUST equal parent transaction's signed
 *   amount (server validates via `assertSplitsBalance`, 0.01 epsilon).
 * - Categories are lazy-seeded via the level1/2/sub triple — no
 *   separate "resolve registry id" client step needed.
 *
 * Per CLAUDE.md §0:
 *   - Designer lens: 2-N rows with sticky footer; live sum/remaining
 *     readout; calm — no red errors unless the user tries to save
 *     a mis-balanced split.
 *   - Behaviour-psychologist lens: never blocks the user from
 *     experimenting (rows freely addable / removable); only blocks
 *     Save when sum doesn't balance.
 *   - Architect lens: presentational only — the service already
 *     enforces every invariant (sum, ownership, period editability).
 */

import { useEffect, useState } from 'react';
import { Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategorySelect } from '@/components/categories/CategorySelect';

interface SplitRow {
  /** Local-only id for React keys. Not persisted. */
  rowId: string;
  amount: number;
  /** Selected category triple (lazy-seeded server-side on save). */
  categoryLevel1: string | null;
  categoryLevel2: string | null;
  subcategory: string | null;
  propertyId: string | null;
  loanId: string | null;
  isTaxDeductible: boolean;
  note: string;
}

export interface TransactionSplitEditorProps {
  transactionId: string;
  /** Parent transaction's signed amount (sum target). */
  parentAmount: number;
  /** IN or OUT — drives CategorySelect.type. */
  direction: 'IN' | 'OUT';
  /** Optional property list for per-line attribution picker. */
  properties?: Array<{ id: string; name: string }>;
  /** Optional loan list for per-line attribution picker. */
  loans?: Array<{ id: string; name: string }>;
  /** Called after a successful save — parent should refresh. */
  onSaved: () => void;
}

const EPSILON = 0.01;
const MAX_ROWS = 10;
const newRowId = () => `split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function emptyRow(amount: number = 0): SplitRow {
  return {
    rowId: newRowId(),
    amount,
    categoryLevel1: null,
    categoryLevel2: null,
    subcategory: null,
    propertyId: null,
    loanId: null,
    isTaxDeductible: false,
    note: '',
  };
}

export function TransactionSplitEditor({
  transactionId,
  parentAmount,
  direction,
  properties = [],
  loans = [],
  onSaved,
}: TransactionSplitEditorProps) {
  const [rows, setRows] = useState<SplitRow[]>(() => [
    emptyRow(parentAmount),
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from existing splits on mount.
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/unified-transactions/${transactionId}/splits`)
      .then((r) => (r.ok ? r.json() : { data: { splits: [] } }))
      .then((data) => {
        if (!active) return;
        const splits = (data?.data?.splits ?? []) as Array<{
          amount: number;
          categoryLevel1?: string | null;
          categoryLevel2?: string | null;
          subcategory?: string | null;
          propertyId?: string | null;
          loanId?: string | null;
          isTaxDeductible?: boolean;
          note?: string | null;
        }>;
        if (splits.length > 0) {
          setRows(
            splits.map((s) => ({
              rowId: newRowId(),
              amount: s.amount,
              categoryLevel1: s.categoryLevel1 ?? null,
              categoryLevel2: s.categoryLevel2 ?? null,
              subcategory: s.subcategory ?? null,
              propertyId: s.propertyId ?? null,
              loanId: s.loanId ?? null,
              isTaxDeductible: s.isTaxDeductible ?? false,
              note: s.note ?? '',
            })),
          );
        } else {
          // Default: one row pre-filled with the parent amount.
          setRows([emptyRow(parentAmount)]);
        }
      })
      .catch(() => {
        if (active) setRows([emptyRow(parentAmount)]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [transactionId, parentAmount]);

  const sum = rows.reduce((a, r) => a + (Number.isFinite(r.amount) ? r.amount : 0), 0);
  const remaining = parentAmount - sum;
  const balanced = Math.abs(remaining) < EPSILON;
  const everyRowHasCategory = rows.every((r) => !!r.categoryLevel1);
  const canSave = !saving && rows.length >= 1 && balanced && everyRowHasCategory;

  const updateRow = (rowId: string, patch: Partial<SplitRow>) =>
    setRows((curr) => curr.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));

  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    // New row defaults to the remaining unallocated amount.
    setRows((curr) => [...curr, emptyRow(remaining)]);
  };

  const removeRow = (rowId: string) =>
    setRows((curr) => (curr.length <= 1 ? curr : curr.filter((r) => r.rowId !== rowId)));

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/unified-transactions/${transactionId}/splits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          splits: rows.map((r) => ({
            amount: r.amount,
            categoryLevel1: r.categoryLevel1,
            categoryLevel2: r.categoryLevel2,
            subcategory: r.subcategory,
            propertyId: r.propertyId,
            loanId: r.loanId,
            isTaxDeductible: r.isTaxDeductible,
            note: r.note.trim() || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || data?.error || `Save failed (${res.status})`);
        setSaving(false);
        return;
      }
      onSaved();
    } catch (err) {
      console.error('Split save error:', err);
      setError('Network error. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading existing splits…
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="transaction-split-editor">
      <p className="text-xs text-muted-foreground">
        Split this {Math.abs(parentAmount).toFixed(2)} transaction across multiple categories or properties.
        Each row needs an amount + category. The sum of rows must equal the transaction amount.
      </p>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {rows.map((row, idx) => (
          <div
            key={row.rowId}
            className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Row {idx + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(row.rowId)}
                disabled={rows.length <= 1}
                className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                aria-label={`Remove row ${idx + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Amount</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => updateRow(row.rowId, { amount: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <CategorySelect
                  type={direction === 'IN' ? 'INCOME' : 'EXPENSE'}
                  value={row.categoryLevel1}
                  onChange={(v) =>
                    updateRow(row.rowId, {
                      categoryLevel1: v,
                      // Reset sub-levels when level1 changes.
                      categoryLevel2: null,
                      subcategory: null,
                    })
                  }
                  placeholder="Select category"
                  allowCustom
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {properties.length > 0 && (
                <div>
                  <Label className="text-xs">Property (optional)</Label>
                  <Select
                    value={row.propertyId ?? '__none__'}
                    onValueChange={(v) => updateRow(row.rowId, { propertyId: v === '__none__' ? null : v })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {loans.length > 0 && (
                <div>
                  <Label className="text-xs">Loan (optional)</Label>
                  <Select
                    value={row.loanId ?? '__none__'}
                    onValueChange={(v) => updateRow(row.rowId, { loanId: v === '__none__' ? null : v })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {loans.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={row.isTaxDeductible}
                  onCheckedChange={(c) => updateRow(row.rowId, { isTaxDeductible: c === true })}
                />
                Tax-deductible
              </label>
              <Input
                placeholder="Note (optional)"
                value={row.note}
                onChange={(e) => updateRow(row.rowId, { note: e.target.value })}
                className="h-7 max-w-[55%] text-xs"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={rows.length >= MAX_ROWS}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add row
        </Button>
        <div className="text-right text-xs">
          <p className="text-muted-foreground">
            Sum: <span className="tabular-nums font-medium">{sum.toFixed(2)}</span> · Target:{' '}
            <span className="tabular-nums font-medium">{parentAmount.toFixed(2)}</span>
          </p>
          {!balanced && (
            <p className="text-amber-700 dark:text-amber-400 font-medium tabular-nums mt-0.5">
              {remaining > 0 ? `${remaining.toFixed(2)} unallocated` : `${Math.abs(remaining).toFixed(2)} over`}
            </p>
          )}
        </div>
      </div>

      {!everyRowHasCategory && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-200 dark:ring-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>Every row needs a category.</span>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-rose-50 dark:bg-rose-950/40 p-2 text-xs text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-900">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!canSave}>
          {saving ? 'Saving…' : 'Save split'}
        </Button>
      </div>
    </div>
  );
}
