'use client';

/**
 * Friendlies private beta welcome page.
 *
 * Lives at /welcome and is the destination for the personalised invitation
 * email sent to friendlies (see docs/marketing/gtm/FRIENDLIES_INVITE_PLAYBOOK.md).
 * Reads `?ref=<name>` query param to personalise the hero greeting.
 *
 * Design language matches the rest of the marketing surface:
 * `bg-stone-950` + warm amber accents + Apple-style Framer Motion via Reveal.
 *
 * This page is intentionally NOT auth-gated — a friendly who has already
 * signed up may revisit it from the email; a logged-in visitor still sees
 * the page (the primary CTA adapts to "Open dashboard" if authed).
 */

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header, Footer } from '@/components/marketing';
import { Reveal } from '@/components/marketing/animations';
import { useAuth } from '@/lib/context/AuthContext';

function capitalise(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function FriendlyName({ children }: { children: (name: string | null) => React.ReactNode }) {
  const params = useSearchParams();
  const raw = params.get('ref');
  // Sanitise: only allow letters / spaces / hyphens / apostrophes; max 32 chars
  const cleaned = raw
    ? raw.replace(/[^a-zA-Z\s'-]/g, '').trim().slice(0, 32)
    : '';
  const name = cleaned ? capitalise(cleaned.split(/\s+/)[0]) : null;
  return <>{children(name)}</>;
}

function PrimaryCta({ label, sublabel }: { label: string; sublabel?: string }) {
  const { user } = useAuth();
  const href = user ? '/dashboard' : '/register';
  const buttonLabel = user ? 'Open dashboard' : label;
  return (
    <div className="text-center">
      <Link
        href={href}
        className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-amber-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-600/30"
      >
        {buttonLabel}
      </Link>
      {sublabel && (
        <p className="mt-3 text-sm text-stone-500">{sublabel}</p>
      )}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-800 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-amber-400"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-white">{q}</span>
        <span
          className={`text-2xl text-stone-500 transition-transform ${open ? 'rotate-45' : ''}`}
          aria-hidden
        >
          +
        </span>
      </button>
      {open && (
        <div className="pb-6 text-stone-400" style={{ lineHeight: 1.6 }}>
          {a}
        </div>
      )}
    </div>
  );
}

function WelcomeContent() {
  return (
    <div className="min-h-screen flex flex-col bg-stone-950">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-amber-600/[0.07] rounded-full blur-[140px]" />
          </div>

          <div className="relative z-10 mx-auto max-w-3xl px-6 pt-28 pb-16 sm:pt-36 sm:pb-24 text-center">
            <FriendlyName>
              {(name) => (
                <Reveal>
                  <p className="text-sm font-medium text-amber-400/80 uppercase tracking-[0.2em] mb-6">
                    Private beta · by personal invite
                  </p>
                  <h1
                    className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white"
                    style={{ letterSpacing: '-0.02em', lineHeight: 1.05 }}
                  >
                    {name ? <>Welcome, {name}.</> : <>Welcome.</>}
                  </h1>
                  <p
                    className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-stone-400"
                    style={{ lineHeight: 1.55 }}
                  >
                    A clearer picture of your money — without the adviser,
                    the spreadsheet, or the 2024 thinking.
                  </p>
                </Reveal>
              )}
            </FriendlyName>

            <Reveal delay={0.24}>
              <div className="mt-10">
                <PrimaryCta
                  label="See if it&rsquo;s for you →"
                  sublabel="No credit card. Two weeks. Honest feedback only."
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* Why you specifically */}
        <section className="bg-stone-950 border-t border-stone-900">
          <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
            <Reveal>
              <h2
                className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
                style={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}
              >
                Why I&rsquo;m asking you specifically
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <ul className="mt-8 space-y-5 text-base sm:text-lg text-stone-300" style={{ lineHeight: 1.6 }}>
                <li className="flex gap-4">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-amber-500" aria-hidden />
                  <span>You&rsquo;re on a short list of about eight people I want feedback from before broader launch.</span>
                </li>
                <li className="flex gap-4">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-amber-500" aria-hidden />
                  <span>I picked you because you&rsquo;d actually use a thing like this — not because I want a favour.</span>
                </li>
                <li className="flex gap-4">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-amber-500" aria-hidden />
                  <span>You&rsquo;ll tell me the truth, not the polite version. That&rsquo;s the only feedback that actually helps.</span>
                </li>
              </ul>
            </Reveal>
          </div>
        </section>

        {/* The deal */}
        <section className="bg-stone-950 border-t border-stone-900">
          <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
            <Reveal>
              <h2
                className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
                style={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}
              >
                The deal
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="mt-8 space-y-6 text-base sm:text-lg text-stone-300" style={{ lineHeight: 1.6 }}>
                <div className="rounded-2xl border border-stone-800 bg-stone-900/40 p-6">
                  <p className="font-semibold text-white mb-1">Use it for ~2 weeks</p>
                  <p className="text-stone-400">
                    However much makes sense for your real situation. Manual entry for
                    now — live bank connections come later this year.
                  </p>
                </div>
                <div className="rounded-2xl border border-stone-800 bg-stone-900/40 p-6">
                  <p className="font-semibold text-white mb-1">A 30-minute call after</p>
                  <p className="text-stone-400">
                    What worked, what felt wrong, what&rsquo;s missing, what you&rsquo;d never use.
                    Your call what to talk about.
                  </p>
                </div>
                <div className="rounded-2xl border border-stone-800 bg-stone-900/40 p-6">
                  <p className="font-semibold text-white mb-1">Free indefinitely</p>
                  <p className="text-stone-400">
                    When the paid plans launch later this year, friendlies stay on the
                    full plan free for at least 6 months. Longer if you&rsquo;re still using it.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* What it does — 3 tiles */}
        <section className="bg-stone-950 border-t border-stone-900">
          <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
            <Reveal>
              <h2
                className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-center"
                style={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}
              >
                What it does
              </h2>
              <p className="mt-3 text-stone-400 text-center max-w-xl mx-auto">
                The TRAIL framework — five stages, but you start where you are.
              </p>
            </Reveal>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <Reveal delay={0.0}>
                <div className="rounded-2xl border border-stone-800 bg-gradient-to-b from-stone-900/60 to-stone-950 p-8 h-full">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-400/80 mb-3">Track</p>
                  <p className="text-xl font-semibold text-white mb-2">See everything in one place</p>
                  <p className="text-stone-400 text-sm" style={{ lineHeight: 1.55 }}>
                    Accounts, loans, properties, super, investments. The full picture without
                    the spreadsheet.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.12}>
                <div className="rounded-2xl border border-stone-800 bg-gradient-to-b from-stone-900/60 to-stone-950 p-8 h-full">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-400/80 mb-3">Reduce</p>
                  <p className="text-xl font-semibold text-white mb-2">Find the leaks</p>
                  <p className="text-stone-400 text-sm" style={{ lineHeight: 1.55 }}>
                    Where your money actually goes — and the small changes that compound into
                    real freedom.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.24}>
                <div className="rounded-2xl border border-stone-800 bg-gradient-to-b from-stone-900/60 to-stone-950 p-8 h-full">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-400/80 mb-3">Invest</p>
                  <p className="text-xl font-semibold text-white mb-2">Know what your money&rsquo;s doing</p>
                  <p className="text-stone-400 text-sm" style={{ lineHeight: 1.55 }}>
                    Net worth, asset mix, debt position — clear enough to make better
                    decisions, simple enough to actually use.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-stone-950 border-t border-stone-900">
          <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
            <Reveal>
              <h2
                className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
                style={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}
              >
                Four things you&rsquo;re probably wondering
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="mt-8">
                <FaqItem
                  q="Will my bank data be safe?"
                  a={
                    <>
                      Right now there are no live bank feeds — you enter your data manually.
                      When the live-feed version ships (using the Consumer Data Right via Basiq,
                      Australia&rsquo;s regulated open-banking framework), every connection
                      requires your explicit consent, runs over encrypted channels, and you
                      can revoke it any time. Monitrax is built to a compliance bar that&rsquo;s
                      meaningfully higher than most consumer apps.
                    </>
                  }
                />
                <FaqItem
                  q="What if I hate it?"
                  a={
                    <>
                      Hit reply on the invite email with a one-liner. I&rsquo;d rather know
                      than wonder. No awkwardness, no follow-up nagging. Honest critique is
                      the most valuable thing you can give me — it&rsquo;s exactly why I asked.
                    </>
                  }
                />
                <FaqItem
                  q="Will I get spammed?"
                  a={
                    <>
                      No. You&rsquo;ll get the app. You&rsquo;ll get one check-in email about
                      two weeks in to ask if you&rsquo;d like a 30-minute call. That&rsquo;s
                      it. No drip sequences, no &ldquo;here&rsquo;s another tip&rdquo; emails,
                      no upsells.
                    </>
                  }
                />
                <FaqItem
                  q="Is this financial advice?"
                  a={
                    <>
                      No. Monitrax shows you your own data clearly and points at general
                      benchmarks. It doesn&rsquo;t recommend specific products, doesn&rsquo;t
                      tell you what to do with your money, and isn&rsquo;t a substitute for an
                      AFSL-licensed financial adviser. If you want personal advice on a
                      decision, talk to a licensed adviser — Monitrax can help you walk into
                      that conversation with a clearer picture.
                    </>
                  }
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-stone-950 border-t border-stone-900">
          <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28 text-center">
            <Reveal>
              <h2
                className="text-3xl sm:text-4xl font-bold text-white tracking-tight"
                style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}
              >
                Want in?
              </h2>
              <p className="mt-4 text-lg text-stone-400" style={{ lineHeight: 1.55 }}>
                Sign up below. Use it for two weeks. We&rsquo;ll talk after.
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-10">
                <PrimaryCta
                  label="Sign up — it&rsquo;s free →"
                  sublabel="If it&rsquo;s a no or &ldquo;not now&rdquo;, hit reply on the email. I&rsquo;d rather know."
                />
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-stone-950">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        </div>
      }
    >
      <WelcomeContent />
    </Suspense>
  );
}
