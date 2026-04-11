# Mobile Build & Deploy Operations

**Date:** 2026-04-11 | **Version:** 1.0 | **Status:** ACTIVE
**Blueprint Ref:** `docs/mobile/blueprint/PHASE_15_MOBILE_COMPANION_APP.md` §3

---

## 1. BUILD PIPELINE

### EAS Build Profiles

| Profile | Use | Platform | Distribution |
|---------|-----|----------|-------------|
| `development` | Local dev with Expo Go or dev client | iOS + Android | Internal |
| `preview` | PR review builds | iOS + Android | Internal (TestFlight / Internal Track) |
| `production` | App Store release builds | iOS + Android | Store |

### Build Commands

```bash
# Development build
eas build --profile development --platform all

# Preview build (for PR review)
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## 2. RELEASE PROCESS

### Standard Release (with App Store review)

```
1. Feature branch → PR → merge to main
2. Run: eas build --profile production --platform all
3. Run: eas submit --platform ios && eas submit --platform android
4. iOS: wait for App Store review (1-7 days)
5. Android: wait for Play Store review (hours to 3 days)
6. Monitor crash reports in Sentry for 24h after approval
```

### OTA Update (JS-only changes — no native module changes)

```
1. Merge to main
2. Run: eas update --branch production --message "description"
3. Users receive update on next app open (no store review)
4. Monitor Sentry for 24h
```

**OTA eligible:** UI changes, bug fixes, new screens, logic changes.
**OTA NOT eligible:** New native modules, permission changes, SDK upgrades.

---

## 3. ENVIRONMENT CONFIGURATION

| Variable | Dev | Production |
|----------|-----|-----------|
| `API_URL` | `https://dev.monitrax.com` | `https://app.monitrax.com` |
| `FIREBASE_CONFIG` | Dev Firebase project | Prod Firebase project |
| `SENTRY_DSN` | Dev Sentry project | Prod Sentry project |
| `EAS_PROJECT_ID` | — | Set in `app.json` |

Managed via `eas.json` build profiles and Expo environment variables.

---

## 4. ROLLBACK PROCEDURES

| Scenario | Action |
|----------|--------|
| JS bug in production | Push OTA update with fix; <5 min to reach users |
| Native crash in production | Revert commit → rebuild → resubmit; 1-7 day delay |
| API breaking change | Backend supports last 3 app versions; rollback API if needed |
| Catastrophic failure | Pull app from stores; push OTA disabling affected feature |

---

## 5. MONITORING

| What | Tool | Alert |
|------|------|-------|
| Crash rate | Sentry | >1% crash-free sessions: P1 alert |
| ANR rate (Android) | Play Console | >0.47%: P1 alert |
| App Store rating | App Store Connect / Play Console | <4.0 stars: review |
| API error rate (mobile) | Vercel Analytics | >5% 5xx on mobile endpoints: P0 |
| OTA update adoption | EAS Dashboard | <80% after 24h: investigate |
