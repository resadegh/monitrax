'use client';

/**
 * Shared motion vocabulary for Monitrax shell-layer surfaces.
 *
 * Single source of truth for the motion timing + spring physics
 * established by the Phase 39 My Wealth redesign. Any future surface
 * (Org Portal, Admin Portal polish, settings, modals) that wants to
 * feel like the consumer app imports from here — never re-defines
 * `appleEase` locally.
 *
 * See:
 *  - components/properties/PropertiesHero.tsx — original definitions
 *  - docs/architecture/06_UI_UX_FOUNDATION.md §"Shared shell layer"
 */

import { useReducedMotion } from 'framer-motion';
import type { Easing, Transition } from 'framer-motion';

/**
 * Apple-style cubic-bezier. Snappy entrance, smooth deceleration.
 * Matches Phase 39 wealth tiles + heroes. DO NOT redefine elsewhere.
 */
export const appleEase: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

/**
 * Springy press / release physics for buttons + tile hovers. Responsive
 * but not bouncy. Phase 39 canon (PropertyTile.tsx:37).
 */
export const springSnap = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 28,
  mass: 0.8,
};

/**
 * Standard tile-entrance transition. Use with framer-motion's
 * initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}.
 * Stagger by 40ms per index.
 */
export const tileEnter = (index = 0): Transition => ({
  duration: 0.55,
  ease: appleEase as Easing,
  delay: 0.04 * index,
});

/**
 * Hero entrance — slightly slower than a tile, no stagger.
 */
export const heroEnter: Transition = {
  duration: 0.6,
  ease: appleEase as Easing,
};

/**
 * Slow breathing glow. Apply to a positioned blur pill behind a hero.
 * 8s loop. Skip when prefers-reduced-motion.
 */
export const breathingGlow = {
  animate: { opacity: [0.3, 0.5, 0.3] },
  transition: { duration: 8, repeat: Infinity, ease: 'easeInOut' as Easing },
};

/**
 * Wraps useReducedMotion so consumers don't have to handle the
 * undefined-on-server case. Returns boolean only.
 */
export function useReducedMotionSafe(): boolean {
  return useReducedMotion() ?? false;
}
