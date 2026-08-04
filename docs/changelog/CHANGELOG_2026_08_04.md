# Changelog — 2026-08-04

## Session: `sbpfhc` — D50 answered, and the G7 handout that could not be written

### Changes Made

- **Type**: Registry (scope decision) + a verification handout + a process finding
- **Scope**: `docs/issues/` · `docs/verification/briefs/` · the MON-131 ledger / brief / hub
- **Description**: Reza answered **D50 with option A** — narrow MON-130 to the surface its evidence
  covers, carry the residue as a new issue. Implemented. He then asked for the complete G7 handout;
  writing it exposed that **G7 cannot be run for T2 at all**, for a reason that is a defect in our
  process rather than a task still queued.

### D50 — option A, implemented

**MON-130 narrowed and moved to `VERIFIED`.** Its title and `rootCause` now name the one producer
`#1575` actually migrated: `masterFinancialService`, the service behind Home and the property pages.
Verified on **VR-047** (rendered half — Home's budget tile $12,779 matching `/dashboard/expenses`,
regression cluster byte-identical including `healthScore` 53) plus **VR-047B** (producer half — the
four-expression identity, three leaves byte-equal at `12,779.292814353912` and the fourth that value
rounded at the producer). Neither run was sufficient alone: a correct tile cannot establish that four
expressions agree, and a producer identity cannot establish that a user sees it.

**MON-156 opened, carrying the residue.** Eleven producers across roughly thirty raw `minRepayment`
reads — the CFO score, the risk radar, the debt planner, reports, the CFE input and the money-flow
chart. The producer list is copied verbatim from MON-130's original, with a caveat on the entry that
the line numbers are **provenance, not a current anchor** and must be re-verified against source before
any fix code (§19.2 / FIX_PROTOCOL Stage 1).

The reasoning is recorded on **both** entries so it cannot be re-litigated later: Lever 2 hides the
surfaces those eleven feed, and hiding a surface is an **exposure** control, not a **defect** control.
The numbers are still wrong; they are merely off-screen, and they return the moment a surface is
un-hidden. Folding them into a `VERIFIED` issue would have been exactly the §22.2.4 over-claim.

**T2 reaches G11 ✅** — MON-143 and a narrowed MON-130, each verified on its own numbers.

### MON-157 — the finding that outlives T2

The handout Reza asked for is the `POST /golden-baseline/diff` call that returns
`CLEAN` / `EXPECTED_ONLY` / `STOP`. **It cannot be run.** Three facts, each read in source rather than
inferred:

1. `diffBaselines(oldTree, newTree, expectedMoves)` (`lib/matrix/goldenBaseline.ts:244`) flattens **both
   sides** to numeric leaves. It requires a **tree** on the old side; a hash cannot be diffed.
2. The relay's committable artefact is `?format=hash` (`route.ts:84`), whose own comment states the
   tradeoff exactly: *"a matching treeHash proves nothing moved anywhere. Localising a mismatch still
   needs the full tree."* A tranche that moves declared numbers **necessarily** mismatches, so
   localisation is always required and the tree is always needed.
3. The CLI (`golden-baseline.mjs:97`) **does** write the full tree and prints **"COMMIT IT"** — but
   `git log --all` over `.audit/golden-baseline*` returns **nothing**. No such file has ever been
   committed, on any branch, in this repository's history. The reference for T1's end state exists only
   as the string `347006b9…` in the prose of `VR-045.md`.

The pre-T2 tree cannot be re-captured — the code has changed and the live data has moved on — so
**T2's G7 stands at HALF permanently**: fifteen declared paths verified live (VR-047B A2), whole-tree
question unanswered. This is a §21.2.2 rule-4 failure; the instrument's reference lived in a session
instead of in the repo, and it survived four tranches because a hash is sufficient for the CLEAN case
and nobody hit the localisation case until a tranche moved numbers on purpose.

### The handout that shipped instead

`docs/verification/briefs/MATRIX_G7_REFERENCE_CAPTURE.md` — three calls in one admin session:

1. **`?format=hash`** (~400 bytes) — committed as the reference summary. `captureErrors` must be `[]`;
   a failed capture serialises as a zero-leaf stub, so a tree can be missing an entire producer's
   numeric content while still looking valid (drift-log D8). A reference committed with that tripwire
   lit is worse than none — every future diff would read the absence as "nothing moved there".
2. **The full tree** (~282 KB) returned verbatim, committed as `.audit/golden-baseline-<sha>.json`, and
   split across messages at the eight top-level `file:function` keys if it does not fit one.
   **Reassembly is verified, not assumed**: the reassembled tree is re-hashed and compared to Call 1's
   `treeHash`.
3. **A self-diff** — POST the tree back with `expectedMoves: []`, expecting `verdict: "CLEAN"`. This
   exercises the whole chain (capture → serialise → POST → flatten → verdict) before T3 depends on it.
   Calendar leaves are already filtered, so a leaf that moves between two captures on identical code is
   **non-determinism in a producer** — the MON-134 class — and is a real finding, not noise.

**T3's G7 becomes runnable as designed.** This closes the hole forward; it cannot reopen T2's.

The handout also records, as a pre-declared non-finding, that the `moneyFlowService` capture runs on the
**DECLARED** loan basis and therefore understates by **$3,792.92/month** exactly as MON-156 says. That
is deliberate: a reference must record today's behaviour. One that quietly captured the better number
would make the next tranche's diff report a move that never happened.

### MON-155 — flag corrected

`changesNumbers` true → **false**. It was the auto-raise default. Neither resolution of a dead
`admin_session` branch — deleting it or implementing it — moves any user-facing number. Left true, the
gate would have demanded a cross-surface propagation test and a resolving Neomatrix `semanticKey` before
it could ever reach `VERIFIED`, for an auth branch that produces no number. A gate firing on the wrong
issue teaches sessions to work around gates.

### Files Modified

- `docs/verification/briefs/MATRIX_G7_REFERENCE_CAPTURE.md` — **new**
- `docs/issues/ISSUES.json` + `.md` — MON-130 narrowed + VERIFIED; MON-156, MON-157 opened; MON-155 flag
- `docs/implementation/MON-131_TRANCHE_LEDGER.md` — G7, G11, T2 heading, §6 row, `#1580`/`e3a3715` backfill
- `docs/implementation/MON-131_COMPLETION_BRIEF.md` — §2, §5 (D50 decided), §6 status log
- `docs/IMPLEMENTATION_PLAN.md` — hub

### Testing

- [x] `npm run issues:check` — 144 issues valid
- [x] `npm run issues:generate`
- [x] `npm run neomatrix:check`
- [x] `npm run lint:source-lock` · `npm run lint:financial-surfaces` · producer census (`loanCost` 30)
- [x] `npx tsc --noEmit`
- [x] `npx vitest run`

**Coverage boundary.** This session changes **no code** — no producer, no engine, no rendered number. It
records a scope decision, opens two issues, and ships one handout. It verifies **nothing** on its own;
the handout it produces is what will be verified, by the Matrix, in a later run.

---

## Session: `sbpfhc` (cont.) — VR-048 consumed: the first committed reference tree, and T2's G7 settled

### Changes Made

- **Type**: Verification consumption + a reference artefact + a Ratchet test
- **Scope**: `.audit/golden-baseline-12954ff.json` (new) · `tests/matrix/` · `docs/verification/runs/` ·
  registry · the MON-131 ledger / brief / hub
- **Description**: The Matrix ran `MATRIX_G7_REFERENCE_CAPTURE.md` and returned **VR-048**. All ten
  checks passed. The tree is committed — **the first golden-baseline tree ever committed to this
  repository** — and guarded by a Ratchet. Reza settled T2's G7 at the same time.

### Reza's ruling, recorded where the next session reads first

> *"Tell Code that T2's G7 stays HALF so it isn't re-litigated: this capture establishes the reference
> for T3, not a close for T2."*

The reason is structural, not procedural. G7's verdict comes from diffing the **pre-change** tree against
a fresh one. T2's pre-change tree never existed as a file — only its hash — and it cannot be re-captured:
the code has changed and the live data has moved on. **No artefact captured today can answer a question
about a state that is gone.** It is written into the ledger's G7 cell, the brief's §2, the hub and
MON-157's notes, each phrased so a future session finds the reasoning rather than just the verdict.

### What VR-048 established

8 trees · `captureErrors: []` · **1,755 hashed leaves + 1 volatile = 1,756** ·
`treeHash 0d6753ef330156c8a6c09e8ad517caf34aac73b64f9c0230c6556873f8361cf7` · sha `12954fff`.

Committed at `.audit/golden-baseline-12954ff.json` in the **CLI's own document shape**
(`meta` / `renderedPartC` / `captures`) so `golden-baseline.mjs --diff`, which reads `oldDoc.captures`,
finds it without adaptation.

**Integrity verified independently, not accepted.** The reassembled tree was re-hashed with the *real*
`hashBaseline()` from `lib/matrix/goldenBaseline.ts` — never a re-implementation (§12.2.1) — and matches
exactly, `perTree` identical on all eight keys. That proves something stronger than "the paste survived":
Call 1 and Call 2 were **separate** server-side captures, so an equal hash also proves the two were
numerically identical. Either a lost leaf or a divergence between the captures would have broken it. The
committed file was then run back through the real `diffBaselines` locally — **CLEAN, `unchanged = 1756`**
— matching the Matrix's server-side self-diff figure exactly.

**The 1,755 / 1,756 pair is not a discrepancy.** `hashBaseline` reports `leafCount` *excluding* volatile
calendar leaves; `diffBaselines` computes `unchanged` from the full map. 1,755 + 1 = 1,756, exactly.
Checked rather than waved through, because two leaf counts differing by one is also the shape a silently
dropped leaf takes.

**Against VR-045's 1,759** at `3cdaa8c4`: −4, legitimate — T1's income flip retired an `OTHER` subtree
and T2 changed `debt.summary` coverage. The handout wrote 1,759 as an order-of-magnitude check
explicitly, not a prediction.

### The Ratchet (§23.2.2)

MON-157's class is *"the instrument's reference lived in a session instead of the repo"*, and it survived
four tranches undetected. The ratchet is a `describe` block in `tests/matrix/goldenBaselineRelay.test.ts` — the suite that already
covers this module, per §22.2 rule 2 (a new correctness check is a fixture on the existing engine's
suite, never a parallel silo). It fails when no reference is committed, when the document lacks the CLI's shape, when
the `captureErrors` tripwire is lit, when the recorded `treeHash` no longer matches a re-hash of its own
captures, or when it fails to diff CLEAN through the real `diffBaselines`.

**Negative control run** — with the reference moved aside the block fails on *"No
`.audit/golden-baseline-<sha>.json` is committed"*; restored, it passes. A ratchet that has not been seen
to fail is not a ratchet.

### MON-159 — a pre-existing flake this session nearly took the blame for

Recorded in full because the wrong conclusion was reached **twice** before the right one.

Adding the ratchet, the **full** suite aborted with `exit 134` — a Prisma query-engine panic
(`query-engine-node-api/src/engine.rs:74`, *"thread caused non-unwinding panic"*). The obvious inference
was that the new test caused it, and two rounds of restructuring followed: moving the 455 KB `JSON.parse`
out of vitest's collection phase, then caching it to a single parse. **Each looked like it helped;
neither did.**

Six runs with the block **absent** settled it: **2 failures in 6**, against 3 in 10 with it present —
indistinguishable. The change was innocent and the flake is pre-existing. The abort lands at a different
test file each time (`reformSkeletons`, `findingService`, `financial`), so it is not one bad test but the
engine being initialised or torn down in workers that mock the database and never use it.

**MON-159** (medium) carries the measurement, the exact panic signature, and what has *not* been
investigated. Its `rootCause` is deliberately **empty** — the MON-147 precedent: the panic is inside
Prisma's native engine, no line in this codebase is verified to cause it, and inventing an anchor is the
§19.2 failure the four-step audit exists to prevent. It matters beyond annoyance: an intermittent red
build landing somewhere different each time either makes a session rewrite working code, or teaches it to
re-run until green and stop reading failures — and the second is how a real regression ships.

### MON-158 — the run's one finding

`riskRadar` mints a fresh UUID and `detectedAt` on every scan, so two captures on identical code and data
are never byte-identical. **Verified in source before registering** (§19.2): `lib/cfo/riskRadar.ts:605`,
`createRisk()` sets `id: crypto.randomUUID()` and `detectedAt: new Date()` on every call.

Scoped honestly rather than inflated. It **cannot** affect a verdict — `diffBaselines` flattens to
*numeric* leaves and these are strings; the run's evidence was 19 differing leaves, **all non-numeric**,
zero numeric. Impact **today is nil**, stated from the consumer list rather than assumed: the only
consumers are the CFO advice chat route and `aiAdvisor`, both of which pass risks to the LLM and discard
them, and nothing persists a risk by id. What it costs is optionality — no consumer *can* key off a risk
id, and a future "dismiss this risk" feature would break silently on the first re-scan.

### Registry

- **MON-157 → VERIFIED**, fixed **forward only**, with the downstream sweep naming both what this
  unblocks (T3's G7, the CLI's `--diff`, the diff route) and what it deliberately does not (T2's G7).
- **MON-158** opened, DIAGNOSED, `changesNumbers: false`.

### Files Modified

- `.audit/golden-baseline-12954ff.json` — **new**, the reference tree (455 KB)
- `tests/matrix/goldenBaselineRelay.test.ts` — the Ratchet, folded into the existing suite (§22.2 rule 2)
- `docs/verification/runs/VR-048.md` — **new**
- `docs/issues/ISSUES.json` + `.md` — MON-157 VERIFIED; MON-158, MON-159 raised
- `docs/implementation/MON-131_TRANCHE_LEDGER.md` — G7 cell, T2 heading, §6 row, `#1581`/`e5017ba` backfill
- `docs/implementation/MON-131_COMPLETION_BRIEF.md` — §2, §6
- `docs/IMPLEMENTATION_PLAN.md` — hub

### Testing

- [x] `npm run matrix:check` on the VR-048 payload → exit 0 (`kind=capture · verdict=CAPTURE_ONLY · sha=12954fff · 10 checks`)
- [x] Independent re-hash of the reassembled tree → matches `treeHash` exactly
- [x] `diffBaselines(captures, captures, [])` on the committed file → CLEAN, `unchanged=1756`
- [x] New Ratchet: passes · **negative control**: fails with the reference removed
- [x] Full suite 4465 passed / 69 skipped — with the **MON-159** caveat stated above: the suite aborts
      intermittently for a pre-existing reason, measured at 2/6 with this change absent
- [x] `npm run issues:check` — 146 valid
- [x] `npm run neomatrix:check` · `lint:source-lock` · `lint:financial-surfaces` · census (`loanCost` 30)
- [x] `npx tsc --noEmit` · `npx vitest run`

**Coverage boundary.** Verifies a reference artefact and the diff chain that consumes it. Verifies **no**
rendered surface and **no number's correctness** — a reference records what the app currently produces,
including anything currently wrong (the `moneyFlowService` leg is captured on the DECLARED basis and
understates by $3,792.92/month exactly as MON-156 declares, deliberately). Closes **nothing** for T2.

---

## Session: prod-simplification-p0-p1 (Code, Fable 5)

### Changes Made — PR-A (P0: freeze & preconditions; docs/trackers ONLY)
- **Type**: Docs / process
- **Scope**: PROD Simplification plan P0 (`docs/strategy/PROD_SIMPLIFICATION_PLAN.md` §5)
- **Description**: Landed the tracker rows the planning PR could not carry (P0.1), the scope-freeze
  rule (P0.2), the CLAUDE.md §13.6 D-7 amendment (P0.3), and the registry re-count (P0.6). P0.4
  (Vercel Preview env check) and P0.5 (merge #1577) are Reza-side and flagged as such in the plan —
  #1577 was still open (draft) at PR time; noted, not blocking.

### Files Modified — PR-A
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — 0·SIMP workstream entry added directly after 0·REF (carry text verbatim)
- `STATE.md` — PROD SIMPLIFICATION cursor row + SCOPE FREEZE rule (both verbatim) at the top of §C RESUME CURSOR
- `docs/IMPLEMENTATION_PLAN.md` — hub `Last updated` bumped with the P0 landing note
- `docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md` — Q-SCOPE-1 row landed (from PR #1577's body, the standing gotcha) with status ✅ DECIDED 2026-08-04 → plan §0
- `CLAUDE.md` — §13.6 exception (Reza 2026-08-04): one-way PROD→dev copy of Reza's own data for hidden-module dev; sunsets permanently the day any CDR/Basiq-sourced data lands in PROD
- `docs/strategy/PROD_SIMPLIFICATION_PLAN.md` — P0.1/P0.2/P0.3/P0.6 ticked with evidence; P0.4/P0.5 annotated Reza-side; cursor block updated; §9 session-log line appended
- `docs/changelog/CHANGELOG_2026_08_04.md` — this entry

### P0.6 evidence
Registry at `e588a837`: **65 OPEN/FIXING (🔵 38 + 🟠 27), 5 critical, 146 total** vs 63 OPEN/FIXING,
6 critical, 135 total at filter HEAD `1e2317b6` (+2 / −1 critical / +11 total).

### Build Status — PR-A
- Docs-only; no product code, no schema, no number moves (`changesNumbers: NO`).

### Changes Made — PR-B (P1: the module gate; flips NOTHING)
- **Type**: Feature (exposure control — no number, engine, or schema change; `changesNumbers: NO` by contract)
- **Scope**: PROD Simplification P1 (`docs/strategy/PROD_SIMPLIFICATION_PLAN.md` §§2-4)
- **Description**: The full module gate. 13 flag keys (registry = the single source of the hide
  decision), keyed fail-closed cached reader (Basiq gate now delegates to it — one implementation),
  nav filtering across all five trailNav consumers, 20 layout guards + 38 API route files guarded
  (503 `MODULE_DISABLED`), MODULE_HOME server-wrapper redirect (root never 404s), public
  `/api/feature-flags/modules` + client context, unconditional PATCH cache invalidation, seed of all
  keys `enabled:false`, admin Modules panel + §4.5 dead-control removal, per-item Strategy tabs
  client-gated behind MODULE_STRATEGY. Every key ships OFF — deploying this PR is what hides the
  modules in PROD (the intended v1 state, plan P2.1: "keys default hidden — nothing to flip").

### Files Modified — PR-B (highlights)
- `lib/featureFlags/moduleRegistry.ts` — NEW: 13 ModuleDefs (navHrefs · routePrefixes · audited apiPrefixes · returnStage)
- `lib/featureFlags/moduleGate.ts` — NEW: `isFlagEnabled`/`isModuleEnabled` keyed 30s fail-closed cache + `invalidateFlagCache`
- `lib/featureFlags/basiqGate.ts` — now a thin delegation (exports unchanged; 10 call sites untouched)
- `lib/featureFlags/moduleRouteGuard.ts` — NEW: `moduleRouteGuard` (layout notFound) + `moduleApiGuard` (503)
- `lib/featureFlags/ModuleGateContext.tsx` — NEW: client provider + `useModuleEnabled`/`useEnabledModules`
- `app/api/feature-flags/modules/route.ts` — NEW: public one-call module flag map
- `lib/navigation/trailNav.tsx` — `moduleKey` fields + `filterNavByModules` + safe `mobileMoreItems`
- `components/editorial/shell/EditorialSidebar.tsx`, `EditorialBottomNav.tsx`, `components/shell/MoreSheet.tsx`, `MobileTabBar.tsx`, `SectionTabsRow.tsx` — render from the filtered nav
- `components/DashboardLayout.tsx` — mounts `ModuleGateProvider`
- `app/dashboard/page.tsx` → server MODULE_HOME wrapper; content moved verbatim to `app/dashboard/HomeClient.tsx`
- 20 × `layout.tsx` module guards (household-profile, cashflow, plan, budget-analysis, income, expenses, debt-planner, safety-net, entities, investments, tax, cfo, strategy ×3, housekeeping, conversations, requests, labs, marketplace) + `app/portal/layout.tsx`
- 38 × `app/api/**/route.ts` — `moduleApiGuard` at handler top (audited GATE prefixes only)
- `app/api/admin/feature-flags/[key]/route.ts` — unconditional cache invalidation
- `prisma/seed-feature-flags.ts` — module keys seeded `enabled:false` (update path preserved)
- `app/admin/feature-flags/page.tsx` — Modules panel; dead override controls/columns removed
- `app/dashboard/properties/page.tsx`, `components/loans/LoanDetailDialog.tsx` — Strategy tab behind `useModuleEnabled('MODULE_STRATEGY')`
- `tests/featureFlags/{moduleGate,navFilter,moduleGuards}.test.ts` — NEW: 38 tests
- `tests/golden/goldenHousehold.ts` — serves `globalFeatureFlag` enabled:true (+`where.key`) so Ring-2 route tests exercise handlers as-live
- `tests/budget/mon125BudgetGeneratorSsot.test.ts`, `tests/dashboard/entityCashflowWidget.test.ts` — fixture/path updates for the gate + Home move
- Neomatrix: `financial-graph.json` (1 anchor re-pinned `budgetAnalysisGenerate.POST` 68→69; `estimatedTax` 421→420; `listTileCashflow` 722→475 `cashflowOf`; 4 Home KPI-tile nodes re-pinned to `HomeClient.tsx`) + `GENERATED_CORE.md` regenerated + Layer-0 `coverage-allowlist.json` (28 new files, local-CLI precedent) + `content-manifest.json` rehash (4 anchored files, nodes re-verified)
- `docs/strategy/PROD_SIMPLIFICATION_PLAN.md` — §2.3 FINAL audit table; P1.1–P1.9 ticked with evidence; cursor + §9 session log

### Build Status — PR-B
- [x] TypeScript compiles (`npx tsc --noEmit` clean)
- [x] `npm run build` passes (compiled + types valid, EXIT=0)
- [x] Full vitest suite: 313 files · **4,503 passed · 0 failed** (69 skipped)
- [x] Changed-files lint: 0 errors (2 pre-existing warnings carried in moved/edited files). Repo-wide `npm run lint` has ~100 pre-existing errors in untouched files — documented, not introduced.
- [x] `neomatrix:check` · `lint:financial-surfaces` · `lint:source-lock` · `census:producers:check` · `lint:ai-grounding` · `issues:check` (146 valid) · `mon131:check` (no MON-131 surface) — all green

### Coverage boundary (stated precisely)
The new tests verify the gate reader (fail-closed, keyed cache, invalidation), the nav-key inventory +
filter, the guard helpers' 503/404/redirect contracts, and the registry invariants. They do NOT verify:
every one of the 60+ guarded handlers end-to-end (they share the two guard helpers verbatim), the
rendered 404 page, the admin panel UI interactions, or the P1.10 golden self-diff — that acceptance is
the Matrix's run, recorded before merge.

### Fix-up (PR-B, same day): preview build failure — 3 stale financial-math baseline anchors
The Vercel preview build failed in `lint:financial-surfaces`: the guard-insertion line shifts moved
3 grandfathered `.audit/financial-math-baseline.json` entries (intelligence:452→453, safety-net:75→78,
79→82). Re-anchored the 3 entries — same debt, same count (32 grandfathered), zero new violations.
Process note: the earlier local gate run chained commands with `;` and read tails, which masked this
lint's non-zero exit — re-ran the whole chain with `&&` semantics before pushing (all green).
