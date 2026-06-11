'use client';

/**
 * GlassSavingOpportunitiesTile — Phase 45.8 cashflow redesign (NEW tile).
 *
 * Surfaces cross-account / cross-property savings opportunities the user
 * could act on this month. Solves Reza's stated pain point: "due to
 * having multiple accounts and properties it is very hard for me to
 * pinpoint where my money is going and if there are any saving
 * opportunities available."
 *
 * Pulls from `lib/cashflow/savingOpportunities.ts` — pure detector over
 * the canonical master snapshot. v1 covers HISA upgrade / offset link /
 * salary sacrifice.
 *
 * Per CLAUDE.md §0 financial-adviser lens: every number traceable, every
 * recommendation conservative + reversible, no manufactured urgency. The
 * UI explicitly labels the figures as "estimated" — they're decision
 * support, not promises.
 *
 * Stitch source: project 1859462351962811110, screen ff0beab3c934409893fe04441120a472
 * (Section 4 — 3 opportunities to grow).
 */

import Link from 'next/link';
import { Sprout, ArrowRight, PiggyBank, Building2, TrendingUp } from 'lucide-react';
import { GlassPanel, GlassIconBadge, GlassEyebrow } from '@/components/dashboard/tiles/GlassPanel';
import { formatCurrency } from '@/lib/utils/formatters';
import type { OpportunityKind, SavingOpportunity } from '@/lib/cashflow/savingOpportunities';

interface Props {
  opportunities: SavingOpportunity[];
  totalEstimatedAnnualBenefit: number;
}

const KIND_ICON: Record<OpportunityKind, typeof PiggyBank> = {
  HISA_UPGRADE: PiggyBank,
  OFFSET_LINK: Building2,
  SALARY_SACRIFICE: TrendingUp,
};

export default function GlassSavingOpportunitiesTile({
  opportunities,
  totalEstimatedAnnualBenefit,
}: Props) {
  // Empty state — celebratory, never shaming. The user might genuinely
  // have nothing to optimise this month.
  if (opportunities.length === 0) {
    return (
      <GlassPanel subPalette="emerald" padding="p-6">
        <div className="flex items-center gap-3 mb-5">
          <GlassIconBadge icon={Sprout} subPalette="emerald" />
          <div className="flex flex-col">
            <GlassEyebrow subPalette="emerald">Saving Opportunities</GlassEyebrow>
            <h3 className="text-base font-semibold text-foreground">Your structure is tight</h3>
          </div>
        </div>
        <p className="text-sm text-foreground/85 leading-relaxed mb-2">
          Nothing obvious to optimise right now — your cash, debt, and super are well-allocated for your current position.
        </p>
        <p className="text-xs text-muted-foreground">
          We re-check whenever your accounts or income change.
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel subPalette="emerald" padding="p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <GlassIconBadge icon={Sprout} subPalette="emerald" />
          <div className="flex flex-col min-w-0">
            <GlassEyebrow subPalette="emerald">Saving Opportunities</GlassEyebrow>
            <h3 className="text-base font-semibold text-foreground">
              {opportunities.length} {opportunities.length === 1 ? 'opportunity' : 'opportunities'} to grow
            </h3>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            +{formatCurrency(totalEstimatedAnnualBenefit)}
          </p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
            /yr potential
          </p>
        </div>
      </div>

      {/* Opportunities list — each pinned to a single CTA */}
      <ul className="space-y-3">
        {opportunities.map((opp) => {
          const Icon = KIND_ICON[opp.kind];
          return (
            <li
              key={opp.id}
              className="rounded-[14px] border border-emerald-500/15 bg-emerald-500/[0.05] p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-sm shadow-emerald-500/25">
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-sm font-medium text-foreground/90 truncate">{opp.title}</p>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      +{formatCurrency(opp.estimatedAnnualBenefit)}
                      <span className="text-[10px] font-normal text-muted-foreground">/yr</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    {opp.rationale}
                  </p>
                  <Link
                    href={opp.ctaUrl}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                  >
                    {opp.cta}
                    <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* §0 financial-adviser lens — illustrative, not advice. */}
      <p className="mt-4 pt-3 border-t border-foreground/5 text-[10px] text-muted-foreground/70 leading-relaxed">
        Estimates use conservative assumptions about market rates. General information only, not personal advice.
      </p>
    </GlassPanel>
  );
}
