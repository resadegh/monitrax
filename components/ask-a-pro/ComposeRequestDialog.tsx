'use client';

/**
 * Phase 32C PR4c — `<ComposeRequestDialog />`.
 *
 * Triggered by clicking on a public listing in the AskAPro picker (PR4b)
 * or by the Connect CTA on a public marketplace listing detail page. Lets
 * the user write the question, optionally attach a curated snapshot
 * context, and submit to `/api/professional-requests`.
 *
 * AI-suggested starters: a short list of context-biased prompts the user
 * can click to populate the textarea. Lower-friction than a blank field;
 * no API call — the suggestions are static per context label.
 *
 * Snapshot context: at v1 the user toggles a single "Share my headline
 * metrics" checkbox which sends `{ shareMetrics: true }` as the
 * `snapshotContextJson`. The adviser-side reader can then look up the
 * fresh snapshot when the request is opened — keeping the at-rest
 * payload minimal (CDR-derived but not redundant). Richer per-metric
 * toggles defer to a follow-up.
 *
 * Submit success → close dialog, callback fires (caller can show a
 * toast / navigate / etc).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Props {
  listingId: string;
  listingDisplayName: string;
  listingDiscipline: string;
  /** Optional context label propagated from the AskAPro picker
   *  (tax / refinance / etc). Drives the suggestion starters. */
  context?: string;
  onClose: () => void;
  onSubmitted: (requestId: string) => void;
}

const STARTERS_BY_CONTEXT: Record<string, string[]> = {
  tax: [
    "I want to make sure my tax position is optimised before EOFY — could we have a chat?",
    "I have an investment property and I'm wondering whether negative gearing still works for me.",
    "I have a discretionary trust and want to understand my distribution options this year.",
  ],
  refinance: [
    "I'm thinking about refinancing my home loan — could you tell me what's possible?",
    "My fixed rate is rolling off and I'd like to know my best move.",
  ],
  property: [
    "I'm thinking about buying my first investment property and I'd like to understand what I can afford.",
    "I have an investment property and I'm wondering whether to sell, hold, or refinance.",
  ],
  smsf: [
    "I want to know whether an SMSF makes sense for my situation.",
    "I have an SMSF and I'd like to discuss its current strategy.",
  ],
  retirement: [
    "I'm 5–10 years from retirement and want to understand whether I'm on track.",
  ],
  wealth: [
    "I want to build wealth more systematically — could we talk strategy?",
  ],
  trust: [
    "I have a family trust and I want to understand its structure better.",
  ],
  business: [
    "I run a small business and I'd like to talk about wealth strategy.",
  ],
  estate: [
    "I want to put an estate plan in place — could we discuss next steps?",
  ],
  insurance: [
    "I want to review my income protection and life insurance — am I underinsured?",
  ],
  general: [
    "I'd like a sense-check on my overall financial situation.",
  ],
};

export function ComposeRequestDialog({
  listingId,
  listingDisplayName,
  listingDiscipline,
  context,
  onClose,
  onSubmitted,
}: Props) {
  const [question, setQuestion] = useState('');
  const [shareMetrics, setShareMetrics] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const starters = STARTERS_BY_CONTEXT[context ?? 'general'] ?? STARTERS_BY_CONTEXT.general;
  const tooShort = question.trim().length < 20;

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, submitting]);

  // Body scroll lock
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const handleSubmit = async () => {
    if (tooShort) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/professional-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId,
          question: question.trim(),
          contextLabel: context,
          snapshotContextJson: shareMetrics ? { shareMetrics: true } : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Special-case the org-attached blocked path with a friendlier message
        if (json?.error?.code === 'ORG_USER_PUBLIC_BLOCKED') {
          throw new Error(
            'You\'re already linked to a professional. Send them a message through your existing connection rather than the public marketplace.',
          );
        }
        throw new Error(json?.error?.message ?? 'Submit failed');
      }
      onSubmitted(json.data.request.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in duration-200"
        onClick={() => !submitting && onClose()}
        aria-hidden="true"
      />
      <div
        className="relative w-full sm:max-w-lg bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl ring-1 ring-slate-900/5 max-h-[92vh] overflow-y-auto motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:sm:zoom-in-95 motion-safe:sm:slide-in-from-bottom-0 duration-200"
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="compose-title" className="text-[15px] font-semibold text-slate-900">
              Send a question to {listingDisplayName}
            </h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              {disciplineLabel(listingDiscipline)} · They&rsquo;ll review and either accept or decline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label="Close"
            className="rounded-full hover:bg-slate-100 w-8 h-8 inline-flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {starters.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Need a starting point?
              </h3>
              <div className="space-y-1.5">
                {starters.map((starter, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setQuestion(starter)}
                    className="block w-full text-left rounded-lg bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200 px-3 py-2 text-[12px] text-slate-700 transition-colors"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <label className="block">
              <span className="block text-[12px] font-medium text-slate-700 mb-1.5">Your question</span>
              <textarea
                className="block w-full rounded-xl border-0 bg-white py-2.5 px-3.5 text-[14px] text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-emerald-500 transition-shadow min-h-[140px]"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What would you like their help with? Be specific — they&rsquo;ll use this to decide whether to take you on as a client."
                maxLength={2000}
                disabled={submitting}
              />
              <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
                {question.length} / 2000 · min 20 chars
              </p>
            </label>
          </section>

          <section className="rounded-xl bg-emerald-50/60 ring-1 ring-emerald-100 p-3.5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shareMetrics}
                onChange={(e) => setShareMetrics(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                disabled={submitting}
              />
              <div className="text-[13px] text-emerald-900">
                <div className="font-medium">Share my headline metrics</div>
                <p className="text-[12px] text-emerald-800 mt-0.5 leading-snug">
                  Net worth, monthly cashflow, total debt, household composition — the same metrics this professional
                  would see if you became their client. Helps them give a better first response. You can revoke any time.
                </p>
              </div>
            </label>
          </section>

          {error && (
            <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 px-3.5 py-2.5 text-[13px] text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-slate-500 leading-snug">
              You can withdraw any time before they respond.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => !submitting && onClose()}
                className="inline-flex items-center rounded-full hover:bg-slate-100 px-3 py-1.5 text-[12px] text-slate-600 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={tooShort || submitting}
                className="inline-flex items-center rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center pt-2">
            Need to manage requests later? <Link href="/dashboard/requests" className="text-emerald-700 underline" onClick={onClose}>Track your requests</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function disciplineLabel(d: string): string {
  switch (d) {
    case 'FINANCIAL_ADVISOR': return 'Financial adviser';
    case 'MORTGAGE_BROKER': return 'Mortgage broker';
    case 'ACCOUNTING_FIRM': return 'Accounting firm';
    case 'TAX_AGENT': return 'Tax agent';
    case 'BOOKKEEPER': return 'Bookkeeper';
    case 'OTHER': return 'Professional';
    default: return d;
  }
}
