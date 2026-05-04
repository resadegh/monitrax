---
title: CDR consent walkthrough
audience: compliance
slug: cdr-consent-walkthrough
category: CDR & Privacy
lastReviewed: 2026-05-04
complianceClass: cdr
order: 1
summary: The end-to-end consent journey for CDR-regulated data flowing through Monitrax — from the user clicking "connect bank" through to revocation and data deletion.
---

# CDR Consent Walkthrough

This document is for compliance officers, auditors, regulators, and the legal team at any organisation evaluating Monitrax. It walks the full lifecycle of a Consumer Data Right (CDR) consent inside the Monitrax platform — from initial grant, through active use, to revocation and verified data deletion.

The reference framework is the **CDR Rules under the Competition and Consumer Act 2010** and **Basiq's Accredited Data Recipient (ADR) accreditation requirements**. Monitrax is currently in the Basiq ADR accreditation pipeline (target completion ~Q3 2026).

## Three layers of consent — never collapsed

Monitrax operates three independent consent layers. They are stored separately, audited separately, and revoked independently.

| Layer | Granted by → to | Storage | Revocation | Audit log code |
|---|---|---|---|---|
| **CDR consent** | User → Monitrax (via Basiq) | `Consent` table, status `ACTIVE` | User-initiated; triggers data purge | `CDR_DATA_*` |
| **Professional consent** | User → Organisation/Seat | `OrganizationClient` row with `accessScopes[]` | User-initiated; revokes scopes immediately | `PRO_ACCESS_GRANTED/REVOKED` |
| **Per-view access event** | Implicit on each professional render | `ClientAccessLog` row | Read-only history | `PRO_VIEW`, `PRO_NOTE`, `PRO_TASK`, `PRO_EXPORT` |

Critically, the platform code rejects any data access that does not pass the appropriate consent check. The check happens at the **service layer** (`getMasterFinancialSnapshot()`), not at the UI layer — meaning even a misrouted UI cannot leak data the consent doesn't cover.

## The consent grant flow

1. **User initiates** — clicks "Connect bank" on the Monitrax dashboard
2. **Redirect to Basiq** — Monitrax does not display the consent UI itself; the CDR Rules require an accredited intermediary
3. **User reviews and approves** — at Basiq's consent UI, the user sees: which institution, which data clusters, retention period, sharing scope (Monitrax only)
4. **Basiq returns a `consentId`** — Monitrax stores it in the `Consent` table with `status: ACTIVE`
5. **Data flows in** — Basiq pushes data to the Monitrax-side webhook; Monitrax stores it tagged to the `consentId`
6. **Audit log written** — `CDR_DATA_INGESTED` row with the consent ID, data cluster, timestamp, source IP

## During active consent

While the consent is `ACTIVE`:

- **Every read of CDR data writes an audit log row** (`CDR_DATA_READ`) tagged with the user, the requesting service, and the data cluster
- **No CDR data appears in audit log metadata itself** — sanitised via `sanitizeCdrMetadata()` before write (account numbers, BSBs, transaction descriptions are stripped or hashed)
- **No CDR data appears in error responses** — errors from CDR-touching code paths return generic messages to the client
- **No CDR data appears in browser localStorage / sessionStorage** — kept in React state only, scoped to the auth session
- **No CDR data is sent to third-party services** without an explicit secondary consent

## Consent expiry

CDR consents expire by default (per CDR Rules — typically 12 months, configurable per consent at grant time). When `consentExpiresAt` passes:

1. **GCP Cloud Scheduler** triggers daily consent-expiry sweep
2. The sweep marks expired consents `EXPIRED`
3. Associated CDR data is **deleted or de-identified beyond recovery** within 24 hours
4. The deletion is logged as `CDR_DATA_DELETED` with the consent ID and deletion timestamp
5. The user is notified that data has been deleted and can re-consent if they want continued service

## User-initiated revocation

A user can revoke consent at any time from **Settings → Privacy → Consents**. Revocation flow:

1. User clicks **Revoke** on the consent
2. Monitrax marks consent `REVOKED` synchronously
3. **Within 24 hours**, all associated CDR data is deleted or de-identified beyond recovery
4. Deletion is logged as `CDR_DATA_DELETED` with the consent ID
5. The user receives a confirmation email with the deletion timestamp
6. Any professional accessing the user's data via this CDR consent loses access immediately (their `OrganizationClient.accessScopes` is filtered to exclude CDR-derived scopes)

There is **no soft-delete** for CDR data. Once revoked or expired, the data is gone — irretrievable, even to Monitrax engineers. This is by design and is a CDR Rules requirement.

## Encryption

| Layer | Status |
|---|---|
| At rest (database) | AES-256 via Cloud SQL default encryption (CMEK migration in PROD-hardening backlog) |
| In transit (Basiq → Monitrax) | TLS 1.3 mandatory |
| In transit (Monitrax → Vercel function) | TLS 1.3 via Vercel edge |
| In transit (Vercel function → Cloud SQL) | TLS 1.3 via Cloud SQL Connector with mTLS |
| Document storage (Cloud Storage) | AES-256 at rest, signed URLs with 5-min expiry for download |

## Database access

Production database access is via **Workload Identity Federation + Cloud SQL Connector + IAM database authentication**. Critical properties:

- **No static credential exists** in any runtime env var or secret store
- The Vercel function reads its OIDC token from a per-request HTTP header (`x-vercel-oidc-token`), exchanges it via GCP STS for a short-lived service account token, opens a TLS 1.3 tunnel via the Cloud SQL Connector, and uses the same SA token as the per-connection Postgres "password" (rotated automatically per connection)
- Every connection is logged in **GCP Cloud Audit Logs** under the SA principal — full audit trail
- The SA's permissions are scoped to `Cloud SQL Client` + `Cloud SQL Instance User` — minimum necessary

This closes CDR `§3.2` (network rules + credential management) at the platform layer.

## Authentication & MFA

- **GCP Identity Platform (Firebase Auth)** is the sole identity provider
- **MFA (TOTP)** is enforced on all CDR-touching routes
- **Session timeout** is 30 minutes idle with a 2-minute warning
- **Account lockout** triggers after 5 failed attempts; reset via email

## Audit log retention

- **PostgreSQL** stores audit logs hot for 90 days (CDR minimum)
- **GCP Cloud Logging** stores audit logs for 365 days (CDR-encouraged)
- Both writes are dual-emit — one event in two places, query-able from either

For a full architecture diagram, see *Architecture Overview for Compliance Officers* (coming soon). For data retention specifics by data class, see *Data Retention Schedule* (coming soon). For incident response, see the *Incident Response Plan* in `docs/policy/INCIDENT_RESPONSE_PLAN.md`.

## Open questions for the Basiq submission

A handful of compensating controls and queued hardening items remain before the Basiq submission:

- **Pen test** — to be commissioned (PROD-hardening backlog)
- **Cyber/professional liability insurance** — to be bound (PROD-hardening backlog)
- **CMEK encryption** for Cloud SQL — queued (currently using GCP-managed keys)
- **Cloud Armor (WAF)** — queued
- **Security Command Center** — queued
- **Cloud DLP** — queued for inbound document and conversation scanning

These items do not block consent operation today; they harden the surface ahead of Basiq submission.

## For your auditor

If you're reviewing Monitrax for an organisation considering adoption, you can:

1. Reference `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` for the full requirement-by-requirement compliance matrix
2. Reference `docs/operational/security/03_CDR_COMPLIANCE.md` for operational evidence
3. Request a compliance pack export (one-click PDF bundle covering this article + retention schedule + incident response + architecture overview) from your Monitrax account manager

For specific questions, contact `compliance@monitrax.com.au`.
