/**
 * RBAC Permission System
 * Role-based access control for Monitrax entities
 */

// Define UserRole locally to avoid Prisma client dependency
// Must match the enum in prisma/schema.prisma
export type UserRole = 'OWNER' | 'PARTNER' | 'ACCOUNTANT';

// ============================================
// PERMISSION DEFINITIONS
// ============================================

export const PERMISSIONS = {
  // Properties
  'property.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'property.write': ['OWNER', 'PARTNER'],
  'property.delete': ['OWNER'],

  // Loans
  'loan.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'loan.write': ['OWNER', 'PARTNER'],
  'loan.delete': ['OWNER'],

  // Accounts
  'account.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'account.write': ['OWNER', 'PARTNER'],
  'account.delete': ['OWNER'],

  // Income
  'income.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'income.write': ['OWNER', 'PARTNER'],
  'income.delete': ['OWNER'],

  // Expenses
  'expense.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'expense.write': ['OWNER', 'PARTNER'],
  'expense.delete': ['OWNER'],

  // Investments
  'investment.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'investment.write': ['OWNER', 'PARTNER'],
  'investment.delete': ['OWNER'],

  // Transactions
  'transaction.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'transaction.write': ['OWNER', 'PARTNER'],
  'transaction.delete': ['OWNER'],

  // Reports & Analytics
  'report.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'report.export': ['OWNER', 'PARTNER'],

  // Settings & User Management
  'settings.read': ['OWNER', 'PARTNER'],
  'settings.write': ['OWNER'],
  'user.read': ['OWNER'],
  'user.invite': ['OWNER'],
  'user.manage': ['OWNER'],
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
  | 'transaction';

export type ActionType = 'read' | 'write' | 'delete';

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
