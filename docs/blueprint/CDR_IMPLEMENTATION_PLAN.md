# CDR Compliance Implementation Plan

**Version:** 1.1
**Created:** 2026-03-03
**Updated:** 2026-03-04
**Status:** Active — Phase C complete, continuing sequential execution
**Source:** `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md`, `CLAUDE.md` Part 13, `PHASE_34_CDR_SECURITY_HARDENING.md`
**Compliance Target:** Basiq CDR accreditation (54 requirements across 9 sections)
**Current Score:** ~55% → **~60%** (after Phase C) → Target: 90%+

---

## Progress Dashboard

| Phase | Description | Status | Completed |
|-------|-------------|--------|-----------|
| **A** | RBAC Enforcement | 🔲 Pending | — |
| **B** | MFA Enforcement | 🔲 Pending | — |
| **C** | Admin Lifecycle Management | ✅ **COMPLETE** | 2026-03-04 |
| **D** | CDR Data Lifecycle Service | 🔲 Pending | — |
| **E** | GCP Service Enablement | 🔲 Pending | — |
| **F** | Policy Documents | 🔲 Pending | — |
| **G** | Development Pipeline Hardening | 🔲 Pending | — |
| **H** | API Consolidation & Dead Code Removal | 🔲 Pending | — |

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

## PHASE A: RBAC Enforcement (Phase 34.3)

**Goal:** Migrate all ~99 user API routes from `withAuth()` to `withPermission()`
**Why:** Basiq §1.5, §1.6 — Role-based access must restrict access to CDR data
**Risk:** Medium — affects all API routes, but OWNER role has all permissions (backward compatible)
**Reference implementation:** Properties module already migrated

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

### Step A.14 — Verification & Cleanup

- Run `grep -r "withAuth(" app/api/` — confirm zero remaining bare `withAuth()` calls
- Run `npm run build` — confirm clean compilation
- Update `CDR_BASIQ_COMPLIANCE_MATRIX.md` — mark §1.5, §1.6 as DONE
- Update `PHASE_34_CDR_SECURITY_HARDENING.md` — mark Sub-Phase 34.3 as ✅ COMPLETE

---

## PHASE B: MFA Enforcement (Phase 34.4)

**Goal:** Enforce MFA on CDR data routes and admin routes
**Why:** Basiq §1.3 — MFA must be enforced, not just available
**Depends on:** Phase A (RBAC must be in place first)
**GCP-First:** Firebase MFA infrastructure already exists — no custom code for MFA itself

### Step B.1 — Create `withMFARequired()` Guard

**File:** `lib/auth/guards.ts` (extend existing)
**Logic:**
1. Check `user.mfaEnabled` — if false, return 403 with message "MFA required for this resource"
2. Check `organization.mfaEnforced` — if true and user hasn't completed MFA, block
3. Firebase handles actual MFA challenge/verification (GCP-First — no custom MFA logic)
**Basiq:** §1.3

### Step B.2 — Wire MFA Guard on Basiq/CDR Routes

**Routes:** `app/api/basiq/*` (connect, connections, sync)
**Pattern:** Wrap existing `withPermission()` with `withMFARequired()` for CDR data routes
**Basiq:** §1.3, §5.1

### Step B.3 — Wire MFA Guard on Admin Routes

**Routes:** `app/api/admin/*` (where sensitive actions occur)
**Basiq:** §1.3

### Step B.4 — Verification

- Verify MFA is enforced on all CDR data routes
- Update `CDR_BASIQ_COMPLIANCE_MATRIX.md` — mark §1.3 as DONE
- Update `PHASE_34_CDR_SECURITY_HARDENING.md` — mark Sub-Phase 34.4 as ✅ COMPLETE

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

## PHASE D: CDR Data Lifecycle Service (NEW — Phase 35)

**Goal:** Automated consent-driven CDR data management
**Why:** Basiq §5.4, §5.5, §5.6 — CDR data MUST be deleted when consent expires/is revoked
**GCP-First:** Use GCP Cloud Scheduler + Cloud Functions for automation
**This is the LARGEST compliance gap (CDR Data Handling at 30%)**

### Step D.1 — Create CDR Data Lifecycle Service

**File:** `lib/services/cdrDataLifecycle.ts` (NEW — canonical service per CLAUDE.md §12.2)
**Exports:**
- `checkConsentExpiry()` — Find all expired consents, trigger deletion
- `handleConsentRevocation(userId)` — Immediate CDR data purge for revoked consent
- `deleteCDRData(userId, reason)` — Hard-delete CDR data, audit the action
- `anonymizeCDRData(userId)` — De-identify for legal retention cases
**Basiq:** §5.4, §5.5, §5.6

### Step D.2 — Create Consent Verification Middleware

**File:** `lib/auth/guards.ts` (extend)
**Function:** `withActiveConsent()` — verify `PortalClient.consentStatus === 'GRANTED'` before returning CDR data
**Basiq:** §13.2 (CLAUDE.md)

### Step D.3 — Wire Consent Check on CDR Data Routes

**Routes:** All routes that return CDR-protected data (accounts, transactions, basiq)
**Pattern:** Add `withActiveConsent()` check alongside `withPermission()`
**Basiq:** §5.5, §5.6

### Step D.4 — GCP Cloud Scheduler — Consent Expiry Job

**GCP Service:** Cloud Scheduler + Cloud Functions (or Cloud Run job)
**Schedule:** Daily at 02:00 UTC
**Action:** Calls `checkConsentExpiry()` → deletes CDR data for expired consents → audits
**User action required:** Configure Cloud Scheduler in GCP Console (I provide the config)
**Basiq:** §5.5

### Step D.5 — Consent Revocation Handler

**Trigger:** When user revokes consent via portal
**Action:** Immediately calls `handleConsentRevocation(userId)` — purges CDR data within 24 hours
**Audit:** Logs `CDR_DATA_DELETED` with reason "consent_revoked"
**Basiq:** §5.6

### Step D.6 — CDR Data De-identification Utility

**File:** `lib/services/cdrDataLifecycle.ts` (extend)
**Function:** `anonymizeCDRData()` — strips PII from financial records for analytics/legal retention
**GCP-First:** Consider GCP Cloud DLP for automated PII detection
**Basiq:** §5.2

### Step D.7 — Create Phase 35 Blueprint Document

**File:** `docs/blueprint/PHASE_35_CDR_DATA_LIFECYCLE.md`
**Content:** Full specification for CDR data lifecycle management
**Basiq:** §5.1–5.8

### Step D.8 — Verification

- Run consent expiry simulation
- Verify data deletion auditing
- Update `CDR_BASIQ_COMPLIANCE_MATRIX.md` — mark §5.4, §5.5, §5.6 as DONE
- Update `MASTER_BLUEPRINT.md` — add Phase 35

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

## PHASE F: Policy Documents

**Goal:** Create all required policy documents for Basiq accreditation
**Why:** Basiq §4, §5.8, §7 — policy/procedural requirements for accreditation
**Note:** These are documentation-only — no code changes

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

## PHASE G: Development Pipeline Hardening

**Goal:** Automated security scanning and dependency management
**Why:** Basiq §3.4, §3.5, §6.4, §6.5
**GCP-First:** Use GitHub-native tools (Dependabot, Actions) — not custom scripts

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
Phase H (API Cleanup) ← can run in parallel ─────┘
  H.1-H.4 Dead code removal, consolidation
  H.5 Verification
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

| After Phase | Score | Key Improvements |
|-------------|-------|------------------|
| Baseline | ~55% | Initial state |
| **C (Admin) ✅** | **~60%** | **§1.7 DONE** — Admin lifecycle review (COMPLETE 2026-03-04) |
| A (RBAC) | ~68% | §1.5, §1.6 move from PARTIAL → DONE |
| A + F (Policy) | ~73% | §4.x, §7.x move from N/A → DONE |
| A + F + B (MFA) | ~78% | §1.3 moves from PARTIAL → DONE |
| + H (API Cleanup) | ~80% | Architecture quality, reduced attack surface |
| + D (CDR Lifecycle) | ~88% | §5.4, §5.5, §5.6 move from TODO → DONE |
| + E (GCP) | ~93% | §8.x items move from TODO → DONE |
| + G (Dev Pipeline) | ~95% | §6.4, §6.5 move from TODO → DONE |

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
- `docs/blueprint/CHANGELOG_YYYY_MM_DD.md` — per session
- `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` — updated after each phase
- `docs/blueprint/MASTER_BLUEPRINT.md` — updated when phase status changes

---

*Last Updated: 2026-03-04*
*Phase C Complete: 2026-03-04 (Admin Lifecycle Management)*
*Next Review: After Phase A completion (RBAC Enforcement)*
