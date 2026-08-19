# CODE BRIEF — M3 kickoff: FIX THE PACK + the v1 scoreboard (D-19 tiles)

**For:** a fresh Code session · **Kind:** BUILD + one delicate data-repair design (model routing below).
**Prepared by:** Matrix HQ (Cowork), 2026-08-19 · re-pull HEAD before quoting anything.
**Spec of record:** `docs/strategy/MONITRAX_V1_MASTER_PLAN.md` — the plan wins any disagreement with this brief.
**Why this order (Reza's ruling, 2026-08-19):** the Ring-3 FAIL on #1595 (comment 2026-08-19) proved the D-12 pack — the product — is not fit to hand an accountant: `perProperty: []` on a 387-transaction year, 97.9% of rows silently absent from ATO labels, transfers inside the totals. This fix comes AHEAD of everything else in M3. The scoreboard ships alongside so Reza can SEE the numbers he is testing (D-16/D-19, explicit GO 2026-08-19).

## BOOT FIRST (plan §0)
`CLAUDE.md` → `STATE.md` → the master plan (cursor → §2 D-10…D-21 → §4 M3 → §5) → the Ring-3 FAIL verdict on #1595 → this brief. **Read live, never recall.**

## Laws in force
D-18 (nothing net-new beyond this brief) · D-20 (kept surface only) · D-21 (number-moving fixes authorised — expected movement written FIRST, golden self-diff shows only predicted leaves, Ring-3 on live data closes it, Reza merges). §20.6 + §16.5 blocks in every PR body; plan boxes + cursor updated in the same PRs.

---

## §A — THE PACK FIX (MON-168 · MON-169 · MON-170) — PR-1, the priority

**Scope ruling (Matrix default per D-10 — Reza may override on the PR):** the pack is **property-scoped**. Property-attributable income/expenses/depreciation only; salary, personal spend and transfers are OUT of the headline totals — and the pack **STATES** what was excluded (row counts + dollar totals), because a tax artefact may never lose money silently.

### A-1 · MON-168 — reconcile→link must stamp `propertyId`
Two halves, both required:
1. **Forward fix:** every link-route payload that sets `incomeId`/`expenseId`/`loanId` on `UnifiedTransaction` also stamps `propertyId`, derived from the linked target (income/expense/loan → its property). One resolution helper, used by all 15 payload sites — not 15 copies (SSOT). Batch-link paths included.
2. **Backfill (the delicate half — design first, Opus):** existing linked rows have `incomeId/expenseId/loanId` but `propertyId = null`. Write an idempotent backfill (script or admin-triggered maintenance route) that derives `propertyId` the same way, via the SAME helper. §12.11 discipline: dry-run mode printing counts per property BEFORE any write; report `{examined, stamped, unresolvable}`; unresolvable rows listed, never guessed. **This moves pack numbers — write the expected movement first (D-21): on Reza's FY2025-26, `perProperty` goes from `[]` to one entry per property with linked rows; the run records exact counts.**
3. **Guard:** a test asserting no link path can set a target id without `propertyId` resolution; registry MON-168 → FIXING → the Ring-3 re-run flips it.

### A-2 · MON-169 — transfers out of the totals
`buildTaxPackSummary` consults `isTransfer` (and the loan-repayment convention `actualCashflow.ts:111` already encodes — reuse that predicate, don't reinvent it). Transfers/loan principal move to an informational section with their own count + total; they leave `incomeGross`/`expenseTotal`. Expected movement on Reza's export: the $1,000 transfer exits the totals; loan repayments exit expense totals (state the amount in the PR from a dry run).

### A-3 · MON-170 — nothing silent, ever
Every `continue` in the summary/ATO-label path becomes a COUNTED exclusion. The payload (and PDF/XLSX renderings) gains a reconciliation block:
`transactionsTotal · included · excluded: { noCategory: n/$, noAtoMapping: n/$, transfers: n/$, notPropertyScoped: n/$ }` — **the identity `included + Σexcluded = total` is asserted in code and shown in the artefact.** On Reza's FY2025-26 that surfaces the 379 rows / ~$186k that today vanish. Uncategorised rows point the user at the Housekeeping review page (§B).

### A-4 · Ring-3 re-run (handback to Matrix)
Cut `docs/verification/briefs/RING3_M3_PACK_FIX.md`: same FY2025-26 export, predictions per A-1/A-2/A-3 (exact expected counts from your dry runs — falsifiable, not directional), mustNotMove: the property pages and the legacy generator's fixed rows. **MON-168/169/170 flip VERIFIED only on that verdict.**

## §B — Housekeeping returns with the fix (Reza's switch)
No build unless the sweep listed defects there: MODULE_HOUSEKEEPING is unhidden **by Reza in the admin panel** once PR-1 deploys — it is the confirm surface for the uncategorised rows A-3 now surfaces. Brief task: verify the page renders correctly with the new exclusion counts flowing to it (read-only check), add its nav/tile wiring if the registry needs it. Record the flip + date in the plan.

## §C — THE V1 SCOREBOARD + D-19 TILE REGISTRY — PR-2 (GO given 2026-08-19)
Build exactly to the plan's M3.4 spec (the D-19 block):
1. `lib/dashboard/tileRegistry.ts` — the `TileDef` shape from the plan; visibility law verbatim: `visible = (requires === null || isModuleEnabled(requires)) && !suppressed(id)`; suppress-only toggles; fail-closed.
2. **v1 core tiles (requires: null), kept engines ONLY:** portfolio summary (`/api/portfolio/snapshot`) · per-property cashflow strip (the ONE property cashflow engine) · EOFY-readiness tile (first cut = the A-3 exclusion counts: "N rows aren't tax-ready yet → review") · documents/evidence status (vault counts) · intake queue (unreviewed count). **P-4 stands: no `/api/dashboard/charts` NetWorth reuse.** No wealth-OS widgets; every link targets a KEPT route (the MON-163 guard will enforce it).
3. **Stage tiles registered dark** (tax-position→MODULE_TAX, housekeeping→MODULE_HOUSEKEEPING, etc. per the plan's ladder) — they light themselves when Reza flips modules; housekeeping's tile goes live with §B's flip.
4. Admin "Dashboard tiles" section per the plan (label · stage · module · computed state · suppress toggle).
5. New `/dashboard` page renders the registry's visible tiles; `HomeClient.tsx` untouched (returns R4). **MODULE_HOME flips ON by Reza at acceptance** — with MON-160/161 fixed this is a live switch, no deploy.
6. Tests: visibility law (module off ⇒ tile hidden regardless of toggle) · suppress-only · fail-closed · registry-driven admin rows.

## §D — Small kept-surface fix (display-only)
Balances headline: red "Net position −$1,758,089" is accounts-only (cash+credit−debt, property excluded) presented as THE net position. Relabel to state its basis (e.g. "Accounts net — excludes property") and/or lead with net worth; zero calculation changes; `changesNumbers: NO`.

## Deliver as
**PR-1 (§A)** — the pack fix; `changesNumbers: YES` with written expected movements; backfill dry-run output in the PR body; Reza merges, then §B flip, then Matrix Ring-3.
**PR-2 (§C + §D)** — scoreboard + tiles + balances label; `changesNumbers: NO`; MODULE_HOME flip at acceptance.

## Model routing
§A-1 backfill design + A-3 identity assertions: **Opus, highest effort**. Everything else: Fable.

**Done =** both PRs open with plan boxes ticked + cursor updated · Ring-3 handout cut · dry-run evidence in PR-1 · handback posted. Matrix records the gate review after the Ring-3 verdict.
