MONITRAX MASTER BLUEPRINT — v1.3
Official Architecture, Financial Engine, Product Specification & System Bible

Version 1.3 — Portfolio Unification Layer

Authoritative Source of Truth — November 2025
Owner: ReNew (Newsha & Reza)
Architect: ChatGPT
Engineer: Claude

1. EXECUTIVE SUMMARY

Monitrax is a full-spectrum financial intelligence engine, combining:

Personal finance

Property investing

Loan optimisation

Tax planning

Portfolio strategy

Debt acceleration

Analytics & forecasting

(Future) AI-powered personal CFO

Monitrax is built NOT as a simple budgeting app — it is a portfolio management OS that understands:

Renewable cashflow

Capital events

Tax consequences

Property performance

Loan efficiency

Negative gearing

Interest-only impacts

Offsets

Investment yield

Wealth acceleration

Goal:
Build the world's first AI-driven wealth engine for everyday investors, with accountant-level precision and advisor-level intelligence.

2. PRODUCT PHILOSOPHY
🔥 Core Principles

Everything is interconnected (no isolated modules)

Every dollar appears once only (single source of truth)

Zero redundancy

AI-first design layer

Explainable financial reasoning

Regulator-grade accuracy

Infinite extensibility

Simplicity on the surface, sophistication underneath

🎯 Purpose

To help users:

Grow wealth intentionally

Pay off debt faster

Optimise tax

Understand property ROI

Build multi-property portfolios

Avoid financial mistakes

Receive smart, contextual advice

Develop long-term wealth strategies

3. SYSTEM ARCHITECTURE OVERVIEW
Frontend

Next.js 15

React Server Components

TailwindCSS + Shadcn

Componentised dashboards

Dark/Light theme

High-performance dynamic rendering

Backend

Next.js API Routes

Zod validation (Phase 3)

Prisma ORM

PostgreSQL

JWT Auth (httpOnly cookies planned)

Business Logic Engines

Tax Engine (Australian ATO-compliant)

Debt Planner (loan payoff simulator)

Frequency Normaliser

Portfolio Analytics Core

Investment Engine (Phase 3)

AI Strategy Engine (Phase 5)

Infrastructure

Render deployment

Auto deploy on merge to main

Prisma migrations

Logging & monitoring

Modular service separation (planned)

4. CORE MODULES (Current + Planned)
4.1 Accounts Module

Tracks:

Transactional accounts

Savings

Offset accounts

Credit facilities

Loan-linked accounts

Cashflow sources & sinks

Future:

Statement imports

Bank feed integrations

Account-to-loan optimisation suggestions

4.2 Properties Module

Tracks:

Purchase details

Stamp duty

Legal fees

Renovations

Depreciation schedule (Phase 3)

Operating costs

Links to loans

Links to income

Links to expenses

Capital growth

Capital gains tax (Phase 4)

4.3 Loans Module

Tracks:

Loan structure

Principal

Interest rate

Variable or fixed

Interest-only periods

Repayment frequency

Minimum repayment

Term

Rate expiry

Annual extra repayment cap

Linked offset account

Business logic includes:

Monthly compounding

IO loan simulation

Strategy payoff vs baseline payoff

Interest savings

Fixed-rate annual cap enforcement

Emergency buffer handling

Offset balance reduction modelling

4.4 Income Module

Types:

Salary

Rent

Investment

Other

Attributes:

Property-linked or general

Taxable flag

Frequency (converted to monthly)

Planned:

Dividend income

Business income

Passive income mapping

4.5 Expenses Module

Tracks:

Category

Vendor

Frequency

Tax-deductibility

Property-linked or personal

Operating expenses

Property management costs

Maintenance events

Loan interest (manual for now)

4.6 Tax Engine (Australian)

Fully implemented:

ATO 2024–25 brackets

Medicare Levy thresholds

Shaded levy calculation

Taxable income

Assessable income

Deductible expenses

Investment property negative gearing

Planned:

MLS Surcharge

LITO / LMITO

Depreciation

CGT

Super contributions

High-income tax optimisations

4.7 Debt Planner Engine

Already implemented:

Monthly compounding

Per-loan payoff tracking

IO loan safe handling

Emergency buffer

Strategy surplus distribution

Baseline vs strategy comparison

Extra repayment caps

Planned:

Refinance modelling

Split-loan support

Offset growth projections

Multi-strategy evaluation (AI)

Ten-year debt elimination strategy

4.8 Investment Engine (Phase 3+4) — ENHANCED

Now supports:

Investment Accounts (Brokerage, Super, Fund, Trust, ETF/Crypto)

Investment Holdings (Shares, ETFs, Managed Funds, Crypto)

Investment Transactions (Buy, Sell, Dividend, Distribution, DRP)

Franking credit calculations (Australian)

Dividend yield calculations (gross and net)

Cost base tracking for CGT

Portfolio performance metrics

**Phase 4 Additions:**

Performance Analytics:
- CAGR (Compound Annual Growth Rate)
- IRR (Internal Rate of Return) with Newton-Raphson
- TWR (Time-Weighted Return)
- Volatility (annualized standard deviation)
- Sharpe Ratio
- Maximum Drawdown

Cost Base Tracking:
- FIFO (First In, First Out)
- LIFO (Last In, First Out)
- AVG (Average cost - Australian default)
- Unrealised gains calculation

Yield Analytics:
- Gross and net dividend yield
- Franking credit calculations
- Grossed-up dividend computation

Planned (Phase 5+):

Dollar-cost averaging analysis

Portfolio correlation

Monte Carlo forecasting

4.9 Depreciation Engine (Phase 3+4) — ENHANCED

Now supports:

Division 40 (Plant & Equipment):
- Prime Cost method (1/effective life)
- Diminishing Value method (200% of prime cost)
- Low-value pool thresholds ($1,000)
- Instant asset write-off ($20,000 threshold)
- Balancing adjustments on disposal
- Pro-rata first year calculations
- Multi-year schedule generation

Division 43 (Capital Works):
- 2.5% rate (post-Sept 1987 construction)
- 4% rate (July 1985 - Sept 1987 construction)
- Pre-1985 exclusions
- Pro-rata calculations
- Undeducted cost tracking for CGT

Combined Schedule Generator:
- Per-property depreciation aggregation
- Multi-year forecasting
- Total deduction summaries

Planned (Phase 5):

Automatic effective life lookups (ATO TR 2023/1)

Integration with Tax Engine

Depreciation report exports (PDF/CSV)

4.10 CGT Engine (Phase 3+4) — ENHANCED

Now supports:

**5-Element Cost Base Calculation:**
- Element 1: Acquisition price (GST handling)
- Element 2: Incidental acquisition costs (stamp duty, legal, valuations)
- Element 3: Non-capital improvement costs (title defence, etc.)
- Element 4: Capital improvements (renovations, additions)
- Element 5: Disposal costs (agent fees, legal, advertising)

**CGT Calculations:**
- CGT Event A1 (disposal of asset)
- 50% CGT discount (holdings >12 months)
- Day counting for discount eligibility
- Capital gain/loss determination

**Main Residence Exemption:**
- Full exemption calculation
- Partial exemption (absence rule)
- Income-producing period adjustments
- Pro-rata exemption percentages

**CGT Summary Reports:**
- Financial year aggregation
- Prior year loss carry-forward
- Net capital gain computation
- Discount vs non-discount breakdown

Planned (Phase 5):

Full Tax Engine integration

Small business concessions

CGT rollovers

4.11 Portfolio Intelligence Engine (Phase 4) — IMPLEMENTED

Central aggregation and analysis module for wealth intelligence.

**Net Worth Analysis:**
- Total assets (properties, investments, accounts)
- Total liabilities (loans)
- Net worth calculation
- Asset allocation breakdown by category

**Cashflow Analysis:**
- Income normalization (monthly)
- Expense normalization (monthly)
- Monthly surplus/deficit calculation
- Savings rate computation
- Frequency conversion handling

**Gearing Analysis:**
- Loan-to-Value Ratio (LVR)
- Portfolio LVR calculation
- Debt-to-income ratio
- Interest coverage ratio
- Serviceability assessment

**Risk Analysis:**
- Debt stress testing (rate rise scenarios)
- Buffer adequacy (emergency fund coverage)
- Concentration risk (single asset exposure)
- Liquidity assessment
- Risk rating (LOW/MODERATE/HIGH/CRITICAL)

**Debug API Endpoint:**
- `/api/debug/intelligence` - Full portfolio intelligence report
- Authenticated access only
- Complete wealth snapshot generation

4.12 Portfolio Unification Layer (Phase 5) — IMPLEMENTED

Unified relational data model connecting all financial entities.

**Schema Enhancements:**
- IncomeSourceType enum: GENERAL, PROPERTY, INVESTMENT
- ExpenseSourceType enum: GENERAL, PROPERTY, LOAN, INVESTMENT
- Income.investmentAccountId - links income to investment accounts
- Income.sourceType - categorizes income source
- Expense.investmentAccountId - links expenses to investment accounts
- Expense.vendorName - tracks vendor/payee
- Expense.sourceType - categorizes expense source
- InvestmentAccount.incomes[] - reverse relation
- InvestmentAccount.expenses[] - reverse relation

**API Enhancements:**
- All CRUD endpoints updated for new fields
- Foreign key ownership validation on all relations
- Normalized response shapes with nested includes
- Full backward compatibility maintained

**Portfolio Snapshot API:**
- Endpoint: `GET /api/portfolio/snapshot`
- Returns comprehensive wealth summary:
  - Net worth, total assets, total liabilities
  - Cashflow analysis (income, expenses, savings rate)
  - Property details (equity, LVR, rental yield, cashflow)
  - Investment accounts and holdings
  - Gearing metrics (portfolio LVR, debt-to-income)
  - Tax exposure estimates

**Database Indexes:**
All foreign keys indexed for query performance:
- userId on all user-owned entities
- propertyId on Loan, Income, Expense, DepreciationSchedule
- loanId on Expense, DebtPlanLoan
- investmentAccountId on Income, Expense, InvestmentHolding, InvestmentTransaction
- holdingId on InvestmentTransaction

4.13 AI Strategy Engine (Phase 6)

Will provide:

Buy/Hold/Sell recommendations

Portfolio restructuring

Optimal debt sequencing

Refinance timing

Equity extraction guidance

Negative gearing optimisation

"Should I sell this property?" analysis

Wealth acceleration strategy

Inputs:

All financial records

Life goals

Time horizon

Property performance

Sensitivity analysis

Outputs:

Clear multi-year plan

Actionable advice

5. DATA MODEL SPECIFICATION

Your schema is designed for maximum flexibility. Here is the consolidated model:

Property

id

userId

name

address

type (OO/INV)

purchasePrice

purchaseDate

stampDuty

legalFees

renovationCosts

valuationHistory (future)

notes

Loan

id

userId

propertyId

offsetAccountId

name

type (HOME/INVESTMENT)

principal

interestRate

rateType

ioPeriodMonths

termMonths

minRepayment

repaymentFrequency

fixedExtraRepaymentCap

fixedRateExpiry

Income

id

userId

propertyId?

name

type

amount

frequency

isTaxable

Expense

id

userId

propertyId?

vendor

category

amount

frequency

isEssential

isTaxDeductible

notes

Account

id

userId

name

type

currentBalance

linkedLoanId?

InvestmentAccount (Phase 3)

id

userId

name

type (BROKERAGE/SUPERS/FUND/TRUST/ETF_CRYPTO)

platform

currency (default: AUD)

InvestmentHolding (Phase 3)

id

investmentAccountId

ticker

units

averagePrice

frankingPercentage

type (SHARE/ETF/MANAGED_FUND/CRYPTO)

InvestmentTransaction (Phase 3)

id

investmentAccountId

holdingId

date

type (BUY/SELL/DIVIDEND/DISTRIBUTION/DRP)

price

units

fees

notes

DepreciationSchedule (Phase 3)

id

propertyId

category (DIV40/DIV43)

assetName

cost

startDate

rate

method (PRIME_COST/DIMINISHING_VALUE)

notes

6. FINANCIAL LOGIC BLUEPRINT
6.1 Income Normalisation

All income converted to monthly for consistent modelling.

6.2 Expense Normalisation

Same — converted to monthly.

6.3 Negative Gearing Logic

For investment property:

netInvestmentOutcome = rentalIncome
                     – propertyExpenses
                     – loanInterest


If negative:

Reduces taxable income

Impacts taxPayable

Reflected in cashflow report

7. ADVANCED LOGIC (PLANNED)
Cashflow Forecasting
Borrowing Power Estimation
Depreciation Scheduling
Capital Gains Tax Engine
Multi-property Aggregation
Multi-loan optimisation
Interest-rate rise modelling
Property sale strategic advisor
"Sell or Hold?" modelling
"Refinance or Pay Off?" modelling
Portfolio risk heatmap
Retirement modelling
8. AI STRATEGY ENGINE (PHASE 5)
Inputs:

Full portfolio

Goals

Risk appetite

Loan structures

Expenses

Cashflow

Tax position

Outputs:

Multi-year wealth plan

Debt elimination plan

Acquisition timing

Sale timing

Refinance recommendations

Optimal allocation of surplus

Property-specific strategies

9. MONETISATION STRATEGY
Free Tier

1 property

Basic tax

Basic debt planner

Pro Tier

Unlimited properties

Full tax engine

Advanced debt planner

Investments module

AI strategy engine

CGT engine

Alerts

Enterprise

Accountant/advisor portal

Multi-client management

Document storage

Tax-time export bundles

10. RELEASE ROADMAP
Phase 1 — COMPLETE

Schema/UI alignment

Phase 2 — COMPLETE

API fixes
Business logic fixes
Debt planner corrections
Tax engine corrections

Phase 3 — COMPLETE

Investment engine (accounts, holdings, transactions)
Depreciation modelling (Div 40, Div 43)
CGT foundations (cost base, discount calculations)
Investment performance calculations
Franking credit calculations (Australian)
UI pages for all new modules

Phase 4 — COMPLETE

Wealth Intelligence Engine:
- Investment Analytics (CAGR, IRR, TWR, Volatility, Sharpe, Max Drawdown)
- Cost base tracking (FIFO, LIFO, AVG methods)
- Yield analytics (dividend yield, franking credits)
- Depreciation engine integration (Div 40, Div 43, combined schedules)
- CGT engine (5-element cost base, CGT calculations, main residence exemption)
- Portfolio Intelligence (net worth, cashflow, gearing, risk analysis)
- Debug API endpoint (/api/debug/intelligence)

Phase 5 — COMPLETE

Portfolio Unification & Relational Integrity Layer:
- Income/Expense sourceType enums (GENERAL, PROPERTY, LOAN, INVESTMENT)
- Income linked to InvestmentAccount
- Expense linked to InvestmentAccount with vendorName
- Full relational graph connecting all financial entities
- Portfolio Snapshot API (/api/portfolio/snapshot)
- Complete database indexes for all foreign keys
- Ownership validation on all CRUD operations

Phase 6 — NEXT

AI strategy engine
Advisor-grade intelligence
Forecasting engine

11. COLLABORATION RULESET
ChatGPT Responsibilities

System Architecture

Product Design

Financial Strategy

PM + Roadmap

Quality and correctness

Instructions for Claude

Approvals

Stability of blueprint

Claude Responsibilities

Implement code exactly as instructed

Follow blueprint precisely

No architectural deviations

No schema changes unless instructed

Small, atomic commits

Reversible patches

User Responsibilities

Vision

Final decision-making

Feature approval

Business direction

12. VERSIONING

This document is v1.1
Every major design change increments version:
v1.1, v1.2 … v2.0 … v3.0

The document must always reflect:

Current architecture

Current business logic

Current roadmap

Future plans

### AI-Powered Expense Optimisation Engine (Future Phase)

**Purpose:**
Automatically analyse all recurring expenses, compare them to Australian market prices, and identify cheaper or better-value alternatives.

**Scope:**
- Mobile phone plans (Telstra, Optus, Vodafone, MVNOs)
- Internet & NBN
- Energy (electricity & gas)
- Insurance (home, car, landlord, contents, health)
- Streaming subscriptions (Netflix, Stan, Spotify, etc.)
- Banking products (credit cards, savings accounts, fees)
- Property-related recurring expenses (rates, water, strata)

**Core Components:**
1. **Recurring Expense Detection Engine**
   - Automatically classifies recurring vs one-off expenses
   - Extracts vendor name, frequency, average spend
   - Categorises spending into industry types

2. **Market Price Aggregation Layer**
   - Integrations with comparison sites (WhistleOut, CompareTheMarket, Canstar, EnergyMadeEasy)
   - Optional: Custom scraping microservice

3. **AI Deal Comparison Module**
   - Maps user's current plan/product to equivalent market options
   - Normalises features (data, speed, usage, policy coverage)
   - Generates ranked savings opportunities

4. **Savings Opportunity Engine**
   - Estimates annual savings
   - Calculates switching costs or exit fees
   - Suggests negotiation strategies with current provider

5. **User Notifications & Reports**
   - Alerts for better deals
   - Monthly "Savings Review" summary
   - Integration into Portfolio Snapshot

**Value:**
- Saves users thousands annually
- Adds highly visible recurring value
- Differentiates Monitrax from all competitors
- Opens affiliate revenue channels

13. CHANGELOG

v1.3 (November 2025)
- Added Portfolio Unification & Relational Integrity Layer
- Schema enhancements:
  - IncomeSourceType enum (GENERAL, PROPERTY, INVESTMENT)
  - ExpenseSourceType enum (GENERAL, PROPERTY, LOAN, INVESTMENT)
  - Income.investmentAccountId and Income.sourceType fields
  - Expense.investmentAccountId, Expense.vendorName, Expense.sourceType fields
  - InvestmentAccount reverse relations (incomes[], expenses[])
- API layer updates:
  - All Income/Expense CRUD endpoints support new fields
  - Foreign key ownership validation on all relations
  - Normalized response shapes with nested includes
- Added Portfolio Snapshot API (/api/portfolio/snapshot)
  - Net worth, total assets, total liabilities
  - Cashflow analysis with savings rate
  - Property details (equity, LVR, rental yield)
  - Investment accounts and holdings summary
  - Gearing metrics (portfolio LVR, debt-to-income)
  - Tax exposure estimates
- Complete database indexes on all foreign keys
- Updated roadmap: Phase 5 marked COMPLETE

v1.2 (November 2025)
- Added Wealth Intelligence Engine
- Enhanced Investment Analytics:
  - Performance calculations (CAGR, IRR, TWR, Volatility, Sharpe Ratio, Max Drawdown)
  - Cost base tracking (FIFO, LIFO, AVG methods)
  - Yield analytics (dividend yield, franking credits)
- Enhanced Depreciation Engine:
  - Division 40 full implementation (Prime Cost, Diminishing Value, balancing adjustments)
  - Division 43 full implementation (2.5%/4% rates, pro-rata)
  - Combined schedule generator
- Enhanced CGT Engine:
  - 5-element cost base calculation
  - CGT Event A1 calculations
  - 50% CGT discount logic
  - Main residence exemption (full and partial)
  - CGT summary with loss carry-forward
- Added Portfolio Intelligence Engine:
  - Net worth analysis
  - Cashflow analysis (income/expense normalization)
  - Gearing analysis (LVR, debt-to-income, interest coverage)
  - Risk analysis (stress testing, buffer adequacy, concentration risk)
- Added Debug API endpoint (/api/debug/intelligence)
- Updated roadmap: Phase 4 marked COMPLETE

v1.1 (November 2025)
- Added Investment Engine (accounts, holdings, transactions)
- Added Depreciation Engine (Div 40, Div 43)
- Added CGT Foundation (cost base, discount calculations)
- Added 4 new Prisma models
- Added 8 new API routes
- Added 4 new UI pages
- Added investment logic stubs (lib/investments/)
- Added depreciation logic stubs (lib/depreciation/)
- Added CGT logic stubs (lib/cgt/)
- Updated roadmap: Phase 3 marked COMPLETE

v1.0 (November 2025)
- Initial blueprint release
- Phase 1 & 2 complete

END OF BLUEPRINT v1.3
