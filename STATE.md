# STATE.md — Monitrax "You Are Here"

> **This is the first file EVERY session reads, on EVERY surface (chat · Cowork · Code), BEFORE anything else.**
> It is not a substitute for the canonical docs — it is the pointer to them plus the current cursor.
> **Prime directive: read live, never recall.** No claim about Monitrax is made from memory; it is read
> from the repo at the pinned HEAD, or it is flagged unverified. Memory and any project-knowledge cache are
> NEVER ground truth — only live `resadegh/monitrax` HEAD is.
> **No session is notified of anything.** Merge-awareness and "what changed" are a session-start PULL, never a subscription.

**Last verified against HEAD:** `2ca4043` · **on:** 2026-06-15 · **by:** Cowork session (Phase 4 Layer 2 — golden-master regression)
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

> Re-pinned 2026-06-15 by the **Cowork Phase 4 Layer-2** session (base HEAD `2ca4043` = merge of #1114).
> Phase 3 is structurally DONE (#1113 + #1114). Phase 4 builds the regression/UAT rails in four PRs, one per
> layer, each off main, in order. **Layer 1 = PR #1115 (open).** Every claim below carries a live source.

- **Current focus:** **Phase 4 Layer 2 — golden-master regression (this PR).** Six canonical archetypes
  (sole owner; couple 50/50; discretionary trust; SMSF; company; mixed entity portfolio) under
  `tests/regression/golden-master/`. For each, the canonical engines run and their output is captured into
  committed vitest snapshots — **net worth (household + per-entity via the `ownerEntityId` filter), cashflow,
  per-entity breakdown (`buildEntityBreakdown`), and per-entity CGT split (`computePropertyDisposalCgt`).**
  Snapshots are serialized FROM the engine (`toMatchSnapshot`) — **no number hand-authored** (§2/§12.3;
  Decimal outputs projected via `.toNumber()`). 24 tests / 24 snapshots, green + stable on re-run. Sanity
  cross-checks held: Div 115 discount = 0 (company) / 0.3333 (complying SMSF) / 0.5 (individual·trust); SMSF
  member super excluded from the net-worth super sum (Phase 39.5) with the fund's owned assets counted instead.
  **No correctness bug surfaced** (engine matches documented behaviour).
- **Active task + stop-point:** Layer-2 PR (`claude/phase4-layer2-golden-master`, off main `2ca4043`). **Stop-point:** PR open for review — NOT merged.
- **Immediate next action:** (1) Reza review + merge Layer 1 (#1115) then Layer 2 (resolve the STATE.md Section-C
  conflict in favour of the later layer — both are off main, by directive). (2) Repo-admin: add required check
  `vitest`. (3) Build Layer 3 (invariants/property) then Layer 4 (Playwright UAT), each off main.
- **Open decisions / blockers:**
  - **Q-GTM-3 (first aggregator) — STILL OPEN.** Claude rec = Finsure first, Connective second (a rec, not a ruling).
  - **GitHub `workflow` scope — ✅ GRANTED** (2026-06-15) — `tests.yml` landed in Layer 1.
  - **Plan-spoke connector ceiling:** the ~290–300 KB spokes exceed the safe single-call rewrite ceiling, so this
    PR updates STATE.md + the thin hub and stages the verbatim spoke entry in the PR body (same handling as #1112).
  - **Phase 3 P2 findings** await their own fix PRs (record-don't-fix) — `docs/audits/PHASE3_ENGINE_CORRECTNESS_2026-06-15.md` + Backlog #35.
  - **✅ RESOLVED by #1111:** the `taxYearConfig.test.ts` "nextReviewBy" date time-bomb.
- **Verified-live this session:** RESUME CHECK — since cursor HEAD `de3e9c4` (#1113), only **#1114** merged →
  live HEAD `2ca4043`. Engines used are pure/DB-free; golden-master suite runs in ~1.3s. Phase-4 Layer 1 shipped
  as PR #1115 (vitest CI). Full repo suite green at `2ca4043` (2594 pass / 69 skip / 0 fail) + 24 new golden tests.

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
