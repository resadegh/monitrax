# Changelog — 2026-05-20

Session: `claude/tech-debt-18-cdr-tables-corrective-migration-MG8mr` (continued).
Type: doc-only — strategic decisions + a major design doc. No code changes.

---

## Session 1 — Strategic parking decisions

### Basiq accreditation external items parked (Q-BASIQ-1)

Reza is unsure whether to onboard Basiq given the initial + ongoing cost. Parked the three external lead-time items rather than commissioning them:

- Phase 0 console #17 (pen test ~AU$15-25k) → ⏸ PARKED, gated on new Open Question Q-BASIQ-1
- Phase 0 console #18 (cyber insurance) → ⏸ PARKED, gated on Q-BASIQ-1
- Phase 0 console #19 (Stripe live-mode) → ⏸ PARKED (monetisation timing — "can wait until later", not Basiq-gated)

New Open Question **Q-BASIQ-1** added with full framing. No work lost by waiting — the CDR compliance code (consent lifecycle, `cdr_*` tables, lifecycle cron) is built and dormant behind the `BASIQ_INTEGRATION` flag; the app is fully PROD-usable on file-import + manual entry. Recommendation logged: launch PROD on Tier 2 + Tier 3 data sourcing, defer Basiq until paying-user revenue covers the accreditation cost. D-Day Bundle Tier 3 marked PARKED but preserved intact.

### WIF Phase 12 — flawed migration path discovered + parked

Reza picked WIF Phase 12 as a workstream; §10 research before touching prod established the documented `CDR_WIF_AUTHENTICATION_EVIDENCE.md` §8 migration path is **flawed**:

1. The runtime Cloud SQL Connector **bypasses `authorized-networks` entirely** (verified vs Google docs) — so `0.0.0.0/0` provides zero runtime attack surface and the Vercel Static IP add-on §8 proposes solves nothing.
2. `0.0.0.0/0` is **load-bearing for the deploy pipeline** — `vercel-build` runs `prisma migrate deploy` + `seed:feature-flags` via a direct `DATABASE_URL` connection from dynamic-IP Vercel build runners. Removing it would break every deploy (R12-class).

The genuine security task is eliminating the build-time `DATABASE_URL` password, not restricting the network. Real path = move `prisma migrate deploy` into an IAM-authenticated Cloud Run Job (~1-2 day infra PR). WIF Phase 12 ⏸ PARKED; the flawed §8 path struck through with a prominent warning banner so no future operator follows it.

### Stale-row fix

Phase 0 console checklist row #3 (`monitrax-conversation-retention-sweep`) still read "⬜ Not yet created" — corrected to ✅ DONE (it was created 2026-05-19, Quick-Click #3).

---

## Session 2 — Phase 44 design doc: Entity Graph & Structure Modelling

**Deliverable:** `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` (new). Design-only — no code; build is review-gated.

### Context

Reza's brief: enrich the entity function to capture complex AU legal structures (companies, trusts, SMSFs, partnerships and all their inter-relationships — shareholding, directorship, trusteeship, beneficiary relations), so the onboarding wizard + entity section can collect the right fields and all Monitrax calculations are correct. Provided his own adviser-produced group structure as the worked example. Explicitly flagged the legal-risk weight and asked for the SSOT / single-calc-engine rule to be honoured.

### Research

- **Explore agent** mapped the existing Phase 41 entity layer across 7 areas: the Phase 41 docs, how owned objects attach via `ownerEntityId`, the `lib/tax-engine/` structure, the onboarding wizard (`EntitiesStep`), the entity-section UI (`/dashboard/entities`, `EntityTree`), GRDCS, and existing entity-relationship code.
- **Key finding:** Phase 41 shipped a solid entity *type* layer but **explicitly deferred the relationship layer** — shareholding, directorship, beneficiary entitlements, partner accounts, SMSF membership. The only relationship today is a single `parentEntityId` self-FK (trustee→trust). A normal multi-entity AU structure cannot be represented at all.
- **WebSearch** confirmed the AU-rules foundation — SMSF trustee structures (max 6 members; member↔trustee/director rule), and the four trust roles (Settlor / Trustee / Appointor / Beneficiary). Surfaced that the **Appointor** — the most control-significant role in a trust — is absent from both the adviser's diagram and the current Monitrax model.

### The design

- **Core principle:** model the *grammar*, not the combinations. A typed graph (entity-type nodes + directed relationship-type edges + a validity matrix) is combination-complete by construction.
- **Node taxonomy** (§4) — extends `LegalEntityType` with `INDIVIDUAL`, `FIXED_TRUST`/`HYBRID_TRUST`, `BARE_TRUST` (SMSF LRBA), `DECEASED_ESTATE`; adds `companySubtype`; adds `CORPORATE_TRUSTEE` role.
- **Edge taxonomy** (§5) — one `EntityRelationshipType` enum: `TRUSTEE_OF`, `APPOINTOR_OF`, `SETTLOR_OF`, `BENEFICIARY_OF`, `UNITHOLDER_OF`, `SHAREHOLDER_OF`, `DIRECTOR_OF`, `SECRETARY_OF`, `PUBLIC_OFFICER_OF`, `MEMBER_OF`, `PARTNER_OF` — each directed, time-bounded, with money/control/tax consequences documented.
- **Edge-validity matrix** (§6) — which edge types are legal between which node types, with cardinality + cross-edge rules (SMSF member↔trustee, company director floor); graded-not-gating.
- **Proposed schema** (§7) — one `EntityRelationship` junction model (adding a relationship type never needs a migration), first-class `ShareParcel` (shares + units, with CGT cost-base fields), `LegalEntity` field additions, and a deliberately-scoped `OwnershipStake` for joint ownership.
- **Tax treatment by structure + SSOT commitment** (§8) — added per Reza's follow-up. §8.1 documents the regime per entity type (company 25/30%, trust flow-through + Div 6, SMSF 15%, partnership flow-through, etc.) and what graph data each needs for a correct number. §8.3 is the non-negotiable rule: **Phase 44 adds ZERO calculation logic — it is a data layer; all tax computation stays in the one existing `lib/tax-engine/`; the graph replaces an input format, never becomes a second engine.** Reviewer-reject on any tax arithmetic outside `lib/tax-engine/` / `lib/calculations/`.
- **Legal-positioning strategy** (§9) — the answer to "what if we get this wrong": Monitrax is a faithful digital twin, not a determiner; `accountantVerified` provenance flags first-class on entities + relationships; every tax number an estimate, traceable, deferrable; the structural AFSL/TPB boundary reused; an accountant-review share-pass.
- **Migration** (§10) — additive throughout; `parentEntityId`→`TRUSTEE_OF` data migration; `ownerEntityId` untouched.
- **Build sequence** (§11) — Part 1 structural graph (1a schema → 1b service → 1c UI → 1d wizard); Part 2 money-flow + tax-engine rewire (separate, higher-risk design pass).

### Files

- `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` — new design doc (13 sections).
- `docs/IMPLEMENTATION_PLAN.md` — new Active Workstream `0·Φ44` (Phase 44); WIF Phase 12 parked; Basiq externals parked; Q-BASIQ-1 added; stale checklist row #3 fixed.
- `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md` — §8 flawed-path warning + strikethrough.

### Next

Reza reviews `PHASE_44_ENTITY_GRAPH.md` — ideally with an accountant sanity-check of the node/edge/validity-matrix model. No Phase 44 code until that review. Build then proceeds Part 1a → 1d.

---

## Session 3 — Phase 44 design doc: two adversarial reviews incorporated (v2 → v3)

**Type:** doc-only — design-doc hardening. No code.

### Review #1 — internal adversarial review agent

A source-verified (ATO/ASIC) adversarial review agent stress-tested the v1 design doc. Found 4 critical issues + gaps + tax-fact errors — all incorporated into **v2**: single-member SMSF un-representable + bidirectional member↔trustee rule wrong (C1); `parentEntityId` "read-through cache" fallacy (C2); `TRUSTEE_OF.from` excluding Trust unexplained (C3); no ownership-cycle rule (C4); company-limited-by-guarantee shareholder bug; missing testamentary trust / guardian / nominee / unlimited+NL company types; §8.1 tax-fact errors. Doc §14 records it.

### Review #2 — external AI review (ChatGPT), incorporated → v3

Reza commissioned a second independent AI review (prompt supplied by Claude). It found v2 still had substantial issues — all now incorporated into **v3**, a near-complete revision of the design doc:

- **§3 over-claim corrected** — "ANY Australian structure" → "combination-complete for the *supported grammar*" with explicit out-of-scope exclusions.
- **NEW §3A** — legal title / beneficial ownership / control are three *separate* dimensions; the model must never infer one from another. This was the deepest conceptual correction.
- **§6.3 SMSF rule corrected** — for a corporate-trustee SMSF, members and directors must be the *same set, both directions*; exceptions only via a new `LEGAL_PERSONAL_REPRESENTATIVE_FOR` edge (death/incapacity/minor/EPOA).
- **§6.1 three-state model** — `VALID` / `NON_COMPLIANT_BUT_RECORDED` / `IMPOSSIBLE_SYSTEM_ERROR`, replacing the binary accept/reject (a 7-member SMSF is recorded + flagged, not refused).
- **§6.5 cycle handling** — circular cross-shareholdings are *detected + recorded*, not blanket-rejected; attribution returns `UNCOMPUTED` until resolved.
- **Appointor** downgraded from "controls the trust" to "strong control *indicator*"; not expected on SMSFs.
- **Deceased estates** properly modelled — `EXECUTOR_OF`/`ADMINISTRATOR_OF` edges, `estateAdministrationStatus`, present-entitlement logic.
- **Joint tenancy** — `OwnershipGroup`+`OwnershipStake` split; survivorship modelled (a joint tenant's interest does not pass through the deceased estate).
- **Nominee** — the broad entity-to-entity `NOMINEE_FOR` edge removed; replaced with the asset-scoped `BeneficialOwnershipOverride` model.
- **`Decimal` not `Float`** for all Phase 44 financial fields; codebase-wide `Float`→`Decimal` migration logged as new Open Question **Q-DEC**.
- **Franking + Div 7A** — graph = eligibility, transactions = what actually happened; `DividendDistribution` + `PrivateCompanyBenefit` deferred to Part 2 (§8.2 heading corrected).
- Added entity types (foreign company, incorporated association, co-operative, strata body corporate, custodian platform) + `regulatoryStatus`; `FAMILY_MEMBER_OF` / `ASSOCIATE_OF` edges for Div 7A; residency + jurisdiction + vesting metadata; tax corrections (trust s98/s99/s99A, testamentary asset-source tracking, SMSF ECPI).
- New **§14.1** — 10 combination-completeness acceptance tests; new **§15** — pre-build acceptance checklist.

### Files

- `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` — v3, comprehensively revised.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 44 workstream phases updated (both reviews logged); new Open Question Q-DEC (codebase-wide Float→Decimal).

### Next

Reza reviews the **v3** doc. No Phase 44 code until that review. The §15 acceptance checklist is the implementer's pre-flight gate.
