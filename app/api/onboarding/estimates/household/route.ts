/**
 * POST /api/onboarding/estimates/household — Phase 12 Track B (B.3)
 *
 * Thin route wrapper per CLAUDE.md §12.3. All logic in
 * `lib/services/onboardingEstimateService.ts`.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { upsertHouseholdEstimate } from '@/lib/services/onboardingEstimateService';

export const POST = withPermission('settings.write', async (request, auth) => {
  const startedAt = Date.now();
  try {
    const body = await request.json();
    const option = body?.option;
    if (option !== 'SELF' && option !== 'PARTNER' && option !== 'FAMILY') {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'option must be SELF | PARTNER | FAMILY', details: null },
          meta: { timestamp: new Date().toISOString(), durationMs: Date.now() - startedAt },
        },
        { status: 400 }
      );
    }

    await upsertHouseholdEstimate(auth.userId, { option });

    return NextResponse.json({
      success: true,
      data: { ok: true },
      error: null,
      meta: { timestamp: new Date().toISOString(), durationMs: Date.now() - startedAt },
    });
  } catch (error) {
    console.error('POST /api/onboarding/estimates/household failed:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'ONBOARDING_HOUSEHOLD_FAILED', message: 'Could not save household', details: null },
        meta: { timestamp: new Date().toISOString(), durationMs: Date.now() - startedAt },
      },
      { status: 500 }
    );
  }
});
