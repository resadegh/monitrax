# PHASE 15 — MOBILE COMPANION APP
**Monitrax Blueprint — Phase 15**
**Version:** v2.0
**Status:** Ready for Development
**Last Updated:** 2025-12-19
**Original:** 2025-11-XX

---

## Purpose
Deliver a lightweight, fast, and precision-scoped mobile experience that focuses on **daily financial clarity**, **real-time alerts**, **quick actions**, and **portable insights**—without replicating the full complexity of the web dashboard.

The goal:
### "A pocket-sized Monitrax that keeps you financially sharp on the move."

This is *not* a mobile clone — it is a **companion**.

---

## Document Revision History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2025-11 | Original Phase 15 specification |
| v2.0 | 2025-12-19 | Major update incorporating Phases 17, 24, 26-31 features |

---

# 15.1 Objectives

1. **Design a mobile architecture separate from the web app**
   - Clean, minimal, high-performance
   - Offline-friendly data model
   - Native interaction patterns

2. **Provide the core functions users need on-the-go**
   - **Cashflow Intelligence Center** (Phase 31) - Health scores, money leaks, AI insights
   - **Personal CFO Dashboard** (Phase 17) - CFO score, risk radar, prioritised actions
   - Transaction feed with smart categorisation (Phase 13)
   - Cashflow forecast and alerts (Phase 14)
   - **Open Banking sync status** (Phase 24)
   - **Document capture & smart scanning** (Phase 26)

3. **Integrate with backend using optimised endpoints**
   - Reduced payload versions of the APIs
   - Snapshot "lite mode" with essential metrics
   - Incremental delta sync (70%+ bandwidth reduction)
   - **Compressed intelligence endpoints** (< 200kb)

4. **Deep integration with AI-powered insights**
   - **Gemini AI summaries** (Phase 27) - Natural language cashflow insights
   - **Money leak alerts** with transaction drill-down
   - **AI budget recommendations** (Phase 28)
   - Real-time push notifications
   - Daily financial "digest"

5. **Build a unified interaction system with CMNF**
   - Mobile-friendly navigation version
   - Entity drill-down with GRDCS links
   - Context restoration
   - "Continue on desktop" deep-link sharing

6. **Deliver a best-in-class UX**
   - Zero clutter
   - Touch-first interface
   - Haptic feedback on financial events
   - < 750ms startup time

---

# 15.2 Mobile App Strategy

## 15.2.1 Platform Choice
Phase 15 recommends:

### **React Native + Expo**
- Rapid development
- Shared libraries with web (TypeScript, Zod validation)
- OTA (over-the-air) updates
- Great ecosystem
- Perfect fit with Next.js backend
- Native biometric authentication (Face ID, Touch ID)

Long-term optional:
- Native Swift/Kotlin versions (Phase 18, if required)

---

# 15.3 Feature Scope

## 15.3.1 Home Screen — "Cashflow Intelligence Center" (Phase 31)

The home screen brings the Phase 31 Cashflow Intelligence Center to mobile:

### Primary Display:
- **Unified Health Score** (0-100) with gauge visualisation
  - Liquidity (25%), Cashflow Stability (25%), Forecast Risk (20%), Budget Adherence (15%), Debt Health (15%)
  - Color-coded tiers: Excellent (green), Good (lime), Moderate (yellow), Concerning (orange), Critical (red)
- **AI Summary** - Gemini-powered natural language insight (cached, regenerate on demand)
- **7-day cashflow forecast** - Compact curve with confidence band
- **Quick stats grid** - Current balance, monthly income, monthly expenses, net cashflow

### Secondary Display (Scrollable):
- **Money Leak Detector** - Top 3 spending leaks with transaction drill-down links
- **Budget vs Actual** - Progress bars for key spending categories
- **Smart Actions** - Top 3 prioritised actions for this week

### Behaviour:
- Pull-to-refresh
- Auto-refresh every 30 minutes
- Offline cached state with stale indicator
- Haptic feedback on health score changes

---

## 15.3.2 Personal CFO Dashboard (Phase 17)

Dedicated screen for CFO intelligence:

### CFO Score Display:
- **Score Circle** with grade (A-F) and trend indicator
- **Component breakdown** with progress bars:
  - Cashflow Strength (25%)
  - Debt Coverage (20%)
  - Emergency Buffer (15%)
  - Investment Diversification (15%)
  - Spending Control (15%)
  - Savings Rate (10%)

### Risk Radar:
- Short-term risks (low balance, cashflow shortfall, expense spike)
- Medium-term risks (debt ratio, savings trajectory, property underperformance)
- Long-term risks (concentration risk, mortgage renewal)
- Severity indicators (LOW/MODERATE/HIGH/CRITICAL)

### Prioritised Actions (Tabbed):
- **Do Now** - Critical/high severity with impact > $500
- **Upcoming** - High severity or medium with impact > $1000
- **Consider Soon** - Medium severity
- **Background** - Low severity optimisations

---

## 15.3.3 Transaction Feed (Enhanced with Phase 13, 18, 29)

Powered by Transaction Intelligence Engine with new enhancements:

### Features:
- **Smart grouping** by date and merchant
- **Recurring vs One-off badges** (Phase 29)
  - Blue badge: "Recurring"
  - Purple badge: "One-off"
- **Essential expense indicator**
- **Transfer detection** - Excluded from income/expense totals
- **Subscription detection badges** with price increase alerts
- **AI-assisted categorisation** with confidence scores
- **Swipe gestures**:
  - Swipe right → Quick categorise
  - Swipe left → Mark as transfer/dismiss
- **"Explain this transaction"** - AI annotation on demand
- **Category-based suggestions** - Pre-fill based on predicted category
- **Merchant enrichment** with standardised names

### Account Filtering:
- Account selector at top (from Phase 24 Basiq)
- Filter by specific bank account
- "All Accounts" option
- Clear filter button

### Transaction Linking (Phase 29):
- Link detected recurring payments to tracked expenses
- Show match confidence (High/Medium/Low)
- Quick action: "Create Expense" from recurring payment
- "Bank Detected" badge on linked expenses

---

## 15.3.4 Cashflow Dashboard (Phase 14 + 31)

Compact view combining Phase 14 Cashflow Optimisation with Phase 31 Intelligence:

### Shows:
- **Waterfall Chart** - Visual money flow from income through expenses to surplus/deficit
- **Next 14-day cash position** with emergency buffer threshold
- **Recurring charges timeline** - Upcoming bills and subscriptions
- **Break-even day indicator** - When monthly income catches expenses
- **Forecast confidence meter** with volatility index
- **Tax optimisation summary** - Estimated savings from deductions

### Actions:
- "View full forecast" → Opens 90-day chart
- "Stress test" → Quick scenario selector (income drop, expense shock)
- Tap any category → Drill down to transactions

---

## 15.3.5 Open Banking Hub (Phase 24)

New screen for managing bank connections:

### Features:
- **Connected Banks Panel**
  - Institution logo and name
  - Status badge (ACTIVE, PENDING, RECONNECT, ERROR)
  - Last synced timestamp
  - Account summary (count, total balance)
- **Per-connection sync button** with progress indicator
- **"Connect New Bank"** button → Opens Basiq consent flow
- **Disconnect option** with confirmation

### Account Cards:
- Bank logo for Basiq-linked accounts
- "Synced" badge with timestamp
- Balance with source indicator (MANUAL, IMPORT, BASIQ)

### Sync Status:
- Background sync indicator
- "Sync Now" button
- Last sync time with relative timestamp ("5 min ago")

---

## 15.3.6 Smart Document Capture (Phase 26)

Mobile-optimised document intelligence:

### Camera Integration:
- **Receipt Scan** - Capture receipt with camera
- **Invoice Scan** - Multi-page PDF support
- **Bill Scan** - Utility bills, rate notices

### AI Processing (Gemini Vision):
- Real-time OCR with progress indicator
- **Auto-field extraction**:
  - Vendor name (with ABN validation)
  - Amount and GST
  - Date (Australian DD/MM/YYYY format)
  - Category inference (Bunnings → MAINTENANCE)
- **Confidence indicators** per field (green/yellow/red)
- **Form auto-fill** - Pre-populate expense form

### Quick Actions:
- "Create Expense" with pre-filled data
- "Save for later" - Store document only
- "Link to property" - Associate with investment property

---

## 15.3.7 Budget Intelligence (Phase 28)

AI-powered budget tracking:

### Budget Overview:
- **Recurring expenses total** (tracked manually)
- **Variable expenses estimate** (AI-generated)
- **Total realistic budget** = Recurring + Variable

### Scenario Cards (3 options):
- **Minimum** - Bare essentials
- **Recommended** - Balanced lifestyle
- **Comfortable** - Quality of life

### Category Breakdown:
- Visual bars for each category
- Tap to adjust individual estimates
- AI confidence indicators

### Integration:
- Shows impact on debt planning
- Links to available extra payment capacity

---

## 15.3.8 Insights & Alerts Hub

Real-time delivery of intelligence from multiple engines:

### Alert Types:
- **Money Leaks** (Phase 31) - Subscription waste, category overspending
- **Cashflow Risks** (Phase 14) - Shortfall warnings, low balance predictions
- **CFO Alerts** (Phase 17) - Risk radar triggers, action reminders
- **Budget Alerts** (Phase 28) - Overspending by category
- **Recurring Payment Detection** (Phase 29) - New subscriptions, price increases
- **Bank Connection Issues** (Phase 24) - Reconnect required

### Alert Actions:
- Save insight for later
- Dismiss (with optional reason)
- Mark as resolved
- **"View Details"** - Navigate to relevant entity/transactions
- **"Learn How"** - Educational content

### Notification Preferences:
- Per-category toggle
- Quiet hours setting
- Critical-only mode

---

## 15.3.9 Notifications & Background Activity

When enabled:
- Push alerts from all intelligence engines
- Silent background sync (every 30 minutes)
- **Morning "Daily Digest"** - AI-generated summary
- **Weekly summary** - Net worth change, key metrics

### Mobile-specific insights include:
- "You're trending higher in spending this week"
- "Shortfall expected in 3 days"
- "Recurring charge detected: Netflix $22.99/mo"
- "Loan repayment due tomorrow"
- "Money leak detected: 3 unused subscriptions ($85/mo)"
- "Your cashflow health score improved to 75"
- "Bank connection needs attention: CBA"

---

# 15.4 Architecture

## 15.4.1 Offline-First Cache Layer

Stores:
- Last snapshot (lite mode < 200kb)
- Cached transactions (last 90 days)
- Cached insights and alerts
- Cached forecast segments
- User preferences
- **Cashflow intelligence data** (Phase 31)
- **CFO score and actions** (Phase 17)
- **Budget analysis results** (Phase 28)

Technology:
- **SQLite via Expo** (expo-sqlite)
- Minimal tables optimised for mobile
- Smart prefetch strategy
- Delta sync with hash-based change detection

### Mobile SQLite Schema:

```sql
-- Core cache
CREATE TABLE cached_snapshot (
  id TEXT PRIMARY KEY,
  data JSON,
  timestamp DATETIME,
  dataHash TEXT
);

CREATE TABLE cached_entities (
  id TEXT PRIMARY KEY,
  type TEXT,  -- 'transaction', 'expense', 'loan', etc.
  data JSON,
  timestamp DATETIME
);

-- Intelligence cache (Phase 31)
CREATE TABLE cached_intelligence (
  id TEXT PRIMARY KEY DEFAULT 'current',
  healthScore JSON,
  forecast JSON,
  leaks JSON,
  waterfall JSON,
  smartActions JSON,
  dataHash TEXT,
  timestamp DATETIME
);

-- CFO cache (Phase 17)
CREATE TABLE cached_cfo (
  id TEXT PRIMARY KEY DEFAULT 'current',
  cfoScore INTEGER,
  grade TEXT,
  components JSON,
  risks JSON,
  actions JSON,
  timestamp DATETIME
);

-- Sync queue for offline actions
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT,  -- 'categorise', 'create_expense', 'dismiss_insight'
  entityType TEXT,
  entityId TEXT,
  payload JSON,
  synced BOOLEAN DEFAULT FALSE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  type TEXT,
  severity TEXT,
  title TEXT,
  body TEXT,
  data JSON,
  read BOOLEAN DEFAULT FALSE,
  timestamp DATETIME
);

-- Indexes
CREATE INDEX idx_entities_type ON cached_entities(type);
CREATE INDEX idx_sync_synced ON sync_queue(synced);
CREATE INDEX idx_notifications_read ON notifications(read);
```

---

## 15.4.2 API Optimisation for Mobile

Mobile endpoints return "compressed" datasets:

### New Mobile-Specific Endpoints:

| Endpoint | Method | Description | Max Size |
|----------|--------|-------------|----------|
| `/api/mobile/snapshot` | GET | Compressed portfolio snapshot | < 100kb |
| `/api/mobile/intelligence` | GET | Cashflow intelligence (Phase 31) | < 150kb |
| `/api/mobile/cfo` | GET | CFO score + top actions | < 50kb |
| `/api/mobile/transactions` | GET | Transaction feed with pagination | < 100kb |
| `/api/mobile/insights` | GET | Active insights digest | < 50kb |
| `/api/mobile/forecast` | GET | 14-day compact forecast | < 30kb |
| `/api/mobile/sync` | POST | Delta sync with hash comparison | Variable |

### Requirements:
- Max payload < 200kb per request
- Latency < 150ms (p95)
- Delta sync supported (send only changed data)
- No heavy nested structures
- Pagination for large datasets (50 items per page)
- ETags for cache validation

### Delta Sync Protocol:

```typescript
// Client sends current data hashes
POST /api/mobile/sync
{
  "hashes": {
    "snapshot": "abc123",
    "transactions": "def456",
    "intelligence": "ghi789",
    "cfo": "jkl012"
  },
  "lastSyncAt": "2025-12-19T10:00:00Z"
}

// Server responds with only changed data
{
  "changed": ["intelligence", "transactions"],
  "data": {
    "intelligence": { ... },  // Full data for changed sections
    "transactions": { ... }
  },
  "unchanged": ["snapshot", "cfo"],
  "newHashes": {
    "snapshot": "abc123",
    "transactions": "xyz999",
    "intelligence": "uvw888",
    "cfo": "jkl012"
  }
}
```

---

## 15.4.3 Push Notification Infrastructure

### Technology:
- **Firebase Cloud Messaging (FCM)** for cross-platform delivery
- **APNs** for iOS-specific features
- **Expo Push Notifications** for simplified management

### Notification Types:

| Type | Priority | Sound | Badge |
|------|----------|-------|-------|
| Critical Alert | High | Yes | Yes |
| Money Leak Detected | Default | Yes | Yes |
| Cashflow Warning | Default | Optional | Yes |
| Daily Digest | Low | No | No |
| Sync Complete | Low | No | No |

### Backend Integration:

```typescript
// Insights Engine triggers
interface MobileNotification {
  type: 'insight' | 'alert' | 'digest' | 'system';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  body: string;
  data: {
    entityType?: string;
    entityId?: string;
    deepLink?: string;  // e.g., "/transactions/tx_123"
    actionType?: string;
  };
}
```

---

# 15.5 CMNF (Cross-Module Navigation Framework) Mobile Edition

Mobile CMNF is a simplified version of the web CMNF.

### Supports:
- **Entity drill-down** with GRDCS links
- Quick navigation between related items
- **Breadcrumb-less navigation** (back gesture instead)
- Contextual back behaviour with state restoration
- **"Continue on desktop"** deep-link sharing

### Navigation Patterns:

```
Home → Transaction → Linked Expense → Property → Back (×3) → Home

Home → CFO Dashboard → Risk Detail → Action → Mark Complete → Back → Home

Home → Document Scan → Create Expense → Link to Property → Save → Home
```

### Deep Link Schema:

```
monitrax://transactions/{id}
monitrax://expenses/{id}
monitrax://properties/{id}
monitrax://loans/{id}
monitrax://cfo
monitrax://intelligence
monitrax://insights/{id}
```

---

# 15.6 UX Principles for Mobile

1. **Minimal cognitive load**
   Every screen must have one primary purpose.

2. **One-thumb navigation**
   All core actions reachable with thumb. Bottom tab bar for primary navigation.

3. **Light on data, heavy on clarity**
   Information density reduced by ~50% from web.

4. **Smart defaults**
   Pre-fill forms with AI suggestions. Show recommended actions first.

5. **Haptic feedback**
   - Light tap: Action confirmed
   - Success: Money received, positive balance
   - Warning: Approaching limit, low balance
   - Error: Failed action, critical alert

6. **Predictable gestures**
   - Swipe right = Categorise transaction
   - Swipe left = Dismiss / Mark as transfer
   - Long press = More options / Context menu
   - Tap = Drill down / Select
   - Pull down = Refresh

7. **Fast startup time**
   < 750ms target to interactive

8. **Offline-first**
   Show cached data immediately, sync in background

---

# 15.7 Integration With Other Phases

### Depends On:
- **Phase 08** (GRDCS & entity linking) - Navigation and relationships
- **Phase 09** (Health + Navigation Intelligence) - CMNF framework
- **Phase 10** (Auth & Security) - JWT, biometrics, session management
- **Phase 13** (Transactional Intelligence) - Transaction categorisation, recurring detection
- **Phase 14** (Cashflow Optimisation) - Forecast engine, stress testing
- **Phase 17** (Personal CFO Engine) - CFO score, risk radar, actions
- **Phase 24** (Open Banking - Basiq) - Bank connections, real-time sync
- **Phase 26** (Document Intelligence) - Smart scanning, OCR, form auto-fill
- **Phase 27** (Gemini AI Migration) - AI summaries, natural language insights
- **Phase 28** (AI-Powered Budget) - Household profile, variable expense estimation
- **Phase 29** (Recurring Expense Linking) - Match bank transactions to expenses
- **Phase 31** (Cashflow Intelligence Center) - Health score, leaks, waterfall

### Feeds Into:
- Phase 18 (Native Mobile - Optional future Swift/Kotlin versions)

---

# 15.8 Authentication & Security

## 15.8.1 Authentication Methods (Phase 10)

### Supported on Mobile:
- **Email/Password** with secure storage (Keychain/Keystore)
- **Magic Link** - Email deep link opens app directly
- **OAuth 2.0** - Google, Apple Sign In, Facebook, Microsoft
- **Biometric Unlock** - Face ID, Touch ID, Android Biometrics
- **Passkeys (WebAuthn)** - Device-based passwordless login

### Session Management:
- JWT tokens stored in secure storage
- 7-day session expiry with refresh
- Device fingerprinting
- Concurrent session support
- Remote session revocation

### Security Features:
- Certificate pinning for API calls
- Jailbreak/root detection
- Screenshot prevention on sensitive screens
- Automatic session lock after inactivity

---

# 15.9 Acceptance Criteria

### Functional
- Displays Cashflow Intelligence Center instantly (< 1s)
- Shows CFO score and top 3 actions within 1 second of launch
- Offline mode works with cached data (stale indicator shown)
- Transaction categorisation via gestures (< 200ms response)
- Notifications delivered reliably (< 3s from trigger)
- Document scanning works with real-time OCR feedback
- Open Banking sync initiates and shows progress

### Technical
- Mobile snapshot endpoint < 100kb payload
- Mobile intelligence endpoint < 150kb payload
- Delta sync reduces bandwidth by ≥ 70%
- CMNF Mobile navigation responds < 50ms
- Biometric auth completes < 500ms
- Push notifications registered on first launch

### Performance
- Cold start < 2 seconds
- Warm start < 750ms
- Scroll frame rate ≥ 60fps
- API calls cached with 5-minute TTL
- Background sync completes in < 30 seconds

### UX
- User can view entire financial life in < 15 seconds
- No clutter, no overwhelm
- All critical information accessible in 3 taps max
- Gesture actions provide immediate visual feedback
- Error states have clear recovery actions

---

# 15.10 Deliverables

### Core App
- React Native + Expo project structure
- Bottom tab navigation (Home, Transactions, CFO, Scan, More)
- Biometric authentication integration

### Screens
- **Cashflow Intelligence Center** (Home)
- **Personal CFO Dashboard**
- **Transaction Feed** with filtering and gestures
- **Cashflow Forecast** (compact)
- **Open Banking Hub**
- **Document Scanner** with OCR
- **Insights & Alerts** hub
- **Settings & Preferences**

### Infrastructure
- **Mobile-optimised API endpoints** (/api/mobile/*)
- **Push notification service** (FCM integration)
- **Offline cache layer** (SQLite)
- **Delta sync service**
- **Deep link handler**

### Documentation
- API endpoint specifications
- SQLite schema documentation
- Push notification payload formats
- Deep link schema

---

# 15.11 Mobile API Endpoint Specifications

## 15.11.1 GET /api/mobile/snapshot

Returns compressed portfolio snapshot for home screen.

**Response:**
```json
{
  "success": true,
  "data": {
    "netWorth": 450000,
    "totalAssets": 800000,
    "totalLiabilities": 350000,
    "liquidCash": 45000,
    "monthlyIncome": 12000,
    "monthlyExpenses": 8500,
    "monthlyCashflow": 3500,
    "savingsRate": 29.2,
    "portfolioLVR": 43.75,
    "accountsCount": 5,
    "propertiesCount": 2,
    "loansCount": 3
  },
  "hash": "abc123def456",
  "generatedAt": "2025-12-19T10:00:00Z"
}
```

## 15.11.2 GET /api/mobile/intelligence

Returns Cashflow Intelligence Center data (Phase 31).

**Response:**
```json
{
  "success": true,
  "data": {
    "healthScore": {
      "overall": 72,
      "tier": "GOOD",
      "breakdown": [
        { "category": "Liquidity", "score": 80, "weight": 0.25 },
        { "category": "Cashflow Stability", "score": 75, "weight": 0.25 },
        { "category": "Forecast Risk", "score": 65, "weight": 0.20 },
        { "category": "Budget Adherence", "score": 70, "weight": 0.15 },
        { "category": "Debt Health", "score": 68, "weight": 0.15 }
      ]
    },
    "aiSummary": {
      "content": "Your finances are in good shape this month...",
      "keyInsights": ["Strong liquidity", "Watch dining spending"],
      "isStale": false
    },
    "topLeaks": [
      {
        "category": "Subscriptions",
        "amount": 85,
        "transactionCount": 3,
        "severity": "MEDIUM"
      }
    ],
    "forecast7Day": {
      "startBalance": 15000,
      "endBalance": 12500,
      "lowestPoint": 11000,
      "lowestDate": "2025-12-23"
    },
    "smartActions": [
      {
        "priority": "do_now",
        "title": "Review 3 unused subscriptions",
        "impact": 85,
        "deepLink": "monitrax://insights/leak_sub_001"
      }
    ]
  },
  "hash": "ghi789jkl012",
  "generatedAt": "2025-12-19T10:00:00Z"
}
```

## 15.11.3 GET /api/mobile/cfo

Returns Personal CFO dashboard data (Phase 17).

**Response:**
```json
{
  "success": true,
  "data": {
    "score": {
      "value": 73,
      "grade": "B",
      "trend": "up",
      "trendValue": 3
    },
    "components": [
      { "name": "Cashflow Strength", "score": 78, "weight": 25 },
      { "name": "Debt Coverage", "score": 70, "weight": 20 },
      { "name": "Emergency Buffer", "score": 65, "weight": 15 },
      { "name": "Investment Diversification", "score": 80, "weight": 15 },
      { "name": "Spending Control", "score": 72, "weight": 15 },
      { "name": "Savings Rate", "score": 68, "weight": 10 }
    ],
    "topRisks": [
      {
        "type": "cashflow_shortfall",
        "severity": "MEDIUM",
        "horizon": "short_term",
        "description": "Potential shortfall in 2 weeks"
      }
    ],
    "topActions": [
      {
        "priority": "do_now",
        "title": "Transfer $500 to offset account",
        "impact": 150,
        "estimatedTime": "2 min"
      },
      {
        "priority": "upcoming",
        "title": "Review insurance renewal",
        "deadline": "2025-12-25"
      }
    ]
  },
  "hash": "mno345pqr678",
  "generatedAt": "2025-12-19T10:00:00Z"
}
```

## 15.11.4 GET /api/mobile/transactions

Returns paginated transaction feed.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50, max: 100)
- `accountId` (optional filter)
- `since` (ISO date, for delta sync)

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "tx_001",
        "date": "2025-12-19",
        "description": "WOOLWORTHS",
        "merchantStandardised": "Woolworths",
        "amount": 125.50,
        "direction": "OUT",
        "category": "Groceries",
        "isRecurring": false,
        "isEssential": true,
        "isTransfer": false,
        "linkedExpenseId": null,
        "accountName": "CBA Smart Access"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 234,
      "hasMore": true
    }
  },
  "hash": "stu901vwx234"
}
```

---

# 15.12 Implementation Roadmap

## Sprint 1: Foundation (Week 1-2)
- [ ] Expo project setup with TypeScript
- [ ] Navigation structure (React Navigation)
- [ ] Authentication integration (JWT + biometrics)
- [ ] SQLite cache layer setup
- [ ] API client with caching

## Sprint 2: Home Screen (Week 3-4)
- [ ] Mobile snapshot endpoint
- [ ] Mobile intelligence endpoint
- [ ] Cashflow Intelligence Center UI
- [ ] Health score gauge component
- [ ] AI summary display

## Sprint 3: Transaction Feed (Week 5-6)
- [ ] Mobile transactions endpoint
- [ ] Transaction list with virtualisation
- [ ] Swipe gesture implementation
- [ ] Account filter selector
- [ ] Category assignment flow

## Sprint 4: CFO Dashboard (Week 7-8)
- [ ] Mobile CFO endpoint
- [ ] CFO score display
- [ ] Risk radar component
- [ ] Actions list with tabs
- [ ] Action detail screen

## Sprint 5: Document Scanner (Week 9-10)
- [ ] Camera integration
- [ ] Document capture UI
- [ ] OCR progress display
- [ ] Form auto-fill flow
- [ ] Expense creation from scan

## Sprint 6: Open Banking & Notifications (Week 11-12)
- [ ] Bank connections screen
- [ ] Sync status display
- [ ] Push notification registration
- [ ] Notification handlers
- [ ] Daily digest generation

## Sprint 7: Polish & Testing (Week 13-14)
- [ ] Performance optimisation
- [ ] Offline mode testing
- [ ] Accessibility audit
- [ ] Beta testing
- [ ] App store preparation

---

# 15.13 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily Active Users | 60% of web users | Analytics |
| Session Duration | > 2 minutes | Analytics |
| Startup Time | < 750ms | Performance monitoring |
| Crash-Free Rate | > 99.5% | Crash reporting |
| API Response Time | < 150ms (p95) | Server monitoring |
| Offline Usage | > 20% of sessions | Analytics |
| Push Notification Open Rate | > 15% | FCM analytics |
| App Store Rating | > 4.5 stars | Store reviews |
| User Retention (Day 7) | > 50% | Analytics |
| User Retention (Day 30) | > 30% | Analytics |

---

# 15.14 Risk Mitigation

| Risk | Mitigation |
|------|------------|
| API latency on mobile networks | Aggressive caching, delta sync, offline support |
| Large data payloads | Compression, pagination, mobile-specific endpoints |
| Battery drain | Background sync limits, efficient polling |
| Device fragmentation | Expo's cross-platform abstraction |
| App store rejection | Early compliance review, privacy documentation |
| Push notification opt-out | In-app alternatives, daily digest fallback |

---

# 15.15 Future Enhancements (Post-MVP)

1. **Apple Watch / Wear OS companion** - Quick glance at health score and alerts
2. **Widgets** - Home screen widgets for balance and health score
3. **Siri / Google Assistant** - Voice commands for quick queries
4. **Share extensions** - Capture receipts from photo library
5. **iCloud / Google Drive backup** - Cross-device data sync
6. **Multi-user support** - Household member access
7. **AR receipt scanning** - Enhanced document capture

---

**END OF PHASE 15 v2.0**

*This document incorporates all features from Phases 13, 14, 17, 24, 26-31 as of December 2025.*
