'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import {
  Header,
  Footer,
  Hero,
  SocialProof,
  ValuePillars,
  FeatureGrid,
  ForecastSection,
  Testimonials,
  SecuritySection,
} from '@/components/marketing';

export default function LandingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If authenticated, show nothing while redirecting
  if (user) {
    return null;
  }

  // Show landing page for unauthenticated users
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <SocialProof />
        <ValuePillars />
        <FeatureGrid />
        <ForecastSection />
        <Testimonials />
        <SecuritySection />
      </main>
      <Footer />
    </div>
  );
}
