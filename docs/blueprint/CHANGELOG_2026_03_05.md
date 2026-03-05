# Changelog - 2026-03-05

## Session: V6Y66 — Phase B: MFA Enforcement (CDR §1.3)

### Changes Made
- **Type**: Feature — CDR Security Hardening
- **Scope**: MFA enforcement on CDR data routes and admin routes
- **Root Cause**: MFA was supported (Firebase TOTP enrollment) but not enforced at the API layer. CDR data routes allowed access without MFA even when the organization policy required it.
- **Solution**: Created `withMFARequired()` guard that checks `user.mfaEnforcedByOrg` + `user.mfaEnabled` before allowing access. Applied to all Basiq/CDR routes. Added SUPER_ADMIN/BILLING_ADMIN MFA enforcement to admin auth.

### Files Modified
- `lib/auth/guards.ts` — Added `withMFARequired()` guard function + `prisma` import. Checks user's MFA enrollment against org enforcement policy.
- `app/api/basiq/connect/route.ts` — Changed from `withPermission` to `withMFARequired` for POST handler
- `app/api/basiq/connections/route.ts` — Changed from `withPermission` to `withMFARequired` for GET handler
- `app/api/basiq/connections/[id]/route.ts` — Changed from `withPermission` to `withMFARequired` for GET and DELETE handlers
- `app/api/basiq/sync/route.ts` — Changed from `withPermission` to `withMFARequired` for POST handler
- `lib/admin/auth.ts` — Added MFA enforcement check in `verifyAdminAuth()` for SUPER_ADMIN and BILLING_ADMIN roles

### Documentation Updated
- `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` — §1.3 status changed from PARTIAL to DONE
- `docs/blueprint/PHASE_34_CDR_SECURITY_HARDENING.md` — Sub-Phase 34.4 marked ✅ COMPLETE with completion summary
- `docs/blueprint/CDR_IMPLEMENTATION_PLAN.md` — Phase B marked ✅ COMPLETE, overall score updated to ~70%

### Build Status
- [x] TypeScript compilation passes
- [x] Build passes (`npm run build`)

### MFA Enforcement Logic

**User API routes (Basiq/CDR):**
- Guard: `withMFARequired(permission, handler)`
- Checks: `user.mfaEnforcedByOrg === true && user.mfaEnabled === false` → 403
- If org doesn't enforce MFA, access is allowed (per-org enforcement)
- Firebase handles actual MFA challenge/verification (GCP-First)

**Admin routes:**
- Check in `verifyAdminAuth()`: SUPER_ADMIN and BILLING_ADMIN must have `mfaEnabled === true`
- Returns `MFA_REQUIRED` error code if not enrolled
- SUPPORT_ADMIN and VIEWER admin roles not affected (lower privilege)

### CDR Compliance Impact
- Basiq §1.3 moves from PARTIAL → DONE
- Overall CDR compliance score: ~65% → ~70%
- Phase B is the 2nd of 8 CDR implementation phases complete
