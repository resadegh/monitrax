'use client';

/**
 * BreathingDot — the tiny emerald pulse next to the hero number on the
 * Money Story v2 hero. Suggests "alive, but quiet" — Mercury / Linear
 * restraint, NEVER flashy. 8px solid dot + 14px expanding/fading halo
 * looped every 2.2s.
 *
 * Respects `prefers-reduced-motion` — falls back to a static dot.
 *
 * @see .stitch/designs/money-story-v2-redesign.html (the locked Stitch
 *      reference for the Freedom Horizon tile)
 */

import { cn } from '@/lib/utils';

export interface BreathingDotProps {
  className?: string;
  /** Size of the inner solid dot in px. Defaults to 8. */
  size?: number;
  /** Tone — emerald (default) or amber for caution states. */
  tone?: 'emerald' | 'amber';
}

export function BreathingDot({
  className,
  size = 8,
  tone = 'emerald',
}: BreathingDotProps) {
  const dotColor =
    tone === 'emerald' ? 'bg-editorial-emerald' : 'bg-editorial-amber';
  const haloColor =
    tone === 'emerald' ? 'bg-editorial-emerald/30' : 'bg-editorial-amber/30';

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className={cn('absolute inline-block rounded-full motion-safe:animate-ping', haloColor)}
        style={{ width: size, height: size, animationDuration: '2.2s' }}
      />
      <span
        className={cn('relative inline-block rounded-full', dotColor)}
        style={{ width: size, height: size }}
      />
    </span>
  );
}
