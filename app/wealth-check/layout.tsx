import type { Metadata } from 'next';

/**
 * Phase 46 — /wealth-check route metadata.
 *
 * `robots: noindex, nofollow` until traffic-on gates land (PHASE_46 §10):
 *   - Gate B: friendlies cohort showing positive retention signal
 *   - Gate C: lawyer pass on result-page copy (Q-HOOK-AFSL)
 *
 * After both gates close, this file is the one place to flip the robots
 * directive — the page component doesn't need to change.
 */
export const metadata: Metadata = {
  title: 'Wealth Check — Monitrax',
  description:
    'Three questions, thirty seconds, a specific answer in dollars. The Australian wealth-check, powered by Monitrax.',
  robots: { index: false, follow: false },
};

export default function WealthCheckLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
