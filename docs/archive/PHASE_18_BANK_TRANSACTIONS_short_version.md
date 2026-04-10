PHASE 18 — BANK TRANSACTION IMPORT, AUTO-CATEGORISATION & BUDGET RECONCILIATION ENGINE

(Fully deterministic – no AI dependency. Optional future AI support defined in Phase 19.)

18.1 Phase Overview

Phase 18 introduces a unified Bank Transactions Import & Financial Reconciliation Engine, allowing users to:

Import downloaded bank statements (.CSV, .OFX, .QIF)

Automatically categorise transactions into Monitrax expense/income types

Assign transactions to the correct financial entities (properties, investments, personal categories)

Detect duplicates

Reconcile spending against budgeted totals

Generate monthly financial health summaries

Provide real-time insights into financial performance

This phase connects the cashflow reality to the Monitrax model, making the app “complete”.

18.2 Features & Capabilities
18.2.1 Supported File Formats

CSV (all banks)

OFX (standard Open Financial Exchange)

QIF (legacy banks)

JSON (internal App → App export)

18.2.2 Transaction Normalisation Engine

All raw bank transactions are transformed into a standard schema:

interface NormalisedBankTransaction {
  id: string;
  date: string;
  description: string;
  rawDescription: string;
  amount: number;
  direction: 'DEBIT' | 'CREDIT';
  bankAccountId?: string;
  sourceFileId: string;
  hash: string;      // for duplicate detection
}


Processing includes:

Date normalisation

Amount normalisation (absolute vs signed)

Cleaning descriptors (remove emojis, weird characters)

Merchant extraction heuristics

Hashing for duplicates

18.3 Auto-Categorisation Engine

Transaction categorisation uses deterministic rule-based logic, NOT AI.

18.3.1 Category Rules

Rules include:

Merchant matching (e.g., OPTUS → “Mobile Plan”, COLES → “Groceries”)

Keyword heuristics (e.g., “RENT” → Property)

Bank pattern mappings (e.g., BPAY Biller codes)

User overrides (manual corrections stored for future matching)

18.3.2 Category Types

Each transaction is mapped to:

enum CategoryType {
  PROPERTY_EXPENSE,
  PERSONAL_EXPENSE,
  INVESTMENT_EXPENSE,
  INCOME,
  TRANSFER,
  UNKNOWN
}

18.3.3 Subcategory Mapping

Examples:

“Mobile Plan” → Household / Utilities / Mobile

“Netflix” → Household / Entertainment

“Council Rates” → Property / Rates

“Insurance Renewal” → Insurance / General

18.4 Linking to Monitrax Financial Entities
Property Linking

Council rates

Water

Repairs

Agents fees

Insurance
→ Automatically assigned to the relevant property

Loan Linking

Loan repayments split into:

Principal

Interest

Fees
→ Matched using loan account BSB/Account no patterns or bank descriptors

Investment Linking

Brokerage deposits

Share purchases

Dividend payments
→ Mapped to investment accounts

Personal Expenses Linking

If no property/loan/investment match → Personal category

18.5 Duplicate Detection Engine

Avoid double-imports using:

hash = sha256(date + amount + rawDescription)

File source ID

1-minute tolerance for rapid-fire duplicates

“sibling detection” (banks sometimes produce two entries for the same transaction)

Configurable duplicate policy:

Reject

Mark as duplicate

Merge into existing

18.6 Budget Comparison Engine

For each category, compare Actuals vs Budget:

18.6.1 Data Inputs

Monthly budget (from Phase 5 Expense & Income definitions)

Actual imported and categorised transactions

Monthly recurring obligations (loans, rent, subscriptions)

18.6.2 Outputs
interface BudgetComparisonResult {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  status: 'UNDER' | 'OVER' | 'ON_TRACK';
}

Per-Month Financial Status

Generate:

Total income vs total expenses

Savings achieved vs savings target

Spending categories exceeding thresholds

Warning flags (e.g., “Groceries exceeded by $240 this month”)

18.7 Monthly Financial Health Report

Readable narrative:

“You spent $1,240 less than your budget in September.”

“Mobile plan increased by $15 compared to last month.”

“Property 2 cost blowout: $600 repairs exceeded maintenance plan.”

“Savings rate for October: 22.4% (Goal: 25%).”

Fully deterministic templates (no AI dependency).

18.8 UI/UX Requirements
18.8.1 Import Wizard

Flow:

Upload file

Detect format

Preview parsed data

Confirm mappings

Review categorisation

Save & Link

18.8.2 Bank Transactions Dashboard

Includes:

Table with search, filter, pagination

Category badges

Link entity dropdowns

Duplicate flags

Override category button

18.8.3 Budget vs Actual Dashboard

Charts:

Monthly bar charts

Category donut chart

Trend lines

Savings rate vs target

18.9 Database Changes

New tables:

BankTransactionFile
BankTransactionRaw
BankTransactionNormalised
BankTransactionCategory
BankTransactionLink


Indexes for:

hash

date

amount

categoryId

linkedEntityId

18.10 API Requirements
Upload + Parse

POST /api/bank/import

Categorisation

POST /api/bank/categorise

Budget Comparison

GET /api/budget/comparison?month=2025-10

Financial Health Report

GET /api/budget/health?month=2025-10

18.11 Completion Criteria

Import wizard implemented

Auto-categorisation engine functional

Duplicate detection working

Budget comparison fully integrated

Monthly financial health narrative generated

All data linkable to properties, loans, investments

UI pages built and tested

Blueprint updated

Unit tests written
