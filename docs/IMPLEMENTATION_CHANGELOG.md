# Monitrax Implementation Changelog

**Last Updated:** 2025-11-30
**Active Branch:** `claude/continue-ai-strategy-engine-01Y1tCB7457LqYNMe3hwg1Jk`

---

## Summary

This document tracks all implementation changes, features, and bug fixes made to the Monitrax platform.

---

## Recent Changes (November 2025)

### Phase 17: Personal CFO Engine ✅
**Commit:** `b607df4`, `d5b74b1`
**Date:** 2025-11-30

**Files Created:**
| File | Purpose |
|------|---------|
| `lib/cfo/types.ts` | Core type definitions (40+ types) |
| `lib/cfo/scoreCalculator.ts` | CFO Score calculation engine |
| `lib/cfo/riskRadar.ts` | Risk detection service |
| `lib/cfo/actionEngine.ts` | Action prioritisation engine |
| `lib/cfo/intelligenceEngine.ts` | Main orchestrator |
| `lib/cfo/index.ts` | Public API exports |
| `app/api/cfo/route.ts` | REST API endpoint |
| `app/dashboard/cfo/page.tsx` | Dashboard UI |

**Files Modified:**
- `components/DashboardLayout.tsx` - Added Personal CFO navigation item

**Features:**
- CFO Score (0-100) with 6 weighted components
- Risk Radar detecting 10+ risk types
- Action Prioritisation Engine (4 priority levels)
- CFO Dashboard with visualizations
- Monthly progress tracking
- Quick stats cards

**Bug Fixes:**
- Replaced `uuid` package with `crypto.randomUUID()` to fix TypeScript type errors

---

### Phase 16: Reporting & Integrations Suite ✅
**Commits:** Multiple commits in session
**Date:** 2025-11-30

**Files Created:**
| File | Purpose |
|------|---------|
| `lib/reports/types.ts` | Report type definitions |
| `lib/reports/contextBuilder.ts` | GRDCS-based data fetcher |
| `lib/reports/generators/index.ts` | Generator orchestrator |
| `lib/reports/generators/financialOverview.ts` | Financial overview report |
| `lib/reports/generators/incomeExpense.ts` | Income/expense report |
| `lib/reports/generators/loanDebt.ts` | Loan/debt report |
| `lib/reports/generators/propertyPortfolio.ts` | Property portfolio report |
| `lib/reports/generators/investment.ts` | Investment report |
| `lib/reports/generators/taxTime.ts` | Tax-time report |
| `lib/reports/exporters/csv.ts` | CSV exporter |
| `lib/reports/exporters/json.ts` | JSON exporter |
| `lib/reports/exporters/xlsx.ts` | Excel exporter |
| `lib/reports/exporters/index.ts` | Exporter orchestrator |
| `lib/reports/index.ts` | Public API |
| `app/api/reports/route.ts` | REST API endpoint |
| `app/dashboard/reports/page.tsx` | Reports dashboard UI |

**Files Modified:**
- `components/DashboardLayout.tsx` - Added Reports navigation item
- `package.json` - Added xlsx dependency

**Bug Fixes:**
- Fixed Prisma schema field name mismatches in `contextBuilder.ts`:
  - Loan: `principal`, `interestRateAnnual`, `minRepayment`, `termMonthsRemaining`
  - Account: `currentBalance`
  - Property: `income` relation
  - InvestmentHolding: `ticker`, `averagePrice`
  - Income: `name`, `type`
  - Expense: `name`, `isTaxDeductible`

---

### SP-PROP-001: Property Module Support Pack ✅
**Commit:** `bdce8cf` (merge)
**Date:** 2025-11-30

**Merged from branch:** `claude/sp-prop-001-01Y1tCB7457LqYNMe3hwg1Jk`

**Files Modified:**
- `app/dashboard/properties/[id]/depreciation/page.tsx` - Enhanced with StatCards, remaining years
- `app/dashboard/properties/page.tsx` - Added linked metrics badges

**Files Added:**
- `docs/supportpack/# SP-PROP-001 — Property Module Support Pack v1`
- `docs/supportpack/monitrax_support_pack_framework.md`

**Features:**
- Depreciation page StatCards
- Remaining years/value calculations
- Breadcrumb navigation
- Properties list with linked metrics badges

---

## Previous Changes

### Phase 11: AI Strategy Engine
- Strategy recommendation system
- Multi-horizon forecasting
- Conflict resolution
- Entity-level strategy tabs

### Phase 14: Cashflow Optimisation Engine
- Cashflow forecasting
- Insight generator
- Stress testing
- Optimisation algorithms

### Phase 13: Transactional Intelligence Engine
- Unified transaction records
- Category inference
- Recurring payment detection
- Behavioural profiling

### Phase 12: Financial Health Engine
- Health score calculation
- Category scoring
- Risk modelling
- Aggregate health reports

### Phase 10: Authentication & Security
- MFA support (TOTP, SMS, WebAuthn)
- Passkey credentials
- Session management
- Audit logging
- Rate limiting

---

## Branch History

| Branch | Purpose | Status |
|--------|---------|--------|
| `claude/continue-ai-strategy-engine-01Y1tCB7457LqYNMe3hwg1Jk` | Main development | Active |
| `claude/sp-prop-001-01Y1tCB7457LqYNMe3hwg1Jk` | SP-PROP-001 Support Pack | Merged |

---

## Prisma Schema Notes

### Correct Field Names (as of 2025-11-30)

**Loan Model:**
- `principal` (not `currentBalance`)
- `interestRateAnnual` (not `interestRate`)
- `minRepayment` (not `monthlyRepayment`)
- `termMonthsRemaining` (not `remainingTerm`)
- No `lender` field

**Account Model:**
- `currentBalance` (not `balance`)

**Income Model:**
- `name` (not `source`)
- `type` (not `category`)

**Expense Model:**
- `name` (not `description`)
- `isTaxDeductible` (not `isDeductible`)

**InvestmentHolding Model:**
- `ticker` (not `symbol`)
- `averagePrice` (not `averageCost`)
- No `currentPrice` field
- No `name` field

**Property Relations:**
- `income` (not `incomes`)

---

## Technical Guidelines

### UUID Generation
Use `crypto.randomUUID()` instead of the `uuid` package to avoid TypeScript type declaration issues.

### API Authentication
All API routes must verify the Bearer token using `verifyToken()` from `@/lib/auth`.

### Navigation Updates
When adding new dashboard pages, update `components/DashboardLayout.tsx`:
1. Import the icon from `lucide-react`
2. Add to `navItems` array with `{ name, href, icon }`

---

## Deployment

**Platform:** Render (backend) + Vercel (frontend)
**Database:** PostgreSQL on Render
**ORM:** Prisma

**Build Command:** `npm run build`
**Start Command:** `npm run start`
