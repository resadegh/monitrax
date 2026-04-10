# BAU Framework - Session Tracking & Reference Document

**Session Branch:** `claude/review-monitrax-docs-WU3nf`
**Started:** 2026-04-10
**Status:** IN PROGRESS

---

## RESEARCH COMPLETED - Key Facts (Verified Against Code)

### Repository Stats
- **Total Files:** 1,029 (776 TypeScript/TSX)
- **API Endpoints:** 200+ across 46 modules
- **Prisma Models:** 88+ models, 74+ enums
- **Documentation Files:** 100+
- **Development Phases:** 35 documented phases

### Architecture (Verified)
- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **Database:** PostgreSQL via Prisma ORM (Cloud SQL)
- **Auth:** GCP Identity Platform / Firebase Auth (migrated from custom JWT Feb 2026)
- **Deployment:** Vercel (frontend) + GCP (backend services)
- **Open Banking:** Basiq API integration
- **AI:** Google Gemini + OpenAI integration
- **UI:** Tailwind CSS + shadcn/ui + Radix UI

### Key Source Files (Verified)
| File | Lines | Purpose |
|------|-------|---------|
| `prisma/schema.prisma` | 3,987 | Database schema - 88+ models |
| `lib/services/masterFinancialService.ts` | 1,348 | Single source of truth for financial calcs |
| `lib/middleware.ts` | 198 | Legacy auth middleware (deprecated) |
| `lib/auth/guards.ts` | 485 | RBAC permission guards (current) |
| `lib/security/cdrAuditCompliance.ts` | 417 | CDR data sanitization & audit |
| `lib/utils/formatters.ts` | 240 | Currency, date, number formatting |
| `lib/utils/frequencies.ts` | 62 | Frequency conversion (weekly/monthly/annual) |

### Operational Docs Status (Verified)
| Area | Location | Quality |
|------|----------|---------|
| Architecture | `docs/operational/architecture/` (3 files) | Excellent |
| Database | `docs/operational/database/` (3 files) | Excellent |
| Security | `docs/operational/security/` (3 files) | Excellent |
| Deployment | `docs/operational/deployment/` (3 files) | Excellent |
| Runbooks | `docs/operational/runbooks/` (3 files) | Good (gaps) |
| Policy | `docs/policy/` (5 files) | Excellent |

### Document Duplications Found (Verified)
| Duplicate | Authoritative Version | Action |
|-----------|----------------------|--------|
| `docs/AUDIT_REPORT.md` | `docs/AUDIT_REPORT_ALIGNED.md` | Archive original |
| `docs/SYSTEM_AUDIT_REPORT.md` (Nov 2025) | Superseded by Jan 2026 audits | Archive with date |
| `docs/PHASE_10_PROGRESS.md` (45% - outdated) | `docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md` | Archive progress |
| `docs/GAP_ANALYSIS_REPORT.md` (Nov 2025) | Superseded by implementations | Archive |
| `docs/IMPLEMENTATION_PLAN.md` (Nov 2025) | `docs/IMPLEMENTATION_CHANGELOG.md` | Archive plan |
| `BUILD_SUMMARY.md` (root - obsolete) | `docs/IMPLEMENTATION_CHANGELOG.md` | Archive |
| 25+ `CHANGELOG_*.md` in blueprint/ | Fragmented - need consolidation | Consolidate |

### Key Gaps Found (Verified Against Code)
1. **No explicit CDR consent table** in Prisma schema (consent inferred from BasiqConnection)
2. **Legacy `Transaction` model** coexists with `UnifiedTransaction` (migration incomplete)
3. **Auth middleware dual-path** - `withAuth()` deprecated but still exported/used
4. **No caching** on `getMasterFinancialSnapshot()` (fetches everything every call)
5. **Hard-coded tax brackets** in masterFinancialService.ts (should use tax engine)
6. **Incident runbooks** only cover 5 scenarios (missing Basiq, Vercel, GCP outages)
7. **No performance tuning** documentation
8. **No Basiq operations** runbook
9. **No secrets rotation** procedures
10. **Budget tables exist** but not integrated into financial calculations

---

## DELIVERABLES PLAN

### Documents to Create (7 total)
1. `00_EXECUTIVE_SUMMARY.md` - DONE (draft)
2. `01_CURRENT_STATE_ASSESSMENT.md` - Architecture & maturity review
3. `02_DOCUMENT_DUPLICATION_ANALYSIS.md` - SSOT violations & remediation
4. `03_GAP_ANALYSIS_REPORT.md` - All gaps (design, arch, ops, CDR)
5. `04_BAU_OPERATIONS_FRAMEWORK.md` - SLAs, monitoring, escalation, procedures
6. `05_BAU_TEAM_STRUCTURE.md` - Team composition, roles, scaling
7. `06_CDR_COMPLIANCE_OPERATIONS.md` - Regulatory BAU requirements
8. `07_DOCUMENT_MANAGEMENT_RESTRUCTURE.md` - New folder structure proposal

### User Instructions
- **No changes to existing files** without explicit approval
- New documents go in `docs/bau-framework/` only
- All findings must reference verified code/files
- Present for review before committing

---

## SUBTASK BREAKDOWN

### Batch 1 (Current): Reference & Executive Summary
- [x] Create tracking reference (this file)
- [x] Create executive summary (draft)

### Batch 2: Current State Assessment + Duplication Analysis
- [x] Write `01_CURRENT_STATE_ASSESSMENT.md` - DONE
- [x] Write `02_DOCUMENT_DUPLICATION_ANALYSIS.md` - DONE

### Batch 3: Gap Analysis + CDR Compliance
- [x] Write `03_GAP_ANALYSIS_REPORT.md` - DONE
- [x] Write `06_CDR_COMPLIANCE_OPERATIONS.md` - DONE

### Batch 4: BAU Framework + Team Structure
- [x] Write `04_BAU_OPERATIONS_FRAMEWORK.md` - DONE
- [x] Write `05_BAU_TEAM_STRUCTURE.md` - DONE

### Batch 5: Document Restructure + Final Review
- [x] Write `07_DOCUMENT_MANAGEMENT_RESTRUCTURE.md` - DONE
- [x] Final review and consistency check - DONE
- [ ] Present to user for approval - PENDING
- [ ] Commit and push (after approval) - PENDING

---

*This document is the source of truth for this session's work. All findings above are verified against actual code and file contents.*
