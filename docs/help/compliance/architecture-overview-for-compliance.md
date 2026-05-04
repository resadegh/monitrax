---
title: Architecture overview for compliance officers
audience: compliance
slug: architecture-overview-for-compliance
category: Architecture & Security
lastReviewed: 2026-05-04
complianceClass: general
order: 4
summary: System architecture from a compliance-officer lens — identity stack, database, deployment, document storage, AI, what's encrypted where, what's logged where, and the data residency story.
tags: [architecture, gcp, vercel, cloud-sql, wif, residency]
---

# Architecture Overview for Compliance Officers

This document is for compliance officers, auditors, and the security team at any organisation evaluating Monitrax. It describes the production architecture from a compliance lens — *who can access what data, where it sits, how it gets there, what protects it in transit and at rest, and where the audit trail lives*.

The reference frameworks are the **CDR Rules under the Competition and Consumer Act 2010** (particularly §3.15–§3.19 system security and §3.23–§3.30 CDR data handling), the **Privacy Act 1988** (APP 11 security and integrity), and **Basiq's Accredited Data Recipient (ADR) accreditation requirements** (Compliance Matrix Section 3 and Section 8).

The canonical architecture sources-of-truth are [`docs/architecture/01_ARCHITECTURE_OVERVIEW.md`](https://github.com/resadegh/monitrax/blob/main/docs/architecture/01_ARCHITECTURE_OVERVIEW.md), [`docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md`](https://github.com/resadegh/monitrax/blob/main/docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md), and [`docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`](https://github.com/resadegh/monitrax/blob/main/docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md). This article and those documents stay in sync per CLAUDE.md §16.3.

## Data residency

All consumer data — CDR-protected, CDR-derived, and Non-CDR — is stored in **australia-southeast1 (Sydney)**. No consumer data is replicated, mirrored, backed up, processed, or otherwise handled outside Australia.

| Data category | Location |
|---|---|
| Primary database (Postgres) | GCP Cloud SQL — `monitrax-db-prod`, region `australia-southeast1` |
| Database backups | Same region (Cloud SQL automated backups) |
| Document storage | GCS bucket, region `australia-southeast1` |
| Identity (Firebase Auth) | GCP Identity Platform, AU-resident user records |
| Audit logs (hot) | Postgres in `australia-southeast1` |
| Audit logs (long-term) | GCP Cloud Logging, region pinned `australia-southeast1` |
| Vercel function execution | `syd1` region (pinned in `vercel.json`) — Vercel Pro plan enables region pinning |

This satisfies CDR data residency requirements (data must remain in Australia). It also satisfies the Basiq §2.3 *"disclose CDR data overseas"* requirement, which Monitrax answers **False**.

## The four trust boundaries

Every data-flow concern at Monitrax crosses one of four trust boundaries. Understanding these is the cleanest way to evaluate the architecture from a compliance lens.

| Boundary | Crossing point | Protection |
|---|---|---|
| **Browser → Vercel** | User opens any page or hits any API | TLS 1.3 mandatory; Firebase ID token in `Authorization` header; Vercel edge network |
| **Vercel function → GCP** | Server reads/writes from Cloud SQL or GCS | Workload Identity Federation + IAM (no static credential) — see §"Database access" |
| **Vercel function → Basiq** | Server pulls CDR data from Basiq | TLS 1.3 mandatory; per-user Basiq token in Authorization header; consent ID tagged on every read |
| **Vercel function → Gemini** | Server sends de-identified summaries to AI | TLS 1.3; CDR detail stripped at the boundary; see §"AI processing boundary" |

## Identity stack — Firebase + WIF + IAM

Monitrax uses three different identity systems, each for a different purpose. They never overlap.

| Identity system | Used for | Token type | Lifetime |
|---|---|---|---|
| **GCP Identity Platform (Firebase Auth)** | End-user authentication (consumer logins, professional logins, admin logins) | Firebase ID token (JWT) | 1 hour, auto-refreshed by SDK |
| **Workload Identity Federation (WIF)** | Vercel function → GCP Cloud SQL / Cloud Storage authentication | OIDC token from Vercel → federated GCP access token via STS | Per-request; SA access token short-lived |
| **Cloud IAM (database)** | Postgres-level authorisation for the impersonated SA | Cloud IAM database authentication using SA access token as per-connection password | Per-connection, rotated automatically |

End users never touch GCP IAM. The Vercel function never holds a long-lived database password. The audit trail for every database connection lives in GCP Cloud Audit Logs under the service account principal.

## Database access — no static credential

Production database access is via **Workload Identity Federation + Cloud SQL Connector + IAM database authentication**. This was cut over from the legacy `DATABASE_URL` (long-lived password) flow on **2026-05-01 (Phase 9)**.

The exact six-step auth chain on every database query:

1. **Vercel function** receives a request and reads its OIDC token from the per-request `x-vercel-oidc-token` header
2. **STS exchange:** the function exchanges the OIDC token for a federated Google access token via Workload Identity Pool `vercel-pool` + provider `vercel-oidc`
3. **SA impersonation:** the federated token impersonates `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com`, yielding a short-lived OAuth access token
4. **Cloud SQL Connector:** opens a TLS 1.3 tunnel to `monitrax-db-prod` using the SA's `Cloud SQL Client` IAM role and an ephemeral client cert
5. **Postgres handshake:** pg sends the SA's access token as the per-connection password; Cloud SQL validates it against the matching IAM database user
6. **Schema authorisation:** Postgres checks the IAM DB user has `CONNECT` and `USAGE` + table privileges on schema `public`

**Critical properties from a compliance lens:**

- **No static credential exists** in any runtime env var, secret store, or configuration file
- The SA's permissions are scoped to `Cloud SQL Client` + `Cloud SQL Instance User` — minimum necessary
- Every connection is logged in Cloud Audit Logs under the SA principal — full audit trail
- A break at any layer fails-closed (the application cannot connect, but no data is exposed)
- Containment in a breach scenario is one IAM-binding removal away (immediate, fully audited)

Evidence pack: `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md` (§7 Phase 9 cutover record, §8 compensating-control rationale). Code: `lib/db.ts`. Runbook for failure modes: `docs/operational/security/04_WIF_TROUBLESHOOTING.md`.

This closes CDR §3.2 (network rules + credential management) at the platform layer. The compensating-control rationale for retaining the `0.0.0.0/0` authorized-network entry on Cloud SQL is documented in the evidence pack §8 — the network ACL was historically protecting a long-lived password that no longer exists; the controlling boundary is now IAM. The decision is revisitable at first-paying-user / pre-Basiq-submission.

## Encryption posture

| Layer | Encryption |
|---|---|
| At rest — Postgres (Cloud SQL) | AES-256 via GCP-managed keys (CMEK migration queued in PROD-hardening backlog) |
| At rest — Cloud Storage (documents) | AES-256 via GCP-managed keys |
| At rest — Cloud Logging | AES-256 via GCP-managed keys |
| In transit — Browser → Vercel | TLS 1.3 mandatory (Vercel edge enforces) |
| In transit — Vercel → GCP services | TLS 1.3 (gRPC + REST) |
| In transit — Vercel → Cloud SQL | TLS 1.3 via Cloud SQL Connector with mTLS |
| In transit — Basiq → Monitrax (webhook) | TLS 1.3 mandatory |
| In transit — Vercel → Gemini API | TLS 1.3 |
| Document download URLs (Cloud Storage) | Signed URLs with 5-minute expiry |

CMEK migration is queued in the PROD-hardening backlog. Until CMEK lands, Cloud SQL uses GCP-managed keys (which is itself a CDR-acceptable baseline; CMEK is the strictness uplift Basiq accreditation prefers, not a regulatory minimum).

## Audit logging — what gets logged where

Every authenticated API request, every state-changing database operation, every CDR data access, and every administrative action is logged. The audit log is dual-emit: one event lands in Postgres for hot search and one event lands in Cloud Logging for long-term retention.

| Event class | Hot store (Postgres) | Long-term store (Cloud Logging) | Sanitisation |
|---|---|---|---|
| Authentication (login, logout, MFA challenge) | `AuditLog` table — 90 days | Cloud Logging — 365 days | Email logged; password never logged |
| API request (every authenticated call) | `AuditLog` — 90 days | Cloud Logging — 365 days | CDR detail stripped via `sanitizeCdrMetadata()` |
| State-changing operation (create / update / delete) | `AuditLog` — 90 days | Cloud Logging — 365 days | CDR detail stripped |
| CDR data access (`CDR_DATA_READ` / `CDR_DATA_INGESTED`) | `AuditLog` — 90 days | Cloud Logging — 7 years | CDR detail stripped; consent ID + cluster recorded |
| CDR data deletion (`CDR_DATA_DELETED`) | `AuditLog` — 90 days | Cloud Logging — 7 years | Consent ID + deletion timestamp |
| Admin action (user disable, secret rotation, etc.) | `AdminAuditLog` — 7 years (no auto-purge) | Cloud Logging — 7 years | Action + actor logged; sensitive payloads redacted |
| Database connection (IAM-authenticated) | n/a — handled by GCP | Cloud Audit Logs — GCP default | SA principal + connection metadata |
| Vercel function trace (per-request) | n/a — handled by Vercel | Vercel logs + Cloud Logging | TLS termination, no payload bodies |

The audit log itself **never contains CDR data**. `sanitizeCdrMetadata()` (`lib/security/cdrAuditCompliance.ts`) strips amounts, balances, account numbers, BSBs, and merchant names before write. This means an investigator can review the full incident timeline without re-exposing the data the breach concerned.

## Authentication & MFA

- **GCP Identity Platform (Firebase Auth)** is the sole identity provider for end users
- **MFA (TOTP)** is enforced on all CDR-touching API routes via the `withMFARequired()` server-side guard
- **Admin MFA** is enforced for `SUPER_ADMIN` and `BILLING_ADMIN` roles
- **Session timeout** is 30 minutes idle with a 2-minute warning dialog
- **Account lockout** triggers after 5 failed attempts; reset via email
- **Strong passwords** are enforced by Firebase Auth's password policy

The MFA enforcement is server-side, not client-side. A misrouted UI cannot bypass it — the API guard rejects the request before any data fetch.

## RBAC & permissions

Monitrax uses a permission-based RBAC system, not a role-based one. Roles are sugar over the underlying 50+ permissions defined in `lib/auth/permissions.ts`.

| Role | Default permissions |
|---|---|
| **OWNER** | Full org access (entity create / read / update / delete, all CDR scopes, billing, member management) |
| **ADMIN** | Full org access except billing |
| **CONTRIBUTOR** | Entity create / read / update; no delete; no admin |
| **VIEWER** | Entity read only |

Every API route is wrapped with `withPermission(req, '<entity>.<action>')` — applied to all 70+ API routes (Phase A complete, PR #438). CDR data routes additionally require `cdr_data.read` / `cdr_data.write` / `cdr_data.delete` permissions plus active consent verification at the service layer.

Ownership verification is enforced at `lib/utils/ownership.ts` — a user with `entity.read` permission can only read entities they own (or that are scoped to them via `OrganizationClient.accessScopes`). A misrouted UI cannot leak data the user doesn't own.

## Document storage

Document uploads (statements, ID documents, deeds) are stored in **GCS, region `australia-southeast1`**:

- **Encryption at rest:** AES-256 via GCP-managed keys
- **Access:** signed URLs with 5-minute expiry — never a permanent public URL
- **Lifecycle:** Cloud Storage lifecycle rule sweeps stale objects 30 days after user account closure
- **Inbound scanning:** Cloud DLP for PII detection is queued in the PROD-hardening backlog

Documents are not part of the CDR data flow (they are user-uploaded, not Basiq-sourced). They are subject to APP 11 of the Privacy Act and to user-initiated delete at any time.

## AI processing boundary

Monitrax uses **Google Gemini** for the AI advisor surface (the user-facing CFO and the Practice-side adviser overlay). The AI processing boundary is deliberately narrow:

- **What goes to Gemini:** de-identified summaries — aggregate balances, category totals, ratios, TRAIL stage, user-entered context — never raw transactions, never account numbers, never BSBs, never merchant names
- **What does not go to Gemini:** any CDR-protected field; any document content; any conversation transcript outside the explicit AI-assist use case
- **Where Gemini sits:** Google Cloud, AU-region inference where available (Gemini AU-region rollout in progress; current calls may route to US-region inference, with TLS 1.3 in transit and no Google retention of input)
- **Retention at Gemini:** Google's Generative AI API does not retain input for model training under the GCP enterprise contract Monitrax operates under

The single-voice AI architecture (one AI instance, no parallel conversations across user contexts) is also the load-bearing argument for the *ASIC RG 244 / RG 36 boundary statement* — see that article for the AFSL framing.

## Deployment & build pipeline

| Layer | Platform | Notes |
|---|---|---|
| Frontend + serverless functions | Vercel Pro, region `syd1` (Sydney) | Region pinning enabled (Pro plan); OIDC federation enabled at project level |
| Database migrations | `prisma migrate deploy` runs on every Vercel build (build-scope `DATABASE_URL`) | Migrations ship in the same PR as the schema change (CLAUDE.md §12.12) |
| Database | GCP Cloud SQL Enterprise Plus, region `australia-southeast1` | Upgraded to Enterprise Plus 2026-05-02 (high-availability and dedicated capacity) |
| Document storage | GCS, region `australia-southeast1` | Signed-URL access only |
| Identity | GCP Identity Platform | MFA enforced on CDR routes |
| AI | Google Gemini | De-identified inputs only |
| Build & CI | GitHub Actions (`npm audit` weekly + on every push) | Dependabot enabled (`.github/dependabot.yml`) |

A schema change without a matching migration file is structurally rejected by the build. A destructive write without the §12.11 checklist is rejected at code review. These are codified in CLAUDE.md and enforced before deploy, not after.

## What an auditor can independently verify

If you are reviewing Monitrax for an organisation considering adoption, you can independently verify this overview by:

1. **Reading the canonical architecture docs** at `docs/architecture/01_ARCHITECTURE_OVERVIEW.md` and `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md`
2. **Reading the WIF evidence pack** at `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md`
3. **Reading the CDR / Basiq compliance matrix** at `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`
4. **Reading the auth-chain code** at `lib/db.ts`, `lib/middleware.ts`, `lib/auth/guards.ts`
5. **Reading the auth-chain runbook** at `docs/operational/security/04_WIF_TROUBLESHOOTING.md`

A compliance pack export (single-PDF bundle of the four core compliance articles) is the next slice (Phase 33c). Until then, link to this URL directly.

## Open hardening items (not blockers)

Items queued in the PROD-hardening backlog that strengthen the architecture without changing the rules:

- **CMEK** for Cloud SQL (currently GCP-managed keys)
- **Cloud Armor (WAF)** for HTTP-edge protection
- **Security Command Center** for vulnerability scanning and compliance monitoring
- **Cloud DLP** for inbound document and conversation scanning
- **Cyber + professional liability insurance** (business action)
- **Pen test** (external commission)
- **Vercel Static IP** + restricted authorized networks (trigger: first paying user / pre-Basiq submission)

These items do not gate the current architecture's CDR posture; they harden the surface ahead of Basiq submission.

## For your auditor

For specific questions about a layer not covered here, contact `compliance@monitrax.com.au`. For the canonical architecture this article summarises, see `docs/architecture/01_ARCHITECTURE_OVERVIEW.md`. For the WIF evidence pack, see `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md`.
