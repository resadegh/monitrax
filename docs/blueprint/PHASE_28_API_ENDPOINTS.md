# PHASE 28 — API ENDPOINTS
**Monitrax Blueprint — Phase 28.3**
**Version:** v1.1
**Status:** ✅ Complete
**Created:** 2025-12-15
**Updated:** 2025-12-15

---

## Overview

Phase 28 introduces 6 new API endpoints and updates 1 existing endpoint to support household profiling and AI-powered budget analysis.

---

## New Endpoints

### 1. POST /api/household-profile

Create or update user's household profile.

**Request:**
```typescript
POST /api/household-profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "adultsCount": 2,
  "childrenCount": 2,
  "childrenAges": [8, 12],
  "petsCount": 1,
  "petTypes": ["dog"],
  "carsCount": 2,
  "lifestylePreference": "MODERATE",
  "diningOutFrequency": "SOMETIMES",
  "hobbiesWithCosts": "Golf ($200/mo), kids soccer ($50/mo)"
}
```

**Response (201 Created):**
```typescript
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "userId": "user-456",
    "adultsCount": 2,
    "childrenCount": 2,
    "childrenAges": [8, 12],
    "petsCount": 1,
    "petTypes": ["dog"],
    "carsCount": 2,
    "lifestylePreference": "MODERATE",
    "diningOutFrequency": "SOMETIMES",
    "hobbiesWithCosts": "Golf ($200/mo), kids soccer ($50/mo)",
    "isComplete": true,
    "createdAt": "2025-12-15T10:00:00Z",
    "updatedAt": "2025-12-15T10:00:00Z"
  }
}
```

**Validation Errors (400):**
```typescript
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "adultsCount", "message": "Must be between 1 and 4" },
    { "field": "childrenAges", "message": "Array length must match childrenCount" }
  ]
}
```

---

### 2. GET /api/household-profile

Retrieve user's household profile.

**Request:**
```typescript
GET /api/household-profile
Authorization: Bearer <token>
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "id": "uuid-123",
    "userId": "user-456",
    "adultsCount": 2,
    "childrenCount": 2,
    "childrenAges": [8, 12],
    "petsCount": 1,
    "petTypes": ["dog"],
    "carsCount": 2,
    "lifestylePreference": "MODERATE",
    "diningOutFrequency": "SOMETIMES",
    "hobbiesWithCosts": "Golf ($200/mo), kids soccer ($50/mo)",
    "isComplete": true,
    "createdAt": "2025-12-15T10:00:00Z",
    "updatedAt": "2025-12-15T10:00:00Z"
  }
}
```

**Response (404 - No Profile):**
```typescript
{
  "success": false,
  "error": "No household profile found",
  "message": "Please complete your household profile to enable budget analysis."
}
```

---

### 3. GET /api/expenses/recurring

Fetch user's recurring expenses grouped by category.

**Request:**
```typescript
GET /api/expenses/recurring
Authorization: Bearer <token>
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "totalMonthly": 6245,
    "categories": {
      "INSURANCE": {
        "total": 617,
        "items": [
          {
            "id": "exp-1",
            "name": "Pet Insurance",
            "vendorName": "PetSure",
            "amount": 247,
            "frequency": "MONTHLY",
            "monthlyAmount": 247,
            "isEssential": true
          },
          {
            "id": "exp-2",
            "name": "Health Insurance",
            "vendorName": "Medibank",
            "amount": 370,
            "frequency": "MONTHLY",
            "monthlyAmount": 370,
            "isEssential": true
          }
        ]
      },
      "REGISTRATION": {
        "total": 28,
        "items": [
          {
            "id": "exp-3",
            "name": "Car Registration - Toyota",
            "amount": 331,
            "frequency": "ANNUALLY",
            "monthlyAmount": 28,
            "isEssential": true
          }
        ]
      },
      "RATES": {
        "total": 450,
        "items": [
          {
            "id": "exp-4",
            "name": "Council Rates",
            "amount": 1350,
            "frequency": "QUARTERLY",
            "monthlyAmount": 450,
            "isEssential": true
          }
        ]
      }
      // ... other categories
    },
    "expenseCount": 15,
    "missingCategories": ["FOOD", "TRANSPORT", "ENTERTAINMENT"]
  }
}
```

**Notes:**
- `missingCategories` lists common variable expense categories not tracked
- `monthlyAmount` is normalized for all frequencies
- Expenses are sorted by amount descending within each category

---

### 4. POST /api/budget-analysis/generate

Generate AI-powered budget analysis with variable expense estimates.

**Request:**
```typescript
POST /api/budget-analysis/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "forceRegenerate": false  // Optional: regenerate even if recent analysis exists
}
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "id": "analysis-789",
    "analysisDate": "2025-12-15T10:30:00Z",
    "status": "READY",

    "recurring": {
      "total": 6245,
      "breakdown": {
        "INSURANCE": 617,
        "REGISTRATION": 28,
        "RATES": 450,
        "UTILITIES": 350,
        "HOUSING": 2500,
        "OTHER": 2300
      }
    },

    "variable": {
      "total": 3605,
      "breakdown": {
        "GROCERIES": {
          "estimate": 1200,
          "confidence": "high",
          "reasoning": "2 adults, 2 children, moderate lifestyle"
        },
        "FUEL": {
          "estimate": 600,
          "confidence": "medium",
          "reasoning": "2 cars, suburban household"
        },
        "PET_COSTS": {
          "estimate": 100,
          "confidence": "medium",
          "reasoning": "1 dog - food and vet (insurance excluded)",
          "excludedRecurring": ["Pet Insurance - $247/mo"]
        },
        "ENTERTAINMENT": {
          "estimate": 400,
          "confidence": "medium",
          "reasoning": "Family activities, sometimes dining out"
        },
        "PERSONAL_CARE": {
          "estimate": 200,
          "confidence": "high",
          "reasoning": "Haircuts, toiletries for family of 4"
        },
        "CLOTHING": {
          "estimate": 150,
          "confidence": "low",
          "reasoning": "Growing children, moderate wardrobe"
        },
        "MEDICAL": {
          "estimate": 150,
          "confidence": "medium",
          "reasoning": "Co-pays, pharmacy (insurance excluded)",
          "excludedRecurring": ["Health Insurance - $370/mo"]
        },
        "KIDS_ACTIVITIES": {
          "estimate": 300,
          "confidence": "medium",
          "reasoning": "2 school-age children, sports, lessons"
        },
        "MISCELLANEOUS": {
          "estimate": 200,
          "confidence": "low",
          "reasoning": "Home items, unexpected purchases"
        },
        "GIFTS": {
          "estimate": 150,
          "confidence": "low",
          "reasoning": "Birthdays, holidays, estimated average"
        },
        "HOME_MAINTENANCE": {
          "estimate": 155,
          "confidence": "medium",
          "reasoning": "Minor repairs, garden supplies"
        }
      },
      "assumptions": [
        "Based on ABS Australian household expenditure data",
        "Fuel at $1.80/L average, 60km/day for 2 cars",
        "Excludes all tracked recurring expenses",
        "Moderate lifestyle tier applied"
      ]
    },

    "totals": {
      "recurringExpenses": 6245,
      "variableExpenses": 3605,
      "totalRealisticBudget": 9850,
      "userReportedTotal": 6245,
      "missingExpenses": 3605
    },

    "scenarios": {
      "minimum": {
        "totalMonthly": 2800,
        "description": "Bare essentials, very tight budget"
      },
      "recommended": {
        "totalMonthly": 3605,
        "description": "Realistic estimate for comfortable living"
      },
      "comfortable": {
        "totalMonthly": 4500,
        "description": "More spending flexibility, higher quality"
      }
    },

    "aiExplanation": "Based on your household of 2 adults and 2 children (ages 8, 12) with 1 dog and 2 cars, I've estimated your variable living expenses. I've excluded all your tracked recurring expenses including pet insurance ($247/mo) and health insurance ($370/mo) to avoid double-counting. The recommended estimate of $3,605/month is based on Australian Bureau of Statistics household expenditure data for moderate-income families.",

    "aiConfidence": 0.75,

    "usage": {
      "model": "gemini-2.5-flash",
      "totalTokens": 2800,
      "estimatedCost": 0.0017
    }
  }
}
```

**Response (503 - AI Unavailable):**
```typescript
{
  "success": false,
  "error": "AI analysis not available",
  "message": "Using benchmark-based estimates instead.",
  "data": {
    // Fallback with Australian benchmark data
    "variable": {
      "total": 3200,
      "source": "ABS_BENCHMARKS",
      // ...
    }
  }
}
```

---

### 5. POST /api/budget-analysis/save-choice

Save user's final budget choice after reviewing AI analysis.

**Request:**
```typescript
POST /api/budget-analysis/save-choice
Authorization: Bearer <token>
Content-Type: application/json

{
  "analysisId": "analysis-789",
  "choice": "recommended",  // "minimum" | "recommended" | "comfortable" | "custom"
  "customBudget": null,     // Required if choice === "custom"
  "adjustments": {          // Optional: user's tweaks to AI estimates
    "GROCERIES": 1100,      // User reduced from AI's $1200
    "ENTERTAINMENT": 500     // User increased from AI's $400
  }
}
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "id": "analysis-789",
    "status": "CONFIRMED",
    "userFinalBudget": 9850,
    "userOverrodeAi": true,
    "userAdjustments": {
      "GROCERIES": { "original": 1200, "adjusted": 1100 },
      "ENTERTAINMENT": { "original": 400, "adjusted": 500 }
    },
    "message": "Your budget has been saved and will be used in the Debt Planner."
  }
}
```

---

### 6. GET /api/budget-analysis/latest

Get the most recent budget analysis for the user.

**Request:**
```typescript
GET /api/budget-analysis/latest
Authorization: Bearer <token>
```

**Response (200 OK):**
```typescript
{
  "success": true,
  "data": {
    "id": "analysis-789",
    "analysisDate": "2025-12-15T10:30:00Z",
    "status": "CONFIRMED",
    "totalRealisticBudget": 9850,
    "recurringExpensesTotal": 6245,
    "aiVariableEstimate": 3605,
    "userFinalBudget": 9850,
    "userOverrodeAi": true,
    "isStale": false,  // True if > 30 days old or profile changed
    "daysOld": 0
  }
}
```

**Response (404 - No Analysis):**
```typescript
{
  "success": false,
  "error": "No budget analysis found",
  "message": "Please complete household profile and generate a budget analysis.",
  "householdProfileComplete": false
}
```

---

## Updated Endpoints

### PATCH /api/ai/debt-analysis

**Updates:**
- Check for latest budget analysis before running
- Use `totalRealisticBudget` instead of just tracked expenses
- Add comparison showing impact of realistic budget

**New Response Fields:**
```typescript
{
  "success": true,
  "data": {
    "analysis": {
      // ... existing fields ...
    },
    "context": {
      // ... existing fields ...

      // NEW: Budget analysis integration
      "budgetAnalysis": {
        "available": true,
        "totalRealisticBudget": 9850,
        "recurringExpenses": 6245,
        "variableExpenses": 3605,
        "usedInCalculation": true
      },

      // UPDATED: Now uses realistic budget
      "monthlyExpenses": 9850,  // Was 6245
      "monthlySurplus": 13211,  // Was 16816
      "availableForExtraRepayments": 1364,  // Was 4969

      // NEW: Before/after comparison
      "comparison": {
        "withoutBudgetAnalysis": {
          "monthlyExpenses": 6245,
          "availableForExtra": 4969,
          "aiRecommendedSurplus": 2981
        },
        "withBudgetAnalysis": {
          "monthlyExpenses": 9850,
          "availableForExtra": 1364,
          "aiRecommendedSurplus": 1200
        }
      }
    }
  }
}
```

---

## Authentication

All endpoints require JWT authentication:

```typescript
Authorization: Bearer <token>
```

Using the existing `withAuth()` middleware from `lib/middleware`.

---

## Error Responses

### Standard Error Format

```typescript
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable description",
  "details": [...]  // Optional: validation errors
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error |
| 401 | Unauthorized |
| 404 | Resource not found |
| 500 | Server error |
| 503 | AI service unavailable |

---

## Rate Limiting

- `/api/budget-analysis/generate`: Max 5 requests per hour per user
- Other endpoints: Standard rate limits apply

---

## Implementation Notes

### File Structure

```
app/api/
├── household-profile/
│   └── route.ts          # GET, POST
├── expenses/
│   └── recurring/
│       └── route.ts      # GET
├── budget-analysis/
│   ├── generate/
│   │   └── route.ts      # POST
│   ├── save-choice/
│   │   └── route.ts      # POST
│   └── latest/
│       └── route.ts      # GET
```

### Dependencies

- Prisma for database operations
- `lib/ai/google` for Gemini AI integration
- `lib/middleware` for authentication
- `lib/utils/frequencies` for amount normalization

---

*Status: ✅ Complete*
*Author: Claude Code*
*Phase: 28.3*

## Implementation Notes

All endpoints have been implemented with the following additions:

1. **24-Hour Caching** in `/api/budget-analysis/generate`:
   - If `forceRegenerate: false` (default), returns cached analysis from last 24 hours
   - Prevents unnecessary AI calls and ensures consistent numbers

2. **Benchmark Fallback** when AI unavailable:
   - Uses Australian Bureau of Statistics household expenditure data
   - Returns `usedAI: false` in response

3. **TypeScript Strict Mode Compliance**:
   - All JSON fields use explicit type casts (`as any`)
   - Proper type annotations for reduce/map callbacks

4. **Debt Planner Integration** uses `/api/calculate/cashflow`:
   - Fetches NET income (after PAYG/tax) instead of GROSS income
   - Ensures consistency with Cashflow section numbers
   - Example: Gross $26,787 → PAYG $3,726 → **NET $23,061**
