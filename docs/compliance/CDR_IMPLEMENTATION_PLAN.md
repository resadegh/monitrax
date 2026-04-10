# CDR Compliance Implementation Plan

**Version:** 1.2
**Created:** 2026-03-03
**Last Updated:** 2026-04-10
**Status:** Active — Phases A-G COMPLETE, E & H pending. NEW: Phases I, J, K added for Basiq submission
**Source:** `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md`, `CLAUDE.md` Part 13, `PHASE_34_CDR_SECURITY_HARDENING.md`
**Compliance Target:** Basiq CDR Representative onboarding (6-step compliance form + 25 policy documents + 14 evidence items)
**Current Score:** ~65% (against full Basiq spreadsheet including policies and evidence)

---

## CDR Compliance Progress Dashboard

| Phase | Name | Status | PR | Compliance Impact |
|-------|------|--------|----|----|
| **A** | RBAC Enforcement | ✅ **COMPLETE** | [#438](https://github.com/resadegh/monitrax/pull/438) | §1.5 DONE, §1.6 DONE (+10%) |
| **B** | MFA Enforcement | ✅ **COMPLETE** | [#440](https://github.com/resadegh/monitrax/pull/440) | §1.3 DONE (+5%) |
| **C** | Admin Lifecycle Management | ✅ **COMPLETE** | — | §1.7 DONE (+3%) |
| **D** | CDR Data Lifecycle | ✅ **COMPLETE** | — | §5.2, §5.4, §5.5, §5.6 TODO → DONE (+8%) |
| **E** | GCP Service Enablement | ⬜ Pending | — | §8.x TODO → DONE (+5%) |
| **F** | Policy Documents | ✅ **COMPLETE** | — | §4.x, §5.8, §6.4, §6.5, §7.x N/A/TODO → DONE (+9%) |
| **G** | Dev Pipeline Hardening | ✅ **COMPLETE** | — | §6.4, §6.5 TODO → DONE (included in F) |
| **H** | API Consolidation & Cleanup | ⬜ Pending | — | Attack surface reduction |
| **I** | Security Policies Document | ⬜ Pending | — | Step 5: 25 documented policies (+15%) |
| **J** | Evidence Collection & Submission | ⬜ Pending | — | Step 6: 14 evidence items (+10%) |
| **K** | Spreadsheet Completion & Submission | ⬜ Pending | — | All steps filled, submitted to Basiq |

**Overall: 6 of 11 phases complete.**

---

## Design Principles Governing This Plan

All implementation steps follow the rules defined in `CLAUDE.md`:

1. **GCP-First** (§12.7) — Use managed GCP services before writing custom code
2. **Single Source of Truth** (§12.2) — One canonical location per calculation/service
3. **Thin API routes** (§12.3) — Routes call services, never contain business logic
4. **RBAC enforcement** (§12.5) — `withPermission()` on every route, never bare `withAuth()`
5. **CDR data protection** (§13.3) — Never log, cache, or expose CDR data
6. **Consent lifecycle** (§13.2) — No data access without active consent
7. **Atomic commits** (§12.6) — Each commit is reversible independently
8. **Research before action** (§10) — Read docs and code before writing anything
9. **Build before commit** (§11.2) — `npm run build` must pass before every commit

---

## Execution Rules

- Each step requires **user approval** before starting
- Each step produces a **separate commit** (atomic, reversible)
- Each step updates the **changelog** and **compliance matrix**
- GCP Console changes are documented but executed by the user (I provide instructions)
- Policy documents are drafted by Claude, reviewed/approved by user
- Build verification after every code change

---

## PHASE A: RBAC Enforcement (Phase 34.3) — ✅ COMPLETE

**Goal:** Migrate all ~99 user API routes from `withAuth()` to `withPermission()`
**Why:** Basiq §1.5, §1.6 — Role-based access must restrict access to CDR data
**Risk:** Medium — affects all API routes, but OWNER role has all permissions (backward compatible)
**Reference implementation:** Properties module already migrated

### Completion Summary (2026-03-03/04)

- **70+ route files** migrated from `withAuth()` to `withPermission()`
- **50+ permission types** applied across 14 entity types
- **CDR audit logging** added to all guard functions (fire-and-forget)
- **Zero `withAuth()` references** remain in `app/api/` (2 expected exceptions: dead `auth/login` and admin `audit/compliance`)
- **TypeScript compilation** passes cleanly
- **PR:** [#438](https://github.com/resadegh/monitrax/pull/438)
- **Changelogs:** `CHANGELOG_2026_03_03.md`, `CHANGELOG_2026_03_04.md`

### Remaining Exceptions (Intentional)

| File | Reason |
|------|--------|
| `app/api/auth/login/route.ts` | Dead code — Firebase Auth handles login client-side. Scheduled for deletion in Phase H. |
| `app/api/admin/audit/compliance/route.ts` | Admin route — uses separate admin auth pattern. |

### Strategy

Routes are migrated **module by module** to limit blast radius. Each module is one commit.
The guard signature changes from:

```typescript
// BEFORE: Authentication only
export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => { ... });
}

// AFTER: Permission-enforced
export const GET = withPermission('entity.read', async (request, auth) => { ... });
```

### Step A.1 — Accounts Module

**Routes:** `app/api/accounts/` (~6 routes)
**Permissions:** `account.read`, `account.write`, `account.delete`, `account.export`
**Covers:** GET (list) → `.read`, POST (create) → `.write`, PUT (update) → `.write`, DELETE → `.delete`
**Basiq:** §1.5 (RBAC), §5.1 (CDR data access control)

### Step A.2 — Loans Module

**Routes:** `app/api/loans/` (~5 routes)
**Permissions:** `loan.read`, `loan.write`, `loan.delete`, `loan.export`
**Basiq:** §1.5

### Step A.3 — Income Module

**Routes:** `app/api/income/` (~5 routes)
**Permissions:** `income.read`, `income.write`, `income.delete`, `income.export`
**Basiq:** §1.5

### Step A.4 — Expenses Module

**Routes:** `app/api/expenses/` (~5 routes)
**Permissions:** `expense.read`, `expense.write`, `expense.delete`, `expense.export`
**Basiq:** §1.5

### Step A.5 — Investments Module

**Routes:** `app/api/investments/` (~8 routes)
**Permissions:** `investment.read`, `investment.write`, `investment.delete`, `investment.export`
**Basiq:** §1.5

### Step A.6 — Transactions Module

**Routes:** `app/api/transactions/` (~8 routes)
**Permissions:** `transaction.read`, `transaction.write`, `transaction.delete`, `transaction.export`
**Basiq:** §1.5, §5.3 (CDR data — bank transactions)

### Step A.7 — Basiq/CDR Module (CRITICAL)

**Routes:** `app/api/basiq/` (~5 routes)
**Permissions:** `account.read` (connect, sync), `account.write` (connections)
**Special:** These routes handle CDR-protected data directly from banks
**Basiq:** §1.5, §5.1, §5.3 — highest compliance priority

### Step A.8 — AI/Advisory Module

**Routes:** `app/api/ai/` (~8 routes: advisor, ask, debt-analysis, goal, scenario)
**Permissions:** `report.read` (AI analysis is derived from financial data)
**Basiq:** §1.5 — AI routes consume CDR-derived data

### Step A.9 — Financial Analysis Module

**Routes:** `app/api/budget/`, `app/api/financial-health/`, `app/api/health/`, `app/api/cashflow/`
**Permissions:** `report.read` (analysis/reports), `expense.read` (budget)
**Basiq:** §1.5

### Step A.10 — Documents Module

**Routes:** `app/api/documents/` (~6 routes)
**Permissions:** `report.read` (view), `report.export` (download/share)
**Basiq:** §1.5, §5.3 (documents may contain CDR data)

### Step A.11 — Tax/Reports Module

**Routes:** `app/api/tax/`, `app/api/reports/` (~8 routes)
**Permissions:** `report.read`, `report.export`
**Basiq:** §1.5

### Step A.12 — Settings/User/Org Module

**Routes:** `app/api/settings/`, `app/api/user/`, `app/api/org/` (~10 routes)
**Permissions:** `settings.read`, `settings.write`, `user.read`, `org.read`, `org.update`
**Basiq:** §1.5, §1.6 (least privilege)

### Step A.13 — Remaining Routes

**Routes:** Any routes not covered above (categories, notifications, snapshots, etc.)
**Permissions:** Mapped per route based on data concern
**Action:** Identify all remaining `withAuth()` calls and migrate

### Step A.14 — Verification & Cleanup ✅

- ✅ `grep -r "withAuth(" app/api/` — zero remaining bare `withAuth()` calls (2 expected exceptions)
- ✅ `npm run build` — clean compilation
- ✅ `CDR_BASIQ_COMPLIANCE_MATRIX.md` — §1.5, §1.6 marked DONE
- ✅ Changelogs created for 2026-03-03 and 2026-03-04

---

## PHASE B: MFA Enforcement (Phase 34.4) — ✅ COMPLETE

**Goal:** Enforce MFA on CDR data routes and admin routes
**Why:** Basiq §1.3 — MFA must be enforced, not just available
**Depends on:** Phase A (RBAC must be in place first)
**GCP-First:** Firebase MFA infrastructure already exists — no custom code for MFA itself

### Completion Summary (2026-03-05)

- **`withMFARequired()` guard** created in `lib/auth/guards.ts` — checks `user.mfaEnforcedByOrg` + `user.mfaEnabled` from database
- **4 Basiq/CDR route files** migrated from `withPermission()` to `withMFARequired()`:
  - `app/api/basiq/connect/route.ts` — POST (account.write)
  - `app/api/basiq/connections/route.ts` — GET (account.read)
  - `app/api/basiq/connections/[id]/route.ts` — GET (account.read), DELETE (account.delete)
  - `app/api/basiq/sync/route.ts` — POST (account.write)
- **Admin MFA enforcement** added to `verifyAdminAuth()` in `lib/admin/auth.ts` — SUPER_ADMIN and BILLING_ADMIN roles require MFA
- **TypeScript compilation** passes cleanly
- **CDR compliance matrix** §1.3 marked DONE
- **Phase 34 doc** Sub-Phase 34.4 marked ✅ COMPLETE

### Step B.1 — Create `withMFARequired()` Guard ✅

**File:** `lib/auth/guards.ts` (extend existing)
**Logic:**
1. Check `user.mfaEnabled` — if false, return 403 with message "MFA required for this resource"
2. Check `organization.mfaEnforced` — if true and user hasn't completed MFA, block
3. Firebase handles actual MFA challenge/verification (GCP-First — no custom MFA logic)
**Basiq:** §1.3

### Step B.2 — Wire MFA Guard on Basiq/CDR Routes ✅

**Routes:** `app/api/basiq/*` (connect, connections, connections/[id], sync)
**Pattern:** Replaced `withPermission()` with `withMFARequired()` on CDR data routes
**Basiq:** §1.3, §5.1

### Step B.3 — Wire MFA Guard on Admin Routes ✅

**Routes:** All admin routes via `verifyAdminAuth()` — MFA check for SUPER_ADMIN/BILLING_ADMIN
**Basiq:** §1.3

### Step B.4 — Verification ✅

- ✅ MFA enforced on all CDR data routes
- ✅ `CDR_BASIQ_COMPLIANCE_MATRIX.md` — §1.3 marked DONE
- ✅ `PHASE_34_CDR_SECURITY_HARDENING.md` — Sub-Phase 34.4 marked ✅ COMPLETE

---

## PHASE C: Admin Lifecycle Management (Phase 34.5) — ✅ COMPLETE

**Goal:** Automated review and deactivation of inactive admin accounts
**Why:** Basiq §1.7 — Admin accounts must be regularly reviewed
**GCP-First:** Consider GCP Cloud Scheduler for automated checks instead of custom cron
**Completed:** 2026-03-04 (Admin Portal Phase 33 implementation)

### Step C.1 — Wire `lastLoginAt` Updates ✅

**File:** `app/api/admin/admins/route.ts` (GET endpoint)
**Implementation:**
- `AdminUser.lastLoginAt` tracked in database schema
- 90-day inactivity flag calculated in real-time: `isInactive90Days` field
- Login timestamps updated via admin auth system (`lib/admin/auth.ts`)
**Basiq:** §1.7

### Step C.2 — Create Admin Lifecycle Review Endpoint ✅

**File:** `app/api/admin/admins/route.ts` (GET) + `app/api/admin/admins/[id]/route.ts` (PATCH/DELETE)
**Implementation:**
1. GET `/api/admin/admins` returns all admins with `isInactive90Days` flag
2. PATCH `/api/admin/admins/[id]` allows deactivation (`isActive = false`)
3. DELETE soft-deletes (deactivates) admin and revokes all sessions
4. All actions logged to `AdminAuditLog` with metadata
**Basiq:** §1.7

### Step C.3 — Admin Portal UI for Lifecycle Review ✅

**File:** `app/admin/settings/page.tsx` (Admin Users tab)
**Implementation:**
- Real admin user list fetched from `/api/admin/admins`
- Shows: name, email, role, status (active/inactive), last login, MFA status
- Actions: Deactivate, Reactivate, Unlock account
- 90-day inactivity warning displayed
- Only SUPER_ADMIN can manage other admins
**Basiq:** §1.7

### Step C.4 — Verification ✅

- ✅ `CDR_BASIQ_COMPLIANCE_MATRIX.md` — §1.7 marked as DONE
- ✅ Admin lifecycle review fully functional in Settings page
- ✅ All admin actions create audit log entries
- ✅ Protection against self-demotion and deleting last SUPER_ADMIN

---

## PHASE D: CDR Data Lifecycle Service (Phase 35) — ✅ COMPLETE

**Goal:** Automated consent-driven CDR data management
**Why:** Basiq §5.4, §5.5, §5.6 — CDR data MUST be deleted when consent expires/is revoked
**GCP-First:** Use GCP Cloud Scheduler + Cloud Functions for automation
**Completed:** 2026-03-08

### Completion Summary (2026-03-08)

- **CDR Data Lifecycle Service** created: `lib/services/cdrDataLifecycle.ts` (canonical per CLAUDE.md §12.2)
  - `deleteCDRData()` — Hard-delete all Basiq-sourced accounts, transactions, connections
  - `checkConsentExpiry()` — Find expired consents, trigger CDR data deletion
  - `handleConsentRevocation()` — Immediate consent revocation + data purge
  - `anonymizeCDRData()` — De-identify CDR data for legal retention
  - `hasActiveCDRConsent()` — Consent verification for guards
  - `getCDRDataSummary()` — CDR data counts (never raw data)
- **`withActiveConsent()` guard** added to `lib/auth/guards.ts` — combines permission + MFA + consent check
- **CDR data routes** migrated from `withMFARequired` to `withActiveConsent`:
  - `GET /api/basiq/connections` (list connections)
  - `GET /api/basiq/connections/[id]` (connection detail)
  - `POST /api/basiq/sync` (sync CDR data)
- **Cloud Scheduler endpoint** created: `POST /api/cdr/lifecycle` (CRON_SECRET auth)
- **Consent management API** created: `GET/POST /api/cdr/consent`
- **CDR audit actions** added to schema: `CDR_DATA_DELETED`, `CDR_CONSENT_EXPIRED`, `CDR_CONSENT_REVOKED`, `CDR_DATA_ANONYMIZED`
- **Phase 35 blueprint** created: `docs/blueprint/PHASE_35_CDR_DATA_LIFECYCLE.md`
- **Build passes** — TypeScript compilation clean
- **Compliance matrix** updated — §5.2, §5.4, §5.5, §5.6 marked DONE

### Step D.1 — Create CDR Data Lifecycle Service ✅

**File:** `lib/services/cdrDataLifecycle.ts`
**Basiq:** §5.2, §5.4, §5.5, §5.6

### Step D.2 — Create Consent Verification Middleware ✅

**File:** `lib/auth/guards.ts` — `withActiveConsent()` guard
**Basiq:** §13.2 (CLAUDE.md)

### Step D.3 — Wire Consent Check on CDR Data Routes ✅

**Routes:** `basiq/connections`, `basiq/connections/[id]` GET, `basiq/sync`
**Basiq:** §5.5, §5.6

### Step D.4 — GCP Cloud Scheduler — Consent Expiry Job ✅

**Endpoint:** `POST /api/cdr/lifecycle` (CRON_SECRET auth)
**Schedule:** Daily at 02:00 UTC
**User action required:** Configure Cloud Scheduler in GCP Console
**Basiq:** §5.5

### Step D.5 — Consent Revocation Handler ✅

**Endpoint:** `POST /api/cdr/consent { action: 'revoke_org_consent' | 'revoke_all' | 'delete_cdr_data' }`
**Basiq:** §5.6

### Step D.6 — CDR Data De-identification Utility ✅

**Function:** `anonymizeCDRData()` in `lib/services/cdrDataLifecycle.ts`
**Basiq:** §5.2

### Step D.7 — Create Phase 35 Blueprint Document ✅

**File:** `docs/blueprint/PHASE_35_CDR_DATA_LIFECYCLE.md`

### Step D.8 — Verification ✅

- ✅ Build passes (`npm run build`)
- ✅ `CDR_BASIQ_COMPLIANCE_MATRIX.md` — §5.2, §5.4, §5.5, §5.6 marked DONE
- ✅ Phase 35 blueprint document created

---

## PHASE E: GCP Service Enablement

**Goal:** Enable required GCP services for CDR compliance
**Why:** Basiq §8 — GCP tools are required for the compliance posture
**GCP-First:** This phase IS the GCP-First principle in action
**User action required:** Most steps are GCP Console configuration (I provide detailed instructions)

### Step E.1 — Cloud Armor (WAF + DDoS Protection) — P0

**GCP Service:** Cloud Armor
**What it does:** Web Application Firewall, DDoS protection, IP blocking, OWASP rules
**How:** Create security policy, attach to backend service
**I provide:** Step-by-step GCP Console instructions
**Basiq:** §3.2 (network rules)

### Step E.2 — Security Command Center — P0

**GCP Service:** Security Command Center (Standard tier)
**What it does:** Vulnerability scanning, compliance monitoring, threat detection
**How:** Enable in GCP Console (one-click)
**I provide:** Activation instructions and recommended settings
**Basiq:** §3.5 (security testing)

### Step E.3 — Cloud KMS (CMEK) — P1

**GCP Service:** Cloud KMS (Customer-Managed Encryption Keys)
**What it does:** Encrypt CDR data at rest with keys YOU control (not Google-managed defaults)
**How:** Create keyring, create key, configure Cloud SQL to use CMEK
**I provide:** Step-by-step instructions, key rotation schedule
**Basiq:** §5.7 (CDR data encryption)

### Step E.4 — Cloud Logging + Monitoring + Alerting — P1

**GCP Service:** Cloud Logging, Cloud Monitoring
**What it does:** Centralized log retention (>90 days), uptime checks, error rate alerts
**How:** Route application logs to Cloud Logging, create alert policies
**I provide:** Log sink configuration, alert policy definitions, dashboard templates
**Basiq:** §2.5 (log review), §2.7 (log retention >90 days)

### Step E.5 — Error Reporting — P1

**GCP Service:** Error Reporting
**What it does:** Automatic error grouping, alerting on new error types
**How:** Enable in GCP Console, configure notification channels
**I provide:** Activation instructions
**Basiq:** §3.5

### Step E.6 — Cloud Audit Logs — P1

**GCP Service:** Cloud Audit Logs (Data Access logs)
**What it does:** Logs all GCP API calls — who accessed what, when
**How:** Enable Data Access audit logs in GCP Console
**I provide:** Configuration instructions
**Basiq:** §2.1 (critical system events logged)

### Step E.7 — Cloud DLP (Optional) — P2

**GCP Service:** Cloud Data Loss Prevention
**What it does:** Automated PII detection and redaction in CDR data
**How:** Create DLP inspection templates, configure scanning
**I provide:** Template definitions for CDR data types
**Basiq:** §5.2 (de-identification)

### Step E.8 — Verification

- Document all enabled services
- Update `CDR_BASIQ_COMPLIANCE_MATRIX.md` — mark §8.x items as DONE
- Create GCP services inventory document

---

## PHASE F: Policy Documents — ✅ COMPLETE

**Goal:** Create all required policy documents for Basiq accreditation
**Why:** Basiq §4, §5.8, §7 — policy/procedural requirements for accreditation
**Note:** These are documentation-only — no code changes
**Completed:** 2026-03-08

### Completion Summary (2026-03-08)

- **5 policy documents** created in `docs/policy/`:
  - `CDR_DATA_RETENTION_SCHEDULE.md` — CDR data types, retention periods, legal basis, deletion process (§5.4, §5.8)
  - `DEVICE_SECURITY_POLICY.md` — Device patching, network isolation, endpoint protection (§4.1, §4.2, §4.3)
  - `INCIDENT_RESPONSE_PLAN.md` — Breach classification, containment, OAIC notification, recovery (CDR requirement)
  - `SECURITY_AWARENESS_POLICY.md` — Training requirements, onboarding plan, CDR handling awareness (§7.1, §7.3)
  - `APPROVED_DEPENDENCIES.md` — 40+ packages documented with version, purpose, license, review date (§6.4)
- **Compliance matrix updated** — §4.1-4.3, §5.8, §6.4, §7.1-7.3 marked DONE
- **Score impact** — ~78% → ~85% (+7%)

### Step F.1 — CDR Data Retention Schedule

**File:** `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md`
**Content:**
- What CDR data is collected (accounts, transactions, balances, BSBs)
- Retention period per data type
- Legal basis for retention (if applicable)
- Deletion process when retention period expires
**Basiq:** §5.4, §5.8

### Step F.2 — Device & Endpoint Security Policy

**File:** `docs/policy/DEVICE_SECURITY_POLICY.md`
**Content:**
- Device security requirements (auto-updates, encryption, anti-malware)
- No direct production database access from dev devices
- GCP Console/IAM for all production access
- Current context: sole director, will expand when hiring
**Basiq:** §4.1, §4.2, §4.3

### Step F.3 — Incident Response Plan

**File:** `docs/policy/INCIDENT_RESPONSE_PLAN.md`
**Content:**
- Breach identification and classification
- Containment procedures
- Notification requirements (CDR principal, OAIC, affected consumers)
- Remediation steps
- Post-incident review
**Basiq:** CDR requirement (breach notification)

### Step F.4 — Security Awareness Policy

**File:** `docs/policy/SECURITY_AWARENESS_POLICY.md`
**Content:**
- Security training requirements for future staff
- CDR data handling awareness
- Incident reporting procedures
- Current context: sole director, documented for future hiring
**Basiq:** §7.1, §7.3

### Step F.5 — Approved Dependencies List

**File:** `docs/policy/APPROVED_DEPENDENCIES.md`
**Content:**
- List of approved npm packages with version, purpose, review date
- Process for adding new dependencies (review in PR)
- Automated vulnerability scanning via `npm audit`
**Basiq:** §6.4

### Step F.6 — Verification

- All 5 documents created and reviewed
- Update `CDR_BASIQ_COMPLIANCE_MATRIX.md` — mark relevant items
- Add policy directory to CLAUDE.md Part 8 (Key File Locations)

---

## PHASE G: Development Pipeline Hardening — ✅ COMPLETE

**Goal:** Automated security scanning and dependency management
**Why:** Basiq §3.4, §3.5, §6.4, §6.5
**GCP-First:** Use GitHub-native tools (Dependabot, Actions) — not custom scripts
**Completed:** 2026-03-08

### Completion Summary (2026-03-08)

- **Dependabot** configured (`.github/dependabot.yml`) — weekly npm dependency update PRs, grouped by package family (Radix UI, Google Cloud, types, testing)
- **Security audit CI pipeline** created (`.github/workflows/security-audit.yml`) — `npm audit` runs on every push/PR to main, weekly schedule. Build verification included.
- **Compliance matrix updated** — §6.4, §6.5 marked DONE
- **Score impact** — ~85% → ~87% (+2%)

### Step G.1 — Enable Dependabot

**Platform:** GitHub (native integration)
**What it does:** Automated dependency update PRs, vulnerability alerts
**How:** Create `.github/dependabot.yml`
**Basiq:** §6.5 (libraries regularly updated)

### Step G.2 — Add `npm audit` to CI

**Platform:** GitHub Actions (if CI exists) or pre-push hook
**What it does:** Blocks deployment if critical vulnerabilities found
**Basiq:** §6.4 (libraries reviewed), §3.4 (security patches)

### Step G.3 — Add Security Scanning

**Options (GCP-First preference order):**
1. GCP Security Command Center (if hosting moves to GCP) — §E.2
2. GitHub Advanced Security (CodeQL) — free for public repos
3. Snyk (if budget allows) — npm/container scanning
**Basiq:** §3.5 (vulnerability testing)

### Step G.4 — Verification

- Dependabot enabled and creating PRs
- `npm audit` running in CI/pre-push
- Update `CDR_BASIQ_COMPLIANCE_MATRIX.md`

---

## PHASE H: API Consolidation & Dead Code Removal

**Goal:** Eliminate duplicate APIs and dead code per CLAUDE.md §12.1, §12.4
**Why:** Clean codebase = easier compliance auditing, fewer attack surfaces
**NOTE:** This phase can run in parallel with other phases

### Step H.1 — Delete Dead Auth Routes

**Files to delete:**
- `app/api/auth/login/route.ts` — Dead code, Firebase Auth handles login
- `app/api/auth/register/route.ts` — Dead code, Firebase Auth handles registration
**Verify:** No frontend code calls these routes
**CLAUDE.md:** §12.4 (known violations)

### Step H.2 — Consolidate Snapshot APIs

**Current state:** 3 competing endpoints:
- `/api/portfolio/snapshot` (1052 lines, inline calculations)
- `/api/financial-snapshot`
- `/api/master-snapshot` (canonical — powered by `getMasterFinancialSnapshot()`)

**Action:**
1. Identify all frontend callers of `/api/portfolio/snapshot` and `/api/financial-snapshot`
2. Migrate callers to `/api/master-snapshot`
3. Delete the duplicate endpoints
4. Verify `useUISyncEngine.ts` and `DashboardLayout.tsx` use canonical endpoint
**CLAUDE.md:** §12.3 (single calculation engine), §12.4 (known violations)

### Step H.3 — Remove Server-to-Server HTTP Calls

**Known violation:** `app/api/linkage/health/route.ts` calls `/api/portfolio/snapshot` via HTTP
**Fix:** Import `getMasterFinancialSnapshot()` directly instead of HTTP call
**CLAUDE.md:** §12.10 (no server-to-server HTTP calls)

### Step H.4 — Delete Legacy Admin Audit Page

**File:** `app/dashboard/admin/audit-logs/page.tsx` (marked `@deprecated`)
**Replacement:** `app/admin/audit-logs/page.tsx` (canonical)
**Verify:** No navigation links point to the old page

### Step H.5 — Verification

- Zero duplicate endpoints
- Zero server-to-server HTTP calls
- Zero `@deprecated` files remaining
- `npm run build` passes

---

## PHASE I: Security Policies Document (Basiq Step 5) — NEW

**Goal:** Create unified Security Policies document covering all 25 Basiq-required policies
**Why:** Basiq Step 5 requires documented policies for 25 security areas. Currently 10/25 done, 8/25 missing.
**Approach:** Customize the Basiq-provided Security Policies Template (.docx) with Monitrax-specific details
**Input:** `docs/BASIQ FILES/Security Policies Template.docx` (Basiq template)
**Output:** `docs/policy/MONITRAX_SECURITY_POLICIES.md` (comprehensive document)
**Effort:** 2-3 days

### What Basiq Provided

Basiq has provided a Security Policies Template covering 25 policy areas. Each section contains:
- Policy introduction and purpose
- Policy requirements
- Implementation guidance
- Review schedule

### Mapping: Basiq Template → Existing Monitrax Docs

| # | Policy Area | Existing Monitrax Coverage | Action |
|---|------------|---------------------------|--------|
| 1 | Information Security Policy | None | Create from Basiq template |
| 2 | Acceptable Use Policy | None | Create from Basiq template |
| 3 | Access Control | `docs/operational/security/02_IAM_AND_PERMISSIONS.md` | Extract and adapt |
| 4 | Administrative Access Control | `docs/operational/security/02_IAM_AND_PERMISSIONS.md` | Extract and adapt |
| 5 | Antivirus and Malware Protection | `docs/policy/DEVICE_SECURITY_POLICY.md` | Extract and adapt |
| 6 | Audit Logging and Monitoring | `docs/operational/database/03_MONITORING_AND_ALERTS.md` | Extract and adapt |
| 7 | Background Checks | `docs/policy/SECURITY_AWARENESS_POLICY.md` | Extract and adapt |
| 8 | CDR Data Handling | `docs/compliance/CDR_DATA_RETENTION_SCHEDULE.md` + `docs/operational/security/03_CDR_COMPLIANCE.md` | Extract and adapt |
| 9 | Data Breach Response | `docs/policy/INCIDENT_RESPONSE_PLAN.md` | Extract and adapt |
| 10 | Data Loss Prevention | None — needs GCP Cloud DLP | Create from Basiq template + GCP DLP plan |
| 11 | End-User Device Hardening | `docs/policy/DEVICE_SECURITY_POLICY.md` | Extract and adapt |
| 12 | Firewall Protection | None — Cloud Armor not configured | Create from Basiq template + GCP Armor plan |
| 13 | Information Asset Lifecycle | None | Create from Basiq template |
| 14 | Information Security Boundary Review | None | Create from Basiq template |
| 15 | Information Security Governance Framework | CLAUDE.md + BAU framework partial | Create from Basiq template |
| 16 | Information Security Incident Management | `docs/policy/INCIDENT_RESPONSE_PLAN.md` | Extract and adapt |
| 17 | Information Security Risk Management | None | Create from Basiq template |
| 18 | Monitoring of Application Services | `docs/operational/runbooks/03_HEALTH_CHECKS.md` | Extract and adapt |
| 19 | Multi-Factor Authentication | `docs/operational/security/01_AUTHENTICATION.md` + code | Extract and adapt |
| 20 | OS and Application Patches | `docs/policy/APPROVED_DEPENDENCIES.md` partial | Create from Basiq template |
| 21 | Protecting Data at Rest | GCP auto-encryption — no doc | Create from Basiq template + GCP details |
| 22 | Protecting Data in Transit | SSL/TLS documented | Extract and adapt |
| 23 | Secure Authentication | `docs/operational/security/01_AUTHENTICATION.md` | Extract and adapt |
| 24 | Secure Coding Practices | CLAUDE.md covers extensively | Extract and adapt |
| 25 | Server Hardening | None — managed services | Create from Basiq template |
| 26 | Vulnerability Management | None | Create from Basiq template |

### Steps

#### Step I.1 — Read and parse Basiq Security Policies Template
- Read full .docx content
- Extract 25 policy section structures
- Note template placeholders to fill

#### Step I.2 — Create comprehensive Security Policies document
- For each of 25 policies:
  - If existing Monitrax doc covers it: adapt content to Basiq format
  - If no existing doc: customize Basiq template with Monitrax specifics (GCP, Firebase, Vercel, Prisma)
- Output: Single markdown document or set of policy documents

#### Step I.3 — Verification
- All 25 policy areas covered
- Each policy references Monitrax-specific implementation
- Upload to Basiq evidence folder or link in spreadsheet

### Effort Estimate
- Policies with existing coverage (10): 1-2 hours each = 10-20 hours
- Policies needing creation (8): 2-3 hours each = 16-24 hours
- Policies with partial coverage (7): 1-2 hours each = 7-14 hours
- Total: ~33-58 hours (3-5 working days)

---

## PHASE J: Evidence Collection & Submission (Basiq Step 6) — NEW

**Goal:** Capture and organize all 14 evidence items required by Basiq
**Why:** Basiq Step 6 requires visual proof (screenshots, videos, documents) of security controls
**Output:** Evidence files uploaded to Basiq's shared Google Drive "Evidence" folder
**Effort:** 1-2 days

### Evidence Items

| # | Evidence Required | How to Capture | Source | Status |
|---|-----------------|----------------|--------|--------|
| 1 | MFA setup for user accounts | Screenshot: Firebase Console → Authentication → Sign-in method → MFA | GCP Console | TODO |
| 2 | Users with admin access | Screenshot: GCP IAM page + Admin Portal user list | GCP Console + App | TODO |
| 3 | Role-based access control | Screenshot: permissions.ts code + withPermission() guard usage | GitHub / IDE | TODO |
| 4 | Strong password controls | Screenshot: Firebase Auth password policy settings | GCP Console | TODO |
| 5 | Logging configuration | Screenshot: AuditLog table entries + sanitizeCdrMetadata() code | DB + Code | TODO |
| 6 | Network protection | Screenshot: Cloud SQL authorized networks + SSL config | GCP Console | TODO — needs Cloud Armor |
| 7 | Encryption in transit (SSL) | Screenshot: Cloud SQL SSL certificate + Vercel HTTPS | GCP Console + Vercel | TODO |
| 8 | Encryption at rest | Screenshot: Cloud SQL encryption settings page | GCP Console | TODO |
| 9 | Patching of services/libraries | Screenshot: Dependabot PRs + npm audit CI output | GitHub | TODO |
| 10 | Secure coding practices | Screenshot: GitHub PR review + CI pipeline run | GitHub | TODO |
| 11 | Vulnerability scanning | Report: External pen test or OWASP ZAP scan | External vendor | BLOCKER |
| 12 | Anti-virus on devices | Screenshot: macOS System Settings → Privacy & Security | macOS | TODO |
| 13 | System architecture diagram | Document: CDR data flow diagram showing boundaries | Create new | TODO |
| 14 | Cyber + professional liability insurance | Document: Certificate of currency | Insurance broker | BLOCKER |

### Blockers
1. **Evidence 11 (Vulnerability scanning):** Must commission external pen test or run OWASP ZAP. Estimated cost: $2,000-$5,000 for external, free for OWASP ZAP self-service.
2. **Evidence 14 (Insurance):** Must obtain cyber liability and professional liability insurance policies. Business action — contact insurance broker.

### Steps

#### Step J.1 — Capture screenshots (items 1-5, 7-10, 12)
- User captures screenshots from GCP Console, GitHub, macOS
- Label files clearly: "1.0_MFA_Setup.png", "2.0_Admin_Access.png", etc.

#### Step J.2 — Create architecture diagram (item 13)
- Create CDR-specific system architecture diagram
- Show: Consumer → Monitrax App → Basiq API → Data Holders
- Show: Data storage boundaries (GCP Cloud SQL Sydney)
- Show: Encryption layers (TLS in transit, AES at rest)

#### Step J.3 — Commission pen test (item 11)
- Options: External pen test vendor or self-service OWASP ZAP
- Must include: CDR data endpoints, auth system, API surface

#### Step J.4 — Obtain insurance (item 14)
- Cyber liability insurance
- Professional liability (PI) insurance
- Request certificates of currency

#### Step J.5 — Upload to Basiq Evidence folder
- Upload all evidence files to shared Google Drive folder
- Name files per Basiq numbering: "1.0_MFA_Setup.png", etc.

---

## PHASE K: Spreadsheet Completion & Submission — NEW

**Goal:** Fill the Basiq CDR Compliance spreadsheet and submit for review
**Why:** This is the final deliverable — Basiq reviews this for CDR Representative approval
**Depends on:** Phases I (policies) and J (evidence) must be complete
**Effort:** 2-4 hours

### Steps

#### Step K.1 — Fill Step 1 (Organisation)
- Verify company details are correct
- Upload real company logo (200x39px)
- Confirm all role assignments

#### Step K.2 — Fill Step 2 (CDR Data Use)
- Answer all CDR data use questions
- Mark confirmations as True

#### Step K.3 — Fill Step 3 (Security Practices)
- Mark all 38 implemented items as True
- Add notes for partial items

#### Step K.4 — Fill Step 4 (Technology)
- Mark all enabled GCP services
- Note: depends on Phase E completion

#### Step K.5 — Fill Step 5 (Policies)
- Link each policy document in the spreadsheet
- Upload policies to Evidence folder

#### Step K.6 — Fill Step 6 (Evidence)
- Link each evidence item in the spreadsheet
- Reference uploaded files in Evidence folder

#### Step K.7 — Review and Submit
- Final review of all answers
- Email Jad + cc compliance@basiq.io
- Include: completed spreadsheet, summary of Monitrax security posture

---

## Execution Sequence & Dependencies

```
Phase A (RBAC) ──────────────────────────────────┐
  A.1 Accounts                                   │
  A.2 Loans                                      │
  A.3 Income                                     │
  A.4 Expenses                                   │
  A.5 Investments                                │
  A.6 Transactions                               │
  A.7 Basiq/CDR (critical)                       │
  A.8 AI/Advisory                                │
  A.9 Financial Analysis                         │
  A.10 Documents                                 │
  A.11 Tax/Reports                               │
  A.12 Settings/User/Org                         │
  A.13 Remaining                                 │
  A.14 Verification                              │
                                                 │
Phase B (MFA) ← depends on A ───────────────────┤
  B.1 Create withMFARequired()                   │
  B.2 Wire on Basiq/CDR routes                   │
  B.3 Wire on Admin routes                       │
  B.4 Verification                               │
                                                 │
Phase C (Admin Lifecycle) ← independent ─────────┤
  C.1 lastLoginAt updates                        │
  C.2 Lifecycle review endpoint                  │
  C.3 Admin portal UI                            │
  C.4 Verification                               │
                                                 │
Phase D (CDR Data Lifecycle) ← depends on A ─────┤
  D.1 CDR Data Lifecycle Service                 │
  D.2 Consent verification middleware            │
  D.3 Wire consent check on routes               │
  D.4 Cloud Scheduler consent job                │
  D.5 Consent revocation handler                 │
  D.6 De-identification utility                  │
  D.7 Phase 35 blueprint                         │
  D.8 Verification                               │
                                                 │
Phase E (GCP Services) ← independent ────────────┤
  E.1-E.7 GCP Console configuration              │
  E.8 Verification                               │
                                                 │
Phase F (Policy Docs) ← independent ─────────────┤
  F.1-F.5 Create policy documents                │
  F.6 Verification                               │
                                                 │
Phase G (Dev Pipeline) ← independent ────────────┤
  G.1-G.3 Dependabot, npm audit, scanning        │
  G.4 Verification                               │
                                                 │
Phase H (API Cleanup) ← can run in parallel ─────┤
  H.1-H.4 Dead code removal, consolidation       │
  H.5 Verification                               │
                                                  │
Phase I (Security Policies) ← independent ────────┤
  I.1-I.3 Customize Basiq template                │
                                                  │
Phase J (Evidence) ← depends on E, I ─────────────┤
  J.1-J.5 Capture, create, upload                 │
                                                  │
Phase K (Submission) ← depends on I, J ────────────┘
  K.1-K.7 Fill spreadsheet, submit
```

### Recommended Order

| Order | Phase | Why This Order |
|-------|-------|----------------|
| 1 | **A** (RBAC) | Foundation — all other phases depend on proper access control |
| 2 | **F** (Policy Docs) | Quick wins — no code changes, satisfies Basiq §4, §7 |
| 3 | **B** (MFA) | Depends on Phase A, enforces CDR data protection |
| 4 | **H** (API Cleanup) | Reduces attack surface, simplifies codebase for later phases |
| 5 | **C** (Admin Lifecycle) | Independent, small scope, satisfies §1.7 |
| 6 | **D** (CDR Data Lifecycle) | Largest gap — consent-driven deletion |
| 7 | **E** (GCP Services) | GCP Console config — user executes, I provide instructions |
| 8 | **G** (Dev Pipeline) | Automation — Dependabot, npm audit |

---

## Expected Compliance Score After Each Phase

| After Phase | Score | Key Improvements | Status |
|-------------|-------|------------------|--------|
| Baseline | ~55% | Initial state | — |
| **C (Admin)** | **~60%** | §1.7 DONE — Admin lifecycle review | ✅ COMPLETE 2026-03-04 |
| **A (RBAC)** | **~68%** | §1.5, §1.6 PARTIAL → DONE | ✅ COMPLETE 2026-03-03 |
| **B (MFA)** | **~73%** | §1.3 PARTIAL → DONE | ✅ COMPLETE 2026-03-05 |
| **D (CDR Lifecycle)** | **~78%** | §5.2, §5.4, §5.5, §5.6 TODO → DONE | ✅ COMPLETE 2026-03-08 |
| **F (Policy Docs)** | **~85%** | §4.x, §5.8, §7.x N/A → DONE | ✅ COMPLETE 2026-03-08 |
| **G (Dev Pipeline)** | **~87%** | §6.4, §6.5 TODO → DONE | ✅ COMPLETE 2026-03-08 |
| E (GCP) | ~93% | §8.x items TODO → DONE | ⬜ Pending |
| H (API Cleanup) | ~95% | Architecture quality, reduced attack surface | ⬜ Pending |
| I (Policies) | ~80% | 25 policies documented | ⬜ Pending |
| J (Evidence) | ~90% | 14 evidence items captured | ⬜ Pending |
| K (Submission) | ~100% | Spreadsheet complete and submitted | ⬜ Pending |

---

## Risk Register

| Risk | Phase | Mitigation |
|------|-------|------------|
| RBAC breaks existing functionality | A | OWNER role has all permissions — backward compatible. Test each module individually |
| MFA blocks users who haven't enrolled | B | Grace period before enforcement. Clear UI messaging to enroll |
| Consent expiry deletes important data | D | Legal retention override for loan applications. Warn users before deletion |
| GCP service costs | E | Start with free/standard tiers. Monitor usage. Document cost justifications |
| API consolidation breaks frontend | H | Trace all callers before deletion. Staged migration with feature flags if needed |

---

## Session Tracking

Each phase will create its own changelog entry:
- `docs/changelog/CHANGELOG_YYYY_MM_DD.md` — per session
- `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` — updated after each phase
- `docs/blueprint/MASTER_BLUEPRINT.md` — updated when phase status changes

---

*Last Updated: 2026-04-10*
*Phases A, B, C, D, F, G Complete (6 of 11)*
*New Phases I, J, K added for Basiq submission*
*Next: Phase I (Security Policies Template customization)*
*Score: ~55% → ~87% (against original 54 items) → ~65% (against full Basiq spreadsheet incl. policies & evidence)*
