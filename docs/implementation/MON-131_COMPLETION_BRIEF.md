# MON-131 — the completion brief

**One document, two authors.** Code writes the plan and the build entries; the Matrix writes the
verification entries. Reza reads §2 for "where are we", §5 for "what needs me", §6 for "what happened".

**Opened:** 2026-08-03 · **Owner:** Code (Opus 5) · **Verification:** The Matrix (Claude-in-Chrome)
**Status:** LIVE — updated in the same PR as every change it describes (CLAUDE.md §15, §16).

---

## §0 What this document is — and the four things it must never become

Reza asked for one document that both agents keep current. The risk in that request is the exact defect
this programme exists to remove: **a second source of truth**. On 2026-08-03 this codebase had two
registers holding producer counts that disagreed by up to 5× (`REFERENCE_NUMBERS.md`'s hand-recorded
`Census` column vs `producer-census.json`) — not because either was careless, but because *two
instruments measuring one thing always drift*. A second MON-131 status document would repeat that at
the documentation layer, and the tranche ledger already says so in its own §6.

So this brief owns exactly one thing that nothing else owns: **the forward plan, and the shared log of
who did what**. Every other fact stays where it already lives:

| Fact | Its ONE home | This brief |
|---|---|---|
| Gate state per tranche (G1–G11) | `MON-131_TRANCHE_LEDGER.md` §3 | **links, never restates** |
| The change record — every merged PR + SHA | `MON-131_TRANCHE_LEDGER.md` §6 | links |
| Issue status / lifecycle | `docs/issues/ISSUES.json` | links |
| Producer counts | `.audit/producer-census.json` → `REFERENCE_NUMBERS_SCOREBOARD.md` | links |
| What a quantity IS + its surviving producer | `docs/architecture/REFERENCE_NUMBERS.md` + `contracts/` | links |
| Engine / lineage / `file:line` | the Neomatrix | links |
| A verification run's findings | `docs/verification/runs/VR-NNN.md` | **indexes** in §6, never copies |
| Declared moves for a tranche | `.audit/expected-moves-tN.json` | links |
| **The forward plan per tranche** | **HERE (§3)** | owns |
| **The shared status log** | **HERE (§6)** | owns |

**If this brief and the ledger ever disagree, the ledger wins** — it is the state of record. This brief
is the plan and the diary.

Four things it must never become: a second gate table · a copy of a VR run's numbers · a place where a
count is typed by hand · a status page that outlives the artefact it describes.

---

## §1 The finish line — what "MON-131 complete" means

MON-131 is not "the tranches merged". It closes on evidence, and the ledger's closing stages name it:

1. Every quantity in scope has **exactly one producer** — verified by the census ratchet, not asserted.
2. Every surface showing that quantity reads it **from that producer** — no re-derivation (source-lock
   + the surface linter), and same-`semanticKey` surfaces converge in the Neomatrix (A3).
3. Each tranche's declared `expectedMoves` **landed exactly**, and nothing outside them moved (G7).
4. A **Ring-3 run on Reza's live data** confirms the rendered numbers — CI green is never verification
   (§23.2.3).
5. The **complete Matrix sweep** — Reza's explicit requirement, and the only thing that closes the
   programme.

Anything short of 5 is progress, not completion. This brief tracks the distance.

---

## §2 Where we are — the one-screen answer

**Live state (gate detail: ledger §3):**

| Tranche | Quantity | State | The one thing standing in the way |
|---|---|---|---|
| T1 | income | **DONE** | — (VR-045 PASS; four issues VERIFIED) |
| **T2** | **loan cost** | **G8/G10/G11 ✅** — Ring 3 passed (VR-047 + VR-047B) | **G7 is unclosable** — the pre-T2 reference tree was never committed (MON-157). Nothing left to *do*; it stays HALF |
| T3 | expense run-rate | ready to plan | G1 cleared 08-03; needs its censuses |
| T4 | tax constants + depreciation | blocked on FACTS | QS depreciation schedules (Reza) |
| T5 | balance sheet | blocked on FACTS | property rental-vs-residence classification (Reza) |
| T6 | rates, scores, runway | blocked on FACTS | per-property availability days (Reza) |
| T7 | budget remainder | blocked on FACTS | total super balance · Div 293 exposure (Reza) |
| Closing | the sweep | — | everything above |

**T2's gates:** G2 ✅ · G3 ✅ (`.audit/expected-moves-t2.json`, amended to 15 paths as the migration PR's opening commit) · G5 ✅ · G6 ✅ (#1575 merged `1e2317b`, prod READY) · **G8 ✅** (VR-047 rendered half + VR-047B producer half — the four-expression identity holds) · G9 ✅ · G10 ✅ · **G11 ✅** (MON-143 and a narrowed MON-130 both VERIFIED on their own numbers; the residue is MON-156) · **G7 🟡 permanently**.

That last one is not a queued task. The whole-tree `MOVED-UNDECLARED` diff needs the pre-T2 **tree**, and only its **hash** was ever kept — no golden-baseline tree has ever been committed to this repository, on any branch. The pre-T2 tree cannot be re-captured. **MON-157** records it; `MATRIX_G7_REFERENCE_CAPTURE.md` fixes it forward so T3's G7 runs as designed.

**The headline number:** `loanCost` sat at **31 producers** and is now at **30** — the programme's first
real producer deletion (the earlier fall was a measurement correction, and the census history now says
which is which). T2's contract measures the `masterFinancialService` leaves only, so its migration moved
that one producer. The remaining sites — **11 producers across ~30 raw reads** — are now **MON-156**,
opened 2026-08-04 when D50 narrowed MON-130 rather than letting a verified issue close over them. They
feed the CFO score, the risk radar, the debt planner, reports, the CFE input and the money-flow chart;
Lever 2 hides most of those surfaces, which takes them out of v1 scope without making them correct.
**30 is not 1, and the distance is the point of tracking it.**

---

## §3 The remaining path

### §3.0 The method every tranche runs — proven by T1 and T2, not invented here

Each tranche is the same loop. Where T1 or T2 paid for a lesson, it is named.

1. **Censuses first, before any fix code** (FIX_PROTOCOL §3 — the three censuses):
   **producers** (who computes it), **input feeds** (what each producer is fed — *same engine ≠ same
   inputs*, the MON-028 lesson), **consumers** (every surface that renders it).
2. **Contracts + decisions** — the quantity contract states the semantic; every fork goes to Reza
   (§20.5). A guessed fork is a rewrite later.
3. **The compare relay** — an admin-only route that runs the OLD and NEW paths side by side on live
   data. It measures; it renders nothing. (`app/api/admin/matrix/golden-baseline/tN-*`.)
4. **`expectedMoves` by derivation sweep, never by list.** T2's list missed five paths across three
   rounds. The sweep re-runs the *real* engines with the canonical value substituted and diffs every
   numeric leaf — complete by construction. **Reuse it; do not hand-enumerate.**
5. **Declare before building.** `.audit/expected-moves-tN.json` is committed *before* the first line of
   migration, with each after-value **measured**, its arithmetic, `mustNotMove`, and the feed contract.
6. **Migrate** — delete duplicate producers, repoint every consumer at the canonical one. Never a
   compensating calculation, never a second producer that agrees (§23.2.1).
7. **Ratchet test** at the lowest ring that would have caught the bug class (§23.2.2), plus the
   cross-surface propagation test §19.4 requires.
8. **Neomatrix in the same PR** — nodes, edges, re-pinned anchors (§21.2.1).
9. **Hand over for verification — the handout is a build deliverable, not an afterthought** (§3.0b).
10. **Ring-3 on live data** — the Matrix runs the handout. Then the registry moves, the ledger records
    the SHA, and §6 gains a row.

### §3.0b The handout contract — every build section ends with one

**Standing process (Reza, 2026-08-03): no build section is "done" when the code merges. It is done when
the handout for verifying it exists.** Code does not declare a tranche verified, and does not move an
issue to VERIFIED, on its own build passing — that is §23.2.3, and it is why the loop ends here rather
than at a green CI.

Every build section therefore ships **two** things: the change, and the instrument for checking it.

| Rule | Detail |
|---|---|
| **Where it lives** | `docs/verification/briefs/<NAME>.md`, **committed** — never chat-only. §21.2.2 rule 4. On 2026-07-31 the third-capture instructions existed only in a chat message while the in-repo brief still described the *second* capture; a Matrix opening the file would have run stale instructions against the wrong build. The chat copy is a convenience; the repo copy is the instrument |
| **When** | In the same PR as the build it verifies, or immediately after — never later than the merge |
| **Build precondition** | Every handout names the **minimum commit** it must run against, and why. A capture taken on an older build measures an instrument that has since been replaced (this is what invalidated the second T2 capture) |
| **Identity assertion** | A hard precondition the Matrix checks *before* accepting any payload — e.g. `loanCount === 5`, net worth $3,401,782. Admin credentials open the door; they are not the account under test |
| **Falsifiable predictions** | State expected values **in advance**, as predictions that can fail — with "do not adjust anything to fit these". A handout that asks the Matrix to *confirm* numbers invites confirmation bias |
| **What to return** | The exact artefact — a verbatim payload, or per-surface rendered figures. Never a summary, never rounded |
| **Regression guard** | The `mustNotMove` set, named up front. A fix that removes X but breaks Y is not a fix |
| **Coverage boundary** | What the run does **not** verify, stated on the handout, so a PASS is never read wider than it is |

**Two handout kinds, and they are not interchangeable:**
- **Capture** — one authenticated GET against a compare relay. Produces *measurements* (the inputs to
  `expectedMoves`). Asks for no verdict; the payload is the deliverable. Type specimen:
  `MATRIX_T2_RELAY_CAPTURE.md`.
- **Ring-3 verification** — reads the *rendered surfaces* on Reza's live account after a merge, checks
  every declared path landed, nothing outside them moved, and the regression cluster is untouched.
  Produces a **PASS/FAIL verdict** recorded as `docs/verification/runs/VR-NNN.md`. Type specimen:
  `RING3_VR045_T1_REPAIR.md`.

### §3.0c The return format — results come back machine-consumable

**Standing process (Reza, 2026-08-03): every handout tells the Matrix to return its result in a form
Code can consume directly.** Prose has to be *interpreted*, and interpretation is where a session
assumes. Three near-misses already came from exactly that: a capture accepted before anyone checked the
build it ran against (it predated the fix it was measuring), a PASS whose coverage boundary was never
stated, and a handout answered against the wrong account.

So every handout ends with this instruction, and the result is validated before it is acted on:

> **Return one fenced ```json block conforming to `matrix-result/v1`, then your human note.**
> The JSON is what Code consumes; the note is what Reza reads. Never only the note.

```json
{
  "schema": "matrix-result/v1",
  "handout": "docs/verification/briefs/<the brief you ran>.md",
  "kind": "capture | ring3",
  "runId": "VR-046 | null",
  "sha": "<full 40-char commit the run executed against>",
  "capturedAt": "<ISO timestamp>",
  "account": {
    "userId": "<the ?userId= scoped account>",
    "identityAssertion": {
      "expected": { "loanCount": 5, "netWorth": 3401782 },
      "observed": { "loanCount": 5, "netWorth": 3401782 },
      "pass": true
    }
  },
  "verdict": "PASS | PARTIAL | FAIL | CAPTURE_ONLY",
  "sectionsNotRun": [],
  "checks": [
    { "id": "home.budget.loans", "surface": "/dashboard (budget tile)",
      "expected": 12779, "observed": 12779, "pass": true }
  ],
  "findings": [
    { "severity": "critical | high | medium | low | observation",
      "summary": "…", "evidence": "…" }
  ],
  "payload": "<verbatim response for a capture; null for a ring3 run>",
  "coverage": { "verified": "…", "notVerified": "…" }
}
```

**Validate before consuming:** `npm run matrix:check -- <file.json>`. Exit 0 means the result is
well-formed and self-consistent — **not** that it passed; read `verdict`. A FAIL is a valid result. The
validator refuses only a result that cannot be trusted to say either, and each rule exists because
something already slipped past its absence:

| The rule | What it catches |
|---|---|
| `sha` must be a full 40-char commit | The withdrawn T2 capture — taken at `8bed66b6`, *before* the MON-143 fix it was meant to reflect |
| `identityAssertion` needs expected **and** observed, `pass: true` | A payload captured against the admin's own empty account. A bare `pass: true` asserts nothing |
| Every check carries `observed` | *"As expected"* is not an observation |
| `PASS` with any failed check → invalid | The most dangerous shape a result can take, because it reads green |
| `FAIL` needs a failed check or a finding | A verdict with nothing behind it |
| `coverage.notVerified` is **required** | §22.2.4 — a run that implies it verified everything. "Everything" is never the answer |
| `PASS` + a `critical` finding → invalid | A contradiction that must be resolved before anyone acts on it |
| `sectionsNotRun[]` is **required** on a ring3, and a non-empty one forbids `PASS` — use `PARTIAL` | **VR-047**: verdict PASS while its own findings said the DECIDING section had never run (§2 needs the admin relay, which the account-first law forbids opening in that profile). Every existing rule passed it — no check had failed, and the finding was `high`, not `critical`. A run that could not complete its handout still read green. Making "what did not run" a FIELD rather than prose in the coverage note is what turns it from something read into something checked |
| `kind: capture` must be `CAPTURE_ONLY` and carry a payload | A capture asks for no verdict; the measurements are the deliverable |

Both authors gain from it: Code ingests without guessing, and Reza gets a note that cannot quietly
disagree with the data beside it.

**The next handout due:** T2's Ring-3, when the migration merges. Its acceptance is already fixed by
`.audit/expected-moves-t2.json` — 13 paths land exactly, the `mustNotMove` cluster is byte-identical,
and Home's budget tile reads **$12,779**, matching `/dashboard/expenses`. Reza should not have to ask
for it.

**Two constraints T2 discovered that bind every later tranche:**

- **Feed unrounded values into the engines.** Rounded per-loan costs summed a cent low and cascaded
  through four downstream leaves. Round at the leaf, never at the input.
- **Annual leaves are `round(unrounded monthly × 12)`** (`cashflowOrchestrator.ts:259-266`) — not
  derived from annual components. The two methods agreed at T1 and disagreed by a cent at T2.

### §3.1 T2 — loan cost (MON-130) · IN BUILD

- **Quantity:** the monthly cost of a loan. **Survivor:** `lib/services/loanCosts.ts` →
  `resolveLoanMonthlyCost` / `resolveLoanCostsForUser` (actuals-first: linked repayments → declared →
  interest floor net of offset).
- **The defect in one line:** Home says loans cost **$8,817/month**, `/dashboard/expenses` says
  **$12,779** — same five loans, same day. The interest-only loans contribute **$0** to the master
  snapshot because its input filters out loans with no `minRepayment`.
- **Declared:** 13 paths, measured at `915704f0`. Δ **+$3,962.64/month · +$47,551.71/year**.
- **The migration:** `loanCost` 31 producer sites → one. Every consumer reads
  `resolveLoanCostsForUser`; the `minRepayment` filter is deleted, not bypassed.
- **Migration merged (PR #1575) for `masterFinancialService` — the one producer this contract measures.**
  The `.filter(l => l.minRepayment && l.repaymentFrequency)` is deleted, not widened; both loan legs are
  fed one unrounded canonical array.
- **Declaration amended to 15 paths before the first line of migration** — `debt.summary` was an unswept
  sibling of a swept block and moved by construction. The relay's sweep is widened so the class cannot recur.
- **Blocked on:** nothing. **Next:** the Ring-3 run, then **T2-B** (the remaining 30 producers, each
  needing its own capture + `expectedMoves`).
- **Ring-3 after merge:** Home budget tile must read **$12,779**, matching `/dashboard/expenses`
  — the user-visible proof, and the same figure on both screens.
- **Handout shipped (§3.0b):** `docs/verification/briefs/RING3_T2_LOAN_COST.md`. Capture handout:
  `docs/verification/briefs/MATRIX_T2_RELAY_CAPTURE.md`.

### §3.2 T3 — expense run-rate (MON-129) · ready to plan

- **Survivor:** `lib/utils/frequencies.ts` `monthlyRunRate`/`annualRunRate`, declared recurring rows
  only, one-offs gated. Census: **79 producers**.
- **G1 cleared** 2026-08-03 (MON-135 merged in #1538 — the categoriser no longer stamps
  `isRecurring: false` unconditionally, so the one-off gate cannot zero every AI-categorised expense).
- **The trap the ledger names:** T3 legitimately *lowers* expenses. A directional entry like
  "expenses fall" would absorb a real MON-135 regression as expected. **Per-path arithmetic only.**
- **Next action (Code):** the three censuses, then the T3 compare relay reusing the sweep.
- **Handouts due (§3.0b):** a capture handout for the relay, then a Ring-3 brief after the migration.

### §3.3 T4 — tax constants + depreciation · blocked on facts

- **Survivors:** `TAX_YEAR_CONFIGS` (never a hardcoded `30000`/`27500`), `lib/tax-engine/position/*`,
  and a single depreciation producer with **the rate unit in the type** (D11 — the `rate` vs `rate%`
  ambiguity is a live 100× class).
- **Architectural change this carries:** the config must hold per-period **rules**, not just values —
  seven regime switches in eight years are already identified, and Phase 41E's reform adds more.
- **Needs from Reza (§5):** do quantity-surveyor depreciation schedules exist? If so they are **facts to
  ingest**, not numbers to compute (D44).

### §3.4 T5 — balance sheet · blocked on facts

- **Survivors:** `netWorthCalculator.ts` for assets/liabilities and net worth; property equity per D26
  (**includes rentals** — excluding them at `properties/page.tsx:494` is a recorded bug).
- **Never floored:** negative equity carries through to the portfolio total.
- **Needs from Reza (§5):** which properties are rented out vs tenanted residence; any co-owned
  property held as a rental **business** (D42 C1 — it changes the treatment).

### §3.5 T6 — rates, scores, runway · blocked on facts

- **Survivors:** two distinct runway quantities (D30) with `INDEFINITE` as a **state**, gross flows
  (D31), a re-founded health score (D32), insurance-70 removed (D47).
- **The trap:** `INDEFINITE` is a state, not a sentinel. Any downstream score that averages runway
  months must handle the state — **that is how `999` got into the app**.
- **Needs from Reza (§5):** availability and available-days per property (D43).

### §3.6 T7 — budget remainder (MON-127) · blocked on facts

- **Survivor:** `remainder = monthlyNetIncome − committed`, three allocation modes; the ABS benchmark is
  a **reference**, never the budget (D25).
- **Compliance:** modes are scenarios with consequences, **never recommendations**. The ASIC assumption
  framework applies anywhere a projection touches super.
- **Needs from Reza (§5):** total super balance · Division 293 exposure — both gate the growth mode.

### §3.7 Closing

Number Ledger (MON-131 scope: 23 quantities × every surface × three axes) → MON-136 (every remaining
quantity, same machinery) → Number Ledger (MON-136 scope) → **the complete Matrix sweep**. Everything
else is explicitly HELD: the 36 issues the producer collapse will not touch.

---

## §4 What is NOT in scope

The 36 held issues, and any fix that would move a number outside a declared tranche. If a defect is
found mid-tranche it is registered (`issues:raise`) and either folded into the current tranche's
declaration or deferred — never fixed silently inside a migration PR, because an undeclared move stops
the tranche at G7 and cannot be told apart from a mistake.

---

## §5 Decisions waiting on Reza

Nothing below can be decided by Code. Each is either a guard change, a user-philosophy fork, or a fact
only Reza holds.

| # | Decision | Status | Effect |
|---|---|---|---|
| **D49** | Resolve `check-binding-coverage`'s symbol anchor against **source** rather than the frozen Layer 0 | ✅ **DECIDED 2026-08-03 — option A.** Implemented same day | **T2 migration unblocked.** It earned its keep immediately: resolving against source exposed **two anchors that were simply wrong** and had been passing for months — `input.InvestmentAccount.cashBalance` pointed at line 2271, which is `ELECTRIC` inside a *different* model, and `input.NetWorthSnapshot` pointed at a `createdAt` field 23 lines above the model it names. The old gate passed both because the frozen Layer 0 agreed with the stale line. Both re-pinned; 188/188, and the gate proven to still catch injected drift |
| **MON-141** | Income page $22,579/mo vs Home $25,347 — the gap is entirely rental basis (DECLARED vs ACTUALS), unnamed on both | ✅ **DECIDED 2026-08-03 — label both surfaces.** Queued | No number moves. Each screen names the basis it shows, so the two stop reading as a contradiction |
| **MON-142** | Stored 6.690% on both Bankwest IO loans; the repayments in the app imply ~6.268% | 🔬 **REFRAMED 2026-08-03 — the Matrix confirms it from the app's own data** (§5.1) | Code had told Reza to check with the bank. **That instruction was wrong**: the app already holds the repayment transactions the divergence is derived from |
| **T4–T7 facts** | QS depreciation schedules · rented-out vs tenanted-residence + any co-owned rental *business* · per-property availability days · total super balance + Div 293 | ✅ **AUDITED 2026-08-03 — §5.2. Five of six already have a home; one is a real gap** | Reza was right that these come from the app. Nothing here needs typing into chat |
| **D50** | MON-130's scope after Lever 2 — narrow it to the surface its evidence covers, or leave it open at twelve producers | ✅ **DECIDED 2026-08-04 — option A.** Implemented same day | MON-130 **narrowed + VERIFIED** (title and `rootCause` name the one producer #1575 migrated); the residual **11 producers / ~30 raw-read sites** carried to **MON-156** with the list intact. **T2 reaches G11 ✅.** The reasoning is recorded on both entries: hiding a surface is an exposure control, not a defect control |

### §5.1 Why "ask Reza for the number" is usually the wrong instruction

Reza, 2026-08-03: *"Why are the data and Monitrax stored numbers different? That's a red flag… you always
have to work based on the data provided in the app, and that is why we are doing MON-131 — to respect
SSOT and a single source for all numbers, one calc engine for each derived number, and the rest of the
app, tiles and reports only call or use these single numbers or engines."*

Applied to MON-142 that principle gives a sharper answer than the one Code first gave:

- The **stored rate is a FACT** — asserted by a user or a document. One home, never derived.
- The **implied rate is DERIVED** — one engine (`lib/calculations/effectiveLoanRate.ts`), from repayment
  transactions already in the app.
- When they diverge the app's job is to **surface the divergence**, not silently prefer one. Overwriting
  the fact with the derivation would destroy the evidence that they disagreed.
- **The divergence is a data-integrity finding the app should raise by itself** — and today it does not.
  That is exactly what MON-142 is.

### §5.2 The schema audit behind the four "facts" — read in source, 2026-08-03

Reza's instruction was to derive these from the app rather than ask him. Auditing `prisma/schema.prisma`
per fact says he was right in five cases out of six — and the sixth is a finding worth having.

| Fact | Home in the schema | Verdict |
|---|---|---|
| QS depreciation schedules | ✅ `DepreciationSchedule` — per property: `category` · `assetName` · `cost` · `startDate` · `rate` · `method` (PRIME_COST / DIMINISHING_VALUE) | The Matrix reads whether rows exist per property. **Note D11 lives here**: `rate Float` carries no unit in the type — 2.5 or 0.025 is the open 100× ambiguity T4 must close |
| Rented out vs tenanted residence | ✅ `Property.type` — `HOME` / `INVESTMENT` / `RENTAL` (RENTAL = *user is renting it*, not owning) | The Matrix reads it |
| Per-property availability days | ✅ `Property.genuinelyAvailableForRent` + `availableDaysPerYear` — added by T1 itself under X7/D43 | The Matrix reads whether they are **populated**; nullable, so absence is the likely answer |
| Total super balance | ✅ DERIVED — Σ `SuperannuationAccount.currentBalance` | Never a question. Derive it |
| Division 293 exposure | ✅ DERIVED — income + concessional contributions; `TaxPosition.division293Tax` already exists | Derive it |
| **Co-owned property held as a rental BUSINESS** | ❌ **NO HOME.** `OwnershipGroup` / `OwnershipStake` capture co-ownership *shares*, but nothing records the **tax characterisation** — business vs passive investment (D42 C1), which changes the treatment | **MON-144, raised 2026-08-03.** A FACT the app cannot hold. Asking Reza in chat would paper over it; the fix is a field, and until there is one, T5 cannot determine this from data for any property |

**This is the shape the instruction was meant to produce.** Five facts stop being questions and become
reads. The sixth stops being a question and becomes a defect — which is strictly more useful, because a
number typed into a chat window is not a source of truth for anything.

So the next step is not "Reza rings the bank". It is: the Matrix confirms from live data that the
divergence is real and consistent across both loans, then the engine gets wired to a surface so Monitrax
tells its own user the stored rate looks stale. **Handout due (§3.0b): MON-142 rate-divergence
verification.**

**Note the shape of this table:** T4–T7 are not blocked on engineering. They are blocked on facts.
Answering those four rows unblocks four tranches at once.

---

## §6 The shared status log

**Both agents append here. Newest last.** One line per event. **Results live in their own artefacts —
this is an index, not a copy** (§0). Never paste a VR run's numbers here; link the run.

- **Code** writes: build entries, PR numbers, what was declared, what merged.
- **The Matrix** writes: capture and Ring-3 entries — the verdict and the link, plus any finding it
  raised.

| Date | Actor | Event | Verdict | Evidence |
|---|---|---|---|---|
| 07-31 | Matrix | T2 relay capture #1 (`2627dcdf`) | returned; relay found incomplete | ledger §3 T2 |
| 07-31 | Code | Relay repaired; annual pair added (#1559) | merged `7be30bef` | ledger §6 |
| 07-31 | Matrix | T2 relay capture #2 (`7be30bef`) | found 2 more undeclared movers | ledger §3 T2 |
| 07-31 | Code | Hand-list deleted → **derivation sweep** (#1561) | merged `8bed66b6` | ledger §6 |
| 07-31 | Code | MON-143 — interest floor nets the offset (#1562) | merged `f7b685de` | ISSUES MON-143 |
| 07-31 | Matrix | T2 relay capture #3 (`915704f0`) — capture #2 withdrawn for failing the build precondition | **VALID** · `loanCount === 5` · 13 paths · all five previously-missed present | `.audit/captures/t2-loan-cost-915704f0.json` |
| 08-02 | Code | **G3 CLEARED** — T2 contract declared (#1565) | merged `e8cc3c12` | `.audit/expected-moves-t2.json` |
| 08-02 | Matrix | Found 3 record defects on main (Census column · T3-G1 · MON-134) | all 3 confirmed against main | #1566 |
| 08-03 | Code | Scoreboard + Census fold + T3-G1 + MON-134 → VERIFIED (#1566) | merged `b733c829` | ledger §6 |
| 08-03 | Code | **This brief opened** | — | — |
| 08-03 | Reza | **Lever 2 TAKEN** — strip the Money-Flow widget, keep Activity's intake. **T2-B parked**; the scaffold stays inert. **MON-150 RETRACTED** (identical duplexes → identical schedules are correct) | decisions | `docs/strategy/MON-131_SCOPE_FILTER.md` §4 · ledger §6 |
| 08-03 | Matrix | **VR-047** — T2 Ring-3, account-first half. Home's budget tile reads **$12,779**, matching `/dashboard/expenses`; regression cluster byte-identical incl. `healthScore` 53 | **PASS — SCOPED**; §2/§2b not run (admin relay) | `docs/verification/runs/VR-047.md` |
| 08-03 | Code | **VR-047 consumed** — 5 findings registered (MON-149…153); the handout's mis-specified §3 saving-rate row withdrawn; `matrix:check` tightened so a PASS cannot have skipped a section; **T2-B scaffold** (the `loanCostBasis` seam + compare relay, moving nothing) | — | `MATRIX_T2_ADMIN_RELAY.md` |
| 08-03 | Code | **T2 migration — `masterFinancialService` onto the canonical resolver** (#1575). Declaration amended to 15 paths as the opening commit; `loanCost` 31 → 30; Ring-2 ratchet + Neo-sync; `patch-layer0.mjs` committed (D49) and it found MON-148 | merged `1e2317b` | ledger §6 · `RING3_T2_LOAN_COST.md` |
| 08-03 | Matrix | **VR-047B** — T2 Ring-3, admin-relay half, at `c485b05`. Build precondition `paths: []`; all 15 declared paths landed with both exactness traps; **the four-expression identity HOLDS** (three leaves byte-equal at `12,779.292814353912`, the fourth that value rounded at the producer); `byType` keys unchanged, sum bit-identical. PART B parked by Lever 2 | **PARTIAL** — every executed check passed; `sectionsNotRun: ["PART B"]` | `docs/verification/runs/VR-047B.md` |
| 08-03 | Code | **VR-047B consumed — G8 CLOSED.** T2's Ring-3 passes on VR-047 + VR-047B together; **MON-143 → VERIFIED**. Relay's rounded-vs-unrounded comparison fixed (verified in source first — the reported mechanism was close but not exact); **MON-154** + **MON-155** raised; all three handouts now state the page-context fetch form after an earlier VR-047B nearly shipped an auth change for a non-defect. **MON-130 stays `FIXING`** — kept half verified, 30 sites remain | — | ledger §3 T2 · `VR-047B.md` |
| 08-03 | Reza | **PR #1580 merged** (`e3a3715`); prod deploy READY | — | ledger §6 |
| 08-04 | Reza | **D50 answered — option A.** Narrow MON-130 to the surface its evidence covers; carry the residue as a new issue | decisions | ledger §3 T2 G11 |
| 08-04 | Code | **D50-A implemented + the G7 handout, which turned out to be a different handout.** MON-130 narrowed → **VERIFIED**, residue → **MON-156** (11 producers / ~30 sites), **G11 ✅**. Writing the G7 call Reza asked for exposed that it cannot be run: `diffBaselines` needs the pre-T2 **tree** and only its **hash** was ever kept — **no golden-baseline tree has ever been committed, on any branch** (**MON-157**). T2's G7 is HALF permanently. Shipped `MATRIX_G7_REFERENCE_CAPTURE.md` instead, which commits the reference forward so **T3's G7 runs as designed** | — | `MATRIX_G7_REFERENCE_CAPTURE.md` |

---

## §7 Keeping it current — the mechanism, not the intention

1. **Every PR that changes a tranche's plan or status updates this brief in the same PR** (§15/§16).
   A brief that lags the code is worse than none — it reads as a plan someone is following.
2. **§6 is append-only.** Corrections are new rows that say what they correct, never edits to history.
3. **Never type a number here that lives elsewhere.** Counts come from the scoreboard, gate state from
   the ledger, verdicts from the VR runs. If you find yourself typing a figure, link it instead.
4. **When a tranche completes**, its §3 section shrinks to one line + a link to the ledger. This brief
   is about what is *left*.
5. **When MON-131 closes**, this document is retired — not archived-and-forgotten. Its §3 method
   section graduates into `FIX_PROTOCOL.md` if it has earned it, and the rest is deleted. A completion
   brief that outlives its programme is exactly the stale artefact §0 warns about.
