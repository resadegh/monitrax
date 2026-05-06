'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import { appleEase, springSnap as springy } from '@/components/shell/motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

/**
 * TrailStageIndicator — Home banner v3 (premium redesign).
 *
 * Design vocabulary:
 *   - appleEase + spring physics consistent with components/marketing/TrailHero.tsx
 *   - Glassmorphic card on a stage-coloured mesh-gradient atmosphere
 *   - Hero-scale interactive letters (h-16/h-20) with springy hover
 *   - AnimatePresence cross-fades for content swaps (no snap)
 *   - Bespoke per-stage SVG glyphs with stage-specific micro-motion
 *   - Animated connecting thread that fills to the user's actual TRAIL stage
 *   - prefers-reduced-motion fully honoured
 *
 * Stage copy is sourced verbatim from docs/blueprint/TRAIL_FRAMEWORK.md §2.
 *
 * Interaction model (preserved from v2 / PR #566):
 *   - Hover or keyboard focus → preview that stage in the spotlight
 *   - First click → select (sticky)
 *   - Second click on the same letter → navigate
 *   - Inline "Open <Stage>" button always available as an explicit affordance
 */


interface TrailData {
  emergencyFund?: { monthsCovered: number };
  cashflow?: { monthlySurplus: number };
  hasAccounts: boolean;
  hasInvestments: boolean;
  healthScore: number;
}

interface Stage {
  letter: 'T' | 'R' | 'A' | 'I' | 'L';
  name: string;
  headline: string;
  description: string;
  question: string;
  emotion: string;
  // Tailwind tokens — kept literal so JIT sees them at build time.
  ringClass: string;
  // Tailwind doesn't class-string-interpolate, so atmosphere/gradient
  // colour tokens are full literal class names per stage.
  textGradient: string; // hero letter gradient
  glowFrom: string; // radial halo behind the letter (tailwind ring tone)
  glowVia: string;
  meshA: string; // background mesh — three radial gradient stops as full RGB
  meshB: string;
  meshC: string;
  href: string;
}

const stages: Stage[] = [
  {
    letter: 'T',
    name: 'Track',
    headline: 'Track your full picture',
    description:
      'Face your full financial reality — no judgment, just clarity. See every account, every debt, every dollar in and out. End the avoidance.',
    question: 'What do I actually have, owe, earn, and spend?',
    emotion: 'From avoidance → awareness',
    ringClass: 'ring-amber-400/60',
    textGradient: 'from-amber-300 via-amber-500 to-orange-600',
    glowFrom: 'rgba(251,191,36,0.55)',
    glowVia: 'rgba(245,158,11,0.18)',
    meshA: 'rgba(251,191,36,0.18)',
    meshB: 'rgba(217,119,6,0.10)',
    meshC: 'rgba(120,53,15,0.10)',
    href: '/dashboard/balances',
  },
  {
    letter: 'R',
    name: 'Reduce',
    headline: 'Reduce the waste, fix the leaks',
    description:
      'Cut wasteful spending, get cashflow positive, set a budget, and start paying down debt. Stop the leaks before you fill the bucket.',
    question: 'Am I spending less than I earn? Where can I cut waste?',
    emotion: 'From overwhelm → empowerment',
    ringClass: 'ring-orange-400/60',
    textGradient: 'from-orange-300 via-orange-500 to-rose-600',
    glowFrom: 'rgba(249,115,22,0.55)',
    glowVia: 'rgba(234,88,12,0.18)',
    meshA: 'rgba(249,115,22,0.18)',
    meshB: 'rgba(225,29,72,0.10)',
    meshC: 'rgba(124,45,18,0.10)',
    href: '/dashboard/budget-analysis',
  },
  {
    letter: 'A',
    name: 'Anchor',
    headline: 'Anchor your safety net',
    description:
      'Build an emergency fund that covers three months of expenses. Anchor yourself so one unexpected bill doesn’t send you backward.',
    question: 'Can I handle a financial shock without going into debt?',
    emotion: 'From fragile → stable',
    ringClass: 'ring-emerald-400/60',
    textGradient: 'from-emerald-300 via-emerald-500 to-teal-600',
    glowFrom: 'rgba(16,185,129,0.55)',
    glowVia: 'rgba(5,150,105,0.18)',
    meshA: 'rgba(16,185,129,0.18)',
    meshB: 'rgba(13,148,136,0.10)',
    meshC: 'rgba(6,78,59,0.10)',
    href: '/dashboard/safety-net',
  },
  {
    letter: 'I',
    name: 'Invest',
    headline: 'Invest in your future',
    description:
      'Now that you’re stable, start accumulating. Buy property, invest in shares and super, build assets, and grow your net worth deliberately.',
    question: 'Is my net worth growing? Am I building something that lasts?',
    emotion: 'From surviving → building',
    ringClass: 'ring-sky-400/60',
    textGradient: 'from-sky-300 via-sky-500 to-indigo-600',
    glowFrom: 'rgba(14,165,233,0.55)',
    glowVia: 'rgba(2,132,199,0.18)',
    meshA: 'rgba(14,165,233,0.18)',
    meshB: 'rgba(79,70,229,0.10)',
    meshC: 'rgba(15,23,42,0.10)',
    href: '/dashboard/properties',
  },
  {
    letter: 'L',
    name: 'Live',
    headline: 'Live on your terms',
    description:
      'Your wealth works for you. Passive income approaches or exceeds expenses. You make decisions from abundance, not scarcity.',
    question: 'Can I live the life I want without financial worry?',
    emotion: 'From building → freedom',
    ringClass: 'ring-yellow-300/60',
    textGradient: 'from-yellow-200 via-amber-400 to-orange-500',
    glowFrom: 'rgba(250,204,21,0.55)',
    glowVia: 'rgba(245,158,11,0.18)',
    meshA: 'rgba(250,204,21,0.20)',
    meshB: 'rgba(251,191,36,0.12)',
    meshC: 'rgba(245,158,11,0.10)',
    href: '/dashboard/cfo',
  },
];

function determineStage(data: TrailData | null): number {
  if (!data) return 0;
  if (!data.hasAccounts) return 0;
  if (data.cashflow && data.cashflow.monthlySurplus <= 0) return 1;
  if (!data.emergencyFund || data.emergencyFund.monthsCovered < 3) return 2;
  if (!data.hasInvestments) return 3;
  if (data.healthScore < 75) return 3;
  return 4;
}

// --- Per-stage SVG glyphs ---------------------------------------------------
// Inline SVGs keep this a single-file component (no asset bloat).
// Each glyph has stage-specific micro-motion that respects reduced-motion.

function StageGlyph({ stage, reduced }: { stage: Stage; reduced: boolean }) {
  const baseProps = {
    width: 96,
    height: 96,
    viewBox: '0 0 96 96',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  } as const;

  const stroke = `url(#grad-${stage.letter})`;
  const breathe = reduced
    ? {}
    : {
        animate: { scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] },
        transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' as const },
      };

  // Shared gradient defs.
  const Defs = (
    <defs>
      <linearGradient id={`grad-${stage.letter}`} x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={stage.glowFrom} />
        <stop offset="100%" stopColor={stage.glowVia} />
      </linearGradient>
    </defs>
  );

  switch (stage.letter) {
    case 'T':
      // Eye / aperture — concentric awareness rings with a slow pulse.
      return (
        <motion.svg {...baseProps} {...breathe}>
          {Defs}
          <circle cx="48" cy="48" r="36" stroke={stroke} strokeWidth="1.5" opacity="0.35" />
          <circle cx="48" cy="48" r="24" stroke={stroke} strokeWidth="1.75" opacity="0.6" />
          <circle cx="48" cy="48" r="12" stroke={stroke} strokeWidth="2" />
          <circle cx="48" cy="48" r="3.5" fill={stroke} />
        </motion.svg>
      );
    case 'R':
      // Reduce — diminishing concentric arcs (less waste, tighter scope).
      return (
        <motion.svg
          {...baseProps}
          animate={reduced ? undefined : { rotate: [0, -6, 0, 6, 0] }}
          transition={reduced ? undefined : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        >
          {Defs}
          <path d="M48 12 A 36 36 0 0 1 84 48" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
          <path d="M48 24 A 24 24 0 0 1 72 48" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" opacity="0.6" />
          <path d="M48 36 A 12 12 0 0 1 60 48" stroke={stroke} strokeWidth="2.25" strokeLinecap="round" />
          <line x1="20" y1="76" x2="76" y2="20" stroke={stroke} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </motion.svg>
      );
    case 'A':
      // Anchor — anchor silhouette with a slow underwater sway.
      return (
        <motion.svg
          {...baseProps}
          animate={reduced ? undefined : { y: [0, 2, 0, -2, 0] }}
          transition={reduced ? undefined : { duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {Defs}
          <circle cx="48" cy="22" r="6" stroke={stroke} strokeWidth="2.25" />
          <line x1="48" y1="28" x2="48" y2="74" stroke={stroke} strokeWidth="2.25" strokeLinecap="round" />
          <path d="M28 56 Q 48 84 68 56" stroke={stroke} strokeWidth="2.25" fill="none" strokeLinecap="round" />
          <line x1="34" y1="40" x2="62" y2="40" stroke={stroke} strokeWidth="2.25" strokeLinecap="round" />
          {/* Wave below */}
          <path d="M14 80 Q 28 74 42 80 T 70 80 T 90 80" stroke={stroke} strokeWidth="1.25" fill="none" opacity="0.5" />
        </motion.svg>
      );
    case 'I':
      // Invest — sparkline that re-draws itself on a slow loop.
      return (
        <svg {...baseProps}>
          {Defs}
          <motion.path
            d="M12 70 L 28 56 L 42 64 L 56 36 L 72 44 L 84 22"
            stroke={stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            initial={{ pathLength: reduced ? 1 : 0, opacity: reduced ? 1 : 0.2 }}
            animate={reduced ? undefined : { pathLength: [0, 1], opacity: [0.2, 1] }}
            transition={reduced ? undefined : { duration: 3.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }}
          />
          <circle cx="84" cy="22" r="3.5" fill={stroke} />
          {/* Baseline gridline */}
          <line x1="12" y1="78" x2="84" y2="78" stroke={stroke} strokeWidth="1" opacity="0.25" />
        </svg>
      );
    case 'L':
      // Live — sunrise: arcs rising over a horizon, with a soft glow.
      return (
        <motion.svg {...baseProps} {...breathe}>
          {Defs}
          <line x1="12" y1="68" x2="84" y2="68" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <circle cx="48" cy="68" r="16" stroke={stroke} strokeWidth="2.25" fill="none" />
          {/* Rays */}
          {[-60, -30, 0, 30, 60].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = 48 + Math.sin(rad) * 24;
            const y1 = 68 - Math.cos(rad) * 24;
            const x2 = 48 + Math.sin(rad) * 32;
            const y2 = 68 - Math.cos(rad) * 32;
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="2" strokeLinecap="round" opacity={0.55} />
            );
          })}
        </motion.svg>
      );
  }
}

// --- Component --------------------------------------------------------------

export function TrailStageIndicator() {
  const { token } = useAuth();
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;

  const [trailData, setTrailData] = useState<TrailData | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/master-snapshot', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json) => {
        if (json.success || json.data || json.netWorth !== undefined) {
          const d = json.data || json;
          setTrailData({
            hasAccounts: (d.accounts?.length || 0) > 0 || (d.netWorth?.totalAssets || 0) > 0,
            hasInvestments: (d.investments?.totalValue || 0) > 0 || (d.properties?.length || 0) > 0,
            emergencyFund: d.emergencyFund,
            cashflow: d.cashflow
              ? { monthlySurplus: d.cashflow.netMonthlyCashflow || d.cashflow.monthlySurplus || 0 }
              : undefined,
            healthScore: d.healthScore?.score || d.health?.score || 0,
          });
        }
      })
      .catch(() => {});
  }, [token]);

  const userStage = useMemo(() => determineStage(trailData), [trailData]);
  const spotlightIndex = hovered ?? selected ?? userStage;
  const spotlight = stages[spotlightIndex];

  function handleStageClick(index: number) {
    if (selected === index) {
      router.push(stages[index].href);
      return;
    }
    setSelected(index);
  }

  function handleCtaClick() {
    router.push(spotlight.href);
  }

  // Progress percentage for the connecting thread (0-100).
  const progressPct = (userStage / (stages.length - 1)) * 100;

  // Variants for content swap.
  const contentVariants: Variants = {
    enter: reduced
      ? { opacity: 1 }
      : { opacity: 0, y: 12, filter: 'blur(6px)' },
    center: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.45, ease: appleEase },
    },
    exit: reduced
      ? { opacity: 1 }
      : { opacity: 0, y: -8, filter: 'blur(6px)', transition: { duration: 0.25, ease: appleEase } },
  };

  return (
    <div className="relative isolate overflow-hidden rounded-[28px] border border-white/40 dark:border-white/10 bg-card/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      {/* === Layer 1: Atmospheric stage-coloured mesh gradient === */}
      <motion.div
        aria-hidden
        className="absolute inset-0 -z-10"
        animate={{
          background: `radial-gradient(900px 420px at 12% -10%, ${spotlight.meshA}, transparent 65%), radial-gradient(800px 380px at 92% 110%, ${spotlight.meshB}, transparent 60%), radial-gradient(700px 320px at 50% 50%, ${spotlight.meshC}, transparent 65%)`,
        }}
        transition={{ duration: reduced ? 0 : 1.4, ease: appleEase }}
      />
      {/* Slow-breathing soft glow behind the active letter (subtle). */}
      {!reduced && (
        <motion.div
          aria-hidden
          className="absolute -top-24 left-1/2 -translate-x-1/2 -z-10 h-[320px] w-[520px] rounded-full blur-3xl"
          animate={{
            background: spotlight.glowFrom,
            opacity: [0.35, 0.55, 0.35],
          }}
          transition={{
            background: { duration: 1.4, ease: appleEase },
            opacity: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
          }}
        />
      )}

      {/* Inner content */}
      <div className="relative px-6 pt-6 pb-7 sm:px-8 sm:pt-7 sm:pb-8">
        {/* === Header === */}
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-foreground/60" aria-hidden />
          <h3 className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Your TRAIL
          </h3>
        </div>

        {/* === Stage tabs === */}
        <div
          role="tablist"
          aria-label="TRAIL stages"
          className="relative mb-7 flex items-center"
        >
          {/* Background track */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[8%] right-[8%] top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-foreground/[0.07]"
          />
          {/* Animated progress thread (fills to user's actual stage) */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-[8%] top-1/2 h-[3px] -translate-y-1/2 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${stages[0].glowFrom}, ${stages[Math.max(0, userStage)].glowFrom})`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `calc(${progressPct}% * 0.84)` }}
            transition={reduced ? { duration: 0 } : { duration: 1.1, ease: appleEase, delay: 0.2 }}
          />

          {stages.map((stage, i) => {
            const isCompleted = i < userStage;
            const isCurrent = i === userStage;
            const isSpotlit = i === spotlightIndex;
            const isSelected = selected === i;

            return (
              <div key={stage.letter} className="relative flex flex-1 min-w-0 items-center justify-center px-1">
                <motion.button
                  type="button"
                  role="tab"
                  aria-selected={isSpotlit}
                  aria-label={`Stage ${stage.letter} — ${stage.name}`}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                  onClick={() => handleStageClick(i)}
                  whileHover={reduced ? undefined : { scale: 1.08 }}
                  whileTap={reduced ? undefined : { scale: 0.96 }}
                  transition={springy}
                  className="group relative flex h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-background/60 backdrop-blur-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:ring-foreground/40"
                >
                  {/* Glow halo */}
                  <AnimatePresence>
                    {isSpotlit && !reduced && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 -z-10 rounded-2xl blur-xl"
                        style={{ background: stage.glowFrom }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 0.9, scale: 1.25 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.35, ease: appleEase }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Border ring on the spotlit / current letter */}
                  <span
                    aria-hidden
                    className={`absolute inset-0 rounded-2xl border transition-all duration-300 ${
                      isSpotlit
                        ? `border-transparent ring-2 ring-offset-2 ring-offset-card ${stage.ringClass}`
                        : isCurrent
                        ? 'border-foreground/15 ring-1 ring-foreground/10'
                        : 'border-foreground/10'
                    }`}
                  />

                  {/* Letter (or check) */}
                  {isCompleted && !isSpotlit ? (
                    <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-foreground/60" />
                  ) : (
                    <span
                      className={`select-none bg-gradient-to-br bg-clip-text text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-transparent ${stage.textGradient}`}
                    >
                      {stage.letter}
                    </span>
                  )}

                  {/* Selection dot */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.span
                        aria-hidden
                        className="absolute -bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-foreground"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        transition={springy}
                      />
                    )}
                  </AnimatePresence>

                  {/* "You are here" tiny label below the user's actual stage */}
                  {isCurrent && (
                    <motion.span
                      aria-hidden
                      className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-background shadow"
                      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: appleEase, delay: 0.6 }}
                    >
                      You
                    </motion.span>
                  )}
                </motion.button>
              </div>
            );
          })}
        </div>

        {/* === Spotlight panel === */}
        <div className="relative grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-5 sm:gap-7 items-center">
          {/* Glyph column (animated, stage-specific SVG) */}
          <div className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 mx-auto sm:mx-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={spotlight.letter}
                className="absolute inset-0 flex items-center justify-center"
                initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.85, rotate: -8 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85, rotate: 8, transition: { duration: 0.2 } }}
                transition={{ duration: 0.55, ease: appleEase }}
              >
                <div
                  className="absolute inset-0 rounded-[22px] border border-white/40 dark:border-white/10 bg-background/40 backdrop-blur-md"
                  aria-hidden
                />
                <StageGlyph stage={spotlight} reduced={reduced} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Text column (cross-fades on stage swap) */}
          <div className="relative min-h-[148px] sm:min-h-[156px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={spotlight.letter}
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
                  <span
                    className={`bg-gradient-to-r bg-clip-text text-transparent ${spotlight.textGradient}`}
                  >
                    Stage {spotlight.letter} — {spotlight.name}
                  </span>
                  {spotlightIndex === userStage && (
                    <span className="rounded-full border border-foreground/15 bg-background/60 px-2 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-foreground/70">
                      You are here
                    </span>
                  )}
                </div>

                <h4 className="text-[1.35rem] sm:text-[1.55rem] font-semibold leading-tight tracking-[-0.01em] text-foreground">
                  {spotlight.headline}
                </h4>

                <p className="max-w-[58ch] text-[0.95rem] leading-relaxed text-muted-foreground">
                  {spotlight.description}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground/85">
                  <span className="italic">“{spotlight.question}”</span>
                  <span aria-hidden className="hidden sm:inline text-foreground/20">·</span>
                  <span className="font-medium text-foreground/65">{spotlight.emotion}</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* === Footer hint + primary CTA === */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-foreground/[0.06] pt-4">
          <span className="text-[11px] text-muted-foreground/80">
            {selected === spotlightIndex
              ? 'Click again to open this stage →'
              : 'Hover to preview · click to focus · click again to open'}
          </span>
          <motion.button
            type="button"
            onClick={handleCtaClick}
            whileHover={reduced ? undefined : { y: -1 }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            transition={springy}
            className={`relative inline-flex items-center justify-center gap-2 self-end sm:self-auto rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/10 overflow-hidden`}
            style={{
              background: `linear-gradient(135deg, ${spotlight.glowFrom}, ${spotlight.glowVia})`,
            }}
          >
            <span className="relative z-10">Open {spotlight.name}</span>
            <ArrowRight className="relative z-10 h-4 w-4" />
            {!reduced && (
              <motion.span
                aria-hidden
                className="absolute inset-0 -z-0"
                initial={{ x: '-110%' }}
                whileHover={{ x: '110%' }}
                transition={{ duration: 0.9, ease: appleEase }}
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                }}
              />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
