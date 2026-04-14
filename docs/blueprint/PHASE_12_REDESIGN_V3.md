# Phase 12 — Onboarding Redesign v3 (Dashboard-as-Onboarding)

> **Living document.** This is the master plan for the v3 onboarding
> redesign. It supersedes `PHASE_12_WIZARD_REDESIGN_PLAN.md` as the
> source of truth for all new work. If reality diverges from this doc,
> fix the doc first, then the code.

**Owner:** Claude (engineer) | **Reviewer:** Reza
**Status:** 🟢 Active — micro-fix phase
**Branch:** `claude/monitrax-wizard-redesign-6jVjX`
**Supersedes:** `docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md` (v2, PR 3a/3b)
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

## 2. The three pillars

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

| Phase | Ships | Wizard status |
|---|---|---|
| **A. Micro-fixes** (this phase) | Bug fixes to the existing wizard + state machine that unblock v3 | Still live, still default |
| **B. Foundation** | `lib/setup/tasks.ts`, `setupStateService`, `/api/setup/state` | Still live |
| **C. Setup Tray** | `SetupTray` component mounted in `DashboardLayout`, reads `/api/setup/state` | Still live, wizard + tray coexist |
| **D. Empty-state tiles** | Each tile gets its empty state, shipped one tile per PR | Still live |
| **E. Basiq hero** | `BasiqHeroCard` mounted above tile grid | Still live |
| **F. Default flip** | New users land on dashboard v3 flow; wizard only reachable via a legacy `?legacy=wizard` flag | Wizard deprecated, not deleted |
| **G. Cleanup** | Delete wizard files (§3) | Wizard deleted |

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

## 7. Micro-fix backlog (Phase A)

> Rhythm: **one focused thing per turn — 1 file, 1 commit, 1 PR.**
> This avoids stream idle timeouts and keeps review atomic.

### 7.1 Active queue

| # | File | Change | Status |
|---|---|---|---|
| 1 | `app/api/onboarding/state/route.ts` | Remove the `currentStep <= 7` cap at line 180. The wizard now has 10+ steps (PR 3b added Debts + Super) and the API is silently dropping writes past step 7, which means server-side step hydration is wrong for any user past the old 8-step flow. | 🔜 Next |
| 2 | TBD | Audit all callers of `currentStep` to confirm no other hardcoded caps. | ⬜ |
| 3 | TBD | Add a `TOTAL_WIZARD_STEPS` constant shared by API + client. | ⬜ |

More micro-fixes added as they are discovered during the audit.

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

## 9. Changelog

| Date | Change | Author |
|---|---|---|
| 2026-04-14 | Document created. Supersedes v2 wizard plan. | Claude |

---

*This plan is the source of truth for all Phase 12 v3 work. When
reality and this document disagree, fix the document first.*
