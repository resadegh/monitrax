# PHASE 24B — BASIQ ADVANCED INTEGRATION

**Monitrax Blueprint — Phase 24B**
**Version:** v1.0
**Status:** Planned (Pending BASIQ Approval)
**Created:** 2026-04-11
**Depends On:** Phase 24 (Complete)

---

## Overview

Phase 24B extends the existing BASIQ Open Banking integration (Phase 24) with advanced features that require BASIQ production approval. This phase transforms Monitrax from a manual-sync bank connection to a fully automated, real-time financial data platform with enterprise-grade reliability.

> "From manual sync to always-on financial intelligence — your bank data, always current."

---

## Prerequisites

Before implementing Phase 24B, the following must be completed:

| Requirement | Status | Notes |
|-------------|--------|-------|
| Phase 24 Implementation | Complete | Basic BASIQ integration working |
| BASIQ Production Application | Pending | Apply via BASIQ Dashboard |
| BASIQ Production Approval | Pending | Required for advanced features |
| CDR Accreditation Review | Pending | If handling CDR data directly |
| Security Audit | Pending | Required for production access |

### BASIQ Production Application Checklist

1. **Business Verification**
   - ABN/ACN registration
   - Business address verification
   - Contact details verification

2. **Technical Requirements**
   - SSL/TLS certificates in place
   - Secure API key storage demonstrated
   - Data encryption at rest and in transit

3. **Compliance Documentation**
   - Privacy policy updated for Open Banking
   - Terms of service updated
   - Data retention policy documented
   - User consent flow approved

4. **Security Assessment**
   - Penetration testing report (if required)
   - Security controls documentation
   - Incident response plan

---

## Objectives

### 24B.1 Real-Time Data Synchronisation

**Goal:** Eliminate manual sync requirements with automated, real-time bank data updates.

| Feature | Description | Priority |
|---------|-------------|----------|
| Webhook Integration | Receive instant notifications when bank data changes | High |
| Scheduled Background Sync | Daily automatic sync for all active connections | High |
| Smart Sync Intervals | Adjust sync frequency based on account activity | Medium |
| Sync Health Monitoring | Track sync failures and auto-retry with backoff | High |

### 24B.2 Enhanced Transaction Intelligence

**Goal:** Leverage BASIQ enrichment data to supercharge transaction categorisation.

| Feature | Description | Priority |
|---------|-------------|----------|
| BASIQ Enrichment Integration | Use merchant, category, and location data from BASIQ | High |
| ANZSIC Code Mapping | Map BASIQ categories to Monitrax expense categories | High |
| Merchant Normalisation | Standardise merchant names across banks | Medium |
| Recurring Detection | Identify subscriptions and regular payments | High |
| Location-Based Insights | Geographic spending patterns (if available) | Low |

### 24B.3 Intelligent Account Matching

**Goal:** Seamlessly merge BASIQ accounts with existing manual accounts.

| Feature | Description | Priority |
|---------|-------------|----------|
| Smart Account Matching | Detect potential duplicates based on BSB/account number | High |
| Merge Wizard UI | Guide users through account consolidation | High |
| Historical Data Preservation | Maintain manual entries when merging | High |
| Conflict Resolution | Handle balance/transaction discrepancies | Medium |

### 24B.4 Multi-Connection Support

**Goal:** Support complex banking arrangements and household finances.

| Feature | Description | Priority |
|---------|-------------|----------|
| Joint Account Support | Connect accounts shared with partners | Medium |
| Business Account Separation | Track business accounts separately | Medium |
| Multiple Users per Bank | Different credentials for same institution | Low |
| Account Grouping | Organise accounts by purpose/owner | Medium |

### 24B.5 Production Reliability

**Goal:** Enterprise-grade reliability for financial data synchronisation.

| Feature | Description | Priority |
|---------|-------------|----------|
| Connection Health Dashboard | Monitor all bank connections centrally | High |
| Automatic Re-authentication | Detect and prompt for re-auth when needed | High |
| Graceful Degradation | Continue operation when BASIQ is unavailable | High |
| Audit Logging | Complete trail of all sync operations | High |
| Rate Limit Management | Respect BASIQ API limits with queuing | High |

---

## Architecture

### System Architecture (Phase 24B Enhanced)

```
                                    BASIQ WEBHOOKS
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MONITRAX BACKEND                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  Webhook Handler │    │  Sync Scheduler │    │  Health Monitor │         │
│  │  /api/basiq/     │    │  (Background)   │    │  (Background)   │         │
│  │  webhook         │    │                 │    │                 │         │
│  └────────┬─────────┘    └────────┬────────┘    └────────┬────────┘         │
│           │                       │                       │                  │
│           └───────────────────────┼───────────────────────┘                  │
│                                   │                                          │
│                                   ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     BASIQ SYNC ORCHESTRATOR                           │   │
│  │  lib/bank/basiqOrchestrator.ts                                        │   │
│  │                                                                        │   │
│  │  • processWebhookEvent()      • scheduleSync()                        │   │
│  │  • syncConnection()           • syncAllUserConnections()              │   │
│  │  • handleSyncFailure()        • retryWithBackoff()                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                   │                                          │
│           ┌───────────────────────┼───────────────────────────────┐          │
│           │                       │                               │          │
│           ▼                       ▼                               ▼          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │  Account Sync   │    │ Transaction Sync│    │ Enrichment Processor    │  │
│  │  Service        │    │ Service         │    │                         │  │
│  │                 │    │                 │    │  • BASIQ categories     │  │
│  │  • Import       │    │  • Import       │    │  • ANZSIC mapping       │  │
│  │  • Match        │    │  • Deduplicate  │    │  • Merchant normalise   │  │
│  │  • Update       │    │  • Categorise   │    │  • Recurring detect     │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BASIQ API (External)                               │
│                           https://au-api.basiq.io                            │
│                                                                              │
│  Endpoints:                                                                  │
│  • POST /token                    • GET /users/{id}/transactions            │
│  • GET /users/{id}/connections    • POST /webhooks                          │
│  • GET /users/{id}/accounts       • GET /institutions                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Webhook Event Flow

```
BASIQ Servers                    Monitrax
     │                              │
     │  POST /api/basiq/webhook     │
     │  ─────────────────────────►  │
     │                              │
     │                              ├─► Verify signature
     │                              │
     │                              ├─► Parse event type
     │                              │
     │                              ├─► Queue sync job
     │                              │
     │       202 Accepted           │
     │  ◄─────────────────────────  │
     │                              │
     │                              ├─► Process in background
     │                              │
     │                              ├─► Update accounts/transactions
     │                              │
     │                              └─► Notify user (if needed)
```

---

## Database Schema Changes

### New Models

```prisma
// Webhook event tracking for audit and replay
model BasiqWebhookEvent {
  id              String    @id @default(uuid())
  eventId         String    @unique  // BASIQ event ID
  eventType       String               // connection.created, transaction.updated, etc.
  connectionId    String?
  userId          String
  payload         Json                 // Raw event payload
  status          WebhookEventStatus   @default(PENDING)
  processedAt     DateTime?
  errorMessage    String?
  retryCount      Int       @default(0)
  createdAt       DateTime  @default(now())
  
  user            User      @relation(fields: [userId], references: [id])
  
  @@index([userId, createdAt])
  @@index([status])
  @@index([eventType])
}

enum WebhookEventStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  SKIPPED
}

// Scheduled sync jobs
model BasiqSyncJob {
  id              String    @id @default(uuid())
  userId          String
  connectionId    String?              // Null = sync all connections
  jobType         SyncJobType
  status          SyncJobStatus        @default(PENDING)
  scheduledFor    DateTime
  startedAt       DateTime?
  completedAt     DateTime?
  accountsSynced  Int       @default(0)
  txnsSynced      Int       @default(0)
  errorMessage    String?
  retryCount      Int       @default(0)
  createdAt       DateTime  @default(now())
  
  user            User      @relation(fields: [userId], references: [id])
  connection      BasiqConnection? @relation(fields: [connectionId], references: [id])
  
  @@index([status, scheduledFor])
  @@index([userId])
}

enum SyncJobType {
  SCHEDULED_DAILY
  WEBHOOK_TRIGGERED
  USER_INITIATED
  RETRY
}

enum SyncJobStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
  CANCELLED
}

// Account matching candidates
model AccountMatchCandidate {
  id              String    @id @default(uuid())
  userId          String
  basiqAccountId  String
  matchedAccountId String?             // Existing Monitrax account
  matchScore      Float                // 0-1 confidence score
  matchReason     String               // Why we think they match
  status          MatchStatus          @default(PENDING)
  userAction      String?              // merge, keep_separate, ignore
  resolvedAt      DateTime?
  createdAt       DateTime  @default(now())
  
  user            User      @relation(fields: [userId], references: [id])
  
  @@unique([userId, basiqAccountId])
  @@index([userId, status])
}

enum MatchStatus {
  PENDING
  CONFIRMED
  REJECTED
  AUTO_MERGED
}

// BASIQ enrichment cache
model BasiqEnrichmentCache {
  id              String    @id @default(uuid())
  merchantRaw     String
  merchantNormalised String?
  categoryAnzsic  String?
  categoryLevel1  String?
  categoryLevel2  String?
  subcategory     String?
  confidence      Float     @default(0)
  hitCount        Int       @default(1)
  lastUsed        DateTime  @default(now())
  createdAt       DateTime  @default(now())
  
  @@unique([merchantRaw])
  @@index([merchantNormalised])
}
```

### Model Updates

```prisma
// Add to BasiqConnection model
model BasiqConnection {
  // ... existing fields ...
  
  // Phase 24B additions
  webhookEnabled      Boolean   @default(false)
  lastWebhookAt       DateTime?
  syncFrequency       SyncFrequency @default(DAILY)
  nextScheduledSync   DateTime?
  consecutiveFailures Int       @default(0)
  healthStatus        ConnectionHealthStatus @default(UNKNOWN)
  healthCheckedAt     DateTime?
  
  // Relations
  syncJobs            BasiqSyncJob[]
}

enum SyncFrequency {
  REALTIME    // Webhook-driven
  HOURLY
  DAILY       // Default
  WEEKLY
  MANUAL      // User-initiated only
}

enum ConnectionHealthStatus {
  UNKNOWN
  HEALTHY
  DEGRADED    // Intermittent issues
  UNHEALTHY   // Consistent failures
  STALE       // No sync in 48+ hours
}

// Add to Account model
model Account {
  // ... existing fields ...
  
  // Phase 24B additions
  basiqEnrichmentData Json?     // Cached BASIQ enrichment
  mergedFromAccountId String?   // If this was merged from another account
  isMergeTarget       Boolean   @default(false)
}

// Add to UnifiedTransaction model
model UnifiedTransaction {
  // ... existing fields ...
  
  // Phase 24B additions
  basiqEnrichment     Json?     // Full BASIQ enrichment payload
  basiqCategoryCode   String?   // ANZSIC code from BASIQ
  basiqMerchantId     String?   // BASIQ merchant identifier
  basiqLocation       Json?     // Location data if available
}
```

---

## API Endpoints

### Webhook Endpoints

#### POST /api/basiq/webhook

Receives webhook events from BASIQ.

**Security:**
- Validate BASIQ signature header
- Verify event hasn't been processed (idempotency)
- Rate limit by IP

**Request Headers:**
```
X-Basiq-Signature: sha256=<signature>
X-Basiq-Event-Id: <unique-event-id>
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "connection.refreshed",
  "data": {
    "connectionId": "conn-uuid",
    "userId": "basiq-user-id",
    "institutionId": "AU00000",
    "status": "active"
  },
  "timestamp": "2026-04-11T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "eventId": "event-uuid",
    "status": "queued"
  }
}
```

**Supported Event Types:**

| Event Type | Action |
|------------|--------|
| `connection.created` | Import new accounts |
| `connection.refreshed` | Sync accounts and transactions |
| `connection.deleted` | Mark connection as deleted |
| `connection.error` | Log error, update health status |
| `account.created` | Import new account |
| `account.updated` | Update account balance |
| `transaction.created` | Import new transactions |

#### POST /api/basiq/webhook/register

Registers Monitrax webhook URL with BASIQ (admin only).

**Request:**
```json
{
  "webhookUrl": "https://app.monitrax.com/api/basiq/webhook",
  "events": ["connection.*", "account.*", "transaction.*"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "webhookId": "webhook-uuid",
    "url": "https://app.monitrax.com/api/basiq/webhook",
    "events": ["connection.*", "account.*", "transaction.*"],
    "status": "active"
  }
}
```

### Sync Management Endpoints

#### GET /api/basiq/sync/status

Get sync status for all user connections.

**Response:**
```json
{
  "success": true,
  "data": {
    "connections": [
      {
        "id": "conn-uuid",
        "institutionName": "Commonwealth Bank",
        "healthStatus": "HEALTHY",
        "lastSyncedAt": "2026-04-11T09:30:00Z",
        "nextScheduledSync": "2026-04-12T09:30:00Z",
        "syncFrequency": "DAILY",
        "accountCount": 3,
        "pendingTransactions": 0
      }
    ],
    "overallHealth": "HEALTHY",
    "totalConnections": 2,
    "activeConnections": 2,
    "lastSyncAt": "2026-04-11T09:30:00Z"
  }
}
```

#### POST /api/basiq/sync/schedule

Configure sync schedule for a connection.

**Request:**
```json
{
  "connectionId": "conn-uuid",
  "frequency": "DAILY",
  "preferredTime": "06:00"
}
```

#### GET /api/basiq/sync/history

Get sync history for audit purposes.

**Query Parameters:**
- `connectionId` (optional)
- `startDate` (optional)
- `endDate` (optional)
- `status` (optional)
- `limit` (default: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "job-uuid",
        "connectionName": "Commonwealth Bank",
        "jobType": "SCHEDULED_DAILY",
        "status": "COMPLETED",
        "startedAt": "2026-04-11T06:00:00Z",
        "completedAt": "2026-04-11T06:00:45Z",
        "accountsSynced": 3,
        "transactionsSynced": 47
      }
    ],
    "pagination": {
      "total": 120,
      "page": 1,
      "limit": 50
    }
  }
}
```

### Account Matching Endpoints

#### GET /api/basiq/accounts/matches

Get pending account match candidates.

**Response:**
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "id": "match-uuid",
        "basiqAccount": {
          "id": "basiq-acc-id",
          "name": "Smart Access",
          "accountNumber": "****1234",
          "bsb": "062-000",
          "balance": 5432.10,
          "institution": "Commonwealth Bank"
        },
        "suggestedMatch": {
          "id": "monitrax-acc-id",
          "name": "CBA Everyday",
          "currentBalance": 5400.00,
          "type": "TRANSACTIONAL"
        },
        "matchScore": 0.92,
        "matchReason": "Same BSB and account number suffix"
      }
    ],
    "pendingCount": 1
  }
}
```

#### POST /api/basiq/accounts/matches/:id/resolve

Resolve an account match.

**Request:**
```json
{
  "action": "merge",
  "preserveManualTransactions": true
}
```

**Actions:**
- `merge` - Merge BASIQ account into existing account
- `keep_separate` - Create as new account
- `ignore` - Dismiss the match suggestion

---

## Background Services

### Sync Scheduler Service

**File:** `lib/bank/syncScheduler.ts`

```typescript
interface SyncSchedulerConfig {
  defaultFrequency: SyncFrequency;
  maxConcurrentSyncs: number;
  retryDelayMinutes: number[];  // [5, 15, 60, 240]
  maxRetries: number;
  staleThresholdHours: number;
}

// Functions
export async function scheduleDailySync(userId: string): Promise<void>;
export async function processScheduledJobs(): Promise<SyncJobResult[]>;
export async function retryFailedJobs(): Promise<void>;
export async function checkConnectionHealth(): Promise<HealthReport>;
```

### Webhook Processor Service

**File:** `lib/bank/webhookProcessor.ts`

```typescript
interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
  signature: string;
}

// Functions
export function verifyWebhookSignature(payload: string, signature: string): boolean;
export async function processWebhookEvent(event: WebhookEvent): Promise<void>;
export async function replayFailedEvents(since: Date): Promise<number>;
```

### Enrichment Processor Service

**File:** `lib/bank/enrichmentProcessor.ts`

```typescript
interface EnrichmentResult {
  merchantNormalised: string;
  categoryLevel1: string;
  categoryLevel2?: string;
  subcategory?: string;
  isRecurring: boolean;
  confidence: number;
}

// Functions
export async function processBasiqEnrichment(
  transaction: BasiqTransaction
): Promise<EnrichmentResult>;

export async function mapAnzsicToMonitrax(
  anzsicCode: string
): Promise<CategoryMapping>;

export async function detectRecurringPattern(
  transactions: BasiqTransaction[]
): Promise<RecurringPattern[]>;
```

---

## ANZSIC Category Mapping

Map BASIQ's ANZSIC codes to Monitrax categories:

| ANZSIC Division | ANZSIC Code Range | Monitrax Category L1 | Monitrax Category L2 |
|-----------------|-------------------|---------------------|---------------------|
| Retail Trade | G (40-43) | Shopping | Retail |
| Accommodation & Food | H (44-45) | Food & Dining | Various |
| Transport | I (46-53) | Transport | Various |
| Financial Services | K (62-64) | Finance | Various |
| Rental & Real Estate | L (67) | Housing | Rent/Property |
| Professional Services | M (69-70) | Services | Professional |
| Health Care | Q (84-87) | Health | Various |
| Arts & Recreation | R (89-92) | Entertainment | Various |
| Other Services | S (94-96) | Personal | Various |

**Implementation:**

```typescript
// lib/bank/anzsicMapping.ts

interface AnzsicMapping {
  code: string;
  title: string;
  monitraxCategory: {
    level1: string;
    level2?: string;
    subcategory?: string;
  };
  isEssential: boolean;
  isTaxDeductible: boolean;
}

export const ANZSIC_MAPPINGS: Record<string, AnzsicMapping> = {
  '4110': {
    code: '4110',
    title: 'Supermarket and Grocery Stores',
    monitraxCategory: { level1: 'Food & Dining', level2: 'Groceries' },
    isEssential: true,
    isTaxDeductible: false,
  },
  '4400': {
    code: '4400',
    title: 'Accommodation',
    monitraxCategory: { level1: 'Travel', level2: 'Accommodation' },
    isEssential: false,
    isTaxDeductible: false,  // Unless for work
  },
  // ... more mappings
};
```

---

## UI Components

### Connection Health Dashboard

**Location:** `app/dashboard/settings/bank-connections/page.tsx`

**Features:**
- Overview cards showing connection health
- Last sync time and next scheduled sync
- Manual sync trigger button
- Connection settings (frequency, notifications)
- Error logs and retry options
- Re-authentication prompts

### Account Match Wizard

**Location:** `components/basiq/AccountMatchWizard.tsx`

**Steps:**
1. **Review Matches** - Show suggested account pairs
2. **Confirm Actions** - User selects merge/separate/ignore
3. **Data Preview** - Show what will happen to transactions
4. **Execute** - Perform the merge/separation
5. **Confirmation** - Show results

### Sync Status Indicator

**Location:** `components/basiq/SyncStatusIndicator.tsx`

**States:**
- Synced (green) - All connections healthy
- Syncing (blue, animated) - Sync in progress
- Attention (yellow) - Some connections need re-auth
- Error (red) - Sync failures detected

---

## Security & Compliance

### Webhook Security

1. **Signature Verification**
   - Verify HMAC-SHA256 signature on every webhook
   - Reject requests with invalid signatures
   - Log all rejected requests for monitoring

2. **Idempotency**
   - Store event IDs to prevent duplicate processing
   - Return 200 for already-processed events

3. **Rate Limiting**
   - Max 100 webhook requests per minute per IP
   - Backoff mechanism for burst traffic

### Data Handling

1. **Encryption**
   - All BASIQ credentials encrypted at rest
   - TLS 1.3 for all API communications

2. **Data Retention**
   - Webhook events retained for 90 days
   - Sync job history retained for 1 year
   - Transaction data follows user retention settings

3. **Audit Logging**
   - Log all sync operations
   - Log all account merges
   - Log all webhook events

### CDR Compliance (if applicable)

1. **Consent Management**
   - Track user consent for each connection
   - Allow easy consent withdrawal
   - Respect data deletion requests

2. **Data Minimisation**
   - Only request necessary data scopes
   - Don't store raw bank credentials

---

## Implementation Phases

### Phase 24B.1: Webhook Integration (Week 1-2)

**Tasks:**
- [ ] Create webhook endpoint with signature verification
- [ ] Implement event queue and processor
- [ ] Add webhook event logging table
- [ ] Register webhook with BASIQ
- [ ] Test with BASIQ sandbox webhooks
- [ ] Add webhook status to connection dashboard

### Phase 24B.2: Background Sync (Week 2-3)

**Tasks:**
- [ ] Create sync scheduler service
- [ ] Implement daily sync job processor
- [ ] Add sync job tracking table
- [ ] Create connection health monitoring
- [ ] Add retry logic with exponential backoff
- [ ] Create sync history API and UI

### Phase 24B.3: Enrichment Integration (Week 3-4)

**Tasks:**
- [ ] Create ANZSIC mapping table
- [ ] Implement enrichment processor
- [ ] Cache enrichment results for performance
- [ ] Update transaction import to use enrichments
- [ ] Add recurring transaction detection
- [ ] Create enrichment quality metrics

### Phase 24B.4: Account Matching (Week 4-5)

**Tasks:**
- [ ] Create account matching algorithm
- [ ] Implement match candidate detection
- [ ] Build Account Match Wizard UI
- [ ] Create merge/separate logic
- [ ] Handle historical transaction preservation
- [ ] Add conflict resolution UI

### Phase 24B.5: Production Hardening (Week 5-6)

**Tasks:**
- [ ] Implement comprehensive error handling
- [ ] Add monitoring and alerting
- [ ] Create admin dashboard for sync oversight
- [ ] Performance optimisation for large transaction volumes
- [ ] Security audit and penetration testing
- [ ] Documentation and runbooks

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Webhook delivery success | > 99.5% | Events processed / events received |
| Average sync latency | < 60 seconds | Time from BASIQ change to Monitrax update |
| Connection health | > 95% healthy | Healthy connections / total connections |
| Auto-categorisation accuracy | > 85% | Correct categories / total transactions |
| Account match precision | > 90% | Correct matches / suggested matches |
| User re-auth rate | < 5% monthly | Re-auths needed / total connections |

---

## Rollback Plan

If issues arise during deployment:

1. **Webhook Issues**
   - Disable webhook processing
   - Fall back to manual sync only
   - Queue events for later replay

2. **Sync Failures**
   - Pause background sync jobs
   - Allow manual sync only
   - Investigate and fix before resuming

3. **Enrichment Errors**
   - Fall back to existing TIE categorisation
   - Disable BASIQ enrichment processing
   - Continue with basic transaction import

---

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| BASIQ API | v3.0 | Open Banking data |
| node-cron | ^3.0.0 | Background job scheduling |
| ioredis | ^5.0.0 | Job queue (optional) |

---

## Related Documents

- [Phase 24: Open Banking Integration](./PHASE_24_OPEN_BANKING_BASIQ.md)
- [Phase 13: Transactional Intelligence](./PHASE_13_TRANSACTIONAL_INTELLIGENCE.md)
- [Phase 29: AI Transaction Categorisation](./PHASE_29_AI_TRANSACTION_CATEGORISATION.md)
- [API Standards](./07_API_STANDARDS.md)
- [Security Architecture](./10_AUTH_AND_SECURITY.md)

---

## Appendix A: BASIQ Webhook Event Reference

| Event | Description | Frequency |
|-------|-------------|-----------|
| `connection.created` | New bank connected | On user action |
| `connection.refreshed` | Data refreshed | After each sync |
| `connection.deleted` | Connection removed | On user action |
| `connection.error` | Auth or sync error | On failure |
| `account.created` | New account found | On connection/sync |
| `account.updated` | Balance changed | On sync |
| `transaction.created` | New transactions | On sync |

## Appendix B: Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `BASIQ_AUTH_EXPIRED` | Bank auth expired | Prompt user to re-authenticate |
| `BASIQ_RATE_LIMITED` | Too many requests | Backoff and retry |
| `BASIQ_UNAVAILABLE` | Service down | Queue for later |
| `WEBHOOK_INVALID_SIG` | Bad signature | Log and reject |
| `SYNC_IN_PROGRESS` | Already syncing | Skip duplicate |
| `ACCOUNT_MERGE_CONFLICT` | Data conflict | Manual resolution |

---

*Status: Planned (Pending BASIQ Approval)*
*Author: Claude Code*
*Phase: 24B*
*Blueprint Version: 3.0*
