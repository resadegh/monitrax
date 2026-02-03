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

## Deployment Pipeline Fix

### Build Script Update

> **Status: FIXED** (February 2026)

**Issue:** Previous deployments using `prisma db push --accept-data-loss` caused data loss when schema changes involved dropping columns or tables.

**Root Cause:** The `--accept-data-loss` flag bypasses safety checks and allows destructive schema changes without warning.

**File Updated:**
- `package.json`

**Before (Dangerous):**
```json
"build": "prisma generate && prisma db push --accept-data-loss --skip-generate && next build"
```

**After (Safe):**
```json
"build": "prisma generate && prisma db push --skip-generate && next build"
```

**Impact:**
- Schema changes that would cause data loss will now fail the build
- Developers must explicitly handle potentially destructive changes
- Protects production data from accidental loss

**Recovery Process (if data loss occurs):**

1. Use Render's Point-in-Time Recovery (PITR)
2. Go to Render Dashboard → Database → Point-in-Time Recovery
3. Select recovery point before data loss
4. Create new database from recovery point
5. Update DATABASE_URL environment variable with new database URL (use Internal URL)
6. Redeploy application

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
| `package.json` | Build script update (removed --accept-data-loss) |
| `app/dashboard/expenses/page.tsx` | Added all expense categories for schema compatibility |

---

## Commit Reference

```
cffc9f8 fix: Improve transaction categorization and add skip option
```

---

**END OF CHANGELOG — 2026-02-03**
