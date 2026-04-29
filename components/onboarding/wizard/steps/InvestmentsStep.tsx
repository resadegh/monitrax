'use client';

/**
 * InvestmentsStep — Phase 12 PR 3a visual redesign
 *
 * Captures investment accounts (brokerage, super, fund, trust, ETF/crypto)
 * and their holdings. PR 3a simplification:
 *   - Each account card is expandable — collapsed shows just the name
 *     and the value summary; expanded shows the holdings table
 *   - Holdings inline table with ticker / units / avg price
 *   - Live value preview at the card header level
 *
 * No data model changes. PR 3b will route SUPERS type to a dedicated
 * SuperannuationAccount step.
 */

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
} from 'lucide-react';
import {
  WizardData,
  InvestmentAccountInput,
  HoldingInput,
  InvestmentAccountType,
  generateId,
} from '../types';
import {
  WizardStepShell,
  WizardField,
  WizardCurrencyField,
  WizardSelectField,
  WizardAddButton,
} from '../primitives';
import { formatCurrency } from '@/lib/utils/formatters';
import '@/styles/wizard-animations.css';

// =============================================================================
// META
// =============================================================================

interface InvestmentTypeMeta {
  value: InvestmentAccountType;
  label: string;
  icon: React.ReactNode;
  accent: string;
}

const INVESTMENT_TYPES: InvestmentTypeMeta[] = [
  {
    value: 'BROKERAGE',
    label: 'Brokerage',
    icon: <BarChart3 className="h-5 w-5" />,
    accent: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  },
  {
    value: 'SUPERS',
    label: 'Superannuation',
    icon: <Briefcase className="h-5 w-5" />,
    accent: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
  },
  {
    value: 'FUND',
    label: 'Managed fund',
    icon: <Coins className="h-5 w-5" />,
    accent: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
  {
    value: 'TRUST',
    label: 'Trust',
    icon: <Briefcase className="h-5 w-5" />,
    accent: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  },
  {
    value: 'ETF_CRYPTO',
    label: 'ETF / Crypto',
    icon: <Bitcoin className="h-5 w-5" />,
    accent: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
  },
];

const INVESTMENT_TYPE_OPTIONS = INVESTMENT_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
}));

const HOLDING_TYPE_OPTIONS = [
  { value: 'SHARE', label: 'Share' },
  { value: 'ETF', label: 'ETF' },
  { value: 'MANAGED_FUND', label: 'Managed fund' },
  { value: 'CRYPTO', label: 'Crypto' },
];

// =============================================================================
// FACTORIES
// =============================================================================

function createEmptyInvestment(type: InvestmentAccountType = 'BROKERAGE'): InvestmentAccountInput {
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
    name: '',
    units: 0,
    averagePrice: 0,
    type: 'ETF',
  };
}

// =============================================================================
// ACCOUNT CARD
// =============================================================================

interface InvestmentCardProps {
  account: InvestmentAccountInput;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<InvestmentAccountInput>) => void;
  onRemove: () => void;
}

function InvestmentCard({
  account,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}: InvestmentCardProps) {
  const meta = INVESTMENT_TYPES.find((t) => t.value === account.type) ?? INVESTMENT_TYPES[0];
  const holdingsValue = account.holdings.reduce(
    (sum, h) => sum + h.units * h.averagePrice,
    0
  );
  const totalValue = account.cashBalance + holdingsValue;

  const addHolding = () =>
    onUpdate({ holdings: [...account.holdings, createEmptyHolding()] });

  const updateHolding = (holdingId: string, updates: Partial<HoldingInput>) =>
    onUpdate({
      holdings: account.holdings.map((h) => (h.id === holdingId ? { ...h, ...updates } : h)),
    });

  const removeHolding = (holdingId: string) =>
    onUpdate({ holdings: account.holdings.filter((h) => h.id !== holdingId) });

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
              {account.name || meta.label}
            </h4>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {account.platform || meta.label} · {account.holdings.length}{' '}
              {account.holdings.length === 1 ? 'holding' : 'holdings'}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          {totalValue > 0 && (
            <div className="text-right">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Value</div>
              <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(totalValue, { abbreviate: true })}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Remove account"
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
            <WizardField
              label="Account name"
              required
              placeholder="e.g. CommSec Portfolio"
              value={account.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
            />
            <WizardField
              label="Platform"
              placeholder="e.g. CommSec, Sharesies, Vanguard"
              value={account.platform || ''}
              onChange={(e) => onUpdate({ platform: e.target.value })}
            />
            <WizardSelectField
              label="Type"
              value={account.type}
              onChange={(v) => onUpdate({ type: v as InvestmentAccountType })}
              options={INVESTMENT_TYPE_OPTIONS}
            />
            <WizardCurrencyField
              label="Cash balance"
              value={account.cashBalance}
              onChange={(v) => onUpdate({ cashBalance: v })}
              helper="Uninvested cash in the account"
            />
          </div>

          {/* Holdings */}
          <div className="space-y-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 p-4">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Holdings
              </h5>
              <button
                type="button"
                onClick={addHolding}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <Plus className="h-3.5 w-3.5" />
                Add holding
              </button>
            </div>
            {account.holdings.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add shares, ETFs, or fund units you own in this account.
              </p>
            ) : (
              <div className="space-y-2">
                {account.holdings.map((h) => (
                  <div
                    key={h.id}
                    className="grid grid-cols-12 gap-2 rounded-lg bg-white dark:bg-slate-900/60 p-2.5"
                  >
                    <input
                      type="text"
                      value={h.ticker}
                      onChange={(e) =>
                        updateHolding(h.id, { ticker: e.target.value.toUpperCase() })
                      }
                      placeholder="TICKER"
                      className="wz-input col-span-3 uppercase"
                    />
                    <input
                      type="number"
                      value={h.units === 0 ? '' : h.units}
                      onChange={(e) =>
                        updateHolding(h.id, { units: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="Units"
                      min={0}
                      step="any"
                      className="wz-input col-span-3"
                    />
                    <div className="wz-input-currency-wrap col-span-3">
                      <span aria-hidden className="wz-input-currency-prefix">
                        $
                      </span>
                      <input
                        type="number"
                        value={h.averagePrice === 0 ? '' : h.averagePrice}
                        onChange={(e) =>
                          updateHolding(h.id, { averagePrice: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="Avg price"
                        min={0}
                        step="any"
                        className="wz-input"
                      />
                    </div>
                    <select
                      value={h.type}
                      onChange={(e) =>
                        updateHolding(h.id, {
                          type: e.target.value as HoldingInput['type'],
                        })
                      }
                      className="wz-input col-span-2"
                    >
                      {HOLDING_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeHolding(h.id)}
                      aria-label="Remove holding"
                      className="col-span-1 flex h-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {account.holdings.length > 0 && (
              <div className="flex justify-between pt-2 text-xs text-slate-600 dark:text-slate-400">
                <span>Total holdings value</span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(holdingsValue)}
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
// INVESTMENTS STEP
// =============================================================================

interface InvestmentsStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function InvestmentsStep({ data, onUpdate }: InvestmentsStepProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    data.investments.length > 0 ? data.investments[0].id : null
  );

  const addInvestment = () => {
    const newAcc = createEmptyInvestment();
    onUpdate({ investments: [...data.investments, newAcc] });
    setExpandedId(newAcc.id);
  };

  const updateInvestment = (id: string, updates: Partial<InvestmentAccountInput>) => {
    onUpdate({
      investments: data.investments.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    });
  };

  const removeInvestment = (id: string) => {
    onUpdate({ investments: data.investments.filter((i) => i.id !== id) });
    if (expandedId === id) {
      const remaining = data.investments.filter((i) => i.id !== id);
      setExpandedId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Summary
  const totalValue = data.investments.reduce((sum, inv) => {
    const holdingsValue = inv.holdings.reduce((h, hold) => h + hold.units * hold.averagePrice, 0);
    return sum + inv.cashBalance + holdingsValue;
  }, 0);
  const totalHoldings = data.investments.reduce((sum, inv) => sum + inv.holdings.length, 0);

  return (
    <WizardStepShell
      icon={<TrendingUp className="h-8 w-8" strokeWidth={1.5} />}
      title="Investments"
      subtitle="How you're growing. Track your investments to watch your wealth compound."
    >
      {data.investments.length > 0 && (
        <div className="space-y-3">
          {data.investments.map((account) => (
            <InvestmentCard
              key={account.id}
              account={account}
              isExpanded={expandedId === account.id}
              onToggleExpand={() => setExpandedId(expandedId === account.id ? null : account.id)}
              onUpdate={(updates) => updateInvestment(account.id, updates)}
              onRemove={() => removeInvestment(account.id)}
            />
          ))}
        </div>
      )}

      <WizardAddButton leadingIcon={<Plus className="h-4 w-4" />} onClick={addInvestment}>
        {data.investments.length === 0
          ? 'Add your first investment account'
          : 'Add another investment account'}
      </WizardAddButton>

      {data.investments.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/40 p-3 text-center">
            <div className="text-xl font-semibold tabular-nums text-blue-600 dark:text-blue-400">
              {data.investments.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {data.investments.length === 1 ? 'Account' : 'Accounts'}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/40 p-3 text-center">
            <div className="text-xl font-semibold tabular-nums text-violet-600 dark:text-violet-400">
              {totalHoldings}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {totalHoldings === 1 ? 'Holding' : 'Holdings'}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/40 p-3 text-center">
            <div className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalValue, { abbreviate: true })}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Total value</div>
          </div>
        </div>
      )}

      {data.investments.length === 0 && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          No investments yet? Click <span className="font-medium">Continue</span> to skip.
        </p>
      )}
    </WizardStepShell>
  );
}

export default InvestmentsStep;
