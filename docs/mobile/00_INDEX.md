# Monitrax Mobile Companion App — Documentation Index

**Date:** 2026-04-11 | **Version:** 1.0 | **Status:** ACTIVE | **Owner:** Dev Lead

> Master registry for all mobile companion app documentation.
> Shared/crossover documents remain in their original locations — see [00_CROSS_REFERENCES.md](00_CROSS_REFERENCES.md).

---

## Quick Navigation

| Need | Go To |
|------|-------|
| Mobile architecture & system design | [architecture/](#architecture) |
| Phase 15 blueprint (master spec) | [blueprint/](#blueprint) |
| Visual design system & screen specs | [design/](#design) |
| Mobile API endpoint contracts | [api/](#api) |
| Phased implementation plan | [implementation/](#implementation) |
| Build, deploy, App Store operations | [operations/](#operations) |
| Testing strategy & device matrix | [testing/](#testing) |
| CDR mobile compliance rules | [compliance/](#compliance) |
| Shared docs (auth, GRDCS, CDR, etc.) | [00_CROSS_REFERENCES.md](00_CROSS_REFERENCES.md) |

---

## Architecture

> **Purpose:** Mobile-specific architecture decisions, system design, and data flows

| Document | Description | Status |
|----------|-------------|--------|
| [01_MOBILE_ARCHITECTURE.md](architecture/01_MOBILE_ARCHITECTURE.md) | System architecture, tech stack, data flows, offline-first design | ACTIVE |

---

## Blueprint

> **Purpose:** The master Phase 15 specification — single source of truth for the mobile app

| Document | Description | Status |
|----------|-------------|--------|
| [PHASE_15_MOBILE_COMPANION_APP.md](blueprint/PHASE_15_MOBILE_COMPANION_APP.md) | Complete 20-section blueprint v2.0 | ACTIVE |

> **Note:** A symlink remains at `docs/blueprint/PHASE_15_MOBILE_COMPANION_APP.md` for consistency with the Phase document naming convention.

---

## Design

> **Purpose:** Mobile design system, screen specifications, and UX patterns

| Document | Description | Status |
|----------|-------------|--------|
| [01_DESIGN_SYSTEM.md](design/01_DESIGN_SYSTEM.md) | Mobile design system — brand adaptation, components, patterns | ACTIVE |
| [02_SCREEN_SPECIFICATIONS.md](design/02_SCREEN_SPECIFICATIONS.md) | Screen-by-screen wireframe specs for all mobile screens | PLANNED |

---

## API

> **Purpose:** Mobile API endpoint contracts, request/response shapes, versioning

| Document | Description | Status |
|----------|-------------|--------|
| [01_MOBILE_API_CONTRACT.md](api/01_MOBILE_API_CONTRACT.md) | All `/api/v1/mobile/*` endpoint specifications | ACTIVE |

---

## Implementation

> **Purpose:** Phased implementation plan with sprint tasks, dependencies, and acceptance criteria

| Document | Description | Status |
|----------|-------------|--------|
| [01_IMPLEMENTATION_PLAN.md](implementation/01_IMPLEMENTATION_PLAN.md) | 7-sprint implementation roadmap with detailed task breakdowns | ACTIVE |
| [02_PRE_IMPLEMENTATION_CHECKLIST.md](implementation/02_PRE_IMPLEMENTATION_CHECKLIST.md) | Pre-requisites that must be completed before Sprint 0 | ACTIVE |

---

## Operations

> **Purpose:** Build, deploy, App Store management, and incident response for mobile

| Document | Description | Status |
|----------|-------------|--------|
| [01_BUILD_AND_DEPLOY.md](operations/01_BUILD_AND_DEPLOY.md) | EAS Build, App Store submission, OTA updates, release management | ACTIVE |
| [02_RUNBOOK.md](operations/02_RUNBOOK.md) | Mobile-specific incident response and troubleshooting | ACTIVE |

---

## Testing

> **Purpose:** Testing strategy, device matrix, performance benchmarks, CDR compliance tests

| Document | Description | Status |
|----------|-------------|--------|
| [01_TESTING_STRATEGY.md](testing/01_TESTING_STRATEGY.md) | Complete testing framework for mobile app | ACTIVE |

---

## Compliance

> **Purpose:** CDR/Basiq mobile-specific compliance requirements

| Document | Description | Status |
|----------|-------------|--------|
| [01_CDR_MOBILE_COMPLIANCE.md](compliance/01_CDR_MOBILE_COMPLIANCE.md) | CDR data handling, consent lifecycle, device security on mobile | ACTIVE |

---

## Governance Rules

1. **No duplication** — shared documents (auth, GRDCS, CDR matrix, brand guidelines) stay in their original location; this folder only contains mobile-specific documents
2. **Cross-references, not copies** — `00_CROSS_REFERENCES.md` maps to all shared documents
3. **Phase 15 is the master spec** — all other mobile docs are derived from or support the blueprint
4. **One owner per document** — Dev Lead owns all mobile docs unless specified otherwise
5. **Changes via PR** — all mobile doc changes follow the same PR process as the web app
