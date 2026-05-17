'use client';

/**
 * Agent reply bubble. Static in E.2a — no typewriter, no presence
 * orb (those land in E.2b). Single column, warm-ivory background,
 * subtle shadow. Premium fintech voice, not iMessage pastiche.
 *
 * Design lens (Phase 12 §4a — presence, not persona): no avatar,
 * no name label. The bubble's only identifier is its position
 * (left-aligned) and styling (warm). The product carries the brand;
 * we don't introduce a character.
 */

import type { ChatMessage } from './types';

export function AgentMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex w-full pr-12">
      <div className="rounded-2xl rounded-bl-md bg-white/90 px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-800/80 dark:text-slate-100 dark:ring-slate-700/60">
        {message.text}
      </div>
    </div>
  );
}
