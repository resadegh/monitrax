# STATE.md — Monitrax "You Are Here"

> **This is the first file EVERY session reads, on EVERY surface (chat · Cowork · Code), BEFORE anything else.**
> It is not a substitute for the canonical docs — it is the pointer to them plus the current cursor.
> **Prime directive: read live, never recall.** No claim about Monitrax is made from memory; it is read
> from the repo at the pinned HEAD, or it is flagged unverified. Memory and any project-knowledge cache are
> NEVER ground truth — only live `resadegh/monitrax` HEAD is.
> **No session is notified of anything.** Merge-awareness and "what changed" are a session-start PULL, never a subscription.

**Last verified against HEAD:** `2ca4043` · **on:** 2026-06-15 · **by:** Cowork session (Phase 4 Layer 4 — Playwright UAT; Phase 4 PR set complete)
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

> Re-pinned 2026-06-15 by the **Cowork Phase 4 Layer-4** session (base HEAD `2ca4043` = merge of #1114).
> **Phase 4 is built — all four layers opened as PRs off main (merge in order):**
> **L1 #1115** (vitest CI) · **L2 #1116** (golden-master) · **L3 #1117** (invariants) · **L4 (this PR)** (Playwright UAT).

- **Current focus:** **Phase 4 Layer 4 — Playwright UAT (this PR), and Phase 4 wrap.** `tests/e2e/` adds a
  Playwright scaffold (`playwright.config.ts`, `auth.setup.ts`, `uat.spec.ts`, `README.md`) for four
  seeded-archetype real-human flows: add property → dashboard net worth; sell-property What-If → per-entity CGT
  (`Estimated CGT (your share)`, D6); entity-value widget legal-title label (#1114); delete property → ownership
  rows gone (L2-2). Playwright is wired into the L1 CI workflow as a second `playwright` job (Postgres service +
  build + run). **Config + all 5 tests validated via `playwright test --list`** (discovery + syntax).
  **BLOCKER (honest):** login is GCP/Firebase only with **no test-auth bypass** in the codebase, so the UAT specs
  **skip** unless a captured `E2E_STORAGE_STATE_JSON` is injected — the job is wired + green-with-skips, not yet a
  real gate. This is the one Phase-4 layer NOT executed end-to-end in this Cowork session (no Postgres/Next/auth).
- **Active task + stop-point:** Layer-4 PR (`claude/phase4-layer4-playwright-uat`, off main `2ca4043`). **Stop-point:** PR open for review — NOT merged.
- **Immediate next action:** (1) Reza review + merge **L1 #1115 → L2 #1116 → L3 #1117 → L4** in order (resolve the
  STATE.md Section-C, hub-date, and `tests.yml`/`archetypes.ts` overlaps in favour of the later layer — all off
  main by directive; L4's `tests.yml` is the superset = vitest + playwright). (2) Repo-admin: add required check
  `vitest`. (3) **Reza decision for L4 UAT to become a real gate:** provision an `E2E_STORAGE_STATE_JSON` secret +
  a Firebase TEST project, OR approve a server-only test-auth bypass (an app-surface security change, intentionally
  NOT made here). Then promote `playwright (UAT)` to a required check.
- **Open decisions / blockers:**
  - **E2E auth (L4) — Reza decision** (test storage-state secret vs server-only test bypass). See `tests/e2e/README.md`.
  - **Q-GTM-3 (first aggregator) — STILL OPEN.** Claude rec = Finsure first, Connective second (a rec, not a ruling).
  - **GitHub `workflow` scope — ✅ GRANTED** (2026-06-15) — `tests.yml` landed (L1) + extended (L4).
  - **Plan-spoke connector ceiling:** the ~290–300 KB spokes exceed the safe single-call rewrite ceiling, so each
    Phase-4 PR updates STATE.md + the thin hub and stages the verbatim spoke entry in its PR body (same as #1112).
  - **Phase 3 P2 findings** await their own fix PRs (record-don't-fix) — `docs/audits/PHASE3_ENGINE_CORRECTNESS_2026-06-15.md` + Backlog #35.
  - **✅ RESOLVED by #1111:** the `taxYearConfig.test.ts` "nextReviewBy" date time-bomb.
- **Verified-live this session:** RESUME CHECK — since cursor HEAD `de3e9c4` (#1113), only **#1114** merged →
  live HEAD `2ca4043`. Phase-4: L1 (#1115, suite green 2594/69/0) · L2 (#1116, 24 engine snapshots green) ·
  L3 (#1117, 246 invariant tests green) · L4 (this PR, Playwright scaffold — `--list` validated; UAT skips
  pending E2E auth). **No correctness bug surfaced across L2/L3** (engine matches documented behaviour).

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
