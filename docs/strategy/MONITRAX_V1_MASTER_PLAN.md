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
- **D-18 build law: NO new capability without Reza's explicit GO.** Perfect and enhance what is already built first; a session that thinks something new is needed writes a proposal in the gate review and STOPS — it never builds on its own initiative.
- **D-20 depth law: finish what is visible before touching what is hidden.** A kept-surface defect or gap outranks every hidden-module improvement.
- **Before ending a session:** tick your boxes HERE, update the cursor, append one §9 session-log line — in the SAME PR for Code builds; Matrix lands doc updates as their own PR; Reza's actions (merges, switches, rulings) are recorded by the next session that boots.
- **Every milestone gate closes with a GATE REVIEW** (§4 ritual): progress vs plan, fresh market/regulatory check, and upgrade proposals — the plan is a living document that improves as Monitrax does.
- **If this doc and any other doc disagree:** for programme state, THIS doc wins; for laws, CLAUDE.md wins; for issue detail, the registry wins; for tranche mechanics, the ledger wins. Fix the disagreement in the same session, don't work around it.

| Actor | Reads | Writes here |
|---|---|---|
| 🧑 Reza | cursor + current milestone + gates awaiting him | rulings (via chat → Matrix records), merge/switch confirmations |
| 🟩 Matrix (Cowork) | everything; owns this doc's integrity | cursor, briefs, verdicts, research, gate reviews, session log |
| 🟦 Code | §0 → cursor → its brief → its milestone tasks | box ticks, cursor, session log (same PR as the build) |
| 🌐 Chrome relay | the specific runbook step Matrix hands it | nothing directly — Matrix records its results |

---

## CURSOR — update every session that advances the plan

| Field | Value |
|---|---|
| **Current milestone** | **M1 ✅ CLOSED (2026-08-19)** → **M2 open** (kept-surface correctness **+ depth** — THE LAUNCH GATE). Next Code session: `BRIEF_M2_CORRECTNESS.md` |
| **Last session** | 2026-08-19 · Matrix HQ · R0 acceptance PASS + MON-160 verified live · M1.4 inventory · M1.7 gate review · **D-19/D-20 ruled · MON-163 found live** · M2 brief cut |
| **Next action** | 🧑 Reza merges this PR, then kicks off the M2 Code session (`docs/strategy/BRIEF_M2_CORRECTNESS.md`) |
| **Blockers** | none |
| **Baseline of record** | `.audit/golden-baseline-12954ff.json` (VR-048, 1,756 leaves, treeHash `0d6753ef…`) |
| **PROD state** | v1 shape live — 13 MODULE_* keys HIDDEN, **zero overrides** (R0 teardown verified 2026-08-19 from override-holder, other-account and signed-out viewpoints). **Known live defect: MON-163** (kept property page links into hidden routes → 404s). |
| **Preview state** | full app, all 13 flags ON, full PROD data copy (2026-08-11), `connection_limit=1` applied — `monitrax-git-preview-dev-full-app-…vercel.app`. NOTE: with MON-160 deployed, the standing-branch workaround is no longer needed for flag visibility |

---

## 1. Identity — what the first Monitrax IS (ruled 2026-08-19)

> **The per-property record system for Australian property investors: AI reads your statements, every dollar lands in the right ATO category with its evidence attached, and your accountant gets a clean pack in one click.**

Tracking is the mechanism. **The accountant pack is the product.** AI intake is the ease. The document vault is the defensibility. This replaces both the old "wealth OS" story and the generic "tracking tool" framing — the market clears at A$10–20/mo ONLY for tax-outcome products; generic tracking fights free apps (research 2026-08-19, §7).

**The automation design law (Reza, 2026-08-19):** users hate manual work and expect AI to do most of it. Every v1 flow is designed and measured as **"you confirm, Monitrax does"** — the user's job is confirming, never keying, matching, filing or classifying. Taps-to-done is a tracked metric (M4.7); any remaining manual step is a named automation-backlog candidate, not an accepted cost. The one thing never automated away is the CONFIRM itself (D-11 — the confirm event is the ATO defensibility).

**The build law (D-18, Reza 2026-08-19):** perfect what exists before building anything new. The kept surface must work flawlessly — every existing function enhanced to its outcome — before any net-new capability starts, and nothing net-new starts without Reza's explicit GO.

**The depth law (D-20, Reza 2026-08-19):** depth and quality over surface. A deeper, more correct, more complete version of something that already ships beats anything new or anything hidden. Shallow breadth is the failure mode this programme exists to prevent.

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
| D-16 | Dashboard in v1 | **The dashboard RETURNS, rebuilt as the v1 scoreboard — it does not return as the old wealth-OS Home.** The old Home reads gated feeds (`wealth-graph` → MODULE_ENTITIES, `money-flow` → MODULE_HOME) and tells the pre-simplification story; flicking MODULE_HOME on as-is would render broken/off-story widgets (P1.2 audit, confirmed empirically by the M1.4 inventory). Sequence: M1 inventories exactly what breaks with MODULE_HOME on; M3 lands the scoreboard version (per-property portfolio summary + EOFY-readiness from kept engines only) and THEN the flag flips ON. Amends D-4's "Home returns R4": the v1 scoreboard comes forward to M3; the full wealth-OS Home stays R4. |
| D-17 | Living plan | **Every milestone gate closes with a Matrix GATE REVIEW** (§4 ritual): progress vs plan · fresh market/competitor/regulatory re-check · upgrade/enhancement proposals for Reza's ruling. The plan is upgraded as Monitrax moves — no stage completes silently. |
| D-18 | Build law — perfect what exists FIRST | **No new capability is built without Reza's explicit confirmation** until the existing functions work perfectly. M1–M3 are enhance-only by construction (they perfect what is built: the gate, the pack, the exports, the dashboard from kept engines). **Every M4 task is a separate GO decision Reza takes at the M3 gate review** — M4 is planned here so it is briefed and sequenced, not pre-authorised. A session that believes something new is required writes the proposal into the gate review and stops (see §0 standing rule). Default answer to "build X new?" is NO. |
| D-19 | Dashboard tiles are **stage-aware, module-derived** | **Reza 2026-08-19: the dashboard shows the tiles relevant to the current go-live stage.** Mechanism (ruled after Matrix's design review — NOT a second flag vocabulary): a `DASHBOARD_TILE_REGISTRY` where **every tile declares the MODULE key it depends on** and the stage it belongs to. Visibility = `requires === null (v1 core) OR isModuleEnabled(requires)`, **minus** an optional admin suppression toggle. **The iron rule: a tile toggle can only SUPPRESS, never force-show a tile whose module is off.** So when R2 flips `MODULE_TAX` on, the tax tile appears by itself; nothing can resurrect the broken-widget failure the M1.4 inventory found. Spec in M3.4; built there, not before. |
| D-20 | **Depth before surface** | **Reza 2026-08-19: "work on the depth and quality of Monitrax rather than expanding a shallow surface."** Standing priority law: work that makes an EXISTING kept function deeper, more correct or more complete **outranks** work that adds surface — including any work on hidden modules. **No hidden-module work proceeds while a kept-surface defect or gap is open** (this hardens the P0.2 freeze from "don't touch hidden" to "finish visible first"). A milestone is measured not by how much is visible, but by how little of what is visible is wrong, shallow or dead-ended. Operationalised as M2.0 (scoping law) and M2.6 (depth sweep). |

**Rulings on the M1.7 gate-review proposals (Reza 2026-08-19: "go with your recommendations"):** **P-1 ADOPTED** (M1.3 folded into the M2 PR) · **P-2 ADOPTED** (MON-161 is an M2 item) · **P-3 ADOPTED** (MON-162 registered, fix deferred) · **P-4 ADOPTED AS RECOMMENDED — the M3.4 scoreboard does NOT reuse `/api/dashboard/charts`' NetWorth series** until M2's census proves the producers behind it; revisit at the M3 gate · **P-5 ADOPTED AS RECOMMENDED — cookie-based server sessions are PARKED** (auth-architecture change, outside the v1 boundary; MON-162 stays deferred with it).

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
| 10 | **Categorisation drudgery + wrong categories** (Reza 2026-08-19) — picking categories row by row, deductibility guessed | Manual category pick; per-category `isTaxDeductible` defaults (M4.6) | AI proposes ATO category + deductibility per row with a confidence signal, learns from the user's corrections, bulk accept-all-correct; low-confidence rows surfaced first | M4 |
| 11 | **Document filing & chasing** (Reza 2026-08-19) — receipts scattered across email, phone photos, drawers; filing them is its own job | Vault + Vision OCR + auto-linking already built | Drop ANYTHING (photo, PDF, statement, invoice) → OCR → auto-filed to the right property AND linked to the matching transaction — filing becomes a byproduct of upload; the missing-doc nudge (M3.2) closes the loop from the other side | v1 today — sharpened M3, auto-link-to-transaction M4 |
| 12 | **META — users hate manual work; they expect AI to do most of it** (Reza 2026-08-19) | — | The §1 automation design law governs every flow: "you confirm, Monitrax does." Measured: taps-to-done + time-to-first-correct-number (<5 min, M4.7); every remaining manual step is a named automation-backlog candidate | ALL — design law, not a feature |

---

## 4. ROADMAP — milestones, owners, gates

**Owners legend:** 🧑 Reza (rulings, merges, switches, credentials, pilot) · 🟩 Matrix = Cowork HQ (briefs, research, Ring-3 verdicts, doc-keeping) · 🟦 Code (build PRs) · 🌐 Chrome = browser relay driven by Matrix (console ops, golden-baseline runs, PROD checks; Reza types all credentials).
**Rituals:** boot per §0. Every build PR ticks its boxes HERE in the same PR. Matrix cuts one consolidated brief per Code session. Golden self-diff CLEAN required on every phase-gate. Never fix a number in passing — registry issue instead. PRs only, Reza merges. **D-18: M1–M3 enhance existing functions only; anything net-new needs Reza's recorded GO. D-20: visible-and-shallow outranks hidden-and-broken, always.**

**GATE REVIEW — standing ritual at EVERY milestone gate (D-17, Reza 2026-08-19).** Before a milestone is declared done, Matrix runs and records (as a `§4.x gate review` entry under the milestone + a session-log line):
1. **Progress vs plan** — every box audited against evidence (PRs, verdicts, transcripts), not memory; slipped/de-scoped items named, never silently dropped.
2. **Fresh market + regulatory re-check** — competitors moved? (TaxTank/TPA/Propva watchlist) · pricing shifted? · ATO/reform guidance published? (esp. the open per-property-vs-pooled quarantine question and the "9-in-10" stat) · new entrants?
3. **Upgrade proposals** — what the last milestone taught us; concrete enhancement/re-ordering suggestions for the plan and the product, each needing Reza's ruling before it changes scope (D-8 WIP + D-18 build law apply).
4. **Cursor + §9 updated**; any ruling Reza makes lands in §2 as the next D-number.
No stage completes without its gate review. The plan is a living document — improved at every gate, never re-litigated between gates.

### M0 — Simplification executed ✅ DONE (2026-08-04 → 08-11)
Plan+rulings (#1584) · P0 freeze (#1586) · P1 module gate (#1587) · flag-phase acceptance CLOSED (P1.10 static-equivalent, P2.2 CLEAN, P2.2b CLEAN 0/0/0, P2.1 pass — #1587 comments) · PROD live in v1 shape · P2.5 full data copy + tested runbook + standing preview branch (#1589) · preview verified with full data · `connection_limit=1` durable fix. *(Gate review for M0 = the 2026-08-19 research + refocus session that produced this plan.)*

### M1 — Mechanics close-out ✅ **CLOSED 2026-08-19** — enhance-only (D-18 ✓)
- [x] **M1.1** 🟦 #1588 brief executed in full — **#1590** (P2.3 Reports→pack · P2.4 D-6 safe default · P2.6 row 66 · P2 close-out ticks · §13.6/§7 full-copy amendment · `set-module-flags.mjs` with PROD-refusal proof) + **#1591** (R0 overrides: user-scoped reader, user-aware API enforcement across 35 handlers, admin Overrides UI, 58 featureFlags tests). Both merged 2026-08-19. Deviation surfaced honestly on #1591: server layouts have no user identity (Bearer-token auth, zero `cookies()` repo-wide) → override windows enforce client-gate + API-503; the standing no-override state remains a hard server 404.
- [x] **M1.2** 🟦 Static-prerender defect → **MON-160** registered + fixed on #1590 at the ONE shared guard (request-time decision, order-locked by test). **VERIFIED live 2026-08-19** (see M1.5).
- [ ] **M1.3** 🟦 **CARRIED TO M2** — tracker pointers (STATE.md cursor line · 01_ACTIVE_WORKSTREAMS row · banner + frozen cursor on `PROD_SIMPLIFICATION_PLAN.md` · hub bump · old-plan §1 story line → §1 here · **CLAUDE.md boot-section pointer to this plan + §0**). Not doable from Cowork: STATE.md (78 KB) and the trackers exceed the GitHub connector's safe carry size (P0.1 precedent). Carry texts: `BRIEF_M2_CORRECTNESS.md` §A.
- [x] **M1.4** 🟦→🟩 **D-16 dashboard dependency inventory — DONE by Matrix 2026-08-19** (analysis, no build; run at `bea895f1`). Result recorded under **M3.4** below. Headline: the old Home is **not** flip-on-able — 7 outbound links point into hidden modules and both of its data APIs return the household/CFO story. D-16's sequencing is confirmed empirically, not assumed.
- [x] **M1.5** 🟩🌐🧑 **R0 ACCEPTANCE — PASS on PROD** (2026-08-19, #1591 comments): `MODULE_TAX` HIDDEN → override for `reza.sadegh@ymail.com` → **Tax Position renders for the holder** (FY2026-27, taxable $145,426, refund $5,218) · **404 for the other account and signed-out** · override removed → **404 again for the holder** (cache-busted). **MON-160 live check:** `MODULE_HOUSEKEEPING` ON → page + content + **sidebar nav entry** appeared within the cache window **with no redeploy** → OFF → 404 again. Caveat found → MON-161 (below).
- [x] **M1.6** 🧑 #1590 → #1591 → #1592 merged in order; PROD redeployed; standing state restored (13 hidden, 0 overrides).
- [x] **M1.7** 🟩 **GATE REVIEW — recorded below.**

#### M1.7 GATE REVIEW (D-17 ritual) — Matrix HQ, 2026-08-19

**1. Progress vs plan (evidence-audited, not recalled).** M1.1/M1.2/M1.5/M1.6 complete with PR + live-run evidence. **M1.3 slipped and is named, not dropped** → carried into M2's brief §A with its carry texts. M1.4 completed by Matrix instead of Code (analysis only, no build — cheaper than a Code round-trip). Two findings surfaced during the live run and are registered (§5: MON-161, MON-162) rather than fixed in passing (§23.2.1). Net: **the R-stage machinery is operational** — the last mechanical precondition to the correctness programme is done.

**2. Market + regulatory re-check (delta since 2026-08-19 research, same day).** No material change in-window; the watchlist stands unchanged (TaxTank $15/mo · The Property Accountant $3.99/property/mo · Propva on the statement-AI wedge · Moorr free/no pack). The two open verification items remain open and are **not** M2 blockers: (a) per-property vs pooled loss quarantining under the 1-Jul-2027 regime — read the Act before any R2 loss-ledger logic; (b) the ATO "9-in-10 wrong" figure — re-verify against an ATO-primary source before it appears in marketing copy (M5.1). Next substantive re-check due at the **M2 gate**.

**3. Upgrade proposals (need Reza's ruling; none actioned unilaterally — D-18).** *All five ruled by Reza on 2026-08-19 — see the ruling line under the §2 table.*
- **P-1 (recommended).** Fold M1.3 into M2's PR rather than spending a separate Code session on docs. **→ ADOPTED.**
- **P-2 (recommended).** Treat **MON-161** (stale cached 404 on the bare URL after a flip) as an **M2 item, not a nice-to-have**: it directly undercuts the admin panel's ~30s promise that every R-stage return depends on. **→ ADOPTED.**
- **P-3 (defer, register only).** **MON-162** (admin portal and app cannot hold independent sessions in one browser). **→ ADOPTED (registered, deferred).**
- **P-4.** M3.4's scoreboard could reuse `/api/dashboard/charts`' NetWorth series. Recommended against until M2 proves the producers behind it. **→ ADOPTED AS RECOMMENDED: no reuse until the census.**
- **P-5.** Server-side session identity (cookie-based) would let layouts enforce overrides server-side and would also fix MON-162 — an auth-architecture change far outside v1's D-18 boundary. **→ ADOPTED AS RECOMMENDED: PARKED.**

**4. Cursor + §9 updated.** ✓ (this PR)

**Gate:** all boxes ticked or explicitly carried; both merged PRs shipped `changesNumbers: NO`; PROD verified in standing state from three viewpoints. **M1 CLOSED.**

### M2 — Kept-surface correctness **and depth** (P3) — 🔒 THE LAUNCH GATE — enhance-only (D-18 ✓ · D-20 ✓)
The validation/issue-tracker programme, resumed and filtered to the kept surface (by producer, never by tranche — held doctrine). **Brief: `docs/strategy/BRIEF_M2_CORRECTNESS.md`.**

> **M2.0 — THE SCOPING LAW (D-20, binding on every M2 session).** The census (M2.1) decides scope, not the issue list. A defect is in M2 **only if a producer or surface it reaches is on the §2.1 KEPT list**. Everything else is **HELD** — named in the PR, not fixed. Concretely: `/dashboard/expenses`, `/dashboard/income`, `/dashboard/cfo`, `/dashboard/tax` and every other §2.2 route are hidden, so a defect whose only surface is one of them does **not** enter M2 no matter how tempting the fix looks. Depth on what ships beats breadth on what doesn't.

- [ ] M2.1 🟦 Producer census re-run filtered to kept surface at current HEAD (expect ≈8–10 quantities; MON-131_SCOPE_FILTER §1.1)
- [ ] M2.2 🟩🌐 T2 (loan cost) Ring-3 on live data — first Ring-3 through R0's override
- [ ] M2.3 🟦🟩 Launch-blocking defect cluster → VERIFIED (§5 table; Opus for diagnosis briefs, Fable for mechanical sweeps)
- [ ] M2.4 🟦 Kill the properties-list inline cashflow re-derivation (`properties/page.tsx` ~:1200 bypasses the engine)
- [ ] M2.5 🟩 MON-131 five-condition done applied to kept quantities; census ratchet green
- [ ] M2.6 🟦🟩 **KEPT-SURFACE DEPTH SWEEP (D-20 — the quality half of the launch gate).** Walk every §2.1 kept route as a user, on PROD data, and catalogue what is *shallow, broken or dead-ended* — separately from whether the numbers are right (M2.1–M2.5 own that). Mandatory checks: **(a) dead links** — no kept surface may link to a hidden route (**live example already found: `/dashboard/properties/[id]` links to `/dashboard/tax`, `/dashboard/income` and `/dashboard/cfo/what-if/sellProperty` — all 404 today → MON-163**); (b) empty states that hide missing capability rather than explain it; (c) every displayed number traceable to ONE producer (no screen arithmetic — SSOT); (d) intake paths end-to-end (CSV/QIF · manual · cash · receipt OCR · reconcile→link · managed-rental) each actually reaching a property row; (e) documents: upload → OCR → auto-link → visible on the property; (f) the reports pack generates on real data; (g) mobile nav + tab bar; (h) error/loading states on every kept page. Output: one catalogued gap list → registry issues → **the M3 depth backlog**. This is the "working perfectly in PROD" test.
- [ ] M2.7 🟩 **GATE REVIEW** (D-17 ritual) recorded here.
**Gate:** Ring-3 PASS on live data across kept quantities **AND** the M2.6 sweep's launch-blocking gaps closed. Nothing publishes before this — automation on wrong numbers is wrong numbers, faster; and a shallow surface with dead ends is not a product.

### M3 — The accountant pack becomes the product (D-12/D-13/D-16/D-19) — enhance-only (D-18 ✓: the pack, exports, vault and engines all EXIST; this perfects them)
- [ ] M3.1 🟦 Pack restructured to ATO rental-schedule line headings, per property per FY: income · interest (per loan) · repairs vs capital vs Div 40/43 (from the depreciation schedules) · other deductions by schedule line · linked evidence (vault docs) per row · PDF + CSV
- [ ] M3.2 🟦 EOFY completeness nudges (D-13): missing-receipt / missing-category / no-rates-this-FY style checks surfaced before pack export
- [ ] M3.3 🟦 Full-data CSV export verified/added (anti-lock-in trust requirement — PropertyChat's #1 stated reason for staying on Excel)
- [ ] M3.4 🟦 **D-16 scoreboard dashboard + D-19 tile registry:** `/dashboard` rebuilt using KEPT engines only — per-property portfolio summary, EOFY-readiness panel (M3.2 nudges), roadmap-aligned (no wealth-OS widgets). MODULE_HOME flips ON at this gate; the redirect is retired. **Build from the M1.4 inventory (below), not from the old HomeClient.**

<details open>
<summary><b>M1.4 — D-16 dashboard dependency inventory (Matrix, 2026-08-19, at <code>bea895f1</code>)</b></summary>

**Verdict: the old Home is NOT flip-on-able.** `app/dashboard/page.tsx` is already the correct thin server wrapper (force-dynamic · redirect when hidden · `ModuleOverrideGate` in an override window · never 404s, D-4) — the problem is entirely `HomeClient.tsx` (1,826 lines), which tells the pre-simplification wealth-OS story.

*API surface it fetches (`HomeClient.tsx:375-415`) — gate status from `moduleRegistry.ts`:*

| Endpoint | Gate status | Usable by the v1 scoreboard? |
|---|---|---|
| `/api/portfolio/snapshot` | KEEP-OPEN | **Yes** — property portfolio value/equity/LVR |
| `/api/accounts` | KEEP-OPEN | Yes (kept intake) |
| `/api/settings/balance-upgrade-nudge` | KEEP-OPEN | Yes (nudge plumbing — reusable for M3.2) |
| `/api/dashboard/insights` | KEEP-OPEN **but** | **Partly.** Reads `canonicalCashflow` (household — hidden D-1), `financialIndependence` + `lib/health` (CFO — hidden D-3), `moneyStoryTrend`, `masterFinancialService`. The route stays open (kept surfaces use it); its *content* is the household/CFO story. |
| `/api/dashboard/charts` | KEEP-OPEN **but** | **Partly.** Reads `masterFinancialService`, `moneyStoryTrend`, `entityValueBreakdown` (entities — hidden D-5/R5), `netWorthHistory`. **P-4 ruled: no reuse until M2's census.** |
| `/api/wealth-graph` (via `WealthUniverseWidget` → `useWealthExplorerData`) | **GATED → MODULE_ENTITIES (R5)** | **No** — 503s in v1. Widget must not ship on the scoreboard. |

*Outbound links into HIDDEN modules (would 404 today):* `/dashboard/investments/accounts` (R5) · `/dashboard/debt-planner` (R3) · `/dashboard/cfo` (R4) · `/dashboard/income` (R3) · `/dashboard/expenses` (R3) · `/dashboard/entities` (R5) · `/dashboard/budget-analysis` (R3) — **7 dead links.**

*Widgets rendered today:* FinancialHealthScore · EmergencyFundTracker · MoneyBleedingCard · SpendingByCategory · ActionableInsights · MonthlyBudgetSummary · DebtQualityWidget · EntityCashflowSummary · WealthUniverseWidget · InvestmentIncomeDisplay · LinkageHealthIndicator · QuickActionsBar · Editorial{Chart,Donut,EntityBars,Line}. **Every one is household/CFO/entity-scoped except the portfolio and property tiles.**

**D-19 — the stage-aware tile registry (spec; built in M3.4).**
```ts
// lib/dashboard/tileRegistry.ts — ONE source of the tile decision (SSOT)
export interface TileDef {
  id: TileId;                 // 'portfolio' | 'eofy-readiness' | 'tax-position' | …
  label: string;              // admin panel display name
  requires: ModuleKey | null; // null = v1 core, always eligible
  stage: 'v1' | 'R2' | 'R3' | 'R4' | 'R5';
  suppressible?: boolean;     // admin may hide it early; may NEVER force-show it
}
```
**Visibility law (the iron rule):** `visible = (requires === null || isModuleEnabled(requires)) && !suppressed(id)`. A tile toggle can only **suppress**; it can never show a tile whose module is off. That single constraint is what stops the old Home's failure mode (widgets rendering against gated APIs) from ever coming back. Fail-closed like `moduleGate`: unreadable ⇒ hidden. The client already has everything needed — `useEnabledModules()` returns the session user's effective map (global ∥ R0 override), so an override holder previewing a stage sees its tiles too, and nobody else does.

**The staging ladder (each tile appears by itself when its stage's module flips):**
| Stage | Tiles | `requires` |
|---|---|---|
| **v1 (now)** | Portfolio summary (value · equity · LVR) · per-property cashflow strip · **EOFY readiness** (M3.2 nudges) · documents/evidence status · intake queue | `null` |
| **R2** | Tax position slice · housekeeping review | `MODULE_TAX` · `MODULE_HOUSEKEEPING` |
| **R3** | Household cashflow · safety net · debt freedom | `MODULE_HOUSEHOLD` · `MODULE_SAFETY_NET` · `MODULE_DEBT_PLANNER` |
| **R4** | CFO actions · strategy | `MODULE_CFO` · `MODULE_STRATEGY` |
| **R5** | Wealth universe · investments | `MODULE_ENTITIES` · `MODULE_INVESTMENTS` |

**Admin surface:** a "Dashboard tiles" section under the Modules panel — one row per tile: label · stage · owning module · computed state (`LIVE` / `HIDDEN — module off` / `SUPPRESSED`) · the suppress toggle. Reza can see at a glance which tiles the current stage puts on the dashboard, and why any tile is dark.

**M3.4 build rule (from this inventory):** the scoreboard is a NEW client composed from `/api/portfolio/snapshot` + the per-property cashflow engine + the M3.2 completeness checks. `HomeClient.tsx` is **not deleted** (hidden ≠ deleted) — it stays for the R4 wealth-OS Home. Do not lift its widgets wholesale; do not add the WealthUniverse tile; every link must point at a KEPT route (MON-163's lesson).
</details>
- [ ] M3.5 🧑🟩 **The pilot = the user research:** Reza's accountant + 2–3 friendlies run the pack on real FY2025-26 data. Acceptance: the accountant needs NOTHING else to complete the rental schedule. Findings → registry issues, fixed, re-run.
- [ ] M3.6 🟦 **The M2.6 depth backlog** — the launch-relevant gaps the sweep catalogued, closed here (D-20: this is the milestone's substance, not a leftover).
- [ ] M3.7 🟩 **GATE REVIEW** (D-17 ritual) recorded here — **includes the D-18 GO decision: Reza rules which M4 tasks (if any) are authorised to build, one by one.**
**Gate:** accountant sign-off captured in this doc; dashboard live as the scoreboard with its stage-aware tiles. **This gate closes the flagged user-voice research gap.**

### M4 — AI intake (P4 rescoped by D-11; pain rows 1, 9, 10, 11) — ⛔ D-18 HOLD: planned + sequenced here, NOT pre-authorised. Each task below starts only on Reza's explicit GO (taken at the M3 gate review or later). Until then, all four actors treat M4 as read-only roadmap.
The automation design law made real: AI does the keying, matching, classifying and filing; the user confirms. (Builds ON the existing Vision OCR + analyze pipeline + LinkingRules cascade — extensions of what exists, but they are new capability surfaces, hence the GO gate.)
- [ ] M4.0 🧑 **D-18 GO recorded per task** (which of M4.1–M4.6, in what order) — becomes the next D-number.
- [ ] M4.1 🟦 Statement agent v1: upload PM statement / bank statement (PDF/CSV) → existing Vision OCR + analyze pipeline → classify + property-link via LinkingRules cascade → **propose→confirm queue** (one review moment per statement; accept-all-correct in one tap); every confirmed row carries its source-document link
- [ ] M4.2 🟦 **AI reconciliation (pain 9):** every imported/uploaded row auto-matched — property link, loan match, recurring-item match, duplicate detection — proposed for confirm; unmatched rows queue with best-guess, never silently dropped
- [ ] M4.3 🟦 **AI categorisation (pain 10):** ATO category + deductibility proposed per row with confidence; learns from corrections; low-confidence rows surfaced first; bulk accept
- [ ] M4.4 🟦 **Docs auto-filed to transactions (pain 11):** any uploaded document OCR'd, auto-filed to its property AND auto-linked to the matching transaction row (extends the existing vault cascade)
- [ ] M4.5 🟦 QS depreciation schedule upload → OCR → schedule lines
- [ ] M4.6 🟦 Onboarding rebuilt to 3 steps (property → loan → rent+agent); hidden-module wizard steps removed; `isTaxDeductible` defaults per category
- [ ] M4.7 🟩🧑 Time-to-first-correct-number < 5 min on a fresh account; taps-to-done measured per flow; zero silent writes (audit: every AI row has a confirm event)
- [ ] M4.8 🟩 **GATE REVIEW** (D-17 ritual) recorded here.
**Gate:** a new user reaches a correct per-property number in one sitting, with AI doing the work and the user only confirming. AFSL note: extraction/classification only — no advice surface, in code or copy.

### M5 — Publish 🚀
- [ ] M5.1 🧑🟩 Positioning/site rewrite to the §1 story (the queued row-66 follow-up — a marketing defect if skipped)
- [ ] M5.2 🧑 Pricing ruled (research anchors: TaxTank $15/mo · The Property Accountant $3.99/property/mo · Etax $59.90/schedule/yr status-quo cost · category clears A$10–20/mo; "tax-deductible" is the category selling line)
- [ ] M5.3 🟩🌐 Pre-launch verification sweep: golden self-diff CLEAN on PROD · route/nav smoke · pack generation on PROD data · health/monitoring
- [ ] M5.4 🧑 Go-live + first-users plan (friendlies → public)
- [ ] M5.5 🟩 **GATE REVIEW** (D-17 ritual) — includes the full pre-launch market/pricing re-check.
**Gate:** live, first external users, support loop agreed.

### M6 — Retention fast-follow + returns
- [ ] M6.1 🧑 Basiq feeds ON (built, dark — GTM/cost ruling; "tax pack = why they pay, feeds = why they stay"). NOTE: first CDR data in PROD permanently sunsets the D-7 dev-copy exception (runbook law).
- [ ] M6.2 R-stage returns, ONE at a time (D-8), each gated on producers converged + Ring-3 PASS live + Reza's switch: **R2** tax module as property-tax slice + 2027 reform readiness (cost-base register, 1-Jul-2027 valuation slot, quarantined-loss ledger — the legislated wedge; P5.4) + housekeeping → **R3** household/budget/debt/safety-net (needs Basiq) → **R4** CFO/strategy/full wealth-OS Home (highest AFSL bar) → **R5** entities/investments/social/labs/portal (commercial call each). Variance loop (P5.2) + Propsight import (P5.3) slot post-launch as the moat. **Each return also lights its D-19 dashboard tiles automatically — no separate dashboard work per stage.**
- [ ] M6.3 🟩 **GATE REVIEW** (D-17 ritual) per R-stage return — each return gets its own review before AND after the switch.

---

## 5. Launch-blocking issues (the M2 working set)

**Law:** `docs/issues/ISSUES.md` + `docs/issues/ISSUES.json` remain the REGISTRY OF RECORD (all ~147 issues, full history). This table is the launch-blocking SUBSET only; status changes land in BOTH (same PR — Neo-sync discipline). Hidden-module issues stay HELD (P0.2 freeze + D-20) and are NOT listed.

| Issue | What | Status at 2026-08-19 |
|---|---|---|
| MON-001 | Rent frequency handling (kept surface) | **FIXING** (critical) → M2.3 |
| MON-129 | Producer-class sweep — 23 `lib/` producers convert rows to run-rates with no one-off gate | **OPEN** (critical) → M2.3, scoped by M2.0 to kept-surface producers only |
| MON-143 | Offset netting | **VERIFIED already** — closed; the earlier "OPEN" entry here was plan drift, corrected 2026-08-19 |
| MON-145 | `Loan.interestRateAnnual` is an undated scalar while repayments are dated | **OPEN** (high) → M2.3 (feeds the pack's per-loan interest, pain 3) |
| MON-146 | Loan rate rendered 100× too small | **OPEN** (medium) — cited surface `/dashboard/expenses` is **HIDDEN**. **M2.0 scoping question:** does the same render path appear on a KEPT surface? If not → HELD, do not fix (D-20). |
| MON-160 | Static-prerender flag gating (build-time-baked module guards) | **FIXED on #1590 · VERIFIED live 2026-08-19** (M1.5 flip test) → flip to VERIFIED in the registry at M2 |
| MON-161 | **NEW (M1.5 run):** stale **cached 404** on a gated route's bare URL for ~2 min after a flag flip — a cache-busted request gets the correct verdict immediately, so request-time gating works; the artefact is response/browser caching of the 404 for that exact URL. Undercuts the panel's ~30s promise every R-stage return relies on. Fix: `Cache-Control: no-store` (or equivalent) on gated-route 404 responses. | TO REGISTER + FIX in M2 (brief §C) |
| MON-162 | **NEW (Reza, M1.5 run):** the admin portal and the app **cannot hold independent sessions in one browser** — signing into either signs the other out (shared auth storage, same origin). | TO REGISTER in M2 (brief §A); **fix DEFERRED** by Reza's ruling (P-3/P-5) |
| MON-163 | **NEW (Matrix scan 2026-08-19, LIVE IN PROD):** the KEPT property-detail page `/dashboard/properties/[id]` links to **hidden** routes — `/dashboard/tax` (:556), `/dashboard/income` (:746, :758) and `/dashboard/cfo/what-if/sellProperty` (:403, :548). A v1 user clicking any of them gets a 404. The P2.1 route sweep checked that hidden routes hide; it never checked that **kept** routes stop pointing at them. | TO REGISTER + FIX in M2.6 (brief §D) — **launch-blocking** |
| + M2.1 / M2.6 additions | Whatever the kept-surface census and the depth sweep surface | → triaged into this table as found |

Registry counts at last full count (P0.6, 2026-08-04, `e588a837`): 65 OPEN/FIXING · 5 critical · 146 total (147 with MON-160). Re-count at M2.1; never quote these numbers later without a re-pull.

---

## 6. Verification law (pointers, not copies)

Golden baseline self-diff CLEAN on every phase-gate (`.audit/golden-baseline-12954ff.json`; relay endpoints + runbook: project memory `matrix-relay-runbook`) · Ring-3 on LIVE data via R0 override = the bar for M2 and every R-stage return · never fix a number in passing (§23.2.1 — registry issue) · §20.6 tri-axis + §16.5 doc-sync in every PR body · SSOT audit is step 0 of every change · preview data refreshes ONLY per `docs/operations/PREVIEW_DATA_REFRESH_RUNBOOK.md` · **no kept surface may link to a hidden route (MON-163's rule) — check it whenever a kept page changes.**

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
| Code-session briefs | `docs/strategy/BRIEF_*.md` (M2: `BRIEF_M2_CORRECTNESS.md`; M1 archive: `BRIEF_SIMP_P2R_R0.md`) |

## 9. Session log

- 2026-08-19 · Code (Fable 5, session pre-dating this plan) · #1590 built (P2 gate: MON-160 dynamic-gating fix · P2.3/P2.4/P2.6 · close-out ticks in the old plan · §13.6/§7 amendment · set-module-flags.mjs; suite 4,509 green) + #1591 built (R0 overrides, stacked; layout-user deviation surfaced; suite 4,523 green). Both DRAFT, awaiting Reza.
- 2026-08-19 · Matrix HQ (Fable 5) · Deep market/user/analogue research (3 agent sweeps); v1 focus ruled D-10…D-18 (identity · AI propose→confirm · pack-not-portal · nudges · no-planning-side-door · one doc · dashboard-as-scoreboard · living-plan gate reviews · perfect-what-exists build law); §3.5 pain map rows 1-8 research-ranked + rows 9-12 Reza-added + §1 automation + build laws; §0 boot protocol; M4 under D-18 HOLD; GATE REVIEW ritual on every milestone; plan created at `380a526a`; then #1590/#1591 discovered and folded into the M1 cursor with merge order #1590→#1591→#1592.
- 2026-08-19 · Matrix HQ (Fable 5 → Opus 5) · **M1 CLOSED.** R0 acceptance PASS on live PROD (override holder sees `/dashboard/tax`; other account + signed-out 404; teardown verified from all three viewpoints — #1591 comments) · MON-160 verified live (flip → page + nav within cache window, no redeploy) · M1.4 dashboard inventory run at `bea895f1` and recorded under M3.4 (verdict: old Home not flip-on-able — 7 dead links, gated `wealth-graph` widget, household/CFO-scoped data APIs) · M1.7 gate review recorded with 5 upgrade proposals · MON-161 + MON-162 raised for registration · `BRIEF_M2_CORRECTNESS.md` cut. Cursor → M2, the launch gate.
- 2026-08-19 · Matrix HQ (Opus 5) · Reza rulings: **D-19** stage-aware dashboard tile registry (module-derived, suppress-only toggles — no second flag vocabulary) · **D-20 depth before surface** (kept-surface depth outranks any hidden-module work; hardens the P0.2 freeze) · P-4 and P-5 adopted as recommended (no NetWorth reuse until the census; cookie sessions parked). M2 gained **M2.0 scoping law** and **M2.6 depth sweep**; gate review renumbered M2.7; M3 gained M3.6 (depth backlog). **MON-163 found by static scan and confirmed live: the kept property-detail page links into three hidden routes (404s in PROD today)** — the P2.1 sweep never checked the kept→hidden direction. Brief rewritten accordingly.
