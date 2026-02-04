# 🧩 **03 — DATA MODEL**  
### *Canonical Entity & Relationship Specification for Monitrax*

---

# **1. Purpose of the Data Model**

This document defines:

- The **canonical shape** of every entity in Monitrax  
- All **cross-module relationships**  
- The **global entity graph** used by GRDCS  
- ID and href conventions  
- Required fields vs optional fields  
- Financial aggregation rules  
- Standardised enums  
- Long-term extensibility guidelines  

The data model is the *absolute foundation* of:

- Portfolio Snapshot Engine  
- GRDCS  
- Financial Engines  
- Insights Engine v2  
- CMNF navigation  
- Linkage Health  

---

# **2. Global Entity Framework**

Monitrax uses a **strict entity contract**:

```
id: string
type: string
name: string
href: string
metadata: Record<string, any>
links: GRDCSLink[]
```

Every entity must include:

## **2.1 Canonical ID**
Format:

```
{module}-{uuid}
```

Examples:

- `property-83fa3a2c`
- `loan-2024ab19`
- `holding-c3f19a0e`

## **2.2 Canonical HREF**
Pattern:

```
/{module}/{id}
```

Examples:

- `/properties/property-83fa3a2c`
- `/loans/loan-2024ab19`

These are consumed by:

- CMNF navigation  
- Breadcrumb builder  
- LinkedDataPanel  
- Entity dialogs  

---

# **3. Core Domain Modules & Entities**

The Monitrax domain includes **nine core financial modules**, each with exact entity definitions.

---

# **3.1 Properties**

### **Entity: Property**

```
id: string
type: "property"
name: string
address: string
purchasePrice: number
purchaseDate: string
marketValue: number
imageUrl?: string
propertyManager?: string
notes?: string
```

### **Relationships**

```
property → loan[]
property → expense[]
property → income[]
property → account? (offset / redraw)
```

### **Financial Rules**

- Market value drives LVR calculations  
- Links to loans determine equity & leverage  
- Property expenses affect cashflow  

---

# **3.2 Loans**

### **Entity: Loan**

```
id: string
type: "loan"
name: string
lender: string
loanType: "HOME" | "INVESTMENT" | "CAR" | "PERSONAL" | "LINE_OF_CREDIT" | "STUDENT" | "BUSINESS"
principal: number
interestRateAnnual: number
rateType: "VARIABLE" | "FIXED"
isInterestOnly: boolean
fixedExpiry?: string
offsetAccountId?: string
linkedAssetId?: string      // For CAR loans - link to vehicle asset
linkedAccountId?: string    // For LINE_OF_CREDIT - link to credit card/account
redrawBalance?: number
extraRepaymentCap?: number
```

### **Loan Types**

| Type | Description | Tax Deductible | Can Link To |
|------|-------------|----------------|-------------|
| HOME | Primary residence mortgage | No | Property, Offset Account |
| INVESTMENT | Investment property loan | Yes | Property, Offset Account |
| CAR | Vehicle financing | No | Asset (Vehicle) |
| PERSONAL | Unsecured personal loan | No | - |
| LINE_OF_CREDIT | Revolving credit facility | No | Account (Credit Card) |
| STUDENT | Education/HECS-HELP debt | No | - |
| BUSINESS | Business loan | Yes | Property (if secured) |

### **Relationships**

```
loan → property?          (HOME, INVESTMENT, BUSINESS)
loan → account[]          (offset for HOME/INVESTMENT)
loan → asset?             (CAR - vehicle)
loan → account?           (LINE_OF_CREDIT - credit card)
loan → transaction[]
loan → expense[]
```

### **Financial Rules**

- Drives repayment schedules
- Interest-only rules change amortisation
- Offset account integration reduces interest (HOME/INVESTMENT only)
- Tax-aware debt planner prioritises non-deductible loans first
- CAR loans can track vehicle depreciation via linked asset
- LINE_OF_CREDIT tracks revolving balance via linked account  

---

# **3.3 Accounts**

### **Entity: Account**

```
id: string
type: "account"
name: string
institution: string
accountType: "OFFSET" | "SAVINGS" | "CHECKING"
balance: number
bsb?: string
numberMasked?: string
```

### **Relationships**

```
account → transaction[]
account → loan? (offset)
account → property? (rare)
```

---

# **3.4 Income**

### **Entity: Income**

```
id: string
type: "income"
name: string
incomeType: "SALARY" | "RENT" | "RENTAL" | "INVESTMENT" | "OTHER"
customCategoryId?: string     // Reference to user-defined Category (takes precedence over incomeType if set)
sourceType: "GENERAL" | "PROPERTY" | "INVESTMENT"
amount: number
frequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "ANNUAL"
startDate?: string
endDate?: string
propertyId?: string
investmentAccountId?: string
isTaxable: boolean            // Is this income taxable? (default: true)
```

### **Source Types**

| Source Type | Description | Links To |
|-------------|-------------|----------|
| GENERAL | General income (salary, etc.) | None |
| PROPERTY | Property rental income | Property |
| INVESTMENT | Investment returns | Investment Account |

### **Relationships**

```
income → property?
income → investmentAccount?
income → customCategory?      // User-defined category
```

---

# **3.5 Expenses**

### **Entity: Expense**

```
id: string
type: "expense"
name: string
category: "HOUSING" | "RATES" | "INSURANCE" | "MAINTENANCE" | "PERSONAL" | "UTILITIES" | "FOOD" | "TRANSPORT" | "ENTERTAINMENT" | "SUBSCRIPTION" | "STRATA" | "LAND_TAX" | "LOAN_INTEREST" | "REGISTRATION" | "MODIFICATIONS" | "OTHER"
customCategoryId?: string     // Reference to user-defined Category (takes precedence over category if set)
sourceType: "GENERAL" | "PROPERTY" | "LOAN" | "INVESTMENT" | "ASSET"
amount: number
frequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL"
vendorName?: string
isEssential: boolean          // Is this an essential expense? (default: true)
isTaxDeductible: boolean      // Is this expense tax deductible? (default: false)
isRecurring: boolean          // Is this a recurring expense or one-off? (default: true)
startDate?: string
endDate?: string
propertyId?: string
loanId?: string
investmentAccountId?: string
assetId?: string
```

### **Expense Type Classification**

| isRecurring | Description | Examples |
|-------------|-------------|----------|
| `true` | Recurring/committed expenses | Bills, subscriptions, regular payments |
| `false` | One-off/discretionary spending | Impulse purchases, variable spending |

### **Source Types**

| Source Type | Description | Links To |
|-------------|-------------|----------|
| GENERAL | General household expenses | None |
| PROPERTY | Property-related expenses | Property |
| LOAN | Loan-related expenses (interest) | Loan |
| INVESTMENT | Investment account expenses | Investment Account |
| ASSET | Asset-related expenses | Asset (Vehicle, Equipment) |

### **Relationships**

```
expense → property?
expense → loan?
expense → investmentAccount?
expense → asset?
expense → customCategory?    // User-defined category
```

---

# **3.6 Categories (Custom)**

### **Entity: Category**

User-defined categories for expenses and income, allowing customization beyond system categories.

```
id: string
type: "category"
userId: string               // Owner of the category
name: string                 // Display name (e.g., "Pet Care", "Side Business")
code: string                 // Unique code per user (auto-generated from name)
categoryType: "EXPENSE" | "INCOME"
description?: string         // Optional description
color?: string               // Hex color for UI (e.g., "#FF5733")
icon?: string                // Icon name for UI
isSystem: boolean            // True for system defaults (false for user-created)
isActive: boolean            // Soft delete flag (default: true)
sortOrder: number            // Custom ordering
householdMemberId?: string   // Link to household member (auto-generated categories)
householdPetId?: string      // Link to household pet (auto-generated categories)
createdAt: string
updatedAt: string
```

### **Relationships**

```
category → user
category → expense[]         // Expenses using this category
category → income[]          // Income entries using this category
category → householdMember?  // Member this category was created for
category → householdPet?     // Pet this category was created for
```

### **Category Types**

| Type | Description | System Categories |
|------|-------------|-------------------|
| EXPENSE | Expense categories | HOUSING, RATES, INSURANCE, UTILITIES, FOOD, TRANSPORT, etc. |
| INCOME | Income types | SALARY, RENT, RENTAL, INVESTMENT, OTHER |

### **Usage Notes**

- System categories are available to all users and cannot be modified or deleted
- Custom categories are user-specific and appear in "My Categories" section
- When `customCategoryId` is set on an Expense/Income, it takes precedence over the system `category` field
- Categories can be soft-deleted (isActive: false) if in use, or permanently deleted if unused
- Categories linked to household members/pets are auto-generated and named with the member/pet name
- When a member/pet is deleted, linked categories are orphaned (unlinked) but not deleted

---

# **3.6.1 Household Profile (Phase 29)**

### **Entity: HouseholdProfile**

Captures household composition for personalized financial tracking and budgeting.

```
id: string
type: "household-profile"
userId: string
adultsCount: number          // Total adults in household
childrenCount: number        // Total children
petsCount: number            // Total pets
carsCount: number            // Total vehicles
lifestylePreferences?: {
  diningOut: "RARELY" | "OCCASIONALLY" | "FREQUENTLY"
  entertainment: "MINIMAL" | "MODERATE" | "PREMIUM"
  travel: "DOMESTIC" | "INTERNATIONAL" | "LUXURY"
}
needsMigration: boolean      // True if existing user needs to add member details
createdAt: string
updatedAt: string
```

### **Relationships**

```
householdProfile → user
householdProfile → householdMember[]
householdProfile → householdPet[]
```

---

# **3.6.2 Household Members (Phase 29)**

### **Entity: HouseholdMember**

Individual household member with detailed information for personalized category generation.

```
id: string
type: "household-member"
householdProfileId: string
name: string                 // Member's name (e.g., "Reza", "Sarah")
relationship: HouseholdRelationship
dateOfBirth?: string         // For age-based planning
isIncomeEarner: boolean      // Generates salary/super categories if true
sortOrder: number
createdAt: string
updatedAt: string
```

### **HouseholdRelationship Enum**

```
"SELF" | "SPOUSE" | "PARTNER" | "CHILD" | "PARENT" | "SIBLING" | "OTHER"
```

### **Relationships**

```
householdMember → householdProfile
householdMember → category[]   // Auto-generated categories for this member
```

### **Auto-Generated Categories by Member Type**

| Member Type | Categories Created |
|-------------|-------------------|
| Income Earner (Adult) | {Name}'s Salary, {Name}'s Super Contributions, {Name}'s Work Expenses, {Name}'s Health Insurance |
| Non-Earner (Adult) | {Name}'s Personal Spending, {Name}'s Health Expenses, {Name}'s Entertainment |
| Child | {Name}'s School Fees, {Name}'s Childcare, {Name}'s Kids Activities, {Name}'s Medical |

---

# **3.6.3 Household Pets (Phase 29)**

### **Entity: HouseholdPet**

Pet tracking for personalized pet expense categories.

```
id: string
type: "household-pet"
householdProfileId: string
name: string                 // Pet's name (e.g., "Fandogh", "Max")
petType: HouseholdPetType
breed?: string
sortOrder: number
createdAt: string
updatedAt: string
```

### **HouseholdPetType Enum**

```
"DOG" | "CAT" | "BIRD" | "FISH" | "RABBIT" | "REPTILE" | "OTHER"
```

### **Relationships**

```
householdPet → householdProfile
householdPet → category[]    // Auto-generated categories for this pet
```

### **Auto-Generated Categories for Pets**

| Pet | Categories Created |
|-----|-------------------|
| Any Pet | {Name} Food & Supplies, {Name} Vet Visits, {Name} Pet Insurance, {Name} Grooming |

### **Category Orphaning on Delete**

When a household member or pet is deleted:
1. Linked categories are **unlinked** (householdMemberId/householdPetId set to null)
2. Categories are **NOT deleted** to preserve expense history
3. Orphaned categories remain usable and can be reassigned

---

# **3.7 Investment Accounts**

### **Entity: InvestmentAccount**

```
id: string
type: "investment-account"
name: string
provider: string
accountNumberMasked?: string
balance: number
```

### **Relationships**

```
investmentAccount → holdings[]
investmentAccount → transactions[]
```

---

# **3.7 Holdings**

### **Entity: Holding**

```
id: string
type: "holding"
symbol: string
units: number
averagePrice: number
marketValue: number
investmentAccountId: string
```

### **Relationships**

```
holding → investmentAccount
holding → transactions[]
```

---

# **3.8 Investment Transactions**

### **Entity: InvestmentTransaction**

```
id: string
type: "transaction"
transactionType: "BUY" | "SELL" | "DIVIDEND" | "FEE"
symbol: string
units: number
price: number
amount: number
date: string
holdingId?: string
investmentAccountId: string
```

---

# **4. Frequency Enum (Global)**

```
"WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "ANNUAL"
```

Conversion table used by:

- Income  
- Expenses  
- Loan extra repayments  
- Cashflow engine  

---

# **5. GRDCS Relationship Map**

The **canonical relationship map** defines **every valid edge** in the system.

```
property → loan
property → expense
property → income
property → account (offset)

loan → property
loan → account (offset or linked for LINE_OF_CREDIT)
loan → asset (vehicle for CAR loans)
loan → transaction
loan → expense

account → transaction
account → loan (offset or credit line)

asset → loan (CAR loans)
asset → expense
asset → valueHistory
asset → serviceRecord

category → expense[]
category → income[]
category → householdMember?
category → householdPet?

householdProfile → householdMember[]
householdProfile → householdPet[]

householdMember → householdProfile
householdMember → category[]

householdPet → householdProfile
householdPet → category[]

investmentAccount → holding
investmentAccount → transaction

holding → transaction
```

GRDCS stores this as adjacency lists.

### **GRDCS Entity Types**

```typescript
type GRDCSEntityType =
  | 'property'
  | 'loan'
  | 'income'
  | 'expense'
  | 'account'
  | 'asset'               // Phase 21: Asset Management
  | 'category'            // Custom user-defined categories
  | 'householdProfile'    // Phase 29: Household Profile
  | 'householdMember'     // Phase 29: Household Members
  | 'householdPet'        // Phase 29: Household Pets
  | 'investmentAccount'
  | 'investmentHolding'
  | 'investmentTransaction'
  | 'depreciationSchedule';
```

---

# **6. Aggregation Rules (Snapshot Engine)**

### **6.1 Portfolio Value**

```
sum(property.marketValue)
+ sum(investmentAccount.balance)
+ sum(account.balance)
- sum(loan.principalRemaining)
```

### **6.2 Cashflow Calculation**

```
sum(income converted to monthly)
- sum(expenses converted to monthly)
- loan repayments (engine)
```

### **6.3 LVR Calculation**

```
loan.principalRemaining / property.marketValue
```

### **6.4 Equity Calculation**

```
property.marketValue - outstandingLoans
```

---

# **7. Data Model Requirements**

### **7.1 Must Not Change Without Migration**
Any changes to:

- Field names  
- Data types  
- Enum values  
- Relationship rules  
- Entity structure  

require:

- Schema migration  
- GRDCS rebuild  
- Snapshot recalibration  
- Insights rule updates  

### **7.2 Must Use Canonical Types**
All modules use **shared global types**, not module-specific variants.

---

# **8. Future Extensions**

The data model is designed to support future phases:

- Multi-currency  
- Multi-tenant  
- Tax engine  
- Forecasting  
- Financial health scoring  
- External bank/feed ingestion  
- Smart categorisation  


