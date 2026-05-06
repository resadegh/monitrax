# CDR Data Retention Schedule

**Version:** 1.0
**Created:** 2026-03-08
**Owner:** Resadegh (Director, Monitrax)
**Review Cycle:** Annual (next review: 2027-03-08)
**Basiq Requirement:** Section 5 — Handling of CDR Data (§5.4, §5.8)
**Legal Basis:** Australian Consumer Data Right (CDR) — Privacy Safeguard 12, 13

---

## 1. Purpose

This document defines what CDR data Monitrax collects, how long it is retained, the legal basis for retention, and the deletion process when the retention period ends.

CDR data is any data received from a consumer's financial institution via the CDR regime (Open Banking through Basiq).

---

## 2. CDR Data Classification

| Data Type | Source | Database Table | Identifier |
|-----------|--------|---------------|------------|
| Bank accounts | Basiq Open Banking | `Account` | `basiqAccountId IS NOT NULL` |
| Bank transactions | Basiq Open Banking | `UnifiedTransaction` | `source = 'BANK'` |
| Bank connections | Basiq API | `BasiqConnection` | All records |
| User Basiq reference | Basiq API | `User.basiqUserId` | Non-null value |

### CDR-Derived Data

Data calculated from CDR inputs is treated as CDR data:

| Derived Data | Source | Treatment |
|-------------|--------|-----------|
| Health scores using bank data | CDR accounts + transactions | CDR-derived |
| Cashflow projections from bank transactions | CDR transactions | CDR-derived |
| Net worth including bank balances | CDR account balances | CDR-derived |

---

## 3. Retention Schedule

| Data Type | Retention Period | Legal Basis | Deletion Trigger |
|-----------|-----------------|-------------|------------------|
| Bank accounts | While consent is ACTIVE | User consent via Basiq | Consent expiry or revocation |
| Bank transactions | While consent is ACTIVE | User consent via Basiq | Consent expiry or revocation |
| Bank connections | While consent is ACTIVE | User consent via Basiq | Consent expiry or revocation |
| User Basiq reference | While consent is ACTIVE | User consent via Basiq | Consent expiry or revocation |
| CDR audit logs | 7 years minimum | CDR Privacy Safeguard 12 (record keeping) | Automatic after 7 years |
| Anonymized CDR data (loan applications) | Duration of loan + 7 years | Financial services record keeping obligation | Automatic after retention period |
| **Professional conversation messages** (Phase 32C PR4d, May 2026) | **7 years** from creation | Corporations Act §912F (AFSL 7yr recordkeeping); explicit user disclosure at consent time | `retentionUntil < now()` sweep — scheduler DEFERRED to PROD; soft-delete from user view does NOT remove the message |
| **Professional listing verification notes** (Phase 32C PR4a) | While listing is APPROVED + 7 years | Audit trail for ASIC + TPB cross-check decisions | Listing deletion + 7yr |
| **Stripe webhook events** (Phase 32C PR6) | 7 years | Financial transaction audit trail | Automatic after 7 years |
| **Professional request lifecycle records** (Phase 32C PR4c) | 7 years | AFSL recordkeeping for accepted engagements | Automatic after 7 years post-final-status |
| **Adviser feedback threads** (Phase 33g) | While adviser org is active + 2 years | Internal product feedback (not CDR data) | Org deletion + 2 years |

---

## 4. Consent Lifecycle

CDR data retention is governed entirely by user consent:

| Consent State | Data Action | Timeline |
|---------------|------------|----------|
| **ACTIVE** | Data retained and accessible | Ongoing |
| **EXPIRED** | Data deleted automatically | Within 24 hours of expiry (daily check at 02:00 UTC) |
| **REVOKED** | Data deleted immediately | Immediate upon user action |
| **User requests deletion** | Data deleted immediately | Immediate upon user action |

### Consent Expiry Check

- **Frequency:** Daily at 02:00 UTC via GCP Cloud Scheduler
- **Endpoint:** `POST /api/cdr/lifecycle`
- **Service:** `checkConsentExpiry()` in `lib/services/cdrDataLifecycle.ts`

---

## 5. Deletion Process

When CDR data must be deleted:

1. **Hard-delete** bank transactions (`UnifiedTransaction WHERE source = 'BANK'`)
2. **Hard-delete** bank accounts (`Account WHERE basiqAccountId IS NOT NULL`)
3. **Hard-delete** Basiq connections (`BasiqConnection`)
4. **Clear** user Basiq reference (`User.basiqUserId = null`)
5. **Audit** the deletion (`CDR_DATA_DELETED` action in `AuditLog`)
6. **Notify** the user that their CDR data has been removed

**Deletion is irreversible.** Per CDR rules, there is no soft-delete for CDR data.

### Legal Retention Override

In cases where CDR data must be retained for legal reasons (e.g., active loan application):

1. Data is **anonymized** instead of deleted using `anonymizeCDRData()` in `lib/services/cdrDataLifecycle.ts`
2. PII is stripped (account numbers, BSBs, merchant names)
3. Aggregate data is preserved (amounts, dates, categories)
4. Anonymization is audited (`CDR_DATA_ANONYMIZED` action)

---

## 6. Data Not Retained

The following CDR data is **never retained** beyond the API request/response cycle:

| Data | Treatment |
|------|-----------|
| Raw API responses from Basiq | Parsed and discarded; only structured fields stored |
| Account numbers (full) | Masked on storage; full number never persisted |
| Access tokens for bank connections | Managed by Basiq; not stored in Monitrax |

---

## 7. User Rights

Users can at any time:

| Action | Method | Endpoint |
|--------|--------|----------|
| View CDR data summary | Dashboard → Settings → Data | `GET /api/cdr/consent` |
| Revoke consent | Dashboard → Settings → Data | `POST /api/cdr/consent { action: 'revoke_org_consent' }` |
| Delete all CDR data | Dashboard → Settings → Data | `POST /api/cdr/consent { action: 'delete_cdr_data' }` |
| Export CDR data | Dashboard → Reports | Standard export functionality |

---

## 8. Compliance Verification

| Check | Frequency | Owner |
|-------|-----------|-------|
| Consent expiry automated check running | Daily (automated) | Cloud Scheduler |
| Audit log retention > 90 days | Quarterly (manual) | Director |
| No real CDR data in dev/staging | Before each deployment | Developer |
| Retention schedule review | Annual | Director |

---

## 9. Incident Handling

If CDR data is retained beyond the allowed period:

1. Immediately trigger `deleteCDRData()` for affected users
2. Log the incident in the Incident Response system
3. Notify the OAIC if the breach is material (per Notifiable Data Breaches scheme)
4. Document root cause and remediation in changelog

---

## 10. References

| Document | Path |
|----------|------|
| CDR Data Lifecycle Service | `lib/services/cdrDataLifecycle.ts` |
| CDR Compliance Matrix | `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` |
| Phase 35 Blueprint | `docs/blueprint/PHASE_35_CDR_DATA_LIFECYCLE.md` |
| Incident Response Plan | `docs/policy/INCIDENT_RESPONSE_PLAN.md` |
| CLAUDE.md §13 | CDR Compliance rules |

---

*Last Updated: 2026-03-08*
*Next Review: 2027-03-08*
