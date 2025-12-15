/**
 * Phase 28: Realistic Budget Integration Types
 */

// =============================================================================
// Household Profile Types
// =============================================================================

export type LifestylePreference = 'FRUGAL' | 'MODERATE' | 'COMFORTABLE';
export type DiningFrequency = 'NEVER' | 'RARELY' | 'SOMETIMES' | 'OFTEN';
export type BudgetAnalysisStatus = 'PENDING' | 'ANALYZING' | 'READY' | 'CONFIRMED' | 'EXPIRED';

export interface HouseholdProfileInput {
  adultsCount: number;
  childrenCount: number;
  childrenAges: number[];
  petsCount: number;
  petTypes: string[];
  carsCount: number;
  lifestylePreference: LifestylePreference;
  diningOutFrequency: DiningFrequency;
  hobbiesWithCosts?: string | null;
}

export interface HouseholdProfile extends HouseholdProfileInput {
  id: string;
  userId: string;
  isComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Recurring Expenses Types
// =============================================================================

export interface RecurringExpenseItem {
  id: string;
  name: string;
  vendorName?: string | null;
  amount: number;
  frequency: string;
  monthlyAmount: number;
  category: string;
  isEssential: boolean;
}

export interface RecurringExpenseCategory {
  total: number;
  items: RecurringExpenseItem[];
}

export interface RecurringExpensesResponse {
  totalMonthly: number;
  categories: Record<string, RecurringExpenseCategory>;
  expenseCount: number;
  missingCategories: string[];
}

// =============================================================================
// Variable Expense Types (AI-generated)
// =============================================================================

export interface VariableExpenseCategory {
  estimate: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  excludedRecurring?: string[];
}

export interface VariableExpenseScenario {
  total: number;
  description: string;
  breakdown?: Record<string, number>;
}

export interface VariableExpenseResponse {
  categories: Record<string, VariableExpenseCategory>;
  total: number;
  scenarios: {
    minimum: VariableExpenseScenario;
    recommended: VariableExpenseScenario;
    comfortable: VariableExpenseScenario;
  };
  assumptions: string[];
  explanation: string;
}

// =============================================================================
// Budget Analysis Types
// =============================================================================

export interface RecurringBreakdown {
  categories: Record<string, {
    total: number;
    items: Array<{
      name: string;
      amount: number;
      frequency: string;
      monthlyAmount: number;
    }>;
  }>;
  total: number;
}

export interface BudgetAnalysisResult {
  id: string;
  analysisDate: Date;
  status: BudgetAnalysisStatus;

  // Recurring from tracked expenses
  recurringExpensesTotal: number;
  recurringBreakdown: RecurringBreakdown;

  // Variable from AI
  aiVariableEstimate: number;
  variableBreakdown: VariableExpenseResponse;
  aiExplanation?: string;
  aiConfidence?: number;

  // Totals
  totalRealisticBudget: number;
  userReportedTotal?: number;
  missingVariableExpenses?: number;

  // User choice
  userFinalBudget?: number;
  userOverrodeAi: boolean;
  userAdjustments?: Record<string, { original: number; adjusted: number }>;

  // Scenarios
  minimumScenario?: VariableExpenseScenario;
  recommendedScenario?: VariableExpenseScenario;
  comfortableScenario?: VariableExpenseScenario;
}

export interface SaveBudgetChoiceInput {
  analysisId: string;
  choice: 'minimum' | 'recommended' | 'comfortable' | 'custom';
  customBudget?: number | null;
  adjustments?: Record<string, number>;
}

// =============================================================================
// AI Prompt Types
// =============================================================================

export interface BuildPromptInput {
  householdProfile: HouseholdProfileInput;
  recurringExpenses: Array<{
    name: string;
    category: string;
    monthlyAmount: number;
    vendorName?: string | null;
  }>;
  totalRecurringMonthly: number;
}

// =============================================================================
// Validation
// =============================================================================

export const VALID_PET_TYPES = ['dog', 'cat', 'bird', 'fish', 'other'] as const;

export function validateHouseholdProfile(input: Partial<HouseholdProfileInput>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (input.adultsCount !== undefined && (input.adultsCount < 1 || input.adultsCount > 4)) {
    errors.push('Adults count must be between 1 and 4');
  }

  if (input.childrenCount !== undefined && (input.childrenCount < 0 || input.childrenCount > 6)) {
    errors.push('Children count must be between 0 and 6');
  }

  if (input.childrenAges !== undefined && input.childrenCount !== undefined) {
    if (input.childrenAges.length !== input.childrenCount) {
      errors.push('Children ages array length must match children count');
    }
    if (input.childrenAges.some(age => age < 0 || age > 18)) {
      errors.push('Children ages must be between 0 and 18');
    }
  }

  if (input.petsCount !== undefined && (input.petsCount < 0 || input.petsCount > 5)) {
    errors.push('Pets count must be between 0 and 5');
  }

  if (input.petTypes !== undefined && input.petsCount !== undefined) {
    if (input.petTypes.length !== input.petsCount) {
      errors.push('Pet types array length must match pets count');
    }
    const invalidTypes = input.petTypes.filter(t => !VALID_PET_TYPES.includes(t as typeof VALID_PET_TYPES[number]));
    if (invalidTypes.length > 0) {
      errors.push(`Invalid pet types: ${invalidTypes.join(', ')}. Valid types: ${VALID_PET_TYPES.join(', ')}`);
    }
  }

  if (input.carsCount !== undefined && (input.carsCount < 0 || input.carsCount > 4)) {
    errors.push('Cars count must be between 0 and 4');
  }

  if (input.hobbiesWithCosts !== undefined && input.hobbiesWithCosts !== null && input.hobbiesWithCosts.length > 500) {
    errors.push('Hobbies description must be 500 characters or less');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function isProfileComplete(profile: Partial<HouseholdProfileInput>): boolean {
  return !!(
    profile.adultsCount !== undefined &&
    profile.childrenCount !== undefined &&
    profile.petsCount !== undefined &&
    profile.carsCount !== undefined &&
    profile.lifestylePreference !== undefined &&
    profile.diningOutFrequency !== undefined &&
    // Children ages must match count
    (profile.childrenCount === 0 || (profile.childrenAges && profile.childrenAges.length === profile.childrenCount)) &&
    // Pet types must match count
    (profile.petsCount === 0 || (profile.petTypes && profile.petTypes.length === profile.petsCount))
  );
}
