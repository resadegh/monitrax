/**
 * FINANCIAL HEALTH ENGINE API
 * Phase 12 - GET /api/financial-health
 *
 * Returns the complete Financial Health Report including:
 * - Health Score (0-100)
 * - Category breakdowns
 * - Risk signals
 * - Improvement actions
 * - Evidence pack for explainability
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  generateHealthReport,
  quickHealthCheck,
  scoreToRiskBand,
  buildHealthInput,
} from '@/lib/health';
import { recordHealthScoreSnapshot } from '@/lib/services/healthScoreSnapshotRecorder';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

/**
 * GET /api/financial-health
 *
 * Query params:
 * - quick: boolean - If true, returns only the score without full report
 *
 * Returns:
 * - Full FinancialHealthReport or quick score summary
 */
export const GET = withPermission('report.read', async (request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_CFO');
    if (gateBlocked) return gateBlocked;
    try {
      const userId = auth.userId;
      const { searchParams } = new URL(request.url);
      const quickMode = searchParams.get('quick') === 'true';

      // Build input from database
      const input = await buildHealthInput(userId);

      if (quickMode) {
        // Return quick score only
        const result = quickHealthCheck(input);
        return NextResponse.json({
          success: true,
          data: {
            score: result.score,
            riskBand: result.riskBand,
            confidence: result.confidence,
            generatedAt: new Date().toISOString(),
          },
        });
      }

      // Generate full report
      const report = generateHealthReport(input);

      // MON-134: freeze this month's real score once (write-once per month;
      // P2002 no-op afterwards). Fire-and-forget — never blocks the response
      // (§12.10). The trend reads these stored rows on future requests.
      recordHealthScoreSnapshot({
        userId,
        score: report.healthScore.score,
        riskBand: scoreToRiskBand(report.healthScore.score),
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        data: {
          // Core health score
          healthScore: {
            score: report.healthScore.score,
            confidence: report.healthScore.confidence,
            riskBand: scoreToRiskBand(report.healthScore.score),
            trend: report.healthScore.trend,
          },

          // Category breakdown
          categories: report.categories.map((c) => ({
            name: c.name,
            score: c.score,
            weight: c.weight,
            riskBand: c.riskBand,
            contributingMetrics: c.contributingMetrics,
          })),

          // Risk signals (sorted by severity)
          riskSignals: report.riskSignals.map((r) => ({
            id: r.id,
            category: r.category,
            severity: r.severity,
            title: r.title,
            description: r.description,
            tier: r.tier,
            evidence: r.evidence,
          })),

          // Improvement actions (top 10)
          improvementActions: report.improvementActions.map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            category: a.category,
            difficulty: a.difficulty,
            impact: a.impact,
            priority: a.priority,
          })),

          // Score modifiers (for transparency)
          modifiers: report.modifiers,

          // Evidence pack (for explainability)
          evidence: {
            inputsUsed: report.evidence.inputsUsed.length,
            confidenceLevel: report.evidence.confidenceLevel,
            insightsLinked: report.evidence.insightsLinked.length,
            riskMap: report.evidence.riskMap,
            lastUpdated: report.evidence.lastUpdated,
          },

          // Metadata
          generatedAt: report.generatedAt.toISOString(),
          userId: report.userId,
        },
      });
    } catch (error) {
      console.error('Financial health API error:', error);
      const errorMessage = error instanceof Error
        ? `${error.message}\n${error.stack}`
        : 'Unknown error';
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate financial health report',
          details: errorMessage,
        },
        { status: 500 }
      );
    }
});
