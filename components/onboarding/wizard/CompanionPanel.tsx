'use client';

/**
 * CompanionPanel — Phase 12 Track G (G.1a)
 *
 * The onboarding companion: a calm, docked panel that HOSTS a wizard step
 * as one beat of a guided conversation ("the form opens underneath" —
 * Reza). Each beat has three companion moves (see
 * docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md §5):
 *
 *   1. INVITATION — a warm, scripted invitation to act ("Let's start with
 *      your household — add everyone below"). Instant, never fails, no LLM.
 *      G.1a opens with a short greeting first, so the companion introduces
 *      itself + the journey before the first step.
 *   2. REACTION — once the user has entered something, an LLM reflection
 *      reads a counts-only snapshot and responds warmly.
 *   3. BRIDGE — a scripted hand-off that names the next step, so 12 forms
 *      read as one continuous conversation.
 *
 * Design rules:
 *   - PUSH-ONLY. The companion guides; it does NOT field free-form
 *     questions (that is My Guide, a separate surface) and does NOT do
 *     extraction (the user fills the form).
 *   - NEVER a dependency. Every LLM path is silent on failure — the
 *     scripted greeting/invitation/bridge stay, the form is untouched.
 *   - The snapshot sent to the server is counts/flags ONLY — never names,
 *     never balances.
 *   - The companion is a guide, not an adviser — no financial advice
 *     (enforced server-side in the companion gateway's system prompt).
 *
 * G.1a scope: household step only. G.1b widens this to all 12 steps and
 * adds cross-step memory + adaptive narration.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { WizardData } from './types';
import '@/styles/wizard-animations.css';

// Scripted companion turns for the household step. No LLM — these always
// render, even when the companion AI is unavailable.
const GREETING =
  "Hi — I'm your Monitrax guide. I'll walk you through setup one step at a " +
  "time; it's quicker than it looks, and by the end you'll see your whole " +
  'financial picture.';

const INVITATION =
  "Let's start with your household — the people, and pets, who share your " +
  'financial life. Add everyone who lives with you below, and I will use it ' +
  'to make the rest of your setup personal to you.';

// Debounce before asking the companion to reflect — long enough that
// adding several members in a row triggers one reflection, not one each.
const REFLECTION_DEBOUNCE_MS = 2200;
// The greeting and invitation appear staggered, like the companion talking.
const GREETING_DELAY_MS = 250;
const INVITATION_DELAY_MS = 1100;

interface CompanionPanelProps {
  data: WizardData;
  /** Title of the step the user reaches next — used in the bridge line. */
  nextStepLabel?: string;
}

/**
 * Derive the minimal, de-identified household snapshot. COUNTS ONLY —
 * deliberately no names. Because this is count-only, editing a member's
 * name does not change the snapshot signature, so reflections fire on
 * structural changes (a member added) not on every keystroke.
 */
function buildHouseholdSnapshot(data: WizardData): Record<string, number> {
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

/** One companion turn — fades + rises in so it reads as a spoken line. */
function Bubble({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <p
      className={`companion-bubble-enter rounded-xl rounded-tl-sm px-3.5 py-2.5 text-xs leading-relaxed ring-1 ${
        accent
          ? 'bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-slate-700 ring-indigo-200/50 dark:from-blue-400/10 dark:to-indigo-400/10 dark:text-slate-200 dark:ring-indigo-700/40'
          : 'bg-white/70 text-slate-700 ring-slate-200/60 dark:bg-slate-900/40 dark:text-slate-200 dark:ring-slate-700/40'
      }`}
    >
      {children}
    </p>
  );
}

export function CompanionPanel({ data, nextStepLabel }: CompanionPanelProps) {
  // The companion route is authenticated (`withPermission`). The fetch
  // below MUST carry the Bearer token — a 401 from a tokenless fetch is
  // read by SessionExpiryHandler as a dead session and logs the user out.
  const { token } = useAuth();

  const snapshot = useMemo(
    () => buildHouseholdSnapshot(data),
    [data.householdMembers, data.householdPets, data.carsCount],
  );
  const signature = JSON.stringify(snapshot);
  const hasMembers = snapshot.memberCount > 0;

  // Staggered intro: greeting, then invitation — reads as the companion
  // talking, not a static block. 0 none / 1 greeting / 2 +invitation.
  const [introStage, setIntroStage] = useState(0);
  useEffect(() => {
    const t1 = window.setTimeout(() => setIntroStage(1), GREETING_DELAY_MS);
    const t2 = window.setTimeout(() => setIntroStage(2), INVITATION_DELAY_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const [reflection, setReflection] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  // The snapshot signature the current `reflection` was generated for —
  // so we don't re-call the LLM for a state we've already reflected on.
  const lastReflectedSigRef = useRef<string | null>(null);

  useEffect(() => {
    // Nothing entered yet → the scripted invitation is enough.
    if (!hasMembers) return;
    // No auth token yet → skip silently. Fetching the authenticated
    // companion route without a Bearer token returns 401, which the
    // session handler reads as a dead session and logs the user out.
    if (!token) return;
    // Already reflected on this exact state → skip.
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
          setReflection(json.data.message.trim());
          lastReflectedSigRef.current = signature;
        }
        // Any non-success: silently keep the scripted turns. The
        // companion is never a dependency.
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
  }, [signature, snapshot, hasMembers, token]);

  // Scripted bridge — appears once the step has content, hands off to the
  // next step by name so 12 forms read as one conversation.
  const bridge = nextStepLabel
    ? `That's your household taking shape. When you're ready, hit Continue — next, I'll walk you through ${nextStepLabel}.`
    : "That's your household taking shape. When you're ready, hit Continue and we'll keep building your picture together.";

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

      {/* Conversation thread — greeting → invitation → reaction → bridge */}
      <div className="mt-3 space-y-2" aria-live="polite">
        {introStage >= 1 && <Bubble>{GREETING}</Bubble>}
        {introStage >= 2 && <Bubble>{INVITATION}</Bubble>}
        {reflection && (
          <Bubble key={reflection} accent>
            {reflection}
          </Bubble>
        )}
        {isThinking && (
          <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400 dark:text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            {reflection
              ? 'Monitrax is taking another look…'
              : 'Monitrax is looking at your household…'}
          </div>
        )}
        {hasMembers && <Bubble>{bridge}</Bubble>}
      </div>
    </div>
  );
}

export default CompanionPanel;
