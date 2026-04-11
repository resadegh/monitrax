# Mobile App — Shared Document Cross-Reference Map

**Date:** 2026-04-11 | **Version:** 1.0 | **Status:** ACTIVE

> These documents are shared between the web app and mobile app.
> They live in their **original locations** and are NOT duplicated into `docs/mobile/`.
> This file serves as a navigation map to all cross-cutting documentation.

---

## Architecture (Shared)

| Topic | Document | Location | Mobile Relevance |
|-------|----------|----------|-----------------|
| System overview & vision | 00_OVERVIEW.md | `docs/architecture/` | App purpose, guiding principles |
| 7-layer architecture | 01_ARCHITECTURE_OVERVIEW.md | `docs/architecture/` | Backend layers the mobile app calls into |
| Design principles & SSOT | 02_DESIGN_PRINCIPLES.md | `docs/architecture/` | Canonical utility locations (shared via @monitrax/core) |
| Data model & entities | 03_DATA_MODEL.md | `docs/architecture/` | Entity shapes, relationships, GRDCS contract |
| GRDCS specification | 04_GRDCS_SPECIFICATION.md | `docs/architecture/` | Entity IDs, hrefs, link format used in mobile API |
| API standards | 07_API_STANDARDS.md | `docs/architecture/` | Universal response envelope, auth headers, error codes |
| Brand & visual identity | 08_BRAND_UI_DESIGN.md | `docs/architecture/` | Colour system, typography, severity colours |
| Infrastructure & deployment | 09_INFRASTRUCTURE_AND_DEPLOYMENT.md | `docs/architecture/` | Backend infrastructure the mobile app depends on |

---

## Authentication & Security (Shared)

| Topic | Document | Location | Mobile Relevance |
|-------|----------|----------|-----------------|
| Auth architecture (Phase 10) | PHASE_10_AUTH_AND_SECURITY.md | `docs/blueprint/` | Firebase Auth, MFA, RBAC — same auth system for mobile |
| GCP Identity Platform migration | GCP_IDENTITY_MIGRATION_*.md | `docs/blueprint/` | Token verification flow used by mobile API calls |
| Security policies (26 policies) | MONITRAX_SECURITY_POLICIES.md | `docs/policy/` | Device security, MFA, access control — mobile must comply |
| Incident response plan | INCIDENT_RESPONSE_PLAN.md | `docs/policy/` | CDR breach response applies to mobile data too |
| Device security policy | DEVICE_SECURITY_POLICY.md | `docs/policy/` | Mobile addendum needed (documented in mobile compliance) |

---

## CDR Compliance (Shared)

| Topic | Document | Location | Mobile Relevance |
|-------|----------|----------|-----------------|
| CDR compliance matrix | CDR_BASIQ_COMPLIANCE_MATRIX.md | `docs/compliance/` | Mobile must maintain ~87% compliance score |
| CDR implementation plan | CDR_IMPLEMENTATION_PLAN.md | `docs/compliance/` | Roadmap for remaining CDR items |
| CDR data retention schedule | CDR_DATA_RETENTION_SCHEDULE.md | `docs/policy/` | Retention rules apply to mobile SQLite cache |
| CDR security hardening (Phase 34) | PHASE_34_CDR_SECURITY_HARDENING.md | `docs/blueprint/` | RBAC enforcement, MFA on CDR routes — mobile calls same routes |
| CDR data lifecycle (Phase 35) | PHASE_35_CDR_DATA_LIFECYCLE.md | `docs/blueprint/` | Consent-driven deletion — mobile must purge on revocation |
| CDR operational procedures | 03_CDR_COMPLIANCE.md | `docs/operational/security/` | Operational CDR checks that cover mobile |

---

## Financial Engines (Shared — No Duplication)

| Topic | Source Code | Mobile Usage |
|-------|-----------|-------------|
| Master Financial Service | `lib/services/masterFinancialService.ts` | Mobile snapshot API calls this; NOT duplicated |
| Net worth calculator | `lib/calculations/netWorthCalculator.ts` | Extracted into `@monitrax/core` for local calc |
| Cashflow orchestrator | `lib/calculations/cashflowOrchestrator.ts` | Extracted into `@monitrax/core` for local calc |
| Expense aggregator | `lib/calculations/expenseAggregator.ts` | Extracted into `@monitrax/core` for local calc |
| Income aggregator | `lib/calculations/incomeAggregator.ts` | Extracted into `@monitrax/core` for local calc |
| Currency formatter | `lib/utils/formatters.ts` | Extracted into `@monitrax/core` for local formatting |
| Frequency converter | `lib/utils/frequencies.ts` | Extracted into `@monitrax/core` for local conversion |
| Health score engine | `lib/health/aggregateEngine.ts` | Server-side only; results consumed via mobile snapshot API |
| Insights engine | `lib/intelligence/insightsEngine.ts` | Server-side only; results consumed via mobile insights API |

---

## Dependent Phase Documents

| Phase | Document | Location | Why It Matters for Mobile |
|-------|----------|----------|--------------------------|
| Phase 08 — GRDCS | PHASE_08_*.md | `docs/blueprint/` | Entity linking used in mobile drill-downs |
| Phase 12 — Financial Health | PHASE_12_*.md | `docs/blueprint/` | Health score displayed on Daily Pulse |
| Phase 13 — Transactional Intelligence | PHASE_13_*.md | `docs/blueprint/` | Transaction feed, AI categorisation, recurring detection |
| Phase 14 — Cashflow Optimisation | PHASE_14_*.md | `docs/blueprint/` | Cashflow forecast on mobile |
| Phase 14.5 — Mobile Web UI | PHASE_14.5_*.md | `docs/blueprint/` | Responsive web bridge (already complete) |
| Phase 17 — Personal CFO | PHASE_17_*.md | `docs/blueprint/` | Health score, risk radar data consumed on mobile |
| Phase 24 — Open Banking (Basiq) | PHASE_24_*.md | `docs/blueprint/` | Bank transactions, sync status, connection alerts |
| Phase 27 — Gemini AI | PHASE_27_*.md | `docs/blueprint/` | AI chat, transaction categorisation on mobile |

---

## Operational (Shared)

| Topic | Document | Location | Mobile Relevance |
|-------|----------|----------|-----------------|
| Change transport | 01_CHANGE_TRANSPORT.md | `docs/operational/deployment/` | Backend deployment process unchanged |
| Vercel deployment | 02_VERCEL_DEPLOYMENT.md | `docs/operational/deployment/` | Mobile API endpoints deployed via Vercel |
| Authentication operations | 01_AUTHENTICATION.md | `docs/operational/security/` | Firebase Auth operations apply to mobile |
| IAM & permissions | 02_IAM_AND_PERMISSIONS.md | `docs/operational/security/` | RBAC model applies to mobile API calls |
| Incident response runbook | 01_INCIDENT_RESPONSE.md | `docs/operational/runbooks/` | Base incident response; mobile extends with own runbook |
| Health checks | 03_HEALTH_CHECKS.md | `docs/operational/runbooks/` | Backend health checks cover mobile API |

---

## BAU Framework (Shared)

| Topic | Document | Location | Mobile Relevance |
|-------|----------|----------|-----------------|
| Gap analysis | 03_GAP_ANALYSIS_REPORT.md | `docs/bau-framework/` | Identifies pre-requisites for mobile (API versioning, WAF, etc.) |
| BAU operations framework | 04_BAU_OPERATIONS_FRAMEWORK.md | `docs/bau-framework/` | SLAs and operational schedules apply to mobile |
| Team structure | 05_BAU_TEAM_STRUCTURE.md | `docs/bau-framework/` | Solo operator risk — affects mobile timeline |
| CDR compliance operations | 06_CDR_COMPLIANCE_OPERATIONS.md | `docs/bau-framework/` | CDR daily/weekly checks cover mobile data |
