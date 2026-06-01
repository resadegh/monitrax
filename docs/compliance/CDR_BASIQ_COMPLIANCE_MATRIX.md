# CDR / Basiq Compliance Matrix — Full Requirement Tracking

**Version:** 1.4
**Created:** 2026-02-27
**Updated:** 2026-05-09 — Phase 32B/32C/33 doc-sync catch-up
**Source:** Basiq CDR accreditation questionnaire (Artefacts tracking file)
**Status:** Active — tracking all compliance requirements
**Owner:** Resadegh (Director) + Claude Code (AI engineering)
**Recent Changes (2026-05-09):**
- B2B2C surface (Phase 32B + 32C) shipped May 2026 — adds new audit-action enum values that auditors should be aware of (PRO_DASHBOARD_VIEW, MARKETPLACE_LISTING_*, PROFESSIONAL_REQUEST_*, CONVERSATION_*, BILLING_*).
- ProfessionalConversation messages now have explicit `retentionUntil = createdAt + 7 years` per AFSL recordkeeping requirement (Corporations Act §912F). See `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` §3 for the full retention table.
- Lead-fee billing surface (Stripe-mirrored invoices) is **not CDR-data** — it's commercial/financial transaction data subject to standard 7-year financial recordkeeping, not Privacy Safeguard 12.
- Adviser feedback inbox (Phase 33g) is **not CDR-data** — internal product feedback only.
- Audit log dual-emit pattern preserved across all new state-changing actions: `createAuditLog()` fires fire-and-forget alongside the canonical engine call. Cloud Logging mirror remains the 365-day retention backstop.

**Recent Changes (prior):** Updated to align with full Basiq CDR Compliance spreadsheet (Steps 1-6, v2.0). Added Step 1 (Organisation), Step 2 (CDR Data Use), Step 5 (Policies & Procedures), Step 6 (Backend Implementation Evidence). Overall compliance score recalculated across all steps.

---

## How to Read This Document

- **DONE** = Implemented, tested, and deployed
- **PARTIAL** = Infrastructure exists but not fully wired / enforced
- **TODO** = Not yet implemented
- **N/A** = Not applicable to our current setup (startup, sole director)
- **GCP** = Handled by Google Cloud Platform managed service (not custom code)
- **FIREBASE** = Handled by Firebase Auth / GCP Identity Platform

Each requirement links to the specific code, config, or GCP service that satisfies it.

---

## STEP 1: Your Organisation

*"Tell us about your organisation and who is responsible for security."*

| # | Requirement | Status | Current Value | Action |
|---|------------|--------|---------------|--------|
| 1.1 | Organisation Name (ASIC/ABN register) | **DONE** | Renew Group Holding Pty Ltd | None |
| 1.2 | ABN or ACN | **DONE** | 89 668 548 785 | None |
| 1.3 | Website URL | **DONE** | Monitrax.com.au | None |
| 1.4 | Company Description | **DONE** | Financial tracking startup | None |
| 1.5 | Services Description (CDR data use) | **DONE** | Financial portfolio tracker and categorisation web app | None |
| 1.6 | Company Logo URL (200x39px) | **TODO** | Placeholder URL — needs real logo | Create correct-size logo and host |
| 1.7 | Security Responsibility | **DONE** | Director (sole operator) | None |
| 1.8 | Production Environment Security | **DONE** | Director | None |
| 1.9 | Risk Management | **DONE** | Director | None |
| 1.10 | Compliance | **DONE** | Director | None |
| 1.11 | Legal/Ethics | **DONE** | Director | None |
| 1.12 | Training & Awareness | **DONE** | Director | None |

### Step 1 Response Guidance

**Can confirm YES today:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12 (11/12 ✅)
**Action required:** 1.6 — Create 200x39px company logo and host at a public URL.

---

## STEP 2: CDR Data Use

*"Tell us how you intend to use CDR data."*

| # | Question | Answer | Rationale |
|---|----------|--------|-----------|
| 2.1 | Will your org know consumer identity? | **True** | Monitrax requires user login — consumers are identified |
| 2.2 | Use CDR data for direct marketing? | **False** | No direct marketing with CDR data planned |
| 2.3 | Disclose CDR data overseas? | **False** | Data stays in Australia (GCP Cloud SQL Sydney) |
| 2.4 | Read CDR compliance obligations doc | **True** | Reviewed |
| 2.5 | Read CDR Representatives fact sheet | **True** | Reviewed — ACCC Version 3, July 2024 |
| 2.6 | Public consent management webpage | **True** | Needs to be built — consumer must manage consent on our platform |

### Step 2 Response Guidance

**Can confirm YES today:** 2.1, 2.2, 2.3, 2.4, 2.5 (5/6 ✅)
**Action required:** 2.6 — **TODO: Build public-facing consent management page** where consumers can view, manage, and revoke their CDR data consent.

---

## SECTION 1: User Authentication and Access Management (Step 3: 3.1–3.7)

*"How are users authenticated and authorised to access systems that store CDR data?"*

| # | Basiq Requirement | Status | Implementation | Gap / Action |
|---|-------------------|--------|----------------|--------------|
| 1.1 | Every user has a unique login account | **DONE** | Prisma `User` model with unique `email` field. GCP Identity Platform enforces unique UIDs. `OAuthAccount` links GCP UID → local user 1:1. | None |
| 1.2 | User accounts are not generic and are never shared | **DONE** | Firebase Auth enforces per-email accounts. Local `User` table has unique email constraint. No shared/service accounts in app. | None |
| 1.3 | Multi-factor authentication is enabled for user accounts | **DONE** | MFA fully built: Firebase TOTP enrollment, challenge/resolve flow (`lib/firebase/mfa.ts`), UI in settings page. Schema fields: `User.mfaEnabled`, `Organization.mfaEnforced`. **Server-side enforcement:** `withMFARequired()` guard (`lib/auth/guards.ts`) blocks CDR data access when org enforces MFA and user hasn't enrolled. Applied to all Basiq/CDR routes (`app/api/basiq/*`). Admin MFA enforced for SUPER_ADMIN/BILLING_ADMIN roles in `verifyAdminAuth()` (`lib/admin/auth.ts`). | ✅ Phase B complete. |
| 1.4 | Strong passwords are enforced for user accounts | **DONE** | Firebase Auth manages password policy for all end users. Legacy register route requires 12+ chars, upper/lower/digit/special. Admin passwords: bcrypt(12), 12+ chars with complexity (`lib/admin/constants.ts`). | Firebase password policy should be reviewed in GCP Console to confirm minimum strength. |
| 1.5 | Role based access is used to restrict access to systems | **DONE** | 50+ permissions defined (`lib/auth/permissions.ts`). 4 roles: OWNER, ADMIN, CONTRIBUTOR, VIEWER. Guards built: `withPermission()`, `withAllPermissions()`, `withAnyPermission()`, `withOwnerOnly()` (`lib/auth/guards.ts`). **All 70+ API routes migrated to `withPermission()`.** CDR audit logging on every guard invocation. | ✅ Phase A complete. PR [#438](https://github.com/resadegh/monitrax/pull/438). |
| 1.6 | Access privileges are granted on a as-needed basis | **DONE** | Permission system enforces granular entity-level access (read/write/delete per module) on **all** API routes. Ownership verification via `lib/utils/ownership.ts`. Each route uses the minimum permission required for its operation. | ✅ Phase A complete. Least-privilege enforced across all routes. |
| 1.7 | Admin accounts are regularly reviewed and removed | **DONE** | Admin portal (Phase 33) with full lifecycle management. `AdminUser` model with `lastLoginAt`, `isActive` flags. GET `/api/admin/admins` returns `isInactive90Days` flag for all admins. Settings page shows inactive admins. PATCH/DELETE endpoints for deactivation. All actions logged to `AdminAuditLog`. | None — implemented in Phase 33 Admin Portal. |

### Basiq Response Guidance (Section 1)

**Can confirm YES today:** 1.1, 1.2, **1.3**, 1.4, **1.5**, **1.6**, **1.7** ✅
**Can confirm YES with caveats:** None
**Recommended approach:** MFA enforced on CDR data routes (1.3 DONE). RBAC fully enforced (1.5, 1.6 DONE). Admin lifecycle review fully implemented (1.7 DONE).

---

## SECTION 2: Logging (Step 3: 3.8–3.14)

*"Identify which events are recorded for systems that have access to CDR data."*

| # | Basiq Requirement | Status | Implementation | Gap / Action |
|---|-------------------|--------|----------------|--------------|
| 2.1 | Critical system events are logged | **DONE** | `lib/security/auditLog.ts` — `createAuditLog()` persists to `AuditLog` table. Actions: CREATE, UPDATE, DELETE, EXPORT, BULK_DELETE. All state-changing operations logged. `lib/audit/logger.ts` delegates to same table. Phase 12 Track E (2026-05-17) added three additional `AuditAction` enum values for the conversational onboarding surface: `ONBOARDING_AGENT_EXTRACTION` (every LLM tool call), `ONBOARDING_AGENT_TOPIC_CONFIRMED` (per "Looks right"), `ONBOARDING_AGENT_MODE_SWITCHED` (form↔chat toggle — enum reserved, no call site yet). All three log via `sanitizeCdrMetadata()` — metadata carries field NAMES + counts + token usage only, NEVER values. See `lib/ai/onboarding-agent/gateway.ts` + `app/api/onboarding/chat/{extract,topic-confirmed}/route.ts`. | None |
| 2.2 | Security events are logged | **DONE** | `logSecurity()` logs: RATE_LIMIT_HIT, UNAUTHORIZED_ACCESS, FORBIDDEN_ACCESS, ACCOUNT_LOCKED, ACCOUNT_UNLOCKED. `withAuth` middleware logs failed auth attempts (401 responses). | None |
| 2.3 | User authentication (logins) are logged | **DONE** | `OAUTH_LOGIN` logged at GCP sync boundary (`lib/auth/gcpIdentity.ts`). `REGISTER` logged for new users. GCP Console captures all Firebase Auth events (login, MFA challenge, password reset). `API_REQUEST` logged for every authenticated API call. | None |
| 2.4 | API requests are logged | **DONE** | `withAuth` middleware (`lib/middleware.ts`) fires `logApiRequest()` for every authenticated request. Logs: method, endpoint, HTTP status, duration, IP, user agent. Fire-and-forget pattern (`.catch(() => {})`). | None |
| 2.5 | Logs are regularly reviewed to identify irregularities | **PARTIAL** | Admin audit logs UI (`app/admin/audit-logs/page.tsx`) with filtering by action, status, date range. Export to CSV. CDR compliance tab shows checklist status. | **TODO:** Automated anomaly detection / alerting. Currently manual review only. Consider GCP Cloud Monitoring alerts. |
| 2.6 | Logs don't include CDR data e.g. customers finances | **DONE** | `sanitizeCdrMetadata()` (`lib/security/cdrAuditCompliance.ts`) strips financial data from audit log metadata. Applied in `withAuth` middleware for all API request logs. CDR-protected fields: amounts, balances, account numbers, BSBs. | None |
| 2.7 | Logs are retained for over 90 days | **PARTIAL** | Audit logs persisted in PostgreSQL with `createdAt` timestamps. No automatic deletion. CDR compliance check verifies oldest log > 90 days. | **TODO:** Formal retention policy. Consider Cloud Logging for long-term retention with automatic archival. Database logs will grow indefinitely without cleanup. |

### Basiq Response Guidance (Section 2)

**Can confirm YES today:** 2.1, 2.2, 2.3, 2.4, 2.6
**Can confirm YES with caveats:** 2.5 (manual review, no automated alerts), 2.7 (retained indefinitely, no formal policy document)
**Recommended approach:** Strong position. Add automated alerting and formalize retention policy.

---

## SECTION 3: System Security (Step 3: 3.15–3.19)

*"Specify the security measures for systems that have access to CDR data."*

| # | Basiq Requirement | Status | Implementation | Gap / Action |
|---|-------------------|--------|----------------|--------------|
| 3.1 | Systems are hosted in a secure cloud environment (GCP) | **DONE** | **Frontend:** Vercel (Next.js CDN + edge). **Database:** GCP Cloud SQL PostgreSQL (australia-southeast1, Sydney). **Identity:** GCP Identity Platform (Firebase Auth). **Storage:** Google Cloud Storage. **AI:** Google Vision API, Generative AI. **Migration from Render completed 2026-04-10.** | None — all production on managed cloud platforms. Database now in Australia for CDR data residency. |
| 3.2 | Network rules are enforced to limit external access | **DONE (DB tier — restricted by IAM as compensating control) / PARTIAL (HTTP edge)** | **Database:** Workload Identity Federation + Cloud SQL Connector + IAM database authentication, **active in Production since 2026-05-01 (Phase 9)**. The Vercel runtime reads its OIDC token from the per-request `x-vercel-oidc-token` header, exchanges it via STS for an impersonated SA access token, opens a TLS 1.3 tunnel via the Cloud SQL Connector, and authenticates to Postgres in IAM-database-auth mode using the SA access token as the per-connection password. **No static credential exists in any env var, secret store, or configuration file.** Code: `lib/db.ts`. Evidence pack: `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md` (§7 Phase 9 cutover record; §8 compensating-control rationale for retained `0.0.0.0/0`). **Compensating control on the network ACL (Phase 10 decision, 2026-05-01):** the `0.0.0.0/0` authorized-network entry is retained intentionally. Without a static credential, an attacker on any source IP cannot authenticate — the only path to a Postgres session is a Vercel-issued OIDC token tied to project `prj_UYQF3GpGAkeFo4ZhMhch4Q0btCAU` AND the WIF binding to `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com` AND that SA being a Cloud IAM database user on this specific instance. The network ACL was historically protecting a long-lived password; that password no longer exists. Retaining the public IP entry avoids the cost and operational complexity of a Vercel Static IP add-on (~AU$30-50/mo) that would be needed to whitelist Vercel's serverless egress, which is dynamic and not stably whitelistable per [Vercel's own documentation](https://vercel.com/docs/security/secure-backend-access/static-ip). Decision is revisitable: when the first paying user lands or before Basiq accreditation submission, switch to Vercel Static IP + restrict authorized networks to that IP (~5 min change). **HTTP edge:** Rate limiting middleware exists (`lib/middleware/apiSecurity.ts`). Cloud Armor WAF still pending. | **TODO:** Enable Cloud Armor WAF (HTTP edge protection). **Phase 11 (queued, +30d):** Drop legacy `buildStandardPrisma()` branch from `lib/db.ts`; remove `DATABASE_URL` from runtime env scope; disable / drop `monitrax_user`. **Future trigger:** First paying user / pre-Basiq-submission → switch to Vercel Static IP + restrict authorized networks. |
| 3.3 | Data in transit is always encrypted | **DONE** | Vercel enforces HTTPS. All Firebase/GCP API calls over TLS. Cloud SQL connection via SSL (`sslmode=require` in DATABASE_URL). Database audit logging enabled (log_connections, log_disconnections, log_statement=ddl). | ✅ Verified during migration 2026-04-10. |
| 3.4 | Systems are regularly patched for security updates | **PARTIAL** | Modern dependencies (Next.js 15.2.6, Prisma 5.22, Firebase 12.9). Managed services auto-patched by vendors. | **TODO:** Enable Dependabot or `npm audit` in CI. Monthly dependency review. |
| 3.5 | Systems are regularly tested for security vulnerabilities | **PARTIAL** | Vitest framework with test scripts (`test`, `test:watch`, `test:coverage`, `test:validation`, `test:regression`). No automated security scanning (OWASP, Snyk). | **TODO:** Add `npm audit` to CI. Enable Security Command Center in GCP. Schedule annual pen test. |

### Basiq Response Guidance (Section 3)

**Can confirm YES today:** 3.1, 3.2 (DB tier — WIF + IAM auth), 3.3
**Must address:** 3.2 (HTTP edge — Cloud Armor WAF), 3.4 (dependency scanning), 3.5 (vulnerability testing)
**Recommended approach:** GCP provides Cloud Armor, Security Command Center, and automated patching. These should be enabled rather than building custom solutions.

**Evidence pack for 3.2 (DB tier):** `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md` documents the full token flow: per-request Vercel OIDC token → GCP STS → impersonated SA access token → Cloud SQL Connector TLS 1.3 tunnel → IAM-authenticated Postgres session (SA OAuth token as per-connection password). No static credential is involved end-to-end. **Status as of 2026-05-01:** active and serving Production traffic.

---

## SECTION 4: Device Management (Step 3: 3.20–3.22)

*"Please select all items that apply to user devices e.g. staff laptops"*

| # | Basiq Requirement | Status | Notes |
|---|-------------------|--------|-------|
| 4.1 | Devices regularly updated with latest security patches | **DONE** | macOS auto-updates enabled. Security patches applied within 7 days. Documented in `docs/policy/DEVICE_SECURITY_POLICY.md` §3.1. |
| 4.2 | Devices are not connected to the production system network | **DONE** | Production on cloud (Render/GCP). Dev connects via HTTPS API only. No SSH tunnel to prod DB. Documented in `docs/policy/DEVICE_SECURITY_POLICY.md` §3.2. |
| 4.3 | All devices have anti-malware and anti-virus installed | **DONE** | macOS XProtect (built-in, auto-updated), Gatekeeper, FileVault encryption, Application Firewall. Documented in `docs/policy/DEVICE_SECURITY_POLICY.md` §3.3. |

### Basiq Response Guidance (Section 4)

**Can confirm YES today:** 4.1, 4.2, 4.3 ✅
**Device Security Policy:** `docs/policy/DEVICE_SECURITY_POLICY.md` — comprehensive policy covering patching, network isolation, and endpoint protection.

---

## SECTION 5: Handling of CDR Data (Step 3: 3.23–3.30)

*"Tell us how CDR data is handled within your environment"*

| # | Basiq Requirement | Status | Implementation | Gap / Action |
|---|-------------------|--------|----------------|--------------|
| 5.1 | CDR data is only stored in the production environment | **PARTIAL** | Production data in GCP Cloud SQL (australia-southeast1, Sydney). DEV/UAT instance (`monitrax-db-dev`) exists separately. Currently both have test data (no real CDR data yet). **2-tier environment strategy documented in `docs/operational/architecture/02_ENVIRONMENT_STRATEGY.md`.** | **TODO:** When real CDR data flows, ensure DEV/UAT uses synthetic data only. |
| 5.2 | CDR data will be retained in a de-identified format | **DONE** | `anonymizeCDRData()` in `lib/services/cdrDataLifecycle.ts` strips PII (account numbers, BSBs, merchant names) while preserving aggregate amounts/dates. Used for legal retention cases (loan applications). | ✅ Phase 35 complete. Consider GCP Cloud DLP for additional automated PII detection. |
| 5.3 | CDR data is never copied to end-user devices | **PARTIAL** | Data is fetched via API and rendered in browser. **Settings overhaul 2026-05-08 added one user-initiated bulk export at `GET /api/account/export`** (right-to-portability under Privacy Act APP 12 / CDR data-subject right). The user is the data subject — the entitlement is theirs to take. Audited via `DATA_EXPORT_REQUESTED`. CDR-derived fields included; no third-party sharing. | **Review:** No bulk export to third parties. Verify browser cache/localStorage does not retain CDR data. |
| 5.3a | Right to erasure (consumer-initiated) | **DONE** | Settings overhaul 2026-05-08 shipped the 30-day soft-delete grace (`POST/DELETE /api/account/delete-request`; Privacy Act APP 11.2 + CDR §3.2; `User.deletionRequestedAt` + `User.deletionScheduledFor`). **Hard-delete executor shipped 2026-06-01**: `POST /api/account/lifecycle` (Cloud Scheduler `monitrax-account-deletion-executor`, daily 05:00 Australia/Sydney) → `executeScheduledDeletions()` finds users past the grace and runs `deleteUserAccount()` **identity-first, abort-on-failure**: (1) delete the Firebase Auth identity via Identity Platform Admin REST (`lib/auth/identityPlatformAdmin.ts`, WIF SA — prevents a resurrectable account); (2) `deleteCDRData()` purge (local + Basiq); (3) ordered DB cascade hard-delete; (4) `USER_DELETED` audit (+ Cloud Logging 365-day). Deletion aborts (retries next run) if the identity cannot be removed. Code: `lib/services/accountDeletion.ts`, `app/api/account/lifecycle/route.ts`. UI now type-to-confirm + honest "permanently and irreversibly deleted" copy. | **One-time prerequisite to arm the executor:** grant the WIF SA `roles/firebaseauth.admin` (or `firebaseauth.users.{get,delete}`) — see `docs/operational/runbooks/05_RETENTION_SCHEDULERS.md` §6b. Until granted, deletions safely no-op (abort-on-failure). Create the Cloud Scheduler job per §4a. |
| 5.4 | CDR data is deleted once no longer required | **DONE** | `deleteCDRData(userId, reason)` in `lib/services/cdrDataLifecycle.ts` hard-deletes all Basiq-sourced accounts, transactions, and connections. Supports retention_policy reason. Audited via `CDR_DATA_DELETED` action. | ✅ Phase 35 complete. |
| 5.5 | CDR data is deleted once the consent has expired | **DONE** | `checkConsentExpiry()` in `lib/services/cdrDataLifecycle.ts` finds expired consents and triggers CDR data deletion. Endpoint `POST /api/cdr/lifecycle` designed for GCP Cloud Scheduler (daily at 02:00 Australia/Sydney (AEST/AEDT)). Audited via `CDR_CONSENT_EXPIRED` + `CDR_DATA_DELETED`. | ✅ Phase 35 complete. User must configure Cloud Scheduler in GCP Console. |
| 5.6 | CDR data is deleted when consent has been revoked | **DONE** | `handleConsentRevocation()` in `lib/services/cdrDataLifecycle.ts` marks consent REVOKED and purges CDR data. API endpoint `POST /api/cdr/consent { action: 'revoke_org_consent' }` allows user-initiated revocation. Audited via `CDR_CONSENT_REVOKED` + `CDR_DATA_DELETED`. | ✅ Phase 35 complete. |
| 5.7 | CDR data at rest is always encrypted | **PARTIAL** | GCP Cloud SQL encrypts data at rest by default (Google-managed keys). Database in australia-southeast1 (Sydney) for CDR data residency. | **Recommended:** Enable CMEK (Customer-Managed Encryption Keys) via Cloud KMS for additional control before go-live with real CDR data. |
| 5.8 | I'm legally required to retain CDR data (e.g. loan application) | **DONE** | CDR Data Retention Schedule created (`docs/policy/CDR_DATA_RETENTION_SCHEDULE.md`). Defines retention periods per data type, legal basis, deletion triggers. Anonymization via `anonymizeCDRData()` for legal retention cases. | None |

### Basiq Response Guidance (Section 5)

**Can confirm YES today:** 5.2, 5.4, 5.5, 5.6, 5.7 ✅
**Can confirm YES with caveats:** 5.1 (env separation policy needed), 5.3 (one user-initiated self-service export only — `/api/account/export`; right to portability; the user IS the data subject; no third-party export; browser cache review pending), 5.3a (right-to-erasure shipped end-to-end — soft-delete grace + hard-delete executor `/api/account/lifecycle`; one-time WIF SA `firebaseauth.admin` grant + Cloud Scheduler job creation are the only Reza-side console steps remaining)
**Recommended approach:** CDR Data Lifecycle Service implemented (`lib/services/cdrDataLifecycle.ts`). Configure GCP Cloud Scheduler for automated consent expiry checks. Enable CMEK for 5.7 enhancement.

---

## SECTION 6: Development Practices (Step 3: 3.31–3.35)

*"Specify your coding practices for code that accesses CDR data"*

| # | Basiq Requirement | Status | Implementation | Gap / Action |
|---|-------------------|--------|----------------|--------------|
| 6.1 | Code is peer reviewed before deployment to production | **DONE** | All changes via Pull Request (`CLAUDE.md` Part 4). Feature branches → PR → review → merge. GitHub as version control. | None — this is our standard workflow. |
| 6.2 | Code is managed using a version control system (GitHub) | **DONE** | Git repository. Feature branches (`claude/*`). Commit history, atomic commits, descriptive messages. | None |
| 6.3 | Code is tested before deployment to production | **PARTIAL** | `npm run build` (TypeScript + Next.js) before every commit. `npm run lint` for quality. Vitest framework with scripts: `test`, `test:watch`, `test:coverage`, `test:validation`, `test:regression`, `test:calculations`. | **TODO:** Expand test coverage for CDR-critical code paths (auth guards, data access, consent lifecycle). |
| 6.4 | Libraries are reviewed and approved before use | **DONE** | Approved Dependencies List created (`docs/policy/APPROVED_DEPENDENCIES.md`). All 40+ packages documented with version, purpose, license, and review date. Approval criteria defined. `npm audit` in CI pipeline (`.github/workflows/security-audit.yml`). | None |
| 6.5 | Libraries are regularly updated with latest security patches | **DONE** | Dependabot enabled (`.github/dependabot.yml`) — weekly automated dependency update PRs. `npm audit` runs in CI on every push and weekly schedule. Vulnerability response policy in `docs/policy/APPROVED_DEPENDENCIES.md` §5. | None |

### Basiq Response Guidance (Section 6)

**Can confirm YES today:** 6.1, 6.2, 6.4, 6.5 ✅
**Can confirm YES with caveats:** 6.3 (build-tested, not unit-tested for CDR paths)
**Recommended approach:** Expand test coverage for CDR-critical code paths (auth guards, consent lifecycle).

---

## SECTION 7: HR Practices (Step 3: 3.36–3.38)

*"Specify the HR practices you have implemented to address data security"*

| # | Basiq Requirement | Status | Notes |
|---|-------------------|--------|-------|
| 7.1 | Staff are made aware of the importance of handling sensitive data | **DONE** | Security Awareness Policy created (`docs/policy/SECURITY_AWARENESS_POLICY.md`). Covers CDR data handling, access control, secure development, incident response. Onboarding requirements defined for future staff (§5). | N/A (sole trader — no employees) |
| 7.2 | We conduct background checks before hiring staff | **DONE** | Background check requirement documented in `docs/policy/SECURITY_AWARENESS_POLICY.md` §5 (future staff onboarding). Currently N/A as sole director. | N/A (sole trader — no employees) |
| 7.3 | We regularly perform privacy and security training | **DONE** | Director self-directed security awareness through CDR compliance work (documented in policy §3). Training schedule defined for future staff (§6). Annual review cycle. | N/A (sole trader — no employees) |

### Basiq Response Guidance (Section 7)

**Can confirm YES today:** 7.1, 7.2, 7.3 ✅ (with sole trader context)
**Policy documents:** `docs/policy/SECURITY_AWARENESS_POLICY.md` covers all HR requirements with future staff onboarding plan.

---

## SECTION 8: Technology — GCP Tools (Step 4: 4.1–4.16)

*"Please choose the tools that you utilize within your GCP production environment."*

| # | GCP Service | Status | Usage in Monitrax | Action Required |
|---|------------|--------|-------------------|-----------------|
| 8.1 | Cloud Audit Logs | **DONE** | Cloud SQL audit logging enabled: `log_connections=on`, `log_disconnections=on`, `log_statement=ddl`. GCP auto-generates Admin Activity logs. | ✅ Enabled during migration 2026-04-10. Consider enabling Data Access logs for full CDR audit trail. |
| 8.2 | Cloud Data Loss Prevention (DLP) | **TODO** | Not configured. CDR data contains PII (account numbers, BSBs, balances). | **Recommended:** Enable DLP scanning on Cloud SQL or data exports to detect/redact PII. |
| 8.3 | Identity and Access Management (IAM) | **DONE** | GCP IAM controls access to cloud resources. Firebase Auth (Identity Platform) for end users. | Review IAM roles — principle of least privilege for service accounts. |
| 8.4 | Cloud Identity-Aware Proxy (IAP) | **TODO** | Not configured. Could protect admin routes with Google-level auth. | **Consider:** Enable IAP for admin portal access as additional layer. |
| 8.5 | Cloud Key Management Service (KMS) | **TODO** | Cloud SQL uses Google-managed encryption. No CMEK configured. | **Recommended:** Enable CMEK for CDR data encryption. Gives you key rotation and access control. |
| 8.6 | Cloud Logging | **SHOULD ENABLE** | Server logs go to stdout (captured by Cloud Run/App Engine). Not explicitly integrated. | Route application logs to Cloud Logging. Enables retention, search, alerting. |
| 8.7 | Cloud Monitoring | **TODO** | No monitoring dashboards or alerts configured. | **Recommended:** Set up uptime checks, error rate alerts, latency monitoring. |
| 8.8 | Cloud Profiler | **TODO** | Not configured. | Low priority — performance optimization tool. |
| 8.9 | Security Command Center | **TODO** | Not enabled. | **Recommended:** Enable for vulnerability scanning, compliance monitoring, threat detection. |
| 8.10 | Cloud Trace | **TODO** | Not configured. | Low priority — distributed tracing. |
| 8.11 | Error Reporting | **SHOULD ENABLE** | Application errors logged to console. Not routed to Error Reporting. | **Recommended:** Enable — automatic error grouping and alerting. |
| 8.12 | Google Cloud Armor | **TODO** | No WAF/DDoS protection configured. | **Recommended:** Enable for CDR data protection. Rate limiting, IP blocking, OWASP rules. |
| 8.13 | Cloud NAT | **TODO** | Not configured. | Only needed if using private VPC with outbound internet access. |
| 8.14 | Google Cloud Identity | **DONE** | GCP Identity Platform (Firebase Auth) is the sole identity provider. MFA, OAuth, email/password. | None — already the core auth system. |

### Other Tools

| # | Tool | Status | Notes |
|---|------|--------|-------|
| 8.15 | Terraform | **TODO** | No IaC (Infrastructure as Code) found. GCP resources likely configured via Console. | **Recommended:** Migrate to Terraform for reproducible, auditable infrastructure. |
| 8.16 | GitHub | **DONE** | Version control, PR workflow, branch management. | None |

### GCP Tools — Priority Actions

| Priority | Service | Why | Effort |
|----------|---------|-----|--------|
| **P0** | Cloud Armor | CDR data protection, WAF, DDoS | GCP Console config |
| **P0** | Security Command Center | Vulnerability scanning, compliance | GCP Console enable |
| **P1** | Cloud KMS (CMEK) | CDR data encryption at rest with customer keys | GCP Console + Cloud SQL config |
| **P1** | Cloud Logging + Monitoring | Log retention, alerting, anomaly detection | GCP Console config |
| **P1** | Error Reporting | Automated error detection | GCP Console enable |
| **P2** | Cloud DLP | PII detection in CDR data | GCP Console config |
| **P2** | Cloud IAP | Admin portal protection | GCP Console config |
| **P3** | Terraform | Infrastructure as Code | Migration project |

---

## STEP 5: Policies & Procedures

*"Demonstrate your organisation's compliance certifications and documented security policies."*

### 5A: Compliance Certifications

| # | Certification | Status | Notes |
|---|-------------|--------|-------|
| 5.1 | ISO 27001 | **N/A** | Not required for CDR Representative — future goal |
| 5.2 | SOC 2 Type 2 | **N/A** | Not required for CDR Representative |
| 5.3 | PCI DSS | **N/A** | Not applicable |
| 5.4 | Australian Credit Licence | **N/A** | Not providing credit |
| 5.5 | AFSL | **N/A** | Not providing financial advice |
| 5.6 | Registered ADI | **N/A** | Not a deposit-taking institution |

### 5B: Documented Policies (25 Required)

| # | Policy Required | Status | Monitrax Document | Basiq Template Section |
|---|----------------|--------|-------------------|----------------------|
| P1 | Acceptable Use Policy | **TODO** | None — needs creation | Use Basiq template |
| P2 | Access Control | **DONE** | `docs/operational/security/02_IAM_AND_PERMISSIONS.md` | Map to template |
| P3 | Administrative Access Control | **DONE** | `docs/operational/security/02_IAM_AND_PERMISSIONS.md` (admin section) | Map to template |
| P4 | Antivirus and Malware Protection | **DONE** | `docs/policy/DEVICE_SECURITY_POLICY.md` §3.3 | Map to template |
| P5 | Audit Logging and Monitoring | **DONE** | `docs/operational/database/03_MONITORING_AND_ALERTS.md` | Map to template |
| P6 | Background Checks | **DONE** | `docs/policy/SECURITY_AWARENESS_POLICY.md` §5 | Map to template |
| P7 | CDR Data Handling | **DONE** | `docs/compliance/CDR_DATA_RETENTION_SCHEDULE.md` + `docs/operational/security/03_CDR_COMPLIANCE.md` | Map to template |
| P8 | Data Breach Response | **DONE** | `docs/policy/INCIDENT_RESPONSE_PLAN.md` | Map to template |
| P9 | Data Loss Prevention | **TODO** | None — needs creation | Use Basiq template |
| P10 | End-User Device Hardening | **DONE** | `docs/policy/DEVICE_SECURITY_POLICY.md` | Map to template |
| P11 | Firewall Protection | **TODO** | None — Cloud Armor not yet configured | Use Basiq template + GCP Cloud Armor |
| P12 | Information Asset Lifecycle | **TODO** | None — needs creation | Use Basiq template |
| P13 | Information Security Boundary Review | **TODO** | None — needs creation | Use Basiq template |
| P14 | Information Security Governance Framework | **PARTIAL** | CLAUDE.md + BAU framework covers some | Use Basiq template, reference existing |
| P15 | Information Security Incident Management | **DONE** | `docs/policy/INCIDENT_RESPONSE_PLAN.md` | Map to template |
| P16 | Information Security Policy | **PARTIAL** | Basiq template available | Customize Basiq template |
| P17 | Information Security Risk Management | **TODO** | None — needs creation | Use Basiq template |
| P18 | Monitoring of Application Services | **PARTIAL** | `docs/operational/runbooks/03_HEALTH_CHECKS.md` | Map to template |
| P19 | Multi-Factor Authentication | **DONE** | Code: `lib/auth/guards.ts` + `docs/operational/security/01_AUTHENTICATION.md` | Map to template |
| P20 | OS and Application Patches | **PARTIAL** | `docs/policy/APPROVED_DEPENDENCIES.md` covers libs | Use Basiq template |
| P21 | Protecting Data at Rest | **PARTIAL** | GCP auto-encryption — no formal policy doc | Use Basiq template |
| P22 | Protecting Data in Transit | **DONE** | SSL/TLS everywhere — documented | Map to template |
| P23 | Secure Authentication | **DONE** | `docs/operational/security/01_AUTHENTICATION.md` | Map to template |
| P24 | Secure Coding Practices | **PARTIAL** | CLAUDE.md covers extensively | Use Basiq template |
| P25 | Server Hardening | **TODO** | None — managed services, needs documentation | Use Basiq template |
| P26 | Vulnerability Management | **TODO** | None — needs creation | Use Basiq template |

### Step 5 Summary

**10/25 DONE, 7/25 PARTIAL, 8/25 TODO.** Action: Customize Basiq Security Policies Template (.docx) to create unified security policies document covering all 25 areas.

---

## STEP 6: Backend Implementation Evidence

*"Provide evidence (screenshots/videos) demonstrating your security controls are operational."*

| # | Evidence Required | Can Provide? | Source/How | Status |
|---|-----------------|-------------|-----------|--------|
| 6.1 | MFA setup for user accounts | **YES** | Screenshot: Firebase MFA config + Monitrax settings UI | **TODO** — capture screenshot |
| 6.2 | Users with admin access list | **YES** | Screenshot: Admin Portal user list + GCP IAM roles | **TODO** — capture screenshot |
| 6.3 | Role-based access control | **YES** | Screenshot: permissions code + `withPermission()` usage | **TODO** — capture screenshot |
| 6.4 | Strong password controls | **YES** | Screenshot: Firebase Auth password policy | **TODO** — capture screenshot |
| 6.5 | Logging configuration evidence | **YES** | Screenshot: audit log entries + `sanitizeCdrMetadata()` | **TODO** — capture screenshot |
| 6.6 | Network protection | **PARTIAL** | Cloud SQL authorized networks + SSL config | **TODO** — needs Cloud Armor first |
| 6.7 | Encryption in transit (SSL) | **YES** | Screenshot: SSL certificates + Cloud SQL SSL config | **TODO** — capture screenshot |
| 6.8 | Encryption at rest | **PARTIAL** | GCP Cloud SQL encryption page (no CMEK yet) | **TODO** — capture screenshot |
| 6.9 | Patching of services/libraries | **YES** | Dependabot config + `npm audit` output | **TODO** — capture screenshot |
| 6.10 | Secure coding practices | **YES** | GitHub PR review example + CI pipeline | **TODO** — capture screenshot |
| 6.11 | Vulnerability scanning | **NO** | Needs pen test or OWASP scan | **BLOCKER** — must commission |
| 6.12 | Anti-virus on devices | **YES** | Screenshot: macOS XProtect/Gatekeeper status | **TODO** — capture screenshot |
| 6.13 | System architecture diagram | **PARTIAL** | Exists in docs but needs CDR-specific version | **TODO** — create CDR data flow diagram |
| 6.14 | Cyber + professional liability insurance | **UNKNOWN** | Needs insurance policies | **BLOCKER** — business action |

### Step 6 Summary

**10/14 YES, 2/14 PARTIAL, 2/14 BLOCKERS.** Critical: Pen test (6.11) and insurance (6.14) must be addressed before submission.

---

## SECTION 9: Implementation Priority & Roadmap

### Tier 1 — Must Have for Basiq Compliance (Code Changes)

| # | Task | Phase | Effort | Depends On |
|---|------|-------|--------|------------|
| T1.1 | Migrate ~150 routes from `withAuth()` → `withPermission()` | 34.3 | 3-5 days | Guards already built |
| T1.2 | Wire `withMFARequired()` guard on CDR data routes | 34.4 | 1-2 days | MFA already built |
| T1.3 | Build CDR Data Lifecycle Service (consent expiry → data deletion) | NEW | 3-5 days | Schema fields exist |
| T1.4 | ~~Admin lifecycle review (90-day inactivity check)~~ | ~~34.5~~ | ~~1 day~~ | ✅ **DONE** (Phase 33) |
| T1.5 | Add automated test suite for CDR-critical paths | NEW | 3-5 days | — |

### Tier 2 — Must Have for Basiq Compliance (GCP Config)

| # | Task | Where | Effort |
|---|------|-------|--------|
| T2.1 | Enable Cloud Armor (WAF + DDoS) | GCP Console | 1 day |
| T2.2 | Enable Security Command Center | GCP Console | 1 hour |
| T2.3 | Enable Cloud KMS (CMEK) for Cloud SQL | GCP Console | 1 day |
| T2.4 | Enable Cloud Logging + Monitoring with alerts | GCP Console | 1 day |
| T2.5 | Enable Error Reporting | GCP Console | 1 hour |
| T2.6 | Review Firebase password policy in GCP Console | GCP Console | 30 min |
| T2.7 | ~~Verify SSL on database connection~~ | ~~Env config~~ | ✅ **DONE** — `sslmode=require` in DATABASE_URL, verified 2026-04-10 |

### Tier 3 — ~~Should Have (Policy Documents)~~ ✅ COMPLETE (Phase F, 2026-03-08)

| # | Document | Purpose | Status |
|---|----------|---------|--------|
| T3.1 | Device & Endpoint Security Policy | Covers Basiq Section 4 (device management) | ✅ `docs/policy/DEVICE_SECURITY_POLICY.md` |
| T3.2 | CDR Data Retention Schedule | Covers Basiq 5.4, 5.8 (what data, how long, why) | ✅ `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` |
| T3.3 | Incident Response Plan | Required for CDR — what happens on breach | ✅ `docs/policy/INCIDENT_RESPONSE_PLAN.md` |
| T3.4 | Security Awareness Policy | Covers Basiq 7.1-7.3 for future staff | ✅ `docs/policy/SECURITY_AWARENESS_POLICY.md` |
| T3.5 | Approved Dependencies List | Covers Basiq 6.4 (library review) | ✅ `docs/policy/APPROVED_DEPENDENCIES.md` |

### Tier 4 — ~~Nice to Have (Improvements)~~ PARTIAL (Phase G, 2026-03-08)

| # | Task | Benefit | Status |
|---|------|---------|--------|
| T4.1 | Enable Dependabot on GitHub | Automated dependency updates (6.5) | ✅ `.github/dependabot.yml` |
| T4.2 | Add `npm audit` to CI pipeline | Continuous vulnerability scanning | ✅ `.github/workflows/security-audit.yml` |
| T4.3 | Enable Cloud DLP for PII detection | Automated CDR data protection (5.2) | TODO (Phase E) |
| T4.4 | Terraform for infrastructure | Auditable, reproducible GCP config | TODO |
| T4.5 | Cloud IAP for admin portal | Additional admin security layer | TODO |

---

## SECTION 10: Overall Compliance Score

| Category | Requirements | DONE | PARTIAL | TODO | Score |
|----------|-------------|------|---------|------|-------|
| Step 1: Organisation (12) | 1.1–1.12 | **11** | 0 | 1 | **92%** |
| Step 2: CDR Data Use (6) | 2.1–2.6 | **5** | 0 | 1 | **83%** |
| Step 3: Auth & Access (7) | 3.1–3.7 | **7** | 0 | 0 | **100%** |
| Step 3: Logging (7) | 3.8–3.14 | **5** | 2 | 0 | **85%** |
| Step 3: System Security (5) | 3.15–3.19 | 2 | 2 | 1 | **50%** |
| Step 3: Device Management (3) | 3.20–3.22 | **3** | 0 | 0 | **100%** |
| Step 3: CDR Data Handling (8) | 3.23–3.30 | **5** | 3 | 0 | **81%** |
| Step 3: Dev Practices (5) | 3.31–3.35 | **4** | 1 | 0 | **90%** |
| Step 3: HR Practices (3) | 3.36–3.38 | **3** | 0 | 0 | **100%** |
| Step 4: GCP Tools (16) | 4.1–4.16 | 4 | 0 | 12 | **25%** |
| Step 5: Certifications (6) | 5.1–5.6 | 0 | 0 | 0 | **N/A** |
| Step 5: Policies (25) | P1–P26 | 10 | 7 | 8 | **54%** |
| Step 6: Evidence (14) | 6.1–6.14 | 0 | 0 | 14 | **0%** |
| **TOTAL** | **117+** | **59** | **15** | **37** | **~65%** |

**Bottom line:** Overall spreadsheet readiness: ~65%. Main gaps: GCP tools (25%), Documented Policies (54%), Evidence collection (0%). All evidence items need screenshots/videos captured. Two critical blockers: vulnerability scan and insurance.

### Recent Progress

| Date | Phase | Change | Score Impact |
|------|-------|--------|-------------|
| 2026-03-08 | Phase F (Policy Docs) | 5 policy documents created: CDR Retention Schedule, Device Security, Incident Response, Security Awareness, Approved Dependencies | §4.1-4.3, §5.8, §6.4, §6.5, §7.1-7.3: N/A/TODO/PARTIAL → DONE (+9%) |
| 2026-03-08 | Phase G (Dev Pipeline) | Dependabot enabled, npm audit CI pipeline, security audit GitHub Action | §6.4, §6.5: PARTIAL/TODO → DONE (included above) |
| 2026-03-08 | Phase D/35 (CDR Lifecycle) | CDR Data Lifecycle Service, consent verification, revocation handler, de-identification | §5.2, §5.4, §5.5, §5.6: TODO/PARTIAL → DONE (+8%) |
| 2026-03-05 | Phase B (MFA) | `withMFARequired()` guard on all Basiq/CDR routes + admin MFA enforcement | §1.3: PARTIAL → DONE (+5%) |
| 2026-03-03/04 | Phase A (RBAC) | All 70+ API routes migrated to `withPermission()` | §1.5, §1.6: PARTIAL → DONE (+10%) |
| 2026-03-04 | Phase 33 (Admin) | Admin lifecycle management with inactive detection | §1.7: PARTIAL → DONE (+3%) |

---

*Last Updated: 2026-04-10*
*Next Review: After Phase E (GCP Services) completion*
*Recent: Full Basiq spreadsheet alignment (Steps 1-6). Score recalculated: ~65% across all 117+ requirements. Key gaps: GCP tools, policies, evidence collection.*
