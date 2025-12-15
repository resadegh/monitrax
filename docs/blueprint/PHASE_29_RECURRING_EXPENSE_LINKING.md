# Phase 29: Recurring Payment to Expense Linking

## Overview

Phase 29 introduces intelligent linking between detected recurring payments (from bank transactions) and user-tracked expenses. This ensures accurate budget calculations by bridging automatic detection with manual expense tracking.

## Problem Statement

Prior to Phase 29:
- **Recurring Payments**: Detected automatically from bank transactions
- **Expenses**: Created manually by users for budget tracking
- **Gap**: No connection between these two systems, leading to potential duplicate tracking or missing expenses

## Solution

Phase 29 creates a bidirectional link between RecurringPayment and Expense entities, with:
1. Automatic matching suggestions
2. User confirmation workflow
3. Seamless expense creation from detected payments

## Data Model Changes

### RecurringPayment Model Additions

```prisma
model RecurringPayment {
  // ... existing fields ...

  // Phase 29: Expense Linking
  linkedExpenseId       String?           // Links to tracked expense
  matchConfidence       Float?            // Confidence score when matched (0-1)
  matchStatus           ExpenseMatchStatus @default(UNMATCHED)

  linkedExpense         Expense?          @relation("RecurringPaymentExpense", ...)
}
```

### ExpenseMatchStatus Enum

```prisma
enum ExpenseMatchStatus {
  UNMATCHED           // No expense linked, no suggestions
  SUGGESTED           // AI found a potential match
  LINKED              // User confirmed link to expense
  DISMISSED           // User dismissed match suggestion
  CREATED             // Expense was created from this recurring payment
}
```

### Expense Model Addition

```prisma
model Expense {
  // ... existing fields ...

  // Phase 29: Linked recurring payments from bank detection
  linkedRecurringPayments RecurringPayment[] @relation("RecurringPaymentExpense")
}
```

## Matching Algorithm

### Text Similarity
- Normalizes merchant names (lowercase, remove special characters)
- Compares against expense name and vendor name
- Uses word overlap + substring matching
- Minimum threshold: 50% similarity

### Amount Matching
- Compares within 10% variance tolerance
- Tracks exact difference for user review

### Frequency Matching
- Maps patterns (WEEKLY, FORTNIGHTLY, MONTHLY, etc.)
- Normalizes ANNUALLY to ANNUAL for comparison

### Composite Score
- 50% weight: Text similarity
- 25% weight: Amount match
- 25% weight: Frequency match
- Boost factor for triple match

## API Endpoints

### Match Suggestions

```
GET /api/recurring-payments/match
```

Returns match suggestions for all unlinked recurring payments.

Response:
```json
{
  "success": true,
  "data": [
    {
      "recurringPaymentId": "...",
      "merchantName": "Netflix",
      "suggestedExpense": {
        "id": "...",
        "name": "Netflix Subscription",
        "amount": 22.99
      },
      "confidence": 0.85,
      "amountMatch": true,
      "frequencyMatch": true,
      "matchReason": "Name match (85%), Amount matches, Frequency matches"
    }
  ],
  "summary": {
    "total": 10,
    "matched": 7,
    "unmatched": 3
  }
}
```

### Run Matching Algorithm

```
POST /api/recurring-payments/match
```

Runs matching algorithm and updates suggestions.

### Link to Expense

```
POST /api/recurring-payments/{id}/link
```

Body:
```json
{
  "expenseId": "existing-expense-id"
}
```

Or create new expense:
```json
{
  "createExpense": true,
  "name": "Netflix",
  "category": "SUBSCRIPTION",
  "amount": 22.99,
  "frequency": "MONTHLY"
}
```

### Unlink Expense

```
DELETE /api/recurring-payments/{id}/link
```

### Dismiss Match

```
PATCH /api/recurring-payments/{id}/link
```

## UI Components

### MatchConfirmationDialog

Shows suggested expense match with:
- Confidence score badge (High/Medium/Low)
- Side-by-side comparison
- Amount and frequency match indicators
- Actions: Confirm, Dismiss, Create New

### CreateExpenseFromRecurring

Pre-fills expense form with:
- Merchant name as expense name
- Detected amount
- Mapped frequency
- AI-suggested category based on merchant

### UntrackedPaymentsSection

Highlights untracked payments with:
- Monthly total of untracked payments
- Match suggestions banner
- Quick actions: Review Match, Add to Expenses

## Status Indicators

### On Recurring Payment Cards

| Status | Badge | Color |
|--------|-------|-------|
| LINKED/CREATED | Tracked | Green |
| SUGGESTED | Match Found | Yellow |
| DISMISSED | Dismissed | Gray |
| UNMATCHED | Not Tracked | Gray |

### On Expense Cards

- **Bank Detected** badge (blue) when linked to recurring payment

## Category Suggestions

The system suggests expense categories based on merchant name patterns:

| Keyword Match | Suggested Category |
|---------------|-------------------|
| netflix, spotify, disney | SUBSCRIPTION |
| energy, water, gas | UTILITIES |
| insurance, allianz, nrma | INSURANCE |
| opal, myki, uber | TRANSPORT |
| council, rates | RATES |

## User Workflow

1. **Detection**: System detects recurring payments from bank transactions
2. **Matching**: AI matches against existing expenses
3. **Review**: User reviews suggested matches
4. **Action**: User confirms link, creates new expense, or dismisses
5. **Tracking**: Expense becomes source of truth for budget calculations

## Benefits

1. **Accuracy**: Budget calculations include all recurring costs
2. **Efficiency**: Pre-filled forms reduce data entry
3. **Visibility**: Clear status of what's tracked vs. detected
4. **Control**: Users maintain control over expense categorization

## Technical Implementation

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modified | Added linking fields and enum |
| `lib/recurring/expenseMatcher.ts` | Created | Matching algorithm |
| `app/api/recurring-payments/match/route.ts` | Created | Match API |
| `app/api/recurring-payments/[id]/link/route.ts` | Created | Link/Unlink API |
| `components/recurring/MatchConfirmationDialog.tsx` | Created | Confirmation UI |
| `components/recurring/CreateExpenseFromRecurring.tsx` | Created | Create expense UI |
| `app/(dashboard)/recurring/page.tsx` | Modified | Added linking UI |
| `app/dashboard/expenses/page.tsx` | Modified | Added Bank Detected badge |
| `app/api/unified-transactions/recurring/route.ts` | Modified | Include linked expense |
| `app/api/expenses/route.ts` | Modified | Include linked recurring payments |

## Blueprint Reference

- Extends: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md
- Related: PHASE_03_FINANCIAL_ENGINES.md (Expense tracking)
- Related: PHASE_18_BANK_IMPORT.md (Transaction detection)
