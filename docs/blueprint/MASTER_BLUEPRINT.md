# MONITRAX MASTER BLUEPRINT v2.0

**The Authoritative Reference for Monitrax Architecture, Implementation & Roadmap**

---

**Version:** 2.7
**Last Updated:** 2026-04-12
**Status:** Active Development
**Owners:** ReNew (Newsha & Reza)
**Architect:** ChatGPT | **Engineer:** Claude

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Philosophy](#2-product-vision--philosophy)
3. [Technical Architecture](#3-technical-architecture)
4. [Phase Implementation Status](#4-phase-implementation-status)
5. [Core Modules & Capabilities](#5-core-modules--capabilities)
6. [Data Model Overview](#6-data-model-overview)
7. [API Standards & Patterns](#7-api-standards--patterns)
8. [Future Roadmap](#8-future-roadmap)
9. [Governance & Collaboration](#9-governance--collaboration)

---

## 1. Executive Summary

**Monitrax** is an AI-driven personal wealth orchestration platform that transforms complex financial data into automated advice, clarity, and action.

### What Monitrax Is

- A **portfolio management operating system** for everyday investors
- An **AI-powered personal financial guide** with accountant-level precision
- A **unified financial intelligence engine** connecting all aspects of personal wealth

### What Monitrax Manages

| Domain | Capabilities |
|--------|-------------|
| **Personal Finance** | Income, expenses, budgeting, cashflow |
| **Property Investing** | Purchase tracking, rental yield, depreciation |
| **Asset Management** | Vehicles, equipment, valuables, cost of ownership |
| **Loan Optimisation** | Debt strategies, offset accounts, refinancing |
| **Tax Planning** | ATO-compliant calculations, negative gearing, CGT |
| **Portfolio Strategy** | Investment tracking, performance analytics |
| **Wealth Forecasting** | Multi-year projections, risk analysis |

### Current State (April 2026)

- **26 Phases** defined in the blueprint
- **14 Phases** fully implemented (including Phase 25 Document Management Engine)
- **GCP Identity Platform** — sole identity provider (Firebase Auth, MFA, OAuth)
- **Active Development:** Phase 12 Twin-Track Onboarding — Tracks A/B/C/D shipped, R12 incident remediated 2026-04-15 (auto-migrate pipeline + destructive-write checklist); Phase 19 (Document Management UI); Phase 21 (Asset Management)
- **Platform hardening (2026-04-15):** `vercel-build` script now runs `prisma migrate deploy` before every Vercel build — schema drift between `prisma/schema.prisma` and the deployed DB is structurally impossible. Both Cloud SQL instances baselined with Prisma migration tracking. See `docs/changelog/CHANGELOG_2026_04_15.md` and `CLAUDE.md` §12.11/§12.12 for full details.
- **Platform:** Next.js 15, PostgreSQL, Prisma, Vercel, GCP Identity Platform

---

## 2. Product Vision & Philosophy

### Core Principles

1. **Everything is Interconnected** — No isolated modules; every entity relates to others
2. **Single Source of Truth** — Every dollar appears once only
3. **Zero Redundancy** — No duplicate data, no conflicting calculations
4. **AI-First Design** — Intelligence embedded at every layer
5. **Explainable Reasoning** — Users understand the "why" behind recommendations
6. **Regulator-Grade Accuracy** — ATO-compliant calculations
7. **Simplicity Over Complexity** — Sophisticated underneath, simple on the surface

### Target Users

- **Property Investors** — Managing multiple investment properties
- **Wealth Builders** — Optimising debt payoff and investment growth
- **Tax-Conscious Individuals** — Maximising deductions and planning CGT
- **Portfolio Managers** — Tracking diverse asset classes

### Ultimate Goal

> Build the world's first AI-driven wealth engine for everyday investors, with accountant-level precision and advisor-level intelligence.

### The TRAIL to Financial Freedom

> **Full specification: `docs/blueprint/TRAIL_FRAMEWORK.md`**

TRAIL is the core identity and user experience framework for Monitrax. Every feature, page, and recommendation aligns to a 5-stage financial journey:

```
T — Track        "Track your full picture"              → My Accounts
R — Reduce       "Reduce the waste, fix the leaks"      → My Budget
A — Anchor       "Anchor your safety net"               → Tracked via Health score + Guide
I — Invest       "Invest in your future"                → My Wealth
L — Live         "Live on your terms"                   → My Guide
```

**Evidence base:** Synthesised from Barefoot Investor (2M+ Australian readers), Dave Ramsey's Baby Steps (10M+ users), CFPB Financial Well-Being Framework, Maslow's Financial Hierarchy, Prochaska's Stages of Change, and Bandura's Self-Efficacy Theory.

**Sidebar (9 items):** Home, My Household, My Accounts [T], My Budget [R], My Safety Net [A], My Wealth [I], My Guide [L], Reports, Settings.

**Guide engine:** Integrates Barefoot Investor methodology with AI personalisation. Stage-matched recommendations adapt to the user's current TRAIL stage. Guidance, not gates — your Guide recommends the correct order but does not block access.

---

## 3. Technical Architecture

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React Server Components, TailwindCSS, Shadcn/UI |
| **Backend** | Next.js API Routes, Prisma ORM (with `@prisma/adapter-pg` driver adapter when WIF is enabled) |
| **Database** | PostgreSQL on **GCP Cloud SQL** (`australia-southeast1`, Sydney). Migrated off Render 2026-04-10. |
| **Authentication (app users)** | GCP Identity Platform / Firebase Auth (MFA, OAuth, Token Verification) |
| **Authentication (DB)** | **Workload Identity Federation + Cloud SQL Connector + IAM database authentication — ACTIVE in Production since 2026-05-01 (Phase 9 cutover complete)**. Per-request Vercel OIDC token (read from `x-vercel-oidc-token` header) → STS → impersonated SA access token → Cloud SQL Connector TLS tunnel → Postgres IAM auth using the SA token as per-connection password. No long-lived password in any runtime env var. Legacy `DATABASE_URL` path kept as a fallback for the 30-day stabilisation window (until Phase 11) and as the build-time path for `prisma migrate deploy`. |
| **Deployment** | **Vercel** (frontend + API + DB connection runtime). Render fully decommissioned 2026-04-10 — see `docs/migration/MIGRATION_RENDER_TO_GCP_STEPS.md`. |
| **File Storage** | Google Cloud Storage (primary), Database (fallback), Local Drive (optional) |

### Build & Deployment

> ⚠️ **CRITICAL SAFETY UPDATE (Feb 2026 → Apr 2026):** Build scripts must NEVER include `prisma db push`. Schema changes ship as `prisma migrate deploy` migration files generated locally — see CLAUDE.md §12.12 (Schema Change Deploy Protocol). Vercel runs `prisma migrate deploy` before every build; if it fails, the deploy is aborted and the previous version keeps serving.

| Aspect | Configuration |
|--------|---------------|
| **Build Command (Vercel)** | `prisma migrate deploy && prisma generate && next build` (the `vercel-build` script) |
| **Schema Sync** | **`prisma migrate deploy`** runs automatically on every Vercel build against Preview (`monitrax-db-dev`) and Production (`monitrax-db-prod`) DBs |
| **Migration Strategy** | All schema changes go through a `prisma/migrations/<name>/migration.sql` file generated locally with `prisma migrate dev` (CLAUDE.md §12.12) |
| **Runtime DB Auth** | **Workload Identity Federation** (`USE_CLOUD_SQL_CONNECTOR=true`) — see `lib/db.ts` and `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` §5.5 |
| **Health Check** | `/api/health` |

**⛔ NEVER ADD `prisma db push` TO BUILD SCRIPTS**

Schema changes must be applied manually:
1. Create database backup via Render Dashboard
2. Review changes: `npx prisma db push --preview-feature`
3. If DROP statements appear, STOP and verify
4. Run via Render Shell: `npx prisma db push`

**Why This Changed:** The database contains legacy tables not in the Prisma schema. Automatic `prisma db push` would delete these tables and their data. See incident documentation in `CHANGELOG_2026_02_03.md`.

See: `docs/blueprint/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` for full deployment documentation.

### Core Engines

| Engine | Purpose |
|--------|---------|
| **Tax Engine** | Australian ATO-compliant tax calculations |
| **Debt Planner Engine** | Loan payoff simulation, strategy comparison |
| **Investment Analytics Engine** | CAGR, IRR, TWR, Sharpe Ratio, Max Drawdown |
| **Depreciation Engine** | Div 40 & Div 43 calculations |
| **CGT Engine** | 5-element cost base, discount eligibility |
| **Portfolio Intelligence Engine** | Net worth, gearing, risk analysis |
| **Financial Health Engine** | Health scoring across categories |
| **Cashflow Optimisation Engine** | Forecasting, stress testing |
| **Transactional Intelligence Engine** | Category inference, recurring detection |
| **AI Strategy Engine** | Multi-horizon recommendations (powered by Google Gemini) |
| **Personal CFO Engine** | Unified intelligence orchestration |
| **Reporting Engine** | Multi-format export (CSV, Excel, JSON) |
| **Document Management Engine** | Rule-based upload orchestration, auto-categorization, storage selection |

### Data Standards

**GRDCS (Global Relational Data Consistency Specification)**

Every API response follows a standardised format:
- `entity` — Raw entity fields
- `linked` — Related entities with navigation hrefs
- `missing` — Incomplete data chains
- `_meta` — Linkage health and completeness scores

---

## 4. Phase Implementation Status

### Completed Phases

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|-----------------|
| **1** | Foundations | ✅ Complete | Schema/UI alignment, project setup |
| **2** | Schema & Engine Core | ✅ Complete | API fixes, business logic corrections |
| **3** | Financial Engines | ✅ Complete | Investment engine, depreciation, CGT foundations |
| **4** | Insights Engine v2 | ✅ Complete | Performance analytics, cost base tracking, yield analytics |
| **5** | Backend Integration | ✅ Complete | Portfolio unification, relational integrity layer |
| **6** | UI Core Components | ✅ Complete | Detail dialogs with tabs for all entities |
| **7** | Dashboard Rebuild | ✅ Complete | Portfolio Snapshot API, SVG charts, insights panel |
| **8** | Global Data Consistency | ✅ Complete | GRDCS, LinkedDataPanel, cross-module navigation |
| **9** | Global Nav & Health Insights | ✅ Complete | Navigation framework, health indicators |
| **10** | Auth & Security | ✅ Complete | MFA, passkeys, session management, audit logging. **Identity provider: GCP Identity Platform (Feb 2026 cutover — sole provider, no Monitrax JWTs for API auth)** |
| **11** | AI Strategy Engine | ✅ Complete | Recommendations, forecasting, conflict resolution |
| **12** | Financial Health Engine | ✅ Complete | Health scores, category scoring, risk modelling |
| **13** | Transactional Intelligence | ✅ Complete | Transaction records, category inference, Budget vs Actual tracking (Feb 2026) |
| **14** | Cashflow Optimisation | ✅ Complete | Forecasting, stress testing, optimisation |
| **16** | Reporting & Integrations | ✅ Complete | Report generators, CSV/Excel/JSON exporters |
| **17** | Personal CFO Engine | ✅ Complete | CFO Score, Risk Radar, Action Engine |
| **24** | Open Banking (Basiq) | ✅ Complete | Australian bank connection, account sync, transaction import |
| **25** | Document Management Engine | ✅ Complete | Rule-based upload orchestration, auto-categorization, cascade linking |
| **26** | Document Intelligence Engine | ✅ Complete | OCR extraction, Gemini AI analysis, form auto-fill |
| **27** | Gemini AI Migration | ✅ Complete | All AI features migrated from OpenAI to Google Gemini |
| **29** | Household Profile Redesign | ✅ Complete | Named members/pets, auto-category generation, onboarding integration |
| **32B** | B2B2C Practice Surface — Foundation | ✅ Complete (May 2026) | `Organization.profession` forced at registration; Practice design primitives (`PracticeGlassCard`, `PracticeKpiStrip`, `PracticeAlertStream`, `PracticeClientBookTable`, `PracticeHeader`); profession-aware config registry (adviser/broker/accountant); lighthouse demo dataset; portal sidebar repaint; anti-poaching guardrails (`team:invite` PORTAL_OWNER-only + `PORTAL_SEAT_INVITED` audit). PR #603. |
| **32B PR3** | Drill-in Canonical Client View | ✅ Complete (May 2026) | `viewerContext` parameter on `getMasterFinancialSnapshot()` with service-layer scope filtering (`LOANS / PROPERTIES / INVESTMENTS / TAX / FINANCIAL`); per-view audit dual-emit (`PRO_DASHBOARD_VIEW` + `ClientAccessLog`); `/portal/clients/[id]/view` with `ClientCanonicalDashboard` + `AdviserOverlay`; plan-tier gating via `withPortalFeatureGate(feature, handler)` reading canonical `PlanTier` (STUDIO/PRACTICE/ENTERPRISE) from `lib/portal/planTier.ts`. **PR3 #10 ✅** (PR #743) — profession-aware consent scope presets (`LENDING`/`TAX`/`ADVISORY`) in `InviteModal`. **PR3 #9 ✅** — Real Alert Engine: #9a (PR #745) — schema `ClientAlert` + `ClientSnapshotMarker` + `ClientAlertStatus`, pure engine `lib/portal/alerts/alertEngine.ts` (5 v1 triggers), cron sweep `POST /api/portal/alerts/sweep`; #9b — org-scoped `GET /api/portal/alerts` + `POST /api/portal/alerts/[id]/dismiss` + Practice dashboard wired (`/portal/dashboard` reads real alerts → `<PracticeAlertStream>` with dismiss; fixture as the empty-state preview). Cloud Scheduler (`monitrax-portal-alert-sweep`, `0 4 * * *`) is a Reza-side console step. **Post-#9b polish ✅** (PRs #749 + this PR): ① admin "run sweep now" — sweep core extracted to `lib/portal/alerts/sweepRunner.ts`, new SUPER_ADMIN `POST /api/admin/portal-alert-sweep` (audit-logged, dry-run) + a card on `/admin/scheduler`; ② hero KPI strip + client book on real data — `ClientSnapshotMarker` + `previousHealthScore`/`previousTrailStage` (migration `20260514100000_phase_32b_pr3_marker_prev`), new aggregate-only `GET /api/portal/clients?organizationId=…`, `/portal/dashboard` shows the real book once the sweep has run (else the fixture preview — never half-and-half). Until the Cloud Scheduler job is wired, run the sweep via `/admin/scheduler`. See `docs/blueprint/PHASE_32B_PR3_ALERT_ENGINE.md` §6b. **Phase 32B PR3 complete (#1–#10) + post-#9b polish (parts 1–2); part 3 (richer real-data client-book table) queued.** |
| **32C PR4a** | Professional Marketplace | ✅ Complete (May 2026) | New `ProfessionalListing` + `ProfessionalRating` models; `ListingStatus` lifecycle (DRAFT/PENDING_REVIEW/APPROVED/REJECTED/SUSPENDED); Org-side editor at `/portal/marketplace/listing`; Monitrax admin queue at `/admin/marketplace/listings(/[id])` with one-tap deeplinks to ASIC moneysmart / TPB public register / ABR; public browse at `/marketplace(/[slug])` with discipline + region + specialisation filters; lead-fee tiers stored per-listing (AU$80/$150/$250). |
| **32C PR4b** | Ask-a-Professional Picker | ✅ Complete (May 2026) | `<AskAProfessionalButton context variant>` primitive (3 variants); `<AskAProfessionalDialog />` picker with leaky-funnel guardrail server-side (org-attached users see ONLY their org's roster); context-biased ranking via `CONTEXT_BIAS` map; wired into AI Guide recommendation cards. |
| **32C PR4c** | Professional Request Lifecycle | ✅ Complete (May 2026) | New `ProfessionalRequest` model + `RequestStatus` (SUBMITTED/ACCEPTED/DECLINED/WITHDRAWN/EXPIRED) + `LeadFeeTier` enum; `<ComposeRequestDialog />` with context-aware AI starters; `/portal/requests(/[id])` adviser inbox + detail; `/dashboard/requests` user tracker; lead-fee tier resolved at submit-time from net-worth and FROZEN onto request; accept transaction creates `OrganizationClient` (INVITED + PENDING) + records `leadFeeChargedAt` billing intent. |
| **32C PR4d** | In-App Conversations + Email-Through-App | ✅ Complete (May 2026) | New `ProfessionalConversation` + `ConversationParticipant` + `ConversationMessage` models with 7-yr `retentionUntil` per AFSL compliance; auto-created on accept; SendGrid v3 outbound (zero-dep fetch with console-log fallback when `SENDGRID_API_KEY` unset); SendGrid Inbound Parse webhook with slug routing; `<ConversationThread />` (5s poll, optimistic-add, ⌘+Enter, channel badges); `/portal/conversations(/[id])` + `/dashboard/conversations(/[id])`. |
| **32C PR6** | Stripe Test-Mode Billing | ✅ Complete (May 2026) | New `StripeCustomer` + `StripeSubscription` + `StripeWebhookEvent` models; `BillingPlanTier` (STUDIO/PRACTICE/ENTERPRISE — new enum, no destructive rename of legacy `OrganizationPlan`); webhook signature-verified at the route boundary; lazy Stripe client (dev/demo works without keys); `/portal/billing` plan tiles + status pill + cancel/resume + lead-fee invoice history; PR6b adds `createLeadFeeInvoiceForRequest` hooked into PR4c `acceptRequest`. |
| **33a** | Help Center Static Site | ✅ Complete (May 2026) | `/help` audience index + `/help/<audience>/<slug>` article pages; Markdown-source CMS at `docs/help/<audience>/<topic>.md`; zero-dep frontmatter parser + markdown renderer (~260 LOC); 6 audience buckets. |
| **33b** | In-App Help Drawer | ✅ Complete (May 2026) | `<HelpDrawerButton>` (`?` affordance) + `<HelpDrawer>` (right-edge slide-in / bottom-sheet); typed `pathname → article` registry with longest-prefix-match; reuses canonical Markdown renderer. |
| **33c (light)** | Per-Article Save-as-PDF | ✅ Complete (May 2026) | Sibling `/print/help/<audience>/<slug>` route with A4-targeted print CSS + auto-`window.print()` on `document.fonts.ready`; ZIP bundle export deferred to PROD. |
| **33d** | Compliance Pack Articles | ✅ Complete (May 2026) | 5 regulator-facing articles (~1000-1700 words each): Data Retention Schedule, Incident Response Plan summary, Architecture Overview for Compliance Officers, ASIC RG 244/RG 36 boundary statement, Data Handling Policy summary. |
| **33g** | Adviser Feedback Inbox | ✅ Complete (May 2026) | `FeedbackThread` + `FeedbackMessage` models; `/portal/feedback` adviser-side master-detail; `/admin/feedback` Reza inbox with status filters + internal-notes audit + tag-for-AI export. |
| **41a** | LegalEntity Schema + Backfill | ✅ Complete (May 2026) | New `LegalEntity` model (uuid, type [PERSONAL_NAME/COMPANY/DISCRETIONARY_TRUST/UNIT_TRUST/SMSF/PARTNERSHIP/SOLE_TRADER], role [PERSONAL/HOLDING/OPERATING/INVESTMENT/SUPERANNUATION], `parentEntityId` self-FK for trustee→trust); `ownerEntityId` NOT NULL added to 7 owned-row tables (Property/Loan/Account/InvestmentAccount/Asset/Income/Expense) with backfill; TFN at-rest helper at `lib/security/tfnEncryption.ts`. |
| **41b** | Onboarding "How is Your Wealth Held?" | ✅ Complete (May 2026) | `EntitiesStep` in onboarding wizard; `/dashboard/entities` standalone management; AU validators (ABN modulus-89 / ACN ASIC checksum / TFN format); two-pass writer in bulk-create handles `parentEntityTempId` resolution. |
| **41c** | Interactive Entity Tree | ✅ Complete (May 2026) | `<EntityTree>` 3-row glass-tile visualisation (People → Entities → Owned objects); SVG Bézier connectors; dashed fuchsia paths for trustee→trust corporate hierarchy; role-coloured palette; mobile fallback stacks vertically. |
| **41d** | Money Flow Sankey | ✅ Complete (May 2026) | `lib/services/moneyFlowService.ts` (Income → Entity → Outflow 3-stage); `<MoneyFlowSankey>` rendered with `recharts <Sankey>` (zero new deps); proportional tax allocation flagged as v1 caveat (Phase 41e replaces with Div 6/6E correctness). |
| **41g** | Adviser Drill-In Entity Layer | ✅ Complete (May 2026) | `/portal/clients/[id]/view` extended with Structure/MoneyFlow/Dashboard tab toggle; entity tree is the default tab; new shared `lib/portal/adviserClientAccess.ts` extracts the consent + membership + role + assignment guard for all portal client-data endpoints. |

### In Progress

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| **12 (wizard)** | Onboarding Wizard Remediation | 🔄 In Progress | **PR 1 merged** (correctness sweep — 11 fixes + dead-code). **PR 2 merged** (draft persistence, resume banner, premium welcome modal redesign, strict show-once contract). **PR 3a merged** (full wizard visual overhaul). **PR 3b merged** (3-tier Accounts data source picker — Tier 1 Basiq / Tier 2 file import / Tier 3 manual — composing the existing Phase 13/18 `ImportWizard`). **PR 3c — 5/5 §6A.1 items shipped 2026-05-18**: data-source hygiene story end-to-end — PR 3c.1 chip + nudge (PR #791), PR 3c.2a upgrade button (PR #793), PR 3c.2c write-site audit + `balanceWriteFields()` SSOT helper (PR #794), PR 3c.2d Settings > Data Health heat-map (PR #795), PR 3c.2b first-visit migration modal + new `UserPreference.dismissedBalanceUpgradeNudge` column + `/api/settings/balance-upgrade-nudge` endpoint (PR #796). Only §6A.1 item #3 (confidence indicators on derived metrics — touches `masterFinancialService` SSOT) remains. **Canonical BAU support runbook:** `docs/operational/runbooks/10_DATA_SOURCE_HYGIENE.md`. See `docs/blueprint/PHASE_12_ONBOARDING_TOUR.md` v2.4 and `docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md` §6A. |
| **19** | Document Management | 🔄 In Progress | Core infrastructure complete |
| **19.1** | DMS Expansion | 🔄 In Progress | Receipt upload for expenses complete (2025-12-01) |
| **21** | Asset Management Engine | 🔄 In Progress | Core features complete (2025-12-04), portfolio integration pending |
| **23** | Investment Capital Gains | 🔄 In Progress | Schema and API complete (2025-12-04), UI pending |
| **43** | Your Money Story (Personal P&L scoreboard) | ✅ Complete (PR [#737](https://github.com/resadegh/monitrax/pull/737), May 2026) | Stark-Naked-Numbers translation. 3-line scoreboard hero on `/dashboard` Home (**Earned → Kept → Free today**), TRAIL T → R → A, stage-rotated emphasis pinned to `TRAIL_STAGE_TONES` SSOT, 3-segment Money Story Bar (Tax · Spent · Saved). Zero new calc engines. See `docs/blueprint/PHASE_43_MONEY_STORY.md`. |
| **43.1** | Hidden Wealth Lens (Stark Naked follow-on #1) | ✅ Complete (PR [#738](https://github.com/resadegh/monitrax/pull/738), May 2026) | Andrew's *"balance sheet is where all the cash is hiding"* applied to `/dashboard/balances`. 3-bucket accessibility split: Liquid Today / Accessible / Locked Long-Term. Typography-led card, emerald → sky → slate palette, no red anywhere. See `docs/blueprint/PHASE_43_1_HIDDEN_WEALTH.md`. |
| **43.2** | Spending Pareto Lens (Stark Naked follow-on #2) | ✅ Complete (PR [#739](https://github.com/resadegh/monitrax/pull/739), May 2026) | Andrew's *"fire your worst 20% of customers"* inverted for personal finance: surfaces the *vital few* spending categories driving ~80% of monthly outgoings on `/dashboard/expenses`. Cognitive-ease win — collapses 30 lines into ~4 numbered focus items. Typography-led card, no red anywhere. See `docs/blueprint/PHASE_43_2_SPENDING_PARETO.md`. |
| **43.3** | Margin Trend Lens (Stark Naked follow-on #3) | ✅ Complete (PR [#740](https://github.com/resadegh/monitrax/pull/740), May 2026) | Andrew's Principle 2 — *"the direction of your GP margin matters more than the absolute"* — applied to `/dashboard/budget-analysis`. 6-month savings-rate sparkline (pure SVG, no chart library) + delta-from-last-month + sliding-window trend (3-vs-3 ±2pp). Trend palette: emerald (up) / amber (down — never red) / slate (flat). New thin endpoint `/api/dashboard/margin-trend` reads `unified_transactions` directly. See `docs/blueprint/PHASE_43_3_MARGIN_TREND.md`. |
| **43.4** | Tighter `enoughHistory` Gate (Stark Naked follow-on #4 — final) | ✅ Complete (PR [#741](https://github.com/resadegh/monitrax/pull/741), May 2026) | Closes the four Stark-Naked-Numbers follow-ons. Two-mode honest check on the Money Story Hero day-count gate: (a) ≥ 90-day UnifiedTransaction history, OR (b) ≥ 3 recurring `Expense` rows with ≥ 1 essential. Recognises both monitrax usage modes. See `docs/blueprint/PHASE_43_4_ENOUGH_HISTORY_GATE.md`. **Stark-Naked-Numbers translation stream complete: PRs #737 → #741.** |

### Planned Phases

| Phase | Name | Status | Scope |
|-------|------|--------|-------|
| **14.5** | Mobile Web UI | ✅ Complete | Responsive sidebar, touch targets, form dialogs (Nov-Dec 2025) |
| **15** | Mobile Companion App | 📐 Blueprint v2.0 Complete | React Native + Expo; 20-section spec; CDR-compliant; ~16 weeks to ship |
| **18** | Bank Transactions (Legacy) | ✅ Superseded | Replaced by Phase 24 (Basiq Open Banking) |
| **19B** | Cloud Storage Integration | 📋 Planned | Google Drive, OneDrive, iCloud |
| **20** | Australian Tax Intelligence Engine | 📋 Planned | Gross/net salary, auto-taxability, super tracking, AI tax optimizer |
| **22** | Marketing Site & Auth Shell | 📋 Planned | Landing page, sign-in experience, public marketing routes |
| **24B** | Basiq Advanced Integration | 📋 Planned (Pending BASIQ Approval) | Webhooks, scheduled sync, enrichment, account matching |
| **28** | Advanced Analytics | 📋 Planned | Enhanced reporting, visualization, export improvements |
| **32C PR5** | Monitrax Platform Admin (`/admin/orgs/*`) | 📋 Planned (post ~5 paying orgs) | Reza-side platform admin: KPIs (active seats / clients / MRR / marketplace participation / lead-fee revenue MTD), drill-in for plan changes + seat allocation overrides + billing adjustments + marketplace listing approval + audit trail. |
| **33e** | Training Programs | 📋 Planned | Org Onboarding 5-day + Adviser Certification 8 modules + Compliance Officer 1hr Briefing. |
| **33f** | DOCX Compliance Templates | 📋 Planned | Word-format starter templates: IRP, BCP, Data Handling, Staff Conduct, Client Engagement. |
| **34** | CDR Security Hardening | ✅ Complete | RBAC on 70+ routes, MFA enforcement, audit persistence, password hardening. PRs [#438](https://github.com/resadegh/monitrax/pull/438), [#440](https://github.com/resadegh/monitrax/pull/440) |
| **35** | CDR Data Lifecycle | ✅ Complete | Consent-driven CDR data deletion, de-identification, Cloud Scheduler endpoint |
| **36** | My Accounts UX Simplification | ✅ Complete (May 2026) | All sub-phases shipped. Phase 2a (PR #601) — inline `LoanDetailDialog` on Balances. Phase 2b/2d/2e (PR #742) — `?action=` handler, `/dashboard/accounts` + `/dashboard/loans` bare list pages retired (sub-routes `/dashboard/loans/[id]` + `/[id]/strategy` preserved), `routeMap.ts` flipped, `?id=` cross-module-nav handler, 7 source-side hrefs flipped. Phase 2c (this PR) — `Import` toolbar button on Balances opening `TransactionImportDialog` (`ImportWizard` + `TransactionReviewPanel` inside it), `?action=import` deep link, `AccountDetailDialog` import buttons now live. `/dashboard/balances` is the single canonical accounts surface. See `docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md`. |
| **41e** | Entity-Aware Tax Engine | ✅ Complete (May 2026) | Shipped across 18 sub-PRs (41e.−1 → 41e.17). Modules: Div 115 + Div 6 + capital loss netting (41e.1); SMSF contribution caps + Div 293/296/TBC (41e.2-3); Div 6E streaming (41e.4); s100A per TR 2022/4 + PCG 2022/2 (41e.5); Div 7A (41e.6); Div 152 SBC (41e.7); negative gearing aggregator (41e.8); PSI Part 2-42 (41e.9); FTE/IEE Sch 2F (41e.10); SMSF triumvirate s62/Pt 8/s67A (41e.11); all-state land tax + cross-state aggregator (41e.12-13 — NSW/VIC/QLD/SA/WA/TAS/ACT/NT); stamp duty + foreign surcharge (41e.14); trust + company loss rules Sch 2F + Div 165 (41e.15); GST/BAS (41e.16); MasterTaxPosition orchestrator (41e.17). Every rule cites primary AU authority (ITAA / SIS Act / ATO TR/TD/PCG). Authority map: `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md`. |
| **41f** | Personal Bookkeeping Integration | 🟡 In Progress (~10 days core + ~5 days for Express follow-up) | Personal Xero / MYOB / QuickBooks integration. Reuses Phase 32 portal `AccountingIntegration` model via scope discriminator (Option A — see `PHASE_41F_BOOKKEEPING_INTEGRATION.md` §4). 5 sub-PRs core: 41f.0 design ✅ PR #690 → 41f.1 schema migration ✅ PR #691 → 41f.2 Xero OAuth + connect surface ✅ PR #692 → 41f.3 snapshot import + Div 7A wiring ✅ PR #693 → 41f.4 trust-deed parser (NEXT — 4-step confirm-before-apply via Vision OCR + Gemini). **Critical positioning: Monitrax CONSUMES Xero data, never replaces it** (§1.1 scope boundary: storage + understanding only; §1.2 data-conflict strategy: Xero owns transactions, Monitrax owns wealth lens, provenance + UNCOMPUTED for ambiguous cases). Xero only at v1; MYOB + QuickBooks → v2. Bidirectional sync, transaction-level data, custom chart-of-accounts → PROD. |
| **41f.5** | Monitrax Express (lightweight bookkeeping for pre-Xero users) | 📋 Planned (~5 days, single PR) | Lightweight bookkeeping-lite tier for users with personal Pty Ltd / Sole Trader / Trust **but no Xero subscription yet**. See `PHASE_41F_5_MONITRAX_EXPRESS.md`. **Strategic answer to "can Monitrax replace Xero?"**: No — but it can serve as a feeder to the accountant's Xero. Composes existing infrastructure (Phases 1–19 income/expense + 41a entity-aware + 41d Money Flow + 26 receipt OCR) + new Books tab on entity detail + new "Export for accountant" CSV bundle (Xero-compatible). Scope explicitly excludes: GL, AR/AP, payroll, BAS prep, lodgment, bank reconciliation, multi-currency invoicing — all of which remain Xero / MYOB / accountant territory. The user never has to choose between Monitrax and Xero — they migrate naturally as their structure complexity grows. |
| **41E reform 2026-27** | Eight AU tax-law changes from the 12 May 2026 Budget | ✅ **Stage 1 COMPLETE (May 2026 — PRs #763 → #769)** | Absorbs the eight measures (negative gearing → new builds only; 50% CGT discount → indexation + 30% min rate; 30% min tax on discretionary-trust taxable income; foreign-resident CGT regime strengthened — exposure draft already published; loss refundability + carry-back + R&DTI; foreign-purchase ban extension; VC caps lifted; EV FBT phased transition; dynamic PAYG instalments). Follows Phase 41 §9 versioning protocol — Stage 1 ships all module skeletons (`divisions/cgtIndexation.ts` / `cgtMinimumRate.ts` / `trustMinimumTax.ts` / `foreignResidentCgt.ts` / `lossRefundability.ts`) returning `UC-*-PENDING-EXPOSURE-DRAFT` or `UC-*-PENDING-ROYAL-ASSENT`; per-measure `commencementVerified` flag in `taxYearConfig.ts` flips on Royal Assent (proven pattern from 41e.3 Div 296). Honours D-1, D-2, HR-1, HR-2, HR-3 by structure. AI advisor extension: new FACT_LOOKUP + SCENARIO_RUN tools (`getReformedTaxRegimeStatus`, `runReformedCgtScenario`, `runStructuringScenario`, `getTrustReformImpact`, `getEvFbtRegime`, `getCarryBackEligibility`) + versioned knowledge pack at `lib/ai/tax-advisor/knowledge/reform-2026-27.ts` with `status: 'announced' | 'exposure-draft' | 'bill' | 'assented'` per entry. Intersects with Phase 41f (Measure 3 needs `TrustDeedExtractedRules`). See `docs/blueprint/PHASE_41E_REFORM_2026_27.md` + `docs/architecture/AI_PROVIDER_STRATEGY.md` (sibling provider-strategy doc — keep Gemini default, pilot Claude on capacity-Q&A). |
| **41i.6** | Surface-Level Numerical Audit (the trustworthiness commitment) | 📋 Planned (~6 days, 3 sub-PRs) | **Extends HR-3** from "calc-engine drift" to "surface-rendering drift." See `PHASE_41I_6_SURFACE_AUDIT.md`. Reza brief 2026-05-07: *"continuously make sure all calculations and produced numbers in monitrax is accurate and trustworthy."* New `L4_SURFACE_AUDIT` enum on `CalcAuditFindingSource`. New `lib/calc-audit/surfaces/` registry with `SurfaceDescriptor` per user-facing tile (top 10 at v1). Three sub-PRs: 41i.6a registry + first 10 descriptors + enum migration; 41i.6b CI static-analysis pass (`npm run lint:financial-surfaces` rejects inline financial math at PR review time); 41i.6c runtime audit harness + `[Full scan]` button on `/admin/calc-audit` with NDJSON-streamed progress + `[L4_SURFACE_AUDIT]` filter chip. Reviewers reject any PR introducing a financial surface without a corresponding `SurfaceDescriptor` registration once 41i.6a ships. |
| **41h** | AI Tax Advisor (HR-1/HR-2/D-2) | ✅ Complete (May 2026) | Shipped across 8 sub-PRs (41h.0 → 41h.7). 10 canonical tools (6 FACT_LOOKUP + 4 SCENARIO_RUN) wrapping calc engines (`getContributionCapHeadroom`, `getLandTaxPosition`, `getEntityTaxPosition`, `getCgtExposure`, `getDiv7aRisk`, `getInHouseAssetRatio`, `runContributionScenario`, `runCgtScenario`, `runLandTaxScenario`, `runDiv7aRefinanceScenario`). Three structural enforcement layers: closed `ToolKind` registry (no `RECOMMENDATION` kind), Zod `RawAIResponseSchema`, runtime `ToolSession` validator. AI Policy Gateway with 5-status pipeline (`OK / BLOCKED_VALIDATION / BLOCKED_RECOMMENDATION / PROVIDER_ERROR / SCHEMA_INVALID`). User-facing surface at `/dashboard/cfo/ask` graduated to "My Guide" sidebar (TRAIL Stage 5 — Live). Ask-a-Pro routing wired to marketplace per AFSL/TPB/NCCP licensing scope. PRs [#677](https://github.com/resadegh/monitrax/pull/677) → [#688](https://github.com/resadegh/monitrax/pull/688). |
| **41i** | Calculation Audit System (HR-3) | ✅ Core complete (May 2026); 41i.6 surface-audit IN FLIGHT | Silent admin-side safety net for calc correctness; never user-facing per HR-3. Core shipped across 5 sub-PRs (41i.0+1 foundation+L1 → 41i.5 L2 anomaly). 36 calc engines under audit with 45 fixtures all green. L1 deterministic regression + L2 temporal anomaly (Cloud Scheduler-ready) + L3 persistent-findings foundation with full lifecycle (`OPEN` → `INVESTIGATING` → `FALSE_POSITIVE` / `FIX_REQUIRED` → `FIXED`). Slack + email alerting (severity ≥ HIGH). **41i.6 EXTENDS HR-3** (Reza brief 2026-05-07) from "calc-engine drift" to ALSO cover "surface-rendering drift" — see Phase 41i.6 row above. Per-user "Audit this user" deferred to **41i.3b** (per-engine user-data adapters × 36 engines — substantial workstream gated on first paying users / pre-Basiq submission). |

---

## 5. Core Modules & Capabilities

### 5.1 Properties Module

**Tracks:**
- Purchase details (price, date, stamp duty, legal fees)
- Renovation costs and capital improvements
- Operating costs and property management
- Depreciation schedules (Div 40 & Div 43)
- Rental income and expenses
- Current valuations and capital growth
- Links to loans, income, and expenses

### 5.2 Loans Module

**Tracks:**
- Loan structure (principal, interest rate, term)
- Variable vs fixed rate periods
- Interest-only periods
- Repayment frequency and minimum payments
- Linked offset accounts
- Extra repayment caps

**Calculations:**
- Monthly compounding
- IO loan simulation
- Strategy vs baseline payoff comparison
- Interest savings projections
- Loan repayments included in cashflow (2025-12-01 fix)

### 5.3 Accounts Module

**Types Supported:**
- Transactional accounts
- Savings accounts
- Offset accounts
- Credit facilities

**Features:**
- Loan-linked accounts
- Balance tracking
- Cashflow source/sink categorisation

**Open Banking Integration (Phase 24):**
- Connect Australian banks via Basiq
- Automatic account import from connected banks
- Real-time balance sync

**Advanced Open Banking (Phase 24B - Pending BASIQ Approval):**
- Webhook-driven real-time sync
- Scheduled background synchronisation
- BASIQ enrichment for transaction categorisation
- Intelligent account matching and merging
- Connection health monitoring and auto-recovery
- Transaction import to UnifiedTransaction
- Connection status tracking (ACTIVE, PENDING, RECONNECT, ERROR)

**Basiq-Specific Fields:**
- `basiqAccountId` - Links account to Basiq
- `basiqConnectionId` - Reference to bank connection
- `basiqLastSynced` - Last sync timestamp
- `accountNumber` - Masked account number
- `bsb` - BSB for AU banks

### 5.4 Income Module

**Types:**
- Salary
- Rental income
- Investment income (dividends, distributions)
- Other income

**Features:**
- Property-linked or general
- Investment account linking
- Frequency normalisation

**Budget vs Actual Tracking (Feb 2026):**
- Entry amount = Budget (user's planned amount)
- Actual = Calculated from linked transactions in real-time
- UI shows both Budget and Actual columns with variance %
- True monthly average calculation for advance payments (e.g., rent)

**Phase 20 Enhancements (Planned):**
- Gross/Net salary with automatic PAYG calculation
- Superannuation tracking (SG, salary sacrifice)
- Automatic taxability determination (removes manual toggle)
- Tax category assignment with ATO references

### 5.5 Expenses Module

**Tracks:**
- Category and vendor
- Frequency and amount
- Tax-deductibility
- Property/loan/investment linking
- Essential vs discretionary
- Receipt attachments (Phase 19.1)

**Budget vs Actual Tracking (Feb 2026):**
- Entry amount = Budget (user's planned amount)
- Actual = Calculated from linked transactions in real-time
- UI shows both Budget and Actual columns with variance %
- Transaction linking = tagging only (no amount auto-update)

**UI Features (2025-12-01):**
- Grouped view by category or property
- Expandable tiles with expense drill-down
- Individual tile view option
- Receipt upload during expense entry

### 5.6 Assets Module (Phase 21 - Planned)

**Status:** ✅ Core Features Implemented (2025-12-04)

**Asset Types:**
- Vehicles (cars, motorcycles, boats)
- Electronics (computers, phones)
- Furniture and equipment
- Collectibles (art, watches)

**Features (Implemented):**
- Purchase price and current value tracking
- Depreciation calculation with percentage display
- Expense linking for cost of ownership analysis (schema ready)
- Service and maintenance records (vehicles)
- Value history over time (auto-tracked on value changes)
- Total Cost of Ownership (TCO) calculations

**Vehicle-Specific:**
- Make, model, year, registration
- Odometer tracking
- Service history
- Cost per kilometre calculation
- Fuel type tracking

**API Endpoints:**
- `GET/POST /api/assets` - List and create assets
- `GET/PUT/DELETE /api/assets/:id` - Asset CRUD operations

**Pending:**
- Integration with Portfolio Snapshot for net worth
- Expense form integration for asset linking

See: `docs/blueprint/PHASE_21_ASSET_MANAGEMENT.md`

### 5.7 Investment Module

**Investment Accounts:**
- Brokerage, Super, Fund, Trust, ETF/Crypto
- Opening date and balance tracking (Phase 23)
- Cost basis method selection (FIFO, LIFO, HIFO, SPECIFIC, AVERAGE)

**Investment Holdings:**
- Shares, ETFs, Managed Funds, Crypto
- Cost base tracking (FIFO, LIFO, HIFO, SPECIFIC, AVG)
- Franking credit calculations
- Current price and unrealized gain tracking (Phase 23)
- Purchase lot (parcel) tracking for CGT (Phase 23)

**Investment Transactions:**
- Buy, Sell, Dividend, Distribution, DRP
- Deposit, Withdrawal, Transfer In/Out (Phase 23)
- Corporate Action support (Phase 23)

**Capital Gains Tax (Phase 23):**
- Purchase lot tracking for accurate cost basis
- CGT discount calculation (50% for assets held 12+ months)
- Financial year summaries for tax reporting
- CGT preview before executing sales

**Analytics:**
- CAGR, IRR, TWR
- Volatility, Sharpe Ratio
- Maximum Drawdown
- Unrealised gains

**API Endpoints (Phase 23):**
- `GET /api/investments/capital-gains` - CGT summary by financial year
- `POST /api/investments/capital-gains` - Preview CGT before selling

See: `docs/blueprint/PHASE_23_INVESTMENT_CAPITAL_GAINS.md`

### 5.7 Tax Engine (Australian)

**Implemented:**
- ATO 2024-25 tax brackets
- Medicare Levy calculations
- Taxable income computation
- Deductible expenses
- Negative gearing
- CGT with 50% discount

**Phase 20 Enhancements (Planned):**
- Full PAYG withholding calculator
- Medicare Levy Surcharge
- LITO/LMITO offsets
- Superannuation contribution tracking
- Automatic income taxability rules
- AI-powered tax optimization
- Scenario modelling ("what if" analysis)
- Tax position dashboard with refund estimation

See: `docs/blueprint/PHASE_20_AUSTRALIAN_TAX_INTELLIGENCE_ENGINE.md`

### 5.8 Personal CFO Engine

**CFO Score (0-100):**
- Cashflow Strength (25%)
- Debt Coverage (20%)
- Emergency Buffer (15%)
- Investment Diversification (15%)
- Spending Control (15%)
- Savings Rate (10%)

**Risk Radar:**
- 10+ risk types detected
- Short/medium/long-term horizons
- Severity levels (LOW/MODERATE/HIGH/CRITICAL)

**Action Engine:**
- Prioritised daily actions
- Four priority levels
- Deadline tracking

### 5.9 Document Management (Phase 19 & 25)

**Capabilities:**
- Document upload (drag-and-drop)
- 11 document categories
- Tag management
- Search and filtering
- PDF/image preview
- Signed URLs (5-minute expiry)
- Polymorphic entity linking
- Folder structure view (by category, FY, entity)

**Document Management Engine (Phase 25):**
- Centralized upload orchestration
- Rule-based storage provider selection
- Automatic document categorization
- Cascade entity linking (expense → property → loan)
- Intelligent path generation with Australian FY
- Priority-based rule matching

**Storage Providers:**
- Google Cloud Storage (production primary)
- Database/Monitrax (fallback)
- Local Drive (user's computer)

**Supported Formats:**
- PDF, DOC, DOCX, XLS, XLSX
- CSV, TXT
- JPEG, PNG, GIF, WEBP, HEIC

See: `docs/blueprint/PHASE_19_DOCUMENT_MANAGEMENT.md`
See: `docs/blueprint/PHASE_25_DOCUMENT_MANAGEMENT_ENGINE.md`

### 5.10 Household Module (Phase 29)

**Status:** ✅ Complete (February 2026)

**Purpose:** Captures detailed household composition for personalized financial tracking and category generation.

**Capabilities:**
- Named household members with relationships
- Pet tracking with types and breeds
- Auto-category generation based on household
- Migration prompt for existing users
- Integration with onboarding wizard

**Household Members:**
- Relationships: Self, Spouse, Partner, Child, Parent, Sibling, Other
- Income earner flag for salary/super category generation
- Date of birth for age-based planning

**Household Pets:**
- Types: Dog, Cat, Bird, Fish, Rabbit, Reptile, Other
- Breed tracking
- Auto-generates pet expense categories

**Auto-Generated Categories:**
- Income earners: Salary, Super Contributions, Work Expenses, Health Insurance
- Non-earner adults: Personal Spending, Health Expenses
- Children: School Fees, Childcare, Kids Activities
- Pets: Food & Supplies, Vet Visits, Insurance, Grooming

**Category Orphaning:**
- When members/pets are deleted, categories are unlinked (not deleted)
- Preserves expense history and allows reassignment

See: `docs/blueprint/CHANGELOG_2026_02_03.md` for implementation details.

---

## 6. Data Model Overview

### Core Entities

```
User
├── HouseholdProfile (Phase 29)
│   ├── HouseholdMembers
│   │   └── Categories (linked)
│   └── HouseholdPets
│       └── Categories (linked)
├── Properties
│   ├── Loans
│   ├── Income (rental)
│   ├── Expenses (operating)
│   ├── DepreciationSchedules
│   └── Documents
├── Accounts
│   └── Linked Loans (offset)
├── InvestmentAccounts
│   ├── Holdings
│   │   └── Transactions
│   ├── Income (dividends)
│   └── Expenses (fees)
├── Assets (Phase 21)
│   ├── Expenses (linked)
│   ├── AssetValueHistory
│   ├── AssetServiceRecords
│   └── Documents
├── Income (general)
├── Expenses (general)
├── Categories
│   └── HouseholdMember/Pet (optional link)
├── DebtPlans
│   └── DebtPlanLoans
├── Documents
│   └── DocumentLinks
└── CFOScoreHistory
```

### Key Relationships

| Entity | Links To |
|--------|----------|
| HouseholdProfile | HouseholdMembers, HouseholdPets |
| HouseholdMember | Categories (auto-generated) |
| HouseholdPet | Categories (auto-generated) |
| Category | HouseholdMember (optional), HouseholdPet (optional) |
| Property | Loans, Income, Expenses, Depreciation, Documents |
| Loan | Property, Offset Account, Expenses |
| Account | Linked Loan |
| InvestmentAccount | Holdings, Transactions, Income, Expenses |
| InvestmentHolding | Transactions |
| Asset | Expenses, ValueHistory, ServiceRecords, Documents |
| Document | Any entity via DocumentLink |

---

## 7. API Standards & Patterns

### Authentication (GCP Identity Platform)

All API routes require Bearer token authentication using **GCP/Firebase ID tokens**.
GCP Identity Platform is the sole identity provider — no Monitrax JWTs are issued for API authentication.

```typescript
// API routes use one of three entry points:
// 1. verifyToken() — verifies GCP token, returns { userId, email }
const token = request.headers.get('Authorization')?.replace('Bearer ', '');
const user = await verifyToken(token);

// 2. getAuthContext() — verifies GCP token, returns full AuthContext with role
const context = await getAuthContext(request);

// 3. withAuth() — middleware wrapper, verifies GCP token + auto-syncs user
return withAuth(request, handler);
```

**Auth entry points** (all verify GCP/Firebase ID tokens):
| Function | Location | Returns |
|----------|----------|---------|
| `verifyToken()` | `lib/auth.ts` | `{ userId, email }` |
| `getCurrentUser()` | `lib/auth.ts` | `{ id, email }` |
| `getAuthContext()` | `lib/auth/context.ts` | `{ userId, email, role, name, tenantId }` |
| `withAuth()` | `lib/middleware.ts` | Middleware wrapper |

**Client-side**: Firebase SDK (`onIdTokenChanged`) manages token lifecycle. Tokens auto-refresh every hour. All fetch calls MUST include `Authorization: Bearer ${token}` using `useAuth()` hook.

**Inactivity timeout**: 30-minute idle auto-logout with 2-minute warning dialog (`IdleTimeoutGuard` component, mounted globally in `app/layout.tsx`). Tracks mouse, keyboard, touch, scroll, and click events.

**Custom domain branding**: Set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` env var to your domain (e.g., `monitrax.com.au`) so Google sign-in popup shows your brand instead of `{projectId}.firebaseapp.com`. Requires Next.js rewrites in `next.config.ts` to proxy `/__/auth/*` and `/__/firebase/*` to Firebase, plus a local `/api/firebase-init` route to serve `/__/firebase/init.json` (Firebase Hosting may not be deployed). The middleware matcher must exclude `__/` paths so CSP headers are not applied to the proxied auth handler.

### Response Format (GRDCS)

```json
{
  "entity": { /* raw entity fields */ },
  "linked": [
    {
      "id": "...",
      "type": "loan",
      "name": "Home Loan",
      "primaryValue": 450000,
      "href": "/dashboard/loans/[id]"
    }
  ],
  "missing": [
    {
      "type": "income",
      "reason": "No rental income linked"
    }
  ],
  "_meta": {
    "linkageScore": 85,
    "completeness": 0.9
  }
}
```

### Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/portfolio/snapshot` | Unified wealth summary |
| `GET /api/cfo` | Personal CFO dashboard data |
| `GET /api/reports` | Generate exportable reports |
| `GET /api/documents` | List documents |
| `POST /api/documents` | Upload document |
| `GET /api/debug/intelligence` | Full portfolio intelligence |

---

## 8. Future Roadmap

### Near-Term (Q4 2025)

| Priority | Feature | Phase |
|----------|---------|-------|
| High | Document entity tab integration | 19 |
| High | Google Drive integration | 19B |
| Medium | Bank transaction sync | 18 |
| Medium | Mobile-optimised UI | 14.5 |

### Mid-Term (Q1 2026)

| Priority | Feature |
|----------|---------|
| High | Native mobile app (Phase 15 — Blueprint v2.0 complete, ready for implementation) |
| Medium | Accountant/advisor portal |
| Medium | Multi-user portfolio sharing |

### Long-Term Vision

| Feature | Description |
|---------|-------------|
| **AI Expense Optimisation** | Compare bills to market, suggest savings |
| **Monte Carlo Forecasting** | Probability-based wealth projections |
| **Retirement Modelling** | Super optimisation, drawdown planning |
| **Property Sale Advisor** | "Should I sell?" analysis |
| **Refinance Timing** | Optimal refinance recommendations |

---

## 9. Governance & Collaboration

### Roles

| Role | Responsibility |
|------|----------------|
| **ChatGPT** | System architecture, product design, financial strategy |
| **Claude** | Implementation, code execution, technical delivery |
| **User** | Vision, decision-making, feature approval |

### Development Rules

1. **Blueprint is authoritative** — All changes must align with phase specifications
2. **No schema changes** without explicit instruction
3. **Small, atomic commits** — Reversible patches
4. **Security first** — Never compromise auth or data access
5. **Test before deploy** — TypeScript check must pass

### Documentation Updates

When implementing new features:
1. Update `IMPLEMENTATION_CHANGELOG.md` with changes
2. Mark phase status in this master blueprint
3. Update Prisma schema notes if fields change

---

## Appendix: Quick Reference

### File Locations

| Purpose | Path |
|---------|------|
| Prisma Schema | `prisma/schema.prisma` |
| API Routes | `app/api/` |
| Dashboard Pages | `app/dashboard/` |
| Shared Components | `components/` |
| Business Logic | `lib/` |
| Blueprint Docs | `docs/blueprint/` |

### Common Imports

```typescript
// Authentication — server-side GCP/Firebase token verification (async)
import { verifyToken } from '@/lib/auth';
// Or use the full auth context (includes role, tenantId):
import { getAuthContext } from '@/lib/auth/context';
// Or use the middleware wrapper:
import { withAuth } from '@/lib/middleware';

// Authentication — client-side (React hook for Firebase ID token)
// In components: const { token, user, logout } = useAuth();
// All fetch calls MUST include: headers: { Authorization: `Bearer ${token}` }
import { useAuth } from '@/lib/context/AuthContext';

// Database
import { prisma } from '@/lib/db';

// CFO Engine
import { getCFODashboardData } from '@/lib/cfo';

// Documents
import { DocumentCategory, LinkedEntityType } from '@/lib/documents/types';
```

### UUID Generation

Use `crypto.randomUUID()` instead of the `uuid` package to avoid TypeScript type declaration issues.

---

**END OF MASTER BLUEPRINT v2.0**

*This document is the single source of truth for Monitrax architecture and implementation status.*
