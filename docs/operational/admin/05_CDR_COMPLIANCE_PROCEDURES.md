# CDR Compliance Admin Procedures

**Version:** 1.0
**Created:** 2026-04-12
**Audience:** Admin Portal support team
**Purpose:** CDR-specific admin workflows — consent management, data deletion, complaints, OAIC escalation

---

## 1. CDR Compliance Overview

Monitrax operates as a **CDR Representative** accredited through Basiq. This means we collect, store, and process Consumer Data Right (CDR) data under strict regulatory requirements.

### Key Legal Framework

- **Competition and Consumer Act 2010** (Cth) — CDR Rules Part IVD
- **Consumer Data Right Rules** (ACCC)
- **Privacy Act 1988** (Cth) — APP 1-13
- **Basiq CDR Compliance Matrix** (internal accreditation framework)

### Our Obligations

1. **Collect only with active consent** (CDR Rules 1.8, 1.14)
2. **Delete within 24 hours of consent revocation** (Basiq §5.6)
3. **Retain only while consent is active** (CDR Rules 1.9)
4. **Respond to consumer complaints** (CDR Rules 1.15)
5. **Report breaches to OAIC** (Privacy Act APP 12)
6. **Maintain audit trail** of all CDR data access (CDR Rules 1.10)

---

## 2. Consumer Consent Lifecycle

### Stage 1: Consent Granted

**Trigger**: User connects a bank account via Basiq widget

**System actions**:
1. Basiq creates consent record with `ACTIVE` status
2. `BasiqConnection` record created in Monitrax DB
3. `consentExpiresAt` set based on Basiq consent duration (typically 1 year)
4. Audit log entry: `action=CDR_CONSENT_GRANTED`

**Admin action**: None — fully automated

### Stage 2: Active Consent

**While consent is active**:
- Monitrax syncs CDR data from Basiq
- User can view their data in the main app
- User can revoke at any time via `/dashboard/settings/privacy`

**Admin monitoring**:
- **Admin Portal → CDR Compliance**: see totals (active, expiring, revoked, expired)
- Watch for unusually high revocation rate (signals potential issue)

### Stage 3: Consent Expiring (30 days warning)

**Admin Portal → CDR Compliance** shows "Expiring Soon" count.

**Recommended action** (future feature):
- Send expiry reminder email to user
- User can renew via re-authenticating with bank

**Current manual procedure**:
1. Query expiring consents via CDR Compliance dashboard
2. If critical users, notify them manually

### Stage 4: Consent Expired / Revoked

**Automated handling** (via `monitrax-cdr-lifecycle` Cloud Scheduler job):
1. Job runs daily at 02:00 Australia/Sydney (AEST/AEDT)
2. Finds all expired consents
3. Triggers `checkConsentExpiry()` → `deleteCDRData()`
4. Deletes: BasiqConnection, Account records (with basiqAccountId), UnifiedTransaction (source=BANK), RecurringPayment (Basiq-sourced)
5. Audit log entry: `action=CDR_DATA_DELETED`, reason: `consent_expired`

**Admin verification**:
1. **Admin Portal → CDR Compliance** — check "Recently Deleted" count
2. **Audit Logs** — filter by action=CDR_DATA_DELETED
3. Should see entries within 24 hours of expiry

### Stage 5: Bank-Side Revocation (via Basiq webhook)

**Trigger**: User revokes consent at their bank's portal (not via Monitrax)

**Automated handling**:
1. Basiq sends `connection.updated` event to `/api/basiq/webhook`
2. Monitrax verifies HMAC signature
3. Updates BasiqConnection status to DISABLED
4. Triggers `deleteCDRData()` immediately
5. Audit log: `action=CDR_CONSENT_REVOKED`, source: `basiq_webhook`

**Admin verification**:
1. **Audit Logs** → filter `entityType=BasiqConnection, action=CDR_CONSENT_REVOKED`
2. Verify deletion completed within 24 hours

---

## 3. Handling CDR Data Requests

### 3.1 Consumer Requests to View Their Data

**CDR Rules 1.14**: Consumers have the right to view all CDR data held about them.

**Resolution**:
- Direct user to `/dashboard/settings/privacy`
- This page shows:
  - Active consents (with scope, granted date, expiry)
  - Bank connections count
  - Bank accounts count
  - Transactions count
- The user can revoke, download (future), or delete their data themselves

**Admin action**:
- **NO action required** if user has portal access
- If user can't access portal (e.g., account locked): help them via support

### 3.2 Consumer Request to Delete Data (Right to Erasure)

**CDR Rules 1.15 + Privacy Act APP 12**: User can request deletion at any time.

**Preferred path** (user-initiated):
1. Direct user to `/dashboard/settings/privacy`
2. Click **Delete All CDR Data** in Danger Zone
3. Confirm
4. Deletion runs immediately
5. Confirm with user via email

**Admin path** (if user can't access portal):
1. Verify user identity (email, phone, security questions)
2. **Admin Portal → CDR Compliance** → consent management (via admin API)
3. Or directly call:
   ```
   POST /api/admin/cdr/consent
   Authorization: Bearer <admin-firebase-token>
   Body: { action: 'delete_user_cdr_data', userId: '<user-id>' }
   ```
4. Verify deletion in audit logs
5. Email confirmation to user (document in support ticket)

**SLA**: Within 24 hours of request per Basiq §5.6

### 3.3 Consumer Request to Revoke Consent

Similar to deletion, but only revokes without immediately deleting (grace period for re-grant):

**Preferred path**:
- Direct user to `/dashboard/settings/privacy` → **Revoke All**

**Admin path** (if needed):
```
POST /api/admin/cdr/consent
Body: { action: 'revoke_user_consent', userId: '<user-id>' }
```

Note: `revoke_user_consent` also triggers data deletion per CDR Rules.

---

## 4. CDR Complaints Handling

Per `docs/policy/CDR_COMPLAINTS_POLICY.md`.

### 4.1 Receiving a Complaint

**Channels**:
- `complaints@monitrax.com.au`
- `/dashboard/settings/privacy` (future in-app form)
- Phone call to Director

**Within 2 business days**:
1. Log complaint in `CDRComplaint` model via admin API:
   ```
   POST /api/admin/cdr/complaints
   Body: {
     userId: '<id>',
     complainantName: '...',
     complainantEmail: '...',
     category: 'DATA_ACCESS' | 'DATA_DELETION' | 'CONSENT_MANAGEMENT' | 'DATA_ACCURACY' | 'PRIVACY' | 'SERVICE' | 'OTHER',
     description: '...'
   }
   ```
2. Send acknowledgement email to complainant with reference number (complaint ID)
3. Category reference:
   - `DATA_ACCESS` — Issues accessing their own data
   - `DATA_DELETION` — Data not deleted as requested
   - `CONSENT_MANAGEMENT` — Issues with consent handling
   - `DATA_ACCURACY` — Data is incorrect
   - `PRIVACY` — General privacy concerns
   - `SERVICE` — Service-related CDR issue
   - `OTHER` — Other

### 4.2 Investigation (Within 5 Business Days)

1. Review complaint details
2. Query relevant audit logs:
   - **Admin Portal → Audit Logs** → filter by userId + CDR-related actions
3. Check CDR data lifecycle records:
   - Consent grant/revoke timestamps
   - Data deletion events
4. Interview affected parties if needed
5. Document findings

### 4.3 Resolution (Within 30 Days)

Most complaints must be resolved within 30 calendar days per CDR Rules.

**Resolution steps**:
1. Determine outcome (upheld / not upheld / partial)
2. Take any required action (delete data, correct records, refund, etc.)
3. Update complaint via admin API:
   ```
   PATCH /api/admin/cdr/complaints/<id>
   Body: { action: 'resolve', resolution: 'Description of resolution' }
   ```
4. Send written resolution to complainant
5. Document in ticket system

### 4.4 Escalation to OAIC

If complaint cannot be resolved within 30 days OR complainant is unsatisfied:

1. **Notify complainant** of right to escalate:
   - OAIC website: https://www.oaic.gov.au/
   - Phone: 1300 363 992
   - Post: GPO Box 5218, Sydney NSW 2001
2. **Mark complaint as escalated** in admin portal:
   ```
   PATCH /api/admin/cdr/complaints/<id>
   Body: { action: 'escalate', oaicReferenceId: '<OAIC reference>' }
   ```
3. **Provide OAIC with all relevant records**:
   - Complaint details
   - Audit log entries
   - Communications with complainant
   - Actions taken
4. **Notify Director** immediately
5. **Cooperate fully** with OAIC investigation

---

## 5. CDR Data Breach Response

Per `docs/policy/INCIDENT_RESPONSE_PLAN.md`.

### What Constitutes a Breach

- Unauthorized access to CDR data
- Accidental disclosure of CDR data
- CDR data leaked outside Monitrax's secure systems
- Compromised service account keys
- Data sent to unintended recipients

### Immediate Actions (Within 1 Hour)

1. **Stop the bleeding**:
   - Disable affected accounts
   - Revoke compromised credentials
   - Isolate affected systems
2. **Preserve evidence**:
   - Capture Cloud Logging entries
   - Take database backups
   - Screenshot any relevant UI
3. **Notify Director** immediately
4. **Start incident log** with timestamps

### Within 24 Hours

1. Assess scope:
   - How many users affected?
   - What CDR data was exposed?
   - How long was the vulnerability open?
2. Consult with Director on notification requirements
3. Prepare notification to affected users

### Within 72 Hours (OAIC Notification)

Per Notifiable Data Breach (NDB) scheme:

If the breach is likely to cause serious harm:
1. **Notify OAIC** via the NDB form
2. **Notify affected users** in writing
3. Include:
   - Description of breach
   - Types of data involved
   - Actions taken to contain
   - Recommendations for affected users

---

## 6. Monitoring & Reporting

### Daily Monitoring

- Check **Admin Portal → CDR Compliance** for anomalies
- Review overnight Cloud Scheduler job results
- Investigate any `CDR_CONSENT_REVOKED` events

### Weekly Reporting

- Active consents trend
- Consent revocation rate
- Complaint count and status
- Deletion event count (should match revocation events)

### Monthly Reporting (to Director)

- Full CDR compliance dashboard review
- Open complaints status
- Any OAIC interactions
- Policy review (if updates needed)

### Quarterly Audit

- Full audit of consent lifecycle (granted → expired → deleted)
- Verification that deletions match revocations
- Review of Cloud Logging retention (must be >= 365 days)
- Review of `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` compliance
- Update this document if procedures change

### Annual Compliance Review

- Full Basiq CDR Compliance Matrix review
- Update accreditation if needed
- Review all CDR policies (`docs/policy/CDR_*`)
- Review admin training effectiveness

---

## 7. Key Admin APIs for CDR Operations

### Consent Management
- `GET /api/admin/cdr/consent` — List all consents (paginated)
- `POST /api/admin/cdr/consent` — Admin consent actions:
  - `revoke_user_consent` (triggers data deletion)
  - `revoke_org_consent` (specific org consent)
  - `delete_user_cdr_data` (right to erasure)

### Complaint Management
- `GET /api/admin/cdr/complaints` — List complaints
- `POST /api/admin/cdr/complaints` — Create complaint
- `GET /api/admin/cdr/complaints/[id]` — Complaint detail
- `PATCH /api/admin/cdr/complaints/[id]` — Actions:
  - `resolve` — Mark as resolved
  - `escalate` — Escalate to OAIC
  - `update_status` — Change status

### Compliance Dashboard
- `GET /api/admin/cdr/compliance` — Full compliance metrics
- `GET /api/admin/audit/cloud-logging` — Query Cloud Logging for CDR events

---

## 8. Regulatory Contacts

| Contact | Purpose | Details |
|---------|---------|---------|
| **OAIC** | Complaints escalation, NDB reporting | https://www.oaic.gov.au/, 1300 363 992 |
| **ACCC** | CDR Rules interpretation | https://www.accc.gov.au/consumers/consumer-data-right |
| **Basiq** | Accreditation issues | support@basiq.io, compliance@basiq.io |
| **Data Recipient Accreditor** | Accreditation | https://www.cdr.gov.au/ |

---

## 9. Related Documents

- **docs/policy/CDR_DATA_RETENTION_SCHEDULE.md** — What to retain, how long, why
- **docs/policy/CDR_COMPLAINTS_POLICY.md** — Full complaints procedure
- **docs/policy/CDR_DATA_MINIMISATION.md** — Scope + technical enforcement
- **docs/policy/INCIDENT_RESPONSE_PLAN.md** — Breach response
- **docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md** — Basiq accreditation requirements
- **01_ADMIN_PORTAL_OPERATIONS.md** — General admin operations

---

## 10. Quick Reference Card

| Situation | Action | SLA |
|-----------|--------|-----|
| User requests their data | Direct to `/dashboard/settings/privacy` | Immediate |
| User requests deletion | Direct to Danger Zone OR admin API | 24 hours |
| Consent expires | Automated via Cloud Scheduler | Daily check |
| Bank-side revocation | Automated via Basiq webhook | < 1 hour |
| Complaint received | Log in `CDRComplaint` + acknowledge | 2 business days |
| Complaint resolution | Investigate + respond in writing | 30 days |
| Complaint unresolved | Escalate to OAIC | 30 days + |
| Data breach detected | Contain + notify Director | 1 hour |
| NDB notification | OAIC + affected users | 72 hours |

---

*Last Updated: 2026-04-12*
*Review Schedule: Quarterly + after any OAIC escalation or breach*
