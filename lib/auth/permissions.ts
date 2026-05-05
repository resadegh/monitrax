/**
 * RBAC Permission System
 * Role-based access control for Monitrax entities
 * Phase 10: Updated for enterprise-grade authorization
 */

// Define UserRole locally to avoid Prisma client dependency
// Must match the enum in prisma/schema.prisma
export type UserRole = 'OWNER' | 'ADMIN' | 'CONTRIBUTOR' | 'VIEWER' | 'PARTNER' | 'ACCOUNTANT';

// Legacy role mapping for backward compatibility
const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  PARTNER: 'CONTRIBUTOR',
  ACCOUNTANT: 'VIEWER',
};

/**
 * Normalize legacy roles to new roles
 */
function normalizeRole(role: UserRole): UserRole {
  return LEGACY_ROLE_MAP[role] || role;
}

// ============================================
// PERMISSION DEFINITIONS
// ============================================

export const PERMISSIONS = {
  // Properties
  'property.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'],
  'property.write': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],
  'property.delete': ['OWNER', 'ADMIN'],
  'property.export': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],

  // Loans
  'loan.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'],
  'loan.write': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],
  'loan.delete': ['OWNER', 'ADMIN'],
  'loan.export': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],

  // Accounts
  'account.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'],
  'account.write': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],
  'account.delete': ['OWNER', 'ADMIN'],
  'account.export': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],

  // Income
  'income.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'],
  'income.write': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],
  'income.delete': ['OWNER', 'ADMIN'],
  'income.export': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],

  // Expenses
  'expense.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'],
  'expense.write': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],
  'expense.delete': ['OWNER', 'ADMIN'],
  'expense.export': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],

  // Investments
  'investment.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'],
  'investment.write': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],
  'investment.delete': ['OWNER', 'ADMIN'],
  'investment.export': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],

  // Holdings
  'holding.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'],
  'holding.write': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],
  'holding.delete': ['OWNER', 'ADMIN'],

  // Transactions
  'transaction.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'],
  'transaction.write': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],
  'transaction.delete': ['OWNER', 'ADMIN'],
  'transaction.export': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],

  // Reports & Analytics
  'report.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'],
  'report.export': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],

  // Settings & User Management
  'settings.read': ['OWNER', 'ADMIN'],
  'settings.write': ['OWNER'],
  'user.read': ['OWNER', 'ADMIN'],
  'user.invite': ['OWNER', 'ADMIN'],
  'user.manage': ['OWNER', 'ADMIN'],
  'user.delete': ['OWNER'],

  // Organization Management
  'org.read': ['OWNER', 'ADMIN'],
  'org.update': ['OWNER', 'ADMIN'],
  'org.delete': ['OWNER'],
  'org.billing': ['OWNER'],

  // Audit Logs
  'audit.read': ['OWNER', 'ADMIN'],
  'audit.export': ['OWNER', 'ADMIN'],

  // Security Settings
  'security.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'],
  'security.write': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'], // Users can manage their own MFA
  'security.enforce': ['OWNER', 'ADMIN'], // Enforce MFA org-wide

  // Session Management
  'session.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'],
  'session.revoke': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'], // Users can revoke their own sessions
  'session.revokeAll': ['OWNER', 'ADMIN'], // Admins can revoke other users' sessions

  // Account Lockout Management
  'lockout.view': ['OWNER', 'ADMIN'], // View locked accounts
  'lockout.manage': ['OWNER', 'ADMIN'], // Lock/unlock accounts

  // CDR Data Access (CLAUDE.md §13.4 — granular CDR access control)
  // Fix: G21 — CDR-specific permissions for Basiq/CDR data routes
  'cdr_data.read': ['OWNER', 'ADMIN'], // Read CDR-protected data (bank accounts, transactions)
  'cdr_data.write': ['OWNER', 'ADMIN'], // Connect/sync bank accounts via Basiq
  'cdr_data.delete': ['OWNER'], // Delete CDR data, revoke consent

  // Onboarding — bulk-create is the only route that writes across property,
  // loan, account, income, expense, investment, holding, asset AND user
  // onboarding state in a single transaction. It's a one-time self-setup
  // action, so we scope it to OWNER to match least-privilege (CLAUDE.md §12.5).
  'onboarding.complete': ['OWNER'],

  // Phase 41a/b — LegalEntity (Entity Layer) management. Mirrors the
  // pattern used by every other top-level user-owned object (property,
  // loan, account, etc.). VIEWERs can read entities (so they can navigate
  // the structure) but cannot modify; CONTRIBUTORs can add/edit but not
  // delete (delete is destructive — the §12.11 RESTRICT FK guard means
  // the entity layer can lose data integrity if removal is misused).
  'entity.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'],
  'entity.write': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],
  'entity.delete': ['OWNER', 'ADMIN'],

  // Phase 33g — Adviser feedback inbox. `feedback.write` lets any user
  // submit feedback (including org-attached advisers — that's the whole
  // point); `feedback.read` lets them see their OWN threads (service-layer
  // scoping enforces that — see lib/services/feedbackService.ts). Every
  // role gets both because feedback is the channel by which the product
  // improves; locking it behind OWNER would be hostile UX.
  'feedback.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER', 'PARTNER', 'ACCOUNTANT'],
  'feedback.write': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER', 'PARTNER', 'ACCOUNTANT'],

  // Phase 41e.0 — entity-aware tax dispatch. Read covers per-entity tax
  // position queries (`/api/tax/entity/[id]`, `/api/tax/master-position`,
  // FY config) — the same audience as `report.read`. Write covers
  // computational mutations like trust-distribution composition or
  // CGT-disposal calc invocations (when 41e.1+ ship those endpoints) —
  // CONTRIBUTOR-and-up because writes commit to a snapshot the
  // household sees. CDR sanitisation rules of CLAUDE.md §13.3 still
  // apply at the route layer; this permission gates ROUTE access, not
  // CDR-content visibility.
  'tax_data.read': ['OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER'],
  'tax_data.write': ['OWNER', 'ADMIN', 'CONTRIBUTOR'],
} as const;

// ============================================
// TYPES
// ============================================

export type Permission = keyof typeof PERMISSIONS;
export type PermissionRole = (typeof PERMISSIONS)[Permission][number];

// ============================================
// PERMISSION CHECKS
// ============================================

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const normalizedRole = normalizeRole(userRole);
  const allowedRoles = PERMISSIONS[permission];
  return (allowedRoles as readonly string[]).includes(normalizedRole);
}

/**
 * Check if a user role has all specified permissions
 */
export function hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(userRole, p));
}

/**
 * Check if a user role has any of the specified permissions
 */
export function hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(userRole, p));
}

/**
 * Get all permissions for a specific role
 */
export function getPermissionsForRole(userRole: UserRole): Permission[] {
  const normalizedRole = normalizeRole(userRole);
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) =>
    (PERMISSIONS[permission] as readonly string[]).includes(normalizedRole)
  );
}

/**
 * Get all roles that have a specific permission
 */
export function getRolesForPermission(permission: Permission): string[] {
  return [...PERMISSIONS[permission]];
}

// ============================================
// ENTITY PERMISSION HELPERS
// ============================================

export type EntityType =
  | 'property'
  | 'loan'
  | 'account'
  | 'income'
  | 'expense'
  | 'investment'
  | 'holding'
  | 'transaction'
  | 'report'
  | 'user'
  | 'org'
  | 'audit'
  | 'security'
  | 'session'
  | 'lockout'
  | 'cdr_data';

export type ActionType = 'read' | 'write' | 'delete' | 'export' | 'update' | 'invite' | 'manage' | 'enforce' | 'revoke' | 'revokeAll' | 'billing' | 'view';

/**
 * Build a permission string for an entity action
 */
export function buildPermission(entity: EntityType, action: ActionType): Permission {
  return `${entity}.${action}` as Permission;
}

/**
 * Check if a user can perform an action on an entity type
 */
export function canPerformAction(
  userRole: UserRole,
  entity: EntityType,
  action: ActionType
): boolean {
  const permission = buildPermission(entity, action);
  return hasPermission(userRole, permission);
}
