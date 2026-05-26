'use client';

/**
 * Phase 46 — /wealth-check public, anonymous, pre-signup hook.
 *
 * Three-input estimator (age + household income + net-worth band) → ASFA
 * comfortable-retirement gap + ABS percentile + ONE named lever.
 *
 * Design spec: `docs/blueprint/PHASE_46_WEALTH_CHECK_HOOK.md`
 *
 * PR 1 scope: form + result + assumptions panel + AFSL footer. No analytics,
 * no email capture, no shareable URL — those land in PR 2 + PR 3.
 *
 * AFSL discipline (load-bearing — see PHASE_46 §9): no product names,
 * no "you should" language, mechanism-only lever framing, source-cited
 * benchmarks footer.
 *
 * NOT yet indexed by SEO — robots meta is `noindex` until lawyer pass +
 * friendlies retention signal land (PHASE_46 §10 gates B + C).
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Header, Footer } from '@/components/marketing';
import { Reveal } from '@/components/marketing/animations';
import { calculateWealthCheckResult } from '@/lib/wealthCheck/calculator';
import { selectLever } from '@/lib/wealthCheck/lever';
import type { NetWorthBand, WealthCheckResult } from '@/lib/wealthCheck/types';
import type { LeverRecommendation } from '@/lib/wealthCheck/types';

const ease: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const NET_WORTH_BANDS: { value: NetWorthBand; label: string; sublabel: string }[] = [
  { value: 'under-50k', label: 'Under $50k', sublabel: 'Just getting started' },
  { value: '50k-200k', label: '$50k – $200k', sublabel: 'Building momentum' },
  { value: '200k-500k', label: '$200k – $500k', sublabel: 'Foundations in place' },
  { value: '500k-1m', label: '$500k – $1m', sublabel: 'Compound stage' },
  { value: '1m-2m', label: '$1m – $2m', sublabel: 'Established' },
  { value: '2m-plus', label: '$2m+', sublabel: 'Wealth-builder' },
];

function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${Math.round(amount).toLocaleString('en-AU')}`;
}

function formatPercentile(p: number): string {
  if (p >= 50) {
    const suffix = p % 10 === 1 && p !== 11 ? 'st' : p % 10 === 2 && p !== 12 ? 'nd' : p % 10 === 3 && p !== 13 ? 'rd' : 'th';
    return `${p}${suffix} percentile — ahead of most Australians in your age band`;
  }
  return `${p}th percentile — many people in your age band are at a similar level`;
}

// ────────────────────────────────────────────────────────────────────
// FORM STATE — input collection step
// ────────────────────────────────────────────────────────────────────

function InputForm({
  onCalculate,
}: {
  onCalculate: (result: WealthCheckResult, lever: LeverRecommendation) => void;
}) {
  const [age, setAge] = useState(38);
  const [income, setIncome] = useState(120_000);
  const [netWorthBand, setNetWorthBand] = useState<NetWorthBand | null>(null);

  const canSubmit = netWorthBand !== null;

  const handleSubmit = () => {
    if (!netWorthBand) return;
    const result = calculateWealthCheckResult({
      age,
      householdIncome: income,
      netWorthBand,
    });
    const lever = selectLever(result);
    onCalculate(result, lever);
  };

  return (
    <Reveal className="mx-auto max-w-2xl">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-cosmos sm:text-5xl">
          Are you on track?
        </h1>
        <p className="mt-4 text-lg text-cosmos-soft">
          Three questions. Thirty seconds. A specific answer in dollars — not a grade.
        </p>
      </div>

      <div className="mt-12 space-y-10 rounded-3xl border border-cosmos-hairline bg-cosmos-surface/50 p-8 shadow-2xl backdrop-blur-sm sm:p-12">
        {/* Age */}
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="age" className="text-sm font-medium text-cosmos-soft">
              Your age
            </label>
            <span className="text-2xl font-semibold text-cosmos-action tabular-nums">{age}</span>
          </div>
          <input
            id="age"
            type="range"
            min={25}
            max={65}
            step={1}
            value={age}
            onChange={(e) => setAge(Number(e.target.value))}
            className="mt-3 w-full accent-cosmos-action"
          />
          <div className="mt-1 flex justify-between text-xs text-cosmos-muted">
            <span>25</span>
            <span>65</span>
          </div>
        </div>

        {/* Income */}
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="income" className="text-sm font-medium text-cosmos-soft">
              Household income (annual, before tax)
            </label>
            <span className="text-2xl font-semibold text-cosmos-action tabular-nums">
              {income >= 400_000 ? '$400k+' : formatCurrency(income)}
            </span>
          </div>
          <input
            id="income"
            type="range"
            min={40_000}
            max={400_000}
            step={10_000}
            value={income}
            onChange={(e) => setIncome(Number(e.target.value))}
            className="mt-3 w-full accent-cosmos-action"
          />
          <div className="mt-1 flex justify-between text-xs text-cosmos-muted">
            <span>$40k</span>
            <span>$400k+</span>
          </div>
        </div>

        {/* Net worth band */}
        <div>
          <label className="text-sm font-medium text-cosmos-soft">
            Total net worth (everything you own, minus what you owe)
          </label>
          <p className="mt-1 text-xs text-cosmos-muted">
            Pick the band that fits. We use the midpoint — no need to be exact.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {NET_WORTH_BANDS.map((band) => {
              const selected = netWorthBand === band.value;
              return (
                <button
                  key={band.value}
                  type="button"
                  onClick={() => setNetWorthBand(band.value)}
                  className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                    selected
                      ? 'border-cosmos-action bg-cosmos-action/10 ring-1 ring-cosmos-action/40'
                      : 'border-cosmos-hairline bg-cosmos-surface/30 hover:border-cosmos-hairline-strong hover:bg-cosmos-surface/50'
                  }`}
                >
                  <div className={`text-sm font-medium ${selected ? 'text-cosmos-action-soft' : 'text-cosmos'}`}>
                    {band.label}
                  </div>
                  <div className="mt-0.5 text-xs text-cosmos-muted">{band.sublabel}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-4 text-base font-semibold transition-all duration-200 sm:w-auto ${
              canSubmit
                ? 'cosmos-cta text-white'
                : 'cursor-not-allowed bg-cosmos-elevated text-cosmos-muted'
            }`}
          >
            Show me my number
            <ArrowRight className="h-4 w-4" />
          </button>
          {!canSubmit && (
            <p className="mt-3 text-xs text-cosmos-muted">
              Pick a net-worth band to continue.
            </p>
          )}
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-cosmos-muted">
        We don&apos;t collect anything you enter here. The calculation runs in your browser.
      </p>
    </Reveal>
  );
}

// ────────────────────────────────────────────────────────────────────
// RESULT — the answer page
// ────────────────────────────────────────────────────────────────────

function ResultPage({
  result,
  lever,
  onReset,
}: {
  result: WealthCheckResult;
  lever: LeverRecommendation;
  onReset: () => void;
}) {
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const gapVerdict = useMemo(() => {
    if (result.gap <= 0) return 'on-track';
    if (lever.softFraming) return 'soft';
    return 'normal';
  }, [result.gap, lever.softFraming]);

  const lifestyleAnnualSpend = Math.round((result.input.householdIncome * 0.7) / 1000) * 1000;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Hero */}
      <Reveal>
        <p className="text-sm font-medium uppercase tracking-wider text-cosmos-action">
          Your snapshot
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-cosmos sm:text-4xl">
          {gapVerdict === 'on-track' ? (
            <>
              You&apos;re tracking toward{' '}
              <span className="text-cosmos-action">{formatCurrency(result.projectedTotalAt67)}</span>{' '}
              at retirement — past every standard benchmark.
            </>
          ) : (
            <>
              You&apos;re tracking toward{' '}
              <span className="text-cosmos-action">{formatCurrency(result.projectedTotalAt67)}</span>{' '}
              at retirement. To maintain {formatCurrency(lifestyleAnnualSpend)}/year of lifestyle
              spending from 67, you&apos;d need around{' '}
              <span className="text-cosmos-action">{formatCurrency(result.lifestyleTarget)}</span>.
            </>
          )}
        </h1>
        {gapVerdict === 'on-track' ? (
          <p className="mt-4 text-xl text-cosmos-soft">
            ASFA comfortable ({formatCurrency(result.asfaTarget)}) is well in the bag. So is
            70%-lifestyle-replacement ({formatCurrency(result.lifestyleTarget)}). The interesting
            question for someone in your position is no longer &quot;will I have enough?&quot; — it&apos;s
            &quot;what could I do with the headroom?&quot;
          </p>
        ) : (
          <p className="mt-4 text-xl text-cosmos-soft">
            That&apos;s a gap of{' '}
            <span className="font-semibold text-cosmos">{formatCurrency(result.gap)}</span>{' '}
            in today&apos;s dollars.
            {result.beatsAsfaTarget && (
              <span className="ml-2 text-cosmos-muted">
                (You&apos;re past ASFA comfortable — {formatCurrency(result.asfaTarget)} — but
                that&apos;s the baseline, not the lifestyle target.)
              </span>
            )}
          </p>
        )}
      </Reveal>

      {/* Percentile */}
      <Reveal delay={0.15}>
        <div className="mt-10 rounded-2xl border border-cosmos-hairline bg-cosmos-surface/50 p-6 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-wider text-cosmos-muted">
            For context
          </p>
          <p className="mt-2 text-lg text-cosmos">
            Your net worth puts you around the{' '}
            <span className="font-semibold text-cosmos">{formatPercentile(result.percentile)}.</span>
          </p>
          <p className="mt-2 text-sm text-cosmos-muted">
            Source: ABS 6523.0 Household Income and Wealth (most recent release).
          </p>
        </div>
      </Reveal>

      {/* Lever */}
      <Reveal delay={0.3}>
        <div className="mt-6 rounded-2xl border border-cosmos-action/30 bg-gradient-to-br from-cosmos-action/10 to-cosmos-action/5 p-6 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-wider text-cosmos-action">
            One lever
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-cosmos">{lever.title}</h2>
          <p className="mt-4 text-base leading-relaxed text-cosmos-soft">{lever.body}</p>
          {lever.gapCloseEstimate > 0 && (
            <div className="mt-6 rounded-xl bg-cosmos/50 px-5 py-4">
              <p className="text-xs uppercase tracking-wider text-cosmos-muted">Estimated gap closed</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-cosmos-action-soft">
                ~{formatCurrency(lever.gapCloseEstimate)}
              </p>
              <p className="mt-1 text-xs text-cosmos-muted">
                over {result.yearsToRetirement} years at a 5% real annual return
              </p>
            </div>
          )}
        </div>
      </Reveal>

      {/* The hook */}
      <Reveal delay={0.45}>
        <div className="mt-10 rounded-2xl border border-cosmos-hairline bg-cosmos-surface/30 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-cosmos">Want the full picture?</h2>
          <p className="mt-3 text-base text-cosmos-soft">
            This is a 3-input estimate. Monitrax shows you the real number — your real accounts, real
            super, real properties, real tax position — and the real levers that move it. The same maths,
            applied to your actual life.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="cosmos-cta inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-base font-semibold"
            >
              Try Monitrax free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center justify-center rounded-2xl border border-cosmos-hairline-strong px-8 py-3 text-base font-medium text-cosmos-soft transition-colors hover:border-cosmos-hairline-strong hover:bg-cosmos-surface/50"
            >
              Try different numbers
            </button>
          </div>
        </div>
      </Reveal>

      {/* Assumptions panel — collapsed by default */}
      <Reveal delay={0.6}>
        <div className="mt-10 rounded-2xl border border-cosmos-hairline/60 bg-cosmos-surface/30">
          <button
            type="button"
            onClick={() => setAssumptionsOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
            aria-expanded={assumptionsOpen}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-cosmos-soft">
              <Info className="h-4 w-4 text-cosmos-muted" />
              How we calculated this
            </span>
            {assumptionsOpen ? (
              <ChevronUp className="h-4 w-4 text-cosmos-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 text-cosmos-muted" />
            )}
          </button>
          <AnimatePresence initial={false}>
            {assumptionsOpen && (
              <motion.div
                initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease }}
                className="overflow-hidden"
              >
                <div className="space-y-3 px-6 pb-6 text-sm text-cosmos-soft">
                  <p>
                    <strong className="text-cosmos-soft">Return assumption:</strong>{' '}
                    {(result.assumptions.realReturnRate * 100).toFixed(1)}% real (after inflation),
                    based on APRA&apos;s long-term balanced super fund returns.
                  </p>
                  <p>
                    <strong className="text-cosmos-soft">Super Guarantee:</strong>{' '}
                    {(result.assumptions.sgRate * 100).toFixed(0)}% (locked from 1 July 2026).
                  </p>
                  <p>
                    <strong className="text-cosmos-soft">Voluntary savings rate:</strong>{' '}
                    {(result.assumptions.estimatedSavingsRate * 100).toFixed(0)}% of household
                    income, based on HILDA/ABS HES patterns for your income band.
                  </p>
                  <p>
                    <strong className="text-cosmos-soft">Household shape:</strong>{' '}
                    Assumed {result.householdShape} based on household income
                    (≥$150k → couple). The ASFA target shown is for a {result.householdShape}.
                  </p>
                  <p>
                    <strong className="text-cosmos-soft">Target:</strong>{' '}
                    {result.assumptions.asfaTargetSource} ({result.assumptions.asfaTargetDate}).
                    The &quot;comfortable&quot; standard assumes you own your home outright at 67 and
                    draw down to life expectancy.
                  </p>
                  <p className="pt-2 text-xs text-cosmos-muted">
                    This is a crude 3-input estimate. The real maths depends on your structure
                    (super fund mix, debt rates, property holdings, tax entities, partner&apos;s
                    super, contribution history). Monitrax does the real calculation when you sign up.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Reveal>

      {/* AFSL boundary footer */}
      <Reveal delay={0.75}>
        <div className="mt-12 border-t border-cosmos-hairline/60 pt-8">
          <p className="text-xs leading-relaxed text-cosmos-muted">
            <strong className="text-cosmos-soft">Information, not advice.</strong> Monitrax is a financial
            information service. We surface the maths and the mechanisms — not personal advice. For
            advice tailored to your circumstances, speak to a licensed financial adviser, mortgage
            broker, or accountant. See our{' '}
            <Link
              href="/legal/afsl-credit-tax-boundary-disclosure"
              className="text-cosmos-soft underline hover:text-cosmos-soft"
            >
              AFSL, Credit and Tax Boundary Disclosure
            </Link>
            .
          </p>
          <p className="mt-3 text-xs text-cosmos-faint">
            Sources: ASFA Retirement Standard (Q2 2026) · ABS 6523.0 Household Income and Wealth ·
            ATO Taxation Statistics · APRA Quarterly Super Performance.
          </p>
        </div>
      </Reveal>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// PAGE — orchestrates form ↔ result transition
// ────────────────────────────────────────────────────────────────────

export default function WealthCheckPage() {
  const [result, setResult] = useState<WealthCheckResult | null>(null);
  const [lever, setLever] = useState<LeverRecommendation | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const handleCalculate = (r: WealthCheckResult, l: LeverRecommendation) => {
    setResult(r);
    setLever(l);
    // Smooth-scroll to top of new view
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  };

  const handleReset = () => {
    setResult(null);
    setLever(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-cosmos text-cosmos">
      <Header />
      <main className="pb-24 pt-16 sm:pt-24">
        <div className="px-6">
          <AnimatePresence mode="wait">
            {result && lever ? (
              <motion.div
                key="result"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4, ease }}
              >
                <ResultPage result={result} lever={lever} onReset={handleReset} />
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease }}
              >
                <InputForm onCalculate={handleCalculate} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
}
