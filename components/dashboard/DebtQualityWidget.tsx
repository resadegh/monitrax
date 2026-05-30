'use client';

/**
 * DebtQualityWidget — categorises a portfolio's loans into Good (tax-deductible
 * + wealth-building) / Neutral (primary residence) / Bad (consumer) and surfaces
 * a 0-100 debt-quality score. Workstream 0·StD Phase R5 PR2 (2026-05-30) restyles
 * the widget from legacy Card + hard-coded green/blue/red/orange/yellow to the
 * editorial vocabulary (EditorialCard + Eyebrow + DataValue + editorial-* tokens).
 *
 * Public API preserved: `DebtCategory`, `DebtBreakdown`, `DebtQualityData`,
 * `DebtQualityWidget`, and `calculateDebtQuality` exports are unchanged.
 * Consumers in `app/dashboard/page.tsx` are not touched.
 *
 * Editorial rules:
 *   - "Never red." Bad Debt renders in amber, not red — it's a fact to surface
 *     calmly, not an alarm. Red stays destructive-action-only.
 *   - Single emerald accent for Good Debt; sky for Neutral (TRAIL Track tone);
 *     amber for Bad. The score arc uses emerald (≥65), slate (40-65), amber (<40).
 *   - 1.5px borders, navy text on ivory, tabular nums on all $ and %.
 */

import Link from 'next/link';
import {
  TrendingUp,
  Home,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { EditorialCard, Eyebrow } from '@/components/editorial';
import { cn } from '@/lib/utils';

// =============================================================================
// PUBLIC TYPES (UNCHANGED)
// =============================================================================

export type DebtCategory = 'good' | 'neutral' | 'bad';

export interface DebtBreakdown {
  type: string;
  principal: number;
  interestRate: number;
  monthlyRepayment: number;
  propertyName?: string | null;
  isDeductible: boolean;
}

export interface DebtQualityData {
  goodDebt: {
    total: number;
    loans: DebtBreakdown[];
    weightedRate: number;
  };
  neutralDebt: {
    total: number;
    loans: DebtBreakdown[];
    weightedRate: number;
  };
  badDebt: {
    total: number;
    loans: DebtBreakdown[];
    weightedRate: number;
  };
  totalDebt: number;
  debtQualityScore: number; // 0-100, higher = more "good" debt
  marginalTaxRate?: number;
}

interface DebtQualityWidgetProps {
  data: DebtQualityData;
  onDrillDown?: (category: DebtCategory) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Effective interest rate after tax benefits for deductible loans. */
function calculateEffectiveRate(rate: number, isDeductible: boolean, marginalTaxRate: number = 0.37): number {
  if (!isDeductible) return rate;
  return rate * (1 - marginalTaxRate);
}

type CategoryConfig = {
  label: string;
  description: string;
  tone: 'emerald' | 'sky' | 'amber';
  icon: typeof TrendingUp;
};

const CATEGORY_CONFIG: Record<DebtCategory, CategoryConfig> = {
  good: {
    label: 'Good Debt',
    description: 'Tax-deductible, wealth-building',
    tone: 'emerald',
    icon: TrendingUp,
  },
  neutral: {
    label: 'Neutral Debt',
    description: 'Primary residence',
    tone: 'sky',
    icon: Home,
  },
  // Bad debt — amber, NOT red. Calm fact, not an alarm.
  bad: {
    label: 'Bad Debt',
    description: 'Consumer, non-deductible',
    tone: 'amber',
    icon: AlertTriangle,
  },
};

const TONE_TEXT: Record<CategoryConfig['tone'], string> = {
  emerald: 'text-editorial-emerald',
  sky: 'text-editorial-sky',
  amber: 'text-editorial-amber',
};
const TONE_BG_SOFT: Record<CategoryConfig['tone'], string> = {
  emerald: 'bg-editorial-emerald/5 hover:bg-editorial-emerald/10 border-editorial-emerald/30',
  sky: 'bg-editorial-sky/5 hover:bg-editorial-sky/10 border-editorial-sky/30',
  amber: 'bg-editorial-amber/5 hover:bg-editorial-amber/10 border-editorial-amber/30',
};
const TONE_FILL: Record<CategoryConfig['tone'], string> = {
  emerald: 'bg-editorial-emerald',
  sky: 'bg-editorial-sky',
  amber: 'bg-editorial-amber',
};
const TONE_CHIP: Record<CategoryConfig['tone'], string> = {
  emerald: 'bg-editorial-emerald/10 text-editorial-emerald',
  sky: 'bg-editorial-sky/10 text-editorial-sky',
  amber: 'bg-editorial-amber/10 text-editorial-amber',
};

/** Score → editorial tone + concise message. No multi-color scale; emerald
 *  (healthy), slate (mixed), amber (concerning). No red. */
function getScoreInterpretation(
  score: number
): { label: string; tone: 'emerald' | 'slate' | 'amber'; message: string } {
  if (score >= 80) return { label: 'Excellent', tone: 'emerald', message: 'Your debt is mostly wealth-building.' };
  if (score >= 60) return { label: 'Good', tone: 'emerald', message: 'Good mix — small wins to make.' };
  if (score >= 40) return { label: 'Fair', tone: 'slate', message: 'Consider reducing consumer debt.' };
  if (score >= 20) return { label: 'Watch', tone: 'amber', message: 'High consumer debt — prioritise payoff.' };
  return { label: 'Act now', tone: 'amber', message: 'Focus on eliminating bad debt.' };
}

// =============================================================================
// WIDGET
// =============================================================================

export function DebtQualityWidget({ data, onDrillDown }: DebtQualityWidgetProps) {
  const { goodDebt, neutralDebt, badDebt, totalDebt, debtQualityScore, marginalTaxRate = 0.37 } = data;
  const interp = getScoreInterpretation(debtQualityScore);

  const goodPercent = totalDebt > 0 ? (goodDebt.total / totalDebt) * 100 : 0;
  const neutralPercent = totalDebt > 0 ? (neutralDebt.total / totalDebt) * 100 : 0;
  const badPercent = totalDebt > 0 ? (badDebt.total / totalDebt) * 100 : 0;

  // No debt — quiet celebration, single emerald accent.
  if (totalDebt === 0) {
    return (
      <EditorialCard hover aria-label="Debt quality">
        <Eyebrow>Debt Quality</Eyebrow>
        <div className="mt-6 py-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-editorial-emerald" />
          <p className="mt-3 text-[16px] font-semibold text-editorial-emerald">Debt free.</p>
          <p className="mt-1 text-[13px] text-editorial-slate">No liabilities recorded.</p>
        </div>
      </EditorialCard>
    );
  }

  const scoreArc = Math.max(0, Math.min(100, debtQualityScore)) * 2.01; // /201 circumference
  const scoreStroke =
    interp.tone === 'emerald' ? 'var(--editorial-emerald)' :
    interp.tone === 'slate' ? 'var(--editorial-slate)' : 'var(--editorial-amber)';

  return (
    <EditorialCard hover aria-label="Debt quality">
      <header className="flex items-center justify-between">
        <Eyebrow>Debt Quality</Eyebrow>
        <span className={cn('rounded-md px-2 py-0.5 text-[12px] font-medium', TONE_CHIP[interp.tone === 'slate' ? 'sky' : interp.tone])}>
          {interp.label}
        </span>
      </header>

      {/* Score + summary */}
      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" stroke="hsl(var(--editorial-divider))" strokeWidth="6" fill="none" />
            <circle
              cx="40"
              cy="40"
              r="32"
              stroke={`hsl(${scoreStroke})`}
              strokeWidth="6"
              fill="none"
              strokeDasharray={`${scoreArc} 201`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('text-[20px] font-semibold tabular-nums-data', interp.tone === 'slate' ? 'text-editorial-ink' : TONE_TEXT[interp.tone])}>
              {debtQualityScore}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-relaxed text-editorial-slate">{interp.message}</p>
          <p className="mt-1 text-[12px] text-editorial-slate tabular-nums-data">
            Total {formatCurrency(totalDebt)}
          </p>
        </div>
      </div>

      {/* Stacked composition bar — single tones, no red */}
      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-editorial-tint">
        {goodPercent > 0 && (
          <div className={cn('h-full', TONE_FILL.emerald)} style={{ width: `${goodPercent}%` }} title={`Good ${formatCurrency(goodDebt.total)}`} />
        )}
        {neutralPercent > 0 && (
          <div className={cn('h-full', TONE_FILL.sky)} style={{ width: `${neutralPercent}%` }} title={`Neutral ${formatCurrency(neutralDebt.total)}`} />
        )}
        {badPercent > 0 && (
          <div className={cn('h-full', TONE_FILL.amber)} style={{ width: `${badPercent}%` }} title={`Bad ${formatCurrency(badDebt.total)}`} />
        )}
      </div>

      {/* Category cards */}
      <div className="mt-4 space-y-2">
        {goodDebt.total > 0 && (
          <CategoryCard
            category="good"
            total={goodDebt.total}
            loanCount={goodDebt.loans.length}
            rate={goodDebt.weightedRate}
            isDeductible
            marginalTaxRate={marginalTaxRate}
            onDrillDown={onDrillDown}
          />
        )}
        {neutralDebt.total > 0 && (
          <CategoryCard
            category="neutral"
            total={neutralDebt.total}
            loanCount={neutralDebt.loans.length}
            rate={neutralDebt.weightedRate}
            onDrillDown={onDrillDown}
          />
        )}
        {badDebt.total > 0 && (
          <CategoryCard
            category="bad"
            total={badDebt.total}
            loanCount={badDebt.loans.length}
            rate={badDebt.weightedRate}
            onDrillDown={onDrillDown}
          />
        )}
      </div>

      {/* Action link */}
      <div className="mt-4 border-t border-editorial-divider pt-3">
        <Link
          href="/dashboard/debt-planner"
          className="flex items-center justify-between text-[13px] font-medium text-editorial-emerald hover:text-editorial-ink"
        >
          <span>View Debt Payoff Strategy</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </EditorialCard>
  );
}

function CategoryCard({
  category,
  total,
  loanCount,
  rate,
  isDeductible = false,
  marginalTaxRate = 0.37,
  onDrillDown,
}: {
  category: DebtCategory;
  total: number;
  loanCount: number;
  rate: number;
  isDeductible?: boolean;
  marginalTaxRate?: number;
  onDrillDown?: (category: DebtCategory) => void;
}) {
  const cfg = CATEGORY_CONFIG[category];
  const Icon = cfg.icon;
  const effective = calculateEffectiveRate(rate, isDeductible, marginalTaxRate);
  const subjectNoun = loanCount === 1 ? 'loan' : 'loans';
  // Description text per category — defined in CATEGORY_CONFIG; surface short detail.
  const detailText =
    category === 'good' ? 'Investment · Business' :
    category === 'neutral' ? 'Primary residence' :
    'Car · Personal · Credit';

  return (
    <button
      type="button"
      onClick={() => onDrillDown?.(category)}
      className={cn(
        'flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors',
        TONE_BG_SOFT[cfg.tone]
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={cn('h-4 w-4 shrink-0', TONE_TEXT[cfg.tone])} />
          <span className={cn('text-[14px] font-semibold', TONE_TEXT[cfg.tone])}>
            {cfg.label}
          </span>
          {isDeductible && (
            <span className="rounded-md bg-editorial-emerald/10 px-1.5 py-0.5 text-[10px] font-medium text-editorial-emerald">
              Tax deductible
            </span>
          )}
        </div>
        <span className={cn('shrink-0 text-[14px] font-semibold tabular-nums-data', TONE_TEXT[cfg.tone])}>
          {formatCurrency(total)}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-editorial-slate">
        <span>{loanCount} {subjectNoun} · {detailText}</span>
        <span className="tabular-nums-data">
          {isDeductible ? <>Effective {effective.toFixed(2)}% (after tax)</> : <>Rate {rate.toFixed(2)}%</>}
        </span>
      </div>
    </button>
  );
}

// Helper function to calculate debt quality data from loans
export function calculateDebtQuality(
  loans: Array<{
    id: string;
    name: string;
    type: string;
    principal: number;
    interestRate: number;
    minRepayment?: number;
    repaymentFrequency?: string;
    propertyId?: string | null;
    propertyName?: string | null;
    annualRepayment?: number;
  }>,
  marginalTaxRate: number = 0.37
): DebtQualityData {
  const goodLoans: DebtBreakdown[] = [];
  const neutralLoans: DebtBreakdown[] = [];
  const badLoans: DebtBreakdown[] = [];

  loans.forEach(loan => {
    const breakdown: DebtBreakdown = {
      type: loan.type,
      principal: loan.principal,
      interestRate: loan.interestRate,
      monthlyRepayment: (loan.annualRepayment || 0) / 12,
      propertyName: loan.propertyName,
      isDeductible: loan.type === 'INVESTMENT' || loan.type === 'BUSINESS',
    };

    // Categorize based on loan type
    switch (loan.type) {
      case 'INVESTMENT':
      case 'BUSINESS':
        // Good debt: tax-deductible, wealth-building
        goodLoans.push(breakdown);
        break;
      case 'HOME':
        // Neutral debt: primary residence (not deductible in Australia)
        neutralLoans.push(breakdown);
        break;
      case 'CAR':
      case 'PERSONAL':
      case 'LINE_OF_CREDIT':
      case 'STUDENT':
      default:
        // Bad debt: consumer debt, depreciating assets
        badLoans.push(breakdown);
        break;
    }
  });

  // Calculate totals and weighted rates
  const calcCategoryTotal = (loans: DebtBreakdown[]) => ({
    total: loans.reduce((sum, l) => sum + l.principal, 0),
    loans,
    weightedRate: loans.length > 0
      ? loans.reduce((sum, l) => sum + (l.interestRate * l.principal), 0) /
        loans.reduce((sum, l) => sum + l.principal, 0)
      : 0,
  });

  const goodDebt = calcCategoryTotal(goodLoans);
  const neutralDebt = calcCategoryTotal(neutralLoans);
  const badDebt = calcCategoryTotal(badLoans);
  const totalDebt = goodDebt.total + neutralDebt.total + badDebt.total;

  // Calculate debt quality score (0-100)
  // Higher score = more "good" debt relative to total
  // Formula: (goodDebt * 100 + neutralDebt * 50 + badDebt * 0) / totalDebt
  let debtQualityScore = 0;
  if (totalDebt > 0) {
    debtQualityScore = Math.round(
      ((goodDebt.total * 100) + (neutralDebt.total * 50) + (badDebt.total * 0)) / totalDebt
    );
  }

  return {
    goodDebt,
    neutralDebt,
    badDebt,
    totalDebt,
    debtQualityScore,
    marginalTaxRate,
  };
}
