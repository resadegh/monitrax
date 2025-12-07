'use client';

import React, { useState, useEffect } from 'react';
import { Home, Car, ShoppingCart, Coffee, Sliders } from 'lucide-react';

interface ExpenseData {
  living: number;
  transport: number;
  groceries: number;
  discretionary: number;
}

interface ExpenseStepProps {
  value: ExpenseData | null;
  incomeAmount?: number;
  onChange: (data: ExpenseData) => void;
}

export function ExpenseStep({ value, incomeAmount, onChange }: ExpenseStepProps) {
  const [useSlider, setUseSlider] = useState(false);
  const [expenseRatio, setExpenseRatio] = useState(70); // Default 70% of income
  const [living, setLiving] = useState(value?.living?.toString() || '');
  const [transport, setTransport] = useState(value?.transport?.toString() || '');
  const [groceries, setGroceries] = useState(value?.groceries?.toString() || '');
  const [discretionary, setDiscretionary] = useState(value?.discretionary?.toString() || '');

  // Calculate totals
  const manualTotal = (parseFloat(living) || 0) + (parseFloat(transport) || 0) +
    (parseFloat(groceries) || 0) + (parseFloat(discretionary) || 0);

  const estimatedTotal = incomeAmount ? (incomeAmount * expenseRatio / 100) : 0;
  const total = useSlider ? estimatedTotal : manualTotal;

  // Auto-distribute when using slider
  useEffect(() => {
    if (useSlider && incomeAmount) {
      const monthlyIncome = incomeAmount;
      const totalExpense = monthlyIncome * (expenseRatio / 100);

      // Distribute across categories (typical breakdown)
      const distribution = {
        living: Math.round(totalExpense * 0.35), // 35% housing
        transport: Math.round(totalExpense * 0.15), // 15% transport
        groceries: Math.round(totalExpense * 0.20), // 20% groceries
        discretionary: Math.round(totalExpense * 0.30), // 30% discretionary
      };

      setLiving(distribution.living.toString());
      setTransport(distribution.transport.toString());
      setGroceries(distribution.groceries.toString());
      setDiscretionary(distribution.discretionary.toString());
    }
  }, [useSlider, expenseRatio, incomeAmount]);

  useEffect(() => {
    onChange({
      living: parseFloat(living) || 0,
      transport: parseFloat(transport) || 0,
      groceries: parseFloat(groceries) || 0,
      discretionary: parseFloat(discretionary) || 0,
    });
  }, [living, transport, groceries, discretionary, onChange]);

  const categories = [
    {
      key: 'living',
      icon: Home,
      label: 'Living expenses',
      description: 'Rent, mortgage, utilities, insurance',
      value: living,
      setValue: setLiving,
    },
    {
      key: 'transport',
      icon: Car,
      label: 'Transport',
      description: 'Fuel, public transport, car costs',
      value: transport,
      setValue: setTransport,
    },
    {
      key: 'groceries',
      icon: ShoppingCart,
      label: 'Groceries & essentials',
      description: 'Food, household items',
      value: groceries,
      setValue: setGroceries,
    },
    {
      key: 'discretionary',
      icon: Coffee,
      label: 'Discretionary',
      description: 'Entertainment, dining, shopping',
      value: discretionary,
      setValue: setDiscretionary,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Set up your monthly expenses
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          This helps us calculate your savings and forecast cashflow
        </p>
      </div>

      {/* Estimate slider option */}
      {incomeAmount && incomeAmount > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Quick estimate from income
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useSlider}
                onChange={(e) => setUseSlider(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {useSlider && (
            <div className="space-y-2">
              <input
                type="range"
                min="30"
                max="100"
                value={expenseRatio}
                onChange={(e) => setExpenseRatio(parseInt(e.target.value))}
                className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-blue-600">
                <span>30% (big saver)</span>
                <span className="font-medium">{expenseRatio}% of income</span>
                <span>100% (living pay-to-pay)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expense categories */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div key={cat.key} className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Icon className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-900">{cat.label}</label>
                <p className="text-xs text-gray-500">{cat.description}</p>
              </div>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  value={cat.value}
                  onChange={(e) => {
                    setUseSlider(false);
                    cat.setValue(e.target.value);
                  }}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total summary */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-900">Total monthly expenses</span>
          <span className="text-xl font-semibold text-gray-900">
            ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>

        {incomeAmount && incomeAmount > 0 && (
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-gray-500">Monthly savings</span>
            <span className={`font-medium ${(incomeAmount - total) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${(incomeAmount - total).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-gray-400 ml-1">
                ({Math.round((1 - total / incomeAmount) * 100)}%)
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Tip */}
      <p className="text-xs text-gray-500">
        Tip: Approximate numbers are fine. You can refine these later as you track actual spending.
      </p>
    </div>
  );
}
