'use client';

/**
 * GlassTaxTile — Phase 45.8 cashflow redesign.
 *
 * §18.7.2 glass-vocabulary rewrite of TaxOptimization. Compresses the
 * existing 4-block layout into: hero number (estimated annual tax) + mini-
 * grid (3 KPIs) + the highest-priority recommendation. Reza's brief —
 * don't overwhelm. Violet sub-palette matches the §18.7.2 money-signal
 * row (premium / tax).
 *
 * Stitch source: project 1859462351962811110, screen ff0beab3c934409893fe04441120a472
 * (Section 3 — Estimated Annual Tax).
 */

import Link from 'next/link';
import { Landmark, ArrowRight } from 'lucide-react';
import { GlassPanel, GlassIconBadge, GlassEyebrow } from '@/components/dashboard/tiles/GlassPanel';
import { formatCurrency } from '@/lib/utils/formatters';

interface TaxRecommendation {
  id: string;
  title: string;
  description: string;
  potentialSaving: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  actionUrl?: string;
}

interface Props {
  estimatedAnnualTax: number;
  deductibleExpenses: number;
  potentialSavings: number;
  recommendations: TaxRecommendation[];
  effectiveTaxRate: number;
  paygWithheld: number;
}

export default function GlassTaxTile({
  estimatedAnnualTax,
  deductibleExpenses,
  potentialSavings,
  recommendations,
  effectiveTaxRate,
  paygWithheld,
}: Props) {
  const topRecommendation = recommendations[0] ?? null;
  const paygCoverage = estimatedAnnualTax > 0 ? (paygWithheld / estimatedAnnualTax) * 100 : 0;

  return (
    <GlassPanel subPalette="violet" padding="p-6">
      <div className="flex items-center gap-3 mb-5">
        <GlassIconBadge icon={Landmark} subPalette="violet" />
        <div className="flex flex-col">
          <GlassEyebrow subPalette="violet">Tax · FY estimate</GlassEyebrow>
          <h3 className="text-base font-semibold text-foreground">Year-end position</h3>
        </div>
      </div>

      {/* Hero: estimated tax */}
      <div className="mb-5">
        <p className="text-3xl sm:text-4xl font-semibold tabular-nums tracking-[-0.02em] bg-gradient-to-r from-violet-500 to-violet-600 bg-clip-text text-transparent">
          {formatCurrency(estimatedAnnualTax)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Estimated annual tax · {effectiveTaxRate.toFixed(1)}% effective rate
        </p>
      </div>

      {/* Mini-grid: 3 KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="rounded-[12px] border border-foreground/5 bg-foreground/[0.02] p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70 mb-1">
            Deductions
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground/90">
            {formatCurrency(deductibleExpenses)}
          </p>
        </div>
        <div className="rounded-[12px] border border-foreground/5 bg-foreground/[0.02] p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70 mb-1">
            PAYG paid
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground/90">
            {formatCurrency(paygWithheld)}
          </p>
          {paygCoverage > 0 && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              {paygCoverage.toFixed(0)}% covered
            </p>
          )}
        </div>
        <div className="rounded-[12px] border border-emerald-500/15 bg-emerald-500/[0.06] p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400 mb-1">
            Could save
          </p>
          <p className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            {formatCurrency(potentialSavings)}
          </p>
        </div>
      </div>

      {/* Top recommendation */}
      {topRecommendation && (
        <div className="rounded-[14px] border border-violet-500/15 bg-violet-500/[0.05] p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-violet-700 dark:text-violet-400 mb-1.5">
            Strategy
          </p>
          <p className="text-sm font-medium text-foreground/90 mb-1">{topRecommendation.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            {topRecommendation.description}
          </p>
          {topRecommendation.actionUrl && (
            <Link
              href={topRecommendation.actionUrl}
              className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
            >
              Explore
              <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
            </Link>
          )}
        </div>
      )}
    </GlassPanel>
  );
}
