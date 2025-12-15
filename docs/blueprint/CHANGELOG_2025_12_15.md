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

*Status: Complete*
*Author: Claude Code*
*Branch: claude/fix-budget-analysis-integration-zjyOX*
