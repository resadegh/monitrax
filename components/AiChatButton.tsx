/**
 * AI CHAT TRIGGER (header-bar icon)
 *
 * Per Reza directive 2026-05-07: the prior bottom-right FAB
 * collided with the mobile browser's bottom toolbar (the +/tab
 * button) — guaranteed overlap on iOS Safari + Chrome since both
 * anchor at the bottom-right of the viewport. Apple HIG
 * additionally discourages persistent FABs for system-utility
 * actions on iOS — utility affordances belong in the header bar
 * (Maps / Stocks / Settings pattern).
 *
 * Per CLAUDE.md §0 designer lens: AI chat trigger sits in the
 * top-right dashboard-chrome utility cluster — three icons in a
 * row, left-to-right `💬 feedback · 🤖 AI · ? help` — all h-9 /
 * w-9, same warm-ivory glass treatment, same ring + shadow. Reads
 * as a unified "ask for help" cluster rather than competing
 * attention vacuums.
 *
 * Right-edge offsets are coordinated across the THREE separate
 * components (no shared container): help right-3/4/6, AI
 * right-14/16/[4.5rem], feedback right-[6.25rem]/28/[7.5rem].
 * If you move one, check the other two — see the FeedbackButton.tsx
 * header for the full table. (2026-05-20: feedback + AI previously
 * collided at the same offset; feedback moved to the third slot.)
 *
 * Per CLAUDE.md §12.3: panel composition unchanged — same
 * `<AiAdvisorPanel />`, same conversation lifecycle. Only the
 * trigger position + visual treatment moved.
 *
 * Reviewer rule (preserved in `IMPLEMENTATION_PLAN.md` ↩️
 * Reversed Decisions): do NOT re-introduce a persistent
 * bottom-right FAB on the dashboard chrome for utility / help /
 * search affordances. Those go in the header-bar cluster next to
 * `<HelpDrawerButton />`. Bottom-right is reserved for genuine
 * primary actions tied to the current screen (e.g.
 * `<CashQuickAddButton />` on Activity, where it's screen-scoped).
 */

'use client';

import { useEffect, useState } from 'react';
import { Bot, Sparkles, X } from 'lucide-react';
import AiAdvisorPanel from '@/components/strategy/AiAdvisorPanel';

export default function AiChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape (desktop accessibility).
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  return (
    <>
      {/* Header-bar trigger — sits to the LEFT of the help button.
          Same h-9 / w-9 size, same glass treatment, same hover
          motion. Reads as a unified utility cluster. */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Close AI Advisor' : 'Open AI Advisor'}
        title="AI Advisor"
        className={`
          fixed top-3 right-14 sm:top-4 sm:right-16 lg:top-5 lg:right-[4.5rem]
          z-40
          inline-flex items-center justify-center
          h-9 w-9 rounded-full
          bg-white/85 backdrop-blur-sm
          ring-1 ring-slate-900/[0.08]
          text-emerald-700
          shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset]
          transition-[transform,box-shadow,background-color] duration-200 ease-out
          hover:bg-white hover:text-emerald-800 hover:shadow-[0_4px_14px_-6px_rgba(11,18,32,0.18)] hover:-translate-y-0.5
          motion-reduce:hover:translate-y-0
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
        `}
      >
        {isOpen ? (
          <X className="h-[18px] w-[18px]" strokeWidth={2} />
        ) : (
          <Bot className="h-[18px] w-[18px]" strokeWidth={2} />
        )}
      </button>

      {/* Chat Panel — anchored from top-right (slides down-from-trigger),
          NOT bottom-right (would re-create the chrome-overlap risk). */}
      <div
        className={`
          fixed top-14 right-3 sm:top-16 sm:right-4 lg:top-[4.25rem] lg:right-6
          z-50
          w-[calc(100vw-1.5rem)] sm:w-[380px] sm:max-w-[calc(100vw-3rem)]
          bg-white dark:bg-gray-900
          rounded-2xl shadow-2xl
          border border-gray-200 dark:border-gray-700
          transition-all duration-300 ease-in-out
          ${isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-2 pointer-events-none'
          }
        `}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-brand-primary rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-brand-secondary rounded-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">AI Financial Advisor</h3>
              <div className="flex items-center gap-1.5">
                <p className="text-emerald-200 text-xs">Powered by</p>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-white/20 text-white px-1.5 py-0.5 rounded">
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                  Gemini AI
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Chat Content */}
        <div className="h-[300px] sm:h-[450px] max-h-[50vh] sm:max-h-[60vh] overflow-hidden">
          {isOpen && (
            <AiAdvisorPanel
              mode="portfolio"
              onConversationUpdated={(id) => {
                console.log('Conversation updated:', id);
              }}
            />
          )}
        </div>

        {/* Panel Footer */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            AI advice is informational only. Consult a financial advisor for decisions.
          </p>
        </div>
      </div>

      {/* Backdrop for mobile — tap-to-close */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
