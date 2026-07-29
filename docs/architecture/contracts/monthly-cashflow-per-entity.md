# perEntityMonthlyCashflow — cashflow partitioned by owning LegalEntity

> Quantity Contract — MON-131 Phase A. READ-ONLY census at HEAD `fa392b9a`, 2026-07-29.
> A DIFFERENT-QUANTITY sibling of `monthly-cashflow-declared.md` (same formula family, partitioned
> by `ownerEntityId`). Kept as its own contract because its producers and surfaces are disjoint
> and a household-level migration could silently break the partition property.

## classification

**DERIVED.** Same FACT inputs as the declared household quantity, sliced by `ownerEntityId`.

## semantic

- **Basis:** declared records, partitioned by owning entity; unattributed rows bucket to an
  `UNATTRIBUTED_ENTITY_ID` slice (entityBreakdown). Per-entity ACTUALS cashflow does NOT exist
  today (no producer found that partitions `UnifiedTransaction` by entity) — a documented
  capability gap, not an empty result.
- **Window:** run-rate (no calendar bucket), monthly units, AUD, Float.
- **Loan treatment (D8):** full repayment within the entity's slice.
- **Partition invariant (the reason this is named):** Σ over entity slices of any component ==
  the household figure computed from the same rows on the same basis.

## canonicalHome

**NOT ESTABLISHED.** Two candidate mechanisms exist and were not unified:

1. `lib/calculations/cashflowOrchestrator.ts:302` `calculateCashflow(input, ownerEntityId)` —
   the Phase 41e filter param (":308-316", filters income/expenses/loans then runs the household
   math). Decimal twin has the same param (:533,:537-545). This is the orchestrator-native path.
2. `lib/calculations/entityBreakdown.ts:104` (`bucket`) — buckets every row by owner and runs
   canonical engines per slice (verified for net worth via `calculateNetWorth` per bucket at
   ~:139; its cashflow-side composition NOT fully traced — boundary).
3. `components/dashboard/EntityCashflowSummary.tsx:588` `calculateEntityCashflow` (:664-786) —
   a CLIENT-side composition summing per-property nets, per-investment nets, loan impacts
   (`netCashflowImpact`), asset running costs, standalone income/expense nets. Its total is a
   COMPOSITIONAL cashflow (property-engine nets + standalone rows), not the declared formula —
   whether it equals the orchestrator's entity filter on the same data is UNVERIFIED.

Decimal twin: exists only for mechanism 1.

## callSites

| file:line | tag | arithmetic in words |
|---|---|---|
| `lib/calculations/cashflowOrchestrator.ts:308-316` | canonical candidate | entity filter → household formula on the slice |
| `lib/calculations/entityBreakdown.ts:104` | canonical candidate (server) | per-owner bucketing, canonical engines per slice |
| `components/dashboard/EntityCashflowSummary.tsx:588,664-786` | DUPLICATE or DIFFERENT-QUANTITY — UNRESOLVED | client-side compositional sum: properties net + investments net − loan impacts − asset costs + income − expenses. Escalate per brief §3.1 rule 4 if Phase B wants to delete it |

## invariants

1. Partition: `Σ_entities cashflow(slice) === cashflow(all rows)` on the same basis —
   *(§7 correction)* NOT by construction for mechanism 1: `calculateCashflow(input, entityId)`
   filters `row.ownerEntityId === entityId` (`cashflowOrchestrator.ts:308-316`), so a row with a
   NULL/unmapped `ownerEntityId` falls into NO slice and Σ slices < household. The invariant holds
   for mechanism 1 only if the caller adds an explicit unattributed slice (mechanism 2,
   `entityBreakdown`, does bucket unattributed; the orchestrator filter does not).
2. Every row lands in exactly one slice (unattributed included) — no row double-counted.
3. Mechanism-parity (the missing test): 1 and 3 must agree per entity or one must be renamed.

## independentExpectation

Arithmetic identity: hand-partition the declared FACT rows by `ownerEntityId` and apply the
declared formula per slice; totals must re-sum to the household figure.

## surfaces

| route | label |
|---|---|
| `/dashboard` (Home) | Entity Cashflow widget (`EntityCashflowSummary`, incl. its hardcoded `0.37` marginal-rate default at :642 — MON-133/D12 overlap; the design record's `:693` anchor has DRIFTED, now the interest-portion estimate). *(§7 addition: that `:693` estimate is `principal × (interestRate/100)/12` fed a DECIMAL rate by `portfolio/snapshot:852` → interest + taxBenefit 100× too low at HEAD — hard evidence the client composition diverges from every server mechanism; catalogued in `loan-monthly-interest.md` §7)* |
| entity/tax surfaces consuming `calculateCashflow(input, ownerEntityId)` | per-entity positions (not exhaustively enumerated — boundary) |

## expectedMoves

- D8 relabel: NO numeric movement.
- If `EntityCashflowSummary` is migrated onto a server-side per-entity producer: the widget's
  numbers move wherever compositional ≠ filtered-declared (e.g. property engine actuals-first
  rent vs declared rent). Arithmetic must be pre-derived per entity before Phase B — NOT
  derivable from this read-only pass.

## decisionsRequired

1. **DR-10** — pick the canonical per-entity mechanism (orchestrator filter vs entityBreakdown vs
   client composition) and name the loser(s) or delete them. The client composition mixes
   actuals-first property nets with declared rows — a hybrid nobody named.
2. **DR-11** — is a per-entity ACTUALS cashflow wanted (transactions carry no entity partition
   today)? If yes it is new scope, not a migration.

## coverageBoundary

Examined: orchestrator filter param, entityBreakdown bucketing (net-worth side), EntityCashflowSummary
composition entry + component reduces (:664-786 skimmed, not line-audited). NOT EXAMINED: all
consumers of `calculateCashflow(…, ownerEntityId)` beyond grep-level, entity tax surfaces,
`EntityCashflowSummary` sub-calculations per asset class. Unexamined ≠ cleared.
