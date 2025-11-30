# Phase 20: Australian Tax Intelligence Engine

**Version:** 1.0
**Status:** Draft
**Priority:** High
**Dependencies:** Phase 17 (Personal CFO), Phase 19 (Documents)

---

## 1. Executive Summary

Phase 20 introduces a comprehensive Australian Tax Intelligence Engine that:
- Automatically determines taxability of all income types
- Handles gross/net salary calculations with PAYG withholding
- Tracks superannuation (SG, salary sacrifice, personal contributions)
- Provides accurate tax position calculations
- Offers AI-powered tax optimization recommendations

**Core Principle:** Users should never have to manually determine if something is taxable. The system knows Australian tax law and applies it automatically.

---

## 2. Current Gaps Analysis

### 2.1 Income Taxability Issues

**Current Problem:**
- Users manually select "Is Taxable?" checkbox
- This creates confusion and potential for errors
- No validation against ATO rules

**Solution:**
- Remove manual taxability toggle
- Auto-determine based on income type and source
- Provide explanation of why income is/isn't taxable

### 2.2 Salary Income Gaps

**Current Problem:**
- No distinction between gross and net salary
- No PAYG withholding tracking
- No superannuation fields
- No salary sacrifice options
- Cannot accurately calculate tax position

**Solution:**
- Add gross salary as primary input
- Calculate PAYG withholding automatically
- Track employer super guarantee (SG)
- Track salary sacrifice contributions
- Calculate net take-home pay

### 2.3 Super Contributions Gaps

**Current Problem:**
- Superannuation not tracked at all
- Cannot model salary sacrifice scenarios
- No contribution cap tracking
- No Division 293 tax calculations

**Solution:**
- Full superannuation tracking
- Contribution cap monitoring ($27,500 concessional / $110,000 non-concessional)
- Division 293 tax for high earners
- Carry-forward unused cap tracking

---

## 3. Schema Changes

### 3.1 Income Model Enhancements

```prisma
model Income {
  id                    String   @id @default(uuid())
  userId                String
  propertyId            String?
  investmentAccountId   String?

  // Existing fields
  name                  String
  type                  IncomeType
  amount                Float
  frequency             Frequency

  // NEW: Salary-specific fields
  salaryType            SalaryType?       // GROSS or NET
  payFrequency          PayFrequency?     // WEEKLY, FORTNIGHTLY, MONTHLY

  // NEW: PAYG & Tax fields (calculated, not user-entered)
  grossAmount           Float?            // If NET entered, calculate GROSS
  netAmount             Float?            // If GROSS entered, calculate NET
  paygWithholding       Float?            // Calculated PAYG

  // NEW: Super fields (for SALARY type only)
  superGuarantee        Float?            // Employer SG (11.5% for 2024-25)
  salarySacrifice       Float?            // Pre-tax super contributions

  // NEW: Tax determination (auto-calculated)
  taxableAmount         Float?            // The taxable portion
  taxExemptAmount       Float?            // Any exempt portion
  taxCategory           TaxCategory       // System-determined category
  taxNotes              String?           // Explanation of tax treatment

  // REMOVED: isTaxable (replaced by automatic determination)

  // Existing relations
  user                  User     @relation(fields: [userId], references: [id])
  property              Property? @relation(fields: [propertyId], references: [id])
  investmentAccount     InvestmentAccount? @relation(fields: [investmentAccountId], references: [id])

  // Timestamps
  startDate             DateTime?
  endDate               DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

enum SalaryType {
  GROSS
  NET
}

enum PayFrequency {
  WEEKLY
  FORTNIGHTLY
  MONTHLY
  QUARTERLY
  ANNUALLY
}

enum TaxCategory {
  // Employment Income
  SALARY_WAGES           // Fully taxable
  ALLOWANCES             // Taxable unless specific exemptions
  BONUSES                // Fully taxable
  TERMINATION            // Special tax treatment

  // Investment Income
  DIVIDENDS_FRANKED      // Taxable with franking credits
  DIVIDENDS_UNFRANKED    // Fully taxable
  INTEREST               // Fully taxable
  CAPITAL_GAINS          // CGT rules apply

  // Property Income
  RENTAL                 // Fully taxable

  // Government Payments
  CENTRELINK_TAXABLE     // Most are taxable
  CENTRELINK_EXEMPT      // Some are exempt

  // Other
  GIFTS                  // Generally exempt
  INHERITANCE            // Generally exempt
  INSURANCE_PAYOUT       // Generally exempt
  HOBBY_INCOME           // May be taxable if profit-making

  // Exempt
  TAX_EXEMPT             // Confirmed exempt
}
```

### 3.2 New Superannuation Model

```prisma
model SuperannuationAccount {
  id                    String   @id @default(uuid())
  userId                String

  // Account details
  name                  String
  fundName              String?
  memberNumber          String?
  fundABN               String?

  // Balances
  currentBalance        Float    @default(0)
  taxableComponent      Float    @default(0)
  taxFreeComponent      Float    @default(0)

  // Contribution tracking (current FY)
  concessionalYTD       Float    @default(0)   // SG + Salary Sacrifice + Personal deductible
  nonConcessionalYTD    Float    @default(0)   // After-tax contributions

  // Contribution caps (updated annually)
  concessionalCap       Float    @default(27500)
  nonConcessionalCap    Float    @default(110000)

  // Carry-forward tracking
  carryForwardAvailable Float    @default(0)

  // Relations
  user                  User     @relation(fields: [userId], references: [id])
  contributions         SuperContribution[]

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model SuperContribution {
  id                    String   @id @default(uuid())
  superAccountId        String

  type                  SuperContributionType
  amount                Float
  date                  DateTime
  financialYear         String   // e.g., "2024-25"

  // For salary-linked contributions
  incomeId              String?

  // Tracking
  notes                 String?

  superAccount          SuperannuationAccount @relation(fields: [superAccountId], references: [id])

  createdAt             DateTime @default(now())
}

enum SuperContributionType {
  EMPLOYER_SG           // Super Guarantee (mandatory)
  SALARY_SACRIFICE      // Pre-tax voluntary
  PERSONAL_DEDUCTIBLE   // Personal contribution claiming deduction
  PERSONAL_NON_DEDUCT   // After-tax personal contribution
  SPOUSE                // Spouse contribution
  GOVERNMENT_COCONTRIB  // Government co-contribution
  DOWNSIZER             // Downsizer contribution (65+)
}
```

### 3.3 Tax Position Model

```prisma
model TaxPosition {
  id                    String   @id @default(uuid())
  userId                String
  financialYear         String   // e.g., "2024-25"

  // Income aggregation
  grossIncome           Float    @default(0)
  assessableIncome      Float    @default(0)

  // Deductions
  totalDeductions       Float    @default(0)
  workRelatedDeductions Float    @default(0)
  propertyDeductions    Float    @default(0)
  investmentDeductions  Float    @default(0)
  otherDeductions       Float    @default(0)

  // Taxable income
  taxableIncome         Float    @default(0)

  // Tax calculations
  taxOnIncome           Float    @default(0)
  medicareLevy          Float    @default(0)
  medicareSurcharge     Float    @default(0)

  // Offsets
  litoOffset            Float    @default(0)   // Low Income Tax Offset
  lmitoOffset           Float    @default(0)   // Low & Middle Income (if applicable)
  saptoOffset           Float    @default(0)   // Senior Australians
  frankingCredits       Float    @default(0)
  foreignTaxCredits     Float    @default(0)
  otherOffsets          Float    @default(0)

  // Final position
  totalTaxPayable       Float    @default(0)
  totalPaygWithheld     Float    @default(0)
  estimatedRefund       Float    @default(0)   // Positive = refund, Negative = owing

  // Calculated at
  calculatedAt          DateTime @default(now())

  user                  User     @relation(fields: [userId], references: [id])
}
```

---

## 4. Tax Engine Architecture

### 4.1 Directory Structure

```
lib/tax-engine/
├── index.ts                      # Public API exports
├── types.ts                      # Type definitions
│
├── core/
│   ├── taxYearConfig.ts          # FY-specific rates and thresholds
│   ├── incomeTaxCalculator.ts    # Tax bracket calculations
│   ├── medicareLevyCalculator.ts # Medicare levy + surcharge
│   ├── paygCalculator.ts         # PAYG withholding tables
│   └── taxOffsets.ts             # LITO, LMITO, SAPTO, etc.
│
├── income/
│   ├── taxabilityRules.ts        # Auto-determine taxability
│   ├── salaryProcessor.ts        # Gross/Net/PAYG calculations
│   ├── dividendProcessor.ts      # Franking credits
│   ├── rentalProcessor.ts        # Rental income & deductions
│   └── cgtProcessor.ts           # Capital gains calculations
│
├── deductions/
│   ├── workRelated.ts            # Employment deductions
│   ├── propertyDeductions.ts     # Investment property
│   ├── investmentDeductions.ts   # Interest, management fees
│   └── depreciationClaims.ts     # Div 40 & Div 43
│
├── super/
│   ├── contributionCalculator.ts # SG, salary sacrifice
│   ├── capTracker.ts             # Contribution cap monitoring
│   ├── division293.ts            # High earner additional tax
│   └── coContribution.ts         # Government co-contribution
│
├── position/
│   ├── taxPositionCalculator.ts  # Full tax position
│   ├── refundEstimator.ts        # Estimated refund/owing
│   └── comparisonEngine.ts       # Year-on-year comparison
│
└── ai/
    ├── taxOptimizer.ts           # AI recommendations
    ├── scenarioModeller.ts       # What-if analysis
    ├── salaryPackagingAdvisor.ts # Salary sacrifice optimization
    └── propertyTaxAdvisor.ts     # Negative gearing analysis
```

### 4.2 Core Components

#### 4.2.1 Tax Year Configuration

```typescript
// lib/tax-engine/core/taxYearConfig.ts

export interface TaxYearConfig {
  financialYear: string;

  // Tax brackets
  brackets: TaxBracket[];

  // Medicare
  medicareRate: number;
  medicareThreshold: {
    single: number;
    family: number;
    dependentChild: number;
  };
  medicareSurchargeThresholds: {
    tier1: { min: number; max: number; rate: number };
    tier2: { min: number; max: number; rate: number };
    tier3: { min: number; rate: number };
  };

  // Offsets
  lito: {
    maxOffset: number;
    fullThreshold: number;
    withdrawalRate: number;
    cutoffThreshold: number;
  };

  // Super
  superGuaranteeRate: number;
  concessionalCap: number;
  nonConcessionalCap: number;
  division293Threshold: number;

  // CGT
  cgtDiscount: number;

  // Thresholds
  taxFreeThreshold: number;
}

export const TAX_YEAR_2024_25: TaxYearConfig = {
  financialYear: '2024-25',

  brackets: [
    { min: 0, max: 18200, rate: 0 },
    { min: 18201, max: 45000, rate: 0.16 },
    { min: 45001, max: 135000, rate: 0.30 },
    { min: 135001, max: 190000, rate: 0.37 },
    { min: 190001, max: Infinity, rate: 0.45 },
  ],

  medicareRate: 0.02,
  medicareThreshold: {
    single: 26000,
    family: 43846,
    dependentChild: 4027,
  },
  medicareSurchargeThresholds: {
    tier1: { min: 93000, max: 108000, rate: 0.01 },
    tier2: { min: 108001, max: 144000, rate: 0.0125 },
    tier3: { min: 144001, rate: 0.015 },
  },

  lito: {
    maxOffset: 700,
    fullThreshold: 37500,
    withdrawalRate: 0.05,
    cutoffThreshold: 66667,
  },

  superGuaranteeRate: 0.115, // 11.5% for 2024-25
  concessionalCap: 27500,
  nonConcessionalCap: 110000,
  division293Threshold: 250000,

  cgtDiscount: 0.50,

  taxFreeThreshold: 18200,
};
```

#### 4.2.2 Income Taxability Rules

```typescript
// lib/tax-engine/income/taxabilityRules.ts

export interface TaxabilityResult {
  category: TaxCategory;
  taxableAmount: number;
  exemptAmount: number;
  explanation: string;
  references: string[]; // ATO references
}

export function determineTaxability(
  incomeType: IncomeType,
  amount: number,
  context: IncomeContext
): TaxabilityResult {

  switch (incomeType) {
    case 'SALARY':
      return {
        category: TaxCategory.SALARY_WAGES,
        taxableAmount: amount,
        exemptAmount: 0,
        explanation: 'Salary and wages are fully assessable income.',
        references: ['ATO: Income you must declare'],
      };

    case 'RENT':
      return {
        category: TaxCategory.RENTAL,
        taxableAmount: amount,
        exemptAmount: 0,
        explanation: 'Rental income is fully assessable. Deductions may apply.',
        references: ['ATO: Rental properties'],
      };

    case 'DIVIDEND':
      if (context.frankingPercentage && context.frankingPercentage > 0) {
        const frankingCredit = calculateFrankingCredit(amount, context.frankingPercentage);
        return {
          category: TaxCategory.DIVIDENDS_FRANKED,
          taxableAmount: amount + frankingCredit, // Gross-up
          exemptAmount: 0,
          explanation: `Franked dividend grossed-up by $${frankingCredit.toFixed(2)} franking credit.`,
          references: ['ATO: Dividends and franking credits'],
        };
      }
      return {
        category: TaxCategory.DIVIDENDS_UNFRANKED,
        taxableAmount: amount,
        exemptAmount: 0,
        explanation: 'Unfranked dividends are fully assessable.',
        references: ['ATO: Dividends'],
      };

    case 'INTEREST':
      return {
        category: TaxCategory.INTEREST,
        taxableAmount: amount,
        exemptAmount: 0,
        explanation: 'Interest income is fully assessable.',
        references: ['ATO: Interest income'],
      };

    case 'GIFT':
      return {
        category: TaxCategory.GIFTS,
        taxableAmount: 0,
        exemptAmount: amount,
        explanation: 'Gifts and inheritances are generally not taxable in Australia.',
        references: ['ATO: Gifts and inheritances'],
      };

    // ... more cases
  }
}
```

#### 4.2.3 Salary Processor

```typescript
// lib/tax-engine/income/salaryProcessor.ts

export interface SalaryInput {
  amount: number;
  salaryType: 'GROSS' | 'NET';
  payFrequency: PayFrequency;
  salarySacrifice?: number;
  includesSuper?: boolean;
}

export interface SalaryBreakdown {
  // Annualized amounts
  grossSalary: number;

  // Super
  superGuarantee: number;
  salarySacrifice: number;
  totalSuper: number;

  // Tax
  taxableIncome: number;  // Gross - Salary Sacrifice
  paygWithholding: number;
  medicareLevy: number;

  // Net
  netSalary: number;

  // Per pay period
  perPeriod: {
    gross: number;
    super: number;
    tax: number;
    net: number;
  };

  // Explanations
  calculations: CalculationStep[];
}

export function processSalary(
  input: SalaryInput,
  taxConfig: TaxYearConfig
): SalaryBreakdown {

  // Step 1: Annualize the salary
  const annualGross = annualizeSalary(input.amount, input.salaryType, input.payFrequency);

  // Step 2: Calculate super guarantee
  const superGuarantee = annualGross * taxConfig.superGuaranteeRate;

  // Step 3: Apply salary sacrifice (reduces taxable income)
  const annualSalarySacrifice = input.salarySacrifice
    ? annualizeSalary(input.salarySacrifice, 'GROSS', input.payFrequency)
    : 0;

  // Step 4: Calculate taxable income
  const taxableIncome = annualGross - annualSalarySacrifice;

  // Step 5: Calculate PAYG withholding
  const paygWithholding = calculatePAYG(taxableIncome, taxConfig);

  // Step 6: Calculate Medicare Levy
  const medicareLevy = calculateMedicareLevy(taxableIncome, taxConfig);

  // Step 7: Calculate net salary
  const netSalary = annualGross - paygWithholding - medicareLevy - annualSalarySacrifice;

  // If input was NET, reverse calculate to find actual gross
  if (input.salaryType === 'NET') {
    return reverseCalculateFromNet(input, taxConfig);
  }

  return {
    grossSalary: annualGross,
    superGuarantee,
    salarySacrifice: annualSalarySacrifice,
    totalSuper: superGuarantee + annualSalarySacrifice,
    taxableIncome,
    paygWithholding,
    medicareLevy,
    netSalary,
    perPeriod: calculatePerPeriod(/* ... */),
    calculations: generateCalculationSteps(/* ... */),
  };
}
```

---

## 5. API Endpoints

### 5.1 Tax Position API

```
GET  /api/tax/position
     Returns current financial year tax position

GET  /api/tax/position/:financialYear
     Returns tax position for specific FY

POST /api/tax/calculate
     Calculate tax for given scenario (what-if)
```

### 5.2 Salary API

```
POST /api/tax/salary/calculate
     Calculate full salary breakdown from gross or net

GET  /api/tax/salary/payg-tables
     Get current PAYG withholding tables
```

### 5.3 Super API

```
GET  /api/tax/super/position
     Get super contribution position and cap tracking

POST /api/tax/super/optimize
     Get salary sacrifice optimization recommendations
```

### 5.4 AI Recommendations API

```
GET  /api/tax/ai/recommendations
     Get personalized tax optimization recommendations

POST /api/tax/ai/scenario
     Model a specific tax scenario
```

---

## 6. UI Components

### 6.1 Tax Dashboard Page

**Route:** `/dashboard/tax`

**Features:**
- Current FY tax position summary
- Estimated refund/owing with confidence indicator
- Income breakdown by category
- Deductions summary
- AI recommendations panel
- Year-on-year comparison chart

### 6.2 Salary Entry Enhancement

**Changes to Income Form (when type = SALARY):**

```
┌─────────────────────────────────────────────────────┐
│ Salary Details                                       │
├─────────────────────────────────────────────────────┤
│ Salary Amount: [___________]                        │
│                                                      │
│ Amount Type:   ○ Gross (before tax)                 │
│                ● Net (take-home)                    │
│                                                      │
│ Pay Frequency: [Monthly ▼]                          │
│                                                      │
│ ─── Superannuation ───                              │
│                                                      │
│ Employer Super (SG):  $12,650/year  (auto-calc)     │
│                                                      │
│ Salary Sacrifice:     [___________] /pay period     │
│                       □ I salary sacrifice          │
│                                                      │
│ ─── Calculated Breakdown ───                        │
│                                                      │
│ Gross Salary:         $110,000/year                 │
│ Salary Sacrifice:     - $5,000/year                 │
│ Taxable Income:       $105,000/year                 │
│ PAYG Withholding:     - $24,217/year               │
│ Medicare Levy:        - $2,100/year                 │
│ Net Take-Home:        $78,683/year                  │
│                       ($3,028/fortnight)            │
│                                                      │
│ Total Super:          $17,650/year                  │
│ (SG $12,650 + Sacrifice $5,000)                     │
└─────────────────────────────────────────────────────┘
```

### 6.3 Tax Insights Panel

**In CFO Dashboard:**

```
┌─────────────────────────────────────────────────────┐
│ 💰 Tax Position (2024-25)                           │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Estimated Refund: $4,250                            │
│ [████████████████████░░] 85% confidence             │
│                                                      │
│ Income: $125,000    Deductions: $18,500             │
│ Taxable: $106,500   Tax: $24,067                    │
│                                                      │
│ 💡 AI Recommendations:                              │
│                                                      │
│ • Salary sacrifice $458/month to stay under         │
│   $250k Division 293 threshold (saves $1,374)       │
│                                                      │
│ • Your negative gearing saves $3,200/year           │
│                                                      │
│ • Consider prepaying investment loan interest       │
│   before June 30 (potential $800 saving)            │
│                                                      │
│ [View Full Tax Dashboard →]                         │
└─────────────────────────────────────────────────────┘
```

---

## 7. AI Tax Optimizer

### 7.1 Recommendation Categories

| Category | Examples |
|----------|----------|
| **Salary Packaging** | Salary sacrifice amounts, FBT-exempt items |
| **Super Optimization** | Contribution timing, cap utilization |
| **Deduction Timing** | Prepay expenses before EOFY |
| **CGT Planning** | When to sell assets, discount eligibility |
| **Negative Gearing** | Property loan structure optimization |
| **Income Splitting** | Family trust considerations |

### 7.2 Scenario Modelling

Users can model scenarios like:
- "What if I salary sacrifice $10,000 more?"
- "What if I sell Investment Property A?"
- "What if interest rates increase 2%?"
- "What if I buy another property?"

### 7.3 AI Explanation Engine

Every recommendation includes:
- Clear explanation in plain English
- Dollar value of potential saving
- ATO rule reference
- Confidence level
- Action steps

---

## 8. Implementation Phases

### 8.1 Phase 20A: Core Tax Engine (Priority)

**Deliverables:**
- Tax year configuration (2024-25)
- Income tax bracket calculator
- Medicare levy calculator
- PAYG withholding calculator
- Basic tax position calculation
- Salary gross/net processor

**Schema Changes:**
- Add salary fields to Income model
- Add TaxPosition model

### 8.2 Phase 20B: Super Integration

**Deliverables:**
- SuperannuationAccount model
- SuperContribution model
- SG calculation integration
- Salary sacrifice tracking
- Contribution cap monitoring

### 8.3 Phase 20C: Income Taxability Automation

**Deliverables:**
- Taxability rules engine
- Remove manual "isTaxable" field
- Add TaxCategory enum
- Franking credit calculations
- Income explanation system

### 8.4 Phase 20D: Tax Dashboard & AI

**Deliverables:**
- Tax Dashboard page
- AI recommendation engine
- Scenario modelling
- Year comparison charts
- Tax Insights in CFO Dashboard

---

## 9. Validation & Compliance

### 9.1 ATO Compliance

- All calculations based on official ATO rates
- Tax bracket changes automatically via config
- PAYG tables sourced from ATO Schedule 1
- Medicare thresholds updated annually

### 9.2 Accuracy Guarantees

- All calculations include step-by-step breakdown
- Users can verify each calculation
- Audit trail for all tax-related changes
- Disclaimer: "For estimation purposes only. Consult a tax professional."

### 9.3 Testing Requirements

- Unit tests for all calculators
- Integration tests with real-world scenarios
- Edge case testing (thresholds, phase-outs)
- Annual update testing when rates change

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Tax position accuracy | ±$100 of actual |
| User confusion on taxability | Reduced by 90% |
| Salary entry completeness | 100% include gross/net |
| AI recommendation adoption | 40% actioned |
| User trust in calculations | >90% confidence |

---

## 11. References

- [ATO Individual Tax Rates](https://www.ato.gov.au/rates/individual-income-tax-rates/)
- [ATO Medicare Levy](https://www.ato.gov.au/individuals/medicare-and-private-health-insurance/medicare-levy/)
- [ATO Super Guarantee](https://www.ato.gov.au/rates/key-superannuation-rates-and-thresholds/)
- [ATO PAYG Withholding](https://www.ato.gov.au/rates/schedule-1---statement-of-formulas-for-calculating-amounts-to-be-withheld/)
- [ATO Salary Sacrifice](https://www.ato.gov.au/general/fringe-benefits-tax-(fbt)/in-detail/employees/salary-sacrifice-arrangements-for-employees/)

---

**END OF PHASE 20 BLUEPRINT**
