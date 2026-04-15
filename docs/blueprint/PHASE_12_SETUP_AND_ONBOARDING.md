# Phase 12 — Setup Page Refinement + Onboarding Wizard (Twin-Track Plan)

> **Living document.** This is the master plan for the twin-track
> Phase 12 work. It supersedes `PHASE_12_REDESIGN_V3.md` for the
> current direction. If reality diverges from this doc, fix the doc
> first, then the code (per CLAUDE.md §10.5 / §11).

**Owner:** Claude (engineer) | **Reviewer:** Reza
**Status:** 🟡 Plan in draft — awaiting approval before any code
**Supersedes:** `docs/blueprint/PHASE_12_REDESIGN_V3.md` (v3
dashboard-as-onboarding, pivoted 2026-04-15)
**Related:**
- `docs/blueprint/PHASE_12_ONBOARDING_TOUR.md` (v2.2 tour spec —
  historical reference only)
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

*§4 Track A onwards in the next chunk.*
