# Monitrax Implementation Plan

> **This is the live, single source of truth for "what is being worked on, what is queued, what is blocked, what changed recently."**
>
> Every session starts here. Every PR that materially changes a workstream updates this file. If a workstream isn't in this file, it isn't real.
>
> See CLAUDE.md §1 (Session Startup Protocol) and §15 (Implementation Plan Protocol) for the rules that govern this document.

**Last updated:** 2026-05-01 (late afternoon) — Reza + Claude (WIF Phase 9: OIDC ✓, TLS handshake ✓ after Cloud IAM DB user added + grants, SASL fix in flight — pg now needs the SA OAuth token as password callback)

---

## Status legend

| Symbol | Meaning |
|---|---|
| 🟢 | Active and healthy |
| 🟡 | Active, in progress, on track |
| 🔴 | Active, stuck or risk flagged — see notes |
| 🚧 | Blocked, awaiting decision or external dependency |
| 📋 | Queued — agreed, not started |
| ❓ | Idea / open question — not committed |
| 🗑️ | Dead code / tech-debt — pending cleanup |
| ↩️ | Reversed decision — preserved here so we don't re-do it |
| ✅ | Recently completed (rolling 30 days) |

---

## 🟡 Active Workstreams

> Sorted by priority. Top of list = work in flight right now.

### 1. Step 1a — DB authentication via Workload Identity Federation (WIF)

- **Status:** 🟡 Phase 8 shipped (this PR). Phase 9 next — Reza to flip `USE_CLOUD_SQL_CONNECTOR=true` in Vercel Preview env.
- **Started:** 2026-04-30
- **Owner:** Reza (GCP/Vercel ops) + Claude (code)
- **Last touched:** 2026-04-30 — Phase 8 PR opened (`lib/db.ts` refactor + 6 doc updates + 3 new docs)
- **Why this matters:** Closes CDR `§3.2` compliance gap (no public IP authorized networks). Implements CLAUDE.md `§13.6` (production DB accessible only via GCP IAM). Eliminates the long-lived password-in-URL fragility that broke prod on 2026-04-30.

**Phases:**
- [x] 1 — Service account `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com` with `Cloud SQL Client` + `Cloud SQL Instance User` roles
- [x] 2 — Cloud SQL IAM user added to `monitrax-db-prod`
- [x] 3 — Postgres grants on `public` schema (CONNECT, USAGE, ALL on tables/sequences, default privileges)
- [x] 4 — Workload Identity Pool `vercel-pool` created in GCP
- [x] 5 — OIDC provider `vercel-oidc` configured with attribute condition `project_id == 'prj_UYQF...'`
- [x] 6 — WIF principal bound to service account (`roles/iam.workloadIdentityUser`)
- [x] 7 — Vercel env vars added (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `CLOUD_SQL_CONNECTION_NAME`, `USE_CLOUD_SQL_CONNECTOR=false`); Vercel OIDC enabled at project level
- [x] 8 — **Code PR shipped** — `lib/db.ts` refactor with feature-flag branch + `prisma/schema.prisma` `previewFeatures = ["driverAdapters"]` + new packages (`@google-cloud/cloud-sql-connector`, `@prisma/adapter-pg@^5.22.0`, `pg`) + 6 doc updates + 3 new docs (see CHANGELOG_2026_04_30.md). Build green; default flag `false` so merge is zero-risk.
- [ ] 9 — In Vercel: add `CLOUD_SQL_DB_USER=vercel-monitrax-db@monitrax-479700.iam` and `CLOUD_SQL_DB_NAME=monitrax` to Preview env. Set `USE_CLOUD_SQL_CONNECTOR=true` for Preview. Trigger Preview deploy; load Balances; verify queries succeed; check Cloud Logging for STS + impersonation calls under the SA. Then repeat for Production. **2026-05-01 update:** Cutover attempt on Production blocked by `VERCEL_OIDC_TOKEN not set` despite OIDC Federation appearing configured at the project level. Build-time issue (connector firing during `next build` page-data collection) and IAM Credentials API not yet enabled were also surfaced and corrected. Diagnostic follow-up PR adds (a) build-phase gate so the connector branch never runs during `next build`, and (b) enriched error message that lists the `VERCEL_*` env vars the function actually receives. The diagnostic confirmed the env var is genuinely never injected — that turns out to be **by design**: Vercel delivers the OIDC token as the `x-vercel-oidc-token` request header, NOT as `process.env.VERCEL_OIDC_TOKEN`, which only exists at build time and in `vercel env pull` output (https://vercel.com/docs/oidc/reference). Fix: switch to `getVercelOidcToken()` from `@vercel/oidc` which transparently reads from request context, and lazy-initialise the connector behind a Proxy so the auth flow runs inside a request handler rather than at module load. Pro upgrade is still required (and now in place) because Hobby tier doesn't allow `vercel.json` `regions` (functions were running in `iad1` US-East — diagnosed via `VERCEL_REGION=iad1` in the same dump) — function region is now `syd1`. **2026-05-01 (afternoon) update — PR #563 shipped, NEXT BLOCKER surfaced:** OIDC token retrieval works, STS exchange works, SA impersonation works, SQL Admin API mints the ephemeral client cert. The cert is then **rejected by the Cloud SQL instance at the mTLS handshake** with `ERR_SSL_SSL/TLS_ALERT_BAD_CERTIFICATE` (TLS alert 42, sent by the server). All API routes 401 because every `withPermission()` call hits the DB and the DB throws on connect. Likely causes (in order): (a) instance flag `cloudsql.iam_authentication=on` is missing — required for IAM-mode certs to be accepted; (b) SA is missing `roles/cloudsql.instanceUser` (has `roles/cloudsql.client` only); (c) `CLOUD_SQL_CONNECTION_NAME` typo. Verification commands + fix added to `04_WIF_TROUBLESHOOTING.md` §3.G. While diagnosing: flip `USE_CLOUD_SQL_CONNECTOR=false` for instant rollback (legacy `DATABASE_URL` path is still wired in). Follow-up code change (this PR) wraps the TLS error with a runbook pointer so the next failure log line is unambiguous; also `iad1` region observation in `/api/health` log — `vercel.json` `regions: ["syd1"]` is honoured for normal API routes but health check appears to route via Edge → iad1; not blocking but to be revisited after Phase 9 unblocks. **2026-05-01 (late afternoon) — §3.G RESOLVED, §3.H surfaced and fixed in code:** Verification of items 1–4 in §3.G found item #3 to be the cause — the SA had project-level `roles/cloudsql.client` AND `roles/cloudsql.instanceUser` (✓), instance flag `cloudsql.iam_authentication=on` (✓), connection name correct (✓), but **the SA was never registered as a Cloud IAM database user on the instance itself** — `gcloud sql users list` showed only the legacy `monitrax_user` and `postgres`. Root-caused as Phase 1 of this workstream having been ✅-ticked without the per-instance step actually running. Fixed via `gcloud sql users create vercel-monitrax-db@monitrax-479700.iam --instance=monitrax-db-prod --type=CLOUD_IAM_SERVICE_ACCOUNT`, then granting CONNECT/USAGE/SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER on `public` schema from Cloud SQL Studio as `monitrax_user`. After redeploy, TLS handshake succeeded; new error: `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`. Cause: in Cloud SQL IAM-auth mode, the `password` pg sends is the impersonated SA's OAuth access token. The `Connector` wraps the socket but does NOT inject the token into pg config — the application must do that. Fix (this PR's second commit): added `password: async () => authClient.getAccessToken()` callback to `pg.Pool` in `buildConnectorPrisma()`. Documented in §3.H.
- [ ] 10 — After 24h of stable production: remove `0.0.0.0/0` from Cloud SQL authorized networks; optionally disable public IP entirely. Then (after 30d): drop the legacy branch from `lib/db.ts`, drop `monitrax_user` Postgres user, remove `DATABASE_URL` from runtime env scope (keep in build env scope for `prisma migrate deploy`).

**Risk:** Low. Feature flag default is `false`, so merging the PR is zero-risk — production keeps using `DATABASE_URL` until the flag is flipped. `DATABASE_URL` stays as fallback through Phase 9.

**Blocking:** None.

**Docs to update on completion (Phase 8):**
- `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` §3.2 PARTIAL → DONE; mark P1 Auth Proxy item SUPERSEDED
- `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` §5 — describe WIF + Connector flow
- `docs/blueprint/MASTER_BLUEPRINT.md` line 116 — correct stale "Render" reference; add WIF to identity stack
- `docs/migration/MIGRATION_RENDER_TO_GCP_STEPS.md` — mark legacy; add WIF appendix
- `docs/operational/database/01_CLOUD_SQL_OPERATIONS.md` — deprecate password examples
- `CLAUDE.md` §13.6 — mark IAM-based DB access as implemented
- `prisma/schema.prisma` — add doc comment on `datasource` block

**New docs to create (Phase 8):**
- `docs/operational/security/04_WIF_TROUBLESHOOTING.md` — runbook for token failures, OIDC issuer changes, binding rotation
- `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md` — evidence pack for Basiq accreditation (architecture diagram, token flow)
- `docs/changelog/CHANGELOG_2026_04_30.md` — full session entry

---

### 2. Phase 36 — Accounts/Loans page retirement

- **Status:** 🟡 Phase 1c shipped, Phase 2 queued for after WIF lands
- **Started:** 2026-04-29
- **Owner:** Reza (testing) + Claude (code)
- **Last touched:** 2026-04-30 — PR #558 (transient 401 retry on Balances) merged

**Sub-phases:**
- [x] 1 — Inline `AccountDetailDialog` on Balances (PR #552)
- [x] 1b — Inline create/edit form dialogs for accounts and loans (PRs #553/554)
- [x] 1c — `Connect Bank` toolbar button + 2-tile source picker (Import / Manual) for `+ Account` and `+ Loan` (PR #555)
- [x] 1d — Account delete in detail dialog + retry on intermittent 401/5xx (PRs #556, #558)
- [ ] 2a — Inline `LoanDetailDialog` on Balances (replaces PR #550's `?focus=` redirect)
- [ ] 2b — Migrate Connect Bank sync/disconnect UI to Balances (currently lives only on `/dashboard/accounts`)
- [ ] 2c — Migrate `TransactionImportDialog`'s `TransactionReviewPanel` flow off the legacy page
- [ ] 2d — Redirect `/dashboard/accounts` and `/dashboard/loans` → `/dashboard/balances`
- [ ] 2e — Sidebar cleanup if any legacy entries still point at old pages

**Risk:** Medium. Phase 2 touches Basiq sync UI which has more state and side effects than the create/edit dialogs.

**Blocking:** Awaiting user testing of Phase 1c/1d in production after WIF stabilises (don't pile UX changes on an unstable DB).

**Why this is paused:** WIF (workstream 1) is the higher-priority hardening. We don't want to ship a UX migration into a DB that's still throwing intermittent 401s.

---

## 📋 Up Next (queued, agreed, not started)

| # | Item | Phase / area | Trigger to start |
|---|---|---|---|
| 1 | **CMEK (Customer-Managed Encryption Keys)** for Cloud SQL data-at-rest | CDR §3.3 / §5.7 hardening | After WIF Phase 10 lands and is stable |
| 2 | **Rotate `monitrax_user` DB password** to one without `@`/`%`/`*` (URL-safe), then re-add `connection_limit=1&pool_timeout=20` to `DATABASE_URL` for the fallback path | Connection pooling cleanup | After WIF Phase 9 (so the URL is just a fallback, not the hot path) |
| 3 | **Phase 36 Phase 2** (above) — full legacy page retirement | UX | After WIF stable + Reza confirms current Phase 1c/1d works in prod |
| 4 | **Incident Response Plan WIF section** | `docs/policy/INCIDENT_RESPONSE_PLAN.md` | During WIF Phase 8 (folded into the same PR) |
| 5 | **Apply `connection_limit` via Prisma datasource override (Option α)** instead of URL — only if pool exhaustion still observed after WIF | Perf | Only if needed |
| 6 | **Onboarding wizard PR 3c** — data source hygiene (staleness indicators, upgrade-this-account button, balance age heat-map) | Phase 12 — see `MASTER_BLUEPRINT.md` line 206 | After current hardening sprint |

---

## 🚧 Blocked / Awaiting Decision

> Items that need user input or external dependency resolution before they can move.

| # | Item | Blocked by |
|---|---|---|
| (none right now) | — | — |

---

## ❓ Open Questions (strategic, not yet decided)

| # | Question | Why it matters | Tentative answer |
|---|---|---|---|
| 1 | Should we upgrade Cloud SQL to a dedicated tier (`db-custom-1-3840` or higher)? Currently `db-g1-small` (shared 1 vCPU, 1.7GB RAM). | SLA + predictable performance once real users arrive. ~AU$50/mo extra. | **Defer until ~10 paying users** |
| 2 | Should we adopt **Prisma Accelerate** for managed connection pooling + edge cache? | Eliminates need for our own pool tuning. ~AU$30/mo on free tier limits. | **Re-evaluate after WIF stabilises** — connector + IAM may make Accelerate unnecessary at our scale |
| 3 | Vercel **Hobby → Pro** upgrade for VPC peering + better build minutes? | VPC would let us use Cloud SQL Private IP (kills public exposure permanently). ~AU$30/mo. | **Not yet** — WIF achieves the same security outcome on Hobby |
| 4 | When do we delete the legacy `/api/portfolio/snapshot` and `/api/financial-snapshot` routes (CLAUDE.md §12.4 lists as duplicates of `/api/master-snapshot`)? | Code hygiene. They still 500 occasionally per devtools logs from 2026-04-29. | After confirming no frontend caller remains — see Tech Debt #1 below |
| 5 | When do we delete `/api/auth/login` and `/api/auth/register` (CLAUDE.md §12.4 lists as dead since Firebase Auth SDK moved client-side)? | Code hygiene + reduce attack surface. | Audit + delete in next housekeeping pass |

---

## 🗑️ Dead Code / Tech Debt Backlog

> Found during work, NOT yet cleaned up. Each item: where it lives + why it's dead + when to remove.

| # | Item | Location | Why it's dead | Remove when |
|---|---|---|---|---|
| 1 | Legacy snapshot endpoints | `app/api/portfolio/snapshot/route.ts`, `app/api/financial-snapshot/route.ts` | Duplicates of `/api/master-snapshot` per CLAUDE.md §12.4. Still cause intermittent 500s. | After grepping for callers and migrating any survivors |
| 2 | Server-side auth routes | `app/api/auth/login/route.ts`, `app/api/auth/register/route.ts` | Firebase Auth SDK is the canonical client-side path; these are leftover from before the Feb 2026 cutover (CLAUDE.md §12.4) | Audit pass — confirm no caller, then delete |
| 3 | `lib/onboarding/onboardingEstimateService.ts` | Marked disabled, throws `OnboardingDisabledError`. Per `app/onboarding/page.tsx` it's defence-in-depth for the R12 incident. | Once the bulk-create path has been stable in prod for 90 days (started ~2026-04-29) | ~2026-07-29 |
| 4 | Old changelog files | `docs/changelog/CHANGELOG_2026_04_*.md` × multiple sessions per day | Accumulated >5 daily files in April; harder to scan. | Consolidate into monthly summaries during Phase 36 Phase 2 |
| 5 | Unused `_links` / `_meta` GRDCS fields on entities never rendered | Various API responses (e.g. expense, income items not surfaced in UI) | GRDCS wraps every entity by default; some surfaces never use them | Audit at next architecture review |
| 6 | `DIRECT_URL` env var if it exists in Vercel | Vercel project env vars | If we never run migrations from Vercel runtime, only locally / via `vercel-build`, this might be unused | Audit during WIF Phase 10 cleanup |
| 7 | Server-only re-exports through client-traversed barrels | Pattern audit across `lib/*/index.ts` (uncovered in `lib/portal/index.ts` during WIF Phase 8) | The barrel pattern `export * from './auth'` — where `auth.ts` imports `@/lib/db` — silently pulls Prisma + GCP packages into client bundles via any client component that consumes the barrel for unrelated symbols. Worked by accident pre-WIF because Prisma alone tree-shook out; broke the build the moment `lib/db.ts` added dynamic imports for the connector. Removed in `lib/portal/index.ts` for this PR. | Audit other `lib/*/index.ts` barrels for the same pattern. Remove `export * from './<server-only-file>'` lines if they exist. Track in next housekeeping pass. |
| 8 | `lib/portal/auth.ts` itself | `lib/portal/auth.ts` | Zero callers anywhere in the codebase as of 2026-04-30 (`grep -rn "verifyPortalAccess\|getUserPortalOrganizations\|verifyApiKey"` returns nothing outside the file). Was kept in the barrel re-export but the barrel re-export was also unused. Pure dead code per CLAUDE.md §12.1. | Either delete the file, or wire it up to the portal API routes that should be using it. Audit when portal Phase 32 work resumes. |

---

## ↩️ Reversed Decisions

> Things we tried and rolled back. **Do not re-attempt without explicit user confirmation.** Each entry: what was tried, why reverted, lesson.

| Date | What was tried | Why reverted | Lesson |
|---|---|---|---|
| 2026-04-30 | Append `?connection_limit=1&pool_timeout=20` to `DATABASE_URL` env var on Vercel | Caused 100% of API requests to 401. Prisma's URL parser broke on the combination of unencoded `@`/`%` in the password + new query params. | Don't append to a fragile URL. Either rotate password to URL-safe chars first, OR apply `connection_limit` via Prisma datasource override (Option α). Tracked in Up Next #5. |
| 2026-04-29 | Add `calculateOffsetInterestSavings(offsetBalance, loanAnnualRate)` to `lib/utils/calculations.ts` | User direction: "the calculations and relationships on all the legacy and current pages are correct, so don't create new logics without confirmation … use the existing logics and engines for the new changes." | No new calc engines without explicit go-ahead. Compose existing primitives (`calculateEffectivePrincipal`, `calculateInterestForPeriod`) only when behaviour preservation is verified. |
| 2026-04-29 | Compose offset interest savings as `interestForPeriod(principal, rate, 1) − interestForPeriod(effective, rate, 1)` (would correctly cap savings when `offset >= principal`) | Even though "more correct" in the edge case, behaviour deviates from the legacy `offsetBalance × loanAnnualRate`. User direction: existing math is correct. | Mathematical "correctness" is not the bar. **Preserved behaviour** is. New calc behaviour requires explicit user sign-off. |
| 2026-04-15 | `prisma db push` in Vercel build script | R12 incident — silently dropped legacy tables on every deploy. Lost data risk. | Build scripts NEVER run `db push`. Only `prisma migrate deploy`. Schema changes need a migration file (CLAUDE.md §12.12). |

---

## ✅ Recently Completed (rolling 30 days)

> Older items roll into `docs/changelog/IMPLEMENTATION_CHANGELOG.md`.

### 2026-04-30
- **Step 1a Phase 8 (this PR)** — `lib/db.ts` Cloud SQL Connector branch behind `USE_CLOUD_SQL_CONNECTOR` flag; `previewFeatures = ["driverAdapters"]`; new packages (`@google-cloud/cloud-sql-connector`, `@prisma/adapter-pg@^5.22.0`, `pg`); 6 doc updates (CLAUDE.md §13.6, CDR matrix §3.2, infra §5.5, MASTER_BLUEPRINT, migration appendix, Cloud SQL ops); 3 new docs (`04_WIF_TROUBLESHOOTING.md`, `CDR_WIF_AUTHENTICATION_EVIDENCE.md`, `CHANGELOG_2026_04_30.md`); incidental dead-barrel removal in `lib/portal/index.ts` to unbreak the client bundle. Build green. Default flag value `false` — zero-risk merge.
- **PR #559** — `docs/IMPLEMENTATION_PLAN.md` + CLAUDE.md §15 protocol (the live tracker)
- **Step 1a Phases 4–7** — WIF setup: Workload Identity Pool, OIDC provider, SA binding, Vercel env vars, OIDC federation enabled at project level
- **Cloud SQL instance-level password policy** enabled (12-char min, complexity, reuse interval, disallow username substring)
- **Per-user password policy** for `monitrax_user` and `postgres` (failed-attempt lockout)
- **Cloud SQL resize** `db-f1-micro` → `db-g1-small` (1.7GB RAM) — single biggest perf win
- **PR #558** — Retry transient 401s on Balances (DB-pressure-induced auth context failures)
- **Reverted** — `?connection_limit=1` URL append (broke prod)

### 2026-04-29
- **PR #556** — Account delete in detail dialog (rose Delete button + AlertDialog confirmation) + retry on intermittent /api/loans
- **PR #555** — Connect Bank toolbar button + 2-tile source picker (Phase 36 Phase 1c)
- **PR #554** — Re-merge Phase 1b inline create/edit forms (PR #553 merged into wrong base; cherry-picked to main)
- **PR #553** — `AccountFormDialog` + `LoanFormDialog` extracted (Phase 36 Phase 1b) — `+ Account` and `+ Loan` open inline
- **PR #552** — `AccountDetailDialog` extracted; account row click → inline dialog (Phase 36 Phase 1)
- **PR #551** — Resilient transactions enrichment (split `unified_transactions` JOIN as best-effort)
- **PR #550** — Loan-detail 404 fix + Balances partial-data rendering (`Promise.allSettled` + per-section error hints)
- **PR #549** — `UserPreference` schema-drift migration (taxYear column missing in prod, R12 class)
- **PR #548** — Surface real bulk-create errors (client now reads `details`; server translates Prisma error codes)
- **PR #547** — Required-field gating on wizard (Property purchase date now blocks Continue, not Submit)
- **PR #546** — Bank-import FK violation + UX cleanup; bumped `prisma.$transaction` timeout to 30s; surface submit errors in wizard footer
- **PR #545** — Mobile layout for `OnboardingWelcomeModal` (CTAs always reachable)

---

## 📚 Older history

For changelogs older than 30 days, see:
- `docs/changelog/IMPLEMENTATION_CHANGELOG.md` — rolling activity log
- `docs/changelog/CHANGELOG_YYYY_MM_DD.md` — daily session detail
- `docs/blueprint/MASTER_BLUEPRINT.md` §4 — phase-level status table
- `docs/blueprint/PHASE_*.md` — per-phase implementation notes

---

## How to update this document (rules)

> **Mandatory.** See CLAUDE.md §15 (Implementation Plan Protocol) for full rule text.

1. **Every PR that starts a workstream** adds it to `🟡 Active Workstreams` with all the fields filled in.
2. **Every PR that advances a workstream** ticks off the relevant `[ ]` checkbox(es) in that workstream's phase list and updates `Last touched`.
3. **Every PR that completes a workstream** moves it from `🟡 Active` to `✅ Recently Completed` with the date and PR number.
4. **Every PR that surfaces a tech-debt item** (e.g. removes a duplicate, identifies dead code) adds it to `🗑️ Dead Code / Tech Debt Backlog`.
5. **Every PR that reverts a previous attempt** adds an entry to `↩️ Reversed Decisions` so the same dead-end isn't re-attempted in a future session.
6. **Every PR that introduces an open question** the user hasn't decided adds it to `❓ Open Questions`.
7. **Once a quarter** (or when this file exceeds ~600 lines), recently-completed items older than 30 days are moved to `IMPLEMENTATION_CHANGELOG.md` and removed from this file.
8. **Reviewers reject PRs** that materially change a workstream without updating this file. Same hygiene rule as the changelog.
