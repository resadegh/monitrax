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
