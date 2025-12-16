# **PHASE 30 — TESTING FRAMEWORK**
### *Comprehensive Testing Infrastructure for External AI Verification*

---

# **1. Purpose of This Document**

This document defines the **Monitrax Testing Framework** — a comprehensive infrastructure for:

- Loading test scenarios with known input values
- Exporting all calculated outputs for external verification
- Enabling automated bulk sanity checks via external AI tools
- Validating financial engine calculations independently

This framework allows external systems to verify that Monitrax calculations (net worth, cashflow, gearing, depreciation, etc.) are mathematically correct.

---

# **2. Architecture Overview**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL AI VERIFICATION TOOL                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TEST SCENARIO JSON                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Test User   │  │ Properties  │  │ Loans       │  │ Expected Outputs    │ │
│  │ Definition  │  │ & Accounts  │  │ & Income    │  │ (for verification)  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         POST /api/testing                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ 1. Reset    │─▶│ 2. Load     │─▶│ 3. Calculate│─▶│ 4. Export & Verify  │ │
│  │    User     │  │    Data     │  │    Engines  │  │    All Outputs      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPREHENSIVE OUTPUT JSON                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Net Worth   │  │ Cashflow    │  │ Gearing     │  │ Property & Loan     │ │
│  │ Totals      │  │ Analysis    │  │ Metrics     │  │ Individual Metrics  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Investment  │  │ Depreciation│  │ Tax         │  │ Verification        │ │
│  │ Metrics     │  │ Schedules   │  │ Exposure    │  │ Results             │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# **3. API Endpoints**

## **3.1 Main Testing Endpoint**

### `POST /api/testing` — Run Complete Test Cycle

Executes the full test workflow: reset → load → calculate → export → verify

**Request:**
```json
{
  "scenarioId": "simple-homeowner",
  "name": "Simple Homeowner Test",
  "description": "Basic homeowner with single property and loan",
  "testUser": {
    "email": "test-simple@monitrax.test",
    "name": "Test Simple Homeowner"
  },
  "data": {
    "properties": [...],
    "loans": [...],
    "accounts": [...],
    "income": [...],
    "expenses": [...],
    "investmentAccounts": [...],
    "holdings": [...],
    "investmentTransactions": [...],
    "depreciationSchedules": [...]
  },
  "expectedOutputs": {
    "netWorth": {
      "totalAssets": 1025000,
      "totalLiabilities": 560000,
      "netWorth": 465000
    },
    "gearing": {
      "portfolioLVR": 0.5474
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "loadResult": {
      "success": true,
      "scenarioId": "simple-homeowner",
      "userId": "clxxx...",
      "stats": {
        "propertiesCreated": 1,
        "loansCreated": 1,
        "accountsCreated": 2,
        "incomeCreated": 1,
        "expensesCreated": 3
      }
    },
    "exportResult": {
      "scenarioId": "simple-homeowner",
      "scenarioName": "Simple Homeowner Test",
      "exportedAt": "2024-12-16T10:30:00.000Z",
      "userId": "clxxx...",
      "calculatedOutputs": {
        "netWorth": { ... },
        "cashflow": { ... },
        "gearing": { ... },
        "propertyMetrics": [ ... ],
        "loanMetrics": [ ... ],
        "investmentMetrics": { ... },
        "depreciation": { ... }
      }
    },
    "verification": {
      "passed": true,
      "failures": []
    }
  }
}
```

---

## **3.2 Individual Endpoints**

### `POST /api/testing/load` — Load Test Data Only

Loads test scenario without exporting results.

### `GET /api/testing/export?userId={userId}` — Export Calculated Values

Exports all calculated values for a user.

### `DELETE /api/testing/reset?userId={userId}` — Reset Test Data

Clears all data for a test user (security: only allows test user emails).

---

# **4. Test Scenario Input Schema**

The testing framework accepts **flexible input formats**. You can use either:
1. **Name-based references** (`propertyRef: "Main Residence"`)
2. **ID-based references** (`propertyId: "prop_001"`)

The system automatically normalizes input to the internal format.

## **4.0 Flexible Input Format (Recommended)**

This is the user-friendly format with explicit IDs and ID-based references:

```json
{
  "scenarioId": "simple-investor-001",
  "name": "Simple Investor - Single Property",
  "testUser": {
    "email": "test-simple@monitrax.test",
    "name": "Test User Simple"
  },
  "data": {
    "properties": [
      {
        "id": "prop_001",
        "name": "Brisbane Investment",
        "address": "123 Rental St, Brisbane QLD 4000",
        "type": "investment",
        "purchaseDate": "2022-01-15",
        "purchasePrice": 450000,
        "currentValue": 500000
      }
    ],
    "loans": [
      {
        "id": "loan_001",
        "propertyId": "prop_001",
        "name": "Brisbane Investment Loan",
        "type": "principal_and_interest",
        "balance": 350000,
        "interestRate": 0.06,
        "monthlyRepayment": 2100,
        "offsetAccountId": "acc_001"
      }
    ],
    "accounts": [
      {
        "id": "acc_001",
        "name": "Offset Account",
        "type": "offset",
        "balance": 30000
      }
    ],
    "income": [
      {
        "id": "inc_001",
        "name": "Primary Salary",
        "category": "salary",
        "amount": 6000,
        "frequency": "monthly",
        "isNet": true
      },
      {
        "id": "inc_002",
        "name": "Brisbane Rental",
        "category": "rental",
        "amount": 2200,
        "frequency": "monthly",
        "propertyId": "prop_001"
      }
    ],
    "expenses": [
      {
        "id": "exp_001",
        "name": "Council Rates",
        "category": "rates",
        "amount": 1600,
        "frequency": "annual",
        "propertyId": "prop_001"
      }
    ]
  },
  "expectedOutputs": {
    "netWorth": {
      "totalAssets": 580000,
      "totalLiabilities": 350000,
      "netWorth": 230000
    },
    "gearing": {
      "portfolioLVR": 0.70
    }
  }
}
```

### **Field Mapping (Flexible → Internal)**

| Flexible Field | Internal Field | Notes |
|----------------|----------------|-------|
| `id` | (used for reference resolution) | Optional, for linking entities |
| `propertyId` | `propertyRef` | Links by ID → converted to name |
| `offsetAccountId` | `offsetAccountRef` | Links by ID → converted to name |
| `loanId` | `loanRef` | Links by ID → converted to name |
| `balance` | `principal` / `currentBalance` | For loans/accounts |
| `interestRate` | `interestRateAnnual` | Decimal format |
| `monthlyRepayment` | `minRepayment` | Assumes MONTHLY frequency |
| `category` | `type` | For income (salary/rental/etc) |
| `isNet` | `salaryType: "NET"` | Boolean → enum conversion |
| `type: "investment"` | `type: "INVESTMENT"` | Case-insensitive |
| `type: "principal_and_interest"` | `isInterestOnly: false` | Loan type parsing |

---

## **4.1 Root Structure**

```typescript
interface TestScenarioInput {
  scenarioId: string;           // Unique identifier
  name: string;                 // Human-readable name
  description?: string;         // Scenario description
  testUser: {
    email: string;              // Must contain "test" for security
    name: string;
    password?: string;          // Optional, defaults to "TestPassword123!"
  };
  data: {
    properties?: TestPropertyInput[];
    loans?: TestLoanInput[];
    accounts?: TestAccountInput[];
    income?: TestIncomeInput[];
    expenses?: TestExpenseInput[];
    investmentAccounts?: TestInvestmentAccountInput[];
    holdings?: TestHoldingInput[];
    investmentTransactions?: TestInvestmentTransactionInput[];
    depreciationSchedules?: TestDepreciationScheduleInput[];
  };
  expectedOutputs?: {
    netWorth?: { ... };
    gearing?: { ... };
    cashflow?: { ... };
    propertyMetrics?: [ ... ];
  };
}
```

---

## **4.2 Property Input**

```typescript
interface TestPropertyInput {
  name: string;                          // Used as reference key
  type: "HOME" | "INVESTMENT" | "COMMERCIAL" | "LAND" | "HOLIDAY";
  address: string;
  purchasePrice: number;
  purchaseDate: string;                  // ISO date: "2020-01-15"
  currentValue: number;
  valuationDate?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
}
```

**Example:**
```json
{
  "name": "Main Residence",
  "type": "HOME",
  "address": "123 Example Street, Sydney NSW 2000",
  "purchasePrice": 850000,
  "purchaseDate": "2020-03-15",
  "currentValue": 950000,
  "valuationDate": "2024-12-01",
  "suburb": "Sydney",
  "state": "NSW",
  "postcode": "2000"
}
```

---

## **4.3 Loan Input**

```typescript
interface TestLoanInput {
  name: string;                          // Used as reference key
  lender?: string;
  type: "HOME" | "INVESTMENT" | "PERSONAL" | "LINE_OF_CREDIT";
  principal: number;                     // Current balance
  interestRateAnnual: number;            // Decimal: 0.0599 = 5.99%
  rateType: "FIXED" | "VARIABLE";
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepayment: number;
  repaymentFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  fixedExpiry?: string;                  // ISO date for fixed rate expiry
  extraRepaymentCap?: number;            // Annual limit
  propertyRef?: string;                  // Links to property by name
  offsetAccountRef?: string;             // Links to account by name
}
```

**Example:**
```json
{
  "name": "Home Loan",
  "lender": "Commonwealth Bank",
  "type": "HOME",
  "principal": 520000,
  "interestRateAnnual": 0.0599,
  "rateType": "VARIABLE",
  "isInterestOnly": false,
  "termMonthsRemaining": 348,
  "minRepayment": 3250,
  "repaymentFrequency": "MONTHLY",
  "propertyRef": "Main Residence",
  "offsetAccountRef": "Offset Account"
}
```

---

## **4.4 Account Input**

```typescript
interface TestAccountInput {
  name: string;                          // Used as reference key
  type: "TRANSACTIONAL" | "SAVINGS" | "OFFSET" | "CREDIT_CARD" | "TERM_DEPOSIT";
  institution: string;
  currentBalance: number;                // Negative for credit cards
  interestRate?: number;                 // Decimal
}
```

**Example:**
```json
{
  "name": "Offset Account",
  "type": "OFFSET",
  "institution": "Commonwealth Bank",
  "currentBalance": 45000
}
```

---

## **4.5 Income Input**

```typescript
interface TestIncomeInput {
  name: string;                          // Used as reference key
  type: "SALARY" | "RENTAL" | "INVESTMENT" | "BUSINESS" | "PENSION" | "OTHER";
  sourceType?: "GENERAL" | "PROPERTY" | "INVESTMENT";
  amount: number;
  frequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  isTaxable?: boolean;
  salaryType?: "GROSS" | "NET";
  superGuaranteeRate?: number;           // Decimal: 0.115 = 11.5%
  salarySacrifice?: number;
  frankingPercentage?: number;           // For dividends
  propertyRef?: string;                  // Links to property
  investmentAccountRef?: string;         // Links to investment account
  startDate?: string;
  endDate?: string;
}
```

**Example:**
```json
{
  "name": "Primary Salary",
  "type": "SALARY",
  "sourceType": "GENERAL",
  "amount": 120000,
  "frequency": "ANNUAL",
  "isTaxable": true,
  "salaryType": "GROSS",
  "superGuaranteeRate": 0.115
}
```

---

## **4.6 Expense Input**

```typescript
interface TestExpenseInput {
  name: string;                          // Used as reference key
  vendorName?: string;
  category: "RATES" | "INSURANCE" | "UTILITIES" | "MAINTENANCE" |
            "FOOD" | "TRANSPORT" | "ENTERTAINMENT" | "HEALTH" |
            "EDUCATION" | "LOAN_INTEREST" | "OTHER";
  sourceType?: "GENERAL" | "PROPERTY" | "LOAN" | "INVESTMENT";
  amount: number;
  frequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  isEssential?: boolean;
  isTaxDeductible?: boolean;
  propertyRef?: string;                  // Links to property
  loanRef?: string;                      // Links to loan
  investmentAccountRef?: string;         // Links to investment account
}
```

**Example:**
```json
{
  "name": "Council Rates",
  "category": "RATES",
  "sourceType": "PROPERTY",
  "amount": 2400,
  "frequency": "ANNUAL",
  "isEssential": true,
  "isTaxDeductible": false,
  "propertyRef": "Main Residence"
}
```

---

## **4.7 Investment Account Input**

```typescript
interface TestInvestmentAccountInput {
  name: string;                          // Used as reference key
  type: "BROKERAGE" | "SUPER" | "SMSF" | "TRUST";
  platform?: string;
  currency?: string;                     // Default: "AUD"
  cashBalance?: number;
  openingBalance?: number;
  costBasisMethod?: "FIFO" | "LIFO" | "AVERAGE";
}
```

---

## **4.8 Holding Input**

```typescript
interface TestHoldingInput {
  ticker: string;                        // Used as reference key (e.g., "VAS")
  name: string;
  type: "ETF" | "SHARE" | "MANAGED_FUND" | "BOND" | "OTHER";
  units: number;
  averagePrice: number;
  currentPrice?: number;
  frankingPercentage?: number;           // For dividend calculations
  investmentAccountRef: string;          // Links to investment account
}
```

---

## **4.9 Investment Transaction Input**

```typescript
interface TestInvestmentTransactionInput {
  type: "BUY" | "SELL" | "DIVIDEND" | "DISTRIBUTION" | "FEE";
  date: string;                          // ISO date
  price: number;
  units: number;
  fees?: number;
  notes?: string;
  investmentAccountRef: string;          // Links to investment account
  holdingRef?: string;                   // Links to holding by ticker
}
```

---

## **4.10 Depreciation Schedule Input**

```typescript
interface TestDepreciationScheduleInput {
  assetName: string;
  category: "DIV40" | "DIV43";           // Plant & Equipment vs Capital Works
  method: "PRIME_COST" | "DIMINISHING_VALUE";
  cost: number;
  rate: number;                          // Decimal: 0.025 = 2.5%
  startDate: string;                     // ISO date
  notes?: string;
  propertyRef: string;                   // Links to property
}
```

---

# **5. Export Output Schema**

## **5.1 Full Export Structure**

```typescript
interface TestExportOutput {
  scenarioId: string;
  scenarioName: string;
  exportedAt: string;
  userId: string;

  rawData: {
    properties: Property[];
    loans: Loan[];
    accounts: Account[];
    income: Income[];
    expenses: Expense[];
    investmentAccounts: InvestmentAccount[];
    holdings: InvestmentHolding[];
    depreciationSchedules: DepreciationSchedule[];
  };

  calculatedOutputs: {
    netWorth: NetWorthOutput;
    cashflow: CashflowOutput;
    gearing: GearingOutput;
    propertyMetrics: PropertyMetricsOutput[];
    loanMetrics: LoanMetricsOutput[];
    investmentMetrics: InvestmentMetricsOutput;
    depreciation: DepreciationOutput;
    linkageHealth: LinkageHealthOutput;
    insights: InsightsOutput;
    taxExposure: TaxExposureOutput;
  };
}
```

---

## **5.2 Net Worth Output**

```typescript
interface NetWorthOutput {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  breakdown: {
    propertyAssets: number;
    cashAssets: number;
    investmentAssets: number;
    loanLiabilities: number;
    creditCardLiabilities: number;
  };
}
```

---

## **5.3 Cashflow Output**

```typescript
interface CashflowOutput {
  monthlyGrossIncome: number;
  monthlyNetIncome: number;
  monthlyExpenses: number;
  monthlyLoanRepayments: number;
  monthlyNetCashflow: number;
  annualGrossIncome: number;
  annualNetIncome: number;
  annualExpenses: number;
  annualLoanRepayments: number;
  annualNetCashflow: number;
  incomeByType: Record<string, number>;
  expensesByCategory: Record<string, number>;
}
```

---

## **5.4 Gearing Output**

```typescript
interface GearingOutput {
  totalPropertyValue: number;
  totalLoanBalance: number;
  portfolioLVR: number;                  // Decimal: 0.65 = 65%
  availableEquity80: number;             // At 80% LVR
  availableEquity90: number;             // At 90% LVR
}
```

---

## **5.5 Property Metrics Output**

```typescript
interface PropertyMetricsOutput {
  propertyId: string;
  propertyName: string;
  currentValue: number;
  totalDebt: number;
  equity: number;
  lvr: number;
  grossRentalYield?: number;
  netRentalYield?: number;
  annualRentalIncome?: number;
  annualExpenses?: number;
  cashflowPositive?: boolean;
}
```

---

## **5.6 Loan Metrics Output**

```typescript
interface LoanMetricsOutput {
  loanId: string;
  loanName: string;
  principal: number;
  interestRate: number;
  effectiveRate: number;                 // After offset
  offsetBalance: number;
  monthlyInterest: number;
  monthlyRepayment: number;
  remainingTerm: number;
  isInterestOnly: boolean;
}
```

---

## **5.7 Investment Metrics Output**

```typescript
interface InvestmentMetricsOutput {
  totalValue: number;
  totalCostBasis: number;
  totalUnrealisedGain: number;
  totalUnrealisedGainPercent: number;
  holdings: Array<{
    ticker: string;
    name: string;
    units: number;
    currentValue: number;
    costBasis: number;
    unrealisedGain: number;
    unrealisedGainPercent: number;
  }>;
}
```

---

## **5.8 Depreciation Output**

```typescript
interface DepreciationOutput {
  totalAnnualDepreciation: number;
  div40Total: number;
  div43Total: number;
  schedules: Array<{
    assetName: string;
    propertyName: string;
    category: string;
    method: string;
    originalCost: number;
    currentWrittenDownValue: number;
    annualDepreciation: number;
    remainingYears: number;
  }>;
}
```

---

# **6. Entity Reference System**

Entities are linked using **name-based references** rather than IDs:

| Entity | Reference Field | Links To |
|--------|-----------------|----------|
| Loan | `propertyRef` | Property by name |
| Loan | `offsetAccountRef` | Account by name |
| Income | `propertyRef` | Property by name |
| Income | `investmentAccountRef` | Investment Account by name |
| Expense | `propertyRef` | Property by name |
| Expense | `loanRef` | Loan by name |
| Expense | `investmentAccountRef` | Investment Account by name |
| Holding | `investmentAccountRef` | Investment Account by name |
| Transaction | `investmentAccountRef` | Investment Account by name |
| Transaction | `holdingRef` | Holding by ticker |
| Depreciation | `propertyRef` | Property by name |

**Example linking loan to property and offset:**
```json
{
  "name": "Investment Loan",
  "principal": 400000,
  "propertyRef": "Investment Property 1",
  "offsetAccountRef": "Investment Offset"
}
```

---

# **7. Load Order**

Entities are loaded in dependency order:

1. **Properties** (no dependencies)
2. **Accounts** (no dependencies)
3. **Loans** (depends on properties, accounts)
4. **Investment Accounts** (no dependencies)
5. **Holdings** (depends on investment accounts)
6. **Investment Transactions** (depends on investment accounts, holdings)
7. **Income** (depends on properties, investment accounts)
8. **Expenses** (depends on properties, loans, investment accounts)
9. **Depreciation Schedules** (depends on properties)

---

# **8. Available Test Fixtures**

Pre-built test scenarios in `lib/testing/fixtures/`:

| Fixture | Description | Key Features |
|---------|-------------|--------------|
| `simple-homeowner.json` | Basic homeowner | 1 property, 1 loan, offset account, salary |
| `property-investor.json` | Property investor | PPOR + 2 IPs, IO loans, depreciation, rental income |
| `mixed-portfolio.json` | Diversified | Properties + ETFs, multiple income streams |
| `edge-cases.json` | Edge cases | High LVR (>90%), maxed offset, credit card debt, CGT |

---

# **9. Workflow for External AI Verification**

## **Step 1: Prepare Test Scenario**

Create JSON following the input schema with known values and expected outputs.

## **Step 2: Submit to API**

```bash
curl -X POST http://localhost:3000/api/testing \
  -H "Content-Type: application/json" \
  -d @test-scenario.json
```

## **Step 3: Receive Calculated Outputs**

API returns all calculated values in structured format.

## **Step 4: Verify Calculations**

External AI compares:
- `calculatedOutputs.netWorth.totalAssets` vs expected
- `calculatedOutputs.gearing.portfolioLVR` vs expected
- `calculatedOutputs.propertyMetrics[].lvr` vs expected
- etc.

## **Step 5: Report Discrepancies**

Any differences indicate calculation bugs to investigate.

---

# **10. Security Considerations**

## **10.1 Test User Restriction**

- Test user emails **must** contain "test" (e.g., `test-user@monitrax.test`)
- Reset/delete operations only work on test users
- Production users cannot be accidentally affected

## **10.2 Environment Isolation**

- Testing framework should only be enabled in development/staging
- Production deployments should disable `/api/testing` endpoints

---

# **11. JSON Schema**

Full JSON Schema for input validation is available at:

```
lib/testing/schemas/test-scenario.schema.json
```

External tools can use this schema to validate test scenarios before submission.

---

# **12. File Structure**

```
lib/testing/
├── index.ts                  # Main exports & convenience functions
├── types.ts                  # TypeScript interfaces
├── loader.ts                 # TestScenarioLoader class
├── exporter.ts               # TestScenarioExporter class
├── reset.ts                  # TestScenarioReset class
├── schemas/
│   └── test-scenario.schema.json
└── fixtures/
    ├── simple-homeowner.json
    ├── property-investor.json
    ├── mixed-portfolio.json
    └── edge-cases.json

app/api/testing/
├── route.ts                  # Main endpoint (POST)
├── load/route.ts             # Load endpoint
├── export/route.ts           # Export endpoint
└── reset/route.ts            # Reset endpoint
```

---

# **13. Acceptance Criteria**

The testing framework is complete when:

- Test scenarios can be loaded via REST API
- All financial engines calculate values correctly
- Calculated outputs can be exported in structured format
- External tools can compare expected vs actual values
- Test data can be reset without affecting production
- JSON Schema validates input before processing
- Multiple test fixtures cover common scenarios

---

# **14. Example: Complete Test Cycle**

```bash
# Run complete test with verification
curl -X POST http://localhost:3000/api/testing \
  -H "Content-Type: application/json" \
  -d '{
    "scenarioId": "verification-test",
    "name": "Net Worth Verification",
    "testUser": {
      "email": "test-verify@monitrax.test",
      "name": "Verification Test"
    },
    "data": {
      "properties": [{
        "name": "Test Property",
        "type": "HOME",
        "address": "1 Test St",
        "purchasePrice": 500000,
        "purchaseDate": "2020-01-01",
        "currentValue": 600000
      }],
      "accounts": [{
        "name": "Savings",
        "type": "SAVINGS",
        "institution": "Test Bank",
        "currentBalance": 50000
      }],
      "loans": [{
        "name": "Home Loan",
        "type": "HOME",
        "principal": 300000,
        "interestRateAnnual": 0.06,
        "rateType": "VARIABLE",
        "isInterestOnly": false,
        "termMonthsRemaining": 300,
        "minRepayment": 2000,
        "repaymentFrequency": "MONTHLY",
        "propertyRef": "Test Property"
      }]
    },
    "expectedOutputs": {
      "netWorth": {
        "totalAssets": 650000,
        "totalLiabilities": 300000,
        "netWorth": 350000
      },
      "gearing": {
        "portfolioLVR": 0.50
      }
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "loadResult": { "success": true, ... },
    "exportResult": {
      "calculatedOutputs": {
        "netWorth": {
          "totalAssets": 650000,
          "totalLiabilities": 300000,
          "netWorth": 350000
        },
        "gearing": {
          "portfolioLVR": 0.50
        }
      }
    },
    "verification": {
      "passed": true,
      "failures": []
    }
  }
}
```

---
