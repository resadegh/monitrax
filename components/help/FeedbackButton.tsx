/**
 * FeedbackButton — the floating affordance that opens the in-app
 * feedback chat drawer (Phase 33g.2 + g.3 + g.4 + g.5).
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
 * Phase 33g.5: shows an unread count badge when admin/AI has replied since
 * the user last opened the drawer. Tracked via `useUnreadFeedback`. The
 * `markSeen()` fires when the drawer opens — so all current threads
 * become "seen" the moment the user looks at them. New replies arriving
 * AFTER that point increment the badge again.
 *
 * The actual chat UI lives in `<FeedbackChatDrawer />`. This component
 * just owns the open/close state + the unread badge.
 */
'use client';

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { FeedbackChatDrawer } from './FeedbackChatDrawer';
import { useUnreadFeedback } from '@/hooks/useUnreadFeedback';

interface FeedbackButtonProps {
  /** Override the default top-right position (e.g. for embedding elsewhere). */
  className?: string;
}

export function FeedbackButton({ className = '' }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const { unreadCount, unreadThreadIds, markSeen } = useUnreadFeedback();

  const handleOpen = () => {
    setOpen(true);
    markSeen();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={
          unreadCount > 0
            ? `Send feedback (${unreadCount} unread)`
            : 'Send feedback'
        }
        title={
          unreadCount > 0
            ? `${unreadCount} unread ${unreadCount === 1 ? 'reply' : 'replies'}`
            : 'Send feedback'
        }
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
        {/* Phase 33g.5: unread badge. Slack/iOS-style — small red pill
            top-right of the icon. Caps display at 9+ to avoid layout
            stretch. Hidden when count = 0. */}
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="
              absolute -top-1 -right-1
              min-w-[18px] h-[18px] px-1
              rounded-full
              bg-rose-500 text-white
              text-[10px] font-semibold leading-none
              flex items-center justify-center
              ring-2 ring-white
              shadow-[0_2px_4px_rgba(11,18,32,0.18)]
            "
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <FeedbackChatDrawer
        open={open}
        onClose={() => setOpen(false)}
        unreadThreadIds={unreadThreadIds}
      />
    </>
  );
}
