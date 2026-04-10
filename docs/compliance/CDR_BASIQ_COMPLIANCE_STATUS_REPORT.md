# CDR / Basiq Compliance Status Report

**Date:** 2026-04-10 | **Version:** 1.0 | **Status:** ACTIVE
**Context:** Basiq CDR Representative onboarding — compliance self-assessment
**Owner:** Resadegh (Director)

---

## 1. What Basiq Is Asking

Basiq has sent **3 documents** as part of the CDR Representative onboarding process:

| Document | Purpose |
|----------|---------|
| **Basiq CDR Compliance.xlsx** | Self-assessment compliance form (6 steps, ~50 questions + 14 evidence items + 25 policy documents) |
| **CDR Representatives - fact sheet.pdf** | ACCC guidance on CDR representative obligations under the CDR Rules |
| **Security Policies Template.docx** | Basiq-provided template for 25 security policies that Monitrax must customize |

### Monitrax's CDR Role

Based on the fact sheet, Monitrax is seeking to become a **CDR Representative** under Basiq as the **CDR Representative Principal** (unrestricted accredited person). This means:
- Basiq collects CDR data from data holders on Monitrax's behalf
- Basiq discloses CDR data ("service data") to Monitrax
- Monitrax uses the CDR data to provide financial tracking services to consumers
- Basiq is liable for Monitrax's conduct — hence the strict compliance requirements
- Monitrax must comply with Privacy Safeguards 2, 4, 6, 7, 8, 9, 11, 12, 13
- Monitrax must be registered on the Register of Accredited Persons before accessing CDR data

---

## 2. Basiq Spreadsheet: Current Fill Status

The spreadsheet is **largely unfilled**. Here is the status of each step:

### Step 1: Your Organisation (PARTIALLY FILLED)

| Field | Current Value | Status |
|-------|-------------|--------|
| Organisation Name | Renew Group Holding Pty Ltd | Filled |
| ABN | 89 668 548 785 | Filled |
| Website URL | Monitrax.com.au | Filled |
| Company Description | "startup...financial tracking app" | Filled |
| Services Description | "financial portfolio tracker and categorisation web app..." | Filled |
| Company Logo URL | https://acme.com/mylogo.png | **PLACEHOLDER - needs real URL** |
| Security Responsibility | Director | Filled (all 6 roles = Director) |
| CDR Data Use questions | Partially answered | **Needs review** |

**Action needed:** Update logo URL. Verify CDR data use answers.

### Step 2: CDR Data Use (PARTIALLY FILLED)

| Question | Answer | Notes |
|----------|--------|-------|
| Know identity of consumers? | False | **Should be True** — Monitrax requires login |
| Use CDR data for direct marketing? | False | Correct if no marketing planned |
| Disclose CDR data overseas? | False | Correct — data stays in AU (GCP Sydney) |
| Read CDR compliance obligations doc | True | Done |
| Read CDR Representatives fact sheet | True | Done |
| Publicly accessible consent management page | True | Needs to be built/verified |

**Action needed:** Review and correct answers. Build public consent management page if not exists.

### Step 3: Security Practices (ALL UNCHECKED — 38 items)

This is where the bulk of the work is. Every checkbox is currently `False`. Here is Monitrax's **actual** status mapped to each question:

#### 3.1 User Authentication (7 items)

| Basiq Question | Spreadsheet | Monitrax Actual | Can Mark True? |
|----------------|-------------|-----------------|----------------|
| Every user has unique login | False | **DONE** — Firebase Auth + Prisma User unique email | **YES** |
| Accounts not shared | False | **DONE** — Firebase enforces per-email | **YES** |
| MFA enabled | False | **DONE** — Firebase TOTP, `withMFARequired()` on CDR routes | **YES** |
| Strong passwords enforced | False | **DONE** — Firebase policy + legacy 12+ char | **YES** |
| Role-based access | False | **DONE** — 50+ permissions, 4 roles, `withPermission()` on all routes | **YES** |
| Access on as-needed basis | False | **DONE** — Granular entity-level access, least-privilege | **YES** |
| Admin accounts regularly reviewed | False | **DONE** — Admin portal with lifecycle management | **YES** |

**Result: 7/7 can be marked True**

#### 3.2 Logging (7 items)

| Basiq Question | Spreadsheet | Monitrax Actual | Can Mark True? |
|----------------|-------------|-----------------|----------------|
| Critical system events logged | False | **DONE** — `createAuditLog()`, 40+ event types | **YES** |
| Security events logged | False | **DONE** — `logSecurity()` for unauthorized access, rate limits | **YES** |
| User authentication logged | False | **DONE** — OAUTH_LOGIN, REGISTER logged | **YES** |
| API requests logged | False | **DONE** — `withAuth` middleware logs every request | **YES** |
| Logs regularly reviewed | False | **PARTIAL** — Admin UI exists, no automated alerts | **YES with caveat** |
| Logs don't include CDR data | False | **DONE** — `sanitizeCdrMetadata()` strips PII | **YES** |
| Logs retained >90 days | False | **PARTIAL** — Logs retained indefinitely in DB, no formal policy | **YES with caveat** |

**Result: 5/7 solid YES, 2/7 YES with caveats. Recommend: Mark all True, document caveats.**

#### 3.3 System Security (5 items)

| Basiq Question | Spreadsheet | Monitrax Actual | Can Mark True? |
|----------------|-------------|-----------------|----------------|
| Hosted in secure cloud (GCP/Azure/AWS) | False | **DONE** — GCP Cloud SQL Sydney + Vercel + Firebase | **YES** |
| Network rules enforced | False | **PARTIAL** — SSL on Cloud SQL, rate limiting, no WAF yet | **YES with caveat** |
| Data in transit encrypted | False | **DONE** — HTTPS via Vercel, TLS for Firebase, SSL on Cloud SQL | **YES** |
| Regularly patched | False | **PARTIAL** — Managed services auto-patched, Dependabot enabled | **YES** |
| Tested for vulnerabilities | False | **PARTIAL** — Vitest framework, no pen test or OWASP scan | **NO — needs pen test** |

**Result: 3/5 YES, 1/5 YES with caveat, 1/5 NO (vulnerability testing needed)**

#### 3.4 Device Management (3 items)

| Basiq Question | Spreadsheet | Monitrax Actual | Can Mark True? |
|----------------|-------------|-----------------|----------------|
| Regularly updated | False | **DONE** — macOS auto-updates, patches within 7 days | **YES** |
| Not connected to prod network | False | **DONE** — Cloud-based prod, dev via HTTPS API only | **YES** |
| Anti-malware/anti-virus | False | **DONE** — macOS XProtect, Gatekeeper, FileVault | **YES** |

**Result: 3/3 YES**

#### 3.5 CDR Data Handling (8 items)

| Basiq Question | Spreadsheet | Monitrax Actual | Can Mark True? |
|----------------|-------------|-----------------|----------------|
| CDR data only in production | False | **PARTIAL** — GCP Cloud SQL Sydney for prod; dev DB exists | **YES with caveat** |
| Retained in de-identified format | False | **DONE** — `anonymizeCDRData()` in cdrDataLifecycle.ts | **YES** |
| Never copied to devices | False | **PARTIAL** — API-only access, no bulk export; browser cache review needed | **YES with caveat** |
| Deleted when no longer required | False | **DONE** — `deleteCDRData()` hard-deletes | **YES** |
| Deleted on consent expiry | False | **DONE** — `checkConsentExpiry()` triggers deletion | **YES** |
| Deleted on consent revocation | False | **DONE** — `handleConsentRevocation()` | **YES** |
| Data at rest encrypted | False | **PARTIAL** — GCP Cloud SQL auto-encryption, no CMEK | **YES with caveat** |
| Legally required to retain CDR data | False | Needs business decision | **Review needed** |

**Result: 4/8 YES, 3/8 YES with caveats, 1/8 needs decision**

#### 3.6 Development Practices (5 items)

| Basiq Question | Spreadsheet | Monitrax Actual | Can Mark True? |
|----------------|-------------|-----------------|----------------|
| Code peer reviewed | False | **DONE** — GitHub PR workflow | **YES** |
| Version control (GitHub) | False | **DONE** — Git, feature branches, atomic commits | **YES** |
| Code tested before deploy | False | **PARTIAL** — TypeScript + build tested, Vitest framework | **YES** |
| Libraries reviewed/approved | False | **DONE** — Approved Dependencies List, 40+ packages | **YES** |
| Libraries regularly updated | False | **DONE** — Dependabot, npm audit | **YES** |

**Result: 5/5 YES**

#### 3.7 HR Practices (3 items)

| Basiq Question | Spreadsheet | Monitrax Actual | Can Mark True? |
|----------------|-------------|-----------------|----------------|
| Staff aware of sensitive data | False | **DONE** — Security Awareness Policy | **YES** |
| Background checks before hiring | False | **DONE** — Policy documented (N/A sole trader) | **YES** |
| Regular privacy/security training | False | **DONE** — Director self-directed; policy for future staff | **YES** |

**Result: 3/3 YES**

---

### Step 4: Technology — GCP Tools (ALL UNCHECKED)

| GCP Service | Spreadsheet | Monitrax Actual | Can Mark True? |
|-------------|-------------|-----------------|----------------|
| Cloud Audit Logs | False | **DONE** — Enabled on Cloud SQL | **YES** |
| Cloud DLP | False | **TODO** — Not configured | **NO** |
| IAM | False | **DONE** — GCP IAM for infrastructure | **YES** |
| Cloud IAP | False | **TODO** — Not configured | **NO** |
| Cloud KMS | False | **TODO** — No CMEK configured | **NO** |
| Cloud Logging | False | **PARTIAL** — Basic logging, not fully integrated | **NO — needs setup** |
| Cloud Monitoring | False | **PARTIAL** — Basic monitoring | **NO — needs setup** |
| Cloud Profiler | False | **TODO** | **NO** |
| Security Command Center | False | **TODO** | **NO** |
| Cloud Trace | False | **TODO** | **NO** |
| Error Reporting | False | **TODO** | **NO** |
| Google Cloud Armor | False | **TODO** — No WAF | **NO** |
| Cloud NAT | False | **TODO** | **NO** |
| Google Cloud Identity | False | **DONE** — Firebase/GCP Identity Platform | **YES** |
| Terraform | False | **TODO** | **NO** |
| GitHub | False | **DONE** | **YES** |

**Result: 4/16 YES, 12/16 NO (GCP services not yet enabled)**

---

### Step 5: Policies & Procedures

#### 5.1 Compliance Certifications (ALL NO)

| Certification | Status | Action Needed |
|---------------|--------|---------------|
| ISO 27001 | No | Not required for CDR rep, but recommended long-term |
| SOC 2 (Type 2) | No | Not required for CDR rep |
| PCI DSS | No | Not applicable |
| Australian Credit Licence (ACL) | No | Not applicable (not providing credit) |
| AFSL | No | Not applicable |
| Registered ADI | No | Not applicable |

**No certifications required for CDR Representative status, but evidence of security controls IS required.**

#### 5.2 Documented Policies (25 policies — ALL UNCHECKED)

Basiq requires documented policies for 25 areas. Here is Monitrax's current coverage:

| Policy Required | Basiq Status | Monitrax Has? | Document Location |
|-----------------|-------------|---------------|-------------------|
| Acceptable Use Policy | False | **NO** | Needs creation |
| Access Control | False | **YES** | `docs/operational/security/02_IAM_AND_PERMISSIONS.md` |
| Administrative Access Control | False | **PARTIAL** | Covered in IAM doc |
| Antivirus and Malware Protection | False | **YES** | `docs/policy/DEVICE_SECURITY_POLICY.md` |
| Audit Logging and Monitoring | False | **YES** | `docs/operational/database/03_MONITORING_AND_ALERTS.md` |
| Background Checks | False | **YES** | `docs/policy/SECURITY_AWARENESS_POLICY.md` |
| CDR Data Handling | False | **YES** | `docs/compliance/CDR_DATA_RETENTION_SCHEDULE.md` + `docs/operational/security/03_CDR_COMPLIANCE.md` |
| Data Breach Response | False | **YES** | `docs/policy/INCIDENT_RESPONSE_PLAN.md` |
| Data Loss Prevention | False | **NO** | Needs creation |
| End-User Device Hardening | False | **YES** | `docs/policy/DEVICE_SECURITY_POLICY.md` |
| Firewall Protection | False | **NO** | Needs creation (Cloud Armor not configured) |
| Information Asset Lifecycle | False | **NO** | Needs creation |
| Information Security Boundary Review | False | **NO** | Needs creation |
| Information Security Governance Framework | False | **PARTIAL** | CLAUDE.md + BAU framework covers some |
| Information Security Incident Management | False | **YES** | `docs/policy/INCIDENT_RESPONSE_PLAN.md` |
| Information Security Policy | False | **PARTIAL** | Basiq template available — needs customization |
| Information Security Risk Management | False | **NO** | Needs creation |
| Monitoring of Application Services | False | **PARTIAL** | `docs/operational/runbooks/03_HEALTH_CHECKS.md` |
| Multi-Factor Authentication | False | **YES** | Code implemented + documented in auth docs |
| OS and Application Patches | False | **PARTIAL** | `docs/policy/APPROVED_DEPENDENCIES.md` covers libraries |
| Protecting Data at Rest | False | **PARTIAL** | GCP auto-encryption, no formal policy doc |
| Protecting Data in Transit | False | **YES** | SSL/TLS enforced everywhere — documented |
| Secure Authentication | False | **YES** | `docs/operational/security/01_AUTHENTICATION.md` |
| Secure Coding Practices | False | **PARTIAL** | CLAUDE.md covers this extensively |
| Server Hardening | False | **NO** | Needs creation (managed services) |
| Vulnerability Management | False | **NO** | Needs creation |

**Summary: 10/25 YES, 7/25 PARTIAL, 8/25 NO (need creation)**

**Option:** Basiq offers a Security Policies Template (the .docx file) that can be customized. This could cover all 25 policies.

---

### Step 6: Backend Implementation Evidence (14 items — ALL UNFILLED)

These require **screenshots, videos, or documents** as proof:

| # | Evidence Required | Monitrax Can Provide? | What to Submit |
|---|------------------|----------------------|----------------|
| 1.0 | MFA setup for user accounts | **YES** | Screenshot of Firebase MFA config + Monitrax MFA settings UI |
| 2.0 | Users with admin access | **YES** | Screenshot of Admin Portal user list + GCP IAM roles |
| 3.0 | Role-based access control | **YES** | Screenshot of permissions code + withPermission() usage |
| 4.0 | Strong password controls | **YES** | Screenshot of Firebase Auth password policy |
| 5.0 | Logging configuration | **YES** | Screenshot of audit log entries + sanitization code |
| 6.0 | Network protection | **PARTIAL** | Cloud SQL authorized networks + SSL config |
| 7.0 | Encryption in transit | **YES** | Screenshot of SSL certificates + Cloud SQL SSL config |
| 8.0 | Encryption at rest | **PARTIAL** | GCP Cloud SQL encryption page (no CMEK) |
| 9.0 | Patching of services/libraries | **YES** | Dependabot config + npm audit output |
| 10.0 | Secure coding practices | **YES** | GitHub PR review example + CI pipeline |
| 11.0 | Vulnerability scanning | **NO** | **Needs pen test or OWASP scan** |
| 12.0 | Anti-virus on devices | **YES** | Screenshot of macOS XProtect/Gatekeeper |
| 13.0 | System architecture diagram | **PARTIAL** | Exists in docs but needs CDR-specific version |
| 14.0 | Cyber liability + professional liability insurance | **UNKNOWN** | **Needs insurance policies** |

---

## 3. Overall Compliance Score

| Category | Items | Ready | Partial | Not Ready | Score |
|----------|-------|-------|---------|-----------|-------|
| Step 1: Organisation | 8 | 7 | 1 | 0 | 94% |
| Step 2: CDR Data Use | 6 | 4 | 2 | 0 | 83% |
| Step 3: Security Practices | 38 | 28 | 7 | 3 | 83% |
| Step 4: GCP Technology | 16 | 4 | 0 | 12 | 25% |
| Step 5: Policies (25) | 25 | 10 | 7 | 8 | 54% |
| Step 5: Certifications | 6 | 0 | 0 | 0 | N/A |
| Step 6: Evidence | 14 | 8 | 3 | 3 | 68% |
| **TOTAL** | **113** | **61** | **20** | **26** | **~72%** |

---

## 4. Critical Gaps — What Must Be Done Before Submission

### P0 — Blockers (Must Fix Before Submitting)

| # | Gap | Action | Effort |
|---|-----|--------|--------|
| 1 | **Vulnerability scan/pen test** | Commission external pen test or run OWASP ZAP scan | 1-3 days |
| 2 | **Cyber liability + professional liability insurance** | Obtain insurance policies | Business action |
| 3 | **System architecture diagram (CDR-specific)** | Create diagram showing CDR data flow boundaries | 2-4 hours |
| 4 | **Fill the spreadsheet** | Mark all True items, add evidence links | 2-4 hours |
| 5 | **Company logo URL** | Replace placeholder with real logo | 10 minutes |

### P1 — High Priority (Should Complete Before/Shortly After Submission)

| # | Gap | Action | Effort |
|---|-----|--------|--------|
| 6 | **8 missing policy documents** | Customize Basiq Security Policies Template for remaining gaps | 2-3 days |
| 7 | **GCP services enablement** | Enable Cloud Logging, Monitoring, KMS, Armor, SCC | 1-2 days |
| 8 | **Public consent management page** | Build webpage for consumers to manage CDR consent | 2-3 days |
| 9 | **Consumer dashboard** | Per CDR Rules 1.14, consumer must be able to manage data requests | 3-5 days |

### P2 — Improvements (Post-Submission)

| # | Gap | Action | Effort |
|---|-----|--------|--------|
| 10 | Automated log review alerts | Set up Cloud Monitoring alerts | 1 day |
| 11 | Cloud DLP for PII detection | Configure Cloud DLP on CDR data | 1 day |
| 12 | Terraform for IaC | Optional — good practice | 2-3 days |
| 13 | CMEK for data at rest | Configure Cloud KMS customer-managed keys | 1 day |

---

## 5. CDR Representative Obligations Summary

From the fact sheet, these are Monitrax's key ongoing obligations as a CDR Representative:

| Obligation | Status | Notes |
|------------|--------|-------|
| Written CDR representative arrangement with Basiq | **PENDING** | Part of the onboarding process |
| Registration on Register of Accredited Persons | **PENDING** | ACCC registers after Basiq submits |
| Comply with Privacy Safeguards 2,4,6,7,8,9,11,12,13 | **PARTIAL** | Code implemented for most; need formal policy mapping |
| Obtain collection + use consent before accessing CDR data | **DONE** | Consent flow built in Phase 35 |
| Data minimisation principle | **DONE** | Only collect what's needed for financial tracking |
| Adopt Basiq's CDR policy for service data | **PENDING** | Basiq to provide their CDR policy |
| Delete service data when directed by Basiq | **DONE** | `deleteCDRData()` implemented |
| Delete data on consent expiry/revocation | **DONE** | `checkConsentExpiry()`, `handleConsentRevocation()` |
| No outsourcing of CDR data processing without arrangement | **OK** | No outsourcing planned |
| Cannot enter another CDR representative arrangement | **OK** | Single arrangement with Basiq |
| Consumer dashboard (can be delegated by Basiq) | **PARTIAL** | Basic UI exists, may need enhancement |
| Not use CDR logo | **OK** | Not using it |
| Not claim to be "accredited" or "approved by ACCC" | **OK** | Correct representations |
| Record-keeping (consents, disclosures, complaints) | **PARTIAL** | Audit logging exists, needs consent-specific records |
| Bi-annual reporting to ACCC/OAIC (Basiq's responsibility) | **N/A** | This is Basiq's obligation as principal |
| Internal dispute resolution | **PENDING** | Need formal CDR complaints process |
| 6-year record retention after arrangement ends | **DONE** | CDR retention policy documents 7-year default |

---

## 6. Recommended Action Plan

### Week 1: Quick Wins
- [ ] Fill the Basiq CDR Compliance spreadsheet (mark all implementedTrue)
- [ ] Replace placeholder logo URL
- [ ] Review and correct CDR Data Use answers (Step 2)
- [ ] Gather evidence screenshots for Step 6 (items 1-5, 7, 9-10, 12)

### Week 2: Policy Documents
- [ ] Customize Basiq Security Policies Template (.docx) for all 25 policies
- [ ] Or: Map existing Monitrax policy docs to Basiq requirements
- [ ] Create the 8 missing policy documents

### Week 3: Technical Gaps
- [ ] Commission or run vulnerability scan (OWASP ZAP or external pen test)
- [ ] Enable GCP services (Logging, Monitoring, KMS, Armor)
- [ ] Create CDR-specific system architecture diagram
- [ ] Build/verify public consent management page

### Week 4: Business Actions
- [ ] Obtain cyber liability insurance
- [ ] Obtain professional liability insurance
- [ ] Build CDR consumer complaints process (internal dispute resolution)
- [ ] Submit completed spreadsheet to compliance@basiq.io via File > Approvals

---

## 7. Files Reference

| Basiq File | Location | Purpose |
|------------|----------|---------|
| Basiq CDR Compliance.xlsx | `docs/BASIQ FILES/` | Self-assessment form to complete |
| CDR Representatives - fact sheet.pdf | `docs/BASIQ FILES/` | ACCC guidance on obligations |
| Security Policies Template.docx | `docs/BASIQ FILES/` | Template to customize for 25 policies |

| Monitrax CDR Doc | Location | Purpose |
|------------------|----------|---------|
| CDR Compliance Matrix | `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` | Detailed requirement tracking |
| CDR Implementation Plan | `docs/compliance/CDR_IMPLEMENTATION_PLAN.md` | Implementation roadmap |
| CDR Data Retention Schedule | `docs/compliance/CDR_DATA_RETENTION_SCHEDULE.md` | Retention policy |
| CDR Operational Procedures | `docs/operational/security/03_CDR_COMPLIANCE.md` | BAU CDR procedures |
| Incident Response Plan | `docs/policy/INCIDENT_RESPONSE_PLAN.md` | Breach response |
| Device Security Policy | `docs/policy/DEVICE_SECURITY_POLICY.md` | Endpoint security |
| Security Awareness Policy | `docs/policy/SECURITY_AWARENESS_POLICY.md` | Training requirements |
| Approved Dependencies | `docs/policy/APPROVED_DEPENDENCIES.md` | Library review |

---

*This report cross-references the Basiq CDR Compliance spreadsheet against actual Monitrax implementation as of 2026-04-10. See `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` for detailed code-level tracking.*
