# PHASE 29 — AI TRANSACTION CATEGORISATION & SMART IMPORT
**Monitrax Blueprint — Phase 29**
**Version:** v1.0
**Status:** Complete
**Created:** 2026-01-27
**Updated:** 2026-01-27

---

## Overview

Phase 29 introduces intelligent transaction categorisation powered by Google Gemini AI, with a learning database that improves predictions over time. The system handles QIF file imports with smart duplicate detection, overlap handling, and seamless integration with both manual imports and BASIQ Open Banking.

> "AI learns your spending patterns, so you don't have to categorise twice."

---

## Objectives

- Enable QIF file import with AI-powered transaction categorisation
- Implement smart duplicate detection with overlap handling for multiple imports
- Create a learning database that improves predictions from user confirmations
- Auto-detect recurring expenses and link/create expense entries
- Provide confidence-based review workflow (auto-accept, review, manual)
- Integrate AI categorisation with BASIQ Open Banking sync
- Allow manual imports as backup when BASIQ is enabled (data merged)

**Key Principle:** Minimal user effort — AI does the heavy lifting, user confirms.

---

## Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Transaction Import Flow                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. UPLOAD                                                               │
│  ┌─────────────────┐                                                    │
│  │ QIF/CSV File    │──▶ Parse ──▶ Normalise ──▶ NormalisedTransaction[] │
│  │ or BASIQ Sync   │                                                    │
│  └─────────────────┘                                                    │
│                                                                          │
│  2. DUPLICATE DETECTION                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ • Check import batch overlap (date range comparison)             │    │
│  │ • Exact hash matching (SHA256 of date+amount+description)       │    │
│  │ • Fuzzy matching (±3 days, ±1% amount, description similarity)  │    │
│  │ • Result: NEW | EXACT_DUPLICATE | FUZZY_DUPLICATE | MERGE       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  3. AI CATEGORISATION (Gemini)                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Check Learnings ──▶ If high confidence: use learned category    │    │
│  │       │                                                          │    │
│  │       └──▶ If not: Call Gemini AI for prediction               │    │
│  │                     • categoryLevel1, categoryLevel2             │    │
│  │                     • isEssential, isRecurring                  │    │
│  │                     • confidence score (0-1)                     │    │
│  │                     • reasoning                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  4. CONFIDENCE ADJUSTMENT                                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Base confidence from AI + Boosters - Penalties                  │    │
│  │                                                                  │    │
│  │ Boosters:                                                        │    │
│  │   +0.15 User categorised same merchant before                   │    │
│  │   +0.10 Matches existing recurring pattern                      │    │
│  │   +0.05 Well-known merchant                                     │    │
│  │                                                                  │    │
│  │ Penalties:                                                       │    │
│  │   -0.20 User previously corrected AI for this merchant          │    │
│  │   -0.10 Short/cryptic description                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  5. CLASSIFICATION                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ ≥ 0.90: AUTO_ACCEPT → Create transaction immediately           │    │
│  │ 0.70-0.89: NEEDS_REVIEW → Show in review panel                 │    │
│  │ < 0.70: MANUAL → Require manual categorisation                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  6. USER REVIEW                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Wizard mode: Step-by-step for few transactions                  │    │
│  │ Spreadsheet mode: Bulk edit for many transactions               │    │
│  │                                                                  │    │
│  │ Actions: CONFIRM | EDIT | SKIP                                  │    │
│  │ Option: Apply to all similar transactions                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  7. LEARNING                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ On confirmation:                                                 │    │
│  │   • Update MerchantMapping (increase confidence)                │    │
│  │   • Update AILearningPattern (keyword, amount range)            │    │
│  │   • Log to AICategorizationLearning for analytics               │    │
│  │                                                                  │    │
│  │ On correction:                                                   │    │
│  │   • Update MerchantMapping (set confidence to 1.0)              │    │
│  │   • Increment userCorrectionCount                               │    │
│  │   • Decrease pattern confidence for future                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  8. RECURRING EXPENSE DETECTION                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Scan confirmed transactions for patterns:                       │    │
│  │   • Same merchant, similar amount, regular frequency            │    │
│  │   • Link to existing Expense if match found (≥70%)              │    │
│  │   • Create new Expense if no match                              │    │
│  │   • isEssential affects budget calculations                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Models

```prisma
// AI Categorisation Learning - Tracks AI predictions and user corrections
model AICategorizationLearning {
  id                    String              @id @default(uuid())
  userId                String
  transactionId         String              @unique

  // AI prediction
  aiCategoryLevel1      String?
  aiCategoryLevel2      String?
  aiConfidence          Float
  aiIsEssential         Boolean
  aiIsRecurring         Boolean
  aiReasoning           String?

  // User confirmation
  finalCategoryLevel1   String?
  finalCategoryLevel2   String?
  wasEdited             Boolean             @default(false)
  source                AILearningSource
  appliedToSimilar      Boolean             @default(false)

  // Context
  merchantStandardised  String?
  amountRange           String?

  confirmedAt           DateTime?
}

// AI Learning Patterns - Stores learned patterns for prediction
model AILearningPattern {
  id                    String    @id @default(uuid())
  userId                String?   // Null = global

  patternType           String    // MERCHANT, AMOUNT_RANGE, KEYWORD
  patternValue          String
  patternHash           String

  categoryLevel1        String
  categoryLevel2        String?
  isEssential           Boolean
  isRecurring           Boolean

  confidence            Float     @default(0.5)
  matchCount            Int       @default(1)
  confirmCount          Int       @default(0)
  correctionCount       Int       @default(0)
}

// Import Batch - Tracks import sessions
model ImportBatch {
  id                    String              @id @default(uuid())
  userId                String
  accountId             String

  source                TransactionSource   // QIF, CSV, BASIQ
  fileName              String?
  fileHash              String?

  dateRangeStart        DateTime
  dateRangeEnd          DateTime

  totalTransactions     Int
  importedCount         Int
  duplicatesSkipped     Int
  aiCategorisedCount    Int
  autoAcceptedCount     Int
  needsReviewCount      Int

  status                ImportStatus
}

// Transaction Review Queue - Pending reviews
model TransactionReviewQueue {
  id                    String              @id @default(uuid())
  userId                String
  importBatchId         String?

  tempData              Json                // Transaction data

  aiCategoryLevel1      String?
  aiConfidence          Float
  aiReasoning           String?

  confidenceLevel       String              // AUTO_ACCEPT, NEEDS_REVIEW, MANUAL
  status                ImportReviewStatus

  userCategoryLevel1    String?
  applyToSimilar        Boolean
}

// User Categorisation Settings
model UserCategorizationSettings {
  id                      String    @id @default(uuid())
  userId                  String    @unique

  autoAcceptThreshold     Float     @default(0.90)
  reviewThreshold         Float     @default(0.70)
  enableAI                Boolean   @default(true)
  learnFromConfirmations  Boolean   @default(true)
  defaultApplyToSimilar   Boolean   @default(true)
}
```

### Updated Models

```prisma
// MerchantMapping - Enhanced with AI learning fields
model MerchantMapping {
  // ... existing fields ...

  // New Phase 29 fields
  isEssential           Boolean   @default(false)
  isRecurring           Boolean   @default(false)
  suggestedFrequency    String?
  aiConfidence          Float?
  userCorrectionCount   Int       @default(0)
  lastConfirmedAt       DateTime?
}
```

---

## API Endpoints

### Import Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/accounts/[id]/import` | GET | Get import history for account |
| `/api/accounts/[id]/import` | POST | Upload and process QIF file |
| `/api/accounts/[id]/import/[batchId]/review` | GET | Get review queue items |
| `/api/accounts/[id]/import/[batchId]/review` | POST | Confirm/edit reviewed transactions |

### Settings Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/settings/categorization` | GET | Get user categorization settings |
| `/api/settings/categorization` | PUT | Update categorization settings |

### Import Request/Response

```typescript
// POST /api/accounts/[id]/import
// FormData: file (QIF), preview (boolean)

// Response (preview mode)
{
  "success": true,
  "data": {
    "preview": true,
    "fileName": "transactions.qif",
    "dateRange": { "start": "2024-01-01", "end": "2024-01-31" },
    "overlap": {
      "hasOverlap": true,
      "potentialDuplicateCount": 15
    },
    "duplicates": {
      "summary": "25 new, 15 duplicates skipped",
      "statistics": { "new": 25, "exactDuplicates": 10, "fuzzyDuplicates": 5 }
    },
    "categorisation": {
      "total": 25,
      "fromLearning": 8,
      "fromAI": 17,
      "autoAccept": 12,
      "needsReview": 10,
      "requiresManual": 3
    }
  }
}

// Response (import mode)
{
  "success": true,
  "data": {
    "importBatchId": "uuid",
    "statistics": {
      "total": 40,
      "imported": 25,
      "duplicatesSkipped": 15,
      "pendingReview": 13
    },
    "requiresReview": true,
    "reviewUrl": "/accounts/xxx/import/yyy/review"
  }
}
```

---

## Key Services

### `lib/bank/aiCategorisation.ts`

| Function | Description |
|----------|-------------|
| `categoriseWithAI()` | Send transactions to Gemini for categorisation |
| `categoriseWithLearning()` | Full pipeline with learning database |
| `calculateAdjustedConfidence()` | Apply boosters and penalties |
| `classifyByConfidence()` | Split into auto/review/manual |
| `processUserConfirmation()` | Handle user confirm/edit |
| `bulkConfirmAutoAccepted()` | Auto-confirm high confidence |

### `lib/bank/aiLearning.ts`

| Function | Description |
|----------|-------------|
| `getMerchantLearnings()` | Get learned mappings for merchants |
| `getPatternLearnings()` | Get learned patterns for prediction |
| `updateMerchantLearning()` | Update mapping on confirmation |
| `updatePatternLearning()` | Update patterns on confirmation |
| `logAICategorization()` | Log for analytics |
| `applyToSimilarTransactions()` | Bulk update similar pending |

### `lib/bank/smartDuplicateDetection.ts`

| Function | Description |
|----------|-------------|
| `detectOverlap()` | Check for date range overlap |
| `detectDuplicates()` | Find duplicates in batch |
| `getDuplicateSummaryMessage()` | User-friendly summary |

### `lib/bank/recurringExpenseDetection.ts`

| Function | Description |
|----------|-------------|
| `detectRecurringPatterns()` | Find recurring transactions |
| `matchPatternsToExpenses()` | Match to existing expenses |
| `processExpenseMatches()` | Link or create expenses |

---

## UI Components

### `TransactionReviewPanel`

Two-mode review panel for categorised transactions:

**Wizard Mode:**
- Step-by-step review of individual transactions
- Shows AI prediction with confidence score
- Category selection with subcategories
- Essential/Recurring toggles
- "Apply to similar" checkbox

**Spreadsheet Mode:**
- Table view of all transactions
- Quick confirm/skip buttons
- Bulk "Confirm All" action
- Click to edit in wizard mode

---

## BASIQ Integration

### Enhanced Sync Flow

1. BASIQ syncs new transactions
2. AI categorisation pipeline applied
3. High confidence → auto-accept
4. Low confidence → queue for review
5. Learning updates from confirmations

### Manual Import as Backup

When BASIQ is enabled:
- Manual imports still allowed
- Data merged with BASIQ transactions
- Duplicates detected and skipped
- Enrichment data combined

```typescript
// canAcceptManualImport response
{
  "canImport": true,
  "isBackupMode": true,
  "warning": "Manual imports will be merged with bank data"
}
```

---

## Confidence Calculation

```
FINAL = BASE + BOOSTERS - PENALTIES (clamped to 0-1)

BASE CONFIDENCE (from Gemini):
  • Merchant clarity: 0.0 - 0.3
  • Transaction pattern: 0.0 - 0.3
  • Category certainty: 0.0 - 0.4

BOOSTERS:
  +0.15  User categorised same merchant (≥3 times)
  +0.10  User categorised same merchant (1-2 times)
  +0.10  Matches existing recurring pattern
  +0.05  Well-known merchant
  +0.05  Previous AI was confident

PENALTIES:
  -0.20  User previously corrected AI
  -0.15  Conflicting signals
  -0.10  Short/cryptic description
  -0.15  Only numbers in description

THRESHOLDS:
  ≥ 0.90: Auto-accept
  0.70-0.89: Show for review
  < 0.70: Require manual
```

---

## Files Created/Modified

### New Files

| File | Description |
|------|-------------|
| `lib/bank/aiCategorisation.ts` | AI categorisation with Gemini |
| `lib/bank/aiLearning.ts` | Learning database service |
| `lib/bank/smartDuplicateDetection.ts` | Enhanced duplicate detection |
| `lib/bank/recurringExpenseDetection.ts` | Recurring expense detection |
| `app/api/accounts/[id]/import/route.ts` | Import API endpoint |
| `app/api/accounts/[id]/import/[batchId]/review/route.ts` | Review API |
| `app/api/settings/categorization/route.ts` | Settings API |
| `components/bank/TransactionReviewPanel.tsx` | Review UI component |

### Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added new models and fields |
| `lib/bank/basiqSync.ts` | Integrated AI categorisation |

---

## Testing Checklist

- [ ] QIF file upload and parsing
- [ ] Duplicate detection (exact and fuzzy)
- [ ] AI categorisation with Gemini
- [ ] Confidence score calculation
- [ ] Auto-accept high confidence transactions
- [ ] Review queue for medium confidence
- [ ] User confirmation updates learning
- [ ] User edit updates learning
- [ ] Apply to similar transactions
- [ ] BASIQ sync with AI categorisation
- [ ] Manual import as backup with BASIQ
- [ ] Recurring expense detection
- [ ] Settings persistence
- [ ] Wizard view functionality
- [ ] Spreadsheet view functionality

---

## Future Considerations

- [ ] Streaming AI responses for large batches
- [ ] Scheduled recurring expense detection
- [ ] Category suggestion improvements
- [ ] Multi-currency support
- [ ] Export categorisation rules
- [ ] Shared learnings across organisation

---

## Post-ship hardening log

### 2026-06-10 — Gemini 429 resilience + honest degraded-import UI

Prod incident: a QIF import returned 200 with zero transactions imported. Gemini
categorisation calls hit free-tier 429 rate limits; the client had no 429 retry path; one
failed batch discarded all batch results; the confidence-0 fallback (added 2026-06-01,
PR #959) routed every transaction to `TransactionReviewQueue` while the dialog showed a
green "Import Complete!". Changes (see `docs/changelog/CHANGELOG_2026_06_10.md` for full detail):

- `lib/ai/google/geminiClient.ts` — `withModelFallbackAndRetry()`: exponential backoff on
  429/503/network errors before model fallback; error-level logging.
- `lib/bank/aiCategorisation.ts` — per-batch failure isolation in `categoriseInBatches`;
  `degraded`/`degradedReason` propagated from `categoriseWithLearning`; the unconfigured
  branch logs at error level (was silent).
- `POST /api/accounts/[id]/import` response — new optional `aiDegraded: boolean` +
  `aiDegradedReason: string | null` fields; loud `[import] AI categorisation DEGRADED` log line.
- `TransactionImportDialog` — completion screen surfaces the `requiresManual` count
  ("Needs Categorising" tile), an amber "Import received — action needed" header when AI
  degraded with 0 imported, and a safe-re-import recovery hint.

**Known gap (unchanged by this fix):** `TransactionReviewPanel` is not mounted anywhere and
the `reviewUrl` route has no page — review-queue items remain invisible
(IMPLEMENTATION_PLAN 🗑️ row 31; structural proposal Q-IMPORT-1).

---

*Status: Complete*
*Author: Claude Code*
*Phase: 29*
