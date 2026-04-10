# Monitrax Documentation Index

**Date:** 2026-04-10 | **Version:** 1.0 | **Status:** ACTIVE | **Owner:** Dev Lead

> Master registry of all Monitrax documentation. This is the starting point for finding any document.

---

## Quick Navigation

| Need | Go To |
|------|-------|
| System architecture & design | [docs/architecture/](#architecture) |
| Phase specifications & roadmap | [docs/blueprint/](#blueprint-phases) |
| How to operate the system (BAU) | [docs/operational/](#operational) |
| CDR compliance & regulatory | [docs/compliance/](#compliance) |
| Organizational policies | [docs/policy/](#policy) |
| BAU team framework | [docs/bau-framework/](#bau-framework) |
| Audit reports & assessments | [docs/audits/](#audits) |
| Setup & how-to guides | [docs/guides/](#guides) |
| Infrastructure migrations | [docs/migration/](#migration) |
| Change history | [docs/changelog/](#changelog) |
| API documentation | [docs/api/](#api-documentation) |
| Archived (obsolete) documents | [docs/archive/](#archive) |

---

## Architecture

> **Purpose:** Design specifications - the "what" and "why" of the system

| Document | Description | Status |
|----------|-------------|--------|
| [00_OVERVIEW.md](architecture/00_OVERVIEW.md) | System overview, vision, guiding principles | ACTIVE |
| [00_CHANGE_REQUEST_REFERENCE.md](architecture/00_CHANGE_REQUEST_REFERENCE.md) | Change management process reference | ACTIVE |
| [01_ARCHITECTURE_OVERVIEW.md](architecture/01_ARCHITECTURE_OVERVIEW.md) | Technical architecture, 7-layer design | ACTIVE |
| [02_DESIGN_PRINCIPLES.md](architecture/02_DESIGN_PRINCIPLES.md) | Core design philosophy, SSOT rules | ACTIVE |
| [03_DATA_MODEL.md](architecture/03_DATA_MODEL.md) | Entity relationships, canonical contracts | ACTIVE |
| [04_GRDCS_SPECIFICATION.md](architecture/04_GRDCS_SPECIFICATION.md) | Global relational data consistency system | ACTIVE |
| [05_CROSS_MODULE_NAVIGATION.md](architecture/05_CROSS_MODULE_NAVIGATION.md) | CMNF navigation specification | ACTIVE |
| [06_UI_UX_FOUNDATION.md](architecture/06_UI_UX_FOUNDATION.md) | UI patterns, component standards | ACTIVE |
| [07_API_STANDARDS.md](architecture/07_API_STANDARDS.md) | API design standards, auth, validation | ACTIVE |
| [08_BRAND_UI_DESIGN.md](architecture/08_BRAND_UI_DESIGN.md) | Visual design system, brand guidelines | ACTIVE |
| [09_INFRASTRUCTURE_AND_DEPLOYMENT.md](architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md) | Infrastructure architecture | ACTIVE |
| [99_APPENDIX_GLOSSARY.md](architecture/99_APPENDIX_GLOSSARY.md) | Terminology reference | ACTIVE |

---

## Blueprint (Phases)

> **Purpose:** Development phase specifications and implementation roadmap

| Document | Description | Status |
|----------|-------------|--------|
| [MASTER_BLUEPRINT.md](blueprint/MASTER_BLUEPRINT.md) | Master phase status overview (SINGLE SOURCE) | ACTIVE |
| [ADMIN_PORTAL_COMPLETION_PLAN.md](blueprint/ADMIN_PORTAL_COMPLETION_PLAN.md) | Admin portal implementation plan | ACTIVE |
| PHASE_01 through PHASE_35 | Individual phase specifications (~47 files) | Various |
| PHASE_E_GCP_SERVICE_ENABLEMENT.md | GCP service enablement plan | ACTIVE |

> For individual phase status, see [MASTER_BLUEPRINT.md](blueprint/MASTER_BLUEPRINT.md)

---

## Operational

> **Purpose:** How-to runbooks for BAU team - the "how" of operating the system
> See also: [operational/00_INDEX.md](operational/00_INDEX.md)

### Architecture (for operators)
| Document | Description |
|----------|-------------|
| [01_SYSTEM_OVERVIEW.md](operational/architecture/01_SYSTEM_OVERVIEW.md) | System overview for operators |
| [02_ENVIRONMENT_STRATEGY.md](operational/architecture/02_ENVIRONMENT_STRATEGY.md) | Environment separation (PROD/DEV) |
| [03_TECHNOLOGY_STACK.md](operational/architecture/03_TECHNOLOGY_STACK.md) | Complete dependency inventory |

### Database
| Document | Description |
|----------|-------------|
| [01_CLOUD_SQL_OPERATIONS.md](operational/database/01_CLOUD_SQL_OPERATIONS.md) | Cloud SQL instance management |
| [02_BACKUP_AND_RESTORE.md](operational/database/02_BACKUP_AND_RESTORE.md) | Backup strategy and disaster recovery |
| [03_MONITORING_AND_ALERTS.md](operational/database/03_MONITORING_AND_ALERTS.md) | Database monitoring and alert policies |

### Deployment
| Document | Description |
|----------|-------------|
| [01_CHANGE_TRANSPORT.md](operational/deployment/01_CHANGE_TRANSPORT.md) | Deployment workflow (branch to production) |
| [02_VERCEL_DEPLOYMENT.md](operational/deployment/02_VERCEL_DEPLOYMENT.md) | Vercel platform operations |
| [03_DATABASE_MIGRATIONS.md](operational/deployment/03_DATABASE_MIGRATIONS.md) | Schema change procedures (CRITICAL safety rules) |

### Security
| Document | Description |
|----------|-------------|
| [01_AUTHENTICATION.md](operational/security/01_AUTHENTICATION.md) | Auth operations (Firebase/GCP Identity) |
| [02_IAM_AND_PERMISSIONS.md](operational/security/02_IAM_AND_PERMISSIONS.md) | RBAC, permissions, role management |
| [03_CDR_COMPLIANCE.md](operational/security/03_CDR_COMPLIANCE.md) | CDR operational procedures |

### Runbooks
| Document | Description |
|----------|-------------|
| [01_INCIDENT_RESPONSE.md](operational/runbooks/01_INCIDENT_RESPONSE.md) | Incident classification and response |
| [02_COMMON_OPERATIONS.md](operational/runbooks/02_COMMON_OPERATIONS.md) | Quick reference for BAU tasks |
| [03_HEALTH_CHECKS.md](operational/runbooks/03_HEALTH_CHECKS.md) | Daily/periodic health check procedures |

---

## Compliance

> **Purpose:** CDR and regulatory compliance tracking

| Document | Description | Status |
|----------|-------------|--------|
| [CDR_BASIQ_COMPLIANCE_MATRIX.md](compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md) | Basiq accreditation requirement tracking (~87%) | ACTIVE |
| [CDR_IMPLEMENTATION_PLAN.md](compliance/CDR_IMPLEMENTATION_PLAN.md) | CDR implementation roadmap | ACTIVE |
| [CDR_DATA_RETENTION_SCHEDULE.md](compliance/CDR_DATA_RETENTION_SCHEDULE.md) | Data retention policy for CDR data | ACTIVE |

---

## Policy

> **Purpose:** Organizational policies (required for CDR/Basiq accreditation)

| Document | Description | Review Date |
|----------|-------------|-------------|
| [APPROVED_DEPENDENCIES.md](policy/APPROVED_DEPENDENCIES.md) | Reviewed npm packages | 2026-06-08 |
| [CDR_DATA_RETENTION_SCHEDULE.md](policy/CDR_DATA_RETENTION_SCHEDULE.md) | CDR data retention rules | 2027-03-08 |
| [DEVICE_SECURITY_POLICY.md](policy/DEVICE_SECURITY_POLICY.md) | Device/endpoint security | 2027-03-08 |
| [INCIDENT_RESPONSE_PLAN.md](policy/INCIDENT_RESPONSE_PLAN.md) | Breach notification/containment | 2027-03-08 |
| [SECURITY_AWARENESS_POLICY.md](policy/SECURITY_AWARENESS_POLICY.md) | Security training requirements | 2027-03-08 |

---

## BAU Framework

> **Purpose:** Business-As-Usual operational framework, team structure, and gap analysis

| Document | Description |
|----------|-------------|
| [00_EXECUTIVE_SUMMARY.md](bau-framework/00_EXECUTIVE_SUMMARY.md) | High-level overview and action plan |
| [01_CURRENT_STATE_ASSESSMENT.md](bau-framework/01_CURRENT_STATE_ASSESSMENT.md) | Architecture and operational status |
| [02_DOCUMENT_DUPLICATION_ANALYSIS.md](bau-framework/02_DOCUMENT_DUPLICATION_ANALYSIS.md) | Cross-repo duplication findings |
| [03_GAP_ANALYSIS_REPORT.md](bau-framework/03_GAP_ANALYSIS_REPORT.md) | Design, architecture, and ops gaps |
| [04_BAU_OPERATIONS_FRAMEWORK.md](bau-framework/04_BAU_OPERATIONS_FRAMEWORK.md) | Runbooks, SLAs, schedules |
| [05_BAU_TEAM_STRUCTURE.md](bau-framework/05_BAU_TEAM_STRUCTURE.md) | Phased team growth plan |
| [06_CDR_COMPLIANCE_OPERATIONS.md](bau-framework/06_CDR_COMPLIANCE_OPERATIONS.md) | CDR-specific BAU procedures |
| [07_DOCUMENT_MANAGEMENT_RESTRUCTURE.md](bau-framework/07_DOCUMENT_MANAGEMENT_RESTRUCTURE.md) | SSOT folder structure proposal |
| [TRACKING_REFERENCE.md](bau-framework/TRACKING_REFERENCE.md) | Quick reference for all action items |

---

## Audits

> **Purpose:** Point-in-time audit reports and assessments

| Document | Date | Scope |
|----------|------|-------|
| [AUDIT_REPORT_ALIGNED_2026-01.md](audits/AUDIT_REPORT_ALIGNED_2026-01.md) | Jan 2026 | Full application audit (AUTHORITATIVE) |
| [AUDIT_CFO_VALUE_ASSESSMENT_2026-01.md](audits/AUDIT_CFO_VALUE_ASSESSMENT_2026-01.md) | Jan 2026 | CFO engine value assessment |
| [AUDIT_DASHBOARD_ALIGNMENT_2026-01.md](audits/AUDIT_DASHBOARD_ALIGNMENT_2026-01.md) | Jan 2026 | Dashboard metrics alignment |
| [AUDIT_DATABASE_CALCULATIONS_2026-01.md](audits/AUDIT_DATABASE_CALCULATIONS_2026-01.md) | Jan 2026 | Calculation accuracy verification |
| [PHASE9_REGRESSION_2025-11-23.md](audits/PHASE9_REGRESSION_2025-11-23.md) | Nov 2025 | Phase 9 regression test results |
| [PHASE9_TEST_MATRIX_2025-11-23.md](audits/PHASE9_TEST_MATRIX_2025-11-23.md) | Nov 2025 | Phase 9 test coverage matrix |

---

## Guides

> **Purpose:** Setup guides and how-to documentation

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](guides/QUICKSTART.md) | Application quickstart (DB, API, full setup) |
| [OAUTH-SETUP.md](guides/OAUTH-SETUP.md) | Complete OAuth setup (4 providers) |
| [OAUTH-QUICKSTART.md](guides/OAUTH-QUICKSTART.md) | 5-minute Google OAuth quickstart |
| [SAFE_REFACTORING_GUIDE.md](guides/SAFE_REFACTORING_GUIDE.md) | Process for safe code refactoring |

---

## Migration

> **Purpose:** Infrastructure migration plans and procedures

| Document | Description | Status |
|----------|-------------|--------|
| [MIGRATION_RENDER_TO_GCP_PLAN.md](migration/MIGRATION_RENDER_TO_GCP_PLAN.md) | Render to GCP Cloud SQL migration plan | COMPLETE |
| [MIGRATION_RENDER_TO_GCP_STEPS.md](migration/MIGRATION_RENDER_TO_GCP_STEPS.md) | Step-by-step migration procedures | COMPLETE |
| [GCP_IDENTITY_MIGRATION_PHASE2.md](migration/GCP_IDENTITY_MIGRATION_PHASE2.md) | GCP Identity Platform cutover | COMPLETE |
| [GCP_IDENTITY_MIGRATION_PHASE3_MFA.md](migration/GCP_IDENTITY_MIGRATION_PHASE3_MFA.md) | MFA implementation via Firebase | COMPLETE |

---

## Changelog

> **Purpose:** Consolidated change history

| Document | Description |
|----------|-------------|
| [IMPLEMENTATION_CHANGELOG.md](changelog/IMPLEMENTATION_CHANGELOG.md) | Implementation change log |

> Individual session changelogs archived in `docs/archive/changelogs/`

---

## API Documentation

| Document | Description |
|----------|-------------|
| [STRATEGY_API.md](api/STRATEGY_API.md) | Strategy engine API documentation |

---

## Other

| Document | Location | Description |
|----------|----------|-------------|
| [ANALYZER_LOGIC.md](strategy/ANALYZER_LOGIC.md) | docs/strategy/ | Strategy analyzer logic |
| [GCP_IDENTITY_MIGRATION_PROMPT.md](prompts/GCP_IDENTITY_MIGRATION_PROMPT.md) | docs/prompts/ | AI prompt for GCP migration |
| [Support Pack Framework](supportpack/monitrax_support_pack_framework.md) | docs/supportpack/ | AI support pack template |

---

## Archive

> **Purpose:** Obsolete or superseded documents preserved for historical reference.
> See [docs/archive/README.md](archive/README.md) for archive policy.

| Archived File | Original Location | Reason |
|--------------|-------------------|--------|
| AUDIT_REPORT_2026-01-20.md | docs/ | Superseded by ALIGNED version |
| SYSTEM_AUDIT_REPORT_2025-11-23.md | docs/ | Outdated (Nov 2025) |
| PHASE_10_PROGRESS_2026-01-25.md | docs/ | Status frozen at 45% (actually 100%) |
| GAP_ANALYSIS_2025-11-24.md | docs/ | Superseded by implementations |
| IMPLEMENTATION_PLAN_2025-11-24.md | docs/ | Superseded (Nov 2025 plan) |
| BUILD_SUMMARY_LEGACY.md | root | References deprecated Render infra |
| VALIDATION_REPORT.md | root | Point-in-time snapshot (Nov 2024) |
| DEPLOYMENT-VALIDATION.md | root | Point-in-time snapshot (Nov 2025) |
| 28 individual changelogs | docs/blueprint/ | Consolidated into single changelog |

---

## Document Governance

1. **One authoritative source per topic** - this index is the map
2. **Cross-reference, don't duplicate** - link to the authoritative source
3. **Archive, don't delete** - move obsolete docs to `docs/archive/`
4. **Version headers required** - Date, Version, Status, Owner, Review Date
5. **Changes via PR** - documentation changes follow the same PR process as code

> For full governance rules, see [docs/bau-framework/07_DOCUMENT_MANAGEMENT_RESTRUCTURE.md](bau-framework/07_DOCUMENT_MANAGEMENT_RESTRUCTURE.md)

---

*Last updated: 2026-04-10*
