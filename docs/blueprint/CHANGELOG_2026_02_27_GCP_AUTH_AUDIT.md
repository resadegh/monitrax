# Changelog - 2026-02-27 (GCP Auth Event Logging)

## Session: V6Y66 (continued)

### Changes Made
- **Type**: Fix / Architecture Alignment
- **Scope**: Audit Logging — Auth events
- **Description**: Aligned CDR audit logging with GCP Identity Platform architecture. Moved auth event logging from legacy (dead) local auth routes to the actual GCP auth boundary in `syncGCPUser()`.

### Architecture Decision

**Problem identified**: The previous session added `logAuth()` calls to `/api/auth/login` and `/api/auth/register`. However, these routes are **legacy dead code** — the frontend uses Firebase Auth SDK directly (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`). The Monitrax JWT tokens these routes generate are incompatible with `withAuth()` middleware which only verifies GCP/Firebase ID tokens.

**Solution**: Move auth event logging to the actual GCP auth boundary:
1. `syncGCPUser()` in `lib/auth/gcpIdentity.ts` — the only server-side entry point for GCP-authenticated users
2. Logs `OAUTH_LOGIN` for returning users and `REGISTER` for new users created via GCP
3. The `withAuth` middleware in `lib/middleware.ts` already logs `API_REQUEST` for every authenticated request

**Auth event capture architecture (post-fix)**:
| Event | Capture Location | Action |
|-------|-----------------|--------|
| GCP user first sync | `syncGCPUser()` | `REGISTER` |
| GCP user returns | `syncGCPUser()` | `OAUTH_LOGIN` |
| Every API request | `withAuth()` middleware | `API_REQUEST` |
| GCP login/MFA/password | GCP Console audit logs | External |

### Files Modified
- `lib/auth/gcpIdentity.ts` — Added `OAUTH_LOGIN` and `REGISTER` audit events at GCP sync boundary
- `app/api/auth/login/route.ts` — Removed dead `logAuth` calls, added `@deprecated` JSDoc
- `app/api/auth/register/route.ts` — Removed dead `logAuth` calls, added `@deprecated` JSDoc
- `app/api/admin/audit/compliance/route.ts` — Updated auth check to include `OAUTH_LOGIN`, added `authProvider` field
- `app/admin/audit-logs/page.tsx` — Updated compliance panel to show GCP as auth provider
- `CLAUDE.md` — Added Part 10: Research-Before-Action Protocol (permanent behavioral rule)

### Documentation Updated
- `CLAUDE.md` — New Part 10 ensures all future sessions read blueprint docs and verify assumptions before making changes

### Testing
- [x] Build passes (`npm run build`)
- [x] TypeScript compilation passes

### Blueprint Alignment
- Follows: `docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md` (GCP Identity Platform)
- Follows: `docs/blueprint/01_ARCHITECTURE_OVERVIEW.md` §6.1 (GCP as sole identity provider)
