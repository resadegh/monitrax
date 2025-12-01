# Monitrax Implementation Changelog

**Last Updated:** 2025-12-01
**Active Branch:** `claude/continue-ai-strategy-engine-01Y1tCB7457LqYNMe3hwg1Jk`

---

## Summary

This document tracks all implementation changes, features, and bug fixes made to the Monitrax platform.

---

## Recent Changes (December 2025)

### Phase 20: Australian Tax Intelligence Engine ✅
**Date:** 2025-12-01

#### Phase 20A: Core Tax Engine

**Files Created:**
| File | Purpose |
|------|---------|
| `lib/tax-engine/index.ts` | Public API exports |
| `lib/tax-engine/types.ts` | Type definitions (TaxYearConfig, TaxBracket, etc.) |
| `lib/tax-engine/core/taxYearConfig.ts` | FY 2024-25 rates with Stage 3 tax cuts |
| `lib/tax-engine/core/incomeTaxCalculator.ts` | Tax bracket calculations |
| `lib/tax-engine/core/medicareLevyCalculator.ts` | Medicare levy + surcharge |
| `lib/tax-engine/core/paygCalculator.ts` | PAYG withholding tables |
| `lib/tax-engine/core/taxOffsets.ts` | LITO, SAPTO, franking credit offsets |
| `lib/cashflow/incomeNormalizer.ts` | Gross-to-net income conversion utility |
| `app/api/tax/route.ts` | GET/POST tax calculation API |
| `app/api/tax/position/route.ts` | Tax position calculator API |
| `app/dashboard/tax/page.tsx` | Tax Dashboard with tabs |

**Files Modified:**
| File | Changes |
|------|---------|
| `app/api/cashflow/route.ts` | Uses net income (after PAYG) for salary types |
| `app/api/calculate/cashflow/route.ts` | Returns gross, net, PAYG breakdown |
| `app/api/portfolio/snapshot/route.ts` | Added grossIncome, netIncome, paygWithholding |
| `app/api/financial-health/route.ts` | Uses net monthly income for health metrics |
| `app/dashboard/income/page.tsx` | Salary fields: gross/net selector, PAYG preview, super |
| `lib/documents/documentService.ts` | Fixed Prisma enum type casting |

**Features:**
- Australian Tax Engine with 2024-25 Stage 3 tax rates
- PAYG withholding calculation (weekly, fortnightly, monthly)
- Medicare levy (2%) with thresholds
- Tax offsets: LITO ($700 max), SAPTO, franking credits
- Tax Dashboard UI with Overview, Income, Deductions, Super tabs
- Income form enhancements for salary types (gross/net, PAYG preview)
- **Tax-Cashflow Integration**: All financial calculations now use after-tax (net) income for salary types

**Tax-Cashflow Integration Details:**
| API | Change |
|-----|--------|
| `/api/cashflow` | Income streams use net amounts after PAYG deduction |
| `/api/calculate/cashflow` | Returns `grossIncome`, `netIncome`, `paygWithholding` |
| `/api/portfolio/snapshot` | Cashflow section includes gross/net breakdown |
| `/api/financial-health` | Health metrics based on actual take-home pay |

**Bug Fixes:**
- Fixed `DepreciationRecord` type to match Prisma schema (`cost`, `rate`, `category`, `method`)
- Removed invalid `'DIVIDEND'` case from IncomeType switch (valid: SALARY, RENT, RENTAL, INVESTMENT, OTHER)
- Removed invalid `'INTEREST'` type comparison in tax API
- Fixed DocumentCategory Prisma-to-local enum type casting
- Fixed implicit `any` types in tax position route

---

## Recent Changes (November 2025)

### Phase 19: Document Management System ✅
**Date:** 2025-11-30

**Files Created:**
| File | Purpose |
|------|---------|
| `lib/documents/types.ts` | Core type definitions |
| `lib/documents/storage/interface.ts` | Storage provider interface |
| `lib/documents/storage/monitraxProvider.ts` | Monitrax storage implementation |
| `lib/documents/storage/factory.ts` | Storage provider factory |
| `lib/documents/documentService.ts` | Main document service |
| `lib/documents/index.ts` | Public API exports |
| `app/api/documents/route.ts` | List and upload API |
| `app/api/documents/[id]/route.ts` | Get, update, delete API |
| `app/api/documents/download/route.ts` | Signed URL file serving |
| `components/documents/DocumentUploadDropzone.tsx` | Drag-and-drop upload |
| `components/documents/DocumentList.tsx` | Document list with preview |
| `components/documents/DocumentBadge.tsx` | Document count badge |
| `app/dashboard/documents/page.tsx` | Documents Library page |

**Schema Additions:**
- `Document` model (metadata storage)
- `DocumentLink` model (polymorphic entity linking)
- `StorageProviderConfig` model (per-user storage config)
- `DocumentCategory` enum (11 categories)
- `StorageProviderType` enum (MONITRAX, GOOGLE_DRIVE)
- `LinkedEntityType` enum (9 entity types)

**Files Modified:**
- `prisma/schema.prisma` - Added Phase 19 models and enums
- `components/DashboardLayout.tsx` - Added Documents navigation

**Features:**
- Document upload with drag-and-drop
- Category and tag management
- Search and filter documents
- Preview PDFs and images in-app
- Signed URLs with 5-minute expiry
- Storage provider abstraction (ready for S3/Google Drive)
- Documents Library dashboard page

---

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
