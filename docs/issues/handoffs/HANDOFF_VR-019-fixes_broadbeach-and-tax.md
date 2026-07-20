# CODE BRIEF (Fable 5) — VR-019 fixes: Broadbeach rent cross-surface inflation (item 16, Sev-1) + tax one-off Other income (item 19)

**Paste into a fresh Claude Code session on FABLE 5** (both are tax/cashflow-facing). Two fixes from the VR-019 Ring-3. **Fix 1 first — a live Sev-1 (a number is ~4× wrong and corrupting the property's tax result).** Incremental, single-producer — no redesign.

## 0. Boot ritual + hardened guardrails (FIRST, no exception)
1. `git clone`/`pull` resadegh/monitrax → main → pull. Pin HEAD; cite `file:line`; re-verify anchors live (Reza's data is in flux — read the CURRENT stored row values before judging).
2. Read `STATE.md` → `CLAUDE.md` (Part 0 laws, §12.2.1 SSOT, §20.6/§20.7 self-review, §21.2.2 neo-sync) → `MATRIX_FIX_DISCIPLINE.md` (8 gates) → `CALC_SSOT_WALL.md` → `docs/verification/runs/VR-019.md` (the evidence).
3. STEP 0 holistic map for each fix before code. Four lenses.

---

## FIX 1 — Broadbeach rental inflated ~4× (item 16 · Sev-1 · tax-facing) — DO FIRST
**Evidence (VR-019, live prod):** Broadbeach **property detail** shows rent **+$11,328/mo, annual rent $135,941, yield 22.66%, cashflow $116,460/yr, tax result $115,502/yr** — while the **income page** shows the SAME stream at **$2,515 avg/mo** (declared **$2,947**, frequency **Weekly**, 2 linked payments). The "Cashflow rhythm" still shows the TRUE **"WEEKLY Rent −$680"**. So two surfaces read the same row and disagree ~4×.

**STEP 0 census (mandatory):** read the Broadbeach rental income row's stored `(amount, frequency, weeklyAnchor?)`. Enumerate EVERY producer of property rental income / annual rent / yield / property cashflow — `lib/calculations/propertyCashflow.ts` (`computePropertyCashflow`), `masterFinancialService` rental aggregation, the property detail/list surfaces, and the income-page avg/net producer — and record HOW each annualises the declared rent (which `frequency` multiplier each applies).

**Root-cause hypothesis (confirm, don't assume):** the property cashflow producer annualises the declared amount with a DIFFERENT frequency interpretation than the income page — a monthly-magnitude declared amount ($2,947) paired with a **Weekly** frequency gets ×~52 on the property surface (→ ~$135k/yr) while the income page reads it as monthly ($2,947 → $2,515 avg from actuals). Classic Mechanism-B recompute divergence, compounded by an amount/cadence data mismatch.

**The fix (SSOT single producer + guard):**
1. **ONE canonical rental-income figure** feeds BOTH the income page and the property detail. The property surface must NOT re-annualise independently — it reads the same monthly/annual rent the canonical income/cashflow producer emits. All frequency→monthly/annual conversion goes through the canonical `toMonthly`/`toAnnual` (`lib/utils/frequencies.ts`), never a surface-local ×52/×12.
2. **Plausibility guard (reuse the MON-091 detection):** a rental whose `amount × frequency` implies an implausible yield (e.g. > ~15%) or whose declared magnitude mismatches its cadence is **flagged** ("This amount looks monthly — is the cadence right?"), the way the income page already flags "Payments look weekly" — never silently ×4'd.
3. **Data note (Reza):** his flux edits likely set Broadbeach to declared $2,947 + Weekly. The code fix (one producer + guard) is the durable fix; Reza also corrects the declared row to a consistent basis ($680/week OR $2,947/month). The guard means a mis-declared row is surfaced, not silently inflated.

**Ratchet:** golden — a Weekly-declared rental amount X: property annual rent == income annual == X annualised ONE canonical way; a monthly-magnitude amount on a Weekly cadence trips the plausibility flag. **Cross-surface Ring-3:** property detail rent / yield / cashflow == income page avg == tax rental line, for Broadbeach and every rental.

---

## FIX 2 — tax "Other Income" pulls one-off non-assessable receipts into the gross (item 11/19 · tax correctness) — after Fix 1
**Evidence:** tax → Income tab **"Other Income" = $10,300**, which includes one-off **ATO receipts** (~$10,050 — `Ato Ato002000023189359` $9,098 + `Ato Ato001100022493651` $952) + Col/Service NSW — while the income page's "Other" group is **$0/mo** and salary one-offs (Newsha gifts) are correctly EXCLUDED from the salary gross. Two problems: (a) **ATO tax refunds are not assessable income** — counting them overstates taxable income; (b) **inconsistent one-off treatment** (salary one-offs excluded, other one-offs included).

**DECISION (Reza — confirm before merge):** the canonical rule for one-off income in the tax gross. **Recommended:** tax declared gross = **assessable income only** = recurring declared income + genuine one-off ASSESSABLE receipts (counted once, never annualised); **EXCLUDE** non-assessable receipts — ATO refunds, internal transfers, loan/director-loan drawdowns, reconciliation artifacts. Classification via the intake classifier (`classifyIntake` / MON-078 keystone).

**The fix:**
1. Classify ATO refunds + internal transfers + loan movements as **non-assessable** → excluded from the tax gross (and ideally not shown as "income" at all).
2. Make one-off income treatment **consistent and labelled** across the income page and the tax engine — the tax income aggregator applies the SAME one-off rule as the salary side.

**Ratchet:** golden — an ATO-refund one-off contributes **$0** to taxable income; a genuine one-off assessable receipt counts **once** (not ×12). **Cross-surface Ring-3:** tax "Other Income" == the assessable subset; income page ↔ tax consistent.

---

## Guardrails for both (gates 1-8)
- Single canonical producer per value (rental rent; assessable income); no surface re-derives. `lint:source-lock` green, exceptions ratchet-down.
- **Neo-sync (gate 8):** Neomatrix models the canonical rental-income producer + the assessable-income classification; NeoAudit gets both goldens; Neobrain updated if the intake classifier is touched (Fix 2); nothing sandbox-only.
- **10/10 self-review** before presenting; Fix 2's rule confirmed by Reza.
- **Reza merges** (both tax-facing, number-changing). Then Matrix cross-surface Ring-3 (`VR-___`): Broadbeach rent identical on property ↔ income ↔ tax at the correct ~$2,515–$2,947/mo basis; tax Other Income excludes the ATO refunds; regression guards (loan $1,191, liquid $301,808, one-off labels) unchanged.

---
*Prepared by The Matrix from VR-019 (#1471). Fix 1 = Sev-1 (live 4× rent inflation + tax corruption); Fix 2 = tax-correctness (ATO refunds aren't assessable) + one-off consistency. Fable 5, incremental single-producer, no schema change.*
