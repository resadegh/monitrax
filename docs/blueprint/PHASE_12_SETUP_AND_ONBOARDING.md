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

*§2 onwards in the next chunk. Committing this file now to keep turns small and avoid stream idle timeouts.*
