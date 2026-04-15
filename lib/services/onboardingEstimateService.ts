/**
 * Onboarding Estimate Service — Phase 12 Track B (B.3-B.8)
 *
 * ⚠ 2026-04-15: TEMPORARILY DISABLED pending Phase 12 A.0 schema
 * apply. Every write function throws a typed `OnboardingDisabledError`
 * so the route handlers can return a clean 503. This is defense in
 * depth — the five POST routes also refuse to call into the service
 * directly. See docs/quality/PHASE_12_DESIGN_AUDIT.md §11 R12 and
 * CLAUDE.md §12.11.
 *
 * Why disabled:
 *   1. Production DB has never been baselined with Prisma migrations
 *      (no `_prisma_migrations` table, see Q6 in the incident log).
 *   2. The `source` column + `EntrySource` enum never made it to
 *      prod, so the Prisma client generates SQL that crashes on
 *      every affected SELECT.
 *   3. The service's `upsertHouseholdEstimate` contained a
 *      destructive upsert that overwrites `HouseholdProfile.adultsCount`
 *      and `childrenCount` for any user who already had a configured
 *      household. This violates CLAUDE.md §12.11 and must ship with
 *      a §12.11 checklist before it goes live again.
 *
 * When re-enabling, the PR MUST:
 *   - Restore `source EntrySource @default(MANUAL)` on the 9 models
 *   - Guard every `upsert(...)` with a `source === 'ONBOARDING'`
 *     precondition per CLAUDE.md §12.11
 *   - Include the §12.11 checklist in the PR body
 *   - Be gated on a successful `prisma migrate deploy` against prod
 */

// =============================================================================
// INPUT TYPES — preserved so route handlers and callers still compile
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
// DISABLED SIGNAL
// =============================================================================

export class OnboardingDisabledError extends Error {
  readonly code = 'ONBOARDING_TEMPORARILY_DISABLED';
  constructor() {
    super(
      'The onboarding wizard is temporarily disabled while the ' +
        'Phase 12 schema migration is pending. Please use /dashboard/setup ' +
        'to enter your financial data directly.'
    );
    this.name = 'OnboardingDisabledError';
  }
}

function refuse(): never {
  throw new OnboardingDisabledError();
}

// =============================================================================
// DISABLED WRITE FUNCTIONS — all throw
// =============================================================================

export async function upsertHouseholdEstimate(
  _userId: string,
  _input: HouseholdEstimateInput
): Promise<void> {
  refuse();
}

export async function upsertIncomeEstimate(
  _userId: string,
  _input: IncomeEstimateInput
): Promise<void> {
  refuse();
}

export async function upsertHousingEstimate(
  _userId: string,
  _input: HousingEstimateInput
): Promise<void> {
  refuse();
}

export async function upsertExpensesEstimate(
  _userId: string,
  _input: ExpensesEstimateInput
): Promise<void> {
  refuse();
}

export async function upsertGoalEstimate(
  _userId: string,
  _input: GoalEstimateInput
): Promise<void> {
  refuse();
}
