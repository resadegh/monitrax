'use client';

/**
 * InvestmentsStep — Phase 12 PR 3a redesign + Track F.5 two-way sync
 *
 * Captures investment accounts (brokerage, super, fund, trust, ETF/crypto)
 * and their holdings.
 *
 * ============================================================================
 * TRACK F.5 — onboarding ⇄ real-table two-way sync (2026-05-20)
 * ============================================================================
 * Before F.5 this step staged investment accounts + holdings into the
 * `WizardData` draft blob, written once at `/api/onboarding/bulk-create`.
 * F.5 makes the step read + write the real `InvestmentAccount` /
 * `InvestmentHolding` tables directly — the account aggregate, mirroring
 * the F.2 property aggregate:
 *   - ON OPEN  — `readInvestments()` loads the real tables; the step
 *     merges them with any unsynced in-session account.
 *   - ON CONTINUE / BACK — the registered `commit` diffs + `syncInvestments()`
 *     writes the delta (create / update / hard-delete), idempotent on
 *     re-entry.
 *
 * See `lib/onboarding/investmentsSync.ts` and
 * `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §6.5.
 *
 * Original PR 3a simplification notes:
 *   - Each account card is expandable — collapsed shows just the name
 *     and the value summary; expanded shows the holdings table
 *   - Holdings inline table with ticker / units / avg price
 *   - Live value preview at the card header level
 *
 * No data model changes. PR 3b will route SUPERS type to a dedicated
 * SuperannuationAccount step.
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  WizardData,
  InvestmentAccountInput,
  HoldingInput,
  InvestmentAccountType,
  generateId,
  type StepCommitFn,
} from '../types';
import {
  WizardStepShell,
  WizardField,
  WizardCurrencyField,
  WizardSelectField,
  WizardAddButton,
} from '../primitives';
import { formatCurrency } from '@/lib/utils/formatters';
import { useAuth } from '@/lib/context/AuthContext';
import {
  readInvestments,
  syncInvestments,
  snapshotToWizardInvestments,
  wizardInvestmentsToSnapshot,
  isPersistedId,
  EMPTY_INVESTMENTS_SNAPSHOT,
  type InvestmentsSnapshot,
} from '@/lib/onboarding/investmentsSync';
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
  // Phase 39.5: 'SUPERS' removed from the picker. Retail/industry super is
  // captured in SuperStep (→ SuperannuationAccount); an SMSF is a LegalEntity
  // (My Structure) that owns ordinary investment accounts (brokerage/fund/…).
  // The enum value remains in the Prisma schema for back-compat; any legacy
  // InvestmentAccount(type=SUPERS) row falls back gracefully via the typeMeta
  // lookup (?? INVESTMENT_TYPES[0]).
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
  /**
   * Phase 12 Track F.5: register an async commit with the container. The
   * container awaits it before advancing — it writes the investment
   * accounts + holdings to their real tables. Optional so the step still
   * renders in non-wizard contexts.
   */
  registerStepCommit?: (fn: StepCommitFn | null) => void;
}

export function InvestmentsStep({ data, onUpdate, registerStepCommit }: InvestmentsStepProps) {
  const { token } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(
    data.investments.length > 0 ? data.investments[0].id : null
  );

  // ---- Phase 12 Track F.5: real-table sync state ---------------------
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const snapshotRef = useRef<InvestmentsSnapshot>(EMPTY_INVESTMENTS_SNAPSHOT);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // ---- READ the real tables on step open -----------------------------
  // Merges the real investment accounts (authoritative — real ids) with
  // any unsynced (synthetic-id) in-session / chat-staged account.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    readInvestments(token)
      .then((snapshot) => {
        if (cancelled) return;
        snapshotRef.current = snapshot;
        const realInvestments = snapshotToWizardInvestments(snapshot);
        const unsynced = dataRef.current.investments.filter((a) => !isPersistedId(a.id));
        onUpdate({ investments: [...realInvestments, ...unsynced] });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Could not load your investments. You can still edit — we’ll save when you continue.',
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

  // ---- COMMIT: register the real-table write with the container -------
  useEffect(() => {
    if (!registerStepCommit) return;
    const commit: StepCommitFn = async () => {
      if (loading) {
        throw new Error('Still loading your investments — please wait a moment.');
      }
      const current = wizardInvestmentsToSnapshot(dataRef.current.investments);
      const result = await syncInvestments(token, snapshotRef.current, current);
      snapshotRef.current = result.snapshot;
      // Re-seed from the real tables, keeping any in-session account still
      // incomplete (no real id, no name) so a half-filled card the user is
      // working on isn't discarded on a Back navigation.
      const stillUnsynced = dataRef.current.investments.filter(
        (a) => !isPersistedId(a.id) && !a.name.trim(),
      );
      onUpdate({
        investments: [...snapshotToWizardInvestments(result.snapshot), ...stillUnsynced],
      });
    };
    registerStepCommit(commit);
    return () => registerStepCommit(null);
  }, [registerStepCommit, token, loading, onUpdate]);

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
      {/* Real-table sync status — loading while reading, error on failure.
          Both are non-blocking (Phase 12 Track F.5). */}
      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading your investments…
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
