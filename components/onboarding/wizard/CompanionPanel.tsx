'use client';

/**
 * CompanionPanel — Phase 12 Track G (G.1a, accent + typewriter iteration)
 *
 * The onboarding companion hosts a wizard step as one beat of a guided
 * conversation — a paced, one-line-at-a-time exchange:
 *
 *   - ONE companion line at a time, swapped in place as the conversation
 *     advances: greeting → invitation → reaction → bridge.
 *   - ONE compact "you" line — a deterministic summary of what the user
 *     has entered.
 *
 * Visual treatment (Reza feedback 2026-05-21 — "the ai box is not visible
 * enough … needs to be accent and bold … Apple-like … feels modern when
 * the text is typing"):
 *   - An accent **glow halo** (Apple-Intelligence style) lifts the card
 *     off the page so it reads as THE AI surface, not a soft card.
 *   - The companion line is **larger** text, **typed out** character by
 *     character with a blinking caret.
 *
 * Pacing: a phase machine always starts at the greeting on mount and
 * advances on timers/events — a returning user with existing data sees
 * the conversation play out in order, never jump to the end.
 *
 * Invariants (docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md §5):
 *   - PUSH-ONLY — guides, does not field questions, does not extract.
 *   - NEVER a dependency — every LLM path is silent on failure.
 *   - Counts/flags-only snapshot to the server — never names.
 *   - Guide, not adviser — no financial advice (enforced server-side).
 *
 * G.1a scope: household step only.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { WizardData } from './types';
import '@/styles/wizard-animations.css';

type Phase = 'greeting' | 'invitation' | 'reaction' | 'bridge';

// Scripted lines — one line each, instant, never fail.
const GREETING =
  "Hi — I'm your Monitrax guide. Let's set things up together, one step at a time.";
const INVITATION =
  'First up: who shares your home? Add everyone — and any pets — below.';

// Pacing (generous enough to cover type-out + a read pause).
const GREETING_MS = 4200;
const REFLECTION_DEBOUNCE_MS = 2000;
const REACTION_HOLD_MS = 6000;
const FALLBACK_TO_BRIDGE_MS = 10000;
// Typewriter speed — brisk, so it feels alive, not sluggish.
const TYPE_SPEED_MS = 22;

interface CompanionPanelProps {
  data: WizardData;
  /** Title of the step the user reaches next — used in the bridge line. */
  nextStepLabel?: string;
}

function buildHouseholdSnapshot(data: WizardData) {
  const members = data.householdMembers;
  const childCount = members.filter((m) => m.relationship === 'CHILD').length;
  return {
    memberCount: members.length,
    incomeEarnerCount: members.filter((m) => m.isIncomeEarner).length,
    childCount,
    adultCount: members.length - childCount,
    petCount: data.householdPets.length,
    carCount: data.carsCount,
  };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function buildYouSummary(s: ReturnType<typeof buildHouseholdSnapshot>): string {
  const parts: string[] = [];
  if (s.adultCount > 0) parts.push(plural(s.adultCount, 'adult', 'adults'));
  if (s.childCount > 0) parts.push(plural(s.childCount, 'child', 'children'));
  if (s.petCount > 0) parts.push(plural(s.petCount, 'pet', 'pets'));
  if (s.carCount > 0) parts.push(plural(s.carCount, 'car', 'cars'));
  return parts.join(' · ');
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
 * Returns the revealed substring + whether it has finished. Honours
 * `prefers-reduced-motion` (shows the full text instantly).
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

export function CompanionPanel({ data, nextStepLabel }: CompanionPanelProps) {
  // The companion route is authenticated — the fetch MUST carry the
  // Bearer token, or a 401 logs the user out (G.0 hotfix lesson).
  const { token } = useAuth();

  const snapshot = useMemo(
    () => buildHouseholdSnapshot(data),
    [data.householdMembers, data.householdPets, data.carsCount],
  );
  const signature = JSON.stringify(snapshot);
  const hasMembers = snapshot.memberCount > 0;
  const youSummary = buildYouSummary(snapshot);

  // Phase always starts at 'greeting' on mount — the conversation
  // replays in order every visit ("reset on the page").
  const [phase, setPhase] = useState<Phase>('greeting');
  const [reflection, setReflection] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const lastReflectedSigRef = useRef<string | null>(null);

  // A — greeting holds, then hands to the invitation.
  useEffect(() => {
    if (phase !== 'greeting') return;
    const t = window.setTimeout(() => setPhase('invitation'), GREETING_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // B — once past the greeting and the user has entered something, fetch
  // the reaction. On success, swap to the reaction line.
  useEffect(() => {
    if (phase !== 'invitation' && phase !== 'bridge') return;
    if (!hasMembers || !token) return;
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
          body: JSON.stringify({ step: 'household', snapshot }),
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
  }, [phase, hasMembers, token, signature, snapshot]);

  // C — the reaction holds, then hands to the bridge.
  useEffect(() => {
    if (phase !== 'reaction') return;
    const t = window.setTimeout(() => setPhase('bridge'), REACTION_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // D — fallback: if the user has data but the reaction never arrived
  // (LLM unavailable), advance to the bridge so the beat still completes.
  useEffect(() => {
    if (phase !== 'invitation' || !hasMembers) return;
    const t = window.setTimeout(() => {
      setPhase((p) => (p === 'invitation' ? 'bridge' : p));
    }, FALLBACK_TO_BRIDGE_MS);
    return () => window.clearTimeout(t);
  }, [phase, hasMembers]);

  const bridge = nextStepLabel
    ? `Your household is set. Hit Continue when you're ready — ${nextStepLabel} is next.`
    : "Your household is set. Hit Continue when you're ready, and we'll keep going.";

  // The string for the current companion line (drives the typewriter).
  const aiText =
    phase === 'greeting'
      ? GREETING
      : phase === 'invitation'
        ? INVITATION
        : phase === 'reaction'
          ? (reflection ?? INVITATION)
          : bridge;

  const { shown, done } = useTypewriter(aiText);
  const showYouLine = phase !== 'greeting' && hasMembers;

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
