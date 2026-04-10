# 04 - BAU Operations Framework

**Date:** 2026-04-10 | **Version:** 1.0 | **Status:** DRAFT

---

## 1. Purpose

This framework defines the Business-As-Usual (BAU) operations required to support Monitrax in production. It covers daily/weekly/monthly activities, SLAs, escalation paths, monitoring procedures, and change management processes.

---

## 2. Service Level Agreements (SLAs)

### 2.1 System Availability

| Service | SLA Target | Measurement Method | Exclusions |
|---------|-----------|-------------------|-----------|
| **Web Application** | 99.5% monthly | Vercel status + uptime monitor | Scheduled maintenance windows |
| **API Endpoints** | 99.5% monthly | `/api/health` check every 5 min | Scheduled maintenance |
| **Database** | 99.9% monthly | GCP Cloud SQL SLA | Failover events < 60s |
| **Authentication** | 99.9% monthly | Firebase Auth SLA | Planned migrations |
| **Basiq Integration** | 99.0% monthly | Basiq SLA + sync monitoring | Basiq planned maintenance |

### 2.2 Performance SLAs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **API Response (P50)** | < 500ms | Cloud Monitoring |
| **API Response (P95)** | < 2,000ms | Cloud Monitoring |
| **Dashboard Load (P50)** | < 1.5s | Vercel Analytics |
| **Dashboard Load (P95)** | < 3s | Vercel Analytics |
| **Financial Snapshot Calculation** | < 5s | Custom metric |
| **Database Query (P95)** | < 500ms | Cloud SQL metrics |

### 2.3 Incident Response SLAs

| Severity | Acknowledgement | Resolution | Communication |
|----------|----------------|------------|---------------|
| **P0 - Critical** | < 15 minutes | < 4 hours | Every 30 min |
| **P1 - High** | < 1 hour | < 8 hours | Every 2 hours |
| **P2 - Medium** | < 4 hours | < 24 hours | Daily |
| **P3 - Low** | < 24 hours | < 5 business days | As resolved |

### 2.4 CDR-Specific SLAs

| Metric | Target | Regulatory Basis |
|--------|--------|-----------------|
| **CDR data deletion after consent revocation** | < 24 hours | CDR Rules |
| **CDR breach notification (OAIC)** | < 30 days | NDB Scheme |
| **CDR breach notification (consumers)** | As soon as practicable | NDB Scheme |
| **CDR breach notification (Basiq)** | Immediately | Basiq contract |
| **CDR audit log retention** | Minimum 7 years | Legal/Tax compliance |

---

## 3. Operational Activities Schedule

### 3.1 Daily Activities

| # | Activity | Time | Owner | Procedure |
|---|----------|------|-------|-----------|
| 1 | **System health check** | 09:00 AEST | BAU Analyst | Hit `/api/health`, check Vercel dashboard, check Cloud SQL status |
| 2 | **CDR consent expiry check** | 09:15 AEST | BAU Analyst | Verify Cloud Scheduler job ran at 02:00 AEST, review results |
| 3 | **Basiq sync status** | 09:30 AEST | BAU Analyst | Check for failed syncs, stale connections (>24h) |
| 4 | **Error log review** | 10:00 AEST | BAU Analyst | Review Cloud Logging for errors, 500s, auth failures |
| 5 | **Anomaly detection review** | 10:30 AEST | BAU Analyst | Review automated anomaly detection results |
| 6 | **Support ticket triage** | 11:00 AEST | BAU Lead | Review and prioritize incoming support requests |

### 3.2 Weekly Activities

| # | Activity | Day | Owner | Procedure |
|---|----------|-----|-------|-----------|
| 1 | **Performance review** | Monday | BAU Lead | Review API latency, error rates, user metrics for past week |
| 2 | **Security review** | Tuesday | Security/BAU | Failed logins, suspicious access patterns, MFA adoption |
| 3 | **Basiq integration health** | Wednesday | BAU Analyst | Connection success rates, sync latency, error patterns |
| 4 | **Database health check** | Thursday | DBA/BAU | Storage growth, slow queries, connection utilization |
| 5 | **CDR compliance check** | Friday | Compliance/BAU | Consent status, data retention, audit trail completeness |
| 6 | **Weekly BAU standup** | Friday PM | BAU Team | Review incidents, upcoming changes, blockers |

### 3.3 Monthly Activities

| # | Activity | Owner | Deliverable |
|---|----------|-------|-------------|
| 1 | **CDR data inventory** | Compliance Lead | CDR data report by category and user count |
| 2 | **Capacity review** | BAU Lead | Storage growth trend, API traffic trend, user growth |
| 3 | **Dependency audit** | Dev Lead | npm audit, check for CVEs in approved dependencies |
| 4 | **SLA performance report** | BAU Lead | Availability, response time, incident summary |
| 5 | **Backup verification** | DBA | Verify latest backup can be restored successfully |
| 6 | **Access review** | Security Lead | Review admin access, API keys, service accounts |
| 7 | **Cost review** | BAU Lead | GCP, Vercel, Basiq, Resend, Twilio costs vs budget |

### 3.4 Quarterly Activities

| # | Activity | Owner | Deliverable |
|---|----------|-------|-------------|
| 1 | **DR drill** | BAU Lead | Restore from backup, verify data integrity, document RTO/RPO |
| 2 | **CDR compliance audit** | Compliance Lead | Full audit against CDR_BASIQ_COMPLIANCE_MATRIX.md |
| 3 | **Security penetration test** | External/Security | Pen test focused on CDR endpoints and auth |
| 4 | **Policy document review** | All owners | Update all policy docs, reset review dates |
| 5 | **Capacity planning** | BAU Lead + Dev | 6-month growth projection, scaling recommendations |
| 6 | **Architecture review** | Dev Lead | Review technical debt, upcoming platform changes |

### 3.5 Annual Activities

| # | Activity | Owner |
|---|----------|-------|
| 1 | **Basiq accreditation renewal** | Director / Compliance |
| 2 | **Full security audit** | External auditor |
| 3 | **CDR compliance certification** | External auditor |
| 4 | **Business continuity plan review** | Director |
| 5 | **Budget and resource planning** | Director / BAU Lead |

---

## 4. Incident Management

### 4.1 Severity Classification

| Severity | Definition | Examples |
|----------|-----------|---------|
| **P0 - Critical** | System down or CDR data breach | Full outage, auth failure for all users, CDR data exposed |
| **P1 - High** | Major feature unavailable | Dashboard not loading, financial calculations wrong, Basiq sync failed for all |
| **P2 - Medium** | Feature degraded, workaround available | Slow performance, single module error, one user affected |
| **P3 - Low** | Minor issue, no business impact | UI cosmetic issue, documentation error, non-critical log warning |

### 4.2 Escalation Matrix

```
Level 1: BAU Analyst (0-30 min)
    ├── Can resolve: Known issues, restarts, cache clear, user resets
    └── Escalate if: Unknown issue, CDR impact, requires code change
         ↓
Level 2: BAU Lead / Dev on-call (30 min - 2 hours)
    ├── Can resolve: Config changes, rollback, DB queries, Basiq troubleshooting
    └── Escalate if: Infrastructure failure, security incident, CDR breach
         ↓
Level 3: Infrastructure / Director (2-4 hours)
    ├── Can resolve: GCP service issues, Vercel config, emergency patches
    └── Escalate if: CDR breach requiring notification
         ↓
Level 4: External (4+ hours)
    ├── GCP Support (infrastructure)
    ├── Basiq Support (Open Banking)
    ├── OAIC (CDR data breach notification)
    └── Legal counsel (regulatory compliance)
```

### 4.3 Incident Runbook Index

| Scenario | Runbook Location | Priority |
|----------|-----------------|----------|
| Application unresponsive | `docs/operational/runbooks/01_INCIDENT_RESPONSE.md` | P0 |
| Database unreachable | `docs/operational/runbooks/01_INCIDENT_RESPONSE.md` | P0 |
| Authentication failures | `docs/operational/runbooks/01_INCIDENT_RESPONSE.md` | P0/P1 |
| API 500 errors | `docs/operational/runbooks/01_INCIDENT_RESPONSE.md` | P1 |
| Slow performance | `docs/operational/runbooks/01_INCIDENT_RESPONSE.md` | P2 |
| CDR data breach | `docs/policy/INCIDENT_RESPONSE_PLAN.md` | P0 |
| Basiq sync failure | **NEEDED** - to be created | P1 |
| Vercel deployment failure | `docs/operational/deployment/02_VERCEL_DEPLOYMENT.md` | P1 |
| GCP service outage | **NEEDED** - to be created | P1 |
| Firebase Auth outage | **NEEDED** - to be created | P0 |
| Secrets compromised | **NEEDED** - to be created | P0 |
| Certificate expiry | **NEEDED** - to be created | P1 |
| Database full | `docs/operational/database/01_CLOUD_SQL_OPERATIONS.md` | P1 |
| Connection pool exhausted | `docs/operational/database/03_MONITORING_AND_ALERTS.md` | P1 |
| User account lockout | `docs/operational/runbooks/02_COMMON_OPERATIONS.md` | P3 |

---

## 5. Change Management

### 5.1 Change Classification

| Type | Description | Approval | Lead Time |
|------|-------------|----------|-----------|
| **Standard** | Pre-approved, low risk (config update, content change) | Pre-approved | Same day |
| **Normal** | Requires review (code change, dependency update) | PR review + approval | 1-3 days |
| **Emergency** | Urgent fix for P0/P1 incident | Director approval | Immediate |
| **Major** | Architecture change, database migration, CDR impact | CAB review | 1-2 weeks |

### 5.2 Change Process

```
1. Change Request (describe what, why, risk)
     ↓
2. Classification (Standard/Normal/Emergency/Major)
     ↓
3. Impact Assessment
   - Which modules affected?
   - CDR data impact?
   - Database schema change?
   - Rollback plan?
     ↓
4. Approval
   - Standard: Auto-approved
   - Normal: PR review
   - Emergency: Director verbal + retrospective approval
   - Major: CAB review (Director + Dev Lead + BAU Lead)
     ↓
5. Implementation
   - Feature branch
   - Build + lint verification
   - Preview deployment testing
     ↓
6. Deployment
   - Merge to main
   - Vercel auto-deploy
   - Post-deployment verification
     ↓
7. Post-Change Review
   - Verify functionality
   - Monitor error rates (30 min)
   - Update documentation
```

### 5.3 Change Freeze Windows

| Period | Scope | Exceptions |
|--------|-------|-----------|
| **Friday 5PM - Monday 9AM AEST** | No non-emergency deployments | P0 incident fixes only |
| **Public holidays** | No deployments | P0 incident fixes only |
| **CDR audit period** | No CDR-related changes | Critical CDR fixes only |

---

## 6. Monitoring Framework

### 6.1 Monitoring Stack

| Layer | Tool | What to Monitor |
|-------|------|----------------|
| **Infrastructure** | GCP Cloud Monitoring | Cloud SQL CPU/memory/disk/connections, Cloud Storage usage |
| **Application** | Vercel Analytics + Cloud Logging | API response times, error rates, deployment status |
| **Security** | Cloud Armor + Audit Logs | WAF events, auth failures, suspicious patterns |
| **CDR Compliance** | Custom queries + Cloud Scheduler | Consent status, data inventory, audit trail |
| **User Experience** | Vercel Speed Insights | Page load times, Core Web Vitals |
| **External Services** | Custom health checks | Basiq API, Firebase Auth, Resend, Twilio |

### 6.2 Alert Configuration

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| System down | Health check fails 3x in 5 min | P0 | SMS + Email |
| High error rate | > 5% 5xx responses in 5 min | P1 | Email |
| Database CPU > 80% | Sustained 5 min | P1 | Email |
| Database disk > 85% | Any reading | P1 | Email |
| Database connections > 80% | Sustained 5 min | P2 | Email |
| Auth failures spike | > 10 failures in 5 min | P1 | Email |
| Basiq sync failure | Any connection fails | P2 | Email |
| CDR consent expiring | Expiry within 7 days | P3 | Email (daily digest) |
| Deployment failure | Vercel build fails | P2 | Email |
| CDR data breach detected | Anomaly detection trigger | P0 | SMS + Email |

### 6.3 Dashboard Requirements

**BAU Operations Dashboard should display:**

1. **System Health Panel**
   - Overall status (Green/Yellow/Red)
   - API health endpoint status
   - Database status
   - Firebase Auth status
   - Basiq connection status

2. **Performance Panel**
   - API P50/P95 response times (24h)
   - Error rate trend (7d)
   - Active user sessions
   - Dashboard load times

3. **CDR Compliance Panel**
   - Active consents count
   - Expiring consents (7d)
   - CDR data access count (24h)
   - Deletion backlog
   - Audit log health

4. **Incident Panel**
   - Open incidents by severity
   - Mean time to resolve (30d)
   - Incident trend (90d)

---

## 7. Backup & Recovery

### 7.1 Backup Strategy (Verified Against docs/operational/database/02_BACKUP_AND_RESTORE.md)

| Type | Frequency | Retention | Target |
|------|-----------|-----------|--------|
| **Automated backups** | Daily | 30 days (PROD), 7 days (DEV) | Cloud SQL |
| **On-demand backups** | Before major changes | Until manually deleted | Cloud SQL |
| **Point-in-time recovery** | Continuous (WAL logs) | 30 days | Cloud SQL |
| **Offline backups** | Weekly | 90 days | GCS bucket |
| **Schema export** | After each migration | Indefinite (git) | Repository |

### 7.2 Recovery Procedures

| Scenario | Procedure | RTO Target | RPO Target |
|----------|-----------|-----------|-----------|
| **Accidental data deletion** | Point-in-time recovery | < 2 hours | < 1 hour |
| **Database corruption** | Restore from latest backup | < 4 hours | < 24 hours |
| **Full disaster** | Restore to new instance | < 8 hours | < 24 hours |
| **Application rollback** | Vercel instant rollback | < 5 minutes | 0 (no data loss) |

### 7.3 DR Drill Procedure (Quarterly)

1. Create test Cloud SQL instance
2. Restore latest production backup to test instance
3. Verify data integrity (row counts, financial totals)
4. Test application connectivity to restored instance
5. Verify CDR data integrity specifically
6. Document RTO/RPO achieved
7. Destroy test instance
8. File DR drill report

---

## 8. Knowledge Management

### 8.1 Documentation Ownership

| Document Area | Owner | Review Frequency |
|--------------|-------|-----------------|
| Blueprint/Architecture | Dev Lead | Quarterly |
| Operational Runbooks | BAU Lead | Monthly |
| Security/CDR Policy | Compliance Lead | Quarterly |
| Database Operations | DBA / BAU | Monthly |
| Deployment Procedures | Dev Lead | Quarterly |
| BAU Framework (this suite) | BAU Lead | Quarterly |

### 8.2 Knowledge Transfer Requirements

| Scenario | Required Actions |
|----------|-----------------|
| New team member onboarding | Complete CLAUDE.md, operational docs, CDR training |
| Role transition | 2-week shadow period, documented handover |
| Vendor change | Updated procedures, tested with new vendor before cutover |
| Architecture change | Blueprint update, operational doc update, team briefing |

---

## 9. Continuous Improvement

### 9.1 Metrics to Track (Monthly)

| Metric | Target | Source |
|--------|--------|--------|
| System availability | > 99.5% | Uptime monitor |
| Mean time to detect (MTTD) | < 5 minutes | Incident log |
| Mean time to acknowledge (MTTA) | < 15 minutes (P0) | Incident log |
| Mean time to resolve (MTTR) | < 4 hours (P0) | Incident log |
| Change failure rate | < 5% | Deployment log |
| Deployment frequency | > 5/week | Vercel dashboard |
| CDR compliance score | 100% | Quarterly audit |
| Customer satisfaction | > 4/5 | Support feedback |

### 9.2 Post-Incident Reviews

After every P0 or P1 incident:

1. **Timeline:** What happened, when, who did what
2. **Root cause:** Technical and process root cause
3. **Impact:** Users affected, duration, data impact
4. **What went well:** Detection, response, communication
5. **What to improve:** Prevention, faster detection, faster resolution
6. **Action items:** Specific, assigned, with due dates

---

*This framework should be reviewed quarterly and updated to reflect operational learnings. See TRACKING_REFERENCE.md for source verification.*
