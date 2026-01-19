# PHASE 24 — OPEN BANKING INTEGRATION (BASIQ)

**Monitrax Blueprint — Phase 24**

## Purpose

Phase 24 introduces Australian Open Banking integration via [Basiq](https://basiq.io), enabling users to:

- Connect their Australian bank accounts securely
- Automatically import account balances in real-time
- Sync transactions directly from their banks
- Eliminate manual data entry for day-to-day finances

This phase bridges the gap between manual financial tracking and automated bank feeds, making Monitrax a true real-time financial management platform.

---

## 24.1 Objectives

1. **Secure Bank Connection**
   - Users can connect any major Australian bank (CBA, NAB, ANZ, Westpac, etc.)
   - Basiq handles all bank authentication and consent securely
   - Connections use Open Banking (CDR) compliant flows

2. **Automatic Account Import**
   - Bank accounts automatically imported to Monitrax `Account` table
   - Account types mapped (transaction, savings, credit card, loan)
   - Balances updated on each sync

3. **Transaction Sync**
   - Transactions imported to `UnifiedTransaction` table
   - Integrates with Phase 13 Transactional Intelligence Engine
   - Deduplication via `basiqTransactionId`

4. **Connection Management**
   - View all connected banks
   - Refresh/sync individual connections
   - Disconnect banks when needed
   - Status tracking (active, pending, reconnect, error)

---

## 24.2 Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
├─────────────────────────────────────────────────────────────────┤
│  Accounts Page                                                   │
│  ├── Connect Bank Button → Opens Basiq Consent UI               │
│  ├── Connected Banks Panel → Shows all connections              │
│  ├── Sync Button → Triggers data refresh                        │
│  └── Disconnect → Removes bank connection                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  /api/basiq/connect      → Create Basiq user, get consent URL   │
│  /api/basiq/connections  → List user's bank connections          │
│  /api/basiq/connections/[id] → Get/delete specific connection   │
│  /api/basiq/sync         → Sync accounts & transactions         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Basiq Service Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  lib/basiq.ts                                                    │
│  ├── Token management (with caching)                            │
│  ├── User management (create/get)                               │
│  ├── Connection management                                       │
│  ├── Account fetching                                            │
│  ├── Transaction fetching                                        │
│  └── Type mapping (Basiq → Monitrax)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Basiq API (External)                         │
├─────────────────────────────────────────────────────────────────┤
│  https://au-api.basiq.io                                         │
│  ├── /token           → Authentication                          │
│  ├── /users           → User management                         │
│  ├── /users/{id}/auth_link → Consent URL generation             │
│  ├── /users/{id}/connections → Bank connections                 │
│  ├── /users/{id}/accounts → Bank accounts                       │
│  └── /users/{id}/transactions → Transaction history             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 24.3 Database Schema Changes

### User Model Additions

```prisma
model User {
  // ... existing fields ...

  // Basiq Open Banking Integration
  basiqUserId  String?  @unique  // Basiq user ID for this user

  // Relationships
  basiqConnections  BasiqConnection[]
}
```

### Account Model Additions

```prisma
model Account {
  // ... existing fields ...

  // Basiq Open Banking Integration
  basiqAccountId     String?   @unique  // Basiq account ID
  basiqConnectionId  String?             // Reference to BasiqConnection
  basiqLastSynced    DateTime?           // Last sync timestamp
  accountNumber      String?             // Masked account number
  bsb                String?             // BSB (AU banks)

  // Relationships
  basiqConnection  BasiqConnection?  @relation(...)
}
```

### New BasiqConnection Model

```prisma
enum BasiqConnectionStatus {
  ACTIVE       // Connection is active and syncing
  PENDING      // Awaiting user consent
  RECONNECT    // Needs re-authentication
  DISABLED     // User disabled this connection
  ERROR        // Connection error
}

model BasiqConnection {
  id                 String                 @id @default(uuid())
  userId             String
  basiqConnectionId  String                 @unique
  institutionId      String
  institutionName    String
  institutionLogo    String?
  status             BasiqConnectionStatus  @default(PENDING)
  lastSyncedAt       DateTime?
  lastSyncError      String?
  createdAt          DateTime               @default(now())
  updatedAt          DateTime               @updatedAt

  user      User       @relation(...)
  accounts  Account[]
}
```

### UnifiedTransaction Addition

```prisma
model UnifiedTransaction {
  // ... existing fields ...

  basiqTransactionId  String?  @unique  // For deduplication
}
```

---

## 24.4 API Endpoints

### POST /api/basiq/connect

Creates a Basiq user (if needed) and returns a consent URL.

**Request:** None (uses authenticated user's email)

**Response:**
```json
{
  "success": true,
  "data": {
    "consentUrl": "https://consent.basiq.io/...",
    "basiqUserId": "user-uuid"
  }
}
```

### GET /api/basiq/connections

Lists all bank connections for the authenticated user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "connection-uuid",
      "institutionName": "Commonwealth Bank",
      "institutionLogo": "https://...",
      "status": "ACTIVE",
      "lastSyncedAt": "2025-12-09T10:00:00Z",
      "accounts": [
        { "id": "...", "name": "Smart Access", "type": "TRANSACTIONAL", "currentBalance": 5000 }
      ]
    }
  ]
}
```

### POST /api/basiq/sync

Syncs accounts and transactions from Basiq.

**Request:**
```json
{
  "connectionId": "optional-specific-connection-id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accountsSynced": 3,
    "transactionsSynced": 150
  }
}
```

### DELETE /api/basiq/connections/[id]

Disconnects a bank connection.

---

## 24.5 UI Components

### Accounts Page Enhancements

1. **Header Actions**
   - "Connect Bank" button (opens Basiq consent flow)
   - "Add Manually" button (existing manual add)

2. **Connected Banks Panel**
   - Shows all active bank connections
   - Institution logo and name
   - Status badge (ACTIVE, PENDING, RECONNECT)
   - Last synced timestamp
   - Per-connection sync button
   - Disconnect button

3. **Account Cards**
   - Accounts from Basiq display bank logo
   - "Synced" badge for Basiq-linked accounts
   - Last synced timestamp

---

## 24.6 Setup Guide

### Prerequisites

Before using the Basiq integration, complete these steps:

#### Step 1: Create Basiq Account
1. Sign up at [Basiq Dashboard](https://dashboard.basiq.io)
2. Choose between Sandbox (testing) or Production mode
3. Complete any required verification steps

#### Step 2: Get API Credentials
1. In Basiq Dashboard, navigate to API Keys
2. Create a new API key for your application
3. Copy the API key securely (it won't be shown again)

#### Step 3: Configure Environment Variables
Add these to your `.env.local` (local development) and Vercel project settings (production):

```bash
# Basiq API Configuration
BASIQ_API_KEY="your-api-key-from-basiq-dashboard"
BASIQ_API_URL="https://au-api.basiq.io"
```

#### Step 4: Vercel Deployment
In Vercel project settings:
1. Navigate to Settings → Environment Variables
2. Add `BASIQ_API_KEY` with your production API key
3. Add `BASIQ_API_URL` with value `https://au-api.basiq.io`
4. Redeploy the application

#### Step 5: User Setup (Before Connecting Banks)
Users must have an Australian mobile number in their profile:
- Navigate to Settings → Profile
- Add mobile number in format: `0412345678` or `+61412345678`
- Mobile is required for Basiq's consent verification

### Connection Flow

When a user clicks "Connect Bank":

```
1. User clicks "Connect Bank" button
2. System checks for valid mobile number
3. Creates/retrieves Basiq user
4. Generates consent URL with bank selection
5. Opens Basiq consent UI in new window
6. User selects their bank from Australian institutions
7. User authenticates with bank credentials
8. User approves data sharing consent
9. User returns to Monitrax and clicks "Sync"
10. Accounts and transactions are imported
```

### Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Consent page shows no banks | API key not configured | Verify `BASIQ_API_KEY` in environment |
| "Mobile required" error | User profile missing mobile | Add Australian mobile to profile |
| Invalid mobile format | Non-Australian format | Use `04xxxxxxxx` or `+614xxxxxxxx` |
| Connection stuck in PENDING | User didn't complete consent | Re-open consent and complete flow |
| Sync returns no accounts | Bank not yet processed | Wait 30s and retry sync |

---

## 24.7 Security Considerations

1. **API Key Storage**
   - Never expose BASIQ_API_KEY in client-side code
   - Use server-side API routes only

2. **Token Caching**
   - Access tokens cached with expiry buffer (5 minutes before actual expiry)
   - Tokens never exposed to client

3. **User Data Isolation**
   - Each Monitrax user has their own Basiq user ID
   - Connections/accounts tied to authenticated user only

4. **CDR Compliance**
   - Basiq handles all Open Banking compliance
   - User consent managed through Basiq consent UI

---

## 24.8 Integration with Other Phases

### Feeds Into
- **Phase 13 (Transactional Intelligence):** Transactions sync to `UnifiedTransaction` with source=BANK
- **Phase 14 (Cashflow Optimisation):** Real account balances improve forecasting
- **Phase 17 (Personal CFO):** Automated spending analysis

### Requires
- Phase 10 (Auth): Uses `withAuth` middleware
- Phase 13: `UnifiedTransaction` model

---

## 24.9 Completion Criteria

- [x] Users can connect Australian banks via Basiq
- [x] Accounts automatically imported and updated
- [x] Transactions synced to UnifiedTransaction table
- [x] Connection status visible in UI
- [x] Sync/disconnect functionality working
- [x] Blueprint documentation updated
- [x] Environment variables documented
- [x] Error handling for connection failures
- [x] Deployment configuration verified and documented

---

## 24.10 Future Enhancements

1. **Automatic Scheduled Sync**
   - Background job to sync all connections daily
   - Webhook integration for real-time updates

2. **Transaction Categorisation**
   - Use Basiq enrichment data for initial categories
   - Feed into TIE learning loop

3. **Account Matching**
   - Smart matching of Basiq accounts to existing manual accounts
   - Merge duplicates

4. **Multiple Connections per Bank**
   - Support joint accounts
   - Business account connections

---

## 24.11 Implementation Notes

> **Status: IMPLEMENTED** (December 2025)

### Files Created/Modified

| File | Description |
|------|-------------|
| `lib/basiq.ts` | Basiq API service library |
| `prisma/schema.prisma` | Added Basiq fields and BasiqConnection model |
| `app/api/basiq/connect/route.ts` | Connect bank API |
| `app/api/basiq/connections/route.ts` | List connections API |
| `app/api/basiq/connections/[id]/route.ts` | Get/delete connection API |
| `app/api/basiq/sync/route.ts` | Sync accounts & transactions API |
| `app/dashboard/accounts/page.tsx` | Updated with Connect Bank UI |

### Type Mappings

| Basiq Account Type | Monitrax AccountType |
|-------------------|---------------------|
| transaction | TRANSACTIONAL |
| savings | SAVINGS |
| credit-card | CREDIT_CARD |
| mortgage | OFFSET |
| term-deposit | SAVINGS |
| loan | TRANSACTIONAL |

### API Rate Limits

Basiq API has rate limits. The implementation includes:
- Token caching to minimize auth requests
- Batch processing for transactions
- Error handling for rate limit responses

### Deployment Configuration

**Build Command (package.json):**
```json
"build": "prisma generate && prisma db push --accept-data-loss && next build"
```

**Why `prisma db push` instead of `prisma migrate deploy`:**
- The database was originally set up using `prisma db push` (no migration files exist)
- `db push` syncs schema changes directly without requiring migration history
- `--accept-data-loss` flag is needed for new unique constraints on nullable fields

**Import Paths:**
All Basiq API routes import Prisma from `@/lib/db`:
```typescript
import { prisma } from '@/lib/db';  // Correct
// NOT: import { prisma } from '@/lib/prisma';  // Wrong
```

### Deployment Issues Resolved

| Issue | Cause | Solution |
|-------|-------|----------|
| P3005 Schema not empty | `migrate deploy` with no migrations | Use `db push` instead |
| Unique constraint warning | New unique constraints on nullable fields | Add `--accept-data-loss` flag |
| Module not found | Wrong import path `@/lib/prisma` | Change to `@/lib/db` |
