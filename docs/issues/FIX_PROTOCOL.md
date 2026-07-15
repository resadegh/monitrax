# THE FIX PIPELINE — Monitrax Issue-Fixing Protocol

> **Status: LIVE + GROWING (never "closed").** This is the canonical operating manual for fixing ANY registry issue (MON-xxx). The standing LAW is **CLAUDE.md Part 24** (CLAUDE.md wins on any conflict — it is the single rule store, §20.6). This manual is the *how*: the stages, the gates, the census method, the per-fix Chrome verification, the templates, and the growth ledger.
>
> Companion docs: `docs/issues/README.md` (registry spec + gate) · `docs/blueprint/NEOAUDIT.md` (the verification platform) · `docs/verification/VERIFICATION_PLAYBOOK.md` (Ring-3 run procedure) · `docs/financial-logic/graph/GENERATED_CORE.md` (the Neomatrix map).

**Why this exists (Reza directive 2026-07-14, verbatim intent):** *"My biggest issue is that most of the issues that you have found and fixed are either not fixed properly or not fixed considering the holistic Monitrax and Neomatrix, so the numbers are not 100% correct. I want the process document to work hand in hand with NeoAudit so I am confident that the issues are being resolved and NeoAudit updated with the fix and it is a growing live system."* Plus (same day): *"each fix needs to have its own review by numbers you get from claude chrome to make sure the fix has removed the issue and it is not causing further issues"* and *"tackle each issue separately, spend enough time and effort to fix it once."*

---

## §1 The honest failure diagnosis — why past fixes didn't stick

Every rule in this pipeline exists because a real fix failed in a specific way. These are the six failure modes, with the historical evidence, and the stage-gate that now kills each one. **A reviewer who sees a fix PR exhibiting any of these MUST reject it.**

| # | Failure mode | Real example (verified) | Killed by |
|---|---|---|---|
| **F1** | **Partial-producer fix** — the symptom was fixed on the surface where it was reported while a second producer of the same number stayed alive. | MON-023 filtered `isRecurring` in the *general* dashboard views only; the property-cashflow engine, expense aggregator, and tax deduction loop kept ×12'ing one-offs → re-found as MON-037. MON-019 gated `calculateRefinanceOpportunities` but not `generateRateAlerts` → re-found as MON-038. | **Stage 1 Producer Census** (§3): no fix code until EVERY producer of the semanticKey is enumerated; Stage 3 gate: the PR proves exactly ONE producer remains. |
| **F2** | **Same engine, different inputs** — surfaces converged on one engine but were fed different input sets, so they still disagreed. | MON-028: `/api/properties/[id]` silently dropped `linkedTransactions` → detail page declared-only, +$34K drift. MON-035/036: three transaction *windows* (all-time vs 12-month) feeding one engine. | **Stage 1 Input-Feed Census** (§3): the census covers the DATA FED to each producer, not just the engine; parity tests must exercise the real independent serialization paths, never a shared resolver. |
| **F3** | **Verified-by-claim, not by numbers** — a fix was declared done on CI-green or a formula argument, never re-checked on live data. | Multiple pre-VR fixes marked done that VR-001/002/003 later re-found live. | **Stage 4 Per-Fix Chrome Verification** (§4): VERIFIED requires a targeted real-data capture proving the symptom GONE + regression guard clean. CI green is never verification (§23.2.3). |
| **F4** | **Unmodelled surfaces (Neomatrix blind spots)** — A3 convergence could not fire because the diverging surface was never modelled. | MON-013 (portfolio/snapshot second assets producer), MON-014 (third cashflow producer) — both unmodelled, both invisible to the graph. | **Stage 1 model-first rule** (§21.5/§21.2.1): an unmodelled number in the fix's path is modelled in the same PR before the fix is considered designed. |
| **F5** | **Fix without Ratchet/promotion** — the bug was fixed but nothing was added to NeoAudit, so the CLASS could recur and the Chrome brief kept re-checking it. | Pre-Part-23 fixes; the audits' recurring "found more gaps." | **Stage 5 Promotion** (§5): CLOSED requires the Ratchet test at the lowest ring + Neomatrix delta + parity-coverage growth recorded. A fixed-but-not-promoted issue is an incomplete fix (§23.2.6). |
| **F6** | **Batched / entangled fixing** — several issues fixed in one sweep; regressions and collisions hid inside each other; nothing was individually verifiable. | The pre-registry era's multi-issue PRs. | **One issue, one PR, start-to-finish** (§2): the next issue is not started until the current one passes Stage 4. A PR touching more than its issue's census must justify every extra surface. |

**The three teeth this pipeline adds over just "following CLAUDE.md":** the mandatory **census before code** (holistic by construction), the **per-fix Chrome number verification** (proof, not claim), and the **un-skippable promotion stage** (NeoAudit grows with every fix, so the same class can never be re-found).

---

## §2 The pipeline — six stages, hard gates, mapped to registry statuses

One issue at a time. Each stage's exit gate must be satisfied — with recorded evidence — before the next stage starts. The registry status IS the pipeline position; `npm run issues:check` enforces the transitions it can see (see §6 for what is machine-enforced today vs roadmap).

```
Stage 0        Stage 1          Stage 2         Stage 3        Stage 4          Stage 5
INTAKE   →   UNDERSTAND   →    DESIGN     →    BUILD     →    VERIFY     →    PROMOTE
(OPEN)       (→DIAGNOSED)    (DIAGNOSED)     (→FIXING)      (→VERIFIED)      (→CLOSED)
```

### Stage 0 — INTAKE → `OPEN`
- Every substantive finding is filed via `npm run issues:raise` at discovery (never carried in chat/memory). De-dup by semanticKey+surface; a CLOSED issue recurring is a NEW issue (the old fix failed — see §7 retro rule).
- Record: exact symptom, surfaces, the wrong numbers verbatim, evidence run (VR-NNN), plain-English `plain.issue`.
- **Exit gate:** valid registry entry; `issues:check` green.

### Stage 1 — UNDERSTAND → `DIAGNOSED`  *(the holistic stage — most past failures died here)*
1. **Neomatrix FIRST (§21.5):** find the number's node(s); read engine, formula, authority, lineage, `file:line`. If the number is unmodelled → that is itself a finding; it will be modelled in this issue's PR (F4).
2. **Producer Census (§3):** enumerate EVERY producer of the number app-wide — not just the one on the reported surface.
3. **Input-Feed Census (§3):** for each producer, enumerate the data fed to it (query, window, filters, serialization) — same engine ≠ same inputs (F2).
4. **Consumer Census (§19.4):** enumerate every downstream consumer/render site via lineage edges + grep.
5. **§19.2 four-step audit:** input contract+units (proven from schema+writer+callers) → the correct rule/law/formula (authority cited, never from memory) → hand-computed worked example → verdict (✅/❌ with wrong# vs correct# / ⚠️ UNVERIFIABLE). **Never guess. An unverifiable root cause stays ⚠️ and the issue does NOT advance.**
- **Exit gate (→ DIAGNOSED):** root cause verified at real `file:line`s read this session; the three censuses recorded in the issue entry; Neomatrix consulted (and gaps flagged for modelling).

### Stage 2 — DESIGN  *(status stays DIAGNOSED; output is a fix spec)*
1. **Remove-the-culprit design (§23.2.1):** the broken producer/path is deleted or repaired AT SOURCE. Duplicate producers are deleted and their surfaces repointed to the ONE canonical source (§12.2.1). Never a compensating calc, UI-side correction, or wrapper.
2. **Decision forks go to Reza (§20.5):** any user-philosophy fork (a basis, a window, a semantics choice) is surfaced with a recommendation — never guessed. Recorded in the plan/issue when decided.
3. **Ratchet test chosen (§23.2.2):** the lowest ring that could have caught this class — wrong formula → Ring-0 fixture; duplicate producer → Ring-1 model+lint; plumbing/serialization/window → Ring-2 golden route test; cross-surface → Ring-2 parity matrix (real independent paths); render/label → Ring-2 display guard.
4. **Chrome verification spec pre-written (§4):** the exact surfaces, numbers, and regression-guard list — BEFORE the fix is built, so verification can't be shaped to fit the outcome.
- **Exit gate:** fix spec with exact `file:line` changes; decisions resolved; test + Chrome spec named. Self-scored (§20.4/§20.6): financial fixes require an honest 10/10 or STOP-and-surface.

### Stage 3 — BUILD → `FIXING`
1. **One issue, one draft PR.** Extra surfaces touched beyond the census must be justified line-by-line in the PR body (F6).
2. The PR carries, non-negotiably: the §20.6 tri-axis gate line (`Gate (§20.6): Document X/10 · Requirements X/10 · Logic X/10`) · the §19.2 evidence (units, formula+authority, worked example, verification) · the census tables (§3) · the Ratchet test (in the same PR, failing-before/passing-after where demonstrable) · the **same-PR Neomatrix update** (§21.2.1: repointed edges, deleted rogue nodes, new models for blind spots; `neomatrix:check` green) · the plain-English trio (§19.5) · the §16 doc-sync block · destructive-write checklist if applicable (§12.11).
3. **Coverage stated precisely (§22.2.4):** "this test verifies X; it does NOT verify Y — Y is Stage 4's job." Never "tested/complete/all green."
- **Exit gate (→ FIXING):** PR open with all blocks; CI green; registry entry updated with `fixPRs`, `downstreamConsumers`, `test`, plain trio (the gate enforces these at FIXING+).

### Stage 4 — VERIFY (per-fix Chrome) → `VERIFIED`  *(Reza 2026-07-14 — every fix, its own number-review)*
Run the per-fix Chrome verification loop (§4) against the PR preview or prod after merge. **PASS** = the issue's exact numbers are now correct (match the Stage-1 worked example) AND every regression-guard surface is unchanged/agreeing — the fix removed the issue and caused no further issues. **FAIL** = symptom persists OR any new divergence → the issue STAYS `FIXING`, a §7 retro entry is written (which stage let the bad fix through?), and the fix is re-diagnosed from Stage 1. A fix that removes X but breaks Y is not a fix.
- **Exit gate (→ VERIFIED):** the capture recorded (run ID in the issue notes); verdict PASS; CI green alone NEVER suffices (§23.2.3).

### Stage 5 — PROMOTE → `CLOSED`  *(NeoAudit grows — the "live system" contract)*
An issue may be VERIFIED and still not CLOSED. Closing requires the finding to be permanently absorbed into NeoAudit's structure (§23.2.6):
1. **Ratchet test is merged + running in CI** at the lowest ring — this class never reaches Ring 3 again; the Chrome brief shrinks accordingly.
2. **Neomatrix reflects the fixed topology — COUPLED to the NeoAudit update, same PR (CLAUDE.md Part 24 #6, Reza 2026-07-14).** The map and the proof move together: whenever you add a Ratchet test / parity resolver / modelled surface to NeoAudit, you update the Neomatrix in the SAME PR — rogue producers deleted from the graph, surfaces repointed, blind spots modelled with their `semanticKey` (so A3 convergence guards them from now on), and any drifted `file:line` anchor re-pinned (`neomatrix:check` fails the build on drift). You never update one without the other.
3. **Parity-matrix / golden coverage grown** where the issue exposed a coverage hole (including fixing any resolver that MASKED the bug by reading a shared source instead of the real independent paths — the MON-035 parity lesson).
4. **Canonical Chrome brief broadened if the finding revealed a NEW CLASS of human scrutiny (NEOAUDIT.md §10 step 5, Reza 2026-07-14).** Step 1's Ratchet automates the *specific* bug so the brief sheds it — but when the finding exposes a *category* the brief never told the auditor to check (MON-048 → "read the LABEL/badge, not just the number"), edit the canonical brief (`docs/verification/VERIFICATION_PLAYBOOK.md` §3.3) in the SAME PR so the next not-yet-automated instance is still caught by eye. The brief only ever gets *more complete*; never improvise a one-session brief. A finding that reveals a new scrutiny class but leaves §3.3 unchanged is an incomplete fix.
5. **Baseline updated** (`docs/verification/baselines/BASELINE.md`) with the new correct numbers; plan/changelog synced (§15/§16).
- **Exit gate (→ CLOSED):** promotion evidence listed in the issue entry. **A fixed-but-not-promoted issue is an incomplete fix and stays VERIFIED.**

---

## §3 The Census — the holistic rule, made mechanical

The census is what makes a fix "consider the holistic Monitrax and Neomatrix" by construction instead of by hope. Three tables, filled at Stage 1, pasted into the issue entry AND the fix PR:

**A. Producer census** — every place the number/semanticKey is produced:

| Producer | file:line | Engine or inline? | Canonical? |
|---|---|---|---|

How to build it: (1) Neomatrix node + its `rendered-at`/feeds edges; (2) grep the formula shape and field name across `app/` + `components/` + `lib/` (§12.2.1 detection patterns); (3) check `calcEngineRegistry` (§22.2.1). **The fix must end with exactly ONE row marked canonical and every other row deleted/repointed.**

**B. Input-feed census** — for each surviving producer path, what data reaches it:

| Surface | Fetch site (file:line) | Window/filter | Serialization drops? |
|---|---|---|---|

This is the F2 killer: identical engines fed different windows/filters/serializations are still duplicate sources. The fix must end with ONE feed (parameters explicit).

**C. Consumer census (§19.4)** — every downstream render/consumer of the number, from Neomatrix lineage + grep. Each becomes either a Stage-4 verification target or a regression-guard entry.

---

## §4 The per-fix Chrome verification loop (Ring 3, per issue)

Canonical template for the targeted brief (improve it here via PR, never improvise in chat — §23.2.4):

**A. Baseline (pre-fix, from the registry/VR run):** the exact wrong numbers + surfaces.

**B. The brief (post-fix, on the PR preview or prod):**
> Read-only check. Do not change any data. Report every number VERBATIM as a machine-readable list (`surface → label → value`).
> 1. **Target capture:** [the exact surfaces + figures from the issue — e.g. "Property HOME: Cashflow/yr on the detail page, the Properties list tile, and the Home dashboard tile"].
> 2. **Regression guard:** [the 2–4 nearest consumer-census surfaces the fix could plausibly disturb — e.g. "the other properties' cashflow tiles; the CFO health score; the master monthly expenses"].
> 3. Note anything on these screens that looks newly wrong, even if not listed.

**C. Verdict (by the comparing session):** target numbers == Stage-1 worked-example expectation AND baseline symptom gone AND regression guard unchanged/agreeing → **PASS**. Anything else → **FAIL** → stays FIXING → §7 retro → re-diagnose from Stage 1.

Store the capture in the issue notes with a run ID (`VR-NNN` for sweep runs, `FIX-MON-NNN-r1` for targeted per-fix runs).

---

## §5 NeoAudit integration map — the pipeline and the platform, hand in hand

| Pipeline stage | NeoAudit machinery it drives / uses |
|---|---|
| 0 INTAKE | Finding bus: `issues:raise` (+ gate `issues:check`, CI `tests/issues/registry.test.ts`) |
| 1 UNDERSTAND | The Neomatrix map (`GENERATED_CORE.md` / `financial-graph.json`); `calcEngineRegistry` inventory (§22) |
| 2 DESIGN | Ring assignment (Ratchet, §23.2.2); playbook brief templates |
| 3 BUILD | Ring 0–2 tests; `neomatrix:check` (A3 convergence, anchors); surface linter; registry gate at FIXING |
| 4 VERIFY | Ring 3 targeted Chrome run; verdict recorded; VERIFIED gate (§23.2.3) |
| 5 PROMOTE | Ratchet test in CI; Neomatrix delta; parity-matrix growth; `BASELINE.md` update; Chrome brief shrinks |

The contract in one line: **every issue that flows through the pipeline leaves NeoAudit permanently stronger** — one more locked class, one more modelled surface, one less thing the Chrome brief must eyeball. That is what "growing live system" means operationally.

---

## §6 Machine enforcement — today, and the roadmap

**Enforced today by `npm run issues:check` (+ CI):** lifecycle transition validity · `changesNumbers` issues cannot reach VERIFIED/CLOSED without a linked existing holistic test + ≥1 resolving Neomatrix semanticKey · FIXING+ requires `downstreamConsumers[]`, `fixPRs[]`, full plain trio · rootCause anchors must resolve to real files. Plus `neomatrix:check` (A3 + anchors) and the parity/golden suites in CI.

**Roadmap (each lands as its own PR; ordered by value):**
- **E1 — Chrome-verdict field:** registry schema gains `verification: { runId, verdict }`; the gate blocks VERIFIED for `changesNumbers` issues without a PASS verdict. (Makes Stage 4 machine-enforced instead of discipline-enforced.)
- **E2 — Census fields:** `producerCensus[]` / `inputFeedCensus[]` required at DIAGNOSED+ for `changesNumbers` issues. (Makes Stage 1 holistic-by-schema.)
- **E3 — Promotion block:** `promotion: { ratchetTest, neomatrixDelta, baselineUpdated }` required at CLOSED. (Makes Stage 5 un-skippable.)
- **E4 — Scorecard stages:** `neoaudit:scorecard` prints per-stage counts (how many issues sit at each pipeline stage) so pipeline health is a build output, not a claim.

Until E1–E3 land, the reviewer enforces those gates manually per CLAUDE.md Part 24 — the rules bind now; the machine catches up.

---

## §7 The process ledger — how this protocol itself grows

**Retro rule (non-negotiable):** every Stage-4 FAIL, and every CLOSED issue whose class is later re-found, triggers a ledger entry here answering three questions: *what escaped · which stage should have caught it · what gate/census/template change was made in response* (in the same PR as the entry). The protocol is versioned by this ledger — it starts strict and only tightens.

| Date | Trigger | What escaped | Stage at fault | Change made |
|---|---|---|---|---|
| 2026-07-14 | VR-004 Stage-4 FAIL (MON-035) | Home dashboard tile still diverges from detail/list for HOME (~$6,040/yr) though both use `computePropertyCashflow` on a 12-month window in code — a runtime input difference on the portfolio/snapshot per-property path (F2). | Ring-2 (parity matrix). The parity resolver reads list+tile from a SHARED source (`c.master.properties[0]`) — the known false-green — so it never exercised the real independent portfolio/snapshot serialization path vs the property-detail path. | (planned) Repoint the parity resolvers to the REAL independent routes (`/api/portfolio/snapshot` tile vs `/api/properties/[id]` detail) + add a golden HOME-like property (loan w/o minRepayment + a one-off + >12-month txns) that reproduces the divergence. Re-diagnose MON-035 from Stage 1 on that fixture. |
| 2026-07-14 | VR-004 Stage-4 FAIL (MON-037) | Expenses card lists raw one-off rows (labelled MONTHLY) while the card TOTAL excludes them → "$0 total over non-zero rows". | Ring-2. The MON-037 source-lock proved the ENGINE excludes one-offs, but no Ring-2 test exercised the PropertyExpensesCard row↔total reconciliation on a household WITH one-offs. | ✅ DONE (PR #1400): render `cf.expenseLines` (recurring only) + one-off footnote; added the card-reconciliation invariant (`tests/dashboard/propertyExpensesCard.test.ts`). |
| 2026-07-14 | MON-035/036 Stage-1 RE-DIAGNOSIS (the planned repro from the row above) | The "runtime input difference on HOME" hypothesis was itself unproven — the row above assumed the producers diverge and planned a fix around that. | Stage 1 (root-cause). Diagnosing from a SUSPICION (not a reproduction) is the exact §24 anti-pattern; the honest step was to REPRODUCE before designing a fix. | ✅ DONE: built `tests/golden/ring2.homePropertyParity.test.ts` — runs the THREE real producers (portfolio/snapshot tile, `/api/properties/[id]` detail route+engine, master service) on a HOME shape with the exact VR-004 vectors (stray rental income, a $503/mo one-off, a minRepayment-less interest-floor loan) on BOTH declared + actuals bases. It **refuted** the divergence hypothesis: given identical rows the three producers are byte-parity (cashflow AND yield) and all exclude the one-off. Conclusion: VR-004's FAIL was **deploy-skew** (MON-035 window + MON-037 one-off exclusion landed across separate merges mid-review → tile vs detail served by different deploy generations). LESSON codified: a Stage-4 FAIL's "planned fix" is a HYPOTHESIS — Stage 1 must REPRODUCE it (green or red) before any fix code; a green reproduction that refutes the hypothesis is a valid, decisive outcome (deploy/data, not logic), confirmed by a Ring-3 re-check — never a guess-fix. The parity matrix's shared-source resolver is superseded by this independent-route reproduction (permanent HOME-shape parity coverage). |
| 2026-07-14 | **MON-035/036 VR-005 Stage-4 FAIL — the "deploy-skew" conclusion (row above) was FALSE** | On the fully-merged deploy the Home tile STILL diverged from detail/list/Risk-Radar (−$2,628 vs −$8,668/yr; 0.9% vs 0.12%). The prior reproduction gave a **false PASS** and I told Reza it was resolved. | **Ring-2 reproduction fidelity.** The golden DB mock ignores `where` clauses, so both surfaces got identical rows — structurally incapable of catching the **fetch/assembly (WHERE) difference** where the real bug lived. A green repro on a WHERE-blind mock is NOT proof of parity. | ✅ FIXED (this PR): real cause = a **§12.2.1 duplicate producer** — the portfolio/snapshot route had its own inline `unifiedTransaction.findMany` + `propertyTx` filter that diverged from `enrichPropertiesWithActuals` (used by the other 3 surfaces) and fell back to declared rent on live HOME data. Removed it; the route now delegates to the enricher (ONE producer). PROCESS CHANGES: (1) the Ratchet for a duplicate-producer class is a **Ring-1 SOURCE-LOCK** (no inline `unifiedTransaction.findMany` in the route), NOT a value-parity test on a WHERE-blind mock; (2) fixed the golden mock to populate `property.findMany` includes (the false-pass cause). LESSON: **a value-parity test cannot verify a fetch-layer bug — pair every cross-surface parity claim with a Ring-1 source-lock proving the surfaces share ONE producer.** VERIFIED only after a fresh Chrome re-check (VR-006). |
| 2026-07-15 | **MON-053 VR-008 coverage sweep — the one-off class was 4× broader than the diagnosed rows** | The fix (#1421) repaired the mechanism + the two known ATO rows, but SIX more rows of the same class (Service NSW ×2, Hipcamp ×2, Isaac Asadi, Betterhelp) sat in the same income list, found only by the Matrix's Ring-3 sweep. | **Stage 1 (census scope).** The Input-Feed Census enumerated the SYMPTOM rows (the two ATO deposits), not the full POPULATION sharing the defect fingerprint (recurring row ∧ exactly 1 linked txn ∧ $0 in-window actuals). A mechanism fix verified on 2 of 8 affected rows is complete code but incomplete data remediation. | ✅ Same-PR: (1) census rule tightened — for any data-classification defect, Stage 1 MUST enumerate the full affected POPULATION by the defect's fingerprint query, not just the reported instances; (2) MON-075 raised (DIAGNOSED) — the fingerprint becomes a STANDING NeoAudit detector (promotion; gates MON-053 → CLOSED); (3) Reza decision recorded: SOURCE-AWARE default (manual=recurring, single-txn import=one-off; blanket backfill REJECTED as unsafe — remediation of existing rows is user-reviewed via the detector, never a blind UPDATE). |
| 2026-07-14 | **MON-048 — a one-off expense badged "Monthly" escaped VR-005 entirely** | The Cashflow-rhythm cadence badge lied (one-off → "Monthly") and no Chrome run flagged it: the brief checked the Expenses-card reconciliation and the cashflow NUMBERS, but never told the auditor to read the cadence/basis LABELS. | **Ring-3 brief coverage (a whole CLASS was un-briefed).** Two gaps: (a) I improvised a shorter per-session brief instead of running canonical §3.3; (b) even §3.3 had no "read the LABEL, not just the number" direction — a correct $ amount with a wrong badge was outside every check. | ✅ FIXED: the specific badge is now a Ring-0/presentation Ratchet (`activityFrequencyLabel`, PR #1406). NEW PROCESS STEP (this PR): added **growth-loop step 5** — when a finding reveals a new CLASS of human scrutiny, broaden the canonical brief in the SAME PR (NEOAUDIT.md §10 step 5, §9(h); FIX_PROTOCOL Stage 5.4). Applied it: §3.3 Part D now carries a standing "LABELS, not just numbers" direction + an explicit cadence-badge check. LESSON: **the Ratchet automates the instance; step 5 teaches the class — both, same PR. Never improvise a one-session brief; edit canonical §3.3.** |

---

## §8 Fix-PR body template (paste + fill; the pr-prep-checklist skill enforces presence)

```markdown
## Issue
MON-NNN — <title>. Pipeline stage: BUILD (Stage 3).

## What was wrong / What changed / What you'll see   (§19.5 plain trio)
...

## §19.2 evidence
Input contract+units: ... · Rule/authority: ... · Worked example: ... · Verified: ...

## Census (§3 — holistic proof)
Producer census: <table>  → ONE canonical producer remains: <file:line>
Input-feed census: <table> → ONE feed, window/filters explicit
Consumer census (§19.4): <list — each is a Stage-4 target or regression guard>

## Ratchet test (§23.2.2)
<test file> at Ring <0|1|2> — verifies X; does NOT verify Y (Y = Stage-4 Chrome).

## Neomatrix (§21.2.1)
<nodes/edges added/repointed/deleted>; neomatrix:check green.

## Chrome verification spec (Stage 4 — pre-written)
Target capture: ... · Regression guard: ... · Expected values: ...

## Gate (§20.6): Document X/10 · Requirements X/10 · Logic X/10
<one line: what the 3× review changed + the honest coverage boundary>

## Doc-sync (CLAUDE.md §16)
<block>
```
