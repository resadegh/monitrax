# Monitrax Documentation Index

**Date:** 2026-06-15 | **Version:** 1.3 | **Status:** ACTIVE | **Owner:** Dev Lead
**Last refresh:** 2026-06-14 — Phase 2 PR-A + PR-B (continuity governance audit). PR-A (F-4): added the GTM set (`docs/marketing/` + `docs/marketing/gtm/`), the full `docs/compliance/` CDR set, `architecture/AI_PROVIDER_STRATEGY.md`, the root continuity docs (STATE.md / SYSTEM_MAP.md), and the 2026-06 audit findings. PR-B (F-5): de-duplicated the audit folders — `docs/audit/` merged into the canonical `docs/audits/`; maths audit re-indexed. PR-C (F-8 + F-1): indexed the new `docs/implementation/` plan spokes + the missing `docs/policy/` CDR docs; the live index-coverage check (`scripts/check-index-paths.sh`) now guards this section. _Residual soft warnings (design system, bau playbook, copy-extracts, quality audit, HELP_COVERAGE_MAP) are the known index-completeness backlog — surfaced by the check, not yet indexed._

> Master registry of all Monitrax documentation. This is the starting point for finding any document.

---

## Quick Navigation

| Need | Go To |
|------|-------|
| **Session "you-are-here" cursor (read first, every session)** | [STATE.md](../STATE.md) (repo root) |
| **What-owns-what orientation map** | [SYSTEM_MAP.md](../SYSTEM_MAP.md) (repo root) |
| **Live operational SSOT (now / next / blocked)** | [docs/IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) |
| **Go-to-market (B2B-led playbook)** | [docs/marketing/](#marketing) |
| **Lighthouse adviser pitch playbook** | [docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md](pitch/LIGHTHOUSE_ADVISER_PITCH.md) |
| System architecture & design | [docs/architecture/](#architecture) |
| Phase specifications & roadmap | [docs/blueprint/](#blueprint-phases) |
| **Mobile companion app** | [docs/mobile/](#mobile-companion-app) |
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

### Demo-Complete state (2026-05-09)

The B2B2C surface is **demo-complete end-to-end**. Phase 32B + 32C + 33a-d/g + 41a-d/g all SHIPPED. Critical-path engineering remaining: zero. Run `npm run seed:lighthouse` to populate the demo fixture (Smithfield Wealth Advisers + 3 archetype consumers — Sarah Kim / David Mei + Emma Liu / Olivia Novak). See `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` for the runnable demo script. Full deliverables list in `docs/IMPLEMENTATION_PLAN.md` Recently Completed (rolling 30 days).

---

## Implementation Plan (hub + spokes)

> **Purpose:** The live status SSOT — what's active / queued / blocked / recently done. Split into a thin hub + spokes (finding F-8) so each file stays connector-writable. **Enter via the hub.**

| Document | Holds |
|----------|-------|
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | **Hub** — navigation, status legend, update rules. Start here. |
| [implementation/01_ACTIVE_WORKSTREAMS.md](implementation/01_ACTIVE_WORKSTREAMS.md) | 🟡 Work in flight right now |
| [implementation/02_UP_NEXT.md](implementation/02_UP_NEXT.md) | 📋 Up Next + Demo-Complete critical path |
| [implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md](implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md) | ❓🚧🗑️↩️ Open Questions, Blocked, Dead Code, Reversed |
| [implementation/04_RECENTLY_COMPLETED.md](implementation/04_RECENTLY_COMPLETED.md) | ✅ Rolling 30-day completion log |

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
| [AI_PROVIDER_STRATEGY.md](architecture/AI_PROVIDER_STRATEGY.md) | AI provider strategy — Gemini decision (Q-AI-PROVIDER 2026-05-16), provider-agnostic interface | ACTIVE |
| [99_APPENDIX_GLOSSARY.md](architecture/99_APPENDIX_GLOSSARY.md) | Terminology reference | ACTIVE |

---

## Blueprint (Phases)

> **Purpose:** Development phase specifications and implementation roadmap

| Document | Description | Status |
|----------|-------------|--------|
| [MASTER_BLUEPRINT.md](blueprint/MASTER_BLUEPRINT.md) | Master phase status overview (SINGLE SOURCE) | ACTIVE |
| [TRAIL_FRAMEWORK.md](blueprint/TRAIL_FRAMEWORK.md) | TRAIL framework — Track / Reduce / Anchor / Invest / Live (consumer + B2B2C reuse) | ACTIVE |
| [ADMIN_PORTAL_COMPLETION_PLAN.md](blueprint/ADMIN_PORTAL_COMPLETION_PLAN.md) | Admin portal implementation plan | ACTIVE |
| **B2B2C surface (Phase 32B + 32C)** |  |  |
| [PHASE_32_ENTERPRISE_PORTAL.md](blueprint/PHASE_32_ENTERPRISE_PORTAL.md) | Org client management — ✅ SHIPPED May 2026 (Studio/Practice/Enterprise) | ACTIVE |
| [PHASE_33G_ADVISER_FEEDBACK_INBOX.md](blueprint/PHASE_33G_ADVISER_FEEDBACK_INBOX.md) | Adviser feedback inbox — ✅ SHIPPED May 2026 | ACTIVE |
| **Phase 41 — Entity Layer** |  |  |
| [PHASE_41_REGULATORY_ARCHITECTURE.md](blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md) | Authority-mapped tax/super/state regulations Monitrax respects | ACTIVE |
| [PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md](blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md) | Phase 41e audit + migration plan (~28 days, queued) | ACTIVE |
| **Phase 36 — UX Simplification** |  |  |
| [PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md](blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md) | Phase 2a SHIPPED May 2026; Phase 2b/2d queued | ACTIVE |
| **Phase 39 — My Wealth Redesign** |  |  |
| [PHASE_39_MY_WEALTH_REDESIGN.md](blueprint/PHASE_39_MY_WEALTH_REDESIGN.md) | v4 tile pattern shipped; propagation parked | ACTIVE |
| PHASE_01 through PHASE_31 | Pre-B2B2C phase specifications (~47 files) | Various |
| PHASE_E_GCP_SERVICE_ENABLEMENT.md | GCP service enablement plan | ACTIVE |

> For individual phase status, see [MASTER_BLUEPRINT.md](blueprint/MASTER_BLUEPRINT.md) §4 Completed/In Progress/Planned tables.

---

## Mobile Companion App

> **Purpose:** All documentation for the iOS/Android mobile companion app (Phase 15)
> **Master Index:** [mobile/00_INDEX.md](mobile/00_INDEX.md)
> **Shared Doc Map:** [mobile/00_CROSS_REFERENCES.md](mobile/00_CROSS_REFERENCES.md) — no duplication; shared docs stay in original locations

| Category | Document | Description |
|----------|----------|-------------|
| **Blueprint** | [PHASE_15_MOBILE_COMPANION_APP.md](mobile/blueprint/PHASE_15_MOBILE_COMPANION_APP.md) | Master 20-section spec v2.0 |
| **Architecture** | [01_MOBILE_ARCHITECTURE.md](mobile/architecture/01_MOBILE_ARCHITECTURE.md) | Tech stack, system design, data flows |
| **Design** | [01_DESIGN_SYSTEM.md](mobile/design/01_DESIGN_SYSTEM.md) | Mobile design system, components, patterns |
| **API** | [01_MOBILE_API_CONTRACT.md](mobile/api/01_MOBILE_API_CONTRACT.md) | All `/api/v1/mobile/*` endpoint contracts |
| **Implementation** | [01_IMPLEMENTATION_PLAN.md](mobile/implementation/01_IMPLEMENTATION_PLAN.md) | 7-sprint phased build plan |
| **Implementation** | [02_PRE_IMPLEMENTATION_CHECKLIST.md](mobile/implementation/02_PRE_IMPLEMENTATION_CHECKLIST.md) | Pre-requisites before Sprint 0 |
| **Operations** | [01_BUILD_AND_DEPLOY.md](mobile/operations/01_BUILD_AND_DEPLOY.md) | EAS Build, App Store, OTA updates |
| **Operations** | [02_RUNBOOK.md](mobile/operations/02_RUNBOOK.md) | Mobile-specific incident response |
| **Testing** | [01_TESTING_STRATEGY.md](mobile/testing/01_TESTING_STRATEGY.md) | Device matrix, test scenarios, benchmarks |
| **Compliance** | [01_CDR_MOBILE_COMPLIANCE.md](mobile/compliance/01_CDR_MOBILE_COMPLIANCE.md) | CDR mobile data handling rules |

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
| [CDR_BASIQ_COMPLIANCE_STATUS_REPORT.md](compliance/CDR_BASIQ_COMPLIANCE_STATUS_REPORT.md) | Point-in-time Basiq accreditation status report | ACTIVE |
| [CDR_SYSTEM_ARCHITECTURE.md](compliance/CDR_SYSTEM_ARCHITECTURE.md) | CDR system architecture (consent / data-flow / isolation) | ACTIVE |
| [CDR_IMPLEMENTATION_PLAN.md](compliance/CDR_IMPLEMENTATION_PLAN.md) | CDR implementation roadmap | ACTIVE |
| [CDR_DATA_RETENTION_SCHEDULE.md](compliance/CDR_DATA_RETENTION_SCHEDULE.md) | Data retention policy for CDR data | ACTIVE |
| [CDR_WIF_AUTHENTICATION_EVIDENCE.md](compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md) | WIF / Cloud SQL IAM-auth evidence pack (cutover record + compensating controls) | ACTIVE |
| [CDR_EVIDENCE_SCREENSHOT_GUIDE.md](compliance/CDR_EVIDENCE_SCREENSHOT_GUIDE.md) | Guide for capturing accreditation evidence screenshots | ACTIVE |
| [CDR_SPREADSHEET_ANSWERS_AND_GAPS.md](compliance/CDR_SPREADSHEET_ANSWERS_AND_GAPS.md) | Basiq questionnaire answers + outstanding gaps | ACTIVE |
| [DRAFT_EMAIL_REPLY_TO_BASIQ.md](compliance/DRAFT_EMAIL_REPLY_TO_BASIQ.md) | Working draft of the reply to Basiq | DRAFT |

---

## Policy

> **Purpose:** Organizational policies (required for CDR/Basiq accreditation)

| Document | Description | Review Date |
|----------|-------------|-------------|
| [APPROVED_DEPENDENCIES.md](policy/APPROVED_DEPENDENCIES.md) | Reviewed npm packages | 2026-06-08 |
| [MONITRAX_SECURITY_POLICIES.md](policy/MONITRAX_SECURITY_POLICIES.md) | Consolidated organisational security policy set | 2027-03-08 |
| [CDR_COMPLAINTS_POLICY.md](policy/CDR_COMPLAINTS_POLICY.md) | CDR complaints-handling policy (Basiq accreditation) | 2027-03-08 |
| [CDR_DATA_MINIMISATION.md](policy/CDR_DATA_MINIMISATION.md) | CDR data-minimisation policy | 2027-03-08 |
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
| [PHASE1_INGESTION_FINDINGS_2026-06-14.md](audits/PHASE1_INGESTION_FINDINGS_2026-06-14.md) | Jun 2026 | Continuity deep-ingestion drift / SSOT findings (F-1…F-8) — input to the Phase 2 governance audit |
| [2026-06-MATHS-AUDIT.md](audits/2026-06-MATHS-AUDIT.md) | Jun 2026 | Maths / calc / tax-law correctness audit (workstream §0·MA — constants cross-checked against AU tax law) |

> **Canonical audit folder = `docs/audits/` (plural).** Resolved F-5 (Phase 2 PR-B): the former singular `docs/audit/` folder was merged in — `2026-06-MATHS-AUDIT.md` now lives at `docs/audits/2026-06-MATHS-AUDIT.md`. Place all future audit docs under `docs/audits/`.

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

## Pitch & Lighthouse

| Document | Location | Description |
|----------|----------|-------------|
| [LIGHTHOUSE_ADVISER_PITCH.md](pitch/LIGHTHOUSE_ADVISER_PITCH.md) | docs/pitch/ | DEMO-COMPLETE 25-30 min pitch playbook with pre-flight checklist + verbatim narration scripts + objection handling + design-partner conversion path |

To run the demo: `npm run seed:lighthouse` (idempotent; `--reset` for clean re-seed). Smithfield Wealth Advisers + 3 archetypes (Sarah Kim sole-trader / David Mei + Emma Liu family with trust + SMSF / Olivia Novak multi-entity HNW).

---

## Marketing

> **Purpose:** Go-to-market strategy (B2B-led), public messaging, and the executable GTM playbook.
> **Canonical GTM SSOT:** `GTM_EXECUTION_PLAN.md`.

| Document | Location | Description |
|----------|----------|-------------|
| [GTM_EXECUTION_PLAN.md](marketing/GTM_EXECUTION_PLAN.md) | docs/marketing/ | Step-by-step B2B-led launch playbook (phases 0–6, status tracker) — canonical GTM SSOT |
| [GTM_TOOL_STACK.md](marketing/GTM_TOOL_STACK.md) | docs/marketing/ | Living GTM tool stack + cost register |
| [THE_TRAIL_METHOD.md](marketing/THE_TRAIL_METHOD.md) | docs/marketing/ | Public-facing TRAIL method messaging |
| [TRAIL_WEBSITE_COPY.md](marketing/TRAIL_WEBSITE_COPY.md) | docs/marketing/ | Website copy for the TRAIL framework |
| [gtm/BROKER_ICP.md](marketing/gtm/BROKER_ICP.md) | docs/marketing/gtm/ | Mortgage-broker ICP (first beachhead) |
| [gtm/REVIEW_SCOPE_AND_BOUNDARIES.md](marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md) | docs/marketing/gtm/ | AFSL scope of the paid Financial Health Review (general info / factual diagnostic only) |
| [gtm/FRIENDLIES_INVITE_PLAYBOOK.md](marketing/gtm/FRIENDLIES_INVITE_PLAYBOOK.md) | docs/marketing/gtm/ | Private-beta friendlies onboarding playbook |
| [gtm/PAID_ADS_AUTOMATION.md](marketing/gtm/PAID_ADS_AUTOMATION.md) | docs/marketing/gtm/ | Paid-ads automation (parked — consumer-first GTM deferred) |

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

*Last updated: 2026-06-15*
