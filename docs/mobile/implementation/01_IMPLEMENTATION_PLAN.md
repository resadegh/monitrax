# Mobile Companion App — Phased Implementation Plan

**Date:** 2026-04-11 | **Version:** 1.0 | **Status:** ACTIVE
**Blueprint Ref:** `docs/mobile/blueprint/PHASE_15_MOBILE_COMPANION_APP.md` §16
**Timeline:** ~16 weeks (7 sprints)
**Team:** Solo developer (Director) + Claude Code AI assistance

---

## OVERVIEW

| Sprint | Weeks | Focus | Key Milestone |
|--------|-------|-------|---------------|
| **0** | 1–2 | Foundation | Expo project boots, Firebase Auth works, shared code extracted |
| **1** | 3–5 | Daily Pulse + Scanner | Home screen with real data; receipt scanner as top-level action |
| **2** | 6–8 | Triage + Transactions | Transaction Triage Mode (card-stack swipe); feed; quick-add; delta sync |
| **3** | 9–10 | Notifications + Basiq | Push notifications (14 types); Basiq reconnection flow; cashflow forecast |
| **4** | 11–12 | Intelligence | Insights hub, health detail, AI chat |
| **5** | 13–14 | Polish | Offline hardening, CDR verification, performance tuning |
| **6** | 15–16 | Ship | TestFlight, App Store submission, documentation |

---

## SPRINT 0 — FOUNDATION (Weeks 1–2)

**Goal:** Project skeleton that boots on iOS + Android, authenticates via Firebase, and has shared code installed.

### Backend Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| B0.1 | Create `/api/v1/mobile/` route group with versioned prefix | P0 | Route group exists; returns 404 for unknown sub-paths |
| B0.2 | Deploy Cloud Armor WAF rules for API protection | P0 | WAF active on Vercel edge; test with blocked request |
| B0.3 | Enable FCM in Firebase Console | P0 | FCM project configured; APNs certificate uploaded |
| B0.4 | Add 60-second TTL cache to `getMasterFinancialSnapshot()` | P1 | Consecutive calls within 60s return cached result |
| B0.5 | Create `POST /api/v1/mobile/device/register` endpoint | P1 | FCM token stored linked to userId |
| B0.6 | Create `DELETE /api/v1/mobile/device/{token}` endpoint | P2 | FCM token unregistered |

### Mobile Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| M0.1 | Initialise Expo project with Expo Router and TypeScript | P0 | `npx expo start` boots; blank screen on simulator |
| M0.2 | Configure `eas.json` with dev/preview/production build profiles | P0 | `eas build --profile development` succeeds |
| M0.3 | Integrate `@react-native-firebase/auth` | P0 | Firebase SDK initialises; console shows "Firebase connected" |
| M0.4 | Build login screen (email/password, Google, Apple Sign-In) | P0 | User can log in; Firebase ID token obtained |
| M0.5 | Set up Zustand store with initial slices (auth, snapshot, sync) | P1 | Stores exist; auth slice populated after login |
| M0.6 | Configure React Query client with auth header interceptor | P1 | API calls include `Authorization: Bearer <token>` |
| M0.7 | Set up `expo-sqlite` with SQLCipher encryption | P1 | Encrypted DB created; write/read test passes |
| M0.8 | Set up `expo-secure-store` for credential storage | P1 | Refresh token stored and retrieved from Keychain |
| M0.9 | Create bottom tab navigator skeleton (Home, Transactions, Insights, More) | P1 | 4 tabs visible; each shows placeholder screen |
| M0.10 | Configure app icon, splash screen, bundle identifiers | P2 | Branded splash shows on launch |

### Shared Code Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| S0.1 | Create `@monitrax/core` package from web `lib/` | P0 | Package builds; exports formatCurrency, toMonthly, toAnnual, enums |
| S0.2 | Extract calculation engines (netWorth, cashflow, expense, income, loan) | P0 | All 5 calculators work without Prisma imports |
| S0.3 | Extract type definitions (enums, GRDCS types, financial types) | P0 | Types importable in both web and mobile |
| S0.4 | Publish v1.0.0 to npm (private) | P0 | `npm install @monitrax/core` succeeds in both repos |
| S0.5 | Update web app to import from `@monitrax/core` | P1 | Web app `npm run build` passes with shared imports |
| S0.6 | Install `@monitrax/core` in mobile app | P1 | Mobile app imports and uses shared code |
| S0.7 | Set up Vitest for `@monitrax/core` | P2 | Existing calculation tests pass against extracted package |

### Sprint 0 Exit Criteria

- [ ] Expo app boots on iOS simulator and Android emulator
- [ ] User can log in via Firebase (email/password at minimum)
- [ ] `@monitrax/core` published and installed in both projects
- [ ] Web app still builds and passes lint after shared code extraction
- [ ] Bottom tab navigator renders 4 placeholder screens
- [ ] SQLite encrypted database created and tested
- [ ] Cloud Armor WAF active
- [ ] FCM configured in Firebase Console

---

## SPRINT 1 — DAILY PULSE + SCANNER (Weeks 3–5)

**Goal:** Home screen showing real financial data; receipt scanner as top-level action.

### Backend Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| B1.1 | Build `GET /api/v1/mobile/snapshot` endpoint | P0 | Returns `MobileSnapshot` shape (<50kb) including `moneyLeftUntilPayday` |
| B1.2 | Build `GET /api/v1/mobile/accounts` endpoint | P1 | Returns account balances summary (<15kb) |
| B1.3 | Build `GET /api/v1/mobile/categories` endpoint | P1 | Returns category list for pickers (<10kb) |
| B1.4 | Add spending velocity + payday calculation | P0 | `spending.todayTotal`, `spending.dailyAverage`, and `moneyLeftUntilPayday` (next SALARY Income date minus projected expenses) |
| B1.5 | Build `POST /api/v1/mobile/document/upload` (multipart) | P0 | Receipt photo uploaded to GCS; Gemini OCR triggered; extracted fields returned |

### Mobile Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| M1.1 | Build Daily Pulse home screen with all widgets | P0 | Net worth, health ring, cashflow, spending, money-left-until-payday, accounts, insights all render |
| M1.2 | Build "Money Left Until Payday" widget | P0 | Shows "$X left for Y days" with colour gradient (green → amber → red) |
| M1.3 | Implement biometric unlock flow (Face ID / Fingerprint) | P0 | App prompts biometric on open; falls back to Firebase login |
| M1.4 | Build SQLite cache layer for snapshot data | P0 | Snapshot cached; loads from cache when offline |
| M1.5 | Build receipt scanner screen (camera → upload → OCR → auto-fill) | P0 | Camera opens; photo captures; fields auto-filled from OCR; expense saved |
| M1.6 | Build scanner FAB (persistent floating action button) | P0 | Camera icon FAB visible on all screens; tap opens scanner |
| M1.7 | Implement pull-to-refresh on home screen | P0 | Pull down triggers `/api/v1/mobile/snapshot` refetch |
| M1.8 | Build health score ring component (animated 0–100) | P1 | Ring animates to score; colour matches grade |
| M1.9 | Build account balances horizontal scroll cards | P1 | Accounts scroll horizontally; show name, balance, last synced |
| M1.10 | Build insight card component with severity colours | P1 | Cards show severity badge, title, description, CTA |
| M1.11 | Build "Last updated X ago" offline indicator | P1 | Shows time since last successful sync |
| M1.12 | Implement dark mode support | P2 | Respects system theme; manual toggle in settings |

### Sprint 1 Exit Criteria

- [ ] Daily Pulse shows real data from production API
- [ ] "Money Left Until Payday" widget shows correct calculation
- [ ] Biometric unlock works on iOS (Face ID) and Android (Fingerprint)
- [ ] Receipt scanner: camera → snap → OCR auto-fills amount + merchant + date
- [ ] Scanner FAB visible on all screens
- [ ] Cached data displays when phone is in airplane mode
- [ ] Health score ring renders with correct colour and animation
- [ ] Pull-to-refresh updates all widgets

---

## SPRINT 2 — TRIAGE MODE + TRANSACTIONS (Weeks 6–8)

**Goal:** Transaction Triage Mode (card-stack swipe); transaction feed; quick-add; delta sync.

### Backend Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| B2.1 | Build `GET /api/v1/mobile/transactions` with delta sync | P0 | Returns transactions since `?since=` timestamp; max 100 per page |
| B2.2 | Build `GET /api/v1/mobile/transactions/triage` | P0 | Returns uncategorised transactions (`category IS NULL OR categoryConfidence < 0.5`) sorted by recency; includes AI suggestion + confidence |
| B2.3 | Build `PATCH /api/v1/mobile/transaction/{id}/categorize` | P0 | Updates category; creates `MerchantMapping` for AI learning |
| B2.4 | Build `PATCH /api/v1/mobile/transaction/{id}/flag` | P1 | Flags transaction as duplicate/excluded/unrecognised |
| B2.5 | Build `POST /api/v1/mobile/expense` | P0 | Creates expense with Zod validation; returns created entity |
| B2.6 | Build `POST /api/v1/mobile/income` | P0 | Creates income with Zod validation; returns created entity |
| B2.7 | Build `POST /api/v1/mobile/sync` endpoint | P0 | Accepts pending writes; returns resolved IDs + delta data |

### Mobile Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| M2.1 | **Build Transaction Triage Mode (card-stack)** | P0 | Tinder-style card stack of uncategorised transactions; swipe right=accept, left=flag, up=investigate |
| M2.2 | Build triage card component (merchant, amount, AI suggestion, confidence) | P0 | Card shows all context needed to categorise in 1.5 seconds |
| M2.3 | Build category picker bottom sheet (for overriding AI suggestion) | P0 | Shows system + custom categories; recent picks at top |
| M2.4 | Build triage queue badge on Transactions tab | P0 | "12 to triage" badge; empty state: "All sorted!" with celebration haptic |
| M2.5 | Build transaction feed screen with FlashList | P0 | Smooth scroll at 10,000+ items; date grouping (Today, Yesterday, etc.) |
| M2.6 | Build quick-add expense screen | P0 | Amount keypad auto-focused; saves via API or pending_writes |
| M2.7 | Build quick-add income screen | P0 | Same pattern as expense; type picker (Salary/Rent/etc.) |
| M2.8 | Build delta sync engine with NetInfo listener | P0 | Syncs on app open, connectivity change, and 30-min interval |
| M2.9 | Implement offline pending_writes queue | P0 | Offline-created items stored in SQLite; synced when online |
| M2.10 | Build transaction search/filter bar | P1 | Filter by merchant, category, amount, direction |
| M2.11 | Implement haptic feedback (save success, categorise, triage complete) | P1 | Correct haptic type per action (see Blueprint §13.3) |

### Sprint 2 Exit Criteria

- [ ] Transaction Triage Mode: swipe right categorises, feeds MerchantMapping learning
- [ ] Triage queue badge shows correct count; empty state celebrates completion
- [ ] User can triage 30 transactions in under 60 seconds (timed test)
- [ ] Transaction feed shows real Basiq + manual transactions
- [ ] Quick-add expense creates expense visible on web dashboard
- [ ] Offline-created expense syncs when connectivity returns
- [ ] Delta sync fetches only new/modified transactions since last sync
- [ ] FlashList maintains 58+ FPS with 10,000 items

---

## SPRINT 3 — NOTIFICATIONS + BASIQ RECONNECT (Weeks 9–10)

**Goal:** Push notifications (14 types) delivered; Basiq reconnection via in-app browser; cashflow forecast screen.

### Backend Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| B3.1 | Deploy GCP Cloud Function `monitrax-push-notifications` | P0 | Function deployed; accepts trigger, sends FCM message |
| B3.2 | Build `GET /api/v1/mobile/cashflow-forecast` endpoint | P0 | Returns 7/14/30-day forecast (<10kb) |
| B3.3 | Build `POST /api/v1/mobile/basiq/reconnect` endpoint | P0 | Returns Basiq consent URL for in-app browser OAuth; handles callback deep link |
| B3.4 | Implement real-time transaction push trigger | P0 | On Basiq sync: for each new transaction, send FCM if user opted in |
| B3.5 | Implement daily digest Cloud Scheduler trigger (07:00 local) | P0 | Cloud Scheduler fires; Cloud Function builds and sends digest |
| B3.6 | Implement overspending alert trigger from TIE | P0 | When daily spend >150% average, FCM message sent |
| B3.7 | Implement Basiq reconnection trigger (webhook) | P0 | Connection status → RECONNECT/ERROR triggers critical FCM with reconnect deep link |
| B3.8 | Implement upcoming payment trigger (2 days before due) | P1 | RecurringPayment due dates checked; reminders sent |
| B3.9 | Implement cashflow risk trigger from Insights Engine | P1 | Negative forecast within 7 days triggers FCM |
| B3.10 | Implement anomaly detection trigger from TIE behavioural engine | P1 | Duplicates, timing anomalies, new merchants trigger FCM |
| B3.11 | Implement triage reminder trigger | P2 | When uncategorised queue >10 items, send low-priority reminder |
| B3.12 | Apply `sanitizeCdrMetadata()` to all notification payloads | P0 | No CDR data in notification title/body |

### Mobile Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| M3.1 | Implement FCM token registration on login | P0 | Token registered via `POST /api/v1/mobile/device/register` |
| M3.2 | Build notification permission request flow | P0 | iOS/Android permission prompt; graceful degradation if denied |
| M3.3 | Build notification tap handler (deep link routing) | P0 | Tapping notification opens correct screen with context |
| M3.4 | **Build Basiq reconnection flow** | P0 | Push "tap to reconnect" → opens in-app browser (`expo-web-browser`) with OAuth URL → deep link back → connection restored |
| M3.5 | Build cashflow mini-dashboard screen | P0 | 14-day forecast chart, upcoming charges, high/low alerts |
| M3.6 | Build notification preferences screen | P1 | Toggle each of 14 notification types; set quiet hours; set digest time; opt-in for real-time transaction push |
| M3.7 | Build forecast area chart component | P1 | Confidence band shading; 14-day x-axis |
| M3.8 | Build upcoming recurring charges list | P1 | Next 7 days of known payments with amounts |
| M3.9 | Store notification preferences via `POST /api/v1/mobile/settings/notifications` | P2 | Preferences persisted server-side in `UserPreference` |

### Sprint 3 Exit Criteria

- [ ] Real-time transaction push arrives within 60s of Basiq sync
- [ ] Daily digest notification arrives at configured time
- [ ] Overspending alert fires when daily spend exceeds threshold
- [ ] Basiq reconnection: push received → tap → OAuth → connection restored
- [ ] Anomaly detection push fires for duplicates/timing anomalies
- [ ] Tapping any notification opens the correct screen
- [ ] No CDR data visible in notifications on lock screen
- [ ] Cashflow forecast chart renders with real data
- [ ] Notification preferences screen toggles all 14 types

---

## SPRINT 4 — INTELLIGENCE (Weeks 11–12)

**Goal:** Insights hub, health score detail, and AI chat (stretch).

### Backend Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| B4.1 | Build `GET /api/v1/mobile/insights` endpoint | P0 | Returns active insights grouped by severity (<20kb) |
| B4.2 | Implement health score drop notification trigger | P1 | Score drop >10 points triggers FCM |
| B4.3 | Implement subscription price increase notification trigger | P2 | Price change on RecurringPayment triggers FCM |

### Mobile Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| M4.1 | Build insights & alerts hub screen | P0 | Full list grouped by severity; severity colours per brand guide |
| M4.2 | Build insight detail expansion (tap to expand) | P0 | Shows full description, affected entities, recommended fix, CTA |
| M4.3 | Implement insight actions (dismiss, save, snooze) | P0 | Swipe to dismiss; tap to save; snooze re-appears after 24h |
| M4.4 | Build financial health score detail screen | P0 | Large score ring, 7 category bars, trend, top 3 actions |
| M4.5 | Build budget vs actual progress view | P1 | Per-category progress bars; overall variance indicator |
| M4.6 | Integrate AI chat (Tier 2 stretch goal) | P2 | Chat screen calls existing `/api/ai/ask`; Gemini responses |
| M4.7 | Build entity read-only detail card | P2 | Tap entity from insight → summary card with "View on Desktop" |
| M4.8 | Implement "Continue on Desktop" deep links | P1 | Generates universal link to web app entity page |

### Sprint 4 Exit Criteria

- [ ] Insights display with correct severity colours and action buttons
- [ ] Dismissing an insight removes it from the list
- [ ] Health score detail shows all 7 categories with accurate data
- [ ] Budget vs actual shows progress bars per category
- [ ] "Continue on Desktop" link opens correct web page

---

## SPRINT 5 — POLISH (Weeks 13–14)

**Goal:** Offline hardening, CDR compliance verification, performance tuning, document capture.

### Backend Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| B5.1 | Build `POST /api/v1/mobile/document/upload` (multipart) | P1 | Receipt photo uploaded; Gemini OCR triggered; fields extracted |
| B5.2 | Add CDR compliance audit endpoint for mobile verification | P2 | Endpoint returns compliance check results for mobile-specific rules |

### Mobile Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| M5.1 | Build document capture screen (camera → upload → OCR → auto-fill) | P1 | Photo taken, uploaded, fields auto-filled from OCR |
| M5.2 | Harden offline mode (airplane mode test suite) | P0 | All cached screens accessible; pending writes queue works |
| M5.3 | CDR compliance verification (checklist from Blueprint §19.3) | P0 | All 8 CDR criteria pass |
| M5.4 | Performance profiling and optimisation | P0 | Cold start <750ms; FlashList ≥58 FPS; memory <150MB |
| M5.5 | Accessibility audit (VoiceOver / TalkBack) | P0 | All screens readable; touch targets ≥44pt |
| M5.6 | Configure Universal Links (iOS) and App Links (Android) | P1 | Web links open in mobile app when installed |
| M5.7 | Set up Sentry for React Native (CDR data stripped) | P1 | Crashes reported; no CDR fields in Sentry dashboard |
| M5.8 | Screenshot prevention on CDR screens (Android FLAG_SECURE) | P1 | Screenshot blocked on transaction/account screens |
| M5.9 | Jailbreak/root detection with CDR access blocking | P1 | Rooted device shows warning; CDR data hidden |
| M5.10 | End-to-end consent revocation test | P0 | Revoke on web → mobile purges CDR data within 5 min |

### Sprint 5 Exit Criteria

- [ ] All 8 CDR compliance criteria pass (Blueprint §19.3)
- [ ] Cold start <750ms on iPhone 15 Pro and Pixel 7
- [ ] All screens accessible via VoiceOver/TalkBack
- [ ] Consent revocation triggers mobile data purge within 5 minutes
- [ ] No CDR data appears in Sentry crash reports
- [ ] Universal Links / App Links work bidirectionally

---

## SPRINT 6 — SHIP (Weeks 15–16)

**Goal:** TestFlight distribution, App Store submission, documentation updates.

### App Store Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| A6.1 | TestFlight beta distribution (iOS) | P0 | Internal testers can install and test |
| A6.2 | Google Play Internal Testing track distribution | P0 | Internal testers can install from Play Console |
| A6.3 | Prepare App Store screenshots (6.7", 6.1", 5.5") | P0 | Screenshots for all required device sizes |
| A6.4 | Write App Store description and keywords | P0 | Description emphasises financial clarity, not trading |
| A6.5 | Complete iOS privacy nutrition labels | P0 | All data types declared (financial data, authentication) |
| A6.6 | Complete Google Play data safety form | P0 | Equivalent of iOS privacy labels |
| A6.7 | Write privacy policy (CDR-compliant) | P0 | Hosted URL for App Store review |
| A6.8 | Create `apple-app-site-association` file | P0 | Hosted on Vercel; validates in Apple validator |
| A6.9 | Create `assetlinks.json` file | P0 | Hosted on Vercel; validates in Google validator |
| A6.10 | Submit to App Store (iOS) | P0 | Submitted; awaiting review |
| A6.11 | Submit to Google Play (Android) | P0 | Submitted; awaiting review |

### Documentation Tasks

| # | Task | Priority | Acceptance Criteria |
|---|------|----------|-------------------|
| D6.1 | Update `docs/policy/DEVICE_SECURITY_POLICY.md` with mobile addendum | P0 | Mobile device requirements documented |
| D6.2 | Create Basiq mobile operations runbook | P0 | Mobile-specific bank sync troubleshooting documented |
| D6.3 | Update `MASTER_BLUEPRINT.md` with Phase 15 status → Complete | P0 | Blueprint reflects Phase 15 as complete |
| D6.4 | Create changelog entry for Phase 15 | P0 | `docs/changelog/CHANGELOG_YYYY_MM_DD.md` created |
| D6.5 | Update `docs/mobile/00_INDEX.md` with final status | P1 | All document statuses reflect reality |

### Sprint 6 Exit Criteria

- [ ] iOS app available on TestFlight for internal testing
- [ ] Android app available on Internal Testing track
- [ ] App Store submission accepted (not necessarily approved yet)
- [ ] Privacy policy live and linked from App Store listings
- [ ] Universal Links / App Links verified by Apple and Google validators
- [ ] All documentation updated

---

## DEPENDENCY GRAPH

```
Sprint 0 (Foundation)
    │
    ├── S0.1-S0.7: @monitrax/core extraction
    │   └── Used by ALL subsequent mobile tasks
    │
    ├── B0.1-B0.2: Backend API versioning + WAF
    │   └── Required before ANY mobile API calls
    │
    ├── M0.1-M0.4: Expo project + Firebase Auth
    │   └── Required before ANY authenticated screen
    │
    └── B0.3: FCM setup
        └── Required before Sprint 3 (notifications)

Sprint 1 (Daily Pulse) ──────► Sprint 2 (Transactions)
    │                              │
    │ B1.1 snapshot API            │ B2.1 transactions API
    │ M1.1 home screen             │ M2.1 transaction feed
    │ M1.2 biometric auth          │ M2.4 quick-add expense
    │                              │ M2.6 delta sync
    │                              │
    └──────────┬───────────────────┘
               │
          Sprint 3 (Notifications)
               │
               │ B3.1 Cloud Function
               │ M3.1 FCM token registration
               │ M3.4 cashflow screen
               │
          Sprint 4 (Intelligence)
               │
               │ B4.1 insights API
               │ M4.1 insights hub
               │ M4.4 health detail
               │
          Sprint 5 (Polish)
               │
               │ M5.2 offline hardening
               │ M5.3 CDR verification
               │ M5.4 performance tuning
               │
          Sprint 6 (Ship)
               │
               │ A6.10 App Store submission
               │ D6.1-D6.5 documentation
               ▼
           🚀 LAUNCH
```

---

## MILESTONE DATES (Template — Fill In When Starting)

| Milestone | Target Date | Actual Date | Status |
|-----------|------------|-------------|--------|
| Sprint 0 complete | Week 2 | — | NOT STARTED |
| First authenticated API call from mobile | Week 2 | — | NOT STARTED |
| Daily Pulse live with real data | Week 5 | — | NOT STARTED |
| Transaction feed functional | Week 8 | — | NOT STARTED |
| First push notification delivered | Week 10 | — | NOT STARTED |
| CDR compliance verified | Week 14 | — | NOT STARTED |
| TestFlight distribution | Week 15 | — | NOT STARTED |
| App Store submission | Week 16 | — | NOT STARTED |
| App Store approval | Week 17+ | — | NOT STARTED |
