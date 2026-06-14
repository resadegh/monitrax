# Phase 1 Deep-Ingestion Findings — 2026-06-14

**Date:** 2026-06-14 | **Pinned HEAD:** `3eaeb90` | **By:** Cowork (Phase 1 deep ingestion) | **Status:** ACTIVE
**Purpose:** Drift / SSOT-violation / stale-doc findings surfaced while turning the STATE.md v1 seed cursor
into verified truth. This is **input to the Phase 2 governance audit** — it records, it does not fix.
Every item carries a live `file:line` (or tool-result) source read at HEAD 3eaeb90.

---

## Severity legend

- **P1** — actively misleads a cold session about live state (correctness risk).
- **P2** — SSOT / hygiene drift; safe today but rots if left.
- **P3** — cosmetic / low-risk staleness.

---

## F-1 (P2) — `IMPLEMENTATION_PLAN.md` header date is stale vs. its own body

`docs/IMPLEMENTATION_PLAN.md:9` reads **`Last updated: 2026-05-20`**, but the Recently-Completed log
contains entries dated **2026-06-11 / 2026-06-12** (`:1393`+) and `docs/changelog/` has daily files through
`CHANGELOG_2026_06_13.md`. The header has not been bumped for ~3 weeks of shipped work.
**Why it matters:** the header is the first freshness signal a reader sees; a 3-week-stale date invites
distrust of the whole (otherwise current) file.
**Fix (Phase 2):** bump the header on every plan-touching PR (already required by CLAUDE.md §15.3); add a
lint that fails if the header date is older than the newest Recently-Completed entry.

## F-2 (P2) — Stale `[~] IN FLIGHT` checkboxes under a workstream marked COMPLETE

Workstream **§0·WI (Phase 45 + Q-DEC)** has status **`v1 STRUCTURALLY COMPLETE 2026-06-09`** with
`Blocking: none` (`:276`, `:330`), yet many sub-items remain `[~] IN FLIGHT this PR` — e.g. Q-DEC PR 2.B
(`:291`), 2.C (`:292`), 2.D.1 (`:301`), 2.D.2/2.D.3a-c (`:303`–`:306`), 2.E.4 (`:307`), PR 3.E (`:314`).
The checkboxes were never flipped to `[x]` after the work landed.
**Why it matters:** a reader scanning the checklist concludes Q-DEC is mid-flight when the status line says
it is done — exactly the cross-session ambiguity §15 exists to prevent.
**Fix (Phase 2):** reconcile the §0·WI checklist to `[x]` against the 2026-06-06/07/09 Recently-Completed +
changelog entries; consider moving the closed workstream to Recently Completed per §15.3.

## F-3 (P2) — Recently-Completed entries carry `PR #TBD`

Multiple 2026-06-11 / 2026-06-12 entries read `(PR #TBD)` (`:1399`+) instead of a real PR number, although
those merges exist in git history (e.g. #1084 is filled; neighbours are not).
**Why it matters:** `PR #TBD` breaks the audit trail from plan → PR → deploy that §17.2 relies on.
**Fix (Phase 2):** backfill PR numbers from `git log --merges` for the 2026-06-11/12 window.

## F-4 (P2) — `docs/00_INDEX.md` is not the complete map it claims to be

`00_INDEX.md` (dated `2026-04-10` / refresh `2026-05-09`) bills itself as the "master registry of all
Monitrax documentation," but several live docs are absent from it: the entire **GTM set**
(`docs/marketing/GTM_EXECUTION_PLAN.md`, `GTM_TOOL_STACK.md`, and `docs/marketing/gtm/*` — BROKER_ICP,
FRIENDLIES_INVITE_PLAYBOOK, PAID_ADS_AUTOMATION, REVIEW_SCOPE_AND_BOUNDARIES), several compliance docs
(`CDR_SYSTEM_ARCHITECTURE.md`, `CDR_BASIQ_COMPLIANCE_STATUS_REPORT.md`, `CDR_EVIDENCE_SCREENSHOT_GUIDE.md`,
`CDR_WIF_AUTHENTICATION_EVIDENCE.md`, `CDR_SPREADSHEET_ANSWERS_AND_GAPS.md`, `DRAFT_EMAIL_REPLY_TO_BASIQ.md`),
and `docs/architecture/AI_PROVIDER_STRATEGY.md`.
**Why it matters:** an index that silently omits docs sends sessions to the wrong place or to nothing —
self-defeating for the "start here to locate anything" promise.
**Fix (Phase 2):** refresh `00_INDEX.md` to the live tree; add a CI check that diffs indexed paths vs.
actual `docs/**/*.md`.

## F-5 (P2) — Two parallel audit folders: `docs/audit/` and `docs/audits/`

Both `docs/audit/` and `docs/audits/` exist at HEAD (directory listing). `00_INDEX.md` documents only the
`docs/audits/` "Audits" section; `docs/audit/` is undocumented. This is an SSOT smell — two homes for the
same concept invites split-brain placement (this findings note was placed in the indexed `docs/audits/`).
**Why it matters:** future audit docs will land inconsistently across the two folders.
**Fix (Phase 2):** pick one canonical folder, move + redirect the other, document it in `00_INDEX.md`.

## F-6 (P3) — CLAUDE.md §12.4 "known violation" contradicts §12.2 on `/api/portfolio/snapshot`

CLAUDE.md §12.4 lists `/api/portfolio/snapshot` in its "Known violations to resolve" table
("Migrate callers, then delete"), but §12.2 explicitly says this endpoint is **NOT** a duplicate of
`/api/master-snapshot` and must **never** be deleted as one (confirmed PR #598, 2026-05-02). §12.2 is the
newer, sourced position.
**Why it matters:** the two sections give opposite instructions on the same endpoint; a literal-minded
session could delete a non-duplicate.
**Fix (Phase 2):** remove or annotate the §12.4 table row to defer to §12.2.

## F-7 (P2) — Continuity workstream (Phase 0) lives only in STATE.md, not in IMPLEMENTATION_PLAN.md

The continuity system (STATE.md, session-start hook, PRs #1100/#1101) is described in `STATE.md` §C but has
no corresponding entry in `IMPLEMENTATION_PLAN.md` Active Workstreams / Recently Completed. CLAUDE.md §15
treats the plan as the status SSOT for *what is being worked on*.
**Why it matters:** a session reading only the plan would not know the continuity system exists or shipped.
**Fix (Phase 2):** add the continuity workstream (Phase 0) to the plan, then keep STATE.md as the cursor pointer.

## F-8 (P2, process) — 884 KB `IMPLEMENTATION_PLAN.md` is unwritable via the GitHub connector in one call

The plan is **884,189 bytes** (`du`/`ls -l`). The available GitHub tools (`create_or_update_file`,
`push_files`) overwrite whole-file with inline content; a file this size cannot be sent in a single call,
and the sandbox has no push credentials. So a Cowork/connector session **cannot** satisfy the CLAUDE.md
§15 "update the plan in the same PR" rule for this file — it can only specify the edit for a git-capable session.
**Why it matters:** this is a structural gap in the continuity rails, analogous to the missing `workflow`
scope; left unflagged, plan updates silently don't happen from Cowork.
**Fix (Phase 2):** either (a) split the plan into smaller per-section files under a size budget (§15.5
already caps it at ~600 lines — it is 1739), or (b) route plan edits through a git-capable surface, or
(c) provide a patch-capable write path. Until then, Cowork sessions specify the exact diff in the PR + cursor.

---

## Carry-forward to Phase 2

F-2, F-3, F-4, F-7 are the plan/index hygiene cluster; F-1 + F-8 are the size/freshness rails; F-5 + F-6
are SSOT de-duplication. None are correctness bugs in shipped code — all are documentation/governance drift.
The load-bearing decision facts (Q-GTM-3 OPEN, Q-DEC DONE) are themselves consistent across the plan; the
drift is in hygiene around them, not in the decisions.
