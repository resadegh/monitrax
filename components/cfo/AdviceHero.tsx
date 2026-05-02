'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Brain, RefreshCw, Sparkles } from 'lucide-react';

import type { AIAdviceDocument } from '@/lib/cfo';
import type { TrailStage } from '@/lib/cfo';
import { Button } from '@/components/ui/button';

/**
 * AdviceHero — the headline surface of the redesigned `/dashboard/cfo`.
 *
 * Visual vocabulary mirrors `components/properties/PropertiesHero.tsx`
 * (Phase 39 Wealth) and `CashflowHero` (Phase 37 Budget): glassmorphic
 * 28px card, atmospheric mesh gradient, soft-breathing glow, framer-motion
 * `appleEase` entry, full prefers-reduced-motion. Stage atmosphere shifts
 * with the user's TRAIL stage so the surface "knows where you are".
 */

const appleEase: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const STAGE_ATMOSPHERE: Record<TrailStage, { gradient: string; glow: string; chip: string }> = {
  T: {
    gradient:
      'radial-gradient(900px 420px at 12% -10%, rgba(99,102,241,0.18), transparent 65%), radial-gradient(800px 380px at 92% 110%, rgba(56,189,248,0.10), transparent 60%)',
    glow: 'rgba(99,102,241,0.35)',
    chip: 'border-indigo-400/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  },
  R: {
    gradient:
      'radial-gradient(900px 420px at 12% -10%, rgba(244,114,182,0.16), transparent 65%), radial-gradient(800px 380px at 92% 110%, rgba(251,113,133,0.10), transparent 60%)',
    glow: 'rgba(244,114,182,0.32)',
    chip: 'border-rose-400/25 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  A: {
    gradient:
      'radial-gradient(900px 420px at 12% -10%, rgba(45,212,191,0.18), transparent 65%), radial-gradient(800px 380px at 92% 110%, rgba(56,189,248,0.10), transparent 60%)',
    glow: 'rgba(45,212,191,0.32)',
    chip: 'border-teal-400/25 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  },
  I: {
    gradient:
      'radial-gradient(900px 420px at 12% -10%, rgba(14,165,233,0.18), transparent 65%), radial-gradient(800px 380px at 92% 110%, rgba(79,70,229,0.10), transparent 60%)',
    glow: 'rgba(14,165,233,0.40)',
    chip: 'border-sky-400/25 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  L: {
    gradient:
      'radial-gradient(900px 420px at 12% -10%, rgba(251,191,36,0.18), transparent 65%), radial-gradient(800px 380px at 92% 110%, rgba(244,114,182,0.10), transparent 60%)',
    glow: 'rgba(251,191,36,0.36)',
    chip: 'border-amber-400/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
};

interface AdviceHeroProps {
  advice: AIAdviceDocument;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function AdviceHero({ advice, isRefreshing, onRefresh }: AdviceHeroProps) {
  const reduced = useReducedMotion() ?? false;
  const stage = STAGE_ATMOSPHERE[advice.trailStage];

  return (
    <motion.div
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.6, ease: appleEase }}
      className="relative isolate overflow-hidden rounded-[28px] border border-foreground/10 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: stage.gradient }}
      />
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[280px] w-[480px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: stage.glow }}
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="relative px-6 pt-6 pb-7 sm:px-8 sm:pt-8 sm:pb-9">
        {/* Eyebrow row */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/[0.06]">
            <Brain className="h-4 w-4 text-foreground/70" />
          </span>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Your Personal CFO
          </h3>
          <span
            className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${stage.chip}`}
          >
            <Sparkles className="h-3 w-3" />
            Stage {advice.trailStage} — {advice.trailStageName}
          </span>
        </div>

        {/* Headline narrative */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Today&apos;s briefing
            </p>
            <p className="mt-2 text-2xl font-semibold leading-snug tracking-[-0.01em] text-foreground sm:text-3xl">
              {advice.situationAssessment}
            </p>

            {advice.headlineAdvice.length > 0 && (
              <ul className="mt-5 space-y-3">
                {advice.headlineAdvice.map((h, i) => (
                  <motion.li
                    key={i}
                    initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      reduced ? { duration: 0 } : { duration: 0.5, ease: appleEase, delay: 0.2 + i * 0.06 }
                    }
                    className="flex items-start gap-3 text-sm"
                  >
                    <span aria-hidden className="mt-1.5 inline-flex h-1.5 w-1.5 flex-none rounded-full bg-foreground/60" />
                    <div>
                      <span className="font-semibold text-foreground">{h.title}</span>
                      <span className="text-muted-foreground"> — {h.detail}</span>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="rounded-full border-foreground/15 bg-background/60 backdrop-blur"
            >
              <RefreshCw
                className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden
              />
              {isRefreshing ? 'Refreshing…' : 'Refresh advice'}
            </Button>
            {advice.isStale && (
              <span className="text-[11px] text-muted-foreground">
                Your finances have shifted — refresh for an updated take.
              </span>
            )}
            {advice.isFallback && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                AI advisor unavailable — showing rule-engine fallback.
              </span>
            )}
            <span className="text-[10px] text-muted-foreground/70">
              Generated {new Date(advice.generatedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
