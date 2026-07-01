# Authentication Operations Guide

## Overview

Monitrax uses **GCP Identity Platform (Firebase Auth)** as its sole authentication provider. There is no custom auth system -- all sign-in, token issuance, and session management is handled by Firebase.

---

## Sign-In Methods

| Method | Provider | Notes |
|--------|----------|-------|
| Google | OAuth 2.0 | Primary sign-in method |
| Apple | OAuth 2.0 | iOS/macOS users |
| Microsoft | OAuth 2.0 | Enterprise users |
| Facebook | OAuth 2.0 | Social sign-in |
| Magic Links | Email link | Passwordless, sent via Firebase |
| Passkeys | WebAuthn | FIDO2 hardware/platform authenticators |

All providers are configured in the GCP Identity Platform console. No provider-specific code exists in Monitrax beyond the Firebase SDK client configuration.

## Password Reset (Forgot Password)

`/forgot-password` (public) calls Firebase `sendPasswordResetEmail` via
`useAuth().resetPassword(email)` (`lib/context/AuthContext.tsx`). Firebase sends
the reset email + hosts the reset-link landing flow — Monitrax holds no
reset-token logic. Linked from `/signin`, `/admin/login`, `/portal/signin`.

**Anti-enumeration:** the page shows the **same** neutral confirmation ("if an
account exists for X, we've sent a link") on both success and
`auth/user-not-found`, so it never reveals whether an email is registered
(CLAUDE.md §13). Only `auth/invalid-email` and `auth/too-many-requests` surface
a distinct message.

**Reset email not arriving?** Check GCP Identity Platform → Templates (the
password-reset email template must be enabled + the sender domain verified), and
the user's spam folder. The send itself succeeding but no email = a template /
sender-domain config issue in the console, not an app bug.

## Email Verification (2026-06-10 — GCP Identity Platform)

**Verification SSOT is the Firebase `email_verified` token claim.** No custom
token system exists (the Phase 05 in-memory Resend token store in
`lib/security/emailVerification.ts` was deleted — its `Map`-based store never
worked on serverless: the instance that issued a token was almost never the
instance asked to verify it).

**Flow:**

1. Email/password signup (`/register`) → client calls Firebase
   `sendEmailVerification(user, { url: <origin>/verify-email })` inside
   `useAuth().register()` — best-effort, a failed send never fails the signup.
2. User lands on `/verify-email-sent` (interstitial; soft gate — "Skip for
   now" goes to the dashboard).
3. User clicks the emailed link. **It goes to Firebase's HOSTED handler**
   `https://monitrax-479700.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=…`
   — NOT to our own page. The custom action URL that would repoint it at us is
   **platform-locked** on this project (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED` —
   see § Troubleshooting). The hosted handler applies the code, then redirects
   to the `continueUrl` = `/dashboard` (set in `AuthContext`).
   - **We DO also ship prefetch-safe handlers** `/verify-email` and
     `/auth/action` (validate read-only via `checkActionCode`, consume the
     code only on an explicit button tap). They are correct and deployed, but
     because the `callbackUri` can't be repointed, they are **not in the live
     email path** today — they handle the continue-URL bounce + any future
     move to custom SMTP (which unlocks `callbackUri`). The firebaseapp.com
     hosted handler applies the code on load, so the prefetch protection does
     not apply to the live path — a mail scanner CAN burn a live verify link
     (mitigation: the `/verify-email-sent` interstitial's "I've verified —
     continue" re-checks status without the original link).
4. Client calls `useAuth().confirmEmailVerified()` — reloads the Firebase
   user, **force-refreshes the ID token** (`getIdToken(true)`, required:
   `email_verified` only flips on refresh), then POSTs
   `/api/auth/verify-email` to true-up the DB row (`User.emailVerified` /
   `emailVerifiedAt`). The DB row is bookkeeping; guards never read it.
5. `lib/auth/context.ts` also lazily trues-up the row on any API call whose
   token claim says verified (one-way false→true).

**Enforcement (soft gate + hard-block CDR):**

- Dashboard stays open to unverified users; `VerifyEmailBanner`
  (`components/auth/VerifyEmailBanner.tsx`, rendered by `DashboardLayout`)
  nags gently with resend / re-check actions.
- `withMFARequired` and `withActiveConsent` (lib/auth/guards.ts →
  `requireVerifiedEmail`) return **403 `EMAIL_VERIFICATION_REQUIRED`** when
  the live claim is false — this hard-blocks Basiq bank connection and CDR
  data surfaces. OAuth (Google) users arrive with `email_verified: true` and
  are never blocked.

**Resend:** signed-in only (`/resend-verification`, the interstitial, or the
banner) — Firebase's client SDK can only send to `currentUser`. Firebase
applies its own rate limiting (`auth/too-many-requests`).

**Verification email not arriving?** GCP Identity Platform → Templates →
"Email address verification" (template enabled), then spam folder. **Do NOT
try to set a custom action URL** — it returns `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`
on this project (§ Troubleshooting). Sender name = "Monitrax", public-facing
name = "Monitrax", support email = admin@monitrax.com.au are set. The From
stays `noreply@monitrax-479700.firebaseapp.com` (a custom sending domain was
attempted and abandoned — it needs DNS + doesn't affect deliverability).

**Verify link 403s / "Requests to this API … are blocked"?** The key the
link uses (the Maps key) lost its auth scopes. See § Troubleshooting —
`API_KEY_HTTP_REFERRER_BLOCKED` / the gcloud one-liner restores it.

### Troubleshooting — "link expired or already used" on the FIRST click

Firebase reset/verify links carry a **single-use code** (~1h TTL). If a user
gets "expired or already used" on a link they just received and tapped once,
the code was consumed **before** their tap reached the handler. Causes, in
order of likelihood:

1. **Link prefetch** — Apple Mail privacy protection, link-preview bots, and
   corporate email security scanners (Proofpoint, Mimecast, Outlook Safe
   Links, etc.) fetch the URL to inspect it, burning the one-time code.
2. **Multiple requests** — each new reset/verify email **invalidates all
   earlier ones**; only the newest link works.
3. **Half-applied custom action domain** — if the Firebase "Customise action
   URL / domain" flow is mid-verification (DNS not yet validated), live links
   can break. Cancel it until DNS verifies, or finish the DNS records.

**Our mitigation (2026-06-12 — unified prefetch-safe handler):**
All auth emails now route through our own **`/auth/action`** page
(`app/auth/action/page.tsx`), set via Firebase → Authentication → Templates →
**Customise action URL** = `https://www.monitrax.com.au/auth/action`. It
handles `verifyEmail` + `resetPassword` + `recoverEmail`, validating the code
read-only on load (`checkActionCode` / `verifyPasswordResetCode` — neither
consumes it) and consuming it only on an explicit button tap / form submit. A
silent prefetch can't complete any action. `/verify-email` remains for the
continue-URL bounce + old links. The `/verify-email-sent` interstitial's
"I've verified — continue" also re-checks status without the original link.

### Troubleshooting — `API_KEY_HTTP_REFERRER_BLOCKED` / `auth/network-request-failed`

**Incident 2026-06-12.** Sign-in hung / `auth/network-request-failed`, and
verify links 403'd with `API_KEY_HTTP_REFERRER_BLOCKED` ("Requests from
referer https://monitrax-479700.firebaseapp.com/ are blocked").

**Root cause:** a GCP **API-key HTTP-referrer restriction** was tightened in
the console. Two distinct keys are involved, and that's the trap:

| Flow | Key | Referrer it calls from |
|---|---|---|
| App sign-in (Firebase JS SDK) | **Monitrax Auth (Web)** — value = Vercel `NEXT_PUBLIC_FIREBASE_API_KEY` | `www.monitrax.com.au` / `monitrax.com.au` |
| Firebase's **hosted** email action handler (`firebaseapp.com/__/auth/action`) | the **project's default web key** — which here is **"Monitrax frontend (Maps Embed + Places)"** | `monitrax-479700.firebaseapp.com` |

So the email-verification link was signed with the **Maps key**, whose
referrer list didn't include `firebaseapp.com` → 403. Editing "Monitrax Auth
(Web)" didn't help because the link used a *different* key.

**How to identify the exact key:** the action link contains it as a URL
param — `…&apiKey=AIzaSy…`. Match that value in **GCP Console → APIs &
Services → Credentials → (Show key)**.

**The clean fix we ATTEMPTED and why it was blocked (2026-06-12 → 07-01):**
The intended fix was to move email links onto our own `/auth/action` handler
(built + deployed, PR #1088) by setting Firebase's custom action URL. **That
is not possible on this project.** Setting `notification.sendEmail.callbackUri`
returns **`400 EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`** via BOTH the Firebase
console AND the raw Identity Platform REST API. The config is otherwise clean
(`method: DEFAULT`, `customDomainState: NOT_STARTED`), so this is a
platform-level lock on this `IDENTITY_PLATFORM`-subtype project, not stuck
state. **Conclusion: the email-link domain (`firebaseapp.com/__/auth/action`)
cannot be changed.** `/auth/action` stays deployed and is correct — it would
activate with a one-line PATCH if the project ever moves to custom SMTP (which
unlocks `callbackUri`) — but it is NOT in the live email path today.

**Also confirmed read-only:** `config.client.apiKey` (the key Firebase embeds
in email action links) is **`AIzaSyCk0pG…` = the "Monitrax frontend (Maps
Embed + Places)" key**, and it is **OUTPUT_ONLY** — a PATCH with
`updateMask=client.apiKey` is accepted but ignored (the value doesn't change).
So we cannot re-sign the link with a different key either.

**The fix that ACTUALLY resolved it (verified working 2026-07-01):** since the
link is permanently `firebaseapp.com/__/auth/action` signed with the Maps
key, that key MUST be allowed to call the auth APIs. Add `identitytoolkit` +
`securetoken` to the Maps key's API targets and `firebaseapp.com` to its
referrers — **without wiping its Maps scopes** — via one gcloud command:

```bash
gcloud services api-keys update <MAPS_KEY_UID> \
  --allowed-referrers="https://monitrax.com.au/*,https://*.monitrax.com.au/*,https://*.vercel.app/*,http://localhost:3000/*,https://monitrax-479700.firebaseapp.com/*" \
  --api-target=service=maps-embed-backend.googleapis.com \
  --api-target=service=maps-backend.googleapis.com \
  --api-target=service=places.googleapis.com \
  --api-target=service=identitytoolkit.googleapis.com \
  --api-target=service=securetoken.googleapis.com
```
(Maps key UID as of 2026-07-01: `03e1218e-c2e4-4bbc-b803-8302121a122e`.
`gcloud services api-keys list --format=json` shows current UIDs + targets.)

**Deterministic test (no email needed)** — confirms the key change before
burning a single-use link:
```bash
curl -s -H "Referer: https://monitrax-479700.firebaseapp.com/" \
  "https://identitytoolkit.googleapis.com/v1/recaptchaParams?key=<MAPS_KEY_VALUE>"
```
`API_KEY_HTTP_REFERRER_BLOCKED` → referrer missing. `API_KEY_SERVICE_BLOCKED`
→ `identitytoolkit` missing from the key's API targets. A normal 200/params
response → the verify link will work.

**Note on the Firebase-console error `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`**: it
is misleading — it is NOT about stuck custom-domain/SMTP state (both were
clean). It is the platform refusing any `callbackUri` change on this project.
Don't chase custom-domain removal; it won't help.

> ⚠️ **Root cause — no registered Firebase Web app.** This project shows "There
> are no apps in your project"; the JS SDK config is injected via
> `NEXT_PUBLIC_FIREBASE_*` env vars instead. That's why `client.apiKey` (the
> email-link signer) drifted to an unrelated **Maps** key. The proper long-term
> tidy-up is to **register a Firebase Web app** so the project gets a clean
> dedicated web key; then drop the `identitytoolkit`/`securetoken` scopes back
> off the Maps key. Not urgent — the key config above is safe (referrer-locked
> browser key; the key is public by design and grants no data access; the
> `oobCode` is the single-use credential).

---

## Token Flow

```
1. User signs in via Firebase SDK (client-side)
2. Firebase issues an ID token (JWT, 1-hour expiry, auto-refreshed by SDK)
3. Client sends ID token in Authorization header: "Bearer <token>"
4. API route receives request
5. lib/auth/gcpTokenVerifier.ts verifies the JWT:
   - Checks signature against Google's public keys
   - Validates issuer, audience, expiry
   - Extracts uid, email, claims
6. Auth guard (withPermission, etc.) checks role/permissions
7. Request proceeds or is rejected with 401/403
```

**Key detail:** There is no Firebase Admin SDK in the backend. Token verification is done via direct JWT verification against Google's JWKS endpoint.

**Token refresh:** The Firebase SDK on the client automatically refreshes the ID token before it expires. The backend is stateless -- it only validates whatever token is presented.

---

## User Sync (Auto-Provisioning)

When a user signs in for the first time, `lib/auth/gcpIdentity.ts` handles automatic provisioning:

1. Firebase Auth authenticates the user and issues a token
2. The first API request triggers user sync
3. `gcpIdentity.ts` checks if a User record exists in the database (by Firebase UID)
4. If not found, it creates one with:
   - `firebaseUid` from the token
   - `email` from the token
   - `displayName` from the token (if available)
   - Default role: `VIEWER`
5. If found, it updates `lastLoginAt` and syncs any changed profile fields

**No manual user creation is needed.** All users are created automatically on first sign-in.

---

## Multi-Factor Authentication (MFA)

### Supported MFA Methods

| Method | Implementation | Notes |
|--------|---------------|-------|
| TOTP | Authenticator apps (Google Authenticator, Authy, etc.) | Recommended |
| SMS | Via Twilio integration in Firebase | Fallback method |
| Email | OTP sent to registered email | Least secure option |
| WebAuthn/Passkeys | Hardware keys, platform authenticators | Most secure option |

### MFA Enrollment

1. User navigates to Settings > Security
2. Selects an MFA method
3. Completes enrollment via Firebase SDK
4. MFA status is stored in Firebase Auth and synced to the User record

### MFA Enforcement

- Organizations can enforce MFA via `org.mfaEnforced: true`
- When enforced, the `withMFARequired()` guard blocks access until MFA is completed
- CDR data routes always require MFA when the org has enforcement enabled
- Admin routes require MFA when the org has enforcement enabled

### Checking MFA Status

MFA enrollment status is available from Firebase Auth. To check if a user has MFA:
- GCP Console > Identity Platform > Users > Select user > MFA methods
- Or via the Firebase Auth REST API

---

## Session Management

| Setting | Value |
|---------|-------|
| ID token expiry | 1 hour (Firebase default, not configurable) |
| Auto-refresh | Yes, handled by Firebase SDK |
| Idle timeout | 30 minutes |
| Idle detection | Client-side, triggers sign-out via Firebase SDK |

**Idle timeout implementation:** The client tracks user activity (mouse, keyboard, touch). After 30 minutes of inactivity, the Firebase SDK `signOut()` is called, clearing the session. The next API request with an expired/cleared token will return 401.

---

## Account Deletion (Identity Removal)

When a user's 30-day deletion grace elapses, the account-deletion
executor (`monitrax-account-deletion-executor` → `POST /api/account/lifecycle`)
removes their **Firebase Auth identity** as the FIRST step, before any
data is touched.

**Why identity-first matters here:** the "User Sync (Auto-Provisioning)"
flow above re-creates a local `User` row for *any* valid Firebase token.
If the data were deleted but the Firebase identity survived, the user's
next login would silently resurrect an empty account. The executor
therefore deletes the identity via the Identity Platform Admin REST API
(`accounts:lookup` by email → `accounts:delete` by localId) using the
WIF service account, and **aborts the whole deletion if the identity
cannot be removed** (the soft-delete flags stay set and the next nightly
run retries). There is no `firebase-admin` SDK server-side — token
verification is JWKS-based — so this REST path is the canonical way to
mutate identities. Code: `lib/auth/identityPlatformAdmin.ts`. IAM grant:
`02_IAM_AND_PERMISSIONS.md` → "Account-deletion executor".

---

## User Suspension (Admin Portal — 2026-06-12)

Suspending a user from the admin portal (`/admin/users/[userId]` → Account
Status → Suspend) is **enforced at the IAM authority**, not in the app DB:

1. The admin subscription route (`PATCH /api/admin/users/:userId/subscription`
   with `status: 'suspended'`) calls `setIdentityDisabledByEmail(email, true)`
   (`lib/auth/identityPlatformAdmin.ts`) — Identity Platform Admin REST
   `accounts:update {disableUser: true}` via the same WIF SA + IAM grant as
   the deletion executor.
2. **Only if that succeeds** is the local `UserSubscription.status` row
   mirrored to `'suspended'` (suspendedAt / suspendedReason / suspendedBy).
   If the identity call fails the route returns 502 and nothing is written —
   a DB-only "suspended" flag would be cosmetic, since nothing in the
   consumer app reads it (token verification is stateless JWKS).
3. Reactivation is the inverse (`disableUser: false` first, then the mirror
   is cleared).

**Lockout semantics:** disabling blocks new sign-ins and refresh-token
exchange immediately. Already-issued ID tokens remain valid until natural
expiry (**≤1 hour**) — Monitrax deliberately performs no per-request
revocation check (an extra DB/API round-trip on every authenticated request;
see CLAUDE.md §12.10 and the 2026-05-20 pool-exhaustion incident). Full
lockout therefore completes within the hour. The suspended user sees
Firebase `auth/user-disabled` on their next sign-in attempt.

**Audit trail:** `AdminAuditLog` actions `USER_SUSPENDED` / `USER_REACTIVATED`
with the Identity Platform outcome (`updated` / `not_found` / `skipped`) in
metadata. `not_found` = local-only user with no Firebase identity (seeded);
`skipped` = GCP not configured (local dev) — both proceed with the DB mirror
only.

---

## Troubleshooting: User Cannot Sign In

### Step 1: Identify the Error

| Error | Likely Cause |
|-------|-------------|
| `auth/user-not-found` | User does not exist in Firebase Auth |
| `auth/wrong-password` | N/A (we don't use password auth) |
| `auth/account-exists-with-different-credential` | User signed up with a different provider |
| `auth/popup-blocked` | Browser blocking the OAuth popup |
| `auth/network-request-failed` | Network issue between client and Firebase |
| `auth/too-many-requests` | Rate limited by Firebase |
| `auth/user-disabled` | Account disabled in Firebase Console |

### Step 2: Check Firebase Console

1. Go to GCP Console > Identity Platform > Users
2. Search for the user by email
3. Check:
   - Is the account disabled?
   - Which providers are linked?
   - Is MFA enrolled (if required)?
   - When was the last sign-in?

### Step 3: Check Monitrax Database

1. Query the User table by email or firebaseUid
2. Check:
   - Does the User record exist? (If not, auto-provision may have failed)
   - Is the user's `status` active?
   - What role is assigned?
   - Is `lockedUntil` set? (Account may be locked)

### Step 4: Check API Logs

1. Check Cloud Logging for 401/403 responses
2. Filter by the user's email or UID
3. Look for token verification failures in `gcpTokenVerifier.ts`

### Step 5: Common Resolutions

| Issue | Resolution |
|-------|-----------|
| Account disabled | Re-enable in GCP Console > Identity Platform > Users |
| Wrong provider | Guide user to sign in with the provider they originally used |
| MFA required but not enrolled | Temporarily disable MFA enforcement, or assist with enrollment |
| Account locked | Check `lockedUntil` field; wait for expiry or clear it manually |
| Token verification failing | Check that GCP project ID matches, check JWKS endpoint availability |
| Auto-provision failed | Check database connectivity, check for schema issues |

---

*Last Updated: 2026-04-09*
