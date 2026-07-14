# Changelog — 2026-07-14

## Session: chat-audit-findings-issues-m9518i (continued) — VR-002 + two-phase Ring-3 brief

### Change: VR-002 real-data run (fixes verified) + restructure the Ring-3 brief into Phase 1 (capture) / Phase 2 (staged analysis)

- **Type**: Docs (NeoAudit Ring-3) — verification record + brief restructure (Part 23 §23.2 rule 4)
- **Scope**: `docs/verification/runs/VR-002.md` (new), `docs/verification/VERIFICATION_PLAYBOOK.md`
  (§3.3 brief + §3.5 Phase-2 procedure + new §3.6 two-phase model),
  `docs/implementation/01_ACTIVE_WORKSTREAMS.md` (decision + VR-002 result)
- **Why**:
  1. Reza ran the Chrome-relay brief on his PRODUCTION account — this captures the
     result (VR-002) and its comparison vs BASELINE.md. **Headline: every baseline
     delta is an expected fix-shipped convergence — MON-028/029/030/017 confirmed
     working on live data.** MON-030 (the one pending his live eyeball) is confirmed:
     CFO 50/C == Home 50/C, bars = the 7 warm categories.
  2. Reza's holistic insight (2026-07-14): *"Monitrax is a holistic tool, so all
     numbers are meaningful as a whole … after a complete sweep you can perform
     checks in stages (considering holistic numbers)."* A single agent task that
     captures AND analyses the whole app shortcuts on a long sweep (VR-002 nearly
     skipped sidebar items). The fix is NOT to chunk the sweep (that breaks the
     cross-surface comparisons) — it's to split by KIND of work.
- **Solution**:
  - **VR-002.md** — the run + a Part-F diff table (every delta bucketed) + verdicts
    (MON-028/029/030/017 verified) + the Phase-2 findings (F1–F7: MON-031 still open;
    new HOME home-tile cashflow + HOME yield triple-discrepancy; one-offs-as-monthly
    critical; 104% refinance; Month-End Δ68; minor display items) + disposition.
  - **Playbook two-phase restructure:** Phase 1 (the Chrome relay, §3.3) is now framed
    as COMPLETE CAPTURE only — open everything, record every number, fill a mandatory
    `coverage` checklist (per-sidebar true/false + `skipped[]`) so any skip is visible;
    the MACHINE REPORT is the primary deliverable (human MISMATCH judgments are a
    secondary signal — Phase 2 recomputes). Phase 2 (§3.5) is the comparing session's
    STAGED holistic analysis over the complete dataset (net-worth ties → cross-surface
    parity → story convergence → edge cases → baseline diff + MON verdicts). New §3.6
    documents the model + the rule: capture is whole/one-pass, staging happens in the
    analysis, never the capture.
  - **Implementation plan:** the two-phase model recorded as a DECISION ("DO NOT
    DRIFT") + the VR-002 result on the NeoAudit workstream.

### Files Modified
- `docs/verification/runs/VR-002.md` — new (run + comparison + verdicts + findings)
- `docs/verification/VERIFICATION_PLAYBOOK.md` — §3.3 capture framing + `coverage` schema
  field; §3.5 Phase-2 staged procedure; §3.6 two-phase model
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — two-phase decision + VR-002 result

### Build Status
- [x] Doc-only — no code/test surface touched

### Gate (§20.6)
- Document 10/10 (doc: VERIFICATION_PLAYBOOK.md §3.6 + NEOAUDIT §3–§4 — the two-phase
  split matches Reza's holistic directive; brief edited in a PR per §23.2 rule 4;
  VR-002 follows the §3.4 baseline-diff discipline) · Requirements 10/10 (delivers the
  two-phase brief Reza asked for + documents the plan in the implementation plan before
  handing over the brief, exactly as instructed) · Logic 10/10 (the baseline diff is
  arithmetic against the recorded BASELINE.md; verdicts cite the captured figures;
  capture stays one-pass/holistic — the coverage checklist enforces completeness without
  chunking).
- **Coverage boundary (honest — §22.2.4):** VR-002 VERIFIES the fixes on the numbers
  Chrome actually read on Reza's account this run; it does NOT re-derive every figure
  from first principles (that's the Phase-2 per-property recompute, done for the
  flagged ones). The brief restructure changes the METHOD; it verifies nothing itself.
  The registry follow-through (flip MON-028/029/030 → VERIFIED, file F2/F3, investigate
  F4/F5/F6) is a separate PR that cites VR-002.

## Session: chat-audit-findings-issues-m9518i (continued) — VR-002 registry disposition

### Change: flip the verified fixes → VERIFIED; file the new findings as MON tickets

- **Type**: Issue registry (NeoAudit §19.5) — documenting the VR-002 outcome
- **Scope**: `docs/issues/ISSUES.json` (+ generated `ISSUES.md`)
- **Why**: Reza directive 2026-07-14 — *"document all these issues and the fixes."* The
  registry is the ONE issue list (§19.5 SSOT), so VR-002's outcome is recorded there,
  not in a parallel doc.
- **Solution**:
  - **VERIFIED (Ring-3 confirmed on Reza's live data, VR-002 is the §23.2-rule-3
    evidence):** MON-028 (property detail cashflow/yield == list == Home), MON-029
    (savings rate one value −30.5%), MON-030 (CFO 50/C == Home 50/C, 7 warm bars),
    MON-017 (Positive Cashflow 8/15, Safety 70→63). Each already carried the §19.4
    holistic test + a resolving Neomatrix semanticKey + downstream sweep + fix PRs — the
    registry gate enforces that a number-changing issue cannot reach VERIFIED without
    them (validated: `npm run issues:check` = 39 valid; `tests/issues` = 16 pass).
  - **Still FIXING:** MON-031 (liquid-savings $2,496 gap — VR-002 confirms still
    present); MON-021 (a $68 Month-End residual noted, F6 — pending investigation).
  - **New OPEN findings filed via `npm run issues:raise`:** MON-035 (F2 — HOME
    home-tile cashflow Δ6,040), MON-036 (F3 — HOME yield triple-discrepancy), MON-037
    (F4 — **critical**: one-offs shown as monthly + apparent Battery duplicate), MON-038
    (F5 — refinance offered on 104% LVR), MON-039 (F7 — minor display cluster). Each is
    OPEN with the VR-002 evidence in `notes`; rootCause + semanticKeys get the §19.2
    investigation in the rectification phase.

### Files Modified
- `docs/issues/ISSUES.json` — 4 → VERIFIED, MON-021 residual note, 5 new OPEN (MON-035..039)
- `docs/issues/ISSUES.md` — regenerated

### Build Status
- [x] `npm run issues:check` — 39 issues valid (the VERIFIED gate enforced test+key+sweep+PR)
- [x] `npx vitest run tests/issues` — 16 pass

### Gate (§20.6)
- Document 10/10 (registry follows §19.5 lifecycle + §23.2 rule 3 — VERIFIED cites the
  VR-002 Ring-3 run; findings filed in the ONE registry, not a parallel list) ·
  Requirements 10/10 (does exactly "document all these issues and the fixes"; keeps the
  unfixed ones open) · Logic 10/10 (VERIFIED flips are gate-valid — proven by
  issues:check + the registry vitest; new findings are OPEN pending §19.2 diagnosis).
- **Coverage boundary (honest — §22.2.4):** this DOCUMENTS the VR-002 disposition in the
  registry; it FIXES nothing (rectification is a later phase, after NeoAudit is finished
  and VR-003 compiles the complete list). The VERIFIED flips rest on VR-002's live-data
  confirmation, not on a re-derivation of each number here.
