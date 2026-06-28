# Changelog - 2026-06-27

## Session: adoring-davinci-e2wb4d (6) — Neobrain §15 Phase A: the FactPack (Personal Financial Index) [2026-06-28]

### Changes Made
- **Type**: Feature (financial — §20.4 10/10 gate applies)
- **Scope**: Neobrain grounding layer Phase A — `lib/neobrain/factPack.ts`
- **What**: The Personal Financial Index the Gemini agent grounds on. A typed, **read-through** view over the existing SSOTs that **persists nothing** (Reza storage directive): user values ← `getMasterFinancialSnapshot()`; app values ← `CATEGORY_HIERARCHY` + `getCurrentTaxYearConfig()`; derived ← the snapshot's engine-computed fields. Provider-agnostic — does not touch Gemini/Vertex, so it builds + tests on the current (paid, no-training) gateway while Vertex is provisioned (Phase 0.5).
- **The grounding contract encoded**: every `Fact` carries `state` ∈ {`value`/`zero`/`absent`}, a `ref` (snapshot-path convention — same one the CFO advisor's `resolveSnapshotPath` resolves, SSOT, no second resolver), `asOf` + `stale`. Count-gating distinguishes "not connected" (`absent`) from a real `$0` (`zero`); actual cash flow is `absent` when no transactions exist (§19.1 — never present declared as actual). Scoped per surface (minimal payload = storage + token cost).

### Files
- `lib/neobrain/factPack.ts` — NEW. Types (`Fact`/`FactPack`/`FactState`/`FactScope`) + pure `assembleFactPack(snapshot, {scopes})` (the testable core) + thin `assembleFactPackForUser(userId)` wrapper.
- `tests/neobrain/factPack.test.ts` — NEW. 9 cases: value/zero/absent, count-gating, §19.1 actuals-absent, asOf/staleness propagation, scope minimisation, app reference block, the no-number-on-absent invariant.
- `docs/financial-logic/graph/structural/structural-graph.json` — Layer-0 coverage for the new file (6 nodes).

### Financial correctness (§19/§20.4)
- No new formula — reads the snapshot SSOT and tags provenance/state; every `ref` is a verified real snapshot path. §19.1 actuals-vs-declared honoured. Self-review 3×: covers the core slices (netWorth/cashflow/debt/emergencyFund/tax/app); per-entity property/investment detail deferred to when Phase C surfaces need it. 10/10 against the Phase A requirement (the Index contract + core slices + tests + zero storage).

### Neomatrix (§21)
- FactPack is the grounding **Index** (read-through assembler), not a money-number producer — structurally Layer-0 covered; not modelled as a semantic number node (§21.5). All gates green locally.

### Testing
- [x] Neomatrix gates (layer0 / semantic / census)
- [x] 9 unit tests on the pure assembler
- [ ] Build passes (Vercel — verify post-push)

### PR
- PR URL: (to be filled)
- Status: Draft

---

## Session: adoring-davinci-e2wb4d (5) — Neobrain §15 Phase 0 (privacy verify) + Vertex decision [2026-06-28]

### Changes Made
- **Type**: Compliance finding + decision (docs)
- **Scope**: Neobrain grounding-layer Phase 0 — AI model-provider data governance vs CDR
- **What happened**: Phase 0 (the gate before any FactPack code) verified — against Google's published terms, not recalled — how the app sends data to Gemini. **Finding:** the app uses the **consumer Gemini Developer API** (`@google/generative-ai` + `GEMINI_API_KEY`, `lib/ai/google/geminiClient.ts:12,26`); some surfaces already pass real figures (cashflow summary, debt analysis). Free tier *trains* on data + human-reviews; **paid tier confirmed by Reza (no training)** but it caches *"in any country"* — which **conflicts with CDR matrix row 2.3** ("data stays in Australia").
- **Decision (Reza 2026-06-28)**: **migrate the AI gateway to Vertex AI** (`australia-southeast1`, WIF auth, no API key) → contractual no-training + AU residency + DPA; GCP-first (§12.7), reuses the Cloud SQL WIF identity, and *is* the "one gateway" SSOT move. Recorded as CDR matrix **Finding F-AI-1**.

### Files Modified
- `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` — Finding F-AI-1 under Step 2 (the §16.3-mandated CDR-posture doc).
- `docs/blueprint/PHASE_54_NEOBRAIN.md` — §15.6 Phase 0 marked DONE + new Phase 0.5 (Vertex migration) + §15.6.1 operator provisioning runbook.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — Phase 0 done, Phase 0.5 next (blocked on operator provisioning).
- `docs/IMPLEMENTATION_PLAN.md` — hub date.

### Verification (§19/§20 — no recalled claims)
- Terms verified live: [Gemini API terms](https://ai.google.dev/gemini-api/terms) (free=train+human-review; paid=no-train but multi-region cache), [Vertex AI data governance](https://cloud.google.com/vertex-ai/generative-ai/docs/data-governance) (no-train), [GCP gen-AI residency](https://cloud.google.com/blog/products/ai-machine-learning/google-cloud-generative-ai-data-residency-guarantees-for-data-stored-at-rest).

### Testing
- Docs-only; no code/schema/financial-logic → no build gates triggered.

### Next (operator action required before code)
- Phase 0.5 provisioning (runbook §15.6.1): enable `aiplatform.googleapis.com`, grant the WIF SA `roles/aiplatform.user`, set `VERTEX_PROJECT`/`VERTEX_LOCATION=australia-southeast1`/`USE_VERTEX`. Then the provider-pluggable Vertex gateway cutover (safe fallback to current paid Gemini until configured).

### PR
- PR URL: (to be filled after creation)
- Status: Draft

---

## Session: adoring-davinci-e2wb4d (4) — Neobrain factual-grounding-layer design (§15)

### Changes Made
- **Type**: Design / documentation (no code)
- **Scope**: `PHASE_54_NEOBRAIN.md` §15 — Neobrain as Monitrax's factual-grounding layer ("personal financial intelligence", Apple Intelligence concept)
- **Driver**: Reza directive 2026-06-27 — *"neobrain should be the reference for any ai feedback to avoid gemini guessing fictitious numbers"* (two datasets: user-specific + app-level) + *"be mindful of what data will be stored … just useful and relevant data"* + *"something like the apple intelligence concept"* → *"Ship it"* (after a self-review gate request: present only if > 9/10).
- **Outcome**: Signed-off design at **9.4/10** (§20.4). The Explore-mapped current state: grounding already works in the two highest-stakes surfaces (CFO `snapshotPath` resolution; tax-advisor tool-calling + HR-1/HR-2 validator) but is inconsistent and leaves free-form surfaces (`debt-analysis`, `budget-analysis/generate`, `aiDocumentAnalyzer`) able to invent numbers; a duplicate Gemini gateway (`lib/ai/gemini.ts`) can bypass grounding.

### Design recorded (§15)
- **Three pillars** (Apple Intelligence mapping): Personal Financial Index (the FactPack) · Capability Registry (typed Intents) · CDR-grade privacy guarantee.
- **Three fact-types** over existing canonical sources, **zero new storage**: user values ← `getMasterFinancialSnapshot()`; app values ← `CATEGORY_HIERARCHY` + `taxYearConfig`; derived ← named engines only. Neomatrix = provenance/citation map (holds no values, Phase 53 §9).
- **Grounding contract**: every figure is a typed reference into the FactPack; server resolves; validator rejects un-referenced numbers; refuse-never-estimate; distinguishes `value`/`zero`/`absent`; carries `asOf`/staleness.
- **Bypass-proof gate**: new `lint:ai-grounding` (fails the build on a Gemini call not routed through the Neobrain gateway+validator) + delete the duplicate `lib/ai/gemini.ts` + a hallucination test-suite ship-gate.
- **Phases**: 0 privacy-terms verify (gates all) → A FactPack → B validator+gate → C free-form surfaces first → D migrate CFO/tax last → E Capability Registry.
- **Fork recorded**: read-and-compute v1 (action Intents → v2). Proactive pillar → v2.

### Self-review (§20.4)
- 3× adversarial. **v1 7.2/10 (held back).** 8 gaps found + fixed (bypass gate, over-claimed privacy, 2→3 fact-types, staleness, zero-vs-absent, acceptance tests, sequencing, proactive-pillar). **v2 9.4/10** — the missing 0.6 is the Phase-0 privacy verification (genuine unknown, not scored as solved).

### Files Modified
- `docs/blueprint/PHASE_54_NEOBRAIN.md` — §15 added + footer.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — `0·NEOBRAIN` re-activated; §15 build queued (Phase 0 next).
- `docs/IMPLEMENTATION_PLAN.md` — hub `Last updated`.

### Testing
- Docs-only; no code, no schema, no financial logic → no Neomatrix/build gates triggered. No PR build risk.

### PR
- PR URL: (to be filled after creation)
- Status: Draft

---

## Session: adoring-davinci-e2wb4d (3) — reconciliation cursor (continue, don't restart)

### Changes Made
- **Type**: Fix (UX / navigation)
- **Scope**: Activity reconciliation flow (`app/dashboard/activity/page.tsx` — link-dialog `onNavigateNext`)
- **Root cause**: After categorising a transaction, `onLinked` refetches the list and the categorised row drops out of the uncategorised filter. `onNavigateNext` then did `findIndex(linkingTransaction.id)` → `-1` (row gone) → fell back to `current[0]` — so the dialog **jumped back to the top of the list** every time. The 2026-06-23 fix only covered *skip* (where the row stays, so `findIndex` succeeded). Reza: "after categorising a transaction the list goes from the beginning again rather than continue."
- **Solution**: capture the categorised row's list position in `onLinked` **before** the refetch removes it (`pendingAdvanceIdxRef`); in `onNavigateNext`, disambiguate by whether the row is still present — **present** = skip → advance to `idx+1`; **gone** = categorise → continue from the captured slot (the successor has shifted into it). Both paths **wrap to `current[0]` at the end** so SKIPPED rows get a second pass (Reza: "if the list finish then goes back from start … for transactions that I have skipped"). Presence-based detection makes a stale captured index (e.g. a split-save that calls `onLinked` without navigating) harmless.

### Files Modified
- `app/dashboard/activity/page.tsx` — `pendingAdvanceIdxRef` cursor; rewrote `onLinked` (capture pre-refetch position) + `onNavigateNext` (continue + wrap).
- `docs/financial-logic/graph/structural/structural-graph.json` — zero-drift (§21.2.1): recomputed 21 shifted `app/dashboard/activity/page.tsx` symbol anchors from source.

### Neomatrix (CLAUDE.md §21)
- Navigation-only change, no financial number/engine touched (§21.5). Structural anchors refreshed for the edited file. Gates green locally: `check-layer0-coverage` 0 uncovered · `generate-financial-logic --check` OK.

### Self-review (CLAUDE.md §20.4)
- 3× against the requirement, traced all four cases: categorise-mid (continue), categorise-last (wrap to start → skipped rows), skip-mid (forward), skip-last (wrap). Edge: split-save `onLinked`-without-navigate → presence check ignores the stale index. Outcome 10/10.

### Testing
- [x] Neomatrix gates pass locally
- [ ] Build passes (Vercel — verified post-push)

### PR
- PR URL: (to be filled after creation)
- Status: Draft

---

## Session: adoring-davinci-e2wb4d

### Changes Made
- **Type**: Fix
- **Scope**: Transaction reconciliation — batch categorisation (`TransactionLinkDialog` + `/api/transactions/[id]/link`)
- **Root Cause**: The "categorize selected together" batch path (`additionalTransactionIds`) was wired
  only for the **expense**, **income**, and **link** actions. The **transfer** and **investment**
  actions ignored it on the server *and* the front end never sent it for those bodies. Result: when a
  user batch-selected same-vendor rows that resolved to a **transfer** (e.g. NAB credit-card
  repayments / loan repayments) or an **investment contribution**, only the primary row was
  categorised — every other selected row stayed untouched, so reconciliation "went one by one"
  exactly as reported.
- **Solution**: Made the batch path symmetric across all four actions (§12.2.1 — one behaviour, one
  path):
  - **Front end** (`TransactionLinkDialog.tsx`): added
    `additionalTransactionIds: Array.from(selectedVendorTransactions)` to the `investment` body, the
    `transfer` body in `handleCreate`, and the resolution-surfaced `handleMarkTransferTo` body.
  - **Server — transfer branch**: extracted the confirmed-transfer field set once
    (`...confirmedTransferFields()` — the tested SSOT helper from
    `lib/bookkeeping/transferCategorisation.ts`) and applied it to the primary row **and** to a
    user-scoped `updateMany` over the validated `additionalTransactionIds`.
  - **Server — investment branch**: looped the validated additional rows, creating a distinct
    investment `DEPOSIT` per row (amounts differ), incrementing the account `cashBalance` per row, and
    marking each bank row `isInvestmentContribution`. Response now reports `batchCount`.

### Files Modified
- `components/transactions/TransactionLinkDialog.tsx` — send `additionalTransactionIds` for transfer + investment + mark-transfer-to paths
- `app/api/transactions/[id]/link/route.ts` — apply the batch mark in the `transfer` + `investment` action branches
- `docs/financial-logic/graph/structural/structural-graph.json` — zero-drift (§21.2.1): refreshed shifted `file:line` anchors for `link_route_get` (1019→1111) and `link_route_calculatesimilarity` (1599→1691) after the route grew

### Destructive write checklist (CLAUDE.md §12.11)

Operations in this PR that touch existing rows:
- `app/api/transactions/[id]/link/route.ts` (transfer) `prisma.unifiedTransaction.updateMany(...)`
- `app/api/transactions/[id]/link/route.ts` (investment loop) `prisma.unifiedTransaction.update(...)` + `prisma.investmentAccount.update({ cashBalance: { increment } })`

For each operation:
1. **`where` clause matches:** only ids returned by a preceding `findMany({ where: { id: { in: additionalTransactionIds }, userId } })` — i.e. transactions the **authenticated user owns** and **explicitly selected** in the batch UI. No row outside the user's selection can match.
2. **Columns overwritten:** the same categorisation columns the single-row path already writes (`isTransfer`/category fields via `confirmedTransferFields()`, or `isInvestmentContribution` + investment link). These are reconciliation-state columns the user is deliberately setting by clicking "categorize together"; no user-entered balances/names/dates are clobbered. `cashBalance` is `increment`-only (additive, mirrors the existing single-row deposit).
3. **Guard ensuring this only mutates rows I intend:** the user-scoped `findMany` validation gate (identical to the existing expense/income batch pattern) + the rows are the user's own explicit multi-select.

User confirmation: NOT REQUIRED — non-destructive (sets reconciliation state the user explicitly requested via the batch-select UI; scoped to the authenticated user's own selected rows; mirrors the already-shipped, reviewed expense/income batch pattern).

### Financial correctness (CLAUDE.md §19)
- No money number's **formula** changes. Transfers are excluded from spend/income via `confirmedTransferFields()` (`isTransfer: true`) exactly as the single-row path already does (§19.1 — transfers excluded). Investment contributions increment `cashBalance` by the real transaction amount per row (actuals, not declared). The fix only widens *which selected rows* get the already-correct mark.

### Neomatrix (CLAUDE.md §21)
- No semantic `financial-graph.json` change — this route categorises/links transactions; it does not produce a modelled money number (§21.5). Structural Layer-0 anchors refreshed for zero-drift (§21.2.1).
- Gates run locally: `check-layer0-coverage` 0 uncovered · `check-binding-coverage` 140/140 · `check-census` 0 uncovered · `generate-financial-logic --check` OK.

### Self-review (CLAUDE.md §20.4)
- 3× review against the requirement ("batch categorisation must apply to ALL actions"): pass 1 fixed transfer + investment server branches; pass 2 caught the FE `handleMarkTransferTo` resolution path also omitted the ids (added); pass 3 verified §12.11 user-scoping on every new write + that the investment loop creates one DEPOSIT per row (amounts differ — `updateMany` would be wrong here). Outcome 10/10 against requirement.

### Testing
- [ ] Build passes (Vercel — verified post-push)
- [x] Structural + semantic Neomatrix gates pass locally
- [x] Type review: `additionalTransactionIds?: string[]` already on `LinkRequest`; `confirmedTransferFields` already imported

### PR
- PR URL: https://github.com/resadegh/monitrax/pull/1280 (merged)
- Status: Merged

---

## Session: adoring-davinci-e2wb4d (2) — Neobrain on manual reconciliation

### Changes Made
- **Type**: Feature
- **Scope**: Neobrain learning loop on the manual reconciliation surface (Activity page + link route)
- **Root cause / gap**: Manual categorisation **recorded** the decision (private `merchantMapping` + shared KB via `learnCanonicalFromLink`) and the link dialog **suggested** the learned category on open — but the full AI cascade + `applyToSimilarTransactions` only ran on the **Basiq import** path, against a **different table** (`transactionReviewQueue`). On the live `unifiedTransaction` reconciliation page, categorising one transaction did **not** pick up other already-imported same-merchant rows. Reza: "if I categorise a transaction, next similar one should be picked up by neobrain."
- **Solution (auto-apply, Reza decision 2026-06-27)**: when a user categorises a transaction, Neobrain auto-applies that **user-confirmed** decision to other uncategorised same-merchant rows, with four guardrails + an Undo:
  1. EXACT standardised-merchant match (never fuzzy).
  2. SAME direction (IN/OUT) — a refund never sweeps into an expense category.
  3. Only still-uncategorised + unlinked rows — never overwrites an existing categorisation, never touches transfers/investments.
  4. User-scoped (§12.11) + excludes the source row and any explicit batch ids.
  Plus a learned-suggestion pill on uncategorised list rows (the read side of the same `merchantMapping`), and an "Applied to N similar · Undo" affordance (visible + reversible — never silent).

### Files Modified
- `lib/bookkeeping/applyToSimilarUnified.ts` — NEW. `applyCategoryToSimilarUnified()` (the sweep), `buildSimilarUncategorisedWhere()` (pure guardrail builder, unit-tested), `getLearnedCategorySuggestions()` (read side for the suggestion pill). SSOT (§12.2.1): reuses the same `merchantMapping` the link route writes — no parallel store.
- `app/api/transactions/[id]/link/route.ts` — auto-apply wired into the expense/income/link branches (gated on `learnMerchant`; loan links excluded); `unlink` branch extended with `additionalTransactionIds` for the batch Undo. Each branch returns `autoApplied: { count, appliedIds }`.
- `app/api/unified-transactions/route.ts` — GET enriches uncategorised rows with `suggestedCategoryLevel1` from the user's merchantMapping (one query/page, no N+1).
- `components/transactions/TransactionLinkDialog.tsx` — captures `autoApplied`, shows "applied to N similar" in the success banner with an Undo (reverts only the swept siblings; the user's own pick stays), and holds the dialog open when a sweep happened so Undo is reachable.
- `app/dashboard/activity/page.tsx` — `Transaction.suggestedCategoryLevel1`; uncategorised rows render a sky/indigo "Suggested" pill (one tap → dialog pre-filled) instead of the generic "Add" action.
- `tests/bookkeeping/applyToSimilarUnified.test.ts` — NEW. Pins all four guardrails + the empty-merchant short-circuit.
- `docs/financial-logic/graph/structural/structural-graph.json` — Layer-0 coverage for the new file + zero-drift anchor refresh for the grown link route (§21.2.1).
- `.stitch/designs/phase54/neobrain-reconciliation-desktop-light.{html,png}` — Stitch-first artefact (§18.2.1).

### Destructive write checklist (CLAUDE.md §12.11)
- `applyToSimilarUnified` (`updateMany`) and the `unlink` batch (`updateMany`): both scoped to the authenticated user via the guardrail where-clause / a user-scoped findMany validate. `where` matches only the user's own still-uncategorised same-merchant same-direction rows (auto-apply) or explicitly-validated ids (undo). Columns written are reconciliation-state only (category/link fields) — no user-entered balances/names/dates. Guard: the four guardrails + Undo. User confirmation: NOT REQUIRED — non-destructive; propagates the user's own just-made decision; fully reversible.

### Financial correctness (CLAUDE.md §19)
- No money-number formula changes. Direction guardrail preserves the §19.1 income/expense separation (a same-merchant refund is never swept into spend). The swept rows receive the identical categorisation payload as the primary (SSOT — one `data` object).

### Neomatrix (CLAUDE.md §21)
- Structural Layer-0 coverage added for the new file; link-route anchors refreshed (zero-drift §21.2.1). The new functions are categorisation-**propagation** (Neobrain perception layer), not money-number producers — structurally tracked, not modelled as semantic number nodes (§21.5). All gates green locally: `check-layer0-coverage` 0 uncovered · `check-binding-coverage` ✓ · `check-census` 0 uncovered · `generate-financial-logic --check` OK.

### Design (CLAUDE.md §18)
- Stitch-first pass (project `1859462351962811110`, screen `0bb2d04cebb54c4fb311436523481579`). §18.8 gate: v1 ~7/10 (missing post-confirm affordance + unsolicited photo) → v2 **9.2/10** (banner added, photo removed, glass strengthened, suggestion pill clarified). Shipped FE uses an inline "Applied to N · Undo" confirmation (lighter variant of the banner, consistent with the auto-apply decision). **Backfill pending:** refresh the Stitch artefact to the undo-toast variant + the 4-variant dark/mobile matrix (§18.7.2) in a fast-follow.

### Self-review (CLAUDE.md §20.4)
- 3× against the requirement. Pass 1: built suggest+one-tap. Pass 2 (Reza chose auto-apply): re-scoped to auto-apply with guardrails; caught that silent auto-apply risks income/expense mis-direction → added the direction guardrail + Undo. Pass 3: extracted the pure where-builder for unit-testing the guardrails; verified the source row is never reverted by Undo (sweeps siblings only). Outcome 10/10 against requirement (suggest+auto-apply+undo, guardrailed, SSOT-reusing).

### Testing
- [x] Neomatrix gates pass locally (all four)
- [x] Guardrail unit tests written (pure where-builder)
- [ ] Build passes (Vercel — verified post-push)

### PR
- PR URL: (to be filled after creation)
- Status: Draft
