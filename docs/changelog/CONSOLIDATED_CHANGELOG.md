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
