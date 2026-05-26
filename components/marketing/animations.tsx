'use client';

/**
 * Public-marketing scroll-reveal primitives.
 *
 * Phase 48 PR 3 (2026-05-26): refactored to compose `components/shell/motion.ts`
 * primitives instead of inline timing constants. Pure refactor — the
 * exported API (`Reveal`, `StaggerContainer`, `StaggerItem`) and their
 * props are unchanged, so the 9 existing consumers in
 * `components/marketing/Trail*.tsx`, `app/wealth-check/page.tsx`,
 * `app/welcome/page.tsx`, `app/trail-method/page.tsx` continue to work
 * without modification. CLAUDE.md §12.2 SSOT: motion vocabulary lives in
 * one place (`motion.ts`), surfaces compose from there.
 */

import { motion, useInView, type Variants } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import { appleEase, useReducedMotionSafe } from '@/components/shell/motion';

/**
 * Single-element reveal on scroll. Fades + rises 32px once visible.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const reduced = useReducedMotionSafe();

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduced ? {} : { opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={reduced ? { duration: 0 } : { duration: 0.7, ease: appleEase, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger orchestrator. Pair with `<StaggerItem>` children — each child
 * animates in 150ms after the previous one once the container scrolls
 * into view.
 */
export function StaggerContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.15 } },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Child of `<StaggerContainer>`. Fades + rises 24px when its parent
 * triggers the staggered transition.
 */
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotionSafe();

  const variants: Variants = {
    hidden: reduced ? {} : { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: appleEase },
    },
  };

  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}
