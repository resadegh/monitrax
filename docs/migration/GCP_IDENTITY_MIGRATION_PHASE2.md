# GCP Identity Platform Migration - Phase 2: Client-Side Firebase SDK Integration

> **Status**: ✅ Complete
> **Date**: 2026-02-25 (completed 2026-02-26)
> **Session**: gcp-identity-migration-phase-V6Y66
> **Branch**: claude/gcp-identity-migration-phase-V6Y66
> **Depends On**: Phase 1 (Server-Side Token Verification) - COMPLETE

---

## 1. Overview

Phase 2 integrates the Firebase client SDK into the Monitrax frontend, enabling users to authenticate via GCP Identity Platform (Firebase Auth) for both Google sign-in and email/password login.

> **UPDATE (Feb 26, 2026):** Phase 4 (GCP-only cutover) is now complete. The architecture
> below has been further simplified — no sync endpoint hop, no Monitrax JWT intermediary.

### Migration Architecture

```
BEFORE (Legacy):
  Login Page → POST /api/auth/login → Custom JWT → localStorage
  Login Page → GET /api/auth/oauth/google → Server-side OAuth → redirect → Custom JWT

AFTER Phase 2 (Intermediate):
  Login Page → Firebase Auth SDK (client-side) → GCP ID Token
  → POST /api/auth/gcp/sync → Verify token + sync user → Monitrax JWT → localStorage

AFTER Phase 4 (Current — GCP-Only):
  Login Page → Firebase Auth SDK (client-side) → GCP ID Token
  → onIdTokenChanged → Token sent directly to API routes as Bearer token
  → Server verifies via verifyGCPIdToken() → auto-syncs user if needed
  (No sync endpoint, no Monitrax JWT, Firebase SDK manages token lifecycle)
```

---

## 2. What Was Completed in Phase 1

| Component | File | Status |
|-----------|------|--------|
| Token verifier | `lib/auth/gcpTokenVerifier.ts` | ✅ Complete |
| User sync service | `lib/auth/gcpIdentity.ts` | ✅ Complete |
| Sync API endpoint | `app/api/auth/gcp/sync/route.ts` | ✅ Complete |
| Verify API endpoint | `app/api/auth/gcp/verify/route.ts` | ✅ Complete |
| Barrel exports | `lib/auth/index.ts` | ✅ Complete |

---

## 3. Phase 2 Implementation Plan

### 3.1 Install Firebase Client SDK

```bash
npm install firebase
```

Only the client-side SDK — no Firebase Admin SDK needed (server uses `google-auth-library`).

### 3.2 Create Firebase Client Config

**File**: `lib/firebase/config.ts`

```typescript
// Firebase client SDK configuration
// Uses GCP Identity Platform as the backend (not standalone Firebase)
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    `${process.env.NEXT_PUBLIC_GCP_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.NEXT_PUBLIC_GCP_PROJECT_ID,
};
// NOTE: Set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=monitrax.com.au so Google sign-in
// popup shows "Sign in to Monitrax" instead of "monitrax-479700.firebaseapp.com"

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
```

### 3.3 Update AuthContext

**File**: `lib/context/AuthContext.tsx`

Add new methods:
- `loginWithGoogle()` — Uses Firebase `signInWithPopup(GoogleAuthProvider)`
- `loginWithGCPEmail(email, password)` — Uses Firebase `signInWithEmailAndPassword`

Both methods:
1. Get the GCP ID token from the Firebase user
2. Send it to `POST /api/auth/gcp/sync`
3. Receive Monitrax JWT
4. Store in localStorage (same as existing flow)

### 3.4 Update Login Page

**File**: `app/login/page.tsx`

- Google button: Change from `window.location.href = '/api/auth/oauth/google'` to `loginWithGoogle()`
- Email/password: Change from `login(email, password)` to `loginWithGCPEmail(email, password)`
- Keep existing UI layout — only change the auth flow behind the buttons
- Add fallback: If Firebase fails, show error (don't fall back to old flow to avoid confusion)

### 3.5 Update Middleware CSP

**File**: `middleware.ts`

Add Firebase domains to Content-Security-Policy:
- `connect-src`: `*.googleapis.com`, `*.firebaseauth.com`
- `script-src`: `apis.google.com`
- `frame-src`: `*.firebaseapp.com`, `*.google.com` (for popup)

**IMPORTANT**: The middleware matcher MUST exclude `__/` paths so that our CSP is NOT
applied to the proxied Firebase auth handler pages. The handler loads its own scripts
from `gstatic.com`, `googleapis.com`, etc. that are outside our `script-src` allowlist.

### 3.7 Custom Domain Auth Proxy (Next.js Rewrites)

**File**: `next.config.ts`

When using a custom `authDomain` (e.g., `www.monitrax.com.au`), the Firebase SDK opens
a popup to `{authDomain}/__/auth/handler`. Next.js rewrites proxy these requests to the
Firebase project's `firebaseapp.com` domain:

| Source | Destination | Notes |
|--------|-------------|-------|
| `/__/auth/:path*` | `https://{projectId}.firebaseapp.com/__/auth/:path*` | Firebase Auth handler |
| `/__/firebase/init.json` | `/api/firebase-init` (local) | Serves config from env vars; Firebase Hosting returns 403 if not deployed |
| `/__/firebase/:path*` | `https://{projectId}.firebaseapp.com/__/firebase/:path*` | Other Firebase assets |

**File**: `app/api/firebase-init/route.ts`

Local API route that serves the Firebase project config (`projectId`, `apiKey`, `authDomain`)
from `NEXT_PUBLIC_*` environment variables. Required because the Firebase Auth handler fetches
`/__/firebase/init.json` from the same origin, and Firebase Hosting may not be deployed.

### 3.6 Environment Variables

| Variable | Type | Description |
|----------|------|-------------|
| `GCP_PROJECT_ID` | Server | Already exists — for token verification |
| `NEXT_PUBLIC_GCP_PROJECT_ID` | Client | GCP project ID for Firebase client config |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Client | Firebase Web API key (from GCP console) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client | Custom domain for Google sign-in branding (e.g., `monitrax.com.au`). Falls back to `{projectId}.firebaseapp.com` if not set. |

---

## 4. Files to Create

| File | Purpose |
|------|---------|
| `lib/firebase/config.ts` | Firebase client SDK initialization |

## 5. Files to Modify

| File | Change |
|------|--------|
| `lib/context/AuthContext.tsx` | Add `loginWithGoogle()`, `loginWithGCPEmail()` methods |
| `app/login/page.tsx` | Wire buttons to Firebase Auth instead of custom OAuth |
| `middleware.ts` | Add Firebase domains to CSP |
| `.env.example` | Add `NEXT_PUBLIC_*` Firebase env vars |
| `package.json` | Add `firebase` dependency |

## 6. Files NOT Modified in Phase 2 (Later Updated in Phase 4 Cutover)

| File | Phase 2 Status | Phase 4 (Cutover) Status |
|------|---------------|-------------------------|
| `lib/auth.ts` | Unchanged | ✅ `verifyToken()` rewritten to verify GCP tokens |
| `lib/auth/context.ts` | Unchanged | ✅ `getAuthContext()` rewritten for GCP-only |
| `lib/middleware.ts` | Unchanged | ✅ `withAuth()` rewritten for GCP-only |
| `lib/auth/guards.ts` | Unchanged | Unchanged (uses `getAuthContext()`) |
| `app/api/auth/login/route.ts` | Preserved | Preserved (legacy, not used by GCP flow) |
| All existing API routes | Using Monitrax JWT | ✅ Now using GCP/Firebase ID tokens |

---

## 7. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Firebase SDK increases bundle size | Tree-shaking — only import `firebase/auth` |
| Existing users can't log in | Auto-sync handles both new and existing users by email |
| ~~Token mismatch~~ | ~~GCP token → sync → Monitrax JWT bridge~~ (eliminated in Phase 4 — GCP tokens used directly) |
| CSP blocks Firebase | Update middleware CSP headers + exclude `__/` paths from middleware matcher |
| Missing env vars in production | `isGCPIdentityConfigured()` check — falls back gracefully |

---

## 8. Testing Plan

- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Login page renders with Google button
- [ ] Google sign-in popup appears and authenticates
- [ ] GCP token syncs to local user
- [ ] Monitrax JWT returned and stored
- [ ] Dashboard loads after login
- [ ] Existing email/password login works via Firebase Auth
- [ ] Logout clears both Firebase and localStorage state

---

## 9. Migration Phases (Full Roadmap)

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 1** | Server-side token verification + user sync | ✅ Complete |
| **Phase 2** | Client-side Firebase SDK integration (this doc) | ✅ Complete |
| **Phase 3** | Firebase MFA integration | ✅ Complete |
| **Phase 4** | GCP-only cutover (all API routes verify GCP tokens) | ✅ Complete (Feb 26, 2026) |
| **Phase 5** | Legacy auth cleanup (remove unused JWT code) | ⏳ Future |

---

*Last Updated: 2026-02-27*
