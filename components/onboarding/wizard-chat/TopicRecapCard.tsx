'use client';

/**
 * Per-topic recap card — Phase 12 §E.3 + §4a.5.
 *
 * Renders inline at the end of a topic conversation. Lists every
 * field the agent staged for the topic, with two actions:
 *   - "Looks right" → stage the data + hand off
 *   - "Change something" → open a free-text correction flow
 *
 * Visual rules (§4a — presence, not persona):
 *   - NOT a chat bubble — a structured card. Visual contrast = trust.
 *   - Generous spacing, readable typography.
 *   - "Looks right" is the gradient primary CTA. "Change something"
 *     is a ghost link.
 *   - No emojis. No mascots. The card carries the agent's notes.
 *
 * Mistake-recovery transparency (§4a.5 — implemented in E.2b):
 *   When the user taps "Change something", the recap card should
 *   dim and stay visible above the next conversation. v1 ships the
 *   transparency rule at the orchestration layer (the orchestrator
 *   does NOT remove the old card); animation polish lands in E.2b.
 */

import { CheckCircle2, Edit3 } from 'lucide-react';

export interface RecapRow {
  label: string;
  value: string;
}

interface TopicRecapCardProps {
  title: string;
  rows: RecapRow[];
  /** When true (after the user taps "Change something"), render at
   *  half opacity + remove the action buttons. v1 ships this prop
   *  but the orchestrator wires it up minimally; full animation
   *  comes in E.2b. */
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
  return (
    <div
      className={
        'rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-5 shadow-sm transition-opacity duration-200 motion-reduce:transition-none dark:border-emerald-900/40 dark:bg-emerald-950/30 ' +
        (dimmed ? 'opacity-50' : 'opacity-100')
      }
      aria-live="polite"
    >
      <header className="mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <h3 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
          {title}
        </h3>
      </header>

      <dl className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-2 sm:gap-x-6">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-xs font-medium uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
              {row.label}
            </dt>
            <dd className="text-sm font-medium text-emerald-950 dark:text-emerald-50">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {!dimmed && (
        <div className="mt-5 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onChange}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 motion-reduce:transition-none dark:text-emerald-200 dark:hover:bg-emerald-900/40"
          >
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            Change something
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(16,185,129,0.55)] transition-opacity hover:opacity-95 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 motion-reduce:transition-none"
          >
            Looks right →
          </button>
        </div>
      )}
    </div>
  );
}
