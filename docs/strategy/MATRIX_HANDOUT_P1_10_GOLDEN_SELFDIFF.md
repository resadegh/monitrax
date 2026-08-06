# MATRIX HANDOUT — P1.10 golden-baseline self-diff (PROD Simplification flag-phase acceptance)

**For:** Matrix HQ (Cowork) · **From:** Code session (Fable 5), 2026-08-05 · **Gates:** `docs/strategy/PROD_SIMPLIFICATION_PLAN.md` §5 P1.10 + §6 (held doctrine #2)
**Subject PR:** #1587 (`claude/prod-simplification-p0-p1-qyx1ik`) — the P1 module gate. `changesNumbers: NO` by contract.
**Location note:** this handout lives in `docs/strategy/` (not `docs/verification/briefs/`) deliberately — the P1 brief bars this workstream from MON-131-ledger-gated paths; it is a plan artefact, not a MON-131 tranche brief.

## 1. What this run decides

Whether the flag phase is ACCEPTED. The claim under test: **P1 gates nav/routes/APIs and changes NO producer** — no numeric leaf of the golden baseline moves. The reference is captured from eight `lib/` engine functions (not UI), so flag-gating must be invisible to it. **Any moved numeric leaf ⇒ a producer changed ⇒ DEFECT ⇒ the phase STOPS** (plan §6). Never explain a delta away — a moved leaf fails the phase.

## 2. The reference (of record)

- File: `.audit/golden-baseline-12954ff.json` (VR-048) — 1,755 hashed + 1 volatile = **1,756 leaves**, `treeHash 0d6753ef…`, captured on PROD data at `12954fff`.

## 3. The two required runs (plan P1.10 — both must be CLEAN)

**Run A — ship state (all module flags OFF).** P1 code against the reference's own data basis (PROD). Pre-merge that means the CLI on the PR-B checkout with the PROD `DATABASE_URL` (`npx tsx scripts/matrix/golden-baseline.mjs` `--diff` against the committed reference); the deployed-relay path (`POST /api/admin/matrix/golden-baseline/diff`) only reaches P1 code **after** merge — that post-merge PROD re-run is P2.2 regardless.

**Run B — flags ON (Preview, dev DB).** Proves enabling every module moves nothing either. Data caveat, stated rather than discovered mid-run: the Preview relay runs on the **dev** DB while the committed reference was captured on **PROD** data, so a raw diff-vs-reference on Preview can show data-driven deltas that say nothing about producers (the D-7 PROD→dev copy is P2.5 — not yet run). The like-for-like form on Preview is a **same-deployment capture pair**: capture with flags OFF → flip all 13 keys ON (admin Modules panel; ≤30s cache) → capture again → diff the two captures. CLEAN there is the meaningful "flags move no number" verdict on Preview. You own the golden-baseline mechanics — if you have a stronger equivalent, run that and say so in the verdict.

Preview deployment (latest, READY): `monitrax-git-claude-prod-simplific-79c834-reza-sadeghs-projects.vercel.app` (commit `9668523…` or later on the PR branch). `NEXT_PUBLIC_ADMIN_PORTAL_ENABLED` is scoped All Environments (P0.4 ✅), so the admin panel is reachable on Preview.

## 4. Record (before Reza merges #1587)

Per run, on the PR (and mirrored into the plan's P1.10 box): **verdict · changed-leaf count · treeHash · HEAD/SHA run against · which form of Run B was used**. Both CLEAN → P1 gate closes, Reza merges, P2 begins. Any FAIL → phase stops, finding comes back as a registry issue (never patched inline, §23.2.1).

## 5. What this run does NOT cover (honest boundary)

Rendered-UI hiding (P2.1's smoke test), the admin panel's UX, the 404/503/redirect behaviour (unit-tested in `tests/featureFlags/`, eyeballed at P2.1), and any number's *correctness* (P3's programme — the baseline records what the app currently produces, including anything currently wrong).
