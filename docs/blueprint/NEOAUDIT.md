# NEOAUDIT — the Monitrax verification platform

> **NeoAudit is the audit arm of the Neo family: the Neomatrix is the MAP (what every number is, how it's produced, where it renders); NeoAudit is the PROOF (is the app true to the map — everywhere, always, on any data).** It is NOT a new platform in the Part 22 sense: it consumes the ONE inventory (`calcEngineRegistry`), the ONE map (Neomatrix), and the ONE proof spine (calc-audit fixtures), and adds rings, scenarios, briefs and a scorecard on top.
>
> Law: `CLAUDE.md` Part 23 (four rings, REMOVE-THE-CULPRIT, the Ratchet, VERIFIED-requires-Ring-3). Ring-3 operating manual: `docs/verification/VERIFICATION_PLAYBOOK.md`. Tickets: `docs/issues/ISSUES.json` (MON-###). This doc is the platform blueprint.
>
> Reza directives (2026-07-11/12): *"zero fail … 100% correctness"* · *"remove the culprit — do not add more code on top of the broken one"* · *"check the numbers and everything on Monitrax … tiles, dashboards, secondary calculations"* · *"Claude Chrome to be my eyes and ears"* · *"push buttons, check results (not changing any numbers)"* · *"I don't want to duplicate tools on same functions or overstep each other — clear roles and responsibilities with well defined handshake procedure."*

---

## 0. What NeoAudit is — and how Reza uses it (operator guide)

**It is three things in layers; your personal surface is deliberately tiny.**

| Layer | What it is | Who operates it | What you do |
|---|---|---|---|
| **System** (most of it) | rules + gates baked into CI, the Vercel build and CLAUDE.md — rings 0–2, parity matrix, scenario lab, Stryker, linters | itself, on every PR | nothing — green/red on the PR. Red blocks merge; Claude fixes it |
| **Platform** | the in-app NeoAudit admin panel: one button → invariants + Release Scorecard computed on YOUR real data | you, one click | open it after money merges / before a release. **Green scorecard = safe to publish** — that IS the publish decision |
| **Tool** | the Chrome brief library (Eyes & Ears) | you, by relay | paste the brief Claude hands you, let Chrome run, paste the report back (~10–15 min, scheduled; shrinks over time as checks are promoted into CI) |

**Your complete usage manual — four interactions:**
1. **Merge PRs when green.** Nothing else at the system layer needs you.
2. **Open the NeoAudit panel** after money-touching merges and before any release → read PASS/FAIL + the scorecard.
3. **Run a Chrome brief when handed one**; paste the output back. Claude compares, raises MON tickets, ratchets tests.
4. **Confirm fixes on your numbers** when asked — your "yes" moves an issue to VERIFIED. Browse `docs/issues/ISSUES.md` anytime as the plain-English ledger of everything found / fixed / pending.

You never memorise rules: CLAUDE.md Part 23 binds every Claude session to this machine automatically, and the playbook lets any future session run it cold.

## 1. Architecture — rings, nodes, and the ONE handshake

### 1.1 The rings (from CLAUDE.md Part 23, unchanged)

| Ring | Proves | Runs |
|---|---|---|
| **0 — Engine** | each formula right on worked examples + generated properties | every CI |
| **1 — Wiring/SSOT** | one producer per number; graph anchors resolve; no re-derivation | every CI + build |
| **2 — Golden end-to-end** | known synthetic data → the real route/serialization/page path → the exact hand-computed number + pixels; same-`semanticKey` surfaces agree | every CI |
| **3 — Real/rendered** | invariants + parity + judgment on live data and rendered UI | post-merge / scheduled |

### 1.2 Roles & responsibilities — ONE QUESTION, ONE TOOL (non-overlap contract)

Every check lives at **exactly one node**. A node answers its question and nothing else. No tool asserts what a lower ring already asserts.

| Node | Tool (owner) | Sole responsibility — the ONLY question it answers | Hands off to |
|---|---|---|---|
| **R0-fix** | vitest + calc-audit fixtures | "Is this formula right on these worked examples?" | registry on FAIL |
| **R0-gen** | **fast-check** (`@fast-check/vitest`) | "Does this engine hold its mathematical properties on thousands of generated inputs?" (monotonicity, round-trips, additivity, bounds) | shrunk counter-example → a new R0-fix fixture + MON ticket |
| **R1** | `neomatrix:check` + surface linter + source-lock tests | "Is there exactly one producer, correctly wired, at a resolvable anchor?" | registry on FAIL |
| **R2-num** | Playwright checked-in specs + golden seeds | "Does the rendered page show the manifest's exact number on golden data?" (text assertions ONLY) | registry on FAIL |
| **R2-vis** | Playwright `toHaveScreenshot()` (→ Argos later) | "Do the pixels match the approved baseline?" (NEVER asserts numbers) | registry on FAIL |
| **R3-agent** | **Playwright MCP** (Claude session, headless) | "Exploratory: does anything look wrong on a golden-seeded preview?" — agent-driven, synthetic data ONLY, no permanent assertions live here | every repeatable discovery is **promoted** to an R2 spec (and stops being an R3 check); finding → MON |
| **R3-self** | self-audit endpoint `/api/verify/invariants` + admin panel | "Do the invariants hold on the user's REAL data right now?" (server-side, first-party only) | FAIL → MON with lhs/rhs/delta |
| **R3-eyes** | **Claude-in-Chrome** (Reza relay, brief library §4) | "On real data, rendered: judgment — numbers cross-checked, copy, forms, visuals, functionality, journeys" — ONLY what no automated ring can judge | findings → MON; anything mechanical → Ratchet to R2/R0 |
| **Guard-tests** | **StrykerJS** (weekly, scoped to `lib/calculations` + `lib/tax-engine` + `lib/health`) | "Would the test suite actually catch a broken formula?" | surviving mutant → MON (test-gap class) |
| **Guard-crash** | **GCP Error Reporting** (§13.9) | "Did production throw?" (crashes/NaN renders ONLY — never numeric correctness) | alert → MON |

### 1.3 The handshake procedure (how nodes interoperate without mixing)

1. **All findings flow through ONE node: the issue registry** (`docs/issues/ISSUES.json`). No side-channels — not chat memory, not PR comments, not tool dashboards. Every node's FAIL becomes a MON-### with evidence (surface, expected, actual, run/job ID); `npm run issues:raise` (queued build) pre-fills it; de-dup by semanticKey+surface.
2. **Fixes travel DOWN (the Ratchet):** a bug found at ring N gets its permanent test at the LOWEST ring that could have caught it. The higher ring then never re-checks it — promotion, not duplication.
3. **Discoveries travel UP only as tickets:** R3 nodes never grow permanent assertion suites; the moment a check is repeatable it moves into R2/R0 and is DELETED from the R3 scope.
4. **Data boundaries are absolute:** third-party/agentic tools (fast-check, Playwright MCP, Stryker, visual diff) operate on synthetic/golden data only. Real data is touched by exactly two nodes — R3-self (first-party code) and R3-eyes (Reza's own browser). CDR: nothing real ever leaves first-party (§13).
5. **The scorecard is the ONE aggregation point** (§6): each node reports green/red into it; no node interprets another node's results.

**Anti-overlap acceptance rule (reviewer-enforced):** a PR adding a check must state which node owns it and why no lower node can. A check added at two nodes, or a tool asserting outside its "sole responsibility" column, is rejected — that's the §12.2.1 duplicate-source rule applied to tests.

---

## 2. Scenario Lab (the data NeoAudit runs on)

**Tier 1 — authored scenarios** (`tests/golden/scenarios/`): named households, each with a manifest of hand-computed expected values (§19.2) for every headline number, tile, report line, and CFO flag. Starting six: `base` (mirrors Reza's real shapes — fortnightly rent, geared + owner-occupied + $0-purchase, one-offs, partial reconciliation) · `high-gear` (104% LVR, IO loan, negative cashflow) · `renter` · `retiree` · `edge` ($0-income month, uncategorised, transfers, negative equity) · `reform-straddle` (assets either side of 2026-05-12; Phase 41E regimes).

**Tier 2 — combinatorial mutation with an independent oracle:** a generator mutates scenarios along axes (frequency × ownership × loan type × reconciliation depth × one-offs × negative equity); expected values come from the **calc-audit Decimal shadow engines extended to snapshot level** — a second derivation, so the engine is never checked against itself. (Part 22: new properties = new fixtures on the same spine, never a parallel silo.)

**Tier 3 — metamorphic invariants** (fast-check-driven): laws that hold under ANY input — add $100/mo expense ⇒ cashflow −$100/mo on every surface, net worth unchanged; add a transfer ⇒ nothing changes; double all amounts ⇒ ratios unchanged, totals double; sell property ⇒ net worth continuous. These catch combination bugs no enumerated scenario can.

Historical seed: every finding in `docs/audits/*` and every closed MON becomes a scenario row or decision-table row — past bugs are permanent scenarios.

## 3. Judgment layers — CFO, budgeting, reports

- **Numeric inputs:** every figure a CFO card/report cites is a graph node → covered by the parity matrix (§5).
- **Decision tables:** each recommendation rule gets explicit given→then fixture rows (LVR>100% ⇒ NO refinance rec; negative cashflow ⇒ no positive-cashflow credit; monthsCovered<1 ⇒ EF rec present and first). VR-001's refinance-at-104% is row one. Wrong advice = build failure.
- **Report reconciliation locks:** Σ report lines === canonical total (same pattern as `expenseLines`/`loanLines`); reports render under R2 golden.
- **AI advisor:** `lint:ai-grounding` + scenario tests assert the advisor's tool layer can only surface canonical figures.

## 4. Eyes & Ears — the Claude-in-Chrome brief library (R3-eyes)

Versioned briefs (paste-and-run, machine-comparable output); canonical texts live in `docs/verification/VERIFICATION_PLAYBOOK.md`:

| # | Brief | Scope | Cadence |
|---|---|---|---|
| 1 | **VR — Numbers** | cross-surface parity, invariants, regression snapshot vs baseline | after every money-touching merge |
| 2 | **UX & Copy** | warm-words rule (§14), no jargon/shaming/emojis/"!", AFSL GAW present, AU formats | weekly rotation |
| 3 | **Forms** | labels, defaults, validation messages, error states — fill + validate + **Cancel** (no saves) | per release |
| 4 | **Visual QA** | §18.7.2 conformance on real data: dark mode, truncation, alignment, pills, empty/loading states | per release |
| 5 | **Journeys** | TRAIL flows end-to-end; CFO advice read against visible data — does it make sense | per release |
| 6 | **Reports** | report totals tie to on-screen totals; formatting, completeness | per release |
| 7 | **Functional** | every control does something sane (§6.7 no-dead-ends); navigation truth; what-if levers move outputs in the RIGHT DIRECTION (UI metamorphic checks); states appear | per release |

**Safety contract (verbatim in every brief):** (1) NEVER Save/Submit/Delete/Confirm on a real record — Cancel out of every form; (2) ephemeral surfaces (what-if sliders, previews, filters) are unrestricted; (3) anything behind a confirmation dialog = hard stop, report instead; (4) writes only in an explicitly-labelled `[ACTION]` step approved per run — labelled test records, verified, then deleted.

## 5. Parity matrix (Neomatrix-driven test generation)

A generator reads `financial-graph.json` and emits one R2 check per (semanticKey × surface-pair): the same number, on every surface that renders it, must be equal on golden data. Coverage is therefore **generated from the map, never hand-listed** — and the existing census/binding gates already fail the build if a money surface isn't modelled. New tile ⇒ must be in the graph ⇒ automatically in the matrix.

## 6. Release Scorecard (the publish gate)

One generated readout — publish when ALL green: Rings 0–2 green on CI · R3-self invariants ALL PASS on live data · latest VR run clean vs `docs/verification/baselines/BASELINE.md` · zero OPEN number-issues in the registry · Stryker weekly: no unreviewed surviving mutants in scoped engines. Rendered in the NeoAudit admin panel; stated only as gate output, never as a claim (§22.2.4).

## 7. Tooling register (researched 2026-07-11; full evaluation with sources in the changelog)

| Tool | Node | Verdict | Reason (one line) |
|---|---|---|---|
| fast-check | R0-gen | **ADOPT NOW** | zero-infra property/metamorphic engine on the existing vitest spine; targets our exact bug classes |
| Playwright MCP (Microsoft) | R3-agent | **ADOPT NOW** | agent-driven headless verification of golden previews; retires most of the manual Chrome relay; synthetic-only |
| GCP Error Reporting | Guard-crash | **ADOPT NOW** | already required by §13.9 (P1); GCP-first; crashes only |
| StrykerJS | Guard-tests | **ADOPT (scoped)** | weekly, incremental, `lib/calculations` + `lib/tax-engine` + `lib/health` only; never per-PR |
| Argos CI / Lost Pixel | R2-vis | later | only when `toHaveScreenshot` baseline churn hurts; Argos preferred (plain-Playwright, OSS) |
| axe-core (@axe-core/playwright) | R2 add-on | later | one-day add to the UAT job; quality, not numeric correctness |
| Chrome DevTools MCP | R3-agent debug | later | agentic console/network/perf reads when diagnosing R3 failures |
| Checkly | prod monitoring | at first paying user | GH-Actions cron + Vercel alerts cover today for $0 |
| Meticulous.ai | — | **SKIP — CDR-disqualified** | captures cookies/storage/network payloads to their cloud (verified from their docs) |
| Percy / Chromatic | — | skip | cost / Storybook-shaped for no marginal value |
| Hosted agent browsers (Browserbase etc.) | — | skip | needless third-party data path; local headless Playwright MCP suffices |
| AI "QA platform" vendors | — | skip | duplicate Claude Code + the checked-in suite |

**Boundary restated:** third-party tools operate on synthetic/golden data only; real data is first-party only (R3-self, R3-eyes).

## 8. Build plan (each its own PR, §20.4 scores recorded)

1. ✅ Foundations — Part 23 law, playbook, VR-001, baseline, ratchet tests (PRs #1358/#1359, merged)
2. ✅ Self-audit endpoint (`/api/verify/invariants`, PR #1361, merged) + NeoAudit admin panel (`/admin/neoaudit`, this PR) — R3-self + scorecard v1 (invariant half; CI/registry half = step 6)
3. Scenario Lab Tier 1 + R2-num golden route/Playwright tests (+ fast-check first ~10 properties)
4. Parity-matrix generator (§5)
5. CFO decision tables + report reconciliation locks (§3)
6. Tier 2 oracle + Tier 3 metamorphic + `issues:raise` + full scorecard; Stryker weekly job; Playwright MCP runbook for R3-agent
7. Later ring: Argos/axe/DevTools-MCP/Checkly per §7 triggers

## 9. Reviewer enforcement

Reject any PR/session that: (a) adds a check without naming its owning node, or at a node when a lower one could host it (anti-overlap); (b) lets a tool assert outside its sole-responsibility column; (c) routes findings anywhere but the registry; (d) exposes real data to any third-party/agentic tool; (e) grows permanent assertions inside R3 instead of promoting them down; (f) claims coverage as words instead of the scorecard's printout.
