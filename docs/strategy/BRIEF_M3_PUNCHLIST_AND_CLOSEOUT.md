# CODE BRIEF — M3 scoreboard punch list · ATO labelling · M2 close-out

**Raised:** 2026-08-22 · **By:** Matrix HQ (Cowork, Fable 5) after the scoreboard acceptance + pack-fix Ring-3 PASS (#1601) · **Authorised by:** the plan cursor (post-#1603) — this IS the "next Code brief" it names.
**Boot per plan §0 first:** `CLAUDE.md` → `STATE.md` → `MONITRAX_V1_MASTER_PLAN.md` (cursor → M3) → this brief. Re-verify every claim below in source before building — cite-or-flag; this brief was cut from a read of `a797c4b`.

**Laws in force:** D-18 (enhance-only — nothing here is net-new capability), D-20 (all items are kept-surface), D-21 for the two number-moving items (§B, §C-3: expected movement written FIRST, golden self-diff only-predicted-leaves, Ring-3 on live data closes them, Reza merges). §0: boxes, cursor and §9 line in the SAME PR. Never fix a number in passing — anything found beyond this brief's scope → registry issue.

**Suggested cut:** PR-1 = §A + §C + §D (changesNumbers: NO) · PR-2 = §B + §C-3 (changesNumbers: YES, D-21 block in the PR body). §E (docs/registry) rides whichever PR lands last. One PR is acceptable if the D-21 block covers it.

---

## §A — Registry work (do FIRST — the numbers below are referenced throughout)

Assign the next free MON- numbers from `docs/issues/ISSUES.json` (last known MON-179; confirm) and register, in BOTH ISSUES.md and ISSUES.json (Neo-sync, same PR):

1. **MON-18x-a · EOFY tile misleading empty state** (§C-1) — scoreboard, medium.
2. **MON-18x-b · Intake-queue tile renders "—"** (§C-2) — scoreboard, medium. Root cause already diagnosed (below).
3. **MON-18x-c · Two portfolio-LVR producers disagree** (§C-3) — snapshot 41.3% vs properties page 40.8%, high (SSOT breach on a shipped number).
4. **MON-18x-d · Cashflow strip shows 4 of N properties with no stated rule** (§C-4) — scoreboard, low.
5. **MON-18x-e · Pack ATO labelling reaches zero rows on live data** (§B) — high. The M3.1 opener.
6. **MON-18x-f · DATA: duplicate + stray property records in Reza's account** — record only, NEVER auto-fix (Reza 2026-08-22: exactly ONE Guildford exists; Thornlands is a duplex with 2 lots, both legitimate). Findings from the Ring-3 run: duplicate 'Guildford' record `a288774b` (2 tx rows attached) beside the real `888d5685` (12 rows); stray record named 'Thornlands' `4f931826` (distinct from the two legitimate 'Thornland Lot N' records); 2 tx rows whose link-target ids resolve to nothing (`e0f1ab08…`, `02437f99…`). Resolution path = Reza merges/deletes via the existing UI (PR-3's confirmed Delete); if the duplicate holds tx rows, the existing duplicateMerge/re-link machinery applies. NO code in this brief — register with the evidence, propose the Reza runbook in the issue body.
7. **MON-18x-g · MODULE_HOME key semantics changed at the 2026-08-22 flip** (§D) — high, exposure class. MODULE_HOME now means "the v1 scoreboard ships"; surfaces that used it to mean "the R4 wealth-OS Home family" are now mis-gated LIVE (inventory in §D).

**Registry flips:** MON-168, MON-169, MON-170 → **VERIFIED** in both registry files, citing the Ring-3 PASS verdict on #1601 (2026-08-22: backfill 293/46/idempotent-0; identity 35+39+0+313=387 exact to the cent; perProperty 4 entries; property tiles byte-identical).

---

## §B — Pack ATO labelling: make the mappings actually land (M3.1 opener, changesNumbers: YES → D-21)

**Live evidence (Ring-3, 2026-08-22, FY2025-26 on Reza's data):** `atoLabelling = {labelled: 0, noCategory: 0, noAtoMapping: 35}`, `atoLabels: []`. All 35 included rows carry a category, yet ZERO reach an ATO label.

**What the source says (re-verify):** the seed machinery EXISTS and RUNS — `lib/bookkeeping/taxCategoryMapping.ts` holds `SYSTEM_TAX_MAPPING_SEEDS` (~60 AU defaults: rental schedule 21B–21X lines, D-1…D-5, Div 40/43) and `seedSystemMappings(userId)` is called by every pack export (`summary.ts:164`). So this is NOT "mappings were never seeded" — it is a **resolution mismatch**: `summary.ts:292-331` resolves each tx by the EXACT triple `level1|level2 ?? ''|subcategory ?? ''` against the user's `CanonicalCategoryRegistry` rows, while the seeds register categories as `(level1, level2, subcategory: null)`. Any live row whose triple differs — a subcategory set, a level2 the seed vocabulary doesn't use ('Rent' vs 'Rental', casing, etc.) — falls to `noAtoMapping` even when a mapping for its family exists.

**Tasks:**
1. **Diagnose before coding (D-21 condition 1 feeds off this):** pull the 35 rows' distinct category triples (admin-side or a temporary diagnostic in the dry-run family — NOT a schema change) and state, in the PR, exactly why each failed: unmatched triple vs unseeded vocabulary.
2. **Fix resolution at the ONE producer** (`buildTaxPackSummary`'s lookup — no second resolver): fall back through the hierarchy `(l1, l2, sub)` → `(l1, l2)` → `(l1)` when the exact triple has no mapping, mirroring how `getMappingsForCategory` already prefers user overrides. A row only lands in `noAtoMapping` when NO level of its hierarchy is mapped.
3. **Extend `SYSTEM_TAX_MAPPING_SEEDS`** with whatever legitimate vocabulary the diagnosis surfaces (Reza's real categories), keeping the rental-schedule lineItem discipline. Do NOT invent mappings for ambiguous categories — those stay honestly `noAtoMapping` (that is the tile's job to surface).
4. **Ring-0:** extend the 7-row worked example — a subcategory-bearing row that labels via the (l1,l2) fallback, and a genuinely unmapped row that still counts.

**D-21 expected movement (write in the PR BEFORE the fix):** pack totals (income/expenses/count), reconciliation identity, perProperty — **byte-identical** (labelling partitions the included rows; it never moves totals). Movement confined to: `atoLabelling.labelled` 0→N, `noAtoMapping` 35→(35−N), `atoLabels` []→populated. The partition identity `labelled + noCategory + noAtoMapping === included.count` stays hard-asserted. mustNotMove: everything in `RING3_M3_PACK_FIX.md`'s list. Matrix re-exports FY2025-26 to verify.

---

## §C — Scoreboard punch list (acceptance findings, Reza 2026-08-22)

### C-1 · EOFY tile: honest empty + just-ended-FY framing (display logic; changesNumbers: NO)
Today (`ScoreboardClient.tsx:249-281`): the tile reads the pack export with NO `fy` param → the CURRENT FY window (FY2026-27, near-empty in August) → `notReadyCount 0` → renders **"All rows Tax-ready"** while 35 unmapped FY2025-26 rows sit one window back. Vacuously true = misleading (depth-sweep class b: an empty state hiding missing capability).
**Fix:** (a) when the current-FY `includedCount` is 0 → an explicit "No property rows yet this FY" state, never the tax-ready claim; (b) until an explicit cutover (recommend: while current-FY `includedCount` is 0 and we are within 4 months of FY start — i.e. the EOFY work season), the tile ALSO fetches the just-ended FY (`?fy=` param exists) and leads with it: "FY2025-26: 35 rows not tax-ready". Same producer, second window — no new engine. State the chosen rule in a comment + test.

### C-2 · Intake-queue tile: fix the dead fetch (changesNumbers: NO)
Root cause confirmed in source: the tile fetches `/api/unified-transactions/review-queue` with NO `band` param (`ScoreboardClient.tsx:103`); the route REQUIRES `band=medium|low` and 400s otherwise (`route.ts:31-36`) → json() null → `intakeCount` null → "—" for every account, always.
**Fix:** fetch both bands (or add a count-only mode to the SAME route — no second producer) and render medium+low pending total. Test: the tile renders a number when the queue has items and 0 (not "—") when empty; "—" remains only for a genuine fetch failure.

### C-3 · ONE portfolio-LVR producer (changesNumbers: YES → D-21)
Two live producers disagree on Reza's data: scoreboard "Portfolio LVR **41.3%**" = `/api/portfolio/snapshot` `gearing.portfolioLVR` = `nw.liabilities.total / nw.assets.properties` (`snapshot/route.ts:646,655,1024`) vs properties banner "AVG LVR **40.8%**" = owned-only (`type !== 'RENTAL'`) `Σ loan.principal / Σ currentValue` computed IN THE PAGE (`properties/page.tsx:515-521`). Differences: RENTAL exclusion, loan-principal-vs-total-liabilities basis, and screen arithmetic on the page (SSOT breach).
**Fix (the ruled principle: labels must earn the difference or one producer wins — SSOT says one producer wins):** decide the CORRECT basis (recommend: owned-properties-only, property-secured debt over property value — diagnose whether snapshot's `liabilities.total` includes non-property loans and whether `assets.properties` includes RENTAL) → converge BOTH surfaces on the one snapshot producer, delete the page-side arithmetic, and label the number by its basis ("Portfolio LVR — owned properties"). **D-21:** state in the PR which of the two figures moves and to what, before the code; Ring-3 = Matrix eyeballs both surfaces showing the identical figure on Reza's data.

### C-4 · Cashflow strip: state the rule (changesNumbers: NO)
Today: bare `slice(0, 4)` (`ScoreboardClient.tsx:221`) — Reza has 6 properties, sees 4, no explanation. **Fix (recommended):** render ALL properties (portfolios this size don't need truncation) sorted worst-cashflow-first; if a cap is kept for layout, it must say so ("4 of 6 — view all") and link to the properties page. Test the rule either way.

---

## §D — The MODULE_HOME re-key sweep (exposure; changesNumbers: NO)

The 2026-08-22 flip changed what MODULE_HOME means: it now gates the LIVE v1 scoreboard. Surfaces that used the key to mean "R4 wealth-OS Home family" are now ON. Full inventory from this cut (re-run the grep — `grep -rn "MODULE_HOME" app lib`):
- **`app/dashboard/reports/page.tsx:66`** — the legacy **Financial Overview** report tile keys on MODULE_HOME → it RESURFACED on the reports page at the flip. This tile is exactly what the 2026-08-19 ruling ("hide legacy report tiles", relayed on #1595) covers.
- **`app/api/money-flow/route.ts:22`** — the old Home's Sankey feed, now an OPEN api returning the household money-flow story; nothing kept consumes it (the scoreboard doesn't; HomeClient is unmounted).
- **Correctly ON at the flip (no change):** `app/dashboard/page.tsx` (the scoreboard itself), trailNav + mobile tab 'Home' entries.

**Tasks:**
1. Re-key **Financial Overview** and **`/api/money-flow`** to the module that owns their CONTENT family and stays hidden until its R-stage (financial-overview = whole-position wealth-OS story → recommend `MODULE_CFO` (R4); money-flow = household story → recommend `MODULE_HOUSEHOLD` (R3)). Hidden ≠ deleted — key changes only. State the choice in the PR for Reza's eyes.
2. Hide the legacy **Tax-Time Report** tile per the standing ruling: it carries NO moduleKey today (`reports/page.tsx:108-116`, always shows) and its generator is the calendar-YTD `contextBuilder` path the Ring-3 FAIL condemned (counts salary/ATO-refunds/gifts as taxable income; disagrees with the D-12 pack by $271,546 on the same data). Key it to `MODULE_TAX` (R2 — it returns only when the tax family does, if ever). The D-12 pack export card is UNTOUCHED — it is the product.
3. Add the guard: extend the dead-link/registry test family so a tile/nav/API keyed to a module whose MEANING is stage-specific gets caught at re-key time — minimum: a test asserting reports-page tile keys match an explicit expected map, so a future flip can't silently resurface a legacy tile again.

---

## §E — M2.5 close-out + plan/doc writes (same PR, §0 law)

1. **M2.5:** apply the MON-131 five-condition "done" audit to the kept quantities (the ledger owns the mechanics — `docs/implementation/MON-131_TRANCHE_LEDGER.md`), confirm the census ratchet is green at HEAD, and tick M2.5 in the plan with the evidence line. Its Ring-3 precondition is satisfied (pack-fix PASS 2026-08-22, #1601).
2. **Plan writes in the SAME PR:** tick/annotate the boxes this PR closes (M2.5; M3.4 punch-list items as they land; §5 rows: replace "(to register)" with the assigned MON numbers; MON-168/169/170 row → registry-flip done) · cursor (Last session, Next action → "Matrix: M2.2 T2 Ring-3 + M2.7 gate review; Reza: data-cleanup runbook from MON-18x-f") · one §9 session-log line.
3. **PR body:** §20.6 tri-axis + §16.5 doc-sync blocks; `changesNumbers` flag per the cut above; D-21 expected-movement block for §B and §C-3.

---

## Out of scope for this brief (do NOT touch)
The M3.1 full ATO-heading pack restructure (only the labelling opener §B is in) · M3.2 nudges · M3.3 CSV export · anything M4 (D-18 HOLD) · the data cleanup itself (MON-18x-f is register-only) · MON-162 sessions (parked P-3/P-5) · hidden-module work of any kind (D-20).

## Ring-3 handout (Matrix runs after merge + deploy)
1. Fresh FY2025-26 pack export → §B predictions hold (totals byte-identical; labelled>0; identity holds; atoLabels populated with rental-schedule lines).
2. Scoreboard on Reza's data: EOFY tile leads with FY2025-26 not-ready count; intake tile shows a number; LVR identical on both surfaces at the predicted figure; strip shows all 6 (or states its rule).
3. Reports page: Financial Overview + Tax-Time tiles GONE; pack card untouched; `/api/money-flow` 503s.
4. PASS flips the §A punch-list issues + MON-18x-e VERIFIED; then Matrix proceeds to M2.2 T2 Ring-3 and the M2.7 gate review.
