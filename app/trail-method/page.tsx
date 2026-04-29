'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Header, Footer } from '@/components/marketing';
import { Reveal } from '@/components/marketing/animations';
import {
  Eye,
  Scissors,
  Anchor,
  TrendingUp,
  Sun,
  ArrowRight,
} from 'lucide-react';

const ease: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const stages = [
  { letter: 'T', name: 'Track', icon: Eye, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { letter: 'R', name: 'Reduce', icon: Scissors, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  { letter: 'A', name: 'Anchor', icon: Anchor, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { letter: 'I', name: 'Invest', icon: TrendingUp, color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  { letter: 'L', name: 'Live', icon: Sun, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
];

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`px-6 py-16 sm:py-24 ${className}`}><div className="mx-auto max-w-3xl">{children}</div></section>;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Reveal>
      <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl lg:text-4xl mb-6" style={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}>
        {children}
      </h2>
    </Reveal>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <Reveal delay={0.1}>
      <div className="text-base text-stone-600 dark:text-stone-400 space-y-5" style={{ lineHeight: 1.8 }}>
        {children}
      </div>
    </Reveal>
  );
}

export default function TrailMethodPage() {
  const reduced = useReducedMotion();

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-stone-950">
      <Header />

      {/* Hero */}
      <section className="bg-stone-950 px-6 py-20 sm:py-32 text-center">
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="mx-auto max-w-3xl"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-500 mb-4">The TRAIL Method</p>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl" style={{ letterSpacing: '-0.03em', lineHeight: 1.08 }}>
            Your Path from Financial Stress{' '}
            <span className="text-amber-500">to Financial Freedom</span>
          </h1>
          <p className="mt-5 text-lg text-stone-400 italic">A guide for anyone who&apos;s ever felt lost with money</p>
        </motion.div>
      </section>

      {/* The Problem */}
      <Section className="bg-stone-50 dark:bg-stone-900">
        <Heading>You&apos;re Not Bad With Money. You Just Don&apos;t Have a Path.</Heading>
        <Body>
          <p><strong>72% of people feel stressed about money.</strong> Not some of the time — most of the time. Money is the number one source of stress in Australia, ahead of health, work, and relationships.</p>
          <p>And here&apos;s what makes it worse: the stress itself makes you worse with money. A landmark study from Harvard and Princeton published in <em>Science</em> found that financial worry reduces your cognitive ability by the equivalent of 13 IQ points. That&apos;s like losing a full night&apos;s sleep — every single day.</p>
          <p>So you&apos;re not bad with money. Your brain is just so consumed by financial worry that it can&apos;t think clearly about finances. It&apos;s a cruel cycle: stress makes you avoid your finances, avoidance makes your finances worse, worse finances create more stress.</p>
          <p>The problem isn&apos;t information. The problem is that nobody showed you a clear path.</p>
          <p><strong>Until now.</strong></p>
        </Body>
      </Section>

      {/* What Is TRAIL */}
      <Section>
        <Heading>What Is the TRAIL Method?</Heading>
        <Body>
          <p>TRAIL is a five-step financial journey that takes you from wherever you are right now — confused, overwhelmed, stressed, avoidant — to a place where money works for you instead of against you.</p>
        </Body>
        <Reveal delay={0.2}>
          <div className="mt-8 space-y-3">
            {stages.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.letter} className={`flex items-center gap-4 rounded-xl border ${s.border} ${s.bg} p-4`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.bg} border ${s.border}`}>
                    <Icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                  <div>
                    <span className={`text-xs font-bold uppercase tracking-widest ${s.color}`}>{s.letter} — {s.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
        <Reveal delay={0.3}>
          <p className="mt-8 text-stone-600 dark:text-stone-400" style={{ lineHeight: 1.8 }}>
            It&apos;s not a budget. It&apos;s not a course. It&apos;s not a set of rules you&apos;ll follow for two weeks and then abandon. It&apos;s a trail. A path through the wilderness of money. And like any good trail, it has a beginning, markers along the way, and a destination.
          </p>
        </Reveal>
      </Section>

      {/* Where TRAIL Comes From */}
      <Section className="bg-stone-50 dark:bg-stone-900">
        <Heading>Where TRAIL Comes From</Heading>
        <Body>
          <p>We didn&apos;t invent the TRAIL method from nothing. We studied every major financial methodology in the world and found something remarkable: <strong>they all follow the same journey.</strong></p>
          <p><strong>The Barefoot Investor</strong> — Australia&apos;s most trusted money guide, with over 2 million copies sold — teaches: see your finances, set up a system, attack your debt, build your safety net, then invest and grow.</p>
          <p><strong>Dave Ramsey&apos;s Baby Steps</strong> — used by over 10 million people worldwide — teaches: save a small emergency fund, pay off debt smallest first, build a full emergency fund, then invest.</p>
          <p>Every framework arrives at the same conclusion. The path is always the same. TRAIL simply names it, orders it correctly, and builds it into a living system that guides you every step of the way.</p>
        </Body>
      </Section>

      {/* Step 1: Track */}
      <Section>
        <Heading>Step 1: Track</Heading>
        <Body>
          <p className="text-lg font-semibold text-stone-900 dark:text-stone-100">&ldquo;You can&apos;t change what you can&apos;t see.&rdquo;</p>
          <p>The first step is the hardest — and the most important. It&apos;s simply this: look at your finances. All of them. In one place.</p>
          <p>Most people don&apos;t know exactly how much they owe, exactly where their money goes each month, or what their net worth actually is. This isn&apos;t because they&apos;re irresponsible. It&apos;s because looking at your finances triggers anxiety, and your brain&apos;s natural response to anxiety is avoidance.</p>
          <p>But here&apos;s what the research also shows: <strong>the unknown is always scarier than the known.</strong> When people finally look at their full financial picture, the most common reaction isn&apos;t despair. It&apos;s relief.</p>
          <p><strong>The milestone:</strong> &ldquo;I can see my complete financial picture.&rdquo;</p>
        </Body>
      </Section>

      {/* Step 2: Reduce */}
      <Section className="bg-stone-50 dark:bg-stone-900">
        <Heading>Step 2: Reduce</Heading>
        <Body>
          <p className="text-lg font-semibold text-stone-900 dark:text-stone-100">&ldquo;Fix the leaks before you fill the bucket.&rdquo;</p>
          <p>Now that you can see where your money goes, something will jump out at you. It always does. Maybe it&apos;s the $340/month in subscriptions you forgot you were paying. Maybe it&apos;s the $800/month in takeaway that felt like $200.</p>
          <p>There&apos;s an important reason REDUCE comes before building a safety net: <strong>you can&apos;t save if you&apos;re bleeding money.</strong> Telling someone who spends more than they earn to &ldquo;build an emergency fund&rdquo; is like asking them to fill a bucket with a hole in it. Fix the hole first.</p>
          <p>Research from Northwestern University&apos;s Kellogg School found that people who pay off small debts first are more likely to eliminate ALL their debt — even though paying the highest interest rate first saves more money mathematically. The reason? <strong>Momentum.</strong></p>
          <p><strong>The milestone:</strong> &ldquo;I spend less than I earn. I have a plan for my debt.&rdquo;</p>
        </Body>
      </Section>

      {/* Step 3: Anchor */}
      <Section>
        <Heading>Step 3: Anchor</Heading>
        <Body>
          <p className="text-lg font-semibold text-stone-900 dark:text-stone-100">&ldquo;An anchor keeps you stable when storms hit.&rdquo;</p>
          <p>Life is unpredictable. Cars break down. People get sick. Without a safety net, one unexpected expense can undo months of progress and send you right back into debt.</p>
          <p>The target: <strong>3 months of living expenses</strong> in a separate account you only touch in genuine emergencies. That might sound like a lot. But remember: you&apos;ve already fixed the leaks in Step 2. That surplus — even if it&apos;s $200/month — goes into your safety net.</p>
          <p>And here&apos;s what happens psychologically when you have an emergency fund: <strong>you stop making decisions from fear.</strong> With a safety net, you can think clearly. You can make choices from stability, not survival.</p>
          <p><strong>The milestone:</strong> &ldquo;I have 3 months saved. I can handle a financial shock.&rdquo;</p>
        </Body>
      </Section>

      {/* Step 4: Invest */}
      <Section className="bg-stone-50 dark:bg-stone-900">
        <Heading>Step 4: Invest</Heading>
        <Body>
          <p className="text-lg font-semibold text-stone-900 dark:text-stone-100">&ldquo;Compound interest is the eighth wonder of the world.&rdquo;</p>
          <p>Now something beautiful happens. Your leaks are fixed. Your cashflow is positive. Your safety net is built. For the first time, you&apos;re not in survival mode. You&apos;re ready to grow.</p>
          <p>This is where property, investments, and superannuation come in. The Barefoot Investor recommends getting your super to 15%. Even small additional contributions compound dramatically over decades.</p>
          <p>The key insight: <strong>you don&apos;t need to be rich to start investing.</strong> You need to be stable. Even $50/week into an index fund, starting today, can grow to hundreds of thousands over 20-30 years.</p>
          <p><strong>The milestone:</strong> &ldquo;My net worth is growing. I&apos;m investing regularly.&rdquo;</p>
        </Body>
      </Section>

      {/* Step 5: Live */}
      <Section>
        <Heading>Step 5: Live</Heading>
        <Body>
          <p className="text-lg font-semibold text-stone-900 dark:text-stone-100">&ldquo;Financial freedom isn&apos;t about being rich. It&apos;s about having choices.&rdquo;</p>
          <p>This is the destination. Not a yacht. Not a mansion. Just this: <strong>the freedom to choose how you spend your time and your money.</strong></p>
          <p>Financial freedom is the point where your passive income approaches or exceeds your living expenses. At this stage, work becomes optional. Not that you stop working — many people love what they do. But the <strong>choice</strong> is yours.</p>
          <p><strong>The milestone:</strong> &ldquo;I make financial decisions from abundance, not fear. I live on my terms.&rdquo;</p>
        </Body>
      </Section>

      {/* Why TRAIL Works */}
      <Section className="bg-stone-50 dark:bg-stone-900">
        <Heading>Why TRAIL Works (The Science)</Heading>
        <Body>
          <p>TRAIL isn&apos;t built on opinion. It&apos;s built on decades of behavioural science research.</p>
          <p><strong>Small wins build confidence.</strong> Psychologist Albert Bandura&apos;s research on self-efficacy (1977) showed that successfully completing a task is the strongest way to build belief in your ability. Each TRAIL stage has a clear, achievable milestone.</p>
          <p><strong>Meeting people where they are.</strong> The Stages of Change model (Prochaska, 1983) shows that people at different stages need different interventions. Someone who hasn&apos;t looked at their finances needs awareness, not a budget. TRAIL&apos;s stage-matched guidance means you always get what you need.</p>
          <p><strong>Automation beats willpower.</strong> Richard Thaler&apos;s &ldquo;Save More Tomorrow&rdquo; program (2004) increased savings from 3.5% to 13.6% by making saving automatic. TRAIL&apos;s philosophy is the same: connect your bank, let the system do the work.</p>
          <p><strong>Knowledge alone doesn&apos;t change behaviour.</strong> A meta-analysis of 168 studies found that financial education explains only 0.1% of the variance in actual behaviour. What DOES change behaviour? Self-efficacy, just-in-time guidance, and simplification. TRAIL builds all three into its design.</p>
        </Body>
      </Section>

      {/* The Monitrax Difference */}
      <Section>
        <Heading>The Monitrax Difference</Heading>
        <Body>
          <p>The Barefoot Investor is a brilliant book. TRAIL stands on its shoulders. But a book gives you a plan and then leaves you on your own. Monitrax is different:</p>
          <p><strong>It&apos;s always on.</strong> Monitrax connects to your bank via secure Open Banking and updates automatically. Your accounts, transactions, income, spending, and net worth — all visible, all the time.</p>
          <p><strong>It&apos;s personalised.</strong> Your Guide gives you advice based on YOUR actual numbers. Not &ldquo;save 20%&rdquo; but &ldquo;based on your income and expenses, here&apos;s exactly where to find $400/month you didn&apos;t know you had.&rdquo;</p>
          <p><strong>It knows where you are.</strong> Monitrax knows your TRAIL stage and adapts everything — the recommendations, the focus areas, the milestones — to where you actually are in your journey.</p>
        </Body>
      </Section>

      {/* CTA */}
      <section className="bg-stone-950 px-6 py-20 sm:py-28 text-center">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl" style={{ letterSpacing: '-0.02em' }}>
            Start Your TRAIL Today
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-4 max-w-xl text-lg text-stone-400" style={{ lineHeight: 1.6 }}>
            You don&apos;t need to see the whole path. You just need to take the first step.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="mt-8 flex flex-col items-center gap-4">
            <Link
              href="/trail-check"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-amber-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-600/30"
            >
              Take the free TRAIL Check
            </Link>
            <Link href="/register" className="inline-flex items-center gap-2 text-sm font-medium text-stone-400 hover:text-amber-400 transition-colors">
              Or start your TRAIL now <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.3}>
          <p className="mt-12 text-sm text-stone-600 italic">
            Your trail to financial freedom starts with one step: seeing where you stand.
          </p>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
