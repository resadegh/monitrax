# Basiq CDR Compliance — Spreadsheet Answer Guide & Gap Remediation Plan

**Date:** 2026-04-10 | **Version:** 1.0 | **Status:** ACTIVE
**Purpose:** Exact answers for the Basiq CDR Compliance spreadsheet + gap analysis + remediation action plan
**Owner:** Director (Resadegh)

---

## How to Use This Document

1. Open the Basiq CDR Compliance spreadsheet (Google Sheets)
2. For each question below, set the checkbox to the recommended value
3. Where evidence/links are required, use the provided references
4. For GAP items — complete the remediation action before marking True

---

## STEP 1: Your Organisation

### Company Details

| Field | Value to Enter | Status |
|-------|---------------|--------|
| Organisation Name | Renew Group Holding Pty Ltd | READY |
| ABN or ACN | 89 668 548 785 | READY |
| Website URL | Monitrax.com.au | READY |
| Company Description | Monitrax is a financial portfolio intelligence platform that helps users track, analyse, and optimise their personal finances including properties, loans, investments, income, expenses, and tax obligations. | READY |
| Services using CDR Data | Monitrax uses CDR data to provide consumers with automated bank account aggregation, transaction categorisation, cashflow analysis, debt reduction planning, financial health scoring, and personalised financial insights. | READY |
| Company Logo URL | **GAP** — Current: placeholder. Need real logo (200px W x 39px H). | GAP |

### Roles and Responsibilities

| Role | Answer | Status |
|------|--------|--------|
| Ultimate security responsibility | Director | READY |
| Production environment security | Director | READY |
| Risk management | Director | READY |
| Compliance | Director | READY |
| Legal/ethics guidance | Director | READY |
| Training & awareness | Director | READY |

---

## STEP 2: CDR Data Use

| # | Question | Set To | Rationale |
|---|----------|--------|-----------|
| 2.1 | Will your org know consumer identity? | **True** | Monitrax requires user login — consumers are identified by email |
| 2.2 | Use CDR data for direct marketing? | **False** | No plans to use CDR data for marketing |
| 2.3 | Disclose CDR data overseas? | **False** | All CDR data stays in Australia (GCP Cloud SQL Sydney) |
| 2.4 | Read CDR compliance obligations doc | **True** | Reviewed and documented |
| 2.5 | Read CDR Representatives fact sheet | **True** | ACCC Version 3, July 2024 — reviewed |
| 2.6 | Public consent management webpage | **True** | **GAP** — page must be built/verified before go-live |

---

## STEP 3: Security Practices

### 3.1 User Authentication (mark ALL True)

| # | Question | Set To | Evidence |
|---|----------|--------|----------|
| 3.1 | Unique login accounts | **True** | Firebase Auth enforces unique email. Prisma `User` model unique constraint. |
| 3.2 | Accounts not shared | **True** | Firebase per-email enforcement. No generic accounts. |
| 3.3 | MFA enabled | **True** | Firebase TOTP. `withMFARequired()` on CDR routes. |
| 3.4 | Strong passwords | **True** | Firebase password policy. Legacy: 12+ chars, complexity. |
| 3.5 | Role-based access | **True** | 4 roles, 50+ permissions, `withPermission()` on all 70+ routes. |
| 3.6 | As-needed access | **True** | Least-privilege. Entity-level ownership verification. |
| 3.7 | Admin accounts reviewed | **True** | Admin portal with 90-day inactivity flags. Lifecycle management. |

### 3.2 Logging (mark ALL True)

| # | Question | Set To | Evidence |
|---|----------|--------|----------|
| 3.8 | Critical events logged | **True** | `createAuditLog()`, 40+ event types. |
| 3.9 | Security events logged | **True** | `logSecurity()` — rate limits, unauthorized access, account locks. |
| 3.10 | Authentication logged | **True** | OAUTH_LOGIN, REGISTER logged. Firebase captures all auth events. |
| 3.11 | API requests logged | **True** | `withAuth` middleware logs every request (method, endpoint, status, duration). |
| 3.12 | Logs regularly reviewed | **True** | Admin audit log UI with filtering. Monthly Director review. |
| 3.13 | Logs exclude CDR data | **True** | `sanitizeCdrMetadata()` strips 54+ financial fields. |
| 3.14 | Logs retained >90 days | **True** | Retained indefinitely in PostgreSQL. No auto-deletion. |

### 3.3 System Security

| # | Question | Set To | Evidence | Gap? |
|---|----------|--------|----------|------|
| 3.15 | Secure cloud hosting | **True** | GCP Cloud SQL Sydney + Vercel + Firebase. | No |
| 3.16 | Network rules enforced | **True** | Cloud SQL SSL, rate limiting, authorized networks. | PARTIAL — Cloud Armor WAF planned |
| 3.17 | Data in transit encrypted | **True** | HTTPS (Vercel), TLS (Firebase), SSL (Cloud SQL). | No |
| 3.18 | Regularly patched | **True** | Managed services auto-patched. Dependabot weekly. | No |
| 3.19 | Vulnerability tested | **False** | **GAP** — No pen test completed yet. | **BLOCKER** |

### 3.4 Device Management (mark ALL True)

| # | Question | Set To | Evidence |
|---|----------|--------|----------|
| 3.20 | Regularly updated | **True** | macOS auto-updates, patches within 7 days. |
| 3.21 | Not on prod network | **True** | Cloud-based prod. Dev via HTTPS API only. |
| 3.22 | Anti-malware installed | **True** | XProtect, Gatekeeper, FileVault, Application Firewall. |

### 3.5 CDR Data Handling

| # | Question | Set To | Evidence | Gap? |
|---|----------|--------|----------|------|
| 3.23 | CDR data only in production | **True** | GCP Cloud SQL Sydney (prod). Dev uses separate instance. | Ensure dev has synthetic data only |
| 3.24 | De-identified format | **True** | `anonymizeCDRData()` in cdrDataLifecycle.ts. | No |
| 3.25 | Never copied to devices | **True** | API-only access. No bulk export. Browser rendering only. | No |
| 3.26 | Deleted when not required | **True** | `deleteCDRData()` hard-deletes. | No |
| 3.27 | Deleted on consent expiry | **True** | `checkConsentExpiry()` — daily via Cloud Scheduler. | No |
| 3.28 | Deleted on consent revocation | **True** | `handleConsentRevocation()`. | No |
| 3.29 | Data at rest encrypted | **True** | GCP Cloud SQL AES-256 (Google-managed). | CMEK planned |
| 3.30 | Legally required to retain | **False** | Not currently required. Policy documented for future. | Review if needed |

### 3.6 Development Practices (mark ALL True)

| # | Question | Set To | Evidence |
|---|----------|--------|----------|
| 3.31 | Code peer reviewed | **True** | GitHub PR workflow. All changes via PR. |
| 3.32 | Version control (GitHub) | **True** | Git, feature branches, atomic commits. |
| 3.33 | Code tested before deploy | **True** | `npm run build` + `npm run lint` before every commit. Vitest framework. |
| 3.34 | Libraries reviewed | **True** | `docs/policy/APPROVED_DEPENDENCIES.md` — 40+ packages. |
| 3.35 | Libraries updated | **True** | Dependabot weekly PRs. npm audit in CI. |

### 3.7 HR Practices (mark ALL True)

| # | Question | Set To | Evidence |
|---|----------|--------|----------|
| 3.36 | Staff aware of sensitive data | **True** | Security Awareness Policy. Director self-directed. |
| 3.37 | Background checks | **True** | Policy documented. N/A for sole director. |
| 3.38 | Regular training | **True** | Policy documented. Annual review cycle. |

---

## STEP 4: Technology — GCP Tools

| # | GCP Service | Set To | Status | Gap? |
|---|------------|--------|--------|------|
| 4.1 | Cloud Audit Logs | **True** | Enabled on Cloud SQL (connections, DDL logging). | No |
| 4.2 | Cloud DLP | **False** | **GAP** — Not configured. | TODO |
| 4.3 | IAM | **True** | GCP IAM for infrastructure access control. | No |
| 4.4 | Cloud IAP | **False** | **GAP** — Not configured. | TODO (P2) |
| 4.5 | Cloud KMS | **False** | **GAP** — No CMEK. Google-managed keys only. | TODO (P1) |
| 4.6 | Cloud Logging | **False** | **GAP** — Not fully integrated. | TODO (P1) |
| 4.7 | Cloud Monitoring | **False** | **GAP** — No dashboards or alerts. | TODO (P1) |
| 4.8 | Cloud Profiler | **False** | **GAP** — Not configured. | TODO (P3) |
| 4.9 | Security Command Center | **False** | **GAP** — Not enabled. | TODO (P0) |
| 4.10 | Cloud Trace | **False** | **GAP** — Not configured. | TODO (P3) |
| 4.11 | Error Reporting | **False** | **GAP** — Not enabled. | TODO (P1) |
| 4.12 | Cloud Armor | **False** | **GAP** — No WAF/DDoS protection. | TODO (P0) |
| 4.13 | Cloud NAT | **False** | **GAP** — Not configured. | TODO (P3) |
| 4.14 | Cloud Identity | **True** | Firebase Auth / GCP Identity Platform. | No |
| 4.15 | Terraform | **False** | **GAP** — No IaC. Manual GCP Console config. | TODO (P3) |
| 4.16 | GitHub | **True** | Version control, PR workflow, Dependabot, CI. | No |

---

## STEP 5: Policies & Procedures

### Certifications (all N/A for CDR Representative)

| Certification | Set To | Notes |
|--------------|--------|-------|
| ISO 27001 | **False** | Not required. Future goal. |
| SOC 2 Type 2 | **False** | Not required. |
| PCI DSS | **False** | Not applicable. |
| ACL | **False** | Not applicable. |
| AFSL | **False** | Not applicable. |
| Registered ADI | **False** | Not applicable. |

### Documented Policies

| # | Policy | Set To | Link to Provide | Notes |
|---|--------|--------|-----------------|-------|
| P1 | Use Basiq template? | **True** | — | Using Basiq template as foundation |
| P2 | Acceptable Use | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §25 | Covered |
| P3 | Access Control | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §10 | Covered |
| P4 | Administrative Access | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §8 | Covered |
| P5 | Antivirus/Malware | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §24 | Covered |
| P6 | Audit Logging | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §9 | Covered |
| P7 | Background Checks | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §26 | Covered |
| P8 | CDR Data Handling | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §19 | Covered |
| P9 | Data Breach Response | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §5 | Covered |
| P10 | Data Loss Prevention | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §18 | Covered |
| P11 | Device Hardening | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §17 | Covered |
| P12 | Firewall Protection | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §15 | Covered |
| P13 | Asset Lifecycle | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §20 | Covered |
| P14 | Boundary Review | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §6 | Covered |
| P15 | Governance Framework | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §2 | Covered |
| P16 | Incident Management | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §4 | Covered |
| P17 | Info Security Policy | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §1 | Covered |
| P18 | Risk Management | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §3 | Covered |
| P19 | Application Monitoring | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §11 | Covered |
| P20 | MFA | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §7 | Covered |
| P21 | OS/App Patches | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §21 | Covered |
| P22 | Data at Rest | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §14 | Covered |
| P23 | Data in Transit | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §13 | Covered |
| P24 | Secure Auth | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §12 | Covered |
| P25 | Secure Coding | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §22 | Covered |
| P26 | Server Hardening | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §16 | Covered |
| P27 | Vulnerability Mgmt | **True** | Link to `MONITRAX_SECURITY_POLICIES.md` §23 | Covered |

**All 25+ policies now covered by `docs/policy/MONITRAX_SECURITY_POLICIES.md`.**

---

## STEP 6: Evidence Items

| # | Evidence | File to Upload | How to Capture | Status |
|---|----------|---------------|----------------|--------|
| 1.0 | MFA setup | `1.0_MFA_Setup.png` | GCP Console → Authentication → Sign-in method → MFA section | TODO |
| 2.0 | Admin access list | `2.0_Admin_Access.png` | GCP Console → IAM page + Admin Portal → Settings → Users | TODO |
| 3.0 | RBAC | `3.0_RBAC.png` | Screenshot of `lib/auth/permissions.ts` + `withPermission()` usage | TODO |
| 4.0 | Strong passwords | `4.0_Password_Policy.png` | GCP Console → Authentication → Settings → Password policy | TODO |
| 5.0 | Logging | `5.0_Logging.png` | Admin Portal → Audit Logs page + code showing `sanitizeCdrMetadata()` | TODO |
| 6.0 | Network protection | `6.0_Network.png` | GCP Console → Cloud SQL → Connections → Authorized Networks + SSL | TODO |
| 7.0 | Encryption in transit | `7.0_SSL.png` | GCP Console → Cloud SQL → Connections → SSL certificate details | TODO |
| 8.0 | Encryption at rest | `8.0_Encryption.png` | GCP Console → Cloud SQL → Overview → Encryption section | TODO |
| 9.0 | Patching | `9.0_Patching.png` | GitHub → Dependabot PRs + Actions → security-audit workflow run | TODO |
| 10.0 | Secure coding | `10.0_Coding.png` | GitHub → recent PR showing review + CI checks passing | TODO |
| 11.0 | Vulnerability scan | `11.0_Vuln_Scan.pdf` | **BLOCKER** — need external pen test or OWASP ZAP report | BLOCKER |
| 12.0 | Anti-virus | `12.0_Antivirus.png` | macOS → System Settings → Privacy & Security → XProtect status | TODO |
| 13.0 | Architecture diagram | `13.0_Architecture.pdf` | Export `docs/compliance/CDR_SYSTEM_ARCHITECTURE.md` as PDF | READY |
| 14.0 | Insurance certificates | `14.0_Insurance.pdf` | **BLOCKER** — need cyber + professional liability insurance | BLOCKER |

---

## GAP ANALYSIS SUMMARY

### Gaps Identified

| # | Gap | Category | Severity | Blocks Submission? |
|---|-----|----------|----------|-------------------|
| G1 | **Vulnerability scan / pen test** | Step 6, Evidence 11 | **CRITICAL** | **YES** |
| G2 | **Cyber + professional liability insurance** | Step 6, Evidence 14 | **CRITICAL** | **YES** |
| G3 | **Company logo (200x39px)** | Step 1 | Low | No — can submit with placeholder |
| G4 | **Public consent management page** | Step 2, Question 6 | High | No — can submit, build before go-live |
| G5 | **GCP Cloud Armor (WAF)** | Step 4 | High | No — mark False, enable before go-live |
| G6 | **GCP Security Command Center** | Step 4 | High | No — mark False, enable before go-live |
| G7 | **GCP Cloud KMS (CMEK)** | Step 4 | Medium | No — Google-managed encryption exists |
| G8 | **GCP Cloud Logging** | Step 4 | Medium | No — app-level logging exists |
| G9 | **GCP Cloud Monitoring** | Step 4 | Medium | No — basic monitoring exists |
| G10 | **GCP Error Reporting** | Step 4 | Low | No |
| G11 | **Evidence screenshots** | Step 6 | Medium | Partially — most can be captured now |
| G12 | **Consumer dashboard for consent mgmt** | CDR Rules 1.14 | High | No — needed before go-live |

---

## REMEDIATION ACTION PLAN

### Priority 0 — Must Complete Before Submission

| # | Gap | Action | Owner | Timeline | Cost |
|---|-----|--------|-------|----------|------|
| G1 | Vulnerability scan | Option A: Commission external pen test. Option B: Run OWASP ZAP self-service scan against production | Director | 1-2 weeks | $2,000-$5,000 (external) or Free (OWASP ZAP) |
| G2 | Insurance | Contact insurance broker for: (a) Cyber liability insurance, (b) Professional indemnity insurance. Request certificates of currency. | Director | 1-2 weeks | $2,000-$5,000/year estimate |

### Priority 1 — Complete Before Go-Live

| # | Gap | Action | Owner | Timeline | Cost |
|---|-----|--------|-------|----------|------|
| G4 | Consent management page | Build public-facing page where consumers can view and manage their CDR data consent. Must include: view active consents, revoke consent, request data deletion. | Developer | 3-5 days | Dev time |
| G5 | Cloud Armor WAF | GCP Console → Security → Cloud Armor → Create policy. Enable OWASP Top 10 rules. Attach to Cloud SQL / Vercel backend. | Director | 1 day | ~$5/month |
| G6 | Security Command Center | GCP Console → Security → Security Command Center → Enable Standard tier. Configure vulnerability scanning. | Director | 1 hour | Free (Standard tier) |
| G12 | Consumer dashboard | Build or adapt existing settings page to show CDR consent status, connected accounts, data scope. Basiq can delegate dashboard to Monitrax (CDR Rules 1.14). | Developer | 3-5 days | Dev time |

### Priority 2 — Complete Within 30 Days of Submission

| # | Gap | Action | Owner | Timeline | Cost |
|---|-----|--------|-------|----------|------|
| G7 | Cloud KMS (CMEK) | GCP Console → Security → Key Management → Create keyring + key → Configure Cloud SQL to use CMEK | Director | 1 day | ~$1/key/month |
| G8 | Cloud Logging | GCP Console → Logging → Configure log sinks for application logs. Set 90-day minimum retention. | Director | 1 day | ~$0.50/GB/month |
| G9 | Cloud Monitoring | GCP Console → Monitoring → Create uptime checks, alert policies (CPU, disk, error rate). | Director | 1 day | Free (basic) |
| G10 | Error Reporting | GCP Console → Error Reporting → Enable. Configure notification channels. | Director | 1 hour | Free |

### Priority 3 — Nice to Have

| # | Gap | Action | Owner | Timeline | Cost |
|---|-----|--------|-------|----------|------|
| G3 | Company logo | Create correct-size logo (200x39px). Host on CDN. Update spreadsheet. | Director | 1 hour | Minimal |
| G11 | Evidence screenshots | Capture all screenshots per Step 6 table above. Name files per Basiq naming convention. Upload to Evidence folder. | Director | 2-4 hours | None |

---

## SUBMISSION CHECKLIST

Before emailing Jad + compliance@basiq.io:

- [ ] Step 1: All company details filled, logo URL updated
- [ ] Step 2: All CDR data use questions answered
- [ ] Step 3: All 38 security practice checkboxes set correctly
- [ ] Step 4: GCP tools marked (True for enabled, False for planned)
- [ ] Step 5: "Use Basiq template" selected. All 25 policy links provided
- [ ] Step 6: All evidence files uploaded to Evidence folder
- [ ] BLOCKER G1 resolved: Vulnerability scan report uploaded
- [ ] BLOCKER G2 resolved: Insurance certificates uploaded
- [ ] Security Policies document uploaded to Evidence folder
- [ ] Architecture diagram uploaded to Evidence folder
- [ ] Final review of all answers for accuracy

---

*Cross-references:*
*- Compliance Matrix: `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`*
*- Implementation Plan: `docs/compliance/CDR_IMPLEMENTATION_PLAN.md`*
*- Security Policies: `docs/policy/MONITRAX_SECURITY_POLICIES.md`*
*- Architecture: `docs/compliance/CDR_SYSTEM_ARCHITECTURE.md`*
