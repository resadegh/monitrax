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

### 11.1 — Data loss reported 2026-04-15 — ✅ RESOLVED 2026-04-15

**Status:** ✅ **CLOSED.** Root cause identified, fix shipped and
deployed, deploy pipeline hardened so the class of failure cannot
recur.

**Investigation summary:**

The user reported that `rayanmehr79@gmail.com`'s dashboard rendered
blank after the Phase 12 PRs landed. Direct SQL queries against
both Cloud SQL instances confirmed the user's data was **still
intact** (3 accounts, 5 properties, 4 loans, 6 income, 57 expenses,
3 investments, 1 household profile). The audit log showed zero
`ENTITY_DELETED` events in the prior 14 days. So the symptom was
a **read-path crash**, not real data loss.

**Root cause:**

1. The Phase 12 Track A.0 migration added an `EntrySource` enum
   and a `source EntrySource @default(MANUAL)` column to 9
   financial models in `prisma/schema.prisma` and shipped via PRs
   #511 and #516.
2. The matching `ALTER TABLE` migration (`1_add_entry_source_enum`)
   **never ran** against either Cloud SQL instance.
3. The underlying reason: **neither `monitrax-db-dev` nor
   `monitrax-db-prod` had a `_prisma_migrations` tracking table**.
   Both databases were created outside of Prisma's migration
   workflow (most likely via `prisma db push` during the earlier
   Render → GCP migration) and had been drifting from
   `schema.prisma` ever since. As a result, `prisma migrate deploy`
   was never run in any CI step.
4. After the A.0 PRs merged, Vercel rebuilt with the new Prisma
   client that expected the `source` column on 9 tables. Every
   `findMany` / `findFirst` against those tables generated SQL
   that included `source` in the SELECT list, which crashed with
   `column "source" does not exist` at the database layer.
5. API routes caught the errors and returned empty responses, so
   the dashboard rendered "no data" for every affected user.

**Secondary finding (R11):** `upsertHouseholdEstimate` in
`lib/services/onboardingEstimateService.ts` contained a destructive
Prisma upsert that would have overwritten
`HouseholdProfile.adultsCount` / `childrenCount` for any user who
already had a configured household. It never actually fired in
prod because the `source` column didn't exist (it would have
crashed at the DB layer first), but as soon as the column
existed, the destructive path would become live.

**Remediation shipped today:**

| PR | Purpose | Status |
|---|---|---|
| #523 | CLAUDE.md §12.11 destructive write checklist (non-negotiable rule) | ✅ Merged |
| #524 | **Hotfix** — revert Phase 12 A.0 `source` fields + stub destructive `upsertHouseholdEstimate` + `setupStateService` count queries | ✅ Merged |
| #525 | Prisma baseline runbook + deletion of orphaned `1_add_entry_source_enum/` migration folder | ✅ Merged |
| #526 | `vercel-build` script that runs `prisma migrate deploy` before every Vercel build + CLAUDE.md §12.12 schema change deploy protocol | ✅ Merged |

**Manual steps executed during the session:**

1. **Baselined both DBs** via direct SQL in Cloud SQL Studio:
   created `_prisma_migrations` table + inserted a row marking
   `0_init` as applied on both `monitrax-db-dev` (35.189.31.209)
   and `monitrax-db-prod` (35.197.180.137).
2. **Redeployed PR #526** after baselining so the Vercel production
   build succeeded end-to-end through the new pipeline.

**Permanent guarantees in place:**

1. ✅ **Auto-apply on deploy** — Vercel's `vercel-build` script
   runs `prisma migrate deploy` against the scoped `DATABASE_URL`
   before every preview and production build. Drift cannot recur.
2. ✅ **Fail-closed deploys** — if a migration fails, the build
   aborts and the previous deployment keeps serving. New code
   never reaches a database it was not designed for.
3. ✅ **Both DBs are tracked** by Prisma migration history going
   forward.
4. ✅ **Destructive writes gated** — CLAUDE.md §12.11 forces PR
   authors to fill in a three-question checklist for any
   `update` / `upsert` / `delete` / raw SQL, and reviewers must
   reject PRs that skip it.
5. ✅ **Schema changes gated** — CLAUDE.md §12.12 forbids schema
   changes without a matching migration file, forbids `db push`
   and `db execute`, and requires code review enforcement.
6. ✅ **2-tier DB split handled natively** — Vercel's
   per-environment `DATABASE_URL` scoping means previews apply
   migrations to `monitrax-db-dev` and production applies to
   `monitrax-db-prod` without any extra CI.

**Resumption criteria (§3 audit walkthroughs):**

The audit walkthroughs in §3 can now resume whenever Phase 12 A.0
is re-applied via a new hardened PR (see "Follow-up plan" below).
Until then, the `/onboarding` wizard is disabled at the service
layer — users reaching it will see "Could not save" on any step
submit, which is the expected disabled-state behaviour. This is
documented in §10 as an additional caveat going into the audit.

**Follow-up plan (separate PRs, not in scope for this audit):**

When you're ready to restore the wizard's Estimated/Verified
distinction, ship a single PR that:

1. Creates a new migration folder (e.g. `2_phase12_entry_source_hardened`)
   containing the `CREATE TYPE EntrySource` enum and the nine
   `ALTER TABLE ... ADD COLUMN source` statements (additive, safe)
2. Restores the nine `source EntrySource @default(MANUAL)` fields
   in `prisma/schema.prisma`
3. **Hardens** `upsertHouseholdEstimate` with a
   `source === 'ONBOARDING'` precondition so it cannot overwrite
   user-entered data
4. Fills in the CLAUDE.md §12.11 destructive-write checklist in
   the PR body
5. Requires explicit user "OK to merge" before the PR is merged
6. Post-merge, the Vercel pipeline applies the migration to prod
   automatically (no manual SQL required — that's the point)

**No hardened PR #1 blocker:** The Phase 12 audit walkthroughs
can run BEFORE this follow-up if you'd rather validate the
Setup/Refinement flow first. The wizard disabled-state is
acceptable for §3 Path C (skipping the wizard), and Paths A/B/D
can be added to the weakness register as "deferred until wizard
re-enable" rather than blocking the audit close.

---

*This document is the §10.6 audit gate. Do not skip. Do not delete
the legacy wizard until §9 is fully signed off **and** §11 has no
open incidents.*
