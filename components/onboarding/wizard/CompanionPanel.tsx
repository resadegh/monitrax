'use client';

/**
 * CompanionPanel — Phase 12 Track G (G.1b + companion-guidance beat)
 *
 * The onboarding companion hosts each wizard step as one beat of a guided
 * conversation — a paced, one-line-at-a-time exchange:
 *
 *   - ONE companion line at a time, typed out, swapped in place as the
 *     beat advances: (greeting →) invitation → checklist → reaction →
 *     bridge.
 *   - ONE compact "you" line — a deterministic summary of what the user
 *     has entered on this step.
 *
 * The beat is two-phase before the user acts: an **invitation** (warm
 * orientation — what this step is, why it matters) then a **checklist**
 * (a directive completeness prompt — what to add, and the things people
 * forget). The checklist is the resting state — the companion stays
 * there *directing* the user until they genuinely engage. Only real
 * progress made on this visit advances the beat to reaction → bridge.
 *
 * Genuine-progress gating: the panel captures the step's counts
 * signature at mount. A pre-existing row (an auto-created default
 * entity, a resumed step) is NOT progress — so the companion never
 * congratulates the user for data they did not enter. `hasUserProgress`
 * is true only once the user changes the counts while on this step.
 *
 * G.1b generalises the G.1a household-only panel to every collection
 * step via `STEP_CONFIG` (per-step invitation + checklist + snapshot +
 * you-summary): the `welcome` picker plus the 9 entity steps. The
 * greeting shows only on the first step (welcome); only `review` (the
 * celebration screen) has no companion.
 *
 * Visual: an Apple-Intelligence-style accent glow halo + a larger
 * companion line typed out with a blinking caret.
 *
 * Invariants (docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md §5):
 *   - PUSH-ONLY — guides, does not field questions, does not extract.
 *   - NEVER a dependency — every LLM path is silent on failure.
 *   - Counts/flags-only snapshot to the server — never names, never
 *     balances, never CDR values.
 *   - Guide, not adviser — no financial advice (enforced server-side).
 *
 * The panel must be KEYED by step id by the caller, so navigating
 * between steps remounts it and replays that step's beat.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { WizardData, WizardStepId } from './types';
import '@/styles/wizard-animations.css';

type Phase = 'greeting' | 'invitation' | 'checklist' | 'reaction' | 'bridge';

// The greeting — shown once, on the first companion step (welcome).
const GREETING =
  "Hi — I'm your Monitrax guide. Let's set things up together, one step at a time.";

// Pacing (generous enough to cover type-out + a read pause).
const GREETING_MS = 4200;
const INVITATION_HOLD_MS = 5000;
const REFLECTION_DEBOUNCE_MS = 2000;
const REACTION_HOLD_MS = 6000;
const FALLBACK_TO_BRIDGE_MS = 10000;
const TYPE_SPEED_MS = 22;

interface StepConfig {
  /** The scripted invitation — warm orientation: what this step is. */
  invitation: string;
  /**
   * The scripted checklist — a directive completeness prompt. This is
   * the companion's resting line: it stays here, telling the user what
   * to add (and the things people forget), until they genuinely act.
   * For optional steps it also carries the permission to move on.
   */
  checklist: string;
  /** Counts/flags for the LLM reaction. Numbers only — never PII. */
  snapshot: (d: WizardData) => Record<string, number>;
  /** The compact "you" line — plain words for what the user entered. */
  youSummary: (d: WizardData) => string;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// Per-step companion config. The keys here ARE the companion-eligible
// steps — only `review` (the celebration screen) deliberately has no
// companion.
const STEP_CONFIG: Partial<Record<WizardStepId, StepConfig>> = {
  welcome: {
    invitation:
      'A couple of quick questions about your situation — they shape every step that follows.',
    checklist:
      'Tell me whether you own or rent, and whether you hold any investments or super. There are no wrong answers — this just tailors your setup.',
    snapshot: (d) => ({
      housingAnswered: d.housing !== null ? 1 : 0,
      owns: d.housing === 'OWN' || d.housing === 'BOTH' ? 1 : 0,
      rents: d.housing === 'RENT' || d.housing === 'BOTH' ? 1 : 0,
      investmentsAnswered: d.hasInvestments !== null ? 1 : 0,
      hasInvestments: d.hasInvestments === 'YES' ? 1 : 0,
      debtTypeCount: d.debtCategories.length,
    }),
    youSummary: (d) => {
      const parts: string[] = [];
      if (d.housing === 'OWN') parts.push('owns');
      else if (d.housing === 'RENT') parts.push('rents');
      else if (d.housing === 'BOTH') parts.push('owns + rents');
      if (d.hasInvestments === 'YES') parts.push('has investments');
      else if (d.hasInvestments === 'NO') parts.push('no investments yet');
      return parts.join(' · ');
    },
  },
  household: {
    invitation:
      'First up — your household. This is everyone your money looks after.',
    checklist:
      'Add each person who lives with you — partner, children, anyone else — then any pets and cars. The fuller the picture, the better I can shape your budget.',
    snapshot: (d) => {
      const childCount = d.householdMembers.filter(
        (m) => m.relationship === 'CHILD',
      ).length;
      return {
        memberCount: d.householdMembers.length,
        incomeEarnerCount: d.householdMembers.filter((m) => m.isIncomeEarner)
          .length,
        childCount,
        adultCount: d.householdMembers.length - childCount,
        petCount: d.householdPets.length,
        carCount: d.carsCount,
      };
    },
    youSummary: (d) => {
      const childCount = d.householdMembers.filter(
        (m) => m.relationship === 'CHILD',
      ).length;
      const adults = d.householdMembers.length - childCount;
      const parts: string[] = [];
      if (adults > 0) parts.push(plural(adults, 'adult', 'adults'));
      if (childCount > 0) parts.push(plural(childCount, 'child', 'children'));
      if (d.householdPets.length > 0)
        parts.push(plural(d.householdPets.length, 'pet', 'pets'));
      if (d.carsCount > 0) parts.push(plural(d.carsCount, 'car', 'cars'));
      return parts.join(' · ');
    },
  },
  entities: {
    invitation:
      'Next — how your wealth is held. Many Australians hold assets in more than one place.',
    checklist:
      'Hold anything through a family trust, SMSF, company or partnership? Add each one above. If it is all in your personal name, that is the most common setup — just continue.',
    snapshot: (d) => ({ structureCount: d.entities.length }),
    youSummary: (d) => plural(d.entities.length, 'structure', 'structures'),
  },
  properties: {
    invitation:
      'Now the bricks and mortar — let us map any property in your world.',
    checklist:
      'Add every property — the home you live in and any you rent out. Include the loan against each one, and the weekly rent if it is an investment.',
    snapshot: (d) => ({
      propertyCount: d.properties.length,
      withMortgageCount: d.properties.filter((p) => p.hasLoan).length,
      rentalCount: d.properties.filter(
        (p) => (p.income?.amount ?? 0) > 0,
      ).length,
    }),
    youSummary: (d) => plural(d.properties.length, 'property', 'properties'),
  },
  debts: {
    invitation: 'Let us look at what you owe — beyond any home loan.',
    checklist:
      'Add the debts that are easy to forget — a car loan, HECS or HELP, a personal loan, anything on a payment plan. Each one shapes your real cashflow.',
    snapshot: (d) => ({ debtCount: d.debts.length }),
    youSummary: (d) => plural(d.debts.length, 'debt', 'debts'),
  },
  accounts: {
    invitation:
      'Where does your money live day to day? Let us add your accounts.',
    checklist:
      'Add your everyday account and any savings. Have an offset account? Add it too — it is quietly cutting your loan interest.',
    snapshot: (d) => ({
      accountCount: d.accounts.length,
      offsetCount: d.accounts.filter((a) => !!a.linkedLoanId).length,
    }),
    youSummary: (d) => plural(d.accounts.length, 'account', 'accounts'),
  },
  investments: {
    invitation: 'Onto the growth side — the money already working for you.',
    checklist:
      'Add any shares, ETFs or managed funds — even a small parcel counts. You can list the individual holdings too if you have them handy.',
    snapshot: (d) => ({
      accountCount: d.investments.length,
      holdingCount: d.investments.reduce(
        (sum, inv) => sum + inv.holdings.length,
        0,
      ),
    }),
    youSummary: (d) =>
      plural(d.investments.length, 'investment account', 'investment accounts'),
  },
  super: {
    invitation:
      "Super is often a person's second-largest asset. Let us capture yours.",
    checklist:
      'Add every super fund you hold — many people carry two or three from past jobs. Tracking down lost super counts too.',
    snapshot: (d) => ({ superAccountCount: d.superAccounts.length }),
    youSummary: (d) =>
      plural(d.superAccounts.length, 'super account', 'super accounts'),
  },
  assets: {
    invitation: 'Anything else of real value? Let us round out the picture.',
    checklist:
      'Add the things worth a meaningful amount — a car, jewellery, tools, collectibles. These complete your true net worth.',
    snapshot: (d) => ({ assetCount: d.assets.length }),
    youSummary: (d) => plural(d.assets.length, 'asset', 'assets'),
  },
  'income-expenses': {
    invitation: 'Last step — your cashflow. What comes in, and what goes out.',
    checklist:
      'Add every income source — salary, side income, government payments — then your regular bills and spending. The closer to reality, the more useful your budget.',
    snapshot: (d) => ({
      incomeCount: d.income.length,
      expenseCount: d.expenses.length,
    }),
    youSummary: (d) => {
      const parts: string[] = [];
      if (d.income.length > 0) parts.push(`${d.income.length} income`);
      if (d.expenses.length > 0) parts.push(`${d.expenses.length} spending`);
      return parts.join(' · ');
    },
  },
};

/** True when the given wizard step should render the companion. */
export function isCompanionStep(step: WizardStepId): boolean {
  return STEP_CONFIG[step] !== undefined;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Reveal `text` character by character — the modern-AI "typing" feel.
 * Honours `prefers-reduced-motion` (shows the full text instantly).
 */
function useTypewriter(text: string): { shown: string; done: boolean } {
  const [shown, setShown] = useState('');

  useEffect(() => {
    if (!text || prefersReducedMotion()) {
      setShown(text);
      return;
    }
    setShown('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, TYPE_SPEED_MS);
    return () => window.clearInterval(id);
  }, [text]);

  return { shown, done: shown === text };
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-indigo-400 dark:text-indigo-300">
      <span className="companion-typing-dot" />
      <span className="companion-typing-dot" style={{ animationDelay: '0.15s' }} />
      <span className="companion-typing-dot" style={{ animationDelay: '0.3s' }} />
    </span>
  );
}

interface CompanionPanelProps {
  /** The wizard step this companion is hosting. */
  step: WizardStepId;
  data: WizardData;
  /** Title of the step the user reaches next — used in the bridge line. */
  nextStepLabel?: string;
}

export function CompanionPanel({ step, data, nextStepLabel }: CompanionPanelProps) {
  // The companion route is authenticated — the fetch MUST carry the
  // Bearer token, or a 401 logs the user out (G.0 hotfix lesson).
  const { token } = useAuth();

  const config = STEP_CONFIG[step];
  // Greeting is shown once, on the first companion step (welcome).
  const withGreeting = step === 'welcome';

  const snapshot = useMemo(
    () => (config ? config.snapshot(data) : {}),
    [config, data],
  );
  const signature = JSON.stringify(snapshot);
  const hasEntries = Object.values(snapshot).some((v) => v > 0);
  const youSummary = config ? config.youSummary(data) : '';

  // Genuine-progress gate. The signature captured at mount is the
  // baseline — any data already present then (an auto-created default
  // entity, a resumed step) is NOT the user's doing. `hasUserProgress`
  // turns true only once the user changes the counts while on this
  // step, so the companion never congratulates them for nothing.
  const initialSignatureRef = useRef(signature);
  const hasUserProgress = signature !== initialSignatureRef.current;

  // Phase always starts fresh on mount — the caller keys this component
  // by step id, so each step replays its own beat in order.
  const [phase, setPhase] = useState<Phase>(
    withGreeting ? 'greeting' : 'invitation',
  );
  const [reflection, setReflection] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const lastReflectedSigRef = useRef<string | null>(null);

  // A — greeting holds, then hands to the invitation.
  useEffect(() => {
    if (phase !== 'greeting') return;
    const t = window.setTimeout(() => setPhase('invitation'), GREETING_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // A.2 — the invitation holds, then hands to the checklist (the
  // directive resting line). The checklist does NOT auto-advance — the
  // companion stays there guiding until the user genuinely engages.
  useEffect(() => {
    if (phase !== 'invitation') return;
    const t = window.setTimeout(() => {
      setPhase((p) => (p === 'invitation' ? 'checklist' : p));
    }, INVITATION_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // B — once the user has made REAL progress on this step (not a
  // pre-existing default), fetch the reaction. On success, swap to the
  // reaction line.
  useEffect(() => {
    if (phase === 'greeting' || phase === 'reaction') return;
    if (!hasUserProgress || !token) return;
    if (signature === lastReflectedSigRef.current) return;

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setIsThinking(true);
      try {
        const res = await fetch('/api/onboarding/companion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ step, snapshot }),
        });
        const json = (await res.json().catch(() => null)) as
          | { success?: boolean; data?: { message?: unknown } }
          | null;
        if (cancelled) return;
        if (
          res.ok &&
          json?.success &&
          typeof json.data?.message === 'string' &&
          json.data.message.trim().length > 0
        ) {
          lastReflectedSigRef.current = signature;
          setReflection(json.data.message.trim());
          setPhase('reaction');
        }
      } catch {
        // Network error — silent. The bridge fallback still completes
        // the beat.
      } finally {
        if (!cancelled) setIsThinking(false);
      }
    }, REFLECTION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [phase, hasUserProgress, token, signature, snapshot, step]);

  // C — the reaction holds, then hands to the bridge.
  useEffect(() => {
    if (phase !== 'reaction') return;
    const t = window.setTimeout(() => setPhase('bridge'), REACTION_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // D — fallback: if the user has made real progress but the reaction
  // never arrived (LLM unavailable), advance to the bridge so the beat
  // still completes. Without progress the companion stays on the
  // checklist — it never bridges off data the user did not enter.
  useEffect(() => {
    if (!hasUserProgress) return;
    if (phase !== 'invitation' && phase !== 'checklist') return;
    const t = window.setTimeout(() => {
      setPhase((p) =>
        p === 'invitation' || p === 'checklist' ? 'bridge' : p,
      );
    }, FALLBACK_TO_BRIDGE_MS);
    return () => window.clearTimeout(t);
  }, [phase, hasUserProgress]);

  // Steps without a config (welcome / review) render nothing.
  if (!config) return null;

  const bridge = nextStepLabel
    ? `Nicely done. Hit Continue when you're ready — ${nextStepLabel} is next.`
    : "Nicely done. Hit Continue when you're ready, and we'll keep going.";

  // The string for the current companion line (drives the typewriter).
  const aiText =
    phase === 'greeting'
      ? GREETING
      : phase === 'invitation'
        ? config.invitation
        : phase === 'checklist'
          ? config.checklist
          : phase === 'reaction'
            ? (reflection ?? config.checklist)
            : bridge;

  const { shown, done } = useTypewriter(aiText);
  const showYouLine = phase !== 'greeting' && hasEntries && youSummary.length > 0;

  return (
    <div className="relative">
      {/* Accent glow halo — makes the companion read as THE AI surface. */}
      <div
        aria-hidden
        className="companion-glow pointer-events-none absolute -inset-1.5 rounded-[1.7rem] bg-gradient-to-r from-blue-500 via-indigo-500 to-fuchsia-500 opacity-50 blur-xl"
      />

      {/* Card */}
      <div className="relative rounded-2xl bg-gradient-to-br from-white to-indigo-50/60 p-5 shadow-[0_12px_40px_-12px_rgba(79,70,229,0.5)] ring-1 ring-indigo-200/70 dark:from-slate-900 dark:to-indigo-950/50 dark:ring-indigo-700/50">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 text-white shadow-[0_8px_20px_-6px_rgba(99,102,241,0.65)]">
            <Sparkles className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Monitrax
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-indigo-500 dark:text-indigo-300">
              Your setup guide
            </div>
          </div>
        </div>

        {/* The companion's current line — larger, typed out with a caret. */}
        <p
          className="mt-3.5 min-h-[3em] text-[15px] font-medium leading-relaxed text-slate-800 dark:text-slate-100"
          aria-live="polite"
        >
          {isThinking ? (
            <TypingDots />
          ) : (
            <>
              {shown}
              {!done && <span className="companion-caret text-indigo-500" />}
            </>
          )}
        </p>

        {/* The "you" line — a compact summary of what was entered. */}
        {showYouLine && (
          <div className="mt-1 flex justify-end">
            <div
              key={youSummary}
              className="companion-bubble-enter max-w-[92%] rounded-xl rounded-tr-sm bg-gradient-to-br from-blue-500 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_4px_14px_-4px_rgba(99,102,241,0.6)]"
            >
              {youSummary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CompanionPanel;
