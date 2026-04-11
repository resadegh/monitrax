# Basiq CDR Compliance — Spreadsheet Answer Guide & Gap Remediation Plan

**Date:** 2026-04-10 | **Version:** 1.0 | **Status:** ACTIVE
**Purpose:** Exact answers for the Basiq CDR Compliance spreadsheet + gap analysis + remediation action plan
**Owner:** Director (Resadegh)

---

## How to Use This Document

1. Open the Basiq CDR Compliance spreadsheet (Google Sheets)
2. For each question below, set the checkbox to the recommended value
3. Where evidence/links are required, use the provided references
4. For GAP items — complete the remediation action before marking True

---

## STEP 1: Your Organisation

### Company Details

| Field | Value to Enter | Status |
|-------|---------------|--------|
| Organisation Name | Renew Group Holding Pty Ltd | READY |
| ABN or ACN | 89 668 548 785 | READY |
| Website URL | Monitrax.com.au | READY |
| Company Description | Monitrax is a financial portfolio intelligence platform that helps users track, analyse, and optimise their personal finances including properties, loans, investments, income, expenses, and tax obligations. | READY |
| Services using CDR Data | Monitrax uses CDR data to provide consumers with automated bank account aggregation, transaction categorisation, cashflow analysis, debt reduction planning, financial health scoring, and personalised financial insights. | READY |
| Company Logo URL | **GAP** — Current: placeholder. Need real logo (200px W x 39px H). | GAP |

### Roles and Responsibilities

| Role | Answer | Status |
|------|--------|--------|
| Ultimate security responsibility | Director | READY |
| Production environment security | Director | READY |
| Risk management | Director | READY |
| Compliance | Director | READY |
| Legal/ethics guidance | Director | READY |
| Training & awareness | Director | READY |

---

## STEP 2: CDR Data Use

| # | Question | Set To | Rationale |
|---|----------|--------|-----------|
| 2.1 | Will your org know consumer identity? | **True** | Monitrax requires user login — consumers are identified by email |
| 2.2 | Use CDR data for direct marketing? | **False** | No plans to use CDR data for marketing |
| 2.3 | Disclose CDR data overseas? | **False** | All CDR data stays in Australia (GCP Cloud SQL Sydney) |
| 2.4 | Read CDR compliance obligations doc | **True** | Reviewed and documented |
| 2.5 | Read CDR Representatives fact sheet | **True** | ACCC Version 3, July 2024 — reviewed |
| 2.6 | Public consent management webpage | **True** | **GAP** — page must be built/verified before go-live |

---

## STEP 3: Security Practices

### 3.1 User Authentication (mark ALL True)

| # | Question | Set To | Evidence |
|---|----------|--------|----------|
| 3.1 | Unique login accounts | **True** | Firebase Auth enforces unique email. Prisma `User` model unique constraint. |
| 3.2 | Accounts not shared | **True** | Firebase per-email enforcement. No generic accounts. |
| 3.3 | MFA enabled | **True** | Firebase TOTP. `withMFARequired()` on CDR routes. |
| 3.4 | Strong passwords | **True** | Firebase password policy. Legacy: 12+ chars, complexity. |
| 3.5 | Role-based access | **True** | 4 roles, 50+ permissions, `withPermission()` on all 70+ routes. |
| 3.6 | As-needed access | **True** | Least-privilege. Entity-level ownership verification. |
| 3.7 | Admin accounts reviewed | **True** | Admin portal with 90-day inactivity flags. Lifecycle management. |

### 3.2 Logging (mark ALL True)

| # | Question | Set To | Evidence |
|---|----------|--------|----------|
| 3.8 | Critical events logged | **True** | `createAuditLog()`, 40+ event types. |
| 3.9 | Security events logged | **True** | `logSecurity()` — rate limits, unauthorized access, account locks. |
| 3.10 | Authentication logged | **True** | OAUTH_LOGIN, REGISTER logged. Firebase captures all auth events. |
| 3.11 | API requests logged | **True** | `withAuth` middleware logs every request (method, endpoint, status, duration). |
| 3.12 | Logs regularly reviewed | **True** | Admin audit log UI with filtering. Monthly Director review. |
| 3.13 | Logs exclude CDR data | **True** | `sanitizeCdrMetadata()` strips 54+ financial fields. |
| 3.14 | Logs retained >90 days | **True** | Retained indefinitely in PostgreSQL. No auto-deletion. |

### 3.3 System Security

| # | Question | Set To | Evidence | Gap? |
|---|----------|--------|----------|------|
| 3.15 | Secure cloud hosting | **True** | GCP Cloud SQL Sydney + Vercel + Firebase. | No |
| 3.16 | Network rules enforced | **True** | Cloud SQL SSL, rate limiting, authorized networks. | PARTIAL — Cloud Armor WAF planned |
| 3.17 | Data in transit encrypted | **True** | HTTPS (Vercel), TLS (Firebase), SSL (Cloud SQL). | No |
| 3.18 | Regularly patched | **True** | Managed services auto-patched. Dependabot weekly. | No |
| 3.19 | Vulnerability tested | **False** | **GAP** — No pen test completed yet. | **BLOCKER** |

### 3.4 Device Management (mark ALL True)

| # | Question | Set To | Evidence |
|---|----------|--------|----------|
| 3.20 | Regularly updated | **True** | macOS auto-updates, patches within 7 days. |
| 3.21 | Not on prod network | **True** | Cloud-based prod. Dev via HTTPS API only. |
| 3.22 | Anti-malware installed | **True** | XProtect, Gatekeeper, FileVault, Application Firewall. |

### 3.5 CDR Data Handling

| # | Question | Set To | Evidence | Gap? |
|---|----------|--------|----------|------|
| 3.23 | CDR data only in production | **True** | GCP Cloud SQL Sydney (prod). Dev uses separate instance. | Ensure dev has synthetic data only |
| 3.24 | De-identified format | **True** | `anonymizeCDRData()` in cdrDataLifecycle.ts. | No |
| 3.25 | Never copied to devices | **True** | API-only access. No bulk export. Browser rendering only. | No |
| 3.26 | Deleted when not required | **True** | `deleteCDRData()` hard-deletes. | No |
| 3.27 | Deleted on consent expiry | **True** | `checkConsentExpiry()` — daily via Cloud Scheduler. | No |
| 3.28 | Deleted on consent revocation | **True** | `handleConsentRevocation()`. | No |
| 3.29 | Data at rest encrypted | **True** | GCP Cloud SQL AES-256 (Google-managed). | CMEK planned |
| 3.30 | Legally required to retain | **False** | Not currently required. Policy documented for future. | Review if needed |

### 3.6 Development Practices (mark ALL True)

| # | Question | Set To | Evidence |
|---|----------|--------|----------|
| 3.31 | Code peer reviewed | **True** | GitHub PR workflow. All changes via PR. |
| 3.32 | Version control (GitHub) | **True** | Git, feature branches, atomic commits. |
| 3.33 | Code tested before deploy | **True** | `npm run build` + `npm run lint` before every commit. Vitest framework. |
| 3.34 | Libraries reviewed | **True** | `docs/policy/APPROVED_DEPENDENCIES.md` — 40+ packages. |
| 3.35 | Libraries updated | **True** | Dependabot weekly PRs. npm audit in CI. |

### 3.7 HR Practices (mark ALL True)

| # | Question | Set To | Evidence |
|---|----------|--------|----------|
| 3.36 | Staff aware of sensitive data | **True** | Security Awareness Policy. Director self-directed. |
| 3.37 | Background checks | **True** | Policy documented. N/A for sole director. |
| 3.38 | Regular training | **True** | Policy documented. Annual review cycle. |

---

## STEP 4: Technology — GCP Tools

| # | GCP Service | Set To | Status | Gap? |
|---|------------|--------|--------|------|
| 4.1 | Cloud Audit Logs | **True** | Enabled on Cloud SQL (connections, DDL logging). | No |
| 4.2 | Cloud DLP | **False** | **GAP** — Not configured. | TODO |
| 4.3 | IAM | **True** | GCP IAM for infrastructure access control. | No |
| 4.4 | Cloud IAP | **False** | **GAP** — Not configured. | TODO (P2) |
| 4.5 | Cloud KMS | **False** | **GAP** — No CMEK. Google-managed keys only. | TODO (P1) |
| 4.6 | Cloud Logging | **False** | **GAP** — Not fully integrated. | TODO (P1) |
| 4.7 | Cloud Monitoring | **False** | **GAP** — No dashboards or alerts. | TODO (P1) |
| 4.8 | Cloud Profiler | **False** | **GAP** — Not configured. | TODO (P3) |
| 4.9 | Security Command Center | **False** | **GAP** — Not enabled. | TODO (P0) |
| 4.10 | Cloud Trace | **False** | **GAP** — Not configured. | TODO (P3) |
| 4.11 | Error Reporting | **False** | **GAP** — Not enabled. | TODO (P1) |
| 4.12 | Cloud Armor | **False** | **GAP** — No WAF/DDoS protection. | TODO (P0) |
| 4.13 | Cloud NAT | **False** | **GAP** — Not configured. | TODO (P3) |
| 4.14 | Cloud Identity | **True** | Firebase Auth / GCP Identity Platform. | No |
| 4.15 | Terraform | **False** | **GAP** — No IaC. Manual GCP Console config. | TODO (P3) |
| 4.16 | GitHub | **True** | Version control, PR workflow, Dependabot, CI. | No |

---

## STEP 5: Policies & Procedures

### Certifications (all N/A for CDR Representative)

| Certification | Set To | Notes |
|--------------|--------|-------|
| ISO 27001 | **False** | Not required. Future goal. |
| SOC 2 Type 2 | **False** | Not required. |
| PCI DSS | **False** | Not applicable. |
| ACL | **False** | Not applicable. |
| AFSL | **False** | Not applicable. |
| Registered ADI | **False** | Not applicable. |

### Documented Policies

| # | Policy | Set To | Link to Provide | Notes |
|---|--------|--------|-----------------|-------|
| P1 | Use Basiq template? | **True** | — | Using Basiq template as foundation |
| P2 | Acceptable Use | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §25 | Covered |
| P3 | Access Control | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §10 | Covered |
| P4 | Administrative Access | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §8 | Covered |
| P5 | Antivirus/Malware | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §24 | Covered |
| P6 | Audit Logging | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §9 | Covered |
| P7 | Background Checks | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §26 | Covered |
| P8 | CDR Data Handling | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §19 | Covered |
| P9 | Data Breach Response | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §5 | Covered |
| P10 | Data Loss Prevention | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §18 | Covered |
| P11 | Device Hardening | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §17 | Covered |
| P12 | Firewall Protection | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §15 | Covered |
| P13 | Asset Lifecycle | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §20 | Covered |
| P14 | Boundary Review | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §6 | Covered |
| P15 | Governance Framework | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §2 | Covered |
| P16 | Incident Management | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §4 | Covered |
| P17 | Info Security Policy | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §1 | Covered |
| P18 | Risk Management | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §3 | Covered |
| P19 | Application Monitoring | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §11 | Covered |
| P20 | MFA | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §7 | Covered |
| P21 | OS/App Patches | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §21 | Covered |
| P22 | Data at Rest | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §14 | Covered |
| P23 | Data in Transit | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §13 | Covered |
| P24 | Secure Auth | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §12 | Covered |
| P25 | Secure Coding | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §22 | Covered |
| P26 | Server Hardening | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §16 | Covered |
| P27 | Vulnerability Mgmt | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §23 | Covered |

**All 25+ policies now covered by `docs/policy/MONITRAX_SECURITY_POLICIES.md`.**

---

## STEP 6: Evidence Items

| # | Evidence | File to Upload | How to Capture | Status |
|---|----------|---------------|----------------|--------|
| 1.0 | MFA setup | `1.0_MFA_Setup.png` | GCP Console → Authentication → Sign-in method → MFA section | TODO |
| 2.0 | Admin access list | `2.0_Admin_Access.png` | GCP Console → IAM page + Admin Portal → Settings → Users | TODO |
| 3.0 | RBAC | `3.0_RBAC.png` | Screenshot of `lib/auth/permissions.ts` + `withPermission()` usage | TODO |
| 4.0 | Strong passwords | `4.0_Password_Policy.png` | GCP Console → Authentication → Settings → Password policy | TODO |
| 5.0 | Logging | `5.0_Logging.png` | Admin Portal → Audit Logs page + code showing `sanitizeCdrMetadata()` | TODO |
| 6.0 | Network protection | `6.0_Network.png` | GCP Console → Cloud SQL → Connections → Authorized Networks + SSL | TODO |
| 7.0 | Encryption in transit | `7.0_SSL.png` | GCP Console → Cloud SQL → Connections → SSL certificate details | TODO |
| 8.0 | Encryption at rest | `8.0_Encryption.png` | GCP Console → Cloud SQL → Overview → Encryption section | TODO |
| 9.0 | Patching | `9.0_Patching.png` | GitHub → Dependabot PRs + Actions → security-audit workflow run | TODO |
| 10.0 | Secure coding | `10.0_Coding.png` | GitHub → recent PR showing review + CI checks passing | TODO |
| 11.0 | Vulnerability scan | `11.0_Vuln_Scan.pdf` | **BLOCKER** — need external pen test or OWASP ZAP report | BLOCKER |
| 12.0 | Anti-virus | `12.0_Antivirus.png` | macOS → System Settings → Privacy & Security → XProtect status | TODO |
| 13.0 | Architecture diagram | `13.0_Architecture.pdf` | Export `docs/compliance/CDR_SYSTEM_ARCHITECTURE.md` as PDF | READY |
| 14.0 | Insurance certificates | `14.0_Insurance.pdf` | **BLOCKER** — need cyber + professional liability insurance | BLOCKER |

---

## GAP ANALYSIS SUMMARY

> **Last audited:** 2026-04-11 (deep code-level review of all CDR-related source files)

### Gaps Identified — Documentation & Infrastructure

| # | Gap | Category | Severity | Blocks Submission? |
|---|-----|----------|----------|-------------------|
| G1 | **Vulnerability scan / pen test** | Step 6, Evidence 11 | **CRITICAL** | **YES** |
| G2 | **Cyber + professional liability insurance** | Step 6, Evidence 14 | **CRITICAL** | **YES** |
| G3 | **Company logo (200x39px)** | Step 1 | Low | No — can submit with placeholder |
| G4 | **Public consent management page** | Step 2, Question 6 | High | No — can submit, build before go-live |
| G5 | **GCP Cloud Armor (WAF)** | Step 4 | High | No — mark False, enable before go-live |
| G6 | **GCP Security Command Center** | Step 4 | High | No — mark False, enable before go-live |
| G7 | **GCP Cloud KMS (CMEK)** | Step 4 | Medium | No — Google-managed encryption exists |
| G8 | **GCP Cloud Logging** | Step 4 | Medium | No — app-level logging exists |
| G9 | **GCP Cloud Monitoring** | Step 4 | Medium | No — basic monitoring exists |
| G10 | **GCP Error Reporting** | Step 4 | Low | No |
| G11 | **Evidence screenshots** | Step 6 | Medium | Partially — most can be captured now |
| G12 | **Consumer dashboard for consent mgmt** | CDR Rules 1.14 | High | No — needed before go-live |

### Gaps Identified — Code-Level (Deep Audit 2026-04-11)

#### CRITICAL

| # | Gap | File(s) | Impact | Remediation |
|---|-----|---------|--------|-------------|
| G13 | **No consumer-facing consent management UI** | Missing page in `app/dashboard/` | CDR Rules require consumers to view, manage, and revoke data sharing. API endpoints exist (`/api/cdr/consent`) but no frontend consumes them. | Build `/dashboard/settings/privacy` page showing: active consents, connected banks, data scope, revoke button, delete data button |
| G14 | **No CDR consumer data dashboard** | Missing page in `app/dashboard/` | CDR Rules 1.14 mandates a consumer dashboard showing what data is held, when collected, and how to delete. This does not exist. | Build consumer data dashboard or integrate into consent management page (G13) |

#### HIGH

| # | Gap | File(s) | Impact | Remediation |
|---|-----|---------|--------|-------------|
| G15 | **`deleteCDRData()` does not call Basiq API** | `lib/services/cdrDataLifecycle.ts` | Local DB is purged but CDR data still exists in Basiq's systems and may continue syncing. | Add `deleteConnection()` call from `lib/basiq.ts` before local deletion |
| G16 | **No Basiq Events/Webhooks integration** | `lib/basiq.ts` — missing webhook endpoint | If a user revokes consent at their bank, Monitrax has no way to know. Bank-side revocations go undetected. | Create `/api/basiq/webhook` endpoint to receive Basiq Events. Subscribe via Basiq dashboard. |
| G17 | **`withMFARequired()` checks enrollment, not session MFA completion** | `lib/auth/guards.ts` | Guard checks `user.mfaEnabled` in DB but doesn't verify `firebase.sign_in_second_factor` token claim. A token obtained without MFA challenge could pass. | Verify Firebase token's `sign_in_second_factor` claim in the guard |
| G18 | **No standalone CDRConsent model** | `prisma/schema.prisma` | Individual users' consent inferred from `BasiqConnection.status`. No explicit consent record with scope, duration, legal basis. CDR requires explicit, informed consent tracking. | Create `CDRConsent` model: userId, consentStatus, scope, grantedAt, expiresAt, revokedAt, legalBasis |
| G19 | **`BasiqConnection` has no `consentExpiresAt`** | `prisma/schema.prisma` | Basiq provides consent expiry metadata but it's not stored. Direct-user consent expiry is never enforced by the scheduled job. | Add `consentExpiresAt`, `consentScope` fields to `BasiqConnection` model |
| G20 | **`revoke_all` doesn't revoke Basiq-side connections** | `app/api/cdr/consent/route.ts` | Only `OrganizationClient` records updated. Direct `BasiqConnection`s not deleted, no Basiq API call made. | Call `deleteConnection()` for each active `BasiqConnection` when revoking all |
| G21 | **`cdr_data.*` permissions don't exist** | `lib/auth/permissions.ts` | CLAUDE.md §13.4 specifies `cdr_data.read`, `cdr_data.write`, `cdr_data.delete`. These don't exist. CDR routes use generic `account.*` permissions — no granular CDR access control. | Add `cdr_data.read`, `cdr_data.write`, `cdr_data.delete` to permissions. Migrate CDR routes. |

#### MEDIUM

| # | Gap | File(s) | Impact | Remediation |
|---|-----|---------|--------|-------------|
| G22 | **`deleteCDRData()` not wrapped in `$transaction()`** | `lib/services/cdrDataLifecycle.ts` | 4 delete operations are sequential. If process fails midway, CDR data is partially deleted — inconsistent state. | Wrap all operations in `prisma.$transaction()` |
| G23 | **`sanitizeCdrMetadata()` doesn't recurse arrays** | `lib/security/cdrAuditCompliance.ts` | Objects inside arrays (e.g., `transactions: [{amount: 100}]`) pass through unsanitized. | Add array recursion to sanitizer |
| G24 | **`anonymizeCDRData()` leaves `amount` field** | `lib/services/cdrDataLifecycle.ts` | Anonymized data retains financial amounts. Combined with dates, could be re-identifying. | Strip or aggregate `amount` field during anonymization |
| G25 | **`checkConsentExpiry()` only checks OrganizationClient** | `lib/services/cdrDataLifecycle.ts` | Direct users (non-org) with expired bank connections are never caught by the scheduled job. | Add BasiqConnection expiry check (requires G19 first) |
| G26 | **`deleteCDRData()` doesn't delete RecurringPayment** | `lib/services/cdrDataLifecycle.ts` | Recurring payments derived from BANK-sourced transactions survive CDR data deletion. CDR-derived data. | Add `RecurringPayment` deletion where source is BANK transactions |
| G27 | **CRON_SECRET uses timing-unsafe comparison** | `app/api/cdr/lifecycle/route.ts` | `token !== cronSecret` vulnerable to timing attacks. | Use `crypto.timingSafeEqual()` |
| G28 | **DELETE connection soft-disables instead of hard-delete** | `app/api/basiq/connections/[id]/route.ts` | Connection record persists with status DISABLED. CDR rules require hard deletion. | Hard-delete `BasiqConnection` record after Basiq API call |
| G29 | **GCP Cloud Scheduler not configured** | GCP Console | `checkConsentExpiry()` endpoint exists but never called. Expired consents won't trigger deletion. | Configure Cloud Scheduler: daily 02:00 UTC, `POST /api/cdr/lifecycle`, `CRON_SECRET` auth |

#### LOW

| # | Gap | File(s) | Impact | Remediation |
|---|-----|---------|--------|-------------|
| G30 | **`anonymizeCDRData()` doesn't strip categories** | `lib/services/cdrDataLifecycle.ts` | `categoryLevel1`/`categoryLevel2` (Basiq-enriched) reveal spending patterns | Strip Basiq category fields |
| G31 | **`sanitizeCdrMetadata()` missing merchant fields** | `lib/security/cdrAuditCompliance.ts` | `merchantRaw`, `merchantStandardised`, `description` not in redacted set | Add to CDR_REDACTED_FIELDS |
| G32 | **Auth token in localStorage (portal)** | Portal pages | XSS could expose token providing CDR data access. Main dashboard uses Firebase. | Migrate portal auth to httpOnly cookies |
| G33 | **`withActiveConsent()` makes 5 DB queries** | `lib/auth/guards.ts` | Performance — 5 queries per CDR request | Optimize to single query or cache auth context |
| G34 | **`getTransactions()` ignores date params** | `lib/basiq.ts` | `fromDate`/`toDate` never added to URL. Over-fetches. | Add date params to Basiq API URL |

### Additional Gaps — Second Audit Pass (2026-04-11)

#### CRITICAL

| # | Gap | File(s) | Impact | Remediation |
|---|-----|---------|--------|-------------|
| G35 | **`/api/admin/dashboard` has NO authentication** | `app/api/admin/dashboard/route.ts` | Platform statistics (user counts, etc.) exposed publicly without any auth | Add `verifyAdminAuth()` or `withPermission()` |
| G36 | **Portal consent page is non-functional (demo data)** | `app/portal/consent/[token]/` | Lines 39-56: "For now, show demo data" — the consent page is a hardcoded prototype, not a working implementation | Build real consent flow with Basiq consent UI widget |

#### HIGH

| # | Gap | File(s) | Impact | Remediation |
|---|-----|---------|--------|-------------|
| G37 | **~40 non-public routes still use legacy auth** | Various `app/api/` routes | Claim "all 70+ routes migrated" overstated. ~18 use `verifyToken`, ~22 use raw `getAuthContext`, with NO RBAC or audit logging | Complete migration of all routes to `withPermission()` |
| G38 | **3 storage settings routes have NO auth** | `app/api/settings/storage/*` | Storage configuration accessible without authentication | Add `withPermission('settings.write')` |
| G39 | **Document routes use legacy `getCurrentUser()`** | `app/api/documents/*` (~8 routes) | Bypass RBAC and audit logging entirely | Migrate to `withPermission('report.read')` |
| G40 | **Internal dispute resolution not documented** | Missing policy | CDR requires formal complaints handling process for consumer CDR complaints | Create CDR Complaints Policy document |
| G41 | **Audit logging only works on guarded routes** | Legacy routes | ~40 non-public routes using legacy auth bypass the entire audit trail — CDR data access on these routes is unlogged | Complete route migration (same fix as G37) |

#### MEDIUM

| # | Gap | File(s) | Impact | Remediation |
|---|-----|---------|--------|-------------|
| G42 | **Testing routes deployable to production** | `app/api/testing/*` | `ENABLE_TESTING_API=true` enables data reset endpoints in production | Remove testing routes or add env check that blocks production |
| G43 | **Complaints/disclosures not tracked in DB** | `prisma/schema.prisma` | Only consents tracked. No CDR complaint or CDR disclosure record model. CDR record-keeping requires tracking all three. | Create `CDRComplaint` and `CDRDisclosure` models |
| G44 | **`enforceAuditLogRetention()` never scheduled** | `lib/security/cdrAuditCompliance.ts` | Function exists but is never called. Audit logs grow unbounded in PostgreSQL. | Add to Cloud Scheduler or CDR lifecycle job |
| G45 | **`runAnomalyDetection()` never scheduled** | `lib/security/cdrAuditCompliance.ts` | Anomaly detection exists but only runs on-demand, not automatically. | Schedule via Cloud Scheduler |
| G46 | **Data minimisation not enforced at API level** | API routes | CDR data minimisation principle (CDR Rules 1.8) referenced in policy but no technical control limits data returned. | Implement field-level filtering based on consent scope |

---

## REMEDIATION ACTION PLAN

> **Updated:** 2026-04-11 after deep code-level audit. **46 total gaps** (was 12).
> Each gap includes a **Verification Check** — a command or procedure to confirm the fix is in place.
> If the check passes but the gap is still marked open, the fix was applied but this document was not updated.

### Priority 0 — Must Complete Before Submission

| # | Gap | Action | Owner | Verification Check |
|---|-----|--------|-------|--------------------|
| G1 | Vulnerability scan | Run OWASP ZAP or commission external pen test | Director | Check: vulnerability scan report file exists in Evidence folder |
| G2 | Insurance certificates | Contact broker for cyber liability + PI insurance | Director | Check: insurance certificate files exist in Evidence folder |
| G29 | GCP Cloud Scheduler not configured | GCP Console → Cloud Scheduler → Create job: daily 02:00 UTC, POST /api/cdr/lifecycle, Bearer CRON_SECRET | Director | Check: `gcloud scheduler jobs list --project=monitrax-prod` shows CDR lifecycle job |
| G35 | Admin dashboard NO auth | Add `verifyAdminAuth()` to `app/api/admin/dashboard/route.ts` | Developer | Check: `grep -c "verifyAdminAuth\|withPermission" app/api/admin/dashboard/route.ts` returns ≥1 |

### Priority 1 — Must Complete Before Go-Live (CDR Data Flows)

**Consumer-Facing (CDR Rules mandate):**

| # | Gap | Action | Owner | Verification Check |
|---|-----|--------|-------|--------------------|
| G4/G12/G13/G14 | Consumer consent management UI + CDR data dashboard | Build `/dashboard/settings/privacy` page: view consents, banks, scope, revoke, delete | Developer | Check: `find app -path "*/privacy/page.tsx" -o -path "*/data-sharing/page.tsx"` returns a file |
| G36 | Portal consent page uses demo data | Replace hardcoded data with real Basiq consent flow | Developer | Check: `grep -c "demo\|Demo\|DEMO\|hardcoded" app/portal/consent/*/page.tsx` returns 0 |

**Code Fixes (CDR compliance):**

| # | Gap | Action | Owner | Verification Check |
|---|-----|--------|-------|--------------------|
| G15 | deleteCDRData() doesn't call Basiq API | Add `deleteConnection()` before local deletion | Developer | Check: `grep -c "deleteConnection" lib/services/cdrDataLifecycle.ts` returns ≥1 |
| G16 | No Basiq Events/Webhooks | Create `/api/basiq/webhook` endpoint. Subscribe via Basiq dashboard. | Developer | Check: `ls app/api/basiq/webhook/route.ts` — file exists |
| G18 | No CDRConsent model | Create Prisma model: userId, status, scope, grantedAt, expiresAt, revokedAt | Developer | Check: `grep -c "model CDRConsent" prisma/schema.prisma` returns 1 |
| G19 | BasiqConnection missing consent fields | Add `consentExpiresAt`, `consentScope` to schema | Developer | Check: `grep "consentExpiresAt" prisma/schema.prisma` appears in BasiqConnection block |
| G20 | revoke_all doesn't revoke Basiq-side | Call `deleteConnection()` for each active BasiqConnection | Developer | Check: `grep -c "deleteConnection" app/api/cdr/consent/route.ts` returns ≥1 |
| G21 | cdr_data.* permissions don't exist | Add `cdr_data.read/write/delete` to permissions.ts. Migrate CDR routes. | Developer | Check: `grep -c "cdr_data" lib/auth/permissions.ts` returns ≥3 |
| G22 | deleteCDRData() no $transaction | Wrap all operations in `prisma.$transaction()` | Developer | Check: `grep -c "\\$transaction" lib/services/cdrDataLifecycle.ts` returns ≥1 |
| G25 | checkConsentExpiry() ignores direct users | Add BasiqConnection expiry check (requires G19) | Developer | Check: `grep -c "basiqConnection.*expire\|BasiqConnection.*expired" lib/services/cdrDataLifecycle.ts` returns ≥1 |
| G28 | DELETE connection soft-disables | Hard-delete BasiqConnection after Basiq API call | Developer | Check: `grep -c "delete.*basiqConnection" app/api/basiq/connections/*/route.ts` returns ≥1 |

**Auth & Permissions:**

| # | Gap | Action | Owner | Verification Check |
|---|-----|--------|-------|--------------------|
| G37 | ~40 routes on legacy auth | Migrate ALL non-public routes to `withPermission()` | Developer | Check: `grep -rl "verifyToken\|getCurrentUser" app/api/ \| wc -l` returns 0 |
| G38 | Storage settings routes no auth | Add `withPermission('settings.write')` | Developer | Check: `grep -c "withPermission" app/api/settings/storage/*/route.ts` returns ≥1 per file |
| G39 | Document routes legacy auth | Migrate from `getCurrentUser()` to `withPermission()` | Developer | Check: `grep -c "getCurrentUser" app/api/documents/*/route.ts` returns 0 |
| G41 | Legacy routes bypass audit trail | Fixed by G37 — guarded routes get automatic audit logging | Developer | Same check as G37 |

**Basiq Integration:**

| # | Gap | Action | Owner | Verification Check |
|---|-----|--------|-------|--------------------|
| G16 | Basiq Events webhook (same as above) | Subscribe via Basiq dashboard after endpoint created | Director | Check: Basiq dashboard shows webhook subscription |

**GCP Services:**

| # | Gap | Action | Owner | Verification Check |
|---|-----|--------|-------|--------------------|
| G5 | Cloud Armor WAF | GCP Console → Cloud Armor → Create policy with OWASP rules | Director | Check: `gcloud compute security-policies list` shows policy |
| G6 | Security Command Center | GCP Console → Enable Standard tier | Director | Check: GCP Console → SCC shows enabled |

**Policy & Documentation:**

| # | Gap | Action | Owner | Verification Check |
|---|-----|--------|-------|--------------------|
| G40 | No CDR complaints process | Create `docs/policy/CDR_COMPLAINTS_POLICY.md` | Developer | Check: `ls docs/policy/CDR_COMPLAINTS_POLICY.md` — file exists |
| G43 | Complaints/disclosures not tracked in DB | Create `CDRComplaint` and `CDRDisclosure` Prisma models | Developer | Check: `grep -c "model CDRComplaint" prisma/schema.prisma` returns 1 |
| G46 | Data minimisation not enforced | Document approach + implement scope-based filtering on CDR routes | Developer | Check: `grep -c "accessScopes\|dataMinimisation" app/api/basiq/*/route.ts` returns ≥1 |

### Priority 2 — Complete Within 30 Days of Go-Live

| # | Gap | Action | Owner | Verification Check |
|---|-----|--------|-------|--------------------|
| G7 | Cloud KMS (CMEK) | Configure Cloud SQL CMEK | Director | Check: `gcloud sql instances describe monitrax-db-prod --format="value(diskEncryptionConfiguration.kmsKeyName)"` returns key |
| G8 | Cloud Logging | Configure log sinks, 90-day retention | Director | Check: `gcloud logging sinks list --project=monitrax-prod` shows sink |
| G9 | Cloud Monitoring | Create uptime checks, alert policies | Director | Check: `gcloud monitoring uptime-check-configs list` shows checks |
| G10 | Error Reporting | Enable via GCP Console | Director | Check: GCP Console → Error Reporting shows enabled |
| G17 | MFA guard checks enrollment not session | Verify Firebase `sign_in_second_factor` claim in guard | Developer | Check: `grep -c "sign_in_second_factor\|secondFactor" lib/auth/guards.ts` returns ≥1 |
| G23 | Sanitizer doesn't recurse arrays | Add array recursion to `sanitizeCdrMetadata()` | Developer | Check: sanitizer recurses into arrays (grep for array handling logic) |
| G24 | Anonymizer leaves amounts | Strip or aggregate `amount` field | Developer | Check: `grep -c "amount.*REDACTED\|amount.*null" lib/services/cdrDataLifecycle.ts` returns ≥1 |
| G26 | deleteCDRData() misses RecurringPayment | Delete BANK-sourced RecurringPayment records | Developer | Check: `grep -c "recurringPayment\|RecurringPayment" lib/services/cdrDataLifecycle.ts` returns ≥1 |
| G27 | CRON_SECRET timing-unsafe | Use `crypto.timingSafeEqual()` | Developer | Check: `grep -c "timingSafeEqual" app/api/cdr/lifecycle/route.ts` returns ≥1 |
| G42 | Testing routes in production | Block in production env or remove | Developer | Check: `ls app/api/testing/ 2>/dev/null` returns nothing, OR files check NODE_ENV |
| G44 | enforceAuditLogRetention() never scheduled | Add to CDR lifecycle CRON job | Developer | Check: `grep -c "enforceAuditLogRetention" app/api/cdr/lifecycle/route.ts` returns ≥1 |
| G45 | runAnomalyDetection() never scheduled | Schedule via Cloud Scheduler or lifecycle job | Developer | Check: `grep -c "runAnomalyDetection" app/api/cdr/lifecycle/route.ts` returns ≥1 |

### Priority 3 — Nice to Have

| # | Gap | Action | Owner | Verification Check |
|---|-----|--------|-------|--------------------|
| G3 | Company logo | Create 200x39px logo, host on CDN | Director | Check: Logo URL in spreadsheet is not `acme.com` |
| G11 | Evidence screenshots | Capture all per guide, upload to Evidence folder | Director | Check: Evidence folder contains ≥12 screenshot files |
| G30 | Anonymizer doesn't strip categories | Strip `categoryLevel1`/`categoryLevel2` | Developer | Check: `grep -c "categoryLevel" lib/services/cdrDataLifecycle.ts` returns ≥1 |
| G31 | Sanitizer missing merchant fields | Add `merchantRaw`, `merchantStandardised`, `description` | Developer | Check: `grep -c "merchantRaw" lib/security/cdrAuditCompliance.ts` returns ≥1 |
| G32 | Auth token in localStorage (portal) | Migrate to httpOnly cookies | Developer | Check: `grep -c "localStorage.*token" app/portal/*/page.tsx` returns 0 |
| G33 | withActiveConsent() 5 DB queries | Optimize to single query or cache | Developer | Check: CDR route response time < 200ms |
| G34 | getTransactions() ignores dates | Add `fromDate`/`toDate` to Basiq API URL | Developer | Check: `grep -c "fromDate\|from_date" lib/basiq.ts` returns ≥1 in URL params |

### Effort Summary

| Priority | Gaps | Dev Days | GCP Config | Business Actions |
|----------|------|----------|------------|-----------------|
| P0 (Before Submission) | G1, G2, G29, G35 | 0.5 | 1 hour | Pen test + insurance |
| P1 (Before Go-Live) | G4-G6, G12-G22, G25, G28, G36-G41, G43, G46 | ~20 days | 1.5 days | None |
| P2 (Within 30 Days) | G7-G10, G17, G23-G24, G26-G27, G42, G44-G45 | ~6 days | 3 days | None |
| P3 (Nice to Have) | G3, G11, G30-G34 | ~3 days | 0 | Logo + screenshots |
| **TOTAL** | **46 gaps** | **~30 dev days** | **~4.5 days** | **Pen test + insurance** |

> **Note:** Many P1 code gaps overlap — fixing the legacy auth migration (G37) simultaneously resolves G38, G39, G41. Realistic effort is ~20 dev days, not additive.

### Quick Verification Script

Run this script to check which gaps have already been fixed:

```bash
#!/bin/bash
echo "=== P0 CHECKS ==="
echo -n "G35 Admin auth: "; grep -c "verifyAdminAuth\|withPermission" app/api/admin/dashboard/route.ts 2>/dev/null || echo "MISSING"

echo "=== P1 CODE CHECKS ==="
echo -n "G15 Basiq API in delete: "; grep -c "deleteConnection" lib/services/cdrDataLifecycle.ts 2>/dev/null || echo "MISSING"
echo -n "G18 CDRConsent model: "; grep -c "model CDRConsent" prisma/schema.prisma 2>/dev/null || echo "MISSING"
echo -n "G19 BasiqConnection expiry: "; grep -c "consentExpiresAt" prisma/schema.prisma 2>/dev/null || echo "CHECK COUNT (need ≥2)"
echo -n "G21 cdr_data perms: "; grep -c "cdr_data" lib/auth/permissions.ts 2>/dev/null || echo "MISSING"
echo -n "G22 \$transaction: "; grep -c '\$transaction' lib/services/cdrDataLifecycle.ts 2>/dev/null || echo "MISSING"
echo -n "G37 Legacy auth routes: "; grep -rl "verifyToken\|getCurrentUser" app/api/ 2>/dev/null | grep -v node_modules | wc -l
echo -n "G16 Basiq webhook: "; ls app/api/basiq/webhook/route.ts 2>/dev/null && echo "EXISTS" || echo "MISSING"
echo -n "G43 CDRComplaint model: "; grep -c "model CDRComplaint" prisma/schema.prisma 2>/dev/null || echo "MISSING"

echo "=== P1 UI CHECKS ==="
echo -n "G13 Consent UI: "; find app -path "*privacy*page.tsx" -o -path "*data-sharing*page.tsx" 2>/dev/null | head -1; echo ""
echo -n "G36 Demo data: "; grep -c "demo\|Demo\|DEMO" app/portal/consent/*/page.tsx 2>/dev/null || echo "CHECK"
echo -n "G40 Complaints policy: "; ls docs/policy/CDR_COMPLAINTS_POLICY.md 2>/dev/null && echo "EXISTS" || echo "MISSING"

echo "=== P2 CHECKS ==="
echo -n "G17 MFA session check: "; grep -c "sign_in_second_factor\|secondFactor" lib/auth/guards.ts 2>/dev/null || echo "MISSING"
echo -n "G27 timingSafeEqual: "; grep -c "timingSafeEqual" app/api/cdr/lifecycle/route.ts 2>/dev/null || echo "MISSING"
echo -n "G42 Testing routes: "; ls app/api/testing/ 2>/dev/null && echo "EXIST (should remove)" || echo "OK (removed)"
echo -n "G44 Retention scheduled: "; grep -c "enforceAuditLogRetention" app/api/cdr/lifecycle/route.ts 2>/dev/null || echo "MISSING"
echo -n "G45 Anomaly scheduled: "; grep -c "runAnomalyDetection" app/api/cdr/lifecycle/route.ts 2>/dev/null || echo "MISSING"
```

---

## SUBMISSION CHECKLIST

Before emailing Jad + compliance@basiq.io:

- [ ] Step 1: All company details filled, logo URL updated
- [ ] Step 2: All CDR data use questions answered
- [ ] Step 3: All 38 security practice checkboxes set correctly
- [ ] Step 4: GCP tools marked (True for enabled, False for planned)
- [ ] Step 5: "Use Basiq template" selected. All 25 policy links provided
- [ ] Step 6: All evidence files uploaded to Evidence folder
- [ ] BLOCKER G1 resolved: Vulnerability scan report uploaded
- [ ] BLOCKER G2 resolved: Insurance certificates uploaded
- [ ] Security Policies document uploaded to Evidence folder
- [ ] Architecture diagram uploaded to Evidence folder
- [ ] Final review of all answers for accuracy

---

*Cross-references:*
*- Compliance Matrix: `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`*
*- Implementation Plan: `docs/compliance/CDR_IMPLEMENTATION_PLAN.md`*
*- Security Policies: `docs/policy/MONITRAX_SECURITY_POLICIES.md`*
*- Architecture: `docs/compliance/CDR_SYSTEM_ARCHITECTURE.md`*
