# Changelog — 2026-05-05

## Session: claude/phase-41e-cleanup-a-constants (Phase 41e.−1 cleanup PR A — extend `TaxYearConfig` + add FY25-26)

### Changes Made
- **Type:** Refactor / config (Phase 41e.−1 cleanup, slice A — pure additive type + config extension; zero consumer changes; zero behaviour changes)
- **Scope:** Extends `TaxYearConfig` with new canonical homes for previously-hard-coded values per `PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §10.1: `label`, `superGuaranteeQuarterlyCap`, `superContributionsTaxRate`, `coContributionIncomeThreshold`, `carryForwardTsbThreshold`, `bringForwardThresholds`, `reviewSchedule`. Backfills FY23-24 + FY24-25 with the new fields (using values that match what the consumers currently hard-code). Adds `TAX_YEAR_2025_26` (resolves audit C-4: FY25-26 was missing from the canonical config). Per-FY `reviewSchedule.nextReviewBy: 2026-06-15` forces an explicit human review checkpoint before each new FY commences.
- **Why slice A first:** Lowest-risk cut of the cleanup PR. Pure additive — every consumer continues reading the existing fields it always has. New fields are present but unused by consumers in this PR. Slice B migrates consumers (`/api/tax/super/*`, `taxIntegration.ts`, `taxAnalyzer.ts`, dashboard tax page brackets table) to the new fields. Slice C handles the `buildTaxSummary()` regression trap. Slice D adds archetype fixtures + master-config self-test.

### Files Modified
- `lib/tax-engine/types.ts` — `TaxYearConfig` extended with 7 new required fields. New supporting types: `BringForwardThresholds`, `TaxYearReviewSchedule`. JSDoc on every new field with its primary-authority citation (ITAA section / ATO source).
- `lib/tax-engine/config/taxYearConfig.ts` — file header docs the SSOT contract per CLAUDE.md §12.2 + audit doc §10.1. `TAX_YEAR_2024_25` and `TAX_YEAR_2023_24` populated with the new fields using values that match what consumers currently hard-code (so swapping consumers to read from config in slice B is a behaviour-preserving refactor). `TAX_YEAR_2025_26` added as a new export (carries forward most thresholds; SG rises to 12% per ATO schedule; preliminary $65,250 quarterly cap pending ATO confirmation by 2026-06-15). `TAX_YEAR_CONFIGS` registry includes all three FYs.

### Build Status
- [x] `npx tsc --noEmit` — clean, exit 0 (after `npx prisma generate` to refresh the marketplace model from PR #620; pre-existing errors only).
- Pure additive: no consumer compiled differently. Required-fields addition flagged at compile time if any new FY config is added in the future without populating them.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [ ] visual / config / GCP / identity / deployment / security / operational / data model / strategic decision

Docs updated:
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.
- (Audit doc + IMPLEMENTATION_PLAN.md not updated — slice A doesn't change strategy or close any audit decision; full closure of audit findings C-1 through C-4 + H-1 through H-6 lands across slices A-D, doc updates batched at slice D.)

### What's next
- **Slice B** — migrate consumers to read from the new config fields: `/api/tax/super/route.ts`, `/api/tax/super/optimize/route.ts` (6× `0.15` + `60400` co-contrib threshold), `/api/tax/super/contributions/route.ts`, `lib/cfo/decisionSupport/taxIntegration.ts:185+350+426`, `lib/strategy/analyzers/taxAnalyzer.ts:129` (assumed 30% marginal → `getMarginalRate()`), `app/dashboard/tax/page.tsx:446-470` (hard-coded brackets table → `config.brackets`), `app/dashboard/tax/page.tsx:759` (hard-coded SG rate → `config.superGuaranteeRate`). Resolves audit C-2 + H-1 + H-2 + H-3 + H-4 + H-5.
- **Slice C** — replace `buildTaxSummary()` regression trap (`masterFinancialService.ts:1012-1077`) with delegation to `calculateTaxPosition()`. Snapshot test asserts numerical parity with `/api/tax/position`. Resolves audit C-1.
- **Slice D** — Sarah Kim / David+Emma / Olivia archetype fixtures + master-config self-test + parity-baseline snapshots. Captures pre-refactor baselines for slices E onwards (the actual 41e rule modules).

### PR
- Branch: `claude/phase-41e-cleanup-a-constants`
- PR URL: TBD on push

---

## Session: claude/phase-32c-pr4b-askapro (Phase 32C PR4b — AskAProfessionalButton + picker SHIPPED)

### Changes Made
- **Type:** Feature (Demo-Complete Critical Path; closes Up Next #14)
- **Scope:** In-app bridge between the consumer surface and the professional marketplace. `<AskAProfessionalButton />` primitive + `<AskAProfessionalDialog />` picker, server-driven candidate resolver with leaky-funnel guardrail enforced server-side.
- **Description:** D2C users see top-3 best-fit marketplace listings biased by the calling context. Org-attached users see ONLY their org's roster (other orgs and public marketplace never returned). Wired into the AI Guide recommendation card so every advice category gets a contextually-biased picker.

### Files Created
- `lib/services/askAProfessionalService.ts` — canonical resolver. `getCandidatesForUser(userId, context?)`. Open-ended `CONTEXT_BIAS` map (tax / retirement / refinance / property / smsf / wealth / trust / business / estate / insurance / home-loan / investment-loan / general). Returns `{ scope: 'org' | 'public', ... }`. Public-path ranks top-12 by rating then re-ranks by `matchScore = matched_specialisations + averageRating/10` and slices to top-3.
- `app/api/ask-a-pro/candidates/route.ts` — thin GET wrapper. `withPermission('report.read')` (lightest-touch every authenticated role has — discovery surface, not CDR-data).
- `components/ask-a-pro/AskAProfessionalButton.tsx` — primitive. Three variants (primary full pill / compact inline pill / icon-only 32×32). Focus-visible ring, ARIA-haspopup="dialog".
- `components/ask-a-pro/AskAProfessionalDialog.tsx` — picker. Right-edge slide-in ≥sm / bottom-sheet 90vh on <sm. Sticky header with title + context hint. Body-scroll lock. Esc to close, backdrop click to close, prefers-reduced-motion-aware via Tailwind `motion-safe:*` utilities. Branches on scope: org-scope shows assigned advisor highlighted in emerald glass tile + roster grouped under "Or another team member" (excludes VIEWER seats — they don't take inbound); public-scope shows 3 best-fit cards with rating + tagline + discipline label, "See all professionals →" footer to `/marketplace`. Member click → `/portal-message?memberId=<id>` placeholder (PR4d wires the in-app conversation thread); listing click → `/marketplace/[slug]` (existing Connect CTA is the entry to PR4c request lifecycle). Unauthenticated path returns 401 → dialog renders friendly "Create a free Monitrax account" nudge linking to `/register`.
- `components/ask-a-pro/index.ts` — barrel.

### Files Modified
- `lib/services/index.ts` — re-exports the new service surface (`getCandidatesForUser`, `isKnownContext`, types).
- `components/cfo/AdviceRecommendationCard.tsx` — adds `<AskAProfessionalButton variant="compact" context={CATEGORY_TO_ASK_A_PRO_CONTEXT[rec.category]} />` next to "Ask a follow-up". New `CATEGORY_TO_ASK_A_PRO_CONTEXT` map (tax → tax, debt → refinance, property → property, investment → wealth, risk → insurance, cashflow/spending → general, savings → wealth) so each advice category opens the picker pre-biased to the right specialisation.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #14 marked SHIPPED with summary; new Recently Completed entry prepended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 6c updated: the in-context AskAPro path is now demonstrable end-to-end.

### Architecture Decisions
- **Leaky-funnel guardrail enforced server-side.** Org-attached users (any active+granted `OrganizationClient` row) never see public marketplace listings via the API. Strategic decision per IMPLEMENTATION_PLAN.md Up Next #15 (2026-05-04): orgs pay for Monitrax to be their CRM + comms channel; the platform must not redirect their clients to competitors.
- **Context as open-ended free-text label, not enum.** Calling surfaces pass a string label (`'tax'`, `'refinance'`, etc.) rather than picking from a fixed enum. Lets new contexts be added without service / schema changes; unknown contexts fall through to rating-only ranking. The `CONTEXT_BIAS` map is the single source of truth — adding a new context is one map entry.
- **Zero new dependencies.** Dialog uses Tailwind `motion-safe:*` utility variants (which already work in the existing build) instead of pulling `framer-motion` just for two animations. Lighter footprint, same UX.
- **PR4c not in scope.** This PR ships the picker only. The full request lifecycle (compose question → submit → adviser inbox → ACCEPT (lead fee billed) / DECLINE → consent invite → ClientLink materialises) is PR4c. The picker hands off via:
  - D2C: navigate to `/marketplace/[slug]` where the existing Connect CTA awaits.
  - Org-attached: navigate to `/portal-message?memberId=<id>` placeholder (PR4d wires the in-app conversation thread).
- **Permission gate `report.read`.** Reused the lightest-touch authenticated permission rather than introducing a new `marketplace:browse` permission. The picker is a discovery surface; gating it tighter would prevent VIEWER-role users from ever connecting with their org's roster.

### Build Status
- [x] `npx tsc --noEmit` — clean, exit 0.
- [x] `npx next build` — green; `/api/ask-a-pro/candidates` registered.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new `<AskAProfessionalButton />` primitive + dialog pattern, reusable across surfaces)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #14` — marked SHIPPED.
- `docs/IMPLEMENTATION_PLAN.md:Recently Completed 2026-05-05` — new entry prepended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md:Step 6c` — in-context AskAPro path now demonstrable.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### PR
- Branch: `claude/phase-32c-pr4b-askapro`
- Status: pending push + open

---

## Session: claude/phase-32c-pr4a-marketplace (Phase 32C PR4a — Professional Marketplace SHIPPED)

### Changes Made
- **Type:** Feature (Demo-Complete Critical Path; closes Up Next #13; first Phase 32C deliverable; built in parallel with Session D's Phase 41 — zero territory overlap)
- **Scope:** Professional marketplace MVP — Org-side listing editor + Monitrax admin approval queue + public browse + public listing detail.

### Files Created
- `prisma/migrations/20260505140000_add_professional_marketplace/migration.sql` — additive: 4 new enums + extension of `AuditAction` with 5 new values + `professional_listings` + `professional_ratings` tables + indexes + FKs.
- `lib/services/marketplaceService.ts` — canonical service with three caller scopes (Org / admin / public). Submit-time validation, status-transition guards, slug helpers, typed error codes.
- `app/api/portal/organizations/[orgId]/marketplace-listing/route.ts` — GET/PUT.
- `app/api/portal/organizations/[orgId]/marketplace-listing/submit/route.ts` — POST. PORTAL_OWNER only.
- `app/api/admin/marketplace/listings/route.ts` — GET admin queue.
- `app/api/admin/marketplace/listings/[id]/route.ts` — GET/POST. POST takes `{ action: 'approve' | 'reject' | 'suspend', ... }`.
- `app/api/marketplace/listings/route.ts` — GET public browse. APPROVED only.
- `app/api/marketplace/listings/[slug]/route.ts` — GET public detail with 10 most recent public ratings.
- `components/portal/marketplace/MarketplaceListingEditor.tsx` — Org-side editor (~470 lines). Discipline-conditional compliance fields, accessible checkbox groups, sticky bottom action bar, REJECTED/SUSPENDED feedback panels.
- `app/portal/marketplace/listing/page.tsx` — Org-side listing page wrapping the editor with status badge and apple-glass aesthetic.
- `app/admin/marketplace/listings/page.tsx` — Admin queue. Defaults to PENDING_REVIEW filter.
- `app/admin/marketplace/listings/[id]/page.tsx` — Admin detail with deeplinks to ASIC moneysmart / TPB public register / ABR for cross-check, manual cross-check checkboxes, free-text verificationNotes, approve/reject/suspend buttons.
- `app/marketplace/layout.tsx` — public marketplace chrome.
- `app/marketplace/page.tsx` — public browse with filters and sorted listing cards.
- `app/marketplace/[slug]/page.tsx` — public listing detail with full blurb, specialisations, target tiers, regions, recent ratings, "Connect" CTA.

### Files Modified
- `prisma/schema.prisma` — added `ProfessionalListing` + `ProfessionalRating` models + 4 enums + 5 AuditAction values + reverse relations on `Organization`, `User`, `AdminUser`.
- `lib/services/index.ts` — re-exports the marketplace service surface.
- `lib/portal/permissions.ts` — added `marketplace:listing:read|write|submit` permission types and role mapping (OWNER full, ADMIN read+write, ADVISOR/VIEWER read-only).
- `lib/admin/permissions.ts` — added `marketplace:listings:read|approve|reject|suspend` permission types and role mapping (SUPER_ADMIN full, SUPPORT_ADMIN + VIEWER read-only) + PERMISSION_DESCRIPTIONS entries.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #13 marked SHIPPED + new Recently Completed entry prepended for 2026-05-05.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 6 marketplace section populated with the demo path.

### Architecture Decisions
- **Zero new dependencies.** Reused existing Apple-glass tokens, admin UI primitives, service patterns. No extra packages.
- **One service, three scopes.** Viewer scope is a parameter (filter shape), not a fork (CLAUDE.md §0 architect lens / §12.3).
- **Lead-fee tiers stored per-listing.** Defaults AU$80/$150/$250 by Emerging/Growing/Established bracket (per IMPLEMENTATION_PLAN.md Up Next #15). Per-Org overrides at admin-approval time.
- **Status-transition guards in the service.** Editing an APPROVED listing flips back to PENDING_REVIEW; editing a REJECTED listing returns to DRAFT.
- **Submit-only for OWNER.** Mirrors `team:invite` anti-poaching guardrail (PR #603) — submitting publishes firm's public profile + binds to lead-fee contract; commercial decision belongs to Org owner.
- **Manual ASIC/TPB cross-check at v1.** Admin detail has one-tap register deeplinks + timestamped checkboxes + verificationNotes scratchpad. Automated API cross-check defers to PROD.

### Build Status
- [x] `npx tsc --noEmit` — clean, exit 0.
- [x] `npx next build` — green, exit 0. All 11 marketplace routes registered.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new `MarketplaceListingEditor` + public marketplace card / detail patterns)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (lead-fee tier defaults baked into schema; submit-for-review owner-only)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #13` — marked SHIPPED with summary.
- `docs/IMPLEMENTATION_PLAN.md:Recently Completed 2026-05-05` — new entry prepended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md:Step 6` — marketplace section populated.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — migration is purely additive (CREATE TYPE / CREATE TABLE / ALTER TYPE ADD VALUE). No `update`, `upsert`, `delete`, `updateMany`, `deleteMany`, or raw SQL `UPDATE`/`DELETE` on existing rows.

### Schema Migration Checklist (CLAUDE.md §12.12)
- [x] `prisma/schema.prisma` modified
- [x] Matching migration at `prisma/migrations/20260505140000_add_professional_marketplace/migration.sql`
- [x] Migration is purely additive
- [x] `npx prisma validate` clean
- [x] `npx prisma generate` clean

### PR
- Branch: `claude/phase-32c-pr4a-marketplace`
- Status: pending push + open

---

## Session: claude/phase-41d-money-flow-sankey (Phase 41d — Money Flow Sankey at /dashboard/entities)

### Changes Made

- **Type**: Feature — new visualisation surface (the second wow moment in the lighthouse pitch, Step 4)
- **Scope**: `lib/services/moneyFlowService.ts` (NEW), `lib/services/index.ts` (re-exports), `app/api/money-flow/route.ts` (NEW), `components/entities/MoneyFlowSankey.tsx` (NEW), `app/dashboard/entities/page.tsx` (tab toggle + lazy fetch + Money Flow tab content), `docs/IMPLEMENTATION_PLAN.md`, `docs/architecture/03_DATA_MODEL.md` (new §10.10), `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` (Step 4)
- **Description**: Money Flow Sankey — 3-stage flow visualisation at `/dashboard/entities` (Money Flow tab) showing **Income sources** (Salary / Rental / Investment / Other) → **Legal entities** (role-coloured, matching the Phase 41c tree palette) → **Outflows** (Tax / Essential expenses / Discretionary / Loan repayments / Surplus). The natural complement to the 41c entity tree — the tree shows *what you own*, the Sankey shows *how money moves through it*.

### Why this matters

Per Reza directive 2026-05-04 ("Sankey IN demo-complete (Reza preference: 'sounds nicer')"), the Sankey is part of the demo-complete path, not deferred. Per the lighthouse pitch playbook Step 4, this is the **second wow moment** after the entity tree — *"This is where Olivia's money actually goes. Right now this conversation happens on a whiteboard with you and her every six months. Now it's live."* The visceral "where my salary goes" reaction is what advisers cite as proof Monitrax thinks like an adviser, not an accountant.

### Files Created / Modified

- **`lib/services/moneyFlowService.ts`** (NEW, ~290 lines) — `getMoneyFlow(userId)` orchestrator. Pulls Income / Expense / Loan rows in parallel, classifies income by source label (SALARY → Salary; RENTAL/RENT → Rental; INVESTMENT → Investment; everything else → Other), aggregates expenses by entity × essential/discretionary, computes loan repayments per entity from `minRepayment` annualised via canonical `toAnnual`, allocates tax (PAYG withholding) proportionally to each entity's share of taxable income, and computes surplus as the residual (clamped to ≥0 — the layout can't draw negative-width links). Returns a flat sankey-friendly shape with `incomeSources[]`, `entities[]`, `outflows[]`, and `edges[]` keyed by stable `src:` / `ent:` / `out:` ids.
- **`lib/services/index.ts`** — re-exports `getMoneyFlow` + types.
- **`app/api/money-flow/route.ts`** (NEW) — thin GET wrapper, `withPermission('report.read')` (same gate as `/api/master-snapshot`). Surfaces underlying error message in the catch handler so the page error block can render something useful.
- **`components/entities/MoneyFlowSankey.tsx`** (NEW, ~360 lines) — recharts `<Sankey>` rendered with custom Node + Tooltip. Role-coloured entity nodes (PERSONAL warm amber → OPERATING emerald → HOLDING indigo → SUPERANNUATION violet → INVESTMENT fuchsia, matching the 41c tree palette). Cool-tinted income sources (sky/teal/cyan); warm-tinted outflows (red/orange/amber/purple) with surplus emerald. Headline-summary chip strip above the canvas (Income / Tax / Essentials / Discretionary / Loans / Surplus or Deficit) so the viewer reads totals before tracing flows. Honest italic caveat below the canvas: *"Annual reference period. Tax allocated proportionally across entities; exact Div 6/6E trust distribution math lands with Phase 41e."* `prefers-reduced-motion` honoured. Empty state: friendly "Not enough data to draw your money flow yet" hero when income or expenses are zero.
- **`app/dashboard/entities/page.tsx`** — new tab toggle (Structure | Money Flow); tab state lifted to the page; `fetchFlow` callback with same Bearer-token auth pattern; lazy-fetch on first tab activation; cache invalidates on entity mutation (so the Sankey re-renders when the user adds/edits/removes an entity from the Structure tab).

### v1 heuristics (replaced by Phase 41e)

- **Tax allocation is proportional** to each entity's share of taxable income across the household. Real per-entity tax requires Div 6/6E trust distribution math (Phase 41e.1 / 41e.4 per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md`); v1 is honest about this with an inline italic caveat below the Sankey.
- **Loan repayments** use `minRepayment` annualised — no interest/principal split, no offset-account effect on effective interest. The entity-aware tax engine (Phase 41e.5 / 41e.7) will compute deductible vs. non-deductible interest correctly.
- **Surplus** is the arithmetic residual; deficits surface in the headline chip as `Deficit $X`.

### Why recharts (not @nivo/sankey, not d3-sankey)

Evaluated and rejected per CLAUDE.md §12.7 + §12.8 (zero new dependencies):

- `recharts` is **already in deps** (v3.5.0); has `<Sankey>` built-in.
- `@nivo/sankey` would add ~150-200 KB (full nivo runtime).
- `d3-sankey` would add ~30 KB but requires writing the SVG renderer ourselves.

### Build Status
- [x] TypeScript compilation passes — `npx tsc --noEmit` exits 0
- [x] No new dependencies added
- [x] Prisma schema unchanged
- [ ] Vercel preview build — to be verified after push

### CLAUDE.md §16 doc-sync block

Surfaces changed in this PR:
- [x] visual design system / component pattern (new MoneyFlowSankey component, role-coloured entity nodes mirror 41c palette for cohesion)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture (Sankey shows aggregated dollar amounts only — no per-row CDR data; same `report.read` permission as `/api/master-snapshot`)
- [ ] operational procedure
- [ ] strategic decision
- [x] data model (no schema change but new service + API for entity-aware money-flow aggregation)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #28 ✅ SHIPPED with full detail; Recently Completed entry for 2026-05-05 prepended
- `docs/architecture/03_DATA_MODEL.md` — §10.7 marker flipped to ✅ for 41d; new §10.10 (component anatomy + income classification + outflow buckets + v1 heuristics + visual rules + why-recharts + 41e/g/h unlocks)
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 4 expanded with concrete flow walkthrough (headline chip strip read-aloud, hover-the-largest-flow demo, profession-specific 'leak' framing, architectural-honesty caveat ready to read aloud if asked)
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry

### Test plan (for Reza after preview goes live)

1. **Tab toggle works.** Open `/dashboard/entities`. The Structure tab is selected by default and renders the 41c tree (or no-structure hero). Click "Money Flow" tab — Sankey loads.
2. **Sankey renders for users with data.** With at least one Income row and one Expense row, the Sankey draws three columns. Income sources on the left, entities in the middle, outflows on the right.
3. **Headline chip strip is accurate.** Sum the chips: Income should equal sum of source nodes; Surplus should equal Income − Tax − Essentials − Discretionary − Loans. If Surplus is negative the chip says "Deficit" in rose.
4. **Tooltip on hover.** Hovering a link shows `Source → Target $X per year`. Hovering a node shows the total flow through that node.
5. **Live updates.** Switch to Structure tab, add a new entity, switch back to Money Flow — the Sankey refetches and renders the new structure.
6. **Empty state.** A user with zero income (or zero expenses) sees the friendly "Not enough data…" hero, not a broken empty Sankey.
7. **Error path.** If `/api/money-flow` 5xx's, the error block surfaces the real status + message (no `[object Object]` regression — uses the same `extractErrorMessage` helper as the entities fetch).
8. **`prefers-reduced-motion`** respected — entrance fade collapses; the Sankey itself has no transition.

### What's NOT in this PR

- **No Div 6/6E exact distribution math.** v1 tax allocation is proportional; flagged inline. Lands with Phase 41e.1 + 41e.4.
- **No interest/principal split on loans.** Loan repayments are gross `minRepayment` annualised; deductible-interest treatment lands with 41e.5 / 41e.7.
- **No monthly toggle.** Annual reference period only at v1; can add a Monthly/Quarterly switch if there's adviser-pitch demand.
- **No drill-in from a flow.** Clicking a link doesn't navigate yet (the recharts Sankey doesn't expose link clicks easily); could be added later if useful.
- **No "share Sankey as PNG" export.** Phase 41g (adviser overlay extension) may need this; defer until then.

### PR
- Branch: `claude/phase-41d-money-flow-sankey`
- PR URL: TBD on push

---

## Session: claude/phase-41g-adviser-overlay-entity (Phase 41g — Adviser drill-in entity layer)

### Changes Made

- **Type**: Feature — adviser drill-in surface extended with entity tree + Sankey
- **Scope**: `lib/portal/adviserClientAccess.ts` (NEW shared helper), `app/api/portal/clients/[id]/entities/route.ts` (NEW), `app/api/portal/clients/[id]/money-flow/route.ts` (NEW), `app/api/portal/clients/[id]/snapshot/route.ts` (refactored to use the shared helper), `app/portal/clients/[id]/view/page.tsx` (3-tab toggle + parallel fetches + tree/Sankey mounts), `docs/IMPLEMENTATION_PLAN.md`, `docs/architecture/03_DATA_MODEL.md` (new §10.11), `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` (Step 2/3 flipped to LIVE)
- **Description**: Mount the Phase 41c `EntityTree` and Phase 41d `MoneyFlowSankey` inside `/portal/clients/[id]/view` so when an adviser opens a client, the entity tree is the **primary diagnostic** they see first (default tab). 3-tab toggle: **Structure** (default) | **Money Flow** | **Dashboard** (the existing canonical view from 32B PR3). Tabs mean Step 2 → Step 3 → Step 4 of the lighthouse pitch is one continuous flow, no nav-switching.

### Why this matters

Per Reza brief 2026-05-04: *"the adviser cannot give wealth advice without seeing the structure first; this surfaces it prominently."* Phase 41a–d shipped the consumer-side entity layer; 41g is what makes it reachable in the adviser pitch. Without 41g, the lighthouse pitch's Step 3 (entity tree, the *moat moment*) requires the adviser to navigate to a different page — breaks the flow. With 41g, it's the default view of the drill-in.

### Files Created / Modified

- **`lib/portal/adviserClientAccess.ts`** (NEW, ~150 lines) — shared helper `verifyAdviserClientAccess(callerUserId, organizationClientId)` that does the layered consent + membership + role + assignment checks. Returns either `{ ok: true, orgClient, membership }` or a structured error with `{ ok: false, status, code, message }`. **Reviewers reject any new portal client-data endpoint that doesn't route through this helper** (CLAUDE.md §0 architect lens — single canonical access guard).
- **`app/api/portal/clients/[id]/snapshot/route.ts`** — refactored to delegate auth to `verifyAdviserClientAccess`. Removed inline duplication of consent/membership/role/assignment checks (~75 lines of code consolidated). Behaviour unchanged.
- **`app/api/portal/clients/[id]/entities/route.ts`** (NEW) — thin GET wrapper. Auth via `verifyAdviserClientAccess`; delegates to canonical `listEntitiesForUser` (same service the consumer `/api/entities` uses) but passes the **client's** userId. Returns `{ entities, members }` — household members fetched via `where: { householdProfile: { userId: client.userId } }`.
- **`app/api/portal/clients/[id]/money-flow/route.ts`** (NEW) — thin GET wrapper. Auth via the same helper; delegates to canonical `getMoneyFlow` with the client's userId. Service swap is internal — when Phase 41e replaces the proportional tax allocation with Div 6/6E, this endpoint surface stays unchanged.
- **`app/portal/clients/[id]/view/page.tsx`** — added `tab` state (defaulting to `'structure'`), `entities` + `members` + `flow` state, parallel-fetch logic (snapshot + entities + flow in one `Promise.all`), 3-tab toggle (Structure / Money Flow / Dashboard) with active styling, and tab-content branching. Snapshot is treated as the primary load (its failure blocks the page); entities + flow failures are best-effort (the tree's empty state and Sankey's `isEmpty` handling cover those).

### Audit

The page-level `/snapshot` request already writes a `PRO_DASHBOARD_VIEW` row to `ClientAccessLog` for the view session. The new entities + money-flow endpoints **piggyback** on that row — they don't write their own. Multiplying audit rows per component would pollute the compliance log without adding signal. If component-level access logs are ever required for compliance, we add new action codes (`PRO_ENTITY_VIEW`, `PRO_MONEY_FLOW_VIEW`) and emit them at the route layer.

### Read-only in adviser view

Advisers can NOT edit a client's entity layer:
- The `EntityTree`'s `onEntityClick` is a no-op (no edit dialog opens for advisers)
- The `EntityTree`'s `onAdd` is a no-op (no Add CTA fires)
- No `EntityFormDialog` mounted on the adviser page

This is deliberate: editing a client's structure is a personal-advice activity that needs to happen through the proper Ask-a-Pro / consent channels (Phase 32C), not via a side-door API the adviser can hit because they have a viewing seat. A future Phase 41 slice may surface a *"Suggest a structural change"* affordance that opens an Ask-a-Pro thread for the client to action.

### Failure modes

- **Snapshot fails** → page shows the existing "Cannot view this client" error; entities/flow don't load.
- **Entities fail** → Structure tab renders with empty arrays; the EntityTree's empty-state hero shows.
- **Money flow fails** → Money Flow tab renders the friendly "No money flow data available for this client yet" message.
- **Dashboard tab** is unaffected by entities/flow failures — only depends on snapshot.

### Build Status
- [x] TypeScript compilation passes — `npx tsc --noEmit` exits 0
- [x] No new dependencies added
- [x] Prisma schema unchanged

### CLAUDE.md §16 doc-sync block

Surfaces changed in this PR:
- [x] visual design system / component pattern (3-tab toggle on adviser drill-in; reuses Phase 41c/d components verbatim)
- [ ] application config
- [ ] GCP infrastructure
- [x] identity / auth (`verifyAdviserClientAccess` shared helper consolidates consent + membership + role + assignment checks across 3 portal endpoints)
- [ ] deployment / build
- [x] security / CDR posture (canonical scope source-of-truth = DB row, not caller-provided; 3-layer consent model preserved end-to-end; audit piggyback policy documented)
- [ ] operational procedure
- [ ] strategic decision
- [x] data model (no schema change but new portal endpoints + shared access helper)

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #31 ✅ SHIPPED with full detail; Recently Completed entry prepended
- `docs/architecture/03_DATA_MODEL.md` — §10.7 marker flipped to ✅ for 41g; new §10.11 (auth guard, audit policy, read-only constraint, failure modes, 41h unlock)
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 2 expanded to mention the tab toggle (Structure default, Money Flow + Dashboard one click away); Step 3 pre-condition flipped from "Phase 41a-c required" to "✅ LIVE 2026-05-05"
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry

### Test plan

1. **Adviser opens Sarah Kim's drill-in.** Navigate to `/portal/clients/{id}/view` (Sarah's organizationClientId). Page loads with Structure tab selected by default. Entity tree shows Sarah → Sarah Kim Pty Ltd. Adviser overlay docked right.
2. **Money Flow tab.** Click "Money Flow" tab. Sankey renders Sarah's actual income → entities → outflows. Headline chip strip above shows annual totals.
3. **Dashboard tab.** Click "Dashboard". The existing canonical consumer dashboard renders (KPI strip, health card, etc.). This is the legacy 32B PR3 view, unchanged.
4. **Read-only entity tree.** Click any entity tile in Structure tab — nothing happens (no edit dialog). Click the "Add" CTA — nothing happens. Verify advisers cannot edit a client's entity layer.
5. **Olivia Novak full structure.** Switch to Olivia's drill-in. Structure tab shows all 5 entities (Olivia personal, Pty Ltd, Discretionary Trust, Unit Trust, SMSF) with the dashed corporate-trustee line.
6. **Consent revoked.** If a client's consent is revoked while the adviser has the page open, refresh — page shows the consent-not-granted error block (covered by `verifyAdviserClientAccess` layer 2).
7. **PORTAL_ADVISOR not assigned.** Log in as a PORTAL_ADVISOR seat that's NOT assigned to the client. Open the URL directly. Page returns 403 `CLIENT_NOT_ASSIGNED` (covered by `verifyAdviserClientAccess` layer 5).
8. **Audit log.** Check `client_access_logs` table — exactly ONE `PRO_DASHBOARD_VIEW` row written per page load (snapshot endpoint), not three.

### What's NOT in this PR

- **No write affordance for advisers** on the entity layer (read-only by design).
- **No "Suggest a structural change" Ask-a-Pro thread.** Future slice.
- **No per-component audit rows** (`PRO_ENTITY_VIEW` etc.). Page-level `PRO_DASHBOARD_VIEW` covers it; revisit if compliance demands finer granularity.
- **Phase 41f (Xero/MYOB integration)** — separate workstream.
- **Phase 41h (AI entity-aware diagnosis)** — separate workstream; depends on 41e.0 + 41e.17.

### PR
- Branch: `claude/phase-41g-adviser-overlay-entity`
- PR URL: TBD on push

---

## Session: claude/phase-41e-audit-pr2-combinations (Phase 41e audit + migration plan PR 2/4 — architectural decision + multi-entity combinations matrix)

### Changes Made
- **Type:** Docs (PR 2/4 of the four-PR audit gating Phase 41e.0; doc-only, no code, no schema)
- **Scope:** Locks in three foundational decisions for the entity-aware tax engine: (1) layer 41e on top of the existing 3,776-LOC Phase 20 tax engine rather than rewrite, (2) the multi-entity ownership combinations matrix (which entity types can legally own which financial-object types under AU law + per-cell tax dispatch rule), (3) the eight cross-entity flow scenarios 41e must dispatch correctly (corporate trustee, Div 7A, trust-to-trust streaming, trust→PERSONAL distribution, SMSF contributions, LRBA, PSI through Pty Ltd, BRP acquisition).

### Files Modified
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — appended §4 (architectural decision: layer-don't-rewrite with rejected alternatives, layer-boundary diagram, consumer-rewiring summary, new canonical entry points), §5 (multi-entity combinations matrix: legend, 7×7 entity×object table with per-cell AU rule + authority citation, schema-vs-AU-vs-calc divergence map listing every cell where the schema is broader than AU law and the wizard/calc engine must enforce, indirect ownership table for corporate-trustee + custodian + service-entity + LRBA bare trust + SMSF-held unit trust, eight cross-entity flow scenarios with the calc-engine module each one triggers, UNCOMPUTED list deferred to PR 4), §6 (refreshed What's Next pointing at PR 3-4).
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #29 updated: PR 1/4 marked merged 2026-05-05; PR 2/4 narrative added (combinations matrix + cross-entity flow scenarios); hard-prerequisite gate on the full 4-PR audit retained.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] strategic decision — locks in Phase 41e architectural approach (layer-don't-rewrite) + entity ownership rules
- [ ] visual / config / GCP / identity / deployment / security / operational / data model

Docs updated:
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — §4, §5, §6 appended
- `docs/IMPLEMENTATION_PLAN.md` Up Next #29 — narrative refresh

### Testing
- [x] Markdown renders cleanly
- [ ] Reza sign-off on PR 2 — pending

### What's next
- After Reza signs off PR 2, branch off main and ship PR 3 (per-rule SSOT migration map + per-engine downstream impact + parentEntityId cycle-detection spec).
- After PR 3 signs off, ship PR 4 (refined sub-PR sequencing + snapshot-test fixture strategy + constants reconciliation + FY25-26 config gap + UNCOMPUTED additions + Reza sign-off block that gates 41e.0).
- 41e.0 starts only after PR 4 sign-off.

### PR
- Branch: `claude/phase-41e-audit-pr2-combinations`
- PR URL: https://github.com/resadegh/monitrax/pull/622

---

## Session: claude/phase-41e-audit-pr3-migration-map (Phase 41e audit + migration plan PR 3/4 — per-rule SSOT migration map + per-engine downstream impact + cycle-detection spec)

### Changes Made
- **Type:** Docs (PR 3/4 of the four-PR audit gating Phase 41e.0; doc-only, no code, no schema; stacked on PR 2/4 branch since both edit the same doc sequentially — will rebase clean once PR 2 merges)
- **Scope:** Per-file migration verdict for every Phase 20 module + every aggregator + every tax route + every cross-engine consumer. Constants reconciliation table consolidating C-2, H-1, H-2, H-3, H-4, H-5, H-6 into a single source-of-truth map. `parentEntityId` cycle-detection validation contract for `legalEntityService.ts`.

### Files Modified
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — appended §6 (per-rule SSOT migration map: verdict legend; Phase 20 per-file map showing 8 files preserved untouched + 5 additive EXTENDs; aggregator per-file map with C-3 resolution; tax routes per-file map with constants reconciliation; constants reconciliation table mapping every hard-coded value to its canonical home in `taxYearConfig.ts`; non-tax engine touch list with verification requirements; per-route migration impact showing zero URL changes + zero breaking response shape changes; new endpoints introduced by 41e), §7 (`parentEntityId` cycle-detection spec: 4 rules — self-parent forbidden / no chain cycles / max depth 10 / type-compatibility advisory; pseudocode for `validateParentChain()`; database CHECK constraint as defence-in-depth; 8 required tests), §8 (refreshed What's Next pointing at PR 4).
- `docs/IMPLEMENTATION_PLAN.md` Up Next #29 — narrative refresh: PR 2/4 marked open; PR 3/4 narrative added.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] strategic decision — locks in the per-file SSOT migration plan + cycle-detection contract
- [ ] visual / config / GCP / identity / deployment / security / operational / data model

Docs updated:
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — §6, §7, §8 appended
- `docs/IMPLEMENTATION_PLAN.md` Up Next #29 — narrative refresh

### Testing
- [x] Markdown renders cleanly
- [x] Every constant from §3 critical findings register has a row in the §6.5 reconciliation table
- [x] Every Phase 20 file from §2.1 has a verdict in §6.2
- [ ] Reza sign-off on PR 3 — pending

### What's next
- After Reza signs off PR 3, PR 4 (final) lands: refined sub-PR sequencing + snapshot-test fixture strategy + constants reconciliation v2 + FY25-26 config + UNCOMPUTED additions + Reza sign-off block that gates 41e.0.

### PR
- Branch: `claude/phase-41e-audit-pr3-migration-map` (stacked on `claude/phase-41e-audit-pr2-combinations`)
- PR URL: https://github.com/resadegh/monitrax/pull/623

---

## Session: claude/phase-41e-audit-pr4-final (Phase 41e audit + migration plan PR 4/4 — refined sequencing + fixture strategy + UNCOMPUTED register + Reza sign-off block)

### Changes Made
- **Type:** Docs (PR 4/4 — final audit PR; doc-only, no code, no schema). Closes the 4-PR Phase 41e audit + migration plan workstream. Cherry-picked PR 3 commit `259d0ad` because it didn't propagate to main when PR 2 was merged (PR 3 was stacked on PR 2's branch; PR 2 was merged from the branch tip without PR 3's commit).
- **Scope:** The five pieces that turn the audit from analysis into an executable contract: refined 18-sub-PR sequencing with the `41e.−1` cleanup PR inserted ahead of `41e.0` and SMSF tax dispatch reordered ahead of trust streaming; snapshot-test fixture strategy with capture-before-refactor parity protocol; executable constants reconciliation table mapping §6.5 entries to specific sub-PRs with CI grep regression test enforcing zero hard-codes post-cleanup; FY25-26 config gap closure with new `reviewSchedule.nextReviewBy` field forcing explicit per-FY review; UNCOMPUTED v1 register with 18 items and UI-badge surfacing rule; Reza sign-off block with 11 decisions (D-A1 through D-A11) + 1 open question (Q-41E-1: HECS/HELP withholding now or later) that gates 41e.−1 start.

### Files Modified
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — appended §8 (refined sub-PR sequencing: full 18-row table with risk + gates + scope; PR sizing rules; calendar estimate ~42 days), §9 (snapshot-test fixture strategy: three archetype fixtures shared with pitch seeding + synthetic edge cases; capture-before-refactor protocol; fixture file layout; ~15 baseline tests at 41e.−1), §10 (constants reconciliation v2 with executable per-sub-PR mapping; FY25-26 config gap closure with code snippet + `reviewSchedule` field; UNCOMPUTED v1 register with 18 items; master-config self-test; **Reza sign-off block** with decision checklist + paste-back template), §11 (audit-complete handoff explaining session N+1 through N+19 cadence).
- `docs/IMPLEMENTATION_PLAN.md` Up Next #29 — narrative refresh: PRs 1-3 marked merged; PR 4 narrative added; full content of PR 4 summarised inline.
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] strategic decision — closes the 4-PR audit workstream and produces the explicit sign-off contract that gates Phase 41e.0
- [ ] visual / config / GCP / identity / deployment / security / operational / data model

Docs updated:
- `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` — §8, §9, §10, §11 appended
- `docs/IMPLEMENTATION_PLAN.md` Up Next #29 — narrative refresh
- `docs/changelog/CHANGELOG_2026_05_05.md` — this entry

### Testing
- [x] Markdown renders cleanly
- [x] Every CRITICAL finding from §3 has a resolution row in §10.1 + §10.2
- [x] Sub-PR sequence in §8.1 covers all 17 sub-PRs from architecture doc §11 + the new 41e.−1
- [x] Sign-off block §10.5 has one checkbox per decision lifted from PRs 2-3
- [ ] Reza sign-off on PR 4 — pending; this PR's merge gates 41e.−1 start

### What's next
- Reza signs the §10.5 sign-off block (paste the template into the PR-merge conversation).
- Session N+1 opens `claude/phase-41e-cleanup-pr` and ships 41e.−1 (cleanup) per §8.1 + §10.1 + §10.2 + §9.4 (snapshot baselines).
- Session N+2 ships 41e.0 (foundation: types + aggregator extensions + cycle-detection + permissions + new endpoints).
- Sessions N+3 through N+19 ship sub-PRs 41e.1 through 41e.17 in the order locked in §8.1.

### PR
- Branch: `claude/phase-41e-audit-pr4-final` (off main; cherry-picked PR 3 commit because it didn't propagate to main when PR 2 was merged)
- PR URL: TBD on push
