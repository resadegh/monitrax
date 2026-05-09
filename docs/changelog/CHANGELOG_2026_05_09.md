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

---

## Session: claude/monitrax-architecture-analysis-MG8mr — Phase 43 design refinement (visualisation + SSOT alignment)

### Changes Made
- **Type:** Refinement (Phase 43 hero — second pass).
- **Scope:** Three things in one focused commit: (1) fixed stage→atmosphere drift against the canonical `TRAIL_STAGE_TONES` SSOT, (2) added the Money Story Bar visualisation to the hero, (3) made the entire hero tappable with stage-appropriate drill-down per design Principle 3.2.
- **Description:** Reza directive 2026-05-09 *"make sure the design is aligned with design document, clean modern and apple like"* + *"Make the money story visual as well. Consider human behaviour psychology on visual presentation of the money story."* Surfaced a critical drift against `TRAIL_STAGE_TONES` (T=sky, R=amber, A=indigo, I=emerald, L=violet) — initial hero had T/R swapped and A/I/L wrong. Fixed in this commit. Added a 3-segment Money Story Bar (Tax · Spent · Saved) below the headline copy as the behavioural-psychology-informed visualisation.

### SSOT alignment fix
- `MoneyStoryHero` stage→atmosphere mapping rewired against `TRAIL_STAGE_TONES` (`lib/navigation/trailNav.tsx`):
  - **T (Track)** — `sky` (was `amber`). Rationale: trust + clarity + awareness.
  - **R (Reduce)** — `amber` (was `sky`). Rationale: action + energy.
  - **A (Anchor)** — `indigo` (was `emerald`). Rationale: depth + stability. **Required adding `indigo` to `GlassHero`'s atmosphere set** — additive shell-layer extension; benefits future heroes.
  - **I (Invest)** — `emerald` (was `violet`). Rationale: growth + prosperity.
  - **L (Live)** — `violet` (was `emerald`). Rationale: aspiration + freedom.
- Headline gradient classes per stage rewritten so they harmonise with the canonical `bgTint` colour vocabulary.
- 06_UI_UX_FOUNDATION.md §15.10 — reviewer rule added: "Reviewers MUST reject any change that drifts the hero's stage colours away from the SSOT."

### Visualisation — the Money Story Bar
A 3-segment proportional bar between the secondary copy and the KPI cells, splitting Earned into **Tax · Spent · Saved**.

**Behavioural-psychology rationale (the lens that drove every design choice):**
- **System 1 vs System 2 (Kahneman)** — when financial stress depletes System 2 cognition (Mani et al. 2013, 13 IQ points), abstract numbers fail. The bar is the same data as "31% kept" expressed *spatially* — System-1 fast/intuitive parsing.
- **Loss aversion (Kahneman & Tversky)** — losses feel ~2× as strong as gains. Red on a "Spent" segment triggers panic, not action. **No red anywhere on the bar**: Tax = `slate-400`, Spent = `slate-300`. The user sees their spending without feeling shamed.
- **Self-efficacy (Bandura)** — visible progress reinforces capability. **Emerald is the only victory colour in the bar** — reserved exclusively for "Saved". Even a 5% saved segment reads as a small win.
- **Anchoring (Tversky & Kahneman)** — the bar appears immediately under the prominent headline number, anchoring the user's perception of where their money goes correctly before they read the supporting cells.
- **Concreteness (Heath & Heath)** — "31%" is abstract; a third-of-a-bar in emerald is concrete. Memorable, actionable, emotionally resonant.

**Design rules (NON-NEGOTIABLE — registered in `06_UI_UX_FOUNDATION.md` §15.10):**
- Three segments only — Andrew's brevity rule.
- No red anywhere — loss-aversion-safe palette by construction.
- Emerald reserved for Saved — never used on Tax or Spent.
- Self-hides when `earned ≤ 0` — a fully-grey bar is misinformation.
- Reduced-motion-safe — left-anchored `scaleX` entry animation suppressed under `prefers-reduced-motion`.
- No legend, no axis — the proportions ARE the legend; tiny dotted labels under the bar carry the meaning.

### Drill-down — Principle 3.2 ("Everything is a Drill-Down")
The entire hero is now a `<Link>` routing per stage:
- **T (Track)** → `/dashboard/balances` ("See your full picture")
- **R (Reduce)** → `/dashboard/budget-analysis` ("See where it goes")
- **A (Anchor)** → `/dashboard/safety-net` ("See your runway")
- **I (Invest)** → `/dashboard/cfo` ("See your next move")
- **L (Live)** → `/dashboard/cfo` ("See your story")
- The drill-down label sits in the eyebrow row with an `ArrowUpRight` glyph — visible interactivity cue.
- `motion-safe:hover:-translate-y-0.5` on the wrapper gives the Apple-style 1px hover lift.
- `focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2` for keyboard accessibility.

### Architectural integrity (still SSOT clean)
- **Zero new calc engines.** The new `taxWithheld` and `surplus` fields on the `moneyStory` block are read-through — `taxWithheld` from `cashflow.monthlyPaygWithholding` (already canonically computed by `cashflowOrchestrator`), `surplus` from `quickMetrics.monthlyCashflow` (already exposed). No duplicate aggregation.
- **Zero new endpoints, zero new fetches.** Same `/api/dashboard/insights` response, two additional fields on the `moneyStory` block.
- **`indigo` atmosphere** added to `GlassHero`'s atmosphere set — additive shell-layer change, follows the same mesh / glow / border recipe as the existing six.

### Files Modified
- `components/shell/GlassHero.tsx` — `GlassHeroAtmosphere` extended with `indigo`; new `ATMOSPHERES.indigo` spec tuned to match `TRAIL_STAGE_TONES.A`.
- `components/dashboard/MoneyStoryHero.tsx` — full rewrite: SSOT colour alignment, drill-down `<Link>` wrapper, `MoneyStoryBar` sub-component with motion-safe segment reveal + non-judgemental palette, two new props (`taxWithheld`, `surplus`).
- `app/api/dashboard/insights/route.ts` — `moneyStory` block extended with `taxWithheld` + `surplus` (pure passthrough from canonical snapshot).
- `app/dashboard/page.tsx` — local `DashboardInsights` interface mirrors the new fields; props wired into the hero.

### Doc-sync (CLAUDE.md §16)
- `docs/blueprint/PHASE_43_MONEY_STORY.md` — §5 rewritten with SSOT-aligned stage table + drill-down behaviour; new §5a "Visualisation — the Money Story Bar" with full behavioural-psychology rationale (Kahneman, Bandura, Tversky, Heath & Heath cited).
- `docs/architecture/06_UI_UX_FOUNDATION.md` §15.10 — `indigo` atmosphere added to `GlassHero` registration; `MoneyStoryHero` composition rules updated for SSOT colour pinning + Money Story Bar contract + drill-down wrapper; reviewer rules added.
- `docs/blueprint/TRAIL_FRAMEWORK.md` §5 — 3-line scoreboard pattern primitive note expanded with the Money Story Bar visualisation contract.
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry.

### Doc-sync block (§16.5)

Surfaces changed in this PR:
- [x] visual design system / component pattern (Money Story Bar visualisation registered; `indigo` atmosphere added)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (SSOT colour-pinning rule for the hero registered in `06_UI_UX_FOUNDATION.md`)
- [ ] strategic decision

Docs updated in this PR (refinement):
- `docs/blueprint/PHASE_43_MONEY_STORY.md` — §5 + §5a updated
- `docs/architecture/06_UI_UX_FOUNDATION.md` §15.10 — atmosphere set + composition rules
- `docs/blueprint/TRAIL_FRAMEWORK.md` §5 — visualisation contract added
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)
N/A — additive only. No Prisma operations of any kind.

### Build Status
- [x] TypeScript compilation passes (`npx tsc --noEmit`)

### PR
- Branch: `claude/monitrax-architecture-analysis-MG8mr`
- Status: refinement push pending

---

## Session: claude/phase-43-1-hidden-wealth-MG8mr (Phase 43.1 — Hidden Wealth Lens SHIPPING)

### Changes Made
- **Type:** Feature (Phase 43.1 — first deferred follow-on from Phase 43 / PR #737, now merged).
- **Scope:** New typography-led analytical card on `/dashboard/balances` splitting Total Assets by accessibility into 3 buckets (Liquid Today · Accessible · Locked Long-Term). One new thin endpoint, zero new calc engines, zero `quickMetrics` changes, zero new design primitives.
- **Description:** Reza directive 2026-05-09 *"continue"* after PR #737 merged. Andrew (Stark Naked Numbers): *"the balance sheet is where all the cash is hiding."* Personal-finance translation: the user with $500k net worth and $2k accessible — the rule, not the exception, for the AU property-investor segment Monitrax targets. The existing `/dashboard/balances` hero shows Net Position / Cash / Credit / Debt — none of which answer *"how much can I actually spend before payday if my hot-water system dies?"* This lens does, honestly and without alarm.

### Architectural integrity (CLAUDE.md §6.1 + §12.2 SSOT)
- **Zero new calc engines.** Every value reads through existing snapshot fields (`quickMetrics.liquidCash`, `investments.totalValue`, `propertyPortfolioEquity`, `netWorth.assets.superannuation`, `netWorth.assets.personalAssets`).
- **Zero new fields on `quickMetrics`** (D-43.1-2 promote-on-second-use). The bucket terminology is presentation-layer specific; coupling calc layer to UI taxonomy would invert the architecture.
- **Zero re-implemented design primitives.** Lens uses `appleEase` + `useReducedMotionSafe` from `components/shell/`. No glass tile (page already has its own minimalist hero — typography-led card was the right restraint).

### Behavioural-psychology rules (registered in `06_UI_UX_FOUNDATION.md`)
- No red anywhere (Kahneman & Tversky loss aversion).
- Emerald reserved for Liquid as the Bandura victory tone — reaching cash *is* the small win.
- Comparative-not-judgemental copy ("That is wealth — but not cash" never "you're cash-poor"; 0% Accessible reframed as "the next TRAIL stage" not absence).
- Reduced-motion-safe segment-fill animation.
- Self-hides when totalAssets ≤ 0 (false precision is worse than missing precision).

### Files Created
- `app/api/dashboard/hidden-wealth/route.ts` — thin endpoint (`withPermission('report.read')`, ~80 LOC). Returns `{liquidToday, accessible, lockedLongTerm, totalAssets, netWorth, breakdown}`.
- `components/balances/HiddenWealthLens.tsx` — pure presentational component (~210 LOC). 3-segment proportional bar + 3 detail rows + optional Inside-Locked drill-down rows. Emerald → sky → slate palette.
- `docs/blueprint/PHASE_43_1_HIDDEN_WEALTH.md` — full Phase doc (strategic positioning, 3-bucket taxonomy with rationale, 7 architectural decisions, data-flow diagram, visualisation, behavioural-psychology rules with citations, acceptance criteria, deferred follow-ons).

### Files Modified
- `app/dashboard/balances/page.tsx` — imports lens + endpoint type; new `hiddenWealth` state; one fetch added to existing `Promise.allSettled` batch (fire-and-forget — failed fetch leaves the lens hidden, rest of page unaffected); lens renders between Net Position hero and Cash section.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 43 moved to ✅ Recently Completed (PR #737, merged 2026-05-09); §0b replaced with new Phase 43.1 active workstream entry.
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 43 row updated to ✅ Complete with PR #737 link; Phase 43.1 row added as 🟡 SHIPPING.
- `docs/architecture/06_UI_UX_FOUNDATION.md` §15.10 — registered `HiddenWealthLens` as the canonical typography-led analytical card pattern + clarified emerald-reservation rule scope (the §5a rule scopes to MoneyStoryBar; HiddenWealthLens uses emerald for Liquid as a different victory semantics on a different surface).

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new canonical typography-led analytical card pattern registered)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Phase 43 marked complete with PR #737; Phase 43.1 first follow-on activated)

Docs updated in this PR:
- `docs/blueprint/PHASE_43_1_HIDDEN_WEALTH.md` — NEW Phase doc
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 43 row → ✅ Complete + Phase 43.1 row 🟡 SHIPPING
- `docs/architecture/06_UI_UX_FOUNDATION.md` §15.10 — `HiddenWealthLens` canonical analytical card registered
- `docs/IMPLEMENTATION_PLAN.md` — Phase 43 → Recently Completed; §0b → Phase 43.1 active workstream
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)
N/A — additive only. No Prisma operations of any kind. No schema migration.

### Build Status
- [x] TypeScript compilation passes (`npx tsc --noEmit`)

### PR
- Branch: `claude/phase-43-1-hidden-wealth-MG8mr`
- Status: pending push + open

---

## Session: claude/phase-43-2-spending-pareto-MG8mr (Phase 43.2 — Spending Pareto Lens SHIPPING)

### Changes Made
- **Type:** Feature (Phase 43.2 — second deferred follow-on from Phase 43; first follow-on Phase 43.1 / PR #738 also shipped + merged today).
- **Scope:** New typography-led analytical card on `/dashboard/expenses` surfacing the *vital few* spending categories driving ~80% of monthly outgoings. One new thin endpoint, zero new calc engines, zero `quickMetrics` changes.
- **Description:** Reza directive 2026-05-09 *"continue with build"* after PR #738 merged. Andrew's controversial *"fire your worst 20% of customers"* (Stark Naked Numbers, Principle 3) inverted for personal finance: instead of cutting 20% of spending categories, **focus your attention on the 20% that drive 80%**. The existing `/dashboard/expenses` page is a complete list of every line — useful for the data, useless for the *decision*. The Pareto lens collapses 30 lines into ~4 numbered focus items: *here's where your attention earns the most return*. Mani et al. 2013 cognitive-load research is the reason this matters — stress depletes 13 IQ points, so "where do I start?" closes the page without action.

### Architectural integrity (CLAUDE.md §6.1 + §12.2 SSOT)
- **Zero new calc engines.** Pareto cut reads `snapshot.expenses.monthly.byCategory` (already canonically computed by `aggregateExpensesByCategory` in `expenseAggregator.ts`). Sort + cumulative-percentage walk happens in the route.
- **Zero new fields on `quickMetrics`** (D-43.2-2 promote-on-second-use).
- **Zero re-implemented design primitives.** Lens uses `appleEase` + `useReducedMotionSafe` from `components/shell/`. Same family as `HiddenWealthLens` — typography-led card, subtle border + faint background, no glass tile.

### Pareto cut algorithm
- Sort `expenses.monthly.byCategory` by `amount` descending
- Walk the list accumulating `cumulativePct`
- Cut at `cumulativePct ≥ 80%` OR `MAX_VITAL_FEW = 8`, whichever first
- Empty state when `totalMonthlySpend ≤ 0` → lens self-hides

### Behavioural-psychology rules (registered in `06_UI_UX_FOUNDATION.md`)
- **Cognitive ease** (Kahneman) — 4 numbered lines vs 30; sequenceable + concrete.
- **No red anywhere**, even at 50% concentration (Kahneman & Tversky loss aversion). Pareto framing is focus, not failure.
- **Locus-of-control closing copy** (Bandura) — *"the highest-leverage spending review you can do"*. The user is the actor.
- **Concreteness** (Heath & Heath) — numbered list + dollars + percentages, three concrete handles per row.
- **Pareto framing as opportunity not verdict** — even at 95% concentration, copy stays neutral.

### Files Created
- `app/api/dashboard/spending-pareto/route.ts` — thin endpoint (~110 LOC; `withPermission('report.read')`). Returns `{vitalFew, vitalFewTotal, vitalFewPct, trivialMany*, totalMonthlySpend, totalCategoryCount}`.
- `components/expenses/SpendingParetoLens.tsx` — pure presentational component (~180 LOC). Numbered vital-few list with inline mini-bars (slate-500/80, scaled by `pct ÷ maxPct`), trivial-many footer with neutral framing, locus-of-control closing copy.
- `docs/blueprint/PHASE_43_2_SPENDING_PARETO.md` — full Phase doc (strategic positioning, Pareto-cut algorithm with guardrails, 7 architectural decisions, data-flow diagram, visualisation with mini-bar scaling rule, behavioural-psychology rules with citations, acceptance criteria, deferred follow-ons).

### Files Modified
- `app/dashboard/expenses/page.tsx` — imports lens + endpoint type; new `pareto` state + `loadPareto()` fire-and-forget loader; lens renders between `<PageHeader>` and search/filter.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 43.1 moved to ✅ Recently Completed (PR #738, merged 2026-05-09); §0b replaced with new Phase 43.2 active workstream entry.
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 43.1 row updated to ✅ Complete with PR #738 link; Phase 43.2 row added as 🟡 SHIPPING.
- `docs/architecture/06_UI_UX_FOUNDATION.md` §15.10 — registered `SpendingParetoLens` as a canonical typography-led analytical card pattern in the `HiddenWealthLens` family.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] visual design system / component pattern (canonical Pareto-cut analytical card pattern registered)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Phase 43.1 marked complete with PR #738; Phase 43.2 second follow-on activated)

Docs updated in this PR:
- `docs/blueprint/PHASE_43_2_SPENDING_PARETO.md` — NEW Phase doc
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 43.1 → ✅ Complete + Phase 43.2 row 🟡 SHIPPING
- `docs/architecture/06_UI_UX_FOUNDATION.md` §15.10 — `SpendingParetoLens` canonical analytical card registered
- `docs/IMPLEMENTATION_PLAN.md` — Phase 43.1 → Recently Completed; §0b → Phase 43.2 active workstream
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)
N/A — additive only. No Prisma operations of any kind. No schema migration.

### Build Status
- [x] TypeScript compilation passes (`npx tsc --noEmit`)

### PR
- Branch: `claude/phase-43-2-spending-pareto-MG8mr`
- Status: pending push + open

---

## Session: claude/phase-43-3-margin-trend-MG8mr (Phase 43.3 — Margin Trend Lens SHIPPING)

### Changes Made
- **Type:** Feature (Phase 43.3 — third deferred follow-on from Phase 43; first Phase 43.1 / PR #738 + second Phase 43.2 / PR #739 already shipped + merged today).
- **Scope:** New typography-led analytical card on `/dashboard/budget-analysis` surfacing monthly savings-rate trend over the last 6 months as a pure-SVG sparkline + delta-from-last-month + sliding-window trend direction. One new thin endpoint, zero new calc engines, zero `quickMetrics` changes, zero chart-library imports.
- **Description:** Reza directive 2026-05-09 *"continue"* after PR #739 merged. Andrew (Stark Naked Numbers, Principle 2): *"the direction of your GP margin matters more than the absolute."* Personal-finance translation: the existing budget-analysis page is an AI-generated one-shot estimate — useful for *planning*, useless for *progress*. The user has no way to answer *"am I actually getting better at this over time?"* anywhere on the dashboard. The Margin Trend lens does, in one big number + one curve. Bandura self-efficacy operating on a Stark-Naked metric.

### Architectural integrity
- **Read `prisma.unifiedTransaction` directly.** The master snapshot's frequency-based aggregation cannot answer "what was March 2026's margin?" — it would extrapolate current rates backwards. UnifiedTransaction is the only honest source for actual historicals.
- **No new field on `quickMetrics`** (D-43.3-2). Trend is a *time series*, not a point-in-time number; quickMetrics is the SSOT for current state.
- **No new calc engine in `lib/calculations/`** (D-43.3-3). The bucketing + trend-direction logic lives in the route. v1 has one consumer; promote into `lib/calculations/marginTrend.ts` only on second consumer (premature abstraction is more expensive than copy-paste-then-promote).
- **Pure-SVG sparkline, no chart library.** ~60 lines of pathbuilding. Recharts / Chart.js / D3 would add 200KB+ of bundle for the same visual. `<NetWorthTrend>` precedent (`components/dashboard/NetWorthTrend.tsx`) set the same rule — registered formally in `06_UI_UX_FOUNDATION.md`.

### Computation
- For each of the last 6 calendar months (UTC, current inclusive): `monthlyIncome = sum(IN where !isTransfer && !isInvestmentContribution)`; same for `OUT` → `monthlyExpense`; `net = income − expense`; `savingsRate = (net / income) × 100` (0 when income=0).
- Trend direction (sliding window): avg(last 3 months) vs avg(prior 3 months) → ±2pp threshold separates `up` / `flat` / `down`. More stable than month-on-month deltas which swing on a single big bill.
- Self-hide: `enoughHistory = monthsWithIncome >= 3`.

### Behavioural-psychology rules (registered in `06_UI_UX_FOUNDATION.md`)
- **Direction-over-absolute framing** (Andrew). Closing copy reframes single-month snapshots against the slope.
- **Loss aversion** (Kahneman & Tversky). Down trend = **amber**, never red. Loss-aversion-safe palette.
- **Self-efficacy** (Bandura). Visible progress on the sparkline + dot at "you are here" reinforces capability.
- **Locus of control** (Rotter, Bandura). Closing copy never prescriptive — *"the direction is what to watch"*, never *"reduce X by Y%"*.
- **Narrative-fallacy resistance** (Kahneman). Up-trend copy is *measured* — *"compounds dramatically over decades"* is true; *"you're crushing it!"* would be false-confidence on small samples.
- **Concreteness** (Heath & Heath). Dual-axis honesty — savings-rate points + net cashflow dollars give two concrete handles for the same direction.

### Files Created
- `app/api/dashboard/margin-trend/route.ts` — thin endpoint (~190 LOC; `withPermission('report.read')`). Walks last 6 calendar months, buckets by UTC year-month, computes sliding-window trend, returns `{months, current, previous, savingsRateDelta, netCashflowDelta, trend, enoughHistory, monthsWithIncome}`.
- `components/budget/MarginTrendLens.tsx` — pure presentational component (~280 LOC). Headline + trend pill + delta strip + pure-SVG sparkline (line + faint area fill + last-point dot, all motion-safe) + tick labels + direction-over-absolute closing copy.
- `docs/blueprint/PHASE_43_3_MARGIN_TREND.md` — full Phase doc (strategic positioning, computation, 8 architectural decisions, data flow, visualisation with trend-palettes table, behavioural-psychology rules with citations, acceptance, deferred follow-ons).

### Files Modified
- `app/dashboard/budget-analysis/page.tsx` — imports lens + endpoint type; new `marginTrend` state + `useEffect` fetch (cancellable); lens renders at top of `space-y-6` container above the existing AI-estimate / scenario sections.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 43.2 moved to ✅ Recently Completed (PR #739, merged 2026-05-09); §0b replaced with new Phase 43.3 active workstream entry.
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 43.2 row updated to ✅ Complete with PR #739 link; Phase 43.3 row added as 🟡 SHIPPING.
- `docs/architecture/06_UI_UX_FOUNDATION.md` §15.10 — registered `MarginTrendLens` as a canonical typography-led analytical card pattern; pure-SVG-sparkline-no-chart-library rule registered with reviewer rejection clause.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] visual design system / component pattern (canonical Margin-Trend analytical card pattern + pure-SVG-sparkline rule registered)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Phase 43.2 marked complete with PR #739; Phase 43.3 third follow-on activated)

Docs updated in this PR:
- `docs/blueprint/PHASE_43_3_MARGIN_TREND.md` — NEW Phase doc
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 43.2 → ✅ Complete + Phase 43.3 row 🟡 SHIPPING
- `docs/architecture/06_UI_UX_FOUNDATION.md` §15.10 — `MarginTrendLens` canonical analytical card registered + pure-SVG-sparkline rule
- `docs/IMPLEMENTATION_PLAN.md` — Phase 43.2 → Recently Completed; §0b → Phase 43.3 active workstream
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)
N/A — additive only. No Prisma writes (read-only `findMany`). No schema migration.

### Build Status
- [x] TypeScript compilation passes (`npx tsc --noEmit`)

### PR
- Branch: `claude/phase-43-3-margin-trend-MG8mr`
- Status: pending push + open

---

## Session: claude/phase-43-4-enough-history-gate-MG8mr (Phase 43.4 — Tighter enoughHistory Gate SHIPPING — Stark Naked stream COMPLETE)

### Changes Made
- **Type:** Feature (Phase 43.4 — fourth and **final** deferred follow-on from Phase 43; closes the four follow-ons promised in `PHASE_43_MONEY_STORY.md` §8).
- **Scope:** Replaces the cheap `monthlyExpenses > 0` gate on the Money Story Hero's day-count display with a two-mode honest check. Pure read-query addition. No new calc engines, zero `quickMetrics` changes, zero client-side change.
- **Description:** Reza directive 2026-05-09 *"continue"* after PR #740 merged. Phase 43 originally shipped *"47 days of life"* with a deliberately crude false-precision guardrail (`monthlyExpenses > 0`). The architect-mode synthesis flagged the gap: a user with 3 weeks of bank data who hasn't yet hit their annual home-insurance bill gets `monthlyExpenses` undercounted, day claim overstates runway. Phase 43.4 closes that gap.

### Two-mode logic
- **Bank-imported users:** Oldest UnifiedTransaction ≥ 90 days ago — one full quarterly cycle, annual bills should have appeared at least once.
- **Manual-entry users:** ≥ 3 recurring `Expense` rows AND ≥ 1 flagged `isEssential` — user has done meaningful classification.
- Either mode satisfies. Recognises that monitrax has both usage modes. Transaction-only gate (the original spec) would unfairly hide the runway display from manual-entry users with stable data.

### Files Created
- `lib/dashboard/expenseDataMaturity.ts` — `getExpenseDataMaturity(userId)` returning `{isMature, reason: 'bank_history'|'manual_classification'|'none'}`. Pure read-query, two parallel Prisma calls + one conditional follow-up. Lives in `lib/dashboard/` because it's a presentation-layer guard, not a canonical financial calculation (D-43.4-2).
- `docs/blueprint/PHASE_43_4_ENOUGH_HISTORY_GATE.md` — concise Phase doc (43.4 is the smallest of the four follow-ons; brief Phase doc is fine).

### Files Modified
- `app/api/dashboard/insights/route.ts` — imports new helper; calls it before building the response; replaces `enoughHistory: snapshot.quickMetrics.monthlyExpenses > 0` with `enoughHistory: expenseMaturity.isMature`. JSDoc on the `enoughHistory` field updated to cite the new gate.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 43.3 moved to ✅ Recently Completed (PR #740, merged 2026-05-09); §0b replaced with new Phase 43.4 active workstream entry.
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 43.3 row updated to ✅ Complete with PR #740 link; Phase 43.4 row added as 🟡 SHIPPING with "Stark-Naked-Numbers translation stream complete" tag.
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry.

### What this protects
| User profile | Before 43.4 | After 43.4 |
|---|---|---|
| New user, $0 expenses defined | Day count hidden ✅ | Same |
| User with $4,000/mo manually defined (3 recurring + 1 essential) | "47 days of life" ✅ | Same — manual_classification path satisfies |
| User with 3 weeks of BASIQ data, no manual classification | "47 days of life" ⚠️ (annual bills not yet captured — overstates runway) | "Truly liquid right now" ✅ — neither mode satisfies, fallback display |
| User with 4 months of BASIQ data | "47 days of life" ✅ | Same — bank_history path satisfies |
| User who linked BASIQ today + 2 manual recurring expenses (none essential) | "47 days" ⚠️ | "Truly liquid right now" ✅ |

The guarded case is small but real — that user was the one most likely to make a wrong decision off the day count.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern (no client-side change — same boolean, different source)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Phase 43.3 marked complete with PR #740; Phase 43.4 — final follow-on — activated; **Stark-Naked-Numbers translation stream complete with this PR**)

Docs updated in this PR:
- `docs/blueprint/PHASE_43_4_ENOUGH_HISTORY_GATE.md` — NEW Phase doc
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 43.3 → ✅ Complete + Phase 43.4 row 🟡 SHIPPING
- `docs/IMPLEMENTATION_PLAN.md` — Phase 43.3 → Recently Completed; §0b → Phase 43.4 active workstream
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)
N/A — additive only. Helper is pure read-query (Prisma `findFirst` + `aggregate` + `count`). No writes of any kind. No schema migration.

### Build Status
- [x] TypeScript compilation passes (`npx tsc --noEmit`)

### PR
- Branch: `claude/phase-43-4-enough-history-gate-MG8mr`
- Status: pending push + open

---

## Session: claude/phase-36-2bd-balances-consolidation-MG8mr (Phase 36 Phase 2b/2d/2e + cross-doc sweep)

### Changes Made
- **Type:** Two-in-one — (1) Phase 36 Phase 2b/2d/2e: dead-route retirement + balances consolidation; (2) cross-doc sweep per Reza directive *"make sure all documents is up to date including design plan support bau help etc"*.
- **Scope:** `/dashboard/accounts` and `/dashboard/loans` bare list pages retired with `redirect()`; sub-routes preserved; `?action=` and `?id=` handlers added on Balances; `routeMap.ts` flipped; 7 source-side hrefs flipped; full doc-sync sweep across IMPLEMENTATION_PLAN, MASTER_BLUEPRINT, PHASE_36, HELP_COVERAGE_MAP, 07_API_STANDARDS, operational/architecture/01_SYSTEM_OVERVIEW.

### Code changes — Phase 36 Phase 2b/2d/2e
- `app/dashboard/accounts/page.tsx` — replaced 737-line list page with 23-line redirect component (`redirect('/dashboard/balances')` from `next/navigation`).
- `app/dashboard/loans/page.tsx` — replaced 661-line list page with 26-line redirect. Sub-routes `/dashboard/loans/[id]` (loan detail) and `/dashboard/loans/[id]/strategy` (debt-strategy planner) PRESERVED.
- `app/dashboard/balances/page.tsx` — added `useSearchParams` import; new `?action=` handler (connect-basiq / add-account / add-loan); new `?id=` cross-module-nav handler (looks up entity in loaded list and auto-opens `<AccountDetailDialog>` or `<LoanDetailDialog>`, guarded by `idHandledRef`).
- `lib/navigation/routeMap.ts` — `account.basePath` and `loan.basePath` flipped to `/dashboard/balances` (was `/dashboard/accounts` and `/dashboard/loans`). Closes the cross-module-nav regression that bare-redirect alone would have caused.
- 7 source-side hrefs flipped to `/dashboard/balances?action=...`:
  - `components/setup/SetupNextActionPanel.tsx` (×2)
  - `components/dashboard/BasiqHeroCard.tsx` (×2)
  - `components/dashboard/DashboardEmptyStateGrid.tsx` (×3)
  - `components/LinkedDataPanel.tsx` (×2)
  - `components/health/ModuleHealthBlock.tsx` (×1)
  - `components/dashboard/EntityCashflowSummary.tsx` (×1)

### Docs swept
- `docs/IMPLEMENTATION_PLAN.md` — Phase 43.4 moved to ✅ Recently Completed (PR #741); §0b replaced with new Phase 36 Phase 2b/2d/2e active workstream entry covering both the build and the doc-sync sweep.
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 43.4 → ✅ Complete (PR #741, "Stark-Naked-Numbers translation stream complete: PRs #737 → #741"); Phase 36 row updated with 2b/2d/2e closure status (only Phase 2c remaining).
- `docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md` — top-status block rewritten ("nearly complete — only Phase 2c remaining"); Phase 2a–2f checklist all flipped to ✅ except 2c (📋 remaining); new "Phase 2 — `routeMap.ts` flip" subsection added documenting the cross-module-nav fix.
- `docs/blueprint/HELP_COVERAGE_MAP.md` — Consumer Surfaces table extended: `/dashboard/expenses` row added with Phase 43.2 lens annotation; `/dashboard/budget-analysis` flipped from `none` (legacy redirect target) to `article-shared` with Phase 43.3 lens annotation; `/dashboard` + `/dashboard/balances` rows annotated with their Phase 43 + 43.1 lenses; `/dashboard/accounts` + `/dashboard/loans` rows added as `redirect` class; new `redirect` entry added to the Classes legend.
- `docs/architecture/07_API_STANDARDS.md` — new §11.5 "Dashboard derivation APIs (Phase 43 stream, 2026-05-09)" registers the four endpoints (`/api/dashboard/insights moneyStory block`, `/hidden-wealth`, `/spending-pareto`, `/margin-trend`) and the family rules (read-through, no calc engine, presentation-layer-only, double-defence self-hide gates).
- `docs/operational/architecture/01_SYSTEM_OVERVIEW.md` — Dashboard Modules table updated: Loans/Accounts rows replaced with `Balances` (canonical accounts surface) + `Loans (detail)` row pointing at the preserved sub-routes; Expenses + Budget Analysis rows annotated with their Phase 43 lenses.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] visual design system / component pattern (no new primitive — but `?action=` and `?id=` deep-link contracts on Balances are new behaviours; documented in PHASE_36)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (operational/architecture/01_SYSTEM_OVERVIEW dashboard modules table updated; HELP_COVERAGE_MAP `redirect` class added)
- [x] strategic decision (Phase 43.4 marked complete with PR #741; Phase 36 Phase 2b/2d/2e shipped; cross-doc sweep completed)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — Phase 43.4 → Recently Completed; §0b → Phase 36 Phase 2b/2d/2e active workstream
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 43.4 ✅ Complete + Phase 36 row updated
- `docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md` — Phase 2a–2f checklist + new routeMap-flip section
- `docs/blueprint/HELP_COVERAGE_MAP.md` — Consumer Surfaces table + Classes legend
- `docs/architecture/07_API_STANDARDS.md` §11.5 — new Dashboard derivation APIs section
- `docs/operational/architecture/01_SYSTEM_OVERVIEW.md` — Dashboard Modules table
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)
N/A — additive only. No Prisma writes (the `?id=` handler reads loaded state). No schema migration. No raw SQL.

### Build Status
- [x] TypeScript compilation passes (`npx tsc --noEmit`)
- Financial-surfaces lint baseline: 0 entries on `app/dashboard/balances/page.tsx` — no sync needed.

### PR
- Branch: `claude/phase-36-2bd-balances-consolidation-MG8mr`
- Status: pending push + open
