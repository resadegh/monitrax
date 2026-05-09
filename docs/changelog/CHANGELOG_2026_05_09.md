# Changelog — 2026-05-09 — DEMO-COMPLETE

## Session: claude/phase-33hij-help-coverage-build (Phase 33h + 33i + 33j — Per-page Help Coverage SHIPPED)

### Changes Made
- **Type:** Feature (closes Up Next #36/#37/#38; closes Open Question Q-HELP-1)
- **Scope:** Per-page help coverage end-to-end — frontmatter-driven route registry + 15 navigation-instruction articles + inline tooltip primitive with 30-term dictionary + 7 critical-field wire-ups
- **Description:** Reza directives 2026-05-09: *"start the build, complete all steps and give me one PR URL"* + mid-build clarification *"I meant instructions not necessarily help or advise in order to help user to navigate and understand the Monitrax sections."* Claude resolved the five §9 design-doc open questions, built all three sub-phases, and rewrote the first 12 articles in navigation-instruction tone after the mid-build clarification.

### Files Created (engine + tooling)
- `lib/help/tooltips.ts` — central tooltip dictionary (~440 LOC). 30 entries: 22 finance terms with ATO/ASIC/SIS Act source-cites + 8 Monitrax-specific. Single SSOT per CLAUDE.md §12.2.
- `components/help/HelpTooltip.tsx` — inline tooltip primitive. Two usage shapes (icon-only / inline-wrap). Esc / click-outside / blur dismissal. Viewport-aware above/below placement. `prefers-reduced-motion`-aware. Keyboard accessible.

### Files Created (15 navigation-instruction articles)
- `docs/help/consumer/your-monitrax-home.md` → routeContext `/dashboard`
- `docs/help/consumer/onboarding-walkthrough.md` → `/onboarding/*`
- `docs/help/consumer/managing-accounts-and-loans.md` → `[/dashboard/balances, /dashboard/balances/*, /dashboard/accounts, /dashboard/loans]`
- `docs/help/consumer/reading-your-cashflow.md` → `/cashflow`
- `docs/help/consumer/ai-guide-and-actions.md` → `/dashboard/cfo` (complianceClass: afsl)
- `docs/help/consumer/your-tax-position.md` → `/dashboard/tax` (complianceClass: afsl)
- `docs/help/consumer/emergency-fund-target.md` → `/dashboard/safety-net`
- `docs/help/consumer/debt-freedom-plan.md` → `/dashboard/debt-planner` (complianceClass: afsl)
- `docs/help/consumer/adding-properties.md` → `[/dashboard/properties, /dashboard/properties/*]`
- `docs/help/consumer/investment-accounts-and-holdings.md` → `/dashboard/investments/*`
- `docs/help/consumer/my-structure.md` → `[/dashboard/entities, /dashboard/entities/*]`
- `docs/help/consumer/uploading-documents.md` → `[/dashboard/documents, /dashboard/vault]`
- `docs/help/org-professional/practice-overview.md` → `/portal/dashboard`
- `docs/help/org-professional/client-drill-in.md` → `[/portal/clients/[id]/view, /portal/clients/[id]/*]`
- `docs/help/org-admin/marketplace-listing.md` → `[/portal/marketplace/listing, /portal/marketplace/*]`

### Files Created (docs)
- `docs/blueprint/HELP_COVERAGE_MAP.md` — single source of truth for what help content exists for every Monitrax surface. ~50 routes classified. Maintenance protocol included.

### Files Modified
- `lib/help/frontmatter.ts` — `ArticleFrontmatter.routeContext` promoted from `string` to `string | string[]` with suffix-glob support; `status: 'DRAFT_AI_SCAFFOLD' | 'PUBLISHED'` flag added for editorial workflow.
- `lib/help/routeContext.ts` — completely rewritten. Hardcoded `RULES` array deleted. New `buildRules()` derives the rule set from each published article's frontmatter at request time. Longest-matching-prefix wins; exact beats glob at equal length.
- `lib/help/content.ts` — `listArticlesByAudience` now filters out `status: DRAFT_AI_SCAFFOLD` articles (excludes from public Help Center index AND drawer resolution).
- `components/properties/PropertyTile.tsx` — `Equity` + `LVR` labels gain `<HelpTooltip>` icons.
- `app/dashboard/tax/page.tsx` — `Concessional`, `Non-Concessional`, `Medicare Levy` labels gain tooltips.
- `components/loans/LoanDetailDialog.tsx` — `Effective Balance` label gains tooltip.
- `app/portal/feedback/page.tsx` — `Tag` label in feedback form gains tooltip.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #36/#37/#38 → SHIPPED + Recently Completed entry + Q-HELP-1 → DECIDED.
- `docs/blueprint/PHASE_33HIJ_HELP_COVERAGE_PROPOSAL.md` — flipped to SHIPPED + Decisions-made block at top.

### Mid-build pivot (worth recording)
First pass at the 12 consumer articles read like financial education ("here's how to think about LVR", "here's the Avalanche vs Snowball tradeoff"). Reza clarified mid-build: *"instructions not necessarily help or advise."* All 12 articles rewritten in navigation-instruction tone — every article opens with **How to get here** → walks the page surface-by-surface in a table → numbered **Common tasks** → **Common navigation questions** → **What's next**. Concept definitions moved to tooltips where they belong. Pattern locked for all future articles per the coverage map.

### Build Status
- [x] `npx tsc --noEmit --ignoreDeprecations 6.0` — only pre-existing missing-module errors (no new type errors introduced)
- [ ] `npm run build` — not run locally (deps not installed); Vercel preview is the source of truth

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern — new `<HelpTooltip>` primitive
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision — Q-HELP-1 closed; Up Next #36/#37/#38 → SHIPPED

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — three Up Next rows + Recently Completed + Q-HELP-1 (§15)
- `docs/changelog/CHANGELOG_2026_05_09.md` — this session block (§11)
- `docs/blueprint/PHASE_33HIJ_HELP_COVERAGE_PROPOSAL.md` — flipped to SHIPPED with Decisions-made table
- `docs/blueprint/HELP_COVERAGE_MAP.md` — new SSOT for help coverage

§12.11 destructive-write checklist: NOT REQUIRED — no Prisma writes.
§12.12 schema migration: NOT REQUIRED — no schema changes.

### Test plan (manual, post-deploy)
1. Hit `?` drawer on `/dashboard/cfo` → opens `consumer/ai-guide-and-actions` article (was: generic TRAIL article).
2. Hit `?` drawer on `/dashboard/properties/123` (any property sub-route) → opens `consumer/adding-properties` (glob match).
3. Hover `?` icon next to `Equity` on a property tile → tooltip popover appears with definition + Learn more link.
4. Click `?` icon next to `Concessional` on `/dashboard/tax` → popover with ATO source link; click outside → dismisses.
5. `/help` index page lists all 15 new articles under their respective audience sections; draft-flagged articles (none in this batch) would NOT appear.

### PR
- Branch: `claude/phase-33hij-help-coverage-proposal-Q6tyx` (cherry-picked onto main as needed)
- Single PR carrying the proposal + the build

---

## Session: claude/phase-32c-demo-complete (PR6b + #33 + #34 SHIPPED — demo-complete state achieved)

### Changes Made
- **Type:** Feature × 3 — bundled demo-complete final ship
- **Scope:** Phase 32C PR6b (lead-fee invoicing) + Pitch fixture seed (#33) + Pitch playbook final pass (#34). Closes the last three critical-path items. **Build is now demo-complete end-to-end.**

### PR6b — Lead-fee invoicing

#### Files Created
- `prisma/migrations/20260509100000_add_lead_fee_invoice/migration.sql` — additive: 5 new columns on `professional_requests` + new `LeadFeeStatus` enum.
- `app/api/portal/billing/invoices/route.ts` — GET org-scoped lead-fee invoice history.

#### Files Modified
- `prisma/schema.prisma` — `ProfessionalRequest` gained `stripeInvoiceId UNIQUE`, `leadFeeStatus`, `leadFeeInvoiceUrl`, `leadFeePaidAt`, `leadFeeFailedAt` columns + new `LeadFeeStatus` enum (PENDING_CREATE / PENDING_PAYMENT / PAID / FAILED / VOIDED).
- `lib/services/stripeBillingService.ts` — extended with `createLeadFeeInvoiceForRequest` (idempotent on `stripeInvoiceId`; falls through to PENDING_CREATE in dev/demo without keys; in PROD creates Stripe InvoiceItem + Invoice, finalises immediately, persists `stripeInvoiceId` + `hosted_invoice_url`); `handleInvoicePaid` + `handleInvoiceFailed` webhook dispatchers (route by `monitrax_request_id` metadata so subscription invoices and lead-fee invoices don't collide); `listLeadFeeInvoicesForOrg` for the billing UI.
- `lib/services/professionalRequestService.ts` — `acceptRequest` now also calls `createLeadFeeInvoiceForRequest` after the conversation auto-create. Same best-effort pattern: failure does NOT roll back accept (billing intent already in `leadFeeChargedAt`); ops can re-run idempotently.
- `lib/services/index.ts` — re-exports `createLeadFeeInvoiceForRequest` + `listLeadFeeInvoicesForOrg`.
- `app/portal/billing/page.tsx` — replaced "PR6b is next" placeholder with `<LeadFeeInvoiceHistory />` component (status pills, AU$ amount, Stripe-hosted invoice URL per row, friendly empty-state).

### #33 — Lighthouse pitch fixture seed

#### Files Created
- `prisma/seed-lighthouse.ts` (~1100 LOC) — idempotent fixture seed.
  - **Smithfield Wealth Advisers** Org + Reza PORTAL_OWNER + APPROVED ProfessionalListing + active Practice StripeSubscription
  - **Sarah Kim** — TRACK stage; 1 property + Sarah Kim Pty Ltd; SUBMITTED request waiting for live-Accept demo
  - **David Mei + Emma Liu** — REDUCE stage; 5 entities + 4 properties + 4 loans (PPR fixed-expiry in 14 days = refinance alert); ACCEPTED request + conversation with 3 sample messages
  - **Olivia Novak** — INVEST stage; 5 entities (Holdings + Discretionary Trust + Unit Trust + SMSF + Personal); 5 properties; the entity-tree moat-screenshot demo
- Idempotent via deterministic IDs (`lh-<archetype>-<entity-type>-<index>`); `--reset` flag for clean re-seeds.

#### Files Modified
- `package.json` — added `npm run seed:lighthouse`.

### #34 — Pitch playbook final pass

#### Files Modified
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — flipped from SCAFFOLD to DEMO-COMPLETE.
  - Header rewritten with pre-flight check (run seed; open browser windows; verify SUBMITTED + ACTIVE + APPROVED).
  - Step 0 (adviser pain) populated with category playbook + 90-second listening protocol.
  - Step 1 (Practice dashboard) verbatim narration tightened to use seeded fixture data.
  - Step 6c (Connect path) end-to-end (PR4c shipped).
  - Step 7 (conversation thread) end-to-end (PR4d shipped).
  - Step 7b (billing + plan tiers) end-to-end (PR6a/b shipped).
  - Footer flags remaining TO BE WRITTEN markers as explicitly POST-pitch artefacts.

### Architecture Decisions
- **Lead-fee invoice creation hooked into `acceptRequest` AFTER the inner transaction commits** — same best-effort pattern as the conversation auto-create. Failure doesn't roll back accept; the billing intent is already recorded; ops can re-run idempotently. CLAUDE.md §0 architect lens: payment plumbing is a separate gate from lifecycle transitions.
- **Idempotent on `stripeInvoiceId` UNIQUE** — `createLeadFeeInvoiceForRequest` returns the existing invoice id if already set, prevents double-charging on retries.
- **Webhook dispatchers route by metadata, not by id pattern** — `monitrax_request_id` on the InvoiceItem + Invoice metadata is the canonical lookup; subscription invoices don't carry it, so the dispatchers cleanly separate the two paths.
- **Seed uses deterministic IDs + upserts everywhere** — re-runs are safe; demo URLs stay stable across browser sessions; `--reset` cascade-deletes for clean re-seeds when schema shifts.
- **Three-archetype seed scope** — 1 property archetype + 4-entity family + 5-entity HNW. Covers the full TRAIL stage spectrum (TRACK / REDUCE / INVEST) without bloat.
- **Pre-existing engagement state on David, not Sarah** — Sarah's request stays SUBMITTED for the live-Accept demo (the visceral "click Accept and watch the engagement materialise" moment); David's already has conversation depth so Step 7 can demonstrate thread richness without composing live.

### Build Status
- [x] `npx tsc --noEmit` — clean, exit 0.
- [x] `npx next build` — green; new `/api/portal/billing/invoices` route registered (alongside the existing PR6a routes).

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (`<LeadFeeInvoiceHistory />` component — status pill colour vocabulary)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (lead-fee invoice creation is best-effort post-transaction with idempotent retry; webhook handlers update `leadFeeStatus` from Stripe events)
- [ ] operational procedure
- [x] strategic decision (PR6 split a/b shipped together; pitch fixture archetype scope; playbook demo-complete vs post-pitch markers)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #18` — PR6 (a + b) marked SHIPPED in full.
- `docs/IMPLEMENTATION_PLAN.md:Up Next #33` — Lighthouse pitch fixture seed marked SHIPPED.
- `docs/IMPLEMENTATION_PLAN.md:Up Next #34` — Pitch playbook final pass marked SHIPPED.
- `docs/IMPLEMENTATION_PLAN.md:Recently Completed 2026-05-09` — DEMO-COMPLETE entry prepended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — flipped to DEMO-COMPLETE state.
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A for the migration (additive only — ALTER TABLE ADD COLUMN nullable + CREATE TYPE). The seed script uses upserts everywhere with deterministic IDs; the update branch on every upsert is intentionally minimal (only updates fields that should refresh on re-seed); existing Org/User rows that share the deterministic ID are recognised as the same row and refreshed. The `--reset` flag does cascade-delete (User.delete cascades to all owned rows + Conversation participants + ProfessionalRequest + ClientLink etc.) but the userIds are explicitly the seeded lighthouse-demo users, never live data.

### Schema Migration Checklist (CLAUDE.md §12.12)
- [x] `prisma/schema.prisma` modified
- [x] Matching migration at `prisma/migrations/20260509100000_add_lead_fee_invoice/migration.sql`
- [x] Migration is purely additive (no `DROP`, no `ALTER ... DROP COLUMN`, no `TRUNCATE`, no `ADD COLUMN NOT NULL` without default backfill — all new columns are nullable)
- [x] `npx prisma validate` clean
- [x] `npx prisma generate` clean

### PR
- Branch: `claude/phase-32c-demo-complete`
- Status: pending push + open


---

## Session: phase-42-bookkeeping-completion-spec (Phase 42 spec doc + IMPLEMENTATION_PLAN registration)

### Changes Made
- **Type**: Doc / Spec (planning, not code)
- **Scope**: Phase 42 — Consumer Bookkeeping Completion (XERO-Complementary)
- **Description**: Following Reza's directive 2026-05-08 ("Monitrax is the all-in-one user side tool. Xero is the accountant side. We do not replace Xero, we complement it"), this PR documents the full Phase 42 proposal — the consumer-side bookkeeping completion that fulfils the user-side half of the Monitrax + Xero handshake. Pairs with Phase 41f (entity-level Xero pull): 41f imports SUMMARY from Xero into Monitrax for tax-engine inputs; 42 produces personal HANDOFF from Monitrax to Xero (tax pack export). Mid-session expansion per Reza directive: "the user has to be engaged emotionally and mentally to perform the categorisation tasks — not a chore" — added a full §6 Categorisation Experience spec (engagement principle, Up Bank-grade swipe gestures, micro-rewards, Duolingo-style streak with shield, 100% completion celebration with confetti scarcity, Daily Pulse Home card, hard-NO list against fintech UX patterns that undermine engagement).

### Files Modified / Added
- `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` — NEW. ~720 lines. Sections: §1 Strategic positioning + the line we are NOT crossing (10-row in-scope/out-of-scope table; explicit boundary against Xero territory). §2 Engagement Principle (the load-bearing constraint). §2.1 Four-lens design rationale. §3 Seven strategic decisions (D-42-1 through D-42-7) requiring Reza sign-off. §4 Six sub-PR sequence (~6 weeks single-engineer). §5 New schema additions (`CanonicalCategoryRegistry`, `BookkeepingPeriod`, `TransactionEdit`, `TransactionSplit`, `Vendor`, `TaxCategoryMapping` — all additive). §6 The Categorisation Experience (engagement spec — reference benchmarks, three-state surface model, 5-second micro-interaction anatomy, streak system, completion celebration choreography, Daily Pulse card spec, explicit reject-list, accessibility, chore-vs-ritual test). §7 UNCOMPUTED register (what the Tax Pack acknowledges it does NOT compute). §8 CDR / privacy. §9 BASIQ-onboarding readiness (per-PR matrix). §10 Out of scope. §11 Sign-off block. §12 Build risks. §13 Test plan. §14 Approval status.
- `docs/IMPLEMENTATION_PLAN.md` — NEW Up Next #42 entry. Full per-PR summary with engagement-layer call-out per Reza directive. Trigger: after Reza signs off D-42-1 through D-42-7.
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry.

### Documentation Updated (per CLAUDE.md §3.1 + §16)

This is a strategic-decision surface (per CLAUDE.md §16.2 row "strategic decision the user makes"). Doc-sync requirements per §16.3:

- [x] `IMPLEMENTATION_PLAN.md` Up Next register updated with new workstream
- [x] New phase doc created at `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md`
- [x] Changelog entry created
- [N/A] No code changes; no test coverage required for spec-only PR
- [N/A] No schema migration — all schema additions are documented in spec for future PR1 to ship

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Reza directive 2026-05-08 documented as the §1 Strategic Positioning + §2 Engagement Principle; full proposal documented in spec; queued in IMPLEMENTATION_PLAN.md)

Docs updated in this PR:
- `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` — NEW spec doc
- `docs/IMPLEMENTATION_PLAN.md` Up Next #42 — registered with full PR sequence
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)

N/A — doc-only PR; no Prisma operations of any kind.

### Build Status
- [N/A] No code changes; typecheck / build skipped

### PR
- Branch: `claude/phase-42-bookkeeping-completion-spec`
- Status: pending push + open



---

## Session: claude/monitrax-architecture-analysis-MG8mr (Phase 43 — Your Money Story SHIPPING)

### Changes Made
- **Type:** Feature (Phase 43 — translates Jason Andrew's "Stark Naked Numbers" hierarchy into a TRAIL-aligned Personal P&L hero on `/dashboard` Home).
- **Scope:** New presentational hero composed from `components/shell/` primitives + 4 derived values added to `MasterFinancialSnapshot.quickMetrics` (zero new calc engines) + a `moneyStory` block on the existing `/api/dashboard/insights` response (zero new endpoints, zero new fetches on Home).
- **Description:** Reza brief 2026-05-09 — *"read Stark Naked Numbers and provide a comprehensive analysis on Monitrax architecture and design and methodology and how they can align."* Architect-mode synthesis (this session) identified the One Next Best Action: a 3-line scoreboard hero (**Earned → Kept → Free today**) mapping to TRAIL T → R → A. Andrew's brevity rule and Monitrax's cognitive-load rule (Mani et al. 2013) are the same rule pointed at different targets — the hero is the surface where the two traditions meet. Math is sharp; language is kind.

### Architectural integrity (Reza directive 2026-05-09: *"don't duplicate functions and stick to claude.md design principles. SSOT and single calc engines"*)
- **Zero new calc engines.** All four derived values (`monthlyGrossIncome`, `keptAfterEssentials`, `keptMargin`, `freeCashDays`) are read-through from numbers already computed by `cashflowOrchestrator`, `incomeAggregator`, and `expenseAggregator`. Exposed on `quickMetrics` as the SSOT contract (CLAUDE.md §6.1, §12.2).
- **Zero new HTTP fetches on Home.** `/api/dashboard/insights` already calls `getMasterFinancialSnapshot()`; the four values are exposed via a new `moneyStory` block on its existing response. No third HTTP call (CLAUDE.md §12.10).
- **Zero re-implemented design primitives.** Hero composes `<GlassHero>` + `<GlassHeroEyebrow>` + `<GlassHeroHeadline>` + `<GlassHeroKpiCell>` from `components/shell/`. `appleEase`, the rounded-28px glass surface, the mesh atmosphere, and the breathing glow all come from the shell layer (CLAUDE.md §16, `06_UI_UX_FOUNDATION.md` §15.10).
- **Hero is purely presentational.** 6 props in, JSX out. Computes nothing.

### Files Created
- `components/dashboard/MoneyStoryHero.tsx` — pure presentational hero, ~150 LOC, stage-rotated emphasis (T → amber/Earned, R → sky/Kept, A → emerald/Free, I → violet, L → emerald), warm-language secondary copy, `enoughHistory` gate against false-precision day counts.
- `docs/blueprint/PHASE_43_MONEY_STORY.md` — full Phase doc (strategic positioning + Stark Naked translation table + 6 architectural decisions + data flow diagram + stage-emphasis behaviour + acceptance criteria + deferred follow-ons + references).

### Files Modified
- `lib/services/masterFinancialService.ts` — `MasterFinancialSnapshot.quickMetrics` extended with four additive fields (`monthlyGrossIncome`, `keptAfterEssentials`, `keptMargin`, `freeCashDays`); populated at the synthesis point and in both empty/blank fallback branches. JSDoc on the type explains they are NOT a new engine.
- `app/api/dashboard/insights/route.ts` — `DashboardInsights` type extended with optional `moneyStory` block; populated as a pure passthrough from canonical `quickMetrics` at the response-build point.
- `app/dashboard/page.tsx` — imports `MoneyStoryHero` + `determineTrailStage`, mirrors the optional `moneyStory` shape on the local `DashboardInsights` interface, renders the hero at the top of the loaded-state branch (self-hides when the block is absent on older cached responses).
- `docs/IMPLEMENTATION_PLAN.md` — new active workstream entry (§0b. Phase 43) covering scope, decisions, risks, reversed-decision protection (Andrew's brutal voice deliberately not adopted), and deferred follow-ons.
- `docs/blueprint/MASTER_BLUEPRINT.md` — Phase 43 added to the In Progress table.
- `docs/blueprint/TRAIL_FRAMEWORK.md` — new "3-line scoreboard pattern" subsection in §5: when to use it, when not to, tone discipline (warm copy never adopts the book's brutal voice).
- `docs/architecture/06_UI_UX_FOUNDATION.md` §15.10 — registered `MoneyStoryHero` as the canonical Home orientation hero with composition + tone rules and a code-review enforcement clause forbidding inline math.

### Stark Naked Numbers translation summary
| Book line | Personal-finance equivalent | Snapshot source | TRAIL stage |
|---|---|---|---|
| Revenue (vanity) | **Earned** | `quickMetrics.monthlyGrossIncome` | T |
| Profit (sanity) | **Kept** (= net income − essentials) | `quickMetrics.keptAfterEssentials` | R |
| Cash (reality) | **Free today** (in days of life) | `quickMetrics.liquidCash` + `freeCashDays` | A |

Andrew's words *vanity / sanity / reality* are deliberately NOT used as line labels. The hierarchy is borrowed; the brutality is left at the door.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new canonical hero registered)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (new SSOT contract for Personal P&L scoreboard primitive)
- [x] strategic decision (Stark Naked Numbers analysis → Phase 43 scope decision: ship the hero, defer the supporting three)

Docs updated in this PR:
- `docs/blueprint/PHASE_43_MONEY_STORY.md` — NEW Phase doc
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — added Phase 43 In-Progress row
- `docs/blueprint/TRAIL_FRAMEWORK.md` §5 — added "3-line scoreboard pattern" subsection
- `docs/architecture/06_UI_UX_FOUNDATION.md` §15.10 — registered `MoneyStoryHero` canonical hero
- `docs/IMPLEMENTATION_PLAN.md` §0b — new active workstream entry
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)

N/A — additive only. No Prisma `update` / `upsert` / `delete` / `updateMany` / `deleteMany` operations introduced. No raw SQL. No schema migration.

### Build Status
- [x] TypeScript compilation passes
- [x] `npm run build` passes

### PR
- Branch: `claude/monitrax-architecture-analysis-MG8mr`
- Status: pending push + open
