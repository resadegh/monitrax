# 02 - Document Duplication & Version Conflict Analysis

**Date:** 2026-04-10 | **Version:** 1.0 | **Status:** DRAFT

---

## 1. Executive Summary

The Monitrax repository contains **100+ documentation files** spread across 5 locations. Analysis reveals **12+ duplicate or obsolete documents**, **3 version conflicts**, and **significant SSOT (Single Source of Truth) violations**. This report identifies each issue and recommends remediation.

### Impact
- **Confusion Risk:** BAU team cannot determine which document is authoritative
- **CDR Compliance Risk:** Conflicting compliance guidance could lead to regulatory violations
- **Maintenance Overhead:** Duplicate documents require double updates, leading to drift
- **Onboarding Difficulty:** New team members cannot self-serve documentation reliably

---

## 2. Document Location Map (Current State)

```
monitrax/
├── Root Level (8 docs)
│   ├── CLAUDE.md                    # Claude Code protocol (active)
│   ├── README.md                    # Project readme (active)
│   ├── QUICKSTART.md                # App quickstart (active)
│   ├── BUILD_SUMMARY.md             # OBSOLETE (references Render)
│   ├── ERROR_LOG.md                 # Known errors (active)
│   ├── VALIDATION_REPORT.md         # Validation results
│   ├── DEPLOYMENT-VALIDATION.md     # Deploy validation
│   ├── PR_DESCRIPTION.md            # PR template
│   └── COLOR_PSYCHOLOGY.md          # UI design notes
│
├── docs/ (14 files - MIXED: active, obsolete, duplicate)
│   ├── AUDIT_REPORT.md              # DUPLICATE of ALIGNED version
│   ├── AUDIT_REPORT_ALIGNED.md      # AUTHORITATIVE audit (Jan 2026)
│   ├── GAP_ANALYSIS_REPORT.md       # OBSOLETE (Nov 2025)
│   ├── IMPLEMENTATION_PLAN.md       # OBSOLETE (Nov 2025)
│   ├── IMPLEMENTATION_CHANGELOG.md  # ACTIVE (Jan 2026)
│   ├── OAUTH-SETUP.md               # ACTIVE (complete guide)
│   ├── OAUTH-QUICKSTART.md          # ACTIVE (quick guide)
│   ├── PHASE-11-REFERENCE.md        # Reference pointer (valid)
│   ├── PHASE_10_PROGRESS.md         # OBSOLETE (outdated status)
│   ├── PHASE9_REGRESSION_COMPLETE.md# ACTIVE (test results)
│   ├── PHASE9_REGRESSION_TEST_MATRIX.md # ACTIVE (test matrix)
│   ├── SAFE_REFACTORING_GUIDE.md    # ACTIVE (process guide)
│   ├── SYSTEM_AUDIT_REPORT.md       # OUTDATED (Nov 2025)
│   └── Transactions nab.qif         # DATA FILE (not documentation)
│
├── docs/blueprint/ (50+ files)
│   ├── Core Architecture (00-09)    # AUTHORITATIVE design specs
│   ├── PHASE_01-35 docs             # AUTHORITATIVE phase specs
│   ├── CHANGELOG_*.md (25+ files)   # FRAGMENTED - need consolidation
│   ├── AUDIT_*.md (3 files)         # Specialized audits (valid)
│   ├── CDR_*.md (2 files)           # CDR compliance (valid)
│   ├── GCP_*.md (2 files)           # GCP migration (valid)
│   ├── MIGRATION_*.md (2 files)     # DB migration (valid)
│   ├── MASTER_BLUEPRINT.md          # Master reference (active)
│   └── Various planning docs        # Various status
│
├── docs/operational/ (15 files)     # WELL-STRUCTURED (active)
│   ├── architecture/ (3 files)
│   ├── database/ (3 files)
│   ├── deployment/ (3 files)
│   ├── runbooks/ (3 files)
│   └── security/ (3 files)
│
├── docs/policy/ (5 files)           # WELL-STRUCTURED (active)
│
├── docs/supportpack/ (3 files)      # INCOMPLETE (template only)
│
├── docs/api/ (1 file)               # ACTIVE
├── docs/strategy/ (1 file)          # ACTIVE
└── docs/prompts/ (1 file)           # ACTIVE
```

---

## 3. Detailed Duplication Findings

### 3.1 CRITICAL: Audit Report Triplication

| File | Date | Lines | Content |
|------|------|-------|---------|
| `docs/AUDIT_REPORT.md` | Jan 20, 2026 | ~550 | Full application audit |
| `docs/AUDIT_REPORT_ALIGNED.md` | Jan 20, 2026 | ~545 | Same audit + blueprint alignment |
| `docs/SYSTEM_AUDIT_REPORT.md` | Nov 23, 2025 | ~320 | Phase 9 system audit |

**Overlap:** AUDIT_REPORT.md and AUDIT_REPORT_ALIGNED.md share **90% identical content**. The ALIGNED version adds blueprint compliance tracking and remediation status.

**Version Conflict:** SYSTEM_AUDIT_REPORT.md (Nov 2025) reports Phase 9.5 components as "NOT integrated" - this was fixed in subsequent phases but the document was never updated.

**Recommendation:**
- **KEEP:** `docs/AUDIT_REPORT_ALIGNED.md` (authoritative, most complete)
- **ARCHIVE:** `docs/AUDIT_REPORT.md` → move to `docs/archive/AUDIT_REPORT_2026-01-20.md`
- **ARCHIVE:** `docs/SYSTEM_AUDIT_REPORT.md` → move to `docs/archive/SYSTEM_AUDIT_REPORT_2025-11-23.md`

---

### 3.2 CRITICAL: Phase 10 Version Conflict

| File | Date | Status Reported | Actual Status |
|------|------|----------------|---------------|
| `docs/PHASE_10_PROGRESS.md` | Jan 25, 2026 | 45% Complete (Paused) | 100% Complete |
| `docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md` | Feb 2026 | Complete (GCP migration done) | 100% Complete |

**Conflict:** The progress report is frozen at 45% while the blueprint doc shows full completion including GCP Identity Platform migration. Anyone reading the progress report would incorrectly believe Phase 10 is incomplete.

**Recommendation:**
- **KEEP:** `docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md` (authoritative, current)
- **ARCHIVE:** `docs/PHASE_10_PROGRESS.md` → move to `docs/archive/`

---

### 3.3 HIGH: Obsolete Implementation Documents

| File | Date | Why Obsolete |
|------|------|-------------|
| `docs/GAP_ANALYSIS_REPORT.md` | Nov 24, 2025 | Reports 63% completion; many gaps now closed |
| `docs/IMPLEMENTATION_PLAN.md` | Nov 24, 2025 | 8-build plan; most builds completed |
| `BUILD_SUMMARY.md` (root) | Early 2025 | References Render deployment (migrated to GCP) |

**Impact:** These documents report outdated completion percentages and reference deprecated infrastructure (Render vs GCP). A BAU team member reading these would have an incorrect understanding of system state.

**Recommendation:**
- **ARCHIVE:** All three to `docs/archive/` with date suffixes
- **REPLACE:** Create single "Current System Status" section in Master Blueprint

---

### 3.4 HIGH: Changelog Fragmentation

The `docs/blueprint/` directory contains **25+ separate changelog files**:

```
CHANGELOG_2025_12_01.md
CHANGELOG_2025_12_04.md
CHANGELOG_2025_12_08.md
CHANGELOG_2025_12_14.md
CHANGELOG_2025_12_19.md
CHANGELOG_2025_12_25.md
CHANGELOG_2026_01_19.md
CHANGELOG_2026_01_20.md
CHANGELOG_2026_01_21.md
CHANGELOG_2026_01_25.md
CHANGELOG_2026_01_28.md
CHANGELOG_2026_02_03.md
CHANGELOG_2026_02_25.md
CHANGELOG_2026_02_27.md
CHANGELOG_2026_03_03.md
CHANGELOG_2026_03_04.md
CHANGELOG_2026_03_08.md
CHANGELOG_2026_04_09.md
... (and more)
```

**Plus:** `docs/IMPLEMENTATION_CHANGELOG.md` serves as a separate changelog.

**Issue:** No single place to see "what changed and when." A BAU team member must read 25+ files to understand change history.

**Recommendation:**
- **CONSOLIDATE:** Create `docs/CHANGELOG.md` (single file, reverse chronological)
- **ARCHIVE:** Move individual changelogs to `docs/archive/changelogs/`
- **PROCESS:** Future changes logged in single file per CLAUDE.md protocol

---

### 3.5 MEDIUM: Architecture Documentation Overlap

| Blueprint Doc | Operational Doc | Overlap |
|--------------|-----------------|---------|
| `docs/blueprint/01_ARCHITECTURE_OVERVIEW.md` | `docs/operational/architecture/01_SYSTEM_OVERVIEW.md` | 30% content overlap |
| `docs/blueprint/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` | `docs/operational/deployment/02_VERCEL_DEPLOYMENT.md` | 20% content overlap |
| `docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md` | `docs/operational/security/01_AUTHENTICATION.md` | 25% content overlap |

**Assessment:** This overlap is **intentional and acceptable** - blueprint docs describe the *design* while operational docs describe *how to operate*. However, they must stay in sync.

**Recommendation:**
- **KEEP BOTH** but add cross-reference headers: "Design spec: see blueprint/01_ARCHITECTURE_OVERVIEW.md"
- **ESTABLISH SYNC RULE:** When blueprint changes, operational doc review is triggered

---

### 3.6 MEDIUM: CDR Documentation - Well Structured

| File | Scope | Status |
|------|-------|--------|
| `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` | Basiq accreditation requirements | Current |
| `docs/operational/security/03_CDR_COMPLIANCE.md` | Operational CDR procedures | Current |
| `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` | Data retention policy | Current |
| `docs/blueprint/CDR_IMPLEMENTATION_PLAN.md` | CDR implementation roadmap | Current |

**Assessment:** CDR documentation is **well-structured with clear separation of concerns**. No duplication detected. This is the model other areas should follow.

---

### 3.7 LOW: Root-Level Documentation Clutter

Files at repository root that should be relocated:

| File | Current Location | Suggested Location |
|------|-----------------|-------------------|
| `COLOR_PSYCHOLOGY.md` | Root | `docs/design/` or archive |
| `PR_DESCRIPTION.md` | Root | `.github/PULL_REQUEST_TEMPLATE.md` |
| `VALIDATION_REPORT.md` | Root | `docs/archive/` |
| `DEPLOYMENT-VALIDATION.md` | Root | `docs/archive/` |
| `BUILD_SUMMARY.md` | Root | `docs/archive/` |

---

## 4. SSOT (Single Source of Truth) Violations

### 4.1 Violation Matrix

| Information | Location 1 | Location 2 | Location 3 | SSOT Recommendation |
|------------|-----------|-----------|-----------|-------------------|
| System architecture | `blueprint/01_ARCHITECTURE_OVERVIEW.md` | `operational/architecture/01_SYSTEM_OVERVIEW.md` | | Blueprint = design, Operational = how-to |
| Phase completion status | Individual `PHASE_*.md` files | `MASTER_BLUEPRINT.md` | `docs/PHASE_*_PROGRESS.md` | MASTER_BLUEPRINT.md only |
| Change history | 25+ `CHANGELOG_*.md` | `IMPLEMENTATION_CHANGELOG.md` | Git history | Single `CHANGELOG.md` |
| Audit findings | `AUDIT_REPORT.md` | `AUDIT_REPORT_ALIGNED.md` | `SYSTEM_AUDIT_REPORT.md` | `AUDIT_REPORT_ALIGNED.md` only |
| Auth implementation | `PHASE_10_AUTH_AND_SECURITY.md` | `operational/security/01_AUTHENTICATION.md` | `PHASE_10_PROGRESS.md` | Blueprint + Operational (no progress doc) |
| CDR requirements | `CDR_BASIQ_COMPLIANCE_MATRIX.md` | `CDR_IMPLEMENTATION_PLAN.md` | `operational/security/03_CDR_COMPLIANCE.md` | Each has distinct scope (OK) |

### 4.2 SSOT Principles to Enforce

1. **One authoritative source per topic** - Mark it clearly as "AUTHORITATIVE"
2. **Cross-reference, don't duplicate** - Link to authoritative source
3. **Archive, don't delete** - Move obsolete docs to `docs/archive/` with dates
4. **Version headers required** - Every doc must have: Date, Version, Status, Author
5. **Review schedule** - Each doc has a review date; owner responsible for accuracy

---

## 5. Remediation Plan

### Priority 1: Immediate Cleanup (Day 1-3)

| Action | Files Affected | Risk |
|--------|---------------|------|
| Create `docs/archive/` directory | New directory | None |
| Move obsolete docs to archive | 6 files | Low - git history preserved |
| Add deprecation notice to archived docs | 6 files | None |
| Add version headers to all active docs | All active docs | Low |

### Priority 2: Consolidation (Week 1-2)

| Action | Files Affected | Risk |
|--------|---------------|------|
| Consolidate changelogs into single file | 25+ files | Medium - large merge |
| Add cross-reference headers between blueprint/operational | 6 file pairs | Low |
| Move root-level clutter to appropriate locations | 5 files | Low |

### Priority 3: Structure Reform (Week 2-4)

| Action | Files Affected | Risk |
|--------|---------------|------|
| Implement new folder structure (see Doc 07) | All docs | Medium - many path changes |
| Update all internal cross-references | All docs | Medium |
| Create document registry/index | New file | None |
| Establish review schedule | New process | None |

---

## 6. Files Recommended for Archival

| File | Reason | Archive Name |
|------|--------|-------------|
| `docs/AUDIT_REPORT.md` | Superseded by ALIGNED version | `archive/AUDIT_REPORT_2026-01-20.md` |
| `docs/SYSTEM_AUDIT_REPORT.md` | Outdated (Nov 2025) | `archive/SYSTEM_AUDIT_REPORT_2025-11-23.md` |
| `docs/PHASE_10_PROGRESS.md` | Status frozen at 45% (actually 100%) | `archive/PHASE_10_PROGRESS_2026-01-25.md` |
| `docs/GAP_ANALYSIS_REPORT.md` | Superseded by implementations | `archive/GAP_ANALYSIS_2025-11-24.md` |
| `docs/IMPLEMENTATION_PLAN.md` | Superseded (Nov 2025 plan) | `archive/IMPLEMENTATION_PLAN_2025-11-24.md` |
| `BUILD_SUMMARY.md` (root) | References Render (deprecated) | `archive/BUILD_SUMMARY_LEGACY.md` |
| `VALIDATION_REPORT.md` (root) | Point-in-time snapshot | `archive/VALIDATION_REPORT.md` |
| `DEPLOYMENT-VALIDATION.md` (root) | Point-in-time snapshot | `archive/DEPLOYMENT-VALIDATION.md` |

---

*All findings verified by reading actual file contents and comparing against codebase. See TRACKING_REFERENCE.md for verification methodology.*
