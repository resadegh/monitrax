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

---

## Session: V6Y66 (continued — dashboard fix)

### Changes Made
- **Type**: Bug Fix
- **Scope**: Dashboard — Post-login data loading
- **Root Cause**: Race condition in `DashboardLayout` between `token` and `user` state during the GCP login flow.

### Root Cause Analysis

**Problem**: After logout → login, the dashboard showed 500 errors on `/api/portfolio/snapshot`, `/api/financial-health`, and `/api/linkage/health`. Navigating to another page and back fixed it.

**Investigation path** (Research-Before-Action Protocol followed):
1. Read `AuthContext.tsx` — understood Firebase auth flow and token timing
2. Read `app/login/page.tsx` and `app/signin/page.tsx` — confirmed navigation triggers on `token` change
3. Read all 3 failing API routes — confirmed they use `withAuth` and return 500 in catch blocks
4. Read `DashboardLayout.tsx` — **found the race condition**
5. Read `hooks/useUISyncEngine.ts` — confirmed it fires API calls from DashboardLayout before render guards

**Root cause**: `DashboardLayout` had a redirect guard:
```typescript
if (!isLoading && !user) router.push('/signin');
```
After login, `token` is set immediately by `handleSignIn → setToken()`, but `user` is still null (because `fetchUserProfile()` is async). The login page navigates to `/dashboard` based on `token`. DashboardLayout sees `!isLoading && !user` → redirects to `/signin`. This creates a rapid mount/unmount redirect loop. During this loop, `useUISyncEngine` (which runs before render guards due to hooks rules) fires API calls that get aborted on unmount, generating 500 errors. Even after the loop resolves (when `user` finally loads), the dashboard's `useEffect([token])` fires but may see stale error states.

### Solution

Two changes to `components/DashboardLayout.tsx`:

1. **Redirect guard** — Added `!token` to the condition:
   ```typescript
   if (!isLoading && !user && !token) router.push('/signin');
   ```
   This prevents redirect when token exists but profile is still loading.

2. **Loading state** — Extended the spinner guard:
   ```typescript
   if (isLoading || (token && !user)) return <Spinner>;
   ```
   Shows a loading spinner during the intermediate state where token is set but user profile hasn't been fetched from `/api/auth/me` yet.

### Files Modified
- `components/DashboardLayout.tsx` — Fixed redirect guard and loading state to handle token-without-user intermediate state
- `CLAUDE.md` — Added Part 11: Mandatory Change Documentation & Build Tracking (non-negotiable)

### Build Status
| Step | Status | Notes |
|------|--------|-------|
| After DashboardLayout fix | PASS | Clean build after `rm -rf .next` |
| Final build | PASS | All pages compiled, types valid |

### Commit History
| Hash | Message |
|------|---------|
| 34cecf5 | fix(security): align CDR audit logging with GCP Identity Platform |
| ba3e2e9 | fix(dashboard): resolve race condition causing 500 errors after login |

### Testing
- [x] Build passes (`npm run build`)
- [x] TypeScript compilation passes

### Blueprint Alignment
- Follows: `docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md` (GCP Identity Platform auth flow)
- Follows: `docs/blueprint/PHASE_07_DASHBOARD_REBUILD.md` (Dashboard data loading)

---

## Session: V6Y66 (continued — CDR compliance documentation)

### Changes Made
- **Type**: Documentation / Compliance
- **Scope**: CDR compliance tracking and build requirements
- **Description**: Created comprehensive CDR/Basiq compliance matrix mapping all 54 accreditation requirements. Added CDR compliance rules (Part 13) to CLAUDE.md for enforceable build-time checks.

### Files Created
- `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` — Full Basiq accreditation requirement tracking (54 requirements across 9 sections: Auth, Logging, System Security, Device Management, CDR Data Handling, Dev Practices, HR, GCP Tools, Other Tools). Each requirement has status (DONE/PARTIAL/TODO/N/A), implementation details, gap analysis, and response guidance. Includes 4-tier priority roadmap and overall compliance score (~55%).

### Files Modified
- `CLAUDE.md` — Added Part 13: CDR Compliance — Consumer Data Right (9 sub-sections)
  - §13.1 CDR Data Classification (protected vs derived vs non-CDR)
  - §13.2 Consent Lifecycle (consent-gated access, expiry/revocation → data deletion)
  - §13.3 CDR Data Protection in Code (never log, never cache, never expose)
  - §13.4 CDR-Specific Auth Guards (cdr_data.read/write/delete permissions)
  - §13.5 CDR Data Retention (policy rules)
  - §13.6 Environment Separation (prod-only CDR data, synthetic for dev)
  - §13.7 CDR Compliance Checklist (pre-change checks)
  - §13.8 Required Policy Documents (5 docs for Basiq accreditation)
  - §13.9 GCP Services Required for CDR (7 services with priority)
  - Also: Added CDR compliance matrix to Step 1 reading list, added CDR checks to §12.11 pre-session checklist
  - Protocol version bumped to 1.5

### Documentation Updated
- `CLAUDE.md` — Part 13 CDR Compliance, pre-session checklist extended
- `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` — New compliance tracking document

### Compliance Summary
| Category | Score | Key Gaps |
|----------|-------|----------|
| Auth & Access | 70% | RBAC enforcement (Phase 34.3), MFA guard wiring (Phase 34.4) |
| Logging | 85% | Automated alerting, formal retention policy |
| System Security | 50% | Cloud Armor, dependency scanning, security testing |
| CDR Data Handling | 30% | Consent lifecycle service, data deletion automation, de-identification |
| Dev Practices | 60% | Test coverage for CDR paths, Dependabot |
| GCP Tools | 20% | Cloud Armor, SCC, KMS, Logging, Monitoring, DLP |
| **Overall** | **~55%** | CDR data lifecycle is the largest gap |

### Commit History
| Hash | Message |
|------|---------|
| 8a29a88 | docs(cdr): add comprehensive Basiq CDR compliance matrix |
| (pending) | docs(claude): add Part 13 CDR compliance rules to CLAUDE.md |

### Testing
- [x] Documentation changes only — no code changes
- [ ] Build verification (documentation only, no code impact)

### Blueprint Alignment
- Follows: `docs/blueprint/PHASE_34_CDR_SECURITY_HARDENING.md`
- Follows: `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md`
