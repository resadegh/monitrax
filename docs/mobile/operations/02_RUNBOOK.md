# Mobile Operational Runbook

**Date:** 2026-04-11 | **Version:** 1.0 | **Status:** ACTIVE
**Shared Runbooks:** `docs/operational/runbooks/` (NOT duplicated here)

---

## 1. MOBILE-SPECIFIC INCIDENTS

> For general incidents (database, auth, API 500s), see `docs/operational/runbooks/01_INCIDENT_RESPONSE.md`.
> This runbook covers **mobile-only** scenarios.

---

### 1.1 Push Notifications Not Delivering

**Symptoms:** Users report missing daily digest or alerts.

**Diagnosis:**
1. Check Cloud Function logs: `gcloud functions logs read monitrax-push-notifications --limit=50`
2. Check FCM delivery: Firebase Console → Cloud Messaging → Reports
3. Check Cloud Scheduler: GCP Console → Cloud Scheduler → verify job ran
4. Check device token: query `DeviceToken` table for user's FCM token

**Resolution:**
| Cause | Fix |
|-------|-----|
| Cloud Function crashed | Check logs; redeploy with `gcloud functions deploy` |
| FCM token stale (app uninstalled) | Clean up stale tokens via batch job |
| Cloud Scheduler missed | Manually trigger: `gcloud scheduler jobs run daily-digest` |
| APNs certificate expired | Renew in Apple Developer Portal; upload to Firebase |
| User disabled notifications | No action; respect user preference |

---

### 1.2 Biometric Auth Failure Loop

**Symptoms:** User cannot unlock app; biometric keeps failing; no fallback.

**Resolution:**
1. User should kill and restart the app
2. If persists: clear app data (Android) or reinstall (iOS)
3. If widespread: check Firebase Auth service status
4. Emergency: push OTA update bypassing biometric to Firebase login

---

### 1.3 Offline Data Not Syncing

**Symptoms:** Expenses created offline don't appear on web after reconnecting.

**Diagnosis:**
1. Check `pending_writes` table in SQLite (dev tools or debug build)
2. Check `/api/v1/mobile/sync` response for errors
3. Check network connectivity (user may be on captive portal)

**Resolution:**
| Cause | Fix |
|-------|-----|
| Network issue | User: ensure full internet access (not captive portal) |
| Sync endpoint error | Check Vercel logs for `/api/v1/mobile/sync` errors |
| Corrupt pending_writes | Clear app cache; user re-enters expenses |
| Auth token expired during background | Force re-authentication |

---

### 1.4 CDR Data Visible After Consent Revocation

**Severity:** P0 — CDR compliance violation

**Immediate actions:**
1. Verify server-side CDR data deleted (check PostgreSQL)
2. Check FCM delivery of purge notification
3. If FCM failed: send manual push via Firebase Console
4. If device unreachable: revoke Firebase token → forces re-auth → purge on next login
5. Document in incident log per `docs/policy/INCIDENT_RESPONSE_PLAN.md`

---

### 1.5 App Store Rejection

**Common reasons for financial apps:**

| Rejection Reason | Resolution |
|-----------------|-----------|
| Missing privacy policy | Host privacy policy URL; link from App Store listing |
| Incomplete privacy labels | Review all data types; update nutrition labels |
| Missing Apple Sign-In | Ensure Apple Sign-In is offered alongside other providers |
| Insufficient metadata | Add detailed description, keywords, screenshots |
| Guideline 5.1.1 (data collection) | Ensure privacy policy covers all collected data types |
| Guideline 2.1 (crashes) | Fix crashes found during review; resubmit |

---

## 2. HEALTH CHECKS

**Daily (in addition to web health checks from `docs/operational/runbooks/03_HEALTH_CHECKS.md`):**

| Check | How | Expected |
|-------|-----|----------|
| Mobile snapshot API | `curl /api/v1/mobile/snapshot` (with auth) | 200 OK, <150ms |
| FCM delivery | Firebase Console → Messaging → Reports | No delivery errors |
| Cloud Function | GCP Console → Cloud Functions → `monitrax-push-notifications` | No errors in last 24h |
| Sentry crash rate | Sentry dashboard → Mobile project | >99% crash-free |
| OTA update status | EAS Dashboard | Latest update active |

---

## 3. COMMON OPERATIONS

### Force-refresh user's mobile data
```sql
-- No direct action needed; user pulls-to-refresh
-- If cached data is stale, the 60s server cache will expire naturally
-- For emergency: restart the Vercel deployment to clear server cache
```

### Revoke a user's mobile session
```
-- Via Firebase Admin SDK:
firebase auth:tokens:revoke <uid>
-- This invalidates all refresh tokens; app will require re-login
```

### Send test push notification
```bash
# Via Firebase Admin SDK or Firebase Console → Cloud Messaging → Send test
# Target: specific FCM token from DeviceToken table
```
