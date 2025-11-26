/**
 * PREFERENCES API ENDPOINT
 * Phase 11 - Stage 7: UI Components
 *
 * GET /api/strategy/preferences - Get user strategy preferences
 * PUT /api/strategy/preferences - Update user strategy preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';

// =============================================================================
// GET - Fetch User Preferences
// =============================================================================

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;

      // Fetch user strategy session (preferences)
      const session = await prisma.strategySession.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });

      // If no session exists, return defaults
      if (!session) {
        return NextResponse.json({
          success: true,
          data: {
            riskAppetite: 'MODERATE',
            debtComfort: 'MODERATE',
            timeHorizon: 30,
            retirementAge: 65,
            investmentStyle: 'BALANCED',
            scenarioType: 'DEFAULT',
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: session,
      });
    } catch (error) {
      console.error('[PreferencesAPI] Error fetching preferences:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch preferences',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// PUT - Update User Preferences
// =============================================================================

export async function PUT(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;
      const body = await request.json();

      // Validate required fields
      const {
        riskAppetite,
        debtComfort,
        timeHorizon,
        retirementAge,
        investmentStyle,
        scenarioType = 'DEFAULT',
      } = body;

      // Validate enums
      if (!['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'].includes(riskAppetite)) {
        return NextResponse.json(
          { error: 'Invalid risk appetite value' },
          { status: 400 }
        );
      }

      if (!['LOW', 'MODERATE', 'HIGH'].includes(debtComfort)) {
        return NextResponse.json(
          { error: 'Invalid debt comfort value' },
          { status: 400 }
        );
      }

      if (!['PASSIVE', 'BALANCED', 'ACTIVE'].includes(investmentStyle)) {
        return NextResponse.json(
          { error: 'Invalid investment style value' },
          { status: 400 }
        );
      }

      // Validate numeric ranges
      if (timeHorizon < 1 || timeHorizon > 50) {
        return NextResponse.json(
          { error: 'Time horizon must be between 1 and 50 years' },
          { status: 400 }
        );
      }

      if (retirementAge < 50 || retirementAge > 80) {
        return NextResponse.json(
          { error: 'Retirement age must be between 50 and 80' },
          { status: 400 }
        );
      }

      // Find existing session or create new
      const existingSession = await prisma.strategySession.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });

      let session;
      if (existingSession) {
        // Update existing session
        session = await prisma.strategySession.update({
          where: { id: existingSession.id },
          data: {
            riskAppetite,
            debtComfort,
            timeHorizon,
            retirementAge,
            investmentStyle,
            scenarioType,
          },
        });
      } else {
        // Create new session
        session = await prisma.strategySession.create({
          data: {
            userId,
            riskAppetite,
            debtComfort,
            timeHorizon,
            retirementAge,
            investmentStyle,
            scenarioType,
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: session,
      });
    } catch (error) {
      console.error('[PreferencesAPI] Error updating preferences:', error);
      return NextResponse.json(
        {
          error: 'Failed to update preferences',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
