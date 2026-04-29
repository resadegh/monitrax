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

#### Mobile Responsiveness Audit & Fixes (2026-04-19)

**User report:** Onboarding wizard unusable on mobile — Next/Continue
button pushed off-screen.

**Root cause:** `wz-page-card` had no height constraint, so content
could grow beyond viewport. `ShellInner` used `flex h-full` but the
parent had no fixed height reference.

**Wizard fixes (`components/onboarding/wizard/WizardContainer.tsx`
+ `styles/wizard-animations.css`):**
- Card: full-screen on mobile (100dvh, no border-radius), card layout
  on desktop. Uses flex to ensure footer always visible.
- Shell: flex column on mobile, block on desktop
- Progress bar circles: 32px → 24px on mobile (so 10 steps fit)
- Header/footer/body: reduced padding on mobile (px-4 vs px-6)
- Footer: `flex-shrink-0` + opaque bg so it stays pinned at bottom
- Progress bar container: `overflow-x-auto` fallback

**TrailStageIndicator fixes
(`components/dashboard/TrailStageIndicator.tsx`):**
- Progress circles: 36px → 28px on mobile
- Connecting lines: 12px min → 8px min on mobile
- Container: `overflow-x-auto` safety net

**Safety Net page fixes (`app/dashboard/safety-net/page.tsx`):**
- Emergency fund grid: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
  (currency text was overflowing on small phones)
- Bills header: fixed `gap-6` → `gap-3 sm:gap-6` + `flex-wrap`

**TRAIL Check results fixes (`app/trail-check/page.tsx`):**
- Progress circles: 40px → 32px on mobile
- Reduced gaps between circles on mobile

**Audit confirmed OK:**
- `DashboardLayout.tsx` — mobile drawer works correctly
- `TrailHero.tsx`, `TrailJourney.tsx` — responsive by design
- `trail-method/page.tsx` — section-based, scales well
- `trail-check/page.tsx` question view — answer buttons use `w-full`

## Session: claude/review-monitrax-docs-2hNSa — OnboardingWelcomeModal mobile fix

### Changes Made

- **Type:** Fix (mobile responsive)
- **Scope:** `components/onboarding/OnboardingWelcomeModal.tsx`
- **Root cause:** The welcome modal card used `overflow-hidden`
  with no height constraint. The fixed hero (192px), padded body,
  3 stacked value-prop cards, two full-width CTAs, and the bottom
  skip row combined to roughly 840px — taller than the visible
  viewport on any iPhone in portrait with the Safari chrome
  showing. Because the card was `overflow-hidden` (not scrollable)
  and centred with `flex items-center justify-center`, the
  "Start your TRAIL" primary CTA and the "Don't show this again"
  row were clipped off-screen with no way to reveal them.
- **Solution:**
  - Card becomes a flex column with
    `max-h-[calc(100dvh-1.5rem)]` on mobile (2rem on `sm+`) so it
    can never exceed the viewport. `100dvh` correctly accounts for
    the dynamic Safari address bar.
  - Hero is `flex-shrink-0` and shrinks to 128px on mobile
    (`h-32 sm:h-48`) so more of the viewport is usable for the
    CTAs.
  - Body is `flex-1 min-h-0 overflow-y-auto` — scrolls internally
    when content exceeds available height instead of being
    clipped.
  - Typography + paddings scaled down on mobile: title
    `text-2xl sm:text-3xl`, body `px-5 sm:px-8`, CTA
    `py-3 sm:py-3.5`, etc.
  - Value-prop cards switch to horizontal (icon left, text right)
    on mobile to reduce vertical footprint, staying grid-columns
    on `sm+`.
- **Note on the auto-redirect to `/dashboard`:** the user reported
  that typing `monitrax.com.au` on mobile sends them to
  `/dashboard`. This is intentional — `app/page.tsx` redirects
  authenticated users to the dashboard. The symptom the user saw
  (no Next button visible) was the welcome modal clipping issue
  above, not the redirect.

### Files Modified

- `components/onboarding/OnboardingWelcomeModal.tsx` — mobile
  responsive layout (flex column + scroll, smaller hero/title,
  horizontal value props on `<sm`)

### Build Status

- [x] `npm run build` passes
- [x] No new TypeScript errors

### Outstanding

- None for this fix. Desktop rendering unchanged (all `sm:`
  breakpoints preserve the current look from 640px up).

## Session: claude/review-monitrax-docs-2hNSa — Bank import FK violation + UX cleanup

### Changes Made

#### 1. Fix: `/api/bank/import` foreign-key crash

- **Type:** Fix (data integrity)
- **Scope:** `app/api/bank/import/route.ts`
- **Symptom:** Uploading a QIF/CSV/OFX file from the onboarding
  AccountsStep returned:
  > Invalid `prisma.unifiedTransaction.createMany()` invocation:
  > Foreign key constraint violated: `unified_transactions_accountId_fkey`
- **Root cause:** When the request didn't supply an `accountId` (the
  ImportWizard's "None - Import without account" option, or no
  selection at all), the server fell back to `tx.bankAccountId ?? accountId ?? ''`.
  An empty-string `accountId` was written into `UnifiedTransaction`,
  which is a non-nullable FK to `Account` — Postgres rejected the
  bulk insert and the whole import aborted.
- **Solution:**
  - Auto-create an Account from the parsed file when no `accountId`
    is supplied (matches the wizard tile copy: *"We'll parse it and
    create an account with the closing balance as the anchor point."*).
    The new account uses `metadata.detectedBank` for the institution,
    `closingBalance` for `currentBalance`, and `balanceSource = 'IMPORT'`.
  - Backfill the `BankImportFile.accountId` so the audit trail links
    the upload to the materialised account.
  - Replace the `?? ''` fallback in the `createMany` map with a
    defensive guard that throws with a descriptive message if the
    auto-create branch ever fails to run (it shouldn't, by invariant).
  - Skip the post-import balance update when we just created the
    account — the create call already wrote the closing balance.
  - Return `createdAccount` in the response so the client can
    update its local state without a follow-up `GET /api/accounts`.

#### 2. UX: remove "Import without account"; require explicit selection

- **Type:** UX / safety
- **Scope:** `components/bank/ImportWizard.tsx`
- **Why:** Per user request — the "None - Import without account"
  option was structurally broken (see above) and is no longer a
  valid path. Users must either pick an existing account or create
  one inline before importing.
- **Solution:**
  - Removed the `<SelectItem value="none">None - Import without account</SelectItem>`
    option entirely.
  - When the user has no existing accounts, the dropdown is
    replaced by an instructional helper ("No accounts yet — create
    one below to import these transactions into.").
  - The "Create account" button auto-prefills the institution from
    `metadata.detectedBank` and the balance from
    `balanceInfo.closingBalance` so the user only has to confirm.
  - Disabled the "Import N Transactions" CTA when no account is
    selected (with a tooltip hint).
  - Cleaned up the now-stale `selectedAccount !== 'none'` check
    in the balance-update toggle.

#### 3. Fix: imported account row showed $0 balance in onboarding

- **Type:** Fix (display)
- **Scope:** `components/bank/ImportWizard.tsx`,
  `components/onboarding/wizard/steps/AccountsStep.tsx`
- **Symptom:** After successfully importing via the inline "Create
  New Account" panel, the imported account appeared in the
  onboarding AccountsStep with `$0` balance and the Cash/Net
  summary tiles read `$0` even though the user had typed a real
  balance during account creation.
- **Root cause:** The `onAccountCreated` callback only forwarded
  `{ id, name, type }`. AccountsStep's `handleImportAccountCreated`
  defaulted `currentBalance` to `0` because it had nothing else to
  use.
- **Solution:**
  - Added `currentBalance?: number` to ImportWizard's `Account`
    interface and forwarded the user-entered (or server-returned)
    balance through `onAccountCreated`.
  - Updated `AccountsStep.handleImportAccountCreated` to use the
    forwarded `currentBalance` (falling back to `0` only if the
    callback omits it).
  - Passed `currentBalance` through the `accounts` prop list so
    re-imports into existing IMPORT accounts stay consistent.

### Files Modified

- `app/api/bank/import/route.ts` — auto-create account when no
  `accountId`; backfill `BankImportFile.accountId`; defensive guard
  against empty-string FK; return `createdAccount` in response.
- `components/bank/ImportWizard.tsx` — remove "None" option,
  require explicit selection, prefill new-account form from file
  metadata, forward real `currentBalance` through `onAccountCreated`,
  disable Import CTA without selection.
- `components/onboarding/wizard/steps/AccountsStep.tsx` — accept
  and use forwarded `currentBalance` from import; pass balance
  through to ImportWizard accounts prop.

### Build Status

- [x] `npm run build` passes (Next.js 15.2.6, no new TS errors)

### Destructive write checklist (CLAUDE.md §12.11)

`prisma.bankImportFile.update(...)` — backfills `accountId` on the
import file row this same request just created with `accountId: null`.

1. **`where` clause matches:** `{ id: importFile.id }` — the row this
   request created seconds earlier on line ~135. Cannot match any
   other row.
2. **Columns overwritten:** `accountId` only. Previous value was the
   request-supplied `null`; new value is the `id` of the Account this
   same code path just created above.
3. **Guard:** The `where` clause is the synthetic UUID generated for
   this import file. No other row can hold that id.

User confirmation: NOT REQUIRED — synthetic-key guard, only mutates
a row created earlier in the same request.

`prisma.account.create(...)` — net new row, not a destructive op.

### Outstanding

- The `<SelectItem value="none">` removal applies to all callers of
  `ImportWizard`, not just onboarding. Verified by grep: ImportWizard
  is only used from `AccountsStep` and `app/dashboard/transactions/import`.
  The post-onboarding import flow benefits from the same fix (the
  "None" option was equally broken there).

### Build Status

- [x] TypeScript compilation passes across all PRs
- [x] Vercel build deploys successfully
- [x] Production deployed (multiple merged PRs)
- [x] Mobile responsive tested on narrow viewports (< 320px)

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
