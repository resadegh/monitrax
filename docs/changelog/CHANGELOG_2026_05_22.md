# Changelog — 2026-05-22

> Per Reza directive 2026-05-18: every PR includes a CHANGELOG session entry as part of the PR, plus the full §16.5 doc-sync block in the PR description.

## Session: Phase 44 Part 1a — Entity Graph schema

Branch: `claude/phase-44-part-1a-schema-MG8mr`

### Changes Made

- **Type**: Feature (schema) — Phase 44 Part 1a, the structural entity-graph schema.
- **Scope**: `prisma/schema.prisma` + a new migration. Pure data layer — no service / API / UI / calculation code in this PR.
- **Design contract**: `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` (v3, two adversarial reviews incorporated). §15 acceptance checklist satisfied by the design.

Phase 41 modelled entity *types*; Phase 44 adds the *relationship* layer it deferred — a typed, directed, time-bounded graph so Monitrax can represent real Australian multi-entity structures. Part 1a is schema only; the §6 validity logic (Part 1b) and UI (Part 1c) follow.

### Schema additions (`prisma/schema.prisma`)

- **5 new models**: `EntityRelationship` (the one typed edge — 19 relationship types, time-bounded, with the §6.1 `structuralState` three-state classifier), `ShareParcel` (first-class equity — shares + units, `Decimal` throughout for CGT correctness), `OwnershipGroup` + `OwnershipStake` (joint / shared ownership with survivorship), `BeneficialOwnershipOverride` (asset-scoped legal-title ≠ beneficial-owner).
- **8 new enums**: `EntityRelationshipType`, `BeneficiaryClass`, `StructuralState`, `ShareClass`, `EquityKind`, `TenancyType`, `BeneficialOwnershipBasis`, `CompanySubtype`.
- **Enum extensions**: `LegalEntityType` +12 values, `LegalEntityRole` +`CORPORATE_TRUSTEE`, `TrustType` +`HYBRID`/`TESTAMENTARY` (all appended — DB enum order matches schema.prisma, no future migrate-dev drift).
- **`LegalEntity`**: 22 additive columns — `companySubtype`, `dateOfBirth`, `directorIdEncrypted` (encrypted, TFN treatment), the legal-title/beneficial/control capability flags, the residency + jurisdiction blocks, trust + estate metadata, `regulatoryStatus`, `structuralState`, `accountantVerified`. Plus reverse relations to the new models. `User` gains reverse relations for the three user-scoped models.

### Migration

- **NEW** `prisma/migrations/20260522030000_phase_44_entity_graph_part_1a/migration.sql` — purely additive: 8 `CREATE TYPE`, 15 `ALTER TYPE ADD VALUE`, 22 `ALTER TABLE ADD COLUMN`, 5 `CREATE TABLE`, indexes, foreign keys, and the `parentEntityId` → `TRUSTEE_OF` data migration (INSERT-only — converts the legacy single trustee→trust self-FK into first-class edges; `parentEntityId` is left frozen read-only per design doc §10).
- Hand-written following Prisma's generated-SQL conventions — the build sandbox has no database to run `prisma migrate dev` against. The Vercel preview build runs `prisma migrate deploy` against `monitrax-db-dev` and is the canonical verification.

### §12.11 Destructive-write checklist

N/A by structural argument — the migration only `CREATE`s and `ADD`s, and the one data-migration statement is an `INSERT` (no `UPDATE`, no `DELETE`, no row mutation). No application-code Prisma writes in this PR.

### §12.12 Schema-change protocol

✅ `prisma/schema.prisma` modified + the matching migration `20260522030000_phase_44_entity_graph_part_1a/migration.sql` ship in the same PR. Additive only — no `DROP`, no `ALTER ... DROP COLUMN`, no `NOT NULL` column without a default.

### §12.14 Phase 41E reform compliance

N/A — no `lib/tax-engine/` change, no AI tool, no per-asset tax-position UI. New `LegalEntity` columns are structural/metadata; none interacts with the reform grandfathering logic (the existing `trustType` / `isForeignResident` dispatch fields are unchanged; `isForeignResident` is retained and the new `taxResidencyStatus` is additive).

### Build Status

- [x] `npm run build` — **passes** (`node_modules` installed via `npm ci` this session; `npx prisma generate` + `next build` both clean).
- [x] `npx tsc --noEmit` — clean, zero errors.
- Schema reviewed against Prisma 5.22 relation rules — all named relations (`RelationshipsFrom`/`RelationshipsTo`) have both sides; all FK back-relations present on `User` + `LegalEntity`.

### Follow-up: enum-widening TypeScript blast radius (CI fix)

PR #864's first CI run failed `Build verification` (a `tsc` failure — `prisma validate` passed). Extending the Prisma `LegalEntityType` (+12) and `LegalEntityRole` (+`CORPORATE_TRUSTEE`) enums made stale type mirrors break at five call sites. All fixes are type-level only — **no dispatch logic, no calculation, no runtime behaviour changed** (design contract §8.3: Part 1a is schema-only).

- `lib/tax-engine/types.ts` — widened `EntityTaxFacts.entityType` from the original 7-value union to the full 19-value structural grammar (mirrors the Prisma enum, per the file's existing local-mirror convention).
- `lib/tax-engine/entity/entityTaxRouter.ts` — added the `isCgtEligibleEntityType` type guard so `dispatchCgtIfPresent` narrows the widened union back to the 7-value `CgtEligibleEntityType` before calling `applyCapitalLossNetting`. Non-eligible types return `null` (no CGT) — unreachable at runtime today (no UI creates the 12 new types); Part 1b wires their CGT dispatch.
- `components/entities/types.ts` — added `CORPORATE_TRUSTEE` to the local `LegalEntityRole` union, `ROLE_LABELS`, `ROLES`, and `ROLE_PALETTE` (neutral slate tone — a corporate trustee is a control vehicle, not a wealth-bearing entity).
- `components/entities/MoneyFlowSankey.tsx` — added the `CORPORATE_TRUSTEE` key to `ROLE_HEX` and `roleOrder`.
- `app/dashboard/entities/page.tsx` — added `CORPORATE_TRUSTEE` to the page-local `LegalEntityRole` union + `ROLE_LABELS` (keeps the page's `Entity` callback type assignable to `EntityTree`'s widened `Entity` prop).

### Documentation Updated

- `docs/architecture/03_DATA_MODEL.md` — new §3.10 Entity Graph (model summary + migration note).
- `docs/IMPLEMENTATION_PLAN.md` — Phase 44 workstream: Part 1a marked shipping.
- `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` — the design contract (unchanged this PR; already on `main` via #863).

### Next

Part 1b — `lib/entity-graph/validityMatrix.ts` + `queries.ts` + `entityRelationshipService.ts` (the §6 grammar + the §8.4 centralised SSOT engine; repoint calculations off `parentEntityId`).
