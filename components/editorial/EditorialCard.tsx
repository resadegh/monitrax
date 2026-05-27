/**
 * EditorialCard — the canonical white card surface for the Restrained
 * Editorial dashboard. Replaces ad-hoc div + shadow combinations.
 *
 * Specs (locked, CLAUDE.md §16.4 + docs/design/MONITRAX_STITCH_DESIGN_SYSTEM.md):
 *   - background:  #FFFFFF (editorial-paper)
 *   - border:      1.5px solid #E2E8F0 (editorial-divider)
 *   - radius:      16px
 *   - shadow:      0 1px 2px 0 hsl(220 47% 8% / 0.04), 0 1px 1px 0 hsl(220 47% 8% / 0.02)
 *   - padding:     24px desktop / 16px mobile (overrideable via `padded={false}`)
 *
 * Variants:
 *   - default          — resting card
 *   - hover            — adds editorial-card-hover (subtle 1px translate +
 *                        elevated shadow on hover; respects reduced-motion)
 *
 * Stitch screen reference: f723372ebbd83b197770129eff849a2 (every section).
 */

import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export interface EditorialCardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Apply the canonical 24px / 16px responsive padding. Set to false when
   * the inner layout needs to draw bleed-edge content (e.g. a stacked-bar
   * that should hit the card edge). Defaults to true.
   */
  padded?: boolean;
  /**
   * Add the editorial-card-hover utility — 1px translate + shadow lift on
   * hover, with prefers-reduced-motion fallback. Defaults to false.
   */
  hover?: boolean;
  as?: 'div' | 'section' | 'article';
}

export function EditorialCard({
  padded = true,
  hover = false,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: EditorialCardProps) {
  return (
    <Tag
      className={cn(
        // editorial-card defines bg + border + radius + shadow + 24px padding.
        // We strip the padding when padded=false so the consumer controls it.
        'editorial-card',
        !padded && '!p-0',
        hover && 'editorial-card-hover',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
