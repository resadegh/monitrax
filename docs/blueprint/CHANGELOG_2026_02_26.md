# Changelog - 2026-02-26

## Session: gcp-identity-migration-phase-V6Y66

### Changes Made
- **Type**: Feature
- **Scope**: Authentication / MFA / GCP Identity Platform
- **Description**: Integrated Firebase MFA (TOTP) into the authentication flow. When GCP Identity Platform is configured, users can enroll TOTP authenticator apps via the Settings → Security MFA page. During sign-in, Firebase automatically challenges for the second factor, and a global MFA dialog handles code entry. Legacy Monitrax MFA (TOTP/SMS via Twilio) is preserved for non-GCP mode.

### Files Created
- `lib/firebase/mfa.ts` — Firebase MFA client-side helpers (enrollment, sign-in resolution, factor management)
- `components/auth/MFAChallengeDialog.tsx` — Global MFA challenge dialog component
- `docs/blueprint/GCP_IDENTITY_MIGRATION_PHASE3_MFA.md` — Phase 3 specification document

### Files Modified
- `lib/context/AuthContext.tsx` — Added MFA challenge state, resolution methods, Firebase user tracking via `onAuthStateChanged`
- `app/layout.tsx` — Mounted MFAChallengeDialog globally inside AuthProvider
- `app/dashboard/settings/security-mfa/page.tsx` — Dual-mode: Firebase MFA enrollment (GCP) vs legacy Monitrax MFA
- `app/signin/page.tsx` — MFA-aware login flow with useEffect-based navigation
- `app/login/page.tsx` — MFA-aware login flow with useEffect-based navigation

### Documentation Updated
- `docs/blueprint/GCP_IDENTITY_MIGRATION_PHASE3_MFA.md` — New Phase 3 specification
- `docs/blueprint/CHANGELOG_2026_02_26.md` — This changelog

### Testing
- [x] Build passes
- [ ] Lint passes (ESLint not configured in project)
- [ ] Manual testing completed (requires GCP MFA enabled in console)

### PR
- PR URL: #424
- Status: Open

---

## Session: gcp-identity-migration-phase-V6Y66 (continued)

### Changes Made — GCP-Only Auth Cutover
- **Type**: Feature / Refactor
- **Scope**: Authentication — All API route auth entry points
- **Description**: Completed GCP-only authentication cutover. GCP Identity Platform is now the sole identity provider. All three server-side auth entry points (`getAuthContext`, `withAuth`, `verifyToken`/`getCurrentUser`) now verify GCP/Firebase ID tokens directly — no Monitrax JWTs are issued or verified for API authentication. The `AuthContext.tsx` client component uses Firebase `onIdTokenChanged` as the single source of truth, sending Firebase ID tokens directly to API routes without an intermediary sync hop.

### Files Modified
- `lib/auth.ts` — `verifyToken()` rewritten to verify GCP/Firebase ID tokens via `verifyGCPIdToken()` + local user lookup by GCP UID. `getCurrentUser()` updated to use new async `verifyToken()`. Cookie fallback removed (Firebase SDK manages tokens).
- `lib/auth/context.ts` — `getAuthContext()` rewritten to verify GCP tokens directly, auto-sync users on first API call via `syncGCPUser()`.
- `lib/middleware.ts` — `withAuth()` rewritten to verify GCP tokens, auto-sync users on first request.
- `lib/auth/gcpIdentity.ts` — Removed `token` field from `GCPUserSyncResult`, removed `generateToken` dependency. Function only creates/links local user record.
- `lib/context/AuthContext.tsx` — Rewritten for GCP-only: uses `onIdTokenChanged`, no `/api/auth/gcp/sync` hop, registration calls `updateProfile({ displayName })` + force token refresh.
- `app/api/auth/gcp/sync/route.ts` — Removed `result.token` reference, updated comments to reflect no JWT issuance.

### Architecture Impact
All ~95 API routes that use `withAuth()` or `verifyToken()` are now automatically authenticating via GCP Identity Platform with zero code changes required in individual routes. The `getAuthContext()` function used by newer routes also verifies GCP tokens. This achieves the user's goal: "use GCP wherever possible, not duplicate or recreate it in the app."

### Auth Entry Points Summary
| Entry Point | Location | Status |
|---|---|---|
| `getAuthContext()` | `lib/auth/context.ts` | ✅ GCP-only |
| `withAuth()` | `lib/middleware.ts` | ✅ GCP-only |
| `verifyToken()` | `lib/auth.ts` | ✅ GCP-only |
| `getCurrentUser()` | `lib/auth.ts` | ✅ GCP-only |

### Testing
- [x] Build passes (`npm run build`)
- [ ] Manual testing (requires GCP Identity Platform configured)

### PR
- PR URL: #425
- Status: Open

---

## Session: gcp-identity-migration-phase-V6Y66 (documentation update)

### Changes Made — Blueprint Documentation Alignment
- **Type**: Documentation
- **Scope**: All blueprint documents referencing authentication
- **Description**: Updated all blueprint and phase documents to reflect the GCP Identity Platform cutover. Removed all references to Clerk.dev/Auth0/Supabase as identity providers. Documented the current GCP-only architecture including all auth entry points, token verification flow, and legacy code status.

### Documents Updated
- `docs/blueprint/MASTER_BLUEPRINT.md` — Changed auth tech stack from Clerk.dev to GCP Identity Platform. Updated auth section with all entry points. Updated Common Imports section. Added GCP cutover note to Phase 10 status.
- `docs/blueprint/01_ARCHITECTURE_OVERVIEW.md` — Rewrote Section 6 (Security Architecture) with GCP Identity Platform details, auth entry points table, and security features list. Fixed outdated build command in Section 8.2 (removed `prisma db push`).
- `docs/blueprint/07_API_STANDARDS.md` — Rewrote Section 7 (Authentication & Security) from Clerk/Supabase/Auth0 JWT to GCP Identity Platform token verification. Added code examples for all three auth entry points.
- `docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md` — Rewrote Section 3 (Identity Provider Integration) to document GCP as chosen provider. Updated status from "PAUSED at 45%" to include GCP cutover completion note. Updated design decisions. Documented what GCP manages vs what Monitrax manages locally.
- `docs/blueprint/GCP_IDENTITY_MIGRATION_PHASE2.md` — Marked as Complete. Updated architecture diagram to show Phase 4 (GCP-only) flow. Updated files-not-modified table with Phase 4 status. Updated migration roadmap (Phase 4 complete). Fixed risk assessment (token mismatch eliminated).
- `docs/blueprint/GCP_IDENTITY_MIGRATION_PHASE3_MFA.md` — Updated sign-in flow to remove `/api/auth/gcp/sync` endpoint reference. Updated step 8-9 of MFA sign-in flow. Marked Phase 4 as complete in migration roadmap.

### Legacy Code Tracking
The following legacy code is retained but no longer used for API authentication:
- `generateToken()` in `lib/auth.ts` — still used by login/register routes during migration
- `/api/auth/login` — legacy login route (not used by GCP flow)
- `/api/auth/register` — legacy register route (not used by GCP flow)
- `/api/auth/gcp/sync` — sync endpoint (bypassed in GCP-only flow, retained for compatibility)
- `lib/security/mfa.ts` — custom Monitrax TOTP/SMS backend (superseded by Firebase MFA)
- `lib/auth/magicLink.ts` — uses `generateToken()` for magic link tokens
- `lib/session/sessionTracking.ts` — uses `generateToken()` for session tokens

These will be cleaned up in a future Phase 5 (Legacy Auth Cleanup).

### Testing
- [x] Build passes (`npm run build`)

### PR
- PR URL: #425 (updated)
- Status: Open

---

## Session: gcp-identity-migration-phase-V6Y66 (auth header fix)

### Changes Made — Fix Missing Authorization Headers
- **Type**: Bug Fix
- **Scope**: Client-side fetch calls across hooks, components, and pages
- **Description**: After the GCP-only auth cutover, all API calls must include the Firebase ID token as a Bearer token in the Authorization header. Several components and hooks were making fetch calls without this header, causing 401 errors on authenticated endpoints (most visibly `/api/onboarding/state` — the "state" 401 the user reported).

### Root Cause
These components were written before the GCP migration when auth was cookie-based (implicit). GCP Identity Platform uses explicit Bearer tokens that must be passed in every request.

### Files Modified
- `hooks/useOnboardingState.ts` — Added `token` from `useAuth()` to all 3 fetch calls. Added token to `useCallback`/`useEffect` dependencies. Added guard to skip fetch when token not yet available.
- `components/strategy/ForecastChart.tsx` — Added `useAuth()` and auth headers to 3 forecast API calls
- `components/strategy/ConflictResolver.tsx` — Added `useAuth()` and auth headers to conflicts fetch + resolution PATCH calls
- `app/(dashboard)/strategy/preferences/page.tsx` — Added `useAuth()` and auth headers to preferences GET/PUT
- `app/admin/dashboard/page.tsx` — Added `useAuth()` and auth header to admin dashboard fetch

### Testing
- [x] Build passes (`npm run build`)
