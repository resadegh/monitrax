# MATRIX — Stage 2 (PSI capture) Ring-3 fixture spec

**From:** The Matrix · **For:** the Code session (build the triggering golden to THESE numbers + the Stage-2 capture GATE) + the Matrix's own Stage-2 Ring-3. **Source:** MON-097 engine (`classifyPsi`, `PsiInput`/`PsiClassificationResult`) + the capture-feature brief + MON-100 reachability, `9901d827`.

## ⚠️ Read first — PSI is NOT structurally inert on Reza (unlike FTE/IEE + Div 152)
FTE/IEE and Div 152 can't fire for Reza (no family-trust election; no active-asset disposal). **PSI is different:** if **ReNew Holding Pty Ltd** earns income that is mainly a reward for Reza's personal efforts/skills (e.g. consulting billed through the company), PSI genuinely applies — and capturing it truthfully **will move his numbers, correctly**. So "inert on Reza" means **inert until he completes the PSI questionnaire for an entity that has PSI** — NOT "can never apply." Whether ReNew Holding's income IS PSI is a registered-tax-agent determination; the questionnaire captures Reza's answer, the engine classifies, the Matrix verifies the mechanism — the Matrix does not decide his PSI status for him.

## THE load-bearing control — the capture GATE (mirror the Stage-1 `buildFteIeeInput` gate)
The engine defaults an unset `meetsResultsTest` to FAIL — so a PARTIAL input at ≥80%-one-client would wrongly fire a full attribution. **The assembler gate must be all-or-nothing:** build `PsiInput` (→ `input.psiByEntity`) ONLY when the user has affirmed the entity has PSI AND every test fact the classification path needs is explicitly captured. Incomplete questionnaire → **null → overlay inert**, NEVER a partial input the engine turns into a spurious $X attribution. A blank answer must neither fabricate nor suppress an attribution (the Stage-1 rule, applied to PSI).

## Seeded goldens (Code builds the CI triggering tests to these)
`classifyPsi` rule: `oneClientPct < 0.8` → any PSB test available; `≥ 0.8` → ONLY the results test; PSB → `psiAttributedToIndividual = 0`; not-PSB → `psiAttributedToIndividual = totalPsiIncome` + `UC-PSI-DEDUCTION-RESTRICTIONS` (the s86-60 NET restriction dollar is the flagged future sub-PR — surfaced, not computed).

| # | Entity | totalPsiIncome | largestClient | unrelated (advertising) | results test | Expected result |
|---|---|---|---|---|---|---|
| P1 **FIRES** | 90% one client, no PSB | $200,000 | $180,000 (90%) | — | FAIL | `isPsi`, **not** PSB → **$200,000 attributed** to individual (s86-15) + `UC-PSI-DEDUCTION-RESTRICTIONS` |
| P2 PSB (unrelated) | diversified | $150,000 | $60,000 (40%) | 3, direct-advertising | — | PSB via s87-20 → **$0 attributed**, no line |
| P3 PSB (results) | 90% one client BUT results | $200,000 | $180,000 (90%) | **PASS** | — | PSB via results test → **$0 attributed**, no line |
| P4 **GATE** | PSI affirmed, a required test answer BLANK | $200,000 | $180,000 | `null` | — | **assembler returns null → overlay inert** — NO $200k attribution (the partial-input trap closed) |
| P5 non-PSI | product sales, not personal services | — | — | — | — | engine not invoked → byte-unchanged |

## Matrix Ring-3 assertions (VR-0NN, after Stage 2 merges)
**Fire path (CI golden — Reza has no seeded PSI entity, so this is the golden, not a live screen unless he opts to seed one):**
1. P1 entity view: **PSI attributed $200,000** to the individual + **`UC-PSI-DEDUCTION-RESTRICTIONS`** flag, citations Part 2-42 / s84-5 / s87-15 / s86-15; `crossCutting.psiByEntity` present; the individual's assessable income reflects +$200,000 (the NET deduction-restriction dollar stays UNCOMPUTED pending the s86-60 sub-PR — verify attribution + flag, not a final net delta).
2. P2/P3: `isPsb: true`, `$0` attributed, no PSI line.
3. P4: incomplete capture → inert, no attribution (gate proof).
4. Float === Decimal on every case.

**Live half on Reza (the part I actually run):**
5. Until Reza completes the PSI questionnaire, household byte-identical to baseline (Income $317,751 / Deductions $172,325 / Taxable $145,426 / Owing $26,926 / Net $38,054 / Medicare $2,909); no PSI attribution line, no `crossCutting` key on any entity.
6. **IF Reza affirms PSI for ReNew Holding and completes the questionnaire:** the change is EXPECTED and correct — I'll verify the attribution matches the classification and explain the delta to its inputs (not flag it as a regression). Any movement WITHOUT a capture entry = FAIL.

## Guardrail checks (fold into the run)
- **Gate (the headline):** with PSI affirmed but one test answer blank → inert; complete the answer → fires. Proves capture completeness, not a partial guess, is what fires it.
- **Safe default:** un-affirm PSI (or blank the questionnaire) → attribution vanishes, entity byte-identical to pre-capture.
- **SSOT:** attribution produced once by `entityTaxFactsAssembler → input.psiByEntity → classifyPsi`; no surface re-derives (Ring-1 source-lock).
- **Reform/config:** the 80% threshold + PSB tests trace to engine config, not a capture-layer literal.
- **Stitch-first:** the questionnaire UI designed in the Code session, §18.8 ≥9/10, presented to Reza before build.

---
*Prepared by The Matrix (`9901d827`). PSI is the one overlay that can genuinely apply to Reza — so the fixture's live half is "inert until he captures," and a truthful capture that moves his numbers is a correct fire, not a regression. The capture GATE (no partial input ever fabricates an attribution) is the load-bearing control; the $200,000-attributed P1 golden + the P4 gate case are what Code builds to.*
