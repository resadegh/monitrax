/**
 * BUDGET ANALYSIS GENERATE API
 * POST /api/budget-analysis/generate - Generate AI-powered budget analysis
 *
 * Phase 28: Realistic Budget Integration
 *
 * This endpoint:
 * 1. Fetches user's household profile
 * 2. Fetches user's recurring expenses
 * 3. Calls Gemini AI to estimate variable expenses (excluding tracked ones)
 * 4. Stores the analysis in the database
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { toMonthly } from '@/lib/utils/frequencies';
import {
  isGeminiConfigured,
  generateGeminiJSONCompletion,
  GEMINI_MODELS,
} from '@/lib/ai/google';
import {
  VARIABLE_EXPENSE_ESTIMATION_PROMPT,
  buildVariableExpensePrompt,
  validateVariableExpenseResponse,
  calculateBenchmarkExpenses,
} from '@/lib/budget-analysis/aiPrompt';
import { VariableExpenseResponse } from '@/lib/budget-analysis/types';

// =============================================================================
// API Handler
// =============================================================================

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;
      const body = await request.json().catch(() => ({}));
      const forceRegenerate = body.forceRegenerate === true;

      console.log(`[API] Budget analysis generate request for user: ${userId}`);

      // 1. Check for existing recent analysis (unless force regenerate)
      if (!forceRegenerate) {
        const existingAnalysis = await prisma.budgetAnalysis.findFirst({
          where: {
            userId,
            status: { in: ['READY', 'CONFIRMED'] },
            analysisDate: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
          orderBy: { analysisDate: 'desc' },
        });

        if (existingAnalysis) {
          return NextResponse.json({
            success: true,
            data: formatAnalysisResponse(existingAnalysis),
            cached: true,
          });
        }
      }

      // 2. Fetch household profile
      const householdProfile = await prisma.householdProfile.findUnique({
        where: { userId },
      });

      if (!householdProfile || !householdProfile.isComplete) {
        return NextResponse.json(
          {
            success: false,
            error: 'Household profile incomplete',
            message: 'Please complete your household profile before generating budget analysis.',
          },
          { status: 400 }
        );
      }

      // 3. Fetch recurring expenses
      const expenses = await prisma.expense.findMany({
        where: { userId },
      });

      const recurringExpenses = expenses.map((e: typeof expenses[0]) => ({
        name: e.name,
        category: e.category,
        monthlyAmount: toMonthly(e.amount, e.frequency),
        vendorName: e.vendorName,
      }));

      const totalRecurringMonthly = recurringExpenses.reduce(
        (sum: number, e: typeof recurringExpenses[0]) => sum + e.monthlyAmount,
        0
      );

      // Group recurring by category for breakdown
      const recurringBreakdown: Record<string, { total: number; items: Array<{ name: string; amount: number; frequency: string; monthlyAmount: number }> }> = {};
      expenses.forEach((e: typeof expenses[0]) => {
        if (!recurringBreakdown[e.category]) {
          recurringBreakdown[e.category] = { total: 0, items: [] };
        }
        const monthlyAmount = toMonthly(e.amount, e.frequency);
        recurringBreakdown[e.category].items.push({
          name: e.name,
          amount: e.amount,
          frequency: e.frequency,
          monthlyAmount,
        });
        recurringBreakdown[e.category].total += monthlyAmount;
      });

      // 4. Generate variable expense estimates
      let variableResponse: VariableExpenseResponse;
      let aiUsage = null;
      let usedAI = false;

      const trackedCategories = new Set<string>(recurringExpenses.map((e: typeof recurringExpenses[0]) => e.category.toUpperCase()));

      if (isGeminiConfigured()) {
        try {
          console.log('[API] Generating AI variable expense estimates...');

          // Create pending analysis record
          const pendingAnalysis = await prisma.budgetAnalysis.create({
            data: {
              userId,
              householdProfileId: householdProfile.id,
              status: 'ANALYZING',
              recurringExpensesTotal: totalRecurringMonthly,
              recurringBreakdown: { categories: recurringBreakdown, total: totalRecurringMonthly } as any,
              aiVariableEstimate: 0,
              variableBreakdown: {} as any,
              totalRealisticBudget: totalRecurringMonthly,
              userReportedTotal: totalRecurringMonthly,
            },
          });

          const userPrompt = buildVariableExpensePrompt({
            householdProfile: {
              adultsCount: householdProfile.adultsCount,
              childrenCount: householdProfile.childrenCount,
              childrenAges: householdProfile.childrenAges,
              petsCount: householdProfile.petsCount,
              petTypes: householdProfile.petTypes,
              carsCount: householdProfile.carsCount,
              lifestylePreference: householdProfile.lifestylePreference as 'FRUGAL' | 'MODERATE' | 'COMFORTABLE',
              diningOutFrequency: householdProfile.diningOutFrequency as 'NEVER' | 'RARELY' | 'SOMETIMES' | 'OFTEN',
              hobbiesWithCosts: householdProfile.hobbiesWithCosts,
            },
            recurringExpenses,
            totalRecurringMonthly,
          });

          const { data, usage } = await generateGeminiJSONCompletion<VariableExpenseResponse>({
            model: GEMINI_MODELS.FINANCIAL_ADVISOR,
            systemPrompt: VARIABLE_EXPENSE_ESTIMATION_PROMPT,
            userPrompt,
            temperature: 0.5,  // Lower for more consistent estimates
            maxTokens: 3000,
          });

          // Validate response
          const validation = validateVariableExpenseResponse(data, recurringExpenses);
          if (validation.warnings.length > 0) {
            console.warn('[API] AI response warnings:', validation.warnings);
          }

          if (!validation.valid) {
            console.error('[API] AI response validation failed:', validation.errors);
            // Fall back to benchmarks
            variableResponse = calculateBenchmarkExpenses(
              {
                adultsCount: householdProfile.adultsCount,
                childrenCount: householdProfile.childrenCount,
                childrenAges: householdProfile.childrenAges,
                petsCount: householdProfile.petsCount,
                petTypes: householdProfile.petTypes,
                carsCount: householdProfile.carsCount,
                lifestylePreference: householdProfile.lifestylePreference as 'FRUGAL' | 'MODERATE' | 'COMFORTABLE',
              },
              trackedCategories
            );
          } else {
            variableResponse = data;
            usedAI = true;
          }

          aiUsage = usage;

          // Update analysis with results
          await prisma.budgetAnalysis.update({
            where: { id: pendingAnalysis.id },
            data: {
              status: 'READY',
              aiVariableEstimate: variableResponse.total,
              variableBreakdown: variableResponse as unknown as any,
              totalRealisticBudget: totalRecurringMonthly + variableResponse.total,
              missingVariableExpenses: variableResponse.total,
              aiExplanation: variableResponse.explanation,
              aiConfidence: usedAI ? 0.75 : 0.5,  // Lower confidence for benchmark fallback
              minimumScenario: variableResponse.scenarios.minimum as unknown as any,
              recommendedScenario: variableResponse.scenarios.recommended as unknown as any,
              comfortableScenario: variableResponse.scenarios.comfortable as unknown as any,
            },
          });

          // Fetch updated analysis
          const analysis = await prisma.budgetAnalysis.findUnique({
            where: { id: pendingAnalysis.id },
          });

          console.log(`[API] Budget analysis generated. Variable estimate: $${variableResponse.total}`);

          return NextResponse.json({
            success: true,
            data: formatAnalysisResponse(analysis!),
            usage: aiUsage,
            usedAI,
          });
        } catch (aiError) {
          console.error('[API] AI estimation failed, falling back to benchmarks:', aiError);
          // Fall through to benchmark calculation
        }
      }

      // 5. Fallback to benchmark-based estimation
      console.log('[API] Using benchmark-based estimation (AI unavailable or failed)');

      variableResponse = calculateBenchmarkExpenses(
        {
          adultsCount: householdProfile.adultsCount,
          childrenCount: householdProfile.childrenCount,
          childrenAges: householdProfile.childrenAges,
          petsCount: householdProfile.petsCount,
          petTypes: householdProfile.petTypes,
          carsCount: householdProfile.carsCount,
          lifestylePreference: householdProfile.lifestylePreference as 'FRUGAL' | 'MODERATE' | 'COMFORTABLE',
        },
        trackedCategories
      );

      // Create analysis with benchmark data
      const analysis = await prisma.budgetAnalysis.create({
        data: {
          userId,
          householdProfileId: householdProfile.id,
          status: 'READY',
          recurringExpensesTotal: totalRecurringMonthly,
          recurringBreakdown: { categories: recurringBreakdown, total: totalRecurringMonthly } as any,
          aiVariableEstimate: variableResponse.total,
          variableBreakdown: variableResponse as unknown as any,
          totalRealisticBudget: totalRecurringMonthly + variableResponse.total,
          userReportedTotal: totalRecurringMonthly,
          missingVariableExpenses: variableResponse.total,
          aiExplanation: variableResponse.explanation,
          aiConfidence: 0.5,  // Lower confidence for benchmarks
          minimumScenario: variableResponse.scenarios.minimum as unknown as any,
          recommendedScenario: variableResponse.scenarios.recommended as unknown as any,
          comfortableScenario: variableResponse.scenarios.comfortable as unknown as any,
        },
      });

      return NextResponse.json({
        success: true,
        data: formatAnalysisResponse(analysis),
        usedAI: false,
        fallbackReason: isGeminiConfigured() ? 'AI estimation failed' : 'AI not configured',
      });
    } catch (error) {
      console.error('[API] Budget analysis generate error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate budget analysis',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// Helpers
// =============================================================================

function formatAnalysisResponse(analysis: any) {
  return {
    id: analysis.id,
    analysisDate: analysis.analysisDate,
    status: analysis.status,

    recurring: {
      total: analysis.recurringExpensesTotal,
      breakdown: analysis.recurringBreakdown,
    },

    variable: {
      total: analysis.aiVariableEstimate,
      breakdown: analysis.variableBreakdown,
    },

    totals: {
      recurringExpenses: analysis.recurringExpensesTotal,
      variableExpenses: analysis.aiVariableEstimate,
      totalRealisticBudget: analysis.totalRealisticBudget,
      userReportedTotal: analysis.userReportedTotal,
      missingExpenses: analysis.missingVariableExpenses,
    },

    scenarios: {
      minimum: analysis.minimumScenario,
      recommended: analysis.recommendedScenario,
      comfortable: analysis.comfortableScenario,
    },

    aiExplanation: analysis.aiExplanation,
    aiConfidence: analysis.aiConfidence,

    userFinalBudget: analysis.userFinalBudget,
    userOverrodeAi: analysis.userOverrodeAi,
    userAdjustments: analysis.userAdjustments,
  };
}
