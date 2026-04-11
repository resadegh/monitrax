# CDR Mobile Compliance

**Date:** 2026-04-11 | **Version:** 1.0 | **Status:** ACTIVE
**Blueprint Ref:** `docs/mobile/blueprint/PHASE_15_MOBILE_COMPANION_APP.md` §12
**Shared CDR Docs:** `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` (NOT duplicated)

---

## 1. SCOPE

This document covers CDR compliance rules **specific to the mobile app**. For the full compliance matrix, consent lifecycle, and server-side CDR implementation, see the shared documents listed in `docs/mobile/00_CROSS_REFERENCES.md`.

---

## 2. CDR DATA ON MOBILE — RULES

| Rule | Implementation |
|------|---------------|
| CDR data encrypted at rest | SQLCipher on SQLite; key in Keychain/Keystore |
| CDR data not in AsyncStorage | Native encrypted DB only; never unencrypted storage |
| CDR data not in logs | Strip from console.log, Sentry, Crashlytics |
| CDR data not in error messages | Catch at API boundary; generic error to user |
| CDR data not in URLs | No account numbers/balances/BSBs in deep links |
| CDR data not in notifications | Vague references only on lock screen |
| CDR data not in screenshots | `FLAG_SECURE` (Android); detection listener (iOS) |
| CDR data not cached in CDN | `Cache-Control: no-store` on CDR endpoints |
| Consent-gated access | All CDR calls go through `withActiveConsent()` |
| Consent revocation → device wipe | Push notification triggers SQLite CDR purge |

---

## 3. CDR DATA CLASSIFICATION ON DEVICE

| Classification | Data | Storage | Encryption |
|----------------|------|---------|------------|
| **CDR-Protected** | Basiq transactions, account balances, BSBs | SQLite (`source: 'BANK'` rows) | SQLCipher (mandatory) |
| **CDR-Derived** | Health scores, forecasts from CDR data | SQLite (`snapshot_cache`) | SQLCipher (mandatory) |
| **Non-CDR** | User-entered expenses, preferences | SQLite / SecureStore | Optional encryption |

---

## 4. CONSENT LIFECYCLE ON DEVICE

```
ACTIVE → Normal: CDR data cached in encrypted SQLite
EXPIRED → Server purges DB → FCM to device → SQLite CDR purge → banner shown
REVOKED → Server immediate purge → high-priority FCM → immediate SQLite purge → confirmation shown
```

---

## 5. DEVICE SECURITY (Basiq §4)

| Basiq Requirement | Mobile Implementation |
|-------------------|----------------------|
| §4.1 Device encryption | Check iOS hardware AES / Android full-disk encryption |
| §4.2 Screen lock required | `expo-local-authentication.isEnrolled()` check; block CDR if no lock |
| §4.3 OS auto-updates | Warn if OS >2 major versions behind |
| §4.4 Jailbreak/root detection | Detect and warn; block CDR data access |
| §4.5 Remote wipe | Firebase token revocation triggers purge on next sync |
| §4.6 Biometric + encryption before CDR | Biometric unlock required before displaying CDR data |

---

## 6. MOBILE AUDIT EVENTS

| Event | AuditAction | Logged Fields |
|-------|-------------|---------------|
| Device registered | `MOBILE_DEVICE_REGISTERED` | userId, platform, appVersion |
| CDR data viewed | `CDR_DATA_READ` | userId, entityType, platform |
| CDR data purged | `CDR_DATA_DEVICE_PURGE` | userId, reason, platform |
| Biometric failure | `BIOMETRIC_AUTH_FAILURE` | userId, platform, failureReason |
| Root detected | `ROOTED_DEVICE_DETECTED` | userId, platform |

---

## 7. VERIFICATION CHECKLIST (Sprint 5)

- [ ] C1: CDR data encrypted in SQLite (forensic analysis)
- [ ] C2: No CDR data in push notification body
- [ ] C3: CDR purge <5 min after consent revocation
- [ ] C4: No CDR data in Sentry crash reports
- [ ] C5: MFA challenge before CDR data access
- [ ] C6: Root/jailbreak blocks CDR display
- [ ] C7: All mobile API calls generate audit entries
- [ ] C8: Screenshot blocked on CDR screens (Android)
