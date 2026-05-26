'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Header,
  Footer,
  Hero,
  ProofStrip,
  OnePicture,
  FiveCapabilities,
  HowItWorks,
  FAQ,
  FinalCTA,
} from '@/components/marketing';

export default function LandingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Phase 48 PR 1 (2026-05-26): redirect authenticated users to /dashboard
  // AFTER first paint. The previous implementation gated the entire marketing
  // page behind an `if (isLoading) return <Loading />` block which forced
  // every cold visitor + every search-engine crawler + every social-preview
  // bot to see a "Loading..." spinner as the LCP — undermining the premium
  // first impression of the redesigned site. The redirect still happens on
  // every page load for authenticated users; it just happens via this
  // useEffect after React paints the marketing surface, instead of as a
  // pre-paint render gate. Auth functionality is unchanged.
  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  // Marketing page paints immediately. Authenticated users see it for a
  // single frame before the useEffect above redirects them — acceptable
  // tradeoff for LCP, and authenticated users typically arrive at
  // /dashboard directly anyway.
  // Phase 48 PR 5 (2026-05-26): landing page now fully Deep Cosmos canonical.
  // FAQ + FinalCTA ship in this PR, replacing the last v1 TrailCTA.
  // Pricing intentionally deferred to Phase 6 per IMPLEMENTATION_PLAN.md
  // §0e (Monetisation, decided 2026-05-12) — consumer pricing waits for
  // Basiq go-live, do not commit publicly to numbers that'll change.
  return (
    <div className="flex min-h-screen flex-col bg-cosmos">
      <Header />
      <main className="flex-1">
        <Hero />
        <ProofStrip />
        <OnePicture />
        <FiveCapabilities />
        <HowItWorks />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
