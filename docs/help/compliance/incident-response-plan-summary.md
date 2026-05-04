---
title: Incident response plan summary
audience: compliance
slug: incident-response-plan-summary
category: Incident Response
lastReviewed: 2026-05-04
complianceClass: general
order: 3
summary: Auditor-facing summary of how Monitrax identifies, contains, investigates, remediates, and reports security incidents — with explicit OAIC NDB notification timelines and the auth-chain availability playbook.
tags: [incident-response, ndb, oaic, breach, availability]
---

# Incident Response Plan Summary

This document is for compliance officers, auditors, and the privacy team at any organisation evaluating Monitrax. It is the auditor-facing summary of the **Incident Response Plan** that governs how Monitrax handles security incidents — with particular focus on Consumer Data Right (CDR) data breaches and the Notifiable Data Breaches (NDB) scheme.

The canonical operational source-of-truth is [`docs/policy/INCIDENT_RESPONSE_PLAN.md`](https://github.com/resadegh/monitrax/blob/main/docs/policy/INCIDENT_RESPONSE_PLAN.md) (version 1.1, last revised 2026-05-04). This article and the policy document stay in sync per CLAUDE.md §16.3. **If the two ever differ, the policy document wins.**

The reference frameworks are the **Privacy Act 1988** Notifiable Data Breaches (NDB) scheme, **CDR Privacy Safeguards** (Schedule 1 of the Competition and Consumer Act 2010), and the **OAIC NDB Guidance**.

## Severity classification

Every incident is classified into one of five severities at the moment of detection. The classification drives the SLA, the containment playbook, and the notification obligations.

| Severity | Definition | Response time SLA | NDB clock starts? |
|---|---|---|---|
| **CRITICAL** | CDR data breach — unauthorised access to consumer financial data, confirmed or suspected | < 1 hour | Yes — at the moment of *awareness* (per OAIC guidance) |
| **HIGH** | System compromise without confirmed CDR data access | < 4 hours | Conditional — clock starts if subsequent investigation confirms CDR data exposure |
| **HIGH (Availability)** | Production database unreachable due to auth-chain failure (no breach, full app outage) | < 1 hour | No — IAM auth was already enforced; failure means no connection, not exposure |
| **MEDIUM** | Security vulnerability discovered (not yet exploited) | < 24 hours | No |
| **LOW** | Minor security event with no data impact | < 72 hours | No |

The **HIGH (Availability)** category was added in May 2026 after the Phase 9 Workload Identity Federation cutover surfaced four distinct auth-chain failure modes. These look like "the database is down" from the user side but are availability incidents, not breach incidents — the OAIC NDB clock does not start. The auth-chain playbook is documented in IRP §10 (Appendix A — WIF & Cloud SQL Auth-Chain Failure Patterns).

## The six-phase response model

Every incident, regardless of severity, runs through six sequential phases. Skipping or compressing phases is a process violation and is itself a finding the post-incident review will record.

| Phase | Purpose | Key actions |
|---|---|---|
| **1. Identification** | Confirm the incident and classify severity | Review alert; assess scope; classify per §"Severity classification"; open incident log |
| **2. Containment** | Stop the incident from spreading | Revoke compromised sessions; disable compromised accounts; rotate secrets; block suspicious IPs; disconnect Basiq if CDR data at risk; take affected systems offline if needed |
| **3. Investigation** | Determine root cause and full impact | Review audit logs (`AuditLog` table + Cloud Logging); identify all affected users and data clusters; determine attack vector; assess whether CDR data was accessed or exfiltrated |
| **4. Remediation** | Fix the root cause and prevent recurrence | Patch the vulnerability; rotate all potentially compromised credentials; restore from known-good backup if needed; deploy fix via the standard PR process (or an emergency hotfix branch) |
| **5. Notification** | Notify affected parties per legal obligation | OAIC, affected consumers, Basiq, ACCC — see §"Breach notification timelines" below |
| **6. Recovery & Post-Incident Review** | Verify recovery, capture lessons | Confirm normal operation; verify no residual unauthorised access; conduct post-incident review within 7 days; update controls; update the IRP itself if a gap is found |

## Breach notification timelines (CDR data breach)

When an incident is classified CRITICAL — a confirmed or suspected unauthorised access to CDR data — the following notifications fire on the timelines below. The OAIC NDB clock starts at the moment Monitrax becomes *aware* of the breach (per OAIC guidance), not at the moment the breach occurred.

| Recipient | Timeline | Method | Statutory basis |
|---|---|---|---|
| **OAIC** (Office of the Australian Information Commissioner) | Within 30 days of awareness (or as soon as practicable) | NDB statement via OAIC portal | Privacy Act §26WK |
| **Affected consumers** | As soon as practicable after assessment | Email notification | Privacy Act §26WL |
| **Basiq** (CDR principal) | Immediately if CDR data involved | Direct contact per Basiq accreditation terms | Basiq accreditation agreement |
| **ACCC** (if CDR-specific) | As directed by OAIC | Formal notification | CDR Rules §7.16 |

The **NDB statement** must include: identity and contact details of Monitrax, description of the breach, types of information involved, and recommendations for affected individuals. The statement template is the OAIC's published form; Monitrax does not invent its own.

## Containment toolkit

Phase 2 containment actions are pre-built into the platform so the incident commander does not have to write code under pressure. Each action below is a single command or admin-portal click.

| Action | Mechanism |
|---|---|
| Revoke all compromised user sessions | Admin portal → Sessions → Revoke all |
| Disable a compromised user account | `PATCH /api/admin/admins/[id] { isActive: false }` |
| Rotate API keys / secrets | Vercel Environment Variables UI / GCP Secret Manager |
| Block suspicious IPs | Rate limiting middleware (`lib/middleware/apiSecurity.ts`); Cloud Armor when enabled |
| Disconnect Basiq (CDR data at risk) | `POST /api/cdr/consent { action: 'revoke_all' }` — purges all CDR data for all users within 24 hours |
| Take application offline | Vercel Project → Pause deployment |
| Revoke database access (auth-chain breach) | `gcloud projects remove-iam-policy-binding monitrax-479700 --member='serviceAccount:vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com' --role='roles/cloudsql.client'` |

The last row — IAM-revocation containment — is the unique containment mechanism the Workload Identity Federation architecture enables. Because the database has no static credential, removing one IAM binding immediately fails-closed every Vercel function instance, with full audit logging in Cloud Audit Logs. There is no static credential left behind to clean up.

## Investigation evidence sources

The investigator in Phase 3 has the following evidence sources, all timestamped and searchable:

| Source | Coverage | Retention |
|---|---|---|
| `AuditLog` table (Postgres hot) | Every authenticated API call, every state-changing operation, every CDR data access | 90 days hot |
| `AdminAuditLog` table | Every admin action (user disable, secret rotation, etc.) | 7 years |
| GCP Cloud Logging | Application logs, Cloud SQL connection logs, Vercel function logs | 365 days standard / 7 years for `CDR_DATA_*` and admin events |
| GCP Cloud Audit Logs | Every IAM-authenticated database connection (logged under the service-account principal) | Per GCP default (400 days admin / 30 days data) |
| Vercel function logs | Per-request OIDC-token exchange, STS exchange, error traces | Per Vercel retention |
| `runAnomalyDetection()` (`lib/security/cdrAuditCompliance.ts`) | Pattern detection across the audit log | Continuous |

The audit log itself never contains CDR data — `sanitizeCdrMetadata()` strips amounts, balances, account numbers, BSBs, and merchant names before write. This means the investigator can review the full incident timeline without re-exposing the data the breach concerned. This is a deliberate design choice, not a side effect.

## Auth-chain availability playbook (IRP §10)

The Phase 9 Production cutover surfaced five distinct auth-chain failure modes inside one day. Each one looked like "the database is down" from the user side, but the actual root cause was at a different layer of the chain (OIDC token retrieval, STS exchange, Cloud SQL Connector mTLS, Postgres SCRAM handshake, or cold-start init wedge).

The IRP §10 codifies these as **HIGH (Availability)** incidents — *not* breach incidents — and provides a five-step first-response playbook:

1. **Confirm the layer.** Match the error signature in Vercel function logs against the table in IRP §10.3. Don't guess; the symptoms overlap.
2. **Decide rollback vs forward-fix.** If the outage is approaching the 1-hour SLA and the fix is not ready, roll back to the legacy auth path (`USE_CLOUD_SQL_CONNECTOR=false`). Otherwise, forward-fix.
3. **Apply the matching runbook step.** The technical fixes live in `docs/operational/security/04_WIF_TROUBLESHOOTING.md` §3.A–§3.K.
4. **Verify end-to-end.** Hit `/api/health`, then load `/dashboard`. Do not close the incident on the first green health check — the cold-start wedge requires a forced cold start to fully verify.
5. **Post-incident.** No NDB notification required (no CDR breach). Append a row to IRP §10.3 if the failure mode is new — that is how the appendix grows.

The architectural reason this category does not trigger NDB obligations: IAM auth was already enforced when the failures occurred. A failure means *the application cannot connect to the database*, not that an attacker did. Without a successful authentication, no data access took place, no data was exposed, and no notification clock starts.

## Testing and drills

| Activity | Frequency | Owner |
|---|---|---|
| Review the IRP end-to-end | Annual | Director |
| Tabletop exercise (simulated breach) | Annual | Director |
| Verify notification contact details (OAIC, Basiq, GCP, Vercel) | Quarterly | Director |
| Review audit-log coverage for any new code surfaces | Quarterly | Director |

The annual tabletop exercise uses a written scenario (e.g. "compromised Basiq token, attacker queries 100 user accounts before detection") and walks the six phases in real-time without touching production systems. Findings update the IRP.

## What an auditor can independently verify

If you are reviewing Monitrax for an organisation considering adoption, you can independently verify this summary by:

1. **Reading the canonical policy** at `docs/policy/INCIDENT_RESPONSE_PLAN.md` (the SSOT this article derives from)
2. **Reading the audit-logging code** at `lib/security/auditLog.ts` and `lib/security/cdrAuditCompliance.ts`
3. **Reading the auth-chain runbook** at `docs/operational/security/04_WIF_TROUBLESHOOTING.md`
4. **Inspecting recent incident logs** — request the most recent post-incident review from your Monitrax account manager (none CRITICAL or HIGH have fired against Production CDR data to date; the May 2026 entries are HIGH (Availability) only)

## For your auditor

For specific questions about an incident scenario not covered here, contact `compliance@monitrax.com.au`. For the full operational policy this article summarises, see `docs/policy/INCIDENT_RESPONSE_PLAN.md`. For the OAIC NDB scheme, see https://www.oaic.gov.au/privacy/notifiable-data-breaches.
