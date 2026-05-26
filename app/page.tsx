'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Header,
  Footer,
  Hero,
  TrailJourney,
  TrailHowItWorks,
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
  // Phase 48 PR 3 (2026-05-26): IA partial re-sequence. Hero replaced with
  // the new Deep Cosmos hero; TrailHero / TrailProblem / TrailBridge /
  // TrailTestimonials dropped from rendering — they're v1 problem/anxiety
  // framing that doesn't match the wealth-builder ICP (Q-ICP-1 decided
  // 2026-05-24, see PHASE_48_PUBLIC_WEBSITE_REDESIGN.md §6.1). Their files
  // remain on disk for now; final delete happens in PR 4 once the new
  // section primitives (Proof Strip + One Picture + Five Capabilities)
  // confirm the visual replacement is working. TrailJourney + TrailHowItWorks
  // + TrailCTA kept as transitional placeholders until PR 4-5 replaces them.
  return (
    <div className="flex min-h-screen flex-col bg-cosmos">
      <Header />
      <main className="flex-1">
        <Hero />
        <TrailJourney />
        <TrailHowItWorks />
        <TrailCTA />
      </main>
      <Footer />
    </div>
  );
}
