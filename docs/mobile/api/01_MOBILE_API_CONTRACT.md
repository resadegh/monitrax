# Mobile API Contract

**Date:** 2026-04-11 | **Version:** 1.0 | **Status:** ACTIVE
**Blueprint Ref:** `docs/mobile/blueprint/PHASE_15_MOBILE_COMPANION_APP.md` §7
**Shared API Standards:** `docs/architecture/07_API_STANDARDS.md`

---

## 1. OVERVIEW

All mobile endpoints live under `/api/v1/mobile/` and follow the universal response envelope:

```json
{
  "success": true,
  "data": {},
  "error": null | { "code": "string", "message": "string", "details": null },
  "meta": { "timestamp": "ISO8601", "durationMs": 42 }
}
```

**Design principles:**
- Endpoints are **projections** of canonical services — no new business logic
- All inputs validated via **Zod schemas**
- All endpoints use **`withPermission()`** guards (never bare `withAuth()`)
- CDR data endpoints additionally use **`withActiveConsent()`** guard
- Max payload **<200kb**; P95 latency **<150ms**
- Entity IDs follow GRDCS format: `{module}-{uuid}`

---

## 2. ENDPOINT INVENTORY

| Method | Path | Auth Guard | Max Payload | Sprint |
|--------|------|-----------|-------------|--------|
| `GET` | `/api/v1/mobile/snapshot` | `withPermission('snapshot.read')` | <50kb | 1 |
| `GET` | `/api/v1/mobile/transactions` | `withPermission('transaction.read')` | <100kb | 2 |
| `GET` | `/api/v1/mobile/insights` | `withPermission('insight.read')` | <20kb | 4 |
| `GET` | `/api/v1/mobile/cashflow-forecast` | `withPermission('cashflow.read')` | <10kb | 3 |
| `GET` | `/api/v1/mobile/accounts` | `withPermission('account.read')` | <15kb | 1 |
| `GET` | `/api/v1/mobile/categories` | `withPermission('category.read')` | <10kb | 1 |
| `POST` | `/api/v1/mobile/expense` | `withPermission('expense.write')` | — | 2 |
| `POST` | `/api/v1/mobile/income` | `withPermission('income.write')` | — | 2 |
| `PATCH` | `/api/v1/mobile/transaction/{id}/categorize` | `withPermission('transaction.write')` | — | 2 |
| `POST` | `/api/v1/mobile/document/upload` | `withPermission('document.write')` | Multipart | 5 |
| `POST` | `/api/v1/mobile/sync` | `withPermission('snapshot.read')` | <5kb req | 2 |
| `POST` | `/api/v1/mobile/device/register` | `withPermission('user.read')` | — | 0 |
| `DELETE` | `/api/v1/mobile/device/{token}` | `withPermission('user.write')` | — | 0 |

---

## 3. SNAPSHOT ENDPOINT

`GET /api/v1/mobile/snapshot`

**Source:** Projection of `getMasterFinancialSnapshot()` from `lib/services/masterFinancialService.ts`

**Response: `MobileSnapshot`**

```typescript
interface MobileSnapshot {
  netWorth: {
    total: number;
    previousMonth: number;
    changePercent: number;
  };
  healthScore: {
    score: number;              // 0-100
    grade: string;              // A-F
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    topCategories: Array<{ name: string; score: number }>;  // Top 3 weakest
  };
  cashflow: {
    monthlySurplus: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    monthlyLoanRepayments: number;
  };
  spending: {
    todayTotal: number;
    dailyAverage: number;
    weekTotal: number;
    weeklyAverage: number;
  };
  accounts: Array<{
    id: string;
    name: string;
    institution: string;
    type: AccountType;
    balance: number;
    lastSynced: string | null;
  }>;
  topInsights: Array<{          // Max 3, Critical + High only
    id: string;
    severity: 'critical' | 'high';
    title: string;
    description: string;
    actionLabel: string;
    actionType: 'deep_link' | 'quick_action' | 'dismiss';
    actionTarget: string;
  }>;
  budgetVariance: {
    status: 'under' | 'over' | 'on_track';
    variancePercent: number;
  };
  lastUpdated: string;
}
```

---

## 4. TRANSACTIONS ENDPOINT

`GET /api/v1/mobile/transactions?since={ISO8601}&limit={number}&offset={number}`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `since` | ISO8601 | (none) | Delta sync: only return rows modified after this |
| `limit` | number | 50 | Page size (max 100) |
| `offset` | number | 0 | Pagination offset |
| `category` | string | (none) | Filter by category |
| `direction` | `IN` / `OUT` | (none) | Filter by direction |
| `search` | string | (none) | Merchant name search |

**Response: `MobileTransactionResponse`**

```typescript
interface MobileTransactionResponse {
  transactions: Array<{
    id: string;
    merchantName: string;
    merchantOriginal: string;
    amount: number;
    direction: 'IN' | 'OUT';
    category: string | null;
    categoryConfidence: number;
    date: string;
    accountId: string;
    accountName: string;
    isRecurring: boolean;
    recurringPaymentId: string | null;
    linkedExpenseId: string | null;
    source: 'MANUAL' | 'BANK' | 'IMPORT';
    updatedAt: string;
  }>;
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  syncTimestamp: string;
}
```

---

## 5. SYNC ENDPOINT

`POST /api/v1/mobile/sync`

**Request: `SyncRequest`**

```typescript
interface SyncRequest {
  lastSyncTimestamp: string;
  pendingWrites: Array<{
    type: 'expense' | 'income';
    tempId: string;
    data: Record<string, any>;
    createdAt: string;
  }>;
  deviceInfo: { platform: 'ios' | 'android'; appVersion: string; osVersion: string };
}
```

**Response: `SyncResponse`**

```typescript
interface SyncResponse {
  snapshot: MobileSnapshot;
  newTransactions: MobileTransactionResponse['transactions'];
  resolvedWrites: Array<{
    tempId: string;
    serverId: string;
    status: 'created' | 'conflict' | 'duplicate';
  }>;
  deletedEntities: Array<{ type: string; id: string }>;
  syncTimestamp: string;
}
```

---

## 6. VERSIONING POLICY

| Rule | Detail |
|------|--------|
| Breaking changes | New version prefix: `/api/v2/mobile/*` |
| Non-breaking changes | Add fields additively to existing responses |
| Deprecation | Old version supported for minimum 90 days after new version ships |
| Version header | Also accept `X-API-Version: 1` header as alternative to URL prefix |
| Mobile app support | Backend must support the last 3 mobile app versions simultaneously |

> **Full TypeScript interfaces:** See Blueprint §7 for all remaining endpoint details.
