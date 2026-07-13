# Changelog — 2026-07-13

## Session: chat-audit-findings-issues-m9518i (continued) — Ring-3 brief: explicit MON-030 check

### Change: fold the MON-030 score/grade convergence check into the canonical Chrome-relay brief

- **Type**: Docs (verification brief) — NeoAudit Ring-3 (Part 23 §23.2 rule 4)
- **Scope**: `docs/verification/VERIFICATION_PLAYBOOK.md` §3.3 (the canonical run
  brief) + `docs/verification/baselines/BASELINE.md` (the regression diff slot)
- **Why**: MON-030 (health/CFO/Safety "three scores for one health") is fixed in
  code (#1380/#1381) but stays FIXING until Reza confirms on his LIVE data that
  My Guide's CFO score now equals Home's health score. He said he wasn't sure
  what to look at — so the check belongs in the brief the Ring-3 relay runs,
  verbatim, not in chat. §23.2 rule 4: improving the brief = editing the
  playbook in a PR, never improvising.
- **Solution**:
  - Part C gains an explicit `[MON-030]` line: My Guide (CFO) overall score AND
    letter grade must be IDENTICAL to the Home "Health" score AND grade (both now
    from the ONE health engine — any gap is a FAIL), and the CFO bars should be
    the SEVEN warm categories (Cash on hand / Cash flow / Debt health /
    Investments / Property / Protection / Long-term outlook), not a different set
    of six CFO metrics.
  - Part E's same-metric invariant line now names the health-score LETTER GRADE
    alongside the number, with the MON-030 equality called out.
  - Part F regression JSON gains `healthGradeHome` / `healthGradeCfo` so the
    grade convergence is captured in every snapshot.
  - Baseline gains the two grade keys (null — VR-001 didn't capture them) and its
    MON-030 annotation flips from "BROKEN — multiple producers" to "FIX SHIPPED
    (#1380/#1381)" with the expected next-run convergence (CFO===Home for both
    score and grade; Safety Net stays deliberately distinct).

### Files Modified
- `docs/verification/VERIFICATION_PLAYBOOK.md` — Part C MON-030 line, Part E grade
  note, Part F grade keys
- `docs/verification/baselines/BASELINE.md` — Part F grade keys + MON-030
  annotation flipped to "fix shipped / expected convergence"

### Build Status
- [x] Doc-only — no code, no test surface touched (grep confirmed no test
  snapshots the brief or baseline)

### Gate (§20.6)
- Document 10/10 (doc: VERIFICATION_PLAYBOOK.md §3.3 — the change IS the canonical
  brief, edited in a PR per §23.2 rule 4) · Requirements 10/10 (adds exactly the
  MON-030 score+grade+bars check Reza asked to "check later", plus the Part F
  capture) · Logic 10/10 (no math; the expected CFO===Home convergence is grounded
  in the shipped #1380/#1381).
- **Coverage boundary (honest — §22.2.4):** this brief change *instructs* the
  Ring-3 human/Chrome-relay run to check MON-030 on live data; it does NOT itself
  verify any number. MON-030 stays FIXING.
