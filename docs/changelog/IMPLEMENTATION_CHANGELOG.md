# Monitrax Implementation Changelog

**Last Updated:** 2026-01-19
**Active Branch:** `claude/admin-monetization-licenses-Gf7rU`

---

## Summary

This document tracks all implementation changes, features, and bug fixes made to the Monitrax platform.

---

## Recent Changes (January 2026)

### Phase 33: Admin Portal - Monetization & License Management ✅
**Date:** 2026-01-19
**Branch:** `claude/admin-monetization-licenses-Gf7rU`

#### Overview
Full implementation of a dedicated Admin Portal at `/admin` for Monitrax staff to manage monetization, licenses, users, and organizations. Completely isolated from the existing user app (`/`) and enterprise portal (`/portal`).

#### Files Created

**Database Models (prisma/schema.prisma):**
- `AdminUser` - Admin accounts with roles (SUPER_ADMIN, BILLING_ADMIN, SUPPORT_ADMIN, VIEWER)
- `AdminSession` - Session management with token hashing
- `AdminAuditLog` - Comprehensive audit logging for all admin actions
- `ImpersonationSession` - User impersonation tracking
- `GlobalFeatureFlag` - Feature flag management
- `FeatureFlagOverride` - Per-user/org flag overrides
- `UserSubscription` - Personal user tier management (FREE, BASIC, PRO, PREMIUM)
- `OrganizationLicense` - Organization license management
- `BillingTransaction` - Revenue tracking

**Core Library (`/lib/admin/`):**
| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports |
| `auth.ts` | Admin authentication (login, logout, session verification) |
| `permissions.ts` | RBAC permission checks by role |
| `constants.ts` | Routes, error codes, rate limits |
| `types.ts` | TypeScript definitions |
| `featureFlags.ts` | Feature flag utilities |

**UI Components (`/components/admin/`):**
| Directory | Components |
|-----------|------------|
| `layout/` | AdminSidebar, AdminHeader, AdminBreadcrumb |
| `ui/` | AdminCard, AdminTable, AdminButton, AdminForm, AdminBadge, AdminStats, AdminChart, ButtonGroup, FormField, Modal, Select, Tabs |
| `organizations/` | OrganizationList, OrganizationDetail |
| `users/` | UserList, UserDetail |
| `billing/` | RevenueOverview, SubscriptionBreakdown |
| `analytics/` | GrowthCharts, FeatureUsageMetrics |
| `feature-flags/` | GlobalFlagsList, FlagOverrideEditor |
| `support/` | ImpersonationPanel, AccessLogsViewer |

**Admin Pages (`/app/admin/`):**
| Page | Path |
|------|------|
| Login | `/admin/login` |
| Dashboard | `/admin/dashboard` |
| Organizations | `/admin/organizations`, `/admin/organizations/[orgId]` |
| Users | `/admin/users`, `/admin/users/[userId]` |
| Billing | `/admin/billing` |
| Analytics | `/admin/analytics` |
| Feature Flags | `/admin/feature-flags` |
| Support | `/admin/support`, `/admin/support/impersonate`, `/admin/support/logs` |
| Settings | `/admin/settings` |

**API Routes (`/app/api/admin/`):**
| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/admin/auth/login` | POST | Admin login |
| `/api/admin/auth/logout` | POST | Admin logout |
| `/api/admin/auth/session` | GET | Session verification |
| `/api/admin/dashboard` | GET | Real-time dashboard stats |
| `/api/admin/organizations` | GET | List organizations |
| `/api/admin/organizations/[orgId]` | GET, PATCH | Organization details |
| `/api/admin/users` | GET | List users |
| `/api/admin/users/[userId]` | GET, PATCH | User details |
| `/api/admin/billing/overview` | GET | Revenue metrics |
| `/api/admin/analytics/growth` | GET | Growth metrics |
| `/api/admin/feature-flags` | GET, POST, PATCH | Flag management |
| `/api/admin/audit` | GET | Audit log queries |

**Seed Script:**
- `prisma/seed-admin.ts` - Creates default admin user
- Command: `npm run seed:admin`
- Default credentials: `admin@monitrax.com.au` / `Admin123!`

#### Bug Fixes

| Issue | Fix | Commit |
|-------|-----|--------|
| Prisma import path error | Changed `@/lib/prisma` to `@/lib/db` | `47df7ae` |
| ButtonGroup React.cloneElement type error | Added proper typing | `e097a92` |
| Admin portal not enabled (503) | Use `NEXT_PUBLIC_` prefix | `a5cdf76` |
| Invalid password (401) | Fixed seed to use `salt:hash` format | `c47917e` |
| Blank pages after login | Fixed feature gate checks | `5ace7ee` |
| Dashboard showing mock data | Created real data API | `5ace7ee` |
| Template literal syntax errors | Removed escaped backticks | `27a2f5e` |

#### Environment Configuration

```env
NEXT_PUBLIC_ADMIN_PORTAL_ENABLED=true
```

---

## Recent Changes (December 2025)

### Bug Fix: NET vs GROSS salaryType Double-Taxation
**Date:** 2025-12-15

**Issue:** When users entered salary as "Net (After Tax)", the cashflow calculations were incorrectly deducting PAYG tax again, resulting in double-taxation.

**Files Modified:**
| File | Changes |
|------|---------|
| `app/api/portfolio/snapshot/route.ts` | Added `getGrossIncomeAmount()`, `getPaygWithholding()` helpers; updated `getNetIncomeAmount()` to check `salaryType` |
| `lib/cashflow/incomeNormalizer.ts` | Updated `normalizeIncomeStream()` to handle NET vs GROSS properly |
| `lib/cashflow/types.ts` | Extended `IncomeStream` interface with `salaryType`, `grossAmount`, `netAmount`, `paygWithholding` |
| `app/api/cashflow/route.ts` | Pass salary-specific fields when building income streams |

**Fix Logic:**
- For `salaryType === 'NET'`: Use stored `netAmount` directly (no tax calculation)
- For `salaryType === 'GROSS'`: Use pre-calculated `netAmount` from database
- For legacy data (no `salaryType`): Fall back to calculating PAYG for backward compatibility

**Reference:** See `PHASE_20_AUSTRALIAN_TAX_INTELLIGENCE_ENGINE.md` Section 11 for full details.

---

### Phase 20: Australian Tax Intelligence Engine ✅
**Date:** 2025-12-01

#### Phase 20A: Core Tax Engine

**Files Created:**
| File | Purpose |
|------|---------|
| `lib/tax-engine/index.ts` | Public API exports |
| `lib/tax-engine/types.ts` | Type definitions (TaxYearConfig, TaxBracket, etc.) |
| `lib/tax-engine/core/taxYearConfig.ts` | FY 2024-25 rates with Stage 3 tax cuts |
| `lib/tax-engine/core/incomeTaxCalculator.ts` | Tax bracket calculations |
| `lib/tax-engine/core/medicareLevyCalculator.ts` | Medicare levy + surcharge |
| `lib/tax-engine/core/paygCalculator.ts` | PAYG withholding tables |
| `lib/tax-engine/core/taxOffsets.ts` | LITO, SAPTO, franking credit offsets |
| `lib/cashflow/incomeNormalizer.ts` | Gross-to-net income conversion utility |
| `app/api/tax/route.ts` | GET/POST tax calculation API |
| `app/api/tax/position/route.ts` | Tax position calculator API |
| `app/dashboard/tax/page.tsx` | Tax Dashboard with tabs |

**Files Modified:**
| File | Changes |
|------|---------|
| `app/api/cashflow/route.ts` | Uses net income (after PAYG) for salary types |
| `app/api/calculate/cashflow/route.ts` | Returns gross, net, PAYG breakdown |
| `app/api/portfolio/snapshot/route.ts` | Added grossIncome, netIncome, paygWithholding |
| `app/api/financial-health/route.ts` | Uses net monthly income for health metrics |
| `app/dashboard/income/page.tsx` | Salary fields: gross/net selector, PAYG preview, super |
| `lib/documents/documentService.ts` | Fixed Prisma enum type casting |

**Features:**
- Australian Tax Engine with 2024-25 Stage 3 tax rates
- PAYG withholding calculation (weekly, fortnightly, monthly)
- Medicare levy (2%) with thresholds
- Tax offsets: LITO ($700 max), SAPTO, franking credits
- Tax Dashboard UI with Overview, Income, Deductions, Super tabs
- Income form enhancements for salary types (gross/net, PAYG preview)
- **Tax-Cashflow Integration**: All financial calculations now use after-tax (net) income for salary types

**Tax-Cashflow Integration Details:**
| API | Change |
|-----|--------|
| `/api/cashflow` | Income streams use net amounts after PAYG deduction |
| `/api/calculate/cashflow` | Returns `grossIncome`, `netIncome`, `paygWithholding` |
| `/api/portfolio/snapshot` | Cashflow section includes gross/net breakdown |
| `/api/financial-health` | Health metrics based on actual take-home pay |

**Bug Fixes:**
- Fixed `DepreciationRecord` type to match Prisma schema (`cost`, `rate`, `category`, `method`)
- Removed invalid `'DIVIDEND'` case from IncomeType switch (valid: SALARY, RENT, RENTAL, INVESTMENT, OTHER)
- Removed invalid `'INTEREST'` type comparison in tax API
- Fixed DocumentCategory Prisma-to-local enum type casting
- Fixed implicit `any` types in tax position route

---

## Recent Changes (November 2025)

### Phase 19: Document Management System ✅
**Date:** 2025-11-30

**Files Created:**
| File | Purpose |
|------|---------|
| `lib/documents/types.ts` | Core type definitions |
| `lib/documents/storage/interface.ts` | Storage provider interface |
| `lib/documents/storage/monitraxProvider.ts` | Monitrax storage implementation |
| `lib/documents/storage/factory.ts` | Storage provider factory |
| `lib/documents/documentService.ts` | Main document service |
| `lib/documents/index.ts` | Public API exports |
| `app/api/documents/route.ts` | List and upload API |
| `app/api/documents/[id]/route.ts` | Get, update, delete API |
| `app/api/documents/download/route.ts` | Signed URL file serving |
| `components/documents/DocumentUploadDropzone.tsx` | Drag-and-drop upload |
| `components/documents/DocumentList.tsx` | Document list with preview |
| `components/documents/DocumentBadge.tsx` | Document count badge |
| `app/dashboard/documents/page.tsx` | Documents Library page |

**Schema Additions:**
- `Document` model (metadata storage)
- `DocumentLink` model (polymorphic entity linking)
- `StorageProviderConfig` model (per-user storage config)
- `DocumentCategory` enum (11 categories)
- `StorageProviderType` enum (MONITRAX, GOOGLE_DRIVE)
- `LinkedEntityType` enum (9 entity types)

**Files Modified:**
- `prisma/schema.prisma` - Added Phase 19 models and enums
- `components/DashboardLayout.tsx` - Added Documents navigation

**Features:**
- Document upload with drag-and-drop
- Category and tag management
- Search and filter documents
- Preview PDFs and images in-app
- Signed URLs with 5-minute expiry
- Storage provider abstraction (ready for S3/Google Drive)
- Documents Library dashboard page

---

### Phase 17: Personal CFO Engine ✅
**Commit:** `b607df4`, `d5b74b1`
**Date:** 2025-11-30

**Files Created:**
| File | Purpose |
|------|---------|
| `lib/cfo/types.ts` | Core type definitions (40+ types) |
| `lib/cfo/scoreCalculator.ts` | CFO Score calculation engine |
| `lib/cfo/riskRadar.ts` | Risk detection service |
| `lib/cfo/actionEngine.ts` | Action prioritisation engine |
| `lib/cfo/intelligenceEngine.ts` | Main orchestrator |
| `lib/cfo/index.ts` | Public API exports |
| `app/api/cfo/route.ts` | REST API endpoint |
| `app/dashboard/cfo/page.tsx` | Dashboard UI |

**Files Modified:**
- `components/DashboardLayout.tsx` - Added Personal CFO navigation item

**Features:**
- CFO Score (0-100) with 6 weighted components
- Risk Radar detecting 10+ risk types
- Action Prioritisation Engine (4 priority levels)
- CFO Dashboard with visualizations
- Monthly progress tracking
- Quick stats cards

**Bug Fixes:**
- Replaced `uuid` package with `crypto.randomUUID()` to fix TypeScript type errors

---

### Phase 16: Reporting & Integrations Suite ✅
**Commits:** Multiple commits in session
**Date:** 2025-11-30

**Files Created:**
| File | Purpose |
|------|---------|
| `lib/reports/types.ts` | Report type definitions |
| `lib/reports/contextBuilder.ts` | GRDCS-based data fetcher |
| `lib/reports/generators/index.ts` | Generator orchestrator |
| `lib/reports/generators/financialOverview.ts` | Financial overview report |
| `lib/reports/generators/incomeExpense.ts` | Income/expense report |
| `lib/reports/generators/loanDebt.ts` | Loan/debt report |
| `lib/reports/generators/propertyPortfolio.ts` | Property portfolio report |
| `lib/reports/generators/investment.ts` | Investment report |
| `lib/reports/generators/taxTime.ts` | Tax-time report |
| `lib/reports/exporters/csv.ts` | CSV exporter |
| `lib/reports/exporters/json.ts` | JSON exporter |
| `lib/reports/exporters/xlsx.ts` | Excel exporter |
| `lib/reports/exporters/index.ts` | Exporter orchestrator |
| `lib/reports/index.ts` | Public API |
| `app/api/reports/route.ts` | REST API endpoint |
| `app/dashboard/reports/page.tsx` | Reports dashboard UI |

**Files Modified:**
- `components/DashboardLayout.tsx` - Added Reports navigation item
- `package.json` - Added xlsx dependency

**Bug Fixes:**
- Fixed Prisma schema field name mismatches in `contextBuilder.ts`:
  - Loan: `principal`, `interestRateAnnual`, `minRepayment`, `termMonthsRemaining`
  - Account: `currentBalance`
  - Property: `income` relation
  - InvestmentHolding: `ticker`, `averagePrice`
  - Income: `name`, `type`
  - Expense: `name`, `isTaxDeductible`

---

### SP-PROP-001: Property Module Support Pack ✅
**Commit:** `bdce8cf` (merge)
**Date:** 2025-11-30

**Merged from branch:** `claude/sp-prop-001-01Y1tCB7457LqYNMe3hwg1Jk`

**Files Modified:**
- `app/dashboard/properties/[id]/depreciation/page.tsx` - Enhanced with StatCards, remaining years
- `app/dashboard/properties/page.tsx` - Added linked metrics badges

**Files Added:**
- `docs/supportpack/# SP-PROP-001 — Property Module Support Pack v1`
- `docs/supportpack/monitrax_support_pack_framework.md`

**Features:**
- Depreciation page StatCards
- Remaining years/value calculations
- Breadcrumb navigation
- Properties list with linked metrics badges

---

## Previous Changes

### Phase 11: AI Strategy Engine
- Strategy recommendation system
- Multi-horizon forecasting
- Conflict resolution
- Entity-level strategy tabs

### Phase 14: Cashflow Optimisation Engine
- Cashflow forecasting
- Insight generator
- Stress testing
- Optimisation algorithms

### Phase 13: Transactional Intelligence Engine
- Unified transaction records
- Category inference
- Recurring payment detection
- Behavioural profiling

### Phase 12: Financial Health Engine
- Health score calculation
- Category scoring
- Risk modelling
- Aggregate health reports

### Phase 10: Authentication & Security
- MFA support (TOTP, SMS, WebAuthn)
- Passkey credentials
- Session management
- Audit logging
- Rate limiting

---

## Branch History

| Branch | Purpose | Status |
|--------|---------|--------|
| `claude/continue-ai-strategy-engine-01Y1tCB7457LqYNMe3hwg1Jk` | Main development | Active |
| `claude/sp-prop-001-01Y1tCB7457LqYNMe3hwg1Jk` | SP-PROP-001 Support Pack | Merged |

---

## Prisma Schema Notes

### Correct Field Names (as of 2025-11-30)

**Loan Model:**
- `principal` (not `currentBalance`)
- `interestRateAnnual` (not `interestRate`)
- `minRepayment` (not `monthlyRepayment`)
- `termMonthsRemaining` (not `remainingTerm`)
- No `lender` field

**Account Model:**
- `currentBalance` (not `balance`)

**Income Model:**
- `name` (not `source`)
- `type` (not `category`)

**Expense Model:**
- `name` (not `description`)
- `isTaxDeductible` (not `isDeductible`)

**InvestmentHolding Model:**
- `ticker` (not `symbol`)
- `averagePrice` (not `averageCost`)
- No `currentPrice` field
- No `name` field

**Property Relations:**
- `income` (not `incomes`)

---

## Technical Guidelines

### UUID Generation
Use `crypto.randomUUID()` instead of the `uuid` package to avoid TypeScript type declaration issues.

### API Authentication
All API routes must verify the Bearer token using `verifyToken()` from `@/lib/auth`.

### Navigation Updates
When adding new dashboard pages, update `components/DashboardLayout.tsx`:
1. Import the icon from `lucide-react`
2. Add to `navItems` array with `{ name, href, icon }`

---

## Deployment

**Platform:** Render (backend) + Vercel (frontend)
**Database:** PostgreSQL on Render
**ORM:** Prisma

**Build Command:** `npm run build`
**Start Command:** `npm run start`

---

## Archived from IMPLEMENTATION_PLAN.md preamble (relocated 2026-06-15, Phase 2 PR-C / finding F-8)

> These chronological session-summary paragraphs ("Last updated" + "Earlier (…)") previously sat at the
> top of `docs/IMPLEMENTATION_PLAN.md`. They are historical (duplicated by Recently Completed + the daily
> `CHANGELOG_*.md` files) and were moved here per CLAUDE.md §15.6 to keep the plan hub small + connector-writable.

**Last updated:** 2026-06-14 (continuity system Phase 0+1 — STATE.md + SYSTEM_MAP.md + session-start hook + continuity-gate.yml live on main; this PR reconciles the stale header date per finding F-1, flips the §0·WI Q-DEC checkboxes to done per finding F-2, and logs the deep-ingestion completion below). Earlier 2026-05-20 (Day 3 — prod-stability firefight + live-monitoring tooling) — Reza + Claude (**Two distinct prod DB failure modes diagnosed + fixed, onboarding mode-selector shipped, agent live-log tooling built, CLAUDE.md Part 17 added.** A long debugging session that started with Reza reporting intermittent `/api/health` 500s + admin-login failures + chat-onboarding "network error". **Issue 1 — onboarding mode toggle invisible:** the pill toggle between form + chat modes was too small; users defaulted to form without seeing the chat option. **PR #818** shipped `OnboardingModeSelector` — a deliberate two-card landing screen (Phase 12 Track E.2c) shown when the flag is ON + no `?mode=` param + no draft progress. Bypassed for flag-OFF (byte-for-byte unchanged) and for users mid-draft (land where they left off). **Issue 2 — Cloud SQL TLS handshake (`ssl/tls alert bad certificate`, alert 42):** intermittent ~10% failure rate on `/api/health` and any Prisma call through the WIF Cloud SQL Connector. Ruled out all 3 documented causes (`cloudsql.iam_authentication` flag ON ✓, SA registered as IAM service-account user ✓, `CLOUD_SQL_CONNECTION_NAME` correct ✓, `CLOUD_SQL_DB_USER` correct ✓). Root cause = **Cause #5, newly documented**: the Cloud SQL Connector caches the ephemeral client cert; when Cloud SQL rotates the instance cert (periodic Google-side op), warm Vercel instances holding pre-rotation cached certs fail TLS until recycled. **PR #819** shipped `callWithTlsRetry()` in `lib/db.ts` — on TLS handshake error, invalidate the cached Prisma client + pool, retry once with a freshly-minted cert. Single-shot; safe because TLS handshake precedes any SQL. Updated `04_WIF_TROUBLESHOOTING.md §3.G` with Cause #5; closed IMPLEMENTATION_PLAN §6b queued workstream. **Issue 3 — Postgres error 53300 (`remaining connection slots are reserved`):** emerged mid-session — connection-pool exhaustion. ~10 warm Vercel instances × 5-conn pool each = ~50 holders exceeded `db-g1-small`'s default `max_connections`. **Fixes:** (a) Reza raised Cloud SQL `max_connections` 25 → 200; (b) Reza set Vercel env `CLOUD_SQL_POOL_MAX=2`; (c) **PR #820** lowered the code default 5 → 2 so the safe value can't regress on a fresh env. **Agent live-log tooling:** the screenshot-back-and-forth debugging pattern was painful — built direct Vercel log access. **PR #821** added `.mcp.json` for the official Vercel MCP server — but discovered the MCP OAuth flow fails from Claude Code Web sandboxes (`403 Host not in allowlist` — Vercel-side restriction, works in Claude.ai chat but not Code Web). **PR #822** shipped the working alternative: `scripts/vercel-logs.sh` — direct Vercel REST API access via `VERCEL_TOKEN` Bearer auth (no OAuth, no host restriction). Commands: `list` / `build` / `runtime` / `latest-runtime` / `project`. Verified end-to-end from a fresh session. Runbook `12_CLAUDE_CODE_MCP_SETUP.md` rewritten to document all 3 paths (REST API ✅ working / MCP ⊘ blocked / GCP Cloud Logging log drain 📋 queued). **PR #823** added **CLAUDE.md Part 17 — Live Production Monitoring Discipline** (mandatory): session-startup Vercel access check, post-merge log verification (NON-NEGOTIABLE), active-debugging "logs first" discipline, PR-subscription protocol. Protocol Version bumped 1.9 → 2.0. **Operational/config changes this session (Reza-side):** Cloud SQL `max_connections` 25→200; Vercel env `CLOUD_SQL_POOL_MAX=2` + `VERCEL_TOKEN` added; Claude Code Web cloud-environment Network access `Trusted`→`Full`; Anthropic spend cap confirmed at `console.anthropic.com`. **Pending:** PR #823 merge; onboarding mode-selector returning-user experience (mid-draft users still see the small toggle — design decision pending: leave / enlarge toggle / show reframed selector with "continue where you left off"). **Earlier in the day: PR #780** had auto-seeded feature flags via `vercel-build` — the `CONVERSATIONAL_ONBOARDING` flag is now live + toggled ON in prod.)

**Earlier (2026-05-19, Day 2 — opens with PR 3c.2e confidence indicators on derived metrics → closes the final §6A.1 row; data-source hygiene story now 6/6 ✅ COMPLETE).** **Yesterday (2026-05-18, sessions 13–31)**: 20 PRs across the day, ~6,200 LOC, 19 backlog rows closed, 1 production hotfix (auth-header sweep), 3 transient build failures caught + autofixed in-PR. Doc-sync discipline now enforced — every PR includes the §16.5 doc-sync block + CHANGELOG session entry in the same PR. Sequence: **PR #783** (PR A — quick wins): hard-deleted soft-deprecated auth routes + `components/onboarding/linear/` directory (Tech Debt #2 + #10) + built the previously-stub `<CreateFlagModal>` (Tech Debt #19). **PR #784** (PR B1 — Phase 42 PR 6.5d): new `lib/bookkeeping/engagement/anomalyNarrator.ts` — Claude Haiku 4.5 narration of top-5 recent anomalies via the existing Phase 33g.2 client, CDR-safe input shape (merchant + flag + amount + relative date label only), graceful fallback to deterministic mapper when AI unconfigured or call fails. Up Next row 51 closed. *One transient build fix mid-PR (signature mismatch on `generateAnthropicCompletion` — system not systemPrompt, key 'HAIKU' not model id), caught + fixed via subscription within 4 min.* **PR #785** (PR B2 — Phase 42 PR 5.6): `<VendorCardDrawer>` (right-edge slide-in / bottom-sheet, two-step merchant→vendor→full-card resolve, reuses existing PR6 `<CancelSubscriptionLink>`) + `<TaxPackExportButton>` on `/dashboard/reports` (FY picker + format picker + fetch-blob-anchor download) + extended `/api/bookkeeping/vendors` with `?merchantStandardised=` lookup. Wired entry point into `TransactionLinkDialog`. Up Next row 48 closed. **PR #786** (PR B3 — Phase 42 PR 4.5): extended `/api/bank/import` with `dryRun` form-data flag (early-returns after `detectDuplicates()` with statistics + sample, before writes); new `dryrun` step in `ImportWizard` (3 stat tiles — New / Exact / Fuzzy — + scrollable sample list + duplicate-policy picker + per-policy commit count). Up Next row 46 closed. *One transient build fix mid-PR (assumed wrong `detectDuplicates` return shape — the codebase has two functions with that name in `lib/bank/`; the route uses `DuplicateDetectionResult`, not `BatchDuplicateResult`), caught + fixed via subscription. Lesson: trace import chain before assuming return shape.* **PR #787** (PR B4 — Phase 42 PR 2.5): `<TransactionSplitEditor>` as 4th tab in `TransactionLinkDialog` — hydrates existing splits, 2-N rows with live sum validation + delta tile, lazy-seeded categories via level1/2/sub triple, saves to existing PR #698 backend. Up Next row 44 closed. *Clean ship — applied lesson from B3 by tracing the splits import chain explicitly first.* **PR #788** (PR C — architectural hygiene, Tech Debt #7): scripted barrel-audit sweep across all 56 `lib/*/index.ts` barrels; found 6 risky server-only re-exports across 3 barrels (`lib/admin/index.ts`, `lib/auth/index.ts`, `lib/cfo/decisionSupport/index.ts`); removed all 6 + added header comments documenting why; zero bare-barrel consumers in grep so no caller migration needed. Pattern fix prevents the WIF-Phase-8-class bug where `export * from './<server-only>'` silently pulls Prisma + Cloud SQL Connector into client bundles via any client component touching the barrel. **PR #789** (PR D — Phase 32B PR3 polish item ③, richer client-book table): `app/portal/clients/page.tsx` fetches `GET /api/portal/clients?organizationId=…` in parallel with the granular list and feeds a `Map<id, ClientAggregateRow>` to `<ClientList>`. 3 conditional columns added between Consent and Assigned To: **TRAIL** (5-stage pill), **Health** (score + delta indicator), **Alerts** (count pill). Aggregate-only privacy (§13.3). Closes the §6b polish backlog. **PR #790** (PR E — Phase 42 PR5.5, PDF summary + receipt ZIP bundle): `lib/bookkeeping/taxPack/pdfExporter.ts` (pdfkit-based, 6-section A4 PDF) + `lib/bookkeeping/taxPack/zipBundleBuilder.ts` (jszip-based, foldered by category, MANIFEST.txt included). §12.7 win: dropped originally-planned `archiver` dep — reused already-installed `jszip` matching `/api/documents/export` pattern. One new prod dep (`pdfkit`) instead of two. Tax Pack export route + `<TaxPackExportButton />` extended to handle PDF + ZIP (PDF set as default — most natural user-to-accountant artefact). Up Next row #47 closed. Phase 42 follow-up backlog now empty. **PR #791** (PR F — Phase 12 PR 3c.1 visibility slice): `<DataSourceChip>` + `<StaleBalanceNudge>` + wired into `/dashboard/balances`. §6A.1 items #1 + #2 of `PHASE_12_WIZARD_REDESIGN_PLAN.md` shipped; items #3–#7 reshelved as PR 3c.2. Up Next #7 closed. **PR #792** (PR G — Phase 42 PR3.5.1 forward receipt picker): `<ReceiptCandidatePicker>` modal + `POST /api/bookkeeping/receipts/pick-match` endpoint + new `linkReceiptToTransaction()` SSOT helper (both AUTO_LINK + USER_PICK call it now — §12.3 win). Refactor net: -16 LOC in confirm route. Up Next #45 split — PR3.5.1 ✅; PR3.5.2 (reverse) reshelved. **PR #793** (PR H — Phase 12 PR 3c.2a "Upgrade this account" button): new `<UpgradeAccountButton>` renders 2 deep-link CTAs for MANUAL/USER_VERIFIED accounts; renders nothing for BASIQ/IMPORT. Wired into `AccountDetailDialog` Overview tab alongside a "Data source" row showing the canonical `<DataSourceChip>`. §6A.1 item #4 ✅. **PR #794** (PR I — Phase 12 PR 3c.2c balance-write audit): defensive sweep of every `prisma.account.{create, update, upsert}` site. 4 gaps fixed via new SSOT helper `lib/utils/accountBalance.ts` → `balanceWriteFields(source)`. §6A.1 item #6 ✅. **PR #795** (PR J — Phase 12 PR 3c.2d Settings > Data Health): new route + hero + per-bucket sections + Settings landing card. §6A.1 item #7 ✅. **PR #796** (PR K — Phase 12 PR 3c.2b first-visit balance-upgrade migration modal): closes §6A.1 item #5. Additive schema column `UserPreference.dismissedBalanceUpgradeNudge` + migration; new `GET/POST /api/settings/balance-upgrade-nudge` mirrors the reform-banner pattern; new `<BalanceUpgradeNudgeModal>` 3-CTA stack. **Data-source hygiene story now 5/5 §6A.1 items shipped.** **PR #797** (PR L — Basiq-gate audit + BAU runbook + doc sync): 1 Basiq-gate fix in `<StaleBalanceNudge>` + 1 polish in heat-map footer. New canonical BAU runbook `docs/operational/runbooks/10_DATA_SOURCE_HYGIENE.md` (~250 lines, 7 sections covering all 5 surfaces). Doc-sync sweep: `06_BASIQ_INTEGRATION_TOGGLE.md` §2 surface table extended; `00_INDEX.md`; `06_UI_UX_FOUNDATION.md` §15; `MASTER_BLUEPRINT.md` Phase 12 row. **PR #798** (🚨 HOTFIX — 6 fetches missing Authorization header): Reza found that closing the balance-upgrade modal signed him out. Root cause: my modal's POST + 5 other today's fetches + 1 pre-existing `<TaxReformBanner>` shipped without `Authorization: Bearer ${token}` → 401 → `SessionExpiryHandler` (`components/auth/SessionExpiryHandler.tsx:140-164`) interprets ANY 401-without-header as session-gone → logout. 7 fetches fixed in ~30 min. Tech Debt #20 logged for broader audit. Lesson: never assume the wrapped `window.fetch` adds the header. **PR #799** (cosmetic + plan): TRAIL sidebar "L" violet → fuchsia (perceptual asymmetry vs T/R/A/I in dark mode; fuchsia matches `<TrailStagePill>` + `<DataSourceChip>` family — single LIVE colour vocabulary). 3 Up Next rows added for the notification roadmap: #60 Phase 15 mobile push, #61 web push for desktop, #62 email audit. **PR #800** (Tech Debt #20 codebase-wide auth-header sweep): grepped 335 client-side `/api/` fetches; 13 admin sites safe (auto-injection); 10 real fixes across `app/portal/billing/page.tsx` (5), `app/portal/dashboard/page.tsx` (3), `app/portal/requests/[id]/page.tsx` (2). Combined with PR #798's 7 fixes, **spurious-logout class eliminated codebase-wide**. **PR #801** (doc-only email audit): new runbook `11_EMAIL_NOTIFICATIONS_AUDIT.md` (~250 lines). Findings: settings page promises 4 email toggles, backend wires 0 of them. 5 live email-out paths are all transactional (correct). Recommended 5-PR wiring sequence + 4 Open Questions for Reza in §8. Up Next #62 ✅; Up Next #65 NEW (wiring follow-up); Tech Debt #21 NEW (UI-promise gap); Tech Debt #20 ✅ (marker rolled in).

**Earlier (2026-05-17, session 12 — vercel-build hang diagnosed + fixed; end-of-day park) — Reza + Claude (**Production deploy unblocked + Anthropic budget cap confirmed; parking for the night.** PR #780 (auto-seed feature flags) merged earlier today; prod deploy hung in `vercel-build` for 19+ min, retried, hung again. Diagnosed via build log: seed printed `✅ Seed complete` at 20:40:39 but `next build` never started — ts-node process held the event loop open after `prisma.$disconnect()` due to Prisma + Cloud SQL background keepalive timers. Locally/preview the loop drained fine; prod's Cloud SQL connection didn't. Shell `&&` waited indefinitely for ts-node to exit. **Fix PR #781 (this PR's session)**: explicit `process.exit(0)` after `$disconnect()` resolves on the success path; `process.exit(1)` on failure. Mirrors the pattern most seed scripts use when chained in CI. No schema change, no behavioural change to what the seed writes. Both flag rows (BASIQ_INTEGRATION + CONVERSATIONAL_ONBOARDING) were already in prod DB from the hung-but-succeeded seed call — verified visible in admin UI. Independent confirmation this session: Anthropic spend cap set at `console.anthropic.com` (Up Next #20 closed; still needs workspace-match verification — key is in Default workspace). New Tech Debt logged: #19 the admin `+Create Flag` button is a stub (`setShowModal(true)` wired without rendered modal); not blocking — canonical flag-creation path is now the seed file + auto-deploy. **Pending overnight:** PR #781 merge + deploy completion. **Pending tomorrow:** Cloud SQL TLS handshake issue (admin login at runtime — separate from build-time DB connection which works fine; needs WIF runbook Step 1 + Step 3 verification — `CLOUD_SQL_CONNECTION_NAME` env + project-level IAM `roles/cloudsql.instanceUser` on the SA).)

**Earlier (2026-05-17, session 11 — feature-flag seed auto-runs on every Vercel deploy):** Reza + Claude (**Deploy-pipeline hardening: `vercel-build` now runs `npm run seed:feature-flags` between `prisma generate` and `next build`.** Reza directive: *"if you can seed the file do it rather than me creating the flag. possible?"* — diagnosed that `CONVERSATIONAL_ONBOARDING` flag row never appeared in `/admin/feature-flags` because the seed never ran on prod, AND the admin UI `+Create Flag` button is currently a stub (`setShowModal(true)` wired but no modal component rendered — separate tech debt). Auto-seed via the build pipeline structurally fixes both: any flag row added to `prisma/seed-feature-flags.ts` now auto-appears in the admin UI on the next deploy with zero operator intervention. Seed is idempotent (`upsert` keyed on `key`), narrow-scope (single table — `GlobalFeatureFlag`), and NEVER overwrites the operator-controlled `enabled` column (only `name` + `description` refreshed on re-seed). Build aborts on seed failure → prod keeps running on old code (same fail-closed posture as `prisma migrate deploy`). Doc-sync (§16.3 "Deployment / build pipeline change" row): `docs/operational/deployment/02_VERCEL_DEPLOYMENT.md` Build Process + step 4 narrative + BANNED list clarified (generic `prisma db seed` STILL banned; narrow-scope idempotent `seed:feature-flags` explicitly distinguished), `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` §6.1 pipeline bullets updated. Tech debt logged: build the missing `<CreateFlagModal>` component so operators can also create flags ad-hoc without a deploy.)

**Earlier (2026-05-17, session 10 — Smart Welcome hydration polish):** Reza + Claude (**Phase 12 Track E — Smart Welcome hydration polish shipping.** Reza directive: *"778 merged, continue also flip the flag so I can test and check"*. After Track E chat chain completed (#778 merged), this PR adds smart Welcome hydration: when the final chat topic (income-expenses) confirms, the orchestrator derives Welcome (step 0) field defaults from the data chat already collected, then writes them into the draft alongside income/expenses. Form-mode review now pre-fills end-to-end. Hydration rules: profileType (HOME+investments→MIXED; investments-only→INVESTOR; HOME-only→HOMEOWNER; otherwise→STARTER); housing (HOME+RENT→BOTH; HOME→OWN; RENT-only→RENT); country='AU'; taxYear=current year; hasInvestments (YES if investments/super non-empty); debtCategories (de-duped from staged debts). All rules CONSERVATIVE — only fills nulls, never overwrites. New helper `applyWelcomeHydration()` in ConversationalSetup.tsx; called once in the income-expenses confirm branch. **Flag-flip instructions provided to Reza for live testing:** (1) `npm run seed:feature-flags` if row missing, (2) `/admin/feature-flags` → toggle CONVERSATIONAL_ONBOARDING ON, (3) ensure ANTHROPIC_API_KEY set in Vercel env (else chat returns 503). tsc clean. No schema migrations. No CDR posture change.)

**Earlier (2026-05-17, session 9 — build PR #8: Income-Expenses topic — CHAT CHAIN COMPLETE):** Reza + Claude (**Phase 12 Track E — eighth + FINAL chat topic shipped (PR #778, merged).** Reza directive: *"777 is merged continue"*. PR #8 ships **Income-Expenses** — the most structurally complex topic (two collections in one topic; income + expense rows each requiring name + type/category + amount + frequency + salaryType for SALARY). Chat chain is NOW END-TO-END: Household → Properties → Debts → Accounts → Investments → Super → Assets → **Income-Expenses** → form mode at currentStep=10 (review step pre-filled). Schema: `incomeExpensesStateDeltaSchema` with both `incomes` (max 15) + `expenses` (max 30) collections + `hasIncome`/`hasExpenses` sentinels. `incomeDeltaSchema` (`{ name, type? SALARY/RENT/RENTAL/INVESTMENT/OTHER, amount?, frequency? WEEKLY/FORTNIGHTLY/MONTHLY/QUARTERLY/ANNUAL, salaryType? GROSS/NET }`). `expenseDeltaSchema` (`{ name, category? 19-value AU enum, amount?, frequency? }`). System prompt is the longest of the lot (~120 lines): **frequency extraction rule** (LLM extracts user's stated frequency, NEVER normalises to monthly; "$80k a year" → ANNUAL; default ANNUAL when unit silent because Aussies say "$80k" meaning per-year by default); **income type AU mapping** (salary/PAYG → SALARY; rental → RENT; dividends/franking → INVESTMENT; ABN/Centrelink → OTHER); **salary GROSS/NET extraction** (gross/before-tax → GROSS; net/take-home/after-tax → NET; silent → OMIT, orchestrator defaults GROSS); **complete 19-category expense mapping** (Woolworths/Coles → GROCERIES; fuel/Opal/Myki → TRANSPORT; Netflix/Spotify/gym → SUBSCRIPTION; strata/body-corp → STRATA; etc.); **AFSL-adjacent prohibitions** (no budgeting advice / no spending commentary / no "cut back" suggestions). New state machine `incomeExpensesScript.ts` (~450 lines): TWO-PHASE machine — Phase 1 incomes (INTRO → ASKING_INCOME_OWNERSHIP → per-incomplete TYPE/AMOUNT/FREQUENCY → ASKING_MORE → TRANSITIONING_TO_EXPENSES) → Phase 2 expenses (ASKING_EXPENSE_OWNERSHIP → per-incomplete CATEGORY/AMOUNT/FREQUENCY → ASKING_MORE → RECAP). 2-retry loop-break per step with force-advance defaults. Helper functions `advanceIncomePhase` + `advanceExpensePhase`. Orchestrator extended to 8 topics: `chatTopic` union grows; `TOPIC_CHAIN` appends 'income-expenses'; new state slot; 8-way switches. **`AFTER_CHAT_FORM_STEP_INDEX` flipped 9 → 10 (review step)** — chat now covers every data-collection step; form opens at review pre-filled. Handoff defaults applied: income missing fields → `type: OTHER`, `amount: 0`, `frequency: ANNUAL`, `salaryType: GROSS` (SALARY only); expense missing fields → `category: OTHER`, `amount: 0`, `frequency: MONTHLY`. Recap card uniquely formats both collections in one card. **Track E chat chain is structurally complete — all 8 topics covering all 8 data-collection wizard steps (0 Welcome + 2 Entities still skipped, defaulted).** tsc clean. No schema migrations. No CDR posture change. Flag still default OFF. Status flips to 🟢 STAGE 1 COMPLETE pending PR #8 merge.)

**Earlier (2026-05-17, session 8 — build PR #7: Investments topic — chat chain extended to 7 topics):** Reza + Claude (**Phase 12 Track E — seventh chat topic shipped (PR #777, merged).** Reza directive: *"776 merged continue"*. PR #7 ships **Investments** (non-super listed investments). Chain now Household → Properties → Debts → Accounts → **Investments** → Super → Assets → form mode at currentStep=9 (income-expenses — final chat-skipped step). Schema: `investmentsStateDeltaSchema` (`{ name (required), type? (BROKERAGE/FUND/TRUST/ETF_CRYPTO), totalValue? }` per account, max 10; `hasInvestments` sentinel; SUPERS deliberately excluded — owned by Super topic). System prompt: `INVESTMENTS_SYSTEM_PROMPT` with AU broker/platform vocabulary (CommSec/Pearler/Stake → BROKERAGE; Vanguard/Magellan/Platinum managed → FUND; family/unit trusts + LITs → TRUST; ETFs + crypto → ETF_CRYPTO); explicit scope-boundary redirecting super/property/cash/personal-assets to their topics; prohibition on portfolio commentary / asset-allocation / market-timing / broker-switch. New script `investmentsScript.ts` (same shape as `assetsScript.ts` — INTRO → ASKING_OWNERSHIP → per-incomplete INVESTMENT_TYPE → INVESTMENT_VALUE → ASKING_MORE → RECAP; 2-retry loop-break; positional-merge). Orchestrator extended to 7 topics: chatTopic union grows; TOPIC_CHAIN inserts 'investments' BETWEEN 'accounts' and 'super' (matches form-wizard order — partial-resume back to form mode preserves user mental model); new state slot `investmentsScript`; 7-way switches. **AFTER_CHAT_FORM_STEP_INDEX flipped 6 → 9** — with investments now in chat, first chat-skipped step is income-expenses. currentStepFor: investments → 6. Handoff defaults: chat's `totalValue` → WizardData `cashBalance` + empty `holdings[]` (form mode handles per-holding drill-in — needs broker statement). Gateway + API routes extended. tsc clean. No schema migrations. No CDR posture change.)

**Earlier (2026-05-17, session 7 — build PR #6: Super + Assets topics — chat chain extended to 6 topics):** Reza + Claude (**Phase 12 Track E — fifth + sixth chat topics shipped (PR #776, merged).** Reza directive: *"Continue"* after #775 merged. PR #6 ships **Super** + **Assets** topics, extending the chain: Household → Properties → Debts → Accounts → **Super → Assets** → form-mode handoff at currentStep=6 (investments — first chat-skipped step). Schema additions: `superStateDeltaSchema` (`{ fundName, currentBalance? }` per fund, max 10; `hasSuper` sentinel) + `assetsStateDeltaSchema` (`{ name, type? (VEHICLE/ELECTRONICS/FURNITURE/EQUIPMENT/COLLECTIBLE/OTHER), currentValue? }` per asset, max 15; `hasAssets` sentinel; system-prompt scope-boundary — assets means PERSONAL items only, NOT property/cash/super/listed-investments). System prompts: `SUPER_SYSTEM_PROMPT` (AU fund vocabulary — AustralianSuper / Hostplus / REST / HESTA / ART / UniSuper / Cbus / ESSSuper / SMSF mapping; no fund-comparison / no fee or return commentary / no switch suggestions) + `ASSETS_SYSTEM_PROMPT` (type mapping — car/ute/motorbike→VEHICLE; laptop/phone→ELECTRONICS; furniture; tools→EQUIPMENT; watch/art/jewellery→COLLECTIBLE; no comment on value/insurance/depreciation/sell-or-keep). New script files: `superScript.ts` (INTRO → ASKING_OWNERSHIP → ASKING_BALANCE per incomplete fund → ASKING_MORE → RECAP; just two fields per fund, no separate TYPE step) + `assetsScript.ts` (INTRO → ASKING_OWNERSHIP → per-incomplete ASSET_TYPE → ASSET_VALUE → ASKING_MORE → RECAP). Both 2-retry loop-break + positional-merge. Orchestrator: chatTopic union expanded to 6; TOPIC_CHAIN extended; 2 new state slots; 6-way switches everywhere (handleSubmit / handleConfirm / recapRows / recapHeader / showRecap / handleChange / currentStepFor / headerForTopic / bootstrap dispatch / setter dispatch). `AFTER_ACCOUNTS_FORM_STEP_INDEX` renamed `AFTER_CHAT_FORM_STEP_INDEX` (same value 6 — semantically clearer; it's the post-chat redirect target). Field defaults on confirm: super sets `name = fundName` for WizardData (form mode can rename); assets default `purchasePrice = currentValue`. Gateway + API routes extended to accept `super` + `assets`. Hard rules verified: no Prisma writes in agent code (grep); numbers from user only (Zod + system prompts); AFSL boundary structural (system prompts forbid fund-comparison / switch / sell-or-keep commentary). tsc clean. No schema migrations. No CDR posture change. Flag still default OFF.)

**Earlier (2026-05-17, session 6 — build PR #5: Debts + Accounts topics — chat chain extended to 4 topics):** Reza + Claude (**Phase 12 Track E — third + fourth chat topics shipped (PR #775, merged).** Reza directive: *"continue, also make sure all changes are documented as well"* — emphasised explicit doc-sync. PR #5 ships **Debts** + **Accounts** topics, extending the chain: Household → Properties → **Debts → Accounts** → form-mode handoff at currentStep=6 (investments step). Schema additions to `wizardStateDelta.ts`: `debtsStateDeltaSchema` (`{ name, type? (CAR/PERSONAL/STUDENT/BUSINESS), principal?, isHecsHelp? }` per debt, max 15; `hasDebts` sentinel; scope-boundary: property mortgages stay on Properties topic, credit cards stay on Accounts topic) + `accountsStateDeltaSchema` (`{ name, type? (OFFSET/SAVINGS/TRANSACTIONAL/CREDIT_CARD), currentBalance? }` per account, max 15; `hasAccounts` sentinel; signed-balance for credit cards — negative = debt owed). System prompts: `DEBTS_SYSTEM_PROMPT` (HECS/HELP→STUDENT with isHecsHelp:true; car/auto-loan→CAR; AfterPay/BNPL→PERSONAL; explicit scope-boundary; no advice / no payoff-strategy commentary) + `ACCOUNTS_SYSTEM_PROMPT` (AU big-four bank vocabulary; explicit "credit card debt is negative" sign convention; no bank-comparison commentary). New script files: `debtsScript.ts` + `accountsScript.ts` — same state-machine pattern as `propertiesScript.ts` (ASKING_OWNERSHIP → per-item TYPE → AMOUNT → ASKING_MORE → RECAP, 2-retry loop-break, positional-merge trust). Gateway refactor: `resolveTopicTools()` switch helper + `formatStagedSubset()` switch (replace previous if/else pairs) — adding a topic is now one branch per helper + one Zod union member + one prompt/tool pair. API routes (`extract` + `topic-confirmed`) accept all 4 topics. Orchestrator (`ConversationalSetup.tsx`) extended for 4 topics: per-topic script slots, `TOPIC_CHAIN` constant + `nextTopicAfter()` helper drives pivots; `handleSubmit` 4-way switch (each branch ~30 lines); `handleConfirm` saves staged data + pivots to next topic OR (if last) redirects to form-mode at currentStep=6. `currentStepFor()` helper maps topic → wizard step index for `saveDraft`. **Scope decision documented**: Properties' previous final-redirect to step 4 (PR #774) is now replaced by Properties → pivot-to-Debts; the user's chat journey now covers 4 consecutive form-wizard steps before handing off. Field defaults on `handleConfirm`: debts default `interestRateAnnual:0`, `minRepayment:0`, `repaymentFrequency:'MONTHLY'`; accounts default `source:'MANUAL'`. Hard rules verified: no Prisma writes in agent code (grep), numbers from user only (Zod + system prompts), AFSL boundary structural (one extraction tool per topic, no advice surface; debts prompt explicitly forbids consolidation/refinance suggestions; accounts prompt forbids bank-switch suggestions). tsc clean. No schema migrations. No CDR posture change. Flag default OFF throughout.)

**Earlier (2026-05-17, session 5 — build PR #4: Properties topic — Household → Properties chain):** Reza + Claude (**Phase 12 Track E — second chat topic shipped (PR #774, merged).** Reza directive: *"continue"* after #773 merged. PR #4 ships **Properties** as the second chat topic, chaining off Household → Properties → form-mode handoff at debts step (currentStep=4). New: `lib/ai/onboarding-agent/schemas/wizardStateDelta.ts` extends the discriminated union with `propertiesStateDeltaSchema` (`{ name, type?, currentValue?, hasLoan? }` per property, max 10; `ownsProperty` sentinel); `lib/ai/onboarding-agent/tools/extractWizardStepDelta.ts` adds `PROPERTIES_SYSTEM_PROMPT` (AU vocabulary mapping — HOME/PPOR → HOME; investment/IP/rental → INVESTMENT; number normalisation 850k/1.2m/$850,000 → integer AUD; positional-merge rule; no advice / no market commentary); `components/onboarding/wizard-chat/propertiesScript.ts` (state machine: INTRO → ASKING_OWNERSHIP → per-property TYPE/VALUE/LOAN → ASKING_MORE → RECAP, 2-retry loop-break). Edits: `ConversationalSetup.tsx` refactored to be topic-aware (`chatTopic`, per-topic script states, routed `handleSubmit` + `handleConfirm`; Household-confirm now PIVOTS to Properties instead of redirecting; Properties-confirm saves merged WizardData + redirects to form-mode at currentStep=4; `historicalRecaps` keyed by topic); gateway + API extract route + topic-confirmed route extended to accept `properties`. **Chat captures per property (bare minimum):** name, type, currentValue, hasLoan. **Deferred to form mode:** address, purchasePrice, purchaseDate / acquisitionContractDate (Phase 41E reform — date picker safer), isNewBuild + newBuildEvidence (compliance-sensitive), loan details / rental income / expenses. Hard rules verified: no Prisma writes in agent code (grep), numbers from user only (Zod + system prompt), AFSL boundary structural (one extraction tool, no advice surface). tsc clean. Flag stays default OFF.)

**Earlier (2026-05-17, session 4 — build PR #3: E.2b motion polish):** Reza + Claude (**Phase 12 Track E.2b — "presence, not persona" visual identity shipped (PR #773, merged).** Reza directive: *"Continue"* — after PR #771 (Household vertical slice) merged. PR ships 3 new files + 4 component edits + 2 doc-sync pointers. New: `components/onboarding/wizard-chat/design/motionTokens.ts` (canonical SSOT for ~11 named motion tokens + `useReducedMotion()` hook + `jitteredThinkingPauseMs()` helper — hard-coding values elsewhere = code-review reject), `components/onboarding/wizard-chat/primitives/PresenceOrb.tsx` (canonical SVG primitive, 4 states `idle`/`listening`/`thinking`/`settled`, warm-ivory iridescent overlay, reduced-motion → static 4px dot, file-header JSDoc per §16.4), `components/onboarding/wizard-chat/design/presenceOrb.css` (keyframes for the 4 states + defense-in-depth `@media (prefers-reduced-motion: reduce)` killswitch). Edits: `AgentMessage` typewriter render (35 chars/sec word-boundary, ±15% jitter, cursor caret while typing); `ChatThread` anchors single orb to the LATEST agent message (older agent bubbles render plain — one orb = no visual noise), flips orb state on typewriter completion (`thinking → settled → idle`), renders standalone thinking-orb block before the very first agent turn; `TopicRecapCard` staggered field reveal (`RECAP_FIELD_STAGGER_MS` apart) + delayed CTA enable (`RECAP_CTA_DELAY_MS` — prevents reflex-tap-confirm-without-reading); `ConversationalSetup` adds pre-typewriter pause (jittered 600–800ms BEFORE appending agent message — the "I'm reading what you said" beat), tracks `newestAnimatedMessageId` for typewriter targeting, implements full mistake-recovery dim-and-keep trail (snapshots prior recaps into `historicalRecaps[]` on "Change something"; dimmed snapshots render above the active recap as visible audit trail). Doc-sync: `06_UI_UX_FOUNDATION.md` §14 pointer + reuse policy + NO-list pin; `08_BRAND_UI_DESIGN.md` "AI surface visual identity" pointer; Phase doc rev 4 changelog. Deferred to **E.2b.2** (needs schema additions / web-audio wiring): first-encounter persistence + optional notification sound + mic-level → orb-ripple sync. No schema changes. No CDR posture change. Flag stays default OFF — zero behavioural change pre-flip. tsc clean.)

**Earlier (2026-05-17, session 3 — build PR #2):** Reza + Claude (**Phase 12 Track E.0 + E.1 + E.2a-Household + E.3 + E.4 + E.5 — FUNCTIONAL FIRST SLICE shipped (PR #771, merged).** Reza directives 2026-05-17: *"770 is merged let's go and start"* + *"Note we still don't have live users so you can go full steam"* — adjusted scope from "feature-flag-only first PR" → "functional Household vertical slice end-to-end behind the flag". PR ships 19 new files + 4 edits: feature-flag infrastructure (`lib/featureFlags/conversationalOnboardingGate.ts` + `ConversationalOnboardingGateContext.tsx` + `app/api/feature-flags/conversational-onboarding/route.ts` + seed extension + admin PATCH cache-invalidation hook); Anthropic gateway (`lib/ai/onboarding-agent/{gateway.ts, schemas/wizardStateDelta.ts, tools/extractWizardStepDelta.ts}` — closed-discriminant tool with Zod-validated structured output, Haiku 4.5 model, daily cap 200/user via audit-log count); chat API endpoints (`app/api/onboarding/chat/{extract,topic-confirmed}/route.ts` — `withPermission('settings.write')`, sanitised audit metadata field-names-only); chat UI components (`components/onboarding/wizard-chat/{ConversationalSetup, ChatThread, AgentMessage, UserMessage, ChatComposer, TopicRecapCard, householdScript, types}.tsx` — static E.2a shell, no presence orb / typewriter yet — those land in E.2b); Web Speech API voice hook (`hooks/useVoiceInput.ts` — browser-native STT, no audio leaves device, text fallback always); mode toggle (`components/onboarding/ConversationalModeToggle.tsx`); page wiring (`app/onboarding/page.tsx` reads `?mode=chat`, conditionally renders chat vs form). Schema: 3 additive `AuditAction` enum values (`ONBOARDING_AGENT_EXTRACTION` / `_TOPIC_CONFIRMED` / `_MODE_SWITCHED`) + migration `20260517100000_phase_12_track_e_audit_actions`. **Architectural correction in §5.2 of Phase doc**: rev 1 plan named `OnboardingState.chatTranscript` as the persistence target — but `OnboardingState` is a hook return type, NOT a Prisma model. v1 corrects: chat transcript stays client-only; staged WizardData persists via existing `saveDraft()` → `UserPreference.onboardingDraft`. On "Looks right", the orchestrator merges chat-staged household fields into the existing wizard draft + redirects to `/onboarding` (form mode at currentStep=1) — pre-filled. E.2b motion polish + remaining topics queued. Flag default OFF — with flag OFF, `/onboarding` is byte-for-byte the existing form-wizard experience. tsc clean.)

**Earlier (2026-05-17, session 2 — design pass):** Reza + Claude (**Phase 12 Track E — design pass folded into the plan (rev 2), still no code.** Reza directive 2026-05-17 (voice, follow-up): *"make a very good animation, interactive, maybe engaging design… user sees the AI agent as sort of, like, a person… make your judgment."* Architect-mode synthesis (4-lens: financial / behavioural / architect / visual) concluded **presence, not persona**: lift the chat surface with rich micro-motion + warmth + rhythm (presence orb SVG, motion-token SSOT, typewriter cadence, recap-card assembly, first-encounter sequence) but do NOT anthropomorphise (no avatar, no name, no character voice, no emojis). Rationale: financial-adviser lens demands gravitas (Mercury/Stripe/Apple Cash → zero mascots); behavioural-psychologist lens flags **expert-friend confusion** (users transfer trust meant for licensed advice onto a "friend" — AFSL boundary risk); architect lens prefers bounded primitive work over character logic; growth-marketing lens dissent surfaced (persona is more meme-able) but parked for Phase 6 marketing-tone decision, not a chat-avatar decision. Concrete additions to `PHASE_12_CONVERSATIONAL_ONBOARDING.md`: new §4a "Visual & motion design" with seven sub-sections (~17 motion tokens, 4-state presence orb spec, three timing beats, first-encounter sequence, mistake-recovery transparency rule, NO-list pinning load-bearing dissent, reference benchmarks); E.2 split into E.2a (static chat shell — validates data loop) + E.2b (motion + presence orb — layered on once loop works); new risk row E-R11 (Persona drift) — reviewer-reject rule for any future PR that adds avatar/name/character-voice/emojis to the agent; §11 schema row gains `OnboardingState.firstChatEncounterAt` + `UserPreference.chatNotificationSoundEnabled` (off by default); §11.3 files-new gains `PresenceOrb.tsx` + `motionTokens.ts` + `audioTokens.ts`. References: Apple Intelligence + Siri waveform + Linear + Mercury + Notion AI + Stripe — explicitly NOT Cleo / Schwabby / Erica. Build NOT started — plan-only PR rev 2.)

**Earlier (2026-05-17):** Reza + Claude (**Phase 12 Track E — Conversational onboarding plan locked, no code.** Reza directive 2026-05-17 (voice): build a parallel conversational + voice input mode alongside the existing form-based onboarding wizard; agent asks the user in plain English (text or mic), extracts the structured answer, types on the user's behalf, and asks for confirmation; never hallucinate / never generate numbers; do not change or delete the existing wizard. Architect-mode synthesis converged on the **"two front doors, one house"** model: chat-mode is a parallel input modality over Track B's existing data contract — same `OnboardingState`, same `ReviewStep`, same `/api/onboarding/bulk-create`. Form-mode is unchanged. The agent has ONE tool (`extractWizardStepDelta`) and ONE write boundary (the existing `ReviewStep`). Per-topic recap confirmation (not per-field — feels less robotic). Voice via the browser-native Web Speech API for v1 — no audio leaves the device, no new CDR vendor. New Phase doc `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` (12 sections — phase breakdown E.0–E.6, data contract, voice strategy, security/CDR/AFSL boundary, risk register, validation checklist, files-stay/new/never-touched). Parent `PHASE_12_SETUP_AND_ONBOARDING.md` gains a "Related" pointer. New Up Next row 53 (queued). New Open Question `Q-CONV-1` (STT v2 — rec stay on Web Speech API until v1 user feedback shows quality is the blocker; not blocking). No code, no schema, no migration — plan-only PR.)

**Earlier (2026-05-16, session 7):** Reza + Claude (**Phase 41E.5 — final Stage 1 sub-PR open; Phase 41E Stage 1 COMPLETE.** PR #768 (41E.4 form UI) merged. 41E.5 closes Stage 1 with: (a) wizard `PropertiesStep` reform-aware capture — `acquisitionContractDate` + `isNewBuild` prompted ONLY for properties with post-cut-over `purchaseDate` (≥ 2026-05-12T09:30:00Z); pre-cut-over properties auto-backfill `acquisitionContractDate := purchaseDate` server-side (mirrors the 41E.0 migration rule); (b) wizard `EntitiesStep` reform-aware capture — trust-subtype `<select>` (conditional on trust types, defaults DISCRETIONARY for the most common case) + foreign-resident `<checkbox>` (always available, default false); (c) bulk-create API plumbing for the new columns on both LegalEntity + Property creates — same per-type guarding as the entity edit form (trustType only when type is a trust); (d) `tests/tax-engine/divisions/reformActivationRoundTrip.test.ts` — 15 new tests proving the FW-2 wall: every flag false → true → throws → false → UNCOMPUTED reversibility + per-measure flag independence (flipping one doesn't activate others); (e) `docs/architecture/03_DATA_MODEL.md` §O — consolidated reference for every Phase 41E schema addition (Property cols + LegalEntity cols + CompanyTaxHistory model + 2 new Prisma enums + UserPreference banner col + TaxYearConfig per-FY commencement flags); (f) new `docs/operational/UNCOMPUTED_REGISTER.md` — operator playbook for the 10 UC-* codes (where each is emitted, what triggers it, where it surfaces, removal trigger); (g) Phase 41E doc status flipped 🟡 Design → 🟢 STAGE 1 COMPLETE. **Tax-reform infrastructure fully in place; every `commencementVerified` flag remains `false` so zero behavioural change for any user.** Stage 2 (per-measure rule mechanics) + Stage 3 (Royal Assent flips) queued — no urgency until Treasury publishes exposure drafts.)

**Earlier (2026-05-16, session 6):** Reza + Claude (**Phase 41E.4 entity form UI + PropertyTile badge wiring sub-PR open.** PR #767 (41E.3 UI surfaces — badge + banner + entity API) merged. 41E.4 consumes the new surfaces shipped in 41E.3: (a) `PropertyTile` extended with `acquisitionContractDate` + `isNewBuild` fields on `PropertyTileData`; renders `<TaxTreatmentBadge>` inline next to the property-type chip on every tile (so every user sees their per-property regime classification on `/dashboard/properties`). At Stage 1 default (commencement flag false everywhere) every badge reads "Grandfathered" — FW-2 wall preserved at the UI layer. (b) `app/dashboard/properties/page.tsx` passes the new fields through from the Prisma response (no API change needed — `findMany` with `include` already returns all Property columns). (c) `app/dashboard/entities/page.tsx` gets a trust-subtype selector (8-value `TrustType` enum, conditional on `type === DISCRETIONARY_TRUST | UNIT_TRUST`) + foreign-resident toggle (always available, default false). Both pre-populated from `LegalEntitySummary` (service layer extended to surface the columns added by 41E.0's schema migration). Form payload always sends `trustType` (null when not a trust type or unset) + `isForeignResident` (boolean). **Wizard step extensions re-scoped to 41E.5** — clean self-contained chunk that pairs better with docs consolidation than with form-UI work. Remaining Stage 1 sub-PR: 41E.5 (wizard + docs consolidation + UNCOMPUTED register + Phase doc status flips).)

**Earlier (2026-05-16, session 5):** Reza + Claude (**Phase 41E.3 UI surfaces sub-PR open.** PR #766 (41E.2 AI advisor) merged. 41E.3 ships the user-facing surfaces: (a) `<TaxTreatmentBadge>` reusable component — renders the 5 regime variants with tone-coded styling (emerald=Grandfathered / sky=New build / slate=Restricted / amber=Confirm date / amber=Confirm build) — tone choice is behavioural-psychologist-led (slate not red for "restricted" because that's a regime label, not an alarm). (b) `<TaxReformBanner>` calm one-time card on `/dashboard/cfo` — sky-toned, no urgency / no FOMO copy (tests assert this is on record); CTA "Show me my position" deep-links to `/dashboard/cfo/ask?q=…` with the §10.10 prefilled question. Dismissal persists to `UserPreference.dismissedReformBanner` via new `/api/settings/reform-banner` GET/POST endpoint. (c) Schema migration `20260516200000_phase_41e_3_reform_banner_dismissal` — additive `dismissedReformBanner Boolean NOT NULL DEFAULT false` column. (d) Entity API extension — `UpdateEntityInput` gains `trustType` (closed enum) + `isForeignResident` (boolean); PUT `/api/entities/[id]` validates against the 8-value trust-type enum + boolean coercion. 24 new tests across `TaxTreatmentBadge` (regime label rendering + Stage 1 default = Grandfathered + D-2 description-text wall) + `TaxReformBanner` (calm-copy spec on record — no urgency verbs) + `UpdateEntityInput` (type-level enum acceptance). **Form-side wiring on entity detail UI + PropertyTile badge wiring deferred to 41E.4** (same surfaces as onboarding wizard work — natural pairing). Remaining Stage 1 sub-PRs: 41E.4 (onboarding + entity form UI) → 41E.5 (docs consolidation + UNCOMPUTED register).)

**Earlier (2026-05-16, session 4):** Reza + Claude (**Phase 41E.2 AI advisor sub-PR open.** PR #765 (41E.1 engine skeletons) merged. 41E.2 ships the AI surface specced in PHASE_41E §10.10 — Reza directive 2026-05-16: *"The AI advisor should also provide a summary of the law changes and the impact on each individual users, and should provide a realistic suggestions based on the same"*. Three new files: (a) `lib/ai/tax-advisor/knowledge/reform-2026-27.ts` — versioned knowledge pack with `status: 'announced' | 'exposure-draft' | 'bill' | 'assented'` per measure (M1-M3 + M5 + M7-M9 announced, M4 exposure-draft, M6 assented). Single source of truth for AI narration; no other file may hard-code reform status (CLAUDE.md §12.14 FW-4). (b) `getReformedTaxRegimeStatus` (FACT_LOOKUP) — per-property regime classification composing 41E.1's `deriveNegativeGearingRegime` + knowledge-pack citations + plain-English regime labels. (c) `getReformImpactSummaryForUser` (SCENARIO_RUN, the §10.10 surface) — cross-measure summary aggregating per-property regime counts + per-entity trust-type + foreign-resident + per-company carry-back eligibility. Returns 11 `numericFields` (one per impact category) + 9 citations (one per measure) + a calm-framing narrative that opens with "you're already protected" when grandfathering applies + routes to Ask-a-Pro at the end. D-2 enforced — narrative explicitly avoids "you should" / "transfer to" verbs (test asserts this). Registry size 11 → 13 (FACT_LOOKUP × 8 + SCENARIO_RUN × 5). 30 new tests across knowledge-pack shape + ToolResult conformance + D-2 narrative validation. Remaining Stage 1 sub-PRs: 41E.3 (UI surfaces — calm "Tax rules are changing" CFO Guide card + property tax-treatment badge + entity trust-type selector) → 41E.4 (onboarding wizard) → 41E.5 (docs consolidation).)

**Earlier (2026-05-16, session 3):** Reza + Claude (**Phase 41E.1 engine module skeletons sub-PR open.** PR #764 (41E.0 foundation) merged earlier. 41E.1 ships 6 new files under `lib/tax-engine/divisions/`: `negativeGearingRegime.ts` (pure regime classifier — SSOT for "is this property grandfathered?"), `cgtIndexation.ts` (Measure 2 — `UC-CGT-INDEXATION-PENDING-EXPOSURE-DRAFT`), `cgtMinimumRate.ts` (Measure 2 — `UC-CGT-MIN-RATE-PENDING-EXPOSURE-DRAFT`), `trustMinimumTax.ts` (Measure 3 — `UC-TRUST-MIN-TAX-PENDING-EXPOSURE-DRAFT`), `foreignResidentCgt.ts` (Measure 4 — exposure-draft-ready, `UC-FR-CGT-PENDING-ROYAL-ASSENT`), `lossRefundability.ts` (Measure 5 — `UC-LOSS-CARRYBACK-PENDING-BILL`). Each module: scope gates first (entity/asset eligibility), then commencement flag (Stage 1 always false → UNCOMPUTED), defensive `throw` if flag flipped without mechanic (FW-2 wall). Extends `applyNegativeGearing` with optional `regime` parameter (default `PRE_REFORM_GRANDFATHERED` — back-compat byte-for-byte) and `calculateCgtDiscount` with optional `acquisitionContractDate` + `disposalFy` + `config` inputs (when all three present + reform flag true + post-cut-over contract + ≥ FY 2027-28 disposal → returns `discountRate: 0` for caller to route through `cgtIndexation` + `cgtMinimumRate`). 47 new tests covering boundary-day classification at the second, the commencement-gate wall, per-module UNCOMPUTED surfacing, and back-compat for both extended functions. Remaining Stage 1 sub-PRs: 41E.2 (AI advisor) → 41E.3 (UI) → 41E.4 (onboarding wizard) → 41E.5 (tests + docs consolidation).)

**Earlier (2026-05-16, session 2):** Reza + Claude (**Phase 41E.0 foundation sub-PR open — first code work for the reform.** PR #763 (design + AI provider strategy + CLAUDE.md §12.14 governance) merged earlier today. Stage 1 sub-PR sequence started immediately. **41E.0** on `claude/phase-41e-0-foundation-MG8mr` ships: (a) `lib/tax-engine/config/reformConstants.ts` (canonical `REFORM_CUT_OVER_UTC = 2026-05-12T09:30:00Z` + `MEASURE_COMMENCEMENT` per-measure dates + `classifyAcquisitionGrandfathering` + `isPostCommencementFy` helpers; no other file may hard-code the cut-over timestamp per CLAUDE.md §12.14); (b) schema migration `20260516100000_phase_41e_reform_foundation` (additive — `Property` +5 cols incl. indexed `acquisitionContractDate`; `LegalEntity` +2 cols incl. indexed `trustType`; new `CompanyTaxHistory` model for Measure 5 carry-back; new `NewBuildEvidence` + `TrustType` enums; one-time safe backfills for grandfathered properties + DISCRETIONARY_TRUST entities); (c) `TaxYearConfig` interface extension (8 new `*CommencementVerified: boolean` flags + `cpiQuarterlyIndex` placeholder; all `false`/`{}` on 3 existing FY configs); (d) 17 new tests in `tests/tax-engine/config/reformConstants.test.ts` covering boundary-day classification at the second — the grandfathered vs post-reform wall — plus per-measure commencement dates and per-FY post-commencement logic. Also cherry-picks §10.10 doc commit that didn't make #763's merge (timing miss — §10.10 was committed after Reza merged). Zero engine behaviour change. Remaining Stage 1 sub-PRs (41E.1 → 41E.5) queued sequentially.)

**Earlier (2026-05-16):** Reza + Claude (**Phase 41E reform 2026-27 — design doc + AI provider strategy SHIPPED (PR #763, doc-only).** Reza brief 2026-05-13 covered two intertwined requests: (a) research the eight tax-law changes announced in the 12 May 2026 Budget (negative gearing restricted to new builds; 50% CGT discount → indexation + 30% min rate; 30% min tax on discretionary-trust *taxable income*; foreign-resident CGT regime strengthened — exposure draft already published; loss refundability + carry-back + R&DTI; foreign-purchase ban extension; VC incentive caps lifted; EV FBT phased transition; dynamic PAYG instalments) and design how the Monitrax tax engine + AI advisor absorb them; (b) review the AI engine choice (Gemini vs Claude) for the structuring-advice surface ("should I sell my property?", "should I move into a trust?"). This PR ships both as design-only docs grounded in the actual codebase (no calc changes, no schema changes, no code changes — Stage 1 implementation queued behind Reza's go/no-go). **Phase 41E doc** (`docs/blueprint/PHASE_41E_REFORM_2026_27.md`, 9 sections) honours the Phase 41 §9 versioning protocol verbatim — module skeletons ship in Stage 1 returning `UC-*-PENDING-EXPOSURE-DRAFT` or `UC-*-PENDING-ROYAL-ASSENT`; rule mechanics fill in per measure as Treasury text drops; per-measure `commencementVerified` flag flips on Royal Assent (proven pattern from 41e.3 Div 296 — `highIncomeSuperTax.ts`). Honours D-1 (full regulatory scope ships in demo cut — no demo/PROD split), D-2 (AFSL/TPB/NCCP boundary is structural via the tool registry's closed `FACT_LOOKUP | SCENARIO_RUN` discriminant), HR-1 (numbers from the app, never AI memory — validator-enforced), HR-2 (claims from AU law, never AI memory), HR-3 (no user-visible calc errors — silent admin-side via Phase 41i.6). Notes Phase 41e is COMPLETE (41e.0–41e.17), Phase 41h is COMPLETE (41h.0–41h.7), Phase 41f intersects with Measure 3 via `TrustDeedExtractedRules`. **AI provider strategy doc** (`docs/architecture/AI_PROVIDER_STRATEGY.md`, 8 sections, ~300 lines) grounds the Gemini-vs-Claude question in the actual provider architecture: `lib/ai/tax-advisor/providers/types.ts` `AIProvider` interface is already provider-agnostic (JSDoc explicitly enumerates `'gemini' | 'mock' | 'claude'`); adding `ClaudeProvider` is a one-file change (~250 LOC by analogy with `geminiProvider.ts`); the safety boundary is **gateway-enforced** (validators + closed tool-kind discriminant), **not provider-determined** — swapping LLMs does not change the user's safety or the structural answer-shape. Recommendation: **keep Gemini 2.0 Flash as the default** for the main tax-advisor surface; **pilot Claude Haiku 4.5 on the capacity-Q&A branch** (existing Anthropic dep from Phase 33g.2 feedback chat already provides US$50/mo cap pattern); evaluate at Phase 41E Stage 2 trigger + Phase 32C marketplace launch. New open question Q-AI-PROVIDER added. Phase 41E queued in Active Workstreams pending Reza approval to ship Stage 1 (~5-7 days, one PR).)

**Earlier (2026-05-15, evening):** Reza + Claude (**GTM Step 0.1 AFSL-boundary DRAFT shipped — completes the day's third doc-PR.** Document at `docs/marketing/gtm/REVIEW_SCOPE_AND_BOUNDARIES.md` — 11 sections covering Australian Corporations Act §766B general-vs-personal-advice boundary, what the Review CAN say (facts/benchmarks/gaps/TRAIL), what it CANNOT say (specific product / personal tax / personal insurance / personal investment / personal estate recommendations), DO/DON'T cheat-sheet, verbatim top+bottom disclaimer blocks, customer acknowledgment for the intake form, operator pre-delivery checklist, escalation guidance, primary-source references. **Validity:** OK for Reviews #1–5 to known friendlies; NOT valid for Reviews to strangers until AU fintech-lawyer review (~AU$2–5k one-off, Reza-side, Q-GTM-5 path). Q-GTM-5 partially advanced (DIY draft done, lawyer review still queued before Review #6 to stranger). Now parked for the night — 3 doc-PRs landed today + GTM Step 1.6 first scheduled run successful + Step 1.2 DONE.

**Earlier (2026-05-15):** Reza + Claude (**GTM Step 1.2 Airtable CRM DONE + Step 1.6 Day 1 of 3 toward DONE.** Continuation of the GTM workstream (PR #757 + #759 merged). This round: (1) **Step 1.6 first scheduled cron run successful 2026-05-15 06:45 Sydney** — digest landed in `admin@monitrax.com.au` Primary inbox (Gmail filter caught the self-send). Notably both prompt-improvement candidates from yesterday self-resolved in the wild — Claude correctly self-diagnosed the failing workflow as itself, and converted UTC timestamps to Sydney TZ. No prompt edits needed. Day 1 of 3 toward ✅ DONE. (2) **GTM Step 1.2 DONE** — Airtable CRM live. Base `Monitrax CRM` (`appEDHNU0mtbWznHp`) with 7 tables (one extra beyond v1 spec: `Brokerages & Employer Orgs` separate from `Companies` — decision deferred to first real broker contact). PAT `n8n-monitrax-crm` wired into n8n. Digest workflow updated via Chat-Claude: `[STUB] Airtable Activities` replaced with real Airtable node (filter `IS_AFTER({Created}, DATEADD(NOW(), -1, 'days'))`), Merge bumped 2→3 inputs, Compose Context extended with `airtable_activities_json`, Claude system prompt extended with new CRM ACTIVITY section. End-to-end production test successful (Sonnet 4.6, 1,232 in / 411 out tokens, ~AU$0.005). (3) **GTM_TOOL_STACK.md gets a new at-a-glance section** "What's live RIGHT NOW" per Reza directive 2026-05-15 "the number of apps is getting overwhelming" — 10-second view of paying-for + actively-using tools above the full table. Live monthly burn: ~AU$85–90/mo + per-transaction Stripe + ~AU$0.50 Anthropic. (4) **Airtable AI augmentation fields removed** — `Summary (AI)` / `Next Suggested Action (AI)` / `Sentiment (AI)` threw `emptyDependency` errors on empty `Body` records; not needed for v1; cleaner schema wins. Outstanding pending stubs in the digest: Stripe (no payments yet), Sentry (not connected), Cal.com (not connected), Smartlead replies (webhook). Next GTM step: still 2 mornings of clean digest runs to flip Step 1.6 ✅ DONE; then choose Step 0.1 (AFSL boundary) or Phase 2 prep (broker ICP + Apollo lead list).)

**Earlier (2026-05-14, evening):** Reza + Claude (**GTM Step 1.6 LIVE — cron PUBLISHED, error notifications configured, first execution successful.** Follow-up doc PR off main, continuation of merged PR #757. Cron now firing on the n8n schedule (06:45 Sydney daily); first scheduled run lands 2026-05-15 morning. "Done when" criterion remains three useful digests in a row — measure starts tomorrow. Gmail filter at `admin@monitrax.com.au` set up so self-sent `Monitrax Daily` emails surface in Primary inbox + starred (Gmail otherwise hides self-sends from Inbox). Two prompt-improvement candidates noted but deferred (self-referential workflow ID — Claude tells Reza to "fix the failing workflow" not realising the workflow IS the digest itself; UTC→Sydney TZ interpretation in ONE PATTERN) — iterate from real production output. From the n8n Production Checklist popup: error notifications wired to `admin@monitrax.com.au` ✅ (a 6:45am failure surfaces within minutes instead of being noticed days later); "Track time saved" skipped (vanity). See updated workstream §0d.)

**Earlier (2026-05-14):** Reza + Claude (**GTM Step 1.6 BUILT, awaiting first live cron run** — same PR `claude/monotrax-marketing-strategy-gSktV`, still doc-only at the repo level — the operational build is in n8n / Google Cloud / Anthropic, this round documents it. Updates this round: (1) **GTM Step 1.6 BUILT** — `Founder Daily Digest v1` workflow live at `https://n8n.monitrax.com.au/workflow/jQWmSbqEvY3vkAy2` (18 nodes, currently inactive — toggle off until first real-test passes). Architecture: cron @ 06:45 Sydney → Gmail Unread on `reza@try-monitrax.com` (noise-filtered, metadata only) + n8n self-monitoring (`/api/v1/executions?status=error`) → Merge → Compose Context → Claude **Sonnet 4.6** summariser (NOT Opus — match the model to the task; ~5× cost saving) → Extract Body → Gmail Send to `admin@monitrax.com.au` (self-send; `reza@monitrax.com.au` doesn't exist as a Workspace mailbox). 5 disabled stub branches (Airtable / Stripe / Sentry / Cal.com / Smartlead) for future data sources, sticky-note wiring instructions on the canvas. 4 credentials wired: 2× Gmail OAuth2 + Anthropic API + Header Auth for n8n internal API. Google Cloud OAuth client `n8n - Monitrax Gmail OAuth` in project `monitrax-479700` (External, Testing mode, test users `admin@monitrax.com.au` + `reza@try-monitrax.com`) backs both Gmail credentials. New operational runbook `docs/operational/runbooks/09_GTM_FOUNDER_DAILY_DIGEST.md`. (2) **Anthropic API flipped 🟡 Planned → 🟢 Active** in `GTM_TOOL_STACK.md` — first production consumer is the Daily Digest; ~AU$0.15–0.60/mo cost; existing `reza-onboarding-api-key` reused. (3) **Lessons memorialised (the painful ones)**: n8n auto-assigns credentials by type not name (manual re-pick required on Send node); self-hosted n8n needs BYO Google Cloud OAuth client; OAuth consent screen test-users list is the #1 silent-OAuth-failure cause; workflow timezone ≠ instance timezone (cron uses workflow TZ); n8n API keys must NEVER be pasted into chat (one was, rotated within minutes; Code sandbox blocks `n8n.monitrax.com.au` anyway, 403 Host not in allowlist, so the "Code session takeover" attempt failed harmlessly). (4) **Earlier (2026-05-13):** GTM Step 1.1 DONE — Hetzner CPX22 VPS `n8n-1` provisioned (Nuremberg, ~AU$15/mo), Docker Compose stack live, hardened, n8n at `https://n8n.monitrax.com.au` with TLS; mid-session URL migration off `try-monitrax.com` after Chrome Safe Browsing flag. **Earlier (2026-05-12):** GTM Step 1.3 DONE — `try-monitrax.com` + Google Workspace + Smartlead warmup running; monetisation model DECIDED (workstream `0e`); Friendlies private beta queued (workstream `0f`); Q-GTM-1/-2/-6 DECIDED. **Next operational step: first real `execute_workflow` of the Daily Digest → review the actual email → manually activate the cron toggle in n8n UI.** No code/schema/infra in the PR yet — strategy + plan + ops + operational runbook only.)

**Earlier (2026-05-12, late):** Reza + Claude (**feat(admin): `GET /api/admin/schema-drift` — server-side prod schema-drift audit.** Reza asked Claude to "run the drift audit yourself" — Claude can't reach the prod DB from the sandbox, so instead it built the tool: a SUPER_ADMIN-only, **read-only** endpoint that compares `Prisma.dmmf` vs prod's `information_schema`/`pg_catalog` and returns a JSON drift report (missing tables/columns/enum-values, with `suggestedAddColumnSql` hints; extra columns; orphan tables; `hasDrift` summary). No local Prisma-against-prod setup needed. Scope: column/table/enum-value level (catches the `SELECT *`-on-a-missing-column class — the `basiq_connections` bug); the local `prisma migrate diff` is still the way to also check types/nullability/indexes. Doc-sync: `04_PRISMA_MIGRATION_BASELINE.md` §12 (endpoint added as option (a)) + checklist row 11 + Tech Debt #18. **Reza-side: hit `https://www.monitrax.com.au/api/admin/schema-drift` (as SUPER_ADMIN) → paste the JSON to Claude → Claude ships a corrective migration for any drift.** Also still on the list: observability A1/A7/A9 ✅ done, log drain + synthetic monitor ⬜; CRON_SECRET rotation ⬜; the backup/restore drill + IRP tabletop ⬜. See the Reza-side operational checklist + Recently Completed.)

**Earlier (2026-05-12):** Reza + Claude (**Ops progress + tracking — doc-only.** PR #753 merged → `basiq_connections` drift fixed → both Cloud Scheduler crons (`monitrax-cdr-lifecycle`, `monitrax-portal-alert-sweep`) now run **200**. Email-in activation **deferred** (Reza decision — code shipped & dormant, activate when a real client wants to reply by email). New **📋 Reza-side operational checklist** (21 rows) added under the Phase 0 workstream so the GCP-console / Vercel / external activities don't get lost. `05_RETENTION_SCHEDULERS.md` updated — 3-job status (cdr ✅ / portal ✅ / conversation-retention ⬜ still-to-create), all target URLs flipped apex→`www.` (the apex redirect downgrades POST→GET → 405). **Next step for Reza:** observability — confirm alerts A1 (`/api/health` down) + A9 (budget overrun) are live & notifying, then the Vercel→Cloud Logging log drain, then add A7 (cron-stopped-succeeding) — `08_OBSERVABILITY_SLOS.md` §3/§9. **Recommended-before-Basiq:** the `prisma migrate diff` prod drift audit (Tech Debt #18 / `04_PRISMA_MIGRATION_BASELINE.md` §12). See checklist + Recently Completed.)

**Earlier (2026-05-12):** Reza + Claude (**fix(db): corrective migration for `basiq_connections` pre-migration schema drift — the `monitrax-cdr-lifecycle` cron's HTTP 500 root cause.** Diagnosed live with Reza via `curl -i` on `/api/cdr/lifecycle`: `prisma.basiqConnection.findMany()` in `checkConsentExpiry()` crashed with `The column basiq_connections.consentExpiresAt does not exist` — `schema.prisma` declares the "Fix: G19" CDR-consent columns (`consentExpiresAt` / `consentScope` + index) but they were added in the pre-migration `db push` era with no migration, so prod's table never got them. Fix-forward migration `20260514130000_fix_basiq_connection_consent_columns` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` + `CREATE INDEX IF NOT EXISTS ...` — idempotent: no-op on dev, adds on prod; §12.11 N/A; no `schema.prisma` change). Doc-sync: `04_PRISMA_MIGRATION_BASELINE.md` §12 + Tech Debt #18 (audit prod for more drift via `prisma migrate diff` before the Basiq submission). **Reza-side after this deploys: re-run `monitrax-cdr-lifecycle` → expect 200.** Also from the same session: the `monitrax-portal-alert-sweep` job was 405-ing because it hit the apex `monitrax.com.au` (which 30x-redirects to `www.` and downgrades POST→GET) — Reza updated its URL to `https://www.monitrax.com.au/api/portal/alerts/sweep`. The CRON_SECRET is configured in Vercel (not the cause of either failure) — still should be rotated (pasted in chat). See Recently Completed for both PRs.)

**Earlier (2026-05-12):** Reza + Claude (**Doc-only: align all Cloud Scheduler job timezone references to `Australia/Sydney` (AEST/AEDT) — Reza decision 2026-05-12.** Reza created `monitrax-portal-alert-sweep` in GCP Cloud Scheduler (region `australia-southeast1`, schedule `0 4 * * *`, timezone `Australia/Sydney`); the existing `monitrax-cdr-lifecycle` was already on `australia-southeast1` + `Australia/Sydney`. The docs and route-JSDocs said "02:00 / 03:00 / 04:00 UTC" for the cron schedules — corrected to `Australia/Sydney` throughout (`05_RETENTION_SCHEDULERS.md` gains a canonical "all jobs use australia-southeast1 + Australia/Sydney" note + a 3-job table; the calc-audit `cloud-scheduler-setup.md` schedule fixed `0 17 * * *`→`0 3 * * *` to match its already-Sydney timezone). Cloud SQL backup/maintenance windows stay UTC (separate thing). Changelog entries + archived "Recently Completed" items left as-is (historical). **Reza notes from the screenshot:** (a) `monitrax-cdr-lifecycle`'s last run **FAILED** — needs diagnosis (top suspects: it points at `https://www.monitrax.com.au/api/cdr/lifecycle` with a `www.` prefix while the working pattern uses the apex `monitrax.com.au`; or a stale `CRON_SECRET` header; check the job's Logs tab for the actual HTTP status); (b) `monitrax-conversation-retention-sweep` was NOT visible in the jobs list — verify it exists, create per `05_RETENTION_SCHEDULERS.md` §4 if not (the 7-yr purge isn't enforced until it does); (c) the CRON_SECRET was pasted into chat — rotate it. See active-workstream §0b for the part-2 entry below.)

**Earlier (2026-05-11):** Reza + Claude (**GTM Automation playbook SHIPPED** — `claude/monotrax-marketing-strategy-gSktV`, doc-only. Architect-mode strategic synthesis: B2B-led launch via mortgage-broker pilots + a paid Financial Health Review service for cash-now; consumer subscriptions parked behind the Basiq economics gate ($10k upfront + $2k/mo + ~1mo onboarding). Executable plan at `docs/marketing/GTM_EXECUTION_PLAN.md` covers Phases 0–6 with step-by-step actions, "done when" criteria, gotchas, tool/cost register (`GTM_TOOL_STACK.md`), and the "ask Claude to execute step X.Y" protocol. Workstream `0d` added; consumer-first GTM option captured in Reversed Decisions to prevent re-litigation.)

**Earlier (2026-05-10):** Reza + Claude (**Phase 32B PR3 post-#9b polish part 2 — hero KPI strip + client book on real data (PR #751, open).** New nullable `ClientSnapshotMarker.previousHealthScore`/`previousTrailStage` (migration `20260514100000_phase_32b_pr3_marker_prev`) — the sweep rolls `previous := last` then `last := current`; new aggregate-only `GET /api/portal/clients?organizationId=…` (`activeClients`/`needsAttention`/`trailAdvancedThisWeek`/`averageHealth`/`averageHealthDelta` + a thin per-client array — read from `OrganizationClient` + `ClientSnapshotMarker` + ACTIVE `ClientAlert`, no live snapshot); `/portal/dashboard` now shows the real book once the sweep has run (`hasRealClients` master switch — else the `LIGHTHOUSE` fixture preview, never half-and-half), with the fixture client-book table replaced by a slim "→ Open the full client book" card in real mode. Closes post-#9b polish item ②; item ③ (richer real-data client-book table) queued (polish, not a blocker). PR #749 (admin "run sweep now") → Recently Completed. Doc-sync: `PHASE_32B_PR3_ALERT_ENGINE.md` §6b part 2 + `03_DATA_MODEL.md` §9.3 + `07_API_STANDARDS.md` §15 + `MASTER_BLUEPRINT.md` §4. See active-workstream §0b.)

**Earlier (2026-05-10):** Reza + Claude (**Phase 32B PR3 post-#9b polish part 1 SHIPPED (PR #749) — admin "run sweep now".** Sweep core → `lib/portal/alerts/sweepRunner.ts`; cron route a thin CRON_SECRET wrapper; SUPER_ADMIN `POST /api/admin/portal-alert-sweep` (audit-logged, dry-run) + a card on `/admin/scheduler`. No schema/migration; §12.11 N/A. See Recently Completed.)

**Earlier (2026-05-10):** Reza + Claude (**Operational-readiness runbooks SHIPPED (PR #748) — doc-only, the last engineering-side Phase 0 chunk.** Three new runbooks under `docs/operational/runbooks/`: `06_BACKUP_RESTORE_DRILL.md` (quarterly non-destructive restore drill — verify → restore-into-throwaway → verify → tear down; annual PITR + `pg_dump`/`pg_restore` extension; Drill Log + PASS/FAIL), `07_IRP_TABLETOP_EXERCISE.md` (annual tabletop, 4 scenarios — CDR breach / prod DB unreachable / auth-provider outage / runaway cost — each walked through the IRP phases with `DECISION:` markers + After-Action Report + Exercise Log), `08_OBSERVABILITY_SLOS.md` (app-level SLOs: availability 99.5% + p95/p99 latency + 5xx targets per route group; Cloud Monitoring alert specs A1–A9 each with a runbook link; synthetic-canary plan; Service Health dashboard tiles; "live vs spec-only" status table flagging the Reza-side console steps). Plus `00_INDEX.md` + Recently Completed + Phase 0 chunk doc-sync, and PR #747 (email-in hardening) added to Recently Completed. No code / schema / migration / infra wiring — this is the spec the GCP-console execution will be done *against*. **Closes the doc-authoring portion of the last engineering-side Phase 0 production-readiness item** — remaining Phase 0 items (Stripe live-mode flip, WIF Phase 11/12) are trigger-gated / external-dependency-gated. See active-workstream §0b.)

**Earlier (2026-05-08):** Reza + Claude (**Settings overhaul SHIPPED.** A four-lens audit of consumer / admin / portal Settings surfaced 12 trust-breaking gaps — UI lying to users (Delete Account button with no onClick, `/api/settings/status` hardcoding values, mock API Keys + Billing pages, dead Storage folder switches, Appearance silently dropping toggles), schema-orphans (`/api/settings/categorization` Phase 29 no UI, `OrganizationSettings.tsx` no route), and missing-but-needed (account deletion lifecycle, data export, trusted contact, country / tax-year UI). All 12 fixed in this PR via 1 schema migration (additive), 3 new account-lifecycle endpoints, 4 new sub-pages, 7 modified pages, sidebar IA regrouped + warm-language pass (`Settings → My Settings`), full doc-sync. See active-workstream entry 0a for the full breakdown.

**Earlier (2026-05-08):** Phase 42 PR6.5e Persistent reconciliation nudge SHIPPED (this PR). Per Reza directive 2026-05-08: *"a message on login: you have few unreconsiled transactions, fix them now?"* + Claude research showing universal pattern across YNAB / Mint / Pocketbook / Slack / Apple Mail = persistent count + top-of-feed strip, NOT modals. Three coordinated changes to PR6.5b's strip without touching its data layer: (1) strip moved ABOVE the TRAIL hero on Home (was below it, where users never scrolled to it); (2) cadence relaxed from once-per-UTC-day → per-session via `sessionStorage` so reconciliation surfaces every fresh login session; server `lastPromptShownAt` write is now advisory telemetry only; `promptOptedOut` global off-switch preserved; (3) new `hooks/usePendingReconciliationCount.ts` + Slack/Mail-style amber count badge on "My Accounts" sidebar entry, visible across every page (capped at "99+"). Strip copy leaned into "Fix now" framing — header reads *"You have X unreconciled transactions"* + amber CTA pill *"Fix now →"*. 5 new formatter tests; 220 cumulative bookkeeping green. tsc + lint:financial-surfaces clean.

**Earlier (2026-05-07):** Phase 42 PR6.5c Review Queue card-stack SHIPPED (PR #710 merged). New `<ReviewQueueCards />` opt-in full-screen overlay reachable via "Quick review →" pill on Activity header. One transaction per card; ≥56pt chip targets per Apple HIG; anomaly-flagged FIRST queue order then chronological newest→oldest; Back / Skip / Transfer footer always reachable; empty state celebrates + exits. Reuses PR6.5's `useSwipeGesture` SSOT + composes existing `/api/unified-transactions/[id]` PATCH per CLAUDE.md §12.3 — no parallel categorise path. Pure `orderReviewQueue()` exported for tests; 7 ordering invariants pinned. Per Reza decision PR6.5b lesson: full-screen overlay is RIGHT here because the user *actively chose to enter* review mode — opposite of popup-on-arrival. 215 cumulative bookkeeping green. tsc + lint:financial-surfaces clean.

**Earlier (2026-05-07):** Phase 42 PR6.5b pending-actions strip SHIPPED (PR #709 merged — non-modal pivot on review). Initial implementation was modal-on-login; on review Claude flagged behavioural-friction risk (defensive-dismiss reflex, inbox-zero anxiety, anti-flow first-impression). Reza directive: *"go with your recommendations"* → pivoted to non-modal collapsible strip (Option A). Same SSOT aggregator + same API + same once-per-day gate; presentation layer is now a compact, non-blocking strip anchored above `<DailyPulseCard />` with collapse + opt-out always reachable. Captured in `↩️ Reversed Decisions` so future sessions don't re-attempt the modal pattern. Original design notes follow.

**Earlier in same PR (modal version, pivoted):** Phase 42 PR6.5b pending-actions popup-on-login SHIPPED. Per Reza idea 2026-05-07 ("have the transaction reconciliation and categorisation be popup when user login to be completed"). First-login-of-day overlay bundling up to 3 actions ordered CATEGORISE > ANOMALY > RECURRING > RECEIPT; warm copy ("Welcome back" / "X things waiting for you" / "Five seconds each"); snooze + opt-out always reachable. Schema: 3 additive columns on `engagement_state` (migration `20260512100000_phase_42_pr6_5b_pending_actions_gate`). New `lib/bookkeeping/engagement/pendingActions.ts` aggregator (composes existing `getOrCreatePeriod()` per CLAUDE.md §12.3); pure `shouldShowPromptToday()` gate. New `GET/POST /api/bookkeeping/engagement/pending-actions` route (`?action=shown|dismiss|opt-out`). New `<PendingActionsPrompt />` component mounted on `/dashboard` page; bottom-sheet on mobile, centred dialog ≥sm; ≥44pt tap targets per Apple HIG; `motion-safe:` utilities respect `prefers-reduced-motion`. 10 new gate tests; 208 cumulative bookkeeping green. tsc clean. **Open question on review (Reza 2026-05-07):** modal-on-login pattern flagged for behavioural-friction risk; non-modal collapsible strip variant proposed as Option A follow-up (PR6.5b-fix) — same aggregator, same API, same gate, presentation-layer swap only.

**Earlier (2026-05-07):** Phase 41 finishers shipping (PR #707 merged) — CLOSES PHASE 41 OUTSTANDING. Trust-deed CONFIRMED rules wired end-to-end into MasterTaxPosition (41e.17) + AI advisor tool registry (`getTrustDeedRules` FACT_LOOKUP — 11 canonical tools). Phase 41i.3b adapter back-fill (4 → 8 coverage). 50 new tests / 991 cumulative. Doc-sync: new help articles + per-user-audit runbook.

**Earlier (2026-05-07):** Phase 42 PR6.5 mobile-first engagement layer PARTIAL_SHIPPED (PR #708 merged). Three of five deliverables landed: (a) `hooks/useSwipeGesture.ts` SSOT (Pointer Events; constants `SWIPE_THRESHOLD_PX=40` / `TAP_MAX_DRIFT_PX=6` / `LONG_PRESS_MS=300` / `DOUBLE_TAP_WINDOW_MS=300` / `HAPTIC_PULSE_MS=10`; left=picker, right=Transfer, long-press=drawer, double-tap=always-rule writes MerchantMapping via re-PATCH); (b) `<CategoryPickerSheet />` mobile bottom-sheet (28px-radius, 220ms slide-up, ≥52pt chips per Apple HIG; composes existing `/api/unified-transactions/[id]` PATCH per CLAUDE.md §12.3); (c) Default-hide chrome via Advanced view toggle pill on Activity header (confidence + anomaly chrome hidden by default; opt-in for power users); (d) `<ConsumerMoneyFlowSankey />` reuses Phase 41g `<MoneyFlowSankey />` via synthetic single-entity ("You") projection in `projectSnapshotToMoneyFlow()` — pure data shaping, exported for tests; mounted at top of `/dashboard/activity`. Vibration API graceful no-op fallback; `prefers-reduced-motion` respected. 16 new unit tests (6 swipe constants + 10 Sankey projection); 198/198 cumulative green. tsc + lint:financial-surfaces clean. **Deferred PR6.5b (pending-actions popup-on-login per Reza idea 2026-05-07) + PR6.5c (Review Queue card-stack — substantial UX rebuild) + PR6.5d (Gemini anomaly narrative)** queued as rows 49-51.

**Earlier (2026-05-07):** Phase 42 PR6.5 mobile-first engagement layer PARTIAL_SHIPPED (PR #708). Three of five deliverables landed: (a) `hooks/useSwipeGesture.ts` SSOT (Pointer Events); (b) `<CategoryPickerSheet />` mobile bottom-sheet; (c) Default-hide chrome via Advanced view toggle on Activity; (d) `<ConsumerMoneyFlowSankey />` via synthetic single-entity projection. 16 new unit tests; 198/198 cumulative green. **Deferred PR6.5b/c/d** queued as rows 49-51.

**Earlier (2026-05-07):** Phase 41i.3b per-user "Audit this user" harness shipping (PR #705 merged). New `lib/calc-audit/userAudit/` module + admin POST endpoint + admin UI extension. 14 new harness tests (229 total). tsc clean. **41f.5 / Phase 42 reconciliation (Reza decision Q-41F-1 closed in this PR):** 41f.5 Monitrax Express formally **superseded by Phase 42**. **Phase 41 status:** Phase 41f core ✅ (PR #697); Phase 41i.6 ✅ (PR #703); Phase 41i.3b ✅ (PR #705).

**Earlier (2026-05-07):** Phase 41i.6c runtime audit harness + Full Scan button (PR #703 merged) — CLOSED PHASE 41i.6. New `lib/calc-audit/surfaceAudit.ts`: `runSurfaceAuditForUser` iterates registered descriptors + invokes canonical sources + persists `CalcAuditFinding` rows (source `L4_SURFACE_AUDIT`) when canonical source throws (HIGH), extractor throws (HIGH), or canonical returns null without `skipWhenNull` allowance (MEDIUM). `runSurfaceAuditFullScan` async-generator yields `FullScanProgress` events the API streams as NDJSON. Idempotent dedup via `recordSurfaceFinding` (refresh existing OPEN, create new). New `POST /api/admin/calc-audit/full-scan` with dual auth (admin session OR Cloud Scheduler shared secret; constant-time compare; mirrors 41i.5 pattern). Streams `application/x-ndjson` with `X-Accel-Buffering: no`. Admin UI `/admin/calc-audit` extended: `[Full scan (L4)]` button + live scan-progress card + new source-filter chips (`ALL` / `L1_DIFFERENTIAL` / `L2_ANOMALY` / `L3_ON_DEMAND` / `L4_SURFACE_AUDIT`). 12 new harness tests (7 outcome paths + 3 dedup-pattern + 2 multi-descriptor); 65 total surface-audit tests; 215 total integration green. tsc clean. `npm run lint:financial-surfaces` passes (no new violations from this PR). **Phase 41i.6 CLOSED**: design doc PR #694 ✅ → 41i.6a PR #699 ✅ (registry + 10 descriptors + L4 enum) → 41i.6b PR #701 ✅ (CI static-analysis) → 41i.6c (this PR — **CLOSES PHASE 41i.6**). HR-3 invariant 11 fully realised — calc-engine drift (L1/L2/L3) + surface-rendering drift (L4) both caught structurally.

**Earlier (2026-05-07 mid-session):** Phase 41i.6b CI static-analysis pass shipping (this PR).

**Earlier (2026-05-07):** Phase 41i.6a surface-audit registry shipping (this PR) — first sub-PR of the trustworthiness commitment. New `lib/calc-audit/surfaces/` module with `SurfaceDescriptor` types (kind: AUD/PERCENT/RATIO/SCORE/COUNT/MONTHS/DATE; per-kind default tolerances; `exceedsTolerance` helper) + singleton `surfaceRegistry` with `assertDescriptor` invariants + 10 v1 descriptors (6 master-snapshot-direct: net-worth / health-score / emergency-fund / investment-total / property-equity / tax-estimated-refund; 4 via `quickMetrics`: cashflow / income / expense / debt-total). **All 10 point at `lib/services/masterFinancialService.ts:getMasterFinancialSnapshot()` per CLAUDE.md §6.1 SSOT** — current components that bypass master will surface as L4 findings on first 41i.6c run, exactly the bug class the audit is designed to expose. New `L4_SURFACE_AUDIT` enum value on `CalcAuditFindingSource` + matching additive migration. 30 new tests (bootstrap / duplicate-rejection / assertDescriptor invariants / descriptor invariants / exceedsTolerance with absolute+relative+perfect-match logic + descriptor-level tolerance override + zero-canonical no-divide + negative-cashflow). 191 total tests pass. tsc clean. **Earlier today**: PR #697 merged (41f.4 trust-deed parser CLOSED Phase 41f core). PR #696 + #698 merged in parallel (Phase 42 PR1 + PR2). **NEXT after 41i.6a merges**: 41i.6b CI static-analysis pass (~1 day) → 41i.6c runtime audit harness + `[Full scan]` button (~3 days). Phase 41i.6 ships in 3 sub-PRs as locked in `PHASE_41I_6_SURFACE_AUDIT.md` §5.

**Earlier (2026-05-07 mid-session):** Phase 41f.4 trust-deed parser (PR #697 merged) — CLOSED Phase 41f core. New `lib/integrations/trust-deed/` module: `types.ts` (Zod schemas + per-rule confidence scoring; `CONFIDENCE_THRESHOLD = 0.7`; `highConfidenceOnly()` filter) + `pdfTextExtractor.ts` (uses `unpdf` — already installed; serverless-friendly; surfaces UC-TRUST-DEED-SCANNED-PDF when extracted text < 100 chars) + `geminiExtractor.ts` (strict structured-output prompt; Zod-validated response; truncates deeds > 250k chars with global UNCOMPUTED note) + `extractionService.ts` (orchestrates PDF → text → Gemini → persist; lifecycle helpers locked: EXTRACTED → CONFIRMED \| REJECTED, both terminal). New `lib/services/trustDeedRulesService.ts` — read-only consumer for Phase 41e callers (`getConfirmedRulesForEntity` returns latest CONFIRMED with low-confidence rules already filtered; defensive Zod-revalidation on read). Three new API routes: GET / POST `/api/entities/[id]/trust-deed` (status + multipart PDF upload; restricted to `DISCRETIONARY_TRUST` / `UNIT_TRUST`; 25 MB cap; 503 with `GEMINI_NOT_CONFIGURED` when env unset) + PATCH / POST `/api/entities/[id]/trust-deed/[rulesId]` (review-step edits + CONFIRM/REJECT lifecycle). New `/dashboard/entities/[id]/trust-deed` 4-step UI: upload card with read-only / encrypted-at-rest reassurance + extracted-rule cards with **per-rule confidence chips** (≥0.7 emerald, <0.7 amber "review carefully") + UNCOMPUTED notes card with verbatim source text + Confirm / Reject / Re-upload action bar + `<ScopeBoundaryCard />` reinforcing §1.1 boundary. **36 new tests** (Zod schema bound checks + unknown-enum rejection + 50-beneficiary sanity bound + `highConfidenceOnly` boundary case at 0.7 + lifecycle transition exhaustive matrix — only EXTRACTED has outgoing transitions; CONFIRMED + REJECTED terminal). 88 total integration tests pass. tsc clean. Wiring CONFIRMED rules into `MasterTaxPosition` (Phase 41e.17) + AI advisor tools (Phase 41h) deferred to follow-up — typed contract is locked + `getConfirmedRulesForEntity` helper is shipped + ready for consumers. **Phase 41f sub-PR sequence**: 41f.0 (PR #690 ✅) → 41f.1 (PR #691 ✅) → 41f.2 (PR #692 ✅) → 41f.3 (PR #693 ✅) → 41f.4 (this PR — **CLOSES PHASE 41f CORE**). **NEXT**: 41i.6 (the trustworthiness commitment per Reza brief 2026-05-07; gated on `PHASE_41I_6_SURFACE_AUDIT.md` §12 sign-off — 9 ticks). **Phase 42 separately drafted** (PR #695, ~6 weeks) for consumer bookkeeping completion — overlaps with 41f.5 Monitrax Express; reconciliation of 41f.5 vs Phase 42 pending strategic decision.

**Earlier (2026-05-04):** post-PR603 merge — Reza + Claude (**PR #603 MERGED to main = Phase 32B PR1+PR2 LIVE.** This follow-up doc-only PR captures the demo-complete plan + scaffolds the lighthouse-adviser pitch playbook. Reza directive 2026-05-04 (final): build a *fully functional working demo* of the complete capabilities — not a half-built skeleton — populated with realistic seeded users via the real onboarding flow. Sankey IN demo-complete (Reza preference: "sounds nicer"). Only PROD-hardening tasks (pen test, insurance, CMEK, Cloud Armor, Stripe live mode, training programs, DOCX templates, deep tax cases, Xero bidirectional sync) defer to PROD-ready. New section `🎯 Demo-Complete Critical Path` ABOVE Up Next sequences the work into 14 weeks of focused engineering with sensible parallelism. New file `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` scaffolds the 25-min pitch flow + objection handling + post-pitch follow-up cadence; populated incrementally as features ship. **Phase 32B B2B2C foundation SHIPPED earlier today (PR #603) + Phase 41 — Entity Layer / "My Structure" — DOCUMENTED + queued.** Phase 32B PR1+PR2 ship in this PR (#603): schema migration `20260504120000_add_organisation_profession` adding `Organization.profession` (forced at registration, no MULTI; reuses existing `OrganizationType` enum), Practice surface design primitives (`PracticeGlassCard`, `TrailStageChip`, `PracticeKpiStrip`, `PracticeAlertStream`, `PracticeClientBookTable`, `PracticeHeader`) under `components/portal/practice/`, profession-aware config registry (adviser/broker/accountant defaults), lighthouse demo dataset (5 fictitious AU property-investor clients), `/portal/dashboard` stub replaced with assembled Practice view, sidebar repaint slate-900 → brand warm-ivory, anti-poaching guardrails (`team:invite` PORTAL_ADMIN→PORTAL_OWNER + `PORTAL_SEAT_INVITED` audit log), `lib/portal/auth.ts` deleted (closes Tech Debt #8). Reza brief: monetisation strategy session evolved into B2B2C architecture for advisers/brokers/accountants. Strategic decisions LOCKED across the day: Q-PRA-1 closed (single-voice + marketplace + Ask-a-Professional + in-app comms; two-voice rejected), Xero-style dual-axis Org pricing matrix (Studio AU$199 / Practice AU$599 / Enterprise from $1,499 + per-seat + per-client overflow + add-ons SSO/white-label/API), D2C marketplace lead fees (AU$80/$150/$250 by user net-worth bracket), org-attached users see ONLY their org's professionals, in-app chat + email-through-app required (7yr compliance archive). Phase 33 (Help/Training/FAQ/Compliance system, 4 surfaces from one Markdown source) queued. Phase 41 (Entity Layer / "My Structure") queued: `LegalEntity` schema + Entity Tree + Money Flow Sankey + entity-aware tax engine + personal Xero/MYOB integration + adviser overlay extension + AI entity-aware diagnosis (~65 dev days; positioning: Monitrax CONSUMES Xero, doesn't replace it; Reza confirmations: TFN optional/encrypted/default-off; trust deed parsing both manual + AI-assisted; Tree first then Sankey). **Reza directive 2026-05-04 (post-PR603 strategic):** delay the lighthouse adviser pitch until Phase 41 (entity layer) is at least partially built — half-built demo against XPLAN/AdviceOS/Practifi reads as "another CRM," entity-aware demo with property + trust + SMSF + Xero integration is category-creating. **Earlier today on main:** PR #600 (IRP WIF appendix — Up Next #6 closed) and PR #601 (Phase 36 Phase 2a — inline LoanDetailDialog on Balances) merged. Cloud SQL upgraded to Enterprise Plus (Q1 closed); Vercel Pro confirmed (Q3 closed); legacy `/api/portfolio/snapshot` + `/api/financial-snapshot` deletion path documented (Q4 closed); auth-route hard-delete window confirmed for ≥ 2026-05-15 (Q5 closed); Prisma Accelerate not adopted (Q2 closed).

