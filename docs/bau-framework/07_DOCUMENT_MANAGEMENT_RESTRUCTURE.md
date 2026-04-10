# 07 - Document Management Restructure Proposal

**Date:** 2026-04-10 | **Version:** 1.0 | **Status:** DRAFT - Requires Approval

---

## 1. Problem Statement

The current Monitrax documentation structure has grown organically across 35 development phases, resulting in:

- **100+ documents** spread across 8+ directories with no clear hierarchy
- **12+ duplicate or obsolete documents** creating confusion about authoritative sources
- **25+ fragmented changelogs** with no consolidated view
- **No document versioning standard** - some have dates, some have version numbers, some have neither
- **No review schedule** - documents become stale without owner accountability
- **SSOT violations** - same information exists in multiple locations with conflicting content

This violates CDR compliance requirements for accurate, up-to-date documentation and creates unacceptable risk for BAU team onboarding and operations.

---

## 2. Proposed Folder Structure

### 2.1 New Structure

```
docs/
├── 00_INDEX.md                          # Master document registry and navigation
│
├── architecture/                        # DESIGN specifications (the "what" and "why")
│   ├── 00_OVERVIEW.md                   # System overview and vision
│   ├── 01_ARCHITECTURE.md              # Technical architecture
│   ├── 02_DESIGN_PRINCIPLES.md         # Core design philosophy
│   ├── 03_DATA_MODEL.md               # Entity relationships and schema
│   ├── 04_GRDCS_SPECIFICATION.md       # Global relational data consistency
│   ├── 05_CROSS_MODULE_NAVIGATION.md   # Navigation specification
│   ├── 06_UI_UX_FOUNDATION.md          # UI patterns and standards
│   ├── 07_API_STANDARDS.md             # API design standards
│   ├── 08_BRAND_UI_DESIGN.md           # Visual design system
│   ├── 09_INFRASTRUCTURE.md            # Infrastructure architecture
│   └── 99_GLOSSARY.md                  # Terminology reference
│
├── phases/                              # Development phase specifications
│   ├── MASTER_BLUEPRINT.md             # Phase status overview (SINGLE SOURCE)
│   ├── PHASE_01_FOUNDATIONS.md
│   ├── PHASE_02_SCHEMA_AND_ENGINE_CORE.md
│   ├── ...
│   └── PHASE_35_CDR_OPEN_BANKING.md
│
├── operational/                         # HOW-TO runbooks for BAU team
│   ├── 00_INDEX.md                     # Operational docs navigation
│   ├── architecture/                   # System overview for operators
│   │   ├── 01_SYSTEM_OVERVIEW.md
│   │   ├── 02_ENVIRONMENT_STRATEGY.md
│   │   └── 03_TECHNOLOGY_STACK.md
│   ├── database/                       # Database operations
│   │   ├── 01_CLOUD_SQL_OPERATIONS.md
│   │   ├── 02_BACKUP_AND_RESTORE.md
│   │   └── 03_MONITORING_AND_ALERTS.md
│   ├── deployment/                     # Deployment procedures
│   │   ├── 01_CHANGE_TRANSPORT.md
│   │   ├── 02_VERCEL_DEPLOYMENT.md
│   │   └── 03_DATABASE_MIGRATIONS.md
│   ├── security/                       # Security operations
│   │   ├── 01_AUTHENTICATION.md
│   │   ├── 02_IAM_AND_PERMISSIONS.md
│   │   └── 03_CDR_COMPLIANCE.md
│   ├── runbooks/                       # Incident & operations runbooks
│   │   ├── 01_INCIDENT_RESPONSE.md
│   │   ├── 02_COMMON_OPERATIONS.md
│   │   ├── 03_HEALTH_CHECKS.md
│   │   ├── 04_BASIQ_OPERATIONS.md      # NEW - needed
│   │   ├── 05_SECRETS_MANAGEMENT.md    # NEW - needed
│   │   └── 06_PERFORMANCE_TUNING.md    # NEW - needed
│   └── integrations/                   # External service operations
│       ├── 01_BASIQ_OPEN_BANKING.md    # NEW - needed
│       ├── 02_FIREBASE_AUTH.md         # NEW - needed
│       └── 03_GCP_SERVICES.md         # NEW - needed
│
├── compliance/                          # CDR and regulatory compliance
│   ├── CDR_BASIQ_COMPLIANCE_MATRIX.md  # Requirements tracking
│   ├── CDR_IMPLEMENTATION_PLAN.md      # Implementation roadmap
│   └── CDR_DATA_RETENTION_SCHEDULE.md  # Retention schedule (move from policy/)
│
├── policy/                             # Organizational policies
│   ├── APPROVED_DEPENDENCIES.md
│   ├── DEVICE_SECURITY_POLICY.md
│   ├── INCIDENT_RESPONSE_PLAN.md
│   ├── SECURITY_AWARENESS_POLICY.md
│   └── CHANGE_MANAGEMENT_POLICY.md     # NEW - formalize change process
│
├── bau-framework/                      # BAU operational framework (THIS SUITE)
│   ├── 00_EXECUTIVE_SUMMARY.md
│   ├── 01_CURRENT_STATE_ASSESSMENT.md
│   ├── 02_DOCUMENT_DUPLICATION_ANALYSIS.md
│   ├── 03_GAP_ANALYSIS_REPORT.md
│   ├── 04_BAU_OPERATIONS_FRAMEWORK.md
│   ├── 05_BAU_TEAM_STRUCTURE.md
│   ├── 06_CDR_COMPLIANCE_OPERATIONS.md
│   ├── 07_DOCUMENT_MANAGEMENT_RESTRUCTURE.md
│   └── TRACKING_REFERENCE.md
│
├── api/                                # API documentation
│   └── STRATEGY_API.md
│
├── guides/                             # Setup and how-to guides
│   ├── OAUTH-SETUP.md                  # Move from docs/ root
│   ├── OAUTH-QUICKSTART.md             # Move from docs/ root
│   ├── SAFE_REFACTORING_GUIDE.md       # Move from docs/ root
│   └── QUICKSTART.md                   # Move from root
│
├── changelog/                          # Change history (consolidated)
│   ├── CHANGELOG.md                    # SINGLE consolidated changelog (reverse chronological)
│   └── archive/                        # Historical individual changelogs
│       ├── CHANGELOG_2025_12_01.md
│       ├── CHANGELOG_2025_12_04.md
│       └── ... (all existing changelogs)
│
├── audits/                             # Point-in-time audit reports
│   ├── AUDIT_REPORT_ALIGNED_2026-01.md # Authoritative audit (renamed)
│   ├── AUDIT_CFO_VALUE_2026-01.md      # CFO assessment
│   ├── AUDIT_DASHBOARD_2026-01.md      # Dashboard alignment
│   └── AUDIT_DATABASE_CALCS_2026-01.md # Calculation verification
│
├── migration/                          # Infrastructure migration plans
│   ├── MIGRATION_RENDER_TO_GCP_PLAN.md
│   ├── MIGRATION_RENDER_TO_GCP_STEPS.md
│   ├── GCP_IDENTITY_MIGRATION_PHASE2.md
│   └── GCP_IDENTITY_MIGRATION_PHASE3_MFA.md
│
├── supportpack/                        # AI support packs (existing)
│   ├── README.md
│   └── monitrax_support_pack_framework.md
│
├── strategy/                           # Strategy documentation
│   └── ANALYZER_LOGIC.md
│
├── prompts/                            # AI prompt engineering
│   └── GCP_IDENTITY_MIGRATION_PROMPT.md
│
└── archive/                            # ARCHIVED documents (obsolete/superseded)
    ├── README.md                       # "These documents are archived and no longer authoritative"
    ├── AUDIT_REPORT_2026-01-20.md      # Superseded by ALIGNED version
    ├── SYSTEM_AUDIT_REPORT_2025-11-23.md
    ├── GAP_ANALYSIS_2025-11-24.md
    ├── IMPLEMENTATION_PLAN_2025-11-24.md
    ├── PHASE_10_PROGRESS_2026-01-25.md
    ├── BUILD_SUMMARY_LEGACY.md
    ├── VALIDATION_REPORT.md
    ├── DEPLOYMENT-VALIDATION.md
    └── changelogs/                     # Individual changelogs (archived)
        └── ... (all CHANGELOG_*.md files)
```

### 2.2 Key Principles

| Principle | Implementation |
|-----------|---------------|
| **SSOT (Single Source of Truth)** | One authoritative location per topic. Cross-reference, never duplicate |
| **Clear Separation** | Architecture (design) vs Operational (how-to) vs Policy (rules) vs Compliance (regulatory) |
| **Archive, Don't Delete** | Obsolete docs moved to `archive/` with date suffix, never deleted |
| **Version Headers** | Every document must have: Date, Version, Status, Owner, Review Date |
| **Document Registry** | `00_INDEX.md` at root and in each section, lists all documents with status |

---

## 3. Document Standard Template

Every document should include this header:

```markdown
# Document Title

**Date:** YYYY-MM-DD
**Version:** X.Y
**Status:** DRAFT | ACTIVE | REVIEW | ARCHIVED
**Owner:** [Role/Name]
**Review Date:** YYYY-MM-DD (next scheduled review)
**Supersedes:** [Previous document path, if applicable]

---
```

---

## 4. Migration Plan

### 4.1 Phase 1: Foundation (Day 1-3) - LOW RISK

| Step | Action | Files Affected | Risk |
|------|--------|---------------|------|
| 1 | Create `docs/archive/` directory | New directory | None |
| 2 | Create `docs/archive/README.md` | New file | None |
| 3 | Create `docs/archive/changelogs/` directory | New directory | None |
| 4 | Move obsolete docs to `archive/` | 6 files | Low |
| 5 | Add deprecation notices to archived docs | 6 files | None |

### 4.2 Phase 2: Consolidation (Week 1-2) - MEDIUM RISK

| Step | Action | Files Affected | Risk |
|------|--------|---------------|------|
| 6 | Create consolidated `docs/changelog/CHANGELOG.md` | New file | Medium (large merge) |
| 7 | Move individual changelogs to `docs/archive/changelogs/` | 25+ files | Low |
| 8 | Create `docs/guides/` and move setup guides | 4 files | Low |
| 9 | Create `docs/audits/` and move audit reports | 4 files | Low |
| 10 | Create `docs/compliance/` and move CDR docs | 3 files | Low |
| 11 | Create `docs/migration/` and move migration docs | 4 files | Low |

### 4.3 Phase 3: Blueprint Restructure (Week 2-3) - MEDIUM RISK

| Step | Action | Files Affected | Risk |
|------|--------|---------------|------|
| 12 | Rename `docs/blueprint/` to `docs/phases/` (keep old as symlink) | 50+ files | Medium |
| 13 | Move core architecture docs (00-09) to `docs/architecture/` | 11 files | Medium |
| 14 | Keep PHASE_*.md files in `docs/phases/` | 35 files | Low |
| 15 | Update CLAUDE.md references | 1 file | Low |
| 16 | Update all internal cross-references | 50+ files | High |

### 4.4 Phase 4: Housekeeping (Week 3-4) - LOW RISK

| Step | Action | Files Affected | Risk |
|------|--------|---------------|------|
| 17 | Add version headers to all active docs | All active docs | Low |
| 18 | Create master `docs/00_INDEX.md` registry | New file | None |
| 19 | Add review dates and owners to all docs | All active docs | Low |
| 20 | Move root-level clutter files | 3-5 files | Low |
| 21 | Update `README.md` with new doc structure | 1 file | Low |

---

## 5. What Moves Where (Complete Map)

### 5.1 Files Currently in `docs/` Root

| Current Path | New Path | Action |
|-------------|----------|--------|
| `docs/AUDIT_REPORT.md` | `docs/archive/AUDIT_REPORT_2026-01-20.md` | Archive |
| `docs/AUDIT_REPORT_ALIGNED.md` | `docs/audits/AUDIT_REPORT_ALIGNED_2026-01.md` | Move + rename |
| `docs/GAP_ANALYSIS_REPORT.md` | `docs/archive/GAP_ANALYSIS_2025-11-24.md` | Archive |
| `docs/IMPLEMENTATION_PLAN.md` | `docs/archive/IMPLEMENTATION_PLAN_2025-11-24.md` | Archive |
| `docs/IMPLEMENTATION_CHANGELOG.md` | `docs/changelog/CHANGELOG.md` (merge into) | Consolidate |
| `docs/OAUTH-SETUP.md` | `docs/guides/OAUTH-SETUP.md` | Move |
| `docs/OAUTH-QUICKSTART.md` | `docs/guides/OAUTH-QUICKSTART.md` | Move |
| `docs/PHASE-11-REFERENCE.md` | `docs/phases/PHASE_11_REFERENCE.md` | Move + rename |
| `docs/PHASE_10_PROGRESS.md` | `docs/archive/PHASE_10_PROGRESS_2026-01-25.md` | Archive |
| `docs/PHASE9_REGRESSION_COMPLETE.md` | `docs/audits/PHASE9_REGRESSION_2025-11-23.md` | Move |
| `docs/PHASE9_REGRESSION_TEST_MATRIX.md` | `docs/audits/PHASE9_TEST_MATRIX_2025-11-23.md` | Move |
| `docs/SAFE_REFACTORING_GUIDE.md` | `docs/guides/SAFE_REFACTORING_GUIDE.md` | Move |
| `docs/SYSTEM_AUDIT_REPORT.md` | `docs/archive/SYSTEM_AUDIT_REPORT_2025-11-23.md` | Archive |
| `docs/Transactions nab.qif` | Remove from docs (data file) | Delete or move to test fixtures |

### 5.2 Files Currently in `docs/blueprint/`

| Current Path | New Path | Action |
|-------------|----------|--------|
| Core docs (00-09, 99) | `docs/architecture/` | Move |
| `PHASE_*.md` files | `docs/phases/` | Move |
| `MASTER_BLUEPRINT.md` | `docs/phases/MASTER_BLUEPRINT.md` | Move |
| `CHANGELOG_*.md` files | `docs/archive/changelogs/` | Archive (after consolidation) |
| `CDR_*.md` files | `docs/compliance/` | Move |
| `MIGRATION_*.md` files | `docs/migration/` | Move |
| `GCP_*.md` files | `docs/migration/` | Move |
| `AUDIT_*.md` files | `docs/audits/` | Move |
| `ADMIN_PORTAL_COMPLETION_PLAN.md` | `docs/phases/` or `docs/archive/` | Assess |
| `ERROR_LOG.md` | `docs/operational/runbooks/` or archive | Assess |

### 5.3 Files Currently at Root Level

| Current Path | New Path | Action |
|-------------|----------|--------|
| `BUILD_SUMMARY.md` | `docs/archive/BUILD_SUMMARY_LEGACY.md` | Archive |
| `QUICKSTART.md` | `docs/guides/QUICKSTART.md` | Move |
| `COLOR_PSYCHOLOGY.md` | `docs/architecture/` or `docs/archive/` | Assess |
| `VALIDATION_REPORT.md` | `docs/archive/` | Archive |
| `DEPLOYMENT-VALIDATION.md` | `docs/archive/` | Archive |
| `PR_DESCRIPTION.md` | `.github/PULL_REQUEST_TEMPLATE.md` | Move + rename |
| `ERROR_LOG.md` | Keep at root (referenced by CLAUDE.md) | Keep |
| `CLAUDE.md` | Keep at root (required) | Keep |
| `README.md` | Keep at root (required) | Keep |

---

## 6. CLAUDE.md Impact

The restructure requires updating CLAUDE.md references in:

### 6.1 Section: Step 1 - Read ALL Core Blueprint Documents

**Current:**
```
docs/blueprint/00_OVERVIEW.md
docs/blueprint/01_ARCHITECTURE_OVERVIEW.md
...
```

**Proposed:**
```
docs/architecture/00_OVERVIEW.md
docs/architecture/01_ARCHITECTURE.md
...
```

### 6.2 Section: Key File Locations (Part 8)

**Current:**
```
Blueprint Docs | docs/blueprint/
Changelogs     | docs/blueprint/CHANGELOG_*.md
Phase Docs     | docs/blueprint/PHASE_*.md
```

**Proposed:**
```
Architecture   | docs/architecture/
Phases         | docs/phases/
Changelog      | docs/changelog/CHANGELOG.md
Operational    | docs/operational/
Compliance     | docs/compliance/
```

---

## 7. Document Review Schedule

| Document Category | Review Frequency | Owner |
|------------------|-----------------|-------|
| Architecture (docs/architecture/) | Quarterly | Dev Lead / CTO |
| Phase specs (docs/phases/) | Per phase completion | Dev Lead |
| Operational (docs/operational/) | Monthly | BAU Lead |
| Policy (docs/policy/) | Quarterly (min) | Compliance Lead |
| Compliance (docs/compliance/) | Quarterly | Compliance Lead |
| BAU Framework (docs/bau-framework/) | Quarterly | BAU Lead |
| Guides (docs/guides/) | Semi-annually | BAU Lead |
| API docs (docs/api/) | Per API change | Dev Lead |

---

## 8. Document Governance Rules

1. **Every document has exactly ONE owner** responsible for accuracy
2. **Every document has a review date** - owner must review by that date
3. **No document without a version header** - Date, Version, Status, Owner, Review Date
4. **Changes to authoritative docs require PR** - same as code changes
5. **Archived docs are read-only** - never update an archived document
6. **Cross-reference, don't duplicate** - link to authoritative source
7. **Data files don't belong in docs/** - test fixtures go in `tests/` or `scripts/`
8. **CLAUDE.md must reflect current structure** - update paths when docs move

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Broken cross-references after move | High | Medium | Search-and-replace pass; verify with grep |
| CLAUDE.md out of sync | Medium | High | Update CLAUDE.md as part of migration PR |
| Team confusion during transition | Medium | Low | Announce migration, add redirects/symlinks |
| Git history loss | Low | Medium | Git tracks file moves; use `git mv` |
| External links break | Low | Low | GitHub handles renames in same repo |

---

## 10. Success Criteria

After migration is complete:

- [ ] Every document has a version header (Date, Version, Status, Owner)
- [ ] Zero documents exist in more than one authoritative location
- [ ] `docs/00_INDEX.md` registry is complete and accurate
- [ ] All CLAUDE.md path references are updated
- [ ] No obsolete documents in active directories
- [ ] All internal cross-references resolve correctly
- [ ] Archive directory has README explaining its purpose
- [ ] BAU team can find any procedure in < 60 seconds using the index

---

*This restructure should be done incrementally per the phased plan (Section 4). Each phase should be a separate PR for review. See TRACKING_REFERENCE.md for source verification.*
