# PHASE 15 — MOBILE COMPANION APP

**Version:** 2.1
**Created:** 2025-10-15
**Updated:** 2026-05-11
**Status:** Approved — Ready for Implementation
**Depends On:** Phase 08 (GRDCS), Phase 09 (Health + Navigation), Phase 10 (Auth & Security), Phase 13 (Transactional Intelligence), Phase 14 (Cashflow Optimisation), Phase 24 (Basiq Open Banking), Phase 35 (CDR Data Lifecycle)
**Feeds Into:** Phase 17 (Personal CFO Engine), Phase 32 (Enterprise Portal)
**CDR Requirement Ref:** Basiq Accreditation §4 (Device Security), §5.4–5.6 (CDR Data Handling on Mobile)

---

## 1. PURPOSE

Deliver a lightweight, fast, and precision-scoped native mobile experience for iOS and Android that focuses on **daily financial clarity**, **real-time alerts**, **quick actions**, and **portable insights** — without replicating the full complexity of the web dashboard.

### "A pocket-sized Monitrax that keeps you financially sharp on the move."

This is **not** a mobile clone — it is a **companion**.

The web app is the **workbench** — where users configure their financial universe, run deep analysis, manage documents, and make strategic decisions. The mobile app is the **pulse** — the thing checked every morning, glanced at during lunch, and that sends a push notification when something matters.

### 1.1 Why a Native App (Not a PWA)

Phase 14.5 (COMPLETE) already delivers a responsive mobile web experience with collapsible sidebar, touch-friendly targets, and mobile-optimised forms. A Progressive Web App (PWA) was evaluated and rejected for these reasons:

| Capability | PWA | Native (React Native) |
|------------|-----|----------------------|
| Push notifications (iOS) | Limited — requires Safari 16.4+, unreliable | Full APNs support via FCM |
| Biometric authentication | Web Authn only — inconsistent UX | Native Face ID / fingerprint via Keychain |
| Background sync | Service Worker — killed by OS after ~5 min | Background fetch with OS-level scheduling |
| Offline SQLite | Not available | Full SQLite via Expo |
| App Store presence | No | Yes — discoverability + trust signal |
| Haptic feedback | Very limited | Full Haptic Engine access |
| Widgets (iOS/Android home screen) | Not possible | Native widget APIs |
| Performance | JavaScript thread + browser overhead | Hermes engine + native bridge |

### 1.2 What This Phase Does NOT Cover

| Topic | Existing Document |
|-------|------------------|
| Responsive web layout | `PHASE_14.5_MOBILE_WEB_UI.md` (COMPLETE) |
| Auth architecture | `PHASE_10_AUTH_AND_SECURITY.md` |
| GRDCS specification | `docs/architecture/04_GRDCS_SPECIFICATION.md` |
| CDR data lifecycle | `PHASE_35_CDR_DATA_LIFECYCLE.md` |
| Basiq Open Banking | `PHASE_24_OPEN_BANKING_BASIQ.md` |
| Enterprise portal mobile | `PHASE_32_ENTERPRISE_PORTAL.md` (future) |
| Financial calculation logic | `lib/services/masterFinancialService.ts` (reused, not duplicated) |

---

## 2. OBJECTIVES

### 2.1 Primary Objectives

1. **Deliver daily financial awareness in under 30 seconds**
   - A single "Daily Pulse" screen showing net worth, cashflow position, health score, and top insights
   - "Money left until payday" widget — the single most anxiety-reducing number for most users
   - User can absorb their full financial state at a glance

2. **Make transaction triage faster on mobile than desktop**
   - Dedicated "Triage Mode" — a Tinder-like card-stack of uncategorised transactions
   - Swipe right = accept category, swipe left = flag/exclude, swipe up = "I don't recognise this"
   - Each correction feeds `MerchantMapping` for AI learning (reusing `lib/tie/categorisation.ts`)
   - This solves the biggest friction point: the AI categorisation fallback was removed (2026-05-09) and ~50 hardcoded regex rules leave most small/local merchants uncategorised, creating a manual correction queue with no bulk UI on desktop

3. **Replace the 9-step desktop receipt flow with a 3-step camera flow**
   - Receipt/document scan is a **top-level action** (FAB or tab), not buried in a form
   - Camera → snap → Gemini OCR auto-fills amount, merchant, date, category → save
   - Desktop flow: receive receipt → photograph → transfer to computer → locate file → open Monitrax → navigate → open form → upload → wait for OCR → review → save (9 steps, 5+ minutes)
   - Mobile flow: open app → tap scan → point camera → review auto-fill → save (5 steps, 30 seconds)
   - Reuses existing `lib/documents/intelligence/DocumentIntelligenceEngine.ts` (Vision API + pattern analysers)

4. **Push critical financial alerts to the user's pocket**
   - **Real-time transaction push**: "You just spent $82.50 at Woolworths" (opt-in) — creates spending awareness at moment of purchase
   - Overspending warnings, upcoming payments, cashflow risk, bank sync issues
   - Anomaly detection from `lib/tie/behavioural.ts` (price increases, duplicates, timing anomalies, new merchants) — currently computed silently with no way to reach the user
   - Morning Daily Digest and weekly summary
   - This is the **killer feature** that justifies a native app

5. **Fix the broken Basiq reconnection flow**
   - Desktop reconnection is broken on mobile browsers (`window.open()` popup blocked)
   - Current failure mode: connection goes stale silently → no notification → data stops syncing → user discovers days later in a buried settings page → no "Reconnect" button exists
   - Mobile app: push notification on `RECONNECT`/`ERROR` status → tap → in-app browser OAuth flow → deep link back → connection restored
   - This alone justifies the native app for any Basiq-connected user

6. **Support quick financial data entry**
   - Quick-add expense and income from anywhere
   - Entries sync to the web app instantly

7. **Integrate with the existing backend using optimised endpoints**
   - Lean mobile-specific API projections of `getMasterFinancialSnapshot()`
   - Delta sync to reduce bandwidth by 70%+
   - Max payload <200kb, latency <150ms

8. **Maintain full CDR compliance on mobile**
   - Encrypted local storage for CDR data
   - Consent-gated access via existing `withActiveConsent()` guard
   - CDR data wiped from device on consent revocation
   - No CDR data in logs, screenshots, or error reports

### 2.2 Non-Objectives (Explicitly Out of Scope)

| What | Why |
|------|-----|
| Full entity CRUD (create/edit/delete properties, loans, investments) | Complex forms requiring large screen; web-only |
| GRDCS graph exploration / LinkedDataPanel | Requires screen real estate for relationship visualisation |
| Strategy Engine (Buy/Hold/Sell analysis) | Deep analysis requiring full dashboard context |
| Depreciation schedules (Div 40/43) | Specialist annual-use feature |
| CGT calculations and tax engine | Complex multi-factor analysis |
| Report generation and export | Desktop workflow |
| Admin portal and enterprise portal | Administrative functions |
| Basiq bank connection **initial** setup | One-time complex OAuth flow; web-only (reconnection IS in scope — see §4.4) |
| Debt planner simulations | Requires interactive charts and comparison tables |
| Document Intelligence review (OCR confidence scores, form auto-fill) | Needs large screen for extraction review |

---

## 3. PLATFORM STRATEGY

### 3.1 Platform Choice: React Native + Expo

| Factor | Decision | Rationale |
|--------|----------|-----------|
| **Framework** | React Native | Shared TypeScript/React expertise with web app; zero context switch |
| **Toolchain** | Expo SDK 53+ | Managed workflow; OTA updates via EAS Update; native module access |
| **JS Engine** | Hermes | Optimised for React Native; faster startup, lower memory |
| **Navigation** | Expo Router (file-based) | Familiar Next.js-like file-based routing |
| **State Management** | Zustand + React Query | Lightweight; React Query for server state, Zustand for local |
| **Local Database** | expo-sqlite | Offline-first cache; encrypted via SQLCipher for CDR data |
| **Auth** | @react-native-firebase/auth | Direct Firebase Auth SDK; biometric unlock via Expo SecureStore |
| **Push** | FCM via @react-native-firebase/messaging | iOS (APNs via FCM) + Android (FCM direct) |
| **Charts** | react-native-svg + Victory Native | Lightweight; no WebView-based charting |
| **Lists** | @shopify/flash-list | Virtualised lists for transaction feeds |
| **Build & Deploy** | EAS Build + EAS Submit | Cloud builds for iOS/Android; automated App Store submission |
| **OTA Updates** | EAS Update | Ship bug fixes without App Store review (critical for solo operator) |

### 3.2 Why Not Other Platforms

| Alternative | Rejection Reason |
|-------------|-----------------|
| **Flutter** | Requires Dart rewrite of all business logic; team's strength is TypeScript |
| **PWA** | No reliable iOS push notifications; no SQLite; no App Store presence; no biometrics; no widgets (see §1.1) |
| **Native Swift/Kotlin** | Two separate codebases; unsustainable for solo operator; premature optimisation |
| **Capacitor/Ionic** | WebView-based; performance inferior to React Native; limited native API access |

### 3.3 Long-Term Option

If React Native performance becomes a bottleneck at scale (500+ users), evaluate:
- Native Swift (iOS) + Kotlin (Android) rewrites for performance-critical screens
- Kotlin Multiplatform for shared business logic with native UIs
- This decision should be revisited at Phase 3 of the BAU scaling plan (50-500 users)

### 3.4 Repository Structure

```
monitrax-mobile/                    # Separate repository
├── app/                            # Expo Router screens
│   ├── (tabs)/                     # Tab navigator
│   │   ├── index.tsx               # Daily Pulse (Home)
│   │   ├── transactions.tsx        # Transaction Feed
│   │   ├── insights.tsx            # Insights & Alerts Hub
│   │   └── more.tsx                # Settings & Quick Actions
│   ├── cashflow.tsx                # Cashflow Mini-Dashboard
│   ├── expense/add.tsx             # Quick-Add Expense
│   ├── income/add.tsx              # Quick-Add Income
│   ├── entity/[type]/[id].tsx      # Entity Detail (read-only)
│   ├── chat.tsx                    # AI Chat
│   └── login.tsx                   # Auth flow
├── components/                     # Shared mobile components
├── lib/                            # Mobile-specific utilities
│   ├── api/                        # API client with auth headers
│   ├── storage/                    # SQLite cache layer
│   ├── sync/                       # Delta sync engine
│   ├── notifications/              # Push notification handlers
│   └── auth/                       # Firebase Auth + biometrics
├── packages/
│   └── core/                       # Symlink or npm workspace → @monitrax/core
├── assets/                         # Icons, images, splash
├── app.json                        # Expo config
├── eas.json                        # EAS Build config
└── tsconfig.json
```

**Note:** The mobile app lives in a **separate repository** (`monitrax-mobile`), not a monorepo, to keep build pipelines independent. Shared code is published as `@monitrax/core` npm package (see §11).

---

## 4. FEATURE SCOPE — TIER 1 (MVP LAUNCH)

These are the features required for the initial App Store release.

### 4.1 Home Screen — "Daily Financial Pulse"

The primary screen. Displays everything a user needs in a single glanceable view.

**Content:**

| Widget | Data Source | Behaviour |
|--------|-----------|-----------|
| **Net Worth** (hero number) | `getMasterFinancialSnapshot().netWorth.total` | Large display with trend arrow (up/down vs last month) |
| **Health Score** (0-100 ring) | `lib/health/aggregateEngine.ts` | Animated ring with grade (A-F) and colour |
| **Cashflow Position** | `getMasterFinancialSnapshot().cashflow` | Monthly surplus/deficit with sparkline |
| **Spending Velocity** | `UnifiedTransaction` aggregate today vs daily average | "You've spent $X today" with comparison bar |
| **Money Left Until Payday** | Next `Income` (type=SALARY) date minus projected expenses | "$1,240 left for 8 days" — the single most anxiety-reducing number (Mani et al. 2013: financial stress costs 13 IQ points; this widget directly reduces that cognitive tax) |
| **Account Balances** (horizontal scroll) | `Account[]` with `balance` field | Compact cards per account; last synced timestamp |
| **Top 3 Insights** | `lib/intelligence/insightsEngine.ts` — Critical and High only | Severity badge + 1-line summary + CTA |
| **Quick Actions** (FAB or bottom row) | Static | "Add Expense", "Add Income", "Scan Receipt" |

**Interactions:**
- Pull-to-refresh triggers `/api/mobile/snapshot` refetch
- Auto-refresh every 30 minutes via background fetch
- Tap any widget → drill into detail screen
- Tap insight → opens Insight detail with recommended action
- Offline: shows cached data with "Last updated X ago" indicator

### 4.2 Transaction Triage Mode — "Swipe to Sort Your Money"

**The single biggest mobile-over-desktop advantage.** The AI categorisation fallback was removed (2026-05-09) and ~50 hardcoded regex rules in `lib/tie/categorisation.ts` leave most small/local/new merchants in "Uncategorised". On desktop there is no bulk recategorisation UI — the user must click into each transaction individually. On mobile, gesture-based card triage is 5x faster.

**Design:** Tinder-style card stack. One uncategorised transaction per card. User processes the queue.

```
┌─────────────────────────────────────┐
│                                     │
│  ← Flag        $82.50    Accept →   │
│                                     │
│        WOOLWORTHS METRO 0432        │
│        2 hours ago · ANZ Everyday   │
│                                     │
│        AI suggests: 🛒 Groceries    │
│        Confidence: 85%              │
│                                     │
│  ↑ "I don't recognise this"         │
│                                     │
└─────────────────────────────────────┘
    ○ ○ ○ ○ ● ○ ○   (7 remaining)
```

**Gestures:**

| Gesture | Action | Outcome |
|---------|--------|---------|
| **Swipe right** | Accept AI-suggested category (or tap to pick different) | Transaction categorised; `MerchantMapping` created for future auto-categorisation |
| **Swipe left** | Flag as duplicate / split / exclude | Transaction flagged; removed from queue |
| **Swipe up** | "I don't recognise this" | Triggers AI investigation via Gemini; push notification with explanation when ready |
| **Tap card** | Expand detail | Shows full merchant info, account, date, linked entity |
| **Tap category badge** | Change category | Opens category picker sheet; user correction feeds learning loop |

**Queue logic:**
- Source: all `UnifiedTransaction` records where `category IS NULL` or `categoryConfidence < 0.5`
- Sorted by: most recent first (user cares most about new transactions)
- Badge on Transactions tab shows queue count: "12 to triage"
- Empty state: "All sorted! You're on top of your spending." with celebration haptic

**Why this is mobile-first:**
- Desktop: click row → dialog opens → click category dropdown → select → close dialog → scroll to next. ~8 seconds per transaction.
- Mobile: swipe right on card → next card auto-appears. ~1.5 seconds per transaction.
- A user can triage 30 transactions in 45 seconds while waiting for coffee.

---

### 4.3 Receipt & Document Scanner — Top-Level Action

**This replaces the 9-step desktop upload flow with a 3-step camera flow.**

Desktop flow today: receive paper receipt → photograph with phone → transfer to computer → locate file on computer → open Monitrax → navigate to expenses → open form → click upload → find file → wait for OCR → review auto-fill → save. **9 steps, 5+ minutes.**

Mobile flow: tap scan button → point camera → snap → review auto-fill → save. **5 steps, 30 seconds.**

**UI position:** Persistent FAB (floating action button) or centre tab in bottom bar — NOT buried inside a form.

```
┌─────────────────────────────────────┐
│          📷 Scan Receipt            │
│                                     │
│     ┌───────────────────────┐       │
│     │                       │       │
│     │    Camera viewfinder  │       │
│     │                       │       │
│     │    [ Auto-detect      │       │
│     │      document edges ] │       │
│     └───────────────────────┘       │
│                                     │
│          [  Capture  ]              │
│                                     │
│   Recent: 📄 Woolworths  📄 Coles  │
└─────────────────────────────────────┘
```

**After capture:**
1. Photo uploaded to GCS via `POST /api/v1/mobile/document/upload`
2. `DocumentIntelligenceEngine` runs Vision API OCR + Tier 1 pattern analysers
3. Auto-fills: amount, merchant/vendor, date, suggested category
4. Low-confidence fields highlighted amber (from `lowConfidenceFields` list)
5. User reviews, adjusts, saves → Expense entity created + document linked

**Document types supported by existing engine:**
- Receipts (Tier 1 pattern analyser)
- Invoices (Tier 1 pattern analyser)
- Utility bills (Tier 1, reuses receipt analyser)
- Rate notices (Tier 1)
- Bank statements (Tier 1)
- Loan contracts, insurance policies, valuations (Tier 3 AI)

**Why mobile-first:** The camera IS the input device. Desktop has no camera. The `LOCAL_DRIVE` storage provider silently skips OCR on desktop (`"Cannot analyze LOCAL_DRIVE documents server-side"`). Mobile always uploads to GCS, so OCR always runs.

---

### 4.4 Basiq Bank Reconnection

**Fixes a broken flow.** The web app's `useBasiqConnect.ts` calls `window.open(consentUrl, '_blank', 'width=600,height=700')` — a fixed-size popup that mobile browsers block. When a connection enters `RECONNECT` status, the user has no way to fix it on mobile.

**Current failure mode (desktop):**
1. Connection goes stale (Basiq webhook sets status to `RECONNECT`)
2. No notification — data silently stops syncing
3. User discovers days later in buried `/dashboard/settings/connections`
4. Amber badge visible but no "Reconnect" button — only "Disconnect"
5. User must disconnect → navigate to Balances → "Connect Bank" → popup OAuth

**Mobile solution:**
1. Push notification: "Your ANZ connection needs attention. Tap to reconnect."
2. User taps → app opens in-app browser (`expo-web-browser`) with Basiq consent URL
3. User completes bank auth in native browser flow (no popup)
4. Basiq redirects back → deep link returns to app
5. Connection status → `ACTIVE`; sync resumes; success toast

**Implementation:**
- Webhook handler sets `RECONNECT` status → triggers FCM push via Cloud Function
- Mobile app registers deep link handler for Basiq OAuth callback
- `POST /api/v1/mobile/basiq/reconnect` endpoint initiates the flow

---

### 4.5 Transaction Feed

Powered by Phase 13 (TIE) and Phase 24 (Basiq).

**Content:**
- Reverse-chronological list of `UnifiedTransaction` records
- Smart date grouping: "Today", "Yesterday", "This Week", "Earlier"
- Each row shows: merchant icon/initial, normalised merchant name, amount (colour-coded in/out), category badge, AI confidence indicator (if uncategorised)
- Subscription detection badges (powered by `RecurringPayment` model)
- Search bar with merchant/category/amount filters

**Interactions:**
- **Swipe right** → Quick-categorise (opens category picker sheet)
- **Swipe left** → Flag as duplicate / exclude
- **Tap** → Transaction detail (merchant, account, date, linked entity, notes)
- **Long press** → "Explain this transaction" (Gemini AI annotation)
- **Pull-to-refresh** → Delta sync from `/api/mobile/transactions`

**Performance:**
- FlashList virtualisation for smooth scrolling at 10,000+ transactions
- Delta sync: only fetch transactions since `lastSyncTimestamp`
- Initial load: max 100 transactions; infinite scroll paginates further

### 4.6 Cashflow Mini-Dashboard

Compact view of Phase 14 cashflow data.

**Content:**

| Element | Description |
|---------|-------------|
| **14-day forecast chart** | Area chart showing projected daily balance; confidence band shading |
| **Upcoming recurring charges** | Next 7 days of known recurring payments (from `RecurringPayment`) with amounts and due dates |
| **High/Low spend alerts** | Flags if current week is >130% of average weekly spend |
| **Monthly surplus/deficit** | Budget vs Actual progress bar (from `MasterExpenseBreakdown.budgetVariance`) |

**Interactions:**
- Tap recurring charge → Transaction detail
- Tap forecast → "Continue on Desktop" deep link to full cashflow intelligence page

### 4.7 Insights & Alerts Hub

Real-time delivery of financial intelligence.

**Content:**
- Full list of active insights from `lib/intelligence/insightsEngine.ts`
- Grouped by severity: Critical → High → Medium → Low
- Each insight shows: severity badge (colour per `docs/architecture/06_UI_UX_FOUNDATION.md`), description, affected entity count, recommended fix

**Insight Types Surfaced:**

| Category | Examples |
|----------|---------|
| **Overspending** | "Food spending is 45% above budget this month" |
| **Subscription** | "Netflix price increased from $16.99 to $22.99" |
| **Cashflow Risk** | "Projected shortfall of $420 in 5 days" |
| **Loan Payment** | "Home loan repayment of $2,340 due in 2 days" |
| **Bank Sync** | "ANZ connection needs re-authentication" |
| **Health Score** | "Financial health dropped 12 points this week" |
| **Money Leak** | "3 unused subscriptions totalling $47/month detected" |

**Interactions:**
- Swipe to dismiss (marks as resolved)
- Tap to expand with full detail and action buttons
- "Fix Now" → opens relevant quick action or deep links to web
- Save for later / snooze

### 4.8 Quick-Add Expense

Minimal-friction expense entry.

**Fields:**
```
Amount*          → Numeric keypad (auto-focused on open)
Name/Merchant    → Text input with recent suggestions
Category*        → Picker from user's Category list (system + custom)
Frequency        → Default: one-off; toggle for recurring
Date             → Default: today; date picker
Property link    → Optional; picker from user's properties
Receipt photo    → Camera button → Gemini OCR auto-fills fields
Notes            → Optional text
```

**Behaviour:**
- Opens as a bottom sheet (half-screen), expandable to full-screen
- Amount keypad is auto-focused for fastest possible entry
- "Scan Receipt" button triggers camera → uploads to `/api/mobile/document/upload` → Gemini extracts amount, merchant, date → auto-fills form
- Saved via `POST /api/mobile/expense`
- Success: haptic feedback + toast + auto-dismiss

### 4.9 Quick-Add Income

Same pattern as §4.5 but for income entries.

**Fields:** Amount*, Name/Source, Type (Salary/Rent/Investment/Other), Frequency, Date, Property link (optional for rental), Notes.

### 4.10 Financial Health Score Detail

Drill-down from the Daily Pulse health ring.

**Content:**
- Large animated score ring (0-100) with grade
- 7 category scores as horizontal progress bars (from `lib/health/categoryScoring.ts`):
  Liquidity, Cashflow, Debt, Investments, Property, Risk Exposure, Long-Term Outlook
- Trend indicator: Improving / Stable / Declining
- Top 3 improvement actions (from `lib/health/riskModelling.ts`)
- "View Full Report on Desktop" deep link

### 4.11 Biometric Authentication

- **Face ID** (iOS) / **Fingerprint** (Android) for app unlock
- Firebase refresh token stored in device Keychain (iOS) / Keystore (Android) via Expo SecureStore
- Biometric prompt on app open; falls back to Firebase re-authentication if biometric fails
- MFA challenge via Firebase TOTP when accessing CDR data (same flow as web, mobile-optimised UI)

---

## 5. FEATURE SCOPE — TIER 2, TIER 3 & WEB-ONLY

### 5.1 Tier 2 — Post-Launch (v1.1–v1.2)

| Feature | Description | Depends On |
|---------|-------------|------------|
| **Budget Setup & Review** | Interactive budget setup from AI-generated scenarios; monthly check-in prompt; inline adjustment per category (tap progress bar to change target) | Phase 28 (Budget Analysis) |
| **Leak Alert Snooze/Dismiss** | "I know about this, stop showing for 30 days" — prevents notification fatigue from `leakDetector.ts` which currently has no dismiss mechanism | Phase 31 (Cashflow Intelligence) |
| **Impulse Spending Cooldown** | Opt-in: "You've bought coffee 3 times today ($14.70). That's $320/month." — 24-hour awareness nudge for flagged impulse patterns | Phase 13 (TIE behavioural) |
| **Property Quick View** | Read-only property card: LVR, equity, rental yield, linked loan | Phase 8 (GRDCS) |
| **Loan Payment Tracker** | Upcoming repayments, offset balance, days to next payment | Phase 2 (Loans) |
| **AI Chat** | Quick financial questions via Gemini; context-aware from snapshot | Phase 27 (Gemini AI) |
| **Entity Read-Only View** | Tap any entity from insight/transaction → view detail card (no edit) | Phase 8 (GRDCS) |
| **Notification Preferences** | Configure which alert types to receive; quiet hours | Phase 15 notification system |

### 5.2 Tier 3 — Growth Features (v2.0+)

| Feature | Description |
|---------|-------------|
| **iOS Widgets** | Home screen widgets: Net Worth, Health Score, Daily Spend, Cashflow mini-chart |
| **Android Widgets** | Glance widgets with same data as iOS |
| **Apple Watch / Wear OS** | Complication: Net Worth + Health Score on wrist |
| **Location-based expense logging** | Geofence triggers: "You're at Woolworths — log this expense?" |
| **Bill scan + auto-create** | Camera → OCR → Gemini → create expense entity + link to property/loan |
| **Shared household view** | Partner sees same Daily Pulse (via Organization member role) |
| **Siri / Google Assistant shortcuts** | "Hey Siri, what's my net worth?" → reads from cached snapshot |
| **Dark/light mode sync** | Syncs with web app theme preference via `UserPreference` |

### 5.3 Features That Stay Web-Only (Permanently)

These features are too complex, data-heavy, or infrequently used for mobile:

| Feature | Reason |
|---------|--------|
| Full entity CRUD (properties, loans, investments, assets) | Complex multi-field forms with relationship linking |
| GRDCS graph exploration / LinkedDataPanel | Requires large screen for relationship visualisation |
| Strategy Engine — Buy/Hold/Sell | Deep multi-factor analysis with evidence graphs |
| Depreciation schedules (Div 40/43) | Specialist feature, annual use |
| CGT calculations and purchase lot tracking | Complex tabular data requiring review |
| Tax Engine — full position and deductions | Multi-section forms with PAYG/Medicare/offset calculations |
| Report generation (CSV/Excel/JSON) | Desktop workflow; files need desktop to process |
| Debt Planner — strategy simulation | Interactive charts comparing Avalanche/Snowball/Tax-Aware |
| Admin Portal | Administrative function; separate auth system |
| Enterprise Portal — org/client management | B2B workflow with team/permission management |
| Basiq connection setup and re-auth | Complex OAuth flow; one-time setup |
| Document Intelligence — extraction review | Needs large screen to verify OCR confidence scores |
| Onboarding wizard | 8-step setup with complex forms; one-time flow |
| Household profile management | Infrequent setup; complex member/pet/category generation |
| Settings — billing, API keys, storage providers | Desktop administrative tasks |

---

## 6. SYSTEM ARCHITECTURE

### 6.1 High-Level Architecture Diagram

```
┌──────────────────────────────────────┐
│         Mobile App (Expo)            │
│                                      │
│  ┌──────────┐    ┌───────────────┐   │
│  │ Screens  │    │ @monitrax/core│   │
│  │ (Expo    │    │ (formatCurrency│  │
│  │  Router) │    │  toMonthly,   │   │
│  │          │    │  healthScore) │   │
│  └────┬─────┘    └───────────────┘   │
│       │                              │
│  ┌────▼─────┐    ┌───────────────┐   │
│  │ Zustand  │    │ SQLite Cache  │   │
│  │ + React  │◄──►│ (encrypted    │   │
│  │ Query    │    │  via SQLCipher)│   │
│  └────┬─────┘    └───────────────┘   │
│       │                              │
│  ┌────▼─────┐    ┌───────────────┐   │
│  │ API      │    │ Firebase Auth │   │
│  │ Client   │    │ + Biometrics  │   │
│  └────┬─────┘    └───────┬───────┘   │
└───────┼──────────────────┼───────────┘
        │ HTTPS            │ Firebase ID Token
        ▼                  ▼
┌──────────────────────────────────────┐
│      Monitrax Backend (Vercel)       │
│                                      │
│  /api/mobile/*     Firebase Token    │
│  (lean endpoints)  Verification      │
│       │            (verifyGCPIdToken) │
│       ▼                              │
│  getMasterFinancialSnapshot()        │
│  + canonical calculation engines     │
│       │                              │
│       ▼                              │
│  GCP Cloud SQL (PostgreSQL)          │
│  australia-southeast1 (Sydney)       │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│      Push Notification Pipeline      │
│                                      │
│  Insights Engine → Cloud Function    │
│       → FCM → APNs (iOS)            │
│              → FCM (Android)         │
└──────────────────────────────────────┘
```

### 6.2 Data Flow: Mobile Snapshot Request

```
1. App opens → biometric unlock → Firebase refresh token from Keychain
2. Firebase SDK exchanges refresh token for fresh ID token (1-hour expiry)
3. App calls GET /api/mobile/snapshot with Authorization: Bearer <firebase-id-token>
4. Server: verifyGCPIdToken() → withPermission('snapshot.read') → withActiveConsent() (if CDR data)
5. Server: getMasterFinancialSnapshot(userId) → returns full snapshot
6. Server: Mobile projection layer strips to <50kb payload (net worth, cashflow, health, top insights, balances)
7. App: stores in SQLite cache + renders Daily Pulse
8. App: schedules next background refresh in 30 minutes
```

### 6.3 Data Flow: Transaction Categorisation

```
1. User swipes right on uncategorised transaction
2. Category picker sheet opens (populated from cached Category[] list)
3. User selects category → PATCH /api/mobile/transaction/{id}/categorize
4. Server: updates UnifiedTransaction.category + creates MerchantMapping for learning
5. Server: returns updated transaction
6. App: updates SQLite cache + shows success haptic
7. Next time this merchant appears → AI auto-categorises based on learned mapping
```

### 6.4 Key Architectural Rules

| Rule | Rationale |
|------|-----------|
| Mobile endpoints are **projections** of canonical services | No new business logic; `getMasterFinancialSnapshot()` remains SSOT |
| Mobile app **never** writes to Prisma directly | All writes go through API endpoints with full auth + validation |
| Local SQLite is a **cache**, not a source of truth | Server data always wins on sync conflict |
| CDR data in SQLite must be **encrypted** | SQLCipher encryption at rest; key stored in Keychain/Keystore |
| No CDR data in **React Native logs or crash reports** | Strip financial data from Sentry/Crashlytics before transmission |
| API versioning via **URL prefix** | `/api/v1/mobile/*` to prevent breaking changes during App Store review delays |

---

## 7. MOBILE API SPECIFICATION

All mobile endpoints live under `/api/v1/mobile/` and follow the universal response envelope from `docs/architecture/07_API_STANDARDS.md`:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": { "timestamp": "ISO8601", "durationMs": 42 }
}
```

### 7.1 Endpoint Inventory

| Method | Endpoint | Max Payload | Auth | Purpose |
|--------|----------|-------------|------|---------|
| `GET` | `/api/v1/mobile/snapshot` | <50kb | `withPermission('snapshot.read')` | Daily Pulse data |
| `GET` | `/api/v1/mobile/transactions` | <100kb | `withPermission('transaction.read')` | Transaction feed with delta sync |
| `GET` | `/api/v1/mobile/insights` | <20kb | `withPermission('insight.read')` | Active insights by severity |
| `GET` | `/api/v1/mobile/cashflow-forecast` | <10kb | `withPermission('cashflow.read')` | 7/14/30-day cashflow forecast |
| `GET` | `/api/v1/mobile/accounts` | <15kb | `withPermission('account.read')` | Account balances summary |
| `GET` | `/api/v1/mobile/categories` | <10kb | `withPermission('category.read')` | Category list for pickers |
| `POST` | `/api/v1/mobile/expense` | — | `withPermission('expense.write')` | Quick-add expense |
| `POST` | `/api/v1/mobile/income` | — | `withPermission('income.write')` | Quick-add income |
| `PATCH` | `/api/v1/mobile/transaction/{id}/categorize` | — | `withPermission('transaction.write')` | Swipe-to-categorise |
| `POST` | `/api/v1/mobile/document/upload` | Multipart | `withPermission('document.write')` | Receipt photo upload + OCR |
| `POST` | `/api/v1/mobile/sync` | <5kb req | `withPermission('snapshot.read')` | Bidirectional delta sync |
| `POST` | `/api/v1/mobile/device/register` | — | `withPermission('user.read')` | Register FCM token for push |
| `DELETE` | `/api/v1/mobile/device/{token}` | — | `withPermission('user.write')` | Unregister FCM token |

### 7.2 Snapshot Endpoint Detail

`GET /api/v1/mobile/snapshot`

This is a **projection** of `getMasterFinancialSnapshot()` — same canonical service, stripped to mobile-essential fields.

**Response shape:**

```typescript
interface MobileSnapshot {
  netWorth: {
    total: number;
    previousMonth: number;     // For trend arrow
    changePercent: number;
  };
  healthScore: {
    score: number;             // 0-100
    grade: string;             // A-F
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    topCategories: Array<{     // Top 3 weakest categories
      name: string;
      score: number;
    }>;
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
    lastSynced: string | null;  // ISO8601
  }>;
  topInsights: Array<{         // Max 3, Critical + High only
    id: string;
    severity: 'critical' | 'high';
    title: string;
    description: string;
    actionLabel: string;
    actionType: 'deep_link' | 'quick_action' | 'dismiss';
    actionTarget: string;      // URL or action ID
  }>;
  budgetVariance: {
    status: 'under' | 'over' | 'on_track';
    variancePercent: number;
  };
  lastUpdated: string;         // ISO8601
}
```

### 7.3 Transaction Endpoint Detail

`GET /api/v1/mobile/transactions?since={ISO8601}&limit={number}&offset={number}`

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `since` | ISO8601 | (none) | Delta sync: only return transactions modified after this timestamp |
| `limit` | number | 50 | Page size (max 100) |
| `offset` | number | 0 | Pagination offset |
| `category` | string | (none) | Filter by category |
| `direction` | `IN` / `OUT` | (none) | Filter by direction |
| `search` | string | (none) | Merchant name search |

**Response shape:**

```typescript
interface MobileTransactionResponse {
  transactions: Array<{
    id: string;
    merchantName: string;         // Normalised
    merchantOriginal: string;     // Raw from bank
    amount: number;
    direction: 'IN' | 'OUT';
    category: string | null;
    categoryConfidence: number;   // 0-1 (AI confidence)
    date: string;                 // ISO8601
    accountId: string;
    accountName: string;
    isRecurring: boolean;
    recurringPaymentId: string | null;
    linkedExpenseId: string | null;
    source: 'MANUAL' | 'BANK' | 'IMPORT';
    updatedAt: string;            // For delta sync comparison
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  syncTimestamp: string;          // Server timestamp for next delta request
}
```

### 7.4 Sync Endpoint Detail

`POST /api/v1/mobile/sync`

Bidirectional sync for offline-first operation.

**Request:**

```typescript
interface SyncRequest {
  lastSyncTimestamp: string;     // ISO8601 from previous sync
  pendingWrites: Array<{         // Offline-created items
    type: 'expense' | 'income';
    tempId: string;              // Client-generated UUID
    data: Record<string, any>;
    createdAt: string;
  }>;
  deviceInfo: {
    platform: 'ios' | 'android';
    appVersion: string;
    osVersion: string;
  };
}
```

**Response:**

```typescript
interface SyncResponse {
  snapshot: MobileSnapshot;      // Fresh snapshot
  newTransactions: MobileTransactionResponse['transactions'];
  resolvedWrites: Array<{
    tempId: string;              // Maps back to client's pending write
    serverId: string;            // Real server ID
    status: 'created' | 'conflict' | 'duplicate';
  }>;
  deletedEntities: Array<{      // CDR data deletions, etc.
    type: string;
    id: string;
  }>;
  syncTimestamp: string;
}
```

### 7.5 API Design Principles

| Principle | Implementation |
|-----------|---------------|
| **No new business logic** | Mobile endpoints call `getMasterFinancialSnapshot()`, existing calculation engines, and existing TIE services |
| **Projection, not duplication** | The snapshot endpoint is a SELECT of fields from the full snapshot — no parallel calculation |
| **Versioned from day one** | `/api/v1/mobile/*` prefix; breaking changes → `/api/v2/mobile/*` |
| **Max payload <200kb** | Enforced by projection layer; large datasets paginated |
| **Latency <150ms** | Endpoint must respond in P95 <150ms; cache `getMasterFinancialSnapshot()` result for 60 seconds |
| **Delta sync by default** | Transaction endpoint returns only rows modified since `lastSyncTimestamp` |
| **Zod validation** | All inputs validated via Zod schemas (same pattern as web routes) |
| **GRDCS-compatible** | Entity IDs follow `{module}-{uuid}` format; hrefs are canonical |

---

## 8. AUTHENTICATION & SECURITY

### 8.1 Authentication Flow

The mobile app uses the same GCP Identity Platform (Firebase Auth) as the web app. No separate auth system.

```
┌─ App Launch ─────────────────────────────────────────────────┐
│                                                               │
│  1. Check Keychain/Keystore for stored refresh token          │
│     ├── Found → attempt biometric unlock (Face ID/Fingerprint)│
│     │   ├── Biometric pass → Firebase refreshes ID token      │
│     │   └── Biometric fail → show Firebase login screen       │
│     └── Not found → show Firebase login screen                │
│                                                               │
│  2. Firebase login options:                                   │
│     ├── Email + Password                                      │
│     ├── Google Sign-In (native OAuth)                         │
│     ├── Apple Sign-In (required for iOS App Store)            │
│     └── Microsoft Sign-In                                     │
│                                                               │
│  3. On successful auth:                                       │
│     ├── Firebase returns ID token (1-hour expiry)             │
│     ├── Store refresh token in Keychain (biometric-protected) │
│     ├── Register FCM token via POST /api/v1/mobile/device     │
│     └── Fetch initial snapshot                                │
│                                                               │
│  4. Token lifecycle:                                          │
│     ├── onIdTokenChanged() listener auto-refreshes            │
│     ├── API calls always use fresh token from listener        │
│     └── If refresh fails → redirect to login                  │
└───────────────────────────────────────────────────────────────┘
```

### 8.2 Biometric Unlock

| Platform | API | Storage |
|----------|-----|---------|
| iOS | Local Authentication (Face ID / Touch ID) | Keychain with `kSecAccessControlBiometryCurrentSet` |
| Android | BiometricPrompt API (Fingerprint / Face) | Android Keystore with `setUserAuthenticationRequired(true)` |

**Implementation via Expo:**
- `expo-local-authentication` for biometric prompt
- `expo-secure-store` for encrypted credential storage
- On biometric enrollment change (e.g., new fingerprint added), invalidate stored credentials and require re-authentication

### 8.3 MFA on Mobile

MFA uses Firebase TOTP — same mechanism as web (`lib/firebase/mfa.ts`), with mobile-optimised UI:

| Scenario | Behaviour |
|----------|-----------|
| **MFA enrolled, CDR data access** | Firebase TOTP challenge dialog before API call proceeds |
| **MFA enrolled, non-CDR data** | No challenge (biometric unlock is sufficient) |
| **MFA not enrolled, org enforces MFA** | Redirect to web app for MFA enrollment (complex TOTP QR flow) |
| **MFA not enrolled, org doesn't enforce** | No challenge |

**CDR routes requiring MFA** (per Phase 34):
- All `/api/basiq/*` endpoints
- All `/api/cdr/*` endpoints
- Transaction data sourced from Basiq (`source: 'BANK'`)

### 8.4 Session Management

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Idle timeout** | 60 minutes (mobile) | Longer than web's 30 minutes; mobile sessions are intermittent |
| **Background timeout** | 5 minutes | If app is backgrounded >5 min, require biometric re-unlock |
| **Token expiry** | 1 hour (Firebase default) | Auto-refreshed via `onIdTokenChanged()` |
| **Max concurrent sessions** | 3 (1 web + 2 mobile devices) | Prevents session abuse |
| **Force logout** | On refresh token revocation | Server revokes via Firebase Admin SDK |

### 8.5 Security Controls

| Control | Implementation |
|---------|---------------|
| **Certificate pinning** | Pin Vercel and GCP SSL certificates; reject MitM proxies |
| **Jailbreak/root detection** | `expo-device` checks; warn user but don't block (CDR data access blocked on rooted devices) |
| **Screenshot prevention** | `FLAG_SECURE` on Android; `UIScreen.capturedDidChange` listener on iOS for CDR data screens |
| **App Transport Security** | iOS ATS enforced; all connections HTTPS-only |
| **Obfuscation** | Hermes bytecode compilation provides baseline obfuscation |
| **Secure clipboard** | Financial amounts not copiable by default; opt-in per field |

---

## 9. PUSH NOTIFICATION SYSTEM

### 9.1 Infrastructure

```
Trigger Source                    Delivery Pipeline
─────────────                    ─────────────────
Insights Engine v3 ──┐
                     ├──► GCP Cloud Function ──► FCM ──┬──► APNs (iOS)
Cloud Scheduler ─────┤    (notification builder)       └──► FCM (Android)
                     │
Basiq Webhook ───────┘
```

**Components:**
- **GCP Cloud Function** (`monitrax-push-notifications`): Receives triggers, builds notification payload, sends via Firebase Admin SDK
- **FCM (Firebase Cloud Messaging)**: Delivery to both platforms; handles token management
- **Device token registry**: `POST /api/v1/mobile/device/register` stores FCM token linked to `userId`

### 9.2 Notification Types

| Type | Trigger | Schedule | Priority | Content Example |
|------|---------|----------|----------|-----------------|
| **Real-time Transaction** | Basiq sync / TIE | On each new transaction (opt-in) | Normal | "You just spent $82.50 at Woolworths." — creates spending awareness at the moment of purchase; biggest behaviour change driver (behaviour psychologist lens) |
| **Daily Digest** | Cloud Scheduler | 07:00 local | Normal | "Good morning. Net worth: $1.2M (+0.3%). 2 insights need attention." |
| **Weekly Summary** | Cloud Scheduler | Sunday 09:00 local | Low | "This week: spent $1,240 (12% under budget). Health score: 78 (+2)." |
| **Overspending Alert** | Real-time (TIE) | When daily spend >150% of average | High | "You've spent $380 today — 2.1x your daily average." |
| **Upcoming Payment** | Cloud Scheduler | 2 days before due | Normal | "Home loan repayment of $2,340 due on Friday." |
| **Cashflow Risk** | Insights Engine | When forecast shows negative in ≤7 days | High | "Projected shortfall of $420 in 5 days. Review cashflow." |
| **Bank Reconnection** | Basiq webhook | On connection status → `RECONNECT`/`ERROR` | Critical | "Your ANZ connection needs attention. Tap to reconnect." — opens in-app browser OAuth flow (see §4.4) |
| **Health Score Drop** | Insights Engine | When score drops >10 points | Normal | "Financial health dropped to 62 (was 74). 3 new risks detected." |
| **AI Insight** | Insights Engine | On new Critical/High insight | High | "Your offset account could save $2,400/year. Tap for details." |
| **Rate Change** | Insights Engine | On interest rate change detected | High | "Variable rate on Investment Loan changed to 6.24% (+0.25%)." |
| **Subscription Alert** | TIE recurring detector | On price increase detected | Normal | "Netflix increased from $16.99 to $22.99/month." |
| **Anomaly Detected** | TIE behavioural engine | On duplicate, timing anomaly, or new merchant | High | "Unusual: $450 at 2:47 AM from a merchant you've never used." — surfaces `lib/tie/behavioural.ts` anomaly detection which currently runs silently |
| **Triage Reminder** | App-local | When uncategorised queue >10 items | Low | "You have 14 transactions to triage. Takes about 20 seconds." |
| **Monthly Budget Check-in** | Cloud Scheduler | 1st of month, 09:00 local | Normal | "March budget starts fresh. Last month you were 12% under. Keep it up!" |

### 9.3 Notification Payload Structure

```typescript
interface PushNotificationPayload {
  // FCM required fields
  title: string;
  body: string;

  // Custom data for app routing
  data: {
    type: NotificationType;        // 'daily_digest' | 'overspending' | etc.
    entityType?: string;           // 'expense' | 'loan' | 'account' | etc.
    entityId?: string;             // GRDCS-format entity ID
    actionType: 'open_app' | 'open_screen' | 'deep_link';
    actionTarget: string;          // Screen name or deep link URL
    insightId?: string;            // If triggered by an insight
    severity?: 'critical' | 'high' | 'medium' | 'low';
  };

  // Platform-specific
  android: {
    channelId: string;             // 'alerts' | 'digest' | 'sync'
    priority: 'high' | 'normal';
  };
  apns: {
    sound: 'default' | 'critical.caf';
    badge: number;                 // Unread count
    interruptionLevel: 'passive' | 'active' | 'time-sensitive';
  };
}
```

### 9.4 User Preferences

Configurable via `POST /api/v1/mobile/settings/notifications` and stored in `UserPreference`:

| Setting | Options | Default |
|---------|---------|---------|
| **Daily Digest** | Enabled / Disabled | Enabled |
| **Daily Digest time** | Hour picker (local time) | 07:00 |
| **Weekly Summary** | Enabled / Disabled | Enabled |
| **Overspending alerts** | Enabled / Disabled | Enabled |
| **Overspend threshold** | 120% / 150% / 200% | 150% |
| **Payment reminders** | Enabled / Disabled | Enabled |
| **Reminder lead days** | 1 / 2 / 3 / 7 | 2 |
| **Cashflow warnings** | Enabled / Disabled | Enabled |
| **Bank sync alerts** | Enabled / Disabled | Enabled |
| **AI insights** | Critical only / Critical+High / All | Critical+High |
| **Quiet hours** | Start/End time | 22:00–07:00 |

### 9.5 CDR Compliance for Notifications

| Rule | Implementation |
|------|---------------|
| **No CDR data in notification body** | Never include account numbers, balances, BSBs, or transaction amounts in the notification title/body visible on lock screen |
| **Vague references only** | "Your offset account could save money" NOT "Your ANZ offset (BSB 013-123) balance $45,000 could save $2,400" |
| **Detailed content inside app** | Full details shown only after biometric unlock inside the app |
| **CDR sanitisation** | Notification builder uses `sanitizeCdrMetadata()` from `lib/security/cdrAuditCompliance.ts` |

---

## 10. OFFLINE-FIRST ARCHITECTURE & SYNC

### 10.1 Local Storage Layer

**Technology:** `expo-sqlite` with SQLCipher encryption for CDR data.

**SQLite Tables:**

| Table | Content | Max Size | TTL |
|-------|---------|----------|-----|
| `snapshot_cache` | Latest `MobileSnapshot` JSON blob | ~50kb | 24 hours |
| `transactions` | `UnifiedTransaction` rows (last 90 days) | ~2MB | 90 days |
| `insights` | Active insights list | ~20kb | 24 hours |
| `categories` | Category list for pickers | ~10kb | 7 days |
| `accounts` | Account balances summary | ~15kb | 24 hours |
| `pending_writes` | Offline-created expenses/income | ~100kb | Until synced |
| `preferences` | User settings, notification prefs | ~5kb | Indefinite |
| `sync_state` | `lastSyncTimestamp`, device info | ~1kb | Indefinite |

**Encryption:**
- SQLCipher key derived from device-specific secret stored in Keychain/Keystore
- Key is protected by biometric authentication
- On biometric reset (e.g., new fingerprint), re-derive key after re-authentication

### 10.2 Sync Strategy

```
App Opens
   │
   ├── Online?
   │   ├── YES → POST /api/v1/mobile/sync
   │   │         ├── Upload pending_writes → get server IDs back
   │   │         ├── Download new transactions (delta since lastSyncTimestamp)
   │   │         ├── Download fresh snapshot
   │   │         ├── Download CDR deletions (consent revoked)
   │   │         ├── Update SQLite cache
   │   │         └── Update lastSyncTimestamp
   │   │
   │   └── NO → Load from SQLite cache
   │            ├── Show "Last updated X ago" indicator
   │            ├── Allow read of cached data
   │            ├── Allow new expense/income creation → queue in pending_writes
   │            └── Retry sync when connectivity returns (NetInfo listener)
   │
   └── Background refresh (every 30 min)
       └── Same sync flow, silent (no UI update until app foregrounded)
```

### 10.3 Conflict Resolution

| Scenario | Resolution |
|----------|-----------|
| **Offline expense created, same expense created on web** | Server detects via amount + date + merchant fuzzy match; flags as potential duplicate in sync response |
| **Transaction categorised offline, different category set on web** | Server wins — last-write-wins with timestamp comparison |
| **CDR data deleted while offline** | On next sync, `deletedEntities` array triggers local cache purge |
| **Stale snapshot** | Always replaced by fresh server snapshot; no merge needed |

### 10.4 Offline Capabilities

| Feature | Offline? | Notes |
|---------|----------|-------|
| View Daily Pulse | Yes | From cached snapshot |
| View transactions | Yes | From cached last 90 days |
| View insights | Yes | From cached insights |
| Add expense | Yes | Queued in `pending_writes`, synced when online |
| Add income | Yes | Queued in `pending_writes`, synced when online |
| Categorise transaction | No | Requires server-side MerchantMapping update |
| View cashflow forecast | Yes | From cached forecast (may be stale) |
| Capture receipt photo | Yes | Photo stored locally, upload queued |
| AI chat | No | Requires Gemini API |
| Push notifications | No | Requires FCM connection |

### 10.5 Background Sync Schedule

| Platform | Mechanism | Interval |
|----------|-----------|----------|
| iOS | `BGAppRefreshTask` | ~30 min (OS-managed, best-effort) |
| Android | WorkManager periodic task | 30 min (exact) |
| Both | On network connectivity change | Immediate sync when reconnecting |
| Both | On push notification received | Triggered by data-only FCM message |

---

## 11. SHARED CODE STRATEGY

### 11.1 What Can Be Shared

The following modules in the web app are **pure functions** with no server/browser/Next.js dependencies and can be extracted into a shared `@monitrax/core` package:

| Module | Source Path | Mobile Usage |
|--------|-------------|-------------|
| `formatCurrency()` | `lib/utils/formatters.ts` | Format all monetary values in the app |
| `toMonthly()`, `toAnnual()`, `periodsPerYear()` | `lib/utils/frequencies.ts` | Convert between WEEKLY/FORTNIGHTLY/MONTHLY/ANNUAL |
| `calculateNetWorth()` | `lib/calculations/netWorthCalculator.ts` | Local net worth recalculation from cached data |
| `calculateCashflow()` | `lib/calculations/cashflowOrchestrator.ts` | Local cashflow recalculation |
| `aggregateExpenses()` | `lib/calculations/expenseAggregator.ts` | Local expense totals |
| `aggregateIncome()` | `lib/calculations/incomeAggregator.ts` | Local income totals |
| `aggregateLoanRepayments()` | `lib/calculations/loanAggregator.ts` | Local loan totals |
| Health score types | `lib/health/types.ts` | Type definitions for health score display |
| Prisma enums | `lib/types/prisma-enums.ts` | `AccountType`, `LoanType`, `ExpenseCategory`, `Frequency`, etc. |
| GRDCS types | `lib/grdcs.ts` (types only) | `GRDCSLink`, entity contract types |

### 11.2 What Cannot Be Shared

| Module | Why |
|--------|-----|
| `lib/services/masterFinancialService.ts` | Imports Prisma client; server-only |
| `lib/auth/*.ts` | Server-side token verification |
| `lib/middleware.ts` | Next.js request/response handling |
| `lib/db.ts` | Prisma client instance |
| `lib/health/aggregateEngine.ts` | Calls DB queries internally |
| `lib/intelligence/insightsEngine.ts` | Server-side GRDCS graph traversal |

### 11.3 Package Structure

```
@monitrax/core/
├── src/
│   ├── calculations/
│   │   ├── netWorthCalculator.ts
│   │   ├── cashflowOrchestrator.ts
│   │   ├── expenseAggregator.ts
│   │   ├── incomeAggregator.ts
│   │   └── loanAggregator.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   └── frequencies.ts
│   ├── types/
│   │   ├── enums.ts          # Prisma enums (decoupled from Prisma)
│   │   ├── grdcs.ts          # GRDCS type definitions
│   │   ├── health.ts         # Health score types
│   │   └── financial.ts      # MasterSnapshot, PropertyMetrics, etc.
│   └── index.ts              # Public API barrel export
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 11.4 Publishing Strategy

| Option | Approach | When to Use |
|--------|----------|-------------|
| **Option A: npm private package** | Publish `@monitrax/core` to npm (private); install in both repos | When mobile app is in a separate repo (recommended) |
| **Option B: Git submodule** | Shared `packages/core/` as a git submodule in both repos | If you want to avoid npm publishing overhead |
| **Option C: Copy + sync** | Copy shared files manually; run diff checks in CI | Only as a temporary MVP approach |

**Recommended:** Option A (npm private package) for clean dependency management and versioning.

### 11.5 Extraction Process

1. Create `@monitrax/core` package with the files listed in §11.1
2. Remove Prisma/Next.js imports; replace with plain TypeScript types
3. Run existing Vitest tests against the extracted package
4. Publish v1.0.0 to npm (private)
5. Update web app to `import { formatCurrency } from '@monitrax/core'`
6. Install in mobile app: `npm install @monitrax/core`
7. Verify both apps pass build + tests

---

## 12. CDR COMPLIANCE FOR MOBILE

### 12.1 Regulatory Context

Monitrax handles CDR-regulated financial data via Basiq (Phase 24). The mobile app must comply with the same CDR rules as the web app (CLAUDE.md Part 13), plus mobile-specific requirements from Basiq §4 (Device Security) and §5.4–5.6 (CDR Data Handling).

**Reference:** `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`

### 12.2 CDR Data on Mobile — Rules

| Rule | Mobile Implementation |
|------|----------------------|
| **CDR data encrypted at rest** | SQLCipher encryption on SQLite database; key in Keychain/Keystore |
| **CDR data never in browser storage** | N/A (native app); equivalent: never in AsyncStorage (unencrypted) |
| **CDR data not in logs** | Strip all financial data from console.log, Sentry, Crashlytics before transmission |
| **CDR data not in error messages** | Catch errors at API boundary; show generic error to user |
| **CDR data not in URLs** | No account numbers, balances, or BSBs in deep link parameters |
| **CDR data not in notifications** | Lock screen notifications use vague references only (see §9.5) |
| **CDR data not in screenshots** | `FLAG_SECURE` (Android) + screenshot detection (iOS) on CDR screens |
| **CDR data not cached in CDN** | Mobile API responses include `Cache-Control: no-store` for CDR endpoints |
| **Consent-gated access** | All CDR API calls go through `withActiveConsent()` server-side guard |
| **Consent revocation → device wipe** | On consent revocation push notification, delete all CDR data from SQLite |
| **Data stays in Australia** | No CDR data in edge caching; API serves from Vercel Sydney region |

### 12.3 CDR Data Classification on Mobile

| Classification | What | SQLite Storage | Encryption |
|----------------|------|----------------|------------|
| **CDR-Protected** | Basiq-sourced transactions, account balances, BSBs | `transactions` table (rows with `source: 'BANK'`) | SQLCipher (mandatory) |
| **CDR-Derived** | Health scores, cashflow forecasts computed from CDR data | `snapshot_cache` | SQLCipher (mandatory) |
| **Non-CDR** | User-entered expenses, income, preferences | `pending_writes`, `preferences` | Standard SQLite (optional encryption) |

### 12.4 Consent Lifecycle on Mobile

```
Consent ACTIVE
   │
   ├── Normal operation: CDR data cached in encrypted SQLite
   │
   ├── Consent EXPIRED (daily Cloud Scheduler check)
   │   ├── Server: deletes CDR data from PostgreSQL
   │   ├── Server: sends FCM data message to all user devices
   │   ├── Mobile: receives push → deletes CDR rows from SQLite
   │   ├── Mobile: shows banner "Bank connection expired. Reconnect on desktop."
   │   └── Mobile: audit log via POST /api/v1/mobile/audit
   │
   └── Consent REVOKED (user action on web)
       ├── Server: immediate CDR data deletion (<24h SLA)
       ├── Server: sends high-priority FCM to all user devices
       ├── Mobile: immediate SQLite CDR data purge
       └── Mobile: shows confirmation "Bank data removed from this device"
```

### 12.5 Mobile Device Security Policy Addendum

Addition to `docs/policy/DEVICE_SECURITY_POLICY.md`:

| Requirement | Basiq Ref | Implementation |
|-------------|-----------|----------------|
| Device encryption at rest | §4.1 | iOS: hardware AES (default); Android: require full-disk encryption check on app launch |
| Screen lock required | §4.2 | App checks `expo-local-authentication.isEnrolled()`; blocks CDR data if no lock |
| OS auto-updates | §4.3 | Check OS version on launch; warn if outdated (>2 major versions behind) |
| Jailbreak/root detection | §4.4 | Warn user; block CDR data access on rooted devices |
| Remote wipe support | §4.5 | Firebase token revocation triggers local data purge on next sync attempt |
| No CDR data on personal devices without controls | §4.6 | App enforces biometric + encryption before displaying CDR data |

### 12.6 CDR Audit Trail for Mobile

All mobile API calls are audited server-side via `createAuditLog()` (same as web). Additional mobile-specific audit events:

| Event | Action | Logged |
|-------|--------|--------|
| Mobile device registered | `MOBILE_DEVICE_REGISTERED` | userId, platform, appVersion, FCM token hash |
| CDR data viewed on mobile | `CDR_DATA_READ` | userId, entityType, devicePlatform |
| CDR data purged from device | `CDR_DATA_DEVICE_PURGE` | userId, reason (expired/revoked/manual), devicePlatform |
| Biometric auth failed | `BIOMETRIC_AUTH_FAILURE` | userId, devicePlatform, failureReason |
| Rooted device detected | `ROOTED_DEVICE_DETECTED` | userId, devicePlatform |

---

## 13. UX PRINCIPLES

### 13.1 Core Mobile UX Philosophy

Aligned with `docs/architecture/06_UI_UX_FOUNDATION.md` and `docs/architecture/08_BRAND_UI_DESIGN.md` — "Financial Calm UI" adapted for mobile.

| Principle | Implementation |
|-----------|---------------|
| **One purpose per screen** | Daily Pulse shows everything; other screens drill into one concern |
| **One-thumb navigation** | All core actions reachable with right thumb in the bottom 60% of screen |
| **Light on data, heavy on clarity** | ~50% less information density than web; aggressive summarisation |
| **3 taps maximum** | Any critical information accessible within 3 taps from home |
| **Fast startup** | <750ms cold start target; <300ms warm start |
| **No dead-ends** | Every screen has a clear next action or back navigation |

### 13.2 Gesture Language

| Gesture | Action | Context |
|---------|--------|---------|
| **Swipe right** | Categorise transaction | Transaction feed |
| **Swipe left** | Flag / exclude | Transaction feed |
| **Long press** | AI explanation | Transaction feed |
| **Tap** | Drill down / open detail | Everywhere |
| **Pull down** | Refresh | All list/feed screens |
| **Double tap** | Quick-add expense (amount field focused) | Home screen FAB |

### 13.3 Haptic Feedback

| Event | Haptic Type | iOS | Android |
|-------|-------------|-----|---------|
| Expense saved | Success | `notificationSuccess` | `EFFECT_HEAVY_CLICK` |
| Overspend alert received | Warning | `notificationWarning` | `EFFECT_DOUBLE_CLICK` |
| Transaction categorised | Light | `selectionChanged` | `EFFECT_CLICK` |
| Pull-to-refresh threshold | Impact | `impactLight` | `EFFECT_TICK` |
| Critical insight opened | Error | `notificationError` | `EFFECT_HEAVY_CLICK` |

### 13.4 Visual Design

Follows `docs/architecture/08_BRAND_UI_DESIGN.md`:

| Element | Specification |
|---------|---------------|
| **Primary colour** | Navy `#0B1220` — headers, navigation |
| **Secondary colour** | Emerald `#16A34A` — positive numbers, success, health |
| **Accent colour** | Amber `#F59E0B` — warnings, yields |
| **Error colour** | Red `#DC2626` — critical alerts, negative cashflow |
| **Typography** | Inter (or system font fallback) |
| **Corner radius** | 16px cards, 24px modals, full-radius pills |
| **Dark mode** | `#020617` background (soft slate); synced with web preference |
| **Insight severity colours** | Critical=#DC2626, High=#EA580C, Medium=#F59E0B, Low=#3B82F6 |

### 13.5 Navigation Structure

```
┌────────────────────────────────────────────┐
│              Daily Pulse (Home)             │
│  Net Worth · Health · Cashflow · Insights  │
│                                            │
│  [+ Add]     [Quick Actions]               │
└────────────────────────────────────────────┘

Bottom Tab Bar:
┌──────────┬──────────┬──────────┬──────────┐
│   Home   │  Trans.  │ Insights │   More   │
│   🏠     │   💳     │   💡     │   ⋯     │
└──────────┴──────────┴──────────┴──────────┘

"More" tab contains:
├── Cashflow Forecast
├── Budget vs Actual (Tier 2)
├── Property Quick View (Tier 2)
├── Loan Tracker (Tier 2)
├── AI Chat (Tier 2)
├── Settings & Notifications
├── Continue on Desktop (deep link)
└── Sign Out
```

### 13.6 CMNF Mobile Edition

Simplified version of the web Cross-Module Navigation Framework:

| Feature | Web CMNF | Mobile CMNF |
|---------|----------|-------------|
| Entity drill-down | Full dialog with 4 tabs | Read-only card with summary + "View on Desktop" |
| Breadcrumbs | GRDCS-based chain | Simple back stack (no breadcrumbs) |
| State restoration | Tab + scroll + selection | Screen + scroll only |
| Cross-module linking | LinkedDataPanel | Compact linked entity chips |
| Navigation depth | Unlimited chain | Max 3 levels deep |
| "Continue on Desktop" | N/A | Universal link to web app entity page |

---

## 14. WEB-MOBILE INTERACTION MODEL

### 14.1 The Complementary Model

The web and mobile apps are **complementary, not duplicative**. Each excels at different tasks:

| Dimension | Mobile App | Web App |
|-----------|-----------|---------|
| **Primary use** | Monitor, glance, quick-act | Configure, analyse, decide |
| **Session length** | 30 seconds – 3 minutes | 5 – 30 minutes |
| **Frequency** | 3–5x daily | 1–2x weekly |
| **Data creation** | Expenses, categorisation, receipts | Entities, relationships, strategies |
| **Data consumption** | Health score, cashflow, insights, transactions | Full dashboard, reports, tax, CGT |
| **AI interaction** | Quick chat, contextual alerts | Strategy engine, forecasting, decision support |
| **Notifications** | Push (the killer feature) | In-app only |
| **Offline** | Full read + quick-add write | Not needed |
| **Auth** | Biometric + Firebase | Firebase + MFA + passkeys |

### 14.2 A User's Day with Monitrax

```
MORNING (Mobile — 30 seconds):
├── Glance at Daily Pulse (net worth, cashflow, health score)
├── Review overnight bank transactions (swipe to categorise)
├── Check push notification: "Electricity bill 15% higher than last quarter"
└── Quick-add: coffee expense from Apple Pay notification

LUNCH (Mobile — 2 minutes):
├── Check 7-day cashflow forecast
├── Review AI insight: "Offset account can save $2,400/year if you redirect savings"
└── Tap "Continue on Desktop" to deep-dive later

EVENING (Web — 15 minutes):
├── Full dashboard review
├── Run strategy analysis on property refinancing
├── Review CGT position before selling shares
├── Update property valuation after appraisal
└── Generate monthly report for accountant

WEEKLY (Mobile — 1 minute):
├── Push notification: Weekly summary
├── Budget vs Actual progress check
└── Review spending trends by category

MONTHLY (Web — 30 minutes):
├── Full CFO review (score, risks, actions)
├── Debt planner optimisation
├── Tax position check
└── Document management / filing
```

### 14.3 "Continue on Desktop" Deep Links

The mobile app generates universal links that open the web app directly to the relevant entity:

| Mobile Context | Deep Link URL | Web Destination |
|----------------|---------------|-----------------|
| Property insight | `https://app.monitrax.com/dashboard/properties?entity=property-83fa3a2c` | Property detail dialog |
| Loan payment alert | `https://app.monitrax.com/dashboard/loans?entity=loan-55` | Loan detail dialog |
| Cashflow forecast | `https://app.monitrax.com/dashboard/cfo` | CFO Intelligence page |
| Transaction detail | `https://app.monitrax.com/dashboard/expenses?entity=expense-22` | Expense detail dialog |
| Health score detail | `https://app.monitrax.com/dashboard` | Dashboard with health modal |

**Implementation:**
- Universal Links (iOS) + App Links (Android) for bidirectional deep linking
- Web app registers `apple-app-site-association` and `assetlinks.json`
- If mobile app is installed, tapping a web link opens the entity in the mobile app
- If not installed, falls through to the web app in browser

### 14.4 Data Synchronisation Between Platforms

| Action on Mobile | Sync to Web | Latency |
|-----------------|-------------|---------|
| Expense created | Immediate (via API) | <1 second |
| Transaction categorised | Immediate (via API) | <1 second |
| Receipt uploaded | Immediate (via API) | 2-5 seconds (upload time) |
| Insight dismissed | Immediate (via API) | <1 second |
| Notification preferences changed | Immediate (via API) | <1 second |

| Action on Web | Sync to Mobile | Latency |
|---------------|----------------|---------|
| Entity created/updated | Next sync cycle | ≤30 minutes (or on next app open) |
| CDR consent revoked | Push notification + immediate purge | <5 minutes |
| Basiq connection status changed | Push notification | <5 minutes |
| New Critical/High insight | Push notification | <2 minutes |

---

## 15. PRE-REQUISITES & DEPENDENCIES

### 15.1 Backend Pre-requisites (Must Complete Before Sprint 0)

| Priority | Item | Current State | Action Required |
|----------|------|--------------|-----------------|
| **P0** | API versioning strategy | No versioning; all routes at `/api/*` | Implement `/api/v1/mobile/*` prefix for mobile endpoints; web routes remain unversioned |
| **P0** | Cloud Armor WAF | Not deployed | Deploy WAF rules; mobile increases API attack surface |
| **P0** | FCM setup in Firebase Console | Not configured | Enable Cloud Messaging; configure APNs certificate for iOS |
| **P1** | Redis for rate limiting | In-memory only (`lib/security/rateLimit.ts`) | Deploy Cloud Memorystore (Redis); mobile adds significant API call volume |
| **P1** | Snapshot caching | No caching; every call hits DB | Cache `getMasterFinancialSnapshot()` result for 60 seconds (Redis or in-memory with TTL) |
| **P1** | Staging environment | Only PROD and DEV | Deploy staging Vercel preview tied to staging Cloud SQL instance |
| **P2** | CDR mobile policy addendum | Device policy covers desktop only | Add mobile device requirements to `docs/policy/DEVICE_SECURITY_POLICY.md` |
| **P2** | Apple Developer account | Not registered | Register at developer.apple.com ($149 AUD/year) |
| **P2** | Google Play Developer account | Not registered | Register at play.google.com/console ($25 USD one-time) |

### 15.2 Completed Dependencies

These phases are **already complete** and provide the foundation for the mobile app:

| Phase | What It Provides | Status |
|-------|-----------------|--------|
| Phase 08 — GRDCS | Entity linking, canonical IDs, relationship graph | COMPLETE |
| Phase 09 — Health & Navigation | Health indicators, navigation intelligence | COMPLETE |
| Phase 10 — Auth & Security | Firebase Auth, MFA, RBAC, passkeys, audit logging | COMPLETE |
| Phase 12 — Financial Health | Health score engine (0-100, 7 categories) | COMPLETE |
| Phase 13 — Transactional Intelligence | Unified transactions, AI categorisation, recurring detection | COMPLETE |
| Phase 14 — Cashflow Optimisation | Forecasting, stress testing, optimisation | COMPLETE |
| Phase 14.5 — Mobile Web UI | Responsive layout (bridge until native app ships) | COMPLETE |
| Phase 17 — Personal CFO | CFO score, risk radar, action engine | COMPLETE |
| Phase 24 — Open Banking (Basiq) | Bank connections, transaction sync, CDR compliance | COMPLETE |
| Phase 27 — Gemini AI | All AI on Gemini; centralised `lib/ai/google/` | COMPLETE |
| Phase 29 — Household + AI Categorisation | Smart categorisation, merchant learning | COMPLETE |
| Phase 31 — Cashflow Intelligence | AI summary, leak detection, waterfall chart | COMPLETE |
| Phase 34 — CDR Security Hardening | RBAC on 70+ routes, MFA enforcement on CDR routes | COMPLETE |
| Phase 35 — CDR Data Lifecycle | Consent-driven deletion, `withActiveConsent()` guard | COMPLETE |

### 15.3 Operational Readiness (from BAU Framework)

Per `docs/bau-framework/03_GAP_ANALYSIS_REPORT.md`, these operational items should be addressed before mobile launch:

| Item | BAU Ref | Why |
|------|---------|-----|
| Basiq Operations runbook | Gap Analysis §P0 | Mobile users will report bank sync issues; need documented resolution procedures |
| Extended incident scenarios | Gap Analysis §P0 | Vercel/Firebase/GCP outage procedures needed for dual-platform support |
| Secrets management runbook | Gap Analysis §P1 | FCM keys, APNs certificates, EAS credentials need documented rotation |
| Formal SLAs | BAU Framework §SLAs | Mobile users expect higher availability; need defined targets |

### 15.4 Cost Estimates

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Program | $149 AUD | Annual |
| Google Play Developer | $25 USD | One-time |
| EAS Build (Expo) | Free tier / $99 USD/month (Production) | Monthly |
| FCM (Firebase Cloud Messaging) | Free (up to 500M messages/month) | — |
| Cloud Memorystore (Redis) | ~$30-50 AUD/month (Basic, 1GB) | Monthly |
| Cloud Function (push notification builder) | ~$5-10 AUD/month (at current scale) | Monthly |
| **Total incremental cost** | **~$185-310 AUD/month** | — |

---

## 16. BUILD SEQUENCE & SPRINT PLAN

### 16.1 Sprint Overview (~16 weeks total)

| Sprint | Duration | Focus | Key Deliverables |
|--------|----------|-------|-----------------|
| **Sprint 0** | 2 weeks | Foundation | Expo project, Firebase Auth, navigation skeleton, shared code extraction, backend pre-requisites |
| **Sprint 1** | 3 weeks | Daily Pulse | Home screen, mobile snapshot API, SQLite cache, biometric auth |
| **Sprint 2** | 3 weeks | Transactions | Transaction feed, swipe-to-categorise, delta sync, quick-add expense/income |
| **Sprint 3** | 2 weeks | Notifications | FCM integration, Cloud Function, daily digest, overspending alerts, cashflow forecast |
| **Sprint 4** | 2 weeks | Intelligence | Insights hub, health score detail, budget vs actual, AI chat |
| **Sprint 5** | 2 weeks | Polish | Document capture, offline mode hardening, CDR compliance verification, performance tuning |
| **Sprint 6** | 2 weeks | Ship | TestFlight/Internal Testing, App Store assets, privacy policy, App Store submission |

### 16.2 Sprint 0 — Foundation (Weeks 1-2)

**Backend tasks:**
- [ ] Implement API versioning: create `/api/v1/mobile/` route group
- [ ] Deploy Cloud Armor WAF rules
- [ ] Set up FCM in Firebase Console; configure APNs certificate
- [ ] Add snapshot caching (60-second TTL) to `getMasterFinancialSnapshot()`
- [ ] Register Apple Developer + Google Play accounts

**Mobile tasks:**
- [ ] Initialise Expo project with Expo Router
- [ ] Configure EAS Build (eas.json) for iOS + Android
- [ ] Integrate `@react-native-firebase/auth` with existing Firebase project
- [ ] Build login screen (email/password, Google, Apple Sign-In)
- [ ] Set up Zustand store + React Query client
- [ ] Configure `expo-sqlite` with SQLCipher encryption
- [ ] Set up `expo-secure-store` for credential storage

**Shared code tasks:**
- [ ] Extract `@monitrax/core` package from web app `lib/`
- [ ] Publish v1.0.0 to npm (private)
- [ ] Install in both web and mobile projects; verify builds pass

### 16.3 Sprint 1 — Daily Pulse (Weeks 3-5)

- [ ] Build `GET /api/v1/mobile/snapshot` endpoint (projection of `getMasterFinancialSnapshot()`)
- [ ] Build Daily Pulse home screen with all widgets (§4.1)
- [ ] Implement biometric unlock flow (Face ID / Fingerprint)
- [ ] Build SQLite cache layer for snapshot data
- [ ] Implement pull-to-refresh
- [ ] Build account balances horizontal scroll
- [ ] Build health score ring component
- [ ] Build insight card component with severity colours
- [ ] Implement "Last updated X ago" offline indicator

### 16.4 Sprint 2 — Transactions (Weeks 6-8)

- [ ] Build `GET /api/v1/mobile/transactions` endpoint with delta sync
- [ ] Build `PATCH /api/v1/mobile/transaction/{id}/categorize` endpoint
- [ ] Build `POST /api/v1/mobile/expense` and `/income` endpoints
- [ ] Build `POST /api/v1/mobile/sync` endpoint
- [ ] Build transaction feed screen with FlashList virtualisation
- [ ] Implement swipe-right-to-categorise gesture
- [ ] Build category picker bottom sheet
- [ ] Build quick-add expense screen with auto-focused amount keypad
- [ ] Build quick-add income screen
- [ ] Implement offline pending_writes queue
- [ ] Build delta sync engine (NetInfo connectivity listener)

### 16.5 Sprint 3 — Notifications (Weeks 9-10)

- [ ] Deploy GCP Cloud Function for notification building
- [ ] Implement FCM token registration (`POST /api/v1/mobile/device/register`)
- [ ] Build notification permission request flow
- [ ] Implement daily digest Cloud Scheduler trigger
- [ ] Implement overspending alert trigger (real-time from TIE)
- [ ] Implement upcoming payment trigger
- [ ] Implement cashflow risk trigger
- [ ] Build cashflow mini-dashboard screen (§4.3)
- [ ] Build notification preferences screen
- [ ] Implement CDR notification sanitisation

### 16.6 Sprint 4 — Intelligence (Weeks 11-12)

- [ ] Build `GET /api/v1/mobile/insights` endpoint
- [ ] Build insights & alerts hub screen (§4.4)
- [ ] Build financial health score detail screen (§4.7)
- [ ] Implement insight dismiss/save/snooze actions
- [ ] Build budget vs actual progress view (Tier 2 stretch)
- [ ] Integrate AI chat (Tier 2 stretch — Gemini via existing `/api/ai/ask`)
- [ ] Implement haptic feedback system

### 16.7 Sprint 5 — Polish (Weeks 13-14)

- [ ] Build document capture screen (camera → upload → OCR → auto-fill)
- [ ] Harden offline mode (test airplane mode scenarios)
- [ ] CDR compliance verification checklist (§12)
- [ ] Performance profiling and optimisation (<750ms cold start)
- [ ] Accessibility audit (VoiceOver/TalkBack, minimum contrast ratios)
- [ ] Dark mode implementation and testing
- [ ] Deep link configuration (Universal Links + App Links)
- [ ] Implement "Continue on Desktop" flow
- [ ] Error handling and crash reporting setup (Sentry — with CDR data stripped)

### 16.8 Sprint 6 — Ship (Weeks 15-16)

- [ ] TestFlight beta distribution (iOS)
- [ ] Google Play Internal Testing track
- [ ] Prepare App Store assets (screenshots, description, privacy labels)
- [ ] Write App Store privacy policy (CDR-compliant)
- [ ] Create `apple-app-site-association` and `assetlinks.json`
- [ ] App Store submission (iOS)
- [ ] Google Play submission (Android)
- [ ] Update `docs/policy/DEVICE_SECURITY_POLICY.md` with mobile addendum
- [ ] Create Basiq operations runbook for mobile-specific issues
- [ ] Update `MASTER_BLUEPRINT.md` with Phase 15 status

---

## 17. TESTING STRATEGY

### 17.1 Testing Layers

| Layer | Tool | What It Tests |
|-------|------|---------------|
| **Unit tests** | Vitest (shared `@monitrax/core`) | Calculation engines, formatters, frequency converters |
| **Component tests** | React Native Testing Library | Screen rendering, user interactions, state changes |
| **Integration tests** | Detox (E2E) | Full user flows: login → pulse → categorise → add expense |
| **API contract tests** | Vitest (backend) | Mobile endpoint responses match TypeScript interfaces |
| **Performance tests** | Flashlight (React Native) | Startup time, frame rate, memory usage |
| **Manual testing** | Physical devices | Biometrics, push notifications, gestures, dark mode |

### 17.2 Device Testing Matrix

| Device | OS Version | Screen Size | Priority |
|--------|-----------|-------------|----------|
| iPhone SE (3rd gen) | iOS 16+ | 375pt / 4.7" | High (smallest supported) |
| iPhone 15 Pro | iOS 17+ | 393pt / 6.1" | High (primary target) |
| iPhone 15 Pro Max | iOS 17+ | 430pt / 6.7" | Medium |
| iPad Mini (6th gen) | iPadOS 17+ | 744pt / 8.3" | Low (tablet support Tier 3) |
| Pixel 7 | Android 13+ | 412dp / 6.3" | High (reference Android) |
| Samsung Galaxy S24 | Android 14+ | 360dp / 6.2" | High (popular Samsung) |
| Pixel 4a | Android 12+ | 393dp / 5.8" | Medium (lower-end) |

### 17.3 Critical Test Scenarios

**Authentication:**
- [ ] Fresh login with email/password
- [ ] Fresh login with Google OAuth
- [ ] Fresh login with Apple Sign-In (iOS only)
- [ ] Biometric unlock after app background (>5 min)
- [ ] Biometric enrollment change → re-authentication required
- [ ] MFA challenge on CDR data access
- [ ] Token refresh after 1-hour expiry
- [ ] Session timeout after 60 minutes idle

**Daily Pulse:**
- [ ] First load shows data within 2 seconds
- [ ] Pull-to-refresh updates all widgets
- [ ] Offline mode shows cached data with "Last updated" badge
- [ ] Health score ring animates correctly
- [ ] Tap insight navigates to detail

**Transactions:**
- [ ] Delta sync fetches only new transactions
- [ ] Swipe-right categorisation updates transaction
- [ ] FlashList smooth scroll at 10,000+ items
- [ ] Search filters work (merchant, category, amount)
- [ ] Offline: cached transactions display correctly

**Quick-Add:**
- [ ] Expense creation saves and syncs immediately
- [ ] Offline expense creation queues in pending_writes
- [ ] Offline expense syncs when connectivity returns
- [ ] Receipt photo OCR auto-fills fields
- [ ] Amount keypad auto-focuses on open

**Push Notifications:**
- [ ] Daily digest arrives at configured time
- [ ] Overspending alert triggers correctly
- [ ] Tapping notification opens correct screen
- [ ] CDR data NOT visible in notification on lock screen
- [ ] Quiet hours respected

**CDR Compliance:**
- [ ] CDR data encrypted in SQLite (verify via adb/lldb)
- [ ] Consent revocation push triggers local data purge
- [ ] Rooted/jailbroken device blocks CDR data display
- [ ] No CDR data in Sentry crash reports
- [ ] Screenshot prevention active on CDR screens (Android)

**Offline Mode:**
- [ ] All cached screens accessible in airplane mode
- [ ] Pending writes sync correctly on reconnection
- [ ] Conflict resolution works for duplicate expenses
- [ ] Stale data indicator shows "Last updated X ago"

### 17.4 Performance Benchmarks

| Metric | Target | Tool |
|--------|--------|------|
| Cold start | <750ms | Flashlight |
| Warm start | <300ms | Flashlight |
| Time to interactive (Daily Pulse) | <1.5 seconds | Flashlight |
| Transaction list frame rate | ≥58 FPS | Flashlight |
| SQLite query (cached snapshot) | <10ms | Custom profiling |
| API response (mobile snapshot) | <150ms P95 | Server-side monitoring |
| Memory usage (idle) | <150MB | Xcode/Android Studio profiler |
| App binary size | <30MB | EAS Build output |

---

## 18. RISKS & MITIGATIONS

### 18.1 Technical Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| **Solo developer bandwidth** | High | High | MVP scoped to 6 core screens only; resist feature creep; Expo + EAS reduce build/deploy overhead |
| **React Native performance with financial data** | Medium | Low | FlashList for virtualised lists; SQLite for local queries; Hermes engine; profile early |
| **Firebase Auth token refresh on background wake** | Medium | Medium | Use `onIdTokenChanged()` listener; store refresh token in Keychain; handle edge cases in Sprint 1 |
| **App Store rejection (financial app scrutiny)** | High | Medium | Prepare privacy nutrition labels early; CDR compliance docs ready; no cryptocurrency trading; Apple Sign-In included |
| **Expo SDK breaking changes** | Medium | Low | Pin SDK version; test upgrades on staging branch; EAS handles build isolation |
| **CDR data leak via crash reports** | High | Low | Strip all financial fields before Sentry transmission; test with intentional crashes; CDR audit |
| **SQLCipher performance overhead** | Low | Low | Benchmark encrypted vs unencrypted SQLite in Sprint 1; CDR data is a small subset of total cache |

### 18.2 Operational Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| **Maintaining two platforms solo** | High | High | Shared code via `@monitrax/core` reduces duplication; OTA updates for quick fixes; consider BAU hire before launch (see §15.3) |
| **App Store review delays** | Medium | Medium | API versioning (`/api/v1/`) ensures backend changes don't break apps in review; OTA for non-native changes |
| **Increased API load from mobile** | Medium | Medium | Redis rate limiting (§15.1); snapshot caching; delta sync reduces redundant requests |
| **Push notification reliability** | Medium | Medium | FCM has built-in retry; implement delivery confirmation; fallback to in-app polling |
| **User support for mobile-specific issues** | Medium | High | Basiq operations runbook; documented troubleshooting for biometric failures; in-app feedback form |

### 18.3 CDR/Compliance Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| **CDR data visible on lock screen** | Critical | Low | Notifications use vague references only (§9.5); tested in Sprint 3 |
| **CDR data persists after consent revocation** | Critical | Low | Push-triggered local purge; daily sync checks consent status; tested in Sprint 5 |
| **Basiq accreditation delayed by mobile** | High | Medium | Complete CDR P0 items (WAF, Security Command Center) before mobile launch; mobile policy addendum written in Sprint 0 |
| **Device encryption not enforced** | High | Low | App checks `expo-local-authentication.isEnrolled()` on launch; blocks CDR data if no device lock |

### 18.4 Business Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| **Low adoption (users prefer web)** | Medium | Medium | Push notifications are the differentiator; daily digest creates habit; measure DAU/MAU from week 1 |
| **Feature creep ("just add X")** | High | High | Tier system (§4/§5) defines clear boundaries; non-MVP features tracked as Tier 2/3 |
| **Competition ships similar app** | Low | Low | Monitrax's differentiator is the GRDCS relational intelligence and Australian financial context (LVR, franking, offset accounts) |

---

## 19. ACCEPTANCE CRITERIA & DELIVERABLES

### 19.1 Functional Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| F1 | User can log in with email/password, Google, and Apple Sign-In | Manual test on iOS + Android |
| F2 | User can unlock app with Face ID / Fingerprint | Manual test on physical devices |
| F3 | Daily Pulse screen loads within 2 seconds of app open | Performance benchmark |
| F4 | All financial data matches web app dashboard (net worth, cashflow, health score) | Cross-platform comparison test |
| F5 | Transaction feed shows bank transactions with correct categorisation | API contract test + manual verification |
| F6 | Swipe-to-categorise updates transaction category on server | Integration test |
| F7 | Quick-add expense creates expense visible on both mobile and web | Cross-platform sync test |
| F8 | Push notifications delivered for all 10 notification types (§9.2) | Manual test with test triggers |
| F9 | Daily Digest notification arrives at configured time | Scheduled test |
| F10 | Insights display with correct severity colours and actions | Visual comparison with web |
| F11 | Cashflow forecast shows 14-day projection | API contract test |
| F12 | Offline mode displays cached data when no connectivity | Airplane mode test |
| F13 | Offline-created expenses sync when connectivity returns | Network toggle test |

### 19.2 Technical Acceptance Criteria

| # | Criterion | Target |
|---|-----------|--------|
| T1 | Cold start time | <750ms |
| T2 | Warm start time | <300ms |
| T3 | Mobile snapshot API P95 latency | <150ms |
| T4 | Transaction feed scroll frame rate | ≥58 FPS |
| T5 | App binary size | <30MB |
| T6 | Delta sync bandwidth reduction | ≥70% vs full fetch |
| T7 | SQLite cache query time | <10ms |
| T8 | Memory usage (idle) | <150MB |
| T9 | CMNF mobile response time | <50ms |

### 19.3 CDR Compliance Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| C1 | CDR data encrypted at rest in SQLite | Forensic analysis of DB file |
| C2 | No CDR data in push notification body (lock screen safe) | Manual review of all notification types |
| C3 | CDR data purged from device within 5 minutes of consent revocation | End-to-end revocation test |
| C4 | No CDR data in crash reports / error logs | Intentional crash test with Sentry inspection |
| C5 | MFA challenge required before CDR data access | Manual test with MFA-enforced user |
| C6 | Rooted/jailbroken device blocks CDR data display | Test on rooted Android + jailbroken iOS simulator |
| C7 | All mobile API calls generate audit log entries | Query AuditLog table after test session |
| C8 | Screenshot prevention active on CDR screens (Android) | Manual test with screen capture |

### 19.4 UX Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| U1 | User can view entire financial state in <15 seconds | Timed user test |
| U2 | All critical information accessible in ≤3 taps from home | Navigation path audit |
| U3 | No dead-end screens (every screen has a next action or back) | Screen-by-screen review |
| U4 | All touch targets ≥44x44pt | Accessibility audit |
| U5 | Dark mode renders correctly on all screens | Visual review |
| U6 | VoiceOver (iOS) / TalkBack (Android) reads all content | Accessibility test |

### 19.5 Deliverables Checklist

| # | Deliverable | Sprint |
|---|------------|--------|
| D1 | `@monitrax/core` shared package published to npm | Sprint 0 |
| D2 | Mobile API endpoints (`/api/v1/mobile/*`) deployed to production | Sprint 1-2 |
| D3 | React Native + Expo mobile app (iOS) | Sprint 0-5 |
| D4 | React Native + Expo mobile app (Android) | Sprint 0-5 |
| D5 | Daily Pulse home screen | Sprint 1 |
| D6 | Transaction feed with swipe-to-categorise | Sprint 2 |
| D7 | Quick-add expense and income screens | Sprint 2 |
| D8 | Push notification infrastructure (Cloud Function + FCM) | Sprint 3 |
| D9 | Cashflow mini-dashboard | Sprint 3 |
| D10 | Insights & Alerts hub | Sprint 4 |
| D11 | Financial Health Score detail screen | Sprint 4 |
| D12 | Offline-first SQLite cache layer | Sprint 1-2 |
| D13 | Delta sync engine | Sprint 2 |
| D14 | Biometric authentication flow | Sprint 1 |
| D15 | CDR compliance verification report | Sprint 5 |
| D16 | App Store submission (iOS) | Sprint 6 |
| D17 | Google Play submission (Android) | Sprint 6 |
| D18 | Updated DEVICE_SECURITY_POLICY.md (mobile addendum) | Sprint 6 |
| D19 | Updated MASTER_BLUEPRINT.md | Sprint 6 |
| D20 | Basiq mobile operations runbook | Sprint 6 |

---

## 20. IMPLEMENTATION STATUS

**Status:** PLANNED — Blueprint v2.0 Complete
**Last Updated:** 2026-04-11
**Blueprint Version:** 2.0 (complete rewrite from v1.0)

### 20.1 What Changed from v1.0

| Aspect | v1.0 (Original) | v2.0 (This Document) |
|--------|-----------------|----------------------|
| **Scope** | High-level feature list | Full technical specification with API contracts, data flows, TypeScript interfaces |
| **CDR compliance** | Not addressed | Full CDR mobile compliance section (§12) based on Basiq accreditation requirements |
| **Pre-requisites** | Not analysed | Detailed analysis from BAU framework gap assessment (§15) |
| **API specification** | "Mobile endpoints" mentioned | 13 endpoints with request/response TypeScript interfaces (§7) |
| **Security** | "Firebase Auth" mentioned | Biometric unlock, MFA, certificate pinning, jailbreak detection, screenshot prevention (§8) |
| **Push notifications** | "Notifications delivered" mentioned | 10 notification types, CDR sanitisation rules, user preferences, Cloud Function architecture (§9) |
| **Offline architecture** | "SQLite via Expo" mentioned | Full offline-first architecture with SQLite schema, sync strategy, conflict resolution (§10) |
| **Shared code** | Not addressed | `@monitrax/core` extraction plan with module inventory and publishing strategy (§11) |
| **Testing** | Basic acceptance criteria | Device matrix, critical test scenarios, performance benchmarks, CDR compliance tests (§17) |
| **Sprint plan** | Not included | 7-sprint plan with detailed task lists per sprint (§16) |
| **Cost analysis** | Not included | $185-310 AUD/month incremental cost estimate (§15.4) |

### 20.2 Current Progress

| Item | Status |
|------|--------|
| Blueprint v2.0 document | COMPLETE |
| Backend pre-requisites (§15.1) | NOT STARTED |
| Expo project initialisation | NOT STARTED |
| `@monitrax/core` extraction | NOT STARTED |
| Apple Developer account | NOT REGISTERED |
| Google Play Developer account | NOT REGISTERED |
| Cloud Armor WAF deployment | NOT DEPLOYED |
| FCM configuration | NOT CONFIGURED |

### 20.3 Phase Dependencies Status

| Dependency | Status | Blocker? |
|-----------|--------|----------|
| Phase 08 (GRDCS) | COMPLETE | No |
| Phase 09 (Health + Navigation) | COMPLETE | No |
| Phase 10 (Auth & Security) | COMPLETE | No |
| Phase 13 (Transactional Intelligence) | COMPLETE | No |
| Phase 14 (Cashflow Optimisation) | COMPLETE | No |
| Phase 24 (Open Banking / Basiq) | COMPLETE | No |
| Phase 35 (CDR Data Lifecycle) | COMPLETE | No |
| API versioning | NOT STARTED | **YES — P0 pre-requisite** |
| Cloud Armor WAF | NOT STARTED | **YES — P0 pre-requisite** |
| FCM setup | NOT STARTED | **YES — P0 pre-requisite** |

### 20.4 Next Steps

1. Complete P0 backend pre-requisites (API versioning, Cloud Armor, FCM)
2. Register Apple Developer and Google Play accounts
3. Begin Sprint 0: Expo project initialisation and `@monitrax/core` extraction
4. Update `MASTER_BLUEPRINT.md` to reflect Phase 15 status as "In Progress"

---

# END OF PHASE 15 — MOBILE COMPANION APP v2.0
