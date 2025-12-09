# MONITRAX CHANGELOG — December 9, 2025

**Session ID:** claude/fix-previous-error-01BJrHJxXdGSZNdC9KfdKiJa
**Date:** 2025-12-09
**Status:** Implemented & Pushed

---

## Summary of Changes

This session addressed multiple bug fixes across the onboarding system, income input validation, cashflow forecasting engine, and dashboard display accuracy.

---

## 1. Onboarding "Do Not Show Again" Fix

**Type:** Bug Fix
**Severity:** High
**Files Modified:**
- `hooks/useOnboardingState.ts`
- `components/onboarding/OnboardingWelcomeModal.tsx`
- `components/onboarding/TourTooltip.tsx`
- `components/onboarding/GuidedTour.tsx`
- `app/api/onboarding/state/route.ts`

### Problem
The "Don't show this again" checkbox on the welcome modal and tour was not persisting. The modal would reappear on every dashboard visit because:
1. `onDismissPermanently()` was an async function called without `await`
2. The API returned success even when the database update failed
3. No fallback mechanism existed for when the DB save failed

### Solution

#### 1.1 Added localStorage Fallback
```typescript
// LocalStorage key for fallback when DB is unavailable
const DISMISSED_WELCOME_KEY = 'monitrax_dismissed_welcome_modal';

function isWelcomeDismissedLocally(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DISMISSED_WELCOME_KEY) === 'true';
  } catch {
    return false;
  }
}

function setWelcomeDismissedLocally(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DISMISSED_WELCOME_KEY, 'true');
  } catch {
    // Ignore localStorage errors
  }
}
```

#### 1.2 Updated dismissWelcomeModal Hook
```typescript
const dismissWelcomeModal = useCallback(async () => {
  // Always save to localStorage as fallback (works even if DB fails)
  setWelcomeDismissedLocally();
  // Try to save to DB as well
  try {
    await updateState({ dismissWelcomeModal: true });
  } catch {
    console.warn('Could not save dismiss preference to DB, using localStorage fallback');
  }
}, [updateState]);
```

#### 1.3 Updated shouldShowWelcome Logic
```typescript
const dismissedViaLocalStorage = isWelcomeDismissedLocally();
const shouldShowWelcome = !isLoading && !dismissedViaLocalStorage && (
  state === null || // API failed - check localStorage fallback above
  (!state.preferences.dismissedWelcomeModal &&
    !state.preferences.hasSeenGuidedTour &&
    !state.preferences.tourSkippedAt)
);
```

#### 1.4 Fixed Async Handling in Components
Changed `handleSkip` to properly await async operations:
```typescript
const handleSkip = async () => {
  if (dontShowAgain && onDismissPermanently) {
    try {
      await onDismissPermanently();
    } catch (e) {
      console.warn('Could not save permanent dismiss preference:', e);
    }
  }
  onSkip();
};
```

#### 1.5 Fixed API Error Handling
```typescript
let prefUpdateFailed = false;
if (Object.keys(prefUpdate).length > 0) {
  try {
    await prisma.userPreference.upsert({...});
  } catch (dbError) {
    console.warn('Could not update user preferences:', dbError);
    prefUpdateFailed = true;
  }
}

if (prefUpdateFailed) {
  return NextResponse.json(
    { success: false, error: 'Could not save preferences.' },
    { status: 500 }
  );
}
```

---

## 2. Income Amount Input Fix

**Type:** Bug Fix
**Severity:** Medium
**Files Modified:**
- `app/dashboard/income/page.tsx`

### Problem
Income amount inputs only accepted increments of 100 (e.g., 3900, 4000) due to `step="100"` attribute. Users could not enter exact values like 3922.

### Solution
Changed `step="100"` to `step="any"` for income-related inputs:
```tsx
<Input
  type="number"
  placeholder={formData.salaryType === 'GROSS' ? '85000' : '65000'}
  min="0"
  step="any"  // Changed from step="100"
  required
/>
```

**Inputs Fixed:**
- Salary/income amount field
- Salary sacrifice amount field

---

## 3. Cashflow Forecasting Income Calculation Fix

**Type:** Bug Fix
**Severity:** Critical
**Files Modified:**
- `lib/cashflow/forecasting.ts`

### Problem
The `generateIncomeTimeline` function had three critical bugs:

1. **Double conversion bug**: `monthlyAmount` was already normalized to monthly by the API, but the forecasting engine multiplied it again (4.33x for weekly, 2.17x for fortnightly). This caused weekly income to appear ~4x higher than actual.

2. **First occurrence skip**: The code added `intervalDays` before the while loop, causing the first income payment to be skipped.

3. **Annual income bug**: Divided an already-monthly amount by 12, making annual income appear 12x lower than actual.

### Before (Buggy Code)
```typescript
let nextDate = income.nextExpected ? new Date(income.nextExpected) : new Date(today);
nextDate.setDate(nextDate.getDate() + intervalDays);  // BUG: Skips first occurrence

const monthlyAmount =
  income.frequency === 'WEEKLY'
    ? income.monthlyAmount * 4.33  // BUG: Double conversion
    : income.frequency === 'FORTNIGHTLY'
      ? income.monthlyAmount * 2.17  // BUG: Double conversion
      : income.frequency === 'ANNUAL'
        ? income.monthlyAmount / 12  // BUG: Should multiply, not divide
        : income.monthlyAmount;

const perOccurrence = monthlyAmount / (30 / intervalDays);
```

### After (Fixed Code)
```typescript
// Start from nextExpected if provided, otherwise start from today
let nextDate = income.nextExpected ? new Date(income.nextExpected) : new Date(today);

// If nextExpected is in the past, advance to next occurrence
while (nextDate < today) {
  nextDate.setDate(nextDate.getDate() + intervalDays);
}

// Calculate per-occurrence amount from monthly amount
// monthlyAmount is already normalized to monthly by the API
let perOccurrence: number;
switch (income.frequency) {
  case 'WEEKLY':
    perOccurrence = (income.monthlyAmount * 12) / 52; // Monthly → Weekly
    break;
  case 'FORTNIGHTLY':
    perOccurrence = (income.monthlyAmount * 12) / 26; // Monthly → Fortnightly
    break;
  case 'ANNUAL':
    perOccurrence = income.monthlyAmount * 12; // Monthly → Annual
    break;
  case 'MONTHLY':
  default:
    perOccurrence = income.monthlyAmount; // Already monthly
    break;
}
```

### Impact
| Frequency | Before (Bug) | After (Fixed) | Example ($1000/week) |
|-----------|-------------|---------------|---------------------|
| Weekly | ~4x too high | Correct | $4377 → $1000/week |
| Fortnightly | ~2x too high | Correct | $4377 → $2000/fortnight |
| Monthly | Correct | Correct | $5000/month |
| Annual | 12x too low | Correct | $83 → $12000/year |

---

## 4. Dashboard Annual Outgoings Fix

**Type:** Bug Fix / UX Improvement
**Severity:** Medium
**Files Modified:**
- `app/dashboard/page.tsx`

### Problem
The "Annual Expenses" tile on the dashboard only showed expenses without loan repayments. This gave users an inaccurate picture of their total outgoing money.

### Solution
Renamed tile to "Annual Outgoings" and included both expenses and loan repayments:

```tsx
<Card className="border-l-4 border-l-orange-500">
  <CardHeader className="pb-3">
    <CardTitle className="flex items-center gap-2 text-lg">
      <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50">
        <ArrowDownRight className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      </div>
      Annual Outgoings
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold text-orange-700 dark:text-orange-400">
      {formatCurrency(snapshot.cashflow.totalExpenses + (snapshot.cashflow.totalLoanRepayments || 0))}
    </div>
    <p className="text-sm text-muted-foreground mt-1">
      {formatCurrency((snapshot.cashflow.totalExpenses + (snapshot.cashflow.totalLoanRepayments || 0)) / 12)}/month
    </p>
    <div className="mt-2 pt-2 border-t text-xs text-muted-foreground space-y-1">
      <div className="flex justify-between">
        <span>Expenses</span>
        <span>{formatCurrency(snapshot.cashflow.totalExpenses)}</span>
      </div>
      <div className="flex justify-between">
        <span>Loan Repayments</span>
        <span>{formatCurrency(snapshot.cashflow.totalLoanRepayments || 0)}</span>
      </div>
    </div>
  </CardContent>
</Card>
```

### Visual Change
| Before | After |
|--------|-------|
| Annual Expenses: $24,000 | Annual Outgoings: $60,000 |
| | Expenses: $24,000 |
| | Loan Repayments: $36,000 |

---

## Files Summary

| Action | File | Change Type |
|--------|------|-------------|
| Modified | `hooks/useOnboardingState.ts` | localStorage fallback |
| Modified | `components/onboarding/OnboardingWelcomeModal.tsx` | Async handling |
| Modified | `components/onboarding/TourTooltip.tsx` | Async handling |
| Modified | `components/onboarding/GuidedTour.tsx` | Type signature |
| Modified | `app/api/onboarding/state/route.ts` | Error handling |
| Modified | `app/dashboard/income/page.tsx` | Input validation |
| Modified | `lib/cashflow/forecasting.ts` | Income calculation |
| Modified | `app/dashboard/page.tsx` | Outgoings display |
| Created | `docs/blueprint/CHANGELOG_2025_12_09.md` | This document |

---

## Testing Notes

- TypeScript compilation passes (`npx tsc --noEmit`)
- All changes maintain backward compatibility
- localStorage fallback works in private/incognito mode
- Cashflow forecast numbers now match expected values

---

## Related Blueprint Phases

- **Phase 7** — Dashboard Rebuild (Annual Outgoings fix)
- **Phase 12** — Onboarding Tour (localStorage fallback, async handling)
- **Phase 14** — Cashflow Optimisation Engine (Income timeline fix)

---

*Document Version: 1.0*
*Created: 2025-12-09*
