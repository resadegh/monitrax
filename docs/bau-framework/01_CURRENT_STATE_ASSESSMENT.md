# 01 - Current State Assessment

**Date:** 2026-04-10 | **Version:** 1.0 | **Status:** DRAFT

---

## 1. System Architecture Overview

### 1.1 Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Frontend** | Next.js (App Router) | 15.2.6 | React 19, TypeScript |
| **UI Framework** | Tailwind CSS + shadcn/ui | Latest | Radix UI primitives (11 packages) |
| **Database** | PostgreSQL | 15 | Via Cloud SQL |
| **ORM** | Prisma | 5.22.0 | 88+ models, 74+ enums |
| **Auth** | GCP Identity Platform / Firebase Auth | Current | Migrated from custom JWT (Feb 2026) |
| **Hosting** | Vercel | Current | Preview + Production deployments |
| **Cloud** | Google Cloud Platform | Current | Cloud SQL, Storage, KMS, Armor, Scheduler |
| **Open Banking** | Basiq API | Current | CDR data access |
| **AI** | Google Gemini + OpenAI | Current | Strategy engine, document intelligence |
| **Email** | Resend | Current | Transactional emails |
| **SMS** | Twilio | Current | MFA codes |
| **Charts** | Recharts | 2.x | Dashboard visualizations |

### 1.2 Core Architecture Patterns

**Source:** Verified against `docs/blueprint/01_ARCHITECTURE_OVERVIEW.md` and actual codebase.

1. **Master Financial Service (Single Source of Truth)**
   - File: `lib/services/masterFinancialService.ts` (1,348 lines)
   - Function: `getMasterFinancialSnapshot(userId)` aggregates ALL financial data
   - API: `/api/master-snapshot` - single endpoint for dashboard data
   - Pattern: Parallel DB queries via `Promise.all()`, pure calculation engines

2. **GRDCS (Global Relational Data Consistency Specification)**
   - File: `lib/grdcs.ts`
   - Purpose: Canonical entity relationships, navigation, cross-module linking
   - Pattern: Every entity has `{id, type, name, href, metadata, links[]}`

3. **Guard-Based Auth (RBAC)**
   - File: `lib/auth/guards.ts` (485 lines)
   - Pattern: `withPermission(permission, handler)` wraps all API routes
   - Roles: OWNER, ADMIN, CONTRIBUTOR, VIEWER (50+ granular permissions)

4. **CDR Compliance Layer**
   - Files: `lib/security/cdrAuditCompliance.ts`, `lib/auth/guards.ts`
   - Pattern: Audit logging on every request, CDR data sanitization, consent checks

5. **Financial Calculation Engines (Pure Functions)**
   - Location: `lib/calculations/`, `lib/health/`, `lib/tax-engine/`, `lib/strategy/`
   - Pattern: Accept raw data, return structured output, never mutate state or fetch data

### 1.3 Module Inventory

**Dashboard Modules (17 verified):**

| Module | API Routes | Components | Status |
|--------|-----------|------------|--------|
| Properties | CRUD + calculations | Dialog, table, metrics | Complete |
| Loans | CRUD + amortization | Dialog, table, linked data | Complete |
| Accounts | CRUD + balance tracking | Dialog, table, Basiq link | Complete |
| Income | CRUD + tax integration | Dialog, table, categories | Complete |
| Expenses | CRUD + recurring detection | Dialog, table, grouping | Complete |
| Investments | CRUD + portfolio analytics | Accounts, holdings, transactions | Complete |
| Transactions | Import + categorization | Filter, search, bulk actions | Partial |
| Cashflow | Forecast + optimization | Charts, timeline, stress test | Complete |
| Health | 7-category scoring | Mini widget, dashboard | Complete |
| Strategy | AI recommendations | Dashboard, detail, forecast | Complete |
| Tax | Position + PAYG | Summary tile, integration | Complete |
| CFO | Score + risk radar | Dashboard, decisions | Complete |
| Budget | Analysis engine | Integration with expenses | Partial |
| Documents | Upload + AI analysis | Upload, viewer, categories | Partial |
| Recurring | Detection + matching | Matcher UI | Complete |
| Reports | Export engine | 6 report types | Planned |
| Admin Portal | Full admin system | 12 admin pages | Complete |

### 1.4 Database Schema Assessment

**Source:** Verified against `prisma/schema.prisma` (3,987 lines).

**Model Categories:**
- **User & Auth:** User, OAuthAccount, UserSession, MFAMethod, PasskeyCredential, EmailMFACode, LoginAttempt, MagicLink
- **Financial Core:** Account, Loan, Property, Income, Expense, Asset, Transaction, UnifiedTransaction
- **Investments:** InvestmentAccount, InvestmentHolding, InvestmentTransaction, CapitalGainEvent, PurchaseLot
- **Organization:** Organization, OrganizationMember
- **Compliance:** AuditLog, AdminAuditLog, BasiqConnection
- **Supporting:** Category, UserPreference, DebtPlan, RecurringPayment, Budget, BudgetPeriod
- **AI/ML:** AICategorizationLearning, TransactionReviewQueue, ImportBatch
- **Strategy:** StrategyRecommendation, StrategySession, StrategyForecast
- **Depreciation:** DepreciationSchedule

**Schema Quality: 8.5/10**
- Well-defined relationships with cascade deletes
- Dual balance tracking (Manual vs Basiq) reflects real-world needs
- Comprehensive enum types for Australian financial context
- Proper indexing on userId fields

**Schema Issues (Verified):**
1. Legacy `Transaction` model coexists with `UnifiedTransaction` - migration incomplete
2. No explicit `CDRConsent` table - consent inferred from `BasiqConnection` existence
3. `Budget` and `BudgetPeriod` tables exist but are underutilized in calculations
4. No soft-delete fields on any model (hard deletes only)

---

## 2. Development Phase Status

**Source:** Verified against all `PHASE_*.md` files in `docs/blueprint/`.

| Phase | Name | Status | Completion |
|-------|------|--------|-----------|
| 01 | Foundations | Complete | 85% |
| 02 | Schema & Engine Core | Complete | 95% |
| 03 | Financial Engines | Complete | 95% |
| 04 | Insights Engine V2 | Complete | 100% |
| 05 | Backend Integration & Security | Complete | 100% (GCP migration) |
| 06 | UI Core Components | Complete | 85% |
| 07 | Dashboard Rebuild | Complete | 90% |
| 08 | Global Data Consistency (GRDCS) | Complete | 85% |
| 09 | Global Nav, Health & Insights | Complete | 95% |
| 10 | Auth, Security, Authorization | Complete | 100% (GCP Identity) |
| 11 | AI Strategy Engine | Complete | 100% (7 stages) |
| 12 | Financial Health Engine | Complete | 100% |
| 13 | Transactional Intelligence | Partial | ~70% |
| 14 | Cashflow Optimization Engine | Complete | 100% |
| 15 | Mobile Companion App | Planned | 0% |
| 16 | Reporting & Integrations Suite | Planned | 0% |
| 17 | Personal CFO Engine | Complete | 100% (4 decision modules) |
| 18 | Bank Transactions | Partial | 60% |
| 19 | Document Management | Partial | 50% |
| 20 | Australian Tax Intelligence | Partial | 70% |
| 21-35 | Various (Enterprise, CDR, etc.) | Various | Various |

---

## 3. Operational Documentation Maturity

### 3.1 Existing Documentation Assessment

| Area | Files | Quality | Completeness |
|------|-------|---------|-------------|
| **Architecture** (operational/) | 3 files | Excellent | 95% |
| **Database** (operational/) | 3 files | Excellent | 95% |
| **Security** (operational/) | 3 files | Excellent | 95% |
| **Deployment** (operational/) | 3 files | Excellent | 95% |
| **Runbooks** (operational/) | 3 files | Good | 60% |
| **Policy** (policy/) | 5 files | Excellent | 90% |
| **Blueprint** (blueprint/) | 50+ files | Good | 80% |
| **Support Packs** (supportpack/) | 2 files | Poor | 15% |

### 3.2 What's Well-Documented
- GCP Cloud SQL operations (backups, monitoring, scaling)
- Vercel deployment procedures (change transport, rollback)
- Database migration safety (prisma db push banned, legacy table protection)
- CDR data classification and consent lifecycle
- RBAC and permission model
- Authentication flows (6 methods documented)
- Environment separation strategy

### 3.3 What's Poorly Documented or Missing
- **Basiq integration operations** - No dedicated runbook
- **Performance tuning** - No procedures for query optimization, caching
- **Secrets management** - Minimal coverage of GCP Secret Manager operations
- **Extended incident scenarios** - Only 5 of 15+ possible scenarios covered
- **Financial calculation validation** - No reconciliation/verification procedures
- **Capacity planning** - No scaling thresholds or growth projections
- **On-call procedures** - No on-call rotation or after-hours response
- **SLA definitions** - No formal SLAs for system availability or response times
- **Change advisory board** - No CAB process for production changes
- **Problem management** - No root cause analysis procedures

---

## 4. CDR Compliance Maturity

**Source:** Verified against `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md`, `docs/operational/security/03_CDR_COMPLIANCE.md`, `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md`, and actual code.

### 4.1 What's Implemented
- Audit logging with CDR data sanitization (54+ fields redacted)
- RBAC with CDR-specific permissions (`cdr_data.read/write/delete`)
- MFA enforcement guard (`withMFARequired`)
- Active consent verification guard (`withActiveConsent`)
- GCP Identity Platform for authentication
- Environment separation (real CDR data in production only)
- CDR data retention schedule documented

### 4.2 What's Missing for CDR Accreditation
1. **Explicit consent tracking** - No `CDRConsent` table; consent inferred from Basiq connection
2. **Automated consent expiry** - Cloud Scheduler job documented but implementation not verified
3. **Consent withdrawal flow** - UI/API for user-initiated consent revocation incomplete
4. **CDR data deletion automation** - Hard-delete procedures documented but not automated
5. **Anomaly detection production deployment** - Code exists but not deployed as scheduled job
6. **Cloud Armor WAF** - Documented as P0 requirement but deployment not verified
7. **Security Command Center** - P0 requirement, status unknown
8. **Cloud KMS (CMEK)** - P1 requirement for CDR data at rest encryption
9. **Cloud DLP** - P2 requirement for PII detection/redaction
10. **Quarterly compliance audits** - No automated audit procedures

---

## 5. Code Quality Assessment

### 5.1 Strengths
- Consistent API response format (`{success, data, error, meta}`)
- Pure financial calculation engines (no side effects)
- Strong TypeScript typing with Prisma-generated types
- Comprehensive Zod validation schemas
- Proper error boundaries and auth guards

### 5.2 Issues (Verified Against Code)

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| Legacy `withAuth()` still exported | Medium | `lib/auth/guards.ts` | Developers may bypass RBAC |
| No caching on financial snapshot | High | `lib/services/masterFinancialService.ts` | Performance degradation at scale |
| Hard-coded 2024-25 tax brackets | Medium | `lib/services/masterFinancialService.ts` | Must manually update each tax year |
| CDR sanitizer doesn't recurse arrays | Medium | `lib/security/cdrAuditCompliance.ts` | CDR data could leak in nested arrays |
| Dual transaction models | Medium | `prisma/schema.prisma` | Query confusion, data inconsistency |
| Anomaly detection thresholds hard-coded | Low | `lib/security/cdrAuditCompliance.ts` | Cannot tune without code change |
| Fire-and-forget audit logging | Low | Multiple files | Logs silently dropped under load |
| No graceful partial failure | Medium | `lib/services/masterFinancialService.ts` | Entire snapshot fails if one query fails |

---

## 6. Infrastructure & Deployment Assessment

### 6.1 Current Infrastructure
- **Frontend:** Vercel (auto-deploy from GitHub, preview per PR)
- **Database:** GCP Cloud SQL PostgreSQL 15 (PROD + DEV instances)
- **Auth:** GCP Identity Platform / Firebase Auth
- **Storage:** GCP Cloud Storage (documents)
- **Scheduling:** GCP Cloud Scheduler (CDR consent checks)
- **Encryption:** GCP Cloud KMS (planned - CMEK for CDR data)
- **WAF:** GCP Cloud Armor (planned)
- **Monitoring:** GCP Cloud Monitoring + Cloud Logging

### 6.2 Deployment Pipeline
1. Developer creates feature branch
2. Pushes to GitHub
3. Vercel creates preview deployment
4. PR review and merge to `main`
5. Vercel auto-deploys to production
6. Database migrations run manually (`npx prisma migrate deploy`)

### 6.3 Infrastructure Gaps
- No staging environment (only PROD and DEV)
- No automated integration tests in CI/CD
- No canary/blue-green deployment strategy
- No automated database migration in pipeline
- No load testing infrastructure
- No CDN configuration documented

---

## 7. Maturity Summary

### ITIL Maturity Model Assessment

| Process Area | Level | Description |
|-------------|-------|-------------|
| **Incident Management** | Level 2 - Repeatable | Basic runbooks exist, ad-hoc escalation |
| **Problem Management** | Level 1 - Initial | No formal RCA process |
| **Change Management** | Level 3 - Defined | PR-based workflow, documented procedures |
| **Service Level Management** | Level 1 - Initial | No formal SLAs defined |
| **Capacity Management** | Level 1 - Initial | No capacity planning |
| **Availability Management** | Level 2 - Repeatable | Health checks exist, basic monitoring |
| **IT Service Continuity** | Level 2 - Repeatable | Backup procedures documented, no DR drills |
| **Information Security** | Level 3 - Defined | CDR compliance framework, audit logging |
| **Configuration Management** | Level 2 - Repeatable | Infrastructure as docs, some IaC |
| **Release Management** | Level 3 - Defined | Git workflow, Vercel pipeline |

### Overall Maturity: **Level 2.3 / 5 (Repeatable+)**

**Target for BAU readiness: Level 3.5 / 5 (Defined+)**

---

*References: TRACKING_REFERENCE.md for verified facts and source files.*
