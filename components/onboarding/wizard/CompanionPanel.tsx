'use client';

/**
 * CompanionPanel — Phase 12 Track G (G.0)
 *
 * The onboarding companion: a calm, docked panel that sits above the
 * wizard's form for a step ("the form opens underneath" — Reza,
 * 2026-05-20). It does two things:
 *
 *   1. A scripted INTRO — instant, never fails, no LLM. Explains why this
 *      step matters in warm TRAIL-stage-T language.
 *   2. An LLM REFLECTION — reads a minimal, de-identified COUNTS-ONLY
 *      snapshot of what the user has entered and reflects it back warmly.
 *
 * Design rules (see docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md):
 *   - The companion is NEVER a dependency. Every failure path is silent —
 *     the scripted intro stays, the form is untouched. This is the
 *     structural fix for the old chat's "it breaks".
 *   - The snapshot sent to the server is counts/flags ONLY — never names,
 *     never balances. The reflection is warm without PII.
 *   - The companion is a guide, not an adviser — no financial advice
 *     (enforced server-side in the companion gateway's system prompt).
 *
 * G.0 scope: household step only. G.1 widens this to all 12 steps.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { WizardData } from './types';

// Scripted, instant intro for the household step. No LLM — this always
// renders, even when the companion AI is unavailable.
const HOUSEHOLD_INTRO =
  "Let's start with your household — the people (and pets!) who share your " +
  'financial life. It is the foundation everything else builds on, and it ' +
  'lets Monitrax make the rest of your setup personal to you.';

// Debounce before asking the companion to reflect. Long enough that a user
// adding several family members in a row triggers one reflection, not one
// per member.
const REFLECTION_DEBOUNCE_MS = 2200;

interface CompanionPanelProps {
  data: WizardData;
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

export function CompanionPanel({ data }: CompanionPanelProps) {
  // The companion route is authenticated (`withPermission`). The fetch
  // below MUST carry the Bearer token — a 401 from a tokenless fetch is
  // read by SessionExpiryHandler as a dead session and logs the user
  // out. (Tech Debt #20 / PR #798 — "never assume the wrapped fetch
  // adds the header".)
  const { token } = useAuth();

  const snapshot = useMemo(
    () => buildHouseholdSnapshot(data),
    [data.householdMembers, data.householdPets, data.carsCount],
  );
  const signature = JSON.stringify(snapshot);

  const [reflection, setReflection] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  // The snapshot signature the current `reflection` was generated for —
  // so we don't re-call the LLM for a state we've already reflected on.
  const lastReflectedSigRef = useRef<string | null>(null);

  useEffect(() => {
    // Nothing entered yet → the scripted intro is enough.
    if (snapshot.memberCount === 0) return;
    // No auth token yet → skip silently. Fetching the authenticated
    // companion route without a Bearer token returns 401, which the
    // session handler reads as a dead session and logs the user out.
    // The companion is never a dependency — skipping is harmless.
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
        // Any non-success: silently keep the intro / previous reflection.
        // The companion is never a dependency.
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
  }, [signature, snapshot, token]);

  return (
    <div className="rounded-2xl border border-indigo-200/60 dark:border-indigo-800/40 bg-gradient-to-br from-indigo-50/80 via-blue-50/50 to-violet-50/40 dark:from-indigo-900/20 dark:via-blue-900/15 dark:to-violet-900/10 p-4 sm:p-5">
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
            Your setup companion
          </div>
        </div>
      </div>

      {/* Scripted intro — always present */}
      <p className="mt-3 rounded-xl rounded-tl-sm bg-white/70 px-3.5 py-2.5 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200/60 dark:bg-slate-900/40 dark:text-slate-200 dark:ring-slate-700/40">
        {HOUSEHOLD_INTRO}
      </p>

      {/* Reflection / thinking — companion reads what you entered */}
      <div aria-live="polite">
        {reflection && (
          <p className="mt-2 rounded-xl rounded-tl-sm bg-gradient-to-br from-blue-500/10 to-indigo-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-slate-700 ring-1 ring-indigo-200/50 dark:from-blue-400/10 dark:to-indigo-400/10 dark:text-slate-200 dark:ring-indigo-700/40">
            {reflection}
          </p>
        )}
        {isThinking && (
          <div className="mt-2 flex items-center gap-2 px-1 text-[11px] text-slate-400 dark:text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            {reflection
              ? 'Monitrax is taking another look…'
              : 'Monitrax is looking at your household…'}
          </div>
        )}
      </div>
    </div>
  );
}

export default CompanionPanel;
