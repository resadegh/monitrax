# STATE.md — Monitrax "You Are Here"

> **This is the first file EVERY session reads, on EVERY surface (chat · Cowork · Code), BEFORE anything else.**
> It is not a substitute for the canonical docs — it is the pointer to them plus the current cursor.
> **Prime directive: read live, never recall.** No claim about Monitrax is made from memory; it is read
> from the repo at the pinned HEAD, or it is flagged unverified. Memory and any project-knowledge cache are
> NEVER ground truth — only live `resadegh/monitrax` HEAD is.
> **No session is notified of anything.** Merge-awareness and "what changed" are a session-start PULL, never a subscription.

**Last verified against HEAD:** `25180ea` · **on:** 2026-06-14 · **by:** Code session (Phase 2 PR-A — plan/index hygiene)
**Freshness gate:** on session start, compare this HEAD to live `git rev-parse HEAD`. If they differ,
the repo moved — re-verify the cursor below against the live plan BEFORE acting. Do not trust a stale cursor.

---

## A. WHAT MONITRAX IS  (north-star — for detail, see `docs/blueprint/MASTER_BLUEPRINT.md`)

- **Product:** Monitrax (monitrax.com.au) — an Australian Wealth Operating System. Brings property, loans,
  super, investments, cashflow, tax position and entity structures into one picture so users can model the next move.
- **Built by:** Reza, under ReNew Holding Company Pty Ltd (ACN 675 267 311).
- **Regulatory boundary (HARD):** a financial *information* service, NOT a licensed adviser. Surfaces maths and
  mechanisms; never gives personal financial advice, recommends products, or implies licensing not held.
  Respects the AFSL/Credit/Tax boundary + CDR. *(Confirm current ICP/positioning live — see cursor SEC C.)*

## B. THE MAP  (authority order — full registry in `docs/00_INDEX.md`)

0. `SYSTEM_MAP.md` (repo root) — **orientation pointer-map.** What Monitrax is, every authoritative doc +
   what it owns, architecture overview, calc-engine inventory, tool stack. Start here after this STATE.md.
1. `CLAUDE.md` (repo root) — **law.** Governance, four-lens mindset, SSOT + single-calc-engine rule, warm-words,
   session protocol (Parts 1/7/10). When anything conflicts with CLAUDE.md, CLAUDE.md wins.
2. `docs/IMPLEMENTATION_PLAN.md` (hub) + `docs/implementation/*` (spokes) — **status SSOT.** Shipped / active /
   queued / blocked / reversed. Split from one 884 KB file into a thin hub + spokes (F-8, 2026-06-15) so each
   stays connector-writable: `01_ACTIVE_WORKSTREAMS` / `02_UP_NEXT` / `03_OPEN_QUESTIONS_AND_BACKLOG` /
   `04_RECENTLY_COMPLETED`. Start at the hub; read the relevant spoke. STATE.md holds the *cursor*; the spokes hold the *detail*.
3. `docs/00_INDEX.md` — **the map** of every doc. Start here to locate anything.
4. Topic authorities: architecture -> `docs/architecture/`; phases -> `docs/blueprint/MASTER_BLUEPRINT.md`;
   compliance -> `docs/compliance/`; GTM -> `docs/marketing/` (+ `docs/marketing/gtm/`); design -> Stitch system
   (`docs/design/`); calc engines -> `lib/calculations/*` + `lib/services/masterFinancialService.ts`.

## C. RESUME CURSOR  (regenerated at every session END — the live "where we are")

> Re-pinned 2026-06-15 by the Code Phase 2 PR-C session (HEAD `b8427a9`, after PR-B PR #1106 merged `671efee` -> `b8427a9`).
> Continuity Phase 0+1 is COMPLETE; Phase 2 governance audit is in flight (PR-A + PR-B merged, PR-C this session). Every claim below carries a live source.

- **Current focus:** Continuity **Phase 2 governance audit — IN PROGRESS (PR-C in flight; PR-A + PR-B merged).**
  Phase 0+1 are COMPLETE on main; PR-A (#1105) shipped F-3/F-4/F-7; PR-B (#1106) shipped F-5/F-6. PR-C closes the
  **plan-size rail** (F-8) + adds the **doc-hygiene CI** (F-1). The continuity workstream is a first-class plan
  entry (§0·CONT, now in `docs/implementation/01_ACTIVE_WORKSTREAMS.md`). The other live product workstream remains
  **Phase 47 — Entity Ownership Fabric** (`01_ACTIVE_WORKSTREAMS.md` §0·EOF).
- **Active task + stop-point:** This Code PR (**Phase 2 PR-C**, branch `claude/phase2-prc-plan-split`):
  **F-8** — split the 884 KB `IMPLEMENTATION_PLAN.md` into a thin hub + four `docs/implementation/` spokes
  (`01_ACTIVE_WORKSTREAMS` / `02_UP_NEXT` / `03_OPEN_QUESTIONS_AND_BACKLOG` / `04_RECENTLY_COMPLETED`); the 86 KB
  historical preamble narrative moved to `IMPLEMENTATION_CHANGELOG.md`; hub stays the canonical entry point so the
  ~90 casual references resolve unchanged; CLAUDE.md §15.5/§1.5, SYSTEM_MAP, 00_INDEX, the continuity-gate + STATE
  Map all updated. **F-1** — two soft-launch CI checks (`scripts/check-plan-freshness.sh` +
  `scripts/check-index-paths.sh`, wired in `.github/workflows/docs-hygiene.yml`): header-date freshness + 00_INDEX
  coverage. **Stop-point:** PR open for Reza review — NOT merged.
- **Immediate next action:** (1) Reza review + merge this PR-C. (2) **Plan hygiene pass** — retire the completed
  §0x workstreams (0·WI/0·DG/0·StD/0·WX) from `01_ACTIVE_WORKSTREAMS` → `04_RECENTLY_COMPLETED`, and roll >30-day
  completions into `IMPLEMENTATION_CHANGELOG.md`, to bring both over-budget spokes under the §15.5 limit (tracked:
  Backlog row 33). (3) **Index-completeness pass** — clear the 5 residual `check-index-paths.sh` soft warnings.
  (4) **Reza decision on Q-GTM-3** (first aggregator — rec Finsure first, Connective second). (5) Grant GitHub
  `workflow` scope so `continuity-gate.yml` + `docs-hygiene.yml` can be armed (`--strict`).
- **Open decisions / blockers:**
  - **Q-GTM-3 (first aggregator) — STILL OPEN.** No Reza decision recorded; the live plan says "Needs Reza
    decision before Step 2.2." Claude **recommendation = Finsure first, Connective second** (this is a
    recommendation, not a decision — cache/memory "Finsure?" was the rec, never a ruling).
    (`IMPLEMENTATION_PLAN.md`:1314 Open-Questions row · :582 §0d · :1328 open-as-of.)
  - **Q-DEC (Float -> Decimal) — DECIDED 2026-05-24 (Reza), migration v1 STRUCTURALLY COMPLETE 2026-06-09.**
    Final architecture: Prisma stores Float; engines convert at the boundary via `lib/decimal/`
    (`Decimal` = `Prisma.Decimal`, decimal.js `ROUND_HALF_EVEN`) and compute in Decimal; Q-DEC PR4 dropped
    the *dormant* `*_decimal` columns (INVERSE of the original Float-drop plan). The **precision gate on
    `/wealth-check` paid traffic is satisfied**; remaining `/wealth-check` traffic-on gates are
    Q-HOOK-AFSL (lawyer sign-off) + Q-HOOK-BENCHMARK (benchmark-refresh owner) — compliance/benchmark, NOT
    precision. (`IMPLEMENTATION_PLAN.md`:1315 + :276–281 §0·WI · :1328.)
  - **GitHub `workflow` scope NOT granted** — blocks `.github/workflows/continuity-gate.yml` and the Phase 4
    test-runner workflow.
  - **884 KB `IMPLEMENTATION_PLAN.md` cannot be written via the GitHub connector in one call** — its
    in-place edits must come from a git-capable session. **This F-8 Code session did exactly that**
    (sed + targeted Edit, no whole-file overwrite). The structural fix (split the plan, or a patch-capable
    connector path — finding F-8) remains for Phase 2.
  - **CI has NO test-runner rail today** (`security-audit.yml` runs audit+lint+build only). Phase 4
    regression suite needs a CI job.
  - **Doc drift / SSOT findings** logged in `docs/audits/PHASE1_INGESTION_FINDINGS_2026-06-14.md` (input to
    the Phase 2 governance audit).
- **Verified-live this session (HEAD 6c0ff92):** RESUME CHECK — since the prior cursor HEAD `3eaeb90`, two
  tracked PRs that were OPEN at the last cursor have merged to main: the continuity PR #1102
  (`claude/phase1-deep-ingestion-system-map`) = `9e36425`, and the Phase 47 active-workstream PR #1099
  (Stage E2) = `6c0ff92`. The cursor is reconciled forward to `6c0ff92`. (Earlier hop: PR #1101 merged
  `f38bb80` -> `3eaeb90`, re-landing the RESUME CHECK ritual dropped from #1100.) `IMPLEMENTATION_PLAN.md` =
  884 KB / 1741 lines. Calc engine confirmed: orchestrator `lib/services/masterFinancialService.ts`; 10 modules in
  `lib/calculations/`; engine families `tax-engine` / `cfo` / `health` / `cgt` / `cashflow` / `intelligence`
  / `wealthCheck` / `decimal` / `calc-audit`. Stack: Next.js 15.5.19 · React 19 · Prisma 5.22 / 130 models
  · GCP + Vercel(syd1) · Gemini + Anthropic SDK.

## D. THE SESSION RITUAL  (all surfaces; Code ALSO follows CLAUDE.md Parts 1/7/10)

**START (before any work):**
0. RESUME CHECK. List open + recently-merged PRs on `resadegh/monitrax` (GitHub connector). If a tracked PR
   (continuity / plan / workstream) merged since this cursor's HEAD, pull the new HEAD, read what changed, and
   continue from the updated next action. There is NO notification — this pull is how a session learns a PR merged.
1. Pull live HEAD. Run freshness gate (above).
2. Read this STATE.md -> then CLAUDE.md -> then the relevant `IMPLEMENTATION_PLAN.md` section for the active task.
3. Print a <=5-line orientation: what Monitrax is (1 line) - current task (1) - next action (1) - blockers (1) - HEAD (1).
4. Open a session ledger (verified-vs-unverified, pinned to HEAD).

**DURING (every response):**
- **Cite or stop.** No state claim without a this-session source (`file:line` / tool result / HEAD). Can't cite -> flag unverified + re-pull.
- **Re-pull, don't recall.** Uncertain = read it again. Recollection is the silently-wrong option.
- **One unit at a time.** Close + write the finding before opening the next. Never hold "the whole app" in context.
- **Standing compliance check.** Anything touching user-facing money language -> AFSL/CDR boundary check before it ships.

**END (before closing):**
1. Update the RESUME CURSOR (Section C) — new HEAD, what changed, exact stop-point, next action, blockers.
2. Update `IMPLEMENTATION_PLAN.md` + changelog in the SAME PR (CLAUDE.md Sections 15/16.5).
3. Leave the next action explicit enough that a cold session resumes in <1 min.

## E. HOW THIS STAYS TRUE  (integration + enforcement)

- **Owns:** current position (cursor) + the universal session ritual. **Defers to:** CLAUDE.md (law),
  IMPLEMENTATION_PLAN (detail), 00_INDEX (map), SYSTEM_MAP (what-owns-what). No content is duplicated from
  those here — only pointers + position.
- **Enforced by:** (a) `.claude/hooks/session-start.sh` prints this cursor + HEAD at the start of every Code session
  (skip-on-failure, never blocks the session); (b) `.github/workflows/continuity-gate.yml` fails a PR that changes
  workstream files without updating STATE.md + IMPLEMENTATION_PLAN in the same PR (soft-launch first, then required;
  workflow scope still PENDING); (c) chat/Cowork: read-STATE-first is the hard first instruction (project instructions Section 0).
- **Update cadence:** cursor every session end; Section A/Section B only on a real change, via PR, never ad hoc.
