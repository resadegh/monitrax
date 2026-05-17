/**
 * Motion tokens — canonical SSOT for every animation duration /
 * easing / stagger in the conversational onboarding chat surface
 * (Phase 12 §4a.1).
 *
 * Hard-coding values elsewhere is a code-review reject. Import from
 * here. If you need a value that isn't here, ADD it here first (with
 * its phase-doc rationale) — don't inline.
 *
 * `prefers-reduced-motion` policy: every consumer of these tokens
 * MUST also implement a static fallback (via `motion-reduce:` Tailwind
 * variants, the `useReducedMotion` hook below, or explicit
 * `prefers-reduced-motion` media queries). Animation isn't optional
 * polish — its absence is a first-class state.
 */

import { useEffect, useState } from 'react';

// ============================================================================
// Animation duration + easing
// ============================================================================

/** Bubble fade-in duration on new message append. */
export const MESSAGE_FADE_IN_MS = 200;
/** Bubble fade-in easing. Matches the form wizard's progress-bar easing for
 *  visual continuity across the two onboarding surfaces. */
export const MESSAGE_FADE_IN_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** Pre-typewriter pause minimum — the "I'm reading what you said" beat
 *  that makes the agent feel attentive rather than mechanical. */
export const THINKING_PAUSE_MIN_MS = 600;
/** Pre-typewriter pause maximum. Jitter inside the window so the rhythm
 *  feels natural, not metronomic. */
export const THINKING_PAUSE_MAX_MS = 800;

/** Agent typewriter render speed. Fast enough to not feel sluggish,
 *  slow enough to feel alive. Word-by-word boundary ease (see §4a.3). */
export const TYPEWRITER_CHARS_PER_SEC = 35;

// ============================================================================
// Recap card
// ============================================================================

/** Gap between successive field reveals in TopicRecapCard. */
export const RECAP_FIELD_STAGGER_MS = 80;
/** Recap card glide-up duration. */
export const RECAP_CARD_RISE_MS = 320;
export const RECAP_CARD_RISE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** "Looks right" CTA activates this long after the last field settles —
 *  a beat for the user to read the recap before being able to confirm. */
export const RECAP_CTA_DELAY_MS = 120;

// ============================================================================
// Presence orb
// ============================================================================

/** Idle breathing cycle — sinusoidal scale 0.96→1.0, opacity 0.7→1.0. */
export const ORB_BREATHE_MS = 2400;
/** Thinking shimmer + hue drift cycle while LLM call is in flight. */
export const ORB_THINKING_SHIMMER_MS = 1600;
/** Momentary glow on message complete, then back to idle. */
export const ORB_SETTLED_GLOW_MS = 480;

// ============================================================================
// First-encounter sequence (queued — needs first-encounter persistence)
// ============================================================================

/** Total runtime of the first-time-open sequence. Implementation queued
 *  for E.2b.2 (needs UserPreference.chatFirstEncounterAt persistence). */
export const FIRST_ENCOUNTER_TOTAL_MS = 1200;

// ============================================================================
// Mistake-recovery transparency (§4a.5)
// ============================================================================

/** Previous recap card dims to this opacity when the user taps
 *  "Change something" — stays visible above the new recap. */
export const MISTAKE_RECOVERY_DIM_OPACITY = 0.5;

// ============================================================================
// useReducedMotion hook
// ============================================================================

/**
 * Returns true when the user has `prefers-reduced-motion: reduce`.
 * Reactive — updates if the user changes their OS-level preference
 * during the session.
 *
 * Use to gate the motion path. Always pair with a static fallback —
 * never just disable animation; render the END state.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    // Safari fallback
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

  return reduced;
}

/**
 * Returns a random integer in [THINKING_PAUSE_MIN_MS, THINKING_PAUSE_MAX_MS].
 * Jitter is intentional — a fixed 700ms pause feels metronomic; a randomised
 * 600-800ms feels human. Centralised here so the orchestrator + tests share
 * the same jitter semantics.
 */
export function jitteredThinkingPauseMs(): number {
  const span = THINKING_PAUSE_MAX_MS - THINKING_PAUSE_MIN_MS;
  return THINKING_PAUSE_MIN_MS + Math.floor(Math.random() * (span + 1));
}
