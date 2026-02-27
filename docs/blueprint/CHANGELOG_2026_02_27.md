# Changelog - 2026-02-27

## Session: gcp-identity-migration-phase-V6Y66 (continued)

### Changes Made — Fix Google Sign-In Popup Completing Auth Flow
- **Type**: Bug Fix
- **Scope**: Authentication — Firebase Auth handler proxy, Middleware CSP
- **Description**: Fixed two issues preventing Google sign-in from completing after the user selects their Google account:
  1. **Middleware CSP blocking Firebase auth handler scripts**: The Next.js middleware was applying a strict Content-Security-Policy to the proxied `/__/auth/handler` page. The Firebase auth handler loads scripts from `gstatic.com`, `googleapis.com`, and other CDN domains not in our CSP `script-src` allowlist, causing those scripts to be blocked and the OAuth callback to fail silently.
  2. **`/__/firebase/init.json` returning 404/403**: The auth handler fetches `/__/firebase/init.json` from the same origin to discover the Firebase project config. Since Firebase Hosting is not deployed for the project, the proxy to `monitrax-479700.firebaseapp.com` returned 403. Created a local API route to serve the config.

### Files Created
- `app/api/firebase-init/route.ts` — API route that serves Firebase project config (`projectId`, `apiKey`, `authDomain`) from `NEXT_PUBLIC_*` environment variables. Replaces the broken proxy to Firebase Hosting.

### Files Modified
- `middleware.ts` — Added `__/` to the middleware matcher exclusion list so CSP headers are not applied to proxied Firebase auth handler pages (`/__/auth/*`, `/__/firebase/*`).
- `next.config.ts` — Added specific rewrite for `/__/firebase/init.json` → `/api/firebase-init` (local API route) before the general `/__/firebase/:path*` proxy. This ensures the auth handler gets a valid config response instead of a 403.

### Documentation Updated
- `docs/blueprint/CHANGELOG_2026_02_27.md` — This changelog
- `docs/blueprint/GCP_IDENTITY_MIGRATION_PHASE2.md` — Updated middleware CSP section and added custom domain proxy notes
- `docs/blueprint/MASTER_BLUEPRINT.md` — Added custom domain proxy requirements note

### Testing
- [x] Build passes (`npm run build`)
- [ ] Manual testing (deploy required to verify in production)

### PR
- PR URL: (pending — changes on branch `claude/gcp-identity-migration-phase-V6Y66`)
- Status: Open

---

## Session: gcp-identity-migration-phase-V6Y66 (continued — CSP & COOP fix)

### Changes Made — Fix CSP frame-src and COOP Headers Blocking Google Sign-In Popup
- **Type**: Bug Fix
- **Scope**: Authentication — Middleware CSP, Cross-Origin-Opener-Policy
- **Description**: After deploying the previous fix, Google sign-in still failed because:
  1. **CSP `frame-src` missing `'self'`**: Firebase SDK loads a hidden iframe at `/__/auth/iframe` on the same origin (`www.monitrax.com.au`) for popup-to-parent communication. The CSP's `frame-src` only allowed `https://*.firebaseapp.com`, `https://*.google.com`, and `https://accounts.google.com` — missing `'self'`. The browser blocked the iframe entirely, breaking the auth flow.
  2. **Cross-Origin-Opener-Policy severing popup communication**: The Firebase Hosting response for `/__/auth/handler` includes a COOP header that severs the `window.opener` relationship, preventing the popup from communicating the auth result back via `window.closed` checks.

### Files Modified
- `middleware.ts` — Added `'self'` to `frame-src` in the CSP directive. Added `Cross-Origin-Opener-Policy: same-origin-allow-popups` header so the parent window allows popup communication.
- `next.config.ts` — Added `headers()` config to set `Cross-Origin-Opener-Policy: unsafe-none` on `/__/auth/:path*` routes (which bypass middleware), overriding any COOP header from the proxied Firebase response.

### Documentation Updated
- `docs/blueprint/CHANGELOG_2026_02_27.md` — This entry

### Testing
- [x] Build passes (`npm run build`)
- [ ] Manual testing (deploy required to verify in production)

### PR
- PR URL: (pending)
- Status: Open

---

## Session: gcp-identity-migration-phase-V6Y66 (continued — CDR Security Audit & Implementation Plan)

### Changes Made — Phase 34: CDR Security Hardening Implementation Plan
- **Type**: Documentation / Planning
- **Scope**: CDR compliance, RBAC enforcement, MFA enforcement, audit logging, password hardening
- **Description**: Created Phase 34 implementation plan based on a comprehensive CDR compliance audit. The audit tested 8 CDR security controls against actual code and found that while security infrastructure is well-designed (GCP Identity Platform, 50+ RBAC permissions, ownership verification, admin sessions), several controls are defined but not enforced at runtime. Phase 34 closes these gaps in 5 independently deployable sub-phases with test gates between each.

### Audit Findings Summary
| CDR Control | Status |
|-------------|--------|
| User authentication for CDR data | PASS |
| Unique login accounts | PASS |
| No generic/shared accounts | PASS |
| MFA enabled | FAIL (supported, not enforced) |
| Strong passwords enforced | FAIL (min 8 chars, no complexity) |
| Role-based access control | PARTIAL FAIL (defined, not enforced on ~150 routes) |
| Least-privilege access | PARTIAL PASS |
| Admin account review & removal | PARTIAL PASS |

### Files Created
- `docs/blueprint/PHASE_34_CDR_SECURITY_HARDENING.md` — Full implementation plan with 5 sub-phases, test gates, file inventory, risk assessment, and acceptance criteria

### Files Modified
- `docs/blueprint/CHANGELOG_2026_02_27.md` — This entry
- `docs/blueprint/MASTER_BLUEPRINT.md` — Added Phase 34 to phase status table

### Documentation Updated
- `docs/blueprint/PHASE_34_CDR_SECURITY_HARDENING.md` — New Phase document (references, does not duplicate, existing Phase 10/24/32/33 docs)
- `docs/blueprint/MASTER_BLUEPRINT.md` — Phase 34 added to planned phases

### Testing
- [x] No code changes (documentation only)
- [x] Build unaffected

### PR
- PR URL: (pending)
- Status: Open
