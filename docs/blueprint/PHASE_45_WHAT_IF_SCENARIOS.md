# Phase 45 — "What If?" Scenarios Surface

**Status:** 🟡 SPEC (workstream `0·WI`)
**Created:** 2026-06-01
**Owner:** Reza (direction + visual sign-off) + Claude (engineering + Stitch design + four-lens review)
**Workstream:** `IMPLEMENTATION_PLAN.md` → `0·WI`
**Anchors:**
- `CLAUDE.md` §0 (advisory mindset — four lenses), §12.2 (SSOT), §12.3 (single calc engine), §12.14 (Phase 41E reform-awareness), §14 (TRAIL + warm words), §18 (Stitch-first)
- `docs/IMPLEMENTATION_PLAN.md` Up Next row 67 (Phase 45 brief), row 69 (Q-DEC), Q-HOOK-AFSL (AFSL pre-review)
- `docs/blueprint/PHASE_46_WEALTH_CHECK_HOOK.md` (sibling public-surface — same engines)
- `lib/cfo/scenarios/` (Phase 40 deterministic engines — 4 of 5 levers already live)
- `lib/cashflow/` + `lib/tax-engine/` + `lib/calculations/` (the composed engines)

---

## 1. Why this phase exists

Reza decision 2026-05-24: "What If?" is the **wedge feature for the wealth-builder ICP** (Q-ICP-1, also 2026-05-24). The mass-affluent integration-debt persona doesn't get value from "track your spending" — they already have 5+ levers in motion (mortgage, investments, super, salary, debt) and the question they can't answer alone is *"what happens to my picture if I move one of them?"*

No AU PFM answers that. Every existing app shows you the **current** picture. Monitrax already computes the **per-entity** picture via Phase 44 + Phase 41E. Phase 45 adds the **counterfactual** picture: same engines, one input changed, 10-year trajectory composed.

The wedge is real because:
1. The five levers map directly to the conversations advisers have with mass-affluent clients (refinance, salary-sacrifice, sell IP, extra repayments, buy IP).
2. Each lever's output is structurally information, not advice — the AFSL boundary stays intact (Q-HOOK-AFSL pre-review 2026-05-24).
3. The composition reuses canonical engines (CLAUDE.md §12.2 / §12.3) — no parallel calc paths to maintain.

## 2. Scope — what ships in v1

| Lever | Existing engine | New work |
|---|---|---|
| (a) Refinance loan X at rate Y | `lib/cfo/scenarios/refinanceLoan.ts` ✅ | UI input + 10-yr composer wrap |
| (b) Salary-sacrifice $X/month to super | **NEW** — composes `lib/tax-engine/divisions/*` super logic | New `salarySacrificeToSuper.ts` scenario + concessional cap headroom guard |
| (c) Sell property X at $Y | `lib/cfo/scenarios/sellProperty.ts` ✅ | UI input + 10-yr composer wrap |
| (d) Pay $X extra/month on debt X | `lib/cfo/scenarios/payDownLoan.ts` ✅ | UI input + 10-yr composer wrap |
| (e) Buy investment property at $Y with $Z LVR | `lib/cfo/scenarios/addInvestment.ts` ✅ (close cousin) | Refit for property-specific inputs (rental yield, vacancy assumption) + 10-yr composer wrap |

**The new code is small:** one scenario function (salary-sacrifice) + one composer (`tenYearProjection.ts`) + the React UI.

## 3. Out of scope for v1

- Multi-lever stacking ("refinance AND sell IP AND salary-sacrifice")
- Goal seeking ("how much salary-sacrifice gets me to $X by 65")
- Scenario save / share
- Phase 45.1 contextual entry points (separate PR after v1 ships)

## 4. Architectural rules (CLAUDE.md §12.2 + §12.3 + §0.4)

- **ZERO new calc engines.** Every lever computes via existing primitives. New code is composition + UI only.
- **Pure functions in the scenario layer.** No I/O, no globals. `runScenario(type, ctx, params)` → `ScenarioResult` shape (matches Phase 40 contract).
- **10-year composer = a loop over per-year cashflow + tax position.** Inputs: scenario delta on the user's snapshot; outputs: 10 × `{ year, netWorth, cashflowDelta, taxDelta }`.
- **Snapshot defaults from `getMasterFinancialSnapshot()`.** Don't ask for data already on file — pre-populate the slider with current state, let the user move it.
- **AFSL discipline (Q-HOOK-AFSL pre-review 2026-05-24):**
  - "If you refinanced at 5.5%, your monthly drops by $X" — NEVER "you should refinance"
  - "This closes part of the gap" framing — partly-closable preserves self-efficacy (Klontz 2011)
  - Concessional cap headroom check on salary-sacrifice — never silently model an illegal contribution
  - General Advice Warning footer on every lever output (s949A)
  - No product names ever; no broker recommendations
  - Assumptions panel collapsed by default but always present
- **§12.14 Phase 41E reform-awareness:** the salary-sacrifice scenario MUST read regime status per FY via the established `taxYearConfig` dispatch. If the FY is post-commencement on a measure that affects super, surface the verbatim notice (mirrors the Wealth Universe Money Flow lens pattern).
- **Editorial palette (Reza decision 2026-06-01):** `/dashboard/cfo/what-if` matches the rest of `/dashboard/cfo` — warm-ivory + emerald + navy ink. NOT a cosmos-style dark surface.

## 5. Q-DEC is the gate

Reza decision 2026-06-01: Phase 45 v1 ships AFTER Q-DEC (Float→Decimal) lands. Rationale: 10-year horizons compound Float error to visibly-wrong cents; the entire product promise is "regulator-grade accuracy, every number traceable"; pre-revenue is the cheap time to fix the precision foundation.

Sequencing:
1. ✅ **Q-DEC PR 1 — additive Decimal schema (core 10 models) — MERGED PR #974 (2026-06-03)** — ~45 columns on Property/Loan/Account/Income/Expense/InvestmentAccount/InvestmentHolding/PurchaseLot/SuperannuationAccount/Asset.
2. 🟡 **Q-DEC PR 1.5 — supplementary Decimal columns (7 models, this PR's follow-up) — IN FLIGHT** — ~23 columns on Transaction/InvestmentTransaction/CapitalGainEvent/CapitalGainLotAllocation/RecurringPayment/SmsfAnnualReturn/SuperContribution. Phase 41E models already Decimal; TaxPosition cache deferred.
3. Q-DEC PR 2 — engine adapter layer
4. **Phase 45 Stitch design pass begins HERE in parallel with Q-DEC PR 3** (so Reza can iterate the UI design while engine cutover proceeds)
5. Q-DEC PR 3 — engine-by-engine cutover
6. Q-DEC PR 4 — Float drop (after 7-day parallel-run)
6. Phase 45 PR 1 — engine composition (salary-sacrifice scenario + `tenYearProjection.ts`)
7. Phase 45 PR 2 — UI port (`/dashboard/cfo/what-if` + 5 lever-detail screens)
8. Phase 45.1 — contextual entry points (separate PR)

## 6. Stitch design pass (CLAUDE.md §18)

Two canonical screens at minimum:

### Screen A — Lever picker (`/dashboard/cfo/what-if` home)

- Header: "What if?" + one-line explainer ("See how a single move could change your 10-year picture")
- 5 lever cards in a 2 × 3 grid (one empty cell for "More coming" or a help affordance)
- Each card: glyph + lever title + 1-line description + "Open →"
- Footer: AFSL Why-no-recommendations explainer (links to General Advice Warning page)

### Screen B — Lever detail (`/dashboard/cfo/what-if/[lever]`)

- Breadcrumb: ← What if? · {Lever name}
- Two-column layout (md+): left = inputs, right = result
- Left column:
  - Entity picker (only when applicable — e.g. "Which loan?")
  - Slider(s) for the lever input(s) with current value pre-filled from the snapshot
  - Affordances for sensible defaults (e.g. "Use current market rate")
- Right column:
  - Headline metric (e.g. "Monthly savings: $213")
  - 10-year net-worth trajectory chart (sparkline-style, NOT a busy candle chart — premium reference: Wealthfront Path, Apple Health trend cards)
  - Tax-position delta block (CGT exposure / cap impact / Div 7A risk where relevant)
  - "How we computed this" → expands assumptions panel
- AFSL footer (always visible)

### Reference set (designer lens)

- Apple Numbers what-if mode — focused calculator UI
- Wealthfront Path — projection chart with assumptions tucked under
- Stripe Atlas calculator — input-sliders + premium result card
- Apple Health trends — sparkline + delta + context

### Stitch project ID

Reuse the canonical Monitrax Stitch project `1859462351962811110` per CLAUDE.md §18.3.

Files committed per §18.4:
- `.stitch/designs/what-if-lever-picker.{html,png}` — Screen A
- `.stitch/designs/what-if-lever-detail.{html,png}` — Screen B
- Additional iterations as `what-if-*-v2.{html,png}` etc.

### Editorial-palette guard rail

Stitch's default design system trends cosmos-* dark. For Phase 45 the React render MUST use the editorial-* tokens (per CLAUDE.md §18.2 internal-app rule + Reza's editorial-palette decision). The Stitch prompt explicitly specifies "Monitrax editorial palette: warm-ivory bg, navy text, emerald accent, 1px hairline dividers, no dark surfaces." Mockups download as HTML for visual sign-off; React port references `08_BRAND_UI_DESIGN.md` for token names.

## 7. Composed engines — call graph

```
runWhatIfScenario(type, snapshot, params)
  ├─ Year 1 — runScenario(type, ctx, params) → existing Phase 40 scenario
  │     └─ returns { cashflowDelta, taxDelta, warnings, oneYearDelta }
  └─ Year 2-10 — tenYearProjection(snapshot, delta)
        ├─ per year: apply delta → cashflowOrchestrator() → masterTaxPosition()
        ├─ compose: netWorth[y] = netWorth[y-1] + savings[y] - taxPaid[y] + assetGrowth[y]
        └─ returns [{ year, netWorth, cashflowDelta, taxDelta }, ...]
```

The 10-year composer is the new piece. Per Reza decision, the existing scenarios stay 1-year impact only (they're shared with the Phase 40 AI advisor surface, which uses 1-year impact for its narration). Phase 45 wraps each with the 10-year composer.

## 8. Risks (load-bearing)

| Risk | Mitigation |
|---|---|
| Lever inputs sparse on user's snapshot (e.g. no rental yield data) | Sensible defaults from market median + clear "we assumed X" copy in the assumptions panel |
| 10-year projections compound assumption error | Assumptions panel surfaced (not hidden); explicit "this is a projection, not a forecast" copy; lever output never says "you will have" — always "if your assumptions hold, this trajectory would land at" |
| `Float` precision compounds over 10y | **Q-DEC migration runs first** (Reza decision 2026-06-01) |
| Info overload at 5 levers + sliders + chart + assumptions | Progressive disclosure: lever picker → focused detail screen (one lever at a time) |
| AFSL line drift | All copy reviewed against Q-HOOK-AFSL framework; "people-like-you-and-a-pattern" framing; General Advice Warning footer; no product/broker names |
| Salary-sacrifice scenario silently models illegal contribution | Concessional cap headroom check at function entry; returns `UNCOMPUTED` + warning when over-cap (mirrors Phase 41E `trustMinimumTax.ts` pattern) |

## 9. Acceptance criteria

- [ ] All 5 levers render at `/dashboard/cfo/what-if/[lever]` with snapshot-defaulted inputs
- [ ] Each lever returns: year-1 cashflow impact + 10-year trajectory + tax-position delta
- [ ] Assumptions panel present on every lever (collapsed by default)
- [ ] General Advice Warning footer on every lever output
- [ ] Salary-sacrifice scenario returns `UNCOMPUTED` when input exceeds concessional cap headroom
- [ ] No new calc engine introduced (every output traces to existing primitives)
- [ ] Editorial palette throughout (no cosmos-* tokens on internal surface)
- [ ] Stitch designs committed to `.stitch/designs/what-if-*.{html,png}` BEFORE React port begins
- [ ] §12.14 reform-awareness applied to salary-sacrifice (FY-aware regime classification)
- [ ] All numbers traceable to canonical engine output via Q-DEC adapter layer
- [ ] No `Float`-derived projection numbers cross the API boundary (post Q-DEC)
- [ ] Tests: scenario contract tests + 10-year composer determinism tests + concessional-cap-guard tests

## 10. Open questions for v1

(none yet — Reza locked in palette + scope + Q-DEC sequencing via AskUserQuestion 2026-06-01)

## 11. Doc-sync (CLAUDE.md §16 — for every PR in this workstream)

Each PR MUST update:
- `IMPLEMENTATION_PLAN.md` → workstream `0·WI` phase checkbox + Last touched
- `docs/changelog/CHANGELOG_YYYY_MM_DD.md` → session entry
- This file (`PHASE_45_WHAT_IF_SCENARIOS.md`) when scope/architecture clarifies
- `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §13.1 if salary-sacrifice scenario adds a new consumer of the reform discipline (probable)
- `docs/architecture/06_UI_UX_FOUNDATION.md` if the lever-picker / detail-screen patterns become reusable
