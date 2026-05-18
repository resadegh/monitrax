# Changelog — 2026-04-12

## Session: claude/review-monitrax-docs-ty15A (PR 3a — Wizard Visual Overhaul + Simplification)

### Changes Made

- **Type**: Design / Refactor (visual)
- **Scope**: Onboarding wizard — all 8 step files, shell, new route, primitives library, design tokens
- **Motivation**: The third of three PRs in the Phase 12 remediation pipeline. PR 1 fixed correctness bugs; PR 2 added draft persistence and redesigned the welcome modal; **PR 3a makes the full wizard experience feel like a best-in-class product** while keeping every data capture path exactly as it was.

### Ground rules respected

- **No new data fields.** Every field that existed before PR 3a still exists. Every field that didn't exist still doesn't. Structural additions (renter path, non-property loans, super routing, Basiq shortcut, lifestyle fields) ship in **PR 3b**.
- **No schema changes.**
- **No API changes.**
- **Draft persistence from PR 2 unchanged.**
- **Strict show-once / never-again contract from PR 2 unchanged.**
- **`DashboardLayout` modal behaviour unchanged** — the new `WizardContainer.mode='modal'` default is a no-op for existing callers.
- **Decisions documented in the plan doc before any code was written** — see `docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md`.

### What shipped

#### Foundation (commit `33f9d41`)

- **`styles/wizard-animations.css` +~330 LOC of PR 3a design tokens:**
  `.wz-step-shell`, `.wz-section`, `.wz-field`, `.wz-input`,
  `.wz-input-currency-wrap`, `.wz-input-percent-wrap`, `.wz-segmented`,
  `.wz-segmented-option`, `.wz-btn-primary` (with animated gradient
  shift on hover), `.wz-btn-ghost`, `.wz-btn-add` (dashed border
  "+ Add another"), `.wz-chip` (blue/green/amber variants),
  `.wz-page-root`, `.wz-page-shell`, `.wz-page-card`, `.wz-stagger`
  helper for child staggered entry, and `prefers-reduced-motion`
  overrides for every new animation.
- **New primitives library** at `components/onboarding/wizard/primitives/`:
  - `WizardStepShell.tsx` — outer step wrapper with icon + title
    (`React.ReactNode` so steps can use inline gradient clip-text) +
    subtitle header, spacing rhythm.
  - `WizardSection.tsx` — labeled content card with icon, title,
    description, optional trailing action slot.
  - `WizardField.tsx` — 4 variants: `WizardField` (generic),
    `WizardCurrencyField` ($ prefix), `WizardPercentField` (% suffix),
    `WizardSelectField` (styled select).
  - `WizardButton.tsx` — `WizardPrimaryButton` / `WizardGhostButton` /
    `WizardAddButton`.
  - `WizardSegmentedControl.tsx` — multi-choice pill selector as an
    ARIA `radiogroup`.
  - `WizardChip.tsx` — small status pill.
  - `index.ts` — barrel export.
- **`components/onboarding/wizard/WizardContainer.tsx`** rewritten:
  - New `mode: 'page' | 'modal'` prop (default `'modal'` preserves
    exact PR 2 behaviour).
  - `'page'` mode wraps content in `.wz-page-root` + `.wz-page-shell`
    + `.wz-page-card`.
  - New shell: gradient rocket mark in the header, gradient
    progress-bar fill on the active step with `scale-110` pulse,
    emerald gradient on completed steps, primitives-based Back/Continue
    buttons in the footer, body-scroll lock modal-only, Escape closes
    modal-only.
- **New route `app/onboarding/page.tsx`**:
  - Deep-linkable full-page onboarding (marketing emails,
    post-signup redirects, resume-banner alternative).
  - Auth gate: `!user && !token` → `/signin?next=/onboarding`.
  - Completion gate: `state.onboardingCompleted` → `/dashboard`
    short-circuit.
  - Hydrates server-side draft + step index via `useOnboardingState`.
  - Same handler pattern as `DashboardLayout` modal.
  - On final submit: `bulk-create` → `completeOnboarding` → `clearDraft` → redirect to `/dashboard`.
  - No layout.tsx needed — inherits AuthProvider / ThemeProvider from root.

#### Step redesigns batch 1 (commit `d13cc1e`)

- **`WelcomeStep.tsx`** — **Profile auto-inference**. Replaces the 4-card explicit picker with 2 `WizardSegmentedControl` questions (`ownsProperty` + `hasInvestments`) that derive `profileType` automatically. Reverse-infers from hydrated drafts. Country + tax year only revealed after both answers given. Gradient clip-text on "Monitrax". Dynamic time chip.
- **`HouseholdStep.tsx`** — cleaner member / pet cards, `WizardSegmentedControl` for the vehicle count picker (one click instead of a select), inline empty states with dashed borders.
- **`PropertiesStep.tsx`** — **Simplification**. Name + current value required up front; purchase price / date moved behind an "Advanced details" disclosure. Live equity preview as the user types. Loan section collapses when `hasLoan` is unticked. Rental income only appears for INVESTMENT type. 3-tile bottom summary.
- **`AccountsStep.tsx`** — quick-add tile grid on empty state (4 type options), compact account cards, offset → loan linking only surfaces for type=OFFSET. 3-tile summary (cash / credit debt / net).
- **`InvestmentsStep.tsx`** — expandable cards with live value in header. Inline 12-col holdings grid (ticker / units / avg price / type / delete). 3-tile summary.

#### Step redesigns batch 2 (this commit)

- **`AssetsStep.tsx`** — expandable cards. Vehicle-specific fields (make / model / year) appear inline only for `type=VEHICLE`. Depreciation preview with colour-coded percentage chip (`purchasePrice - currentValue`). Running costs reuse the 12-col grid pattern.
- **`IncomeExpensesStep.tsx`** — cleaner tab switcher with live counts, inline annualised preview on every row, bottom cashflow summary showing annual income / expenses / surplus + per-month equivalent.
- **`ReviewStep.tsx`** — hero net-worth card with gradient background + ambient blur glow, 3-tile metrics row (income / outgoings / monthly cashflow), "What you've added" section listing per-entity counts, "What you'll unlock" panel listing capabilities, confetti preserved.

### Files Modified

**Shell + foundation:**
- `components/onboarding/wizard/WizardContainer.tsx` — new `mode` prop, new shell
- `styles/wizard-animations.css` — PR 3a design tokens
- `app/onboarding/page.tsx` (new) — dedicated full-page route

**New primitives library (7 new files):**
- `components/onboarding/wizard/primitives/WizardStepShell.tsx`
- `components/onboarding/wizard/primitives/WizardSection.tsx`
- `components/onboarding/wizard/primitives/WizardField.tsx`
- `components/onboarding/wizard/primitives/WizardButton.tsx`
- `components/onboarding/wizard/primitives/WizardSegmentedControl.tsx`
- `components/onboarding/wizard/primitives/WizardChip.tsx`
- `components/onboarding/wizard/primitives/index.ts`

**All 8 step files:**
- `components/onboarding/wizard/steps/WelcomeStep.tsx` (+ profile auto-infer)
- `components/onboarding/wizard/steps/HouseholdStep.tsx`
- `components/onboarding/wizard/steps/PropertiesStep.tsx` (+ simplification)
- `components/onboarding/wizard/steps/AccountsStep.tsx`
- `components/onboarding/wizard/steps/InvestmentsStep.tsx`
- `components/onboarding/wizard/steps/AssetsStep.tsx`
- `components/onboarding/wizard/steps/IncomeExpensesStep.tsx`
- `components/onboarding/wizard/steps/ReviewStep.tsx`

**Docs:**
- `docs/blueprint/PHASE_12_ONBOARDING_TOUR.md` → v2.3 (new §16 documenting PR 3a)
- `docs/blueprint/MASTER_BLUEPRINT.md` → v2.6
- `docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md` — progress log updated, task checklist ticked
- `docs/changelog/CONSOLIDATED_CHANGELOG.md`
- `docs/changelog/CHANGELOG_2026_04_12_WIZARD_VISUAL_OVERHAUL.md` (this file)

### Not in This PR

- **PR 3b — Structural additions** (pending):
  - Renter path (rent as `Expense(category=RENT)`)
  - Non-property loans (CAR / STUDENT / PERSONAL / BUSINESS) — new conditional "Debts" step
  - `SuperannuationAccount` routing
  - Basiq "Connect your bank" shortcut (3-tier data source picker)
  - File import as Tier 2 (reuses existing `components/bank/ImportWizard.tsx`)
  - Household lifestyle fields (`lifestylePreference`, `diningOutFrequency`, `hobbiesWithCosts`)
- **PR 3c — Data source hygiene** (planned):
  - Staleness indicators on every Account balance display
  - Dashboard staleness nudge for manual accounts > 14 days old
  - Confidence indicators on derived metrics
  - Settings > Accounts "Upgrade this account" button
  - Existing-user migration modal
  - App-wide `balanceLastUpdatedAt` enforcement audit
  - Balance age heat-map in Settings > Data Health

### Build Status

- [ ] TypeScript compilation — cannot verify locally (no `node_modules` in sandbox). CI gates the merge.
- [ ] `npm run build` — same; relying on CI.
- [ ] Lint — same; relying on CI.

### Testing Notes (manual, post-deploy)

1. **Page mode on fresh signup**:
   - Register a new user, then navigate directly to `/onboarding` (simulating an email CTA).
   - Verify the new full-page card layout renders with the aurora background.
   - Confirm the shell header shows the gradient rocket mark and the progress bar uses gradient fills.

2. **Modal mode backwards compatibility**:
   - Trigger the wizard from `/dashboard` (existing PR 2 flow).
   - Verify it still opens as a modal, still has the X close button, still supports Escape to close, still locks body scroll.
   - Verify the PR 2 "show once / never again" contract is unchanged.

3. **Welcome step auto-inference**:
   - Answer "Yes" to "Do you own any property?" and "No" to "Do you have investments?". Verify the profile infers to HOMEOWNER (the wizard shows the Properties step but not Investments or Assets).
   - Answer "No" / "Yes" → verify INVESTOR profile (Investments step shown, Properties hidden).
   - Answer "Yes" / "Yes" → verify MIXED (all steps including Assets).
   - Answer "No" / "No" → verify STARTER (just the essentials).
   - Close wizard mid-way, re-open → verify the two answers are still highlighted (reverse inference from the persisted `profileType`).

4. **Properties step simplification**:
   - Add a property with just name + current value. The "Advanced details" disclosure should be collapsed.
   - Verify that leaving purchase date blank and clicking Continue lets the user proceed (the validation is at submission time, not per-step — matches PR 1 behaviour).
   - Expand Advanced details, enter a purchase date, collapse again — state persists.
   - Add a loan, type the principal and watch the live equity preview appear.

5. **Review step**:
   - Reach the Review step with some data. Confetti fires on first render.
   - Verify the net-worth hero uses gradient clip-text when positive.
   - Verify the "What you've added" section only shows entity types with count > 0.

6. **Reduced motion**:
   - Enable `prefers-reduced-motion` in OS / DevTools.
   - Verify every step renders without keyframe animations (aurora static, stagger disabled, button gradient shift off).

7. **Dark mode**:
   - Toggle dark theme. Every step renders correctly — fields, buttons, chips, gradient accents, summary tiles.

8. **Accessibility**:
   - Keyboard navigation through every step: Tab through fields, Enter on buttons, Escape closes (modal mode only).
   - `WizardSegmentedControl` is announced as a radiogroup.
   - `WizardStepShell` titles are proper `<h2>`s.
   - Screen reader announces the step description in the progress bar.

9. **Mobile**:
   - Test on ≥ 375px wide viewport (iPhone SE size). All 2-column grids should stack; header chip wraps; footer buttons still fit.
