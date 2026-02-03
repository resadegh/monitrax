/**
 * Phase 32: Enterprise Portal Constants
 *
 * Configuration constants for the Enterprise Portal.
 */

import type { DataAccessScope, OrganizationPlan } from '@prisma/client';

// =============================================================================
// ROUTE CONSTANTS
// =============================================================================

export const PORTAL_ROUTES = {
  // Base routes
  BASE: '/portal',
  API_BASE: '/api/portal',

  // Auth routes
  LOGIN: '/portal/login',
  LOGOUT: '/portal/logout',

  // Organization routes
  DASHBOARD: '/portal/dashboard',
  ORGANIZATION: '/portal/organization',
  ORGANIZATION_SETTINGS: '/portal/organization/settings',
  ORGANIZATION_BRANDING: '/portal/organization/branding',

  // Team routes
  TEAM: '/portal/team',
  TEAM_INVITE: '/portal/team/invite',

  // Client routes
  CLIENTS: '/portal/clients',
  CLIENT_DETAIL: (id: string) => `/portal/clients/${id}`,
  CLIENT_INVITE: '/portal/clients/invite',

  // Task routes
  TASKS: '/portal/tasks',

  // Integration routes
  INTEGRATIONS: '/portal/integrations',
  INTEGRATION_XERO: '/portal/integrations/xero',
  INTEGRATION_MYOB: '/portal/integrations/myob',

  // API Keys routes
  API_KEYS: '/portal/api-keys',

  // Settings routes
  SETTINGS: '/portal/settings',
  SETTINGS_BILLING: '/portal/settings/billing',
  SETTINGS_SSO: '/portal/settings/sso',
} as const;

// =============================================================================
// PLAN LIMITS
// =============================================================================

export interface PlanLimits {
  maxClients: number;
  maxStaff: number;
  maxApiKeys: number;
  whiteLabeling: boolean;
  customDomains: boolean;
  ssoSaml: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

export const PLAN_LIMITS: Record<OrganizationPlan, PlanLimits> = {
  STARTER: {
    maxClients: 10,
    maxStaff: 3,
    maxApiKeys: 1,
    whiteLabeling: false,
    customDomains: false,
    ssoSaml: false,
    apiAccess: false,
    prioritySupport: false,
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
  },
  ENTERPRISE: {
    maxClients: -1, // Unlimited
    maxStaff: -1,   // Unlimited
    maxApiKeys: -1, // Unlimited
    whiteLabeling: true,
    customDomains: true,
    ssoSaml: true,
    apiAccess: true,
    prioritySupport: true,
  },
};

// =============================================================================
// ACCESS SCOPE DESCRIPTIONS
// =============================================================================

export const ACCESS_SCOPE_DESCRIPTIONS: Record<DataAccessScope, {
  label: string;
  description: string;
  icon: string;
}> = {
  FULL: {
    label: 'Full Access',
    description: 'Access to all client data including financial, tax, and documents',
    icon: 'shield-check',
  },
  FINANCIAL: {
    label: 'Financial Data',
    description: 'Access to accounts, balances, and transaction summaries',
    icon: 'wallet',
  },
  INVESTMENTS: {
    label: 'Investment Data',
    description: 'Access to investment accounts, holdings, and performance',
    icon: 'trending-up',
  },
  TAX: {
    label: 'Tax Information',
    description: 'Access to tax-related data and deductions',
    icon: 'receipt',
  },
  DOCUMENTS: {
    label: 'Documents',
    description: 'Access to uploaded documents and files',
    icon: 'file-text',
  },
  TRANSACTIONS: {
    label: 'Transaction History',
    description: 'Access to detailed transaction records',
    icon: 'list',
  },
  PROPERTIES: {
    label: 'Property Data',
    description: 'Access to property details and valuations',
    icon: 'home',
  },
  LOANS: {
    label: 'Loan Information',
    description: 'Access to loan details and repayment schedules',
    icon: 'credit-card',
  },
};

// =============================================================================
// CONSENT CONSTANTS
// =============================================================================

export const CONSENT_CONSTANTS = {
  // Default consent duration (365 days)
  DEFAULT_CONSENT_DURATION_DAYS: 365,

  // Minimum consent duration (30 days)
  MIN_CONSENT_DURATION_DAYS: 30,

  // Maximum consent duration (3 years)
  MAX_CONSENT_DURATION_DAYS: 1095,

  // Days before expiry to send reminder
  CONSENT_EXPIRY_REMINDER_DAYS: 30,
};

// =============================================================================
// INVITATION CONSTANTS
// =============================================================================

export const INVITATION_CONSTANTS = {
  // Invitation token validity (7 days)
  TOKEN_VALIDITY_HOURS: 168,

  // Maximum pending invitations per organization
  MAX_PENDING_INVITATIONS: 100,

  // Invitation email cooldown (prevent spam)
  EMAIL_COOLDOWN_MINUTES: 5,
};

// =============================================================================
// API KEY CONSTANTS
// =============================================================================

export const API_KEY_CONSTANTS = {
  // API key prefix
  KEY_PREFIX: 'mtrx_pk_',

  // Key length (excluding prefix)
  KEY_LENGTH: 32,

  // Default rate limit (requests per hour)
  DEFAULT_RATE_LIMIT: 1000,

  // Max rate limit (requests per hour)
  MAX_RATE_LIMIT: 10000,

  // Rate limit window (seconds)
  RATE_LIMIT_WINDOW: 3600,
};

// =============================================================================
// AUDIT LOG ACTIONS
// =============================================================================

export const AUDIT_ACTIONS = {
  // Client access
  VIEW_CLIENT_PROFILE: 'VIEW_CLIENT_PROFILE',
  VIEW_CLIENT_ACCOUNTS: 'VIEW_CLIENT_ACCOUNTS',
  VIEW_CLIENT_TRANSACTIONS: 'VIEW_CLIENT_TRANSACTIONS',
  VIEW_CLIENT_PROPERTIES: 'VIEW_CLIENT_PROPERTIES',
  VIEW_CLIENT_LOANS: 'VIEW_CLIENT_LOANS',
  VIEW_CLIENT_INVESTMENTS: 'VIEW_CLIENT_INVESTMENTS',
  VIEW_CLIENT_TAX: 'VIEW_CLIENT_TAX',
  VIEW_CLIENT_DOCUMENTS: 'VIEW_CLIENT_DOCUMENTS',

  // Data export
  EXPORT_CLIENT_DATA: 'EXPORT_CLIENT_DATA',
  EXPORT_CLIENT_REPORT: 'EXPORT_CLIENT_REPORT',

  // Integration sync
  SYNC_TO_XERO: 'SYNC_TO_XERO',
  SYNC_TO_MYOB: 'SYNC_TO_MYOB',
  SYNC_TO_QUICKBOOKS: 'SYNC_TO_QUICKBOOKS',

  // Notes & Tasks
  CREATE_NOTE: 'CREATE_NOTE',
  UPDATE_NOTE: 'UPDATE_NOTE',
  DELETE_NOTE: 'DELETE_NOTE',
  CREATE_TASK: 'CREATE_TASK',
  UPDATE_TASK: 'UPDATE_TASK',
  COMPLETE_TASK: 'COMPLETE_TASK',
  DELETE_TASK: 'DELETE_TASK',
} as const;

// =============================================================================
// ERROR CODES
// =============================================================================

export const PORTAL_ERROR_CODES = {
  // Authentication errors
  PORTAL_NOT_ENABLED: 'PORTAL_NOT_ENABLED',
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  NOT_A_MEMBER: 'NOT_A_MEMBER',
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',

  // Client errors
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  CLIENT_NOT_CONSENTED: 'CLIENT_NOT_CONSENTED',
  CONSENT_EXPIRED: 'CONSENT_EXPIRED',
  SCOPE_NOT_GRANTED: 'SCOPE_NOT_GRANTED',

  // Invitation errors
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_ALREADY_USED: 'INVITATION_ALREADY_USED',
  INVITATION_LIMIT_REACHED: 'INVITATION_LIMIT_REACHED',

  // Plan limit errors
  CLIENT_LIMIT_REACHED: 'CLIENT_LIMIT_REACHED',
  STAFF_LIMIT_REACHED: 'STAFF_LIMIT_REACHED',
  API_KEY_LIMIT_REACHED: 'API_KEY_LIMIT_REACHED',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',

  // Integration errors
  INTEGRATION_NOT_CONNECTED: 'INTEGRATION_NOT_CONNECTED',
  INTEGRATION_TOKEN_EXPIRED: 'INTEGRATION_TOKEN_EXPIRED',
  SYNC_IN_PROGRESS: 'SYNC_IN_PROGRESS',
  SYNC_FAILED: 'SYNC_FAILED',

  // API key errors
  INVALID_API_KEY: 'INVALID_API_KEY',
  API_KEY_EXPIRED: 'API_KEY_EXPIRED',
  API_KEY_REVOKED: 'API_KEY_REVOKED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;
