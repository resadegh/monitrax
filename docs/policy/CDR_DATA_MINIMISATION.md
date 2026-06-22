# CDR Data Minimisation Policy

**Version:** 1.0
**Created:** 2026-04-12
**Owner:** Director (Resadegh)
**Status:** ACTIVE
**Compliance Reference:** CDR Rules 1.8 (Data Minimisation), Privacy Act 1988 APP 3

---

## 1. Purpose

This policy documents how Monitrax enforces the CDR data minimisation principle — collecting and retaining only the CDR data strictly necessary to deliver the services the consumer has consented to.

CDR Rules 1.8 require data recipients to:
- Only request CDR data scopes strictly needed to deliver the service
- Not retain CDR data longer than necessary
- Apply technical controls to prevent scope creep

---

## 2. Data Scopes Collected

Monitrax collects ONLY the following CDR data scopes via Basiq:

| Scope | Purpose | Required? |
|-------|---------|-----------|
| `bank:accounts.basic:read` | Account list (name, type, masked BSB) | Yes — to display user's accounts |
| `bank:accounts.detail:read` | Account balances | Yes — for net worth + cashflow calculations |
| `bank:transactions:read` | Transaction history | Yes — for cashflow analysis and categorization |

**NOT collected:**
- `bank:accounts.customer.basic:read` (customer details) — not needed
- `bank:accounts.customer.detail:read` (full customer profile) — not needed
- `bank:regular_payments:read` (direct debits list) — derived from transactions instead
- `bank:payees:read` (payee list) — not needed

---

## 3. Technical Enforcement

### 3.1 Scope Enforcement at Consent Grant

When users connect a bank account via Basiq:
1. Basiq consent UI is configured to request ONLY the 3 scopes listed above
2. The scopes are set in `createConsentLink()` in `lib/basiq.ts`
3. Users see the exact scopes being requested before granting consent

### 3.2 API-Level Filtering

| Data Type | Filter Applied | Location |
|-----------|---------------|----------|
| Transactions | Date range (default: last 90 days) | `lib/basiq.ts` `getTransactions()` — G34 fix |
| Accounts | Only accounts explicitly linked to consent | Basiq API returns only authorized accounts |
| Customer data | Not requested | N/A |

### 3.3 Storage-Level Filtering

Only the following fields are stored per CDR data type:

**BasiqConnection**:
- Institution metadata (name, logo, ID)
- Connection status
- Consent expiry + scope (G19)
- NO raw customer data

**Account (CDR-linked)**:
- Account name, type, balance, currency
- Masked BSB and last 4 digits of account number
- NO full account number, NO customer address, NO tax file number

**UnifiedTransaction (source=BANK)**:
- Date, amount, merchant, description
- Category (derived)
- NO raw Basiq payload, NO full account context

### 3.4 Retention Enforcement

Per `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md`:
- CDR data is retained **only while consent is active**
- Consent expiry → automatic deletion within 24 hours
- Consent revocation → immediate deletion
- Technical enforcement via `lib/services/cdrDataLifecycle.ts` (`deleteCDRData`, `checkConsentExpiry`)

---

## 4. Review & Audit

### Quarterly Review
- Director reviews the scopes requested vs scopes actually used
- Any unused scopes are removed from the consent request
- Review logged in quarterly compliance report

### Annual Review
- Full data minimisation audit
- Review of retention periods and deletion logs
- Verification via `/admin/cdr/compliance` dashboard

### Automated Monitoring
- `checkConsentExpiry()` runs daily via Cloud Scheduler
- `enforceAuditLogRetention()` runs daily — deletes logs older than retention
- Admin portal CDR compliance dashboard shows CDR data summary (counts only)

---

## 5. Consumer Rights

Consumers have the right to:
- See exactly what CDR data is stored (`/dashboard/settings/privacy`)
- Revoke consent at any time (triggers deletion within 24 hours)
- Delete all CDR data on demand (right to erasure)
- Request complaints handling (`docs/policy/CDR_COMPLAINTS_POLICY.md`)

---

## 6. Policy Enforcement Code

| Gap | Implementation |
|-----|----------------|
| G34 | `lib/basiq.ts` `getTransactions()` uses fromDate/toDate filter |
| G46 | This document + admin portal CDR dashboard |
| G22 | `deleteCDRData()` uses `prisma.$transaction()` for atomic deletion |
| G25 | `checkConsentExpiry()` covers both org clients and direct users |

---

## 7. Review Schedule

This policy is reviewed:
- **Annually** (minimum)
- **After any CDR Rules update by the ACCC**
- **After any data minimisation audit finding**

---

*Last Updated: 2026-04-12*
*Next Review: 2027-04-12*


---

## De-identified categorisation knowledge base (Phase 52)

Monitrax improves automatic transaction categorisation using a **shared, de-identified
knowledge base of transaction patterns** (normalised merchant signature → category). This is a
secondary use of transaction information and is governed by the following minimisation controls:

- **De-identification before any cross-user use.** Only a normalised merchant/pattern signature,
  the category label, and aggregate counts are stored in the shared knowledge base. No CDR data,
  no account identifiers, no balances, no per-user transaction amounts or dates, and no information
  identifying the consumer are stored in it. CDR-derived patterns are de-identified per the CDR Rules
  before contributing.
- **PII scrubbing.** Personal details that can appear in transaction text (e.g. names or account
  numbers in person-to-person transfers) are removed, and person-to-person transfers are excluded,
  before a pattern is contributed.
- **k-anonymity graduation.** A pattern is only added to the **shared** knowledge base once at least
  *k* **distinct users** (k ≥ 5 at launch) have independently categorised it the same way. Patterns
  unique to a single user remain **private to that user's account** and are never shared.
- **No sale, no general-model training.** The knowledge base is used only to provide/improve the
  categorisation feature. It is not sold and is not used to train general AI models.
- **Consumer precedence.** A user's own categorisations always take precedence for their account; the
  shared knowledge base only supplies a default suggestion and never overrides a user's choice.

Canonical design: `docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md`.
