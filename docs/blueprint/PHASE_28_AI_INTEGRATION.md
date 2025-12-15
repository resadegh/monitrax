# PHASE 28 — AI INTEGRATION
**Monitrax Blueprint — Phase 28.5**
**Version:** v1.1
**Status:** ✅ Complete
**Created:** 2025-12-15
**Updated:** 2025-12-15

---

## Overview

Phase 28 integrates Google Gemini AI to estimate variable living expenses that users typically don't track. The AI receives household profile data and a complete list of recurring expenses to avoid double-counting.

---

## Architecture

### Integration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AI Integration Flow                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. COLLECT DATA                                                           │
│   ┌─────────────────┐    ┌─────────────────┐                               │
│   │ Household       │    │ Recurring       │                               │
│   │ Profile         │    │ Expenses        │                               │
│   │ (from DB)       │    │ (from DB)       │                               │
│   └────────┬────────┘    └────────┬────────┘                               │
│            │                      │                                         │
│            └──────────┬───────────┘                                         │
│                       │                                                     │
│   2. BUILD PROMPT     ▼                                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │ buildVariableExpensePrompt()                                         │  │
│   │ - Household composition                                              │  │
│   │ - Lifestyle preferences                                              │  │
│   │ - FULL LIST of recurring expenses to EXCLUDE                        │  │
│   │ - Australian context and benchmarks                                  │  │
│   └────────────────────────────────────┬────────────────────────────────┘  │
│                                        │                                    │
│   3. CALL GEMINI AI                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │ generateGeminiJSONCompletion()                                       │  │
│   │ Model: gemini-2.5-flash                                              │  │
│   │ Returns: Structured JSON with estimates                              │  │
│   └────────────────────────────────────┬────────────────────────────────┘  │
│                                        │                                    │
│   4. VALIDATE RESPONSE                 ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │ validateVariableExpenseResponse()                                    │  │
│   │ - Check no recurring expenses included                               │  │
│   │ - Validate totals match breakdown                                    │  │
│   │ - Ensure reasonable ranges                                           │  │
│   └────────────────────────────────────┬────────────────────────────────┘  │
│                                        │                                    │
│   5. STORE RESULT                      ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │ BudgetAnalysis table                                                 │  │
│   │ - aiVariableEstimate                                                 │  │
│   │ - variableBreakdown (JSON)                                           │  │
│   │ - aiExplanation                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## System Prompt

```typescript
// lib/ai/google/promptManager.ts

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
    // ... more categories
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
```

---

## User Prompt Builder

```typescript
// lib/ai/budgetAnalysis.ts

interface BuildPromptInput {
  householdProfile: {
    adultsCount: number;
    childrenCount: number;
    childrenAges: number[];
    petsCount: number;
    petTypes: string[];
    carsCount: number;
    lifestylePreference: 'FRUGAL' | 'MODERATE' | 'COMFORTABLE';
    diningOutFrequency: 'NEVER' | 'RARELY' | 'SOMETIMES' | 'OFTEN';
    hobbiesWithCosts: string | null;
  };
  recurringExpenses: Array<{
    name: string;
    category: string;
    monthlyAmount: number;
    vendorName?: string;
  }>;
  totalRecurringMonthly: number;
}

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
    .map(e => `- ${e.name} (${e.category}): $${e.monthlyAmount.toFixed(0)}/month`)
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
Dining Out: ${householdProfile.diningOutFrequency}
${householdProfile.hobbiesWithCosts ? `Hobbies: ${householdProfile.hobbiesWithCosts}` : ''}

RECURRING EXPENSES ALREADY TRACKED (DO NOT INCLUDE IN YOUR ESTIMATE)
====================================================================
Total Tracked: $${totalRecurringMonthly.toFixed(0)}/month

${recurringList}

Summary by Category:
${Object.entries(recurringByCategory)
  .map(([cat, amt]) => `- ${cat}: $${amt.toFixed(0)}/month`)
  .join('\n')}

⚠️ IMPORTANT: The expenses listed above are ALREADY TRACKED by the user.
Your estimates must EXCLUDE these categories to avoid double-counting.

For example:
- Pet Insurance is tracked at $${recurringByCategory['INSURANCE'] || 0}/month
  → Estimate Pet FOOD and VET visits only, NOT insurance
- Car Registration is tracked
  → Estimate FUEL only, NOT registration
- Health Insurance is tracked
  → Estimate co-pays and pharmacy only, NOT insurance premiums

REQUEST
=======
Please estimate the VARIABLE living expenses for this household that are NOT tracked above.
Provide minimum, recommended, and comfortable scenarios.
Return your response as JSON matching the specified format.
`;
}
```

---

## Response Schema

```typescript
// lib/ai/types.ts

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
```

---

## Validation

```typescript
// lib/ai/budgetAnalysis.ts

export function validateVariableExpenseResponse(
  response: VariableExpenseResponse,
  recurringExpenses: Array<{ category: string; name: string }>
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check total matches category sum
  const categorySum = Object.values(response.categories)
    .reduce((sum, cat) => sum + cat.estimate, 0);

  if (Math.abs(categorySum - response.total) > 10) {
    errors.push(`Total (${response.total}) doesn't match category sum (${categorySum})`);
  }

  // 2. Check for potential double-counting
  const trackedCategories = new Set(recurringExpenses.map(e => e.category.toUpperCase()));
  const trackedNames = new Set(recurringExpenses.map(e => e.name.toLowerCase()));

  for (const [category, data] of Object.entries(response.categories)) {
    // Check if AI included something that sounds like a tracked expense
    const lowerReasoning = data.reasoning.toLowerCase();

    if (trackedCategories.has('INSURANCE') &&
        (lowerReasoning.includes('insurance') && !lowerReasoning.includes('exclud'))) {
      warnings.push(`Category ${category} reasoning mentions insurance but insurance is tracked`);
    }

    // Check for unreasonably high estimates
    if (data.estimate > 5000) {
      warnings.push(`Category ${category} estimate of $${data.estimate} seems very high`);
    }
  }

  // 3. Check scenarios are ordered correctly
  if (response.scenarios.minimum.total > response.scenarios.recommended.total) {
    errors.push('Minimum scenario should be less than recommended');
  }
  if (response.scenarios.recommended.total > response.scenarios.comfortable.total) {
    errors.push('Recommended scenario should be less than comfortable');
  }

  // 4. Sanity check totals against Australian benchmarks
  // ABS data: Average Australian household spends ~$3,000-5,000/mo on variable expenses
  if (response.scenarios.recommended.total < 1000) {
    warnings.push('Recommended total seems too low for an Australian household');
  }
  if (response.scenarios.recommended.total > 8000) {
    warnings.push('Recommended total seems very high');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```

---

## Fallback Strategy

When Gemini AI is unavailable, use Australian benchmark data:

```typescript
// lib/ai/budgetAnalysis.ts

interface BenchmarkParams {
  adultsCount: number;
  childrenCount: number;
  childrenAges: number[];
  petsCount: number;
  petTypes: string[];
  carsCount: number;
  lifestylePreference: 'FRUGAL' | 'MODERATE' | 'COMFORTABLE';
}

export function calculateBenchmarkExpenses(
  params: BenchmarkParams,
  trackedCategories: Set<string>
): VariableExpenseResponse {

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
  const LIFESTYLE_MULT = {
    FRUGAL: 0.7,
    MODERATE: 1.0,
    COMFORTABLE: 1.35,
  };

  const mult = LIFESTYLE_MULT[params.lifestylePreference];
  const categories: Record<string, VariableExpenseCategory> = {};
  let total = 0;

  // Calculate each category if not already tracked
  if (!trackedCategories.has('FOOD')) {
    const teens = params.childrenAges.filter(age => age >= 13).length;
    const youngKids = params.childrenCount - teens;
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

  // Fuel (if transport not tracked)
  if (!trackedCategories.has('TRANSPORT') && params.carsCount > 0) {
    const fuel = params.carsCount * BASE_COSTS.FUEL.perCar * mult;
    categories.FUEL = {
      estimate: Math.round(fuel),
      confidence: 'medium',
      reasoning: `${params.carsCount} vehicle(s) at average suburban usage`,
      excludedRecurring: ['Car Registration'],
    };
    total += fuel;
  }

  // Pet costs (if pet insurance not the only pet expense)
  if (params.petsCount > 0) {
    let petCosts = 0;
    params.petTypes.forEach(type => {
      petCosts += BASE_COSTS.PET_COSTS[type as keyof typeof BASE_COSTS.PET_COSTS] || 50;
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

  // ... continue for other categories ...

  // Generate scenarios
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
```

---

## Example AI Interaction

### Input to AI

```
HOUSEHOLD PROFILE
=================
Adults: 2
Children: 2 children (ages: 8, 12)
Pets: 1 pet(s): dog
Vehicles: 2 car(s)
Lifestyle: MODERATE
Dining Out: SOMETIMES
Hobbies: Golf ($200/mo), kids soccer ($50/mo)

RECURRING EXPENSES ALREADY TRACKED (DO NOT INCLUDE IN YOUR ESTIMATE)
====================================================================
Total Tracked: $6,245/month

- Pet Insurance (INSURANCE): $247/month
- Health Insurance (INSURANCE): $370/month
- Car Registration - Toyota (REGISTRATION): $28/month
- Car Registration - Honda (REGISTRATION): $25/month
- Council Rates (RATES): $450/month
- Water Rates (RATES): $80/month
- Electricity (UTILITIES): $200/month
- Gas (UTILITIES): $80/month
- Internet (UTILITIES): $90/month
- Home Insurance (INSURANCE): $150/month
- Life Insurance (INSURANCE): $100/month
- Netflix (ENTERTAINMENT): $25/month
- Spotify (ENTERTAINMENT): $15/month
- Gym Membership (PERSONAL): $60/month
- Mortgage (HOUSING): $4,325/month

Summary by Category:
- INSURANCE: $867/month
- REGISTRATION: $53/month
- RATES: $530/month
- UTILITIES: $370/month
- ENTERTAINMENT: $40/month
- PERSONAL: $60/month
- HOUSING: $4,325/month

⚠️ IMPORTANT: The expenses listed above are ALREADY TRACKED by the user.
Your estimates must EXCLUDE these categories to avoid double-counting.
```

### Expected AI Output

```json
{
  "categories": {
    "GROCERIES": {
      "estimate": 1200,
      "confidence": "high",
      "reasoning": "2 adults, 2 school-age children (8, 12), moderate lifestyle. Based on ABS data showing average family of 4 spends $1,100-1,300/month on groceries and household supplies.",
      "excludedRecurring": []
    },
    "FUEL": {
      "estimate": 550,
      "confidence": "medium",
      "reasoning": "2 vehicles in suburban household. Estimated 50-60km/day average at $1.80/L and 10L/100km consumption. School runs, work commute, activities.",
      "excludedRecurring": ["Car Registration - Toyota ($28/mo)", "Car Registration - Honda ($25/mo)"]
    },
    "PET_COSTS": {
      "estimate": 100,
      "confidence": "medium",
      "reasoning": "1 dog - quality dry food ($70/mo), treats and toys ($20/mo), occasional vet visits averaged ($10/mo). Insurance already covered separately.",
      "excludedRecurring": ["Pet Insurance ($247/mo)"]
    },
    "DINING_OUT": {
      "estimate": 350,
      "confidence": "medium",
      "reasoning": "Family of 4, dines out 'sometimes' (weekly). ~$80/meal average for family restaurant, plus occasional coffees and takeaway.",
      "excludedRecurring": []
    },
    "PERSONAL_CARE": {
      "estimate": 180,
      "confidence": "high",
      "reasoning": "Haircuts for family (~$50/mo), toiletries and skincare (~$100/mo), personal items (~$30/mo).",
      "excludedRecurring": ["Gym Membership ($60/mo) - already tracked"]
    },
    "CLOTHING": {
      "estimate": 200,
      "confidence": "low",
      "reasoning": "2 growing children require regular clothing updates. Adults moderate replacement. Highly variable month-to-month.",
      "excludedRecurring": []
    },
    "MEDICAL": {
      "estimate": 120,
      "confidence": "medium",
      "reasoning": "GP co-pays, pharmacy, dental checkups averaged monthly. Family of 4. Health insurance covers major items.",
      "excludedRecurring": ["Health Insurance ($370/mo)"]
    },
    "KIDS_ACTIVITIES": {
      "estimate": 280,
      "confidence": "medium",
      "reasoning": "2 school-age children. Mentioned soccer ($50/mo tracked in hobbies?). School excursions, birthday parties, pocket money, extracurriculars.",
      "excludedRecurring": []
    },
    "GIFTS": {
      "estimate": 120,
      "confidence": "low",
      "reasoning": "Birthday presents, Christmas, teacher gifts, family occasions. Averaged monthly. Highly variable.",
      "excludedRecurring": []
    },
    "HOME_MAINTENANCE": {
      "estimate": 150,
      "confidence": "medium",
      "reasoning": "Minor repairs, cleaning supplies, garden maintenance, light bulbs, batteries, filters.",
      "excludedRecurring": ["Home Insurance ($150/mo)"]
    },
    "MISCELLANEOUS": {
      "estimate": 200,
      "confidence": "low",
      "reasoning": "Cash spending, unexpected household items, Amazon purchases, random needs.",
      "excludedRecurring": []
    }
  },
  "total": 3450,
  "scenarios": {
    "minimum": {
      "total": 2600,
      "description": "Strict budget: home cooking only, minimal driving, limited activities. Requires significant lifestyle adjustment."
    },
    "recommended": {
      "total": 3450,
      "description": "Realistic estimate for moderate Australian family. Comfortable without excess."
    },
    "comfortable": {
      "total": 4400,
      "description": "More flexibility: better quality groceries, more dining out, generous kids activities, premium personal care."
    }
  },
  "assumptions": [
    "Based on ABS Household Expenditure Survey 2023-24 for comparable household",
    "Fuel prices at $1.80/L average (varies by location)",
    "All amounts exclude tracked recurring expenses listed above",
    "Golf mentioned in hobbies assumed included in that $200/mo figure",
    "Streaming services (Netflix/Spotify) already tracked so entertainment estimate is for outings/activities only"
  ],
  "explanation": "Based on your household of 2 adults and 2 children (ages 8 and 12) with moderate lifestyle preferences, I've estimated your untracked variable expenses at $3,450/month. This is in addition to your tracked recurring expenses of $6,245/month.\n\nKey exclusions to avoid double-counting:\n- Pet Insurance ($247/mo) - I've only estimated pet food and vet visits ($100/mo)\n- Health Insurance ($370/mo) - I've only estimated co-pays and pharmacy ($120/mo)\n- Car Registration ($53/mo total) - I've only estimated fuel ($550/mo)\n- Gym Membership ($60/mo) - I've reduced personal care estimate accordingly\n- Netflix/Spotify ($40/mo) - Entertainment estimate is for outings only\n\nYour total realistic monthly budget would be:\n- Tracked recurring: $6,245\n- Variable (estimated): $3,450\n- Total: $9,695/month"
}
```

---

## Token Usage Estimation

| Component | Est. Tokens |
|-----------|-------------|
| System prompt | ~800 |
| User prompt | ~600 |
| AI response | ~1,500 |
| **Total** | **~2,900** |

**Cost per request:** ~$0.0017 (using gemini-2.5-flash at $0.15/$0.60 per 1M tokens)

---

## Caching Strategy

- Cache AI responses for 24 hours per user
- Invalidate cache when:
  - Household profile changes
  - Recurring expenses change significantly (>10%)
  - User requests refresh

---

## Error Handling

```typescript
try {
  const response = await generateGeminiJSONCompletion({
    model: GEMINI_MODELS.FINANCIAL_ADVISOR,
    systemPrompt: VARIABLE_EXPENSE_ESTIMATION_PROMPT,
    userPrompt: buildVariableExpensePrompt(input),
    maxTokens: 2500,
    temperature: 0.5,  // Lower for more consistent estimates
  });

  // Validate response
  const validation = validateVariableExpenseResponse(response.data, recurringExpenses);

  if (!validation.valid) {
    console.error('AI response validation failed:', validation.errors);
    // Fall back to benchmark data
    return calculateBenchmarkExpenses(householdProfile, trackedCategories);
  }

  if (validation.warnings.length > 0) {
    console.warn('AI response warnings:', validation.warnings);
    // Continue but log for review
  }

  return response.data;

} catch (error) {
  console.error('AI variable expense estimation failed:', error);

  // Graceful fallback to benchmarks
  return calculateBenchmarkExpenses(householdProfile, trackedCategories);
}
```

---

## Debt Analysis Integration (Phase 28.6)

### Overview

The Debt Planner page integrates with AI to provide personalized debt repayment recommendations. A critical fix was implemented to ensure the AI uses the same `availableForDebt` value displayed in the UI header.

### Problem Solved

**Issue:** AI was recommending surplus amounts based on $220,508/month when the UI showed $494/month available.

**Root Cause:** The API was independently calculating `availableForExtraRepayments` instead of using the value from the cashflow API that the frontend uses.

### Solution: Frontend-to-API Value Passing

The frontend now passes the pre-calculated `availableForDebt` value directly to the API:

```typescript
// Frontend: app/dashboard/debt-planner/page.tsx
const response = await fetch('/api/ai/debt-analysis', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    availableForExtraRepayments: budgetStatus?.availableForDebt || 0,
  }),
});
```

```typescript
// Backend: app/api/ai/debt-analysis/route.ts
// Parse request body to get pre-calculated value from frontend
let requestBody: { availableForExtraRepayments?: number } = {};
try {
  requestBody = await authReq.json();
} catch {
  // No body provided - will calculate on server side
}

// Use frontend value if provided
const availableForExtraRepayments = requestBody.availableForExtraRepayments !== undefined
  && requestBody.availableForExtraRepayments >= 0
  ? requestBody.availableForExtraRepayments
  : calculatedAvailable;  // Fallback to server calculation
```

### Server-Side Validation

Even with the correct value passed, the AI may not always follow instructions. Server-side validation FORCES correct surplus values:

```typescript
// ALWAYS force correct surplus values based on actual available cashflow
const correctAggressiveSurplus = Math.round(availableForExtra * 0.9);  // 90%
const correctRecommendedSurplus = Math.round(availableForExtra * 0.6); // 60%
const correctMinimumSurplus = Math.round(availableForExtra * 0.3);     // 30%

// Override AI response with correct values
validated.optimalSurplus.aggressive = correctAggressiveSurplus;
validated.optimalSurplus.recommended = correctRecommendedSurplus;
validated.optimalSurplus.minimum = correctMinimumSurplus;
```

### Data Flow Sequence

```
User Flow:
1. Household Profile → Set up household (adults, children, pets, cars)
2. Budget Analysis → Generate & confirm realistic budget
3. Debt Planner → Get AI recommendations using confirmed budget values

Technical Flow:
1. Frontend fetches /api/budget-analysis/latest → Gets confirmed budget
2. Frontend fetches /api/calculate/cashflow → Gets NET income
3. Frontend calculates: availableForDebt = netIncome - budget - loanPayments
4. Frontend displays "$494/mo available" in header
5. User clicks "Get AI Analysis"
6. Frontend POSTs to /api/ai/debt-analysis with { availableForExtraRepayments: 494 }
7. API uses $494 in prompt and validation
8. AI recommendations are forced to 30%/60%/90% of $494
```

### Sidebar Navigation Order

The Planning section in the sidebar was reordered to match the logical data flow:

1. **Household Profile** — First step: define household
2. **Budget Analysis** — Second step: confirm budget
3. **Debt Planner** — Third step: plan debt repayment
4. Cashflow — View projections
5. Financial Health — Monitor health score
6. Tax Calculator — Tax estimates
7. Strategy — Overall strategy

---

*Status: Complete*
*Author: Claude Code*
*Phase: 28.6*
