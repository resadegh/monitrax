'use client';

/**
 * SuperStep — Phase 12 PR 3b + Track F.6 two-way sync
 *
 * Dedicated step for superannuation accounts.
 *
 * ============================================================================
 * TRACK F.6 — onboarding ⇄ real-table two-way sync (2026-05-20)
 * ============================================================================
 * Before F.6 this step staged super accounts into the `WizardData` draft
 * blob, written once at `/api/onboarding/bulk-create`. F.6 makes the step
 * read + write the real `SuperannuationAccount` table directly via the
 * super API (`/api/tax/super` + the new `/api/tax/super/[id]`):
 *   - ON OPEN  — `readSuper()` loads the real table; the step merges it
 *     with any unsynced in-session account.
 *   - ON CONTINUE / BACK — the registered `commit` diffs + `syncSuper()`
 *     writes the delta (create / update / hard-delete), idempotent on
 *     re-entry.
 *
 * See `lib/onboarding/superSync.ts` and
 * `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §6.6.
 *
 * Captures the **minimum viable** fields per the plan doc §3 row A
 * decision:
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

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { WizardData, SuperAccountInput, generateId, type StepCommitFn } from '../types';
import {
  WizardStepShell,
  WizardField,
  WizardCurrencyField,
  WizardAddButton,
} from '../primitives';
import { formatCurrency } from '@/lib/utils/formatters';
import { useAuth } from '@/lib/context/AuthContext';
import {
  readSuper,
  syncSuper,
  snapshotToWizardSuper,
  wizardSuperToSnapshot,
  isPersistedId,
  EMPTY_SUPER_SNAPSHOT,
  type SuperSnapshot,
} from '@/lib/onboarding/superSync';
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
  /**
   * Phase 12 Track F.6: register an async commit with the container. The
   * container awaits it before advancing — it writes the super accounts to
   * the real `SuperannuationAccount` table. Optional so the step still
   * renders in non-wizard contexts.
   */
  registerStepCommit?: (fn: StepCommitFn | null) => void;
}

export function SuperStep({ data, onUpdate, registerStepCommit }: SuperStepProps) {
  const { token } = useAuth();

  // ---- Phase 12 Track F.6: real-table sync state ---------------------
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const snapshotRef = useRef<SuperSnapshot>(EMPTY_SUPER_SNAPSHOT);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // ---- READ the real `SuperannuationAccount` table on step open ------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    readSuper(token)
      .then((snapshot) => {
        if (cancelled) return;
        snapshotRef.current = snapshot;
        const realAccounts = snapshotToWizardSuper(snapshot);
        const unsynced = dataRef.current.superAccounts.filter((s) => !isPersistedId(s.id));
        onUpdate({ superAccounts: [...realAccounts, ...unsynced] });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Could not load your super. You can still edit — we’ll save when you continue.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- COMMIT: register the real-table write with the container ------
  useEffect(() => {
    if (!registerStepCommit) return;
    const commit: StepCommitFn = async () => {
      if (loading) {
        throw new Error('Still loading your super — please wait a moment.');
      }
      const current = wizardSuperToSnapshot(dataRef.current.superAccounts);
      const result = await syncSuper(token, snapshotRef.current, current);
      snapshotRef.current = result.snapshot;
      // Re-seed from the real table, keeping any in-session card still
      // incomplete (no real id, no fund name, 0 balance) so a half-filled
      // card the user is working on isn't discarded on a Back navigation.
      const stillUnsynced = dataRef.current.superAccounts.filter(
        (s) => !isPersistedId(s.id) && !s.fundName.trim() && !(s.currentBalance > 0),
      );
      onUpdate({
        superAccounts: [...snapshotToWizardSuper(result.snapshot), ...stillUnsynced],
      });
    };
    registerStepCommit(commit);
    return () => registerStepCommit(null);
  }, [registerStepCommit, token, loading, onUpdate]);

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
      subtitle="Your retirement future. Super is a key part of the Invest stage on your TRAIL."
    >
      {/* Real-table sync status — loading while reading, error on failure.
          Both are non-blocking (Phase 12 Track F.6). */}
      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading your super…
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

      {/* Phase 39.5: route SMSF to its proper home (the entity layer). This is
          for retail/industry super; an SMSF is captured as a structure in the
          earlier "Your structure" step and owns its own investments. */}
      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        Have a self-managed fund (SMSF)? Add it as a structure in{' '}
        <span className="font-medium">Your structure</span> — its investments and property are tracked there.
      </p>
    </WizardStepShell>
  );
}

export default SuperStep;
