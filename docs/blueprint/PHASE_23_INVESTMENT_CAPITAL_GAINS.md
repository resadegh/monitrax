# Phase 23: Investment & Capital Gains Tracking Engine

**Version:** 1.0
**Status:** In Development
**Priority:** High
**Dependencies:** Phase 3 (Investments), Phase 20 (Tax Intelligence)
**Created:** 2025-12-04

---

## 1. Executive Summary

Phase 23 enhances the investment module to provide comprehensive tracking of:
- Investment account opening dates and balances
- Deposit and withdrawal tracking
- Current market values with price updates
- Purchase lot (parcel) tracking for accurate cost basis
- Capital gains/losses calculation with CGT discount support
- Financial year tax reporting for shares, ETFs, crypto, and other assets

**Core Principle:** Users should be able to accurately calculate their capital gains tax liability without external spreadsheets or manual calculations.

---

## 2. Scope

### 2.1 In Scope

- Investment account opening date and initial balance
- Cash balance tracking (deposits/withdrawals)
- Current price and value tracking for holdings
- Purchase lot (parcel) tracking for CGT
- Capital gain event recording when selling
- CGT discount calculation (50% for assets held 12+ months)
- Financial year rollups for tax reporting
- Support for shares, ETFs, managed funds, and crypto

### 2.2 Out of Scope (Future Phases)

- Real-time price feeds (manual entry for now)
- Corporate actions automation (stock splits, mergers)
- Crypto-specific tracking (staking rewards, airdrops)
- International tax treaty considerations
- SMSF-specific rules

---

## 3. Data Model

### 3.1 New Enums

```prisma
enum InvestmentTransactionType {
  BUY
  SELL
  DIVIDEND
  DISTRIBUTION
  DRP
  DEPOSIT           // Cash deposit into account
  WITHDRAWAL        // Cash withdrawal from account
  TRANSFER_IN       // Assets transferred in
  TRANSFER_OUT      // Assets transferred out
  CORPORATE_ACTION  // Stock splits, mergers, etc.
}

enum CostBasisMethod {
  FIFO              // First In, First Out (ATO default)
  LIFO              // Last In, First Out
  HIFO              // Highest In, First Out
  SPECIFIC          // Specific identification
  AVERAGE           // Average cost (for managed funds)
}

enum CapitalGainType {
  SHORT_TERM        // Held < 12 months (no CGT discount)
  LONG_TERM         // Held >= 12 months (50% CGT discount)
}
```

### 3.2 Enhanced InvestmentAccount

```prisma
model InvestmentAccount {
  id           String                @id @default(uuid())
  userId       String
  name         String
  type         InvestmentAccountType
  platform     String?
  currency     String                @default("AUD")

  // Phase 23: Opening and balance tracking
  openingDate         DateTime?      // When account was opened
  openingBalance      Float          @default(0)  // Initial cash balance
  cashBalance         Float          @default(0)  // Current uninvested cash
  totalDeposits       Float          @default(0)  // Sum of all deposits
  totalWithdrawals    Float          @default(0)  // Sum of all withdrawals
  costBasisMethod     CostBasisMethod @default(FIFO)

  // Relationships
  user         User                    @relation(...)
  holdings     InvestmentHolding[]
  transactions InvestmentTransaction[]
  capitalGains CapitalGainEvent[]
  // ...
}
```

### 3.3 Enhanced InvestmentHolding

```prisma
model InvestmentHolding {
  id                  String            @id @default(uuid())
  investmentAccountId String
  ticker              String
  name                String?           // Full name
  units               Float
  averagePrice        Float
  frankingPercentage  Float?
  type                HoldingType

  // Phase 23: Enhanced tracking
  firstPurchaseDate   DateTime?         // For CGT discount calculation
  totalCostBasis      Float             @default(0)
  currentPrice        Float?            // Latest market price
  currentValue        Float?            // Computed: units * currentPrice
  priceUpdatedAt      DateTime?
  unrealizedGain      Float?
  unrealizedGainPct   Float?

  // Relationships
  investmentAccount   InvestmentAccount
  transactions        InvestmentTransaction[]
  purchaseLots        PurchaseLot[]
  capitalGains        CapitalGainEvent[]
}
```

### 3.4 PurchaseLot (Parcel Tracking)

```prisma
model PurchaseLot {
  id                  String            @id @default(uuid())
  holdingId           String
  transactionId       String            @unique

  // Lot details
  purchaseDate        DateTime
  units               Float
  unitCost            Float
  totalCost           Float             // units * unitCost + fees
  fees                Float             @default(0)

  // Tracking
  unitsRemaining      Float             // Units not yet sold
  isFullySold         Boolean           @default(false)

  // Relationships
  holding             InvestmentHolding
  transaction         InvestmentTransaction
  capitalGainAllocations CapitalGainLotAllocation[]
}
```

### 3.5 CapitalGainEvent

```prisma
model CapitalGainEvent {
  id                    String            @id @default(uuid())
  investmentAccountId   String
  holdingId             String
  transactionId         String            @unique

  // Sale details
  saleDate              DateTime
  unitsSold             Float
  salePrice             Float
  saleFees              Float             @default(0)
  grossProceeds         Float

  // Cost basis
  totalCostBasis        Float

  // Gain/Loss calculation
  capitalGain           Float
  capitalGainType       CapitalGainType
  cgtDiscount           Float             @default(0)
  taxableGain           Float

  // Tax year
  financialYear         String            // e.g., "2024-25"

  // Relationships
  investmentAccount     InvestmentAccount
  holding               InvestmentHolding
  transaction           InvestmentTransaction
  lotAllocations        CapitalGainLotAllocation[]
}
```

### 3.6 CapitalGainLotAllocation

```prisma
model CapitalGainLotAllocation {
  id                  String            @id @default(uuid())
  capitalGainEventId  String
  purchaseLotId       String

  unitsAllocated      Float
  costBasisAllocated  Float
  holdingPeriodDays   Int

  // Relationships
  capitalGainEvent    CapitalGainEvent
  purchaseLot         PurchaseLot
}
```

---

## 4. CGT Calculation Rules (Australian)

### 4.1 CGT Discount

- **Individual taxpayers:** 50% discount on capital gains for assets held 12+ months
- **Super funds:** 33.33% discount
- **Companies:** No discount

### 4.2 Cost Basis Calculation

```
Cost Basis = Purchase Price + Incidental Costs (brokerage, fees)
```

### 4.3 Capital Gain Calculation

```
Capital Gain = Sale Proceeds - Cost Basis - Selling Costs

If held >= 12 months:
  Taxable Gain = Capital Gain × 0.50 (50% discount)
Else:
  Taxable Gain = Capital Gain
```

### 4.4 Financial Year Determination

Australian financial year: July 1 to June 30

```typescript
function getFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();

  if (month >= 6) { // July onwards
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
}
```

---

## 5. Cost Basis Methods

### 5.1 FIFO (First In, First Out) - ATO Default

Oldest shares are sold first.

```
Purchase Lot 1: 100 units @ $10 (Jan 2023)
Purchase Lot 2: 50 units @ $12 (Mar 2023)

Sell 80 units:
  - Use 80 units from Lot 1 @ $10
  - Cost basis: 80 × $10 = $800
```

### 5.2 LIFO (Last In, First Out)

Most recent shares are sold first.

### 5.3 HIFO (Highest In, First Out)

Shares with highest cost basis are sold first (minimizes taxable gain).

### 5.4 Specific Identification

User manually selects which lots to sell.

### 5.5 Average Cost

Used for managed funds. Average cost across all units.

---

## 6. API Endpoints

### 6.1 Investment Account APIs

```
GET    /api/investments/accounts
GET    /api/investments/accounts/:id
POST   /api/investments/accounts
PUT    /api/investments/accounts/:id
DELETE /api/investments/accounts/:id
```

### 6.2 Holdings APIs

```
GET    /api/investments/accounts/:id/holdings
GET    /api/investments/holdings/:id
POST   /api/investments/holdings
PUT    /api/investments/holdings/:id
PUT    /api/investments/holdings/:id/price  // Update current price
```

### 6.3 Transaction APIs

```
GET    /api/investments/accounts/:id/transactions
POST   /api/investments/transactions
PUT    /api/investments/transactions/:id
DELETE /api/investments/transactions/:id
```

### 6.4 Capital Gains APIs

```
GET    /api/investments/capital-gains?financialYear=2024-25
GET    /api/investments/capital-gains/:id
GET    /api/investments/capital-gains/summary
POST   /api/investments/capital-gains/calculate  // Preview CGT for proposed sale
```

### 6.5 Tax Report API

```
GET    /api/investments/tax-report?financialYear=2024-25
```

**Response:**
```typescript
interface InvestmentTaxReport {
  financialYear: string;

  capitalGains: {
    totalGrossGain: number;
    totalGrossLoss: number;
    netCapitalGain: number;
    cgtDiscountApplied: number;
    taxableNetGain: number;
  };

  dividends: {
    totalUnfranked: number;
    totalFranked: number;
    totalFrankingCredits: number;
    grossedUpTotal: number;
  };

  events: CapitalGainEvent[];
}
```

---

## 7. UI Components

### 7.1 Investment Account Form

Enhanced to include:

```
┌─────────────────────────────────────────────────────┐
│ Add Investment Account                               │
├─────────────────────────────────────────────────────┤
│ Account Name:    [________________________]         │
│ Type:            [Brokerage ▼]                      │
│ Platform:        [CommSec ▼]                        │
│ Currency:        [AUD ▼]                            │
│                                                      │
│ ─── Opening Details ───                             │
│                                                      │
│ Opening Date:    [01/07/2020 📅]                    │
│ Opening Balance: [$_______________]                 │
│                                                      │
│ ─── CGT Settings ───                                │
│                                                      │
│ Cost Basis Method: [FIFO (ATO Default) ▼]          │
│                                                      │
│              [Cancel]    [Save]                     │
└─────────────────────────────────────────────────────┘
```

### 7.2 Holding Detail View

```
┌──────────────────────────────────────────────────────┐
│ VAS - Vanguard Australian Shares ETF    [Edit] [+Buy]│
├──────────────────────────────────────────────────────┤
│                                                      │
│  Units Held       Avg Cost       Current Price      │
│  150.00          $85.20         $92.50              │
│                                                      │
│  Total Cost       Current Value   Unrealized Gain   │
│  $12,780.00      $13,875.00      +$1,095 (+8.6%)   │
│                                                      │
│  First Purchase: 15 Mar 2022  (CGT discount applies)│
│                                                      │
├──────────────────────────────────────────────────────┤
│ Purchase Lots (Parcels)                              │
├──────────────────────────────────────────────────────┤
│ Date         Units    Cost/Unit   Total    Remaining│
│ 15 Mar 2022  100      $80.00     $8,000    100      │
│ 10 Sep 2023  50       $95.20     $4,760    50       │
├──────────────────────────────────────────────────────┤
│ [View Transactions] [Record Sale]                    │
└──────────────────────────────────────────────────────┘
```

### 7.3 Sell Transaction with CGT Preview

```
┌─────────────────────────────────────────────────────┐
│ Sell VAS                                            │
├─────────────────────────────────────────────────────┤
│ Units to Sell:   [50________]                       │
│ Sale Price:      [$92.50____] per unit              │
│ Sale Date:       [04/12/2024 📅]                    │
│ Brokerage:       [$9.95_____]                       │
│                                                      │
│ ─── CGT Preview (FIFO) ───                          │
│                                                      │
│ Gross Proceeds:           $4,615.05                 │
│                                                      │
│ Cost Basis Breakdown:                               │
│ • 50 units from 15/03/2022                          │
│   Cost: $4,000.00 (held 998 days)                   │
│                                                      │
│ Total Cost Basis:         $4,000.00                 │
│ Capital Gain:             $615.05                   │
│ CGT Discount (50%):       -$307.53 ✓                │
│ Taxable Gain:             $307.52                   │
│                                                      │
│ ℹ️ CGT discount applies (held > 12 months)          │
│                                                      │
│           [Cancel]    [Confirm Sale]                │
└─────────────────────────────────────────────────────┘
```

### 7.4 Capital Gains Tax Report

```
┌──────────────────────────────────────────────────────┐
│ Capital Gains Tax Report - FY 2024-25               │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Summary                                              │
│ ─────────────────────────────────────────────────   │
│ Total Capital Gains:      $2,450.00                 │
│ Total Capital Losses:     -$320.00                  │
│ Net Capital Gain:         $2,130.00                 │
│ CGT Discount Applied:     -$1,065.00                │
│ Taxable Net Gain:         $1,065.00                 │
│                                                      │
│ Transactions                                         │
│ ─────────────────────────────────────────────────   │
│ Date       Asset   Units   Gain/Loss   CGT Type    │
│ 15 Aug 24  VAS     50      +$615.05    Long-term   │
│ 22 Oct 24  BHP     25      +$1,835.00  Long-term   │
│ 05 Nov 24  TSLA    10      -$320.00    Short-term  │
│                                                      │
│ [Export to CSV] [Download PDF]                      │
└──────────────────────────────────────────────────────┘
```

---

## 8. Dashboard & Portfolio Integration

### 8.1 Portfolio Snapshot Enhancements

Add to existing portfolio snapshot:

```typescript
interface PortfolioSnapshot {
  // Existing fields...

  investments: {
    totalValue: number;
    totalCostBasis: number;
    unrealizedGain: number;
    unrealizedGainPct: number;

    // By account
    accounts: {
      id: string;
      name: string;
      cashBalance: number;
      holdingsValue: number;
      totalValue: number;
      unrealizedGain: number;
    }[];

    // CGT summary (current FY)
    capitalGains: {
      financialYear: string;
      realizedGain: number;
      realizedLoss: number;
      netGain: number;
      taxableGain: number;
    };
  };
}
```

### 8.2 Dashboard Widgets

**Investment Summary Widget:**
```
┌─────────────────────────────────────┐
│ Investments                          │
├─────────────────────────────────────┤
│ Total Value:     $45,230.00         │
│ Cost Basis:      $38,500.00         │
│ Unrealized:      +$6,730 (+17.5%)   │
│                                      │
│ FY 2024-25 CGT                      │
│ Realized Gains:  $2,130.00          │
│ Taxable:         $1,065.00          │
│                                      │
│ [View Details →]                    │
└─────────────────────────────────────┘
```

---

## 9. Tax Calculator Integration

### 9.1 Link to Phase 20 Tax Engine

Capital gains from investments should automatically flow into the tax position calculation:

```typescript
// In tax position calculation
const investmentCGT = await getCapitalGainsSummary(userId, financialYear);

taxPosition.capitalGains = {
  grossGain: investmentCGT.netGain,
  cgtDiscount: investmentCGT.totalDiscount,
  taxableGain: investmentCGT.taxableGain,
};

// Add to assessable income
taxPosition.assessableIncome += investmentCGT.taxableGain;
```

### 9.2 Capital Gains in Tax Dashboard

Display capital gains alongside other tax information in the Tax Dashboard.

---

## 10. Implementation Phases

### Phase 23.1: Schema & Core Models (Current)
- [x] Add new enums (CostBasisMethod, CapitalGainType)
- [x] Enhance InvestmentAccount model
- [x] Enhance InvestmentHolding model
- [x] Create PurchaseLot model
- [x] Create CapitalGainEvent model
- [x] Create CapitalGainLotAllocation model
- [ ] Run database migration

### Phase 23.2: API Development
- [ ] CRUD APIs for enhanced investment accounts
- [ ] Holdings price update API
- [ ] Purchase lot management APIs
- [ ] Capital gains calculation API
- [ ] CGT preview for proposed sales
- [ ] Tax report generation API

### Phase 23.3: CGT Calculation Engine
- [ ] FIFO lot allocation algorithm
- [ ] LIFO lot allocation algorithm
- [ ] HIFO lot allocation algorithm
- [ ] Specific identification support
- [ ] Average cost calculation
- [ ] CGT discount determination

### Phase 23.4: UI Updates
- [ ] Enhance investment account form
- [ ] Add holding detail with lots view
- [ ] Create sell transaction with CGT preview
- [ ] Build capital gains report page
- [ ] Update dashboard widgets

### Phase 23.5: Tax Integration
- [ ] Integrate with Phase 20 tax position
- [ ] Add CGT to tax dashboard
- [ ] Generate tax-time reports

---

## 11. Acceptance Criteria

- [ ] Users can set opening date and balance for investment accounts
- [ ] Deposit/withdrawal transactions update cash balance
- [ ] Current prices can be recorded for holdings
- [ ] Purchase lots are automatically created for BUY transactions
- [ ] Selling calculates capital gains using configured cost basis method
- [ ] CGT discount (50%) applies correctly for assets held 12+ months
- [ ] Capital gains roll up to financial year summaries
- [ ] Capital gains appear in tax position calculations
- [ ] Tax reports can be generated for each financial year

---

## 12. Related Documentation

- [PHASE_03_FINANCIAL_ENGINES.md](./PHASE_03_FINANCIAL_ENGINES.md) - Original investment models
- [PHASE_20_AUSTRALIAN_TAX_INTELLIGENCE_ENGINE.md](./PHASE_20_AUSTRALIAN_TAX_INTELLIGENCE_ENGINE.md) - Tax integration
- [03_DATA_MODEL.md](./03_DATA_MODEL.md) - Core entity definitions
- [07_API_STANDARDS.md](./07_API_STANDARDS.md) - API conventions

---

*Document Version: 1.0*
*Created: 2025-12-04*
*Phase Status: IN DEVELOPMENT*
