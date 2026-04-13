# Phase 12 — Wizard Redesign Plan (PR 3a / PR 3b)

> **Living document.** Updated continuously as decisions are made and work
> progresses. Treat this as the single source of truth for PR 3a and PR 3b.
> If anything here doesn't match reality, fix the doc first, then the code.

**Owner:** Claude (engineer) | **Reviewer:** Reza
**Status:** 🟢 PR 3a implementation in progress (decisions locked, building)
**Branch:** `claude/review-monitrax-docs-ty15A`
**Related docs:**
- `docs/blueprint/PHASE_12_ONBOARDING_TOUR.md` (canonical spec, v2.2)
- `docs/changelog/CHANGELOG_2026_04_12_ONBOARDING_CORRECTNESS.md` (PR 1)
- `docs/changelog/CHANGELOG_2026_04_12_ONBOARDING_DRAFT_PERSISTENCE.md` (PR 2)

---

## 1. Purpose

PR 1 fixed correctness bugs. PR 2 shipped draft persistence and redesigned
the welcome modal + resume banner. PR 3 is the **full wizard experience
redesign** — every step, every interaction, every data flow.

We're splitting PR 3 into two atomically-reviewable PRs:

- **PR 3a — Visual overhaul + simplification** of existing steps.
  No new fields, no new routes, no new data paths. Purely: make every
  step look and feel like it was designed by one team on the same day.
- **PR 3b — Structural additions**: renter path, non-property loans,
  proper `SuperannuationAccount` routing, Basiq shortcut, household
  lifestyle fields. Introduces new data flows and capture paths.

This split lets us ship the visual win fast (PR 3a) and land the more
invasive structural changes separately (PR 3b) with independent review.

---

## 2. Ground Rules (Non-Negotiable)

Per CLAUDE.md:
- **Read before writing.** Always read files before editing.
- **No dead code.** Delete what we don't use. Don't comment it out.
- **No duplicate logic.** Canonical utilities only (`lib/utils/frequencies.ts`,
  `lib/utils/formatters.ts`, etc.).
- **No business logic in components or route handlers.** Use
  `lib/services/*` or `lib/calculations/*`.
- **Atomic commits.** Each PR is one logical change. PR 3a and PR 3b ship
  separately.
- **Document every change.** This plan + Phase 12 blueprint + changelog.
- **No TypeScript `any`.** Match the Prisma schema exactly.
- **`prefers-reduced-motion`** honoured on every new animation.
- **Dark mode** native on every new component.
- **ARIA + keyboard navigation** on every interactive element.

---

## 3. Decisions Locked In

Captured from the planning Q&A on 2026-04-12:

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Execute all three PRs? | **Yes** | — |
| 2 | Keep Household step in wizard? | **Yes** | Phase 28/29 budget AI depends on it |
| 3 | How to handle renters? | **Model rent as an Expense, not a Property** | Avoids polluting the Properties module with half-populated rows. An "Own / Rent / Both" question on Welcome gates the Properties step. Rent rows land in the Expenses step with `category=RENT`, `sourceType=GENERAL`. Users can later opt in to tracking a rented residence as a `Property(type=RENTAL)` from the main app if they want. |
| 4 | Keep Super in the wizard? | **Yes — with proper routing** | Create real `SuperannuationAccount` rows, not `InvestmentAccount(type=SUPERS)` |
| 5 | Wire up Basiq "Connect bank" shortcut? | **Yes** | Phase 24 is already live; Accounts step becomes ~30s instead of ~3 min |
| 6 | Explicit vs auto-inferred profile type? | **Auto-infer** | From answers on Welcome step. Removes the up-front 4-card picker. |
| 7 | Draft persistence mechanism? | **`UserPreference.onboardingDraft JSONB`** — shipped in PR 2 | Simpler than per-entity incremental creates; keeps atomic bulk-create |
| 8 | PR 3 scope | **Split into 3a (visual + simplify) and 3b (new paths)** | Each PR is independently reviewable and shippable |
| 9 | Plan document | **This file** — updated constantly | No assumptions; all scope changes captured here first |
| **A** | **Super fields for the wizard** | **`name` + `fundName` + `currentBalance` only** — defer everything else (memberNumber, fundABN, tax components, contribution YTD, caps, investment option, returns) to a future Settings > Retirement page | Net worth only needs `currentBalance`. Fund name is free text and easy. All other fields require a super statement that users typically don't have on hand during signup — blocking onboarding on them would hurt completion. Phase 20 (Tax Intelligence Engine) reads the deeper fields but runs post-onboarding; users will have a reason to fill them in after first-run value. The schema has sensible defaults for contribution caps (`$27,500` / `$110,000`) so no need to ask. |
| **B** | **Basiq shortcut UX on the Accounts step** | **Parallel path with seamless fallback.** Prominent primary CTA "Connect your bank (recommended)" kicks off Basiq consent. Manual entry always available below (`— or add accounts manually —`). Post-redirect: new `/app/onboarding/basiq-callback` route polls for ACTIVE connection, fetches imported accounts, marks them as `isBasiqImported: true` in the wizard draft. User can review/rename/flag-as-offset before proceeding. On final submit, `bulk-create` skips imported accounts (they already exist in DB from Basiq sync) and only creates manually-entered ones. | Many users bank at multiple institutions — forcing Basiq-or-nothing is bad UX. Users may not want to share credit card data via Basiq while still wanting it tracked. The review step is where Monitrax's edge shows (renaming, offset linking). CDR compliance (CLAUDE.md §13): draft never holds CDR data — only pointers to existing `Account` rows by ID. |
| **C** | **Non-property loans: dedicated step or Accounts sub-section?** | **Dedicated "Debts" step, shown conditionally.** Welcome step asks a single checkbox question ("Do you have any of these? HECS, car loan, credit card, personal loan"). If anything ticked → Debts step shown. Captures `CAR`, `STUDENT`, `PERSONAL`, `BUSINESS` loans. `CREDIT_CARD` **stays in Accounts step** (existing behaviour, stored as negative balance). `LINE_OF_CREDIT` modelled as CREDIT_CARD-style Account for PR 3b simplicity (full LOC-as-Loan modelling deferred). CAR loans get `linkedAssetId` wired in bulk-create, same pattern as the property-loan offset linking that already works. | `Account` and `Loan` are separate Prisma models — mixing them in one step muddles the model and breaks the Review screen's mental grouping. STUDENT (HECS-HELP) is near-universal for Australian users under 40 — not capturing it undersells Monitrax on first run. Conditional visibility keeps the STARTER flow clean (typical STARTER users don't have these). |
| **D** | **Lifestyle fields: own step or Household step?** | **Add to existing Household step** as a 4th section titled "Your lifestyle". Three fields: `lifestylePreference` (segmented control, 3 options), `diningOutFrequency` (segmented control, 4 options), `hobbiesWithCosts` (optional free text). Inline helper: "We use this to personalize your budget estimates." | Conceptually grouped: "who's in your household and how do you live". The Household step is currently under-populated (<60 seconds) so adding a 4th short section barely lengthens it. Phase 28 budget AI reads all these fields at once. Avoids step inflation (PR 3b is already adding a conditional Debts step). |
| **E** | **Dedicated `/app/onboarding` route: PR 3a or PR 3b?** | **PR 3a**, with a new `mode: 'page' \| 'modal'` prop on `WizardContainer`. `'modal'` keeps the existing dashboard behaviour exactly as it is. `'page'` uses the full-width layout. A new `/app/onboarding/page.tsx` mounts `WizardContainer` in page mode. Unauth users redirect to `/signin?next=/onboarding`. | Deep-linkability for marketing emails. The new full-page shell design works better with more room to breathe. Backwards-compatible — nothing changes for users coming from the dashboard modal. Small incremental change, large user-value unlock (email CTAs, marketing flows). |

---

## 4. Pending / Open Questions

All PR 3a / PR 3b blocking questions have been answered and locked into
§3. This section is kept for future assumption-tracking as new questions
arise during implementation.

*No currently open questions — 2026-04-12*

---

## 5. PR 3a Scope — Visual Overhaul + Simplification

**Goal:** Make the existing 8-step wizard feel premium, cohesive, and
less overwhelming. **No new data flows.** Every field that exists today
still exists. Every step that exists today still exists. The change is
purely about how they look and feel, and about which fields are required
vs optional.

### 5.1 In Scope (PR 3a)

| Area | Change | File(s) |
|---|---|---|
| **Route** | New `/app/onboarding/page.tsx` — dedicated full-page onboarding. Wizard modal on `/dashboard` still works (backwards compatible). | `app/onboarding/page.tsx` (new), `app/onboarding/layout.tsx` (new), `components/DashboardLayout.tsx` |
| **Shell** | Redesign `WizardContainer` header, progress bar, footer nav to match welcome-modal design language | `components/onboarding/wizard/WizardContainer.tsx` |
| **Welcome step** | Redesign to match welcome-modal aurora hero; replace explicit profile picker with **2 questions** (homeowner/renter/both + has-investments) that auto-infer `profileType`; keep country + tax year | `components/onboarding/wizard/steps/WelcomeStep.tsx` |
| **Household step** | Visual polish; cleaner member/pet cards; keep existing fields | `components/onboarding/wizard/steps/HouseholdStep.tsx` |
| **Properties step** | Visual polish; reduce mandatory fields to name + current value + purchase date; loan section collapses by default; rental income only for `INVESTMENT` type (already works) | `components/onboarding/wizard/steps/PropertiesStep.tsx` |
| **Accounts step** | Visual polish; quick-add cards redesigned | `components/onboarding/wizard/steps/AccountsStep.tsx` |
| **Investments step** | Visual polish; holdings table cleanup | `components/onboarding/wizard/steps/InvestmentsStep.tsx` |
| **Assets step** | Visual polish; vehicle fields cleanup | `components/onboarding/wizard/steps/AssetsStep.tsx` |
| **Income & Expenses step** | Visual polish; tab switcher redesign; summary card | `components/onboarding/wizard/steps/IncomeExpensesStep.tsx` |
| **Review step** | Visual polish; stat card redesign; keep confetti | `components/onboarding/wizard/steps/ReviewStep.tsx` |
| **Simplification** | Reduce mandatory fields across the board. Every field that the user's blueprint calls "approximate is fine" stays, but we push non-essential fields behind an "Advanced" disclosure. | All step files |
| **Shared primitives** | New reusable `WizardField`, `WizardSection`, `WizardGhostButton` components for design consistency | `components/onboarding/wizard/primitives/*` (new) |
| **CSS** | Extend `styles/wizard-animations.css` with new gradient/layout helpers | `styles/wizard-animations.css` |
| **Documentation** | Update Phase 12 blueprint (§12 redesign section); update this plan | Various |

### 5.2 Explicitly OUT of Scope for PR 3a

Deferred to PR 3b (see §6 below):

- ❌ Renter path (rent as `Expense(category=RENT)`)
- ❌ Non-property loan capture (CAR / PERSONAL / STUDENT / LOC)
- ❌ Proper `SuperannuationAccount` routing
- ❌ Basiq "Connect bank" shortcut
- ❌ Household lifestyle fields (`lifestylePreference`, `diningOutFrequency`, `hobbiesWithCosts`)
- ❌ Any schema changes
- ❌ Any new API endpoints

**Why:** PR 3a should be reviewable as a pure UX/visual change with no
behavioural drift. If a field wasn't captured before PR 3a, it still isn't
captured after PR 3a.

### 5.3 Design Tokens (PR 3a)

Codifying the design language from the welcome modal so every step uses
the same palette, spacing, and motion.

**Colour palette** (extends Tailwind defaults):
- Primary gradient: `from-blue-500 via-indigo-500 to-violet-500`
- Success gradient: `from-emerald-500 to-teal-500`
- Warning gradient: `from-amber-500 to-orange-500`
- Danger gradient: `from-rose-500 to-red-500`
- Card surface (light): `bg-white/95 backdrop-blur-xl`
- Card surface (dark): `bg-slate-900/95 backdrop-blur-xl`
- Accent border (light): `border-slate-200/70`
- Accent border (dark): `border-slate-700/50`

**Typography:**
- Headings: `font-semibold tracking-tight` with `letter-spacing: -0.02em`
  on h1/h2
- Gradient clip-text on accent words only (hero headlines)
- Body: `text-slate-600 dark:text-slate-400`
- Labels: `text-xs font-medium text-slate-500 dark:text-slate-400`

**Spacing rhythm:**
- Modal/page padding: `p-6` to `p-8`
- Card gap: `gap-4` (24px) between top-level sections
- Micro gap: `gap-2` (8px) between related elements
- Section top padding after divider: `pt-5`

**Motion:**
- Entry: `cubic-bezier(0.22, 1, 0.36, 1)` (same as welcome modal)
- Hover lift: `translateY(-1px)` with `transition: all 0.2s ease`
- Staggered entry delay: `calc(var(--index) * 0.08s)`
- All animations respect `prefers-reduced-motion`

**Radii:**
- Primary container: `rounded-3xl` (24px)
- Cards: `rounded-2xl` (16px)
- Buttons: `rounded-xl` (12px)
- Chips: `rounded-full`
- Icon containers: `rounded-lg` (8px) or `rounded-xl`

**Shadows:**
- Primary CTA: `0 10px 30px -10px rgba(99, 102, 241, 0.55)`
- Card hover: `0 12px 40px -12px rgba(0, 0, 0, 0.15)` light / `0 12px 40px -12px rgba(0, 0, 0, 0.5)` dark
- Hero glow: `0 30px 80px -20px rgba(15, 23, 42, 0.45)`

### 5.4 Simplification Guidelines (PR 3a)

For every step, apply this audit:

1. Is this field **required to render a useful dashboard**? → Keep as primary field.
2. Is this field **useful for a downstream engine** (snapshot, cashflow, insights)? → Keep as primary field.
3. Is this field **tax-related** and only matters at EOFY? → Push behind "Advanced" disclosure.
4. Is this field **cosmetic** (notes, tenant name, serial number)? → Push behind "Advanced" disclosure or drop entirely for onboarding.
5. Does the user need this **on first run**, or can they add it later from the entity detail page? → Defer to post-onboarding.

Target state after PR 3a: **a new user with zero context can complete a
STARTER flow in under 3 minutes and a MIXED flow in under 8 minutes.**

### 5.5 PR 3a Task Checklist

> Updated continuously as work progresses.

**Setup:**
- [x] Create `components/onboarding/wizard/primitives/WizardField.tsx` *(includes Currency/Percent/Select variants)*
- [x] Create `components/onboarding/wizard/primitives/WizardSection.tsx`
- [x] Create `components/onboarding/wizard/primitives/WizardButton.tsx` *(Primary + Ghost + Add)*
- [x] Create `components/onboarding/wizard/primitives/WizardStepShell.tsx`
- [x] Create `components/onboarding/wizard/primitives/WizardSegmentedControl.tsx`
- [x] Create `components/onboarding/wizard/primitives/WizardChip.tsx`
- [x] Create `components/onboarding/wizard/primitives/index.ts`
- [x] Extend `styles/wizard-animations.css` with PR 3a additions *(~330 LOC of design tokens)*

**Route:**
- [x] Create `app/onboarding/page.tsx` (mounts `WizardContainer` in page mode)
- [ ] *Layout file not required — inherits from root `app/layout.tsx`*
- [x] Add `mode: 'page' | 'modal'` prop to `WizardContainer` (modal = existing behaviour)

**Shell redesign:**
- [x] `WizardContainer` header — new gradient rocket mark, new close button, new step description
- [x] `WizardContainer` progress bar — gradient fill, numbered steps, emerald gradient on completed, accessible labels
- [x] `WizardContainer` footer nav — primary/ghost buttons from primitives
- [ ] AI helper button — reskin to match design language *(deferred to a later batch — AI helper is stable and not blocking step redesigns)*

**Step redesigns (each gets its own commit within PR 3a):**
- [ ] `WelcomeStep` — aurora header + 2-question profile inference + country/tax
- [ ] `HouseholdStep` — cleaner member/pet cards, inline empty states
- [ ] `PropertiesStep` — collapsible loan section, reduced mandatory fields, inline equity preview
- [ ] `AccountsStep` — redesigned quick-add, offset linking cleanup
- [ ] `InvestmentsStep` — holdings table cleanup, better empty state
- [ ] `AssetsStep` — vehicle fields inline, cleaner expense entry
- [ ] `IncomeExpensesStep` — tab switcher redesign, live annualized preview
- [ ] `ReviewStep` — stat card redesign, "what you'll unlock" section

**Cross-cutting:**
- [ ] Per-step accessibility audit (ARIA, keyboard, focus trap)
- [ ] Per-step `prefers-reduced-motion` audit
- [ ] Per-step dark mode audit
- [ ] Mobile responsive audit (≥ 375px)
- [ ] Dead-code sweep after all refactors

**Documentation:**
- [ ] Update `PHASE_12_ONBOARDING_TOUR.md` with PR 3a details (new §16)
- [ ] New changelog: `CHANGELOG_2026_04_12_WIZARD_VISUAL_OVERHAUL.md`
- [ ] Update this plan document's §5.5 checklist continuously
- [ ] Update `CONSOLIDATED_CHANGELOG.md` entry
- [ ] Update `MASTER_BLUEPRINT.md` version to v2.6

**Commit + push:**
- [ ] Single atomic commit for PR 3a on `claude/review-monitrax-docs-ty15A`

---

## 6. PR 3b Scope — Structural Additions

**Goal:** Close the data-model gaps identified in the original review.
Each item adds a new capture path to the wizard.

**Dependency:** PR 3a must be merged first — PR 3b builds on the new
primitives and design language.

### 6.1 In Scope (PR 3b)

| # | Change | Files affected | Schema change? |
|---|---|---|---|
| 1 | **Renter path**: "Own / Rent / Both" on Welcome; if rent, auto-seed an `Expense(category=RENT, sourceType=GENERAL)` on the Expenses step. | `WelcomeStep`, `IncomeExpensesStep`, `bulk-create` | No |
| 2 | **Non-property loans**: new "Debts & Loans" section on the Accounts step (or new dedicated step TBD — see Q-C) for CAR / PERSONAL / STUDENT / LOC. | `AccountsStep` or new `DebtsStep`, `bulk-create`, wizard `types.ts` | No (existing `Loan` model supports all types) |
| 3 | **Real `SuperannuationAccount` routing**: if user adds a super account, create a `SuperannuationAccount` row, not `InvestmentAccount(type=SUPERS)`. | `InvestmentsStep` (sub-section) or new `SuperStep`, `bulk-create`, wizard `types.ts` | No |
| 4 | **Basiq "Connect bank" shortcut**: one-click path on Accounts step that initiates the Basiq consent flow instead of manual entry. | `AccountsStep`, new `useBasiqOnboarding` hook | No |
| 5 | **Household lifestyle fields**: add `lifestylePreference`, `diningOutFrequency`, `hobbiesWithCosts` to the Household step for Phase 28 budget AI. | `HouseholdStep`, `bulk-create`, wizard `types.ts` | No (fields already exist on `HouseholdProfile`) |

### 6.2 Out of Scope (PR 3b)

- Any visual redesign — that's PR 3a's job
- New data models (everything uses existing Prisma schema)
- Phase 24B (advanced Basiq) features — only the consent kickoff from the wizard
- Full super contributions entry — just the account skeleton in the wizard; deeper fields live in Settings

### 6.3 PR 3b Task Checklist

> Detailed breakdown based on answered questions in §3. Updated as work progresses.

**Renter path (question 3):**
- [ ] Add a "Do you own property, rent, or both?" question to `WelcomeStep` (renders as 3 cards: Own / Rent / Both)
- [ ] If Rent or Both: seed an empty `Expense(category=RENT, sourceType=GENERAL)` row on the `IncomeExpensesStep` with placeholder copy
- [ ] If Rent only (not Both): hide the Properties step entirely from the profile-filtered step list
- [ ] Add to `WizardData.housing: 'OWN' | 'RENT' | 'BOTH' | null`
- [ ] No schema / API changes (`RENT` is already an `ExpenseCategory`)

**Non-property loans (question C):**
- [ ] Add a "Do you have any of these debts?" checkbox list to `WelcomeStep` (HECS / car loan / personal loan — credit cards excluded, they stay in Accounts)
- [ ] New `DebtsStep` component with conditional visibility based on the checkbox answers
- [ ] Support loan types: `CAR`, `STUDENT`, `PERSONAL`, `BUSINESS` (HOME/INVESTMENT stay under Properties)
- [ ] CAR loan can link to an `Asset` (vehicle) via `Loan.linkedAssetId` — handled in `bulk-create` like property-loan offset linking
- [ ] STUDENT (HECS) gets a dedicated mini-UX: "Current outstanding balance" + "Indexation rate (default 4%)"
- [ ] PERSONAL/BUSINESS get the full loan mini-form (name, principal, rate, min repayment, frequency)
- [ ] Add `WizardData.debts: LoanInput[]` type; corresponding `bulk-create` loop that writes `Loan` rows with the right `type`
- [ ] `LINE_OF_CREDIT` handling: keep it in Accounts step as a CREDIT_CARD-variant for PR 3b simplicity — document the limitation in the Phase 12 blueprint for future PR
- [ ] Unit test: bulk-create with one of each loan type
- [ ] Update Review step to surface total non-property debt separately

**Super routing (question A + 4):**
- [ ] New `SuperStep` component (or sub-section of InvestmentsStep — finalised during PR 3b design pass)
- [ ] Capture exactly three fields: `name`, `fundName`, `currentBalance`
- [ ] Add `WizardData.super: SuperannuationAccountInput[]` type
- [ ] `bulk-create` creates real `SuperannuationAccount` rows (not `InvestmentAccount(type=SUPERS)`)
- [ ] `InvestmentsStep` drops the `SUPERS` option from `InvestmentAccountType` when rendered in the wizard context (schema keeps it for backwards compat with pre-PR 3b data)
- [ ] Review step: net worth calc includes `SuperannuationAccount.currentBalance`
- [ ] Data migration: flag a follow-up to migrate existing `InvestmentAccount(type=SUPERS)` rows to `SuperannuationAccount` — but NOT in this PR (would be a standalone data-migration PR after PR 3b ships)

**Basiq shortcut (question B + 5):**
- [ ] Add "Connect your bank (recommended)" primary CTA card at the top of `AccountsStep`
- [ ] Wire button to `POST /api/basiq/connect` → redirect to returned `consentUrl`
- [ ] Before redirect: save the current wizard draft so nothing is lost
- [ ] New `/app/onboarding/basiq-callback/page.tsx` — polls `GET /api/basiq/connections` until `ACTIVE`, then redirects back to `/app/onboarding?step=accounts&basiq=connected`
- [ ] On return: wizard reads imported accounts from the DB (they're now in `Account` with `balanceSource='BASIQ'`) and shows them as pre-filled, read-only-except-for-rename rows
- [ ] Add `AccountInput.isBasiqImported: boolean`; `bulk-create` skips imported accounts in its write loop
- [ ] Dark mode + reduced-motion for the new card
- [ ] Loading/error states for the Basiq round-trip
- [ ] CDR compliance note in the changelog (draft never holds CDR data, only DB row IDs)

**Lifestyle fields (question D):**
- [ ] Add a 4th "Your lifestyle" section to `HouseholdStep` with:
  - [ ] Segmented control for `lifestylePreference` (FRUGAL / MODERATE / COMFORTABLE) — default MODERATE
  - [ ] Segmented control for `diningOutFrequency` (NEVER / RARELY / SOMETIMES / OFTEN) — default SOMETIMES
  - [ ] Optional free-text input for `hobbiesWithCosts`
  - [ ] Helper copy: "We use this to personalize your budget estimates."
- [ ] Add `WizardData.lifestyle: { lifestylePreference, diningOutFrequency, hobbiesWithCosts }`
- [ ] `bulk-create`: extend the existing `HouseholdProfile` upsert to include the new fields (they already exist on the schema model)

**Cross-cutting:**
- [ ] `WizardData` type extensions in `components/onboarding/wizard/types.ts`
- [ ] `bulk-create/route.ts` request type extensions
- [ ] Full Prisma transaction still atomic (one big `$transaction` as today)
- [ ] Any net-worth / cashflow calcs in the Review step must include the new entities
- [ ] CLAUDE.md §12.3 compliance: no business logic in the API route — all calculations go through canonical services
- [ ] Accessibility audit on every new UI element
- [ ] Dark mode on every new UI element
- [ ] `prefers-reduced-motion` audit

**Documentation:**
- [ ] Update `PHASE_12_ONBOARDING_TOUR.md` with a new §16 (PR 3b structural additions)
- [ ] New changelog: `CHANGELOG_2026_04_12_WIZARD_STRUCTURAL_ADDITIONS.md`
- [ ] Update this plan's §6.3 checklist continuously
- [ ] Update `CONSOLIDATED_CHANGELOG.md`
- [ ] Update `MASTER_BLUEPRINT.md` version
- [ ] Add the LINE_OF_CREDIT limitation + planned data migration as follow-up items in Phase 12

**Commit + push:**
- [ ] Single atomic commit for PR 3b on `claude/review-monitrax-docs-ty15A` after PR 3a lands

---

## 7. Architectural Decisions Log

Captured as decisions are made during implementation. Most-recent first.

### 2026-04-12 (PM) — All PR 3b pending questions answered

Five questions (A-E from the original §4) were suggested by Claude and
accepted by Reza without modification:

- **A (super fields)**: Minimum viable — `name`, `fundName`,
  `currentBalance`. Deferring all deeper fields (memberNumber, tax
  components, contributions, caps, investment option) to a future
  Settings > Retirement page. The Phase 20 Tax Intelligence Engine reads
  those deeper fields but runs post-onboarding, so blocking signup on
  them is not needed.
- **B (Basiq UX)**: Parallel path. Manual entry remains available at all
  times; Basiq is the prominent "recommended" primary CTA. After the
  Basiq callback, imported accounts appear as pre-filled cards the user
  can rename or flag as offset before proceeding. `bulk-create` skips
  imported accounts (already in DB from Basiq sync) via a new
  `AccountInput.isBasiqImported` flag. Draft never holds CDR data — only
  DB row IDs as pointers (CLAUDE.md §13 compliant).
- **C (non-property loans)**: Dedicated "Debts" step shown conditionally
  based on a Welcome checkbox. Captures CAR, STUDENT, PERSONAL, BUSINESS.
  `CREDIT_CARD` stays in AccountsStep (unchanged). `LINE_OF_CREDIT`
  modelled as a CREDIT_CARD variant for PR 3b simplicity — the full
  `Loan(type=LINE_OF_CREDIT)` + `linkedAccountId` path is deferred.
- **D (lifestyle fields)**: Added as a 4th "Your lifestyle" section
  inside the existing Household step — not a separate micro-step. Three
  fields: segmented control for `lifestylePreference`, segmented control
  for `diningOutFrequency`, optional free-text `hobbiesWithCosts`. Fits
  the Household step's "who's in your household and how do you live"
  mental model and avoids step inflation.
- **E (`/app/onboarding` route)**: PR 3a, not PR 3b. New `mode: 'page'
  | 'modal'` prop on `WizardContainer`. `'modal'` preserves the existing
  dashboard modal behaviour exactly as it is. `'page'` uses a full-page
  layout. Unauth users redirect to `/signin?next=/onboarding`.

### 2026-04-12 — Initial plan written

- **PR split**: Option (b) confirmed — PR 3a (visual + simplify) then PR 3b (structural).
- **Dedicated route**: `/app/onboarding` lands in PR 3a, not PR 3b. Rationale: the new shell redesign naturally suits a full-page mode, and a modal-only wizard is a PR 3a anti-pattern we want to leave behind.
- **Renter path (decided in PR 2 Q&A)**: Rent modelled as `Expense(category=RENT)` not `Property(type=RENTAL)`. This avoids polluting the Properties module with half-populated rows and keeps the Properties step for actual owned property.
- **Profile inference (decided in PR 2 Q&A)**: Removing the 4-card profile picker. The welcome step asks 2 direct questions ("Do you own, rent, or both?" + "Do you have investments / super?") and infers `profileType` from the combination. Users can change later in Settings if needed.
- **Draft persistence (shipped in PR 2)**: `UserPreference.onboardingDraft JSONB`. Already works — PR 3a just needs to preserve compatibility.
- **Primitives**: PR 3a extracts new `WizardField`, `WizardSection`, `WizardPrimaryButton`, `WizardGhostButton`, `WizardStepShell` components so every step stops re-implementing the same markup. Lives in `components/onboarding/wizard/primitives/`.

---

## 8. Progress Log

> Dated entries, most recent first. Update after every meaningful batch of
> work (not every individual edit).

### 2026-04-12 (evening) — PR 3a foundation checkpoint committed

First PR 3a batch shipped: the shared foundation that every step depends
on.

**What landed:**

- `styles/wizard-animations.css` — ~330 new lines of PR 3a design tokens
  (`.wz-step-shell`, `.wz-section`, `.wz-field`, `.wz-input`,
  `.wz-segmented`, `.wz-btn-primary/ghost/add`, `.wz-chip`, `.wz-page-root`,
  `.wz-page-card`, `.wz-stagger`, reduced-motion overrides)
- `components/onboarding/wizard/primitives/` — 6 new files:
  - `WizardStepShell.tsx` — outer step wrapper with icon/title/subtitle header
  - `WizardSection.tsx` — labeled card with optional icon + trailing action
  - `WizardField.tsx` — label+input wrapper with 4 variants
    (`WizardField`, `WizardCurrencyField`, `WizardPercentField`, `WizardSelectField`)
  - `WizardButton.tsx` — `WizardPrimaryButton` / `WizardGhostButton` /
    `WizardAddButton`
  - `WizardSegmentedControl.tsx` — multi-choice pill selector
  - `WizardChip.tsx` — small status pills
  - `index.ts` — barrel export
- `components/onboarding/wizard/WizardContainer.tsx` — rewritten to
  support both `mode='modal'` (existing dashboard behaviour, default)
  and `mode='page'` (new full-page experience for `/app/onboarding`).
  New shell with gradient rocket mark in the header, gradient progress
  bar with pulse on active step, green→teal gradient on completed steps,
  and the new primary/ghost buttons in the footer. Body-scroll lock is
  modal-only. Escape key closes only in modal mode.
- `app/onboarding/page.tsx` (new) — dedicated full-page onboarding
  route. Unauth → `/signin?next=/onboarding`. Completed users →
  `/dashboard` (short-circuit). Draft hydration + autosave wired up
  the same way `DashboardLayout` wires the modal.

**What did NOT change:**

- No step files touched yet — they still use their original markup.
- No new data capture paths (PR 3a out-of-scope).
- `DashboardLayout` still renders the wizard as a modal exactly as
  before — the new `mode='modal'` default preserves behaviour.

**Next up:** redesigning each of the 8 step files one batch at a time,
starting with Welcome (which gets the profile auto-infer change) and
Household.

### 2026-04-12 (PM) — PR 3b questions answered; plan doc updated

All five pending questions resolved. §3 Decisions Locked In updated with
the five new rows (A-E). §4 Pending Questions emptied. §6.3 PR 3b task
checklist expanded from 9 stubs to ~45 concrete items covering the
renter path, non-property loans, super routing, Basiq shortcut, and
lifestyle fields. §7 decisions log updated with the detailed rationale
for each answer.

**Next up:** starting PR 3a implementation — primitives + CSS tokens +
new `/app/onboarding` route + shell redesign in the first batch.

### 2026-04-12 — Plan document created

Initial draft of this plan written and committed on
`claude/review-monitrax-docs-ty15A`. No PR 3a code work yet.

---

## 9. How to use this document

**When starting a new batch of work:**
1. Re-read §2 Ground Rules and §3 Decisions Locked In.
2. Check §4 Pending Questions for anything blocking.
3. Pick the next unchecked item from §5.5 or §6.3.
4. If you discover a new assumption, add it to §4 or §7 before writing code.

**When finishing a batch of work:**
1. Tick the relevant item(s) in §5.5 / §6.3.
2. Add an entry to §8 Progress Log with date + summary.
3. If a new decision was made, add it to §7.
4. Commit this file **in the same commit** as the code change whenever
   reasonable, or as a separate "plan update" commit when the change is
   process-only.

**When scope changes:**
1. Update the relevant section of this document.
2. Call it out in the commit message: `docs(plan): scope change — …`
3. Flag it to the reviewer (Reza) in the PR description.

---

*End of plan — last updated 2026-04-12*
