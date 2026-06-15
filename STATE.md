# STATE.md — Monitrax "You Are Here"

> **This is the first file EVERY session reads, on EVERY surface (chat · Cowork · Code), BEFORE anything else.**
> It is not a substitute for the canonical docs — it is the pointer to them plus the current cursor.
> **Prime directive: read live, never recall.** No claim about Monitrax is made from memory; it is read
> from the repo at the pinned HEAD, or it is flagged unverified. Memory and any project-knowledge cache are
> NEVER ground truth — only live `resadegh/monitrax` HEAD is.
> **No session is notified of anything.** Merge-awareness and "what changed" are a session-start PULL, never a subscription.

**Last verified against HEAD:** `2ca4043` · **on:** 2026-06-15 · **by:** Cowork session (Phase 4 Layer 1 — vitest test-runner CI)
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

> Re-pinned 2026-06-15 by the **Cowork Phase 4 Layer-1** session (base HEAD `2ca4043` = merge of #1114).
> Phase 3 is structurally DONE (fix PR1 #1113 + fix PR2 #1114 both merged). Phase 4 builds the regression/UAT
> test rails in four PRs — one per layer, each off main, in order. Every claim below carries a live source.

- **Current focus:** **Phase 4 — regression + scenario/UAT test suite (4 layered PRs).**
  **Layer 1 (this PR) — vitest test-runner CI:** new `.github/workflows/tests.yml` runs `npm run test`
  (the full vitest suite) on every PR + push to main/master; the `workflow` token scope is now granted so the
  file can land. **Verified live:** the suite is GREEN at `2ca4043` — **2594 passed / 69 skipped / 0 failed in
  ~19s**, runs as pure functions with NO database (DB paths guarded, no-op without `DATABASE_URL`). The prior
  cursor's `tests/tax-engine/config/taxYearConfig.test.ts` "nextReviewBy in the future" failure is **already
  fixed by #1111** (`lib/tax-engine/config/taxYearConfig.ts:123/210/314` now `2026-09-30` > today) — so Layer 1
  did NOT need a date bump (confirmed, skipped per directive).
- **Active task + stop-point:** Layer-1 PR (`claude/phase4-layer1-test-runner-ci`, off main `2ca4043`) ships the
  workflow + this cursor + the hub `Last updated` bump/Phase-4 note. **Stop-point:** PR open for Reza review — NOT merged.
- **Immediate next action:** (1) **Repo-admin (Reza):** add a required status check named exactly **`vitest`** to the
  `main` ruleset / branch-protection required-check list — the new job does NOT gate merges until it is listed.
  (2) Reza review + merge Layer 1. (3) Build Layer 2 (golden-master regression), Layer 3 (invariants/property),
  Layer 4 (Playwright UAT) — each its own PR off main, in order. (4) Paste the staged spoke entries (in the
  Layer-1 PR body) into `04_RECENTLY_COMPLETED.md` + `01_ACTIVE_WORKSTREAMS.md` from a git-capable session.
- **Open decisions / blockers:**
  - **Q-GTM-3 (first aggregator) — STILL OPEN.** Claude rec = Finsure first, Connective second (a rec, not a ruling).
  - **GitHub `workflow` scope — ✅ NOW GRANTED** (2026-06-15). Unblocks `tests.yml` (this PR) + arming
    `continuity-gate.yml` / `docs-hygiene.yml` / `branch-currency.yml` to blocking (still a separate repo-admin step).
  - **CI test-runner rail — being ADDED by THIS PR** (`tests.yml`). Was absent (`security-audit.yml` = audit/lint/build only).
  - **Plan-spoke connector ceiling:** `01_ACTIVE_WORKSTREAMS.md` (~292 KB) + `04_RECENTLY_COMPLETED.md` (~303 KB)
    exceed the safe single-call connector-rewrite ceiling, so this Cowork PR updates STATE.md + the thin hub and
    **stages the verbatim spoke entries in the PR body** (same handling as #1112's backlog row #35). A git-capable
    session pastes them in.
  - **Phase 3 P2 findings** still await their own fix PRs (record-don't-fix) — `docs/audits/PHASE3_ENGINE_CORRECTNESS_2026-06-15.md` + Backlog #35.
  - **✅ RESOLVED by #1111:** the `taxYearConfig.test.ts` "nextReviewBy" date time-bomb.
- **Verified-live this session:** RESUME CHECK ran — since the prior cursor HEAD `de3e9c4` (#1113), only **#1114**
  (`claude/fix-pr2-ownership-integrity`) merged → live HEAD `2ca4043` (Phase 3 cleanup structurally complete).
  Test stack confirmed live: `vitest ^1.6.1`, include `tests/**/*.test.{ts,tsx}`, node env, `@`+`server-only`
  aliases (`vitest.config.ts`); entry `npm run test` = `vitest run` (`package.json`). No Playwright dependency
  yet (added in Layer 4). Suite green as above.

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
  workflow scope GRANTED 2026-06-15 — arming is a repo-admin step); (c) chat/Cowork: read-STATE-first is the hard first instruction (project instructions Section 0).
- **Update cadence:** cursor every session end; Section A/Section B only on a real change, via PR, never ad hoc.
