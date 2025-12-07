'use client';

import React, { useState, useEffect } from 'react';
import { Briefcase, Building2, TrendingUp, DollarSign, Calendar } from 'lucide-react';

interface IncomeData {
  name: string;
  type: string;
  amount: number;
  frequency: string;
}

interface IncomeStepProps {
  value: IncomeData | null;
  onChange: (data: IncomeData) => void;
}

const incomeTypes = [
  { value: 'SALARY', label: 'Salary/Wages', icon: Briefcase, description: 'Employment income' },
  { value: 'RENTAL', label: 'Rental Income', icon: Building2, description: 'Property rent' },
  { value: 'INVESTMENT', label: 'Investment', icon: TrendingUp, description: 'Dividends, interest' },
  { value: 'OTHER', label: 'Other', icon: DollarSign, description: 'Business, side hustle' },
];

const frequencies = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'ANNUAL', label: 'Annually' },
];

export function IncomeStep({ value, onChange }: IncomeStepProps) {
  const [name, setName] = useState(value?.name || '');
  const [type, setType] = useState(value?.type || 'SALARY');
  const [amount, setAmount] = useState(value?.amount?.toString() || '');
  const [frequency, setFrequency] = useState(value?.frequency || 'MONTHLY');

  useEffect(() => {
    if (name && amount) {
      onChange({
        name,
        type,
        amount: parseFloat(amount) || 0,
        frequency,
      });
    }
  }, [name, type, amount, frequency, onChange]);

  // Calculate annual equivalent
  const annualAmount = (() => {
    const base = parseFloat(amount) || 0;
    switch (frequency) {
      case 'WEEKLY': return base * 52;
      case 'FORTNIGHTLY': return base * 26;
      case 'MONTHLY': return base * 12;
      case 'ANNUAL': return base;
      default: return base;
    }
  })();

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Add your primary income
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          This powers your cashflow forecasts and savings calculations
        </p>
      </div>

      {/* Income type */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Income type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {incomeTypes.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => {
                  setType(option.value);
                  if (!name) {
                    setName(option.label);
                  }
                }}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left ${
                  type === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon className={`w-5 h-5 ${type === option.value ? 'text-blue-600' : 'text-gray-400'}`} />
                <div>
                  <div className="font-medium text-sm text-gray-900">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Income name */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Income name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., My Salary, Rental - Unit 1"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Amount and Frequency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <DollarSign className="w-4 h-4" />
            Net amount (after tax)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4" />
            Frequency
          </label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {frequencies.map((freq) => (
              <option key={freq.value} value={freq.value}>
                {freq.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Annual summary */}
      {amount && (
        <div className="bg-green-50 border border-green-100 rounded-lg p-4">
          <div className="text-sm text-green-800">
            <strong>Annual income:</strong> ${annualAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-green-600 mt-1">
            Based on {frequency.toLowerCase()} payments of ${parseFloat(amount).toLocaleString()}
          </div>
        </div>
      )}

      {/* Tip */}
      <p className="text-xs text-gray-500">
        Tip: You can add more income sources later, including rental income and dividends.
      </p>
    </div>
  );
}
