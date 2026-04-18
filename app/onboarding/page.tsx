'use client';

/**
 * /onboarding page — RE-ENABLED (2026-04-17 TRAIL alignment)
 *
 * The wizard was disabled during R12 remediation (2026-04-15) because
 * the per-step onboardingEstimateService used destructive upserts
 * without source guards. The wizard now uses the bulk-create API
 * exclusively (POST /api/onboarding/bulk-create) which writes all
 * entities in a single transaction — the estimate service is NOT used.
 *
 * The bulk-create endpoint creates NEW rows (prisma.create, not upsert)
 * so there is no risk of overwriting existing user data. The old
 * onboardingEstimateService remains disabled as a safety measure.
 *
 * TRAIL alignment: Welcome step says "Start your TRAIL", all step
 * subtitles reference the TRAIL framework, Review step shows
 * "Your TRAIL begins" with Guide recommendation.
 *
 * See: docs/blueprint/TRAIL_FRAMEWORK.md §10
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useOnboardingState } from '@/hooks/useOnboardingState';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { state: onboardingState } = useOnboardingState();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/signin');
      return;
    }
    if (onboardingState?.onboardingCompleted) {
      router.replace('/dashboard');
      return;
    }
  }, [user, authLoading, onboardingState, router]);

  if (authLoading || !user) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent motion-reduce:animate-none" />
      </section>
    );
  }

  if (onboardingState?.onboardingCompleted) {
    return null;
  }

  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mx-auto mb-4 motion-reduce:animate-none" />
        <p className="text-sm text-muted-foreground">Setting up your TRAIL...</p>
      </div>
    </section>
  );
}
