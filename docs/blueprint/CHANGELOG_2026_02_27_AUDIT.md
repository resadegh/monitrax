# Changelog - 2026-02-27 (Audit Logs Consolidation)

## Session: V6Y66

### Changes Made
- **Type**: Enhancement
- **Scope**: Admin Portal — Audit Logs
- **Description**: Consolidated all audit log viewing into a single canonical admin portal page. Eliminated duplicate UIs and wired the frontend to real API endpoints.

### Architecture Decision
- All audit-related functionality is managed through the Admin Portal (`/admin/audit-logs`)
- Legacy audit page at `/dashboard/admin/audit-logs` is marked `@deprecated` for deletion when all tests pass
- The settings page no longer contains an audit tab (replaced with a link to the dedicated page)

### What Changed

#### New Files
- `app/admin/audit-logs/page.tsx` — Canonical audit log viewer in admin portal
- `app/api/admin/audit/export/route.ts` — CSV export endpoint for audit logs

#### Modified Files
- `app/api/admin/audit/route.ts` — Expanded to support both `AdminAuditLog` and user `AuditLog` tables via `?source=admin|user|all`
- `app/admin/settings/page.tsx` — Removed mock audit tab, replaced with link to `/admin/audit-logs`
- `components/admin/layout/AdminSidebar.tsx` — Added "Audit Logs" nav item to sidebar
- `lib/admin/constants.ts` — Added `ADMIN_ROUTES.AUDIT_LOGS` route constant

#### Legacy (Marked for Deletion)
- `app/dashboard/admin/audit-logs/page.tsx` — `@deprecated`, replace by `/admin/audit-logs`

### API Changes

#### `GET /api/admin/audit`
New query parameter: `source` (values: `admin`, `user`, `all`)
- `all` (default): Queries both `AdminAuditLog` and `AuditLog` tables, merges by timestamp
- `admin`: Only `AdminAuditLog` records
- `user`: Only `AuditLog` records (user-level CRUD, auth, security events)

Normalized response shape:
```json
{
  "id": "uuid",
  "source": "admin|user",
  "action": "string",
  "status": "SUCCESS|FAILURE|BLOCKED",
  "category": "string|null",
  "description": "string|null",
  "actor": "string|null",
  "actorEmail": "string|null",
  "entityType": "string|null",
  "entityId": "string|null",
  "ipAddress": "string|null",
  "metadata": "any",
  "timestamp": "ISO8601"
}
```

#### `GET /api/admin/audit/export` (NEW)
- Exports audit logs as CSV
- Supports same filters as main endpoint
- Max 10,000 rows per export
- Requires `audit:export` permission

### Consolidation Summary

| Before | After |
|--------|-------|
| `/dashboard/admin/audit-logs` (wrong endpoint, user dashboard area) | `/admin/audit-logs` (admin portal) |
| `/admin/settings?tab=audit` (mock data) | Removed — link to `/admin/audit-logs` |
| API only queried `AdminAuditLog` | API queries both `AdminAuditLog` + `AuditLog` |
| No export endpoint | `GET /api/admin/audit/export` (CSV) |

### Testing
- [x] Build passes (`npm run build`)
- [ ] Manual testing: verify audit logs display in admin portal
- [ ] Manual testing: verify CSV export downloads correctly
- [ ] Manual testing: verify source tabs (All/Admin/User) filter correctly

### PR
- Status: Open
