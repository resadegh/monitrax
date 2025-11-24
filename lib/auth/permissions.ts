/**
 * RBAC Permission System
 * Role-based access control for Monitrax entities
 * Phase 10: Updated for enterprise-grade authorization
 */

// Define UserRole locally to avoid Prisma client dependency
// Must match the enum in prisma/schema.prisma
export type UserRole = 'OWNER' | 'ADMIN' | 'CONTRIBUTOR' | 'VIEWER';

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
  const allowedRoles = PERMISSIONS[permission];
  return (allowedRoles as readonly string[]).includes(userRole);
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
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) =>
    (PERMISSIONS[permission] as readonly string[]).includes(userRole)
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
  | 'session';

export type ActionType = 'read' | 'write' | 'delete' | 'export' | 'update' | 'invite' | 'manage' | 'enforce' | 'revoke' | 'revokeAll' | 'billing';

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
