'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, Building, DollarSign, Info } from 'lucide-react';

interface AccountData {
  name: string;
  type: string;
  balance: number;
}

interface BankAccountStepProps {
  value: AccountData | null;
  onChange: (data: AccountData) => void;
}

const accountTypes = [
  { value: 'OFFSET', label: 'Offset Account', description: 'Linked to a mortgage to reduce interest' },
  { value: 'SAVINGS', label: 'Savings Account', description: 'High interest savings or term deposit' },
  { value: 'TRANSACTIONAL', label: 'Transaction Account', description: 'Everyday spending account' },
];

export function BankAccountStep({ value, onChange }: BankAccountStepProps) {
  const [name, setName] = useState(value?.name || '');
  const [type, setType] = useState(value?.type || 'SAVINGS');
  const [balance, setBalance] = useState(value?.balance?.toString() || '');

  useEffect(() => {
    if (name && type && balance) {
      onChange({
        name,
        type,
        balance: parseFloat(balance) || 0,
      });
    }
  }, [name, type, balance, onChange]);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Add your main cash account
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          We use this to track your cash buffer and calculate net worth
        </p>
      </div>

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
          placeholder="e.g., CBA Smart Access, Westpac Savings"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Account type */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Wallet className="w-4 h-4" />
          Account type
        </label>
        <div className="grid gap-2">
          {accountTypes.map((option) => (
            <button
              key={option.value}
              onClick={() => setType(option.value)}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                type === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                  type === option.value
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}
              >
                {type === option.value && (
                  <svg className="w-full h-full text-white" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="4" fill="currentColor" />
                  </svg>
                )}
              </div>
              <div>
                <div className="font-medium text-gray-900">{option.label}</div>
                <div className="text-xs text-gray-500">{option.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Current balance */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <DollarSign className="w-4 h-4" />
          Current balance
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0.00"
            className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Info box */}
      <div className="flex gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <Info className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600">
          Don&apos;t worry about exact numbers — approximate values work great to start.
          You can always update this later.
        </p>
      </div>
    </div>
  );
}
