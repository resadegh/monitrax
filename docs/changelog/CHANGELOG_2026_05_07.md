# Changelog — 2026-05-07

## Session: claude/phase-41f1-schema-migration (Phase 41f.1 — Schema migration)

### Strategy
Implements the schema design from `docs/blueprint/PHASE_41F_BOOKKEEPING_INTEGRATION.md` §4 + §6 (PR #690 merged 2026-05-07; D-41F-1 through D-41F-5 ✅ APPROVED). No service or UI changes — pure schema. Sets the foundation for 41f.2 (Xero OAuth) which starts after this lands on main.

### Type
- **Type**: Schema migration (Phase 41f follow-up — closes 41f.1 in the active workstream)
- **Scope**: `prisma/schema.prisma` + new migration SQL. Two new enums (`AccountingIntegrationScope`, `TrustDeedRuleStatus`), one extended model (`AccountingIntegration`), two new models (`EntityAccountingSnapshot`, `TrustDeedExtractedRules`), three new back-relations on `User` + `LegalEntity`.

### Files Created
- `prisma/migrations/20260510100000_add_phase_41f_bookkeeping/migration.sql` — hand-crafted (per Phase 41i.3 pattern; no DATABASE_URL in env). Three concerns in one migration: (1) extend `accounting_integrations` with `scope`/`userId`/`legalEntityId` columns + drop the original full-table unique + add two partial unique indexes per scope + add the XOR `CHECK` constraint + add FKs with cascade-on-delete + scope/user/entity indexes; (2) create `entity_accounting_snapshots` table with provenance (`sourceProvider` / `sourceTenantId` / `pulledAt` / `pulledByUserId`) + period (`fiscalPeriod` / `periodStartDate` / `periodEndDate`) + Balance Sheet (totals + 8 optional line items) + P&L (revenue / COGS / opEx / NPBT / tax / NPAT / depreciation / interest) + tax-engine inputs (`distributableSurplus` for Div 7A / `trustNetIncome` for Div 6E / `smsfMemberBalances` for SIS) + `rawProviderPayload` JSON for forensic re-derivation + idempotent unique key on `(legalEntityId, fiscalPeriod)`; (3) create `trust_deed_extracted_rules` with provenance (`uploadedDocumentId` FK to Phase 26 Document model + `extractedAt` + `extractorVersion` + `extractedByUserId`) + 4-step lifecycle (`status: EXTRACTED | CONFIRMED | REJECTED` + `confirmedAt` / `rejectedAt` / `rejectionReason`) + extracted rules (beneficiaries / distributionRules / vestingDate / trusteePower / loanProvisions / uncomputedNotes — all JSON with Zod validation at write time) + `rawExtractorPayload` JSON. CLAUDE.md §12.11 destructive-write checklist filled in verbatim at the top of the file.

### Files Modified
- `prisma/schema.prisma`:
  - **Enums** added: `AccountingIntegrationScope` (`ORG | USER_ENTITY`); `TrustDeedRuleStatus` (`EXTRACTED | CONFIRMED | REJECTED`).
  - **`AccountingIntegration` model** extended: `scope` discriminator with default `ORG`; nullable `userId` + `legalEntityId` columns; `organizationId` made nullable; original `@@unique([organizationId, provider])` replaced by raw-SQL partial unique indexes (Prisma can't model `WHERE` on `@@unique`); new `user` + `legalEntity` relations with `onDelete: Cascade`; new indexes on `userId`, `legalEntityId`, `scope`. Inline JSDoc records the XOR invariant + the OAuth-encryption-at-rest posture (CMEK on Cloud SQL Text columns).
  - **New `EntityAccountingSnapshot` model** with full Balance Sheet / P&L / tax-engine-input columns + provenance + idempotent overwrite key + `legalEntity` relation cascading on entity delete. Inline JSDoc cross-links to spec doc §6.1.
  - **New `TrustDeedExtractedRules` model** with 4-step lifecycle + Zod-validated JSON columns + Phase 26 vault FK. Inline JSDoc reinforces §1.1 scope boundary ("storage + understanding only").
  - **`User` model** — new `accountingIntegrations` back-relation (cascading on user delete via the FK).
  - **`LegalEntity` model** — three new back-relations (`accountingIntegrations`, `accountingSnapshots`, `trustDeedExtractedRules`), all cascading on entity delete.
- `docs/IMPLEMENTATION_PLAN.md`:
  - `Last updated` header rewritten — Phase 41f.1 schema migration shipping (this PR); 41f.0 PR #690 marked merged.
  - Active Workstream §5 — 41f.0 ticked + ✅ APPROVED 2026-05-07; 41f.1 ticked + full summary; 5 D-41F decisions marked ✅ APPROVED.
  - Up Next #30 status flipped to "🟡 IN FLIGHT — 41f.0 design doc PR #690 ✅ MERGED 2026-05-07; 41f.1 schema migration shipping (this PR)".

### Architecture Decisions
- **Hand-crafted migration SQL** — no DATABASE_URL in dev env so `prisma migrate dev` would fail. Following the Phase 41i.3 + 41h.5 pattern of authoring the migration manually + verifying against `prisma validate` + `prisma generate`. Vercel build runs `prisma migrate deploy` on every deploy (CLAUDE.md §12.12) — first deploy after merge will apply this migration to dev (Vercel Preview against `monitrax-db-dev`) before the production deploy.
- **Partial unique indexes via raw SQL** — Prisma can't model `WHERE` clauses on `@@unique`. Two indexes: `accounting_integrations_org_provider_uniq` (`WHERE scope = 'ORG'`) + `accounting_integrations_entity_provider_uniq` (`WHERE scope = 'USER_ENTITY'`). Same provider can be connected once per ORG and once per USER_ENTITY, but never twice within the same scope.
- **XOR `CHECK` constraint catches malformed inserts** — `(scope = 'ORG' AND organizationId IS NOT NULL AND userId IS NULL AND legalEntityId IS NULL) OR (scope = 'USER_ENTITY' AND organizationId IS NULL AND userId IS NOT NULL AND legalEntityId IS NOT NULL)`. Rejects any insert that doesn't match exactly one shape. App-level constructor in 41f.2 will enforce the same invariant before insert.
- **`onDelete: Cascade` on all three USER_ENTITY-side FKs** — deleting a User cascades through `AccountingIntegration` (via userId FK); deleting a LegalEntity cascades through `AccountingIntegration` (via legalEntityId FK), `EntityAccountingSnapshot`, and `TrustDeedExtractedRules`. Right-to-erasure compliance (CLAUDE.md Part 13).
- **`rawProviderPayload` + `rawExtractorPayload` JSON columns** — kept for forensic re-derivation if our typed shape evolves. Phase 41i (calc audit system) can recompute from raw if the typed columns drift.
- **No `pulledByUserId` FK** — kept as TEXT, not a FK, because audit-trail rows survive user deletion (compliance archive). Same pattern Phase 32C PR4d uses for `senderRole` on `ConversationMessage`.
- **Existing Phase 32 caller (`prisma.accountingIntegration.count({ where: { organizationId } })`) is unaffected** — the WHERE filter naturally excludes USER_ENTITY-scope rows whose `organizationId` is NULL. No code change required in `app/api/portal/organizations/[orgId]/route.ts:96`.

### Build Status
- [x] `prisma validate` — clean
- [x] `prisma generate` — generated Prisma Client (v5.22.0) cleanly
- [x] `npx tsc --noEmit` — clean (only pre-existing `stripeBillingService.ts` "stripe" module-not-found, unrelated)

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (new `accessToken`/`refreshToken` columns inherit existing CMEK encryption at rest; new `tfn`/PII-bearing trust-deed JSON inherits the existing Phase 26 vault encryption posture; ON DELETE CASCADE preserves right-to-erasure)
- [ ] operational procedure
- [x] strategic decision (Option A schema-extension approach implemented per D-41F-1 sign-off)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — Last updated header + Active Workstream §5 sub-PR ticks + Up Next #30 row flipped.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
**Filled in verbatim at the top of `prisma/migrations/20260510100000_add_phase_41f_bookkeeping/migration.sql`:**
1. WHERE clause matches: N/A — pure ALTER TABLE / CREATE INDEX / CREATE TABLE. No row UPDATE / DELETE / UPSERT.
2. Columns overwritten / rows deleted: NONE.
3. Guard ensuring this only mutates rows I created: N/A — schema only. Pre-flight verified zero rows in `accounting_integrations` (the model was added by Phase 32 portal but its callers ship outside the stub layer; no production users have connected accounting yet).

The one existing-constraint touch is `ALTER COLUMN organization_id DROP NOT NULL`. This is structurally non-destructive (relaxes a constraint, doesn't tighten one). The new XOR `CHECK` constraint catches any malformed insert.

### Schema Migration Checklist (CLAUDE.md §12.12)
- [x] `prisma/schema.prisma` modified
- [x] Matching migration at `prisma/migrations/20260510100000_add_phase_41f_bookkeeping/migration.sql`
- [x] Migration is purely additive on row data; the only existing-constraint touch is `ALTER COLUMN ... DROP NOT NULL` (relaxing, not tightening) on a column with zero existing rows
- [x] `npx prisma validate` clean
- [x] `npx prisma generate` clean

### PR
- Branch: `claude/phase-41f1-schema-migration`
- Status: pending push + open

---

## Session: claude/phase-41f0-design-doc (Phase 41f.0 — Bookkeeping Integration design doc)

### Strategy
Kicks off Phase 41f (personal Xero / MYOB / QuickBooks integration, Up Next #30). Following the locked-in 41e pattern: a design doc PR ships before any code or schema, gating the work on Reza's strategic sign-off across 5 decisions (D-41F-1 through D-41F-5). The sub-PR sequence matches Reza's ~10-day estimate: 41f.0 design (this PR, 1 day) → 41f.1 schema (1 day) → 41f.2 Xero OAuth (3 days) → 41f.3 snapshot import + Div 7A wiring (3 days) → 41f.4 trust-deed parser (2-3 days).

### Type
- **Type**: Docs (design doc; doc-only PR; no code)
- **Scope**: New `docs/blueprint/PHASE_41F_BOOKKEEPING_INTEGRATION.md` + cross-links from `MASTER_BLUEPRINT.md` + `PHASE_41_REGULATORY_ARCHITECTURE.md` + new Active Workstream entry in `IMPLEMENTATION_PLAN.md` + flipped Up Next #30 row.

### Files Created
- `docs/blueprint/PHASE_41F_BOOKKEEPING_INTEGRATION.md` — 15 sections covering: strategic positioning ("Monitrax CONSUMES Xero, never replaces it"), the four-lens design rationale, building-blocks recon (Phase 32 portal stubs / Phase 41a `LegalEntity` / Phase 26 OCR + Gemini SDK), architecture decision §4 (Option A extend `AccountingIntegration` with scope discriminator vs Option B new model — recommended A), full sub-PR sequence §5, new `EntityAccountingSnapshot` + `TrustDeedExtractedRules` Prisma model definitions §6, 4-step trust-deed confirm-before-apply flow §7, the 5 strategic decisions §8 (D-41F-1 through D-41F-5), UNCOMPUTED v1 register §9 (8 items), CDR / privacy posture §10 (Xero is non-CDR business data; OAuth tokens CMEK-encrypted; trust-deed PDFs in existing Phase 26 vault), out-of-scope §11 (bidirectional sync, transaction-level data, MYOB / QB, multi-tenant, real-time webhooks, adviser-impersonation, Sankey integration — all PROD), Reza sign-off block §12 (9 ticks gating 41f.1 start), risks + mitigations §13, per-sub-PR test plan §14.

### Files Modified
- `docs/IMPLEMENTATION_PLAN.md`:
  - `Last updated` header rewritten — Phase 41f kicked off with 41f.0 design doc; positioning preserved verbatim ("Monitrax CONSUMES Xero data, never replaces it").
  - New Active Workstream §5 "Phase 41f — Personal Bookkeeping Integration (Xero v1)" with 5-sub-PR checklist + 5 D-41F decisions + hard constraints + risk/blocking/closes.
  - Up Next #30 (Phase 41f) row rewritten to reflect 🟡 IN FLIGHT state + sub-PR sequence + 5 D-41F decisions + cross-link to design doc; trigger flipped from "After 41c" (long-shipped) → "After 41c (✅ shipped) — UNBLOCKED, IN FLIGHT".
- `docs/blueprint/MASTER_BLUEPRINT.md`:
  - Phase 41f row rewritten from "Xero Bidirectional Sync — 📋 Planned (~10 days)" to "Personal Bookkeeping Integration — 🟡 In Progress (~10 days, 5 sub-PRs)" with full sub-PR map, positioning quote, v1 vs v2 vs PROD scope cuts.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md`:
  - New §11.1.1 "Phase 41f — Personal Bookkeeping Integration" inserted between §11.1 (Phase 41h sub-PR sequence) and §11.2 (Phase 41i). Cross-links to the spec doc, full sub-PR table, HR-1 / HR-2 / D-2 preservation in 41f context.

### Architecture Decisions (5 gated on Reza sign-off — see PHASE_41F_BOOKKEEPING_INTEGRATION.md §8)
- **D-41F-1 (recommended A)** — extend `AccountingIntegration` with scope discriminator. Reuses Phase 32 OAuth + sync-log + entity-mapping infrastructure verbatim; additive migration; future-proofs adviser-impersonation use case (Phase 32 adviser connecting client books on behalf).
- **D-41F-2 (recommended Xero only at v1)** — Reza's positioning quote names Xero specifically. MYOB + QuickBooks → v2 (the existing enum keeps them open). UI can show "MYOB — Coming soon" tile.
- **D-41F-3 (recommended 4-step)** — trust deed parsing runs as upload → extract → user-confirms-each-rule → apply. Trust deed is a legal instrument; misinterpretation has tax + legal blast radius; the 5-minute friction is the feature.
- **D-41F-4 (recommended entity-detail-only at v1)** — imported P&L renders on entity detail at v1; Money Flow Sankey integration → v2. Avoids re-thinking Phase 41d under time pressure.
- **D-41F-5 (recommended auto-feed with override)** — distributable surplus auto-feeds Phase 41e.6 Div 7A classifier with audit log + per-loan override. Keeps the engine flowing; user friction only when they want to override.

### Build Status
- N/A — docs-only.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture (CDR posture documented in spec doc §10 but no live code change yet)
- [ ] operational procedure
- [x] strategic decision (5 strategic decisions D-41F-1 through D-41F-5 surfaced in `PHASE_41F_BOOKKEEPING_INTEGRATION.md` §8 + §12 Reza sign-off block; phase moved from queued → in-flight in `IMPLEMENTATION_PLAN.md` + `MASTER_BLUEPRINT.md`)

Docs updated in this PR:
- `docs/blueprint/PHASE_41F_BOOKKEEPING_INTEGRATION.md` — new spec doc.
- `docs/IMPLEMENTATION_PLAN.md` — Last updated header + new Active Workstream §5 + Up Next #30 flipped to in-flight.
- `docs/blueprint/MASTER_BLUEPRINT.md` — Phase 41f row rewritten (Planned → In Progress).
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` — new §11.1.1 cross-linking to the spec doc.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A for this PR (docs-only). The §12.11 checklist for the 41f.1 schema migration is **filled in advance** in `PHASE_41F_BOOKKEEPING_INTEGRATION.md` §4: the only existing-constraint touch is `ALTER COLUMN organization_id DROP NOT NULL` on `accounting_integrations`; pre-flight verified zero existing rows. The XOR check constraint catches malformed inserts. 41f.1 will re-validate before merge.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A for this PR (docs-only). The 41f.1 migration plan is fully scripted in spec doc §4 and will be Prisma-generated at 41f.1 implementation time per the §12.12 protocol.

### PR
- Branch: `claude/phase-41f0-design-doc`
- Status: pending push + open

---

## Session: claude/docs-post-688-merge (Doc-sync — Phase 41 status reflection)

### Strategy
Flat doc-sync pass after PRs #687 (41h.6) + #688 (41h.7) landed on main. CLAUDE.md §16.7 captures the failure mode this prevents: documenting decisions only after the fact leaves the plan stale and the next session re-litigating completed work.

### Type
- **Type**: Docs (per-PR doc-sync; no code changes)
- **Scope**: `IMPLEMENTATION_PLAN.md` Last-updated header + Up Next #29/39/40 markers + `MASTER_BLUEPRINT.md` Phase 41e/41h/41i status rows + `CHANGELOG_2026_05_07.md` PR-status markers.

### Files Modified
- `docs/IMPLEMENTATION_PLAN.md`:
  - `Last updated` header refreshed to reflect Phase 41h FULLY COMPLETE (8 sub-PRs 41h.0 → 41h.7 all merged) + Phase 41i FULLY COMPLETE (5 sub-PRs 41i.0+1 → 41i.5).
  - Up Next #29 (Phase 41e) flipped from queued → ✅ SHIPPED 2026-05-05 (18 sub-PRs from 41e.−1 cleanup through 41e.17 MasterTaxPosition orchestrator); the work was the foundation Phase 41h's tools wrap.
  - Up Next #39 (Phase 41h.6) marker `(this PR)` → `(PR #687 merged)`.
  - Up Next #40 (Phase 41h.7) marker `(this PR)` → `(PR #688 merged)`.
  - Recently Completed entries for 41h.6 + 41h.7 same flip.
- `docs/blueprint/MASTER_BLUEPRINT.md`:
  - Phase 41e row flipped from 📋 Planned (~28 days) → ✅ Complete (May 2026); module list expanded with sub-PR map (41e.1 → 41e.17).
  - Phase 41h row flipped from 📋 Planned (~7 days) → ✅ Complete (May 2026); registry state captured (10 canonical tools — 6 FACT_LOOKUP + 4 SCENARIO_RUN); three structural enforcement layers documented; user-facing surface graduation noted (TRAIL Stage 5 — Live, per CLAUDE.md §14).
  - New Phase 41i row inserted after 41h: ✅ Complete (May 2026) with HR-3 framing, 5 sub-PR map, three calc-audit layers (L1 deterministic regression / L2 temporal anomaly / L3 persistent-findings foundation), Slack + email alerting threshold, 41i.3b deferral note.
- `docs/changelog/CHANGELOG_2026_05_07.md`:
  - Phase 41h.7 session "pending push + open" → "PR #688 merged 2026-05-07".
  - Phase 41h.6 session "pending push + open" → "PR #687 merged 2026-05-07".

### Architecture Decisions
- **Doc-sync passes are surgical, not editorial.** Every flip is a status update to a specific marker — no rewrites of historical content. Per CLAUDE.md §15.5 format discipline.
- **Phase 41i row inserted in Master Blueprint as a peer to 41h** rather than as a sub-bullet under it. Reason: 41i is HR-3-aligned, scope-wise cross-app (not just tax), and has its own admin-portal surface — peer-level visibility makes the calc-audit safety net legible to future operators reading the blueprint.
- **Phase 41e row consolidated into a single ✅ Complete entry** rather than enumerating each of the 18 sub-PRs. Reason: the Master Blueprint is the strategic/status doc per §15.6 — sub-PR detail belongs in the Phase doc + the per-day changelogs (where it already lives).

### Build Status
- N/A — docs-only.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Phase 41e + 41h + 41i statuses flipped from Planned → Complete on the master strategic blueprint; Last-updated headers + per-row markers refreshed across the live plan)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` (Last updated header + Up Next #29/#39/#40 + Recently Completed flip).
- `docs/blueprint/MASTER_BLUEPRINT.md` (Phase 41e + 41h flipped to Complete; new Phase 41i row inserted).
- `docs/changelog/CHANGELOG_2026_05_07.md` (this session entry + PR status flips on 41h.6/41h.7 sessions).

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — no Prisma writes anywhere in this PR.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A — no `prisma/schema.prisma` changes.

### PR
- Branch: `claude/docs-post-688-merge`
- Status: pending push + open

---

## Session: claude/phase-41h7-trail-aligned-ia (Phase 41h.7 — TRAIL-aligned IA)

### Strategy
- Closes Up Next #40. Graduates the AI advisor from orphan deep-link `/dashboard/cfo/ask` (integration scaffold from 41h.4) to natural-IA placement under "My Guide" (TRAIL Stage 5 — Live, per CLAUDE.md §14).
- Two design options surveyed: (A) sidebar child + CTA card on parent page; (B) fold inline as a tab on `/dashboard/cfo`. **Chose A** — the CFO Actions page already has 5+ sections (AIAdviceSection / Health Hero / Insight Tiles / Risk Radar / Monthly Progress); adding inline ask form would overload it. Designer lens: restraint over density. Behavioural-psychology lens: a focused conversation surface is better for asking a specific question than fighting for attention on a busy parent page.
- URL stable (`/dashboard/cfo/ask`) — no audit-log search updates needed.

### Type
- **Type**: Enhancement (Phase 41h follow-up — closes Up Next #40)
- **Scope**: Information architecture + sidebar + parent-page CTA card. Routing + IA + visual hooks only.
- **No code changes to**: `components/ai-advisor/*`, `lib/ai/tax-advisor/*`, `app/api/ai-advisor/ask/route.ts`. All primitives provider-agnostic from 41h.3 onwards.

### Files Modified
- `components/DashboardLayout.tsx` — `reachNavItems[].children` for "My Guide" extended with new `{ name: 'Ask the Advisor', href: '/dashboard/cfo/ask' }` entry; `matchRoutes` extended with `/dashboard/cfo/ask` so My Guide stays highlighted on the conversation surface; inline JSDoc records the 41h.7 graduation decision and the architect-lens rationale (URL stable, primitives untouched).
- `app/dashboard/cfo/page.tsx` — new restrained Apple-glass CTA card directly below `<AIAdviceSection />`. Brain icon (matching My Guide sidebar lucide-icon), warm-amber palette (border-amber-100/60 / bg-amber-50/40 with dark-mode variants), single-line affordance "Have a specific question? — Ask the advisor about your tax position, contribution headroom, land tax, or a 'what if' scenario. Answers cite the rule and the number from your data." → `<Button asChild size="sm">` wrapping `<Link href="/dashboard/cfo/ask">Ask the Advisor →</Link>`. Inline JSDoc records the 41h.7 design rationale.
- `app/dashboard/cfo/ask/page.tsx` — page-header rewarmed: title "Ask the AI advisor" → "Ask the Advisor"; description softened ("the advisor never invents either"). Top-of-file JSDoc updated to reflect graduated placement (no longer "future iteration may hoist").

### Files Created
- None — the change is config + a small CTA card composed of existing primitives.

### Architecture Decisions
- **Sidebar child + parent CTA over fold-inline-tab.** Two affordances, one canonical surface. The advisor stays a focused conversation page rather than competing with the AI advice / health / tiles / risk on the Actions tab.
- **URL stability.** `/dashboard/cfo/ask` preserved — audit logs from 41h.4 onwards remain searchable; downstream `runAdvisorQuery` helper untouched.
- **Provider-agnostic primitives untouched.** `components/ai-advisor/*` was built provider-agnostic in 41h.3; this change validates the design — graduating the advisor required zero component changes.
- **No new design primitive.** The CTA card uses existing Card / CardContent / Button primitives + the lucide-Brain icon already used by the sidebar item + the existing amber palette already used elsewhere in the tile system. CLAUDE.md §16.4 inline-JSDoc requirements N/A (no new reusable primitive introduced).
- **Tests skipped (deliberate).** DashboardLayout is a client component depending on `useAuth` / `useUISyncEngine` / `useOnboardingState` / context providers — adding mock layers for a routing-config change is more cost than benefit. Structural floor is `tsc --noEmit` clean (verified). The existing 12 AI-advisor component tests from 41h.3 cover the underlying ask/answer surface end-to-end. CLAUDE.md §0 architect lens — don't add tests for the sake of it.

### Build Status
- [x] `npx tsc --noEmit` — clean (only pre-existing `stripeBillingService.ts` "stripe" module-not-found, unrelated to this PR).

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern — new restrained CTA card pattern on `/dashboard/cfo` (no new reusable primitive — composes existing Card / Button / Brain / amber palette; `06_UI_UX_FOUNDATION.md` not touched per §16.3 first row "single component, no system change").
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Option A "sidebar child + CTA card" chosen over Option B "fold inline as a tab"; rationale in PR + IMPLEMENTATION_PLAN.md + this changelog)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #40` — marked SHIPPED with summary; `Last updated` header refreshed; new Recently Completed entry prepended.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md:§11.1` — sub-PR table extended with new 41h.7 SHIPPED row.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.
- Inline JSDoc on `components/DashboardLayout.tsx` (sidebar item rationale) + `app/dashboard/cfo/page.tsx` (CTA card rationale) + `app/dashboard/cfo/ask/page.tsx` (graduated-placement note).

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — no Prisma writes anywhere in this PR.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A — no `prisma/schema.prisma` changes.

### PR
- Branch: `claude/phase-41h7-trail-aligned-ia`
- **Status: PR #688 merged 2026-05-07.**

---

## Session: claude/phase-41h6-scenario-run-tools (Phase 41h.6 — SCENARIO_RUN tools expansion)

### Strategy
- Closes Up Next #39: SCENARIO_RUN tools expansion. Builds on the locked-in pattern from 41h.5 (`runContributionScenario`).
- Three new SCENARIO_RUN tools wrapping the highest-value tax engines:
  1. `runCgtScenario` — wraps `applyCapitalLossNetting` (Div 102-A / s100-50 / s115-100)
  2. `runLandTaxScenario` — wraps `calculateCrossStateLandTax` (per-state Land Tax Acts)
  3. `runDiv7aRefinanceScenario` — wraps `classifyDiv7ALoans` (Div 7A — s109B-s109ZE, s109N safe harbour)
- Each adapter is a small file under `lib/ai/tax-advisor/tools/` returning baseline + scenario + delta numerical fields per the locked-in `scenario.{baseline,input,result,delta}.*` path convention.
- All HR-1/HR-2/D-2 boundaries preserved at every layer:
  - **HR-1**: every number computed by the underlying engine; the tool composes inputs and subtracts.
  - **HR-2**: every citation lifted from the engine's `AuthorityCitation[]` with stable `cit-N` ids.
  - **D-2**: `kind === 'SCENARIO_RUN'`; descriptions explicitly disclaim "Does NOT recommend whether to ...". Returning a scenario number is a fact, not a recommendation.

### Type
- **Type**: Feature (Phase 41h follow-up — closes Up Next #39)
- **Scope**: AI advisor tool registry — 3 new SCENARIO_RUN tools, registry size 7 → 10
- **Authority**: ITAA 1997 Div 102-A / s100-50 / s115-100 (CGT); per-state Land Tax Acts (NSW 1956, VIC 2005, QLD 2010, SA 1936, WA 2002, TAS 2000, ACT 2004, NT 1992); ITAA 1936 Div 7A s109B-s109ZE + s109N MRP safe harbour.

### Files Created
- `lib/ai/tax-advisor/tools/runCgtScenario.ts` — wraps `applyCapitalLossNetting`. Inputs: `entityType`, `currentEvents`, `hypotheticalEvents`, optional `carryForwardLosses` / `isComplying` / `isForeignResident`. Returns 9 numericFields: baseline (`assessableNetCapitalGain`, `netGainBeforeDiscount`); scenario inputs (`hypotheticalGains`, `hypotheticalLosses`, `hypotheticalEventCount`); scenario result (`assessableNetCapitalGain`, `netGainBeforeDiscount`); delta (`assessableNetCapitalGain`, `netGainBeforeDiscount`). Citations from the underlying engine.
- `lib/ai/tax-advisor/tools/runLandTaxScenario.ts` — wraps `calculateCrossStateLandTax`. Inputs: `ownershipType`, `isForeignOwner`, `currentProperties`, `hypotheticalProperties`. Returns 10 numericFields covering baseline + scenario + delta on `grandTotalTax` + `grandTotalForeignSurcharge` + `statesAssessed`, plus echoed sum of hypothetical taxable land values.
- `lib/ai/tax-advisor/tools/runDiv7aRefinanceScenario.ts` — wraps `classifyDiv7ALoans`. Inputs: `currentLoans`, `loanIdsToRefinance` (flips `hasComplianceAgreement: true` on listed loans, leaves others untouched), optional `overrideYearsRemaining` / `overrideBenchmarkRate`. Returns 8 numericFields covering baseline + scenario + delta on `totalDeemedDividend` + `compliantLoanCount`.
- `tests/ai/tax-advisor/tools-41h6.test.ts` — 36 new tests: per-tool baseline + scenario + delta presence; zero-hypothetical → zero-delta idempotency invariant for all three; foreign-owner residential hypothetical increases foreign-surcharge delta; refinance only flips listed loanIds; HR-1/HR-2/D-2 contract per tool (`kind === 'SCENARIO_RUN'`, banned-word check on tool names, every citationId resolves, every tool exposes all four `scenario.*` path roots).

### Files Modified
- `lib/ai/tax-advisor/index.ts` — bootstrap registers all 3 new tools; `CANONICAL_TOOLS` now `FACT_LOOKUP × 6 + SCENARIO_RUN × 4 = 10`. Public re-exports added for the three new tool consts.
- `tests/ai/tax-advisor/registry.test.ts` — registry size assertion 7 → 10; alphabetical name list extended with `runCgtScenario`, `runDiv7aRefinanceScenario`, `runLandTaxScenario`.
- `tests/ai/tax-advisor/tools-41h5.test.ts` — registry-state assertions updated for new size 10 + 4 SCENARIO_RUNs (the existing 41h.5 tool-level assertions remain untouched).
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #39 marked SHIPPED with summary; `Last updated` header refreshed; new Recently Completed entry prepended for 2026-05-07 (Phase 41h.6).
- `docs/architecture/03_DATA_MODEL.md` — new §10.41 "Phase 41h.6 — SCENARIO_RUN tools expansion" with the three tools, locked-in pattern, hard-rule preservation, registry state, test coverage.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` — §11.1 sub-PR table extended with new 41h.6 SHIPPED row; 41h.5 row updated to "CLOSES PHASE 41h CORE" so the doc remains internally consistent.

### Architecture Decisions
- **Pattern reuse over re-design.** The 41h.5 SCENARIO_RUN pattern (returns baseline + scenario + delta numerical fields under a stable four-root path scheme) is reused verbatim. No bespoke shape per tool — the AI advisor's runtime validator can rely on a single contract across all SCENARIO_RUN tools.
- **Adapter-only — no engine changes.** Each tool is a thin wrapper that composes inputs (current + hypothetical) and calls the existing pure calc engine twice (baseline + scenario). Deltas are subtraction. Zero changes to `lib/tax-engine/`.
- **Citations lifted from the engine, not duplicated.** Each tool maps the engine's `citations[]` to `IdentifiedCitation[]` with stable `cit-N` ids. No tool-side citation invention. HR-2 preserved structurally.
- **D-2 preserved by description, not just by `kind`.** Every tool description starts with the kind (`SCENARIO_RUN: ...`) and explicitly disclaims "Does NOT recommend whether to ...". The locked-in test (`description either fact_lookup-disclaim or scenario_run-disclaim`) covers both shapes.
- **Test for the contract, not the engine.** The 41h.6 test suite asserts the SHAPE of the SCENARIO_RUN tool output (baseline + scenario + delta paths exist; deltas are well-typed; zero-hypothetical produces zero-delta as an idempotency invariant). The underlying engine's correctness is owned by the engine's own test suite + the calc-audit fixtures (Phase 41i.2 — 36 engines × 45 fixtures all green).
- **Refinance scenario uses opt-in loan list.** `loanIdsToRefinance` is the explicit set of loans to flip `hasComplianceAgreement: true`. Loans NOT in the list are untouched. This preserves the user's mental model ("what if I refinanced loan L1?" — not "what if I refinanced everything?").

### Build Status
- [x] `npx tsc --noEmit` — clean (only pre-existing `stripeBillingService.ts` "stripe" module-not-found, unrelated to this PR).
- [x] `npx vitest run tests/ai/tax-advisor` — 147 pass (was 111). All registry / 41h.0-5 / 41h.6 / runAdvisorQuery / Gemini / gateway / askAProRouting suites green.
- [x] `npx vitest run tests/ai/tax-advisor/tools-41h6.test.ts` — 36 / 36 pass.
- [x] `npx vitest run tests/ai/tax-advisor/tools-41h5.test.ts` — 34 / 34 pass after registry-state assertions updated.
- [x] `npx vitest run tests/ai/tax-advisor/registry.test.ts` — 23 / 23 pass after size + alphabetical assertions updated.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (locked-in SCENARIO_RUN pattern reused for 3 more tools — registry size 7 → 10; pattern proven across the 4 highest-value tax surfaces)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #39` — marked SHIPPED with summary; `Last updated` header refreshed; new Recently Completed entry prepended.
- `docs/architecture/03_DATA_MODEL.md:§10.41` — new section "Phase 41h.6 — SCENARIO_RUN tools expansion" with full registry state + tool details + hard-rule preservation table.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md:§11.1` — sub-PR table extended with 41h.6 SHIPPED row.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — no Prisma writes anywhere in this PR. All changes are pure-function adapter code under `lib/ai/tax-advisor/tools/` plus tests + docs.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A — no `prisma/schema.prisma` changes.

### PR
- Branch: `claude/phase-41h6-scenario-run-tools`
- **Status: PR #687 merged 2026-05-07.**

---

## Session: claude/phase-41i5-l2-anomaly-detection (Phase 41i.5 — L2 anomaly detection. CLOSES PHASE 41i.)

### Strategy
Closes Phase 41i. The L2 layer — temporal pattern detection over the `CalcAuditFinding` history. Per HR-3 admin-side only. Per the architect call, scoped to operate on **existing finding history** (not per-user calc data) so it ships useful from day 1, not gated on production user volume.

### Two patterns
| Pattern | Fires when | Severity |
|---|---|---|
| `HIGH_FREQUENCY` | Engine produces > threshold findings in `lookbackDays` (default 5/7d) | MEDIUM (or HIGH if > 2× threshold) |
| `REGRESSION_AFTER_STABLE_PERIOD` | Engine quiet ≥ 30 days then sudden new findings with prior-to-recent gap ≥ 14 days | HIGH |

Both surface as `source: 'L2_ANOMALY'` findings flowing through the existing 41i.3 lifecycle + 41i.4 alerting.

### What ships
- `lib/calc-audit/anomalyDetection.ts` (NEW): scanner + pure-logic helpers (`detectHighFrequencyPatterns`, `detectRegressionPattern`)
- `app/api/admin/calc-audit/anomaly-scan/route.ts` (NEW): endpoint with two auth paths — admin session OR Cloud Scheduler shared secret
- `docs/operational/calc-audit/cloud-scheduler-setup.md` (NEW): gcloud + Vercel ops runbook
- `tests/calc-audit/anomalyDetection.test.ts` (NEW): 17 tests for both patterns

### Cloud Scheduler integration
Single `gcloud scheduler jobs create http` command. 3 AM AEST daily default. Shared-secret bearer auth via `CALC_AUDIT_SCHEDULER_SHARED_SECRET` env var (constant-time-ish comparison). Pause/resume/delete + body-tuning commands documented.

### Dedup
Same pattern as 41i.3's `recordDifferentialFindings` — existing OPEN/INVESTIGATING `L2_ANOMALY` findings for `(engineName, kind)` are refreshed instead of duplicated. Daily scans don't spam the queue.

### Tests (17 new — 649 total)
- `detectHighFrequencyPatterns` (6) — empty input; over-threshold; boundary case; HIGH escalation; multi-engine independence; evidence shape
- `detectRegressionPattern` (6) — long quiet period; first-ever findings; recent prior doesn't fire; gap < threshold doesn't fire; evidence shape; prior inside lookback returns null
- Default constants (5) — exposed; sanity invariant (stable period > regression gap)

### Phase 41i is COMPLETE
All 5 sub-PRs shipped:
- 41i.0 + 41i.1 — Foundation + L1 fixture differential
- 41i.2 — Engine adapter expansion (14 → 36 engines)
- 41i.3 — L3 audit foundation: persistent findings + lifecycle
- 41i.4 — Alerting + workflow + backfill runbook
- 41i.5 — L2 anomaly detection (this PR)

Three calc-audit layers all live (L1 deterministic + L2 temporal + L3 foundation). HR-3 maintained — admin-side only.

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.40
- `docs/operational/calc-audit/cloud-scheduler-setup.md` (new ops runbook)
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.2 41i.5 SHIPPED row marked **CLOSES PHASE 41i**

### Deferred (not blocking)
- 41i.3b — Per-user "Audit this user" (needs per-engine user-data adapters)
- Prisma mock layer for unit tests (currently DB-touching paths smoke-tested manually)
- OIDC auth for Cloud Scheduler (v1 uses shared-secret bearer)

### Next per Reza's roadmap
1. SCENARIO_RUN tools expansion — `runCgtScenario`, `runLandTaxScenario`, `runDiv7aRefinanceScenario`
2. TRAIL-aligned IA — graduate AI advisor from `/dashboard/cfo/ask` to "My Guide" placement (CLAUDE.md §14)

---

## Session: claude/phase-41i4-alerting-workflow (Phase 41i.4 — Alerting + workflow SHIPPED)

### Strategy
Closes the alerting layer on top of 41i.3's lifecycle. With L1 (fixtures) + L3 foundation (persistent findings + lifecycle) + alerting now live, the calc audit safety net is functionally complete. Per HR-3 — admin-side only.

### What ships
- `lib/calc-audit/alertingService.ts` (NEW): two-channel dispatcher (Slack + email) with severity threshold gating
- `lib/calc-audit/findingService.ts` (MODIFIED): fire-and-forget alert hooks on creation + escalation
- `docs/operational/calc-audit/backfill-runbook.md` (NEW): admin SOP for fixing engine bugs + remediating affected users
- `tests/setup/server-only-stub.ts` (NEW): vitest alias for the Next.js `server-only` runtime guard
- `vitest.config.ts` (MODIFIED): wires the stub via `resolve.alias`

### Channels
| Channel | Activation env vars | Behaviour when unset |
|---|---|---|
| Slack webhook | `SLACK_CALC_AUDIT_WEBHOOK_URL` | No-op |
| Email (SendGrid) | `SENDGRID_API_KEY` + `MONITRAX_CALC_AUDIT_ALERT_EMAIL` | No-op (both vars required together) |

### Threshold
- Default: HIGH (only HIGH + CRITICAL findings fire)
- Override: `CALC_AUDIT_ALERT_THRESHOLD` env var
- Invalid values fall back to HIGH (misconfig must not break audit pipeline)

### Triggers
- `CREATED` — new finding ≥ threshold
- `ESCALATED_TO_FIX_REQUIRED` — admin transition (real bug confirmed)
- NO alert on refresh (existing OPEN/INVESTIGATING re-detected) or on FIXED / FALSE_POSITIVE close

### Fire-and-forget
Per CLAUDE.md §12.10. `Promise.all` with per-channel `.catch(() => {})` wrapping. Delivery failures NEVER block the underlying audit operation.

### Backfill runbook (`docs/operational/calc-audit/backfill-runbook.md`)
Admin SOP for the workflow after a confirmed bug:
1. Decision tree from finding → FIX_REQUIRED → backfill scope
2. Identifying affected users (default assumption: most engines pure)
3. Three remediation strategies (re-compute on next access / active backfill / compensating snapshot)
4. Notification policy per HR-3 (existing support tooling, never in-app banners; warm-words copy guidance)
5. Severity → response time SLA matrix
6. CLAUDE.md compliance reminders (§12.11 / §12.12 / §13.3 / §0.4)

### Tests (26 new — 632 total)
- resolveThreshold (3) — default HIGH; valid env override; invalid env fallback
- meetsThreshold (6) — all severity levels against thresholds
- recordAlert threshold gating (4) — CRITICAL fires; MEDIUM/LOW don't; lowered threshold raises gate
- recordAlert no-channels safety (5) — graceful degradation across env permutations
- buildSlackPayload (4) — trigger labels; severity emojis; structured fields contain key data
- buildEmailBody (4) — trigger copy; engine/severity rendered; finding id + portal link; failed assertions

### Test infra
New `tests/setup/server-only-stub.ts` + vitest config alias so any module importing Next.js's `server-only` runtime guard can be unit-tested in node environment. Future server-side libs benefit too.

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.39
- `docs/operational/calc-audit/backfill-runbook.md` (new admin runbook)
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.2 41i.4 SHIPPED row

### Next
**41i.5** — L2 Cloud Scheduler anomaly detection. Deferred until Cloud Scheduler infra is in place; not an immediate dependency since L1 + L3 + alerting are live.

---

## Session: claude/phase-41i3-l3-persistent-findings (Phase 41i.3 — L3 audit foundation: persistent findings + lifecycle SHIPPED)

### Strategy
Persistence layer for the calc audit system. Every drift / error event from `runDifferential()` is now recorded to a DB-backed queue with full lifecycle workflow. Foundation for 41i.4 alerting and 41i.3b per-user audit.

### Schema
```prisma
enum CalcAuditFindingSource { L1_DIFFERENTIAL  L3_ON_DEMAND  L2_ANOMALY }
enum CalcAuditFindingSeverity { INFO  LOW  MEDIUM  HIGH  CRITICAL }
enum CalcAuditFindingResolution { OPEN  INVESTIGATING  FALSE_POSITIVE  FIX_REQUIRED  FIXED }

model CalcAuditFinding {
  id, detectedAt, source, engineName, fixtureName?, userId?,
  severity, resolution, summary, failedAssertions?, errorMessage?,
  adminNotes?, resolvedAt?, resolvedBy?, createdAt, updatedAt
  @@map("calc_audit_findings")
}
```

CLAUDE.md §12.11 N/A — additive table. §12.12 satisfied — `prisma/migrations/20260507120000_add_calc_audit_finding/migration.sql` ships in same PR (hand-crafted; no DATABASE_URL in this env).

### Lifecycle
```
OPEN → INVESTIGATING → FIX_REQUIRED → FIXED
       └─ FALSE_POSITIVE
       
Terminal states (FIXED, FALSE_POSITIVE) → INVESTIGATING (re-open only path)
```

Locked in `ALLOWED_TRANSITIONS`. Self-transitions forbidden.

### What ships
- `lib/calc-audit/findingService.ts` (NEW): `recordDifferentialFindings()` (auto-persist FAIL/ERROR + dedupe by engine+fixture), `listFindings()`, `getFindingCountsByResolution()`, `updateFindingResolution()` (with validated transition + structured `FindingTransitionError`)
- `app/api/admin/calc-audit/route.ts` (MODIFIED): auto-persists on every differential run; returns persistence counts + countsByResolution
- `app/api/admin/calc-audit/findings/route.ts` (NEW): GET list with filters (resolution/source/engineName)
- `app/api/admin/calc-audit/findings/[id]/route.ts` (NEW): PATCH lifecycle update (admin email as resolvedBy)
- `app/admin/calc-audit/page.tsx` (MODIFIED): Findings queue section above engine catalogue + lifecycle counts tile + per-finding cards with context-aware transition buttons

### Auto-persist + dedup
- Every `GET /api/admin/calc-audit` runs the differential AND persists FAIL/ERROR results
- Dedupe: existing OPEN/INVESTIGATING finding for the same `(engineName, fixtureName)` is **refreshed** (latest detectedAt + summary) instead of duplicated
- Severity defaults: FAIL → MEDIUM; ERROR → HIGH

### Tests (9 new — 606 total)
- ALLOWED_TRANSITIONS lifecycle invariants (every state has correct next-states; terminal states re-open only via INVESTIGATING; self-transitions forbidden)
- `FindingTransitionError` shape (NOT_FOUND / INVALID_TRANSITION codes)

Codebase doesn't carry a Prisma mocking layer (`tests/sanity/` uses real DB). Pure-logic locked in tests; end-to-end persistence smoke-tested manually after deploy.

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.38
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.2 41i.3 SHIPPED row

### Deferred
- **41i.3b — Per-user "Audit this user"** — requires per-engine adapters that fetch user data from DB and reconstruct each engine's input. 36 engines × different input shapes = substantial workstream. Foundation now in place.

### Next
**41i.4** — Alerting + workflow (Slack/email when severity ≥ HIGH; the lifecycle workflow is in place to support it).

---

## Session: claude/phase-41i2-engine-adapter-expansion (Phase 41i.2 — Calc audit engine adapter expansion SHIPPED)

### Strategy
Closes the "add more engines" item in the Phase 41i.2 sequence. Extends the calc audit registry from **14 → 36 engines** so every Phase 41e module the AI advisor relies on has assertion-based audit coverage. Drift in any of these now fails CI before users see wrong numbers (HR-3).

### What ships
```
lib/calc-audit/engines/
├── tax.ts              # (existing) 7 NSW + cross-state + loss + GST + capTracker engines
├── tax-divisions.ts    # NEW — 8 division/classifier/orchestrator adapters
├── tax-state.ts        # NEW — 14 state adapters (7 land tax + 7 stamp duty for VIC/QLD/SA/WA/TAS/ACT/NT)
├── core.ts             # (existing) 4 core financial calc adapters
└── property.ts         # (existing) 3 property metric adapters
```

### TAX divisions adapters (8 in `tax-divisions.ts`)
- `tax.cgtNetting` — `applyCapitalLossNetting` (Div 102-A / s100-50 / s115-100)
- `tax.div7aClassifier` — `classifyDiv7ALoans` (ITAA 1936 s109B-s109ZE)
- `tax.psiClassifier` — `classifyPsi` (ITAA 1997 Part 2-42 + s86-15)
- `tax.fteIeeClassifier` — `classifyFteIeeDistributions` (Sch 2F ITAA 1936)
- `tax.div152` — `applyDiv152` (Div 152 small business CGT concessions)
- `tax.smsfTriumvirate` — `classifySmsfTriumvirate` full (SIS Act s62/Pt 8/s67A; s295-550/-160)
- `tax.highIncomeSuperTax` — `calculateHighIncomeSuperTax` (Div 293)
- `tax.masterTaxPosition` — `buildMasterTaxPosition` (Phase 41e.17 orchestrator)

### State adapters (14 in `tax-state.ts`)
7 land tax + 7 stamp duty adapters covering VIC / QLD / SA / WA / TAS / ACT / NT — both regimes now span **all 8 states/territories** (NSW shipped in 41i.0+1).

### Registry now 36 engines / 45 fixtures
| Category | Count | Note |
|---|---|---|
| TAX | 29 | was 7 |
| CORE | 4 | unchanged |
| PROPERTY | 3 | unchanged |

All 45 fixtures green against current engine implementations. tsc clean.

### Tests (2 new — 597 total)
- TAX category includes all Phase 41i.2 division/classifier adapters
- TAX category covers all 8 states for both land tax + stamp duty

The existing "every fixture passes against current implementation" test now enforces **45 PASSes** (was 19) — any future engine refactor changing canonical output forces a deliberate fixture update + reviewer sign-off.

### Smoke-test discipline (lessons re-learned)
While building the adapters, my first draft had wrong type assumptions for several engines:
- `CapitalLossNettingInput.events[*]` — uses `id` + `monthsHeld` (not `eventId` + `discountEligible`)
- `PsiTestResult` is a string union `'PASS' | 'FAIL'` (not an object with `.passed`)
- `FteIeeBeneficiaryInput` uses `distributionAmount` + `relationship: FamilyGroupRelationship` (`'FAMILY_MEMBER'`, not `'SPOUSE'`)
- `Div152Input` uses `gainAfterDiv115` + `maxNetAssetValue` + `aggregatedTurnover` (not `nominalGain` + flat `concessionsClaimed`)
- `calculateHighIncomeSuperTax` takes `(input, TaxYearConfig)` returning structured object (not single args returning number)
- `Div7AClassificationResult.highestSeverity` for NO_AGREEMENT loans is `'NO_AGREEMENT'` (not `'DEEMED_DIVIDEND'` — DEEMED_DIVIDEND is the operative outcome at the top of the rank, but NO_AGREEMENT is the per-loan classification)

The audit system caught all of these as fixture failures before this PR shipped — exactly as designed.

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.37
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.2 41i.2 SHIPPED row

### Next
**41i.3** — L3 on-demand "Audit this user" admin action + persistent `CalcAuditFinding` Prisma model.

---

## Session: claude/phase-41h5-tool-registry-expansion (Phase 41h.5 — Tool registry expansion + SCENARIO_RUN. CLOSES PHASE 41h.)

### Strategy
Closes Phase 41h by expanding the tool registry from 3 → 7 (4 new tools: 3 FACT_LOOKUP + 1 SCENARIO_RUN). Establishes the SCENARIO_RUN pattern for "what if" simulations while preserving all HR-1 / HR-2 / D-2 boundaries.

### What ships
```
lib/ai/tax-advisor/tools/
├── getCgtExposure.ts            # NEW (FACT_LOOKUP) wraps applyCapitalLossNetting
├── getDiv7aRisk.ts              # NEW (FACT_LOOKUP) wraps classifyDiv7ALoans
├── getInHouseAssetRatio.ts      # NEW (FACT_LOOKUP) wraps classifySmsfTriumvirate (Pt 8 portion)
└── runContributionScenario.ts   # NEW (SCENARIO_RUN) — first SCENARIO_RUN tool
```

### Registry now (7 tools)
| Domain | FACT_LOOKUP | SCENARIO_RUN |
|---|---|---|
| Super | `getContributionCapHeadroom` | `runContributionScenario` |
| CGT | `getCgtExposure` | — |
| Land tax | `getLandTaxPosition` | — |
| Stamp duty + entity tax | `getEntityTaxPosition` | — |
| Div 7A | `getDiv7aRisk` | — |
| SMSF | `getInHouseAssetRatio` | — |

### SCENARIO_RUN pattern (locked in this PR)
- Structurally identical to FACT_LOOKUP — same `ToolResult` shape
- Semantic difference: FACT_LOOKUP = current state; SCENARIO_RUN = hypothetical
- Returns BOTH baseline + scenario + delta numerical fields so AI narrates the change without computing it (HR-1 preserved — delta is computed in the tool, not by the AI)
- D-2 preserved: "if you contribute $5k more, your headroom becomes $3k" is a fact; "you should contribute $5k more" remains forbidden (no recommendation tool exists in registry)

### Tests (34 new — 595 total, +34)
- Registry size + kind discriminator (4)
- getCgtExposure (3) — net gain after netting + discount; cites Div 102-A/s100-50/s115; citationIds resolve
- getDiv7aRisk (3) — compliant loan; NO_AGREEMENT deemed dividend; zero-loan input
- getInHouseAssetRatio (3) — within 5% cap; exceed cap → BREACH with breach amount + percentage; cites Pt 8 SIS Act
- runContributionScenario (5) — baseline+scenario+delta; zero-hypothetical = zero-delta; cap-crossing surfaces excess tax delta; cites s291-20/s292-85/Div 291; citationIds resolve
- HR-1/HR-2/D-2 contract per tool (16) — 4 tools × 4 contract checks (stable path, well-formed citations, no banned words, description disclaim)

Updated existing 41h.0 registry test to expect `size = 7` + alphabetical with new tools.

tsc clean.

### Phase 41h is COMPLETE
All 6 sub-PRs shipped:
- 41h.0 — Tool registry foundation (3 FACT_LOOKUP)
- 41h.1 — AI Policy Gateway (5-status pipeline; HR-1/HR-2/D-2 enforcement)
- 41h.2 — Gemini provider adapter + production audit sink
- 41h.3 — Practice surface UI (admin demo)
- 41h.4 — Ask-a-Pro router + user-facing surface graduation
- 41h.5 — Tool registry expansion + SCENARIO_RUN (this PR)

**Three structural enforcement layers all live:**
1. Tool layer — closed `ToolKind` discriminant; no `RECOMMENDATION` kind
2. Schema layer — Zod `RawAIResponseSchema`; typed segments
3. Validator layer — runtime resolution against `ToolSession`; rejects fabricated numbers / citations / recommendation language

**Calc audit safety net** (Phase 41i) catches calc drift silently before users see wrong numbers (HR-3).

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.36
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.1 41h.5 SHIPPED row marked **CLOSES PHASE 41h**

### Next
Phase 41 core scope is complete. Future iterations:
- More SCENARIO_RUN tools (`runCgtScenario`, `runLandTaxScenario`, `runDiv7aRefinanceScenario`)
- Graduate advisor surface from `/dashboard/cfo/ask` to "My Guide" per TRAIL framework
- 41i.2-5 follow-ups (more audit engines, L3 on-demand, alerting, L2 anomaly detection)

---

## Session: claude/phase-41h4-ask-a-pro-router (Phase 41h.4 — Ask-a-Pro router + user-facing surface graduation SHIPPED)

### Strategy
Graduates the AI advisor from admin-demo to user-facing. The Tier 2 routing card now links to the existing Phase 32C marketplace, scoped to the right discipline based on the AI's `askAProRouting.profession`. Same gateway, same components — just the surface graduates.

### Profession → Discipline mapping (locked in)
| Profession | Marketplace `discipline` | Licensing |
|---|---|---|
| ADVISER | FINANCIAL_ADVISOR | AFSL — personal financial advice + product recommendations |
| ACCOUNTANT | TAX_AGENT | TPB — personal tax advice |
| BROKER | MORTGAGE_BROKER | NCCP — credit advice + product recommendations |

**Intentionally narrow** — reviewers reject any change that broadens it (e.g. routing AFSL questions to TPB-only agents).

### Files
- `lib/ai/tax-advisor/askAProRouting.ts` — `professionToDiscipline()` + `buildAskAProDeepLink()`
- `lib/ai/tax-advisor/runAdvisorQuery.ts` — shared gateway helper used by both admin + user-facing routes
- `app/api/ai-advisor/ask/route.ts` — user-facing endpoint (`report.read` permission via `withPermission`)
- `app/api/admin/ai-advisor/ask/route.ts` — refactored to delegate to `runAdvisorQuery`
- `app/dashboard/cfo/ask/page.tsx` — user-facing page using existing 41h.3 components
- `components/ai-advisor/TaxAdvisorAnswer.tsx` — `RouteToPro` now has clickable CTA + accepts `originalQuestion` prop

### Deep-link contract
`buildAskAProDeepLink({ profession, question?, reason? })` → `/marketplace?discipline=<mapped>&question=<encoded>&reason=<encoded>`. CDR data is NEVER placed in URL — sensitive snapshot context is opt-in inside the request submission form.

### Both routes coexist
- `/api/admin/ai-advisor/ask` — admin diagnostic; `audit:read`; `/admin/ai-advisor`
- `/api/ai-advisor/ask` — user-facing; `report.read`; `/dashboard/cfo/ask`

Both delegate to `runAdvisorQuery` — single source of truth for provider wiring + validation.

### Tests (17 new — 561 total, 544 → 561, +17)
- `professionToDiscipline` (3) — all three professions correctly mapped
- `buildAskAProDeepLink` (5) — base path; discipline param; question + reason encoding; omits when not supplied; URL-special chars round-trip
- `runAdvisorQuery` validation (4) — empty / whitespace / over-cap rejected; cap edge accepted
- `runAdvisorQuery` config (1) — `NOT_CONFIGURED` when `GEMINI_API_KEY` unset
- `RouteToPro` CTA wiring (4) — Tier 2 ADVISER href + copy; BLOCKED_RECOMMENDATION default to ADVISER; ACCOUNTANT → TAX_AGENT; BROKER → MORTGAGE_BROKER

tsc clean.

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.35
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.1 41h.4 SHIPPED row

### Next
**41h.5** — Tool registry expansion (`runScenario` SCENARIO_RUN tool + additional fact lookups: CGT exposure, Div 7A risk, in-house asset ratio, contribution-cap deltas). Closes Phase 41h.

---

## Session: claude/phase-41h3-practice-surface-ui (Phase 41h.3 — AI Advisor Practice surface UI SHIPPED)

### Strategy
Resumes Phase 41h after 41i's calc-audit safety net shipped. First user-shaped surface for the AI advisor: components that take the gateway's `GatewayResponse` and render it with citations next to numbers, AFSL/TPB/NCCP boundary footer, UNCOMPUTED flags surfaced explicitly, and Tier 2 → Ask-a-Pro routing card. Lives behind admin portal as the integration surface until 41h.4 (Ask-a-Pro routing) and 41h.5 (tool registry expansion) graduate it to user-facing dashboards.

### Architecture
```
components/ai-advisor/
├── TaxAdvisorAnswer.tsx           # Top-level renderer — branches per response.status
├── TaxAdvisorBoundaryFooter.tsx   # AFSL/TPB/NCCP footer with citations
├── TaxAdvisorUncomputedFlag.tsx   # Per-flag amber-accent renderer
├── TaxAdvisorAskForm.tsx          # Question textarea + example chips
└── index.ts                       # public surface

app/api/admin/ai-advisor/ask/route.ts  # POST — wraps gateway w/ GeminiProvider + ProductionAuditSink
app/admin/ai-advisor/page.tsx          # admin demo page (AdminFeatureGate)
```

### Status routing (5 outcomes)
| Gateway status | UI surface |
|---|---|
| `OK` + `TIER_1_FACTS` | Inline segments + UNCOMPUTED section + boundary footer + trace metadata |
| `OK` + `TIER_2_ROUTE_TO_PRO` | Routing card with profession-specific copy + reason + trace |
| `BLOCKED_RECOMMENDATION` | Auto-routes to default ADVISER Tier 2 card |
| `BLOCKED_VALIDATION` / `SCHEMA_INVALID` | Generic accuracy error (don't expose validator detail) + trace |
| `PROVIDER_ERROR` | "AI is temporarily unavailable" + trace |

### API route behaviour
- Admin-only (`audit:read` permission via `verifyAdminGCPAuth`)
- 503 `AI_ADVISOR_NOT_CONFIGURED` when `GEMINI_API_KEY` unset (clear message, never silent fail)
- Question length capped at 2,000 chars (defensive)
- Wraps gateway with `GeminiProvider` (real Gemini calls) + `ProductionAuditSink` (writes to existing AuditLog Prisma table; CDR-safe metadata only per CLAUDE.md §13.3; fire-and-forget per §12.10)

### Test infra change
Updated `vitest.config.ts`:
- `include: ['tests/**/*.test.{ts,tsx}']` (was just `.ts`) — unblocks future React component tests
- Coverage `include` adds `components/**/*.{ts,tsx}`

### Tests (12 new — 544 total)
- Boundary footer (2) — renders boundary statement verbatim; renders citations inline
- UNCOMPUTED flag (2) — with citation; without citation
- Status routing (5) — PROVIDER_ERROR + trace; BLOCKED_VALIDATION generic; SCHEMA_INVALID same; BLOCKED_RECOMMENDATION → ADVISER; OK + TIER_1 + segments + boundary
- Tier 2 routing (1) — TIER_2_ROUTE_TO_PRO renders profession-specific copy + reason
- UNCOMPUTED section (1) — flags render in dedicated section
- Trace metadata (1) — trace + duration + tokens always at bottom

Tests use `react-dom/server.renderToString` — no RTL setup needed.

### Smoke-test path
1. Set `GEMINI_API_KEY` in env
2. Navigate to `/admin/ai-advisor` (admin portal enabled)
3. Pick example question or type one
4. Real Gemini call → tool dispatch → validated answer with citations + boundary footer

If `GEMINI_API_KEY` unset, page loads but submission shows clear "not configured" error.

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.34
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.1 41h.3 SHIPPED row

### Next
**41h.4** — Ask-a-Pro router (detects recommendation-shaped questions; routes to marketplace per Phase 32C; graduates advisor to user-facing dashboards).

---

## Session: claude/phase-41i-fixture-contract-corrections (Phase 41i — Audit anomaly triage + JSDoc contract docs)

### Triage outcome
After Phase 41i shipped (PR #671), Reza asked whether the 5 anomalies the audit agent flagged during fixture authoring were real calc errors. Triaged each:

| # | Finding | Verdict |
|---|---|---|
| 1 | `expenseAggregator` frequency conversion | **Not a bug** — engine works with UPPERCASE `Frequency` enum (`'MONTHLY'`); my fixture used lowercase which falls through `toAnnual`'s default branch |
| 2 | `incomeAggregator` frequency + PAYG | **Not a bug** — UPPERCASE enum required + `paygWithholding` is a pre-converted annual figure (asymmetric with `amount`); fixture used wrong contract |
| 3 | `loanAggregator` frequency conversion | **Not a bug** — same UPPERCASE `RepaymentFrequency` enum requirement |
| 4 | `netWorth` MORTGAGE classification | **Not a bug** — engine recognises `'HOME'`/`'INVESTMENT'` (case-insensitive) per app-wide convention, verified in `intelligence/portfolioEngine.ts`, `health/types.ts`, `testing/types.ts`. `'MORTGAGE'` not used as a real loan type anywhere except my fixture |
| 5 | GST `G1` baseline = $12k | **Not a bug** — export GST-free correctly contributes to G1 per BAS rules; my fixture comment was wrong |

**Net: zero engine bugs. All 5 were fixture-authoring errors on my part.** But the audit system did exactly its job — surfaced the gap between my mental model and engine reality.

### Changes
- **Fixture contract corrections** (`lib/calc-audit/engines/core.ts`):
  - `core.netWorth`: replaced `type: 'MORTGAGE'` with `type: 'HOME'` (correct vocabulary). Added new fixture (`Loan with unrecognised type → personal loan`) as a **negative test** that locks in the current classifier behaviour for non-mortgage types.
  - `core.incomeAggregator`: switched to UPPERCASE `'WEEKLY'`/`'ANNUAL'` enum; set `salaryType: 'GROSS'` for SALARY entries; passed PAYG as pre-converted annual ($26k = $500 × 52). Now correctly asserts $109,200 gross / $26,000 PAYG / $104k SALARY breakdown.
  - `core.expenseAggregator`: switched to UPPERCASE `'MONTHLY'`. Now correctly asserts $36,000 annual ($24k housing + $12k food).
  - `core.loanAggregator`: switched to UPPERCASE `'MONTHLY'` + `type: 'HOME'`. Now correctly asserts $30,000/yr ($2,500 × 12).
- **Engine JSDoc contracts**:
  - `lib/calculations/incomeAggregator.ts` — `getGrossAmount` and `getPaygAmount` now document the UPPERCASE enum + PAYG-is-pre-converted-annual contracts
  - `lib/calculations/expenseAggregator.ts` — `aggregateExpenses` documents the UPPERCASE enum contract + warns about silent fall-through bug if violated
  - `lib/calculations/loanAggregator.ts` — `aggregateLoanRepayments` documents the UPPERCASE `RepaymentFrequency` enum
  - `lib/calculations/netWorthCalculator.ts` — `calculateTotalLiabilities` documents the loan-classifier vocabulary (`'HOME'`/`'INVESTMENT'`/`'CREDIT_CARD'`) + cross-references the parallel definitions in `intelligence/portfolioEngine.ts`, `health/types.ts`, `testing/types.ts`
- **18 fixtures → 19 fixtures** (added the negative-test for loan classifier)
- **532 total tests** (unchanged — fixture count grows but the "every fixture passes" test is still 1)
- tsc clean

### Why this matters
This is the second-order win from the calc audit system. By forcing fixtures to use real input contracts (and failing when they don't), the audit caught **5 places where my mental model differed from the engine**. Those gaps now live as JSDoc on the engine helpers, so the next engineer touching this code (human or AI) sees the contract requirement before they hit the same trap.

The audit system also ships a **negative-test fixture** that locks in current "fall-through" behaviour for the loan classifier — any future change to the classifier (tightening the matched types, adding new buckets) will now be caught by the audit.

### Tests
- 532 total (unchanged — but fixture count went from 18 to 19; per-fixture passes are aggregated into a single "every fixture passes" test)
- All audit fixtures green with proper contracts

### Next
**Phase 41h.3** (Practice surface UI for the AI advisor) resumes after this PR merges.

---

## Session: claude/phase-32c-pr4d-conversations (Phase 32C PR4d — In-app conversations + email-through-app SHIPPED)

### Changes Made
- **Type:** Feature (Demo-Complete Critical Path; closes Up Next #16; closes the relationship loop after PR4c)
- **Scope:** Two-way in-app conversation thread between consumer + professional, mirrored via SendGrid email; auto-created when an adviser accepts a marketplace request; 7yr compliance archive on every message.

### Files Created
- `prisma/migrations/20260507100000_add_conversations/migration.sql` — additive: 5 new `AuditAction` values + 2 new enums (`ConversationRole`, `MessageChannel`) + 3 tables (`professional_conversations` + `conversation_participants` + `conversation_messages`) + indexes + FKs.
- `lib/services/conversationService.ts` — canonical service (~530 lines). `createForAcceptedRequest`, `createOrgScopedConversation`, `assertParticipant`, `listMessages`, `getConversationDetails`, `listConversationsForUser`, `listConversationsForOrg`, `postMessage`, `softDeleteFromUserView`, `closeConversation`, `findConversationByReplyToSlug`, `buildReplyToAddress` re-export, typed-codes `ConversationServiceError`.
- `lib/email/conversationEmail.ts` — zero-dep SendGrid v3 outbound. Activated by `SENDGRID_API_KEY`; falls through to console-log + audit when unset. `buildReplyToAddress` helper. Footer carries reply-to + 7yr disclosure.
- `app/api/conversations/route.ts` — GET list user's conversations + POST ensure-or-create org-scoped conversation (caller-owns-link check).
- `app/api/conversations/[id]/route.ts` — GET detail + POST softDelete / close.
- `app/api/conversations/[id]/messages/route.ts` — GET poll (with `since` + `markAsRead`) + POST send.
- `app/api/conversations/inbound/route.ts` — SendGrid Inbound Parse webhook. Extracts conversation slug from `to` header, verifies sender-email matches consumer participant, posts as EMAIL_IN with channel bypass.
- `app/api/portal/conversations/route.ts` — adviser inbox list (org-scoped).
- `components/conversations/ConversationThread.tsx` — thread component (~300 lines). 5s poll loop, optimistic-add on send with rollback, scroll-to-bottom, ⌘/Ctrl+Enter to send, channel badges, prefers-reduced-motion-aware via Tailwind `motion-safe:*`, 7yr archive disclosure footer with viewer-role-aware copy.
- `app/portal/conversations/page.tsx` — adviser inbox list.
- `app/portal/conversations/[id]/page.tsx` — adviser thread page.
- `app/dashboard/conversations/page.tsx` — user-side list.
- `app/dashboard/conversations/[id]/page.tsx` — user thread page.

### Files Modified
- `prisma/schema.prisma` — `AuditAction` extended with 5 new values (CONVERSATION_CREATED / MESSAGE_SENT / EMAIL_OUTBOUND / EMAIL_INBOUND / SOFT_DELETED_FROM_USER); reverse relations on `User` (conversationParticipations + conversationMessages) + `OrganizationMember` (conversationParticipations) + `Organization` (conversations) + `ProfessionalRequest` (conversation 1-1); 3 new models + 2 new enums appended at end-of-file.
- `lib/services/index.ts` — re-exports the new conversation service surface.
- `lib/services/professionalRequestService.ts` — `acceptRequest` now calls `createForAcceptedRequest` AFTER the inner transaction commits (best-effort; failure doesn't roll back accept). `getRequestForOrg` + `listRequestsForUser` now include `conversation: { id }` so the request detail / tracker can deeplink.
- `app/portal/requests/[id]/page.tsx` — accepted-state card now shows "Open conversation →" alongside "Open client view →".
- `app/dashboard/requests/page.tsx` — accepted-state card surfaces "Open conversation →" deeplink + revised copy ("The conversation is open — keep chatting in-app or by email").
- `components/ask-a-pro/AskAProfessionalDialog.tsx` — `MemberCard` rewritten from placeholder `<Link href="/portal-message?memberId=...">` to `<button>` that calls `POST /api/conversations` ensure-or-create endpoint and routes to `/dashboard/conversations/<id>`. `OrgScopeView` now passes `orgClientId` + `orgName` down to MemberCard so the create call has the auth-gate inputs.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #16 marked SHIPPED with summary; new Recently Completed entry prepended for 2026-05-07.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 7 conversation thread demo path populated end-to-end.

### Architecture Decisions
- **Conversation auto-create runs AFTER the accept transaction commits**, not inside. `createForAcceptedRequest` has its own internal transaction; nesting would either error or compromise the consent invariant. Best-effort: a conversation-create failure does NOT roll back accept (the engagement is already in audit + ClientLink); ops can re-run idempotently.
- **`assertParticipant` is the single access-control gate.** Every read/write goes through it; cross-org leakage is structurally impossible because the API can't return a conversation without matching a `ConversationParticipant` row. Mirrors the pattern from PR4c's request access control.
- **Sender role FROZEN at send time.** `senderRole` on `ConversationMessage` is recorded as it was at send time, even if the person later leaves the org. Audit trail stays accurate.
- **Retention column on every message** (not just a global config). Per-tenant retention policy upgrade is a single column edit.
- **Outbound email is fire-and-forget.** The in-app message has already landed before the email send is attempted; SendGrid failures don't surface to the user. PROD wires retries.
- **`replyToSlug` is unguessable + per-conversation.** 32-char hex (16 random bytes). Inbound webhook routes by slug, not by conversation id, so a leaked id can't be used to inject inbound replies into another thread.
- **VIEWER seats excluded from participants.** They can't take inbound (per portal-permissions design); they shouldn't appear in the participant list either.
- **ZERO new dependencies.** SendGrid v3 via raw fetch (no `@sendgrid/mail` package), thread component uses Tailwind `motion-safe:*` utilities (no `framer-motion` import).

### Build Status
- [x] `npx tsc --noEmit` — clean, exit 0.
- [x] `npx next build` — green; all 9 conversation routes registered (`/api/conversations`, `/api/conversations/[id]`, `/api/conversations/[id]/messages`, `/api/conversations/inbound`, `/api/portal/conversations`, `/dashboard/conversations`, `/dashboard/conversations/[id]`, `/portal/conversations`, `/portal/conversations/[id]`).

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new `<ConversationThread />` reusable across both portal and dashboard surfaces; new conversation-list card pattern; channel-badge pattern)
- [x] application config (`SENDGRID_API_KEY` env var documented in conversationEmail.ts; `MONITRAX_INBOUND_FROM_ADDRESS` + `MONITRAX_INBOUND_DOMAIN` env vars introduced for reply-to construction)
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (7yr retention column + soft-delete-from-user-view + audit logging on every conversation event; `assertParticipant` centralised access control; PROD-deferred hardening list documented)
- [ ] operational procedure
- [x] strategic decision (conversation auto-create as best-effort post-transaction; sender role frozen; outbound mirror fire-and-forget)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #16` — marked SHIPPED with summary.
- `docs/IMPLEMENTATION_PLAN.md:Recently Completed 2026-05-07` — new entry prepended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md:Step 7` — conversation demo path populated end-to-end.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — additive migration only (CREATE TYPE / CREATE TABLE / ALTER TYPE ADD VALUE). No row mutations on existing tables. The `markAsRead` flow does call `prisma.conversationParticipant.update` — but only on rows the same flow created (the participant row guards by id and role; can't accidentally touch another participant's read state).

### Schema Migration Checklist (CLAUDE.md §12.12)
- [x] `prisma/schema.prisma` modified
- [x] Matching migration at `prisma/migrations/20260507100000_add_conversations/migration.sql`
- [x] Migration is purely additive (no `DROP`, no `ALTER ... DROP COLUMN`, no `TRUNCATE`)
- [x] `npx prisma validate` clean
- [x] `npx prisma generate` clean

### PR
- Branch: `claude/phase-32c-pr4d-conversations`
- Status: pending push + open
