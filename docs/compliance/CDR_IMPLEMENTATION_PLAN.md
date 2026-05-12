# CDR Compliance Implementation Plan

**Version:** 1.3
**Created:** 2026-03-03
**Last Updated:** 2026-04-11
**Status:** Active — Phases A-G, I COMPLETE. E, H pending (GCP config + API cleanup). J, K in progress (user actions).
**Source:** `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`, `CLAUDE.md` Part 13, `PHASE_34_CDR_SECURITY_HARDENING.md`
**Compliance Target:** Basiq CDR Representative onboarding (6-step compliance form + 25 policy documents + 14 evidence items)
**Current Score:** ~75% (against full Basiq spreadsheet including policies and evidence)

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
| **I** | Security Policies Document | ✅ **COMPLETE** | [#462](https://github.com/resadegh/monitrax/pull/462) | Step 5: 26 documented policies — `docs/policy/MONITRAX_SECURITY_POLICIES.md` (699 lines) |
| **J** | Evidence Collection & Submission | 🔶 **IN PROGRESS** | — | Step 6: Evidence guide created. Screenshots + 2 blockers (pen test, insurance) remain. |
| **K** | Spreadsheet Completion & Submission | 🔶 **IN PROGRESS** | — | Spreadsheet answers documented. Fill + submit pending user action. |
| **L** | CDR Code-Level Remediation | 🔶 **IN PROGRESS** | — | 20/46 gaps fixed (2026-04-11). Schema, auth, lifecycle, security hardening done. UI + route migration remaining. |
| **M** | Admin Portal — GCP-First Migration | ✅ **COMPLETE** | [#470](https://github.com/resadegh/monitrax/pull/470)-[#477](https://github.com/resadegh/monitrax/pull/477) | M.1-M.5 all DONE (2026-04-12). Admin auth on Firebase, 5 GCP API integrations, modernized UI, 6 operational docs. |
| **N** | Consumer Consent UI & Route Migration | 🔶 **IN PROGRESS** | — | N.1 Consumer consent UI DONE. N.3 Basiq webhook DONE. N.4 small fixes DONE. N.2 legacy route migration in progress. |

**Overall: 7 of 14 phases complete. 3 in progress (evidence, spreadsheet, code remediation). 4 pending (GCP config, API cleanup, admin portal migration, consent UI).**

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
**Schedule:** Daily at 02:00 Australia/Sydney (AEST/AEDT)
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

## PHASE I: Security Policies Document (Basiq Step 5) — ✅ COMPLETE

**Goal:** Create unified Security Policies document covering all 26 Basiq-required policies
**Why:** Basiq Step 5 requires documented policies for 25+ security areas.
**Approach:** Customized Basiq-provided Security Policies Template (.docx) with Monitrax-specific details
**Input:** `docs/BASIQ FILES/Security Policies Template.docx` (Basiq template)
**Output:** `docs/policy/MONITRAX_SECURITY_POLICIES.md` (699 lines, 26 policies)
**Completed:** 2026-04-11 — PR [#462](https://github.com/resadegh/monitrax/pull/462)

### Completion Summary

- **26 security policies** customized for Monitrax (GCP, Firebase, Vercel, Prisma, Cloud SQL Sydney)
- Each policy includes: Introduction, Policy Requirements, Implementation, Review Schedule
- All policies reference Monitrax-specific tools, code paths, and infrastructure
- Document ready for upload to Basiq Evidence folder

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

## PHASE J: Evidence Collection & Submission (Basiq Step 6) — 🔶 IN PROGRESS

**Goal:** Capture and organize all 14 evidence items required by Basiq
**Progress:** Evidence guide created (`docs/compliance/CDR_EVIDENCE_SCREENSHOT_GUIDE.md`). Architecture diagram created (`docs/compliance/CDR_SYSTEM_ARCHITECTURE.md`). Screenshots and 2 blockers remain.
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

## PHASE L: CDR Code-Level Remediation — 🔶 IN PROGRESS (Deep Audit 2026-04-11)

**Goal:** Fix all code-level CDR compliance gaps identified in deep audit
**Why:** Deep audit found 46 gaps (was 12). Critical issues include unauthenticated admin route, non-functional consent page, incomplete route migration, missing Basiq webhook integration.
**Source:** `docs/compliance/CDR_SPREADSHEET_ANSWERS_AND_GAPS.md` — Gap Analysis Summary
**Effort:** ~20-30 dev days (many gaps overlap)
**Depends on:** Phase E (GCP services) for some items
**Progress (2026-04-11):** 20 of 46 gaps fixed. See `docs/changelog/CHANGELOG_2026_04_11_CDR_REMEDIATION.md`

### L.1 — Critical Fixes (Before Submission)

| Step | Gap | Action | Effort | Status |
|------|-----|--------|--------|--------|
| L.1.1 | G35 | Add auth to `/api/admin/dashboard` — currently returns stats with NO auth | 15 min | ✅ DONE |
| L.1.2 | G29 | Configure GCP Cloud Scheduler for consent expiry automation | 1 hour (GCP Console) | ⬜ User action |

### L.2 — CDR Data Lifecycle Fixes (Before Go-Live)

| Step | Gap | Action | Effort | Status |
|------|-----|--------|--------|--------|
| L.2.1 | G15 | `deleteCDRData()` — add Basiq API `deleteConnection()` call before local deletion | 0.5 day | ✅ DONE |
| L.2.2 | G22 | `deleteCDRData()` — wrap all operations in `prisma.$transaction()` | 0.5 day | ✅ DONE |
| L.2.3 | G26 | `deleteCDRData()` — add RecurringPayment deletion for Basiq-linked accounts | 0.5 day | ✅ DONE |
| L.2.4 | G28 | DELETE connection route — hard-delete instead of soft-disable | 0.5 day | ✅ DONE |
| L.2.5 | G20 | `revoke_all` — add Basiq API revocation for direct connections | 0.5 day | ✅ DONE |
| L.2.6 | G25 | `checkConsentExpiry()` — add BasiqConnection expiry check (after G19) | 0.5 day | ✅ DONE |

### L.3 — Schema & Consent Model (Before Go-Live)

| Step | Gap | Action | Effort | Status |
|------|-----|--------|--------|--------|
| L.3.1 | G18 | Create `CDRConsent` Prisma model with full lifecycle fields | 1 day | ✅ DONE |
| L.3.2 | G19 | Add `consentExpiresAt`, `consentScope` to `BasiqConnection` | 0.5 day | ✅ DONE |
| L.3.3 | G43 | Create `CDRComplaint` and `CDRDisclosure` models for record-keeping | 1 day | ✅ DONE |

### L.4 — Consumer UI (Before Go-Live)

| Step | Gap | Action | Effort |
|------|-----|--------|--------|
| L.4.1 | G13/G14 | Build `/dashboard/settings/privacy` — consent management + CDR data dashboard | 5-7 days |
| L.4.2 | G36 | Replace demo data in portal consent page with real Basiq consent flow | 2-3 days |

### L.5 — Auth & Permissions (Before Go-Live)

| Step | Gap | Action | Effort | Status |
|------|-----|--------|--------|--------|
| L.5.1 | G21 | Add `cdr_data.read`, `cdr_data.write`, `cdr_data.delete` permissions | 1 day | ✅ DONE |
| L.5.2 | G37 | Complete route migration — ~26 routes still on legacy auth | 3-5 days | ⬜ Pending |
| L.5.3 | G38 | Add auth to storage settings routes | 0.5 day | ⬜ Pending |
| L.5.4 | G39 | Migrate document routes from `getCurrentUser()` to `withPermission()` | 1 day | ⬜ Pending |
| L.5.5 | G17 | `withMFARequired()` — verify Firebase `sign_in_second_factor` token claim | 1 day | ✅ DONE |

### L.6 — Basiq Integration (Before Go-Live)

| Step | Gap | Action | Effort |
|------|-----|--------|--------|
| L.6.1 | G16 | Create `/api/basiq/webhook` endpoint for Basiq Events | 2-3 days |
| L.6.2 | G16 | Subscribe to Basiq Events via Basiq dashboard | 1 hour (Basiq Console) |

### L.7 — Security Hardening (Within 30 Days)

| Step | Gap | Action | Effort | Status |
|------|-----|--------|--------|--------|
| L.7.1 | G23 | `sanitizeCdrMetadata()` — add array recursion | 0.5 day | ✅ DONE |
| L.7.2 | G24 | `anonymizeCDRData()` — strip/aggregate amount field | 0.5 day | ✅ DONE |
| L.7.3 | G27 | CRON_SECRET — use `crypto.timingSafeEqual()` | 15 min | ✅ DONE |
| L.7.4 | G42 | Testing routes — block in production unconditionally | 0.5 day | ✅ DONE |
| L.7.5 | G44 | Schedule `enforceAuditLogRetention()` via CDR lifecycle endpoint | 1 hour | ✅ DONE |
| L.7.6 | G45 | Schedule `runAnomalyDetection()` via CDR lifecycle endpoint | 1 hour | ✅ DONE |

### L.8 — Policy & Documentation (Before Go-Live)

| Step | Gap | Action | Effort | Status |
|------|-----|--------|--------|--------|
| L.8.1 | G40 | Create CDR Complaints Policy — internal dispute resolution process | 1 day | ✅ DONE |
| L.8.2 | G46 | Document data minimisation enforcement approach | 0.5 day | ⬜ Pending |

---

## PHASE M: Admin Portal — GCP-First Architecture Migration — ⬜ NEW

**Goal:** Migrate the Admin Portal from custom identity/session management to GCP-native services. The Admin Portal becomes a thin UI layer that orchestrates GCP APIs — it never rebuilds capabilities that GCP provides as managed services.
**Why:** Current admin portal has a completely custom, parallel identity system (`AdminUser` table, SHA256 passwords, custom tokens) that violates the GCP-First principle (CLAUDE.md §12.7). Admin auth, user management, audit logging, monitoring, and security scanning all have superior GCP managed alternatives.
**Current State:** Admin portal is deployed but broken — API calls fail with "No authentication token provided" across CDR Compliance, Security, Feature Flags, and Settings pages. The custom admin session system is not functioning correctly after the GCP Cloud SQL migration.
**Architecture Blueprint:** `docs/blueprint/PHASE_M_ADMIN_PORTAL_GCP_FIRST.md`
**Effort:** ~15-20 dev days total across sub-phases
**Depends on:** Phase E (GCP Service Enablement) for monitoring/logging/SCC integration

### Design Principles for Admin Portal

1. **GCP is the source of truth for identity** — Admin users authenticate via GCP Identity Platform (Firebase Auth) with custom claims `{ monitraxAdmin: true, adminRole: 'SUPER_ADMIN' }`. No separate `AdminUser` password table.
2. **GCP APIs for user operations** — Suspend/disable users calls `admin.auth().updateUser(uid, { disabled: true })`. Session revocation calls `admin.auth().revokeRefreshTokens(uid)`.
3. **GCP for observability** — Audit logs dual-write to Cloud Logging (7-year CDR retention). Admin portal reads from Cloud Logging API. Monitoring dashboards embed/link to Cloud Monitoring.
4. **GCP for security** — Vulnerability status from Security Command Center API. Encryption status from Cloud KMS API. DDoS/WAF from Cloud Armor.
5. **No custom rebuilds** — If GCP provides it as a managed service, the admin portal calls the GCP API or links to GCP Console. Custom code is only for Monitrax business logic (billing, subscriptions, feature flags, CDR consent aggregation).
6. **GCP IAM for infrastructure access** — Admin roles map to GCP IAM roles for Cloud SQL, Cloud Storage, Logging, and Monitoring access. No direct database access from dev machines.

### Target Architecture

```
                    ┌──────────────────────────────┐
                    │    GCP IDENTITY PLATFORM      │
                    │  Firebase Auth + Custom Claims │
                    │  (monitraxAdmin, adminRole)    │
                    └──────────────┬─────────────────┘
                                   │ Firebase ID Token
                    ┌──────────────▼─────────────────┐
                    │       ADMIN PORTAL UI           │
                    │  Thin control plane — delegates  │
                    │  to GCP APIs for infrastructure  │
                    └──┬────────┬────────┬────────┬──┘
                       │        │        │        │
          ┌────────────▼──┐ ┌──▼─────┐ ┌▼──────┐ ┌▼───────────┐
          │ GCP Identity  │ │ Cloud  │ │ SCC   │ │ Cloud      │
          │ Platform API  │ │Logging │ │ API   │ │ Monitoring │
          │ • Disable user│ │• Audit │ │• Vulns│ │ • Alerts   │
          │ • Revoke token│ │• 7yr   │ │• Scans│ │ • Uptime   │
          │ • MFA enforce │ │• Search│ │       │ │ • Metrics  │
          │ • Custom claim│ │        │ │       │ │            │
          └───────────────┘ └────────┘ └───────┘ └────────────┘
                                   │
                    ┌──────────────▼─────────────────┐
                    │     GCP Cloud SQL (Sydney)      │
                    │  PostgreSQL — CDR data + app DB  │
                    │  Encrypted (CMEK via Cloud KMS)  │
                    └────────────────────────────────┘
```

### What Admin Portal Keeps (Monitrax Business Logic)

| Capability | Reason |
|------------|--------|
| Billing & Subscriptions | Stripe integration — GCP has no equivalent |
| Organization License Management | Monitrax-specific business logic |
| Feature Flag System | App-specific rollout control |
| CDR Consent Aggregation Dashboard | Monitrax CDR-specific metrics |
| User Impersonation (support) | App-specific debugging tool |
| CDR Complaints Tracking | Monitrax CDR compliance model |

### What Admin Portal Delegates to GCP

| Current Custom Code | GCP Replacement |
|---------------------|-----------------|
| `AdminUser` table + SHA256 passwords | GCP Identity Platform (Firebase Auth) with admin custom claims |
| `AdminSession` table + custom tokens | Firebase ID tokens verified by `verifyGCPIdToken()` |
| Custom lockout/account disable | `admin.auth().updateUser(uid, { disabled: true })` |
| Custom session revocation | `admin.auth().revokeRefreshTokens(uid)` |
| Custom MFA check (DB flag only) | Firebase `sign_in_second_factor` token claim |
| Audit logs in PostgreSQL only | Dual-write: PostgreSQL + Cloud Logging (7-year retention) |
| Custom anomaly detection | Cloud Monitoring alert policies |
| Custom error tracking | GCP Error Reporting |
| "GCP health: unknown" placeholders | Real GCP API calls (SCC, Monitoring, KMS) |
| Custom log retention cleanup | Cloud Logging retention policies (managed) |

### Sub-Phase M.1 — Admin Auth Migration to GCP Identity Platform (~3-5 dev days)

| Step | Action | Effort | Status |
|------|--------|--------|--------|
| M.1.1 | Set Firebase custom claims on admin users: `{ monitraxAdmin: true, adminRole: 'SUPER_ADMIN' }` | 0.5 day | ⬜ User action (Firebase Console) |
| M.1.2 | Create `verifyAdminGCPAuth()` guard that verifies Firebase token + checks `monitraxAdmin` claim | 1 day | ✅ DONE (2026-04-12) |
| M.1.3 | Migrate admin login page to use Firebase Auth (email/password with MFA) | 1 day | ✅ DONE (2026-04-12) |
| M.1.4 | Migrate all admin API routes from `verifyAdminAuth()` to `verifyAdminGCPAuth()` | 1 day | ✅ DONE (2026-04-12) — 22 routes migrated |
| M.1.5 | Update AdminLayoutClient to use Firebase Auth state (replaced mock data) | 0.5 day | ✅ DONE (2026-04-12) |
| M.1.6 | Update admin API client to send Firebase Bearer token (replaced cookie auth) | 0.5 day | ✅ DONE (2026-04-12) |
| M.1.7 | Deprecate `AdminUser` password auth + `AdminSession` token system (retain table for audit history) | 0.5 day | ✅ DONE (2026-04-12) — Old functions retained but no longer called |
| M.1.8 | Fix current broken admin portal (all pages showing "No authentication token provided") | 0.5 day | ✅ DONE (2026-04-12) — Root cause: custom session system. Fixed by migrating to Firebase Auth |

### Sub-Phase M.2 — GCP Observability Integration (~3-4 dev days)

| Step | Action | Effort | Status |
|------|--------|--------|--------|
| M.2.1 | Audit log dual-write: existing `createAuditLog()` also writes to Cloud Logging | 1 day | ✅ DONE (2026-04-12) |
| M.2.2 | Admin audit log page: query Cloud Logging API instead of (or alongside) PostgreSQL | 1 day | ✅ DONE (2026-04-12) — `lib/gcp/cloudLogging.ts` + `/api/admin/audit/cloud-logging` |
| M.2.3 | CDR compliance dashboard: replace "unknown" GCP health placeholders with real status | 1 day | ✅ DONE (2026-04-12) — 5 services enabled, 4 planned |
| M.2.4 | Security monitoring page: read from Cloud Monitoring API for auth events, rate limits | 0.5 day | ✅ DONE (2026-04-12) — `lib/gcp/cloudMonitoring.ts` + `/api/admin/gcp/uptime` |
| M.2.5 | Error tracking: integrate GCP Error Reporting API for error logs page | 0.5 day | ✅ DONE (2026-04-12) — `lib/gcp/errorReporting.ts` + `/api/admin/gcp/errors` |

### Sub-Phase M.3 — GCP Security Integration (~2-3 dev days)

| Step | Action | Effort | Status |
|------|--------|--------|--------|
| M.3.1 | Security page: show SCC findings via Security Command Center API | 1 day | ✅ DONE (2026-04-12) — `lib/gcp/securityCommandCenter.ts` + `/api/admin/gcp/security-findings` |
| M.3.2 | Cloud Scheduler management: view/pause/resume/run CDR lifecycle job from admin | 0.5 day | ✅ DONE (2026-04-12) — `lib/gcp/cloudScheduler.ts` + `/api/admin/gcp/scheduler` |
| M.3.3 | Encryption status: show Cloud KMS key rotation status via KMS API | 0.5 day | ⬜ (requires CMEK setup) |
| M.3.4 | CDR compliance: show Cloud Armor WAF status (when enabled) | 0.5 day | ⬜ (requires Cloud Armor setup) |
| M.3.5 | GCP IAM roles: document and enforce admin IAM role mapping | 0.5 day | ⬜ |

### Sub-Phase M.4 — Admin Portal CDR Consent Management (~2 dev days)

| Step | Action | Effort | Status |
|------|--------|--------|--------|
| M.4.1 | Admin CDR dashboard: real consent metrics from CDRConsent model (not just OrganizationClient) | 1 day | ✅ DONE (2026-04-12) — includes CDRConsent, BasiqConnection, CDRComplaint, CDRDisclosure |
| M.4.2 | Admin consent management: view/revoke/delete CDR data on behalf of users (with audit trail) | 1 day | ✅ DONE (2026-04-12) — `/api/admin/cdr/consent` GET + POST |
| M.4.3 | CDR complaint management: create/resolve/escalate complaints from CDRComplaint model | 0.5 day | ✅ DONE (2026-04-12) — `/api/admin/cdr/complaints` CRUD + `/[id]` PATCH |

### Sub-Phase M.5 — Operational & BAU Support Documentation (~2 dev days)

Created AFTER Phase M implementation is complete — to train admin portal support team.

| Step | Action | Effort | Status |
|------|--------|--------|--------|
| M.5.1 | Create Admin Portal Operations Guide (`docs/operational/admin/01_ADMIN_PORTAL_OPERATIONS.md`) | 0.5 day | ✅ DONE (2026-04-12) |
| M.5.2 | Create Admin Troubleshooting Runbook (`docs/operational/admin/02_ADMIN_TROUBLESHOOTING_RUNBOOK.md`) | 0.5 day | ✅ DONE (2026-04-12) |
| M.5.3 | Create GCP Service Operations for Admins (`docs/operational/admin/03_GCP_SERVICE_OPERATIONS.md`) | 0.5 day | ✅ DONE (2026-04-12) |
| M.5.4 | Create Admin Onboarding & Training Guide (`docs/operational/admin/04_ADMIN_ONBOARDING_TRAINING.md`) | 0.5 day | ✅ DONE (2026-04-12) |
| M.5.5 | Create CDR Compliance Admin Procedures (`docs/operational/admin/05_CDR_COMPLIANCE_PROCEDURES.md`) | 0.5 day | ✅ DONE (2026-04-12) |
| M.5.6 | Create Admin Portal BAU Playbook (`docs/bau-framework/ADMIN_PORTAL_BAU_PLAYBOOK.md`) | 0.5 day | ✅ DONE (2026-04-12) |

### GCP IAM Role Mapping for Admin Portal

| Admin Portal Role | GCP IAM Roles Required | Purpose |
|-------------------|----------------------|---------|
| SUPER_ADMIN | `roles/iam.admin`, `roles/cloudsql.admin`, `roles/logging.admin`, `roles/monitoring.admin` | Full platform control |
| BILLING_ADMIN | `roles/logging.viewer`, `roles/monitoring.viewer` | Read-only infrastructure access |
| SUPPORT_ADMIN | `roles/logging.viewer`, `roles/cloudsql.viewer` | Log review for support cases |
| VIEWER | `roles/logging.viewer` | Read-only log access |

---

## PHASE N: Consumer Consent UI & Remaining Route Migration — ⬜ NEW

**Goal:** Build consumer-facing CDR consent management and complete legacy auth migration
**Why:** CDR Rules mandate consumer access to consent management. Legacy auth routes bypass RBAC and audit logging.
**Effort:** ~10-12 dev days
**Depends on:** Phase L (CDR models), Phase M (GCP auth for admin operations)

### Sub-Phase N.1 — Consumer Consent Management UI (G13/G14) (~5-7 dev days)

| Step | Gap | Action | Effort | Status |
|------|-----|--------|--------|--------|
| N.1.1 | G13 | Build `/dashboard/settings/privacy` page — view active consents, connected banks, data scope | 2 days | ✅ DONE (2026-04-12) |
| N.1.2 | G14 | Add CDR data dashboard to privacy page — what data is held, when collected, download/delete | 2 days | ✅ DONE (2026-04-12) |
| N.1.3 | G36 | Replace portal consent demo data with real Basiq consent flow | 2 days | ⬜ (portal is separate feature) |
| N.1.4 | — | Connect consent UI to `/api/cdr/consent` endpoints + `/api/cdr/lifecycle` | 1 day | ✅ DONE (2026-04-12) |

### Sub-Phase N.2 — Legacy Auth Route Migration (G37-G39) (~3-5 dev days)

| Step | Gap | Action | Effort | Status |
|------|-----|--------|--------|--------|
| N.2.1 | G37 | Migrate ~26 routes from `verifyToken`/`getCurrentUser` to `withPermission()` | 3 days | 🔶 IN PROGRESS (2026-04-12) |
| N.2.2 | G38 | Add auth to 3 storage settings routes | 0.5 day | 🔶 IN PROGRESS |
| N.2.3 | G39 | Migrate ~8 document routes from `getCurrentUser()` to `withPermission()` | 1 day | 🔶 IN PROGRESS |
| N.2.4 | G41 | Verify all migrated routes now have audit logging (automatic with `withPermission()`) | 0.5 day | 🔶 IN PROGRESS |

### Sub-Phase N.3 — Basiq Webhook Integration (G16) (~2-3 dev days)

| Step | Gap | Action | Effort | Status |
|------|-----|--------|--------|--------|
| N.3.1 | G16 | Create `/api/basiq/webhook` endpoint for Basiq Events (consent revocation, connection status) | 2 days | ✅ DONE (2026-04-12) |
| N.3.2 | G16 | Subscribe to Basiq Events via Basiq dashboard | 1 hour | ⬜ (user action — post-deploy) |

### Sub-Phase N.4 — Remaining Small Fixes (~2 dev days)

| Step | Gap | Action | Effort | Status |
|------|-----|--------|--------|--------|
| N.4.1 | G46 | Document data minimisation enforcement approach | 0.5 day | ✅ DONE (2026-04-12) — `docs/policy/CDR_DATA_MINIMISATION.md` |
| N.4.2 | G32 | Portal auth token in localStorage → httpOnly cookies | 1 day | ⬜ (portal-specific) |
| N.4.3 | G33 | Optimize `withActiveConsent()` to reduce DB queries | 0.5 day | ✅ DONE (2026-04-12) — parallel queries, count() |
| N.4.4 | G34 | Add fromDate/toDate params to Basiq `getTransactions()` | 0.5 day | ✅ DONE (2026-04-12) |

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
| **I (Policies)** | **~75%** | 26 policies documented (699 lines) | ✅ COMPLETE 2026-04-11 |
| J (Evidence) | ~90% | Guide created. Screenshots + blockers remain | 🔶 IN PROGRESS |
| K (Submission) | ~100% | Answers documented. Fill spreadsheet + submit | 🔶 IN PROGRESS |

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

*Last Updated: 2026-04-12*
*Phases A, B, C, D, F, G, I Complete (7 of 14)*
*Phases J, K, L in progress (evidence + spreadsheet + code remediation)*
*Phases E, H, M, N pending (GCP services, API cleanup, admin portal GCP migration, consent UI)*
*Phase L progress: 20/46 gaps fixed (G15,G17-G28,G30-G31,G35,G40,G42-G45)*
*Phase M: Admin Portal GCP-First migration — admin auth, Cloud Logging, Monitoring, SCC, IAM integration*
*Phase N: Consumer consent UI (G13/G14), legacy route migration (G37-G39), Basiq webhooks (G16)*
*Remaining P0: G1 (pen test), G2 (insurance), G29 (Cloud Scheduler — GCP Console action)*
*Admin Portal Status: FIXED (2026-04-12) — Migrated to GCP Identity Platform. Google Sign-In + MFA working.*
*GCP Services Enabled: Cloud Logging (365-day), SCC (Standard), Cloud Scheduler (CDR lifecycle), Cloud Monitoring (uptime check)*
