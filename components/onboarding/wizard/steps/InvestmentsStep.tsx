'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Coins,
  Briefcase,
  BarChart3,
  Bitcoin,
  DollarSign,
} from 'lucide-react';
import {
  WizardData,
  InvestmentAccountInput,
  HoldingInput,
  InvestmentAccountType,
  HoldingType,
  generateId,
} from '../types';
import '@/styles/wizard-animations.css';

// =============================================================================
// CONSTANTS
// =============================================================================

const ACCOUNT_TYPES: {
  value: InvestmentAccountType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    value: 'BROKERAGE',
    label: 'Brokerage',
    description: 'Share trading account',
    icon: <BarChart3 className="h-5 w-5" />,
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'SUPERS',
    label: 'Superannuation',
    description: 'Retirement savings',
    icon: <Briefcase className="h-5 w-5" />,
    color: 'text-purple-600 dark:text-purple-400',
  },
  {
    value: 'FUND',
    label: 'Managed Fund',
    description: 'ETFs & managed investments',
    icon: <Coins className="h-5 w-5" />,
    color: 'text-green-600 dark:text-green-400',
  },
  {
    value: 'ETF_CRYPTO',
    label: 'ETF / Crypto',
    description: 'ETFs & Cryptocurrency holdings',
    icon: <Bitcoin className="h-5 w-5" />,
    color: 'text-orange-600 dark:text-orange-400',
  },
  {
    value: 'TRUST',
    label: 'Trust',
    description: 'Trust investments',
    icon: <Briefcase className="h-5 w-5" />,
    color: 'text-pink-600 dark:text-pink-400',
  },
];

const COMMON_TICKERS = ['VAS', 'VGS', 'IVV', 'A200', 'NDQ', 'VDHG', 'IOZ', 'STW', 'AFI', 'ARG'];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createEmptyAccount(type: InvestmentAccountType = 'BROKERAGE'): InvestmentAccountInput {
  return {
    id: generateId(),
    name: '',
    platform: '',
    type,
    cashBalance: 0,
    holdings: [],
  };
}

function createEmptyHolding(): HoldingInput {
  return {
    id: generateId(),
    ticker: '',
    units: 0,
    averagePrice: 0,
    type: 'SHARE',
  };
}

function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  if (absAmount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  }
  if (absAmount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

// =============================================================================
// HOLDING ROW COMPONENT
// =============================================================================

interface HoldingRowProps {
  holding: HoldingInput;
  onUpdate: (updates: Partial<HoldingInput>) => void;
  onRemove: () => void;
  showSuggestions?: boolean;
}

function HoldingRow({ holding, onUpdate, onRemove, showSuggestions }: HoldingRowProps) {
  const holdingValue = holding.units * holding.averagePrice;

  return (
    <div className="flex gap-2 items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
      <div className="flex-1 grid grid-cols-4 gap-2">
        <div className="relative">
          <input
            type="text"
            value={holding.ticker}
            onChange={(e) => onUpdate({ ticker: e.target.value.toUpperCase() })}
            placeholder="Ticker"
            list="common-tickers"
            className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          {showSuggestions && (
            <datalist id="common-tickers">
              {COMMON_TICKERS.map((ticker) => (
                <option key={ticker} value={ticker} />
              ))}
            </datalist>
          )}
        </div>
        <input
          type="number"
          value={holding.units || ''}
          onChange={(e) => onUpdate({ units: parseFloat(e.target.value) || 0 })}
          placeholder="Units"
          className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="relative">
          <span className="absolute left-3 top-2 text-gray-400">$</span>
          <input
            type="number"
            step="0.01"
            value={holding.averagePrice || ''}
            onChange={(e) => onUpdate({ averagePrice: parseFloat(e.target.value) || 0 })}
            placeholder="Avg Price"
            className="wizard-input w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {holdingValue > 0 ? formatCurrency(holdingValue) : '-'}
          </span>
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// INVESTMENT CARD COMPONENT
// =============================================================================

interface InvestmentCardProps {
  account: InvestmentAccountInput;
  index: number;
  onUpdate: (updates: Partial<InvestmentAccountInput>) => void;
  onRemove: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function InvestmentCard({
  account,
  index,
  onUpdate,
  onRemove,
  isExpanded,
  onToggleExpand,
}: InvestmentCardProps) {
  const accountType = ACCOUNT_TYPES.find((t) => t.value === account.type);

  const holdingsValue = account.holdings.reduce(
    (sum, h) => sum + h.units * h.averagePrice,
    0
  );
  const totalValue = account.cashBalance + holdingsValue;

  const addHolding = () => {
    onUpdate({
      holdings: [...account.holdings, createEmptyHolding()],
    });
  };

  const updateHolding = (holdingId: string, updates: Partial<HoldingInput>) => {
    onUpdate({
      holdings: account.holdings.map((h) =>
        h.id === holdingId ? { ...h, ...updates } : h
      ),
    });
  };

  const removeHolding = (holdingId: string) => {
    onUpdate({
      holdings: account.holdings.filter((h) => h.id !== holdingId),
    });
  };

  return (
    <div
      className="profile-card border rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden"
      style={{ '--card-index': index } as React.CSSProperties}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 cursor-pointer ${
          account.type === 'BROKERAGE'
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20'
            : account.type === 'SUPERS'
            ? 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20'
            : account.type === 'ETF_CRYPTO'
            ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20'
            : 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20'
        }`}
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              account.type === 'BROKERAGE'
                ? 'bg-blue-100 dark:bg-blue-800/40'
                : account.type === 'SUPERS'
                ? 'bg-purple-100 dark:bg-purple-800/40'
                : account.type === 'ETF_CRYPTO'
                ? 'bg-orange-100 dark:bg-orange-800/40'
                : 'bg-green-100 dark:bg-green-800/40'
            }`}
          >
            <span className={accountType?.color}>{accountType?.icon}</span>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              {account.name || `${accountType?.label} Account`}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {account.platform || 'No platform'} • {formatCurrency(totalValue)}
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
        <div className="p-4 space-y-4 border-t border-gray-100 dark:border-gray-700">
          {/* Account Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={account.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="e.g., My Share Portfolio"
                className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Platform
              </label>
              <input
                type="text"
                value={account.platform}
                onChange={(e) => onUpdate({ platform: e.target.value })}
                placeholder="e.g., CommSec, SelfWealth"
                className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Account Type
              </label>
              <select
                value={account.type}
                onChange={(e) => onUpdate({ type: e.target.value as InvestmentAccountType })}
                className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cash Balance */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Cash Balance (uninvested)
            </label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-2 text-gray-400">$</span>
              <input
                type="number"
                value={account.cashBalance || ''}
                onChange={(e) => onUpdate({ cashBalance: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="wizard-input w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Holdings Section */}
          <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Holdings
              </h5>
              <button
                onClick={addHolding}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Holding
              </button>
            </div>

            {account.holdings.length > 0 && (
              <div className="grid grid-cols-4 gap-2 text-xs text-gray-500 dark:text-gray-400 px-3">
                <span>Ticker</span>
                <span>Units</span>
                <span>Avg Price</span>
                <span>Value</span>
              </div>
            )}

            {account.holdings.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                No holdings added yet. Add your shares, ETFs, or other investments.
              </div>
            ) : (
              <div className="space-y-2">
                {account.holdings.map((holding, hIndex) => (
                  <HoldingRow
                    key={holding.id}
                    holding={holding}
                    onUpdate={(updates) => updateHolding(holding.id, updates)}
                    onRemove={() => removeHolding(holding.id)}
                    showSuggestions={hIndex === 0}
                  />
                ))}
              </div>
            )}

            {/* Holdings Summary */}
            {account.holdings.length > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">
                  {account.holdings.length} holding{account.holdings.length !== 1 ? 's' : ''}
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  Total: {formatCurrency(holdingsValue)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// INVESTMENTS STEP COMPONENT
// =============================================================================

interface InvestmentsStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function InvestmentsStep({ data, onUpdate }: InvestmentsStepProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    data.investments.length > 0 ? data.investments[0].id : null
  );

  const addAccount = (type: InvestmentAccountType = 'BROKERAGE') => {
    const newAccount = createEmptyAccount(type);
    onUpdate({
      investments: [...data.investments, newAccount],
    });
    setExpandedId(newAccount.id);
  };

  const updateAccount = (accountId: string, updates: Partial<InvestmentAccountInput>) => {
    onUpdate({
      investments: data.investments.map((a) =>
        a.id === accountId ? { ...a, ...updates } : a
      ),
    });
  };

  const removeAccount = (accountId: string) => {
    onUpdate({
      investments: data.investments.filter((a) => a.id !== accountId),
    });
    if (expandedId === accountId) {
      setExpandedId(data.investments.length > 1 ? data.investments[0].id : null);
    }
  };

  // Calculate totals
  const totalValue = data.investments.reduce((sum, acc) => {
    const holdingsValue = acc.holdings.reduce((h, hold) => h + hold.units * hold.averagePrice, 0);
    return sum + acc.cashBalance + holdingsValue;
  }, 0);

  const totalHoldings = data.investments.reduce(
    (sum, acc) => sum + acc.holdings.length,
    0
  );

  return (
    <div className="space-y-6 wizard-step-enter">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 text-white text-2xl mb-2">
          <TrendingUp className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Investment Accounts
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-sm">
          Add your share portfolios, superannuation, and other investments. Track your holdings
          and monitor your investment growth.
        </p>
      </div>

      {/* Quick Add Buttons */}
      {data.investments.length === 0 && (
        <div className="wizard-card" style={{ '--card-index': 0 } as React.CSSProperties}>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
            Select account type to get started:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ACCOUNT_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => addAccount(type.value)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all"
              >
                <div
                  className={`p-2 rounded-lg ${
                    type.value === 'BROKERAGE'
                      ? 'bg-blue-100 dark:bg-blue-800/40'
                      : type.value === 'SUPERS'
                      ? 'bg-purple-100 dark:bg-purple-800/40'
                      : type.value === 'ETF_CRYPTO'
                      ? 'bg-orange-100 dark:bg-orange-800/40'
                      : 'bg-green-100 dark:bg-green-800/40'
                  }`}
                >
                  <span className={type.color}>{type.icon}</span>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {type.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Account Cards */}
      {data.investments.length > 0 && (
        <div className="space-y-4">
          {data.investments.map((account, index) => (
            <InvestmentCard
              key={account.id}
              account={account}
              index={index}
              onUpdate={(updates) => updateAccount(account.id, updates)}
              onRemove={() => removeAccount(account.id)}
              isExpanded={expandedId === account.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === account.id ? null : account.id)
              }
            />
          ))}
        </div>
      )}

      {/* Add Account Button */}
      {data.investments.length > 0 && (
        <button
          onClick={() => addAccount()}
          className="wizard-add-button w-full p-4 rounded-xl flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
        >
          <Plus className="h-5 w-5" />
          <span className="font-medium">Add Another Investment Account</span>
        </button>
      )}

      {/* Summary */}
      {data.investments.length > 0 && (
        <div
          className="wizard-card bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl"
          style={{ '--card-index': data.investments.length } as React.CSSProperties}
        >
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Investment Summary
          </h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {data.investments.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {data.investments.length === 1 ? 'Account' : 'Accounts'}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {totalHoldings}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Holdings</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(totalValue)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Value</div>
            </div>
          </div>
        </div>
      )}

      {/* Skip hint */}
      {data.investments.length === 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          No investment accounts? No problem! Click <strong>Continue</strong> to skip this step.
        </p>
      )}
    </div>
  );
}
