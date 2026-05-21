'use client';

/**
 * CompanionPanel — Phase 12 Track G (G.1a, pacing iteration)
 *
 * The onboarding companion hosts a wizard step as one beat of a guided
 * conversation. It is a **paced, one-line-at-a-time** exchange — NOT a
 * stacked chat thread:
 *
 *   - ONE companion line at a time, swapped in place as the conversation
 *     advances: greeting → invitation → reaction → bridge.
 *   - ONE "you" line — a compact, deterministic summary of what the user
 *     has entered, updated in place.
 *
 * Pacing (Reza feedback 2026-05-21 — "the conversation needs to reset on
 * the page and be on time"): the sequence is driven by a phase machine
 * that always starts at `greeting` on mount and advances on timers /
 * events — so even a returning user with existing data sees the
 * conversation play out in order, not jump to the end.
 *
 * Design rules (docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md §5):
 *   - PUSH-ONLY. The companion guides; it does not field questions and
 *     does not do extraction.
 *   - NEVER a dependency. Every LLM path is silent on failure — the
 *     scripted greeting/invitation/bridge still carry the conversation.
 *   - The snapshot sent to the server is counts/flags ONLY — never names.
 *   - Guide, not adviser — no financial advice (enforced server-side).
 *
 * G.1a scope: household step only.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { WizardData } from './types';
import '@/styles/wizard-animations.css';

// The four companion turns. greeting → invitation are scripted + timed;
// reaction is the LLM line; bridge is scripted.
type Phase = 'greeting' | 'invitation' | 'reaction' | 'bridge';

// Scripted lines — one line each, instant, never fail.
const GREETING =
  "Hi — I'm your Monitrax guide. Let's set things up together, one step at a time.";
const INVITATION =
  'First up: who shares your home? Add everyone — and any pets — below.';

// Pacing. The greeting holds, then the invitation; the reaction loads
// once the user has data; the reaction holds before the bridge.
const GREETING_MS = 2600;
const REFLECTION_DEBOUNCE_MS = 2000;
const REACTION_HOLD_MS = 4800;
// If the reaction never arrives (LLM down), advance to the bridge anyway.
const FALLBACK_TO_BRIDGE_MS = 9000;

interface CompanionPanelProps {
  data: WizardData;
  /** Title of the step the user reaches next — used in the bridge line. */
  nextStepLabel?: string;
}

/**
 * Minimal, de-identified household snapshot — COUNTS ONLY, no names.
 * Count-only means editing a member's name does not change the snapshot,
 * so the reaction fires on structural changes, not keystrokes.
 */
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

/** The compact "you" line — what the user has entered, in plain words. */
function buildYouSummary(s: ReturnType<typeof buildHouseholdSnapshot>): string {
  const parts: string[] = [];
  if (s.adultCount > 0) parts.push(plural(s.adultCount, 'adult', 'adults'));
  if (s.childCount > 0) parts.push(plural(s.childCount, 'child', 'children'));
  if (s.petCount > 0) parts.push(plural(s.petCount, 'pet', 'pets'));
  if (s.carCount > 0) parts.push(plural(s.carCount, 'car', 'cars'));
  return parts.join(' · ');
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
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

  // Phase always starts at 'greeting' on mount — this is the "reset on
  // the page" behaviour: the conversation replays in order every visit.
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
        // Any non-success: silent. The bridge fallback (effect D) still
        // carries the conversation forward.
      } catch {
        // Network error — silent.
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

  // The single companion line for the current moment.
  let aiLine: React.ReactNode;
  if (isThinking) aiLine = <TypingDots />;
  else if (phase === 'greeting') aiLine = GREETING;
  else if (phase === 'invitation') aiLine = INVITATION;
  else if (phase === 'reaction') aiLine = reflection ?? INVITATION;
  else aiLine = bridge;

  // Key changes whenever the visible line changes → it fades in fresh.
  const aiKey = isThinking ? 'thinking' : phase;
  const showYouLine = phase !== 'greeting' && hasMembers;

  return (
    <div className="rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 via-blue-50/50 to-violet-50/40 p-4 dark:border-indigo-800/40 dark:from-indigo-900/20 dark:via-blue-900/15 dark:to-violet-900/10 sm:p-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 text-white shadow-[0_6px_16px_-6px_rgba(99,102,241,0.5)]">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Monitrax
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Your setup guide
          </div>
        </div>
      </div>

      {/* The exchange — one companion line, one "you" line, both swap in
          place as the conversation advances (no stacked thread). */}
      <div className="mt-3 space-y-2" aria-live="polite">
        <div className="flex">
          <div
            key={aiKey}
            className="companion-bubble-enter max-w-[92%] rounded-xl rounded-tl-sm bg-white/80 px-3.5 py-2.5 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200/70 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-700/50"
          >
            {aiLine}
          </div>
        </div>

        {showYouLine && (
          <div className="flex justify-end">
            <div
              key={youSummary}
              className="companion-bubble-enter max-w-[92%] rounded-xl rounded-tr-sm bg-gradient-to-br from-blue-500 to-indigo-600 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-white shadow-[0_4px_12px_-4px_rgba(99,102,241,0.5)]"
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
