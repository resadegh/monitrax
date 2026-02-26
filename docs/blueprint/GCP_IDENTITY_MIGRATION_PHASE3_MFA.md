# GCP Identity Platform Migration - Phase 3: Firebase MFA Integration

> **Status**: Complete
> **Date**: 2026-02-26
> **Session**: gcp-identity-migration-phase-V6Y66
> **Branch**: claude/gcp-identity-migration-phase-V6Y66
> **Depends On**: Phase 2 (Client-Side Firebase SDK) - COMPLETE

---

## 1. Overview

Phase 3 integrates Firebase MFA (Multi-Factor Authentication) into the Monitrax authentication flow. When GCP Identity Platform is configured, MFA enrollment and challenges are handled entirely by Firebase Auth on the client side. The existing Monitrax MFA backend (TOTP, SMS via Twilio) is preserved as-is for legacy auth mode.

### Architecture

```
ENROLLMENT (Settings → Security MFA):
  FirebaseMFASettings → TotpMultiFactorGenerator.generateSecret()
  → User scans QR code → finalizeTOTPEnrollment() → Factor enrolled in Firebase

SIGN-IN WITH MFA:
  Login → signInWithEmailAndPassword() → Firebase throws auth/multi-factor-auth-required
  → MFAChallengeDialog appears → User enters TOTP code
  → resolveWithTOTP() → UserCredential → syncFirebaseUser() → Monitrax JWT
```

---

## 2. Files Created

| File | Purpose |
|------|---------|
| `lib/firebase/mfa.ts` | Firebase MFA client helpers (enrollment, challenge resolution, management) |
| `components/auth/MFAChallengeDialog.tsx` | Global MFA challenge dialog shown during login |

## 3. Files Modified

| File | Change |
|------|--------|
| `lib/context/AuthContext.tsx` | Added MFA challenge state, resolution methods, `firebaseUser` tracking |
| `app/layout.tsx` | Mounted `MFAChallengeDialog` globally inside `AuthProvider` |
| `app/dashboard/settings/security-mfa/page.tsx` | Dual-mode: Firebase MFA enrollment (GCP) vs legacy Monitrax MFA |
| `app/signin/page.tsx` | MFA-aware login flow (navigation after MFA resolution) |
| `app/login/page.tsx` | MFA-aware login flow (navigation after MFA resolution) |

## 4. Files NOT Modified

| File | Reason |
|------|--------|
| `app/api/auth/mfa/*` | Legacy Monitrax MFA API routes preserved for non-GCP mode |
| `lib/security/mfa.ts` | Custom TOTP/SMS backend preserved for legacy auth |
| `lib/auth/gcpTokenVerifier.ts` | Server-side token verification unchanged |
| `lib/auth/gcpIdentity.ts` | User sync service unchanged |

---

## 5. How Firebase MFA Works

### 5.1 TOTP Enrollment (Settings Page)

1. User navigates to Settings → Security MFA
2. Clicks "Setup Authenticator App"
3. `startTOTPEnrollment()` calls `TotpMultiFactorGenerator.generateSecret(session)`
4. QR code is rendered from the `otpauth://` URI
5. User scans QR and enters 6-digit code
6. `finalizeTOTPEnrollment()` calls `multiFactor(user).enroll(assertion)`
7. Factor is enrolled in GCP Identity Platform

### 5.2 Sign-In with MFA

1. User enters email/password or clicks Google sign-in
2. Firebase Auth throws `auth/multi-factor-auth-required` error
3. `AuthContext.handleFirebaseAuthError()` captures the error
4. `mfaChallenge` state is set with resolver + enrolled factor hints
5. `MFAChallengeDialog` renders globally (mounted in `app/layout.tsx`)
6. User enters TOTP code from authenticator app
7. `resolveWithTOTP()` calls `resolver.resolveSignIn(assertion)`
8. Resolved `UserCredential` is synced to Monitrax backend via `/api/auth/gcp/sync`
9. Monitrax JWT stored, user redirected to dashboard

### 5.3 Factor Management

- `getEnrolledFactors()` lists all enrolled MFA factors
- `unenrollFactor()` removes a factor (requires recent login)
- Factor data is managed by GCP Identity Platform, not the Monitrax database

---

## 6. GCP Console Requirements

MFA must be enabled in the GCP Console for this to work:

1. Go to **Authentication → Sign-in method → Multi-factor authentication**
2. Enable **TOTP** (and optionally **SMS/Phone**)
3. Save changes

Without this, `TotpMultiFactorGenerator.generateSecret()` will fail.

---

## 7. Supported MFA Methods

| Method | Enrollment | Sign-In Challenge | Notes |
|--------|-----------|-------------------|-------|
| **TOTP** | In-app (Settings page) | In-app (MFA dialog) | Fully implemented |
| **Phone/SMS** | Via GCP Console | In-app (MFA dialog) | Challenge resolution implemented; enrollment requires reCAPTCHA |
| **Passkeys/FIDO2** | Coming soon | — | Stub in settings page |

---

## 8. Migration Phases (Full Roadmap)

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 1** | Server-side token verification + user sync | ✅ Complete |
| **Phase 2** | Client-side Firebase SDK integration | ✅ Complete |
| **Phase 3** | Firebase MFA integration (this doc) | ✅ Complete |
| **Phase 4** | Dual-mode middleware (accept both JWT types) | ⏳ Future |
| **Phase 5** | Full cutover + legacy auth cleanup | ⏳ Future |

---

*Last Updated: 2026-02-26*
