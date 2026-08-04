# PROD Simplification — Implementation Plan (TRACKING DOC)

**Status:** 📋 PLAN APPROVED-PENDING-REZA · **Kind:** phased implementation plan + live tracker. Code sessions progress THIS document.
**Raised:** 2026-08-04 · **By:** Cowork planning session (Fable 5) per `BRIEF_PROD_SIMPLIFICATION_PLANNING.md` (PR #1583) · **Pinned HEAD:** `e90a9195` (merge of #1582, 2026-08-04)
**Decision record:** §0 — all eight §5 brief decisions RULED by Reza 2026-08-04 (this session). Do not re-litigate.
**Companions:** `PRODUCT_SCOPE_V1_RECOMMENDATION.md` (Q-SCOPE-1, PR #1577 — merge trigger now MET: keep list ruled) · `MON-131_SCOPE_FILTER.md` (the producer analysis this plan scopes by) · `docs/implementation/MON-131_TRANCHE_LEDGER.md` (wins any disagreement on MON-131 state).

---

## CURSOR — update this block every session that advances the plan

| Field | Value |
|---|---|
| **Current phase** | P0 — Freeze & preconditions (not started) |
| **Last session** | 2026-08-04 · Cowork planning (this PR) |
| **Next action** | Merge this PR → land the tracker rows (P0.1) → P0 checklist |
| **Blockers** | none |
| **Baseline of record** | `.audit/golden-baseline-12954ff.json` (VR-048, 1,756 leaves, treeHash `0d6753ef…`) |

**Tracking rules (Code sessions):** tick checkboxes in the SAME PR as the work; update the cursor block; one phase gate = one PR that flips the phase status; never skip a gate; anything touching `docs/architecture/contracts/`, `docs/verification/**` or `scripts/matrix/` needs a MON-131 ledger §6 row (`scripts/check-mon131-ledger.mjs --strict` will fail the build otherwise). Registry re-counts happen at execution time — counts quoted here were true at `e90a9195` and are NOT to be re-quoted later without a re-pull.

---

## 0. DECISION RECORD — ruled by Reza, 2026-08-04

| # | Decision | Ruling |
|---|---|---|
| D-1 | Household (user-level) cashflow in v1 | **HIDE.** Per-property cashflow stays. Returns at Stage 3 (Basiq). |
| D-2 | Tax module (`/dashboard/tax`) | **HIDE.** The tax-time PACK (report) ships in v1. Module returns Stage 2 as property-tax slice. |
| D-3 | My Guide / CFO / What-If | **HIDE.** Returns Stage 4, only on verified numbers. |
| D-4 | Home + Housekeeping + Reports | **HIDE Home & Housekeeping; KEEP Reports narrowed to ONE pack.** Users land on `/dashboard/properties`. Home returns rebuilt when its modules do. |
| D-5 | Standalone Investments / Super | **HIDE.** Returns as staged module (or integration decision) after property surface verified. |
| D-6 | "Asset relationships personal, not entity" | **SAFE READING.** New capture defaults to personal; ownership picker hidden; existing attribution UNTOUCHED. No destructive write. |
| D-7 | Hidden modules keep running with real data | **COPY PROD → PREVIEW.** Ruled against the recommendation, eyes open — see §7 for the narrow exception, its sunset, and the §13.6 amendment this requires. |
| D-8 | WIP limit on hidden-module work | **ONE.** Freeze rule (§5, P0.2): hidden ⇒ no work, no fixes, issues → HELD — unless it is THE one module in active development. |

**Standing directives (Reza, 2026-08-04, this session):**
- **Automation-first v1:** least user engagement is the main product goal — AI + automation + simple UI. Concretely: AI reads bank/agent statements & documents, proposes property expenses, user confirms with one tap (**propose → confirm, never silent auto-write** — the confirmed audit trail is what makes numbers defensible). Phase P4.
- **No work is lost:** nothing is deleted. Every hidden module has a named return stage and re-enable trigger (§2, §5 R-stages). The prior "review for deletion after 90 days" recommendation (Q-SCOPE-1 §2.3) is **overruled**.
- **"100% working" defined:** a module returns online only when its producers are converged and it passes Ring-3 on live data — MON-131's five-condition definition of done (`MON-131_COMPLETION_BRIEF.md §1`) applied per module. No vibes-based re-enables.
- **Admin module panel:** Reza can see what is hidden and unhide with one switch (§4.4).

**Held doctrine (from the brief; binding on all phases):**
1. **Hiding is an exposure control, not a defect control.** Zero census quantities are property-exclusive; 10 are SPLIT. Remaining MON-131 work is scoped **by producer, not by tranche** (`MON-131_SCOPE_FILTER.md §0`).
2. **Flag-phase acceptance = CLEAN golden-baseline self-diff.** If any numeric leaf moves, the simplification changed a producer — that is a defect and it STOPS the phase (§6).

---

## 1. The first Monitrax (context — why this scope)

> **The post-purchase scoreboard for Australian property investors: know exactly what each property is actually doing — and hand your accountant a clean year.**

Confirmed by Reza 2026-08-04 after market research (this session). The evidence in one row each: 2.26M AU individuals declare rental interests (ATO 2022-23 stats, secondary-sourced); 86-87% lodge via tax agents and the ATO says 9/10 rental returns are wrong — with the failure in the records clients hand over (ato.gov.au media releases); NG/CGT reform is **legislated effective 1 Jul 2027** (deemed disposal, per-property quarantined losses, cost-base indexation — ATO new-legislation pages) making per-property records mandatory homework on a known date; no competitor owns both "post-purchase scoreboard" and "accountant handoff" at scale (TaxTank closest, ~$220k revenue UNVERIFIED via GetLatka; Moorr free/no ledger; propkt/The Property Accountant sub-scale); the **variance loop** (modelled-at-purchase vs actual) is owned by nobody; manual entry is survivable ONLY in this niche (~10-30 tx/property/yr; the agent statement is the canonical record — statement OCR substitutes for a bank feed here). Full four-lens analysis: Q-SCOPE-1 (PR #1577). Deeper market write-up intentionally NOT duplicated here (SSOT: session record + Q-SCOPE-1).

---

## 2. Keep / hide — route by route

**Design rule: only HIDDEN modules get flag keys.** Kept surfaces are unflagged and unconditional — a DB outage can never hide the kept app, and `enabled:false` fail-closed semantics mean the default state of every new key IS the correct v1 state. (Basiq's `BASIQ_INTEGRATION` key is untouched.)

### 2.1 KEEP (no flag; ships in v1)

| Surface | Routes | Notes |
|---|---|---|
| Properties | `/dashboard/properties`, `/[id]`, `/[id]/depreciation` | The module. `/[id]/strategy` is gated (MODULE_STRATEGY). |
| Loans (property attribute) | `/dashboard/loans`, `/loans/[id]` | `/loans/[id]/strategy` gated. Debt *Freedom* (planner) is gated. |
| Assets | `/dashboard/assets` | Reza's stated keep (2026-08-03), reaffirmed with D-5 (standalone Investments hidden; simple assets stay). |
| Documents / Vault | `/dashboard/documents`, `/dashboard/vault` | The accountant-facing asset. |
| Intake | `/dashboard/activity`, `/activity/review`, `/transactions`, `/dashboard/accounts`, `/dashboard/balances`, `/dashboard/recurring` | CSV/QIF, manual, cash quick-add, receipt OCR, reconcile→link, managed-rental reconciliation. Money-Flow Sankey widget already stripped (#1579, Lever 2). |
| Reports | `/dashboard/reports` | **Narrowed in-page to the property/tax-time pack** (P2.3); other report tiles hidden by module flag of their parent module. |
| Settings · Auth · Admin | `/dashboard/settings/**`, `/dashboard/setup`, `/dashboard/admin/**`, `/admin/**` | Table stakes / staff-only. Setup wizard rebuilt in P4. |

### 2.2 HIDE (flag key → routes → return stage)

| Flag key | Nav item(s) | Route prefixes | Return |
|---|---|---|---|
| `MODULE_HOME` | Home | `/dashboard` (root page ONLY — special: redirect to `/dashboard/properties` when off, never `notFound()`) | Rebuilt when its feeder modules return |
| `MODULE_HOUSEHOLD` | My Household, My Budget (Cashflow, My Plan), income/expense list pages | `/dashboard/household-profile`, `/cashflow`, `/dashboard/plan`, `/dashboard/budget-analysis`, `/dashboard/income`, `/dashboard/expenses` | Stage 3 (Basiq live) |
| `MODULE_DEBT_PLANNER` | Debt Freedom | `/dashboard/debt-planner` | Stage 3 |
| `MODULE_SAFETY_NET` | My Safety Net | `/dashboard/safety-net` | Stage 3 |
| `MODULE_ENTITIES` | My Structure | `/dashboard/entities/**` | Stage 5 (data model + auto-personal entity REMAIN live underneath — D-6) |
| `MODULE_INVESTMENTS` | Investments, Superannuation | `/dashboard/investments/**` | Stage 5 (or integration decision) |
| `MODULE_TAX` | Tax (under My Guide) | `/dashboard/tax` | Stage 2 — property-tax slice, post property Ring-3 |
| `MODULE_CFO` | My Guide (Actions, What If, Ask) | `/dashboard/cfo/**` | Stage 4 |
| `MODULE_STRATEGY` | — (per-item tabs) | `/strategy/**`, `/dashboard/properties/[id]/strategy`, `/dashboard/loans/[id]/strategy`, `/dashboard/investments/holdings/[id]/strategy` | Stage 4 |
| `MODULE_HOUSEKEEPING` | Housekeeping | `/dashboard/housekeeping/**` | Stage 2-3 (with its parent surfaces) |
| `MODULE_SOCIAL` | Conversations, Requests | `/dashboard/conversations/**`, `/dashboard/requests` | Stage 5 |
| `MODULE_LABS` | — | `/dashboard/labs/**` | Stage 5 |
| `MODULE_ORG_PORTAL` | — (separate front-end) | `/portal/**` | Stage 5 (separate product bet) |

Onboarding wizard steps for hidden modules: trimmed as part of P4's rebuild (not flag-gated — the wizard is being replaced anyway).

### 2.3 API prefixes — mapped by AUDIT, not by assumption

**Binding rule: an API route is gated by a module key only if NO kept surface calls it.** The property pages edit expenses in-context via `ExpenseDialog → /api/expenses` (Q-SCOPE-1 §1.6 coherence check) — so `/api/expenses`, `/api/income`, `/api/loans`, `/api/ownership`, `/api/transactions`, `/api/documents` etc. stay OPEN even though their list *pages* are hidden. Starter mapping (P1.2 build session completes the audit and records the final table IN THIS FILE):

- Gate candidates: `cashflow`, `budget`, `budget-analysis`, `safety-net`, `cfo`, `ai-advisor`, `ask-a-pro`, `tax` (audit: the pack must read tax LIB code server-side, not the gated route), `investments`, `strategy`, `conversations`, `professional-requests`, `marketplace`, `portal`, `household-profile`, `household-members`, `household-pets`, `debt-planner` (if present), `financial-health`, `dashboard`, `wealth-graph`, `money-flow` (Sankey feed — intake side stays), `master-snapshot` (**audit carefully** — master consumes property engine one-way; no kept surface should need it, but verify before gating).
- Never gated: everything the kept table (§2.1) reaches, plus `auth`, `admin`, `feature-flags`, `onboarding`, `setup`, `health`, `verify`, `intake`, `categories`, `categorisation`, `rental-reconciliation`, `unified-transactions`, `linkage`, `storage`, `search`, `settings`, `stripe`, `reports`, `portfolio`.

---

## 3. Module registry design (no schema change — stated per brief §7.3)

One new file, `lib/featureFlags/moduleRegistry.ts`:

```ts
export type ModuleKey = 'MODULE_HOME' | 'MODULE_HOUSEHOLD' | /* …§2.2 keys */;
export interface ModuleDef {
  key: ModuleKey;
  label: string;              // admin panel display name
  navHrefs: string[];         // hrefs filtered out of trailNav-rendered nav
  routePrefixes: string[];    // layout/page guards
  apiPrefixes: string[];      // API guards (post-audit, §2.3)
  returnStage: 2 | 3 | 4 | 5; // shown in the admin panel
  behaviour?: 'redirect';     // MODULE_HOME only: redirect to /dashboard/properties
}
export const MODULE_REGISTRY: readonly ModuleDef[] = [ /* … */ ];
```

The registry is the **single source of the hide decision** (SSOT §12.2.1): nav filtering, route guards, API guards and the admin panel all read this one structure. No second nav source, no per-page hardcoding. `GlobalFeatureFlag` rows (`prisma/schema.prisma:5988-6009`) hold ONLY the on/off state; the registry holds the meaning of each key.

---

## 4. Gate build shape (generalise the Basiq five-layer reference)

Verified at `e90a9195` this session: `basiqGate.ts` fail-closed cached reader (`:52-71`) · seed never overwrites `enabled` (`seed-feature-flags.ts:47-60`) · `NavItem` has no flag field (`trailNav.tsx:35-44`) · `FeatureFlagOverride` / `enabledForPercent` / `enabledForTiers` / `enabledForPlans` have **zero evaluation readers** (display + create-write sites only).

1. **`lib/featureFlags/moduleGate.ts`** — `isModuleEnabled(key)`: keyed cache (Map, 30s TTL), same fail-closed semantics as `basiqGate.ts`. `isBasiqEnabled` kept as an alias so the 10 existing call sites don't churn. **Semantics note:** for module keys, "fail closed" = flag off/unreadable ⇒ module HIDDEN — which is the safe v1 state by construction.
2. **Nav:** `moduleKey?: ModuleKey` on `NavItem` (`trailNav.tsx:35-44`) + filter in `EditorialSidebar.tsx:82` + **fix the `mobileMoreItems` non-null-asserted `.find()` (`trailNav.tsx:382-385`)** which throws the moment an item disappears.
3. **Client:** `GET /api/feature-flags/modules` (public JSON, all module keys) + `useModuleEnabled(key)` starting disabled — Basiq's client-context pattern.
4. **Server enforcement (the real control):** `moduleRouteGuard(key)` in each hidden module's **layout** → `notFound()` (MODULE_HOME: `redirect('/dashboard/properties')`); API guard returning 503 on gated prefixes. `middleware.ts` explicitly CANNOT do this (Edge runtime, no Prisma — CLAUDE.md §13.6). Nav-only hiding is a compliance hazard and is not acceptance-complete.
5. **Cache invalidation:** the PATCH hook at `app/api/admin/feature-flags/[key]/route.ts:167-169` becomes unconditional (currently Basiq-hard-coded).
6. **Seed:** all §2.2 keys added `enabled:false` (fail-closed ship). Existing seed update-path behaviour (never overwrite `enabled`) preserved.

### 4.4 Admin Modules panel (Reza's directive, 2026-08-04)

A "Modules" section on `app/admin/feature-flags/page.tsx` (or sibling page): one row per registry key — label, **HIDDEN/LIVE** state, return stage, last-flipped timestamp + actor (the existing audit logging supplies this), and the working on/off switch (the existing toggle, pointed at module keys). Unhide = flick the switch; nav + routes + APIs follow within the 30s cache TTL. Panel copy states the freeze rule: *unhiding is a stage-gate decision (see PROD_SIMPLIFICATION_PLAN.md §5 R-stages), not a casual toggle.*

### 4.5 Dead override UI — disposition (brief §7.5)

The Edit / Overrides / "Create Override" controls have no `onClick` and no API; `enabledForPercent`/`enabledForTiers`/`enabledForPlans` and the whole `FeatureFlagOverride` table are written/displayed but never evaluated. **P1 removes the dead controls and per-tier/percent display columns** (UI only — schema untouched, §23.2.1-adjacent caution: zero behaviour change). They must not stay misleading on the panel Reza will now actually use. `FeatureFlagOverride` **wiring** is deliberately deferred to **R0** (§5) — it is required before any module's re-enable Ring-3 (which must run on live PROD data for Reza only), and is not needed for the hide itself under D-7.

---

## 5. Phases — each with a gate; a phase is DONE when its gate PR merges with the boxes ticked

### P0 — Freeze & preconditions *(docs/ops only; no product code)* — 📋
- [ ] **P0.1 Land the tracker rows this PR could not carry** (connector size limits; texts in PR body): 01_ACTIVE_WORKSTREAMS.md entry · STATE.md cursor row · hub `Last updated` bump · the still-unwritten Q-SCOPE-1 open-questions row (PR #1577 body, standing gotcha).
- [ ] **P0.2 Freeze rule into STATE.md** (exact text): *"SCOPE FREEZE (Reza 2026-08-04): modules hidden by PROD_SIMPLIFICATION_PLAN.md §2.2 get no work, no fixes, no new issues; registry entries → HELD. Exception: THE one module in active development (WIP limit = 1). Re-enable = R-stage gate only."*
- [ ] **P0.3 CLAUDE.md §13.6 amendment for D-7** (§7 below) — the Preview-copy exception + sunset, in writing, same PR as P0.2.
- [ ] **P0.4 Verify `NEXT_PUBLIC_ADMIN_PORTAL_ENABLED` on Vercel Preview scope** (2-min check: `vercel env ls` or dashboard). If Production-only → add it to Preview (it's baked at build time, so a redeploy is needed). Blocks the D-7 workflow, not the PROD hide.
- [ ] **P0.5 Merge PR #1577** (Q-SCOPE-1) — its stated merge trigger (keep-list ruled) is now met. Doc flips 🟡 RECOMMENDATION → DECIDED with a pointer to §0 here.
- [ ] **P0.6 Registry re-count** — refresh issue counts vs the 63/135 quoted at the filter HEAD; record the delta here.
**Gate:** all boxes ticked. **Model: Fable 5** (mechanical, doc-heavy). **Reza:** P0.4 answer + merges.

### P1 — The module gate build *(product code; flips NOTHING — all keys ship `enabled:false` and PROD behaviour is unchanged until Reza flicks switches)* — 📋
- [ ] P1.1 `moduleRegistry.ts` + `moduleGate.ts` + alias (§3-4)
- [ ] P1.2 **API audit** (§2.3 rule) — final gate table recorded in §2.3 of this file, same PR
- [ ] P1.3 Nav filtering + `mobileMoreItems` fix
- [ ] P1.4 Layout guards + API guards + MODULE_HOME redirect
- [ ] P1.5 `/api/feature-flags/modules` + `useModuleEnabled`
- [ ] P1.6 Unconditional cache invalidation
- [ ] P1.7 Seed all keys `enabled:false`
- [ ] P1.8 Admin Modules panel (§4.4) + dead-control removal (§4.5)
- [ ] P1.9 Tests: gate unit tests (fail-closed, keyed cache, invalidation), nav-filter tests, guard 404/503/redirect tests
- [ ] **P1.10 ACCEPTANCE: golden-baseline self-diff = `CLEAN`** against `.audit/golden-baseline-12954ff.json` (via the Matrix relay `POST /api/admin/matrix/golden-baseline/diff`, or `npx tsx scripts/matrix/golden-baseline.mjs` with DATABASE_URL). **Any numeric leaf moved ⇒ a producer changed ⇒ DEFECT; the phase STOPS** (held doctrine #2). Run once with all flags off (ship state) and once with flags on in Preview (dev DB) — both must be CLEAN.
**Gate:** P1.10 CLEAN recorded (verdict + treeHash in the PR body). **Model: Fable 5.** Touches no `lib/calculations/**` producer — if a diff says otherwise, that IS the defect.

### P2 — The flip *(PROD state change; Reza's hands on the switches)* — 📋
- [ ] P2.1 Verify PROD came up hidden after deploy (**keys default hidden — nothing to flip**): smoke-test each §2.2 route → 404/redirect, each gated API → 503, nav shows: Properties · Assets · Loans · Documents · Activity · Reports · Settings
- [ ] P2.2 Post-deploy golden self-diff on PROD: `CLEAN` (same criterion as P1.10)
- [ ] P2.3 Reports page narrowed in-page to the property/tax-time pack
- [ ] P2.4 D-6 safe default: new-capture ownership defaults to personal entity; picker hidden behind `MODULE_ENTITIES`; **zero writes to existing attribution** (§12.11 guard — destructive path is out of scope permanently per D-6)
- [ ] P2.5 D-7 Preview copy executed per §7 runbook; copy date + hash recorded here
- [ ] P2.6 Positioning follow-up registered (site copy vs one-module app — Q-SCOPE-1 risk 2; queued row 66 in 02_UP_NEXT.md) — not built in this phase
**Gate:** PROD is the v1 surface; both self-diffs CLEAN; screenshots or route-check transcript in the PR. **Model: Fable 5** + **Reza** (deploy click, Preview-copy runbook §7).

### P3 — Kept-surface convergence *(the correctness programme, producer-scoped)* — 📋
Scope rule (held doctrine #1): work is picked **by producer reaching a kept surface**, never "whatever is left of a tranche". Mechanics, gates and evidence live in the MON-131 ledger + build spec — **this plan does not duplicate them (SSOT)**; this phase's checklist tracks only the kept-surface slice:
- [ ] P3.1 Re-run producer census filtered to §2.1 kept surface at current HEAD (expected ≈8-10 quantities: the 10 SPLIT + 2 loan sub-quantities of `MON-131_SCOPE_FILTER.md §1.1`, minus any the Sankey removal took dark; T5-T7 fall out → HELD)
- [ ] P3.2 T2 (loan cost) Ring-3 on live data — already the programme's next step; in kept scope
- [ ] P3.3 Kept-surface defect cluster to VERIFIED (at filter HEAD: MON-001 rent frequency · MON-143 offset netting · MON-145 undated rate · MON-146 100× rate render · MON-129 producer-class sweep where producers feed the pack/Activity · plus the P3.1 re-count's additions — MON-149…153 raised since)
- [ ] P3.4 Kill the properties list page's inline cashflow re-derivation (`properties/page.tsx:1195-1216` bypasses the engine — Q-SCOPE-1 §3 Phase 2)
- [ ] P3.5 MON-131 five-condition done, applied to kept quantities only
**Gate:** Ring-3 PASS on live data across kept quantities. **Model: Opus 4.8 for diagnosis/convergence briefs, Fable 5 for mechanical sweeps** — per-brief routing recorded in each Code handoff. **This phase is the v1 launch gate.**

### P4 — Effortless intake: AI + 3-step onboarding *(Reza's automation-first directive)* — 📋
Builds ONLY on P3-verified engines (automation on top of wrong numbers = wrong numbers, faster).
- [ ] P4.1 Onboarding rebuilt to 3 steps (property → loan → rent+agent); hidden-module wizard steps removed; `isTaxDeductible` defaults per category (not blanket `false`)
- [ ] P4.2 **Statement agent v1:** upload agent statement / bank statement (PDF/CSV) → existing Vision OCR + analyze pipeline → AI classifies + property-links via `LinkingRules.ts` cascade → **propose→confirm queue** (one review moment per statement, one-tap accept-all-correct); confirmed rows carry source-document links (ATO-defensible)
- [ ] P4.3 QS depreciation schedule upload → OCR → schedule lines (extends P4.2 pipeline; Q-SCOPE-1 Phase 3)
- [ ] P4.4 Time-to-first-number < 5 min measured on a fresh account
**Gate:** a new user reaches a correct per-property number in one sitting; no silent writes anywhere (audit: every AI-originated row has a confirm event). **Model: Fable 5** (agentic pipeline build), **Opus 4.8** review pass on classification correctness rules. **AFSL note:** extraction/classification is factual — no advice surface; keep it that way in copy.

### P5 — The accountant pack + variance loop *(the market wedge)* — 📋
- [ ] P5.1 One-click per-property-per-FY pack: income, deductions, depreciation, loan interest, linked documents bundle (PDF + CSV) — reads converged engines + tax LIB server-side only
- [ ] P5.2 Variance loop v1: purchase-time assumptions (manual entry first) vs actuals, per property per FY, gap named
- [ ] P5.3 Propsight import (file/JSON) seeds assumptions — import before API (no public API evidenced, UNVERIFIED); any partnership terms restate the AFSL/tax boundary (`docs/legal/afsl-credit-tax-boundary-disclosure.md`)
- [ ] P5.4 Reform-readiness fields: cost-base register + 1-Jul-2027 valuation slot per property (legislated deemed-disposal — the dateable catalyst)
**Gate:** an accountant can use the pack without asking for anything else (test with Reza's accountant on real FY data). **Model: Fable 5;** Opus 4.8 for the tax-aggregation correctness review.

### R-stages — the return roadmap (no work is lost; ONE active at a time — D-8)

| Stage | Modules (keys) | Re-enable trigger (all three: producers converged · Ring-3 PASS live · Reza's switch) |
|---|---|---|
| **R0 (precondition)** | — `FeatureFlagOverride` wiring: evaluation reader (user-scoped), override API route, admin UI — enable-for-Reza-only-in-PROD | Required BEFORE any R-stage Ring-3 (verification must run on live PROD data; Preview cannot satisfy Ring-3 by definition) |
| **R2** | MODULE_TAX (property slice: rental deductions, depreciation, CGT cost-base, quarantined-loss tracking per the 2027 regime), MODULE_HOUSEKEEPING | Property surface Ring-3 PASS (P3) + first paying users |
| **R3** | MODULE_HOUSEHOLD, MODULE_DEBT_PLANNER, MODULE_SAFETY_NET | **Basiq live** (GTM MRR/cash thresholds met) — these are dishonest without a feed |
| **R4** | MODULE_CFO, MODULE_STRATEGY, MODULE_HOME (rebuilt) | Numbers verified across the then-live surface (highest AFSL bar) |
| **R5** | MODULE_ENTITIES, MODULE_INVESTMENTS, MODULE_SOCIAL, MODULE_LABS, MODULE_ORG_PORTAL | Commercial decision per module, then the same three-part trigger |

---

## 6. Verification & acceptance (the falsifiable bits)

- **Flag-phase acceptance:** golden-baseline self-diff verdict `CLEAN` vs `.audit/golden-baseline-12954ff.json` (VR-048: 1,756 leaves, treeHash `0d6753ef…`, committed at `e90a9195`). The reference is captured from eight `lib/` engine functions, not UI — flag-gating nav/routes/APIs must not move it (brief §3). Any moved numeric leaf = defect = phase stop. Recorded per run: verdict, changed-leaf count, treeHash, HEAD.
- **Never fix a number in passing** (§23.2.1): if any phase surfaces a wrong number, it becomes a registry issue routed through MON-131 discipline — never patched inline.
- **§20.6 tri-axis** on every phase-gate PR; **§16.5 doc-sync block** in every PR description.
- **Ring-3** (live data) is the bar for P3 completion and every R-stage re-enable — via R0's override wiring.

## 7. D-7 — the Preview-copy exception (written, narrow, sunset)

Ruled by Reza 2026-08-04 with the counter-recommendation surfaced (brief §5.3). Encoded as:
1. **Lawful basis today:** all PROD data is Reza's own manually-entered portfolio; no CDR-sourced data exists (Basiq dark). Copying it to `monitrax-db-dev` breaches no external obligation today — only the internal §13.6 rule, which P0.3 amends rather than silently violates.
2. **Amendment text (P0.3):** *"§13.6 exception (Reza 2026-08-04): a one-way PROD→dev copy of Reza's own account data is permitted for hidden-module development under PROD_SIMPLIFICATION_PLAN.md §7. This exception SUNSETS permanently the day any CDR/Basiq-sourced data lands in PROD; from that day dev reverts to synthetic-only and the copy is purged."*
3. **Runbook (P2.5):** point-in-time dump of Reza's rows → restore into dev; one direction only; never dev→PROD; refresh on demand, each refresh logged in this file; no other users' data ever included (single-user today; the rule is written for the day that changes).
4. **What the copy does NOT do:** it does not verify anything. Ring-3 runs on live PROD data only — hence R0. The copy is a development convenience, not a verification path.

## 8. Risks · deliberately not planned · coverage boundary

**Risks:** (1) Positioning gap — site says "operating system", app shows one module; rewrite queued (02_UP_NEXT.md row 66), candidate story in §1; not doing it by P2 is a marketing defect, not a product one. (2) Scope-freeze decay — mitigated by P0.2 + D-8 + this decision record; the pattern that produced 45 parallel workstreams is the enemy. (3) The kept surface is not yet correct (MON-001/143/146 live at HEAD) — P3 exists because of this; hiding did not fix it. (4) TaxTank/propkt attack "manual entry" — mitigated by P4 (statement agent) and the GTM's existing Basiq gate as fast-follow. (5) Connector size limits blocked the tracker-row updates this PR should carry — P0.1 is the named repair, texts in the PR body (precedent: Q-SCOPE-1's still-unwritten row).

**Deliberately not planned here:** MON-131 tranche mechanics (ledger owns them) · deletion of any module (overruled by directive) · Basiq/CDR build-out (GTM-gated) · Org Portal product decisions (separate bet) · marketing-site rewrite execution · mobile app.

**Coverage boundary:** this plan verifies the gating capability, the route/nav/API inventory mapping, and the decision record — at `e90a9195`. It does NOT verify: that any kept-surface number is currently correct (P3's job); the API audit (P1.2's job — §2.3 is a starter map); Vercel env scoping (P0.4); Propsight's integration surface (UNVERIFIED); current registry counts (P0.6). Market figures in §1 carry the session's research sourcing, incl. two UNVERIFIED revenue estimates flagged inline.

## 9. Session log (append one line per session that advances this plan)

- 2026-08-04 · Cowork (Fable 5) · Plan created; §0 rulings taken; HEAD `e90a9195`.
