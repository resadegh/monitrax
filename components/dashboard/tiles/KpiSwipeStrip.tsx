'use client';

/**
 * KpiSwipeStrip — §18.7.6 Compact Dashboard mobile reflow primitive.
 *
 * Horizontal swipe carousel for ≥3 metric tiles. Mobile-only; desktop
 * collapses to a regular flex/grid row via responsive utilities on the
 * consumer.
 *
 * Anatomy (mobile, ≤ md breakpoint):
 *   - Outer scroller: `overflow-x-auto snap-x snap-mandatory scroll-px-4
 *     -mx-4 px-4 pb-2` + `scrollbar-hide`
 *   - Inner track: `flex gap-3`
 *   - Each child renders inside a `<KpiSwipeStripItem>` wrapper that
 *     applies `snap-start shrink-0 w-[78vw] max-w-[280px]` — exactly
 *     1.2 tiles peek so the next tile is partially visible (telegraphs
 *     "there's more, swipe")
 *   - Page-dot indicator below the strip — N dots, the active one filled
 *     in the dot palette, others outlined slate. IntersectionObserver
 *     tracks which tile is in view.
 *
 * Behaviour-psychology lens (§0): the peek + dots together signal scan-
 * ability without forcing the user to learn a new interaction model.
 * Momentum scroll is native iOS / Android, no manual pager JS needed —
 * scroll-snap does the work.
 *
 * Stitch source: project 1859462351962811110, screen
 * `55cff20dae64476fa18879fa0400592f` (Compact Dashboard mobile v1).
 */

import { Children, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { GlassSubPalette } from './GlassPanel';

interface KpiSwipeStripProps {
  children: ReactNode;
  /** Sub-palette used for the active page-dot. Default 'emerald'. */
  activeDotSubPalette?: GlassSubPalette;
  /** ARIA label for the scroll region. */
  ariaLabel?: string;
  className?: string;
}

const DOT_FILL: Record<GlassSubPalette, string> = {
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-500',
  'sky-indigo': 'bg-gradient-to-r from-sky-500 to-indigo-500',
  'indigo-violet': 'bg-gradient-to-r from-indigo-500 to-violet-500',
};

export function KpiSwipeStrip({
  children,
  activeDotSubPalette = 'emerald',
  ariaLabel = 'Swipe to see more metrics',
  className = '',
}: KpiSwipeStripProps) {
  const items = Children.toArray(children).filter(isValidElement);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // §18.7.6 reviewer rule: snap-mandatory + 1.2-peek + page-dots make the
  // pattern feel intentional. IntersectionObserver tracks the most-visible
  // tile to drive the dot indicator. No manual JS pager — scroll-snap +
  // momentum scroll do the work.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the highest intersection ratio that's at least
        // 50% visible; if none, leave the active index untouched.
        let best: { ratio: number; index: number } | null = null;
        for (const e of entries) {
          const idx = itemRefs.current.findIndex((el) => el === e.target);
          if (idx === -1) continue;
          if (e.intersectionRatio >= 0.5 && (!best || e.intersectionRatio > best.ratio)) {
            best = { ratio: e.intersectionRatio, index: idx };
          }
        }
        if (best) setActiveIndex(best.index);
      },
      { root: track, threshold: [0.5, 0.75, 1.0] },
    );
    for (const el of itemRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);

  const setItemRef = useCallback((i: number) => (el: HTMLDivElement | null) => {
    itemRefs.current[i] = el;
  }, []);

  return (
    <div className={className}>
      <div
        ref={trackRef}
        role="region"
        aria-label={ariaLabel}
        className="
          -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2
          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
        "
      >
        {items.map((child, i) => (
          <div
            key={i}
            ref={setItemRef(i)}
            className="w-[78vw] max-w-[280px] shrink-0 snap-start"
          >
            {child}
          </div>
        ))}
      </div>
      {/* Page-dot indicator — sub-palette filled for active, slate outlined for rest. */}
      <div
        className="mt-2 flex items-center justify-center gap-1.5"
        role="tablist"
        aria-label="Strip position"
      >
        {items.map((_, i) => (
          <span
            key={i}
            role="tab"
            aria-selected={i === activeIndex}
            className={`
              h-1.5 rounded-full transition-all duration-300
              ${i === activeIndex
                ? `w-4 ${DOT_FILL[activeDotSubPalette]}`
                : 'w-1.5 bg-foreground/15'}
            `}
          />
        ))}
      </div>
    </div>
  );
}
