'use client';

import React, { useEffect, useState } from 'react';
import {
  Rocket,
  Home,
  Landmark,
  TrendingUp,
  Car,
  DollarSign,
  Check,
  ChevronRight,
  Sparkles,
  ArrowUpCircle,
  ArrowDownCircle,
  Building2,
  CreditCard,
  PiggyBank,
} from 'lucide-react';
import { WizardData, calculateSummary } from '../types';
import { formatCurrency } from '@/lib/utils/formatters';
import '@/styles/wizard-animations.css';

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  delay: number;
}

function StatCard({ label, value, icon, color, delay }: StatCardProps) {
  return (
    <div
      className="wizard-stat-value bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
      style={{ '--stat-delay': `${delay}s` } as React.CSSProperties}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SECTION SUMMARY COMPONENT
// =============================================================================

interface SectionSummaryProps {
  title: string;
  icon: React.ReactNode;
  items: string[];
  color: string;
  count: number;
  delay: number;
}

function SectionSummary({ title, icon, items, color, count, delay }: SectionSummaryProps) {
  if (count === 0) return null;

  return (
    <div
      className="wizard-stat-value"
      style={{ '--stat-delay': `${delay}s` } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {title} ({count})
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {items.slice(0, 5).map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300"
          >
            <Check className="h-3 w-3 text-green-500" />
            {item}
          </span>
        ))}
        {items.length > 5 && (
          <span className="px-2 py-0.5 text-xs text-gray-400">
            +{items.length - 5} more
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// CONFETTI COMPONENT
// =============================================================================

function Confetti() {
  const [pieces, setPieces] = useState<
    Array<{ id: number; left: string; delay: string; color: string }>
  >([]);

  useEffect(() => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const newPieces = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setPieces(newPieces);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            '--confetti-left': piece.left,
            '--confetti-delay': piece.delay,
            '--confetti-color': piece.color,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// =============================================================================
// REVIEW STEP COMPONENT
// =============================================================================

interface ReviewStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function ReviewStep({ data }: ReviewStepProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const summary = calculateSummary(data);

  useEffect(() => {
    // Show confetti after a short delay
    const timer = setTimeout(() => setShowConfetti(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Prepare section summaries
  const propertyNames = data.properties.map((p) => p.name || p.address || 'Property');
  const accountNames = data.accounts.map((a) => a.name || a.type);
  const investmentNames = data.investments.map((i) => i.name || i.platform || i.type);
  const assetNames = data.assets.map((a) => a.name || a.type);
  const incomeNames = data.income.map((i) => i.name || i.type);
  const expenseCategories = [...new Set(data.expenses.map((e) => e.category))];

  return (
    <div className="space-y-6 wizard-step-enter">
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="wizard-success-icon inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white text-3xl mb-2">
          <Rocket className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          You&apos;re All Set!
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          Here&apos;s a summary of your financial setup. Click <strong>Launch Dashboard</strong> to
          start tracking your wealth.
        </p>
      </div>

      {/* Net Worth Hero */}
      <div className="wizard-card bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white text-center" style={{ '--card-index': 0 } as React.CSSProperties}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-yellow-300" />
          <span className="text-sm font-medium text-blue-100">Your Net Worth</span>
          <Sparkles className="h-5 w-5 text-yellow-300" />
        </div>
        <div className="text-5xl font-bold mb-2">{formatCurrency(summary.netWorth, { abbreviate: true })}</div>
        <p className="text-sm text-blue-100">
          Based on {data.properties.length} properties, {data.accounts.length} accounts,
          {data.investments.length > 0 && ` ${data.investments.length} investment accounts,`}
          {data.assets.length > 0 && ` ${data.assets.length} assets`}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Property Value"
          value={formatCurrency(summary.totalPropertyValue, { abbreviate: true })}
          icon={<Home className="h-5 w-5 text-blue-600" />}
          color="bg-blue-100 dark:bg-blue-800/40"
          delay={0.1}
        />
        <StatCard
          label="Total Debt"
          value={formatCurrency(summary.totalLoanBalance, { abbreviate: true })}
          icon={<Building2 className="h-5 w-5 text-red-600" />}
          color="bg-red-100 dark:bg-red-800/40"
          delay={0.2}
        />
        <StatCard
          label="Cash & Savings"
          value={formatCurrency(summary.totalAccountBalance, { abbreviate: true })}
          icon={<PiggyBank className="h-5 w-5 text-green-600" />}
          color="bg-green-100 dark:bg-green-800/40"
          delay={0.3}
        />
        <StatCard
          label="Investments"
          value={formatCurrency(summary.totalInvestmentValue, { abbreviate: true })}
          icon={<TrendingUp className="h-5 w-5 text-purple-600" />}
          color="bg-purple-100 dark:bg-purple-800/40"
          delay={0.4}
        />
      </div>

      {/* Cashflow Summary */}
      <div className="wizard-card bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4" style={{ '--card-index': 1 } as React.CSSProperties}>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
          Annual Cashflow
        </h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
              <ArrowUpCircle className="h-4 w-4" />
              <span className="text-xl font-bold">{formatCurrency(summary.annualIncome, { abbreviate: true })}</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Income</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400">
              <ArrowDownCircle className="h-4 w-4" />
              <span className="text-xl font-bold">
                {formatCurrency(summary.annualExpenses + summary.annualLoanRepayments, { abbreviate: true })}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Outgoings</div>
          </div>
          <div>
            <div
              className={`text-xl font-bold ${
                summary.monthlyCashflow >= 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {summary.monthlyCashflow >= 0 ? '+' : ''}
              {formatCurrency(summary.monthlyCashflow)}/mo
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Monthly Surplus</div>
          </div>
        </div>
      </div>

      {/* Items Added Summary */}
      <div className="space-y-3 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          What You&apos;ve Added
        </h4>

        <SectionSummary
          title="Properties"
          icon={<Home className="h-4 w-4" />}
          items={propertyNames}
          color="text-blue-600 dark:text-blue-400"
          count={data.properties.length}
          delay={0.5}
        />

        <SectionSummary
          title="Bank Accounts"
          icon={<Landmark className="h-4 w-4" />}
          items={accountNames}
          color="text-green-600 dark:text-green-400"
          count={data.accounts.length}
          delay={0.6}
        />

        <SectionSummary
          title="Investments"
          icon={<TrendingUp className="h-4 w-4" />}
          items={investmentNames}
          color="text-purple-600 dark:text-purple-400"
          count={data.investments.length}
          delay={0.7}
        />

        <SectionSummary
          title="Assets"
          icon={<Car className="h-4 w-4" />}
          items={assetNames}
          color="text-amber-600 dark:text-amber-400"
          count={data.assets.length}
          delay={0.8}
        />

        <SectionSummary
          title="Income Sources"
          icon={<ArrowUpCircle className="h-4 w-4" />}
          items={incomeNames}
          color="text-green-600 dark:text-green-400"
          count={data.income.length}
          delay={0.9}
        />

        <SectionSummary
          title="Expense Categories"
          icon={<ArrowDownCircle className="h-4 w-4" />}
          items={expenseCategories}
          color="text-orange-600 dark:text-orange-400"
          count={data.expenses.length}
          delay={1.0}
        />
      </div>

      {/* What's Next */}
      <div className="wizard-card bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4" style={{ '--card-index': 2 } as React.CSSProperties}>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          What&apos;s Next?
        </h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <ChevronRight className="h-4 w-4 text-indigo-500" />
            <span>View your personalized dashboard with real-time insights</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <ChevronRight className="h-4 w-4 text-indigo-500" />
            <span>Get AI-powered recommendations to optimize your wealth</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <ChevronRight className="h-4 w-4 text-indigo-500" />
            <span>Track your progress with cashflow forecasting</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <ChevronRight className="h-4 w-4 text-indigo-500" />
            <span>Explore strategies to grow your net worth faster</span>
          </div>
        </div>
      </div>

      {/* Footer Message */}
      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        You can always add more data or make changes from your dashboard settings.
      </p>
    </div>
  );
}
