# Monitrax Operational Documentation

**Purpose:** BAU support reference for the Monitrax platform operations team.

---

## Quick Links

| Need | Document |
|------|----------|
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

---

## Document Status

| Section | Files | Status |
|---------|-------|--------|
| Architecture (01-03) | 3 | Current |
| Deployment (01-03) | 3 | Current |
| Database (01-04) | 4 | Current |
| Security (01-03) | 3 | Current |
| Runbooks (01) | 1 | Current |

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

Last Updated: 2026-04-09
