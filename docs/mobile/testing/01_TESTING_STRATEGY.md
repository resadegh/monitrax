# Mobile Testing Strategy

**Date:** 2026-04-11 | **Version:** 1.0 | **Status:** ACTIVE
**Blueprint Ref:** `docs/mobile/blueprint/PHASE_15_MOBILE_COMPANION_APP.md` §17

---

## 1. TESTING LAYERS

| Layer | Tool | What It Tests | When |
|-------|------|---------------|------|
| **Unit** | Vitest (`@monitrax/core`) | Shared calculations, formatters, frequencies | Every commit |
| **Component** | React Native Testing Library | Screen rendering, interactions, state | Every commit |
| **Integration** | Detox (E2E) | Full user flows on simulator | Before each sprint merge |
| **API Contract** | Vitest (backend) | Mobile endpoint responses match TS interfaces | Every backend change |
| **Performance** | Flashlight | Startup time, FPS, memory | Sprint 1, 5, and release |
| **CDR Compliance** | Manual + automated | CDR data encryption, purge, notification rules | Sprint 5 and release |
| **Manual** | Physical devices | Biometrics, push, gestures, dark mode | Every sprint |

---

## 2. DEVICE MATRIX

| Device | OS | Screen | Priority | Tests |
|--------|----|----|----------|-------|
| iPhone SE (3rd gen) | iOS 16+ | 375pt / 4.7" | High | Smallest screen; layout integrity |
| iPhone 15 Pro | iOS 17+ | 393pt / 6.1" | High | Primary target; performance benchmark |
| iPhone 15 Pro Max | iOS 17+ | 430pt / 6.7" | Medium | Large screen layout |
| Pixel 7 | Android 13+ | 412dp / 6.3" | High | Reference Android; performance benchmark |
| Samsung Galaxy S24 | Android 14+ | 360dp / 6.2" | High | Popular Samsung; One UI quirks |
| Pixel 4a | Android 12+ | 393dp / 5.8" | Medium | Lower-end performance test |

---

## 3. CRITICAL TEST SCENARIOS

### Authentication (8 tests)
- [ ] Fresh login with email/password
- [ ] Fresh login with Google OAuth
- [ ] Fresh login with Apple Sign-In (iOS)
- [ ] Biometric unlock after 5+ min background
- [ ] Biometric enrollment change → re-auth required
- [ ] MFA challenge on CDR data access
- [ ] Token refresh after 1-hour expiry
- [ ] Session timeout after 60 min idle

### Daily Pulse (5 tests)
- [ ] First load <2s with real data
- [ ] Pull-to-refresh updates all widgets
- [ ] Offline: cached data with "Last updated" badge
- [ ] Health ring animates correctly
- [ ] Tap insight → detail screen

### Transactions (6 tests)
- [ ] Delta sync fetches only new transactions
- [ ] Swipe-right categorisation persists to server
- [ ] FlashList smooth at 10,000+ items (≥58 FPS)
- [ ] Search filters (merchant, category, amount)
- [ ] Offline: cached transactions display
- [ ] Swipe-left flags transaction

### Quick-Add (5 tests)
- [ ] Expense saves and syncs immediately
- [ ] Offline expense queues in pending_writes
- [ ] Offline expense syncs on reconnect
- [ ] Receipt OCR auto-fills fields
- [ ] Amount keypad auto-focused

### Push Notifications (5 tests)
- [ ] Daily digest at configured time
- [ ] Overspend alert triggers correctly
- [ ] Tap → correct screen opens
- [ ] No CDR data on lock screen
- [ ] Quiet hours respected

### CDR Compliance (8 tests)
- [ ] SQLite encrypted (forensic check)
- [ ] No CDR data in notification body
- [ ] Consent revocation → device purge <5 min
- [ ] No CDR data in Sentry reports
- [ ] MFA required for CDR data
- [ ] Root/jailbreak blocks CDR access
- [ ] All API calls generate audit entries
- [ ] Screenshot blocked on CDR screens (Android)

### Offline Mode (4 tests)
- [ ] All cached screens in airplane mode
- [ ] Pending writes sync on reconnect
- [ ] Conflict resolution for duplicates
- [ ] Stale data indicator visible

---

## 4. PERFORMANCE BENCHMARKS

| Metric | Target | Measured On | Tool |
|--------|--------|-------------|------|
| Cold start | <750ms | iPhone 15 Pro, Pixel 7 | Flashlight |
| Warm start | <300ms | iPhone 15 Pro, Pixel 7 | Flashlight |
| Time to interactive | <1.5s | iPhone 15 Pro | Flashlight |
| Transaction list FPS | ≥58 | All devices | Flashlight |
| SQLite query (snapshot) | <10ms | All devices | Custom |
| API P95 (snapshot) | <150ms | Server-side | Vercel Analytics |
| Memory (idle) | <150MB | All devices | Xcode/AS profiler |
| App binary | <30MB | EAS Build output | — |

---

## 5. AUTOMATED TEST PIPELINE

```
git push → EAS Build (preview) → Unit tests (Vitest) → Component tests (RNTL)
    → Detox E2E (simulator) → Flashlight perf → Report
```

Runs on: every PR to `main` in `monitrax-mobile` repo.
