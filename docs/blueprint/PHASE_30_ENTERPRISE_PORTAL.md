# PHASE 30: ENTERPRISE PORTAL - Organization Client Management

> **Status**: PLANNING
> **Author**: Claude AI
> **Created**: 2026-01-19
> **Target Audience**: Accountants, Financial Advisors, Wealth Managers, Bookkeepers

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

  // Branding
  logoUrl               String?
  primaryColor          String?              // Hex color for portal branding

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

---

## 5. UI/UX Design

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
│   │   └── /api                # API key management
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

## 7. Implementation Phases

### Phase 30.1: Foundation (Core Infrastructure)
- [ ] Extend Organization model in Prisma schema
- [ ] Create OrganizationClient model
- [ ] Create OrganizationInvitation model
- [ ] Add organization context to auth system
- [ ] Create portal permission guards
- [ ] Set up portal API route structure

### Phase 30.2: Organization Management
- [ ] Organization creation/edit API
- [ ] Organization settings UI
- [ ] Team invitation flow (API + UI)
- [ ] Team management UI
- [ ] Role assignment

### Phase 30.3: Client Management
- [ ] Client invitation API
- [ ] Client invitation email templates
- [ ] Client list API with search/filter
- [ ] Client list UI
- [ ] Client status management

### Phase 30.4: Consent System
- [ ] Consent model and API
- [ ] Client-side consent UI (in Settings)
- [ ] Granular scope selection
- [ ] Consent audit logging
- [ ] Consent expiry handling

### Phase 30.5: Client Data Access
- [ ] Portal dashboard API
- [ ] Client overview page (read-only snapshot)
- [ ] Per-module data viewing (properties, loans, etc.)
- [ ] Respect consent scopes in data retrieval
- [ ] Client data caching strategy

### Phase 30.6: Advisor Tools
- [ ] ClientNote model and API
- [ ] ClientTask model and API
- [ ] Notes UI in client detail view
- [ ] Tasks UI with due date tracking
- [ ] Task notifications

### Phase 30.7: Export & Reporting
- [ ] Client data export (PDF, CSV, Excel)
- [ ] Tax summary report generation
- [ ] Bulk client export
- [ ] Compliance/access log report

### Phase 30.8: Audit & Compliance
- [ ] ClientAccessLog model
- [ ] Log all data access automatically
- [ ] Access log viewer UI
- [ ] Compliance report generation
- [ ] Data retention policies

### Phase 30.9: Billing Integration
- [ ] Organization subscription management
- [ ] Plan limits enforcement (max clients)
- [ ] Upgrade/downgrade flows
- [ ] Usage tracking

### Phase 30.10: Polish & Testing
- [ ] End-to-end testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation
- [ ] Beta testing with pilot organizations

---

## 8. Migration Strategy

### 8.1 Database Migration

1. Add new tables without modifying existing data
2. Existing users remain unaffected (personal accounts)
3. Organizations can be created and clients invited independently
4. No forced migration required

### 8.2 Existing Organization Data

The current `Organization` and `OrganizationMember` tables will be extended with new fields. Existing rows will receive default values.

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| Organization signups | Track monthly |
| Client activation rate | >70% invited clients activate |
| Data export usage | Track frequency |
| Consent grant rate | >90% of invited clients grant consent |
| Portal daily active users | Track engagement |
| Support tickets | <5% of org users |

---

## 10. Open Questions

1. **Pricing Model**: What are the specific tier limits and pricing?
2. **White-Labeling**: Should organizations be able to fully rebrand the client app?
3. **SSO/SAML**: Do enterprise clients need SSO integration?
4. **API Access**: Should organizations have programmatic API access?
5. **Multi-Organization**: Can a client belong to multiple organizations?
6. **Data Retention**: What is the retention period for access logs?
7. **International**: Support for non-Australian organizations?

---

## 11. Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Phase 10: Auth & Security | Complete | Leverages existing RBAC |
| Phase 19: Document Management | Complete | For document sharing |
| Phase 20: Tax Intelligence | Complete | For tax position viewing |
| Stripe Integration | Planned | For billing |
| Email Service | Existing | For invitations |

---

## 12. Appendix

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

*Document Version: 1.0*
*Last Updated: 2026-01-19*
