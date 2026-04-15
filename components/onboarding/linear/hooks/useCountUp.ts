'use client';

/**
 * useCountUp — Phase 12 Track B (B.1)
 *
 * Custom requestAnimationFrame-based count-up hook. Zero external
 * dependencies. Respects `prefers-reduced-motion` by jumping to the
 * final value instantly when motion is reduced.
 *
 * Used by:
 *   - Per-step feedback (Income, Expenses, Debt) — 600-800ms
 *   - Final Reveal hero + secondary metrics — 1000-1400ms
 *
 * Signature:
 *   const value = useCountUp(targetValue, { durationMs, startOnMount });
 *
 * Easing: ease-out cubic (same as §8.2 plan standard).
 */

import { useEffect, useRef, useState } from 'react';

export interface UseCountUpOptions {
  /** Animation duration in milliseconds. Default 700ms. */
  durationMs?: number;
  /**
   * Whether to start the animation immediately on mount (true)
   * or wait for an explicit `start()` call (false). Default true.
   */
  startOnMount?: boolean;
  /** Starting value. Default 0. */
  from?: number;
}

// ease-out cubic — matches §8.2 standard, no bounce
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useCountUp(
  target: number,
  { durationMs = 700, startOnMount = true, from = 0 }: UseCountUpOptions = {}
): number {
  const [value, setValue] = useState<number>(startOnMount ? from : target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!startOnMount) return;
    if (!Number.isFinite(target)) {
      setValue(target);
      return;
    }

    // Respect prefers-reduced-motion — jump to target.
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }

    startRef.current = null;

    const tick = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = easeOutCubic(progress);
      setValue(from + (target - from) * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, durationMs, startOnMount, from]);

  return value;
}
