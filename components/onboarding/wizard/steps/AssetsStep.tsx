'use client';

import React, { useState } from 'react';
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
  Calendar,
} from 'lucide-react';
import {
  WizardData,
  AssetInput,
  AssetExpenseInput,
  AssetType,
  generateId,
} from '../types';
import { formatCurrency } from '@/lib/utils/formatters';
import '@/styles/wizard-animations.css';

// =============================================================================
// CONSTANTS
// =============================================================================

const ASSET_TYPES: {
  value: AssetType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    value: 'VEHICLE',
    label: 'Vehicle',
    description: 'Car, motorcycle, boat',
    icon: <Car className="h-5 w-5" />,
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'ELECTRONICS',
    label: 'Electronics',
    description: 'Computers, phones, TV',
    icon: <Laptop className="h-5 w-5" />,
    color: 'text-purple-600 dark:text-purple-400',
  },
  {
    value: 'EQUIPMENT',
    label: 'Equipment',
    description: 'Tools, machinery, gear',
    icon: <Watch className="h-5 w-5" />,
    color: 'text-amber-600 dark:text-amber-400',
  },
  {
    value: 'FURNITURE',
    label: 'Furniture',
    description: 'Home furniture',
    icon: <Sofa className="h-5 w-5" />,
    color: 'text-green-600 dark:text-green-400',
  },
  {
    value: 'COLLECTIBLE',
    label: 'Collectibles',
    description: 'Art, antiques, jewelry, collections',
    icon: <Palette className="h-5 w-5" />,
    color: 'text-pink-600 dark:text-pink-400',
  },
  {
    value: 'OTHER',
    label: 'Other',
    description: 'Other valuable assets',
    icon: <Package className="h-5 w-5" />,
    color: 'text-gray-600 dark:text-gray-400',
  },
];

const VEHICLE_EXPENSE_TYPES = [
  'Registration',
  'Insurance',
  'Servicing',
  'Fuel',
  'Loan Repayment',
  'Other',
];

const FREQUENCIES = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
] as const;

// =============================================================================
// HELPER FUNCTIONS
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
    category: 'OTHER',
    amount: 0,
    frequency: 'ANNUAL',
  };
}

// =============================================================================
// ASSET CARD COMPONENT
// =============================================================================

interface AssetCardProps {
  asset: AssetInput;
  index: number;
  onUpdate: (updates: Partial<AssetInput>) => void;
  onRemove: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function AssetCard({
  asset,
  index,
  onUpdate,
  onRemove,
  isExpanded,
  onToggleExpand,
}: AssetCardProps) {
  const assetType = ASSET_TYPES.find((t) => t.value === asset.type);
  const isVehicle = asset.type === 'VEHICLE';

  const addExpense = () => {
    onUpdate({
      expenses: [...asset.expenses, createEmptyExpense()],
    });
  };

  const updateExpense = (expenseId: string, updates: Partial<AssetExpenseInput>) => {
    onUpdate({
      expenses: asset.expenses.map((exp) =>
        exp.id === expenseId ? { ...exp, ...updates } : exp
      ),
    });
  };

  const removeExpense = (expenseId: string) => {
    onUpdate({
      expenses: asset.expenses.filter((exp) => exp.id !== expenseId),
    });
  };

  const getGradientClass = () => {
    switch (asset.type) {
      case 'VEHICLE':
        return 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20';
      case 'ELECTRONICS':
        return 'bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20';
      case 'EQUIPMENT':
        return 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20';
      case 'COLLECTIBLE':
        return 'bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20';
      default:
        return 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20';
    }
  };

  const getBgClass = () => {
    switch (asset.type) {
      case 'VEHICLE':
        return 'bg-blue-100 dark:bg-blue-800/40';
      case 'ELECTRONICS':
        return 'bg-purple-100 dark:bg-purple-800/40';
      case 'EQUIPMENT':
        return 'bg-amber-100 dark:bg-amber-800/40';
      case 'COLLECTIBLE':
        return 'bg-pink-100 dark:bg-pink-800/40';
      default:
        return 'bg-gray-100 dark:bg-gray-800/40';
    }
  };

  return (
    <div
      className="profile-card border rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden"
      style={{ '--card-index': index } as React.CSSProperties}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 cursor-pointer ${getGradientClass()}`}
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${getBgClass()}`}>
            <span className={assetType?.color}>{assetType?.icon}</span>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              {asset.name ||
                (isVehicle && asset.vehicleMake
                  ? `${asset.vehicleYear} ${asset.vehicleMake} ${asset.vehicleModel}`
                  : `${assetType?.label}`)}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatCurrency(asset.currentValue)}
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
          {/* Basic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Asset Type
              </label>
              <select
                value={asset.type}
                onChange={(e) => {
                  const newType = e.target.value as AssetType;
                  onUpdate({
                    type: newType,
                    vehicleMake: newType === 'VEHICLE' ? '' : undefined,
                    vehicleModel: newType === 'VEHICLE' ? '' : undefined,
                    vehicleYear: newType === 'VEHICLE' ? new Date().getFullYear() : undefined,
                  });
                }}
                className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ASSET_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {isVehicle ? 'Nickname (Optional)' : 'Name'}
              </label>
              <input
                type="text"
                value={asset.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder={isVehicle ? 'e.g., Family Car' : 'e.g., Engagement Ring'}
                className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Vehicle-specific fields */}
          {isVehicle && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={asset.vehicleYear || ''}
                  onChange={(e) => onUpdate({ vehicleYear: parseInt(e.target.value) || 0 })}
                  placeholder="2024"
                  className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Make
                </label>
                <input
                  type="text"
                  value={asset.vehicleMake || ''}
                  onChange={(e) => onUpdate({ vehicleMake: e.target.value })}
                  placeholder="Toyota"
                  className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={asset.vehicleModel || ''}
                  onChange={(e) => onUpdate({ vehicleModel: e.target.value })}
                  placeholder="Camry"
                  className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Value Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Purchase Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400">$</span>
                <input
                  type="number"
                  value={asset.purchasePrice || ''}
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
                  value={asset.currentValue || ''}
                  onChange={(e) => onUpdate({ currentValue: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  className="wizard-input w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                value={asset.purchaseDate || ''}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => onUpdate({ purchaseDate: e.target.value })}
                className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Approximate is fine — used for depreciation history.
              </p>
            </div>
          </div>

          {/* Expenses Section */}
          <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Running Costs
              </h5>
              <button
                onClick={addExpense}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Expense
              </button>
            </div>

            {asset.expenses.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                {isVehicle
                  ? 'Add running costs like registration, insurance, and servicing.'
                  : 'Add any ongoing costs for this asset.'}
              </div>
            ) : (
              <div className="space-y-2">
                {asset.expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex gap-2 items-center bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg"
                  >
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                      {isVehicle ? (
                        <select
                          value={expense.name}
                          onChange={(e) =>
                            updateExpense(expense.id, { name: e.target.value })
                          }
                          className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select type</option>
                          {VEHICLE_EXPENSE_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={expense.name}
                          onChange={(e) =>
                            updateExpense(expense.id, { name: e.target.value })
                          }
                          placeholder="Expense name"
                          className="wizard-input w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-400">$</span>
                        <input
                          type="number"
                          value={expense.amount || ''}
                          onChange={(e) =>
                            updateExpense(expense.id, {
                              amount: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="Amount"
                          className="wizard-input w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <select
                        value={expense.frequency}
                        onChange={(e) =>
                          updateExpense(expense.id, {
                            frequency: e.target.value as AssetExpenseInput['frequency'],
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
// ASSETS STEP COMPONENT
// =============================================================================

interface AssetsStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function AssetsStep({ data, onUpdate }: AssetsStepProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    data.assets.length > 0 ? data.assets[0].id : null
  );

  const addAsset = (type: AssetType = 'VEHICLE') => {
    const newAsset = createEmptyAsset(type);
    onUpdate({
      assets: [...data.assets, newAsset],
    });
    setExpandedId(newAsset.id);
  };

  const updateAsset = (assetId: string, updates: Partial<AssetInput>) => {
    onUpdate({
      assets: data.assets.map((a) =>
        a.id === assetId ? { ...a, ...updates } : a
      ),
    });
  };

  const removeAsset = (assetId: string) => {
    onUpdate({
      assets: data.assets.filter((a) => a.id !== assetId),
    });
    if (expandedId === assetId) {
      setExpandedId(data.assets.length > 1 ? data.assets[0].id : null);
    }
  };

  // Calculate totals
  const totalValue = data.assets.reduce((sum, a) => sum + a.currentValue, 0);

  return (
    <div className="space-y-6 wizard-step-enter">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white text-2xl mb-2">
          <Car className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Personal Assets
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-sm">
          Add valuable personal assets like vehicles, electronics, or collectibles. Track their
          value and running costs.
        </p>
      </div>

      {/* Quick Add Buttons */}
      {data.assets.length === 0 && (
        <div className="wizard-card" style={{ '--card-index': 0 } as React.CSSProperties}>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
            Select asset type to get started:
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {ASSET_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => addAsset(type.value)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all"
              >
                <div
                  className={`p-2 rounded-lg ${
                    type.value === 'VEHICLE'
                      ? 'bg-blue-100 dark:bg-blue-800/40'
                      : type.value === 'ELECTRONICS'
                      ? 'bg-purple-100 dark:bg-purple-800/40'
                      : type.value === 'EQUIPMENT'
                      ? 'bg-amber-100 dark:bg-amber-800/40'
                      : type.value === 'COLLECTIBLE'
                      ? 'bg-pink-100 dark:bg-pink-800/40'
                      : 'bg-gray-100 dark:bg-gray-800/40'
                  }`}
                >
                  <span className={type.color}>{type.icon}</span>
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {type.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Asset Cards */}
      {data.assets.length > 0 && (
        <div className="space-y-4">
          {data.assets.map((asset, index) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              index={index}
              onUpdate={(updates) => updateAsset(asset.id, updates)}
              onRemove={() => removeAsset(asset.id)}
              isExpanded={expandedId === asset.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === asset.id ? null : asset.id)
              }
            />
          ))}
        </div>
      )}

      {/* Add Asset Button */}
      {data.assets.length > 0 && (
        <button
          onClick={() => addAsset()}
          className="wizard-add-button w-full p-4 rounded-xl flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
        >
          <Plus className="h-5 w-5" />
          <span className="font-medium">Add Another Asset</span>
        </button>
      )}

      {/* Summary */}
      {data.assets.length > 0 && (
        <div
          className="wizard-card bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4 rounded-xl"
          style={{ '--card-index': data.assets.length } as React.CSSProperties}
        >
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Asset Summary
          </h4>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {data.assets.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {data.assets.length === 1 ? 'Asset' : 'Assets'}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(totalValue, { abbreviate: true })}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Value</div>
            </div>
          </div>
        </div>
      )}

      {/* Skip hint */}
      {data.assets.length === 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          No personal assets to track? No problem! Click <strong>Continue</strong> to skip this
          step.
        </p>
      )}
    </div>
  );
}
