# Phase 12 — Onboarding Tour & Initial Setup Wizard

**Monitrax Blueprint — Phase 12**
**Version:** 1.0
**Status:** Planned
**Created:** 2025-12-05

---

## 1. Purpose

New users currently land in Monitrax without guidance and need to figure out:

- What the app actually does (big picture).
- What the key concepts are (properties, loans, investment accounts, income/expenses).
- What minimum data they should enter first to get value (net worth, cashflow, forecasts).

This phase introduces:

1. A **first-time product tour** (guided walkthrough of the core screens).
2. An **Initial Data Setup Wizard** that helps users input just enough data to make the dashboard and strategy engine useful.

---

## 2. High-Level Experience

### 2.1 Entry Conditions

Trigger onboarding when ALL are true:

- User is logged in.
- `user.onboardingCompleted === false` (or equivalent flag).
- First visit to `/dashboard` (or no existing financial data).

User sees a **Welcome overlay** with:

- Short value props (e.g. "Know your net worth", "See your future cashflow", "Optimise debt & investments").
- Two primary actions:
  - **"Start guided setup"** (recommended, launches setup wizard).
  - **"Take a quick tour first"** (launches UI tour).
  - Secondary link: **"Skip for now"** with a subtle reminder that they can start later from a "Get Started" button.

### 2.2 Components Introduced in this Phase

| Component | Purpose |
|-----------|---------|
| `OnboardingWelcomeModal` | Initial welcome overlay with options |
| `InitialSetupWizard` | Multi-step data entry wizard |
| `GuidedTour` | Cross-page, step-based overlay tour |
| `OnboardingProgressBadge` | Small reminder in header/sidebar |
| `useOnboardingState` | Hook to track completion & step state |

---

## 3. Guided Tour Specification

### 3.1 Goals

- Explain **what Monitrax is** in 1–2 sentences.
- Show **where to find**:
  - Net worth & main dashboard.
  - Properties & loans.
  - Investments & holdings.
  - Income & expenses.
  - Strategy engine (AI strategy page) – if enabled for the user.
- Make it very easy to quit or resume later.

### 3.2 Tour Trigger

- From Welcome modal: "Take a quick tour".
- Later: small "?" / "Take a tour" link on the dashboard.

### 3.3 Tour Behaviour

- Implement as a client-side, React overlay (no external dependency required).
- Simple **step list** with:
  - `selector` (CSS or element ref for the highlighted region).
  - `title`
  - `body`
  - Optional `ctaLabel`, `onNext` hooks.

- Controls:
  - Next, Back, Skip tour, Close (X).
  - Dimmed background, highlight target area.

### 3.4 Proposed Tour Steps

| Step | Target | Title | Body |
|------|--------|-------|------|
| 1 | Center modal | Welcome – What is Monitrax? | "Monitrax helps you see your entire wealth, forecast your future cashflow, and optimise your debt & investments." |
| 2 | Main sidebar nav | Top Navigation / Sidebar | "Here are your main sections: Dashboard, Properties, Loans, Investments, Income & Expenses, Tax & Strategy." |
| 3 | Dashboard stat cards | Dashboard Overview | "Your dashboard shows your net worth, cashflow, and key portfolio metrics at a glance." |
| 4 | Properties nav item | Properties | "Track each property's value, loans, rental income, expenses and depreciation." |
| 5 | Loans nav item | Loans | "See your loan balances, interest rates, offset accounts and repayment details." |
| 6 | Investments nav | Investments | "Monitor investment accounts, holdings and transactions, and link them to income like dividends." |
| 7 | Income/Expenses nav | Income & Expenses | "Categorise your inflows and outflows for cashflow and strategy recommendations." |
| 8 | Strategy nav (if enabled) | Strategy Engine | "Use the Strategy Engine to explore scenarios and optimisations based on your data." |
| 9 | Central overlay | Wrap-up | "You're ready to go. Next, we recommend completing the quick setup so Monitrax can calculate your net worth and forecasts." CTA: "Start setup wizard" |

---

## 4. Initial Data Setup Wizard

### 4.1 Goals

Get the user to a **minimally useful state** in < 5 minutes with:

- At least one **cash account**.
- At least one **property OR investment account** (depending on user type).
- At least one **income source** and **expense baseline**.
- Enough data to power:
  - Dashboard overview.
  - Basic forecasts.
  - Early strategy suggestions.

### 4.2 Flow & Steps

Wizard is a multi-step modal or dedicated `/onboarding` page with progress indicator.

#### Step 0: Choose Profile Type (Optional)

"What best describes you?"

| Option | Description |
|--------|-------------|
| Homeowner with mortgage | Prioritise property setup |
| Property investor | Prioritise multiple properties |
| Primarily shares/investments | Prioritise investment accounts |
| Just getting started | Balanced approach |

Use this to prioritise which steps are highlighted (e.g. property first vs investments first).

#### Step 1: Confirm Country & Tax Year

**Fields:**
- Country (pre-filled if known)
- Current tax year

**Purpose:** Used to tune labels and default assumptions.

#### Step 2: Add Your Main Bank / Cash Account

**Fields:**
- Account name
- Type (Offset / Savings / Transactional)
- Current balance

**UX:** Explain why: "We use this to track your cash buffer and part of your net worth."

#### Step 3: Add Your Primary Residence / First Property

**Option:** "I don't own property yet" → skip.

**Fields:**
- Property name/address
- Current market value
- Loan attached? (Yes/No)
  - If Yes: inline mini-form for loan:
    - Lender/name
    - Principal remaining
    - Interest rate
    - Fixed/Variable, Interest-only flag

**UX:** Show simple preview of "Equity = Value – Loan".

#### Step 4: Add an Investment Account

**Option:** "Skip for now".

**Fields:**
- Account name
- Type (Brokerage / Super / Fund / Crypto, etc.)
- Approximate current value (or first holding)

**UX:** Short note: "You can always add detailed holdings and transactions later."

#### Step 5: Add Your Primary Income Source

**Fields:**
- Income name (e.g. "Salary")
- Frequency (weekly, fortnightly, monthly)
- Net amount

**Optional:** "Add another income source" (e.g. rent).

#### Step 6: Add Baseline Monthly Expenses

Provide 3–5 simple categories:
- Living (rent/mortgage, utilities)
- Transport
- Groceries
- Discretionary

**UX:** Option to "Auto-estimate from income" with slider (e.g. 50–80% of income).

#### Step 7: Review & Confirm

**Summary Display:**
- Net worth estimate
- Cashflow summary (income – expenses – loan repayments)
- What Monitrax can now do:
  - "Your dashboard and forecasts are now enabled."

**Button:** "Finish and go to dashboard"

**On Finish:**
- Set `onboardingCompleted = true`
- Trigger first Strategy Engine pre-calculation (if cheap enough) or mark eligible for strategy

---

## 5. Data Model & Backend

### 5.1 Schema Changes

```prisma
model User {
  // ... existing fields

  // Onboarding fields
  onboardingCompleted    Boolean   @default(false)
  onboardingProfileType  OnboardingProfileType?
  onboardingStartedAt    DateTime?
  onboardingCompletedAt  DateTime?
}

enum OnboardingProfileType {
  HOMEOWNER
  INVESTOR
  MIXED
  STARTER
}

model UserPreference {
  id                      String   @id @default(uuid())
  userId                  String   @unique
  user                    User     @relation(fields: [userId], references: [id])

  hasSeenGuidedTour       Boolean  @default(false)
  dismissedOnboardingBadge Boolean @default(false)

  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}
```

### 5.2 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/onboarding/state` | Read onboarding flags for current user |
| POST | `/api/onboarding/state` | Set / update onboarding flags |
| POST | `/api/onboarding/complete` | Mark onboarding as complete |

Wizard should orchestrate existing create endpoints in sequence:
- `POST /api/accounts`
- `POST /api/properties`
- `POST /api/loans`
- `POST /api/investment-accounts`
- `POST /api/income`
- `POST /api/expenses`

---

## 6. UI / UX Requirements

### 6.1 Design System

Use existing design system:
- shadcn/ui components (Dialog, Tabs, Button, Input, Select, Progress, Badge, Card)
- Existing `DashboardLayout` and `PageHeader`

### 6.2 Responsive Design

- Flows must work on desktop and tablet
- Mobile support is a bonus but not priority 1

### 6.3 Accessibility

- Keyboard navigation for tour and wizard
- Focus trap in modals
- ARIA labels for screen readers

### 6.4 Progress Persistence

- If user closes wizard mid-way, allow resuming later from last step
- Store progress in onboarding state in DB

---

## 7. Analytics & Success Metrics

### 7.1 Events to Track

**Tour Events:**
- `tour_started`
- `tour_step_completed` (with step number)
- `tour_completed`
- `tour_skipped`

**Wizard Events:**
- `wizard_started`
- `wizard_step_completed` (with step number)
- `wizard_completed`
- `wizard_abandoned` (with last step)

### 7.2 Key Metrics

Track counts of:
- Users with ≥1 property
- Users with ≥1 loan
- Users with ≥1 investment account
- Users with both income and expense baseline

**Target:** Majority of new users complete at least Steps 2–5 within their first session.

---

## 8. Copywriting Notes

### 8.1 Tone Guidelines

- Supportive, non-judgmental, plain English
- Avoid jargon; when unavoidable (LVR, offset, etc.) provide a 1-sentence explanation
- Emphasise "you can change this later" and "approximate numbers are fine to start"

### 8.2 Example Copy

| Context | Copy |
|---------|------|
| Welcome | "Let's get you set up in just a few minutes" |
| Skip option | "Skip for now - you can start this anytime from Settings" |
| Approximate values | "Don't worry about exact numbers - estimates work great" |
| Completion | "You're all set! Your dashboard is ready to explore" |

---

## 9. Implementation Roadmap

### Phase 12.1 — Foundation
- [ ] Add onboarding fields to User model
- [ ] Create UserPreference model
- [ ] Implement onboarding state API endpoints
- [ ] Create `useOnboardingState` hook

### Phase 12.2 — Guided Tour
- [ ] Build `GuidedTour` component with step navigation
- [ ] Implement tour step definitions
- [ ] Add tour trigger points (welcome modal, dashboard help)
- [ ] Add progress tracking

### Phase 12.3 — Setup Wizard
- [ ] Build `InitialSetupWizard` component
- [ ] Implement each wizard step as sub-component
- [ ] Wire up to existing create APIs
- [ ] Add progress persistence

### Phase 12.4 — Integration
- [ ] Create `OnboardingWelcomeModal`
- [ ] Add `OnboardingProgressBadge` to header
- [ ] Connect all components
- [ ] Test full flow end-to-end

---

## 10. Files to Create

| File | Purpose |
|------|---------|
| `components/onboarding/OnboardingWelcomeModal.tsx` | Initial welcome overlay |
| `components/onboarding/InitialSetupWizard.tsx` | Multi-step wizard container |
| `components/onboarding/GuidedTour.tsx` | Tour overlay component |
| `components/onboarding/OnboardingProgressBadge.tsx` | Reminder badge |
| `components/onboarding/steps/*.tsx` | Individual wizard step components |
| `hooks/useOnboardingState.ts` | Onboarding state management hook |
| `hooks/useGuidedTour.ts` | Tour navigation hook |
| `app/api/onboarding/state/route.ts` | Onboarding state API |
| `app/onboarding/page.tsx` | Optional dedicated onboarding page |

---

## 11. Acceptance Criteria

Phase 12 is complete when:

1. ✅ New users see welcome modal on first dashboard visit
2. ✅ Users can take a guided tour of key features
3. ✅ Users can complete setup wizard to enter initial data
4. ✅ Progress is persisted and resumable
5. ✅ Dashboard shows meaningful data after wizard completion
6. ✅ Users can skip and return to onboarding later
7. ✅ Analytics events are tracked
8. ✅ No regressions to existing functionality

---

*END OF PHASE 12 BLUEPRINT v1.0*
