'use client';

/**
 * IncomeExpensesStep — Phase 12 PR 3a visual redesign + Track F.8 two-way sync
 *
 * Captures general income and expenses (not linked to a property, asset,
 * loan, or investment). PR 3a simplification:
 *   - Cleaner tab switcher with live counts
 *   - Inline "annualised to $X/yr" preview on every row
 *   - Category / type picker uses a dropdown (not a horizontal chip row)
 *     so long lists don't wrap awkwardly on mobile
 *   - Summary card at the bottom shows total income, total expenses,
 *     annual surplus / deficit + per-month equivalent
 *
 * ============================================================================
 * TRACK F.8 — onboarding ⇄ real-table two-way sync (2026-05-20)
 * ============================================================================
 * Before F.8 this step staged income/expenses into the `WizardData` draft
 * blob, written once at `/api/onboarding/bulk-create`. F.8 — the LAST
 * Track F domain — makes the step read + write the real `Income` +
 * `Expense` tables directly:
 *   - ON OPEN  — `readIncomeExpenses()` loads the real GENERAL income +
 *     expense rows; the step merges them with any unsynced in-session row.
 *   - ON CONTINUE / BACK — the registered `commit` diffs + `syncIncomeExpenses()`
 *     writes the delta (create / update / hard-delete), idempotent on
 *     re-entry.
 *
 * SCOPE: GENERAL income/expenses only — property-attached rows are F.2's,
 * asset expenses F.7's, INVESTMENT-type income stays with `bulk-create`.
 * The two-way sync reads/writes only the raw budget `amount`, never the
 * transaction-reconciled actuals (design doc §6.4 budget-vs-actuals
 * invariant).
 *
 * See `lib/onboarding/incomeExpensesSync.ts` and
 * `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §6.8.
 *
 * No data model changes — the income/expense routes were already audited
 * in F.2, so F.8 needs no new audit actions and no migration.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  DollarSign,
  Plus,
  Trash2,
  Briefcase,
  TrendingUp,
  Banknote,
  Building,
  MoreHorizontal,
  ShoppingCart,
  Zap,
  Car,
  Heart,
  Shield,
  Tv,
  UtensilsCrossed,
  GraduationCap,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  WizardData,
  IncomeInput,
  ExpenseInput,
  IncomeType,
  ExpenseCategory,
  generateId,
  type StepCommitFn,
} from '../types';
import { useAuth } from '@/lib/context/AuthContext';
import {
  readIncomeExpenses,
  syncIncomeExpenses,
  snapshotToWizardIncome,
  snapshotToWizardExpenses,
  wizardToSnapshotIncomeExpenses,
  isPersistedId,
  EMPTY_INCOME_EXPENSES_SNAPSHOT,
  type IncomeExpensesSnapshot,
} from '@/lib/onboarding/incomeExpensesSync';
import {
  WizardStepShell,
  WizardField,
  WizardCurrencyField,
  WizardSelectField,
  WizardSegmentedControl,
  WizardAddButton,
} from '../primitives';
import { formatCurrency } from '@/lib/utils/formatters';
import { toAnnual } from '@/lib/utils/frequencies';
import '@/styles/wizard-animations.css';

// =============================================================================
// META
// =============================================================================

interface IncomeTypeMeta {
  value: IncomeType;
  label: string;
  icon: React.ReactNode;
  accent: string;
}

const INCOME_TYPES: IncomeTypeMeta[] = [
  {
    value: 'SALARY',
    label: 'Salary / wages',
    icon: <Briefcase className="h-4 w-4" />,
    accent: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  },
  {
    value: 'INVESTMENT',
    label: 'Investment income',
    icon: <TrendingUp className="h-4 w-4" />,
    accent: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
  },
  {
    value: 'RENT',
    label: 'Rent received',
    icon: <Building className="h-4 w-4" />,
    accent: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  },
  {
    value: 'RENTAL',
    label: 'Rental income',
    icon: <Building className="h-4 w-4" />,
    accent: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
  {
    value: 'OTHER',
    label: 'Other',
    icon: <MoreHorizontal className="h-4 w-4" />,
    accent: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
];

const INCOME_TYPE_OPTIONS = INCOME_TYPES.map((t) => ({ value: t.value, label: t.label }));

interface ExpenseCategoryMeta {
  value: ExpenseCategory;
  label: string;
  icon: React.ReactNode;
}

const EXPENSE_CATEGORIES: ExpenseCategoryMeta[] = [
  { value: 'HOUSING', label: 'Housing', icon: <Building className="h-3.5 w-3.5" /> },
  { value: 'RENT', label: 'Rent', icon: <Building className="h-3.5 w-3.5" /> },
  { value: 'UTILITIES', label: 'Utilities', icon: <Zap className="h-3.5 w-3.5" /> },
  { value: 'GROCERIES', label: 'Groceries', icon: <ShoppingCart className="h-3.5 w-3.5" /> },
  { value: 'FOOD', label: 'Food & dining', icon: <UtensilsCrossed className="h-3.5 w-3.5" /> },
  { value: 'TRANSPORT', label: 'Transport', icon: <Car className="h-3.5 w-3.5" /> },
  { value: 'INSURANCE', label: 'Insurance', icon: <Shield className="h-3.5 w-3.5" /> },
  { value: 'HEALTH', label: 'Health & medical', icon: <Heart className="h-3.5 w-3.5" /> },
  { value: 'EDUCATION', label: 'Education', icon: <GraduationCap className="h-3.5 w-3.5" /> },
  { value: 'ENTERTAINMENT', label: 'Entertainment', icon: <Tv className="h-3.5 w-3.5" /> },
  { value: 'SUBSCRIPTION', label: 'Subscriptions', icon: <Tv className="h-3.5 w-3.5" /> },
  { value: 'PERSONAL', label: 'Personal', icon: <Package className="h-3.5 w-3.5" /> },
  { value: 'RATES', label: 'Council rates', icon: <Building className="h-3.5 w-3.5" /> },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: <Package className="h-3.5 w-3.5" /> },
  { value: 'STRATA', label: 'Strata fees', icon: <Building className="h-3.5 w-3.5" /> },
  { value: 'LAND_TAX', label: 'Land tax', icon: <Building className="h-3.5 w-3.5" /> },
  { value: 'LOAN_INTEREST', label: 'Loan interest', icon: <Banknote className="h-3.5 w-3.5" /> },
  { value: 'REGISTRATION', label: 'Registration', icon: <Car className="h-3.5 w-3.5" /> },
  { value: 'MODIFICATIONS', label: 'Modifications', icon: <Package className="h-3.5 w-3.5" /> },
  { value: 'OTHER', label: 'Other', icon: <MoreHorizontal className="h-3.5 w-3.5" /> },
];

const EXPENSE_CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map((c) => ({
  value: c.value,
  label: c.label,
}));

const FREQUENCY_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
];

// =============================================================================
// FACTORIES
// =============================================================================

function createEmptyIncome(type: IncomeType = 'SALARY'): IncomeInput {
  return {
    id: generateId(),
    name: '',
    type,
    amount: 0,
    frequency: type === 'SALARY' ? 'ANNUAL' : 'MONTHLY',
    salaryType: type === 'SALARY' ? 'GROSS' : undefined,
  };
}

function createEmptyExpense(category: ExpenseCategory = 'HOUSING'): ExpenseInput {
  return {
    id: generateId(),
    name: '',
    category,
    amount: 0,
    frequency: 'MONTHLY',
  };
}

function annualize(amount: number, frequency: string): number {
  return toAnnual(amount, frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL');
}

// =============================================================================
// INCOME CARD
// =============================================================================

function IncomeCard({
  income,
  onUpdate,
  onRemove,
}: {
  income: IncomeInput;
  onUpdate: (updates: Partial<IncomeInput>) => void;
  onRemove: () => void;
}) {
  const meta = INCOME_TYPES.find((t) => t.value === income.type) ?? INCOME_TYPES[0];
  const annualAmount = annualize(income.amount, income.frequency);

  return (
    <div className="wz-section">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${meta.accent}`}>
            {meta.icon}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {meta.label}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove income"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
        <WizardSelectField
          className="sm:col-span-3"
          label="Type"
          value={income.type}
          onChange={(v) => {
            const newType = v as IncomeType;
            onUpdate({
              type: newType,
              salaryType: newType === 'SALARY' ? 'GROSS' : undefined,
              frequency: newType === 'SALARY' ? 'ANNUAL' : 'MONTHLY',
            });
          }}
          options={INCOME_TYPE_OPTIONS}
        />
        <WizardField
          className="sm:col-span-4"
          label="Description"
          placeholder={income.type === 'SALARY' ? 'e.g. Main job' : 'Description'}
          value={income.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
        <WizardCurrencyField
          className="sm:col-span-2"
          label="Amount"
          required
          value={income.amount}
          onChange={(v) => onUpdate({ amount: v })}
        />
        <WizardSelectField
          className="sm:col-span-3"
          label="Frequency"
          value={income.frequency}
          onChange={(v) => onUpdate({ frequency: v as IncomeInput['frequency'] })}
          options={FREQUENCY_OPTIONS}
        />
      </div>

      {income.type === 'SALARY' && (
        <div className="mt-3">
          <WizardSegmentedControl
            label="Amount is"
            value={income.salaryType || 'GROSS'}
            onChange={(v) => onUpdate({ salaryType: v as 'GROSS' | 'NET' })}
            options={[
              { value: 'GROSS', label: 'Gross (before tax)' },
              { value: 'NET', label: 'Net (after tax)' },
            ]}
            name={`salary-${income.id}`}
          />
        </div>
      )}

      {income.amount > 0 && (
        <div className="mt-3 flex items-center justify-end gap-1.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Annualised:</span>
          <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(annualAmount)}
          </span>
          <span className="text-slate-400 dark:text-slate-500">/ year</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EXPENSE CARD
// =============================================================================

function ExpenseCard({
  expense,
  onUpdate,
  onRemove,
}: {
  expense: ExpenseInput;
  onUpdate: (updates: Partial<ExpenseInput>) => void;
  onRemove: () => void;
}) {
  const catMeta = EXPENSE_CATEGORIES.find((c) => c.value === expense.category) ?? EXPENSE_CATEGORIES[0];
  const annualAmount = annualize(expense.amount, expense.frequency);

  return (
    <div className="wz-section">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400">
            {catMeta.icon}
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {catMeta.label}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove expense"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
        <WizardSelectField
          className="sm:col-span-3"
          label="Category"
          value={expense.category}
          onChange={(v) => onUpdate({ category: v as ExpenseCategory })}
          options={EXPENSE_CATEGORY_OPTIONS}
        />
        <WizardField
          className="sm:col-span-4"
          label="Description"
          placeholder="e.g. Groceries"
          value={expense.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
        <WizardCurrencyField
          className="sm:col-span-2"
          label="Amount"
          required
          value={expense.amount}
          onChange={(v) => onUpdate({ amount: v })}
        />
        <WizardSelectField
          className="sm:col-span-3"
          label="Frequency"
          value={expense.frequency}
          onChange={(v) => onUpdate({ frequency: v as ExpenseInput['frequency'] })}
          options={FREQUENCY_OPTIONS}
        />
      </div>

      {expense.amount > 0 && (
        <div className="mt-3 flex items-center justify-end gap-1.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Annualised:</span>
          <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
            {formatCurrency(annualAmount)}
          </span>
          <span className="text-slate-400 dark:text-slate-500">/ year</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// INCOME & EXPENSES STEP
// =============================================================================

interface IncomeExpensesStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  /**
   * Phase 12 Track F.8: register an async commit with the container. The
   * container awaits it before advancing — it writes the GENERAL income +
   * expense rows to the real `Income` / `Expense` tables. Optional so the
   * step still renders in non-wizard contexts.
   */
  registerStepCommit?: (fn: StepCommitFn | null) => void;
}

export function IncomeExpensesStep({
  data,
  onUpdate,
  registerStepCommit,
}: IncomeExpensesStepProps) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'income' | 'expenses'>('income');

  // ---- Phase 12 Track F.8: real-table sync state ---------------------
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const snapshotRef = useRef<IncomeExpensesSnapshot>(
    EMPTY_INCOME_EXPENSES_SNAPSHOT,
  );
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // ---- READ the real `Income` / `Expense` tables on step open -------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    readIncomeExpenses(token)
      .then((snapshot) => {
        if (cancelled) return;
        snapshotRef.current = snapshot;
        const realIncome = snapshotToWizardIncome(snapshot);
        const realExpenses = snapshotToWizardExpenses(snapshot);
        const unsyncedIncome = dataRef.current.income.filter(
          (i) => !isPersistedId(i.id),
        );
        const unsyncedExpenses = dataRef.current.expenses.filter(
          (e) => !isPersistedId(e.id),
        );
        onUpdate({
          income: [...realIncome, ...unsyncedIncome],
          expenses: [...realExpenses, ...unsyncedExpenses],
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Could not load your income and expenses. You can still edit — we’ll save when you continue.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- COMMIT: register the real-table write with the container ------
  useEffect(() => {
    if (!registerStepCommit) return;
    const commit: StepCommitFn = async () => {
      if (loading) {
        throw new Error(
          'Still loading your income and expenses — please wait a moment.',
        );
      }
      const current = wizardToSnapshotIncomeExpenses(
        dataRef.current.income,
        dataRef.current.expenses,
      );
      const result = await syncIncomeExpenses(token, snapshotRef.current, current);
      snapshotRef.current = result.snapshot;
      // Re-seed from the real tables, keeping any in-session row still
      // incomplete (no real id, amount 0) so a half-filled row the user
      // is working on isn't discarded on a Back navigation.
      const stillUnsyncedIncome = dataRef.current.income.filter(
        (i) => !isPersistedId(i.id) && !(i.amount > 0),
      );
      const stillUnsyncedExpenses = dataRef.current.expenses.filter(
        (e) => !isPersistedId(e.id) && !(e.amount > 0),
      );
      onUpdate({
        income: [
          ...snapshotToWizardIncome(result.snapshot),
          ...stillUnsyncedIncome,
        ],
        expenses: [
          ...snapshotToWizardExpenses(result.snapshot),
          ...stillUnsyncedExpenses,
        ],
      });
    };
    registerStepCommit(commit);
    return () => registerStepCommit(null);
  }, [registerStepCommit, token, loading, onUpdate]);

  // Income operations
  const addIncome = (type: IncomeType = 'SALARY') =>
    onUpdate({ income: [...data.income, createEmptyIncome(type)] });
  const updateIncome = (id: string, updates: Partial<IncomeInput>) =>
    onUpdate({ income: data.income.map((i) => (i.id === id ? { ...i, ...updates } : i)) });
  const removeIncome = (id: string) =>
    onUpdate({ income: data.income.filter((i) => i.id !== id) });

  // Expense operations
  const addExpense = (category: ExpenseCategory = 'HOUSING') =>
    onUpdate({ expenses: [...data.expenses, createEmptyExpense(category)] });
  const updateExpense = (id: string, updates: Partial<ExpenseInput>) =>
    onUpdate({
      expenses: data.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    });
  const removeExpense = (id: string) =>
    onUpdate({ expenses: data.expenses.filter((e) => e.id !== id) });

  // Summary
  const totalAnnualIncome = data.income.reduce(
    (sum, i) => sum + annualize(i.amount, i.frequency),
    0
  );
  const totalAnnualExpenses = data.expenses.reduce(
    (sum, e) => sum + annualize(e.amount, e.frequency),
    0
  );
  const annualSurplus = totalAnnualIncome - totalAnnualExpenses;
  const monthlySurplus = annualSurplus / 12;

  return (
    <WizardStepShell
      icon={<DollarSign className="h-8 w-8" strokeWidth={1.5} />}
      title="Income & expenses"
      subtitle="Where your money comes from and where it goes. This powers your Budget and cashflow tracking."
    >
      {/* Real-table sync status — loading while reading, error on failure.
          Both are non-blocking (Phase 12 Track F.8). */}
      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading your income and expenses…
        </div>
      )}
      {!loading && loadError && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span className="min-w-0">{loadError}</span>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('income')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'income'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <ArrowUpCircle className="h-4 w-4" />
          Income
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
            {data.income.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'expenses'
              ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <ArrowDownCircle className="h-4 w-4" />
          Expenses
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
            {data.expenses.length}
          </span>
        </button>
      </div>

      {/* Income tab */}
      {activeTab === 'income' && (
        <div className="space-y-3">
          {data.income.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-6 text-center">
              <ArrowUpCircle className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                No income added yet
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {INCOME_TYPES.slice(0, 4).map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => addIncome(type.value)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors"
                  >
                    {type.icon}
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {data.income.map((inc) => (
                <IncomeCard
                  key={inc.id}
                  income={inc}
                  onUpdate={(updates) => updateIncome(inc.id, updates)}
                  onRemove={() => removeIncome(inc.id)}
                />
              ))}
              <WizardAddButton
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={() => addIncome()}
              >
                Add another income source
              </WizardAddButton>
            </>
          )}
        </div>
      )}

      {/* Expenses tab */}
      {activeTab === 'expenses' && (
        <div className="space-y-3">
          {data.expenses.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-6 text-center">
              <ArrowDownCircle className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                No expenses added yet
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXPENSE_CATEGORIES.slice(0, 6).map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => addExpense(cat.value)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-rose-400 hover:text-rose-600 dark:hover:border-rose-500 dark:hover:text-rose-400 transition-colors"
                  >
                    {cat.icon}
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {data.expenses.map((exp) => (
                <ExpenseCard
                  key={exp.id}
                  expense={exp}
                  onUpdate={(updates) => updateExpense(exp.id, updates)}
                  onRemove={() => removeExpense(exp.id)}
                />
              ))}
              <WizardAddButton
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={() => addExpense()}
              >
                Add another expense
              </WizardAddButton>
            </>
          )}
        </div>
      )}

      {/* Cashflow summary — always visible once there's any data */}
      {(data.income.length > 0 || data.expenses.length > 0) && (
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/50 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/60 dark:to-slate-900/60 p-5">
          <h4 className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Annual cashflow preview
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white dark:bg-slate-900/60 p-3 text-center">
              <div className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalAnnualIncome, { abbreviate: true })}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Income</div>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900/60 p-3 text-center">
              <div className="text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {formatCurrency(totalAnnualExpenses, { abbreviate: true })}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Expenses</div>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900/60 p-3 text-center">
              <div
                className={`text-xl font-semibold tabular-nums ${
                  annualSurplus >= 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {annualSurplus >= 0 ? '+' : ''}
                {formatCurrency(annualSurplus, { abbreviate: true })}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {annualSurplus >= 0 ? 'Surplus' : 'Deficit'}
              </div>
            </div>
          </div>
          {annualSurplus !== 0 && (
            <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
              That&apos;s{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formatCurrency(Math.abs(monthlySurplus))}
              </span>{' '}
              {annualSurplus >= 0 ? 'per month available for savings or investments.' : 'per month short.'}
            </p>
          )}
        </div>
      )}
    </WizardStepShell>
  );
}

export default IncomeExpensesStep;
