# PHASE 32: ENTERPRISE PORTAL - Organization Client Management

> **Status**: ✅ **SHIPPED — Phase 32B + 32C complete (May 2026).** Pricing model finalised (Studio AU$199 / Practice AU$599 / Enterprise from $1,499 — Xero-style dual-axis with seat + client overflow). White-labeling shipped on PRACTICE+ tier. SSO deferred to PROD. Multi-Organization Clients supported via `OrganizationClient` model. API access shipped on PRACTICE+ tier. Xero integration: personal Xero OAuth + balance-sheet/P&L import shipped (Phase 41a-d); full bidirectional sync deferred to PROD per Phase 41f. **Single source of truth invariant preserved** — `getMasterFinancialSnapshot()` is the canonical engine; `viewerContext` parameter (not a fork) applies service-layer scope filtering for adviser drill-in. **See `docs/IMPLEMENTATION_PLAN.md` Recently Completed entries 2026-05-04 through 2026-05-09 for full deliverables list, and `docs/blueprint/MASTER_BLUEPRINT.md` §4 Completed Phases for Phase 32B PR1/PR3 + 32C PR4a/4b/4c/4d/PR6 row-by-row status.**
>
> **Author**: Claude AI
> **Created**: 2026-01-19
> **Updated**: 2026-05-09 — flipped to SHIPPED with reference to canonical operational SSOT
> **Target Audience**: Accountants, Financial Advisors, Wealth Managers, Bookkeepers

---

## Decision Log

| Question | Decision | Date |
|----------|----------|------|
| Pricing Model | ✅ Locked 2026-05-04 — Studio AU$199 / Practice AU$599 / Enterprise from $1,499 (Xero-style dual-axis with seat + client overflow add-ons) | 2026-05-04 |
| White-Labeling | ✅ Shipped on PRACTICE+ tier via `lib/portal/planTier.ts` feature flags | 2026-05-08 |
| SSO/SAML | 📋 Deferred to PROD-ready (post-Basiq accreditation) | 2026-05-04 |
| Multi-Organization Clients | ✅ Supported via `OrganizationClient` model + per-org consent | 2026-05-04 |
| API Access | ✅ Shipped on PRACTICE+ tier | 2026-05-08 |
| Xero Integration | 🔄 Phase 41a-d shipped personal OAuth + balance-sheet import; full bidirectional sync queued under Phase 41f (~10 days) | 2026-05-09 |
| **Data Integrity** | ✅ **Invariant preserved** — `getMasterFinancialSnapshot()` canonical engine, `viewerContext` parameter (not a fork) for adviser drill-in | 2026-05-04 |
| **Isolation** | ✅ Service-layer scope filtering at `viewerContext`, never UI-layer | 2026-05-04 |
| **Accountant UX** | ✅ Practice surface shipped — Apple-glass + warm-ivory aesthetic, profession-aware config (adviser/broker/accountant), TRAIL framework reused | 2026-05-04 |
| **Anti-poaching guardrail** | ✅ `team:invite` + commercial actions (submit-listing / subscribe / cancel) PORTAL_OWNER-only; `PORTAL_SEAT_INVITED` audit log row on every invitation | 2026-05-04 |
| **Leaky-funnel guardrail** | ✅ Org-attached users never see public marketplace surface (enforced at service boundary in `getCandidatesForUser` + `submitRequest`) | 2026-05-04 |
| **Pitch fixture seed** | ✅ `prisma/seed-lighthouse.ts` + `npm run seed:lighthouse` — 3 archetypes (Sarah / David+Emma / Olivia) + Smithfield Wealth Advisers | 2026-05-09 |
| **Consent scope presets** (PR3 #10) | ✅ Profession-aware presets (`LENDING` / `TAX` / `ADVISORY`) — SSOT at `lib/portal/scopePresets.ts`, quick-pick chips in `components/portal/team/InviteModal.tsx` (the adviser-side scope-picking surface — the original spec named `ConsentRequest.tsx` but that's the consumer *approve* UI; presets belong on the adviser *request* UI). Active chip de-highlights when the adviser deviates from a preset. Checkboxes remain for fine-tuning. | 2026-05-09 |
| **Real alert engine** (PR3 #9) | 🟡 **#9a shipped** — schema (`ClientAlert` + `ClientSnapshotMarker` + `ClientAlertStatus`) + pure engine `lib/portal/alerts/alertEngine.ts` (5 v1 triggers: CASHFLOW_NEGATIVE / EMERGENCY_FUND_LOW / LVR_REFINANCE_WINDOW stateless; HEALTH_DROP / TRAIL_ADVANCED stateful) + 20+ tests + cron sweep `POST /api/portal/alerts/sweep` (`CRON_SECRET` auth, per-org per-client snapshot → scope-gated `computeAlerts` → upsert/resolve/re-arm). **#9b queued** — org-scoped `GET /api/portal/alerts` + dismiss endpoint + Practice dashboard wiring (replaces the `LIGHTHOUSE_ALERTS` fixture with real data, fixture stays as the empty-state preview). Cloud Scheduler job (`monitrax-portal-alert-sweep`, `0 4 * * *`) is a Reza-side console step; engine is dormant until then. See `docs/blueprint/PHASE_32B_PR3_ALERT_ENGINE.md`. | 2026-05-09 |

---

## 1. Executive Summary

### 1.1 Purpose

Enable Monitrax to be sold as an enterprise/organization license to professional service providers (accountants, financial advisors, wealth managers) who can then provide the app to their clients while having portal access to view and manage client financial data.

### 1.2 Business Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                         B2B2C MODEL                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   MONITRAX ───sells to───> ORGANIZATION ───provides to───> CLIENTS │
│                            (Accountant)                   (Users)   │
│                                 │                            │      │
│                                 │        consents to         │      │
│                                 │<───────share data──────────│      │
│                                 │                                   │
│                          ┌──────▼──────┐                           │
│                          │   PORTAL    │                           │
│                          │ (View Data) │                           │
│                          └─────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Stakeholders

| Stakeholder | Role | Needs |
|-------------|------|-------|
| **Organization Owner** | Accountant/FA who purchases license | Manage clients, view data, billing |
| **Organization Admin** | Staff member with admin access | View clients, limited settings |
| **Organization Member** | Junior staff, view-only | Read-only client access |
| **Client User** | End user of Monitrax | Use app normally, control data sharing |

---

## 2. Requirements

### 2.1 Functional Requirements

#### FR-1: Organization Management
- FR-1.1: Create and configure organizations
- FR-1.2: Manage organization settings (name, branding, allowed domains)
- FR-1.3: Configure organization-wide security policies (MFA enforcement)
- FR-1.4: Manage subscription/billing at organization level

#### FR-2: Team Management
- FR-2.1: Invite team members (staff) to organization
- FR-2.2: Assign roles to team members (OWNER, ADMIN, MEMBER)
- FR-2.3: Revoke team member access
- FR-2.4: View team member activity

#### FR-3: Client Management
- FR-3.1: Invite clients to join organization
- FR-3.2: View list of all clients with status
- FR-3.3: Search and filter clients
- FR-3.4: Group/tag clients for organization
- FR-3.5: Remove clients from organization

#### FR-4: Client Data Access
- FR-4.1: View client financial dashboard (read-only)
- FR-4.2: View client properties, loans, accounts, income, expenses
- FR-4.3: View client investment accounts and holdings
- FR-4.4: View client tax position and superannuation
- FR-4.5: View client documents (with consent)
- FR-4.6: Export client data (PDF, CSV, Excel)

#### FR-5: Client Consent System
- FR-5.1: Clients must explicitly consent to data sharing
- FR-5.2: Clients can configure granular data access (which modules)
- FR-5.3: Clients can revoke consent at any time
- FR-5.4: Consent changes are audited

#### FR-6: Advisor Tools
- FR-6.1: Add private notes to client records
- FR-6.2: Create tasks/reminders per client
- FR-6.3: View activity timeline for client
- FR-6.4: Generate reports for client

#### FR-7: Audit & Compliance
- FR-7.1: Log all advisor access to client data
- FR-7.2: Generate compliance reports
- FR-7.3: Data access audit trail exportable
- FR-7.4: Retention policy management

### 2.2 Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Performance** | Portal dashboard loads < 2s |
| **Security** | SOC 2 Type II compliance ready |
| **Privacy** | GDPR/Australian Privacy Act compliant |
| **Scalability** | Support organizations with 1000+ clients |
| **Availability** | 99.9% uptime for portal |

---

## 3. Data Model Extensions

### 3.1 New Models

```prisma
// =============================================================================
// PHASE 30: ENTERPRISE PORTAL - ORGANIZATION ENHANCEMENTS
// =============================================================================

enum OrganizationType {
  ACCOUNTING_FIRM
  FINANCIAL_ADVISOR
  WEALTH_MANAGER
  BOOKKEEPER
  TAX_AGENT
  OTHER
}

enum OrganizationPlan {
  STARTER       // Up to 10 clients
  PROFESSIONAL  // Up to 50 clients
  BUSINESS      // Up to 200 clients
  ENTERPRISE    // Unlimited clients
}

enum ClientStatus {
  INVITED       // Invitation sent, not yet accepted
  PENDING       // Accepted invite, consent pending
  ACTIVE        // Fully active with consent
  SUSPENDED     // Temporarily suspended
  ARCHIVED      // No longer active client
}

enum DataAccessScope {
  FULL          // All financial data
  FINANCIAL     // Properties, Loans, Accounts, Income, Expenses
  INVESTMENTS   // Investment accounts, holdings, transactions
  TAX           // Tax position, superannuation, deductions
  DOCUMENTS     // Uploaded documents
  TRANSACTIONS  // Bank transactions only
}

enum ConsentStatus {
  PENDING       // Awaiting client consent
  GRANTED       // Client has consented
  REVOKED       // Client revoked consent
  EXPIRED       // Consent expired (if time-limited)
}

// Enhanced Organization Model
model Organization {
  id                    String               @id @default(uuid())
  name                  String
  slug                  String               @unique
  description           String?
  type                  OrganizationType     @default(OTHER)

  // Branding (Phase 32.11: White-Labeling)
  logoUrl               String?
  faviconUrl            String?
  primaryColor          String?              // Hex color for portal branding
  secondaryColor        String?
  accentColor           String?
  fontFamily            String?              // Custom font (from approved list)
  customCss             String?              @db.Text  // Advanced customization
  emailHeaderHtml       String?              @db.Text  // Custom email header
  emailFooterHtml       String?              @db.Text  // Custom email footer
  customDomain          String?              @unique   // e.g., portal.accountingfirm.com
  customDomainVerified  Boolean              @default(false)

  // Contact
  email                 String?
  phone                 String?
  website               String?
  address               String?

  // Business Details (Australia)
  abn                   String?              // Australian Business Number
  acn                   String?              // Australian Company Number
  taxAgentNumber        String?              // Registered Tax Agent number

  // Subscription
  plan                  OrganizationPlan     @default(STARTER)
  planStartDate         DateTime?
  planEndDate           DateTime?
  maxClients            Int                  @default(10)

  // Security Settings
  mfaEnforced           Boolean              @default(false)
  sessionDurationHours  Int                  @default(168)
  allowedDomains        String[]
  ipWhitelist           String[]             @default([])

  // Feature Flags
  canExportData         Boolean              @default(true)
  canAddNotes           Boolean              @default(true)
  canCreateTasks        Boolean              @default(true)
  apiAccessEnabled      Boolean              @default(false)
  whiteLabelEnabled     Boolean              @default(false)

  // SSO Configuration (Phase 32.12)
  ssoEnabled            Boolean              @default(false)
  ssoProvider           String?              // "saml", "oidc"
  ssoEntityId           String?              // SAML Entity ID
  ssoMetadataUrl        String?              // SAML Metadata URL
  ssoSignOnUrl          String?              // SAML SSO URL
  ssoCertificate        String?              @db.Text  // SAML X.509 Certificate
  oidcClientId          String?              // OIDC Client ID
  oidcClientSecret      String?              // OIDC Client Secret (encrypted)
  oidcIssuerUrl         String?              // OIDC Issuer URL
  ssoEnforced           Boolean              @default(false)  // Require SSO for all users
  ssoJitProvisioning    Boolean              @default(true)   // Auto-create users on first login

  // API Access (Phase 32.13)
  apiKeys               OrganizationApiKey[]

  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  // Relationships
  members               OrganizationMember[]
  clients               OrganizationClient[]
  invitations           OrganizationInvitation[]
  auditLogs             AuditLog[]
  clientNotes           ClientNote[]
  clientTasks           ClientTask[]
  strategyRecommendations StrategyRecommendation[]

  @@map("organizations")
}

// Organization Client Relationship
model OrganizationClient {
  id                    String               @id @default(uuid())
  organizationId        String
  userId                String               // The client's user account

  // Status
  status                ClientStatus         @default(INVITED)

  // Client metadata (for org's reference)
  clientReference       String?              // Org's internal reference/ID
  tags                  String[]             @default([])
  assignedTo            String?              // OrganizationMember ID (primary advisor)

  // Consent
  consentStatus         ConsentStatus        @default(PENDING)
  consentGrantedAt      DateTime?
  consentRevokedAt      DateTime?
  consentExpiresAt      DateTime?            // Optional expiry

  // Data Access Scope (granular consent)
  accessScopes          DataAccessScope[]    @default([])

  // Timestamps
  invitedAt             DateTime             @default(now())
  joinedAt              DateTime?
  lastAccessedAt        DateTime?            // Last time org accessed client data
  archivedAt            DateTime?

  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  // Relationships
  organization          Organization         @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user                  User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  notes                 ClientNote[]
  tasks                 ClientTask[]
  accessLogs            ClientAccessLog[]

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
  @@index([status])
  @@index([assignedTo])
  @@map("organization_clients")
}

// Organization Invitations (for both staff and clients)
model OrganizationInvitation {
  id                    String               @id @default(uuid())
  organizationId        String

  // Invitation details
  email                 String
  role                  UserRole?            // For staff invites (null = client)
  isClientInvite        Boolean              @default(false)

  // Token
  token                 String               @unique
  expiresAt             DateTime

  // Status
  acceptedAt            DateTime?
  declinedAt            DateTime?

  // Metadata
  invitedBy             String               // User ID who sent invite
  message               String?              // Optional personal message

  createdAt             DateTime             @default(now())

  // Relationships
  organization          Organization         @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([email])
  @@index([token])
  @@map("organization_invitations")
}

// Client Notes (private to organization)
model ClientNote {
  id                    String               @id @default(uuid())
  organizationId        String
  organizationClientId  String
  authorId              String               // OrganizationMember who wrote the note

  // Content
  title                 String?
  content               String               @db.Text
  isPinned              Boolean              @default(false)

  // Metadata
  category              String?              // "tax", "meeting", "follow-up", etc.

  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  // Relationships
  organization          Organization         @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  organizationClient    OrganizationClient   @relation(fields: [organizationClientId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([organizationClientId])
  @@index([authorId])
  @@map("client_notes")
}

// Client Tasks/Reminders
model ClientTask {
  id                    String               @id @default(uuid())
  organizationId        String
  organizationClientId  String
  assignedTo            String?              // OrganizationMember ID
  createdBy             String               // User ID who created

  // Task details
  title                 String
  description           String?              @db.Text
  dueDate               DateTime?
  priority              String               @default("MEDIUM") // LOW, MEDIUM, HIGH, URGENT

  // Status
  isCompleted           Boolean              @default(false)
  completedAt           DateTime?
  completedBy           String?

  // Recurrence (optional)
  isRecurring           Boolean              @default(false)
  recurrencePattern     String?              // WEEKLY, MONTHLY, QUARTERLY, ANNUALLY

  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  // Relationships
  organization          Organization         @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  organizationClient    OrganizationClient   @relation(fields: [organizationClientId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([organizationClientId])
  @@index([assignedTo])
  @@index([dueDate])
  @@index([isCompleted])
  @@map("client_tasks")
}

// Client Data Access Log (compliance audit trail)
model ClientAccessLog {
  id                    String               @id @default(uuid())
  organizationClientId  String
  accessedBy            String               // OrganizationMember user ID

  // Access details
  accessType            String               // "VIEW", "EXPORT", "DOWNLOAD"
  dataType              String               // "DASHBOARD", "PROPERTIES", "LOANS", etc.
  entityId              String?              // Specific entity accessed (if applicable)

  // Context
  ipAddress             String?
  userAgent             String?

  createdAt             DateTime             @default(now())

  // Relationships
  organizationClient    OrganizationClient   @relation(fields: [organizationClientId], references: [id], onDelete: Cascade)

  @@index([organizationClientId])
  @@index([accessedBy])
  @@index([createdAt])
  @@map("client_access_logs")
}

// Organization API Keys (Phase 32.13)
model OrganizationApiKey {
  id                    String               @id @default(uuid())
  organizationId        String

  // Key details
  name                  String               // "Production Key", "Testing Key"
  keyHash               String               // Hashed API key (never store plaintext)
  keyPrefix             String               // First 8 chars for identification (e.g., "mk_live_")

  // Permissions
  scopes                DataAccessScope[]    @default([])  // Which data types can be accessed
  readOnly              Boolean              @default(true)

  // Limits
  rateLimit             Int                  @default(1000)  // Requests per hour

  // Status
  isActive              Boolean              @default(true)
  lastUsedAt            DateTime?
  expiresAt             DateTime?

  // Audit
  createdBy             String               // User ID who created the key
  revokedAt             DateTime?
  revokedBy             String?

  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  // Relationships
  organization          Organization         @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([keyPrefix])
  @@index([isActive])
  @@map("organization_api_keys")
}

// =============================================================================
// ACCOUNTING INTEGRATIONS (Phase 32.14+)
// Extensible design supporting Xero (primary), MYOB, QuickBooks, Sage, etc.
// =============================================================================

enum AccountingProvider {
  XERO            // Primary - Australian market leader
  MYOB            // Australia/NZ
  QUICKBOOKS      // QuickBooks Online
  SAGE            // Sage Business Cloud
  FRESHBOOKS      // FreshBooks
  WAVE            // Wave Accounting (free)
  OTHER           // Generic/Custom
}

enum IntegrationSyncDirection {
  OUTBOUND        // Monitrax → Accounting Software
  INBOUND         // Accounting Software → Monitrax
  BIDIRECTIONAL   // Two-way sync
}

enum IntegrationSyncStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
  PARTIAL
}

// Generic Accounting Integration (supports multiple providers)
model AccountingIntegration {
  id                    String               @id @default(uuid())
  organizationId        String
  provider              AccountingProvider

  // OAuth Tokens (encrypted at rest)
  accessToken           String               @db.Text
  refreshToken          String?              @db.Text
  tokenExpiresAt        DateTime?

  // Provider-specific IDs
  externalOrgId         String?              // Xero tenant ID, MYOB company file ID, etc.
  externalOrgName       String?              // Name of the connected org in external system

  // Connection Status
  isActive              Boolean              @default(true)
  isDefault             Boolean              @default(false)  // Primary integration for this org
  lastSyncAt            DateTime?
  connectionStatus      String               @default("CONNECTED")  // CONNECTED, EXPIRED, ERROR

  // Sync Settings
  autoSyncEnabled       Boolean              @default(false)
  syncFrequencyHours    Int                  @default(24)
  syncDirection         IntegrationSyncDirection @default(OUTBOUND)

  // Data Mapping Configuration (JSON - provider-specific)
  categoryMappings      Json?                // Monitrax category ID -> External account code
  taxCodeMappings       Json?                // Monitrax tax type -> External tax code
  customFieldMappings   Json?                // Additional field mappings

  // Feature Flags (what this integration supports)
  canSyncTransactions   Boolean              @default(true)
  canSyncInvoices       Boolean              @default(true)
  canSyncContacts       Boolean              @default(true)
  canSyncBankFeeds      Boolean              @default(false)
  canSyncDocuments      Boolean              @default(false)

  // Metadata
  providerMetadata      Json?                // Provider-specific config/data

  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt
  createdBy             String               // User who set up the integration

  // Relationships
  organization          Organization         @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  syncLogs              IntegrationSyncLog[]

  @@unique([organizationId, provider])  // One connection per provider per org
  @@index([organizationId])
  @@index([provider])
  @@index([isActive])
  @@map("accounting_integrations")
}

// Sync Log (tracks all sync operations across providers)
model IntegrationSyncLog {
  id                    String               @id @default(uuid())
  integrationId         String
  organizationClientId  String?              // Which client's data (null = org-wide)

  // Sync Details
  syncType              String               // "TRANSACTIONS", "INVOICES", "CONTACTS", "FULL", "INCREMENTAL"
  direction             IntegrationSyncDirection
  status                IntegrationSyncStatus
  triggeredBy           String               // "MANUAL", "SCHEDULED", "WEBHOOK", "API"

  // Results
  itemsProcessed        Int                  @default(0)
  itemsCreated          Int                  @default(0)
  itemsUpdated          Int                  @default(0)
  itemsSkipped          Int                  @default(0)
  itemsFailed           Int                  @default(0)

  // Error Tracking
  errorSummary          String?
  errorDetails          Json?                // Array of detailed errors

  // Timing
  startedAt             DateTime             @default(now())
  completedAt           DateTime?
  durationMs            Int?

  // Relationships
  integration           AccountingIntegration @relation(fields: [integrationId], references: [id], onDelete: Cascade)

  @@index([integrationId])
  @@index([organizationClientId])
  @@index([startedAt])
  @@index([status])
  @@map("integration_sync_logs")
}

// Entity Mapping (tracks which Monitrax entities map to external entities)
model IntegrationEntityMapping {
  id                    String               @id @default(uuid())
  integrationId         String

  // Monitrax Entity
  monitraxEntityType    String               // "Transaction", "Income", "Expense", "Contact"
  monitraxEntityId      String

  // External Entity
  externalEntityType    String               // "Invoice", "Bill", "BankTransaction", etc.
  externalEntityId      String

  // Sync State
  lastSyncedAt          DateTime?
  syncHash              String?              // Hash of last synced data for change detection

  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  @@unique([integrationId, monitraxEntityType, monitraxEntityId])
  @@unique([integrationId, externalEntityType, externalEntityId])
  @@index([integrationId])
  @@index([monitraxEntityId])
  @@index([externalEntityId])
  @@map("integration_entity_mappings")
}
```

### 3.2 User Model Updates

```prisma
// Add to User model
model User {
  // ... existing fields ...

  // Phase 30: Enterprise Portal
  organizationClients   OrganizationClient[]  // Organizations this user is a client of

  // ... existing relationships ...
}
```

---

## 4. API Specification

### 4.1 Organization Management APIs

```
POST   /api/portal/organizations                    # Create organization
GET    /api/portal/organizations/:orgId             # Get organization details
PUT    /api/portal/organizations/:orgId             # Update organization
DELETE /api/portal/organizations/:orgId             # Delete organization (OWNER only)
```

### 4.2 Team Management APIs

```
GET    /api/portal/organizations/:orgId/members     # List team members
POST   /api/portal/organizations/:orgId/members/invite   # Invite team member
PUT    /api/portal/organizations/:orgId/members/:id      # Update member role
DELETE /api/portal/organizations/:orgId/members/:id      # Remove member
```

### 4.3 Client Management APIs

```
GET    /api/portal/organizations/:orgId/clients          # List all clients
POST   /api/portal/organizations/:orgId/clients/invite   # Invite client
GET    /api/portal/organizations/:orgId/clients/:id      # Get client details
PUT    /api/portal/organizations/:orgId/clients/:id      # Update client metadata
DELETE /api/portal/organizations/:orgId/clients/:id      # Archive client
```

### 4.4 Client Data Access APIs

```
GET    /api/portal/clients/:clientId/dashboard           # Client financial overview
GET    /api/portal/clients/:clientId/properties          # Client properties
GET    /api/portal/clients/:clientId/loans               # Client loans
GET    /api/portal/clients/:clientId/accounts            # Client accounts
GET    /api/portal/clients/:clientId/income              # Client income
GET    /api/portal/clients/:clientId/expenses            # Client expenses
GET    /api/portal/clients/:clientId/investments         # Client investments
GET    /api/portal/clients/:clientId/tax-position        # Client tax position
GET    /api/portal/clients/:clientId/documents           # Client documents
POST   /api/portal/clients/:clientId/export              # Export client data
```

### 4.5 Advisor Tools APIs

```
# Notes
GET    /api/portal/clients/:clientId/notes               # List client notes
POST   /api/portal/clients/:clientId/notes               # Create note
PUT    /api/portal/clients/:clientId/notes/:noteId       # Update note
DELETE /api/portal/clients/:clientId/notes/:noteId       # Delete note

# Tasks
GET    /api/portal/clients/:clientId/tasks               # List client tasks
POST   /api/portal/clients/:clientId/tasks               # Create task
PUT    /api/portal/clients/:clientId/tasks/:taskId       # Update task
DELETE /api/portal/clients/:clientId/tasks/:taskId       # Delete task

# Activity/Audit
GET    /api/portal/clients/:clientId/activity            # Client activity timeline
GET    /api/portal/organizations/:orgId/access-logs      # Organization access logs
```

### 4.6 Consent Management APIs (Client-side)

```
GET    /api/settings/organizations                       # List orgs user is client of
GET    /api/settings/organizations/:orgId/consent        # View current consent
PUT    /api/settings/organizations/:orgId/consent        # Update consent settings
DELETE /api/settings/organizations/:orgId/consent        # Revoke all consent
```

### 4.7 White-Labeling APIs (Phase 32.11)

```
GET    /api/portal/organizations/:orgId/branding         # Get branding settings
PUT    /api/portal/organizations/:orgId/branding         # Update branding
POST   /api/portal/organizations/:orgId/branding/logo    # Upload logo
DELETE /api/portal/organizations/:orgId/branding/logo    # Remove logo
POST   /api/portal/organizations/:orgId/branding/favicon # Upload favicon

# Custom Domain
POST   /api/portal/organizations/:orgId/domain           # Set custom domain
GET    /api/portal/organizations/:orgId/domain/verify    # Check domain verification
DELETE /api/portal/organizations/:orgId/domain           # Remove custom domain
```

### 4.8 SSO/SAML APIs (Phase 32.12)

```
# SSO Configuration
GET    /api/portal/organizations/:orgId/sso              # Get SSO configuration
PUT    /api/portal/organizations/:orgId/sso              # Update SSO settings
POST   /api/portal/organizations/:orgId/sso/test         # Test SSO connection
DELETE /api/portal/organizations/:orgId/sso              # Disable SSO

# SAML Endpoints
GET    /api/auth/saml/:orgSlug/metadata                  # SAML Service Provider metadata
POST   /api/auth/saml/:orgSlug/acs                       # SAML Assertion Consumer Service
GET    /api/auth/saml/:orgSlug/login                     # Initiate SAML login

# OIDC Endpoints
GET    /api/auth/oidc/:orgSlug/callback                  # OIDC callback
GET    /api/auth/oidc/:orgSlug/login                     # Initiate OIDC login
```

### 4.9 API Key Management APIs (Phase 32.13)

```
# API Keys
GET    /api/portal/organizations/:orgId/api-keys         # List API keys
POST   /api/portal/organizations/:orgId/api-keys         # Create API key
GET    /api/portal/organizations/:orgId/api-keys/:id     # Get API key details
PUT    /api/portal/organizations/:orgId/api-keys/:id     # Update API key
DELETE /api/portal/organizations/:orgId/api-keys/:id     # Revoke API key

# API Usage
GET    /api/portal/organizations/:orgId/api-usage        # Get API usage stats
```

### 4.10 External API (for Organization API Keys)

```
# These endpoints are accessed using Organization API Keys
# Base URL: /api/v1/org

GET    /api/v1/org/clients                               # List clients (filtered by consent)
GET    /api/v1/org/clients/:clientId                     # Get client data
GET    /api/v1/org/clients/:clientId/properties          # Get client properties
GET    /api/v1/org/clients/:clientId/loans               # Get client loans
GET    /api/v1/org/clients/:clientId/accounts            # Get client accounts
# ... similar endpoints for other data types
```

### 4.11 Accounting Integration APIs (Phase 32.14)

```
# Integration Management
GET    /api/portal/organizations/:orgId/integrations              # List all integrations
POST   /api/portal/organizations/:orgId/integrations              # Create new integration
GET    /api/portal/organizations/:orgId/integrations/:id          # Get integration details
PUT    /api/portal/organizations/:orgId/integrations/:id          # Update integration settings
DELETE /api/portal/organizations/:orgId/integrations/:id          # Disconnect integration

# OAuth Flow
GET    /api/portal/integrations/:provider/authorize               # Start OAuth flow
GET    /api/portal/integrations/:provider/callback                # OAuth callback

# Sync Operations
POST   /api/portal/organizations/:orgId/integrations/:id/sync     # Trigger manual sync
GET    /api/portal/organizations/:orgId/integrations/:id/sync-logs # Get sync history
GET    /api/portal/organizations/:orgId/integrations/:id/sync-logs/:logId  # Get sync details

# Mapping Configuration
GET    /api/portal/organizations/:orgId/integrations/:id/mappings/categories  # Get category mappings
PUT    /api/portal/organizations/:orgId/integrations/:id/mappings/categories  # Update category mappings
GET    /api/portal/organizations/:orgId/integrations/:id/mappings/tax-codes   # Get tax code mappings
PUT    /api/portal/organizations/:orgId/integrations/:id/mappings/tax-codes   # Update tax code mappings

# Provider-Specific Data
GET    /api/portal/organizations/:orgId/integrations/:id/external/accounts    # Get external chart of accounts
GET    /api/portal/organizations/:orgId/integrations/:id/external/tax-codes   # Get external tax codes

# Client Data Sync
POST   /api/portal/clients/:clientId/sync-to/:integrationId       # Sync specific client to integration
GET    /api/portal/clients/:clientId/sync-status/:integrationId   # Get client sync status

# Xero-Specific Endpoints
GET    /api/portal/integrations/xero/practice-manager/clients     # Get Xero PM client list (for accountants)
POST   /api/portal/clients/:clientId/send-to-xero                 # Send specific data to Xero
```

---

## 5. UI/UX Design

### 5.0 Unified Login & Authentication Flow

> **Key Decision**: Single login page with role-based routing

#### 5.0.1 Login Page Options

```
┌─────────────────────────────────────────────────────────────┐
│                        MONITRAX                             │
│                         Login                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   Personal      │    │   Organization  │                │
│  │   Account       │    │   Portal        │                │
│  │                 │    │                 │                │
│  │  Track your     │    │  Access your    │                │
│  │  finances       │    │  client data    │                │
│  └─────────────────┘    └─────────────────┘                │
│                                                             │
│  ─────────────────── OR ───────────────────                │
│                                                             │
│  [Email]                                                    │
│  [Password]                                                 │
│  [        Login        ]                                    │
│                                                             │
│  Forgot password?  |  Sign up                               │
└─────────────────────────────────────────────────────────────┘
```

#### 5.0.2 Authentication Flow

```
┌──────────────┐
│  Login Page  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│  Authenticate User   │
│  (Email/Password,    │
│   OAuth, SSO, etc.)  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Check User's Organization Memberships │
└──────────────────┬───────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
       ▼                       ▼
┌────────────────┐    ┌────────────────────────┐
│ No Org Members │    │ Has Org Memberships    │
│ (Regular User) │    │ (Staff or Multi-Org)   │
└───────┬────────┘    └──────────┬─────────────┘
        │                        │
        ▼                        ▼
┌────────────────┐    ┌────────────────────────┐
│ /dashboard     │    │  Context Selector      │
│ (Personal)     │    │  - Personal Dashboard  │
└────────────────┘    │  - Org 1 Portal        │
                      │  - Org 2 Portal        │
                      └──────────┬─────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
           ┌────────────────┐       ┌────────────────┐
           │ /dashboard     │       │ /portal/:slug  │
           │ (Personal)     │       │ (Org Portal)   │
           └────────────────┘       └────────────────┘
```

#### 5.0.3 Context Switcher (for Multi-Org Users)

Users who belong to multiple organizations or have both personal and org access will see a context switcher in the navigation:

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────┐                                        │
│  │  Monitrax  ▼    │   Dashboard   Clients   Settings       │
│  └─────────────────┘                                        │
│         │                                                    │
│         ├── Personal Dashboard                               │
│         │                                                    │
│         ├── ABC Accounting (Owner)                           │
│         │                                                    │
│         └── XYZ Financial (Admin)                            │
└─────────────────────────────────────────────────────────────┘
```

#### 5.0.4 Post-Login Routing Logic

```typescript
// Pseudocode for post-login routing
function getPostLoginRedirect(user: User): string {
  const orgMemberships = user.organizationMemberships;
  const lastContext = user.preferences?.lastContext;

  // If user selected "Organization Portal" on login page
  if (loginMode === 'organization') {
    if (orgMemberships.length === 1) {
      return `/portal/${orgMemberships[0].organization.slug}`;
    } else if (orgMemberships.length > 1) {
      return '/select-organization';  // Show org selector
    } else {
      return '/portal/create';  // No org? Prompt to create one
    }
  }

  // If user selected "Personal Account" or default
  if (loginMode === 'personal' || !lastContext) {
    return '/dashboard';
  }

  // Restore last used context
  return lastContext;
}
```

#### 5.0.5 URL Structure

| URL Pattern | Access Type | Description |
|-------------|-------------|-------------|
| `/login` | Public | Unified login page |
| `/register` | Public | User registration |
| `/dashboard/*` | Authenticated | Personal financial dashboard |
| `/portal/:orgSlug/*` | Org Member | Organization portal |
| `/settings/*` | Authenticated | Personal settings + org consent |
| `/select-organization` | Multi-Org User | Organization selector |

### 5.1 Portal Navigation Structure

```
/portal
├── /[orgSlug]
│   ├── /dashboard              # Organization overview
│   ├── /clients                # Client list & management
│   │   ├── /[clientId]         # Individual client view
│   │   │   ├── /overview       # Client financial dashboard
│   │   │   ├── /properties     # Client properties
│   │   │   ├── /loans          # Client loans
│   │   │   ├── /accounts       # Client accounts
│   │   │   ├── /income         # Client income
│   │   │   ├── /expenses       # Client expenses
│   │   │   ├── /investments    # Client investments
│   │   │   ├── /tax            # Client tax position
│   │   │   ├── /documents      # Client documents
│   │   │   ├── /notes          # Advisor notes
│   │   │   └── /tasks          # Client tasks
│   │   └── /invite             # Invite new client
│   ├── /team                   # Team member management
│   ├── /settings               # Organization settings
│   │   ├── /general            # Name, branding, contact
│   │   ├── /security           # MFA, sessions, IP whitelist
│   │   ├── /billing            # Subscription management
│   │   ├── /api                # API key management
│   │   └── /integrations       # Accounting integrations (Xero, MYOB, etc.)
│   │       ├── /xero           # Xero connection settings
│   │       ├── /myob           # MYOB connection settings
│   │       └── /[provider]     # Other provider settings
│   └── /reports                # Compliance reports, exports
```

### 5.2 Key Screens

#### 5.2.1 Portal Dashboard
- Total clients count (active, invited, archived)
- Recent client activity
- Upcoming tasks due
- Quick actions (invite client, view reports)
- Client health overview (issues requiring attention)

#### 5.2.2 Client List
- Searchable, filterable table
- Columns: Name, Email, Status, Last Activity, Assigned To, Tags
- Bulk actions (export, archive)
- Quick access to client details

#### 5.2.3 Client Detail View
- Header: Client name, contact, consent status
- Tabbed navigation: Overview, Properties, Loans, etc.
- Sidebar: Quick stats, notes, tasks
- Action buttons: Export, Add Note, Create Task

#### 5.2.4 Client Financial Overview (Read-Only Dashboard)
- Net worth summary
- Property portfolio value
- Loan balances
- Account balances
- Income vs Expenses chart
- Investment performance
- Tax position summary

### 5.3 Client-Side Consent UI

Add to user Settings:
- **Organizations** section showing all organizations user is linked to
- Per-organization consent management:
  - Toggle overall data sharing on/off
  - Granular module toggles (Properties, Loans, etc.)
  - View access history
  - Revoke consent button

### 5.4 Accountant & Financial Advisor User Experience

> **Design Principle**: The portal should feel familiar to accountants who use Xero Practice Manager, MYOB Practice, or similar tools. Use industry-standard terminology, workflows, and layouts.

#### 5.4.1 Familiar Terminology Mapping

| Monitrax Term | Accountant Term | Notes |
|---------------|-----------------|-------|
| Client User | Client | Standard accounting term |
| Organization | Practice / Firm | How accountants refer to their business |
| Team Members | Staff / Team | Familiar terminology |
| Properties | Investment Properties / Real Estate | Tax-relevant categorization |
| Income | Revenue / Receipts | Accounting terminology |
| Expenses | Deductions / Costs | Tax-relevant terminology |
| Transactions | Journal Entries / Line Items | Familiar to bookkeepers |
| Tax Position | Tax Summary / BAS Position | Standard tax terminology |
| Financial Year | FY / Tax Year | Always show FY context |

#### 5.4.2 Client List (Practice Manager Style)

Designed to mirror Xero Practice Manager / MYOB Practice client lists:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CLIENTS                                              [+ Add Client] [⚙ Export] │
├─────────────────────────────────────────────────────────────────────────────────┤
│  🔍 Search clients...    [Filter ▼]  [Sort ▼]  [Group by: Manager ▼]           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ ☐ │ CLIENT          │ MANAGER   │ LAST ACTIVITY │ LODGEMENTS │ STATUS   │   │
│  ├───┼─────────────────┼───────────┼───────────────┼────────────┼──────────┤   │
│  │ ☐ │ John Smith      │ Sarah T.  │ 2 days ago    │ ⚠️ BAS Due  │ 🟢 Active │   │
│  │ ☐ │ Jane Doe        │ Mike R.   │ 1 week ago    │ ✅ Up to date│ 🟢 Active │   │
│  │ ☐ │ ABC Pty Ltd     │ Sarah T.  │ 3 days ago    │ ⚠️ ITR Due  │ 🟢 Active │   │
│  │ ☐ │ XYZ Trust       │ Unassigned│ 1 month ago   │ ❌ Overdue  │ 🟡 Review │   │
│  └───┴─────────────────┴───────────┴───────────────┴────────────┴──────────┘   │
│                                                                                 │
│  Showing 1-50 of 234 clients                              [< Prev] [Next >]    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Key Features (Familiar to Accountants):**
- **Bulk selection** for batch operations
- **Manager assignment** (who's responsible for this client)
- **Lodgement status** (BAS, ITR, FBT tracking)
- **Activity indicators** (last data update)
- **Grouping** by manager, status, or entity type
- **Quick filters**: Active, Needs Review, Overdue, All

#### 5.4.3 Client Detail View (Workpaper Style)

Organized like a digital workpaper/client file:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Clients                                                              │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  JOHN SMITH                                               🟢 Active      │   │
│  │  Individual • TFN: XXX-XXX-XXX • ABN: XX XXX XXX XXX                     │   │
│  │  Manager: Sarah Thompson • Last Updated: 2 days ago                      │   │
│  │                                                                          │   │
│  │  [📧 Email]  [📞 Call]  [📄 Export]  [🔗 Send to Xero]  [📝 Add Note]   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ Overview │ Income │ Deductions │ Assets │ Investments │ Tax │ Documents │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │  FY 2025-26 SUMMARY         │  │  QUICK ACTIONS                         │  │
│  │                             │  │                                         │  │
│  │  Total Income:    $125,430  │  │  [📊 Generate Tax Summary]             │  │
│  │  Total Deductions: $23,850  │  │  [📤 Export to Xero]                   │  │
│  │  Taxable Income:  $101,580  │  │  [📋 View Lodgement History]           │  │
│  │  Est. Tax:         $24,380  │  │  [📝 Create Workpaper]                 │  │
│  │                             │  │                                         │  │
│  │  [View Full Tax Position]   │  │  [⚡ Sync All Data]                    │  │
│  └─────────────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  RECENT ACTIVITY                                         [View All →]   │   │
│  │                                                                          │   │
│  │  📥 Bank transactions synced (142 new)           2 days ago             │   │
│  │  📄 Rental statement uploaded                    1 week ago             │   │
│  │  💰 Dividend income recorded                     2 weeks ago            │   │
│  │  🏠 Property valuation updated                   1 month ago            │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌───────────────────────────────────┐  ┌───────────────────────────────────┐  │
│  │  NOTES (Private)         [+ Add]  │  │  TASKS                    [+ Add]  │  │
│  │                                   │  │                                    │  │
│  │  📌 Review rental deductions      │  │  ☐ Chase missing receipts (Due: 3d)│  │
│  │     before EOFY - Sarah, 1 week   │  │  ☐ Prepare BAS Q3 (Due: 1 week)   │  │
│  │                                   │  │  ☑ Review investment CGT (Done)   │  │
│  └───────────────────────────────────┘  └───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 5.4.4 Tax-Centric Data Views

Accountants need data organized for tax purposes:

**Income Tab:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  INCOME - FY 2025-26                                        [Export] [Sync]    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  📊 INCOME BY CATEGORY                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Salary & Wages (PAYG)                              $95,000.00          │   │
│  │  ├── Employer: ABC Corp (PAYG: $22,800)                                 │   │
│  │                                                                          │   │
│  │  Rental Income (Gross)                              $24,000.00          │   │
│  │  ├── 123 Main St, Sydney                            $24,000.00          │   │
│  │                                                                          │   │
│  │  Interest Income                                     $1,230.00          │   │
│  │  ├── CBA Savings                                       $430.00          │   │
│  │  ├── ING Term Deposit                                  $800.00          │   │
│  │                                                                          │   │
│  │  Dividends (Franked)                                 $5,200.00          │   │
│  │  ├── Franking Credits                                $2,228.57          │   │
│  │  └── Grossed Up:                                     $7,428.57          │   │
│  │                                                                          │   │
│  │  TOTAL ASSESSABLE INCOME                           $127,658.57          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  [📤 Export for ITR]  [🔗 Send to Xero]  [📊 Compare to Last Year]            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Deductions Tab:**
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  DEDUCTIONS - FY 2025-26                                    [Export] [Sync]    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  📊 DEDUCTIONS BY CATEGORY                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  D1: Work-Related Car Expenses                       $3,200.00          │   │
│  │  D2: Work-Related Travel                             $1,500.00          │   │
│  │  D3: Work-Related Clothing                             $350.00          │   │
│  │  D4: Work-Related Self-Education                     $2,100.00          │   │
│  │  D5: Other Work-Related Expenses                     $1,800.00          │   │
│  │                                                                          │   │
│  │  Rental Property Deductions (123 Main St)                               │   │
│  │  ├── Interest on Loan                               $12,000.00          │   │
│  │  ├── Council Rates                                   $1,800.00          │   │
│  │  ├── Property Management                             $1,920.00          │   │
│  │  ├── Repairs & Maintenance                             $850.00          │   │
│  │  ├── Depreciation                                    $4,200.00          │   │
│  │  └── Subtotal:                                      $20,770.00          │   │
│  │                                                                          │   │
│  │  TOTAL DEDUCTIONS                                   $29,720.00          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ⚠️ 3 items need receipts    [View Items Missing Documentation]               │
│                                                                                 │
│  [📤 Export for ITR]  [📋 Substantiation Checklist]                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 5.4.5 Integration Hub (Accounting Software)

Central place to manage all integrations:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  INTEGRATIONS                                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  🔵 XERO                                              ✅ CONNECTED       │  │
│  │                                                                          │  │
│  │  Connected to: Smith & Associates Pty Ltd                               │  │
│  │  Last Sync: 2 hours ago • 1,234 records synced                          │  │
│  │                                                                          │  │
│  │  [⚡ Sync Now]  [⚙️ Settings]  [📊 View Logs]  [❌ Disconnect]          │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  🟣 MYOB                                              ⚪ NOT CONNECTED   │  │
│  │                                                                          │  │
│  │  Connect your MYOB account to sync client data.                         │  │
│  │                                                                          │  │
│  │  [🔗 Connect MYOB]                                                       │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  🟢 QUICKBOOKS                                        ⚪ NOT CONNECTED   │  │
│  │                                                                          │  │
│  │  Connect your QuickBooks Online account.                                │  │
│  │                                                                          │  │
│  │  [🔗 Connect QuickBooks]                                                 │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  📋 SYNC SETTINGS                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  Auto-sync frequency:     [Daily ▼]                                     │  │
│  │  Sync direction:          [Monitrax → Xero (Export Only) ▼]            │  │
│  │  Default mapping:         [Use standard chart of accounts ▼]            │  │
│  │  Notify on sync errors:   [✓] Email  [✓] In-app                        │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 5.4.6 Bulk Operations (Practice Management Essential)

Accountants need to work with multiple clients at once:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  BULK ACTIONS                                              12 clients selected │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  What would you like to do?                                             │   │
│  │                                                                          │   │
│  │  📤 EXPORT                                                              │   │
│  │     [Export Tax Summaries (PDF)]                                        │   │
│  │     [Export All Data (Excel)]                                           │   │
│  │     [Export for Xero Import]                                            │   │
│  │                                                                          │   │
│  │  🔗 SYNC                                                                │   │
│  │     [Sync All to Xero]                                                  │   │
│  │     [Refresh Data from Bank Feeds]                                      │   │
│  │                                                                          │   │
│  │  👤 ASSIGN                                                              │   │
│  │     [Assign to Team Member...]                                          │   │
│  │     [Add Tag...]                                                        │   │
│  │                                                                          │   │
│  │  📧 COMMUNICATE                                                         │   │
│  │     [Send Reminder Email]                                               │   │
│  │     [Request Missing Documents]                                         │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  [Cancel]                                                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 5.4.7 Financial Year Navigation

Always show FY context (critical for accountants):

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  📅 FINANCIAL YEAR                                                       │   │
│  │                                                                          │   │
│  │  [◀ FY 2024-25]   FY 2025-26 (Current)   [FY 2026-27 ▶]                │   │
│  │                                                                          │   │
│  │  Jul 1, 2025 - Jun 30, 2026 • 243 days remaining                        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  Quick Jump: [Q1] [Q2] [Q3] [Q4] [YTD] [Full Year]                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 5.4.8 Lodgement Tracking Dashboard

Track BAS, ITR, FBT obligations:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  LODGEMENT TRACKER                                          FY 2025-26         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                          │   │
│  │  📊 OVERVIEW                                                            │   │
│  │                                                                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │   │
│  │  │   BAS    │  │   ITR    │  │   FBT    │  │  PAYG    │                │   │
│  │  │          │  │          │  │          │  │          │                │   │
│  │  │  12/50   │  │  45/50   │  │  48/50   │  │  50/50   │                │   │
│  │  │  Due     │  │  Lodged  │  │  Lodged  │  │  Done    │                │   │
│  │  │          │  │          │  │          │  │          │                │   │
│  │  │  ⚠️      │  │  ✅      │  │  ✅      │  │  ✅      │                │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ UPCOMING DEADLINES                                                  │   │
│  │                                                                          │   │
│  │  BAS Q3 (Jan-Mar 2026)              Due: Apr 28, 2026    [12 clients]  │   │
│  │  BAS Q4 (Apr-Jun 2026)              Due: Jul 28, 2026    [50 clients]  │   │
│  │  ITR 2025-26 (Individuals)          Due: Oct 31, 2026    [45 clients]  │   │
│  │  ITR 2025-26 (Companies)            Due: Feb 28, 2027    [5 clients]   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  [📋 View All Obligations]  [📧 Send Bulk Reminders]  [📤 Export Calendar]    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 5.4.9 One-Click Xero Actions

Easy integration with Xero (primary accounting tool):

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  SEND TO XERO                                              Client: John Smith  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  What data would you like to send?                                             │
│                                                                                 │
│  ☑ Income Transactions (142 items)                         $125,430.00        │
│  ☑ Expense Transactions (89 items)                          $23,850.00        │
│  ☐ Bank Transactions (already in Xero)                            N/A         │
│  ☑ Invoices (12 items)                                      $18,500.00        │
│  ☑ Bills (23 items)                                          $8,200.00        │
│  ☐ Documents/Attachments (34 files)                         Optional          │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  Mapping to Xero Chart of Accounts:                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Monitrax Category          →    Xero Account                           │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │  Rental Income              →    4-1100 Rental Revenue                  │   │
│  │  Interest Income            →    4-1200 Interest Income                 │   │
│  │  Property Expenses          →    6-2100 Property Costs                  │   │
│  │  Work Deductions            →    6-3100 Staff Expenses                  │   │
│  │                                                                          │   │
│  │  [⚙️ Edit Mappings]                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  ⓘ Data will be exported to Xero. Monitrax remains the source of truth.       │
│    Changes in Xero will not affect Monitrax data.                              │
│                                                                                 │
│  [Cancel]                                          [Preview] [🚀 Send to Xero] │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 5.4.10 Reports for Accountants

Pre-built reports that accountants need:

| Report | Description | Export Formats |
|--------|-------------|----------------|
| **Tax Summary** | Complete income/deduction summary for ITR | PDF, Excel |
| **Rental Schedule** | Property income & expenses for Schedule E | PDF, Excel |
| **Capital Gains** | CGT events and calculations | PDF, Excel |
| **Depreciation Schedule** | Asset depreciation for tax | PDF, Excel |
| **BAS Worksheet** | GST calculations for BAS | PDF, Excel |
| **Dividend Statement** | Dividend income with franking | PDF, Excel |
| **Workpaper Pack** | Complete client file for review | PDF |
| **Client Activity Log** | All data changes (audit trail) | PDF, Excel |

#### 5.4.11 Mobile-Friendly Portal

Accountants often work remotely or at client sites:

- Responsive design for tablets/phones
- Quick client lookup
- View-only access on mobile (editing on desktop)
- Push notifications for urgent items
- Offline access to recent client summaries

#### 5.4.12 Keyboard Shortcuts (Power Users)

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Quick search (clients, actions) |
| `Cmd/Ctrl + N` | New client |
| `Cmd/Ctrl + E` | Export current view |
| `Cmd/Ctrl + S` | Sync to Xero |
| `Cmd/Ctrl + /` | Show all shortcuts |
| `G then C` | Go to Clients |
| `G then D` | Go to Dashboard |
| `G then I` | Go to Integrations |

---

## 6. Security & Compliance

### 6.1 Access Control

| Action | OWNER | ADMIN | MEMBER | CLIENT |
|--------|-------|-------|--------|--------|
| View org settings | Yes | Yes | No | No |
| Edit org settings | Yes | No | No | No |
| Manage billing | Yes | No | No | No |
| Invite team | Yes | Yes | No | No |
| Remove team | Yes | Yes* | No | No |
| Invite clients | Yes | Yes | Yes | No |
| View client data | Yes | Yes | Yes** | No |
| Export client data | Yes | Yes | No | No |
| Add notes/tasks | Yes | Yes | Yes | No |
| View access logs | Yes | Yes | No | No |
| Delete organization | Yes | No | No | No |

*Cannot remove OWNER
**Read-only access

### 6.2 Data Privacy Requirements

1. **Explicit Consent**: Clients must actively consent to data sharing
2. **Granular Control**: Clients choose which data types to share
3. **Right to Revoke**: Clients can revoke consent at any time
4. **Access Logging**: All data access is logged for compliance
5. **Data Minimization**: Only share data within consented scope
6. **Audit Trail**: Immutable log of all consent changes

### 6.3 Compliance Considerations

| Regulation | Requirement | Implementation |
|------------|-------------|----------------|
| **Australian Privacy Act** | Consent for data collection | Explicit consent flow |
| **Tax Agent Services Regulations** | Client data protection | Access logging, encryption |
| **GDPR** (if applicable) | Right to access, erasure | Consent management, export |
| **SOC 2** | Security controls | Audit logging, access control |

---

## 7. Data Integrity Architecture

> **CRITICAL PRINCIPLE**: Monitrax is the **Single Source of Truth**. Data is NEVER duplicated—only referenced or exported.

### 7.1 Single Source of Truth Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA OWNERSHIP MODEL                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌─────────────────────┐                                  │
│                    │     MONITRAX        │                                  │
│                    │  (Source of Truth)  │                                  │
│                    │                     │                                  │
│                    │  • All client data  │                                  │
│                    │  • Transactions     │                                  │
│                    │  • Properties       │                                  │
│                    │  • Documents        │                                  │
│                    └──────────┬──────────┘                                  │
│                               │                                             │
│              ┌────────────────┼────────────────┐                            │
│              │                │                │                            │
│              ▼                ▼                ▼                            │
│    ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐                 │
│    │      XERO       │ │    MYOB     │ │   QuickBooks    │                 │
│    │   (Consumer)    │ │  (Consumer) │ │   (Consumer)    │                 │
│    │                 │ │             │ │                 │                 │
│    │  Receives data  │ │ Receives    │ │  Receives data  │                 │
│    │  from Monitrax  │ │ data from   │ │  from Monitrax  │                 │
│    │                 │ │ Monitrax    │ │                 │                 │
│    └─────────────────┘ └─────────────┘ └─────────────────┘                 │
│                                                                             │
│    Legend:                                                                  │
│    ────► = One-way data flow (export only)                                 │
│    Data NEVER flows back to overwrite Monitrax                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Data Flow Rules

| Rule | Description | Enforcement |
|------|-------------|-------------|
| **R1: No Duplication** | Data exists ONLY in Monitrax database | External systems receive copies/references, not ownership |
| **R2: Export-Only by Default** | Sync direction is OUTBOUND only | Monitrax → External, never External → Monitrax |
| **R3: Reference Mapping** | Track what was sent where | `IntegrationEntityMapping` links Monitrax ID ↔ External ID |
| **R4: No External Edits** | Changes made in Xero don't affect Monitrax | Users must edit in Monitrax, then re-sync |
| **R5: Audit Everything** | Every sync operation is logged | `IntegrationSyncLog` with full details |

### 7.3 Data Categories & Ownership

| Data Category | Owner | Can Export To | Import From? |
|---------------|-------|---------------|--------------|
| **Client Profile** | Monitrax | All integrations | NO |
| **Properties** | Monitrax | All integrations | NO |
| **Loans** | Monitrax | All integrations | NO |
| **Bank Accounts** | Monitrax | Xero (as contacts) | NO |
| **Transactions** | Monitrax | Xero (as invoices/bills) | NO* |
| **Income** | Monitrax | Xero (as invoices) | NO |
| **Expenses** | Monitrax | Xero (as bills) | NO |
| **Documents** | Monitrax | Xero (as attachments) | NO |
| **Categories** | Monitrax | Mapped to Xero accounts | NO |
| **Tax Settings** | Monitrax | Mapped to Xero tax codes | NO |

*Note: Bank feed imports may be allowed as a **separate data source**, but they create NEW records in Monitrax rather than modifying existing ones.

### 7.4 Sync Behavior Specification

#### 7.4.1 Export Flow (Monitrax → External)

```typescript
// Pseudocode for export operation
async function exportToXero(transaction: Transaction, integration: AccountingIntegration) {
  // 1. Check if already exported
  const existingMapping = await findEntityMapping(integration.id, transaction.id);

  if (existingMapping) {
    // 2a. Update existing record in Xero (if changed)
    const currentHash = hashTransactionData(transaction);
    if (currentHash !== existingMapping.syncHash) {
      await xeroClient.updateInvoice(existingMapping.externalEntityId, transaction);
      await updateSyncHash(existingMapping.id, currentHash);
      logSyncOperation('UPDATE', transaction.id, existingMapping.externalEntityId);
    } else {
      logSyncOperation('SKIP_UNCHANGED', transaction.id);
    }
  } else {
    // 2b. Create new record in Xero
    const xeroInvoice = await xeroClient.createInvoice(transaction);
    await createEntityMapping({
      integrationId: integration.id,
      monitraxEntityType: 'Transaction',
      monitraxEntityId: transaction.id,
      externalEntityType: 'Invoice',
      externalEntityId: xeroInvoice.invoiceId,
      syncHash: hashTransactionData(transaction),
    });
    logSyncOperation('CREATE', transaction.id, xeroInvoice.invoiceId);
  }

  // 3. Mark transaction as synced
  await markAsSynced(transaction.id, integration.provider);
}
```

#### 7.4.2 What Happens If Data Changes in External System?

| Scenario | Monitrax Behavior |
|----------|-------------------|
| User edits invoice in Xero | **Ignored** - Monitrax remains unchanged |
| User deletes invoice in Xero | **Logged as warning** - Mapping marked as "external_deleted" |
| Next sync from Monitrax | **Re-creates** the record in Xero (or updates if still exists) |
| User wants Xero changes | Must manually update in Monitrax, then re-sync |

#### 7.4.3 Conflict Prevention

```
┌─────────────────────────────────────────────────────────────┐
│                  CONFLICT PREVENTION                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  MONITRAX (Source of Truth)                                │
│  ┌─────────────────────────────────────────┐               │
│  │  Transaction #1234                       │               │
│  │  Amount: $500                            │               │
│  │  Last Modified: 2026-01-19 10:00:00     │               │
│  │  Sync Status: SYNCED                     │               │
│  │  Synced To: [Xero: INV-001]             │               │
│  └─────────────────────────────────────────┘               │
│                     │                                       │
│                     │ Export (one-way)                      │
│                     ▼                                       │
│  XERO (Consumer)                                           │
│  ┌─────────────────────────────────────────┐               │
│  │  Invoice INV-001                         │               │
│  │  Amount: $500                            │               │
│  │  Source: Monitrax                        │               │
│  │  ⚠️ READ-ONLY RECOMMENDATION            │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
│  If user edits INV-001 in Xero to $600:                    │
│  • Monitrax #1234 remains $500                             │
│  • Next sync will reset Xero back to $500                  │
│  • Or: Sync detects mismatch, logs warning                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.5 Data Validation Rules

#### 7.5.1 Pre-Sync Validation

| Check | Description | Action on Failure |
|-------|-------------|-------------------|
| **Data Completeness** | All required fields present | Skip record, log error |
| **Data Format** | Dates, amounts, codes valid | Transform or skip |
| **Business Rules** | Amount > 0, valid category | Skip record, log error |
| **Duplicate Check** | Not already synced (same hash) | Skip, mark as duplicate |
| **Consent Check** | Client has granted access | Skip all client data |

#### 7.5.2 Post-Sync Verification

```typescript
// After sync, verify data integrity
async function verifySyncIntegrity(syncLog: IntegrationSyncLog) {
  const results = {
    itemsVerified: 0,
    mismatches: [],
  };

  for (const mapping of await getMappingsForSync(syncLog.id)) {
    // Fetch from both systems
    const monitraxData = await getMonitoraxEntity(mapping.monitraxEntityId);
    const externalData = await fetchExternalEntity(mapping.externalEntityId);

    // Compare critical fields
    if (monitraxData.amount !== externalData.amount) {
      results.mismatches.push({
        entityId: mapping.monitraxEntityId,
        field: 'amount',
        expected: monitraxData.amount,
        actual: externalData.amount,
      });
    }

    results.itemsVerified++;
  }

  if (results.mismatches.length > 0) {
    await alertAdminOfMismatches(results.mismatches);
  }

  return results;
}
```

### 7.6 Data Consistency Guarantees

| Guarantee | Implementation |
|-----------|----------------|
| **Atomicity** | Sync operations are transactional - all or nothing |
| **Consistency** | Pre-validation ensures only valid data is synced |
| **Isolation** | Concurrent syncs to same provider are queued |
| **Durability** | All sync operations logged before execution |

#### 7.6.1 Transaction Safety

```typescript
// All sync operations wrapped in transactions
async function syncClientToXero(clientId: string, integrationId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Lock the client record (prevent concurrent edits)
    const client = await tx.organizationClient.findUnique({
      where: { id: clientId },
      include: { user: true },
    });

    // 2. Create sync log entry FIRST
    const syncLog = await tx.integrationSyncLog.create({
      data: {
        integrationId,
        organizationClientId: clientId,
        syncType: 'FULL',
        status: 'IN_PROGRESS',
        triggeredBy: 'MANUAL',
      },
    });

    try {
      // 3. Perform sync
      const results = await performXeroSync(client, integrationId);

      // 4. Update sync log with results
      await tx.integrationSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'COMPLETED',
          itemsProcessed: results.processed,
          itemsCreated: results.created,
          completedAt: new Date(),
        },
      });

      return results;
    } catch (error) {
      // 5. Log failure (sync log persists even on failure)
      await tx.integrationSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'FAILED',
          errorSummary: error.message,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  });
}
```

### 7.7 Optional: Limited Inbound Data

> **By default, inbound sync is DISABLED.** However, some organizations may want to import reference data.

#### 7.7.1 Allowed Inbound Data (Optional Feature)

| Data Type | Can Import? | Behavior |
|-----------|-------------|----------|
| Chart of Accounts | YES (reference only) | Creates mapping options, doesn't modify Monitrax categories |
| Tax Codes | YES (reference only) | Creates mapping options, doesn't modify Monitrax tax settings |
| Contacts | NO | - |
| Invoices/Bills | NO | - |
| Bank Transactions | SPECIAL* | Creates NEW records if enabled, never overwrites |

*Bank feed import: If enabled, imports as new transactions with `source: 'XERO_BANK_FEED'` flag. User must manually reconcile with existing Monitrax data.

#### 7.7.2 Inbound Data Handling

```typescript
// Inbound data NEVER overwrites - only creates new or maps references
async function importXeroChartOfAccounts(integrationId: string) {
  const xeroAccounts = await xeroClient.getChartOfAccounts();

  // Store as REFERENCE DATA for mapping UI - not as Monitrax categories
  await prisma.accountingIntegration.update({
    where: { id: integrationId },
    data: {
      providerMetadata: {
        ...existingMetadata,
        xeroChartOfAccounts: xeroAccounts.map(acc => ({
          code: acc.code,
          name: acc.name,
          type: acc.type,
          // Used for dropdown in mapping UI
        })),
        lastChartOfAccountsSync: new Date(),
      },
    },
  });

  // No Monitrax categories are created or modified
}
```

### 7.8 Data Integrity Monitoring

#### 7.8.1 Automated Health Checks

| Check | Frequency | Alert Threshold |
|-------|-----------|-----------------|
| Sync success rate | Every sync | < 95% success |
| Data hash mismatches | Daily | Any mismatch |
| Orphaned mappings | Weekly | > 10 orphans |
| Stale syncs | Daily | Last sync > 7 days ago |
| Token expiry | Hourly | Expiry within 24h |

#### 7.8.2 Integrity Dashboard (for Organization Portal)

```
┌─────────────────────────────────────────────────────────────┐
│  INTEGRATION HEALTH                           Xero: ✅ OK   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Last Sync: 2 hours ago                                     │
│  Records Synced: 1,234                                      │
│  Success Rate: 99.2%                                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Data Integrity Status                              │   │
│  │  ✅ All Monitrax records are source of truth       │   │
│  │  ✅ No duplicate records detected                   │   │
│  │  ✅ All mappings valid                              │   │
│  │  ⚠️ 3 records modified in Xero (will be overwritten)│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [View Sync History]  [Run Manual Sync]  [View Conflicts]  │
└─────────────────────────────────────────────────────────────┘
```

### 7.9 Summary: Data Integrity Principles

| # | Principle | Implementation |
|---|-----------|----------------|
| 1 | **Monitrax = Single Source of Truth** | All data owned by Monitrax |
| 2 | **Export-Only by Default** | One-way sync to external systems |
| 3 | **No Duplication** | Entity mappings link IDs, don't copy data |
| 4 | **External Edits Ignored** | Changes in Xero don't affect Monitrax |
| 5 | **Hash-Based Change Detection** | Only sync if data actually changed |
| 6 | **Full Audit Trail** | Every sync operation logged |
| 7 | **Transactional Integrity** | Atomic operations, rollback on failure |
| 8 | **Verification Checks** | Post-sync validation of critical fields |
| 9 | **Conflict Alerting** | Warn when external data differs |
| 10 | **Reference-Only Imports** | Inbound data for mapping, not overwriting |

---

## 8. Isolation & Non-Breaking Implementation

> **CRITICAL REQUIREMENT**: The Enterprise Portal MUST NOT interfere with, break, or change ANY existing functionality in the main Monitrax application. All changes require explicit user approval.

### 8.1 Core Isolation Principles

| # | Principle | Enforcement |
|---|-----------|-------------|
| 1 | **Additive Only** | Only ADD new code/tables, never modify existing |
| 2 | **Separate Routes** | All portal routes under `/portal/*` and `/api/portal/*` |
| 3 | **Separate Components** | New components in `/components/portal/*` |
| 4 | **Feature Flags** | All features behind flags, disabled by default |
| 5 | **No Existing API Changes** | Current APIs unchanged, new endpoints only |
| 6 | **No Existing UI Changes** | Main dashboard untouched except context switcher |
| 7 | **Approval Required** | ANY main app change requires explicit owner approval |

### 8.2 Code Organization

```
/home/user/monitrax/
├── app/
│   ├── dashboard/           # ❌ DO NOT MODIFY (existing)
│   ├── api/                 # ❌ DO NOT MODIFY existing routes
│   │   ├── auth/            # ❌ DO NOT MODIFY
│   │   ├── accounts/        # ❌ DO NOT MODIFY
│   │   ├── properties/      # ❌ DO NOT MODIFY
│   │   └── portal/          # ✅ NEW - All portal APIs here
│   │       ├── organizations/
│   │       ├── clients/
│   │       └── integrations/
│   ├── portal/              # ✅ NEW - All portal UI here
│   │   └── [orgSlug]/
│   │       ├── dashboard/
│   │       ├── clients/
│   │       └── settings/
│   └── login/               # ⚠️ MINIMAL CHANGE (add mode selector)
│
├── components/
│   ├── ui/                  # ❌ DO NOT MODIFY (existing)
│   ├── dashboard/           # ❌ DO NOT MODIFY (existing)
│   └── portal/              # ✅ NEW - All portal components here
│       ├── PortalLayout.tsx
│       ├── ClientList.tsx
│       └── ...
│
├── lib/
│   ├── auth/                # ⚠️ EXTEND ONLY (add org context)
│   │   ├── index.ts         # ❌ DO NOT MODIFY
│   │   ├── permissions.ts   # ⚠️ ADD new permissions, don't change existing
│   │   └── portalContext.ts # ✅ NEW - Portal-specific auth
│   ├── db/
│   │   ├── tenant.ts        # ❌ DO NOT MODIFY
│   │   └── portalTenant.ts  # ✅ NEW - Portal data access
│   └── portal/              # ✅ NEW - All portal business logic
│       ├── organizations.ts
│       ├── clients.ts
│       └── integrations.ts
│
└── prisma/
    └── schema.prisma        # ⚠️ ADD tables only, don't modify existing
```

### 8.3 Database Changes (Additive Only)

#### 8.3.1 Rules for Schema Changes

| Rule | Description |
|------|-------------|
| **ADD new models** | ✅ OrganizationClient, ClientNote, etc. |
| **ADD new enums** | ✅ OrganizationType, ClientStatus, etc. |
| **ADD new fields to Organization** | ⚠️ Only additive, all nullable or with defaults |
| **ADD new fields to User** | ⚠️ Only additive (organizationClients relation) |
| **MODIFY existing fields** | ❌ NEVER - requires approval |
| **DELETE fields/models** | ❌ NEVER - requires approval |
| **CHANGE field types** | ❌ NEVER - requires approval |
| **CHANGE existing relations** | ❌ NEVER - requires approval |

#### 8.3.2 Safe Schema Extension Pattern

```prisma
// ✅ SAFE: Adding new optional relation to User
model User {
  // ... all existing fields unchanged ...

  // Phase 32: Enterprise Portal (NEW - optional relation)
  organizationClients   OrganizationClient[]  // New, doesn't break anything
}

// ✅ SAFE: Adding new fields to Organization (all with defaults)
model Organization {
  // ... all existing fields unchanged ...

  // Phase 32 additions (all have defaults, won't break existing)
  type                  OrganizationType?    @default(OTHER)
  logoUrl               String?
  // ... etc
}

// ❌ UNSAFE: Would require approval
model User {
  email     String    // ❌ Changing from String? to String - BREAKS!
  role      UserRole  @default(VIEWER)  // ❌ Changing default - BREAKS!
}
```

### 8.4 API Isolation

#### 8.4.1 New Routes Only

```
EXISTING APIs (DO NOT TOUCH):
  /api/auth/*           - Leave unchanged
  /api/accounts/*       - Leave unchanged
  /api/properties/*     - Leave unchanged
  /api/loans/*          - Leave unchanged
  /api/income/*         - Leave unchanged
  /api/expenses/*       - Leave unchanged
  /api/transactions/*   - Leave unchanged
  /api/settings/*       - Leave unchanged (mostly)

NEW APIs (Portal-specific):
  /api/portal/organizations/*      - NEW
  /api/portal/clients/*            - NEW
  /api/portal/integrations/*       - NEW
  /api/v1/org/*                    - NEW (external API)

MINIMAL ADDITIONS (requires approval):
  /api/settings/organizations      - NEW (user's org consent)
  /api/auth/me                     - EXTEND to include org memberships
```

#### 8.4.2 Response Format Compatibility

```typescript
// Existing API response format - DO NOT CHANGE
{
  "success": true,
  "data": { ... },
  "meta": { ... }
}

// Portal APIs use SAME format for consistency
{
  "success": true,
  "data": { ... },
  "meta": { ... }
}
```

### 8.5 Feature Flags

All Enterprise Portal features are behind feature flags, disabled by default.

```typescript
// lib/features/flags.ts (NEW FILE)
export const FEATURE_FLAGS = {
  // Phase 32: Enterprise Portal
  ENTERPRISE_PORTAL_ENABLED: false,      // Master switch
  PORTAL_ORG_MANAGEMENT: false,          // Organization CRUD
  PORTAL_CLIENT_MANAGEMENT: false,       // Client invitations
  PORTAL_DATA_ACCESS: false,             // View client data
  PORTAL_INTEGRATIONS: false,            // Xero/MYOB sync
  PORTAL_WHITE_LABEL: false,             // Custom branding
  PORTAL_SSO: false,                     // SAML/OIDC
  PORTAL_API_ACCESS: false,              // External API

  // Login page mode selector (minimal main app change)
  LOGIN_MODE_SELECTOR: false,            // Show Personal/Organization toggle
};

// Usage in code
import { FEATURE_FLAGS } from '@/lib/features/flags';

if (FEATURE_FLAGS.ENTERPRISE_PORTAL_ENABLED) {
  // Portal feature code
}
```

### 8.6 Main App Changes Requiring Approval

The following changes touch the main application and require **explicit owner approval** before implementation:

| Change | Location | Reason | Status |
|--------|----------|--------|--------|
| Login mode selector | `/app/login/page.tsx` | Add Personal/Org toggle | ⏳ PENDING APPROVAL |
| Context switcher | `/components/layout/Sidebar.tsx` | Add org dropdown | ⏳ PENDING APPROVAL |
| Org memberships in `/api/auth/me` | `/app/api/auth/me/route.ts` | Return org list | ⏳ PENDING APPROVAL |
| User settings: Organizations | `/app/dashboard/settings/` | Add consent management | ⏳ PENDING APPROVAL |
| User model relation | `/prisma/schema.prisma` | Add organizationClients | ⏳ PENDING APPROVAL |
| Organization model extension | `/prisma/schema.prisma` | Add portal fields | ⏳ PENDING APPROVAL |
| New permissions | `/lib/auth/permissions.ts` | Add portal.* permissions | ⏳ PENDING APPROVAL |

### 8.7 Testing & Rollback Strategy

#### 8.7.1 Testing Requirements

| Test Type | Requirement |
|-----------|-------------|
| **Existing Tests** | ALL existing tests must pass, no modifications |
| **Regression Tests** | Run full test suite before any deployment |
| **Portal Tests** | New tests for portal features only |
| **Integration Tests** | Test portal doesn't affect main app |

#### 8.7.2 Rollback Plan

If any issue is detected:

1. **Feature Flags**: Disable all portal flags instantly
2. **Database**: New tables can be ignored (not used by main app)
3. **Code**: Portal routes/components are isolated
4. **Emergency**: Revert to previous commit

```bash
# Emergency rollback command
git revert HEAD --no-commit  # Revert portal changes
# Or simply disable feature flags in production
```

### 8.8 Approval Checklist

Before implementing Phase 32, the following must be approved:

- [ ] Schema changes (new tables + minimal User/Organization extensions)
- [ ] Login page modification (mode selector)
- [ ] Sidebar context switcher
- [ ] New permissions in permissions.ts
- [ ] User settings page addition (Organizations section)
- [ ] API endpoint `/api/auth/me` extension

**To proceed with implementation, please approve the above changes.**

---

## 9. Implementation Phases

### Phase 32.1: Foundation (Core Infrastructure)
- [ ] Extend Organization model in Prisma schema
- [ ] Create OrganizationClient model
- [ ] Create OrganizationInvitation model
- [ ] Add organization context to auth system
- [ ] Create portal permission guards
- [ ] Set up portal API route structure

### Phase 32.2: Organization Management
- [ ] Organization creation/edit API
- [ ] Organization settings UI
- [ ] Team invitation flow (API + UI)
- [ ] Team management UI
- [ ] Role assignment

### Phase 32.3: Client Management
- [ ] Client invitation API
- [ ] Client invitation email templates
- [ ] Client list API with search/filter
- [ ] Client list UI
- [ ] Client status management

### Phase 32.4: Consent System
- [ ] Consent model and API
- [ ] Client-side consent UI (in Settings)
- [ ] Granular scope selection
- [ ] Consent audit logging
- [ ] Consent expiry handling

### Phase 32.5: Client Data Access
- [ ] Portal dashboard API
- [ ] Client overview page (read-only snapshot)
- [ ] Per-module data viewing (properties, loans, etc.)
- [ ] Respect consent scopes in data retrieval
- [ ] Client data caching strategy

### Phase 32.6: Advisor Tools
- [ ] ClientNote model and API
- [ ] ClientTask model and API
- [ ] Notes UI in client detail view
- [ ] Tasks UI with due date tracking
- [ ] Task notifications

### Phase 32.7: Export & Reporting
- [ ] Client data export (PDF, CSV, Excel)
- [ ] Tax summary report generation
- [ ] Bulk client export
- [ ] Compliance/access log report

### Phase 32.8: Audit & Compliance
- [ ] ClientAccessLog model
- [ ] Log all data access automatically
- [ ] Access log viewer UI
- [ ] Compliance report generation
- [ ] Data retention policies

### Phase 32.9: Billing Integration
- [ ] Organization subscription management
- [ ] Plan limits enforcement (max clients)
- [ ] Upgrade/downgrade flows
- [ ] Usage tracking

### Phase 32.10: Polish & Testing
- [ ] End-to-end testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation
- [ ] Beta testing with pilot organizations

### Phase 32.11: White-Labeling (Enterprise Feature)
- [ ] Organization branding settings (logo, colors, fonts)
- [ ] Custom email templates with org branding
- [ ] Branded client onboarding experience
- [ ] Custom domain support (optional)
- [ ] Branded PDF exports with org logo
- [ ] Theme customization UI for org admins

### Phase 32.12: SSO/SAML Integration (Enterprise Feature)
- [ ] SAML 2.0 identity provider support
- [ ] OIDC (OpenID Connect) support
- [ ] Organization SSO configuration UI
- [ ] Just-in-time (JIT) user provisioning
- [ ] SCIM user provisioning (optional)
- [ ] SSO enforcement settings per organization
- [ ] Integration testing with major IdPs (Okta, Azure AD, Google Workspace)

### Phase 32.13: API Access (CRITICAL)
- [ ] Organization API key management
- [ ] API key generation and rotation
- [ ] Scoped API permissions (read-only by default)
- [ ] Rate limiting per organization/key
- [ ] API usage tracking and analytics
- [ ] Developer documentation portal
- [ ] Webhook support for client events
- [ ] API versioning strategy

### Phase 32.14: Accounting Integrations (CRITICAL)
> **Priority**: HIGH - Primary feature for accountants
> **Primary Provider**: Xero (Australian market leader)

#### 32.14.1 Integration Framework
- [ ] Create AccountingIntegration, IntegrationSyncLog, IntegrationEntityMapping models
- [ ] Build provider-agnostic integration service
- [ ] OAuth 2.0 token management (storage, refresh, expiry handling)
- [ ] Integration status monitoring and error handling
- [ ] Integration settings UI (connect, configure, disconnect)

#### 32.14.2 Xero Integration (Primary)
- [ ] Register Monitrax as Xero App Partner
- [ ] Implement Xero OAuth 2.0 flow
- [ ] Xero-specific API client wrapper
- [ ] Chart of accounts sync
- [ ] Transaction/invoice export to Xero
- [ ] Bank feed integration
- [ ] Xero webhooks for real-time updates
- [ ] Category → Account code mapping UI
- [ ] Tax code mapping (GST, BAS codes)
- [ ] "Send to Xero" button on transactions
- [ ] Xero Practice Manager integration (for multi-client accounting firms)

#### 32.14.3 Data Sync Engine
- [ ] Configurable sync direction (outbound, inbound, bi-directional)
- [ ] Scheduled sync (hourly, daily, weekly)
- [ ] Manual sync trigger
- [ ] Incremental sync (only changed records)
- [ ] Full sync option
- [ ] Conflict detection and resolution
- [ ] Sync history and audit log
- [ ] Failed sync retry logic

#### 32.14.4 Entity Mapping System
- [ ] Track Monitrax ↔ External entity relationships
- [ ] Change detection (hash-based)
- [ ] Prevent duplicate syncs
- [ ] Entity unlinking option

### Phase 32.15: Additional Accounting Providers
> Extensible to support other providers using the same framework

- [ ] **MYOB** - Australia/NZ market
  - [ ] MYOB AccountRight API integration
  - [ ] MYOB Essentials API integration
- [ ] **QuickBooks Online** - Global market
  - [ ] Intuit OAuth 2.0 flow
  - [ ] QBO API integration
- [ ] **Sage Business Cloud** - UK/Europe market
- [ ] **FreshBooks** - Small business focus
- [ ] **Wave** - Free accounting software
- [ ] **Generic Export** - CSV, OFX, QIF formats for unsupported providers

---

## 10. Migration Strategy

### 8.1 Database Migration

1. Add new tables without modifying existing data
2. Existing users remain unaffected (personal accounts)
3. Organizations can be created and clients invited independently
4. No forced migration required

### 8.2 Existing Organization Data

The current `Organization` and `OrganizationMember` tables will be extended with new fields. Existing rows will receive default values.

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| Organization signups | Track monthly |
| Client activation rate | >70% invited clients activate |
| Data export usage | Track frequency |
| Consent grant rate | >90% of invited clients grant consent |
| Portal daily active users | Track engagement |
| Support tickets | <5% of org users |

---

## 12. Open Questions

### Resolved

| Question | Resolution |
|----------|------------|
| **White-Labeling** | YES - Included in Phase 32.11 |
| **SSO/SAML** | YES - Included in Phase 32.12 |
| **API Access** | YES - Portal-first, API as premium feature in Phase 32.13 |
| **Multi-Organization** | YES - Clients can belong to multiple organizations |

### Pending (To Be Decided)

1. **Pricing Model**: What are the specific tier limits and pricing? *(TBD)*
2. **Data Retention**: What is the retention period for access logs?
3. **International**: Support for non-Australian organizations?
4. **Custom Domain**: Should white-labeling include custom domain support (e.g., portal.accountingfirm.com)?

---

## 13. Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Phase 10: Auth & Security | Complete | Leverages existing RBAC |
| Phase 19: Document Management | Complete | For document sharing |
| Phase 20: Tax Intelligence | Complete | For tax position viewing |
| Stripe Integration | Planned | For billing |
| Email Service | Existing | For invitations |

---

## 14. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| **Organization** | Business entity (accounting firm, etc.) that purchases license |
| **Portal** | Web interface for organization admins to manage clients |
| **Client** | End user of Monitrax who has linked to an organization |
| **Consent** | Client's explicit permission to share data with organization |
| **Access Scope** | Specific data types client has consented to share |

### B. Related Documents

- [01_ARCHITECTURE_OVERVIEW.md](./01_ARCHITECTURE_OVERVIEW.md)
- [03_DATA_MODEL.md](./03_DATA_MODEL.md)
- [07_API_STANDARDS.md](./07_API_STANDARDS.md)
- [PHASE_10_AUTH_SECURITY.md](./PHASE_10_AUTH_SECURITY.md)

---

### C. Multi-Organization Client Support

A single user (client) can be linked to multiple organizations. For example:
- John Doe uses Monitrax
- He is a client of "ABC Accounting" (his accountant)
- He is also a client of "XYZ Financial Advisors" (his financial planner)
- Each organization has separate consent settings
- John controls what data each organization can see independently

This is supported by the `OrganizationClient` model which creates a many-to-many relationship between Users and Organizations with per-relationship consent.

---

*Document Version: 1.5*
*Last Updated: 2026-01-19*
*Approved for Implementation: 2026-01-19*

---

### Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-19 | Initial blueprint |
| 1.1 | 2026-01-19 | Added White-labeling, SSO, API access phases |
| 1.2 | 2026-01-19 | Added Accounting Integrations, unified login flow |
| 1.3 | 2026-01-19 | Added Data Integrity Architecture (Section 7) |
| 1.4 | 2026-01-19 | Added Isolation & Non-Breaking Implementation (Section 8) |
| 1.5 | 2026-01-19 | Added Accountant & FA User Experience (Section 5.4) |
| 1.6 | 2026-01-19 | Added Deployment Configuration (Section 15) |

---

## 15. Deployment Configuration

### 15.1 Architecture Overview

Monitrax uses a dual-deployment architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐                      ┌─────────────┐              │
│   │   VERCEL    │                      │   RENDER    │              │
│   │  (Frontend) │                      │  (Backend)  │              │
│   │             │                      │             │              │
│   │ • Next.js   │◄────── API ─────────►│ • API       │              │
│   │ • SSR/SSG   │                      │ • Database  │              │
│   │ • Static    │                      │ • Prisma    │              │
│   └─────────────┘                      └─────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 15.2 Environment Variables

**BOTH Vercel AND Render require these environment variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORTAL_ENABLED` | **Yes** | `false` | Master switch for portal access |
| `PORTAL_TEAM_MANAGEMENT` | No | `true` | Enable team management features |
| `PORTAL_INTEGRATIONS` | No | `true` | Enable accounting integrations |
| `PORTAL_NOTES` | No | `true` | Enable client notes |
| `PORTAL_TASKS` | No | `true` | Enable client tasks |
| `PORTAL_API_ACCESS` | No | `false` | Enable API key generation |
| `PORTAL_WHITE_LABELING` | No | `false` | Enable white-labeling (Pro+) |
| `PORTAL_SSO_SAML` | No | `false` | Enable SSO/SAML (Enterprise) |

### 15.3 Vercel Configuration

1. Go to **Vercel Dashboard** → Select your Monitrax project
2. Click **Settings** → **Environment Variables**
3. Add the following:

```bash
# Required
PORTAL_ENABLED=true

# Optional - Enable all features
PORTAL_TEAM_MANAGEMENT=true
PORTAL_INTEGRATIONS=true
PORTAL_NOTES=true
PORTAL_TASKS=true
```

4. Click **Save**
5. Trigger a new deployment (Deployments → Redeploy)

### 15.4 Render Configuration

1. Go to **Render Dashboard** → Select your Monitrax service
2. Click **Environment** tab
3. Add the same environment variables as Vercel:

```bash
# Required
PORTAL_ENABLED=true

# Optional - Enable all features
PORTAL_TEAM_MANAGEMENT=true
PORTAL_INTEGRATIONS=true
PORTAL_NOTES=true
PORTAL_TASKS=true
```

4. Click **Save Changes**
5. Render will automatically redeploy

### 15.5 Database Migration

After setting environment variables, run the database migration to create portal tables:

**Option A: Via Render Build Command**

Update your build command to include migration:
```bash
npx prisma generate && npx prisma db push && npm run build
```

**Option B: Manual Migration**

Connect to your database environment and run:
```bash
npx prisma db push
```

Or with migrations:
```bash
npx prisma migrate deploy
```

### 15.6 Portal URLs

Once enabled, the portal is accessible at:

| URL | Description |
|-----|-------------|
| `/portal` | Portal home (redirects to dashboard or login) |
| `/portal/login` | Portal login page |
| `/portal/dashboard` | Organization dashboard |
| `/portal/clients` | Client management |
| `/portal/team` | Team management |
| `/portal/integrations` | Accounting integrations |
| `/portal/settings` | Organization settings |
| `/portal/consent/[token]` | Client consent flow |

### 15.7 Verification Checklist

After deployment, verify the following:

- [ ] Navigate to `https://your-domain.com/portal/login`
- [ ] "Portal Not Yet Active" warning should be gone
- [ ] "Organization Portal Login" button should be active (not grayed out)
- [ ] API routes return data (not 503 errors)
- [ ] Database tables are created (check `Organization`, `OrganizationMember`, etc.)

### 15.8 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Portal Not Yet Active" message | Set `PORTAL_ENABLED=true` in both Vercel and Render |
| "Organization Portal Login" grayed out | Ensure `PORTAL_ENABLED=true` and redeploy |
| 503 Service Unavailable on `/api/portal/*` | Portal feature flag not enabled |
| Database errors | Run `npx prisma db push` to create tables |
| Type errors on build | Ensure Prisma client is generated: `npx prisma generate` |
