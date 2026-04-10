# Changelog - 2026-02-25

## Session: gcp-identity-migration-phase-V6Y66

### Changes Made
- **Type**: Feature (Phase 1 of GCP Identity Platform Migration)
- **Scope**: Authentication - GCP Identity Platform integration
- **Description**: Added server-side GCP Identity Platform token verification and user sync capabilities. This is Phase 1 of migrating from custom JWT auth to GCP Identity Platform. The implementation is purely additive — no existing auth code was modified or removed. The existing JWT-based auth system continues to function as-is.

### Architecture Decisions
- **Additive only**: Zero modifications to existing auth, session, MFA, or financial logic
- **Token bridge pattern**: GCP ID tokens are verified server-side, then a Monitrax JWT is issued for backward-compatible API authorization
- **OAuthAccount reuse**: Uses the existing `OAuthAccount` Prisma model with provider='gcp-identity' to store the GCP UID mapping
- **google-auth-library**: Uses Google's official `OAuth2Client.verifyIdToken()` for token verification (no Firebase Admin SDK dependency)

### Files Created
- `lib/auth/gcpIdentity.ts` - Core GCP Identity Platform service (user sync, lookup, unlink)
- `lib/auth/gcpTokenVerifier.ts` - GCP ID token verification using google-auth-library
- `app/api/auth/gcp/sync/route.ts` - POST /api/auth/gcp/sync (verify token + sync user + return Monitrax JWT)
- `app/api/auth/gcp/verify/route.ts` - POST /api/auth/gcp/verify (verify token only, for debugging/health checks)
- `docs/blueprint/CHANGELOG_2026_02_25.md` - This changelog

### Files Modified
- `lib/auth/index.ts` - Added GCP Identity exports to barrel file
- `package.json` - Added `google-auth-library` dependency
- `.env.example` - Added `GCP_PROJECT_ID` environment variable

### Documentation Updated
- `docs/blueprint/CHANGELOG_2026_02_25.md` - Created

### New API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/gcp/sync` | Verify GCP token, sync user to local DB, return Monitrax JWT |
| POST | `/api/auth/gcp/verify` | Verify GCP token only (debugging/health check) |

### Environment Variables Added
| Variable | Required | Description |
|----------|----------|-------------|
| `GCP_PROJECT_ID` | Yes (for GCP auth) | GCP project ID for token audience validation |

### Testing
- [x] Build passes (`npm run build`)
- [ ] Manual testing with GCP Identity Platform tokens (requires GCP_PROJECT_ID configuration)

### Migration Phase Status
- **Phase 1** (this PR): Server-side token verification + user sync ✅
- **Phase 2** (next): Client-side Firebase SDK integration
- **Phase 3** (future): Dual-mode middleware
- **Phase 4** (future): Full cutover + legacy cleanup

### PR
- PR URL: (pending)
- Status: Open

---

## Session: gcp-identity-migration-phase-V6Y66 (Phase 2)

### Changes Made
- **Type**: Feature (Phase 2 of GCP Identity Platform Migration)
- **Scope**: Authentication - Client-side Firebase SDK integration
- **Description**: Integrated the Firebase client SDK into the frontend to enable GCP Identity Platform authentication. Login, signin, and register pages now use Firebase Auth for Google sign-in (popup) and email/password authentication when GCP is configured. The existing legacy OAuth flow is preserved as a fallback when GCP env vars are not set.

### Architecture Decisions
- **Additive + backward-compatible**: When `NEXT_PUBLIC_FIREBASE_API_KEY` and `NEXT_PUBLIC_GCP_PROJECT_ID` are set, Firebase Auth handles login. When not set, the legacy custom OAuth flow continues to work unchanged.
- **Token bridge preserved**: Firebase Auth → GCP ID Token → `POST /api/auth/gcp/sync` → Monitrax JWT. All existing API routes continue to use Monitrax JWTs.
- **Firebase Auth popup for Google**: Uses `signInWithPopup()` instead of server-side redirect, keeping the user on the page.
- **Firebase Auth email/password**: Uses `signInWithEmailAndPassword()` and `createUserWithEmailAndPassword()` for email login/register.
- **CSP updated**: Middleware CSP now allows Firebase/Google domains for `connect-src`, `frame-src`, and `script-src`.

### Files Created
- `lib/firebase/config.ts` - Firebase client SDK initialization (singleton pattern)
- `docs/blueprint/GCP_IDENTITY_MIGRATION_PHASE2.md` - Phase 2 blueprint document

### Files Modified
- `lib/context/AuthContext.tsx` - Added `loginWithGoogle()`, GCP-aware `login()` and `register()`, Firebase sign-out on `logout()`
- `app/login/page.tsx` - Google button uses Firebase Auth popup when GCP enabled; Firebase error mapping
- `app/signin/page.tsx` - Same updates as login page
- `app/register/page.tsx` - Google sign-up button uses Firebase Auth popup when GCP enabled
- `middleware.ts` - CSP updated to allow Firebase/GCP domains
- `.env.example` - Added `NEXT_PUBLIC_GCP_PROJECT_ID` and `NEXT_PUBLIC_FIREBASE_API_KEY`
- `package.json` - Added `firebase` dependency

### Environment Variables Added
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_GCP_PROJECT_ID` | Yes (for GCP auth) | GCP project ID for Firebase client config |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes (for GCP auth) | Firebase Web API key |

### Testing
- [x] Build passes (`npm run build`)
- [ ] Manual testing: Google sign-in popup with GCP Identity Platform
- [ ] Manual testing: Email/password login via Firebase Auth
- [ ] Manual testing: Legacy OAuth fallback when GCP not configured

### Migration Phase Status
- **Phase 1**: Server-side token verification + user sync ✅
- **Phase 2** (this session): Client-side Firebase SDK integration ✅
- **Phase 3** (future): Dual-mode middleware
- **Phase 4** (future): Full cutover + legacy cleanup

### PR
- PR URL: (pending)
- Status: Open
