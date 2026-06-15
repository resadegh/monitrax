# STATE.md — Monitrax "You Are Here"

> **This is the first file EVERY session reads, on EVERY surface (chat · Cowork · Code), BEFORE anything else.**
> It is not a substitute for the canonical docs — it is the pointer to them plus the current cursor.
> **Prime directive: read live, never recall.** No claim about Monitrax is made from memory; it is read
> from the repo at the pinned HEAD, or it is flagged unverified. Memory and any project-knowledge cache are
> NEVER ground truth — only live `resadegh/monitrax` HEAD is.
> **No session is notified of anything.** Merge-awareness and "what changed" are a session-start PULL, never a subscription.

**Last verified against HEAD:** `c10333d2` · **on:** 2026-06-15 · **by:** Cowork session (Phase 3 engine-correctness audit)
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

> Re-pinned 2026-06-15 by the Cowork Phase 3 engine-correctness audit (read live at HEAD `c10333d2`).
> Phase 3 was a STATIC read/trace audit (record-don't-fix). Every claim below carries a live source.

- **Current focus:** **Phase 3 calc-engine + data-relationship correctness audit — COMPLETE this PR.**
  Output: `docs/audits/PHASE3_ENGINE_CORRECTNESS_2026-06-15.md` — 7 findings (4×P2, 3×P3), each `file:line`,
  RECORD-don't-fix. Headlines: (L1-1) `wealthGraphService` values holdings off the `currentValue` cache +
  `averagePrice`, never `currentPrice`, diverging from canonical net worth; (L1-2) `lib/reports/contextBuilder`
  uses cost-basis investments + loan `principal` (not `currentBalance`); (L2-1) per-entity *value* uses binary
  `ownerEntityId` while per-entity *tax* uses fractional + beneficial attribution (`attributeAsset`) — they
  don't reconcile for co-owned assets; (L2-2) `OwnershipGroup`/`BeneficialOwnershipOverride` reference assets
  polymorphically (no FK) → orphan rows on asset delete. The canonical SSOT itself is sound and its
  Float/Decimal siblings agree; MA.4-002 fix confirmed not regressed.
- **Active task + stop-point:** This Cowork PR (`claude/phase3-engine-correctness-audit`) adds the audit doc +
  bumps the plan hub date. The matching one-line backlog index row for `03_OPEN_QUESTIONS_AND_BACKLOG.md` (#34)
  is **staged but withheld from this PR** — a verbatim connector round-trip of the 63 KB spoke risks corrupting
  the SSOT (finding F-8 in practice); apply it in a git-capable session. **Stop-point:** PR open for Reza review — NOT merged.
- **Immediate next action:** (1) Reza review + merge this audit PR. (2) Apply the staged Phase-3 backlog row #34
  to `03_OPEN_QUESTIONS_AND_BACKLOG.md` in a git-capable session (text specified in the PR body). (3) Spin the
  **separate fix PRs** the audit recommends — priority: a single canonical "asset market value / loan balance"
  helper (closes L1-1+L1-2+L1-3), then the per-entity ownership-semantics decision (L2-1, product + AFSL call for
  Reza), then ownership-row referential-integrity cleanup (L2-2). (4) Carry-overs from the D6 cursor still open:
  bump the tax-config review date so `tests/tax-engine/config/taxYearConfig.test.ts` ("nextReviewBy in the
  future") passes — its own PR; the plan-hygiene pass to bring spokes `01`/`04` under the §15.5 budget (Backlog
  #33); Reza's Q-GTM-3 decision; repo-admin (branch protection + `workflow` scope + arm the soft-launch workflows).
- **Open decisions / blockers:**
  - **Phase 3 P2 findings await fix PRs** (record-don't-fix). See `docs/audits/PHASE3_ENGINE_CORRECTNESS_2026-06-15.md`
    §"Recommended fix PRs" (+ the staged Backlog #34).
  - **Q-GTM-3 (first aggregator) — STILL OPEN.** No Reza decision recorded; live plan says "Needs Reza decision
    before Step 2.2." Claude **recommendation = Finsure first, Connective second** (a rec, not a ruling).
    (`03_OPEN_QUESTIONS_AND_BACKLOG.md` Q-GTM-3 row.)
  - **Q-DEC (Float -> Decimal) — DECIDED 2026-05-24 (Reza), migration v1 STRUCTURALLY COMPLETE 2026-06-09.**
    Prisma stores Float; engines convert at the boundary via `lib/decimal/` (`Decimal` = `Prisma.Decimal`,
    decimal.js `ROUND_HALF_EVEN`) and compute in Decimal; Q-DEC PR4 dropped the *dormant* `*_decimal` columns.
    `/wealth-check` precision gate satisfied; remaining traffic-on gates are Q-HOOK-AFSL + Q-HOOK-BENCHMARK
    (compliance/benchmark, not precision).
  - **GitHub `workflow` scope NOT granted** — blocks `.github/workflows/continuity-gate.yml` + the Phase 4
    test-runner workflow (and arming the three soft-launch workflows to blocking).
  - **Connector cannot reliably rewrite a 63 KB+ plan spoke in one call** (Phase 3 — F-8 in practice). The safe
    ceiling for an in-place connector rewrite is well under the §15.5 ~150 KB target; prefer git-capable edits or split further.
  - **Pre-existing test failure (unrelated to Phase 3):** `tests/tax-engine/config/taxYearConfig.test.ts`
    "nextReviewBy in the future" fails — the tax-config review date (2026-06-14) is now past; needs a date bump in its own PR.
  - **CI test-runner rail** still absent (`security-audit.yml` runs audit+lint+build only). Phase 4 needs a CI test job.
- **Verified-live this session (HEAD c10333d2):** RESUME CHECK — since the prior cursor HEAD `4a49a93`, four
  PRs merged to main: #1106 (`phase2-prb`), #1108 (`phase2-prc` — the F-8 plan hub+spoke split), #1109
  (`boot-direc`), #1110 (`ad2-implementation` — Phase 47). Phase 47 (Entity Ownership Fabric) is
  **feature-complete**. My Phase 1 PR #1102 (SYSTEM_MAP + cursor) merged as `9e36425`; Phase 2 adopted findings
  F-1 (plan-freshness CI check) + F-8 (hub+spoke split, per-spoke size budget). Calc engine confirmed:
  orchestrator `lib/services/masterFinancialService.ts` calls canonical `calculateNetWorth` (`:1688`) +
  aggregators; engine families `tax-engine`/`cfo`/`health`/`cgt`/`cashflow`/`intelligence`/`wealthCheck`/
  `decimal`/`calc-audit`. Stack: Next.js 15.5.19 · React 19 · Prisma 5.22 / 130 models · GCP + Vercel(syd1) · Gemini + Anthropic SDK.

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
