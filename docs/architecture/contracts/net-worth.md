# netWorth — Quantity Contract (MON-131 Phase A)

Census: 7 sites (`.audit/producer-census.json` @ 2026-07-29). Verdict: **MULTIPLE** — 1 canonical + 1 duplicate + 2 legitimately different quantities + harness sites.

## classification
DERIVED (D1). Never stored (audit snapshots only — `NetWorthSnapshot`/`netWorthHistory` pattern).

## semantic
`netWorth = totalAssets − totalLiabilities`, current point-in-time, AUD, whole-household (no entity filter unless `ownerEntityId` passed).

**Assets (five classes, inclusions explicit):**
- properties: Σ `Property.currentValue` — ALL property rows (incl. RENTAL-typed; their value is forced 0 at creation, see property-equity contract).
- accounts: Σ `Account.currentBalance` — ALL account types, INCLUDING negative CREDIT_CARD balances (card debt held as an account is embedded here, not in liabilities).
- investments: Σ holdings `units × (currentPrice || averagePrice)` (**MARKET** basis) + Σ `InvestmentAccount.cashBalance` (MON-013).
- superannuation: Σ `Super.balance` EXCLUDING `fundType === 'SMSF'` (Phase 39.5 — SMSF wealth flows through the LegalEntity's owned assets; double-count guard).
- personalAssets: Σ `Asset.currentValue`.

**Liabilities:** loans classified by `calculateTotalLiabilities` — mortgage when `type ∈ {HOME, INVESTMENT}` (case-insensitive) OR `propertyId` set; creditCards when `type === 'CREDIT_CARD'`; else personalLoans. Total = sum of the three.

## canonicalHome
`lib/calculations/netWorthCalculator.ts:calculateNetWorth` (line 239) · Decimal twin `calculateNetWorthDecimal` (line 431). Both verified at HEAD.

## callSites
| file:line | tag | arithmetic in words |
|---|---|---|
| `lib/calculations/netWorthCalculator.ts:239` (+ Decimal :431) | CANONICAL | assets.total − liabilities.total over the class sums above |
| `lib/calc-audit/userAudit/adapters/coreAdapters.ts:121` `validateOutput` | CONSUMER (harness) | asserts engine outputs finite/non-negative; no derivation |
| `lib/calculations/accessibilityBuckets.ts:83` `computeAccessibilityBuckets` | CONSUMER | partitions the canonical `NetWorthResult` into 3 buckets; tie-out to netWorth by construction (file-header proof) |
| `lib/health/buildHealthInput.ts:50` (arithmetic :69–74) | **DIFFERENT-QUANTITY** | `netWorth = (properties + ALL accounts + holdings at units×averagePrice COST) − Σ all loan principals`. EXCLUDES super, personal assets, investment-account cash; investments at COST not market. Long-standing own basis, asserted as-is by `tests/golden/ring2.healthInput.test.ts` header. **Needs a name: `healthInputNetWorth`** |
| `lib/reports/contextBuilder.ts:178` `calculateFinancialSummary` (arithmetic :199–222) | **DUPLICATE** | re-derives from raw rows: propertyValue + accountBalances + holdings-at-market − `sumLoanBalances(loans)`. Presents itself as "your current net worth" in a report but omits super + personalAssets + investment-account cash. To be repointed at canonical (T5) |
| `lib/strategy/forecasting/forecastEngine.ts:244` `projectYear` (arithmetic ~:292) | DIFFERENT-QUANTITY | PROJECTED net worth in forecast year N — `totalAssets − totalLiabilities` over projected balances. A forecastFlows quantity, not current net worth |
| `lib/testing/exporter.ts:76` | CONSUMER (harness) | test-scenario exporter; not user-facing; body not fully audited (see coverageBoundary) |

Related (assets/liabilities census, affects this number): `lib/intelligence/portfolioEngine.ts:313` `calculateNetWorth` DELEGATES to canonical (MA.4-002) but **does not pass `investmentAccounts`** → the intelligence/AI/strategy net worth silently omits investment-account cash (MON-013 scope gap). WRONG-INPUT finding, not a second formula.

## invariants
1. `netWorth == assets.total − liabilities.total` (exact).
2. `assets.total == properties + accounts + investments + superannuation + personalAssets`.
3. `liabilities.total == mortgages + personalLoans + creditCards`.
4. Bucket tie-out: `liquidToday + accessible + lockedLongTerm == netWorth` (enforced live by `lib/verification/selfAuditInvariants.ts:93` I3).
5. Live reference: **$3,401,782** (`RENDERED_PART_C.netWorth`, `lib/matrix/goldenBaseline.ts:75`, VR-041 Part-C).

## independentExpectation
Arithmetic identity recomputable from FACT rows alone: Σ Property.currentValue + Σ Account.currentBalance + Σ(units × price) + Σ InvestmentAccount.cashBalance + Σ non-SMSF Super.balance + Σ Asset.currentValue − Σ Loan.principal. No legislation involved; hand-derivable from a DB dump.

## surfaces
- `/dashboard` → home "Net worth" (quickMetrics.netWorthValue via master snapshot).
- `/dashboard/balances` → Hidden Wealth lens (netWorth denominator + bucket display).
- `/dashboard/reports` → financial summary "current net worth" (currently the contextBuilder DUPLICATE).
- `/portal/clients/[id]` → ClientCanonicalDashboard (snapshot quickMetrics).
- CFO chat / AI advisor context (via portfolioEngine → WRONG-INPUT path above).

## expectedMoves
- **Master snapshot paths: NO movement** — `lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.netWorth.*` and `.quickMetrics.netWorthValue` already read the canonical engine with full inputs. Strongest prediction; falsifies the migration if it moves.
- contextBuilder → canonical (T5): report netWorth **INCREASES** by (super + personalAssets + investment-account cash present on live data); no golden-capture pathPrefix (reports not in the 7 captures) — Ring-3 surface check on /dashboard/reports.
- portfolioEngine investmentAccounts wrong-input fix: AI/strategy totals **INCREASE** by Σ InvestmentAccount.cashBalance. No direct capture path; visible via CFO chat context.
- `buildHealthInput` paths (`lib/health/buildHealthInput.ts:buildHealthInput.portfolioSnapshot.netWorth`): NO movement in T5 — it is a named DIFFERENT-QUANTITY; any convergence is a separate decision (below).

## decisionsRequired
1. **`healthInputNetWorth` convergence** — keep as its own named quantity (cost-basis, narrower scope; today's health scores calibrated to it) OR converge on canonical (market basis, full scope; health score will move). The cost-vs-market investments valuation is the semantic fork named in the buildHealthInput file header ("a future MON"). Consequence: converging changes every health score; keeping requires the name + a rendered-label audit so no surface calls it "net worth".
2. `NetWorthResult.breakdown.liquidAssets` (netWorthCalculator.ts:264 — non-OFFSET accounts, gross, includes negative card balances) is an UNNAMED third liquid variant contradicting D5 (OFFSET *is* in `LIQUID_ACCOUNT_TYPES`). Rename or re-found on `computeLiquidCash` gross. See liquid-cash-deployable contract §decisionsRequired.

## coverageBoundary
Verified at HEAD: netWorthCalculator.ts (full read), buildHealthInput.ts (full read), contextBuilder.ts:170–260, portfolioEngine.ts:300–520, accessibilityBuckets.ts (full read), coreAdapters.ts:110–135, forecastEngine.ts:244–300 (grep-level). NOT read line-by-line: `lib/testing/exporter.ts` + `lib/testing/index.ts` bodies (harness-only; tagged from role, not full audit); the RENDER layer of /dashboard/reports PDF generators beyond `generators/index.ts:115`. This contract verifies producer topology; it does NOT verify the live numbers themselves (Ring-3 territory).
