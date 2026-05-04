---
title: Data retention schedule
audience: compliance
slug: data-retention-schedule
category: CDR & Privacy
lastReviewed: 2026-05-04
complianceClass: cdr
order: 2
summary: Per-data-class retention windows, legal basis, deletion triggers, and de-identification rules for every category of data Monitrax holds — CDR-protected, CDR-derived, and Non-CDR.
tags: [retention, cdr, privacy-act, deletion, de-identification]
---

# Data Retention Schedule

This document is for compliance officers, auditors, and the privacy team at any organisation evaluating Monitrax. It is the operational schedule that controls how long every category of data is retained, what triggers deletion, and how data is de-identified when legal retention is required beyond consent.

The reference frameworks are the **CDR Rules under the Competition and Consumer Act 2010**, the **Privacy Act 1988** (Australian Privacy Principles, particularly APP 11), and **Basiq's Accredited Data Recipient (ADR) accreditation requirements** (Compliance Matrix §5.4, §5.5, §5.6, §5.8).

The canonical operational source for these rules is [`docs/policy/CDR_DATA_RETENTION_SCHEDULE.md`](https://github.com/resadegh/monitrax/blob/main/docs/policy/CDR_DATA_RETENTION_SCHEDULE.md). The policy document and this article stay in sync per CLAUDE.md §16.3.

## Three data classes, three retention regimes

Every row in every Monitrax table belongs to exactly one of these three classes. Retention rules differ by class, not by table.

| Class | Definition | Default retention | Deletion trigger |
|---|---|---|---|
| **CDR-protected** | Data received from a financial institution via the CDR regime — account balances, transactions, BSBs, account numbers, loan details, income records | While consent is `ACTIVE`; deleted within 24 hours of expiry/revocation | Consent expiry, consent revocation, user account deletion |
| **CDR-derived** | Data computed from CDR-protected inputs — health scores, net worth, cashflow forecasts, savings ratios, debt metrics | Same as the CDR-protected inputs that produced it | Triggered cascade when underlying CDR-protected data is deleted |
| **Non-CDR** | User-entered data and platform metadata — profile fields, preferences, manually-entered properties, audit logs | While the user account is active; deleted within 30 days of account closure (audit logs retained per §"Audit log retention") | User account deletion, retention-policy sweep |

CDR data is **never** retained by default beyond consent. There is no soft-delete and no archival fallback. This is by design and is a CDR Rules requirement.

## Retention table — by data category

| Category | Class | Retention | Legal basis | Deletion mechanism |
|---|---|---|---|---|
| Account balances (Basiq-sourced) | CDR-protected | While consent `ACTIVE`; ≤ 24h after expiry/revoke | CDR Rules §1.10 | `deleteCDRData()` in `lib/services/cdrDataLifecycle.ts` |
| Transaction history (Basiq-sourced) | CDR-protected | While consent `ACTIVE`; ≤ 24h after expiry/revoke | CDR Rules §1.10 | Same |
| BSBs, account numbers (Basiq-sourced) | CDR-protected | While consent `ACTIVE`; ≤ 24h after expiry/revoke | CDR Rules §1.10 | Same |
| Loan account data (Basiq-sourced) | CDR-protected | While consent `ACTIVE`; ≤ 24h after expiry/revoke | CDR Rules §1.10 | Same |
| Income records (Basiq-sourced) | CDR-protected | While consent `ACTIVE`; ≤ 24h after expiry/revoke | CDR Rules §1.10 | Same |
| Health score / financial health metrics | CDR-derived | Cascade-deleted with source CDR data | CDR Rules §1.10 (derived data) | Cascade in `deleteCDRData()` |
| Net worth snapshot (CDR-sourced components) | CDR-derived | Cascade-deleted with source CDR data | CDR Rules §1.10 (derived data) | Cascade in `deleteCDRData()` |
| Cashflow projections (CDR-sourced components) | CDR-derived | Cascade-deleted with source CDR data | CDR Rules §1.10 (derived data) | Cascade in `deleteCDRData()` |
| Manually entered properties / loans / investments | Non-CDR | While user account active; ≤ 30 days after closure | APP 11 (security and integrity) | User-initiated delete + retention sweep |
| Household / dependant data | Non-CDR | While user account active; ≤ 30 days after closure | APP 11 | Same |
| User profile, preferences, UI settings | Non-CDR | While user account active; ≤ 30 days after closure | APP 11 | Same |
| Authentication audit logs | Non-CDR | 365 days (Cloud Logging) / 90 days (Postgres hot) | CDR Rules §3.8–§3.14, Basiq §2.7 | Time-based purge in Cloud Logging; Postgres truncation per retention sweep |
| API request audit logs | Non-CDR | 365 days (Cloud Logging) / 90 days (Postgres hot) | CDR Rules §3.8–§3.14 | Same |
| `CDR_DATA_*` audit logs (read / ingest / delete) | Non-CDR (sanitised) | 7 years | Privacy Act 1988 §15B (record-keeping for breach assessment) | Long-term retention in Cloud Logging; never auto-purged |
| Admin audit logs | Non-CDR | 7 years | Corporations Act §286 (financial record-keeping where applicable); Privacy Act §15B | Long-term retention |
| Conversation transcripts (professional ↔ client) | Non-CDR | 7 years (compliance archive); soft-delete from user view at any time | Corporations Act §912F (AFSL record-keeping for 7 years post-engagement); ASIC RG 36 §36.81 | Soft-delete from user view + immutable retention in compliance archive bucket |
| Consent records (`Consent` table) | Non-CDR | 7 years post-revocation/expiry | CDR Rules §7.10 (consent record-keeping) | Long-term retention; `status` flips ACTIVE → EXPIRED/REVOKED, row never deleted |
| Document uploads (Cloud Storage) | Mixed (depends on content) | While user account active; ≤ 30 days after closure | APP 11 | Cloud Storage lifecycle rule + user-initiated delete |

## Legal-retention overrides

In a small number of cases, Monitrax retains data beyond the consent window because Australian law requires it. In every such case, the data is **de-identified** before retention. De-identification means the identifying fields (account numbers, BSBs, merchant names, names) are stripped or hashed; aggregate amounts and dates are preserved for the legal record.

| Override | Why retained | What we keep | What we strip |
|---|---|---|---|
| Loan application records | Corporations Act §912F (7 years for AFSL holders); Credit Code §17 | Aggregate loan amounts, dates, decision outcome | Account numbers, BSBs, lender-side internal IDs, merchant names |
| Tax-preparation records (where the user has used a TPB-registered tax professional via Ask-a-Pro) | Tax Agent Services Act 2009 §50-5 (5 years) | Aggregate income/deduction figures, advice received | Account numbers, BSBs, transaction-level merchant detail |
| Conversation transcripts (AFSL professional engagements) | Corporations Act §912F + ASIC RG 36 §36.81 (7 years) | Full thread for the compliance archive | Stored encrypted; access gated by `withPermission('compliance.read')` |
| Notifiable Data Breach (NDB) incident records | Privacy Act §15B; OAIC NDB scheme | Incident detail, affected user count, remediation, notification timeline | Sanitised CDR detail per `sanitizeCdrMetadata()` |

The de-identification function is `anonymizeCDRData()` in `lib/services/cdrDataLifecycle.ts`. It is applied at the moment the legal-retention override fires, not at consent revocation — until the override fires, the data is deleted under the standard CDR rule.

## Deletion mechanism — exact technical guarantees

| Layer | Guarantee |
|---|---|
| Postgres (Cloud SQL) | `DELETE` (not soft-delete) for all CDR-protected and CDR-derived rows. Row is gone; cannot be restored from app code |
| Cloud SQL backups | Backups retain deleted rows for the configured backup window (currently 7 days). On expiry, the backup is rotated out and the deleted row is unrecoverable from any Monitrax-controlled storage |
| Cloud Logging | Audit logs **about** the deletion (`CDR_DATA_DELETED`) are retained 7 years. Audit logs **of CDR data** never existed — `sanitizeCdrMetadata()` strips CDR detail at the point of write |
| Cloud Storage (documents) | User-initiated delete is immediate (signed-URL revocation + object deletion). Cloud Storage lifecycle rule sweeps stale documents 30 days after user account closure |

There is no engineering process by which a Monitrax engineer can recover deleted CDR data. By Day 8 after deletion, every layer of storage Monitrax controls has either purged the row or rotated out the backup that held it.

## Automated enforcement

| Enforcement | Frequency | Owner |
|---|---|---|
| Consent expiry sweep (`checkConsentExpiry()`) | Daily, 02:00 UTC, GCP Cloud Scheduler → `POST /api/cdr/lifecycle` | Director |
| Stale Cloud Storage object purge | 30 days post-account-closure (Cloud Storage lifecycle rule) | Director |
| Postgres hot-audit-log truncation | Quarterly (manual until automated retention policy lands per Basiq §2.7 PARTIAL row) | Director |
| Long-term audit log retention (Cloud Logging) | Continuous; 365-day standard / 7-year for `CDR_DATA_*` and admin events | Director |

The consent expiry sweep is the load-bearing automation. If it stops running for any reason, the on-call operator follows the *Incident Response Plan* (`docs/policy/INCIDENT_RESPONSE_PLAN.md` §3) at HIGH (Availability) severity — there is no breach (no data was exposed), but the regulatory clock keeps ticking.

## What an auditor can independently verify

If you are reviewing Monitrax for an organisation considering adoption, you can independently verify the schedule by:

1. **Reading the canonical policy** at `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` (the SSOT this article derives from)
2. **Reading the deletion service** at `lib/services/cdrDataLifecycle.ts` — exported functions `deleteCDRData()`, `anonymizeCDRData()`, `checkConsentExpiry()`, `handleConsentRevocation()`
3. **Reading the audit-log sanitiser** at `lib/security/cdrAuditCompliance.ts` — exported function `sanitizeCdrMetadata()`
4. **Inspecting a sample of `CDR_DATA_DELETED` audit log rows** via the Admin Portal `/admin/audit-logs` (filter `action=CDR_DATA_DELETED`) to confirm deletion is logged with consent ID and timestamp

A compliance pack export (single-PDF bundle covering this article + the CDR consent walkthrough + the incident response summary + the architecture overview) is the next slice (Phase 33c). Until then, link to this URL directly.

## Open hardening items

Items queued in the Production-hardening backlog that strengthen the retention posture without changing the rules:

- **CMEK (Customer-Managed Encryption Keys)** for Cloud SQL — currently using GCP-managed keys (queued)
- **Cloud DLP** for inbound document scanning — automatic PII detection on uploaded documents (queued)
- **Automated retention sweep for Postgres hot audit logs** — currently manual quarterly truncation; Basiq §2.7 PARTIAL → DONE (queued)

These do not weaken any retention guarantee; they harden the surface ahead of the Basiq submission.

## For your auditor

For specific questions about a data category not listed here, contact `compliance@monitrax.com.au`. For the canonical operational policy this article summarises, see `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md`. For the deletion service implementation, see `lib/services/cdrDataLifecycle.ts`.
