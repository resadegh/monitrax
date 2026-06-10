# Email Notifications — Backend Wiring Audit

> **Where every email-out code path lives, what triggers it, what provider it uses, and which user-preference toggle controls it.**
> Audit shipped 2026-05-18 closing Up Next #62.

**Owner:** Director (Reza)
**Last reviewed:** 2026-05-18
**Source of truth:** this file. Tech Debt #16 (SendGrid → Resend) will be resolved per-path as each migrates.

---

## 1. TL;DR — the gap

**The UI promises 4 email toggles. The backend wires 0 of them.**

`/dashboard/settings/notifications` displays 4 user-controlled email preferences:
- ✅ Weekly digest (default ON)
- ✅ Monthly report (default ON)
- ✅ Important alerts (default ON)
- ✅ Product updates (default OFF)

Each persists to `UserPreference.email*` columns via `/api/settings/notifications` and is summarised by `/api/settings/status`. **Zero scheduled jobs or alert handlers read those columns to actually send an email.** The settings page is a working toggle UI for emails that don't get sent.

5 *operational* email paths DO send real emails today — but none of them honour the user preference columns. They fire on a different signal (account creation, MFA challenge, conversation reply, calc-audit incident) and route to the user's email regardless of their preference state. These are the **transactional** + **system** paths; the **digest/report/alert** paths are the gap.

---

## 2. Live email-out code paths (5)

| # | Path | Trigger | Provider | Recipient | User-pref gate? |
|---|---|---|---|---|---|
| 1 | Firebase `sendEmailVerification()` (client SDK, `lib/context/AuthContext.tsx` `register()` / `resendVerificationEmail()`) — **migrated 2026-06-10**; the Resend-backed `lib/security/emailVerification.ts` was deleted (in-memory token store never worked on serverless) | Account signup; user clicks "Resend" (interstitial / banner / `/resend-verification`) | **Firebase Auth** (built-in; template in GCP Identity Platform console) | New user | ❌ Transactional — bypasses preferences (correct: required for signup) |
| 2 | `lib/security/mfa.ts` `sendEmailMFACode()` | MFA challenge during sign-in | **STUB** (`console.log` in dev; placeholder `// await emailService.send(...)` in prod) | User attempting sign-in | ❌ N/A (not actually sending) |
| 3 | `lib/email/conversationEmail.ts` `sendConversationEmail()` | New message in a `ProfessionalConversation` (Phase 32C PR4d) | **SendGrid** (`SENDGRID_API_KEY`; falls back to `console-stub` channel when unset) | Other conversation participant | ❌ Per-conversation participant relationship — bypasses general preferences (correct) |
| 4 | `lib/calc-audit/alertingService.ts` `sendEmailAlert()` | Calc-audit threshold breach (Phase 41i.6) | **SendGrid** (`SENDGRID_API_KEY`; from: `audit-alerts@monitrax.com.au`) | Admin only (`MONITRAX_CALC_AUDIT_ALERT_EMAIL`) | ❌ Operational alert to admin — bypasses user preferences (correct) |
| 5 | Firebase `sendPasswordResetEmail()` | Admin login "Forgot password" | **Firebase Auth** (built-in) | Admin user | ❌ Transactional (correct) |

**Provider split as of 2026-06-10:**
- Firebase: 2 paths (password reset, email verification — verification migrated off Resend 2026-06-10, GCP-first §12.7)
- SendGrid: 2 paths (conversation, calc-audit) — Tech Debt #16 migration target
- Stub: 1 path (MFA email code)
- Resend: 0 paths (`RESEND_API_KEY` now unused by any live code path)

---

## 3. The 4 user-preference toggles — current wiring

| UI toggle | DB column (UserPreference) | Default | Read by | Written by | **Email actually sent?** |
|---|---|---|---|---|---|
| Weekly digest | `emailWeeklyDigest` | `true` | `/api/settings/notifications` (GET), `/api/settings/status` (GET) | `/api/settings/notifications` (PATCH) | ❌ **No code path** |
| Monthly report | `emailMonthlyReport` | `true` | same as above | same as above | ❌ **No code path** |
| Important alerts | `emailAlerts` | `true` | same as above | same as above | ❌ **No code path** |
| Product updates | `emailProductUpdates` | `false` | same as above | same as above | ❌ **No code path** |

The columns + UI + persistence API exist. The **emit side** is missing.

---

## 4. Stubbed `notifyAdviserOfReply()` (Phase 33g feedback)

`lib/services/feedbackService.ts:464` — `notifyAdviserOfReply()` is documented as a swap-point for the first live email path. Currently fires `void`. When the adviser feedback inbox replies, no email is sent.

This is the most concrete "first live email path" candidate per Tech Debt #16 (SendGrid → Resend migration). It's also the lowest-leverage to wire — the adviser sees feedback in the portal directly.

Higher-leverage candidates for "first live email path":
1. **Important Alerts** (`emailAlerts`) → wire to `Phase 32B PR3` alert sweep (`monitrax-portal-alert-sweep` Cloud Scheduler) — fires for `CASHFLOW_NEGATIVE` / `EMERGENCY_FUND_LOW` / `LVR_REFINANCE_WINDOW` / `HEALTH_DROP` / `TRAIL_ADVANCED` triggers. Users want to know when these fire.
2. **Monthly Report** (`emailMonthlyReport`) → new Cloud Scheduler job (`monitrax-monthly-report`, `0 7 1 * *` Australia/Sydney — 7am on the 1st) reading `getMasterFinancialSnapshot()` for each user, rendering a Resend HTML email.
3. **Weekly Digest** (`emailWeeklyDigest`) → ditto but weekly (`0 7 * * 1` — 7am Monday).
4. **Product Updates** → manual broadcast surface (`/admin/email-broadcast`) reading from `UserPreference.emailProductUpdates = true` set.

---

## 5. Recommended sequencing

The fastest path from "UI lies" to "UI truthful":

### 5a. PR-1 — Resend SSOT helper (1 day)

Build `lib/email/resend.ts` as the single canonical sender:
- `sendTransactionalEmail({ to, subject, html, tag })` — for verification, password reset, etc.
- `sendPreferenceGatedEmail({ to, userId, preferenceKey, ... })` — reads the user-preference flag before sending; skips if `false`.
- Audit-log every send (succeeds + fails) — required for Basiq accreditation.

Migrate `lib/security/emailVerification.ts` to use the helper as the proof-of-concept. **Closes Tech Debt #16's primary fork** (Resend becomes the canonical provider).

### 5b. PR-2 — Important Alerts wired (1-2 days)

The lowest-friction "first preference-gated email":
- Hook into the existing `runPortalAlertSweep` (Phase 32B PR3 #9a — `lib/portal/alerts/sweepRunner.ts`) — for each `ClientAlert` it creates with `status: ACTIVE`, also enqueue an email to the affected consumer.
- Email body lists the alert subject + a link to `/dashboard/cfo` for context.
- Gates on `UserPreference.emailAlerts` per consumer.
- §13.3 — alert payloads contain CDR-derived metadata; rule from Phase 15 push docs ("no CDR data in body") needs to be honoured for email too — body says "Your savings rate dropped" not "Your savings dropped to $X".

### 5c. PR-3 — Monthly Report (2-3 days)

- New Cloud Scheduler job `monitrax-monthly-email-report` (`0 7 1 * *` Australia/Sydney).
- New route `POST /api/email/monthly-report-sweep` (CRON_SECRET-gated, mirrors `/api/portal/alerts/sweep`).
- For each user with `emailMonthlyReport: true`, render their snapshot via `getMasterFinancialSnapshot()` + a Resend HTML template.

### 5d. PR-4 — Weekly Digest (1-2 days)

Same shape as the Monthly Report, weekly cadence.

### 5e. PR-5 — Product Updates (1 day)

Admin-side `/admin/email-broadcast` surface. Audience: `where: { emailProductUpdates: true }`. Templated body. Reza-only access.

---

## 6. Tech Debt impact

| Tech Debt | Status after this audit |
|---|---|
| **#16 — SendGrid → Resend migration** | Active. PR-1 (Resend SSOT helper) is the first step; per-path migration follows. SendGrid stays in `lib/calc-audit/alertingService.ts` + `lib/email/conversationEmail.ts` until those paths individually migrate. |
| **New Tech Debt — UI-promises-without-wiring** | **The 4 user-preference toggles UI is currently lying.** Either wire them (PRs 2-5 above) OR demote the toggles to "Coming Soon" in the UI to match the Push Notifications pattern. Recommendation: wire them, in the sequence above — the UI promise is small enough that the work pays off in user trust. |

---

## 7. CDR / §13.3 considerations

Every preference-gated email MUST honour the same rule the mobile push docs established (`docs/mobile/compliance/01_CDR_MOBILE_COMPLIANCE.md:80`):

> No CDR-derived data in notification body. The notification copy is "You have a new cashflow alert", not "Your savings dropped to $X".

Email is a broader channel than push (email can be forwarded, archived, screenshotted), so the rule applies even more strictly. Each PR above MUST document its CDR posture inline + the compliance matrix gets a row per email type.

---

## 8. Open Questions for Reza

1. **Order:** start with Important Alerts (PR-2) since the alert engine already produces the content + we have user demand signal? Or build the Resend SSOT helper first (PR-1) so every subsequent path has the same shape?
   - **Recommendation:** PR-1 first. Adds 1 day but every downstream PR ships faster.

2. **Throttling:** what's the per-user per-day cap to prevent email storms? E.g., if a user has 8 ACTIVE alerts, do they get 8 emails or 1 digest?
   - **Recommendation:** digest by user per sweep run (cron interval), capped at 1 email per user per scheduler tick.

3. **Unsubscribe link:** every email needs an unsubscribe footer that flips the corresponding `UserPreference.email*` flag without requiring sign-in. Spam-act compliance.
   - **Implementation:** signed-token URL (`/unsubscribe?t=<hmac(userId|preferenceKey)>`) — single-tap, no auth.

4. **Production verification:** `RESEND_API_KEY` is the existing env var (used today for verification emails — confirmed working). Reza-side: ensure `FROM_EMAIL` is set to a domain you control (`Monitrax <hello@monitrax.com.au>`) before Step 5c — `onboarding@resend.dev` is fine for verification but not for the monthly report.

---

## 9. Related docs

- `docs/policy/MONITRAX_SECURITY_POLICIES.md` §15 — inbound email hardening (the receiving-side counterpart shipped 2026-05-09)
- `docs/mobile/compliance/01_CDR_MOBILE_COMPLIANCE.md` §80 — no-CDR-data-in-push rule (applies to email too)
- `docs/IMPLEMENTATION_PLAN.md` Tech Debt #16 — SendGrid → Resend migration tracker
- `docs/IMPLEMENTATION_PLAN.md` Up Next #62 — this audit closes that row

---

Last updated: 2026-05-18 — initial audit. The 4 UI toggles + 5 live email paths are mapped. PR sequence is documented but not yet executed.
