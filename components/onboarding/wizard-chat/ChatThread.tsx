'use client';

/**
 * Renders the chat message stream + any inline recap card.
 *
 * Static in E.2a — no presence orb, no typewriter (E.2b). Just
 * sequential bubbles with a gentle 200ms fade-in on append.
 *
 * Auto-scrolls to the bottom on new message via a sentinel div +
 * `scrollIntoView({ behavior: 'smooth' })`. Respects
 * `prefers-reduced-motion`.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { AgentMessage } from './AgentMessage';
import { UserMessage } from './UserMessage';
import type { ChatMessage } from './types';

interface ChatThreadProps {
  messages: ChatMessage[];
  /** Optional inline content rendered after the last message — e.g.
   *  a TopicRecapCard. Caller decides when to show it. */
  trailingContent?: ReactNode;
  /** Optional "agent is thinking" indicator. v1: simple text dot trio. */
  thinking?: boolean;
}

export function ChatThread({ messages, trailingContent, thinking = false }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, trailingContent, thinking]);

  return (
    <div className="flex flex-col gap-3 pb-2">
      {messages.map((m) => (
        <div
          key={m.id}
          className="animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
        >
          {m.role === 'agent' ? <AgentMessage message={m} /> : <UserMessage message={m} />}
        </div>
      ))}
      {thinking && (
        <div className="animate-in fade-in duration-200 motion-reduce:animate-none">
          <div className="flex w-full pr-12">
            <div className="rounded-2xl rounded-bl-md bg-white/90 px-4 py-3 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-800/80 dark:ring-slate-700/60">
              <span className="inline-flex items-center gap-1 text-slate-400" aria-label="Agent is replying">
                <Dot delay="0ms" />
                <Dot delay="120ms" />
                <Dot delay="240ms" />
              </span>
            </div>
          </div>
        </div>
      )}
      {trailingContent}
      <div ref={endRef} />
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 motion-reduce:animate-none dark:bg-slate-500"
      style={{ animationDelay: delay }}
    />
  );
}
