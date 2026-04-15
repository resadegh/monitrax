/**
 * Onboarding Estimate Service — Phase 12 Track B (B.3-B.8)
 *
 * Canonical service for every write the /onboarding wizard makes.
 * Every row written through this service gets `source: 'ONBOARDING'`
 * so the /dashboard/setup refinement UI can later distinguish
 * estimated data from verified.
 *
 * Architecture per CLAUDE.md §12.3:
 *   - API route handlers are thin wrappers that validate input and
 *     call these functions.
 *   - All Prisma writes live here.
 *   - Idempotency: the wizard may call the same upsert function
 *     twice (e.g. user goes back + re-submits), so each function
 *     upserts on a stable natural key instead of create-only.
 *   - Audit: every call emits `createAuditLog({ action:
 *     'ONBOARDING_STEP_COMPLETED' })` with sanitized metadata
 *     (step name only, no CDR data).
 *
 * See docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md §5.5.
 */

import prisma from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';

// =============================================================================
// INPUT TYPES
// =============================================================================

export type HouseholdOption = 'SELF' | 'PARTNER' | 'FAMILY';

export interface HouseholdEstimateInput {
  option: HouseholdOption;
  hasSharedFinances?: boolean;
}

export type IncomeFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL';

export interface IncomeEstimateInput {
  monthlyAmount: number;
}

export type HousingSituation = 'OWN' | 'RENT' | 'FAMILY';

export interface HousingEstimateInput {
  situation: HousingSituation;
}

export interface ExpensesEstimateInput {
  monthlyAmount: number;
}

export type FinancialGoal = 'SAVE' | 'REDUCE_DEBT' | 'GROW_WEALTH';

export interface GoalEstimateInput {
  goal: FinancialGoal;
}

// =============================================================================
// SERVICE HELPERS
// =============================================================================

/**
 * Fire-and-forget audit log emission. Never blocks the response.
 * Sanitized metadata — no amounts, no balances, no identifiers
 * beyond the step name.
 */
function auditStep(userId: string, step: string): void {
  createAuditLog({
    userId,
    action: 'ONBOARDING_STEP_COMPLETED',
    entityType: 'onboarding',
    metadata: { step },
  }).catch(() => {
    // Audit failures never block onboarding progress.
  });
}

// =============================================================================
// B.3 HOUSEHOLD
// =============================================================================

/**
 * Upserts the user's HouseholdProfile based on the 3-option picker.
 * Maps the onboarding option to the existing Prisma fields:
 *   - SELF    → adultsCount=1, childrenCount=0
 *   - PARTNER → adultsCount=2, childrenCount=0
 *   - FAMILY  → adultsCount=2, childrenCount=1 (rough seed; user can refine)
 *
 * Always writes `source: 'ONBOARDING'` so the setup page can show
 * the Estimated badge.
 */
export async function upsertHouseholdEstimate(
  userId: string,
  input: HouseholdEstimateInput
): Promise<void> {
  const counts = optionToCounts(input.option);
  await prisma.householdProfile.upsert({
    where: { userId },
    create: {
      userId,
      adultsCount: counts.adults,
      childrenCount: counts.children,
      source: 'ONBOARDING',
    },
    update: {
      adultsCount: counts.adults,
      childrenCount: counts.children,
      source: 'ONBOARDING',
    },
  });
  auditStep(userId, 'household');
}

function optionToCounts(option: HouseholdOption): {
  adults: number;
  children: number;
} {
  switch (option) {
    case 'SELF':
      return { adults: 1, children: 0 };
    case 'PARTNER':
      return { adults: 2, children: 0 };
    case 'FAMILY':
      return { adults: 2, children: 1 };
  }
}

// =============================================================================
// B.4 INCOME
// =============================================================================

/**
 * Creates OR updates an estimated monthly income row.
 * Idempotent: if a row with source=ONBOARDING and name="Estimated
 * monthly income" already exists for this user, we update its
 * amount instead of creating a duplicate.
 */
export async function upsertIncomeEstimate(
  userId: string,
  input: IncomeEstimateInput
): Promise<void> {
  const existing = await prisma.income.findFirst({
    where: {
      userId,
      source: 'ONBOARDING',
      name: 'Estimated monthly income',
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.income.update({
      where: { id: existing.id },
      data: { amount: input.monthlyAmount },
    });
  } else {
    await prisma.income.create({
      data: {
        userId,
        name: 'Estimated monthly income',
        type: 'SALARY',
        sourceType: 'GENERAL',
        amount: input.monthlyAmount,
        frequency: 'MONTHLY',
        source: 'ONBOARDING',
      },
    });
  }
  auditStep(userId, 'income');
}

// =============================================================================
// B.5 HOUSING
// =============================================================================

/**
 * Housing situation is stored on the HouseholdProfile via the
 * `source` tag + audit metadata. We don't create a separate record
 * here; the information is used later by /dashboard/setup to decide
 * whether to prompt for rent-as-expense or mortgage.
 *
 * For now we just audit the choice — no schema field for housing
 * exists on HouseholdProfile today. A follow-up can add one if
 * needed.
 */
export async function upsertHousingEstimate(
  userId: string,
  input: HousingEstimateInput
): Promise<void> {
  // Ensure a HouseholdProfile exists so source stays ONBOARDING.
  await prisma.householdProfile.upsert({
    where: { userId },
    create: { userId, source: 'ONBOARDING' },
    update: { source: 'ONBOARDING' },
  });
  auditStep(userId, `housing:${input.situation}`);
}

// =============================================================================
// B.6 EXPENSES
// =============================================================================

/**
 * Creates OR updates an estimated monthly expenses row.
 * Same idempotency pattern as income.
 */
export async function upsertExpensesEstimate(
  userId: string,
  input: ExpensesEstimateInput
): Promise<void> {
  const existing = await prisma.expense.findFirst({
    where: {
      userId,
      source: 'ONBOARDING',
      name: 'Estimated monthly expenses',
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.expense.update({
      where: { id: existing.id },
      data: { amount: input.monthlyAmount },
    });
  } else {
    await prisma.expense.create({
      data: {
        userId,
        name: 'Estimated monthly expenses',
        category: 'OTHER',
        sourceType: 'GENERAL',
        amount: input.monthlyAmount,
        frequency: 'MONTHLY',
        isEssential: true,
        isTaxDeductible: false,
        isRecurring: true,
        source: 'ONBOARDING',
      },
    });
  }
  auditStep(userId, 'expenses');
}

// =============================================================================
// B.7 GOAL
// =============================================================================

/**
 * The goal is metadata, not a financial row. We audit it so future
 * analytics can segment users by stated intent, but we don't create
 * a Prisma record — there's no schema for user goals today.
 */
export async function upsertGoalEstimate(
  userId: string,
  input: GoalEstimateInput
): Promise<void> {
  auditStep(userId, `goal:${input.goal}`);
}

// =============================================================================
// B.8 FINAL REVEAL — read-only snapshot pass-through
// =============================================================================

// The Final Reveal step calls getMasterFinancialSnapshot() directly
// via a thin API route. No write function needed here.
