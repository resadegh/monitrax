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
  // Note: budgetAnalysis removed - Debt Planner now uses confirmed budget from Budget Analysis page
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

// Budget status from pre-check
interface BudgetStatus {
  hasConfirmedBudget: boolean;
  totalBudget: number;
  recurringExpenses: number;
  variableExpenses: number;
  monthlyIncome: number;
  remainingCashflow: number;
  totalLoanRepayments: number;
  availableForDebt: number;
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

  // Phase 28: Budget status pre-check
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);

  // Pre-fetch budget analysis status on page load
  useEffect(() => {
    const fetchBudgetStatus = async () => {
      if (!token) return;

      try {
        const response = await fetch('/api/budget-analysis/latest', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const result = await response.json();

        if (response.ok && result.success && result.data?.status === 'CONFIRMED') {
          // Fetch cashflow data (uses NET income, not GROSS) for accurate calculation
          const cashflowRes = await fetch('/api/calculate/cashflow', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ fetchFromDatabase: true }),
          });

          const cashflowData = await cashflowRes.json();

          // Use NET income from cashflow API (after PAYG/tax withholding)
          const monthlyIncome = cashflowData.output?.monthlyNetIncome || 0;
          const totalLoanRepayments = cashflowData.output?.monthlyLoanRepayments || 0;

          const totalBudget = result.data.userFinalBudget || result.data.totalRealisticBudget;
          const remainingCashflow = monthlyIncome - totalBudget;
          const availableForDebt = remainingCashflow - totalLoanRepayments;

          setBudgetStatus({
            hasConfirmedBudget: true,
            totalBudget,
            recurringExpenses: result.data.recurringExpensesTotal,
            variableExpenses: result.data.aiVariableEstimate,
            monthlyIncome,
            remainingCashflow,
            totalLoanRepayments,
            availableForDebt,
          });
        } else {
          setBudgetStatus({
            hasConfirmedBudget: false,
            totalBudget: 0,
            recurringExpenses: 0,
            variableExpenses: 0,
            monthlyIncome: 0,
            remainingCashflow: 0,
            totalLoanRepayments: 0,
            availableForDebt: 0,
          });
        }
      } catch (err) {
        console.error('Failed to fetch budget status:', err);
        setBudgetStatus({
          hasConfirmedBudget: false,
          totalBudget: 0,
          recurringExpenses: 0,
          variableExpenses: 0,
          monthlyIncome: 0,
          remainingCashflow: 0,
          totalLoanRepayments: 0,
          availableForDebt: 0,
        });
      } finally {
        setBudgetLoading(false);
      }
    };

    fetchBudgetStatus();
  }, [token]);

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
        // Pass the pre-calculated availableForDebt from confirmed budget
        // This ensures the AI uses the exact same value shown in the UI header
        body: JSON.stringify({
          availableForExtraRepayments: budgetStatus?.availableForDebt || 0,
        }),
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

  // Loading state
  if (budgetLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Debt Planner"
        description="Optimize your debt repayment strategy and see how much you can save"
      />

      <div className="space-y-6">
        {/* Phase 28: No Confirmed Budget - Require setup first */}
        {budgetStatus && !budgetStatus.hasConfirmedBudget && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200 text-lg">
                    Complete Your Budget First
                  </h3>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    To get accurate debt repayment recommendations, you need to confirm your realistic budget.
                    This includes variable expenses like groceries, fuel, and entertainment that aren&apos;t tracked.
                  </p>
                  <div className="flex gap-3 mt-4">
                    <Button
                      onClick={() => window.location.href = '/dashboard/household-profile'}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      1. Set Up Household Profile
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.location.href = '/dashboard/budget-analysis'}
                      className="border-amber-300 hover:bg-amber-100 dark:border-amber-700"
                    >
                      2. Generate Budget Analysis
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Phase 28: Confirmed Budget - Show Cashflow Breakdown */}
        {budgetStatus && budgetStatus.hasConfirmedBudget && (
          <>
            {/* Cashflow Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-xs text-muted-foreground">Monthly Income</div>
                  <div className="text-lg font-bold text-green-600">{formatCurrency(budgetStatus.monthlyIncome)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-xs text-muted-foreground">Total Budget</div>
                  <div className="text-lg font-bold text-amber-600">-{formatCurrency(budgetStatus.totalBudget)}</div>
                  <div className="text-xs text-muted-foreground">
                    ({formatCurrency(budgetStatus.recurringExpenses)} + {formatCurrency(budgetStatus.variableExpenses)})
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-xs text-muted-foreground">Loan Repayments</div>
                  <div className="text-lg font-bold text-red-600">-{formatCurrency(budgetStatus.totalLoanRepayments)}</div>
                </CardContent>
              </Card>
              <Card className={budgetStatus.availableForDebt > 0 ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'}>
                <CardContent className="pt-4 pb-3">
                  <div className="text-xs text-muted-foreground">Available for Extra Payments</div>
                  <div className={`text-lg font-bold ${budgetStatus.availableForDebt > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(budgetStatus.availableForDebt)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = '/dashboard/budget-analysis'}
                  >
                    Adjust Budget
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Zero/Negative Cashflow Warning */}
            {budgetStatus.availableForDebt <= 0 && (
              <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-800 dark:text-red-200 text-lg">
                        No Money Available for Extra Debt Payments
                      </h3>
                      <p className="text-red-700 dark:text-red-300 mt-1">
                        After your budget ({formatCurrency(budgetStatus.totalBudget)}) and minimum loan repayments ({formatCurrency(budgetStatus.totalLoanRepayments)}),
                        you have {formatCurrency(budgetStatus.availableForDebt)} remaining.
                        {budgetStatus.availableForDebt < 0 ? ' You\'re spending more than you earn!' : ''}
                      </p>
                      <div className="mt-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-red-200 dark:border-red-800">
                        <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Suggestions:</h4>
                        <ul className="text-sm text-red-700 dark:text-red-300 space-y-2">
                          <li className="flex items-start gap-2">
                            <span className="font-bold">1.</span>
                            <span><strong>Review your budget</strong> — Can you reduce variable expenses? Consider choosing the &quot;Minimum&quot; budget scenario.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-bold">2.</span>
                            <span><strong>Increase income</strong> — Look for ways to boost your monthly income (side job, raise, etc.).</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-bold">3.</span>
                            <span><strong>Refinance loans</strong> — Contact lenders about extending loan terms to reduce minimum repayments.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-bold">4.</span>
                            <span><strong>Seek financial advice</strong> — A financial advisor can help restructure your situation.</span>
                          </li>
                        </ul>
                      </div>
                      <div className="flex gap-3 mt-4">
                        <Button
                          onClick={() => window.location.href = '/dashboard/budget-analysis'}
                          variant="outline"
                          className="border-red-300 hover:bg-red-100 dark:border-red-700"
                        >
                          Adjust Budget
                        </Button>
                        <Button
                          onClick={() => window.location.href = '/dashboard/income'}
                          variant="outline"
                          className="border-red-300 hover:bg-red-100 dark:border-red-700"
                        >
                          Review Income
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Positive Cashflow - Show success banner */}
            {budgetStatus.availableForDebt > 0 && (
              <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-green-800 dark:text-green-200">
                        Budget Confirmed — Ready for Debt Planning
                      </h4>
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300">
                        {formatCurrency(budgetStatus.availableForDebt)}/mo available
                      </Badge>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      You have {formatCurrency(budgetStatus.availableForDebt)}/month available for extra debt payments after your realistic budget and minimum loan repayments.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Only show AI panel and debt planning if budget is confirmed AND there's available cashflow */}
        {budgetStatus && budgetStatus.hasConfirmedBudget && budgetStatus.availableForDebt > 0 && (
          <>
        {/* AI Smart Analysis Panel - only if budget confirmed with positive cashflow */}
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

          </>
        )}

        {/* Getting Started Message - only show if budget not confirmed */}
        {(!budgetStatus || !budgetStatus.hasConfirmedBudget) && (
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
