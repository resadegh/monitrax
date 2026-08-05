# PLANNING BRIEF — Monitrax PROD simplification

**For:** a fresh Cowork session (Fable 5) · **Kind:** PLAN + RECOMMEND. **Do not build.**
**Prepared by:** Matrix HQ (Cowork, Opus 5), 2026-08-04 · **Pinned HEAD:** `12954ff` (merge of #1581)
**Commissioned by Reza, 2026-08-04:** *"let's go with the simplification of Monitrax in PROD as discussed… give me a complete brief that I can get a new cowork Fable 5 to plan for this simplification."*

---

## 1. What you are planning

Monitrax has ~73 dashboard routes live in PROD. Reza wants a **deliberately smaller PROD surface** so the app is simpler to use, faster to adapt, and — critically — **so its numbers can actually be validated against real data**. Modules that come out of PROD are not cancelled; they come back as staged updates once verified.

**Your job is the PLAN, not the build.** Produce a phased, decision-ready implementation plan plus recommendations on the open decisions in §5. A build PR from you is out of scope and would be rejected.

## 2. Boot first (do not skip)

The project instructions and `CLAUDE.md` load automatically — follow them. Beyond the standard ritual:

1. Clone/pull `resadegh/monitrax`; pin HEAD; list open + recently-merged PRs.
2. Read, in order — **these two carry most of what you need, so read them before exploring code**:
   - `docs/strategy/PRODUCT_SCOPE_V1_RECOMMENDATION.md` — the four-lens analysis behind this (Q-SCOPE-1, open on **PR #1577**, deliberately unmerged).
   - `docs/strategy/MON-131_SCOPE_FILTER.md` — the read-only filter that sizes what surviving scope costs.
3. Then `STATE.md` → `docs/implementation/MON-131_COMPLETION_BRIEF.md` + `MON-131_TRANCHE_LEDGER.md` (**the ledger wins** on any disagreement).
4. Post a ≤5-line orientation and open a session ledger.

**Do not re-derive the analysis in §4.** It is sourced and current. Re-verify anything you intend to lean on, but don't repeat the sweep.

## 3. Decisions ALREADY TAKEN — do not re-litigate

| Decision | Status |
|---|---|
| Ship a **smaller PROD surface**; hidden modules return as staged updates | Reza, 2026-08-03/04 |
| Hidden modules stay **buildable in Preview**, not cancelled | Reza, 2026-08-03 |
| **Sequence changed 2026-08-04:** simplification now runs **BEFORE** MON-131 T3 (earlier plan was MON-131-complete-first) | Reza, 2026-08-04 |
| Lever 2 **taken** — strip the Money-Flow Sankey *widget* from `/dashboard/activity`, keep its *intake* path; T2-B parked | Reza, 2026-08-03 (ledger §6, #1579) |
| T2's kept half done; **T2 G7 stays HALF permanently** (MON-157) | ledger, VR-047/VR-047B |
| Golden-baseline whole-tree reference captured + hash-verified at `12954ff` (VR-048) | this session |
| PR #1577 stays **open** as the parked plan; merge trigger = when Reza rules the keep list | Reza, 2026-08-03 |

**The sequence change is safe, and here is why — use it, don't re-check it from scratch.** The earlier objection to hiding mid-programme was that MON-131's G7/G8/G9 gates are calibrated on baselines that would need re-capturing. That objection is now spent: the VR-048 reference is captured from **eight `lib/` engine functions**, not from UI surfaces. Flag-gating nav and routes does not change what those functions return for a given user, so **the reference survives the simplification**. T3 has not started. This is a clean seam.

**Make that an acceptance criterion:** after the flags land, re-run the golden-baseline self-diff and require **`CLEAN`**. If any numeric leaf moves, the simplification changed a producer — that is a defect, not an expected consequence, and it stops the phase.

## 4. The evidence base (sourced; carry it, don't re-derive)

**Surface, at HEAD:** 147 `page.tsx` · **73 dashboard routes** · **363 API routes** in 68 groups · `components/` 351 files / 90,152 LOC · `lib/tax-engine/` 51 files / 19,130 LOC · 11 sidebar sections + Settings (`lib/navigation/trailNav.tsx:53-202`) · 3 front-ends (consumer, Org Portal 19 pages, Admin 31 pages) · ~100 un-pruned `PHASE_*.md`.

**Why the numbers can't be validated:** MON-131's census records **~336 producers across 23 canonical quantities, 22 of 23 MULTIPLE**. The registry held **135 issues / 63 OPEN+FIXING / 6 critical** at the filter's run (higher since — VR-047 raised MON-149/150/151/152/153; re-count, don't quote 63 as current). T1's income convergence moved monthly income **$41,303 → $25,347** and flipped tax owing **$26,657 → a $5,218 refund**.

**Manual burden:** no live bank feed. Basiq is fully built but dark behind `GlobalFeatureFlag` key `BASIQ_INTEGRATION`, failing closed (`lib/featureFlags/basiqGate.ts:53-72`), gated on revenue (`docs/marketing/GTM_EXECUTION_PLAN.md:34-38`). One investment property needs **≈30 required fields** before a single expense or depreciation line (7 Property + 9 Loan + 5 Income + 5/expense row + 6/depreciation line + entity). Onboarding is **12 steps**; only **one** field blocks Continue.

**What hiding does and doesn't buy (`MON-131_SCOPE_FILTER.md`):** **zero** of 40 census quantities are exclusive to property; **10 are SPLIT** (kept *and* hidden consumers, so they must still converge). Under a property-only keep list **29 of 63** issues still reach a kept surface; under Reza's wider list (§5.1) roughly **47 of 63** do. The proof case: `expenseRunRate` (T3) renders on **no** kept surface, yet **MON-129** — its 23-producer class sweep — **is** in the kept queue, because two producers feed the surviving tax-time pack and the Activity Sankey. **Hiding is an exposure control and a verification-cost control. It is not a defect control. Scope remaining work by producer, not by tranche.**

**Gating infrastructure that already exists:** `GlobalFeatureFlag` (`prisma/schema.prisma:5988-6009`) with an admin CRUD API, audit logging, and a working on/off toggle; a seed that creates rows `enabled:false` and **never overwrites `enabled`** (`prisma/seed-feature-flags.ts:47-58`); and **Basiq as a complete five-layer reference implementation** — cached fail-closed server reader · public JSON endpoint · client context starting disabled · API route guard (503) · one nav filter (`app/dashboard/settings/layout.tsx:183-189`).

**Gaps you must design around:**
- No generic reader — everything is hard-coded to `BASIQ_INTEGRATION`, including the cache variable, endpoint path, and the PATCH invalidation hook (`app/api/admin/feature-flags/[key]/route.ts:167-169`).
- **Consumer nav is not flag-aware at all** — `NavItem` (`trailNav.tsx:35-44`) has no flag field; `EditorialSidebar.tsx:82` maps unfiltered; `mobileMoreItems` (`:382-385`) uses a non-null-asserted `.find()` that throws if an item disappears.
- No route-level enforcement. **`middleware.ts` cannot do it** — Edge runtime, cannot import Prisma/Cloud SQL Connector (CLAUDE.md §13.6). Enforce in layouts + API guards.
- **`FeatureFlagOverride`, `enabledForPercent`, `enabledForTiers`, `enabledForPlans` have ZERO evaluation readers anywhere.** The admin Edit / Overrides / "Create Override" controls have **no `onClick`** and no override API route exists. Per-tier and per-user rollout **do not work today**.

**Per-environment flags are nearly free.** The reader is pure DB with no env-awareness; Preview builds against `monitrax-db-dev` and Production against `monitrax-db-prod` (CLAUDE.md §12.12/§13.6). **One flag row already holds a different value per environment by construction.** No schema change.

## 5. The OPEN decisions — resolve these with Reza before proposing a plan

Each carries the prior session's recommendation. **Present them; do not assume them.**

### 5.1 The keep list
Reza's stated v1 (2026-08-03): **hide** My Structure (entities) · Debt Freedom · budgeting · My Safety Net. **Focus** properties, assets, investments, and **user cashflow**.

**Prior recommendation:** keep the story — *"what you own and what it's actually doing"* — but **drop *household* cashflow from v1 and keep *per-property* cashflow.** Household cashflow is the single surface re-admitting T1, T3, T5 and T6, and it is the module most damaged by having no bank feed. That one change roughly halves the verification burden while leaving properties + assets + investments intact.

**Three surfaces Reza's list did not name — get an explicit ruling on each:**
- **Tax** (`/dashboard/tax`) — 19k LOC, the densest AFSL exposure. *Rec: hide for v1.*
- **My Guide / CFO / What-If** — 6 of the 18 re-admitted issues are CFO alone; highest AFSL risk (`.stitch/SITE.md:34` — never "AI advisor"). *Rec: hide for v1.*
- **Home, Reports, Housekeeping** — Home aggregates hidden modules, so it needs a rebuild or a hide either way.

### 5.2 "All asset relationships personal, not entity"
Two readings, very different:
- **Safe (recommended):** default *new* capture to personal, hide the ownership picker, **leave existing attribution untouched**. `Property.ownerEntityId` is non-nullable but the auto-created `PERSONAL_NAME` entity already covers it.
- **Destructive:** re-attribute existing assets. That is a **§12.11 destructive write on live data**, and it makes Reza's own portfolio unrepresentable (it genuinely includes trusts and an SMSF) — which defeats the stated goal of testing numbers against real data. Also makes the tax position wrong for entity-held assets.

### 5.3 "Remaining sections continue in Preview with data copied from PROD"
**Recommend against the copy.** `CLAUDE.md §13.6`: *"Dev/staging MUST use synthetic/mock data. NEVER seed with real CDR data."* Not strictly a CDR breach today (Basiq is off, so the data isn't CDR-sourced) but it violates the standing rule and **becomes** a breach the day Basiq lands.

**Better, and it meets the goal more directly:** wire `FeatureFlagOverride` and enable hidden modules **for Reza's account only, in PROD**. Real data, live surface, no copying, no drift — and it is the only option that satisfies Ring 3's own requirement that verification runs on live data. **Preview cannot satisfy Ring 3 by definition.** This is the piece that makes the whole hide-in-PROD/build-in-Preview workflow legitimate; treat it as in-scope for your plan.

### 5.4 WIP limit
Hidden-but-still-being-worked-on is how 45 active workstreams happened. **Rec: at most ONE hidden module in active development at a time.** The freeze rule becomes *"hidden ⇒ no work unless it is THE one active module"* and lands in `STATE.md`.

### 5.5 One operational unknown
**Is `NEXT_PUBLIC_ADMIN_PORTAL_ENABLED` (`lib/admin/featureFlags.ts:111`) set on Vercel's Preview scope?** If Production-only, the admin portal is unreachable on a preview URL and the dev-DB flag cannot be flipped there. Not verifiable from the repo — ask Reza.

## 6. Hard constraints

- **Plan only.** No build PR. Any doc you produce lands in the repo via PR (§21.2.2 rule 4) — never chat-only.
- **Never fix a number** (§23.2.1). Nothing in this work may change a producer. If a number moves, that is a defect.
- **SSOT** (§12.2.1) — hiding must not create a second producer or a parallel nav source.
- **No `docs/architecture/contracts/`, `docs/verification/**` or `scripts/matrix/` paths** unless you also add a MON-131 ledger §6 row — `scripts/check-mon131-ledger.mjs` runs `--strict` and will fail the build. `docs/strategy/` is clear.
- **§20.6 tri-axis 10/10** recorded on any PR; **§20.7** — your recommendations get the same 3× gate.
- **Server-side enforcement, not nav-only.** A hidden-but-reachable route showing a wrong number is a trust and compliance hazard.
- **Fail closed.** Every new flag seeds `enabled:false`, so shipping is safe by default.

## 7. What to produce

One document, `docs/strategy/PROD_SIMPLIFICATION_PLAN.md`, via a draft PR:

1. **The keep/hide/stage list**, route by route, with the §5.1 rulings applied.
2. **The module registry design** — flag key → `{navHrefs, routePrefixes, apiPrefixes}` — and which existing routes map to which key.
3. **The gate build shape**: generalise `basiqGate.ts` → `moduleGate.ts` (keyed cache, same fail-closed semantics, keep `isBasiqEnabled` as an alias so the 10 existing call sites don't churn) · `moduleKey?` on `NavItem` + filter in `EditorialSidebar` (+ the `mobileMoreItems` fix) · `/api/feature-flags/modules` + `useModuleEnabled` · `moduleRouteGuard(key)` + layout-level `notFound()` · unconditional cache invalidation · seed all keys. **Plus the `FeatureFlagOverride` wiring** (§5.3). State explicitly that no schema change is required.
4. **Phasing** with a gate per phase, and **the CLEAN self-diff as the acceptance criterion** for the flag phase (§3).
5. **What the dead override UI becomes** — wired or removed. It must not stay misleading.
6. **Risks + what you deliberately did not plan**, and the honest coverage boundary.
7. **A recommended build sequence** with a model recommendation per phase (Fable 5 vs Opus) per the standing brief-routing rule.

## 8. What NOT to do

- Do not build, migrate, or flip anything.
- Do not re-run the scope filter or the surface inventory — they are in §4 and in the two docs.
- Do not merge PR #1577 — its trigger is the keep-list ruling.
- Do not touch MON-131 tranche work, the ledger, or T3.
- Do not assume hiding reduces the defect count. It does not (§4).
- Do not propose the Preview data copy without surfacing §5.3.

## 9. How we'll know the plan is good

Reza can read it and give one-word rulings on §5. Every route has a home. The gate design needs no schema change. The flag phase has a falsifiable acceptance test (`CLEAN` self-diff). The freeze rule is written where a future session cannot re-litigate it. And the plan says plainly what it does **not** cover.

**Coverage boundary of this brief:** it carries a sourced surface inventory, the gating-capability assessment, and the scope-filter results at HEAD `12954ff`. It does **not** establish that any kept-surface number is currently correct (MON-001, MON-143, MON-151 say otherwise), does not resolve the §5 decisions, and asserts nothing about Vercel env-var scoping (§5.5).
