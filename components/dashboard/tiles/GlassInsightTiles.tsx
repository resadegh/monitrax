'use client';

/**
 * Glass-vocabulary insight tiles for the dashboard (Phase 45.5 ship).
 *
 * Wraps the data + visualisation logic from the existing widgets
 * (`InsightWidgets.tsx`, `DebtQualityWidget.tsx`, `EntityCashflowSummary.tsx`,
 * `MoneyStoryHeroV2`, `DailyPulseCard.tsx`, `PendingActionsPrompt`,
 * `WealthUniverseWidget`, `RenewalsCard`) in the §18.7.2 polished sub-pattern.
 * Each component takes the SAME props as its editorial sibling so the page
 * consumer swap is a 1-line rename.
 *
 * The existing widgets stay in the codebase (used by labs preview routes +
 * possibly other surfaces). These are dashboard-only.
 *
 * Stitch source: project 1859462351962811110, screen
 * `55cff20dae64476fa18879fa0400592f` (Compact Dashboard mobile v1).
 */

import { Activity, Building2, CheckCircle2, Clock, Heart, Landmark, Shield, Sparkles, TrendingUp, Umbrella } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { GlassEyebrow, GlassIconBadge, GlassPanel, type GlassSubPalette } from './GlassPanel';

// =============================================================================
// GLASS HEALTH SCORE
// =============================================================================

interface HealthScoreProps {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    savingsRate: { score: number; weight: number; value: number };
    emergencyFund: { score: number; weight: number; value: number };
    debtToIncome: { score: number; weight: number; value: number };
    diversification: { score: number; weight: number; value: number };
  };
}

const GRADE_MESSAGE: Record<HealthScoreProps['grade'], string> = {
  A: 'Excellent — strong across every lever.',
  B: 'Solid — small wins compound from here.',
  C: 'Building — emergency fund is the next step.',
  D: 'Stretched — focus on the highest-impact lever.',
  F: 'Reset moment — let your Guide pick the first move.',
};

export function GlassHealthScore({ score, grade, breakdown }: HealthScoreProps) {
  const isHealthy = score >= 65;
  const arcLength = Math.max(0, Math.min(100, score)) * 2.51;
  const sub: GlassSubPalette = isHealthy ? 'emerald' : 'amber';

  return (
    <GlassPanel subPalette={sub} radius="tile" padding="p-5" hoverLift>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <GlassIconBadge icon={Heart} subPalette={sub} size="sm" />
            <GlassEyebrow subPalette={sub}>Financial Health</GlassEyebrow>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              isHealthy
                ? 'bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300'
                : 'bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300'
            }`}
          >
            Grade {grade}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Score arc */}
          <div className="relative h-20 w-20 shrink-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="40" stroke="currentColor" strokeOpacity="0.12" strokeWidth="6" fill="none" className="text-foreground" />
              <circle
                cx="48" cy="48" r="40" strokeWidth="6" fill="none"
                strokeDasharray={`${arcLength} 251`}
                strokeLinecap="round"
                stroke={isHealthy ? '#16A34A' : '#F59E0B'}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-semibold tabular-nums leading-none ${isHealthy ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {score}
              </span>
              <span className="mt-0.5 text-[10px] text-muted-foreground">/ 100</span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs leading-relaxed text-muted-foreground">{GRADE_MESSAGE[grade]}</p>
            <dl className="mt-2 space-y-1 text-[11px]">
              <Row label="Savings" value={`${breakdown.savingsRate.value.toFixed(0)}%`} good={breakdown.savingsRate.value >= 20} />
              <Row label="Emergency" value={`${breakdown.emergencyFund.value.toFixed(1)} mo`} good={breakdown.emergencyFund.value >= 6} />
              <Row label="Debt / income" value={`${breakdown.debtToIncome.value.toFixed(0)}%`} good={breakdown.debtToIncome.value <= 30} invert />
            </dl>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function Row({ label, value, good }: { label: string; value: string; good: boolean; invert?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-semibold tabular-nums ${good ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{value}</dd>
    </div>
  );
}

// =============================================================================
// GLASS EMERGENCY FUND
// =============================================================================

interface EmergencyFundProps {
  liquidCash: number;
  monthlyExpenses: number;
  monthsCovered: number;
  target: number;
  status: 'danger' | 'warning' | 'good' | 'excellent';
  gap: number;
}

const EF_STATUS_LABEL: Record<EmergencyFundProps['status'], string> = {
  excellent: 'Excellent',
  good: 'On track',
  warning: 'Building',
  danger: 'Top up',
};

export function GlassEmergencyFund({ monthsCovered, target, status, gap, monthlyExpenses }: EmergencyFundProps) {
  const sub: GlassSubPalette = 'sky';
  const progressPct = Math.min((monthsCovered / target) * 100, 100);
  const isHealthy = status === 'good' || status === 'excellent';

  return (
    <GlassPanel subPalette={sub} radius="tile" padding="p-5" hoverLift>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <GlassIconBadge icon={Umbrella} subPalette={sub} size="sm" />
            <GlassEyebrow subPalette={sub}>Emergency Fund</GlassEyebrow>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              isHealthy
                ? 'bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300'
                : 'bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300'
            }`}
          >
            {EF_STATUS_LABEL[status]}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-3xl font-semibold tabular-nums leading-none tracking-tight text-foreground">
            {monthsCovered.toFixed(1)} <span className="text-base text-muted-foreground">mo</span>
          </span>
          <span className="text-xs text-muted-foreground">
            of {target} months · {formatCurrency(monthlyExpenses)}/month outflow
          </span>
        </div>

        <div className="mt-auto">
          <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-600 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {gap > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {formatCurrency(gap)} more to fully cover {target} months
            </p>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

// =============================================================================
// GLASS DEBT QUALITY
// =============================================================================

import type { DebtQualityData } from '@/components/dashboard/DebtQualityWidget';

export function GlassDebtQuality({ data }: { data: DebtQualityData }) {
  const sub: GlassSubPalette = 'indigo';
  const goodPct = data.totalDebt > 0 ? (data.goodDebt.total / data.totalDebt) * 100 : 0;
  const badPct = data.totalDebt > 0 ? (data.badDebt.total / data.totalDebt) * 100 : 0;
  const tone = data.debtQualityScore >= 70 ? 'Mostly productive' : data.debtQualityScore >= 40 ? 'Mixed' : 'Stretched';

  return (
    <GlassPanel subPalette={sub} radius="tile" padding="p-5" hoverLift>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <GlassIconBadge icon={Landmark} subPalette={sub} size="sm" />
            <GlassEyebrow subPalette={sub}>Debt Quality</GlassEyebrow>
          </div>
          <span className="inline-flex items-center rounded-full bg-indigo-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700 ring-1 ring-indigo-500/20 dark:text-indigo-300">
            {tone}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-3xl font-semibold tabular-nums leading-none tracking-tight text-foreground">
            {data.debtQualityScore.toFixed(0)}
            <span className="text-base text-muted-foreground"> / 100</span>
          </span>
          <span className="text-xs text-muted-foreground">
            quality score · {formatCurrency(data.totalDebt)} total debt
          </span>
        </div>

        <div className="mt-auto flex h-2 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600" style={{ width: `${goodPct}%` }} />
          <div className="h-full bg-gradient-to-r from-amber-500 to-amber-600" style={{ width: `${badPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Good {formatCurrency(data.goodDebt.total)}</span>
          <span>Bad {formatCurrency(data.badDebt.total)}</span>
        </div>
      </div>
    </GlassPanel>
  );
}

// =============================================================================
// GLASS ENTITY CASHFLOW
// =============================================================================

import type { EntityCashflowData } from '@/components/dashboard/EntityCashflowSummary';

export function GlassEntityCashflow({ data }: { data: EntityCashflowData }) {
  const sub: GlassSubPalette = 'sky-indigo';
  const rows: Array<{ name: string; net: number }> = [
    { name: 'Properties', net: data.summary.propertiesNet },
    { name: 'Investments', net: data.summary.investmentsNet },
    { name: 'Income', net: data.summary.incomeNet },
    { name: 'Expenses', net: -Math.abs(data.summary.expensesNet) },
  ].filter((r) => r.net !== 0);

  return (
    <GlassPanel subPalette={sub} radius="tile" padding="p-5" hoverLift>
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <GlassIconBadge icon={Building2} subPalette={sub} size="sm" />
            <GlassEyebrow subPalette={sub}>Entity Cashflow</GlassEyebrow>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span
            className={`text-3xl font-semibold tabular-nums leading-none tracking-tight ${
              data.summary.totalEntityCashflow >= 0
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {data.summary.totalEntityCashflow >= 0 ? '+' : ''}
            {formatCurrency(data.summary.totalEntityCashflow)}
          </span>
          <span className="text-xs text-muted-foreground">
            annual net across {data.properties.length + data.investments.length} entities
          </span>
        </div>

        <ul className="mt-auto space-y-1.5 text-[11px]">
          {rows.slice(0, 4).map((row) => (
            <li key={row.name} className="flex items-center justify-between">
              <span className="truncate text-muted-foreground">{row.name}</span>
              <span
                className={`shrink-0 font-semibold tabular-nums ${
                  row.net >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {row.net >= 0 ? '+' : ''}
                {formatCurrency(row.net)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </GlassPanel>
  );
}

// =============================================================================
// GLASS WEALTH UNIVERSE PLACEHOLDER (wraps existing widget in glass surround)
// =============================================================================

import WealthUniverseWidget from '@/components/wealth-explorer/WealthUniverseWidget';

export function GlassWealthUniverse() {
  return (
    <GlassPanel subPalette="violet" radius="card" padding="p-5">
      <div className="flex items-center gap-2">
        <GlassIconBadge icon={Sparkles} subPalette="violet" size="sm" />
        <GlassEyebrow subPalette="violet">Wealth Universe</GlassEyebrow>
      </div>
      <div className="mt-3 [&>*]:!border-0 [&>*]:!bg-transparent [&>*]:!shadow-none [&>*]:!p-0">
        <WealthUniverseWidget />
      </div>
    </GlassPanel>
  );
}

// =============================================================================
// GLASS DAILY PULSE PLACEHOLDER (small heartbeat tile)
// =============================================================================

import { DailyPulseCard } from '@/components/bookkeeping/DailyPulseCard';

export function GlassDailyPulse() {
  return (
    <GlassPanel subPalette="sky" radius="card" padding="p-5">
      <div className="flex items-center gap-2">
        <GlassIconBadge icon={Activity} subPalette="sky" size="sm" />
        <GlassEyebrow subPalette="sky">Daily Pulse</GlassEyebrow>
      </div>
      <div className="mt-3 [&>*]:!border-0 [&>*]:!bg-transparent [&>*]:!shadow-none">
        <DailyPulseCard />
      </div>
    </GlassPanel>
  );
}

// =============================================================================
// GLASS RENEWALS CARD WRAPPER
// =============================================================================

import { RenewalsCard } from '@/components/reminders/RenewalsCard';

export function GlassRenewals() {
  return (
    <GlassPanel subPalette="amber" radius="card" padding="p-5">
      <div className="flex items-center gap-2">
        <GlassIconBadge icon={Clock} subPalette="amber" size="sm" />
        <GlassEyebrow subPalette="amber">Renewals</GlassEyebrow>
      </div>
      <div className="mt-3 [&>*]:!border-0 [&>*]:!bg-transparent [&>*]:!shadow-none [&_[class*='Card']]:!border-0 [&_[class*='Card']]:!bg-transparent [&_[class*='Card']]:!shadow-none">
        <RenewalsCard />
      </div>
    </GlassPanel>
  );
}

// =============================================================================
// GLASS PENDING ACTIONS WRAPPER
// =============================================================================

import { PendingActionsPrompt } from '@/components/bookkeeping/PendingActionsPrompt';

export function GlassPendingActions() {
  return (
    <GlassPanel subPalette="sky" radius="card" padding="p-5">
      <div className="flex items-center gap-2">
        <GlassIconBadge icon={CheckCircle2} subPalette="sky" size="sm" />
        <GlassEyebrow subPalette="sky">Next Actions</GlassEyebrow>
      </div>
      <div className="mt-3 [&>*]:!border-0 [&>*]:!bg-transparent [&>*]:!shadow-none">
        <PendingActionsPrompt />
      </div>
    </GlassPanel>
  );
}

// =============================================================================
// GLASS MONEY STORY HERO WRAPPER (preserves ribbon chart + animation)
// =============================================================================

import { MoneyStoryHeroV2 } from '@/components/editorial/money-story';
import type { RibbonPoint } from '@/components/editorial/money-story/FreedomRibbonChart';

interface MoneyStoryProps {
  earned: number;
  kept: number;
  freedomYears: number;
  marginDeltaPoints: number;
  ribbon: RibbonPoint[];
}

export function GlassMoneyStoryHero({ earned, kept, freedomYears, marginDeltaPoints, ribbon }: MoneyStoryProps) {
  return (
    <GlassPanel subPalette="emerald" radius="hero" padding="p-0">
      <div className="[&>article]:!border-0 [&>article]:!bg-transparent [&>article]:!shadow-none [&>div]:!border-0 [&>div]:!bg-transparent [&>div]:!shadow-none">
        <MoneyStoryHeroV2
          earned={earned}
          kept={kept}
          freedomYears={freedomYears}
          marginDeltaPoints={marginDeltaPoints}
          trendData={ribbon}
        />
      </div>
    </GlassPanel>
  );
}

// Re-export to keep imports tidy at the consumer.
export { TrendingUp, Shield };
