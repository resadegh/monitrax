'use client';

/**
 * LinearInput — Phase 12 Track B (B.1)
 *
 * Premium input primitive for the /onboarding wizard. Variants:
 *   - text      — plain text input
 *   - number    — numeric input
 *   - currency  — numeric input with $ prefix
 *
 * Design:
 *   - Large (text-xl) to match the title hierarchy
 *   - Generous padding, subtle border, strong focus ring
 *   - Dark-mode native
 *   - No default Shadcn chrome (per §8.6 — wizard uses bespoke primitives)
 */

import type { InputHTMLAttributes } from 'react';

export interface LinearInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  variant?: 'text' | 'number' | 'currency';
  label?: string;
}

export function LinearInput({
  variant = 'text',
  label,
  className = '',
  ...rest
}: LinearInputProps) {
  const inputType = variant === 'text' ? 'text' : 'number';
  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </label>
      )}
      <div className="relative">
        {variant === 'currency' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-semibold text-slate-400 dark:text-slate-500"
          >
            $
          </span>
        )}
        <input
          type={inputType}
          className={`w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-2xl font-semibold text-slate-900 shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${
            variant === 'currency' ? 'pl-12' : ''
          } ${className}`}
          {...rest}
        />
      </div>
    </div>
  );
}

export default LinearInput;
