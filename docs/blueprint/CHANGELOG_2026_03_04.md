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
