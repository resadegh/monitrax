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
- PR URL: (pending)
- Status: Open
