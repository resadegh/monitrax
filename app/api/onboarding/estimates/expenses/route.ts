/**
 * POST /api/onboarding/estimates/expenses — Phase 12 Track B (B.6)
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { upsertExpensesEstimate } from '@/lib/services/onboardingEstimateService';

export const POST = withPermission('settings.write', async (request, auth) => {
  const startedAt = Date.now();
  try {
    const body = await request.json();
    const monthlyAmount = Number(body?.monthlyAmount);
    if (!Number.isFinite(monthlyAmount) || monthlyAmount < 0) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'monthlyAmount must be a non-negative number', details: null },
          meta: { timestamp: new Date().toISOString(), durationMs: Date.now() - startedAt },
        },
        { status: 400 }
      );
    }

    await upsertExpensesEstimate(auth.userId, { monthlyAmount });

    return NextResponse.json({
      success: true,
      data: { ok: true },
      error: null,
      meta: { timestamp: new Date().toISOString(), durationMs: Date.now() - startedAt },
    });
  } catch (error) {
    console.error('POST /api/onboarding/estimates/expenses failed:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'ONBOARDING_EXPENSES_FAILED', message: 'Could not save expenses', details: null },
        meta: { timestamp: new Date().toISOString(), durationMs: Date.now() - startedAt },
      },
      { status: 500 }
    );
  }
});
