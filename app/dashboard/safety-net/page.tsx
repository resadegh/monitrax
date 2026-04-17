'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Car,
  Heart,
  Briefcase,
  RefreshCw,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SafetyNetData {
  emergencyFund: {
    liquidCash: number;
    monthlyOutgoings: number;
    monthsCovered: number;
    targetMonths: number;
    targetAmount: number;
    gap: number;
    monthlySurplus: number;
    weeksToTarget: number | null;
  };
  bills: {
    total: number;
    onTime: number;
    overdue: number;
    monthlyTotal: number;
    items: Array<{
      id: string;
      name: string;
      amount: number;
      pattern: string;
      status: string;
      nextExpected: string | null;
    }>;
  };
  safetyScore: {
    total: number;
    grade: string;
    breakdown: {
      emergencyFund: { score: number; max: number };
      billsOnTime: { score: number; max: number };
      noNewDebt: { score: number; max: number };
      positiveCashflow: { score: number; max: number };
    };
  };
  scenarios: Array<{
    name: string;
    cost: number;
    monthsRemaining: number;
    recoveryWeeks: number | null;
  }>;
  recommendations: string[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'STRONG': return 'text-emerald-600';
    case 'BUILDING': return 'text-amber-600';
    case 'FRAGILE': return 'text-orange-500';
    case 'AT RISK': return 'text-red-500';
    default: return 'text-stone-500';
  }
}

function gradeIcon(grade: string) {
  switch (grade) {
    case 'STRONG': return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    case 'BUILDING': return <TrendingUp className="h-5 w-5 text-amber-500" />;
    default: return <AlertTriangle className="h-5 w-5 text-orange-500" />;
  }
}

function scenarioIcon(name: string) {
  if (name.includes('Car')) return <Car className="h-5 w-5" />;
  if (name.includes('Medical')) return <Heart className="h-5 w-5" />;
  return <Briefcase className="h-5 w-5" />;
}

export default function SafetyNetPage() {
  const { token } = useAuth();
  const [data, setData] = useState<SafetyNetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/safety-net', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (response.ok && json.success) {
        setData(json.data);
      } else {
        setError(typeof json.error === 'string' ? json.error : 'Failed to load safety net data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Shield className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">My Safety Net</h1>
                <p className="text-sm text-muted-foreground">
                  TRAIL Stage A — Anchor your foundation
                </p>
              </div>
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading && !data && (
          <div className="text-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
            <p className="text-muted-foreground">Checking your safety net...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-400 mb-2" />
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchData} variant="outline" size="sm" className="mt-4">
              Try Again
            </Button>
          </div>
        )}

        {data && (
          <>
            {/* Safety Score + Emergency Fund — side by side on desktop */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Safety Score */}
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Safety Score
                  </h2>
                  {gradeIcon(data.safetyScore.grade)}
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-5xl font-bold tracking-tight">
                    {data.safetyScore.total}
                  </span>
                  <span className="text-lg text-muted-foreground">/ 100</span>
                </div>
                <p className={`text-sm font-semibold ${gradeColor(data.safetyScore.grade)}`}>
                  {data.safetyScore.grade}
                </p>

                <div className="mt-6 space-y-3">
                  {Object.entries(data.safetyScore.breakdown).map(([key, val]) => {
                    const label = key === 'emergencyFund' ? 'Emergency Fund'
                      : key === 'billsOnTime' ? 'Bills On Time'
                      : key === 'noNewDebt' ? 'No New Debt'
                      : 'Positive Cashflow';
                    const pct = (val.score / val.max) * 100;
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{val.score}/{val.max}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Emergency Fund Tracker */}
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  Emergency Fund
                </h2>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-5xl font-bold tracking-tight">
                    {data.emergencyFund.monthsCovered}
                  </span>
                  <span className="text-lg text-muted-foreground">
                    of {data.emergencyFund.targetMonths} months
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-4 mb-6">
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        data.emergencyFund.monthsCovered >= 3
                          ? 'bg-emerald-500'
                          : data.emergencyFund.monthsCovered >= 1
                          ? 'bg-amber-500'
                          : 'bg-red-400'
                      }`}
                      style={{
                        width: `${Math.min((data.emergencyFund.monthsCovered / data.emergencyFund.targetMonths) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Liquid savings</p>
                    <p className="font-semibold text-lg">{formatCurrency(data.emergencyFund.liquidCash)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Monthly outgoings</p>
                    <p className="font-semibold text-lg">{formatCurrency(data.emergencyFund.monthlyOutgoings)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Target ({data.emergencyFund.targetMonths} months)</p>
                    <p className="font-semibold">{formatCurrency(data.emergencyFund.targetAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gap</p>
                    <p className={`font-semibold ${data.emergencyFund.gap > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {data.emergencyFund.gap > 0 ? formatCurrency(data.emergencyFund.gap) : 'Target reached!'}
                    </p>
                  </div>
                </div>

                {data.emergencyFund.weeksToTarget !== null && data.emergencyFund.weeksToTarget > 0 && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    At your current surplus ({formatCurrency(data.emergencyFund.monthlySurplus)}/month),
                    you&apos;ll reach {data.emergencyFund.targetMonths} months in{' '}
                    <span className="font-semibold text-foreground">
                      ~{Math.ceil(data.emergencyFund.weeksToTarget / 4.33)} months
                    </span>.
                  </p>
                )}
              </div>
            </div>

            {/* Bills Status */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Bills & Commitments
                </h2>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(data.bills.monthlyTotal)}/month
                </span>
              </div>
              <div className="flex items-center gap-6 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium">{data.bills.onTime} on time</span>
                </div>
                {data.bills.overdue > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-600">{data.bills.overdue} overdue</span>
                  </div>
                )}
                <span className="text-sm text-muted-foreground">{data.bills.total} total</span>
              </div>
              {data.bills.items.length > 0 && (
                <div className="space-y-2">
                  {data.bills.items.map((bill) => (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium">{bill.name || 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground">{bill.pattern}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(bill.amount)}</p>
                        <div className="flex items-center gap-1">
                          <div className={`h-1.5 w-1.5 rounded-full ${
                            bill.status === 'active' ? 'bg-emerald-500' : 'bg-stone-400'
                          }`} />
                          <span className="text-xs text-muted-foreground">{bill.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* What-If Scenarios */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                What If...
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                {data.scenarios.map((scenario) => (
                  <div
                    key={scenario.name}
                    className="rounded-xl border bg-muted/20 p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {scenarioIcon(scenario.name)}
                      <span className="text-sm font-semibold">{scenario.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Cost: {formatCurrency(scenario.cost)}
                    </p>
                    <p className={`text-sm font-semibold ${
                      scenario.monthsRemaining >= 1 ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {scenario.monthsRemaining > 0
                        ? `${Math.round(scenario.monthsRemaining * 10) / 10} months remaining`
                        : 'Would deplete your fund'}
                    </p>
                    {scenario.recoveryWeeks && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Recovery: ~{Math.ceil(scenario.recoveryWeeks / 4.33)} months
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Guide Recommendations */}
            {data.recommendations.length > 0 && (
              <div className="rounded-2xl border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                  <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wide">
                    Your Guide Recommends
                  </h2>
                </div>
                <div className="space-y-3">
                  {data.recommendations.map((rec, i) => (
                    <div key={i} className="flex gap-3">
                      <ArrowRight className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-stone-700 dark:text-stone-300">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
