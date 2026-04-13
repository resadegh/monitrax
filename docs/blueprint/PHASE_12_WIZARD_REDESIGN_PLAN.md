# Phase 12 — Wizard Redesign Plan (PR 3a / PR 3b)

> **Living document.** Updated continuously as decisions are made and work
> progresses. Treat this as the single source of truth for PR 3a and PR 3b.
> If anything here doesn't match reality, fix the doc first, then the code.

**Owner:** Claude (engineer) | **Reviewer:** Reza
**Status:** 🟡 Planning (PR 3a not yet started)
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

---

## 4. Pending / Open Questions

These are blocking for PR 3b but NOT for PR 3a. Will resolve as we get
there.

| # | Question | Status | Blocking? |
|---|---|---|---|
| A | Exact fields to capture for `SuperannuationAccount`? The schema has fund/USI/member/contributions. Minimum for onboarding = fund name + current balance, with deeper fields in Settings later? | **OPEN** (PR 3b) | PR 3b |
| B | Basiq shortcut UX: does connecting a bank **skip** the manual account entry step, or run in parallel? | **OPEN** (PR 3b) | PR 3b |
| C | For non-property loans (CAR / PERSONAL / STUDENT / LOC): do we need a dedicated "Debts" step, or should they fold into the Accounts step as a sub-section? | **OPEN** (PR 3b) | PR 3b |
| D | Lifestyle fields (`lifestylePreference`, `diningOutFrequency`, `hobbiesWithCosts`) — add to existing Household step or own micro-step? | **OPEN** (PR 3b) | PR 3b |
| E | `/app/onboarding` dedicated route — is this PR 3a or PR 3b? | **PR 3a** (pre-decided) | — |

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
- [ ] Create `components/onboarding/wizard/primitives/WizardField.tsx`
- [ ] Create `components/onboarding/wizard/primitives/WizardSection.tsx`
- [ ] Create `components/onboarding/wizard/primitives/WizardGhostButton.tsx`
- [ ] Create `components/onboarding/wizard/primitives/WizardPrimaryButton.tsx`
- [ ] Create `components/onboarding/wizard/primitives/WizardStepShell.tsx`
- [ ] Create `components/onboarding/wizard/primitives/index.ts`
- [ ] Extend `styles/wizard-animations.css` with PR 3a additions

**Route:**
- [ ] Create `app/onboarding/layout.tsx` (minimal, unauth-aware)
- [ ] Create `app/onboarding/page.tsx` (mounts `WizardContainer` in page mode)
- [ ] Add `mode: 'page' | 'modal'` prop to `WizardContainer` (modal = existing behaviour)

**Shell redesign:**
- [ ] `WizardContainer` header — new gradient, new close button, new step description
- [ ] `WizardContainer` progress bar — gradient fill, numbered steps, accessible labels
- [ ] `WizardContainer` footer nav — primary/ghost buttons from primitives
- [ ] AI helper button — reskin to match design language

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

> Stubs only. Populated with detail after PR 3a lands and pending questions §4 A-D are resolved.

- [ ] Resolve pending questions (§4 A-D)
- [ ] **Renter path** implementation
- [ ] **Non-property loans** implementation
- [ ] **Super routing** implementation
- [ ] **Basiq shortcut** implementation
- [ ] **Lifestyle fields** implementation
- [ ] `bulk-create` updates for all of the above
- [ ] Documentation updates (Phase 12, plan doc, changelog, master blueprint)
- [ ] Commit + push

---

## 7. Architectural Decisions Log

Captured as decisions are made during implementation. Most-recent first.

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
