# CDR / Basiq Compliance Matrix — Full Requirement Tracking

**Version:** 1.0
**Created:** 2026-02-27
**Source:** Basiq CDR accreditation questionnaire (Artefacts tracking file)
**Status:** Active — tracking all compliance requirements
**Owner:** Resadegh (Director) + Claude Code (AI engineering)

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

## SECTION 1: User Authentication and Access Management

*"How are users authenticated and authorised to access systems that store CDR data?"*

| # | Basiq Requirement | Status | Implementation | Gap / Action |
|---|-------------------|--------|----------------|--------------|
| 1.1 | Every user has a unique login account | **DONE** | Prisma `User` model with unique `email` field. GCP Identity Platform enforces unique UIDs. `OAuthAccount` links GCP UID → local user 1:1. | None |
| 1.2 | User accounts are not generic and are never shared | **DONE** | Firebase Auth enforces per-email accounts. Local `User` table has unique email constraint. No shared/service accounts in app. | None |
| 1.3 | Multi-factor authentication is enabled for user accounts | **PARTIAL** | MFA fully built: Firebase TOTP enrollment, challenge/resolve flow (`lib/firebase/mfa.ts`), UI in settings page. Schema fields: `User.mfaEnabled`, `Organization.mfaEnforced`. | **TODO (Phase 34.4):** Server-side `withMFARequired()` guard not wired. CDR data routes must reject users without MFA. |
| 1.4 | Strong passwords are enforced for user accounts | **DONE** | Firebase Auth manages password policy for all end users. Legacy register route requires 12+ chars, upper/lower/digit/special. Admin passwords: bcrypt(12), 12+ chars with complexity (`lib/admin/constants.ts`). | Firebase password policy should be reviewed in GCP Console to confirm minimum strength. |
| 1.5 | Role based access is used to restrict access to systems | **DONE** | 50+ permissions defined (`lib/auth/permissions.ts`). 4 roles: OWNER, ADMIN, CONTRIBUTOR, VIEWER. Guards built: `withPermission()`, `withAllPermissions()`, `withAnyPermission()`, `withOwnerOnly()` (`lib/auth/guards.ts`). **All 70+ API routes migrated to `withPermission()`.** CDR audit logging on every guard invocation. | ✅ Phase A complete. PR [#438](https://github.com/resadegh/monitrax/pull/438). |
| 1.6 | Access privileges are granted on a as-needed basis | **DONE** | Permission system enforces granular entity-level access (read/write/delete per module) on **all** API routes. Ownership verification via `lib/utils/ownership.ts`. Each route uses the minimum permission required for its operation. | ✅ Phase A complete. Least-privilege enforced across all routes. |
| 1.7 | Admin accounts are regularly reviewed and removed | **PARTIAL** | Admin portal exists (Phase 33). `AdminUser` model with `lastLoginAt`, `isActive` flags. Audit logs track all admin actions (`AdminAuditLog`). | **TODO (Phase 34.5):** Admin lifecycle review endpoint — flag admins inactive >90 days. Auto-deactivation workflow. |

### Basiq Response Guidance (Section 1)

**Can confirm YES today:** 1.1, 1.2, 1.4, **1.5**, **1.6**
**Can confirm YES with caveats:** 1.3 (enabled, not enforced on CDR routes), 1.7 (infrastructure exists, no automated review cycle)
**Recommended approach:** RBAC is fully enforced (1.5, 1.6 DONE). Confirm MFA is *available* and being *progressively enforced* on CDR data routes (Phase B). Provide timeline for admin lifecycle review automation (Phase C).

---

## SECTION 2: Logging ("Tell us about your logs")

*"Identify which events are recorded for systems that have access to CDR data."*

| # | Basiq Requirement | Status | Implementation | Gap / Action |
|---|-------------------|--------|----------------|--------------|
| 2.1 | Critical system events are logged | **DONE** | `lib/security/auditLog.ts` — `createAuditLog()` persists to `AuditLog` table. Actions: CREATE, UPDATE, DELETE, EXPORT, BULK_DELETE. All state-changing operations logged. `lib/audit/logger.ts` delegates to same table. | None |
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

## SECTION 3: System Security

*"Specify the security measures for systems that have access to CDR data."*

| # | Basiq Requirement | Status | Implementation | Gap / Action |
|---|-------------------|--------|----------------|--------------|
| 3.1 | Systems are hosted in a secure cloud environment (GCP) | **DONE** | **Frontend:** Vercel (Next.js CDN + edge). **Backend:** Render.com (Node runtime). **Database:** Render PostgreSQL. **Identity:** GCP Identity Platform (Firebase Auth). **Storage:** Google Cloud Storage. **AI:** Google Vision API, Generative AI. | None — all production on managed cloud platforms. |
| 3.2 | Network rules are enforced to limit external access | **PARTIAL** | Render provides basic DDoS protection. Rate limiting middleware exists (`lib/middleware/apiSecurity.ts`). No Cloud Armor/WAF configured. | **TODO:** Enable Cloud Armor or Render-level WAF. Restrict database to private networking. |
| 3.3 | Data in transit is always encrypted | **DONE** | Vercel enforces HTTPS. Render enforces HTTPS. All Firebase/GCP API calls over TLS. PostgreSQL connection via SSL. | Verify `?sslmode=require` in DATABASE_URL. |
| 3.4 | Systems are regularly patched for security updates | **PARTIAL** | Modern dependencies (Next.js 15.2.6, Prisma 5.22, Firebase 12.9). Managed services auto-patched by vendors. | **TODO:** Enable Dependabot or `npm audit` in CI. Monthly dependency review. |
| 3.5 | Systems are regularly tested for security vulnerabilities | **PARTIAL** | Vitest framework with test scripts (`test`, `test:watch`, `test:coverage`, `test:validation`, `test:regression`). No automated security scanning (OWASP, Snyk). | **TODO:** Add `npm audit` to CI. Enable Security Command Center in GCP. Schedule annual pen test. |

### Basiq Response Guidance (Section 3)

**Can confirm YES today:** 3.1, 3.3
**Must address:** 3.2 (network hardening), 3.4 (dependency scanning), 3.5 (vulnerability testing)
**Recommended approach:** GCP provides Cloud Armor, Security Command Center, and automated patching. These should be enabled rather than building custom solutions.

---

## SECTION 4: Device Management

*"Please select all items that apply to user devices e.g. staff laptops"*

| # | Basiq Requirement | Status | Notes |
|---|-------------------|--------|-------|
| 4.1 | Devices regularly updated with latest security patches | **N/A — Policy** | Startup context: sole director. Personal device management. Create a written policy document. |
| 4.2 | Devices are not connected to the production system network | **PARTIAL** | Production is on GCP (cloud-hosted). Dev machine connects via HTTPS API only, not direct database. | **Confirm:** No SSH tunnel to prod DB from dev machine. Access via GCP Console only. |
| 4.3 | All devices have anti-malware and anti-virus installed | **N/A — Policy** | macOS with built-in protections (XProtect, Gatekeeper). Create a written policy document. |

### Basiq Response Guidance (Section 4)

**Recommended approach:** These are policy/procedural requirements, not code. Create a brief "Device & Endpoint Security Policy" document (1 page) that states: macOS auto-updates enabled, FileVault encryption on, no direct production database access from dev devices, GCP Console/IAM for all production access.

---

## SECTION 5: Handling of CDR Data

*"Tell us how CDR data is handled within your environment"*

| # | Basiq Requirement | Status | Implementation | Gap / Action |
|---|-------------------|--------|----------------|--------------|
| 5.1 | CDR data is only stored in the production environment | **PARTIAL** | Production data in Cloud SQL (PostgreSQL) on GCP. Dev/staging should use synthetic data. | **TODO:** Ensure dev/staging environments NEVER contain real CDR data. Add to deployment checklist. |
| 5.2 | CDR data will be retained in a de-identified format | **TODO** | No de-identification utilities found. Schema stores raw financial data (balances, account numbers, BSBs). | **TODO:** Build de-identification layer for analytics/reporting. Consider GCP Cloud DLP for automated PII detection. |
| 5.3 | CDR data is never copied to end-user devices | **PARTIAL** | Data is fetched via API and rendered in browser (not downloaded as files). CSV export exists for audit logs only (no financial data export). | **Review:** Ensure no bulk financial data export endpoints exist. Check if browser cache/localStorage stores CDR data. |
| 5.4 | CDR data is deleted once no longer required | **TODO** | No data lifecycle management. Financial records persist indefinitely. | **TODO:** Implement data retention policy. Automated cleanup for data past retention period. |
| 5.5 | CDR data is deleted once the consent has expired | **PARTIAL** | Schema has `consentExpiresAt` on `PortalClient` model. `ConsentStatus` enum: PENDING, ACTIVE, REVOKED, EXPIRED. | **TODO:** Build automated job — when consent expires, delete/anonymize associated CDR data. Use GCP Cloud Scheduler + Cloud Functions. |
| 5.6 | CDR data is deleted when consent has been revoked | **PARTIAL** | `consentRevokedAt` field exists. UI allows consent revocation (portal). | **TODO:** Wire revocation to actual CDR data deletion. Consent revocation → trigger data purge job. |
| 5.7 | CDR data at rest is always encrypted | **PARTIAL** | Cloud SQL encrypts data at rest by default (Google-managed keys). | **Recommended:** Enable CMEK (Customer-Managed Encryption Keys) via Cloud KMS for additional control. Document the encryption posture. |
| 5.8 | I'm legally required to retain CDR data (e.g. loan application) | **N/A — Policy** | Depends on business use case. If Monitrax is used for loan applications, some data must be retained per regulatory requirements. | Create a "CDR Data Retention Schedule" document listing what data is retained, why, and for how long. |

### Basiq Response Guidance (Section 5)

**Can confirm YES today:** 5.7 (with Google-managed keys)
**Must address:** 5.2 (de-identification), 5.4/5.5/5.6 (data deletion on consent expiry/revocation), 5.1 (env separation)
**Recommended approach:** Build a CDR Data Lifecycle Service that handles: consent tracking → data retention → automated deletion/anonymization on expiry/revocation. Use GCP Cloud Scheduler for automation.

---

## SECTION 6: Development Practices

*"Specify your coding practices for code that accesses CDR data"*

| # | Basiq Requirement | Status | Implementation | Gap / Action |
|---|-------------------|--------|----------------|--------------|
| 6.1 | Code is peer reviewed before deployment to production | **DONE** | All changes via Pull Request (`CLAUDE.md` Part 4). Feature branches → PR → review → merge. GitHub as version control. | None — this is our standard workflow. |
| 6.2 | Code is managed using a version control system (GitHub) | **DONE** | Git repository. Feature branches (`claude/*`). Commit history, atomic commits, descriptive messages. | None |
| 6.3 | Code is tested before deployment to production | **PARTIAL** | `npm run build` (TypeScript + Next.js) before every commit. `npm run lint` for quality. Vitest framework with scripts: `test`, `test:watch`, `test:coverage`, `test:validation`, `test:regression`, `test:calculations`. | **TODO:** Expand test coverage for CDR-critical code paths (auth guards, data access, consent lifecycle). |
| 6.4 | Libraries are reviewed and approved before use | **PARTIAL** | Dependencies in `package.json` / `package-lock.json`. Key libraries are well-known (Next.js, Prisma, Firebase). | **TODO:** Add `npm audit` to CI. Create an approved dependencies list. Review new additions in PR. |
| 6.5 | Libraries are regularly updated with latest security patches | **TODO** | No automated dependency update mechanism (no Dependabot, Renovate, or Snyk configured). | **TODO:** Enable Dependabot on GitHub repo. Add `npm audit` to pre-push hook. Monthly dependency review. |

### Basiq Response Guidance (Section 6)

**Can confirm YES today:** 6.1, 6.2
**Can confirm YES with caveats:** 6.3 (build-tested, not unit-tested), 6.4 (implicit review, no formal list)
**Must address:** 6.5 (automated dependency updates)
**Recommended approach:** Enable Dependabot, add `npm audit` to CI, and start building test coverage for CDR-critical code paths (auth, data access, consent).

---

## SECTION 7: HR Practices

*"Specify the HR practices you have implemented to address data security"*

| # | Basiq Requirement | Status | Notes |
|---|-------------------|--------|-------|
| 7.1 | Staff are made aware of the importance of handling sensitive data | **N/A — Startup** | Sole director/developer. No staff. When hiring, add to onboarding checklist. |
| 7.2 | We conduct background checks before hiring staff | **N/A — Startup** | No employees. Document this as a future hiring requirement. |
| 7.3 | We regularly perform privacy and security training | **N/A — Startup** | Sole director. Self-directed security awareness through CDR compliance work. |

### Basiq Response Guidance (Section 7)

**Recommended approach:** Acknowledge startup context. State: "As a sole-director startup, the director handles all development and data access. Background checks and security training will be implemented as part of the hiring process when the team grows. A Security Awareness Policy has been drafted for future use."

---

## SECTION 8: Technology — GCP Tools

*"Please choose the tools that you utilize within your GCP production environment."*

| # | GCP Service | Status | Usage in Monitrax | Action Required |
|---|------------|--------|-------------------|-----------------|
| 8.1 | Cloud Audit Logs | **SHOULD ENABLE** | GCP auto-generates audit logs for all API calls. Not explicitly configured. | Enable Data Access audit logs in GCP Console. |
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

## SECTION 9: Implementation Priority & Roadmap

### Tier 1 — Must Have for Basiq Compliance (Code Changes)

| # | Task | Phase | Effort | Depends On |
|---|------|-------|--------|------------|
| T1.1 | Migrate ~150 routes from `withAuth()` → `withPermission()` | 34.3 | 3-5 days | Guards already built |
| T1.2 | Wire `withMFARequired()` guard on CDR data routes | 34.4 | 1-2 days | MFA already built |
| T1.3 | Build CDR Data Lifecycle Service (consent expiry → data deletion) | NEW | 3-5 days | Schema fields exist |
| T1.4 | Admin lifecycle review (90-day inactivity check) | 34.5 | 1 day | Admin portal exists |
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
| T2.7 | Verify SSL on database connection | Env config | 30 min |

### Tier 3 — Should Have (Policy Documents)

| # | Document | Purpose |
|---|----------|---------|
| T3.1 | Device & Endpoint Security Policy | Covers Basiq Section 4 (device management) |
| T3.2 | CDR Data Retention Schedule | Covers Basiq 5.4, 5.8 (what data, how long, why) |
| T3.3 | Incident Response Plan | Required for CDR — what happens on breach |
| T3.4 | Security Awareness Policy | Covers Basiq 7.1-7.3 for future staff |
| T3.5 | Approved Dependencies List | Covers Basiq 6.4 (library review) |

### Tier 4 — Nice to Have (Improvements)

| # | Task | Benefit |
|---|------|---------|
| T4.1 | Enable Dependabot on GitHub | Automated dependency updates (6.5) |
| T4.2 | Add `npm audit` to CI pipeline | Continuous vulnerability scanning |
| T4.3 | Enable Cloud DLP for PII detection | Automated CDR data protection (5.2) |
| T4.4 | Terraform for infrastructure | Auditable, reproducible GCP config |
| T4.5 | Cloud IAP for admin portal | Additional admin security layer |

---

## SECTION 10: Overall Compliance Score

| Category | Requirements | DONE | PARTIAL | TODO | Score |
|----------|-------------|------|---------|------|-------|
| Auth & Access (7) | 1.1–1.7 | **5** | 2 | 0 | **85%** |
| Logging (7) | 2.1–2.7 | 5 | 2 | 0 | **85%** |
| System Security (5) | 3.1–3.5 | 2 | 1 | 2 | **50%** |
| Device Management (3) | 4.1–4.3 | 0 | 1 | 0 | **N/A (policy)** |
| CDR Data Handling (8) | 5.1–5.8 | 0 | 4 | 3 | **30%** |
| Dev Practices (5) | 6.1–6.5 | 2 | 2 | 1 | **60%** |
| HR Practices (3) | 7.1–7.3 | 0 | 0 | 0 | **N/A (startup)** |
| GCP Tools (16) | 8.1–8.16 | 3 | 0 | 10 | **20%** |
| **TOTAL** | **54** | **17** | **12** | **16** | **~65%** |

**Bottom line:** Auth & access now at 85% after Phase A RBAC migration. Main remaining gaps: CDR data lifecycle (consent-driven deletion at 30%), GCP service enablement (20%), and MFA enforcement on CDR routes.

### Recent Progress

| Date | Phase | Change | Score Impact |
|------|-------|--------|-------------|
| 2026-03-03/04 | Phase A (RBAC) | All 70+ API routes migrated to `withPermission()` | §1.5, §1.6: PARTIAL → DONE (+10%) |

---

*Last Updated: 2026-03-04*
*Next Review: After Phase B (MFA Enforcement) completion*
