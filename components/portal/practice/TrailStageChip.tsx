/**
 * TrailStageChip — TRAIL stage indicator for the Practice surface.
 *
 * Visual language: filled chip, stage-specific hue, subtle tonal gradient,
 * tracking-tight typography. Mirrors the stage palette used in the consumer
 * TRAIL banner so a professional and a client see the *same* visual cue when
 * they meet over Zoom.
 *
 * Stage palette (matches docs/blueprint/TRAIL_FRAMEWORK.md narrative):
 *   TRACK   — slate (awareness, neutral)
 *   REDUCE  — amber (effort, action)
 *   ANCHOR  — indigo (safety, depth)
 *   INVEST  — emerald (growth, brand)
 *   LIVE    — violet (freedom, calm)
 */
import type { TrailStage } from '@/lib/portal/practice';
import { TRAIL_STAGE_LABEL } from '@/lib/portal/practice';

interface TrailStageChipProps {
  stage: TrailStage;
  delta?: 'advanced' | 'regressed' | null;
  size?: 'sm' | 'md';
}

const STAGE_TONES: Record<TrailStage, string> = {
  TRACK: 'bg-slate-100 text-slate-700 ring-slate-200/70',
  REDUCE: 'bg-amber-50 text-amber-800 ring-amber-200/70',
  ANCHOR: 'bg-indigo-50 text-indigo-800 ring-indigo-200/70',
  INVEST: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70',
  LIVE: 'bg-violet-50 text-violet-800 ring-violet-200/70',
};

export function TrailStageChip({ stage, delta = null, size = 'md' }: TrailStageChipProps) {
  const tone = STAGE_TONES[stage];
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  const arrow = delta === 'advanced' ? '↑' : delta === 'regressed' ? '↓' : null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium tracking-tight ring-1 ring-inset ${tone} ${padding}`}
    >
      <span>{TRAIL_STAGE_LABEL[stage]}</span>
      {arrow && <span aria-hidden="true">{arrow}</span>}
    </span>
  );
}
