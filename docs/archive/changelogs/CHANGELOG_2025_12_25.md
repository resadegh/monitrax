# Changelog — 2025-12-25

## Investment Contribution Tracking

### Problem
When money flows from a bank account to an investment account (shares, crypto, managed funds):
- It appears as an outgoing transaction in the bank account
- It is NOT an expense (no consumption occurred)
- It is NOT a simple transfer (the value will change over time)
- There was no correct way to categorize/track this type of transaction

### Solution
Added **Investment Contribution** as a new transaction categorization option.

### Changes

**Schema (`prisma/schema.prisma`):**
- Added `isInvestmentContribution` boolean field to `UnifiedTransaction`
- Added `investmentTransactionId` unique field to link to `InvestmentTransaction`

**API (`app/api/transactions/[id]/link/route.ts`):**
- Added new action: `investment`
- Creates `DEPOSIT` type `InvestmentTransaction` when recording contribution
- Updates investment account `cashBalance`
- Cleans up on unlink (deletes transaction, reverses balance)

**UI (`components/transactions/TransactionLinkDialog.tsx`):**
- Added "This is an investment contribution" checkbox option
- Added investment account selector dropdown
- Added purple-themed styling for investment contributions
- Updated current link display to show investment contributions

### How It Works

1. User imports/views bank transactions
2. For outgoing money to investment account, user selects "This is an investment contribution"
3. User selects target investment account from dropdown
4. System:
   - Creates a DEPOSIT InvestmentTransaction in the investment account
   - Links the bank transaction to the investment account
   - Increments the investment account's cash balance
   - Excludes from expense calculations

### Financial Impact

- ✅ Excluded from expense totals
- ✅ Excluded from income totals
- ✅ Tracked in Net Worth calculations (as part of investment account value)
- ✅ Visible in investment account transaction history
- ✅ Used for cost basis calculations when selling holdings

### Recurring Investment Contributions

Investment contributions can be marked as recurring:

1. Check "Recurring investment contribution" checkbox
2. Select frequency (Weekly, Fortnightly, Monthly, Quarterly, Annual)
3. System will:
   - Mark the bank transaction as recurring
   - Learn the merchant mapping for future auto-suggestions
   - Label the investment transaction with the frequency

**Use cases:**
- Regular superannuation contributions
- Monthly share purchases
- Recurring crypto deposits
- Dollar-cost averaging strategies

### Migration Required

```bash
npx prisma migrate dev --name add_investment_contribution_tracking
```
