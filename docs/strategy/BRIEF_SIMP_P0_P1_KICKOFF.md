# CODE KICKOFF BRIEF — PROD Simplification, Phases P0 + P1 (consolidated)

**For:** a fresh Code session · **Model: Fable 5** (both phases are mechanical and fully specified; no diagnosis work — Opus not required) · **Kind:** BUILD (P0 docs/trackers → P1 module gate).
**Prepared by:** Matrix HQ (Cowork), 2026-08-04 · **Pinned HEAD:** `c589b557` (merge of #1584 — the plan is now on main).
**Spec of record:** `docs/strategy/PROD_SIMPLIFICATION_PLAN.md` — **the plan wins any disagreement with this brief.** This brief only adds carry texts, build order, and gotchas a fresh session shouldn't rediscover.

**Boot first (standard ritual, then):** read the plan top to bottom (it is short) — cursor block, §0 decision record, §2 keep/hide tables, §3-4 design, P0/P1 checklists. Do NOT read the 884KB implementation-plan spokes wholesale; range-read only what P0.1 touches.

---

## Scope of this brief

ALL of P0 and ALL of P1. **STOP at P2** — the flip/deploy verification is Reza-side. Deliver as **two PRs off main: PR-A (P0, docs/trackers only) and PR-B (P1, product code)**, in that order. PR-B may start before PR-A merges but must rebase on it.

**Hard lines (from the plan + CLAUDE.md; violations are defects):**
- P1 flips NOTHING: every new flag key ships `enabled:false`; PROD behaviour is byte-identical until Reza flicks switches. `changesNumbers: NO` by contract — if the golden self-diff says otherwise, that IS the defect (plan §6).
- Never fix a number in passing (§23.2.1). Wrong number found → registry issue, MON-131 discipline, not an inline patch.
- Hidden ≠ deleted. No file deletions of module code anywhere in this work.
- Do not touch `.github/workflows/`, MON-131 tranche work, the ledger, or T3.
- P1 paths (`lib/featureFlags/**`, `lib/navigation/**`, `app/**`, `prisma/seed-feature-flags.ts`) are clear of the MON-131 ledger gate. If you find yourself editing `docs/architecture/contracts/`, `docs/verification/**` or `scripts/matrix/` — stop; you have left the brief.
- §20.6 tri-axis + §16.5 doc-sync block in every PR body.

---

## PR-A — P0: Freeze & preconditions (docs/trackers only)

### P0.1 — land the tracker rows (carry texts, verbatim)

**`docs/implementation/01_ACTIVE_WORKSTREAMS.md`** — add under Active Workstreams (position: directly after the 0·REF MON-131 entry):

```
### 0·SIMP. PROD Simplification — the first Monitrax (property scoreboard v1)
- **Status:** 📋 PLAN LANDED (#1584, merged 2026-08-04) — P0 in progress.
- **Started:** 2026-08-04 · **Owner:** Code (build) · Reza (switches, merges, P0.4 answer) · Matrix (golden self-diff verdicts, Ring-3).
- **Spec of record:** `docs/strategy/PROD_SIMPLIFICATION_PLAN.md` — a TRACKING doc; its cursor block is the state, its checkboxes are the progress. This entry is a pointer, not a duplicate (SSOT).
- **Why:** Reza's 8 rulings + 3 directives (plan §0), Q-SCOPE-1 (#1577), scope filter. Simplification runs BEFORE MON-131 T3 (sequence change 2026-08-04).
```

**`STATE.md`** — add to the cursor area (do not restructure the file):

```
**PROD SIMPLIFICATION (2026-08-04):** plan + decision record at `docs/strategy/PROD_SIMPLIFICATION_PLAN.md` (#1584, merged). 8 rulings taken (hide household cashflow · tax · CFO · Home/Housekeeping · Investments; safe entity default; Preview copy w/ §13.6 amendment + CDR sunset; WIP=1 freeze). Flag-phase acceptance = CLEAN golden self-diff. Next: P0→P1 (kickoff brief).
```

**Hub:** bump `Last updated` in `docs/IMPLEMENTATION_PLAN.md`.

**Q-SCOPE-1 row:** land the still-unwritten `Q-SCOPE-1` Open-Questions row in `docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md` — exact row text is in **PR #1577's body** (standing gotcha since 2026-08-03). Mark it DECIDED 2026-08-04 with a pointer to plan §0.

### P0.2 — freeze rule into STATE.md (verbatim, same PR)

```
**SCOPE FREEZE (Reza 2026-08-04):** modules hidden by PROD_SIMPLIFICATION_PLAN.md §2.2 get no work, no fixes, no new issues; registry entries → HELD. Exception: THE one module in active development (WIP limit = 1). Re-enable = R-stage gate only.
```

### P0.3 — CLAUDE.md §13.6 amendment (verbatim, same PR)

Append to §13.6's synthetic-data rule:

```
**§13.6 exception (Reza 2026-08-04):** a one-way PROD→dev copy of Reza's own account data is permitted for hidden-module development under PROD_SIMPLIFICATION_PLAN.md §7. This exception SUNSETS permanently the day any CDR/Basiq-sourced data lands in PROD; from that day dev reverts to synthetic-only and the copy is purged.
```

### P0.4 — Vercel Preview env check → **REZA-SIDE; do not block on it.** Ask in the PR body: "Is `NEXT_PUBLIC_ADMIN_PORTAL_ENABLED` set on Preview scope? (`vercel env ls`)". Record the answer in the plan's P0.4 box. It gates the D-7 Preview workflow, not the PROD hide.

### P0.5 — PR #1577 flip → **Reza merges #1577** (its trigger — keep list ruled — is met). After merge, one commit: flip that doc's status line 🟡 RECOMMENDATION → ✅ DECIDED (2026-08-04), pointer to plan §0. If Reza hasn't merged by PR-A time, note it and move on — do not block.

### P0.6 — registry re-count: current OPEN/FIXING/critical counts from `docs/issues/ISSUES.md` at your HEAD; record the delta vs 63/135 in the plan (one line, §0 area or P0.6 box).

**PR-A also updates the plan itself:** tick P0 boxes done, update cursor block (`Current phase: P0 → done / P1 in build`), append §9 session-log line. Every later PR does the same for its slice — this is the tracking contract.

---

## PR-B — P1: the module gate (product code; nothing flips)

Build exactly to plan §§2-4. Suggested order (each step compiles + tests green before the next):

1. **P1.1** `lib/featureFlags/moduleRegistry.ts` (§3 shape; keys + navHrefs + routePrefixes from §2.2; apiPrefixes empty until step 2) → `lib/featureFlags/moduleGate.ts` (`isModuleEnabled(key)`, keyed Map cache 30s TTL, fail-closed = hidden; `isBasiqEnabled` alias preserved — 10 call sites must not churn).
2. **P1.2 API audit (do this before writing any API guard).** Method: for each §2.3 gate candidate, `grep -rn` its `/api/<prefix>` across §2.1 kept pages/components/hooks + `lib/` server code. Gate ONLY prefixes with zero kept callers. Record the final table **in plan §2.3, same PR** — including the two named careful cases: `tax` (the pack must read tax lib code server-side, never the gated route) and `master-snapshot` (expect zero kept callers — verify, don't assume).
3. **P1.3** `moduleKey?` on `NavItem` (`trailNav.tsx:35-44`), keys onto §2.2 nav items (children too — e.g. My Wealth keeps Properties/Assets, loses Investments/Super), filter in `EditorialSidebar.tsx:82`, and **fix `mobileMoreItems`'s non-null `.find()` (`trailNav.tsx:382-385`)** — it throws the moment an item disappears. Mobile tab bar: verify `mobileTabBarKeys` tolerates hidden entries too.
4. **P1.4** `moduleRouteGuard(key)` → layout-level `notFound()` per hidden module; `MODULE_HOME` = `redirect('/dashboard/properties')` in the root dashboard page/layout (never 404 the root); API guard returning 503 on audited prefixes. Server-side only — `middleware.ts` cannot do this (Edge, no Prisma).
5. **P1.5** `GET /api/feature-flags/modules` + `useModuleEnabled(key)` starting disabled (Basiq client pattern).
6. **P1.6** unconditional cache invalidation in the PATCH hook (`app/api/admin/feature-flags/[key]/route.ts:167-169` — currently Basiq-hard-coded).
7. **P1.7** seed all §2.2 keys `enabled:false` in `prisma/seed-feature-flags.ts` — preserve the never-overwrite-`enabled` update path exactly.
8. **P1.8** Admin **Modules panel** (plan §4.4): row per registry key — label, HIDDEN/LIVE, return stage, last-flipped time + actor (existing audit log), the existing working toggle wired to module keys; freeze-rule copy on the panel. **Remove the dead Edit / Overrides / "Create Override" controls and the per-tier/percent display columns** (§4.5 — UI only, schema untouched).
9. **P1.9** tests: gate unit (fail-closed, keyed cache, invalidation) · nav filter (hidden keys absent, kept present, mobile no-throw) · guards (404/503/redirect per state).

**P1.10 acceptance — HANDBACK, not yours to run:** open PR-B with CI green and everything above, then hand back to Matrix HQ (Cowork) for the golden-baseline self-diff verdicts vs `.audit/golden-baseline-12954ff.json` (ship-state + flags-on-in-Preview; both must be `CLEAN`). The verdicts get recorded in the PR body before Reza merges. If you want a local pre-check: `npx tsx scripts/matrix/golden-baseline.mjs` with DATABASE_URL, but the verdict of record is the Matrix run.

**Gotchas carried from planning:**
- Only HIDDEN modules get keys — kept surfaces stay unflagged/unconditional (DB outage must never hide the kept app).
- `/api/expenses`, `/api/income`, `/api/loans`, `/api/ownership`, `/api/transactions`, `/api/documents` stay OPEN (in-context property editing depends on them) even though their list pages hide.
- The Sankey *widget* is already stripped (#1579); the `money-flow` API's intake side stays.
- `GlobalFeatureFlag` rows hold ONLY on/off; the registry holds meaning. No schema change anywhere in P1 — if you think you need one, stop and hand back.

**Done =** PR-A + PR-B open, plan checkboxes ticked in the same PRs, cursor current, §20.6/§16.5 blocks in both bodies, handback posted for P1.10.
