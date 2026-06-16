# Monitrax Implementation Plan

> **This is the live, single source of truth for "what is being worked on, what is queued, what is blocked, what changed recently."**
>
> Every session starts here. Every PR that materially changes a workstream updates the relevant spoke below. If a workstream isn't in this plan, it isn't real.
>
> See CLAUDE.md §1 (Session Startup Protocol) and §15 (Implementation Plan Protocol) for the rules that govern this document.

**Last updated:** 2026-06-16 (**Fix — storage factory GCS-detection accepts keyless**: `computeGcsConfigured()` now treats GCS as configured when project+bucket set AND (key OR keyless WIF env), so deleting `GCS_SERVICE_ACCOUNT_KEY` engages keyless instead of silently falling back to the DB. Caught during live GCS provisioning; documented with a full resolution-order + rollback runbook in PHASE_50 (Reza directive). Cutover: bucket + both SAs ready; after merge delete the key + redeploy → keyless. Prior: **AI Document Router · Phase B** (storage track) — **keyless GCS auth + GCS-aware download**: new `lib/gcp/wifAuthClient.ts` (keyless WIF, no static key — reuses the DB's identity per §13.6), provider-aware `/api/documents/download` streaming (DB bytea or GCS), read-URL policy SSOT `readUrl.ts`; 4 tests. Operator provisioning to go live now 3 steps (bucket + IAM grant + 2 non-secret env vars). Prior same day: per-user storage quota: new canonical `lib/documents/storage/storageQuota.ts` (drift-free, computed from `SUM(Document.size)`, default 2 GiB, backend-independent), enforced at the DME `processUpload` chokepoint + the legacy scan path; `/api/documents/upload` → 413 on breach; 7 tests. New `0·DOC` workstream + `PHASE_50_AI_DOCUMENT_ROUTER.md` (A✅/B~/C plan + GCS provisioning checklist). Reza decisions logged: storage=GCS, household=shared-finances-incl-docs. GCS cut-over blocked on operator provisioning. Prior: **Phase 26.7** — mobile camera capture + global "Scan a receipt": `FormDocumentUpload` gains a native `capture="environment"` "Take photo" button on touch devices; new `GlobalScanReceipt` FAB + glass bottom sheet rides the canonical upload→analyze→confirm pipeline. See `04_RECENTLY_COMPLETED.md`. Prior: **Phase 4 COMPLETE** — all four test-rail layers merged to main: L1 #1115 `vitest` CI (now a required check on the `main` ruleset) · L2 #1116 golden-master (engine-sourced snapshots) · L3 #1117 invariants/property checks · L4 #1118 Playwright UAT scaffold (wired into `tests.yml`, skipped via `vars.E2E_ENABLED` until E2E auth is provisioned). No correctness bug surfaced across L2/L3. Follow-ups (optional): enable the UAT gate (E2E_ENABLED + E2E_STORAGE_STATE_JSON), and a git-capable session pastes the four staged `04_RECENTLY_COMPLETED` Phase-4 entries (verbatim in the PR bodies; spokes exceed the connector rewrite ceiling). Prior: Phase 3 audit + fix PRs #1113/#1114; #1111 FY-review; Phase 47 D6; F-8 plan split.) _Keep this date current: it must never be older than the newest entry in [`04_RECENTLY_COMPLETED.md`](implementation/04_RECENTLY_COMPLETED.md) (CI-checked — finding F-1)._

---

## How this plan is structured (read me first)

The plan is a **hub (this file) + spokes** (under [`docs/implementation/`](implementation/)). The hub holds only navigation, the status legend, and the update rules. The detail lives in the spokes so each file stays small enough to (a) write via the GitHub connector in one call and (b) scan without scrolling forever. **`docs/IMPLEMENTATION_PLAN.md` remains the canonical entry point** — links elsewhere in the repo that point at "the plan" land here and route onward.

| Spoke | What it holds | Open it |
|---|---|---|
| 🟡 **Active Workstreams** | Work in flight right now — phase checklists, owners, risk, blockers. Sorted by priority. | [`implementation/01_ACTIVE_WORKSTREAMS.md`](implementation/01_ACTIVE_WORKSTREAMS.md) |
| 📋 **Up Next & Demo-Complete** | Agreed + queued, not started; plus the frozen Lighthouse demo-complete band. | [`implementation/02_UP_NEXT.md`](implementation/02_UP_NEXT.md) |
| ❓🚧🗑️↩️ **Questions, Blocked & Backlog** | Open Questions (strategic, undecided), Blocked items, Dead Code / Tech-Debt, Reversed Decisions. | [`implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md`](implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md) |
| ✅ **Recently Completed** | Rolling 30-day completion log (older items roll into the changelog). | [`implementation/04_RECENTLY_COMPLETED.md`](implementation/04_RECENTLY_COMPLETED.md) |
| 📚 **Older history** | Pre-30-day session log + the relocated preamble narrative. | [`docs/changelog/IMPLEMENTATION_CHANGELOG.md`](changelog/IMPLEMENTATION_CHANGELOG.md) |

**Freshness gate:** a spoke is the SSOT for its slice. When a claim in another doc (STATE.md, SYSTEM_MAP.md, a Phase doc) disagrees with the relevant spoke, the spoke wins — re-pull and fix the pointer.

---

## Status legend

| Symbol | Meaning |
|---|---|
| 🟢 | Active and healthy |
| 🟡 | Active, in progress, on track |
| 🔴 | Active, stuck or risk flagged — see notes |
| 🚧 | Blocked, awaiting decision or external dependency |
| 📋 | Queued — agreed, not started |
| ❓ | Idea / open question — not committed |
| 🗑️ | Dead code / tech-debt — pending cleanup |
| ↩️ | Reversed decision — preserved here so we don't re-do it |
| ✅ | Recently completed (rolling 30 days) |

---

## How to update this document (rules)

> **Mandatory.** See CLAUDE.md §15 (Implementation Plan Protocol) for full rule text. Edit the relevant **spoke**, not this hub (except the **Last updated** date above, which every plan-touching PR bumps).

1. **Every PR that starts a workstream** adds it to [`01_ACTIVE_WORKSTREAMS.md`](implementation/01_ACTIVE_WORKSTREAMS.md) with all the fields filled in (§15.2).
2. **Every PR that advances a workstream** ticks off the relevant `[ ]` checkbox(es) in that workstream's phase list and updates `Last touched`.
3. **Every PR that completes a workstream** moves it from `01_ACTIVE_WORKSTREAMS.md` to [`04_RECENTLY_COMPLETED.md`](implementation/04_RECENTLY_COMPLETED.md) with the date and PR number.
4. **Every PR that surfaces a tech-debt item** (e.g. removes a duplicate, identifies dead code) adds it to the Dead Code / Tech-Debt backlog in [`03_OPEN_QUESTIONS_AND_BACKLOG.md`](implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md).
5. **Every PR that reverts a previous attempt** adds an entry to Reversed Decisions in [`03_OPEN_QUESTIONS_AND_BACKLOG.md`](implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md) so the same dead-end isn't re-attempted.
6. **Every PR that introduces an open question** the user hasn't decided adds it to Open Questions in [`03_OPEN_QUESTIONS_AND_BACKLOG.md`](implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md).
7. **Bump the `Last updated` date** in this hub on every plan-touching PR. CI fails if it falls behind the newest `04_RECENTLY_COMPLETED.md` entry (finding F-1, `scripts/check-plan-freshness.sh`).
8. **Reviewers reject PRs** that materially change a workstream without updating the plan. Same hygiene rule as the changelog.

### Per-spoke size budget (finding F-8)

- **Target: each spoke ≤ ~600 lines / ≤ ~150 KB** so it stays connector-writable in one call and scannable. _Practical caveat surfaced 2026-06-15 (Phase 3): even a 63 KB spoke is unreliable to rewrite verbatim from a Cowork/connector session — the safe ceiling for an in-place connector rewrite is well under that. Prefer git-capable edits, or split further._
- When a spoke exceeds budget, **retire settled content**: completed workstreams → `04_RECENTLY_COMPLETED.md`; recently-completed items older than 30 days → [`IMPLEMENTATION_CHANGELOG.md`](changelog/IMPLEMENTATION_CHANGELOG.md).
- **Known over-budget (carried, not yet pruned):** `01_ACTIVE_WORKSTREAMS.md` (~289 KB) and `04_RECENTLY_COMPLETED.md` (~296 KB). This PR did the structural split only; the **next hygiene pass** retires the completed §0x workstreams (e.g. 0·WI, 0·DG, 0·StD, 0·WX) and rolls >30-day completions into the changelog to bring both under budget. Tracked as a Dead Code / Tech-Debt item in `03_OPEN_QUESTIONS_AND_BACKLOG.md`.
