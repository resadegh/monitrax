'use client';

/**
 * LinearSegmented — Phase 12 Track B (B.1)
 *
 * Multi-option segmented control primitive. Used by the Household
 * (Just me / Partner / Family), Housing (Own / Rent / Family), and
 * Goal (Save / Reduce debt / Grow wealth) steps.
 *
 * ARIA `radiogroup` pattern for keyboard navigation. One option
 * highlighted at a time. Mobile-friendly: tiles are full-width and
 * wrap on narrow viewports.
 */

import type { ReactNode } from 'react';

export interface LinearSegmentedOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export interface LinearSegmentedProps<T extends string> {
  value: T | null;
  onChange: (value: T) => void;
  options: ReadonlyArray<LinearSegmentedOption<T>>;
  name: string;
  className?: string;
}

export function LinearSegmented<T extends string>({
  value,
  onChange,
  options,
  name,
  className = '',
}: LinearSegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={`grid gap-3 sm:grid-cols-${options.length === 3 ? '3' : '2'} ${className}`}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`flex flex-col items-start gap-1 rounded-2xl border px-5 py-4 text-left transition-all motion-reduce:transition-none ${
              selected
                ? 'border-indigo-500 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 shadow-[0_14px_36px_-12px_rgba(99,102,241,0.35)] dark:border-indigo-400 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-violet-950/30'
                : 'border-slate-200 bg-white/80 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-slate-600'
            }`}
          >
            {opt.icon && (
              <span aria-hidden="true" className="text-slate-500 dark:text-slate-400">
                {opt.icon}
              </span>
            )}
            <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {opt.label}
            </span>
            {opt.description && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {opt.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default LinearSegmented;
