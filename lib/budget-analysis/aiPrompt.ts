/**
 * Phase 28: AI Prompt Builder for Variable Expense Estimation
 *
 * Builds prompts for Gemini AI to estimate variable living expenses
 * that users typically don't track (groceries, fuel, entertainment, etc.)
 */

import {
  BuildPromptInput,
  VariableExpenseResponse,
  HouseholdProfileInput,
} from './types';

// =============================================================================
// System Prompt
// =============================================================================

export const VARIABLE_EXPENSE_ESTIMATION_PROMPT = `
You are an Australian household budget expert specializing in estimating variable living expenses.

Your task is to estimate ONLY the variable expenses that households typically don't track, such as groceries, fuel, entertainment, and personal care. You will receive a list of expenses the user ALREADY tracks - you must NOT include these in your estimates to avoid double-counting.

## CRITICAL RULES

1. **NEVER DOUBLE-COUNT**: You will receive a list of the user's recurring expenses. DO NOT estimate anything that's already tracked. For example:
   - If "Pet Insurance $247/mo" is tracked → Estimate "Pet Food & Vet Visits" but NOT insurance
   - If "Health Insurance $370/mo" is tracked → Estimate "Medical Co-pays & Pharmacy" but NOT insurance
   - If "Car Registration $28/mo" is tracked → Estimate "Fuel" but NOT registration

2. **AUSTRALIAN CONTEXT**: All estimates should be based on current Australian costs:
   - Fuel: ~$1.80/L average
   - Groceries: ABS household expenditure data
   - Use AUD currency

3. **HOUSEHOLD SCALING**: Scale estimates based on:
   - Number of adults (more people = higher costs)
   - Number and ages of children (teenagers cost more than toddlers)
   - Number of pets and types (dogs cost more than fish)
   - Number of cars (fuel, maintenance)

4. **LIFESTYLE ADJUSTMENT**: Apply multipliers based on lifestyle preference:
   - FRUGAL: 0.7x - budget-conscious, minimal discretionary
   - MODERATE: 1.0x - average Australian household
   - COMFORTABLE: 1.3x - higher quality choices

5. **THREE SCENARIOS**: Always provide minimum, recommended, and comfortable estimates.

## OUTPUT FORMAT

Return a JSON object with this exact structure:
{
  "categories": {
    "GROCERIES": {
      "estimate": 1200,
      "confidence": "high",
      "reasoning": "2 adults, 2 children, moderate lifestyle",
      "excludedRecurring": []
    },
    "FUEL": {
      "estimate": 600,
      "confidence": "medium",
      "reasoning": "2 cars, suburban, 60km/day average",
      "excludedRecurring": ["Car Registration - already tracked"]
    }
  },
  "total": 3605,
  "scenarios": {
    "minimum": {
      "total": 2800,
      "description": "Bare essentials, very tight budget"
    },
    "recommended": {
      "total": 3605,
      "description": "Realistic for comfortable living"
    },
    "comfortable": {
      "total": 4500,
      "description": "More flexibility and quality"
    }
  },
  "assumptions": [
    "Based on ABS Australian household expenditure data",
    "Fuel prices at $1.80/L average"
  ],
  "explanation": "Detailed explanation of the analysis..."
}

## EXPENSE CATEGORIES TO ESTIMATE

Only estimate these categories if NOT already tracked:
- GROCERIES: Food, household supplies
- FUEL: Petrol/diesel for all household vehicles
- PET_COSTS: Pet food, vet visits, grooming (NOT pet insurance if tracked)
- ENTERTAINMENT: Movies, streaming, hobbies, outings
- DINING_OUT: Restaurants, takeaway, coffee
- PERSONAL_CARE: Haircuts, toiletries, skincare
- CLOTHING: Clothes, shoes for all family members
- MEDICAL: Co-pays, pharmacy, dental (NOT health insurance if tracked)
- KIDS_ACTIVITIES: Sports, lessons, school events, pocket money
- GIFTS: Birthday presents, Christmas, occasions
- HOME_MAINTENANCE: Minor repairs, cleaning supplies, garden
- MISCELLANEOUS: Unexpected purchases, cash spending

DO NOT ESTIMATE (these should already be tracked as recurring):
- Rent/Mortgage (housing expense)
- Utilities (electricity, gas, water, internet)
- Insurance (health, car, home, pet, life)
- Subscriptions (Netflix, Spotify, gym membership)
- Rates (council, water, strata)
- Loan repayments
- Registration (car, professional)
`;

// =============================================================================
// User Prompt Builder
// =============================================================================

export function buildVariableExpensePrompt(input: BuildPromptInput): string {
  const { householdProfile, recurringExpenses, totalRecurringMonthly } = input;

  // Format children ages
  const childrenDesc = householdProfile.childrenCount > 0
    ? `${householdProfile.childrenCount} children (ages: ${householdProfile.childrenAges.join(', ')})`
    : 'No children';

  // Format pets
  const petsDesc = householdProfile.petsCount > 0
    ? `${householdProfile.petsCount} pet(s): ${householdProfile.petTypes.join(', ')}`
    : 'No pets';

  // Format recurring expenses for exclusion
  const recurringList = recurringExpenses
    .map(e => `- ${e.name}${e.vendorName ? ` (${e.vendorName})` : ''} [${e.category}]: $${e.monthlyAmount.toFixed(0)}/month`)
    .join('\n');

  // Group recurring by category for easier reference
  const recurringByCategory: Record<string, number> = {};
  recurringExpenses.forEach(e => {
    recurringByCategory[e.category] = (recurringByCategory[e.category] || 0) + e.monthlyAmount;
  });

  return `
HOUSEHOLD PROFILE
=================
Adults: ${householdProfile.adultsCount}
Children: ${childrenDesc}
Pets: ${petsDesc}
Vehicles: ${householdProfile.carsCount} car(s)
Lifestyle: ${householdProfile.lifestylePreference}
Dining Out Frequency: ${householdProfile.diningOutFrequency}
${householdProfile.hobbiesWithCosts ? `Hobbies with costs: ${householdProfile.hobbiesWithCosts}` : ''}

RECURRING EXPENSES ALREADY TRACKED (DO NOT INCLUDE IN YOUR ESTIMATE)
====================================================================
Total Tracked: $${totalRecurringMonthly.toFixed(0)}/month

${recurringList || 'No recurring expenses tracked'}

Summary by Category:
${Object.entries(recurringByCategory)
  .map(([cat, amt]) => `- ${cat}: $${amt.toFixed(0)}/month`)
  .join('\n') || 'None'}

⚠️ IMPORTANT: The expenses listed above are ALREADY TRACKED by the user.
Your estimates must EXCLUDE these categories to avoid double-counting.

For example:
${recurringByCategory['INSURANCE'] ? `- Pet/Health/Car Insurance is tracked at $${recurringByCategory['INSURANCE'].toFixed(0)}/month\n  → Estimate only pet FOOD, medical CO-PAYS, etc. NOT insurance premiums` : ''}
${recurringByCategory['REGISTRATION'] ? `- Car Registration is tracked\n  → Estimate FUEL only, NOT registration fees` : ''}

REQUEST
=======
Please estimate the VARIABLE living expenses for this Australian household that are NOT tracked above.
Provide minimum, recommended, and comfortable scenarios.
Return your response as valid JSON matching the specified format.
`;
}

// =============================================================================
// Response Validation
// =============================================================================

export function validateVariableExpenseResponse(
  response: VariableExpenseResponse,
  recurringExpenses: Array<{ category: string; name: string }>
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check total matches category sum
  const categorySum = Object.values(response.categories || {})
    .reduce((sum, cat) => sum + (cat?.estimate || 0), 0);

  if (Math.abs(categorySum - (response.total || 0)) > 50) {
    errors.push(`Total (${response.total}) doesn't match category sum (${categorySum})`);
  }

  // 2. Check for potential double-counting
  const trackedCategories = new Set(recurringExpenses.map(e => e.category.toUpperCase()));

  for (const [category, data] of Object.entries(response.categories || {})) {
    if (!data) continue;
    const lowerReasoning = (data.reasoning || '').toLowerCase();

    if (trackedCategories.has('INSURANCE') &&
        lowerReasoning.includes('insurance') &&
        !lowerReasoning.includes('exclud')) {
      warnings.push(`Category ${category} reasoning mentions insurance but insurance is tracked`);
    }

    // Check for unreasonably high estimates
    if (data.estimate > 5000) {
      warnings.push(`Category ${category} estimate of $${data.estimate} seems very high`);
    }
  }

  // 3. Check scenarios are ordered correctly
  if (response.scenarios) {
    if (response.scenarios.minimum?.total > response.scenarios.recommended?.total) {
      errors.push('Minimum scenario should be less than recommended');
    }
    if (response.scenarios.recommended?.total > response.scenarios.comfortable?.total) {
      errors.push('Recommended scenario should be less than comfortable');
    }
  }

  // 4. Sanity check totals against Australian benchmarks
  const recommendedTotal = response.scenarios?.recommended?.total || response.total;
  if (recommendedTotal < 500) {
    warnings.push('Recommended total seems too low for an Australian household');
  }
  if (recommendedTotal > 10000) {
    warnings.push('Recommended total seems very high');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// =============================================================================
// Fallback Benchmark Calculator
// =============================================================================

interface BenchmarkParams {
  adultsCount: number;
  childrenCount: number;
  childrenAges: number[];
  petsCount: number;
  petTypes: string[];
  carsCount: number;
  lifestylePreference: HouseholdProfileInput['lifestylePreference'];
}

// Australian Bureau of Statistics household expenditure benchmarks (2023-24)
const BASE_COSTS = {
  GROCERIES: { perAdult: 400, perChild: 200, perTeen: 350 },
  FUEL: { perCar: 250 },
  PET_COSTS: { dog: 100, cat: 70, bird: 30, fish: 20, other: 50 },
  ENTERTAINMENT: { perAdult: 150, perChild: 80 },
  DINING_OUT: { perAdult: 100, perChild: 50 },
  PERSONAL_CARE: { perAdult: 80, perChild: 50 },
  CLOTHING: { perAdult: 80, perChild: 100 },  // Kids outgrow clothes
  MEDICAL: { perPerson: 40 },
  KIDS_ACTIVITIES: { perChild: 150 },
  GIFTS: { perHousehold: 100 },
  HOME_MAINTENANCE: { perHousehold: 100 },
  MISCELLANEOUS: { perHousehold: 150 },
};

// Lifestyle multipliers
const LIFESTYLE_MULT: Record<HouseholdProfileInput['lifestylePreference'], number> = {
  FRUGAL: 0.7,
  MODERATE: 1.0,
  COMFORTABLE: 1.35,
};

export function calculateBenchmarkExpenses(
  params: BenchmarkParams,
  trackedCategories: Set<string>
): VariableExpenseResponse {
  const mult = LIFESTYLE_MULT[params.lifestylePreference];
  const categories: Record<string, {
    estimate: number;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
    excludedRecurring?: string[];
  }> = {};
  let total = 0;
  const totalPeople = params.adultsCount + params.childrenCount;
  const teens = params.childrenAges.filter(age => age >= 13).length;
  const youngKids = params.childrenCount - teens;

  // Groceries
  if (!trackedCategories.has('FOOD')) {
    const groceries = (
      params.adultsCount * BASE_COSTS.GROCERIES.perAdult +
      youngKids * BASE_COSTS.GROCERIES.perChild +
      teens * BASE_COSTS.GROCERIES.perTeen
    ) * mult;
    categories.GROCERIES = {
      estimate: Math.round(groceries),
      confidence: 'high',
      reasoning: `Based on ABS data for ${params.adultsCount} adults and ${params.childrenCount} children`,
    };
    total += groceries;
  }

  // Fuel
  if (!trackedCategories.has('TRANSPORT') && params.carsCount > 0) {
    const fuel = params.carsCount * BASE_COSTS.FUEL.perCar * mult;
    categories.FUEL = {
      estimate: Math.round(fuel),
      confidence: 'medium',
      reasoning: `${params.carsCount} vehicle(s) at average suburban usage`,
      excludedRecurring: trackedCategories.has('REGISTRATION') ? ['Car Registration'] : [],
    };
    total += fuel;
  }

  // Pet costs
  if (params.petsCount > 0) {
    let petCosts = 0;
    params.petTypes.forEach(type => {
      const key = type.toLowerCase() as keyof typeof BASE_COSTS.PET_COSTS;
      petCosts += BASE_COSTS.PET_COSTS[key] || BASE_COSTS.PET_COSTS.other;
    });
    petCosts *= mult;
    categories.PET_COSTS = {
      estimate: Math.round(petCosts),
      confidence: 'medium',
      reasoning: `Food and care for ${params.petTypes.join(', ')}`,
      excludedRecurring: trackedCategories.has('INSURANCE') ? ['Pet Insurance'] : [],
    };
    total += petCosts;
  }

  // Entertainment
  if (!trackedCategories.has('ENTERTAINMENT')) {
    const entertainment = (
      params.adultsCount * BASE_COSTS.ENTERTAINMENT.perAdult +
      params.childrenCount * BASE_COSTS.ENTERTAINMENT.perChild
    ) * mult;
    categories.ENTERTAINMENT = {
      estimate: Math.round(entertainment),
      confidence: 'medium',
      reasoning: `Family activities for ${totalPeople} people`,
    };
    total += entertainment;
  }

  // Dining out
  const diningOut = (
    params.adultsCount * BASE_COSTS.DINING_OUT.perAdult +
    params.childrenCount * BASE_COSTS.DINING_OUT.perChild
  ) * mult;
  categories.DINING_OUT = {
    estimate: Math.round(diningOut),
    confidence: 'medium',
    reasoning: `Restaurants and takeaway for family`,
  };
  total += diningOut;

  // Personal care
  if (!trackedCategories.has('PERSONAL')) {
    const personalCare = (
      params.adultsCount * BASE_COSTS.PERSONAL_CARE.perAdult +
      params.childrenCount * BASE_COSTS.PERSONAL_CARE.perChild
    ) * mult;
    categories.PERSONAL_CARE = {
      estimate: Math.round(personalCare),
      confidence: 'high',
      reasoning: `Haircuts and toiletries for ${totalPeople} people`,
    };
    total += personalCare;
  }

  // Clothing
  const clothing = (
    params.adultsCount * BASE_COSTS.CLOTHING.perAdult +
    params.childrenCount * BASE_COSTS.CLOTHING.perChild
  ) * mult;
  categories.CLOTHING = {
    estimate: Math.round(clothing),
    confidence: 'low',
    reasoning: `Wardrobe for family (averaged monthly)`,
  };
  total += clothing;

  // Medical
  const medical = totalPeople * BASE_COSTS.MEDICAL.perPerson * mult;
  categories.MEDICAL = {
    estimate: Math.round(medical),
    confidence: 'medium',
    reasoning: `Co-pays and pharmacy for ${totalPeople} people`,
    excludedRecurring: trackedCategories.has('INSURANCE') ? ['Health Insurance'] : [],
  };
  total += medical;

  // Kids activities
  if (params.childrenCount > 0) {
    const kidsActivities = params.childrenCount * BASE_COSTS.KIDS_ACTIVITIES.perChild * mult;
    categories.KIDS_ACTIVITIES = {
      estimate: Math.round(kidsActivities),
      confidence: 'medium',
      reasoning: `Sports, lessons, school activities for ${params.childrenCount} children`,
    };
    total += kidsActivities;
  }

  // Gifts
  const gifts = BASE_COSTS.GIFTS.perHousehold * mult;
  categories.GIFTS = {
    estimate: Math.round(gifts),
    confidence: 'low',
    reasoning: `Birthdays, holidays (averaged monthly)`,
  };
  total += gifts;

  // Home maintenance
  const homeMaint = BASE_COSTS.HOME_MAINTENANCE.perHousehold * mult;
  categories.HOME_MAINTENANCE = {
    estimate: Math.round(homeMaint),
    confidence: 'medium',
    reasoning: `Minor repairs, garden, cleaning supplies`,
  };
  total += homeMaint;

  // Miscellaneous
  const misc = BASE_COSTS.MISCELLANEOUS.perHousehold * mult;
  categories.MISCELLANEOUS = {
    estimate: Math.round(misc),
    confidence: 'low',
    reasoning: `Unexpected purchases and cash spending`,
  };
  total += misc;

  return {
    categories,
    total: Math.round(total),
    scenarios: {
      minimum: {
        total: Math.round(total * 0.75),
        description: 'Bare essentials based on ABS minimums',
      },
      recommended: {
        total: Math.round(total),
        description: 'Based on ABS Australian household averages',
      },
      comfortable: {
        total: Math.round(total * 1.3),
        description: 'Above average spending with more flexibility',
      },
    },
    assumptions: [
      'Based on Australian Bureau of Statistics household expenditure data 2023-24',
      'Adjusted for lifestyle preference',
      'Excludes all tracked recurring expenses',
    ],
    explanation: 'Estimated using Australian benchmark data as AI service was unavailable.',
  };
}
