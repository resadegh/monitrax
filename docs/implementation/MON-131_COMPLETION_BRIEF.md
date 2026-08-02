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
| **T2** | **loan cost** | **IN BUILD** | **D49** — every migration target is Layer-1 anchored |
| T3 | expense run-rate | ready to plan | G1 cleared 08-03; needs its censuses |
| T4 | tax constants + depreciation | blocked on FACTS | QS depreciation schedules (Reza) |
| T5 | balance sheet | blocked on FACTS | property rental-vs-residence classification (Reza) |
| T6 | rates, scores, runway | blocked on FACTS | per-property availability days (Reza) |
| T7 | budget remainder | blocked on FACTS | total super balance · Div 293 exposure (Reza) |
| Closing | the sweep | — | everything above |

**T2's gates:** G2 ✅ · **G3 ✅** (`.audit/expected-moves-t2.json`, 13 measured paths, merged in #1565)
· MON-143 ✅ fixed · G5 ❌ (cross-collateralised / fixed / mixed-purpose loans — facts) · G7–G11 pending
the migration.

**The headline number:** `loanCost` sits at **31 producers**. T2 takes it to one. That single figure is
the fairest test of this programme so far, and it has not moved yet.

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
9. **Ring-3 on live data** — the Matrix. Then the registry moves, and the ledger records the SHA.

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
- **Blocked on:** **D49** (§5). Not on anything technical.
- **Ring-3 after merge:** Home budget tile must read **$12,779**, matching `/dashboard/expenses`
  — the user-visible proof, and the same figure on both screens.

### §3.2 T3 — expense run-rate (MON-129) · ready to plan

- **Survivor:** `lib/utils/frequencies.ts` `monthlyRunRate`/`annualRunRate`, declared recurring rows
  only, one-offs gated. Census: **79 producers**.
- **G1 cleared** 2026-08-03 (MON-135 merged in #1538 — the categoriser no longer stamps
  `isRecurring: false` unconditionally, so the one-off gate cannot zero every AI-categorised expense).
- **The trap the ledger names:** T3 legitimately *lowers* expenses. A directional entry like
  "expenses fall" would absorb a real MON-135 regression as expected. **Per-path arithmetic only.**
- **Next action (Code):** the three censuses, then the T3 compare relay reusing the sweep.

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

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| **D49** | `check-binding-coverage` resolves Layer-1 anchors against the **frozen Layer 0**, so re-pinning an anchor to its true current line fails the gate. Resolve against **source** instead? | **Yes.** The anchored-drift property is held by a *different* gate (`check-layer0-coverage`), so narrowing this one loses nothing. Otherwise all 7 T2 targets need hand-patched two-artifact edits. Fresh evidence: a one-file docs test hit this wall in #1566 — and the allowlist escape it used is **not** available to financial engines | **T2 migration** |
| **MON-141** | `/dashboard/income` shows $22,579/mo, Home shows $25,347. Both internally correct; the whole gap is rental basis (DECLARED vs ACTUALS), unnamed on both | **Label both surfaces first** (no number moves). Converging them moves a number → tranche work | nothing yet |
| **MON-142** | Stored 6.690% on both Bankwest IO loans; repayments imply ~6.268% | Two parts: **(a)** you correct the stored rates against the bank — only you can; **(b)** wire the effective-rate engine to *flag* staleness — changes numbers, so tranche work after T2 | nothing yet |
| **T4 facts** | Do QS depreciation schedules exist? | If yes, ingest as facts (D44), don't compute | T4 |
| **T5 facts** | Per property: rented out vs tenanted residence; any co-owned rental **business** | — | T5 |
| **T6 facts** | Availability + available-days per property | — | T6 |
| **T7 facts** | Total super balance · Div 293 exposure | — | T7 |

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
