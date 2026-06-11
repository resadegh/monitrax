'use client';

/**
 * TrailStagePill — Phase 14.10 (2026-06-11)
 *
 * Small ambient-context pill showing the user's current TRAIL stage.
 * Lives next to the user name in the sidebar so the stage is visible
 * on every page without competing with action-oriented content.
 *
 * Rationale (Reza 2026-06-11): the full `<TrailStageIndicator />` hero
 * was moved from the home dashboard to the top of My Guide so the home
 * surface stays action-led (Welcome Back, subscriptions, KPIs). This
 * pill keeps the stage glanceable on every page at the cost of a few
 * pixels in the sidebar.
 *
 * Tone uses `TRAIL_STAGE_TONES` from `lib/navigation/trailNav.tsx` so
 * the colour identity stays consistent with the sidebar dots, the
 * mobile bottom-bar active states, and the My Guide hero.
 */

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TRAIL_STAGE_TONES } from '@/lib/navigation/trailNav';
import { useTrailStage } from '@/hooks/useTrailStage';
import { getTrailStageInfo } from '@/lib/cfo/trailStage';

interface TrailStagePillProps {
  className?: string;
}

export function TrailStagePill({ className }: TrailStagePillProps) {
  const { stage, loading } = useTrailStage();

  // Loading state — render an unobtrusive skeleton so the layout
  // doesn't shift when the stage resolves.
  if (loading) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/50',
          className
        )}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/20" />
        <span className="tracking-[0.08em]">Stage —</span>
      </div>
    );
  }

  // No stage resolved — render nothing rather than a misleading badge.
  if (!stage) return null;

  const tone = TRAIL_STAGE_TONES[stage];
  const info = getTrailStageInfo(stage);

  return (
    <Link
      href="/dashboard/cfo"
      aria-label={`You're at stage ${stage} — ${info.name}. Open My Guide.`}
      title={`Stage ${stage} — ${info.name}: ${info.tagline}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-foreground/10 px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] transition-colors hover:bg-foreground/[0.04]',
        tone.activeText,
        className
      )}
    >
      <span
        aria-hidden
        className={cn('h-1.5 w-1.5 rounded-full', tone.accent)}
      />
      <span>Stage {stage} · {info.name}</span>
    </Link>
  );
}
