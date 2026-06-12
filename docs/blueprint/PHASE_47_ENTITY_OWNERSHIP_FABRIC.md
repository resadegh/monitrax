# Phase 47 — Entity Ownership Fabric (the "golden feature")

> **Status:** ✅ APPROVED FOR STAGE A — Q-EOF-1…5 all decided per recommendation (Reza, 2026-06-10: *"go with your recommended"*), with one scope addition captured in §4A: personal & joint ownership capture must be first-class for users with NO company/trust/SMSF, and the relationship grammar must be complete against Australian tax/property law for the personal tier.
> **Version:** v2 (2026-06-10) — §4A personal-tier completeness matrix added; Q-EOF-1…5 resolved.
> **Owner:** Reza (direction + structural review) + Claude (audit, design, build).
> **Reza directive (2026-06-10):** *"I want to have everything (financial portfolio) of the user captured and can be shown on the entity universe. of course the tax implications, dashboard, reports and everything on the app also needs to understand these relationships and consider them. … This will be the golden feature of Monitrax that user will have a bird-eye view of everything, how they relate and the money and tax flow."*
> **Depends on:** Phase 44 Part 1 (complete — entity grammar, `ownerEntityId`, OwnershipGroup/Stake, BeneficialOwnershipOverride), Phase WX semantic-zoom canvas (complete).
> **Subsumes-as-stage:** `PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` (🟡 DESIGN, review-gated) becomes **Stage D** of this phase — that doc remains its own governing spec; this phase sequences it.
> **Related:** CLAUDE.md §12.2 (SSOT), §12.11 (destructive writes), §12.14 (reform awareness), Part 13 (CDR), Part 14 (TRAIL).

---

## §1 — Problem (what the 2026-06-10 audit found)

The ownership fabric exists at the **model layer** and is consumed by exactly **one** surface (the Wealth Universe canvas). Everywhere else it is either un-capturable or ignored. Three torn layers:

### 1.1 Capture is broken (write path)

Every create route auto-assigns `ownerEntityId = getDefaultLegalEntityId(userId)` (the PERSONAL_NAME entity) and **no form anywhere lets the user pick or change the owning entity** (`app/api/properties/route.ts:116`, `app/api/accounts/route.ts:130`, `app/api/investments/accounts/route.ts:76`, `app/api/assets/route.ts:172`; `AccountFormDialog.tsx` and siblings have no entity field). Update routes do not accept `ownerEntityId`. **Net effect: a user who buys a property inside their company cannot record that fact at all.** The Phase 44 grammar is complete but unreachable from the UI.

### 1.2 Coverage has three holes (schema/read)

| Object | State | Evidence |
|---|---|---|
| `SuperannuationAccount` | `ownerEntityId` **nullable**, set only for SMSF member accounts. Retail/industry super floats un-attributed. | `schema.prisma:4106` |
| Super in wealth graph | `ownerEntityId` not even selected — SMSF accounts invisible to the canvas's entity partitioning. | `wealthGraphService.ts:631-637` |
| `InvestmentHolding`, `Transaction`, `RecurringPayment` | No `ownerEntityId` column — ownership only derivable through the parent (account / income / expense). | `schema.prisma:2098, 1888, 3093` |

### 1.3 Consumption is entity-blind (read path)

- `masterFinancialService.fetchAllUserData()` doesn't select `ownerEntityId`; every dashboard number is a flat per-user sum (`masterFinancialService.ts:527-681`). `calculateNetWorth()` already accepts an entity filter parameter — **never passed** (`netWorthCalculator.ts:54-85`).
- Reports (`lib/reports/contextBuilder.ts:23-150`) query by `userId` only; all six report types are flat.
- The tax engine is **fully per-entity-ready** (`entityTaxRouter.ts` routes by entity type; CGT discount, negative gearing, loss rules all entity-aware) but **starved**: nothing assembles `EntityTaxFacts` from persisted rows; companies/trusts/SMSFs return `UNCOMPUTED` unless facts are POSTed via curl. That assembler is exactly what `PHASE_44_PART_2` designed and never built.

**One sentence:** the skeleton is built, the nervous system isn't connected — ownership is recorded, defaulted to "personal", invisible to the user, and ignored by every number on screen except the canvas.

## §2 — Why it matters

Who owns an asset changes its Australian tax treatment *by construction*: CGT discount is 50% personal/trust, 33⅓% complying super, **0% company**; negative gearing benefits depend on the owner's marginal position; land tax aggregates per-owner per-state; trust income must be distributed or taxed at penalty rates. A dashboard that flat-sums a company property with a personal one is not simplifying — it is **wrong in a way the user can't see** (financial-adviser + compliance lenses, and `PHASE_44_ENTITY_GRAPH.md` §9 already classifies wrong tax numbers as legal exposure). Meanwhile the bird's-eye universe is the product moat: no AU consumer tool shows structure + value + money flow + tax treatment in one navigable surface (growth lens). And for the user, "Monitrax understands my trust" is the moment the product graduates from budgeting app to operating system (psychology lens: control, not anxiety).

## §3 — Design principles (non-negotiable for every stage)

1. **Additive, never breaking.** No column drops, no meaning changes to existing fields. New aggregation outputs are NEW keys beside existing ones; golden tests assert flat household totals are byte-identical before/after each stage.
2. **The default stays "personal".** Auto-assign to PERSONAL_NAME remains the zero-friction path. Entity selection is progressive disclosure — visible only when the user HAS ≥2 entities (psychology lens: no cognitive tax on the 90% single-entity user).
3. **Correction ≠ transfer.** Changing `ownerEntityId` in-app means *"the record was wrong — this entity always owned it."* It is NEVER framed as moving an asset between entities: a real-world transfer is a CGT event + duty trigger, and a casual "move to trust" button would imply Monitrax blesses tax-free restructures. Real transfers are out of scope for this phase (they belong to a future conveyance/What-If flow). UI copy, audit log action names, and docs all use "correct ownership record".
4. **Derived ownership beats duplicated ownership.** `InvestmentHolding` / `Transaction` / `RecurringPayment` ownership is DERIVED from the parent (account / income / expense), exposed via one canonical helper — not new columns that can drift (SSOT §12.2). `BeneficialOwnershipOverride` already covers the genuine title-splits.
5. **Three dimensions stay separable.** Legal title (`ownerEntityId` + stakes), beneficial ownership (overrides), control (relationship edges) — Phase 44 §3A. No stage may collapse them.
6. **Every destructive write gates through §12.11.** `ownerEntityId` re-attribution is an UPDATE on user rows — checklist + audit log (`OWNERSHIP_RECORD_CORRECTED`) mandatory.
7. **Tax numbers only from the engine.** No stage invents per-entity tax estimates in UI code. Until Stage D lands, per-entity tax surfaces show the engine's honest `UNCOMPUTED` state with a "coming" frame — never a guessed number (§12.14 FW-2 discipline).

## §4 — The staged plan

Five stages, each independently shippable, revertible, and gated on the previous. Capture → Complete → Consume → Compute → Report.

### Stage A — Capture (write path) — ~3-4 PRs

**Goal: a user can record who owns what, at creation and after.**

- **A1. Entity picker on create** — one shared `EntityOwnerPicker` component (combobox, defaults to personal, hidden when user has <2 entities). Wired into Property / Account / InvestmentAccount / Asset / Income / Expense create forms + their POST routes (validate the entity belongs to the user; keep `getDefaultLegalEntityId` fallback). Stitch pass required (§18) for the picker pattern + per-form placement.
- **A2. Ownership panel on edit** — each entity-ownable object's edit surface gains an "Ownership" row showing the current owning entity + "Correct ownership record" affordance (dialog: new entity + reason note + warning copy: *"this corrects the record — it does not transfer the asset; transfers have tax consequences"*). New `PATCH /api/<object>/[id]/ownership` endpoints, §12.11 checklist in the PR, `createAuditLog('OWNERSHIP_RECORD_CORRECTED', …)`.
- **A3. Bulk re-attribution** — "Assign to entity" multi-select on list pages (properties, accounts, investments, assets) for users setting up a structure after years of personal-default data. Same correction framing, same audit trail, one transaction.
- **A4. Onboarding/entity-create hook** — when a user creates a new entity (trust/company/SMSF), offer the bulk tool immediately: *"Do any of your existing items belong to {entity}?"* (growth lens: the structure-setup moment is when attribution intent is highest).

### §4A — Personal-tier ownership completeness (Reza addition, 2026-06-10)

> *"Want to make sure personal ownership of assets is also captured for users with no company, trust, etc and own assets under their personal or joint names. This section should cover every possible relationship based on the tax and other Australian laws. It should be very complete."*

The personal tier is not a degenerate case of the entity tier — it is the MAJORITY case, and Australian tax law attaches specific treatment to each personal co-ownership form. The Phase 44 grammar already models all of them; Stage A must make every row **capturable at asset creation**, and Stages C/D must make the engine **apply the row's tax treatment**. This matrix is the completeness contract:

| # | Ownership form | Real-world example | Model representation (exists today) | Tax treatment the engine must apply | Stage |
|---|---|---|---|---|---|
| P1 | **Sole — personal name** | Car, bank account, ETF portfolio in own name | `ownerEntityId` → PERSONAL_NAME entity (the current default) | All income, deductions, CG to the individual; CGT 50% discount ≥12 months; main-residence exemption attaches HERE (individuals only, never entities) | A (already default) |
| P2 | **Joint tenants (JT)** | Family home or joint bank account with spouse | `OwnershipGroup(tenancyType: JOINT_TENANTS)` + equal `OwnershipStake`s, `survivorshipApplies: true` | Equal undivided shares — income/losses split **per legal interest, 50/50, regardless of who paid** (ATO TR 93/32); survivorship on death (passes outside the will) | A capture / C-D compute |
| P3 | **Tenants in common (TIC)** | Investment property 70/30 between siblings | `OwnershipGroup(tenancyType: TENANTS_IN_COMMON)` + fractional `OwnershipStake.sharePct` | Income/losses/CG follow the **legal share percentages** (TR 93/32); each owner's share passes via their will | A capture / C-D compute |
| P4 | **Co-ownership ≠ partnership** | Spouses co-own a rental — not a business | Stays an OwnershipGroup; **only** becomes a `PARTNERSHIP` entity when genuinely carrying on a business | TR 93/32: mere rental co-ownership is a *tax-law* partnership (income split per shares) but NOT a general-law partnership — no partnership return implied. The UI must never push co-owners into creating a PARTNERSHIP entity | A copy/UX + D |
| P5 | **Spousal attribution** | Joint savings account interest | P2/P3 stakes ARE the attribution source | Interest on joint accounts presumed 50/50 unless beneficial ownership shown otherwise — `BeneficialOwnershipOverride` is the documented exception path | C-D |
| P6 | **Held for a minor** | Parent holds shares "in trust for" a child | `BARE_TRUST` entity (informal) or `BeneficialOwnershipOverride` (parent legal / child beneficial) | Div 6AA penalty rates on a minor's unearned income — engine flag, not a silent personal attribution | B (picker exposes) / D |
| P7 | **Deceased estate** | Inherited assets pre-administration | `DECEASED_ESTATE` entity type (exists in grammar) | s99/s99A executor taxation; CGT cost-base reset rules | Grammar exists; D |
| P8 | **Nominee / bare trust** | Broker custodian holds shares | `BeneficialOwnershipOverride` (exists) | CGT + income follow BENEFICIAL owner | Exists; D reads it |
| P9 | **Life interest / remainder, other exotic** | Testamentary life tenancy | `OTHER` + `unsupportedStructure` flag (Phase 44 §4 exclusion mechanism) | Flagged honest `UNCOMPUTED` — never silently mismodelled | Out of grammar (deliberate) |

**Stage A consequences (binding):**
1. The `EntityOwnerPicker` is really an **ownership picker**, not an entity dropdown: *"Just me"* (default, P1) / *"Joint — equal with survivorship"* (P2, quick-create the group + stakes inline, spouse from My Household) / *"Shared — set percentages"* (P3) / *"Another entity"* (trust/company/SMSF when they exist). Joint capture must NOT require a detour to the entities page.
2. Warm-words rule (§14.3): users never see "OwnershipGroup", "tenancy", "TENANTS_IN_COMMON" — they see "Just me", "Joint with Sarah", "Shared 70/30".
3. P4 guard: copy must never suggest co-owners need a "partnership". 
4. **Acceptance addition:** a two-person household with a JT home, a TIC investment property, a joint account and personal vehicles can capture ALL of it without creating a single company/trust — and the universe renders each form distinctly (the canvas already renders ownership-group nodes).

### §4B — Build-discovered items (Stage A build sweep, 2026-06-10)

> Reza directive: *"make sure all of these are documented and addressed on this phase. I don't want anything to be missed out."* Items surfaced while building Stage A — each is either FIXED, QUEUED into a stage, or explicitly parked with a trigger. Nothing lives only in chat.

| # | Item | Status |
|---|---|---|
| D1 | **Co-owner dedup** — quick-creating "Sarah" on a second asset created a SECOND INDIVIDUAL entity, fragmenting her ownership across duplicate universe tiles. | ✅ FIXED (Stage A follow-up PR): `applyOwnershipSelection` reuses an existing INDIVIDUAL entity by case-insensitive name before creating; the picker also surfaces existing INDIVIDUAL entities as joint chips so users pick rather than re-type. |
| D2 | **Onboarding wizard doesn't capture ownership** — wizard-entered data all defaults to personal. | ✅ **DECIDED 2026-06-10 (Reza): keep ownership OUT of onboarding** — the wizard stays light (no initial cognitive load). Instead the ReviewStep carries a forward-looking note: *"Everything you've added is recorded in your name for now… you can set who owns each item anytime."* Shipped same day. Stage A5 closed as decided-out. |
| D3 | **Income/Expense attribution** — money streams follow their asset's title (§4A P5). | ✅ **DECIDED 2026-06-10 (Reza: "go with your recommendation"): NO picker v1** — attribution derives from the owning asset's stakes in Stage C/D. Revisit only if standalone entity income (e.g. director fees) demands it. |
| D4 | **Ownership evidence linkage** — `EntityRelationship` carries `accountantVerified`, but `OwnershipGroup` has no link to evidence (title deed in Documents). | 🔜 QUEUED into **Stage E** — "verified against title" flag + Documents link strengthens the record for tax time. |
| D5 | **HouseholdMember ↔ INDIVIDUAL entity linkage** — the same person can exist as a household member AND an entity with no FK; renaming one doesn't rename the other. | 🗑️ Tech-debt backlog — link column when it first bites (rename drift or duplicate identity in UI). |
| D6 | **What-If levers are single-taxpayer** — sellProperty CGT doesn't split across joint owners / apply entity rates. | 🔜 Stage D scope note — the EntityTaxFacts assembler must read stakes; levers consume the per-entity engine outputs after D. |
| D7 | **CDR joint-account auto-suggest** — bank data flags joint accounts; on future Basiq sync, pre-fill the ownership group suggestion. | 📦 PARKED — trigger: Basiq integration build. Recorded so the sync design reads this phase. |
| D8 | **Estate lens** — JT survivorship vs TIC-via-will is now captured per stake; an estate-planning surface can read it directly. | 📦 PARKED — free option created by §4A; no action until an estate phase opens. |
| D9 | **Financial-surfaces lint baseline shifts** — picker insertions relocate grandfathered violations (PR #1043 preview failure). | ✅ Process note — rebase `.audit/financial-math-baseline.json` line numbers in the same PR as any form insertion (PR #953 precedent). |

### Stage B — Complete (coverage holes) — ~2 PRs

- **B1. Super attachment** — backfill `SuperannuationAccount.ownerEntityId` = the member's personal entity for non-SMSF accounts (semantics: *member benefit*, documented in the column comment; SMSF accounts already attach to the SMSF entity). Migration per §12.12. Add `ownerEntityId` to the wealth-graph select; super appears in the universe (SMSF accounts under the SMSF entity, retail under YOU) and in the canonical clusters.
- **B2. Derived-ownership helper** — `lib/utils/ownership.ts` gains `resolveOwnerEntityId(object)` for holdings (→ account), transactions (→ income/expense → fallback account), recurring payments (→ linked expense → fallback null + flagged). Documented decision: **no new columns** (principle 4). Revisit only if a custodian use-case shows real drift.

### Stage C — Consume (entity-aware aggregation + surfaces) — ~3 PRs

- **C1. Entity-aware master snapshot (additive)** — `fetchAllUserData()` selects `ownerEntityId`; `computeMasterFinancialSnapshot()` adds `byEntity: Record<entityId, { netWorth, assets, liabilities, income, expenses, cashflow }>` BESIDE the existing flat fields. Golden test: flat fields unchanged to the cent.
- **C2. Dashboard entity lens** — an entity filter pill on `/dashboard` (and My Wealth), default "Household" = today's view, options per entity. Progressive: renders only with ≥2 entities. Feature-flagged for one release.
- **C3. Universe value parity** — canvas aggregates ("$X held", cluster values, money-flow labels) read the same `byEntity` numbers as the dashboard (SSOT — today the graph service re-derives sums; after C1 it delegates or is reconciled by test).

### Stage D — Compute (per-entity tax from persisted facts) — governed by `PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md`

Execute the already-designed, review-gated Part 2: persist "what actually happened" (distribution resolutions, dividends — partly built for the Money Flow lens — Div 7A loans, CGT events), build the `EntityTaxFacts` assembler keyed on `ownerEntityId`, light up the trust/company/SMSF router branches. **Highest legal risk; its own doc's review gates apply unchanged.** This phase only fixes its position in the sequence: after C, because C1's entity partitioning is the assembler's substrate.

### Stage E — Report (bird's-eye outputs) — ~2 PRs

- **E1. Per-entity report sections** — `contextBuilder` partitions by entity; financial-overview + tax-time reports gain per-entity sections (entity name, type badge, holdings, net position, engine-computed tax position or honest `UNCOMPUTED`).
- **E2. Universe tax-flow overlay** — extend the existing Money Flow lens with the Stage-D tax treatments (per-flow regime already renders; add per-entity tax-position badges to entity tiles). This completes the directive: structure + value + money flow + **tax flow**, one canvas.

### Stage F — Structure Capture Completion (added 2026-06-12, Reza directive)

> **Origin.** Reza compared his advisor-drawn **Renew Group structure chart** (trading company, bucket company, discretionary family trust, two corporate trustees, SMSF, bare trust + bare trustee holding an LRBA property — plus directors, secretaries, shareholders with share classes/counts, members, beneficiaries, spouse links) against Monitrax and asked whether it can all be captured. Audit verdict (2026-06-12): **the Phase 44 data model represents every element; the capture surfaces don't.** Reza: *"plan the build to add all possible entities and their relationship not just this example. The onboarding wizard should be able to capture most of this but fine tuning and further details should be also available through my structure page."*

**Capability-regression record (honest §15 framing).** Phase 44 Part 1c SHIPPED a full relationship editor (`EntityDetailDialog` — add / end / delete edges with live `classifyEdge` validity preview). It was deleted 2026-05-31 in the legacy-canvas retirement (dead-code rule, correctly applied — zero consumers) when the Wealth Universe became the My Structure surface, and the universe's `EntityDetailPanel` never inherited the editing affordances. Stage F is therefore **restoration + completion in the universe's design language**, not greenfield: the rules engine (`lib/entity-graph/validityMatrix.ts`), the only-writer service (`entityRelationshipService.ts`), and the API routes (`/api/entities/relationships*`, `/beneficial-ownership*`) are all live and tested. The genuinely-new build is the `ShareParcel` writer (schema shipped in 1a; no writer was ever built).

**The audit gap matrix (2026-06-12) — what exists vs what's capturable:**

| Capability | Schema | Service/API | UI | Stage |
|---|---|---|---|---|
| 7 common entity types (personal, company, disc/unit trust, SMSF, partnership, sole trader) | ✅ | ✅ | ✅ | shipped (41a) |
| 12 extended types (BARE_TRUST, INDIVIDUAL, FIXED/HYBRID/TESTAMENTARY_TRUST, DECEASED_ESTATE, FOREIGN_COMPANY, INCORPORATED_ASSOCIATION, CO_OPERATIVE, STRATA_BODY_CORPORATE, CUSTODIAN_PLATFORM, OTHER) | ✅ | ❌ API whitelist stops at 7 | ❌ | **F1** |
| CORPORATE_TRUSTEE role; CompanySubtype; INDIVIDUAL dateOfBirth; trust vesting/deed dates; estate status | ✅ | ❌ not accepted | ❌ | **F1** |
| Full 19-type relationship grammar (incl. SECRETARY_OF, SETTLOR_OF, APPOINTOR_OF, GUARDIAN_OF, POWER_HOLDER_OF, PUBLIC_OFFICER_OF, EXECUTOR_OF, LPR, FAMILY_MEMBER_OF…) | ✅ | ✅ | ❌ wizard captures 5 types; **no post-onboarding editor** | **F2** (editor) + **F4** (wizard depth) |
| Beneficial-ownership override (incl. `BARE_TRUST` basis — the LRBA case) | ✅ | ✅ | ❌ | **F2** |
| `ShareParcel` — share class, quantity, paid/unpaid, CGT acquisition date ("[1 ORD]", "[500]") | ✅ | ❌ **no writer anywhere** | ❌ | **F3** |
| Universe glyph/classification for the extended types | n/a | n/a | ❌ falls to generic company | **F1** |

#### F1 — Unlock the full entity-type grammar (1 PR)

- `app/api/entities/route.ts`: `VALID_TYPES` → all 19 `LegalEntityType` values; `VALID_ROLES` + `CORPORATE_TRUSTEE`; accept per-type conditional fields with a per-type whitelist — `companySubtype` (companies), `dateOfBirth` (INDIVIDUAL), `vestingDate`/`deedDate` (trusts), `estateAdministrationStatus` (DECEASED_ESTATE). Auto-derive `trustType` for the new trust types (FIXED_TRUST→FIXED, HYBRID_TRUST→HYBRID, TESTAMENTARY_TRUST→TESTAMENTARY) so §12.14 Measure-3 dispatch stays correct.
- `app/dashboard/entities/page.tsx` create/edit dialog: **two-tier type picker** — "Common" (today's seven, unchanged first paint) + a collapsed "More structures" expander for the twelve extended types. Behaviour-psychology contract: a beginner adding their first family trust NEVER sees "Strata body corporate"; the advanced user finds everything in one tap. Warm one-line descriptions per type (*"Bare trust — holds a single asset for someone else; used for SMSF property loans"*).
- Universe: `classifyEntity` additions — BARE_TRUST / FIXED / HYBRID / TESTAMENTARY_TRUST + DECEASED_ESTATE → `trust` vocabulary; CUSTODIAN_PLATFORM → `trustee-company`; FOREIGN_COMPANY / INCORPORATED_ASSOCIATION / CO_OPERATIVE / STRATA → `other-company`. No new glyphs v1 (restraint) — the type label carries the precision.
- Stitch pass (§18): the expanded picker inside the existing glass dialog (4-variant matrix).

#### F2 — "Roles & People" editor on My Structure (1 PR)

The restoration. `EntityDetailPanel` (desktop) + the mobile detail card gain a **Roles & people** section:

- Current edges listed, grouped by the §11A lens vocabulary (Control / Ownership / Eligibility / Office / Family), each with the counterpart\'s name, effective dates, and an end-date affordance ("Sarah resigned as director" closes the edge — never deletes history).
- **"Add a role" dialog**: pick the person/entity (existing chips + INDIVIDUAL quick-create with D1 dedup) → pick the role (full 19-type grammar, grouped, `graphMeta` plain-English labels) → type-specific metadata (beneficiary class, family relation incl. SPOUSE, appointor powers, power type/subject, TFN-quoted flag) → **live §6.2 validity preview** via the pure `classifyEdge` (imported client-side exactly as the deleted 1c dialog did). NON_COMPLIANT records with an amber badge; IMPOSSIBLE blocks with a plain-English reason.
- **"Actually held for…" row** (beneficial-ownership override) on asset-holding entities — basis picker incl. Bare trust / Nominee / Custodian. This is how the Renew LRBA property reads: legal title → bare trustee ATF bare trust, beneficially → the SMSF.
- Reuses `entityGraphClient` (already retained for accountant-review) — no new fetch layer. Stitch-first for the section + dialog (4-variant matrix; also clears the OWED dark/mobile variants debt from Stage A).

**F2a — The per-type role template (the "Entity File" pattern; Reza addition 2026-06-12).** Reza: *"there is an easy way to mark the company director, shareholders, trustee, beneficiary, etc for any entity based on the required type of entity… make sure all related information is captured and stored and used where and when needed."* The advisor chart works because each card is a TYPE-AWARE FILE — a company card shows Director / Shareholder / Secretary rows; a trust card shows Trustee / Beneficiary rows. F2 must render the same pattern, not a freeform relationship list:

- **New canonical `lib/entity-graph/roleTemplates.ts`** — one SSOT map `roleTemplateFor(type)`: per entity type, which roles are **required** (company → ≥1 director; trust → trustee; SMSF → trustee + members; partnership → ≥2 partners; deceased estate → executor/administrator; bare trust → trustee + beneficiary), **expected** (company → shareholders; trust → beneficiaries; SMSF → member balances), and **optional** (secretary, public officer, settlor, appointor, guardian, power holder). The validity matrix stays the law (the stick — flags violations); the template is the guidance (the carrot — drives affordances). The matrix's §6.3/§6.4 knowledge is NOT duplicated — templates only name the rows; `classifyEntity` keeps judging them.
- **The Roles & People section renders the template rows** exactly like the advisor chart: filled roles show names inline ("Director — Reza, Newsha"; "Shareholder — Newsha [500 ORD], Reza [500 ORD]" once F3 lands), missing REQUIRED roles render a quiet add affordance ("Add a director") — celebration-of-next-action framing, never a red wall of missing fields. Roles not in the type's template are reachable under "More roles" (the full grammar never disappears).
- **Per-entity completeness chip** — derived from required-roles coverage + `classifyEntity` issues; surfaces on the entity card and the universe preview popover ("Structure file 4/5 complete"). Behaviour-psychology contract: completeness is an invitation, not a score that shames.
- **Stored once, used everywhere** — the same edges feed: the entity detail panel rows (this stage), the universe hover popover + accountant-review report (already read the graph), Stage D tax facts (Div 7A associate determination reads FAMILY_MEMBER_OF/DIRECTOR_OF; trust distribution reads BENEFICIARY_OF; SMSF rules read MEMBER_OF — exactly as `PHASE_44_PART_2` designed), and Stage E per-entity report sections. No new storage — the Phase 44 graph IS the store; F2a only completes capture + display.
- **F4 alignment** — the wizard's per-type cards already implicitly follow per-type roles; F4 re-points them to read `roleTemplates.ts` so wizard and editor can never drift (one SSOT for "what roles does this type have").

#### F3 — Share parcels & equity detail (1 PR)

- `entityRelationshipService` extension (stays the only graph writer): parcel CRUD hanging off SHAREHOLDER_OF / UNITHOLDER_OF edges. New nested route `/api/entities/relationships/[id]/parcels`.
- F2\'s shareholder/unitholder rows expand to a parcel list — *"500 ordinary · acquired 12 Mar 2021 · $1.00 paid"* — add / edit / dispose (sets `disposedAt`, never deletes; CGT history is sacred).
- Universe ownership ribbons label quantity + class where parcels exist ("500 ORD").
- §12.11 checklist required (parcel update/delete paths).

#### F4 — Onboarding wizard fine-tune (1 PR)

- `EntitiesStep`: the same two-tier type picker (Common seven first paint; "More structures" collapsed — zero added friction for the 90% case; growth lens defends every onboarding step).
- `RelationshipsStep`: per-entity optional **"More detail"** disclosure adds secretary / settlor / appointor chips + a one-line share quick-entry per shareholder (count + class only; full parcel detail lives in F3\'s editor). The default skeleton capture (directors, shareholders, trustee, beneficiaries, members) is unchanged.
- `ReviewStep` note extends: *"Fine-tune roles, share details and unusual structures anytime in My Structure."* — the F2 editor makes "finishable later" (Phase 44 §11 1d contract) actually true for the full grammar.
- D2 decision unchanged: ASSET ownership stays out of onboarding; F4 only deepens STRUCTURE capture, which already lives in the wizard.

#### F-G — Golden acceptance test (builds across F1–F3, lands complete in F4\'s PR)

`tests/entity-graph/renewStructure.golden.test.ts` reproduces Reza\'s advisor chart node-for-node via the services: 10 entities (incl. BARE_TRUST + bare trustee + SMSF trustee company + bucket company), every edge type on the chart (directors, secretaries, shareholders **with parcels [1 ORD] / [500] / [50]**, members, beneficiaries incl. a company beneficiary, trustee ATF links, spouse FAMILY_MEMBER_OF), the LRBA property legally on the bare trust with a `BARE_TRUST`-basis beneficial override to the SMSF. Asserts: every edge classifies VALID, the universe layout renders every node with the right vocabulary, and the additive `byEntity` invariant still holds. **Phase 47 §7 acceptance criteria gains this row: the Renew chart is reproducible in Monitrax node-for-node.**

**Sequencing rationale.** F1 first — types unblock everything and are pure whitelist+form work. F2 second — the daily-driver editor; F3 needs F2\'s surface to hang parcels on. F4 last — the wizard touches the activation funnel, so it ships only once "finishable later" is real. Stage F is independent of Stage D (tax compute) and can interleave; Stage E\'s per-entity reports get richer for free as F lands.

**TRAIL mapping:** Track ("Track your full picture" — the structure IS the picture for entity-rich users) with Invest-stage depth surfaced progressively.

## §5 — Non-breaking guarantees (how "don't break anything" is enforced)

| Guarantee | Mechanism |
|---|---|
| Existing numbers never change | Golden snapshot tests on master snapshot + reports, asserted per stage |
| Existing flows never gain friction | Picker/lens render only at ≥2 entities; defaults unchanged |
| Schema only widens | Nullable-first columns, backfill migrations, no drops (§12.12) |
| Re-attribution can't corrupt | §12.11 checklist, ownership validated against userId, audit log, no cascade surprises (FK already `Restrict`) |
| Tax never guesses | `UNCOMPUTED` until Stage D's review gates pass (§12.14 FW-2) |
| Each stage revertible | Stage = independent PR set, feature flags on user-visible lenses |

## §6 — TRAIL mapping

Capture (A) and Completion (B) live in **Track** ("track your full picture" — now including *whose* picture). The entity lens (C) spans Track→Invest. The universe overlays (E) are **Invest**-stage surfaces. Stage-gated, never blocked: single-entity users see zero new chrome.

## §7 — Acceptance criteria (phase-complete when…)

1. Every entity-ownable object (incl. super) can be attributed at create + corrected after, with audit trail.
2. The universe renders 100% of the portfolio under the correct entity (nothing floats).
3. Dashboard + reports can answer "what does {entity} own / earn / owe?" from the canonical snapshot.
4. A trust/company/SMSF with persisted facts returns a real engine-computed tax position (Stage D gates passed).
5. Flat household totals identical to pre-phase baselines (golden tests green throughout).

## §8 — Design gates — ✅ ALL DECIDED 2026-06-10 (Reza: "go with your recommended")

| # | Question | Decision |
|---|---|---|
| Q-EOF-1 | Ownership change framing | ✅ **Correction-only v1.** Real transfers deferred to a future conveyance/What-If flow — a transfer affordance without CGT/duty modelling is a tax trap dressed as a feature. |
| Q-EOF-2 | Retail/industry super attachment | ✅ **Member's personal entity** (member-benefit semantics); fund-as-entity only if a real need appears. |
| Q-EOF-3 | Holdings/transactions/recurring ownership | ✅ **Derived from parent** — no new columns. |
| Q-EOF-4 | Dashboard default | ✅ **Household-flat with opt-in entity lens.** |
| Q-EOF-5 | Stage D timing | ✅ **Strictly after Stage C.** |
| (addition) | Personal-tier completeness | ✅ **§4A matrix is binding** — personal & joint capture first-class for users with no company/trust; grammar completeness asserted per Australian tax/property law forms (P1–P9). |

## §9 — Risks

- **Stage D is the long pole** and legally sensitive; its own doc's external-review findings (§13) stand. Do not let Stages A-C's momentum compress D's review gates.
- **Re-attribution misuse**: a user "correcting" records to dodge tax reality. Mitigation: audit trail + neutral copy + (Stage E) reports labelling per-entity positions as records, not advice.
- **Scope creep into conveyance**: the moment users can record company ownership they'll ask to *move* assets with tax modelling. That's a future What-If lever, not this phase.
- **CDR**: entity attribution of CDR-sourced accounts must not write CDR data into audit metadata (`sanitizeCdrMetadata()` on the correction logs).
