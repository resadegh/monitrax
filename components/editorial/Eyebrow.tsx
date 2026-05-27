/**
 * Eyebrow — the signature uppercase 12px/500 letter-spaced label that sits
 * above every section headline + metric in the Restrained Editorial dashboard.
 *
 * Design rule (CLAUDE.md §16.4 + docs/design/MONITRAX_STITCH_DESIGN_SYSTEM.md):
 *   uppercase, 12px, weight 500, letter-spacing 0.18em, slate-500 #64748B.
 *
 * Stitch screen reference: f723372ebbd83b197770129eff849a2 (content stack).
 */

import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  as?: 'span' | 'p' | 'div';
}

export function Eyebrow({ as: Tag = 'span', className, children, ...rest }: EyebrowProps) {
  return (
    <Tag className={cn('text-eyebrow', className)} {...rest}>
      {children}
    </Tag>
  );
}
