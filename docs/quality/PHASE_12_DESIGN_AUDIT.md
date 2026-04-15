# Phase 12 — Design Quality Audit (Track D.0)

> **Mandatory §10.6 quality check.** This document is the formal
> design audit gate before Track C.2 (legacy wizard cleanup) ships.
> All P0 + P1 weaknesses must be fixed (or explicitly deferred) before
> the audit signs off.

**Owner:** Claude (engineer) → Reza (final sign-off)
**Status:** 🟡 In progress — awaiting end-to-end walkthrough
**Plan reference:** `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md` §7 Track D
**Blocks:** Track C.2 legacy `WizardContainer` cleanup
**Created:** 2026-04-15

---

## 1. Purpose

Track D.0 is the §10.6 mandatory design quality check on the entire
twin-track Phase 12 experience before any legacy code is deleted.
The audit walks every user path end-to-end against the §10 design
standards from the twin-track plan and produces a written list of
weaknesses with severity ratings and proposed fixes.

This is the **only audit gate** between "the new flow is shipped"
and "the legacy wizard is deleted". Skipping this audit means
shipping legacy cleanup blind.

---

## 2. Audit dependencies

This audit cannot start until **all** of the following are merged
on `main`:

- [x] **Track A complete** — A.0 schema, A.1 service, A.2-A.5 visual
  refinements, A.6 modal shell, A.7-A.12 guided flows
- [ ] **Track B complete** — #515 (B.0-B.2), #516 (B.3-B.7), #517 (B.8)
- [ ] **Track C.0/C.1 routing** — #518 (welcome modal + resume
  banner + auto-redirect routing to `/onboarding`)

When all three checkboxes are ticked, the auditor (Reza) can begin
the §3 walkthroughs.

---

## 3. Walkthrough paths

The audit covers four user paths. Each must be walked end-to-end on
production (or staging that mirrors production) and screenshotted
at every step.

### 3.1 Path A — Fresh user signup

| Step | Surface | Expected behaviour | Observed | Pass/Fail |
|---|---|---|---|---|
| 1 | `/signin` → signup form | New user creates account | — | ⬜ |
| 2 | Redirect to `/dashboard` | Dashboard loads | — | ⬜ |
| 3 | Welcome modal pops | Modal shows greeting + "Start guided setup" CTA | — | ⬜ |
| 4 | Click "Start guided setup" | Routes to `/onboarding` | — | ⬜ |
| 5 | Welcome step renders | 3 value-prop cards + primary CTA | — | ⬜ |
| 6 | Click "Start guided setup" | Advances to Household step | — | ⬜ |
| 7 | Household step | 3-option segmented (Just me / Partner / Family) | — | ⬜ |
| 8 | Pick option → Continue | Writes `HouseholdProfile` with `source: 'ONBOARDING'`. Advances to Income | — | ⬜ |
| 9 | Income step | Currency input | — | ⬜ |
| 10 | Enter monthly income → Continue | Count-up feedback ("That's about $X per year"). Writes `Income` row | — | ⬜ |
| 11 | Housing step | 3-option segmented (Own / Rent / Family) | — | ⬜ |
| 12 | Pick → Continue | Audit log written. Advances to Expenses | — | ⬜ |
| 13 | Expenses step | Currency input + skip option | — | ⬜ |
| 14 | Enter or skip → Continue | If entered: count-up feedback. Advances to Goal | — | ⬜ |
| 15 | Goal step | 3-option segmented (Save / Reduce debt / Grow wealth) | — | ⬜ |
| 16 | Pick or skip → Continue | Advances to Final Reveal | — | ⬜ |
| 17 | Final Reveal loads | Hero net-worth count-up + 3 secondary metrics + insight line | — | ⬜ |
| 18 | Click "Continue setting up" | Marks `onboardingCompleted = true`. Routes to `/dashboard/setup` | — | ⬜ |
| 19 | `/dashboard/setup` loads | SetupNextActionPanel + tray + 6 tiles with confidence badges | — | ⬜ |
| 20 | Tiles for filled modules | Show "Estimated" amber badge | — | ⬜ |

### 3.2 Path B — Returning incomplete user (silent resume)

| Step | Surface | Expected behaviour | Observed | Pass/Fail |
|---|---|---|---|---|
| 1 | Quit mid-wizard at e.g. Income step | Browser closed | — | ⬜ |
| 2 | Re-sign in | Land on `/dashboard` | — | ⬜ |
| 3 | Auto-redirect fires | Routes to `/onboarding` (not stuck on `/dashboard`) | — | ⬜ |
| 4 | Wizard renders | Currently always starts at Welcome (silent resume to actual step is a follow-up) | — | ⬜ |
| 5 | Walk through to completion | Same as Path A from step 5 | — | ⬜ |

### 3.3 Path C — Skipping the wizard

| Step | Surface | Expected behaviour | Observed | Pass/Fail |
|---|---|---|---|---|
| 1 | Welcome modal pops | Greeting visible | — | ⬜ |
| 2 | Click "Skip for now" | Modal dismisses | — | ⬜ |
| 3 | Land on `/dashboard/setup` | Refinement engine renders without estimates | — | ⬜ |
| 4 | All tiles show "Missing" state | No confidence badge | — | ⬜ |
| 5 | Click any tile CTA | Opens the matching guided modal flow | — | ⬜ |
| 6 | Complete the modal flow | Writes a real entity row with `source: 'MANUAL'`. Tile flips to "Verified" | — | ⬜ |

### 3.4 Path D — Legacy escape hatch

| Step | Surface | Expected behaviour | Observed | Pass/Fail |
|---|---|---|---|---|
| 1 | Visit `/dashboard?legacy=wizard` | URL respects escape hatch | — | ⬜ |
| 2 | No auto-redirect | Stays on `/dashboard` | — | ⬜ |
| 3 | Welcome modal pops (if applicable) | Legacy WizardContainer modal opens on click | — | ⬜ |
| 4 | Walk through legacy wizard | Existing 8-step bulk-create flow still works | — | ⬜ |

---

## 4. §10 design standards checklist

For **each step** of the wizard (Welcome through Final Reveal),
verify against §8 of the twin-track plan. One check per step.

### 4.1 Visual hierarchy (§8.1)

- [ ] Title is the largest element (~48px on desktop, ~36px on mobile)
- [ ] Supporting line is one rank below the title in size and weight
- [ ] One single primary CTA per screen, no competing secondaries
- [ ] No multi-column layouts in any wizard step
- [ ] Content centred at `max-w-[520px]` (Final Reveal at 620px)
- [ ] Generous vertical breathing room (≥ 120px top/bottom)
- [ ] No clutter — no debug pills, no version badges, no developer chrome

### 4.2 Motion (§8.2)

- [ ] Step transitions: ~280ms fade + slight vertical slide, ease-out cubic
- [ ] Number count-ups: 600-800ms for per-step feedback
- [ ] Final Reveal hero count-up: 1000-1400ms with stagger
- [ ] Progress bar: 400ms width transition
- [ ] **No bounce, no spring easings anywhere**
- [ ] All animations honour `prefers-reduced-motion: reduce` (verify via DevTools)

### 4.3 Micro-interactions (§8.3)

- [ ] Every step has at least one micro-feedback moment
- [ ] Income / Expenses steps show a count-up confirmation line after submit
- [ ] Segmented controls have a clear visual selected state
- [ ] CTAs have hover-lift (`-translate-y-[1px]`) and shadow expansion
- [ ] Focus rings visible on all interactive elements

### 4.4 Final Reveal (§8.4) — the most important moment

- [ ] **Visibly stronger** than every prior step
- [ ] Wider container (620px vs 520px)
- [ ] Ambient gradient glow behind the content
- [ ] Hero net-worth at 6xl/7xl with gradient clip-text
- [ ] Three secondary metrics in a 3-column grid below
- [ ] Insight line in a callout card with subtle indigo accent
- [ ] Staggered entry animation (0 / 200ms / 400ms / 600ms delays)
- [ ] User reaction test: "does this feel like a moment, not just another screen?"

### 4.5 Consistency (§8.5)

- [ ] Wizard inherits Monitrax gradient tokens (blue → indigo → violet)
- [ ] No conflicting brand colours
- [ ] Routing back to `/dashboard/setup` feels like the same product
- [ ] `/dashboard/setup` refinements (tiles, badges, modals) inherit the same gradient
- [ ] Dark mode renders correctly throughout

### 4.6 Hard guardrails (§8.6 — auto-fail if violated)

- [ ] **No Shadcn defaults in the wizard** (dashboard OK; wizard uses bespoke primitives)
- [ ] No multi-column layouts on any wizard step
- [ ] No icons-as-decoration (only meaning-bearing icons)
- [ ] No bounce / spring easings anywhere
- [ ] No loading spinners on step transitions
- [ ] No developer chrome

---

## 5. Mobile-responsive checks

Test on three viewport widths via DevTools or a real device:

| Viewport | Welcome | Household | Income | Housing | Expenses | Goal | Final Reveal |
|---|---|---|---|---|---|---|---|
| 375px (iPhone SE) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 414px (iPhone 14 Pro) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 768px (iPad portrait) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

For each cell, verify:
- No horizontal scroll
- All text readable (no overflow / truncation)
- CTAs hit-able with thumb (≥ 44×44px)
- Top bar (logotype + exit) collapses gracefully

---

## 6. CDR + audit compliance check

- [ ] Audit logs emitted on every step (`ONBOARDING_STEP_COMPLETED`)
- [ ] Audit metadata is **sanitized** — verify the recorded entries contain step name only, NO amounts, NO balances, NO identifiers beyond user ID
- [ ] No CDR data in any log line (`grep` server logs for monthly/balance values during a walkthrough — should find zero)
- [ ] Onboarding-tagged rows have `source: 'ONBOARDING'` (verify via Prisma Studio or DB query)
- [ ] Refining an estimated row to verified does NOT lose the estimated history (currently the pattern overwrites — note as P2 if the team wants reconciliation)

---

## 7. Performance check

- [ ] Cold load of `/onboarding` < 1500ms on 4G throttle
- [ ] Step transition < 100ms perceived latency
- [ ] Final Reveal API call < 800ms (the snapshot fetch)
- [ ] No console errors on any step
- [ ] No React hydration warnings
- [ ] No unhandled promise rejections

---

## 8. Weakness register

Fill this in as the walkthrough surfaces issues. Severity rules:

- **P0 — Blocker.** Must fix before Track C.2 cleanup. Examples:
  flow can't be completed, data loss, broken navigation, accessibility
  failure, CDR data leak.
- **P1 — Must-fix.** Should fix before Track C.2 but acceptable to
  defer with explicit tracking. Examples: visible jank, off-brand
  styling, missing dark-mode coverage, copy that doesn't match the
  voice, animation that violates §8.6.
- **P2 — Polish.** Nice to have. Defer to a follow-up. Examples:
  microcopy improvements, illustration upgrades, better empty-state
  copy, additional micro-interactions.

| ID | Path / Step | Description | Severity | Proposed fix | Status |
|---|---|---|---|---|---|
| (none yet) | | | | | |

---

## 9. Sign-off

| Section | Signer | Status | Date |
|---|---|---|---|
| §3 walkthroughs complete | Reza | ⬜ | — |
| §4 design standards verified | Reza | ⬜ | — |
| §5 mobile checks complete | Reza | ⬜ | — |
| §6 CDR compliance verified | Reza | ⬜ | — |
| §7 performance verified | Reza | ⬜ | — |
| §8 weakness register triaged (all P0/P1 closed or deferred) | Reza | ⬜ | — |

**Final sign-off required to unblock Track C.2 legacy cleanup:**

> _Approved by: ________________________ on ________________

When all sign-off rows are checked, this audit is complete and Track
C.2 (delete `WizardContainer` + step files + primitives + resume
banner + ambient tint CSS + bulk-create API + legacy `/app/onboarding`
artifacts) ships in a single follow-up PR.

---

## 10. Known caveats going into the audit

These are known limitations or partial states going into the audit
that should not be flagged as P0/P1 weaknesses:

1. **Silent resume** — the wizard always starts at Welcome on resume
   (does not jump to the user's last completed step). This is
   intentional for the first cut and tracked as a follow-up after
   audit closes.

2. **Final Reveal insight uses simple math** — `cashflow * 12`. No
   Gemini, no insight engine. Per Q8 in the plan, this is by design.

3. **Goal step writes audit-only** — there is no Prisma model for
   user goals today. The goal selection lives in the audit log
   metadata. A future schema addition could hoist it to a real
   field.

4. **Housing step writes audit-only** — same reason. Housing
   situation lives in the audit log; the `HouseholdProfile` row
   gains `source: 'ONBOARDING'` but no housing-specific column.

5. **`onboardingEstimateService` is idempotent on Income/Expenses
   only** — Household and Housing upsert via the natural unique key
   on `userId`. Goal does not write a Prisma row at all.

6. **Estimated rows feed `masterFinancialService` aggregates** —
   per Q4 in the plan, this is intentional: estimates are the user's
   best guess, useful for the Final Reveal. `/dashboard/setup`
   marks them with the amber Estimated badge so users know.

---

## 11. Open incidents (audit cannot proceed until resolved)

### 11.1 — Data loss reported 2026-04-15

**Status:** 🚨 Critical — investigation paused, awaiting user input.

**Summary:** A user with prior data on Monitrax appears to have all
data missing after the recent Phase 12 PRs landed on `main`. The
root cause has not been established. **No code work proceeds and
no further audit walkthroughs run until this is resolved.**

**Tracked in the plan as:** `PHASE_12_SETUP_AND_ONBOARDING.md`
§11 R12.

**Possibly-related destructive code shipped in this phase:**
`upsertHouseholdEstimate` in `lib/services/onboardingEstimateService.ts`
overwrites `HouseholdProfile.adultsCount` and `childrenCount` for
existing users when the wizard runs. The function was gated by an
auth-header bug (PR #521) that prevented it from running until
that PR merged. So the *timing* of when this could have caused
data loss matters — if loss was observed *before* #521 merged,
it cannot be the cause; if *after*, it is the prime suspect.
Tracked as R11 in the plan.

**Investigation prerequisites before continuing the audit:**

1. Confirm whether the affected user's DB rows are actually gone
   versus just not displayed. Use Prisma Studio or a direct SQL
   count query against each financial table for the user's `userId`.
2. Audit Vercel/deployment logs for the migration command used:
   - `prisma migrate deploy` — **safe**, additive only
   - `prisma migrate reset` — **destructive**, drops all tables
   - `prisma db push` — **possibly destructive** depending on flags
3. Verify backup status: when was the most recent good backup of
   the affected user's tables?
4. Determine when the data was last seen intact (timestamp).
5. Cross-reference the timestamp against PR #521's merge time to
   see if R11 destructive code is in scope.

**What the audit will do after the incident closes:**

- If R11 was the root cause: harden `upsertHouseholdEstimate` so
  it cannot overwrite a verified `HouseholdProfile` (only update
  if `source === 'ONBOARDING'` or write to a separate field), then
  resume the audit walkthroughs.
- If a destructive migration command was run: triage the recovery
  path with the user, restore from backup, document the postmortem
  in this doc.
- If neither: dig deeper into shipped code paths for any bypass of
  the auth check that could have triggered the destructive write.

**Until §11.1 closes:** Track C.2 cleanup remains paused **even if
the §3-§7 walkthroughs would otherwise pass**. Deleting the legacy
wizard while a data-loss incident is open would compound the risk.

---

*This document is the §10.6 audit gate. Do not skip. Do not delete
the legacy wizard until §9 is fully signed off **and** §11 has no
open incidents.*
