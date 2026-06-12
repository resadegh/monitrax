# Phase 33: Admin Portal - Monetization & License Management

> ⚠️ **NAMING NOTE (added 2026-05-09):** This doc covers the **original Phase 33** scoped at 2026-01-19 — the Monitrax-side admin portal at `/admin/*` (admin users, license management, billing transactions, feature flags, audit logs, organisations management). Around 2026-05-04, the "Phase 33" label was reused for a parallel workstream — **the B2B2C help / training / FAQ / compliance system**. To disambiguate:
>
> - **Phase 33 (this doc, original)** — admin portal at `/admin/*` — ✅ SHIPPED 2026-01-19. Covers `AdminUser`, `OrganizationLicense`, `BillingTransaction`, `GlobalFeatureFlag`, etc.
> - **Phase 33a/b/c/d/g (later, B2B2C system)** — Help Center + In-App Drawer + Save-as-PDF + Compliance Pack + Adviser Feedback Inbox — ✅ SHIPPED May 2026. See `docs/blueprint/MASTER_BLUEPRINT.md` §4 for individual sub-phase rows; `docs/IMPLEMENTATION_PLAN.md` Recently Completed entries 2026-05-04 to 2026-05-09 for full deliverables.
>
> The two share the "Phase 33" label only by historical accident. They are independent workstreams with different schemas, surfaces, and audiences. Future docs that want to reference the admin portal should write "Phase 33 (admin portal)" or "Phase M / Phase 33 admin portal"; docs that want to reference the help center should write "Phase 33a/b/c/d (Help Center)" or "Phase 33g (Adviser Feedback Inbox)".

## Implementation Status: ✅ COMPLETE

**Implementation Date:** 2026-01-19 (extended with Adviser Feedback Inbox surface 2026-05-05 via Phase 33g)
**Branch:** `claude/admin-monetization-licenses-Gf7rU`
**Status:** Deployed and functional. Adviser Feedback Inbox added 2026-05-05 at `/admin/feedback`. Marketplace Listing approval queue added 2026-05-05 at `/admin/marketplace/listings(/[id])`.

### What Was Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| Database Models | ✅ Complete | AdminUser, AdminSession, AdminAuditLog, ImpersonationSession, GlobalFeatureFlag, FeatureFlagOverride, UserSubscription, OrganizationLicense, BillingTransaction |
| Core Library (`/lib/admin/`) | ✅ Complete | auth.ts, permissions.ts, constants.ts, types.ts, featureFlags.ts |
| UI Components (`/components/admin/`) | ✅ Complete | All layout, UI primitives, and feature components |
| Admin Pages (`/app/admin/`) | ✅ Complete | Login, Dashboard, Organizations, Users, Billing, Analytics, Feature Flags, Support, Settings |
| API Routes (`/app/api/admin/`) | ✅ Complete | Auth, Organizations, Users, Billing, Analytics, Feature Flags, Audit endpoints |
| Admin Seeding | ✅ Complete | Default admin user creation via `npm run seed:admin` |

### Admin Portal Access

- **URL:** `/admin/login`
- **Default Admin:** `admin@monitrax.com.au` / `Admin123!`
- **Role:** SUPER_ADMIN (full access)

### Environment Variables Required

```env
NEXT_PUBLIC_ADMIN_PORTAL_ENABLED=true
```

### Key Commits

| Commit | Description |
|--------|-------------|
| `bd578de` | Initial Phase 33 implementation |
| `47df7ae` | Fix Prisma import path |
| `e097a92` | Fix ButtonGroup type error |
| `3cadbd5` | Add admin seed script |
| `a5cdf76` | Use NEXT_PUBLIC_ prefix for client-side access |
| `86ed808` | Fix environment variable reading |
| `c47917e` | Fix password hashing format (salt:hash) |
| `5ace7ee` | Add real dashboard data, fix feature gates |
| `27a2f5e` | Fix template literal syntax errors |
| `44ac533` | Fix TypeScript error in feature-usage route (AuditAction enum) |
| `8ecdaef` | Fix TypeScript errors with AuditAction enum filters |
| `35673f5` | Use valid AuditAction enum values in queries |
| `6bdb71b` | Add 'audit' to FeatureAccess interface |
| `53b16df` | Wrap useSearchParams in Suspense boundary |

---

## Overview

Phase 33 introduces a dedicated Admin Portal at `/admin` for Monitrax staff to manage monetization, licenses, users, and organizations. This portal is completely isolated from the existing user app (`/`) and enterprise portal (`/portal`), following the same modular architecture patterns established in Phase 32.

### Authentication Flow Architecture

```
/signin         → Personal Users (existing)
/portal/login   → Organization Portal (Phase 32)
/admin/login    → Monitrax Staff Admin (NEW - Phase 33)
```

## Goals

1. **Monetization Management** - Control organization tiers, licenses, and billing
2. **User Administration** - Manage personal users, subscriptions, and account status
3. **Analytics & Insights** - Revenue metrics, growth charts, feature usage
4. **Support Tools** - User impersonation, access logs, error tracking
5. **Feature Control** - Global feature flags, A/B testing, rollout management

## Non-Goals

- Modifying existing user authentication flows
- Changing the enterprise portal functionality
- Direct database manipulation (all through APIs)
- Real-time billing processing (integration with Stripe webhooks)

---

## Architecture

### Directory Structure

Following the established modular pattern from Phase 32:

```
/lib/admin/                          # Core admin library
├── index.ts                         # Barrel export
├── auth.ts                          # Admin authentication utilities
├── permissions.ts                   # Admin RBAC system
├── constants.ts                     # Routes, limits, error codes
├── types.ts                         # TypeScript definitions
├── featureFlags.ts                  # Admin feature flag management
└── services/                        # API client services
    ├── index.ts                     # Service exports
    ├── api-client.ts                # Base HTTP client
    ├── organizations.ts             # Organization management
    ├── users.ts                     # User management
    ├── billing.ts                   # Billing operations
    ├── analytics.ts                 # Analytics queries
    ├── feature-flags.ts             # Feature flag operations
    └── audit.ts                     # Audit log queries

/components/admin/                   # Reusable React components
├── index.ts                         # Component exports
├── AdminFeatureGate.tsx             # Feature flag component gate
├── layout/
│   ├── AdminSidebar.tsx             # Navigation sidebar
│   ├── AdminHeader.tsx              # Top header bar
│   └── AdminBreadcrumb.tsx          # Breadcrumb navigation
├── ui/                              # Reusable UI primitives
│   ├── index.ts
│   ├── AdminCard.tsx
│   ├── AdminTable.tsx
│   ├── AdminButton.tsx
│   ├── AdminForm.tsx
│   ├── AdminBadge.tsx
│   ├── AdminStats.tsx
│   └── AdminChart.tsx
├── organizations/                   # Organization management
│   ├── index.ts
│   ├── OrganizationList.tsx
│   ├── OrganizationDetail.tsx
│   ├── OrganizationLicenseManager.tsx
│   └── OrganizationActivityLog.tsx
├── users/                           # User management
│   ├── index.ts
│   ├── UserList.tsx
│   ├── UserDetail.tsx
│   ├── UserSubscriptionManager.tsx
│   └── UserActivityLog.tsx
├── billing/                         # Billing dashboard
│   ├── index.ts
│   ├── RevenueOverview.tsx
│   ├── SubscriptionBreakdown.tsx
│   ├── TransactionList.tsx
│   └── FailedPayments.tsx
├── analytics/                       # Analytics dashboard
│   ├── index.ts
│   ├── GrowthCharts.tsx
│   ├── FeatureUsageMetrics.tsx
│   ├── ActiveUsersChart.tsx
│   └── RetentionMetrics.tsx
├── feature-flags/                   # Feature flag management
│   ├── index.ts
│   ├── GlobalFlagsList.tsx
│   ├── FlagOverrideEditor.tsx
│   └── ABTestingPanel.tsx
└── support/                         # Support tools
    ├── index.ts
    ├── ImpersonationPanel.tsx
    ├── AccessLogsViewer.tsx
    └── ErrorLogsViewer.tsx

/app/admin/                          # Next.js App Router pages
├── layout.tsx                       # Admin layout (server)
├── AdminLayoutClient.tsx            # Admin layout (client)
├── page.tsx                         # Redirect to login/dashboard
├── login/
│   └── page.tsx                     # Admin login page
├── dashboard/
│   └── page.tsx                     # Admin dashboard
├── organizations/
│   ├── page.tsx                     # Organization list
│   └── [orgId]/
│       └── page.tsx                 # Organization detail
├── users/
│   ├── page.tsx                     # User list
│   └── [userId]/
│       └── page.tsx                 # User detail
├── billing/
│   └── page.tsx                     # Billing dashboard
├── analytics/
│   └── page.tsx                     # Analytics dashboard
├── feature-flags/
│   └── page.tsx                     # Feature flag management
├── support/
│   ├── page.tsx                     # Support tools home
│   ├── impersonate/
│   │   └── page.tsx                 # User impersonation
│   └── logs/
│       └── page.tsx                 # Access/error logs
└── settings/
    └── page.tsx                     # Admin settings

/app/api/admin/                      # Admin API routes
├── health/route.ts                  # Health check
├── auth/
│   ├── login/route.ts               # Admin login
│   ├── logout/route.ts              # Admin logout
│   └── session/route.ts             # Session verification
├── organizations/
│   ├── route.ts                     # List organizations
│   └── [orgId]/
│       ├── route.ts                 # Get/update organization
│       ├── license/route.ts         # License management
│       ├── activity/route.ts        # Activity logs
│       └── usage/route.ts           # Usage statistics
├── users/
│   ├── route.ts                     # List users
│   └── [userId]/
│       ├── route.ts                 # Get/update user
│       ├── subscription/route.ts    # Subscription management
│       ├── activity/route.ts        # Activity logs
│       └── impersonate/route.ts     # Impersonation token
├── billing/
│   ├── overview/route.ts            # Revenue metrics
│   ├── subscriptions/route.ts       # Subscription breakdown
│   ├── transactions/route.ts        # Transaction list
│   └── failed-payments/route.ts     # Failed payments
├── analytics/
│   ├── growth/route.ts              # Growth metrics
│   ├── feature-usage/route.ts       # Feature usage
│   ├── active-users/route.ts        # DAU/MAU metrics
│   └── retention/route.ts           # Retention metrics
├── feature-flags/
│   ├── route.ts                     # List/update global flags
│   └── overrides/route.ts           # User/org overrides
└── audit/
    ├── route.ts                     # Audit log queries
    └── export/route.ts              # Export audit logs
```

---

## Database Models

### New Prisma Models

```prisma
// ============================================
// ADMIN PORTAL MODELS (Phase 33)
// ============================================

// Admin user roles for Monitrax staff
enum AdminRole {
  SUPER_ADMIN      // Full access to everything
  BILLING_ADMIN    // Billing & subscriptions only
  SUPPORT_ADMIN    // User lookup, impersonation, logs
  VIEWER           // Read-only analytics
}

// Admin user account (separate from regular users)
model AdminUser {
  id                String       @id @default(uuid())
  email             String       @unique
  passwordHash      String
  name              String
  role              AdminRole    @default(VIEWER)
  isActive          Boolean      @default(true)
  mfaEnabled        Boolean      @default(false)
  mfaSecret         String?
  lastLoginAt       DateTime?
  lastLoginIp       String?
  failedLoginCount  Int          @default(0)
  lockedUntil       DateTime?
  ipWhitelist       String[]     @default([])
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
  createdBy         String?      // AdminUser ID who created this admin

  // Relations
  sessions          AdminSession[]
  auditLogs         AdminAuditLog[]
  impersonations    ImpersonationSession[]

  @@index([email])
  @@index([role])
  @@map("admin_users")
}

// Admin session management
model AdminSession {
  id                String       @id @default(uuid())
  adminUserId       String
  token             String       @unique
  tokenHash         String       @unique
  ipAddress         String
  userAgent         String?
  expiresAt         DateTime
  createdAt         DateTime     @default(now())
  lastActivityAt    DateTime     @default(now())
  isRevoked         Boolean      @default(false)
  revokedAt         DateTime?
  revokedReason     String?

  // Relations
  adminUser         AdminUser    @relation(fields: [adminUserId], references: [id], onDelete: Cascade)

  @@index([adminUserId])
  @@index([tokenHash])
  @@index([expiresAt])
  @@map("admin_sessions")
}

// Comprehensive audit log for all admin actions
model AdminAuditLog {
  id                String       @id @default(uuid())
  adminUserId       String
  action            String       // e.g., "USER_SUSPENDED", "LICENSE_UPDATED"
  category          String       // e.g., "USER_MANAGEMENT", "BILLING", "FEATURE_FLAGS"
  targetType        String?      // e.g., "User", "Organization"
  targetId          String?      // ID of the affected entity
  description       String       // Human-readable description
  metadata          Json?        // Additional context (before/after values)
  ipAddress         String
  userAgent         String?
  requestId         String?      // For correlating with application logs
  timestamp         DateTime     @default(now())

  // Relations
  adminUser         AdminUser    @relation(fields: [adminUserId], references: [id])

  @@index([adminUserId])
  @@index([action])
  @@index([category])
  @@index([targetType, targetId])
  @@index([timestamp])
  @@map("admin_audit_logs")
}

// Impersonation session tracking
model ImpersonationSession {
  id                String       @id @default(uuid())
  adminUserId       String
  targetUserId      String       // User being impersonated
  targetType        String       // "USER" or "ORGANIZATION_MEMBER"
  reason            String       // Required justification
  token             String       @unique
  tokenHash         String       @unique
  startedAt         DateTime     @default(now())
  expiresAt         DateTime
  endedAt           DateTime?
  ipAddress         String
  userAgent         String?
  actionsPerformed  Json?        // Log of actions taken during impersonation

  // Relations
  adminUser         AdminUser    @relation(fields: [adminUserId], references: [id])

  @@index([adminUserId])
  @@index([targetUserId])
  @@index([tokenHash])
  @@map("impersonation_sessions")
}

// Global feature flag configuration
model GlobalFeatureFlag {
  id                String       @id @default(uuid())
  key               String       @unique // e.g., "DARK_MODE", "AI_INSIGHTS"
  name              String       // Human-readable name
  description       String?
  enabled           Boolean      @default(false)
  enabledForPercent Int          @default(0)  // Percentage rollout (0-100)
  enabledForTiers   String[]     @default([]) // User tiers that have access
  enabledForPlans   String[]     @default([]) // Organization plans that have access
  metadata          Json?        // Additional configuration
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
  createdBy         String?      // AdminUser ID
  updatedBy         String?      // AdminUser ID

  // Relations
  overrides         FeatureFlagOverride[]

  @@index([key])
  @@index([enabled])
  @@map("global_feature_flags")
}

// Per-user or per-organization feature flag overrides
model FeatureFlagOverride {
  id                String       @id @default(uuid())
  flagId            String
  targetType        String       // "USER" or "ORGANIZATION"
  targetId          String       // User ID or Organization ID
  enabled           Boolean
  reason            String?      // Why this override exists
  expiresAt         DateTime?    // Optional expiration for temporary overrides
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
  createdBy         String?      // AdminUser ID

  // Relations
  flag              GlobalFeatureFlag @relation(fields: [flagId], references: [id], onDelete: Cascade)

  @@unique([flagId, targetType, targetId])
  @@index([targetType, targetId])
  @@map("feature_flag_overrides")
}

// User subscription tiers for personal users
enum UserTier {
  FREE
  BASIC
  PRO
  PREMIUM
}

// User subscription status (extends existing User model)
model UserSubscription {
  id                String       @id @default(uuid())
  userId            String       @unique
  tier              UserTier     @default(FREE)
  status            String       @default("active") // active, suspended, cancelled
  stripeCustomerId  String?
  stripeSubscriptionId String?
  currentPeriodStart DateTime?
  currentPeriodEnd  DateTime?
  cancelAtPeriodEnd Boolean      @default(false)
  suspendedAt       DateTime?
  suspendedReason   String?
  suspendedBy       String?      // AdminUser ID
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  @@index([userId])
  @@index([tier])
  @@index([status])
  @@map("user_subscriptions")
}

// Organization license management (extends existing Organization model)
model OrganizationLicense {
  id                  String           @id @default(uuid())
  organizationId      String           @unique
  tier                OrganizationPlan @default(STARTER)
  status              String           @default("active") // active, suspended, cancelled
  clientLimit         Int              @default(10)
  staffLimit          Int              @default(3)
  customClientLimit   Int?             // Override for custom deals
  customStaffLimit    Int?             // Override for custom deals
  stripeCustomerId    String?
  stripeSubscriptionId String?
  currentPeriodStart  DateTime?
  currentPeriodEnd    DateTime?
  cancelAtPeriodEnd   Boolean          @default(false)
  suspendedAt         DateTime?
  suspendedReason     String?
  suspendedBy         String?          // AdminUser ID
  notes               String?          // Internal notes about this license
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  @@index([organizationId])
  @@index([tier])
  @@index([status])
  @@map("organization_licenses")
}

// Billing transaction log for revenue tracking
model BillingTransaction {
  id                String       @id @default(uuid())
  type              String       // "subscription", "one_time", "refund"
  entityType        String       // "USER" or "ORGANIZATION"
  entityId          String       // User ID or Organization ID
  amount            Decimal      @db.Decimal(10, 2)
  currency          String       @default("AUD")
  status            String       // "succeeded", "pending", "failed", "refunded"
  stripePaymentId   String?
  stripeInvoiceId   String?
  description       String?
  metadata          Json?
  failureReason     String?
  createdAt         DateTime     @default(now())

  @@index([entityType, entityId])
  @@index([type])
  @@index([status])
  @@index([createdAt])
  @@map("billing_transactions")
}
```

### Model Relationships

```
AdminUser
├── AdminSession (1:many)
├── AdminAuditLog (1:many)
└── ImpersonationSession (1:many)

GlobalFeatureFlag
└── FeatureFlagOverride (1:many)

User (existing)
└── UserSubscription (1:1)

Organization (existing)
└── OrganizationLicense (1:1)
```

---

## Admin Roles & Permissions

### Role Definitions

| Role | Description | Access Level |
|------|-------------|--------------|
| `SUPER_ADMIN` | Full system access | All features, all data |
| `BILLING_ADMIN` | Financial operations | Billing, subscriptions, revenue |
| `SUPPORT_ADMIN` | Customer support | User lookup, impersonation, logs |
| `VIEWER` | Analytics only | Read-only dashboards |

### Permission Matrix

| Permission | SUPER_ADMIN | BILLING_ADMIN | SUPPORT_ADMIN | VIEWER |
|------------|:-----------:|:-------------:|:-------------:|:------:|
| **Organizations** |
| View all organizations | ✅ | ✅ | ✅ | ✅ |
| Update organization details | ✅ | ❌ | ❌ | ❌ |
| Manage licenses | ✅ | ✅ | ❌ | ❌ |
| Change tiers | ✅ | ✅ | ❌ | ❌ |
| Suspend/reactivate | ✅ | ✅ | ❌ | ❌ |
| View activity logs | ✅ | ✅ | ✅ | ✅ |
| **Users** |
| View all users | ✅ | ✅ | ✅ | ✅ |
| Update user details | ✅ | ❌ | ✅ | ❌ |
| Manage subscriptions | ✅ | ✅ | ❌ | ❌ |
| Change tiers | ✅ | ✅ | ❌ | ❌ |
| Suspend/reactivate | ✅ | ✅ | ✅ | ❌ |
| View activity logs | ✅ | ✅ | ✅ | ✅ |
| Impersonate users | ✅ | ❌ | ✅ | ❌ |
| **Billing** |
| View revenue metrics | ✅ | ✅ | ❌ | ✅ |
| View transactions | ✅ | ✅ | ❌ | ✅ |
| Process refunds | ✅ | ✅ | ❌ | ❌ |
| View failed payments | ✅ | ✅ | ❌ | ✅ |
| **Analytics** |
| View growth charts | ✅ | ✅ | ✅ | ✅ |
| View feature usage | ✅ | ✅ | ✅ | ✅ |
| Export data | ✅ | ✅ | ❌ | ❌ |
| **Feature Flags** |
| View global flags | ✅ | ❌ | ✅ | ✅ |
| Update global flags | ✅ | ❌ | ❌ | ❌ |
| Create/delete flags | ✅ | ❌ | ❌ | ❌ |
| Manage overrides | ✅ | ❌ | ✅ | ❌ |
| **Support Tools** |
| View access logs | ✅ | ❌ | ✅ | ❌ |
| View error logs | ✅ | ❌ | ✅ | ❌ |
| Export logs | ✅ | ❌ | ✅ | ❌ |
| **Admin Management** |
| View admin users | ✅ | ❌ | ❌ | ❌ |
| Create admin users | ✅ | ❌ | ❌ | ❌ |
| Update admin roles | ✅ | ❌ | ❌ | ❌ |
| Revoke admin access | ✅ | ❌ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ✅ | ✅ |

---

## Feature Specifications

### 1. Organization Management

#### Organization List View
- Paginated table with search and filters
- Columns: Name, Tier, Status, Clients, Staff, MRR, Created
- Filters: Tier, Status, Created Date Range
- Quick actions: View, Suspend, Upgrade/Downgrade

#### Organization Detail View
- Organization profile information
- License details with edit capability
- Usage statistics (clients, staff, storage)
- Activity timeline
- Billing history
- Team members list

#### License Management
- Change tier (STARTER → PROFESSIONAL → BUSINESS → ENTERPRISE)
- Override client/staff limits for custom deals
- Suspend/reactivate with reason
- Set license expiration

### 2. User Management

#### User List View
- Paginated table with search and filters
- Columns: Name, Email, Tier, Status, Last Active, MRR
- Filters: Tier, Status, Registration Date
- Quick actions: View, Suspend, Upgrade/Downgrade

#### User Detail View
- User profile information
- Subscription details with edit capability
- Financial data summary (accounts, properties, etc.)
- Activity timeline
- Login history
- Organization memberships

#### Subscription Management
- Change tier (FREE → BASIC → PRO → PREMIUM)
- Suspend/reactivate with reason
- Apply promotional credits
- View payment history

### 3. Billing Dashboard

#### Revenue Overview
- MRR (Monthly Recurring Revenue) current and trend
- ARR (Annual Recurring Revenue)
- Churn rate (monthly/yearly)
- ARPU (Average Revenue Per User)
- LTV (Lifetime Value)

#### Subscription Breakdown
- Active subscriptions by user tier
- Active subscriptions by organization plan
- New subscriptions (last 30 days)
- Cancelled subscriptions (last 30 days)
- Upgrade/downgrade trends

#### Transaction List
- Paginated list of all billing transactions
- Filters: Type, Status, Date Range, Amount Range
- Columns: Date, Entity, Type, Amount, Status
- Export to CSV

#### Failed Payments
- List of failed payment attempts
- Retry payment option
- Send payment reminder
- Filter by failure reason

### 4. Analytics Dashboard

#### User Growth
- Line chart: New users over time
- Bar chart: Registrations by source
- Funnel: Registration → Activation → Subscription

#### Organization Growth
- Line chart: New organizations over time
- Bar chart: Organizations by tier
- Growth rate metrics

#### Feature Usage
- Table: Feature name, Usage %, Active Users
- Heatmap: Feature usage by user tier
- Trend charts for key features

#### Active Users
- DAU (Daily Active Users)
- WAU (Weekly Active Users)
- MAU (Monthly Active Users)
- Retention cohort analysis

### 5. Feature Flags

#### Global Flags Management
- List all feature flags with status
- Toggle enable/disable
- Set percentage rollout
- Configure tier-based access
- Audit history for changes

#### Override Management
- Search for user/organization
- View current flag states
- Create override (enable/disable)
- Set expiration for temporary overrides

#### A/B Testing Controls
- Create experiment variants
- Set traffic allocation
- View variant performance
- End experiment and apply winner

### 6. Support Tools

#### User Impersonation
- Search for user by email/ID
- Require reason for impersonation
- Time-limited session (1 hour max)
- All actions logged
- Visual indicator during impersonation
- One-click end impersonation

#### Access Logs Viewer
- Searchable log viewer
- Filters: User, Action, Date Range, IP
- Columns: Timestamp, User, Action, Target, IP
- Export capability

#### Error Logs Viewer
- Recent application errors
- Filter by severity, component
- Stack trace viewer
- Link to user context
- Mark as resolved

---

## Security Requirements

### Authentication
- Separate admin user database (not shared with regular users)
- Strong password requirements (min 12 chars, complexity rules)
- MFA required for all admin accounts
- Session timeout after 30 minutes of inactivity
- Session invalidation on role change

### IP Whitelisting
- Optional IP whitelist per admin user
- Global IP whitelist for admin portal access
- VPN-only access option

### Audit Logging
- All admin actions logged with full context
- Before/after values for mutations
- IP address and user agent captured
- Logs are append-only (immutable)
- 7-year retention for compliance

### Rate Limiting
- Login attempts: 5 per 15 minutes per IP
- API calls: 100 per minute per admin
- Bulk operations: 10 per minute

### Impersonation Security
- Reason required and logged
- Maximum 1-hour duration
- Clear visual indicator to admin
- All actions during impersonation logged separately
- Notification to user (optional, configurable)

---

## API Specifications

### Authentication Endpoints

```
POST /api/admin/auth/login
Request: { email: string, password: string, mfaCode?: string }
Response: { success: boolean, session?: AdminSession, requireMfa?: boolean }

POST /api/admin/auth/logout
Response: { success: boolean }

GET /api/admin/auth/session
Response: { valid: boolean, admin?: AdminUser, expiresAt?: string }
```

### Organization Endpoints

```
GET /api/admin/organizations
Query: { page, limit, search, tier, status, sortBy, sortOrder }
Response: { organizations: Organization[], pagination: Pagination }

GET /api/admin/organizations/:orgId
Response: { organization: Organization, license: License, usage: Usage }

PATCH /api/admin/organizations/:orgId
Request: { name?, description?, ... }
Response: { organization: Organization }

POST /api/admin/organizations/:orgId/license
Request: { tier?, clientLimit?, staffLimit?, status? }
Response: { license: License }

GET /api/admin/organizations/:orgId/activity
Query: { page, limit, startDate, endDate }
Response: { activities: Activity[], pagination: Pagination }
```

### User Endpoints

```
GET /api/admin/users
Query: { page, limit, search, tier, status, sortBy, sortOrder }
Response: { users: User[], pagination: Pagination }

GET /api/admin/users/:userId
Response: { user: User, subscription: Subscription, stats: UserStats }

PATCH /api/admin/users/:userId
Request: { name?, email?, ... }
Response: { user: User }

POST /api/admin/users/:userId/subscription
Request: { tier?, status?, reason? }
Response: { subscription: Subscription }

POST /api/admin/users/:userId/impersonate
Request: { reason: string, duration?: number }
Response: { token: string, expiresAt: string }

GET /api/admin/users/:userId/activity
Query: { page, limit, startDate, endDate }
Response: { activities: Activity[], pagination: Pagination }
```

### Billing Endpoints

```
GET /api/admin/billing/overview
Query: { period?: 'day' | 'week' | 'month' | 'year' }
Response: { mrr, arr, churn, arpu, ltv, trends }

GET /api/admin/billing/subscriptions
Query: { page, limit, entityType, tier }
Response: { subscriptions: Subscription[], breakdown: Breakdown }

GET /api/admin/billing/transactions
Query: { page, limit, type, status, startDate, endDate }
Response: { transactions: Transaction[], pagination: Pagination }

GET /api/admin/billing/failed-payments
Query: { page, limit }
Response: { payments: FailedPayment[], pagination: Pagination }
```

### Analytics Endpoints

```
GET /api/admin/analytics/growth
Query: { metric: 'users' | 'organizations', period, startDate, endDate }
Response: { data: TimeSeriesData[], summary: GrowthSummary }

GET /api/admin/analytics/feature-usage
Query: { period, tier? }
Response: { features: FeatureUsage[] }

GET /api/admin/analytics/active-users
Query: { metric: 'dau' | 'wau' | 'mau', startDate, endDate }
Response: { data: TimeSeriesData[], current: number, change: number }

GET /api/admin/analytics/retention
Query: { cohortType: 'week' | 'month', periods: number }
Response: { cohorts: CohortData[] }
```

### Feature Flags Endpoints

```
GET /api/admin/feature-flags
Response: { flags: FeatureFlag[] }

PATCH /api/admin/feature-flags/:flagKey
Request: { enabled?, enabledForPercent?, enabledForTiers?, enabledForPlans? }
Response: { flag: FeatureFlag }

POST /api/admin/feature-flags
Request: { key, name, description?, enabled? }
Response: { flag: FeatureFlag }

DELETE /api/admin/feature-flags/:flagKey
Response: { success: boolean }

GET /api/admin/feature-flags/overrides
Query: { targetType, targetId }
Response: { overrides: Override[] }

POST /api/admin/feature-flags/overrides
Request: { flagKey, targetType, targetId, enabled, reason?, expiresAt? }
Response: { override: Override }

DELETE /api/admin/feature-flags/overrides/:overrideId
Response: { success: boolean }
```

### Audit Endpoints

```
GET /api/admin/audit
Query: { page, limit, adminId?, action?, category?, targetType?, targetId?, startDate, endDate }
Response: { logs: AuditLog[], pagination: Pagination }

GET /api/admin/audit/export
Query: { format: 'csv' | 'json', startDate, endDate, ... }
Response: File download
```

---

## Feature Flags

### Admin Portal Master Switch

```env
# Master switch - all admin features disabled if false
ADMIN_PORTAL_ENABLED=false

# Individual feature toggles
ADMIN_ORGANIZATION_MANAGEMENT=true
ADMIN_USER_MANAGEMENT=true
ADMIN_BILLING_DASHBOARD=true
ADMIN_ANALYTICS_DASHBOARD=true
ADMIN_FEATURE_FLAGS=true
ADMIN_SUPPORT_TOOLS=true
ADMIN_IMPERSONATION=true
ADMIN_AUDIT_LOGS=true
```

### Feature Flag Defaults

All admin features are **disabled by default** in production. Enable explicitly via environment variables or configuration.

---

## UI/UX Design

### Design Principles

1. **Professional & Clean** - Minimal, focused interface
2. **Data-Dense** - Show relevant information without clutter
3. **Action-Oriented** - Clear CTAs, quick actions
4. **Consistent** - Same patterns across all sections
5. **Accessible** - WCAG 2.1 AA compliance

### Color Scheme

- **Primary**: Deep blue (#1E3A5F) - Authority, trust
- **Accent**: Bright teal (#00B4D8) - Actions, highlights
- **Success**: Green (#10B981)
- **Warning**: Amber (#F59E0B)
- **Error**: Red (#EF4444)
- **Neutral**: Gray scale for backgrounds and text

### Navigation Structure

```
Admin Portal
├── Dashboard (overview)
├── Organizations
│   ├── List
│   └── Detail
├── Users
│   ├── List
│   └── Detail
├── Billing
│   ├── Overview
│   ├── Transactions
│   └── Failed Payments
├── Analytics
│   ├── Growth
│   ├── Feature Usage
│   └── Retention
├── Feature Flags
│   ├── Global Flags
│   └── Overrides
├── Support
│   ├── Impersonate
│   └── Logs
└── Settings
    ├── Admin Users
    └── Portal Settings
```

---

## Deployment Configuration

### Environment Variables

```env
# Admin Portal
ADMIN_PORTAL_ENABLED=true
ADMIN_PORTAL_URL=https://admin.monitrax.com

# Security
ADMIN_SESSION_DURATION=1800000  # 30 minutes in ms
ADMIN_IP_WHITELIST=10.0.0.0/8,192.168.0.0/16
ADMIN_MFA_REQUIRED=true
ADMIN_PASSWORD_MIN_LENGTH=12

# Rate Limiting
ADMIN_LOGIN_RATE_LIMIT=5
ADMIN_API_RATE_LIMIT=100

# Impersonation
ADMIN_IMPERSONATION_MAX_DURATION=3600000  # 1 hour in ms
ADMIN_IMPERSONATION_NOTIFY_USER=false

# Audit
ADMIN_AUDIT_RETENTION_DAYS=2555  # 7 years

# Feature Toggles (all default to false)
ADMIN_ORGANIZATION_MANAGEMENT=true
ADMIN_USER_MANAGEMENT=true
ADMIN_BILLING_DASHBOARD=true
ADMIN_ANALYTICS_DASHBOARD=true
ADMIN_FEATURE_FLAGS=true
ADMIN_SUPPORT_TOOLS=true
```

### Production Checklist

- [ ] Set up separate admin subdomain (admin.monitrax.com)
- [ ] Configure IP whitelist for office/VPN
- [ ] Enable MFA for all admin users
- [ ] Set up audit log archival
- [ ] Configure alert notifications
- [ ] Test impersonation flow
- [ ] Review rate limits
- [ ] Load test admin dashboard queries

---

## Implementation Phases

### Phase 33.1: Foundation (Core Setup)
- Database models and migrations
- `/lib/admin/` core modules
- Admin authentication flow
- Feature flag infrastructure

### Phase 33.2: Organization Management
- ✅ Organization list and search (real data)
- ✅ Organization detail view (real data — fixed 2026-06-12; was mock scaffold)
- ✅ License management (plan/limits/notes + suspend/reactivate; suspension
  blocks the firm's portal access to client data via
  `lib/portal/licenseGuard.ts` — members keep their personal accounts)
- Activity logs (not yet — API exposes no per-org activity; the mock
  activity feed was removed rather than faked)

### Phase 33.3: User Management
- ✅ User list and search (real data)
- ✅ User detail view (real data — fixed 2026-06-12; was mock scaffold)
- ✅ Subscription management (tier change + suspend/reactivate; suspension
  enforced via GCP Identity Platform `accounts:update {disableUser}` —
  see `docs/operational/security/01_AUTHENTICATION.md` § User Suspension)
- ✅ Activity logs (real since 2026-06-12 PR 3 — `lastLoginAt` from
  `LoginAttempt` + last-10 `AuditLog` events, metadata excluded per CDR §13.3)

### Phase 33.4: Billing Dashboard
- Revenue overview
- Subscription breakdown
- Transaction list
- Failed payments

### Phase 33.5: Analytics Dashboard
- Growth charts
- Feature usage metrics
- Active users (DAU/MAU)
- Retention analysis

### Phase 33.6: Feature Flags
- Global flag management
- Override system
- A/B testing controls

### Phase 33.7: Support Tools
- User impersonation
- Access logs viewer
- Error logs viewer

### Phase 33.8: Polish & Security
- Security hardening
- Performance optimization
- UI polish
- Documentation

---

## Testing Strategy

### Unit Tests
- Permission checks
- Feature flag evaluation
- Data transformation functions

### Integration Tests
- API endpoint responses
- Database operations
- Authentication flow

### E2E Tests
- Admin login flow
- Organization management workflow
- User impersonation workflow
- Feature flag toggle workflow

### Security Tests
- Authentication bypass attempts
- Permission escalation attempts
- SQL injection/XSS prevention
- Rate limit enforcement

---

## Rollback Plan

1. **Disable feature flag**: Set `ADMIN_PORTAL_ENABLED=false`
2. **Admin routes become inaccessible**: Return 503
3. **Database tables remain**: No data loss
4. **Audit logs preserved**: Compliance maintained
5. **Restore**: Re-enable flag when issues resolved

---

## Success Metrics

### Operational
- Admin portal uptime: >99.9%
- API response time: <200ms p95
- Zero security incidents

### Business
- Time to resolve support tickets: -30%
- License management efficiency: +50%
- Revenue visibility: Real-time MRR tracking

### Compliance
- 100% audit coverage for admin actions
- 100% MFA adoption for admin users
- Zero unauthorized access incidents

---

## Dependencies

### Internal
- Phase 10: Auth system (for session management patterns)
- Phase 32: Portal architecture (for modular patterns)
- Existing User and Organization models

### External
- Stripe API (for billing data)
- Analytics storage (for metrics aggregation)

---

## Open Questions

1. Should admin portal have its own subdomain (admin.monitrax.com)?
2. What's the retention period for impersonation logs?
3. Should users be notified when an admin views their account?
4. Integration with existing monitoring/alerting systems?

---

## Appendix

### Glossary

| Term | Definition |
|------|------------|
| MRR | Monthly Recurring Revenue |
| ARR | Annual Recurring Revenue |
| ARPU | Average Revenue Per User |
| LTV | Customer Lifetime Value |
| DAU | Daily Active Users |
| MAU | Monthly Active Users |
| Churn | Rate of subscription cancellations |

### Related Documents

- `PHASE_32_ENTERPRISE_PORTAL.md` - Enterprise portal architecture reference
- `PHASE_10_AUTH_AND_SECURITY.md` - Authentication system reference
- `MASTER_BLUEPRINT.md` - Overall system architecture
