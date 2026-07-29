# Monitrax ↔ Neomatrix / Neobrain / NeoAudit — full alignment sweep (2026-07-29)

> **Reza directive (2026-07-29):** *"Do a full and deep sweep of Monitrax vs NeoMatrix, NeoBrain and NeoAudit and all the changes we made during the issue fixes and make sure they are all aligned — specially neoMatrix that is supposed to be the Brain Graph of Monitrax."*

**Scope.** Every MON-referencing merge PR from 2026-06-25 (`#1336`) to 2026-07-28 (`#1519`, PR-A), read at source in a full-depth clone of `main` at `ab9f65e`. Read-only: no production data touched, no browser session, no API probe. Predecessor: `NEOMATRIX_FULL_ALIGNMENT_AUDIT_2026_07_14.md` — its G1–G7 gap list is the baseline this sweep measures against, and nothing already recorded there is re-raised as new.

**Method note (§22.2.4).** Every number below is either a verbatim gate printout, a `git` fact, or a direct file read. Nothing is a claim.

---

## 1. The headline

**Every Neomatrix gate is green, and the Brain Graph is materially out of alignment with Monitrax.** Those two facts are not in tension — they are the finding. The gates measure *presence* and *file-level coverage*; none of them measures *semantic currency*. A node can assert the opposite of what its own code does, and every gate stays green.

Gate printout at `ab9f65e`, verbatim:

```
Neomatrix: 279 nodes, 378 edges (verified 378).
   ⚠ A2: 166 engine/orchestrator node(s) not yet bound to an astHash
   ⚠ A4: 21 edge(s) carry a unit transition
Neomatrix check: OK (schema valid, invariants hold, markdown fresh).
Layer 0 coverage: 1119 .ts(x) on disk · 1098 in graph · 25 allowlisted · 0 uncovered
✓ Layer 0 complete — every source file under lib/+app/ is represented or allowlisted.
  L0 structural (Graphify): 1098 files · 8756 nodes — whole codebase, gated
  Semantic→L0 binding: 170/170 file anchors resolve
✓ every semantic anchor resolves to mapped code.
Neomatrix census gate: 193 proven · 215 modelled · 0 uncovered · 49 excluded
```

The line **"whole codebase, gated"** is false. See F3.

### Campaign coverage — the one number that answers the directive

Union of every `lib/`, `app/` and `components/` `.ts`/`.tsx` file changed by any MON-referencing merge PR since 25 June:

| | files | share |
|---|---|---|
| Touched by the issue-fix campaign | **146** | 100% |
| …has a **semantic** Neomatrix node | 48 | **32%** |
| …Layer-0 only (structural, no semantic node) | 66 | 45% |
| …in **neither** layer | 32 | **21%** |

Every capture-layer artefact from the campaign's own focus area is in the *neither* bucket: `components/tax/Div152AssessmentCard.tsx`, `components/tax/PsiAssessmentCard.tsx`, `components/tax/citationLine.ts`, `app/api/tax/entity/[entityId]/psi-assessment/route.ts`, `app/api/tax/entity/[entityId]/div152-assessment/route.ts`.

So: a session obeying §21.5 ("start at the Neomatrix, trust it for what it models") and tracing the Div 152 overlay would find the engine node, read authority text stating the overlay is inert (F1), and find nothing at all for the card that renders it.

---

## 2. New findings

All nine were filed through the NeoAudit §3.1 finding bus (`npm run issues:raise`) before this document was written, so the register — not this document — is the system of record:

| finding | ticket | severity | changes a Monitrax number? |
|---|---|---|---|
| F1 — tax-overlay nodes declare themselves inert | **MON-112** | HIGH | no (graph authority text) |
| F2 — neo-sync gate 8 is a presence check | **MON-113** | HIGH | no (gate + generator) |
| F3 — `components/` outside Layer-0 ROOTS | **MON-114** | HIGH | no (gate scope) |
| F4 — duplicate `buildMasterTaxPosition` identity | **MON-115** | HIGH | no (graph node identity) |
| F5 — anchor drift undetected for 109/279 nodes | **MON-116** | HIGH | no (gate scope + 3 anchor corrections) |
| F6 — $500k cap cited to the wrong provision, 7 places | **MON-119** | MEDIUM (user-visible) | **no** — citation only, $500,000 stands |
| F7 — `proven-engines.json` 14 days stale | **MON-117** | MEDIUM | no (generated artefact) |
| F8 — NeoAudit §7 misclassifies MON-109/110; detector scope | **MON-118** | MEDIUM | no (labels + detector scope) |
| F9 — `issues:raise` false dedupe on semanticKey+surface | **MON-120** | MEDIUM | no (tooling) |

**Not one of the nine proposes changing a result.** Every fix lands on an engine, a gate, a generator, or a citation.

### F1 — Three tax-overlay engine nodes still declare themselves inert, after the PRs that made them live. **HIGH** — `MON-112`

`engine.tax.psi.classifyPsi` (`lib/tax-engine/divisions/psiClassifier.ts:151`, `verifiedDate 2026-07-24`) authority still ends:

> "Honest scope: PSI inputs are not yet CAPTURED product-wide (no schema/assembler fields), so no live number moves until a capture feature ships"

`engine.tax.fteIee.classifyFteIeeDistributions` and `engine.tax.div152.applyDiv152` carry the identical disclaimer, the latter reading "captured NOWHERE product-wide".

MON-101 (`6972474`), MON-102 (`251ecb3`) and MON-103 (`796ed0b`) shipped exactly that capture. Each added its assembler node, and those nodes say the opposite — `engine.services.entityTaxFactsAssembler.buildDiv152Input` (verified 2026-07-27):

> "Wired to the live route via assembleDiv152Input (:319) → /api/tax/entity/[entityId] GET → buildMasterTaxPositionDecimal input.div152ByEntity."

**The graph contradicts itself in adjacent nodes.** This is the inverse of the 14-July audit's G4 ("3 production-unwired tax engines"): G4 was closed in code and never closed in the map. Under §21.5 clause 2 the graph *is* the authoritative answer for a modelled engine, so this actively misleads.

**Root cause:** each capture PR added a node instead of revising the node whose scope it changed. The neo-sync gate cannot tell the difference (F2).

### F2 — Neo-sync (gate 8 / §21.2.2) is satisfiable by a line-number bump. **HIGH** — `MON-113`

PR-A (`e46a676`, MON-104/105/107/108/109/110) changed six issues' worth of tax-surface behaviour. Its entire `financial-graph.json` diff:

```
-"line": 377,   +"line": 407,
-"line": 150,   +"line": 161,
-"line": 141,   +"line": 151,
```

**+0 nodes, +0 edges.** Gate 8 passed. The gate asks "did the graph file change in this PR?" — a presence check, never a substance check.

Corroborating: `financial-graph.json` carries `"version": "0.56.0"` and `"lastReviewed": "2026-07-08"`. The file has been edited on 24, 26, 27 and 28 July; neither field moved on any of them. `"builtAtCommit": null`.

**Fix shape:** the gate should require, for any PR touching a file bound to a semantic node, either a node/edge *content* change or an explicit `--no-model-change` justification recorded in the PR body; plus a freshness stamp (`lastReviewed`/`builtAtCommit`) written by the generator rather than by hand.

### F3 — `components/` is outside Layer 0 by construction; the gate reports "whole codebase, gated" over a denominator that excludes it. **HIGH** — `MON-114`

`scripts/neomatrix/check-layer0-coverage.mjs:23`:

```js
const ROOTS = ['lib', 'app'];
```

`structural-graph.json._meta.roots` is likewise `["lib","app"]`. Files by top-level directory in the structural graph: `app` 540, `lib` 557, **`components` 1**. On disk: **351** `.ts`/`.tsx` files under `components/`.

The gate then prints `0 uncovered` and `whole codebase, gated` — true only of the denominator it chose. Because `components/` is never enumerated as on-disk, no gate can ever surface this; it is invisible by construction, not by oversight.

This is material, not cosmetic: the render layer is where MON-107/108 (wrong citation), MON-109 (threshold literals) and MON-110 (surface arithmetic) all lived. The 14-July audit's G6 recorded that pure-UI is "L0-structural-only" — that sentence is what this finding corrects. Pure UI is in *neither* layer.

### F4 — Duplicate orchestrator identity splits the canonical producer's lineage. **HIGH** — `MON-115`

Two nodes model the same file and the same function (`lib/tax-engine/orchestrator/masterTaxPosition.ts` / `buildMasterTaxPosition`):

| node id | label | fed by |
|---|---|---|
| `orchestrator.masterTaxPosition.buildMasterTaxPosition` | Master tax position | entityTaxRouter, crossStateAggregator, stateStampDuty, gstCalculator |
| `orchestrator.tax.masterTaxPosition.buildMasterTaxPosition` | Master tax position (per-entity + cross-cutting) | psi, fteIee, div152, trustLossRules, companyLossRules, capitalLossNetting, trustDistribution, div7a |

No edge joins them. Monitrax's single most important tax producer has **two** identities in the map, each holding half its inputs — the exact §12.2.1 / Calc-SSOT violation the graph exists to detect, occurring inside the graph itself. Any session tracing "what feeds the master tax position" gets a half-answer depending on which node it lands on.

(For contrast, the same-tail Prisma pairs — `input.Property.currentValue` / `input.PersonalAsset.currentValue`, `input.Income.declared` / `input.Expense.declared` — are benign distinct fields. Dangling edges: **0**.)

### F5 — Anchor drift is undetected for 109 of 279 nodes, and `line` is never checked at all. **HIGH** — `MON-116`

`check-binding-coverage.mjs` gates only three node kinds, at file granularity:

```js
const CODE_KINDS = new Set(['engine', 'orchestrator', 'number']);
const inL0Scope = (f) => f && (f.startsWith('lib/') || f.startsWith('app/')) && /\.tsx?$/.test(f);
```

`ui-surface`, `law`, `input-field` (Prisma) and `verification` (tests) are exempt — 109 nodes, 39%. `line` is not compared for any node, including the 170 that are gated. Three drifts confirmed by direct inspection:

| node | graph anchor | actual |
|---|---|---|
| `ui.cashflow.hero` | `app/dashboard/cashflow` | **directory does not exist** — the route is `app/(dashboard)/cashflow` |
| `input.NetWorthSnapshot` | `prisma/schema.prisma:3426` | `model NetWorthSnapshot` at **3525** |
| `input.InvestmentAccount.cashBalance` | `prisma/schema.prisma:2168` | `model InvestmentAccount` at **2254** |

The first one has already cost real time: `/dashboard/cashflow` is the 404 that broke a Ring-3 run. The Brain Graph is the artefact that should have prevented it, and instead is where the wrong path is recorded.

### F6 — The $500,000 CGT retirement-exemption cap is cited to the wrong provision in seven places, one of them rendered to the user. **MEDIUM (user-visible, tax)** — `MON-119`

Verified against primary source (AustLII, ITAA 1997):

- **s152-320 "Meaning of CGT retirement exemption limit"** — *"An individual's CGT retirement exemption limit at a time is $500,000 reduced by the CGT exempt amounts of CGT assets specified in choices previously made…"* This is the provision that states the cap.
- **s152-305 "Choosing the exemption"** — conditions for making the choice. States no dollar figure.
- **s152-310 "Consequences of choice"** — tax consequences of the election. States no dollar figure.

Monitrax at `ab9f65e` cites the cap to s152-305 or s152-310 in every instance, and never to s152-320:

| location | text |
|---|---|
| `components/tax/Div152AssessmentCard.tsx:353` | **`Lifetime cap {formatCurrency(RETIREMENT_LIFETIME_CAP)} — s152-305`** ← rendered to the user |
| `lib/tax-engine/divisions/div152SmallBusinessConcessions.ts:149` | `export const RETIREMENT_LIFETIME_CAP = 500_000; // s152-310 lifetime cap` |
| same, `:23` | `s152-305 — retirement exemption (capped at $500k lifetime)` |
| same, `:289` and `:493` | `Cumulative cap is $500,000 per s152-310` (rationale string, user-facing) |
| `financial-graph.json` authority | `s152-305/310 retirement exemption ($500k lifetime)` |
| `tests/tax/mon109ThresholdTrace.test.ts` | `expect(RETIREMENT_LIFETIME_CAP).toBe(500_000); // s152-310` |

**This changes no number** — the $500,000 value is correct and s152-305/310 are the right citations for the *exemption itself*. What is wrong is the provision attributed to the *limit*. This is precisely the MON-107 class (a card citing the wrong provision for what happened), and PR-A's citation sweep fixed lines 253 and 392 of the two cards while line 353 carried the same defect untouched — so it is a miss by that sweep, not a duplicate of it.

### F7 — `proven-engines.json` is 14 days stale and no gate regenerates it. **MEDIUM** — `MON-117`

Running `npm run neomatrix:proven` at `ab9f65e` produces a diff against the committed file:

```
-  "count": 57,
+  "count": 58,
+    "engine.rentalReconciliation.reconcileManagedRental",
```

That engine was proven on 2026-07-16 (`de59655`, Phase 59 / MON-079). The committed file was last regenerated **2026-07-15** (`f564ab8`). `generate-proven-set.mjs` has no `--check` mode and is not part of `neomatrix:check`, so the explorer's "Proven engines" view has been silently missing a proven engine for two weeks. Small in itself; it is the same class as F2 — a generated artefact with no regeneration gate.

### F8 — NeoAudit's §7 tooling register misclassifies the campaign's two newest detectors, and their scope is one non-recursive directory. **MEDIUM** — `MON-118`

`docs/blueprint/NEOAUDIT.md` lines 206–207 register MON-109 and MON-110 as **`R1-lint`**. Both are vitest suites, not lint rules. `scripts/` contains only `lint-ai-grounding.mjs`, `lint-financial-surfaces.ts`, `lint-source-lock.ts`; none carries a `components/tax` or threshold pattern, and `@tax-threshold-allowed` — the escape hatch the register documents — appears nowhere in the codebase outside the test that defines it. The classification matters because §9 reviewer enforcement and the release scorecard key off ring labels.

Scope: both detectors do scan a directory rather than an enumerated file list (good — a new card is caught), but:

```ts
const DIR = join(process.cwd(), 'components/tax');
const files = readdirSync(DIR).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
```

Non-recursive, one directory. `app/dashboard/entities/[id]/tax/page.tsx` — which holds `FY_OPTIONS` and the Div 152 eligibility gating, i.e. the MON-104 and MON-105 surfaces — is not covered, nor is `app/dashboard/tax/`.

Separately: NEOAUDIT.md references **10** MON ids across the entire ~100-issue campaign (013, 017, 019, 020, 028, 030, 034, 048, 109, 110). Step 10 of the fix loop ("every verified finding grows NeoAudit's permanent structure") is being honoured for roughly one issue in ten.

### F9 — The finding bus de-dupes on `semanticKey` + `surface` alone, and silently swallowed a real new defect. **MEDIUM** — `MON-120`

Found by using the bus, not by reading it. Filing F6 with the natural surface returned:

```
$ npm run issues:raise -- --surface components/tax/Div152AssessmentCard.tsx \
                         --semantic-key engine.tax.div152.applyDiv152 …
duplicate of MON-103 (shares a semanticKey + surface). No new ticket.
```

MON-103 is the Div 152 **capture Stage 3** issue — a different defect class entirely, already FIXING. The bus matched on `(semanticKey, surface)` and nothing else: not title, not symptom, not severity, not status. F6 was re-raised against the deeper SSOT surface (`lib/tax-engine/divisions/div152SmallBusinessConcessions.ts`) and filed as MON-119.

This is a **silent** failure, which is what makes it more than an annoyance. NeoAudit §3.1 declares one finding bus and step 10 of the fix loop routes every verified finding through it; a heavily-worked file accumulates tickets, and from that point every genuinely new defect on it is absorbed into whichever ticket got there first. Nothing is logged, nothing is queued for review, and the operator sees a success-shaped message. Had F6 not been re-raised on a second surface it would simply not exist.

**Fix shape:** dedupe should require title/symptom similarity in addition to `(semanticKey, surface)`; a near-match should print the candidate and require `--dedupe-of MON-NNN` or `--force-new` rather than deciding silently; and a suppressed raise should be recorded either way so the swallow is auditable.

---

## 3. Third-Law (§21.2.2) compliance, PR by PR

Every code-changing merge PR from `#1336` to `#1519` was classified by whether it carried a Neomatrix (FG), Neobrain (NB) or `.audit` (AX) artefact. The picture is **broadly good** — most carry FG. Six carried no Neo artefact at all; each was read at source rather than assumed:

| PR | issue | verdict |
|---|---|---|
| `#1368` | VR-010 | **No drift** — docs-only (a verification record). |
| `#1462` | MON-088 | **No drift** — admin sidebar + docs. No financial logic. |
| `#1411` | MON-042 | **No drift** — label and description copy on the household-profile vehicle input. |
| `#1357` | MON-005/022 | **Borderline** — display *suppression* rules (no yield on a non-investment; no gain pill without a known purchase price). No formula moved, but the rule "when is this number meaningful" is exactly what a `law`/`ui-surface` node is for. |
| `#1356` | MON-015 | **DRIFT.** Changed the *composition* of a displayed total (added Loans and Assets rows so visible rows sum to the headline — the −$655 gap), changed the period label annual→monthly, and re-sourced the entity count. The formula `total = incomeNet + propertiesNet + investmentsNet − standaloneLoansCost + assetsNet − expensesNet` now lives in a **code comment in `components/dashboard/tiles/GlassInsightTiles.tsx`** — a file in neither graph layer — and the component applies its own `-Math.abs(...)`. |
| `#1494` | MON-045/077 | **DRIFT.** Removed an entire advisory rule class from `lib/cfo/decisionSupport/taxIntegration.ts` — a file that *has* a semantic node (`engine.taxIntegration.calculateUnrealisedCGT`) — encoding the MON-045 fact that property loan interest is auto-claimed into `taxPosition.deductions.property`. Behaviour changed in a modelled file with no model change. |

Of the fourteen `.audit`-only PRs, four are docs-only (legitimately no model change). The other ten touched code, and the same unmodelled files recur: `app/api/income/route.ts`, `app/api/transactions/[id]/link/route.ts`, `app/dashboard/income/page.tsx`, `lib/intake/detectors.ts`, `components/transactions/TransactionLinkDialog.tsx`. These are the campaign's most-churned files — `app/api/transactions/[id]/link/route.ts` was touched by **14** PRs — and not one of them has a semantic node.

**Read together with F3:** the Third Law is being followed in *letter* on nearly every PR and is not producing alignment, because the files the campaign actually churns are mostly outside the semantic layer, and the gate that enforces the law cannot see whether the update was substantive.

---

## 4. What is healthy — cleared, with evidence

| Area | Evidence |
|---|---|
| **A6 islands / Neo-G4** | `A6_ISLAND_ALLOWLIST = {}` in `graphlib.mjs` — genuinely empty, no A6 warnings. The three tax overlays really are wired (which is what makes F1 a documentation defect rather than a wiring one). |
| **Exception ratchet** | `.audit/financial-math-exceptions.json` holds **4** records and has been flat at 4 through the entire campaign, PR-A included. It rose 3→4 once, early (`77a5017`), and never again. The ratchet held. |
| **Graph integrity** | 0 dangling edges; 378/378 edges verified; 170/170 gated file anchors resolve; schema valid. |
| **Neobrain** | The healthiest of the three. `PHASE_54_NEOBRAIN.md` moved with the work it describes (`9a01cb5` 2026-07-21 assessable-only gross; `49fc262` 2026-07-19 Mechanism A keystone). `engine.intake.classifyIntake` resolves correctly to `lib/intake/classifyIntake.ts:158`; `engine.intake.findDuplicateGroups`, `law.intake.oneRowPerSource`, 9 `law.neobrain.*` and 3 `engine.neobrain.*` nodes are all present and current. **No Neobrain finding.** |
| **Detector design** | MON-109/110 scan by directory, not by file list — a newly added card in `components/tax/` *is* caught. The defect is scope and labelling (F8), not design. |

---

## 5. Known gaps from 2026-07-14 — status, not re-raised

| ref | 14 Jul | 29 Jul | movement |
|---|---|---|---|
| **G1** L0 allowlist (graphify offline) | 11 entries | **25 entries**, 22 of them "graphify offline / self-prunes on next run" | **worsened.** Phase A never ran. `structural-graph._meta` now records a *hand-move* ("Hand-move 2026-07-28 (graphify offline…)"). The file's own note says "keep this list SHRINKING". |
| **G2** A2 astHash binding | 155 unbound | **166** | worsened with growth; drift sentinel still pending |
| **G3** A4 unit transitions | 10 edges | **21** | worsened with growth |
| **G4** 3 unwired tax engines | open | **closed in code, open in the map** | → **F1** |
| **G5** proven↔modelled reconciliation | pending | 6-item backfill worklist, all `lib/cfo/scoreCalculator.ts` (cashflowStrength, debtCoverage, emergencyBuffer, investmentDiversification, savingsRate, spendingControl) | unchanged |
| **G6** semantic scope = financial only | awaiting sign-off | still awaiting; **and its premise is wrong** — pure UI is not L0-covered either | → **F3** |
| **G7** doc alignment | no gate | still no gate | → F2's freshness stamp is a partial answer |

**The single most consequential item is G1.** Phase A (run graphify where the binary exists) has been queued for 15 days while the workaround — allowlisting each new file with a "self-prunes next run" note — has more than doubled the allowlist and now includes hand-editing a file marked *"Generated; do not hand-edit."* Everything downstream of Layer 0 inherits that staleness.

---

## 6. Recommended order of work

1. **F1** — revise the three engine-node authority strings (documentation only, no code, no number). Cheapest, highest-value: it stops the map lying to every future session.
2. **G1 / Phase A** — run `npm run neomatrix:graphify` in a binary-capable environment, commit the refreshed structural graph, prune the 22 self-prune entries. Unblocks F3's measurement.
3. **F3** — add `components` to `ROOTS`, land the resulting coverage delta honestly (it will be large), and correct the gate's "whole codebase" wording either way.
4. **F2** — make gate 8 substantive: content-diff requirement + generator-written `lastReviewed`/`builtAtCommit`. **F7** folds in here (add a `--check` mode to `generate-proven-set.mjs` and put it in `neomatrix:check`).
5. **F4** — merge the two `buildMasterTaxPosition` identities into one node carrying all twelve inputs.
6. **F6** — correct the cap citation to s152-320 in all seven places (a MON-107-class citation fix; changes no number).
7. **F5** — extend `check-binding-coverage.mjs` to all node kinds and to `line`, then fix the three confirmed drifts.
8. **F8** — reclassify the two §7 rows to their true ring, widen detector scope to `app/dashboard/tax/**` and `app/dashboard/entities/[id]/tax/**` recursively.
9. **F9** — make the finding bus's dedupe explicit rather than silent. Small, and it should arguably be *first*: until it is fixed, every finding raised on an already-ticketed file may be swallowed, including the fixes for items 1–8.
10. **#1356 / #1494** — retrofit the two confirmed Third-Law misses.

Items 1, 6, 8 and 9 are documentation/citation/tooling only and change no Monitrax number. Items 3, 4, 5, 7 change the map, not the product. Item 10 changes neither — it records what already shipped.

---

## 7. Standing-law compliance of this sweep

- **No number was fixed.** No production data was touched, no browser session opened, no API probed. Every finding is a root-cause statement or a documentation defect; none proposes altering a result to match an expectation.
- **Nothing stays sandbox-only** (§21.2.2 clause 4) — this document and the MON entries it raises land in the repo via PR.
- **Findings are raised, not silently reconciled** (§21.5 clause 5) — all nine F-items are filed as MON-112 … MON-120 through the §3.1 finding bus. Registry gate after filing: `✓ Issue registry gate: 120 issue(s) valid.`
- **The one gate run that dirtied the tree was diffed, not discarded.** `npm run neomatrix:proven` modified `proven-engines.json`; reading that diff is what produced F7. The working-tree change was then reverted (`git checkout --`) so this PR carries no regenerated artefact — F7's regeneration belongs to its own fix PR with its own gate.

*Prepared by The Matrix, read-only, at `main` = `ab9f65e`. Predecessor: `NEOMATRIX_FULL_ALIGNMENT_AUDIT_2026_07_14.md`.*
