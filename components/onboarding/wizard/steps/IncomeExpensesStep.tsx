'use client';

import React, { useState } from 'react';
import {
  DollarSign,
  Plus,
  Trash2,
  Briefcase,
  TrendingUp,
  Banknote,
  Building,
  Store,
  MoreHorizontal,
  ShoppingCart,
  Zap,
  Car,
  Heart,
  Shield,
  Tv,
  UtensilsCrossed,
  GraduationCap,
  Users,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';
import {
  WizardData,
  IncomeInput,
  ExpenseInput,
  IncomeType,
  SalaryType,
  ExpenseCategory,
  generateId,
} from '../types';
import { formatCurrency } from '@/lib/utils/formatters';
import { toAnnual } from '@/lib/utils/frequencies';
import '@/styles/wizard-animations.css';

// =============================================================================
// CONSTANTS
// =============================================================================

const INCOME_TYPES: {
  value: IncomeType;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { value: 'SALARY', label: 'Salary', icon: <Briefcase className="h-4 w-4" />, color: 'text-blue-600' },
  { value: 'INVESTMENT', label: 'Investment Income', icon: <TrendingUp className="h-4 w-4" />, color: 'text-purple-600' },
  { value: 'RENT', label: 'Rent Received', icon: <Building className="h-4 w-4" />, color: 'text-amber-600' },
  { value: 'RENTAL', label: 'Rental Income', icon: <Building className="h-4 w-4" />, color: 'text-green-600' },
  { value: 'OTHER', label: 'Other', icon: <MoreHorizontal className="h-4 w-4" />, color: 'text-gray-600' },
];

const EXPENSE_CATEGORIES: {
  value: ExpenseCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
  examples: string;
}[] = [
  { value: 'HOUSING', label: 'Housing', icon: <Building className="h-4 w-4" />, color: 'text-blue-600', examples: 'Rent, mortgage' },
  { value: 'UTILITIES', label: 'Utilities', icon: <Zap className="h-4 w-4" />, color: 'text-yellow-600', examples: 'Electricity, gas, water' },
  { value: 'FOOD', label: 'Food & Groceries', icon: <ShoppingCart className="h-4 w-4" />, color: 'text-green-600', examples: 'Food, household items' },
  { value: 'TRANSPORT', label: 'Transport', icon: <Car className="h-4 w-4" />, color: 'text-blue-600', examples: 'Fuel, public transport' },
  { value: 'INSURANCE', label: 'Insurance', icon: <Shield className="h-4 w-4" />, color: 'text-purple-600', examples: 'Health, life, home' },
  { value: 'ENTERTAINMENT', label: 'Entertainment', icon: <Tv className="h-4 w-4" />, color: 'text-pink-600', examples: 'Movies, events, streaming' },
  { value: 'PERSONAL', label: 'Personal', icon: <Package className="h-4 w-4" />, color: 'text-gray-600', examples: 'Clothing, personal care' },
  { value: 'RATES', label: 'Council Rates', icon: <Building className="h-4 w-4" />, color: 'text-teal-600', examples: 'Council rates' },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: <Package className="h-4 w-4" />, color: 'text-orange-600', examples: 'Repairs, upkeep' },
  { value: 'STRATA', label: 'Strata Fees', icon: <Building className="h-4 w-4" />, color: 'text-indigo-600', examples: 'Body corporate fees' },
  { value: 'LAND_TAX', label: 'Land Tax', icon: <Building className="h-4 w-4" />, color: 'text-red-600', examples: 'Land tax' },
  { value: 'LOAN_INTEREST', label: 'Loan Interest', icon: <Banknote className="h-4 w-4" />, color: 'text-amber-600', examples: 'Interest payments' },
  { value: 'REGISTRATION', label: 'Registration', icon: <Car className="h-4 w-4" />, color: 'text-cyan-600', examples: 'Vehicle registration' },
  { value: 'MODIFICATIONS', label: 'Modifications', icon: <Package className="h-4 w-4" />, color: 'text-violet-600', examples: 'Asset modifications' },
  { value: 'OTHER', label: 'Other', icon: <MoreHorizontal className="h-4 w-4" />, color: 'text-gray-500', examples: 'Miscellaneous' },
];

const FREQUENCIES = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'ANNUAL', label: 'Annual' },
] as const;

// =============================================================================
// HELPER FUNCTIONS
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

function annualizeAmount(amount: number, frequency: string): number {
  // Use centralized utility for frequency conversion
  return toAnnual(amount, frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL');
}

// =============================================================================
// INCOME CARD COMPONENT
// =============================================================================

interface IncomeCardProps {
  income: IncomeInput;
  onUpdate: (updates: Partial<IncomeInput>) => void;
  onRemove: () => void;
}

function IncomeCard({ income, onUpdate, onRemove }: IncomeCardProps) {
  const incomeType = INCOME_TYPES.find((t) => t.value === income.type);
  const annualAmount = annualizeAmount(income.amount, income.frequency);

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-800 p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={incomeType?.color}>{incomeType?.icon}</span>
          <select
            value={income.type}
            onChange={(e) => {
              const newType = e.target.value as IncomeType;
              onUpdate({
                type: newType,
                salaryType: newType === 'SALARY' ? 'GROSS' : undefined,
                frequency: newType === 'SALARY' ? 'ANNUAL' : 'MONTHLY',
              });
            }}
            className="text-sm font-medium text-gray-900 dark:text-gray-100 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
          >
            {INCOME_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Description
          </label>
          <input
            type="text"
            value={income.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={income.type === 'SALARY' ? 'e.g., Main Job' : 'Description'}
            className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-400">$</span>
            <input
              type="number"
              step="any"
              value={income.amount || ''}
              onChange={(e) => onUpdate({ amount: parseFloat(e.target.value) || 0 })}
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
            value={income.frequency}
            onChange={(e) =>
              onUpdate({ frequency: e.target.value as IncomeInput['frequency'] })
            }
            className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {FREQUENCIES.map((freq) => (
              <option key={freq.value} value={freq.value}>
                {freq.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Salary-specific options */}
      {income.type === 'SALARY' && (
        <div className="flex items-center gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Amount is:</span>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`salary-type-${income.id}`}
              checked={income.salaryType === 'GROSS'}
              onChange={() => onUpdate({ salaryType: 'GROSS' })}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700 dark:text-gray-300">Gross (before tax)</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`salary-type-${income.id}`}
              checked={income.salaryType === 'NET'}
              onChange={() => onUpdate({ salaryType: 'NET' })}
              className="text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700 dark:text-gray-300">Net (after tax)</span>
          </label>
        </div>
      )}

      {/* Annualized indicator */}
      {income.amount > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
          = {formatCurrency(annualAmount)} per year
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EXPENSE CARD COMPONENT
// =============================================================================

interface ExpenseCardProps {
  expense: ExpenseInput;
  onUpdate: (updates: Partial<ExpenseInput>) => void;
  onRemove: () => void;
}

function ExpenseCard({ expense, onUpdate, onRemove }: ExpenseCardProps) {
  const expenseCategory = EXPENSE_CATEGORIES.find((c) => c.value === expense.category);
  const annualAmount = annualizeAmount(expense.amount, expense.frequency);

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-800 p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={expenseCategory?.color}>{expenseCategory?.icon}</span>
          <select
            value={expense.category}
            onChange={(e) =>
              onUpdate({ category: e.target.value as ExpenseCategory })
            }
            className="text-sm font-medium text-gray-900 dark:text-gray-100 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
          >
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Description
          </label>
          <input
            type="text"
            value={expense.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={expenseCategory?.examples || 'Description'}
            className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-400">$</span>
            <input
              type="number"
              step="any"
              value={expense.amount || ''}
              onChange={(e) => onUpdate({ amount: parseFloat(e.target.value) || 0 })}
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
            value={expense.frequency}
            onChange={(e) =>
              onUpdate({ frequency: e.target.value as ExpenseInput['frequency'] })
            }
            className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {FREQUENCIES.map((freq) => (
              <option key={freq.value} value={freq.value}>
                {freq.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Annualized indicator */}
      {expense.amount > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
          = {formatCurrency(annualAmount)} per year
        </div>
      )}
    </div>
  );
}

// =============================================================================
// INCOME & EXPENSES STEP COMPONENT
// =============================================================================

interface IncomeExpensesStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function IncomeExpensesStep({ data, onUpdate }: IncomeExpensesStepProps) {
  const [activeTab, setActiveTab] = useState<'income' | 'expenses'>('income');

  const addIncome = () => {
    onUpdate({
      income: [...data.income, createEmptyIncome()],
    });
  };

  const updateIncome = (incomeId: string, updates: Partial<IncomeInput>) => {
    onUpdate({
      income: data.income.map((i) =>
        i.id === incomeId ? { ...i, ...updates } : i
      ),
    });
  };

  const removeIncome = (incomeId: string) => {
    onUpdate({
      income: data.income.filter((i) => i.id !== incomeId),
    });
  };

  const addExpense = () => {
    onUpdate({
      expenses: [...data.expenses, createEmptyExpense()],
    });
  };

  const updateExpense = (expenseId: string, updates: Partial<ExpenseInput>) => {
    onUpdate({
      expenses: data.expenses.map((e) =>
        e.id === expenseId ? { ...e, ...updates } : e
      ),
    });
  };

  const removeExpense = (expenseId: string) => {
    onUpdate({
      expenses: data.expenses.filter((e) => e.id !== expenseId),
    });
  };

  // Calculate totals
  const totalAnnualIncome = data.income.reduce(
    (sum, i) => sum + annualizeAmount(i.amount, i.frequency),
    0
  );
  const totalAnnualExpenses = data.expenses.reduce(
    (sum, e) => sum + annualizeAmount(e.amount, e.frequency),
    0
  );
  const annualSurplus = totalAnnualIncome - totalAnnualExpenses;

  return (
    <div className="space-y-6 wizard-step-enter">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-teal-600 text-white text-2xl mb-2">
          <DollarSign className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Income & Expenses
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-sm">
          Set up your regular income and living expenses. This helps us calculate your cashflow
          and savings potential.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('income')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'income'
              ? 'bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <ArrowUpCircle className="h-4 w-4" />
          Income ({data.income.length})
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'expenses'
              ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <ArrowDownCircle className="h-4 w-4" />
          Expenses ({data.expenses.length})
        </button>
      </div>

      {/* Income Tab */}
      {activeTab === 'income' && (
        <div className="space-y-4">
          {data.income.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              <ArrowUpCircle className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No income sources added yet
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {INCOME_TYPES.slice(0, 4).map((type) => (
                  <button
                    key={type.value}
                    onClick={() => {
                      onUpdate({
                        income: [...data.income, createEmptyIncome(type.value)],
                      });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 transition-colors"
                  >
                    {type.icon}
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {data.income.map((income) => (
                <IncomeCard
                  key={income.id}
                  income={income}
                  onUpdate={(updates) => updateIncome(income.id, updates)}
                  onRemove={() => removeIncome(income.id)}
                />
              ))}
            </div>
          )}

          {data.income.length > 0 && (
            <button
              onClick={addIncome}
              className="wizard-add-button w-full p-3 rounded-lg flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Add Another Income Source</span>
            </button>
          )}
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {data.expenses.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              <ArrowDownCircle className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No expenses added yet
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXPENSE_CATEGORIES.slice(0, 6).map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => {
                      onUpdate({
                        expenses: [...data.expenses, createEmptyExpense(cat.value)],
                      });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 transition-colors"
                  >
                    {cat.icon}
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {data.expenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  onUpdate={(updates) => updateExpense(expense.id, updates)}
                  onRemove={() => removeExpense(expense.id)}
                />
              ))}
            </div>
          )}

          {data.expenses.length > 0 && (
            <button
              onClick={addExpense}
              className="wizard-add-button w-full p-3 rounded-lg flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Add Another Expense</span>
            </button>
          )}
        </div>
      )}

      {/* Summary */}
      {(data.income.length > 0 || data.expenses.length > 0) && (
        <div className="wizard-card bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-slate-900/50 p-4 rounded-xl" style={{ '--card-index': 0 } as React.CSSProperties}>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Cashflow Summary (Annual)
          </h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(totalAnnualIncome, { abbreviate: true })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Income</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(totalAnnualExpenses, { abbreviate: true })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Expenses</div>
            </div>
            <div>
              <div
                className={`text-2xl font-bold ${
                  annualSurplus >= 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {annualSurplus >= 0 ? '+' : ''}{formatCurrency(annualSurplus, { abbreviate: true })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {annualSurplus >= 0 ? 'Surplus' : 'Deficit'}
              </div>
            </div>
          </div>
          {annualSurplus > 0 && (
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
              That&apos;s {formatCurrency(annualSurplus / 12)} per month available for savings or investments!
            </p>
          )}
        </div>
      )}

      {/* Hint */}
      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        Tip: Property rental income and expenses are captured in the Properties step.
      </p>
    </div>
  );
}
