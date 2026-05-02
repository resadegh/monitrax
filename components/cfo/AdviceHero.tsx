'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Compass, RefreshCw } from 'lucide-react';

import type { AIAdviceDocument } from '@/lib/cfo';
import type { TrailStage } from '@/lib/cfo';
import { Button } from '@/components/ui/button';

/**
 * AdviceHero — the calm, conversational opener of the My Guide surface.
 *
 * Design intent (per Reza's 2026-05-02 brief): redesigned away from the
 * first-cut "big, dark, warning-like" headline. The previous version read
 * like a medical diagnosis — heavy text-3xl semibold, rose/pink REDUCE
 * atmosphere that flashed alarm. This version applies the mindset of a
 * world-class financial adviser, designer, and human-behaviour
 * psychologist:
 *
 *   • Typography is calm: text-base/text-lg, font-medium, leading-relaxed.
 *     The recommendations below carry the substance — the hero just sets
 *     the scene.
 *   • Voice is conversational: a small "Your Guide" signature, an
 *     understated stage chip, and a one- or two-sentence framing
 *     assessment that NEVER leads with the negative.
 *   • Atmosphere is encouraging across all five TRAIL stages — peach for
 *     REDUCE (warm sunrise, not warning rose), teal for ANCHOR, sky for
 *     INVEST, etc. None of the palettes feel like an alert.
 *   • Refresh button is a ghost pill in the corner — present but not
 *     shouting; user controls when advice changes (stability rule).
 *
 * Visual vocabulary still matches Phase 39 Wealth + Phase 37 Budget
 * (glassmorphic 28px, framer-motion appleEase, full prefers-reduced-motion).
 */

const appleEase: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const STAGE_ATMOSPHERE: Record<
  TrailStage,
  { gradient: string; glow: string; chipDot: string; chipText: string; signatureBg: string }
> = {
  T: {
    gradient:
      'radial-gradient(800px 360px at 18% -10%, rgba(165,180,252,0.18), transparent 65%), radial-gradient(700px 320px at 92% 110%, rgba(186,230,253,0.14), transparent 60%)',
    glow: 'rgba(165,180,252,0.22)',
    chipDot: 'bg-indigo-400',
    chipText: 'text-indigo-700/80 dark:text-indigo-300/80',
    signatureBg: 'bg-indigo-500/8',
  },
  R: {
    // Soft peach / sand — warm sunrise, NOT warning rose. The previous
    // rose-500 palette read as alarming for users in REDUCE.
    gradient:
      'radial-gradient(800px 360px at 18% -10%, rgba(254,215,170,0.22), transparent 65%), radial-gradient(700px 320px at 92% 110%, rgba(253,230,138,0.14), transparent 60%)',
    glow: 'rgba(253,186,116,0.22)',
    chipDot: 'bg-amber-500',
    chipText: 'text-amber-800/80 dark:text-amber-200/80',
    signatureBg: 'bg-amber-500/10',
  },
  A: {
    gradient:
      'radial-gradient(800px 360px at 18% -10%, rgba(153,246,228,0.18), transparent 65%), radial-gradient(700px 320px at 92% 110%, rgba(186,230,253,0.12), transparent 60%)',
    glow: 'rgba(94,234,212,0.22)',
    chipDot: 'bg-teal-500',
    chipText: 'text-teal-800/80 dark:text-teal-300/80',
    signatureBg: 'bg-teal-500/10',
  },
  I: {
    gradient:
      'radial-gradient(800px 360px at 18% -10%, rgba(186,230,253,0.20), transparent 65%), radial-gradient(700px 320px at 92% 110%, rgba(199,210,254,0.14), transparent 60%)',
    glow: 'rgba(125,211,252,0.22)',
    chipDot: 'bg-sky-500',
    chipText: 'text-sky-800/80 dark:text-sky-300/80',
    signatureBg: 'bg-sky-500/10',
  },
  L: {
    gradient:
      'radial-gradient(800px 360px at 18% -10%, rgba(253,230,138,0.22), transparent 65%), radial-gradient(700px 320px at 92% 110%, rgba(254,215,170,0.14), transparent 60%)',
    glow: 'rgba(252,211,77,0.24)',
    chipDot: 'bg-amber-400',
    chipText: 'text-amber-800/80 dark:text-amber-200/80',
    signatureBg: 'bg-amber-400/10',
  },
};

interface AdviceHeroProps {
  advice: AIAdviceDocument;
  isRefreshing: boolean;
  onRefresh: () => void;
  /** First name (or full name) of the user — drives the greeting. Optional. */
  userName?: string | null;
}

export function AdviceHero({ advice, isRefreshing, onRefresh, userName }: AdviceHeroProps) {
  const reduced = useReducedMotion() ?? false;
  const stage = STAGE_ATMOSPHERE[advice.trailStage];
  const greeting = `${timeOfDayGreeting()}${userName ? `, ${firstName(userName)}` : ''}`;

  return (
    <motion.div
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.6, ease: appleEase }}
      className="relative isolate overflow-hidden rounded-[28px] border border-foreground/10 bg-card/80 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.03),0_8px_24px_rgba(15,23,42,0.04)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: stage.gradient }}
      />
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/3 -z-10 h-[260px] w-[420px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: stage.glow }}
          animate={{ opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="relative px-6 py-7 sm:px-8 sm:py-8">
        {/* Top row: signature + stage chip + refresh */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Persona signature — small, warm, no caps */}
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${stage.signatureBg}`}
            >
              <Compass className="h-3.5 w-3.5 text-foreground/70" />
            </span>
            <div className="leading-tight">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                Your Guide
              </p>
              <p className="text-[13px] font-medium text-foreground/85">{greeting}</p>
            </div>
          </div>

          {/* Stage chip — understated, no border, no caps */}
          <span className={`inline-flex items-center gap-1.5 text-[11px] ${stage.chipText}`}>
            <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${stage.chipDot}`} />
            <span className="font-medium">
              {advice.trailStageName.toLowerCase()} stage
            </span>
          </span>

          {/* Refresh — ghost pill, tucked right, not shouting */}
          <div className="ml-auto flex items-center gap-3">
            {advice.isStale && (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Your numbers have shifted —
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-8 gap-1.5 rounded-full px-3 text-[12px] font-medium text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <RefreshCw
                className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden
              />
              {isRefreshing ? 'Refreshing' : advice.isStale ? 'Refresh' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* The framing assessment — calm, conversational, NEVER a verdict */}
        <p className="mt-6 max-w-3xl text-[17px] font-normal leading-[1.55] tracking-[-0.005em] text-foreground/90 sm:text-[18px]">
          {advice.situationAssessment}
        </p>

        {/* Headline advice — soft pills, not bold bullets */}
        {advice.headlineAdvice.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {advice.headlineAdvice.slice(0, 4).map((h, i) => (
              <motion.li
                key={i}
                initial={reduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { duration: 0.45, ease: appleEase, delay: 0.18 + i * 0.05 }
                }
                className="group inline-flex items-baseline gap-1.5 rounded-full bg-foreground/[0.05] px-3 py-1.5 text-[12.5px]"
                title={h.detail}
              >
                <span className="font-medium text-foreground/85">{h.title}</span>
                <span className="hidden text-muted-foreground sm:inline">— {h.detail}</span>
              </motion.li>
            ))}
          </ul>
        )}

        {/* Footer meta — tiny, low-emphasis */}
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground/70">
          <span>Updated {formatTimestamp(advice.generatedAt)}</span>
          {advice.isFallback && (
            <>
              <span aria-hidden>·</span>
              <span className="text-amber-700/80 dark:text-amber-300/80">
                Lighter-touch view — a fuller take is on the way
              </span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Hi there';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Hi there';
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? '';
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
