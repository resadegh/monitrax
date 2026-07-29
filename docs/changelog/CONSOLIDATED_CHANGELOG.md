# Monitrax Consolidated Changelog

**Status:** ACTIVE | **Owner:** Dev Lead | **Review Date:** 2026-07-10

> This is the single authoritative changelog for Monitrax. Individual session changelogs have been archived to `docs/archive/changelogs/`.

---

## April 2026

### 2026-04-12 — Onboarding Wizard PR 3b: Structural Additions (renter path, non-property loans, super routing, 3-tier Accounts, lifestyle fields)
- **Type:** feat/refactor | **Scope:** Onboarding wizard — Welcome, Household, new Debts step, new Super step, Accounts 3-tier picker, new Basiq callback route, bulk-create API
- Fourth PR in the Phase 12 pipeline. Closes the data-capture gaps identified in the original review. No schema changes — every new field maps to an existing Prisma column. Reuses existing Monitrax functionality (Phase 13/18 `components/bank/ImportWizard.tsx` for file import, Phase 24 `/api/basiq/connect` for Basiq flow).
- **Welcome step:** 3-option housing segmented control (`Own / Rent / Both`) drives the renter path — Properties step hidden when `housing='RENT'` via `getStepsForProfile` context. Multi-select debts checkbox (HECS / Car / Personal / Business) gates the new conditional Debts step.
- **New Debts step** captures `LoanType` = `CAR / STUDENT / PERSONAL / BUSINESS`. HECS/STUDENT special case: indexation default 4%, no `minRepayment` (income-contingent). CAR loans can link to a vehicle in Assets via `Loan.linkedAssetId` — resolved in a second bulk-create pass after Assets are written.
- **New Super step** creates real `SuperannuationAccount` rows with minimum-viable fields (`name`, `fundName`, `currentBalance`). Replaces the PR 3a mis-routing through `InvestmentAccount(type=SUPERS)`. Deeper fields deferred to Settings > Retirement.
- **Household step** adds a 4th "Your lifestyle" section with `lifestylePreference` / `diningOutFrequency` / `hobbiesWithCosts` for the Phase 28 budget AI.
- **Accounts step** — new three-tier data source picker: Tier 1 Basiq (recommended hero card), Tier 2 file import (composes existing `ImportWizard` in a dialog), Tier 3 manual (de-ranked fallback). `AccountInput.source` + `existingAccountId` track pre-existing DB rows. `bulk-create` skips writing BASIQ/IMPORT accounts.
- **New `/app/onboarding/basiq-callback`** page polls `GET /api/basiq/connections` every 1.5s for up to 30s after the Basiq redirect, then returns to `/onboarding?step=accounts&basiq=connected`. Timeout path shows a friendly "still syncing" message.
- **bulk-create** updated: skips BASIQ/IMPORT accounts (offset linking still works for imported rows), creates `SuperannuationAccount` rows, creates non-property `Loan` rows in two passes (second pass after Assets for CAR→Asset linking), writes lifestyle fields to `HouseholdProfile` conditionally (doesn't clobber Settings values on re-runs), HECS `minRepayment` forced to 0.
- **Key files:** `components/onboarding/wizard/types.ts`, `components/onboarding/wizard/WizardContainer.tsx`, `components/onboarding/wizard/steps/{Welcome,Household,Accounts}Step.tsx`, `components/onboarding/wizard/steps/{Debts,Super}Step.tsx` (new), `components/onboarding/wizard/steps/AccountsDataSourceTiles.tsx` (new), `app/onboarding/basiq-callback/page.tsx` (new), `app/api/onboarding/bulk-create/route.ts`
- **Docs:** `docs/changelog/CHANGELOG_2026_04_12_WIZARD_STRUCTURAL_ADDITIONS.md`, `docs/blueprint/PHASE_12_ONBOARDING_TOUR.md` v2.4 (new §17), `docs/blueprint/MASTER_BLUEPRINT.md` v2.7, `docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md`

### 2026-04-12 — Onboarding Wizard PR 3a: Full Wizard Visual Overhaul + Simplification + /app/onboarding Route
- **Type:** feat/design/refactor | **Scope:** Onboarding wizard (all 8 step files, shell, new route, primitives library, design tokens)
- Third of three PRs in the Phase 12 remediation pipeline. Visual-only — no data changes, no schema changes, no new capture paths. Structural additions (renter path, non-property loans, super routing, Basiq shortcut, lifestyle fields) ship in PR 3b. Data source hygiene (staleness indicators, upgrade-this-account button, existing-user migration modal) ships in PR 3c.
- **New foundation:** `styles/wizard-animations.css` extended with ~330 LOC of PR 3a design tokens (`.wz-step-shell`, `.wz-section`, `.wz-field`, `.wz-input`, `.wz-segmented`, `.wz-btn-primary/ghost/add`, `.wz-chip`, `.wz-page-root/shell/card`, `.wz-stagger`, reduced-motion overrides). New primitives library in `components/onboarding/wizard/primitives/` — 7 files: `WizardStepShell`, `WizardSection`, `WizardField` (+ currency/percent/select variants), `WizardButton` (Primary/Ghost/Add), `WizardSegmentedControl`, `WizardChip`.
- **Shell + route:** `WizardContainer` rewritten with a `mode: 'page' | 'modal'` prop — `'modal'` (default) preserves the existing dashboard modal behaviour exactly; `'page'` uses the new full-page layout. New `/app/onboarding/page.tsx` mounts the wizard in page mode with deep-linkable URL, unauth redirect to `/signin?next=/onboarding`, and completion short-circuit to `/dashboard`. Header redesigned with gradient rocket mark; progress bar uses gradient fills (blue→indigo→violet on active, emerald→teal on completed).
- **All 8 step files redesigned** to compose the new primitives. **Welcome step removes the 4-card explicit profile picker** in favour of 2-question auto-inference (`ownsProperty` + `hasInvestments` → STARTER/HOMEOWNER/INVESTOR/MIXED). Reverse-infers from hydrated drafts. **Properties step simplified**: up-front fields reduced to name + type + current value; purchase price/date pushed behind an "Advanced details" disclosure; live equity preview as the user types. **Review step**: hero net-worth card with gradient background, 3-tile metrics row, "What you've added" grid, "What you'll unlock" panel, confetti preserved.
- **Key files:** `app/onboarding/page.tsx`, `components/onboarding/wizard/WizardContainer.tsx`, `components/onboarding/wizard/primitives/**`, `components/onboarding/wizard/steps/**`, `styles/wizard-animations.css`
- **Docs:** `docs/changelog/CHANGELOG_2026_04_12_WIZARD_VISUAL_OVERHAUL.md`, `docs/blueprint/PHASE_12_ONBOARDING_TOUR.md` v2.3 (new §16), `docs/blueprint/MASTER_BLUEPRINT.md` v2.6, `docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md` (living plan doc)

### 2026-04-12 — Onboarding Wizard PR 2: Draft Persistence + Premium Redesign + Dead-Code Sweep
- **Type:** feat/refactor/design | **Scope:** Onboarding wizard, welcome modal, resume banner
- Added `UserPreference.onboardingDraft Json?` column for server-persisted wizard drafts. `WizardContainer` now autosaves every state change (1.2s debounce) via `/api/onboarding/state` and hydrates from the server draft on mount. New `OnboardingResumeBanner` on `/dashboard` for users with an unfinished wizard (Resume / Start over / Dismiss). `bulk-create` clears the draft on success. Strict "show once / never again" welcome modal contract: only the "Don't show this again" checkbox persists a permanent dismiss; simple X / backdrop / "Not right now" closes session-only; tour completion no longer suppresses welcome. Completed wizards never re-trigger the welcome modal. Premium visual redesign of the welcome modal (rotating aurora hero, floating sparkles, glass logo mark, gradient CTA, staggered value-prop grid, reduced-motion + keyboard a11y, body-scroll lock) with matching polish on the resume banner. Dead-code sweep: removed `components/onboarding/shared/` (5 orphaned files, 329 LOC) and 14 unused imports across wizard steps.
- **Key files:** `prisma/schema.prisma`, `app/api/onboarding/state/route.ts`, `app/api/onboarding/bulk-create/route.ts`, `hooks/useOnboardingState.ts`, `components/onboarding/wizard/WizardContainer.tsx`, `components/onboarding/OnboardingWelcomeModal.tsx`, `components/onboarding/OnboardingResumeBanner.tsx`, `components/DashboardLayout.tsx`, `styles/wizard-animations.css`
- **Docs:** `docs/changelog/CHANGELOG_2026_04_12_ONBOARDING_DRAFT_PERSISTENCE.md`, `docs/blueprint/PHASE_12_ONBOARDING_TOUR.md` v2.2, `docs/blueprint/MASTER_BLUEPRINT.md` v2.5

### 2026-04-12 — Onboarding Wizard PR 1: Correctness Sweep (11 fixes) + Dead-Code Cleanup
- **Type:** fix/refactor | **Scope:** Onboarding wizard, bulk-create API, schema, RBAC
- Eleven correctness fixes to the setup wizard and bulk-create API: (1) frequency double-conversion bug (a user entering $1000/week was stored as $4333/week and read as $225K/year), (2) household data was captured but never persisted to `HouseholdProfile`/`HouseholdMember`/`HouseholdPet`, (3) `Account.balanceSource` left null on onboarded accounts (now set to `'MANUAL'`), (4) `INVESTMENT`-type income routed as `sourceType='GENERAL'` instead of `INVESTMENT`, (5) HEALTH/EDUCATION/RENT/GROCERIES/SUBSCRIPTION expense categories missing from the wizard picker, (6) `taxYear` captured but discarded (added `UserPreference.taxYear` column), (7) `Property.purchaseDate` and `Asset.purchaseDate` silently defaulted to `now()` (now required with helper text and 400 on missing), (8) `bulk-create` gated on `settings.write` instead of a dedicated permission (added `onboarding.complete`), (9) `QUARTERLY` missing from Income/Expenses frequency list, (10) deleted the legacy v1 `InitialSetupWizard` + 8 `steps/*` files (~1750 LOC), (11) full Phase 12 doc refresh.
- **Key files:** `app/api/onboarding/bulk-create/route.ts`, `app/api/onboarding/state/route.ts`, `prisma/schema.prisma`, `lib/auth/permissions.ts`, `components/onboarding/wizard/types.ts`, `components/onboarding/wizard/steps/*.tsx`
- **Docs:** `docs/changelog/CHANGELOG_2026_04_12_ONBOARDING_CORRECTNESS.md`, `docs/blueprint/PHASE_12_ONBOARDING_TOUR.md` v2.1

### 2026-04-09 — Database Migration: Render to GCP Cloud SQL
- **Type:** docs/infra | **Scope:** Database infrastructure
- Created comprehensive migration plan and executed full database migration from Render PostgreSQL to GCP Cloud SQL (Sydney region). 88 Prisma models, 83 tables, all data verified. PROD + DEV instances provisioned. Vercel env vars scoped per environment.
- **Key files:** `docs/blueprint/MIGRATION_RENDER_TO_GCP_PLAN.md`, `docs/blueprint/MIGRATION_RENDER_TO_GCP_STEPS.md`

---

## March 2026

### 2026-03-08 — CDR Data Lifecycle Service (Phase 35) + Policy Documents + GCP Enablement Guide
- **Type:** feat/docs | **Scope:** CDR compliance, policy
- Implemented canonical CDR Data Lifecycle Service (`lib/services/cdrDataLifecycle.ts`) with consent-driven data deletion/anonymization, `withActiveConsent()` guard, consent revocation API, and Cloud Scheduler endpoint. Created all 5 Basiq accreditation policy documents (`docs/policy/`). Configured Dependabot + CI security audit pipeline. Created GCP service enablement guide. CDR compliance: ~70% to ~87%.
- **Key files:** `lib/services/cdrDataLifecycle.ts`, `lib/auth/guards.ts`, `app/api/cdr/`, `docs/policy/*`, `.github/dependabot.yml`, `.github/workflows/security-audit.yml`

### 2026-03-05 — MFA Enforcement on CDR Routes (Phase B)
- **Type:** feat | **Scope:** CDR security, MFA
- Created `withMFARequired()` guard. Applied to all Basiq/CDR API routes. Added SUPER_ADMIN/BILLING_ADMIN MFA enforcement to admin auth. CDR compliance score: ~65% to ~70%.
- **Key files:** `lib/auth/guards.ts`, `app/api/basiq/**`, `lib/admin/auth.ts`

### 2026-03-04 — withAuth-to-withPermission Migration (23 routes) + Admin TypeScript Fixes
- **Type:** refactor/fix | **Scope:** API auth guards, admin portal
- Migrated 23 remaining API route files from `withAuth` to `withPermission` (household, onboarding, categories, settings, assets, bank, auth/me, search, portfolio, master-snapshot). Fixed admin portal TypeScript errors (AuditAction enum misuse, Suspense boundary, FeatureAccess interface).
- **Key files:** 23 route files in `app/api/`, `lib/admin/permissions.ts`, admin API routes

### 2026-03-03 — Full RBAC Enforcement (Phase A — ~99 handlers)
- **Type:** feat | **Scope:** RBAC, CDR compliance
- Complete migration of ALL user API routes (~99 handlers across 70+ files) from `withAuth()` to `withPermission()`. Added CDR audit logging to all permission guards. Zero `withAuth` references remain. Basiq §1.5 (RBAC) and §1.6 (Least privilege): DONE.
- **Key files:** `lib/auth/guards.ts`, 70+ files in `app/api/`

---

## February 2026

### 2026-02-27 — GCP Auth Fixes + CDR Security Hardening (Phase 34) + CDR Compliance Matrix
- **Type:** fix/feat/docs | **Scope:** Auth, CDR compliance, security
- Fixed Firebase auth handler CSP/COOP issues blocking Google Sign-In popup. Created Phase 34: CDR Security Hardening plan. Implemented Sub-Phase 34.1 (password complexity, bcrypt rounds, idle timeout) and 34.2 (audit log DB persistence). Piloted RBAC on Properties module (34.3a). Created CDR/Basiq compliance matrix (54 requirements). Added CDR compliance rules (Part 13) to CLAUDE.md.
- **Key files:** `middleware.ts`, `next.config.ts`, `lib/auth.ts`, `lib/session/sessionManager.ts`, `lib/audit/logger.ts`, `docs/blueprint/PHASE_34_CDR_SECURITY_HARDENING.md`, `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md`

### 2026-02-27 — Audit Log Consolidation
- **Type:** enhancement | **Scope:** Admin portal, audit logs
- Consolidated all audit log viewing into canonical `/admin/audit-logs` page. Expanded API to query both `AdminAuditLog` and `AuditLog` tables. Added CSV export endpoint. Deprecated legacy dashboard audit page.
- **Key files:** `app/admin/audit-logs/page.tsx`, `app/api/admin/audit/route.ts`, `app/api/admin/audit/export/route.ts`

### 2026-02-27 — GCP Auth Event Logging + Dashboard Race Condition Fix
- **Type:** fix | **Scope:** Auth audit, dashboard
- Moved auth event logging from legacy dead routes to GCP sync boundary (`syncGCPUser()`). Fixed post-login dashboard 500 errors caused by token-without-user race condition in `DashboardLayout`. Added Research-Before-Action Protocol (Part 10) and Mandatory Change Documentation (Part 11) to CLAUDE.md.
- **Key files:** `lib/auth/gcpIdentity.ts`, `components/DashboardLayout.tsx`, `CLAUDE.md`

### 2026-02-26 — GCP-Only Auth Cutover + Firebase MFA + Auth Header Fixes
- **Type:** feat/fix | **Scope:** Authentication
- Completed GCP-only auth cutover: all 3 server-side auth entry points (`getAuthContext`, `withAuth`, `verifyToken`) now verify Firebase ID tokens directly. Integrated Firebase MFA (TOTP) with global challenge dialog. Fixed missing Authorization headers in 15+ components/hooks after migration. Added 30-minute idle auto-logout with warning dialog. Fixed Firebase branding on Google popup. Fixed race condition in user sync (upsert).
- **Key files:** `lib/auth.ts`, `lib/auth/context.ts`, `lib/middleware.ts`, `lib/firebase/mfa.ts`, `components/auth/MFAChallengeDialog.tsx`, `components/auth/IdleTimeoutGuard.tsx`, `lib/context/AuthContext.tsx`

### 2026-02-25 — GCP Identity Platform Migration (Phases 1-2)
- **Type:** feat | **Scope:** Authentication
- Phase 1: Server-side GCP ID token verification + user sync via `google-auth-library`. Phase 2: Client-side Firebase SDK integration for Google popup sign-in and email/password auth. Token bridge pattern: Firebase ID token sent as Bearer token to API routes. Legacy OAuth preserved as fallback when GCP env vars not set.
- **Key files:** `lib/auth/gcpIdentity.ts`, `lib/auth/gcpTokenVerifier.ts`, `lib/firebase/config.ts`, `lib/context/AuthContext.tsx`, `app/api/auth/gcp/sync/route.ts`

### 2026-02-03 — Transaction Categorization Fixes + Build Safety + Budget vs Actual + Household Redesign
- **Type:** fix/feat | **Scope:** Transactions, deployment, budget, household
- Fixed batch categorization, merchant learning, and transfer labeling bugs. **INCIDENT:** Near data loss from automated `prisma db push` — removed from all build scripts permanently. Implemented Budget vs Actual tracking from transactions (entries = budget, linked transactions = actual). Removed "Link & Update Amount" buttons. Redesigned household profile with named members/pets and auto-generated categories.
- **Key files:** `app/api/transactions/[id]/link/route.ts`, `package.json`, `render.yaml`, `lib/services/masterFinancialService.ts`, `lib/services/householdCategoryService.ts`, `app/dashboard/household-profile/page.tsx`

---

## January 2026

### 2026-01-28 — Change Management Protocol (CLAUDE.md)
- **Type:** docs | **Scope:** Process
- Established comprehensive change management protocol for all Claude Code sessions. Created CLAUDE.md with mandatory session startup protocol, branching strategy, documentation requirements, PR process, architecture enforcement rules.
- **Key files:** `CLAUDE.md`

### 2026-01-21 — CFO Decision Support (Phases 17A-D) + CFO Dashboard Redesign
- **Type:** feat | **Scope:** Personal CFO engine
- Implemented Tax Integration (17A), Loan Decision Support (17B), Property Decision Support (17C), and Investment Decision Support (17D) for CFO dashboard. Complete UI/UX overhaul with animated score ring, interactive tiles, hover animations. Created reusable components (MetricCard, InsightTile, ScoreRing, RiskBadge). All modules use `masterFinancialService` — no duplicate logic.
- **Key files:** `lib/cfo/decisionSupport/taxIntegration.ts`, `lib/cfo/decisionSupport/loanDecisionSupport.ts`, `lib/cfo/decisionSupport/propertyDecisionSupport.ts`, `lib/cfo/decisionSupport/investmentDecisionSupport.ts`, `app/(dashboard)/cfo/page.tsx`

### 2026-01-20 — Code Quality Audit: 7-Stage Deduplication + Master Financial Service
- **Type:** refactor | **Scope:** Codebase-wide
- 79 files changed across 7 stages: (1) formatCurrency centralization (26 files), (2) frequency multiplier dedup (14 files), (3) ownership validation utility, (4) onboarding consolidation, (5) calculation engine centralization (`lib/calculations/`), (6) complete ownership validation migration (14 routes), (7) Master Financial Service creation (`getMasterFinancialSnapshot()`). Fixed ~8% weekly income calculation error. Eliminated 450+ lines of duplicate code.
- **Key files:** `lib/utils/formatters.ts`, `lib/utils/frequencies.ts`, `lib/utils/ownership.ts`, `lib/calculations/*`, `lib/services/masterFinancialService.ts`, `app/api/master-snapshot/route.ts`

### 2026-01-19 — Admin Portal (Phase 33) + Enterprise Portal Blueprint (Phase 32)
- **Type:** feat/docs | **Scope:** Admin portal, enterprise portal
- Full implementation of admin portal with dashboard, org/user management, billing, analytics, feature flags, support tools. 9 admin pages, 12 API endpoints, RBAC with 4 roles. Created comprehensive Phase 32 Enterprise Portal blueprint (15 sub-phases, 60+ API endpoints, 15 data models, Xero integration spec, data integrity architecture).
- **Key files:** `app/admin/**`, `lib/admin/**`, `components/admin/**`, `docs/blueprint/PHASE_32_ENTERPRISE_PORTAL.md`

---

## December 2025

### 2025-12-25 — Investment Contribution Tracking
- **Type:** feat | **Scope:** Transactions, investments
- Added "Investment Contribution" as new transaction categorization option. Creates DEPOSIT InvestmentTransaction, updates cash balance, excluded from expense/income totals, supports recurring contributions.
- **Key files:** `prisma/schema.prisma`, `app/api/transactions/[id]/link/route.ts`, `components/transactions/TransactionLinkDialog.tsx`

### 2025-12-19 — Expense Recurring/Discretionary Split + Transaction Workflow Enhancements
- **Type:** feat/fix | **Scope:** Expenses, transactions
- Added `isRecurring` field to expenses. Clickable summary tiles with filter-to-view. Batch vendor categorization, merchant learning, auto-navigate to next transaction, custom category support (Category model + API + UI), uncategorized-first default view, transfer handling for incoming transactions. Fixed transfer exclusion from totals, auto-navigate stale closure bug.
- **Key files:** `app/dashboard/expenses/page.tsx`, `components/transactions/TransactionLinkDialog.tsx`, `app/api/categories/route.ts`, `hooks/useCategories.ts`

### 2025-12-18 — Cashflow Intelligence Center (Phase 31) + Transaction Module Enhancements
- **Type:** feat/fix | **Scope:** Cashflow, transactions
- Complete cashflow page redesign: unified health score, money leak detection, waterfall chart, Gemini AI summary, budget vs actual, tax optimization, smart actions. Added QIF import support, account filter on transactions page, create-account-during-import, asset source type, Basiq transaction priority override, transaction categorization with recurring/essential/transfer flags, 6 new expense categories.
- **Key files:** `lib/cashflow-intelligence/**`, `app/(dashboard)/cashflow/page.tsx`, `lib/bank/parsers/qif.ts`, `components/bank/ImportWizard.tsx`

### 2025-12-16 — Expanded Loan Types + Testing Framework (Phase 30) + Calculation Bug Fixes
- **Type:** feat/fix | **Scope:** Loans, testing, calculations
- Added CAR, PERSONAL, LINE_OF_CREDIT, STUDENT, BUSINESS loan types with entity linking. Created comprehensive testing framework for external AI verification. Fixed 5 critical calculation bugs: Portfolio LVR (used total assets instead of property value), CFO savings rate (missing loan repayments), cashflow API double-taxing NET income, CFO monthly progress savings rate, and raw float display in scores.
- **Key files:** `prisma/schema.prisma`, `lib/testing/**`, `app/api/testing/**`, `app/api/portfolio/snapshot/route.ts`, `lib/cfo/scoreCalculator.ts`

### 2025-12-15 — Debt Analysis Integration Fix + Sidebar Reorder + Persist AI Analysis (Phase 28.6-28.7) + Recurring Expense Linking (Phase 29)
- **Type:** fix/feat | **Scope:** Debt planner, recurring payments
- Fixed AI debt analysis using wrong available cashflow ($220K vs $494) by passing frontend value to API. Reordered sidebar Planning section for logical flow. Added DebtAnalysis model for persistence. Implemented Phase 29: recurring payment to expense linking with matching algorithm, confidence scores, batch actions, and match confirmation UI.
- **Key files:** `app/dashboard/debt-planner/page.tsx`, `app/api/ai/debt-analysis/route.ts`, `lib/recurring/expenseMatcher.ts`, `components/recurring/**`

### 2025-12-14 — Complete AI Migration to Google Gemini (Phase 27) + Server-Side Validation + NET/GROSS Fix
- **Type:** feat/fix | **Scope:** AI infrastructure, debt analysis, cashflow
- Migrated all 8 AI features from OpenAI to Google Gemini. Created centralized AI library (`lib/ai/google/`). Added token usage tracking. Implemented AI-powered debt analysis (Phase 27.1) with health score, strategy recommendation, surplus amounts, action plan. Added server-side validation to cap AI recommendations to actual cashflow (30%/60%/90%). Fixed double-taxation of NET salary in cashflow calculations.
- **Key files:** `lib/ai/google/**`, `lib/ai/services/financialAdvisor.ts`, `app/api/ai/debt-analysis/route.ts`, `app/api/portfolio/snapshot/route.ts`, `lib/cashflow/incomeNormalizer.ts`

### 2025-12-12 — Gemini AI Integration for Document Form Auto-Fill (Phase 26.6)
- **Type:** feat | **Scope:** Document intelligence, AI
- Integrated Google Gemini for document field extraction, replacing OpenAI. Model fallback chain with 4 Gemini models. Serverless-compatible PDF parsing. Updated Gemini model names after Google deprecation.
- **Key files:** `lib/ai/gemini.ts`, `app/api/documents/analyze-for-form/route.ts`, `app/dashboard/expenses/page.tsx`

### 2025-12-10 — GCS Fixes + Documents Page Rewrite + Document Management Engine (Phase 25) + Production Fixes
- **Type:** feat/fix | **Scope:** Documents, storage, deployment
- Fixed GCS configuration, storage health endpoint, and Places API logging. Rewrote Documents page with folder tree navigation (by category/FY/entity). Created Document Management Engine: rule-based storage selection, auto-category detection, cascade entity linking, intelligent path generation. Fixed Vercel MIME type loss, GCS permissions, TypeScript build errors, Places API key fallback, storage provider case mismatch.
- **Key files:** `lib/documents/engine/**`, `app/dashboard/documents/page.tsx`, `app/api/documents/upload/route.ts`, `hooks/useDocumentEngine.ts`

### 2025-12-09 — Onboarding Fixes + Income/Cashflow Bug Fixes + Basiq Integration (Phase 24) + Settings Audit
- **Type:** fix/feat | **Scope:** Onboarding, cashflow, open banking, settings
- Fixed onboarding modal persistence (localStorage fallback), income step="100" bug, cashflow forecasting double-conversion and first-occurrence skip, dashboard "Annual Outgoings" to include loan repayments. Implemented Basiq open banking integration (connect, sync, manage bank connections). Fixed wizard auth header. Complete settings section audit: SMS MFA via Twilio, TOTP QR code fix, real API connections for all settings pages, Google Places address autocomplete.
- **Key files:** `lib/basiq.ts`, `app/api/basiq/**`, `lib/cashflow/forecasting.ts`, `lib/security/mfa.ts`, `components/ui/address-autocomplete.tsx`

### 2025-12-07 — Onboarding Tour & Setup Wizard (Phase 12)
- **Type:** feat | **Scope:** Onboarding
- Complete onboarding experience: welcome modal, 9-step guided tour with spotlight/animations, 8-step setup wizard (profile type, country/tax, accounts, property, investments, income, expenses, review). Progress persistence to database. New schema: OnboardingProfileType enum, User onboarding fields, UserPreference model.
- **Key files:** `components/onboarding/**`, `hooks/useOnboardingState.ts`, `hooks/useGuidedTour.ts`, `app/api/onboarding/**`

### 2025-12-05 — Database Document Storage + Local Drive Storage (Phase 19.2)
- **Type:** fix/feat | **Scope:** Documents, storage
- Fixed ephemeral filesystem storage by implementing PostgreSQL BYTEA storage for documents. Added Local Drive storage option using File System Access API with Australian Financial Year folder structure. Created unified document upload hook.
- **Key files:** `lib/documents/storage/monitraxProvider.ts`, `lib/documents/storage/localDriveService.ts`, `hooks/useDocumentUpload.ts`

### 2025-12-04 — Transaction Linking + List View + Sidebar + Capital Gains Schema (Phase 23) + Search Engine + Smart Filters + Email Verification
- **Type:** feat/fix | **Scope:** Transactions, UI, investments, search, auth
- Fixed transaction "Link & Update" button visibility. Added list view toggle to Properties/Loans/Accounts/Investments pages. Added transaction category on link. Redesigned sidebar into 6 collapsible groups. Created Investment & Capital Gains schema (PurchaseLot, CapitalGainEvent models). Built universal search engine with Cmd+K palette. Added smart category filtering by source/asset type. Implemented email verification flow with rate limiting.
- **Key files:** `lib/search/searchEngine.ts`, `components/UniversalSearch.tsx`, `lib/categoryFilters.ts`, `prisma/schema.prisma`

### 2025-12-01 — OAuth Fix + Settings Nav + Receipt Upload + Cashflow Fix + Dashboard Dialogs + Expenses Redesign
- **Type:** fix/feat | **Scope:** OAuth, settings, expenses, cashflow, dashboard
- Fixed OAuth redirect_uri using dynamic base URL derivation. Added settings back/close navigation. Added receipt upload to expenses (Phase 19.1). Fixed critical bug: loan repayments missing from all cashflow calculations. Added click-to-expand detail dialogs for all 4 dashboard metric tiles (net worth, cashflow, savings rate, LVR). Complete expenses page redesign with grouped views (by category/property/all).
- **Key files:** `app/api/settings/storage/connect/[provider]/route.ts`, `app/dashboard/expenses/page.tsx`, `app/api/portfolio/snapshot/route.ts`, `app/dashboard/page.tsx`

---

## July 2026

### 2026-07-29 — MON-134 PR-3: the trend reads REAL stored snapshots — the Math.random fabrication is deleted (⚠️ changesNumbers — Reza's click)
- **Type:** fix (high) | **Scope:** `lib/health/aggregateEngine.ts` (calculateTrend rewritten + HEALTH_FORMULA_VERSION + injectable clock), `lib/health/types.ts`, `lib/health/buildHealthInput.ts`, `lib/health/riskModelling.ts` (stable risk ids), `lib/services/healthScoreSnapshotRecorder.ts` (new), `app/api/financial-health/route.ts`, `tests/health/mon134TrendFromSnapshots.test.ts` (11 tests)
- **What was wrong (plain):** the health score's trend — the up/down verdict, percentage, and 7-month chart — was invented from today's score plus random noise on every request. Found by the Matrix Relay's first A3 self-diff: 15 leaves moved between two captures of an unchanged database, all in this subtree. Tranche-blocking for MON-131 (every baseline diff would STOP on noise).
- **The fix (D15, at the producer):** `calculateTrend(snapshots)` — real stored monthly rows only. <2 snapshots → `INSUFFICIENT_HISTORY`, empty history, NO `changePercent` (the absent case is typed, never 0-faked, never a `'STABLE'` fallback). ≥2 → direction/changePercent from `newest − oldest` over the pre-existing ±2 thresholds. Consecutive snapshots with different `formulaVersion` → `formulaBreaks` (a trend spanning two formulas shows the break). Write path: fire-and-forget write-once recorder on `/api/financial-health` (create-only, P2002 no-op — no update path exists).
- **Determinism (§4.4):** `generateHealthReport` is byte-identical for identical input — trend randomness deleted, risk-signal ids no longer embed `Date.now()`, report timestamps take an injectable `asOf` clock (defaults to now at the boundary; numeric leaves are clock-free either way).
- **The permanent guards:** determinism test (two calls byte-identical); INSUFFICIENT_HISTORY at 0 and 1 rows; write-once idempotency (second run: one row, unchanged); **Math.random ratchet** — reviewed allowlist of the 17 existing id/nonce/jitter uses under `lib/` (ratchet-down-only), ZERO tolerance in `lib/health/`, any NEW use fails CI.
- **Coverage boundary (§22.2.4):** verifies the trend math, contracts, determinism, and writer semantics against mocks; does NOT verify the writer against a live DB, and the **acceptance test is the Matrix relay A3 self-diff returning `verdict: CLEAN` on real data (brief §5)** — MON-134 stays FIXING until that run records. Surface check: NO `.tsx` under `app/`/`components/` renders `historicalTrend`/`trend.history`/`trend.direction`/`changePercent` (targeted grep) — the fabricated values were API-served and CFO-consumed but not established as rendered.
- **Gate (§20.6): Document 10/10 (brief §4.2–§4.4, §5, §7 conformed; D15 verbatim) · Requirements 10/10 · Logic 10/10** (worked examples inline in the test; three self-review corrections recorded: recorder regex false-positive on its own JSDoc, comment-mention tripping the random scanner, Date.now risk-ids as a second nondeterminism source found BY the new determinism test).

### 2026-07-29 — MON-134 PR-2: `HealthScoreSnapshot` schema + migration (additive only — ships ahead of the read path per the brief §4.1)
- **Type:** feat (schema) | **Scope:** `prisma/schema.prisma` (+`User` relation), `prisma/migrations/20260729133413_mon134_health_score_snapshot/`, `docs/architecture/03_DATA_MODEL.md`
- One row per (user, month-anchor): `score` (canonical `generateHealthReport` 0-100), `riskBand`, **`formulaVersion`** (MON-131 will change the score's inputs — a trend spanning two formulas must show the break, D15), `capturedAt`. `@@unique([userId, snapshotDate])`, cascade on user delete, `health_score_snapshots`.
- The §3.2 **audit-snapshot exception** (`NetWorthSnapshot` pattern) with ONE deliberate divergence, documented in the model JSDoc: **WRITE-ONCE per month** (brief §4.2 — re-running the writer must not change an existing row), stricter than the net-worth recorder's current-month refresh.
- Migration is a pure additive `CREATE TABLE` (no `DROP`/`ALTER`, no backfill) — generated via `prisma migrate diff` (no DB in the sandbox; the preview build's `prisma migrate deploy` against dev is the real application test, §12.12). No §12.11 destructive-write checklist required — nothing touches an existing row.
- Writer + real `calculateTrend` + determinism/`Math.random()` guards follow in PR-3 (changesNumbers — Reza's click).
- **Gate (§20.6): Document 10/10 (brief §4.1 + §3.2 pattern conformance, divergence stated) · Requirements 10/10 · Logic 10/10.** Verifies: schema validates, client generates, tsc clean, migration SQL matches the model. Does NOT verify: the migration against a live DB (preview build does) or any trend behaviour (PR-3).

### 2026-07-29 — MON-131 Tranche −1b: the Matrix Relay — admin-side capture endpoints (moves NO numbers)
- **Type:** feat (tooling) | **Scope:** `lib/matrix/goldenBaseline.ts` (new — THE capture/diff module), `app/api/admin/matrix/{golden-baseline,golden-baseline/diff,census}/route.ts` (new), `scripts/matrix/golden-baseline.mjs` (now a thin CLI wrapper), `tests/matrix/goldenBaselineRelay.test.ts`
- **Why:** the Tranche −1 baseline script requires DATABASE_URL, so every capture/diff needed Reza's terminal — dozens of manual round-trips across the programme. The deployed app already reaches the DB and the admin portal already carries this surface class (`/api/admin/calc-audit`). The relay lets the Matrix capture/diff over an authenticated browser session; Reza's terminal leaves the loop.
- **Refactor, not duplicate:** capture registry, `plain()` serializer, `numericLeaves`, and the three-outcome diff extracted to `lib/matrix/goldenBaseline.ts`; the CLI and both routes call the ONE module (§12.2.1 — a second capture implementation would be a MON-131 violation in the tool built to detect them). Parity locked by `tests/matrix/goldenBaselineRelay.test.ts` (12 tests: no second CAPTURES/plain in CLI or routes, HR-3 comment carried, CLEAN/EXPECTED_ONLY/STOP verdict mapping, serializer + leaf-path stability).
- **Routes** (all `isAdminPortalAccessible` + `verifyAdminGCPAuth` + `audit:read`, modelled on calc-audit; HR-3 no-user-facing-variant carried verbatim): `GET /api/admin/matrix/golden-baseline[?userId]` (capture at deployed SHA — `VERCEL_GIT_COMMIT_SHA`, never a git call); `POST /api/admin/matrix/golden-baseline/diff` (body `{baseline, userId?, expectedMoves?}` → fresh capture → `{verdict: CLEAN|EXPECTED_ONLY|STOP, moves}`; STOP is a 200, the Matrix records it); `GET /api/admin/matrix/census` (static-import reads of `.audit/producer-census.json` + `.audit/source-lock-exceptions.json` + totals — ratchet state at the deployed SHA without a checkout).
- **Coverage boundary:** the routes verify the Matrix can REACH the capture; they do NOT verify any captured number is correct (Axis C of the Number Ledger — stays with the Matrix). CLI diff exercised both ways (EXPECTED_ONLY exit 0 · STOP exit 1) through the shared module.
- **Layer-0 note:** `structural-graph.json` `files` extended with the 5 new .ts files (membership is what the coverage gate checks; symbol extraction lands with the next Matrix graphify run — binary unavailable in this sandbox).
- **Gate (§20.6): Document 10/10 (doc: CODE_BRIEF_MON-131_matrix-relay.md §2–§5, all clauses conformed incl. the refactor-not-duplicate rule and HR-3) · Requirements 10/10 (three routes exactly as specified; no write endpoints; no user-facing variant) · Logic 10/10 (route-vs-CLI single-module parity test; `deployedSha` moved out of route.ts — Next forbids arbitrary route exports).**

### 2026-07-29 — MON-131 Tranches −1 + 0: Reference Numbers foundation — golden baseline, producer census, source-lock → lib/ (moves NO numbers)
- **Type:** feat (enforcement/tooling) | **Scope:** `scripts/matrix/golden-baseline.mjs` (new), `scripts/census/producers-census.mjs` (new), `scripts/lint-source-lock.ts` (lib/ scope), `.audit/producer-census.json` + `.audit/source-lock-exceptions.json` (reseeded), `docs/architecture/REFERENCE_NUMBERS_DESIGN.md` + `REFERENCE_NUMBERS.md` (new), `CALC_SSOT_WALL.md`, `tests/calc-audit/surfaces/lintSourceLock.test.ts`
- **The programme:** ~336 producers across 23 canonical quantities (22 of 23 MULTIPLE — Medicare the sole single-source). Root cause of invisibility: `lint-source-lock.ts` scanned only `app/` ("engines under lib/ are the producers — out of scope") while nearly all producers live in `lib/`. Tranche 0 is enforcement only — **no number moves in this PR**.
- **Golden baseline (Tranche −1):** `golden-baseline.mjs` captures the canonical orchestrator trees (master snapshot, tax position, CFO components, risk radar, money flow, health input+report, loan costs) against real data → `.audit/golden-baseline-<sha>.json`; `--diff` enforces the three-outcome rule (unchanged / EXPECTED via pre-declared `expectedMoves` / MOVED-UNDECLARED → STOP, exit 1). Requires DATABASE_URL — **capture runs on the Matrix/Reza side**; the sandbox validated import-chain + both CLI paths. Coverage boundary: orchestrator trees, NOT all ~336 leaf producers individually — the registry extends per Phase A contract.
- **Producer census (Tranche 0):** `npm run census:producers` counts formula-shape sites per quantity (13 measured v1; 11 explicitly UNMEASURED pending Phase A signatures — listed, never silently dropped). Seed at HEAD: expenseRunRate 84 · incomeRunRate 135 · loanCost 32 · netWorth 7 · savingsRate 30 · emergencyMonths 14 · medicareLevy 26 · superCap 10 · depreciation 15 · payg 64 · incomeTax 77 · propertyEquity 11 · cashflow 59 = 564 sites. RATCHET-DOWN-ONLY (`census:producers:check` in `vercel-build` + vitest): a rising count OR a stale seed after a drop fails CI. v1 method is a deterministic proxy — it claims STABILITY, not parity with the Matrix's ~336 agent census.
- **Source-lock → lib/:** same three producer rules now scan `lib/**/*.ts`; only structural exemptions are the canonical gate implementations (`frequencies.ts` P1, `loanCosts.ts`/`propertyCashflow.ts` P2) + `lib/calc-audit/**` (proof spine). Aggregators are NOT exempt — their raw shapes ARE the MON-128/129/130 debt. Comment-stripping added (doc-comment mentions are not debt). Reseeded: app 68 (unchanged) + lib 155 = 223, ratchet-down-only. Policy: no file remains on the exceptions list while it powers a user-facing money feature.
- **Registry FROZEN (Matrix directive mid-session):** no `docs/issues/` changes in this PR. The vr038-039 scripts (#1521, never executed) were dry-validated end-to-end then unwound — the Matrix's reconciliation PR owns them + MON-115…124 definitions + MON-127…132 pinned registration. `REFERENCE_NUMBERS_DESIGN.md` §0 records the full provenance (original design record + VR-040 run file were never committed — §21.2.2).
- **Tests:** full suite 4,343 passed / 0 failed pre-move; census ratchet folded into `lintSourceLock.test.ts` (17 tests green) — Layer-0 coverage gate satisfied without a graphify run (binary unavailable in sandbox; allowlist policy forbids CLI-unavailability entries).
- **Gate (§20.6): Document 10/10 (REFERENCE_NUMBERS_DESIGN.md reconstructed + conformed; brief §4/§11 order followed: T−1 before T0, T0 alone, no number moves) · Requirements 10/10 (all four T0 items + T−1 baseline; registry freeze honoured) · Logic 10/10 (ratchets verified fail-both-ways; anchors spot-verified at HEAD; coverage stated as verifies/does-NOT-verify throughout).**

### 2026-07-29 — MON-125/MON-126: the budget generator consumes the canonical producers (⚠️ changesNumbers — Reza's click)
- **Type:** fix (critical) | **Scope:** `/api/budget-analysis/generate`, `/dashboard/budget-analysis`, `masterFinancialService` byCategory feed, source-lock debt, 11-test ratchet
- **MON-125 (critical, VR-040 trace):** the budget route was the FOURTH uncanonical expense producer — it fetched every expense row with no recurring basis, annualised 132 one-offs ($50,840) via raw `toMonthly`, and costed loans from raw `minRepayment` (two interest-only Bankwest loans + HECS = $3,792/mo of real cost read $0). Recommended budget: **$62,530/mo against $41,303/mo income (151%)**. Fix at the producers: `monthlyRunRate()` (the one-off gate) over recurring rows for every expense figure incl. the AI-prompt context; `resolveLoanCostsForUser()` (actuals-first: linked repayments → declared → interest floor) for every loan figure, each loan line carrying its `basis` label (the Expenses-page pattern); the pre-fix cached analysis is invalidated by a `generatorVersion` gate so the AI variable estimate regenerates on corrected inputs.
- **Income sanity (correct default — announce):** the route reads `quickMetrics.monthlyIncome` (canonical net income) and stamps `incomeSanity.exceedsIncome`; the page shows an amber notice instead of silently recommending a budget above income.
- **The prevention paid:** all three grandfathered `.audit/source-lock-exceptions.json` entries for this route (RAW_ARRAY_REDUCE_SUM 1 / RAW_FREQ_RUN_RATE 6 / RAW_MIN_REPAYMENT_COST 5) are DELETED — debt 80 → 68; the one remaining reduce sums the resolver's outputs and is `@source-lock-allowed`-annotated in place.
- **MON-126 (high — the brief's "MON-115", renumbered: that id belongs to the merged NEO_ALIGNMENT_SWEEP F4):** master fed ALL expense rows to `aggregateExpensesByCategory` at :953 while its essential/discretionary siblings gate on `isRecurring !== false` — so `expenses.monthly.byCategory` → `/api/dashboard/spending-pareto` → the "WHERE 80% OF YOUR SPENDING GOES" panel read $52,323/mo directly above the expenses page's own "one-offs — counted once, not monthly" caption. Fixed at the call site with the identical sibling filter (the only consumer of byCategory).
- **Expected movement (derived from the rules, locked by ratchet):** Committed $51,034 → ~$14,261 (recurring essentials $1,482 + canonical loans $12,779); loans $8,817 → $12,779; Discretionary $10,105 → ~$0; Variable regenerates; Total ~$62,530 → ~$15,700 ≈ the Expenses page's own "Total outgoings" — two independent paths landing on one number is the acceptance test (Ring-3 VR-041).
- Ratchet: `tests/budget/mon125BudgetGeneratorSsot.test.ts` — 11 tests: one-off gate + IO loans through the REAL route handler, resolver fallback order in all three directions, cross-producer parity (the fifth-producer stopper), income-sanity flag both ways, topology + paid-debt locks + the MON-126 basis lock.
- Neo-sync: `orchestrator.budgetAnalysisGenerate.POST` modelled (was a §21.5 blind spot) + feeds edges from monthlyRunRate / resolveLoanCostsForUser / getMasterFinancialSnapshot; two master anchors re-pinned (:1797/:1380); gates green. §10 open decision (agent management fee ~$432) NOT decided in-session per the brief — surfaced on the PR for Reza's confirm.
- **PR:** fix/mon-125-budget-generator-ssot

### 2026-07-28 — MON-106: FY2026-27 tax year config + loud stale-FY surfacing + clock-derived CI guard (PR-B; ⚠️ changesNumbers — Reza's click)
- **Type:** fix | **Scope:** `taxYearConfig.ts`, `TaxPositionResult` (+Decimal), `/api/tax/position`, `/dashboard/tax` banner, config conformance suite, golden re-pin
- **Root cause (VR-037 finding 3):** no FY2026-27 entry existed, so from 1 Jul 2026 the engine silently fell back to FY25-26 brackets — the page header read "Financial Year 2026-27" over an FY25-26 bracket table, and the $18,201–$45,000 band was taxed at 16% instead of the legislated 15%.
- **The config:** `TAX_YEAR_2026_27` — 15% lowest band per the More Cost of Living in Every Pocket Act 2025 (base amounts re-derived: $4,020 / $31,020 / $51,370, each cited in-file); every ATO-indexed item carried forward from FY25-26 with a pending-confirmation comment; `reviewSchedule.nextReviewBy` = 2027-06-15 (FY27-28 config + the same Act's 15%→14% step).
- **The movement (Ring-0 walk, locked in `tests/tax/mon106Fy2026_27Config.test.ts`):** tax on the live $145,426 taxable = $35,145.62 → $34,877.62 — **exactly −$268.00** (the full-band saving 26,800 × 1%, same for every income ≥ $45k); Medicare unchanged. Golden household netTax re-pinned 32,284 → 32,016 (same −$268, documented at the pin). Nothing was adjusted to preserve any old total — the old totals were wrong.
- **Announce, never substitute (correct default):** `TaxPositionResult`/`Decimal` gain `configFinancialYear` + `configStale` (one producer, both twins); `/api/tax/position` passes them through; `/dashboard/tax` renders an amber banner ("FYX rates are not yet configured — figures shown use FYY") whenever the requested FY has no config. §12.14: a stale config is a defect that must announce itself.
- **Durable prevention:** a clock-derived CI guard (`isTaxYearConfigured(currentAuFy())`) goes RED every 1 July the current FY lacks a config — "someone remembers next year's brackets" is now a build failure, permanently.
- Backlog item 34 (the 2026-06-15 "defer to Basiq prep" decision) flipped to RESOLVED — Reza's merge click on this PR is the sign-off gate that deferral required. Discovered follow-up (surfaced, not silently fixed): `getUserTaxPosition` computes historical `?financialYear=` requests on the CURRENT config (the stale banner now makes that visible).
- Neo-sync: `getCurrentTaxYearConfig` anchor re-pinned :507; `GENERATED_CORE.md` regenerated; gates green. Registry: MON-106 → FIXING on the PR.
- **PR:** fix/mon-106-fy2026-27-config (stacked on PR-A #1519 — after #1519 merges this diff reduces to the bracket table + its guard)

### 2026-07-28 — VR-037 findings: capture-layer SSOT + config-trace + citation fixes (MON-104/105/107/108/109/110; PR-A of two)
- **Type:** fix | **Scope:** capture routes (psi-assessment / div152-assessment / smsf-return), entity tax page, PSI + Div 152 cards, PSI + Div 152 engines, taxYearConfig resolver, 6 new ratchet suites
- **MON-104 (HIGH, silent data loss):** capture write path persisted the raw `?fy=` while the read path normalised through the config — a disagreeing FY saved an orphaned, permanently invisible row. Fix: `resolveRequestedTaxYear` / `isTaxYearConfigured` added to the ONE normaliser home (`taxYearConfig.ts`); all three capture routes resolve through it and 400-reject an unconfigured FY at the boundary (correct default: reject, never persist). Ratchet: `mon104FyResolver.test.ts` — resolver contract + REAL-handler round-trip (PUT key ≡ GET key, explicit + default) + rejection-persists-nothing + 3-route topology lock. §19.4 sweep: `tax/config` + entity route GET/POST normalise-on-read (unchanged by design); `bookkeeping/tax-pack/export` is read-only filtering (out of class).
- **MON-105 (HIGH, feature unreachable):** the Div 152 card rendered inside the PSI branch, so INDIVIDUAL / PERSONAL_NAME / FIXED_TRUST / HYBRID_TRUST / TESTAMENTARY_TRUST / DECEASED_ESTATE could never capture Div 152 facts. Fix: `lib/tax-engine/eligibility.ts` — Div 152 gets its OWN grammar (entity-type-agnostic per s152-10, encoded as an SMSF-only exclusion list), independent of `PSI_ELIGIBLE_TYPES`; page gates each card on its own predicate. Ratchet: `mon105Div152Eligibility.test.ts` (reachability + not-aliases + page topology).
- **MON-107 (MED, wrong citation live):** PSI card hardcoded `s86-15` on every branch — the $0 PSB branch cited the attribution provision. Fix: card renders the ENGINE's `citations` via new pure `components/tax/citationLine.ts`; literal deleted. Ratchet: `mon107PsiCitationLine.test.ts` (PSB-determination line contains s87-60, never s86-15).
- **MON-108 (LOW, same class):** engine embedded the citation in the step label AND emitted `citation` → `…(s152-205) (s152-205)` live. Fixed at the PRODUCER (both twins): clean labels, `citation` the sole carrier. Ratchet: `mon108ConcessionLabels.test.ts`.
- **MON-109 (MED, drift risk):** `0.8` inline in the classifier + PSI card; `180` / `$6,000,000` / `$2,000,000` / `$500,000` re-typed on the Div 152 card. Fix: engine exports `ONE_CLIENT_THRESHOLD` / `MNAV_THRESHOLD` / `TURNOVER_THRESHOLD` / `RETIREMENT_LIFETIME_CAP` / `FIFTEEN_YEAR_MONTHS`; cards read them for comparisons AND display copy (formatted from the constant). NeoAudit detector added (registered NEOAUDIT.md §7): threshold numerals in `components/tax/**` fail CI.
- **MON-110 (MED, wall breach):** `Div152Result` gains `gainBeforeConcessions` (both twins, Float ≡ Decimal locked); the card's `steps[0].runningGain + steps[0].reduction` reconstruction deleted; the "cards do no tax arithmetic" audit promoted to CI.
- **MON-111 raised (tracked deferral, no code):** s86-15 attribution is entity-surface-only until the Phase 41e.6/41e.7 company dispatch lands.
- Registry: MON-104…111 raised via `issues:raise`; 104/105/107/108/109/110 → FIXING on the PR. Neo-sync: 3 anchors re-pinned (classifyPsi :151, applyDiv152 :161, getCurrentTaxYearConfig :407), `eligibility.ts` hand-moved into the structural graph (graphify offline — 2846163 precedent), `GENERATED_CORE.md` regenerated, all gates green. Suites: tax + tax-engine + calc-audit + golden + issues = 1,520 green; tsc clean; both lints green, no exception rise.
- **MON-106 (≈$268 movement) ships separately in PR-B** (`fix/mon-106-fy2026-27-config`, stacked on PR-A) for Reza's number-changing click.
- **PR:** fix/mon-104-110-capture-ssot

### 2026-07-15 — Governance: cursor truth-restore + The Matrix HQ (Cowork session)
- **Type:** docs/governance | **Scope:** STATE.md, implementation plan hub + spokes 03/04, docs/operational (new launch program), changelog
- STATE.md Resume Cursor re-pinned from `b03975d` (#1164, 2026-06-21) to `38abeee` (#1416, 2026-07-15) — ~250 PRs of cursor drift closed after a full-repo ingestion (6 parallel deep reviews: blueprint/Neo, financial code, implementation+issues, architecture/infra, compliance/legal, GTM).
- Q-GTM-3 (first aggregator) reconciled: BROKER_ICP.md records DECIDED 2026-06-10 (Finsure first); 03_OPEN_QUESTIONS still listed it OPEN — drift fixed, pointer added.
- New `docs/operational/LAUNCH_PROGRAM_2026-07.md` — gate plan for the Reza-decided (2026-07-15) 31-July scope: friendlies beta + broker outbound Phase 2; Basiq/Stripe-live/mobile explicitly out of scope.
- Reza decisions recorded 2026-07-15: The Matrix HQ build GO; 0·RECTIFY GO (cluster ①, one issue at a time per FIX_PROTOCOL, per-fix Ring-3); launch scope as above.
- Session findings (queued for issues:raise): CFO hardcoded `savingsOpportunities: 3`/`pendingActions: 5` (`lib/cfo/intelligenceEngine.ts:274-275`); HECS-HELP PAYG withholding TODO (`paygCalculator.ts:197`); VR-005 run file absent; stale `audit:fixtures` script ref (`runDifferential.ts` header); docs/architecture/09 stale top table; GCS prod provisioning doc-conflict.
- **PR:** (this PR)
