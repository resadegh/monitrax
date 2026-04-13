# Phase 12 — Wizard Redesign Plan (PR 3a / PR 3b)

> **Living document.** Updated continuously as decisions are made and work
> progresses. Treat this as the single source of truth for PR 3a and PR 3b.
> If anything here doesn't match reality, fix the doc first, then the code.

**Owner:** Claude (engineer) | **Reviewer:** Reza
**Status:** ✅ PR 3a complete. 🟡 PR 3b pending (structural additions). 🟡 PR 3c pending (data source hygiene).
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
| **F** | **Data source hygiene for account balances** — eliminate manual entry or de-rank it? | **Three-tier hierarchy** (aligned with the schema's existing `BalanceSource` enum and Phase 13 §417): **Basiq > Import > Manual**. Manual entry is **kept as a de-ranked fallback** for coverage gaps (cash, crypto, foreign banks, fintechs without Basiq support, dormant accounts). File import (composing the existing `components/bank/ImportWizard.tsx` — Phase 13/18) is added to PR 3b's Accounts step as Tier 2 with a closing balance anchor. A new **PR 3c "Data source hygiene"** handles the app-wide staleness story: balance-freshness indicators, "upgrade this account" UI in Settings, existing-user migration nudges. | Eliminating manual entry entirely would break existing users and leave coverage gaps invisible to Monitrax. Basiq doesn't cover every institution. The schema already documented the three-tier hierarchy — we just need to catch the UX up. Reusing the existing `ImportWizard` avoids duplicating file-parsing logic. |

---

## 4. Pending / Open Questions

All questions answered as of 2026-04-12 (late evening). See §3 row F
and §7 progress log for the resolution of the data source hygiene
question. This section is kept for future assumption-tracking.

*No currently open questions.*

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

**Step redesigns (batched across 2 commits within PR 3a):**
- [x] `WelcomeStep` — gradient-clip-text header + 2-question profile auto-inference (removes 4-card picker) + country/tax revealed after answers
- [x] `HouseholdStep` — WizardStepShell + WizardSection for members/pets + WizardSegmentedControl for vehicle count + cleaner member/pet cards
- [x] `PropertiesStep` — WizardStepShell + simplification (purchase price/date behind "Advanced details" disclosure) + inline live equity preview + collapsible loan section + summary tiles
- [x] `AccountsStep` — WizardStepShell + quick-add tile grid for empty state + compact account cards with offset linking + 3-tile summary
- [x] `InvestmentsStep` — WizardStepShell + expandable account cards + inline holdings table + live value preview in header + 3-tile summary
- [x] `AssetsStep` — expandable cards, vehicle fields inline (only when type=VEHICLE), depreciation preview with colour-coded pct chip, 12-col running-cost grid matching PropertiesStep pattern
- [x] `IncomeExpensesStep` — clean tab switcher with live counts + rounded pills, inline annualised preview on every row, salary GROSS/NET segmented control, bottom cashflow summary with per-month equivalent
- [x] `ReviewStep` — hero net-worth card with gradient background and ambient blur glow, 3-tile metrics row (income/outgoings/cashflow), "What you've added" grid, "What you'll unlock" panel, confetti preserved

**Cross-cutting:**
- [x] Per-step accessibility audit (ARIA, keyboard, focus trap) — `WizardSegmentedControl` is a proper `radiogroup`; `WizardStepShell` titles are `<h2>`; every interactive element is reachable by keyboard; Escape closes modal mode.
- [x] Per-step `prefers-reduced-motion` audit — reduced-motion overrides in place for every new keyframe (`.wz-step-shell`, `.wz-stagger`, `.wz-btn-primary`).
- [x] Per-step dark mode audit — every new primitive class has a `.dark` variant; gradient accents use `dark:from-*` variants.
- [x] Mobile responsive audit (≥ 375px) — 2-col grids stack on xs, 12-col inline grids collapse gracefully, footer buttons fit.
- [ ] Dead-code sweep after all refactors *(deferred — already swept in PR 1 and PR 2; no new dead code introduced in PR 3a)*

**Documentation:**
- [x] Update `PHASE_12_ONBOARDING_TOUR.md` with PR 3a details (new §16, revision row v2.3)
- [x] New changelog: `CHANGELOG_2026_04_12_WIZARD_VISUAL_OVERHAUL.md`
- [x] Update this plan document's §5.5 checklist continuously
- [x] Update `CONSOLIDATED_CHANGELOG.md` entry
- [x] Update `MASTER_BLUEPRINT.md` version to v2.6

**Commit + push:**
- [x] Foundation committed as `33f9d41` (primitives + shell + route)
- [x] Steps batch 1 committed as `d13cc1e` (Welcome + Household + Properties + Accounts + Investments)
- [x] Steps batch 2 + docs committed (Assets + Income/Expenses + Review + PR 3a docs)

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

**Three-tier Accounts step (questions B, 5, F — expanded from original Basiq-only scope):**
- [ ] **Tier 1: Basiq "Connect your bank" tile (Recommended)**
  - [ ] Add "Connect your bank" primary CTA tile at the top of `AccountsStep`
  - [ ] Wire button to `POST /api/basiq/connect` → redirect to returned `consentUrl`
  - [ ] Before redirect: save the current wizard draft so nothing is lost
  - [ ] New `/app/onboarding/basiq-callback/page.tsx` — polls `GET /api/basiq/connections` until `ACTIVE`, then redirects back to `/app/onboarding?step=accounts&basiq=connected`
  - [ ] On return: wizard reads imported accounts from the DB (they're now in `Account` with `balanceSource='BASIQ'`) and shows them as pre-filled, read-only-except-for-rename rows
  - [ ] Add `AccountInput.source: 'BASIQ' | 'IMPORT' | 'MANUAL'` on the wizard type
  - [ ] `bulk-create`: skip accounts with `source === 'BASIQ'` (already in DB from Basiq sync)
  - [ ] Loading/error states for the Basiq round-trip
- [ ] **Tier 2: File import tile (Good)**
  - [ ] Add "Upload a transaction file" tile below the Basiq one
  - [ ] Compose the existing `components/bank/ImportWizard.tsx` (Phase 13/18) — do NOT duplicate parsing logic
  - [ ] After file upload, prompt user for a "closing balance" anchor value from their statement
  - [ ] Backend: reconcile forward — `currentBalance = closingBalance + sum(transactions since statement date)`; store on `Account` with `balanceSource='IMPORT'`, `lastImportedBalance=closingBalance`
  - [ ] `bulk-create`: skip accounts with `source === 'IMPORT'` (already persisted by the import flow)
  - [ ] File-imported accounts also appear as pre-filled, editable-name cards on return
- [ ] **Tier 3: Manual entry tile (Fallback)**
  - [ ] Rename existing "Add manually" quick-add tiles under a single "Enter manually" tile, visually de-ranked
  - [ ] Inline helper text: "Best for cash, crypto, foreign or unsupported accounts. You'll need to update the balance manually."
  - [ ] `source='MANUAL'` on the wizard input; `bulk-create` writes these as today (already sets `balanceSource='MANUAL'` per PR 1)
- [ ] **Cross-tier**:
  - [ ] Visual ranking: Tier 1 tile is the hero (full-width, gradient accent, "Recommended" chip), Tier 2 is mid-weight, Tier 3 is the smallest
  - [ ] Only one tier is actively being set up at a time; switching tiers collapses the previous tier's inputs
  - [ ] Dark mode + reduced-motion on every new element
  - [ ] Keyboard accessible (tab through tiles, Enter to select)
  - [ ] CDR compliance note in the changelog (draft never holds CDR data — only DB row IDs as pointers for BASIQ/IMPORT rows)

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

## 6A. PR 3c Scope — Data Source Hygiene (Follow-up)

**Goal:** Close the drift problem app-wide. PR 3b fixes the onboarding
Accounts step to offer Basiq + Import + Manual as ranked tiers. PR 3c
makes the staleness visible across the dashboard and gives existing
users an upgrade path from MANUAL to BASIQ / IMPORT.

**Dependency:** PR 3a and PR 3b must both be merged first — PR 3c
builds on the three-tier data model locked in by PR 3b.

### 6A.1 In Scope (PR 3c)

| # | Change | Affected surface |
|---|---|---|
| 1 | **Staleness indicators on Account entities.** Every place in the app that renders an account balance displays a freshness chip: "🟢 Synced 2 min ago" (BASIQ), "🔵 Imported 3 days ago" (IMPORT), "🟡 Manual · 14 days old" (MANUAL stale). | `components/accounts/*`, `components/dashboard/*`, `components/loans/*` (offset accounts) |
| 2 | **Dashboard staleness nudge.** If any MANUAL account has `balanceLastUpdatedAt` > 14 days ago, show a banner: "Your manual balances are getting stale — connect via Basiq or re-upload a statement to keep them fresh." Dismissable for the session. | `components/DashboardLayout.tsx` or a new `components/dashboard/StaleBalanceNudge.tsx` |
| 3 | **Confidence indicators on derived metrics.** Any metric that depends on a stale MANUAL balance (net worth, cashflow forecast, emergency fund tracker) gets a small ⓘ tooltip: "This number may be stale — based on X manual balances last updated Y days ago." | `lib/services/masterFinancialService.ts` (output structure), `components/StatCard.tsx`, dashboard widgets |
| 4 | **Settings > Accounts "Upgrade this account" button.** On each existing account row, show an action: "Upgrade to Basiq" (opens consent flow) or "Upgrade to Import" (opens ImportWizard with this account pre-selected). Success replaces the account's `balanceSource` and updates `balance`. | `app/dashboard/accounts/page.tsx`, new `components/accounts/UpgradeAccountButton.tsx` |
| 5 | **Existing-user migration nudge.** On first /dashboard visit after PR 3c deploys, show a one-time modal to users with ≥1 MANUAL account: "Monitrax can now sync your bank directly. Upgrade your accounts for always-fresh balances." CTAs: "Connect now" / "Remind me later" / "I'll keep them manual". Dismissal flag on `UserPreference` (new column `dismissedBalanceUpgradeNudge`). | New `components/onboarding/BalanceUpgradeNudgeModal.tsx`, schema addition |
| 6 | **`balanceLastUpdatedAt` enforcement app-wide.** Every code path that writes `Account.currentBalance` must also write `balanceLastUpdatedAt = now()`. Audit all write sites and add to a canonical helper. | `lib/services/accountBalanceService.ts` (new, or extend existing), every `Account.update` call site |
| 7 | **Balance age heat-map in Settings > Data Health.** New small dashboard tile showing accounts coloured by freshness (green / amber / red). | `app/dashboard/settings/data-health/page.tsx` (new sub-route) |

### 6A.2 Out of Scope for PR 3c

- Basiq Advanced (Phase 24B) features like webhooks / scheduled sync / transaction enrichment — those are a separate phase
- Automatic re-sync scheduling via Cloud Scheduler (belongs to Phase E / §6A follow-up)
- Deletion / deactivation of accounts — already exists, unchanged
- Any schema changes to the `BalanceSource` enum itself — already complete in the schema

### 6A.3 PR 3c Task Checklist (stub — fleshed out when PR 3b lands)

- [ ] Resolve any questions arising from PR 3b implementation
- [ ] **Staleness chip component** (shared, used everywhere an `Account` balance is shown)
- [ ] **Dashboard staleness nudge banner**
- [ ] **Confidence indicators** on derived metrics (+ the canonical snapshot service must expose staleness metadata in its output)
- [ ] **Settings > Accounts upgrade button** (Basiq path + Import path)
- [ ] **First-visit migration modal** for existing users with MANUAL accounts
- [ ] **`balanceLastUpdatedAt` audit** — every write path updated
- [ ] **Balance age heat-map** in Settings > Data Health
- [ ] Schema: `UserPreference.dismissedBalanceUpgradeNudge Boolean @default(false)`
- [ ] Documentation: Phase 12 blueprint §17, plan doc §6A.3, changelog, master blueprint
- [ ] Single atomic commit on `claude/review-monitrax-docs-ty15A` after PR 3b lands

### 6A.4 Success metrics (for PR 3c)

- **Primary**: ≥50% of MANUAL accounts upgraded to BASIQ or IMPORT within 30 days of PR 3c shipping (measured on existing user base)
- **Secondary**: `balanceLastUpdatedAt` median age across the user base drops from current (unbounded) to < 7 days
- **Tertiary**: Zero user complaints about silently-stale dashboard metrics after the confidence-indicator rollout

---

## 7. Architectural Decisions Log

Captured as decisions are made during implementation. Most-recent first.

### 2026-04-12 (late evening) — Data source hygiene question F resolved; PR 3c added

Reza answered all three sub-questions from §10 with **yes, yes, yes**.

**Decisions locked in:**

1. **Manual account entry stays** as a de-ranked fallback. Not
   eliminated. Rationale: coverage gaps are real (Basiq doesn't cover
   every institution, credit cards may not be CDR-shared, some users
   have cash / crypto / foreign accounts). Existing users shouldn't be
   broken.
2. **File import added to PR 3b's Accounts step** as Tier 2. **Reuses
   the existing `components/bank/ImportWizard.tsx` (Phase 13/18) — no
   new file parsing logic.** The wizard composes that component, then
   asks for a closing balance as an anchor. Backend reconciles
   `balance = closingBalance + sum(transactions since statement date)`.
3. **PR 3c "Data source hygiene" is now formally planned** in §6A.
   Covers staleness indicators everywhere, the dashboard nudge,
   confidence indicators on derived metrics, Settings > Accounts
   upgrade button, the existing-user migration modal, and the
   app-wide `balanceLastUpdatedAt` audit.

**Impact on §3 Decisions Locked In:** new row F added with the
three-tier hierarchy (Basiq > Import > Manual), aligned with the
existing `BalanceSource` enum in the schema and the already-documented
hierarchy in `PHASE_13_TRANSACTIONAL_INTELLIGENCE.md §417`.

**Impact on §6.3 PR 3b:** the Accounts step task list was expanded
from "Basiq shortcut + manual form" into a three-tier tile picker.
Tier 1 (Basiq) remains what I had planned. Tier 2 (file import) is new
— eight new sub-tasks. Tier 3 (manual) is the demotion of the current
behaviour. The `AccountInput.isBasiqImported: boolean` field in the
original plan is replaced by a more general `AccountInput.source:
'BASIQ' | 'IMPORT' | 'MANUAL'` so all three flows route through the
same field.

**Impact on §6A PR 3c (NEW):** 7 work items documented, ranging from
staleness chips (Tier 1 of the rollout) to the full app-wide audit of
`balanceLastUpdatedAt` write sites. Success metrics defined: 50% of
MANUAL accounts upgraded within 30 days of ship, median balance age
< 7 days.

**Not affected:** PR 3a continues on plan unchanged. PR 3a is purely
visual and doesn't touch data sources. Batch 2 (Assets, Income/Expenses,
Review + docs) resumes now.

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

### 2026-04-12 (night) — PR 3a COMPLETE

All 8 wizard step files redesigned, PR 3a docs written, master blueprint
bumped to v2.6, Phase 12 blueprint bumped to v2.3 with new §16. PR 3a
is fully shipped.

**Steps completed in this final batch (commit coming next):**

- **`AssetsStep.tsx`** — expandable asset cards with vehicle-specific
  fields appearing inline only for `type=VEHICLE`. Depreciation preview
  shows `purchasePrice - currentValue` with a colour-coded percentage
  chip (rose if depreciating, emerald if appreciating). Running costs
  reuse the 12-col inline grid pattern from `PropertiesStep` for
  consistency.
- **`IncomeExpensesStep.tsx`** — cleaner tab switcher with live count
  pills, inline "Annualised: $X / year" preview on every row, salary
  GROSS/NET segmented control, empty-state quick-add chips for common
  income types and expense categories, bottom cashflow summary card
  showing annual income / expenses / surplus+deficit + per-month
  equivalent.
- **`ReviewStep.tsx`** — hero net-worth card with gradient background,
  ambient blur glow, gradient clip-text on positive values; 3-tile
  metrics row (income / outgoings / monthly cashflow) including
  inline sublabel for the loan-repayments breakdown; "What you've
  added" grid listing per-entity counts (filters to >0); "What you'll
  unlock" panel listing the dashboard capabilities; confetti preserved.

**Documentation:**

- `docs/blueprint/PHASE_12_ONBOARDING_TOUR.md` — new §16 section
  documenting the full PR 3a scope, design tokens, and step-by-step
  notes. Revision row v2.3 added.
- `docs/changelog/CHANGELOG_2026_04_12_WIZARD_VISUAL_OVERHAUL.md`
  (new) — full PR 3a changelog with test plan.
- `docs/blueprint/MASTER_BLUEPRINT.md` → v2.6. Phase 12 wizard row in
  "In Progress" updated to reflect PR 1 + PR 2 + PR 3a merged,
  PR 3b / PR 3c pending.
- `docs/changelog/CONSOLIDATED_CHANGELOG.md` — new PR 3a entry at the
  top of April 2026.
- This plan doc — all §5.5 checkboxes ticked (cross-cutting audit
  passed), §8 progress log updated, status banner flipped to
  "PR 3a complete. PR 3b/3c pending."

**What PR 3a ships in total (across 3 commits — foundation, batch 1,
batch 2):**

- 7 new primitive files + 1 index
- 1 rewrite of `WizardContainer` with `mode: 'page' | 'modal'`
- 1 new `/app/onboarding/page.tsx` route
- 8 step file redesigns
- ~330 LOC of new design tokens in `wizard-animations.css`
- 0 schema changes
- 0 API changes
- 0 new data capture paths

**PR 3b next**, starting with the three-tier Accounts data source
picker — Tier 1 Basiq, Tier 2 file import (reusing
`components/bank/ImportWizard.tsx`), Tier 3 manual.

### 2026-04-12 (late evening) — PR 3a step redesigns batch 1 of 2

Five of eight step files redesigned to compose the new PR 3a primitives.
All five use `WizardStepShell` / `WizardSection` / `WizardField` /
`WizardCurrencyField` / `WizardPercentField` / `WizardSelectField` /
`WizardSegmentedControl` / `WizardAddButton` consistently.

**Completed steps:**

- `WelcomeStep.tsx` — **Profile auto-inference**. Removes the old
  4-card explicit picker. Asks two direct questions ("Do you own any
  property?" + "Do you have investments?") via `WizardSegmentedControl`,
  then derives `profileType` from the combination
  (STARTER/HOMEOWNER/INVESTOR/MIXED). Reverse-infers on mount so
  hydrated drafts show the user's previous answers. Country + tax year
  only revealed after both answers are given. Title uses gradient
  clip-text on "Monitrax". Dynamic time chip updates with each
  inference.
- `HouseholdStep.tsx` — cleaner member/pet cards (h-8 w-8 icon tiles,
  tighter grid), inline empty states with dashed borders,
  `WizardSegmentedControl` for the vehicle count picker. Member and pet
  dialogs preserve existing functionality but use better spacing.
- `PropertiesStep.tsx` — **Simplification**. Name + current value are
  the only up-front required fields (drops purchase price / date to an
  "Advanced details" disclosure). Live equity preview shows as the user
  types (`equity = currentValue - loan.principal`). Loan section
  collapses when `hasLoan` is unticked. Rental income section only
  appears for INVESTMENT type. 3-tile summary at the bottom.
- `AccountsStep.tsx` — quick-add tile grid for the empty state (4 type
  options), compact account cards with offset→loan linking only
  surfaced when type=OFFSET, credit card helper clarifies the debt
  semantics, 3-tile summary showing cash assets / credit debt / net.
- `InvestmentsStep.tsx` — expandable account cards (collapsed shows
  total value in the header), inline 12-col holdings grid with
  ticker/units/avg price/type/delete, live holdings-value calc at the
  card footer, 3-tile summary showing accounts/holdings/total value.

**Primitives update:**

- `WizardStepShell.tsx` — `title` prop widened from `string` to
  `React.ReactNode` so steps can use gradient clip-text accents inline.

**Not yet in this batch (next commit):**

- `AssetsStep.tsx`
- `IncomeExpensesStep.tsx`
- `ReviewStep.tsx`
- PR 3a docs (Phase 12 blueprint §16, changelog, master blueprint)

**Also captured in this commit:**

- §4 and §10 of this plan doc updated with Reza's **new architectural
  question** about data source hygiene for account balances (§10 — full
  analysis and three-tier recommendation). Three sub-questions remain
  open pending Reza's yes/no answers; blocks final PR 3b Accounts step
  scope. Does NOT block PR 3a — PR 3a is purely visual and continues on
  plan.

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

## 10. Architectural Discussion — Data Source Hygiene for Account Balances *(RESOLVED)*

> **Status:** ✅ RESOLVED — raised by Reza 2026-04-12 (evening), decided
> same day. All three sub-questions answered **yes**. Kept here as the
> written record of the reasoning. The decision is captured in §3 row F
> and the PR 3b / PR 3c scope in §6.3 and §6A.

### 10.1 The problem Reza raised

Manually-entered account balances go stale the moment they're typed. A
user enters `$5,000` on day 1, but by day 7 they've spent `$500` and the
dashboard still shows `$5,000` until they manually update. Every
downstream engine (cashflow forecasts, debt plans, net worth, insights)
is silently misled. His proposal: **eliminate manual balance entry**,
allow only (a) Basiq Open Banking connection, or (b) transaction file
upload, where the user provides a closing balance that the system then
reconciles forward against imported transactions.

### 10.2 What Monitrax already has

The team has already thought about this. Evidence:

- `schema.prisma` — `Account.balanceSource BalanceSource`, enum is
  `MANUAL | IMPORT | BASIQ | USER_VERIFIED`. Default is `MANUAL`.
  PR 1 fix already sets this to `MANUAL` explicitly on bulk-create.
- `Account.basiqLastSynced`, `Account.balanceLastUpdatedAt`,
  `Account.lastImportedBalance` — schema tracks freshness per source.
- `PHASE_13_TRANSACTIONAL_INTELLIGENCE.md §417`: explicit hierarchy
  documented — `BASIQ > IMPORT > MANUAL`.
- `components/bank/ImportWizard.tsx` + `TransactionImportDialog.tsx`
  already exist for CSV/QIF/OFX import.
- `app/api/basiq/connect/route.ts` already returns a `consentUrl` and
  is Phase 24 (Open Banking) live.

The schema and backend infra agree with Reza's instinct. The gap is
the **wizard UX** and the **app-wide staleness story** — neither has
been caught up yet.

### 10.3 Claude's recommendation

**Don't eliminate manual entry — de-rank it.** Three reasons:

1. **Coverage gaps are real.** Basiq doesn't cover: smaller fintechs,
   foreign banks, crypto exchanges, cash, prepaid/gift cards, employer
   RSU accounts, old dormant accounts a user still wants in net worth.
   Without a manual fallback, those are invisible to Monitrax.
2. **Consent friction on signup.** Forcing a Basiq consent redirect
   during onboarding will hurt completion. File import requires a file
   the user has on hand — also friction.
3. **Existing users.** Every current Monitrax user has MANUAL accounts.
   Removing the option forces a migration that would be worse than the
   drift problem it solves.

**Recommended three-tier model** (aligned with the schema's existing
`BalanceSource` enum and Phase 13's documented hierarchy):

```
Tier 1 (best):   Basiq / Open Banking   → balanceSource = BASIQ
                 Always fresh, Phase 24 integration.

Tier 2 (good):   Transaction file upload → balanceSource = IMPORT
                 User uploads CSV/OFX/QIF + provides closing balance
                 as an anchor. System reconciles forward from
                 imported transactions.

Tier 3 (fallback): Manual entry         → balanceSource = MANUAL
                   Still allowed for coverage gaps, but:
                   - UI shows `balanceLastUpdatedAt`
                   - Dashboard shows a staleness nudge after 14 days
                   - Confidence indicators on dependent metrics
```

### 10.4 Proposed wizard UX (would replace PR 3b Accounts step plan)

```
Where should we pull your account data from?

┌─────────────────────────────────────────┐
│ 🏦 Connect your bank      [Recommended] │  Tier 1: Basiq
│    30 seconds, always up to date        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📄 Upload a transaction file            │  Tier 2: File import
│    CSV / OFX / QIF + closing balance    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ✏️  Enter manually                       │  Tier 3: Manual
│    Cash, crypto, foreign or unsupported │
└─────────────────────────────────────────┘
```

Tiles are visually ranked — Basiq is hero, Import is secondary, Manual
is tertiary. All three remain available.

### 10.5 Scope allocation

| Work | Where it lives |
|---|---|
| Visual tier-ranking of Accounts step options | PR 3b (expanded from original Basiq-only plan) |
| File upload integration into wizard (via existing `components/bank/ImportWizard.tsx`) | PR 3b |
| Closing balance anchor input | PR 3b |
| `AccountInput.source: 'BASIQ' \| 'IMPORT' \| 'MANUAL'` on wizard types | PR 3b |
| `bulk-create` handling of all three sources (skips BASIQ/IMPORT accounts, persists MANUAL only) | PR 3b |
| Dashboard staleness nudge ("Your balance is 14 days old — reconnect Basiq or re-upload") | **PR 3c (new)** |
| Confidence indicators on stale-MANUAL-derived metrics | **PR 3c** |
| Settings > Accounts "Upgrade this account" button (MANUAL → IMPORT → BASIQ) | **PR 3c** |
| `balanceLastUpdatedAt` enforcement app-wide | **PR 3c** |
| Migration path for existing manual-entry users | **PR 3c** |

### 10.6 Sub-questions — all RESOLVED 2026-04-12 (late evening)

1. **Keep manual entry as a de-ranked fallback?** ✅ **YES** — coverage gaps are real.
2. **Add file import to PR 3b's Accounts step?** ✅ **YES** — reuses the existing `components/bank/ImportWizard.tsx`, no duplication of parsing logic.
3. **Spec out PR 3c "Data source hygiene" now?** ✅ **YES** — the full pipeline is documented in §6A.

### 10.7 Impact on current PR 3a work

**None.** PR 3a is purely visual and simplification. It does not touch
data sources — it just makes manual entry look nicer. The decisions in
§10 only affect PR 3b (Accounts-step scope expansion) and PR 3c (new
follow-up). PR 3a continues on plan.

---

*End of plan — last updated 2026-04-12 (evening)*
