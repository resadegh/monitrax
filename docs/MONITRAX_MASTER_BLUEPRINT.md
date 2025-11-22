MONITRAX MASTER BLUEPRINT — v1.1
Official Architecture, Financial Engine, Product Specification & System Bible

Version 1.1 — Investments, Depreciation & CGT Foundation

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

4.8 Investment Engine (Phase 3) — IMPLEMENTED

Now supports:

Investment Accounts (Brokerage, Super, Fund, Trust, ETF/Crypto)

Investment Holdings (Shares, ETFs, Managed Funds, Crypto)

Investment Transactions (Buy, Sell, Dividend, Distribution, DRP)

Franking credit calculations (Australian)

Dividend yield calculations (gross and net)

Cost base tracking for CGT

Portfolio performance metrics

Planned (Phase 4+):

Dollar-cost averaging analysis

Risk-weighting

Portfolio correlation

Monte Carlo forecasting

4.9 Depreciation Engine (Phase 3) — IMPLEMENTED

Now supports:

Division 40 (Plant & Equipment)

Division 43 (Capital Works)

Prime Cost method

Diminishing Value method

Per-property depreciation schedules

Annual depreciation calculations

Multi-year forecasting

Pro-rata first year calculations

Planned (Phase 4):

Automatic effective life lookups

Integration with Tax Engine

Depreciation report exports

4.10 CGT Engine Foundation (Phase 3) — IMPLEMENTED

Foundation stubs for:

Cost base calculation (5 elements)

CGT discount (50% for >12 months)

Capital gain/loss tracking

Main residence exemption (partial)

Property CGT helpers

Share/ETF CGT helpers

Planned (Phase 4):

Full Tax Engine integration

CGT event summary reports

Prior year loss carry-forward

Small business concessions

4.11 AI Strategy Engine (Phase 5)

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

Phase 4 — NEXT

Forecasting engine
Capital event modelling

Phase 5 — FINAL

AI strategy engine
Advisor-grade intelligence

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

13. CHANGELOG

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

END OF BLUEPRINT v1.1
