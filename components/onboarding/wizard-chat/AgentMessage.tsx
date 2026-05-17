'use client';

/**
 * Agent reply bubble — Phase 12 §4a.3.
 *
 * E.2b adds the typewriter render. Speed = `TYPEWRITER_CHARS_PER_SEC`
 * from motionTokens.ts (single SSOT). Word-by-word boundary ease —
 * we reveal whole words at a time, paced as if the underlying speed
 * were char-by-char. This reads as natural human typing; pure
 * char-by-char looks mechanical (per design rationale §4a.3).
 *
 * `prefers-reduced-motion: reduce` → render the full text immediately,
 * no animation. The user still sees the message — the message IS
 * the content.
 *
 * Caller passes `animate={true}` only for messages that are NEW in
 * this session (just-appended). For replayed history or initial
 * bootstrap messages, pass `animate={false}` to skip the typewriter
 * (would feel weird to type out an already-seen history).
 *
 * Design lens (§4a — presence, not persona): no avatar, no name
 * label. Bubble identity = left-alignment + warm-ivory styling.
 * The PresenceOrb sits next to the bubble (managed by ChatThread,
 * not embedded here — keeps the orb a reusable primitive).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TYPEWRITER_CHARS_PER_SEC,
  useReducedMotion,
} from './design/motionTokens';
import type { ChatMessage } from './types';

interface AgentMessageProps {
  message: ChatMessage;
  /** When true, animate the text in via typewriter. Caller sets this
   *  only for messages that should "appear typing" — typically the
   *  most recently appended agent reply. Defaults to false so static
   *  list rendering doesn't accidentally re-animate every message. */
  animate?: boolean;
  /** Fired once when the typewriter finishes (or immediately if
   *  reduced-motion / animate=false). Used by ChatThread to flip
   *  the PresenceOrb from `thinking` → `settled` → `idle`. */
  onTypingComplete?: () => void;
}

export function AgentMessage({ message, animate = false, onTypingComplete }: AgentMessageProps) {
  const reducedMotion = useReducedMotion();
  const fullText = message.text;
  const shouldAnimate = animate && !reducedMotion;

  const words = useMemo(() => fullText.split(/(\s+)/), [fullText]);

  // Index of the next word boundary to reveal. When equal to words.length,
  // the full text is shown.
  const [revealedWordCount, setRevealedWordCount] = useState<number>(
    shouldAnimate ? 0 : words.length,
  );

  // Avoid firing onTypingComplete more than once per message.
  const completedRef = useRef<boolean>(!shouldAnimate);

  useEffect(() => {
    if (!shouldAnimate) {
      if (!completedRef.current) {
        completedRef.current = true;
        onTypingComplete?.();
      }
      return;
    }

    // Reset when the message changes (different id).
    setRevealedWordCount(0);
    completedRef.current = false;

    // Approx ms per word — sum char lengths up to the next word and divide.
    // Slight per-word jitter (±15%) keeps the rhythm human, not metronomic.
    let cancelled = false;
    let idx = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (cancelled) return;
      if (idx >= words.length) {
        if (!completedRef.current) {
          completedRef.current = true;
          onTypingComplete?.();
        }
        return;
      }
      const wordChars = words[idx]?.length ?? 1;
      const baseMs = Math.max(40, Math.round((wordChars / TYPEWRITER_CHARS_PER_SEC) * 1000));
      const jitter = 1 + (Math.random() * 0.3 - 0.15);
      const nextDelay = Math.round(baseMs * jitter);

      idx += 1;
      setRevealedWordCount(idx);
      timer = setTimeout(tick, nextDelay);
    };

    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // We intentionally use message.id (not fullText) so stable
    // re-renders of the same message don't re-trigger the typewriter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, shouldAnimate]);

  const visibleText = shouldAnimate
    ? words.slice(0, revealedWordCount).join('')
    : fullText;

  return (
    <div className="flex w-full pr-12">
      <div className="rounded-2xl rounded-bl-md bg-white/90 px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-800/80 dark:text-slate-100 dark:ring-slate-700/60">
        {visibleText}
        {shouldAnimate && revealedWordCount < words.length && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-slate-400 motion-reduce:animate-none dark:bg-slate-500"
          />
        )}
      </div>
    </div>
  );
}
