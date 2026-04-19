'use client';

/**
 * PropertiesStep — Phase 12 PR 3a redesign + simplification
 *
 * Captures owned properties (HOME or INVESTMENT) with their mortgage,
 * rental income (for investment), and recurring expenses.
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

import React, { useState } from 'react';
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
import '@/styles/wizard-animations.css';

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
          </div>

          {/* Advanced disclosure: purchase price + purchase date */}
          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <span className="flex items-center gap-1.5">
                <AdvancedIcon className="h-3.5 w-3.5" />
                Advanced details (purchase price & date)
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
                <WizardField
                  label="Purchase date"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={property.purchaseDate || ''}
                  onChange={(e) => onUpdate({ purchaseDate: e.target.value })}
                  helper="Used for CGT and depreciation — approximate month/year is fine"
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
}

export function PropertiesStep({ data, onUpdate }: PropertiesStepProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    data.properties.length > 0 ? data.properties[0].id : null
  );

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
