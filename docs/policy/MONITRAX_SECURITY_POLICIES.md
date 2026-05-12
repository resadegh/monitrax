# Monitrax Security Policies

**Organisation:** Renew Group Holding Pty Ltd (ABN 89 668 548 785)
**Product:** Monitrax — Financial Portfolio Intelligence Platform
**Date:** 2026-04-10
**Version:** 1.0
**Status:** ACTIVE
**Owner:** Director (Resadegh)
**Review Date:** 2026-10-10 (6-monthly review cycle)
**Based on:** Basiq CDR Compliance Security Policies Template v2.0

> This document defines the security policies governing the Monitrax platform and its handling of Consumer Data Right (CDR) data under the CDR Representative arrangement with Basiq (CDR Representative Principal). All policies comply with the Competition and Consumer Act 2010, Privacy Act 1988, and CDR Rules.

---

## Table of Contents

1. [Information Security Policy](#1-information-security-policy)
2. [Information Security Governance Framework](#2-information-security-governance-framework)
3. [Information Security Risk Management](#3-information-security-risk-management)
4. [Information Security Incident Management](#4-information-security-incident-management)
5. [Data Breach Response](#5-data-breach-response)
6. [Information Security Boundary Review](#6-information-security-boundary-review)
7. [Multi-Factor Authentication (MFA)](#7-multi-factor-authentication-mfa)
8. [Administrative Access Control](#8-administrative-access-control)
9. [Audit Logging and Monitoring](#9-audit-logging-and-monitoring)
10. [Access Control](#10-access-control)
11. [Monitoring of Application Services](#11-monitoring-of-application-services)
12. [Secure Authentication](#12-secure-authentication)
13. [Protecting Data in Transit](#13-protecting-data-in-transit)
14. [Protecting Data at Rest](#14-protecting-data-at-rest)
15. [Firewall Protection](#15-firewall-protection)
16. [Server Hardening](#16-server-hardening)
17. [End-User Device Hardening](#17-end-user-device-hardening)
18. [Data Loss Prevention](#18-data-loss-prevention)
19. [CDR Data Handling](#19-cdr-data-handling)
20. [Information Asset Lifecycle](#20-information-asset-lifecycle)
21. [Operating System and Application Patches](#21-operating-system-and-application-patches)
22. [Secure Coding Practices](#22-secure-coding-practices)
23. [Vulnerability Management](#23-vulnerability-management)
24. [Antivirus and Malware Protection](#24-antivirus-and-malware-protection)
25. [Acceptable Use Policy](#25-acceptable-use-policy)
26. [Background Checks](#26-background-checks)

---

## 1. Information Security Policy

### Introduction

This policy establishes the framework for information security within Monitrax, outlining the organisation's commitment to ensuring the confidentiality, integrity, and availability of information assets — particularly CDR (Consumer Data Right) data received via Basiq. Monitrax operates as a CDR Representative under Basiq as CDR Representative Principal, and must comply with Privacy Safeguards 2, 4, 6, 7, 8, 9, 11, 12, and 13.

### Policy Requirements

- Monitrax will conduct regular risk assessments using GCP Security Command Center and the CDR Compliance Matrix (`docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`).
- Information security controls are implemented via managed cloud services (GCP, Firebase, Vercel) following the GCP-First principle — prefer managed services over custom code.
- Access to information assets is controlled via GCP Identity Platform (Firebase Auth) with RBAC (4 roles, 50+ permissions) enforced by `withPermission()` guards on all API routes.
- An incident response plan is documented at `docs/policy/INCIDENT_RESPONSE_PLAN.md`.
- Regular monitoring is performed via audit logging (40+ event types), GCP Cloud SQL metrics, and Vercel deployment monitoring.

### Implementation

- **Responsibility:** The Director holds ultimate responsibility for information security.
- **Training:** Security awareness policy documented at `docs/policy/SECURITY_AWARENESS_POLICY.md`. Future staff will undergo onboarding training.
- **Review:** This policy is reviewed every 6 months. Next review: 2026-10-10.

---

## 2. Information Security Governance Framework

### Introduction

Information security governance at Monitrax is structured around documented build rules (CLAUDE.md), the CDR compliance framework, and GCP managed services. As a sole-director startup, governance is centralised but documented for scalability.

### Policy Requirements

- Establish and maintain a clear governance structure: Director as security owner, with documented delegation plan for future team expansion (see `docs/bau-framework/05_BAU_TEAM_STRUCTURE.md`).
- Maintain effective security policies: This document (25 policies) plus 5 standalone policy documents in `docs/policy/`.
- Regular review of security risks via CDR Compliance Matrix (quarterly) and GCP Security Command Center (continuous).
- All incidents and breaches are reported, investigated, and documented per the Incident Response Plan.

### Implementation

- **Governance authority:** Director (sole operator). Future: CISO role when team reaches 5+ members.
- **Policy repository:** `docs/policy/` (organisational), `docs/compliance/` (CDR/regulatory), `docs/operational/security/` (procedures).
- **Build rules:** `CLAUDE.md` enforces architectural standards, CDR compliance rules, and code quality standards across all development sessions.
- **Review cycle:** Quarterly compliance review, annual full policy review.

---

## 3. Information Security Risk Management

### Introduction

Monitrax identifies, assesses, and mitigates information security risks with particular focus on CDR data protection. Risk management follows the GCP-First principle — managed cloud services provide baseline security that is then enhanced with application-level controls.

### Policy Requirements

- Identify and document all information assets and corresponding risk levels. CDR data is classified as highest risk.
- Conduct regular risk assessments: automated via Dependabot (weekly), npm audit (per push), and CDR Compliance Matrix (quarterly).
- Implement risk mitigation via managed services: GCP Cloud SQL encryption, Firebase Auth, Vercel HTTPS, rate limiting middleware.
- Maintain an incident response plan (`docs/policy/INCIDENT_RESPONSE_PLAN.md`) for security incidents.
- All personnel must understand their role in protecting information assets (currently Director only; future staff per Security Awareness Policy).

### Implementation

- **Risk register:** CDR Compliance Matrix tracks all compliance risks with status (DONE/PARTIAL/TODO) and remediation actions.
- **Automated scanning:** Dependabot for dependency vulnerabilities, npm audit in CI pipeline, GCP Cloud SQL audit logging.
- **Review:** CDR Compliance Matrix reviewed quarterly. Risk posture reassessed after any material change to the system.

---

## 4. Information Security Incident Management

### Introduction

Effective incident management ensures Monitrax responds to security incidents quickly, minimises impact, and restores normal operations. This policy is particularly important for CDR data incidents, which have regulatory notification requirements under the Privacy Act 1988.

### Policy Requirements

- **Incident definition:** Any event that could compromise the confidentiality, integrity, or availability of Monitrax information assets, including CDR data.
- **Reporting:** All suspected incidents must be reported immediately to the Director. CDR data incidents must also be reported to Basiq (CDR Representative Principal).
- **Response team:** Currently the Director. Future: dedicated incident response team per `docs/bau-framework/05_BAU_TEAM_STRUCTURE.md`.
- **Response plan:** Documented at `docs/policy/INCIDENT_RESPONSE_PLAN.md` with 4 severity levels (P0–P3).
- **Post-incident review:** Conducted after every incident to identify lessons learned and improve processes.

### Implementation

- **Severity levels:** P0 (Critical — CDR data breach), P1 (High — service outage), P2 (Medium — degraded performance), P3 (Low — minor issue).
- **CDR breach notification:** OAIC within 30 days, Basiq immediately, affected consumers as soon as practicable.
- **Escalation contacts:** OAIC, Basiq compliance@basiq.io, GCP Support.
- **Testing:** Incident response plan tested annually via tabletop exercise.

---

## 5. Data Breach Response

### Introduction

This policy provides a comprehensive process for identification, assessment, response, and reporting of data breaches — with specific procedures for CDR data breaches as required under Part IIIC of the Privacy Act 1988 (Notifiable Data Breaches scheme).

### Policy Requirements

- **Identification:** Monitoring via GCP Cloud SQL audit logs, application audit logs (`createAuditLog()`), and anomaly detection (`lib/security/cdrAuditCompliance.ts`).
- **Assessment:** Determine the extent of the breach, what CDR data was compromised, and the number of affected consumers.
- **Response:** Contain the breach (revoke access, rotate credentials, isolate systems), mitigate impact, and recover.
- **Reporting:** Notify OAIC within 30 days. Notify Basiq immediately. Notify affected CDR consumers as soon as practicable.
- **Government notification:** Notify the Australian Cyber Security Centre (ACSC) as soon as practicable and no later than 30 days after becoming aware of the incident.
- **Review:** Post-breach review to identify root cause and implement preventive measures.

### Implementation

- **Detection:** `detectBruteForce()`, `detectBulkExport()`, `detectMfaFailures()` in `lib/security/cdrAuditCompliance.ts`.
- **Containment actions:** Account lockout, session revocation, API rate limiting escalation, database access restriction via GCP IAM.
- **Communication plan:** Pre-drafted notification templates for OAIC, Basiq, and consumers.
- **Records:** All breach incidents documented with timeline, scope, actions taken, and outcomes. Retained for 6 years.

---

## 6. Information Security Boundary Review

### Introduction

This policy requires regular review of the boundaries of Monitrax's data environment to ensure completeness and accuracy in protecting CDR data from security threats.

### Policy Requirements

- Review boundaries when aware of material changes to threats (e.g., new attack vectors, infrastructure changes, CDR regulation updates).
- Review boundaries at least annually, even without material changes.
- Document the current boundary: CDR data resides only in GCP Cloud SQL (australia-southeast1, Sydney).

### Implementation

- **Current boundaries:** Production database (GCP Cloud SQL Sydney), Vercel frontend (global CDN), Firebase Auth (global), Google Cloud Storage (Sydney).
- **CDR data boundary:** CDR data exists ONLY in the production Cloud SQL instance. Never in dev/UAT, never on devices, never in logs.
- **Review process:** Director reviews architecture diagram (`docs/compliance/CDR_SYSTEM_ARCHITECTURE.md`) and data flow quarterly.
- **Trigger events:** Any infrastructure migration, new third-party integration, or CDR regulation change triggers immediate boundary review.
- **Last review:** 2026-04-10 (database migration from Render to GCP Cloud SQL Sydney).

---

## 7. Multi-Factor Authentication (MFA)

### Introduction

Monitrax implements multi-factor authentication to protect CDR data access. MFA is mandatory for all routes that access CDR-protected data and for administrative operations.

### Policy Requirements

- MFA must be enabled for all user accounts accessing CDR data via Basiq routes.
- MFA must use at least two factors: password (something known) + TOTP code (something possessed via authenticator app).
- CDR data routes enforce MFA via `withMFARequired()` guard — access denied if MFA not enrolled when organisation policy requires it.
- Admin accounts (SUPER_ADMIN, BILLING_ADMIN) require MFA for all operations.
- Users must report lost MFA devices immediately.

### Implementation

- **Provider:** GCP Identity Platform (Firebase Auth) — TOTP enrollment and challenge/verification.
- **Code:** `lib/firebase/mfa.ts` (enrollment), `lib/auth/guards.ts` → `withMFARequired()` (enforcement).
- **CDR routes protected:** `app/api/basiq/connect`, `app/api/basiq/connections`, `app/api/basiq/connections/[id]`, `app/api/basiq/sync`.
- **Schema:** `User.mfaEnabled`, `Organization.mfaEnforced` fields in Prisma schema.
- **Recovery:** Firebase backup codes generated during enrollment.
- **Review:** MFA configuration reviewed quarterly in GCP Console.

---

## 8. Administrative Access Control

### Introduction

Administrative access control ensures that privileged access to Monitrax systems is granted on a least-privilege basis, with proper segregation of duties, monitoring, and accountability.

### Policy Requirements

- **Least privilege:** Access granted based on minimum permissions needed. 4 roles: Owner (full), Admin (manage), Contributor (create/edit), Viewer (read-only).
- **50+ granular permissions:** `entity.read`, `entity.write`, `entity.delete`, `entity.export` per module.
- **No shared credentials:** Every user has a unique Firebase Auth account. No generic or shared accounts.
- **Session management:** 30-minute inactivity auto-logout with 2-minute warning. Firebase tokens expire after 1 hour.
- **Monitoring:** All administrative actions logged to `AdminAuditLog`. 90-day inactivity flags on admin accounts.
- **Credential sharing prohibited:** All actions must be performed using individual login credentials.

### Implementation

- **RBAC system:** `lib/auth/permissions.ts` (permission definitions), `lib/auth/guards.ts` (enforcement).
- **Guards:** `withPermission()` on all 70+ API routes. `withOwnerOnly()` for owner-exclusive operations.
- **Admin portal:** `app/admin/` — lifecycle management, audit logs, user management.
- **Inactivity detection:** `AdminUser.lastLoginAt` tracked, `isInactive90Days` flag computed.
- **Review:** Admin account access reviewed quarterly. Inactive accounts flagged for deactivation.

---

## 9. Audit Logging and Monitoring

### Introduction

Audit logging ensures traceability and accountability of all actions within Monitrax, with particular attention to CDR data access. All logs are designed to capture security-relevant events while ensuring CDR data (financial information, account numbers, BSBs) is never stored in log entries.

### Policy Requirements

- All critical events must be logged: authentication, data access, data modification, data deletion, security events, CDR consent changes.
- Logs must NOT contain CDR data — `sanitizeCdrMetadata()` strips all financial information before logging.
- Logs must be retained for a minimum of 90 days (CDR requirement). Current retention: indefinite in PostgreSQL.
- Logs must be regularly reviewed to identify irregularities. Admin audit log UI provides filtering and export.
- Any anomalies detected must be investigated promptly.

### Implementation

- **Audit service:** `lib/security/auditLog.ts` → `createAuditLog()` with 40+ event types.
- **CDR sanitization:** `lib/security/cdrAuditCompliance.ts` → `sanitizeCdrMetadata()` strips 54+ financial field names plus pattern-based detection.
- **Event types:** CREATE, UPDATE, DELETE, EXPORT, BULK_DELETE, OAUTH_LOGIN, REGISTER, RATE_LIMIT_HIT, UNAUTHORIZED_ACCESS, FORBIDDEN_ACCESS, ACCOUNT_LOCKED, CDR_DATA_DELETED, CDR_CONSENT_EXPIRED, CDR_CONSENT_REVOKED, CDR_DATA_ANONYMIZED.
- **Storage:** `AuditLog` table in PostgreSQL (Cloud SQL). `AdminAuditLog` for admin actions.
- **Access:** Admin portal audit logs page with date/action/status filtering and CSV export.
- **Anomaly detection:** `detectBruteForce()`, `detectBulkExport()`, `detectMfaFailures()` in `lib/security/cdrAuditCompliance.ts`.
- **Review:** Monthly log review by Director. Automated alerts planned via GCP Cloud Monitoring.

---

## 10. Access Control

### Introduction

Access to Monitrax systems and CDR data is controlled through GCP Identity Platform (Firebase Auth) as the sole identity provider, combined with application-level RBAC enforced on every API route.

### Policy Requirements

- Access granted on least-privilege principle — users receive minimum permissions for their role.
- Unique accounts per user — Firebase Auth enforces per-email uniqueness. No shared or generic accounts.
- MFA required for CDR data access (see Policy 7).
- Entity-level ownership verification — users can only access their own financial data.
- Rate limiting enforced per endpoint to prevent abuse.
- Account lockout after repeated failed authentication attempts.
- 30-minute inactivity auto-logout with 2-minute warning dialog.

### Implementation

- **Identity provider:** GCP Identity Platform (Firebase Auth) — sole auth system, no custom JWT issuance.
- **RBAC:** `lib/auth/permissions.ts` defines 50+ permissions. `lib/auth/guards.ts` enforces via `withPermission()` on all 70+ routes.
- **Ownership:** `lib/utils/ownership.ts` verifies `userId` match on every data query.
- **Rate limiting:** `lib/middleware/apiSecurity.ts` — per-endpoint throttling.
- **Session:** Firebase SDK handles token refresh (1-hour expiry). Client-side inactivity timer (30 minutes).
- **Audit:** Every access attempt logged via `createAuditLog()` (success and failure).

---

## 11. Monitoring of Application Services

### Introduction

Monitrax monitors application services to ensure availability, performance, and security of systems that handle CDR data. Monitoring covers the frontend (Vercel), database (GCP Cloud SQL), authentication (Firebase Auth), and API endpoints.

### Policy Requirements

- All services accessing CDR data must have their actions logged and retained.
- Logs must be reviewed regularly for irregular or unauthorised access.
- Health check endpoints must be available for automated monitoring.
- Access to monitoring logs restricted to authorised personnel only.

### Implementation

- **Health endpoint:** `GET /api/health` — verifies database connectivity, returns system status.
- **Database monitoring:** GCP Cloud SQL Console — CPU, memory, disk, connections, replication lag metrics.
- **Frontend monitoring:** Vercel Analytics — deployment status, build logs, runtime errors.
- **Application logs:** Audit log table with 40+ event types — queryable via admin portal.
- **Uptime:** GCP Cloud Monitoring uptime checks (planned) — 5-minute intervals on `/api/health`.
- **Alerts:** GCP Cloud Monitoring alert policies (planned) — CPU >80%, disk >90%, error rate >5%.
- **Review:** Weekly monitoring review by Director.

---

## 12. Secure Authentication

### Introduction

Monitrax enforces strong authentication for all users through Firebase Auth, supporting multiple authentication methods while maintaining security standards appropriate for CDR data protection.

### Policy Requirements

- Passwords must meet minimum complexity: 12+ characters, mixed case, numbers, and symbols.
- Password history enforced by Firebase Auth — prevents reuse of recent passwords.
- Account lockout after specified failed login attempts.
- Multi-factor authentication available for all users, mandatory for CDR data routes.
- Password managers encouraged for unique, complex credentials.
- Credentials must never be shared. All actions performed under individual accounts.

### Implementation

- **Provider:** Firebase Auth manages all password policies, lockout, and credential storage.
- **Methods:** Email/password, Google OAuth, Apple OAuth, Microsoft OAuth, Facebook OAuth, Magic Links (passwordless), Passkeys (WebAuthn/FIDO2).
- **MFA:** Firebase TOTP — enrollable via settings page, enforced on CDR routes.
- **Token lifecycle:** 1-hour expiry, automatic refresh by Firebase SDK. 30-minute inactivity timeout client-side.
- **Admin passwords:** bcrypt(12), 12+ chars with complexity enforced (`lib/admin/constants.ts`).
- **Password policy review:** Firebase Auth password settings reviewed quarterly in GCP Console.

---

## 13. Protecting Data in Transit

### Introduction

All data transmitted to, from, and within Monitrax is encrypted in transit to prevent interception by unauthorised parties. This is critical for CDR data which includes account balances, transaction histories, and account identifiers.

### Policy Requirements

- All data in transit must be encrypted using TLS 1.2 or higher.
- All API communications must use HTTPS — no unencrypted HTTP channels.
- Database connections must use SSL with certificate verification.
- Third-party API calls (Basiq, Firebase, Google APIs) must use TLS.
- No CDR data transmitted via unencrypted channels (email, SMS, HTTP).

### Implementation

- **Frontend:** Vercel enforces HTTPS with automatic SSL certificate provisioning and renewal.
- **Database:** GCP Cloud SQL configured with `sslmode=require` in DATABASE_URL. SSL certificate verified during migration (2026-04-10).
- **Firebase:** All Firebase Auth API calls over TLS (enforced by Firebase SDK).
- **Basiq API:** HTTPS-only API endpoints for CDR data collection and sync.
- **Internal:** All inter-service communication within GCP uses Google's encrypted internal network.
- **Verification:** SSL configuration verified quarterly. Certificate expiry monitored.

---

## 14. Protecting Data at Rest

### Introduction

CDR data stored in Monitrax's database is encrypted at rest to prevent unauthorised access in the event of physical media compromise. Data residency requirements are met by hosting in the australia-southeast1 (Sydney) GCP region.

### Policy Requirements

- All CDR data must be encrypted at rest using AES-256 or equivalent.
- Encryption keys must be securely managed, backed up, and rotated.
- Access to CDR data restricted to authorised personnel and application services only.
- CDR data must reside in Australian jurisdiction (GCP Sydney region).
- End-user devices must use full-disk encryption (FileVault on macOS).

### Implementation

- **Database:** GCP Cloud SQL provides AES-256 encryption at rest using Google-managed keys (default). Future: CMEK via Cloud KMS for customer-managed key rotation.
- **Data residency:** Cloud SQL instance in australia-southeast1 (Sydney). Verified during migration 2026-04-10.
- **Device encryption:** macOS FileVault enabled on all development devices.
- **Backup encryption:** GCP Cloud SQL automated backups are encrypted at rest (same key).
- **Key management:** Currently Google-managed. Planned: Cloud KMS CMEK for key rotation control.

---

## 15. Firewall Protection

### Introduction

Monitrax protects its network boundaries through cloud-native security controls, restricting access to CDR data from untrusted networks and preventing unauthorised inbound connections.

### Policy Requirements

- All incoming traffic must pass through security controls before reaching CDR data.
- Access from untrusted networks must be restricted.
- Only necessary protocols (HTTPS) permitted for external access.
- Firewall configuration reviewed regularly.
- Rate limiting applied to prevent API abuse and DDoS.

### Implementation

- **Frontend:** Vercel edge network provides DDoS protection and request filtering.
- **Database:** GCP Cloud SQL configured with authorized networks list. SSL enforcement blocks unencrypted connections.
- **API rate limiting:** `lib/middleware/apiSecurity.ts` — per-endpoint throttling.
- **Inbound email webhook (SendGrid Inbound Parse → `/api/conversations/inbound`):** hardened Phase 0 / email-in. The webhook is unauthenticated in the HTTP sense (SendGrid calls it), so it enforces, in order, fail-closed: (1) a timing-safe shared secret (`INBOUND_EMAIL_SECRET`, passed as `?secret=` or `x-inbound-secret`; missing in prod = 503 misconfiguration); (2) DKIM/SPF strict mode when `INBOUND_EMAIL_REQUIRE_DKIM_SPF=true` (requires SPF=pass + a `pass` in the SendGrid `dkim` field); (3) sender allowlist — the `From` address must match the conversation's consumer participant exactly, or its domain must be in `INBOUND_EMAIL_ALLOWED_DOMAINS` (empty by default); (4) a per-conversation rate limit (`INBOUND_RATE_LIMIT_PER_HOUR = 20` EMAIL_IN messages/rolling hour) to stop auto-responder loops. Every reject writes a `BLOCKED` audit row. Verification primitives are pure + unit-tested in `lib/email/inboundSecurity.ts`. Still deferred: Cloud DLP attachment scanning, HTML→plaintext sanitisation, a proper email-reply parser.
- **Application firewall:** macOS Application Firewall enabled on development devices.
- **Planned:** GCP Cloud Armor WAF with OWASP Top 10 rules for CDR data endpoint protection.
- **Review:** Network access rules reviewed quarterly in GCP Console.

---

## 16. Server Hardening

### Introduction

Monitrax uses managed cloud services (Vercel, GCP Cloud SQL, Firebase Auth) — server hardening is primarily the responsibility of the cloud vendors. This policy documents the additional hardening measures applied at the application level.

### Policy Requirements

- All servers running CDR data services must be configured per industry standards.
- Latest security patches must be installed (managed by cloud vendors).
- Strong authentication required for all administrative access (MFA for admin roles).
- Encrypted protocols (SSL/TLS) for all remote access.
- Unnecessary services and ports disabled.
- System logs regularly reviewed and monitored.

### Implementation

- **Infrastructure:** No self-managed servers. Vercel (serverless), GCP Cloud SQL (managed PostgreSQL), Firebase Auth (managed identity). All vendor-hardened.
- **Database flags:** `log_connections=on`, `log_disconnections=on`, `log_statement=ddl` — audit trail for all database access.
- **SSL:** Enforced on Cloud SQL (`sslmode=require`). No unencrypted database connections permitted.
- **Admin access:** GCP Console via IAM (Google account + MFA). No SSH access to production systems.
- **Patching:** Automatic — vendors handle OS-level patching for managed services.

---

## 17. End-User Device Hardening

### Introduction

This policy ensures all devices used to access Monitrax systems and CDR data are secured against threats. Currently applies to the Director's development device; will extend to all staff devices upon team expansion.

### Policy Requirements

- All devices must be updated with latest security patches (within 7 days of release).
- Anti-malware software must be installed and active.
- Full-disk encryption must be enabled.
- Devices must auto-lock after period of inactivity.
- CDR data must never be stored on end-user devices — accessed via API only.
- Remote wipe capability must be available.

### Implementation

- **OS:** macOS with automatic updates enabled. Security patches applied within 7 days.
- **Anti-malware:** XProtect (built-in, auto-updated), Gatekeeper (prevents unsigned apps).
- **Encryption:** FileVault full-disk encryption enabled.
- **Firewall:** macOS Application Firewall enabled.
- **Auto-lock:** Screen lock after 5 minutes of inactivity.
- **CDR data:** Never stored locally — accessed via HTTPS API, rendered in browser only.
- **Production access:** Cloud-only via GCP Console (no direct database connections from devices).
- **Full policy:** `docs/policy/DEVICE_SECURITY_POLICY.md`

---

## 18. Data Loss Prevention

### Introduction

Monitrax implements controls to prevent unauthorised disclosure or leakage of CDR data. CDR data is accessed exclusively via API and is never exported in bulk, cached in browser storage, or included in log files.

### Policy Requirements

- Least privilege for all CDR data access — RBAC enforced on every route.
- No bulk export of CDR financial data. CSV export exists only for audit logs (no financial data).
- CDR data must not be stored in browser localStorage or sessionStorage.
- Email attachments containing CDR data must be encrypted (N/A — CDR data never sent via email).
- CDR data must not be placed on removable storage devices.
- All CDR data access must be monitored and audited. Suspicious activity reported immediately.

### Implementation

- **API-only access:** CDR data fetched via authenticated API calls, rendered in browser DOM only.
- **No bulk export:** No endpoint exports raw CDR financial data. Reports use aggregated/derived data.
- **Log sanitization:** `sanitizeCdrMetadata()` strips CDR data from all audit log entries.
- **Browser storage:** CDR data kept in React state only — not persisted to localStorage/sessionStorage.
- **Planned:** GCP Cloud DLP for automated PII detection and redaction in CDR data flows.
- **Monitoring:** Audit logs track all data access. `detectBulkExport()` flags unusual export patterns.

---

## 19. CDR Data Handling

### Introduction

This policy governs the handling of Consumer Data Right (CDR) data received from Basiq (CDR Representative Principal). CDR data includes account balances, transaction histories, account numbers, BSBs, and any derived data. Monitrax must comply with the CDR Rules and Privacy Safeguards as a CDR Representative.

### Policy Requirements

- **Consent capture:** The Basiq consent UI must be used for all consumer consent operations. The consent UI must not be modified outside Basiq dashboard configuration.
- **Data collection:** Comply with Australian Privacy Principles. Collect only what is reasonably needed (data minimisation).
- **Data storage:** CDR data stored ONLY in production environment (GCP Cloud SQL, Sydney). Never in dev/UAT, staging, or local environments.
- **Data access:** Restricted to authorised users with active consent. Access logged and monitored.
- **Data retention:** Deleted when no longer needed, when consent expires, or when consent is revoked.
- **Data de-identification:** CDR data may be de-identified via `anonymizeCDRData()` for legal retention (e.g., loan applications). De-identified data must not be re-identifiable.
- **Data deletion requests:** CDR data deleted on request except where required by Australian law or court order.
- **Basiq Events endpoint:** Monitored for consent revocation and data holder notifications.

### Implementation

- **Lifecycle service:** `lib/services/cdrDataLifecycle.ts` — `deleteCDRData()`, `checkConsentExpiry()`, `handleConsentRevocation()`, `anonymizeCDRData()`, `hasActiveCDRConsent()`.
- **Guards:** `withActiveConsent()` verifies permission + MFA + active consent before CDR data access.
- **Automated checks:** `POST /api/cdr/lifecycle` endpoint for GCP Cloud Scheduler (daily 02:00 Australia/Sydney (AEST/AEDT)).
- **Audit:** CDR_DATA_DELETED, CDR_CONSENT_EXPIRED, CDR_CONSENT_REVOKED, CDR_DATA_ANONYMIZED events logged.
- **Full policy:** `docs/compliance/CDR_DATA_RETENTION_SCHEDULE.md`, `docs/operational/security/03_CDR_COMPLIANCE.md`.

---

## 20. Information Asset Lifecycle

### Introduction

This policy outlines the management of data throughout its lifecycle — from classification and creation through storage, use, retention, and deletion — with particular focus on CDR data which has strict lifecycle requirements.

### Policy Requirements

- **Classification:** All data classified as CDR-Protected, CDR-Derived, or Non-CDR. CDR data receives highest protection.
- **Backup:** GCP Cloud SQL automated backups with 30-day retention (production), 7-day (dev). All backups encrypted.
- **Retention:** CDR data retained while consent is ACTIVE. Deleted on consent expiry/revocation. Non-CDR financial data retained while user account is active.
- **Deletion:** CDR data hard-deleted (irreversible). Non-CDR data cascade-deleted on user account removal.
- **De-identification:** `anonymizeCDRData()` for legal retention cases — strips PII while preserving aggregate data.
- **Access control:** Entity-level ownership — users access only their own data.

### Implementation

- **Classification:** Data type determined by source — Basiq-sourced = CDR-Protected. User-entered = Non-CDR.
- **Backup schedule:** Automated by GCP Cloud SQL. On-demand backups available via GCP Console.
- **Retention schedule:** `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` — comprehensive retention periods per data type.
- **Deletion service:** `lib/services/cdrDataLifecycle.ts` handles CDR deletion. Prisma cascade rules handle non-CDR.
- **Review:** Retention schedule reviewed annually.

---

## 21. Operating System and Application Patches

### Introduction

Timely patching of operating systems and application dependencies is critical for preventing exploitation of known vulnerabilities. Monitrax uses managed cloud services (auto-patched by vendors) supplemented by automated dependency scanning for application-level libraries.

### Policy Requirements

- All production services must have latest security patches installed.
- Regular scans for missing patches — Dependabot (weekly), npm audit (per commit).
- Patches tested in non-production before production deployment (Vercel preview deployments).
- Emergency patch process for critical vulnerabilities (Critical: <24h, High: <7d).

### Implementation

- **Cloud services:** Vercel, GCP Cloud SQL, Firebase Auth — auto-patched by vendors. No manual OS patching required.
- **Dependencies:** Dependabot configured (`.github/dependabot.yml`) — weekly automated PRs for npm dependency updates. Grouped by package family.
- **CI scanning:** `npm audit` runs on every push and PR via GitHub Actions (`.github/workflows/security-audit.yml`).
- **Vulnerability response SLAs:** Critical <24h, High <7d, Medium <30d, Low at next review.
- **Approved list:** `docs/policy/APPROVED_DEPENDENCIES.md` — 40+ packages documented with version, license, review date.

---

## 22. Secure Coding Practices

### Introduction

Monitrax follows secure coding practices to prevent vulnerabilities in application code, particularly for code handling CDR data. All development follows documented build rules (CLAUDE.md) with mandatory code review.

### Policy Requirements

- All code must be reviewed via Pull Request before production deployment.
- Code must follow OWASP Top 10 awareness — prevent injection, XSS, broken auth, etc.
- All API inputs validated with Zod schemas before processing.
- No business logic in API route handlers — thin wrappers calling canonical services.
- All third-party libraries reviewed and approved before use.
- CDR data must never appear in error messages, logs, URLs, or browser storage.

### Implementation

- **Code review:** All changes via GitHub Pull Request. Feature branches → PR → review → merge.
- **Validation:** Zod schemas for all API inputs (`lib/validation/*.ts`).
- **Architecture:** API routes are thin wrappers (`withPermission()` → canonical service → response). No inline calculations.
- **Type safety:** TypeScript strict mode. Prisma generates typed database queries.
- **CDR protection:** `sanitizeCdrMetadata()` strips CDR data from all logged metadata.
- **Build rules:** CLAUDE.md defines 50+ coding rules enforced across all development sessions.
- **Testing:** `npm run build` (TypeScript compilation) and `npm run lint` before every commit.

---

## 23. Vulnerability Management

### Introduction

Monitrax identifies, assesses, and remediates security vulnerabilities through automated scanning, dependency management, and planned penetration testing.

### Policy Requirements

- Regular vulnerability scanning on all production systems.
- Penetration testing conducted periodically to validate security measures.
- Vulnerabilities prioritised by severity, impact, and likelihood of exploitation.
- All scans, tests, and remediation actions documented.

### Implementation

- **Dependency scanning:** Dependabot (weekly automated PRs), npm audit (per push CI pipeline).
- **Infrastructure scanning:** GCP Security Command Center (planned — P0 priority for enablement).
- **Penetration testing:** External pen test planned before Basiq CDR go-live. Annual thereafter.
- **Remediation SLAs:** Critical <24h, High <7d, Medium <30d, Low at next quarterly review.
- **Documentation:** All vulnerabilities tracked in GitHub Issues. Remediation logged in changelogs.
- **Self-service scanning:** OWASP ZAP available for self-service application scanning.

---

## 24. Antivirus and Malware Protection

### Introduction

All devices used to access Monitrax systems must have anti-malware protection to prevent compromise of development environments and potential lateral movement to production systems.

### Policy Requirements

- All end-user devices must have anti-virus/anti-malware software installed and active.
- Anti-virus definitions must be kept up to date automatically.
- Firewall must be enabled on all devices.
- Suspicious or infected files must be reported immediately.
- Safe computing practices enforced — no opening untrusted attachments, no accessing risky sites.

### Implementation

- **macOS built-in protection:** XProtect (auto-updated malware signatures), Gatekeeper (blocks unsigned apps), MRT (Malware Removal Tool).
- **Firewall:** macOS Application Firewall enabled — blocks unauthorised incoming connections.
- **Disk encryption:** FileVault full-disk encryption active on all development devices.
- **Software control:** Only App Store and identified developer apps permitted (Gatekeeper setting).
- **No third-party AV required:** macOS built-in protection is sufficient per Apple security guidance and industry best practice for managed environments.
- **Full policy:** `docs/policy/DEVICE_SECURITY_POLICY.md`

---

## 25. Acceptable Use Policy

### Introduction

This policy defines the required security practices, behaviours, and prohibited activities for all personnel when handling CDR data and accessing Monitrax production systems.

### Policy Requirements

- **Confidentiality:** All CDR data and sensitive information must be kept confidential during and after engagement.
- **Permitted use only:** CDR data used only for providing financial tracking services to consumers. No personal use, no sale, no unauthorised disclosure.
- **Credential security:** Strong passwords enforced by Firebase Auth. Credentials never shared or written down.
- **Physical security:** Devices secured when unattended. Auto-lock enabled.
- **No removable storage:** CDR data must never be placed on USB drives or external storage.
- **No unauthorised software:** Only approved software installed on devices accessing production systems.
- **Email caution:** Suspicious emails and attachments reported immediately. No CDR data sent via email.

### Implementation

- **Enforcement:** Technical controls enforce most requirements — Firebase Auth for passwords, RBAC for access, audit logging for accountability.
- **Training:** Security Awareness Policy (`docs/policy/SECURITY_AWARENESS_POLICY.md`) covers acceptable use for current and future personnel.
- **Monitoring:** Audit logs track all system access. Anomaly detection flags unusual patterns.
- **Violations:** Documented in Incident Response Plan. May result in access revocation and further action.

---

## 26. Background Checks

### Introduction

All personnel who access CDR data environments must undergo appropriate background checks to mitigate the risk of unauthorised access by unsuitable individuals. This is a requirement for CDR data protection.

### Policy Requirements

- All personnel requiring CDR data access must undergo background checks before access is granted.
- Background checks must include criminal history, education verification, and employment history verification.
- Personnel with convictions related to fraud, theft, or data misuse may be prohibited from CDR data access.
- Background checks repeated periodically (every 3 years) and when role changes involve increased CDR data access.

### Implementation

- **Current state:** N/A — sole director/operator. No employees.
- **Future staff:** Background check process documented in `docs/policy/SECURITY_AWARENESS_POLICY.md` §5.
- **Onboarding process:** Week 1: background check initiated. Access to CDR data granted only after check completion.
- **Vendor:** Background check provider to be selected when first hire is planned.
- **Records:** Background check results retained per HR requirements. Access to records restricted to Director/HR.
- **Review:** Process reviewed annually and updated when hiring requirements change.

---

## Document Review History

| Date | Version | Reviewer | Changes |
|------|---------|----------|---------|
| 2026-04-10 | 1.0 | Director | Initial creation — 26 policies customised from Basiq template |

---

*This document is the single authoritative source for Monitrax security policies.*
*Based on: Basiq CDR Compliance Security Policies Template v2.0*
*Next review: 2026-10-10*
