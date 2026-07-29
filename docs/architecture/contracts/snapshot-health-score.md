# snapshot-health-score

**Proposed name:** `snapshot-health-score` (D13 quantity 2 of 4 — the question it answers:
**"On the master snapshot's own four quick ratios (savings rate, emergency months, debt-to-income,
net-worth level), how do I grade right now?"** — a lightweight A–F report card computed inside the
master snapshot, NOT the seven-domain health engine.)

Phase A Quantity Contract (MON-131, brief §3). READ-ONLY analysis at HEAD `2f9f2e16`.

## classification

**DERIVED** (D1). 0–100 integer + A–F grade + 4-component breakdown, computed per snapshot build,
never stored.

## semantic

- **Question:** a four-ratio composite grade over the snapshot's already-computed aggregates.
- **Formula shape** (`masterFinancialService.ts:1404–1456`):
  - savingsRateScore = clamp(savingsRate × 5, 0, 100), savingsRate = (netIncome − recurringExpenses −
    loanRepayments)/netIncome × 100 — weight 0.30
  - emergencyFundScore = min(monthsCovered/6 × 100, 100) — weight 0.30
  - debtToIncomeScore = max(100 − totalDebt/(netIncome×12)×100, 0) — weight 0.25
  - netWorthScore = netWorth > 0 ? min(50 + netWorth/10000, 100) : 25 — weight 0.15
  - `score = round(Σ component × weight)`; grade A ≥80, B ≥65, C ≥50, D ≥35, else F.
- **Inputs** (call site `:2044–2051`): `monthlyIncome.all.netTotal`, `monthlyExpenses.recurring.total`
  (MON-011 one-off gated), `debtSummary.totalRepayments`, `debtSummary.totalPrincipal`,
  `emergencyFund.monthsCovered`, `netWorth.netWorth` — all canonical snapshot aggregates.
- **Basis:** declared/recurring (its savings-rate input is NOT the actuals-first canonical savings
  rate the insights tile uses — a semantic difference, not a bug per D13).
- **Units:** dimensionless 0–100 + letter grade.

## canonicalHome

`lib/services/masterFinancialService.ts:1404` `buildHealthScore` → `snapshot.healthScore`
(convenience re-export `getHealthScore` at `:2177–2180`).
**Decimal twin: NOT ESTABLISHED.**
Under D13 this quantity **keeps its own home** — it is never reconciled into
`overall-financial-health-score`.

## callSites

| Site | Tag |
|---|---|
| `components/portal/clients/ClientCanonicalDashboard.tsx:66–75` | CONSUMER (org-portal "Financial health / Grade X" card + 4 component rows) |
| `lib/portal/alerts/sweepRunner.ts:88` | CONSUMER (portal alert threshold on `snapshot.healthScore.score`) |
| `lib/cfo/aiAdvisor.ts:336, :352, :488–489` + `app/api/cfo/advice/chat/route.ts:115` | CONSUMER (AI-advisor grounding context) |
| `app/api/dashboard/insights/route.ts:359` | CONSUMER (reads `components.debtToIncome.value` only, as a DTI input) |
| `lib/verification/selfAuditInvariants.ts:126, :147, :154–155` | CONSUMER (range invariant check) |
| `app/api/dashboard/insights/route.ts:362–364, :510` | **DUPLICATE** — re-types this quantity's savingsRate/emergencyFund/debtToIncome component formulas inline (weights 30/30/25/15 restated) while attaching them to the OTHER engine's score. Phase B: delete or re-source; cite this entry. |
| `lib/services/index.ts:32` `getHealthScore` | CONSUMER (barrel export — **no caller found at HEAD**; dead-export candidate) |

## invariants

- `score ∈ [0,100]`: each component provably ∈ [0,100] (savingsRate clamped; EF capped 100;
  DTI floored 0; netWorthScore ∈ {25} ∪ [50,100]) and weights sum to 1.0.
- Grade bands total-order: A/B/C/D/F thresholds 80/65/50/35 (checkable).
- `components.*.weight` values (30/30/25/15) must equal the multipliers used at `:1431–1435`
  (self-consistency — currently true).

## independentExpectation

**NONE FOUND.** Component thresholds (×5 savings multiplier, 6-month EF norm, netWorth/10000 curve)
are internal policy with no legislative or external-formula source. Externally **UNVERIFIABLE**;
Number-Ledger verification is limited to hand-reproducing the weighted sum on a fixture.

## surfaces

| Route | Label |
|---|---|
| `/portal/clients/[id]` (org portal, adviser-facing) | "Financial health" card, big score + "Grade B" badge + Savings rate / Emergency fund / Debt to income / Net-worth growth rows |
| CFO chat (`/dashboard/cfo` advice) | not rendered as a number, but grounds AI advice text |
| Portal alert emails/sweeps | threshold trigger |

**Cross-surface note (D13's "why Home reads 54"):** the portal shows THIS score while Home shows
`overall-financial-health-score` — two different questions, correctly different numbers, currently
identically labelled "Financial health". Naming, not reconciliation, is the fix.

## expectedMoves

**The D3/D4 runway migration predicts NO movement — with the arithmetic:** the only runway-coupled
input is `emergencyFund.monthsCovered` at `:2049`; its component is `min(months/6×100,100)`, already
saturated at 100 for 11.6 months. 72.6 months ⇒ still 100. Score unchanged.
Caveat that makes the no-move falsifiable: IF the migration changes `buildEmergencyFundMetrics`'
zero-burn semantics (0 → ∞/INSUFFICIENT), the component input type changes — flagged in
`survival-runway-months.md` decisions; any such change must restate this prediction.

## decisionsRequired

1. **Does this quantity survive at all?** D13 says name it, never reconcile it — but is a 4-ratio
   grade a question Monitrax wants to keep answering on the adviser portal alongside the 7-domain
   score? Keep-and-name vs retire-and-repoint is a product decision (consequence: portal grade and
   alert thresholds change if retired).
2. **Label divergence:** portal says "Financial health" for THIS, Home says it for the OTHER —
   distinct display names needed (e.g. "Snapshot report card").
3. `getHealthScore` barrel export has no caller — delete in Phase B?
4. Its savings-rate input is declared-basis while the app's canonical savings rate is actuals-first
   (MON-029) — keep the declared basis as part of this quantity's named semantic, or migrate?

## coverageBoundary

Read at HEAD: `masterFinancialService.ts:1380–1456, 1970–2085, 2170–2185`, all listed consumer
anchors. NOT read: portal sweepRunner full logic, aiAdvisor prompt assembly beyond the cited lines.
Verifies producer, formula, consumers; does NOT verify the upstream snapshot aggregates it consumes
(income/debt/net-worth correctness is other contracts' scope).

*Drifted anchor:* D13's `masterFinancialService:1434` → function starts `:1404` at HEAD
(weighted sum `:1431–1436`).

## Adversarial review (§7) — 2026-07-29
- Claims checked: 22 (anchors 13 · arithmetic 6 · negative-claims 3)
- REFUTED / CORRECTED: **none.**
- Verified intact at HEAD (696ec349; commits since pinned 2f9f2e16 are docs-only): `buildHealthScore` :1404, all four component formulas EXACT against source :1412–1428 (savingsRate = (net − recurring − loanRepayments)/net×100 then clamp(×5, 0, 100) · EF = min(months/6×100, 100) · DTI score = max(100 − totalDebt/(income×12)×100, 0) · netWorthScore = nw>0 ? min(50+nw/10000, 100) : 25); weighted sum :1431–1436 with 0.30/0.30/0.25/0.15 EXACT; grade bands 80/65/50/35 :1440–1444 EXACT; component weight fields 30/30/25/15 :1450–1453 self-consistent with the multipliers (invariant 3 confirmed true today); input call site :2044–2051 EXACT (all six args are canonical snapshot aggregates, incl. `monthlyExpenses.recurring.total` MON-011 and `emergencyFund.monthsCovered`); `getHealthScore` re-export :2177–2180 EXACT. Consumers: portal card :66–75 ✓ (score + Grade badge + 4 component rows — the D13 cross-surface note is real), sweepRunner :88 EXACT, aiAdvisor :336/:352/:488–489 ✓, chat route :113/:115 ✓, insights :359 (DTI-value-only read) ✓, insights :362–364/:510 DUPLICATE ✓ (same component math re-typed around the OTHER engine's score), selfAuditInvariants headline/I7 ✓.
- Negative claims attacked and SURVIVED: (1) **`getHealthScore` barrel export has no caller** — independent grep over lib/app/components finds only the `lib/services/index.ts:32` export itself; dead-export claim CONFIRMED. (2) **"NONE FOUND" independentExpectation** — agreed; ×5 multiplier, 6-month norm and /10000 curve have no external authority. (3) netWorthScore range {25} ∪ [50,100] — recomputed: nw≤0 → 25; nw>0 → 50+nw/10000 ∈ (50,100] capped. Holds (open at 50, immaterial).
- expectedMoves arithmetic recomputed: min(11.6/6×100, 100) = 100 and min(72.6/6×100, 100) = 100 — saturated, no move. The zero-burn caveat is real: `buildEmergencyFundMetrics` :1385 yields 0 on burn ≤ 0 today; any INDEFINITE/∞ change alters this component's input type exactly as flagged.
- Could not verify: portal sweepRunner full logic and aiAdvisor prompt assembly beyond cited lines (disclosed); the rendered portal grade (Ring-3).
- Verdict impact: **none. PASS.**
