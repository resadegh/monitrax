# CODE BRIEF (Fable 5) — Matrix Guardrail Review → 10/10 Scorecard + Hardening PR

**Paste into a fresh Claude Code session on FABLE 5. Your job is to REVIEW the Matrix's own guardrails, laws and processes — specifically why recent drift happened (SSOT / single-calc-engine not held, non-holistic fixes) — score them honestly out of 10, and ship ONE hardening PR that closes every gap so the score is a genuine 10/10. The single acceptance bar Reza set is: NEVER DRIFT AGAIN. This review must itself introduce zero drift.**

---

## 0. PRIME DIRECTIVE + boot ritual (do this FIRST, no exception)
**NEVER DRIFT.** Every session — including this one — starts by loading the guardrails and re-verifying them, not by coding.
1. `git clone`/`pull` resadegh/monitrax → checkout main → pull. **Pin HEAD**; cite `file:line` at that HEAD for every claim; re-verify every anchor live (lines drift). Never guess/assume — cite or mark UNVERIFIED.
2. Read, in order: `STATE.md` → `CLAUDE.md` (esp. §0 principles, §12.2.1 SSOT, §20.6/§20.7 pre-PR self-score, §21.2.1 Model/Neomatrix) → `docs/architecture/MATRIX_FIX_DISCIPLINE.md` → `docs/architecture/CALC_SSOT_WALL.md` → `docs/issues/FIX_PROTOCOL.md` → the Neomatrix blueprint `docs/blueprint/PHASE_53_MONITRAX_NEOMATRIX.md` + `docs/blueprint/PHASE_54_NEOBRAIN.md` + `docs/blueprint/NEOAUDIT.md`.
3. **Consult Neomatrix** (`components/admin/neomatrix`, `app/api/admin/neomatrix`, `tests/neomatrix/`) as the financial-graph model-of-record before judging whether "one producer per value" is real.

### Critical context you must know (it is WHY this review exists)
The Matrix carries three standing laws Reza has mandated. **Two of them currently live ONLY in the Cowork/Matrix project memory — they are NOT in the repo — so a Code session like you cannot inherit them.** That is itself the top guardrail gap. The laws:
- **FIRST LAW — SSOT / single calc engine.** One fact/one row; one canonical producer per derived value; screens only read; don't store derived values; cumulative, no-regression, no-new-duplicate. (Partly in `MATRIX_FIX_DISCIPLINE.md` + `CALC_SSOT_WALL.md`, PR #1439 — verify how fully it is wired into CLAUDE.md/FIX_PROTOCOL/PR template.)
- **SECOND LAW — 10/10 self-review on every financial recommendation** (Reza 2026-07-17). Before any recommendation/verdict/number is presented, it is self-reviewed against requirements + design principles + the laws + the four lenses, and only presented at an honest 10/10. **Not yet in the repo.**
- **THIRD RULE — keep Neomatrix + Neobrain + The Matrix in sync with every change** (Reza 2026-07-17): Step 4 "Model" (update Neomatrix in the same PR as any producer change) + Step 10 "Promote" (grow NeoAudit) + update Neobrain when intake/reconciliation moves + never sandbox-only (docs land in repo). **Not yet in the repo as an enforced gate.**

### Current state, verified live at HEAD (re-confirm each `file:line`, then score — do NOT assume missing)
The Matrix already checked these at pin `7163caba`; treat as a starting map, re-verify live:
- **Engine teeth EXIST** in `package.json` `vercel-build` (line 8): `lint:financial-surfaces` (line 11) + **`lint:source-lock`** (line 12) + **`neomatrix:check`** all run in CI before build. `.audit/source-lock-exceptions.json` exists (the ratchet list). → D2 and part of D6 already have real teeth — **credit them, don't rebuild them**; score them on completeness + whether the exception count is trending down.
- **FIX_PROTOCOL.md already has Step 0**: Stage-1 §0 is the "Holistic SSOT audit — MATRIX_FIX_DISCIPLINE clause-4 gate" and it already cites the MON-080 tax-only lesson. → D3 likely already high; your job is confirm + tighten, not invent.
- **`.github/PULL_REQUEST_TEMPLATE.md` does NOT exist** → the PR must **create** it (this is the biggest single mechanical gap: no un-skippable reviewer checklist).
- **SECOND + THIRD laws are NOT in the repo** (memory-only) → CLAUDE.md + MATRIX_FIX_DISCIPLINE.md must add them. This is the top gap.

---

## 1. The drift record you are reviewing against (the failure modes the guardrails MUST provably prevent)
Treat each as a regression scenario: **"would today's gates have blocked this before merge?"** If not, the PR must close that hole.

| Case | The drift | Root cause | Evidence |
|---|---|---|---|
| **MON-032** (#1359) | loan monthly cost fixed on property surfaces but left `$0` (raw `minRepayment`) on expenses/cashflow/cfo/portfolio/debt-analysis | fixed one surface, not the canonical producer | `MATRIX_FIX_DISCIPLINE.md` table |
| **MON-037** (#1395/#1427) | `/dashboard/expenses` counted one-offs ×12 while property/tax excluded them | expenses page never migrated to the isRecurring gate | same |
| **MON-080/086** (#1434/#1437) | managed-rental agent fee correct in tax, **double-counted in cashflow** | tax-path fixed; cashflow producer left double-subtracting; **Ring-3 verified TAX ONLY (VR-011)** | `MATRIX_FIX_DISCIPLINE.md` + `VR-011.md` |
| **MON-081** (live, VR-013, `7163caba`) | SAME interest-only loan shows **5 different monthly costs**: $1,191 (cashflow/actuals) vs $1,271 (expenses+overview/estimate) vs $1,295/$1,131 (real repayments) vs $0 ("this FY") | expenses page + overview card never migrated to the actuals-first producer; FY-scoped actuals window | `docs/verification/runs/VR-013.md` (PR #1441) |

The common thread: **a fix touched one surface, the sibling surfaces kept their own copy of the formula, and verification checked only the surface that was edited.** The guardrails exist to make all three impossible. Your review proves whether they now do.

---

## 2. Review dimensions + rubric (score each /10 with `file:line` evidence; overall 10/10 only when ALL are 10)
For each dimension: (a) state the current mechanism + cite it, (b) score it honestly, (c) if <10, specify the exact repo change that brings it to 10 — and make that change in the PR.

- **D1 — Guardrails live in the REPO and every session inherits them.** CLAUDE.md boot ritual explicitly requires: load the three laws, run STEP 0 SSOT map, consult Neomatrix, cross-surface Ring-3, 10/10 self-review, neo-sync. *(Expected gap: SECOND + THIRD laws not in repo. Fix: add them.)*
- **D2 — SSOT / single calc engine is real and mechanically enforced.** Exactly one canonical producer per money/cashflow/tax/loan/income/expense value (`lib/calculations/*`, `masterFinancialService`, tax engine, `frequencies.ts`). The **source-lock lint** exists, runs in `vercel-build`/CI, blocks inline `frequency×amount`, raw `minRepayment`, and `.reduce` over raw arrays in `app/**/page.tsx`; the exception list (`.audit/source-lock-exceptions.json`) is **ratchet-down-only**. Verify it is real and green, and that the exception count is trending down. Enumerate remaining bypass sites.
- **D3 — Holistic end-to-end (STEP 0) is required and evidenced.** `FIX_PROTOCOL.md` requires a producer→consumer map + four-lens read BEFORE any fix; the PR template forces it. *(Verify it's Step 0, not optional.)*
- **D4 — Cross-surface verification is a HARD gate.** `MATRIX_FIX_DISCIPLINE.md` gate 4 + PR template require the same value read identically on every surface; single-surface/tax-only = FAIL. Confirm this is enforced, not advisory.
- **D5 — Cumulative / no-regression / no-new-duplicate.** Net issue count and lint-exception count may only go down; reconcile/import routes through the signature-upsert (no minted duplicate row). Run the four drift cases above through the gate stack and record, per case, exactly which gate now blocks it. If any case would still slip, that is a Sev-1 gap to close in this PR.
- **D6 — Neo-sync is enforced.** Every fix PR updates Neomatrix (Model, Step 4) + NeoAudit (Promote, Step 10) + Neobrain (if intake/reconciliation touched); never sandbox-only. Wire into FIX_PROTOCOL + PR template as a required checkbox.
- **D7 — 10/10 self-review is a codified gate.** Present-side (recommendations) + PR-side (§20.6). Add it as MATRIX_FIX_DISCIPLINE gate 7 + a PR-template checkbox.

**Scoring rule:** be adversarial, not generous. A guardrail that exists only as prose with no CI teeth or no PR-template checkbox is ≤7, not 10. 10 means: in the repo, referenced by the boot ritual, and mechanically checked (CI lint and/or a required PR-template gate a reviewer cannot skip).

---

## 3. Required outputs (ONE PR)
1. **`docs/audits/MATRIX_GUARDRAIL_SCORECARD_2026-07.md`** — the scorecard: each dimension D1–D7 with current evidence (`file:line`), score, the gap, and the fix; the four-drift-case regression table ("which gate now blocks this"); an overall score that is 10/10 *after* the PR's changes (not before — show the before/after).
2. **The hardening changes that make it true** (single PR, doc/config-level — no engine/schema change):
   - **CLAUDE.md** — §0 + §12.2.1 + §20.6: reference all three laws as binding; add the guardrail-first **session-start ritual** (load laws → STEP 0 SSOT map → consult Neomatrix → cross-surface Ring-3 → 10/10 self-review → neo-sync); state single-producer + no-bypass as law.
   - **`docs/architecture/MATRIX_FIX_DISCIPLINE.md`** — add **Gate 7 = 10/10 self-review** (present-side + PR-side) and **Gate 8 = neo-sync** (Neomatrix/Neobrain/NeoAudit updated in the same PR). Fold in MON-081/VR-013 as the newest live evidence row.
   - **`docs/issues/FIX_PROTOCOL.md`** — make **Step 0 = holistic end-to-end SSOT map** explicit and first; add the neo-sync + cross-surface + 10/10 gates to the pre-PR block.
   - **`.github/PULL_REQUEST_TEMPLATE.md`** — **CREATE it** (does not exist today); a checklist a reviewer cannot skip: STEP 0 map done · single canonical producer edited (no surface bypass) · source-lock lint green + exceptions did not rise · cross-surface Ring-3 (every surface, not one) · Neomatrix/NeoAudit/Neobrain updated · 10/10 self-review · no new duplicate row / no re-opened issue.
   - **Source-lock lint** — if D2 finds it missing or not CI-blocking, wire it (mirror `lint:financial-surfaces`) with the current bypass sites as a ratchet-down exceptions list. If it already exists, confirm and cite it; do not duplicate.
   - **Neomatrix** — record the invariant "same value reads identically on every surface" and register the canonical producers as the sole sources (at minimum the loan-cost producer `resolveLoanMonthlyCost` from the MON-081 finding).
3. **Registry**: raise a tracking issue for any Sev-1 guardrail gap found (`npm run issues:raise`), so the hole is itself tracked to closure.

---

## 4. Definition of done → handback
- The PR is **doc/config only** (no engine, no schema — so it can't itself introduce a numeric drift). CI green; source-lock lint green; exception count did not rise.
- The scorecard shows every dimension at **10/10 after this PR**, with the four drift cases each mapped to the specific gate that now blocks them.
- **Neo-sync done in this same PR** (Neomatrix invariant + FIX_PROTOCOL/PR-template wiring). Never sandbox-only.
- **Self-score to an honest 10/10 (SECOND LAW) before you present the scorecard** — and state the one caveat if any remains, rather than rounding up. A guardrail review that over-claims its own score would be the very drift it is meant to end.
- Hand back to Reza to merge. Do NOT auto-merge — this changes standing law and the PR template (a critical instruction change requiring Reza's confirmation).
- **Scope discipline:** this PR is guardrail hardening ONLY (doc/config). It does not fix Monitrax's numeric issues. Once merged, the hardened guardrails govern the queued Monitrax fixes — the next one in the queue is **MON-081** (loan-cost actuals-first cross-surface, brief `CODE_BRIEF_MON-081_loan-cost-cross-surface`), which will be built and verified under exactly this hardened process (single producer, cross-surface Ring-3, neo-sync, 10/10). Keeping the two PRs separate is itself the discipline — a law change and an engine change never ride together.

---
*Prepared by The Matrix for a Fable 5 review session. Live evidence: VR-013 (#1441), MATRIX_FIX_DISCIPLINE.md + CALC_SSOT_WALL.md (#1439). Scope: harden the guardrails so drift is mechanically impossible — no Monitrax engine/schema change. The bar is Reza's: NEVER DRIFT.*
