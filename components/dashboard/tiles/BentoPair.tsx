'use client';

/**
 * BentoPair — §18.7.6 Compact Dashboard mobile reflow primitive.
 *
 * 2-up grid wrapper for widget pairs that normally sit side-by-side on
 * desktop. Replaces the "stack vertically on mobile" default with a
 * compact `grid grid-cols-2 gap-3` so two related widgets fit in one
 * mobile viewport scan rather than two scrolls.
 *
 * The §18.7.6 reviewer rule requires a ≤360px collapse-to-single-col
 * fallback for the smallest iPhones (SE etc.) — handled via the
 * `min-[360px]:grid-cols-2` breakpoint below.
 *
 * Above the md breakpoint, the BentoPair behaves like a regular 2-col
 * grid with a wider gap (matches the existing desktop pair pattern from
 * `app/dashboard/page.tsx` — `grid gap-6 lg:grid-cols-2`).
 *
 * Used by Phase 45.5 to host widget pairs:
 *   - FinancialHealth + EmergencyFund
 *   - DebtQuality + EntityCashflow
 *
 * Stitch source: project 1859462351962811110, screen
 * `55cff20dae64476fa18879fa0400592f` (Compact Dashboard mobile v1).
 */

import type { ReactNode } from 'react';

interface BentoPairProps {
  children: ReactNode;
  className?: string;
}

export function BentoPair({ children, className = '' }: BentoPairProps) {
  return (
    <div
      className={`
        grid grid-cols-1 gap-3
        min-[360px]:grid-cols-2
        lg:gap-6
        ${className}
      `}
    >
      {children}
    </div>
  );
}
