'use client';

/**
 * Renders the chat message stream + an inline PresenceOrb anchored
 * to the most-recent agent message. Phase 12 §4a.
 *
 * Design rules (binding):
 *   - ONE orb visible at a time — anchored to the latest agent
 *     bubble. Older agent bubbles render plain. Multiple breathing
 *     orbs at once = visual noise; the orb represents the agent's
 *     PRESENCE, not a label on every utterance.
 *   - When agent is `thinking` (LLM call in flight) AND there's no
 *     message yet for the current turn, the orb stands alone with
 *     the three-dot thinking indicator (Apple Intelligence pattern).
 *   - Typewriter render handled by AgentMessage; ChatThread flips
 *     the orb state from `thinking` → `settled` when the typewriter
 *     completes.
 *
 * Auto-scrolls to the bottom on new message. Respects
 * `prefers-reduced-motion` via individual component fallbacks.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AgentMessage } from './AgentMessage';
import { UserMessage } from './UserMessage';
import { PresenceOrb, type PresenceOrbState } from './primitives/PresenceOrb';
import { ORB_SETTLED_GLOW_MS, useReducedMotion } from './design/motionTokens';
import type { ChatMessage } from './types';

interface ChatThreadProps {
  messages: ChatMessage[];
  /** Optional inline content rendered after the last message — e.g.
   *  a TopicRecapCard. Caller decides when to show it. */
  trailingContent?: ReactNode;
  /** True while extract API is in flight + before the next agent
   *  message arrives. Drives the orb's `thinking` state. */
  thinking?: boolean;
  /** Index of the most-recent message that should typewrite. Caller
   *  bumps this when appending a new agent message. Used so the
   *  ChatThread knows which AgentMessage to mount with animate=true. */
  newestAnimatedMessageId?: string | null;
}

export function ChatThread({
  messages,
  trailingContent,
  thinking = false,
  newestAnimatedMessageId = null,
}: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();

  // Brief 'settled' glow when the typewriter finishes, then back to 'idle'.
  const [orbSettling, setOrbSettling] = useState(false);

  const handleTypingComplete = useCallback(() => {
    if (reducedMotion) return; // no settled animation under reduced motion
    setOrbSettling(true);
    const t = setTimeout(() => setOrbSettling(false), ORB_SETTLED_GLOW_MS);
    return () => clearTimeout(t);
  }, [reducedMotion]);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'end',
      });
    }
  }, [messages, trailingContent, thinking, reducedMotion]);

  // Find index of the latest agent message — the only one that hosts
  // the orb in its gutter.
  const latestAgentIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'agent') return i;
    }
    return -1;
  }, [messages]);

  const orbState: PresenceOrbState = thinking
    ? 'thinking'
    : orbSettling
      ? 'settled'
      : 'idle';

  return (
    <div className="flex flex-col gap-3 pb-2">
      {messages.map((m, idx) => {
        const isAgent = m.role === 'agent';
        const showOrbForThis = isAgent && idx === latestAgentIdx;
        const shouldAnimate = isAgent && m.id === newestAnimatedMessageId;

        return (
          <div
            key={m.id}
            className="animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
          >
            {isAgent ? (
              <div className="flex w-full items-start gap-2">
                <div className="flex w-7 shrink-0 items-start pt-2">
                  {showOrbForThis ? (
                    <PresenceOrb state={orbState} size={24} />
                  ) : null}
                </div>
                <div className="flex-1">
                  <AgentMessage
                    message={m}
                    animate={shouldAnimate}
                    onTypingComplete={showOrbForThis ? handleTypingComplete : undefined}
                  />
                </div>
              </div>
            ) : (
              <UserMessage message={m} />
            )}
          </div>
        );
      })}

      {/* Thinking pre-typewriter: orb stands alone with three dots,
          BEFORE the next agent message arrives. If we already have a
          latest agent message AND we're thinking AGAIN (next turn),
          the orb on that message already shows 'thinking' — so we
          only render this standalone block when there's NO agent
          message yet at all (very first turn). */}
      {thinking && latestAgentIdx === -1 && (
        <div className="animate-in fade-in duration-200 motion-reduce:animate-none">
          <div className="flex w-full items-start gap-2">
            <div className="flex w-7 shrink-0 items-start pt-2">
              <PresenceOrb state="thinking" size={24} />
            </div>
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
