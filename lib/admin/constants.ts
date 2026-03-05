/**
 * Phase 33: Admin Portal Constants
 *
 * Route definitions, limits, error codes, and configuration constants
 * for the Admin Portal.
 */

import type { AdminRole, UserTier, OrganizationPlan } from '@prisma/client';

// =============================================================================
// ROUTE CONSTANTS
// =============================================================================

export const ADMIN_ROUTES = {
  // Base routes
  BASE: '/admin',
  API_BASE: '/api/admin',

  // Auth routes
  LOGIN: '/admin/login',
  LOGOUT: '/admin/logout',

  // Dashboard
  DASHBOARD: '/admin/dashboard',

  // Organization management
  ORGANIZATIONS: '/admin/organizations',
  ORGANIZATION_DETAIL: (orgId: string) => `/admin/organizations/${orgId}`,

  // User management
  USERS: '/admin/users',
  USER_DETAIL: (userId: string) => `/admin/users/${userId}`,

  // Billing
  BILLING: '/admin/billing',
  BILLING_TRANSACTIONS: '/admin/billing/transactions',
  BILLING_FAILED_PAYMENTS: '/admin/billing/failed-payments',

  // Analytics
  ANALYTICS: '/admin/analytics',
  ANALYTICS_GROWTH: '/admin/analytics/growth',
  ANALYTICS_FEATURES: '/admin/analytics/features',
  ANALYTICS_RETENTION: '/admin/analytics/retention',

  // Feature flags
  FEATURE_FLAGS: '/admin/feature-flags',
  FEATURE_FLAG_DETAIL: (flagKey: string) => `/admin/feature-flags/${flagKey}`,

  // Support tools
  SUPPORT: '/admin/support',
  SUPPORT_IMPERSONATE: '/admin/support/impersonate',
  SUPPORT_LOGS: '/admin/support/logs',
  SUPPORT_ERRORS: '/admin/support/errors',

  // Admin settings
  SETTINGS: '/admin/settings',
  SETTINGS_ADMINS: '/admin/settings/admins',
} as const;

// =============================================================================
// API ROUTE CONSTANTS
// =============================================================================

export const ADMIN_API_ROUTES = {
  // Auth
  AUTH_LOGIN: '/api/admin/auth/login',
  AUTH_LOGOUT: '/api/admin/auth/logout',
  AUTH_SESSION: '/api/admin/auth/session',

  // Organizations
  ORGANIZATIONS: '/api/admin/organizations',
  ORGANIZATION: (orgId: string) => `/api/admin/organizations/${orgId}`,
  ORGANIZATION_LICENSE: (orgId: string) => `/api/admin/organizations/${orgId}/license`,
  ORGANIZATION_ACTIVITY: (orgId: string) => `/api/admin/organizations/${orgId}/activity`,
  ORGANIZATION_USAGE: (orgId: string) => `/api/admin/organizations/${orgId}/usage`,

  // Users
  USERS: '/api/admin/users',
  USER: (userId: string) => `/api/admin/users/${userId}`,
  USER_SUBSCRIPTION: (userId: string) => `/api/admin/users/${userId}/subscription`,
  USER_ACTIVITY: (userId: string) => `/api/admin/users/${userId}/activity`,
  USER_IMPERSONATE: (userId: string) => `/api/admin/users/${userId}/impersonate`,

  // Billing
  BILLING_OVERVIEW: '/api/admin/billing/overview',
  BILLING_SUBSCRIPTIONS: '/api/admin/billing/subscriptions',
  BILLING_TRANSACTIONS: '/api/admin/billing/transactions',
  BILLING_FAILED_PAYMENTS: '/api/admin/billing/failed-payments',

  // Analytics
  ANALYTICS_GROWTH: '/api/admin/analytics/growth',
  ANALYTICS_FEATURE_USAGE: '/api/admin/analytics/feature-usage',
  ANALYTICS_ACTIVE_USERS: '/api/admin/analytics/active-users',
  ANALYTICS_RETENTION: '/api/admin/analytics/retention',

  // Feature flags
  FEATURE_FLAGS: '/api/admin/feature-flags',
  FEATURE_FLAG: (flagKey: string) => `/api/admin/feature-flags/${flagKey}`,
  FEATURE_FLAG_OVERRIDES: '/api/admin/feature-flags/overrides',
  FEATURE_FLAG_OVERRIDE: (overrideId: string) => `/api/admin/feature-flags/overrides/${overrideId}`,

  // Audit
  AUDIT_LOGS: '/api/admin/audit',
  AUDIT_EXPORT: '/api/admin/audit/export',

  // Health
  HEALTH: '/api/admin/health',
} as const;

// =============================================================================
// PLAN & TIER LIMITS
// =============================================================================

export interface UserTierLimits {
  maxAccounts: number;
  maxProperties: number;
  maxLoans: number;
  maxDocuments: number;
  aiInsights: boolean;
  advancedReports: boolean;
  prioritySupport: boolean;
  monthlyPrice: number;
}

export const USER_TIER_LIMITS: Record<UserTier, UserTierLimits> = {
  FREE: {
    maxAccounts: 2,
    maxProperties: 1,
    maxLoans: 2,
    maxDocuments: 10,
    aiInsights: false,
    advancedReports: false,
    prioritySupport: false,
    monthlyPrice: 0,
  },
  BASIC: {
    maxAccounts: 5,
    maxProperties: 3,
    maxLoans: 5,
    maxDocuments: 50,
    aiInsights: false,
    advancedReports: false,
    prioritySupport: false,
    monthlyPrice: 9.99,
  },
  PRO: {
    maxAccounts: 20,
    maxProperties: 10,
    maxLoans: 20,
    maxDocuments: 200,
    aiInsights: true,
    advancedReports: true,
    prioritySupport: false,
    monthlyPrice: 19.99,
  },
  PREMIUM: {
    maxAccounts: -1, // Unlimited
    maxProperties: -1,
    maxLoans: -1,
    maxDocuments: -1,
    aiInsights: true,
    advancedReports: true,
    prioritySupport: true,
    monthlyPrice: 39.99,
  },
};

export interface OrganizationPlanLimits {
  maxClients: number;
  maxStaff: number;
  maxApiKeys: number;
  whiteLabeling: boolean;
  customDomains: boolean;
  ssoSaml: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  monthlyPrice: number;
}

export const ORGANIZATION_PLAN_LIMITS: Record<OrganizationPlan, OrganizationPlanLimits> = {
  STARTER: {
    maxClients: 10,
    maxStaff: 3,
    maxApiKeys: 1,
    whiteLabeling: false,
    customDomains: false,
    ssoSaml: false,
    apiAccess: false,
    prioritySupport: false,
    monthlyPrice: 49,
  },
  PROFESSIONAL: {
    maxClients: 50,
    maxStaff: 10,
    maxApiKeys: 3,
    whiteLabeling: true,
    customDomains: false,
    ssoSaml: false,
    apiAccess: true,
    prioritySupport: false,
    monthlyPrice: 149,
  },
  BUSINESS: {
    maxClients: 200,
    maxStaff: 25,
    maxApiKeys: 10,
    whiteLabeling: true,
    customDomains: true,
    ssoSaml: true,
    apiAccess: true,
    prioritySupport: true,
    monthlyPrice: 349,
  },
  ENTERPRISE: {
    maxClients: -1, // Unlimited
    maxStaff: -1,
    maxApiKeys: -1,
    whiteLabeling: true,
    customDomains: true,
    ssoSaml: true,
    apiAccess: true,
    prioritySupport: true,
    monthlyPrice: 0, // Custom pricing
  },
};

// =============================================================================
// SECURITY CONSTANTS
// =============================================================================

export const SECURITY_CONSTANTS = {
  // Session settings
  SESSION_DURATION_MS: 30 * 60 * 1000, // 30 minutes
  SESSION_REFRESH_THRESHOLD_MS: 5 * 60 * 1000, // Refresh if <5 min remaining
  MAX_CONCURRENT_SESSIONS: 3,

  // Password requirements
  MIN_PASSWORD_LENGTH: 12,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,

  // Login security
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  LOGIN_RATE_LIMIT: 5, // per 15 min per IP

  // API rate limiting
  API_RATE_LIMIT: 100, // per minute per admin
  BULK_OPERATION_RATE_LIMIT: 10, // per minute

  // Impersonation
  MAX_IMPERSONATION_DURATION_MS: 60 * 60 * 1000, // 1 hour
  DEFAULT_IMPERSONATION_DURATION_MS: 30 * 60 * 1000, // 30 minutes
} as const;

// =============================================================================
// AUDIT CONSTANTS
// =============================================================================

export const AUDIT_ACTIONS = {
  // User management
  USER_VIEWED: 'USER_VIEWED',
  USER_UPDATED: 'USER_UPDATED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  USER_TIER_CHANGED: 'USER_TIER_CHANGED',
  USER_IMPERSONATED: 'USER_IMPERSONATED',

  // Organization management
  ORG_VIEWED: 'ORG_VIEWED',
  ORG_UPDATED: 'ORG_UPDATED',
  ORG_LICENSE_UPDATED: 'ORG_LICENSE_UPDATED',
  ORG_SUSPENDED: 'ORG_SUSPENDED',
  ORG_REACTIVATED: 'ORG_REACTIVATED',
  ORG_TIER_CHANGED: 'ORG_TIER_CHANGED',

  // Feature flags
  FLAG_CREATED: 'FLAG_CREATED',
  FLAG_UPDATED: 'FLAG_UPDATED',
  FLAG_DELETED: 'FLAG_DELETED',
  FLAG_OVERRIDE_CREATED: 'FLAG_OVERRIDE_CREATED',
  FLAG_OVERRIDE_DELETED: 'FLAG_OVERRIDE_DELETED',

  // Admin management
  ADMIN_CREATED: 'ADMIN_CREATED',
  ADMIN_UPDATED: 'ADMIN_UPDATED',
  ADMIN_ROLE_CHANGED: 'ADMIN_ROLE_CHANGED',
  ADMIN_DEACTIVATED: 'ADMIN_DEACTIVATED',

  // Authentication
  ADMIN_LOGIN: 'ADMIN_LOGIN',
  ADMIN_LOGOUT: 'ADMIN_LOGOUT',
  ADMIN_LOGIN_FAILED: 'ADMIN_LOGIN_FAILED',
  ADMIN_MFA_ENABLED: 'ADMIN_MFA_ENABLED',
  ADMIN_MFA_DISABLED: 'ADMIN_MFA_DISABLED',

  // Billing
  REFUND_ISSUED: 'REFUND_ISSUED',
  SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
} as const;

export const AUDIT_CATEGORIES = {
  USER_MANAGEMENT: 'USER_MANAGEMENT',
  ORGANIZATION_MANAGEMENT: 'ORGANIZATION_MANAGEMENT',
  BILLING: 'BILLING',
  FEATURE_FLAGS: 'FEATURE_FLAGS',
  SUPPORT: 'SUPPORT',
  ADMIN_MANAGEMENT: 'ADMIN_MANAGEMENT',
  AUTHENTICATION: 'AUTHENTICATION',
  SYSTEM: 'SYSTEM',
} as const;

// Audit retention (7 years for compliance)
export const AUDIT_RETENTION_DAYS = 2555;

// =============================================================================
// ERROR CODES
// =============================================================================

export const ADMIN_ERROR_CODES = {
  // Authentication errors
  ADMIN_PORTAL_NOT_ENABLED: 'ADMIN_PORTAL_NOT_ENABLED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  MFA_REQUIRED: 'MFA_REQUIRED',
  MFA_INVALID: 'MFA_INVALID',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_INVALID: 'SESSION_INVALID',
  IP_NOT_WHITELISTED: 'IP_NOT_WHITELISTED',

  // Authorization errors
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ROLE_NOT_ALLOWED: 'ROLE_NOT_ALLOWED',

  // Resource errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  ADMIN_NOT_FOUND: 'ADMIN_NOT_FOUND',
  FLAG_NOT_FOUND: 'FLAG_NOT_FOUND',
  OVERRIDE_NOT_FOUND: 'OVERRIDE_NOT_FOUND',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',

  // Validation errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
  INVALID_TIER: 'INVALID_TIER',
  INVALID_PLAN: 'INVALID_PLAN',
  INVALID_FLAG_KEY: 'INVALID_FLAG_KEY',
  FLAG_KEY_EXISTS: 'FLAG_KEY_EXISTS',

  // Operation errors
  CANNOT_SUSPEND_SELF: 'CANNOT_SUSPEND_SELF',
  CANNOT_DEMOTE_SELF: 'CANNOT_DEMOTE_SELF',
  CANNOT_DELETE_LAST_SUPER_ADMIN: 'CANNOT_DELETE_LAST_SUPER_ADMIN',
  IMPERSONATION_NOT_ALLOWED: 'IMPERSONATION_NOT_ALLOWED',
  IMPERSONATION_EXPIRED: 'IMPERSONATION_EXPIRED',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_LOGIN_ATTEMPTS: 'TOO_MANY_LOGIN_ATTEMPTS',

  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  STRIPE_ERROR: 'STRIPE_ERROR',
} as const;

export type AdminErrorCode = (typeof ADMIN_ERROR_CODES)[keyof typeof ADMIN_ERROR_CODES];

// =============================================================================
// ROLE DISPLAY NAMES
// =============================================================================

export const ADMIN_ROLE_DISPLAY_NAMES: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  BILLING_ADMIN: 'Billing Admin',
  SUPPORT_ADMIN: 'Support Admin',
  VIEWER: 'Viewer',
};

export const USER_TIER_DISPLAY_NAMES: Record<UserTier, string> = {
  FREE: 'Free',
  BASIC: 'Basic',
  PRO: 'Pro',
  PREMIUM: 'Premium',
};

export const ORGANIZATION_PLAN_DISPLAY_NAMES: Record<OrganizationPlan, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  BUSINESS: 'Business',
  ENTERPRISE: 'Enterprise',
};

// =============================================================================
// PAGINATION DEFAULTS
// =============================================================================

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// =============================================================================
// DATE RANGE PRESETS
// =============================================================================

export const DATE_RANGE_PRESETS = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  LAST_90_DAYS: 'last_90_days',
  THIS_MONTH: 'this_month',
  LAST_MONTH: 'last_month',
  THIS_YEAR: 'this_year',
  LAST_YEAR: 'last_year',
  CUSTOM: 'custom',
} as const;
