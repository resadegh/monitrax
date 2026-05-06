'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { appleEase } from '@/components/shell/motion';
import { ChevronDown } from 'lucide-react';


const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
};

const fadeUp = (reduced: boolean | null) => ({
  hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: appleEase },
  },
});

export function TrailHero() {
  const reduced = useReducedMotion();

  return (
    <section className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden bg-stone-950">
      {/* Subtle gradient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-600/[0.07] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {/* Eyebrow */}
          <motion.div variants={fadeUp(reduced)} className="mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-stone-400">
              Your personal financial guide — built for Australians
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp(reduced)}
            className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-white"
            style={{ letterSpacing: '-0.03em', lineHeight: 1.08 }}
          >
            Stop stressing about money.
            <br />
            <span className="text-amber-500">Start following the TRAIL.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeUp(reduced)}
            className="mx-auto mt-6 max-w-2xl text-lg text-stone-400 sm:text-xl"
            style={{ lineHeight: 1.6 }}
          >
            Monitrax connects your bank accounts, tracks everything, and
            guides you step by step to financial freedom.
          </motion.p>

          {/* CTA */}
          <motion.div variants={fadeUp(reduced)} className="mt-10 flex flex-col items-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-amber-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-600/30"
            >
              Start your TRAIL — it&apos;s free
            </Link>
            <Link
              href="/trail-check"
              className="inline-flex items-center gap-2 text-sm font-medium text-stone-400 hover:text-amber-400 transition-colors"
            >
              Or take the free TRAIL Check — 60 seconds
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronDown className="h-6 w-6 text-stone-600" />
      </motion.div>
    </section>
  );
}
