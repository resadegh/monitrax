# MONITRAX MASTER BLUEPRINT v2.0

**The Authoritative Reference for Monitrax Architecture, Implementation & Roadmap**

---

**Version:** 2.0
**Last Updated:** 2025-11-30
**Status:** Active Development
**Owners:** ReNew (Newsha & Reza)
**Architect:** ChatGPT | **Engineer:** Claude

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Philosophy](#2-product-vision--philosophy)
3. [Technical Architecture](#3-technical-architecture)
4. [Phase Implementation Status](#4-phase-implementation-status)
5. [Core Modules & Capabilities](#5-core-modules--capabilities)
6. [Data Model Overview](#6-data-model-overview)
7. [API Standards & Patterns](#7-api-standards--patterns)
8. [Future Roadmap](#8-future-roadmap)
9. [Governance & Collaboration](#9-governance--collaboration)

---

## 1. Executive Summary

**Monitrax** is an AI-driven personal wealth orchestration platform that transforms complex financial data into automated advice, clarity, and action.

### What Monitrax Is

- A **portfolio management operating system** for everyday investors
- An **AI-powered personal CFO** with accountant-level precision
- A **unified financial intelligence engine** connecting all aspects of personal wealth

### What Monitrax Manages

| Domain | Capabilities |
|--------|-------------|
| **Personal Finance** | Income, expenses, budgeting, cashflow |
| **Property Investing** | Purchase tracking, rental yield, depreciation |
| **Loan Optimisation** | Debt strategies, offset accounts, refinancing |
| **Tax Planning** | ATO-compliant calculations, negative gearing, CGT |
| **Portfolio Strategy** | Investment tracking, performance analytics |
| **Wealth Forecasting** | Multi-year projections, risk analysis |

### Current State (November 2025)

- **19 Phases** defined in the blueprint
- **12 Phases** fully implemented
- **Active Development:** Phase 19 (Document Management)
- **Platform:** Next.js 15, PostgreSQL, Prisma, Vercel

---

## 2. Product Vision & Philosophy

### Core Principles

1. **Everything is Interconnected** — No isolated modules; every entity relates to others
2. **Single Source of Truth** — Every dollar appears once only
3. **Zero Redundancy** — No duplicate data, no conflicting calculations
4. **AI-First Design** — Intelligence embedded at every layer
5. **Explainable Reasoning** — Users understand the "why" behind recommendations
6. **Regulator-Grade Accuracy** — ATO-compliant calculations
7. **Simplicity Over Complexity** — Sophisticated underneath, simple on the surface

### Target Users

- **Property Investors** — Managing multiple investment properties
- **Wealth Builders** — Optimising debt payoff and investment growth
- **Tax-Conscious Individuals** — Maximising deductions and planning CGT
- **Portfolio Managers** — Tracking diverse asset classes

### Ultimate Goal

> Build the world's first AI-driven wealth engine for everyday investors, with accountant-level precision and advisor-level intelligence.

---

## 3. Technical Architecture

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React Server Components, TailwindCSS, Shadcn/UI |
| **Backend** | Next.js API Routes, Prisma ORM |
| **Database** | PostgreSQL |
| **Authentication** | Clerk.dev (MFA, OAuth, Session Management) |
| **Deployment** | Vercel (Frontend), Render (Backend) |
| **File Storage** | Monitrax-managed (Phase 19), Google Drive (Phase 19B) |

### Core Engines

| Engine | Purpose |
|--------|---------|
| **Tax Engine** | Australian ATO-compliant tax calculations |
| **Debt Planner Engine** | Loan payoff simulation, strategy comparison |
| **Investment Analytics Engine** | CAGR, IRR, TWR, Sharpe Ratio, Max Drawdown |
| **Depreciation Engine** | Div 40 & Div 43 calculations |
| **CGT Engine** | 5-element cost base, discount eligibility |
| **Portfolio Intelligence Engine** | Net worth, gearing, risk analysis |
| **Financial Health Engine** | Health scoring across categories |
| **Cashflow Optimisation Engine** | Forecasting, stress testing |
| **Transactional Intelligence Engine** | Category inference, recurring detection |
| **AI Strategy Engine** | Multi-horizon recommendations |
| **Personal CFO Engine** | Unified intelligence orchestration |
| **Reporting Engine** | Multi-format export (CSV, Excel, JSON) |

### Data Standards

**GRDCS (Global Relational Data Consistency Specification)**

Every API response follows a standardised format:
- `entity` — Raw entity fields
- `linked` — Related entities with navigation hrefs
- `missing` — Incomplete data chains
- `_meta` — Linkage health and completeness scores

---

## 4. Phase Implementation Status

### Completed Phases

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|-----------------|
| **1** | Foundations | ✅ Complete | Schema/UI alignment, project setup |
| **2** | Schema & Engine Core | ✅ Complete | API fixes, business logic corrections |
| **3** | Financial Engines | ✅ Complete | Investment engine, depreciation, CGT foundations |
| **4** | Insights Engine v2 | ✅ Complete | Performance analytics, cost base tracking, yield analytics |
| **5** | Backend Integration | ✅ Complete | Portfolio unification, relational integrity layer |
| **6** | UI Core Components | ✅ Complete | Detail dialogs with tabs for all entities |
| **7** | Dashboard Rebuild | ✅ Complete | Portfolio Snapshot API, SVG charts, insights panel |
| **8** | Global Data Consistency | ✅ Complete | GRDCS, LinkedDataPanel, cross-module navigation |
| **9** | Global Nav & Health Insights | ✅ Complete | Navigation framework, health indicators |
| **10** | Auth & Security | ✅ Complete | MFA, passkeys, session management, audit logging |
| **11** | AI Strategy Engine | ✅ Complete | Recommendations, forecasting, conflict resolution |
| **12** | Financial Health Engine | ✅ Complete | Health scores, category scoring, risk modelling |
| **13** | Transactional Intelligence | ✅ Complete | Transaction records, category inference |
| **14** | Cashflow Optimisation | ✅ Complete | Forecasting, stress testing, optimisation |
| **16** | Reporting & Integrations | ✅ Complete | Report generators, CSV/Excel/JSON exporters |
| **17** | Personal CFO Engine | ✅ Complete | CFO Score, Risk Radar, Action Engine |

### In Progress

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| **19** | Document Management | 🔄 In Progress | Core infrastructure complete, entity tabs pending |

### Planned Phases

| Phase | Name | Status | Scope |
|-------|------|--------|-------|
| **14.5** | Mobile Web UI | 📋 Planned | Responsive optimisations |
| **15** | Mobile Companion App | 📋 Planned | Native mobile experience |
| **18** | Bank Transactions | 📋 Planned | Bank feed integration, transaction sync |
| **19B** | Cloud Storage Integration | 📋 Planned | Google Drive, OneDrive, iCloud |
| **20** | Australian Tax Intelligence Engine | 📋 Planned | Gross/net salary, auto-taxability, super tracking, AI tax optimizer |

---

## 5. Core Modules & Capabilities

### 5.1 Properties Module

**Tracks:**
- Purchase details (price, date, stamp duty, legal fees)
- Renovation costs and capital improvements
- Operating costs and property management
- Depreciation schedules (Div 40 & Div 43)
- Rental income and expenses
- Current valuations and capital growth
- Links to loans, income, and expenses

### 5.2 Loans Module

**Tracks:**
- Loan structure (principal, interest rate, term)
- Variable vs fixed rate periods
- Interest-only periods
- Repayment frequency and minimum payments
- Linked offset accounts
- Extra repayment caps

**Calculations:**
- Monthly compounding
- IO loan simulation
- Strategy vs baseline payoff comparison
- Interest savings projections

### 5.3 Accounts Module

**Types Supported:**
- Transactional accounts
- Savings accounts
- Offset accounts
- Credit facilities

**Features:**
- Loan-linked accounts
- Balance tracking
- Cashflow source/sink categorisation

### 5.4 Income Module

**Types:**
- Salary
- Rental income
- Investment income (dividends, distributions)
- Other income

**Features:**
- Property-linked or general
- Investment account linking
- Frequency normalisation

**Phase 20 Enhancements (Planned):**
- Gross/Net salary with automatic PAYG calculation
- Superannuation tracking (SG, salary sacrifice)
- Automatic taxability determination (removes manual toggle)
- Tax category assignment with ATO references

### 5.5 Expenses Module

**Tracks:**
- Category and vendor
- Frequency and amount
- Tax-deductibility
- Property/loan/investment linking
- Essential vs discretionary

### 5.6 Investment Module

**Investment Accounts:**
- Brokerage, Super, Fund, Trust, ETF/Crypto

**Investment Holdings:**
- Shares, ETFs, Managed Funds, Crypto
- Cost base tracking (FIFO, LIFO, AVG)
- Franking credit calculations

**Investment Transactions:**
- Buy, Sell, Dividend, Distribution, DRP

**Analytics:**
- CAGR, IRR, TWR
- Volatility, Sharpe Ratio
- Maximum Drawdown
- Unrealised gains

### 5.7 Tax Engine (Australian)

**Implemented:**
- ATO 2024-25 tax brackets
- Medicare Levy calculations
- Taxable income computation
- Deductible expenses
- Negative gearing
- CGT with 50% discount

**Phase 20 Enhancements (Planned):**
- Full PAYG withholding calculator
- Medicare Levy Surcharge
- LITO/LMITO offsets
- Superannuation contribution tracking
- Automatic income taxability rules
- AI-powered tax optimization
- Scenario modelling ("what if" analysis)
- Tax position dashboard with refund estimation

See: `docs/blueprint/PHASE_20_AUSTRALIAN_TAX_INTELLIGENCE_ENGINE.md`

### 5.8 Personal CFO Engine

**CFO Score (0-100):**
- Cashflow Strength (25%)
- Debt Coverage (20%)
- Emergency Buffer (15%)
- Investment Diversification (15%)
- Spending Control (15%)
- Savings Rate (10%)

**Risk Radar:**
- 10+ risk types detected
- Short/medium/long-term horizons
- Severity levels (LOW/MODERATE/HIGH/CRITICAL)

**Action Engine:**
- Prioritised daily actions
- Four priority levels
- Deadline tracking

### 5.9 Document Management (Phase 19)

**Capabilities:**
- Document upload (drag-and-drop)
- 11 document categories
- Tag management
- Search and filtering
- PDF/image preview
- Signed URLs (5-minute expiry)
- Polymorphic entity linking

**Supported Formats:**
- PDF, DOC, DOCX, XLS, XLSX
- CSV, TXT
- JPEG, PNG, GIF, WEBP, HEIC

---

## 6. Data Model Overview

### Core Entities

```
User
├── Properties
│   ├── Loans
│   ├── Income (rental)
│   ├── Expenses (operating)
│   ├── DepreciationSchedules
│   └── Documents
├── Accounts
│   └── Linked Loans (offset)
├── InvestmentAccounts
│   ├── Holdings
│   │   └── Transactions
│   ├── Income (dividends)
│   └── Expenses (fees)
├── Income (general)
├── Expenses (general)
├── DebtPlans
│   └── DebtPlanLoans
├── Documents
│   └── DocumentLinks
└── CFOScoreHistory
```

### Key Relationships

| Entity | Links To |
|--------|----------|
| Property | Loans, Income, Expenses, Depreciation, Documents |
| Loan | Property, Offset Account, Expenses |
| Account | Linked Loan |
| InvestmentAccount | Holdings, Transactions, Income, Expenses |
| InvestmentHolding | Transactions |
| Document | Any entity via DocumentLink |

---

## 7. API Standards & Patterns

### Authentication

All API routes require Bearer token authentication:
```typescript
const token = request.headers.get('Authorization')?.replace('Bearer ', '');
const user = await verifyToken(token);
```

### Response Format (GRDCS)

```json
{
  "entity": { /* raw entity fields */ },
  "linked": [
    {
      "id": "...",
      "type": "loan",
      "name": "Home Loan",
      "primaryValue": 450000,
      "href": "/dashboard/loans/[id]"
    }
  ],
  "missing": [
    {
      "type": "income",
      "reason": "No rental income linked"
    }
  ],
  "_meta": {
    "linkageScore": 85,
    "completeness": 0.9
  }
}
```

### Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/portfolio/snapshot` | Unified wealth summary |
| `GET /api/cfo` | Personal CFO dashboard data |
| `GET /api/reports` | Generate exportable reports |
| `GET /api/documents` | List documents |
| `POST /api/documents` | Upload document |
| `GET /api/debug/intelligence` | Full portfolio intelligence |

---

## 8. Future Roadmap

### Near-Term (Q4 2025)

| Priority | Feature | Phase |
|----------|---------|-------|
| High | Document entity tab integration | 19 |
| High | Google Drive integration | 19B |
| Medium | Bank transaction sync | 18 |
| Medium | Mobile-optimised UI | 14.5 |

### Mid-Term (Q1 2026)

| Priority | Feature |
|----------|---------|
| High | Native mobile app |
| Medium | Accountant/advisor portal |
| Medium | Multi-user portfolio sharing |

### Long-Term Vision

| Feature | Description |
|---------|-------------|
| **AI Expense Optimisation** | Compare bills to market, suggest savings |
| **Monte Carlo Forecasting** | Probability-based wealth projections |
| **Retirement Modelling** | Super optimisation, drawdown planning |
| **Property Sale Advisor** | "Should I sell?" analysis |
| **Refinance Timing** | Optimal refinance recommendations |

---

## 9. Governance & Collaboration

### Roles

| Role | Responsibility |
|------|----------------|
| **ChatGPT** | System architecture, product design, financial strategy |
| **Claude** | Implementation, code execution, technical delivery |
| **User** | Vision, decision-making, feature approval |

### Development Rules

1. **Blueprint is authoritative** — All changes must align with phase specifications
2. **No schema changes** without explicit instruction
3. **Small, atomic commits** — Reversible patches
4. **Security first** — Never compromise auth or data access
5. **Test before deploy** — TypeScript check must pass

### Documentation Updates

When implementing new features:
1. Update `IMPLEMENTATION_CHANGELOG.md` with changes
2. Mark phase status in this master blueprint
3. Update Prisma schema notes if fields change

---

## Appendix: Quick Reference

### File Locations

| Purpose | Path |
|---------|------|
| Prisma Schema | `prisma/schema.prisma` |
| API Routes | `app/api/` |
| Dashboard Pages | `app/dashboard/` |
| Shared Components | `components/` |
| Business Logic | `lib/` |
| Blueprint Docs | `docs/blueprint/` |

### Common Imports

```typescript
// Authentication
import { verifyToken } from '@/lib/auth';

// Database
import { prisma } from '@/lib/db';

// CFO Engine
import { getCFODashboardData } from '@/lib/cfo';

// Documents
import { DocumentCategory, LinkedEntityType } from '@/lib/documents/types';
```

### UUID Generation

Use `crypto.randomUUID()` instead of the `uuid` package to avoid TypeScript type declaration issues.

---

**END OF MASTER BLUEPRINT v2.0**

*This document is the single source of truth for Monitrax architecture and implementation status.*
