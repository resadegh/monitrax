MONITRAX MASTER BLUEPRINT — v1.4
Official Architecture, Financial Engine, Product Specification & System Bible

Version 1.4 — Cross-Module Linking & Data Consistency

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

Phase 6 — COMPLETE

UI Integration & Enhancement:
- Task 1: Income UI — Detail dialog with tabs, stat cards, linked data display
- Task 2: Expenses UI — Detail dialog with tabs, stat cards, category breakdown
- Task 3: Properties UI — Detail dialog with tabs (Details, Loans, Income, Expenses, Depreciation)
- Task 4: Loans UI — Detail dialog with tabs, offset account display, repayment calculations
- Task 5: Investment Accounts UI — Detail dialog with tabs, holdings summary
- Task 6: Accounts UI — Detail dialog with tabs, linked loan display
- Task 7: Investment Holdings UI — Detail dialog with tabs, transaction history
- Task 8: Investment Transactions UI — Detail dialog with CGT considerations, stat cards

Phase 7 — COMPLETE

Dashboard Redesign:
- Task 9: Complete dashboard overhaul with global UI standard
  - Portfolio Snapshot API integration (single unified data source)
  - Stat cards for Net Worth, Cash Flow, Savings Rate, Portfolio LVR
  - SVG Donut Chart for asset allocation visualization
  - Progress bars for asset breakdown (Properties, Cash, Investments)
  - Dynamic Insights Panel with portfolio health indicators
  - Tabbed detail panels (Properties, Investments)
  - Enhanced empty state with onboarding guidance
  - Quick actions with hover states

Phase 8 — IN PROGRESS

Global Data Consistency, Cross-Module Linking & Security Upgrade (Expanded Specification)

### Overview
Phase 8 is the consolidation layer that unifies Monitrax's backend, frontend,
navigation intelligence, relational model, insights engine, and security posture.
This phase ensures that every entity in the system communicates through a single
relational contract, while the UI adopts a universal pattern for linked-data visibility.
It also introduces enterprise-grade authentication and authorisation.

------------------------------------------------------------------------
## 8.1 Global Data Consistency & Cross-Module Linking
------------------------------------------------------------------------

### 10.1 Backend Relational Expansion (Completed)
Document-only summary:
- Ensure every API exposes complete relational context.
- Properties expose loans, income, expenses, depreciation schedules.
- Loans expose property, offset accounts, expenses.
- Investment accounts expose holdings, income, expenses.
- Holdings expose transactions & parent account.

### 10.2 Standardised Relational Payload Format (GRDCS)
(Completed but must be documented in the blueprint.)

GRDCS is the universal relational contract across ALL Monitrax API endpoints.

Every relational object MUST include:
- id
- type
- name
- primaryValue
- secondaryValue
- relatedIds[]
- href
- missingLinks[]

Every API must return:
```
{
  entity: { ...raw entity fields... },
  linked: GRDCS[],
  missing: GRDCS[]
}
```

Strict rules:
- No nested objects
- Normalised relations only
- href must map to detail pages
- relatedIds must be accurately populated
- missingLinks identifies incomplete data chains

### 10.3 LinkedDataPanel UI Component
A universal UI module used across all entity detail dialogs.

Features:
- Related entities list with icons
- One-click navigation across modules
- Missing-link warnings
- Relationship health score
- Value summaries
- Empty-state suggestions

### 10.4 Linked Data Tab (All Detail Dialogs)
Every entity's dialog receives a new tab:

Details | Financials/Data | Linked Data | Notes (future)

The LinkedDataPanel component is embedded in the Linked Data tab.

**Implementation Requirements:**
- Use LinkedDataPanel from Task 10.3
- Do NOT fetch nested relational data
- Use only GRDCS `_links.related[]` and `_meta.missingLinks[]`
- Follow global UI standard for empty states and warnings
- Navigation via GRDCS href

**Entities to implement:**
- Properties detail dialog
- Loans detail dialog
- Income detail dialog
- Expenses detail dialog
- Accounts detail dialog
- Investment Accounts detail dialog
- Investment Holdings detail dialog
- Investment Transactions detail dialog

**Tab order standard:**
1. Details (entity-specific fields)
2. Financials/Data (calculations, metrics)
3. Linked Data (LinkedDataPanel)
4. Notes (future phase)

### 10.5 Portfolio Snapshot Enhancements
Snapshot response expanded to include:
- linkedEntities[]
- missingEntities[]
- linkageScore (0–100)
- orphanedEntities[]
- moduleCompleteness breakdown

Dashboard shows:
- orphan detection
- missing income/loan/property links
- relationship health warnings

### 10.6 Insights Engine Enhancements
Add relational intelligence to insights:

Examples:
- Property has loan but no income
- Loan expenses without a linked loan
- Holding missing cost base → CGT warning
- Investment account missing holdings
- Duplicate/inconsistent relationships

New Insight Categories:
- Linkage Errors
- Data Health
- Completeness Gaps
- Risk Signals
- Opportunity Insights

### 10.7 Linkage Health Service (NEW ENDPOINT)
/api/portfolio/linkage-health

Returns:
- EntityHealth[]
- MissingLink[]
- SuggestedFix[]
- LinkageHeatmap

Used by dashboard, insights engine, and LinkedDataPanel.

### 10.8 Cross-Module Navigation Framework (CMNF)

Objective:
Create a unified navigation system enabling seamless traversal across relationally-linked entities throughout the entire Monitrax application.

Purpose:
- Support 1-click navigation from any GRDCS-linked entity.
- Provide consistent navigation behaviour across all entity dialogs.
- Enable breadcrumb rebuilding and relational drill-down paths.
- Serve as the foundation for Phase 9 global nav intelligence.

#### 10.8.1 Core Requirements

1. All entities must expose canonical hrefs:
   href pattern: /{module}/{id}
   Modules include:
   - properties
   - loans
   - accounts
   - offset-accounts
   - income
   - expenses
   - investment-accounts
   - holdings
   - transactions

2. LinkedDataPanel must rely entirely on hrefs supplied by GRDCS.
   No component may hardcode any routing rules.

3. The navigation layer must support:
   - opening dialogs via href
   - switching between tabs without losing context
   - deep relational drill-down:
     property → loan → expense → account → transaction → holding

4. Navigation state must persist:
   - tab state
   - last-opened entity
   - breadcrumb chain
   - scroll position (where applicable)

5. Breadcrumb rules:
   - dynamically generated from GRDCS chain
   - reflect real relational ancestry (not static hierarchy)
   - always show the current entity as the final segment

6. Back navigation must respect relational context:
   - NOT browser-level history
   - Use a dedicated navigation stack:
     navStack: Array<{ type: string, id: string, label: string, href: string }>

7. CMNF must be fully client-side.
   - No server calls required except initial entity fetch.

#### 10.8.2 Technical Components

Implement the following:

1. NavigationContext:
   Stores:
   - navStack
   - lastEntity
   - activeTab
   - lastRouteState
   Must expose:
   - push(entity)
   - pop()
   - reset()
   - getBreadcrumb()

2. useCrossModuleNavigation():
   Handles:
   - navigateToEntity(type, id)
   - openLinkedEntity(GRDCSLinkedEntity)
   - restoreContext()

3. Dialog Integration:
   All dialogs must accept navigation state via props:
   {
     fromLinkage?: boolean,
     breadcrumb?: BreadcrumbItem[]
   }

4. Route Map Enforcement:
   A single shared routeMap object must define all entity paths.

#### 10.8.3 Acceptance Criteria

- Every linked entity in LinkedDataPanel is clickable.
- Clicking opens the correct entity dialog with correct tab pre-selected.
- Breadcrumb correctly reflects navigation path.
- Back button respects relational navigation state.
- No full page reloads.
- No broken hrefs.
- No circular navigation loops.
- CMNF works across ALL entity types.

------------------------------------------------------------------------
## 8.2 Authentication, Security, Authorisation & Access Control
------------------------------------------------------------------------

### 11.1 Identity Provider Integration
Monitrax will NOT build full auth in-house.

Supported providers:
- Clerk.dev (recommended)
- Supabase Auth (cost effective)
- Auth0 (enterprise-level)

Clerk.dev provides:
- Email verification
- MFA (email, TOTP, SMS optional)
- Magic links
- OAuth/social login
- Device and session management
- Audit trail support

Monitrax wraps the provider via:
```
/lib/auth
  - getUser()
  - requireUser()
  - requireRole()
  - getSession()
```

Keeps auth provider-agnostic.

### 11.2 Authentication Rules
- Email + password
- Optional passwordless login
- Mandatory email verification
- Optional MFA:
    - Email OTP
    - authenticator app (TOTP)
    - SMS (optional)
- Trusted device tracking
- Session expiry + refresh token handling

### 11.3 RBAC (Role-Based Access Control)

Roles:
- owner
- member
- accountant
- viewer
- admin (internal only)

Applied to:
- CRUD on all financial entities
- Access to investment modules
- Access to tax/debt tools
- Export functionality
- Viewing insights / sensitive summaries

Middleware:
```
withRole(['owner', 'accountant'])
withRole(['viewer'])
```

UI-level enforcement:
- Disabled buttons when lacking permissions
- Tooltip explaining required role
- "Request Access" future feature

### 11.4 Security Controls
- Rate limiting on all API routes
- Brute-force protection (via auth provider)
- Suspicious login alerts
- Prisma encryption for sensitive fields
- HTTPS required
- Secure cookies
- CSRF protection
- IP throttling for abuse detection

### 11.5 Audit Logging
New table: AuditLog

Tracks:
- Login + logout
- Failed login attempts
- MFA enable/disable
- Role change events
- CRUD operations on entities
- Access denials
- Security events

Retention: 12 months
Export: CSV from dashboard settings (v2.0)

### 11.6 User Security Settings UI
Route: /dashboard/settings/security

Includes:
- Change password
- Enable/disable MFA
- Email verification status
- Active session list
- Terminate session
- Security alerts
- Audit log export

### 11.7 Architecture Notes
- Monitrax frontend structure unchanged
- Auth provider integrated via unified wrapper
- All security logic declarative
- RBAC checks at API + UI layer
- Security model scalable for shared portfolios (future)

------------------------------------------------------------------------
## END OF PHASE 8 — FINAL ARCHITECTURE
------------------------------------------------------------------------

------------------------------------------------------------------------
## PHASE 9 — SYSTEM INTELLIGENCE & GLOBAL NAVIGATION
------------------------------------------------------------------------

### Objective
Introduce a unified global navigation experience, integrate insights into all UI modules, and create a real-time global health feed powered by Snapshot 2.0, LinkageHealth, GRDCS, and the Insights Engine.

### 9.1 Unified Navigation Layer (UI)
- Implement global breadcrumb system using CMNF
- Add global header health indicator using /api/linkage/health
- Add entity-to-entity navigation entrypoints throughout the UI
- Support CMNF-based back-navigation stack restoration
- Provide invalid path resolution for missing or deleted entities
- All navigation must be consistent across modules

### 9.2 Insights Integration Across UI
- Dashboard insights feed consuming Insights Engine 2.0
- Module-level insights cards (Properties, Loans, Investments, etc.)
- Entity detail dialog insights displayed inside new "Insights" tab
- Insights must be grouped by severity and sorted accordingly
- Insight entries must contain CTA buttons for navigation/fixes

### 9.3 Real-time Global Health Feed (UI)
- Real-time updates reflecting:
  - Snapshot 2.0 metrics
  - LinkageHealth status
  - GRDCS missing links
  - Orphans & cross-module inconsistencies
- Display:
  - Global health badge
  - Module warning ribbons
  - Cross-entity relational warnings
  - Missing-link banners inside detail dialogs

------------------------------------------------------------------------

Phase 10 — PLANNED

AI Strategy Engine:
- Advisor-grade intelligence
- Buy/Hold/Sell recommendations
- Forecasting engine
- Multi-year wealth planning

------------------------------------------------------------------------
## PHASE 11 — TASK 3: FINANCIAL HEALTH ENGINE & AI ADVISOR
------------------------------------------------------------------------

### Overview
Implement a comprehensive Financial Health Engine that calculates user financial health scores and provides AI-powered advisory insights for wealth optimization.

### 11.1 Financial Health Score Calculator

#### Core Metrics
```typescript
interface FinancialHealthScore {
  overall: number;              // 0-100 composite score
  breakdown: {
    debtToIncome: number;       // Lower is better
    savingsRate: number;        // Higher is better
    emergencyFund: number;      // Months of expenses covered
    investmentDiversity: number; // Portfolio diversification score
    cashFlowHealth: number;     // Income vs expenses ratio
    propertyEquity: number;     // Equity percentage across properties
    loanHealth: number;         // Weighted by interest rates & terms
  };
  trend: 'improving' | 'stable' | 'declining';
  lastCalculated: Date;
}
```

#### Score Calculation Rules
- **Debt-to-Income Ratio**: (Total monthly debt payments / Gross monthly income) × 100
  - Excellent: < 20% → 100 points
  - Good: 20-35% → 80 points
  - Fair: 36-50% → 60 points
  - Poor: > 50% → 40 points

- **Savings Rate**: (Monthly savings / Net income) × 100
  - Excellent: > 20% → 100 points
  - Good: 10-20% → 80 points
  - Fair: 5-10% → 60 points
  - Poor: < 5% → 40 points

- **Emergency Fund Coverage**: Available liquid assets / Monthly expenses
  - Excellent: 6+ months → 100 points
  - Good: 3-6 months → 80 points
  - Fair: 1-3 months → 60 points
  - Poor: < 1 month → 40 points

### 11.2 AI Advisor Service

#### Advisory Categories
```typescript
type AdvisoryCategory =
  | 'debt_optimization'      // Loan refinancing, payoff strategies
  | 'investment_opportunity' // Asset allocation suggestions
  | 'expense_reduction'      // Cost-cutting recommendations
  | 'income_enhancement'     // Income diversification ideas
  | 'risk_mitigation'        // Insurance, emergency fund advice
  | 'tax_efficiency'         // Tax-advantaged strategies
  | 'property_strategy'      // Buy/sell/hold recommendations
  | 'retirement_planning';   // Long-term wealth building

interface AdvisoryInsight {
  id: string;
  category: AdvisoryCategory;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;           // 0-100%
  potentialSavings?: number;    // Estimated annual impact
  actionItems: ActionItem[];
  relatedEntities: GRDCSLinkedEntity[];
  expiresAt?: Date;
}
```

#### Intelligence Rules Engine
- **Debt Avalanche Detection**: Identify high-interest loans for priority payoff
- **Refinancing Opportunities**: Flag loans where market rates are significantly lower
- **Surplus Cash Detection**: Identify excess funds in low-yield accounts
- **Expense Anomaly Detection**: Unusual spending patterns vs historical averages
- **Portfolio Rebalancing**: Asset allocation drift from target
- **Rental Yield Optimization**: Property performance vs market benchmarks

### 11.3 API Endpoints

#### GET /api/health/score
Returns current financial health score with breakdown.

```typescript
interface HealthScoreResponse {
  score: FinancialHealthScore;
  comparisonBenchmark: {
    percentile: number;        // vs other users (anonymized)
    ageGroupAverage: number;
  };
  improvementPotential: number; // Points gainable with advisor actions
}
```

#### GET /api/advisor/insights
Returns personalized AI advisory insights.

```typescript
interface AdvisorInsightsResponse {
  insights: AdvisoryInsight[];
  summary: {
    totalPotentialSavings: number;
    highPriorityCount: number;
    completedThisMonth: number;
  };
  nextReviewDate: Date;
}
```

#### POST /api/advisor/insights/:id/dismiss
Dismiss or snooze an insight.

#### POST /api/advisor/insights/:id/complete
Mark an action item as completed.

### 11.4 UI Components

#### FinancialHealthDashboard
- Circular gauge showing overall score
- Breakdown bars for each metric
- Trend indicator with sparkline
- Quick action buttons

#### AdvisorPanel
- Prioritized insight cards
- Expandable action items
- Progress tracking
- Dismissal/snooze controls

#### ScoreHistoryChart
- Line chart showing score over time
- Milestone markers for significant changes
- Benchmark comparison overlay

### 11.5 Integration Points
- GRDCS: All entities feed into health calculations
- Snapshot 2.0: Real-time data source for scoring
- Insights Engine: Advisory insights extend existing insight system
- CMNF: One-click navigation to related entities

### 11.6 Implementation Order
1. Create health score calculation service
2. Implement scoring API endpoints
3. Build advisory rules engine
4. Create UI dashboard components
5. Add insight management features
6. Integration testing with GRDCS

------------------------------------------------------------------------

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

v1.4 (November 2025)
- Added Phase 6: UI Integration & Enhancement (Tasks 1-8) — COMPLETE
  - Detail dialogs with tabs for all entity pages
  - Stat cards and summary statistics
  - Linked data display in entity views
- Added Phase 7: Dashboard Redesign (Task 9) — COMPLETE
  - Portfolio Snapshot API integration
  - SVG charts for asset allocation
  - Dynamic insights panel
  - Tabbed detail panels
- Added Phase 8: Global Data Consistency & Cross-Module Linking (Task 10) — IN PROGRESS
  - Backend relational expansion specification
  - Standardized relational payload format
  - LinkedDataPanel UI component specification
  - Linked Data tab for all detail dialogs
  - Portfolio snapshot linkage enhancements
  - Insights engine linkage-based insights
  - Linkage health service and endpoint
  - Cross-module navigation improvements
- Updated roadmap: Phase 6 & 7 marked COMPLETE, Phase 8 IN PROGRESS

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

END OF BLUEPRINT v1.4
