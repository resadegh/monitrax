# Monitrax CDR System Architecture Diagram

**Date:** 2026-04-10 | **Version:** 1.0 | **Status:** ACTIVE
**Purpose:** Basiq CDR Compliance Step 6, Evidence Item 13 — System architecture showing CDR data boundaries

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CDR DATA FLOW                                      │
│                                                                             │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐   │
│  │ Consumer  │───▶│  Monitrax    │───▶│   Basiq     │───▶│ Data Holder  │   │
│  │ (Browser) │◀───│  Web App     │◀───│   (CDR      │◀───│ (Bank/ADI)   │   │
│  │           │    │  (Vercel)    │    │  Principal)  │    │              │   │
│  └──────────┘    └──────────────┘    └─────────────┘    └──────────────┘   │
│       │                 │                   │                               │
│       │ HTTPS/TLS       │ HTTPS/TLS         │ CDR API                      │
│       ▼                 ▼                   ▼                               │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────┐                       │
│  │ Firebase  │    │ GCP Cloud    │    │ ACCC        │                       │
│  │ Auth      │    │ SQL (Sydney) │    │ Register    │                       │
│  │ (Identity)│    │ (CDR Data)   │    │             │                       │
│  └──────────┘    └──────────────┘    └─────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CDR Data Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ENVIRONMENT                                    │
│                    (CDR Data Resides Here ONLY)                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    GCP Project: monitrax-prod                       │    │
│  │                    Region: australia-southeast1 (Sydney)            │    │
│  │                                                                     │    │
│  │  ┌─────────────────────┐    ┌──────────────────────────────────┐   │    │
│  │  │  GCP Cloud SQL       │    │  GCP Identity Platform          │   │    │
│  │  │  (PostgreSQL 15)     │    │  (Firebase Auth)                │   │    │
│  │  │                      │    │                                  │   │    │
│  │  │  CDR Data:           │    │  Auth Data:                     │   │    │
│  │  │  • Account balances  │    │  • User identity (UID)          │   │    │
│  │  │  • Transactions      │    │  • OAuth tokens                 │   │    │
│  │  │  • Account numbers   │    │  • MFA enrollment               │   │    │
│  │  │  • BSBs              │    │  • Session state                │   │    │
│  │  │  • Basiq connections │    │                                  │   │    │
│  │  │                      │    │  NOT CDR Data                    │   │    │
│  │  │  Encryption:         │    │  (handled by GCP/Firebase)      │   │    │
│  │  │  • At rest: AES-256  │    └──────────────────────────────────┘   │    │
│  │  │    (Google-managed)  │                                           │    │
│  │  │  • In transit: SSL   │    ┌──────────────────────────────────┐   │    │
│  │  │    (sslmode=require) │    │  Google Cloud Storage            │   │    │
│  │  │                      │    │  (Document uploads)              │   │    │
│  │  │  Access:             │    │  NOT CDR Data                    │   │    │
│  │  │  • No public IP      │    └──────────────────────────────────┘   │    │
│  │  │    (SSL only)        │                                           │    │
│  │  │  • Audit logging ON  │    ┌──────────────────────────────────┐   │    │
│  │  └─────────────────────┘    │  Audit Logs                      │   │    │
│  │                              │  (AuditLog table in Cloud SQL)   │   │    │
│  │                              │  • 40+ event types               │   │    │
│  │                              │  • CDR data NEVER in logs        │   │    │
│  │                              │  • sanitizeCdrMetadata() applied │   │    │
│  │                              │  • Retained >90 days             │   │    │
│  │                              └──────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Vercel (Frontend Hosting)                        │    │
│  │                    Region: Global CDN (Edge)                        │    │
│  │                                                                     │    │
│  │  • Next.js 15 App Router                                           │    │
│  │  • Server-side rendering (API routes)                              │    │
│  │  • HTTPS enforced (automatic SSL certificates)                     │    │
│  │  • CDR data rendered in browser only (never cached/stored)         │    │
│  │  • No CDR data in localStorage or sessionStorage                   │    │
│  │  • Preview deployments for non-production branches                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEV/UAT ENVIRONMENT                                       │
│                    (NO CDR Data — Synthetic Only)                            │
│                                                                             │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐           │
│  │  GCP Cloud SQL       │    │  Vercel Preview                  │           │
│  │  (monitrax-db-dev)   │    │  (Branch deployments)            │           │
│  │  Synthetic data only │    │  Non-production URLs             │           │
│  └─────────────────────┘    └──────────────────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. CDR Data Request Flow

```
Step 1: Consumer grants consent
┌──────────┐    ┌──────────────┐    ┌─────────────┐
│ Consumer  │───▶│ Basiq Consent│───▶│ Consent     │
│ (Browser) │    │ UI Widget    │    │ Recorded    │
└──────────┘    └──────────────┘    └─────────────┘
                                          │
Step 2: Basiq collects CDR data           ▼
                                    ┌─────────────┐    ┌──────────────┐
                                    │ Basiq API   │───▶│ Data Holder  │
                                    │ (Principal) │◀───│ (Bank)       │
                                    └─────────────┘    └──────────────┘
                                          │
Step 3: CDR data disclosed to Monitrax    ▼
┌──────────────┐    ┌─────────────┐
│ Monitrax API │◀───│ Basiq API   │  "Service Data" disclosed to
│ /api/basiq/* │    │ Response    │  CDR Representative (Monitrax)
└──────────────┘    └─────────────┘
       │
Step 4: Monitrax stores & uses CDR data
       ▼
┌──────────────────────────────────────────┐
│ GCP Cloud SQL (Sydney)                    │
│                                           │
│ Guards applied before data access:        │
│ 1. verifyGCPIdToken() — Firebase token    │
│ 2. withPermission() — RBAC check          │
│ 3. withMFARequired() — MFA verified       │
│ 4. withActiveConsent() — CDR consent OK   │
│ 5. Ownership verification — user's data   │
│ 6. createAuditLog() — access logged       │
│ 7. sanitizeCdrMetadata() — PII stripped   │
│                                           │
│ CDR data used to provide:                 │
│ • Financial portfolio tracking            │
│ • Cashflow analysis                       │
│ • Debt reduction planning                 │
│ • Financial health scoring                │
└──────────────────────────────────────────┘
```

---

## 4. CDR Data Lifecycle

```
┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
│  CONSENT  │───▶│  ACTIVE   │───▶│  EXPIRED  │───▶│  DELETED  │
│  GRANTED  │    │  (In Use) │    │  or       │    │  (Hard    │
│           │    │           │    │  REVOKED  │    │   Delete) │
└───────────┘    └───────────┘    └───────────┘    └───────────┘
                      │                │                │
                      │                │                │
                      ▼                ▼                ▼
                 CDR data         checkConsentExpiry()  deleteCDRData()
                 stored in        runs daily at         hard-deletes all
                 Cloud SQL        02:00 UTC via         Basiq accounts,
                 (Sydney)         Cloud Scheduler       transactions,
                                                        connections
                                  handleConsentRevocation()
                                  triggered by user     Audit logged:
                                  or Basiq Events       CDR_DATA_DELETED
                                  endpoint

                 ┌─────────────────────────────────────────┐
                 │ Legal Retention Override                  │
                 │ (e.g., loan applications)                │
                 │                                          │
                 │ anonymizeCDRData() strips PII:           │
                 │ • Account numbers → REDACTED             │
                 │ • BSBs → REDACTED                        │
                 │ • Merchant names → REDACTED              │
                 │ • Aggregate amounts preserved             │
                 │                                          │
                 │ Audit logged: CDR_DATA_ANONYMIZED        │
                 └─────────────────────────────────────────┘
```

---

## 5. Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Network Security                                    │
│ • Vercel edge: HTTPS, DDoS protection                       │
│ • Cloud SQL: SSL enforcement, authorized networks           │
│ • Rate limiting: lib/middleware/apiSecurity.ts               │
│ • Future: GCP Cloud Armor WAF                               │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Identity & Authentication                           │
│ • GCP Identity Platform (Firebase Auth)                      │
│ • OAuth: Google, Apple, Microsoft, Facebook                  │
│ • Passwordless: Magic Links, Passkeys (WebAuthn/FIDO2)      │
│ • MFA: Firebase TOTP                                         │
│ • Token: 1-hour expiry, auto-refresh                        │
│ • Inactivity: 30-minute auto-logout                         │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Authorization (RBAC)                                │
│ • 4 Roles: Owner, Admin, Contributor, Viewer                │
│ • 50+ granular permissions                                   │
│ • withPermission() on ALL 70+ API routes                    │
│ • Entity-level ownership verification                        │
│ • CDR routes: withMFARequired() + withActiveConsent()        │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Data Protection                                     │
│ • Encryption at rest: AES-256 (GCP-managed)                 │
│ • Encryption in transit: TLS/SSL everywhere                  │
│ • CDR data sanitization: sanitizeCdrMetadata()              │
│ • No CDR data in logs, error messages, URLs, localStorage   │
│ • Data residency: australia-southeast1 (Sydney)              │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Audit & Compliance                                  │
│ • 40+ audit event types                                      │
│ • Immutable append-only audit log                           │
│ • CDR consent lifecycle tracking                            │
│ • CDR data deletion on consent expiry/revocation            │
│ • Admin audit trail (AdminAuditLog)                         │
│ • Cloud SQL audit logging (connections, DDL)                │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Technology Stack Summary

| Component | Service | Location | CDR Data? |
|-----------|---------|----------|-----------|
| Frontend | Vercel (Next.js 15) | Global CDN | Rendered only, never stored |
| Identity | GCP Identity Platform (Firebase Auth) | Global | No CDR data |
| Database | GCP Cloud SQL (PostgreSQL 15) | Sydney (australia-southeast1) | **YES — CDR data here** |
| Storage | Google Cloud Storage | Sydney | No CDR data (documents only) |
| AI | Google Gemini / Vision API | Global | No CDR data sent to AI |
| Open Banking | Basiq API | Australia | CDR data source (Principal) |
| Email | Resend | Global | No CDR data |
| SMS | Twilio | Global | No CDR data |
| CI/CD | GitHub Actions | Global | No CDR data |
| Monitoring | GCP Cloud Monitoring (planned) | Sydney | No CDR data |

---

## 7. Key Code Paths for CDR Data

| Code Path | File | Purpose |
|-----------|------|---------|
| CDR data access guard | `lib/auth/guards.ts` → `withActiveConsent()` | Permission + MFA + consent check |
| CDR data deletion | `lib/services/cdrDataLifecycle.ts` → `deleteCDRData()` | Hard-delete on consent expiry/revocation |
| CDR data anonymization | `lib/services/cdrDataLifecycle.ts` → `anonymizeCDRData()` | De-identify for legal retention |
| CDR metadata sanitization | `lib/security/cdrAuditCompliance.ts` → `sanitizeCdrMetadata()` | Strip PII from audit logs |
| Basiq API integration | `lib/basiq.ts` | Connect, sync, fetch CDR data |
| Consent verification | `lib/services/cdrDataLifecycle.ts` → `hasActiveCDRConsent()` | Check active consent before data access |
| Automated consent check | `app/api/cdr/lifecycle/route.ts` | Cloud Scheduler endpoint (daily 02:00 UTC) |

---

*This diagram is maintained as part of the CDR compliance documentation.*
*For implementation details, see `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`.*
*For operational procedures, see `docs/operational/security/03_CDR_COMPLIANCE.md`.*
