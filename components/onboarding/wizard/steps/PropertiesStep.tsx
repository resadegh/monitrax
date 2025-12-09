'use client';

import React, { useState } from 'react';
import {
  Home,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Building2,
  Landmark,
  DollarSign,
  Percent,
  Calendar,
  MapPin,
  Users,
  Receipt,
} from 'lucide-react';
import {
  WizardData,
  PropertyInput,
  PropertyLoanInput,
  PropertyIncomeInput,
  PropertyExpenseInput,
  PropertyType,
  generateId,
} from '../types';
import '@/styles/wizard-animations.css';

// =============================================================================
// CONSTANTS
// =============================================================================

const PROPERTY_TYPES: { value: PropertyType; label: string; icon: React.ReactNode }[] = [
  { value: 'PRIMARY_RESIDENCE', label: 'Primary Residence', icon: <Home className="h-4 w-4" /> },
  { value: 'INVESTMENT', label: 'Investment Property', icon: <Building2 className="h-4 w-4" /> },
  { value: 'HOLIDAY_HOME', label: 'Holiday Home', icon: <Home className="h-4 w-4" /> },
];

const EXPENSE_CATEGORIES = [
  'Council Rates',
  'Water Rates',
  'Strata Fees',
  'Insurance',
  'Property Management',
  'Maintenance',
  'Land Tax',
  'Other',
];

const FREQUENCIES = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
] as const;

const REPAYMENT_FREQUENCIES = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
] as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createEmptyProperty(): PropertyInput {
  return {
    id: generateId(),
    name: '',
    address: '',
    type: 'PRIMARY_RESIDENCE',
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
    lender: '',
    principal: 0,
    interestRate: 0,
    rateType: 'VARIABLE',
    isInterestOnly: false,
    repaymentAmount: 0,
    repaymentFrequency: 'MONTHLY',
  };
}

function createEmptyIncome(): PropertyIncomeInput {
  return {
    id: generateId(),
    type: 'RENT',
    amount: 0,
    frequency: 'WEEKLY',
    tenantName: '',
  };
}

function createEmptyExpense(): PropertyExpenseInput {
  return {
    id: generateId(),
    name: '',
    category: 'Other',
    amount: 0,
    frequency: 'ANNUAL',
  };
}

// =============================================================================
// PROPERTY CARD COMPONENT
// =============================================================================

interface PropertyCardProps {
  property: PropertyInput;
  index: number;
  onUpdate: (updates: Partial<PropertyInput>) => void;
  onRemove: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function PropertyCard({
  property,
  index,
  onUpdate,
  onRemove,
  isExpanded,
  onToggleExpand,
}: PropertyCardProps) {
  const isInvestment = property.type === 'INVESTMENT';

  const updateLoan = (updates: Partial<PropertyLoanInput>) => {
    onUpdate({
      loan: property.loan ? { ...property.loan, ...updates } : undefined,
    });
  };

  const updateIncome = (updates: Partial<PropertyIncomeInput>) => {
    onUpdate({
      income: property.income ? { ...property.income, ...updates } : undefined,
    });
  };

  const addExpense = () => {
    onUpdate({
      expenses: [...property.expenses, createEmptyExpense()],
    });
  };

  const updateExpense = (expenseId: string, updates: Partial<PropertyExpenseInput>) => {
    onUpdate({
      expenses: property.expenses.map((exp) =>
        exp.id === expenseId ? { ...exp, ...updates } : exp
      ),
    });
  };

  const removeExpense = (expenseId: string) => {
    onUpdate({
      expenses: property.expenses.filter((exp) => exp.id !== expenseId),
    });
  };

  return (
    <div
      className="profile-card border rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden"
      style={{ '--card-index': index } as React.CSSProperties}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-800/40 rounded-lg">
            <Home className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              {property.name || `Property ${index + 1}`}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {property.address || 'No address'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-6 border-t border-gray-100 dark:border-gray-700">
          {/* Basic Details */}
          <div className="space-y-4">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Property Details
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Property Name
                </label>
                <input
                  type="text"
                  value={property.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                  placeholder="e.g., Family Home"
                  className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Property Type
                </label>
                <select
                  value={property.type}
                  onChange={(e) => {
                    const newType = e.target.value as PropertyType;
                    onUpdate({
                      type: newType,
                      income: newType === 'INVESTMENT' ? createEmptyIncome() : undefined,
                    });
                  }}
                  className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PROPERTY_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={property.address}
                  onChange={(e) => onUpdate({ address: e.target.value })}
                  placeholder="Full property address"
                  className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Purchase Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={property.purchasePrice || ''}
                    onChange={(e) => onUpdate({ purchasePrice: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="wizard-input w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Current Value
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={property.currentValue || ''}
                    onChange={(e) => onUpdate({ currentValue: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="wizard-input w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Loan Section */}
          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                Mortgage / Loan
              </h5>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={property.hasLoan}
                  onChange={(e) => {
                    onUpdate({
                      hasLoan: e.target.checked,
                      loan: e.target.checked ? createEmptyLoan() : undefined,
                    });
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Has loan
              </label>
            </div>

            {property.hasLoan && property.loan && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Lender
                  </label>
                  <input
                    type="text"
                    value={property.loan.lender}
                    onChange={(e) => updateLoan({ lender: e.target.value })}
                    placeholder="e.g., ANZ, CBA, Westpac"
                    className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Outstanding Balance
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={property.loan.principal || ''}
                      onChange={(e) => updateLoan({ principal: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="wizard-input w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Interest Rate
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={property.loan.interestRate || ''}
                      onChange={(e) => updateLoan({ interestRate: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="wizard-input w-full pl-3 pr-7 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-2 text-gray-400">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Rate Type
                  </label>
                  <select
                    value={property.loan.rateType}
                    onChange={(e) => updateLoan({ rateType: e.target.value as 'FIXED' | 'VARIABLE' })}
                    className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="VARIABLE">Variable</option>
                    <option value="FIXED">Fixed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Repayment Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={property.loan.repaymentAmount || ''}
                      onChange={(e) => updateLoan({ repaymentAmount: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="wizard-input w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Repayment Frequency
                  </label>
                  <select
                    value={property.loan.repaymentFrequency}
                    onChange={(e) =>
                      updateLoan({
                        repaymentFrequency: e.target.value as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY',
                      })
                    }
                    className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {REPAYMENT_FREQUENCIES.map((freq) => (
                      <option key={freq.value} value={freq.value}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={property.loan.isInterestOnly}
                      onChange={(e) => updateLoan({ isInterestOnly: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Interest Only
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Rental Income (Investment Properties) */}
          {isInvestment && (
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Rental Income
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Rent Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={property.income?.amount || ''}
                      onChange={(e) => updateIncome({ amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="wizard-input w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Frequency
                  </label>
                  <select
                    value={property.income?.frequency || 'WEEKLY'}
                    onChange={(e) =>
                      updateIncome({
                        frequency: e.target.value as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY',
                      })
                    }
                    className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {REPAYMENT_FREQUENCIES.map((freq) => (
                      <option key={freq.value} value={freq.value}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Tenant Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={property.income?.tenantName || ''}
                    onChange={(e) => updateIncome({ tenantName: e.target.value })}
                    placeholder="Tenant name"
                    className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Property Expenses */}
          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Property Expenses
              </h5>
              <button
                onClick={addExpense}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Expense
              </button>
            </div>

            {property.expenses.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                No expenses added yet. Add common expenses like rates, insurance, or maintenance.
              </div>
            ) : (
              <div className="space-y-3">
                {property.expenses.map((expense, expIndex) => (
                  <div
                    key={expense.id}
                    className="flex gap-2 items-start bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg"
                  >
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <select
                        value={expense.category}
                        onChange={(e) =>
                          updateExpense(expense.id, {
                            category: e.target.value,
                            name: e.target.value,
                          })
                        }
                        className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-400">$</span>
                        <input
                          type="number"
                          value={expense.amount || ''}
                          onChange={(e) =>
                            updateExpense(expense.id, { amount: parseFloat(e.target.value) || 0 })
                          }
                          placeholder="Amount"
                          className="wizard-input w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <select
                        value={expense.frequency}
                        onChange={(e) =>
                          updateExpense(expense.id, {
                            frequency: e.target.value as PropertyExpenseInput['frequency'],
                          })
                        }
                        className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {FREQUENCIES.map((freq) => (
                          <option key={freq.value} value={freq.value}>
                            {freq.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeExpense(expense.id)}
                        className="flex items-center justify-center p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
// PROPERTIES STEP COMPONENT
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
    onUpdate({
      properties: [...data.properties, newProperty],
    });
    setExpandedId(newProperty.id);
  };

  const updateProperty = (propertyId: string, updates: Partial<PropertyInput>) => {
    onUpdate({
      properties: data.properties.map((p) =>
        p.id === propertyId ? { ...p, ...updates } : p
      ),
    });
  };

  const removeProperty = (propertyId: string) => {
    onUpdate({
      properties: data.properties.filter((p) => p.id !== propertyId),
    });
    if (expandedId === propertyId) {
      setExpandedId(data.properties.length > 1 ? data.properties[0].id : null);
    }
  };

  return (
    <div className="space-y-6 wizard-step-enter">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl mb-2">
          <Home className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Your Properties
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-sm">
          Add your properties with their loans and expenses. This helps us track your equity and
          calculate your net worth accurately.
        </p>
      </div>

      {/* Property Cards */}
      <div className="space-y-4">
        {data.properties.map((property, index) => (
          <PropertyCard
            key={property.id}
            property={property}
            index={index}
            onUpdate={(updates) => updateProperty(property.id, updates)}
            onRemove={() => removeProperty(property.id)}
            isExpanded={expandedId === property.id}
            onToggleExpand={() =>
              setExpandedId(expandedId === property.id ? null : property.id)
            }
          />
        ))}
      </div>

      {/* Add Property Button */}
      <button
        onClick={addProperty}
        className="wizard-add-button w-full p-6 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
      >
        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <Plus className="h-6 w-6" />
        </div>
        <span className="font-medium">
          {data.properties.length === 0 ? 'Add Your First Property' : 'Add Another Property'}
        </span>
        <span className="text-xs text-gray-400">
          Primary residence, investment property, or holiday home
        </span>
      </button>

      {/* Summary */}
      {data.properties.length > 0 && (
        <div className="wizard-card bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl" style={{ '--card-index': 0 } as React.CSSProperties}>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Property Summary
          </h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {data.properties.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {data.properties.length === 1 ? 'Property' : 'Properties'}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${(data.properties.reduce((sum, p) => sum + p.currentValue, 0) / 1000000).toFixed(2)}M
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Value</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                ${(data.properties.reduce((sum, p) => sum + (p.loan?.principal || 0), 0) / 1000000).toFixed(2)}M
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Debt</div>
            </div>
          </div>
        </div>
      )}

      {/* Skip hint */}
      {data.properties.length === 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Don&apos;t have any properties? No problem! Click <strong>Continue</strong> to skip this
          step.
        </p>
      )}
    </div>
  );
}
