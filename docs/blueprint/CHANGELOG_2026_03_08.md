# Changelog - 2026-03-08

## Session: V6Y66 — Phase D: CDR Data Lifecycle (Phase 35)

### Changes Made
- **Type**: Feature — CDR Compliance
- **Scope**: CDR Data Lifecycle Management (Basiq §5.2, §5.4, §5.5, §5.6)
- **Description**: Implemented automated consent-driven CDR data management — the largest compliance gap (CDR Data Handling was at 30%, now at 60%). Created canonical CDR Data Lifecycle Service, consent verification guard, consent revocation API, and Cloud Scheduler endpoint for automated consent expiry checks.

### Files Created
- `lib/services/cdrDataLifecycle.ts` — Canonical CDR data lifecycle service (deletion, expiry, revocation, anonymization)
- `app/api/cdr/lifecycle/route.ts` — Cloud Scheduler endpoint (POST) + CDR data summary (GET)
- `app/api/cdr/consent/route.ts` — Consent management API (revoke consent, delete CDR data)
- `docs/blueprint/PHASE_35_CDR_DATA_LIFECYCLE.md` — Phase 35 blueprint document

### Files Modified
- `lib/auth/guards.ts` — Added `withActiveConsent()` guard (permission + MFA + consent check)
- `prisma/schema.prisma` — Added CDR audit actions: `CDR_DATA_DELETED`, `CDR_CONSENT_EXPIRED`, `CDR_CONSENT_REVOKED`, `CDR_DATA_ANONYMIZED`
- `app/api/basiq/connections/route.ts` — Switched from `withMFARequired` to `withActiveConsent`
- `app/api/basiq/connections/[id]/route.ts` — GET switched to `withActiveConsent`
- `app/api/basiq/sync/route.ts` — Switched from `withMFARequired` to `withActiveConsent`

### Documentation Updated
- `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` — §5.2, §5.4, §5.5, §5.6 marked DONE; overall score 70% → 78%
- `docs/blueprint/CDR_IMPLEMENTATION_PLAN.md` — Phase D marked COMPLETE
- `docs/blueprint/PHASE_35_CDR_DATA_LIFECYCLE.md` — Created
- `docs/blueprint/CHANGELOG_2026_03_08.md` — This file

### Build Status
- [x] TypeScript compilation passes
- [x] Build passes (`npm run build`)

### Architecture Decisions
- **Canonical service pattern**: All CDR lifecycle operations in `lib/services/cdrDataLifecycle.ts` (CLAUDE.md §12.2)
- **Guard composition**: `withActiveConsent` combines permission + MFA + consent in one guard (no middleware stacking)
- **CDR data identification**: Basiq-sourced data identified by `basiqAccountId IS NOT NULL` (accounts), `source = 'BANK'` (transactions), all `BasiqConnection` records
- **Consent model**: Active consent = active BasiqConnection OR active OrganizationClient consent
- **Cloud Scheduler auth**: CRON_SECRET env var (not user auth) for the lifecycle cron job
- **Hard delete**: CDR data deletion is irreversible per CDR rules (no soft-delete)

### Compliance Impact
| Section | Before | After |
|---------|--------|-------|
| §5.2 (De-identification) | TODO | DONE |
| §5.4 (Data deletion) | TODO | DONE |
| §5.5 (Consent expiry) | PARTIAL | DONE |
| §5.6 (Consent revocation) | PARTIAL | DONE |
| Overall score | ~70% | ~78% |

### User Actions Required
1. Run `npx prisma db push` or `npx prisma migrate dev` to add CDR audit actions to database
2. Set `CRON_SECRET` environment variable in production
3. Configure GCP Cloud Scheduler job (see `PHASE_35_CDR_DATA_LIFECYCLE.md` for config)

---

## Session: V6Y66 — Phase F: Policy Documents + Phase G: Dev Pipeline Hardening

### Changes Made
- **Type**: Documentation + Configuration — CDR Compliance
- **Scope**: Policy Documents (Basiq §4, §5.8, §6.4, §7), Dev Pipeline (Basiq §6.4, §6.5)
- **Description**: Created all 5 required policy documents for Basiq CDR accreditation and configured automated dependency management and security scanning. Compliance score improved from ~78% to ~87%.

### Files Created
- `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` — CDR data types, retention periods, legal basis, deletion triggers (§5.4, §5.8)
- `docs/policy/DEVICE_SECURITY_POLICY.md` — Device patching, network isolation, endpoint protection (§4.1, §4.2, §4.3)
- `docs/policy/INCIDENT_RESPONSE_PLAN.md` — Breach classification, containment, OAIC notification, recovery
- `docs/policy/SECURITY_AWARENESS_POLICY.md` — Training requirements, CDR handling, onboarding plan (§7.1, §7.3)
- `docs/policy/APPROVED_DEPENDENCIES.md` — 40+ packages documented with version, purpose, license (§6.4)
- `.github/dependabot.yml` — Weekly npm dependency update PRs with package grouping (§6.5)
- `.github/workflows/security-audit.yml` — npm audit CI pipeline + build verification (§6.4, §6.5)

### Files Modified
- `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` — §4.1-4.3, §5.8, §6.4, §6.5, §7.1-7.3 marked DONE; score 78% → 87%
- `docs/blueprint/CDR_IMPLEMENTATION_PLAN.md` — Phase F, G marked COMPLETE; score and dashboard updated
- `docs/blueprint/MASTER_BLUEPRINT.md` — Phase 34, 35 marked Complete in Planned Phases
- `docs/blueprint/CHANGELOG_2026_03_08.md` — This entry added

### Build Status
- [x] No code changes (documentation + CI config only)
- [x] No build verification needed (no TypeScript changes)

### Compliance Impact
| Section | Before | After | Items Changed |
|---------|--------|-------|---------------|
| §4.x (Device Management) | N/A | DONE | 4.1, 4.2, 4.3 |
| §5.8 (CDR Retention) | N/A | DONE | 5.8 |
| §6.4 (Library review) | PARTIAL | DONE | 6.4 |
| §6.5 (Library updates) | TODO | DONE | 6.5 |
| §7.x (HR Practices) | N/A | DONE | 7.1, 7.2, 7.3 |
| Overall score | ~78% | ~87% | +9% |

### Architecture Decisions
- **Policy-as-documentation**: All policy documents in `docs/policy/` per CLAUDE.md §13.8
- **Dependabot grouping**: Packages grouped by family (Radix UI, Google Cloud, types, testing) to reduce PR noise
- **CI audit levels**: Critical vulnerabilities block the pipeline; high vulnerabilities warn but don't block
- **Sole trader context**: HR policies (§7.x) documented with future staff onboarding plan rather than N/A
