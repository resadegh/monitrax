# PHASE 28 — UI FLOWS
**Monitrax Blueprint — Phase 28.4**
**Version:** v1.1
**Status:** ✅ Complete
**Created:** 2025-12-15
**Updated:** 2025-12-15

---

## Overview

Phase 28 introduces two new UI pages and updates the Debt Planner to integrate realistic budget calculations.

---

## Navigation Structure

```
Dashboard
├── Overview
├── Properties
├── Loans
├── Investments
├── Accounts
├── Income & Expenses
├── Documents
├── Planning
│   ├── Debt Planner (updated)
│   ├── Cashflow
│   ├── Goals
│   └── Household Profile ← NEW
└── Settings
```

---

## Page 1: Household Profile

**Route:** `/dashboard/planning/household-profile`

### Purpose
Collect household composition data to enable accurate AI expense estimation.

### Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Household Profile                                        [Save Profile]    │
│  Tell us about your household to get accurate budget estimates              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PROGRESS                                                            │   │
│  │  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  3 of 8 complete │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────┐  ┌──────────────────────────┐               │
│  │  HOUSEHOLD MEMBERS       │  │  VEHICLES & PETS         │               │
│  │  ─────────────────────   │  │  ─────────────────────   │               │
│  │                          │  │                          │               │
│  │  Number of Adults        │  │  Number of Cars          │               │
│  │  [  2  ▼]                │  │  [  2  ▼]                │               │
│  │                          │  │                          │               │
│  │  Number of Children      │  │  Number of Pets          │               │
│  │  [  2  ▼]                │  │  [  1  ▼]                │               │
│  │                          │  │                          │               │
│  │  Children's Ages         │  │  Pet Types               │               │
│  │  [8] [12]                │  │  [x] Dog                 │               │
│  │                          │  │  [ ] Cat                 │               │
│  └──────────────────────────┘  │  [ ] Bird                │               │
│                                │  [ ] Fish                │               │
│                                │  [ ] Other               │               │
│                                └──────────────────────────┘               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LIFESTYLE PREFERENCES                                               │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                       │   │
│  │  How would you describe your household's spending style?             │   │
│  │                                                                       │   │
│  │  ( ) FRUGAL                                                          │   │
│  │      Budget-conscious, prioritize savings, minimal discretionary     │   │
│  │                                                                       │   │
│  │  (●) MODERATE                                                        │   │
│  │      Balanced approach, reasonable discretionary spending            │   │
│  │                                                                       │   │
│  │  ( ) COMFORTABLE                                                     │   │
│  │      Higher quality choices, more convenience spending               │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  DINING & ENTERTAINMENT                                              │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                       │   │
│  │  How often does your household dine out or order takeaway?           │   │
│  │                                                                       │   │
│  │  ( ) NEVER        - Always cook at home                              │   │
│  │  ( ) RARELY       - 1-2 times per month                              │   │
│  │  (●) SOMETIMES    - About once per week                              │   │
│  │  ( ) OFTEN        - Multiple times per week                          │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  HOBBIES & ACTIVITIES (Optional)                                     │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                       │   │
│  │  List any hobbies with regular costs (helps refine estimates):       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Golf membership ($200/mo), kids soccer ($50/mo), gym ($60/mo)   │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │  Examples: gym membership, sports, streaming services not tracked    │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  [     Save & Continue to Budget Analysis     ]                      │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Form Fields

| Field | Type | Options | Required |
|-------|------|---------|----------|
| Adults Count | Select | 1, 2, 3, 4 | Yes |
| Children Count | Select | 0, 1, 2, 3, 4, 5, 6 | Yes |
| Children Ages | Number inputs | Dynamic based on count | If children > 0 |
| Cars Count | Select | 0, 1, 2, 3, 4 | Yes |
| Pets Count | Select | 0, 1, 2, 3, 4, 5 | Yes |
| Pet Types | Checkboxes | dog, cat, bird, fish, other | If pets > 0 |
| Lifestyle | Radio | FRUGAL, MODERATE, COMFORTABLE | Yes |
| Dining Frequency | Radio | NEVER, RARELY, SOMETIMES, OFTEN | Yes |
| Hobbies | Textarea | Free text | No |

### Validation

- Children ages must be 0-18
- Pet types array length must match pets count
- Children ages array length must match children count

### Completion Indicator

Shows in sidebar when profile is incomplete:
- Badge: "Complete Profile" with warning icon
- Clicking navigates to this page

---

## Page 2: Budget Analysis

**Route:** `/dashboard/planning/budget-analysis`

Alternative: Tab within `/dashboard/planning/cashflow`

### Purpose
Display AI-generated budget analysis with recurring vs variable breakdown, allowing user adjustment.

### Layout - Loading State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Budget Analysis                                          [Refresh Analysis]│
│  AI-powered estimate of your realistic monthly expenses                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │      [████████████████████████░░░░░░░░░░░░░░░░░░░░░░]                │   │
│  │                                                                       │   │
│  │      🔮 Analyzing your household expenses...                         │   │
│  │                                                                       │   │
│  │      • Fetching your recurring expenses                              │   │
│  │      • Analyzing household composition                               │   │
│  │      • Estimating variable living costs                              │   │
│  │      • Generating personalized breakdown                             │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layout - Analysis Complete

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Budget Analysis                                          [Refresh Analysis]│
│  AI-powered estimate of your realistic monthly expenses                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  BUDGET SUMMARY                                                      │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │
│  │  │  RECURRING   │  │  VARIABLE    │  │  TOTAL       │  │  MISSING │ │   │
│  │  │  (Tracked)   │  │  (AI Est.)   │  │  REALISTIC   │  │  EXPENSES│ │   │
│  │  │              │  │              │  │              │  │          │ │   │
│  │  │   $6,245     │  │   $3,605     │  │   $9,850     │  │  $3,605  │ │   │
│  │  │   /month     │  │   /month     │  │   /month     │  │  /month  │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘ │   │
│  │                                                                       │   │
│  │  ⚠️ Your tracked expenses of $6,245 are missing ~$3,605 in          │   │
│  │     variable living costs that aren't typically tracked.             │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  EXPENSE BREAKDOWN                                                   │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                       │   │
│  │  RECURRING EXPENSES (from your tracked data)            $6,245/mo    │   │
│  │  ├─ Insurance                                             $617       │   │
│  │  │  ├─ Pet Insurance (PetSure)                           $247       │   │
│  │  │  └─ Health Insurance (Medibank)                       $370       │   │
│  │  ├─ Rates & Registration                                  $478       │   │
│  │  │  ├─ Council Rates                                     $450       │   │
│  │  │  └─ Car Registration                                   $28       │   │
│  │  ├─ Utilities                                             $350       │   │
│  │  ├─ Housing                                             $2,500       │   │
│  │  └─ Other Recurring                                     $2,300       │   │
│  │                                                                       │   │
│  │  ───────────────────────────────────────────────────────────────     │   │
│  │                                                                       │   │
│  │  VARIABLE EXPENSES (AI estimated)                       $3,605/mo    │   │
│  │  ├─ Groceries & Food                       [   $1,200   ]  ⓘ HIGH   │   │
│  │  │  ℹ️ 2 adults, 2 children, moderate lifestyle                      │   │
│  │  │                                                                   │   │
│  │  ├─ Fuel & Transport                       [     $600   ]  ⓘ MED    │   │
│  │  │  ℹ️ 2 cars, estimated 60km/day average                            │   │
│  │  │  ✓ Excludes: Car Registration ($28/mo)                            │   │
│  │  │                                                                   │   │
│  │  ├─ Pet Costs (Food & Vet)                 [     $100   ]  ⓘ MED    │   │
│  │  │  ℹ️ 1 dog - food and occasional vet visits                        │   │
│  │  │  ✓ Excludes: Pet Insurance ($247/mo)                              │   │
│  │  │                                                                   │   │
│  │  ├─ Entertainment & Dining                 [     $400   ]  ⓘ MED    │   │
│  │  │  ℹ️ Family activities, dining out sometimes                       │   │
│  │  │                                                                   │   │
│  │  ├─ Kids Activities & School               [     $300   ]  ⓘ MED    │   │
│  │  │  ℹ️ 2 school-age children (8, 12), sports                         │   │
│  │  │                                                                   │   │
│  │  ├─ Personal Care & Clothing               [     $350   ]  ⓘ MED    │   │
│  │  ├─ Medical Co-pays & Pharmacy             [     $150   ]  ⓘ MED    │   │
│  │  │  ✓ Excludes: Health Insurance ($370/mo)                           │   │
│  │  │                                                                   │   │
│  │  ├─ Gifts & Miscellaneous                  [     $350   ]  ⓘ LOW    │   │
│  │  └─ Home Maintenance                       [     $155   ]  ⓘ MED    │   │
│  │                                                                       │   │
│  │  [+] Add Custom Category                                             │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SCENARIO COMPARISON                                                 │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                       │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │   │
│  │  │  MINIMUM       │  │  RECOMMENDED   │  │  COMFORTABLE   │         │   │
│  │  │  (Frugal)      │  │  (Realistic)   │  │  (Flexible)    │         │   │
│  │  │                │  │                │  │                │         │   │
│  │  │   $2,800/mo    │  │   $3,605/mo    │  │   $4,500/mo    │         │   │
│  │  │                │  │      ✓         │  │                │         │   │
│  │  │  Total:        │  │  Total:        │  │  Total:        │         │   │
│  │  │  $9,045/mo     │  │  $9,850/mo     │  │  $10,745/mo    │         │   │
│  │  │                │  │                │  │                │         │   │
│  │  │  [   Select  ] │  │  [ Selected ✓] │  │  [   Select  ] │         │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘         │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  IMPACT ON DEBT PLANNING                                             │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                       │   │
│  │  ┌──────────────────────────┐  ┌──────────────────────────┐         │   │
│  │  │  BEFORE (Tracked Only)   │  │  AFTER (Realistic)       │         │   │
│  │  │  ─────────────────────   │  │  ─────────────────────   │         │   │
│  │  │                          │  │                          │         │   │
│  │  │  Income:    $23,061      │  │  Income:    $23,061      │         │   │
│  │  │  Expenses:   $6,245      │  │  Expenses:   $9,850      │         │   │
│  │  │  Loans:     $11,847      │  │  Loans:     $11,847      │         │   │
│  │  │  ──────────────────      │  │  ──────────────────      │         │   │
│  │  │  Available:  $4,969      │  │  Available:  $1,364      │         │   │
│  │  │                          │  │                          │         │   │
│  │  │  AI Recommended:         │  │  AI Recommended:         │         │   │
│  │  │  $2,981/mo extra         │  │  $1,200/mo extra         │         │   │
│  │  │                          │  │                          │         │   │
│  │  │  ⚠️ Not achievable!     │  │  ✓ Realistic & doable   │         │   │
│  │  └──────────────────────────┘  └──────────────────────────┘         │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ACTIONS                                                             │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                       │   │
│  │  [ Use AI Recommendation ($9,850/mo) ]  ← Primary action             │   │
│  │                                                                       │   │
│  │  [ Adjust Budget Manually ]             [ Keep Tracked Only ]        │   │
│  │                                          ⚠️ Not recommended          │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Interactive Features

1. **Editable Variable Estimates**
   - Each AI estimate has an editable input field
   - Changes update the total in real-time
   - "Reset" button restores AI original

2. **Confidence Indicators**
   - HIGH: Green badge, more certain estimate
   - MED: Yellow badge, reasonable estimate
   - LOW: Orange badge, more variable/uncertain

3. **Exclusion Callouts**
   - Show what recurring expenses were excluded
   - Helps user understand no double-counting

4. **Scenario Selection**
   - Radio-style selection between 3 scenarios
   - "Custom" appears if user edits any field

5. **Before/After Comparison**
   - Visual comparison of impact on debt planning
   - Clear warning if using tracked-only

---

## Updated Page: Debt Planner

**Route:** `/dashboard/debt-planner` (existing)

### New Components

#### 1. Budget Status Banner

Shows at top when household profile is incomplete or budget analysis missing:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Your budget may be missing variable expenses                           │
│                                                                             │
│  Your tracked expenses ($6,245/mo) don't include groceries, fuel, and      │
│  other variable costs. This could make debt recommendations unrealistic.    │
│                                                                             │
│  [ Complete Household Profile → ]   [ Generate Budget Analysis → ]         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 2. Budget Mode Indicator

Shows which budget is being used:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Using: Realistic Budget ($9,850/mo)                                   [✓] │
│  └── Recurring: $6,245 + Variable: $3,605                                  │
│                                                                             │
│  [ Switch to Tracked Only ($6,245/mo) ]  ← Warning tooltip on hover        │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 3. Updated Cashflow Summary

```
CASHFLOW CALCULATION
────────────────────────────────────────────
Monthly Income                    $23,061
Monthly Expenses (realistic)      -$9,850   ← Was $6,245
  ├── Recurring (tracked)         $6,245
  └── Variable (estimated)        $3,605
Monthly Loan Repayments          -$11,847
────────────────────────────────────────────
Available for Extra Repayments     $1,364   ← Was $4,969
```

#### 4. Recommendation Validation

AI recommendations now validated against realistic budget:

```
AI RECOMMENDATION
────────────────────────────────────────────
Extra Monthly Payment: $1,200/mo           ✓ Within available cashflow

Previous recommendation (without variable expenses):
$2,981/mo - ⚠️ Would have exceeded available funds by $1,617
```

---

## User Journey

### Happy Path

```
1. User navigates to Debt Planner
                │
                ▼
2. Banner shows "Complete Household Profile"
                │
                ▼
3. User clicks → Household Profile page
                │
                ▼
4. User fills out form, clicks "Save & Continue"
                │
                ▼
5. Redirect to Budget Analysis page
                │
                ▼
6. AI generates variable expense estimates
                │
                ▼
7. User reviews, adjusts if needed
                │
                ▼
8. User clicks "Use AI Recommendation"
                │
                ▼
9. Redirect to Debt Planner with realistic budget
                │
                ▼
10. AI debt analysis now shows realistic recommendations
```

### Edge Cases

1. **User skips Budget Analysis**
   - Debt Planner works with tracked expenses only
   - Shows persistent warning banner
   - AI recommendations may be unrealistic

2. **AI unavailable**
   - Fall back to Australian benchmark data
   - Show "Estimated from benchmarks" label
   - Still better than no variable expenses

3. **User overrides AI significantly**
   - Allow it, but show confirmation
   - Store `userOverrodeAi: true`
   - Log adjustments for future AI improvement

---

## Component Hierarchy

```
app/dashboard/planning/
├── household-profile/
│   └── page.tsx
│       └── HouseholdProfileForm
│           ├── HouseholdMembersSection
│           ├── VehiclesPetsSection
│           ├── LifestyleSection
│           └── HobbiesSection
│
├── budget-analysis/
│   └── page.tsx
│       └── BudgetAnalysisView
│           ├── BudgetSummaryCards
│           ├── RecurringExpensesList
│           ├── VariableExpensesList (editable)
│           ├── ScenarioSelector
│           ├── ImpactComparison
│           └── ActionButtons
│
└── debt-planner/  (existing, updated)
    └── page.tsx
        └── DebtPlannerPage
            ├── BudgetStatusBanner (new)
            ├── BudgetModeIndicator (new)
            ├── AISmartAnalysisPanel (updated)
            └── ... existing components
```

---

## Responsive Design

### Mobile Breakpoints

| Component | Desktop | Mobile |
|-----------|---------|--------|
| Household Profile form | 2-column | 1-column |
| Budget summary cards | 4-column | 2x2 grid |
| Scenario comparison | Side-by-side | Stacked |
| Expense breakdown | Full tree | Collapsible sections |

---

## Accessibility

- All form fields have labels
- Radio groups use fieldset/legend
- Error messages associated with fields
- Keyboard navigation for scenario selection
- Screen reader announcements for totals

---

*Status: Pending Implementation*
*Author: Claude Code*
*Phase: 28.4*
