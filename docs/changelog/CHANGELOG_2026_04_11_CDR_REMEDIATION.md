# Changelog — 2026-04-11 — CDR Code-Level Remediation (Phase L)

## Session: claude/review-monitrax-compliance-ZOfAM

### Summary

Implemented the first batch of CDR compliance code-level remediations identified in the deep audit of 2026-04-11. This session addresses 20 of the 46 identified gaps across Priority 0, Priority 1, and Priority 2 categories.

### Changes Made

- **Type**: Security Fix / CDR Compliance Enhancement
- **Scope**: CDR data lifecycle, authentication guards, RBAC permissions, schema models, audit compliance
- **Root Cause**: Deep audit (2026-04-11) identified 46 gaps in CDR compliance implementation
- **Solution**: Systematic remediation of critical, high, and medium severity gaps

### Gaps Fixed

#### Priority 0 (Before Submission)
| Gap | Description | Fix |
|-----|-------------|-----|
| **G35** | `/api/admin/dashboard` had NO authentication | Added `verifyAdminAuth()` guard |

#### Priority 1 (Before Go-Live)
| Gap | Description | Fix |
|-----|-------------|-----|
| **G15** | `deleteCDRData()` didn't call Basiq API | Added `deleteBasiqConnection()` call before local deletion |
| **G17** | `withMFARequired()` only checked enrollment, not session MFA | Now verifies Firebase `sign_in_second_factor` token claim |
| **G18** | No standalone CDRConsent model | Created `CDRConsent` Prisma model with full lifecycle fields |
| **G19** | BasiqConnection missing consent fields | Added `consentExpiresAt`, `consentScope` to schema |
| **G20** | `revoke_all` didn't revoke Basiq-side connections | Added Basiq API deletion calls in revoke_all action |
| **G21** | `cdr_data.*` permissions didn't exist | Added `cdr_data.read`, `cdr_data.write`, `cdr_data.delete` to RBAC |
| **G22** | `deleteCDRData()` not wrapped in `$transaction()` | Wrapped all delete operations in `prisma.$transaction()` |
| **G25** | `checkConsentExpiry()` ignored direct users | Added BasiqConnection expiry check for non-org users |
| **G26** | `deleteCDRData()` didn't delete RecurringPayment | Added RecurringPayment deletion for Basiq-linked accounts |
| **G28** | DELETE connection soft-disabled instead of hard-delete | Changed to `prisma.basiqConnection.delete()` (hard-delete) |
| **G40** | Internal dispute resolution not documented | Created `docs/policy/CDR_COMPLAINTS_POLICY.md` |
| **G43** | Complaints/disclosures not tracked in DB | Created `CDRComplaint` and `CDRDisclosure` Prisma models |

#### Priority 2 (Within 30 Days)
| Gap | Description | Fix |
|-----|-------------|-----|
| **G23** | `sanitizeCdrMetadata()` didn't recurse arrays | Added array recursion to sanitizer |
| **G24** | `anonymizeCDRData()` left amount field | Now sets amount to 0 during anonymization |
| **G27** | CRON_SECRET used timing-unsafe comparison | Now uses `crypto.timingSafeEqual()` |
| **G30** | Anonymizer didn't strip categories | Now strips `categoryLevel1`/`categoryLevel2` |
| **G31** | Sanitizer missing merchant fields | Added `merchantRaw`, `merchantStandardised`, `description` to redacted set |
| **G42** | Testing routes deployable to production | Blocked unconditionally in production (removed `ENABLE_TESTING_API` override) |
| **G44** | `enforceAuditLogRetention()` never scheduled | Added to CDR lifecycle CRON endpoint |
| **G45** | `runAnomalyDetection()` never scheduled | Added to CDR lifecycle CRON endpoint |

### Files Modified

| File | Change |
|------|--------|
| `app/api/admin/dashboard/route.ts` | Added `verifyAdminAuth()` guard (G35) |
| `app/api/cdr/lifecycle/route.ts` | Timing-safe CRON_SECRET (G27), added retention + anomaly detection (G44, G45) |
| `app/api/cdr/consent/route.ts` | Added Basiq API revocation in revoke_all (G20) |
| `app/api/basiq/connections/[id]/route.ts` | Hard-delete instead of soft-disable (G28) |
| `app/api/testing/route.ts` | Block in production (G42) |
| `app/api/testing/export/route.ts` | Block in production (G42) |
| `app/api/testing/load/route.ts` | Block in production (G42) |
| `app/api/testing/reset/route.ts` | Block in production (G42) |
| `lib/auth/permissions.ts` | Added `cdr_data.read/write/delete` permissions (G21) |
| `lib/auth/guards.ts` | MFA session verification via `signInSecondFactor` (G17) |
| `lib/auth/context.ts` | Propagate `signInSecondFactor` from token to auth context (G17) |
| `lib/auth/gcpIdentity.ts` | Added `signInSecondFactor` to GCPTokenClaims type (G17) |
| `lib/auth/gcpTokenVerifier.ts` | Extract `sign_in_second_factor` from Firebase token (G17) |
| `lib/services/cdrDataLifecycle.ts` | Basiq API deletion (G15), $transaction (G22), RecurringPayment (G26), consent expiry (G25), anonymization (G24, G30) |
| `lib/security/cdrAuditCompliance.ts` | Array recursion (G23), merchant fields (G31) |
| `prisma/schema.prisma` | CDRConsent model (G18), BasiqConnection consent fields (G19), CDRComplaint/CDRDisclosure models (G43) |

### Files Created

| File | Description |
|------|-------------|
| `docs/policy/CDR_COMPLAINTS_POLICY.md` | CDR consumer complaints handling policy (G40) |
| `docs/changelog/CHANGELOG_2026_04_11_CDR_REMEDIATION.md` | This changelog |

### Documentation Updated

| Document | Update |
|----------|--------|
| `docs/compliance/CDR_IMPLEMENTATION_PLAN.md` | Phase L progress updated |
| `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` | Gap statuses updated |

### Build Status

| Step | Status | Notes |
|------|--------|-------|
| Prisma generate | PASS | New models generated successfully |
| npm run build | PASS | Full Next.js build clean — zero errors |

### Remaining Gaps (Not Addressed This Session)

**Requiring User Action:**
- G1: Vulnerability scan / pen test (external vendor required)
- G2: Cyber + professional liability insurance (broker required)
- G29: GCP Cloud Scheduler configuration (GCP Console action)

**Requiring Larger Implementation:**
- G13/G14: Consumer consent management UI (5-7 dev days)
- G36: Portal consent page — replace demo data with real Basiq flow (2-3 dev days)
- G37: ~26 routes on legacy auth — complete migration to `withPermission()` (3-5 dev days)
- G38/G39: Storage + document routes legacy auth migration (1.5 dev days)
- G16: Basiq Events/Webhooks endpoint (2-3 dev days)

**GCP-First (User Action Required):**
- G5/G6: Cloud Armor, Security Command Center (GCP Console)
- G7-G10: Cloud KMS, Logging, Monitoring, Error Reporting (GCP Console)

### Architecture Decisions

1. **Basiq API deletion before local deletion (G15)**: Basiq API calls are made before the local transaction to ensure CDR data is purged from Basiq's systems. If Basiq API fails, local deletion still proceeds (with warning logged).
2. **Prisma $transaction for atomicity (G22)**: All CDR deletion operations are now atomic. A partial failure will roll back, preventing inconsistent CDR data state.
3. **Session-level MFA verification (G17)**: `withMFARequired()` now checks the Firebase `sign_in_second_factor` token claim, not just the database `mfaEnabled` flag. This ensures MFA was actually completed in the current session.
4. **Hard-delete over soft-delete (G28)**: CDR rules require complete removal of connection records. Soft-disabling doesn't meet CDR deletion requirements.
5. **Production testing block (G42)**: `ENABLE_TESTING_API` env var can no longer bypass the production block. CDR compliance requires testing endpoints be completely inaccessible in production.

### PR
- Branch: `claude/review-monitrax-compliance-ZOfAM`
- Status: Pushed
