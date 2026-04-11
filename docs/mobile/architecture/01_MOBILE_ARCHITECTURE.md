# Mobile Companion App — Architecture Overview

**Date:** 2026-04-11 | **Version:** 1.0 | **Status:** ACTIVE
**Blueprint Ref:** `docs/mobile/blueprint/PHASE_15_MOBILE_COMPANION_APP.md` §3, §6, §10, §11

---

## 1. TECHNOLOGY STACK

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | React Native | Latest stable | Cross-platform native app |
| **Toolchain** | Expo SDK | 53+ | Managed workflow, OTA updates |
| **JS Engine** | Hermes | Bundled with Expo | Optimised startup, lower memory |
| **Navigation** | Expo Router | Latest | File-based routing (Next.js-like) |
| **State (server)** | React Query (TanStack) | v5+ | Server state, caching, refetching |
| **State (local)** | Zustand | v4+ | Lightweight client state |
| **Local DB** | expo-sqlite + SQLCipher | Latest | Offline cache, CDR-encrypted |
| **Auth** | @react-native-firebase/auth | Latest | Firebase Auth SDK for RN |
| **Push** | @react-native-firebase/messaging | Latest | FCM for iOS (via APNs) + Android |
| **Charts** | Victory Native + react-native-svg | Latest | Lightweight native charts |
| **Lists** | @shopify/flash-list | Latest | Virtualised lists (transactions) |
| **Biometrics** | expo-local-authentication | Latest | Face ID / Fingerprint |
| **Secure Storage** | expo-secure-store | Latest | Keychain (iOS) / Keystore (Android) |
| **Camera** | expo-camera | Latest | Receipt capture |
| **Network** | @react-native-community/netinfo | Latest | Connectivity monitoring for sync |
| **Build** | EAS Build + EAS Submit | Latest | Cloud builds, App Store submission |
| **OTA** | EAS Update | Latest | Over-the-air JS bundle updates |
| **Shared Logic** | @monitrax/core | 1.0.0 | Shared calculations, formatters, types |
| **Error Tracking** | Sentry for React Native | Latest | Crash reporting (CDR-stripped) |

---

## 2. HIGH-LEVEL ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────────┐
│                        USER DEVICE                                 │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 REACT NATIVE APP (Expo)                     │   │
│  │                                                             │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │   Screens   │  │  @monitrax/  │  │  Push Handler    │   │   │
│  │  │  (Expo      │  │  core        │  │  (FCM listener,  │   │   │
│  │  │   Router)   │  │  (shared     │  │   deep link      │   │   │
│  │  │             │  │   logic)     │  │   router)        │   │   │
│  │  └──────┬──────┘  └──────────────┘  └──────────────────┘   │   │
│  │         │                                                   │   │
│  │  ┌──────▼──────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │  Zustand +  │  │   SQLite     │  │  Firebase Auth   │   │   │
│  │  │  React      │◄─┤   Cache      │  │  + Biometric     │   │   │
│  │  │  Query      │─►│  (SQLCipher) │  │    Unlock        │   │   │
│  │  └──────┬──────┘  └──────────────┘  └────────┬─────────┘   │   │
│  │         │                                     │             │   │
│  │  ┌──────▼──────────────────────────────────────▼─────────┐  │   │
│  │  │              API Client (HTTPS + Bearer Token)        │  │   │
│  │  └──────────────────────────┬────────────────────────────┘  │   │
│  └─────────────────────────────┼───────────────────────────────┘   │
└────────────────────────────────┼───────────────────────────────────┘
                                 │
                        HTTPS (TLS 1.2+)
                                 │
┌────────────────────────────────▼───────────────────────────────────┐
│                    MONITRAX BACKEND (Vercel)                        │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  /api/v1/mobile/*  (versioned mobile endpoints)              │  │
│  │                                                              │  │
│  │  verifyGCPIdToken() → withPermission() → withActiveConsent() │  │
│  │       │                                                      │  │
│  │       ▼                                                      │  │
│  │  getMasterFinancialSnapshot()  →  Mobile Projection Layer    │  │
│  │  (canonical calculation engines)   (strip to <200kb)         │  │
│  └──────────────────────────────────┬───────────────────────────┘  │
│                                     │                              │
│  ┌──────────────────────────────────▼───────────────────────────┐  │
│  │  GCP Cloud SQL (PostgreSQL) — australia-southeast1 (Sydney)  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    PUSH NOTIFICATION PIPELINE                       │
│                                                                    │
│  Insights Engine ──┐                                               │
│  Cloud Scheduler ──┼──► GCP Cloud Function ──► FCM ──► Device     │
│  Basiq Webhook ────┘    (notification builder)                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. KEY ARCHITECTURAL DECISIONS

| # | Decision | Rationale | Alternatives Rejected |
|---|----------|-----------|----------------------|
| AD-1 | React Native + Expo | TypeScript team; shared code; OTA updates; single codebase | Flutter (Dart rewrite), Native Swift/Kotlin (two codebases), PWA (no push/biometrics/SQLite) |
| AD-2 | Separate repository | Independent CI/CD pipelines; no monorepo complexity for solo dev | Monorepo (npm workspaces — adds build complexity) |
| AD-3 | Offline-first with SQLite | Users check finances in low-connectivity; cached data always available | Online-only (poor UX on mobile); AsyncStorage (no encryption, no SQL queries) |
| AD-4 | SQLCipher for CDR data | CDR §5.4 requires encryption at rest; SQLCipher is industry-standard | Realm (heavier); plain SQLite + Expo SecureStore per-field (impractical) |
| AD-5 | Versioned mobile API (`/api/v1/`) | Mobile app updates lag behind backend by days (App Store review) | Unversioned (breaking changes strand users); GraphQL (over-engineering) |
| AD-6 | Firebase Auth (same as web) | Single identity provider; no separate auth system to maintain | Custom JWT for mobile (violates SSOT; creates auth drift) |
| AD-7 | `@monitrax/core` shared package | Reuse formatters, calculators, types across web + mobile | Copy-paste (drift risk); monorepo (complexity for solo dev) |
| AD-8 | Server-side projection (not client filtering) | <200kb payload guarantee; CDR data never over-sent | Full snapshot + client filter (CDR over-exposure; bandwidth waste) |
| AD-9 | FCM for push (not custom WebSocket) | GCP-native; handles APNs bridge; free at current scale | WebSocket (custom infra; connection management burden) |
| AD-10 | Sentry (CDR-stripped) for crash reporting | Industry standard; supports RN; CDR fields stripped before send | Crashlytics (Firebase ecosystem but less configurable data scrubbing) |

---

## 4. DATA FLOW PATTERNS

### 4.1 Read Flow (Daily Pulse)

```
App Open → Biometric → Firebase token refresh → GET /api/v1/mobile/snapshot
  → Server: verifyGCPIdToken → withPermission → getMasterFinancialSnapshot()
  → Mobile Projection Layer strips to <50kb
  → App: store in SQLite cache → render Daily Pulse
  → Schedule background refresh (30 min)
```

### 4.2 Write Flow (Quick-Add Expense)

```
User taps "Add Expense" → fills form → POST /api/v1/mobile/expense
  ├── ONLINE: Server creates Expense → returns ID → update SQLite → success haptic
  └── OFFLINE: Store in pending_writes → show "Saved offline" indicator
               → NetInfo detects connectivity → POST /api/v1/mobile/sync
               → Server creates Expense → returns real ID → update SQLite
```

### 4.3 Push Notification Flow

```
Insights Engine detects overspending → triggers GCP Cloud Function
  → Cloud Function: sanitizeCdrMetadata() → build FCM payload
  → FCM → APNs (iOS) / FCM (Android) → device notification
  → User taps → App opens → deep link router → Insights screen
```

### 4.4 Consent Revocation Flow

```
User revokes consent on web → Server: deleteCDRData() → sends FCM data message
  → Mobile: receives high-priority push → purge CDR rows from SQLite
  → Show banner: "Bank data removed from this device"
  → Log: POST /api/v1/mobile/audit (CDR_DATA_DEVICE_PURGE)
```

---

## 5. OFFLINE-FIRST DESIGN

### 5.1 Cache Hierarchy

```
Priority 1 (always cached): Snapshot, Accounts, Categories, Preferences
Priority 2 (cached with TTL): Transactions (90 days), Insights (24h)
Priority 3 (ephemeral): Pending writes (until synced), Sync state
```

### 5.2 Conflict Resolution

| Scenario | Strategy |
|----------|----------|
| Stale snapshot | Replace with server version (no merge) |
| Transaction category conflict | Last-write-wins (server timestamp) |
| Duplicate expense (offline + web) | Server detects via fuzzy match; flags in sync response |
| CDR data deleted server-side | Sync response includes `deletedEntities`; mobile purges |

### 5.3 Background Sync

| Platform | Mechanism | Interval |
|----------|-----------|----------|
| iOS | BGAppRefreshTask | ~30 min (OS-managed) |
| Android | WorkManager periodic | 30 min (exact) |
| Both | NetInfo connectivity change | Immediate on reconnect |
| Both | FCM data message | Triggered by server events |

---

## 6. SECURITY ARCHITECTURE

> **Full details:** Blueprint §8 (Authentication & Security)
> **Shared policies:** `docs/policy/MONITRAX_SECURITY_POLICIES.md`

| Layer | Control |
|-------|---------|
| **Transport** | TLS 1.2+ (Vercel enforced); certificate pinning |
| **Auth** | Firebase Auth (same as web); biometric unlock via Keychain/Keystore |
| **Storage** | SQLCipher encryption for CDR data; Expo SecureStore for credentials |
| **Runtime** | Jailbreak/root detection; screenshot prevention on CDR screens |
| **Crash reports** | CDR data stripped before Sentry transmission |
| **API** | `withPermission()` + `withActiveConsent()` on all mobile endpoints |

---

## 7. REPOSITORY STRUCTURE

> **Full details:** Blueprint §3.4

```
monitrax-mobile/                    # Separate repository
├── app/                            # Expo Router screens (file-based routing)
│   ├── (tabs)/                     # Bottom tab navigator
│   │   ├── index.tsx               # Daily Pulse (Home)
│   │   ├── transactions.tsx        # Transaction Feed
│   │   ├── insights.tsx            # Insights & Alerts Hub
│   │   └── more.tsx                # Settings & Quick Actions
│   ├── cashflow.tsx                # Cashflow Mini-Dashboard
│   ├── expense/add.tsx             # Quick-Add Expense
│   ├── income/add.tsx              # Quick-Add Income
│   ├── entity/[type]/[id].tsx      # Entity Detail (read-only)
│   ├── chat.tsx                    # AI Chat
│   ├── health.tsx                  # Health Score Detail
│   └── login.tsx                   # Auth flow
├── components/                     # Shared mobile components
│   ├── ui/                         # Primitives (Button, Card, Badge, etc.)
│   ├── charts/                     # Health ring, sparklines, forecast
│   ├── transactions/               # Transaction row, swipe actions
│   └── insights/                   # Insight card, severity badge
├── lib/                            # Mobile-specific logic
│   ├── api/                        # API client, interceptors, error handling
│   ├── storage/                    # SQLite operations, cache manager
│   ├── sync/                       # Delta sync engine, pending writes
│   ├── notifications/              # FCM handlers, deep link routing
│   └── auth/                       # Firebase Auth + biometric bridge
├── packages/
│   └── core/                       # Symlink or workspace → @monitrax/core
├── assets/                         # App icon, splash screen, images
├── app.json                        # Expo config (bundle IDs, permissions)
├── eas.json                        # EAS Build profiles (dev/preview/production)
├── tsconfig.json                   # TypeScript config
└── package.json                    # Dependencies
```
