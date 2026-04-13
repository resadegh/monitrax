'use client';

/**
 * AccountsStep — Phase 12 PR 3a visual redesign
 *
 * Captures bank / transaction / savings / offset / credit card accounts.
 * PR 3a simplification:
 *   - Account type chosen via segmented quick-add (one click)
 *   - Each account card is compact — 2-column grid
 *   - Offset→loan link surfaces only for OFFSET accounts
 *   - Summary tiles at the bottom
 *
 * PR 3b will add the Basiq "Connect your bank" primary CTA at the top.
 */

import React from 'react';
import {
  Wallet,
  Plus,
  Trash2,
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
import {
  WizardStepShell,
  WizardSection,
  WizardField,
  WizardCurrencyField,
  WizardSelectField,
  WizardAddButton,
} from '../primitives';
import { formatCurrency } from '@/lib/utils/formatters';
import '@/styles/wizard-animations.css';

// =============================================================================
// ACCOUNT TYPE META
// =============================================================================

interface AccountTypeMeta {
  value: AccountType;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}

const ACCOUNT_TYPES: AccountTypeMeta[] = [
  {
    value: 'TRANSACTIONAL',
    label: 'Transaction',
    description: 'Everyday spending',
    icon: <Wallet className="h-5 w-5" />,
    accent: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  },
  {
    value: 'SAVINGS',
    label: 'Savings',
    description: 'High-interest',
    icon: <PiggyBank className="h-5 w-5" />,
    accent: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
  {
    value: 'OFFSET',
    label: 'Offset',
    description: 'Linked to mortgage',
    icon: <Link2 className="h-5 w-5" />,
    accent: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
  },
  {
    value: 'CREDIT_CARD',
    label: 'Credit card',
    description: 'Balance as debt',
    icon: <CreditCard className="h-5 w-5" />,
    accent: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  },
];

const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
}));

// =============================================================================
// HELPERS
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
// ACCOUNT CARD
// =============================================================================

interface AccountCardProps {
  account: AccountInput;
  availableLoans: Array<{ id: string; name: string; propertyName: string }>;
  onUpdate: (updates: Partial<AccountInput>) => void;
  onRemove: () => void;
}

function AccountCard({ account, availableLoans, onUpdate, onRemove }: AccountCardProps) {
  const meta = ACCOUNT_TYPES.find((t) => t.value === account.type) ?? ACCOUNT_TYPES[0];
  const isCredit = account.type === 'CREDIT_CARD';
  const linkedLoan = availableLoans.find((l) => l.id === account.linkedLoanId);

  return (
    <div className="wz-section">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${meta.accent}`}>
            {meta.icon}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {meta.label}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">{meta.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove account"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <WizardField
          label="Account name"
          placeholder={isCredit ? 'e.g. Visa platinum' : 'e.g. Everyday account'}
          value={account.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
        <WizardCurrencyField
          label={isCredit ? 'Outstanding balance' : 'Current balance'}
          required
          value={account.currentBalance}
          onChange={(v) => onUpdate({ currentBalance: v })}
          helper={isCredit ? 'Enter as a positive number — we\u2019ll track it as debt.' : undefined}
        />
        <WizardField
          className="sm:col-span-2"
          label="Institution (optional)"
          placeholder="e.g. CommBank, NAB, ANZ"
          value={account.institution || ''}
          onChange={(e) => onUpdate({ institution: e.target.value })}
        />
        <WizardSelectField
          className="sm:col-span-2"
          label="Change type"
          value={account.type}
          onChange={(v) => {
            const newType = v as AccountType;
            onUpdate({
              type: newType,
              linkedLoanId: newType === 'OFFSET' ? account.linkedLoanId : undefined,
            });
          }}
          options={ACCOUNT_TYPE_OPTIONS}
        />
      </div>

      {account.type === 'OFFSET' && (
        <div className="mt-4 rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-violet-50/60 dark:bg-violet-900/10 p-3">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Link2 className="h-3 w-3" />
            Link to a loan
          </label>
          {availableLoans.length > 0 ? (
            <select
              value={account.linkedLoanId || ''}
              onChange={(e) => onUpdate({ linkedLoanId: e.target.value || undefined })}
              className="wz-input"
            >
              <option value="">Select a loan to link</option>
              {availableLoans.map((loan) => (
                <option key={loan.id} value={loan.id}>
                  {loan.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No loans to link yet. Add a property with a mortgage first.
            </p>
          )}
          {linkedLoan && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
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
// QUICK ADD TILE
// =============================================================================

function QuickAddTile({ meta, onClick }: { meta: AccountTypeMeta; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-white/40 p-4 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/20"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.accent}`}>
        {meta.icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
          {meta.label}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">{meta.description}</div>
      </div>
    </button>
  );
}

// =============================================================================
// ACCOUNTS STEP
// =============================================================================

interface AccountsStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function AccountsStep({ data, onUpdate }: AccountsStepProps) {
  const availableLoans = getLoansFromProperties(data.properties);

  const addAccount = (type: AccountType = 'TRANSACTIONAL') => {
    onUpdate({ accounts: [...data.accounts, createEmptyAccount(type)] });
  };

  const updateAccount = (accountId: string, updates: Partial<AccountInput>) => {
    onUpdate({
      accounts: data.accounts.map((a) => (a.id === accountId ? { ...a, ...updates } : a)),
    });
  };

  const removeAccount = (accountId: string) => {
    onUpdate({ accounts: data.accounts.filter((a) => a.id !== accountId) });
  };

  // Summary
  const cashAssets = data.accounts
    .filter((a) => a.type !== 'CREDIT_CARD')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const creditDebt = data.accounts
    .filter((a) => a.type === 'CREDIT_CARD')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const net = cashAssets - creditDebt;

  return (
    <WizardStepShell
      icon={<Landmark className="h-8 w-8" strokeWidth={1.5} />}
      title="Bank accounts"
      subtitle="Add your cash, savings, and credit accounts to track your liquid balance."
    >
      {data.accounts.length === 0 && (
        <WizardSection
          title="Quick add"
          description="Start with the account type you use most."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ACCOUNT_TYPES.map((type) => (
              <QuickAddTile key={type.value} meta={type} onClick={() => addAccount(type.value)} />
            ))}
          </div>
        </WizardSection>
      )}

      {data.accounts.length > 0 && (
        <div className="space-y-3">
          {data.accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              availableLoans={availableLoans}
              onUpdate={(updates) => updateAccount(account.id, updates)}
              onRemove={() => removeAccount(account.id)}
            />
          ))}
        </div>
      )}

      {data.accounts.length > 0 && (
        <WizardAddButton
          leadingIcon={<Plus className="h-4 w-4" />}
          onClick={() => addAccount()}
        >
          Add another account
        </WizardAddButton>
      )}

      {data.accounts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryTile
            label="Cash"
            value={formatCurrency(cashAssets, { abbreviate: true })}
            accent="emerald"
          />
          <SummaryTile
            label="Credit debt"
            value={formatCurrency(creditDebt, { abbreviate: true })}
            accent="amber"
          />
          <SummaryTile
            label="Net"
            value={formatCurrency(net, { abbreviate: true })}
            accent={net >= 0 ? 'blue' : 'rose'}
          />
        </div>
      )}

      {data.accounts.length === 0 && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          We recommend adding at least one account for accurate cashflow tracking.
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
  accent: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose';
}) {
  const accentClass = {
    blue: 'text-blue-600 dark:text-blue-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    violet: 'text-violet-600 dark:text-violet-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
  }[accent];
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/40 p-3 text-center">
      <div className={`text-xl font-semibold tabular-nums ${accentClass}`}>{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

export default AccountsStep;
