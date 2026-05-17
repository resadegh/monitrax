'use client';

/**
 * Per-topic recap card — Phase 12 §E.3 + §4a.3 + §4a.5.
 *
 * E.2b polish:
 *   - Card rises from below (translateY) over RECAP_CARD_RISE_MS.
 *   - Field rows fade in RECAP_FIELD_STAGGER_MS apart, in document
 *     order. Visual proof that the agent is assembling its notes
 *     before asking the user to confirm.
 *   - "Looks right" CTA stays disabled until RECAP_CTA_DELAY_MS
 *     after the last field has settled — a beat for the user to
 *     READ before being able to confirm. Prevents the
 *     reflex-tap-confirm-without-reading failure mode.
 *   - `dimmed` state (mistake-recovery transparency §4a.5) fades the
 *     card to MISTAKE_RECOVERY_DIM_OPACITY and removes the action
 *     buttons. The orchestrator KEEPS the dimmed card in the thread
 *     above the new recap — the visible trail is the trust signal.
 *
 * `prefers-reduced-motion: reduce` collapses every animation to its
 * end state — card renders fully visible, all fields shown, CTA
 * immediately enabled.
 *
 * Visual rules (binding):
 *   - NOT a chat bubble — a structured card. Visual contrast = trust.
 *   - Generous spacing, readable typography.
 *   - "Looks right" = gradient primary CTA. "Change something" = ghost.
 *   - No emojis. No mascots. The card carries the agent's notes.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, Edit3 } from 'lucide-react';
import {
  MISTAKE_RECOVERY_DIM_OPACITY,
  RECAP_CARD_RISE_MS,
  RECAP_CARD_RISE_EASING,
  RECAP_CTA_DELAY_MS,
  RECAP_FIELD_STAGGER_MS,
  useReducedMotion,
} from './design/motionTokens';

export interface RecapRow {
  label: string;
  value: string;
}

interface TopicRecapCardProps {
  title: string;
  rows: RecapRow[];
  /** When true (after the user taps "Change something"), render at
   *  half opacity + remove the action buttons. The orchestrator
   *  keeps the dimmed card visible — never silently overwritten. */
  dimmed?: boolean;
  onConfirm: () => void;
  onChange: () => void;
  /** Disables both CTAs while a save/audit is in flight. */
  busy?: boolean;
}

export function TopicRecapCard({
  title,
  rows,
  dimmed = false,
  onConfirm,
  onChange,
  busy = false,
}: TopicRecapCardProps) {
  const reducedMotion = useReducedMotion();
  const totalFields = rows.length;

  // Reveal index — how many field rows have faded in so far.
  const [revealed, setRevealed] = useState<number>(
    reducedMotion || dimmed ? totalFields : 0,
  );
  // CTA gate — disabled until the delay after the last field settles.
  const [ctaReady, setCtaReady] = useState<boolean>(reducedMotion || dimmed);

  useEffect(() => {
    if (reducedMotion || dimmed) {
      setRevealed(totalFields);
      setCtaReady(true);
      return;
    }
    setRevealed(0);
    setCtaReady(false);

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= totalFields; i++) {
      timers.push(setTimeout(() => setRevealed(i), i * RECAP_FIELD_STAGGER_MS));
    }
    timers.push(
      setTimeout(
        () => setCtaReady(true),
        totalFields * RECAP_FIELD_STAGGER_MS + RECAP_CTA_DELAY_MS,
      ),
    );
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [reducedMotion, dimmed, totalFields]);

  const cardStyle = reducedMotion
    ? { opacity: dimmed ? MISTAKE_RECOVERY_DIM_OPACITY : 1 }
    : {
        opacity: dimmed ? MISTAKE_RECOVERY_DIM_OPACITY : 1,
        animation: `recapCardRise ${RECAP_CARD_RISE_MS}ms ${RECAP_CARD_RISE_EASING} both`,
      };

  const ctaDisabled = busy || !ctaReady;

  return (
    <>
      <style>{recapKeyframes}</style>
      <div
        className="rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-5 shadow-sm transition-opacity duration-200 motion-reduce:transition-none dark:border-emerald-900/40 dark:bg-emerald-950/30"
        style={cardStyle}
        aria-live="polite"
      >
        <header className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <h3 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
            {title}
          </h3>
        </header>

        <dl className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-2 sm:gap-x-6">
          {rows.map((row, idx) => {
            const visible = idx < revealed;
            return (
              <div
                key={row.label}
                className="contents"
                style={
                  reducedMotion
                    ? undefined
                    : {
                        opacity: visible ? 1 : 0,
                        transform: visible ? 'translateY(0)' : 'translateY(4px)',
                        transition: `opacity 240ms ${RECAP_CARD_RISE_EASING}, transform 240ms ${RECAP_CARD_RISE_EASING}`,
                      }
                }
              >
                <dt className="text-xs font-medium uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
                  {row.label}
                </dt>
                <dd className="text-sm font-medium text-emerald-950 dark:text-emerald-50">
                  {row.value}
                </dd>
              </div>
            );
          })}
        </dl>

        {!dimmed && (
          <div className="mt-5 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onChange}
              disabled={ctaDisabled}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 motion-reduce:transition-none dark:text-emerald-200 dark:hover:bg-emerald-900/40"
            >
              <Edit3 className="h-4 w-4" aria-hidden="true" />
              Change something
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={ctaDisabled}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(16,185,129,0.55)] transition-opacity hover:opacity-95 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 motion-reduce:transition-none"
            >
              Looks right →
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// Inline keyframes — kept in this file so the recap card is
// self-contained. The PresenceOrb keyframes live in its dedicated CSS
// for the same reason (one file per primitive's animations).
const recapKeyframes = `
@keyframes recapCardRise {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes recapCardRise {
    from { opacity: 1; transform: none; }
    to   { opacity: 1; transform: none; }
  }
}
`;
