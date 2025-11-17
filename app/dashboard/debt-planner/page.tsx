'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';

interface DebtPlanSettings {
  strategy: 'TAX_AWARE_MINIMUM_INTEREST' | 'AVALANCHE' | 'SNOWBALL';
  surplusPerPeriod: number;
  surplusFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
  emergencyBuffer: number;
  respectFixedCaps: boolean;
  rolloverRepayments: boolean;
}

interface LoanResult {
  loanId: string;
  loanName: string;
  baselinePayoffDate: string;
  strategyPayoffDate: string;
  interestSavedVsBaseline: number;
  monthsSaved: number;
}

interface PlanResult {
  totalInterestSavedVsBaseline: number;
  totalMonthsSaved: number;
  loans: LoanResult[];
}

export default function DebtPlannerPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<DebtPlanSettings>({
    strategy: 'TAX_AWARE_MINIMUM_INTEREST',
    surplusPerPeriod: 1000,
    surplusFrequency: 'MONTHLY',
    emergencyBuffer: 5000,
    respectFixedCaps: true,
    rolloverRepayments: true,
  });
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const runPlan = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/calculate/debt-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to calculate debt plan');
      }

      const result = await response.json();
      setPlanResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate debt plan');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
    });
  };

  const strategyDescriptions = {
    TAX_AWARE_MINIMUM_INTEREST: {
      name: 'Tax-Aware Strategy',
      description: 'Prioritize non-tax-deductible debt (home loans) over tax-deductible debt (investment loans) to minimize total interest cost after tax benefits.',
      icon: '🧾',
    },
    AVALANCHE: {
      name: 'Avalanche Strategy',
      description: 'Pay off loans with the highest interest rates first to minimize total interest cost.',
      icon: '⛰️',
    },
    SNOWBALL: {
      name: 'Snowball Strategy',
      description: 'Pay off loans with the smallest balances first for psychological wins and motivation.',
      icon: '⚪',
    },
  };

  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Debt Planner</h1>
        <p className="text-gray-600 mb-8">
          Optimize your debt repayment strategy and see how much you can save
        </p>

        {/* Strategy Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Select Your Strategy</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(strategyDescriptions).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setSettings({ ...settings, strategy: key as DebtPlanSettings['strategy'] })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  settings.strategy === key
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-3xl mb-2">{info.icon}</div>
                <h3 className="font-bold text-gray-800 mb-2">{info.name}</h3>
                <p className="text-sm text-gray-600">{info.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Settings Configuration */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Extra Payment Amount
              </label>
              <input
                type="number"
                value={settings.surplusPerPeriod}
                onChange={(e) => setSettings({ ...settings, surplusPerPeriod: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                placeholder="1000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Additional amount you can pay towards debt each period
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Frequency
              </label>
              <select
                value={settings.surplusFrequency}
                onChange={(e) => setSettings({ ...settings, surplusFrequency: e.target.value as DebtPlanSettings['surplusFrequency'] })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              >
                <option value="WEEKLY">Weekly</option>
                <option value="FORTNIGHTLY">Fortnightly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Emergency Buffer
              </label>
              <input
                type="number"
                value={settings.emergencyBuffer}
                onChange={(e) => setSettings({ ...settings, emergencyBuffer: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                placeholder="5000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Reserve amount to keep in accounts for emergencies
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="respectFixedCaps"
                  checked={settings.respectFixedCaps}
                  onChange={(e) => setSettings({ ...settings, respectFixedCaps: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="respectFixedCaps" className="ml-2 block text-sm text-gray-700">
                  Respect fixed loan payment caps
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rolloverRepayments"
                  checked={settings.rolloverRepayments}
                  onChange={(e) => setSettings({ ...settings, rolloverRepayments: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="rolloverRepayments" className="ml-2 block text-sm text-gray-700">
                  Roll over payments when loans are paid off
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={runPlan}
              disabled={isLoading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? 'Calculating...' : 'Calculate Debt Plan'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-6">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {planResult && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-green-800">Total Interest Saved</h3>
                  <span className="text-3xl">💰</span>
                </div>
                <p className="text-3xl font-bold text-green-700">
                  {formatCurrency(planResult.totalInterestSavedVsBaseline)}
                </p>
                <p className="text-sm text-green-600 mt-2">
                  Compared to minimum payments only
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-blue-800">Time Saved</h3>
                  <span className="text-3xl">⏱️</span>
                </div>
                <p className="text-3xl font-bold text-blue-700">
                  {planResult.totalMonthsSaved} months
                </p>
                <p className="text-sm text-blue-600 mt-2">
                  {(planResult.totalMonthsSaved / 12).toFixed(1)} years earlier
                </p>
              </div>
            </div>

            {/* Loan Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Loan Payoff Details</h2>
              <div className="space-y-4">
                {planResult.loans.map((loan) => (
                  <div key={loan.loanId} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3">{loan.loanName}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Baseline Payoff</p>
                        <p className="font-medium">{formatDate(loan.baselinePayoffDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Strategy Payoff</p>
                        <p className="font-medium text-green-600">{formatDate(loan.strategyPayoffDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Savings</p>
                        <p className="font-medium text-green-600">
                          {formatCurrency(loan.interestSavedVsBaseline)}
                        </p>
                        <p className="text-xs text-green-600">
                          {loan.monthsSaved} months earlier
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategy Info */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
              <div className="flex items-start">
                <span className="text-4xl mr-4">{strategyDescriptions[settings.strategy].icon}</span>
                <div>
                  <h3 className="font-bold text-indigo-900 text-lg mb-2">
                    {strategyDescriptions[settings.strategy].name}
                  </h3>
                  <p className="text-indigo-800 mb-4">
                    {strategyDescriptions[settings.strategy].description}
                  </p>
                  <div className="text-sm text-indigo-700">
                    <p><strong>Extra Payment:</strong> {formatCurrency(settings.surplusPerPeriod)} {settings.surplusFrequency.toLowerCase()}</p>
                    <p><strong>Emergency Buffer:</strong> {formatCurrency(settings.emergencyBuffer)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Getting Started Message */}
        {!planResult && !isLoading && !error && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-bold text-blue-900 mb-2">How to use the Debt Planner</h3>
            <ol className="list-decimal list-inside space-y-2 text-blue-800 text-sm">
              <li>Choose your preferred debt repayment strategy</li>
              <li>Enter how much extra you can pay towards your debts</li>
              <li>Set your emergency buffer amount</li>
              <li>Click "Calculate Debt Plan" to see your personalized payoff plan</li>
              <li>Compare the savings between strategies to find the best approach</li>
            </ol>
            <p className="mt-4 text-sm text-blue-700">
              <strong>Note:</strong> Make sure you've added your loans before running the debt planner.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
