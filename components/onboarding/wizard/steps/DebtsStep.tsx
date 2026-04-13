'use client';

/**
 * DebtsStep — Phase 12 PR 3b
 *
 * Captures non-property loans: car loans, HECS/student loans, personal
 * loans, business loans. Shown conditionally based on the Welcome
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

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
  WizardData,
  DebtInput,
  DebtLoanType,
  DebtCategory,
  generateId,
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
}

export function DebtsStep({ data, onUpdate }: DebtsStepProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    data.debts.length > 0 ? data.debts[0].id : null
  );

  // On first render, if the user has debt categories but no debt rows
  // yet, pre-seed one row per category so they're not staring at an
  // empty step. Only runs when debts is empty to avoid re-seeding on
  // navigation back.
  useEffect(() => {
    if (data.debts.length === 0 && data.debtCategories.length > 0) {
      const seeded = data.debtCategories.map((cat) =>
        createEmptyDebt(debtCategoryToType(cat))
      );
      onUpdate({ debts: seeded });
      setExpandedId(seeded[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      subtitle="Non-property loans — car loans, HECS/student debt, personal or business loans. Credit cards are handled in the Accounts step."
    >
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
