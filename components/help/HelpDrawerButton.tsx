/**
 * HelpDrawerButton — the `?` affordance that opens the in-app help drawer.
 *
 * Lives in the consumer dashboard chrome and the portal chrome (mounted
 * once per layout, not per page). Fixed top-right of the main content
 * area, just below the mobile header on small screens. Visually a 32px
 * circle with a slate-600 question mark on warm-ivory glass — the same
 * design language as PracticeGlassCard (CLAUDE.md §0 designer lens:
 * restraint over decoration; the eye reads "this is a help button"
 * without a label).
 *
 * Holds the drawer open/close state + audience scope; the Drawer itself
 * is responsible for fetching content. Phase 33b — see
 * `docs/changelog/CHANGELOG_2026_05_04.md`.
 */
'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { HelpDrawer } from './HelpDrawer';
import type { HelpAudience } from '@/lib/help/content';

interface HelpDrawerButtonProps {
  /**
   * Audiences the caller is allowed to see. Computed by the layout based
   * on auth + org membership. Drawer scopes its article list + search to
   * this set.
   */
  audiences: HelpAudience[];
  /**
   * Trigger placement:
   *   - `'fixed'` (default) — `fixed top-right` of the viewport (legacy
   *     mobile floating behaviour).
   *   - `'inline'` — no position classes; the trigger renders inside
     *     the parent's flow (used by `EditorialTopBar`'s right cluster).
   * Added 2026-06-01 to resolve the topbar-search collision (the
   * three floating bubbles overlapped the editorial topbar's search
   * pill once Phase R2b landed). Mobile still uses `'fixed'`.
   */
  placement?: 'fixed' | 'inline';
  /** Position override — defaults to fixed top-right of viewport. */
  className?: string;
}

export function HelpDrawerButton({
  audiences,
  placement = 'fixed',
  className = '',
}: HelpDrawerButtonProps) {
  const [open, setOpen] = useState(false);
  const positionClasses =
    placement === 'fixed'
      ? 'fixed top-3 right-3 sm:top-4 sm:right-4 lg:top-5 lg:right-6 z-40'
      : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open help"
        title="Help"
        className={`
          ${positionClasses}
          inline-flex items-center justify-center
          h-9 w-9 rounded-full
          bg-white/85 backdrop-blur-sm
          ring-1 ring-slate-900/[0.08]
          text-slate-600
          shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset]
          transition-[transform,box-shadow,background-color] duration-200 ease-out
          hover:bg-white hover:text-slate-900 hover:shadow-[0_4px_14px_-6px_rgba(11,18,32,0.18)] hover:-translate-y-0.5
          motion-reduce:hover:translate-y-0
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
          ${className}
        `}
      >
        <HelpCircle className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>

      <HelpDrawer open={open} onClose={() => setOpen(false)} audiences={audiences} />
    </>
  );
}
