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
  TrailCTA,
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
  // Phase 48 PR 4 (2026-05-26): IA largely complete. New section primitives
  // (ProofStrip / OnePicture / FiveCapabilities / HowItWorks) replace the
  // v1 TrailJourney + TrailHowItWorks. Only TrailCTA remains as a
  // transitional placeholder until PR 5 replaces it with the new Pricing +
  // FAQ + Final CTA family. All v1 problem-framing / bridge / testimonials
  // components have been deleted (no consumers).
  return (
    <div className="flex min-h-screen flex-col bg-cosmos">
      <Header />
      <main className="flex-1">
        <Hero />
        <ProofStrip />
        <OnePicture />
        <FiveCapabilities />
        <HowItWorks />
        <TrailCTA />
      </main>
      <Footer />
    </div>
  );
}
