# Changelog — 2026-04-17 through 2026-04-19

## Session: TRAIL Framework — complete integration across app, website, onboarding

### Overview

Multi-day session introducing the TRAIL framework as Monitrax's core identity.
Replaced the REACH framework (v1.0, 2026-04-16) with TRAIL (v2.0) after
determining that the stage order needed to be behavioural-first
(action before safety net). Integrated TRAIL across all user touchpoints:
sidebar, website, onboarding wizard, dashboard, docs.

### Changes Made

#### TRAIL Framework (REACH replaced)

- **Type:** Framework / Core identity
- **Scope:** Entire app + website + documentation
- **Description:** TRAIL is Monitrax's 5-stage financial journey:
  T (Track) → R (Reduce) → A (Anchor) → I (Invest) → L (Live).
  Replaces REACH which had the wrong stage order (Establish before Act).

#### Brand / Naming

- **My CFO → My Guide** — "CFO" was corporate jargon; "Guide" reflects
  the warm, trail-walking metaphor. Updated across sidebar, docs,
  marketing copy. Backend code paths (`/api/cfo`, `lib/cfo/`) kept
  for separate refactor.

#### Sidebar Restructure

- Flat 9-item sidebar with TRAIL badges (T, R, A, I, L)
- All 5 TRAIL stages visible via dedicated items
- "Portfolio" → "My Wealth", "Transactions" → "My Accounts",
  "Planning" → "My Budget", "Personal CFO" → "My Guide"
- New "My Safety Net" page for Anchor stage (A badge)
- Removed Accordion grouping — flat with sub-items on active section

#### Website Redesign

- New landing page structure: Hero → Problem → Bridge → TRAIL Journey
  → How It Works → Testimonials → CTA (all TRAIL-aligned)
- Warm stone/amber palette replacing blue/indigo/violet
- Framer Motion scroll animations with Apple easing curve
- **NEW `/trail-check`** — free 5-question pre-signup assessment
  showing visitor's TRAIL stage
- **NEW `/trail-method`** — full YNAB-style educational article
  explaining the TRAIL method
- Header nav updated: "Features" → "The TRAIL" + "Method" link added
- TRAIL Check results saved to localStorage for post-signup handoff

#### My Safety Net page (NEW)

- `/dashboard/safety-net` — dedicated page for TRAIL Stage A (Anchor)
- Answers: "If something goes wrong tomorrow, am I OK?"
- Widgets: Emergency Fund Tracker, Bills Status, Safety Score (0-100),
  What-If Scenarios, Guide Recommendations
- New API: `GET /api/safety-net` — calculates all metrics from
  existing data (accounts, expenses, loans, recurring payments).
  No new database models.

#### Home Dashboard TRAIL Indicator

- New `TrailStageIndicator` component on dashboard
- Visual T-R-A-I-L progress bar showing user's current stage
- Auto-detects stage from master snapshot
- Page title: "Dashboard" → "Home"
- Description: "financial overview" → "TRAIL to financial freedom"
- Empty state: "Welcome to Monitrax" → "Welcome to Your TRAIL"

#### Onboarding TRAIL Alignment

- Welcome Modal: "Welcome to Monitrax" → "Welcome to your TRAIL"
- Resume Banner: "Pick up where you left off" → "Continue your TRAIL"
- All 11 wizard step subtitles updated with TRAIL language
- Setup page: "Set up Monitrax" → "Set up your TRAIL"

#### Wizard Re-enabled (`/onboarding`)

- **Status:** Re-enabled after R12 (disabled since 2026-04-15)
- **Root cause safe now:** Wizard uses bulk-create API
  (`prisma.create` only, no upserts). Old `onboardingEstimateService`
  remains disabled as defence in depth.
- **Fix:** Mounts `WizardContainer` in `mode="page"` with full
  wizard render, hydrated draft, autosave, and bulk-create completion
- **Bug fixed (during session):** First attempt only rendered a
  loading spinner; fixed by properly mounting WizardContainer

#### TRAIL Check → Wizard Handoff

- `WelcomeStep` reads TRAIL Check results from localStorage
- Shows "Welcome back! You're at Stage X" when user completed the
  pre-signup check

#### Guide Engine TRAIL Stage-Matching

- New `lib/cfo/trailStage.ts` utility
- `determineTrailStage()`, `getTrailStageInfo()`,
  `actionCategoryToTrailStage()`, `isActionRelevantToStage()`
- Not yet wired into the Guide action engine — utility ready for
  integration in a future session

#### Bug Fixes (during session)

- Fixed React error #31 on `/recurring` (object rendered as child)
- Added error state to `/dashboard/cfo` (was showing generic "Unable to load")
- Fixed `json.error` type safety on `/health` and `/dashboard/tax`
- Safety Net API: defensive `safeToMonthly` wrapper for frequency
  conversion edge cases
- Added Google Places address autocomplete to Properties wizard step

### Files Modified (partial list — full list in git log)

**New Files:**
- `docs/blueprint/TRAIL_FRAMEWORK.md`
- `docs/marketing/TRAIL_WEBSITE_COPY.md`
- `docs/marketing/THE_TRAIL_METHOD.md`
- `app/trail-check/page.tsx`
- `app/trail-method/page.tsx`
- `app/dashboard/safety-net/page.tsx`
- `app/api/safety-net/route.ts`
- `components/dashboard/TrailStageIndicator.tsx`
- `components/marketing/TrailHero.tsx`, `TrailProblem.tsx`,
  `TrailBridge.tsx`, `TrailJourney.tsx`, `TrailHowItWorks.tsx`,
  `TrailTestimonials.tsx`, `TrailCTA.tsx`, `animations.tsx`
- `lib/cfo/trailStage.ts`

**Modified Files:**
- `CLAUDE.md` — Part 14 TRAIL Framework
- `docs/blueprint/MASTER_BLUEPRINT.md`
- `components/DashboardLayout.tsx` — sidebar restructure
- `components/onboarding/OnboardingWelcomeModal.tsx`
- `components/onboarding/OnboardingResumeBanner.tsx`
- All 11 wizard step components
- `app/onboarding/page.tsx` — re-enabled
- `app/dashboard/page.tsx` — TRAIL indicator
- `app/dashboard/setup/page.tsx` — TRAIL language
- `app/page.tsx` — new TRAIL landing page
- `components/marketing/Header.tsx` — "Method" link

**Removed Files:**
- `docs/blueprint/REACH_FRAMEWORK.md` (replaced by TRAIL)
- `docs/marketing/REACH_WEBSITE_COPY.md` (replaced by TRAIL)

### Build Status

- [x] TypeScript compilation passes across all PRs
- [x] Vercel build deploys successfully
- [x] Production deployed (multiple merged PRs)

### Commit History (pull requests merged)

| PR | Title |
|----|-------|
| #529 | docs: REACH Financial Freedom Framework — core identity |
| #530 | feat: REACH sidebar restructure |
| #531 | fix(sidebar): add REACH sub-navigation and ESTABLISH badge |
| #532 | fix: error handling on recurring, CFO, health, tax pages |
| #533 | feat: TRAIL framework — replaces REACH |
| #534 | refactor: rename My CFO to My Guide |
| #535 | feat: TRAIL-aligned website redesign |
| #536 | feat: My Safety Net page — TRAIL Stage A |
| #537 | style: bigger TRAIL stage badges in sidebar |
| #538 | feat: TRAIL Check — free pre-signup assessment |
| #539 | feat: align all onboarding flows with TRAIL |
| #540 | feat: TRAIL Method + dashboard indicator + Guide matching |
| #541 | feat(my-accounts): Phase 36 sub-page collapse |
| #542 | fix(onboarding): render WizardContainer on /onboarding |
| #543 | fix(onboarding): address autocomplete in Properties step |

### Documentation Updated

- [x] `docs/blueprint/TRAIL_FRAMEWORK.md` created (10 sections)
- [x] `CLAUDE.md` Part 14 (TRAIL Framework — Core Identity)
- [x] `docs/blueprint/MASTER_BLUEPRINT.md` updated
- [x] `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md` cross-reference + wizard status
- [x] `docs/changelog/CHANGELOG_2026_04_19.md` (this file)

### Outstanding / Next Session

- [ ] Guide action engine: wire up `trailStage.ts` utilities into
  `generateActions` so recommendations are stage-matched
- [ ] Pricing page: doesn't exist yet — add TRAIL alignment when built
- [ ] Code rename: `/api/cfo` → `/api/guide`, `lib/cfo/` → `lib/guide/`
  (user-facing names already done; this is a code refactor for
  consistency)
- [ ] Review step TRAIL stage indicator component (copy already
  updated, visual component still the stats snapshot)
