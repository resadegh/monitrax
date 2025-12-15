# Changelog — 2025-12-15

## Phase 28.6: Debt Analysis Integration Fix

### Summary

Fixed critical issue where the AI Debt Strategy Advisor was using incorrect values for available cashflow ($220,508 instead of $494). The fix ensures the frontend passes the correct pre-calculated `availableForDebt` value directly to the API, guaranteeing consistency between the UI display and AI recommendations.

---

### Root Cause Analysis

**Problem:** The Debt Planner UI correctly showed $494 available for extra payments, but the AI was recommending amounts based on $220,508.

**Root Cause:** Two separate calculation paths existed:
1. **Frontend (correct):** Used `/api/calculate/cashflow` API which applies proper NET income calculation
2. **Backend (incorrect):** Independently calculated `availableForExtraRepayments` using database values directly

The backend's calculation didn't match the frontend's cashflow API calculation, resulting in wildly different values.

**Solution:** Pass the frontend's pre-calculated `availableForDebt` value to the API, ensuring the AI uses the exact same value shown in the UI.

---

### Files Modified

#### app/dashboard/debt-planner/page.tsx
| Change | Description |
|--------|-------------|
| Line 252-254 | Added `availableForExtraRepayments` to request body |
| | Passes `budgetStatus?.availableForDebt` from confirmed budget |

```typescript
// NEW: Pass the pre-calculated availableForDebt from confirmed budget
body: JSON.stringify({
  availableForExtraRepayments: budgetStatus?.availableForDebt || 0,
}),
```

#### app/api/ai/debt-analysis/route.ts
| Change | Description |
|--------|-------------|
| Lines 77-83 | Added request body parsing for `availableForExtraRepayments` |
| Lines 195-212 | Modified to use frontend value if provided |
| | Added detailed logging to track value source |

```typescript
// Parse request body to get pre-calculated availableForExtraRepayments from frontend
let requestBody: { availableForExtraRepayments?: number } = {};
try {
  requestBody = await authReq.json();
} catch {
  // No body provided - will calculate on server side
}

// Use frontend value if provided, otherwise fall back to server calculation
const calculatedAvailable = Math.max(0, monthlySurplus - totalLoanRepayments);
const availableForExtraRepayments = requestBody.availableForExtraRepayments !== undefined
  && requestBody.availableForExtraRepayments >= 0
  ? requestBody.availableForExtraRepayments
  : calculatedAvailable;
```

---

### Data Flow (After Fix)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Debt Analysis Data Flow (Fixed)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. BUDGET CONFIRMATION                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ Budget Analysis Page → User confirms → BudgetAnalysis saved         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│   2. DEBT PLANNER PAGE LOAD          ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ Fetch /api/budget-analysis/latest                                    │   │
│   │ Fetch /api/calculate/cashflow  ← Uses NET income calculation        │   │
│   │ Calculate: availableForDebt = monthlyIncome - budget - loanPayments │   │
│   │ Display: "$494/mo available"                                         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│   3. AI ANALYSIS REQUEST             ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ POST /api/ai/debt-analysis                                           │   │
│   │ Body: { availableForExtraRepayments: 494 }  ← SAME VALUE AS UI      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│   4. API PROCESSING                  ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ Use frontend value ($494) for prompt and validation                  │   │
│   │ Server-side validation FORCES correct surplus values:                │   │
│   │   • Minimum: $148 (30% of $494)                                      │   │
│   │   • Recommended: $296 (60% of $494)                                  │   │
│   │   • Aggressive: $445 (90% of $494)                                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sidebar Navigation Reorder

### Summary

Reordered the Planning section in the sidebar navigation to follow the logical data flow sequence that users should follow.

### Previous Order
1. Cashflow
2. Financial Health
3. Strategy
4. Household Profile
5. Budget Analysis
6. Debt Planner
7. Tax Calculator

### New Order
1. **Household Profile** — Set up household composition first
2. **Budget Analysis** — Generate and confirm realistic budget
3. **Debt Planner** — Plan debt repayment using confirmed budget
4. **Cashflow** — View overall cashflow projections
5. **Financial Health** — Monitor financial health score
6. **Tax Calculator** — Calculate tax estimates
7. Strategy — Overall financial strategy

### File Modified

#### components/DashboardLayout.tsx
| Change | Description |
|--------|-------------|
| Lines 105-113 | Reordered `navGroups[2].items` (Planning group) |

---

### Commits

| Hash | Message |
|------|---------|
| `34ed3a7` | fix(debt-analysis): pass availableForDebt from frontend to API |
| `3f466b7` | chore(sidebar): reorder Planning menu items for logical flow |

---

### Testing Verification

After deployment, verify:

1. **UI Header:** Shows correct available amount (e.g., $494)
2. **AI Recommendations:**
   - Minimum ≈ 30% of available ($148)
   - Recommended ≈ 60% of available ($296)
   - Aggressive ≈ 90% of available ($445)
3. **Server Logs:** Should show:
   ```
   [API] Debt Analysis - Cash Flow Breakdown:
     Frontend Provided Available: $494
     >>> USING Available for Extra: $494 <<<
   ```

---

### Related Documentation

- Phase 27: AI Migration to Gemini (`PHASE_27_GEMINI_AI_MIGRATION.md`)
- Phase 28: Budget Analysis Integration (`PHASE_28_REALISTIC_BUDGET.md`)
- Phase 28: AI Integration (`PHASE_28_AI_INTEGRATION.md`)

---

---

## Phase 28.7: Persist AI Debt Analysis

### Summary

AI debt analysis results now persist across page loads and navigation. Users no longer lose their analysis when refreshing or navigating away from the Debt Planner page.

### Database Changes

New table `debt_analyses`:

| Column | Type | Description |
|--------|------|-------------|
| id | String | UUID primary key |
| userId | String | Foreign key to User |
| analysisDate | DateTime | When analysis was generated |
| summary | Text | AI summary text |
| debtHealthScore | Int | 0-100 health score |
| recommendedStrategy | String | TAX_AWARE, AVALANCHE, or SNOWBALL |
| strategyReason | Text | Why this strategy was recommended |
| surplusMinimum | Float | 30% of available |
| surplusRecommended | Float | 60% of available |
| surplusAggressive | Float | 90% of available |
| surplusReasoning | Text | Explanation for surplus amounts |
| keyInsights | Json | Array of insights |
| loanPriority | Json | Array of loan priorities |
| actionPlan | Json | Array of action steps |
| projections | Json | Debt-free date, savings, etc. |
| warnings | Json | Array of warning strings |
| totalDebt | Float | Total debt at analysis time |
| monthlyIncome | Float | NET income used |
| monthlyExpenses | Float | Budget used |
| availableForExtra | Float | Available for extra repayments |
| loanCount | Int | Number of loans |

### New API Endpoint

**GET /api/ai/debt-analysis/latest**

Returns the most recent saved debt analysis for the authenticated user.

```typescript
// Response
{
  success: true,
  data: {
    analysis: { /* Full AIAnalysis object */ },
    context: { /* Context at time of analysis */ },
    savedAt: "2025-12-15T10:30:00Z"
  }
}
```

### Files Created

| File | Purpose |
|------|---------|
| `app/api/ai/debt-analysis/latest/route.ts` | GET endpoint to fetch saved analysis |

### Files Modified

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added DebtAnalysis model |
| `app/api/ai/debt-analysis/route.ts` | Added save to database after generation |
| `app/dashboard/debt-planner/page.tsx` | Load saved analysis on page mount, show "Last generated" date |

### User Experience

1. **First visit**: User clicks "Get AI Analysis" to generate recommendations
2. **Analysis saved**: Results automatically saved to database
3. **Return visit**: Analysis loads automatically on page load
4. **Refresh**: User can click "Refresh Analysis" to regenerate with latest data
5. **Timestamp**: UI shows "Last generated: 15 Dec 2025, 10:30 AM"

### Commits

| Hash | Message |
|------|---------|
| `226944d` | feat(debt-planner): persist AI debt analysis across page loads |

---

*Status: Complete*
*Author: Claude Code*
*Branch: claude/fix-budget-analysis-integration-zjyOX*

---

## Phase 29: Recurring Payment to Expense Linking

### Summary

Introduced intelligent linking between detected recurring payments (from bank transactions) and user-tracked expenses. This bridges the gap between automatic detection and manual expense tracking to ensure accurate budget calculations.

### Problem Solved

Prior to Phase 29:
- **Recurring Payments**: Detected automatically from bank transactions
- **Expenses**: Created manually by users for budget tracking
- **Gap**: No connection between these two systems

Users couldn't tell which detected recurring payments were already tracked in their expenses, potentially leading to duplicate tracking or missing expenses in budget calculations.

### Solution

1. **Data Model**: Added `linkedExpenseId`, `matchConfidence`, and `matchStatus` fields to `RecurringPayment`
2. **Matching Algorithm**: Text similarity + amount matching + frequency matching with confidence scores
3. **User Workflow**: Review match suggestions, confirm links, or create new expenses

### Database Changes

```prisma
enum ExpenseMatchStatus {
  UNMATCHED           // No expense linked
  SUGGESTED           // AI found potential match
  LINKED              // User confirmed link
  DISMISSED           // User dismissed suggestion
  CREATED             // Expense created from recurring payment
}

model RecurringPayment {
  // ... existing fields ...
  linkedExpenseId       String?
  matchConfidence       Float?
  matchStatus           ExpenseMatchStatus @default(UNMATCHED)
  linkedExpense         Expense?          @relation("RecurringPaymentExpense", ...)
}

model Expense {
  // ... existing fields ...
  linkedRecurringPayments RecurringPayment[] @relation("RecurringPaymentExpense")
}
```

### New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/recurring-payments/match` | GET | Get match suggestions |
| `/api/recurring-payments/match` | POST | Run matching algorithm |
| `/api/recurring-payments/{id}/link` | POST | Link to expense or create new |
| `/api/recurring-payments/{id}/link` | DELETE | Unlink from expense |
| `/api/recurring-payments/{id}/link` | PATCH | Dismiss match suggestion |

### New UI Components

| Component | Purpose |
|-----------|---------|
| `MatchConfirmationDialog` | Review and confirm suggested matches |
| `CreateExpenseFromRecurring` | Create expense with pre-filled data |
| `UntrackedPaymentsSection` | Highlights untracked payments |

### UI Indicators

**On Recurring Payment Cards:**
- Tracked (green): Linked to expense
- Match Found (yellow): Suggestion available
- Not Tracked (gray): No link

**On Expense Cards/List:**
- Bank Detected (blue): Linked to recurring payment

### Files Created

| File | Purpose |
|------|---------|
| `lib/recurring/expenseMatcher.ts` | Matching algorithm |
| `app/api/recurring-payments/match/route.ts` | Match API |
| `app/api/recurring-payments/[id]/link/route.ts` | Link API |
| `components/recurring/MatchConfirmationDialog.tsx` | Confirmation dialog |
| `components/recurring/CreateExpenseFromRecurring.tsx` | Create expense dialog |
| `components/recurring/index.ts` | Component exports |
| `docs/blueprint/PHASE_29_RECURRING_EXPENSE_LINKING.md` | Full documentation |

### Files Modified

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added linking fields and enum |
| `app/(dashboard)/recurring/page.tsx` | Full UI rewrite with linking |
| `app/dashboard/expenses/page.tsx` | Added Bank Detected badge |
| `app/api/unified-transactions/recurring/route.ts` | Include linked expense |
| `app/api/expenses/route.ts` | Include linked recurring payments |

### User Workflow

1. System detects recurring payments from bank transactions
2. User clicks "Find Matches" to run matching algorithm
3. Payments with matches show "Match Found" badge
4. User clicks "Review" to see suggested expense
5. User can: Confirm Match, Dismiss, or Create New Expense
6. Linked payments show "Tracked" status
7. Expenses show "Bank Detected" badge

---

*Status: Complete*
*Author: Claude Code*
*Branch: claude/review-recurring-payments-docs-6hNyk*
