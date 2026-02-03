/**
 * Phase 29: User Categorization Settings API
 * GET /api/settings/categorization - Get user's categorization settings
 * PUT /api/settings/categorization - Update user's categorization settings
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { getLearningStats } from '@/lib/bank/aiLearning';

// =============================================================================
// GET - Get Settings
// =============================================================================

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;

      // Get user settings or return defaults
      const settings = await prisma.userCategorizationSettings.findUnique({
        where: { userId },
      });

      // Get learning statistics
      const learningStats = await getLearningStats(userId);

      // Default settings
      const defaultSettings = {
        autoAcceptThreshold: 0.90,
        reviewThreshold: 0.70,
        enableAI: true,
        learnFromConfirmations: true,
        applyLearningsGlobally: false,
        showConfidenceScores: true,
        showAIReasoning: true,
        defaultApplyToSimilar: true,
        notifyOnPendingReview: true,
        pendingReviewThreshold: 10,
      };

      return NextResponse.json({
        success: true,
        data: {
          settings: settings || defaultSettings,
          learningStats,
          thresholdExplanation: {
            autoAcceptThreshold: 'Transactions with confidence above this threshold will be automatically categorized without review',
            reviewThreshold: 'Transactions with confidence between this and auto-accept will be shown for quick review',
            belowReviewThreshold: 'Transactions below the review threshold require manual categorization',
          },
        },
      });
    } catch (error) {
      console.error('Error fetching categorization settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// PUT - Update Settings
// =============================================================================

interface UpdateSettingsRequest {
  autoAcceptThreshold?: number;
  reviewThreshold?: number;
  enableAI?: boolean;
  learnFromConfirmations?: boolean;
  applyLearningsGlobally?: boolean;
  showConfidenceScores?: boolean;
  showAIReasoning?: boolean;
  defaultApplyToSimilar?: boolean;
  notifyOnPendingReview?: boolean;
  pendingReviewThreshold?: number;
}

export async function PUT(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;
      const body: UpdateSettingsRequest = await request.json();

      // Validate thresholds
      if (body.autoAcceptThreshold !== undefined) {
        if (body.autoAcceptThreshold < 0.5 || body.autoAcceptThreshold > 1.0) {
          return NextResponse.json(
            { error: 'Auto-accept threshold must be between 0.5 and 1.0' },
            { status: 400 }
          );
        }
      }

      if (body.reviewThreshold !== undefined) {
        if (body.reviewThreshold < 0.3 || body.reviewThreshold > 0.95) {
          return NextResponse.json(
            { error: 'Review threshold must be between 0.3 and 0.95' },
            { status: 400 }
          );
        }
      }

      // Ensure review threshold is less than auto-accept
      const autoAccept = body.autoAcceptThreshold ?? 0.90;
      const review = body.reviewThreshold ?? 0.70;
      if (review >= autoAccept) {
        return NextResponse.json(
          { error: 'Review threshold must be less than auto-accept threshold' },
          { status: 400 }
        );
      }

      // Upsert settings
      const settings = await prisma.userCategorizationSettings.upsert({
        where: { userId },
        create: {
          userId,
          autoAcceptThreshold: body.autoAcceptThreshold ?? 0.90,
          reviewThreshold: body.reviewThreshold ?? 0.70,
          enableAI: body.enableAI ?? true,
          learnFromConfirmations: body.learnFromConfirmations ?? true,
          applyLearningsGlobally: body.applyLearningsGlobally ?? false,
          showConfidenceScores: body.showConfidenceScores ?? true,
          showAIReasoning: body.showAIReasoning ?? true,
          defaultApplyToSimilar: body.defaultApplyToSimilar ?? true,
          notifyOnPendingReview: body.notifyOnPendingReview ?? true,
          pendingReviewThreshold: body.pendingReviewThreshold ?? 10,
        },
        update: {
          ...(body.autoAcceptThreshold !== undefined && { autoAcceptThreshold: body.autoAcceptThreshold }),
          ...(body.reviewThreshold !== undefined && { reviewThreshold: body.reviewThreshold }),
          ...(body.enableAI !== undefined && { enableAI: body.enableAI }),
          ...(body.learnFromConfirmations !== undefined && { learnFromConfirmations: body.learnFromConfirmations }),
          ...(body.applyLearningsGlobally !== undefined && { applyLearningsGlobally: body.applyLearningsGlobally }),
          ...(body.showConfidenceScores !== undefined && { showConfidenceScores: body.showConfidenceScores }),
          ...(body.showAIReasoning !== undefined && { showAIReasoning: body.showAIReasoning }),
          ...(body.defaultApplyToSimilar !== undefined && { defaultApplyToSimilar: body.defaultApplyToSimilar }),
          ...(body.notifyOnPendingReview !== undefined && { notifyOnPendingReview: body.notifyOnPendingReview }),
          ...(body.pendingReviewThreshold !== undefined && { pendingReviewThreshold: body.pendingReviewThreshold }),
        },
      });

      return NextResponse.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error('Error updating categorization settings:', error);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }
  });
}
