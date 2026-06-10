# CDR Compliance - Operational Guide

## What Is CDR?

The **Consumer Data Right (CDR)** is an Australian government regulation that gives consumers control over their financial data. Under CDR, consumers can consent to share their banking data with accredited data recipients (like Monitrax) through secure APIs.

Monitrax accesses CDR data via **Basiq**, an accredited intermediary that connects to Australian financial institutions on our behalf.

**Non-compliance consequences:** Fines, loss of accreditation, mandatory breach notification, reputational damage.

---

## What Data Is CDR-Protected?

Any data received from a consumer's financial institution via the CDR regime:

| CDR-Protected | Examples |
|---------------|----------|
| Account details | Account numbers, BSBs, account names, account types |
| Balances | Current balance, available balance |
| Transactions | Transaction history, descriptions, amounts, dates |
| Loan details | Loan balances, interest rates, repayment schedules |
| Income records | Salary deposits, recurring income |
| **Derived data** | Any aggregation, score, or insight calculated FROM CDR data (net worth, health scores, cashflow forecasts) |

| NOT CDR-Protected | Examples |
|-------------------|----------|
| User profile | Name, email, preferences (entered by user, not from bank) |
| UI settings | Theme, layout, notification preferences |
| Manually entered data | Properties, expenses, income added by user directly |

**Rule of thumb:** If the data came from a bank via Basiq, it is CDR data. If it was derived from bank data, it is CDR data.

---

## Consent Lifecycle

CDR data access is governed by consumer consent. No active consent means no data access.

### Consent States

```
PENDING → ACTIVE → EXPIRED or REVOKED
                         ↓
                   CDR DATA DELETED
```

| State | Meaning | Data Access |
|-------|---------|-------------|
| **PENDING** | Consent requested but not yet granted by consumer | No access |
| **ACTIVE** | Consumer has granted consent; consent has not expired | Full access per consent scope |
| **EXPIRED** | `consentExpiresAt` timestamp has passed | No access; data must be deleted |
| **REVOKED** | Consumer has explicitly withdrawn consent | No access; data must be deleted within 24 hours |

### Pre-Consent Requirement: Verified Email (2026-06-10)

A user cannot initiate a bank connection (or reach any CDR data surface)
until their email address is verified. Consent notices, expiry reminders,
and breach notifications must reach an inbox the account holder actually
owns — an unverified address is a compliance gap, not just a UX gap.

- Enforced in `lib/auth/guards.ts` → `requireVerifiedEmail`, applied inside
  `withMFARequired` and `withActiveConsent` (the elevated CDR guards).
- Source of truth is the **live Firebase `email_verified` token claim** —
  verification itself is handled by GCP Identity Platform (see
  `01_AUTHENTICATION.md` § Email Verification).
- Unverified callers receive **403 `EMAIL_VERIFICATION_REQUIRED`**.
- OAuth (Google) sign-ins arrive pre-verified and are unaffected.

### Consent Grant Flow

1. User initiates a bank connection in Monitrax
2. Monitrax redirects to Basiq consent flow
3. Consumer authenticates with their bank and grants consent
4. Basiq returns consent confirmation with scope and expiry
5. Monitrax stores consent record with status `ACTIVE` and `consentExpiresAt`
6. CDR data is now accessible for the consented scope

### Consent Expiry

- Every consent has a defined expiry date (`consentExpiresAt`)
- A **GCP Cloud Scheduler** job runs daily to check for expired consents
- When a consent expires:
  1. Consent status is set to `EXPIRED`
  2. All associated CDR data is **hard-deleted** (not soft-deleted)
  3. Deletion is logged via `createAuditLog()` with action `CDR_DATA_DELETED`
  4. User is notified that their bank connection has expired

### Consent Revocation

When a consumer revokes consent (via Monitrax UI or directly with their bank):

1. Consent status is immediately set to `REVOKED`
2. All associated CDR data must be **hard-deleted within 24 hours**
3. Deletion is irreversible -- no soft-delete, no recycle bin
4. Audit log records the revocation and subsequent data deletion
5. User is notified that their data has been removed

**There is no "undo" for revocation. Once CDR data is deleted, it is gone.**

---

## Audit Logging Requirements

All CDR data access and lifecycle events must be audited:

| Event | Audit Action | What to Log |
|-------|-------------|-------------|
| CDR data accessed | `CDR_DATA_ACCESSED` | Who accessed, what scope, timestamp |
| CDR data created (synced from bank) | `CDR_DATA_CREATED` | Consent ID, data type, record count |
| CDR data deleted | `CDR_DATA_DELETED` | Consent ID, reason (expired/revoked), record count |
| Consent granted | `CONSENT_GRANTED` | Consent ID, scope, expiry date |
| Consent revoked | `CONSENT_REVOKED` | Consent ID, revocation source (user/bank) |
| Consent expired | `CONSENT_EXPIRED` | Consent ID, original expiry date |

**Audit logs are stored in the `AuditLog` table and must be retained for a minimum of 7 years** (regulatory requirement).

**Audit logging uses the fire-and-forget pattern:** `.catch(() => {})` -- audit failures must never block the user's request.

---

## Data Sanitization Rules

CDR data must never appear in places where unauthorized parties could access it.

| Rule | Detail |
|------|--------|
| **No CDR data in logs** | Use `sanitizeCdrMetadata()` from `lib/security/cdrAuditCompliance.ts` for all audit log metadata. Never log account numbers, balances, BSBs, or transaction details. |
| **No CDR data in error messages** | API error responses must return generic messages. Never include financial data in error details. |
| **No CDR data in URLs** | No account numbers, balances, or BSBs in query parameters or path segments. |
| **No CDR data in browser storage** | CDR data must not be stored in localStorage, sessionStorage, or cookies. React component state only. |
| **No CDR data sent to third parties** | Unless explicitly covered by the consumer's consent and documented. |
| **De-identify for analytics** | Any CDR data used for internal analytics must be de-identified first. |

### Sanitization Function

```typescript
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';

// CORRECT: sanitize before logging
await createAuditLog({
  action: 'CDR_DATA_ACCESSED',
  metadata: sanitizeCdrMetadata({ accountId: 'xxx', userId: user.id })
});

// WRONG: raw CDR data in metadata
await createAuditLog({
  action: 'CDR_DATA_ACCESSED',
  metadata: { accountNumber: '123456789', balance: 50000 }  // NEVER DO THIS
});
```

---

## CDR Data Retention Policy

| Data Type | Retention Period | Trigger for Deletion |
|-----------|-----------------|---------------------|
| CDR account data | While consent is ACTIVE | Consent expiry or revocation |
| CDR transaction data | While consent is ACTIVE | Consent expiry or revocation |
| CDR-derived insights | While consent is ACTIVE | Consent expiry or revocation |
| Consent records | 7 years after consent end | Regulatory retention requirement |
| CDR audit logs | 7 years minimum | Regulatory retention requirement |

**Key principle:** CDR data is retained only as long as consent permits. Consent metadata and audit logs are retained longer for regulatory compliance.

---

## Automated Consent Expiry Check

### How It Works

1. **GCP Cloud Scheduler** triggers a job daily (e.g., 02:00 AEST)
2. The job calls an internal endpoint or Cloud Function
3. The function queries for consents where `consentExpiresAt < NOW()` and status is still `ACTIVE`
4. For each expired consent:
   - Status is updated to `EXPIRED`
   - All associated CDR data is hard-deleted
   - Audit log entry is created (`CONSENT_EXPIRED`, `CDR_DATA_DELETED`)
   - User notification is queued
5. A summary log is written with the count of expired consents processed

### Monitoring the Job

- Check **GCP Cloud Scheduler** console for job execution history
- Check **Cloud Logging** for the job's execution logs
- Alert if the job fails to run for more than 24 hours (configure in Cloud Monitoring)

---

## Environment Separation

| Rule | Detail |
|------|--------|
| **Production only** | Real CDR data exists ONLY in the production environment |
| **Dev/UAT** | Must use synthetic/mock data. Never seed with real CDR data. Never copy production CDR data to dev. |
| **Database access** | Production database is accessible only via GCP Console with IAM authentication. No direct SSH tunnels from developer machines. |
| **Secrets** | Production secrets are managed via GCP Secret Manager. Dev environments use separate, non-production credentials. |

### What to Do If Real CDR Data Enters Dev

1. **Stop immediately** -- do not use the data for testing
2. **Delete the data** from the dev environment
3. **Log the incident** -- this is a data handling incident
4. **Notify the security lead** for assessment
5. **Document in the incident log** with root cause and prevention measures

---

## CDR Compliance Checklist (For Every CDR-Related Change)

- [ ] Route uses `withPermission()` with a `cdr_data.*` permission
- [ ] Route uses `withActiveConsent()` to verify consent is active
- [ ] CDR data is sanitized from all log and audit metadata
- [ ] CDR data is excluded from error responses
- [ ] CDR data is not stored in browser localStorage/sessionStorage
- [ ] Consent expiry/revocation triggers hard deletion
- [ ] Deletion is audited with `CDR_DATA_DELETED` action
- [ ] No CDR data appears in URLs or query parameters
- [ ] CDR compliance matrix is up to date (`docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md`)

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/security/cdrAuditCompliance.ts` | CDR metadata sanitization (`sanitizeCdrMetadata()`) |
| `lib/auth/guards.ts` | `withActiveConsent()` guard |
| `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` | Full CDR requirement tracking |
| `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` | Detailed retention schedule |

---

*Last Updated: 2026-04-09*
