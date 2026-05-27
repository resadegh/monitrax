/**
 * DataValue — tabular-nums semibold navy currency / percentage display.
 *
 * Size variants map to the Restrained Editorial typography scale:
 *   - `xl` (40px / 600 / -0.02em / line-height 1) — hero numbers (Money Story)
 *   - `lg` (28px / 600 / -0.02em / line-height 1) — paired metric tiles, KPIs
 *   - `md` (20px / 600 / -0.02em / line-height 1.1) — inline values
 *
 * Always renders with `font-variant-numeric: tabular-nums` so columns of
 * currency align cleanly. Default colour is editorial-ink (#0B1220).
 *
 * Stitch screen reference: f723372ebbd83b197770129eff849a2.
 */

import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export interface DataValueProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'xl' | 'lg' | 'md';
  as?: 'span' | 'div' | 'p';
}

const SIZE_CLASS: Record<NonNullable<DataValueProps['size']>, string> = {
  xl: 'text-data-xl',
  lg: 'text-data-lg',
  md: 'text-headline-sm tabular-nums-data',
};

export function DataValue({
  size = 'lg',
  as: Tag = 'span',
  className,
  children,
  ...rest
}: DataValueProps) {
  return (
    <Tag className={cn(SIZE_CLASS[size], 'text-editorial-ink', className)} {...rest}>
      {children}
    </Tag>
  );
}
