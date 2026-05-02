'use client';

import { useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  PlayCircle,
  MessageSquare,
  Clock,
  AlertTriangle,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';

import type { AIAdviceRecommendation, AIAdviceEvidence, ScenarioResult } from '@/lib/cfo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatPercentageValue } from '@/lib/utils/formatters';

const appleEase: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const PRIORITY_LABEL: Record<AIAdviceRecommendation['priority'], string> = {
  do_now: 'Do now',
  upcoming: 'Upcoming',
  consider: 'Consider',
  background: 'Background',
};

const PRIORITY_TONE: Record<AIAdviceRecommendation['priority'], string> = {
  do_now: 'border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  upcoming: 'border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  consider: 'border-sky-400/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  background: 'border-foreground/15 bg-foreground/5 text-muted-foreground',
};

const CATEGORY_ICON: Partial<Record<AIAdviceRecommendation['category'], typeof Clock>> = {
  cashflow: TrendingUp,
  debt: AlertTriangle,
  spending: AlertTriangle,
  savings: TrendingUp,
  property: TrendingUp,
  investment: TrendingUp,
  tax: TrendingUp,
  risk: AlertTriangle,
};

interface AdviceRecommendationCardProps {
  recommendation: AIAdviceRecommendation;
  index: number;
  onRunScenario: (rec: AIAdviceRecommendation) => void;
  onAskFollowUp: (rec: AIAdviceRecommendation) => void;
  scenarioState: { loading: boolean; result?: ScenarioResult; error?: string };
}

export function AdviceRecommendationCard({
  recommendation: rec,
  index,
  onRunScenario,
  onAskFollowUp,
  scenarioState,
}: AdviceRecommendationCardProps) {
  const reduced = useReducedMotion() ?? false;
  const [expanded, setExpanded] = useState(false);
  const Icon = CATEGORY_ICON[rec.category] ?? Clock;

  return (
    <motion.div
      layout
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced ? { duration: 0 } : { duration: 0.5, ease: appleEase, delay: 0.04 * index }
      }
      className="group relative overflow-hidden rounded-[22px] border border-foreground/10 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_18px_48px_rgba(15,23,42,0.10)]"
    >
      <div className="relative px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-foreground/[0.06]"
          >
            <Icon className="h-4 w-4 text-foreground/70" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={`rounded-full border px-2.5 py-0 text-[10px] font-bold uppercase tracking-wider ${PRIORITY_TONE[rec.priority]}`}
              >
                {PRIORITY_LABEL[rec.priority]}
              </Badge>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {rec.category}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Stage {rec.trailStage}
              </span>
            </div>

            <h4 className="mt-2 text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg">
              {rec.title}
            </h4>

            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {rec.reasoning}
            </p>

            {rec.evidence.length > 0 && (
              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {rec.evidence.slice(0, 6).map((e, i) => (
                  <EvidenceCell key={i} evidence={e} />
                ))}
              </dl>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {rec.suggestedScenario && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onRunScenario(rec)}
                  disabled={scenarioState.loading}
                  className="rounded-full bg-foreground text-background hover:bg-foreground/90"
                >
                  <PlayCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {scenarioState.loading ? 'Running…' : 'Run scenario'}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onAskFollowUp(rec)}
                className="rounded-full text-muted-foreground hover:text-foreground"
              >
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Ask a follow-up
              </Button>
              {rec.steps.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpanded((v) => !v)}
                  className="ml-auto rounded-full text-muted-foreground hover:text-foreground"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="mr-1 h-3.5 w-3.5" aria-hidden />
                      Hide steps
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 h-3.5 w-3.5" aria-hidden />
                      Show steps
                    </>
                  )}
                </Button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {expanded && rec.steps.length > 0 && (
                <motion.ol
                  key="steps"
                  initial={reduced ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={reduced ? { opacity: 0, height: 0 } : { opacity: 0, height: 0 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.35, ease: appleEase }}
                  className="mt-4 space-y-2 overflow-hidden rounded-xl bg-foreground/[0.04] p-4 text-sm"
                >
                  {rec.steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 leading-relaxed">
                      <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-foreground/10 text-[11px] font-semibold tabular-nums text-foreground">
                        {i + 1}
                      </span>
                      <span className="text-foreground/90">{s}</span>
                    </li>
                  ))}
                </motion.ol>
              )}
            </AnimatePresence>

            {scenarioState.error && (
              <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                Couldn&apos;t run that scenario right now: {scenarioState.error}
              </div>
            )}

            {scenarioState.result && (
              <ScenarioInlinePreview result={scenarioState.result} />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EvidenceCell({ evidence }: { evidence: AIAdviceEvidence }) {
  return (
    <div className="rounded-xl bg-foreground/[0.04] px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {evidence.label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {formatEvidence(evidence)}
      </dd>
    </div>
  );
}

function formatEvidence(e: AIAdviceEvidence): string {
  if (e.format === 'currency') return formatCurrency(e.value);
  if (e.format === 'percent') return formatPercentageValue(e.value);
  return new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 }).format(e.value);
}

function ScenarioInlinePreview({ result }: { result: import('@/lib/cfo').ScenarioResult }) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-foreground/10 bg-background/40 p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <ChevronRight className="h-3 w-3" aria-hidden />
        Scenario projection
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{result.summary}</p>

      {result.impacts.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {result.impacts.map((i, idx) => (
            <div
              key={idx}
              className="flex items-baseline justify-between gap-3 rounded-xl bg-foreground/[0.04] px-3 py-2"
            >
              <div className="text-[11px] font-medium text-muted-foreground">{i.label}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs tabular-nums text-muted-foreground/70">
                  {formatImpactValue(i.before, i.format)}
                </span>
                <span aria-hidden className="text-muted-foreground/50">
                  →
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    i.direction === 'positive'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : i.direction === 'negative'
                        ? 'text-rose-700 dark:text-rose-300'
                        : 'text-foreground'
                  }`}
                >
                  {formatImpactValue(i.after, i.format)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {result.warnings.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {result.warnings.map((w, idx) => (
            <li
              key={idx}
              className={`flex items-start gap-2 text-xs ${
                w.severity === 'critical'
                  ? 'text-rose-700 dark:text-rose-300'
                  : w.severity === 'caution'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-muted-foreground'
              }`}
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-none" aria-hidden />
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      )}

      {result.assumptions.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Assumptions
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {result.assumptions.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function formatImpactValue(v: number, format: 'currency' | 'percent' | 'number'): string {
  if (format === 'currency') return formatCurrency(v);
  if (format === 'percent') return formatPercentageValue(v);
  return new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 }).format(v);
}
