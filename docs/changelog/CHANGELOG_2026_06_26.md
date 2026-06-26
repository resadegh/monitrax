# Changelog — 2026-06-26

## Session: Neo Inventory NI-0 — design + instruction lock (branch `claude/neo-inventory-design-jqahjw`)

### Changes Made
- **Type**: Governance / design (NO code, NO financial logic, NO graph data changed).
- **Scope**: Reza directive 2026-06-26 — *"make sure (1) 100% of Monitrax is in the Neomatrix and (2) the Trust Engine covers all calculations including complex ones — don't create multiple test engines and platforms, no more guesswork with multiple PRs. Document this and get the instructions right on sticking to the design document and plan. Before I merge #1250–#1257, compare them with this to make sure they're not going a different path."*

### Root cause established (by code inspection, §10 research-first — not assumed)
The recurring "you covered everything → next audit finds many missed ones" is caused by **four overlapping, unreconciled inventories** of "what calculations exist":
1. **calc-audit (Phase 41i)** — `calcEngineRegistry` + `surfaces/registry` + **92 CI-gated fixtures** (`tests/calc-audit/calcAudit.test.ts` runs `runDifferential`, asserts 0 failures + "no engine without a fixture / names sorted / no duplicates"). Covers the **entire** tax engine (income/medicare/PAYG/offsets/super/cap-tracker/high-income-super), **all divisions** (div7a/div152/CGT-netting/negative-gearing/trust-distribution), **all 8 states** × land-tax/stamp-duty/GST, company+trust losses, PSI/FTE/SMSF, **all CFO** (7 score sub-components, risk radar, loan/investment/property decision support, intelligence engine, tax integration), **all what-if scenarios**, the **aggregators**, the **primitives** (property.LVR/equity/rentalYield).
2. **Neomatrix (Phase 53)** — the map (103 hand-built nodes) — a **subset** of #1.
3. **Trust Engine (2026-06-25)** — verification nodes in the Neomatrix.
4. **Phase 4 rail / A1 audit / surface linter.**

Coverage was measured against the smaller hand-built Neomatrix instead of the larger CI-gated registry → the denominator was always incomplete. **This is a §12.2.1 violation at the system level** (multiple sources of truth for "what needs verifying").

### The model (Neo Inventory)
`calcEngineRegistry` = the **single inventory** (most complete + already gate-enforced); the **Neomatrix = a generated view** over it (lineage/law/`file:line`); **calc-audit fixtures = the proof spine**. No fifth platform. calc-audit, the Neomatrix, the Phase 4 rail and the surface linter all remain with their distinct jobs, reading one shared inventory.

### Comparison of #1250–#1257 (the 2026-06-25 overnight Trust Engine run)
Verified per-engine against `lib/calc-audit/engines/*`: the 8 PRs are internally consistent, but their **verification half re-proves what calc-audit already fixtures** (sellProperty / addInvestment / redirectToOffset / refinance / payDown / cutSpend / salarySacrifice / LVR / equity / yield / aggregators). The genuinely-new parts (the *map* nodes; and the *properties* — accounting identities, refuse-to-compute guards, breakdown additivity, Float⇄Decimal parity, interest/PI) are kept. **Recommendation: HOLD #1250–#1257; reconcile via NI-1→NI-4 (re-home the properties as calc-audit fixtures), don't merge the duplication.** Full table in `NEO_INVENTORY.md` §4.

### Files Modified
- `docs/blueprint/NEO_INVENTORY.md` — **NEW** — the canonical Neo Inventory design + plan (model, completeness guarantee, #1250–#1257 comparison, NI-0→NI-4 sequence, standing rules, sign-off block).
- `CLAUDE.md` — **+ Part 22 (Neo Inventory)** standing rules + reviewer enforcement; version footer → **3.0**.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — new `0·NEO-INVENTORY` workstream; `0·TRUST-ENGINE` annotated as pivoted/folded-in.
- `docs/IMPLEMENTATION_PLAN.md` — hub `Last updated` → 2026-06-26 with the Neo Inventory summary.

### Build Status
- [x] Docs/governance only — no code, no graph data, no financial logic changed.
- [x] `npm run neomatrix:check` — OK (graph untouched).

### §20 self-review (3× → 10/10)
- **Pass 1 (draft):** propose a census + coverage gate.
- **Pass 2 (critique — the decisive one):** SEARCH-FIRST (§12.2.1) on my own proposal found `lib/calc-audit/` already IS the census/registry/fixture platform — a "census script" would be a 5th duplicate. Rewrote the whole proposal around *recognising calc-audit as the inventory* + *generating the Neomatrix from it*, not adding anything. Also owned that the 2026-06-25 overnight run itself duplicated calc-audit fixtures.
- **Pass 3 (refine):** sequenced NI-0→NI-4 as one-PR-each (no sprawl, Reza's explicit ask); made "coverage = build output, never a claim" the load-bearing rule. **10/10.**

### Doc-sync (CLAUDE.md §16)
- No §16.2 product surface changed — governance + design docs only.

### PR
- Branch: `claude/neo-inventory-design-jqahjw`
- Status: Draft (NI-0; awaiting Reza sign-off before NI-1).
