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

---

## Session: claude/phase-32b-scope-presets-MG8mr (Phase 32B PR3 #10 — profession-aware consent scope presets)

### Changes Made
- **Type:** Feature (Phase 0 chunk — closes Phase 32B PR3 item #10).
- **Scope:** New SSOT module for profession-aware consent scope presets + quick-pick chips in the adviser-side invite-a-client modal. Zero schema, zero new endpoint, zero CDR posture change.
- **Description:** Reza directive 2026-05-09 *"ship the autonomous steps and give me pr url"* after PR #742 merged. When an adviser/broker/accountant invites a client, they request a `DataAccessScope` set. Free-form picking puts the "what does my profession need?" burden on every adviser, every time — friction at onboarding. Three presets encode the common answers.

### Files Created
- `lib/portal/scopePresets.ts` (~110 LOC) — `SCOPE_PRESETS` array + `getScopePreset(id)` + `matchScopePreset(selected)` reverse-lookup. Three presets:
  - `LENDING` — `[LOANS, PROPERTIES, TRANSACTIONS]` — brokers assessing serviceability + existing debt
  - `TAX` — `[TAX, TRANSACTIONS, DOCUMENTS]` — accountants preparing returns + substantiating deductions
  - `ADVISORY` — `[FINANCIAL, INVESTMENTS, TAX, TRANSACTIONS, PROPERTIES, LOANS]` — "FULL minus DOCUMENTS" enumerated (the invite UI treats the `FULL` literal as mutually-exclusive, so the minus-one case can't be `['FULL']`). DOCUMENTS excluded because it can contain material outside the adviser's remit (wills, legal letters, medical docs). Full JSDoc explains both choices.

### Files Modified
- `components/portal/team/InviteModal.tsx` — imports the SSOT module; new `applyPreset(id)` handler + `activePreset` (recomputed each render via `matchScopePreset`); when `type === 'client'`, a row of 3 quick-pick chips renders above the existing scope checkboxes. Clicking a chip applies the preset; the active chip highlights (emerald); de-highlights automatically when the selection deviates. Chips: `aria-pressed` + `title` (the `forWhom` line) + focus-visible ring. Existing `handleScopeToggle` + `selectedScopes` state + submit path untouched.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 0 chunk checkbox flipped to `[x]`; Phase 32B PR3 #10 line (line 221) flipped to `[x] SHIPPED`; Phase 36 PR #742 moved to Recently Completed; §0b replaced with this active-workstream entry.
- `docs/blueprint/PHASE_32_ENTERPRISE_PORTAL.md` — new "Consent scope presets (PR3 #10)" status row, dated 2026-05-09.

### Spec-vs-implementation note
The original spec (Phase 32B PR3 #10) named `ConsentRequest.tsx` as the implementation point. That component is the *consumer-side approve* UI — presets there don't fit (the consumer responds to a specific request, they don't compose one). The adviser-side *request* UI is `InviteModal.tsx` (where `selectedScopes` is chosen), so the presets ship there. Plan + Phase 32 doc updated to reflect this.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] visual design system / component pattern (3 preset chips above the scope-checkbox grid in InviteModal — small additive pattern, documented in PHASE_32 doc)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth (consent *request* picker UX improves; consent semantics unchanged — consumer still approves/rejects exactly as before)
- [ ] deployment / build
- [ ] security / CDR posture (no widening — presets request *fewer* scopes than a panicked adviser might check "everything")
- [ ] operational procedure
- [x] strategic decision (Phase 32B PR3 #10 closed; Phase 36 PR #742 marked complete)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — chunk + item #10 + §0b + Recently Completed
- `docs/blueprint/PHASE_32_ENTERPRISE_PORTAL.md` — new status row
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)
N/A — additive only. New module is pure data + two pure functions (no Prisma, no fetch). InviteModal change is presentation-only. No schema migration.

### Build Status
- [x] TypeScript compilation passes (`npx tsc --noEmit`)

### PR
- Branch: `claude/phase-32b-scope-presets-MG8mr`
- Status: pending push + open

---

## Session: claude/phase-36-2c-import-transactions-MG8mr (Phase 36 Phase 2c — Import Transactions UI migration; CLOSES PHASE 36)

### Changes Made
- **Type:** Feature (Phase 36 Phase 2c — last sub-phase; closes Phase 36 entirely).
- **Scope:** Promotes the Import Transactions flow to a first-class `Import` toolbar action on `/dashboard/balances`; wires `?action=import` deep link; makes the `AccountDetailDialog`'s import buttons live. Zero new components, zero schema, zero new endpoint.
- **Description:** Reza directive 2026-05-09 *"Continue"* (autonomous-queue item #2). The Import Transactions flow used to be reachable only from the now-retired `/dashboard/accounts` toolbar + the account-source picker's Import tile + a dead `onImportClick`-omitted button in the account-detail dialog. This PR makes it a proper toolbar action on Balances and lights up the detail-dialog buttons.

### Files Modified
- `app/dashboard/balances/page.tsx`:
  - New `Import` toolbar button (Upload icon) next to Connect Bank / + Account / + Loan → `onClick={() => setImportOpen(true)}`. Opens the existing page-level `TransactionImportDialog` (already wired since Phase 1c; just had no direct entry). `ImportWizard` + `TransactionReviewPanel` already live inside that dialog — no standalone migration needed.
  - `?action=import` case added to the `?action=` deep-link handler — completes the set (`connect-basiq` / `add-account` / `add-loan` / `import`). Idempotent (cleans URL after firing).
  - `AccountDetailDialog` now receives `onImportClick={() => { setDetailOpen(false); setImportOpen(true); }}` — the "Import Transactions" buttons on the Transactions tab + empty state are now live (were dead with `onImportClick` omitted). The detail dialog closes first so the two modals don't stack.
  - Stale "Phase 1 hides the import button … Phase 2 will lift the import flow over" comment block replaced with the live-state description.
- `docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md` — top-status → ✅ COMPLETE; "Shipped" block updated (2c entry added, 2b/2d/2e attributed to PR #742); §8 checklist 2c flipped to ✅; "Remaining: none".
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 36 row → ✅ Complete (May 2026) with all-sub-phases summary.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 0 chunk caveat removed ("closes Phase 36 entirely" instead of "Phase 36 Phase 2c remains"); §8 checklist 2a/2b/2c/2d/2e all flipped to `[x]` with PR attributions + "Phase 36 is COMPLETE" line; §0b replaced (scope-presets workstream → this Phase 36 2c workstream); PR #743 (scope presets) added to Recently Completed.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new toolbar button + live account-detail import button — small additive pattern)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Phase 36 closed entirely; PR #743 marked complete)

Docs updated in this PR:
- `docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md` — top-status + Shipped block + §8 checklist + "Remaining: none"
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 36 → ✅ Complete
- `docs/IMPLEMENTATION_PLAN.md` — Phase 0 chunk + §8 checklist + §0b + Recently Completed
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)
N/A — additive only. New toolbar button + new switch case + one prop passed. The `TransactionImportDialog` it opens is the exact same dialog already rendered on the page — no change to the import/parse/commit flow. No schema migration. No Prisma writes.

### Build Status
- [x] TypeScript compilation passes (`npx tsc --noEmit`)

### PR
- Branch: `claude/phase-36-2c-import-transactions-MG8mr`
- Status: pending push + open

---

## Session: claude/phase-32b-real-alert-engine-MG8mr (Phase 32B PR3 #9a — Real Alert Engine foundation)

### Changes Made
- **Type:** Feature (Phase 32B PR3 #9a — schema + pure engine + tests + cron sweep; #9b — org-scoped GET + Practice wiring — queued).
- **Scope:** The Practice dashboard's "needs attention today" alert stream gains a real engine. This PR is the foundation: storage schema, the pure trigger engine, tests, and the daily cron sweep. The visible-to-adviser half (GET + dismiss + dashboard wiring) is #9b.
- **Description:** Reza directive 2026-05-09 *"Continue"* (autonomous-queue item #3). The alert stream currently renders `LIGHTHOUSE_ALERTS` — a hand-authored demo fixture. PR #9 makes it compute from real client snapshot data. Split into two PRs for reviewability.

### Schema (additive)
- `prisma/schema.prisma`:
  - New enum `ClientAlertStatus` (`ACTIVE` / `DISMISSED` / `RESOLVED`).
  - New model `ClientAlert` — one live row per `(organizationClientId, triggerKind)`; `organizationId` denormalised for the org-scoped GET; `severity` (`critical`/`opportunity`/`milestone`); `headline`/`body`/`context`/`primaryActionLabel`; `payload` JSON (**aggregate context numbers only — no raw CDR data, §13.3**); `detectedAt`/`resolvedAt`/`dismissedAt`/`dismissedByMemberId`. Unique on `(organizationClientId, triggerKind)`; indexed on `(organizationId, status)`, `organizationClientId`, `status`, `triggerKind`. Cascade FK → `organization_clients`.
  - New model `ClientSnapshotMarker` — prior-sweep state for the delta triggers; one row per client (`organizationClientId` unique FK, cascade); `lastHealthScore` (Int?), `lastTrailStage` (string?), `lastSweptAt`.
  - Relations added on `OrganizationClient`: `alerts ClientAlert[]`, `alertMarker ClientSnapshotMarker?`.
- `prisma/migrations/20260513110000_phase_32b_pr3_alert_engine/migration.sql` — hand-written (the dev DB isn't reachable from the build sandbox so `prisma migrate dev` couldn't generate it; the Vercel preview build's `prisma migrate deploy` against monitrax-db-dev is the validation per CLAUDE.md §12.12). Purely additive: `CREATE TYPE` × 1, `CREATE TABLE` × 2, `CREATE INDEX` × 6, `ADD CONSTRAINT` × 2. §12.11 destructive-write checklist N/A by structural argument.

### Files Created
- `lib/portal/alerts/alertEngine.ts` (~280 LOC) — the pure engine. `computeAlerts({ snapshot, prior?, enabledTriggers }) → ComputedAlert[]` taking a minimal `AlertEngineSnapshot` projection (not the full `MasterFinancialSnapshot` — decoupled + testable), the optional prior-sweep state, and the trigger kinds this org's profession surfaces. Plus `scopeAllowedTriggers(grantedScopes) → Set<AlertTriggerKind>` (consent gate: `FULL` → everything; `FINANCIAL`/`TRANSACTIONS` → cashflow/emergency/health/trail; `PROPERTIES`/`LOANS` → LVR). Five v1 triggers: `CASHFLOW_NEGATIVE` (critical, stateless) · `EMERGENCY_FUND_LOW` (critical, stateless) · `LVR_REFINANCE_WINDOW` (opportunity, stateless — 0 < LVR < 80% AND usable equity ≥ $20k) · `HEALTH_DROP` (critical, stateful — prior − current ≥ 10pts) · `TRAIL_ADVANCED` (milestone, stateful — current stage later than prior). Stateful triggers gracefully no-op without a prior marker. All thresholds are constants in-file (SSOT: `HEALTH_DROP_THRESHOLD = 10`, `LVR_REFINANCE_CEILING = 80`, `LVR_MIN_USABLE_EQUITY_AUD = 20_000`). Pure — no DB, no fetch, no `Date.now()` side effects.
- `tests/portal/alerts/alertEngine.test.ts` (~190 LOC) — 20+ unit tests pinning each trigger condition, the thresholds (boundary cases), the stateful-graceful-no-op behaviour, the `enabledTriggers` gating, the canonical kind-ordering, and the healthy-baseline-fires-nothing invariant.
- `app/api/portal/alerts/sweep/route.ts` (~290 LOC) — the cron runner. `Authorization: Bearer <CRON_SECRET>` (timing-safe; unauthorised → `UNAUTHORIZED_ACCESS` + `BLOCKED` audit row, mirroring the CDR/conversation crons). For each org → for each `ACTIVE` + `GRANTED` client → `getMasterFinancialSnapshot(clientUserId)` (full snapshot; consent gate applied at the trigger level via `scopeAllowedTriggers` since a cron has no "seat" to pass as `viewerContext`) → project into `AlertEngineSnapshot` + derive TRAIL stage via `determineTrailStage` → `computeAlerts` with `enabledTriggers = professionTriggers ∩ scopeAllowedTriggers` → persist (upsert ACTIVE rows; leave DISMISSED rows alone while the condition holds; flip ACTIVE/DISMISSED → RESOLVED when the condition clears, which re-arms; upsert the marker for next run's delta triggers). Optional body `{ dryRun?, organizationId? }`. Returns 200 even when nothing changed. `maxDuration = 300`.
- `docs/blueprint/PHASE_32B_PR3_ALERT_ENGINE.md` — the workstream doc (5-trigger table, architecture, dismissal semantics, privacy, Cloud Scheduler config, #9b scope, v2 future, references).

### Files Modified (doc-sync)
- `docs/architecture/03_DATA_MODEL.md` §9.3 (new) — documents `client_alerts` + `client_snapshot_markers` (schema-change → §3.1 mapping).
- `docs/blueprint/PHASE_32_ENTERPRISE_PORTAL.md` — new "Real alert engine (PR3 #9)" status row.
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 32B PR3 row updated with #10 ✅ + #9 🟡 notes.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 0 "Real alert engine v1" chunk → `[~]` partial with the #9a/#9b split; §0b → this active-workstream entry; PR #744 (Phase 36 Phase 2c) → Recently Completed.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern (no UI in #9a — that's #9b)
- [ ] application config
- [ ] GCP infrastructure (the Cloud Scheduler job is a Reza-side console step, documented but not wired in this PR)
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (new aggregate-only alert payloads; trigger-level consent gate; `CRON_SECRET` auth + `BLOCKED` audit on unauthorised hits — documented in `03_DATA_MODEL.md` §9.3 + `PHASE_32B_PR3_ALERT_ENGINE.md` §3)
- [x] operational procedure (new cron endpoint + Cloud Scheduler config documented in `PHASE_32B_PR3_ALERT_ENGINE.md` §4)
- [x] strategic decision (Phase 32B PR3 #9 split into #9a/#9b; PR #744 marked complete)

Docs updated in this PR:
- `docs/blueprint/PHASE_32B_PR3_ALERT_ENGINE.md` — NEW workstream doc
- `docs/architecture/03_DATA_MODEL.md` §9.3 — new alert-engine tables
- `docs/blueprint/PHASE_32_ENTERPRISE_PORTAL.md` — PR3 #9 status row
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 32B PR3 row
- `docs/IMPLEMENTATION_PLAN.md` — Phase 0 chunk + §0b + Recently Completed
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)

N/A by structural argument. Migration is purely additive (`CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX` / `ADD CONSTRAINT`). The cron's only `updateMany` calls flip the sweep's own `client_alerts` rows (`ACTIVE`/`DISMISSED` → `RESOLVED`) — scoped by `organizationClientId` + `id IN (...)` where-clauses to rows the sweep created; no user-entered data is overwritten, no rows deleted. `createAuditLog` is append-only.

### Schema-migration checklist (CLAUDE.md §12.12)

`prisma/schema.prisma` changed → matching migration file `prisma/migrations/20260513110000_phase_32b_pr3_alert_engine/migration.sql` present in the same PR ✓. Hand-written (dev DB not reachable from sandbox) — purely additive, no `DROP`/`ALTER...DROP`/`TRUNCATE`. Vercel preview build's `prisma migrate deploy` validates against monitrax-db-dev.

### Build Status
- [⚠] Local `tsc --noEmit` is a no-op in this sandbox (no `node_modules`, no generated Prisma client) — the Vercel preview build is the canonical type + migration check. Code reviewed carefully against the schema; the cron's `createAuditLog` call matches the `{ action: 'UNAUTHORIZED_ACCESS', status: 'BLOCKED', entityType, ipAddress?, metadata }` shape used by `/api/conversations/retention-sweep`.

### PR
- Branch: `claude/phase-32b-real-alert-engine-MG8mr`
- Status: pending push + open

---

## Session: claude/phase-32b-alert-engine-9b-MG8mr (Phase 32B PR3 #9b — Real Alert Engine wiring; CLOSES PR3 + the Phase 0 alert chunk)

### Changes Made
- **Type:** Feature (Phase 32B PR3 #9b — the visible-to-adviser half: org-scoped GET + dismiss endpoint + Practice dashboard wiring). Closes Phase 32B PR3 item #9 — the last PR3 item.
- **Scope:** Two API routes + one component prop + the Practice dashboard. The #9a foundation (schema + pure engine + tests + cron, PR #745) is now wired through to the UI. No schema migration.
- **Description:** Reza directive 2026-05-09 *"continue"* (autonomous-queue follow-on). #9a shipped the engine but nothing the adviser sees. #9b makes `/portal/dashboard`'s alert stream read real `ClientAlert` rows, with a one-click dismiss.

### Files Created
- `app/api/portal/alerts/route.ts` (~140 LOC) — `GET /api/portal/alerts?organizationId=…`. `withPermission('org.read', …)` + inline active-membership check (mirrors `/api/portal/conversations`). Returns the org's `ACTIVE` `ClientAlert` rows projected to the `DemoAlert` shape (`{ id, clientId, triggerKind, severity, headline, body, context, primaryActionLabel, detectedAt }`) + a thin client-summary array (`{ id, initials, name }`); client names resolved with a single follow-up `prisma.user.findMany` (no `user` relation on `OrganizationClient` — it's a loose `userId` FK). Privacy (§13.3): only aggregate alert fields + display name + initials leave the endpoint; the `payload` column is NOT returned. `clientId == organizationClientId == clients[].id` so the component's `clientById` lookup works unchanged.
- `app/api/portal/alerts/[id]/dismiss/route.ts` (~80 LOC) — `POST /api/portal/alerts/[id]/dismiss`. `withPermission<RouteContext>('org.update', …)` + active-membership check against the alert's org. Sets `status = DISMISSED`, `dismissedAt = now`, `dismissedByMemberId = caller's OrganizationMember.id`. Idempotent on an already-DISMISSED row; 409 on a RESOLVED row. The sweep then leaves the DISMISSED row alone while the condition holds (sticky) and flips it to RESOLVED — re-arming — once it clears.

### Files Modified
- `components/portal/practice/PracticeAlertStream.tsx` — new optional `onDismiss?: (alertId: string) => void` prop; when present each alert row gets a "Dismiss" link under the primary-action button (with focus-visible underline). `clients` prop narrowed `DemoClient[]` → `AlertClientSummary = Pick<DemoClient, 'id' | 'initials' | 'name'>` (the stream only reads id/initials/name; both the fixture and the lean live summary satisfy it). `AlertClientSummary` exported.
- `components/portal/practice/index.ts` — re-exports `type AlertClientSummary`.
- `app/portal/dashboard/page.tsx` — `'use client'` (already); added `useCallback`/`useEffect`/`useState`. `useEffect` fetches `GET /api/portal/alerts` for the current org → `realAlerts === null` ⇒ fixture-preview mode (the `LIGHTHOUSE_ALERTS` fixture, kept as the empty-state placeholder); a non-empty real array ⇒ swaps to live data + passes `onDismiss` (optimistic-remove + refetch). Falls back to the fixture preview on any fetch failure. Hero KPI strip + client-book table stay on the fixture for #9b (recomputing them needs the real client book, not just alerts — noted as post-#9b polish).

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] visual design system / component pattern (`onDismiss` affordance on `PracticeAlertStream` — small additive pattern, documented in `PHASE_32B_PR3_ALERT_ENGINE.md` §6)
- [ ] application config
- [ ] GCP infrastructure (Cloud Scheduler job already documented in #9a; still a Reza-side console step)
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (new org-scoped GET — aggregate fields + display name only, no `payload`, membership-gated; dismiss is `org.update` + member-of-the-alert's-org — documented in `PHASE_32B_PR3_ALERT_ENGINE.md` §6 + `03_DATA_MODEL.md` §9.3)
- [ ] operational procedure
- [x] strategic decision (Phase 32B PR3 closed entirely; Phase 0 "Real alert engine v1" chunk done; PR #745 marked complete)

Docs updated in this PR:
- `docs/blueprint/PHASE_32B_PR3_ALERT_ENGINE.md` — top-status → ✅ COMPLETE; §6 → "#9b — wiring (✅ shipped)" with the post-#9b polish items
- `docs/blueprint/PHASE_32_ENTERPRISE_PORTAL.md` — "Real alert engine (PR3 #9)" row → ✅ Complete
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 32B PR3 row → PR3 #9 ✅; "Phase 32B PR3 complete (#1–#10)"
- `docs/IMPLEMENTATION_PLAN.md` — Phase 0 alert chunk → `[x]`; §0b → this workstream; PR #745 → Recently Completed
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)

N/A — no schema migration; no Prisma `delete`/`deleteMany`/`updateMany`/`upsert`/`$executeRaw`. The dismiss route's single `prisma.clientAlert.update` targets the one row identified by `id` (membership-gated) and only sets `status`/`dismissedAt`/`dismissedByMemberId` — no user-entered data overwritten.

### Build Status
- [⚠] Local `tsc --noEmit` is a no-op in this sandbox (no `node_modules`, no generated Prisma client). Code reviewed against the schema: `prisma.clientAlert` / `prisma.organizationMember` / `prisma.user` access; `OrganizationClient` has no `user` relation so the GET resolves names with a follow-up `prisma.user.findMany`; `User` has `name` (single field, not `firstName`/`lastName`) + `email`; `withPermission<RouteContext>('org.update', …)` pattern matches `app/api/portal/professional-requests/[id]/route.ts`. The Vercel preview build is the canonical type + migration check.

### PR
- Branch: `claude/phase-32b-alert-engine-9b-MG8mr`
- Status: pending push + open

---

## Session: claude/email-in-hardening-MG8mr (Phase 0 — Email-in hardening for the SendGrid Inbound Parse webhook)

### Changes Made
- **Type:** Security hardening (Phase 0 production-readiness chunk). The SendGrid Inbound Parse webhook (`/api/conversations/inbound`) shipped in Phase 32C PR4d with zero verification — the original file's TODO listed the missing layers. This PR adds them.
- **Scope:** New pure verification module + 20+ unit tests + the route refactored to use them. No schema migration. The hardening is additive — when the new env vars are unset the behaviour is exactly the old behaviour (with one always-on new gate: the rate limit).
- **Description:** Reza directive 2026-05-09 *"continue"* (autonomous-queue item #4). Without verification, anyone who guessed the `monitrax+conv-<slug>@<inbound-domain>` address pattern could inject into an adviser↔client thread (the exact-email-match was the only gate, and a spoofed `From` header passes it if you also know the consumer's email). Production-readiness blocker for the email-into-conversation channel (part of the 7-year compliance archive, §13.5).

### Files Created
- `lib/email/inboundSecurity.ts` (~190 LOC) — pure verification primitives: `verifyInboundSecret` (timing-safe shared secret `INBOUND_EMAIL_SECRET`; missing-in-prod = misconfiguration → caller 503; missing-in-dev = allowed for local/demo), `verifyDkimSpf` (no-op unless `INBOUND_EMAIL_REQUIRE_DKIM_SPF=true`; then requires SPF=pass + a `pass` in the SendGrid `dkim` field — regex guards against substring false-positives like a "passport" domain), `isSenderAllowed` (exact match on the conversation's consumer participant OR domain in `INBOUND_EMAIL_ALLOWED_DOMAINS`), `checkInboundRateLimit` + `INBOUND_RATE_LIMIT_PER_HOUR = 20` + `INBOUND_RATE_LIMIT_WINDOW_MS`, plus `extractFromAddress` / `emailDomain` / `getAllowedInboundDomains`. No DB, no fetch — the route does the I/O and feeds the results in.
- `tests/email/inboundSecurity.test.ts` (~150 LOC) — 20+ unit tests: dev-allows-no-secret, prod-rejects-no-secret, secret match/mismatch, strict-mode DKIM/SPF boundaries, the "passport" substring guard, from-address extraction (`Name <email>` + bare, lower-cased), `emailDomain` edge cases, allowlist parsing, `isSenderAllowed` exact-match + allowlist-domain + no-consumer-email, rate-limit boundary. Env-driven branches mutate `process.env` per-test (restored in `afterEach`).

### Files Modified
- `app/api/conversations/inbound/route.ts` — verification order, fail-closed, every reject → `BLOCKED` audit row (`auditReject(reason, extra?)` helper using `createAuditLog({ action: 'UNAUTHORIZED_ACCESS', status: 'BLOCKED', entityType: 'ConversationInboundEmail', metadata })`):
  1. **Shared secret** — `?secret=` query param or `x-inbound-secret` header → `verifyInboundSecret`. Missing-in-prod → 503; mismatch → 401.
  2. **DKIM/SPF strict** — reads the SendGrid `SPF`/`spf` + `dkim` form fields → `verifyDkimSpf`. When `INBOUND_EMAIL_REQUIRE_DKIM_SPF=true` and failing → 403 (`EMAIL_AUTH_FAILED`).
  3. **Payload sanity** — existing checks (to/from/text present, ≤ 50KB, slug extractable, conversation exists).
  4. **Sender allowlist** — replaces the inline exact-match with `isSenderAllowed(extractFromAddress(from), consumerEmail)` → 403 (`SENDER_MISMATCH`).
  5. **Per-conversation rate limit** — counts `prisma.conversationMessage.count({ where: { conversationId, channel: 'EMAIL_IN', createdAt: { gte: oneHourAgo } } })` → `checkInboundRateLimit` → 429 (`RATE_LIMITED`).
  File header JSDoc rewritten to describe the hardened flow + the prod env vars + the still-deferred items.
- `docs/policy/MONITRAX_SECURITY_POLICIES.md` §15 (Firewall Protection) — new bullet describing the inbound-webhook hardening + the four env vars + the still-deferred list.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 0 "Email-in hardening" chunk → `[x]` with the 4 named items + the Reza-side env-config note; §0b replaced (Phase 32B PR3 #9b, merged via #746 → Recently Completed) with this active-workstream entry; PR #746 added to ✅ Recently Completed.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [x] application config (new env vars: `INBOUND_EMAIL_SECRET`, `INBOUND_EMAIL_REQUIRE_DKIM_SPF`, `INBOUND_EMAIL_ALLOWED_DOMAINS` — documented in the route header + `MONITRAX_SECURITY_POLICIES.md` §15 + `IMPLEMENTATION_PLAN.md`)
- [ ] GCP infrastructure (SendGrid Inbound Parse destination-URL `?secret=` config is a Reza-side console step, documented but not wired)
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (inbound-webhook injection surface hardened with defence-in-depth: shared secret + DKIM/SPF strict + sender allowlist + per-conversation rate limit; every reject audited — `MONITRAX_SECURITY_POLICIES.md` §15)
- [x] operational procedure (the new prod env vars + SendGrid Inbound Parse `?secret=` config — recorded in `MONITRAX_SECURITY_POLICIES.md` §15 + `IMPLEMENTATION_PLAN.md`)
- [x] strategic decision (Phase 0 "Email-in hardening" chunk done; Phase 32B PR3 #9b — PR #746 — marked complete)

Docs updated in this PR:
- `docs/policy/MONITRAX_SECURITY_POLICIES.md` §15 — inbound-webhook hardening bullet
- `docs/IMPLEMENTATION_PLAN.md` — Phase 0 chunk + §0b + Recently Completed
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry
- (No dedicated Phase doc for the email-in feature exists; the route header JSDoc + the security-policy bullet are the canonical record.)

### Destructive write checklist (CLAUDE.md §12.11)

N/A — no schema migration; no Prisma `delete`/`deleteMany`/`updateMany`/`upsert`/`$executeRaw`. The route's only writes are the existing `postMessage` (a `create`) + `createAuditLog` (append-only). The new `prisma.conversationMessage.count` is read-only.

### Build Status
- [⚠] Local `tsc --noEmit` is a no-op in this sandbox (no `node_modules`). Code reviewed against the schema + the existing patterns: `createAuditLog({ action: 'UNAUTHORIZED_ACCESS', status: 'BLOCKED', entityType, metadata })` matches `/api/conversations/retention-sweep`; `ConversationMessage` has `channel` (`MessageChannel`, `EMAIL_IN` is a valid value) + `createdAt` + an index on `(conversationId, createdAt)`; `import { prisma } from '@/lib/db'` matches `conversationService.ts`; `CONVERSATION_EMAIL_INBOUND` is a valid `AuditAction`. The Vercel preview build is the canonical type check. The 20+ vitest tests cover the pure verification logic.

### PR
- Branch: `claude/email-in-hardening-MG8mr`
- Status: pending push + open

---

## Session: claude/phase-0-operational-readiness-MG8mr (Phase 0 — operational-readiness runbooks: backup/restore drill + IRP tabletop + observability SLOs)

### Changes Made
- **Type:** Documentation (Phase 0 production-readiness chunk — doc-authoring portion). Doc-only PR; no code, no schema, no migration, no infra wiring.
- **Scope:** Three new operational runbooks under `docs/operational/runbooks/` + index/plan/changelog sync. The runbooks are the spec/script the GCP-console execution (Reza-side) will be done against.
- **Description:** Reza directive 2026-05-09 *"continue"* (autonomous-queue item #5 — the last engineering-side Phase 0 chunk). A backup that has never been restored is a hypothesis, not a safety net (cf. the 2026-04-15 R12 incident). An IRP that has never been walked is a document, not a capability. SLOs you haven't defined can't be managed. This PR delivers all three as runbooks/scripts/specs so a future operator at 2am isn't reverse-engineering the process.

### Files Created
- `docs/operational/runbooks/06_BACKUP_RESTORE_DRILL.md` — quarterly *non-destructive* Cloud SQL restore drill. Never touches `monitrax-db-prod`: Part A verify automated backups exist + config matches the doc + a recent `SUCCESSFUL` backup exists; Part B restore the latest backup into a throwaway `monitrax-db-prod-drill` instance (with a `clone` fallback if the instance doesn't exist yet); Part C verify (`_prisma_migrations` matches the newest `prisma/migrations/` folder, core-table row counts within ~5% of prod, an orphaned-rows referential-integrity spot-check); Part D tear down (DO NOT SKIP — a forgotten drill instance is a recurring bill + a second copy of CDR data outside the data map; also `shred` any annual-drill dump files). Annual extension (Part E): PITR clone to a timestamp + `pg_dump`→`pg_restore` round-trip into a local throwaway Postgres. Pre-drill checklist, Drill Log table with a template row, PASS/FAIL definition, "a failed drill is a P1-equivalent finding → open an IMPLEMENTATION_PLAN entry" rule, references table.
- `docs/operational/runbooks/07_IRP_TABLETOP_EXERCISE.md` — annual incident-response tabletop (talk-through; nobody touches prod; rotate through the scenarios). §1 how-to-run. 4 scenarios, each with an "Inject" (what you'd actually see) → walk the 6 IRP phases out loud → 2-4 `DECISION:` markers → "gaps this commonly surfaces": (1) CDR data breach — CRITICAL, tests the NDB clock + Basiq notification + containment-under-pressure + the "serious harm" assessment; (2) production DB unreachable — HIGH (Availability), tests the IRP §10 auth-chain triage (match the error signature against §10.3), the `USE_CLOUD_SQL_CONNECTOR=false` rollback lever, the "is the data corrupt or just unreachable" decision tree, and the backup/restore path; (3) auth-provider outage — HIGH, tests vendor-dependency handling + "is it us (Firebase config broke in the last deploy) or them (GCP Identity Platform incident)" + the missing user-facing status channel; (4) runaway cost / connection exhaustion — MEDIUM→HIGH, tests cost-control wiring + killing leaked idle connections + the `lib/db.ts` singleton discipline + budget-alert-at-80% gap. §6 cross-scenario decision reference (severity / does-the-NDB-clock-start / who-to-notify / how-to-roll-back-a-deploy / how-to-roll-back-DB-auth / how-to-restore / incident-log template). §7 After-Action Report template. §8 Exercise Log. §9 references.
- `docs/operational/runbooks/08_OBSERVABILITY_SLOS.md` — application-level observability (the DB-level monitoring stays in `database/03_MONITORING_AND_ALERTS.md`; not duplicated). §1 the three signal sources (Cloud Monitoring uptime checks + Cloud SQL metrics; Vercel Observability/Analytics; Cloud Logging via `createAuditLog`) and the honest gaps (per-route 5xx/latency currently rely on Vercel dashboards + canaries; a Vercel→Cloud Logging log drain would close it). §2 SLO definitions: availability **99.5%** rolling 30d (~3.6h error budget, with the "why not 99.9%" reasoning + the revisit trigger at ~50 paying users / a second on-call person); **p95/p99 latency targets per route group** (system/health · auth&session · core-financial-read · entity&ledger-CRUD · CDR/banking · AI-advisor · portal · conversations&docs · billing · cron — batch crons and document-upload routes exempt); **5xx error-rate targets per route group** (4xx excluded — a 401/403 is correct behaviour; a *spike* is alert A6). §3 Cloud Monitoring alert-policy specs **A1–A9** (A1 app-down/health-check · A2 health-latency · A3 dashboard-slow · A4 elevated-5xx · A5 Stripe-webhook-failing · A6 auth-failure/blocked-access spike · A7 cron-didn't-run/failed · A8 error-budget-burn · A9 budget-overrun) — each with severity, notification target, and a runbook link; plus a `gcloud alpha monitoring policies create` example and a note to use Cloud Monitoring's native SLO + burn-rate feature for A8. §4 synthetic-canary plan. §5 "Monitrax — Service Health" dashboard tile list. §6 review cadence. §7 "when an SLO is breached" discipline. §8 references. §9 **"live vs spec-only" status table** (what's wired vs what's a Reza-side console step — highest-leverage three flagged). §10 future improvements (Vercel log drain, Error Reporting, distributed tracing, RUM).

### Files Modified
- `docs/operational/00_INDEX.md` — 3 new Quick-Links rows (run the backup/restore drill / run an IRP tabletop / what are our SLOs); 3 new Runbooks-section rows (06/07/08 with descriptions); Document-Status counts updated (Runbooks 01-08, 8 files; Security 01-04, 4 files); Last-Updated line.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 0 chunk "Backup/restore drill + IRP tabletop + observability SLOs" → `[x]` with the Reza-side breakdown (create alert policies A1–A9 + notification channels; Vercel→Cloud Logging log drain; authenticated synthetic monitor; Service Health dashboard; run the first drill + first tabletop); §0b replaced (the email-in-hardening workstream — PR #747, now merged — moved to Recently Completed) with this active-workstream entry; PR #747 added to ✅ Recently Completed; top "Last updated" line refreshed.
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.) — *spec'd, not wired: the alert policies + log drain + synthetic monitor are Reza-side console steps tracked in `08_OBSERVABILITY_SLOS.md` §9*
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (three new runbooks: backup/restore drill, IRP tabletop exercise script, observability SLO + alert-policy specs)
- [x] strategic decision (Phase 0 "Backup/restore drill + IRP tabletop + observability SLOs" chunk's doc-authoring portion done — the last engineering-side Phase 0 production-readiness item)

Docs updated in this PR:
- `docs/operational/runbooks/06_BACKUP_RESTORE_DRILL.md` — new (quarterly non-destructive restore drill)
- `docs/operational/runbooks/07_IRP_TABLETOP_EXERCISE.md` — new (annual tabletop, 4 scenarios)
- `docs/operational/runbooks/08_OBSERVABILITY_SLOS.md` — new (app-level SLOs + Cloud Monitoring alert specs A1–A9)
- `docs/operational/00_INDEX.md` — Quick Links + Runbooks section + Document Status + Last-Updated
- `docs/IMPLEMENTATION_PLAN.md` — Phase 0 chunk + §0b + Recently Completed + top header line
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)

N/A — doc-only PR. No code, no schema migration, no Prisma writes. The procedures the runbooks describe are non-destructive (the backup drill restores into a throwaway instance and explicitly forbids touching `monitrax-db-prod`; the tabletop is a talk-through).

### Build Status
- [✓] Doc-only PR — no build surface. No `.ts`/`.tsx`/`prisma` files touched.

### PR
- Branch: `claude/phase-0-operational-readiness-MG8mr`
- Status: pending push + open

---

## Session: claude/phase-32b-pr3-post9b-polish-MG8mr (Phase 32B PR3 — post-#9b polish, part 1: admin "run sweep now")

### Changes Made
- **Type:** Refactor + feature (admin tooling). Phase 32B PR3 post-#9b polish item ① — the autonomous-queue "continue" item from `PHASE_32B_PR3_ALERT_ENGINE.md`.
- **Scope:** Extract the portal alert-sweep core out of the cron route into a shared function; add a SUPER_ADMIN-only "run sweep now" endpoint + an admin-UI button so the engine can be exercised before the GCP Cloud Scheduler job is wired.
- **Root cause / motivation:** The portal alert engine (#9a/#9b, PRs #745/#746) is fully built but dormant until `monitrax-portal-alert-sweep` (`0 4 * * *` UTC) is created in GCP Cloud Scheduler — a Reza-side console step. There was no way to trigger the sweep otherwise (testing, backfill, post-onboarding recompute, or just demoing the alert stream against a seeded org). Also: the sweep logic lived inside the cron route — a duplicated-logic seam waiting to happen the moment a second caller appeared.
- **Solution:** `runPortalAlertSweep({ dryRun?, organizationId? })` is now the single implementation (`lib/portal/alerts/sweepRunner.ts`); the cron route and the new admin route are thin auth wrappers around it (CLAUDE.md §12.2 SSOT). The admin route is gated `SUPER_ADMIN` and writes an `AuditLog` row on every invocation. The admin UI defaults to dry-run.

### Files Created
- `lib/portal/alerts/sweepRunner.ts` (~290 LOC) — `runPortalAlertSweep(opts): Promise<PortalAlertSweepResult>` + the `projectSnapshot` helper, moved verbatim from the cron route. Per `Organization` (optionally one) → per `OrganizationClient` (`status = ACTIVE`, `consentStatus = GRANTED`) → `getMasterFinancialSnapshot(client.userId)` → `projectSnapshot` (cast to `AlertEngineSnapshot` + `determineTrailStage`) → `computeAlerts({ snapshot, prior, enabledTriggers })` with `enabledTriggers = professionTriggers ∩ scopeAllowedTriggers(client.accessScopes)` → persist: upsert ACTIVE `ClientAlert` rows (leave DISMISSED alone — sticky), `updateMany(→RESOLVED)` rows whose trigger cleared, upsert `ClientSnapshotMarker`. `dryRun` computes everything and writes nothing. Behaviour is byte-for-byte the same as #9a (PR #745).
- `app/api/admin/portal-alert-sweep/route.ts` (~110 LOC) — `POST`, `verifyAdminGCPAuth` + `role === 'SUPER_ADMIN'` (mirrors `/api/admin/run-seed`; 503 when the admin portal isn't enabled, 401 on bad session, 403 on wrong role). Body `{ dryRun?, organizationId? }` → `runPortalAlertSweep(...)`. Writes an `AuditLog` row (`action: 'UPDATE'`, `status: 'SUCCESS'|'FAILURE'`, `entityType: 'PortalAlertSweep'`, `metadata: { trigger: 'admin-manual', adminEmail, dryRun, organizationId, orgsProcessed, clientsProcessed, alertsCreated/Updated/Resolved, errorCount }`) on success and on failure. Returns `{ ...PortalAlertSweepResult, runBy }`. `maxDuration = 300`, `dynamic = 'force-dynamic'`.

### Files Modified
- `app/api/portal/alerts/sweep/route.ts` — refactored to a thin wrapper: CRON_SECRET timing-safe auth (unchanged) + `BLOCKED`-audit-on-fail (unchanged) + parse `{dryRun,organizationId}` body → `runPortalAlertSweep(...)` → `NextResponse.json(result)`. `dynamic`/`maxDuration` preserved. Header JSDoc rewritten to point at the shared runner + the admin endpoint. The `SweepResult`/`SweepBody` interfaces + `projectSnapshot` + the per-org/per-client loop all moved to `sweepRunner.ts`.
- `app/admin/scheduler/page.tsx` — new "Portal alert sweep" `AdminCard` below the Cloud Scheduler jobs table (rendered outside the data-load block — it calls our app endpoint, not the GCP Scheduler API, so it works even when the GCP API isn't configured). Has: a **"Dry run (compute only — write nothing)"** checkbox (default ON); a **"Preview sweep" / "Run sweep now"** button (label flips with the checkbox; `isLoading` while running); an amber "Writes ClientAlert rows for all orgs." hint when dry-run is off; a result panel — an `AdminBadge` (neutral "Dry run" / success "Applied") + duration + run-by + a counts grid (orgs / clients processed / skipped / alerts created·updated·resolved / errors) + the first 10 per-client errors if any. Uses `safeAdminFetch('/api/admin/portal-alert-sweep', { method: 'POST', body: JSON.stringify({ dryRun }) })`. New state: `sweepDryRun` / `sweepRunning` / `sweepResult` / `sweepError` + a `handleRunSweep` handler + a `PortalAlertSweepResult` interface.
- `docs/blueprint/PHASE_32B_PR3_ALERT_ENGINE.md` — new §6b "Post-#9b polish — part 1: admin run sweep now (✅ shipped)" with the item table; §6 table row "Admin run sweep now" flipped 📋→✅ (and "computeKpis real input" note points at §6b); header status line updated (post-#9b polish ① ✅ / ② 📋, with the ② blocker — the client-book's financial columns — spelled out); §8 references add `sweepRunner.ts` + `run-seed/route.ts` as the admin-auth pattern.
- `docs/IMPLEMENTATION_PLAN.md` — the Phase 0 "Real alert engine v1" chunk's post-#9b note split (admin button ✅ this PR; hero KPI 📋 still queued, with the architect-mode-pass note); §0b replaced (operational-readiness workstream — PR #748, now merged → Recently Completed) with this active-workstream entry; PR #748 added to ✅ Recently Completed; top "Last updated" line refreshed.
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (new admin-portal tooling: a manual "run portal alert sweep" trigger with dry-run, audit-logged; the cron route refactored to share its core)
- [ ] strategic decision

Docs updated in this PR:
- `docs/blueprint/PHASE_32B_PR3_ALERT_ENGINE.md` — §6b new + §6 table + header status + §8 references
- `docs/IMPLEMENTATION_PLAN.md` — Phase 0 chunk note split + §0b + Recently Completed (PR #748) + top header
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry
- (`docs/architecture/07_API_STANDARDS.md` NOT touched — the new admin endpoint follows the existing admin-route convention; no new API standard introduced. No schema change → no `03_DATA_MODEL.md` / migration. No new design primitive → no `06_UI_UX_FOUNDATION.md` (the admin UI reuses `AdminCard`/`AdminButton`/`AdminBadge`).)

### Destructive write checklist (CLAUDE.md §12.11)

Operations in this PR that touch existing rows (all inside `runPortalAlertSweep`, **moved verbatim from #9a's cron route — behaviour unchanged**):
- `lib/portal/alerts/sweepRunner.ts` — `prisma.clientAlert.update(...)` (refresh an existing ACTIVE/DISMISSED-but-recomputed alert row for *this* `organizationClientId`+`triggerKind`)
- `lib/portal/alerts/sweepRunner.ts` — `prisma.clientAlert.updateMany({ where: { organizationClientId: <this client>, status: { in: ['ACTIVE','DISMISSED'] }, triggerKind: { notIn: <still-computed> } }, data: { status: 'RESOLVED', resolvedAt } })` — and the `enabledTriggers.length === 0` variant (`updateMany` over the same single-client scope)
- `lib/portal/alerts/sweepRunner.ts` — `prisma.clientSnapshotMarker.upsert({ where: { organizationClientId: <this client> }, ... })`

For each:
1. **`where` clause matches:** only rows for the single `organizationClient` currently being processed (and, for the `clientAlert.update`, the exact `triggerKind`). No cross-client scope.
2. **Columns overwritten / rows deleted:** `clientAlert` — `severity`/`headline`/`body`/`context`/`primaryActionLabel`/`payload`/`status`/`resolvedAt`/`detectedAt`, all engine-derived aggregate fields the sweep itself authored (no user-entered data; CDR §13.3 — payload is aggregates only). `clientSnapshotMarker` — `lastHealthScore`/`lastTrailStage`/`lastSweptAt`, sweep-authored. No `delete`/`deleteMany`.
3. **Guard ensuring this only mutates rows I created:** these tables (`client_alerts`, `client_snapshot_markers`) are written *exclusively* by the sweep — there is no other writer. The `where` is the synthetic key the sweep created the row with (`organizationClientId` + `triggerKind`). This is the same structural argument signed off for #9a (PR #745). The dry-run path writes nothing at all.

User confirmation: NOT REQUIRED — this PR adds no new destructive write; it relocates #9a's (already-reviewed) sweep writes into a shared function, and adds a dry-run-default front door to invoke them.

### Build Status
- [⚠] Local `tsc --noEmit` is a no-op in this sandbox (no `node_modules`). Code reviewed against existing patterns: `verifyAdminGCPAuth` + `ADMIN_ERROR_CODES` + `authResult.context.role !== 'SUPER_ADMIN'` matches `/api/admin/run-seed/route.ts`; `safeAdminFetch(url, { method, body })` matches the `/admin/scheduler` page's existing `handleAction`; `AdminCard`/`AdminCardHeader`/`AdminButton`/`AdminBadge` match their existing usages on that page; `createAuditLog({ userId, action: 'UPDATE', status, entityType, metadata })` matches `/api/admin/gcp/scheduler/route.ts`; `import prisma from '@/lib/db'` (default) matches the original cron route; `runPortalAlertSweep`'s body is the cron route's body verbatim (no logic change). The Vercel preview build is the canonical type check.

### PR
- Branch: `claude/phase-32b-pr3-post9b-polish-MG8mr`
- Status: pending push + open

---

## Session: claude/phase-32b-pr3-post9b-real-kpis-MG8mr (Phase 32B PR3 — post-#9b polish, part 2: hero KPI strip + client book on real data)

### Changes Made
- **Type:** Feature + small schema change. Phase 32B PR3 post-#9b polish item ② — the autonomous-queue "continue" item.
- **Scope:** Make the Practice dashboard show **either** the org's real book **or** the `LIGHTHOUSE` demo preview — never a half-and-half. After #9b the alert *stream* read real data but the hero KPI *strip* (active clients / need-attention / TRAIL advanced / avg health) was still on the fixture, so the dashboard was half-real / half-demo. This PR adds the aggregate endpoint + the master switch + the schema needed for the "change since last sweep" delta.
- **Motivation:** A half-real / half-demo dashboard erodes adviser trust the moment they notice. The fix: a single `hasRealClients` switch — true once the alert sweep (cron or the PR #749 admin button) has computed a health score for ≥1 active client — that flips the *whole* dashboard from preview → real.

### Files Created
- `app/api/portal/clients/route.ts` (~165 LOC) — `GET ?organizationId=…`, `withPermission('org.read', …)` + inline active-`OrganizationMember` check (mirrors `/api/portal/alerts`). Returns `{ hasRealClients, lastSweptAt, kpis: { activeClients, needsAttention, trailAdvancedThisWeek, averageHealth, averageHealthDelta }, clients: [{ id, name, initials, trailStage, healthScore, healthDelta, activeAlertCount }] }`. Built from `prisma.organizationClient.findMany({ where: { organizationId, status: 'ACTIVE' }, select: { id, userId, alertMarker } })` + `prisma.clientAlert.findMany({ where: { organizationClientId: { in }, status: 'ACTIVE' } })` (bucketed in JS for `activeAlertCount` per client, `needsAttention` = distinct clients with a `critical|opportunity` alert, `trailAdvancedThisWeek` = count of `TRAIL_ADVANCED` alerts in the last 7 days) + `prisma.user.findMany` for display names (no `user` relation on `OrganizationClient`). `averageHealth` = mean of `marker.lastHealthScore`; `averageHealthDelta` = mean of `(lastHealthScore − previousHealthScore)` over clients that have both. `hasRealClients = (≥1 active client has a marker with a non-null `lastHealthScore`)`. `id` = `organizationClientId` so it joins cleanly with `/api/portal/alerts`. **No live `getMasterFinancialSnapshot()` per client** — purely the rows the sweep already maintains. Privacy (§13.3): aggregate scalars (0–100 health score, TRAIL-stage letter→label, alert count) + display name/initials only — no balances, no CDR data.
- `prisma/migrations/20260514100000_phase_32b_pr3_marker_prev/migration.sql` — `ALTER TABLE "client_snapshot_markers" ADD COLUMN "previousHealthScore" INTEGER; ADD COLUMN "previousTrailStage" TEXT;` (additive — nullable, no backfill; §12.11 destructive-write checklist N/A).

### Files Modified
- `prisma/schema.prisma` — `ClientSnapshotMarker` gains `previousHealthScore Int?` + `previousTrailStage String?` (with a doc-comment explaining the roll-forward).
- `lib/portal/alerts/sweepRunner.ts` — the marker upsert's `update` branch now sets `previousHealthScore: client.alertMarker?.lastHealthScore ?? null, previousTrailStage: client.alertMarker?.lastTrailStage ?? null` *before* writing the new `last*` values (roll-forward: `previous := last`, then `last := current`). The `create` branch leaves `previous*` defaulting to null. Header doc-comment updated. (No other behaviour change — still byte-for-byte the #9a sweep otherwise.)
- `app/portal/dashboard/page.tsx` — fetches `GET /api/portal/clients` + `GET /api/portal/alerts` on mount (both kept fresh on dismiss). `usingRealData = clientSummary?.hasRealClients === true` is the master switch: when real → hero KPIs from `clientSummary.kpis`; the alert stream shows the real ACTIVE alerts (even if empty → genuine "all quiet" empty state, not the demo); the per-client summaries for the stream come from `clientSummary.clients` (falls back to the `/api/portal/alerts` `clients` array on a race); the fixture `PracticeClientBookTable` (which has the demo's financial columns — net worth / cashflow / LVR) is **replaced** by a slim card ("Your client book — N active · M need attention · last refreshed … → Open the full client book" → `/portal/clients`). When not real → everything is the `LIGHTHOUSE` fixture preview, byte-for-byte the #9b behaviour. The `Avg client health` KPI cell's sub flips "vs 30d" → "vs last sweep" in real mode, shows "stable" (neutral tone) when the delta is 0 (e.g. before the second sweep). `usingRealAlerts` renamed `usingRealData`, `realClients` renamed `realAlertClients`; new `clientSummary` state + `refetchClientSummary` callback + a few inline interfaces (`RealKpis`/`RealClientSummary`/`ClientSummaryResponse`).
- `docs/blueprint/PHASE_32B_PR3_ALERT_ENGINE.md` — §6b "part 2" added (the marker schema change, the `GET /api/portal/clients` endpoint, the dashboard real-vs-preview master switch, the "part 3" follow-up note); §6 table row "computeKpis real input" flipped 📋→✅; header status line updated (① ✅ PR #749, ② ✅, ③ 📋); §8 references add `app/api/portal/clients/route.ts` + the migration.
- `docs/architecture/03_DATA_MODEL.md` §9.3 — `client_snapshot_markers` row gains the `previous*` columns + the roll-forward description + the migration name; a new paragraph documents `GET /api/portal/clients` (aggregate-only, the master switch, the privacy posture); the sweep-paragraph notes the admin-manual path shares `runPortalAlertSweep`.
- `docs/architecture/07_API_STANDARDS.md` §15 — new sub-section "Org-scoped *aggregate* portal endpoints (`?organizationId=`)" — explains that `/api/portal/alerts` + `/api/portal/clients` use `withPermission('org.read')` + a membership check (NOT `verifyAdviserClientAccess`, which gates a single client's *data* on per-client GRANTED consent), because they return aggregates already produced under the consent gate, with no balances/CDR data; reviewer rule appended.
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — Phase 32B PR3 row gains the post-#9b-polish summary (parts 1 & 2 ✅, part 3 queued).
- `docs/IMPLEMENTATION_PLAN.md` — the "Real alert engine v1" chunk's post-#9b note updated (① ✅ PR #749, ② ✅ this PR, ③ 📋 queued); §0b replaced (PR #749 → Recently Completed) with this active-workstream entry; PR #749 added to ✅ Recently Completed; top header refreshed.
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern (the slim client-book card is plain Tailwind matching the surrounding aesthetic — no new design primitive / token / shared component)
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture (no posture change — the new endpoint returns aggregates already produced under the existing consent gate; documented in `03_DATA_MODEL.md` + `07_API_STANDARDS.md` for clarity, not because the posture moved)
- [x] operational procedure — no; **data model change** (the `client_snapshot_markers` columns) + **API contract** (new `GET /api/portal/clients`) — see below
- [ ] strategic decision

Docs updated in this PR (data-model + API-contract changes per CLAUDE.md §3.1):
- `prisma/schema.prisma` + `prisma/migrations/20260514100000_phase_32b_pr3_marker_prev/migration.sql` (§12.12 — matching migration in the same PR)
- `docs/architecture/03_DATA_MODEL.md` §9.3 — the marker columns + the new endpoint
- `docs/architecture/07_API_STANDARDS.md` §15 — the org-scoped aggregate-endpoint pattern
- `docs/blueprint/PHASE_32B_PR3_ALERT_ENGINE.md` §6b part 2 — the feature
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — phase status row
- `docs/IMPLEMENTATION_PLAN.md` — chunk note + §0b + Recently Completed + top header
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)

Migration: `20260514100000_phase_32b_pr3_marker_prev/migration.sql` — `ALTER TABLE ... ADD COLUMN ... INTEGER` ×2 (nullable, no default-backfill, no `DROP`/`ALTER ... DROP`/`TRUNCATE`). Purely additive → §12.11 N/A.

Prisma writes touched in this PR:
- `lib/portal/alerts/sweepRunner.ts` — the existing `prisma.clientSnapshotMarker.upsert({ where: { organizationClientId: <this client> }, ... })` now also writes the two new `previous*` columns on the `update` branch. Same `where` scope as before (the single marker row for the client being processed); the new columns are sweep-authored aggregate scalars (no user-entered data); this table is written exclusively by the sweep. No new `delete`/`deleteMany`/`updateMany`. Same structural argument as #9a.
- `app/api/portal/clients/route.ts` — read-only (`findMany` ×3). No writes.

User confirmation: NOT REQUIRED — additive nullable columns + an extension of a sweep-owned upsert; no destructive write.

### Build Status
- [⚠] Local `tsc --noEmit` is a no-op in this sandbox (no `node_modules`; the Prisma client isn't regenerated, so the new `previous*` fields aren't visible to a local typecheck anyway). On Vercel: `vercel-build` runs `prisma migrate deploy` (applies `20260514100000_phase_32b_pr3_marker_prev` — preview against `monitrax-db-dev`, prod against `monitrax-db-prod`) → `prisma generate` (client now knows `previousHealthScore`/`previousTrailStage`) → `next build` (typechecks the code that references them) — so the ordering is correct. Code reviewed against existing patterns: `withPermission('org.read', async (request, auth) => {...})` + `prisma.organizationMember.findFirst({ where: { organizationId, userId, isActive: true } })` matches `/api/portal/alerts/route.ts`; `select: { id, userId, alertMarker }` on `OrganizationClient` matches the sweep route; `GlassHeroKpiCell tone="neutral"` is already used on `/portal/dashboard`; `PracticeAlertStream`'s `clients: AlertClientSummary[]` accepts the richer `RealClientSummary[]` (structural — has `id`/`name`/`initials`). The Vercel preview build is the canonical type + migration check.

### PR
- Branch: `claude/phase-32b-pr3-post9b-real-kpis-MG8mr`
- Status: pending push + open

---

## Session: claude/docs-cron-timezone-aest-MG8mr (Docs — align all Cloud Scheduler timezone references to Australia/Sydney)

### Changes Made
- **Type:** Documentation (doc-only — no code logic change; only JSDoc comments + Markdown docs touched).
- **Scope:** Reza created `monitrax-portal-alert-sweep` in GCP Cloud Scheduler (region `australia-southeast1`, schedule `0 4 * * *`, timezone `Australia/Sydney`) and confirmed (from the console screenshot) that the existing `monitrax-cdr-lifecycle` is also on `australia-southeast1` + `Australia/Sydney`. Reza directive 2026-05-12: *"update documents to fix all to AEST in future."* The docs + route-JSDocs said "02:00 / 03:00 / 04:00 UTC" for the cron schedules — corrected to `Australia/Sydney` throughout.
- **What changed:**
  - `docs/operational/runbooks/05_RETENTION_SCHEDULERS.md` — new canonical note: *"all Monitrax Cloud Scheduler jobs run in the `australia-southeast1` region with the `Australia/Sydney` timezone (AEST UTC+10 / AEDT UTC+11); every schedule in this file is Sydney local time"* + a 3-job table (`monitrax-cdr-lifecycle` 02:00 / `monitrax-conversation-retention-sweep` 03:00 / `monitrax-portal-alert-sweep` 04:00, all Sydney) + a "verify all three exist, create the conversation one if missing" note + `--time-zone="Australia/Sydney"` in both gcloud examples + `| Timezone | Australia/Sydney |` in the console-setup table. "02:00/03:00 UTC" → "02:00/03:00 Australia/Sydney" in the prose. `Last reviewed` → 2026-05-12.
  - `docs/operational/00_INDEX.md` — the Retention-Schedulers row's "daily 02:00 UTC / daily 03:00 UTC" → "Australia/Sydney".
  - `docs/operational/admin/03_GCP_SERVICE_OPERATIONS.md` — cron-table row "daily 02:00 UTC" → "Australia/Sydney".
  - `docs/operational/admin/05_CDR_COMPLIANCE_PROCEDURES.md` — "Job runs daily at 02:00 UTC" → "Australia/Sydney".
  - `docs/operational/calc-audit/cloud-scheduler-setup.md` — also fixed a self-contradiction: the gcloud example already used `--time-zone="Australia/Sydney"` but the schedule was `0 17 * * *` with a "= 03:00 AEST" rationale that only holds in UTC. Schedule → `0 3 * * *`; rationale rewritten + a "if an older instance used `0 17 * * * UTC`, run this `update`" note.
  - CDR compliance/policy docs — "daily 02:00 UTC" → "Australia/Sydney" in `docs/compliance/CDR_DATA_RETENTION_SCHEDULE.md`, `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md`, `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`, `docs/compliance/CDR_SYSTEM_ARCHITECTURE.md`, `docs/compliance/CDR_IMPLEMENTATION_PLAN.md`, `docs/compliance/CDR_SPREADSHEET_ANSWERS_AND_GAPS.md`, `docs/policy/MONITRAX_SECURITY_POLICIES.md`, `docs/help/compliance/data-retention-schedule.md`.
  - Phase docs — `docs/blueprint/PHASE_35_CDR_DATA_LIFECYCLE.md`, `docs/blueprint/PHASE_E_GCP_SERVICE_ENABLEMENT.md` (also dropped the now-wrong `/ 12:00 AEST` suffix + flipped `Timezone: UTC` → `Australia/Sydney`), `docs/blueprint/PHASE_32B_PR3_ALERT_ENGINE.md` (the `0 4 * * * UTC` mentions + the Cloud Scheduler config block — now `Region: australia-southeast1` / `timezone Australia/Sydney` / `Body: {}`).
  - Route JSDocs — `app/api/cdr/lifecycle/route.ts`, `app/api/conversations/retention-sweep/route.ts`, `app/api/portal/alerts/sweep/route.ts`, `lib/portal/alerts/sweepRunner.ts`, `app/api/admin/portal-alert-sweep/route.ts` — "02:00 / 03:00 / 04:00 UTC" → "Australia/Sydney" in the header comments.
  - `docs/IMPLEMENTATION_PLAN.md` — the forward-looking Reza-side "wire the `monitrax-portal-alert-sweep` job (`0 4 * * *` …)" instructions now say "in the `Australia/Sydney` timezone"; the `[x]` "Compliance bedrock" chunk's prose updated; top "Last updated" line + a Recently Completed bullet added (with the Reza-side flags below).
  - `docs/changelog/CHANGELOG_2026_05_09.md` — this entry.
- **Not changed (deliberately):**
  - Cloud SQL backup window (`04:00 UTC`, `database/02_BACKUP_AND_RESTORE.md`) + maintenance window (`Sunday 03:00 UTC`, `database/01_CLOUD_SQL_OPERATIONS.md`) — these are genuinely UTC (Cloud SQL config), not cron schedules.
  - Changelog files + the archived "Recently Completed" entries in `IMPLEMENTATION_PLAN.md` — historical records of what shipped at the time; not rewritten.

### Flagged to Reza in this PR (from the 2026-05-12 Cloud Scheduler console screenshot)
1. **`monitrax-cdr-lifecycle`'s last run FAILED** (12 May, 02:00:02). Diagnose via the job's **Logs** tab (it shows the HTTP status). Top suspects, in order: (a) the target URL has a `www.` prefix — `https://www.monitrax.com.au/api/cdr/lifecycle` — while the working pattern (and the new portal-alert-sweep job) uses the apex `https://monitrax.com.au/...`; a `www.`→apex redirect on a POST can fail. (b) the `Authorization: Bearer <CRON_SECRET>` header doesn't match the current Vercel `CRON_SECRET` (stale value, or a missing/extra `Bearer ` prefix → 401). (c) the endpoint itself errored (500) — check Vercel function logs for `/api/cdr/lifecycle` at the run timestamp.
2. **`monitrax-conversation-retention-sweep` was not visible in the jobs list** — verify it exists; if not, create it per `05_RETENTION_SCHEDULERS.md` §4 (the 7-yr conversation purge isn't enforced until it does).
3. **`CRON_SECRET` was pasted into chat** — rotate it (generate a new value, update `CRON_SECRET` in Vercel + redeploy, then update the `Authorization: Bearer …` header on all three Cloud Scheduler jobs).

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.) — no; the timezone change is to the Cloud Scheduler *jobs* (Reza-side), already done — this PR only aligns the *docs* to it
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (the canonical "all Cloud Scheduler jobs use australia-southeast1 + Australia/Sydney" statement + the 3-job table + the gcloud examples in `05_RETENTION_SCHEDULERS.md`; the calc-audit setup-doc self-contradiction fix)
- [ ] strategic decision — borderline; the timezone-standardisation is a Reza decision, captured here + in `05_RETENTION_SCHEDULERS.md`'s note + `IMPLEMENTATION_PLAN.md`'s header

Docs updated in this PR: see "What changed" above (the full list). No code logic, no schema, no migration, no new API contract, no new design primitive.

### Destructive write checklist (CLAUDE.md §12.11)
N/A — doc-only PR. No Prisma writes, no migration.

### Build Status
- [✓] Doc + JSDoc-comment-only changes. No `.ts`/`.tsx` *logic* changed; the only `.ts` edits are header-comment text in 5 route/lib files. No build surface.

### PR
- Branch: `claude/docs-cron-timezone-aest-MG8mr`
- Status: pending push + open

### Follow-up commit on this PR — `fix(build): exclude mobile-app/ from the Next.js typecheck`
The Vercel build for this PR (and `main`, and any other open PR) was failing in the "Linting and checking validity of types" step: `./mobile-app/app/(tabs)/_layout.tsx:1:22 Type error: Cannot find module 'expo-router'`. Cause: the `mobile-app/` Expo scaffold (added to `main` in `feat(mobile): add mobile companion app scaffold under mobile-app/` + the follow-up) has its **own** `tsconfig.json` (extends `expo/tsconfig.base`) and `package.json` (Expo deps), but the **root** `tsconfig.json`'s `"include": ["**/*.ts", "**/*.tsx", …]` was picking up the mobile-app `.tsx` files and `next build`'s typecheck choked on the un-installed `expo-router` types. Fix: add `"mobile-app"` to the root `tsconfig.json` `exclude` array — the Next.js app's typecheck now skips the mobile app entirely (the mobile app is typechecked via its own tsconfig + Expo's build pipeline). One line, no behaviour change. (This was a pre-existing break on `main` — not introduced by this PR — but it has to be fixed for this PR's preview to go green, so it ships here.)

---

## Session: claude/fix-basiq-connection-schema-drift-MG8mr (fix(db) — corrective migration for `basiq_connections` pre-migration schema drift)

### Changes Made
- **Type:** Database migration (bug fix — production schema drift).
- **Root cause:** The `monitrax-cdr-lifecycle` Cloud Scheduler job (`POST /api/cdr/lifecycle`) returned HTTP 500 on every run. Diagnosed live with Reza via `curl -i -X POST https://www.monitrax.com.au/api/cdr/lifecycle -H "Authorization: Bearer <CRON_SECRET>"` — the route's error body: `{"success":false,"error":{"code":"SERVER_ERROR","message":"Invalid \`prisma.basiqConnection.findMany()\` invocation: The column \`basiq_connections.consentExpiresAt\` does not exist in the current database."}}`. `BasiqConnection` in `prisma/schema.prisma` declares `consentExpiresAt DateTime?` + `consentScope String?` + `@@index([consentExpiresAt])` (the "Fix: G19" CDR-consent-tracking columns), but these were added during the pre-migration `prisma db push` era — there is **no migration file** that touches `basiq_connections` (`grep -rln basiq_connections prisma/migrations/` → nothing). So the dev DB got the columns via `db push`, the generated Prisma client expects them, but the production `basiq_connections` table never got them. `checkConsentExpiry()` does `prisma.basiqConnection.findMany()` with no `select` → `SELECT *` → references the non-existent column → 500.
- **Solution:** Fix-forward corrective migration — bring prod's table in line with `schema.prisma`. No `schema.prisma` change (it already declares the columns).

### Files Created
- `prisma/migrations/20260514130000_fix_basiq_connection_consent_columns/migration.sql`:
  ```sql
  ALTER TABLE "basiq_connections" ADD COLUMN IF NOT EXISTS "consentExpiresAt" TIMESTAMP(3);
  ALTER TABLE "basiq_connections" ADD COLUMN IF NOT EXISTS "consentScope" TEXT;
  CREATE INDEX IF NOT EXISTS "basiq_connections_consentExpiresAt_idx" ON "basiq_connections"("consentExpiresAt");
  ```
  `IF NOT EXISTS` makes it idempotent — on the dev DB (which already has these columns from the historical `db push`) it's a no-op; on prod it adds them. `vercel-build` runs `prisma migrate deploy` against `monitrax-db-dev` on the PR preview and against `monitrax-db-prod` on the `main` deploy, so the migration applies to prod the moment this merges. Purely additive (two nullable columns + a non-unique index) — CLAUDE.md §12.11 destructive-write checklist N/A by structural argument. The migration file's header comment is the canonical record of why it exists.

### Files Modified
- `docs/operational/database/04_PRISMA_MIGRATION_BASELINE.md` — new §12 "Residual pre-migration drift — fix forward, don't re-baseline": explains the drift class (schema column with no migration → dev has it via `db push`, prod doesn't, baseline doesn't notice, first `SELECT *` in prod crashes), records this `basiq_connections` instance + the corrective migration, and gives the `npx prisma migrate diff --from-url <prod-url> --to-schema-datamodel prisma/schema.prisma --script` command to find any remaining drift (review → wrap in `IF NOT EXISTS` → corrective migration; never apply directly via psql).
- `docs/IMPLEMENTATION_PLAN.md` — Tech Debt #18 added (audit prod schema vs `schema.prisma` for other pre-migration-era drift — recommended before the Basiq accreditation submission); a Recently Completed bullet; top "Last updated" line.
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry.

### Schema migration (CLAUDE.md §12.12)
This PR adds a migration but does **not** modify `prisma/schema.prisma` — the schema already declares `BasiqConnection.consentExpiresAt` / `consentScope` / the index; the migration just makes the production DB match. So §12.12's "every `schema.prisma` change needs a matching migration" is satisfied trivially (no schema change), and conversely this is a "schema-without-a-migration → add the missing migration" fix-up — exactly the corrective case §12.12 anticipates. Not `db push`, not `db execute`, not a direct psql `ALTER` — a proper migration folder that the deploy pipeline applies and `_prisma_migrations` records.

### Destructive write checklist (CLAUDE.md §12.11)
Migration is `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` ×2 (nullable, no default-backfill) + `CREATE INDEX IF NOT EXISTS ...` — no `DROP`, no `ALTER ... DROP`, no `TRUNCATE`, no `ADD COLUMN NOT NULL` without a backfilled default, no Prisma `update`/`delete`/`updateMany`/`deleteMany`/`$executeRaw`. Purely additive → §12.11 N/A. User confirmation: NOT REQUIRED.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture — borderline: the broken column was on a CDR table (`basiq_connections`) and the broken endpoint is the CDR consent-expiry sweep, but the *posture* doesn't change — this restores intended behaviour (the CDR data lifecycle cron can now actually run). Noted in `04_PRISMA_MIGRATION_BASELINE.md` §12 for clarity.
- [x] operational procedure — yes: `04_PRISMA_MIGRATION_BASELINE.md` §12 (new "residual pre-migration drift" section + the `prisma migrate diff` recipe); the migration file itself
- [ ] strategic decision

Other CLAUDE.md §3.1 considerations:
- **Schema migration** → `prisma/migrations/20260514130000_fix_basiq_connection_consent_columns/migration.sql` (§12.12). No `schema.prisma` change → no `03_DATA_MODEL.md` change needed (the data-model doc already describes `basiq_connections` per the schema, which the schema and now prod agree with). No Phase doc applies (this isn't a phase deliverable — it's a drift fix-up).

### Build Status
- [⚠] Local `tsc --noEmit` / `prisma generate` are no-ops in this sandbox (no `node_modules`; Prisma CLI version mismatch). The migration SQL is plain DDL with `IF NOT EXISTS` guards. On Vercel: `vercel-build` runs `prisma migrate deploy` (preview → `monitrax-db-dev` where the columns already exist → the `IF NOT EXISTS` makes it a no-op; prod → `monitrax-db-prod` → the columns get added) → `prisma generate` (client already matches the schema) → `next build`. The Vercel preview build is the canonical check that the migration applies cleanly.

### Verify (Reza, after this merges + deploys)
1. `curl -i -X POST https://www.monitrax.com.au/api/cdr/lifecycle -H "Authorization: Bearer <CRON_SECRET>"` → should now be `200 {"success":true,...}` (not the 500). If it's a *different* 500 message → another drifted table; paste it.
2. Re-run the `monitrax-cdr-lifecycle` Cloud Scheduler job (Force run) → should be 200.
3. Re-run `monitrax-portal-alert-sweep` (now pointed at `https://www.monitrax.com.au/...`) → should be 200.
4. (Recommended before the Basiq submission) run the `prisma migrate diff` command from `04_PRISMA_MIGRATION_BASELINE.md` §12 to catch any remaining drift.

### PR
- Branch: `claude/fix-basiq-connection-schema-drift-MG8mr`
- Status: pending push + open

---

## Session: claude/docs-ops-progress-tracking-MG8mr (Ops progress + tracking — doc-only)

### Changes Made
- **Type:** Documentation (progress/state tracking — no code, no schema, no infra wiring). Reza directive 2026-05-12: skip email-in activation for now; document all progress + the outstanding activities so we don't lose track.
- **Context:** PR #753 (the `basiq_connections` drift fix) merged → both Cloud Scheduler crons (`monitrax-cdr-lifecycle`, `monitrax-portal-alert-sweep`) now Force-run **200**. (Recap of the debugging session: the portal job's failure was HTTP 405 — it pointed at the apex `monitrax.com.au`, which 30x-redirects to `www.monitrax.com.au`, and Cloud Scheduler downgrades a POST to a GET across that redirect → the POST-only route returns 405 → fixed by switching the job's URL to `https://www.monitrax.com.au/...`. The CDR job's failure was HTTP 500 — `prisma.basiqConnection.findMany()` in `checkConsentExpiry()` referenced `basiq_connections.consentExpiresAt`, a column `schema.prisma` declares but prod's table never got (pre-migration `db push` drift) → fixed by PR #753's corrective migration. The `CRON_SECRET` was a red herring — it's configured in Vercel and matches; it just needs rotating because it got pasted into chat during the debugging.)

### Files Modified
- `docs/IMPLEMENTATION_PLAN.md`:
  - **New `📋 Reza-side operational checklist — current state` table** (21 rows) under the Phase 0 "Production Readiness" workstream — the GCP-console / Vercel / external activities that aren't in the code path, with a state column (✅ done / 🟡 in-progress / ⬜ not-started / ⏸ deferred / 🚧 blocked-on-external): Cloud Scheduler jobs ×3 (cdr ✅, portal ✅, conversation-retention ⬜), email-in activation ⏸, observability (A1+A9 confirm ⬜, Vercel log drain ⬜, synthetic monitor ⬜, A2–A8 + channels + dashboard ⬜), backup/restore drill ⬜, IRP tabletop ⬜, prod schema-drift audit ⬜ (Tech Debt #18), CRON_SECRET rotation ⬜, Gemini-key restriction ⬜, CMEK 🟡 / Cloud Armor ⬜ / SCC ⬜ (Reza Tier-1), pen test / cyber insurance / Stripe live-mode 🚧, Anthropic key ⏸, WIF Phase 11/12 🚧.
  - The "Email-in hardening" Phase 0 chunk updated — `⏸ Activation DEFERRED (Reza decision 2026-05-12)`: the hardening code (PR #747) is shipped & dormant; activate when a real client wants to reply by email; lists exactly what activation requires (SendGrid account + MX subdomain DNS + the env vars + the SendGrid destination URL with `?secret=…`); notes the outbound=Resend / inbound-parse-expects-SendGrid tension (Tech Debt #16).
  - Recently Completed bullet + top "Last updated" line.
- `docs/operational/runbooks/05_RETENTION_SCHEDULERS.md`:
  - The top status note rewritten — "all three exist" → a real status: `monitrax-cdr-lifecycle` ✅ + `monitrax-portal-alert-sweep` ✅ (both last Force-ran 200), `monitrax-conversation-retention-sweep` ⬜ **not yet created** (per §4; the 7-yr purge isn't enforced until it exists).
  - New "**Use the `www.` domain in the target URL**" note — the apex `monitrax.com.au` 30x-redirects to `www.monitrax.com.au` and Cloud Scheduler downgrades POST→GET across the redirect → HTTP 405 (which is exactly what bit the portal job). All target URLs in the file flipped `https://monitrax.com.au/api/...` → `https://www.monitrax.com.au/api/...` (the §3 + §4 gcloud examples + console-setup tables).
  - The §2 prereq row updated — "Production domain — `https://www.monitrax.com.au` resolving to Vercel ... `www.` is canonical; the apex redirects to it — always use the `www.` form in Cloud Scheduler target URLs".
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [x] operational procedure (`05_RETENTION_SCHEDULERS.md` — the Cloud Scheduler job status note + the `www.`-domain rule + all target URLs corrected; the new Reza-side operational checklist in `IMPLEMENTATION_PLAN.md`)
- [x] strategic decision (Reza decision 2026-05-12: defer email-in activation — recorded in the Phase 0 "Email-in hardening" chunk + the checklist)

Docs updated in this PR: `docs/IMPLEMENTATION_PLAN.md` (Reza-side checklist + Email-in chunk + Recently Completed + top header), `docs/operational/runbooks/05_RETENTION_SCHEDULERS.md` (status note + `www.` rule + URLs + prereq), `docs/changelog/CHANGELOG_2026_05_09.md` (this entry). No schema, no migration, no API contract, no design primitive, no code logic.

### Destructive write checklist (CLAUDE.md §12.11)
N/A — doc-only PR.

### Build Status
- [✓] Doc-only — no build surface.

### PR
- Branch: `claude/docs-ops-progress-tracking-MG8mr`
- Status: pending push + open

---

## Session: claude/admin-schema-drift-check-MG8mr (feat(admin) — GET /api/admin/schema-drift, server-side prod schema-drift audit)

### Changes Made
- **Type:** Feature (admin tooling) — a server-side runner for the "audit prod for more pre-migration drift" task (checklist row 11 / Tech Debt #18).
- **Why:** Reza asked Claude to "run the drift audit yourself". Claude can't reach `monitrax-db-prod` from the sandbox (no `node_modules`, Prisma CLI version mismatch, no prod credentials/network). So instead Claude built the tool: an endpoint that runs the audit server-side, where the Vercel function already has prod DB access via WIF — so Reza can run it with one click instead of setting up a local Prisma environment against prod. (We just fixed one such drift — `basiq_connections` missing `consentExpiresAt`/`consentScope` — there are likely more lurking; this surfaces them all at once.)

### Files Created
- `app/api/admin/schema-drift/route.ts` (~250 LOC) — `GET`, `verifyAdminGCPAuth` + `role === 'SUPER_ADMIN'` (mirrors `/api/admin/run-seed`). **Read-only** — runs only `SELECT`s against `information_schema.tables` / `information_schema.columns` / `pg_type`+`pg_enum` over the live WIF connection (`prisma.$queryRawUnsafe` with static SQL — no user input, no injection surface); applies nothing, touches no data. Reads `Prisma.dmmf.datamodel.{models,enums}` (the data-model meta-format baked into the generated client) for "what `schema.prisma` declares", then diffs:
  - `missingTables` — model `@@map` tables that don't exist in prod
  - `tablesWithMissingColumns` — per table: columns the DMMF declares that prod lacks, each with `prismaField` / `prismaType` / `isList` / `isRequired` + a `suggestedAddColumnSql` *hint* (e.g. `ALTER TABLE "basiq_connections" ADD COLUMN IF NOT EXISTS "consentExpiresAt" TIMESTAMP(3);` — a hint for writing the corrective migration, NOT something the endpoint applies)
  - `tablesWithExtraColumns` — columns in prod with no DMMF field (less urgent; usually means "add to the schema", not "drop from prod")
  - `missingEnums` / `enumsWithMissingValues` — enum types / enum values the DMMF declares that prod's enum types lack
  - `orphanTables` — prod tables that map to no model (`_prisma_migrations` is whitelisted)
  - `summary` with `hasDrift` + counts; `runBy`; a `note` explaining the scope (column/table/enum-value level — catches the `SELECT *`-crashes-on-a-missing-column class; does NOT check types/nullability/defaults/indexes — for that, the local `prisma migrate diff`)
  Returns no data — only schema metadata (table/column/enum names). CDR §13.3 N/A by structure. `Prisma.dmmf` not in the bundle ⇒ returns a clear `DMMF_UNAVAILABLE` 500 pointing at the local `prisma migrate diff` fallback (defensive — `Prisma.dmmf` should be present for Prisma 5.22's generated client). `maxDuration = 60`, `dynamic = 'force-dynamic'`.

### Files Modified
- `docs/operational/database/04_PRISMA_MIGRATION_BASELINE.md` §12 — "to find any remaining drift" now lists two ways: **(a)** `GET /api/admin/schema-drift` (SUPER_ADMIN, server-side, no local setup, column/table/enum-value level) + **(b)** the local `npx prisma migrate diff` (also checks types/nullability/indexes). "Either way the fix is the same" — review → if additive, corrective migration with `IF NOT EXISTS`; if `DROP`, §12.11 checklist first; never a direct `ALTER` on prod (§12.12).
- `docs/IMPLEMENTATION_PLAN.md` — checklist row 11 updated (the endpoint is now the "easiest" path); Tech Debt #18 updated; a Recently Completed bullet; top "Last updated" line.
- `docs/changelog/CHANGELOG_2026_05_09.md` — this entry.

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture — no posture change; the endpoint returns only schema metadata (no data, no CDR content), is SUPER_ADMIN-gated, and is read-only
- [x] operational procedure (a new server-side way to run the prod schema-drift audit — documented in `04_PRISMA_MIGRATION_BASELINE.md` §12 + the Reza-side checklist)
- [ ] strategic decision

Other §3.1 considerations: this is a new API route but it follows the existing admin-route convention (`verifyAdminGCPAuth` + `SUPER_ADMIN` check) — no new API *standard* introduced, so `07_API_STANDARDS.md` not touched. No schema change → no `03_DATA_MODEL.md` / migration. No new design primitive.

### Destructive write checklist (CLAUDE.md §12.11)
N/A — the endpoint runs only `SELECT`s. No Prisma `update`/`delete`/`updateMany`/`deleteMany`/`upsert`/`$executeRaw`, no migration.

### Build Status
- [⚠] Local `tsc --noEmit` / `prisma generate` are no-ops in this sandbox. Code reviewed against existing patterns: `verifyAdminGCPAuth` + `ADMIN_ERROR_CODES` + `authResult.context.role !== 'SUPER_ADMIN'` matches `/api/admin/run-seed/route.ts`; `import prisma from '@/lib/db'` (default) matches the cron/admin routes; `prisma.$queryRawUnsafe<T[]>('static sql')` is the standard read-only raw-query form. The one external assumption: `Prisma.dmmf` is available on the generated client at runtime — true for Prisma 5.x (it was restricted in 6+; project is on 5.22.0); guarded with a clear `DMMF_UNAVAILABLE` fallback if not. The Vercel preview build is the canonical type check.

### PR
- Branch: `claude/admin-schema-drift-check-MG8mr`
- Status: pending push + open
