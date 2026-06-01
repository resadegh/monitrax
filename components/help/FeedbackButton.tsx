/**
 * FeedbackButton — the floating affordance that opens the in-app
 * feedback chat drawer (Phase 33g.2).
 *
 * Lives in the consumer dashboard chrome, mounted alongside HelpDrawerButton
 * + AiChatButton. Fixed top-right of the viewport. The three buttons form a
 * single utility cluster, spaced left-to-right so they never overlap:
 *
 *   💬   🤖   ?     (top-right edge of viewport)
 *   feedback  AI  help
 *
 * Right-edge offsets (default / sm / lg), each button is h-9 (36px):
 *   help      right-3  / right-4  / right-6      (12 / 16 / 24 px)
 *   AI        right-14 / right-16 / right-[4.5rem] (56 / 64 / 72 px)
 *   feedback  right-[6.25rem] / right-28 / right-[7.5rem] (100 / 112 / 120 px)
 *
 * ⚠ These three offsets MUST stay coordinated — they are hard-coded in
 * three separate components (no shared container). A ~44-48px step keeps
 * a clean gap between the 36px buttons. Bug fixed 2026-05-20: AiChatButton
 * + FeedbackButton previously BOTH sat at right-14/right-16 and stacked,
 * the feedback bubble covering the AI Advisor bubble.
 *
 * Same warm-ivory glass aesthetic as HelpDrawerButton (Phase 33b) +
 * PracticeGlassCard (Phase 32B PR1) — the design language is locked.
 *
 * The actual chat UI lives in `<FeedbackChatDrawer />`. This component
 * just owns the open/close state.
 */
'use client';

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { FeedbackChatDrawer } from './FeedbackChatDrawer';

interface FeedbackButtonProps {
  /**
   * Trigger placement (see `HelpDrawerButton` for the full rationale).
   * `'fixed'` (default) for mobile floating; `'inline'` for the
   * EditorialTopBar's right cluster.
   */
  placement?: 'fixed' | 'inline';
  /** Override the default top-right position (e.g. for embedding elsewhere). */
  className?: string;
}

export function FeedbackButton({ placement = 'fixed', className = '' }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const positionClasses =
    placement === 'fixed'
      ? 'fixed top-3 right-[6.25rem] sm:top-4 sm:right-28 lg:top-5 lg:right-[7.5rem] z-40'
      : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        title="Send feedback"
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
        <MessageSquarePlus className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>

      <FeedbackChatDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
