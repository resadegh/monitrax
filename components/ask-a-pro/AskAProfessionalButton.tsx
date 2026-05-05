'use client';

/**
 * Phase 32C PR4b — `<AskAProfessionalButton />` primitive.
 *
 * The in-app bridge between the consumer surface and the professional
 * marketplace. Drops onto AI Guide recommendation cards, alert items,
 * and any other surface where the user might say *"this looks like a
 * conversation, not a calculation"*.
 *
 * Three visual variants:
 *   - `primary`  — full-width pill with icon + label. Use as the primary
 *                  CTA on a recommendation card.
 *   - `compact`  — small inline pill. Use as a secondary action next to
 *                  another button (e.g. "Run scenario · Ask a pro").
 *   - `icon`     — 32×32 icon-only button. Use in a tile header where
 *                  space is tight.
 *
 * Props:
 *   - `context`   — open-ended free-text label that biases the picker
 *                   ranking. Known contexts (see askAProfessionalService.ts):
 *                   tax / retirement / refinance / property / smsf / etc.
 *                   Unknown contexts fall through to public-rating order.
 *   - `label`     — override the default "Ask a professional" copy when the
 *                   surface needs more specificity (e.g. "Ask a tax pro").
 *
 * Click → opens `<AskAProfessionalDialog />` which fetches candidates and
 * renders one of two flavours depending on whether the user is org-attached.
 *
 * Accessibility: focus-visible ring, prefers-reduced-motion-aware hover.
 */

import { useState } from 'react';
import { AskAProfessionalDialog } from './AskAProfessionalDialog';

interface Props {
  context?: string;
  label?: string;
  variant?: 'primary' | 'compact' | 'icon';
  className?: string;
}

const HEADSET_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M3 9.5v-1a5 5 0 0 1 10 0v1m-10 0v3a1 1 0 0 0 1 1h1v-4H3Zm10 0v3a1 1 0 0 1-1 1h-1v-4h2Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function AskAProfessionalButton({
  context,
  label = 'Ask a professional',
  variant = 'primary',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);

  const baseClasses = 'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors';
  const focusClasses = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1';

  const variantClasses: Record<NonNullable<Props['variant']>, string> = {
    primary: `${baseClasses} ${focusClasses} bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-[13px]`,
    compact: `${baseClasses} ${focusClasses} ring-1 ring-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 text-[12px]`,
    icon: `${focusClasses} inline-flex items-center justify-center rounded-full ring-1 ring-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 w-8 h-8`,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${variantClasses[variant]} ${className}`}
        aria-label={label}
        aria-haspopup="dialog"
      >
        {HEADSET_ICON}
        {variant !== 'icon' && <span>{label}</span>}
      </button>
      {open && (
        <AskAProfessionalDialog
          context={context}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
