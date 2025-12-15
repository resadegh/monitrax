'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DollarSign,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Brain,
  TrendingDown,
  ArrowRight,
  Info,
  Edit2,
  AlertTriangle,
} from 'lucide-react';

interface VariableCategory {
  estimate: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  excludedRecurring?: string[];
}

interface Scenario {
  total: number;
  description: string;
}

interface BudgetAnalysis {
  id: string;
  status: string;
  recurring: {
    total: number;
    breakdown: any;
  };
  variable: {
    total: number;
    breakdown: {
      categories: Record<string, VariableCategory>;
      assumptions: string[];
    };
  };
  totals: {
    recurringExpenses: number;
    variableExpenses: number;
    totalRealisticBudget: number;
    userReportedTotal: number;
    missingExpenses: number;
  };
  scenarios: {
    minimum: Scenario;
    recommended: Scenario;
    comfortable: Scenario;
  };
  aiExplanation: string;
  aiConfidence: number;
  userFinalBudget?: number;
  userOverrodeAi: boolean;
}

export default function BudgetAnalysisPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [analysis, setAnalysis] = useState<BudgetAnalysis | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<'minimum' | 'recommended' | 'comfortable'>('recommended');
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Fetch latest analysis
  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const response = await fetch('/api/budget-analysis/latest', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setAnalysis({
            id: result.data.id,
            status: result.data.status,
            recurring: result.data.recurring,
            variable: result.data.variable,
            totals: {
              recurringExpenses: result.data.recurringExpensesTotal,
              variableExpenses: result.data.aiVariableEstimate,
              totalRealisticBudget: result.data.totalRealisticBudget,
              userReportedTotal: result.data.recurringExpensesTotal,
              missingExpenses: result.data.aiVariableEstimate,
            },
            scenarios: result.data.scenarios,
            aiExplanation: result.data.aiExplanation,
            aiConfidence: result.data.aiConfidence,
            userFinalBudget: result.data.userFinalBudget,
            userOverrodeAi: result.data.userOverrodeAi,
          });

          // Initialize adjustments from variable breakdown
          if (result.data.variable?.breakdown?.categories) {
            const initial: Record<string, number> = {};
            Object.entries(result.data.variable.breakdown.categories).forEach(([cat, data]: [string, any]) => {
              initial[cat] = data.estimate;
            });
            setAdjustments(initial);
          }
        } else if (response.status === 404) {
          // No analysis exists, check if profile exists
          if (!result.householdProfileComplete) {
            // Redirect to household profile
            router.push('/dashboard/household-profile');
          }
        }
      } catch (err) {
        console.error('Failed to fetch analysis:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchAnalysis();
    }
  }, [token, router]);

  // Generate new analysis
  const handleGenerate = async () => {
    setGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/budget-analysis/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ forceRegenerate: true }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 400 && result.error === 'Household profile incomplete') {
          router.push('/dashboard/household-profile');
          return;
        }
        throw new Error(result.error || 'Failed to generate analysis');
      }

      setAnalysis(result.data);

      // Initialize adjustments
      if (result.data.variable?.breakdown?.categories) {
        const initial: Record<string, number> = {};
        Object.entries(result.data.variable.breakdown.categories).forEach(([cat, data]: [string, any]) => {
          initial[cat] = data.estimate;
        });
        setAdjustments(initial);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate analysis');
    } finally {
      setGenerating(false);
    }
  };

  // Save user's choice
  const handleSaveChoice = async () => {
    if (!analysis) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Check if user made any adjustments
      const hasAdjustments = Object.entries(adjustments).some(([cat, val]) => {
        const original = (analysis.variable?.breakdown?.categories as any)?.[cat]?.estimate;
        return original !== undefined && val !== original;
      });

      const response = await fetch('/api/budget-analysis/save-choice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId: analysis.id,
          choice: hasAdjustments ? 'custom' : selectedScenario,
          adjustments: hasAdjustments ? adjustments : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save choice');
      }

      setSuccess('Budget saved! Your debt planner will now use realistic estimates.');
      setAnalysis({
        ...analysis,
        status: 'CONFIRMED',
        userFinalBudget: result.data.userFinalBudget,
        userOverrodeAi: result.data.userOverrodeAi,
      });

      // Redirect to debt planner after short delay
      setTimeout(() => {
        router.push('/dashboard/debt-planner');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save choice');
    } finally {
      setSaving(false);
    }
  };

  // Handle adjustment change
  const handleAdjustment = (category: string, value: number) => {
    setAdjustments({ ...adjustments, [category]: Math.max(0, value) });
  };

  // Calculate totals based on adjustments
  const calculateTotals = () => {
    if (!analysis) return { recurring: 0, variable: 0, total: 0 };

    const recurring = analysis.totals.recurringExpenses;
    let variable = 0;

    if (selectedScenario === 'minimum') {
      variable = analysis.scenarios.minimum.total;
    } else if (selectedScenario === 'comfortable') {
      variable = analysis.scenarios.comfortable.total;
    } else {
      // Use adjustments for recommended
      variable = Object.values(adjustments).reduce((sum, val) => sum + val, 0);
    }

    return {
      recurring,
      variable,
      total: recurring + variable,
    };
  };

  const totals = calculateTotals();

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Confidence badge
  const ConfidenceBadge = ({ confidence }: { confidence: 'high' | 'medium' | 'low' }) => {
    const colors = {
      high: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      low: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    };
    return (
      <Badge variant="outline" className={colors[confidence]}>
        {confidence.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // No analysis yet
  if (!analysis) {
    return (
      <DashboardLayout>
        <PageHeader
          title="Budget Analysis"
          description="AI-powered estimate of your realistic monthly expenses"
        />

        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto p-3 bg-primary/10 rounded-full w-fit mb-4">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Generate Your Budget Analysis</CardTitle>
            <CardDescription>
              We&apos;ll estimate your variable expenses (groceries, fuel, etc.) based on your household profile
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={handleGenerate} disabled={generating} size="lg">
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Budget Analysis
                </>
              )}
            </Button>

            {error && (
              <div className="flex items-center gap-2 justify-center mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-700 dark:text-red-300 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Budget Analysis"
        description="AI-powered estimate of your realistic monthly expenses"
        action={
          <Button onClick={handleGenerate} variant="outline" disabled={generating}>
            {generating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh Analysis
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Success/Error messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-700 dark:text-red-300 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-700 dark:text-green-300 text-sm">
            <CheckCircle className="h-4 w-4" />
            {success}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Recurring (Tracked)</div>
              <div className="text-2xl font-bold">{formatCurrency(analysis.totals.recurringExpenses)}</div>
              <div className="text-xs text-muted-foreground">/month</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Variable (AI Est.)</div>
              <div className="text-2xl font-bold text-primary">{formatCurrency(totals.variable)}</div>
              <div className="text-xs text-muted-foreground">/month</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Realistic</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.total)}</div>
              <div className="text-xs text-muted-foreground">/month</div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="text-sm text-amber-700 dark:text-amber-300">Missing Expenses</div>
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(totals.variable)}</div>
              <div className="text-xs text-amber-600 dark:text-amber-400">not tracked</div>
            </CardContent>
          </Card>
        </div>

        {/* Warning about missing expenses */}
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <div className="font-medium text-amber-800 dark:text-amber-200">
                  Your tracked expenses are missing ~{formatCurrency(totals.variable)}/month
                </div>
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  Variable expenses like groceries, fuel, and entertainment aren&apos;t typically tracked.
                  Using the realistic budget will give you achievable debt repayment recommendations.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scenario Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Choose Your Budget Scenario</CardTitle>
            <CardDescription>
              Select the scenario that best fits your situation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['minimum', 'recommended', 'comfortable'] as const).map((scenario) => (
                <button
                  key={scenario}
                  type="button"
                  onClick={() => setSelectedScenario(scenario)}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    selectedScenario === scenario
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="font-medium capitalize">{scenario}</div>
                  <div className="text-2xl font-bold mt-1">
                    {formatCurrency(analysis.scenarios[scenario].total)}/mo
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {analysis.scenarios[scenario].description}
                  </div>
                  <div className="text-sm font-medium mt-2">
                    Total: {formatCurrency(analysis.totals.recurringExpenses + analysis.scenarios[scenario].total)}/mo
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Variable Expense Breakdown */}
        {selectedScenario === 'recommended' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit2 className="h-5 w-5" />
                Adjust Variable Expenses
              </CardTitle>
              <CardDescription>
                Fine-tune the AI estimates if needed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(analysis.variable?.breakdown?.categories || {}).map(([category, data]: [string, any]) => (
                <div key={category} className="border rounded-lg p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleCategory(category)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedCategories.has(category) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">
                        {category.replace(/_/g, ' ')}
                      </span>
                      <ConfidenceBadge confidence={data.confidence} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        type="number"
                        value={adjustments[category] || 0}
                        onChange={(e) => handleAdjustment(category, parseInt(e.target.value) || 0)}
                        className="w-24 text-right"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                  </div>
                  {expandedCategories.has(category) && (
                    <div className="mt-3 pl-8 text-sm text-muted-foreground">
                      <div>{data.reasoning}</div>
                      {data.excludedRecurring && data.excludedRecurring.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-3 w-3" />
                          Excludes: {data.excludedRecurring.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Impact on Debt Planning */}
        <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Impact on Debt Planning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Before (Tracked Only)</div>
                <div className="text-lg">Expenses: {formatCurrency(analysis.totals.recurringExpenses)}/mo</div>
                <div className="text-sm text-muted-foreground">
                  Higher apparent surplus, unrealistic recommendations
                </div>
              </div>
              <div className="space-y-2 p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <div className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  After (Realistic Budget)
                </div>
                <div className="text-lg font-bold text-green-800 dark:text-green-200">
                  Expenses: {formatCurrency(totals.total)}/mo
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  Achievable debt repayment plan
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={handleSaveChoice}
            disabled={saving}
            size="lg"
            className="flex-1"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Use This Budget ({formatCurrency(totals.total)}/mo)
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/debt-planner')}
            className="flex-1"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Skip to Debt Planner
          </Button>
        </div>

        {/* AI Explanation */}
        {analysis.aiExplanation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                How We Calculated This
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {analysis.aiExplanation}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
