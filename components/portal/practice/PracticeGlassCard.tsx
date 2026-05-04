/**
 * PracticeGlassCard — canonical surface for Practice tiles.
 *
 * Design language commitments (per CLAUDE.md §0 designer lens + Phase 39
 * Apple-Wallet tile pattern): warm-ivory background, soft 28px corner radius,
 * 1px ring border at low opacity, subtle inner highlight at the top, hover
 * lift via shadow + scale (skipped on prefers-reduced-motion). No heavy
 * drop-shadow — the depth reads from the ring + gradient, not from a halo.
 */
import { ReactNode } from 'react';

interface PracticeGlassCardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  accentTone?: 'critical' | 'opportunity' | 'milestone' | null;
}

const PADDING: Record<NonNullable<PracticeGlassCardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-7 sm:p-8',
};

const ACCENT_STRIP: Record<'critical' | 'opportunity' | 'milestone', string> = {
  critical: 'before:bg-rose-400/80',
  opportunity: 'before:bg-emerald-400/80',
  milestone: 'before:bg-sky-400/80',
};

export function PracticeGlassCard({
  children,
  className = '',
  padding = 'md',
  interactive = false,
  accentTone = null,
}: PracticeGlassCardProps) {
  const accentClasses = accentTone
    ? `relative overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-[3px] ${ACCENT_STRIP[accentTone]}`
    : 'relative';

  const interactiveClasses = interactive
    ? 'transition-[box-shadow,transform] duration-200 ease-out hover:shadow-[0_8px_24px_-12px_rgba(11,18,32,0.18)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none cursor-pointer'
    : '';

  return (
    <div
      className={`
        ${accentClasses}
        rounded-[22px]
        bg-white/85 backdrop-blur-sm
        ring-1 ring-slate-900/[0.06]
        shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset]
        ${PADDING[padding]}
        ${interactiveClasses}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
