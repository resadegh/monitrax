# CODE BRIEF (consolidated) — Household income attribution + per-person tax + Ingeus dedup + reconcile-frequency

**Paste into a fresh Claude Code session. Consolidated, ordered work from Reza's live findings 2026-07-20. Three parts, ordered by dependency. Part A is Fable 5 (tax-facing); Part B is Opus 4.8 (form); Part C is the existing Mechanism-A keystone (#1458 guardrail live + #1459 merge tool). This is prevention + correctness — no redesign.**

## 0. Boot ritual + hardened guardrails (FIRST, no exception)
1. `git clone`/`pull` resadegh/monitrax → main → pull. Pin HEAD; cite `file:line`; re-verify anchors live.
2. Read `STATE.md` → `CLAUDE.md` (Part 0 laws, §12.2.1 SSOT, §12.11 destructive/merge approval, §20.6/§20.7 self-review, §21.2.2 neo-sync) → `MATRIX_FIX_DISCIPLINE.md` (8 gates) → `CALC_SSOT_WALL.md` "Mechanism A" → `INTAKE_INTEGRITY_GUARDRAIL.md`.
3. STEP 0 holistic map before code. Re-census live — Reza's test edits are in flux; do NOT hardcode his current numbers.

## The situation (Matrix live census, 2026-07-20)
Newsha's ONE real Ingeus salary is stored as **three duplicate "Salary Ingeus Australia" source rows** (declared + reconciled fragments; actuals fragment across them: $0/1txn, none, $5,547/4txn). Salary/Wages shows **4 sources / $23,776/mo** = 3 × $4,159 (Ingeus dupes) + "Reza Salary" $11,300. The income aggregator sums all sources → **triple-counts** Newsha's salary; this propagates to My Plan "Money In", cashflow, and the declared **tax gross** (SSOT working — one bad source, consistent everywhere). "Salary Transportservice" is the txn description of Reza's actual salary deposits linked to "Reza Salary" — **not** a separate source. Two more gaps: the income form has **no "who earns this" owner field** (so Newsha's salary rolls onto Reza's tax), and the reconcile/categorise dialog's **"Recurring income" toggle has no frequency selector**.

## Reza's decisions (build to these)
- **Per-person tax: FULL.** Each income is attributed to a household member (Reza or Newsha); the tax engine produces a **separate taxable income + tax owing per person** (correct for individual AU returns). Newsha's Ingeus salary leaves Reza's return.
- Merge groups: **3× "Salary Ingeus Australia" → 1, owned by Newsha.** "Reza Salary" stays (owned by Reza). Merges are **Reza-approved per group** (§12.11) — build the preview, never auto-run.

---

## PART A — Household owner attribution + per-person tax (Fable 5, tax-facing)
A1. **Add an owner/household-member field** to the income model + the Add/Edit Income form AND the reconcile/categorise dialog: "Who earns this?" → the household members (Reza, Newsha, …) from `household-profile`. Default to the primary member, but REQUIRED for SALARY (individual employment income). This is the MON-076 fix — stop defaulting every income's `ownerEntityId` to Reza.
A2. **Per-person tax positions.** The canonical tax producer (`getUserTaxPosition`, the ONE engine from #1449) must group income + deductions by member and emit a taxable-income + tax-owing **per person**. Salary is individual; joint/property income splits per ownership share (already modelled per entity). Surfaces (tax page, /cashflow FY estimate, CFO) show each person's position (and/or a household roll-up clearly labelled), not one merged number that buries Newsha's separate liability.
A3. Preserve the ITAA lineage + AFSL labelling. This is attribution + splitting, not new tax math.

## PART B — Reconcile-dialog frequency selector (Opus 4.8)
B1. In the reconcile/categorise income dialog (the "Batch Categorize / Same Vendor" flow, screenshot: `Recurring income` checkbox with "repeats on the schedule above" but no schedule control), when **Recurring income** is ticked, show a **frequency selector** (Weekly/Fortnightly/Monthly/…) — the income-side sibling of the MON-083 one-off form gap. Persist the chosen cadence; don't imply a schedule that can't be set.

## PART C — Ingeus dedup (Mechanism-A keystone — guardrail live #1458, merge tool #1459)
C1. The **guardrail (#1458)** prevents NEW mints (signature reuse `(type, normalised name, ownerEntityId)`). Confirm it covers the SALARY path (linking a new Ingeus deposit updates the one row; re-adding an existing income 409s). *(Matrix's live behavioural check on #1458 was blocked by a browser-automation glitch, not a code fail — re-verify in code + the golden, and the Matrix will re-attempt live.)*
C2. The **Part-2 merge tool (#1459, Admin → Intake duplicates):** the 3 Ingeus rows must appear as ONE group; the preview shows the surviving single row + its owner (Newsha) + the net effect on declared gross/tax. **Reza approves each group** — no auto-merge. After A1 lands, the merged row carries the correct owner.

## Ratchets (gates 1-3 + 8)
- Ring-0: Newsha's Ingeus salary reads as ONE source everywhere (income ↔ My Plan ↔ cashflow ↔ tax); Salary/Wages total = Reza $11,300 + Newsha's one stream, no 3×. Newsha's salary appears on Newsha's tax position, not Reza's.
- Ring-1: `lint:source-lock` green; exception count ratchet-down.
- Ring-2 golden: (a) two same-signature income rows resolve to ONE canonical row; editing it moves income + per-person tax + cashflow identically; (b) a salary tagged to member B lands in B's taxable income, not A's; (c) a distinct same-payer-different-member pair stays TWO rows.
- Neo-sync (gate 8): Neomatrix models the owner-attributed income → per-person tax lineage + the signature-upsert; Neobrain updated (intake/reconciliation); NeoAudit gets the goldens; nothing sandbox-only.

## Cross-surface Ring-3 (gate 4 — Matrix, after each PR)
After A/B merge + Reza's C2 approvals, the Matrix verifies live: Salary/Wages total correct (no 3×) on income ↔ My Plan ↔ cashflow ↔ tax; Newsha's salary on Newsha's position; the reconcile dialog offers frequency; declared gross dropped by exactly the phantom Ingeus counts (a correction, Reza-authorised via the merge). Run id `VR-___`.

## Sequencing & merge authority
A (owner + per-person tax) → B (frequency) can go in parallel → **then** C2 merges (so merged rows are correctly owned). Each PR: CI + green source-lock + goldens + neo-sync + 10/10 self-score. **Reza merges** all (tax + data). Merges in the tool are Reza's per-group §12.11 click. Matrix runs the cross-surface Ring-3 after.

---
*Prepared by The Matrix from Reza's live findings + a read-only census (2026-07-20). Per-person tax = Reza's decision. Serves the SSOT first law (one fact/one row) + tax correctness (separate individual returns). Incremental within the existing architecture.*
