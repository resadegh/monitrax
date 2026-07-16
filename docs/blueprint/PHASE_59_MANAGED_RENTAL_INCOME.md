# Phase 59 — Managed Rental Income & Agent-Cost Reconciliation

> **Origin (Reza, 2026-07-16):** *"rental income usually is from the real-estate agent and it is after the expenses… when a user identifies e.g. $650/week rent but the reconciliation comes at $1,100/fortnight, the $200 difference is the expenses. This is useful for the tax deductions."* Plus: *"when reconciling, highlight the declared-vs-actual difference and confirm with the user that it looks like property management + expenses — check your statement — and the user confirms."*
>
> **TRAIL stage:** Track (My Accounts / Income reconciliation) → Optimise (tax deductions). **Domain:** Neobrain (reconciliation/perception) + tax engine (deductions). **Status:** design (this doc). Build queued — sequenced in §9; enters `02_UP_NEXT.md`.
> **This is a UI/UX change** → conforms to `docs/design/MONITRAX_STITCH_DESIGN_SYSTEM.md` (§8) and carries the §20.6 10/10 gate (§11).

---

## 1. Problem
An investor's rent almost never hits the bank as gross rent. The property manager collects gross, deducts their costs — **management fee, letting fee, repairs they arrange, water/council** — and disburses the **net**, often on a **different cadence** than the rent (weekly rent → fortnightly/monthly disbursement). Monitrax has no model for this, so today it must either (a) record the **net** disbursement as income — understating gross **and** silently dropping the deductions — or (b) let the user declare gross with **no way to capture the agent's costs**. Both are wrong for tax.

## 2. Why it matters (four-lens — §0.1)
- **Financial adviser:** ATO requires **gross rent declared as income** *and* the agent's costs **itemised as deductions** — not a netted figure. Capturing the gap unlocks legitimate deductions (management fees, repairs) the user is otherwise missing: real money back. Caveat: some agent costs are **capital** (CGT cost base), not immediate — must not be silently lumped.
- **Architect:** this is a **data-model gap, not a number bug**. Model *managed rentals* once and a whole class disappears (same philosophy as the intake-integrity wall).
- **Graphic designer:** the confirm must be **one calm question**, not another pill-storm (Phase 55's one-status rule).
- **Behaviour psychologist:** users avoid finances; a single *"does this look right?"* at the moment of reconciliation, with a sensible default and a learn-once memory, gives cognitive load **back** and builds trust.

## 3. The model — gross-integrity + suggest-and-confirm
Two rental modes: **Direct** (bank credit = gross rent) and **Managed / net-disbursed** (declared gross + disbursement cadence; net credit reconciles to `gross − agentCosts`; the gap is a deductible expense). **Statement-first, reconciliation-fallback:**
- **Tier 1 (statement):** upload the agent's rental statement → parse gross + itemised, classified deductions + net; reconcile the net to the bank credit.
- **Tier 2 (fallback, no statement):** match the net disbursement to declared gross for the period (cadence-normalised) → the gap becomes a single **"Agent management & property costs"** deductible, tagged *estimate · un-itemised*, with a nudge to upload the statement.
**Learn-once per stream** (silent auto-derive next time) + **anomaly re-confirm** (gap deviates materially → likely a repair → re-prompt/itemise).

## 4. Data model (Prisma — §12.11 migration; Reza approves)
- `Income`: add `rentalMode Enum(DIRECT|MANAGED) @default(DIRECT)`; gross amount + frequency reuse existing fields; `managingAgentName String?`.
- Derived deductible `Expense`: category `PROPERTY_MANAGEMENT`, linked to the rental stream + property, `derived=true`, `source Enum(RECONCILIATION|STATEMENT)`, `itemised Boolean`. (For STATEMENT source, one row per statement line item with its own category.)
- `AgentDisbursementRule` (learn-once): `{ incomeStreamId, expectedGrossPerPeriod, cadence, baselineGapAmount, tolerancePct }`.
- **ONE canonical producer** of the gap/deduction: `reconcileManagedRental()` — never a second (§12.2.1).

## 5. Apply to Neomatrix (Phase 53 — build-gated, Model step §21.2.1)
Added **in the engine PR** (nodes reference real `file:line`; `neomatrix:check` must pass):
- Nodes: `engine.rentalReconciliation.reconcileManagedRental` (kind engine, domain property/tax); `input.Income.grossRent`, `input.Transaction.agentDisbursement`, `number.rental.agentCostDeduction`, `number.rental.grossDeclared`.
- Edges: `grossRent` + `agentDisbursement` → `reconcileManagedRental` → `agentCostDeduction` → **feeds** `engine.taxPositionCalculator` deductions; `grossDeclared` → income. Re-pin `masterFinancialService` / `taxPositionCalculator` anchors same PR.

## 6. Apply to NeoBrain (Phase 54 — perception)
New `lib/neobrain/rentalStatement.ts`: parse an uploaded agent statement (PDF) → `{ grossRent, lineItems:[{label, amount, category, capitalVsImmediate?}], netDisbursement, period }`, via the existing document-intelligence + **grounding validator** (`lib/neobrain/grounding.ts` — never emit a figure not on the statement). Output feeds `reconcileManagedRental` (itemised path). No statement → the §3 Tier-2 fallback derives the single gap.

## 7. Test through NeoAudit (Part 23 — the proof)
- **R0 fixtures:** managed rental (gross weekly, net fortnightly, fixed gap) → deduction = `gross − net`; **Float === Decimal** parity.
- **R1 SOURCE-LOCK:** exactly ONE producer of the agent-cost deduction; a second fails the build (§12.2.1 ratchet).
- **R2 Golden Household:** add a managed-rental property (gross $650/wk, net $1,100/ft) → gross income correct, agent-cost deduction correct, tax position consistent across Tax / CFO / property surfaces.
- **R3 Chrome (Matrix, live):** the confirm card fires on a real disbursement; the derived deduction appears in Total Deductions; gross income unchanged; no double-count.
- **NEW detector D4 — "rent-gap"** (joins the intake-integrity NeoAudit suite): rental stream where net < gross materially but **no agent-cost expense** captured → flag *"you may be missing management-fee deductions — upload your rental statement."*

## 8. UI / UX — Stitch design system (SSOT: `docs/design/MONITRAX_STITCH_DESIGN_SYSTEM.md`)
The **suggest-and-confirm reconciliation card** (fires when a disbursement reconciles below declared gross):
- **Card:** `surface-container-low` (#FAF8F3) on `outline-variant` border, 16px radius; `headline-sm` navy (`on-surface` #0B1220) for the one question.
- **The gap is a WIN, not a loss:** show it in `primary` **emerald** (#16A34A) — "$200 tax-deductible" — never `error` red (red is destructive/critical only).
- **Actions:** primary *"Yes — record as management & costs"* = emerald filled (`primary`/`on-primary`); *"Upload statement"* = navy ghost/outline (`secondary`); *"Something else"* = slate text (`tertiary`).
- **Learn-once:** a Stitch switch — *"Apply to future [agent] disbursements for this property."*
- **Anomaly re-confirm:** `trail-amber` (#F59E0B) chip at 10% bg — *"higher than usual — a repair?"* (amber = attention, not error).
- **Warm-words:** "taken out before it reached you", "tax-deductible", "does this look right?" — never jargon. Show the math transparently (period gross vs net = gap).
- **One derived status per row** (Phase 55 rule): the reconciled row reads *"Rent — $1,100 net · $200 costs"*, not competing pills.
- Actual screens are generated in the **Stitch project (design SSOT)** during build; realign the design docs in the same PR (§ design-SSOT rule).

## 9. Build plan (Code · one PR per step · handback to Matrix for the Ring-3)
1. **Data model** (§4) + migration — *Reza approves the schema*.
2. **Engine** `reconcileManagedRental()` (ONE producer) → wire into the canonical tax position deduction + read paths; **Neomatrix Model step same PR** (§5). *(Fable 5 — tax core.)*
3. **Reconciliation suggest-and-confirm** (§3, §8) — the card, learn-once rule, anomaly re-confirm; Stitch UI. *changesNumbers → draft PR → Matrix Ring-3.*
4. **NeoBrain** statement parser (§6) → itemisation upgrade.
5. **NeoAudit** R0/R1/R2 + **D4** detector + Golden-household managed-rental fixture (§7).
6. **R3 Chrome (Matrix)** → VERIFIED → re-baseline.
Each PR ships **control + ratchet together**; money-touching steps hand back to the Matrix.

## 10. Compliance boundary (AFSL / tax — standing check)
Information + maths only. The card **surfaces** a likely deduction and its amount; it does **not** rule on **immediate-vs-capital** deductibility — that's the statement / a registered tax agent. Copy stays *"usually deductible — confirm with your statement or tax agent."* No product, credit, or tax advice.

## Plain trio
- **issue:** "Rent from your agent arrives after their fees are taken out, so Monitrax couldn't see your real rent or claim those fees."
- **fix:** "Record your gross rent as income and capture the agent's cut as a deductible cost — confirmed by you, itemised from your statement."
- **check:** "When a rent deposit lands below your declared rent, Monitrax asks if the gap is management/costs; you confirm, and it appears in your deductions."

## 11. §20.6 gate (self-score — honest)
**Document 10/10** (four-lens; Stitch tokens applied; SSOT single-producer; Neomatrix/NeoBrain/NeoAudit application specified with the build-gated Model step). **Requirements 10/10** (gross-integrity + itemised deductions + confirm UX + learn-once/anomaly + the D4 guardrail). **Logic 10/10** (gap = `gross − net`, cadence-normalised; one producer; capital-vs-immediate correctly deferred to statement/agent). **Coverage boundary:** this doc SPECIFIES the feature + build/test plan; it does **not** itself build or verify — that is the §9 PRs and the R3 Ring-3. No live number changes from this doc.

---

## Canonical cross-references to apply (Code session — large/build-gated files)
- `docs/00_INDEX.md` → add a Blueprint (Phases) row for `PHASE_59_MANAGED_RENTAL_INCOME.md`.
- `docs/implementation/02_UP_NEXT.md` → add the workstream (📋 queued): "Phase 59 — Managed Rental Income & Agent-Cost Reconciliation" with the §9 sequence; bump the hub **Last updated**.
- `docs/blueprint/MASTER_BLUEPRINT.md` §8 roadmap → one line under Mid/Long-term.
- `docs/issues/ISSUES.json` via `issues:raise` → feature issue **MON-079** (area rental/tax, high, changesNumbers true), tracker Phase 59.
- Neomatrix nodes/edges (§5) added in the **engine PR**, not standalone.
