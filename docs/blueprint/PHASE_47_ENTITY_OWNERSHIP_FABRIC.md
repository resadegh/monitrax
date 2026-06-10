# Phase 47 — Entity Ownership Fabric (the "golden feature")

> **Status:** 🟡 DESIGN — staged plan awaiting Reza sign-off on §8 open questions. No code ships from this doc until Stage A is approved.
> **Version:** v1 (2026-06-10).
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

## §8 — Open questions (Reza decisions before Stage A code)

| # | Question | Recommendation |
|---|---|---|
| Q-EOF-1 | Ownership change framing: correction-only v1 (real transfers deferred to a future conveyance/What-If flow)? | **Yes — correction-only.** A transfer affordance without CGT/duty modelling is a tax trap dressed as a feature. |
| Q-EOF-2 | Retail/industry super attaches to the member's personal entity (member-benefit semantics), not a modelled fund entity? | **Yes.** Simple, true enough for net-worth + universe; fund-as-entity (CUSTODIAN_PLATFORM) only if a real need appears. |
| Q-EOF-3 | Holdings/transactions/recurring stay derived (no new columns)? | **Yes** (principle 4). |
| Q-EOF-4 | Dashboard default stays Household-flat with opt-in entity lens? | **Yes.** Per-entity default would tax the single-entity majority. |
| Q-EOF-5 | Stage D timing: strictly after Stage C? | **Yes** — C1 is D's substrate; parallelising re-creates the curl-fed-engine split. |

## §9 — Risks

- **Stage D is the long pole** and legally sensitive; its own doc's external-review findings (§13) stand. Do not let Stages A-C's momentum compress D's review gates.
- **Re-attribution misuse**: a user "correcting" records to dodge tax reality. Mitigation: audit trail + neutral copy + (Stage E) reports labelling per-entity positions as records, not advice.
- **Scope creep into conveyance**: the moment users can record company ownership they'll ask to *move* assets with tax modelling. That's a future What-If lever, not this phase.
- **CDR**: entity attribution of CDR-sourced accounts must not write CDR data into audit metadata (`sanitizeCdrMetadata()` on the correction logs).
