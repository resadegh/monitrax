'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, Building, DollarSign, Info } from 'lucide-react';

interface InvestmentAccountData {
  name: string;
  type: string;
  value: number;
}

interface InvestmentAccountStepProps {
  value: InvestmentAccountData | null;
  onChange: (data: InvestmentAccountData | null) => void;
}

const accountTypes = [
  { value: 'BROKERAGE', label: 'Brokerage', description: 'CommSec, SelfWealth, Stake, etc.' },
  { value: 'SUPERS', label: 'Superannuation', description: 'Your super fund' },
  { value: 'FUND', label: 'Managed Fund', description: 'Vanguard, BetaShares, etc.' },
  { value: 'ETF_CRYPTO', label: 'Crypto/ETF', description: 'Cryptocurrency or ETF platform' },
];

export function InvestmentAccountStep({ value, onChange }: InvestmentAccountStepProps) {
  const [skipInvestment, setSkipInvestment] = useState(false);
  const [name, setName] = useState(value?.name || '');
  const [type, setType] = useState(value?.type || 'BROKERAGE');
  const [accountValue, setAccountValue] = useState(value?.value?.toString() || '');

  useEffect(() => {
    if (skipInvestment) {
      onChange(null);
      return;
    }

    if (name && accountValue) {
      onChange({
        name,
        type,
        value: parseFloat(accountValue) || 0,
      });
    }
  }, [skipInvestment, name, type, accountValue, onChange]);

  if (skipInvestment) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No worries!
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            You can add investment accounts later from the Investments page.
            Click &quot;Next&quot; to continue.
          </p>
          <button
            onClick={() => setSkipInvestment(false)}
            className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Actually, I do have investments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Add an investment account
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Track your shares, ETFs, super, or managed funds
        </p>
      </div>

      {/* Skip option */}
      <button
        onClick={() => setSkipInvestment(true)}
        className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
      >
        Skip for now →
      </button>

      {/* Account name */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Building className="w-4 h-4" />
          Account name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., CommSec, My Super, Vanguard"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Account type */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Account type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {accountTypes.map((option) => (
            <button
              key={option.value}
              onClick={() => setType(option.value)}
              className={`p-3 rounded-lg border-2 text-left ${
                type === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm text-gray-900">{option.label}</div>
              <div className="text-xs text-gray-500">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Current value */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <DollarSign className="w-4 h-4" />
          Approximate current value
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            value={accountValue}
            onChange={(e) => setAccountValue(e.target.value)}
            placeholder="0"
            className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Info box */}
      <div className="flex gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <Info className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600">
          You can add detailed holdings and transactions later.
          For now, just enter an approximate total value.
        </p>
      </div>
    </div>
  );
}
