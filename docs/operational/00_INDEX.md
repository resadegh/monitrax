# Monitrax Operational Documentation

**Purpose:** BAU support reference for the Monitrax platform operations team.

---

## Quick Links

| Need | Document |
|------|----------|
| **Live operational SSOT (now / next / blocked)** | [docs/IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) |
| **Lighthouse adviser pitch playbook** | [docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md](../pitch/LIGHTHOUSE_ADVISER_PITCH.md) |
| **Run the demo seed** | `npm run seed:lighthouse` (idempotent; `--reset` for clean re-seed) |
| System overview / "how does it work?" | [System Overview](architecture/01_SYSTEM_OVERVIEW.md) |
| Which environment am I looking at? | [Environment Strategy](architecture/02_ENVIRONMENT_STRATEGY.md) |
| What technologies are we running? | [Technology Stack](architecture/03_TECHNOLOGY_STACK.md) |
| How does code get to production? | [Change Transport](deployment/01_CHANGE_TRANSPORT.md) |
| Vercel build/deploy details | [Vercel Deployment](deployment/02_VERCEL_DEPLOYMENT.md) |
| Database is down / slow | [Cloud SQL Operations](database/01_CLOUD_SQL_OPERATIONS.md) |
| Need to restore a backup | [Backup and Restore](database/02_BACKUP_AND_RESTORE.md) |
| Database monitoring | [Monitoring and Alerts](database/03_MONITORING_AND_ALERTS.md) |
| Auth / login issues | [Authentication Operations](security/01_AUTHENTICATION.md) |
| Who has access to what? | [IAM and Permissions](security/02_IAM_AND_PERMISSIONS.md) |
| CDR compliance questions | [CDR Compliance](security/03_CDR_COMPLIANCE.md) |
| Security incident | [Incident Response Runbook](runbooks/01_INCIDENT_RESPONSE.md) |
| Google Maps not loading / API not activated | [Google Maps Setup](runbooks/04_GOOGLE_MAPS_SETUP.md) |
| Retention crons (CDR + conversation 7yr) — setup + troubleshooting | [Retention Schedulers](runbooks/05_RETENTION_SCHEDULERS.md) |
| **Run the quarterly backup/restore drill** | [Backup & Restore Drill](runbooks/06_BACKUP_RESTORE_DRILL.md) (proves the backups actually restore — non-destructive, restores into a throwaway instance) |
| **Run an incident-response tabletop exercise** | [IRP Tabletop Exercise Script](runbooks/07_IRP_TABLETOP_EXERCISE.md) (4 scenarios: CDR breach / DB unreachable / auth outage / runaway cost) |
| **What are our SLOs? Which alerts enforce them?** | [Observability — SLOs & Alert Policies](runbooks/08_OBSERVABILITY_SLOS.md) (availability/latency/error-rate per route group + Cloud Monitoring alert specs A1–A9) |
| **No Founder Daily Digest email this morning?** | [GTM Founder Daily Digest](runbooks/09_GTM_FOUNDER_DAILY_DIGEST.md) (n8n workflow operator reference — credentials, cron, prompt, common failure modes) |
| Adviser feedback inbox triage / weekly synthesis | [Feedback Triage and Synthesis](feedback/01_TRIAGE_AND_SYNTHESIS.md) |
| What does Monitrax pay for? Vendor inventory + spend control | [Cost Control — Vendor Inventory](cost-control/00_VENDOR_INVENTORY.md) |
| How to set up budget alerts per vendor | [Cost Control — Budget Alerts Setup](cost-control/01_BUDGET_ALERTS_SETUP.md) |
| **User reports a wrong number → audit one user** | [Per-User Audit Runbook](calc-audit/per-user-audit-runbook.md) (Audit-this-user button on `/admin/calc-audit` + UC-DEED-* triage) |
| **Trust-deed extraction failed / extracted poorly** | [Admin Troubleshooting Runbook → Trust-Deed Issues](admin/02_ADMIN_TROUBLESHOOTING_RUNBOOK.md#issue-trust-deed-extraction-failed-or-extracted-poorly) |
| **Calc audit finding triaged → backfill needed** | [Calc Audit Backfill Runbook](calc-audit/backfill-runbook.md) |
| **B2B2C surface — what shipped?** | [Master Blueprint §4](../blueprint/MASTER_BLUEPRINT.md#4-phase-implementation-status) — every Phase 32B/32C/33/41 row marked SHIPPED |
| **Stripe billing went sideways — where's the truth?** | Stripe Dashboard is canonical. Local mirror in `StripeSubscription` is read-mostly; `StripeWebhookEvent` is the dedupe + audit log. Run `prisma studio` and check `processedAt` + `processingError` columns |
| **Conversation email isn't sending** | Check `SENDGRID_API_KEY` is set in env. When unset, outbound logs to console only — see `lib/email/conversationEmail.ts` |
| **Inbound email reply not landing in conversation** | Check `MONITRAX_INBOUND_DOMAIN` matches DNS MX records pointed at SendGrid Inbound Parse. Webhook signature verification logs at `/api/conversations/inbound`. v1 hardening (DKIM/SPF strict) DEFERRED to PROD |

---

## All Documents by Section

### Architecture

System design, environments, and technology references.

| # | Document | Description |
|---|----------|-------------|
| 01 | [System Overview](architecture/01_SYSTEM_OVERVIEW.md) | High-level architecture, component descriptions, data flow, financial engines, module interactions |
| 02 | [Environment Strategy](architecture/02_ENVIRONMENT_STRATEGY.md) | PROD vs DEV/UAT setup, Vercel branch mapping, Cloud SQL instances, CDR data separation rules |
| 03 | [Technology Stack](architecture/03_TECHNOLOGY_STACK.md) | All technologies with versions, external services, GCP services, key dependencies |

### Deployment

How code moves from development to production.

| # | Document | Description |
|---|----------|-------------|
| 01 | [Change Transport](deployment/01_CHANGE_TRANSPORT.md) | Branch-based workflow, PR process, how code reaches production |
| 02 | [Vercel Deployment](deployment/02_VERCEL_DEPLOYMENT.md) | Vercel build pipeline, environment scoping, preview deployments |
| 03 | [Database Migrations](deployment/03_DATABASE_MIGRATIONS.md) | Manual schema sync workflow, safety rules, legacy table handling |

### Database

Cloud SQL administration, backups, and monitoring.

| # | Document | Description |
|---|----------|-------------|
| 01 | [Cloud SQL Operations](database/01_CLOUD_SQL_OPERATIONS.md) | Instance details, status checks, connection management |
| 02 | [Backup and Restore](database/02_BACKUP_AND_RESTORE.md) | Automated backups, point-in-time recovery, manual backup procedures |
| 03 | [Monitoring and Alerts](database/03_MONITORING_AND_ALERTS.md) | Cloud SQL monitoring, alerting, performance checks |
| 04 | [Prisma Migration Baseline](database/04_PRISMA_MIGRATION_BASELINE.md) | One-time runbook to bring both Cloud SQL instances under Prisma migration tracking (prerequisite for `prisma migrate deploy`) |

### Security

Authentication, access control, and compliance operations.

| # | Document | Description |
|---|----------|-------------|
| 01 | [Authentication Operations](security/01_AUTHENTICATION.md) | Firebase Auth operations, sign-in methods, token flow, MFA |
| 02 | [IAM and Permissions](security/02_IAM_AND_PERMISSIONS.md) | RBAC roles (Owner/Admin/Contributor/Viewer), GCP IAM, permission model |
| 03 | [CDR Compliance](security/03_CDR_COMPLIANCE.md) | CDR obligations, consent lifecycle, data deletion, audit requirements |

### Runbooks

Step-by-step procedures for incident response and common support scenarios.

| # | Document | Description |
|---|----------|-------------|
| 01 | [Incident Response](runbooks/01_INCIDENT_RESPONSE.md) | Incident classification, escalation paths, response procedures |
| 02 | [Common Operations](runbooks/02_COMMON_OPERATIONS.md) | Day-to-day operational tasks |
| 03 | [Health Checks](runbooks/03_HEALTH_CHECKS.md) | System health verification procedures |
| 04 | [Google Maps Setup](runbooks/04_GOOGLE_MAPS_SETUP.md) | Enabling Maps APIs, verifying key scoping (frontend referrer + backend API restrictions), env vars, troubleshooting, cost monitoring, quarterly review checklist |
| 05 | [Retention Schedulers](runbooks/05_RETENTION_SCHEDULERS.md) | GCP Cloud Scheduler config for the CDR consent-expiry cron (`monitrax-cdr-lifecycle`, daily 02:00 Australia/Sydney (AEST/AEDT)) and the conversation 7-yr archive sweep (`monitrax-conversation-retention-sweep`, daily 03:00 Australia/Sydney (AEST/AEDT)). Includes Reza's Tier-1 GCP-console TODOs (CMEK, Cloud Armor, SCC) for Basiq accreditation. |
| 06 | [Backup & Restore Drill](runbooks/06_BACKUP_RESTORE_DRILL.md) | Quarterly exercise that *proves* the Cloud SQL backups restore — verify backups exist + healthy → restore the latest into a throwaway instance → verify schema/row-counts/integrity → tear down. Non-destructive (never touches prod). Annual extension: PITR clone + `pg_dump`→`pg_restore` round-trip. Drill Log + PASS/FAIL definition at the bottom. |
| 07 | [IRP Tabletop Exercise Script](runbooks/07_IRP_TABLETOP_EXERCISE.md) | Annual incident-response tabletop. 4 realistic scenarios (CDR data breach / production DB unreachable / auth-provider outage / runaway cost), each walked through the IRP phases with `DECISION:` markers + "gaps this surfaces" + an After-Action Report template + Exercise Log. |
| 08 | [Observability — SLOs & Alert Policies](runbooks/08_OBSERVABILITY_SLOS.md) | Application-level SLOs (availability 99.5%; p95/p99 latency + 5xx error-rate targets per route group) + Cloud Monitoring alert-policy specs A1–A9 (each with a runbook link) + synthetic-canary plan + Service Health dashboard tiles + review cadence + a "live vs spec-only" status table. Complements (does not duplicate) the DB-level monitoring in `database/03_MONITORING_AND_ALERTS.md`. |

### Feedback (Phase 33g)

Operational practice for the adviser feedback inbox.

| # | Document | Description |
|---|----------|-------------|
| 00 | [Feedback Index](feedback/00_INDEX.md) | Section index + quick links + when-things-go-wrong table |
| 01 | [Triage and Synthesis](feedback/01_TRIAGE_AND_SYNTHESIS.md) | Daily 10-min triage, weekly Claude Code synthesis ritual, CDR-leak handling, audit-log queries, common questions, forward-path triggers |

### Cost Control

Vendor inventory + spend caps. SSOT for "what does Monitrax pay for?"

| # | Document | Description |
|---|----------|-------------|
| 00 | [Cost Control Index](cost-control/00_INDEX.md) | Section index + quick links + decision log |
| 00 | [Vendor Inventory (SSOT)](cost-control/00_VENDOR_INVENTORY.md) | Every external paid service, classified Tier 1–4. Pricing model + estimated range + monthly actuals. |
| 01 | [Budget Alerts + Spend Caps Setup](cost-control/01_BUDGET_ALERTS_SETUP.md) | Per-vendor setup runbook for budget alerts + hard ceilings. Anthropic SDK addition gated on §4. |

---

## Document Status

| Section | Files | Status |
|---------|-------|--------|
| Architecture (01-03) | 3 | Current |
| Deployment (01-03) | 3 | Current |
| Database (01-04) | 4 | Current |
| Security (01-04) | 4 | Current |
| Runbooks (01-08) | 8 | Current |
| Feedback (00-01) | 2 | Current |

---

## Related Documentation

| Resource | Location | Purpose |
|----------|----------|---------|
| Blueprint (developer specs) | `docs/blueprint/` | Architectural specifications, phase documents, API standards |
| Master Blueprint | `docs/blueprint/MASTER_BLUEPRINT.md` | Authoritative system reference with phase status |
| Policy documents | `docs/policy/` | CDR data retention, device security, incident response plans |
| Changelogs | `docs/blueprint/CHANGELOG_*.md` | Per-session change records |
| Prisma schema | `prisma/schema.prisma` | Database model definitions (83 models) |

---

Last Updated: 2026-05-10 — added runbooks 06 (Backup & Restore Drill), 07 (IRP Tabletop Exercise Script), 08 (Observability — SLOs & Alert Policies) for the Phase 0 operational-readiness chunk.
