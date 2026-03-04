# Changelog - 2026-03-04

## Session: migrate-withauth-to-withpermission-23routes

### Changes Made
- **Type**: Refactor
- **Scope**: API Routes - Authentication Guards
- **Description**: Migrated 23 API route files from the deprecated `withAuth` middleware pattern (`@/lib/middleware`) to the new `withPermission` guard pattern (`@/lib/auth/guards`). This enforces RBAC (Role-Based Access Control) with granular permissions on all migrated routes.

### Migration Pattern Applied
- Import: `@/lib/middleware` -> `@/lib/auth/guards`, `withAuth` -> `withPermission`
- Removed `AuthenticatedRequest` type imports
- Changed `export async function METHOD(request)` -> `export const METHOD = withPermission(...)`
- Changed `authReq.user!.userId` -> `auth.userId`
- Changed `{ params }` -> `context!.params` for parameterized routes
- Removed unnecessary `NextRequest` imports where no longer directly used

### Permission Mapping Applied
| Route Group | GET Permission | POST/PUT Permission | DELETE Permission |
|---|---|---|---|
| household-members | settings.read | settings.write | settings.write |
| household-pets | settings.read | settings.write | settings.write |
| household-profile | settings.read | settings.write | - |
| onboarding/* | settings.read | settings.write | - |
| categories | settings.read | settings.write | settings.write |
| settings/profile | settings.read | settings.write | - |
| settings/categorization | settings.read | settings.write | - |
| assets | investment.read | investment.write | investment.delete |
| recurring-payments/link | - | expense.write | expense.write |
| recurring-payments/match | expense.read | expense.write | - |
| bank/import | account.read | account.write | - |
| bank/preview | - | account.write | - |
| auth/me | security.read | - | - |
| search | report.read | - | - |
| linkage/health | report.read | - | - |
| portfolio/snapshot | report.read | - | - |
| master-snapshot | report.read | - | - |

### Files Modified
- `app/api/household-members/route.ts` - Migrated GET/POST to withPermission
- `app/api/household-members/[id]/route.ts` - Migrated GET/PUT/DELETE to withPermission
- `app/api/household-pets/route.ts` - Migrated GET/POST to withPermission
- `app/api/household-pets/[id]/route.ts` - Migrated GET/PUT/DELETE to withPermission
- `app/api/household-profile/route.ts` - Migrated GET/POST to withPermission
- `app/api/onboarding/bulk-create/route.ts` - Migrated POST to withPermission
- `app/api/onboarding/complete/route.ts` - Migrated POST to withPermission
- `app/api/onboarding/state/route.ts` - Migrated GET/POST to withPermission
- `app/api/categories/route.ts` - Migrated GET/POST to withPermission
- `app/api/categories/[id]/route.ts` - Migrated GET/PUT/DELETE to withPermission
- `app/api/settings/profile/route.ts` - Migrated GET/PUT to withPermission
- `app/api/settings/categorization/route.ts` - Migrated GET/PUT to withPermission
- `app/api/assets/route.ts` - Migrated GET/POST to withPermission
- `app/api/assets/[id]/route.ts` - Migrated GET/PUT/DELETE to withPermission
- `app/api/recurring-payments/[id]/link/route.ts` - Migrated POST/DELETE/PATCH to withPermission
- `app/api/recurring-payments/match/route.ts` - Migrated GET/POST to withPermission
- `app/api/bank/import/route.ts` - Migrated POST/GET to withPermission
- `app/api/bank/preview/route.ts` - Migrated POST to withPermission
- `app/api/auth/me/route.ts` - Migrated GET to withPermission
- `app/api/search/route.ts` - Migrated GET to withPermission
- `app/api/linkage/health/route.ts` - Migrated GET to withPermission
- `app/api/portfolio/snapshot/route.ts` - Migrated GET to withPermission
- `app/api/master-snapshot/route.ts` - Migrated GET to withPermission

### Documentation Updated
- `docs/blueprint/CHANGELOG_2026_03_04.md` - Created this changelog entry

### Build Status
- [x] TypeScript compilation passes
- [x] Build passes (`npm run build`)
- [ ] Lint - ESLint not configured at project level (pre-existing issue)

### Testing
- [x] Build passes
- [ ] Manual testing completed

---

## Session: admin-portal-typescript-fixes

### Changes Made
- **Type**: Bug Fix
- **Scope**: Admin Portal - TypeScript Compilation Errors
- **Root Cause**: Code was written with assumptions about Prisma types that didn't match the actual schema:
  1. `AuditAction` is an enum (not a string), so `contains` operator doesn't work
  2. Invalid enum values like `LOGIN_SUCCESS`, `CDR_DATA_DELETED` were used that don't exist
  3. `FeatureAccess` interface was missing `audit` property
  4. `useSearchParams()` wasn't wrapped in Suspense boundary (Next.js requirement)

### Files Modified
- `app/api/admin/analytics/feature-usage/route.ts` - Changed from `action: { contains: }` to filtering by `entityType` only (string field supports contains)
- `app/api/admin/cdr/compliance/route.ts` - Fixed invalid enum values:
  - `CDR_DATA_DELETED` → `action: 'DELETE'` with `entityType` filter
  - `LOGIN_SUCCESS/LOGIN_FAILURE/ADMIN_LOGIN` → `action: 'LOGIN'`
- `app/api/admin/security/route.ts` - Fixed invalid enum values:
  - `LOGIN_SUCCESS/ADMIN_LOGIN` → `action: 'LOGIN', status: 'SUCCESS'`
  - `LOGIN_FAILURE/ADMIN_LOGIN_FAILED` → `action: 'LOGIN', status: 'FAILURE'`
  - `action: { contains: 'MFA' }` → explicit enum values `MFA_CHALLENGE/MFA_SUCCESS/MFA_FAILURE`
- `lib/admin/permissions.ts` - Added `audit: { read: boolean; export: boolean }` to `FeatureAccess` interface and `getFeatureAccess()` function
- `app/admin/support/logs/page.tsx` - Split page into `LogsPageContent` (with `useSearchParams`) wrapped by `<Suspense>` with loading fallback

### Valid AuditAction Enum Values (Reference)
```
AUTH: LOGIN, LOGOUT, REGISTER, MFA_CHALLENGE, MFA_SUCCESS, MFA_FAILURE, PASSWORD_CHANGE, PASSWORD_RESET, EMAIL_VERIFIED, OAUTH_LOGIN
PASSKEY: PASSKEY_REGISTER, PASSKEY_UPDATE, PASSKEY_DELETE
CRUD: CREATE, READ, UPDATE, DELETE
SPECIAL: EXPORT, BULK_DELETE, API_REQUEST
ADMIN: ROLE_CHANGE, ORG_MEMBER_ADD, ORG_MEMBER_REMOVE, ORG_SETTINGS_UPDATE, SESSION_REVOKE, ACCOUNT_LOCK, ACCOUNT_UNLOCK, ACCOUNT_LOCKED, ACCOUNT_UNLOCKED
SECURITY: RATE_LIMIT_HIT, UNAUTHORIZED_ACCESS, FORBIDDEN_ACCESS
```

### Build Status
- [x] TypeScript compilation passes
- [x] Build passes (`npm run build`)
- [x] Vercel deployment successful

### Commits
| Hash | Message |
|------|---------|
| 44ac533 | fix(admin): Fix TypeScript error in feature-usage route |
| 8ecdaef | fix(admin): Fix TypeScript errors with AuditAction enum filters |
| 35673f5 | fix(admin): Use valid AuditAction enum values in queries |
| 6bdb71b | fix(admin): Add 'audit' to FeatureAccess interface |
| 53b16df | fix(admin): Wrap useSearchParams in Suspense boundary |

### Documentation Updated
- `docs/blueprint/CHANGELOG_2026_03_04.md` - Added this session entry

### PR
- Branch: `claude/admin-monetization-licenses-Gf7rU`
- Status: Ready for merge

https://claude.ai/code/session_011fH9YkUH1pNuAmeCG9mvPB
