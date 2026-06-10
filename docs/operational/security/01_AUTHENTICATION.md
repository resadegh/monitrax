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
3. User clicks the emailed link. Two shapes are handled by `/verify-email`:
   `?mode=verifyEmail&oobCode=…` (custom action URL — page applies the code
   via `applyActionCode`) or a bare continue-URL landing (Firebase's hosted
   handler already applied it).
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

**Verification email not arriving?** Same diagnosis as password reset: GCP
Identity Platform → Templates → "Email address verification" (template
enabled + sender domain verified), then spam folder. Optional console
customisation: set the template's action URL to
`https://www.monitrax.com.au/verify-email` to keep users in Monitrax-branded
chrome end-to-end; the default Firebase-hosted handler also works (the
continue URL routes back to `/verify-email`).

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
