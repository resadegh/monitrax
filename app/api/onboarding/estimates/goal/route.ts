/**
 * POST /api/onboarding/estimates/goal — Phase 12 Track B (B.7)
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { upsertGoalEstimate } from '@/lib/services/onboardingEstimateService';

export const POST = withPermission('settings.write', async (request, auth) => {
  const startedAt = Date.now();
  try {
    const body = await request.json();
    const goal = body?.goal;
    if (goal !== 'SAVE' && goal !== 'REDUCE_DEBT' && goal !== 'GROW_WEALTH') {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'goal must be SAVE | REDUCE_DEBT | GROW_WEALTH', details: null },
          meta: { timestamp: new Date().toISOString(), durationMs: Date.now() - startedAt },
        },
        { status: 400 }
      );
    }

    await upsertGoalEstimate(auth.userId, { goal });

    return NextResponse.json({
      success: true,
      data: { ok: true },
      error: null,
      meta: { timestamp: new Date().toISOString(), durationMs: Date.now() - startedAt },
    });
  } catch (error) {
    console.error('POST /api/onboarding/estimates/goal failed:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'ONBOARDING_GOAL_FAILED', message: 'Could not save goal', details: null },
        meta: { timestamp: new Date().toISOString(), durationMs: Date.now() - startedAt },
      },
      { status: 500 }
    );
  }
});
