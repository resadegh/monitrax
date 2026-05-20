'use client';

/**
 * DebtsStep — Phase 12 PR 3b + Track F.4 two-way sync
 *
 * Captures non-property loans: car loans, HECS/student loans, personal
 * loans, business loans.
 *
 * ============================================================================
 * TRACK F.4 — onboarding ⇄ real-table two-way sync (2026-05-20)
 * ============================================================================
 * Before F.4 this step staged debts into the `WizardData` draft blob,
 * written once at `/api/onboarding/bulk-create`. F.4 makes the step read +
 * write the real `Loan` table directly:
 *   - ON OPEN  — `readDebts()` loads the standalone debts (loan `type`
 *     CAR / STUDENT / PERSONAL / BUSINESS); the step merges them with any
 *     unsynced in-session card, or pre-seeds one card per Welcome-step
 *     debt category when there is nothing yet.
 *   - ON CONTINUE / BACK — the registered `commit` diffs + `syncDebts()`
 *     writes the delta (create / update / hard-delete), idempotent on
 *     re-entry.
 *
 * Property mortgages are F.2's domain; the CAR→vehicle link is F.7's
 * (the Assets step). See `lib/onboarding/debtsSync.ts` and
 * `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §6.4. Shown conditionally based on the Welcome
 * step's "Do you have any of these debts?" checkbox — users who tick
 * nothing never see this step.
 *
 * Each `DebtInput` maps to a Prisma `Loan` row with a non-HOME /
 * non-INVESTMENT `LoanType` (see types.ts `DebtLoanType`).
 *
 * Special handling:
 *   - **HECS/STUDENT**: income-contingent repayment means there's no
 *     fixed minRepayment. Flag via `isHecsHelp: true`; the UI hides the
 *     repayment fields and the cashflow summary skips it.
 *   - **CAR**: optional `linkedAssetId` to a vehicle in the Assets
 *     step. bulk-create writes this to `Loan.linkedAssetId`.
 *
 * LINE_OF_CREDIT and CREDIT_CARD are **not** handled here — per the
 * plan doc §3 row C, LOC is modelled as a CREDIT_CARD Account in the
 * Accounts step for PR 3b simplicity.
 *
 * Docs: docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md §3 row C, §6.3
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Car,
  GraduationCap,
  Banknote,
  Briefcase,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  WizardData,
  DebtInput,
  DebtLoanType,
  DebtCategory,
  generateId,
  type StepCommitFn,
} from '../types';
import {
  WizardStepShell,
  WizardField,
  WizardCurrencyField,
  WizardPercentField,
  WizardSelectField,
  WizardAddButton,
} from '../primitives';
import { formatCurrency } from '@/lib/utils/formatters';
import { useAuth } from '@/lib/context/AuthContext';
import {
  readDebts,
  syncDebts,
  snapshotToWizardDebts,
  wizardDebtsToSnapshot,
  isPersistedId,
  EMPTY_DEBTS_SNAPSHOT,
  type DebtsSnapshot,
} from '@/lib/onboarding/debtsSync';
import '@/styles/wizard-animations.css';

// =============================================================================
// META
// =============================================================================

interface DebtTypeMeta {
  value: DebtLoanType;
  label: string;
  icon: React.ReactNode;
  accent: string;
  description: string;
}

const DEBT_TYPES: DebtTypeMeta[] = [
  {
    value: 'CAR',
    label: 'Car loan',
    icon: <Car className="h-5 w-5" />,
    accent: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
    description: 'Vehicle financing — can be linked to a car in the Assets step.',
  },
  {
    value: 'STUDENT',
    label: 'HECS / student loan',
    icon: <GraduationCap className="h-5 w-5" />,
    accent: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400',
    description:
      'Income-contingent. Repayments are deducted from salary automatically — just the balance is enough.',
  },
  {
    value: 'PERSONAL',
    label: 'Personal loan',
    icon: <Banknote className="h-5 w-5" />,
    accent: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400',
    description: 'Unsecured personal loan, buy-now-pay-later, etc.',
  },
  {
    value: 'BUSINESS',
    label: 'Business loan',
    icon: <Briefcase className="h-5 w-5" />,
    accent: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
    description: 'Business-purpose loan.',
  },
];

const DEBT_TYPE_OPTIONS = DEBT_TYPES.map((t) => ({ value: t.value, label: t.label }));

const REPAYMENT_FREQ_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

// Map from the Welcome-step DebtCategory to the DebtLoanType used inside
// this step. Today these align 1:1; the indirection exists in case a
// future Welcome category needs to split into multiple step rows.
function debtCategoryToType(cat: DebtCategory): DebtLoanType {
  return cat as DebtLoanType;
}

// =============================================================================
// FACTORIES
// =============================================================================

function createEmptyDebt(type: DebtLoanType = 'CAR'): DebtInput {
  const isHecsHelp = type === 'STUDENT';
  return {
    id: generateId(),
    name: DEBT_TYPES.find((t) => t.value === type)?.label || 'Loan',
    type,
    lender: '',
    principal: 0,
    interestRateAnnual: type === 'STUDENT' ? 4 : 0, // ATO HECS indexation default
    minRepayment: 0,
    repaymentFrequency: 'MONTHLY',
    termMonthsRemaining: 60,
    isHecsHelp,
  };
}

// =============================================================================
// DEBT CARD
// =============================================================================

interface DebtCardProps {
  debt: DebtInput;
  availableVehicles: Array<{ id: string; name: string }>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<DebtInput>) => void;
  onRemove: () => void;
}

function DebtCard({
  debt,
  availableVehicles,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}: DebtCardProps) {
  const meta = DEBT_TYPES.find((t) => t.value === debt.type) ?? DEBT_TYPES[0];
  const isHecs = debt.type === 'STUDENT';

  return (
    <div className="wz-section" style={{ padding: 0 }}>
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${meta.accent}`}>
            {meta.icon}
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {debt.name || meta.label}
            </h4>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {debt.lender || meta.label}
              {debt.principal > 0 && ` · ${formatCurrency(debt.principal, { abbreviate: true })}`}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Remove debt"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center text-slate-400">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-4 border-t border-slate-200/70 dark:border-slate-700/50 px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <WizardSelectField
              label="Debt type"
              required
              value={debt.type}
              onChange={(v) => {
                const newType = v as DebtLoanType;
                onUpdate({
                  type: newType,
                  isHecsHelp: newType === 'STUDENT',
                  // Clear car-asset link if switching away from CAR
                  linkedAssetId: newType === 'CAR' ? debt.linkedAssetId : undefined,
                });
              }}
              options={DEBT_TYPE_OPTIONS}
            />
            <WizardField
              label="Loan name"
              required
              placeholder={meta.label}
              value={debt.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
            />
            {!isHecs && (
              <WizardField
                className="sm:col-span-2"
                label="Lender"
                placeholder="e.g. ANZ, Toyota Finance"
                value={debt.lender || ''}
                onChange={(e) => onUpdate({ lender: e.target.value })}
              />
            )}
            <WizardCurrencyField
              label="Outstanding balance"
              required
              value={debt.principal}
              onChange={(v) => onUpdate({ principal: v })}
            />
            <WizardPercentField
              label={isHecs ? 'Indexation rate' : 'Interest rate (annual)'}
              required={!isHecs}
              value={debt.interestRateAnnual}
              onChange={(v) => onUpdate({ interestRateAnnual: v })}
              max={20}
              helper={
                isHecs
                  ? 'ATO indexes HECS each year — default is ~4%'
                  : 'Annual rate, e.g. 8.5'
              }
            />
            {!isHecs && (
              <>
                <WizardCurrencyField
                  label="Minimum repayment"
                  required
                  value={debt.minRepayment}
                  onChange={(v) => onUpdate({ minRepayment: v })}
                />
                <WizardSelectField
                  label="Repayment frequency"
                  value={debt.repaymentFrequency}
                  onChange={(v) =>
                    onUpdate({
                      repaymentFrequency: v as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY',
                    })
                  }
                  options={REPAYMENT_FREQ_OPTIONS}
                />
              </>
            )}
            {isHecs && (
              <div className="sm:col-span-2 rounded-lg border border-sky-200/60 dark:border-sky-800/40 bg-sky-50/60 dark:bg-sky-900/10 px-3 py-2.5 text-xs text-sky-700 dark:text-sky-300">
                <strong>HECS / HELP is income-contingent.</strong> Repayments are
                automatically deducted from salary above the ATO threshold —
                you don&apos;t need to enter a repayment amount here.
              </div>
            )}
          </div>

          {/* Vehicle link — CAR only */}
          {debt.type === 'CAR' && availableVehicles.length > 0 && (
            <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-900/10 p-3">
              <label className="mb-1.5 block text-xs font-medium text-amber-700 dark:text-amber-300">
                Link to a vehicle
              </label>
              <select
                value={debt.linkedAssetId || ''}
                onChange={(e) => onUpdate({ linkedAssetId: e.target.value || undefined })}
                className="wz-input"
              >
                <option value="">Not linked to a vehicle</option>
                {availableVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                Linking connects this loan to the vehicle in your Assets step for full depreciation + equity tracking.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// DEBTS STEP
// =============================================================================

interface DebtsStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  /**
   * Phase 12 Track F.4: register an async commit with the container. The
   * container awaits it before advancing — it writes the standalone debts
   * to the real `Loan` table. Optional so the step still renders in
   * non-wizard contexts.
   */
  registerStepCommit?: (fn: StepCommitFn | null) => void;
}

export function DebtsStep({ data, onUpdate, registerStepCommit }: DebtsStepProps) {
  const { token } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(
    data.debts.length > 0 ? data.debts[0].id : null
  );

  // ---- Phase 12 Track F.4: real-table sync state ---------------------
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const snapshotRef = useRef<DebtsSnapshot>(EMPTY_DEBTS_SNAPSHOT);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // ---- READ the real `Loan` table on step open -----------------------
  // Loads the standalone debts, merges them with any unsynced (synthetic-
  // id) in-session / chat-staged debt. When there is genuinely nothing
  // yet, pre-seeds one card per Welcome-step debt category (the old
  // pre-seed effect, folded in here so it can't race the read).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    readDebts(token)
      .then((snapshot) => {
        if (cancelled) return;
        snapshotRef.current = snapshot;
        const realDebts = snapshotToWizardDebts(snapshot);
        const unsynced = dataRef.current.debts.filter((d) => !isPersistedId(d.id));
        let merged = [...realDebts, ...unsynced];
        if (merged.length === 0 && dataRef.current.debtCategories.length > 0) {
          merged = dataRef.current.debtCategories.map((cat) =>
            createEmptyDebt(debtCategoryToType(cat)),
          );
        }
        onUpdate({ debts: merged });
        setExpandedId((prev) => prev ?? merged[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Could not load your debts. You can still edit — we’ll save when you continue.',
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

  // ---- COMMIT: register the real-table write with the container -------
  useEffect(() => {
    if (!registerStepCommit) return;
    const commit: StepCommitFn = async () => {
      if (loading) {
        throw new Error('Still loading your debts — please wait a moment.');
      }
      const current = wizardDebtsToSnapshot(dataRef.current.debts);
      const result = await syncDebts(token, snapshotRef.current, current);
      snapshotRef.current = result.snapshot;
      // Re-seed from the real table, keeping any in-session card still
      // incomplete (no real id, no balance) so a half-filled card the user
      // is working on isn't discarded on a Back navigation.
      const stillUnsynced = dataRef.current.debts.filter(
        (d) => !isPersistedId(d.id) && !(d.principal > 0),
      );
      onUpdate({
        debts: [...snapshotToWizardDebts(result.snapshot), ...stillUnsynced],
      });
    };
    registerStepCommit(commit);
    return () => registerStepCommit(null);
  }, [registerStepCommit, token, loading, onUpdate]);

  const addDebt = () => {
    const newDebt = createEmptyDebt();
    onUpdate({ debts: [...data.debts, newDebt] });
    setExpandedId(newDebt.id);
  };

  const updateDebt = (id: string, updates: Partial<DebtInput>) => {
    onUpdate({
      debts: data.debts.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    });
  };

  const removeDebt = (id: string) => {
    onUpdate({ debts: data.debts.filter((d) => d.id !== id) });
    if (expandedId === id) {
      const remaining = data.debts.filter((d) => d.id !== id);
      setExpandedId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Available vehicles for CAR loan linking (from Assets step)
  const availableVehicles = data.assets
    .filter((a) => a.type === 'VEHICLE')
    .map((a) => ({
      id: a.id,
      name:
        a.name ||
        `${a.vehicleYear || ''} ${a.vehicleMake || ''} ${a.vehicleModel || ''}`.trim() ||
        'Vehicle',
    }));

  const totalDebt = data.debts.reduce((sum, d) => sum + d.principal, 0);

  return (
    <WizardStepShell
      icon={<CreditCard className="h-8 w-8" strokeWidth={1.5} />}
      title="Your debts"
      subtitle="Let's see what you owe. Knowing your debts is the first step to your Debt Freedom plan."
    >
      {/* Real-table sync status — loading while reading, error on failure.
          Both are non-blocking (Phase 12 Track F.4). */}
      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading your debts…
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

      {data.debts.length > 0 && (
        <div className="space-y-3">
          {data.debts.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              availableVehicles={availableVehicles}
              isExpanded={expandedId === debt.id}
              onToggleExpand={() => setExpandedId(expandedId === debt.id ? null : debt.id)}
              onUpdate={(updates) => updateDebt(debt.id, updates)}
              onRemove={() => removeDebt(debt.id)}
            />
          ))}
        </div>
      )}

      <WizardAddButton leadingIcon={<Plus className="h-4 w-4" />} onClick={addDebt}>
        {data.debts.length === 0 ? 'Add your first debt' : 'Add another debt'}
      </WizardAddButton>

      {data.debts.length > 0 && (
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total non-property debt
            </span>
            <span className="text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
              {formatCurrency(totalDebt, { abbreviate: true })}
            </span>
          </div>
        </div>
      )}

      {data.debts.length === 0 && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          No debts to add? Click <span className="font-medium">Continue</span> to skip.
        </p>
      )}
    </WizardStepShell>
  );
}

export default DebtsStep;
