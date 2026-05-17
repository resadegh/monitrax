/**
 * GET /api/feature-flags/conversational-onboarding
 *
 * Public read of the `CONVERSATIONAL_ONBOARDING` feature flag. Same
 * unauthenticated-read posture as `/api/feature-flags/basiq` — the
 * boolean isn't sensitive (consumers immediately render the toggle
 * or hide it based on the response).
 *
 * Response: `{ enabled: boolean }`. Defaults to `false` on any error.
 */

import { NextResponse } from 'next/server';
import { isConversationalOnboardingEnabled } from '@/lib/featureFlags/conversationalOnboardingGate';

export const dynamic = 'force-dynamic';

export async function GET() {
  const enabled = await isConversationalOnboardingEnabled();
  return NextResponse.json({ enabled });
}
