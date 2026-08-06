# Product Scope v1 — RECOMMENDATION (decision pending Reza)

**Status:** ✅ DECIDED (2026-08-04) — Reza ruled all eight decisions + three standing directives; the decision record and keep/hide tables of force are `docs/strategy/PROD_SIMPLIFICATION_PLAN.md` §0/§2 (that plan supersedes this document's recommendation where they differ). This document remains as the analysis of record behind the ruling.
**Raised:** 2026-08-03 · **By:** Cowork (Matrix HQ) session · **Pinned HEAD:** `1e2317b68ba461edb55f47b3d83f4e0df9d23d66` (merge of #1575, 2026-08-03)
**Trigger:** external review by a practising accountant (7 points, relayed by Reza 2026-08-03).
**Gate (§20.7):** 3× self-review against the four lenses (§0.1) + §19.2 source-tracing. Every load-bearing claim below carries a this-session source (`file:line`, registry count, or ledger row). Where a claim could not be sourced it is marked UNVERIFIED and excluded from the recommendation.

---

## 0. The one-paragraph verdict

The accountant is right on all four of his diagnostic points, and the repo agrees with him in writing. He is describing from the outside what `MON-131` describes from the inside: **~336 producers across 23 canonical financial quantities, 22 of the 23 with MULTIPLE producers** (`docs/implementation/01_ACTIVE_WORKSTREAMS.md:11-17`). His prescription — one module, made genuinely great, then widen — is the correct prescription, with one amendment: **narrowing the UI does not by itself fix the number problem.** It reduces how many producers MON-131 has to converge before v1 can be trusted, which is the difference between a quarters-long programme and a weeks-long one. Do both, in that order: freeze the scope, then finish MON-131 *on the frozen scope*.

---

## 1. His feedback, point by point — honest verdict with sources

### 1.1 "The app is too wide and confusing — trying to solve too many issues"
**Verdict: AGREE. Measurable, not subjective.**

| Measure | Value at HEAD |
|---|---|
| User-facing pages (`app/**/page.tsx`) | **147** |
| Dashboard routes (`app/dashboard/**` + `app/(dashboard)/**`) | **73** |
| API routes (`app/api/**/route.ts`) | **363**, in 68 top-level groups |
| Consumer sidebar sections | **11** + Settings (`lib/navigation/trailNav.tsx:53-202`) |
| Separate front-ends | 3 — consumer, Org Portal (19 pages), Admin (31 pages) |
| `components/` | 351 files · 90,152 LOC |
| `lib/tax-engine/` | 51 files · 19,130 LOC |
| Onboarding steps (MIXED profile) | **12** (`components/onboarding/wizard/types.ts:39-147`) |
| `docs/blueprint/PHASE_*.md` | ~100, un-pruned |
| Active workstreams | 45 `###` entries in `01_ACTIVE_WORKSTREAMS.md` |

**Four-lens read.**
- **Architect:** breadth is the *cause* of the number problem, not a parallel problem. 336 producers exist because 73 surfaces each needed a figure and, before the Calc-SSOT Wall, nothing forced reuse. Every new surface added producers faster than the SSOT law removed them.
- **Behaviour psychologist:** 12 steps before the first meaningful number, on a product whose promise is *reduced* cognitive load. `docs/blueprint/TRAIL_FRAMEWORK.md:52-57` cites Mani et al. (financial stress ≈ 13 IQ points) — and then asks a stressed user for ~30 fields.
- **Designer:** TRAIL is a strong narrative, but the 5-stage IA *obliges* content in every stage. The framework became a build backlog: every stage had to be populated, so every stage was.
- **Financial adviser:** breadth actively erodes the only thing a financial tool must have — being right. A user who finds one wrong number stops trusting the other seventy-two screens.

**Where I push back on him (mildly):** "too wide" would be a fatal critique if the modules were unrelated. They are not — property, loans, tax and cashflow are genuinely one problem for a wealth-builder. The defect is not the *ambition*; it is shipping all of it simultaneously, unverified, to a market of zero. Sequence, don't amputate.

### 1.2 "Very complicated for the user — lots of manual intervention"
**Verdict: AGREE, and this is the bigger of the two problems.**

Root cause is structural, not cosmetic: **there is no live bank feed.** Basiq is fully built (`lib/basiq.ts`, 5 routes) but dark behind `GlobalFeatureFlag` key `BASIQ_INTEGRATION`, seeded `enabled=false` and failing closed (`lib/featureFlags/basiqGate.ts:53-72`). It is deliberately gated on revenue: *"$10k upfront + $2k/mo minimum… Do not start Basiq onboarding until ≥ AU$3–5k committed MRR"* → *"Until then, Monitrax operates on manual data entry / CSV import"* (`docs/marketing/GTM_EXECUTION_PLAN.md:34-38`).

Consequence, measured for one investment property to reach a *correct* cashflow + tax position:
- **7** required Property fields (`prisma/schema.prisma:1568-1580`)
- **9** required Loan fields (`:1660-1684`)
- **5** required rental Income fields (`:1912-1935`)
- **5** required fields **per** expense row (`:2044-2072`) — and `isTaxDeductible` **defaults to `false`**
- **6** required fields **per** depreciation line (`:2500-2509`) — captured on a *separate* post-onboarding page, absent from the wizard entirely
- plus entity/ownership (auto-created, but non-nullable)
- ≈ **30 fields before a single expense or depreciation line**, then 5 and 6 per line thereafter.
- Then every transaction must be hand-classified and hand-linked: the Activity page ships an explicit *"'Uncategorised first' default — pushes users into the categorisation loop"* (`app/dashboard/activity/page.tsx:26-31`), and a transaction reaches a property surface **only** via the manual reconcile→link step (`app/api/transactions/[id]/link/route.ts:230-232,466-467`).

The repo already concedes this in Reza's own words: *"a lot of mixed and incorrect messaging… we need to simplify this section as it is very confusing for the user, **even myself**"* (`docs/blueprint/PHASE_55_ACTIVITY_RECONCILIATION_SIMPLIFICATION.md:1-3`).

**The argument he did not make, and should have — and it strengthens his case.** Manual entry is fatal for *everyday spending* (daily, high-volume, needs a feed) and survivable for *property* (a bounded fact-set the owner already holds in a folder, refreshed ~quarterly: rent, loan, agent statement, rates notice, QS schedule). **Property is the one domain where "no bank feed yet" is not a blocker.** That is the strongest single argument for his scoping recommendation.

### 1.3 "Very hard to validate all numbers — the app is too complex"
**Verdict: AGREE. This is proven, not opinion — do not defend it.**

- Registry at HEAD: **135 issues** — OPEN 34 · DIAGNOSED 4 · FIXING 29 · VERIFIED 8 · CLOSED 59 · RETRACTED 1. **63 are OPEN or FIXING**, of which **6 are critical** and 24 high. **82 of 135 are `changesNumbers: true`.**
- `MON-131` census: **~336 producers across 23 quantities, 22 of 23 MULTIPLE** (`01_ACTIVE_WORKSTREAMS.md:17`). Reza's own recorded rationale: *"fixing one place has only ever changed which screens disagree."*
- The T1 (income) convergence result is the proof of scale: seven producers → one; monthly income **$41,303 → $25,347**; tax owing **$26,657 → a $5,218 refund** (`docs/implementation/MON-131_TRANCHE_LEDGER.md §6`, PR #1545 `f1c87afb`, VR-045 PASS). A single quantity's convergence flipped the household from owing to refund. That is not a rounding class of error.
- T2 (loan cost) live defect: Home reads **$8,817/mo**, `/dashboard/expenses` reads **$12,779** — same five loans, same day, because interest-only loans contribute `$0` under a raw `minRepayment` read. Δ **+$47,551.71/year**. Migration merged #1575; **Ring-3 still pending.**
- Live property-domain errors still open: `MON-001` (fortnightly rent stored/treated as MONTHLY — rent ~54% off, FIXING/critical) · `MON-143` (interest floor does not net the offset — Guildford $1,964.67 vs $384.45, **5.1×**) · `MON-146` (`/dashboard/expenses` renders every loan rate **100× too small**).

He is not being harsh. He is reading the same instrument panel the registry reads.

### 1.4 "Work on 1 module, make it great, go to market, then enable more"
**Verdict: AGREE — with one amendment that materially changes the plan.**

Hiding modules does **not** reduce producer count. Hidden code still compiles, still ships, still appears in the MON-131 census, still carries security and maintenance surface. If the scope-down is only a UI decision, you have hidden 60 routes and still owe 336 producer convergences before any number is trustworthy.

**So the amendment: the scope freeze must define the MON-131 denominator.** "Great" for v1 = MON-131's own five-condition definition of done (`MON-131_COMPLETION_BRIEF.md §1`) applied to the *kept* surface only: one producer per quantity, every kept surface reads it, declared `expectedMoves` land exactly, Ring-3 passes on Reza's live data, sweep complete. On the property surface that is a countable programme (see §3), not an open-ended one.

**The prize, stated plainly:** the open/fixing backlog for the kept surface is roughly **20–25 issues**, not 63. Everything else moves to a HELD bucket, untouched.

### 1.5 "Property section + document management + property cashflow, and connect to Propsight"
**Verdict: AGREE on the module choice. AGREE on Propsight as a direction, with sequencing conditions.**

**Why property is the correct first module — four separate reasons, all sourced:**
1. **It is genuinely separable.** Property pages do **not** read the household, tax, or master-snapshot layers. `app/api/properties/**` imports only db, guards, grdcs, ownership, audit, propertyActuals, and one *date constant* from the tax engine (`REFORM_CUT_OVER_UTC`, `route.ts:24`). Nothing calls `masterFinancialService` or the tax orchestrator. Direction is one-way: master consumes the property engine, never the reverse.
2. **The engine is already the SSOT.** `computePropertyCashflow` (`lib/calculations/propertyCashflow.ts`) is read by the property pages *and* by `masterFinancialService.ts:37,1177`, `loanCosts.ts`, `income/banked/*`, `cfo/riskRadar.ts`, `portfolio/snapshot`. Converging property numbers therefore *raises* the rest of the app when it returns.
3. **Document management is real, not a demo.** GCS storage with keyless WIF fallback to Postgres `bytea` (`lib/documents/storage/factory.ts:17-25`), Google Cloud Vision OCR (`visionService.ts:16-25`), `DocumentLink` join with `LinkedEntityType.PROPERTY` (`schema.prisma:4236-4247,4463-4478`), property-foldered paths (`PathRules.ts:71,118`), and **implemented cascade linking** expense→property / loan→property / income→property (`LinkingRules.ts:39-127`). Receipt scan → confirm already writes an Expense *with* `propertyId` and links the doc (`documents/analyze/confirm/route.ts:582-599`). This is a strong asset shipping in a weak frame.
4. **Manual entry is survivable here** (§1.2).

**Propsight — the strategic read.** Propsight is **pre-purchase deal analysis**: *"analyse any Australian investment property in minutes — cashflow, ROI, tax impact & break-even,"* CPA-built models, free report ([propsight.com.au](https://www.propsight.com.au/)). Monitrax Property is **post-purchase ownership**: what the asset is *actually* doing and what it does to the return. **Non-overlapping, and sequentially adjacent** — Propsight ends where Monitrax begins. That is a real wedge and a distribution channel: his users are your users one step later.

**The genuinely differentiated feature this unlocks** — and I would build it whether or not the integration happens: **the variance loop.** Import the purchase-time assumptions (yield, rent, rate, expenses), then show *modelled vs actual* per property per year, with the reason for the gap named. Nobody in the AU market does this well. It converts Monitrax from "another portfolio tracker" into "the scoreboard for the decision you already made."

**Sequencing conditions — non-negotiable, in this order:**
1. **Numbers first.** An integration that pipes a wrong number into a partner's product is worse than no integration, and the reputational blast radius is theirs as well as yours. Ring-3 the property surface *before* the first byte crosses.
2. **Import before API.** No public Propsight API is evidenced (UNVERIFIED — the marketing pages do not mention one). Start with a file/JSON import of a Propsight analysis into a Monitrax property. That proves the loop in days and needs no engineering commitment from them.
3. **Boundary in writing.** Feeding figures into an accountant's workflow keeps you inside "financial information service." The moment output is *relied on* for lodgment or reads as tax advice, you are adjacent to tax-agent territory — `docs/legal/afsl-credit-tax-boundary-disclosure.md` (v1.0, 24 May 2026) says plainly *"Monitrax is software. It is not a licensed… tax agent, accountant"* and *"It is not intended to tell you what you should do."* Any partnership term sheet must restate that boundary, and `docs/marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md` is still 🟡 DRAFT awaiting AU fintech-lawyer review. **This raises the bar on number correctness; it does not lower it.**

### 1.6 "A toggle through the admin portal to hide/unhide modules in PROD"
**Verdict: AGREE — build it. But be precise about what it is, and take three warnings.**

**What already exists** (`GlobalFeatureFlag`, `schema.prisma:5988-6009`): the table, an admin CRUD API with audit logging, a working on/off toggle in `app/admin/feature-flags/page.tsx`, a seed that preserves the operator's value, and — critically — **one complete reference implementation of exactly this pattern**: Basiq's five-layer gate (server reader with 30s cache failing closed · public JSON endpoint · client context/hook that starts disabled · API route guard returning 503 · one nav filter at `app/dashboard/settings/layout.tsx:183-189`).

**What is missing:** a generic reader (everything is hard-coded to `BASIQ_INTEGRATION`, including the cache variable, endpoint path and the PATCH invalidation hook at `[key]/route.ts:167-169`); a module→nav/route/API registry; **consumer nav flag-awareness at all** (`NavItem` in `trailNav.tsx:35-44` has no flag field; `EditorialSidebar.tsx:82` maps unfiltered); and route-level enforcement.

**No schema change required.** Four pieces (§3, Phase 1).

**Warning 1 — a toggle is a display decision, not a scope decision.** Hidden modules keep costing you: build time, producer count, security surface, session attention. Pair the toggle with a **written freeze**: hidden modules get no work, no fixes, no new issues; their registry entries move to a HELD bucket (the mechanism already exists — `MON-131_COMPLETION_BRIEF.md §4` holds 36). Without the freeze in `STATE.md`/`CLAUDE.md`, every future session will re-litigate it.

**Warning 2 — do not only hide the nav.** A hidden-but-reachable route is a trust and compliance hazard: a beta user follows a shared URL into a half-finished tax page showing a wrong number. Enforce **server-side in the page/layout** (`isModuleEnabled()` → `notFound()`) **and** in the API guard. `middleware.ts` cannot do it — it is Edge runtime and cannot import Prisma/Cloud SQL Connector (CLAUDE.md §13.6).

**Warning 3 — dead schema will bite you.** `enabledForPercent`, `enabledForTiers`, `enabledForPlans` and the **entire `FeatureFlagOverride` table have zero evaluation readers anywhere in the codebase** — they are written and displayed but never read. The admin UI's Edit / Overrides / "Create Override" controls have **no `onClick` handler** and there is no override API route. If you toggle in prod believing per-tier or per-user rollout works, it does not. Remove or clearly label them in the same PR.

**Fourth consideration — coherence.** The keep list must be internally consistent. Hiding `/dashboard/expenses` is safe because property expenses are editable in-context via `PropertyExpensesCard` → the canonical `ExpenseDialog` → `/api/expenses`. Hiding Home/Reports/Cashflow is safe because they *aggregate* hidden modules. An arbitrary keep list would strand a required action behind a hidden door.

### 1.7 "If we keep only the property-related sections — what to keep, what to enable later?"
Answered in full in §2.

---

## 2. Monitrax Property v1 — the keep / hide / stage list

### 2.1 KEEP — ships in v1

| Area | Routes / surfaces | Why |
|---|---|---|
| **Properties** | `/dashboard/properties`, `/dashboard/properties/[id]`, `/[id]/depreciation` | The module. |
| **Property cashflow engine** | `lib/calculations/propertyCashflow.ts` + `propertyActuals` + `actualsMonthlyAverage` | Already the SSOT; the convergence target. |
| **Loans — as a property attribute** | loan record + edit reachable from the property; `/api/loans` | Required for LVR, equity, interest, cashflow. **Drop** Debt Freedom + per-loan AI strategy. |
| **Income / Expense — property-scoped only** | rent rows + property expense rows, edited in-context (`PropertyExpensesCard` → `ExpenseDialog`) | Required rows; the standalone list pages are not. |
| **Documents / Vault** | `/dashboard/documents` + `DocumentsSection` on the property + receipt scan | His point 5; genuinely working; the accountant-facing asset. |
| **Intake — the paths that feed property** | CSV/QIF import, manual add, cash quick-add, receipt OCR, reconcile→link, managed-rental reconciliation | Without reconcile→link no transaction ever reaches a property number. |
| **Entities — headless** | auto-created `PERSONAL_NAME` entity + `OwnershipPicker` | `Property.ownerEntityId` is non-nullable (`schema.prisma:1571`). Table required; **UI is not**. |
| **Reports — ONE** | property portfolio / tax-time pack | The artefact an accountant would actually use. Kill the other five for now. |
| **Auth · Settings (profile/security/privacy/legal/appearance) · Admin** | — | Table stakes / staff-only. |
| **Onboarding — REBUILT to 3 steps** | property → loan → rent+agent | See Phase 3. |

### 2.2 HIDE NOW — staged re-enable

| Stage | Modules | Re-enable trigger |
|---|---|---|
| **Stage 2** | **Tax — property slice only** (rental income, deductions, depreciation, CGT) | Property surface Ring-3 PASS **and** first paying users. Full household tax stays hidden — 19k LOC, 14 open tax issues, and the densest AFSL exposure. |
| **Stage 3** | Cashflow · My Plan · Budget · Safety Net · Household profile | **Basiq live.** These are dishonest without a feed (§1.2). |
| **Stage 4** | My Guide / CFO / What-If / Ask | Numbers verified across the widened surface. Highest AFSL risk (`.stitch/SITE.md:34` — never "AI advisor"); it must sit on numbers that are already right. |
| **Stage 5** | Investments · Super/SMSF · Assets · entity structures & trust deeds · Strategy · Conversations/Requests · Marketplace · Labs · Org Portal (B2B) | Commercial decision, not a technical one. Org Portal is a *separate* product bet — treat it as such. |

### 2.3 Delete-vs-hide
Hiding is cheap; carrying is not (351 components / 90k LOC, ~100 phase docs, 45 workstreams). **Recommendation: hide now, review for deletion after 90 days of demonstrated non-need**, starting with Labs, Marketplace and Conversations/Requests. Deletion is Reza's call and is out of scope for this document.

---

## 3. The plan forward

| Phase | Work | Gate / output |
|---|---|---|
| **0 — Decide & freeze** | Reza rules on §2. This doc flips to DECIDED; the keep/hide list + the freeze rule ("hidden ⇒ no work, no fixes; issues → HELD") land in `STATE.md` and `01_ACTIVE_WORKSTREAMS.md`. | A written scope contract a future session cannot re-litigate. |
| **1 — The module gate** | Generalise the Basiq pattern: `moduleGate.ts` (`isModuleEnabled(key)`, keyed cache, fail-closed) · a module registry (`{navHrefs, routePrefixes, apiPrefixes}`) · `moduleKey?` on `NavItem` + filter in `EditorialSidebar` (+ fix `mobileMoreItems`' non-null `.find()`) · `/api/feature-flags/modules` + `useModuleEnabled` · `moduleRouteGuard(key)` + layout-level `notFound()` · unconditional cache invalidation in `[key]/route.ts:167` · seed all module keys `enabled:false` · remove/label the dead override UI. **No schema change.** | Admin can hide a whole module — nav **and** routes **and** APIs — in prod, safe by default. |
| **2 — MON-131, re-scoped** | Re-run the producer census filtered to the kept surface. Expected in-scope quantities ≈ 8–10 (property cashflow · rent run-rate · loan cost · expense run-rate · equity · LVR · yield · depreciation · portfolio value) vs 23. **T2 (loan cost) Ring-3 is already the next step and is in scope.** T3 (expense run-rate) in scope. T4 tax constants — property slice only. **T5–T7 fall out of scope → deferred.** Plus the in-scope defect cluster: MON-001, 037, 143, 145, 146, 061–063, 069, 083, 085, 087. Also kill the list page's inline cashflow re-derivation (`properties/page.tsx:1195-1216` bypasses the engine and can disagree with the tile above it). | **The v1 bar:** one producer per kept quantity · every kept surface reads it · declared `expectedMoves` land exactly · **Ring-3 PASS on live data** · sweep complete. |
| **3 — Time-to-first-number < 5 min** | Rebuild onboarding to 3 steps (property → loan → rent+agent). Depreciation becomes an optional post-setup **QS schedule upload → OCR → schedule** using the existing document intelligence. Make `isTaxDeductible` default correctly per category instead of `false`. | A property investor sees a real, correct number in one sitting. |
| **4 — The accountant pack + variance loop** | One-click tax-time pack per property/year (income, deductions, depreciation, loan interest, agent statements, linked documents). Then modelled-vs-actual variance per property per year with the gap explained. | The artefact his firm uses. The feature nobody else has. |
| **5 — Propsight** | Import of a Propsight analysis (file/JSON) → seeds the property's purchase-time assumptions → feeds the variance loop. API only if they offer one. Partnership terms restate the AFSL/tax boundary. | Validated loop before any engineering commitment either side. |
| **Later** | Basiq when GTM thresholds are met → Stage 3 re-enable → Stage 4 → Stage 5. | — |

---

## 4. Risks and dissent (stated, not softened)

1. **One accountant is one data point, with an accountant's lens** (validation, compliance, lodgment). He is not necessarily the ICP — the locked ICP is the *mass-affluent wealth-builder with integration debt* (`docs/implementation/03_OPEN_QUESTIONS_AND_BACKLOG.md:53`, Q-ICP-1 DECIDED 2026-05-24). Weight him high anyway, because (a) his critique matches the registry exactly, and (b) accountants are a distribution channel, not just a critic.
2. **The story must narrow with the product.** If the site says *"the operating system for Australian wealth-builders"* (`.stitch/SITE.md:13`) while the app shows one module, that gap reads as a failed product, not a focused one. The positioning rewrite is already queued and **unstarted** (`02_UP_NEXT.md:154`, row 66). Candidate v1 story: *know exactly what each property is actually doing — and hand your accountant a clean year.*
3. **Positioning currently contradicts itself in the repo.** `MASTER_BLUEPRINT.md:31` and `docs/architecture/00_OVERVIEW.md:24-40` still carry the broad "personal wealth orchestration platform / everyday investors" framing against `.stitch/SITE.md`'s narrowed one. Resolve in Phase 0.
4. **Scope-freeze decay.** Without the rule written into `STATE.md`/`CLAUDE.md`, sunk cost will re-open hidden modules within weeks.
5. **The property module is not yet correct either.** MON-001 (rent ~54% off), MON-143 (5.1× loan cost), MON-146 (rates 100× out) are live at HEAD. Scoping down does not skip Phase 2 — it makes Phase 2 finishable.
6. **UNVERIFIED and excluded from the recommendation:** whether Propsight exposes any API or partner programme (marketing pages only; no API documentation found).

---

## 5. Coverage boundary (§20.6)

This document verifies: the measured surface area, the property module's dependency isolation, the feature-flag capability gap, the registry counts, the MON-131 state, and the manual-entry field counts — all at pinned HEAD `1e2317b6`. It does **NOT** verify: that any number on the property surface is currently correct (MON-001/143/146 say otherwise), that hiding a module is safe for any *specific* route today (Phase 1 does that), or anything about Propsight's technical integration surface.

Related: `docs/implementation/MON-131_COMPLETION_BRIEF.md` · `docs/implementation/MON-131_TRANCHE_LEDGER.md` · `docs/issues/ISSUES.md` · `docs/marketing/GTM_EXECUTION_PLAN.md` · `docs/legal/afsl-credit-tax-boundary-disclosure.md`
