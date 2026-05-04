---
title: Data handling policy summary
audience: compliance
slug: data-handling-policy-summary
category: CDR & Privacy
lastReviewed: 2026-05-04
complianceClass: privacy
order: 6
summary: How Monitrax controls staff access to data, audit trails, segregation of duties, device security, and approved-dependency review — the operational policies that protect the data the platform holds.
tags: [data-handling, access-control, audit-trail, segregation-of-duties, device-security]
---

# Data Handling Policy Summary

This document is for compliance officers, auditors, and the privacy team at any organisation evaluating Monitrax. It summarises the operational policies that govern how staff (current and future) can access data the platform holds, what is logged when they do, how duties are segregated, and how the supply chain (devices, dependencies) is controlled.

The reference frameworks are the **Privacy Act 1988** (Australian Privacy Principles 1, 6, 7, 11), the **CDR Rules under the Competition and Consumer Act 2010** (Schedule 1 Privacy Safeguards 4–13), and **Basiq's Accredited Data Recipient (ADR) accreditation requirements** (Compliance Matrix Sections 1, 2, 4, 5, 6, 7).

The canonical operational sources-of-truth are:

- [`docs/policy/DEVICE_SECURITY_POLICY.md`](https://github.com/resadegh/monitrax/blob/main/docs/policy/DEVICE_SECURITY_POLICY.md) — staff device controls
- [`docs/policy/APPROVED_DEPENDENCIES.md`](https://github.com/resadegh/monitrax/blob/main/docs/policy/APPROVED_DEPENDENCIES.md) — third-party library review
- [`docs/policy/SECURITY_AWARENESS_POLICY.md`](https://github.com/resadegh/monitrax/blob/main/docs/policy/SECURITY_AWARENESS_POLICY.md) — staff awareness and training
- [`docs/operational/security/02_IAM_AND_PERMISSIONS.md`](https://github.com/resadegh/monitrax/blob/main/docs/operational/security/02_IAM_AND_PERMISSIONS.md) — IAM and RBAC operational guide
- [`docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`](https://github.com/resadegh/monitrax/blob/main/docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md) — full CDR / Basiq compliance matrix

This article and those documents stay in sync per CLAUDE.md §16.3.

## The operating context — sole director, scaling to staff

As of May 2026, Monitrax is operated by a single director (Resadegh) under Renew Group Holding Pty Ltd. Every policy in this article applies *now* (where applicable to a single operator) and is structured to apply *as the team grows*. The policies are not a future aspiration; they are the operational rules the platform runs under today, with explicit staff-onboarding clauses ready to fire when the first hire lands.

This is documented honestly, not euphemistically. Auditors should know what the operating context is when they read this; the policies are the same regardless.

## Staff access to consumer data — controls in force

| Control | Mechanism |
|---|---|
| Unique login per staff member | GCP Identity Platform (Firebase Auth) — unique UID per email; no shared accounts |
| MFA enforced | Firebase TOTP enrollment; admin MFA enforced for `SUPER_ADMIN` and `BILLING_ADMIN` roles |
| Strong password policy | Firebase Auth password policy (12+ chars, complexity); admin passwords bcrypt(12) |
| Role-based access | 4 roles (OWNER / ADMIN / CONTRIBUTOR / VIEWER); 50+ granular permissions; least-privilege enforced on all 70+ API routes via `withPermission()` |
| Just-in-time access to consumer data | Staff cannot view consumer financial data without an explicit `cdr_data.read` permission AND active consent on the data being accessed |
| Database-level access | No staff member has direct Postgres access to Production. All queries go through the Vercel function with IAM-authenticated WIF — fully audited |
| Admin portal access | `/admin/*` routes guarded by admin-role check + admin MFA; every admin action logged to `AdminAuditLog` (7-year retention) |
| Inactive admin sweep | Admin portal flags accounts with no login in 90 days; documented in `01_AUTHENTICATION.md` |
| Background checks | Required for future staff per `SECURITY_AWARENESS_POLICY.md` §5; N/A while sole director |

Staff access to consumer financial data is **not the default**. A staff role (CONTRIBUTOR, VIEWER) does not include `cdr_data.*` permissions. Adding those permissions to a role is itself an audited admin action.

## Segregation of duties

Segregation of duties is a foundational privacy control — no single staff member should be able to grant themselves access, perform a sensitive action, and erase the trail of having done so. Monitrax enforces segregation through the audit-log architecture:

| Action | Performer | Audit logger | Reviewer |
|---|---|---|---|
| Grant a permission to a role | Admin (admin portal) | `AdminAuditLog` (immutable, 7-year retention) | Director quarterly review |
| Access CDR data | Authenticated user with `cdr_data.read` + active consent | `AuditLog` (`CDR_DATA_READ`, sanitised) + `AdminAuditLog` if admin | Director / future compliance officer |
| Delete CDR data | `lib/services/cdrDataLifecycle.ts` (service-account flow) or admin-initiated | `AuditLog` (`CDR_DATA_DELETED`) + `AdminAuditLog` | Director / future compliance officer |
| Rotate a secret | Admin (Vercel UI / GCP Secret Manager) | `AdminAuditLog` + GCP Cloud Audit Logs | Director / future compliance officer |
| Modify the audit log | **Not possible** | n/a — the audit log is append-only at the application layer; long-term retention via Cloud Logging | n/a |

The audit log itself is the segregation control. The application code path that writes audit log rows does not expose update or delete operations on those rows. The Postgres role the application runs under has `INSERT` privilege on `AuditLog` and `AdminAuditLog`, but not `UPDATE` or `DELETE` on those tables. A compromised application instance cannot tamper with the trail.

The dual-emit architecture (Postgres + Cloud Logging) provides a second segregation layer: a successful Postgres tamper would still leave the Cloud Logging copy intact and queryable, with the discrepancy itself an alertable signal.

## Audit trail — what is captured

Every state-changing action and every data-access action writes an audit-log row. The fields captured are deliberately uniform across all event classes so the trail is queryable as one stream:

| Field | Source |
|---|---|
| `userId` | The authenticated user performing the action |
| `action` | The event class — `CREATE`, `UPDATE`, `DELETE`, `EXPORT`, `BULK_DELETE`, `OAUTH_LOGIN`, `REGISTER`, `API_REQUEST`, `RATE_LIMIT_HIT`, `CDR_DATA_READ`, `CDR_DATA_INGESTED`, `CDR_DATA_DELETED`, etc. |
| `entityType` + `entityId` | The entity acted upon (e.g. `Property` / `prop_xyz`) |
| `metadata` | Sanitised context (no CDR data; `sanitizeCdrMetadata()` strips amounts, balances, account numbers, BSBs, merchant names) |
| `ipAddress` + `userAgent` | The request origin |
| `createdAt` | ISO 8601 timestamp |

Audit rows are retained 90 days hot in Postgres and 365 days standard / 7 years for `CDR_DATA_*` and admin events in Cloud Logging (see *Data Retention Schedule* for the per-event-class table).

The audit log **never contains CDR data**. This is enforced at the moment of write, not at the moment of read. An investigator can query the full audit trail without re-exposing the data the breach concerned.

## Anomaly detection

`runAnomalyDetection()` (`lib/security/cdrAuditCompliance.ts`) operates against the audit log to flag patterns that warrant investigation:

- Bulk reads from a single user / single IP in a short window
- After-hours access from a staff account
- Repeated 401/403 patterns suggesting credential-stuffing
- CDR data reads against a user whose consent has just expired or been revoked

Currently the detection is on-demand (admin portal triggers a sweep). Automated alerting via GCP Cloud Monitoring is queued in the PROD-hardening backlog (Compliance Matrix §2.5 PARTIAL → DONE).

## Device security — staff endpoints

Staff devices that can access Production systems (currently the director's laptop only) are governed by `docs/policy/DEVICE_SECURITY_POLICY.md`:

| Control | Implementation |
|---|---|
| OS patching | macOS auto-updates enabled; security patches applied within 7 days (DSP §3.1) |
| Endpoint protection | macOS XProtect (built-in, auto-updated), Gatekeeper, FileVault encryption, Application Firewall (DSP §3.3) |
| No prod-network connection | Production runs on cloud (Vercel + GCP). Dev devices connect via HTTPS API only — no SSH tunnel to Production database (DSP §3.2) |
| Disk encryption | FileVault required on all devices that can access Production; no exceptions (DSP §3.4) |
| Lost / stolen device protocol | Immediate IAM revocation of the user's GCP principal; full device wipe via Find My Mac; password reset on all systems (DSP §4) |

The DSP applies to every future hire as a precondition of being granted any access to Production systems.

## Approved dependencies — supply chain control

Monitrax operates an **Approved Dependencies List** (`docs/policy/APPROVED_DEPENDENCIES.md`) covering all 40+ npm packages used in Production. Each entry records: package name, version, purpose, license, and last-review date.

| Control | Mechanism |
|---|---|
| Approval before use | New package additions require review against `APPROVED_DEPENDENCIES.md` §3 (license compatibility, maintainer reputation, security history) |
| Continuous vulnerability scanning | `npm audit` runs in CI on every push and on a weekly schedule (`.github/workflows/security-audit.yml`); fails the build on high or critical findings |
| Automated updates | Dependabot (`.github/dependabot.yml`) opens weekly PRs for dependency updates |
| Vulnerability response | Vulnerability response policy in `APPROVED_DEPENDENCIES.md` §5 (severity-based SLA: critical < 24h, high < 7 days, medium < 30 days) |
| Removal of unapproved packages | A package not in the Approved List that appears in `package.json` is treated as a build-blocking finding |

This satisfies CDR / Basiq Section 6 (Development Practices §6.4 and §6.5) — both confirmed DONE in the compliance matrix.

## Code review — peer review before deploy

Every change to Monitrax ships through a Pull Request. The PR process is documented in CLAUDE.md Part 4:

- All changes via PR; no direct commits to `main`
- Build (`npm run build`) and lint (`npm run lint`) must pass before commit
- Schema changes require a matching migration file in the same PR (CLAUDE.md §12.12)
- Destructive Prisma writes (`update`, `upsert`, `delete`) require the §12.11 destructive-write checklist filled in
- Doc-sync block (CLAUDE.md §16.5) required for any PR that changes a covered surface

A PR that violates any of these rules is rejected at code review. The rules are not aspirational; they are enforced by both the release manager and (where applicable) the build pipeline.

## Privacy by design — what is not collected

The cleanest privacy control is the data the platform never holds. Monitrax explicitly does not collect:

- TFNs from CDR data (Basiq does not provide TFNs through CDR; we do not ingest them)
- Third-party data without explicit secondary consent
- Browser fingerprinting / cross-site tracking telemetry
- Unredacted CDR data in any log or error-response surface

Where the platform does collect TFNs (Phase 41a — `LegalEntity.tfn?` for trust / SMSF / Pty Ltd entities, queued for PROD), the storage is opt-in, encrypted at rest, never logged, and never sent to the AI advisor. The user controls visibility.

## Future-staff onboarding clauses

When the first hire lands, the following onboarding controls fire (per `SECURITY_AWARENESS_POLICY.md` §5):

| Onboarding step | Required before access granted |
|---|---|
| Background check | Per DSP §5 |
| Acceptance of acceptable-use policy | Documented signature |
| Security awareness training | Initial session covering CDR data handling, incident response, secure coding |
| Device hardening verification | DSP §3 controls in place; FileVault on; admin password reset |
| Permission grant | Documented in `AdminAuditLog`; minimum necessary for role |
| Annual refresher | Annual privacy and security training cycle (SAP §6) |

These clauses do not become operational until the first hire. They are pre-written so the platform does not have to invent them under hiring pressure.

## What an auditor can independently verify

If you are reviewing Monitrax for an organisation considering adoption, you can independently verify this summary by:

1. **Reading the canonical operational policies** — DSP, ADL, SAP, IAM operational guide
2. **Reading the audit-logging code** — `lib/security/auditLog.ts`, `lib/security/cdrAuditCompliance.ts`, `lib/admin/auditLog.ts`
3. **Reading the permission system** — `lib/auth/permissions.ts` (50+ permissions), `lib/auth/guards.ts` (`withPermission`, `withAllPermissions`, `withMFARequired`)
4. **Inspecting the admin portal** — request a sandboxed walkthrough showing audit-log search, inactive-admin sweep, and the destructive-write checklist enforcement
5. **Reading the CI configuration** — `.github/workflows/security-audit.yml`, `.github/dependabot.yml`

A compliance pack export (single-PDF bundle of the four core compliance articles + this one) is the next slice (Phase 33c). Until then, link to this URL directly.

## Open hardening items (not blockers)

Items queued in the PROD-hardening backlog that strengthen the data-handling posture without changing the policies:

- **Automated anomaly-detection alerting** via Cloud Monitoring (currently on-demand; Compliance Matrix §2.5 PARTIAL → DONE)
- **Automated retention sweep for Postgres hot audit logs** (currently manual quarterly; Compliance Matrix §2.7 PARTIAL → DONE)
- **GCP Cloud DLP** for inbound document and conversation scanning
- **Annual independent privacy-impact assessment** (queued post-Basiq submission)

## For your auditor

For specific questions about a control not covered here, contact `compliance@monitrax.com.au`. For the canonical operational policies, see the `docs/policy/` directory. For the full CDR / Basiq compliance matrix, see `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`.
