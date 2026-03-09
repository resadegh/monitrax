# Incident Response Plan

**Version:** 1.0
**Created:** 2026-03-08
**Owner:** Resadegh (Director, Monitrax)
**Review Cycle:** Annual (next review: 2027-03-08)
**Basiq Requirement:** CDR Compliance — Breach Notification
**Legal Basis:** Privacy Act 1988 — Notifiable Data Breaches (NDB) scheme, CDR Privacy Safeguards

---

## 1. Purpose

This document defines how Monitrax identifies, contains, remediates, and reports security incidents, with particular focus on CDR data breaches. It ensures compliance with the Australian Notifiable Data Breaches (NDB) scheme and CDR privacy safeguards.

---

## 2. Scope

This plan covers:

- Unauthorized access to CDR-protected data
- Data breaches involving consumer financial information
- System compromise (application, database, infrastructure)
- Credential theft or exposure
- Device loss or theft with access to production systems
- Third-party vendor incidents affecting Monitrax data (e.g., Basiq, Render, GCP)

---

## 3. Incident Classification

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|---------|
| **CRITICAL** | CDR data breach — unauthorized access to consumer financial data | Immediate (< 1 hour) | Database breach, API credential exposure, Basiq token compromise |
| **HIGH** | System compromise without confirmed CDR data access | < 4 hours | Unauthorized admin access, suspicious login patterns, infrastructure breach |
| **MEDIUM** | Security vulnerability discovered (not yet exploited) | < 24 hours | Unpatched dependency with known CVE, misconfigured access control |
| **LOW** | Minor security event with no data impact | < 72 hours | Failed brute-force attempt (blocked), rate limit triggered |

---

## 4. Incident Response Team

### Current (Sole Director)

| Role | Person | Contact |
|------|--------|---------|
| Incident Commander | Resadegh (Director) | Primary contact |
| Technical Lead | Resadegh (Director) | Same |
| Communications Lead | Resadegh (Director) | Same |

### Future (When Team Grows)

| Role | Responsibility |
|------|----------------|
| Incident Commander | Overall coordination, OAIC notification decisions |
| Technical Lead | Investigation, containment, remediation |
| Communications Lead | User notification, regulatory communication |
| Legal Advisor | Regulatory obligations, NDB assessment |

---

## 5. Incident Response Phases

### Phase 1: Identification

**Detect and confirm the incident:**

1. Review alert (automated monitoring, user report, or manual discovery)
2. Assess initial scope — what systems and data are affected
3. Classify severity (see §3)
4. Document the initial findings in an incident log

**Detection sources:**
- Admin audit logs (`/admin/audit-logs`)
- Anomaly detection alerts (`runAnomalyDetection()` in `lib/security/cdrAuditCompliance.ts`)
- GCP Security Command Center alerts (when enabled)
- User reports
- Third-party vendor notifications (Basiq, Render, GCP)

### Phase 2: Containment

**Stop the incident from spreading:**

| Action | Command/Process |
|--------|----------------|
| Revoke compromised sessions | Admin portal → Sessions → Revoke all |
| Disable compromised user accounts | `PATCH /api/admin/admins/[id] { isActive: false }` |
| Rotate API keys/secrets | Render Dashboard → Environment Variables |
| Block suspicious IPs | Rate limiting / Cloud Armor (when enabled) |
| Disconnect Basiq if CDR data at risk | `POST /api/cdr/consent { action: 'revoke_all' }` |
| Take affected systems offline | Render Dashboard → Suspend service |

### Phase 3: Investigation

**Determine root cause and full impact:**

1. Review audit logs for the affected time period
2. Identify all affected users and data
3. Determine how the breach occurred (attack vector)
4. Assess whether CDR data was accessed or exfiltrated
5. Document findings in the incident report

**Key investigation queries:**
- Audit logs: `GET /api/admin/audit/export` (filter by date range)
- Admin audit logs: `AdminAuditLog` table
- GCP Cloud Logging (when enabled)

### Phase 4: Remediation

**Fix the root cause and prevent recurrence:**

1. Patch the vulnerability that caused the incident
2. Rotate all potentially compromised credentials
3. Restore affected systems from known-good backups if needed
4. Deploy fix via standard PR process (emergency hotfix branch if needed)
5. Verify fix addresses root cause

### Phase 5: Notification

**Notify affected parties per legal requirements:**

#### CDR Data Breach Notification

| Recipient | Timeline | Method |
|-----------|----------|--------|
| **OAIC** (Office of the Australian Information Commissioner) | Within 30 days of becoming aware (or as soon as practicable) | NDB statement via OAIC portal |
| **Affected consumers** | As soon as practicable after assessment | Email notification |
| **Basiq** (CDR principal) | Immediately if CDR data involved | Direct contact per Basiq accreditation terms |
| **ACCC** (if CDR-specific) | As directed by OAIC | Formal notification |

#### NDB Statement Must Include

- Identity and contact details of Monitrax
- Description of the breach
- Types of information involved
- Recommendations for affected individuals

### Phase 6: Recovery & Post-Incident Review

1. Confirm all systems are operating normally
2. Verify no residual unauthorized access
3. Conduct post-incident review within 7 days
4. Document lessons learned
5. Update security controls to prevent recurrence
6. Update this Incident Response Plan if gaps identified

---

## 6. Incident Log Template

```markdown
## Incident #[number] — [date]

### Summary
- **Classification:** CRITICAL / HIGH / MEDIUM / LOW
- **Detected by:** [source]
- **Date/time detected:** [timestamp]
- **Date/time contained:** [timestamp]
- **Date/time resolved:** [timestamp]

### Affected Systems
- [system 1]
- [system 2]

### Affected Data
- CDR data: YES / NO
- Number of affected users: [count]
- Data types: [accounts, transactions, etc.]

### Root Cause
[description]

### Actions Taken
1. [containment action]
2. [remediation action]
3. [notification action]

### Notifications
- OAIC notified: YES / NO / NOT REQUIRED
- Users notified: YES / NO / NOT REQUIRED
- Basiq notified: YES / NO / NOT REQUIRED

### Lessons Learned
[description]

### Follow-Up Actions
- [ ] [action 1]
- [ ] [action 2]
```

---

## 7. Escalation Contacts

| Entity | Contact | When to Contact |
|--------|---------|----------------|
| OAIC | oaic.gov.au/privacy/notifiable-data-breaches | CDR data breach confirmed |
| Basiq Support | support@basiq.io | CDR data or Basiq API breach |
| Render Support | support@render.com | Infrastructure compromise |
| GCP Support | GCP Console → Support | GCP service compromise |

---

## 8. Testing & Drills

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Review incident response plan | Annual | Director |
| Tabletop exercise (simulated breach) | Annual | Director |
| Verify notification contact details | Quarterly | Director |
| Review audit log coverage | Quarterly | Director |

---

## 9. References

| Document | Path |
|----------|------|
| CDR Compliance Matrix | `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` |
| CDR Data Retention Schedule | `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` |
| CDR Data Lifecycle Service | `lib/services/cdrDataLifecycle.ts` |
| Audit Logging | `lib/security/auditLog.ts` |
| Device Security Policy | `docs/policy/DEVICE_SECURITY_POLICY.md` |
| OAIC NDB guidance | https://www.oaic.gov.au/privacy/notifiable-data-breaches |

---

*Last Updated: 2026-03-08*
*Next Review: 2027-03-08*
