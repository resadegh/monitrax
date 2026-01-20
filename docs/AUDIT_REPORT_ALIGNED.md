# Monitrax Application Audit Report (Blueprint-Aligned)

**Date:** January 20, 2026
**Scope:** Application Flow, Simplicity, Duplication Analysis & Monetization Readiness
**Blueprint Reference:** Master Blueprint v2.3, Design Principles v3.0

---

## Executive Summary

This audit evaluates the Monitrax codebase against the specifications defined in the blueprint documents. The audit identifies areas where the implementation deviates from the architectural principles and provides recommendations for alignment.

### Remediation Progress

| Stage | Task | Status | Date |
|-------|------|--------|------|
| Stage 1 | formatCurrency deduplication | ✅ **COMPLETED** | Jan 20, 2026 |
| Stage 2 | Frequency multiplier deduplication | 🔲 Pending | - |
| Stage 3 | Ownership validation utility | 🔲 Pending | - |
| Stage 4 | Onboarding component consolidation | 🔲 Pending | - |
| Stage 5 | Route group consolidation | 🔲 Pending | - |
| Stage 6 | Monetization activation | 🔲 Pending | - |

### Blueprint Principles Under Review

| Principle | Blueprint Reference | Status |
|-----------|---------------------|--------|
| Zero Redundancy | 02_DESIGN_PRINCIPLES.md §2.3 | **Violations Found** |
| Never Duplicate Logic | 02_DESIGN_PRINCIPLES.md §5.1 | **Violations Found** |
| Canonical Everything | 02_DESIGN_PRINCIPLES.md §2.3 | **Partially Compliant** |
| Single Source of Truth | MASTER_BLUEPRINT.md §2 | **Violations Found** |
| GRDCS Compliance | 04_GRDCS_SPECIFICATION.md | **Compliant** |
| CMNF Navigation | 05_CROSS_MODULE_NAVIGATION.md | **Needs Improvement** |
| API Standards | 07_API_STANDARDS.md | **Partially Compliant** |

---

## 1. Blueprint Violation Analysis

### 1.1 "Never Duplicate Logic" Violations

**Blueprint Reference:** `02_DESIGN_PRINCIPLES.md` Section 5.1

> "If logic appears twice, it must become: a utility, an engine, or a shared component."

#### ~~Critical Violation: formatCurrency (15+ Duplications)~~ ✅ RESOLVED

> **Status:** Resolved on January 20, 2026 (Stage 1 Complete)
> **Commits:** `571e3bd`, `aa1f792`, `d405a62`
> **Files Fixed:** 26 files now use centralized `formatCurrency`

~~A centralized `formatCurrency` utility exists at `/lib/utils/formatters.ts` as designed, but **15+ files** contain local implementations instead of using the centralized version.~~

**Centralized Utility (Correct Implementation):**
```typescript
// lib/utils/formatters.ts - Lines 16-45
export function formatCurrency(
  amount: number,
  options?: CurrencyFormatOptions
): string
```

**Violating Files:**
| File | Blueprint Violation |
|------|---------------------|
| `components/onboarding/wizard/steps/ReviewStep.tsx` | Local implementation |
| `components/onboarding/wizard/steps/AccountsStep.tsx` | Local implementation |
| `components/onboarding/wizard/steps/IncomeExpensesStep.tsx` | Local implementation |
| `components/onboarding/wizard/steps/InvestmentsStep.tsx` | Local implementation |
| `components/onboarding/wizard/steps/AssetsStep.tsx` | Local implementation |
| `components/recurring/MatchConfirmationDialog.tsx` | Local implementation |
| `components/form/CurrencyInput.tsx` | Local implementation |
| `app/(dashboard)/recurring/page.tsx` | Local implementation |
| `app/(dashboard)/strategy/[id]/page.tsx` | Local implementation |
| `app/(dashboard)/transactions/page.tsx` | Local implementation |
| `app/(dashboard)/cashflow/components/intelligence/*` | Multiple local implementations |
| `lib/reports/generators/index.ts` | Local implementation |
| `lib/reports/exporters/csv.ts` | Local implementation |
| `lib/reports/exporters/xlsx.ts` | Local implementation |

**Impact:** Inconsistent formatting, maintenance burden, potential bugs
**Severity:** Critical
**Remediation:** Replace all local implementations with import from `lib/utils/formatters.ts`

---

#### Critical Violation: Frequency Multipliers (14+ Duplications)

**Blueprint Reference:** `03_DATA_MODEL.md` Section 4 defines the canonical Frequency enum and conversion rules.

A centralized utility exists at `/lib/utils/frequencies.ts` but the multiplier logic is duplicated:

**Centralized Utility (Correct Implementation):**
```typescript
// lib/utils/frequencies.ts
export function toAnnual(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case 'WEEKLY': return amount * 52;
    case 'FORTNIGHTLY': return amount * 26;
    case 'MONTHLY': return amount * 12;
    case 'QUARTERLY': return amount * 4;
    case 'ANNUAL': return amount;
  }
}
```

**Violating Files:**
| File | Lines | Violation |
|------|-------|-----------|
| `app/api/assets/route.ts` | 39-45 | Inline frequencyMultipliers object |
| `app/api/assets/[id]/route.ts` | - | Inline multipliers |
| `lib/cfo/riskRadar.ts` | - | Inline multipliers |
| `lib/cfo/scoreCalculator.ts` | - | Inline multipliers |
| `lib/cfo/intelligenceEngine.ts` | - | Inline multipliers |
| `lib/recurring/expenseMatcher.ts` | - | Inline multipliers |
| `lib/bank/recurringMatcher.ts` | - | Inline multipliers |
| `lib/tax-engine/income/salaryProcessor.ts` | - | Inline multipliers |
| `lib/tax-engine/position/taxPositionCalculator.ts` | - | Inline multipliers |
| `lib/cashflow/incomeNormalizer.ts` | - | Inline multipliers |
| `components/onboarding/steps/PropertyStep.tsx` | - | Inline multipliers |
| `components/onboarding/steps/ReviewStep.tsx` | - | Inline multipliers |
| `components/onboarding/steps/IncomeStep.tsx` | - | Inline multipliers |
| `components/onboarding/wizard/types.ts` | - | Inline multipliers |

**Impact:** Inconsistent calculations, risk of errors in financial computations
**Severity:** Critical
**Remediation:** Replace all inline multipliers with `toAnnual()`, `toMonthly()` from `lib/utils/frequencies.ts`

---

### 1.2 "Single Source of Truth" Violations

**Blueprint Reference:** `MASTER_BLUEPRINT.md` Section 2

> "Single Source of Truth — Every dollar appears once only"

#### Violation: Duplicate Onboarding Step Components

**Two complete sets** of onboarding components exist with overlapping functionality:

| Component | Set 1 (Simple) | Set 2 (Wizard) |
|-----------|----------------|----------------|
| Review | `/components/onboarding/steps/ReviewStep.tsx` (268 lines) | `/components/onboarding/wizard/steps/ReviewStep.tsx` (373 lines) |
| Property | `/components/onboarding/steps/PropertyStep.tsx` (407 lines) | `/components/onboarding/wizard/steps/PropertiesStep.tsx` (600+ lines) |
| Income | `/components/onboarding/steps/IncomeStep.tsx` | `/components/onboarding/wizard/steps/IncomeExpensesStep.tsx` (700+ lines) |
| Accounts | `/components/onboarding/steps/BankAccountStep.tsx` | `/components/onboarding/wizard/steps/AccountsStep.tsx` (400+ lines) |

**Both calculate:**
- Net worth summaries
- Financial overview displays
- Data validation logic

**Impact:** Conflicting behavior, double maintenance, user confusion
**Severity:** High
**Remediation:** Consolidate to single component set with configuration options

---

#### Violation: Duplicate Smart Actions Components

| Component | Location | Lines |
|-----------|----------|-------|
| SmartActions | `/app/(dashboard)/cashflow/components/SmartActions.tsx` | 328 |
| SmartActionsEnhanced | `/app/(dashboard)/cashflow/components/intelligence/SmartActionsEnhanced.tsx` | 294 |

Both display actionable recommendations with different implementations.

**Remediation:** Merge into single configurable component per Blueprint §2.3

---

### 1.3 API Standards Violations

**Blueprint Reference:** `07_API_STANDARDS.md`

#### Violation: Ownership Validation Pattern (79+ Duplications)

**Blueprint Requirement:** Section 2.4 - "Backend Is The Source of Truth" with centralized validation.

**Current Pattern (Duplicated 79+ times):**
```typescript
// Pattern repeated across all API routes:
if (propertyId) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property || property.userId !== authReq.user!.userId) {
    return NextResponse.json({ error: 'Property not found or unauthorized' }, { status: 403 });
  }
}
```

**Should Be (Per Blueprint §5):**
```typescript
// lib/api/ownership.ts
export async function validateOwnership<T>(
  prisma: PrismaClient,
  model: string,
  id: string,
  userId: string
): Promise<T | null>
```

**Affected API Routes:**
- All CRUD endpoints for: properties, loans, accounts, income, expenses, assets, investments
- Total: 79+ instances

**Remediation:** Create centralized ownership validation middleware

---

### 1.4 CMNF Navigation Compliance

**Blueprint Reference:** `05_CROSS_MODULE_NAVIGATION.md`

#### Issue: Split Dashboard Route Groups

**Blueprint Requirement:** Section 7 - RouteMap must use canonical URL patterns.

**Current State:**
```
/dashboard/*           → 22 pages (standard routing)
/(dashboard)/*         → 7 pages (route group)
```

**Issue:** Users navigate to `/cashflow` or `/recurring` but sidebar is at `/dashboard/*`, breaking the canonical HREF pattern defined in GRDCS.

**Blueprint Violation:** Section 3 - "Navigation MUST Use CMNF" with predictable paths.

**Remediation:** Consolidate to single route structure (`/dashboard/*`)

---

#### Issue: Missing Portal Navigation Pages

**Blueprint Reference:** `PHASE_32_ENTERPRISE_PORTAL.md` and `PHASE_33_ADMIN_PORTAL.md`

**Navigation references non-existent pages:**
| Referenced in Navigation | Page Status |
|-------------------------|-------------|
| `/portal/tasks` | **Missing** |
| `/portal/api-keys` | **Missing** |
| `/portal/reports` | **Missing** |
| `/portal/settings` | **Missing** |

**Impact:** 404 errors when users click navigation items
**Remediation:** Implement pages or remove from navigation

---

## 2. Blueprint Compliance Analysis

### 2.1 GRDCS Compliance ✅

**Blueprint Reference:** `04_GRDCS_SPECIFICATION.md`

The GRDCS implementation is **compliant** with the blueprint:

| Requirement | Status |
|-------------|--------|
| Global Entity Graph | ✅ Implemented |
| Canonical HREF Standard | ✅ `/dashboard/{module}/{id}` pattern |
| Relationship Rules | ✅ Property→Loan, Loan→Account, etc. |
| LinkedDataPanel | ✅ Implemented |
| Linkage Health | ✅ Implemented |

---

### 2.2 Personal CFO Engine Compliance ✅

**Blueprint Reference:** `PHASE_17_PERSONAL_CFO_ENGINE.md`

| Component | Blueprint Spec | Implementation |
|-----------|---------------|----------------|
| CFO Score (0-100) | ✅ Specified | ✅ `lib/cfo/scoreCalculator.ts` |
| Risk Radar | ✅ 10+ risk types | ✅ `lib/cfo/riskRadar.ts` |
| Action Engine | ✅ 4 priority levels | ✅ `lib/cfo/actionEngine.ts` |
| Dashboard UI | ✅ Specified | ✅ `app/dashboard/cfo/page.tsx` |

**Note:** Some planned features remain unimplemented (Workflow Templates, Push Notifications, Financial Coach Mode) - these are documented as "Future Enhancements" in the blueprint.

---

### 2.3 Admin Portal Compliance ✅

**Blueprint Reference:** `PHASE_33_ADMIN_PORTAL.md`

| Component | Status |
|-----------|--------|
| Database Models | ✅ AdminUser, GlobalFeatureFlag, UserSubscription, etc. |
| Authentication | ✅ Separate admin auth system |
| Role-Based Access | ✅ SUPER_ADMIN, BILLING_ADMIN, SUPPORT_ADMIN, VIEWER |
| Feature Flags | ✅ GlobalFeatureFlag with overrides |
| Monetization Tiers | ✅ UserTier (FREE/BASIC/PRO/PREMIUM) |
| Organization Licenses | ✅ OrganizationLicense with tier support |

---

### 2.4 Monetization Infrastructure Status

**Blueprint Reference:** `PHASE_33_ADMIN_PORTAL.md` Database Models section

| Model | Implemented | Notes |
|-------|-------------|-------|
| `UserSubscription` | ✅ | Tiers: FREE, BASIC, PRO, PREMIUM |
| `OrganizationLicense` | ✅ | Tiers: STARTER, PROFESSIONAL, BUSINESS, ENTERPRISE |
| `GlobalFeatureFlag` | ✅ | With percentage rollout, tier-based access |
| `FeatureFlagOverride` | ✅ | Per-user/org overrides |
| `BillingTransaction` | ✅ | Revenue tracking |

**Missing for Full Monetization:**
| Gap | Blueprint Reference | Status |
|-----|---------------------|--------|
| Stripe Webhook Integration | Phase 33 §API | Partial |
| Usage Metering | Phase 33 §Billing | Not visible |
| Free Trial System | Phase 33 §Feature Specs | Not implemented |
| In-app Upgrade Prompts | Phase 33 §UX | Limited |

---

## 3. Flow & Navigation Analysis

### 3.1 Current Navigation Structure

Per `05_CROSS_MODULE_NAVIGATION.md`, the navigation should support deep drill-down:

```
property → loan → expense → transaction → account → holding → income → property
```

**Current Implementation Status:**

| Flow | Implemented | Issues |
|------|-------------|--------|
| Property → Loan | ✅ | - |
| Loan → Expense | ✅ | - |
| Account → Transaction | ✅ | - |
| Investment → Holding | ✅ | - |
| Cross-module breadcrumbs | ⚠️ | Inconsistent between route groups |

### 3.2 Page Count Analysis

**Blueprint Principle:** "Simplicity Over Complexity" (MASTER_BLUEPRINT.md §2)

| Section | Pages | Complexity |
|---------|-------|------------|
| `/dashboard/*` | 22 | High |
| `/(dashboard)/*` | 7 | Medium |
| `/admin/*` | 11 | Medium |
| `/portal/*` | 10+ | Medium |
| Auth routes | 7 | Low |
| **Total** | **57+** | - |

**Recommendation:** Reduce cognitive load by:
1. Consolidating route groups
2. Using modal-based strategy views instead of nested routes
3. Implementing consistent settings architecture

---

## 4. Recommended Remediation Plan

### Phase 1: Critical Blueprint Violations (Foundation)

| Task | Blueprint Reference | Files Affected | Priority | Status |
|------|---------------------|----------------|----------|--------|
| ~~Replace formatCurrency duplicates~~ | ~~02_DESIGN_PRINCIPLES §5.1~~ | ~~15+ files~~ | ~~Critical~~ | ✅ **DONE** |
| Replace frequency multipliers | 03_DATA_MODEL §4 | 14+ files | **Critical** | 🔲 Next |
| Create ownership validation utility | 07_API_STANDARDS §5 | 79+ API routes | **High** | 🔲 Pending |

### Phase 2: Single Source of Truth (Consolidation)

| Task | Blueprint Reference | Impact |
|------|---------------------|--------|
| Merge onboarding step sets | 02_DESIGN_PRINCIPLES §2.3 | ~2000 lines reduced |
| Merge Smart Actions components | 02_DESIGN_PRINCIPLES §5.1 | ~300 lines reduced |
| Consolidate MIME type constants | 02_DESIGN_PRINCIPLES §5.1 | Maintenance simplified |

### Phase 3: Navigation Alignment (CMNF)

| Task | Blueprint Reference | Impact |
|------|---------------------|--------|
| Consolidate dashboard route groups | 05_CROSS_MODULE_NAVIGATION §7 | Consistent URLs |
| Remove duplicate auth routes | 05_CROSS_MODULE_NAVIGATION §3 | Simplified login flow |
| Implement missing portal pages | PHASE_32 | No 404 errors |

### Phase 4: Monetization Activation

| Task | Blueprint Reference | Impact |
|------|---------------------|--------|
| Implement feature gates with prompts | PHASE_33 §Feature Flags | Revenue enablement |
| Complete Stripe webhook integration | PHASE_33 §Billing | Automated billing |
| Add free trial system | PHASE_33 §Feature Specs | User acquisition |

---

## 5. Feature Gating Recommendations

**Blueprint Reference:** `PHASE_33_ADMIN_PORTAL.md` User Tier definitions

### Recommended Tier Assignment

| Feature | FREE | BASIC | PRO | PREMIUM | Blueprint Justification |
|---------|:----:|:-----:|:---:|:-------:|-------------------------|
| Basic Portfolio Tracking | ✅ | ✅ | ✅ | ✅ | Core value proposition |
| Manual Transaction Entry | ✅ | ✅ | ✅ | ✅ | Core value proposition |
| Bank Connection (Basiq) | ❌ | ✅ | ✅ | ✅ | Phase 24 premium feature |
| Recurring Detection | ❌ | ✅ | ✅ | ✅ | Phase 13 intelligence |
| Basic Tax Calculator | ❌ | ✅ | ✅ | ✅ | Phase 20 tax engine |
| AI Advisor Chat | ❌ | ❌ | ✅ | ✅ | Phase 27 Gemini AI |
| Advanced Cashflow | ❌ | ❌ | ✅ | ✅ | Phase 14/31 cashflow |
| Strategy Recommendations | ❌ | ❌ | ✅ | ✅ | Phase 11 AI strategy |
| CFO Score & Risk Radar | ❌ | ❌ | ✅ | ✅ | Phase 17 Personal CFO |
| Document OCR | ❌ | ❌ | ✅ | ✅ | Phase 26 Document Intelligence |
| Professional Reports | ❌ | ❌ | ✅ | ✅ | Phase 16 Reporting |
| Multi-currency* | ❌ | ❌ | ❌ | ✅ | Phase 20 planned |
| Priority Support | ❌ | ❌ | ❌ | ✅ | Enterprise feature |

*Multi-currency is flagged in GlobalFeatureFlag but not fully implemented

---

## 6. Incomplete Features (Blueprint vs Implementation)

### Features Marked Complete in Blueprint But Incomplete in Code

| Feature | Blueprint Status | Implementation Status | Gap |
|---------|------------------|----------------------|-----|
| Medicare Levy Surcharge | Phase 20 planned | Returns 0 | Placeholder |
| Daily interest calculation | Phase 3 | Marked "Phase 3" | TODO comment |
| Offset balance projection | Phase 14 | Disabled | Returns same value |
| OFX bank file parsing | Phase 18/24 | TODO comment | Not implemented |
| Portfolio CGT calculation | Phase 23 | Shows 0 | Needs implementation |

### Features in Blueprint But Status Unclear

| Feature | Blueprint | Status Needed |
|---------|-----------|---------------|
| Mobile Companion App | Phase 15 | Planned (not started) |
| Cloud Storage Integration | Phase 19B | Planned (not started) |
| Monte Carlo Forecasting | Long-term vision | Not started |
| Retirement Modelling | Long-term vision | Not started |

---

## 7. Testing Coverage for Blueprint Compliance

### Current Test Coverage

| Test Suite | Tests | Coverage Area |
|------------|-------|---------------|
| Financial Calculations | 40 | Tax, depreciation, investment math |
| Formatters Utility | 50 | formatCurrency, percentages, dates |
| Frequencies Utility | 42 | Frequency conversions |
| Regression (DB required) | 50+ | API golden baselines |

### Recommended Additional Tests

| Test Area | Blueprint Reference | Purpose |
|-----------|---------------------|---------|
| GRDCS Link Validation | 04_GRDCS_SPECIFICATION | Ensure all relationships are bidirectional |
| CMNF Navigation | 05_CROSS_MODULE_NAVIGATION | Test state preservation |
| Tier Feature Access | PHASE_33 | Verify feature gates by tier |
| Ownership Validation | 07_API_STANDARDS | Test authorization consistency |

---

## 8. Summary of Findings

### Critical Issues (Blueprint Violations)

| Issue | Count | Blueprint Principle Violated | Status |
|-------|-------|------------------------------|--------|
| ~~formatCurrency duplications~~ | ~~15+~~ | ~~"Never Duplicate Logic"~~ | ✅ **RESOLVED** |
| Frequency multiplier duplications | 14+ | "Never Duplicate Logic" | 🔲 Stage 2 |
| Ownership validation duplications | 79+ | API Standards centralization | 🔲 Stage 3 |
| Duplicate onboarding components | 2 sets | "Single Source of Truth" | 🔲 Stage 4 |

### Compliance Status

| Area | Status | Action Required |
|------|--------|-----------------|
| GRDCS | ✅ Compliant | None |
| Personal CFO Engine | ✅ Compliant | Future enhancements only |
| Admin Portal | ✅ Compliant | None |
| Utility Centralization | ❌ Non-compliant | Critical refactoring needed |
| API Patterns | ⚠️ Partial | Ownership validation utility needed |
| Navigation (CMNF) | ⚠️ Partial | Route consolidation needed |

### Estimated Effort to Full Compliance

| Phase | Tasks | Estimated Lines Changed |
|-------|-------|-------------------------|
| Phase 1 (Utilities) | Replace duplicates | ~500 lines |
| Phase 2 (Consolidation) | Merge components | ~2000 lines reduced |
| Phase 3 (Navigation) | Route restructure | ~200 lines |
| Phase 4 (Monetization) | Feature gates | ~300 lines |

---

## Appendix A: Blueprint Document Index

| Document | Purpose | Key Sections Referenced |
|----------|---------|-------------------------|
| `MASTER_BLUEPRINT.md` | Authoritative system reference | §2 Core Principles, §5 Modules |
| `00_OVERVIEW.md` | System overview | §3 Guiding Principles |
| `01_ARCHITECTURE_OVERVIEW.md` | Technical architecture | §3 System Layers |
| `02_DESIGN_PRINCIPLES.md` | Design philosophy | §5.1 Never Duplicate Logic |
| `03_DATA_MODEL.md` | Entity specifications | §4 Frequency Enum |
| `04_GRDCS_SPECIFICATION.md` | Relationship system | §3 Core Rules |
| `05_CROSS_MODULE_NAVIGATION.md` | Navigation framework | §7 RouteMap |
| `06_UI_UX_FOUNDATION.md` | UI standards | §4 Global Components |
| `07_API_STANDARDS.md` | API contracts | §5 Schema Validation |
| `PHASE_17_PERSONAL_CFO_ENGINE.md` | CFO feature spec | §17.11 Implementation Status |
| `PHASE_32_ENTERPRISE_PORTAL.md` | B2B portal spec | Architecture patterns |
| `PHASE_33_ADMIN_PORTAL.md` | Admin portal spec | Database Models, Tiers |

---

## Appendix B: File Locations for Remediation

### Centralized Utilities (Use These)

| Utility | Path | Functions |
|---------|------|-----------|
| Currency Formatting | `lib/utils/formatters.ts` | `formatCurrency`, `formatPercentage` |
| Frequency Conversion | `lib/utils/frequencies.ts` | `toAnnual`, `toMonthly`, `periodsPerYear` |
| Permissions | `lib/auth/permissions.ts` | User permission checks |
| Admin Permissions | `lib/admin/permissions.ts` | Admin RBAC |
| Portal Permissions | `lib/portal/permissions.ts` | Organization permissions |

### Files Requiring Refactoring

See Section 4 "Recommended Remediation Plan" for complete list.

---

*Report generated by Claude Code Audit - January 20, 2026*
*Aligned with Monitrax Blueprint v2.3 and Design Principles v3.0*
