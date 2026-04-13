'use client';

/**
 * SuperStep — Phase 12 PR 3b
 *
 * Dedicated step for superannuation accounts. Captures the **minimum
 * viable** fields per the plan doc §3 row A decision:
 *
 *   - `name` — what the user calls the account ("My Super")
 *   - `fundName` — free-text fund name ("AustralianSuper")
 *   - `currentBalance` — so net worth works
 *
 * Everything else (`memberNumber`, `fundABN`, tax components,
 * contribution YTD, caps, investment option, returns) is deferred to a
 * future Settings > Retirement page. Users don't typically have a super
 * statement handy during onboarding — blocking them on those fields
 * would hurt completion.
 *
 * bulk-create writes real `SuperannuationAccount` rows here, not
 * `InvestmentAccount(type=SUPERS)`. This replaces the PR 3a behaviour
 * where super was mis-routed through the Investments step.
 *
 * Docs: docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md §3 row A
 */

import React from 'react';
import { Shield, Plus, Trash2 } from 'lucide-react';
import { WizardData, SuperAccountInput, generateId } from '../types';
import {
  WizardStepShell,
  WizardField,
  WizardCurrencyField,
  WizardAddButton,
} from '../primitives';
import { formatCurrency } from '@/lib/utils/formatters';
import '@/styles/wizard-animations.css';

// =============================================================================
// FACTORIES
// =============================================================================

function createEmptySuperAccount(): SuperAccountInput {
  return {
    id: generateId(),
    name: 'My Super',
    fundName: '',
    currentBalance: 0,
  };
}

// =============================================================================
// SUPER ACCOUNT CARD
// =============================================================================

interface SuperCardProps {
  account: SuperAccountInput;
  onUpdate: (updates: Partial<SuperAccountInput>) => void;
  onRemove: () => void;
}

function SuperCard({ account, onUpdate, onRemove }: SuperCardProps) {
  return (
    <div className="wz-section">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {account.name}
            </h4>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {account.fundName || 'Superannuation fund'}
              {account.currentBalance > 0 &&
                ` · ${formatCurrency(account.currentBalance, { abbreviate: true })}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove super account"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <WizardField
          label="Account name"
          placeholder="My Super"
          value={account.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          required
        />
        <WizardField
          label="Fund name"
          placeholder="e.g. AustralianSuper, HESTA, Rest"
          value={account.fundName}
          onChange={(e) => onUpdate({ fundName: e.target.value })}
          required
        />
        <WizardCurrencyField
          className="sm:col-span-2"
          label="Current balance"
          required
          value={account.currentBalance}
          onChange={(v) => onUpdate({ currentBalance: v })}
          helper="Look at your latest super statement or login to your fund's app"
        />
      </div>
    </div>
  );
}

// =============================================================================
// SUPER STEP
// =============================================================================

interface SuperStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function SuperStep({ data, onUpdate }: SuperStepProps) {
  const addSuper = () => {
    onUpdate({ superAccounts: [...data.superAccounts, createEmptySuperAccount()] });
  };

  const updateSuper = (id: string, updates: Partial<SuperAccountInput>) => {
    onUpdate({
      superAccounts: data.superAccounts.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    });
  };

  const removeSuper = (id: string) => {
    onUpdate({ superAccounts: data.superAccounts.filter((s) => s.id !== id) });
  };

  const totalSuper = data.superAccounts.reduce((sum, s) => sum + s.currentBalance, 0);

  return (
    <WizardStepShell
      icon={<Shield className="h-8 w-8" strokeWidth={1.5} />}
      title="Superannuation"
      subtitle="Your retirement savings. We'll add more detailed tracking (contributions, tax, investment options) later from Settings."
    >
      {data.superAccounts.length > 0 && (
        <div className="space-y-3">
          {data.superAccounts.map((account) => (
            <SuperCard
              key={account.id}
              account={account}
              onUpdate={(updates) => updateSuper(account.id, updates)}
              onRemove={() => removeSuper(account.id)}
            />
          ))}
        </div>
      )}

      <WizardAddButton leadingIcon={<Plus className="h-4 w-4" />} onClick={addSuper}>
        {data.superAccounts.length === 0
          ? 'Add your super account'
          : 'Add another super account'}
      </WizardAddButton>

      {data.superAccounts.length > 0 && (
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total super balance
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Adds directly to your net worth
              </div>
            </div>
            <span className="text-2xl font-semibold tabular-nums text-violet-600 dark:text-violet-400">
              {formatCurrency(totalSuper, { abbreviate: true })}
            </span>
          </div>
        </div>
      )}

      {data.superAccounts.length === 0 && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          No super to add? Click <span className="font-medium">Continue</span> to skip.
        </p>
      )}
    </WizardStepShell>
  );
}

export default SuperStep;
