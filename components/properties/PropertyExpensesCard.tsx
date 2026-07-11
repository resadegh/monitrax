'use client';

/**
 * PROPERTY EXPENSES CARD — MON-005 (show a property's expenses on the property)
 * + MON-008 (enter a property's expenses inline, actuals-first).
 *
 * Stitch-first design (CLAUDE.md §18.2.1). Full 4-variant matrix at
 * .stitch/designs/mon-005-008/property-expenses-v2{,-dark,-mobile,-mobile-dark}.{html,png}.
 * Stitch screen IDs (project 1859462351962811110):
 *   Desktop light: e316a4811e364fbb93234d7c96f9df5d
 *   Desktop dark:  355298a816df4694b8180565c78a3708
 *   Mobile light:  966dbd42ddff4ce28153668672641113
 *   Mobile dark:   6b2f35540bff4b70a53314cb9bdede5d
 * §18.8 self-review gate: v1 8.3/10 → v2 9.3/10 (passing).
 *
 * WHY THIS EXISTS
 *   Before this, the property detail page showed only a single read-only
 *   "N expenses tracked" row that linked OUT to the global Spending page, and
 *   there was no way to enter a property's expenses from the property itself.
 *
 * SSOT (§12.2.1 / §19.4)
 *   - Header total AND every row read from the ONE canonical engine,
 *     `computePropertyCashflow` — the header uses `annualExpenses`, the rows use
 *     the `expenseLines[]` breakdown produced by the SAME loop. So
 *     Σ rows === header total BY CONSTRUCTION (no second producer, no drift).
 *   - Actuals-first (§19.1): each line's amount is the reconciled figure when
 *     transactions exist (Actual pill), else the declared amount (Estimate pill)
 *     — the exact signal the engine used (`line.usedActuals`).
 *   - Create / edit / delete reuse the canonical path (`components/ExpenseDialog`
 *     → POST/PUT /api/expenses, DELETE /api/expenses/[id]) — NOT a second inline
 *     expense form. The Stitch mock drew an inline form; we open the canonical
 *     dialog instead so there is exactly ONE expense form in the app.
 *
 * §18.7.2 glass vocabulary: warm-ivory/navy surface, 72% glass, 3px sky→indigo
 * top-accent, gradient Receipt badge, neutral-ink tabular amounts, Actual =
 * emerald pill / Estimate = slate pill, celebratory empty state (§0 psychology).
 */

import { useState } from 'react';
import Link from 'next/link';
import { Receipt, Plus, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { computePropertyCashflow } from '@/lib/calculations/propertyCashflow';
import { ExpenseDialog, type Expense as DialogExpense } from '@/components/ExpenseDialog';

/** The expense shape the card needs — a superset of the detail page's row that
 *  also carries the fields the canonical ExpenseDialog needs for editing. */
export interface PropertyExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  // Actuals (attached by lib/services/propertyActuals.ts) — for the status pill.
  hasTransactions?: boolean;
  monthlyAverageActual?: number | null;
  // Optional fields the ExpenseDialog needs to edit (the API returns them).
  vendorName?: string | null;
  sourceType?: string | null;
  isEssential?: boolean | null;
  isTaxDeductible?: boolean | null;
  propertyId?: string | null;
  loanId?: string | null;
  investmentAccountId?: string | null;
  assetId?: string | null;
}

interface LinkedTx {
  date: string | Date;
  amount: number;
  incomeId: string | null;
  expenseId: string | null;
  loanId: string | null;
}

interface PropertyExpensesCardProps {
  propertyId: string;
  expenses: PropertyExpense[];
  linkedTransactions?: LinkedTx[];
  token: string;
  /** Called after a create / edit / delete so the page can refetch. */
  onChanged: () => void;
}

function humanizeCategory(category: string): string {
  return category
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function humanizeFrequency(frequency: string): string {
  const f = frequency.toLowerCase();
  return f.charAt(0).toUpperCase() + f.slice(1);
}

export default function PropertyExpensesCard({
  propertyId,
  expenses,
  linkedTransactions,
  token,
  onChanged,
}: PropertyExpensesCardProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<PropertyExpense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ONE source (§12.2.1): header total + per-row figures both come from the
  // canonical engine. Σ expenseLines[].annual === annualExpenses by construction.
  const cf = computePropertyCashflow({ expenses, transactions: linkedTransactions });
  const annualTotal = cf.annualExpenses;
  const monthlyTotal = cf.monthlyExpenses;
  const lineById = new Map(cf.expenseLines.filter((l) => l.id).map((l) => [l.id as string, l]));

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const r = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) onChanged();
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (e: PropertyExpense) => setEditExpense(e);

  // Map a PropertyExpense to the canonical ExpenseDialog's Expense shape for edit.
  const toDialogExpense = (e: PropertyExpense): DialogExpense =>
    ({
      id: e.id,
      name: e.name,
      vendorName: e.vendorName ?? null,
      category: e.category as DialogExpense['category'],
      sourceType: (e.sourceType ?? 'PROPERTY') as DialogExpense['sourceType'],
      amount: e.amount,
      frequency: e.frequency as DialogExpense['frequency'],
      isEssential: e.isEssential ?? true,
      isTaxDeductible: e.isTaxDeductible ?? true,
      propertyId: e.propertyId ?? propertyId,
      loanId: e.loanId ?? null,
      investmentAccountId: e.investmentAccountId ?? null,
      assetId: e.assetId ?? null,
    }) as DialogExpense;

  const hasExpenses = expenses.length > 0;

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-foreground/10 bg-card/70 p-6 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] dark:border-foreground/20 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      {/* 3px sky→indigo top-accent strip */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-500 to-indigo-500" />
      {/* 1px inner-top white highlight (curved-glass cue) */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" />

      <div className="relative">
        {/* Header: badge + eyebrow + gradient total */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/30">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-[10px] font-bold uppercase tracking-[0.16em] text-transparent">
                Expenses
              </span>
              <p className="text-xs text-muted-foreground">
                {hasExpenses
                  ? `${expenses.length} tracked on this property`
                  : '0 tracked on this property'}
              </p>
            </div>
          </div>
          {hasExpenses && (
            <div className="text-right">
              <p className="bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-2xl font-semibold tabular-nums text-transparent sm:text-3xl">
                {formatCurrency(annualTotal)}
                <span className="text-sm font-medium text-muted-foreground"> /yr</span>
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatCurrency(monthlyTotal)} /mo
              </p>
            </div>
          )}
        </div>

        {hasExpenses ? (
          <>
            {/* Expense list */}
            <ul className="mt-4 divide-y divide-foreground/10">
              {expenses.map((e) => {
                const line = lineById.get(e.id);
                const isActual = line?.usedActuals ?? Boolean(e.hasTransactions);
                const annual = line ? line.annual : e.amount; // fallback: raw amount if unmatched
                return (
                  <li key={e.id} className="group flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{e.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-foreground/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {humanizeFrequency(e.frequency)}
                        </span>
                        {isActual ? (
                          <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                            Actual
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            Estimate
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{humanizeCategory(e.category)}</span>
                      </div>
                    </div>

                    {/* Hover edit/delete (§18.7.2 tile anatomy — quiet icons) */}
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => openEdit(e)}
                        aria-label={`Edit ${e.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(e.id)}
                        disabled={deletingId === e.id}
                        aria-label={`Delete ${e.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(annual)}
                      <span className="text-xs font-normal text-muted-foreground"> /yr</span>
                    </p>
                  </li>
                );
              })}
            </ul>

            {/* Footer: add + view-all */}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-foreground/10 pt-4">
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-[14px] bg-gradient-to-r from-emerald-500 to-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" />
                Add expense
              </button>
              <Link
                href="/dashboard/expenses"
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300"
              >
                View all in Spending
                <span aria-hidden>→</span>
              </Link>
            </div>
          </>
        ) : (
          // Empty state (§0 psychology — celebrate the next achievable action).
          <div className="relative mt-2 overflow-hidden rounded-[12px] px-4 py-10 text-center">
            <Receipt
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 text-sky-500/[0.06] dark:text-sky-400/[0.10]"
            />
            <div className="relative">
              <h3 className="text-base font-semibold text-foreground">
                No expenses tracked for this property yet
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Add your rates, insurance, strata and maintenance to see the true cost of holding this property.
              </p>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="mt-5 inline-flex items-center gap-1.5 rounded-[14px] bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" />
                Add your first expense
              </button>
            </div>
          </div>
        )}

        {/* Actuals-first helper (§19.1 — honest about the basis) */}
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/80">
          Enter your typed amount now — we&rsquo;ll switch to your reconciled transactions once they&rsquo;re matched.
        </p>
      </div>

      {/* Canonical create dialog (SSOT — §12.2.1). */}
      <ExpenseDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultPropertyId={propertyId}
        token={token}
        onSuccess={() => {
          setAddOpen(false);
          onChanged();
        }}
      />
      {/* Canonical edit dialog. */}
      <ExpenseDialog
        open={editExpense !== null}
        onOpenChange={(open) => {
          if (!open) setEditExpense(null);
        }}
        expense={editExpense ? toDialogExpense(editExpense) : null}
        token={token}
        onSuccess={() => {
          setEditExpense(null);
          onChanged();
        }}
      />
    </div>
  );
}
