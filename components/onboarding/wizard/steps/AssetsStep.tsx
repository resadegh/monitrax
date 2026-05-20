'use client';

/**
 * AssetsStep — Phase 12 PR 3a redesign + Track F.7 two-way sync
 *
 * Captures personal assets (vehicles, electronics, equipment, furniture,
 * collectibles) with their purchase details and optional ongoing
 * expenses.
 *
 * ============================================================================
 * TRACK F.7 — onboarding ⇄ real-table two-way sync (2026-05-20)
 * ============================================================================
 * Before F.7 this step staged the asset aggregate into the `WizardData`
 * draft blob, written once at `/api/onboarding/bulk-create`. F.7 makes the
 * step read + write the real `Asset` + `Expense` tables directly (the asset
 * aggregate, mirroring the F.2 property aggregate):
 *   - ON OPEN  — `readAssets()` loads the real tables; the step merges them
 *     with any unsynced in-session asset.
 *   - ON CONTINUE / BACK — the registered `commit` diffs + `syncAssets()`
 *     writes the delta (create / update / hard-delete), idempotent on
 *     re-entry.
 *
 * See `lib/onboarding/assetsSync.ts` and
 * `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §6.7.
 *
 * Simplification:
 *   - Vehicle-specific fields (make/model/year) appear inline only for
 *     type=VEHICLE. For other types the card is a tighter 2-column form.
 *   - Purchase date is now explicit (PR 1 fix) — helper text makes clear
 *     "approximate is fine".
 *   - Asset expenses reuse the same 12-col inline grid pattern as the
 *     Properties step for consistency.
 *
 * No data model changes.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Car,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Laptop,
  Watch,
  Sofa,
  Palette,
  Package,
  Receipt,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  WizardData,
  AssetInput,
  AssetExpenseInput,
  AssetType,
  ExpenseCategory,
  generateId,
  type StepCommitFn,
} from '../types';
import { useAuth } from '@/lib/context/AuthContext';
import {
  readAssets,
  syncAssets,
  snapshotToWizardAssets,
  wizardAssetsToSnapshot,
  isPersistedId,
  EMPTY_ASSETS_SNAPSHOT,
  type AssetsSnapshot,
} from '@/lib/onboarding/assetsSync';
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
// ASSET TYPE META
// =============================================================================

interface AssetTypeMeta {
  value: AssetType;
  label: string;
  icon: React.ReactNode;
  accent: string;
}

const ASSET_TYPES: AssetTypeMeta[] = [
  {
    value: 'VEHICLE',
    label: 'Vehicle',
    icon: <Car className="h-5 w-5" />,
    accent: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  },
  {
    value: 'ELECTRONICS',
    label: 'Electronics',
    icon: <Laptop className="h-5 w-5" />,
    accent: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
  },
  {
    value: 'EQUIPMENT',
    label: 'Equipment',
    icon: <Watch className="h-5 w-5" />,
    accent: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  },
  {
    value: 'FURNITURE',
    label: 'Furniture',
    icon: <Sofa className="h-5 w-5" />,
    accent: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
  {
    value: 'COLLECTIBLE',
    label: 'Collectibles',
    icon: <Palette className="h-5 w-5" />,
    accent: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400',
  },
  {
    value: 'OTHER',
    label: 'Other',
    icon: <Package className="h-5 w-5" />,
    accent: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
];

const ASSET_TYPE_OPTIONS = ASSET_TYPES.map((t) => ({ value: t.value, label: t.label }));

const ASSET_EXPENSE_CATEGORIES: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'REGISTRATION', label: 'Registration' },
  { value: 'MAINTENANCE', label: 'Maintenance / servicing' },
  { value: 'LOAN_INTEREST', label: 'Loan interest' },
  { value: 'MODIFICATIONS', label: 'Modifications' },
  { value: 'OTHER', label: 'Other' },
];

const EXPENSE_FREQ_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
];

// =============================================================================
// FACTORIES
// =============================================================================

function createEmptyAsset(type: AssetType = 'VEHICLE'): AssetInput {
  return {
    id: generateId(),
    name: '',
    type,
    purchasePrice: 0,
    currentValue: 0,
    purchaseDate: '',
    expenses: [],
    ...(type === 'VEHICLE' && {
      vehicleMake: '',
      vehicleModel: '',
      vehicleYear: new Date().getFullYear(),
    }),
  };
}

function createEmptyExpense(): AssetExpenseInput {
  return {
    id: generateId(),
    name: '',
    category: 'INSURANCE',
    amount: 0,
    frequency: 'ANNUAL',
  };
}

// =============================================================================
// ASSET CARD
// =============================================================================

interface AssetCardProps {
  asset: AssetInput;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<AssetInput>) => void;
  onRemove: () => void;
}

function AssetCard({
  asset,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}: AssetCardProps) {
  const meta = ASSET_TYPES.find((t) => t.value === asset.type) ?? ASSET_TYPES[0];
  const isVehicle = asset.type === 'VEHICLE';

  const displayName =
    asset.name ||
    (isVehicle && asset.vehicleMake
      ? `${asset.vehicleYear || ''} ${asset.vehicleMake} ${asset.vehicleModel || ''}`.trim()
      : meta.label);

  const addExpense = () =>
    onUpdate({ expenses: [...asset.expenses, createEmptyExpense()] });

  const updateExpense = (expenseId: string, updates: Partial<AssetExpenseInput>) =>
    onUpdate({
      expenses: asset.expenses.map((exp) =>
        exp.id === expenseId ? { ...exp, ...updates } : exp
      ),
    });

  const removeExpense = (expenseId: string) =>
    onUpdate({ expenses: asset.expenses.filter((exp) => exp.id !== expenseId) });

  // Depreciation preview
  const depreciation = asset.purchasePrice - asset.currentValue;
  const depreciationPct =
    asset.purchasePrice > 0 ? (depreciation / asset.purchasePrice) * 100 : 0;
  const showDepreciation = asset.purchasePrice > 0 && asset.currentValue > 0;

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
              {displayName}
            </h4>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {meta.label}
              {asset.currentValue > 0 && ` · ${formatCurrency(asset.currentValue, { abbreviate: true })}`}
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
            aria-label="Remove asset"
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <WizardSelectField
              label="Type"
              required
              value={asset.type}
              onChange={(v) => {
                const newType = v as AssetType;
                onUpdate({
                  type: newType,
                  // Clear vehicle fields when switching away
                  ...(newType !== 'VEHICLE' && {
                    vehicleMake: undefined,
                    vehicleModel: undefined,
                    vehicleYear: undefined,
                  }),
                  // Seed them when switching in
                  ...(newType === 'VEHICLE' &&
                    !asset.vehicleMake && {
                      vehicleMake: '',
                      vehicleModel: '',
                      vehicleYear: new Date().getFullYear(),
                    }),
                });
              }}
              options={ASSET_TYPE_OPTIONS}
            />
            <WizardField
              label={isVehicle ? 'Nickname (optional)' : 'Name'}
              placeholder={isVehicle ? 'e.g. "My daily"' : 'e.g. MacBook Pro'}
              value={asset.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              required={!isVehicle}
            />
          </div>

          {isVehicle && (
            <div className="rounded-xl bg-blue-50/60 dark:bg-blue-900/10 p-4">
              <p className="mb-3 text-xs font-medium text-blue-700 dark:text-blue-300">
                Vehicle details
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <WizardField
                  label="Make"
                  placeholder="e.g. Toyota"
                  value={asset.vehicleMake || ''}
                  onChange={(e) => onUpdate({ vehicleMake: e.target.value })}
                />
                <WizardField
                  label="Model"
                  placeholder="e.g. RAV4"
                  value={asset.vehicleModel || ''}
                  onChange={(e) => onUpdate({ vehicleModel: e.target.value })}
                />
                <WizardField
                  label="Year"
                  type="number"
                  placeholder="2020"
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  value={asset.vehicleYear || ''}
                  onChange={(e) =>
                    onUpdate({ vehicleYear: parseInt(e.target.value, 10) || undefined })
                  }
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <WizardCurrencyField
              label="Purchase price"
              required
              value={asset.purchasePrice}
              onChange={(v) => onUpdate({ purchasePrice: v })}
              helper="What you paid originally"
            />
            <WizardCurrencyField
              label="Current value"
              required
              value={asset.currentValue}
              onChange={(v) => onUpdate({ currentValue: v })}
              helper="Rough market value today"
            />
            <WizardField
              className="sm:col-span-2"
              label="Purchase date"
              required
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={asset.purchaseDate || ''}
              onChange={(e) => onUpdate({ purchaseDate: e.target.value })}
              helper="Approximate month / year is fine — used for depreciation history"
            />
          </div>

          {showDepreciation && (
            <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-800/30 px-4 py-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Depreciation so far
                </div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(depreciation)}
                </div>
              </div>
              <div
                className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                  depreciationPct > 0
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                }`}
              >
                {depreciationPct > 0 ? '−' : '+'}
                {Math.abs(depreciationPct).toFixed(1)}%
              </div>
            </div>
          )}

          {/* Running costs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Receipt className="h-4 w-4 text-slate-500" />
                Running costs
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
            {asset.expenses.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                {isVehicle
                  ? 'Add registration, insurance, servicing…'
                  : 'Add any ongoing costs (insurance, maintenance).'}
              </p>
            ) : (
              <div className="space-y-2">
                {asset.expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="grid grid-cols-12 gap-2 rounded-lg bg-amber-50/60 dark:bg-amber-900/10 p-3"
                  >
                    <select
                      value={exp.category}
                      onChange={(e) =>
                        updateExpense(exp.id, {
                          category: e.target.value as ExpenseCategory,
                          name:
                            ASSET_EXPENSE_CATEGORIES.find((c) => c.value === e.target.value)
                              ?.label || exp.name,
                        })
                      }
                      className="wz-input col-span-5 sm:col-span-4"
                    >
                      {ASSET_EXPENSE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <div className="wz-input-currency-wrap col-span-4 sm:col-span-3">
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
                    <select
                      value={exp.frequency}
                      onChange={(e) =>
                        updateExpense(exp.id, {
                          frequency: e.target.value as AssetExpenseInput['frequency'],
                        })
                      }
                      className="wz-input col-span-3 sm:col-span-4"
                    >
                      {EXPENSE_FREQ_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
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
// ASSETS STEP
// =============================================================================

interface AssetsStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  /**
   * Phase 12 Track F.7: register an async commit with the container. The
   * container awaits it before advancing — it writes the asset aggregate
   * (`Asset` + its `Expense`s) to the real tables. Optional so the step
   * still renders in non-wizard contexts.
   */
  registerStepCommit?: (fn: StepCommitFn | null) => void;
}

export function AssetsStep({ data, onUpdate, registerStepCommit }: AssetsStepProps) {
  const { token } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(
    data.assets.length > 0 ? data.assets[0].id : null
  );

  // ---- Phase 12 Track F.7: real-table sync state ---------------------
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const snapshotRef = useRef<AssetsSnapshot>(EMPTY_ASSETS_SNAPSHOT);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // ---- READ the real `Asset` tables on step open ---------------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    readAssets(token)
      .then((snapshot) => {
        if (cancelled) return;
        snapshotRef.current = snapshot;
        const realAssets = snapshotToWizardAssets(snapshot);
        const unsynced = dataRef.current.assets.filter((a) => !isPersistedId(a.id));
        onUpdate({ assets: [...realAssets, ...unsynced] });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Could not load your assets. You can still edit — we’ll save when you continue.',
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
        throw new Error('Still loading your assets — please wait a moment.');
      }
      const current = wizardAssetsToSnapshot(dataRef.current.assets);
      const result = await syncAssets(token, snapshotRef.current, current);
      snapshotRef.current = result.snapshot;
      // Re-seed from the real tables, keeping any in-session asset still
      // incomplete (no real id, no purchase date) so a half-filled card
      // the user is working on isn't discarded on a Back navigation.
      const stillUnsynced = dataRef.current.assets.filter(
        (a) => !isPersistedId(a.id) && !a.purchaseDate?.trim(),
      );
      onUpdate({
        assets: [...snapshotToWizardAssets(result.snapshot), ...stillUnsynced],
      });
    };
    registerStepCommit(commit);
    return () => registerStepCommit(null);
  }, [registerStepCommit, token, loading, onUpdate]);

  const addAsset = () => {
    const newAsset = createEmptyAsset();
    onUpdate({ assets: [...data.assets, newAsset] });
    setExpandedId(newAsset.id);
  };

  const updateAsset = (id: string, updates: Partial<AssetInput>) => {
    onUpdate({
      assets: data.assets.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    });
  };

  const removeAsset = (id: string) => {
    onUpdate({ assets: data.assets.filter((a) => a.id !== id) });
    if (expandedId === id) {
      const remaining = data.assets.filter((a) => a.id !== id);
      setExpandedId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const totalValue = data.assets.reduce((sum, a) => sum + a.currentValue, 0);

  return (
    <WizardStepShell
      icon={<Car className="h-8 w-8" strokeWidth={1.5} />}
      title="Personal assets"
      subtitle="What you own. Every asset contributes to your net worth and your TRAIL progress."
    >
      {/* Real-table sync status — loading while reading, error on failure.
          Both are non-blocking (Phase 12 Track F.7). */}
      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading your assets…
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

      {data.assets.length > 0 && (
        <div className="space-y-3">
          {data.assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              isExpanded={expandedId === asset.id}
              onToggleExpand={() => setExpandedId(expandedId === asset.id ? null : asset.id)}
              onUpdate={(updates) => updateAsset(asset.id, updates)}
              onRemove={() => removeAsset(asset.id)}
            />
          ))}
        </div>
      )}

      <WizardAddButton leadingIcon={<Plus className="h-4 w-4" />} onClick={addAsset}>
        {data.assets.length === 0 ? 'Add your first asset' : 'Add another asset'}
      </WizardAddButton>

      {data.assets.length > 0 && (
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total asset value
            </span>
            <span className="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatCurrency(totalValue, { abbreviate: true })}
            </span>
          </div>
        </div>
      )}

      {data.assets.length === 0 && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          No assets to track? Click <span className="font-medium">Continue</span> to skip.
        </p>
      )}
    </WizardStepShell>
  );
}

export default AssetsStep;
