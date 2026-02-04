# Changelog — 2026-02-03

## Transaction Categorization Improvements

### 13.14.6 Batch Categorization Bug Fix

> **Status: FIXED** (February 2026)

**Issue:** When categorizing transactions with batch mode (same vendor transactions), only the main transaction was being categorized while additional selected transactions remained uncategorized.

**Root Cause:** The batch categorization query was finding transactions that already had categories set or were marked as investment contributions, but then failing to update them because they didn't meet the criteria for "uncategorized".

**Files Fixed:**
- `app/api/transactions/[id]/link/route.ts`

**Fix Applied:**

The query for finding same-vendor transactions now properly filters to only include truly uncategorized transactions:

```typescript
const sameVendorTransactions = await prisma.unifiedTransaction.findMany({
  where: {
    userId,
    id: { not: transactionId },
    OR: merchantName
      ? [
          { merchantStandardised: merchantName },
          { description: { contains: merchantName, mode: 'insensitive' as const } },
        ]
      : [{ merchantStandardised: merchantName }],
    // Only uncategorized transactions (no links, not transfer, not investment)
    incomeId: null,
    expenseId: null,
    loanId: null,
    isTransfer: false,
    isInvestmentContribution: false,  // NEW: Exclude investment contributions
    categoryLevel1: null,              // NEW: Exclude transactions with category already set
  },
  orderBy: { date: 'desc' },
  take: 20,
});
```

**Impact:**
- Batch categorization now correctly updates all selected same-vendor transactions
- Investment contributions are no longer included in batch selections
- Transactions with existing categories are excluded from batch operations

---

### 13.15.8 Merchant Learning Bug Fix

> **Status: FIXED** (February 2026)

**Issue:** The "Remember category for future transactions" checkbox was not working. When categorizing transactions with a custom category and checking the learn merchant option, future transactions from the same merchant were not being suggested with the learned category.

**Root Cause:** The merchant mapping was storing the system category code (e.g., 'OTHER') instead of the actual custom category name. When the category was a custom category, the code `OTHER` was being saved, which didn't match any meaningful category for future lookups.

**Files Fixed:**
- `app/api/transactions/[id]/link/route.ts`
- `prisma/schema.prisma`

**Schema Update:**

Added `customCategoryId` field to MerchantMapping model:

```prisma
model MerchantMapping {
  // ... existing fields ...
  customCategoryId      String?   // Reference to user's custom Category if used
}
```

**Fix Applied:**

```typescript
// Learn merchant mapping for future suggestions
// Use the actual category (or custom category name if custom)
const categoryToLearn = body.customCategoryId
  ? (await prisma.category.findUnique({
      where: { id: body.customCategoryId },
      select: { name: true }
    }))?.name || body.category
  : body.category;

if (body.learnMerchant && transaction.merchantStandardised && categoryToLearn) {
  await prisma.merchantMapping.upsert({
    where: {
      userId_merchantRaw: {
        userId,
        merchantRaw: transaction.merchantStandardised,
      },
    },
    update: {
      categoryLevel1: categoryToLearn,
      customCategoryId: body.customCategoryId || null,  // NEW: Store custom category reference
      usageCount: { increment: 1 },
      updatedAt: new Date(),
    },
    create: {
      userId,
      merchantRaw: transaction.merchantStandardised,
      merchantStandardised: transaction.merchantStandardised,
      categoryLevel1: categoryToLearn,
      customCategoryId: body.customCategoryId || null,  // NEW: Store custom category reference
      source: 'USER',
      confidence: 1.0,
      usageCount: 1,
    },
  });
}
```

**Impact:**
- Custom categories are now properly saved in merchant mappings
- Future transactions from the same merchant will correctly suggest the learned category
- Both system and custom categories work with the merchant learning feature

---

### 13.13.9 Transfer Label Update

> **Status: UPDATED** (February 2026)

**Change:** Updated the transfer checkbox label to clarify that credit card repayments should also be marked as transfers.

**File Updated:**
- `components/transactions/TransactionLinkDialog.tsx`

**UI Change:**

```tsx
<Label htmlFor="isTransfer" className="text-sm font-medium cursor-pointer flex items-center gap-2">
  <ArrowRightLeft className="h-4 w-4 text-amber-600" />
  Transfer / Credit Card Repayment
</Label>
// ...
<p className="text-xs text-muted-foreground mt-1 ml-6">
  Internal transfers and credit card payments are excluded from income/expense calculations
</p>
```

**Rationale:**
- Credit card repayments are essentially internal transfers (paying off debt from another account)
- They should not be counted as expenses (the expense was recorded when the original purchase was made)
- This clarification helps users understand the correct categorization

---

### 13.17.7 Skip Transaction Button

> **Status: IMPLEMENTED** (February 2026)

**Feature:** Added a "Skip for now" button that allows users to skip the current transaction and move to the next one without categorizing it.

**File Updated:**
- `components/transactions/TransactionLinkDialog.tsx`

**Use Cases:**
- Transaction needs investigation before categorization
- User wants to batch similar transactions later
- Transaction details are unclear and need bank statement review

**Implementation:**

```tsx
{/* Skip button - allows skipping to next transaction */}
{hasMoreTransactions && onNavigateNext && (
  <div className="flex justify-end border-t pt-3">
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        onNavigateNext();
      }}
      className="text-muted-foreground"
    >
      Skip for now →
    </Button>
  </div>
)}
```

**Behavior:**
- Button only appears when there are more transactions in the queue
- Clicking navigates to the next uncategorized transaction
- Does not save any changes to the current transaction
- Allows users to return to skipped transactions later

---

## ⚠️ INCIDENT REPORT: Near Data Loss from Automated Schema Sync

### Incident Summary

> **Severity: HIGH** | **Status: RESOLVED** | **Data Lost: NONE**

On February 3, 2026, automated `prisma db push` in build scripts nearly deleted several database tables containing user data. The deployment failed before data was lost because Prisma detected destructive changes and blocked them.

### What Happened

1. Database contained legacy tables not defined in `prisma/schema.prisma`:
   - `admin_users` (1 row)
   - `admin_sessions` (1 row)
   - `import_batches` (1 row)
   - `organization_invitations` (1 row)
   - `organization_portal_settings` (1 row)
   - `transaction_review_queue` (65 rows)

2. `prisma db push` in the build script detected these tables weren't in the schema and attempted to DROP them

3. Initial attempts to add placeholder models to the schema failed because column definitions didn't match the actual database structure

4. Vercel deployments were failing with warnings about data loss

### Root Cause

- Automated `prisma db push` in build scripts
- Legacy tables existed in database but weren't documented
- No verification process for schema changes affecting existing data
- Assumption that schema was the complete source of truth

### Resolution

1. **Removed `prisma db push` from ALL build scripts**
   - Vercel: `prisma generate && next build`
   - Render: `npm install && npx prisma generate && npm run build`

2. **Schema changes are now MANUAL ONLY**
   - Must be run via Render Shell after backup
   - Requires explicit verification of changes

3. **Legacy tables documented in infrastructure documentation**
   - Tables preserved for future audit
   - Will be added to schema or dropped after verification

### Files Changed

| File | Change |
|------|--------|
| `package.json` | Removed `prisma db push` from build script |
| `render.yaml` | Removed `prisma db push` from buildCommand |
| `docs/blueprint/02_DESIGN_PRINCIPLES.md` | Added comprehensive data protection rules |
| `docs/blueprint/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` | Updated for manual schema sync |
| `docs/blueprint/MASTER_BLUEPRINT.md` | Updated build commands and added warnings |

### Prevention Measures

1. **NEVER add `prisma db push` to automated build scripts**
2. **Always verify schema changes won't drop tables with data**
3. **Document all legacy tables in infrastructure docs**
4. **Create database backup before any schema change**
5. **Review Prisma output before applying changes**

### Lessons Learned

- Database may contain tables not in schema (development artifacts, future features)
- Assuming tables are "legacy" without verification is dangerous
- Automated schema sync should be opt-in, not default
- Always ask user before any operation that could delete data

---

## Deployment Pipeline Fix

### Build Script Update

> **Status: FIXED** (February 2026)

**Issue:** `prisma db push` in build scripts could delete tables not in schema.

**Files Updated:**
- `package.json`
- `render.yaml`

**Before (DANGEROUS):**
```json
// package.json
"build": "prisma generate && prisma db push --skip-generate && next build"

// render.yaml
buildCommand: npm install && npx prisma generate && npx prisma db push && npm run build
```

**After (SAFE):**
```json
// package.json
"build": "prisma generate && next build"

// render.yaml
buildCommand: npm install && npx prisma generate && npm run build
```

**Impact:**
- Database is NEVER modified during automated builds
- Schema changes require explicit manual action
- Legacy tables are preserved

**Manual Schema Sync Procedure:**

1. Create database backup via Render Dashboard
2. Connect to Render Shell
3. Preview changes: `npx prisma db push --preview-feature`
4. If DROP statements appear, STOP and verify
5. Apply changes: `npx prisma db push`
6. Verify application works correctly

---

## Schema Changes Summary

### MerchantMapping Model Update

```prisma
model MerchantMapping {
  id                    String    @id @default(uuid())
  userId                String?
  merchantRaw           String
  merchantStandardised  String
  merchantCategoryCode  String?
  categoryLevel1        String
  categoryLevel2        String?
  subcategory           String?
  customCategoryId      String?   // NEW: Reference to user's custom Category if used
  confidence            Float     @default(1.0)
  source                String    @default("RULE")
  usageCount            Int       @default(0)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([userId, merchantRaw])
  @@index([merchantRaw])
}
```

### Migration Required

```bash
npx prisma db push
```

This update adds the `customCategoryId` field to support custom category learning in merchant mappings.

---

## Files Changed

| File | Changes |
|------|---------|
| `app/api/transactions/[id]/link/route.ts` | Batch categorization fix, merchant mapping fix |
| `components/transactions/TransactionLinkDialog.tsx` | Transfer label update, skip button |
| `prisma/schema.prisma` | customCategoryId field in MerchantMapping |
| `package.json` | Build script update (removed prisma db push) |
| `render.yaml` | Removed prisma db push from buildCommand |
| `app/dashboard/expenses/page.tsx` | Added all expense categories for schema compatibility |
| `docs/blueprint/02_DESIGN_PRINCIPLES.md` | Data preservation rules (section 6.5) |
| `docs/blueprint/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` | Manual schema sync documentation |
| `docs/blueprint/MASTER_BLUEPRINT.md` | Updated build commands with safety warnings |

---

## Commit References

```
86b9210 docs: Update infrastructure doc for manual schema management
32c7c56 fix: Remove prisma db push from Render build to protect legacy tables
e95d041 fix: Revert schema changes and remove db push from build
cffc9f8 fix: Improve transaction categorization and add skip option
aef7e66 docs: Add changelog and update documentation for Feb 2026 fixes
```

---

## Phase 30: Budget vs Actual Tracking

### Feature: Transaction-Based Actual Calculation

> **Status: IMPLEMENTED** (February 2026)

**Overview:** Fundamentally changed how income and expenses are tracked by separating budget from actual:

- **Budget** = Manual entries in Income/Expense (what user expects/plans)
- **Actual** = Calculated from linked transactions (real-time from categorized transactions)

**Key Design Decision:** Actual calculation is date-based monthly aggregation:
- 4 weekly rent payments in January = January's actual
- 5th week's payment goes to February's actual

**Why This Matters:**
- Avoids double-counting (budget and actual are separate)
- Transaction categorization becomes "tagging" not "updating amounts"
- Users can see how their actuals compare to their budget

### Files Modified

**lib/services/masterFinancialService.ts**
- Added `RawLinkedTransaction` interface for transaction data
- Added transaction fetching to `fetchAllUserData()`
- Created `calculateActualFromTransactions()` function (date-based monthly calculation)
- Created `getMonthlyActualsMap()` helper function
- Updated `calculateExpenseBudgetVariance()` to use transaction-based actuals
- Updated `calculateIncomeBudgetVariance()` to use transaction-based actuals

**app/api/income/route.ts**
- Added parallel fetching of linked transactions for current month
- Added `actualsByIncomeId` map calculation
- Response now includes: `budgetAmount`, `actualFromTransactions`, `transactionCount`, `hasTransactions`

**app/api/expenses/route.ts**
- Added parallel fetching of linked transactions for current month
- Added `actualsByExpenseId` map calculation
- Response now includes: `budgetAmount`, `actualFromTransactions`, `transactionCount`, `hasTransactions`

**app/dashboard/income/page.tsx**
- Updated interface to include new budget/actual fields
- Updated list view table with Budget and Actual columns
- Updated grouped view tables with Budget and Actual columns
- Added "No transactions" indicator when no actuals exist

**components/transactions/TransactionLinkDialog.tsx**
- **Removed** all "Link & Update Amount" buttons
- **Removed** `handleUpdateAmount` function
- **Removed** `updateAmountOnLink` state
- **Removed** `reconciliationRecommendation` from interface
- **Simplified** `handleLink` to remove `shouldUpdateAmount` parameter
- **Updated** buttons to just say "Link" instead of "Link Only"
- Linking now only tags transactions (no amount updates)

### API Response Changes

**GET /api/income**
```json
{
  "data": [{
    "id": "...",
    "name": "Rental Income",
    "amount": 1000,
    "budgetAmount": 1000,
    "actualFromTransactions": 4125.50,
    "transactionCount": 4,
    "hasTransactions": true
  }]
}
```

**GET /api/expenses**
```json
{
  "data": [{
    "id": "...",
    "name": "Electricity",
    "amount": 200,
    "budgetAmount": 200,
    "actualFromTransactions": 187.32,
    "transactionCount": 1,
    "hasTransactions": true
  }]
}
```

### UI Changes

**Income Page:**
| Name | Category | Frequency | Budget | Actual |
|------|----------|-----------|--------|--------|
| Salary | Salary | Monthly | $5,000 | $5,125.50 (+2.5%) |
| Rental | Rental | Monthly | $1,000 | $4,125.50 (+312.6%) |

- Green text with percentage when actual exceeds budget (good for income)
- Red text with percentage when actual is below budget (warning for income)
- "No transactions" displayed when no linked transactions exist

### Design Principles Applied

1. **Master Financial Service as Single Source** - All actual calculations use the centralized service
2. **Pure Calculation Functions** - `calculateActualFromTransactions()` is pure, accepts data, returns result
3. **No Amount Updates on Link** - Transaction linking = tagging only, entry amounts remain as budget
4. **Date-Based Aggregation** - Actuals grouped by transaction date into calendar months

### Impact on Financial Calculations

The Master Financial Service now:
1. Uses actual from transactions when available
2. Falls back to budget (entry amount) when no transactions linked
3. Budget variance = (actual - budget) / budget * 100

This ensures:
- Dashboard metrics reflect real transaction data
- Budget entries serve as planning/baseline
- No duplicate counting between manual entries and transactions

---

### Fix: Payment Timing Awareness for Monthly Average

> **Status: FIXED** (February 4, 2026)

**Problem:** The initial implementation always excluded the last payment (ADVANCE logic), which was incorrect for items paid in arrears like salary and utilities.

**Solution:** Payment timing is now category-aware:

| Payment Type | Categories | Calculation |
|--------------|------------|-------------|
| **ADVANCE** | Rent, Property Trust | Exclude last payment (covers future period) |
| **ARREARS** | Salary, Utilities, Insurance | Include all payments (all completed) |

**Detection Logic:**
```typescript
const isRentalCategory =
  transaction.categoryLevel1?.toUpperCase() === 'RENTAL' ||
  transaction.categoryLevel1?.toUpperCase() === 'RENT' ||
  learnedCategory?.toUpperCase() === 'RENTAL' ||
  merchantName?.toLowerCase().includes('rent') ||
  merchantName?.toLowerCase().includes('trust');

const paymentTiming = isRentalCategory ? 'ADVANCE' : 'ARREARS';
```

**Files Modified:**

**app/api/transactions/[id]/link/route.ts**
- Added `isRentalCategory` detection based on category and merchant name
- Added `paymentTiming` field to pattern detection ('ADVANCE' or 'ARREARS')
- ADVANCE: `sumForAverage = sortedTxs.slice(0, -1).reduce(...)`
- ARREARS: `sumForAverage = amounts.reduce(...)`

**components/transactions/TransactionLinkDialog.tsx**
- Updated `TransactionPattern` interface with `paymentTiming` field
- UI shows "(paid in advance)" for ADVANCE payments
- UI shows "(Last payment excluded - covers future period)" for ADVANCE

**UI Display Examples:**

For Rental (ADVANCE):
```
Pattern Detected
6 transactions over 2.3 months (paid in advance)
Monthly Average: $5,610
(Last payment excluded - covers future period)
```

For Salary (ARREARS):
```
Pattern Detected
3 transactions over 3.0 months
Monthly Average: $5,000
```

**Impact:**
- Salary averages now correctly include all payments
- Utility bills correctly include all payments
- Only rental/property income excludes the last payment
- More accurate monthly averages for budgeting

---

## Commits Summary (February 3-4, 2026)

```
5a3f7fe docs: Document payment timing awareness for monthly average
2b94f6b fix: Use correct payment timing for monthly average calculation
d69faf2 docs: Update documentation for Budget vs Actual feature
c532903 fix: Remove prisma db push from build to prevent data loss
88d157e fix: Calculate true monthly average for advance payments
e4b7a86 fix: Remove remaining reconciliationRecommendation reference
23ae8a2 feat: Implement budget vs actual tracking from transactions
```

---

## Phase 29: Household Profile Redesign

### Session: redesign-onboarding-household-Si95G

> **Status: IMPLEMENTED** (February 2026)

### Overview

Complete redesign of the onboarding wizard and household profile system to capture detailed household member and pet information, with automatic category generation based on household composition.

### Key Changes

#### 1. Database Schema Updates

Added new models and enums to `prisma/schema.prisma`:

```prisma
enum HouseholdRelationship {
  SELF
  SPOUSE
  PARTNER
  CHILD
  PARENT
  SIBLING
  OTHER
}

enum HouseholdPetType {
  DOG
  CAT
  BIRD
  FISH
  RABBIT
  REPTILE
  OTHER
}

model HouseholdMember {
  id                    String   @id @default(uuid())
  householdProfileId    String
  name                  String
  relationship          HouseholdRelationship
  dateOfBirth           DateTime?
  isIncomeEarner        Boolean  @default(false)
  sortOrder             Int      @default(0)
  // Relations and indexes...
  linkedCategories      Category[] @relation("MemberLinkedCategories")
}

model HouseholdPet {
  id                    String   @id @default(uuid())
  householdProfileId    String
  name                  String
  type                  HouseholdPetType
  breed                 String?
  sortOrder             Int      @default(0)
  // Relations and indexes...
  linkedCategories      Category[] @relation("PetLinkedCategories")
}
```

Updated `HouseholdProfile` model:
- Added `needsMigration` field for existing users
- Added relations to `HouseholdMember[]` and `HouseholdPet[]`

Updated `Category` model:
- Added `householdMemberId` optional field
- Added `householdPetId` optional field
- Added relations for member/pet category linking

#### 2. Automatic Category Generation Service

Created `lib/services/householdCategoryService.ts`:

- **Member Categories** (auto-created when adding household members):
  - Income earners: Salary, Super Contributions, Work Expenses, Health Insurance
  - Non-earner adults: Personal Spending, Health Expenses, Entertainment
  - Children: School Fees, Childcare, Kids Activities, Medical

- **Pet Categories** (auto-created when adding pets):
  - Food & Supplies, Vet Visits, Insurance, Grooming

- **Category Orphaning**: When members/pets are deleted, categories are preserved but unlinked (orphaned) to maintain expense history

#### 3. API Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/household-members` | GET, POST | List/create household members |
| `/api/household-members/[id]` | GET, PUT, DELETE | Member CRUD operations |
| `/api/household-pets` | GET, POST | List/create household pets |
| `/api/household-pets/[id]` | GET, PUT, DELETE | Pet CRUD operations |

#### 4. Onboarding Wizard Integration

- Added 'household' step as the FIRST step after welcome
- Step collects:
  - Household members with names, relationships, DOB
  - Pets with names, types, breeds
  - Vehicle count for lifestyle context

Updated files:
- `components/onboarding/wizard/types.ts` - Types and step definition
- `components/onboarding/wizard/steps/HouseholdStep.tsx` - New step component
- `components/onboarding/wizard/WizardContainer.tsx` - Step registration
- `components/onboarding/wizard/AIHelper.tsx` - AI helper context

#### 5. Household Profile Page Redesign

Complete UI overhaul of `app/dashboard/household-profile/page.tsx`:
- Card-based display for members and pets
- Add/Edit/Delete dialogs with form validation
- Shows auto-created categories per member/pet
- Migration prompt for existing users without named members
- Lifestyle preferences section preserved

#### 6. Navigation Updates

Updated `components/DashboardLayout.tsx`:
- Moved "Household" to top of sidebar (after Dashboard)
- Removed from Planning group
- Now a standalone navigation item

### Files Created

| File | Purpose |
|------|---------|
| `lib/services/householdCategoryService.ts` | Auto-category generation |
| `app/api/household-members/route.ts` | Members list/create API |
| `app/api/household-members/[id]/route.ts` | Member detail API |
| `app/api/household-pets/route.ts` | Pets list/create API |
| `app/api/household-pets/[id]/route.ts` | Pet detail API |
| `components/onboarding/wizard/steps/HouseholdStep.tsx` | Wizard step |

### Files Modified

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | New enums, models, relations |
| `app/api/household-profile/route.ts` | Include members/pets in response |
| `app/dashboard/household-profile/page.tsx` | Complete redesign |
| `components/DashboardLayout.tsx` | Navigation reorder |
| `components/onboarding/wizard/types.ts` | Household types and step |
| `components/onboarding/wizard/WizardContainer.tsx` | Register household step |
| `components/onboarding/wizard/AIHelper.tsx` | Add household context |

### Design Decisions

1. **Categories are auto-created immediately** - Usable app-wide as soon as members/pets are added
2. **Category orphaning on delete** - Preserves expense history, allows reassignment
3. **Migration path for existing users** - `needsMigration` flag triggers prompt
4. **Pre-population from Clerk** - Primary user info pulled from authentication
5. **No data overwrite** - Additive schema changes only

### Testing

- [x] Build passes (`npm run build`)
- [x] Prisma generates successfully
- [x] No breaking changes to existing data

---

**END OF CHANGELOG — 2026-02-03**
