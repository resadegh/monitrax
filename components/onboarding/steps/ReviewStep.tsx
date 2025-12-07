'use client';

import React from 'react';
import { Check, AlertCircle, TrendingUp, Home, Wallet, DollarSign, Receipt } from 'lucide-react';
import type { OnboardingProfileType } from '@/hooks/useOnboardingState';

interface WizardData {
  profileType: OnboardingProfileType | null;
  country: string;
  taxYear: string;
  account: {
    name: string;
    type: string;
    balance: number;
  } | null;
  property: {
    name: string;
    type: string;
    value: number;
    hasLoan: boolean;
    loanDetails?: {
      lender: string;
      principal: number;
      rate: number;
      isFixed: boolean;
      isInterestOnly: boolean;
    };
  } | null;
  investmentAccount: {
    name: string;
    type: string;
    value: number;
  } | null;
  income: {
    name: string;
    type: string;
    amount: number;
    frequency: string;
  } | null;
  expenses: {
    living: number;
    transport: number;
    groceries: number;
    discretionary: number;
  } | null;
}

interface ReviewStepProps {
  data: WizardData;
}

export function ReviewStep({ data }: ReviewStepProps) {
  // Calculate totals
  const totalAssets = (data.account?.balance || 0) +
    (data.property?.value || 0) +
    (data.investmentAccount?.value || 0);

  const totalLiabilities = data.property?.loanDetails?.principal || 0;
  const netWorth = totalAssets - totalLiabilities;

  const monthlyIncome = getMonthlyAmount(data.income?.amount || 0, data.income?.frequency || 'MONTHLY');
  const monthlyExpenses = data.expenses
    ? data.expenses.living + data.expenses.transport + data.expenses.groceries + data.expenses.discretionary
    : 0;
  const monthlySavings = monthlyIncome - monthlyExpenses;

  const sections = [
    {
      icon: Wallet,
      title: 'Cash Account',
      hasData: !!data.account,
      content: data.account && (
        <div>
          <p className="font-medium text-gray-900">{data.account.name}</p>
          <p className="text-sm text-gray-500">{data.account.type}</p>
          <p className="text-lg font-semibold text-green-600">
            ${data.account.balance.toLocaleString()}
          </p>
        </div>
      ),
    },
    {
      icon: Home,
      title: 'Property',
      hasData: !!data.property,
      content: data.property && (
        <div>
          <p className="font-medium text-gray-900">{data.property.name}</p>
          <p className="text-sm text-gray-500">{data.property.type}</p>
          <p className="text-lg font-semibold text-gray-900">
            ${data.property.value.toLocaleString()}
          </p>
          {data.property.hasLoan && data.property.loanDetails && (
            <p className="text-sm text-red-600">
              Loan: ${data.property.loanDetails.principal.toLocaleString()} @ {data.property.loanDetails.rate}%
            </p>
          )}
        </div>
      ),
    },
    {
      icon: TrendingUp,
      title: 'Investment Account',
      hasData: !!data.investmentAccount,
      content: data.investmentAccount && (
        <div>
          <p className="font-medium text-gray-900">{data.investmentAccount.name}</p>
          <p className="text-sm text-gray-500">{data.investmentAccount.type}</p>
          <p className="text-lg font-semibold text-green-600">
            ${data.investmentAccount.value.toLocaleString()}
          </p>
        </div>
      ),
    },
    {
      icon: DollarSign,
      title: 'Income',
      hasData: !!data.income,
      content: data.income && (
        <div>
          <p className="font-medium text-gray-900">{data.income.name}</p>
          <p className="text-sm text-gray-500">{data.income.type} ({data.income.frequency})</p>
          <p className="text-lg font-semibold text-green-600">
            ${data.income.amount.toLocaleString()}/{data.income.frequency.toLowerCase()}
          </p>
        </div>
      ),
    },
    {
      icon: Receipt,
      title: 'Expenses',
      hasData: !!data.expenses && monthlyExpenses > 0,
      content: data.expenses && (
        <div>
          <p className="font-medium text-gray-900">${monthlyExpenses.toLocaleString()}/month</p>
          <div className="text-sm text-gray-500 space-y-0.5">
            <p>Living: ${data.expenses.living.toLocaleString()}</p>
            <p>Transport: ${data.expenses.transport.toLocaleString()}</p>
            <p>Groceries: ${data.expenses.groceries.toLocaleString()}</p>
            <p>Discretionary: ${data.expenses.discretionary.toLocaleString()}</p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Review your setup
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Here&apos;s what Monitrax now knows about your finances
        </p>
      </div>

      {/* Net Worth Summary */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
        <div className="text-sm text-blue-100 mb-1">Estimated Net Worth</div>
        <div className="text-3xl font-bold mb-4">
          ${netWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-blue-200">Assets</div>
            <div className="font-semibold">${totalAssets.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-blue-200">Liabilities</div>
            <div className="font-semibold">${totalLiabilities.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Cashflow Summary */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="text-sm font-medium text-gray-700 mb-2">Monthly Cashflow</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">Income</div>
            <div className="font-semibold text-green-600">+${monthlyIncome.toLocaleString()}</div>
          </div>
          <div className="text-2xl text-gray-300">−</div>
          <div>
            <div className="text-xs text-gray-500">Expenses</div>
            <div className="font-semibold text-red-600">-${monthlyExpenses.toLocaleString()}</div>
          </div>
          <div className="text-2xl text-gray-300">=</div>
          <div>
            <div className="text-xs text-gray-500">Savings</div>
            <div className={`font-semibold ${monthlySavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${monthlySavings.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Data sections */}
      <div className="space-y-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.title}
              className={`flex items-start gap-4 p-4 rounded-lg border ${
                section.hasData
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                section.hasData ? 'bg-green-100' : 'bg-gray-200'
              }`}>
                {section.hasData ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Icon className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{section.title}</div>
                {section.hasData ? (
                  section.content
                ) : (
                  <p className="text-sm text-gray-500">Not added</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* What's enabled */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">What Monitrax can now do:</p>
            <ul className="mt-2 text-sm text-blue-800 space-y-1">
              <li>✓ Show your dashboard with net worth and metrics</li>
              <li>✓ Track your cashflow and savings</li>
              <li>✓ Generate basic forecasts</li>
              <li>✓ Provide initial strategy recommendations</li>
            </ul>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Click &quot;Finish Setup&quot; to go to your dashboard. You can always add more data later.
      </p>
    </div>
  );
}

// Helper function
function getMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case 'WEEKLY': return amount * 52 / 12;
    case 'FORTNIGHTLY': return amount * 26 / 12;
    case 'MONTHLY': return amount;
    case 'QUARTERLY': return amount / 3;
    case 'ANNUAL': return amount / 12;
    default: return amount;
  }
}
