# STATE.md — Monitrax "You Are Here"

> **This is the first file EVERY session reads, on EVERY surface (chat · Cowork · Code), BEFORE anything else.**
> It is not a substitute for the canonical docs — it is the pointer to them plus the current cursor.
> **Prime directive: read live, never recall.** No claim about Monitrax is made from memory; it is read
> from the repo at the pinned HEAD, or it is flagged unverified. Memory and any project-knowledge cache are
> NEVER ground truth — only live `resadegh/monitrax` HEAD is.

**Last verified against HEAD:** `7778847` · **on:** 2026-06-14 · **by:** chat session (PM)
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

1. `CLAUDE.md` (repo root) — **law.** Governance, four-lens mindset, SSOT + single-calc-engine rule, warm-words,
   session protocol (Parts 1/7/10). When anything conflicts with CLAUDE.md, CLAUDE.md wins.
2. `docs/IMPLEMENTATION_PLAN.md` — **status SSOT.** What's shipped / active / queued / blocked / reversed.
   (~884 KB; range-read it — don't pull whole. This STATE.md holds the *cursor*; the plan holds the *detail*.)
3. `docs/00_INDEX.md` — **the map** of every doc. Start here to locate anything.
4. Topic authorities: architecture -> `docs/architecture/`; phases -> `docs/blueprint/MASTER_BLUEPRINT.md`;
   compliance -> `docs/compliance/`; GTM -> `docs/marketing/` (+ `docs/marketing/gtm/`); design -> Stitch system
   (`docs/design/`); calc engines -> `lib/calculations/*` + `lib/services/masterFinancialService.ts`.

## C. RESUME CURSOR  (regenerated at every session END — the live "where we are")

> v1 SEED — fields marked (PENDING) must be populated by the first Cowork/Code session that
> range-reads the live `IMPLEMENTATION_PLAN.md`. Chat cannot range-read 884 KB; that's by design.

- **Current focus:** Standing up this continuity system (Phase 0).
- **Active task + stop-point:** Continuity-system PR opened (this `STATE.md` + `session-start.sh` continuity
  block + `continuity-gate.yml`). Awaiting Reza review/merge. Chat-side `Section 0` boot gate already pasted into
  the Claude.ai project instructions.
- **Immediate next action:** Merge PR -> run gate non-blocking ~1 week -> arm it as required -> begin Phase 1
  deep ingestion (Cowork range-reads the live plan + architecture + calc engines, fills the PENDING fields).
- **Open decisions / blockers:**
  - Q-GTM-3 (first aggregator = Finsure?) — status UNCONFIRMED against live plan (cache & memory disagree). RESOLVE on first live read.
  - Float->Decimal (Q-DEC) — reportedly gates `/wealth-check` paid traffic per cache; confirm live status.
  - CI has NO test-runner rail today (`security-audit.yml` runs audit+lint+build only). Phase 4 regression suite needs a CI job — dependency, not yet built.
- **Verified-live this session (HEAD 7778847):** doc tree has `audit/ quality/ legal/ help/ policy/ design/ BASIQ FILES/`;
  `IMPLEMENTATION_PLAN.md` = 884 KB; `docs/marketing/gtm/` contains BROKER_ICP, PAID_ADS_AUTOMATION,
  FRIENDLIES_INVITE_PLAYBOOK, REVIEW_SCOPE_AND_BOUNDARIES; `.claude/` SessionStart hook exists (Stitch-only);
  `.github/workflows/` has only `security-audit.yml`.

## D. THE SESSION RITUAL  (all surfaces; Code ALSO follows CLAUDE.md Parts 1/7/10)

**START (before any work):**
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
  IMPLEMENTATION_PLAN (detail), 00_INDEX (map). No content is duplicated from those here — only pointers + position.
- **Enforced by:** (a) `.claude/hooks/session-start.sh` prints this cursor + HEAD at the start of every Code session
  (skip-on-failure, never blocks the session); (b) `.github/workflows/continuity-gate.yml` fails a PR that changes
  workstream files without updating STATE.md + IMPLEMENTATION_PLAN in the same PR (soft-launch first, then required);
  (c) chat/Cowork: read-STATE-first is the hard first instruction (project instructions Section 0).
- **Update cadence:** cursor every session end; Section A/Section B only on a real change, via PR, never ad hoc.
