# depreciation.annualDeduction — property depreciation (Div 40 plant & Div 43 capital works)

> MON-131 Phase A quantity contract (D11, REFERENCE_NUMBERS_DESIGN.md §6 / §4 T4).
> One contract file: the annual deduction is the primary quantity; written-down value,
> cumulative claimed, and the multi-year forecast are co-produced by the same engine call
> and documented as sub-quantities below — they are not independent producers.

## classification

**DERIVED** — computed from FACT rows (`DepreciationSchedule`: cost, rate, method, category,
startDate; prisma/schema.prisma:2477-2495). Never stored; computed on read.

## semantic

- **Per-schedule annual tax deduction, AUD/yr**, for one `DepreciationSchedule` row.
- **Method:** `PRIME_COST` (straight line: `cost × rate`) or `DIMINISHING_VALUE`
  (Div 40 only in the engine: `WDV × rate × 2`, the 200% post-May-2006 multiplier).
  DIV43 is always effectively prime-cost (form disables method choice, defaults 2.5%).
- **RATE UNIT — the load-bearing contract: `DepreciationSchedule.rate` is a PERCENTAGE
  (2.5 means 2.5%, 10 means 10%), NOT a fraction.** Established from schema + writer (§19.2):
  - Writer form: `app/dashboard/properties/[id]/depreciation/page.tsx:412,415,461-468` —
    label "Rate (% p.a.)", DIV43 default `2.5`, DIV40 default `10`, posted unchanged.
  - API validators: `app/api/properties/[id]/depreciation/route.ts:14` and
    `[depId]/route.ts:15` — `z.number().positive().max(100, 'Rate cannot exceed 100%')`,
    stored verbatim (`route.ts:66-77`).
  - Schema comment: `prisma/schema.prisma:2484` — `rate Float // 2.5% for Div43`.
  - Locked by test: `tests/tax/depreciationRate.test.ts` (MON-026).
  Every consumer must divide by 100. A consumer that treats `rate` as a fraction is 100× high;
  a WRITER that stores a fraction makes every read 100× low.
- **FY basis: NOT financial-year aligned.** The canonical engine computes "as of asOfDate"
  from the schedule's startDate anniversary (`yearsElapsed = floor(elapsed/365.25y)`,
  index.ts:235-239). No days-held pro-rata inside the annual path
  (`calculateProRataDepreciation` index.ts:218 exists but is unused by it). This is an
  anniversary-year approximation of the ATO FY figure — a semantic, not a bug, but it must
  be stated on any surface that implies "this FY".

## canonicalHome

**`lib/depreciation/index.ts:78` — `calculateDepreciationAnnual(schedule, asOfDate)`**
(does `rate/100` at :89; DV on WDV at :91-96; prime cost at :97-102). Co-produced outputs of
the same call: `currentWrittenDownValue` (remaining value), `totalDepreciationClaimed`
(cumulative — the CGT clawback input, `lib/cgt/costBase.ts:211` takes it as a parameter),
`yearsRemaining`, `dailyDepreciation`. Aggregation: `calculatePropertyDepreciation`
(index.ts:138), forecast: `generateDepreciationForecast` (index.ts:173).

**Decimal twin: NONE — CONFIRMED** (grep `Decimal` in `lib/depreciation/` → zero hits).
The tax engine's Decimal path consumes the Float engine's output
(`taxPositionCalculator.ts:844-846` wraps `currentYearDeduction` via `toDecimal`), so no
independent Decimal producer exists; census claim confirmed.

## callSites (verified at HEAD 2026-07-29)

| file:line | class | arithmetic in words + rate-unit assumed |
|---|---|---|
| lib/depreciation/index.ts:78-124 | **CANONICAL** | `rate/100`; DV(DIV40): `cost×(1−2r)^⌊yrs⌋ × 2r` (WDV basis); PC: `cost×r`. Assumes **percentage** ✓ |
| lib/tax-engine/position/userTaxPosition.ts:217-222 | CONSUMER | `currentYearDeduction = calculateDepreciationAnnual(dep).annualDepreciation` (MON-026 fix). Feeds household + perMember tax positions ✓ |
| lib/tax-engine/position/taxPositionCalculator.ts:296-299, 844-846 | CONSUMER | sums pre-computed `currentYearDeduction` (Float + Decimal paths); no own rate math ✓ |
| app/dashboard/properties/[id]/page.tsx:176-178 | CONSUMER | Σ `calculateDepreciationAnnual(d).annualDepreciation` (MON-003 fix) ✓ |
| app/api/calculate/depreciation/route.ts:157-176 | CONSUMER | canonical engine + forecast. **No frontend caller found — orphan-route candidate.** Also hardcodes 0.37 marginal rate at :197 (D12/MON-133 class) |
| lib/testing/exporter.ts:412,538 | CONSUMER | canonical engine ✓ (admin testing exporter) |
| app/dashboard/properties/[id]/depreciation/page.tsx:194-228 | **DUPLICATE** | inline: `rate/100` ✓ percentage, BUT DV = `cost × r × 2` — first-year-on-cost forever ("Simplified - assumes first year" :197), plus own remainingYears (`100/rate`) and remainingValue (:216-228) |
| lib/reports/contextBuilder.ts:342-348 | **DUPLICATE** | inline per-property: `rate/100` ✓, DV = `cost × r × 2` on cost, and applies the ×2 to DIV43-DV rows too (no DIV40 check — diverges from its own sibling below) |
| lib/reports/contextBuilder.ts:512-533 | **DUPLICATE** | inline per-report: `rate/100` ✓, DV(DIV40) = `cost × r × 2` on cost; own remainingValue :527-533. Feeds taxTime + propertyPortfolio report generators |
| lib/depreciation/div40.ts / div43.ts / schedule.ts | **DIFFERENT-QUANTITY (orphaned)** | effective-life + FY-aligned + days-held engines taking **fraction** rates (div43.ts:51-52 `0.025` — §7: anchor −1); no importers outside `lib/depreciation/` (schedule.ts is their only consumer; nothing imports schedule.ts; sole external mention is a doc COMMENT at `lib/services/wealthGraphService.ts:813`). A genuinely FY-based quantity definition — currently dead code |
| lib/depreciation/index.ts:247-258 `getDiv43Rate` | **DIFFERENT-QUANTITY (unit hazard)** | returns a **FRACTION** (0.025/0.04) in the same module whose schedule contract is percentage. Sole consumer `app/api/calculate/depreciation/route.ts:79` correctly ×100 at :84 — but feeding this into a `DepreciationSchedule.rate` write would be a silent 100×-low |
| prisma/seed-validation.ts:485,502 | **WRONG-INPUT WRITER** | writes `rate: 0.025` and `rate: 0.125` — **fractions, violating the percentage contract** |
| lib/testing/loader.ts:552-564 (+ normalizer.ts:584-603) | WRITER (pass-through) | writes scenario JSON `rate` verbatim, no unit validation — scenarios must supply percentages |

## invariants (the 100× guard)

1. The same `DepreciationSchedule` row yields the same annual figure through every path:
   detail page = tax position = management page = report context. (Violated today in
   METHOD, not unit — see expectedMoves.)
2. `rate` read anywhere is divided by exactly one factor of 100, exactly once.
3. Every writer stores 0 < rate ≤ 100 as a percentage (`max(100)` validator is the fence);
   a value ≤ 1 on a DIV43 row is a unit-violation signal (2.5 is legal-minimum-ish; 0.025 is not).
4. `annualDeduction ≤ cost` and `totalDepreciationClaimed ≤ cost`, always. *(§7 caveat:
   `totalDepreciationClaimed ≤ cost` holds in-engine (PC is `Math.min`-capped, DV is `cost − WDV`),
   but `annualDeduction ≤ cost` is NOT code-guaranteed for DIMINISHING_VALUE rates > 50 — the
   `max(100)` validator admits e.g. rate 60 → first-year DV = cost × 1.2, and `(1 − 2r)` goes
   negative so later years alternate sign. Pin the invariant WITH a writer-side DV-rate ≤ 50 guard,
   or it will fail on legal-but-absurd input.)*
5. Σ per-schedule annual = property total = household deduction line (additivity).

## independentExpectation

ATO Div 40 DV (ITAA97 s40-72): `base value × (days held/365) × (200% / effective life)`;
prime cost (s40-75): `cost × (days/365) × (100% / effective life)`; Div 43 (s43-140/43-210):
construction cost × 2.5% (post-15-Sep-1987) or 4% (18-Jul-1985→15-Sep-1987), straight line.
The canonical engine implements these with: stored `rate` standing in for 100%/effective-life,
the ×2 DV multiplier (index.ts:55), NO days-held pro-rata, and anniversary (not FY) years —
i.e. a full-year approximation of the statute. The orphaned div40/div43 engines implement the
statutory days-held FY form but are unwired. Worked example (locked in
tests/tax/depreciationRate.test.ts): $100,000 @ 2.5 PRIME_COST → $2,500/yr (never $250,000).

## surfaces

| route | label |
|---|---|
| /dashboard/properties/[id] | "Depreciation/yr" (canonical engine) |
| /dashboard/properties/[id]/depreciation | "Annual Deductions" stat + per-card "Annual Deduction", "Remaining Value", "Remaining Life" (DUPLICATE math) |
| /dashboard/tax | "Depreciation" deduction line (canonical via getUserTaxPosition) |
| /cashflow + My Guide | tax figures via the same getUserTaxPosition bundle |
| Reports: Tax Time + Property Portfolio | per-schedule "annualDeduction" + per-property "annualDepreciation" (DUPLICATE math ×2, contextBuilder) |
| POST /api/calculate/depreciation | full summary/forecast JSON (canonical; no UI caller found) |

## expectedMoves (when collapsed to the canonical engine)

- **The brief's 100× trap between page.tsx:194 and contextBuilder.ts:521 is NOT live at
  HEAD — DRIFT vs the brief.** contextBuilder.ts:513 does `rate/100` before :521; both sites
  agree on unit. MON-026 closed it (fix + lock test predate this audit).
- What still moves (method divergence, typically <2×, not 100×): for any DIMINISHING_VALUE
  schedule older than ~1 year, the management page (:198) and both contextBuilder dups
  (:346, :521) show the frozen FIRST-YEAR figure `cost×r×2`, while the canonical engine
  shows the declining WDV-based figure. Seeded example (carpet, $8,000 @ 12.5 DV,
  start 2021-06-01, ~5 elapsed yrs): duplicates show $2,000/yr; engine shows
  8000×0.75⁵×0.25 ≈ **$474/yr**. Reports + management page DECREASE to the engine figure.
- contextBuilder:346 additionally stops doubling DIV43-DV rows (its sibling :520 never did).
- Remaining Value / Remaining Life on the management page move to engine
  `currentWrittenDownValue` / `yearsRemaining` semantics (ceil vs 1-dp rounding differs).
- If seed-validation data is in an environment: those two schedules' figures INCREASE 100×
  (e.g. Building $350k @ "0.025" renders $87.50/yr today; correct percentage-contract figure
  is $8,750/yr) once the seed writes percentages.

## decisionsRequired

1. D11 execution scope: delete the three inline duplicates (management page, contextBuilder ×2)
   in favour of the engine — Reza gate because reports + management page figures move (table above).
2. Fate of the orphaned FY-aligned engines (div40.ts/div43.ts/schedule.ts): delete as dead code
   (§12.1), or adopt as the future FY-accurate producer (they, not index.ts, match the statutory
   days-held form). Two engines may not both stay reachable.
3. `getDiv43Rate` unit: rename/retype to return percentage (or brand the fraction type) so the
   module carries ONE rate unit — the D11 "unit stated in the type" contract.
4. Fix `prisma/seed-validation.ts:485,502` to percentages (2.5, 12.5) — trivial but number-moving
   in validation environments.
5. `/api/calculate/depreciation`: wire a UI caller or delete (orphan route, §12.4); its hardcoded
   0.37 belongs to MON-133 either way.
6. FY-basis: keep anniversary approximation (state it in UI copy) or move to FY days-held basis
   (changes every figure slightly) — financial-adviser-lens call.

## coverageBoundary

Verifies: schema+writer rate-unit contract, all producers/consumers of
`DepreciationSchedule`-derived figures found by grep census at HEAD (18 sites above), the two
brief-named anchors re-verified, orphan status of div40/div43/schedule.ts and the calc route
(no static importers/callers). Does NOT verify: runtime rendered values (no Ring-3 here), DB
contents (whether fraction-rate seed rows exist in any live environment), Xero-imported
`depreciation` P&L totals (`lib/integrations/xero/reportParser.ts:195` — an external FACT,
different quantity, not schedule-derived), or dynamic/reflected callers of the calc route.

## Adversarial review (§7) — 2026-07-29

- **Claims checked: 42** (anchors 26 · arithmetic 10 · negative-claims 6). All at HEAD `72b15268`.
  Engine verified line-exact: `calculateDepreciationAnnual :78`, `rate/100 :89`, DV-on-WDV `:91-96`
  (`cost × (1−2r)^⌊yrs⌋ × 2r` with `DIMINISHING_VALUE_MULTIPLIER = 2.0` at `:55` and the floor in
  `calculateYearsElapsed :235-239` — `Math.floor(elapsed / 365.25y)` exactly as stated), prime cost
  `:97-102`, aggregation `:138`, forecast `:173`, unused pro-rata `:218`, `getDiv43Rate :247-258`
  returning FRACTIONS. Writers/validators: form defaults 2.5/10 + "Rate (% p.a.)" label
  (`:411-416,:461`), zod `max(100)` (`route.ts:14`, `[depId]:15`), verbatim store `:66-77`, schema
  comment `:2484`. Duplicates verified with their exact divergences: management page `:194-228`
  (first-year DV, `100/rate`, own remainingValue), contextBuilder `:343-350` (DV ×2 with NO DIV40
  check — confirmed `if (d.method === 'DIMINISHING_VALUE')` only) vs `:512-533` (WITH DIV40 check —
  confirmed), loan-table sibling structure intact. Seed fractions `:485 (0.025)`, `:502 (0.125)`
  verbatim. Consumers: `userTaxPosition :217-222` (engine call at `:220`), `taxPositionCalculator
  :296-299` + Decimal `:844-846` (`toDecimal(currentYearDeduction)` — no own rate math),
  detail page `:172-179`, exporter `:412,:538`, loader `:552-564` + normalizer `:584-603`
  pass-through, `costBase.ts:211` parameter-taking clawback, xero `:195` external FACT.
  **All five worked examples independently recomputed:** $100k @ 2.5 PC → $2,500 ✓ (and the lock
  test exists with that exact assertion); carpet $8,000 @ 12.5 DV, start 2021-06-01, ⌊5.16⌋ = 5 →
  8000 × 0.75⁵ × 0.25 = **$474.61** ✓ vs duplicate 8000 × 0.125 × 2 = **$2,000** ✓; seed building
  350000 × (0.025/100) = **$87.50** ✓ vs percentage-contract 350000 × 0.025 = **$8,750** ✓.
  Negative claims independently re-run, ALL confirmed: zero `Decimal` hits in `lib/depreciation/`;
  div40/div43/schedule orphaned (only external reference is a comment,
  `wealthGraphService.ts:813`); `/api/calculate/depreciation` has no static frontend caller;
  `:197` hardcoded 0.37 present; `getDiv43Rate`'s sole consumer ×100s at `:84`; the brief's
  page-vs-contextBuilder 100× trap confirmed NOT live (both `rate/100`).
- **REFUTED / CORRECTED:**
  1. *Anchor* — `div43.ts:52-53` → `:51-52` (1-line drift). Fixed inline; orphan evidence extended
     with the comment-only external mention.
  2. *Invariant 4* — `annualDeduction ≤ cost` is not code-guaranteed for DV rates in (50, 100]
     (validator admits them; first-year DV = cost × 2r > cost, and `(1−2r)^n` alternates sign).
     Caveat added inline — the invariant needs a writer-side DV-rate guard to be pinnable.
- **Could not verify:** whether fraction-rate rows exist in any LIVE database (the seed writes them,
  but DB contents are Ring-3 scope — contract states this itself); Xero-imported totals; dynamic
  callers of the calc route (static search only — contract states this).
- **Verdict impact: none.** The rate-unit contract (percentage), canonical home, DUPLICATE map with
  method-divergence (not unit-divergence) at HEAD, orphan verdicts, and all expectedMoves survive
  the attack unchanged. This contract PASSES with one 1-line anchor fix and one invariant caveat.
