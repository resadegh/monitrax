/**
 * Phase 32: Enterprise Portal Types
 *
 * TypeScript type definitions for the Enterprise Portal.
 * These types mirror the Prisma schema but provide additional
 * type safety for API responses and frontend usage.
 */

import type {
  OrganizationType,
  OrganizationPlan,
  PortalUserRole,
  ClientStatus,
  DataAccessScope,
  ConsentStatus,
  InvitationType,
  InvitationStatus,
  ClientTaskStatus,
  ClientTaskPriority,
  ApiKeyScope,
  AccountingProvider,
  IntegrationSyncDirection,
  IntegrationSyncStatus,
} from '@prisma/client';

// Re-export Prisma enums for convenience
export type {
  OrganizationType,
  OrganizationPlan,
  PortalUserRole,
  ClientStatus,
  DataAccessScope,
  ConsentStatus,
  InvitationType,
  InvitationStatus,
  ClientTaskStatus,
  ClientTaskPriority,
  ApiKeyScope,
  AccountingProvider,
  IntegrationSyncDirection,
  IntegrationSyncStatus,
};

// =============================================================================
// ORGANIZATION TYPES
// =============================================================================

export interface PortalOrganization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  portalSettings?: OrganizationPortalSettings | null;
  memberCount?: number;
  clientCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationPortalSettings {
  id: string;
  organizationId: string;
  organizationType: OrganizationType;
  plan: OrganizationPlan;
  portalEnabled: boolean;
  maxClients: number;
  maxStaff: number;
  brandName?: string | null;
  brandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  brandSecondaryColor?: string | null;
  customDomain?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  abn?: string | null;
  acn?: string | null;
  afslNumber?: string | null;
  taxAgentNumber?: string | null;
  ssoEnabled: boolean;
  subscriptionStatus?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// CLIENT TYPES
// =============================================================================

export interface PortalClient {
  id: string;
  organizationId: string;
  userId: string;
  status: ClientStatus;
  consentStatus: ConsentStatus;
  accessScopes: DataAccessScope[];
  consentGrantedAt?: Date | null;
  consentExpiresAt?: Date | null;
  consentRevokedAt?: Date | null;
  assignedToMemberId?: string | null;
  clientReference?: string | null;
  externalId?: string | null;
  tags: string[];
  onboardedAt?: Date | null;
  lastAccessedAt?: Date | null;
  archivedAt?: Date | null;
  archivedReason?: string | null;
  createdAt: Date;
  updatedAt: Date;

  // Expanded relations
  user?: ClientUser;
  assignedTo?: PortalStaffMember;
  notesCount?: number;
  tasksCount?: number;
  pendingTasksCount?: number;
}

export interface ClientUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

// =============================================================================
// STAFF/MEMBER TYPES
// =============================================================================

export interface PortalStaffMember {
  id: string;
  organizationId: string;
  userId: string;
  role: PortalUserRole;
  invitedAt: Date;
  joinedAt?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Expanded user info
  user?: {
    id: string;
    email: string;
    name: string;
  };

  // Aggregated data
  assignedClientsCount?: number;
}

// =============================================================================
// INVITATION TYPES
// =============================================================================

export interface PortalInvitation {
  id: string;
  organizationId: string;
  type: InvitationType;
  email: string;
  role: PortalUserRole;
  status: InvitationStatus;
  requestedScopes: DataAccessScope[];
  tokenExpiresAt: Date;
  invitedByMemberId: string;
  personalMessage?: string | null;
  respondedAt?: Date | null;
  acceptedUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;

  // Expanded relations
  invitedBy?: PortalStaffMember;
}

// =============================================================================
// NOTE & TASK TYPES
// =============================================================================

export interface ClientNote {
  id: string;
  organizationClientId: string;
  title?: string | null;
  content: string;
  isPinned: boolean;
  isPrivate: boolean;
  createdByMemberId: string;
  createdAt: Date;
  updatedAt: Date;

  // Expanded relations
  createdBy?: PortalStaffMember;
}

export interface ClientTask {
  id: string;
  organizationClientId: string;
  title: string;
  description?: string | null;
  status: ClientTaskStatus;
  priority: ClientTaskPriority;
  dueDate?: Date | null;
  completedAt?: Date | null;
  assignedToMemberId?: string | null;
  createdByMemberId: string;
  createdAt: Date;
  updatedAt: Date;

  // Expanded relations
  assignedTo?: PortalStaffMember;
  createdBy?: PortalStaffMember;
  client?: PortalClient;
}

// =============================================================================
// ACCESS LOG TYPES
// =============================================================================

export interface ClientAccessLog {
  id: string;
  organizationClientId: string;
  accessedByMemberId: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  accessedAt: Date;

  // Expanded relations
  accessedBy?: PortalStaffMember;
}

// =============================================================================
// API KEY TYPES
// =============================================================================

export interface PortalApiKey {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  rateLimit: number;
  rateLimitWindow: number;
  lastUsedAt?: Date | null;
  usageCount: number;
  createdByMemberId: string;
  isActive: boolean;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  revokedByMemberId?: string | null;
  createdAt: Date;
  updatedAt: Date;

  // Expanded relations
  createdBy?: PortalStaffMember;
  revokedBy?: PortalStaffMember;
}

// =============================================================================
// ACCOUNTING INTEGRATION TYPES
// =============================================================================

export interface AccountingIntegration {
  id: string;
  organizationId: string;
  provider: AccountingProvider;
  providerTenantId?: string | null;
  providerOrganization?: string | null;
  isConnected: boolean;
  lastConnectedAt?: Date | null;
  connectionError?: string | null;
  syncDirection: IntegrationSyncDirection;
  syncEnabled: boolean;
  autoSyncEnabled: boolean;
  syncIntervalHours: number;
  syncContacts: boolean;
  syncInvoices: boolean;
  syncBankTransactions: boolean;
  syncBankAccounts: boolean;
  lastSyncAt?: Date | null;
  lastSyncStatus?: IntegrationSyncStatus | null;
  lastSyncError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationSyncLog {
  id: string;
  integrationId: string;
  direction: IntegrationSyncDirection;
  status: IntegrationSyncStatus;
  entityType: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  startedAt: Date;
  completedAt?: Date | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  errorDetails?: Record<string, unknown> | null;
  triggeredBy?: string | null;
  createdAt: Date;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface CreateOrganizationRequest {
  name: string;
  slug?: string;
  description?: string;
  organizationType: OrganizationType;
  plan?: OrganizationPlan;
  businessEmail?: string;
  businessPhone?: string;
  abn?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
  brandName?: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;
  abn?: string;
  acn?: string;
  afslNumber?: string;
  taxAgentNumber?: string;
}

export interface InviteClientRequest {
  email: string;
  requestedScopes: DataAccessScope[];
  personalMessage?: string;
}

export interface InviteStaffRequest {
  email: string;
  role: PortalUserRole;
  personalMessage?: string;
}

export interface GrantConsentRequest {
  organizationId: string;
  accessScopes: DataAccessScope[];
  expiresAt?: Date;
}

export interface CreateNoteRequest {
  title?: string;
  content: string;
  isPinned?: boolean;
  isPrivate?: boolean;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: ClientTaskPriority;
  dueDate?: Date;
  assignedToMemberId?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: ClientTaskStatus;
  priority?: ClientTaskPriority;
  dueDate?: Date;
  assignedToMemberId?: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: Date;
}

export interface CreateApiKeyResponse {
  apiKey: PortalApiKey;
  secret: string; // Only returned once at creation
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

export interface ClientFilters {
  status?: ClientStatus;
  consentStatus?: ConsentStatus;
  assignedToMemberId?: string;
  tags?: string[];
  search?: string;
}

export interface TaskFilters {
  status?: ClientTaskStatus;
  priority?: ClientTaskPriority;
  assignedToMemberId?: string;
  dueBefore?: Date;
  dueAfter?: Date;
}

// =============================================================================
// DASHBOARD TYPES
// =============================================================================

export interface PortalDashboardStats {
  totalClients: number;
  activeClients: number;
  pendingClients: number;
  totalStaff: number;
  activeIntegrations: number;
  pendingTasks: number;
  overdueTasks: number;
  recentActivity: ClientAccessLog[];
}

export interface ClientSummary {
  totalNetWorth?: number;
  totalDebt?: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  accountsCount?: number;
  propertiesCount?: number;
  loansCount?: number;
  investmentsCount?: number;
  lastUpdated?: Date;
}
