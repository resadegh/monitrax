# PHASE 28 — DATABASE SCHEMA
**Monitrax Blueprint — Phase 28.2**
**Version:** v1.0
**Status:** Pending
**Created:** 2025-12-15

---

## Overview

Phase 28 introduces two new database tables to support household profiling and budget analysis with AI-powered variable expense estimation.

---

## New Tables

### 1. HouseholdProfile

Stores user's household composition for accurate expense estimation.

```prisma
model HouseholdProfile {
  id                    String   @id @default(uuid())
  userId                String   @unique

  // Household Composition
  adultsCount           Int      @default(1)      // 1-4 adults
  childrenCount         Int      @default(0)      // 0-6 children
  childrenAges          Int[]    @default([])     // Array of ages
  petsCount             Int      @default(0)      // 0-5 pets
  petTypes              String[] @default([])     // ["dog", "cat", "bird", etc.]
  carsCount             Int      @default(0)      // 0-4 vehicles

  // Lifestyle Preferences
  lifestylePreference   LifestylePreference @default(MODERATE)
  diningOutFrequency    DiningFrequency     @default(SOMETIMES)
  hobbiesWithCosts      String?             // Free text for hobbies

  // Metadata
  isComplete            Boolean  @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Relationships
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  budgetAnalyses        BudgetAnalysis[]

  @@index([userId])
  @@map("household_profiles")
}

enum LifestylePreference {
  FRUGAL      // Budget-conscious, minimal spending
  MODERATE    // Average Australian household
  COMFORTABLE // Higher spending, more conveniences
}

enum DiningFrequency {
  NEVER       // Always cook at home
  RARELY      // 1-2 times per month
  SOMETIMES   // Weekly dining out
  OFTEN       // Multiple times per week
}
```

#### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | Foreign key to User (unique - one profile per user) |
| `adultsCount` | Int | Number of adults in household (1-4) |
| `childrenCount` | Int | Number of children (0-6) |
| `childrenAges` | Int[] | Array of children's ages for expense scaling |
| `petsCount` | Int | Number of pets (0-5) |
| `petTypes` | String[] | Types: "dog", "cat", "bird", "fish", "other" |
| `carsCount` | Int | Number of vehicles (0-4) |
| `lifestylePreference` | Enum | FRUGAL / MODERATE / COMFORTABLE |
| `diningOutFrequency` | Enum | NEVER / RARELY / SOMETIMES / OFTEN |
| `hobbiesWithCosts` | String | Free text: "Golf ($200/mo), gym ($50/mo)" |
| `isComplete` | Boolean | True if all required fields filled |

---

### 2. BudgetAnalysis

Stores AI-generated budget analysis and user's final budget choice.

```prisma
model BudgetAnalysis {
  id                      String   @id @default(uuid())
  userId                  String
  householdProfileId      String?

  // Analysis Date
  analysisDate            DateTime @default(now())

  // Recurring Expenses (from user's tracked expenses)
  recurringExpensesTotal  Float               // Sum from Expense table
  recurringBreakdown      Json                // Category breakdown from DB

  // Variable Expenses (AI estimated)
  aiVariableEstimate      Float               // AI's estimate
  variableBreakdown       Json                // AI's category breakdown
  aiExplanation           String?             // AI's reasoning
  aiConfidence            Float?              // AI confidence score (0-1)

  // Totals
  totalRealisticBudget    Float               // recurring + variable

  // User Comparison & Choice
  userReportedTotal       Float?              // What user originally reported
  missingVariableExpenses Float?              // Difference (realistic - reported)
  userFinalBudget         Float?              // What user chose to use
  userOverrodeAi          Boolean  @default(false)
  userAdjustments         Json?               // Any changes user made

  // Three Scenarios from AI
  minimumScenario         Json?               // Frugal estimate
  recommendedScenario     Json?               // Realistic estimate
  comfortableScenario     Json?               // Higher spending estimate

  // Metadata
  status                  BudgetAnalysisStatus @default(PENDING)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  // Relationships
  user                    User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  householdProfile        HouseholdProfile? @relation(fields: [householdProfileId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([analysisDate])
  @@map("budget_analyses")
}

enum BudgetAnalysisStatus {
  PENDING       // Profile incomplete or AI not called
  ANALYZING     // AI analysis in progress
  READY         // Analysis complete, awaiting user review
  CONFIRMED     // User has confirmed their budget choice
  EXPIRED       // Analysis older than 30 days
}
```

#### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | Foreign key to User |
| `householdProfileId` | String? | Link to HouseholdProfile used |
| `analysisDate` | DateTime | When analysis was generated |
| `recurringExpensesTotal` | Float | Sum of user's tracked expenses |
| `recurringBreakdown` | JSON | Breakdown by category from DB |
| `aiVariableEstimate` | Float | AI's total variable expense estimate |
| `variableBreakdown` | JSON | AI's breakdown by category |
| `aiExplanation` | String | AI's reasoning and assumptions |
| `aiConfidence` | Float | AI's confidence in estimate (0-1) |
| `totalRealisticBudget` | Float | recurring + variable |
| `userReportedTotal` | Float | User's original expense total |
| `missingVariableExpenses` | Float | What was missing from user's data |
| `userFinalBudget` | Float | Budget user chose to use |
| `userOverrodeAi` | Boolean | True if user modified AI estimate |
| `userAdjustments` | JSON | User's changes to AI estimates |
| `minimumScenario` | JSON | Frugal budget scenario |
| `recommendedScenario` | JSON | Recommended budget scenario |
| `comfortableScenario` | JSON | Comfortable budget scenario |
| `status` | Enum | Analysis workflow status |

---

## JSON Schema Definitions

### recurringBreakdown

```typescript
interface RecurringBreakdown {
  categories: {
    [category: string]: {
      total: number;
      items: Array<{
        name: string;
        amount: number;
        frequency: string;
        monthlyAmount: number;
      }>;
    };
  };
  total: number;
}
```

**Example:**
```json
{
  "categories": {
    "INSURANCE": {
      "total": 617,
      "items": [
        { "name": "Pet Insurance", "amount": 247, "frequency": "MONTHLY", "monthlyAmount": 247 },
        { "name": "Health Insurance", "amount": 370, "frequency": "MONTHLY", "monthlyAmount": 370 }
      ]
    },
    "REGISTRATION": {
      "total": 28,
      "items": [
        { "name": "Car Registration", "amount": 331, "frequency": "ANNUALLY", "monthlyAmount": 28 }
      ]
    }
  },
  "total": 6245
}
```

### variableBreakdown

```typescript
interface VariableBreakdown {
  categories: {
    [category: string]: {
      estimate: number;
      confidence: 'high' | 'medium' | 'low';
      reasoning: string;
      excludedRecurring?: string[];  // What was excluded due to existing tracking
    };
  };
  total: number;
  assumptions: string[];
}
```

**Example:**
```json
{
  "categories": {
    "GROCERIES": {
      "estimate": 1200,
      "confidence": "high",
      "reasoning": "2 adults, 2 children, moderate lifestyle - typical Australian family",
      "excludedRecurring": []
    },
    "FUEL": {
      "estimate": 600,
      "confidence": "medium",
      "reasoning": "2 cars, suburban household, estimated 60km/day average",
      "excludedRecurring": ["Car Registration"]
    },
    "PET_COSTS": {
      "estimate": 100,
      "confidence": "medium",
      "reasoning": "1 dog - food and occasional vet visits",
      "excludedRecurring": ["Pet Insurance"]
    },
    "ENTERTAINMENT": {
      "estimate": 400,
      "confidence": "medium",
      "reasoning": "Family with children, sometimes dining out",
      "excludedRecurring": []
    }
  },
  "total": 3605,
  "assumptions": [
    "Based on Australian household averages for moderate lifestyle",
    "Fuel prices at $1.80/L average",
    "Dog food at $80/month for medium-sized dog",
    "Excludes pet insurance (already tracked at $247/mo)"
  ]
}
```

### Scenario Schema

```typescript
interface BudgetScenario {
  name: string;
  totalMonthly: number;
  breakdown: {
    [category: string]: number;
  };
  description: string;
  suitability: string;
}
```

**Example:**
```json
{
  "name": "Recommended",
  "totalMonthly": 3605,
  "breakdown": {
    "GROCERIES": 1200,
    "FUEL": 600,
    "PET_COSTS": 100,
    "ENTERTAINMENT": 400,
    "PERSONAL_CARE": 200,
    "CLOTHING": 150,
    "MEDICAL": 150,
    "MISCELLANEOUS": 200,
    "KIDS_ACTIVITIES": 300,
    "GIFTS": 150,
    "HOME_MAINTENANCE": 155
  },
  "description": "Realistic estimate for a moderate Australian household",
  "suitability": "Suitable for long-term budgeting without feeling restricted"
}
```

---

## Migration Script

```sql
-- CreateEnum
CREATE TYPE "LifestylePreference" AS ENUM ('FRUGAL', 'MODERATE', 'COMFORTABLE');
CREATE TYPE "DiningFrequency" AS ENUM ('NEVER', 'RARELY', 'SOMETIMES', 'OFTEN');
CREATE TYPE "BudgetAnalysisStatus" AS ENUM ('PENDING', 'ANALYZING', 'READY', 'CONFIRMED', 'EXPIRED');

-- CreateTable: HouseholdProfile
CREATE TABLE "household_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adultsCount" INTEGER NOT NULL DEFAULT 1,
    "childrenCount" INTEGER NOT NULL DEFAULT 0,
    "childrenAges" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "petsCount" INTEGER NOT NULL DEFAULT 0,
    "petTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "carsCount" INTEGER NOT NULL DEFAULT 0,
    "lifestylePreference" "LifestylePreference" NOT NULL DEFAULT 'MODERATE',
    "diningOutFrequency" "DiningFrequency" NOT NULL DEFAULT 'SOMETIMES',
    "hobbiesWithCosts" TEXT,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BudgetAnalysis
CREATE TABLE "budget_analyses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdProfileId" TEXT,
    "analysisDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recurringExpensesTotal" DOUBLE PRECISION NOT NULL,
    "recurringBreakdown" JSONB NOT NULL,
    "aiVariableEstimate" DOUBLE PRECISION NOT NULL,
    "variableBreakdown" JSONB NOT NULL,
    "aiExplanation" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "totalRealisticBudget" DOUBLE PRECISION NOT NULL,
    "userReportedTotal" DOUBLE PRECISION,
    "missingVariableExpenses" DOUBLE PRECISION,
    "userFinalBudget" DOUBLE PRECISION,
    "userOverrodeAi" BOOLEAN NOT NULL DEFAULT false,
    "userAdjustments" JSONB,
    "minimumScenario" JSONB,
    "recommendedScenario" JSONB,
    "comfortableScenario" JSONB,
    "status" "BudgetAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "household_profiles_userId_key" ON "household_profiles"("userId");
CREATE INDEX "household_profiles_userId_idx" ON "household_profiles"("userId");
CREATE INDEX "budget_analyses_userId_idx" ON "budget_analyses"("userId");
CREATE INDEX "budget_analyses_analysisDate_idx" ON "budget_analyses"("analysisDate");

-- AddForeignKey
ALTER TABLE "household_profiles" ADD CONSTRAINT "household_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "budget_analyses" ADD CONSTRAINT "budget_analyses_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "budget_analyses" ADD CONSTRAINT "budget_analyses_householdProfileId_fkey"
    FOREIGN KEY ("householdProfileId") REFERENCES "household_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## Updates to Existing Models

### User Model

Add relations to new tables:

```prisma
model User {
  // ... existing fields ...

  // Phase 28: Budget Analysis
  householdProfile  HouseholdProfile?
  budgetAnalyses    BudgetAnalysis[]
}
```

---

## Validation Rules

### HouseholdProfile

| Field | Validation |
|-------|------------|
| adultsCount | 1-4 |
| childrenCount | 0-6 |
| childrenAges | Array length must match childrenCount |
| childrenAges items | 0-18 |
| petsCount | 0-5 |
| petTypes | Array length must match petsCount |
| petTypes items | "dog", "cat", "bird", "fish", "other" |
| carsCount | 0-4 |
| hobbiesWithCosts | Max 500 characters |

### BudgetAnalysis

| Field | Validation |
|-------|------------|
| recurringExpensesTotal | >= 0 |
| aiVariableEstimate | >= 0 |
| totalRealisticBudget | >= recurringExpensesTotal |
| aiConfidence | 0-1 |

---

## Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| household_profiles | unique | userId | One profile per user |
| budget_analyses | index | userId | Quick user lookup |
| budget_analyses | index | analysisDate | Time-based queries |

---

## Data Retention

- **HouseholdProfile**: Persists until user deletes account
- **BudgetAnalysis**: Keep last 12 analyses per user, expire after 365 days

---

*Status: Pending Implementation*
*Author: Claude Code*
*Phase: 28.2*
