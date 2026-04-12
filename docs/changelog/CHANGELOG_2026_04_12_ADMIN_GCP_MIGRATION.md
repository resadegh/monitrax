# Changelog — 2026-04-12 — Admin Portal GCP-First Migration (Phase M)

## Session: claude/review-monitrax-compliance-ZOfAM

### Summary

Migrated the Admin Portal from a broken custom authentication system to GCP Identity Platform (Firebase Auth). Implemented Cloud Logging dual-write, CDR consent management APIs, complaint management APIs, and completed GCP service configuration.

### Changes Made

- **Type**: Feature / Security / CDR Compliance
- **Scope**: Admin Portal (Phase M), CDR compliance, GCP integration

### Phase M.1 — Admin Auth Migration to GCP Identity Platform

| Change | Description |
|--------|-------------|
| `verifyAdminGCPAuth()` | New admin auth guard using Firebase ID tokens + custom claims |
| Admin login page | Migrated to Firebase `signInWithEmailAndPassword()` + MFA |
| Google Sign-In | Added `signInWithPopup()` with GoogleAuthProvider |
| Forgot Password | Added `sendPasswordResetEmail()` |
| 22 admin API routes | All migrated from `verifyAdminAuth` to `verifyAdminGCPAuth` |
| AdminLayoutClient | Replaced mock admin context with real Firebase `onAuthStateChanged` |
| Admin API client | Switched from cookie auth to Firebase Bearer token |
| Admin logout | Fixed 404 — changed from page navigation to Firebase `signOut()` |

### Phase M.2 — GCP Observability

| Change | Description |
|--------|-------------|
| Cloud Logging dual-write | `createAuditLog()` now writes to both PostgreSQL and GCP Cloud Logging |
| GCP service health | CDR compliance dashboard shows real status (5 enabled, 4 planned) |

### Phase M.4 — Admin CDR Management

| Change | Description |
|--------|-------------|
| CDR consent dashboard | Real metrics from CDRConsent, BasiqConnection, CDRComplaint models |
| Consent management API | `GET/POST /api/admin/cdr/consent` — view, revoke, delete CDR data on behalf of users |
| Complaint management API | `GET/POST /api/admin/cdr/complaints` + `GET/PATCH /[id]` — create, resolve, escalate to OAIC |
| CDR compliance frontend | Updated types, stats cards, GCP status icons for new API structure |

### GCP Services Configured by User

| Service | Configuration |
|---------|---------------|
| Cloud Logging API | Enabled, 365-day retention on _Default bucket |
| Security Command Center | Standard tier enabled |
| Cloud Scheduler | `monitrax-cdr-lifecycle` job, daily 02:00 UTC, australia-southeast1 |
| Cloud Monitoring | Uptime check on `/api/health` (5-min, HTTPS, alert on failure) |
| CRON_SECRET | Set on Vercel environment variables |
| Firebase custom claims | Set for `admin@monitrax.com.au` (SUPER_ADMIN) and `rayanmehr79@gmail.com` (SUPER_ADMIN) |

### Files Created

| File | Description |
|------|-------------|
| `app/api/admin/cdr/consent/route.ts` | Admin consent management API |
| `app/api/admin/cdr/complaints/route.ts` | CDR complaint list + create API |
| `app/api/admin/cdr/complaints/[id]/route.ts` | CDR complaint detail + resolve/escalate API |
| `docs/blueprint/PHASE_M_ADMIN_PORTAL_GCP_FIRST.md` | Architecture blueprint |
| `docs/changelog/CHANGELOG_2026_04_12_ADMIN_GCP_MIGRATION.md` | This changelog |

### Files Modified

| File | Change |
|------|--------|
| `lib/admin/auth.ts` | Added `verifyAdminGCPAuth()`, Cloud Logging import |
| `lib/admin/services/api-client.ts` | Firebase Bearer token auth |
| `lib/security/auditLog.ts` | Cloud Logging dual-write |
| `app/admin/login/page.tsx` | Firebase Auth + Google Sign-In + Forgot Password |
| `app/admin/AdminLayoutClient.tsx` | Real Firebase auth state |
| `app/admin/cdr-compliance/page.tsx` | Updated types + stats for new API |
| `components/admin/layout/AdminSidebar.tsx` | Firebase signOut logout |
| `app/api/admin/auth/login/route.ts` | Firebase token verification |
| `app/api/admin/auth/session/route.ts` | GCP auth |
| `app/api/admin/cdr/compliance/route.ts` | Real CDR metrics + GCP health |
| 22 admin API routes | `verifyAdminAuth` → `verifyAdminGCPAuth` |
| `docs/compliance/CDR_IMPLEMENTATION_PLAN.md` | Phase M/N plans + progress |

### PRs Created

| PR | Title | Status |
|----|-------|--------|
| [#470](https://github.com/resadegh/monitrax/pull/470) | Phase L CDR remediation + Phase M.1 Admin auth | Merged |
| [#471](https://github.com/resadegh/monitrax/pull/471) | Google Sign-In + Forgot Password | Merged |
| [#472](https://github.com/resadegh/monitrax/pull/472) | Cloud Logging + CDR dashboard + logout fix | Merged |
| [#473](https://github.com/resadegh/monitrax/pull/473) | CDR consent + complaint management APIs | Open |

### Build Status

| Step | Status |
|------|--------|
| Prisma generate | PASS |
| npm run build | PASS (all sessions) |

### Remaining Work (Next Session)

**Phase M (remaining):**
- M.2.2: Admin audit page → Cloud Logging API queries
- M.2.4: Security page → Cloud Monitoring API
- M.2.5: Error page → Error Reporting API
- M.3: SCC/KMS/Armor API integration in admin pages
- M.5: 6 operational/BAU documents for admin support team

**Phase N (consumer-facing):**
- N.1: Consumer consent management UI (`/dashboard/settings/privacy`)
- N.2: Legacy auth route migration (~26 routes)
- N.3: Basiq webhook endpoint
- N.4: Remaining small fixes (G32, G33, G34, G46)

**Phase E (remaining GCP config):**
- Cloud Armor WAF (when on Cloud Run)
- Cloud KMS (CMEK for Cloud SQL)
- Error Reporting enablement

---

*Session Date: 2026-04-12*
