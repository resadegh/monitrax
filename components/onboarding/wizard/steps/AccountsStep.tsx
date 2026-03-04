'use client';

import React, { useState } from 'react';
import {
  Wallet,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Landmark,
  PiggyBank,
  Link2,
  Building2,
} from 'lucide-react';
import {
  WizardData,
  AccountInput,
  AccountType,
  generateId,
  getLoansFromProperties,
} from '../types';
import { formatCurrency } from '@/lib/utils/formatters';
import '@/styles/wizard-animations.css';

// =============================================================================
// CONSTANTS
// =============================================================================

const ACCOUNT_TYPES: {
  value: AccountType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    value: 'TRANSACTIONAL',
    label: 'Transaction',
    description: 'Everyday spending account',
    icon: <Wallet className="h-5 w-5" />,
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'SAVINGS',
    label: 'Savings',
    description: 'High interest savings',
    icon: <PiggyBank className="h-5 w-5" />,
    color: 'text-green-600 dark:text-green-400',
  },
  {
    value: 'OFFSET',
    label: 'Offset',
    description: 'Linked to mortgage',
    icon: <Link2 className="h-5 w-5" />,
    color: 'text-purple-600 dark:text-purple-400',
  },
  {
    value: 'CREDIT_CARD',
    label: 'Credit Card',
    description: 'Credit card account',
    icon: <CreditCard className="h-5 w-5" />,
    color: 'text-orange-600 dark:text-orange-400',
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createEmptyAccount(type: AccountType = 'TRANSACTIONAL'): AccountInput {
  return {
    id: generateId(),
    name: '',
    type,
    currentBalance: 0,
    linkedLoanId: undefined,
  };
}

// =============================================================================
// ACCOUNT CARD COMPONENT
// =============================================================================

interface AccountCardProps {
  account: AccountInput;
  index: number;
  availableLoans: Array<{ id: string; name: string; propertyName: string }>;
  onUpdate: (updates: Partial<AccountInput>) => void;
  onRemove: () => void;
}

function AccountCard({
  account,
  index,
  availableLoans,
  onUpdate,
  onRemove,
}: AccountCardProps) {
  const accountType = ACCOUNT_TYPES.find((t) => t.value === account.type);
  const isNegative = account.type === 'CREDIT_CARD';
  const linkedLoan = availableLoans.find((l) => l.id === account.linkedLoanId);

  return (
    <div
      className="profile-card border rounded-xl bg-white dark:bg-gray-800 shadow-sm p-4 space-y-4"
      style={{ '--card-index': index } as React.CSSProperties}
    >
      {/* Account Type Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              account.type === 'TRANSACTIONAL'
                ? 'bg-blue-100 dark:bg-blue-800/40'
                : account.type === 'SAVINGS'
                ? 'bg-green-100 dark:bg-green-800/40'
                : account.type === 'OFFSET'
                ? 'bg-purple-100 dark:bg-purple-800/40'
                : 'bg-orange-100 dark:bg-orange-800/40'
            }`}
          >
            <span className={accountType?.color}>{accountType?.icon}</span>
          </div>
          <div>
            <select
              value={account.type}
              onChange={(e) => {
                const newType = e.target.value as AccountType;
                onUpdate({
                  type: newType,
                  linkedLoanId: newType === 'OFFSET' ? account.linkedLoanId : undefined,
                });
              }}
              className="text-sm font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Account Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Account Name
          </label>
          <input
            type="text"
            value={account.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={`e.g., ${account.type === 'CREDIT_CARD' ? 'Visa Platinum' : 'Everyday Account'}`}
            className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {isNegative ? 'Outstanding Balance' : 'Current Balance'}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-400">$</span>
            <input
              type="number"
              value={account.currentBalance || ''}
              onChange={(e) => onUpdate({ currentBalance: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="wizard-input w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {isNegative && (
            <p className="text-xs text-gray-400 mt-1">Enter as positive number (debt)</p>
          )}
        </div>
      </div>

      {/* Offset Linking */}
      {account.type === 'OFFSET' && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            <span className="flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              Link to Loan
            </span>
          </label>
          {availableLoans.length > 0 ? (
            <select
              value={account.linkedLoanId || ''}
              onChange={(e) => onUpdate({ linkedLoanId: e.target.value || undefined })}
              className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a loan to link</option>
              {availableLoans.map((loan) => (
                <option key={loan.id} value={loan.id}>
                  {loan.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
              No loans available. Add a property with a loan first to link an offset account.
            </p>
          )}
          {linkedLoan && (
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Linked to {linkedLoan.propertyName}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// QUICK ADD BUTTONS
// =============================================================================

interface QuickAddButtonProps {
  type: AccountType;
  onClick: () => void;
}

function QuickAddButton({ type, onClick }: QuickAddButtonProps) {
  const accountType = ACCOUNT_TYPES.find((t) => t.value === type)!;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all"
    >
      <div
        className={`p-2 rounded-lg ${
          type === 'TRANSACTIONAL'
            ? 'bg-blue-100 dark:bg-blue-800/40'
            : type === 'SAVINGS'
            ? 'bg-green-100 dark:bg-green-800/40'
            : type === 'OFFSET'
            ? 'bg-purple-100 dark:bg-purple-800/40'
            : 'bg-orange-100 dark:bg-orange-800/40'
        }`}
      >
        <span className={accountType.color}>{accountType.icon}</span>
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {accountType.label}
      </span>
    </button>
  );
}

// =============================================================================
// ACCOUNTS STEP COMPONENT
// =============================================================================

interface AccountsStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function AccountsStep({ data, onUpdate }: AccountsStepProps) {
  const availableLoans = getLoansFromProperties(data.properties);

  const addAccount = (type: AccountType = 'TRANSACTIONAL') => {
    const newAccount = createEmptyAccount(type);
    onUpdate({
      accounts: [...data.accounts, newAccount],
    });
  };

  const updateAccount = (accountId: string, updates: Partial<AccountInput>) => {
    onUpdate({
      accounts: data.accounts.map((a) =>
        a.id === accountId ? { ...a, ...updates } : a
      ),
    });
  };

  const removeAccount = (accountId: string) => {
    onUpdate({
      accounts: data.accounts.filter((a) => a.id !== accountId),
    });
  };

  // Calculate totals
  const totalAssets = data.accounts
    .filter((a) => a.type !== 'CREDIT_CARD')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const totalDebt = data.accounts
    .filter((a) => a.type === 'CREDIT_CARD')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const netBalance = totalAssets - totalDebt;

  return (
    <div className="space-y-6 wizard-step-enter">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white text-2xl mb-2">
          <Landmark className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Bank Accounts
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-sm">
          Add your bank accounts to track your liquid assets. If you have an offset account, you
          can link it to your mortgage.
        </p>
      </div>

      {/* Quick Add Buttons */}
      {data.accounts.length === 0 && (
        <div className="wizard-card" style={{ '--card-index': 0 } as React.CSSProperties}>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
            Quick add common account types:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ACCOUNT_TYPES.map((type) => (
              <QuickAddButton
                key={type.value}
                type={type.value}
                onClick={() => addAccount(type.value)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Account Cards */}
      {data.accounts.length > 0 && (
        <div className="space-y-4">
          {data.accounts.map((account, index) => (
            <AccountCard
              key={account.id}
              account={account}
              index={index}
              availableLoans={availableLoans}
              onUpdate={(updates) => updateAccount(account.id, updates)}
              onRemove={() => removeAccount(account.id)}
            />
          ))}
        </div>
      )}

      {/* Add Account Button */}
      {data.accounts.length > 0 && (
        <button
          onClick={() => addAccount()}
          className="wizard-add-button w-full p-4 rounded-xl flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
        >
          <Plus className="h-5 w-5" />
          <span className="font-medium">Add Another Account</span>
        </button>
      )}

      {/* Summary */}
      {data.accounts.length > 0 && (
        <div
          className="wizard-card bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-xl"
          style={{ '--card-index': data.accounts.length } as React.CSSProperties}
        >
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Account Summary
          </h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(totalAssets, { abbreviate: true })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Cash Assets</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(totalDebt, { abbreviate: true })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Credit Card Debt</div>
            </div>
            <div>
              <div
                className={`text-2xl font-bold ${
                  netBalance >= 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatCurrency(netBalance, { abbreviate: true })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Net Balance</div>
            </div>
          </div>

          {/* Offset Summary */}
          {data.accounts.some((a) => a.type === 'OFFSET' && a.linkedLoanId) && (
            <div className="mt-4 pt-3 border-t border-green-200 dark:border-green-800">
              <div className="text-xs text-purple-600 dark:text-purple-400 flex items-center justify-center gap-2">
                <Link2 className="h-3 w-3" />
                {data.accounts.filter((a) => a.type === 'OFFSET' && a.linkedLoanId).length} offset
                account(s) linked to loans
              </div>
            </div>
          )}
        </div>
      )}

      {/* Skip hint */}
      {data.accounts.length === 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          We recommend adding at least one bank account for accurate cashflow tracking.
        </p>
      )}
    </div>
  );
}
