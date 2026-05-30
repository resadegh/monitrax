'use client';

/**
 * InsightWidgets — the diagnostic + spending widgets that flank the dashboard.
 * Workstream 0·StD Phase R5 PR1 (2026-05-30) — full restyle from legacy
 * Card/Badge/Progress + hard-coded blue/green/red/orange/purple to the
 * editorial vocabulary (EditorialCard + Eyebrow + DataValue + DeltaChip +
 * editorial-* tokens).
 *
 * Public interfaces preserved — consumers in `app/dashboard/page.tsx` are
 * unchanged.
 *
 * Editorial rules followed:
 *   - "Never red" — danger/warning/over-budget all render in amber, never red.
 *     Red is destructive-action-only (delete confirmations).
 *   - Single emerald accent for positives + sparingly used TRAIL spectrum
 *     (sky / indigo / violet / amber) for stage / category chips.
 *   - 1.5px card borders, navy text on ivory, slate-500 secondary, calm
 *     hue contrast — no shame, no alarm, no flames.
 *   - Tabular nums on all $ + % values.
 *
 * @see docs/architecture/06_UI_UX_FOUNDATION.md §16.x Restrained Editorial
 */

import {
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowRight,
  ArrowDown,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import {
  EditorialCard,
  Eyebrow,
  DataValue,
  DeltaChip,
} from '@/components/editorial';
import { cn } from '@/lib/utils';

// =============================================================================
// FINANCIAL HEALTH SCORE
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

/** Grade → editorial tone. No red — F drops to amber per the editorial rule. */
const GRADE_TONE: Record<HealthScoreProps['grade'], { text: string; chip: string }> = {
  A: { text: 'text-editorial-emerald', chip: 'bg-editorial-emerald/10 text-editorial-emerald' },
  B: { text: 'text-editorial-emerald', chip: 'bg-editorial-emerald/10 text-editorial-emerald' },
  C: { text: 'text-editorial-ink', chip: 'bg-editorial-tint text-editorial-ink' },
  D: { text: 'text-editorial-amber', chip: 'bg-editorial-amber/10 text-editorial-amber' },
  F: { text: 'text-editorial-amber', chip: 'bg-editorial-amber/10 text-editorial-amber' },
};

const GRADE_MESSAGE: Record<HealthScoreProps['grade'], string> = {
  A: 'Excellent financial health.',
  B: 'Solid — small wins to make.',
  C: 'On track — focus on the weakest band.',
  D: 'Needs attention this quarter.',
  F: 'Time to act — start with the smallest fix.',
};

function bandText(value: number, good: number, neutral: number, invert = false): string {
  const isGood = invert ? value <= good : value >= good;
  const isNeutral = invert ? value <= neutral : value >= neutral;
  if (isGood) return 'text-editorial-emerald';
  if (isNeutral) return 'text-editorial-ink';
  return 'text-editorial-amber';
}

export function FinancialHealthScore({ score, grade, breakdown }: HealthScoreProps) {
  const tone = GRADE_TONE[grade];
  const arcLength = Math.max(0, Math.min(100, score)) * 2.51; // 0..251 of circumference

  return (
    <EditorialCard hover aria-label="Financial health score">
      <header className="flex items-center justify-between">
        <Eyebrow>Financial Health</Eyebrow>
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-[12px] font-semibold tabular-nums-data',
            tone.chip
          )}
        >
          Grade {grade}
        </span>
      </header>

      <div className="mt-4 flex items-center gap-6">
        {/* Score arc — single emerald accent for healthy, amber for weak.
            Track in editorial-divider; no multi-colour scale. */}
        <div className="relative h-24 w-24 shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="hsl(var(--editorial-divider))"
              strokeWidth="6"
              fill="none"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke={`hsl(var(--editorial-${score >= 65 ? 'emerald' : 'amber'}))`}
              strokeWidth="6"
              fill="none"
              strokeDasharray={`${arcLength} 251`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-[26px] font-semibold leading-none tabular-nums-data', tone.text)}>
              {score}
            </span>
            <span className="mt-0.5 text-[11px] text-editorial-slate">/ 100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-relaxed text-editorial-slate">{GRADE_MESSAGE[grade]}</p>
          <dl className="mt-3 space-y-1 text-[13px]">
            <div className="flex items-center justify-between">
              <dt className="text-editorial-slate">Savings rate</dt>
              <dd className={cn('font-medium tabular-nums-data', bandText(breakdown.savingsRate.value, 20, 10))}>
                {breakdown.savingsRate.value.toFixed(0)}%
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-editorial-slate">Emergency fund</dt>
              <dd className={cn('font-medium tabular-nums-data', bandText(breakdown.emergencyFund.value, 6, 3))}>
                {breakdown.emergencyFund.value.toFixed(1)} mo
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-editorial-slate">Debt / income</dt>
              <dd className={cn('font-medium tabular-nums-data', bandText(breakdown.debtToIncome.value, 30, 50, true))}>
                {breakdown.debtToIncome.value.toFixed(0)}%
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </EditorialCard>
  );
}

// =============================================================================
// EMERGENCY FUND TRACKER
// =============================================================================

interface EmergencyFundProps {
  liquidCash: number;
  monthlyExpenses: number;
  monthsCovered: number;
  target: number;
  status: 'danger' | 'warning' | 'good' | 'excellent';
  gap: number;
}

const EF_STATUS: Record<EmergencyFundProps['status'], { label: string; tone: 'emerald' | 'amber' | 'slate'; icon: typeof Shield }> = {
  excellent: { label: 'Excellent', tone: 'emerald', icon: CheckCircle2 },
  good: { label: 'Building', tone: 'emerald', icon: TrendingUp },
  warning: { label: 'Building', tone: 'amber', icon: AlertTriangle },
  danger: { label: 'Critical', tone: 'amber', icon: AlertTriangle },
};

export function EmergencyFundTracker({
  liquidCash,
  monthlyExpenses,
  monthsCovered,
  target,
  status,
  gap,
}: EmergencyFundProps) {
  const cfg = EF_STATUS[status];
  const StatusIcon = cfg.icon;
  const progressPct = Math.min((monthsCovered / target) * 100, 100);
  const fillClass =
    cfg.tone === 'emerald' ? 'bg-editorial-emerald' : 'bg-editorial-amber';
  const valueClass =
    cfg.tone === 'emerald' ? 'text-editorial-emerald' : 'text-editorial-amber';

  return (
    <EditorialCard hover aria-label="Emergency fund tracker">
      <header className="flex items-center justify-between">
        <Eyebrow>Emergency Fund</Eyebrow>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium',
            cfg.tone === 'emerald'
              ? 'bg-editorial-emerald/10 text-editorial-emerald'
              : 'bg-editorial-amber/10 text-editorial-amber'
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </span>
      </header>

      <div className="mt-4 text-center">
        <div className={cn('text-[40px] font-semibold leading-none tabular-nums-data', valueClass)}>
          {monthsCovered.toFixed(1)}
        </div>
        <div className="mt-1 text-[13px] text-editorial-slate">months of expenses covered</div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-[11px] text-editorial-slate">
          <span>Progress to {target} months</span>
          <span className="tabular-nums-data">{progressPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-editorial-tint">
          <div
            className={cn('h-full rounded-full transition-all duration-500', fillClass)}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between px-1 text-[11px] text-editorial-slate tabular-nums-data">
          <span>0</span>
          <span>3</span>
          <span>6</span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-editorial-divider pt-3 text-[13px]">
        <div>
          <dt className="text-editorial-slate">Cash available</dt>
          <dd className="font-semibold tabular-nums-data text-editorial-ink">{formatCurrency(liquidCash)}</dd>
        </div>
        <div>
          <dt className="text-editorial-slate">Monthly expenses</dt>
          <dd className="font-semibold tabular-nums-data text-editorial-ink">{formatCurrency(monthlyExpenses)}</dd>
        </div>
      </dl>

      {gap > 0 && (
        <p className="mt-4 rounded-lg border border-editorial-amber/30 bg-editorial-amber/10 p-3 text-[13px] text-editorial-amber">
          Save <strong className="font-semibold">{formatCurrency(gap)}</strong> more to reach your {target}-month target.
        </p>
      )}
    </EditorialCard>
  );
}

// =============================================================================
// MONEY BLEEDING
// =============================================================================

interface SpendingItem {
  name: string;
  category: string;
  monthlyAmount: number;
  annualAmount: number;
  percentageOfIncome: number;
  suggestion?: string;
}

interface MoneyBleedingProps {
  items: SpendingItem[];
  monthlyIncome: number;
}

export function MoneyBleedingCard({ items }: MoneyBleedingProps) {
  const topItems = items.slice(0, 5);
  const totalMonthly = topItems.reduce((sum, item) => sum + item.monthlyAmount, 0);

  return (
    <EditorialCard hover aria-label="Where your money goes">
      <Eyebrow>Where Your Money Goes</Eyebrow>

      <ul className="mt-4 space-y-3">
        {topItems.map((item, index) => {
          // Single-accent bar — amber for the bigger leaks, slate for routine.
          // No red. Width is the % of income (capped at 100); the bar tells the
          // story without alarm.
          const barWidth = Math.min(item.percentageOfIncome * 3, 100);
          const isHeavy = item.percentageOfIncome > 10;
          const barClass = isHeavy ? 'bg-editorial-amber' : 'bg-editorial-slate/60';
          return (
            <li key={index} className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[13px] font-medium text-editorial-ink">
                  {item.name}
                </span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums-data text-editorial-ink">
                  {formatCurrency(item.monthlyAmount)}/mo
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-editorial-tint">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', barClass)}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-[11px] text-editorial-slate tabular-nums-data">
                  {item.percentageOfIncome.toFixed(1)}%
                </span>
              </div>
              {item.suggestion && (
                <p className="flex items-center gap-1 text-[12px] text-editorial-amber">
                  <Info className="h-3 w-3" />
                  {item.suggestion}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-editorial-divider pt-3">
        <span className="text-[13px] text-editorial-slate">Top 5 expenses total</span>
        <span className="text-[14px] font-semibold tabular-nums-data text-editorial-ink">
          {formatCurrency(totalMonthly)}/mo
        </span>
      </div>
    </EditorialCard>
  );
}

// =============================================================================
// SPENDING BY CATEGORY
// =============================================================================

interface CategorySpending {
  category: string;
  monthlyAmount: number;
  annualAmount: number;
  percentage: number;
  items: Array<{ name: string; monthlyAmount: number }>;
}

interface SpendingByCategoryProps {
  categories: CategorySpending[];
}

/** TRAIL spectrum applied to spending categories. Stable order; no alarmist colour. */
const CATEGORY_DOT = [
  'bg-editorial-sky',
  'bg-editorial-emerald',
  'bg-editorial-indigo',
  'bg-editorial-violet',
  'bg-editorial-amber',
  'bg-editorial-slate',
];
const CATEGORY_FILL = [
  'bg-editorial-sky',
  'bg-editorial-emerald',
  'bg-editorial-indigo',
  'bg-editorial-violet',
  'bg-editorial-amber',
  'bg-editorial-slate',
];

export function SpendingByCategory({ categories }: SpendingByCategoryProps) {
  const topCategories = categories.slice(0, 6);

  return (
    <EditorialCard hover aria-label="Spending by category">
      <Eyebrow>Spending by Category</Eyebrow>

      <ul className="mt-4 space-y-3">
        {topCategories.map((cat, index) => (
          <li key={cat.category} className="space-y-1">
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex min-w-0 items-center gap-2">
                <div className={cn('h-2.5 w-2.5 shrink-0 rounded-full', CATEGORY_DOT[index % CATEGORY_DOT.length])} />
                <span className="truncate font-medium text-editorial-ink">{cat.category}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 tabular-nums-data">
                <span className="font-semibold text-editorial-ink">{formatCurrency(cat.monthlyAmount)}</span>
                <span className="text-[11px] text-editorial-slate">({cat.percentage.toFixed(0)}%)</span>
              </div>
            </div>
            <div className="ml-[18px] h-1.5 overflow-hidden rounded-full bg-editorial-tint">
              <div
                className={cn('h-full rounded-full transition-all duration-500', CATEGORY_FILL[index % CATEGORY_FILL.length])}
                style={{ width: `${cat.percentage}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </EditorialCard>
  );
}

// =============================================================================
// ACTIONABLE INSIGHTS
// =============================================================================

interface Insight {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  metric?: string;
  action?: string;
}

interface ActionableInsightsProps {
  insights: Insight[];
}

const INSIGHT_TONE: Record<
  Insight['type'],
  { wrap: string; chip: string; icon: typeof Info; iconClass: string }
> = {
  success: {
    wrap: 'border-editorial-emerald/30 bg-editorial-emerald/5',
    chip: 'bg-editorial-emerald/10 text-editorial-emerald',
    icon: CheckCircle2,
    iconClass: 'text-editorial-emerald',
  },
  warning: {
    wrap: 'border-editorial-amber/30 bg-editorial-amber/5',
    chip: 'bg-editorial-amber/10 text-editorial-amber',
    icon: AlertTriangle,
    iconClass: 'text-editorial-amber',
  },
  // "danger" maps to amber per the editorial "never red" rule.
  danger: {
    wrap: 'border-editorial-amber/30 bg-editorial-amber/5',
    chip: 'bg-editorial-amber/10 text-editorial-amber',
    icon: AlertTriangle,
    iconClass: 'text-editorial-amber',
  },
  info: {
    wrap: 'border-editorial-divider bg-editorial-warm',
    chip: 'bg-editorial-tint text-editorial-slate',
    icon: Info,
    iconClass: 'text-editorial-slate',
  },
};

export function ActionableInsights({ insights }: ActionableInsightsProps) {
  return (
    <EditorialCard hover aria-label="Actionable insights">
      <Eyebrow>What You Should Know</Eyebrow>

      <ul className="mt-4 space-y-3">
        {insights.map((insight, index) => {
          const tone = INSIGHT_TONE[insight.type];
          const Icon = tone.icon;
          return (
            <li key={index} className={cn('rounded-lg border p-3', tone.wrap)}>
              <div className="flex gap-3">
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone.iconClass)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-[14px] font-semibold text-editorial-ink">{insight.title}</h4>
                    {insight.metric && (
                      <span
                        className={cn(
                          'shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums-data',
                          tone.chip
                        )}
                      >
                        {insight.metric}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-editorial-slate">{insight.message}</p>
                  {insight.action && (
                    <p className="mt-2 flex items-center gap-1 text-[12px] font-medium text-editorial-emerald">
                      <ArrowRight className="h-3 w-3" />
                      {insight.action}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </EditorialCard>
  );
}

// =============================================================================
// MONTHLY BUDGET SUMMARY
// =============================================================================

interface MonthlyBudgetProps {
  income: number;
  essentialExpenses: number;
  discretionaryExpenses: number;
  loanPayments: number;
  remaining: number;
  dailyBudget: number;
}

/** Width threshold (percentage of income) above which a bar segment renders its
 *  inline label text. Pure presentation — the segment is too narrow to fit
 *  legible copy below 15%. Not a financial constant. */
const SEGMENT_LABEL_MIN_PCT = 15;

export function MonthlyBudgetSummary({
  income,
  essentialExpenses,
  discretionaryExpenses,
  loanPayments,
  remaining,
  dailyBudget,
}: MonthlyBudgetProps) {
  // All width math is presentational; income guard prevents NaN.
  const pct = (n: number) => (income > 0 ? (n / income) * 100 : 0);
  const essentialPct = pct(essentialExpenses);
  const discretionaryPct = pct(discretionaryExpenses);
  const loanPct = pct(loanPayments);
  const remainingPct = pct(remaining);

  return (
    <EditorialCard hover aria-label="This month's budget">
      <Eyebrow>This Month&rsquo;s Budget</Eyebrow>

      {/* Income → Expenses flow visualisation */}
      <div className="mt-4 space-y-2">
        <div className="relative h-9 overflow-hidden rounded-lg bg-editorial-emerald/10">
          <div className="absolute inset-0 flex items-center justify-between px-3">
            <span className="text-[13px] font-medium text-editorial-emerald">Income</span>
            <DataValue size="md" className="text-editorial-emerald">
              {formatCurrency(income)}
            </DataValue>
          </div>
        </div>
        <div className="flex justify-center">
          <ArrowDown className="h-4 w-4 text-editorial-slate" />
        </div>
        <div className="flex h-9 overflow-hidden rounded-lg bg-editorial-tint">
          {essentialExpenses > 0 && (
            <div
              className="flex h-full items-center justify-center bg-editorial-sky"
              style={{ width: `${essentialPct}%` }}
            >
              {essentialPct > SEGMENT_LABEL_MIN_PCT && (
                <span className="text-[11px] font-medium text-white">Essential</span>
              )}
            </div>
          )}
          {discretionaryExpenses > 0 && (
            <div
              className="flex h-full items-center justify-center bg-editorial-indigo"
              style={{ width: `${discretionaryPct}%` }}
            >
              {discretionaryPct > SEGMENT_LABEL_MIN_PCT && (
                <span className="text-[11px] font-medium text-white">Wants</span>
              )}
            </div>
          )}
          {loanPayments > 0 && (
            <div
              className="flex h-full items-center justify-center bg-editorial-violet"
              style={{ width: `${loanPct}%` }}
            >
              {loanPct > SEGMENT_LABEL_MIN_PCT && (
                <span className="text-[11px] font-medium text-white">Loans</span>
              )}
            </div>
          )}
          {remaining > 0 && (
            <div
              className="flex h-full items-center justify-center bg-editorial-emerald"
              style={{ width: `${remainingPct}%` }}
            >
              {remainingPct > SEGMENT_LABEL_MIN_PCT && (
                <span className="text-[11px] font-medium text-white">Saved</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <dl className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
        <LegendRow dotClass="bg-editorial-sky" label="Essential" value={formatCurrency(essentialExpenses)} />
        <LegendRow dotClass="bg-editorial-indigo" label="Wants" value={formatCurrency(discretionaryExpenses)} />
        <LegendRow dotClass="bg-editorial-violet" label="Loans" value={formatCurrency(loanPayments)} />
        <LegendRow
          dotClass="bg-editorial-emerald"
          label="Saved"
          value={formatCurrency(remaining)}
          valueClass="text-editorial-emerald"
        />
      </dl>

      {/* Daily budget */}
      {dailyBudget > 0 && (
        <div className="mt-4 border-t border-editorial-divider pt-3 text-center">
          <p className="text-[12px] text-editorial-slate">Daily spending budget</p>
          <p className="mt-1 text-[24px] font-semibold tabular-nums-data text-editorial-emerald">
            {formatCurrency(dailyBudget)}
          </p>
        </div>
      )}
    </EditorialCard>
  );
}

function LegendRow({
  dotClass,
  label,
  value,
  valueClass,
}: {
  dotClass: string;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotClass)} />
      <span className="text-editorial-slate">{label}</span>
      <span className={cn('ml-auto font-medium tabular-nums-data text-editorial-ink', valueClass)}>{value}</span>
    </div>
  );
}
