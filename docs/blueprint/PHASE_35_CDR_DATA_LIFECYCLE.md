# Phase 35: CDR Data Lifecycle Management

**Status:** ✅ COMPLETE
**Created:** 2026-03-08
**Completed:** 2026-03-08
**Priority:** P0 — CDR Compliance Critical
**Depends On:** Phase 34 (CDR Security Hardening), Phase 24 (Basiq Integration)
**Basiq Requirements:** §5.2, §5.4, §5.5, §5.6

---

## Overview

Phase 35 implements automated consent-driven CDR data management, the largest
compliance gap identified in the CDR Basiq Compliance Matrix (Section 5: CDR Data
Handling at 30%). This phase ensures CDR data is properly deleted when consent
expires or is revoked, per Australian Consumer Data Right regulations.

---

## Requirements Addressed

| Basiq § | Requirement | Implementation |
|---------|-------------|----------------|
| §5.2 | CDR data retained in de-identified format | `anonymizeCDRData()` in `lib/services/cdrDataLifecycle.ts` |
| §5.4 | CDR data deleted when no longer required | `deleteCDRData()` with retention policy support |
| §5.5 | CDR data deleted when consent expired | `checkConsentExpiry()` + Cloud Scheduler endpoint |
| §5.6 | CDR data deleted when consent revoked | `handleConsentRevocation()` + `/api/cdr/consent` |

---

## Architecture

### Canonical Service

**File:** `lib/services/cdrDataLifecycle.ts`

Single source of truth for all CDR data lifecycle operations (CLAUDE.md §12.2).

**Exports:**
- `deleteCDRData(userId, reason)` — Hard-delete all Basiq-sourced CDR data
- `checkConsentExpiry()` — Find expired consents, trigger deletion
- `handleConsentRevocation(userId, orgClientId)` — Immediate consent revocation + data purge
- `anonymizeCDRData(userId)` — De-identify CDR data for legal retention
- `hasActiveCDRConsent(userId)` — Check if user has active CDR consent
- `getCDRDataSummary(userId)` — CDR data counts (never raw data)

### Guards

**File:** `lib/auth/guards.ts`

- `withActiveConsent(permission, handler)` — Combined permission + MFA + consent check
  - Verifies active Basiq connections OR active org client consent
  - Returns 403 if no active consent found
  - Applied to CDR data read/write routes

### API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/cdr/lifecycle` | POST | CRON_SECRET | Cloud Scheduler consent expiry job |
| `/api/cdr/lifecycle` | GET | User auth | CDR data summary for user |
| `/api/cdr/consent` | GET | User auth | Consent status + CDR data summary |
| `/api/cdr/consent` | POST | User auth | Revoke consent / delete CDR data |

### CDR Data Routes Updated

| Route | Guard Before | Guard After |
|-------|-------------|------------|
| `GET /api/basiq/connections` | `withMFARequired` | `withActiveConsent` |
| `GET /api/basiq/connections/[id]` | `withMFARequired` | `withActiveConsent` |
| `POST /api/basiq/sync` | `withMFARequired` | `withActiveConsent` |
| `POST /api/basiq/connect` | `withMFARequired` | `withMFARequired` (unchanged — initiates consent) |
| `DELETE /api/basiq/connections/[id]` | `withMFARequired` | `withMFARequired` (unchanged — removes connection) |

---

## CDR Data Classification

CDR data in Monitrax is data sourced from Basiq (Open Banking):

| Data Type | Table | Identifier |
|-----------|-------|------------|
| Bank accounts | `Account` | `basiqAccountId IS NOT NULL` |
| Transactions | `UnifiedTransaction` | `source = 'BANK'` |
| Connections | `BasiqConnection` | All records |
| User reference | `User.basiqUserId` | Non-null value |

---

## Consent Lifecycle States

```
PENDING  →  GRANTED  →  EXPIRED  (automatic via checkConsentExpiry)
                     →  REVOKED  (user-initiated via /api/cdr/consent)
```

**On EXPIRED:** `checkConsentExpiry()` marks consent as EXPIRED, deletes CDR data if no other active consents.

**On REVOKED:** `handleConsentRevocation()` marks consent as REVOKED, deletes CDR data if no other active consents.

**Direct user consent:** Active BasiqConnection implies user has consented to data collection. User can delete CDR data via `/api/cdr/consent { action: 'delete_cdr_data' }`.

---

## GCP Cloud Scheduler Configuration

To enable automated consent expiry checks:

```
# GCP Cloud Scheduler Job
Name: cdr-consent-expiry-check
Schedule: 0 2 * * * (daily at 02:00 Australia/Sydney (AEST/AEDT))
Target type: HTTP
URL: https://<domain>/api/cdr/lifecycle
HTTP method: POST
Headers:
  Authorization: Bearer <CRON_SECRET>
  Content-Type: application/json
```

**Environment variable required:** `CRON_SECRET` — shared secret for authenticating cron jobs.

---

## Deletion Process

1. Identify CDR data (Basiq-sourced accounts, transactions, connections)
2. Hard-delete transactions (`UnifiedTransaction WHERE source = 'BANK'`)
3. Hard-delete accounts (`Account WHERE basiqAccountId IS NOT NULL`)
4. Hard-delete connections (`BasiqConnection`)
5. Clear user Basiq reference (`User.basiqUserId = null`)
6. Audit the deletion (`CDR_DATA_DELETED` action in AuditLog)

**Irreversible:** Per CDR rules, deletion is permanent. No soft-delete for CDR data.

---

## Anonymization Process (Legal Retention)

For cases where CDR data must be retained (e.g., loan applications):

1. Strip PII from accounts (name → ANONYMIZED, accountNumber → null, bsb → null)
2. Strip PII from transactions (merchantRaw → ANONYMIZED, description → ANONYMIZED)
3. Preserve aggregate data (amounts, dates, categories)
4. Delete connections (no retention value)
5. Audit the anonymization (`CDR_DATA_ANONYMIZED` action)

---

## Schema Changes

Added to `AuditAction` enum in `prisma/schema.prisma`:
- `CDR_DATA_DELETED` — CDR data hard-deleted
- `CDR_CONSENT_EXPIRED` — Consent expired automatically
- `CDR_CONSENT_REVOKED` — Consent revoked by user
- `CDR_DATA_ANONYMIZED` — CDR data de-identified

**Note:** Database migration required: `npx prisma db push` or `npx prisma migrate dev`

---

## Testing Checklist

- [x] Build passes (`npm run build`)
- [ ] Consent expiry simulation (create expired consent, run `checkConsentExpiry()`)
- [ ] Consent revocation via API (`POST /api/cdr/consent { action: 'revoke_org_consent' }`)
- [ ] CDR data deletion verification (check tables are empty after deletion)
- [ ] Audit log entries created for all CDR lifecycle actions
- [ ] `withActiveConsent` guard blocks access when no consent

---

## Files Created/Modified

### Created
- `lib/services/cdrDataLifecycle.ts` — Canonical CDR data lifecycle service
- `app/api/cdr/lifecycle/route.ts` — Cloud Scheduler endpoint + CDR data summary
- `app/api/cdr/consent/route.ts` — Consent management API
- `docs/blueprint/PHASE_35_CDR_DATA_LIFECYCLE.md` — This document

### Modified
- `lib/auth/guards.ts` — Added `withActiveConsent()` guard
- `prisma/schema.prisma` — Added CDR audit actions to `AuditAction` enum
- `app/api/basiq/connections/route.ts` — Switched to `withActiveConsent`
- `app/api/basiq/connections/[id]/route.ts` — GET switched to `withActiveConsent`
- `app/api/basiq/sync/route.ts` — Switched to `withActiveConsent`
