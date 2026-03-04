'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Shield,
  Target,
  Zap,
  ChevronRight,
  RefreshCw,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Calendar,
  Receipt,
  Percent,
  Banknote,
  TrendingDown as TrendDown,
  Home,
  Briefcase,
  PieChart,
  Sparkles,
  Activity,
  ExternalLink,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

interface CFOScore {
  overall: number;
  components: {
    cashflowStrength: number;
    debtCoverage: number;
    emergencyBuffer: number;
    investmentDiversification: number;
    spendingControl: number;
    savingsRate: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

interface Risk {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timeframe: 'short' | 'medium' | 'long';
  title: string;
  description: string;
  impact: number;
  suggestedActions: string[];
}

interface Action {
  id: string;
  priority: 'do_now' | 'upcoming' | 'consider_soon' | 'background';
  category: string;
  title: string;
  explanation: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  expectedImpact: {
    type: string;
    amount: number;
    timeframe: string;
    description: string;
  };
  timeRequired: string;
}

interface MonthlyProgress {
  netWorthChange: number;
  netWorthChangePercent: number;
  savingsRate: number;
  savingsRateChange: number;
  debtReduction: number;
  topImprovements: string[];
  emergingRisks: string[];
}

interface TaxInsights {
  taxPositionSnapshot: {
    estimatedRefund: number;
    confidenceLevel: number;
    daysUntilEOFY: number;
    actionRequiredBeforeEOFY: boolean;
    financialYear: string;
  };
  deductionsSummary: {
    totalDeductions: number;
    propertyDeductions: number;
    investmentDeductions: number;
    workRelatedDeductions: number;
    depreciationDeductions: number;
    potentialMissedDeductions: string[];
  };
  keyTaxMetrics: {
    effectiveTaxRate: number;
    marginalRate: number;
    negativeGearingBenefit: number;
    frankingCreditsAvailable: number;
    unrealisedCGT: number;
    paygWithheld: number;
  };
}

interface RefinanceOpportunity {
  loanId: string;
  loanName: string;
  loanType: string;
  currentRate: number;
  marketRate: number;
  monthlySavings: number;
  annualSavings: number;
  worthRefinancing: boolean;
}

interface RateAlert {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  loanName: string;
  title: string;
  description: string;
  daysUntil?: number;
  impact: number;
  action: string;
}

interface ExtraRepaymentImpact {
  extraMonthly: number;
  interestSaved: number;
  timeReduced: number;
  targetLoanName: string;
}

interface LoanInsights {
  refinanceOpportunities: RefinanceOpportunity[];
  totalRefinanceSavings: number;
  rateAlerts: RateAlert[];
  extraRepaymentImpact: ExtraRepaymentImpact | null;
  loanRisks: { type: string; severity: string; title: string; description: string; impact: number }[];
  metadata: {
    loanCount: number;
    hasOffsetAccounts: boolean;
  };
}

interface PropertyAlert {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  propertyName: string;
  title: string;
  description: string;
  value: number;
  action: string;
}

interface PropertyPerformance {
  propertyName: string;
  metric: string;
  value: number;
  description: string;
}

interface PropertyInsights {
  portfolioSummary: {
    totalProperties: number;
    totalValue: number;
    totalEquity: number;
    averageLVR: number;
    totalMonthlyIncome: number;
    totalMonthlyCashflow: number;
  };
  propertyAlerts: PropertyAlert[];
  topPerformer: PropertyPerformance | null;
  underperformer: PropertyPerformance | null;
  metadata: { propertyCount: number };
}

interface InvestmentAlert {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  holdingName?: string;
  title: string;
  description: string;
  value: number;
  action: string;
}

interface InvestmentPerformance {
  holdingName: string;
  metric: string;
  value: number;
  description: string;
}

interface InvestmentInsights {
  portfolioSummary: {
    totalValue: number;
    totalCostBase: number;
    unrealisedGain: number;
    unrealisedGainPercent: number;
    holdingsCount: number;
    dividendYieldPercent: number;
  };
  allocationAnalysis: {
    currentAllocation: { assetType: string; value: number; percentage: number }[];
    driftFromTarget: number;
    concentrationRisk: {
      hasRisk: boolean;
      topHolding: string | null;
      topHoldingPercent: number;
    };
  };
  performanceMetrics: {
    totalReturn: number;
    totalReturnPercent: number;
    annualisedReturn: number | null;
    dividendIncome: number;
    frankingCredits: number;
    unrealisedCGT: number;
  };
  investmentAlerts: InvestmentAlert[];
  topPerformer: InvestmentPerformance | null;
  underperformer: InvestmentPerformance | null;
  metadata: { holdingsCount: number };
}

interface CFODashboardData {
  score: CFOScore;
  risks: { risks: Risk[]; summary: { critical: number; high: number; medium: number; low: number; totalImpact: number } };
  actions: { doNow: Action[]; upcoming: Action[]; considerSoon: Action[]; background: Action[]; totalActions: number };
  monthlyProgress: MonthlyProgress;
  quickStats: {
    daysUntilNextBill: number;
    projectedMonthEndBalance: number;
    unusedSubscriptions: number;
    savingsOpportunities: number;
    pendingActions: number;
  };
  alerts: { id: string; type: string; title: string; message: string }[];
  taxInsights?: TaxInsights;
  loanInsights?: LoanInsights;
  propertyInsights?: PropertyInsights;
  investmentInsights?: InvestmentInsights;
}

// Reusable Metric Card Component with hover effects
function MetricCard({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
  onClick,
  className = '',
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: any;
  trend?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800
        transition-all duration-300 ease-out
        hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-gray-900/50
        hover:border-gray-200 dark:hover:border-gray-700
        hover:-translate-y-0.5
        ${onClick ? 'cursor-pointer' : ''}
        ${className}`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {label}
        </span>
        {Icon && (
          <div className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 group-hover:bg-gray-100 dark:group-hover:bg-gray-700 transition-colors">
            <Icon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-xl font-bold tracking-tight ${
          trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
          trend === 'down' ? 'text-red-600 dark:text-red-400' :
          'text-gray-900 dark:text-gray-100'
        }`}>
          {value}
        </span>
        {trend && trend !== 'neutral' && (
          <span className={`flex items-center text-xs font-medium mb-0.5 ${
            trend === 'up' ? 'text-emerald-500' : 'text-red-500'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          </span>
        )}
      </div>
      {subValue && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subValue}</p>
      )}
      {onClick && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
        </div>
      )}
    </div>
  );
}

// Insight Tile Component - Main clickable tiles
function InsightTile({
  title,
  badge,
  badgeColor = 'gray',
  icon: Icon,
  iconColor,
  children,
  href,
  alertCount,
  className = '',
}: {
  title: string;
  badge?: string;
  badgeColor?: 'gray' | 'blue' | 'emerald' | 'violet' | 'amber' | 'rose';
  icon: any;
  iconColor: string;
  children: React.ReactNode;
  href?: string;
  alertCount?: number;
  className?: string;
}) {
  const router = useRouter();

  const colorClasses = {
    gray: 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800',
    blue: 'bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900 border-blue-100 dark:border-blue-900/50',
    emerald: 'bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-900 border-emerald-100 dark:border-emerald-900/50',
    violet: 'bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-gray-900 border-violet-100 dark:border-violet-900/50',
    amber: 'bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-900 border-amber-100 dark:border-amber-900/50',
    rose: 'bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/30 dark:to-gray-900 border-rose-100 dark:border-rose-900/50',
  };

  const iconBgClasses = {
    gray: 'bg-gray-100 dark:bg-gray-800',
    blue: 'bg-blue-100 dark:bg-blue-900/50',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/50',
    violet: 'bg-violet-100 dark:bg-violet-900/50',
    amber: 'bg-amber-100 dark:bg-amber-900/50',
    rose: 'bg-rose-100 dark:bg-rose-900/50',
  };

  const content = (
    <div
      className={`group relative rounded-2xl border p-5 transition-all duration-300 ease-out
        hover:shadow-xl hover:shadow-gray-200/40 dark:hover:shadow-gray-900/40
        hover:-translate-y-1 hover:border-opacity-70
        ${colorClasses[badgeColor]}
        ${href ? 'cursor-pointer' : ''}
        ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${iconBgClasses[badgeColor]} transition-transform group-hover:scale-105`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            {badge && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{badge}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alertCount !== undefined && alertCount > 0 && (
            <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0 text-xs px-2">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {alertCount}
            </Badge>
          )}
          {href && (
            <ChevronRight className="h-5 w-5 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-all group-hover:translate-x-0.5" />
          )}
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

// Score Ring Component
function ScoreRing({
  score,
  grade,
  size = 140,
  trend,
}: {
  score: number;
  grade: string;
  size?: number;
  trend?: 'improving' | 'stable' | 'declining';
}) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const gradeColors = {
    'A': { ring: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-600 dark:text-emerald-400' },
    'B': { ring: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-950/50', text: 'text-blue-600 dark:text-blue-400' },
    'C': { ring: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-600 dark:text-amber-400' },
    'D': { ring: '#f97316', bg: 'bg-orange-50 dark:bg-orange-950/50', text: 'text-orange-600 dark:text-orange-400' },
    'F': { ring: '#ef4444', bg: 'bg-red-50 dark:bg-red-950/50', text: 'text-red-600 dark:text-red-400' },
  };

  const colors = gradeColors[grade as keyof typeof gradeColors] || gradeColors['C'];

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-100 dark:text-gray-800"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.ring}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{score}</span>
        <span className={`text-sm font-semibold px-2 py-0.5 rounded-md ${colors.bg} ${colors.text}`}>
          Grade {grade}
        </span>
        {trend && (
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            {trend === 'improving' && <TrendingUp className="h-3 w-3 text-emerald-500" />}
            {trend === 'declining' && <TrendingDown className="h-3 w-3 text-red-500" />}
            {trend === 'stable' && <Activity className="h-3 w-3 text-gray-400" />}
            <span className="capitalize">{trend}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Score Component Bar
function ScoreBar({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: any;
}) {
  const getColor = (val: number) => {
    if (val >= 80) return 'bg-emerald-500';
    if (val >= 60) return 'bg-blue-500';
    if (val >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
          <Icon className="h-3 w-3" />
          <span>{label}</span>
        </div>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{value}/100</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// Risk Badge Component
function RiskBadge({
  count,
  severity,
  onClick,
}: {
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  onClick?: () => void;
}) {
  const colors = {
    critical: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 border-red-200 dark:border-red-900',
    high: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400 border-orange-200 dark:border-orange-900',
    medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    low: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 hover:scale-105 ${colors[severity]}`}
    >
      <span className="text-2xl font-bold">{count}</span>
      <span className="text-xs capitalize">{severity}</span>
    </button>
  );
}

export default function CFODashboardPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<CFODashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const response = await fetch('/api/cfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error loading CFO data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900';
      case 'high': return 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900';
      case 'medium': return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900';
      case 'low': return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900';
      default: return 'bg-gray-50 text-gray-800 border-gray-200 dark:bg-gray-950/50 dark:text-gray-300 dark:border-gray-800';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'do_now': return <Zap className="h-4 w-4 text-red-500" />;
      case 'upcoming': return <Clock className="h-4 w-4 text-orange-500" />;
      case 'consider_soon': return <Target className="h-4 w-4 text-blue-500" />;
      default: return <CheckCircle2 className="h-4 w-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="relative">
              <Brain className="h-16 w-16 mx-auto text-primary/30" />
              <Sparkles className="h-6 w-6 absolute top-0 right-1/3 text-primary animate-pulse" />
            </div>
            <p className="text-sm text-muted-foreground mt-4">Analyzing your finances...</p>
            <div className="flex items-center justify-center gap-1 mt-2">
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h3 className="font-semibold text-lg mb-2">Unable to load CFO dashboard</h3>
          <p className="text-muted-foreground text-sm mb-4">Please try again</p>
          <Button onClick={() => loadData()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const { score, risks, actions, monthlyProgress, quickStats, taxInsights, loanInsights, propertyInsights, investmentInsights } = data;

  return (
    <DashboardLayout>
      <PageHeader
        title="Personal CFO"
        description="Your AI-powered financial advisor monitoring your wealth 24/7"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Financial Health Score Hero Section */}
      <div className="mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-6 md:p-8">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative flex flex-col lg:flex-row items-center gap-8">
            {/* Score Ring */}
            <div className="flex-shrink-0">
              <ScoreRing score={score.overall} grade={score.grade} size={160} trend={score.trend} />
            </div>

            {/* Score Components Grid */}
            <div className="flex-1 w-full">
              <h3 className="text-white/80 text-sm font-medium mb-4">Health Score Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                <ScoreBar label="Cashflow" value={score.components.cashflowStrength} icon={DollarSign} />
                <ScoreBar label="Debt Coverage" value={score.components.debtCoverage} icon={Shield} />
                <ScoreBar label="Emergency Buffer" value={score.components.emergencyBuffer} icon={Shield} />
                <ScoreBar label="Diversification" value={score.components.investmentDiversification} icon={BarChart3} />
                <ScoreBar label="Spending Control" value={score.components.spendingControl} icon={Target} />
                <ScoreBar label="Savings Rate" value={score.components.savingsRate} icon={TrendingUp} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <MetricCard
          label="Pending Actions"
          value={quickStats.pendingActions}
          icon={Zap}
          onClick={() => document.getElementById('actions-section')?.scrollIntoView({ behavior: 'smooth' })}
        />
        <MetricCard
          label="Month-End Balance"
          value={formatCurrency(quickStats.projectedMonthEndBalance)}
          icon={DollarSign}
          onClick={() => router.push('/dashboard/accounts')}
        />
        <MetricCard
          label="Days to Next Bill"
          value={quickStats.daysUntilNextBill}
          icon={Calendar}
          onClick={() => router.push('/dashboard/expenses')}
        />
        <MetricCard
          label="Savings Opps"
          value={quickStats.savingsOpportunities}
          icon={Target}
          trend={quickStats.savingsOpportunities > 0 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="Unused Subs"
          value={quickStats.unusedSubscriptions}
          icon={AlertTriangle}
          trend={quickStats.unusedSubscriptions > 0 ? 'down' : 'neutral'}
          onClick={() => router.push('/dashboard/expenses')}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Tax Position Tile */}
        {taxInsights && (
          <InsightTile
            title="Tax Position"
            badge={`FY ${taxInsights.taxPositionSnapshot.financialYear}`}
            icon={Calculator}
            iconColor="text-blue-600 dark:text-blue-400"
            badgeColor="blue"
            href="/dashboard/tax"
            alertCount={taxInsights.taxPositionSnapshot.actionRequiredBeforeEOFY ? 1 : 0}
          >
            <div className="grid grid-cols-2 gap-3 mb-4">
              <MetricCard
                label="Estimated Position"
                value={formatCurrency(taxInsights.taxPositionSnapshot.estimatedRefund)}
                subValue={`${taxInsights.taxPositionSnapshot.estimatedRefund >= 0 ? 'Refund' : 'Owing'} (${taxInsights.taxPositionSnapshot.confidenceLevel}% conf.)`}
                trend={taxInsights.taxPositionSnapshot.estimatedRefund >= 0 ? 'up' : 'down'}
              />
              <MetricCard
                label="Days Until EOFY"
                value={taxInsights.taxPositionSnapshot.daysUntilEOFY}
                subValue={taxInsights.taxPositionSnapshot.daysUntilEOFY <= 30 ? 'Action window closing' : 'Days remaining'}
                icon={Calendar}
              />
              <MetricCard
                label="Effective Tax Rate"
                value={`${taxInsights.keyTaxMetrics.effectiveTaxRate.toFixed(1)}%`}
                subValue={`Marginal: ${taxInsights.keyTaxMetrics.marginalRate.toFixed(0)}%`}
                icon={Percent}
              />
              <MetricCard
                label="Total Deductions"
                value={formatCurrency(taxInsights.deductionsSummary.totalDeductions)}
                subValue="Reducing taxable income"
                trend="up"
              />
            </div>

            {/* Deductions Mini-Breakdown */}
            <div className="flex flex-wrap gap-2 mb-3">
              {taxInsights.deductionsSummary.propertyDeductions > 0 && (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  Property: {formatCurrency(taxInsights.deductionsSummary.propertyDeductions)}
                </span>
              )}
              {taxInsights.deductionsSummary.depreciationDeductions > 0 && (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  Depreciation: {formatCurrency(taxInsights.deductionsSummary.depreciationDeductions)}
                </span>
              )}
            </div>

            {/* Key Metrics */}
            {taxInsights.keyTaxMetrics.negativeGearingBenefit > 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Neg. Gearing Benefit: {formatCurrency(taxInsights.keyTaxMetrics.negativeGearingBenefit)}
              </div>
            )}

            {/* Missed Deductions Alert */}
            {taxInsights.deductionsSummary.potentialMissedDeductions.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
                  <AlertTriangle className="h-3 w-3" />
                  Potential Missed Deductions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {taxInsights.deductionsSummary.potentialMissedDeductions.map((item, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </InsightTile>
        )}

        {/* Loan Opportunities Tile */}
        {loanInsights && loanInsights.metadata.loanCount > 0 && (
          <InsightTile
            title="Loan Opportunities"
            badge={`${loanInsights.metadata.loanCount} loan${loanInsights.metadata.loanCount > 1 ? 's' : ''}`}
            icon={Banknote}
            iconColor="text-emerald-600 dark:text-emerald-400"
            badgeColor="emerald"
            href="/dashboard/debt"
            alertCount={loanInsights.rateAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length}
          >
            <div className="space-y-3">
              {/* Key Metrics Row */}
              <div className="grid grid-cols-2 gap-3">
                {loanInsights.extraRepaymentImpact && (
                  <MetricCard
                    label="Extra Repayment Benefit"
                    value={formatCurrency(loanInsights.extraRepaymentImpact.interestSaved)}
                    subValue={`Save ${Math.round(loanInsights.extraRepaymentImpact.timeReduced / 12)} years with +$${loanInsights.extraRepaymentImpact.extraMonthly}/mo`}
                    trend="up"
                  />
                )}
                {loanInsights.refinanceOpportunities.filter(r => r.worthRefinancing).length > 0 && (
                  <MetricCard
                    label="Refinance Savings"
                    value={`${formatCurrency(loanInsights.totalRefinanceSavings)}/yr`}
                    subValue={`${loanInsights.refinanceOpportunities.filter(r => r.worthRefinancing).length} opportunity found`}
                    trend="up"
                  />
                )}
              </div>

              {/* Rate Alerts */}
              {loanInsights.rateAlerts.length > 0 ? (
                <div className="space-y-2">
                  {loanInsights.rateAlerts.slice(0, 2).map((alert, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border ${getSeverityColor(alert.severity)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{alert.title}</div>
                          <div className="text-xs opacity-80 truncate">{alert.loanName}</div>
                        </div>
                        <div className="text-xs font-semibold whitespace-nowrap">
                          {formatCurrency(alert.impact)}/yr
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-center">
                  <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
                  <div className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Loans looking good!</div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">No immediate opportunities</div>
                </div>
              )}
            </div>
          </InsightTile>
        )}

        {/* Property Portfolio Tile */}
        {propertyInsights && propertyInsights.portfolioSummary.totalProperties > 0 && (
          <InsightTile
            title="Property Portfolio"
            badge={`${propertyInsights.portfolioSummary.totalProperties} propert${propertyInsights.portfolioSummary.totalProperties > 1 ? 'ies' : 'y'}`}
            icon={Home}
            iconColor="text-violet-600 dark:text-violet-400"
            badgeColor="violet"
            href="/dashboard/properties"
            alertCount={propertyInsights.propertyAlerts.filter(a => a.severity === 'high' || a.severity === 'critical').length}
          >
            <div className="grid grid-cols-2 gap-3 mb-4">
              <MetricCard
                label="Total Equity"
                value={formatCurrency(propertyInsights.portfolioSummary.totalEquity)}
                trend="up"
              />
              <MetricCard
                label="Portfolio Value"
                value={formatCurrency(propertyInsights.portfolioSummary.totalValue)}
              />
              <MetricCard
                label="Avg LVR"
                value={`${propertyInsights.portfolioSummary.averageLVR.toFixed(0)}%`}
                trend={propertyInsights.portfolioSummary.averageLVR > 80 ? 'down' : 'neutral'}
              />
              <MetricCard
                label="Net Cashflow"
                value={`${formatCurrency(propertyInsights.portfolioSummary.totalMonthlyCashflow)}/mo`}
                trend={propertyInsights.portfolioSummary.totalMonthlyCashflow >= 0 ? 'up' : 'down'}
              />
            </div>

            {/* Top Performer & Alerts */}
            <div className="space-y-2">
              {propertyInsights.topPerformer && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">Top Performer</div>
                  <div className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">{propertyInsights.topPerformer.propertyName}</div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">{propertyInsights.topPerformer.description}</div>
                </div>
              )}
              {propertyInsights.propertyAlerts.slice(0, 2).map((alert, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border ${getSeverityColor(alert.severity)}`}
                >
                  <div className="font-medium text-sm">{alert.title}</div>
                  <div className="text-xs opacity-80">{alert.propertyName}</div>
                </div>
              ))}
            </div>
          </InsightTile>
        )}

        {/* Investment Portfolio Tile */}
        {investmentInsights && investmentInsights.portfolioSummary.holdingsCount > 0 && (
          <InsightTile
            title="Investment Portfolio"
            badge={`${investmentInsights.portfolioSummary.holdingsCount} holding${investmentInsights.portfolioSummary.holdingsCount > 1 ? 's' : ''}`}
            icon={Briefcase}
            iconColor="text-amber-600 dark:text-amber-400"
            badgeColor="amber"
            href="/dashboard/investments"
            alertCount={investmentInsights.investmentAlerts.filter(a => a.severity === 'high' || a.severity === 'critical').length}
          >
            <div className="grid grid-cols-2 gap-3 mb-4">
              <MetricCard
                label="Total Value"
                value={formatCurrency(investmentInsights.portfolioSummary.totalValue)}
              />
              <MetricCard
                label="Unrealised Gain"
                value={formatCurrency(investmentInsights.portfolioSummary.unrealisedGain)}
                subValue={`${investmentInsights.portfolioSummary.unrealisedGainPercent >= 0 ? '+' : ''}${investmentInsights.portfolioSummary.unrealisedGainPercent.toFixed(1)}%`}
                trend={investmentInsights.portfolioSummary.unrealisedGain >= 0 ? 'up' : 'down'}
              />
              <MetricCard
                label="Dividend Yield"
                value={`${investmentInsights.portfolioSummary.dividendYieldPercent.toFixed(1)}%`}
              />
              <MetricCard
                label="Franking Credits"
                value={formatCurrency(investmentInsights.performanceMetrics.frankingCredits)}
                trend="up"
              />
            </div>

            {/* Allocation & Concentration */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  <PieChart className="h-3 w-3" />
                  Allocation
                </div>
                <div className="space-y-1">
                  {investmentInsights.allocationAnalysis.currentAllocation.slice(0, 3).map((alloc, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400 truncate">{alloc.assetType}</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{alloc.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {investmentInsights.topPerformer && (
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">Top: {investmentInsights.topPerformer.holdingName}</div>
                  </div>
                )}
                {investmentInsights.allocationAnalysis.concentrationRisk.hasRisk && (
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                    <div className="text-xs text-amber-700 dark:text-amber-300">
                      {investmentInsights.allocationAnalysis.concentrationRisk.topHolding}: {investmentInsights.allocationAnalysis.concentrationRisk.topHoldingPercent.toFixed(0)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          </InsightTile>
        )}
      </div>

      {/* Monthly Progress & Risk Radar */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Progress */}
        <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50">
                <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              Monthly Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Net Worth Change</div>
                <div className={`text-2xl font-bold flex items-center gap-1 ${monthlyProgress.netWorthChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {monthlyProgress.netWorthChange >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                  {formatCurrency(Math.abs(monthlyProgress.netWorthChange))}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {monthlyProgress.netWorthChangePercent >= 0 ? '+' : ''}{monthlyProgress.netWorthChangePercent}%
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Savings Rate</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{monthlyProgress.savingsRate}%</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400">
                  +{monthlyProgress.savingsRateChange}% vs last month
                </div>
              </div>
            </div>

            {monthlyProgress.topImprovements.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">Improvements</div>
                <div className="space-y-1.5">
                  {monthlyProgress.topImprovements.map((imp, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      {imp}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {monthlyProgress.emergingRisks.length > 0 && (
              <div>
                <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">Watch Items</div>
                <div className="space-y-1.5">
                  {monthlyProgress.emergingRisks.map((risk, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                      {risk}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Radar */}
        <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50">
                  <Shield className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </div>
                Risk Radar
              </CardTitle>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Impact: {formatCurrency(risks.summary.totalImpact)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {/* Risk Summary Grid */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              <RiskBadge count={risks.summary.critical} severity="critical" />
              <RiskBadge count={risks.summary.high} severity="high" />
              <RiskBadge count={risks.summary.medium} severity="medium" />
              <RiskBadge count={risks.summary.low} severity="low" />
            </div>

            {/* Top Risks */}
            <div className="space-y-2">
              {risks.risks.slice(0, 3).map((risk) => (
                <div
                  key={risk.id}
                  className={`p-3 rounded-xl border transition-all duration-200 hover:shadow-md ${getSeverityColor(risk.severity)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{risk.title}</div>
                      <div className="text-xs opacity-80 mt-0.5 line-clamp-1">{risk.description}</div>
                    </div>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {risk.timeframe}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prioritised Actions */}
      <div id="actions-section">
        <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50">
                  <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                Prioritised Actions
              </CardTitle>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {actions.totalActions} actions • Start with "Do Now"
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="do_now" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <TabsTrigger value="do_now" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 rounded-md">
                  Do Now ({actions.doNow.length})
                </TabsTrigger>
                <TabsTrigger value="upcoming" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 rounded-md">
                  Upcoming ({actions.upcoming.length})
                </TabsTrigger>
                <TabsTrigger value="consider" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 rounded-md">
                  Consider ({actions.considerSoon.length})
                </TabsTrigger>
                <TabsTrigger value="background" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 rounded-md">
                  Background ({actions.background.length})
                </TabsTrigger>
              </TabsList>

              {['do_now', 'upcoming', 'consider', 'background'].map((tab) => {
                const tabActions = tab === 'do_now' ? actions.doNow
                  : tab === 'upcoming' ? actions.upcoming
                  : tab === 'consider' ? actions.considerSoon
                  : actions.background;

                return (
                  <TabsContent key={tab} value={tab === 'consider' ? 'consider' : tab} className="space-y-3 mt-0">
                    {tabActions.length === 0 ? (
                      <div className="text-center py-12">
                        <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">All clear!</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">No actions in this category</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tabActions.map((action) => (
                          <div
                            key={action.id}
                            className="group p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30
                              hover:bg-white dark:hover:bg-gray-800 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700
                              transition-all duration-200 cursor-pointer"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">{getPriorityIcon(action.priority)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-gray-900 dark:text-gray-100">{action.title}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {action.category}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                  {action.explanation}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    {formatCurrency(action.expectedImpact.amount)} {action.expectedImpact.timeframe}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {action.timeRequired}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
