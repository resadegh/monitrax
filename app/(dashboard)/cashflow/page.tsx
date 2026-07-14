'use client';

/**
 * CASHFLOW — Phase 45.8 redesign.
 *
 * §18.7.2 polished glass vocabulary applied end-to-end. Replaces the
 * previous 8-section editorial column with a hero + 3 Bento Pairs:
 *
 *   1. Hero — confident money-story headline + 4-tile KPI strip (Money In /
 *      Out / Balance / 30-Day Forecast) + Cashflow Health pill.
 *   2. Bento — Money Flow waterfall (sky→indigo) + Next Best Action
 *      (indigo→violet, distilled AI summary).
 *   3. Bento — Budget vs Actual (emerald) + Tax Summary (violet).
 *   4. Bento — Money Leaks ENHANCED (amber) + Saving Opportunities NEW
 *      (emerald, cross-account opportunities sourced from the master
 *      snapshot).
 *
 * Per Reza brief 2026-06-11: keep the leak detector but enhance it with
 * behavioural classifications (duplicate / subscription creep / forgotten
 * sub), and add a new Saving Opportunities tile that surfaces HISA / offset
 * / salary-sacrifice levers across the user's multiple accounts and
 * properties — the stated pain point this redesign solves.
 *
 * Stitch source: project 1859462351962811110, screens
 *   ff0beab3c934409893fe04441120a472 (desktop dark)
 *   60c5d43c95a64920b38a5da2b777faea (desktop light)
 *   be8c24402cad45ae88d55de0daa59781 (mobile dark)
 *   ffda21749e004a4daf958ec437b7e35b (mobile light)
 *
 * Old components preserved (`./components/intelligence/*` non-glass): no
 * consumer references after this PR — flagged for §12.1 cleanup in a later
 * housekeeping PR. Don't delete in the same change as the redesign.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  LineChart,
  Activity,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

const APPLE_EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

import {
  GlassMoneyFlowTile,
  GlassNextBestActionTile,
  GlassBudgetTile,
  GlassTaxTile,
  GlassMoneyLeaksTile,
  GlassSavingOpportunitiesTile,
} from './components/intelligence/glass';
import { SmartActionsEnhanced } from './components/intelligence';

import type { SavingOpportunitiesResult } from '@/lib/cashflow/savingOpportunities';

// =============================================================================
// TYPES
// =============================================================================

interface IntelligenceData {
  healthScore: {
    overallScore: number;
    tier: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'CONCERNING' | 'CRITICAL';
    breakdown: {
      category: string;
      score: number;
      weight: number;
      description: string;
      trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    }[];
    confidence: number;
    lastCalculated: string;
  };
  forecast: {
    current: {
      balance: number;
      income: number;
      expenses: number;
      net: number;
    };
    forecast30Day: {
      predictedBalance: number;
      confidence: number;
      risk: 'LOW' | 'MEDIUM' | 'HIGH';
    };
    forecast90Day: {
      predictedBalance: number;
      confidence: number;
      risk: 'LOW' | 'MEDIUM' | 'HIGH';
    };
    breakEvenDay: number;
    shortfallRisk: boolean;
  };
  leaks: {
    totalLeakage: number;
    leaks: {
      id: string;
      category: string;
      description: string;
      monthlyAmount: number;
      percentOfIncome: number;
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      trend: 'INCREASING' | 'STABLE' | 'DECREASING';
      transactionIds: string[];
      recommendation: string;
    }[];
    topCategories: {
      category: string;
      amount: number;
      percentage: number;
    }[];
    analyzedFrom: string;
    analyzedTo: string;
    transactionCount: number;
  };
  waterfall: {
    items: {
      name: string;
      value: number;
      type: 'income' | 'expense' | 'net';
      isSubtotal?: boolean;
      category?: string;
    }[];
    netIncome: number;
    totalExpenses: number;
    surplus: number;
  };
  budgetComparison?: {
    categories: {
      name: string;
      budgeted: number;
      actual: number;
      variance: number;
      variancePercent: number;
      status: 'UNDER' | 'ON_TRACK' | 'OVER';
    }[];
    totalBudgeted: number;
    totalActual: number;
    totalVariance: number;
    overallStatus: 'UNDER' | 'ON_TRACK' | 'OVER';
    period: { start: string; end: string };
  };
  taxOptimization?: {
    estimatedAnnualTax: number;
    deductibleExpenses: number;
    potentialSavings: number;
    recommendations: {
      id: string;
      title: string;
      description: string;
      potentialSaving: number;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      actionUrl?: string;
    }[];
    effectiveTaxRate: number;
    paygWithheld: number;
    medicareLevy: number; // MON-039a
  };
  smartActions: {
    id: string;
    rank: number;
    title: string;
    description: string;
    impact: number;
    impactDescription: string;
    category: 'SAVE' | 'TRANSFER' | 'CANCEL' | 'OPTIMIZE' | 'REVIEW';
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    source: 'COE' | 'HEALTH' | 'TAX' | 'BUDGET' | 'FORECAST';
    actionUrl?: string;
    learnMoreUrl?: string;
  }[];
  savingOpportunities?: SavingOpportunitiesResult;
  dataQuality: {
    transactionCoverage: number;
    incomeCoverage: number;
    expenseCoverage: number;
    confidence: number;
  };
}

interface SummaryData {
  content: string;
  keyInsights: string[];
  generatedAt: string;
  isStale: boolean;
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function PageSkeleton() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="h-64 rounded-[28px] bg-foreground/[0.04] animate-pulse mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="h-72 rounded-[22px] bg-foreground/[0.04] animate-pulse" />
        <div className="h-72 rounded-[22px] bg-foreground/[0.04] animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="h-72 rounded-[22px] bg-foreground/[0.04] animate-pulse" />
        <div className="h-72 rounded-[22px] bg-foreground/[0.04] animate-pulse" />
      </div>
    </div>
  );
}

// =============================================================================
// ERROR STATE
// =============================================================================

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-rose-500" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Unable to load your cashflow
        </h3>
        <p className="text-muted-foreground mb-6">{error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-[14px] bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// HERO — Phase 45.8 redesign
//
// Confident headline + 4-tile inline KPI strip (Money In / Out / Balance /
// 30-Day Forecast) + Cashflow Health pill. The pill's tone tracks the
// health tier (excellent → emerald, good → sky, moderate → amber, etc.).
// Mobile reflows KPIs to a horizontal swipe strip per §18.7.6 Compact
// Dashboard — we use the same 4 tiles but a `grid-cols-2` collapse below
// `sm:` keeps each tile readable without a custom carousel component.
// =============================================================================

const TIER_COLORS: Record<
  IntelligenceData['healthScore']['tier'],
  { chip: string; label: string }
> = {
  EXCELLENT: {
    chip:
      'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300',
    label: 'Excellent',
  },
  GOOD: {
    chip:
      'border-sky-500/20 bg-sky-500/[0.08] text-sky-700 dark:text-sky-300',
    label: 'Good',
  },
  MODERATE: {
    chip:
      'border-amber-500/20 bg-amber-500/[0.10] text-amber-700 dark:text-amber-300',
    label: 'Moderate',
  },
  CONCERNING: {
    chip:
      'border-amber-500/20 bg-amber-500/[0.12] text-amber-700 dark:text-amber-300',
    label: 'Concerning',
  },
  CRITICAL: {
    chip:
      'border-rose-500/20 bg-rose-500/[0.10] text-rose-700 dark:text-rose-300',
    label: 'Critical',
  },
};

function CashflowHero({
  income,
  expenses,
  net,
  balance,
  forecast30,
  healthScore,
  healthTier,
  refreshing,
  onRefresh,
}: {
  income: number;
  expenses: number;
  net: number;
  balance: number;
  forecast30: number;
  healthScore: number;
  healthTier: IntelligenceData['healthScore']['tier'];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const reduced = useReducedMotion();

  const sentence = useMemo(() => {
    if (net > 0) return 'Money working for you this month — build on it.';
    if (net === 0) return "Every dollar accounted for — that's intentional.";
    return 'Spending edged ahead this month — trim a leak below to close it.';
  }, [net]);

  const heroToneClass =
    net > 0
      ? 'text-emerald-500 dark:text-emerald-400'
      : net < 0
        ? 'text-rose-500 dark:text-rose-400'
        : 'text-foreground';

  const sign = net < 0 ? '−' : net > 0 ? '+' : '';
  const tierMeta = TIER_COLORS[healthTier];

  const kpis = [
    {
      label: 'Money In',
      value: income,
      tone: 'in' as const,
      icon: TrendingUp,
    },
    {
      label: 'Money Out',
      value: expenses,
      tone: 'out' as const,
      icon: TrendingDown,
    },
    {
      label: 'Balance',
      value: balance,
      tone: 'neutral' as const,
      icon: Wallet,
    },
    {
      label: '30-Day Forecast',
      value: forecast30,
      tone: 'forecast' as const,
      icon: LineChart,
    },
  ];

  return (
    <div className="relative isolate overflow-hidden rounded-[28px] border border-foreground/10 bg-card/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] dark:border-foreground/20 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl mb-5">
      {/* Atmospheric mesh — emerald when surplus, amber when shortfall (never
          red — §18.7.2 money-signal row reserves red for true loss) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 1.4, ease: APPLE_EASE }}
        style={{
          background:
            net >= 0
              ? 'radial-gradient(circle at 15% 0%, rgba(16,185,129,0.10), transparent 60%), radial-gradient(circle at 85% 100%, rgba(99,102,241,0.06), transparent 55%)'
              : 'radial-gradient(circle at 15% 0%, rgba(245,158,11,0.10), transparent 60%), radial-gradient(circle at 85% 100%, rgba(244,63,94,0.06), transparent 55%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10"
      />
      <div className="relative p-6 sm:p-8 md:p-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                Cashflow · This month
              </p>
              {healthScore > 0 && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${tierMeta.chip}`}
                  title="Cashflow Health"
                >
                  <Activity className="h-3 w-3" strokeWidth={1.5} />
                  Health {Math.round(healthScore)} · {tierMeta.label}
                </span>
              )}
            </div>

            <motion.div
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.7, ease: APPLE_EASE }}
              className={`text-5xl sm:text-6xl md:text-7xl font-light tracking-[-0.04em] tabular-nums leading-none ${heroToneClass}`}
            >
              {sign}
              {formatCurrency(Math.abs(net))}
            </motion.div>

            <motion.p
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                reduced ? { duration: 0 } : { duration: 0.6, ease: APPLE_EASE, delay: 0.18 }
              }
              className="mt-5 text-base sm:text-lg text-muted-foreground font-normal leading-relaxed max-w-xl"
            >
              {sentence}
            </motion.p>
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-background/60 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-md transition hover:bg-background/80 hover:text-foreground hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shrink-0"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {refreshing ? 'Updating' : 'Refresh'}
          </button>
        </div>

        {/* 4-tile KPI strip — `grid-cols-2` collapse on mobile per §18.7.6
            (the desktop Stitch uses 4 columns; mobile reflows to 2×2 to keep
            every tile legible without a horizontal carousel). */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-6 border-t border-foreground/10">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            const toneClass =
              kpi.tone === 'in'
                ? 'text-emerald-600 dark:text-emerald-400'
                : kpi.tone === 'out'
                  ? 'text-rose-600 dark:text-rose-400'
                  : kpi.tone === 'forecast'
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-foreground';
            return (
              <motion.div
                key={kpi.label}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { duration: 0.5, ease: APPLE_EASE, delay: 0.22 + idx * 0.05 }
                }
                className="flex flex-col gap-1.5"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                  <Icon className="h-3 w-3" strokeWidth={1.5} />
                  {kpi.label}
                </div>
                <div
                  className={`text-lg sm:text-xl lg:text-2xl font-medium tabular-nums tracking-[-0.02em] ${toneClass}`}
                >
                  {formatCurrency(kpi.value)}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CashflowPage() {
  const { token } = useAuth();
  const [intelligence, setIntelligence] = useState<IntelligenceData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fetchIntelligence = useCallback(async () => {
    if (!token) return;

    try {
      setError(null);

      const response = await fetch('/api/cashflow/intelligence', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const json = await response.json();

      if (response.ok && json.success) {
        setIntelligence(json.data);
      } else {
        setError(json.error || 'Failed to load intelligence data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  const fetchSummary = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/cashflow/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return;
      }

      const json = await response.json();

      if (response.ok && json.success && json.data) {
        setSummary({
          content: json.data.content,
          keyInsights: json.data.keyInsights || [],
          generatedAt: json.data.generatedAt,
          isStale: json.data.isStale || false,
        });
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }, [token]);

  const regenerateSummary = useCallback(async () => {
    if (!token) return;
    setSummaryLoading(true);
    try {
      const response = await fetch('/api/cashflow/summary', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (response.ok && json.success && json.data) {
        setSummary({
          content: json.data.content,
          keyInsights: json.data.keyInsights || [],
          generatedAt: json.data.generatedAt,
          isStale: false,
        });
      }
    } catch (err) {
      console.error('Failed to regenerate summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchIntelligence();
      fetchSummary();
    }
  }, [token, fetchIntelligence, fetchSummary]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchIntelligence();
    await fetchSummary();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <ErrorState error={error} onRetry={fetchIntelligence} />
        </div>
      </DashboardLayout>
    );
  }

  if (!intelligence) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <ErrorState
            error="No financial data available. Add accounts, income, and expenses to see your cashflow."
            onRetry={fetchIntelligence}
          />
        </div>
      </DashboardLayout>
    );
  }

  // Top action — the first SmartAction is the route-built rank-1; we surface
  // it via GlassNextBestActionTile and let the SmartActionsEnhanced section
  // below handle the long tail.
  const topAction = intelligence.smartActions[0] ?? null;
  // Distil the AI summary into a single sentence — first newline-separated
  // chunk. Empty falls back to the SmartAction description.
  const distilledHeadline = summary?.content
    ? summary.content.split(/\n+/).find((s) => s.trim().length > 0)?.trim().slice(0, 240)
    : undefined;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <CashflowHero
          income={intelligence.forecast.current.income}
          expenses={intelligence.forecast.current.expenses}
          net={intelligence.forecast.current.net}
          balance={intelligence.forecast.current.balance}
          forecast30={intelligence.forecast.forecast30Day.predictedBalance}
          healthScore={intelligence.healthScore.overallScore}
          healthTier={intelligence.healthScore.tier}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />

        {/* Bento Pair 1 — Money Flow + Next Best Action */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <GlassMoneyFlowTile
            items={intelligence.waterfall.items}
            netIncome={intelligence.waterfall.netIncome}
            totalExpenses={intelligence.waterfall.totalExpenses}
            surplus={intelligence.waterfall.surplus}
          />
          <GlassNextBestActionTile
            topAction={topAction}
            summaryHeadline={distilledHeadline}
            isLoading={summaryLoading}
            onRegenerate={regenerateSummary}
          />
        </div>

        {/* Bento Pair 2 — Budget + Tax */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <GlassBudgetTile
            categories={intelligence.budgetComparison?.categories ?? []}
            totalBudgeted={intelligence.budgetComparison?.totalBudgeted ?? 0}
            totalActual={intelligence.budgetComparison?.totalActual ?? 0}
            totalVariance={intelligence.budgetComparison?.totalVariance ?? 0}
            overallStatus={intelligence.budgetComparison?.overallStatus ?? 'ON_TRACK'}
            periodStart={new Date(intelligence.budgetComparison?.period.start ?? Date.now())}
            periodEnd={new Date(intelligence.budgetComparison?.period.end ?? Date.now())}
          />
          {intelligence.taxOptimization ? (
            <GlassTaxTile
              estimatedAnnualTax={intelligence.taxOptimization.estimatedAnnualTax}
              deductibleExpenses={intelligence.taxOptimization.deductibleExpenses}
              potentialSavings={intelligence.taxOptimization.potentialSavings}
              recommendations={intelligence.taxOptimization.recommendations}
              effectiveTaxRate={intelligence.taxOptimization.effectiveTaxRate}
              paygWithheld={intelligence.taxOptimization.paygWithheld}
              medicareLevy={intelligence.taxOptimization.medicareLevy}
            />
          ) : (
            <GlassTaxTile
              estimatedAnnualTax={0}
              deductibleExpenses={0}
              potentialSavings={0}
              recommendations={[]}
              effectiveTaxRate={0}
              paygWithheld={0}
              medicareLevy={0}
            />
          )}
        </div>

        {/* Bento Pair 3 — Money Leaks (enhanced) + Saving Opportunities (NEW) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <GlassMoneyLeaksTile
            totalLeakage={intelligence.leaks.totalLeakage}
            leaks={intelligence.leaks.leaks}
            transactionCount={intelligence.leaks.transactionCount}
          />
          <GlassSavingOpportunitiesTile
            opportunities={intelligence.savingOpportunities?.opportunities ?? []}
            totalEstimatedAnnualBenefit={
              intelligence.savingOpportunities?.totalEstimatedAnnualBenefit ?? 0
            }
          />
        </div>

        {/* Smart Actions long-tail (rank 2+) — retained per Reza brief: don't
            remove tiles, only redesign. SmartActionsEnhanced already handles
            the long list and matches the rest of the page's visual weight. */}
        {intelligence.smartActions.length > 1 && (
          <div className="mb-5">
            <SmartActionsEnhanced actions={intelligence.smartActions.slice(1)} />
          </div>
        )}

        <div className="flex items-center justify-center gap-4 py-4 text-xs text-muted-foreground/70">
          <span>Data coverage: {intelligence.dataQuality.confidence.toFixed(0)}%</span>
          <span>•</span>
          <span>{intelligence.leaks.transactionCount} transactions analysed</span>
        </div>
      </div>
    </DashboardLayout>
  );
}
