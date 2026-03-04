# Changelog - 2026-03-03

## Session: V6Y66 (continuation)

### Changes Made
- **Type**: Feature (CDR Compliance — Phase A RBAC Enforcement)
- **Scope**: All user API routes (~99 handlers across 70+ files)
- **Description**: Complete migration of all API routes from bare `withAuth()` (middleware.ts) to permission-enforced `withPermission()` (guards.ts). Added CDR audit logging to all permission guards.

### Root Cause
Basiq CDR accreditation requirements §1.5 and §1.6 mandate role-based access control (RBAC) on all API endpoints. The existing `withAuth()` only verified authentication, not authorization. Routes needed to be migrated to `withPermission()` which checks both authentication and role-based permission grants.

### Solution
1. Added `logApiRequest()` and `deriveEntityType()` helpers to `lib/auth/guards.ts` for CDR-compliant audit logging (fire-and-forget pattern matching middleware.ts)
2. Migrated ALL user API routes module-by-module:
   - Accounts (5 files, 10 handlers)
   - Loans (2 files, 5 handlers)
   - Income (2 files, 5 handlers)
   - Expenses (4 files, 6 handlers)
   - Investments (7 files, 14 handlers)
   - Basiq/CDR (4 files, 8 handlers)
   - Transactions (6 files, 10 handlers)
   - Unified Transactions (5 files, 9 handlers)
   - Cashflow (5 files, 8 handlers)
   - Household (5 files, 10 handlers)
   - AI (6 files, 6 handlers)
   - Strategy (8 files, 12 handlers)
   - Budget (5 files, 7 handlers)
   - Calculate (7 files, 8 handlers)
   - Reports, Snapshots, Settings, Assets, Auth, Search, Bank, Debug, Linkage, Onboarding, Categories, Recurring Payments
3. Fixed invalid permission strings (e.g., `report.write` → `report.export`)
4. Verified zero remaining `from '@/lib/middleware'` references in `app/api/`

### Files Modified
- `lib/auth/guards.ts` — Added CDR audit logging to all guard functions
- `app/api/**/*.ts` — 70+ route files migrated from withAuth to withPermission

### Build Status
- [x] TypeScript compilation passes (`npx tsc --noEmit`)
- [x] Zero `withAuth` references remain in API routes

### Commit History
| Hash | Message |
|------|---------|
| 6e3026d | feat(security): add CDR audit logging to all permission guards |
| b7723b7 | feat(rbac): migrate Accounts module to withPermission guards |
| 458065b | feat(rbac): migrate Loans and Income modules to withPermission guards |
| 418a9bf | feat(rbac): migrate Expenses and Investments modules to withPermission guards |
| 27ddcb3 | feat(rbac): migrate Transactions, Cashflow, Basiq, Household, and AI modules |
| c7b4fa9 | feat(rbac): migrate AI, Strategy, Budget, Calculate, Assets, etc. |
| c64bd05 | feat(rbac): migrate all remaining API routes — Phase A complete |
| a471638 | fix(rbac): correct invalid permission strings and linter formatting |

### PR
- PR URL: https://github.com/resadegh/monitrax/pull/438
- Status: Open

### CDR Compliance Impact
- **Basiq §1.5 (RBAC)**: DONE — All routes enforce role-based permissions
- **Basiq §1.6 (Least privilege)**: DONE — Granular permissions per entity type
- **CDR Audit Logging**: DONE — Every API request logged with sanitized metadata
