/**
 * BUDGET ANALYSIS GENERATE API
 * POST /api/budget-analysis/generate - Generate AI-powered budget analysis
 *
 * Phase 28: Realistic Budget Integration
 *
 * MON-125 (VR-040): this route was the FOURTH uncanonical expense producer —
 * it annualised one-off expenses forever (raw `toMonthly`, no one-off gate)
 * and costed interest-only loans at $0 (raw `minRepayment`), recommending a
 * budget of $62,530/mo against $41,303/mo income. All money now flows through
 * the canonical producers:
 *   - expenses: `monthlyRunRate()` (the MON-082 one-off gate) over RECURRING
 *     rows only — the same basis the /dashboard/expenses page prints as
 *     "Total outgoings" (one-offs are counted once, never as a run-rate);
 *   - loans: `resolveLoanCostsForUser()` → the ONE actuals-first resolver
 *     (linked repayments → declared minRepayment → interest floor; an
 *     interest-only loan can never silently cost $0);
 *   - income sanity: `quickMetrics.monthlyIncome` from the master snapshot —
 *     a recommended budget above net income carries an explicit flag rather
 *     than being silently recommended.
 * Each loan line carries its resolution `basis` so the surface can label it
 * (the Expenses-page pattern). GENERATOR_VERSION invalidates pre-fix cached
 * analyses (their AI estimate was anchored on the contaminated committed).
 *
 * This endpoint:
 * 1. Fetches user's household profile
 * 2. Fetches user's recurring expenses
 * 3. Calls Gemini AI to estimate variable expenses (excluding tracked ones)
 * 4. Stores the analysis in the database
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { monthlyRunRate } from '@/lib/utils/frequencies';
import { resolveLoanCostsForUser, type ResolvedLoanCost } from '@/lib/services/loanCosts';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import {
  isGeminiConfigured,
  generateGeminiJSONCompletion,
  GEMINI_MODELS,
} from '@/lib/ai/google';
import {
  VARIABLE_EXPENSE_ESTIMATION_PROMPT,
  buildVariableExpensePrompt,
  validateVariableExpenseResponse,
  groundVariableExpenseTotal,
  calculateBenchmarkExpenses,
} from '@/lib/budget-analysis/aiPrompt';
import { VariableExpenseResponse } from '@/lib/budget-analysis/types';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

// MON-125: bump when the money basis changes — a cached analysis generated
// under an older basis is invalid (its AI estimate was anchored on the old
// committed figure) and must be regenerated, never served.
const GENERATOR_VERSION = 2;

/** The Expenses-page basis label for a resolved loan cost (MON-125 §4e). */
function loanBasisLabel(cost: ResolvedLoanCost): string {
  if (cost.usedActuals) return 'from linked repayments';
  if (cost.flooredToInterest) return 'interest cost (no repayment linked or set)';
  return 'declared repayment';
}

// =============================================================================
// API Handler
// =============================================================================

export const POST = withPermission('expense.write', async (request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_HOUSEHOLD', auth.userId);
    if (gateBlocked) return gateBlocked;
    try {
      const userId = auth.userId;
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

        // MON-125 §4d: a cached analysis from an older generator was computed
        // on the contaminated basis (one-offs annualised, IO loans at $0) and
        // its AI variable estimate is anchored on that wrong number —
        // regenerate instead of serving it.
        const cachedVersion =
          (existingAnalysis?.recurringBreakdown as { generatorVersion?: number } | null)
            ?.generatorVersion ?? 1;

        if (existingAnalysis && cachedVersion >= GENERATOR_VERSION) {
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

      // 3. Fetch expenses on the RECURRING basis (MON-125): a budget is a
      // forward-looking run-rate; a one-off is counted once on /dashboard/
      // expenses, never annualised into "must pay forever". `monthlyRunRate`
      // is the ONE gated converter — it returns 0 for a one-off — and the
      // row filter keeps zero-cost one-off lines out of the breakdown lists.
      const allExpenses = await prisma.expense.findMany({
        where: { userId },
      });
      const recurringRows = allExpenses.filter(
        (e: typeof allExpenses[0]) => e.isRecurring !== false,
      );

      // 3a. Loans through THE canonical actuals-first resolver (MON-125):
      // linked repayments → declared minRepayment → interest floor. Raw
      // `minRepayment` printed $0/mo for interest-only loans ($3,709/mo of
      // real interest missing from "Committed").
      const loans = await prisma.loan.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          principal: true,
          interestRateAnnual: true,
          minRepayment: true,
          repaymentFrequency: true,
        },
      });
      const loanCosts = await resolveLoanCostsForUser(userId, loans);
      const loanRepaymentsMonthly = loans.reduce( // @source-lock-allowed: sums the CANONICAL resolver's outputs (resolveLoanCostsForUser), never raw rows — the same reduce totalLoanMonthlyCost() performs

        (sum: number, loan: typeof loans[0]) => sum + (loanCosts.get(loan.id)?.monthly ?? 0),
        0,
      );

      // 3b. Separate ESSENTIAL (committed) vs DISCRETIONARY expenses
      // Essential = isEssential === true (bills, utilities, insurance - MUST pay)
      // Discretionary = isEssential === false (optional spending - can adjust)
      const essentialExpenses = recurringRows.filter((e: typeof allExpenses[0]) => e.isEssential === true);
      const discretionaryExpenses = recurringRows.filter((e: typeof allExpenses[0]) => e.isEssential !== true);

      // Map expenses for AI prompt (recurring rows only — the AI's variable
      // estimate must be anchored on the real run-rate, not the contaminated
      // one-offs-annualised figure; MON-125 §4d)
      const recurringExpenses = recurringRows.map((e: typeof allExpenses[0]) => ({
        name: e.name,
        category: e.category,
        monthlyAmount: monthlyRunRate(e),
        vendorName: e.vendorName,
        isEssential: e.isEssential,
      }));

      // Calculate totals — canonical one-off-gated run-rate only
      const essentialMonthly = essentialExpenses.reduce(
        (sum: number, e: typeof essentialExpenses[0]) => sum + monthlyRunRate(e),
        0
      );
      const discretionaryTrackedMonthly = discretionaryExpenses.reduce(
        (sum: number, e: typeof discretionaryExpenses[0]) => sum + monthlyRunRate(e),
        0
      );

      // COMMITTED = Essential expenses + Loan repayments (these MUST be paid)
      const committedMonthly = essentialMonthly + loanRepaymentsMonthly;

      // Total tracked (for AI context - what we already know about)
      const totalTrackedMonthly = essentialMonthly + discretionaryTrackedMonthly;

      // Group expenses by category AND type for breakdown (canonical basis:
      // recurring rows, monthlyRunRate amounts; loans carry their resolution
      // basis label — the Expenses-page pattern, MON-125 §4e)
      const committedBreakdown: Record<string, { total: number; items: Array<{ name: string; amount: number; frequency: string; monthlyAmount: number; type: 'expense' | 'loan'; basis?: string }> }> = {};
      const discretionaryBreakdown: Record<string, { total: number; items: Array<{ name: string; amount: number; frequency: string; monthlyAmount: number }> }> = {};

      // Add essential expenses to committed breakdown
      essentialExpenses.forEach((e: typeof essentialExpenses[0]) => {
        if (!committedBreakdown[e.category]) {
          committedBreakdown[e.category] = { total: 0, items: [] };
        }
        const monthlyAmount = monthlyRunRate(e);
        committedBreakdown[e.category].items.push({
          name: e.name,
          amount: e.amount,
          frequency: e.frequency,
          monthlyAmount,
          type: 'expense',
        });
        committedBreakdown[e.category].total += monthlyAmount;
      });

      // Add loans to committed breakdown under "Loan Repayments" — every loan
      // contributes its resolved cost (never silently $0 for interest-only).
      if (loans.length > 0) {
        committedBreakdown['Loan Repayments'] = { total: 0, items: [] };
        loans.forEach((loan: typeof loans[0]) => {
          const cost = loanCosts.get(loan.id);
          if (!cost) return;
          committedBreakdown['Loan Repayments'].items.push({
            name: loan.name,
            amount: cost.monthly,
            frequency: 'MONTHLY',
            monthlyAmount: cost.monthly,
            type: 'loan',
            basis: loanBasisLabel(cost),
          });
          committedBreakdown['Loan Repayments'].total += cost.monthly;
        });
      }

      // Add discretionary expenses to their breakdown
      discretionaryExpenses.forEach((e: typeof discretionaryExpenses[0]) => {
        if (!discretionaryBreakdown[e.category]) {
          discretionaryBreakdown[e.category] = { total: 0, items: [] };
        }
        const monthlyAmount = monthlyRunRate(e);
        discretionaryBreakdown[e.category].items.push({
          name: e.name,
          amount: e.amount,
          frequency: e.frequency,
          monthlyAmount,
        });
        discretionaryBreakdown[e.category].total += monthlyAmount;
      });

      // Legacy recurringBreakdown for backwards compatibility (recurring rows
      // grouped — same canonical basis as everything above)
      const recurringBreakdown: Record<string, { total: number; items: Array<{ name: string; amount: number; frequency: string; monthlyAmount: number }> }> = {};
      recurringRows.forEach((e: typeof allExpenses[0]) => {
        if (!recurringBreakdown[e.category]) {
          recurringBreakdown[e.category] = { total: 0, items: [] };
        }
        const monthlyAmount = monthlyRunRate(e);
        recurringBreakdown[e.category].items.push({
          name: e.name,
          amount: e.amount,
          frequency: e.frequency,
          monthlyAmount,
        });
        recurringBreakdown[e.category].total += monthlyAmount;
      });

      // MON-125 §4c: income sanity — the canonical monthly NET income from
      // the master snapshot. A recommended budget above net income is never
      // silently recommended; the response carries an explicit flag and the
      // surface states it.
      const snapshot = await getMasterFinancialSnapshot(userId);
      const monthlyNetIncome = snapshot.quickMetrics.monthlyIncome;
      const budgetExceedsIncome = (total: number) =>
        monthlyNetIncome > 0 && total > monthlyNetIncome;

      // The ONE breakdown blob builder (three persistence sites share it).
      // `finalTotal` null = the pending record, before the variable estimate
      // exists; the income flag is stamped once the total is known.
      const buildBreakdownBlob = (finalTotal: number | null) => ({
        generatorVersion: GENERATOR_VERSION,
        committedTotal: committedMonthly,
        committedBreakdown: { categories: committedBreakdown, total: committedMonthly },
        discretionaryTrackedTotal: discretionaryTrackedMonthly,
        discretionaryBreakdown: { categories: discretionaryBreakdown, total: discretionaryTrackedMonthly },
        loanRepaymentsTotal: loanRepaymentsMonthly,
        essentialExpensesTotal: essentialMonthly,
        ...(finalTotal !== null
          ? {
              incomeContext: {
                monthlyNetIncome,
                exceedsIncome: budgetExceedsIncome(finalTotal),
              },
            }
          : {}),
        // Legacy format for backwards compatibility
        categories: recurringBreakdown,
        total: totalTrackedMonthly,
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
              recurringExpensesTotal: committedMonthly, // Now stores COMMITTED (essential + loans)
              recurringBreakdown: buildBreakdownBlob(null) as any,
              aiVariableEstimate: 0,
              variableBreakdown: {} as any,
              totalRealisticBudget: committedMonthly, // Base is committed only
              userReportedTotal: totalTrackedMonthly,
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
            totalRecurringMonthly: totalTrackedMonthly,
          });

          const { data, usage } = await generateGeminiJSONCompletion<VariableExpenseResponse>({
            surface: 'budget-analysis',
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
            // Neobrain grounding (Phase C.2): the AI estimates per category, but
            // the headline total is recomputed deterministically as the sum of
            // those categories — so "Variable $X" always equals the sum of the
            // visible breakdown (never the AI's separately-stated, ±$50-tolerant
            // figure). See groundVariableExpenseTotal + CLAUDE.md §19 / Part 21.
            variableResponse = groundVariableExpenseTotal(data);
            usedAI = true;
          }

          aiUsage = usage;

          // Update analysis with results
          // Scenarios are now based on COMMITTED expenses:
          // - Minimum: Committed only (essential + loans)
          // - Recommended: Committed + tracked discretionary + modest variable
          // - Comfortable: Committed + tracked discretionary + full variable
          await prisma.budgetAnalysis.update({
            where: { id: pendingAnalysis.id },
            data: {
              status: 'READY',
              aiVariableEstimate: variableResponse.total,
              variableBreakdown: variableResponse as unknown as any,
              // MON-125 §4c: re-stamp the blob with the income flag now the
              // final total is known.
              recurringBreakdown: buildBreakdownBlob(
                committedMonthly + discretionaryTrackedMonthly + variableResponse.total,
              ) as any,
              // Total realistic = committed + tracked discretionary + AI variable
              totalRealisticBudget: committedMonthly + discretionaryTrackedMonthly + variableResponse.total,
              missingVariableExpenses: variableResponse.total,
              aiExplanation: variableResponse.explanation,
              aiConfidence: usedAI ? 0.75 : 0.5,
              // Override scenarios with corrected logic
              minimumScenario: {
                total: committedMonthly,
                description: 'Bare essentials only - committed expenses and loan repayments',
                breakdown: { committed: committedMonthly, discretionary: 0, variable: 0 },
              } as unknown as any,
              recommendedScenario: {
                total: committedMonthly + discretionaryTrackedMonthly + variableResponse.scenarios.recommended.total,
                description: 'Realistic for comfortable living - includes tracked discretionary and estimated variable',
                breakdown: {
                  committed: committedMonthly,
                  discretionary: discretionaryTrackedMonthly,
                  variable: variableResponse.scenarios.recommended.total,
                },
              } as unknown as any,
              comfortableScenario: {
                total: committedMonthly + discretionaryTrackedMonthly + variableResponse.scenarios.comfortable.total,
                description: 'More flexibility and quality - full discretionary budget plus comfortable variable',
                breakdown: {
                  committed: committedMonthly,
                  discretionary: discretionaryTrackedMonthly,
                  variable: variableResponse.scenarios.comfortable.total,
                },
              } as unknown as any,
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

      // Create analysis with benchmark data (using corrected committed/discretionary logic)
      const analysis = await prisma.budgetAnalysis.create({
        data: {
          userId,
          householdProfileId: householdProfile.id,
          status: 'READY',
          recurringExpensesTotal: committedMonthly, // Now stores COMMITTED (essential + loans)
          recurringBreakdown: buildBreakdownBlob(
            committedMonthly + discretionaryTrackedMonthly + variableResponse.total,
          ) as any,
          aiVariableEstimate: variableResponse.total,
          variableBreakdown: variableResponse as unknown as any,
          // Total realistic = committed + tracked discretionary + AI variable
          totalRealisticBudget: committedMonthly + discretionaryTrackedMonthly + variableResponse.total,
          userReportedTotal: totalTrackedMonthly,
          missingVariableExpenses: variableResponse.total,
          aiExplanation: variableResponse.explanation,
          aiConfidence: 0.5,  // Lower confidence for benchmarks
          // Corrected scenarios
          minimumScenario: {
            total: committedMonthly,
            description: 'Bare essentials only - committed expenses and loan repayments',
            breakdown: { committed: committedMonthly, discretionary: 0, variable: 0 },
          } as unknown as any,
          recommendedScenario: {
            total: committedMonthly + discretionaryTrackedMonthly + variableResponse.scenarios.recommended.total,
            description: 'Realistic for comfortable living - includes tracked discretionary and estimated variable',
            breakdown: {
              committed: committedMonthly,
              discretionary: discretionaryTrackedMonthly,
              variable: variableResponse.scenarios.recommended.total,
            },
          } as unknown as any,
          comfortableScenario: {
            total: committedMonthly + discretionaryTrackedMonthly + variableResponse.scenarios.comfortable.total,
            description: 'More flexibility and quality - full discretionary budget plus comfortable variable',
            breakdown: {
              committed: committedMonthly,
              discretionary: discretionaryTrackedMonthly,
              variable: variableResponse.scenarios.comfortable.total,
            },
          } as unknown as any,
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

// =============================================================================
// Helpers
// =============================================================================

function formatAnalysisResponse(analysis: any) {
  const breakdown = analysis.recurringBreakdown || {};

  return {
    id: analysis.id,
    analysisDate: analysis.analysisDate,
    status: analysis.status,

    // NEW: Properly separated committed vs discretionary
    committed: {
      total: breakdown.committedTotal || analysis.recurringExpensesTotal,
      essentialExpenses: breakdown.essentialExpensesTotal || 0,
      loanRepayments: breakdown.loanRepaymentsTotal || 0,
      breakdown: breakdown.committedBreakdown || null,
    },

    discretionaryTracked: {
      total: breakdown.discretionaryTrackedTotal || 0,
      breakdown: breakdown.discretionaryBreakdown || null,
    },

    // MON-125 §4c — a recommended budget above monthly net income announces
    // itself; null on pre-fix analyses (which the version gate regenerates).
    incomeSanity: breakdown.incomeContext || null,

    variable: {
      total: analysis.aiVariableEstimate,
      breakdown: analysis.variableBreakdown,
    },

    // Legacy format for backwards compatibility
    recurring: {
      total: breakdown.total || analysis.recurringExpensesTotal,
      breakdown: breakdown.categories ? { categories: breakdown.categories, total: breakdown.total } : analysis.recurringBreakdown,
    },

    totals: {
      // Committed = essential expenses + loan repayments (MUST pay)
      committedExpenses: breakdown.committedTotal || analysis.recurringExpensesTotal,
      // Discretionary tracked = optional spending already tracked
      discretionaryTracked: breakdown.discretionaryTrackedTotal || 0,
      // Variable = AI estimated untracked expenses
      variableExpenses: analysis.aiVariableEstimate,
      // Total realistic = committed + discretionary + variable
      totalRealisticBudget: analysis.totalRealisticBudget,
      // Legacy
      recurringExpenses: breakdown.total || analysis.recurringExpensesTotal,
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
