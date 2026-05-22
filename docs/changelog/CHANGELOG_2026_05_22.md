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

---

## Session: Phase 44 Part 1b-i — Entity-graph rules engine

Branch: `claude/phase-44-part-1b-validity-engine-MG8mr`

### Changes Made

- **Type**: Feature — Phase 44 Part 1b-i, the centralised entity-graph rules engine.
- **Scope**: New pure-function layer `lib/entity-graph/` + a test suite. No I/O, no API, no UI, no tax-engine change — the design contract §8.3 requires Part 1 to add zero calculation logic.
- **Design contract**: `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` §6 (the validity grammar), §8.4 (the SSOT architecture).

Part 1b in the design doc is "centralised rules engine + service layer + repoint calculations off `parentEntityId`". It is split into two reviewable PRs: **1b-i (this PR)** — the pure rules engine; **1b-ii (next)** — the DB-writing service layer. The pure engine has zero runtime risk and is the well-specified core of §6 / §8.4.

### Files Created

- `lib/entity-graph/types.ts` — the in-memory graph representation (`EntityGraph`, `GraphNode`, `GraphEdge`), the node-type group predicates the §6 grammar is written in, the §6.1 issue/state types, and the `isEdgeActiveAt` time-bounding helper. Leaf module — no intra-package dependency, so `queries` + `validityMatrix` import it without a cycle.
- `lib/entity-graph/queries.ts` — pure graph traversal (SSOT, §8.4). `getTrusteesOf` (the canonical replacement for the frozen `LegalEntity.parentEntityId` self-FK, §10), `getControllersOf`, `getOwnershipChain`, `findTrusteeCycle` / `findOwnershipCycles` (§6.5), `isAssociateOf` (a structural Div 7A input — the authoritative s318 test stays in the tax engine), `resolveBeneficialOwner` (§3A asset-scoped beneficial ownership).
- `lib/entity-graph/validityMatrix.ts` — the §6 grammar (SSOT, §8.4). `classifyEdge` (§6.2 edge legality), `classifyEntity` (§6.3 SMSF rules + §6.4 entity validity), `classifyGraph` (whole-graph classification + §6.5 cycle folding). Implements the §6.1 three-state model: only `IMPOSSIBLE_SYSTEM_ERROR` is rejected; legal non-compliance is recorded and flagged (`NON_COMPLIANT_BUT_RECORDED`), never erased (§9).
- `tests/entity-graph/validityMatrix.test.ts` — 21 tests encoding the §14.1 combination-completeness acceptance cases (single-/multi-member SMSF, LPR exceptions, 7-member SMSF, partnership of two trusts, company limited by guarantee, nominee beneficial ownership, circular cross-shareholding) plus edge-legality and traversal coverage.

### `parentEntityId` repoint — finding

The §11 Part 1b task "repoint calculations off `parentEntityId`": a grep of `app/`, `lib/`, `components/` shows **no `lib/calculations/` engine reads `parentEntityId`**. The only "calculation" reader is the tax-entity route (`app/api/tax/entity/[entityId]/route.ts`), which populates `EntityTaxFacts.parentEntityId`. Per §11 ("Part 1 does NOT touch the tax engine") that repoint belongs to Part 2's tax-engine audit + rewire. `getTrusteesOf()` is in place as the canonical replacement query for when that rewire happens.

### §12.11 / §12.12 / §12.14

- §12.11 — N/A. No Prisma writes in this PR (pure functions only).
- §12.12 — N/A. No `prisma/schema.prisma` change.
- §12.14 — N/A. No `lib/tax-engine/` change, no financial calculation, no schema column, no AI tool, no per-asset tax UI. The rules engine classifies *structure*; it computes no tax.

### Build Status

- [x] `npx tsc --noEmit` — clean.
- [x] `npm run build` — passes.
- [x] `npx vitest run tests/entity-graph` — 21/21 passing.

### Documentation Updated

- `docs/architecture/01_ARCHITECTURE_OVERVIEW.md` — §13.1 new subsection "The entity-graph rules engine — `lib/entity-graph/`".
- `docs/IMPLEMENTATION_PLAN.md` — Phase 44 workstream: Part 1a → ✅ MERGED; Part 1b split into 1b-i (shipping) + 1b-ii; status → 🟢 BUILDING.
- `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` — §11 build-sequence annotated with the 1b-i / 1b-ii split.

### Next

Part 1b-ii — `lib/services/entityRelationshipService.ts` (the only writer of `EntityRelationship`; calls `validityMatrix` inside the write transaction; audited) + the `OwnershipGroup`/`OwnershipStake` and `BeneficialOwnershipOverride` services.

---

## Session: Phase 44 Part 1b-ii — Entity-graph service layer

Branch: `claude/phase-44-part-1b-ii-service-MG8mr`

### Changes Made

- **Type**: Feature — Phase 44 Part 1b-ii, the DB-writing service layer for the typed entity graph.
- **Scope**: Three new canonical services in `lib/services/` — the sole writers of `EntityRelationship`, `OwnershipGroup`/`OwnershipStake`, and `BeneficialOwnershipOverride`. No tax / financial arithmetic (§8.3). No API routes / UI (those are Part 1c).
- **Design contract**: `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` §8.4 (the SSOT service layer), §6 (the validity grammar the relationship service enforces at write time).

### Files Created

- `lib/services/entityRelationshipService.ts` — the only writer of `EntityRelationship`. `loadEntityGraph` (Prisma rows → the pure `EntityGraph` the rules engine consumes), `createRelationship` / `endRelationship` / `deleteRelationship`, `listRelationships`. Every write runs in one transaction: ownership-checked (both entities belong to the user), duplicate-guarded (no overlapping `[from, to, type]` window — schema §7 note), classified by `validityMatrix` (an `IMPOSSIBLE_SYSTEM_ERROR` edge is rejected via `RelationshipValidationError`; a `NON_COMPLIANT` edge is recorded + flagged, never erased — §6.1, §9), structural state persisted to the edge and to every entity whose §6.1 state changed, then audited fire-and-forget.
- `lib/services/ownershipService.ts` — the only writer of `OwnershipGroup` / `OwnershipStake` (joint / shared ownership of an *asset*). `createOwnershipGroup` / `endOwnershipGroup` / `deleteOwnershipGroup`, `listOwnershipGroups`. Joint tenancy carries survivorship (not fractional ownership — §7). The pure `validateOwnershipStakes` helper surfaces data-quality warnings (TIC shares not summing to 100, etc.) without rejecting — digital-twin philosophy.
- `lib/services/beneficialOwnershipService.ts` — the only writer of `BeneficialOwnershipOverride` — asset-scoped "legal title ≠ beneficial owner" (nominee / bare trust / custodian, §3A).
- `tests/entity-graph/serviceHelpers.test.ts` — 9 tests for the pure helpers (`windowsOverlap` duplicate-edge guard; `validateOwnershipStakes`). The DB-touching write paths are integration-tested elsewhere (no database in the unit-test environment — repo convention).

### §12.11 Destructive-write checklist

This PR contains destructive Prisma writes — all guarded; **user confirmation NOT REQUIRED** (reasoning below).

| Operation | `where` clause | Columns / rows touched | Guard |
|---|---|---|---|
| `entityRelationship.update` (`endRelationship`) | `{ id, userId }` (primary key + tenancy) | `effectiveTo` only — the normal time-bound close | composite `where` + `findFirst` existence check; new Part-1a model; the service is the sole writer |
| `entityRelationship.delete` (`deleteRelationship`) | `{ id, userId }` | one edge row | composite `where` + `findFirst` |
| `legalEntity.update` (`reconcileEntityStates`) | `{ id, userId }` | **`structuralState` only** — a system-derived §6.1 classification owned exclusively by the validity engine; never user-entered data | composite `where`; the column is system-owned, written only with the freshly-computed classification |
| `ownershipGroup.update` / `.delete` | `{ id, userId }` | `effectiveTo` / one group row (stakes cascade) | composite `where` + `findFirst`; new Part-1a model |
| `beneficialOwnershipOverride.update` / `.delete` | `{ id, userId }` | `effectiveTo` / one override row | composite `where` + `findFirst`; new Part-1a model |

1. **`where` clause matches:** only the caller's own row, identified by primary `id` scoped to `userId`. Nothing else can match.
2. **Columns overwritten:** `effectiveTo` (the lifecycle close) and `structuralState` (system-derived). None holds user-entered financial / verified data.
3. **Guard:** composite `{ id, userId }` `where` on every write + a `findFirst` existence check; these services are the sole writers of their models (§8.4).

User confirmation: **NOT REQUIRED** — every write is PK-scoped to the caller's own data and overwrites only lifecycle / system-derived columns.

### §12.12 / §12.14

- §12.12 — N/A. No `prisma/schema.prisma` change.
- §12.14 — N/A. No `lib/tax-engine/` change, no financial calculation, no schema column, no AI tool, no per-asset tax UI.

### Build Status

- [x] `npx tsc --noEmit` — clean.
- [x] `npm run build` — passes.
- [x] `npx vitest run tests/entity-graph` — 30/30 passing (21 rules-engine + 9 service-helper).

### Documentation Updated

- `docs/architecture/01_ARCHITECTURE_OVERVIEW.md` — §13.1 new subsection "The entity-graph service layer — Phase 44 Part 1b-ii".
- `docs/IMPLEMENTATION_PLAN.md` — Phase 44: Part 1b-i → ✅ MERGED (#865); Part 1b-ii → 🟡 SHIPPING.
- `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` — §11 build-progress updated.

### Next

Part 1c — entity-section UI (the multi-edge, multi-lens entity-structure canvas, §11A) + the API routes that expose these services + the accountant-review share-pass.

---

## Session: Phase 44 Part 1c — Entity-section UI (the entity-structure canvas)

Branch: `claude/phase-44-part-1c-entity-canvas-ONspp`

### Changes Made

- **Type**: Feature (UI + API routes) — Phase 44 Part 1c, the §11A entity-structure canvas + the routes exposing the Part 1b-ii service layer.
- **Scope**: `components/entities/*` (the canvas + dialogs), `app/api/entities/*` (7 new route surfaces), `app/dashboard/entities/*` (page rewire + the accountant-review report), the two graph-write service files (one read + one verify function each).
- **Design contract**: `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` §11A (canvas), §3A / §6.1 (lenses + badges), §9 (accountant-review share-pass), §7 / Q1 (joint ownership), §8.3 / §8.4 (presentational-only SSOT rule).
- **Library**: React Flow (`@xyflow/react` 12.10.2) + `@dagrejs/dagre` 3.0.0 — choice presented and **confirmed with Reza** before build. Both pure client-side, MIT, 0 critical / 0 high `npm audit` findings; added to the §13.8 dependency surface.

Built in four reviewable sub-parts on the one designated branch:

- **1c-i — API routes.** `GET /api/entities/graph` (the canvas-ready graph in one round-trip); `/relationships` + `/relationships/[id]` (create / end / delete); `/ownership-groups` + `/ownership-groups/[id]` (Q1); `/beneficial-ownership` + `/beneficial-ownership/[id]`. Thin handlers, `withPermission()`-gated, input validated at the boundary; every graph write goes through the canonical services. Added `getEntityGraphView()` to `entityRelationshipService`.
- **1c-ii — the canvas.** `EntityCanvas` — Control / Ownership / Money-flow / All lens toggle; role-coloured Apple-glass boxes (own node component, `EntityCanvasNode`); §6.1 three-state badges; layered dagre auto-layout + localStorage-persisted manual nudge; click-through `EntityDetailDialog` (lists every relationship, add / end / delete, live `classifyEdge` validity preview) + `RelationshipDetailDialog`. The money-flow lens folds in the existing `MoneyFlowSankey` — the separate Money Flow tab is removed from `/dashboard/entities`.
- **1c-iii — joint-ownership UI (Q1).** `OwnershipGroupsDialog` — records joint tenancy (survivorship) vs tenants-in-common (fixed shares, live 100% total) for any owned object, any co-owner count.
- **1c-iv — accountant-review share-pass (Q4).** `/dashboard/entities/accountant-review` — a print-friendly structure report with per-entity / per-relationship verify toggles + a verification-progress meter + an accountant sign-off block; `POST .../verify` routes + the `set*AccountantVerified` service writers. The `SharePackage` *pattern* (an owner-controlled export), deliberately not a public token link (§9 — the entity structure is CDR-adjacent).

### Files Modified / Created

- `lib/services/entityRelationshipService.ts` — `getEntityGraphView()` (canvas read) + `setRelationshipAccountantVerified()`.
- `lib/services/legalEntityService.ts` — `setEntityAccountantVerified()`.
- `app/api/entities/graph/route.ts`, `relationships/route.ts`, `relationships/[id]/route.ts`, `relationships/[id]/verify/route.ts`, `[id]/verify/route.ts`, `ownership-groups/route.ts`, `ownership-groups/[id]/route.ts`, `beneficial-ownership/route.ts`, `beneficial-ownership/[id]/route.ts` — new.
- `components/entities/EntityCanvas.tsx`, `EntityDetailDialog.tsx`, `RelationshipDetailDialog.tsx`, `OwnershipGroupsDialog.tsx`, `canvas/{graphMeta,layout,entityGraphClient,EntityCanvasNode}.{ts,tsx}` — new.
- `app/dashboard/entities/page.tsx` — rewired to render `EntityCanvas` (was `EntityTree`); Money Flow tab removed; joint-ownership + accountant-review entry points added.
- `app/dashboard/entities/accountant-review/page.tsx` — new.
- `tests/entity-graph/canvasMeta.test.ts` — 12 new tests (lens filter, dagre layout, error parsing).
- `EntityTree.tsx` / `MoneyFlowSankey.tsx` — retained (still used by the accountant portal client view + other surfaces); not dead code.

### Destructive-write checklist (CLAUDE.md §12.11)

Operations in this PR that touch existing rows:
- `entityRelationshipService.ts` `setRelationshipAccountantVerified` — `prisma.entityRelationship.update`
- `legalEntityService.ts` `setEntityAccountantVerified` — `prisma.legalEntity.update`

1. **`where` clause matches:** exactly one row — composite `{ id, userId }`; `id` is the `@id`. Nothing else can match.
2. **Columns overwritten:** `accountantVerified` (and `verifiedAt` on the edge) — system-owned provenance fields, never user-entered financial data.
3. **Guard:** composite `{ id, userId }` `where` on every write, preceded by a `findFirst` existence check; both columns are owned exclusively by the verify code path.

User confirmation: **NOT REQUIRED** — provenance flags only, no user data at risk; same justification as the existing 1b-ii `structuralState` write.

### §12.12 / §12.14

- §12.12 — N/A. No `prisma/schema.prisma` change (Part 1c is UI + routes; `parentEntityId` stays frozen).
- §12.14 — N/A. No `lib/tax-engine/` change, no financial calculation, no schema column, no AI tool. The canvas/accountant-review surfaces display structural state — not a per-asset tax position — so FW-5 does not apply.

### Build Status

- [x] `npx tsc --noEmit` — clean.
- [x] `npm run build` — passes (✓ Compiled successfully; all 9 new routes + the accountant-review page registered).
- [x] `npx vitest run tests/entity-graph` — 42/42 passing (21 rules-engine + 9 service-helper + 12 new canvas).
- [x] `npm audit --audit-level=critical` — 0 critical (the 2 pre-existing `xlsx` high findings are unrelated; React Flow + dagre add none).
- Full `vitest run`: 1663 passing; 58 pre-existing failures across 7 DB-integration / JSX-runtime test files unrelated to Part 1c (`npm install` added only new packages — no test-tooling version shifted).

### Documentation Updated

- `docs/architecture/07_API_STANDARDS.md` — new §15.9 "Phase 44 entity-graph routes".
- `docs/architecture/06_UI_UX_FOUNDATION.md` — new "Entity-structure canvas" section.
- `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` — §11 1c build-progress note.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 44: Part 1b-ii → ✅ MERGED (#866); Part 1c → 🟡 SHIPPING.

### Next

Part 1d — the onboarding wizard relationship sub-step.

---

## Session: fix(tooling) — vercel-logs.sh runtime command (streaming endpoint)

Branch: `claude/fix-vercel-logs-runtime-ndjson-ONspp`

### Changes Made

- **Type**: Fix (tooling) — the live-production-monitoring helper script.
- **Scope**: `scripts/vercel-logs.sh` — the `runtime` / `latest-runtime` commands.
- **Root cause**: surfaced during the Phase 44 Part 1c (PR #867) post-merge §17.2 verification. `./scripts/vercel-logs.sh latest-runtime` failed with `jq: Cannot index string with string "timestampInMs"`. The Vercel `/v1/.../runtime-logs` endpoint **streams NDJSON** (one JSON object per line) and holds the connection open — it does not return a finite JSON array. The script (a) parsed it as an array (`jq '.[]'`) — `.[]` on a per-line object iterates its *values*, so the next `.timestampInMs` hit a string; and (b) had no `--max-time`, so against a real stream it would hang. The command only ever "returned" because `jq` crashed early and killed the pipe.
- **Solution**: `curl_api` gained an optional leading `--max-time <seconds>`. The `runtime` command now calls it with `--max-time 25` (curl exit 28 on timeout is expected + benign — `|| true` keeps `set -e` happy; the partial body is kept), processes each NDJSON line **directly** (no `.[]`), and reports a friendly "no runtime logs" message when the window is empty.

### Files Modified

- `scripts/vercel-logs.sh` — `curl_api` optional `--max-time`; the `runtime` command rewritten for the streaming NDJSON shape.
- `docs/operational/runbooks/12_CLAUDE_CODE_MCP_SETUP.md` — "Plan-related retention caveats" updated: documents the streaming behaviour, the ~25 s bounded read, and the benign `curl (28)` notice (CLAUDE.md §16.3 — operational lesson → runbook).

### Build Status

- [x] `bash -n scripts/vercel-logs.sh` — syntax clean.
- [x] `jq` filter unit-tested with sample NDJSON (2 lines → 2 aligned rows) and an empty body (→ "no logs" message).
- [x] `./scripts/vercel-logs.sh runtime dpl_37wjGEos2FjGAEg6Nr1TJWAFXoE9` — runs, bounds at 25 s, reports the empty window cleanly (exit 0). This also completed the PR #867 §17.2 post-merge runtime-log check: the production deploy has no runtime errors.

### Documentation Updated

- `docs/operational/runbooks/12_CLAUDE_CODE_MCP_SETUP.md` — see above.

---

## Session: Phase 44 Part 1d — Onboarding relationship-skeleton step

Branch: `claude/phase-44-part-1d-wizard-relationships-ONspp`

### Changes Made

- **Type**: Feature (onboarding) — Phase 44 Part 1d, the §11 relationship sub-step.
- **Scope**: the onboarding wizard — a new optional step + the data model + the commit-time sync.
- **Design contract**: `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` §11 (Part 1d), Q3 (working-graph skeleton, refined in the entity section). Capture depth — control + ownership edges — confirmed with Reza this session.

Phase 41b's `EntitiesStep` captured entities + exactly one edge (`parentEntityTempId`, the trustee link). Part 1d adds the relationship layer: a new wizard step that sketches the load-bearing edges of the user's structure, persisted via the Part 1c `/api/entities/relationships` route.

### Files Modified / Created

- `components/onboarding/wizard/types.ts` — `WizardStepId` += `entity-relationships`; new `entity-relationships` entry in `WIZARD_STEPS`; `WizardRelationshipType` + `RelationshipInput` types; `WizardData.relationships` + `INITIAL_WIZARD_DATA`; `getStepsForProfile` gains `hasStructureEntities` context and the conditional gate for the new step.
- `components/onboarding/wizard/steps/RelationshipsStep.tsx` — new. Per non-personal entity, a collapsed card with the load-bearing roles for that type (directors + shareholders, trustee + beneficiaries/unitholders, members + trustee, partners, sole-trader operator) via toggle-chip pickers. Pre-seeds `TRUSTEE_OF` from `parentEntityTempId`. Optional + finishable later; Continue never blocked.
- `lib/onboarding/relationshipsSync.ts` — new. Persists the skeleton via the Part 1c route; idempotent (`DUPLICATE_EDGE` → skipped); best-effort (never throws — onboarding must not trap the user).
- `components/onboarding/wizard/WizardContainer.tsx` — `hasStructureEntities` added to the `getStepsForProfile` context; `renderStepContent` case for the new step.
- `tests/onboarding/relationshipSkeleton.test.ts` — new. 9 tests (step gate + sync behaviour).

### §12.11 / §12.12 / §12.14

- §12.11 — N/A. No Prisma writes in this PR; the wizard persists via the Part 1c route → `entityRelationshipService` (already §12.11-reviewed in PR #867).
- §12.12 — N/A. No `prisma/schema.prisma` change.
- §12.14 — N/A. No `lib/tax-engine/` change, no financial calculation, no schema column, no AI tool, no per-asset tax UI.

### Build Status

- [x] `npx tsc --noEmit` — clean.
- [x] `npm run build` — passes (✓ Compiled successfully).
- [x] `npx vitest run tests/onboarding` — 154/154 passing (12 files — the 11 existing sync tests + the new relationship-skeleton test, no regressions).

### Documentation Updated

- `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` — §11 Part 1d build-progress note (Part 1 of Phase 44 now complete).
- `docs/IMPLEMENTATION_PLAN.md` — Phase 44: Part 1c → ✅ MERGED (#867); Part 1d → 🟡 SHIPPING; status → Part 1 complete.

### Next

Part 2 — money-flow + tax-engine rewire (a separate, higher-legal-risk design pass; opens with a full tax-engine audit).

---

## Session: Phase 44 Part 2 — design pass (tax-engine audit + design document)

Branch: `claude/phase-44-part-2-design-ONspp`

### Changes Made

- **Type**: Design (no code) — Phase 44 Part 2, the money-flow + tax-engine-rewire design pass.
- **Scope**: a new design document + doc-sync. No code, no schema — Part 2 is review-gated; build begins only after Reza review (+ an external second-eye review).
- **Design contract**: `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` §11 ("Part 2 … opens with a full tax-engine audit … captured in its own design document").

The Part 2 design pass was run as architect-mode work: a full audit of all 45 `lib/tax-engine/` modules (deep reads of the orchestrator, entity router, the `/api/tax/entity` route, `types.ts`, `trustMinimumTax`; an Explore-agent catalog of the rest).

**Central audit finding:** the tax engine is already a mature, pure, citation-traced computation library — every rule module is built and correct for current law. The gap is *not* the engine; it is the **data layer**. Trust-distribution / Div 7A / SMSF dispatch data reaches the engine today only through a `curl` POST request body (`POST /api/tax/entity/[entityId]`); nothing persists or derives it, so `GET` returns `UNCOMPUTED` for every trust / company / SMSF. `parentEntityId` is confirmed already inert for tax (no engine module reads `facts.parentEntityId`).

So Part 2 is a **data-layer build, not an engine rewrite**: four new "what actually happened" models + a canonical fact-assembler + a repoint of the tax route. The engine's compute logic is not modified (CLAUDE.md §8.3 / PHASE_44 §8.3 holds) — with one honestly-flagged exception surfaced for Reza's decision (`super/smsfIncomeTax.ts` — there is no SMSF fund-earnings income-tax module today; the engine is *incomplete* there, not being duplicated).

### Files Created / Modified

- `docs/blueprint/PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` — **new**. The Part 2 design contract: §2 the 45-module audit; §3 architecture; §4 the four new models (`DistributionResolution`, `DividendDistribution`, `PrivateCompanyBenefit`, structured `TrustDeedRule`) with Prisma sketches; §5 model services; §6 the `entityTaxFactsAssembler` + repoint plan; §7 correctness gaps needing decisions; §8 the SSOT / one-engine commitment; §9 §12.14 reform-interaction; §10 the 2a–2d build sequence; §11 open questions; §12 risks.
- `docs/blueprint/PHASE_44_ENTITY_GRAPH.md` — §11 Part 2 build-progress note pointing to the design doc.
- `docs/IMPLEMENTATION_PLAN.md` — Part 2 → 🟡 DESIGN PASS (design doc under review).

### CLAUDE.md alignment (verified before documenting — per Reza directive)

- §0 advisory mindset — the doc leads with the architect + financial-adviser lenses (correct for a tax-engine design): SSOT, one-engine, every number traceable, `UNCOMPUTED`-not-false-numbers.
- §8.3 / §12.2–§12.3 SSOT — the doc commits to one tax engine, one fact-assembler, one writer per model; the §8.3 tension (the proposed `smsfIncomeTax.ts`) is surfaced explicitly as a flagged Open Question, not assumed.
- §10 research-before-action — the doc *is* the audit; every finding is grounded in actual file reads.
- §12.12 — Part 2a will carry the migration; noted in the build sequence.
- §12.14 — §9 of the doc; Part 2 never flips a reform commencement flag (FW-2).
- §13 CDR — §12 of the doc; the new models hold financial amounts → sanitised metadata + §12.11 discipline on the writers.

### §12.11 / §12.12 / §12.14

- All N/A for this PR — it is a design document only. No Prisma, no schema, no code. Part 2a will carry the schema + migration + the §12.14 block.

### Build Status

- No code — `tsc` / `build` / `tests` unaffected. Doc-only PR.

### Documentation Updated

- `docs/blueprint/PHASE_44_ENTITY_GRAPH.md`, `docs/IMPLEMENTATION_PLAN.md` — see above.

### Next

Reza review of `PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` (+ an external second-eye review). Part 2a (schema) begins only after approval.

### Update — Part 2 design doc v2 (external law review incorporated)

The Part 2 design document was put through an external Australian-tax-law conformance review (ChatGPT, scoped strictly to law — not design). 23 findings returned; **only the law-alignment findings were adopted**, each translated into the doc by the Monitrax architect against the actual codebase — no technical/design direction taken from the review (per Reza directive).

Net effect — no structural change (the central finding stood: engine built, gap is the data layer); the review's value was law precision. Changes folded into `PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` v2:

- The "built + correct" overclaim softened throughout — the doc now states the engine *exists and dispatches*, never that it is *certified legally correct* (F1, F11).
- New §7.1 engine law-precision gaps with `UNCOMPUTED` gates: G-S99 (s99 vs s99A), G-DIV7A (non-loan limbs), G-UPE (the TD 2022/11 vs *Bendel* contest — engine never auto-deems a UPE a Div 7A dividend), G-PARTNERSHIP, G-RESIDENCY, G-ASSETSRC.
- Law-precision notes added to §4.1 (Bamford proportionate model; streaming = deed power + specific entitlement, Subdiv 115-C/207-B; trust-type mechanics), §4.2 (Div 207 imputation), §4.3 (Div 7A breadth + the UPE contest).
- §5 — assembler/engine returns `UNCOMPUTED` on inconsistent allocation shares (the service still records — digital twin).
- §6.4 — the money-flow lens labelled "entitlements & declared distributions", not cash.
- New §13 records the review + a full F1–F23 disposition table.
- New open questions: Q-UPE, Q-PARTNERSHIP, Q-DISTINCOME, Q-RESOLUTION-AMEND.

`PHASE_44_ENTITY_GRAPH.md` §11 + `IMPLEMENTATION_PLAN.md` updated to reflect v2. PR #870 carries the revision; build of Part 2a remains blocked on Reza's approval of the v2 doc.

---

## Session: Phase 44 Part 2a — money-flow & transactions schema

Branch: `claude/phase-44-part-2a-schema-ONspp`

### Changes Made

- **Type**: Feature (schema) — Phase 44 Part 2a, the money-flow & transaction models.
- **Scope**: `prisma/schema.prisma` + a new migration. Pure data layer — no service / API / engine code in this PR.
- **Design contract**: `docs/blueprint/PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` §4 (the four models), §10 (build sequence — 2a's gate is the design-doc review, now merged via PR #870).

Part 2's central finding: the tax engine is built; the gap is the data layer. Part 2a is that data layer's foundation — the persisted "what actually happened" models the Part 2c fact-assembler will feed to the engine.

### Schema additions (`prisma/schema.prisma`)

- **6 new models**: `DistributionResolution` + `DistributionAllocation` (trust per-FY resolution → `EntityTaxFacts.trustDistribution`; carries `trustNetIncome` (s 95) and `distributableIncome` (trust-law income) separately — the Bamford proportionate model); `DividendDistribution` + `DividendPayment` (actual company dividend + franking → Div 207 imputation); `PrivateCompanyBenefit` (Div 7A loan / payment / forgiveness / UPE / sub-trust); `TrustDeedRule` (structured deed-derived facts — the typed promotion of `TrustDeedExtractedRules`' JSON).
- **3 new enums**: `ResolutionStatus`, `PrivateCompanyBenefitType`, `TrustDeedRuleType`.
- **`User`**: 4 additive back-relations.
- Entity references are plain-string FKs validated by the service layer (the `BeneficialOwnershipOverride` precedent). All money / percentage fields `Decimal`.

### Migration

- `prisma/migrations/20260522100000_phase_44_part_2a_money_flow/migration.sql` — generated offline via `prisma migrate diff` (schema-to-schema; no dev-DB connection available in this environment — the SQL is exactly what `migrate dev` would emit). **Purely additive** — `CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX` / `ADD FOREIGN KEY` only. No `DROP`, no `ALTER ... DROP`, no `TRUNCATE`, no `ADD COLUMN NOT NULL` on an existing table.

### §12.11 / §12.12 / §12.14

- **§12.11** — N/A. No Prisma `update` / `upsert` / `delete` / `$executeRaw` in this PR. The migration is additive (new tables only) — the destructive-write checklist does not apply.
- **§12.12** — satisfied. `prisma/schema.prisma` changed *and* a matching migration folder is in the same PR. Additive — no destructive SQL.
- **§12.14** — Part 2 triggers §12.14 (it is the tax-engine workstream). 2a is **schema only** — no function, no financial calculation, no AI tool, no per-asset tax UI. FW-3: the new models are **standalone tables** — no column added to `Property` / `Investment` / `LegalEntity` — so the reform-grandfathering column question is N/A. Regime-awareness (FW-1) lands with the 2b/2c services + engine repoint, gated as the design doc §9 specifies.

### Build Status

- [x] `npx prisma validate` — schema valid.
- [x] `npx prisma generate` — client regenerated with the 6 new models.
- [x] `npx tsc --noEmit` — clean.

### Documentation Updated

- `docs/architecture/03_DATA_MODEL.md` — §3.10 new subsection "New models (Part 2a — money-flow & transactions)".
- `docs/blueprint/PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` — §10 build sequence: 2a marked built.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 44 Part 2 → 🟡 BUILDING; 2a → 🟡 SHIPPING; 2b–2d listed; 2c flagged blocked on the §11 open questions.

### Next

2b — the model service writers + API routes. 2c (the engine repoint) is **blocked** on Reza's answers to §11 Q-SMSF / Q-UPE / Q-PARTNERSHIP.

---

## Session: Phase 44 Part 2b — money-flow service layer + routes

Branch: `claude/phase-44-part-2b-services-ONspp`

### Changes Made

- **Type**: Feature (services + API) — Phase 44 Part 2b, the money-flow & transaction service layer.
- **Scope**: 4 new SSOT service writers + 8 thin API routes + tests. No engine code, no schema (Part 2a shipped the schema in PR #871).
- **Design contract**: `docs/blueprint/PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` §5.

### Files Created

- `lib/services/distributionResolutionService.ts` — the only writer of `DistributionResolution` / `DistributionAllocation`.
- `lib/services/dividendDistributionService.ts` — the only writer of `DividendDistribution` / `DividendPayment`.
- `lib/services/privateCompanyBenefitService.ts` — the only writer of `PrivateCompanyBenefit`.
- `lib/services/trustDeedRuleService.ts` — the only writer of `TrustDeedRule`.
- 8 routes under `app/api/tax/{distribution-resolutions,dividend-distributions,private-company-benefits,trust-deed-rules}` (collection + `[id]`).
- `tests/entity-graph/part2bServices.test.ts` — 9 data-quality tests.

Each service follows the Part 1b-ii pattern: the only writer of its model(s), audited via `logCRUD`, §12.11-compliant (composite `where`, `findFirst` guards on update/delete), no tax arithmetic (§8.3). Digital twin (§6.1): data-quality problems — allocation shares not summing to 100%, a payee not recorded as a shareholder, a beneficiary not in the graph, a recipient not a shareholder/associate — are RECORDED and returned as `warnings`, never rejected. Only entity-not-owned (and a company-equals-recipient self-reference) is hard-rejected. The pure data-quality checks (`allocationShareWarning`, `paymentSumWarning`, `isValidRuleValue`) are extracted as exported helpers and unit-tested.

### §12.11 / §12.12 / §12.14

- **§12.11** — the services contain `prisma.<model>.update` (status / `effectiveTo`) and `.delete`. Checklist:
  - `update` / `delete` operations: `distributionResolution.update` (status), `dividendDistribution.update` (status), `trustDeedRule.update` (`effectiveTo`); `.delete` on all four models.
  - **`where` clause matches:** exactly one row — composite `{ id, userId }`; `id` is `@id`. Each preceded by a `findFirst` existence check.
  - **Columns overwritten:** `status` (a DRAFT/CONFIRMED lifecycle enum) or `effectiveTo` (a lifecycle close) — never user-entered financial amounts.
  - **Guard:** composite `{ id, userId }` `where` + `findFirst`; these services are the sole writers of their models.
  - User confirmation: **NOT REQUIRED** — every write is PK-scoped to the caller's own row and touches only lifecycle columns; no financial data at risk.
- **§12.12** — N/A. No `prisma/schema.prisma` change (Part 2a shipped the schema).
- **§12.14** — 2b is service + route plumbing; no financial calculation, no tax-engine module, no AI tool, no per-asset tax UI. Regime-aware computation lands in 2c per design doc §9.

### Build Status

- [x] `npx tsc --noEmit` — clean.
- [x] `npm run build` — passes (✓ Compiled; all 8 new routes registered).
- [x] `npx vitest run tests/entity-graph/part2bServices.test.ts` — 9/9 passing.

### Documentation Updated

- `docs/architecture/07_API_STANDARDS.md` — new §15.10 (Phase 44 Part 2b money-flow routes).
- `docs/blueprint/PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` — §10: 2b marked built.
- `docs/IMPLEMENTATION_PLAN.md` — Part 2a → ✅ MERGED (#871); 2b → 🟡 SHIPPING.

### Next

2c — the `entityTaxFactsAssembler` + the tax-route repoint. **Blocked** on Reza's answers to §11 Q-SMSF / Q-UPE / Q-PARTNERSHIP.

---

## Session: Phase 44 Part 2c-i — SMSF fund-earnings income-tax module

Branch: `claude/phase-44-part-2c-i-smsf-income-tax-ONspp`

### Changes Made

- **Type**: Feature (tax engine) — Phase 44 Part 2c-i, the new SMSF fund-earnings income-tax module.
- **Scope**: one new `lib/tax-engine/super/` module + its wiring into `entityTaxRouter` + the `POST /api/tax/entity` testable surface. The §8.3 exception Reza explicitly approved (Q-SMSF).
- **Design contract**: `docs/blueprint/PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` §7.2 Q-SMSF, §10. 2c is split into 2c-i (this — the compute module, isolated for focused review) + 2c-ii (the assembler + route repoint).

The Part 2 audit found the tax engine had **no** SMSF fund-earnings income-tax module — it computed contribution caps + Div 293/296 + the SIS-compliance classifier, but not the fund's own income tax. An SMSF entity could therefore never return a real income-tax number. This module fills that gap. It is current law (not reform), and *completes* the one engine rather than duplicating one — the §8.3 exception.

### Files Created / Modified

- `lib/tax-engine/super/smsfIncomeTax.ts` — **new**. `calculateSmsfIncomeTax(input, config)`: a complying SMSF's taxable income at the 15% concessional rate (`ITAA 1997` Div 295); ECPI exemption (`s295-385`) on the retirement-phase proportion of non-NALI investment income; NALI at the top marginal rate (`s295-550`); non-complying funds at the top rate. Pure, deterministic.
- `lib/tax-engine/types.ts` — `EntityTaxFacts` gains an inlined `smsfIncomeTax?` dispatch field.
- `lib/tax-engine/entity/entityTaxRouter.ts` — the SMSF branch now fires when *any* SMSF dispatch input is present (cap-tracking, Div 293/296, or the new income tax), each computed independently; the income-tax result is merged into `result.smsfIncomeTax` with its citations + UNCOMPUTED.
- `app/api/tax/entity/[entityId]/route.ts` — `POST` accepts an `smsfIncomeTax` body (the testable surface until the 2c-ii assembler derives it for `GET`).
- `tests/tax-engine/smsfIncomeTax.test.ts` — **new**. 9 tests.

### Law-precision discipline (external review §13-F9)

- ECPI does **not** apply to assessable contributions or to NALI — both are taxed regardless of pension phase. The module enforces this: `contributionsTax` is always 15%; `naliTax` is always the top rate.
- **Honesty gate:** when a fund is in pension phase and the ECPI exempt proportion has not been supplied (no segregation data, no proportionate-method actuary's certificate), the investment-income tax is **`UNCOMPUTED`** (`tax: null`, `UC-SMSF-ECPI-PROPORTION`) — the exempt proportion is never guessed. Contributions + NALI tax (where ECPI never applies) are still shown.

### §12.11 / §12.12 / §12.14

- §12.11 — N/A. No Prisma writes; this is a pure compute module + wiring.
- §12.12 — N/A. No `prisma/schema.prisma` change.
- §12.14 — Part 2 triggers §12.14. `smsfIncomeTax.ts` is **current law**, not a reform measure — outcome (b): it does not produce a different number under the 2026-27 reform, so no `commencementVerified` gate applies. The module is a financial calculation in `lib/tax-engine/`; it is reform-neutral. No reform `commencementVerified` flag is read or flipped.

### Build Status

- [x] `npx tsc --noEmit` — clean.
- [x] `npm run build` — passes.
- [x] `npx vitest run tests/tax-engine/smsfIncomeTax.test.ts` — 9/9 passing.

### Documentation Updated

- `docs/blueprint/PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` — §10: 2c split into 2c-i (built) + 2c-ii.
- `docs/IMPLEMENTATION_PLAN.md` — open questions recorded as decided; 2c-i → 🟡 SHIPPING; 2c-ii listed.

### Next

2c-ii — the `entityTaxFactsAssembler` + the `GET /api/tax/entity` repoint + the `trustMinimumTax`→`TrustDeedRule` repoint.

---

## Session: Phase 44 Part 2c-ii — entity-tax-facts assembler + route repoint

Branch: `claude/phase-44-part-2c-ii-assembler-ONspp`

### Changes Made

- **Type**: Feature (service + API repoint) — Phase 44 Part 2c-ii, the canonical fact-assembler.
- **Scope**: one new SSOT service + the `GET /api/tax/entity` repoint + removal of the dead `parentEntityId` read. No new tax arithmetic — the assembler is pure data assembly (§8.3).
- **Design contract**: `docs/blueprint/PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` §6.

This is the step that makes the Part 2 rewire deliver its payoff: `GET /api/tax/entity` now returns **real per-entity tax numbers** instead of `UNCOMPUTED`.

### Files Created / Modified

- `lib/services/entityTaxFactsAssembler.ts` — **new**. `assembleEntityTaxFacts(userId, entityId, fy)` — the single SSOT for building `EntityTaxFacts`. Reads the entity's income/expense rows + the persisted Part 2 money-flow models, returns a fully-populated facts object. Pure mappers extracted + exported: `buildDiv7aLoansFromBenefits` (Q-UPE — only `LOAN` benefits become `div7aLoans`; `UPE`/`SUB_TRUST_ARRANGEMENT` excluded), `buildTrustDistribution`, `pickOperativeResolution` (latest `CONFIRMED` — never computes off a draft).
- `app/api/tax/entity/[entityId]/route.ts` — `GET` repointed to `assembleEntityTaxFacts`; the dead `parentEntityId` read removed from both `GET` + `POST`; the slice-C aggregator tree-shake hack removed.
- `lib/tax-engine/types.ts` — `EntityTaxFacts.parentEntityId` removed (confirmed inert for tax — no engine module read it; `tsc` clean after removal proves it).
- `tests/tax-engine/entityTaxFactsAssembler.test.ts` — **new**. 10 mapper tests.

### Decisions baked in

- **Q-UPE** — `buildDiv7aLoansFromBenefits` maps only `LOAN` benefits; `UPE` / `SUB_TRUST_ARRANGEMENT` rows are never passed to the engine (their Div 7A treatment is legally contested — the engine must not auto-deem a dividend).
- **Q-PARTNERSHIP** — the assembler does not build partnership attribution; partnerships stay `UNCOMPUTED` (a `PartnershipDistribution` follow-up later).

### Scope notes (honest deferrals)

- `trustMinimumTax` is a reform skeleton that does not yet read deed rules — the design's "repoint to `TrustDeedRule`" is a no-op until it leaves Stage 1 (post-Royal-Assent). The `TrustDeedRule` model + service are ready for it.
- `smsfIncomeTax` GET-feed is deferred — it needs pension-phase / ECPI facts not captured in any model yet (a follow-up). The module (2c-i) is reachable via `POST` today.

### §12.11 / §12.12 / §12.14

- §12.11 — N/A. No Prisma writes (the assembler is read-only; the route repoint adds no writes).
- §12.12 — N/A. No `prisma/schema.prisma` change.
- §12.14 — the assembler performs no financial calculation (pure data assembly); the engine it feeds is unchanged. No reform interaction.

### Build Status

- [x] `npx tsc --noEmit` — clean (removal of `EntityTaxFacts.parentEntityId` broke nothing — confirms it was inert).
- [x] `npm run build` — passes.
- [x] `npx vitest run tests/tax-engine/entityTaxFactsAssembler.test.ts` — 10/10 passing.

### Documentation Updated

- `docs/architecture/01_ARCHITECTURE_OVERVIEW.md` — §13.1 new subsection "The money-flow layer + the fact-assembler — Phase 44 Part 2".
- `docs/architecture/07_API_STANDARDS.md` — new §15.11 (the `/api/tax/entity` assembler repoint).
- `docs/blueprint/PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` — §10: 2c-ii marked built.
- `docs/IMPLEMENTATION_PLAN.md` — 2c-ii → 🟡 SHIPPING; 2d listed; Part 2 follow-ups recorded.

### Next

2d — the `MoneyFlowSankey` upgrade to actual entitlement flows. Part 2c (the tax-engine rewire) is complete.

---

## Session: Phase 44 Part 2d — Money Flow Sankey distributions upgrade

Branch: `claude/phase-44-part-2d-money-flow-ONspp`

### Changes Made

- **Type**: Feature (service + UI) — Phase 44 Part 2d, the money-flow Sankey upgrade.
- **Scope**: `getMoneyFlow()` gains a `Distributions` outflow column fed by the Part 2a money-flow models; the Sankey + the consumer wrapper render it. No tax arithmetic — distribution amounts are read straight off `CONFIRMED` resolutions/dividends; the per-recipient split applies the recorded `presentlyEntitledShare` (Bamford proportionate). Not an engine change (§8.3 holds).
- **Design contract**: `docs/blueprint/PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` §6.4.

The §11A money-flow lens previously stopped at four heuristic outflows (Tax / Essential / Discretionary / Loan repayments) + Surplus. Part 2d adds a fifth — **Distributions** — so a trust that distributes to its beneficiaries, or a company that pays a dividend to its shareholders, shows that money actually leaving the source entity rather than landing in an overstated "Surplus".

### Files Created / Modified

- `lib/services/moneyFlowService.ts` — added the `Distributions` outflow label; `MoneyFlowDistribution` / `RawResolutionForFlow` / `RawDividendForFlow` types; the pure exported mapper `buildDistributionDetail()` (CONFIRMED resolutions + dividends → per-recipient detail); a `distributions` field on `MoneyFlowResult`. `getMoneyFlow()` now loads `distributionResolution` + `dividendDistribution` (CONFIRMED only) in the same `Promise.all`, aggregates per source entity, recomputes surplus net of distributions, and keeps a distributing trust/company's row even when it has no `Income` rows (warn-not-reject, CLAUDE.md §6.1).
- `components/entities/MoneyFlowSankey.tsx` — added the indigo `Distributions` outflow colour + legend swatch + headline chip; a per-recipient "Recorded distributions" detail list below the chart; an entitlement-not-cash caveat sentence (external law review §13-F22) shown when distributions are present.
- `components/bookkeeping/ConsumerMoneyFlowSankey.tsx` — `projectSnapshotToMoneyFlow()` updated for the widened `MoneyFlowResult` shape (`Distributions: 0` on the synthetic entity, `distributions: []`) — a consumer collapses to one entity, so there are no inter-entity distributions.
- `tests/entity-graph/moneyFlowDistribution.test.ts` — **new**. 6 tests pinning `buildDistributionDetail()`.

### Decisions baked in

- **CONFIRMED only.** `DRAFT` resolutions/dividends are working notes — they never feed the visual.
- **Trust column = `trustNetIncome` (s95).** Per-beneficiary amount = `presentlyEntitledShare × trustNetIncome` (Bamford proportionate model). Company column = the declared `totalAmount`; per-shareholder amounts are the recorded `DividendPayment.amount`.
- **`SuperContribution` (member → SMSF) deferred.** A super contribution is an entity → entity flow that risks double-counting against the member's income/surplus — it needs its own design pass (a Part 2 follow-up), not the `Distributions` column.

### §12.11 / §12.12 / §12.14

- §12.11 — N/A. No Prisma writes (`getMoneyFlow()` is read-only).
- §12.12 — N/A. No `prisma/schema.prisma` change (Part 2a shipped the models).
- §12.14 — N/A. No financial calculation: distribution amounts are read from the persisted models verbatim; the per-recipient split applies a recorded fraction. No tax-engine module touched, no reform interaction.

### Build Status

- [x] `npx tsc --noEmit` — clean.
- [x] `npm run build` — passes.
- [x] `npx vitest run tests/entity-graph/moneyFlowDistribution.test.ts tests/bookkeeping/consumerSankeyProjection.test.ts tests/entity-graph/part2bServices.test.ts` — 25/25 passing.

### Documentation Updated

- `docs/blueprint/PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` — §6.4 "as built" detail + the `SuperContribution` deferral; §10 build sequence: 2d marked built.
- `docs/IMPLEMENTATION_PLAN.md` — 2d → 🟡 SHIPPING; Part 2 status → build complete; Part 2 follow-ups updated with the `SuperContribution` limb.

### Next

Part 2 build is complete (2a–2d). Remaining: the non-blocking Part 2 follow-ups (`SuperContribution` money-flow limb, `smsfIncomeTax` GET-feed, `trustMinimumTax`→`TrustDeedRule` consumption, `PartnershipDistribution`, non-loan Div 7A limbs, `s99`, per-asset CGT-event assembly).
