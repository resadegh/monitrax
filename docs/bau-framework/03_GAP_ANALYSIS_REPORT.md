# 03 - Comprehensive Gap Analysis Report

**Date:** 2026-04-10 | **Version:** 1.0 | **Status:** DRAFT

---

## 1. Architecture & Design Gaps

### 1.1 Database Schema Gaps

| Gap | Severity | Impact | Recommendation |
|-----|----------|--------|----------------|
| **No CDRConsent table** | Critical | Cannot track consent lifecycle independently from Basiq connection state | Create `CDRConsent` model with status, grantedAt, expiresAt, revokedAt, scope, purpose fields |
| **Legacy Transaction model** | High | Dual models cause query confusion; `Transaction` and `UnifiedTransaction` coexist | Migrate all queries to `UnifiedTransaction`, deprecate `Transaction` model |
| **No soft-delete support** | Medium | Hard deletes make recovery impossible; CDR data deletion is irreversible by design but non-CDR data has no safety net | Add `deletedAt` nullable timestamp to non-CDR financial entities |
| **Budget tables underutilized** | Medium | `Budget` and `BudgetPeriod` exist but `masterFinancialService` doesn't reference them | Integrate budget tracking into financial snapshot |
| **No data versioning** | Low | No audit trail for data changes (only access logging) | Consider event sourcing or change-data-capture for financial entities |

### 1.2 API Architecture Gaps

| Gap | Severity | Impact | Recommendation |
|-----|----------|--------|----------------|
| **No API versioning** | High | Breaking changes affect all consumers immediately | Implement `/api/v1/` prefix or header-based versioning |
| **No rate limiting implementation** | High | Rate limiting documented but implementation not verified in code | Deploy Cloud Armor rate limiting or implement middleware-level throttling |
| **Duplicate API endpoints** | Medium | `/api/portfolio/snapshot`, `/api/financial-snapshot` overlap with `/api/master-snapshot` | Consolidate to single endpoint, redirect old paths |
| **No API documentation (OpenAPI)** | Medium | No machine-readable API spec for consumer integration | Generate OpenAPI 3.0 spec from route definitions |
| **No health check depth** | Low | `/api/health` exists but depth of checks unclear | Add dependency health checks (DB, Basiq, Firebase, GCS) |

### 1.3 Authentication & Security Gaps

| Gap | Severity | Impact | Recommendation |
|-----|----------|--------|----------------|
| **Legacy `withAuth()` still exported** | High | Developers can bypass RBAC by using deprecated guard | Remove export or make it throw error directing to `withPermission()` |
| **IP validation missing** | Medium | `x-forwarded-for` headers trusted without proxy validation | Implement trusted proxy configuration |
| **Session concurrent limit missing** | Medium | No limit on simultaneous sessions per user | Add max concurrent session enforcement |
| **CDR anomaly detection not scheduled** | High | Code exists in `cdrAuditCompliance.ts` but no Cloud Scheduler job runs it | Create GCP Cloud Scheduler trigger for `runAnomalyDetection()` |
| **Sanitizer array recursion gap** | Medium | CDR sanitizer skips arrays, potentially leaking financial data in nested structures | Fix `sanitizeCdrMetadata()` to recurse into arrays |

### 1.4 Financial Engine Gaps

| Gap | Severity | Impact | Recommendation |
|-----|----------|--------|----------------|
| **No caching on snapshot** | High | Every dashboard load triggers full DB query + calculations | Implement Redis or in-memory cache with TTL and invalidation |
| **Hard-coded tax brackets** | Medium | 2024-25 brackets in masterFinancialService.ts; must manually update each year | Use tax engine config (`lib/tax-engine/config/`) instead |
| **No partial failure handling** | Medium | One failed calculation crashes entire snapshot | Implement try/catch per section, return partial snapshot with error markers |
| **No calculation validation** | Medium | No automated verification that calculations produce correct results | Create test suite with known-good inputs/outputs |
| **Frequency conversion simplified** | Low | 52 weeks/year assumption; no leap year handling | Acceptable for financial approximation but document limitation |

---

## 2. Operational Gaps

### 2.1 Missing Runbooks

| Runbook Needed | Priority | Justification |
|---------------|----------|---------------|
| **Basiq Integration Operations** | P0 | Open Banking is core feature; no troubleshooting guide for connection failures, sync errors, consent issues |
| **Extended Incident Scenarios** | P0 | Only 5 scenarios; missing Vercel outage, GCP service disruption, Basiq API failure, Firebase Auth outage, DNS issues |
| **Secrets Management & Rotation** | P1 | No procedures for rotating Firebase keys, Basiq credentials, Resend/Twilio keys, database credentials |
| **Performance Tuning** | P1 | No query optimization, connection pool tuning, caching strategy documentation |
| **Data Integrity Validation** | P1 | No reconciliation procedures for financial data accuracy |
| **Basiq Data Sync Monitoring** | P1 | No monitoring for stale data, failed syncs, consent expiry approaching |
| **User Account Management** | P2 | Basic lock/unlock exists but no comprehensive user lifecycle management |
| **Capacity Planning** | P2 | No growth projections, scaling triggers, or resource planning |
| **On-Call Procedures** | P2 | No rotation, escalation matrix, or after-hours response plan |
| **DR Drill Procedures** | P2 | Backup docs exist but no quarterly test procedures |

### 2.2 Monitoring & Alerting Gaps

| Gap | Priority | Current State | Target State |
|-----|----------|--------------|-------------|
| **No application-level metrics** | P1 | Only infrastructure metrics | Custom metrics: API latency, error rates, calculation times, user sessions |
| **No Basiq sync monitoring** | P1 | No alerts for failed bank syncs | Alert on sync failures, stale data (>24h), consent approaching expiry |
| **No financial calculation drift** | P2 | No way to detect calculation errors | Automated reconciliation checks |
| **No user experience monitoring** | P2 | No page load time tracking | Real User Monitoring (RUM) via Vercel Analytics |
| **No anomaly detection in production** | P1 | Code exists, not deployed | Schedule `runAnomalyDetection()` via Cloud Scheduler |

### 2.3 SLA Gaps (No SLAs Defined)

Currently, Monitrax has **no formal SLAs**. For BAU operations and CDR compliance, the following SLAs should be defined:

| Service | Proposed SLA | Measurement |
|---------|-------------|-------------|
| **System Availability** | 99.5% monthly | Uptime monitoring (excl. scheduled maintenance) |
| **API Response Time** | P95 < 2 seconds | Cloud Monitoring custom metric |
| **Dashboard Load Time** | P95 < 3 seconds | Vercel Analytics |
| **Incident Response (P0)** | Acknowledge < 15 min, Resolve < 4 hours | Incident tracking system |
| **Incident Response (P1)** | Acknowledge < 1 hour, Resolve < 8 hours | Incident tracking system |
| **CDR Data Deletion** | < 24 hours from consent revocation | Audit log verification |
| **Basiq Sync Freshness** | Data < 24 hours old | Sync timestamp monitoring |
| **Backup Recovery** | RTO < 4 hours, RPO < 1 hour | DR drill results |

---

## 3. CDR Compliance Gaps

### 3.1 Basiq Accreditation Requirements (Verified Against CDR_BASIQ_COMPLIANCE_MATRIX.md)

| Requirement | Status | Gap Description |
|------------|--------|-----------------|
| **Consent lifecycle tracking** | Partial | No explicit consent table; inferred from Basiq connection |
| **Automated consent expiry check** | Documented | Cloud Scheduler job documented but implementation not verified |
| **Consent withdrawal → data deletion** | Documented | Procedure exists but no automated purge job confirmed |
| **CDR data at-rest encryption (CMEK)** | Planned | GCP Cloud KMS documented as P1 but deployment status unknown |
| **WAF protection** | Planned | Cloud Armor documented as P0 but deployment status unknown |
| **Security Command Center** | Planned | P0 requirement, status unknown |
| **Cloud DLP** | Planned | P2 requirement for PII detection/redaction |
| **90-day audit log retention** | Implemented | `CDR_MIN_RETENTION_DAYS = 90` in code |
| **CDR data sanitization** | Implemented | `sanitizeCdrMetadata()` redacts 54+ fields |
| **MFA enforcement for CDR routes** | Implemented | `withMFARequired()` guard available |
| **Environment separation** | Implemented | Real CDR data only in production |
| **Incident response plan** | Complete | `docs/policy/INCIDENT_RESPONSE_PLAN.md` covers CDR breaches |
| **Device security policy** | Complete | `docs/policy/DEVICE_SECURITY_POLICY.md` |
| **Approved dependencies list** | Complete | `docs/policy/APPROVED_DEPENDENCIES.md` |
| **Security awareness training** | Documented | `docs/policy/SECURITY_AWARENESS_POLICY.md` |

### 3.2 CDR Operational Gaps

| Gap | Severity | Remediation |
|-----|----------|-------------|
| **No CDR compliance dashboard** | High | Build admin dashboard showing consent status, data inventory, audit coverage |
| **No automated CDR data inventory** | High | Cannot quickly answer "what CDR data do we hold for user X?" |
| **No consent renewal workflow** | Medium | When consent approaches expiry, no proactive renewal flow |
| **No CDR data export for users** | Medium | Users should be able to request their CDR data (data portability) |
| **No regular compliance audit automation** | High | Manual audits only; should have automated compliance checks |
| **Basiq webhook handling** | Medium | No documented webhook receiver for real-time consent status changes |

---

## 4. Design & User Experience Gaps

### 4.1 Features Documented But Not Implemented

| Feature | Phase | Status | Impact |
|---------|-------|--------|--------|
| Mobile Companion App | Phase 15 | Planned (0%) | No mobile access |
| Reporting & Integrations | Phase 16 | Planned (0%) | No PDF/Excel exports, no Xero/QuickBooks |
| CSV/OFX parsers | Phase 18 | Partial | Only QIF supported for bank imports |
| Budget comparison engine | Phase 18 | Partial | Budget tables exist but underutilized |
| Duplicate transaction detection | Phase 18 | Partial | Rule-based detection incomplete |
| Full CGT calculation | Phase 20 | Partial (~70%) | Capital gains tracking incomplete |

### 4.2 UI/UX Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **No virtual scrolling** | Performance degrades with >50 rows | Medium |
| **Health modal not implemented** | Users cannot drill into health score details | Low (widget works) |
| **Delta/trend calculations missing** | No period-over-period comparisons | Medium |
| **No data export UI** | Users cannot export their data | High (CDR portability) |

---

## 5. Infrastructure Gaps

| Gap | Severity | Impact | Recommendation |
|-----|----------|--------|----------------|
| **No staging environment** | High | Changes go from dev preview to production | Create staging branch with dedicated Cloud SQL instance |
| **No automated integration tests** | High | Regressions caught manually | Add CI/CD integration test suite |
| **No canary deployments** | Medium | All users get new code simultaneously | Implement Vercel edge config or feature flags |
| **No automated DB migrations** | Medium | Manual `prisma migrate deploy` in production | Add migration step to deployment pipeline |
| **No load testing** | Medium | Unknown capacity limits | Implement k6 or Artillery load testing |
| **No CDN configuration** | Low | Static assets served from Vercel edge by default | Document Vercel CDN behavior |
| **No disaster recovery drills** | High | Backup procedures untested | Quarterly DR drills |

---

## 6. Gap Priority Matrix

### Critical (Must Fix Before BAU Team Onboarding)
1. CDR consent lifecycle tracking (database + API)
2. Complete incident response runbooks
3. Define SLAs
4. Fix CDR sanitizer array recursion
5. Deploy anomaly detection to production

### High (Fix Within 3 Months)
6. Create Basiq operations runbook
7. Implement caching strategy
8. Add staging environment
9. Remove legacy `withAuth()` export
10. Consolidate duplicate documents

### Medium (Fix Within 6 Months)
11. API versioning
12. Automated integration tests
13. Capacity planning documentation
14. Performance tuning runbook
15. DR drill procedures

### Low (Continuous Improvement)
16. OpenAPI documentation
17. Mobile app (Phase 15)
18. Virtual scrolling for large datasets
19. Advanced CDR compliance dashboard
20. Automated calculation validation

---

*All gaps verified against actual codebase and documentation. See TRACKING_REFERENCE.md for source file references.*
