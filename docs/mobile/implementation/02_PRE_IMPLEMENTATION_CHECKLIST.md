# Mobile Companion App — Pre-Implementation Checklist

**Date:** 2026-04-11 | **Version:** 1.0 | **Status:** ACTIVE
**Blueprint Ref:** `docs/mobile/blueprint/PHASE_15_MOBILE_COMPANION_APP.md` §15

> Everything in this checklist MUST be completed BEFORE Sprint 0 begins.
> These are hard blockers — starting development without them creates rework.

---

## 1. ACCOUNTS & ACCESS (P0)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.1 | Apple Developer Program registered ($149 AUD/year) | [ ] | Required for iOS builds, TestFlight, App Store |
| 1.2 | Google Play Developer Console registered ($25 USD one-time) | [ ] | Required for Android builds, Play Store |
| 1.3 | EAS account created (expo.dev) | [ ] | Free tier sufficient for MVP; $99/month for production queue |
| 1.4 | Bundle identifiers reserved (iOS: `com.renewgroup.monitrax`, Android: `com.renewgroup.monitrax`) | [ ] | Register in Apple Developer Portal + Play Console |
| 1.5 | npm organisation/scope created for `@monitrax/core` | [ ] | Private package publishing |

---

## 2. BACKEND INFRASTRUCTURE (P0)

| # | Item | Status | Depends On | Notes |
|---|------|--------|-----------|-------|
| 2.1 | API versioning: create `/api/v1/mobile/` route group | [ ] | — | Versioned prefix prevents breaking mobile apps during App Store review lag |
| 2.2 | Cloud Armor WAF deployed | [ ] | GCP Console access | Basiq CDR P0 requirement; mobile increases API attack surface |
| 2.3 | FCM enabled in Firebase Console | [ ] | Firebase project | Cloud Messaging → Enable; needed for push notifications |
| 2.4 | APNs certificate uploaded to Firebase | [ ] | Apple Developer account (1.1) | Required for iOS push notifications via FCM |
| 2.5 | Snapshot caching (60s TTL) added to `getMasterFinancialSnapshot()` | [ ] | — | Mobile will call this frequently; avoid DB overload |
| 2.6 | Redis for rate limiting (recommended) | [ ] | GCP Memorystore | In-memory rate limiter will not scale with mobile traffic |

---

## 3. CDR COMPLIANCE (P0)

| # | Item | Status | Depends On | Notes |
|---|------|--------|-----------|-------|
| 3.1 | Mobile addendum drafted for `docs/policy/DEVICE_SECURITY_POLICY.md` | [ ] | — | Basiq §4 requires device security for mobile |
| 3.2 | CDR notification sanitisation rules documented | [ ] | — | No CDR data in push notification title/body |
| 3.3 | CDR data purge flow designed (consent revocation → device wipe) | [ ] | — | Already in Blueprint §12.4; verify implementation approach |
| 3.4 | Approved Dependencies list updated for mobile packages | [ ] | — | Add React Native, Expo, Firebase RN packages to `docs/policy/APPROVED_DEPENDENCIES.md` |

---

## 4. SHARED CODE PREPARATION (P0)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.1 | Identify all pure functions in `lib/` that can be extracted | [ ] | See Blueprint §11.1 for the list |
| 4.2 | Verify no Prisma/Next.js imports in extraction targets | [ ] | `formatters.ts`, `frequencies.ts`, calculators must be dependency-free |
| 4.3 | Run existing Vitest tests against extraction targets in isolation | [ ] | Ensure tests don't depend on server context |
| 4.4 | Design `@monitrax/core` package.json and tsconfig.json | [ ] | ESM + CJS dual output; React Native compatible |

---

## 5. DESIGN ASSETS (P1)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.1 | App icon designed (1024x1024 PNG, no transparency for iOS) | [ ] | Follows brand guidelines from `docs/architecture/08_BRAND_UI_DESIGN.md` |
| 5.2 | Splash screen designed (Monitrax logo on navy background) | [ ] | Simple, clean, fast |
| 5.3 | Notification icon (Android, 96x96 monochrome) | [ ] | Required for Android notification display |

---

## 6. OPERATIONAL READINESS (P1)

| # | Item | Status | Depends On | Notes |
|---|------|--------|-----------|-------|
| 6.1 | Basiq Operations runbook created | [ ] | — | Gap Analysis P0 item; mobile users will report sync issues |
| 6.2 | Extended incident scenarios documented | [ ] | — | Vercel outage, Firebase outage procedures |
| 6.3 | FCM token rotation/cleanup procedure documented | [ ] | — | How to handle stale tokens, uninstalled apps |

---

## 7. DECISION LOG

Record any decisions made during pre-implementation:

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| — | — | — | — |

---

## SIGN-OFF

| Role | Name | Date | Approved |
|------|------|------|----------|
| Director | — | — | [ ] |

> **Once all P0 items are checked, Sprint 0 can begin.**
