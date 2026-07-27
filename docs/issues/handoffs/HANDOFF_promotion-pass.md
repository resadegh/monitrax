# CODE BRIEF (Fable 5) — VERIFIED→CLOSED promotion pass (registry housekeeping; NO code change)

**Paste into a FRESH Claude Code session — safe to run IN PARALLEL with the Stage-2 (PSI) session** (this touches only `docs/issues/ISSUES.json` + `STATE.md`; no overlap with the capture-feature code, so no merge conflict). **changesNumbers: no.** Goal: close the verified backlog — flip every eligible `VERIFIED` issue to `CLOSED` in one registry pass, so the register reflects reality (54 VERIFIED / only 3 CLOSED today).

## §0 Standing corrections
1. Stitch routing: design passes in the Code session (N/A here — no UI).
2. Model routing: executes in the Code session regardless of header.
3. **PR hygiene:** cut a FRESH branch from latest `main` (e.g. `chore/promote-verified-closed`); registry-only, so it stays conflict-free against the Stage-2 branch.

## 0. Boot ritual
`git clone`/pull → main → pin HEAD. Read STATE.md → CLAUDE.md (§19.5 / Part 24 the ISSUES.json registry + `npm run issues:*` tooling; §21.2.2 neo-sync) → `docs/issues/ISSUES.json`. Use the registry CLI (`npm run issues:*`) for every status change — **never hand-edit ISSUES.json.**

## The task — promote VERIFIED → CLOSED
**Criterion (all three):** status = `VERIFIED` **AND** the entry cites promotion evidence (a `docs/verification/runs/VR-*.md` and/or a CI ratchet/holistic test) **AND** the entry has **no open reopener** (no "stays FIXING pending X" / no unresolved sub-item that would re-open THIS issue — a *new* follow-up MON issue does not count as a reopener).

**First, apply the one pending Matrix flip** (if not already done): **MON-101 → VERIFIED** per **VR-034** (#1510) — then include it below.

**Recommended CLOSE set (Matrix-verified this session + the established VERIFIED arc — all hold VR/ratchet evidence, no reopener):**
`MON-002, 003, 005, 008, 009, 010, 011, 012, 013, 014, 015, 017, 018, 019, 021, 022, 026, 028, 029, 030, 032, 033, 035, 036, 038, 039, 040, 041, 042, 043, 044, 045, 046, 048, 075, 077, 079, 080, 081, 082, 086, 088, 089, 090, 091, 092, 093, 094, 095, 096, 097, 098, 099, 100, 101`.

Each CLOSE note should cite the evidence, e.g. `CLOSED per VR-029 (#1498) — MON-026 depreciation 100× dead, ratchet tests/tax/depreciationRate.test.ts; no reopener.`

**Explicitly VERIFY-your-own-judgment before closing (do NOT blind-close):**
- **MON-097 / 098 / 099 / 100** are "verified INERT" (overlays wired/reachable but not yet firing). Closing is correct — their defect was *unwired/unreachable*, now resolved; the capture feature is SEPARATE new work (MON-101+). Confirm each entry has no "pending capture" reopener before closing.
- **MON-088** has named follow-ups (estimate-caller cover; FY-config $202k) — these are NEW issues, NOT reopeners; MON-088 itself closes.
- **Any VERIFIED issue whose entry text says it's pending anything** → HOLD at VERIFIED, list it in the PR body with the reason.

**Do NOT touch:** anything `FIXING` / `DIAGNOSED` / `OPEN` / `RETRACTED`, and the 3 already `CLOSED` (MON-004/007/053).

## After the flips
- **Update STATE.md** cursor: closed backlog promoted (N issues VERIFIED→CLOSED at HEAD `<sha>`), note the register jumps to ~57 CLOSED.
- **Neo-sync (gate 8):** registry-only housekeeping — no Neomatrix/Neobrain/NeoAudit change; STATE.md is the only companion doc.
- **PR body:** list every issue closed (with its evidence citation) + any held-back VERIFIED (with reason). Reza merges (bulk status change — a quick eyeball; or auto-merge per hygiene once CI green).

## After merge → Matrix
The Matrix regenerates the issue register (the CLOSED count jumps ~3 → ~57) and updates the pinned artifact. No Ring-3 needed — this is status housekeeping on already-verified issues, not a number-changing fix.

---
*Prepared by The Matrix. Registry-only promotion pass — parallel-safe with Stage 2. Close every VERIFIED issue that holds VR/ratchet evidence with no reopener; hold (don't force) anything with a pending sub-item. `npm run issues:*` only; STATE.md updated; the Matrix regenerates the register after merge.*
