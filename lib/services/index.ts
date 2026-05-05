/**
 * Services Index
 *
 * ============================================================================
 * CRITICAL DESIGN PRINCIPLE: SINGLE SOURCE OF TRUTH
 * ============================================================================
 *
 * All financial calculations MUST use the Master Financial Service.
 * This ensures consistent numbers across all pages and API endpoints.
 *
 * DO NOT calculate financial data directly in API routes.
 * DO NOT query database and aggregate manually.
 * DO use getMasterFinancialSnapshot() for all financial data needs.
 *
 * See: lib/services/masterFinancialService.ts
 * See: docs/ARCHITECTURE.md for design principles
 * ============================================================================
 */

// =============================================================================
// MASTER FINANCIAL SERVICE - PRIMARY API (USE THIS)
// =============================================================================

export {
  // Main function - gets complete financial snapshot
  getMasterFinancialSnapshot,

  // Convenience getters for specific data
  getNetWorth,
  getMonthlyCashflow,
  getQuickMetrics,
  getHealthScore,
  getTaxSummary,
  getPropertyMetrics,
  getInvestmentMetrics,

  // Types
  type MasterFinancialSnapshot,
  type MasterExpenseBreakdown,
  type MasterIncomeBreakdown,
  type PropertyMetrics,
  type InvestmentMetrics,
  type TaxSummary,
  type EmergencyFundMetrics,
  type HealthScoreMetrics,
} from './masterFinancialService';

// =============================================================================
// PHASE 41a/b — LEGAL ENTITY SERVICE
// =============================================================================

export {
  getDefaultLegalEntityId,
  listEntitiesForUser,
  createEntity,
  updateEntity,
  deleteEntity,
  EntityHasOwnedObjectsError,
  type LegalEntitySummary,
  type CreateEntityInput,
  type UpdateEntityInput,
} from './legalEntityService';

// =============================================================================
// PHASE 41d — MONEY FLOW SERVICE
// =============================================================================

export {
  getMoneyFlow,
  type MoneyFlowResult,
  type MoneyFlowEntity,
  type MoneyFlowEdge,
  type MoneyFlowSource,
  type MoneyFlowOutflow,
  type MoneyFlowSourceLabel,
  type MoneyFlowOutflowLabel,
} from './moneyFlowService';

// =============================================================================
// PHASE 32C PR4a — PROFESSIONAL MARKETPLACE
// =============================================================================

export {
  // Org-side
  getListingForOrg,
  upsertListing,
  submitForReview,
  // Admin-side
  listForAdmin,
  getListingByIdForAdmin,
  approveListing,
  rejectListing,
  suspendListing,
  // Public
  browsePublic,
  getPublicListing,
  // Helpers
  isValidSlug,
  slugify,
  // Errors
  MarketplaceServiceError,
  // Types
  type ListingDraftInput,
  type PublicListingFilter,
  type AdminListingFilter,
  type ApprovalInput,
  type RejectionInput,
} from './marketplaceService';

// =============================================================================
// PHASE 32C PR4b — ASK A PROFESSIONAL
// =============================================================================

export {
  getCandidatesForUser,
  isKnownContext,
  type AskAProContext,
  type AskAProResult,
  type OrgScopedCandidate,
  type PublicListingCandidate,
} from './askAProfessionalService';

// =============================================================================
// PHASE 32C PR4c — PROFESSIONAL REQUEST LIFECYCLE
// =============================================================================

export {
  submitRequest,
  listRequestsForUser,
  listInboxForOrg,
  getRequestForOrg,
  acceptRequest,
  declineRequest,
  withdrawRequest,
  classifyNetWorthTier,
  ProfessionalRequestServiceError,
  type SubmitRequestInput,
  type RespondInput,
} from './professionalRequestService';

// =============================================================================
// PHASE 32C PR4d — CONVERSATIONS
// =============================================================================

export {
  createForAcceptedRequest,
  createOrgScopedConversation,
  assertParticipant,
  listMessages,
  getConversationDetails,
  listConversationsForUser,
  listConversationsForOrg,
  postMessage,
  softDeleteFromUserView,
  closeConversation,
  findConversationByReplyToSlug,
  buildReplyToAddress,
  ConversationServiceError,
  type CreateForRequestInput,
  type CreateOrgScopedInput,
  type PostMessageInput,
} from './conversationService';
