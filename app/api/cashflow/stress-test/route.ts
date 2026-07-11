/**
 * CASHFLOW STRESS TEST API
 * Phase 14 - GET/POST /api/cashflow/stress-test
 *
 * Run stress tests and what-if scenarios on cashflow projections.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  runStressTests,
  runCustomStressTest,
  getAvailableScenarios,
  createCustomScenario,
  StressParameters,
  StressScenario,
} from '@/lib/cashflow';
// MON-027: use the ONE shared CFE input builder (was copy-pasted here — the copy
// had drifted, counting transfers as cashflow and using PRE-tax income). The
// shared builder excludes transfers and uses after-tax income, so stress tests
// now forecast on the same basis as /cashflow.
import { buildCFEInput } from '@/lib/cashflow/buildCFEInput';

/**
 * GET /api/cashflow/stress-test
 *
 * Query params:
 * - scenarios: comma-separated scenario IDs (optional, runs all if not specified)
 *
 * Returns stress test results across predefined scenarios
 */
export const GET = withPermission('report.read', async (request, auth) => {
    try {
      const userId = auth.userId;
      const { searchParams } = new URL(request.url);
      const scenarioIds = searchParams.get('scenarios');

      // Build CFE input
      const cfeInput = await buildCFEInput(userId, 90);

      // Get available scenarios
      const allScenarios = getAvailableScenarios();

      // Filter scenarios if specified
      let scenariosToRun: StressScenario[] = allScenarios;
      if (scenarioIds) {
        const ids = scenarioIds.split(',').map((s) => s.trim());
        scenariosToRun = allScenarios.filter((s) => ids.includes(s.id));
      }

      // Run stress tests
      const results = await runStressTests(cfeInput, scenariosToRun);

      return NextResponse.json({
        success: true,
        data: {
          resilienceScore: results.resilienceScore,
          summary: results.summary,
          baselineResult: {
            scenarioId: results.baselineResult.scenarioId,
            scenarioName: results.baselineResult.scenarioName,
            survivalTime: results.baselineResult.survivalTime,
            maxShortfallAmount: results.baselineResult.maxShortfallAmount,
          },
          scenarioResults: results.scenarioResults.map((r) => ({
            scenarioId: r.scenarioId,
            scenarioName: r.scenarioName,
            survivalTime: r.survivalTime,
            maxShortfallAmount: r.maxShortfallAmount,
            balanceImpact: r.balanceImpact,
            shortfallDaysAdded: r.shortfallDaysAdded,
            requiredSavings: r.requiredSavings,
            requiredIncomeIncrease: r.requiredIncomeIncrease,
            mitigationStrategies: r.mitigationStrategies.slice(0, 5),
          })),
          availableScenarios: allScenarios.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            description: s.description,
          })),
          generatedAt: results.generatedAt,
        },
      });
    } catch (error) {
      console.error('Stress test API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to run stress tests',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
});

/**
 * POST /api/cashflow/stress-test
 *
 * Body:
 * {
 *   name?: string,
 *   description?: string,
 *   parameters: {
 *     incomeDropPercent?: number,
 *     incomeDropDuration?: number,
 *     expenseShockAmount?: number,
 *     interestRateIncrease?: number,
 *     expenseInflationPercent?: number
 *   }
 * }
 *
 * Run a custom stress test scenario
 */
export const POST = withPermission('report.read', async (request, auth) => {
    try {
      const userId = auth.userId;
      const body = await request.json();

      // Validate parameters
      const parameters: StressParameters = {
        incomeDropPercent: body.parameters?.incomeDropPercent,
        incomeDropDuration: body.parameters?.incomeDropDuration,
        expenseShockAmount: body.parameters?.expenseShockAmount,
        expenseShockDate: body.parameters?.expenseShockDate
          ? new Date(body.parameters.expenseShockDate)
          : undefined,
        expenseInflationPercent: body.parameters?.expenseInflationPercent,
        interestRateIncrease: body.parameters?.interestRateIncrease,
      };

      // Validate at least one parameter is set
      const hasParameter = Object.values(parameters).some(
        (v) => v !== undefined && v !== null
      );

      if (!hasParameter) {
        return NextResponse.json(
          {
            success: false,
            error: 'At least one stress parameter must be provided',
          },
          { status: 400 }
        );
      }

      // Build CFE input
      const cfeInput = await buildCFEInput(userId, 90);

      // Run custom stress test
      const result = await runCustomStressTest(cfeInput, parameters);

      return NextResponse.json({
        success: true,
        data: {
          scenarioId: result.scenarioId,
          scenarioName: body.name || result.scenarioName,
          description: body.description || `Custom scenario with parameters`,
          parameters,
          survivalTime: result.survivalTime,
          maxShortfallAmount: result.maxShortfallAmount,
          balanceImpact: result.balanceImpact,
          shortfallDaysAdded: result.shortfallDaysAdded,
          requiredSavings: result.requiredSavings,
          requiredIncomeIncrease: result.requiredIncomeIncrease,
          mitigationStrategies: result.mitigationStrategies,
          stressedForecast: result.stressedForecast.slice(0, 30).map((f) => ({
            date: f.date,
            predictedBalance: f.predictedBalance,
            shortfallRisk: f.shortfallRisk,
          })),
          generatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Custom stress test API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to run custom stress test',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
});
