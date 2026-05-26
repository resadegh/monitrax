'use client';

/**
 * Public-site marketing — "Honest answers" FAQ.
 *
 * Phase 48 PR 5 (2026-05-26). Built from the Stitch `closing` canonical
 * screen, section 9. Uses native `<details>` / `<summary>` semantics —
 * accessible by default, works without JS, no extra dependency.
 *
 * Strategic discipline (CLAUDE.md §0 + §13):
 *   - Q1 "Are you regulated?" — exact AFSL/TPB/NCCP boundary copy
 *     locked in `.stitch/SITE.md` §6.2 + Phase 46 §9. Do not soften.
 *   - Q6 "Where is my data stored?" — softened from Stitch's "Encrypted
 *     at rest with customer-managed keys" to just "Encrypted at rest"
 *     because CMEK (Cloud KMS customer-managed keys) is currently a
 *     P1 item in CLAUDE.md §13.9 (planned, not yet deployed). We don't
 *     advertise security controls we haven't shipped.
 *   - Q3 "Are bank connections live yet?" — kept verbatim. CDR
 *     accreditation IS in progress per Phase 47 + IMPLEMENTATION_PLAN
 *     0e timeline; the answer accurately frames the current state
 *     (manual entry + CSV import, CDR coming).
 *
 * Composes: cosmos-* tokens (PR 1), `Reveal` (animations.tsx).
 */

import { Reveal } from './animations';

type FaqItem = { q: string; a: string };

const FAQS: readonly FaqItem[] = [
  {
    q: 'Are you regulated?',
    a: 'Monitrax is a financial information service, not a licensed adviser. We surface the maths and the mechanisms, not personal advice. For advice, speak to a registered tax agent, financial adviser, or credit assistant.',
  },
  {
    q: 'Do you sell my data?',
    a: "No. We're paid by subscriptions, not by brokering data. No ad trackers, no third-party data sales.",
  },
  {
    q: 'Are bank connections live yet?',
    a: 'Not yet. Consumer Data Right accreditation is in progress. For now you can import via CSV or enter accounts manually.',
  },
  {
    q: 'Is this just a budget app?',
    a: 'No. Built for households whose financial life lives across property, super, investments, trusts, and companies — where budget apps stop fitting.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No lock-in. Monthly billing month-to-month.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Google Cloud in Sydney. Encrypted at rest.',
  },
] as const;

export function FAQ() {
  return (
    <section aria-label="Frequently asked questions" className="relative overflow-hidden bg-cosmos py-24 md:py-32">
      {/* Background ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/3 rounded-full bg-cosmos-action/[0.04] blur-[120px]"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <Reveal>
          <div className="mb-16 max-w-2xl">
            <p className="mb-4 block text-[11px] font-medium uppercase tracking-[0.18em] text-cosmos-muted">
              FAQ
            </p>
            <h2 className="mb-4 text-balance text-3xl font-semibold tracking-tight text-cosmos sm:text-4xl lg:text-[44px]">
              Honest answers.
            </h2>
            <p className="text-lg text-cosmos-soft">
              Questions wealth-builders actually ask.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="grid max-w-4xl grid-cols-1 gap-4">
            {FAQS.map(({ q, a }) => (
              <details
                key={q}
                className="cosmos-glass group overflow-hidden rounded-xl transition-all duration-300 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between p-6 text-left">
                  <span className="pr-8 text-lg font-semibold leading-snug text-cosmos md:text-xl">
                    {q}
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-cosmos-action/15 text-cosmos-action transition-transform duration-300 group-open:rotate-45"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                </summary>
                <div className="max-w-3xl px-6 pb-6 leading-relaxed text-cosmos-soft">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
