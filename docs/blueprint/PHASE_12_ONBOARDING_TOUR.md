# Phase 12 — Onboarding Tour & Initial Setup Wizard

**Monitrax Blueprint — Phase 12**
**Version:** 1.2
**Status:** Implemented
**Created:** 2025-12-05
**Updated:** 2025-12-07

## Implementation Progress

| Feature | Status | Date | Notes |
|---------|--------|------|-------|
| Schema: User onboarding fields | ✅ Implemented | 2025-12-07 | onboardingCompleted, onboardingProfileType, onboardingStep |
| Schema: OnboardingProfileType enum | ✅ Implemented | 2025-12-07 | HOMEOWNER, INVESTOR, MIXED, STARTER |
| Schema: UserPreference model | ✅ Implemented | 2025-12-07 | Tour state, dismissals, preferences |
| API: /api/onboarding/state | ✅ Implemented | 2025-12-07 | GET/POST for onboarding state |
| API: /api/onboarding/complete | ✅ Implemented | 2025-12-07 | Mark onboarding complete |
| Hook: useOnboardingState | ✅ Implemented | 2025-12-07 | Full state management |
| Hook: useGuidedTour | ✅ Implemented | 2025-12-07 | Tour navigation & animations |
| Component: OnboardingWelcomeModal | ✅ Implemented | 2025-12-07 | Initial welcome overlay |
| Component: GuidedTour | ✅ Implemented | 2025-12-07 | 9-step animated tour |
| Component: TourSpotlight | ✅ Implemented | 2025-12-07 | Spotlight with pulse animation |
| Component: TourTooltip | ✅ Implemented | 2025-12-07 | Animated tooltip cards |
| Component: OnboardingProgressBadge | ✅ Implemented | 2025-12-07 | Resume progress indicator |
| Component: InitialSetupWizard | ✅ Implemented | 2025-12-07 | 8-step data entry wizard |
| Wizard Steps: All 8 steps | ✅ Implemented | 2025-12-07 | Profile, Country, Account, Property, Investment, Income, Expense, Review |
| CSS: tour-animations.css | ✅ Implemented | 2025-12-07 | Spotlight, pulse, slide-in animations |
| Integration: DashboardLayout | ✅ Implemented | 2025-12-07 | Auto-show for new users |

---

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

### 3.5 Animated Navigation Guide

A smooth, animated walkthrough that highlights each section of the app with visual effects.

#### 3.5.1 Animation Style

| Effect | Description |
|--------|-------------|
| **Spotlight Effect** | Dark overlay (opacity 0.7) with a "cut-out" circle/rectangle around the highlighted element |
| **Pulse Animation** | Subtle pulse/glow effect on the highlighted element (CSS keyframe animation) |
| **Pointer Arrow** | Animated arrow or hand icon pointing to the highlighted area |
| **Slide-in Tooltip** | Description card slides in from the side with smooth easing |
| **Progress Dots** | Small dots at bottom showing current step (like carousel indicators) |

#### 3.5.2 Animation Specifications

```css
/* Spotlight overlay */
.tour-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  transition: all 0.3s ease-out;
}

/* Highlight cutout */
.tour-spotlight {
  position: absolute;
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Pulse animation */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
  50% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
}

.tour-highlight {
  animation: pulse-glow 2s ease-in-out infinite;
}

/* Tooltip slide-in */
@keyframes slide-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.tour-tooltip {
  animation: slide-in 0.3s ease-out forwards;
}
```

#### 3.5.3 Tooltip Card Design

```
┌─────────────────────────────────────────┐
│  ● ● ● ○ ○ ○ ○ ○ ○  (progress dots)    │
├─────────────────────────────────────────┤
│                                         │
│  📊  Dashboard Overview                 │
│                                         │
│  Your dashboard shows your net worth,   │
│  cashflow, and key portfolio metrics    │
│  at a glance.                           │
│                                         │
│  ┌─────────┐  ┌─────────────────────┐  │
│  │  Skip   │  │  Next →  (3 of 9)   │  │
│  └─────────┘  └─────────────────────┘  │
└─────────────────────────────────────────┘
```

#### 3.5.4 Interactive Elements

| Element | Interaction |
|---------|-------------|
| **Next Button** | Advances to next step with smooth transition |
| **Back Button** | Returns to previous step (hidden on step 1) |
| **Skip Button** | Exits tour, marks as seen, shows "You can restart from Settings" |
| **Progress Dots** | Clickable to jump to specific step |
| **Highlighted Area** | Clickable to interact (optional, some steps allow it) |
| **Keyboard** | Arrow keys for next/back, Escape to close |

#### 3.5.5 Transition Between Steps

1. **Fade out** current tooltip (0.2s)
2. **Animate** spotlight to new position (0.4s with easing)
3. **Fade in** new tooltip (0.3s)
4. **Start** pulse animation on new element

#### 3.5.6 Mobile Adaptations

| Desktop | Mobile |
|---------|--------|
| Tooltip beside element | Tooltip at bottom of screen |
| Horizontal arrow | Vertical arrow pointing up |
| Full sidebar visible | Hamburger menu opens first |
| Click to advance | Tap or swipe to advance |

#### 3.5.7 Component Structure

```tsx
interface TourStep {
  id: string;
  target: string;           // CSS selector or element ref
  title: string;
  description: string;
  icon?: React.ReactNode;   // Optional icon for the step
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  spotlightPadding?: number;
  allowInteraction?: boolean;  // Allow clicking the highlighted element
  onEnter?: () => void;        // Callback when entering step
  onExit?: () => void;         // Callback when leaving step
}

interface GuidedTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  startStep?: number;
}
```

#### 3.5.8 Step-by-Step Animation Flow

**Step 1: Welcome Modal (Center)**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│           🎉  Welcome to Monitrax!                   │
│                                                      │
│   Monitrax helps you see your entire wealth,         │
│   forecast your future cashflow, and optimise        │
│   your debt & investments.                           │
│                                                      │
│   Let's take a quick tour of the app.                │
│                                                      │
│          ┌──────────────────────┐                    │
│          │   Let's Go! →        │                    │
│          └──────────────────────┘                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Step 2: Sidebar Navigation (Left spotlight)**
```
┌─────────────┐░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
│ ✨ SIDEBAR  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
│  (glowing)  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
│             │░░░  ┌─────────────────────────────┐ ░░░
│ Dashboard   │░░░  │  📍 Navigation Sidebar      │ ░░░
│ Properties  │░░░  │                             │ ░░░
│ Loans       │░░░  │  Here are your main         │ ░░░
│ Investments │░░░  │  sections...                │ ░░░
│ Income      │░░░  │                             │ ░░░
│ Expenses    │░░░  │  [Back]  [Next → 2/9]       │ ░░░
│             │░░░  └─────────────────────────────┘ ░░░
└─────────────┘░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

**Step 3: Dashboard Cards (Top spotlight)**
```
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░░ ┌──────────────────────────────────────────────┐ ░░
░░░ │ ✨ Net Worth  │  Cashflow  │  Properties ✨   │ ░░
░░░ │   $1.2M      │   $5,200   │   3 owned       │ ░░
░░░ └──────────────────────────────────────────────┘ ░░
░░░                       │                          ░░░
░░░                       ▼                          ░░░
░░░              ┌─────────────────┐                 ░░░
░░░              │ Dashboard shows │                 ░░░
░░░              │ your key metrics│                 ░░░
░░░              │ at a glance...  │                 ░░░
░░░              └─────────────────┘                 ░░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

#### 3.5.9 Sound Effects (Optional)

| Event | Sound |
|-------|-------|
| Step transition | Soft "whoosh" or click |
| Tour complete | Success chime |
| Skip tour | None |

*Note: Sounds should be disabled by default, with option to enable in settings.*

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

### Phase 12.1 — Foundation ✅ COMPLETE
- [x] Add onboarding fields to User model
- [x] Create UserPreference model
- [x] Implement onboarding state API endpoints
- [x] Create `useOnboardingState` hook

### Phase 12.2 — Guided Tour ✅ COMPLETE
- [x] Build `GuidedTour` component with step navigation
- [x] Implement tour step definitions
- [x] Add tour trigger points (welcome modal, dashboard help)
- [x] Add progress tracking

### Phase 12.3 — Setup Wizard ✅ COMPLETE
- [x] Build `InitialSetupWizard` component
- [x] Implement each wizard step as sub-component
- [x] Wire up to existing create APIs
- [x] Add progress persistence

### Phase 12.4 — Integration ✅ COMPLETE
- [x] Create `OnboardingWelcomeModal`
- [x] Add `OnboardingProgressBadge` to header
- [x] Connect all components
- [x] Test full flow end-to-end

---

## 10. Files to Create

### 10.1 Components

| File | Purpose |
|------|---------|
| `components/onboarding/OnboardingWelcomeModal.tsx` | Initial welcome overlay |
| `components/onboarding/InitialSetupWizard.tsx` | Multi-step wizard container |
| `components/onboarding/GuidedTour.tsx` | Main tour overlay with animations |
| `components/onboarding/TourSpotlight.tsx` | Animated spotlight/cutout effect |
| `components/onboarding/TourTooltip.tsx` | Animated tooltip card |
| `components/onboarding/TourProgressDots.tsx` | Step indicator dots |
| `components/onboarding/OnboardingProgressBadge.tsx` | Reminder badge in header |
| `components/onboarding/steps/*.tsx` | Individual wizard step components |

### 10.2 Hooks

| File | Purpose |
|------|---------|
| `hooks/useOnboardingState.ts` | Onboarding state management |
| `hooks/useGuidedTour.ts` | Tour navigation and step control |
| `hooks/useTourAnimation.ts` | Animation timing and transitions |

### 10.3 Styles

| File | Purpose |
|------|---------|
| `styles/tour-animations.css` | CSS keyframes and tour styles |

### 10.4 API & Pages

| File | Purpose |
|------|---------|
| `app/api/onboarding/state/route.ts` | Onboarding state API |
| `app/onboarding/page.tsx` | Optional dedicated onboarding page |

### 10.5 Configuration

| File | Purpose |
|------|---------|
| `lib/onboarding/tourSteps.ts` | Tour step definitions |
| `lib/onboarding/wizardSteps.ts` | Wizard step definitions |
| `lib/onboarding/constants.ts` | Animation timings, copy text |

---

## 11. Acceptance Criteria

Phase 12 is complete when:

### Core Functionality
1. ✅ New users see welcome modal on first dashboard visit
2. ✅ Users can take a guided tour of key features
3. ✅ Users can complete setup wizard to enter initial data
4. ✅ Progress is persisted and resumable
5. ✅ Dashboard shows meaningful data after wizard completion
6. ✅ Users can skip and return to onboarding later
7. ✅ Analytics events are tracked
8. ✅ No regressions to existing functionality

### Animation & UX
9. ✅ Spotlight animation smoothly highlights each section
10. ✅ Tooltip cards slide in with proper easing
11. ✅ Progress dots show current step and are clickable
12. ✅ Transitions between steps are smooth (< 0.5s total)
13. ✅ Keyboard navigation works (arrow keys, escape)
14. ✅ Mobile-responsive (tooltip at bottom, swipe support)
15. ✅ Pulse/glow effect draws attention to highlighted element

---

## 12. Enhanced Setup Wizard v2.0

> **Status:** Implementation in Progress (December 2025)
> **Goal:** Complete data entry wizard that captures ALL financial data with proper entity linking

### 12.1 Design Philosophy

The Enhanced Wizard is the **hook** of Monitrax - it must be:

1. **Simple & Clean** - One concept at a time, no overwhelm
2. **Smart** - Adapts steps based on profile type
3. **Multi-Entry** - Add multiple properties, loans, accounts, etc.
4. **Linked** - Properly connects loans to properties, offsets to loans
5. **AI-Assisted** - Context-aware helper on every step
6. **Beautiful** - Smooth animations, delightful interactions

### 12.2 Smart Profile-Based Flow

The wizard adapts based on the user's profile type:

| Profile Type | Steps Shown | Est. Time |
|--------------|-------------|-----------|
| **STARTER** | Welcome → Accounts → Income → Expenses → Review | 3 min |
| **HOMEOWNER** | Welcome → Properties+Loans → Accounts → Income → Expenses → Review | 5 min |
| **INVESTOR** | Welcome → Properties+Loans → Accounts → Investments → Income → Expenses → Review | 7 min |
| **MIXED** | All steps including Assets | 10 min |

### 12.3 Step Specifications

#### Step 1: Welcome & Profile
- Profile type selection with visual cards
- Country & tax year (AU default)
- Animation: Cards flip/hover with subtle shadow

#### Step 2: Properties & Loans (Combined)
For each property:
```
┌─────────────────────────────────────────────────────────────┐
│ 🏠 Property Details                                         │
├─────────────────────────────────────────────────────────────┤
│ Name: [123 Main Street_____________]                        │
│ Type: [▼ Investment Property]  Value: [$850,000____]       │
│                                                             │
│ ┌─ Rental Income ─────────────────────────────────────────┐ │
│ │ Amount: [$650____] per [▼ Week]  Tenant: [__________]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Loan Details ──────────────────────────────────────────┐ │
│ │ ☑ This property has a loan                              │ │
│ │ Lender: [ANZ Bank___]  Principal: [$500,000____]        │ │
│ │ Rate: [6.5%__] [▼ Variable] [▼ P&I] Repay: [$3,200/mo]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Property Expenses ─────────────────────────────────────┐ │
│ │ + Council Rates    [$2,400/year]                        │ │
│ │ + Insurance        [$1,800/year]                        │ │
│ │ + Property Mgmt    [$3,640/year]                        │ │
│ │ [+ Add Expense]                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
          [+ Add Another Property]
```

#### Step 3: Bank Accounts
For each account:
```
┌─────────────────────────────────────────────────────────────┐
│ 🏦 Account Details                                          │
├─────────────────────────────────────────────────────────────┤
│ Name: [Everyday Account_____]  Type: [▼ Transaction]       │
│ Balance: [$15,000____]                                      │
│                                                             │
│ ☐ This is an offset account                                │
│   └─ Linked Loan: [▼ ANZ Home Loan - 123 Main St]          │
└─────────────────────────────────────────────────────────────┘
          [+ Add Another Account]
```

#### Step 4: Investments
For each investment account:
```
┌─────────────────────────────────────────────────────────────┐
│ 📈 Investment Account                                       │
├─────────────────────────────────────────────────────────────┤
│ Name: [CommSec Brokerage__]  Platform: [▼ CommSec]         │
│ Type: [▼ Brokerage]  Cash Balance: [$5,000____]            │
│                                                             │
│ ┌─ Holdings ──────────────────────────────────────────────┐ │
│ │ VAS   | 500 units  @ $95.50  = $47,750                  │ │
│ │ VDHG  | 200 units  @ $62.30  = $12,460                  │ │
│ │ [+ Add Holding]                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
          [+ Add Another Investment Account]
```

#### Step 5: Personal Assets
For each asset:
```
┌─────────────────────────────────────────────────────────────┐
│ 🚗 Personal Asset                                           │
├─────────────────────────────────────────────────────────────┤
│ Name: [2022 Toyota RAV4__]  Type: [▼ Vehicle]              │
│ Purchase Price: [$55,000__]  Current Value: [$42,000__]    │
│                                                             │
│ ┌─ Ongoing Expenses ──────────────────────────────────────┐ │
│ │ + Insurance      [$1,200/year]                          │ │
│ │ + Registration   [$800/year]                            │ │
│ │ + Servicing      [$600/year]                            │ │
│ │ [+ Add Expense]                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
          [+ Add Another Asset]
```

#### Step 6: Income & Expenses
```
┌─ Income Sources ──────────────────────────────────────────────┐
│ Salary (Primary)    $95,000/year  [Gross ▼]                  │
│ Dividends           $2,500/year                               │
│ [+ Add Income Source]                                         │
└───────────────────────────────────────────────────────────────┘

┌─ Living Expenses ─────────────────────────────────────────────┐
│ Groceries           $800/month                                │
│ Utilities           $350/month                                │
│ Transport           $400/month                                │
│ Subscriptions       $150/month                                │
│ [+ Add Expense]                                               │
└───────────────────────────────────────────────────────────────┘
```

#### Step 7: Review & Launch
```
┌─────────────────────────────────────────────────────────────────┐
│              🎉 Your Financial Snapshot                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  NET WORTH  │  │   INCOME    │  │  EXPENSES   │             │
│  │  $892,500   │  │  $97,500/yr │  │  $45,600/yr │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌─ What You've Added ──────────────────────────────────────┐  │
│  │ ✓ 2 Properties worth $1.35M                              │  │
│  │ ✓ 2 Loans totaling $850K                                 │  │
│  │ ✓ 3 Bank Accounts with $45K                              │  │
│  │ ✓ 1 Investment Account worth $65K                        │  │
│  │ ✓ 1 Personal Asset worth $42K                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Monthly Cashflow ───────────────────────────────────────┐  │
│  │ Income:     +$8,125                                      │  │
│  │ Expenses:   -$3,800                                      │  │
│  │ Loans:      -$4,200                                      │  │
│  │ ─────────────────────                                    │  │
│  │ Net:        +$125/month ✓                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│              [🚀 Launch My Dashboard]                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 12.4 AI Helper Component

A floating AI assistant available on every wizard step:

```
┌─────────────────────────────────────────────────────────────┐
│                                    ┌───┐                    │
│                                    │🤖│ ← Floating Button   │
│                                    └───┘                    │
└─────────────────────────────────────────────────────────────┘

When clicked, opens slide-up panel:
┌─────────────────────────────────────────────────────────────┐
│  🤖 Monitrax Assistant                              [×]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  I can help you with this step! Here are some common        │
│  questions:                                                 │
│                                                             │
│  • What's the difference between fixed and variable rate?   │
│  • How do I find my property's current value?               │
│  • Should I include my PPOR or just investments?            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Ask me anything...                            [Send] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Pre-loaded context about current wizard step
- Suggested questions based on step
- Real-time AI responses (uses existing AI strategy engine)
- Remembers conversation throughout wizard

### 12.5 Animation Specifications

#### Entry Animations
```css
/* Card entry - staggered fade up */
@keyframes card-enter {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.wizard-card {
  animation: card-enter 0.4s ease-out forwards;
  animation-delay: calc(var(--card-index) * 0.1s);
}

/* Step transition - slide and fade */
@keyframes step-enter {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes step-exit {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(-30px); }
}

/* Success checkmark animation */
@keyframes checkmark-draw {
  from { stroke-dashoffset: 50; }
  to { stroke-dashoffset: 0; }
}

/* Confetti on completion */
@keyframes confetti-fall {
  0% { transform: translateY(-100vh) rotate(0deg); }
  100% { transform: translateY(100vh) rotate(720deg); }
}
```

#### Micro-interactions
- Input focus: Subtle border glow
- Button hover: Scale up 1.02x with shadow
- Card hover: Lift with shadow
- Add button: Expand animation
- Delete: Collapse with fade
- Progress bar: Smooth fill animation

### 12.6 Component Structure

```
components/onboarding/
├── wizard/
│   ├── WizardContainer.tsx      # Main wizard shell with progress
│   ├── WizardProgress.tsx       # Animated progress bar
│   ├── WizardNavigation.tsx     # Back/Next buttons
│   ├── AIHelperButton.tsx       # Floating AI button
│   ├── AIHelperPanel.tsx        # Slide-up AI chat panel
│   └── steps/
│       ├── WelcomeStep.tsx      # Profile + country selection
│       ├── PropertiesStep.tsx   # Multi-property with loans
│       ├── AccountsStep.tsx     # Multi-account with offset
│       ├── InvestmentsStep.tsx  # Multi-investment with holdings
│       ├── AssetsStep.tsx       # Personal assets with expenses
│       ├── IncomeExpensesStep.tsx # Income + expenses combined
│       └── ReviewStep.tsx       # Summary dashboard preview
├── shared/
│   ├── MultiEntryCard.tsx       # Reusable card for multi-entry
│   ├── CollapsibleSection.tsx   # Expandable sub-sections
│   └── EntitySelector.tsx       # Dropdown for linking entities
```

### 12.7 API Endpoint

**POST /api/onboarding/bulk-create**

Creates all entities in a single transaction:
```typescript
interface BulkCreateRequest {
  properties: PropertyInput[];
  loans: LoanInput[];        // includes propertyId reference
  accounts: AccountInput[];  // includes offsetLoanId reference
  investments: InvestmentAccountInput[];
  holdings: HoldingInput[];
  assets: AssetInput[];
  income: IncomeInput[];
  expenses: ExpenseInput[];
}
```

**Response:**
```typescript
{
  success: true,
  created: {
    properties: 2,
    loans: 2,
    accounts: 3,
    investments: 1,
    holdings: 5,
    assets: 1,
    income: 2,
    expenses: 8
  },
  summary: {
    netWorth: 892500,
    annualIncome: 97500,
    annualExpenses: 45600,
    monthlyCashflow: 125
  }
}
```

### 12.8 Implementation Files

| Action | File | Description |
|--------|------|-------------|
| Create | `components/onboarding/wizard/WizardContainer.tsx` | Main container |
| Create | `components/onboarding/wizard/AIHelperButton.tsx` | Floating button |
| Create | `components/onboarding/wizard/AIHelperPanel.tsx` | Chat panel |
| Create | `components/onboarding/wizard/steps/WelcomeStep.tsx` | Step 1 |
| Create | `components/onboarding/wizard/steps/PropertiesStep.tsx` | Step 2 |
| Create | `components/onboarding/wizard/steps/AccountsStep.tsx` | Step 3 |
| Create | `components/onboarding/wizard/steps/InvestmentsStep.tsx` | Step 4 |
| Create | `components/onboarding/wizard/steps/AssetsStep.tsx` | Step 5 |
| Create | `components/onboarding/wizard/steps/IncomeExpensesStep.tsx` | Step 6 |
| Create | `components/onboarding/wizard/steps/ReviewStep.tsx` | Step 7 |
| Create | `app/api/onboarding/bulk-create/route.ts` | Bulk API |
| Create | `styles/wizard-animations.css` | Animation styles |
| Modify | `components/DashboardLayout.tsx` | Integration |

---

## 13. Revision History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2025-12-05 | Initial blueprint |
| v1.1 | 2025-12-05 | Added animated navigation guide specifications |
| v1.2 | 2025-12-07 | Full implementation complete |
| v2.0 | 2025-12-09 | Enhanced Wizard v2.0 - comprehensive data entry with AI helper |

---

## 14. Database Migration Required

After deployment, run the following migrations:

```sql
-- Add onboarding fields to users table
ALTER TABLE "users" ADD COLUMN "onboardingCompleted" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN "onboardingProfileType" TEXT;
ALTER TABLE "users" ADD COLUMN "onboardingStartedAt" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN "onboardingCompletedAt" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN "onboardingStep" INTEGER DEFAULT 0;

-- Create user_preferences table
CREATE TABLE "user_preferences" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "hasSeenGuidedTour" BOOLEAN DEFAULT false,
  "tourSkippedAt" TIMESTAMP,
  "tourCompletedAt" TIMESTAMP,
  "dismissedOnboardingBadge" BOOLEAN DEFAULT false,
  "dismissedWelcomeModal" BOOLEAN DEFAULT false,
  "preferredCurrency" TEXT DEFAULT 'AUD',
  "preferredDateFormat" TEXT DEFAULT 'DD/MM/YYYY',
  "country" TEXT DEFAULT 'AU',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
```

---

*END OF PHASE 12 BLUEPRINT v1.2*
