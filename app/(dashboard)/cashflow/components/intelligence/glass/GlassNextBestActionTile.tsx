'use client';

/**
 * GlassNextBestActionTile — Phase 45.8 cashflow redesign.
 *
 * Distils the AI summary + top SmartAction into a single tile that answers
 * "what should I actually do this month?" Replaces the long-form GeminiSummary
 * section. Reza's brief: "I don't want users to be overwhelmed with useless
 * data" — so we surface ONE action with the impact in dollars and a single
 * CTA. The full smart actions list still lives below for those who want it.
 *
 * Per CLAUDE.md §0 behaviour-psychology lens: celebrate the next achievable
 * action, never list everything missing.
 *
 * Stitch source: project 1859462351962811110, screen ff0beab3c934409893fe04441120a472
 * (Section 2 — Next Best Action).
 */

import Link from 'next/link';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { GlassPanel, GlassIconBadge, GlassEyebrow } from '@/components/dashboard/tiles/GlassPanel';
import { formatCurrency } from '@/lib/utils/formatters';

interface SmartAction {
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
}

interface Props {
  topAction: SmartAction | null;
  summaryHeadline?: string;
  isLoading?: boolean;
  onRegenerate?: () => void;
}

export default function GlassNextBestActionTile({ topAction, summaryHeadline, isLoading, onRegenerate }: Props) {
  // Empty / loading state — celebratory framing per §0 behaviour-psychology
  // lens. Never list what's missing.
  if (!topAction) {
    return (
      <GlassPanel subPalette="indigo-violet" padding="p-6">
        <div className="flex items-center gap-3 mb-5">
          <GlassIconBadge icon={Sparkles} subPalette="indigo-violet" />
          <div className="flex flex-col">
            <GlassEyebrow subPalette="indigo-violet">Next Best Action</GlassEyebrow>
            <h3 className="text-base font-semibold text-foreground">Your money is on track</h3>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Nothing stands out this month. Keep saving consistently and the compounding will do the work.
        </p>
      </GlassPanel>
    );
  }

  const annualImpact = Math.abs(topAction.impact);

  return (
    <GlassPanel subPalette="indigo-violet" padding="p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <GlassIconBadge icon={Sparkles} subPalette="indigo-violet" />
          <div className="flex flex-col min-w-0">
            <GlassEyebrow subPalette="indigo-violet">Next Best Action</GlassEyebrow>
            <h3 className="text-base font-semibold text-foreground truncate">{topAction.title}</h3>
          </div>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className="shrink-0 rounded-lg border border-foreground/10 bg-background/50 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground backdrop-blur transition hover:bg-background/80 hover:text-foreground disabled:opacity-50"
            aria-label="Refresh insight"
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
          </button>
        )}
      </div>

      {/* Hero: the action description */}
      <p className="text-sm sm:text-base text-foreground/85 leading-relaxed mb-5">
        {summaryHeadline || topAction.description}
      </p>

      {/* Impact pill */}
      {annualImpact > 0 && (
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-1.5 mb-5">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
            Estimated impact
          </span>
          <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            +{formatCurrency(annualImpact)}/yr
          </span>
        </div>
      )}

      {/* CTA */}
      {topAction.actionUrl && (
        <Link
          href={topAction.actionUrl}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-600 hover:to-violet-600"
        >
          <span>Take a look</span>
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      )}
    </GlassPanel>
  );
}
