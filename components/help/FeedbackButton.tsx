/**
 * FeedbackButton — the floating affordance that opens the in-app
 * feedback chat drawer (Phase 33g.2).
 *
 * Lives in the consumer dashboard chrome, mounted alongside HelpDrawerButton
 * + AiChatButton. Fixed top-right of the viewport, slightly to the LEFT of
 * the help button so the visual hierarchy reads:
 *
 *   ?  💬   ←  help  feedback   (top-right edge of viewport)
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
  /** Override the default top-right position (e.g. for embedding elsewhere). */
  className?: string;
}

export function FeedbackButton({ className = '' }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        title="Send feedback"
        className={`
          fixed top-3 right-14 sm:top-4 sm:right-16 lg:top-5 lg:right-20
          z-40
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
