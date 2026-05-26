'use client';

/**
 * /trail-method — long-form editorial guide to the TRAIL framework.
 *
 * Phase 48.7.1 (2026-05-26): rebuilt from Stitch screen
 * `bb39a804cde54ee7b35c31cfd601f288` ("The TRAIL Method - Editorial Guide").
 * Per CLAUDE.md §18, this is a Stitch-first redesign — `.stitch/designs/
 * trail-method.{html,png}` is the canonical source. The React conversion
 * preserves the canonical TRAIL stage names (Track / Reduce / Anchor /
 * Invest / Live) from the in-app SSOT (`lib/navigation/trailNav.tsx`),
 * NOT the hallucinated Stitch variants ("Automate" / "Legacy") that
 * appeared in the generation output.
 */

import Link from 'next/link';
import { Header, Footer } from '@/components/marketing';
import { Reveal, StaggerContainer, StaggerItem } from '@/components/marketing/animations';

const STAGES = [
  { letter: 'T', name: 'Track', tone: 'track' },
  { letter: 'R', name: 'Reduce', tone: 'reduce' },
  { letter: 'A', name: 'Anchor', tone: 'anchor' },
  { letter: 'I', name: 'Invest', tone: 'invest' },
  { letter: 'L', name: 'Live', tone: 'live' },
] as const;

const STAGE_DEEP_DIVE = [
  {
    letter: 'T',
    name: 'Track',
    tone: 'track',
    quote: 'Awareness is the first step toward sovereignty.',
    body:
      'You move from blind spending to radical visibility. By observing where every cent goes without judgment, you reclaim the data of your own life.',
    milestone: 'I can see my complete financial picture.',
    insightTitle: 'The Ostrich Effect',
    insightStat: '42%',
    insightBody:
      "of people avoid checking their bank balances when they know they've overspent. Real-time tracking neutralises this anxiety.",
  },
  {
    letter: 'R',
    name: 'Reduce',
    tone: 'reduce',
    quote: 'Fix the leaks before you fill the bucket.',
    body:
      "Now that you can see where your money goes, something will jump out. Maybe it's the $340/month in subscriptions you forgot you were paying. Maybe it's the $800/month in takeaway that felt like $200.",
    milestone: 'I spend less than I earn. I have a plan for my debt.',
    insightTitle: 'Snowball over avalanche',
    insightStat: 'Momentum',
    insightBody:
      'Northwestern’s Kellogg School found that people who pay off small debts first are more likely to eliminate ALL their debt — even though the math favours highest-interest-first.',
  },
  {
    letter: 'A',
    name: 'Anchor',
    tone: 'anchor',
    quote: 'An anchor keeps you stable when storms hit.',
    body:
      "Without a safety net, one unexpected expense can undo months of progress. The target: 3 months of living expenses in a separate account you only touch in genuine emergencies.",
    milestone: 'I have 3 months saved. I can handle a financial shock.',
    insightTitle: 'Decisions from stability',
    insightStat: '3mo',
    insightBody:
      'With a safety net, you stop making decisions from fear. You think clearly. You make choices from stability, not survival.',
  },
  {
    letter: 'I',
    name: 'Invest',
    tone: 'invest',
    quote: 'Compound interest is the eighth wonder of the world.',
    body:
      "Your leaks are fixed. Your cashflow is positive. Your safety net is built. For the first time, you're not in survival mode — you're ready to grow.",
    milestone: "My net worth is growing. I'm investing regularly.",
    insightTitle: 'Start small, stay consistent',
    insightStat: '$50/wk',
    insightBody:
      'Even $50/week into an index fund, starting today, can grow to hundreds of thousands over 20–30 years. You don’t need to be rich to start investing — you need to be stable.',
  },
  {
    letter: 'L',
    name: 'Live',
    tone: 'live',
    quote: "Financial freedom isn't about being rich — it's about having choices.",
    body:
      "This is the destination. Not a yacht. Not a mansion. Just the freedom to choose how you spend your time and your money.",
    milestone: 'I make financial decisions from abundance, not fear.',
    insightTitle: 'Work becomes optional',
    insightStat: 'Choice',
    insightBody:
      'Financial freedom is the point where your passive income approaches or exceeds your living expenses. Work becomes a choice, not an obligation.',
  },
] as const;

const ORIGIN_CARDS = [
  {
    title: 'Barefoot Investor',
    body: "We adopt the structural simplicity of automated buckets for daily resilience. Australia's most trusted money guide, 2M+ copies sold.",
  },
  {
    title: "Dave Ramsey's Baby Steps",
    body: "We utilise the psychological momentum of the 'Snowball' method for debt elimination. 10M+ people worldwide have followed the steps.",
  },
  {
    title: 'Behavioural Economics',
    body: 'We bridge intent and action through choice architecture and nudges. Bandura self-efficacy + Thaler "Save More Tomorrow" + Prochaska stage-matched intervention.',
  },
] as const;

const SCIENCE_CARDS = [
  {
    author: 'Bandura',
    year: '1977',
    finding: 'Self-efficacy is the strongest predictor of behaviour change.',
    use: 'Each TRAIL stage has a clear, achievable milestone.',
  },
  {
    author: 'Prochaska',
    year: '1983',
    finding: 'People at different stages need different interventions.',
    use: "TRAIL's stage-matched guidance means you always get what you need.",
  },
  {
    author: 'Thaler',
    year: '2004',
    finding: '"Save More Tomorrow" raised savings from 3.5% → 13.6% by automating.',
    use: "TRAIL connects your accounts and lets the system do the work.",
  },
  {
    author: 'Mani et al.',
    year: '2013',
    finding: 'Financial worry consumes mental bandwidth equivalent to 13 IQ points.',
    use: 'A clear picture reduces the cognitive tax of money decisions.',
  },
] as const;

const STAGE_TONE_CLASSES: Record<string, { bg: string; border: string; text: string; quoteBorder: string; bigLetterBg: string; shadow: string }> = {
  track: {
    bg: 'bg-cosmos-track/15',
    border: 'border-cosmos-track',
    text: 'text-cosmos-track',
    quoteBorder: 'border-cosmos-track',
    bigLetterBg: 'text-cosmos-track/10',
    shadow: 'shadow-[0_0_24px_-4px_hsl(var(--cosmos-track)/0.4)]',
  },
  reduce: {
    bg: 'bg-cosmos-reduce/15',
    border: 'border-cosmos-reduce',
    text: 'text-cosmos-reduce',
    quoteBorder: 'border-cosmos-reduce',
    bigLetterBg: 'text-cosmos-reduce/10',
    shadow: 'shadow-[0_0_24px_-4px_hsl(var(--cosmos-reduce)/0.4)]',
  },
  anchor: {
    bg: 'bg-cosmos-anchor/15',
    border: 'border-cosmos-anchor',
    text: 'text-cosmos-anchor',
    quoteBorder: 'border-cosmos-anchor',
    bigLetterBg: 'text-cosmos-anchor/10',
    shadow: 'shadow-[0_0_24px_-4px_hsl(var(--cosmos-anchor)/0.4)]',
  },
  invest: {
    bg: 'bg-cosmos-invest/15',
    border: 'border-cosmos-invest',
    text: 'text-cosmos-invest',
    quoteBorder: 'border-cosmos-invest',
    bigLetterBg: 'text-cosmos-invest/10',
    shadow: 'shadow-[0_0_24px_-4px_hsl(var(--cosmos-invest)/0.4)]',
  },
  live: {
    bg: 'bg-cosmos-live/15',
    border: 'border-cosmos-live',
    text: 'text-cosmos-live',
    quoteBorder: 'border-cosmos-live',
    bigLetterBg: 'text-cosmos-live/10',
    shadow: 'shadow-[0_0_24px_-4px_hsl(var(--cosmos-live)/0.4)]',
  },
};

export default function TrailMethodPage() {
  return (
    <div className="flex min-h-screen flex-col bg-cosmos">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="cosmos-glow-center relative isolate flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
          <Reveal>
            <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-cosmos-action">
              The TRAIL Method
            </p>
            <h1 className="mx-auto mb-6 max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-cosmos sm:text-5xl lg:text-6xl xl:text-[64px]">
              Your path from financial stress
              <br />
              <span className="bg-gradient-to-r from-cosmos-action-soft to-cosmos-action bg-clip-text text-transparent">
                to financial freedom.
              </span>
            </h1>
            <p className="text-lg italic text-cosmos-soft sm:text-xl">
              A guide for households outgrowing budget apps.
            </p>
          </Reveal>
          <div aria-hidden="true" className="pointer-events-none absolute bottom-10 text-cosmos-faint">
            <svg className="h-6 w-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </section>

        {/* Problem — asymmetric pull-quote + 3 stat cards */}
        <section className="mx-auto max-w-7xl px-6 py-24 md:py-32">
          <div className="flex flex-col items-center gap-12 md:flex-row">
            <Reveal className="md:w-3/5">
              <div className="border-l-2 border-cosmos-action py-4 pl-8">
                <blockquote className="text-2xl font-medium italic leading-relaxed text-cosmos sm:text-3xl">
                  "You're not <span className="text-cosmos-action">bad with money</span>. You just don't have a path."
                </blockquote>
                <p className="mt-6 text-base leading-relaxed text-cosmos-soft">
                  Most financial tools are designed to keep you in reactive decision-making. TRAIL is built to break the cycle.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.1} className="flex w-full flex-col gap-4 md:w-2/5">
              <div className="cosmos-glass rounded-xl p-6">
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-cosmos-action">Psychological burden</div>
                <div className="text-3xl font-bold text-cosmos">72%</div>
                <div className="mt-1 text-sm text-cosmos-soft">of adults report feeling stressed about money in the last month.</div>
              </div>
              <div className="cosmos-glass rounded-xl p-6">
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-cosmos-anchor">Cognitive cost</div>
                <div className="text-3xl font-bold text-cosmos">&minus;13 IQ points</div>
                <div className="mt-1 text-sm text-cosmos-soft">The mental bandwidth lost to financial scarcity (Mani et al., <em>Science</em> 2013).</div>
              </div>
              <div className="cosmos-glass rounded-xl p-6">
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-cosmos-track">Fragmented tools</div>
                <div className="text-3xl font-bold text-cosmos">1 in 3</div>
                <div className="mt-1 text-sm text-cosmos-soft">Australians still rely on manual spreadsheets or nothing at all.</div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Origin */}
        <section className="bg-cosmos-deeper/40 py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal>
              <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-cosmos sm:text-4xl">
                Where TRAIL comes from
              </h2>
            </Reveal>
            <StaggerContainer className="grid gap-6 md:grid-cols-3">
              {ORIGIN_CARDS.map((card) => (
                <StaggerItem key={card.title}>
                  <div className="cosmos-glass flex h-full flex-col items-center rounded-xl p-8 text-center">
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-cosmos-action/10">
                      <svg className="h-6 w-6 text-cosmos-action" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l9 4v6c0 5-3.5 9-9 11-5.5-2-9-6-9-11V6z" />
                      </svg>
                    </div>
                    <h3 className="mb-3 font-semibold text-cosmos">{card.title}</h3>
                    <p className="text-sm leading-relaxed text-cosmos-soft">{card.body}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>

        {/* The Five — connected nodes */}
        <section id="trail" className="overflow-hidden py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal>
              <h2 className="mb-16 text-center text-4xl font-semibold tracking-tight text-cosmos sm:text-5xl lg:text-[56px]">
                The Five Stages
              </h2>
            </Reveal>

            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute left-0 top-1/2 hidden h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-cosmos-hairline-strong to-transparent md:block"
              />
              <StaggerContainer className="relative z-10 flex flex-col items-center justify-between gap-12 md:flex-row md:gap-4">
                {STAGES.map((stage) => {
                  const t = STAGE_TONE_CLASSES[stage.tone];
                  return (
                    <StaggerItem key={stage.letter}>
                      <div className="flex flex-col items-center">
                        <div
                          className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full border text-2xl font-bold ${t.bg} ${t.border} ${t.text} ${t.shadow}`}
                        >
                          {stage.letter}
                        </div>
                        <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${t.text}`}>
                          {stage.name}
                        </span>
                      </div>
                    </StaggerItem>
                  );
                })}
              </StaggerContainer>
            </div>
          </div>
        </section>

        {/* Deep Dives — 5 alternating sections */}
        <section className="py-24 md:py-32">
          <div className="mx-auto max-w-7xl space-y-32 px-6">
            {STAGE_DEEP_DIVE.map((stage, i) => {
              const t = STAGE_TONE_CLASSES[stage.tone];
              return (
                <Reveal key={stage.letter}>
                  <div
                    className={`flex flex-col items-center gap-12 ${i % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'}`}
                  >
                    <div className="md:w-1/2">
                      <div
                        className={`mb-[-60px] text-[120px] font-black leading-none ${t.bigLetterBg}`}
                        aria-hidden="true"
                      >
                        {stage.letter}
                      </div>
                      <h3 className="mb-6 text-3xl font-semibold tracking-tight text-cosmos sm:text-4xl">
                        Stage {i + 1}: {stage.name}
                      </h3>
                      <blockquote className={`mb-6 border-l-2 pl-6 text-lg italic text-cosmos ${t.quoteBorder}`}>
                        "{stage.quote}"
                      </blockquote>
                      <p className="mb-6 text-base leading-relaxed text-cosmos-soft">{stage.body}</p>
                      <p className="text-sm font-medium text-cosmos">
                        <span className="text-cosmos-muted">The milestone: </span>
                        &ldquo;{stage.milestone}&rdquo;
                      </p>
                    </div>
                    <div className="w-full md:w-1/2">
                      <div className="cosmos-glass relative rounded-2xl p-8">
                        <div className="mb-4 flex items-center gap-3">
                          <span className={`inline-flex h-2 w-2 rounded-full ${t.bg}`} aria-hidden="true" />
                          <span className="text-xs font-medium uppercase tracking-[0.18em] text-cosmos-muted">
                            {stage.insightTitle}
                          </span>
                        </div>
                        <p className={`mb-3 text-3xl font-bold ${t.text}`}>{stage.insightStat}</p>
                        <p className="text-sm leading-relaxed text-cosmos-soft">{stage.insightBody}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Science */}
        <section className="bg-cosmos-deeper/40 py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal>
              <div className="mb-16">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cosmos-action">
                  The Science
                </p>
                <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-cosmos sm:text-4xl">
                  TRAIL isn't built on opinion. It's built on decades of behavioural research.
                </h2>
              </div>
            </Reveal>
            <StaggerContainer className="grid gap-6 md:grid-cols-2">
              {SCIENCE_CARDS.map((card) => (
                <StaggerItem key={card.author}>
                  <div className="cosmos-glass h-full rounded-xl p-8">
                    <div className="mb-3 flex items-baseline gap-3">
                      <span className="text-lg font-semibold text-cosmos">{card.author}</span>
                      <span className="text-xs font-medium tracking-wider text-cosmos-muted">{card.year}</span>
                    </div>
                    <p className="mb-3 text-base text-cosmos">{card.finding}</p>
                    <p className="text-sm text-cosmos-soft">
                      <span className="text-cosmos-muted">How TRAIL uses it: </span>
                      {card.use}
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>

        {/* Final CTA */}
        <section className="cosmos-glow-center relative overflow-hidden px-6 py-32 md:py-40">
          <Reveal>
            <div className="relative z-10 mx-auto max-w-4xl text-center">
              <h2 className="mb-8 text-4xl font-semibold leading-tight tracking-tight text-cosmos sm:text-5xl lg:text-6xl">
                Ready to find your path?
              </h2>
              <p className="mx-auto mb-12 max-w-md text-lg leading-relaxed text-cosmos-soft">
                Sixty seconds. Five questions. Your personalised path.
              </p>
              <Link
                href="/trail-check"
                className="cosmos-cta inline-flex min-h-[44px] items-center justify-center rounded-full px-10 py-4 text-base font-semibold"
              >
                Take the free TRAIL Check
              </Link>
              <p className="mt-6 text-sm text-cosmos-muted">
                No credit card. No account required.
              </p>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
