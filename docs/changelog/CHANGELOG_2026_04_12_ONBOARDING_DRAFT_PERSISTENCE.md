# Changelog — 2026-04-12

## Session: claude/review-monitrax-docs-ty15A (PR 2 — Onboarding Draft Persistence + Design Pass)

### Changes Made

- **Type**: Feature + Refactor + Design
- **Scope**: Onboarding wizard draft persistence, resume banner, welcome modal redesign, dead-code cleanup
- **Motivation**:
  1. Onboarding previously had no resume capability — closing the wizard wiped
     all progress, making the ~10-minute MIXED flow a landmine for any user
     who got interrupted.
  2. The welcome modal's "show once / never again" contract was too
     aggressive: clicking "Skip for now" permanently dismissed the modal
     even without the user's explicit consent.
  3. The first-time experience deserved a premium visual pass. Phase 12
     is the user's first interaction with the product and should feel
     like a best-in-class onboarding.

### Strict Show-Once Contract (as of PR 2)

| User action | Welcome modal on next login? |
|---|---|
| Completed the wizard (bulk-create success) | **Never** |
| Clicked "Don't show this again" + skipped | **Never** |
| Closed with X / backdrop / "Not right now" (no checkbox) | **Yes — reappears** |
| Started wizard, saved some data, closed | **No — resume banner shows instead** |
| Took/skipped the guided tour | **No effect — still shows** |

Implemented in `hooks/useOnboardingState.ts::shouldShowWelcome`. The
`dismissWelcomeModal()` mutation is reserved exclusively for the checkbox
path. Simple X / backdrop / "Not right now" now only sets local React
state (`showWelcomeModal = false`) and never writes to the server.

### Draft Persistence Architecture

1. **Server-side store**: new `UserPreference.onboardingDraft Json?`
   column. Stores the full `WizardData` blob as a JSON column. Nullable;
   cleared on bulk-create success.
2. **Autosave**: `WizardContainer` debounces every state change by 1200ms
   and calls `onAutoSave(data, stepIndex)`. The first autosave of each
   "open session" is suppressed (it would just write back what we
   hydrated from).
3. **Hydration**: `DashboardLayout` passes the server draft as
   `initialData` and `onboardingState.currentStep` as `initialStepIndex`
   to `WizardContainer` on mount.
4. **LocalStorage fallback**: same-device blip safety net, scoped by
   `userId`. Only consulted when the server returned no draft.
5. **Cleanup**: `bulk-create/route.ts` explicitly sets
   `onboardingDraft: null` in the final `userPreference.upsert`, so the
   resume banner disappears immediately on completion.
6. **Size guard**: server rejects drafts > 200 KB with HTTP 413.
7. **Privacy**: draft is user-entered (not CDR data, per CLAUDE.md
   §13.1), so standard input-validation rules apply. No audit logging
   of draft contents.

### Resume Banner

New component: `components/onboarding/OnboardingResumeBanner.tsx`.

- Shown on `/dashboard` when `shouldShowResumeBanner` is true
  (`!onboardingCompleted && (server draft || step progress || local draft)`)
  AND the user hasn't session-dismissed it.
- Actions: **Resume** (reopens wizard with hydrated state), **Start over**
  (clears draft + resets `currentStep`), **X** (session-scoped hide).
- Takes priority over the welcome modal — if a draft exists, the welcome
  modal is suppressed regardless of preference flags.

### Premium Design Pass (PR 2 scope)

Redesigned for the first-time experience:

- **`OnboardingWelcomeModal`** — complete visual overhaul:
  - Radial-gradient backdrop with soft blur
  - 192px hero with rotating conic-gradient **aurora** (blue → violet → pink)
  - Noise-texture overlay for premium tactile feel
  - 4 floating animated sparkle particles
  - Glass-frosted logo mark inside a gradient pill
  - Animated time chip: "Takes about 5 minutes"
  - Gradient headline with clip-text effect on "Monitrax"
  - 3-column horizontal value-prop grid with staggered entry animations
  - Gradient primary CTA with hover-triggered gradient shift + inner glow
  - Ghost-style secondary CTA for tour
  - Native dark-mode support throughout
  - Full keyboard accessibility (ARIA, focus trap, Escape key)
  - `prefers-reduced-motion` honoured — all keyframes disabled
  - Body-scroll lock while open

- **`OnboardingResumeBanner`** — matches the same design language:
  - Left-edge gradient accent bar
  - Ambient glow behind the rocket icon (echoes welcome hero)
  - Inline progress meter with gradient fill
  - Same gradient primary CTA, same ghost secondary CTA
  - Animated sparkle on the rocket mark
  - Fully responsive (column-stack on mobile, row on desktop)

- **New animation keyframes** (`styles/wizard-animations.css` appended):
  `welcome-backdrop-enter`, `welcome-modal-enter`, `aurora-drift`,
  `sparkle-float`, `welcome-prop-enter`, `chip-pulse`. All pure CSS, no
  external animation libraries.

### Dead Code Removed (PR 2 sweep)

Per CLAUDE.md §12.1 — zero tolerance for bloat:

| Path | Why dead |
|---|---|
| `components/onboarding/shared/CurrencyInput.tsx` | Duplicate of `components/form/CurrencyInput.tsx`, no imports anywhere |
| `components/onboarding/shared/FrequencySelect.tsx` | Orphaned; wizard steps have inline frequency selects |
| `components/onboarding/shared/SectionSummary.tsx` | `ReviewStep` has its own inline version |
| `components/onboarding/shared/StatCard.tsx` | `ReviewStep` has its own inline version |
| `components/onboarding/shared/index.ts` | Barrel re-export of the above |
| `components/onboarding/shared/` (directory) | Empty after deletions |

Plus 14 unused imports across the wizard steps:

- `AccountsStep`: `ChevronDown`, `ChevronUp`
- `AssetsStep`: `Calendar`
- `HouseholdStep`: `Briefcase`
- `IncomeExpensesStep`: `Store`, `Users`, `SalaryType` (type)
- `InvestmentsStep`: `DollarSign`, `HoldingType` (type)
- `PropertiesStep`: `Calendar`, `DollarSign`, `Percent`, and the
  duplicate mid-file `import { ExpenseCategory, EXPENSE_CATEGORY_LABELS }`
  (merged into the top import block)
- `ReviewStep`: `CreditCard`, `DollarSign`
- `WizardContainer`: `WizardStepId` (type)

Net dead-code removed in PR 2: ~340 LOC across 6 deleted files + 14 imports.

### Files Modified

**Schema + API:**
- `prisma/schema.prisma` — Added `UserPreference.onboardingDraft Json?`
- `app/api/onboarding/state/route.ts` — GET returns `draft`; POST accepts
  `draft` / `clearDraft` with 200 KB size guard; 413 on overflow
- `app/api/onboarding/bulk-create/route.ts` — Clears `onboardingDraft`
  to `null` in the final `userPreference.upsert` (both create and update
  branches)

**Hooks:**
- `hooks/useOnboardingState.ts` — Added `draft` field to `OnboardingState`;
  added `saveDraft`, `clearDraft`, `readLocalDraft` methods; added
  `shouldShowResumeBanner` computed property; strict `shouldShowWelcome`
  contract (removed tour gating, added `onboardingCompleted` short-circuit,
  added draft priority); user-scoped `localStorage` fallback for drafts.

**Components:**
- `components/onboarding/wizard/WizardContainer.tsx` — New props
  `initialStepIndex`, `onAutoSave`; debounced autosave effect; removed
  unused `WizardStepId` import
- `components/onboarding/OnboardingWelcomeModal.tsx` — Full redesign
  (aurora hero, sparkles, value-prop grid, gradient CTA, strict dismiss
  contract, ARIA + reduced-motion support, body-scroll lock, Escape key)
- `components/onboarding/OnboardingResumeBanner.tsx` — New component,
  design-matched to welcome modal
- `components/onboarding/index.ts` — Export `OnboardingResumeBanner`
- `components/DashboardLayout.tsx` — Destructure new hook methods;
  compute `hydratedDraft` + `hydratedStepIndex`; add
  `handleWizardAutoSave`, `handleResumeBannerResume`,
  `handleResumeBannerStartOver`, `handleResumeBannerDismiss`;
  `handleSkipOnboarding` is now close-only (no server write);
  `handleWizardComplete` also calls `clearDraft()`; render
  `OnboardingResumeBanner` in the `/dashboard` main area

**Styles:**
- `styles/wizard-animations.css` — Appended ~160 lines of premium welcome
  modal keyframes and utility classes

### Files Deleted (Dead Code Sweep)

- `components/onboarding/shared/CurrencyInput.tsx`
- `components/onboarding/shared/FrequencySelect.tsx`
- `components/onboarding/shared/SectionSummary.tsx`
- `components/onboarding/shared/StatCard.tsx`
- `components/onboarding/shared/index.ts`
- `components/onboarding/shared/` (directory)

### Files Created

- `components/onboarding/OnboardingResumeBanner.tsx`
- `docs/changelog/CHANGELOG_2026_04_12_ONBOARDING_DRAFT_PERSISTENCE.md` (this file)

### Database Migration Required

```sql
-- PR 2 draft persistence (2026-04-12)
ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "onboardingDraft" JSONB;
```

Or equivalently:

```bash
npx prisma db push
```

Existing rows backfill to `NULL` — the column is nullable and only
populated once a user hits the wizard. No data migration needed.

### Testing Notes (manual, post-deploy)

1. **First-time experience**:
   - Register a fresh user → navigate to `/dashboard`
   - Verify welcome modal appears with the new aurora hero
   - Verify sparkles float, time chip pulses, value props stagger in
   - Click "Not right now" (checkbox unchecked) → modal closes, sessionless
   - Log out and back in → welcome modal should reappear ✓

2. **Explicit opt-out**:
   - On welcome modal, tick "Don't show this again" → click "Not right now"
   - Log out and back in → welcome modal should NOT appear ✓
   - Confirm `UserPreference.dismissedWelcomeModal = true` in DB

3. **Draft autosave + resume**:
   - Click "Start guided setup"
   - In the wizard, select a profile and advance to step 2
   - Enter a few fields and wait ~2 seconds
   - Close the wizard with X
   - Refresh the dashboard → resume banner should appear with correct
     "Step X of Y" label and percent progress
   - Verify `UserPreference.onboardingDraft` contains JSON with the
     entered data
   - Click "Resume" on the banner → wizard reopens with all fields
     pre-populated
   - Complete the wizard → verify `onboardingDraft = NULL` in DB
   - Log out and back in → neither welcome modal nor banner should appear ✓

4. **Start over**:
   - Create a draft as in (3) then click "Start over" on the banner
   - Verify `onboardingDraft = NULL` and `onboardingStep = 0`
   - Banner should disappear

5. **Reduced motion**:
   - Enable `prefers-reduced-motion` in OS / DevTools
   - Open welcome modal → aurora should be static, sparkles visible but
     not animating, value props visible immediately (no stagger)

6. **Dark mode**:
   - Toggle dark theme → verify welcome modal hero, card, and all buttons
     render correctly

7. **Accessibility**:
   - Keyboard-only: Tab through welcome modal, press Escape to close
   - Screen reader: verify `aria-modal`, `aria-labelledby`,
     `aria-describedby` are announced
   - Backdrop click closes (respecting the checkbox)

### Build Status

- [ ] TypeScript compilation — cannot verify locally (no `node_modules`
      in sandbox). CI will gate the merge.
- [ ] `npm run build` — same; relying on CI.
- [ ] Lint — same; relying on CI.

### Not in This PR (coming in PR 3)

- Full step-by-step wizard redesign (same premium treatment applied to
  every step)
- Radical simplification of the flow (5 mandatory + 3 conditional, down
  from 8 always-on)
- `/app/onboarding` dedicated route (deep-linkable)
- Auto-infer profile type from answers (removes explicit picker)
- Renter path (Own / Rent / Both on Welcome → rent as Expense)
- Non-property loan entry (CAR / PERSONAL / STUDENT / LOC)
- `SuperannuationAccount` routing (currently misrouted to
  InvestmentAccount)
- Basiq "Connect bank" shortcut on the Accounts step
- Household lifestyle fields (`lifestylePreference`, `diningOutFrequency`,
  `hobbiesWithCosts`) for Phase 28 budget AI
