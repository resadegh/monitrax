# Admin Portal BAU Playbook

**Version:** 1.0
**Created:** 2026-04-12
**Audience:** Admin Portal support team (daily operators)
**Purpose:** Daily, weekly, and monthly BAU tasks for keeping the admin portal operational

---

## 1. Overview

This playbook defines the **Business-As-Usual (BAU)** cadence for admin portal operations. It's the checklist the admin team follows to ensure the platform runs smoothly, compliance is maintained, and issues are caught early.

### BAU Framework

| Cadence | Focus | Owner |
|---------|-------|-------|
| **Daily** | Platform health, critical alerts | Support admin on duty |
| **Weekly** | Metrics review, compliance checks, user issues | Support admin |
| **Monthly** | Trend analysis, policy review, audit | Director + Support admin |
| **Quarterly** | Strategic review, compliance audit | Director |
| **Annually** | Full compliance audit, accreditation review | Director |

---

## 2. Daily BAU Tasks

**Duration**: ~15-20 minutes
**Owner**: Support admin on duty
**Best time**: Start of business day (9:00 AM AEST)

### Morning Checklist

#### Step 1: Admin Portal Health Check (2 min)

- [ ] Log into admin portal at `https://www.monitrax.com.au/admin/login`
- [ ] Verify dashboard loads correctly
- [ ] Check sidebar shows all 5 sections
- [ ] Check no error banners on dashboard

#### Step 2: GCP Infrastructure Status (3 min)

- [ ] **Uptime & Alerts** → all uptime checks should show 100% success last hour
- [ ] **Error Tracking** → review errors from last 24 hours
  - [ ] New error groups? (investigate)
  - [ ] Error count spike? (investigate)
- [ ] **Cloud Scheduler** → verify `monitrax-cdr-lifecycle` last run was successful (within 24 hours)
- [ ] **Security Findings** → any new critical/high findings? (escalate if so)

#### Step 3: Authentication & Security (3 min)

- [ ] **Security Monitoring** → check:
  - Failed login attempts (>20 in 24h = flag)
  - Rate limit hits (>100 in 24h = flag)
  - Access violations (any 403s = investigate)
  - Locked accounts (review list)

#### Step 4: CDR Compliance Quick Check (3 min)

- [ ] **CDR Compliance** → verify:
  - Active consents count (trending up or stable)
  - No expired consents older than 24 hours (indicates scheduler issue)
  - Recent revocations are reflected in deletion events
  - No new complaints in "Open" status without owner

#### Step 5: User Support Queue (3 min)

- [ ] Check support email inbox
- [ ] Triage new tickets
- [ ] Escalate urgent issues (account lockouts, billing disputes, data concerns)

#### Step 6: Cloud Logging Spot Check (3 min)

- [ ] **Audit Logs** → scroll through last 30 events
- [ ] Look for anomalies:
  - Admin actions after hours (suspicious)
  - Failed auth from new IPs
  - Bulk operations (unusual)
  - CDR data access by unexpected users

### End-of-Day Checklist

#### Step 7: Close Outstanding Items (2 min)

- [ ] Update any open support tickets
- [ ] Hand off to next admin on duty if applicable
- [ ] Flag any issues needing overnight attention

### Daily Escalation Triggers

Escalate to Director immediately if ANY of the following:

- [ ] Uptime check failed for > 10 minutes
- [ ] Error rate > 100 errors in 1 hour
- [ ] Critical security finding
- [ ] Suspected data breach
- [ ] Payment processing failure affecting multiple users
- [ ] CDR consent expiry job failed
- [ ] OAIC complaint received

---

## 3. Weekly BAU Tasks

**Duration**: ~1 hour
**Owner**: Support admin (or Director if no support admin)
**Best time**: Monday morning

### Weekly Review Checklist

#### Step 1: Platform Metrics (15 min)

Navigate to **Dashboard** + **Analytics**:

- [ ] User growth (new signups this week vs last week)
- [ ] Organization growth
- [ ] MRR changes (**Billing** dashboard)
- [ ] Active user count (DAU, WAU)
- [ ] Feature adoption (via analytics)

**Action**: Document in weekly metrics log

#### Step 2: CDR Compliance Weekly Audit (20 min)

- [ ] **CDR Compliance** dashboard:
  - Consent counts (active/revoked/expired)
  - Complaints breakdown (open/resolved/escalated)
  - Audit event coverage
- [ ] Verify Cloud Scheduler ran successfully all 7 days
- [ ] **Audit Logs** → filter by CDR actions for the week:
  - `CDR_DATA_DELETED` count
  - `CDR_CONSENT_EXPIRED` count
  - `CDR_CONSENT_REVOKED` count
  - Deletion count should >= revocation+expiration count
- [ ] Review any new complaints lodged this week
- [ ] Check status of complaints approaching 30-day SLA

#### Step 3: Security Review (15 min)

- [ ] **Security Monitoring** → weekly trends:
  - Auth failure rate
  - Rate limit trends
  - Lockout counts
- [ ] **Security Findings** → address any new findings
- [ ] Review Cloud Logging for suspicious activity:
  - After-hours admin access
  - Unusual IPs
  - Bulk exports
  - Privilege escalations

#### Step 4: User Support Summary (10 min)

- [ ] Close resolved tickets
- [ ] Review common issues (identify patterns)
- [ ] Document FAQ updates if needed
- [ ] Review impersonation sessions (should all be justified)

### Weekly Escalation

Escalate to Director if:

- Week-over-week error rate increased >20%
- Any unresolved complaint > 20 days old
- Any escalated OAIC complaint
- Security finding severity = Critical
- Recurring user issues (>5 same type in a week)

---

## 4. Monthly BAU Tasks

**Duration**: ~2-3 hours
**Owner**: Director + Support admin
**Best time**: First Monday of each month

### Monthly Checklist

#### Step 1: Full Audit Review (30 min)

- [ ] Review Cloud Logging retention (should be >= 365 days)
- [ ] Sample audit log entries for CDR events
- [ ] Verify all admin actions were authorized
- [ ] Review any emergency actions taken during the month

#### Step 2: Compliance Score Update (30 min)

- [ ] Update `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`
- [ ] Review progress on any open CDR gaps
- [ ] Check if any new CDR rules have been published by ACCC

#### Step 3: GCP Services Review (30 min)

- [ ] **Billing → Reports** — Review GCP costs
  - Cloud Logging
  - Cloud Monitoring
  - Cloud SQL
  - Cloud Scheduler
- [ ] Set up any new alert policies
- [ ] Review retention policies
- [ ] Check if any service quotas are approaching limits

#### Step 4: Admin Account Review (20 min)

- [ ] List all admin accounts (**Settings → Admin Users**)
- [ ] Verify each admin is still active and needed
- [ ] Check MFA enrollment (must be 100% for SUPER_ADMIN/BILLING_ADMIN)
- [ ] Flag admins inactive >90 days (per Basiq §1.7)
- [ ] Deactivate inactive admins per `04_ADMIN_ONBOARDING_TRAINING.md` §5

#### Step 5: Policy Compliance (20 min)

- [ ] Review `docs/policy/` documents — are any out of date?
- [ ] Verify retention policies are being followed
- [ ] Check data minimisation enforcement (scope still matches what's collected)
- [ ] Review CDR complaints policy — any new categories needed?

#### Step 6: Monthly Report to Director (15 min)

Prepare a monthly report covering:

1. **Platform Health**:
   - Uptime % for the month
   - Error trends
   - Any major incidents
2. **User Growth**:
   - New signups
   - Churn
   - MRR change
3. **CDR Compliance**:
   - Consent lifecycle numbers
   - Complaints (received, resolved, escalated)
   - Any OAIC interactions
4. **Security**:
   - Auth failure trends
   - Access violations
   - Any breaches (hopefully none)
5. **Action items** for next month

Email report to Director by 5th of each month.

---

## 5. Quarterly BAU Tasks

**Duration**: ~1 full day
**Owner**: Director
**Best time**: First week of each quarter

### Quarterly Checklist

#### Step 1: Full Compliance Audit (3 hours)

- [ ] Complete review of all `docs/compliance/*`
- [ ] Verify all Basiq accreditation requirements still met
- [ ] Run `/api/admin/gcp/healthcheck` and verify all GCP services operational
- [ ] Sample CDR data — ensure nothing retained beyond policy
- [ ] Review all audit logs for the quarter (spot checks)

#### Step 2: Security Audit (2 hours)

- [ ] Review all admin roles + permissions
- [ ] Check service account permissions in GCP
- [ ] Rotate CRON_SECRET (if 90+ days old)
- [ ] Review Firebase Auth user base for anomalies
- [ ] Run vulnerability scan (OWASP ZAP) if internal
- [ ] Review `docs/policy/INCIDENT_RESPONSE_PLAN.md` — any updates needed?

#### Step 3: Policy Review (1 hour)

- [ ] Review all policies in `docs/policy/`:
  - CDR_DATA_RETENTION_SCHEDULE.md
  - CDR_COMPLAINTS_POLICY.md
  - CDR_DATA_MINIMISATION.md
  - INCIDENT_RESPONSE_PLAN.md
  - DEVICE_SECURITY_POLICY.md
  - SECURITY_AWARENESS_POLICY.md
  - APPROVED_DEPENDENCIES.md
- [ ] Update review dates
- [ ] Document any changes in changelog

#### Step 4: Training Review (1 hour)

- [ ] Review admin training materials
- [ ] Update `04_ADMIN_ONBOARDING_TRAINING.md` if procedures changed
- [ ] Review whether any admin needs refresher training
- [ ] Document any training gaps identified

#### Step 5: Infrastructure Review (1 hour)

- [ ] GCP Cloud SQL backup verification (test restore)
- [ ] Cloud Logging retention check
- [ ] Cloud Monitoring alert policy review
- [ ] Security Command Center finding review
- [ ] Basiq API version + deprecation check

#### Step 6: Documentation Updates (1 hour)

- [ ] Update this playbook if procedures have changed
- [ ] Update `01_ADMIN_PORTAL_OPERATIONS.md` with any new features
- [ ] Update `02_ADMIN_TROUBLESHOOTING_RUNBOOK.md` with new issues encountered
- [ ] Update `docs/blueprint/PHASE_M_ADMIN_PORTAL_GCP_FIRST.md` if architecture changes

---

## 6. Annual BAU Tasks

**Duration**: ~1 week
**Owner**: Director
**Best time**: Q1 of calendar year

### Annual Checklist

- [ ] Full Basiq CDR Compliance Matrix review
- [ ] Basiq accreditation renewal (if applicable)
- [ ] ACCC CDR Rules review — any major updates?
- [ ] Insurance renewal (cyber + PI)
- [ ] Penetration test (external vendor)
- [ ] Security awareness training refresher for all staff
- [ ] Update `docs/policy/SECURITY_AWARENESS_POLICY.md`
- [ ] Review all admin accounts + deactivate dormant
- [ ] Rotate all secrets (CRON_SECRET, BASIQ_WEBHOOK_SECRET, service account key)
- [ ] Full disaster recovery test

---

## 7. Incident Response During BAU

If you encounter an incident during BAU tasks:

### Step 1: Assess Severity

| Severity | Examples | Response Time |
|----------|---------|---------------|
| **P0 Critical** | Data breach, service outage, unauthorized access | Immediate |
| **P1 High** | Single user can't access data, CDR compliance gap | Within 1 hour |
| **P2 Medium** | Feature bug, slow performance | Within 4 hours |
| **P3 Low** | UI glitch, minor error | Next business day |

### Step 2: Contain

- P0/P1: Follow `docs/policy/INCIDENT_RESPONSE_PLAN.md`
- P2/P3: Log in ticket system, schedule fix

### Step 3: Document

- Incident log entry
- Timeline of events
- Actions taken
- Root cause analysis
- Prevention measures

### Step 4: Notify

- P0/P1: Director within 15 minutes
- P2: Director in next email
- P3: Monthly report

---

## 8. BAU Metrics to Track

### Platform Health KPIs

| Metric | Target | How to Measure |
|--------|--------|----------------|
| API Uptime | >= 99.9% | Cloud Monitoring uptime checks |
| Error Rate | < 0.1% | Error Reporting |
| P95 Response Time | < 500ms | Cloud Monitoring |
| Auth Success Rate | >= 99% | Audit logs |

### CDR Compliance KPIs

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Consent Deletion SLA | < 24 hours | Audit logs |
| Complaint Resolution SLA | < 30 days | CDRComplaint table |
| Cloud Scheduler Success | 100% | Admin portal scheduler page |
| Audit Log Retention | >= 365 days | Cloud Logging settings |

### Business KPIs

| Metric | Target | How to Measure |
|--------|--------|----------------|
| MRR Growth | Month-over-month positive | Billing dashboard |
| Churn Rate | < 5% | Billing analytics |
| DAU/MAU | >= 20% | Analytics page |
| Support Ticket Volume | Stable or decreasing | Manual tracking |

---

## 9. Tools & Resources

### Primary Tools

- **Admin Portal**: `https://www.monitrax.com.au/admin/login`
- **Vercel Dashboard**: https://vercel.com/reza-sadeghs-projects/monitrax
- **GCP Console**: https://console.cloud.google.com/?project=monitrax-479700
- **Firebase Console**: https://console.firebase.google.com/project/monitrax-479700
- **Basiq Dashboard**: https://dashboard.basiq.io/
- **Stripe Dashboard**: https://dashboard.stripe.com/

### Documentation

All under `docs/operational/admin/`:
1. `01_ADMIN_PORTAL_OPERATIONS.md` — Day-to-day operations
2. `02_ADMIN_TROUBLESHOOTING_RUNBOOK.md` — Common issues + resolutions
3. `03_GCP_SERVICE_OPERATIONS.md` — GCP Console deep dive
4. `04_ADMIN_ONBOARDING_TRAINING.md` — Onboarding new admins
5. `05_CDR_COMPLIANCE_PROCEDURES.md` — CDR-specific workflows
6. `ADMIN_PORTAL_BAU_PLAYBOOK.md` — This document

### Policies

Under `docs/policy/`:
- CDR_DATA_RETENTION_SCHEDULE.md
- CDR_COMPLAINTS_POLICY.md
- CDR_DATA_MINIMISATION.md
- INCIDENT_RESPONSE_PLAN.md
- DEVICE_SECURITY_POLICY.md
- SECURITY_AWARENESS_POLICY.md
- APPROVED_DEPENDENCIES.md

### Contacts

| Issue | Contact |
|-------|---------|
| Director | admin@monitrax.com.au |
| GCP Support | GCP Console → Support |
| Basiq Support | support@basiq.io, compliance@basiq.io |
| Firebase Support | Firebase Console → Help |
| OAIC | https://www.oaic.gov.au/, 1300 363 992 |

---

## 10. Playbook Maintenance

### When to Update

- After any major incident (add learnings)
- When new features are added to admin portal
- When procedures change
- Quarterly review (scheduled)

### How to Update

1. Edit this file via PR (never direct commit to main)
2. Document changes in PR description
3. Get Director approval
4. Update version number + date at top
5. Notify admin team of changes

---

*Last Updated: 2026-04-12*
*Version: 1.0*
*Next Review: 2026-07-12 (quarterly)*
