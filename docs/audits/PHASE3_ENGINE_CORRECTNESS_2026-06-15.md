# Phase 3 — Calc-Engine + Data-Relationship Correctness Audit — 2026-06-15

**Pinned HEAD:** `c10333d2` | **By:** Cowork (Phase 3) | **Status:** ACTIVE | **Mode:** STATIC (read / trace / grep only)
**Scope rule:** RECORD don't fix. No number was hand-calculated (CLAUDE.md §12.3 single-engine rule). Every
finding carries a live `file:line` read at this HEAD. Bugs → separate fix PRs (listed at the end).

## Relationship to the 0·MA Maths Audit (`docs/audits/2026-06-MATHS-AUDIT.md`, 2026-06-07)

0·MA closed tax-constant correctness (MA.1/MA.1b), frequency math (MA.2), GRDCS FK-pattern hygiene (MA.3),
cross-engine consistency (MA.4 — retired the parallel `lib/tax/auTax.ts`; fixed the divergent
`portfolioEngine.calculateNetWorth` + `calculateCashflow` to delegate to canonical), and reform-awareness
(MA.5). **Phase 3 does NOT re-audit any of those.** Phase 3 audits *consistency between code paths* at the
current HEAD, which is ~8 days and a full Phase-47 entity build ahead of 0·MA. The targets below
(`wealthGraphService`, `moneyFlowService`, `lib/reports/contextBuilder`, the entity-value calculators, and
the ownership-attribution layer) were **not in 0·MA's MA.4 consistency matrix**. Where 0·MA already cleared
something (e.g. the MA.4-002 portfolioEngine fix), Phase 3 only **re-confirms it has not regressed**.

## Verdict in one line

The canonical SSOT (`masterFinancialService` → `lib/calculations/*`) is sound and its Float/Decimal siblings
agree. The drift is **at the edges**: newer read-models (`wealthGraphService`, `moneyFlowService`,
`reports/contextBuilder`) re-derive money values instead of importing the canonical valuation, and the
per-entity value engines use **binary legal-title ownership** while the tax engine uses **fractional +
beneficial attribution** — so an entity's displayed *value* and its *tax position* can disagree for any
co-owned asset. Plus the ownership tables reference assets polymorphically with **no DB-level FK**, so asset
deletion orphans them.

## Severity legend

- **P1** — a wrong number can reach a user today via a live path (correctness).
- **P2** — real cross-path divergence; surfaces under common data shapes (co-ownership, missing live price, stale cache).
- **P3** — latent / narrow-edge / different-concept-by-design; safe today, record to prevent rot.

---

# LAYER 1 — Single-engine integrity

## What is sound (re-confirmed, not re-audited)

- **`masterFinancialService` IS the SSOT.** It imports and calls canonical `calculateNetWorth`
  (`lib/services/masterFinancialService.ts:1688`) + the cashflow/expense/income/loan aggregators
  (`:46-76`). Aggregators are not re-implemented inside it.
- **MA.4-002 fix has NOT regressed.** `lib/intelligence/portfolioEngine.ts:304` `calculateNetWorth` still
  delegates to canonical (`:32-35` imports `canonicalCalculateNetWorth`; header note `:11-12`), and
  `calculateCashflow` delegates to `calculateSimpleCashflow` (`:36`).
- **Float/Decimal net-worth siblings agree.** `calculateTotalAssets` (Float `:117-150`) and its Decimal
  sibling (`:322-356`) use the same formula, the same Phase-39.5 SMSF exclusion, and the same
  `ownerEntityId` entity-matching — differing only in numeric type (the documented boundary). Frequency
  siblings `toAnnual`/`toAnnualDecimal` were already verified by MA.2.
- **D6 `sellProperty` CGT path is exemplary.** `lib/cfo/scenarios/propertyDisposalCgt.ts:35-42` composes
  canonical `calculateCgtDiscountDecimal` (Div 115) + `attributeAsset` (ownership weighting) in Decimal —
  it does not re-derive CGT. This is the pattern the findings below should move toward.

## 🟠 L1-1 (P2) — `wealthGraphService` values holdings by a different rule than canonical net worth

**Canonical** (`lib/calculations/netWorthCalculator.ts:127-130` Float, `:331-333` Decimal): a holding is worth
`units × (currentPrice ?? averagePrice)` — i.e. **live market price**, falling back to cost.
**Wealth graph** (`lib/services/wealthGraphService.ts:783-789`, `sumHoldingsValue`): a holding is worth
`currentValue ?? (units × averagePrice)` — i.e. the **denormalized `currentValue` cache**, falling back to
**cost** (`averagePrice`) and **never reading `currentPrice`**.

`InvestmentHolding.currentValue` is documented in `prisma/schema.prisma` as *"units * currentPrice (computed
on update)"* — a cache. The two paths agree **only while that cache is fresh**. They diverge when:
- `currentValue` is stale (units/price changed without a recompute) → graph shows stale value, dashboard shows live;
- `currentPrice` is set but `currentValue` is null → dashboard uses market price, graph falls back to cost basis;
- `currentPrice` is null but `currentValue` is set → opposite mismatch.

**Impact:** the Phase-47 Wealth-Universe asset/entity node values can disagree with the dashboard / master
net-worth investment total for the same user. **Consumer:** `app/api/wealth-graph/route.ts:22` → the wealth
explorer UI. **Root:** there is no shared "holding market value" helper; the formula is implemented twice,
and the `currentValue` denormalization is an SSOT smell.

## 🟠 L1-2 (P2) — `lib/reports/contextBuilder` computes net worth with cost-basis + loan principal

`lib/reports/contextBuilder.ts:207-220` builds its own net worth for report context:
- `investmentValue += h.averagePrice * h.units` (`:211-213`) — **cost basis only**, never `currentPrice`
  (diverges from canonical, like L1-1 but worse — no live-price path at all).
- `totalLiabilities += l.principal` (`:216-218`) — uses the loan **`principal`** field, **not** `currentBalance`.
  Canonical liabilities use `currentBalance` (`netWorthCalculator.ts:241`). For any amortising loan,
  `principal` (original/face amount) ≠ current balance, so liabilities are mis-stated and net worth drifts.
- `netWorth = totalAssets - totalLiabilities` (`:220`) — an independent third net-worth derivation that does
  not source from `masterFinancialService` / canonical.

**Impact:** anything built on this report context (AI report / Financial-Health-Review context path) can
quote a net worth that differs from the dashboard. The `principal`-vs-`currentBalance` substitution is a
concrete correctness divergence, not just a cache-freshness one — hence P2 (lean toward P1 if a user-facing
Review document is confirmed to render this number; confirm the consumer before the fix PR).

## 🟡 L1-3 (P3) — `financialAdvisor` has a divergent net-worth fallback + a third valuation basis

`lib/ai/services/financialAdvisor.ts:462`: `netWorth = snapshot?.netWorth || totalAssets - totalDebt`.
Prefers the canonical `snapshot.netWorth` (good), but the fallback re-derives from a locally summed
`totalInvestments` that uses `inv.currentValue` (`:450`) — a **third** investment valuation basis (after
canonical's `currentPrice`, contextBuilder's `averagePrice`). Only reached when `snapshot.netWorth` is
falsy, so impact is narrow; record so the eventual "one valuation helper" refactor catches it.

## 🟡 L1-4 (P3) — `moneyFlowService` re-derives income/expense/loan totals outside the canonical aggregators

`lib/services/moneyFlowService.ts` correctly reuses canonical `toAnnual` (`:50`, applied at `:335` income,
`:372` expense, `:386` loan) — so **frequency math is consistent**. But it sums raw rows itself instead of
calling `incomeAggregator` / `expenseAggregator` / `cashflowOrchestrator`, so it bypasses their semantic
layer (PAYG net-vs-gross, essential/discretionary handling, exclusions). Money-flow is a deliberately
different concept (gross cash movement through entities), so this is P3 — but the graph's total-income /
total-expense figures can differ from the dashboard's, and a future reader will assume they match.

## 🟡 L1-5 (P3) — Float `||` vs Decimal `??` nullish/falsy mismatch in the net-worth siblings

Float path uses `||` (falsy): `currentPrice || averagePrice` (`netWorthCalculator.ts:128`),
`currentValue || 0` (`:118`), `units || 0`. The Decimal sibling uses `??` (nullish): `currentPrice ??
averagePrice` (`:331`). They diverge **only when a value is exactly `0`** (e.g. a genuine `currentPrice = 0`
→ Float falls back to `averagePrice`, Decimal keeps `0`). Latent and self-resolving: it disappears when the
Float path is retired (same disposition as MA.2-001 / Q-DEC PR 4). Record so the retirement closes it.

---

# LAYER 2 — Data-relationship integrity (GRDCS, CLAUDE.md §6.5)

## What is sound (re-confirmed)

- **Typed entity→asset FKs** (`Property.ownerEntityId` `Restrict`, `*.userId` `Cascade`, soft cross-refs
  `SetNull`, SMSF `SetNull`) were verified by MA.3 and are unchanged — **not re-audited here**.
- **`OwnershipStake` real FKs are correct:** `→ OwnershipGroup` and `→ LegalEntity` both `onDelete: Cascade`
  (`prisma/schema.prisma:916-917`).
- **`attributeAsset` is honest** (`lib/services/ownershipAttribution.ts:103-186`): joint tenants split
  equally, tenants-in-common by `sharePct`, and an uncomputable split (shares missing or not summing to 100%
  within tolerance) **falls back to flat + raises a UNCOMPUTED flag** rather than emitting a silent number.

## 🟠 L2-1 (P2) — Per-entity *value* uses binary legal-title ownership; per-entity *tax* uses fractional + beneficial

The entity-value calculators scope each asset wholly to its single `ownerEntityId`:
- `lib/calculations/entityValueBreakdown.ts:64-116` (selects + buckets purely by `ownerEntityId`).
- `lib/calculations/entityBreakdown.ts:77` (`row.ownerEntityId ?? UNATTRIBUTED_ENTITY_ID`).
- canonical `netWorthCalculator` entity-scoping is the same binary `matchEntity` filter
  (`netWorthCalculator.ts:114-115`).

The tax path attributes the **same assets fractionally**: `entityTaxFactsAssembler` →
`attributeAsset` (`ownershipAttribution.ts:103-186`) applies `OwnershipStake.sharePct` /
joint-tenant equal split / `BeneficialOwnershipOverride` (legal-title vs beneficial owner, `:108-138`).

**Consequence (direct answer to the brief's question "does ownership-share attribution match what the calc
engines assume?" → NO):** for any asset in an `OwnershipGroup` (tenants-in-common 60/40, joint tenants) or
under a `BeneficialOwnershipOverride`, the entity's displayed **value** assigns 100% to the legal-title
entity, while its **tax position** is attributed by share. The two entity-level numbers will not reconcile.
*Total* net worth across all entities remains correct (each asset counted once); it is the **per-entity
split** that diverges. Surfaces in the Phase-47 entity graph / "Entity Value" vs the entity tax facts.

## 🟠 L2-2 (P2) — Ownership tables reference assets polymorphically with no FK → orphan rows on asset delete

`OwnershipGroup` (`prisma/schema.prisma:889-905`) and `BeneficialOwnershipOverride` (`:928-955`) point at
assets via an **untyped polymorphic pair** — `ownedObjectType` (string `'property'|'loan'|'account'|...`) +
`ownedObjectId` (string). These are **not foreign keys**, so there is **no `onDelete` cascade** from the
underlying asset. Confirmed there is no application-level cleanup either:
- `ownershipService.ts` is "the ONLY writer of OwnershipGroup/OwnershipStake" (`:4`) and only deletes a group
  by explicit `ownershipGroupId` (`:221`), never triggered by asset deletion.
- `beneficialOwnershipService.ts:152` deletes an override only by its own id.
- The property delete handler `app/api/properties/[id]/route.ts:383` does `prisma.property.delete()` with **no**
  ownership-group / override cleanup. `grep` across `app/` + `lib/` finds zero asset-deletion-triggered
  ownership cleanup.

**Impact:** deleting a property / account / investment account / asset orphans its `OwnershipGroup`,
`OwnershipStake` (group cascade fires but the group itself lingers), and any `BeneficialOwnershipOverride`.
The rows accumulate pointing at a non-existent `ownedObjectId`; integrity is enforced **only at runtime** by
`lib/entity-graph/` (per the schema comment at `:925-927`), not by the DB. MA.3 audited typed FKs only, so
this polymorphic surface was outside its matrix. **Not a wrong-number bug** — a referential-integrity /
hygiene gap on a money-relevant relationship.

## 🟡 L2-3 (P3) — Deleting a co-owner's `LegalEntity` silently re-weights the remaining split

Because `OwnershipStake → LegalEntity` is `onDelete: Cascade` (`:917`), deleting one co-owner's entity
removes its stake, after which the group's `sharePct` rows no longer sum to 100%. `attributeAsset` then hits
its honest fallback (flat + UNCOMPUTED flag) rather than erroring — acceptable behaviour, but the attribution
for the *other* owners changes as a side-effect of an unrelated entity deletion. Record; low impact.

---

# Summary

| ID | Layer | Severity | One-liner | Anchor |
|---|---|---|---|---|
| L1-1 | 1 | P2 | Wealth-graph holdings use `currentValue` cache + `averagePrice`, never `currentPrice` | wealthGraphService.ts:783-789 |
| L1-2 | 1 | P2 | Report context uses cost-basis investments + loan `principal` (not `currentBalance`) | contextBuilder.ts:207-220 |
| L1-3 | 1 | P3 | Advisor fallback net worth + third valuation basis (`currentValue`) | financialAdvisor.ts:450,462 |
| L1-4 | 1 | P3 | Money-flow re-derives income/expense/loan outside canonical aggregators | moneyFlowService.ts:335,372,386 |
| L1-5 | 1 | P3 | Float `||` vs Decimal `??` diverge at exact `0` | netWorthCalculator.ts:118,128,331 |
| L2-1 | 2 | P2 | Per-entity value = binary `ownerEntityId`; per-entity tax = fractional/beneficial | entityValueBreakdown.ts:64-116; ownershipAttribution.ts:103-186 |
| L2-2 | 2 | P2 | Ownership tables polymorphic, no FK → orphan rows on asset delete | schema.prisma:889-905,928-955 |
| L2-3 | 2 | P3 | Deleting a co-owner entity silently re-weights the remaining split | schema.prisma:917 |

# Recommended fix PRs (record-don't-fix — each is a separate PR)

1. **One canonical "asset market value" helper.** Extract holding valuation (`units × (currentPrice ??
   averagePrice)`) + loan-balance (`currentBalance`) into shared functions in `lib/calculations/` and have
   `wealthGraphService` (L1-1), `contextBuilder` (L1-2), and `financialAdvisor` (L1-3) import them. Closes
   three divergences at once; consider retiring/recomputing the `InvestmentHolding.currentValue` cache.
2. **Decide per-entity ownership semantics (L2-1).** Either (a) make `entityValueBreakdown` /
   `entityBreakdown` apply `attributeAsset` weighting so value and tax reconcile, or (b) explicitly document
   that "Entity Value" is legal-title and surface a note in the UI. Product + AFSL call — flag to Reza.
3. **Ownership-row referential integrity (L2-2).** Add asset-deletion cleanup for `OwnershipGroup` /
   `OwnershipStake` / `BeneficialOwnershipOverride` (app-level cascade in the delete handlers, or a periodic
   orphan sweep), since polymorphic refs cannot use a DB FK.
4. **Money-flow aggregator alignment (L1-4)** — optional; only if money-flow totals are meant to equal
   dashboard totals. Otherwise document the intended difference.
5. **L1-5 + L2-3** — no standalone PR; L1-5 closes with the Float-path retirement (Q-DEC), L2-3 is acceptable
   behaviour, recorded only.

_All findings are STATIC (read/trace/grep). No values were computed by hand. Typecheck/test runs were not
performed as part of this read-only pass; the pre-existing `taxYearConfig.test.ts` review-date failure noted
in STATE.md is unrelated to these findings._
