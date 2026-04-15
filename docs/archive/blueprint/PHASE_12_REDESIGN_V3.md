# Phase 12 — Onboarding Redesign v3 (Dashboard-as-Onboarding) — ARCHIVED

> ## ⚠ ARCHIVED — DO NOT USE FOR CURRENT DIRECTION
>
> **This document is preserved as historical reference only.**
>
> The v3 dashboard-as-onboarding direction (Setup Tray on every
> dashboard page, replacing `/dashboard` `isEmpty` branch with a tile
> grid, flipping `NEXT_PUBLIC_ONBOARDING_V3` to default-on) has been
> **superseded** by the twin-track architecture.
>
> **Current source of truth:**
> 👉 [`docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md`](../../blueprint/PHASE_12_SETUP_AND_ONBOARDING.md)
>
> The twin-track plan keeps `/dashboard/setup` as a detailed data
> capture workbench (refined, not rebuilt) and adds a new top-level
> `/onboarding` wizard for first-time users. The two surfaces are
> complementary and do NOT overlap.
>
> **What still applies from this v3 doc:**
> - Phase A bug fixes (A.1–A.7) — merged into main, fixes still in effect
> - Phase B foundation (registry, service, API route) — kept and extended by the twin-track plan
> - Phase C components (`SetupTray`, `BasiqHeroCard`, `DashboardEmptyStateGrid`, `EmptyStateTile`) — kept on `/dashboard/setup` and extended per Track A
> - §2.4 Gemini assistance — still deferred, captured in `docs/blueprint/PHASE_28_AI_INTEGRATION.md`
>
> **What was reverted / abandoned from this v3 doc:**
> - Mounting `SetupTray` in `DashboardLayout` chrome — **reverted** (twin-track puts it on `/dashboard/setup` only)
> - Replacing `/dashboard` `isEmpty` branch with v3 tile grid — **reverted** (twin-track leaves `/dashboard` untouched)
> - `NEXT_PUBLIC_ONBOARDING_V3` feature flag — **reverted** (twin-track doesn't flag-gate; the two surfaces are separate routes)
> - Phase F default flip — **reverted**
> - Phase G wholesale cleanup of the `/dashboard/setup` page — **cancelled**; the page is kept and refined instead
>
> Archived on 2026-04-15. Original content below.

---

# Phase 12 — Onboarding Redesign v3 (Dashboard-as-Onboarding)

> **Living document.** This is the master plan for the v3 onboarding
> redesign. It supersedes `PHASE_12_WIZARD_REDESIGN_PLAN.md` as the
> source of truth for all new work. If reality diverges from this doc,
> fix the doc first, then the code.

**Owner:** Claude (engineer) | **Reviewer:** Reza
**Status:** 🔴 ARCHIVED — superseded by `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md`
**Branch:** `claude/monitrax-wizard-redesign-6jVjX`
**Supersedes:** `docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md` (v2, PR 3a/3b)
**Superseded by:** `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md` (twin-track, 2026-04-15)
**Related:**
- `docs/blueprint/PHASE_12_ONBOARDING_TOUR.md` (legacy spec, kept for historical reference)
- `docs/changelog/CHANGELOG_2026_04_12_*.md` (PR 1, 2, 3a, 3b history)

---

## 1. Why v3 (and why we are deleting the wizard)

PR 1 → PR 3b shipped a polished 8-step linear wizard with draft
persistence, a dedicated `/onboarding` route, ambient dashboard tint,
profile auto-inference, and a Basiq shortcut on the Accounts step.
It is the best version of a wizard Monitrax will ever ship.

And it is still the wrong shape.

Observed problems with the linear-wizard model:

1. **The wizard duplicates the dashboard.** Every step captures data
   that has a permanent home elsewhere (Properties page, Accounts page,
   Income & Expenses page, etc.). Users learn the wizard UI, then have
   to re-learn the dashboard UI afterwards.
2. **"Fake data or no data" is a false choice.** Empty dashboard tiles
   today either show zeros (feels broken) or seed example rows (feels
   dishonest and creates cleanup debt).
3. **Basiq is buried inside a step.** The single highest-leverage
   action a new user can take — connect their bank — sits three clicks
   deep inside the Accounts step, competing with manual entry tiles.
4. **Resume friction.** The resume banner + modal + ambient tint
   machinery exists purely because the wizard is a separate surface
   that has to be re-entered. If onboarding *is* the dashboard, there
   is nothing to resume.
5. **Every new entity type we ship needs a new wizard step.** Structural
   changes (PR 3b renter path, debts step, super step) already ballooned
   the wizard from 8 → 10+ steps. This does not scale.

### The v3 model in one sentence

**The dashboard itself is the onboarding experience.** A new user lands
on `/dashboard` with empty tiles; each tile teaches by example
(screenshots / illustrations, never fake data rows); a persistent
**Setup Tray** in the top chrome tracks setup progress; Basiq is
surfaced as a hero action above the tiles until the user has at least
one data source connected.

---

## 2. The four pillars

### 2.1 Setup Tray (repurposed resume banner)

The existing resume banner / ambient-tint machinery is renamed and
re-aimed. Instead of "Resume wizard" it becomes a **persistent setup
progress tray** anchored in the dashboard header (or a collapsible
top-strip on mobile).

Responsibilities:
- Show a compact progress meter (`3 of 7 setup tasks done`).
- Expand into a checklist of canonical setup tasks:
  `Connect a bank · Add a property · Add household · Add recurring
  income · Add recurring expenses · Review net worth · Invite partner`
- Each task links directly to the relevant dashboard page / dialog —
  **never to a wizard step**.
- Dismissible per-task and globally. Dismissal is persisted in
  `UserPreference` (new JSONB field `setupTrayState` or reuse
  `dismissedOnboardingBadge` + extend).
- When all tasks are done (or explicitly dismissed) the tray collapses
  to a single "Setup complete ✓" pill that can be re-expanded from
  Settings.

Key property: the tray is **orthogonal to the data**. A user can add a
property from the Properties page, or from a setup-tray link, or from a
deep-link in an email — all three routes converge on the same real
dialog, and all three tick the same tray task.

### 2.2 Empty-state dashboard tiles — "examples as instruction"

Every dashboard tile that currently shows zeros gets a purpose-built
empty state:

- A **static example illustration or screenshot** of what the tile
  will look like once populated (blurred / desaturated to indicate
  it is an example, not the user's data).
- A single primary CTA: `Add your first [thing]` → opens the real
  entity dialog.
- Optional secondary links to the setup tray or to import flows.
- **Zero fake rows in the database.** No seed data, no demo users, no
  "delete sample data" cleanup step. The example is an image, not a
  row.
- Tile stays in empty state until the underlying collection has ≥1
  real row, then switches to the normal populated view.

Affected tiles (non-exhaustive):
- Net Worth card
- Properties grid
- Accounts list
- Cashflow chart
- Upcoming bills
- Loans overview
- Investments / Super

### 2.3 Basiq as hero connection flow

Above the tile grid, for any user whose `hasConnectedBankAccount` is
false, a **hero Basiq card** sits full-width:

- Headline: "Connect your bank in 60 seconds"
- Sub: "We'll import accounts, balances, and 12 months of transactions.
  Your data stays in your account — we never store your bank login."
- Primary CTA: `Connect bank` → Basiq consent flow (Phase 24, already live)
- Secondary: `Skip for now — I'll add manually`
- Trust strip: ADR logo, CDR compliance badge, "Read our data policy"
  link.

Once the first Basiq connection is ACTIVE, the hero card collapses into
a slim "✓ Bank connected · Add another" strip and the tile grid takes
focus.

Key property: Basiq is no longer competing with manual entry inside a
step. It is the **first and loudest thing** a new user sees, with
manual entry available but visually de-ranked — consistent with the
PR 3b "Basiq > Import > Manual" hierarchy from §12.4 of CLAUDE.md.

### 2.4 Proactive Gemini assistance (not autofill)

> **⏸ Deferred to a post-Phase-G workstream.** The scope of this
> pillar (canonical assist service, RAG over docs, privacy envelope,
> rate limiting, API route, UI orb component, AND mounting in every
> entity dialog — Properties, Accounts, Income, Expenses, Investments,
> Loans, Household, Super) is materially larger than Phases A–E
> combined and cannot be delivered as a handful of 1-file micro-fix
> turns. Shipping it before Phase F/G would also pollute the testing
> signal for the v3 core (Setup Tray + empty-state tiles + Basiq hero).
>
> **Sequencing decision (2026-04-14):** Gemini assistance ships as
> its own named initiative **after** Phase G cleanup, with its own
> plan document and its own micro-fix series. It builds on the
> existing Gemini infrastructure from Phase 27 and Phase 28 — see
> `docs/blueprint/PHASE_27_GEMINI_AI_MIGRATION.md` and
> `docs/blueprint/PHASE_28_AI_INTEGRATION.md` for what's already in
> place (Gemini client, system prompts, model fallback, variable-
> expense estimator). The new workstream will add a *Setup Assistant*
> use case on top of that foundation.
>
> **Why this is safe to defer:** the three shipping v3 pillars
> (Setup Tray, empty-state tiles, Basiq hero) stand alone as a
> complete dashboard-as-onboarding replacement. Gemini assistance
> is a quality-of-life layer, not a blocker for the §5 migration.
> The plan below captures the *design* of the pillar so it can be
> implemented later without re-deriving the scope; the *when* is
> a follow-up initiative.

The existing AI Helper component (already built, currently passive —
waits to be asked) is repurposed into a **proactive assistance agent**
powered by Google Gemini. It narrates each setup task, answers
questions in-context, and lowers the cognitive cost of the form the
user is looking at — **without ever filling fields for them.**

**Core principle: assistance, not automation.**

Gemini does not provide data. Gemini does not autofill. Gemini does
not guess at balances, ownership, dates, or any other user input. The
user's data is always entered by the user, so they retain full mental
ownership of their financial picture and so we never write a value
the user didn't consciously decide on. This also keeps us clean
against CLAUDE.md §13.3 ("never send CDR data to third parties").

**What Gemini does do:**

1. **Proactive step narration.** When a setup tray side-over opens,
   Gemini surfaces a one-sentence hint relevant to the task: *"The
   current value is what you think the property would sell for today
   — an estimate is fine, you can refine it later."* Dismissible.
   Collapses into a `?` chip next to the field label.
2. **Contextual explanations.** Every field has a `Why does Monitrax
   need this?` affordance. Gemini answers in one or two sentences
   grounded in the relevant Phase doc (RAG over
   `docs/architecture/*.md` and `docs/blueprint/*.md`), not generic
   financial advice.
3. **Decision support.** If the user hesitates on a choice (e.g.
   "Should I enter my mortgage balance as of today or of my last
   statement?"), Gemini offers the trade-off in plain English. Never
   tells them which to pick.
4. **Error resolution.** When validation fails (invalid BSB, missing
   field, out-of-range date), Gemini's suggestion appears *next to*
   the error, not as a replacement for the error. Example: *"BSB is
   6 digits — you've entered 5. Usually starts with a bank code like
   062 for CommBank."*
5. **Stuck detection.** If the user sits on a step for >60 seconds
   without typing, Gemini proactively offers: *"Need a hand? I can
   explain what this step unlocks."* Dismissible. Fires at most once
   per session per task.
6. **Task prioritization.** On the dashboard after initial load,
   Gemini suggests the highest-leverage next setup task based on
   what's already entered: *"You've connected your bank — adding
   your property next will unlock net worth tracking."* Suggestion
   lives inside the Setup Tray, not as a standalone toast.

**What Gemini must not do (hard rules):**

| ❌ Never | Why |
|---|---|
| Autofill any form field | Breaks mental ownership; risks writing wrong data |
| Guess a user's balance, property value, or income | Would require model inference over CDR-classified data |
| Send CDR-classified data (account balances, transactions, BSBs) to Gemini | CLAUDE.md §13.3 — CDR data never leaves our system to third parties |
| Generate financial advice | Not an ADR function; regulatory landmine |
| Claim certainty on estimates | Always frame suggestions as "one common way" not "the right way" |
| Fire more than one proactive prompt per task per session | Avoids nagging; respects the user's attention |

**Privacy envelope** (required before Gemini ships):

- Gemini prompts contain **no CDR data**. Only: field label, field
  type, task name, Monitrax doc excerpts (retrieved via RAG), and
  the user's free-text question if they asked one.
- All Gemini interactions are logged via `createAuditLog()` with
  `action: 'AI_HELPER_INVOKED'` and sanitized metadata (CLAUDE.md
  §13.3).
- A rate limit on Gemini calls (10/minute per user, configurable)
  via GCP API Gateway or a simple Prisma-backed counter.
- `prefers-reduced-motion` honoured on Gemini entry/exit
  animations; keyboard shortcut to dismiss.
- Dark-mode native.

**Where Gemini lives in the UI:**

- As a persistent `?` chip or small orb in the corner of every setup
  tray side-over form.
- Expands into a side panel on click (not a modal; never steals
  focus from the form).
- Input box at the bottom: *"Ask me anything about this step."*
- Suggestions auto-surface above the input when relevant.

**Integration surface:**

| Hook | Purpose |
|---|---|
| `lib/services/geminiAssistService.ts` | Canonical service for all Gemini calls. Wraps the Gemini SDK, enforces the privacy envelope, handles RAG lookup, emits audit logs. **No business logic in components.** (CLAUDE.md §12.3) |
| `lib/setup/taskHints.ts` | Static map of setup task → default hint string. Shipped before Gemini is wired up, so hints work even if Gemini is disabled. |
| `components/ai/GeminiAssistPanel.tsx` | UI surface. Reads from `geminiAssistService`. Respects rate limit, shows loading/error states gracefully. |
| `app/api/ai/assist/route.ts` | Thin wrapper calling `geminiAssistService`. `withPermission(req, 'ai.use')`. |

Gemini is the **fourth pillar** alongside the Setup Tray, empty-state
tiles, and Basiq hero. It is what turns a self-serve dashboard flow
into a guided one — without gating the flow. The user can ignore
Gemini entirely and still complete onboarding in under 5 minutes;
users who engage Gemini move faster and with more confidence.

---

## 3. What gets deleted (eventually)

Once the v3 flow is proven with real users, the following are deleted
in a final cleanup PR (not before):

| To delete | Reason |
|---|---|
| `components/onboarding/wizard/WizardContainer.tsx` | Replaced by dashboard tiles + setup tray |
| `components/onboarding/wizard/steps/*` (all 10 step files) | No longer rendered |
| `components/onboarding/wizard/primitives/*` | No longer consumed (or migrated to shared `components/ui/` if reused) |
| `app/onboarding/page.tsx` | Replaced by redirect to `/dashboard?setup=hero` |
| `app/onboarding/basiq-callback/page.tsx` | Replaced by generic Basiq callback handler used by all Basiq flows |
| `styles/wizard-animations.css` | Tokens migrated to Tailwind config or deleted |
| `bulk-create` API route (if only called by wizard) | Verify with Grep before deleting |
| Resume banner components (if purely wizard-coupled) | Logic absorbed into Setup Tray |
| Welcome modal (if purely wizard-coupled) | Absorbed into first-load dashboard hero |

**Do not delete anything until the replacement is live and the path
has been verified by real user traffic.** Each deletion ships as its
own PR with a changelog entry documenting what was removed and why.

---

## 4. Architecture sketch

```
┌─────────────────────────────────────────────────────────────┐
│ DashboardLayout                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Top chrome                                              │ │
│ │  ┌────────────────────┐  ┌─────────────────────────┐    │ │
│ │  │ Logo / nav         │  │ SetupTray (§2.1)        │    │ │
│ │  └────────────────────┘  └─────────────────────────┘    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ BasiqHeroCard (§2.3, conditional)                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌───────────────┬───────────────┬───────────────┐           │
│ │ NetWorthTile  │ CashflowTile  │ PropertiesTile│           │
│ │ (empty-state  │ (empty-state  │ (empty-state  │           │
│ │  if no data)  │  if no data)  │  if no data)  │           │
│ └───────────────┴───────────────┴───────────────┘           │
│ ┌───────────────┬───────────────┬───────────────┐           │
│ │ AccountsTile  │ LoansTile     │ InvestmentTile│           │
│ └───────────────┴───────────────┴───────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

New modules:

| Module | Path | Purpose |
|---|---|---|
| Setup Tray | `components/setup/SetupTray.tsx` | Header chrome progress tracker |
| Setup task registry | `lib/setup/tasks.ts` | Canonical list of setup tasks + their done-predicates |
| Tile empty states | `components/dashboard/tiles/*EmptyState.tsx` | Per-tile example illustrations |
| Basiq hero card | `components/dashboard/BasiqHeroCard.tsx` | Top-of-dashboard CTA |
| Setup state API | `app/api/setup/state/route.ts` | Returns setup task completion map |

Canonical service: `lib/services/setupStateService.ts` computes task
completion from the master financial snapshot. **No new business
logic in route handlers** (per CLAUDE.md §12.3).

---

## 5. Migration strategy

Phased, reversible, and additive. The wizard stays live until v3 is
fully proven.

| Phase | Ships | Wizard status | Status |
|---|---|---|---|
| **A. Micro-fixes** | Bug fixes to the existing wizard + state machine that unblock v3 | Still live, still default | ✅ **Complete** (A.1–A.7) |
| **B. Foundation** | `lib/setup/tasks.ts`, `setupStateService`, `/api/setup/state` | Still live | ✅ **Complete** (B.1–B.3; B.4 deferred — schema change) |
| **C. Setup Tray** | `SetupTray` component mounted in `DashboardLayout`, reads `/api/setup/state` | Still live, wizard + tray coexist | ✅ **Complete** (C.1–C.3) |
| **D. Empty-state tiles** | Each tile gets its empty state, shipped one tile per PR | Still live | ✅ **Complete** (D.1–D.3) |
| **E. Basiq hero** | `BasiqHeroCard` mounted above tile grid | Still live | ✅ **Complete** (E.1, E.2 — pivoted to `/dashboard/setup` page) |
| **F. Default flip** | New users land on dashboard v3 flow; wizard only reachable via a legacy `?legacy=wizard` flag | Wizard deprecated, not deleted | 🔄 **Pivoted** — v3 is no longer a dashboard default flip. Instead, v3 lives on a dedicated `/dashboard/setup` page, and the welcome modal's "Start setup" CTA routes new users there. The `?legacy=wizard` escape hatch is preserved. |
| **G. Cleanup** | Delete wizard files (§3) | Wizard deleted | ⏸ **Paused for user testing** |

> **⚠ Architectural pivot (2026-04-14):** the original Phase C/D/E
> plan mounted the Setup Tray in `DashboardLayout` and replaced
> `/dashboard`'s `isEmpty` branch with a 6-tile grid. This hijacked
> an existing dashboard surface that had significant investment in
> its widgets and empty-state design. **The pivot moved the entire
> v3 experience onto a dedicated `/dashboard/setup` page**, leaving
> `/dashboard` byte-for-byte identical to its pre-v3 state (with
> one additive "Set up Monitrax" button inside the legacy Welcome
> card that routes to the new page). See `app/dashboard/setup/page.tsx`.
>
> All Phase B/C/D/E components (SetupTray, BasiqHeroCard,
> DashboardEmptyStateGrid, EmptyStateTile, useSetupState, registry,
> service, API) are **preserved and consumed by the new page
> unchanged** — the pivot is purely about mount location, not
> component design. No rework, no rebuilds.

> **State after Phase D**: setting `NEXT_PUBLIC_ONBOARDING_V3=true`
> in the deployment env and rebuilding gives every new user the
> full v3 dashboard-as-onboarding experience: Setup Tray in the
> chrome (Phase C) + empty-state tile grid on the empty dashboard
> (Phase D) + the Phase A wizard fixes underneath in case they
> still land on the legacy flow during the migration window. Phase
> E (Basiq hero card) and Phase F (default flip) are next.

Each phase is multiple PRs. Each PR is one focused thing. See §7.

---

## 6. Ground rules (carried forward from CLAUDE.md)

- **Read before writing.** Always.
- **No dead code.** Delete what we don't use. Don't comment it out.
- **No duplicate logic.** Canonical utilities only.
- **No business logic in components or route handlers.** Use
  `lib/services/*` or `lib/calculations/*`.
- **Atomic commits.** One file, one commit, one PR per micro-fix.
- **Document every change.** Update this plan + changelog entry.
- **No TypeScript `any`.** Match the Prisma schema exactly.
- **`prefers-reduced-motion`** honoured on every animation.
- **Dark mode** native on every new component.
- **ARIA + keyboard navigation** on every interactive element.
- **CDR compliance.** Setup task completion never leaks CDR data into
  audit metadata (CLAUDE.md §13.3).

---

## 7. Micro-fix backlog (Phase A — Engineering Stabilization)

> Rhythm: **one focused thing per turn — 1 file, 1 commit, 1 PR.**
> This avoids stream idle timeouts and keeps review atomic.
>
> **Why Phase A exists at all if we're deleting the wizard in Phase G:**
> Users are hitting these bugs *today*. The full redesign takes weeks;
> every day the wizard stays broken is a day we lose users to "Continue
> grayed out" and "sent back to step 0" symptoms. Phase A buys goodwill
> during the redesign window. Fixing code we'll eventually delete is
> cheaper than losing users we'll never get back.

### 7.1 Phase A bug audit — the 7 bugs surfaced by the code audit

All 7 were identified in the previous session's code audit. Each is a
real, reproducible footgun in the current wizard that independently
causes user-visible regressions.

| # | File:Line | Bug | Impact | Status |
|---|---|---|---|---|
| A.1 | `app/api/onboarding/state/route.ts:180` | Server silently caps `currentStep <= 7`. Writes past index 7 are dropped without error. | MIXED-profile users (10 steps) lose progress past step 7 silently. Resume at step 7 even if they were on step 9. | ✅ Shipped — [#489](https://github.com/resadegh/monitrax/pull/489) |
| A.2 | `components/DashboardLayout.tsx:170-181` | `hydratedDraft` localStorage fallback is a lie. Comment says "local fallback when server returned null" but the code returns `undefined`. | Users who saved a local draft (offline / network blip) lose it on resume. The draft is silently discarded. | ✅ Shipped — [#489](https://github.com/resadegh/monitrax/pull/489) |
| A.3 | `components/onboarding/wizard/steps/WelcomeStep.tsx:205-211` | Profile inference doesn't handle reversions. If user picks Own → then Rent without re-picking investments, `profileType` stays at the old value. | Steps show the wrong path. User lands on Properties step after saying they rent. | ✅ Shipped — [#490](https://github.com/resadegh/monitrax/pull/490) |
| A.4 | `components/DashboardLayout.tsx:296-304` | Dual-POST autosave race. `saveDraft` + `setCurrentStep` fire as two independent parallel POSTs with no transactional coordination. | Server can end up with a new step index + an old draft. User sees "step 3" on resume but the properties they typed are missing. | ✅ Shipped — [#491](https://github.com/resadegh/monitrax/pull/491) |
| A.5 | `components/onboarding/wizard/steps/WelcomeStep.tsx:200-202` | `hasInvestments` is local-state-only. Never persisted to the draft. On resume, rebuilt from `reverseInfer(profileType)` — returns `null` if inference is incomplete. | User has to re-select investments on every resume. Continue stays grayed out until they do. | ✅ Shipped — [#492](https://github.com/resadegh/monitrax/pull/492) |
| A.6 | `components/onboarding/wizard/WizardContainer.tsx:117-148` | Late-hydration `useEffect` is one-shot (`hasAppliedLateHydrationRef`). Can't re-fire if `initialData` arrives after the first attempt. | Slow network → wizard stays empty forever. | ✅ Shipped — [#493](https://github.com/resadegh/monitrax/pull/493) |
| A.7 | `components/onboarding/wizard/WizardContainer.tsx:148-156` | `steps.filter(welcome)` collapses to `[welcome]` when `profileType` is null. `handleNext` then clamps `currentStepIndex` with `Math.min(prev+1, steps.length-1)` → sends user back to step 0. | **This is the "sent back to property section" symptom.** | ✅ Shipped — [#494](https://github.com/resadegh/monitrax/pull/494) |

### 7.2 Phase A follow-up constants + hygiene

After the 7 bug fixes, two small hygiene passes:

| # | Change | Status |
|---|---|---|
| A.8 | Add a `TOTAL_WIZARD_STEPS` constant shared by API + client; plug it in at the `currentStep >= 0` guard introduced by A.1. | ⬜ |
| A.9 | Audit all other callers of `currentStep` to confirm no further hardcoded caps remain. | ⬜ |

### 7.3 Micro-fix acceptance criteria

Every micro-fix must:

- Touch exactly one file (exceptions require a note in this plan).
- Have a one-paragraph root-cause explanation in the commit body.
- Pass `npm run build` locally or on CI.
- Include a one-line entry in today's changelog under a
  `### Micro-fix #N` subheading.
- Ship as its own PR with a descriptive title
  (`fix(onboarding): <what>`).
- Not introduce any new dead code.
- Reference the bug ID (`A.1`, `A.2`, …) in the PR body so the backlog
  in this document can be ticked off in a follow-up commit.

### 7.2 Micro-fix acceptance criteria

Every micro-fix must:

- Touch exactly one file (exceptions require a note in this plan).
- Have a one-paragraph root-cause explanation in the commit body.
- Pass `npm run build` locally or on CI.
- Include a one-line entry in today's changelog under a
  `### Micro-fix #N` subheading.
- Ship as its own PR with a descriptive title
  (`fix(onboarding): remove currentStep cap at step 7`).
- Not introduce any new dead code.

---

## 8. Open questions

Tracked here so nothing gets lost between turns.

| # | Question | Blocked on | Default if unresolved |
|---|---|---|---|
| Q1 | Does the Setup Tray live in `DashboardLayout` or inside each page? | Design review | `DashboardLayout` (less duplication) |
| Q2 | Do we reuse `UserPreference.onboardingDraft` for `setupTrayState` or add a new column? | Schema review | New column `setupTrayState JSONB` (cleaner separation) |
| Q3 | How do we handle existing users who already completed the wizard? | Product | Setup Tray shows "✓ All done" on mount; no migration needed |
| Q4 | Do tile empty states ship behind a feature flag? | Release plan | Yes — `NEXT_PUBLIC_DASHBOARD_EMPTY_STATES_V3=true` until v3 is default |
| Q5 | Does `bulk-create` API survive the cleanup? | Grep audit | Delete if only wizard calls it |

---

## 9. Research foundation — why this shape, not another

The v3 design is not an opinion. It is the convergent answer that every
best-in-class fintech and SaaS onboarding experience in 2026 has
arrived at. The table below captures the specific move each product
makes and what we're stealing from it.

| Product | Signature move | What v3 steals |
|---|---|---|
| **Revolut** | Treats onboarding as a value narrative — sells a vision before asking for data | Frame every input around *why*, not *what*. The welcome modal's 3-column value props already do this; we keep them. |
| **Monzo** | Human, conversational microcopy; visible progress; playful illustrations reduce form weight | Setup Tray copy is conversational, not checklist-terse. |
| **Copilot Money / Rocket Money** | Plaid-first: bank connects in 60s → dashboard populates → *then* ask clarifying questions | **This is the biggest unlock.** Basiq becomes the default hero path (§2.3). |
| **Linear** | Every onboarding prompt has a Skip. No gates. Users can always come back. | Every setup tray task is skippable; dashboard is never blocked. |
| **Notion** | *Learn by doing.* But populated starter workspaces can read as "fake data". | **We invert Notion's move**: empty tiles with *example illustrations* (images/screenshots), not fake rows. Linear's "illustration as empty state" pattern, not Notion's seeded workspace. See §2.2. |
| **Duolingo** | Micro-celebrations and dopamine hits for every tiny win | Every setup tray check-off produces a visible dashboard tile update + micro-animation. See §10. |
| **Superhuman** | Concierge 1:1 onboarding (not scalable) — but the *principle* is personalization | Our AI helper (already built) is repurposed as a proactive narrator for each task. |
| **Slack** | Aha moment engineered for the first 3-5 clicks | Our aha moment = the net-worth number appearing for the first time. Everything is engineered around that reveal. |
| **Plaid Link** | 60-second OAuth bank connection as table stakes | Already built via Basiq. Surface as hero, not a tier. |

### 9.1 The six cross-cutting principles

These are the principles that every source above converges on. Every
v3 design decision must satisfy all six:

1. **Time-to-value < 60 seconds.** Every additional step before the
   user sees their own data reflected back halves activation.
2. **Progressive disclosure.** Show 3 things at once, never 8.
3. **Optional beats required.** Let users skip everything and come back.
4. **Adaptive checklists.** The list changes based on what the user
   has done. Not a fixed linear march.
5. **Celebrate micro-wins.** Every tap produces visible feedback,
   ideally on the dashboard itself.
6. **The dashboard IS the tutorial.** Don't build a separate tutorial.
   Put the instruction *inside* the UI that the user is about to use.

A decision that violates any one of these gets reverted.

---

## 10. The 5 magic moments (quality bar for Phase C)

These are the five micro-moments that — if we nail them — make
Monitrax's first impression feel premium. These are the things
reviewers screenshot and share.

### Moment 1 — Welcome → Dashboard reveal

User clicks `Show me my dashboard →` on the welcome modal. The modal
**cross-dissolves** (not a hard cut) into the real `/dashboard` page.
Empty-state tiles fade in with a staggered spring animation (`delay:
calc(var(--index) * 0.08s)`). Each tile shows its example illustration
with the CTA visible. Total time: under 2 seconds. The user has not
lifted a finger and already understands the shape of what Monitrax
will look like.

**Key detail:** the welcome modal's CTA changes from "Start guided
setup" (implies work) to **"Show me my dashboard →"** (implies reveal).
This single copy change reframes the entire experience.

### Moment 2 — The Basiq cross-dissolve

User clicks `Connect bank` on the Basiq hero card. OAuth flow. Return
to dashboard. Empty-state tiles cross-dissolve OUT (500ms), real tiles
with real data fade IN (500ms). The net-worth number animates from
`$0` to the real value with an ease-out curve (1.2s, slight overshoot
bounce). A toast slides in: *"3 accounts connected. Transactions
syncing…"* with a shimmer on account tiles while transactions are
still importing. **This is the aha moment.** The user thinks: "oh,
this is alive."

### Moment 3 — First manual entity aha

User adds their first property manually via the Setup Tray side-over
form. The tray item ticks off with a satisfying scale + colour
animation. The Properties tile on the dashboard instantly shows
`1 property` and the new value. The Net Worth tile increases with a
green `+$680,000` pulse badge that fades after 2 seconds. The Health
Score recalculates with a brief shimmer then settles on a new number.
The user thinks: "every tap makes it better."

### Moment 4 — 50% complete milestone

When the user completes 50% of the setup tray checklist, show a
single elegant toast — not a modal: *"You're halfway there. Your
dashboard is almost ready to tell you something useful."* The ambient
tint fades from sky-blue to faint emerald, signalling a state shift.
The AI helper icon gets a pulse — "ask me anything about your data."

### Moment 5 — Completion → first real insight

When the user finishes the checklist, **do not show a "You're done!"
modal.** Instead, quietly slide the Setup Tray out, and surface the
user's first personalized insight as a hero card at the top of the
dashboard:

> 💡 **Your emergency fund could cover 3.4 months of expenses.**
> That's below the 6-month target for your income level.
> Want to see how to get there? `Open Planner →`

This is the payoff. Finishing setup gives them an **immediate,
specific, actionable insight derived from their real data.** That is
the moment they become a user, not a tire-kicker.

**Quality bar:** no moment ships in Phase C unless it honours
`prefers-reduced-motion`, works in dark mode, and has keyboard
equivalents for every animation trigger.

---

## 11. Keep / Remove / Rewire matrix

Explicit list of what survives the redesign and what doesn't. This
section exists so no one — human or Claude — accidentally deletes
good work during Phase G cleanup.

### 11.1 Keep as-is (DO NOT DELETE)

| Component | Why kept |
|---|---|
| `OnboardingWelcomeModal` | Aurora gradient, sparkles, 3-column value props are world-class. **Only change: CTA copy → "Show me my dashboard →"** |
| `.onboarding-active-shell` ambient tint | Keep; fade to faint emerald at 50% milestone (see Moment 4) |
| `styles/wizard-animations.css` design tokens | Premium — tokens migrate to shared `components/ui/` surface; file may be renamed but not deleted |
| Draft persistence backend (`UserPreference.onboardingDraft` column + `/api/onboarding/state`) | Repurposed: draft now holds **setup tray state**, not wizard step state |
| Basiq 3-tier Accounts picker | Tier 1 (Basiq) promoted to hero; Tiers 2-3 (Import, Manual) move to Setup Tray side-over forms |
| AI Helper component | Repurposed as the **proactive Gemini assistance surface** described in §2.4. Assistance only — never autofill, never CDR data to Gemini. |

### 11.2 Remove entirely (Phase G)

| Component | Replaced by |
|---|---|
| `WizardContainer` multi-step state machine | Setup Tray + dashboard tiles |
| `currentStepIndex` / `getStepsForProfile` / `inferProfile` / `reverseInfer` | Nothing. The concept of `profileType` as a gate is deleted. |
| `profileType` column on `User` (Prisma migration) | Inferred passively from real data (properties count, investment count) |
| Full-page `/app/onboarding/page.tsx` route (PR 3a `mode: 'page'`) | Dashboard IS the onboarding |
| Linear step progression (Welcome → Household → Properties → …) | Adaptive, skip-friendly Setup Tray |
| `bulk-create` API route | Normal per-entity POSTs that the rest of the app already uses |
| `OnboardingResumeBanner` in its current shape | Logic absorbed into the Setup Tray (same component, new role) |

### 11.3 Rewire (keep the pieces, reshape the wiring)

| Component | New role |
|---|---|
| `PropertiesStep` / `AccountsStep` / `HouseholdStep` / `DebtsStep` / `SuperStep` / `InvestmentsStep` / `IncomeExpensesStep` / `AssetsStep` | Each becomes a **standalone side-over form** that can be opened from (a) the Setup Tray, (b) dashboard tile CTAs, or (c) the real entity pages. No longer part of a wizard. |
| `handleWizardComplete` | Becomes `handleChecklistItemComplete`. No more bulk-create. Every form is a single-entity create that POSTs directly to its own API. |
| `OnboardingResumeBanner` component | Renamed / repurposed as `<SetupTray>`. Same DOM primitive, different data source (setup task registry instead of wizard resume state). |
| `useOnboardingState` hook | Gains a `setupTasks` field derived from real entity counts via `setupStateService`. The `currentStep` field is kept for backwards compatibility during migration, then deleted in Phase G. |

---

## 12. Changelog

| Date | Change | Author |
|---|---|---|
| 2026-04-14 | Document created. Supersedes v2 wizard plan. | Claude |
| 2026-04-14 | Added §7 Phase A bug audit (7 bugs), §9 research foundation, §10 5 magic moments, §11 keep/remove/rewire matrix. Patches gaps against previous session's design transcript. | Claude |
| 2026-04-14 | Added §2.4 fourth pillar: proactive Gemini assistance (assistance-only, never autofill, never CDR data to Gemini). Renamed "three pillars" → "four pillars". Updated §11.1 AI Helper row to point at §2.4. | Claude |
| 2026-04-14 | **Phase A complete.** All 7 bugs from the code audit shipped: A.1 (currentStep cap), A.2 (lying localStorage fallback), A.3 (profile reversion), A.4 (dual-POST autosave race), A.5 (hasInvestments persistence), A.6 (late-hydration one-shot), A.7 (steps.filter collapse). Wizard state machine is stable across slow networks, reverted answers, and hydration races. | Claude |
| 2026-04-14 | **Phase B complete.** Backend pipeline shipped: B.1 (`lib/setup/tasks.ts` registry), B.2 (`lib/services/setupStateService.ts`), B.3 (`app/api/setup/state/route.ts`). Six of seven setup tasks are derivable today; `review-net-worth` and `invite-partner` await B.4's `UserPreference.setupTrayState` JSONB column (deferred — schema change is its own PR class). | Claude |
| 2026-04-14 | **Phase C complete.** UI pipeline shipped: C.1 (`hooks/useSetupState.ts`), C.2 (`components/setup/SetupTray.tsx`), C.3 (mount in `DashboardLayout` behind `NEXT_PUBLIC_ONBOARDING_V3` build-time flag). Setup Tray renders end-to-end when the flag is on; legacy resume banner + ambient tint suppressed by mutual exclusion. | Claude |
| 2026-04-14 | **Phase D complete.** Empty-state tiles shipped: D.1 (`components/dashboard/EmptyStateTile.tsx` shell), D.2 (`components/dashboard/DashboardEmptyStateGrid.tsx` — six concrete empty states + responsive grid wrapper), D.3 (mount in `app/dashboard/page.tsx` `isEmpty` branch behind the same v3 flag). The "examples as instruction" pattern (§2.2) is now live: muted slate placeholder shapes + sparkles "what this unlocks" chips + deep-link CTAs that mirror the Setup Tray task registry. **No fake data anywhere.** | Claude |
| 2026-04-14 | **Phase E complete.** Basiq hero shipped: E.1 (`components/dashboard/BasiqHeroCard.tsx`), E.2 (mount above the empty-state grid in `app/dashboard/page.tsx`). The §2.3 "Basiq as hero connection flow" pillar is now live behind the v3 flag: auto-hides once the user has an ACTIVE Basiq connection (reads the `connect-bank` task state from `useSetupState`). | Claude |
| 2026-04-14 | **§2.4 Gemini assistance deferred.** Captured in `PHASE_28_AI_INTEGRATION.md` as a post-Phase-G workstream. The scope (10-15 files across service, API, UI, and mounts in 8+ entity dialogs) is too large for the 1-file micro-fix rhythm and would pollute the v3 core testing signal. Gemini Setup Assistant ships after Phase G cleanup is merged and the v3 core has two weeks of stable production traffic. | Claude |
| 2026-04-14 | **Phase F complete.** Default flip shipped: new shared helper `lib/setup/v3Flag.ts` exports `useV3Enabled()` (combines `NEXT_PUBLIC_ONBOARDING_V3 !== 'false'` build-time default with session-scoped `?legacy=wizard` URL escape hatch). `components/DashboardLayout.tsx` and `app/dashboard/page.tsx` now consume the hook instead of duplicating the flag check. **v3 is the default for all new users**; legacy flow reachable via env-var rollback or URL escape hatch. Wizard and legacy empty-state card still present in code — deletion deferred to Phase G. | Claude |
| 2026-04-14 | **Phase G paused for user testing.** Per the sequencing agreement, wizard cleanup (delete `WizardContainer`, step files, primitives, `/app/onboarding`, resume banner, ambient tint CSS) will not ship until the user has validated the v3 flow end-to-end against real traffic. Trigger condition: explicit go-ahead after a new-user walkthrough on production. | Claude |
| 2026-04-14 | **Architectural pivot — v3 moved to dedicated `/dashboard/setup` page.** The original Phase C/D/E plan mounted the Setup Tray in `DashboardLayout` and replaced `/dashboard`'s `isEmpty` branch with a 6-tile grid. That hijacked an existing dashboard surface that had significant investment in its widgets and empty-state design. The pivot reverted C.3, D.3, E.2, and F mounts from `DashboardLayout.tsx` and `app/dashboard/page.tsx`, restoring `/dashboard` to byte-for-byte pre-v3 state. New `app/dashboard/setup/page.tsx` hosts the v3 experience (BasiqHeroCard + SetupTray + DashboardEmptyStateGrid) as a dedicated surface. The welcome modal's "Start setup" CTA (`DashboardLayout.handleStartSetup`) now routes new users to `/dashboard/setup` instead of opening `WizardContainer`. A "Set up Monitrax" button inside the legacy `/dashboard` Welcome card also routes there. All Phase B/C/D/E components are preserved and consumed by the new page unchanged — the pivot is about mount location only. | Claude |

---

*This plan is the source of truth for all Phase 12 v3 work. When
reality and this document disagree, fix the document first.*
