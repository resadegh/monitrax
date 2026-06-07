'use client';

/**
 * PropertiesStep — Phase 12 PR 3a redesign + Track F.2 two-way sync
 *
 * Captures owned properties (HOME or INVESTMENT) with their mortgage,
 * rental income (for investment), and recurring expenses.
 *
 * ============================================================================
 * TRACK F.2 — onboarding ⇄ real-table two-way sync (2026-05-20)
 * ============================================================================
 * Before F.2 this step staged the property aggregate into the `WizardData`
 * draft blob, and the real tables (`Property` / `Loan` / `Income` /
 * `Expense`) were written ONCE at the final `/api/onboarding/bulk-create`.
 * Result: `/dashboard/properties` showed empty while the wizard held a full
 * portfolio — a §12.2 SSOT violation.
 *
 * F.2 makes this step read + write the REAL tables directly:
 *   - ON OPEN  — `readProperties()` loads the real tables and merges them
 *     into `WizardData.properties` (real properties + any unsynced
 *     chat-staged / in-session ones). `snapshotRef` captures the baseline.
 *   - ON CONTINUE / BACK / JUMP — the registered `commit` diffs the current
 *     portfolio against the snapshot and `syncProperties()` writes the delta
 *     (create / update / hard-delete — design Q-F2), idempotent on re-entry.
 *
 * Per Reza's scope decision the unit is the WHOLE property aggregate —
 * `Property` + its mortgage `Loan` + rental `Income` + `Expense`s — so a
 * mortgage entered here IS the real `Loan` row the Debts step + dashboard
 * read. See `lib/onboarding/propertiesSync.ts` and
 * `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md`.
 *
 * Simplification (PR 3a):
 *   - Purchase price and purchase date demoted behind "Advanced details"
 *     disclosure. Only name + current value are asked up front (enough
 *     to compute net worth). Purchase-date enforcement is already
 *     applied at API level in PR 1 if the user expands Advanced.
 *   - Loan section collapsed by default — expanded only when "Has
 *     mortgage" is ticked.
 *   - Inline equity preview shown as the user types.
 *
 * All existing WizardData fields are preserved. No new fields.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import {
  Home,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Building2,
  Landmark,
  MapPin,
  Users as UsersIcon,
  Receipt,
  Settings as AdvancedIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  WizardData,
  PropertyInput,
  PropertyLoanInput,
  PropertyIncomeInput,
  PropertyExpenseInput,
  PropertyType,
  ExpenseCategory,
  generateId,
  type StepCommitFn,
} from '../types';
import {
  WizardStepShell,
  WizardSection,
  WizardField,
  WizardCurrencyField,
  WizardPercentField,
  WizardSelectField,
  WizardAddButton,
} from '../primitives';
import { formatCurrency } from '@/lib/utils/formatters';
import { useAuth } from '@/lib/context/AuthContext';
import {
  readProperties,
  syncProperties,
  snapshotToWizardProperties,
  wizardPropertiesToSnapshot,
  isPersistedId,
  EMPTY_PROPERTIES_SNAPSHOT,
  type PropertiesSnapshot,
} from '@/lib/onboarding/propertiesSync';
import { REFORM_CUT_OVER_UTC } from '@/lib/tax-engine/config/reformConstants';
import '@/styles/wizard-animations.css';

// CLAUDE.md §12.14 NON-NEGOTIABLE: no other file may hard-code the cut-over
// timestamp; import the canonical SSOT instead.
const REFORM_CUT_OVER_UTC_MS = REFORM_CUT_OVER_UTC.getTime();

// =============================================================================
// CONSTANTS
// =============================================================================

const PROPERTY_TYPE_OPTIONS = [
  { value: 'HOME' as const, label: 'Primary residence' },
  { value: 'INVESTMENT' as const, label: 'Investment property' },
];

const RATE_TYPE_OPTIONS = [
  { value: 'VARIABLE', label: 'Variable' },
  { value: 'FIXED', label: 'Fixed' },
];

const REPAYMENT_FREQ_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const RENT_FREQ_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

const EXPENSE_FREQ_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
];

const PROPERTY_EXPENSE_CATEGORIES: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'RATES', label: 'Council rates' },
  { value: 'STRATA', label: 'Strata fees' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'LAND_TAX', label: 'Land tax' },
  { value: 'OTHER', label: 'Other' },
];

// =============================================================================
// EMPTY FACTORIES
// =============================================================================

function createEmptyProperty(): PropertyInput {
  return {
    id: generateId(),
    name: '',
    address: '',
    type: 'HOME',
    purchasePrice: 0,
    currentValue: 0,
    purchaseDate: '',
    hasLoan: true,
    loan: createEmptyLoan(),
    expenses: [],
  };
}

function createEmptyLoan(): PropertyLoanInput {
  return {
    id: generateId(),
    name: '',
    lender: '',
    principal: 0,
    interestRateAnnual: 0,
    rateType: 'VARIABLE',
    isInterestOnly: false,
    termMonthsRemaining: 360,
    minRepayment: 0,
    repaymentFrequency: 'MONTHLY',
  };
}

function createEmptyIncome(): PropertyIncomeInput {
  return {
    id: generateId(),
    type: 'RENTAL',
    amount: 0,
    frequency: 'WEEKLY',
    tenantName: '',
  };
}

function createEmptyExpense(): PropertyExpenseInput {
  return {
    id: generateId(),
    name: '',
    category: 'RATES',
    amount: 0,
    frequency: 'ANNUAL',
  };
}

// =============================================================================
// PROPERTY CARD
// =============================================================================

interface PropertyCardProps {
  property: PropertyInput;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<PropertyInput>) => void;
  onRemove: () => void;
}

function PropertyCard({
  property,
  index,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}: PropertyCardProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isInvestment = property.type === 'INVESTMENT';

  const updateLoan = (updates: Partial<PropertyLoanInput>) => {
    onUpdate({ loan: property.loan ? { ...property.loan, ...updates } : undefined });
  };

  const updateIncome = (updates: Partial<PropertyIncomeInput>) => {
    onUpdate({ income: property.income ? { ...property.income, ...updates } : undefined });
  };

  const addExpense = () => {
    onUpdate({ expenses: [...property.expenses, createEmptyExpense()] });
  };

  const updateExpense = (expenseId: string, updates: Partial<PropertyExpenseInput>) => {
    onUpdate({
      expenses: property.expenses.map((exp) =>
        exp.id === expenseId ? { ...exp, ...updates } : exp
      ),
    });
  };

  const removeExpense = (expenseId: string) => {
    onUpdate({ expenses: property.expenses.filter((exp) => exp.id !== expenseId) });
  };

  // Live equity preview
  const equity = property.currentValue - (property.loan?.principal ?? 0);
  const hasEquity = property.currentValue > 0;

  return (
    <div
      className="wz-section"
      style={{ padding: 0 }} // override default to manage our own padding
    >
      {/* Header — always visible, click to expand */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-[0_6px_18px_-6px_rgba(99,102,241,0.45)]">
            {isInvestment ? <Building2 className="h-5 w-5" /> : <Home className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {property.name || `Property ${index + 1}`}
            </h4>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {property.address || (isInvestment ? 'Investment property' : 'Primary residence')}
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
            aria-label="Remove property"
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
        <div className="space-y-5 border-t border-slate-200/70 dark:border-slate-700/50 px-5 pb-5 pt-4">
          {/* Basic details */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <WizardField
              label="Property name"
              required
              placeholder="e.g. Family home"
              value={property.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
            />
            <WizardSelectField
              label="Type"
              required
              value={property.type}
              onChange={(v) => {
                const newType = v as PropertyType;
                onUpdate({
                  type: newType,
                  income: newType === 'INVESTMENT' ? createEmptyIncome() : undefined,
                });
              }}
              options={PROPERTY_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-foreground">Address</label>
              <AddressAutocomplete
                value={property.address}
                onChange={(value) => onUpdate({ address: value })}
                onAddressSelect={(addr) => onUpdate({ address: addr.formatted_address })}
                placeholder="Start typing an address..."
              />
              <p className="text-xs text-muted-foreground">Approximate is fine — used to enrich tax defaults.</p>
            </div>
            <WizardCurrencyField
              label="Current value"
              required
              value={property.currentValue}
              onChange={(v) => onUpdate({ currentValue: v })}
              helper="A rough estimate is fine"
            />
            <div className="flex items-end">
              {hasEquity && (
                <div className="flex-1 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-3 py-2.5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Equity
                  </div>
                  <div
                    className={`text-lg font-semibold tabular-nums ${
                      equity >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(equity)}
                  </div>
                </div>
              )}
            </div>
            {/*
             * Purchase date moved out of the Advanced disclosure.
             * The bulk-create endpoint rejects properties without a
             * purchase date (used for CGT, depreciation history) and
             * users were missing it because the field was hidden
             * behind the collapsed Advanced section. Surface it as a
             * primary required field and gate Continue on it via
             * canProceed in WizardContainer.
             */}
            <WizardField
              className="sm:col-span-2"
              label="Purchase date"
              required
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={property.purchaseDate || ''}
              onChange={(e) => onUpdate({ purchaseDate: e.target.value })}
              helper="Used for CGT and depreciation — approximate month/year is fine"
            />
          </div>

          {/*
           * Phase 41E.5 — reform fields, conditional on post-cut-over purchase.
           * Cut-over = 7:30pm AEST 12 May 2026 = 2026-05-12T09:30:00Z UTC.
           * For pre-cut-over properties the bulk-create writer auto-fills
           * acquisitionContractDate := purchaseDate (unambiguously grandfathered).
           * For post-cut-over we prompt for the contract date + new-build status,
           * because they drive the reform regime classification.
           */}
          {(() => {
            const purchaseDateMs = property.purchaseDate
              ? new Date(property.purchaseDate).getTime()
              : null;
            if (purchaseDateMs === null || purchaseDateMs <= REFORM_CUT_OVER_UTC_MS) {
              return null;
            }
            return (
              <div className="rounded-lg border border-sky-200/70 bg-sky-50/60 p-3 dark:border-sky-800/50 dark:bg-sky-950/30">
                <div className="mb-2">
                  <p className="text-xs font-medium text-sky-900 dark:text-sky-100">
                    Tax-reform fields (Phase 41E)
                  </p>
                  <p className="mt-0.5 text-[11px] text-sky-700/80 dark:text-sky-300/70">
                    Properties contracted after 12 May 2026 7:30pm AEST follow the new
                    negative-gearing + CGT rules from FY 2027-28. We capture the contract
                    date + new-build status now so the engine can classify the regime later.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <WizardField
                    label="Contract date (if different from purchase)"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={property.acquisitionContractDate || ''}
                    onChange={(e) => onUpdate({ acquisitionContractDate: e.target.value || undefined })}
                    helper="The contract / CGT event A1 date (s109-5). Leave blank to use the purchase date above."
                  />
                  <div>
                    <label
                      htmlFor={`property-newbuild-${property.id}`}
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Is this a new build?
                    </label>
                    <select
                      id={`property-newbuild-${property.id}`}
                      value={
                        property.isNewBuild === undefined
                          ? ''
                          : property.isNewBuild
                            ? 'true'
                            : 'false'
                      }
                      onChange={(e) =>
                        onUpdate({
                          isNewBuild: e.target.value === '' ? undefined : e.target.value === 'true',
                        })
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">Select…</option>
                      <option value="true">Yes — qualifies as a new build</option>
                      <option value="false">No — established dwelling</option>
                    </select>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      New builds retain negative gearing from FY 2027-28; established
                      dwellings do not.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Advanced disclosure: purchase price (date moved out — required) */}
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <span className="flex items-center gap-1.5">
                <AdvancedIcon className="h-3.5 w-3.5" />
                Advanced details (purchase price)
              </span>
              {showAdvanced ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-1 gap-3 border-t border-dashed border-slate-200 dark:border-slate-700 p-3 sm:grid-cols-2">
                <WizardCurrencyField
                  label="Purchase price"
                  value={property.purchasePrice}
                  onChange={(v) => onUpdate({ purchasePrice: v })}
                  helper="What you originally paid"
                />
              </div>
            )}
          </div>

          {/* Mortgage */}
          <div className="space-y-3 pt-1">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={property.hasLoan}
                onChange={(e) =>
                  onUpdate({
                    hasLoan: e.target.checked,
                    loan: e.target.checked ? createEmptyLoan() : undefined,
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
              />
              <Landmark className="h-4 w-4 text-slate-500" />
              This property has a mortgage
            </label>

            {property.hasLoan && property.loan && (
              <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <WizardField
                    label="Lender"
                    placeholder="e.g. ANZ, CBA, Westpac"
                    value={property.loan.lender}
                    onChange={(e) => updateLoan({ lender: e.target.value })}
                  />
                  <WizardCurrencyField
                    label="Outstanding balance"
                    required
                    value={property.loan.principal}
                    onChange={(v) => updateLoan({ principal: v })}
                  />
                  <WizardPercentField
                    label="Interest rate"
                    required
                    value={property.loan.interestRateAnnual}
                    onChange={(v) => updateLoan({ interestRateAnnual: v })}
                    max={15}
                    helper="Annual rate, e.g. 6.25"
                  />
                  <WizardSelectField
                    label="Rate type"
                    value={property.loan.rateType}
                    onChange={(v) => updateLoan({ rateType: v as 'VARIABLE' | 'FIXED' })}
                    options={RATE_TYPE_OPTIONS}
                  />
                  <WizardCurrencyField
                    label="Minimum repayment"
                    required
                    value={property.loan.minRepayment}
                    onChange={(v) => updateLoan({ minRepayment: v })}
                  />
                  <WizardSelectField
                    label="Repayment frequency"
                    value={property.loan.repaymentFrequency}
                    onChange={(v) =>
                      updateLoan({ repaymentFrequency: v as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' })
                    }
                    options={REPAYMENT_FREQ_OPTIONS}
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={property.loan.isInterestOnly}
                      onChange={(e) => updateLoan({ isInterestOnly: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Interest only
                  </label>
                </div>
                {/* Phase 12 Track F.2: the mortgage entered here IS the real
                    Loan row — the Debts step + dashboard read the same row.
                    Tell the user so the Debts step isn't a surprise re-ask. */}
                <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <Landmark className="h-3.5 w-3.5 flex-shrink-0 mt-px text-slate-400" />
                  <span>
                    We&apos;ve linked this mortgage to {property.name || 'this property'}.
                    You can fine-tune the rate, offset and repayments in the Debts step.
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Rental income (investment only) */}
          {isInvestment && (
            <div className="space-y-3 pt-1">
              <h5 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <UsersIcon className="h-4 w-4 text-slate-500" />
                Rental income
              </h5>
              <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-900/10 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <WizardCurrencyField
                    label="Rent amount"
                    value={property.income?.amount ?? 0}
                    onChange={(v) => updateIncome({ amount: v })}
                  />
                  <WizardSelectField
                    label="Frequency"
                    value={property.income?.frequency || 'WEEKLY'}
                    onChange={(v) =>
                      updateIncome({ frequency: v as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' })
                    }
                    options={RENT_FREQ_OPTIONS}
                  />
                  <WizardField
                    label="Tenant name (optional)"
                    placeholder="Tenant"
                    value={property.income?.tenantName || ''}
                    onChange={(e) => updateIncome({ tenantName: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Property expenses */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <h5 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Receipt className="h-4 w-4 text-slate-500" />
                Property expenses
              </h5>
              <button
                type="button"
                onClick={addExpense}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <Plus className="h-3.5 w-3.5" />
                Add expense
              </button>
            </div>
            {property.expenses.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                Add rates, insurance, maintenance — approximate is fine.
              </p>
            ) : (
              <div className="space-y-2">
                {property.expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="grid grid-cols-12 gap-2 rounded-lg bg-amber-50/60 dark:bg-amber-900/10 p-3"
                  >
                    <div className="col-span-5 sm:col-span-4">
                      <select
                        value={exp.category}
                        onChange={(e) =>
                          updateExpense(exp.id, {
                            category: e.target.value as ExpenseCategory,
                            name:
                              PROPERTY_EXPENSE_CATEGORIES.find((c) => c.value === e.target.value)
                                ?.label || exp.name,
                          })
                        }
                        className="wz-input"
                      >
                        {PROPERTY_EXPENSE_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4 sm:col-span-3">
                      <div className="wz-input-currency-wrap">
                        <span aria-hidden className="wz-input-currency-prefix">
                          $
                        </span>
                        <input
                          type="number"
                          value={exp.amount === 0 ? '' : exp.amount}
                          onChange={(e) =>
                            updateExpense(exp.id, { amount: parseFloat(e.target.value) || 0 })
                          }
                          placeholder="0"
                          className="wz-input"
                        />
                      </div>
                    </div>
                    <div className="col-span-3 sm:col-span-4">
                      <select
                        value={exp.frequency}
                        onChange={(e) =>
                          updateExpense(exp.id, {
                            frequency: e.target.value as PropertyExpenseInput['frequency'],
                          })
                        }
                        className="wz-input"
                      >
                        {EXPENSE_FREQ_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExpense(exp.id)}
                      aria-label="Remove expense"
                      className="col-span-12 flex h-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20 sm:col-span-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PROPERTIES STEP
// =============================================================================

interface PropertiesStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  /**
   * Phase 12 Track F.2: register an async commit with the container. The
   * container awaits it before advancing — it writes the property aggregate
   * (`Property` + mortgage `Loan` + rental `Income` + `Expense`s) to its
   * real tables. Optional so the step still renders in non-wizard contexts.
   */
  registerStepCommit?: (fn: StepCommitFn | null) => void;
}

export function PropertiesStep({ data, onUpdate, registerStepCommit }: PropertiesStepProps) {
  const { token } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(
    data.properties.length > 0 ? data.properties[0].id : null
  );

  // ---- Phase 12 Track F.2: real-table sync state ----------------------
  // `loading` is true while the initial READ of the real tables is in
  // flight. `loadError` surfaces a failed READ. `snapshotRef` holds the
  // baseline the commit diffs against — the portfolio as it was at
  // step-open (or after the last successful commit).
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const snapshotRef = useRef<PropertiesSnapshot>(EMPTY_PROPERTIES_SNAPSHOT);
  // Latest `data` in a ref so the registered commit closure always reads
  // the freshest portfolio without re-registering on every keypress.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // ---- READ the real tables on step open -----------------------------
  // Seeds `snapshotRef` (the diff baseline) and merges the real-table
  // portfolio into `WizardData.properties`. The merge keeps the real
  // properties (authoritative — they carry real ids) AND any wizard
  // property that is NOT yet persisted (a synthetic `temp_…` / `chat-…`
  // id) — so a property staged in chat mode, or added in-session before
  // this read resolved, is never lost. It is synced on the next Continue.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    readProperties(token)
      .then((snapshot) => {
        if (cancelled) return;
        snapshotRef.current = snapshot;
        const realProps = snapshotToWizardProperties(snapshot);
        const unsynced = dataRef.current.properties.filter(
          (p) => !isPersistedId(p.id),
        );
        onUpdate({ properties: [...realProps, ...unsynced] });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Could not load your properties. You can still edit — we’ll save when you continue.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Run once on mount — token is stable post-auth, `onUpdate` is a
    // stable useCallback from the container.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- COMMIT: register the real-table write with the container -------
  // Diffs the user's current portfolio (from `dataRef`) against
  // `snapshotRef` and writes the delta via the property/loan/income/
  // expense entity APIs. On success, re-seeds the snapshot + WizardData
  // with the fresh real ids so the NEXT Continue is idempotent.
  useEffect(() => {
    if (!registerStepCommit) return;
    const commit: StepCommitFn = async () => {
      if (loading) {
        throw new Error('Still loading your properties — please wait a moment.');
      }
      const current = wizardPropertiesToSnapshot(dataRef.current.properties);
      const result = await syncProperties(token, snapshotRef.current, current);
      snapshotRef.current = result.snapshot;
      // Re-seed from the just-written real tables, but KEEP any in-session
      // property card that is still incomplete (synthetic id, no purchase
      // date) — `syncProperties` deliberately does not persist those, so
      // re-seeding from the snapshot alone would discard a half-filled card
      // the user is still working on (e.g. on a Back navigation).
      const stillUnsynced = dataRef.current.properties.filter(
        (p) => !isPersistedId(p.id) && !p.purchaseDate?.trim(),
      );
      onUpdate({
        properties: [...snapshotToWizardProperties(result.snapshot), ...stillUnsynced],
      });
    };
    registerStepCommit(commit);
    return () => registerStepCommit(null);
  }, [registerStepCommit, token, loading, onUpdate]);

  const addProperty = () => {
    const newProperty = createEmptyProperty();
    onUpdate({ properties: [...data.properties, newProperty] });
    setExpandedId(newProperty.id);
  };

  const updateProperty = (propertyId: string, updates: Partial<PropertyInput>) => {
    onUpdate({
      properties: data.properties.map((p) => (p.id === propertyId ? { ...p, ...updates } : p)),
    });
  };

  const removeProperty = (propertyId: string) => {
    onUpdate({ properties: data.properties.filter((p) => p.id !== propertyId) });
    if (expandedId === propertyId) {
      const remaining = data.properties.filter((p) => p.id !== propertyId);
      setExpandedId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Summary
  const totalValue = data.properties.reduce((sum, p) => sum + p.currentValue, 0);
  const totalDebt = data.properties.reduce((sum, p) => sum + (p.loan?.principal || 0), 0);
  const totalEquity = totalValue - totalDebt;

  return (
    <WizardStepShell
      icon={<Home className="h-8 w-8" strokeWidth={1.5} />}
      title="Your properties"
      subtitle="What you're building. Properties are the foundation of your wealth on the TRAIL."
    >
      {/* Real-table sync status — loading while reading, error on failure.
          Both are non-blocking: the user can still edit and a successful
          commit on Continue persists everything (Phase 12 Track F.2). */}
      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading your properties…
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

      {data.properties.map((property, index) => (
        <PropertyCard
          key={property.id}
          property={property}
          index={index}
          isExpanded={expandedId === property.id}
          onToggleExpand={() =>
            setExpandedId(expandedId === property.id ? null : property.id)
          }
          onUpdate={(updates) => updateProperty(property.id, updates)}
          onRemove={() => removeProperty(property.id)}
        />
      ))}

      <WizardAddButton
        leadingIcon={<Plus className="h-4 w-4" />}
        onClick={addProperty}
      >
        {data.properties.length === 0 ? 'Add your first property' : 'Add another property'}
      </WizardAddButton>

      {data.properties.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryTile label="Properties" value={`${data.properties.length}`} accent="blue" />
          <SummaryTile
            label="Total value"
            value={formatCurrency(totalValue, { abbreviate: true })}
            accent="emerald"
          />
          <SummaryTile
            label="Total equity"
            value={formatCurrency(totalEquity, { abbreviate: true })}
            accent={totalEquity >= 0 ? 'violet' : 'rose'}
          />
        </div>
      )}

      {data.properties.length === 0 && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Don&apos;t own any property? Click <span className="font-medium">Continue</span> to skip.
        </p>
      )}
    </WizardStepShell>
  );
}

// =============================================================================
// SUMMARY TILE
// =============================================================================

function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'blue' | 'emerald' | 'violet' | 'rose';
}) {
  const accentClass = {
    blue: 'text-blue-600 dark:text-blue-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    violet: 'text-violet-600 dark:text-violet-400',
    rose: 'text-rose-600 dark:text-rose-400',
  }[accent];
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/40 p-3 text-center">
      <div className={`text-xl font-semibold tabular-nums ${accentClass}`}>{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

export default PropertiesStep;
