# PHASE 28 — AI-POWERED REALISTIC BUDGET INTEGRATION
**Monitrax Blueprint — Phase 28**
**Version:** v1.0
**Status:** In Progress
**Created:** 2025-12-15
**Updated:** 2025-12-15

---

## Overview

Phase 28 introduces AI-powered variable expense estimation to provide realistic budget calculations for debt planning. The current system only tracks recurring expenses (insurance, rates, etc.) but misses variable living costs (groceries, fuel, entertainment), leading to unrealistic debt repayment recommendations.

> "Your debt plan should account for actually living your life, not just paying bills."

---

## The Problem

### Current State

The Debt Planner currently calculates available cashflow as:

```
Monthly Income:           $23,061
Monthly Expenses:          $6,245  ← Only recurring expenses (insurance, rates, etc.)
Monthly Loan Repayments:  $11,847
─────────────────────────────────
Available Cashflow:        $4,969
```

**Result:** AI recommends $8,443/month extra payments — impossible because the user still needs money for food, fuel, and living!

### Missing Variable Expenses

The $6,245 monthly expenses does NOT include:
- Groceries & food ($800-1,200/month for family)
- Fuel & transport ($400-800/month)
- Kids activities & school costs
- Pet food & vet visits (insurance is tracked, food is not)
- Entertainment & dining out
- Personal care & clothing
- Medical co-pays & pharmacy
- Gifts & miscellaneous

### Root Cause

Users rarely enter variable expenses because:
1. They're tedious to track
2. They vary month-to-month
3. The current system focuses on recurring/fixed expenses

---

## The Solution

Phase 28 adds AI-powered variable expense estimation:

### Step 1: Collect Household Context
New "Household Profile" collects:
- Adults, children (with ages), pets, cars
- Lifestyle preference (frugal/moderate/comfortable)
- Dining frequency, hobbies

### Step 2: Fetch Existing Recurring Expenses
Query all user's tracked expenses:
- Pet insurance: $247/mo
- Car registration: $331/year → $28/mo
- Health insurance: $370/mo
- All other tracked recurring expenses
- **Total Recurring: $6,245/mo**

### Step 3: AI Estimates Variable Expenses Only
Call Gemini AI with:
- Household profile
- FULL LIST of recurring expenses (to EXCLUDE from AI estimate)

AI estimates ONLY untracked variable expenses:
- Groceries: $1,200/mo
- Fuel: $600/mo
- Pet food & vet: $100/mo
- Entertainment: $400/mo
- etc.
- **Total Variable: $3,605/mo**

### Step 4: Calculate Realistic Budget
```
Recurring (tracked):     $6,245/mo
Variable (AI estimate):  $3,605/mo
─────────────────────────────────
Total Realistic Budget:  $9,850/mo
```

### Step 5: Update Debt Planner
```
Monthly Income:           $23,061
Realistic Total Budget:   $9,850  ← NEW: includes variable expenses
Monthly Loan Repayments:  $11,847
─────────────────────────────────
Realistic Cashflow:        $1,364  ← Was $4,969
Recommended Extra Payment: $1,200  ← Was $8,443
```

---

## Critical Requirement: No Double-Counting

### The Problem
If user has pet insurance tracked as $247/mo, the AI must NOT also estimate "pet expenses $150" — that would double-count.

### The Solution
Pass ALL recurring expenses to AI with instruction to EXCLUDE them:

```json
{
  "recurringExpenses": [
    { "name": "Pet Insurance", "amount": 247, "category": "INSURANCE" },
    { "name": "Car Registration", "amount": 28, "category": "REGISTRATION" },
    { "name": "Health Insurance", "amount": 370, "category": "INSURANCE" }
  ],
  "instruction": "DO NOT estimate expenses in these categories already tracked above"
}
```

### Examples

| Scenario | Wrong | Correct |
|----------|-------|---------|
| Pet insurance tracked | AI estimates "pet expenses $150" | AI estimates "pet food & vet visits $100" (not insurance) |
| Car registration tracked | AI estimates "car costs $800" | AI estimates "fuel $600" (not registration) |
| Health insurance tracked | AI estimates "health $370" | AI estimates "medical co-pays $150" (not insurance) |

---

## Architecture

### New Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Phase 28 Architecture                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐      │
│   │  Household      │     │  Budget         │     │  Debt Planner   │      │
│   │  Profile Page   │────▶│  Analysis Page  │────▶│  (Updated)      │      │
│   └────────┬────────┘     └────────┬────────┘     └─────────────────┘      │
│            │                       │                                        │
│            ▼                       ▼                                        │
│   ┌─────────────────┐     ┌─────────────────┐                              │
│   │  household_     │     │  budget_        │                              │
│   │  profiles       │     │  analysis       │                              │
│   │  (DB table)     │     │  (DB table)     │                              │
│   └─────────────────┘     └────────┬────────┘                              │
│                                    │                                        │
│                                    ▼                                        │
│                           ┌─────────────────┐                              │
│                           │  Gemini AI      │                              │
│                           │  Variable       │                              │
│                           │  Estimation     │                              │
│                           └─────────────────┘                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User completes Household Profile
                │
                ▼
2. System fetches user's recurring expenses from DB
                │
                ▼
3. Budget Analysis calls Gemini AI with:
   - Household profile
   - List of recurring expenses (to exclude)
                │
                ▼
4. AI returns variable expense estimates
                │
                ▼
5. System calculates: Total = Recurring + Variable
                │
                ▼
6. User reviews & adjusts estimates
                │
                ▼
7. Final budget saved to budget_analysis table
                │
                ▼
8. Debt Planner uses totalRealisticBudget
```

---

## Key Principles

1. **Never Double-Count** — AI must exclude all tracked recurring expenses
2. **User Control** — User can adjust any AI estimate before saving
3. **Transparency** — Show clear breakdown: Recurring vs Variable vs Total
4. **Realistic Planning** — Debt recommendations should be achievable
5. **Australian Context** — AI tuned for Australian living costs
6. **Graceful Degradation** — System works without AI (uses benchmarks)

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Expense coverage | ~40% (recurring only) | ~95% (recurring + variable) |
| Unrealistic recommendations | Common | Rare |
| User trust in debt plans | Low | High |
| Debt payoff timeline accuracy | Optimistic | Realistic |

---

## Dependencies

### Requires
- Phase 27: Gemini AI Migration (complete)
- Phase 13: Transaction Intelligence Engine
- Phase 14: Cashflow Optimization Engine
- Prisma ORM for database

### Powers
- Debt Planner (improved accuracy)
- Cashflow Forecasting (better predictions)
- Financial Health Score (more realistic)

---

## Implementation Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 28.1 | Documentation | In Progress |
| 28.2 | Database Schema | Pending |
| 28.3 | API Endpoints | Pending |
| 28.4 | Household Profile UI | Pending |
| 28.5 | AI Variable Estimation | Pending |
| 28.6 | Budget Analysis UI | Pending |
| 28.7 | Debt Planner Integration | Pending |
| 28.8 | Testing & Validation | Pending |

---

## Testing Requirements

### Test Data
- Income: $23,061/mo
- Recurring expenses: $6,245/mo
- Household: 2 adults, 2 children, 1 dog, 2 cars
- Lifestyle: Moderate

### Expected AI Output
- Variable expenses: ~$3,600/mo
- Total budget: ~$9,850/mo
- Realistic cashflow: ~$1,364/mo
- Recommended extra payment: ~$1,200/mo

### Validation Checks
- [ ] No double-counting (pet insurance vs pet food)
- [ ] All recurring expenses excluded from AI estimate
- [ ] Debt payoff timeline is realistic
- [ ] User can adjust estimates
- [ ] Budget persists correctly

---

## Related Documentation

- [Phase 28 Database Schema](./PHASE_28_DATABASE_SCHEMA.md)
- [Phase 28 API Endpoints](./PHASE_28_API_ENDPOINTS.md)
- [Phase 28 UI Flows](./PHASE_28_UI_FLOWS.md)
- [Phase 28 AI Integration](./PHASE_28_AI_INTEGRATION.md)

---

*Status: In Progress*
*Author: Claude Code*
*Phase: 28*
