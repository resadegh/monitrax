> **ARCHIVED** - This document has been superseded by `docs/AUDIT_REPORT_ALIGNED.md` (which includes blueprint alignment and remediation tracking). Archived on 2026-04-10.

# Monitrax Application Audit Report

**Date:** January 20, 2026
**Scope:** Application Flow, Simplicity, Duplication Analysis & Monetization Readiness

---

## Executive Summary

Monitrax is a sophisticated personal finance and wealth planning platform built on Next.js 15 with React 19, targeting Australian users. The application has grown to **40,000+ lines of code** across **67 pages**, **133 components**, and **76 database models**. This audit identifies significant opportunities for simplification, consolidation of duplicate functionality, and clearer monetization pathways.

### Key Findings

| Area | Status | Priority |
|------|--------|----------|
| Code Duplication | 15+ duplicate implementations of core utilities | **Critical** |
| Navigation Complexity | 3 parallel apps with inconsistent patterns | **High** |
| Feature Overlap | Multiple onboarding flows, strategy components | **High** |
| Incomplete Features | 10+ placeholder/stub implementations | **Medium** |
| Monetization Infrastructure | Tier system exists but underutilized | **Medium** |

---

## 1. Application Architecture Overview

### Technology Stack
- **Framework:** Next.js 15.2.6 with App Router
- **Frontend:** React 19, TypeScript 5, Tailwind CSS
- **Database:** PostgreSQL with Prisma ORM (3,599 lines schema)
- **Auth:** JWT + OAuth (Google/Apple/Facebook/Microsoft) + Magic Links + Passkeys + MFA
- **AI/ML:** Google Generative AI, OpenAI, Google Cloud Vision
- **Banking:** Basiq Open Banking API
- **Communication:** Twilio (SMS), Resend (Email)

### Application Structure

| Section | Purpose | Pages | Complexity |
|---------|---------|-------|------------|
| `/dashboard` | Main user financial dashboard | 22 | High |
| `/(dashboard)` | Planning & analysis pages | 7 | High |
| `/admin` | Administrative panel | 11 | Medium |
| `/portal` | B2B advisor portal | 10+ | Medium |
| Auth routes | Login/register/verification | 7 | Low |

---

## 2. User Flow Analysis

### Current Navigation Structure

```
Landing Page (/)
    │
    ├── Authenticated → /dashboard (main hub)
    │   ├── Portfolio Group
    │   │   ├── Properties → /[id]/strategy, /[id]/depreciation
    │   │   ├── Loans → /[id]/strategy
    │   │   ├── Accounts
    │   │   ├── Investments → /holdings/[id]/strategy
    │   │   └── Assets
    │   │
    │   ├── Transactions Group
    │   │   ├── Income
    │   │   ├── Expenses
    │   │   ├── All Transactions (/transactions)
    │   │   └── Recurring (/recurring)
    │   │
    │   ├── Planning Group
    │   │   ├── Household Profile
    │   │   ├── Budget Analysis
    │   │   ├── Debt Planner
    │   │   ├── Cashflow (/cashflow)
    │   │   ├── Financial Health (/health)
    │   │   ├── Tax Calculator
    │   │   └── Strategy (/strategy)
    │   │
    │   └── Settings (8 sub-pages)
    │
    └── Unauthenticated → Marketing landing page
```

### Critical Flow Issues

#### Issue 1: Three Parallel Authentication Systems
- **Main App:** `/login`, `/signin`, `/register`
- **Admin Portal:** `/admin/login`
- **B2B Portal:** `/portal/login`, `/portal/signin`, `/portal/register`

**Problem:** Unclear difference between `/login` and `/signin` routes (both exist but serve same purpose)

**Recommendation:** Consolidate to single `/login` route per section

#### Issue 2: Split Dashboard Routes
- `/dashboard/*` pages use standard routing (22 pages)
- `/(dashboard)/*` pages use Next.js route groups (7 pages)

**Problem:** Users navigate to `/cashflow` but sidebar is at `/dashboard`, creating confusion about app structure

**Recommendation:** Consolidate all user pages under `/dashboard/*` or document the distinction clearly

#### Issue 3: Deep Nesting for Strategy Pages
```
/dashboard/properties/[id]/strategy    (3 levels deep)
/dashboard/loans/[id]/strategy         (3 levels deep)
/dashboard/investments/holdings/[id]/strategy (4 levels deep)
```

**Problem:** Users must navigate through multiple levels to access strategy features

**Recommendation:** Consider modal-based strategy views or flatten hierarchy

#### Issue 4: Portal Navigation References Non-Existent Pages
**Missing pages referenced in PortalLayoutClient.tsx (lines 52-63):**
- `/portal/tasks` (no page.tsx)
- `/portal/api-keys` (no page.tsx)
- `/portal/reports` (no page.tsx)
- `/portal/settings` (no page.tsx)

**Problem:** Users clicking these nav items will see 404 errors

**Recommendation:** Implement pages or remove from navigation

---

## 3. Duplicate Functionality Analysis

### Critical: formatCurrency (15+ Implementations)

A centralized `formatCurrency` function exists at `/lib/utils/formatters.ts` but is duplicated across **20+ files**:

| File | Lines |
|------|-------|
| `components/onboarding/wizard/steps/ReviewStep.tsx` | 27-35 |
| `components/onboarding/wizard/steps/AccountsStep.tsx` | - |
| `components/recurring/MatchConfirmationDialog.tsx` | 52-57 |
| `components/form/CurrencyInput.tsx` | 81-87 |
| `app/(dashboard)/recurring/page.tsx` | - |
| `app/(dashboard)/strategy/[id]/page.tsx` | - |
| `app/(dashboard)/cashflow/components/intelligence/*` | Multiple |
| `lib/reports/generators/index.ts` | - |
| `lib/reports/exporters/csv.ts` | - |

**Impact:**
- Inconsistent formatting across the app
- Maintenance burden (changes need 15+ updates)
- Potential display bugs from different implementations

**Solution:** Replace all local implementations with import from `lib/utils/formatters.ts`

### Critical: Frequency Multiplier Duplications (14+ Files)

A centralized utility exists at `/lib/utils/frequencies.ts` but the same logic is duplicated:

```typescript
// Duplicated in 14+ files:
const frequencyMultipliers = {
  WEEKLY: 52,
  FORTNIGHTLY: 26,
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUAL: 1,
};
```

**Affected files:**
- `/app/api/assets/route.ts` (lines 39-45)
- `/components/onboarding/steps/PropertyStep.tsx`
- `/components/onboarding/steps/ReviewStep.tsx`
- `/lib/cfo/riskRadar.ts`
- `/lib/cfo/scoreCalculator.ts`
- `/lib/recurring/expenseMatcher.ts`
- `/lib/tax-engine/income/salaryProcessor.ts`
- And 7+ more files

**Solution:** Use `toAnnual()` and `toMonthly()` from `lib/utils/frequencies.ts`

### High: Duplicate Onboarding Step Components

Two complete sets of onboarding step components exist:

**Set 1:** `/components/onboarding/steps/` (Simpler)
- ReviewStep.tsx (268 lines)
- PropertyStep.tsx (407 lines)
- ExpenseStep.tsx, IncomeStep.tsx, etc.

**Set 2:** `/components/onboarding/wizard/steps/` (More complex)
- ReviewStep.tsx (373 lines)
- PropertiesStep.tsx (600+ lines)
- AccountsStep.tsx (400+ lines)
- IncomeExpensesStep.tsx (700+ lines)

**Problem:** Both calculate net worth and display financial summaries but with different implementations

**Solution:** Consolidate to single set of onboarding components

### High: Ownership Validation (79+ Occurrences)

Every API endpoint duplicates entity ownership validation:

```typescript
// Pattern repeated 79+ times across API routes:
if (propertyId) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property || property.userId !== authReq.user!.userId) {
    return NextResponse.json({ error: 'Property not found or unauthorized' }, { status: 403 });
  }
}
```

**Solution:** Create middleware or utility function:
```typescript
// lib/api/ownership.ts
export async function validateOwnership<T>(
  prisma: PrismaClient,
  model: string,
  id: string,
  userId: string
): Promise<T | null>
```

### Medium: Similar Smart Actions Components

Two nearly identical components:
- `/app/(dashboard)/cashflow/components/SmartActions.tsx` (328 lines)
- `/app/(dashboard)/cashflow/components/intelligence/SmartActionsEnhanced.tsx` (294 lines)

**Solution:** Merge into single configurable component

### Medium: MIME Type Constants Duplication

Defined in two files:
- `/lib/documents/types.ts`
- `/lib/documents/constants.ts`

**Solution:** Use only `constants.ts` which has comprehensive implementation

---

## 4. Feature Overlap Analysis

### Data Entry Points for Same Data

| Data Type | Entry Points | Problem |
|-----------|--------------|---------|
| Income | Income entity, UnifiedTransaction, Bank import | 3 ways to enter same data |
| Expenses | Expense entity, RecurringPayment, Bank transactions | 3 ways to enter same data |
| Account balances | Manual entry, CSV import, Basiq connection | Potential conflicts |

**Recommendation:** Establish clear data flow hierarchy:
1. Bank import (primary source)
2. Manual entry (supplements)
3. Calculated values (derived)

### Strategy Generation Overlap

Multiple strategy systems that may recommend conflicting actions:
- `StrategyRecommendation` (AI-generated)
- `StrategyForecast` (forecasting engine)
- `CashflowStrategy` (cashflow optimizer)
- Debt planner strategies (Tax-Aware, Avalanche, Snowball)

**Recommendation:** Create unified strategy orchestrator that consolidates recommendations

### Settings Pages Fragmentation

| Location | Pages | Content |
|----------|-------|---------|
| `/dashboard/settings` | 8 sub-pages | User profile, security, billing, etc. |
| `/admin/settings` | 1 page | Admin settings |
| `/portal/settings` | 1 page (missing) | Portal settings |

**Recommendation:** Create consistent settings architecture across all sections

---

## 5. Incomplete Features & Placeholder Implementations

### Placeholder Implementations (Requiring Completion)

| Feature | Location | Status |
|---------|----------|--------|
| Medicare Levy Surcharge | Tax calculator | Returns 0, needs income verification |
| Daily interest calculation | Debt planner | Marked "placeholder for Phase 3" |
| Offset balance growth projection | Debt planner | Disabled, returns same value |
| OFX bank file parsing | Bank import | TODO comment in code |
| Portfolio CGT calculation | Portfolio API | Shows 0, needs implementation |
| Admin MFA verification | Admin auth | Logic incomplete |
| Email invitation sending | Portal invites | Commented as TODO |
| Real-time price updates | Investments | Field exists but no sync mechanism |
| Multi-currency support | Feature flag | Flagged as PREMIUM but not implemented |

### Stub Features to Evaluate

**Keep or Remove Decision Needed:**
1. Risk modeling recommendations (models exist but integration unclear)
2. Household profile calculations (structure exists, calculation logic missing)
3. Integration with accounting software (models exist, sync not visible)

---

## 6. Simplification Recommendations

### Priority 1: Code Consolidation (Week 1-2)

1. **Replace all formatCurrency duplicates** with centralized utility
   - Impact: ~20 files, ~200 lines removed
   - Risk: Low (behavioral equivalent)

2. **Replace all frequency multiplier duplicates** with centralized utility
   - Impact: ~14 files, ~100 lines removed
   - Risk: Low

3. **Create ownership validation middleware**
   - Impact: ~79 API routes, ~500 lines removed
   - Risk: Medium (need comprehensive testing)

### Priority 2: Navigation Simplification (Week 2-3)

1. **Remove `/signin` route** - Use `/login` only
2. **Move `/(dashboard)/*` pages** under `/dashboard/*`
3. **Implement or remove portal nav items** (tasks, api-keys, reports, settings)
4. **Flatten strategy page hierarchy** - Use modals instead of nested routes

### Priority 3: Feature Consolidation (Week 3-4)

1. **Merge onboarding step sets** into single implementation
2. **Merge Smart Actions components** into configurable component
3. **Consolidate MIME type constants** to single file
4. **Create unified strategy orchestrator**

### Priority 4: Clean Up Stubs (Week 4+)

1. **Complete or remove placeholder implementations**
2. **Document planned features** vs deprecated features
3. **Add feature flags** for incomplete features

---

## 7. Monetization Readiness Analysis

### Current Tier System

**Individual User Tiers (Implemented):**
| Tier | Est. Price | Key Features |
|------|------------|--------------|
| FREE | $0 | Basic tracking, manual entry |
| BASIC | ~$9.99/mo | Recurring detection, basic tax |
| PRO | ~$19.99/mo | AI insights, advanced cashflow, strategies |
| PREMIUM | ~$29.99/mo | Multi-currency*, advanced reports, priority support |

*Multi-currency flagged but not implemented

**B2B Organization Tiers (Implemented):**
| Tier | Clients | Staff | Features |
|------|---------|-------|----------|
| STARTER | 10 | 3 | Basic client management |
| PROFESSIONAL | 50 | - | + Custom branding |
| BUSINESS | 200 | - | + API access |
| ENTERPRISE | Unlimited | - | + White-label, SLA |

### Feature Flag System

Existing `GlobalFeatureFlag` model supports:
- Percentage-based rollouts
- Tier-based access control (`enabledForPlans[]`)
- Per-user/org overrides

### High-Value Features for Monetization

| Feature | Current State | Monetization Potential |
|---------|---------------|------------------------|
| AI Advisor | Implemented | **HIGH** - PRO/PREMIUM gate |
| Advanced Cashflow | Implemented | **HIGH** - PRO gate |
| Document OCR | Implemented | **HIGH** - PRO gate |
| Tax Planning | Implemented | **MEDIUM** - BASIC+ |
| Strategy Recommendations | Implemented | **HIGH** - PRO gate |
| Professional Reports | Implemented | **MEDIUM** - PRO gate |
| Debt Optimization | Implemented | **MEDIUM** - PRO gate |
| Multi-currency | Not implemented | **LOW** (needs dev work) |

### Monetization Infrastructure Gaps

1. **Payment Processing:** Stripe integration configured but may need completion
2. **Usage Metering:** No visible usage tracking for API limits
3. **Trial System:** No apparent free trial implementation
4. **Upgrade Prompts:** Limited in-app upgrade nudges
5. **Feature Gating UI:** Inconsistent "upgrade required" messaging

### Recommended Monetization Actions

1. **Implement clear feature gates** with upgrade prompts
2. **Add usage dashboards** showing limits vs usage
3. **Create compelling PRO tier** with AI + cashflow + strategies
4. **Implement free trial** (14 days) for PRO features
5. **Add B2B upsell prompts** for individual users with multiple accounts
6. **Complete Stripe integration** for self-service billing

---

## 8. User Experience Simplification Recommendations

### Reduce Cognitive Load

| Current State | Recommendation |
|---------------|----------------|
| 67 pages across 4 sections | Consolidate to 40-45 pages |
| 4 sidebar groups with 18 items | Reduce to 3 groups with 12 items |
| Multiple data entry methods | Single "Add" button with smart forms |
| Nested strategy pages | Modal-based strategy views |

### Suggested Simplified Navigation

```
Dashboard (home)
│
├── My Finances
│   ├── Net Worth Overview
│   ├── Accounts & Assets
│   ├── Loans & Debt
│   └── Transactions
│
├── Planning
│   ├── Cash Flow
│   ├── Tax Planning
│   ├── Debt Strategy
│   └── Goals (future)
│
├── Insights
│   ├── Financial Health
│   ├── AI Advisor
│   └── Reports
│
└── Settings
```

### Data Clarity Improvements

1. **Single source of truth** - Bank import primary, manual supplementary
2. **Clear data relationships** - Visual linking between accounts/loans/properties
3. **Unified transaction view** - All money movements in one place
4. **Consolidated recommendations** - Single "What to do next" section

---

## 9. Technical Debt Summary

### High Priority
- [ ] 15+ formatCurrency duplications
- [ ] 14+ frequency multiplier duplications
- [ ] 79+ ownership validation duplications
- [ ] 2 duplicate onboarding step sets
- [ ] 4 missing portal pages in navigation

### Medium Priority
- [ ] Split dashboard route groups causing confusion
- [ ] Duplicate `/login` and `/signin` routes
- [ ] 2 similar Smart Actions components
- [ ] MIME type constants in 2 files
- [ ] Inconsistent settings page structure

### Low Priority
- [ ] 10+ placeholder/stub implementations
- [ ] Generic API patterns could be abstracted
- [ ] Multiple dialog component variations

---

## 10. Action Plan

### Phase 1: Foundation Cleanup (Weeks 1-2)
- [ ] Consolidate utility functions (formatCurrency, frequencies)
- [ ] Create ownership validation middleware
- [ ] Fix portal navigation (implement or remove missing pages)
- [ ] Remove duplicate auth routes

### Phase 2: Navigation Simplification (Weeks 2-3)
- [ ] Consolidate dashboard route groups
- [ ] Flatten strategy page hierarchy
- [ ] Implement consistent settings structure
- [ ] Update sidebar navigation

### Phase 3: Feature Consolidation (Weeks 3-4)
- [ ] Merge onboarding component sets
- [ ] Merge Smart Actions components
- [ ] Create unified strategy orchestrator
- [ ] Clean up placeholder implementations

### Phase 4: Monetization Activation (Weeks 4-6)
- [ ] Implement feature gates with upgrade prompts
- [ ] Complete Stripe integration
- [ ] Add usage tracking and limits
- [ ] Implement free trial system
- [ ] Create B2B upsell flows

---

## Appendix A: File Location Reference

### Critical Files for Refactoring

| Purpose | File Path |
|---------|-----------|
| Centralized formatCurrency | `/lib/utils/formatters.ts` |
| Centralized frequencies | `/lib/utils/frequencies.ts` |
| Dashboard navigation | `/components/DashboardLayout.tsx` |
| Admin navigation | `/components/admin/layout/AdminSidebar.tsx` |
| Portal navigation | `/components/portal/layout/PortalSidebar.tsx` |
| User permissions | `/lib/auth/permissions.ts` |
| Admin permissions | `/lib/admin/permissions.ts` |
| Portal permissions | `/lib/portal/permissions.ts` |
| Feature flags | `GlobalFeatureFlag` model in schema |
| User tiers | `UserSubscription` model in schema |
| Org licenses | `OrganizationLicense` model in schema |

### Duplicate Component Locations

| Component | Location 1 | Location 2 |
|-----------|------------|------------|
| ReviewStep | `/components/onboarding/steps/` | `/components/onboarding/wizard/steps/` |
| PropertyStep | `/components/onboarding/steps/` | `/components/onboarding/wizard/steps/PropertiesStep.tsx` |
| SmartActions | `/app/(dashboard)/cashflow/components/` | `/app/(dashboard)/cashflow/components/intelligence/SmartActionsEnhanced.tsx` |

---

## Appendix B: Database Model Summary (76 Models)

### Core Financial (14)
User, Property, Loan, Account, Income, Expense, Transaction, Asset, InvestmentAccount, InvestmentHolding, InvestmentTransaction, UnifiedTransaction, RecurringPayment, CashflowForecast

### Tax & Planning (10)
TaxPosition, SuperannuationAccount, SuperContribution, DepreciationSchedule, CapitalGainEvent, DebtPlan, BudgetAnalysis, BudgetTarget, StrategyRecommendation, HouseholdProfile

### Documents (4)
Document, DocumentAnalysis, DocumentEntity, DocumentCategory

### B2B Portal (10)
Organization, OrganizationMember, OrganizationClient, OrganizationLicense, OrganizationAPIKey, ClientNote, ClientTask, OrganizationBranding, ClientConsent, OrganizationInvite

### Admin (6)
AdminUser, AdminAuditLog, ImpersonationSession, GlobalFeatureFlag, FeatureFlagOverride, BillingTransaction

### Auth & Security (12)
MFAMethod, PasskeyCredential, UserSession, OAuthAccount, LoginAttempt, EmailMFACode, AuditLog, MagicLink, AccountLockout, BackupCode, SMSMFACode, TOTPSecret

### Monetization (3)
UserSubscription, OrganizationLicense, BillingTransaction

---

*Report generated by Claude Code Audit - January 20, 2026*
