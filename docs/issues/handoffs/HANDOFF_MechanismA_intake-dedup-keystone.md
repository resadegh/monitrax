# CODE BRIEF (Fable 5) — Calc-SSOT Wall Mechanism A: intake dedup keystone (MON-084/085/074/076)

**Paste into a fresh Claude Code session on FABLE 5** (intake/reconciliation — subtle, touches declared tax gross). This is the **last unbuilt Calc-SSOT Wall keystone**: one signature-based upsert at intake so reconcile/import UPDATES the canonical row instead of minting a duplicate. Sibling of the intake-integrity wall (MON-078 `classifyIntake`). Incremental — no redesign.

## 0. Boot ritual + the hardened guardrails (FIRST, no exception)
1. `git clone`/`pull` resadegh/monitrax → main → pull. Pin HEAD; cite `file:line` at that HEAD; re-verify anchors live (lines drift).
2. Read `STATE.md` → `CLAUDE.md` (Part 0 laws, §12.2.1 SSOT, §12.11 destructive-write approval, §20.6/§20.7 self-review, §21.2.2 neo-sync) → `MATRIX_FIX_DISCIPLINE.md` (8 gates) → **`docs/architecture/CALC_SSOT_WALL.md` "Mechanism A"** (the spec for this work) → `INTAKE_INTEGRITY_GUARDRAIL.md` (MON-078) → `FIX_PROTOCOL.md`.
3. STEP 0 = holistic census (see below) BEFORE any code. Four lenses.

## The defect — Mechanism A (mint instead of update), from CALC_SSOT_WALL.md — re-verify each anchor live
- **SALARY/OTHER income has NO reconcile reuse guard.** `app/api/transactions/[id]/link/route.ts` reuses only for `RENT/RENTAL && propertyId`; everything else **mints** (create branch ~`:453-474`), `type` defaults to `OTHER` (~`:413`). → the live **"Ingeus Australia" ×3** salary fragments (declared + $0/1-txn + $5,547/4-txn), one job. (MON-084, MON-074)
- **Expense near-dup is scoped by `propertyId/loanId/assetId`** (`link/route.ts:681-689`; `lib/…/reconcileSuggestedAction.ts:74-83`) — a "Battery" on HOME vs General are in different candidate sets, never compared → **battery ×3** (MON-085, MON-037 RC-B).
- **Doc-import income dedup is exact `amount+name+type`** (`reconcileSuggestedAction.ts:89-101`) — a declared row and its reconciled twin never match → mints. Manual `POST /api/income` + onboarding `complete` have no reuse convergence.

Live symptom: income page shows **"11 rental sources"** + tax rolls up **21 income sources** — inflated by these fragments; the declared tax gross ($404,338) rides on them.

## STEP 0 census (mandatory, record in the registry entry) — distinguish real duplicates from distinct incomes
Reza has corrected this before: **Cienna PM Trust rent (Thornlands) and Ingeus salary are DIFFERENT real incomes — not duplicates.** The true duplicates are *multiple rows of the SAME source* (Ingeus ×3, one battery split ×3). So: enumerate every income/expense row live, group by (type, normalised name/employer/merchant, ownerEntityId), and mark which groups are genuine same-source duplicates vs distinct sources that merely share a payer. **Only genuine same-source groups converge.** Ambiguous → flag for Reza, never auto-merge.

## The fix — PART 1: the guardrail (prevent NEW mints — the safe keystone, ship first)
Extend the intake classifier (`lib/intake/classifyIntake.ts`) with a **source-signature reuse policy** = `(type, normalisedName/employer/merchant, ownerEntityId)` — **NOT scoped to `propertyId`/`loanId`/`assetId`**. Route through it: the link-route income `create` branch, the doc-import income branch, and the expense cross-scope case — so reconciliation takes the **`update` action** (the template at `link/route.ts:831-943`, preserving `budgetedAmount` + `lastReconciled`) against the canonical row instead of inserting. Manual `POST /api/income` + onboarding `complete` converge through the same policy. **One row per real source ⇒ editing it propagates everywhere by construction** (the SSOT chain reaction). No schema change (signature match on existing fields).

## The fix — PART 2: existing duplicates (SEPARATE, Reza-gated — do NOT auto-run)
The guardrail stops *new* mints; the *already-minted* live duplicates (Ingeus ×3, battery ×3) are a **data merge** = a §12.11 destructive/merge operation. Build a **preview-and-confirm merge action** (show the groups + the resulting single row + the net effect on declared gross/tax), but **do NOT execute merges without Reza's explicit per-group confirmation**. Present the preview; Reza approves each. (The Matrix will not run merges either — this is Reza's click.)

## Ratchets (gates 1-3 + 8)
- Ring-0: linking a 2nd deposit to an existing salary/expense stream **updates ONE row (no mint)**; the source count does not grow.
- Ring-1: `lint:source-lock` green; exception count ratchet-down (currently 80).
- Ring-2 golden: a fixture with a declared row + its reconciled twin (same signature) resolves to ONE canonical row; **editing that row changes the income page + tax gross + cashflow identically** (the SSOT propagation test); a distinct same-payer-different-source pair stays TWO rows (no over-merge).
- Neo-sync (gate 8): model the signature-upsert in the **Neomatrix** (intake → canonical row identity) + the reuse invariant; **Neobrain** updated (this IS intake/reconciliation/Phase 54); NeoAudit gets the golden; nothing sandbox-only.

## Cross-surface Ring-3 (gate 4 — Matrix, after Part 1 merges)
Matrix verifies live: linking a new Ingeus deposit updates the one salary row (source count stable); the declared income source count is consistent on income ↔ /cashflow ↔ tax; and (after Reza approves a Part-2 merge) the declared gross + tax move consistently across all surfaces. Run id `VR-___`. Regression guard: current tax $89,287/$142,319, net worth $3,401,782, liquid $301,808 unchanged until a Reza-approved merge deliberately moves the gross.

## Definition of done → handback
PART 1 (guardrail) is a self-contained PR behind CI + green source-lock + the golden; Neomatrix/Neobrain/NeoAudit updated same PR; PR-template checklist incl. Ring-3 run-id; self-scored 10/10 (gate 7). **Reza merges.** PART 2 (merge tool) is a separate PR; its *use* is Reza-gated per group. Then Matrix cross-surface Ring-3.

---
*Prepared by The Matrix. The last Calc-SSOT Wall keystone (Mechanism A), after the Mechanism-B cluster (VR-013→018) and guardrail hardening (#1444). Fable 5 (intake, tax-gross-facing). Guardrail first (safe); existing-duplicate merges are Reza-gated (§12.11). Serves prevention-over-numbers: one fact, one row.*
