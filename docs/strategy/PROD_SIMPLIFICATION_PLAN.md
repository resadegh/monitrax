# PROD Simplification — Implementation Plan (TRACKING DOC)

> **📍 SUPERSEDED FOR TRACKING (2026-08-19).** Live state, roadmap and checkboxes now live in `MONITRAX_V1_MASTER_PLAN.md`. **This document remains binding as the module-gate DECISION RECORD (§0 rulings D-1…D-9) and DESIGN ARCHIVE (§2 route/API inventory, §3 registry, §4 gate shape).** Do not update its cursor — it is frozen at the M1 close-out.

**Status:** 📋 PLAN APPROVED-PENDING-REZA · **Kind:** phased implementation plan + live tracker. Code sessions progress THIS document.
**Raised:** 2026-08-04 · **By:** Cowork planning session (Fable 5) per `BRIEF_PROD_SIMPLIFICATION_PLANNING.md` (PR #1583) · **Pinned HEAD:** `e90a9195` (merge of #1582, 2026-08-04)
**Decision record:** §0 — all eight §5 brief decisions RULED by Reza 2026-08-04 (this session). Do not re-litigate.
**Companions:** `PRODUCT_SCOPE_V1_RECOMMENDATION.md` (Q-SCOPE-1, PR #1577 — merge trigger now MET: keep list ruled) · `MON-131_SCOPE_FILTER.md` (the producer analysis this plan scopes by) · `docs/implementation/MON-131_TRANCHE_LEDGER.md` (wins any disagreement on MON-131 state).

---

## CURSOR — FROZEN at the M1 close-out (2026-08-19) — live cursor: `MONITRAX_V1_MASTER_PLAN.md`

| Field | Value |
|---|---|
| **Current phase** | P0 ✅ · P1 ✅ (#1587 merged; P1.10 → P2.2/P2.2b CLEAN) · P2 — gate PR open (Code-side items done; MON-160 fix aboard) · R0 — built (own PR) |
| **Last session** | 2026-08-19 · Code (P2 remainder + preview script + MON-160 fix + R0 override wiring, per BRIEF_SIMP_P2R_R0) |
| **Next action** | Reza: merge the P2-gate PR (deploys the MON-160 fix) + the R0 PR → run the R0 acceptance (§ R-stages precondition) → P2.1 crumbs → P3 kickoff |
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
- **Admin is PROD-only (Reza, 2026-08-06):** all admin functions are maintained and managed in PROD — no admin portal use on Preview (no users log into admin yet). Consequences: dev-DB flag state for the D-7 workflow is managed by Code sessions directly (seed/SQL), not via an admin UI; any acceptance test that needed Preview admin relocates to PROD (see P1.10 resolution / P2.2b).

**Held doctrine (from the brief; binding on all phases):**
1. **Hiding is an exposure control, not a defect control.** Zero census quantities are property-exclusive; 10 are SPLIT. Remaining MON-131 work is scoped **by producer, not by tranche** (`MON-131_SCOPE_FILTER.md §0`).
2. **Flag-phase acceptance = CLEAN golden-baseline self-diff.** If any numeric leaf moves, the simplification changed a producer — that is a defect and it STOPS the phase (§6).

---

## 1. The first Monitrax (context — why this scope)

> **Identity superseded by D-10 (2026-08-19):** the v1 story is now the `MONITRAX_V1_MASTER_PLAN.md` §1 line — *the per-property record system for Australian property investors: AI reads your statements, every dollar lands in the right ATO category with its evidence attached, and your accountant gets a clean pack in one click.* The paragraph below is the 2026-08-04 market evidence that led there (kept as the decision archive).

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

**✅ P1.2 AUDIT COMPLETE (2026-08-04, PR-B — the FINAL gate table; every verdict from a grep of kept pages/components/hooks/lib at `e588a837`):**

| Prefix | Verdict | Module key | Evidence (kept callers, or why gated) |
|---|---|---|---|
| `cashflow` | **GATE** | MODULE_HOUSEHOLD | callers only in hidden `/cashflow` page + `/dashboard/plan` |
| `budget` | **GATE** | MODULE_HOUSEHOLD | zero callers anywhere (`/api/budget/comparison`, `/health` orphaned) |
| `budget-analysis` | **GATE** | MODULE_HOUSEHOLD | callers: budget-analysis / debt-planner / plan pages — all hidden |
| `safety-net` | **GATE** | MODULE_SAFETY_NET | sole caller is the hidden safety-net page |
| `cfo` | **GATE** | MODULE_CFO | callers: cfo pages + `AIAdviceSection` (cfo-only import) |
| `ai-advisor` | **GATE** | MODULE_CFO | sole caller `cfo/ask` |
| `financial-health` | **GATE** | MODULE_CFO | ZERO fetch callers anywhere (orphan route; doc-comment refs only) |
| `ask-a-pro` | **GATE** | MODULE_SOCIAL | callers only via `/marketplace` pages + a CFO card — both hidden (marketplace routes added to MODULE_SOCIAL, see below) |
| `conversations` | **GATE** (except `retention-sweep`) | MODULE_SOCIAL | callers hidden. **Exception:** `/api/conversations/retention-sweep` stays OPEN — data-retention deletion must keep running while the module is hidden |
| `professional-requests` | **GATE** | MODULE_SOCIAL | callers: requests page + marketplace compose dialog — hidden |
| `marketplace` | **GATE** | MODULE_SOCIAL | callers: `/marketplace` pages only. **Audit finding:** those pages were in NO §2.2 route list — added `/marketplace` to MODULE_SOCIAL routePrefixes so they hide with their API instead of rendering against 503s |
| `wealth-graph` | **GATE** | MODULE_ENTITIES | consumers: Home widgets + entities page — both hidden. NOTE: if MODULE_HOME returns (R4) before MODULE_ENTITIES (R5), revisit |
| `money-flow` | **GATE** | MODULE_HOME | zero callers of any kind; the activity Sankey reads `/api/master-snapshot`; the portal mirror is a different prefix |
| `strategy` | **GATE** | MODULE_STRATEGY | its only kept-surface callers are the per-item Strategy tabs (properties page, LoanDetailDialog), which P1 client-gates behind the SAME key — coherent by construction |
| `tax` | **KEEP-OPEN** | — | the onboarding wizard (kept shell) writes `/api/tax/super` (`lib/onboarding/superSync.ts:97,222,233,244`). Reports never fetch `/api/tax` — `lib/reports/contextBuilder.ts:26-27` imports tax lib code directly ✓ (the §2.3 careful-case confirmed) |
| `master-snapshot` | **KEEP-OPEN** | — | **the careful-case verdict flipped by audit:** kept callers exist — `hooks/useTrailStage.ts:53` ← `TrailStagePill` ← the SIDEBAR (every kept page), `app/dashboard/activity/page.tsx:623`, `ConsumerMoneyFlowSankey.tsx:175` (still mounted at activity:803) |
| `investments` | **KEEP-OPEN** | — | account pickers on kept dialogs: `ExpenseDialog.tsx:241`, `TransferDestinationSheet.tsx:95`, `CreateExpenseFromRecurring.tsx:151`, + wizard `investmentsSync.ts` |
| `portal` | **KEEP-OPEN** | — | `FeedbackChatDrawer.tsx` (kept shell, every page) calls `/api/portal/feedback*`. The `/portal/**` PAGES are hidden by the MODULE_ORG_PORTAL route guard |
| `household-profile` / `household-members` / `household-pets` | **KEEP-OPEN** | — | wizard `householdSync.ts` (shell-mounted) + `OwnershipPicker.tsx:98` on kept asset/property/loan/account dialogs |
| `dashboard` | **KEEP-OPEN** | — | `app/dashboard/balances/page.tsx:617` → `/api/dashboard/hidden-wealth` (kept Hidden-Wealth lens) |
| `debt-planner` | **N/A** | — | no `/api/debt-planner` exists; the page reads `/api/budget-analysis` (gated) |

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

### P0 — Freeze & preconditions *(docs/ops only; no product code)* — ✅ DONE (gate closed 2026-08-05: PR-A #1586 merged; P0.4 answered; #1577 merged + doc flipped)
- [x] **P0.1 Land the tracker rows this PR could not carry** (connector size limits; texts in PR body): 01_ACTIVE_WORKSTREAMS.md entry · STATE.md cursor row · hub `Last updated` bump · the still-unwritten Q-SCOPE-1 open-questions row (PR #1577 body, standing gotcha). ✅ 2026-08-04, PR-A — all four landed; Q-SCOPE-1 row inserted with status ✅ DECIDED → plan §0.
- [x] **P0.2 Freeze rule into STATE.md** (exact text): *"SCOPE FREEZE (Reza 2026-08-04): modules hidden by PROD_SIMPLIFICATION_PLAN.md §2.2 get no work, no fixes, no new issues; registry entries → HELD. Exception: THE one module in active development (WIP limit = 1). Re-enable = R-stage gate only."* ✅ 2026-08-04, PR-A — verbatim, in the STATE.md resume-cursor area.
- [x] **P0.3 CLAUDE.md §13.6 amendment for D-7** (§7 below) — the Preview-copy exception + sunset, in writing, same PR as P0.2. ✅ 2026-08-04, PR-A — verbatim §7.2 text appended directly under the §13.6 table.
- [x] **P0.4 Verify `NEXT_PUBLIC_ADMIN_PORTAL_ENABLED` on Vercel Preview scope** (2-min check: `vercel env ls` or dashboard). If Production-only → add it to Preview (it's baked at build time, so a redeploy is needed). Blocks the D-7 workflow, not the PROD hide. ✅ **ANSWERED (Reza, 2026-08-05, dashboard screenshot):** the variable is scoped **All Environments** (`true`, added Jan 19) — Preview is covered; nothing to add, no redeploy needed. D-7 Preview workflow unblocked.
- [x] **P0.5 Merge PR #1577** (Q-SCOPE-1) — its stated merge trigger (keep-list ruled) is now met. Doc flips 🟡 RECOMMENDATION → DECIDED with a pointer to §0 here. ✅ **DONE:** #1577 merged by Reza 2026-08-05; status line flipped to ✅ DECIDED (2026-08-04) → §0 here, in PR-B (the plan's prescribed one commit).
- [x] **P0.6 Registry re-count** — refresh issue counts vs the 63/135 quoted at the filter HEAD; record the delta here. ✅ 2026-08-04 at `e588a837` (from `docs/issues/ISSUES.json`): **65 OPEN/FIXING (🔵 38 + 🟠 27), 5 critical, 146 total** — vs 63 OPEN/FIXING, 6 critical, 135 total at `1e2317b6`. Delta: +2 OPEN/FIXING · −1 critical · +11 total (MON-149…153 among those raised since).
**Gate:** all boxes ticked. **Model: Fable 5** (mechanical, doc-heavy). **Reza:** P0.4 answer + merges.

### P1 — The module gate build *(product code; flips NOTHING — all keys ship `enabled:false` and PROD behaviour is unchanged until Reza flicks switches)* — ✅ ACCEPTED (P1.10 resolved 2026-08-06)
- [x] P1.1 `moduleRegistry.ts` + `moduleGate.ts` + alias (§3-4) ✅ 2026-08-04, PR-B — 13 keys; keyed Map cache 30s TTL fail-closed; `isBasiqEnabled`/`invalidateBasiqGateCache` preserved as thin delegations (ONE cached reader, §12.2.1; zero call-site churn).
- [x] P1.2 **API audit** (§2.3 rule) — final gate table recorded in §2.3 of this file, same PR ✅ 2026-08-04 — 14 GATE prefixes / 6 KEEP-OPEN / 1 N/A; both careful cases resolved (`tax`: reports import lib code, only the wizard's `/api/tax/super` is a kept HTTP caller → KEEP-OPEN; `master-snapshot`: kept callers FOUND — sidebar TrailStagePill + activity page → KEEP-OPEN).
- [x] P1.3 Nav filtering + `mobileMoreItems` fix ✅ 2026-08-04 — `moduleKey` on `NavItem`/`NavChild`/`MobileTabBarItem`; `filterNavByModules` (one filter rule) consumed by EditorialSidebar, EditorialBottomNav, MoreSheet, MobileTabBar, SectionTabsRow; `mobileMoreItems` non-null `.find()`s replaced with a Boolean-filtered builder.
- [x] P1.4 Layout guards + API guards + MODULE_HOME redirect ✅ 2026-08-04 — 20 new `layout.tsx` guards + the portal layout; 38 route files / 60+ handlers guarded with `moduleApiGuard` (503 `MODULE_DISABLED`); root `/dashboard` page split into a server wrapper (`redirect('/dashboard/properties')` when MODULE_HOME off) + `HomeClient.tsx` (moved verbatim). Exception recorded: `/api/conversations/retention-sweep` stays open (data-retention deletion continues while hidden).
- [x] P1.5 `/api/feature-flags/modules` + `useModuleEnabled` ✅ 2026-08-04 — public one-call flag map + `ModuleGateProvider`/`useModuleEnabled`/`useEnabledModules` (Basiq client pattern, starts hidden), mounted in DashboardLayout.
- [x] P1.6 Unconditional cache invalidation ✅ 2026-08-04 — the PATCH hook now calls `invalidateFlagCache(key)` for EVERY flag (was Basiq-hard-coded).
- [x] P1.7 Seed all keys `enabled:false` ✅ 2026-08-04 — all 13 §2.2 keys seeded from `MODULE_REGISTRY`; the never-overwrite-`enabled` update path preserved exactly.
- [x] P1.8 Admin Modules panel (§4.4) + dead-control removal (§4.5) ✅ 2026-08-04 — row per registry key (label · HIDDEN/LIVE · return stage · last-flipped time+actor from `updatedAt`/`updatedBy` · the working toggle); freeze-rule copy on the panel; dead Edit/Overrides buttons, "Create Override" card and Rollout/Tiers/Overrides display columns removed (UI only, schema untouched).
- [x] P1.9 Tests ✅ 2026-08-04 — 38 new tests in `tests/featureFlags/` (gate fail-closed/keyed-cache/invalidation/alias · nav-key inventory + filter + mobileMoreItems no-throw · guard 503/404 + MODULE_HOME redirect + registry invariants incl. "never gate a KEEP-OPEN prefix"). Full suite 313 files / 4,503 tests green (golden fixtures serve module flags enabled:true so Ring-2 route tests keep exercising the handlers as-live; gating covered by the new suite).
- [x] **P1.10 ACCEPTANCE — RESOLVED 2026-08-06 (Matrix HQ), restructured under the admin-is-PROD-only ruling.** Original criterion: self-diff `CLEAN` vs `.audit/golden-baseline-12954ff.json`, ship-state + flags-on-Preview. Preview admin is unusable by ruling (and its sign-in was failing), so per the handout's stated escape hatch the pre-merge verdict is the **STATIC-EQUIVALENT — ACCEPTED**: at PR head `7e6f0c2`, the PR touches ZERO producer paths (nothing under `lib/calculations|services|tax-engine|reports`, `scripts/matrix`); no engine path reads `GlobalFeatureFlag` (so the seeded rows cannot reach a producer input); the `.audit/financial-math-baseline.json` delta is pure line-number drift (same matches); `properties/page.tsx` gates only the Strategy tab (engine import untouched). **The empirical test is relocated, not waived:** Run A's deployed form = P2.2 (PROD self-diff vs reference), and the flags-on flip test = **P2.2b** on PROD. Any FAIL there ⇒ revert #1587 (pure scaffolding, all flags OFF) and the phase re-opens. Full verdict: PR #1587 comment, 2026-08-06.
**Gate:** P1.10 CLEAN recorded (verdict + treeHash in the PR body). **Model: Fable 5.** Touches no `lib/calculations/**` producer — if a diff says otherwise, that IS the defect.

### P2 — The flip *(PROD state change; Reza's hands on the switches)* — 🟡 gate PR open (P2.1 crumbs + MON-160 deploy remain)
- [x] P2.1 Verify PROD came up hidden after deploy (**keys default hidden — nothing to flip**): smoke-test each §2.2 route → 404/redirect, each gated API → 503, nav shows: Properties · Assets · Loans · Documents · Activity · Reports · Settings. ✅ **Core pass 2026-08-09 (Reza + Matrix, #1587 addendum comment):** `/dashboard` → `/dashboard/properties` redirect ✓ · sidebar = exact v1 set ✓ · `/dashboard/tax` 404 ✓ · `/cashflow` 404 ✓. **Remaining crumbs (not yet run):** the rest of the §2.2 route sweep transcript, gated-API 503 spot-checks, mobile tab bar glance — carried in the P2-gate PR.
- [x] P2.2 Post-deploy golden self-diff on PROD: `CLEAN` (same criterion as P1.10) — the relocated Run A of record (P1.10 resolution). ✅ **CLEAN 2026-08-09 (Matrix, #1587 comment):** fresh PROD capture treeHash `0d6753ef…` identical to `.audit/golden-baseline-12954ff.json`; 1,756 leaves; per-tree counts identical across all eight engines; `captureErrors: []`.
- [x] **P2.2b flip test on PROD (the relocated Run B; procedure per the 2026-08-06 P1.10 resolution): `CLEAN`.** ✅ 2026-08-09 (Matrix, same comment): flags-OFF capture parked → all 13 keys ON via the admin panel → 35s wait → server-side pair diff **changed 0 · added 0 · removed 0** → all keys restored OFF (verified twice). Flag-phase acceptance empirically closed (held doctrine #2).
- [x] P2.3 Reports page narrowed in-page to the property/tax-time pack ✅ 2026-08-19, P2-gate PR — tiles carry registry `moduleKey`s (financial-overview→HOME · income-expense→HOUSEHOLD · loan-debt→DEBT_PLANNER · investment→INVESTMENTS; property-portfolio + tax-time unkeyed = the kept pack) and filter via the SAME `filterNavByModules` the nav uses; the help section now renders from the same list (the hardcoded second list is gone, §12.2.1). TaxPackExportButton stays.
- [x] P2.4 D-6 safe default: new-capture ownership defaults to personal entity; picker hidden behind `MODULE_ENTITIES`; **zero writes to existing attribution** (§12.11 guard — destructive path is out of scope permanently per D-6) ✅ 2026-08-19, P2-gate PR — `OwnershipPicker` returns null when the module is off (all six call sites verified to initialise + reset `{mode:'sole'}` → the canonical writer resolves the auto-personal entity); `CorrectOwnershipDialog`'s write path is blocked with an in-dialog notice (a hidden picker there could otherwise have silently overwritten joint/shared attribution with `sole`).
- [x] P2.5 D-7 Preview copy executed per §7 runbook; copy date + hash recorded here ✅ **Executed 2026-08-11 (Matrix + Reza, ahead of this gate PR — #1587 comment):** full-instance copy per the 2026-08-09 ruling; 140 tables / 36 users / 58 properties verified; dev flags all ON; refresh log in §7.3.
- [x] P2.6 Positioning follow-up registered (site copy vs one-module app — Q-SCOPE-1 risk 2; queued row 66 in 02_UP_NEXT.md) — not built in this phase ✅ 2026-08-19 — row 66 refreshed: target story = the plan §1 v1 line (post-purchase property scoreboard), trigger re-anchored to "before public v1 traffic".
- [x] **MON-160 fix (defect found in live use, #1587 comment 2026-08-11):** module gates were baked at BUILD time — statically pre-rendered gated layouts froze the guard's verdict, so a flag flip could not unhide within 30s (every R-stage re-enable would silently need a redeploy). ✅ Fixed 2026-08-19, P2-gate PR: `moduleRouteGuard()` now awaits `connection()` BEFORE the flag read — the ONE place all ~20 gated layouts share (SSOT), so none can be statically rendered; locked by a test asserting the dynamic opt-out precedes the read. Registered as MON-160 (`changesNumbers: NO`). The `preview/dev-full-app` workaround branch is obsolete once this deploys.
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
| **R0 (precondition)** | — `FeatureFlagOverride` wiring: evaluation reader (user-scoped), override API route, admin UI — enable-for-Reza-only-in-PROD. **✅ BUILT 2026-08-19 (own PR, per BRIEF_SIMP_P2R_R0 §C):** `isModuleEnabledForUser` (global ∥ active override, keyed cache, fail-closed) · user-aware `moduleApiGuard(key, userId)` at every gated handler with an authenticated user · effective per-user `/api/feature-flags/modules` (optional Bearer) · admin overrides CRUD (audit-logged, cache-invalidating) + a WORKING Overrides affordance on the Modules panel (replacing the dead one §4.5 removed) · layouts route through `ModuleGateBoundary` (server 404 when fully hidden; during an override window the per-user verdict is client-enforced + API-enforced, because server layouts have no user identity — deviation from the brief's C-2 premise, verified in source and surfaced on the PR). **Acceptance run pending post-merge** (MODULE_TAX override for Reza on PROD; second account gets not-found) | Required BEFORE any R-stage Ring-3 (verification must run on live PROD data; Preview cannot satisfy Ring-3 by definition) |
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

Ruled by Reza 2026-08-04 with the counter-recommendation surfaced (brief §5.3); **widened to FULL-INSTANCE by Reza 2026-08-09** (supersedes the earlier selective-copy plan — no export/import scripts are built). Encoded as:
1. **Lawful basis today:** the whole PROD dataset is **attested non-real/pre-launch (Reza, 2026-08-09)** — all accounts are Reza plus friendlies/test accounts with non-real financial data; no CDR-sourced data exists (Basiq dark). Copying it to `monitrax-db-dev` breaches no external obligation today — only the internal §13.6 rule, which P0.3 amended (and the 2026-08-09 widening re-amends) rather than silently violates.
2. **Amendment text (P0.3, widened 2026-08-09 — mirrored verbatim in CLAUDE.md §13.6):** a one-way full-instance Cloud SQL export → import of the current PROD dataset into `monitrax-db-dev` is permitted for hidden-module development. **Hard trigger:** the day the first genuine customer account or any CDR/Basiq-sourced data exists in PROD, full-instance copying is prohibited — dev reverts to synthetic-only or Reza's-rows-only. The CDR sunset stands unchanged (CDR/Basiq data in PROD ⇒ exception SUNSETS permanently, dev synthetic-only, copy purged).
3. **Runbook (P2.5 — §7.3):**
   - Full-instance Cloud SQL export → import into `monitrax-db-dev`, over the GCP console (Matrix drives; Reza types all credentials). One direction only; never dev→PROD. Refresh on demand; **each refresh + flag re-apply logged in the table below.**
   - **Post-refresh step (MANDATORY):** the copy imports PROD's `GlobalFeatureFlag` rows (all OFF). After EVERY refresh, re-run `node scripts/dev/set-module-flags.mjs --all on` against dev, then verify via `GET /api/feature-flags/modules` on a Preview URL (allow the 30s cache). **Standing dev state: all 13 ON** (Preview shows the full app; PROD stays hidden). The script refuses PROD URLs by design (D-9).
   - **Until MON-160's fix deploys** (module gates were baked at build time — statically pre-rendered layouts), a dev flag flip also needs the standing branch `preview/dev-full-app` re-pushed so the Preview rebuilds with flags visible (see `docs/operations/PREVIEW_BRANCH.md` on that branch). Obsolete once the fix is live.
   - **Refresh log:** | Date | What | Evidence |
     |---|---|---|
     | 2026-08-11 | First full-instance copy executed (Matrix + Reza): 140 tables / 36 users / 58 properties verified; dev grants applied; dev flags → all 13 ON; Preview sign-in fixed by adding `https://*.vercel.app/*` to the Auth (Web) API key referrer allowlist (hardening follow-up: stable preview domain) | #1587 comment, 2026-08-11 |
4. **What the copy does NOT do:** it does not verify anything. Ring-3 runs on live PROD data only — hence R0. The copy is a development convenience, not a verification path.

## 8. Risks · deliberately not planned · coverage boundary

**Risks:** (1) Positioning gap — site says "operating system", app shows one module; rewrite queued (02_UP_NEXT.md row 66), candidate story in §1; not doing it by P2 is a marketing defect, not a product one. (2) Scope-freeze decay — mitigated by P0.2 + D-8 + this decision record; the pattern that produced 45 parallel workstreams is the enemy. (3) The kept surface is not yet correct (MON-001/143/146 live at HEAD) — P3 exists because of this; hiding did not fix it. (4) TaxTank/propkt attack "manual entry" — mitigated by P4 (statement agent) and the GTM's existing Basiq gate as fast-follow. (5) Connector size limits blocked the tracker-row updates this PR should carry — P0.1 is the named repair, texts in the PR body (precedent: Q-SCOPE-1's still-unwritten row).

**Deliberately not planned here:** MON-131 tranche mechanics (ledger owns them) · deletion of any module (overruled by directive) · Basiq/CDR build-out (GTM-gated) · Org Portal product decisions (separate bet) · marketing-site rewrite execution · mobile app.

**Coverage boundary:** this plan verifies the gating capability, the route/nav/API inventory mapping, and the decision record — at `e90a9195`. It does NOT verify: that any kept-surface number is currently correct (P3's job); the API audit (P1.2's job — §2.3 is a starter map); Vercel env scoping (P0.4); Propsight's integration surface (UNVERIFIED); current registry counts (P0.6). Market figures in §1 carry the session's research sourcing, incl. two UNVERIFIED revenue estimates flagged inline.

## 9. Session log (append one line per session that advances this plan)

- 2026-08-04 · Cowork (Fable 5) · Plan created; §0 rulings taken; HEAD `e90a9195`.
- 2026-08-04 · Code (Fable 5) · PR-A: P0.1/P0.2/P0.3/P0.6 landed (P0.4/P0.5 flagged Reza-side); #1577 noted still-open. HEAD `e588a837`.
- 2026-08-04 · Code (Fable 5) · PR-B: P1.1–P1.9 built (registry · gate · nav filter · 20 layout guards + 38 guarded API routes · modules endpoint + client context · unconditional invalidation · seed · admin Modules panel · 38 tests); §2.3 final audit table recorded; P1.10 handed back to Matrix. Neomatrix: 1 anchor re-pinned + 6 nodes re-verified + Layer-0 allowlist/manifest per local-CLI precedent. HEAD `e588a837`.
- 2026-08-06 · Matrix HQ (Cowork) · P1.10 verdict: STATIC-EQUIVALENT ACCEPTED at PR head `7e6f0c2`; admin-is-PROD-only ruling recorded (Reza); empirical Run A→P2.2, Run B→P2.2b (PROD flip test). Preview admin sign-in failure noted, no longer load-bearing.
- 2026-08-19 · Code (Fable 5) · P2R/R0 brief executed: P2.3 reports narrowing (registry-keyed, second list deleted) · P2.4 D-6 default (picker null when off; correction dialog write path blocked) · P2.6 row-66 refresh · MON-160 fix (`connection()` in `moduleRouteGuard`, one place + test) · `scripts/dev/set-module-flags.mjs` (PROD-refusing, registry-parsed, dry-run proofs in the PR) · §13.6/§7 full-instance amendment + hard trigger · §7.3 post-refresh rule + 2026-08-11 refresh log · P2.1/2.2/2.2b/2.5 ticked citing the #1587 verdict comments. R0 override wiring in its own PR (layout-guard user-gap deviation surfaced there). HEAD `3e43eb6`.
