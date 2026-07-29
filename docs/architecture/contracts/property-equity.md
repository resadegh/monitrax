# propertyEquity — Quantity Contract (MON-131 Phase A)

Census: 11 sites. Verdict: **MULTIPLE** — canonical per-property helper + canonical aggregate + 5 inline duplicates + 1 D10-flagged wrong-scope consumer + different-quantities/false-positives. **Two related named quantities live under one label** (see §semantic) — do not collapse them blindly.

## classification
DERIVED (D1).

## semantic — TWO quantities under one name
**(a) `propertyEquityPerProperty`** = `Property.currentValue − Σ principal of loans ATTACHED to that property (loan.propertyId === property.id)`. SIGNED — may be negative (underwater); the MON-011 unfloored rule.

**(b) `propertyPortfolioEquity` (aggregate)** = `assets.properties − liabilities.mortgages` (netWorthCalculator:261). NOTE the basis fork: mortgages = loans classified by TYPE (`HOME`/`INVESTMENT`) **OR** propertyId — so a HOME-typed loan with NO propertyId is in (b)'s debt but in NO property's (a). Σ(a) == (b) only when every mortgage-classified loan carries a propertyId. This is a real, quiet divergence — state it, never assume the identity.

**D10 (SETTLED):** portfolio equity **INCLUDES** RENTAL-typed properties; `app/dashboard/properties/page.tsx` excluding them is a bug, not a definition. Verified at HEAD: the filter is at **:492** (`properties.filter(p => p.type !== 'RENTAL')`, comment :491 "they're not owned"), the sum at **:494** — brief's "~494" anchor confirmed, no drift.

## canonicalHome
- Per-property: `lib/utils/calculations.ts:calculateEquity` (:33) — signed, MON-011. **Decimal twin: NOT ESTABLISHED.**
- Aggregate: `lib/calculations/netWorthCalculator.ts:calculateNetWorth` breakdown.propertyEquity (:261) · Decimal twin :452.

## callSites
| file:line | tag | arithmetic in words |
|---|---|---|
| `lib/utils/calculations.ts:33` | CANONICAL (per-property) | value − loanBalance, signed |
| `lib/calculations/netWorthCalculator.ts:261` (+ Decimal :452) | CANONICAL (aggregate) | assets.properties − liabilities.mortgages |
| `app/dashboard/properties/page.tsx:462–464` | CONSUMER | per-row equity via `calcPropertyEquity` (canonical import :37) — correct |
| `app/dashboard/properties/page.tsx:492–494` | CONSUMER, **WRONG-SCOPE (D10 bug)** | `totalEquity = Σ equity over p.type !== 'RENTAL'` — excludes RENTAL rows from the page total |
| `app/dashboard/properties/[id]/page.tsx:154` `computeEquity` | **DUPLICATE** | inline `currentValue − Σ(loans.principal)` — re-derives instead of importing `calculateEquity` |
| `app/api/portfolio/snapshot/route.ts:713` | **DUPLICATE** | inline `currentValue − totalLoanBalance` per property in SnapshotV2 assembly |
| `lib/intelligence/portfolioEngine.ts:757` (equity ~:767) | **DUPLICATE** | inline `currentValue − propertyDebt` in generatePortfolioIntelligence |
| `lib/ai/services/financialAdvisor.ts:434` (equity ~:447–448) | **DUPLICATE** | inline `(currentValue||estimatedValue) − (totalDebt||loanBalance)` with alias-field fallbacks — AI context equity |
| `components/onboarding/wizard/steps/PropertiesStep.tsx:809` (:818–820) · `components/onboarding/wizard/types.ts:876` (:880–891) | **DUPLICATE ×2** | wizard summary `totalValue − totalDebt` re-derives |
| `lib/health/metricAggregation.ts:390` `calculatePropertyMetrics` (:396) | **DIFFERENT-QUANTITY** | `totalPropertyValue − totalPropertyDebt` where debt = ATTACHED loans only, over the health-input scope — the attached-loans aggregate, i.e. Σ(a), not (b). Same fork as §semantic; if named (`attachedLoanPropertyEquity`) it is legitimate |
| `lib/strategy/forecasting/forecastEngine.ts:244` | DIFFERENT-QUANTITY | projected equity (forecastFlows) |
| `components/loans/LoanDetailDialog.tsx:284` | FALSE-POSITIVE | `max(0, principal − offset)` effective-principal / LVR — a loan quantity, not property equity |
| `lib/testing/exporter.ts:76` | CONSUMER (harness) | scenario export |

## invariants
1. Per-property equity is SIGNED — a floor at 0 anywhere is the MON-011 regression.
2. Σ per-property equity == aggregate propertyPortfolioEquity **iff** every HOME/INVESTMENT-typed loan has a propertyId — assert the precondition, then the identity (Ratchet test candidate).
3. Aggregate ties into the bucket identity: propertyEquity + super + personalAssets − personalLoans == lockedLongTerm (accessibilityBuckets:104–108) and buckets Σ == netWorth ($3,401,782 live ref).
4. D10: the properties-page total must equal Σ equity over ALL property rows (incl. RENTAL).

## independentExpectation
Arithmetic identity from FACT rows: Property.currentValue and Loan.principal (+ propertyId link). Hand-derivable; no legislation.

## surfaces
- `/dashboard/properties` → per-row "Equity" column (:659), footer total (:692), hero totalEquity (:548).
- `/dashboard/properties/[id]` → equity KPI (the :154 duplicate).
- `/dashboard/balances` → Hidden Wealth "locked" drill-down propertyEquity component.
- SnapshotV2 consumers of `/api/portfolio/snapshot` (GRDCS property arrays).
- AI advisor / CFO chat property context; onboarding wizard summary step.

## expectedMoves
- **D10 fix (include RENTAL in the page total):** totalEquity changes by Σ over RENTAL rows of (currentValue − attached loans). **Honest direction note, verified at HEAD:** the page FORCES `currentValue: 0` + `purchasePrice: 0` on RENTAL create/edit (page.tsx:812–813), so on data shaped by this form the predicted move is **0 when RENTAL rows carry no loans, NEGATIVE when they do, and only positive via imported/legacy RENTAL rows with real values**. If the tranche's Ring-3 shows no movement, that is CONSISTENT with D10 done right — record it, don't panic. No golden-capture pathPrefix (client-side total); Ring-3 on /dashboard/properties.
- Duplicate collapses ((:154, :713, :767, financialAdvisor, wizard) → `calculateEquity`): **NO numeric movement** — all five compute value − attached-loans already; this is a pure producer-count drop (11 → target ≤ 4: two canonical homes + Decimal + the renamed different-quantity). Any move flags a hidden input difference (e.g. financialAdvisor's alias fallbacks) — investigate, don't absorb.
- metricAggregation:396 rename (if decided): no movement.
- pathPrefixes for golden diff: `lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.netWorth.breakdown.propertyEquity` (expected NO move) · `lib/health/buildHealthInput.ts:buildHealthInput.portfolioSnapshot.properties[*].debt` (expected NO move).

## decisionsRequired
1. **Name the aggregate fork:** `propertyPortfolioEquity` (mortgage-classified basis, netWorthCalculator) vs `attachedLoanPropertyEquity` (Σ per-property basis, metricAggregation). Options: (a) name both and keep both (they answer different questions — balance-sheet vs per-asset roll-up); (b) enforce propertyId on every HOME/INVESTMENT loan (data rule) so they converge, then keep one. Consequence of (b): an unlinked home loan becomes a data-quality error surfaced to the user rather than a silent divergence.
2. RENTAL rows with forced zero value (page.tsx:812–813): D10 includes them, but the form guarantees they contribute $0−loans. Should RENTAL ("I'm renting") rows be excluded at the SEMANTIC level with D10 applying only to owned rental/INVESTMENT properties, or does D10 stand verbatim? **The code's comment (":491 they're not owned") and D10's text pull opposite ways — surfacing per brief §3.1 rule 4/6, not choosing.**
3. Decimal twin for `calculateEquity` — none exists; establish in the same tranche (twins migrate together).

## coverageBoundary
All 11 census sites opened at cited lines except `lib/testing/exporter.ts` (role-tagged) and LoanDetailDialog beyond the false-positive confirmation (:19–25 header + :215–244). The snapshot-route duplicate read at :700–770 window only. `financialAdvisor.ts` equity read at :434–460. Verifies topology and D10 anchor freshness, not live values.
