'use client';

import { useEffect, useState } from 'react';
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
  Bell,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Calendar,
  Receipt,
  Percent,
  Banknote,
  TrendingDown as TrendDown,
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
}

export default function CFODashboardPage() {
  const { token } = useAuth();
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

  // formatCurrency imported from lib/utils/formatters

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100';
      case 'B': return 'text-blue-600 bg-blue-100';
      case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-orange-600 bg-orange-100';
      case 'F': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Brain className="h-12 w-12 mx-auto text-primary animate-pulse mb-4" />
            <p className="text-sm text-muted-foreground">Analyzing your finances...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
          <p className="text-muted-foreground">Unable to load CFO dashboard</p>
          <Button onClick={() => loadData()} className="mt-4">Try Again</Button>
        </div>
      </DashboardLayout>
    );
  }

  const { score, risks, actions, monthlyProgress, quickStats, alerts, taxInsights, loanInsights } = data;

  return (
    <DashboardLayout>
      <PageHeader
        title="Personal CFO"
        description="Your AI-powered financial advisor monitoring your wealth 24/7"
        action={
          <Button
            variant="outline"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Analysis
          </Button>
        }
      />

      {/* CFO Score Hero */}
      <Card className="mb-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Score Circle */}
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-background flex items-center justify-center shadow-lg">
                <div className="text-center">
                  <div className="text-4xl font-bold">{score.overall}</div>
                  <div className={`text-sm font-semibold px-2 py-0.5 rounded ${getGradeColor(score.grade)}`}>
                    Grade {score.grade}
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2">
                {score.trend === 'improving' && (
                  <div className="bg-green-500 text-white rounded-full p-1">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                )}
                {score.trend === 'declining' && (
                  <div className="bg-red-500 text-white rounded-full p-1">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                )}
              </div>
            </div>

            {/* Score Components */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Cashflow', value: score.components.cashflowStrength, icon: DollarSign },
                { label: 'Debt Coverage', value: score.components.debtCoverage, icon: Shield },
                { label: 'Emergency Buffer', value: score.components.emergencyBuffer, icon: Shield },
                { label: 'Diversification', value: score.components.investmentDiversification, icon: BarChart3 },
                { label: 'Spending Control', value: score.components.spendingControl, icon: Target },
                { label: 'Savings Rate', value: score.components.savingsRate, icon: TrendingUp },
              ].map((component) => (
                <div key={component.label} className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <component.icon className="h-3 w-3" />
                    {component.label}
                  </div>
                  <Progress value={component.value} className="h-2" />
                  <div className="text-xs font-medium">{component.value}/100</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{quickStats.pendingActions}</div>
            <div className="text-xs text-muted-foreground">Pending Actions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{formatCurrency(quickStats.projectedMonthEndBalance)}</div>
            <div className="text-xs text-muted-foreground">Month-End Balance</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{quickStats.daysUntilNextBill}</div>
            <div className="text-xs text-muted-foreground">Days to Next Bill</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{quickStats.savingsOpportunities}</div>
            <div className="text-xs text-muted-foreground">Savings Opps</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{quickStats.unusedSubscriptions}</div>
            <div className="text-xs text-muted-foreground">Unused Subs</div>
          </CardContent>
        </Card>
      </div>

      {/* Tax Position Tile (Phase 17A) */}
      {taxInsights && (
        <Card className="mb-6 border-blue-200 bg-gradient-to-br from-blue-50/50 to-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                Tax Position
                <Badge variant="outline" className="ml-2 text-xs">
                  FY {taxInsights.taxPositionSnapshot.financialYear}
                </Badge>
              </CardTitle>
              {taxInsights.taxPositionSnapshot.actionRequiredBeforeEOFY && (
                <Badge className="bg-orange-500">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  EOFY Action Needed
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Estimated Refund/Owing */}
              <div className="p-3 bg-white rounded-lg border">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Receipt className="h-3 w-3" />
                  Estimated Position
                </div>
                <div className={`text-xl font-bold ${taxInsights.taxPositionSnapshot.estimatedRefund >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {taxInsights.taxPositionSnapshot.estimatedRefund >= 0 ? '+' : ''}
                  {formatCurrency(taxInsights.taxPositionSnapshot.estimatedRefund)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {taxInsights.taxPositionSnapshot.estimatedRefund >= 0 ? 'Refund' : 'Owing'}
                  <span className="ml-1 text-blue-600">
                    ({taxInsights.taxPositionSnapshot.confidenceLevel}% confidence)
                  </span>
                </div>
              </div>

              {/* Days Until EOFY */}
              <div className="p-3 bg-white rounded-lg border">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Days Until EOFY
                </div>
                <div className={`text-xl font-bold ${taxInsights.taxPositionSnapshot.daysUntilEOFY <= 30 ? 'text-orange-600' : 'text-gray-900'}`}>
                  {taxInsights.taxPositionSnapshot.daysUntilEOFY}
                </div>
                <div className="text-xs text-muted-foreground">
                  {taxInsights.taxPositionSnapshot.daysUntilEOFY <= 30 ? 'Action window closing' : 'Days remaining'}
                </div>
              </div>

              {/* Effective Tax Rate */}
              <div className="p-3 bg-white rounded-lg border">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Percent className="h-3 w-3" />
                  Effective Tax Rate
                </div>
                <div className="text-xl font-bold">
                  {(taxInsights.keyTaxMetrics.effectiveTaxRate * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Marginal: {(taxInsights.keyTaxMetrics.marginalRate * 100).toFixed(0)}%
                </div>
              </div>

              {/* Total Deductions */}
              <div className="p-3 bg-white rounded-lg border">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Total Deductions
                </div>
                <div className="text-xl font-bold text-green-600">
                  {formatCurrency(taxInsights.deductionsSummary.totalDeductions)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Reducing taxable income
                </div>
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="text-center p-2 bg-muted/30 rounded">
                <div className="text-sm font-semibold">{formatCurrency(taxInsights.deductionsSummary.propertyDeductions)}</div>
                <div className="text-xs text-muted-foreground">Property</div>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded">
                <div className="text-sm font-semibold">{formatCurrency(taxInsights.deductionsSummary.depreciationDeductions)}</div>
                <div className="text-xs text-muted-foreground">Depreciation</div>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded">
                <div className="text-sm font-semibold">{formatCurrency(taxInsights.deductionsSummary.investmentDeductions)}</div>
                <div className="text-xs text-muted-foreground">Investment</div>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded">
                <div className="text-sm font-semibold">{formatCurrency(taxInsights.deductionsSummary.workRelatedDeductions)}</div>
                <div className="text-xs text-muted-foreground">Work-related</div>
              </div>
            </div>

            {/* Key Tax Metrics */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              {taxInsights.keyTaxMetrics.negativeGearingBenefit > 0 && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>Neg. Gearing Benefit: <strong className="text-green-600">{formatCurrency(taxInsights.keyTaxMetrics.negativeGearingBenefit)}</strong></span>
                </div>
              )}
              {taxInsights.keyTaxMetrics.frankingCreditsAvailable > 0 && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>Franking Credits: <strong className="text-green-600">{formatCurrency(taxInsights.keyTaxMetrics.frankingCreditsAvailable)}</strong></span>
                </div>
              )}
              {taxInsights.keyTaxMetrics.unrealisedCGT > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                  <span>Unrealised CGT: <strong className="text-orange-600">{formatCurrency(taxInsights.keyTaxMetrics.unrealisedCGT)}</strong></span>
                </div>
              )}
            </div>

            {/* Potential Missed Deductions */}
            {taxInsights.deductionsSummary.potentialMissedDeductions.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-xs font-medium text-yellow-800 flex items-center gap-1 mb-1">
                  <AlertTriangle className="h-3 w-3" />
                  Potential Missed Deductions
                </div>
                <div className="flex flex-wrap gap-2">
                  {taxInsights.deductionsSummary.potentialMissedDeductions.map((item, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard/tax">
                  View Full Tax Dashboard
                  <ChevronRight className="h-4 w-4 ml-1" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loan Insights Tile (Phase 17B) - Shows actionable insights only, not duplicating Loans page data */}
      {loanInsights && loanInsights.metadata.loanCount > 0 && (
        <Card className="mb-6 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-emerald-600" />
                Loan Opportunities
                <Badge variant="outline" className="ml-2 text-xs">
                  {loanInsights.metadata.loanCount} loan{loanInsights.metadata.loanCount > 1 ? 's' : ''}
                </Badge>
              </CardTitle>
              {loanInsights.rateAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length > 0 && (
                <Badge className="bg-orange-500">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Action Required
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Key Actionable Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {/* Refinance Opportunities */}
              {loanInsights.refinanceOpportunities.filter(r => r.worthRefinancing).length > 0 && (
                <div className="p-3 bg-white rounded-lg border border-green-200">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendDown className="h-3 w-3 text-green-600" />
                    Refinance Savings
                  </div>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(loanInsights.totalRefinanceSavings)}/yr
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {loanInsights.refinanceOpportunities.filter(r => r.worthRefinancing).length} opportunity(ies) found
                  </div>
                </div>
              )}

              {/* Rate Alerts Count */}
              {loanInsights.rateAlerts.length > 0 && (
                <div className="p-3 bg-white rounded-lg border border-orange-200">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3 text-orange-600" />
                    Rate Alerts
                  </div>
                  <div className="text-xl font-bold text-orange-600">
                    {loanInsights.rateAlerts.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {loanInsights.rateAlerts.filter(a => a.daysUntil && a.daysUntil <= 90).length > 0
                      ? 'Time-sensitive actions'
                      : 'Review recommended'}
                  </div>
                </div>
              )}

              {/* Extra Repayment Impact */}
              {loanInsights.extraRepaymentImpact && (
                <div className="p-3 bg-white rounded-lg border border-blue-200">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-blue-600" />
                    Extra Repayment Benefit
                  </div>
                  <div className="text-xl font-bold text-blue-600">
                    {formatCurrency(loanInsights.extraRepaymentImpact.interestSaved)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Save {Math.round(loanInsights.extraRepaymentImpact.timeReduced / 12)} years with +${loanInsights.extraRepaymentImpact.extraMonthly}/mo
                  </div>
                </div>
              )}
            </div>

            {/* Rate Alerts List - Only show top 2 most urgent */}
            {loanInsights.rateAlerts.length > 0 && (
              <div className="space-y-2 mb-4">
                <div className="text-xs font-medium text-muted-foreground">Upcoming Rate Events</div>
                {loanInsights.rateAlerts.slice(0, 2).map((alert, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${
                      alert.severity === 'critical' ? 'bg-red-50 border-red-200' :
                      alert.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                      'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm flex items-center gap-2">
                          {alert.title}
                          {alert.daysUntil && alert.daysUntil <= 30 && (
                            <Badge variant="outline" className="text-xs">
                              {alert.daysUntil} days
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{alert.loanName}</div>
                      </div>
                      <div className="text-xs font-medium text-right">
                        <div className={alert.severity === 'critical' || alert.severity === 'high' ? 'text-red-600' : 'text-orange-600'}>
                          {formatCurrency(alert.impact)}/yr impact
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Refinance Opportunities List - Only show if significant */}
            {loanInsights.refinanceOpportunities.filter(r => r.worthRefinancing).length > 0 && (
              <div className="space-y-2 mb-4">
                <div className="text-xs font-medium text-muted-foreground">Refinance Opportunities</div>
                {loanInsights.refinanceOpportunities
                  .filter(r => r.worthRefinancing)
                  .slice(0, 2)
                  .map((opp, i) => (
                    <div key={i} className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{opp.loanName}</div>
                          <div className="text-xs text-muted-foreground">
                            {(opp.currentRate * 100).toFixed(2)}% → {(opp.marketRate * 100).toFixed(2)}%
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-green-600">
                            Save {formatCurrency(opp.annualSavings)}/yr
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(opp.monthlySavings)}/mo
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Show message if no actionable items */}
            {loanInsights.refinanceOpportunities.filter(r => r.worthRefinancing).length === 0 &&
             loanInsights.rateAlerts.length === 0 && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
                <CheckCircle2 className="h-6 w-6 mx-auto text-green-600 mb-2" />
                <div className="text-sm font-medium text-green-800">Loans looking good!</div>
                <div className="text-xs text-green-600">No immediate opportunities or alerts</div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard/debt">
                  View All Loans
                  <ChevronRight className="h-4 w-4 ml-1" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Monthly Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Monthly Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Net Worth Change</div>
                <div className={`text-xl font-bold flex items-center gap-1 ${monthlyProgress.netWorthChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {monthlyProgress.netWorthChange >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {formatCurrency(Math.abs(monthlyProgress.netWorthChange))}
                </div>
                <div className="text-xs text-muted-foreground">
                  {monthlyProgress.netWorthChangePercent >= 0 ? '+' : ''}{monthlyProgress.netWorthChangePercent}%
                </div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Savings Rate</div>
                <div className="text-xl font-bold">{monthlyProgress.savingsRate}%</div>
                <div className="text-xs text-green-600">
                  +{monthlyProgress.savingsRateChange}% vs last month
                </div>
              </div>
            </div>

            {monthlyProgress.topImprovements.length > 0 && (
              <div>
                <div className="text-xs font-medium text-green-600 mb-1">Improvements</div>
                {monthlyProgress.topImprovements.map((imp, i) => (
                  <div key={i} className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {imp}
                  </div>
                ))}
              </div>
            )}

            {monthlyProgress.emergingRisks.length > 0 && (
              <div>
                <div className="text-xs font-medium text-orange-600 mb-1">Watch Items</div>
                {monthlyProgress.emergingRisks.map((risk, i) => (
                  <div key={i} className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-orange-500" />
                    {risk}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Risk Radar
            </CardTitle>
            <CardDescription>
              Total impact: {formatCurrency(risks.summary.totalImpact)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{risks.summary.critical}</div>
                <div className="text-xs text-red-600">Critical</div>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{risks.summary.high}</div>
                <div className="text-xs text-orange-600">High</div>
              </div>
              <div className="text-center p-2 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{risks.summary.medium}</div>
                <div className="text-xs text-yellow-600">Medium</div>
              </div>
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{risks.summary.low}</div>
                <div className="text-xs text-green-600">Low</div>
              </div>
            </div>

            <div className="space-y-2">
              {risks.risks.slice(0, 3).map((risk) => (
                <div
                  key={risk.id}
                  className={`p-3 rounded-lg border ${getSeverityColor(risk.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{risk.title}</div>
                      <div className="text-xs mt-1 opacity-80">{risk.description}</div>
                    </div>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {risk.timeframe}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Prioritised Actions
          </CardTitle>
          <CardDescription>
            {actions.totalActions} actions identified • Start with "Do Now" items
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="do_now">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="do_now" className="text-xs">
                Do Now ({actions.doNow.length})
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="text-xs">
                Upcoming ({actions.upcoming.length})
              </TabsTrigger>
              <TabsTrigger value="consider" className="text-xs">
                Consider ({actions.considerSoon.length})
              </TabsTrigger>
              <TabsTrigger value="background" className="text-xs">
                Background ({actions.background.length})
              </TabsTrigger>
            </TabsList>

            {['do_now', 'upcoming', 'consider', 'background'].map((tab) => {
              const tabActions = tab === 'do_now' ? actions.doNow
                : tab === 'upcoming' ? actions.upcoming
                : tab === 'consider' ? actions.considerSoon
                : actions.background;

              return (
                <TabsContent key={tab} value={tab === 'consider' ? 'consider' : tab} className="space-y-3 mt-4">
                  {tabActions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      No actions in this category
                    </div>
                  ) : (
                    tabActions.map((action) => (
                      <Card key={action.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            {getPriorityIcon(action.priority)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{action.title}</span>
                                <Badge variant="outline" className="text-xs">
                                  {action.category}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {action.explanation}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
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
                            <Button variant="ghost" size="sm">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
