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
} from 'lucide-react';

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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
    }).format(amount);

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

  const { score, risks, actions, monthlyProgress, quickStats, alerts } = data;

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
            <div className="grid grid-cols-2 gap-4">
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
