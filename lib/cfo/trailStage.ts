/**
 * TRAIL Stage Detection & Action Mapping
 *
 * Determines a user's current TRAIL stage from their financial data
 * and maps Guide actions to the appropriate stage for prioritisation.
 *
 * Stages: T(Track) → R(Reduce) → A(Anchor) → I(Invest) → L(Live)
 *
 * See: docs/blueprint/TRAIL_FRAMEWORK.md §8
 */

export type TrailStage = 'T' | 'R' | 'A' | 'I' | 'L';

export interface TrailStageInfo {
  letter: TrailStage;
  name: string;
  tagline: string;
  focusAreas: string[];
}

const TRAIL_STAGES: Record<TrailStage, TrailStageInfo> = {
  T: {
    letter: 'T',
    name: 'Track',
    tagline: 'See your full picture',
    focusAreas: ['Connect your bank accounts', 'See all your income and spending', 'Know your net worth'],
  },
  R: {
    letter: 'R',
    name: 'Reduce',
    tagline: 'Fix the leaks',
    focusAreas: ['Set a budget', 'Cut unnecessary spending', 'Start your debt paydown plan'],
  },
  A: {
    letter: 'A',
    name: 'Anchor',
    tagline: 'Build your safety net',
    focusAreas: ['Build emergency fund to 3 months', 'Keep all bills on time', 'Stop taking on new debt'],
  },
  I: {
    letter: 'I',
    name: 'Invest',
    tagline: 'Grow your wealth',
    focusAreas: ['Grow your investment portfolio', 'Track property equity', 'Boost super to 15%'],
  },
  L: {
    letter: 'L',
    name: 'Live',
    tagline: 'On your terms',
    focusAreas: ['Optimise tax position', 'Track passive income growth', 'Plan for financial independence'],
  },
};

export function getTrailStageInfo(stage: TrailStage): TrailStageInfo {
  return TRAIL_STAGES[stage];
}

export interface TrailStageInput {
  hasAccounts: boolean;
  monthlyCashflow: number;
  emergencyFundMonths: number;
  hasInvestments: boolean;
  healthScore: number;
}

export function determineTrailStage(input: TrailStageInput): TrailStage {
  if (!input.hasAccounts) return 'T';
  if (input.monthlyCashflow <= 0) return 'R';
  if (input.emergencyFundMonths < 3) return 'A';
  if (!input.hasInvestments || input.healthScore < 75) return 'I';
  return 'L';
}

const CATEGORY_TO_TRAIL: Record<string, TrailStage> = {
  cashflow: 'R',
  spending: 'R',
  debt: 'R',
  savings: 'A',
  property: 'I',
  investment: 'I',
  tax: 'I',
};

export function actionCategoryToTrailStage(category: string): TrailStage {
  return CATEGORY_TO_TRAIL[category] || 'R';
}

export function isActionRelevantToStage(actionCategory: string, userStage: TrailStage): boolean {
  const actionStage = actionCategoryToTrailStage(actionCategory);
  const stageOrder: TrailStage[] = ['T', 'R', 'A', 'I', 'L'];
  const userIdx = stageOrder.indexOf(userStage);
  const actionIdx = stageOrder.indexOf(actionStage);
  // Show actions for current stage and one stage ahead
  return actionIdx >= userIdx - 1 && actionIdx <= userIdx + 1;
}
