# Basiq CDR Compliance — Evidence Screenshot Guide

**Date:** 2026-04-10 | **Version:** 1.0 | **Status:** ACTIVE
**Purpose:** Step-by-step instructions for capturing all 14 evidence items required by Basiq (Step 6)
**Owner:** Director (Resadegh)

---

## Before You Start

### File Naming Convention
Name each file exactly as shown below so Basiq can match it to the spreadsheet:
```
1.0_MFA_Setup.png
2.0_Admin_Access.png
3.0_RBAC.png
...
```

### Upload Location
Upload all evidence files to the **"Evidence" folder** in the shared Google Drive link provided by Jad.

### Screenshot Tips
- Use full-screen captures where possible (Cmd+Shift+3 on Mac, or Cmd+Shift+4 to select area)
- Ensure sensitive data (real user emails, passwords) is redacted/blurred before uploading
- If a single screenshot can't capture everything, take multiple and number them (e.g., `1.0_MFA_Setup_1.png`, `1.0_MFA_Setup_2.png`)
- Alternatively, record a short narrated screen recording (QuickTime → New Screen Recording)

---

## Evidence 1.0 — MFA Setup for User Accounts

**Covers spreadsheet requirements:** Step 3.1 → **3.3 MFA enabled**, 3.4 Strong passwords
**What Basiq wants to see:** Proof that MFA is enabled and enforced for accounts accessing CDR data.

### Screenshots needed:

**Screenshot 1A — Firebase MFA Configuration:**
1. Go to https://console.firebase.google.com
2. Select the Monitrax project
3. Navigate to **Authentication** → **Sign-in method**
4. Scroll to the **Multi-factor authentication** section
5. Screenshot showing MFA is **Enabled** with TOTP selected
6. Save as `1.0_MFA_Setup_Firebase.png`

**Screenshot 1B — Monitrax MFA Settings UI:**
1. Log into Monitrax as a user
2. Go to **Settings** → **Security**
3. Screenshot the MFA enrollment section showing TOTP setup option
4. Save as `1.0_MFA_Setup_App.png`

**Screenshot 1C — MFA Enforcement in Code:**
1. Open `lib/auth/guards.ts` in your editor/GitHub
2. Screenshot the `withMFARequired()` function definition
3. Save as `1.0_MFA_Enforcement_Code.png`

---

## Evidence 2.0 — Users with Admin Access

**Covers spreadsheet requirements:** Step 3.1 → **3.5 Role-based access**, **3.6 As-needed access**, **3.7 Admin accounts reviewed**
**What Basiq wants to see:** A list of users who have privileged access to CDR-relevant systems.

### Screenshots needed:

**Screenshot 2A — GCP IAM Roles:**
1. Go to https://console.cloud.google.com
2. Navigate to **IAM & Admin** → **IAM**
3. Screenshot the list of IAM members and their roles
4. Save as `2.0_Admin_Access_GCP_IAM.png`

**Screenshot 2B — Monitrax Admin Portal Users:**
1. Log into Monitrax Admin Portal (`/admin`)
2. Navigate to **Settings** → **Users** tab
3. Screenshot the admin user list showing: name, email, role, status, last login
4. Save as `2.0_Admin_Access_Portal.png`

**Screenshot 2C — Firebase Auth Users:**
1. Go to Firebase Console → **Authentication** → **Users** tab
2. Screenshot showing user list (redact email addresses if real users)
3. Save as `2.0_Admin_Access_Firebase.png`

---

## Evidence 3.0 — Role-Based Access Control

**Covers spreadsheet requirements:** Step 3.1 → **3.5 Role-based access**, **3.6 As-needed access**
**What Basiq wants to see:** Proof that RBAC restricts access to CDR data based on roles and permissions.

### Screenshots needed:

**Screenshot 3A — Permission Definitions:**
1. Open `lib/auth/permissions.ts` in your editor or on GitHub
2. Screenshot showing the permission types and role-permission mappings
3. Save as `3.0_RBAC_Permissions.png`

**Screenshot 3B — Guard Usage on API Route:**
1. Open any API route file, e.g., `app/api/basiq/connections/route.ts`
2. Screenshot showing `withMFARequired()` or `withPermission()` wrapping the handler
3. Save as `3.0_RBAC_Guard_Usage.png`

**Screenshot 3C — Roles in Database Schema:**
1. Open `prisma/schema.prisma` in your editor
2. Screenshot the `Role` enum and `User` model showing role field
3. Save as `3.0_RBAC_Schema.png`

---

## Evidence 4.0 — Strong Password Controls

**Covers spreadsheet requirements:** Step 3.1 → **3.4 Strong passwords**
**What Basiq wants to see:** Configuration showing password complexity requirements.

### Screenshots needed:

**Screenshot 4A — Firebase Password Policy:**
1. Go to Firebase Console → **Authentication** → **Settings**
2. Navigate to **Password policy** section
3. Screenshot showing minimum length, complexity requirements
4. Save as `4.0_Password_Policy_Firebase.png`

**Screenshot 4B — Admin Password Requirements (if visible in code):**
1. Open `lib/admin/constants.ts` on GitHub
2. Screenshot showing password requirements (12+ chars, complexity)
3. Save as `4.0_Password_Policy_Admin.png`

---

## Evidence 5.0 — Logging Configuration

**Covers spreadsheet requirements:** Step 3.2 → **3.8 Critical events logged**, **3.9 Security events logged**, **3.10 Auth logged**, **3.11 API requests logged**, **3.13 Logs exclude CDR data**, **3.14 Logs retained >90 days**
**What Basiq wants to see:** Proof that critical events are logged and CDR data is excluded from logs.

### Screenshots needed:

**Screenshot 5A — Audit Log Entries:**
1. Log into Monitrax Admin Portal → **Audit Logs**
2. Screenshot the audit log list showing event types, timestamps, users, statuses
3. Save as `5.0_Logging_AuditLog.png`

**Screenshot 5B — CDR Data Sanitization Code:**
1. Open `lib/security/cdrAuditCompliance.ts` on GitHub
2. Screenshot the `sanitizeCdrMetadata()` function showing redacted field list
3. Save as `5.0_Logging_Sanitization.png`

**Screenshot 5C — Cloud SQL Audit Logging Flags:**
1. Go to GCP Console → **Cloud SQL** → select production instance
2. Navigate to **Configuration** → **Flags**
3. Screenshot showing: `log_connections=on`, `log_disconnections=on`, `log_statement=ddl`
4. Save as `5.0_Logging_CloudSQL_Flags.png`

---

## Evidence 6.0 — Network Protection

**Covers spreadsheet requirements:** Step 3.3 → **3.16 Network rules enforced**
**What Basiq wants to see:** Proof that the network hosting CDR data is protected from unnecessary external access.

### Screenshots needed:

**Screenshot 6A — Cloud SQL Authorized Networks:**
1. Go to GCP Console → **Cloud SQL** → select production instance
2. Navigate to **Connections** → **Networking**
3. Screenshot the authorized networks configuration
4. Save as `6.0_Network_AuthorizedNetworks.png`

**Screenshot 6B — Cloud SQL SSL Configuration:**
1. Same page → **Security** section
2. Screenshot showing SSL mode (require SSL, etc.)
3. Save as `6.0_Network_SSL.png`

**Screenshot 6C — Rate Limiting Code (optional):**
1. Open `lib/middleware/apiSecurity.ts` on GitHub
2. Screenshot the rate limiting configuration
3. Save as `6.0_Network_RateLimiting.png`

---

## Evidence 7.0 — Encryption in Transit (SSL)

**Covers spreadsheet requirements:** Step 3.3 → **3.17 Data in transit encrypted**
**What Basiq wants to see:** Proof that CDR data is encrypted in transit.

### Screenshots needed:

**Screenshot 7A — Cloud SQL SSL Certificate:**
1. Go to GCP Console → **Cloud SQL** → production instance
2. Navigate to **Connections** → **Security**
3. Screenshot the SSL certificate details and enforcement status
4. Save as `7.0_SSL_CloudSQL.png`

**Screenshot 7B — Vercel HTTPS:**
1. Go to https://vercel.com/dashboard → Monitrax project
2. Navigate to **Settings** → **Domains**
3. Screenshot showing SSL certificate is active (automatic via Vercel)
4. Save as `7.0_SSL_Vercel.png`

**Screenshot 7C — Database URL with SSL (redacted):**
1. Show the DATABASE_URL format (redact actual credentials):
   `postgresql://user:****@host:5432/db?sslmode=require`
2. Screenshot from Vercel environment variables (redact values, show `sslmode=require`)
3. Save as `7.0_SSL_DatabaseURL.png`

---

## Evidence 8.0 — Encryption at Rest

**Covers spreadsheet requirements:** Step 3.5 → **3.29 CDR data at rest encrypted**
**What Basiq wants to see:** Proof that CDR data is encrypted when stored.

### Screenshots needed:

**Screenshot 8A — Cloud SQL Encryption:**
1. Go to GCP Console → **Cloud SQL** → production instance
2. Navigate to **Overview** or **Configuration**
3. Screenshot showing encryption status (Google-managed encryption or CMEK)
4. Save as `8.0_Encryption_CloudSQL.png`

**Screenshot 8B — Instance Location (Sydney):**
1. Same page — screenshot showing region `australia-southeast1` (Sydney)
2. This also evidences data residency compliance
3. Save as `8.0_Encryption_Region.png`

---

## Evidence 9.0 — Patching of Services and Libraries

**Covers spreadsheet requirements:** Step 3.3 → **3.18 Regularly patched**, Step 3.6 → **3.34 Libraries updated**
**What Basiq wants to see:** Proof that dependencies and services are kept up to date.

### Screenshots needed:

**Screenshot 9A — Dependabot Configuration:**
1. Go to GitHub → Monitrax repo → `.github/dependabot.yml`
2. Screenshot showing Dependabot configuration (weekly npm updates)
3. Save as `9.0_Patching_Dependabot_Config.png`

**Screenshot 9B — Dependabot Pull Requests:**
1. Go to GitHub → Monitrax repo → **Pull Requests** tab
2. Filter by author: `dependabot`
3. Screenshot showing recent Dependabot PRs (dependency update history)
4. Save as `9.0_Patching_Dependabot_PRs.png`

**Screenshot 9C — npm audit CI Pipeline:**
1. Go to GitHub → **Actions** tab → `Security Audit` workflow
2. Screenshot a recent successful run showing `npm audit` output
3. Save as `9.0_Patching_npm_audit.png`

---

## Evidence 10.0 — Secure Coding Practices

**Covers spreadsheet requirements:** Step 3.6 → **3.31 Code peer reviewed**, **3.32 Version control**, **3.33 Code tested**
**What Basiq wants to see:** Proof of code review process and CI/CD pipeline.

### Screenshots needed:

**Screenshot 10A — Pull Request with Review:**
1. Go to GitHub → Monitrax repo → **Pull Requests** → select a recent merged PR
2. Screenshot showing: PR title, description, review comments, approval
3. Save as `10.0_Coding_PR_Review.png`

**Screenshot 10B — CI Pipeline Run:**
1. Same PR → **Checks** tab
2. Screenshot showing CI checks (build, lint, security audit) passing
3. Save as `10.0_Coding_CI_Pipeline.png`

**Screenshot 10C — Branch Protection Rules:**
1. Go to GitHub → **Settings** → **Branches** → Branch protection rules
2. Screenshot showing main branch protection (require PR, require reviews)
3. Save as `10.0_Coding_Branch_Protection.png`

---

## Evidence 11.0 — Vulnerability Scanning

**Covers spreadsheet requirements:** Step 3.3 → **3.19 Tested for security vulnerabilities**
**What Basiq wants to see:** A vulnerability scan or penetration test report.

### BLOCKER — This requires action before you can provide evidence.

### Option A: OWASP ZAP Self-Service Scan (Free)

1. Download OWASP ZAP from https://www.zaproxy.org/download/
2. Install and open ZAP
3. Select **Automated Scan**
4. Enter target URL: `https://monitrax.com.au`
5. Click **Attack** — ZAP will spider the site and test for vulnerabilities
6. When complete, go to **Report** → **Generate HTML Report**
7. Save as `11.0_Vuln_Scan_OWASP_ZAP.html` or export as PDF
8. Review findings — fix any Critical/High issues before submitting

### Option B: External Penetration Test ($2,000-$5,000)

1. Engage a certified pen test provider (e.g., CyberCX, Tesserent, Shearwater)
2. Scope: Web application pen test covering:
   - Authentication and session management
   - API security (all `/api/*` endpoints)
   - CDR data endpoints (`/api/basiq/*`)
   - OWASP Top 10 vulnerabilities
3. Request a formal report with findings and remediation status
4. Upload report as `11.0_Vuln_Scan_PenTest_Report.pdf`

### What to ask the pen test provider:
- "We need a web application penetration test for CDR compliance under the Australian Consumer Data Right regime"
- "Please cover OWASP Top 10 and focus on API endpoints that handle financial data"
- "We need a formal report suitable for submission to our CDR Representative Principal (Basiq)"

---

## Evidence 12.0 — Anti-Virus on End Devices

**Covers spreadsheet requirements:** Step 3.4 → **3.22 Anti-malware/anti-virus installed**
**What Basiq wants to see:** Proof that anti-virus/anti-malware is active on devices.

### Screenshots needed:

**Screenshot 12A — macOS Security Settings:**
1. Open **System Settings** → **Privacy & Security**
2. Scroll to the **Security** section
3. Screenshot showing: "Allow apps downloaded from: App Store and identified developers"
4. Save as `12.0_Antivirus_Gatekeeper.png`

**Screenshot 12B — FileVault Status:**
1. Open **System Settings** → **Privacy & Security** → **FileVault**
2. Screenshot showing FileVault is **On** (full-disk encryption)
3. Save as `12.0_Antivirus_FileVault.png`

**Screenshot 12C — Firewall Status:**
1. Open **System Settings** → **Network** → **Firewall**
2. Screenshot showing Firewall is **On**
3. Save as `12.0_Antivirus_Firewall.png`

**Screenshot 12D — XProtect Version (optional):**
1. Open Terminal
2. Run: `system_profiler SPInstallHistoryDataType | grep -A 5 "XProtect"`
3. Screenshot the output showing XProtect version and install date
4. Save as `12.0_Antivirus_XProtect.png`

---

## Evidence 13.0 — System Architecture Diagram

**Covers spreadsheet requirements:** Step 6 general requirement — CDR data boundary diagram
**What Basiq wants to see:** A diagram showing where CDR data is held and the service boundaries.

### Already Prepared!

The architecture diagram has been created at `docs/compliance/CDR_SYSTEM_ARCHITECTURE.md`.

### To submit:

**Option A — Export as PDF:**
1. Open `docs/compliance/CDR_SYSTEM_ARCHITECTURE.md` in a markdown viewer
2. Print/export to PDF
3. Save as `13.0_Architecture_Diagram.pdf`

**Option B — Upload markdown directly:**
1. Upload the `.md` file to the Evidence folder
2. Save as `13.0_Architecture_Diagram.md`

**Option C — Create visual diagram:**
1. Use draw.io (https://app.diagrams.net/) to create a visual version
2. Import the text diagrams from the architecture doc as reference
3. Export as PNG or PDF
4. Save as `13.0_Architecture_Diagram.png`

---

## Evidence 14.0 — Insurance Certificates

**Covers spreadsheet requirements:** Step 6 general requirement — business insurance
**What Basiq wants to see:** Certificates of currency for cyber liability and professional liability insurance.

### BLOCKER — This requires action before you can provide evidence.

### Steps:

1. **Contact an insurance broker** — options:
   - BizCover (https://www.bizcover.com.au) — online quotes for startups
   - Emergence Insurance — specialises in cyber insurance
   - Your existing business insurance provider

2. **Request quotes for:**
   - **Cyber liability insurance** — covers data breaches, CDR data incidents, notification costs
   - **Professional indemnity (PI) insurance** — covers errors/omissions in financial services

3. **When purchasing, request:**
   - Certificate of currency for each policy
   - Ensure policy covers CDR data handling specifically
   - Minimum coverage: discuss with broker based on expected data volume

4. **Upload certificates:**
   - Save as `14.0_Insurance_Cyber_Liability.pdf`
   - Save as `14.0_Insurance_Professional_Indemnity.pdf`

### Estimated cost:
- Cyber liability: $1,500-$3,000/year for a startup
- Professional indemnity: $1,000-$2,500/year for a startup
- Combined policies may be available

---

## Quick Reference Checklist

| Evidence # | Spreadsheet Req # | Evidence Description | Files to Upload | Status |
|------------|-------------------|---------------------|----------------|--------|
| 1.0 | 3.3, 3.4 | MFA Setup + Password Controls | `1.0_MFA_Setup_Firebase.png`, `1.0_MFA_Setup_App.png`, `1.0_MFA_Enforcement_Code.png` | TODO |
| 2.0 | 3.5, 3.6, 3.7 | Admin Access + RBAC + Review | `2.0_Admin_Access_GCP_IAM.png`, `2.0_Admin_Access_Portal.png`, `2.0_Admin_Access_Firebase.png` | TODO |
| 3.0 | 3.5, 3.6 | Role-Based Access Control | `3.0_RBAC_Permissions.png`, `3.0_RBAC_Guard_Usage.png`, `3.0_RBAC_Schema.png` | TODO |
| 4.0 | 3.4 | Strong Password Controls | `4.0_Password_Policy_Firebase.png`, `4.0_Password_Policy_Admin.png` | TODO |
| 5.0 | 3.8-3.11, 3.13, 3.14 | Logging Configuration | `5.0_Logging_AuditLog.png`, `5.0_Logging_Sanitization.png`, `5.0_Logging_CloudSQL_Flags.png` | TODO |
| 6.0 | 3.16 | Network Protection | `6.0_Network_AuthorizedNetworks.png`, `6.0_Network_SSL.png` | TODO |
| 7.0 | 3.17 | Encryption in Transit | `7.0_SSL_CloudSQL.png`, `7.0_SSL_Vercel.png`, `7.0_SSL_DatabaseURL.png` | TODO |
| 8.0 | 3.29 | Encryption at Rest | `8.0_Encryption_CloudSQL.png`, `8.0_Encryption_Region.png` | TODO |
| 9.0 | 3.18, 3.34 | Patching + Library Updates | `9.0_Patching_Dependabot_Config.png`, `9.0_Patching_Dependabot_PRs.png`, `9.0_Patching_npm_audit.png` | TODO |
| 10.0 | 3.31, 3.32, 3.33 | Secure Coding Practices | `10.0_Coding_PR_Review.png`, `10.0_Coding_CI_Pipeline.png`, `10.0_Coding_Branch_Protection.png` | TODO |
| 11.0 | 3.19 | Vulnerability Scanning | `11.0_Vuln_Scan_*.pdf` | **BLOCKER** |
| 12.0 | 3.22 | Anti-virus on Devices | `12.0_Antivirus_Gatekeeper.png`, `12.0_Antivirus_FileVault.png`, `12.0_Antivirus_Firewall.png` | TODO |
| 13.0 | Step 6 general | System Architecture Diagram | `13.0_Architecture_Diagram.pdf` | **READY** |
| 14.0 | Step 6 general | Insurance Certificates | `14.0_Insurance_*.pdf` | **BLOCKER** |

**Total files to upload: ~35 screenshots/documents**
**Estimated time to capture all screenshots: 2-3 hours**

---

*Cross-references:*
*- Spreadsheet answers: `docs/compliance/CDR_SPREADSHEET_ANSWERS_AND_GAPS.md`*
*- Architecture diagram: `docs/compliance/CDR_SYSTEM_ARCHITECTURE.md`*
*- Security policies: `docs/policy/MONITRAX_SECURITY_POLICIES.md`*
