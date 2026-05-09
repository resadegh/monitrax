'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Home,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Receipt,
  PiggyBank,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Building2,
  CreditCard,
  DollarSign,
  Percent,
  Target,
  Activity,
  ChevronRight,
  Landmark,
  X,
  Car,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import {
  FinancialHealthScore,
  EmergencyFundTracker,
  MoneyBleedingCard,
  SpendingByCategory,
  ActionableInsights,
  MonthlyBudgetSummary,
} from '@/components/dashboard/InsightWidgets';
import { DebtQualityWidget, calculateDebtQuality } from '@/components/dashboard/DebtQualityWidget';
import { EntityCashflowSummary, calculateEntityCashflow } from '@/components/dashboard/EntityCashflowSummary';
import {
  CalculationTooltip,
  InvestmentIncomeDisplay,
  calculateInvestmentIncome,
  LinkageHealthIndicator,
  calculateLinkageHealthStatus,
  EntityComparisonChart,
  buildEntityComparisonData,
  QuickActionsBar,
} from '@/components/dashboard/Phase2Enhancements';
import { NetWorthTrend, generateNetWorthTrendData, CompactNetWorthTrend } from '@/components/dashboard/NetWorthTrend';
import { TrailStageIndicator } from '@/components/dashboard/TrailStageIndicator';
import { DailyPulseCard } from '@/components/bookkeeping/DailyPulseCard';
import { PendingActionsPrompt } from '@/components/bookkeeping/PendingActionsPrompt';
import { MoneyStoryHero } from '@/components/dashboard/MoneyStoryHero';
import { determineTrailStage } from '@/lib/cfo/trailStage';

interface DashboardInsights {
  healthScore: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    breakdown: {
      savingsRate: { score: number; weight: number; value: number };
      emergencyFund: { score: number; weight: number; value: number };
      debtToIncome: { score: number; weight: number; value: number };
      diversification: { score: number; weight: number; value: number };
    };
  };
  emergencyFund: {
    liquidCash: number;
    monthlyExpenses: number;
    monthsCovered: number;
    target: number;
    status: 'danger' | 'warning' | 'good' | 'excellent';
    gap: number;
  };
  spendingByCategory: Array<{
    category: string;
    monthlyAmount: number;
    annualAmount: number;
    percentage: number;
    items: Array<{ name: string; monthlyAmount: number }>;
  }>;
  moneyBleeding: Array<{
    name: string;
    category: string;
    monthlyAmount: number;
    annualAmount: number;
    percentageOfIncome: number;
    suggestion?: string;
  }>;
  insights: Array<{
    type: 'success' | 'warning' | 'danger' | 'info';
    title: string;
    message: string;
    metric?: string;
    action?: string;
  }>;
  monthlyBudget: {
    income: number;
    essentialExpenses: number;
    discretionaryExpenses: number;
    loanPayments: number;
    remaining: number;
    daysInMonth: number;
    dailyBudget: number;
  };
  // Phase 43 — Money Story 3-line scoreboard + Money Story Bar
  // segments. Mirrored from /api/dashboard/insights. Optional so the
  // dashboard renders during older cached responses without the block;
  // the hero self-hides when missing.
  moneyStory?: {
    earned: number;
    kept: number;
    keptMargin: number;
    freeToday: number;
    freeDays: number;
    enoughHistory: boolean;
    taxWithheld: number;
    surplus: number;
  };
}

interface PortfolioSnapshot {
  generatedAt: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  cashflow: {
    grossIncome?: number;
    netIncome?: number;
    paygWithholding?: number;
    totalIncome: number;
    totalExpenses: number;
    totalLoanRepayments?: number;
    monthlyLoanRepayments?: number;
    monthlyNetCashflow: number;
    annualNetCashflow: number;
    savingsRate: number;
  };
  loans?: Array<{
    id: string;
    name: string;
    type: string;
    principal: number;
    interestRate: number;
    minRepayment?: number;
    repaymentFrequency?: string;
    propertyId?: string | null;
    propertyName?: string | null;
    annualRepayment?: number;
  }>;
  expenses?: Array<{
    id: string;
    name: string;
    category: string;
    amount: number;
    frequency: string;
    annualAmount: number;
    propertyName?: string | null;
    isTaxDeductible?: boolean;
  }>;
  income?: Array<{
    id: string;
    name: string;
    type: string;
    amount: number;
    frequency: string;
    grossAnnual: number;
    netAnnual: number;
    propertyName?: string | null;
    investmentAccountId?: string | null;
    isTaxable?: boolean;
  }>;
  assets: {
    properties: { count: number; totalValue: number };
    accounts: { count: number; totalValue: number };
    investments: { count: number; totalValue: number };
    personalAssets?: { count: number; totalValue: number };
  };
  liabilities: {
    loans: { count: number; totalValue: number };
  };
  gearing: {
    portfolioLVR: number;
    debtToIncome: number;
  };
  properties: Array<{
    id: string;
    name: string;
    type: string;
    marketValue: number;
    equity: number;
    lvr: number;
    rentalYield: number;
    cashflow: {
      annualIncome?: number;
      annualExpenses?: number;
      annualLoanRepayments?: number;
      monthlyNet: number;
    };
  }>;
  personalAssets?: {
    totalValue: number;
    items: Array<{
      id: string;
      name: string;
      type: string;
      currentValue: number;
      expenses?: {
        annualTotal: number;
        monthlyTotal: number;
      };
    }>;
  };
  investments: {
    totalValue: number;
    accounts: Array<{
      id: string;
      name: string;
      type: string;
      totalValue: number;
      holdings: Array<{
        ticker: string;
        type: string;
        currentValue: number;
      }>;
    }>;
  };
  // Phase 3: Linkage health for data completeness indicator
  linkageHealth?: {
    completenessScore: number;
    orphanCount: number;
    warnings: string[];
  };
}

// SVG Donut Chart Component
function DonutChart({
  data,
  size = 200,
  strokeWidth = 30,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
  strokeWidth?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <p className="text-sm text-muted-foreground">No data</p>
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((segment, index) => {
        const percentage = segment.value / total;
        const dashLength = percentage * circumference;
        const dashOffset = -currentOffset;
        currentOffset += dashLength;

        return (
          <circle
            key={index}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-all duration-500"
          />
        );
      })}
      {/* Center text */}
      <text
        x={size / 2}
        y={size / 2 - 10}
        textAnchor="middle"
        className="fill-current text-2xl font-bold"
      >
        {data.length}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 15}
        textAnchor="middle"
        className="fill-muted-foreground text-sm"
      >
        {data.length === 1 ? 'Asset' : 'Assets'}
      </text>
    </svg>
  );
}

// Progress Bar Component
function ProgressBar({
  value,
  max,
  color = 'bg-primary',
  showPercentage = true,
}: {
  value: number;
  max: number;
  color?: string;
  showPercentage?: boolean;
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className="w-full">
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercentage && (
        <p className="text-xs text-muted-foreground mt-1">{percentage.toFixed(1)}%</p>
      )}
    </div>
  );
}

type DetailTileType = 'netWorth' | 'cashflow' | 'savingsRate' | 'lvr' | 'income' | 'outgoings' | null;
type CashflowPeriod = 'monthly' | 'annual';

export default function DashboardPage() {
  const { token } = useAuth();
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<DetailTileType>(null);
  const [cashflowPeriod, setCashflowPeriod] = useState<CashflowPeriod>('monthly');

  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token]);

  const loadDashboardData = async () => {
    try {
      // Load both endpoints in parallel
      const [snapshotRes, insightsRes] = await Promise.all([
        fetch('/api/portfolio/snapshot', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/dashboard/insights', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (snapshotRes.ok) {
        setSnapshot(await snapshotRes.json());
      }
      if (insightsRes.ok) {
        setInsights(await insightsRes.json());
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Use centralized formatCurrency utility with abbreviate option for compact display
  const formatCompactCurrency = (amount: number) => formatCurrency(amount, { abbreviate: true });

  // Generate insights based on portfolio data
  const generateInsights = () => {
    if (!snapshot) return [];

    const insights: Array<{ type: 'success' | 'warning' | 'info'; message: string; icon: any }> = [];

    // Savings rate insight
    if (snapshot.cashflow.savingsRate >= 20) {
      insights.push({
        type: 'success',
        message: `Excellent! You're saving ${snapshot.cashflow.savingsRate.toFixed(1)}% of your income.`,
        icon: CheckCircle2,
      });
    } else if (snapshot.cashflow.savingsRate < 10 && snapshot.cashflow.savingsRate > 0) {
      insights.push({
        type: 'warning',
        message: `Your savings rate is ${snapshot.cashflow.savingsRate.toFixed(1)}%. Consider reducing expenses.`,
        icon: AlertTriangle,
      });
    }

    // LVR insight
    if (snapshot.gearing.portfolioLVR > 80) {
      insights.push({
        type: 'warning',
        message: `High leverage: Portfolio LVR is ${snapshot.gearing.portfolioLVR.toFixed(1)}%. Consider paying down debt.`,
        icon: AlertTriangle,
      });
    } else if (snapshot.gearing.portfolioLVR > 0 && snapshot.gearing.portfolioLVR <= 60) {
      insights.push({
        type: 'success',
        message: `Healthy LVR of ${snapshot.gearing.portfolioLVR.toFixed(1)}% provides good equity buffer.`,
        icon: CheckCircle2,
      });
    }

    // Cash flow insight
    if (snapshot.cashflow.monthlyNetCashflow > 0) {
      insights.push({
        type: 'success',
        message: `Positive cash flow of ${formatCurrency(snapshot.cashflow.monthlyNetCashflow)}/month.`,
        icon: TrendingUp,
      });
    } else if (snapshot.cashflow.monthlyNetCashflow < 0) {
      insights.push({
        type: 'warning',
        message: `Negative cash flow of ${formatCurrency(Math.abs(snapshot.cashflow.monthlyNetCashflow))}/month.`,
        icon: TrendingDown,
      });
    }

    // Diversification insight
    const assetTypes = [
      snapshot.assets.properties.totalValue,
      snapshot.assets.accounts.totalValue,
      snapshot.assets.investments.totalValue,
    ].filter(v => v > 0).length;

    if (assetTypes >= 3) {
      insights.push({
        type: 'success',
        message: 'Good diversification across property, cash, and investments.',
        icon: CheckCircle2,
      });
    } else if (assetTypes === 1 && snapshot.totalAssets > 0) {
      insights.push({
        type: 'info',
        message: 'Consider diversifying across different asset classes.',
        icon: Lightbulb,
      });
    }

    // Property-specific insights
    snapshot.properties.forEach(property => {
      if (property.lvr > 90) {
        insights.push({
          type: 'warning',
          message: `${property.name} has high LVR (${property.lvr.toFixed(1)}%). Consider paying down principal.`,
          icon: AlertTriangle,
        });
      }
      if (property.rentalYield > 5) {
        insights.push({
          type: 'success',
          message: `${property.name} has strong rental yield of ${property.rentalYield.toFixed(1)}%.`,
          icon: CheckCircle2,
        });
      }
    });

    return insights.slice(0, 5); // Limit to 5 insights
  };

  // Prepare chart data
  const getAssetAllocationData = () => {
    if (!snapshot) return [];
    return [
      { label: 'Properties', value: snapshot.assets.properties.totalValue, color: '#3b82f6' },
      { label: 'Cash', value: snapshot.assets.accounts.totalValue, color: '#22c55e' },
      { label: 'Investments', value: snapshot.assets.investments.totalValue, color: '#a855f7' },
    ].filter(d => d.value > 0);
  };

  const isEmpty = !snapshot || (
    snapshot.assets.properties.count === 0 &&
    snapshot.assets.accounts.count === 0 &&
    snapshot.assets.investments.count === 0 &&
    snapshot.liabilities.loans.count === 0
  );

  const portfolioInsights = generateInsights();

  return (
    <DashboardLayout>
      <PageHeader
        title="Home"
        description="Your TRAIL to financial freedom"
      />

      {/* Phase 42 PR6.5e — Persistent reconciliation nudge.
          Anchored ABOVE the TRAIL hero (top of feed pattern;
          YNAB / Mint / Pocketbook). Per-session collapse via
          sessionStorage so it shows every fresh visit, not just
          once per UTC day. Self-hides when nothing to do or when
          the user has globally opted out. Per Reza directive
          2026-05-08: reconciliation is the most-recurring user
          task — surface it persistently, not on a 24h gate. */}
      <PendingActionsPrompt />

      {/* TRAIL Stage Indicator */}
      <div className="mb-6">
        <TrailStageIndicator />
      </div>

      {/* Phase 42 PR6 — Daily Pulse engagement front door. Self-hides
          when the user has zero transactions in the current month. */}
      <div className="mb-6">
        <DailyPulseCard />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading your portfolio...</p>
          </div>
        </div>
      ) : isEmpty ? (
        <div className="space-y-6">
          {/* Getting Started Card */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Welcome to Your TRAIL
              </CardTitle>
              <CardDescription>
                Your personal financial guide. Start by connecting your bank or adding your data — each step takes you further on your TRAIL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm mb-6">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">1</span>
                  <span>Add your <strong>properties</strong> (home, investment properties)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">2</span>
                  <span>Add your <strong>loans</strong> and link them to properties</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">3</span>
                  <span>Add your <strong>income sources</strong> and <strong>expenses</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">4</span>
                  <span>Track your <strong>investments</strong> (shares, ETFs, managed funds)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">5</span>
                  <span>Use tools like <strong>Debt Planner</strong> and <strong>Tax Calculator</strong></span>
                </li>
              </ol>
              {/* Phase 12 v3: primary "Set up Monitrax" CTA routes to
                  the dedicated /dashboard/setup page that hosts the
                  Setup Tray + Basiq hero + empty-state tile grid. The
                  legacy per-entity shortcut buttons remain below as a
                  secondary option for users who already know what
                  they want to add first. See
                  docs/blueprint/PHASE_12_REDESIGN_V3.md §2.1. */}
              <div className="mb-4">
                <Link href="/dashboard/setup">
                  <Button size="lg" className="w-full sm:w-auto">
                    <Target className="h-4 w-4 mr-2" />
                    Set up Monitrax
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard/properties">
                  <Button variant="outline">
                    <Home className="h-4 w-4 mr-2" />
                    Add Property
                  </Button>
                </Link>
                <Link href="/dashboard/loans">
                  <Button variant="outline">
                    <Banknote className="h-4 w-4 mr-2" />
                    Add Loan
                  </Button>
                </Link>
                <Link href="/dashboard/investments/accounts">
                  <Button variant="outline">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Add Investment
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

        </div>
      ) : (
        <div className="space-y-6">
          {/* Phase 43 — Money Story (Personal P&L scoreboard).
              The orientation hero: 3 lines (Earned → Kept → Free today)
              that map to TRAIL T → R → A. Stage emphasis rotates inside
              the component. Self-gates when the insights endpoint hasn't
              attached the moneyStory block (older cached responses).
              All five values come from canonical quickMetrics (SSOT). */}
          {insights?.moneyStory && (
            <MoneyStoryHero
              earned={insights.moneyStory.earned}
              kept={insights.moneyStory.kept}
              keptMargin={insights.moneyStory.keptMargin}
              freeToday={insights.moneyStory.freeToday}
              freeDays={insights.moneyStory.freeDays}
              taxWithheld={insights.moneyStory.taxWithheld}
              surplus={insights.moneyStory.surplus}
              enoughHistory={insights.moneyStory.enoughHistory}
              trailStage={determineTrailStage({
                hasAccounts: (snapshot.assets?.accounts?.totalValue ?? 0) > 0,
                monthlyCashflow: snapshot.cashflow.monthlyNetCashflow,
                emergencyFundMonths: insights.emergencyFund.monthsCovered,
                hasInvestments: (snapshot.investments?.totalValue ?? 0) > 0,
                healthScore: insights.healthScore.score,
              })}
            />
          )}

          {/* Phase 3: Linkage Health & Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {snapshot.linkageHealth && (
                <Link href="/dashboard/properties">
                  <LinkageHealthIndicator
                    data={calculateLinkageHealthStatus(
                      snapshot.linkageHealth.completenessScore,
                      snapshot.linkageHealth.orphanCount,
                      snapshot.linkageHealth.warnings?.length || 0
                    )}
                    showDetails
                  />
                </Link>
              )}
            </div>
            {/* Phase 4: Quick Actions */}
            <QuickActionsBar
              actions={[
                { label: 'Budget Analysis', href: '/dashboard/budget-analysis', icon: <Calculator className="h-3 w-3" /> },
                { label: 'Debt Planner', href: '/dashboard/debt-planner', icon: <Target className="h-3 w-3" /> },
              ]}
            />
          </div>

          {/* Primary Metrics Row - Clickable for details with calculation tooltips */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div onClick={() => setSelectedDetail('netWorth')} className="cursor-pointer">
              <CalculationTooltip
                title="Net Worth Calculation"
                formula="Total Assets - Total Liabilities"
                components={[
                  { label: 'Properties', value: snapshot.assets.properties.totalValue, color: 'blue' },
                  { label: 'Accounts', value: snapshot.assets.accounts.totalValue, color: 'green', operator: '+' },
                  { label: 'Investments', value: snapshot.assets.investments.totalValue, color: 'purple', operator: '+' },
                  { label: 'Personal Assets', value: snapshot.assets.personalAssets?.totalValue || 0, operator: '+' },
                  { label: 'Loans', value: snapshot.totalLiabilities, color: 'red', operator: '-' },
                ]}
                result={snapshot.netWorth}
                resultLabel="Net Worth"
              >
                <StatCard
                  title="Net Worth"
                  value={formatCompactCurrency(snapshot.netWorth)}
                  description={`${formatCompactCurrency(snapshot.totalAssets)} assets - ${formatCompactCurrency(snapshot.totalLiabilities)} debt`}
                  icon={Wallet}
                  variant="purple"
                />
              </CalculationTooltip>
            </div>
            <div className="relative">
              <div onClick={() => setSelectedDetail('cashflow')} className="cursor-pointer">
                <CalculationTooltip
                  title="Cash Flow Calculation"
                  formula="Income - Expenses - Loan Repayments"
                  components={[
                    { label: 'Total Income', value: snapshot.cashflow.totalIncome, color: 'green' },
                    { label: 'Total Expenses', value: snapshot.cashflow.totalExpenses, color: 'red', operator: '-' },
                    { label: 'Loan Repayments', value: snapshot.cashflow.totalLoanRepayments || 0, color: 'red', operator: '-' },
                  ]}
                  result={snapshot.cashflow.annualNetCashflow}
                  resultLabel="Annual Cash Flow"
                >
                  <StatCard
                    title={cashflowPeriod === 'monthly' ? 'Monthly Cash Flow' : 'Annual Cash Flow'}
                    value={formatCurrency(
                      cashflowPeriod === 'monthly'
                        ? snapshot.cashflow.monthlyNetCashflow
                        : snapshot.cashflow.annualNetCashflow
                    )}
                    description={
                      cashflowPeriod === 'monthly'
                        ? `${formatCurrency(snapshot.cashflow.annualNetCashflow)}/year`
                        : `${formatCurrency(snapshot.cashflow.monthlyNetCashflow)}/month`
                    }
                    icon={snapshot.cashflow.monthlyNetCashflow >= 0 ? ArrowUpRight : ArrowDownRight}
                    variant={snapshot.cashflow.monthlyNetCashflow >= 0 ? 'green' : 'orange'}
                  />
                </CalculationTooltip>
              </div>
              {/* Period Toggle */}
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCashflowPeriod(cashflowPeriod === 'monthly' ? 'annual' : 'monthly');
                  }}
                  className="text-xs px-2 py-1 rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-colors shadow-sm"
                >
                  {cashflowPeriod === 'monthly' ? '/mo' : '/yr'}
                </button>
              </div>
            </div>
            <div onClick={() => setSelectedDetail('income')} className="cursor-pointer">
              <CalculationTooltip
                title="Annual Income"
                formula="All income sources combined"
                components={[
                  { label: 'Salary/Wages', value: snapshot.cashflow.totalIncome * 0.7, color: 'green' },
                  { label: 'Rental Income', value: snapshot.cashflow.totalIncome * 0.2, color: 'blue', operator: '+' },
                  { label: 'Other Income', value: snapshot.cashflow.totalIncome * 0.1, color: 'purple', operator: '+' },
                ]}
                result={snapshot.cashflow.totalIncome}
                resultLabel="Total Annual Income"
              >
                <StatCard
                  title="Annual Income"
                  value={formatCompactCurrency(snapshot.cashflow.totalIncome)}
                  description={`${formatCurrency(snapshot.cashflow.totalIncome / 12)}/month`}
                  icon={TrendingUp}
                  variant="green"
                />
              </CalculationTooltip>
            </div>
            <div onClick={() => setSelectedDetail('outgoings')} className="cursor-pointer">
              <CalculationTooltip
                title="Annual Outgoings"
                formula="Expenses + Loan Repayments"
                components={[
                  { label: 'Expenses', value: snapshot.cashflow.totalExpenses, color: 'red' },
                  { label: 'Loan Repayments', value: snapshot.cashflow.totalLoanRepayments || 0, color: 'red', operator: '+' },
                ]}
                result={snapshot.cashflow.totalExpenses + (snapshot.cashflow.totalLoanRepayments || 0)}
                resultLabel="Total Annual Outgoings"
              >
                <StatCard
                  title="Annual Outgoings"
                  value={formatCompactCurrency(snapshot.cashflow.totalExpenses + (snapshot.cashflow.totalLoanRepayments || 0))}
                  description={`${formatCurrency((snapshot.cashflow.totalExpenses + (snapshot.cashflow.totalLoanRepayments || 0)) / 12)}/month`}
                  icon={ArrowDownRight}
                  variant="orange"
                />
              </CalculationTooltip>
            </div>
            <div onClick={() => setSelectedDetail('savingsRate')} className="cursor-pointer">
              <CalculationTooltip
                title="Savings Rate Calculation"
                formula="(Net Cashflow ÷ Net Income) × 100%"
                components={[
                  { label: 'Annual Net Income', value: snapshot.cashflow.totalIncome, color: 'green' },
                  { label: 'Annual Expenses', value: snapshot.cashflow.totalExpenses, color: 'red', operator: '-' },
                  { label: 'Loan Repayments', value: snapshot.cashflow.totalLoanRepayments || 0, color: 'red', operator: '-' },
                ]}
                result={snapshot.cashflow.annualNetCashflow}
                resultLabel="Annual Savings"
              >
                <StatCard
                  title="Savings Rate"
                  value={`${snapshot.cashflow.savingsRate.toFixed(1)}%`}
                  description={`${formatCurrency(snapshot.cashflow.annualNetCashflow)}/year saved`}
                  icon={PiggyBank}
                  variant="teal"
                />
              </CalculationTooltip>
            </div>
            <div onClick={() => setSelectedDetail('lvr')} className="cursor-pointer">
              <CalculationTooltip
                title="Portfolio LVR Calculation"
                formula="(Total Debt ÷ Total Assets) × 100%"
                components={[
                  { label: 'Total Debt', value: snapshot.totalLiabilities, color: 'red' },
                  { label: 'Total Assets', value: snapshot.totalAssets, color: 'green', operator: '÷' },
                ]}
                result={snapshot.gearing.portfolioLVR}
                resultLabel="LVR %"
              >
                <StatCard
                  title="Portfolio LVR"
                  value={`${snapshot.gearing.portfolioLVR.toFixed(1)}%`}
                  description={`Debt: ${formatCompactCurrency(snapshot.totalLiabilities)}`}
                  icon={Percent}
                  variant={snapshot.gearing.portfolioLVR > 80 ? 'orange' : 'blue'}
                />
              </CalculationTooltip>
            </div>
          </div>

          {/* Financial Health & Insights Section */}
          {insights && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Financial Health Score */}
              <FinancialHealthScore
                score={insights.healthScore.score}
                grade={insights.healthScore.grade}
                breakdown={insights.healthScore.breakdown}
              />

              {/* Emergency Fund Tracker */}
              <EmergencyFundTracker
                liquidCash={insights.emergencyFund.liquidCash}
                monthlyExpenses={insights.emergencyFund.monthlyExpenses}
                monthsCovered={insights.emergencyFund.monthsCovered}
                target={insights.emergencyFund.target}
                status={insights.emergencyFund.status}
                gap={insights.emergencyFund.gap}
              />
            </div>
          )}

          {/* Phase 1: Debt Quality & Entity Cashflow Section */}
          {snapshot.loans && snapshot.loans.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Debt Quality Widget - Good vs Bad Debt */}
              <DebtQualityWidget
                data={calculateDebtQuality(snapshot.loans)}
              />

              {/* Entity Cashflow Summary */}
              <EntityCashflowSummary
                data={calculateEntityCashflow(
                  snapshot.properties,
                  snapshot.investments.accounts,
                  snapshot.loans,
                  snapshot.personalAssets?.items || [],
                  snapshot.income || [],
                  snapshot.expenses || []
                )}
              />
            </div>
          )}

          {/* Show Entity Cashflow even without loans (for properties/investments) */}
          {(!snapshot.loans || snapshot.loans.length === 0) && (snapshot.properties.length > 0 || snapshot.investments.accounts.length > 0) && (
            <EntityCashflowSummary
              data={calculateEntityCashflow(
                snapshot.properties,
                snapshot.investments.accounts,
                snapshot.loans || [],
                snapshot.personalAssets?.items || [],
                snapshot.income || [],
                snapshot.expenses || []
              )}
            />
          )}

          {/* Phase 3 & 4: Net Worth Trend & Entity Comparison */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Phase 3: Net Worth Trend */}
            <NetWorthTrend
              data={generateNetWorthTrendData(
                snapshot.netWorth,
                snapshot.cashflow.monthlyNetCashflow
              )}
            />

            {/* Phase 4: Entity Comparison Chart */}
            {(snapshot.properties.length > 0 || (snapshot.loans && snapshot.loans.length > 0)) && (
              <EntityComparisonChart
                items={buildEntityComparisonData(
                  snapshot.properties,
                  snapshot.investments.accounts.map(acc => ({
                    name: acc.name,
                    monthlyIncome: snapshot.income
                      ? calculateInvestmentIncome(acc.id, snapshot.income).totalMonthlyIncome
                      : 0,
                  })),
                  snapshot.loans?.map(loan => ({
                    name: loan.name,
                    netCashflowImpact: (loan.annualRepayment || 0) / 12,
                    type: loan.type, // Include type to filter out property-linked loans
                  })) || []
                )}
              />
            )}
          </div>

          {/* Actionable Insights & Budget Section */}
          {insights && insights.insights.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* What You Should Know - Actionable Insights */}
              <div className="lg:col-span-2">
                <ActionableInsights insights={insights.insights} />
              </div>

              {/* Monthly Budget Summary */}
              <MonthlyBudgetSummary
                income={insights.monthlyBudget.income}
                essentialExpenses={insights.monthlyBudget.essentialExpenses}
                discretionaryExpenses={insights.monthlyBudget.discretionaryExpenses}
                loanPayments={insights.monthlyBudget.loanPayments}
                remaining={insights.monthlyBudget.remaining}
                dailyBudget={insights.monthlyBudget.dailyBudget}
              />
            </div>
          )}

          {/* Spending Analysis Section */}
          {insights && insights.moneyBleeding.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Where Your Money Goes */}
              <MoneyBleedingCard
                items={insights.moneyBleeding}
                monthlyIncome={insights.monthlyBudget.income}
              />

              {/* Spending by Category */}
              <SpendingByCategory categories={insights.spendingByCategory} />
            </div>
          )}

          {/* Two Column Layout: Charts & Insights */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Asset Allocation Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Asset Allocation
                </CardTitle>
                <CardDescription>Distribution of your total assets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <DonutChart data={getAssetAllocationData()} size={180} strokeWidth={25} />
                  <div className="flex-1 space-y-4 w-full">
                    {/* Properties */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="text-sm font-medium">Properties</span>
                        </div>
                        <span className="text-sm font-semibold">{formatCompactCurrency(snapshot.assets.properties.totalValue)}</span>
                      </div>
                      <ProgressBar
                        value={snapshot.assets.properties.totalValue}
                        max={snapshot.totalAssets}
                        color="bg-blue-500"
                      />
                    </div>

                    {/* Cash Accounts */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span className="text-sm font-medium">Cash & Accounts</span>
                        </div>
                        <span className="text-sm font-semibold">{formatCompactCurrency(snapshot.assets.accounts.totalValue)}</span>
                      </div>
                      <ProgressBar
                        value={snapshot.assets.accounts.totalValue}
                        max={snapshot.totalAssets}
                        color="bg-green-500"
                      />
                    </div>

                    {/* Investments */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-purple-500" />
                          <span className="text-sm font-medium">Investments</span>
                        </div>
                        <span className="text-sm font-semibold">{formatCompactCurrency(snapshot.assets.investments.totalValue)}</span>
                      </div>
                      <ProgressBar
                        value={snapshot.assets.investments.totalValue}
                        max={snapshot.totalAssets}
                        color="bg-purple-500"
                      />
                    </div>

                    {/* Personal Assets */}
                    {snapshot.assets.personalAssets && snapshot.assets.personalAssets.count > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-500" />
                            <span className="text-sm font-medium">Personal Assets</span>
                          </div>
                          <span className="text-sm font-semibold">{formatCompactCurrency(snapshot.assets.personalAssets.totalValue)}</span>
                        </div>
                        <ProgressBar
                          value={snapshot.assets.personalAssets.totalValue}
                          max={snapshot.totalAssets}
                          color="bg-orange-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Insights Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Insights
                </CardTitle>
                <CardDescription>Key observations about your portfolio</CardDescription>
              </CardHeader>
              <CardContent>
                {portfolioInsights.length > 0 ? (
                  <div className="space-y-3">
                    {portfolioInsights.map((insight, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-3 p-3 rounded-lg ${
                          insight.type === 'success'
                            ? 'bg-green-50 dark:bg-green-950/30'
                            : insight.type === 'warning'
                            ? 'bg-orange-50 dark:bg-orange-950/30'
                            : 'bg-blue-50 dark:bg-blue-950/30'
                        }`}
                      >
                        <insight.icon
                          className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                            insight.type === 'success'
                              ? 'text-green-600 dark:text-green-400'
                              : insight.type === 'warning'
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}
                        />
                        <p className="text-sm">{insight.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Add more financial data to receive personalized insights.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Property & Investment Detail Panels */}
          <Tabs defaultValue="properties" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
              <TabsTrigger value="properties" className="gap-2">
                <Building2 className="h-4 w-4" />
                Properties ({snapshot.properties.length})
              </TabsTrigger>
              <TabsTrigger value="investments" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Investments ({snapshot.investments.accounts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="properties" className="mt-4">
              {snapshot.properties.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {snapshot.properties.map(property => (
                    <Card key={property.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{property.name}</CardTitle>
                            <Badge variant="outline" className="mt-1">{property.type}</Badge>
                          </div>
                          <Link href="/dashboard/properties">
                            <Button variant="ghost" size="icon">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Market Value</p>
                            <p className="font-semibold">{formatCompactCurrency(property.marketValue)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Equity</p>
                            <p className="font-semibold text-green-600 dark:text-green-400">
                              {formatCompactCurrency(property.equity)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">LVR</p>
                            <p className={`font-semibold ${property.lvr > 80 ? 'text-orange-600' : ''}`}>
                              {property.lvr.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Rental Yield</p>
                            <p className="font-semibold">{property.rentalYield.toFixed(1)}%</p>
                          </div>
                        </div>
                        {property.cashflow.monthlyNet !== 0 && (
                          <div className="mt-4 pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Monthly Cash Flow</span>
                              <span className={`font-semibold ${property.cashflow.monthlyNet >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                                {formatCurrency(property.cashflow.monthlyNet)}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="text-center py-8">
                  <CardContent>
                    <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">No Properties</h3>
                    <p className="text-sm text-muted-foreground mb-4">Add your first property to track equity and rental performance.</p>
                    <Link href="/dashboard/properties">
                      <Button>Add Property</Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="investments" className="mt-4">
              {snapshot.investments.accounts.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {snapshot.investments.accounts.map(account => (
                    <Card key={account.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{account.name}</CardTitle>
                            <Badge variant="outline" className="mt-1">{account.type}</Badge>
                          </div>
                          <Link href="/dashboard/investments/accounts">
                            <Button variant="ghost" size="icon">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-3">
                          <p className="text-2xl font-bold">{formatCompactCurrency(account.totalValue)}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">{account.holdings.length} holding{account.holdings.length !== 1 ? 's' : ''}</p>
                            {/* Phase 2: Investment Income Display */}
                            {snapshot.income && (
                              <InvestmentIncomeDisplay
                                data={calculateInvestmentIncome(account.id, snapshot.income)}
                                compact
                              />
                            )}
                          </div>
                        </div>
                        {account.holdings.length > 0 && (
                          <div className="space-y-2">
                            {account.holdings.slice(0, 3).map((holding, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">{holding.ticker}</Badge>
                                  <span className="text-muted-foreground text-xs">{holding.type}</span>
                                </div>
                                <span className="font-medium">{formatCompactCurrency(holding.currentValue)}</span>
                              </div>
                            ))}
                            {account.holdings.length > 3 && (
                              <p className="text-xs text-muted-foreground">+{account.holdings.length - 3} more</p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="text-center py-8">
                  <CardContent>
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">No Investment Accounts</h3>
                    <p className="text-sm text-muted-foreground mb-4">Add your brokerage accounts to track shares and ETFs.</p>
                    <Link href="/dashboard/investments/accounts">
                      <Button>Add Investment Account</Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Detail Breakdown Dialog */}
          <Dialog open={selectedDetail !== null} onOpenChange={() => setSelectedDetail(null)}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              {selectedDetail === 'netWorth' && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-purple-600" />
                      Net Worth Breakdown
                    </DialogTitle>
                    <DialogDescription>
                      Your total assets minus total liabilities
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    {/* Summary */}
                    <div className="text-center p-6 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Total Net Worth</p>
                      <p className="text-4xl font-bold text-purple-700 dark:text-purple-400">
                        {formatCurrency(snapshot.netWorth)}
                      </p>
                    </div>

                    {/* Assets Breakdown */}
                    <div>
                      <h4 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Total Assets: {formatCurrency(snapshot.totalAssets)}
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-blue-600" />
                            <span>Properties ({snapshot.assets.properties.count})</span>
                          </div>
                          <span className="font-semibold">{formatCurrency(snapshot.assets.properties.totalValue)}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-green-600" />
                            <span>Cash & Accounts ({snapshot.assets.accounts.count})</span>
                          </div>
                          <span className="font-semibold">{formatCurrency(snapshot.assets.accounts.totalValue)}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-purple-600" />
                            <span>Investments ({snapshot.assets.investments.count})</span>
                          </div>
                          <span className="font-semibold">{formatCurrency(snapshot.assets.investments.totalValue)}</span>
                        </div>
                        {snapshot.assets.personalAssets && snapshot.assets.personalAssets.count > 0 && (
                          <div className="flex justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-orange-600" />
                              <span>Personal Assets ({snapshot.assets.personalAssets.count})</span>
                            </div>
                            <span className="font-semibold">{formatCurrency(snapshot.assets.personalAssets.totalValue)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Liabilities Breakdown */}
                    <div>
                      <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4" />
                        Total Liabilities: {formatCurrency(snapshot.totalLiabilities)}
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Landmark className="h-4 w-4 text-orange-600" />
                            <span>Loans ({snapshot.liabilities.loans.count})</span>
                          </div>
                          <span className="font-semibold">{formatCurrency(snapshot.liabilities.loans.totalValue)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedDetail === 'cashflow' && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      {snapshot.cashflow.monthlyNetCashflow >= 0 ? (
                        <ArrowUpRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5 text-orange-600" />
                      )}
                      Cash Flow Breakdown
                    </DialogTitle>
                    <DialogDescription>
                      Income minus expenses minus loan repayments
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    {/* Period Toggle */}
                    <div className="flex justify-center">
                      <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
                        <button
                          onClick={() => setCashflowPeriod('monthly')}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            cashflowPeriod === 'monthly'
                              ? 'bg-white dark:bg-gray-800 shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Monthly
                        </button>
                        <button
                          onClick={() => setCashflowPeriod('annual')}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            cashflowPeriod === 'annual'
                              ? 'bg-white dark:bg-gray-800 shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Annual
                        </button>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className={`text-center p-6 rounded-lg ${snapshot.cashflow.monthlyNetCashflow >= 0 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                      <p className="text-sm text-muted-foreground mb-1">
                        {cashflowPeriod === 'monthly' ? 'Monthly' : 'Annual'} Net Cash Flow
                      </p>
                      <p className={`text-4xl font-bold ${snapshot.cashflow.monthlyNetCashflow >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {formatCurrency(
                          cashflowPeriod === 'monthly'
                            ? snapshot.cashflow.monthlyNetCashflow
                            : snapshot.cashflow.annualNetCashflow
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {cashflowPeriod === 'monthly'
                          ? `${formatCurrency(snapshot.cashflow.annualNetCashflow)}/year`
                          : `${formatCurrency(snapshot.cashflow.monthlyNetCashflow)}/month`
                        }
                      </p>
                    </div>

                    {/* Cash Flow Calculation */}
                    <div className="space-y-3">
                      {/* Income */}
                      <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                            <span className="font-medium">
                              {cashflowPeriod === 'monthly' ? 'Monthly' : 'Annual'} Income
                            </span>
                          </div>
                          <span className="text-xl font-bold text-green-700 dark:text-green-400">
                            +{formatCurrency(
                              cashflowPeriod === 'monthly'
                                ? snapshot.cashflow.totalIncome / 12
                                : snapshot.cashflow.totalIncome
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {cashflowPeriod === 'monthly'
                            ? `${formatCurrency(snapshot.cashflow.totalIncome)}/year`
                            : `${formatCurrency(snapshot.cashflow.totalIncome / 12)}/month`
                          }
                        </p>
                        {snapshot.income && snapshot.income.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 space-y-2">
                            {snapshot.income.slice(0, 5).map((inc) => (
                              <div key={inc.id} className="flex justify-between text-sm">
                                <span className="text-muted-foreground truncate max-w-[200px]">
                                  {inc.name}
                                  {inc.propertyName && <span className="text-xs"> ({inc.propertyName})</span>}
                                </span>
                                <span>
                                  {formatCurrency(
                                    cashflowPeriod === 'monthly'
                                      ? inc.netAnnual / 12
                                      : inc.netAnnual
                                  )}/{cashflowPeriod === 'monthly' ? 'mo' : 'yr'}
                                </span>
                              </div>
                            ))}
                            {snapshot.income.length > 5 && (
                              <p className="text-xs text-muted-foreground">
                                +{snapshot.income.length - 5} more income sources
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expenses */}
                      <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-red-600" />
                            <span className="font-medium">
                              {cashflowPeriod === 'monthly' ? 'Monthly' : 'Annual'} Expenses
                            </span>
                          </div>
                          <span className="text-xl font-bold text-red-700 dark:text-red-400">
                            -{formatCurrency(
                              cashflowPeriod === 'monthly'
                                ? snapshot.cashflow.totalExpenses / 12
                                : snapshot.cashflow.totalExpenses
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {cashflowPeriod === 'monthly'
                            ? `${formatCurrency(snapshot.cashflow.totalExpenses)}/year`
                            : `${formatCurrency(snapshot.cashflow.totalExpenses / 12)}/month`
                          }
                        </p>
                        {snapshot.expenses && snapshot.expenses.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800 space-y-2">
                            {snapshot.expenses.slice(0, 5).map((expense) => (
                              <div key={expense.id} className="flex justify-between text-sm">
                                <span className="text-muted-foreground truncate max-w-[200px]">
                                  {expense.name}
                                  {expense.propertyName && <span className="text-xs"> ({expense.propertyName})</span>}
                                </span>
                                <span>
                                  {formatCurrency(
                                    cashflowPeriod === 'monthly'
                                      ? expense.annualAmount / 12
                                      : expense.annualAmount
                                  )}/{cashflowPeriod === 'monthly' ? 'mo' : 'yr'}
                                </span>
                              </div>
                            ))}
                            {snapshot.expenses.length > 5 && (
                              <p className="text-xs text-muted-foreground">
                                +{snapshot.expenses.length - 5} more expenses
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Loan Repayments */}
                      <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Landmark className="h-5 w-5 text-orange-600" />
                            <span className="font-medium">
                              {cashflowPeriod === 'monthly' ? 'Monthly' : 'Annual'} Loan Repayments
                            </span>
                          </div>
                          <span className="text-xl font-bold text-orange-700 dark:text-orange-400">
                            -{formatCurrency(
                              cashflowPeriod === 'monthly'
                                ? (snapshot.cashflow.totalLoanRepayments || 0) / 12
                                : (snapshot.cashflow.totalLoanRepayments || 0)
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {cashflowPeriod === 'monthly'
                            ? `${formatCurrency(snapshot.cashflow.totalLoanRepayments || 0)}/year`
                            : `${formatCurrency((snapshot.cashflow.totalLoanRepayments || 0) / 12)}/month`
                          }
                        </p>
                        {snapshot.loans && snapshot.loans.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800 space-y-2">
                            {snapshot.loans.map((loan) => (
                              <div key={loan.id} className="flex justify-between text-sm">
                                <span className="text-muted-foreground truncate max-w-[200px]">
                                  {loan.name}
                                  {loan.propertyName && <span className="text-xs"> ({loan.propertyName})</span>}
                                </span>
                                <span>
                                  {formatCurrency(
                                    cashflowPeriod === 'monthly'
                                      ? (loan.annualRepayment || 0) / 12
                                      : (loan.annualRepayment || 0)
                                  )}/{cashflowPeriod === 'monthly' ? 'mo' : 'yr'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Net Result */}
                      <div className={`p-4 rounded-lg border-2 ${snapshot.cashflow.monthlyNetCashflow >= 0 ? 'border-green-500 bg-green-100 dark:bg-green-950/50' : 'border-red-500 bg-red-100 dark:bg-red-950/50'}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">
                            = {cashflowPeriod === 'monthly' ? 'Monthly' : 'Annual'} Net Cash Flow
                          </span>
                          <span className={`text-xl font-bold ${snapshot.cashflow.monthlyNetCashflow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {formatCurrency(
                              cashflowPeriod === 'monthly'
                                ? snapshot.cashflow.monthlyNetCashflow
                                : snapshot.cashflow.annualNetCashflow
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedDetail === 'savingsRate' && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <PiggyBank className="h-5 w-5 text-teal-600" />
                      Savings Rate Breakdown
                    </DialogTitle>
                    <DialogDescription>
                      Percentage of income saved after all expenses and loan repayments
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    {/* Summary */}
                    <div className="text-center p-6 bg-teal-50 dark:bg-teal-950/30 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Savings Rate</p>
                      <p className="text-5xl font-bold text-teal-700 dark:text-teal-400">
                        {snapshot.cashflow.savingsRate.toFixed(1)}%
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        of net income
                      </p>
                    </div>

                    {/* Calculation */}
                    <div className="space-y-3">
                      <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                        <span>Annual Net Income</span>
                        <span className="font-semibold">{formatCurrency(snapshot.cashflow.totalIncome)}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                        <span>Annual Expenses</span>
                        <span className="font-semibold text-red-600">-{formatCurrency(snapshot.cashflow.totalExpenses)}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                        <span>Annual Loan Repayments</span>
                        <span className="font-semibold text-orange-600">-{formatCurrency(snapshot.cashflow.totalLoanRepayments || 0)}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-teal-100 dark:bg-teal-950/50 rounded-lg border-2 border-teal-500">
                        <span className="font-semibold">= Annual Savings</span>
                        <span className="font-bold text-teal-700 dark:text-teal-400">{formatCurrency(snapshot.cashflow.annualNetCashflow)}</span>
                      </div>
                    </div>

                    {/* Benchmarks */}
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium mb-3">Savings Rate Benchmarks</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${snapshot.cashflow.savingsRate >= 20 ? 'bg-green-500' : 'bg-muted'}`} />
                          <span className={snapshot.cashflow.savingsRate >= 20 ? 'font-medium' : 'text-muted-foreground'}>
                            20%+ Excellent
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${snapshot.cashflow.savingsRate >= 10 && snapshot.cashflow.savingsRate < 20 ? 'bg-yellow-500' : 'bg-muted'}`} />
                          <span className={snapshot.cashflow.savingsRate >= 10 && snapshot.cashflow.savingsRate < 20 ? 'font-medium' : 'text-muted-foreground'}>
                            10-20% Good
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${snapshot.cashflow.savingsRate >= 0 && snapshot.cashflow.savingsRate < 10 ? 'bg-orange-500' : 'bg-muted'}`} />
                          <span className={snapshot.cashflow.savingsRate >= 0 && snapshot.cashflow.savingsRate < 10 ? 'font-medium' : 'text-muted-foreground'}>
                            0-10% Needs Improvement
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${snapshot.cashflow.savingsRate < 0 ? 'bg-red-500' : 'bg-muted'}`} />
                          <span className={snapshot.cashflow.savingsRate < 0 ? 'font-medium' : 'text-muted-foreground'}>
                            Below 0% Spending More Than Earning
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedDetail === 'lvr' && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Percent className="h-5 w-5 text-blue-600" />
                      Loan-to-Value Ratio (LVR) Breakdown
                    </DialogTitle>
                    <DialogDescription>
                      Total debt as a percentage of total assets
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    {/* Summary */}
                    <div className={`text-center p-6 rounded-lg ${snapshot.gearing.portfolioLVR > 80 ? 'bg-orange-50 dark:bg-orange-950/30' : snapshot.gearing.portfolioLVR > 60 ? 'bg-yellow-50 dark:bg-yellow-950/30' : 'bg-green-50 dark:bg-green-950/30'}`}>
                      <p className="text-sm text-muted-foreground mb-1">Portfolio LVR</p>
                      <p className={`text-5xl font-bold ${snapshot.gearing.portfolioLVR > 80 ? 'text-orange-700 dark:text-orange-400' : snapshot.gearing.portfolioLVR > 60 ? 'text-yellow-700 dark:text-yellow-400' : 'text-green-700 dark:text-green-400'}`}>
                        {snapshot.gearing.portfolioLVR.toFixed(1)}%
                      </p>
                    </div>

                    {/* Calculation */}
                    <div className="space-y-3">
                      <div className="flex justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <span>Total Debt (Loans)</span>
                        <span className="font-semibold text-red-600">{formatCurrency(snapshot.totalLiabilities)}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <span>Total Assets</span>
                        <span className="font-semibold text-green-600">{formatCurrency(snapshot.totalAssets)}</span>
                      </div>
                      <div className="p-3 bg-blue-100 dark:bg-blue-950/50 rounded-lg border-2 border-blue-500">
                        <div className="flex justify-between">
                          <span className="font-semibold">= LVR (Debt ÷ Assets × 100)</span>
                          <span className="font-bold text-blue-700 dark:text-blue-400">{snapshot.gearing.portfolioLVR.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Equity */}
                    <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total Equity (Assets - Debt)</span>
                        <span className="text-xl font-bold text-purple-700 dark:text-purple-400">
                          {formatCurrency(snapshot.totalAssets - snapshot.totalLiabilities)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {((snapshot.totalAssets - snapshot.totalLiabilities) / snapshot.totalAssets * 100).toFixed(1)}% of assets
                      </p>
                    </div>

                    {/* Property-level LVRs */}
                    {snapshot.properties.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">Property LVRs</h4>
                        <div className="space-y-2">
                          {snapshot.properties.map((property) => (
                            <div key={property.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                              <div>
                                <p className="font-medium">{property.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Value: {formatCurrency(property.marketValue)} | Equity: {formatCurrency(property.equity)}
                                </p>
                              </div>
                              <span className={`font-bold ${property.lvr > 80 ? 'text-red-600' : property.lvr > 60 ? 'text-yellow-600' : 'text-green-600'}`}>
                                {property.lvr.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* LVR Benchmarks */}
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium mb-3">LVR Risk Levels</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${snapshot.gearing.portfolioLVR <= 60 ? 'bg-green-500' : 'bg-muted'}`} />
                          <span className={snapshot.gearing.portfolioLVR <= 60 ? 'font-medium' : 'text-muted-foreground'}>
                            ≤60% Conservative (Low Risk)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${snapshot.gearing.portfolioLVR > 60 && snapshot.gearing.portfolioLVR <= 80 ? 'bg-yellow-500' : 'bg-muted'}`} />
                          <span className={snapshot.gearing.portfolioLVR > 60 && snapshot.gearing.portfolioLVR <= 80 ? 'font-medium' : 'text-muted-foreground'}>
                            60-80% Moderate (Medium Risk)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${snapshot.gearing.portfolioLVR > 80 ? 'bg-red-500' : 'bg-muted'}`} />
                          <span className={snapshot.gearing.portfolioLVR > 80 ? 'font-medium' : 'text-muted-foreground'}>
                            &gt;80% High Leverage (High Risk, may require LMI)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </DashboardLayout>
  );
}
