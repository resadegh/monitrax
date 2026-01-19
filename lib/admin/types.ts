/**
 * Phase 33: Admin Portal Types
 *
 * TypeScript type definitions for the Admin Portal.
 * These types mirror the Prisma schema but provide additional
 * type safety for API responses and frontend usage.
 */

import type {
  AdminRole,
  UserTier,
  OrganizationPlan,
} from '@prisma/client';

// Re-export Prisma enums for convenience
export type { AdminRole, UserTier, OrganizationPlan };

// =============================================================================
// ADMIN USER TYPES
// =============================================================================

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: Date | null;
  lastLoginIp?: string | null;
  failedLoginCount: number;
  lockedUntil?: Date | null;
  ipWhitelist: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
}

export interface AdminSession {
  id: string;
  adminUserId: string;
  ipAddress: string;
  userAgent?: string | null;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
  isRevoked: boolean;
  revokedAt?: Date | null;
  revokedReason?: string | null;
}

// =============================================================================
// AUDIT LOG TYPES
// =============================================================================

export interface AdminAuditLog {
  id: string;
  adminUserId: string;
  action: string;
  category: AuditCategory;
  targetType?: string | null;
  targetId?: string | null;
  description: string;
  metadata?: Record<string, unknown> | null;
  ipAddress: string;
  userAgent?: string | null;
  requestId?: string | null;
  timestamp: Date;

  // Expanded relations
  adminUser?: AdminUser;
}

export type AuditCategory =
  | 'USER_MANAGEMENT'
  | 'ORGANIZATION_MANAGEMENT'
  | 'BILLING'
  | 'FEATURE_FLAGS'
  | 'SUPPORT'
  | 'ADMIN_MANAGEMENT'
  | 'AUTHENTICATION'
  | 'SYSTEM';

export type AuditAction =
  // User management
  | 'USER_VIEWED'
  | 'USER_UPDATED'
  | 'USER_SUSPENDED'
  | 'USER_REACTIVATED'
  | 'USER_TIER_CHANGED'
  | 'USER_IMPERSONATED'
  // Organization management
  | 'ORG_VIEWED'
  | 'ORG_UPDATED'
  | 'ORG_LICENSE_UPDATED'
  | 'ORG_SUSPENDED'
  | 'ORG_REACTIVATED'
  | 'ORG_TIER_CHANGED'
  // Feature flags
  | 'FLAG_CREATED'
  | 'FLAG_UPDATED'
  | 'FLAG_DELETED'
  | 'FLAG_OVERRIDE_CREATED'
  | 'FLAG_OVERRIDE_DELETED'
  // Admin management
  | 'ADMIN_CREATED'
  | 'ADMIN_UPDATED'
  | 'ADMIN_ROLE_CHANGED'
  | 'ADMIN_DEACTIVATED'
  // Authentication
  | 'ADMIN_LOGIN'
  | 'ADMIN_LOGOUT'
  | 'ADMIN_LOGIN_FAILED'
  | 'ADMIN_MFA_ENABLED'
  | 'ADMIN_MFA_DISABLED';

// =============================================================================
// IMPERSONATION TYPES
// =============================================================================

export interface ImpersonationSession {
  id: string;
  adminUserId: string;
  targetUserId: string;
  targetType: 'USER' | 'ORGANIZATION_MEMBER';
  reason: string;
  startedAt: Date;
  expiresAt: Date;
  endedAt?: Date | null;
  ipAddress: string;
  userAgent?: string | null;
  actionsPerformed?: Record<string, unknown>[] | null;

  // Expanded relations
  adminUser?: AdminUser;
}

// =============================================================================
// FEATURE FLAG TYPES
// =============================================================================

export interface GlobalFeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  enabledForPercent: number;
  enabledForTiers: string[];
  enabledForPlans: string[];
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;

  // Expanded relations
  overridesCount?: number;
}

export interface FeatureFlagOverride {
  id: string;
  flagId: string;
  targetType: 'USER' | 'ORGANIZATION';
  targetId: string;
  enabled: boolean;
  reason?: string | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;

  // Expanded relations
  flag?: GlobalFeatureFlag;
}

// =============================================================================
// USER & SUBSCRIPTION TYPES
// =============================================================================

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  lastLoginAt?: Date | null;
  isActive: boolean;

  // Subscription info
  subscription?: UserSubscription | null;

  // Aggregated stats
  accountsCount?: number;
  propertiesCount?: number;
  loansCount?: number;
  documentsCount?: number;
  lastActivityAt?: Date | null;
}

export interface UserSubscription {
  id: string;
  userId: string;
  tier: UserTier;
  status: SubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd: boolean;
  suspendedAt?: Date | null;
  suspendedReason?: string | null;
  suspendedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus = 'active' | 'suspended' | 'cancelled' | 'trialing' | 'past_due';

// =============================================================================
// ORGANIZATION & LICENSE TYPES
// =============================================================================

export interface ManagedOrganization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;

  // License info
  license?: OrganizationLicense | null;

  // Aggregated stats
  memberCount?: number;
  clientCount?: number;
  activeIntegrationsCount?: number;
  lastActivityAt?: Date | null;
}

export interface OrganizationLicense {
  id: string;
  organizationId: string;
  tier: OrganizationPlan;
  status: LicenseStatus;
  clientLimit: number;
  staffLimit: number;
  customClientLimit?: number | null;
  customStaffLimit?: number | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd: boolean;
  suspendedAt?: Date | null;
  suspendedReason?: string | null;
  suspendedBy?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type LicenseStatus = 'active' | 'suspended' | 'cancelled' | 'trialing' | 'past_due';

// =============================================================================
// BILLING TYPES
// =============================================================================

export interface BillingTransaction {
  id: string;
  type: TransactionType;
  entityType: 'USER' | 'ORGANIZATION';
  entityId: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  stripePaymentId?: string | null;
  stripeInvoiceId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  failureReason?: string | null;
  createdAt: Date;

  // Expanded relations
  entity?: ManagedUser | ManagedOrganization;
}

export type TransactionType = 'subscription' | 'one_time' | 'refund';
export type TransactionStatus = 'succeeded' | 'pending' | 'failed' | 'refunded';

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  mrrGrowth: number;
  churnRate: number;
  arpu: number;
  ltv: number;
  totalUsers: number;
  totalOrganizations: number;
  paidUsers: number;
  paidOrganizations: number;
}

export interface SubscriptionBreakdown {
  userTiers: TierBreakdown<UserTier>[];
  organizationPlans: TierBreakdown<OrganizationPlan>[];
  totalMrr: number;
}

export interface TierBreakdown<T> {
  tier: T;
  count: number;
  mrr: number;
  percentOfTotal: number;
}

// =============================================================================
// ANALYTICS TYPES
// =============================================================================

export interface GrowthMetrics {
  period: string;
  newUsers: number;
  newOrganizations: number;
  churned: number;
  netGrowth: number;
}

export interface FeatureUsageMetrics {
  featureKey: string;
  featureName: string;
  activeUsers: number;
  usagePercent: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

export interface ActiveUserMetrics {
  dau: number;
  wau: number;
  mau: number;
  dauTrend: number;
  wauTrend: number;
  mauTrend: number;
}

export interface RetentionCohort {
  cohortDate: string;
  totalUsers: number;
  retentionByPeriod: number[];
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface AdminLoginRequest {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface AdminLoginResponse {
  success: boolean;
  admin?: AdminUser;
  session?: AdminSession;
  requireMfa?: boolean;
  error?: string;
}

export interface CreateAdminRequest {
  email: string;
  name: string;
  password: string;
  role: AdminRole;
  ipWhitelist?: string[];
}

export interface UpdateAdminRequest {
  name?: string;
  role?: AdminRole;
  isActive?: boolean;
  ipWhitelist?: string[];
}

export interface UpdateUserSubscriptionRequest {
  tier?: UserTier;
  status?: SubscriptionStatus;
  reason?: string;
}

export interface UpdateOrganizationLicenseRequest {
  tier?: OrganizationPlan;
  status?: LicenseStatus;
  clientLimit?: number;
  staffLimit?: number;
  customClientLimit?: number | null;
  customStaffLimit?: number | null;
  notes?: string;
  reason?: string;
}

export interface CreateFeatureFlagRequest {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  enabledForPercent?: number;
  enabledForTiers?: string[];
  enabledForPlans?: string[];
}

export interface UpdateFeatureFlagRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
  enabledForPercent?: number;
  enabledForTiers?: string[];
  enabledForPlans?: string[];
}

export interface CreateOverrideRequest {
  flagKey: string;
  targetType: 'USER' | 'ORGANIZATION';
  targetId: string;
  enabled: boolean;
  reason?: string;
  expiresAt?: Date;
}

export interface StartImpersonationRequest {
  targetUserId: string;
  targetType?: 'USER' | 'ORGANIZATION_MEMBER';
  reason: string;
  duration?: number; // in minutes, max 60
}

export interface StartImpersonationResponse {
  token: string;
  expiresAt: Date;
  targetUser: {
    id: string;
    email: string;
    name: string;
  };
}

// =============================================================================
// PAGINATION & FILTERING
// =============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface UserFilters {
  tier?: UserTier;
  status?: SubscriptionStatus;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  hasSubscription?: boolean;
}

export interface OrganizationFilters {
  tier?: OrganizationPlan;
  status?: LicenseStatus;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface AuditLogFilters {
  adminId?: string;
  action?: AuditAction;
  category?: AuditCategory;
  targetType?: string;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface TransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  entityType?: 'USER' | 'ORGANIZATION';
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

// =============================================================================
// DASHBOARD TYPES
// =============================================================================

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalOrganizations: number;
  activeOrganizations: number;
  mrr: number;
  mrrGrowth: number;
  pendingActions: number;
  recentActivity: AdminAuditLog[];
}

export interface UserActivityLog {
  id: string;
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface OrganizationActivityLog {
  id: string;
  organizationId: string;
  memberId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  timestamp: Date;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export interface AdminApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface AdminApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: AdminApiError;
}
