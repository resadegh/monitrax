# CODE BRIEF (Fable 5) — MON-020 / MON-060: collapse the duplicate tax engines to ONE canonical producer

**Paste into a fresh Claude Code session on FABLE 5** (tax-facing, subtle — highest-stakes number). This is the next Calc-SSOT Wall Mechanism-B migration now the guardrails are hardened (#1444) and the loan/managed/one-off cluster is closed-loop verified (VR-015). Incremental single-producer collapse — NOT a tax rewrite.

## 0. Boot ritual + the hardened guardrails (do this FIRST — every session, no exception)
1. `git clone`/`pull` resadegh/monitrax → main → pull. Pin HEAD; cite `file:line` at that HEAD; re-verify anchors live.
2. Read `STATE.md` → `CLAUDE.md` (Part 0 laws, §12.2.1 SSOT, §20.6/§20.7 self-review, §21.2.1 Model, **§21.2.2 neo-sync**) → `docs/architecture/MATRIX_FIX_DISCIPLINE.md` (the 8 gates — note **gate 4 cross-surface**, **gate 7 self-review**, **gate 8 neo-sync**) → `CALC_SSOT_WALL.md` → `docs/issues/FIX_PROTOCOL.md`. These are now repo law (hardened to 10/10 in #1444).
3. **STEP 0 = holistic end-to-end map** before any code: enumerate EVERY tax producer and EVERY surface that shows a tax number. Four lenses. The fix scope is the whole map.

## The target — MON-020 (two tax engines disagree) + MON-060 (tax differs cashflow vs tax page)
Root cause = **§12.2.1 duplicate producer**: more than one tax calculation path exists, so tax numbers can diverge by surface. Registry evidence when filed: two engines gave **$153,278 vs $104,323** taxable/tax. This is the classic SSOT violation on the most important number in the app.

### Current live state (Matrix, VR-015, 2026-07-18 — re-verify, numbers move)
Good news that changes the shape of this job: the **tax page and `/cashflow` now AGREE** on the FY estimate — Total Deductions **$142,319**, Tax Owing **$89,287**, effective 34.1% — read identically on both (a convergence since the issue was filed). **But two agreeing outputs from two separate engines is still an SSOT violation** — they agree *today* and will drift again on the next change. And other tax surfaces were NOT checked (Reports, CFO/What-If, plan, portfolio snapshot, salary-sacrifice scenarios). So:

## The work (single canonical tax producer)
1. **Enumerate every tax entrypoint** (STEP 0). Known/likely: the tax page (`/dashboard/tax`), the `/cashflow` FY estimate, Reports, CFO advice/scenarios + salary-sacrifice What-If, plan page, portfolio snapshot, any `app/api/**/tax*` route, `masterFinancialService`, and the core tax engine (`lib/**/tax*`). Cite each `file:line`. Identify which is the **canonical** engine (the ITAA-cited one) and which are duplicates/re-derivations.
2. **Capture each surface's tax numbers LIVE** (taxable income, total deductions, tax owing, effective rate) and record where they diverge NOW. Any current divergence = the concrete bug; agreement = latent duplicate to still collapse.
3. **Collapse to ONE producer.** Route every surface through the single canonical tax engine; delete the duplicate calculation paths (or reduce them to thin readers of the canonical result). No surface re-derives tax. Preserve the ITAA lineage + the AFSL/general-advice labelling.
4. **Do not change the tax math** unless a surface is provably wrong — this is a *dedup/routing* fix, not a re-computation. If collapsing reveals which of the two historical numbers was right, that is a finding to record, not a silent change.

## Ratchets (gate 1-3 + 8)
- Ring-0: taxable income / deductions / tax owing are **identical on every tax surface** (single producer).
- Ring-1: `lint:source-lock` green; no surface computes tax inline; exception count does not rise (ratchet-down — currently 80).
- Ring-2 golden: a new `tests/golden/` case asserting the SAME tax result across the tax route, cashflow route, reports, and CFO for the golden household — so two engines can never re-appear.
- **Neo-sync (gate 8):** model the single canonical tax producer + the "one tax result, all surfaces" invariant in the **Neomatrix**; add the golden as the **NeoAudit** ratchet (Promote); update **Neobrain** only if reconciliation/categorisation is touched; nothing sandbox-only.

## Cross-surface Ring-3 (gate 4 — Matrix, after merge)
The Matrix re-runs live on Reza's data: tax page ≡ /cashflow ≡ Reports ≡ CFO ≡ portfolio all show the same taxable income / deductions / tax owing, with the recorded `VR-___` run id. MON-020 + MON-060 → VERIFIED only when identical on every surface.

## Definition of done → handback
Producer-collapse PR behind CI + green source-lock + the new golden; Neomatrix/NeoAudit updated in the SAME PR (gate 8); PR-template checklist complete incl. the Ring-3 run-id field; **self-scored to an honest 10/10 (gate 7)**. **Reza merges** (tax = money-facing, number-changing → his click per the autonomy grant). Then Matrix cross-surface Ring-3 → VERIFIED.

---
*Prepared by The Matrix. Next Calc-SSOT Wall Mechanism-B migration after the loan/managed/one-off cluster (VR-013/014/015) and the guardrail hardening (#1444). Fable 5 (tax-facing). Incremental single-producer collapse within the existing architecture — no tax rewrite, no schema change.*
