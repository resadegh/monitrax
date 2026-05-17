# Phase 12 — Setup Page Refinement + Onboarding Wizard (Twin-Track Plan)

> **Living document.** This is the master plan for the twin-track
> Phase 12 work. It supersedes `PHASE_12_REDESIGN_V3.md` for the
> current direction. If reality diverges from this doc, fix the doc
> first, then the code (per CLAUDE.md §10.5 / §11).

**Owner:** Claude (engineer) | **Reviewer:** Reza
**Status:** ✅ Wizard RE-ENABLED 2026-04-18 with TRAIL alignment
  (was temporarily disabled 2026-04-15 during R12 remediation).
  Bulk-create API uses `prisma.create` only (no destructive upserts),
  so wizard is safe without the `onboardingEstimateService` source guard.
  Old estimate service remains disabled as defence in depth.
**Supersedes:** `docs/blueprint/PHASE_12_REDESIGN_V3.md` (v3
dashboard-as-onboarding, pivoted 2026-04-15)
**Related:**
- `docs/blueprint/TRAIL_FRAMEWORK.md` §9 (TRAIL Check — pre-signup
  assessment) and §10 (Guided Setup TRAIL alignment)
- `docs/blueprint/PHASE_12_ONBOARDING_TOUR.md` (v2.2 tour spec —
  historical reference only)
- `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` —
  **Track E (queued):** parallel conversational + voice input modality
  over THIS doc's data contract. Form-mode (Track B) is unchanged;
  chat-mode is a sibling front door that converges on the same
  `ReviewStep` and `/api/onboarding/bulk-create`. Read that doc when
  working on the chat surface; this doc remains the SSOT for the form
  surface + data contract.
- `docs/blueprint/PHASE_27_GEMINI_AI_MIGRATION.md` (existing Gemini client)
- `docs/blueprint/PHASE_28_AI_INTEGRATION.md` (existing Gemini use case)
- `CLAUDE.md` (binding build rules)

---

## Table of Contents

1. Purpose — twin-surface architecture
2. Decisions locked in (Q1–Q11)
3. Data model strategy (Option A source enum)
4. Track A — `/dashboard/setup` refinement
5. Track B — `/onboarding` new wizard
6. Track C — Integration + legacy cleanup
7. Track D — Design QA pass
8. Design standards (§10 binding)
9. Data flow diagrams
10. Files: stay / extend / delete
11. Risk register
12. Validation checklist
13. Progress tracker
14. Changelog

---

## 1. Purpose — Twin-Surface Architecture

Monitrax has two distinct user needs around onboarding. Previous
plans tried to collapse them onto a single surface and kept getting
it wrong. The correct architecture is **two surfaces, clearly
split**, each optimised for one need.

### 1.1 The two surfaces

| Surface | Purpose | Who it serves | Data it writes |
|---|---|---|---|
| **`/onboarding`** (NEW top-level route) | A light, fun, mobile-first discovery experience. Max 5–7 steps, ~90 seconds. Rough estimates only. | **First-time users only.** | **Estimated** data: tagged `source: ONBOARDING`, low-confidence, written to existing financial tables but visually marked as estimates. |
| **`/dashboard/setup`** (EXISTING page — refined, not rebuilt) | A **Guided Financial Setup Engine** — the detailed data capture workbench. Users refine estimates into verified data, connect banks, add real entities, track completion per module. | Returning users + users who finished `/onboarding` + users who skipped the wizard entirely. | **Verified** data: manually-entered detailed records, Basiq-synced accounts, transactions. |

They are **complementary, not competing**. The wizard is the
narrative entry ramp; the setup page is the persistent workbench.
The wizard redirects to the setup page on completion, and the setup
page detects estimated vs verified data and guides refinement.

### 1.2 What this plan is NOT

Per the directive (2026-04-15) this plan explicitly **does not**:

- ❌ Replace, redesign, or rebuild the existing `/dashboard/setup` page
- ❌ Remove or re-structure its existing cards (Accounts, Properties, Income, Expenses, Investments, Loans)
- ❌ Mix the wizard and the setup page onto one surface
- ❌ Overwrite real financial tables with wizard estimates
- ❌ Introduce duplicate flows between the wizard and the setup page
- ❌ Change existing data structures beyond the minimum schema addition needed for the estimated/verified distinction

### 1.3 What this plan IS

- ✅ **Track A** — refine `/dashboard/setup` into a Guided Financial
  Setup Engine: one recommended next action, per-module completion
  tracking, card prioritisation, Why-This-Matters copy, confidence
  badges, lightweight guided entry modals instead of deep-link dumps.
- ✅ **Track B** — build a NEW `/onboarding` wizard for first-time
  users: 5 data-collection steps + welcome + final reveal, writes
  estimated data, redirects to `/dashboard/setup` on completion.
- ✅ **Track C** — wire the welcome modal / resume banner to route
  users correctly, retire the legacy `WizardContainer` once validated.
- ✅ **Track D** — mandatory §10.6 design quality audit before any
  legacy cleanup ships.

### 1.4 What already exists (and will be kept or extended)

Per the directive's "extend, not rebuild" rule, every component
already built on `/dashboard/setup` is preserved:

| Existing component | Status after this plan |
|---|---|
| `app/dashboard/setup/page.tsx` | **Refined** — adds `<SetupNextActionPanel />`, keeps existing components |
| `components/setup/SetupTray.tsx` | **Extended** — per-module progress with Missing/Estimated/Verified states |
| `components/dashboard/BasiqHeroCard.tsx` | **Kept** — auto-hides when Basiq connected (existing behaviour) |
| `components/dashboard/DashboardEmptyStateGrid.tsx` | **Extended** — card prioritisation visual states + Why-This-Matters + confidence badges + guided modal CTAs |
| `components/dashboard/EmptyStateTile.tsx` | **Extended** — new props for priority state, confidence, Why-This-Matters |
| `lib/services/setupStateService.ts` | **Renamed/extended** as `SetupProgressService` — per-module Missing/Estimated/Verified logic |
| `lib/setup/tasks.ts` | **Extended** — task registry gains per-module progress metadata |
| `hooks/useSetupState.ts` | **Extended** — consumes extended service |
| `app/api/setup/state/route.ts` | **Extended** — returns richer per-module state |
| `lib/setup/v3Flag.ts` | **Kept** — still useful for the `?legacy=wizard` escape hatch |

---

## 2. Decisions Locked In

All 11 Q&A from the audit turn, confirmed by user approval
2026-04-15. These are not re-openable without an explicit
direction change in this document's changelog.

| # | Decision | Answer | Why |
|---|---|---|---|
| **Q1** | Schema strategy for estimated data | **Option A — single `EntrySource` enum column per financial entity** | Minimal migration, solves 80% of the spec, does not preclude future dual-field upgrade. Aligns with existing `Account.balanceSource` pattern. |
| **Q2** | Fate of `/dashboard/setup` and its v3 components | **KEEP and extend** — do not delete any component built in Phases B–E | Per directive: extend, not rebuild. The dashboard setup page is the refinement workbench, not onboarding. |
| **Q3** | Fate of legacy `WizardContainer` and 10 step files | **Delete after new `/onboarding` wizard validates** | Avoids duplicate flows. Kept reachable via `/dashboard?legacy=wizard` escape hatch until Track C.2 cleanup. |
| **Q4** | Route for the new wizard | **`/onboarding`** (top-level, not nested under `/dashboard`) | Per directive §3. Top-level route signals "this is a separate experience from the dashboard workbench". |
| **Q5** | Resume UX for users who quit mid-wizard | **Silent resume on the last step they completed** | Reads from `User.onboardingStep` + `UserPreference.onboardingDraft`. No "do you want to resume?" modal — just pick up where they left off. |
| **Q6** | Immediate feedback implementation | **Commit to DB after each step → re-fetch snapshot → show real number** | Correct per CLAUDE.md §12.2 (all financial calculations through `masterFinancialService`). ~200ms round-trip is acceptable for the narrative pace. |
| **Q7** | Gemini "Need help?" in the first ship | **Deferred** — ship core wizard first, Gemini help as a follow-up once core is proven | Per directive §4, AI assistant is a placeholder, modular, not required to fully implement yet. |
| **Q8** | Final Reveal insight copy | **Simple math** (`monthlyCashflow * 12`) — no Gemini, no insight engine | The spec text gives a literal template. Simpler is better. |
| **Q9** | Assets step on the wizard | **Removed from wizard**. The directive's data collection list (household, income, housing, expenses, goal) does not include assets. Assets are captured on `/dashboard/setup` instead. | Directive §3.3 simplified the wizard to 5 data fields. Housing is a single own/rent/family picker, not a property entry. |
| **Q10** | Fate of `<OnboardingWelcomeModal>` | **Keep** — becomes the greeting beat before routing to `/onboarding` | Existing modal is polished, dismisses-once. Still the right first-contact moment before the wizard begins. |
| **Q11** | Wizard layout chrome | **Hybrid** — top bar with logotype + progress bar + exit button, no sidebar, full-height centered content | Stripe-style. Gives §10.4 "moment" focus without violating §10.5 "feels integrated". |

### 2.1 One additional decision (made by default)

| # | Decision | Default | Rationale |
|---|---|---|---|
| **Q12** | Does the `/onboarding` wizard have a Final Reveal before redirecting to `/dashboard/setup`? | **Yes — Step 6 Final Reveal with animated net worth + monthly savings + health grade, then a "Continue setting up →" CTA that routes to `/dashboard/setup`** | §10.4 identifies the Final Reveal as "the most important moment". Without it, the wizard feels like data harvesting. Overridable by removing Track B phase B.8 if user rejects in review. |

---

## 3. Data Model Strategy — Option A (Source Enum)

### 3.1 Why Option A

The directive requires onboarding data to be stored as **estimated**
(low confidence, refinable later) without overwriting real financial
tables. The cleanest way to do this with a minimal migration is to
add a single enum column to each financial entity tracking where
the row came from.

**Option A is the minimal viable schema change** that satisfies:

- The directive's "store as estimated, mark with low confidence, allow refinement later" rule
- CLAUDE.md §12.2 "no parallel data structures" — estimates live in the same tables as verified data
- `masterFinancialService` continues to work unchanged — it aggregates all rows regardless of source
- UI can render an "Estimated" badge wherever `source === 'ONBOARDING'`

### 3.2 The `EntrySource` enum

```prisma
enum EntrySource {
  ONBOARDING   // written by the /onboarding wizard (estimated, low confidence)
  MANUAL       // written by the user via /dashboard/setup or entity dialogs (verified)
  BASIQ        // imported from Basiq Open Banking (verified)
  IMPORT       // imported from CSV/OFX/QIF (verified)
  CALCULATED   // derived by a system engine (verified, read-only from the user's perspective)
}
```

### 3.3 Where the enum lives

Added as a single column `source EntrySource @default(MANUAL)` to
each of these Prisma models:

| Model | File | Default | Notes |
|---|---|---|---|
| `Account` | `prisma/schema.prisma` | `MANUAL` | Already has `balanceSource` — `source` is **different**: `balanceSource` tracks provenance of the balance value, `source` tracks provenance of the entire row. Both coexist. |
| `Income` | `prisma/schema.prisma` | `MANUAL` | |
| `Expense` | `prisma/schema.prisma` | `MANUAL` | |
| `Loan` | `prisma/schema.prisma` | `MANUAL` | |
| `Property` | `prisma/schema.prisma` | `MANUAL` | |
| `InvestmentAccount` | `prisma/schema.prisma` | `MANUAL` | |
| `SuperannuationAccount` | `prisma/schema.prisma` | `MANUAL` | |
| `Asset` | `prisma/schema.prisma` | `MANUAL` | |
| `HouseholdProfile` | `prisma/schema.prisma` | `MANUAL` | |

### 3.4 Backfill plan

All existing rows default to `source: MANUAL`. This is safe
because every pre-migration row was written through the existing
manual-entry paths (wizard `bulk-create` or per-entity dialogs).
No row was ever written by an `/onboarding` wizard, so defaulting
to `MANUAL` accurately reflects the historical state.

### 3.5 Confidence UI mapping

The UI layer maps the enum to a display state without storing a
separate `confidence` field:

| `source` value | UI state | Badge label | Badge colour |
|---|---|---|---|
| `ONBOARDING` | **Estimated** | "Estimated" | Amber (warning accent) |
| `MANUAL` | **Verified** | — (no badge) | — |
| `BASIQ` | **Verified** | "Bank-synced" | Emerald |
| `IMPORT` | **Verified** | "Imported" | Slate |
| `CALCULATED` | **Verified** | — (no badge) | — |

For a module where **no rows exist yet**, the setup tile displays
the **Missing** state directly from the zero row count — no enum
value needed.

### 3.6 Future escalation path

If reconciliation between estimated and verified values becomes
necessary (e.g. showing "Estimated $5,000/mo · Bank-synced
$4,832/mo" side by side), this can be added later by introducing
a `estimatedAmount` column alongside the existing `amount` column
on Income / Expense / etc. Option A does not preclude this
evolution — it is a minimal foundation that a future PR can build
on without rework.

---

## 4. Track A — `/dashboard/setup` Refinement

**Goal**: transform the existing `/dashboard/setup` page into a
"Guided Financial Setup Engine" without rebuilding any of its
components. Every phase is additive or extension-only. No
component deletions, no layout rewrites, no routing changes.

### 4.1 Scope — what changes, what doesn't

**Changes (additive/extension only):**
- New component `<SetupNextActionPanel />` above the existing layout
- Extended `setupStateService` → renamed to `SetupProgressService` with per-module Missing/Estimated/Verified logic
- New visual states on `<EmptyStateTile />`: priority (primary/secondary/dimmed), confidence badge
- New copy on each tile: Why-This-Matters line
- New `<GuidedEntryModal />` shell + 6 per-module guided flows
- Existing tile CTAs rewired: instead of deep-linking to `/dashboard/{module}?action=add`, they open the new guided modal

**Does NOT change:**
- Page routing (`app/dashboard/setup/page.tsx` stays)
- Existing component files (edits only, no deletions)
- Existing data model beyond the §3 schema addition
- Welcome modal behaviour
- Resume banner (handled in Track C)

### 4.2 Phase breakdown — A.0 to A.12

Each phase = 1 file (or occasional 2-file coordinated change) = 1 commit = 1 PR. Same rhythm as Phases A–F earlier.

#### A.0 — Prisma schema migration (blocking prerequisite)

**Scope**: 1 file (`prisma/schema.prisma`) + auto-generated migration.
**Blocks**: every A.* and B.* phase that writes data.
**Deliverables**:
- Add `enum EntrySource { ONBOARDING | MANUAL | BASIQ | IMPORT | CALCULATED }`
- Add `source EntrySource @default(MANUAL)` column to: Account, Income, Expense, Loan, Property, InvestmentAccount, SuperannuationAccount, Asset, HouseholdProfile
- Run `prisma migrate dev --name add_entry_source_enum` to generate migration SQL
- Backfill is a no-op (defaults to MANUAL)

**Risk**: medium. Prisma migrations are hard to reverse. Tagged pre-migration commit for rollback.

#### A.1 — SetupProgressService extension

**Scope**: 2 files (`lib/services/setupStateService.ts` + `lib/setup/tasks.ts`).
**Depends on**: A.0.
**Deliverables**:
- Rename `setupStateService` → `SetupProgressService` (or add new exports alongside existing ones to avoid breaking callers)
- New return type: `ModuleProgress` per module with fields `{ module, state: 'Missing' | 'Estimated' | 'Verified', percent: number, rowCount: number, estimatedCount: number, verifiedCount: number }`
- Aggregation rules per module:
  - **Missing** = `rowCount === 0`
  - **Estimated** = `rowCount > 0 && estimatedCount > 0 && verifiedCount === 0`
  - **Verified** = `verifiedCount > 0` (any verified row flips the module to Verified)
- Percent calculation: simple heuristic based on `rowCount` relative to module-specific target (e.g. Accounts target = 1+, Income target = 1+, etc.) — first row takes the module to 50%, additional rows approach 100%
- Backward compatible: existing `SetupTray` consumers continue to work

#### A.2 — SetupNextActionPanel component

**Scope**: 2 files (new `components/setup/SetupNextActionPanel.tsx` + mount in `app/dashboard/setup/page.tsx`).
**Depends on**: A.1.
**Deliverables**:
- New `<SetupNextActionPanel />` presentational component
- Consumes `useSetupState()` (extended by A.1)
- Computes the one recommended next action using a deterministic rule:
  1. If no Basiq connection AND no accounts → "Connect your bank" (highest leverage)
  2. Else if Accounts is Missing → "Add your first account"
  3. Else if Income is Missing → "Add your income sources"
  4. Else if Expenses is Missing → "Add your expenses"
  5. Else if any module is Estimated → "Refine your {module} estimates with real data"
  6. Else "All set — your dashboard is ready"
- Prominent card with single CTA, opens the relevant guided flow (from A.7–A.12)
- Mounted at the TOP of `/dashboard/setup` above existing components

#### A.3 — Card prioritisation visual states

**Scope**: 1 file (`components/dashboard/DashboardEmptyStateGrid.tsx`) + small prop addition to `EmptyStateTile.tsx`.
**Depends on**: A.1, A.2.
**Deliverables**:
- New `priority` prop on `<EmptyStateTile />`: `'primary' | 'secondary' | 'dimmed'`
- Grid computes per-tile priority from the SetupNextActionPanel's rule:
  - **Primary (1 tile)** — matches the SetupNextActionPanel recommendation
  - **Secondary (2–3 tiles)** — next in the priority chain
  - **Dimmed** — rest
- Visual treatment:
  - Primary: gradient border, elevated shadow, larger CTA, subtle blue glow
  - Secondary: default styling (unchanged from current)
  - Dimmed: `opacity-60`, smaller font, reduced contrast

#### A.4 — Why-This-Matters copy layer

**Scope**: 1 file (update tile copy map in `DashboardEmptyStateGrid.tsx`).
**Depends on**: A.3.
**Deliverables**:
- Add a `whyThisMatters` field to each tile's copy entry
- New `<EmptyStateTile />` prop: `whyThisMatters?: string`
- Renders as a small muted line below the subtitle with a `→` prefix

**Example copy**:
- Accounts → "See your complete cash position across all institutions"
- Properties → "Unlock equity, LVR, and real-time net worth"
- Income → "Calculate your real savings rate"
- Expenses → "Track your burn and find leaks"
- Investments → "See your portfolio performance"
- Loans → "Track debt-quality scoring and refinance opportunities"

#### A.5 — Confidence state badges

**Scope**: 1 file (`components/dashboard/EmptyStateTile.tsx`).
**Depends on**: A.1, A.3.
**Deliverables**:
- New `confidenceState` prop on `<EmptyStateTile />`: `'Missing' | 'Estimated' | 'Verified'`
- Renders a small badge in the top-right corner of the tile:
  - Missing: no badge (default visual)
  - Estimated: amber badge "Estimated"
  - Verified: emerald badge "Verified"
- Grid wires `confidenceState` from `SetupProgressService` output

#### A.6 — GuidedEntryModal shell primitive

**Scope**: 1 new file (`components/setup/GuidedEntryModal.tsx`).
**Depends on**: —
**Deliverables**:
- New `<GuidedEntryModal />` presentational shell
- Props: `open`, `onClose`, `title`, `steps: GuidedEntryStep[]`, `onComplete`
- Step-based multi-screen modal (same UX as the `/onboarding` wizard but smaller, modal-sized)
- Internal state machine for step index, back/next navigation, submit
- Consistent with `/onboarding` wizard design language (see §8 design standards)
- Mobile-responsive (modal goes full-screen on mobile)

**This is the shell**. The per-module flows (A.7–A.12) plug into it.

#### A.7 — Accounts guided flow

**Scope**: 1 new file (`components/setup/guided/AccountsGuidedFlow.tsx`).
**Depends on**: A.6.
**Deliverables**:
- Composes `<GuidedEntryModal />` with 2–3 steps:
  1. Connect bank (Basiq) OR Manual entry choice
  2. If manual: account type + institution + balance
  3. Confirm and save
- Writes directly to `/api/accounts` (existing endpoint) with `source: MANUAL`
- Rewires the Accounts tile's primary CTA to open this modal instead of deep-linking

#### A.8 — Properties guided flow

**Scope**: 1 new file (`components/setup/guided/PropertiesGuidedFlow.tsx`).
**Depends on**: A.6.
**Deliverables**:
- Composes `<GuidedEntryModal />` with steps:
  1. Property type (Primary / Investment)
  2. Address (optional)
  3. Current value (rough OK)
  4. Loan toggle + minimal loan fields if yes
- Writes to `/api/properties` + `/api/loans` with `source: MANUAL`
- Rewires the Properties tile CTA

#### A.9 — Income guided flow

**Scope**: 1 new file (`components/setup/guided/IncomeGuidedFlow.tsx`).
**Depends on**: A.6.
**Deliverables**:
- Steps:
  1. Income type (Salary / Rental / Other)
  2. Amount + frequency
  3. Optional name/description
- Writes to `/api/income` with `source: MANUAL`

#### A.10 — Expenses guided flow

**Scope**: 1 new file (`components/setup/guided/ExpensesGuidedFlow.tsx`).
**Depends on**: A.6.
**Deliverables**:
- Steps:
  1. Expense category picker
  2. Amount + frequency
  3. Optional name/description
- Writes to `/api/expenses` with `source: MANUAL`

#### A.11 — Investments guided flow

**Scope**: 1 new file (`components/setup/guided/InvestmentsGuidedFlow.tsx`).
**Depends on**: A.6.
**Deliverables**:
- Steps:
  1. Account type (Brokerage / Super / Fund / ETF-Crypto)
  2. Platform + cash balance
  3. Optional first holding (ticker + units + avg price)
- Writes to `/api/investments` with `source: MANUAL`

#### A.12 — Loans guided flow

**Scope**: 1 new file (`components/setup/guided/LoansGuidedFlow.tsx`).
**Depends on**: A.6.
**Deliverables**:
- Steps:
  1. Loan type (Car / Personal / Student / Business)
  2. Principal + interest rate
  3. Repayment amount + frequency
- Writes to `/api/loans` with `source: MANUAL`

### 4.3 Track A dependency graph

```
A.0 (schema)
  ├─ A.1 (service)
  │    ├─ A.2 (NextAction panel)
  │    │    └─ A.3 (card prioritisation)
  │    │         └─ A.4 (why-this-matters)
  │    └─ A.5 (confidence badges)
  └─ A.6 (guided modal shell)
       ├─ A.7 (Accounts flow)
       ├─ A.8 (Properties flow)
       ├─ A.9 (Income flow)
       ├─ A.10 (Expenses flow)
       ├─ A.11 (Investments flow)
       └─ A.12 (Loans flow)
```

A.6 is independent of A.1–A.5 and can be built in parallel.
A.7–A.12 are independent of each other once A.6 lands.

---

## 5. Track B — `/onboarding` New Wizard

**Goal**: build a new top-level `/onboarding` route that delivers a
light, fun, mobile-first, 5-step discovery experience with a Welcome
intro and a Final Reveal payoff. Writes estimated data
(`source: ONBOARDING`) and redirects to `/dashboard/setup` on
completion.

### 5.1 Scope — what changes

**New code:**
- New route tree under `app/onboarding/`
- New component tree under `components/onboarding/linear/`
- New API routes under `app/api/onboarding/estimates/`
- New design-token module under `components/onboarding/linear/design/`

**Does NOT touch:**
- `/dashboard/setup` (Track A handles that separately)
- Any existing financial entity dialog
- The Basiq connect flow (wizard just triggers the existing `POST /api/basiq/connect`)
- `masterFinancialService` (wizard reads but never writes to it)

**Does touch existing:**
- `app/onboarding/page.tsx` — **replaced**. The existing file is the legacy `WizardContainer` in page mode (see Phase 12 v2.2). The new linear wizard replaces it. Legacy wizard still reachable via `/dashboard?legacy=wizard`.

### 5.2 Phase breakdown — B.0 to B.8

#### B.0 — Route scaffolding + layout

**Scope**: 2 new files (`app/onboarding/layout.tsx` + `app/onboarding/page.tsx` replacement).
**Depends on**: A.0 (schema — wizard writes `source: ONBOARDING` rows).
**Deliverables**:
- New `app/onboarding/layout.tsx` — hybrid chrome per Q11:
  - Top bar: Monitrax logotype (left), progress bar (center), exit button (right)
  - No sidebar, no DashboardLayout nesting
  - Full-height centered content area
  - Mobile: top bar collapses to just logotype + progress, exit becomes a small X
- New `app/onboarding/page.tsx` — step router
  - Reads `User.onboardingStep` to determine the initial step
  - Renders the active step component
  - Auth-gated: unauthenticated → redirect to `/signin?next=/onboarding`
  - Already-complete users (`onboardingCompleted === true`) → redirect to `/dashboard/setup`

#### B.1 — Wizard shell + design system

**Scope**: ~7 new files in `components/onboarding/linear/`.
**Depends on**: B.0.
**Deliverables**:
- `design/tokens.ts` — typed token constants: `TYPE_SCALE`, `SPACING`, `DURATIONS`, `EASINGS`
- `primitives/LinearStepShell.tsx` — the one-question-per-screen layout contract
  - Props: `question`, `supporting`, `children` (the input), `feedback`, `cta`, `onBack`
  - Enforces: max-w-[520px] centered, 120px vertical breathing room, single primary CTA, ghost back link
- `primitives/LinearInput.tsx` — premium number/currency/text input with focus ring
- `primitives/LinearPrimaryButton.tsx` — gradient CTA, single variant (no variants)
- `primitives/LinearGhostButton.tsx` — ghost back button
- `primitives/LinearFeedback.tsx` — confirmation line + small emerald checkmark
- `primitives/LinearProgressBar.tsx` — top-of-page progress bar (smooth width transition)
- `primitives/LinearSegmented.tsx` — mobile-friendly segmented control (for Housing step)
- `hooks/useCountUp.ts` — custom requestAnimationFrame-based count-up, ~40 LOC, ease-out cubic, no new dependency
- `styles/linear-wizard.css` — fade-slide-in / fade-slide-out / hero-reveal keyframes, respects `prefers-reduced-motion`

**Acceptance gate**: B.1 ships with one dummy Welcome step so I can visually validate the design system before other steps land. No B.2+ until B.1 visually passes §10.

#### B.2 — Step 0: Welcome

**Scope**: 1 new file (`components/onboarding/linear/steps/WelcomeStep.tsx`).
**Depends on**: B.1.
**Deliverables**:
- Question: "Let's get a quick picture of your finances"
- Supporting: "Takes about 90 seconds. You can refine everything later."
- Primary CTA: "Start guided setup →" (advances to B.3 Household)
- Ghost link: "Skip for now" (routes to `/dashboard/setup`)
- No input — just the intro beat

#### B.3 — Step 1: Household

**Scope**: 2 files (new `components/onboarding/linear/steps/HouseholdStep.tsx` + new `app/api/onboarding/estimates/household/route.ts`).
**Depends on**: B.1, A.0.
**Deliverables**:
- Question: "Who shares finances with you?"
- Input: 3-option segmented control — "Just me" / "Partner" / "Family"
- Optional: partner toggle (if "Partner" or "Family" picked)
- Submit → `POST /api/onboarding/estimates/household`
  - Thin route handler per CLAUDE.md §12.3
  - Calls `lib/services/onboardingEstimateService.ts::upsertHouseholdEstimate()` (new service)
  - Upserts `HouseholdProfile` with `source: ONBOARDING`, `adultsCount` inferred from picked option
  - Audits via `createAuditLog({ action: 'ONBOARDING_STEP_COMPLETED', metadata: { step: 'household' } })`
- Feedback: "Got it — {N} in your household"
- Advances to B.4 Income

#### B.4 — Step 2: Income

**Scope**: 2 files (`IncomeStep.tsx` + `app/api/onboarding/estimates/income/route.ts`).
**Depends on**: B.1, A.0.
**Deliverables**:
- Question: "What comes in each month?"
- Supporting: "Roughly — you can refine this later"
- Input: single currency input (monthly)
- Submit → `POST /api/onboarding/estimates/income`
  - Creates a single Income row: `type: SALARY`, `frequency: MONTHLY`, `source: ONBOARDING`, `amount: <value>`, `name: "Estimated monthly income"`
- Feedback: "That's about ${amount * 12} per year" (count-up)
- Advances to B.5 Housing

#### B.5 — Step 3: Housing

**Scope**: 2 files (`HousingStep.tsx` + `app/api/onboarding/estimates/housing/route.ts`).
**Depends on**: B.1, A.0.
**Deliverables**:
- Question: "Where do you live?"
- Input: 3-option segmented control — "Own" / "Rent" / "With family"
- Submit → `POST /api/onboarding/estimates/housing`
  - Updates `HouseholdProfile.housingSituation` (if schema supports) OR writes to `UserPreference.onboardingDraft.housing`
  - Does NOT create a Property or Expense row at this step — just stores the housing situation for routing decisions
- Feedback:
  - "Own" → "Nice — you can add your property details later"
  - "Rent" → "Got it — we can track your rent as an expense"
  - "With family" → "No worries — we'll skip housing for now"
- Advances to B.6 Expenses

#### B.6 — Step 4: Expenses (optional)

**Scope**: 2 files (`ExpensesStep.tsx` + `app/api/onboarding/estimates/expenses/route.ts`).
**Depends on**: B.1, A.0.
**Deliverables**:
- Question: "Roughly how much do you spend each month?"
- Supporting: "Skip if you're not sure — we can track this from your bank later"
- Input: single currency input + prominent "Skip this step" ghost link
- Submit → `POST /api/onboarding/estimates/expenses`
  - Creates a single Expense row: `category: OTHER`, `frequency: MONTHLY`, `source: ONBOARDING`, `amount: <value>`, `name: "Estimated monthly expenses"`
  - Skip path: no row written
- Feedback: "You're saving about ${income - expenses} per month" (count-up, green if positive, red if negative)
- Advances to B.7 Goal

#### B.7 — Step 5: Goal (optional)

**Scope**: 2 files (`GoalStep.tsx` + `app/api/onboarding/estimates/goal/route.ts`).
**Depends on**: B.1.
**Deliverables**:
- Question: "What matters most to you right now?"
- Input: 3-option segmented control — "Save more" / "Reduce debt" / "Grow wealth"
- Optional: "Skip" ghost link
- Submit → `POST /api/onboarding/estimates/goal`
  - Writes to `UserPreference.onboardingDraft.goal` — no new Prisma model
- Feedback: goal-specific affirmation (e.g., "Love it — we'll tailor your insights to help you save")
- Advances to B.8 Final Reveal

#### B.8 — Step 6: Final Reveal

**Scope**: 2 files (`FinalRevealStep.tsx` + `app/api/onboarding/complete/route.ts` — may already exist, extend if so).
**Depends on**: B.1, B.2–B.7, A.0.
**Deliverables**:
- Dedicated layout variant: darker ambient background, larger type scale
- Reads fresh `masterFinancialSnapshot` via a thin `GET /api/onboarding/estimates/snapshot` wrapper (pure read, uses existing `masterFinancialService`)
- Hero metric (huge): **Net worth** (count-up animation, 1400ms, ease-out cubic)
- Three secondary metrics (count-up, staggered 200ms each):
  - **Monthly savings** (`quickMetrics.monthlyCashflow`)
  - **Debt level** (`debt.summary.total` or similar)
  - **Health grade** (`healthScore.grade` A–F, no count-up — letter reveals with scale + fade)
- One insight line: *"At your current rate, you could save ${monthlyCashflow * 12} in the next 12 months"* (simple math, no Gemini)
- CTA: "Continue setting up →" — marks `User.onboardingCompleted = true`, clears draft, redirects to `/dashboard/setup`
- Fires `createAuditLog({ action: 'ONBOARDING_COMPLETED' })`

**This is the phase with the most design iteration**. Expect 1–2 revision rounds before it's approved.

### 5.3 Track B dependency graph

```
A.0 (schema) ────┐
                 │
B.0 (route) ─────┼─→ B.1 (shell) ──┬─→ B.2 (Welcome)
                 │                 ├─→ B.3 (Household)
                 │                 ├─→ B.4 (Income)
                 │                 ├─→ B.5 (Housing)
                 │                 ├─→ B.6 (Expenses)
                 │                 ├─→ B.7 (Goal)
                 │                 └─→ B.8 (Final Reveal)
```

B.2–B.7 can ship in any order once B.1 lands. B.8 is last (depends
on all prior steps being reachable for end-to-end testing).

### 5.4 API route structure

```
app/api/onboarding/
├── complete/route.ts             # existing — extended in B.8
├── state/route.ts                # existing — unchanged
└── estimates/                    # NEW tree
    ├── household/route.ts        # B.3
    ├── income/route.ts           # B.4
    ├── housing/route.ts          # B.5
    ├── expenses/route.ts         # B.6
    ├── goal/route.ts             # B.7
    └── snapshot/route.ts         # B.8 — thin wrapper around getMasterFinancialSnapshot
```

Each route handler is a thin wrapper per CLAUDE.md §12.3:
- `withPermission('settings.write', …)` guard
- Calls `lib/services/onboardingEstimateService.ts` (new service)
- Returns the standard `{ success, data, error, meta }` envelope
- Fire-and-forget audit log via `createAuditLog`

### 5.5 Service layer — `onboardingEstimateService.ts`

**New file**: `lib/services/onboardingEstimateService.ts`

**Responsibilities:**
- All writes go through this service (never directly from the route handlers)
- Every row written gets `source: ONBOARDING`
- Handles idempotency: if the user re-submits a step (e.g. goes back and edits), the service updates the existing row instead of creating a duplicate
- Emits the audit log entry (the route handler just triggers the service)

**Exported functions:**
- `upsertHouseholdEstimate(userId, input)`
- `upsertIncomeEstimate(userId, input)`
- `upsertHousingEstimate(userId, input)`
- `upsertExpensesEstimate(userId, input)`
- `upsertGoalEstimate(userId, input)`
- `getOnboardingSnapshot(userId)` — thin pass-through to `masterFinancialService`

---

## 6. Track C — Integration + Legacy Cleanup

**Goal**: wire the new `/onboarding` route into the existing entry
points (welcome modal, resume banner) and retire the legacy
`WizardContainer` once the new wizard has been validated against
real traffic.

### 6.1 Phase breakdown — C.0 to C.2

#### C.0 — Welcome modal CTA → `/onboarding`

**Scope**: 1 file (`components/DashboardLayout.tsx`).
**Depends on**: B.8 (the new wizard must be functional end-to-end).
**Deliverables**:
- `handleStartSetup` already routes to `/dashboard/setup` today — change to route to `/onboarding` instead
- Welcome modal's primary CTA label: "Start guided setup →" (unchanged)
- No changes to the modal component itself (per Q10, the welcome modal stays)
- Legacy wizard still reachable via `/dashboard?legacy=wizard` URL escape hatch

#### C.1 — Resume banner routing

**Scope**: 1 file (`components/DashboardLayout.tsx`).
**Depends on**: C.0.
**Deliverables**:
- `handleResumeBannerResume` — change from `router.push('/dashboard/setup')` to `router.push('/onboarding')`
  - The wizard's step router (B.0) reads `User.onboardingStep` to determine the resume step — silent resume per Q5
- `handleResumeBannerStartOver` — already routes to `/dashboard/setup`; keep as-is (start over = abandon wizard, go straight to the workbench)
- The `/dashboard` auto-redirect effect (added earlier in this session) stays, but redirects to `/onboarding` instead of `/dashboard/setup` for incomplete users with draft or dismissed welcome

#### C.2 — Legacy `WizardContainer` cleanup

**Scope**: delete many files. Multi-file PR, exception noted.
**Depends on**: **EXPLICIT USER APPROVAL after end-to-end testing of Tracks A + B + C.0/C.1**.
**Deliverables** (deletions only, no new code):
- Delete `components/onboarding/wizard/WizardContainer.tsx`
- Delete all 10 step files under `components/onboarding/wizard/steps/`
- Delete all wizard primitives under `components/onboarding/wizard/primitives/`
- Delete `components/onboarding/wizard/types.ts` (wizard-specific types only; shared `WizardData` type preserved if consumed elsewhere)
- Delete `components/onboarding/AIHelper.tsx` if wizard-only
- Delete `app/api/onboarding/bulk-create/route.ts` if no other caller (grep confirms)
- Delete `components/onboarding/OnboardingResumeBanner.tsx` if unused after C.1 (it may still be mounted — verify first)
- Delete `styles/wizard-animations.css` if nothing else imports it
- Delete `app/onboarding/basiq-callback/page.tsx` if wizard-only
- Delete `components/onboarding/index.ts` re-exports that no longer resolve

**CRITICAL**: this phase is paused until:
1. Track A is merged and production-tested for 1+ week
2. Track B is merged and production-tested for 1+ week
3. No rollback reports on the `?legacy=wizard` escape hatch
4. Explicit user go-ahead in the plan's changelog

---

## 7. Track D — Design QA Pass (Mandatory §10.6)

**Goal**: formal quality audit of the entire twin-surface
experience before any legacy cleanup ships.

### 7.1 D.0 — Design quality audit

**Scope**: 1 file (`docs/quality/PHASE_12_DESIGN_AUDIT.md` — new audit artefact).
**Depends on**: all of Track A + Track B merged.
**Deliverables**:

Walk through the full experience front-to-back on production:

1. **Fresh user signup path**:
   `/signin → signup → welcome modal → /onboarding → B.2 Welcome → B.3 Household → B.4 Income → B.5 Housing → B.6 Expenses → B.7 Goal → B.8 Final Reveal → /dashboard/setup → refine via guided modals → /dashboard`

2. **Returning incomplete user path**:
   `/dashboard → auto-redirect to /onboarding (silent resume at last step) → finish → /dashboard/setup`

3. **Skipping the wizard path**:
   `welcome modal → "Skip for now" → /dashboard/setup (no estimated data) → all tiles show Missing → guided modals capture real data`

4. **Escape hatch path**:
   `/dashboard?legacy=wizard → legacy WizardContainer → complete → /dashboard`

For each path, evaluate against §10.6's mandatory quality check:

- Does this feel like a premium fintech product?
- Is there any unnecessary friction?
- Is any screen visually cluttered?
- Are transitions smooth and consistent?
- Does the final reveal feel meaningful?
- Is the /dashboard/setup refinement flow clear and prioritised?

Compare side-by-side against benchmark captures of Apple, Stripe,
Wealthfront, Notion onboarding flows. Screenshot every step.

**Produce a written audit** at `docs/quality/PHASE_12_DESIGN_AUDIT.md` listing:
- Every weakness identified (copy, spacing, motion, hierarchy, clutter)
- A proposed fix per weakness
- Severity rating: P0 blocker / P1 must-fix / P2 polish

Then either:
- Ship the P0 + P1 fixes on a follow-up branch **before** C.2 cleanup
- OR defer explicitly with a tracked reason and approval

### 7.2 Success criteria for D.0

D.0 passes only when **all of these are true**:

- [ ] Every step in both surfaces renders without clutter
- [ ] All transitions use ~200–300ms ease-out cubic (no bounce)
- [ ] Number count-ups fire on Final Reveal and on per-step feedback
- [ ] Progress bar updates smoothly
- [ ] Dark mode works across both surfaces
- [ ] `prefers-reduced-motion: reduce` disables all animations cleanly
- [ ] Mobile (375px, 414px, 768px) renders without horizontal scroll
- [ ] No "developer-level UI" — no debug badges, no version pills, no default Shadcn form chrome leaking through
- [ ] Final Reveal is visibly stronger than every prior step
- [ ] Entire wizard flow completes in ≤ 90 seconds for a fresh user

---

## 8. Design Standards (§10 — Binding)

These are **binding** constraints on every Track A and Track B
phase. If I can't tick every box in the per-phase PR, I iterate
before handing the PR to you.

### 8.1 Visual design

- **Strong typographic hierarchy**: wizard type scale is separate from dashboard tokens. Title ~48px, supporting text ~16px, input label ~14px. Headlines use `tracking-tight` with `letter-spacing: -0.02em`.
- **Generous spacing**: per-step layout has min ~120px vertical breathing room top and bottom. Content `max-w-[520px]` centered — NOT the dashboard's 7xl container.
- **Minimal UI per screen**: one title + one supporting line + one input + one feedback moment + one primary CTA. Nothing else.
- **High-contrast primary actions**: single gradient CTA per screen, `from-blue-500 via-indigo-500 to-violet-500`, `shadow-[0_20px_40px_-12px_rgba(99,102,241,0.5)]`.
- **Consistent layout grid**: every step composes `<LinearStepShell />`. Individual steps cannot drift.
- **Clean inputs**: `<LinearInput />` with focus ring, currency/number variants. No default Shadcn form chrome.
- **Avoid clutter at all costs**: no sidebar in the wizard, no progress badges competing with the primary action.

### 8.2 Motion + transitions

- **Step-to-step transitions**: `~200–300ms` fade + slight vertical slide. Exit: `translateY(-8px) + opacity 0`. Enter: `translateY(8px) + opacity 0 → 0 + 1`. CSS keyframes, no library.
- **Number count-ups**: custom `useCountUp` hook, `requestAnimationFrame`-based, ease-out cubic. 600–800ms for per-step feedback (responsive), 1000–1400ms for Final Reveal (weighted).
- **Progress bar**: smooth width transition `400ms cubic-bezier(0.22, 1, 0.36, 1)`.
- **No bounce**. **No spring**. **No decorative animations.**
- **`prefers-reduced-motion`** honoured on every animation via Tailwind `motion-reduce:` variants.

### 8.3 Micro-interactions

Every step has at least one micro-feedback moment:
- Number updates after input (count-up)
- Confirmation text: "Nice — that's your income sorted", "Got it — we'll refine this later"
- Progress bar advancement on step change

Feedback must feel **responsive, smooth, satisfying**. Never slow, never skipped.

### 8.4 Final Reveal — most important moment

- Dedicated layout variant (darker ambient background)
- Hero typography: net worth at 96–120px
- Two-column metric grid below (monthly savings | debt level | health grade)
- Insight card at the bottom with subtle indigo glow
- Staggered entry animation (`~1600ms total`, each metric ~200ms delayed)
- Visibly different quality step from every prior screen
- The user must feel: **"This is already useful."**

### 8.5 Consistency

- Inherits Monitrax gradient tokens (blue → indigo → violet) so the wizard feels integrated
- Reuses Shadcn components **only where they don't leak default developer-level UI** — inputs, buttons, segmented controls on the wizard are bespoke primitives
- `/dashboard/setup` refinements reuse existing tokens and component library (it's a dashboard surface, not a take-over)

### 8.6 What I will NOT do (§10.7 guardrails)

- ❌ Shadcn defaults in the wizard (dashboard OK)
- ❌ Multi-column layouts on any wizard step
- ❌ Icons as decoration (only where they carry meaning)
- ❌ Bounce / spring easings
- ❌ Loading spinners on step transitions (pending state keeps the old value visible until new feedback fades in)
- ❌ Developer chrome (debug labels, tech badges, version pills)
- ❌ Generic empty-state illustrations — typography only on wizard, bespoke SVG on dashboard tiles (already done)

### 8.7 Per-phase design acceptance gate

Every Track A and Track B UI PR must include, in the PR body:
- A screenshot or loom of the component rendering
- A self-review checklist against §8.1–§8.5
- A section noting any deviation from the standards with justification

If I can't tick every box, I iterate before requesting review.

---

## 9. Data Flow Diagrams

### 9.1 First-time user — happy path

```
┌─────────────┐
│  Signup     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│  /dashboard             │
│  ↓                      │
│  <OnboardingWelcomeModal│
│   greets, not wizard>   │
└──────┬──────────────────┘
       │ "Start guided setup →"
       ▼
┌─────────────────────────────────────────┐
│  /onboarding (new top-level route)      │
│                                         │
│  B.2 Welcome      (intro, no input)     │
│     ↓                                   │
│  B.3 Household    → POST estimates/household (source: ONBOARDING)
│     ↓                                   │
│  B.4 Income       → POST estimates/income    (source: ONBOARDING)
│     ↓                                   │
│  B.5 Housing      → POST estimates/housing   (source: ONBOARDING)
│     ↓                                   │
│  B.6 Expenses     → POST estimates/expenses  (source: ONBOARDING)
│     ↓           (skippable)             │
│  B.7 Goal         → POST estimates/goal      (UserPreference)
│     ↓           (skippable)             │
│  B.8 Final Reveal → GET estimates/snapshot (reads masterFinancialService)
│     ↓           animated reveal         │
│     ↓           "Continue setting up →" │
└──────┬──────────────────────────────────┘
       │ POST /api/onboarding/complete
       ▼               (onboardingCompleted = true)
┌─────────────────────────────────────────┐
│  /dashboard/setup                       │
│                                         │
│  <SetupNextActionPanel />               │
│   ↓ "Next Step: Connect your bank"     │
│                                         │
│  <SetupTray />                          │
│   Accounts: Estimated 20%               │
│   Income:   Estimated 30%               │
│   Expenses: Estimated 25%               │
│   Loans:    Missing                     │
│   Assets:   Missing                     │
│                                         │
│  <DashboardEmptyStateGrid />            │
│   [PRIMARY tile]  [secondary] [secondary]│
│   [dimmed]        [dimmed]    [dimmed]  │
│                                         │
│   Each tile shows:                      │
│     title + why-this-matters            │
│     confidence badge (Estimated/Missing)│
│     CTA → opens <GuidedEntryModal />    │
└─────────────────────────────────────────┘
```

### 9.2 Returning incomplete user — silent resume

```
┌─────────────┐
│  Signin     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  /dashboard                             │
│                                         │
│  auto-redirect effect fires if:         │
│    !onboardingCompleted                 │
│    && !hasExistingData                  │
│    && (dismissedWelcomeModal OR draft)  │
│    && !?legacy=wizard                   │
└──────┬──────────────────────────────────┘
       │ router.push('/onboarding')
       ▼
┌─────────────────────────────────────────┐
│  /onboarding                            │
│                                         │
│  step router reads User.onboardingStep  │
│    if step=3, jump to B.5 Housing       │
│    user resumes silently, no modal      │
└─────────────────────────────────────────┘
```

### 9.3 Data write path — `/onboarding` step to database

```
<HouseholdStep />
   │
   │ user picks "Partner"
   │ clicks Continue
   ▼
POST /api/onboarding/estimates/household
   │
   │ withPermission('settings.write', ...)
   ▼
onboardingEstimateService.upsertHouseholdEstimate(userId, input)
   │
   ├──▶ prisma.householdProfile.upsert({
   │       where: { userId },
   │       create: { ..., source: 'ONBOARDING' },
   │       update: { ..., source: 'ONBOARDING' }
   │    })
   │
   ├──▶ prisma.user.update({
   │       where: { id: userId },
   │       data: { onboardingStep: 3 }  // silent resume state
   │    })
   │
   └──▶ createAuditLog({
          action: 'ONBOARDING_STEP_COMPLETED',
          metadata: { step: 'household' }  // no CDR data
       })
   │
   ▼
Route handler re-fetches fresh masterFinancialSnapshot
   │
   ▼
Response: { success: true, data: { ...snapshot }, meta }
   │
   ▼
<HouseholdStep /> shows feedback: "Got it — 2 in your household"
   │ advances to <IncomeStep />
```

### 9.4 Data read path — `/dashboard/setup` rendering

```
<DashboardSetupPage />
   │
   ▼
useSetupState() (C.1 hook, extended)
   │
   │ GET /api/setup/state
   ▼
setupStateService.getSetupState(userId)
   │
   ├──▶ getMasterFinancialSnapshot(userId)
   │        returns counts + live metrics
   │
   ├──▶ for each module (accounts/income/expenses/loans/assets):
   │       countEstimated = count rows where source='ONBOARDING'
   │       countVerified  = count rows where source IN ('MANUAL','BASIQ','IMPORT')
   │       derive state:  Missing | Estimated | Verified
   │       derive percent: heuristic based on rowCount
   │
   └──▶ computeNextBestAction(progress):
          priority chain → single recommendation
   │
   ▼
Response: { tasks, moduleProgress, nextBestAction, progress }
   │
   ▼
<SetupNextActionPanel />  reads .nextBestAction
<SetupTray />             reads .moduleProgress
<DashboardEmptyStateGrid /> reads .moduleProgress + derives priority per tile
```

---

## 10. Files: Stay / Extend / Delete

### 10.1 Files that STAY (no changes, no deletions)

| File | Role | Why it stays |
|---|---|---|
| `app/dashboard/setup/page.tsx` | /dashboard/setup page entry | Refined, not rebuilt — per directive §1 |
| `components/onboarding/OnboardingWelcomeModal.tsx` | First-visit greeting modal | Per Q10 — still the right first-contact beat |
| `components/setup/SetupTray.tsx` | Collapsible progress checklist | Extended by A.1, not replaced |
| `components/dashboard/BasiqHeroCard.tsx` | Basiq connect hero on setup page | Auto-hides once connected, unchanged |
| `components/dashboard/DashboardEmptyStateGrid.tsx` | 6 setup cards | Extended by A.3–A.5, not replaced |
| `components/dashboard/EmptyStateTile.tsx` | Shared tile shell | Extended by A.3–A.5 with new props |
| `hooks/useSetupState.ts` | Client hook | Extended output shape, same fetch pattern |
| `app/api/setup/state/route.ts` | Setup state API | Extended response, same route |
| `lib/setup/tasks.ts` | Task registry | Extended metadata, same shape |
| `lib/setup/v3Flag.ts` | Feature flag helper | Kept for `?legacy=wizard` escape hatch |
| `lib/services/masterFinancialService.ts` | Financial calculation engine | **UNCHANGED** — canonical per §12.2 |
| `prisma/schema.prisma` | Database schema | Touched only in A.0 for `EntrySource` enum |

### 10.2 Files that get EXTENDED (edits only)

| File | Track | Change |
|---|---|---|
| `components/DashboardLayout.tsx` | C.0, C.1 | Wire welcome modal + resume banner to `/onboarding` |
| `components/dashboard/DashboardEmptyStateGrid.tsx` | A.3, A.4, A.5 | Priority + why-this-matters + confidence props |
| `components/dashboard/EmptyStateTile.tsx` | A.3, A.4, A.5 | New props for priority state, whyThisMatters, confidenceState |
| `components/setup/SetupTray.tsx` | A.1 | Per-module Missing/Estimated/Verified rendering |
| `hooks/useSetupState.ts` | A.1 | Consume extended service response |
| `lib/services/setupStateService.ts` | A.1 | Extended return type + module progress logic |
| `lib/setup/tasks.ts` | A.1 | Task metadata extensions |
| `app/api/setup/state/route.ts` | A.1 | Extended response shape |
| `app/dashboard/setup/page.tsx` | A.2 | Mount `<SetupNextActionPanel />` at top |
| `prisma/schema.prisma` | A.0 | Add `EntrySource` enum + `source` column on 9 models |

### 10.3 Files that are NEW

**Track A (new):**
- `components/setup/SetupNextActionPanel.tsx` (A.2)
- `components/setup/GuidedEntryModal.tsx` (A.6)
- `components/setup/guided/AccountsGuidedFlow.tsx` (A.7)
- `components/setup/guided/PropertiesGuidedFlow.tsx` (A.8)
- `components/setup/guided/IncomeGuidedFlow.tsx` (A.9)
- `components/setup/guided/ExpensesGuidedFlow.tsx` (A.10)
- `components/setup/guided/InvestmentsGuidedFlow.tsx` (A.11)
- `components/setup/guided/LoansGuidedFlow.tsx` (A.12)

**Track B (new):**
- `app/onboarding/layout.tsx` (B.0)
- `app/onboarding/page.tsx` (B.0 — replaces legacy wizard page mode)
- `components/onboarding/linear/design/tokens.ts` (B.1)
- `components/onboarding/linear/primitives/LinearStepShell.tsx` (B.1)
- `components/onboarding/linear/primitives/LinearInput.tsx` (B.1)
- `components/onboarding/linear/primitives/LinearPrimaryButton.tsx` (B.1)
- `components/onboarding/linear/primitives/LinearGhostButton.tsx` (B.1)
- `components/onboarding/linear/primitives/LinearFeedback.tsx` (B.1)
- `components/onboarding/linear/primitives/LinearProgressBar.tsx` (B.1)
- `components/onboarding/linear/primitives/LinearSegmented.tsx` (B.1)
- `components/onboarding/linear/hooks/useCountUp.ts` (B.1)
- `styles/linear-wizard.css` (B.1)
- `components/onboarding/linear/steps/WelcomeStep.tsx` (B.2)
- `components/onboarding/linear/steps/HouseholdStep.tsx` (B.3)
- `components/onboarding/linear/steps/IncomeStep.tsx` (B.4)
- `components/onboarding/linear/steps/HousingStep.tsx` (B.5)
- `components/onboarding/linear/steps/ExpensesStep.tsx` (B.6)
- `components/onboarding/linear/steps/GoalStep.tsx` (B.7)
- `components/onboarding/linear/steps/FinalRevealStep.tsx` (B.8)
- `lib/services/onboardingEstimateService.ts` (new — §5.5)
- `app/api/onboarding/estimates/household/route.ts` (B.3)
- `app/api/onboarding/estimates/income/route.ts` (B.4)
- `app/api/onboarding/estimates/housing/route.ts` (B.5)
- `app/api/onboarding/estimates/expenses/route.ts` (B.6)
- `app/api/onboarding/estimates/goal/route.ts` (B.7)
- `app/api/onboarding/estimates/snapshot/route.ts` (B.8)

**Track D (new):**
- `docs/quality/PHASE_12_DESIGN_AUDIT.md` (D.0)

### 10.4 Files that get DELETED (C.2 cleanup only)

**Paused until user gives explicit go-ahead after D.0 design QA passes.**

- `components/onboarding/wizard/WizardContainer.tsx`
- `components/onboarding/wizard/steps/*.tsx` (all 10 files)
- `components/onboarding/wizard/primitives/*.tsx` (wizard-only primitives)
- `components/onboarding/wizard/types.ts` (wizard-only types)
- `components/onboarding/AIHelper.tsx` (if wizard-only)
- `app/api/onboarding/bulk-create/route.ts` (if no remaining callers)
- `components/onboarding/OnboardingResumeBanner.tsx` (if unused after C.1)
- `styles/wizard-animations.css` (if no remaining importers)
- `app/onboarding/basiq-callback/page.tsx` (if wizard-only)

---

## 11. Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Prisma migration A.0 is hard to reverse | **High** | Tag pre-migration commit; keep migration additive (new enum + nullable-defaulted column); test on staging first |
| R2 | `source` enum conflicts with existing `Account.balanceSource` enum | **Medium** | The two are semantically different (`balanceSource` = provenance of the **balance value**, `source` = provenance of the **row**). Both coexist on Account. No renaming. |
| R3 | Partial setup state creates confused users (estimated rows scattered across real tables) | **Medium** | Every estimated row shows a clear "Estimated" badge on `/dashboard/setup` and in entity detail pages. Not hiding — labelling. |
| R4 | `masterFinancialService` includes `ONBOARDING`-tagged rows in aggregates, skewing net worth on the Final Reveal | **Low** | **Intentional** — those rows ARE the user's best guess. The Final Reveal is explicitly framed as "at your current rate" so estimates are appropriate inputs. |
| R5 | Legacy `WizardContainer` deletion in C.2 leaves dangling imports | **Medium** | Delete only after D.0 validates. Run `tsc --noEmit` before merge. |
| R6 | `/app/onboarding/page.tsx` replacement breaks the legacy wizard page mode | **Low** | Legacy wizard accessed via `/dashboard` welcome modal (modal mode) is preserved; only the `/app/onboarding` page mode is replaced. Escape hatch `/dashboard?legacy=wizard` still opens the modal. |
| R7 | Track A refinements collide with Track B in progress | **Low** | Tracks are independent (different files). Only shared file is `prisma/schema.prisma` (A.0) which blocks both. |
| R8 | `GuidedEntryModal` shell over-abstracted, breaks on per-module needs | **Medium** | A.6 ships with one concrete consumer (A.7 Accounts) as acceptance test. Shell changes if the test breaks. |
| R9 | Final Reveal animation performance on low-end devices | **Low** | All animations CSS-keyframe based, no JS timing loops. `prefers-reduced-motion` disables them entirely. |
| R10 | Wizard Q&A decisions drift across sessions without this doc as anchor | **Medium** | This doc is the single source of truth. Every PR body links back to the phase. Plan changes go in the §14 changelog first. |
| **R11** | **`upsertHouseholdEstimate` overwrites existing `HouseholdProfile.adultsCount` / `childrenCount`** when the wizard runs against a user who already has a configured household. The function is in `lib/services/onboardingEstimateService.ts` (shipped via PR #520). The destructive update branch overwrites the composition fields with whatever the wizard's 3-option picker maps to (`SELF` = 1/0, `PARTNER` = 2/0, `FAMILY` = 2/1). Any extra adults / children / lifestyle preferences a user previously set are lost. | **HIGH → MITIGATED 2026-04-15** | ✅ PR #524 stubbed the entire `onboardingEstimateService` — every write function now throws `OnboardingDisabledError` instead of calling Prisma. The destructive code path is structurally unreachable. Re-enablement must ship via a new PR that adds a `source === 'ONBOARDING'` guard, fills in the CLAUDE.md §12.11 checklist, and receives explicit user confirmation before merge. |
| **R12** | **Data loss incident reported 2026-04-15** — `rayanmehr79@gmail.com`'s dashboard rendered blank after the Phase 12 A.0 PRs landed. Row-count queries against both DBs confirmed the data was **still intact** (3 accounts, 5 properties, 4 loans, 6 income, 57 expenses, 3 investments, 1 household). Audit log showed zero `ENTITY_DELETED` events. The symptom was a read-path crash: Phase 12 A.0 added a `source` column to 9 models in `schema.prisma`, but neither Cloud SQL instance had a `_prisma_migrations` table (they were created outside Prisma migrate during the Render→GCP move and had been drifting ever since). `prisma migrate deploy` was never run, so the DB lacked the column the deployed Prisma client expected. Every `findMany` generated `SELECT ..., source FROM accounts` which crashed with `column "source" does not exist`, and API routes caught the error and returned empty responses. | **CRITICAL → RESOLVED 2026-04-15** | ✅ Full remediation shipped in one session: PR #523 (CLAUDE.md §12.11 destructive-write checklist), PR #524 (hotfix — revert `source` columns + stub destructive service), PR #525 (baseline runbook + orphaned migration deletion), PR #526 (`vercel-build` script auto-applies `prisma migrate deploy` on every build + CLAUDE.md §12.12 schema change deploy protocol). Manual one-time SQL baseline executed against both DBs creating `_prisma_migrations` and marking `0_init` applied. Both Vercel builds now succeed end-to-end through the new pipeline. Schema drift is structurally impossible going forward. See `docs/quality/PHASE_12_DESIGN_AUDIT.md` §11.1 for the full post-mortem. |

---

## 12. Validation Checklist

Per the directive §6, before any phase is considered complete the
following must all be true. Each PR body links back to this list
and ticks the boxes relevant to its scope.

### 12.1 System-wide (every PR must satisfy)

- [ ] **No duplicate flows** — the same onboarding action is not reachable from two competing code paths
- [ ] **No broken navigation** — every link/CTA lands on a real route that renders successfully
- [ ] **No overwritten data** — existing rows are never clobbered by onboarding writes; estimates are additive, not destructive
- [ ] **No regression in existing features** — `/dashboard`, entity pages, and Basiq flows all still work as before
- [ ] **`/dashboard/setup` still fully functional** — every existing component renders and every existing CTA works
- [ ] **`npm run build` passes** locally or in CI
- [ ] **No new TypeScript errors**
- [ ] **No new lint warnings introduced**

### 12.2 Track A-specific (refinement phases)

- [ ] **A.0** — Prisma migration applied cleanly on staging, existing rows backfilled to `MANUAL`, no data loss
- [ ] **A.1** — `SetupProgressService` returns correct Missing/Estimated/Verified state for every module, verified against test fixtures
- [ ] **A.2** — `<SetupNextActionPanel />` renders the correct recommendation for all 6 decision branches (no data → connect bank; has accounts, no income → add income; etc.)
- [ ] **A.3** — Exactly one primary tile, 2–3 secondary, rest dimmed. Primary tile matches the SetupNextActionPanel recommendation.
- [ ] **A.4** — Every tile has a Why-This-Matters line. Copy is end-user voice, not developer voice.
- [ ] **A.5** — Confidence badge matches the underlying row data. Missing/Estimated/Verified transitions work.
- [ ] **A.6** — `<GuidedEntryModal />` shell ships with A.7 as its acceptance test. Keyboard navigation + mobile responsive verified.
- [ ] **A.7–A.12** — Each guided flow writes to the correct API endpoint with `source: MANUAL`. Cancellation mid-flow does not write partial rows.

### 12.3 Track B-specific (wizard phases)

- [ ] **B.0** — `/onboarding` auth-gates unauthenticated users to `/signin?next=/onboarding`. Completed users redirect to `/dashboard/setup`.
- [ ] **B.1** — Wizard shell visually passes §8 design standards. No Shadcn defaults leaking through. Design system token module is self-contained.
- [ ] **B.2–B.7** — Each step:
  - [ ] Renders one question, one input, one primary CTA, one feedback moment
  - [ ] Writes data with `source: ONBOARDING`
  - [ ] Shows immediate feedback with count-up animation (where numeric)
  - [ ] Updates `User.onboardingStep` atomically with the data write
  - [ ] Emits `ONBOARDING_STEP_COMPLETED` audit log with sanitized metadata (no CDR data)
  - [ ] `Back` button returns to the previous step without losing state
- [ ] **B.8 Final Reveal** —
  - [ ] Reads fresh `masterFinancialSnapshot` via `GET /api/onboarding/estimates/snapshot`
  - [ ] Net worth hero animates via count-up (1000–1400ms, ease-out cubic)
  - [ ] Three secondary metrics stagger in (200ms delay each)
  - [ ] Insight line renders with correct math (`monthlyCashflow * 12`)
  - [ ] "Continue setting up →" CTA marks `onboardingCompleted` and redirects to `/dashboard/setup`
  - [ ] Visibly stronger than every prior step (§10.4 check)

### 12.4 Track C-specific (integration + cleanup)

- [ ] **C.0** — Welcome modal "Start guided setup →" routes to `/onboarding` (not legacy wizard). Legacy wizard still reachable via `/dashboard?legacy=wizard`.
- [ ] **C.1** — Resume banner Resume CTA routes to `/onboarding`. Start over clears draft + routes to `/dashboard/setup`. `/dashboard` auto-redirect effect routes incomplete users to `/onboarding`.
- [ ] **C.2** — Legacy wizard deletion:
  - [ ] Run `grep -r "WizardContainer" --include="*.tsx" --include="*.ts"` — no unresolved references
  - [ ] Run `tsc --noEmit` — no dangling import errors
  - [ ] `/dashboard?legacy=wizard` URL no longer reaches anything (the escape hatch expires with the wizard)
  - [ ] All Phase A bug fixes are preserved in git history for reference

### 12.5 Track D-specific (design QA)

- [ ] **D.0** — Walk-through screenshots captured for all 4 paths (fresh user, returning incomplete, skipper, escape hatch)
- [ ] **D.0** — Every §8.1–§8.5 standard verified against every step
- [ ] **D.0** — `docs/quality/PHASE_12_DESIGN_AUDIT.md` produced with P0/P1/P2 severity ratings
- [ ] **D.0** — All P0 + P1 fixes shipped or explicitly deferred with tracked reason
- [ ] **D.0** — Full wizard flow completes in ≤ 90 seconds on a fresh user

### 12.6 CDR compliance per CLAUDE.md §13.3

- [ ] Every onboarding write is audited via `createAuditLog` with sanitized metadata (no amounts, no balances, no BSBs)
- [ ] `onboardingEstimateService` never logs the values the user typed
- [ ] Gemini "Need help?" (if enabled) never receives CDR-classified data in its prompts
- [ ] Estimated data written to real tables is clearly marked as `source: ONBOARDING` so downstream consumers can treat it appropriately

---

## 13. Progress Tracker

Updated after every merged PR. All phases ⬜ until work begins.

### Track A — `/dashboard/setup` refinement

| Phase | Description | Status | PR |
|---|---|---|---|
| A.0 | Prisma schema: `EntrySource` enum + `source` column on 9 models | 🔴 **REVERTED** (#524, see R12) — must be re-applied via a new migration | #511 → #524 |
| A.1 | `SetupProgressService` extension | 🟡 **Partially reverted** — `buildModuleProgress` source-filter count queries removed in #524 (estimated counts hard-coded to 0 until A.0 re-applies) | #512 → #524 |
| A.2 | `<SetupNextActionPanel />` component | ✅ Merged | #513 |
| A.3 | Card prioritisation visual states | ✅ Merged | #513 |
| A.4 | Why-This-Matters copy layer | ✅ Merged | #513 |
| A.5 | Confidence state badges | 🟡 **All rows currently render as Verified/Missing** — Estimated amber badges will return when A.0 is re-applied | #513 |
| A.6 | `<GuidedEntryModal />` shell primitive | 🟡 Stacked, not on main | #514 (orphaned — needs rescue PR) |
| A.7 | Accounts guided flow | 🟡 Stacked, not on main | #514 |
| A.8 | Properties guided flow | 🟡 Stacked, not on main | #514 |
| A.9 | Income guided flow | 🟡 Stacked, not on main | #514 |
| A.10 | Expenses guided flow | 🟡 Stacked, not on main | #514 |
| A.11 | Investments guided flow | 🟡 Stacked, not on main | #514 |
| A.12 | Loans guided flow | 🟡 Stacked, not on main | #514 |

### Track B — `/onboarding` new wizard

| Phase | Description | Status | PR |
|---|---|---|---|
| B.0 | Route scaffolding + layout | ✅ Merged | #515 |
| B.1 | Wizard shell + design system (~11 files) | ✅ Merged | #515 |
| B.2 | Step 0: Welcome | ✅ Merged | #515 |
| B.3 | Step 1: Household | 🟡 **UI intact, writes disabled** (#524 stubbed `upsertHouseholdEstimate`) | #520 → #524 |
| B.4 | Step 2: Income | 🟡 **UI intact, writes disabled** | #520 → #524 |
| B.5 | Step 3: Housing | 🟡 **UI intact, writes disabled** | #520 → #524 |
| B.6 | Step 4: Expenses (optional) | 🟡 **UI intact, writes disabled** | #520 → #524 |
| B.7 | Step 5: Goal (optional) | 🟡 **UI intact, writes disabled** | #520 → #524 |
| B.8 | Step 6: Final Reveal | ✅ Merged — read-only, not affected by the #524 revert | #520 |
| B.x — auth header fix | Add `Authorization: Bearer ${token}` to all 6 step fetches | ✅ Merged | #521 |

### Track C — Integration + legacy cleanup

| Phase | Description | Status | PR |
|---|---|---|---|
| C.0 | Welcome modal CTA → `/onboarding` | ✅ Merged | #518 |
| C.1 | Resume banner + auto-redirect routing | ✅ Merged | #518 |
| C.2 | Legacy `WizardContainer` deletion (⏸ paused until D.0 green) | ⏸ Paused | — |

### Track D — Design QA

| Phase | Description | Status | PR |
|---|---|---|---|
| D.0 | §10.6 design quality audit + `docs/quality/PHASE_12_DESIGN_AUDIT.md` | ✅ Doc merged (audit walkthrough not yet performed) | #519 |

### Track E — R12 incident remediation (2026-04-15, not originally planned)

| Phase | Description | Status | PR |
|---|---|---|---|
| E.0 | CLAUDE.md §12.11 destructive-write checklist (non-negotiable rule) | ✅ Merged | #523 |
| E.1 | **Hotfix** — revert Phase 12 A.0 `source` columns from schema + stub destructive `onboardingEstimateService` + remove source-filter count queries in `setupStateService` | ✅ Merged | #524 |
| E.2 | Prisma baseline runbook (`docs/operational/database/04_PRISMA_MIGRATION_BASELINE.md`) + `scripts/baseline-prisma-migrations.sh` + orphaned `1_add_entry_source_enum/` migration folder deleted | ✅ Merged | #525 |
| E.3 | `vercel-build` script in `package.json` that runs `prisma migrate deploy` before every build + CLAUDE.md §12.12 schema change deploy protocol + updated `02_VERCEL_DEPLOYMENT.md` and `03_DATABASE_MIGRATIONS.md` | ✅ Merged | #526 |
| E.4 | Manual one-time SQL baseline executed in Cloud SQL Studio against both `monitrax-db-dev` (35.189.31.209) and `monitrax-db-prod` (35.197.180.137): `CREATE TABLE "_prisma_migrations" + INSERT row marking 0_init applied with correct SHA256 checksum (`abc16efe...`) | ✅ Executed | (manual, no PR) |

### Summary bar

```
Total phases:        26 (+1 hotfix B.x) + 5 remediation phases (E.0–E.4)
On main:             13 active (A.2–A.5, B.0–B.2, B.8, B.x, C.0–C.1, D.0 doc)
On main but disabled: 5 (B.3–B.7 — UI intact, writes stubbed pending A.0 re-apply)
Partially reverted:  2 (A.0 schema, A.1 est counts)
Stacked, not on main: 7 (A.6–A.12 guided flows — #514 orphaned, rescue pending)
Paused:               1 (C.2 — blocks on D.0 audit walkthrough sign-off)
Open incidents:       0 (R12 closed 2026-04-15)
```

### Outstanding work

1. **Re-apply Phase 12 A.0** (hardened) — ship a new PR with a fresh migration folder (e.g. `2_phase12_entry_source_hardened/`) containing the additive `CREATE TYPE` + `ALTER TABLE ... ADD COLUMN source` statements, plus the restored `source` fields in `schema.prisma`, plus the §12.11-compliant `source === 'ONBOARDING'` guard on `upsertHouseholdEstimate` and `upsertHousingEstimate`. Must fill in the §12.11 checklist in the PR body and receive explicit user confirmation before merge. Vercel pipeline will auto-apply the migration to prod on merge.
2. **Re-enable wizard writes** — once A.0 re-applies, remove the `OnboardingDisabledError` stubs in `onboardingEstimateService` and restore the real write logic (with the hardened guards in place).
3. **Resolve #514 stacked-PR orphan** — Track A.6–A.12 (`GuidedEntryModal` + 6 guided flows) was merged into a stacked parent branch instead of `main`, same way #516/#517 were. A rescue PR (similar pattern to #520) needs to bring those 7 phases onto `main`. Also check the guided flows for the same auth-header bug that #521 fixed in the linear wizard.
4. **Audit walkthrough (D.0)** — Reza walks the 4 paths in `docs/quality/PHASE_12_DESIGN_AUDIT.md` end-to-end and signs off in §9, which unblocks Track C.2 cleanup. Can run BEFORE the A.0 re-application as long as Path A/B are deferred in the weakness register.
5. **Track C.2 legacy cleanup** — paused until D.0 sign-off.

---

## 14. Changelog

| Date | Change | Author |
|---|---|---|
| 2026-04-15 | **Plan created.** Twin-track architecture locked in per directive 2026-04-15. Q1–Q11 decisions documented in §2. Q12 (Final Reveal) defaulted to "yes". Option A source enum chosen in §3. Tracks A–D defined in §4–§7. §10 design standards carried over from the prior linear-wizard plan and made binding. | Claude |
| 2026-04-15 | **Archive:** `docs/blueprint/PHASE_12_REDESIGN_V3.md` moved to `docs/archive/blueprint/` with a SUPERSEDED banner explaining what still applies (Phase A bug fixes, Phase B foundation pipeline, Phase C components, Gemini deferral) vs what was reverted (SetupTray in DashboardLayout chrome, /dashboard isEmpty replacement, NEXT_PUBLIC_ONBOARDING_V3 default flip, Phase G wholesale cleanup). | Claude |
| 2026-04-15 | **Track A.0 merged (#511).** Prisma schema migration: `EntrySource` enum + `source` column on 9 financial models (Account, Property, Loan, Income, Expense, InvestmentAccount, SuperannuationAccount, Asset, HouseholdProfile). Strictly additive — `NOT NULL DEFAULT 'MANUAL'` on every column, no `DROP`, no `DELETE`, no `UPDATE`. Migration SQL at `prisma/migrations/1_add_entry_source_enum/migration.sql`. Caught one bug pre-commit: `Income` table maps to `"income"` (singular), not `"incomes"`. | Claude |
| 2026-04-15 | **Track A.1 merged (#512).** `setupStateService` extended with per-module Missing/Estimated/Verified progress. New types: `ModuleKey`, `ModuleState`, `ModuleProgress`. New exports: `buildModuleProgress(userId)` (12 parallel `prisma.count()` calls — 6 modules × 2 counts), `computeModuleProgress(...)` (5-tier percent heuristic). `SetupStateResult.moduleProgress` field added. `useSetupState` hook mirrors the new types and exposes `moduleProgress` to consumers. Pure additive — no breaking changes to existing consumers. | Claude |
| 2026-04-15 | **Track A.2–A.5 merged (#513).** Visual refinements to `/dashboard/setup`: new `<SetupNextActionPanel />` component (one recommended next action via deterministic priority chain), card prioritisation (one primary tile, 2-3 secondary, rest dimmed), Why-This-Matters copy line on each tile, confidence state badges (Estimated amber / Verified emerald / Missing none). All driven by `useSetupState().moduleProgress`. The 6 concrete tile components (`PropertiesEmptyState`, etc.) gained `priority` + `confidenceState` props forwarded to `EmptyStateTile`. | Claude |
| 2026-04-15 | **Track A.6–A.12 stacked, NOT on main (#514 orphaned).** `GuidedEntryModal` shell + 6 per-module guided flows (Accounts, Properties, Income, Expenses, Investments, Loans) shipped as PR #514, but the PR was based on the #513 branch and merged into that branch instead of `main`. Same stacked-PR issue that later affected #516/#517. **A rescue PR similar to #520 is required to bring these onto main.** Tracked as outstanding work in §13. | Claude |
| 2026-04-15 | **Track B.0–B.2 merged (#515).** New `/onboarding` top-level route with hybrid chrome (top bar + Monitrax logotype + Exit, no sidebar, full-height centered). Wizard shell + design system: `LinearStepShell`, `LinearInput`, `LinearFeedback`, `LinearProgressBar`, `LinearSegmented`, `LinearWizardContainer`, `useCountUp` hook, `linear-wizard.css` keyframes. Welcome step (B.2). Replaces the legacy `WizardContainer` page-mode at `app/onboarding/page.tsx`. Legacy wizard still reachable via `/dashboard?legacy=wizard`. | Claude |
| 2026-04-15 | **Track C.0/C.1 merged (#518).** `DashboardLayout` rewired: `handleStartSetup` → `/onboarding` (was `/dashboard/setup`); `handleResumeBannerResume` → `/onboarding`; `/dashboard` auto-redirect for incomplete users → `/onboarding`. `handleResumeBannerStartOver` intentionally kept pointing at `/dashboard/setup` (opt-out path). | Claude |
| 2026-04-15 | **Track D.0 doc merged (#519).** `docs/quality/PHASE_12_DESIGN_AUDIT.md` shipped — 287-line audit gate document with 4 walkthrough paths, §10 standards checklist, mobile matrix, CDR + perf checks, weakness register with P0/P1/P2 severity, sign-off section that gates Track C.2 cleanup. **The audit walkthrough has not yet been performed** — only the doc exists in the repo. | Claude |
| 2026-04-15 | **Track B.3–B.8 merged via rescue PR (#520).** Originally shipped as #516 + #517 but those were stacked and merged into the parent branches instead of `main`. The rescue PR fast-forwards all 6 step components (HouseholdStep, IncomeStep, HousingStep, ExpensesStep, GoalStep, FinalRevealStep) + 6 API routes under `/api/onboarding/estimates/*` + the shared `onboardingEstimateService` onto `main`. **No new code in #520 — same commits as #516/#517, just retargeted.** | Claude |
| 2026-04-15 | **Auth header hotfix merged (#521).** Bug discovered when user reported "Could not save. Please try again." on the Household step. Root cause: 6 wizard step component fetches were missing `Authorization: Bearer ${token}` header, so every `POST /api/onboarding/estimates/*` returned 401. Fix added `useAuth()` import and the missing header to `HouseholdStep`, `IncomeStep`, `HousingStep`, `ExpensesStep`, `GoalStep`, and `FinalRevealStep` (2 fetches: snapshot + complete). +47 / −14 lines. The Track A.6–A.12 guided flows likely have the same bug pattern but are not on main yet — requires the same fix once #514 is rescued. | Claude |
| 2026-04-15 | **🚨 Data loss incident reported.** A user with prior data on Monitrax appears to have all data missing after the recent merges. Tracked as **R12** in §11. **All code work halted** until root cause is established and recovery path confirmed. Investigation steps: (1) confirm whether DB rows are actually gone vs not displayed (Prisma Studio direct query), (2) audit Vercel/deploy logs for migration commands (was it `prisma migrate deploy` or `prisma migrate reset`?), (3) check backup status and most recent good snapshot. The destructive `upsertHouseholdEstimate` (R11) is the most likely candidate from this plan's PRs but was gated by the auth bug in #521 — so timing is inconsistent unless data loss happened *after* #521 merged. | Claude |
| 2026-04-15 | **R12 investigation — data is intact.** Direct SQL queries against both Cloud SQL instances (Cloud SQL Studio) confirmed `rayanmehr79@gmail.com` (id `fb06f1d0-cfbc-41fb-8324-ca3aa8327907`) still has all their data: 3 accounts, 5 properties, 4 loans, 6 income, 57 expenses, 3 investments, 1 household profile. Audit log shows zero `ENTITY_DELETED` events in 14 days. The symptom was a **read-path crash**, not real data loss. | Claude |
| 2026-04-15 | **R12 root cause identified.** Phase 12 A.0 added a `source` column to 9 models in `schema.prisma`, but the matching migration never ran against either DB. Investigation Q5 (`information_schema.columns WHERE column_name='source'`) returned only pre-existing tables (none of the 9 Phase 12 tables). Q6 (`SELECT FROM "_prisma_migrations"`) returned `relation does not exist` — **neither Cloud SQL instance has a Prisma migration tracking table at all**. Both DBs were created outside Prisma migrate during the Render→GCP move and have been drifting ever since. Deployed Prisma client generated `SELECT ..., source FROM accounts` which crashed at the DB layer, API routes caught the error and returned empty responses, dashboard rendered blank. | Claude |
| 2026-04-15 | **PR #523 merged — CLAUDE.md §12.11 destructive write checklist.** Added a zero-tolerance rule covering `update`, `upsert`, `updateMany`, `delete`, `deleteMany`, raw SQL, and destructive migrations. Requires PR authors to answer three questions for any destructive write, provides ❌/✅ examples, PR body template, grep one-liner, and code-review enforcement. Added in response to the R11 `upsertHouseholdEstimate` antipattern shipping without user confirmation. | Claude |
| 2026-04-15 | **PR #524 merged — Phase 12 A.0 hotfix revert.** Removed `source EntrySource` field from the 9 models in `schema.prisma` and removed the `EntrySource` enum. Stubbed `onboardingEstimateService` — all 5 write functions now throw `OnboardingDisabledError` (defense in depth). Patched `setupStateService.buildModuleProgress` to not filter by source (estimated counts hard-coded to 0). Zero database changes. Restored the dashboard for every user within one build cycle. | Claude |
| 2026-04-15 | **PR #525 merged — Prisma baseline runbook + orphaned migration deleted.** New `docs/operational/database/04_PRISMA_MIGRATION_BASELINE.md` with step-by-step instructions for bringing both Cloud SQL instances under Prisma tracking. New `scripts/baseline-prisma-migrations.sh` helper with safety checks. Deleted `prisma/migrations/1_add_entry_source_enum/` (orphaned — schema was reverted in #524). Cross-referenced the new runbook from `03_DATABASE_MIGRATIONS.md` and `00_INDEX.md`. | Claude |
| 2026-04-15 | **PR #526 merged — Vercel auto-migrate pipeline.** Added a `vercel-build` script to `package.json`: `prisma migrate deploy && prisma generate && next build`. Vercel's framework auto-detection picks this up without any dashboard change. Handles the 2-tier DB split natively via Vercel's per-environment `DATABASE_URL` scoping — previews apply migrations to `monitrax-db-dev`, production applies to `monitrax-db-prod`. If a migration fails, the deploy aborts and the previous deployment keeps serving. Added CLAUDE.md §12.12 "Schema Change Deploy Protocol" (NON-NEGOTIABLE) codifying the rule that every schema change must include a matching migration file, `db push` is banned, etc. Renumbered the existing "Before Every Session" checklist from §12.12 to §12.13. Updated `02_VERCEL_DEPLOYMENT.md` and `03_DATABASE_MIGRATIONS.md` to document the new automated flow. | Claude |
| 2026-04-15 | **R12 manual baseline step executed.** First Vercel build of #526 failed with Prisma error P3005 (*"The database schema is not empty"*) against dev — Prisma's safety feature refusing to auto-baseline a non-empty DB. Fixed by running a one-time SQL block in Cloud SQL Studio against both DBs: `CREATE TABLE "_prisma_migrations"` + `INSERT` a row for `0_init` with the correct SHA256 checksum `abc16efe3df5a5171a5873aa20ae3d072b54e14ad8c329484e49b4d5d2bde2bd`. Verified both DBs now have one tracked migration. Redeployed #526 successfully end-to-end. | Claude |
| 2026-04-15 | **R12 CLOSED.** Full remediation shipped across PRs #523 + #524 + #525 + #526 plus the manual SQL baseline. Dashboard verified working for affected users. Vercel build pipeline now structurally prevents schema drift: every merge auto-applies pending migrations to the scoped DB before deploying code. `upsertHouseholdEstimate` destructive path is unreachable until a hardened re-apply ships per CLAUDE.md §12.11. See `docs/quality/PHASE_12_DESIGN_AUDIT.md` §11.1 for the post-mortem and `docs/changelog/CHANGELOG_2026_04_15.md` for the full session log. | Claude |

---

*This plan is the source of truth for all Phase 12 twin-track work.
When reality and this document disagree, fix the document first
(CLAUDE.md §10.5, §11).*

---

## Plan approval

**This document is the deliverable for the directive.** No code has
been written. Once approved, work begins with Phase A.0 (the Prisma
schema migration) which blocks every subsequent phase.

Approval steps:
1. Review §2 decisions locked in — confirm all 12 Qs are correct
2. Review §4 Track A scope — confirm refinement-only, no deletions
3. Review §5 Track B scope — confirm 5 data steps + Welcome + Final Reveal
4. Review §8 design standards — confirm the §10 quality bar binds
5. Review §10 files list — confirm nothing on /dashboard/setup gets deleted
6. Review §11 risks — acknowledge R1 (Prisma migration reversibility)
7. Say `approved` or flag any decision that needs to change

After approval, I begin Track A.0 and proceed through the phases at
the same 1-file-1-commit-1-PR rhythm used in Phases A–F earlier this
session.
