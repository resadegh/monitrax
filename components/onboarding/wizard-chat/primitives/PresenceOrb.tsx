'use client';

/**
 * PresenceOrb — canonical visual identity of the Monitrax conversational
 * agent. NOT a face. NOT a robot. NOT a logo. Ambient intelligence,
 * not a character (Phase 12 §4a.2 + §4a.6 NO-list).
 *
 * Design rules (binding — code-review reject if violated):
 *   1. No face / no eyes / no mouth. The orb is a presence cue, not
 *      a character.
 *   2. No emoji embed. No mascot.
 *   3. Warm-ivory base + iridescent overlay. Iridescence rotates
 *      slowly during `thinking`; settles during `idle`.
 *   4. `prefers-reduced-motion` → STATIC dot (no animation, no
 *      iridescence). Tested as a peer of the animated path.
 *   5. Four states only — `idle` / `listening` / `thinking` /
 *      `settled`. Caller passes via prop; never inferred internally.
 *      Adding a fifth state is a deliberate change that requires
 *      a Phase doc update.
 *
 * Reuse — this primitive is intended for ALL future AI surfaces in
 * Monitrax (the /dashboard/cfo AI Guide surface will adopt it in
 * a separate workstream — that's how we keep the design language
 * consistent across AI-touched surfaces).
 *
 * References (cite for grounding, do not copy):
 *   - Apple Intelligence (iOS 18.x) — iridescent glow + state
 *     transitions
 *   - Siri waveform — circular, ambient
 *   - Linear command palette — ambient warmth, restraint
 *
 * Not references: Cleo, Schwabby, Erica, Replika. Wrong tone.
 *
 * See: docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md §4a.2
 *      components/onboarding/wizard-chat/design/motionTokens.ts
 */

import { useReducedMotion } from '../design/motionTokens';
import '../design/presenceOrb.css';

export type PresenceOrbState = 'idle' | 'listening' | 'thinking' | 'settled';

interface PresenceOrbProps {
  state: PresenceOrbState;
  /** Diameter in px. Default 28 (desktop chat-thread). Mobile chat
   *  thread uses 24 — caller decides. */
  size?: number;
  /** Optional class for layout (margin / positioning). */
  className?: string;
}

export function PresenceOrb({ state, size = 28, className = '' }: PresenceOrbProps) {
  const reducedMotion = useReducedMotion();

  // Reduced-motion fallback — static 4px dot, no animation, no iridescence.
  // The dot is centered within the same `size` footprint so layout stays
  // identical between animated + reduced paths.
  if (reducedMotion) {
    return (
      <div
        className={`inline-flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <span
          className="block rounded-full bg-blue-500/70 dark:bg-blue-400/70"
          style={{ width: 4, height: 4 }}
        />
      </div>
    );
  }

  const animationClass =
    state === 'idle'
      ? 'orb-breathe'
      : state === 'thinking'
        ? 'orb-shimmer'
        : state === 'listening'
          ? 'orb-listen'
          : 'orb-settled';

  return (
    <span
      className={`presence-orb inline-flex items-center justify-center ${animationClass} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 28 28"
        width={size}
        height={size}
        className="block"
        focusable="false"
      >
        {/* Soft outer halo — provides the ambient glow + the shadow on
            settled-state. Filled with a radial gradient so the orb has
            depth without a hard edge. */}
        <defs>
          <radialGradient id="orb-base" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbf2" stopOpacity="1" />
            <stop offset="65%" stopColor="#fefaf3" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#fef6ea" stopOpacity="0.6" />
          </radialGradient>
          <linearGradient id="orb-iridescence" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {/* Base circle — warm ivory, soft shadow */}
        <circle cx="14" cy="14" r="13" fill="url(#orb-base)" />

        {/* Iridescent overlay — rotates during thinking, gentle in idle */}
        <circle cx="14" cy="14" r="13" fill="url(#orb-iridescence)" className="orb-iridescence" />

        {/* Inner highlight — adds depth */}
        <circle cx="10" cy="10" r="3.5" fill="#ffffff" fillOpacity="0.42" />
      </svg>
    </span>
  );
}
