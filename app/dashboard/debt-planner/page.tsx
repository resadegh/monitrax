'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Receipt,
  TrendingDown,
  Target,
  DollarSign,
  Clock,
  AlertCircle,
  Info,
  Calculator,
  Sparkles,
  Brain,
  Lightbulb,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  Zap,
  RefreshCw,
} from 'lucide-react';

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

interface AIAnalysis {
  summary: string;
  debtHealthScore: number;
  recommendedStrategy: 'TAX_AWARE_MINIMUM_INTEREST' | 'AVALANCHE' | 'SNOWBALL';
  strategyReason: string;
  budgetAnalysis?: {
    estimatedLivingCosts: number;
    lifestyleBuffer: number;
    emergencyFundStatus: 'adequate' | 'needs_building' | 'critical';
    recommendedEmergencyFund: number;
    trueDisposableIncome: number;
    budgetNotes: string;
  };
  optimalSurplus: {
    recommended: number;
    minimum: number;
    aggressive: number;
    reasoning: string;
  };
  keyInsights: Array<{
    type: 'opportunity' | 'warning' | 'tip';
    title: string;
    description: string;
    impact: string;
  }>;
  loanPriority: Array<{
    loanName: string;
    priority: number;
    reason: string;
    estimatedPayoff: string;
  }>;
  projections: {
    debtFreeDate: string;
    totalInterestSaved: number;
    monthsSaved: number;
    comparedToMinimum: string;
  };
  actionPlan: Array<{
    step: number;
    action: string;
    timeline: string;
    expectedResult: string;
  }>;
  warnings: string[];
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

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showAIPanel, setShowAIPanel] = useState(true);

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

  // Fetch AI debt analysis
  const fetchAIAnalysis = async () => {
    setIsLoadingAI(true);
    setAiError('');

    try {
      const response = await fetch('/api/ai/debt-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to get AI analysis');
      }

      if (result.success && result.data?.analysis) {
        setAiAnalysis(result.data.analysis);

        // Auto-apply AI recommended settings
        if (result.data.analysis.recommendedStrategy) {
          setSettings(prev => ({
            ...prev,
            strategy: result.data.analysis.recommendedStrategy,
            surplusPerPeriod: result.data.analysis.optimalSurplus?.recommended || prev.surplusPerPeriod,
          }));
        }
      }
    } catch (err) {
      console.error('AI Analysis error:', err);
      setAiError(err instanceof Error ? err.message : 'Failed to get AI analysis');
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Apply AI recommended surplus
  const applyAISurplus = (amount: number) => {
    setSettings(prev => ({ ...prev, surplusPerPeriod: amount }));
  };

  // Apply AI recommended strategy
  const applyAIStrategy = () => {
    if (aiAnalysis?.recommendedStrategy) {
      setSettings(prev => ({ ...prev, strategy: aiAnalysis.recommendedStrategy }));
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
      icon: Receipt,
    },
    AVALANCHE: {
      name: 'Avalanche Strategy',
      description: 'Pay off loans with the highest interest rates first to minimize total interest cost.',
      icon: TrendingDown,
    },
    SNOWBALL: {
      name: 'Snowball Strategy',
      description: 'Pay off loans with the smallest balances first for psychological wins and motivation.',
      icon: Target,
    },
  };

  // Phase 28: Check budget analysis context from AI analysis
  const hasBudgetAnalysis = aiAnalysis && (aiAnalysis as any).budgetAnalysis?.available;
  const budgetContext = (aiAnalysis as any)?.budgetAnalysis;
  const comparisonData = (aiAnalysis as any)?.comparison;

  return (
    <DashboardLayout>
      <PageHeader
        title="Debt Planner"
        description="Optimize your debt repayment strategy and see how much you can save"
      />

      <div className="space-y-6">
        {/* Phase 28: Budget Analysis Status Banner */}
        {!hasBudgetAnalysis && (
          <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-amber-800 dark:text-amber-200">
                  Your budget may be missing variable expenses
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Your tracked expenses don&apos;t include groceries, fuel, and other variable costs.
                  This could make debt recommendations unrealistic.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50"
                    onClick={() => window.location.href = '/dashboard/household-profile'}
                  >
                    Complete Household Profile
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50"
                    onClick={() => window.location.href = '/dashboard/budget-analysis'}
                  >
                    Generate Budget Analysis
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 28: Show when using realistic budget */}
        {hasBudgetAnalysis && budgetContext && (
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-green-800 dark:text-green-200">
                    Using Realistic Budget
                  </h4>
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
                    {formatCurrency(budgetContext.totalRealisticBudget)}/mo
                  </Badge>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Includes {formatCurrency(budgetContext.recurringExpenses)} recurring + {formatCurrency(budgetContext.variableExpenses)} variable expenses
                </p>
                {comparisonData && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Without budget analysis: {formatCurrency(comparisonData.withoutBudgetAnalysis.monthlyExpenses)}/mo expenses, {formatCurrency(comparisonData.withoutBudgetAnalysis.availableForExtra)}/mo for extra payments
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-green-700 hover:text-green-800 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/50"
                onClick={() => window.location.href = '/dashboard/budget-analysis'}
              >
                Adjust Budget
              </Button>
            </div>
          </div>
        )}

        {/* AI Smart Analysis Panel */}
        <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    AI Debt Strategy Advisor
                    <Badge variant="outline" className="gap-1 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400">
                      <Sparkles className="h-3 w-3" />
                      Powered by Gemini AI
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Get personalized debt reduction strategy based on your financial situation
                  </CardDescription>
                </div>
              </div>
              <Button
                onClick={fetchAIAnalysis}
                disabled={isLoadingAI}
                className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {isLoadingAI ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {aiAnalysis ? 'Refresh Analysis' : 'Get AI Analysis'}
                  </>
                )}
              </Button>
            </div>
          </CardHeader>

          {aiError && (
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-700 dark:text-red-300 text-sm">
                <AlertCircle className="h-4 w-4" />
                {aiError}
              </div>
            </CardContent>
          )}

          {aiAnalysis && (
            <CardContent className="space-y-6">
              {/* Summary & Score */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 p-4 bg-white dark:bg-gray-900 rounded-lg border">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">AI Assessment</h4>
                  <p className="text-sm">{aiAnalysis.summary}</p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border text-center">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">Debt Health</h4>
                  <div className={`text-3xl font-bold ${
                    aiAnalysis.debtHealthScore >= 70 ? 'text-green-600' :
                    aiAnalysis.debtHealthScore >= 40 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {aiAnalysis.debtHealthScore}
                  </div>
                  <div className="text-xs text-muted-foreground">out of 100</div>
                </div>
              </div>

              {/* Budget Analysis */}
              {aiAnalysis.budgetAnalysis && (
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <DollarSign className="h-4 w-4" />
                    Budget Analysis
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className="p-2 bg-white/50 dark:bg-gray-900/50 rounded">
                      <div className="text-xs text-muted-foreground">Est. Living Costs</div>
                      <div className="font-semibold">{formatCurrency(aiAnalysis.budgetAnalysis.estimatedLivingCosts)}/mo</div>
                    </div>
                    <div className="p-2 bg-white/50 dark:bg-gray-900/50 rounded">
                      <div className="text-xs text-muted-foreground">Lifestyle Buffer</div>
                      <div className="font-semibold">{formatCurrency(aiAnalysis.budgetAnalysis.lifestyleBuffer)}/mo</div>
                    </div>
                    <div className="p-2 bg-white/50 dark:bg-gray-900/50 rounded">
                      <div className="text-xs text-muted-foreground">True Disposable</div>
                      <div className="font-semibold text-green-600">{formatCurrency(aiAnalysis.budgetAnalysis.trueDisposableIncome)}/mo</div>
                    </div>
                    <div className="p-2 bg-white/50 dark:bg-gray-900/50 rounded">
                      <div className="text-xs text-muted-foreground">Emergency Fund</div>
                      <div className={`font-semibold ${
                        aiAnalysis.budgetAnalysis.emergencyFundStatus === 'adequate' ? 'text-green-600' :
                        aiAnalysis.budgetAnalysis.emergencyFundStatus === 'needs_building' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {aiAnalysis.budgetAnalysis.emergencyFundStatus === 'adequate' ? 'Adequate' :
                         aiAnalysis.budgetAnalysis.emergencyFundStatus === 'needs_building' ? 'Needs Work' : 'Critical'}
                      </div>
                    </div>
                  </div>
                  {aiAnalysis.budgetAnalysis.budgetNotes && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 bg-white/30 dark:bg-gray-900/30 p-2 rounded">
                      <strong>Note:</strong> {aiAnalysis.budgetAnalysis.budgetNotes}
                    </p>
                  )}
                </div>
              )}

              {/* Recommended Strategy */}
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      Recommended Strategy: {strategyDescriptions[aiAnalysis.recommendedStrategy]?.name || aiAnalysis.recommendedStrategy}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">{aiAnalysis.strategyReason}</p>
                  </div>
                  {settings.strategy !== aiAnalysis.recommendedStrategy && (
                    <Button size="sm" variant="outline" onClick={applyAIStrategy} className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Apply
                    </Button>
                  )}
                </div>
              </div>

              {/* Optimal Surplus Recommendations */}
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  Recommended Extra Payment Amounts
                </h4>
                <p className="text-xs text-muted-foreground mb-3">{aiAnalysis.optimalSurplus.reasoning}</p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => applyAISurplus(aiAnalysis.optimalSurplus.minimum)}
                    className={`p-3 rounded-lg border text-center transition-all hover:border-purple-500 ${
                      settings.surplusPerPeriod === aiAnalysis.optimalSurplus.minimum ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' : ''
                    }`}
                  >
                    <div className="text-xs text-muted-foreground">Minimum</div>
                    <div className="font-semibold">{formatCurrency(aiAnalysis.optimalSurplus.minimum)}</div>
                    <div className="text-xs text-muted-foreground">/month</div>
                  </button>
                  <button
                    onClick={() => applyAISurplus(aiAnalysis.optimalSurplus.recommended)}
                    className={`p-3 rounded-lg border text-center transition-all hover:border-purple-500 ring-2 ring-purple-500/50 ${
                      settings.surplusPerPeriod === aiAnalysis.optimalSurplus.recommended ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' : ''
                    }`}
                  >
                    <div className="text-xs font-medium text-purple-600">Recommended</div>
                    <div className="font-bold text-lg">{formatCurrency(aiAnalysis.optimalSurplus.recommended)}</div>
                    <div className="text-xs text-muted-foreground">/month</div>
                  </button>
                  <button
                    onClick={() => applyAISurplus(aiAnalysis.optimalSurplus.aggressive)}
                    className={`p-3 rounded-lg border text-center transition-all hover:border-purple-500 ${
                      settings.surplusPerPeriod === aiAnalysis.optimalSurplus.aggressive ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' : ''
                    }`}
                  >
                    <div className="text-xs text-muted-foreground">Aggressive</div>
                    <div className="font-semibold">{formatCurrency(aiAnalysis.optimalSurplus.aggressive)}</div>
                    <div className="text-xs text-muted-foreground">/month</div>
                  </button>
                </div>
              </div>

              {/* Key Insights */}
              {aiAnalysis.keyInsights && aiAnalysis.keyInsights.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Key Insights
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {aiAnalysis.keyInsights.map((insight, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          insight.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
                          insight.type === 'opportunity' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                          'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {insight.type === 'warning' ? (
                            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          ) : insight.type === 'opportunity' ? (
                            <TrendingUp className="h-4 w-4 text-green-600 mt-0.5" />
                          ) : (
                            <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5" />
                          )}
                          <div>
                            <div className="font-medium text-sm">{insight.title}</div>
                            <div className="text-xs text-muted-foreground mt-1">{insight.description}</div>
                            {insight.impact && (
                              <div className="text-xs font-medium text-purple-600 mt-1">{insight.impact}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loan Priority Order */}
              {aiAnalysis.loanPriority && aiAnalysis.loanPriority.length > 0 && (
                <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    Loan Payoff Priority
                  </h4>
                  <div className="space-y-2">
                    {aiAnalysis.loanPriority.map((loan, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                        <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-bold text-purple-600">
                          {loan.priority}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{loan.loanName}</div>
                          <div className="text-xs text-muted-foreground">{loan.reason}</div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {loan.estimatedPayoff}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Plan */}
              {aiAnalysis.actionPlan && aiAnalysis.actionPlan.length > 0 && (
                <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Your Action Plan
                  </h4>
                  <div className="space-y-3">
                    {aiAnalysis.actionPlan.map((action, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-bold text-green-600 mt-0.5">
                          {action.step}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{action.action}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3" />
                            {action.timeline}
                            <ArrowRight className="h-3 w-3" />
                            {action.expectedResult}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {aiAnalysis.warnings && aiAnalysis.warnings.length > 0 && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-red-700 dark:text-red-300">
                    <AlertTriangle className="h-4 w-4" />
                    Important Warnings
                  </h4>
                  <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 space-y-1">
                    {aiAnalysis.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Projections */}
              {aiAnalysis.projections && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-xs text-green-600 dark:text-green-400 font-medium">Debt Free By</div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">{aiAnalysis.projections.debtFreeDate}</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Interest Savings</div>
                    <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(aiAnalysis.projections.totalInterestSaved)}</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/30 dark:to-violet-900/30 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Time Saved</div>
                    <div className="text-xl font-bold text-purple-700 dark:text-purple-300">{aiAnalysis.projections.monthsSaved} months</div>
                    <div className="text-xs text-muted-foreground">{aiAnalysis.projections.comparedToMinimum}</div>
                  </div>
                </div>
              )}
            </CardContent>
          )}

          {!aiAnalysis && !isLoadingAI && !aiError && (
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Click "Get AI Analysis" to receive personalized debt reduction recommendations</p>
                <p className="text-xs mt-1">Our AI will analyze your loans, income, and expenses to create an optimal strategy</p>
              </div>
            </CardContent>
          )}
        </Card>

        <Separator />

        {/* Strategy Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Your Strategy</CardTitle>
            <CardDescription>Choose a debt repayment approach that works for you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(strategyDescriptions).map(([key, info]) => {
                const Icon = info.icon;
                const isSelected = settings.strategy === key;
                return (
                  <Card
                    key={key}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSettings({ ...settings, strategy: key as DebtPlanSettings['strategy'] })}
                  >
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className={`rounded-full p-2 ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base mb-1">{info.name}</CardTitle>
                          <CardDescription className="text-xs">{info.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Settings Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Set your repayment parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="surplusPerPeriod">Extra Payment Amount</Label>
                <Input
                  id="surplusPerPeriod"
                  type="number"
                  value={settings.surplusPerPeriod}
                  onChange={(e) => setSettings({ ...settings, surplusPerPeriod: Number(e.target.value) })}
                  placeholder="1000"
                />
                <p className="text-xs text-muted-foreground">
                  Additional amount you can pay towards debt each period
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="surplusFrequency">Payment Frequency</Label>
                <Select
                  value={settings.surplusFrequency}
                  onValueChange={(value) => setSettings({ ...settings, surplusFrequency: value as DebtPlanSettings['surplusFrequency'] })}
                >
                  <SelectTrigger id="surplusFrequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyBuffer">Emergency Buffer</Label>
                <Input
                  id="emergencyBuffer"
                  type="number"
                  value={settings.emergencyBuffer}
                  onChange={(e) => setSettings({ ...settings, emergencyBuffer: Number(e.target.value) })}
                  placeholder="5000"
                />
                <p className="text-xs text-muted-foreground">
                  Reserve amount to keep in accounts for emergencies
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="respectFixedCaps" className="cursor-pointer">
                    Respect fixed loan payment caps
                  </Label>
                  <Switch
                    id="respectFixedCaps"
                    checked={settings.respectFixedCaps}
                    onCheckedChange={(checked) => setSettings({ ...settings, respectFixedCaps: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="rolloverRepayments" className="cursor-pointer">
                    Roll over payments when loans are paid off
                  </Label>
                  <Switch
                    id="rolloverRepayments"
                    checked={settings.rolloverRepayments}
                    onCheckedChange={(checked) => setSettings({ ...settings, rolloverRepayments: checked })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-4">
              <Button onClick={runPlan} disabled={isLoading} size="lg" className="gap-2">
                <Calculator className="h-4 w-4" />
                {isLoading ? 'Calculating...' : 'Calculate Debt Plan'}
              </Button>
              {planResult && (
                <p className="text-sm text-muted-foreground">
                  Last calculated using {strategyDescriptions[settings.strategy].name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">Error</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive/90">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results Display */}
        {planResult && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatCard
                title="Total Interest Saved"
                value={formatCurrency(planResult.totalInterestSavedVsBaseline)}
                description="Compared to minimum payments only"
                icon={DollarSign}
                variant="green"
              />
              <StatCard
                title="Time Saved"
                value={`${planResult.totalMonthsSaved} months`}
                description={`${(planResult.totalMonthsSaved / 12).toFixed(1)} years earlier`}
                icon={Clock}
                variant="blue"
              />
            </div>

            {/* Loan Details */}
            <Card>
              <CardHeader>
                <CardTitle>Loan Payoff Details</CardTitle>
                <CardDescription>Projected payoff dates and savings for each loan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {planResult.loans.map((loan) => (
                  <Card key={loan.loanId} className="border-muted">
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-4">{loan.loanName}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Baseline Payoff</p>
                          <p className="font-medium">{formatDate(loan.baselinePayoffDate)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Strategy Payoff</p>
                          <p className="font-medium text-green-600">{formatDate(loan.strategyPayoffDate)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Savings</p>
                          <p className="font-medium text-green-600">
                            {formatCurrency(loan.interestSavedVsBaseline)}
                          </p>
                          <p className="text-xs text-green-600">
                            {loan.monthsSaved} months earlier
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            {/* Strategy Info */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="flex items-start gap-3">
                  {(() => {
                    const Icon = strategyDescriptions[settings.strategy].icon;
                    return <Icon className="h-6 w-6 text-primary mt-1" />;
                  })()}
                  <div className="flex-1">
                    <CardTitle>{strategyDescriptions[settings.strategy].name}</CardTitle>
                    <CardDescription className="mt-2">
                      {strategyDescriptions[settings.strategy].description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Extra Payment:</span>{' '}
                    {formatCurrency(settings.surplusPerPeriod)} {settings.surplusFrequency.toLowerCase()}
                  </p>
                  <p>
                    <span className="font-medium">Emergency Buffer:</span>{' '}
                    {formatCurrency(settings.emergencyBuffer)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Getting Started Message */}
        {!planResult && !isLoading && !error && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <CardTitle className="text-blue-900">How to use the Debt Planner</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Choose your preferred debt repayment strategy</li>
                <li>Enter how much extra you can pay towards your debts</li>
                <li>Set your emergency buffer amount</li>
                <li>Click "Calculate Debt Plan" to see your personalized payoff plan</li>
                <li>Compare the savings between strategies to find the best approach</li>
              </ol>
              <Separator className="my-4" />
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Make sure you've added your loans before running the debt planner.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
