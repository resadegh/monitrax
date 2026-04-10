# MONITRAX CHANGELOG — December 7, 2025

**Session ID:** claude/fix-prompt-length-error-01CjVUZZsrZPvUyS2PmMS6tY
**Date:** 2025-12-07
**Status:** Implemented & Ready to Push

---

## Summary of Changes

This session implemented Phase 12: Onboarding Tour & Initial Setup Wizard - a complete onboarding experience for new users with animated tour, welcome modal, and multi-step data entry wizard.

---

## 1. Schema Changes (Prisma)

**Type:** New Feature
**Files Modified:**
- `prisma/schema.prisma`

### New Enum: OnboardingProfileType
```prisma
enum OnboardingProfileType {
  HOMEOWNER           // Prioritise property setup
  INVESTOR            // Prioritise investment accounts
  MIXED               // Property investor with investments
  STARTER             // Just getting started
}
```

### User Model Additions
```prisma
model User {
  // ... existing fields

  // Phase 12: Onboarding fields
  onboardingCompleted    Boolean               @default(false)
  onboardingProfileType  OnboardingProfileType?
  onboardingStartedAt    DateTime?
  onboardingCompletedAt  DateTime?
  onboardingStep         Int                   @default(0)

  // Relationship
  userPreference         UserPreference?
}
```

### New Model: UserPreference
```prisma
model UserPreference {
  id                      String   @id @default(uuid())
  userId                  String   @unique

  // Tour state
  hasSeenGuidedTour       Boolean  @default(false)
  tourSkippedAt           DateTime?
  tourCompletedAt         DateTime?

  // Onboarding UI state
  dismissedOnboardingBadge Boolean @default(false)
  dismissedWelcomeModal   Boolean  @default(false)

  // User preference settings
  preferredCurrency       String   @default("AUD")
  preferredDateFormat     String   @default("DD/MM/YYYY")
  country                 String   @default("AU")

  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  // Relationships
  user                    User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_preferences")
}
```

---

## 2. API Endpoints

**Type:** New Feature
**Files Created:**
- `app/api/onboarding/state/route.ts`
- `app/api/onboarding/complete/route.ts`

### GET /api/onboarding/state
Returns onboarding state for current user:
- Onboarding completion status
- Profile type selection
- Current wizard step
- User preferences
- Existing data summary (properties, accounts, income, expenses)

### POST /api/onboarding/state
Updates onboarding state:
- Profile type
- Current step
- Tour completion/skip
- Modal dismissals
- Preference updates

### POST /api/onboarding/complete
Marks onboarding as complete and sets appropriate flags.

---

## 3. Hooks

**Type:** New Feature
**Files Created:**
- `hooks/useOnboardingState.ts`
- `hooks/useGuidedTour.ts`

### useOnboardingState
Manages onboarding state with:
- State fetching and caching
- Computed properties (shouldShowWelcome, shouldShowTour, etc.)
- Actions (startOnboarding, completeOnboarding, dismissWelcomeModal, etc.)

### useGuidedTour
Manages tour navigation with:
- Step navigation (next, prev, goToStep)
- Animation timing
- Keyboard navigation (arrow keys, escape)
- Position tracking for spotlight

---

## 4. Components

**Type:** New Feature
**Files Created:**
- `components/onboarding/GuidedTour.tsx`
- `components/onboarding/TourSpotlight.tsx`
- `components/onboarding/TourTooltip.tsx`
- `components/onboarding/OnboardingWelcomeModal.tsx`
- `components/onboarding/OnboardingProgressBadge.tsx`
- `components/onboarding/InitialSetupWizard.tsx`
- `components/onboarding/index.ts`

### Wizard Step Components
- `components/onboarding/steps/ProfileTypeStep.tsx`
- `components/onboarding/steps/CountryTaxStep.tsx`
- `components/onboarding/steps/BankAccountStep.tsx`
- `components/onboarding/steps/PropertyStep.tsx`
- `components/onboarding/steps/InvestmentAccountStep.tsx`
- `components/onboarding/steps/IncomeStep.tsx`
- `components/onboarding/steps/ExpenseStep.tsx`
- `components/onboarding/steps/ReviewStep.tsx`

---

## 5. Styles

**Type:** New Feature
**Files Created:**
- `styles/tour-animations.css`

### Animation Effects
- **Spotlight overlay**: Dark background with cutout
- **Pulse animation**: Glow effect on highlighted elements
- **Slide-in animations**: Left, right, top, bottom tooltip entrances
- **Fade transitions**: Smooth step transitions
- **Progress dots**: Clickable step indicators

---

## 6. DashboardLayout Integration

**Type:** Feature Enhancement
**Files Modified:**
- `components/DashboardLayout.tsx`

### Changes
- Added onboarding state management
- Integrated OnboardingWelcomeModal (shows for new users)
- Integrated GuidedTour component
- Integrated InitialSetupWizard
- Added OnboardingProgressBadge for in-progress onboarding
- Added data-tour attributes to sidebar for tour targeting

---

## 7. User Flow

### New User Experience
1. User signs up and visits dashboard
2. **Welcome Modal** appears with options:
   - "Start guided setup" → Opens wizard
   - "Take a quick tour first" → Opens tour
   - "Skip for now" → Dismisses modal
3. **Guided Tour** (9 steps):
   - Welcome to Monitrax
   - Navigation Sidebar
   - Dashboard Overview
   - Properties
   - Loans
   - Investments
   - Income & Expenses
   - Strategy Engine
   - Ready to Go!
4. **Setup Wizard** (8 steps):
   - Profile Type selection
   - Country & Tax Year
   - Bank/Cash Account
   - Property (optional)
   - Investment Account (optional)
   - Income Source
   - Baseline Expenses
   - Review & Confirm

### Progress Persistence
- Progress is saved to database
- Users can resume wizard from where they left off
- Progress badge shows in dashboard header

---

## Files Summary

| Action | File |
|--------|------|
| Modified | `prisma/schema.prisma` |
| Created | `app/api/onboarding/state/route.ts` |
| Created | `app/api/onboarding/complete/route.ts` |
| Created | `hooks/useOnboardingState.ts` |
| Created | `hooks/useGuidedTour.ts` |
| Created | `components/onboarding/GuidedTour.tsx` |
| Created | `components/onboarding/TourSpotlight.tsx` |
| Created | `components/onboarding/TourTooltip.tsx` |
| Created | `components/onboarding/OnboardingWelcomeModal.tsx` |
| Created | `components/onboarding/OnboardingProgressBadge.tsx` |
| Created | `components/onboarding/InitialSetupWizard.tsx` |
| Created | `components/onboarding/index.ts` |
| Created | `components/onboarding/steps/ProfileTypeStep.tsx` |
| Created | `components/onboarding/steps/CountryTaxStep.tsx` |
| Created | `components/onboarding/steps/BankAccountStep.tsx` |
| Created | `components/onboarding/steps/PropertyStep.tsx` |
| Created | `components/onboarding/steps/InvestmentAccountStep.tsx` |
| Created | `components/onboarding/steps/IncomeStep.tsx` |
| Created | `components/onboarding/steps/ExpenseStep.tsx` |
| Created | `components/onboarding/steps/ReviewStep.tsx` |
| Created | `styles/tour-animations.css` |
| Modified | `components/DashboardLayout.tsx` |
| Modified | `docs/blueprint/PHASE_12_ONBOARDING_TOUR.md` |

---

## Testing Notes

- TypeScript compilation passes (`npx tsc --noEmit`)
- All components are client-side ('use client')
- Animations use CSS keyframes for performance
- Mobile responsive design included
- Keyboard navigation supported

---

## Database Migration Required

After deployment, run Prisma migration or apply manually:

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

## Related Blueprint Phases

- **Phase 12** — Onboarding Tour & Initial Setup Wizard (THIS SESSION)
- **Phase 19** — Document Management & Storage Layer
- **Phase 19.1** — Document Management System Expansion

---

*Document Version: 1.0*
*Created: 2025-12-07*
