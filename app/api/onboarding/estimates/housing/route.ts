/**
 * POST /api/onboarding/estimates/housing — Phase 12 Track B (B.5)
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { upsertHousingEstimate } from '@/lib/services/onboardingEstimateService';

export const POST = withPermission('settings.write', async (request, auth) => {
  const startedAt = Date.now();
  try {
    const body = await request.json();
    const situation = body?.situation;
    if (situation !== 'OWN' && situation !== 'RENT' && situation !== 'FAMILY') {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'situation must be OWN | RENT | FAMILY', details: null },
          meta: { timestamp: new Date().toISOString(), durationMs: Date.now() - startedAt },
        },
        { status: 400 }
      );
    }

    await upsertHousingEstimate(auth.userId, { situation });

    return NextResponse.json({
      success: true,
      data: { ok: true },
      error: null,
      meta: { timestamp: new Date().toISOString(), durationMs: Date.now() - startedAt },
    });
  } catch (error) {
    console.error('POST /api/onboarding/estimates/housing failed:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'ONBOARDING_HOUSING_FAILED', message: 'Could not save housing', details: null },
        meta: { timestamp: new Date().toISOString(), durationMs: Date.now() - startedAt },
      },
      { status: 500 }
    );
  }
});
