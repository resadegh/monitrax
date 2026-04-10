# 06 - CDR Compliance Operations Framework

**Date:** 2026-04-10 | **Version:** 1.0 | **Status:** DRAFT

---

## 1. Overview

This document defines the operational requirements for maintaining Consumer Data Right (CDR) compliance in Monitrax. CDR is mandated under Australian law for handling financial data received from consumers' financial institutions via the Open Banking regime (Basiq integration).

**Regulatory Framework:**
- Competition and Consumer Act 2010 (CDR provisions)
- Consumer Data Right Rules
- ACCC CDR Guidelines
- Basiq Accreditation Requirements (Sections 1-10)
- Privacy Act 1988 (Australian Privacy Principles)

---

## 2. CDR Data Classification (Operational Reference)

### 2.1 What is CDR Data?

| Classification | Examples | Handling |
|---------------|----------|----------|
| **CDR-Protected** | Account balances, transactions, BSBs, loan balances, account numbers | Encrypted at rest (CMEK), sanitized from logs, consent-gated |
| **CDR-Derived** | Health scores computed from CDR inputs, net worth including CDR accounts, cashflow from CDR transactions | Same protection as CDR-Protected |
| **Non-CDR** | User profile, preferences, manually entered data, UI settings | Standard data handling |

### 2.2 Quick Decision Guide

```
Is the data from Basiq API?                    → CDR-Protected
Is the data computed FROM Basiq data?          → CDR-Derived (treat as CDR)
Did the user manually enter this data?         → Non-CDR
Is it user profile/preferences?                → Non-CDR
```

---

## 3. Daily CDR Operations

### 3.1 Daily Checklist (BAU Team)

| # | Check | How | Expected Result |
|---|-------|-----|-----------------|
| 1 | Consent expiry check ran | Cloud Scheduler logs | Job completed at 02:00 AEST |
| 2 | No expired consents with active data | Audit log query | All expired consents have DATA_DELETED events |
| 3 | Anomaly detection ran | Cloud Scheduler logs | No CRITICAL anomalies |
| 4 | Basiq sync status | Basiq dashboard / API | All active connections synced within 24h |
| 5 | Audit log health | Cloud Logging query | No gaps in audit trail |
| 6 | CDR error rate | API error monitoring | CDR endpoints < 1% error rate |

### 3.2 Daily Audit Log Query

```sql
-- Check for CDR data access in last 24 hours
SELECT action, COUNT(*) as count, 
       MIN("createdAt") as first, MAX("createdAt") as last
FROM "AuditLog"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
  AND action LIKE 'CDR_%'
GROUP BY action
ORDER BY count DESC;
```

### 3.3 Daily Consent Expiry Check

```sql
-- Find consents expiring in next 7 days
SELECT bc.id, bc."userId", bc."institutionId", bc.status, bc."consentExpiresAt"
FROM "BasiqConnection" bc
WHERE bc.status = 'ACTIVE'
  AND bc."consentExpiresAt" < NOW() + INTERVAL '7 days'
ORDER BY bc."consentExpiresAt" ASC;
```

---

## 4. Weekly CDR Operations

### 4.1 Weekly Checklist

| # | Check | Frequency | Owner |
|---|-------|-----------|-------|
| 1 | Review anomaly detection results | Weekly | BAU Lead |
| 2 | Review failed login attempts for CDR endpoints | Weekly | Security |
| 3 | Check Basiq connection health across all users | Weekly | BAU |
| 4 | Verify CDR data retention compliance | Weekly | Compliance |
| 5 | Review CDR-related support tickets | Weekly | BAU Lead |

### 4.2 Anomaly Detection Review

```sql
-- Check for suspicious CDR access patterns (last 7 days)
SELECT "userId", action, COUNT(*) as count,
       COUNT(DISTINCT DATE("createdAt")) as days_active
FROM "AuditLog"
WHERE "createdAt" > NOW() - INTERVAL '7 days'
  AND action IN ('CDR_DATA_READ', 'CDR_DATA_EXPORT', 'CDR_BULK_ACCESS')
GROUP BY "userId", action
HAVING COUNT(*) > 50
ORDER BY count DESC;
```

---

## 5. Monthly CDR Operations

### 5.1 Monthly Compliance Review

| Activity | Description | Deliverable |
|----------|-------------|-------------|
| **CDR Data Inventory** | Count CDR records by type and user | Inventory report |
| **Consent Status Report** | Active, expired, revoked consent counts | Status dashboard |
| **Audit Log Integrity** | Verify no gaps in audit trail | Integrity report |
| **Data Retention Compliance** | Verify no data held beyond retention period | Compliance certificate |
| **Access Control Review** | Review who has access to CDR data | Access matrix |
| **Basiq Integration Health** | API uptime, error rates, sync latency | Integration report |

### 5.2 Monthly CDR Data Inventory Query

```sql
-- CDR data inventory by category
SELECT 
  'Accounts' as category, COUNT(*) as count 
  FROM "Account" WHERE "basiqAccountId" IS NOT NULL
UNION ALL
SELECT 
  'Transactions' as category, COUNT(*) 
  FROM "UnifiedTransaction" WHERE source = 'BASIQ'
UNION ALL
SELECT 
  'Connections' as category, COUNT(*) 
  FROM "BasiqConnection" WHERE status = 'ACTIVE'
UNION ALL
SELECT 
  'Users with CDR' as category, COUNT(DISTINCT "userId") 
  FROM "BasiqConnection";
```

---

## 6. Quarterly CDR Operations

### 6.1 Quarterly Compliance Audit

| Activity | Description |
|----------|-------------|
| **Full CDR compliance review** | Against CDR_BASIQ_COMPLIANCE_MATRIX.md requirements |
| **Penetration test (CDR scope)** | Test CDR data endpoints for vulnerabilities |
| **DR drill with CDR data** | Test backup/restore procedures for CDR data |
| **Policy document review** | Update all CDR policy documents |
| **Dependency security audit** | Review approved dependencies for CVEs |
| **Basiq accreditation renewal check** | Verify all Basiq requirements still met |

### 6.2 Quarterly Compliance Checklist

- [ ] All CDR data encrypted at rest (Cloud KMS CMEK)
- [ ] All CDR endpoints use `withPermission()` with `cdr_data.*` permissions
- [ ] CDR data sanitized from all logs (verify `sanitizeCdrMetadata()` coverage)
- [ ] No CDR data in error responses
- [ ] No CDR data in localStorage/sessionStorage
- [ ] Consent expiry automation functioning
- [ ] Data deletion automation functioning
- [ ] Audit logs retained for minimum 7 years
- [ ] MFA enforced for CDR data access where org policy requires
- [ ] Environment separation maintained (no real CDR data in dev)
- [ ] Incident response plan current and tested
- [ ] Security awareness training completed

---

## 7. CDR Incident Response

### 7.1 CDR Data Breach Classification

| Level | Description | Example | Response Time |
|-------|-------------|---------|---------------|
| **P0 - Critical** | CDR data exposed to unauthorized party | Data leak, API authentication bypass | Immediate (< 15 min) |
| **P1 - High** | CDR data handling violation | Data not deleted after consent revocation | < 1 hour |
| **P2 - Medium** | CDR compliance gap | Audit log gap, MFA not enforced | < 4 hours |
| **P3 - Low** | CDR process deviation | Late consent check, manual override needed | < 24 hours |

### 7.2 CDR Breach Response Procedure

**Immediate Actions (First 30 Minutes):**
1. **CONTAIN:** Disable affected API endpoints or user access
2. **ASSESS:** Determine scope - what data, how many users, how long
3. **LOG:** Create incident record with timestamp, scope, initial assessment
4. **ESCALATE:** Notify director/incident commander immediately

**Investigation (Hours 1-4):**
5. **QUERY:** Run audit log analysis for affected users/endpoints
6. **SCOPE:** Identify all affected CDR data records
7. **IMPACT:** Determine if data was actually accessed by unauthorized party
8. **ROOT CAUSE:** Identify the vulnerability or process failure

**Notification Requirements (CDR-Specific):**
- **OAIC (Office of the Australian Information Commissioner):** Within 30 days (Notifiable Data Breaches scheme)
- **Affected consumers:** As soon as practicable after assessment
- **Basiq:** Immediately upon confirmation of CDR data breach
- **ACCC:** If CDR-specific breach affecting multiple consumers

**Post-Incident:**
9. **REMEDIATE:** Fix the vulnerability
10. **VERIFY:** Confirm fix prevents recurrence
11. **DOCUMENT:** Complete incident report
12. **REVIEW:** Post-incident review within 5 business days

### 7.3 CDR Breach Notification Template

```
NOTIFIABLE DATA BREACH STATEMENT

Date of notification: [DATE]
Entity: Monitrax Pty Ltd
Type: Consumer Data Right (CDR) data breach

Description of breach:
[What happened, when it was discovered]

Type of CDR data involved:
[Account balances / Transactions / Account numbers / etc.]

Number of affected consumers: [COUNT]

Period of exposure: [START] to [END]

Actions taken:
1. [Containment action]
2. [Investigation summary]
3. [Remediation completed]

Steps consumers should take:
[Specific advice for affected consumers]

Contact: [Privacy Officer contact details]
```

---

## 8. CDR Data Lifecycle Management

### 8.1 Consent States

```
PENDING → ACTIVE → EXPIRED/REVOKED → DATA_DELETED
                         ↓
                   (24h deletion window)
                         ↓
                    CDR data purged
                    Audit log retained (7 years)
```

### 8.2 Data Deletion Procedure

When consent is expired or revoked:

1. **Identify:** Query all CDR data linked to the consent
2. **Audit:** Log `CDR_DATA_DELETION_INITIATED` event
3. **Delete:** Hard-delete all CDR-protected data:
   - Basiq-sourced transactions (`UnifiedTransaction` where source = 'BASIQ')
   - Basiq-linked account data
   - CDR-derived calculations (cached snapshots, if any)
4. **Verify:** Confirm deletion with count query
5. **Audit:** Log `CDR_DATA_DELETED` event with record counts
6. **Retain:** Keep audit logs and consent record (anonymized)

### 8.3 Retention Schedule Summary

| Data Type | Retention Period | Legal Basis | After Expiry |
|-----------|-----------------|-------------|-------------|
| CDR transaction data | While consent active | CDR consent | Hard delete |
| CDR account data | While consent active | CDR consent | Hard delete |
| Audit logs | 7 years | Tax/legal compliance | Archive to cold storage |
| Consent records | 7 years (anonymized) | Legal compliance | Archive |
| CDR-derived scores | While consent active | CDR consent | Recalculate without CDR data |

---

## 9. CDR Compliance Monitoring Dashboard (Recommended)

### 9.1 Key Metrics to Display

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| Active CDR consents | `BasiqConnection` count | N/A (informational) |
| Consents expiring in 7 days | Query | > 0 triggers notification to users |
| CDR data access today | Audit log count | > 2x normal triggers review |
| Failed CDR auth attempts | Audit log filter | > 10/hour triggers alert |
| Stale Basiq connections | Last sync > 48h | Any stale connection |
| CDR data deletion backlog | Expired/revoked without deletion | Any backlog > 0 |
| Audit log coverage | Endpoints without logging | Any gap |

### 9.2 Alert Escalation

```
AUTOMATED ALERT
    ↓
BAU Team reviews (< 1 hour)
    ↓
Is it a CDR data breach?
    YES → P0 Incident Response (Section 7)
    NO  → Standard incident response
    ↓
Resolution + documentation
```

---

## 10. CDR Compliance Training Requirements

### 10.1 All BAU Team Members Must Understand

1. **What is CDR data** - Classification, examples, handling rules
2. **Consent lifecycle** - States, transitions, obligations at each state
3. **Data sanitization** - What gets redacted and why
4. **Breach response** - Immediate actions, notification timeline
5. **Audit requirements** - What must be logged, retention periods
6. **Environment rules** - No real CDR data in development

### 10.2 Training Schedule

| Training | Frequency | Audience | Duration |
|----------|-----------|----------|----------|
| CDR Awareness | Onboarding + annual | All team | 2 hours |
| CDR Data Handling | Quarterly | Developers, DBAs | 1 hour |
| CDR Incident Response | Bi-annual | All team | 1 hour |
| CDR Compliance Updates | As needed | Compliance lead | 30 min |

---

## 11. CDR Tooling Requirements

| Tool | Purpose | Status |
|------|---------|--------|
| **GCP Cloud Scheduler** | Automated consent expiry checks | Documented, needs verification |
| **GCP Cloud Monitoring** | CDR endpoint monitoring | Partially configured |
| **GCP Cloud Armor** | WAF for CDR endpoints | P0 - needs deployment |
| **GCP Security Command Center** | Vulnerability scanning | P0 - needs deployment |
| **GCP Cloud KMS** | CMEK for CDR data at rest | P1 - needs deployment |
| **GCP Cloud DLP** | PII detection/redaction | P2 - planned |
| **Basiq Dashboard** | Connection monitoring | Available via Basiq portal |
| **Cloud Logging** | Centralized audit logs (90+ day retention) | Configured |

---

*All CDR requirements verified against docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md, docs/operational/security/03_CDR_COMPLIANCE.md, and docs/policy/CDR_DATA_RETENTION_SCHEDULE.md. See TRACKING_REFERENCE.md for source verification.*
