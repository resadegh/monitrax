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
