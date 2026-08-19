# MONITRAX V1 MASTER PLAN — the ONE tracking document

**Status:** 🟢 LIVE TRACKER · **Raised:** 2026-08-19 · **By:** Matrix HQ (Cowork, Fable 5) on Reza's merge-the-docs directive · **At HEAD:** `380a526a`
**This document is THE single entry point and tracker for the Monitrax v1 programme — the shared channel between Reza, Matrix HQ (Cowork), Code sessions, and the Chrome relay.** One doc read, updated and tracked by all four; registries keep the detail (§8 doc map).

**Supersession:** this plan ABSORBS the live-tracking role of `PROD_SIMPLIFICATION_PLAN.md` (now the decision-record + design archive for the module gate — its §0 rulings and §2–§4 designs remain binding and are NOT restated in full here) and the roadmap role of `PRODUCT_SCOPE_V1_RECOMMENDATION.md` (Q-SCOPE-1, archived DECIDED). It does NOT absorb: `docs/issues/ISSUES.md` (the issue REGISTRY of record — this plan carries only the launch-blocking subset, §5), the MON-131 tranche ledger (owns tranche mechanics), or `STATE.md` (stays the cross-programme cursor; carries a pointer here). SSOT: one fact, one home, pointers everywhere else.

---

## 0. BOOT PROTOCOL — every session, every surface (no drift, no guesswork)

**Read order, before ANY work:**
1. **`CLAUDE.md`** — the repo laws (SSOT · never fix a number in passing · PRs only, never merge to main · hidden ≠ deleted · §13.6 data rules · §20.6/§16.5 PR blocks). Non-negotiable on every surface.
2. **`STATE.md`** — the cross-programme "you are here" cursor.
3. **THIS FILE** — cursor block → current milestone → the tasks carrying YOUR role's icon (§4 owners legend).
4. Your session's brief (Code: the `BRIEF_*.md` named in the current milestone; Matrix: the project boot ritual; Chrome relay runs only under Matrix direction with the relay runbook).

**Standing rules for all four actors:**
- **Read live, never recall.** No claim about Monitrax state from memory or summaries — read it from HEAD or flag it unverified (cite-or-flag).
- **Do only what the current milestone briefs.** Found work → registry issue or a proposal in this doc, never a side quest.
- **Before ending a session:** tick your boxes HERE, update the cursor, append one §9 session-log line — in the SAME PR for Code builds; Matrix lands doc updates as their own PR; Reza's actions (merges, switches, rulings) are recorded by the next session that boots.
- **If this doc and any other doc disagree:** for programme state, THIS doc wins; for laws, CLAUDE.md wins; for issue detail, the registry wins; for tranche mechanics, the ledger wins. Fix the disagreement in the same session, don't work around it.

| Actor | Reads | Writes here |
|---|---|---|
| 🧑 Reza | cursor + current milestone + gates awaiting him | rulings (via chat → Matrix records), merge/switch confirmations |
| 🟩 Matrix (Cowork) | everything; owns this doc's integrity | cursor, briefs, verdicts, research, session log |
| 🟦 Code | §0 → cursor → its brief → its milestone tasks | box ticks, cursor, session log (same PR as the build) |
| 🌐 Chrome relay | the specific runbook step Matrix hands it | nothing directly — Matrix records its results |

---

## CURSOR — update every session that advances the plan

| Field | Value |
|---|---|
| **Current milestone** | M1 — mechanics close-out (Code session NOT yet started; brief merged #1588 + addenda below) |
| **Last session** | 2026-08-19 · Matrix HQ · market/user research run; v1 focus ruled (D-10…D-16); this plan created |
| **Next action** | Reza kicks off the M1 Code session (§4 M1 kickoff block) |
| **Blockers** | none |
| **Baseline of record** | `.audit/golden-baseline-12954ff.json` (VR-048, 1,756 leaves, treeHash `0d6753ef…`) |
| **PROD state** | v1 shape live — 13 MODULE_* keys HIDDEN (verified by Reza 2026-08-19) |
| **Preview state** | full app, all 13 flags ON, full PROD data copy (2026-08-11), `connection_limit=1` applied — `monitrax-git-preview-dev-full-app-…vercel.app` |

---

## 1. Identity — what the first Monitrax IS (ruled 2026-08-19)

> **The per-property record system for Australian property investors: AI reads your statements, every dollar lands in the right ATO category with its evidence attached, and your accountant gets a clean pack in one click.**

Tracking is the mechanism. **The accountant pack is the product.** AI intake is the ease. The document vault is the defensibility. This replaces both the old "wealth OS" story and the generic "tracking tool" framing — the market clears at A$10–20/mo ONLY for tax-outcome products; generic tracking fights free apps (research 2026-08-19, §7).

**The automation design law (Reza, 2026-08-19):** users hate manual work and expect AI to do most of it. Every v1 flow is designed and measured as **"you confirm, Monitrax does"** — the user's job is confirming, never keying, matching, filing or classifying. Taps-to-done is a tracked metric (M4.4); any remaining manual step is a named automation-backlog candidate, not an accepted cost. The one thing never automated away is the CONFIRM itself (D-11 — the confirm event is the ATO defensibility).

**Why now (all verified Aug 2026, sources §7):** ATO's operative stat remains 9-in-10 rental returns wrong, with data-matching now covering PM software, investment-loan (RIPL) and landlord-insurance data · loan interest alone = 42% of the $1.2B rental tax gap · a clean per-property summary demonstrably cuts an accountant bill from ~$900 to ~$275 · the NG/CGT reform is LAW (Royal Assent 26 Jun 2026, effective 1 Jul 2027: deemed disposal, quarantined residential losses, cost-base indexation) and no incumbent has shipped for it · the invariant core of every successful analogue globally (Stessa, Landlord Studio, Hammock) is exactly Monitrax's kept surface.

**The two whitespace claims nobody owns (post-launch differentiators, not v1):** the variance loop (purchase assumptions vs actuals) and clean multi-entity ownership.

---

## 2. Decision record

### Inherited — module gate programme (Reza 2026-08-04/09/11, full text `PROD_SIMPLIFICATION_PLAN.md` §0; FINAL, do not re-open)
D-1 HIDE household cashflow · D-2 HIDE tax module (pack ships) · D-3 HIDE CFO · D-4 HIDE Home+Housekeeping, Reports→one pack, land on /dashboard/properties · D-5 HIDE Investments/Super · D-6 entity SAFE default · D-7 full-instance PROD→dev copy (attested non-real; prohibited the day real customer/CDR data exists; Sydney residency) · D-8 WIP ONE hidden module · D-9 admin PROD-only. Plus: automation-first v1 · no work lost, nothing deleted · "100% working" = producers converged + Ring-3 PASS live · held doctrine (exposure-not-defect control; CLEAN self-diff acceptance).

### New — v1 focus (Reza 2026-08-19, this session's research)
| # | Decision | Ruling |
|---|---|---|
| D-10 | v1 identity & positioning | **Per-property record system + accountant pack** (§1 line). "Full income/expense tracking" is scoped to the INVESTMENT surface (properties, their loans, simple assets) — household/everyday-spend tracking stays hidden until Basiq (it is the free-app commodity zone and dishonest without feeds). |
| D-11 | AI in v1 | **Intake only, propose→confirm, never silent write.** AI reads PM statements / bank statements / receipts → proposes categorized, property-linked, deduction-flagged rows → one-tap confirm (the confirm event = ATO defensibility). **NO AI advice/chat surface in v1** (AFSL boundary + trust). Governed by the §1 automation design law: AI does the work, the user confirms. |
| D-12 | Accountant connection v1 | **The pack, not a portal:** per-property per-FY pack (PDF + CSV) in ATO rental-schedule headings + export/share. Read-only accountant access returns later (elements exist in hidden modules). This is the conversion trigger — every paid competitor has a version. |
| D-13 | Notifications v1 | **EOFY completeness nudges only** ("3 expenses missing receipts", "no rates entered for X this FY") — tied to the pack, not a notification platform. |
| D-14 | "Best-outcome tax planning" | **Reframed to completeness + correctness + substantiation** (guided repair-vs-capital classification at entry, per-loan interest, nothing missed in July). Planning/optimisation surfaces return at R2 (property-tax slice) on verified numbers — never through the v1 side door. |
| D-15 | One tracking doc | **This file.** Registries stay SSOT for their detail (§8); every other strategy doc is archive or pointer. Boot protocol §0 binds all four actors. |
| D-16 | Dashboard in v1 | **The dashboard RETURNS, rebuilt as the v1 scoreboard — it does not return as the old wealth-OS Home.** The old Home reads gated feeds (`wealth-graph` → MODULE_ENTITIES, `money-flow` → MODULE_HOME) and tells the pre-simplification story; flicking MODULE_HOME on as-is would render broken/off-story widgets (P1.2 audit). Sequence: M1 inventories exactly what breaks with MODULE_HOME on; M3 lands the scoreboard version (per-property portfolio summary + EOFY-readiness from kept engines only) and THEN the flag flips ON. Amends D-4's "Home returns R4": the v1 scoreboard comes forward to M3; the full wealth-OS Home stays R4. |

**Scope traps (research-confirmed; do NOT add):** tenant ops (rent collection/leases/maintenance) · multi-currency · lifestyle budgeting breadth · forecasting before records are right · anything that locks data in (full CSV export is a TRUST requirement — M3 verifies it exists).

---

## 3. The v1 scope (existing functions only — no net-new modules)

**KEEP (visible today, PROD):** Properties + detail + depreciation · per-property cashflow engine (SSOT) · Loans as property attribute · simple Assets · Documents/Vault (OCR + auto-linking) · intake (CSV/QIF, manual, cash quick-add, receipt OCR, reconcile→link, managed-rental reconciliation, accounts/balances/recurring) · Reports narrowed to THE pack (P2.3, in M1) · settings/auth/admin.
**RETURNING IN v1 (D-16):** the Dashboard, rebuilt as the property scoreboard (M3) — until then `/dashboard` keeps redirecting to `/dashboard/properties`.
**HIDDEN (13 MODULE_* keys, return by R-stage §4):** household/budget/plan · debt planner · safety net · entities · investments/super · tax module · CFO/What-If · strategy tabs · home dashboard (until its M3 rebuild) · housekeeping · social/marketplace · labs · org portal.
**BUILT BUT DARK:** Basiq feeds (GTM-gated — the retention fast-follow M6, NOT a launch blocker; manual+OCR survives in this niche: ~10–30 tx/property/yr).

Full route/API/key inventory: `PROD_SIMPLIFICATION_PLAN.md` §2 (binding).

### 3.5 Pain point → solution map (research 2026-08-19 + Reza additions; the v1 promise, falsifiably)

| # | User pain (ranked by evidence frequency) | What exists today | The v1 answer | Milestone |
|---|---|---|---|---|
| 1 | **PM statements aren't tax-ready** — every July investors reconstruct owner-paid capex, rates, insurance, DIY repairs the statement misses; now framed as an audit trigger | Managed-rental reconciliation, CSV/QIF import, manual + receipt OCR | AI statement agent: upload the PM/bank statement → proposed, property-linked, ATO-categorized rows → one-tap confirm; owner-paid items captured year-round, not reconstructed | M4 (intake exists now; AI on top) |
| 2 | **Messy records = higher accountant fees** ($275 organised vs $900 messy — PropertyChat, with an accountant confirming "well summarised… it's not") | Per-property ledger + the reports pack | The accountant pack: per property per FY, ATO rental-schedule line headings, PDF+CSV, evidence-linked — the accountant needs nothing else (pilot-verified) | M3 |
| 3 | **Loan interest is the #1 ATO error class** (42% of the $1.2B rental gap; redraw contamination; ATO data-matches loan records via RIPL) | Loans per property, one loan-cost resolver (T2) | Interest itemised per loan in the pack, produced by the ONE converged resolver Ring-3-verified on live data; full redraw-split/deductible-portion ledger returns with the R2 tax slice | M2 (correctness) · R2 (split ledger) |
| 4 | **Repairs vs capital vs depreciation misclassified**; stale QS schedules, renovations never claimed | Categories + `isTaxDeductible` flags + depreciation schedules | Guided classification at entry (repair / <$300 / capital works 2.5% / Div 40) with AI proposing the class and the user confirming; QS schedule upload → OCR → lines | M3 (guided) · M4 (AI + QS OCR) |
| 5 | **CGT cost-base decay** — "$200k of 2002 construction costs unprovable 20 years later"; the 1-Jul-2027 deemed disposal multiplies this | Vault keeps documents forever, linked to properties | Evidence-first records outlive any accountant's archive today; the full cost-base register + 1-Jul-2027 valuation slot + quarantined-loss ledger is the R2 headline (legislated wedge, no incumbent shipped) | v1 partial · R2 full |
| 6 | **EOFY scramble / not knowing what's missing** | — | Completeness nudges ("3 receipts missing", "no rates this FY") on the scoreboard dashboard + before pack export | M3 (with D-16 dashboard) |
| 7 | **Fear of app lock-in** — experienced investors stay on Excel because "software ties you in"; "tax agents die and you're screwed using them as your archive" | Unknown — verify | Full-data CSV export, always available, first-class — stated in marketing | M3.3 |
| 8 | **Distrust of app numbers** ("numbers can't be validated" — the accountant critique that started this programme) | Golden baseline + Ring-3 machinery | Every published number traces to ONE producer, Ring-3-verified on live data before launch; no number ships unverified | M2 (the launch gate) |
| 9 | **Manual transaction reconciliation** (Reza 2026-08-19) — matching bank/PM rows to the right property, loan or recurring item by hand | reconcile→link flow + managed-rental reconciliation exist but are user-driven | AI auto-matches every imported/uploaded row via the LinkingRules cascade and PROPOSES the reconciliation (property link, loan match, recurring-item match, duplicate detection) — user one-tap confirms or bulk-accepts; unmatched rows queue with a best-guess, never silently dropped | M4 |
| 10 | **Categorisation drudgery + wrong categories** (Reza 2026-08-19) — picking categories row by row, deductibility guessed | Manual category pick; per-category `isTaxDeductible` defaults (M4.3) | AI proposes ATO category + deductibility per row with a confidence signal, learns from the user's corrections, bulk accept-all-correct; low-confidence rows surfaced first | M4 |
| 11 | **Document filing & chasing** (Reza 2026-08-19) — receipts scattered across email, phone photos, drawers; filing them is its own job | Vault + Vision OCR + auto-linking already built | Drop ANYTHING (photo, PDF, statement, invoice) → OCR → auto-filed to the right property AND linked to the matching transaction — filing becomes a byproduct of upload; the missing-doc nudge (M3.2) closes the loop from the other side | v1 today — sharpened M3, auto-link-to-transaction M4 |
| 12 | **META — users hate manual work; they expect AI to do most of it** (Reza 2026-08-19) | — | The §1 automation design law governs every flow: "you confirm, Monitrax does." Measured: taps-to-done + time-to-first-correct-number (<5 min, M4.4); every remaining manual step is a named automation-backlog candidate | ALL — design law, not a feature |

---

## 4. ROADMAP — milestones, owners, gates

**Owners legend:** 🧑 Reza (rulings, merges, switches, credentials, pilot) · 🟩 Matrix = Cowork HQ (briefs, research, Ring-3 verdicts, doc-keeping) · 🟦 Code (build PRs) · 🌐 Chrome = browser relay driven by Matrix (console ops, golden-baseline runs, PROD checks; Reza types all credentials).
**Rituals:** boot per §0. Every build PR ticks its boxes HERE in the same PR. Matrix cuts one consolidated brief per Code session. Golden self-diff CLEAN required on every phase-gate. Never fix a number in passing — registry issue instead. PRs only, Reza merges.

### M0 — Simplification executed ✅ DONE (2026-08-04 → 08-11)
Plan+rulings (#1584) · P0 freeze (#1586) · P1 module gate (#1587) · flag-phase acceptance CLOSED (P1.10 static-equivalent, P2.2 CLEAN, P2.2b CLEAN 0/0/0, P2.1 pass — #1587 comments) · PROD live in v1 shape · P2.5 full data copy + tested runbook + standing preview branch (#1589) · preview verified with full data · `connection_limit=1` durable fix.

### M1 — Mechanics close-out 🟡 NEXT (one Code session; brief = `BRIEF_SIMP_P2R_R0.md` #1588 + the addenda below)
- [ ] M1.1 🟦 Execute the #1588 brief in full: P2.3 Reports→pack only · P2.4 D-6 safe entity default · P2.6 positioning row refresh · P2-gate close-out (tick P2.1/2.2/2.2b/2.5 in the old plan citing #1587 comments + runbook log) · §13.6/§7 full-copy amendment · `scripts/dev/set-module-flags.mjs` · **R0 FeatureFlagOverride wiring** (user-scoped reader, admin CRUD, Modules-panel affordance, tests).
- [ ] M1.2 🟦 **ADDENDUM — static-prerender defect fix** (predates the brief; registered #1587 comment 2026-08-11): gated routes bake the guard verdict at BUILD time — force-dynamic on the ~20 gated layouts or `noStore()` inside `moduleRouteGuard` (SSOT preferred). Register in `docs/issues/` first, fix in the same PR set.
- [ ] M1.3 🟦 **ADDENDUM — tracker pointers** (carry texts in the PR body, P0.1 precedent): STATE.md cursor line + 01_ACTIVE_WORKSTREAMS row pointing at THIS plan; banner on `PROD_SIMPLIFICATION_PLAN.md` ("live tracking moved to MONITRAX_V1_MASTER_PLAN.md; this doc = decision record + gate design archive"); its cursor block frozen with a pointer; hub `Last updated` bump. Update the old plan's §1 story line to §1 here (D-10). **Also: add a one-line pointer to this master plan + its §0 boot protocol into CLAUDE.md's session-boot section (so every future session lands here by law).**
- [ ] M1.4 🟦 **ADDENDUM — D-16 dashboard dependency inventory** (analysis, no build): with MODULE_HOME on in Preview, list every Home widget → API/engine dependency and its gate status (`wealth-graph`/MODULE_ENTITIES, `money-flow`, master-snapshot, household feeds…) → the M3 scoreboard rebuild spec starts from this table. Record it in this file under M3.
- [ ] M1.5 🟩🌐🧑 R0 acceptance on PROD: MODULE_TAX override for Reza's account only → he sees `/dashboard/tax`, a test account still 404s; flag-flip visibility now changes WITHOUT redeploy (M1.2 proof). Verdicts recorded on the PR.
- [ ] M1.6 🧑 Merge(s); Preview refreshed if flags were touched.
**Gate:** all boxes; golden self-diff CLEAN (`changesNumbers: NO`). **Model: Fable 5.**

### M2 — Correct numbers on the kept surface (P3) — 🔒 THE LAUNCH GATE
The validation/issue-tracker programme, resumed and filtered to the kept surface (by producer, never by tranche — held doctrine).
- [ ] M2.1 🟦 Producer census re-run filtered to kept surface at current HEAD (expect ≈8–10 quantities; MON-131_SCOPE_FILTER §1.1)
- [ ] M2.2 🟩🌐 T2 (loan cost) Ring-3 on live data — first Ring-3 through R0's override
- [ ] M2.3 🟦🟩 Launch-blocking defect cluster → VERIFIED (§5 table; Opus 4.8 diagnosis briefs, Fable 5 mechanical fixes)
- [ ] M2.4 🟦 Kill the properties-list inline cashflow re-derivation (`properties/page.tsx:1195-1216` bypasses the engine)
- [ ] M2.5 🟩 MON-131 five-condition done applied to kept quantities; census ratchet green
**Gate:** Ring-3 PASS on live data across kept quantities. Nothing publishes before this — automation on wrong numbers is wrong numbers, faster.

### M3 — The accountant pack becomes the product (D-12/D-13/D-16; the pack EXISTS — this perfects it)
- [ ] M3.1 🟦 Pack restructured to ATO rental-schedule line headings, per property per FY: income · interest (per loan) · repairs vs capital vs Div 40/43 (from the depreciation schedules) · other deductions by schedule line · linked evidence (vault docs) per row · PDF + CSV
- [ ] M3.2 🟦 EOFY completeness nudges (D-13): missing-receipt / missing-category / no-rates-this-FY style checks surfaced before pack export
- [ ] M3.3 🟦 Full-data CSV export verified/added (anti-lock-in trust requirement — PropertyChat's #1 stated reason for staying on Excel)
- [ ] M3.4 🟦 **D-16 scoreboard dashboard:** `/dashboard` rebuilt from the M1.4 inventory using KEPT engines only — per-property portfolio summary (cashflow, yield, equity from existing engines), EOFY-readiness panel (M3.2 nudges), roadmap-aligned (no wealth-OS widgets). MODULE_HOME flips ON at this gate; redirect retired.
- [ ] M3.5 🧑🟩 **The pilot = the user research:** Reza's accountant + 2–3 friendlies run the pack on real FY2025-26 data. Acceptance: the accountant needs NOTHING else to complete the rental schedule. Findings → registry issues, fixed, re-run.
**Gate:** accountant sign-off captured in this doc; dashboard live as the scoreboard. **This gate closes the flagged user-voice research gap.**

### M4 — AI intake (P4 rescoped by D-11 — the differentiator; pain rows 1, 9, 10, 11)
The automation design law made real: AI does the keying, matching, classifying and filing; the user confirms.
- [ ] M4.1 🟦 Statement agent v1: upload PM statement / bank statement (PDF/CSV) → existing Vision OCR + analyze pipeline → classify + property-link via LinkingRules cascade → **propose→confirm queue** (one review moment per statement; accept-all-correct in one tap); every confirmed row carries its source-document link
- [ ] M4.2 🟦 **AI reconciliation (pain 9):** every imported/uploaded row auto-matched — property link, loan match, recurring-item match, duplicate detection — proposed for confirm; unmatched rows queue with best-guess, never silently dropped
- [ ] M4.3 🟦 **AI categorisation (pain 10):** ATO category + deductibility proposed per row with confidence; learns from corrections; low-confidence rows surfaced first; bulk accept
- [ ] M4.4 🟦 **Docs auto-filed to transactions (pain 11):** any uploaded document OCR'd, auto-filed to its property AND auto-linked to the matching transaction row (extends the existing vault cascade)
- [ ] M4.5 🟦 QS depreciation schedule upload → OCR → schedule lines
- [ ] M4.6 🟦 Onboarding rebuilt to 3 steps (property → loan → rent+agent); hidden-module wizard steps removed; `isTaxDeductible` defaults per category
- [ ] M4.7 🟩🧑 Time-to-first-correct-number < 5 min on a fresh account; taps-to-done measured per flow; zero silent writes (audit: every AI row has a confirm event)
**Gate:** a new user reaches a correct per-property number in one sitting, with AI doing the work and the user only confirming. AFSL note: extraction/classification only — no advice surface, in code or copy.

### M5 — Publish 🚀
- [ ] M5.1 🧑🟩 Positioning/site rewrite to the §1 story (the queued row-66 follow-up — a marketing defect if skipped)
- [ ] M5.2 🧑 Pricing ruled (research anchors: TaxTank $15/mo · The Property Accountant $3.99/property/mo · Etax $59.90/schedule/yr status-quo cost · category clears A$10–20/mo; "tax-deductible" is the category selling line)
- [ ] M5.3 🟩🌐 Pre-launch verification sweep: golden self-diff CLEAN on PROD · route/nav smoke · pack generation on PROD data · health/monitoring
- [ ] M5.4 🧑 Go-live + first-users plan (friendlies → public)
**Gate:** live, first external users, support loop agreed.

### M6 — Retention fast-follow + returns
- [ ] M6.1 🧑 Basiq feeds ON (built, dark — GTM/cost ruling; "tax pack = why they pay, feeds = why they stay"). NOTE: first CDR data in PROD permanently sunsets the D-7 dev-copy exception (runbook law).
- [ ] M6.2 R-stage returns, ONE at a time (D-8), each gated on producers converged + Ring-3 PASS live + Reza's switch: **R2** tax module as property-tax slice + 2027 reform readiness (cost-base register, 1-Jul-2027 valuation slot, quarantined-loss ledger — the legislated wedge; P5.4) + housekeeping → **R3** household/budget/debt/safety-net (needs Basiq) → **R4** CFO/strategy/full wealth-OS Home (highest AFSL bar) → **R5** entities/investments/social/labs/portal (commercial call each). Variance loop (P5.2) + Propsight import (P5.3) slot post-launch as the moat.

---

## 5. Launch-blocking issues (the M2 working set)

**Law:** `docs/issues/ISSUES.md` + `docs/issues/ISSUES.json` remain the REGISTRY OF RECORD (all ~146 issues, full history). This table is the launch-blocking SUBSET only; status changes land in BOTH (same PR — Neo-sync discipline). Hidden-module issues stay HELD (P0.2 freeze) and are NOT listed.

| Issue | What | Status at 2026-08-19 |
|---|---|---|
| MON-001 | Rent frequency handling (kept surface) | OPEN → M2.3 |
| MON-143 | Offset netting | OPEN → M2.3 |
| MON-145 | Undated rate | OPEN → M2.3 |
| MON-146 | 100× rate render | OPEN → M2.3 |
| MON-129 | Producer-class sweep where producers feed pack/Activity | OPEN → M2.3 |
| (unregistered) | Static-prerender flag gating (#1587 comment 2026-08-11) | → registered + fixed in M1.2 |
| + M2.1 additions | Whatever the kept-surface census re-count surfaces (MON-149…153 candidates) | → triaged into this table at M2.1 |

Registry counts at last full count (P0.6, 2026-08-04, `e588a837`): 65 OPEN/FIXING · 5 critical · 146 total. Re-count at M2.1; never quote these numbers later without a re-pull.

---

## 6. Verification law (pointers, not copies)

Golden baseline self-diff CLEAN on every phase-gate (`.audit/golden-baseline-12954ff.json`; relay endpoints + runbook: project memory `matrix-relay-runbook`) · Ring-3 on LIVE data via R0 override = the bar for M2 and every R-stage return · never fix a number in passing (§23.2.1 — registry issue) · §20.6 tri-axis + §16.5 doc-sync in every PR body · SSOT audit is step 0 of every change · preview data refreshes ONLY per `docs/operations/PREVIEW_DATA_REFRESH_RUNBOOK.md`.

---

## 7. Market evidence (condensed; full agent reports in the 2026-08-19 session record)

- **Invariant core globally** (Stessa, Landlord Studio, Hammock, Baselane, REI Hub all launched with exactly): property-tagged ledger in local tax categories + ONE low-friction ingestion + accountant-accepted tax output + simple dashboard. All excluded tenant ops/banking/budgeting at launch. Landlord Studio v1 was manual+receipt-scan only; feeds came ~2 yrs later. Monetisation: tax pack is the paywall (Stessa Schedule E at $12/mo — "the exit door at tax time has a toll booth"); feeds drive retention (Stessa/Unit: banking users 4× LTV, 3.5× retention). [stessa.com/pricing · landlordstudio.com/pricing · accountingstack.co.uk/…/hammock]
- **AU field:** TaxTank $15/mo, Basiq feeds, live tax position — the benchmark; The Property Accountant $3.99/property/mo, feeds + tax-ready reports + accountant portal — "Monitrax with feeds already built"; Moorr free, 43k users, Property Couch funnel, NO tax pack; 5+ new entrants since 2024-25 (propkt $49/yr, Propva = statement-AI wedge — watch it, Opulo, WealthStacker, Lolli), nearly all pre-traction. ATO myDeductions has NO rental category — the true incumbent is spreadsheet+shoebox. [taxtank.com.au/pricing · thepropertyaccountant.com.au/pricing · moorr.com.au · propkt.com · propva.com.au]
- **Pain points ranked:** see §3.5 (the map is the operative version). [propertychat.com.au threads · ato.gov.au media releases · cpaaustralia.com.au]
- **Regulatory:** NG/CGT reform = LAW (Assent 26 Jun 2026, eff. 1 Jul 2027); deemed disposal + quarantined residential losses + indexation; ATO compliance guidance still unpublished; Treasury estimates $88.4M/yr extra compliance cost. **OPEN VERIFICATION: per-property vs pooled loss quarantining conflicts between Corrs (per-property) and PwC/William Buck (pooled) — read the Act before building any loss-ledger logic (R2).** "9-in-10 wrong" stat: operative but last ATO-primary 2023 — re-verify before using in marketing copy. Victoria = dated-obligation-rich state (VRLT 15 Feb, AOS 15 Jan, short-stay levy). [ato.gov.au/about-ato/new-legislation · corrs.com.au · pwc.com.au tax alerts]
- **Coverage caveat:** Reddit sentiment unreachable (proxy-blocked) — uncovered. The M3.5 pilot is the real user-voice closure.

---

## 8. Doc map — where every fact lives (SSOT)

| Question | Read |
|---|---|
| Programme state, roadmap, who does what next | **THIS FILE (§0 boot → cursor → §4)** |
| Repo laws binding every session | `CLAUDE.md` |
| Module-gate rulings D-1…D-9 + gate/route/API design | `PROD_SIMPLIFICATION_PLAN.md` (archive; binding design) |
| Every issue, full history | `docs/issues/ISSUES.md` / `.json` (registry of record) |
| MON-131 tranche mechanics + ledger | `docs/implementation/MON-131_TRANCHE_LEDGER.md` |
| Cross-programme cursor ("you are here" for ALL work) | `STATE.md` |
| Preview/dev data refresh | `docs/operations/PREVIEW_DATA_REFRESH_RUNBOOK.md` + `PREVIEW_BRANCH.md` |
| Golden-baseline / relay mechanics | `scripts/matrix/` + project memory `matrix-relay-runbook` |
| v1 scope four-lens analysis (archive) | `PRODUCT_SCOPE_V1_RECOMMENDATION.md` (Q-SCOPE-1, DECIDED) |
| Code-session briefs | `docs/strategy/BRIEF_*.md` (M1: `BRIEF_SIMP_P2R_R0.md` + §4 M1 addenda) |

## 9. Session log

- 2026-08-19 · Matrix HQ (Fable 5) · Deep market/user/analogue research (3 agent sweeps); v1 focus ruled D-10…D-16 (incl. dashboard-as-scoreboard); §3.5 pain-point→solution map (rows 1-8 research-ranked, rows 9-12 Reza-added: manual recon, categorisation, doc filing, AI-does-the-work) + §1 automation design law; §0 boot protocol (one doc, four actors, CLAUDE.md-first); M4 expanded to 7 tasks covering the automation pains; this master plan created at `380a526a`; M1 defined = #1588 brief + prerender fix + tracker pointers + dashboard inventory.
