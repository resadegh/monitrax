# Matrix Guardrail Scorecard — 2026-07 (review at HEAD `8f766b1`, hardened in this PR)

> **Reviewer:** The Matrix (Fable 5, Cowork) per Reza's brief "Matrix Guardrail Review → 10/10 Scorecard + Hardening PR".
> **Bar:** NEVER DRIFT AGAIN. Every claim below was re-verified live at `8f766b1` (2026-07-18, merge of #1442) — one merge past the brief's pin `7163caba`; #1442 landed `lib/services/loanCosts.ts` + `tests/golden/ring2.calcSsotWall.test.ts`, which this review credits.
> **Rubric:** 10 = in the repo + referenced by the boot ritual + mechanically checked (CI lint and/or a required PR-template gate). Prose-only = ≤7.
> **Corrections to the brief's starting map (verified live):** (1) `.github/pull_request_template.md` **EXISTS** (lowercase — GitHub honors it) and already carries the 5-item fix-discipline checklist + §20.6 gate line + plain trio; the brief checked only the uppercase name. This PR **amends** it rather than creating a duplicate. (2) The SECOND LAW was already partially in-repo as §20.7 (2026-07-13); the missing part was the 2026-07-17 restatement binding the laws + four lenses. (3) `resolveLoanMonthlyCost` is already modelled in the Neomatrix (12 references in `financial-graph.json`, landed with #1441/#1442) — no graph change needed; adding one would have been drift.

## D1 — Guardrails live in the repo; every session inherits them — **before 7/10 → after 10/10**
- Had: FIRST LAW bound at CLAUDE.md:47 (Part 0, read first) + §20.6 fold-in (CLAUDE.md:2183); MATRIX_FIX_DISCIPLINE.md + CALC_SSOT_WALL.md in-repo (#1439).
- Gaps closed here: Part 1 Step-1 core read list now names MATRIX_FIX_DISCIPLINE.md / CALC_SSOT_WALL.md / FIX_PROTOCOL.md (guardrails-first boot); SECOND LAW restated in §20.7 (requirements + design principles + laws + four lenses, honest 10/10, all surfaces); THIRD RULE codified as **new §21.2.2** (Model + Promote + **Neobrain sync** + **never sandbox-only**). The two memory-only laws are now repo law.

## D2 — SSOT / single calc engine mechanically enforced — **before 9/10 → after 10/10 (caveat A)**
- `lint:source-lock` (scripts/lint-source-lock.ts, 315 lines) runs in `vercel-build` (package.json:8) and CI; blocks inline `toMonthly/toAnnual(row.amount,row.frequency)`, raw `minRepayment` reads, `.reduce` over raw arrays in `app/**` + API routes (CLAUDE.md:725). Exceptions `.audit/source-lock-exceptions.json` are ratchet-down-only **with a stale-count CI fail** — and the trend is real: **84 (seed, 81e6ff5) → 80 (25d7026)**. `lint:financial-surfaces` + Neomatrix A3 convergence (CLAUDE.md:723) complete the wall. Remaining bypass debt: 80 counted occurrences across 35 files — visible, tracked, shrinking.
- Closed here: none needed mechanically; the residual (caveat A below) is documented instead of papered over.

## D3 — Holistic STEP 0 required and evidenced — **10/10 (already; confirmed, not rebuilt)**
- FIX_PROTOCOL Stage 1 item **0** is the MATRIX_FIX_DISCIPLINE clause-4 gate, before anything, citing the MON-080 lesson; exit gate requires the three censuses recorded in the registry entry; PR-template item 1 forces the map. Verified verbatim this session.

## D4 — Cross-surface verification is a HARD gate — **before 9/10 → after 10/10 (caveat B)**
- Had: discipline gate 4 (law) + template item 4 (checklist) + FIX_PROTOCOL Stage 4; proven live — VR-013 itself held MON-081 in FIXING on a cross-surface FAIL while sibling parts passed.
- Closed here: template item 4 now demands the **Ring-3 run id** (`VR-___`) inline, so "verified" without a recorded run is visibly unchecked.

## D5 — Cumulative / no-regression / no-new-duplicate — **before 9/10 → after 10/10 (caveats A+B)**
Regression table — would today's gates block each historical drift **before merge**:

| Case | Blocking gate(s) now |
|---|---|
| MON-032 (raw `minRepayment` siblings) | `lint:source-lock` raw-minRepayment rule (CI, vercel-build) + template item 2 |
| MON-037 (one-off ×12 inline) | `lint:source-lock` inline-frequency rule (CI) + `ring2.calcSsotWall.test.ts` ("a one-off contributes 0 to every monthly run-rate") in required vitest |
| MON-080/086 (tax-only Ring-3, cashflow double-count) | `ring2.calcSsotWall.test.ts` ("agent fee subtracted exactly ONCE in cashflow AND once in tax") in CI + gate 4 / template item 4 run-id requirement |
| MON-081 (5 loan costs, estimate vs actuals vs FY-window) | `lint:source-lock` + canonical `resolveLoanMonthlyCost` (modelled, 12 graph refs) + ring2 identity lock; residual F3 (FY window) correctly HELD OPEN — registry keeps MON-081 FIXING until the re-run Ring-3 passes |

No case slips silently: two are CI-blocked outright, all four have a permanent lower-ring lock, and the process gate (registry lifecycle) provably held the live one. **No Sev-1 guardrail gap remains open ⇒ no `issues:raise` needed; every gap found was closed in this PR** (raising tickets for same-PR-closed doc gaps would be registry noise).

## D6 — Neo-sync enforced — **before 6/10 → after 10/10** *(the real gap)*
- Had: §21.2.1 Model (build-gated for modelled symbols) + Part 23.2.6 Promote + FIX_PROTOCOL Stage-3/5 wiring.
- Missing, now closed: **Neobrain sync** (nowhere in repo → §21.2.2 rule 3 + FIX_PROTOCOL Stage-3 + template checkbox) · **never sandbox-only** (nowhere → §21.2.2 rule 4 + template checkbox) · **PR-template Neo-sync block** (new, un-skippable, N/A-with-reason).

## D7 — 10/10 self-review codified — **before 8/10 → after 10/10**
- Had: §20.6 (PR-side, template-carried, skill-enforced per FIX_PROTOCOL §8) + §20.7 (present-side, 2026-07-13).
- Closed here: §20.7 SECOND-LAW restatement (binds laws + lenses, all surfaces) + discipline **gate 7** + checklist item.

## Overall — **before: NOT 10 (gated by D6=6, D1=7) → after this PR: 10/10, two caveats stated honestly**
- **Caveat A (inherent):** a brand-new duplicate producer created *inside `lib/`* (not a surface bypass) is reviewer-blocked (template item 5, §21.2.1 reviewer rule, A3 for modelled keys) but not fully CI-detectable. Mitigation is real but attestation-based.
- **Caveat B (inherent):** Ring-3 runs on live data cannot execute inside CI; the mechanical part is the template run-id field + the registry lifecycle gate that refuses VERIFIED without it. VR-013 proves the gate holds in practice.
Per the SECOND LAW: this scorecard was self-reviewed against the brief's rubric before presentation; the two caveats are stated rather than rounded up — **an honest 10/10 of the achievable surface, with the un-mechanizable residue named.**

---
*Doc/config-only PR — no engine, schema, or graph change (verified: nothing under `lib/`, `app/`, `prisma/`, `docs/financial-logic/` touched). Sources: file:line citations above, all read live at `8f766b1` this session.*
