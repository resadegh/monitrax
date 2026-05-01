# Monitrax Implementation Plan

> **This is the live, single source of truth for "what is being worked on, what is queued, what is blocked, what changed recently."**
>
> Every session starts here. Every PR that materially changes a workstream updates this file. If a workstream isn't in this file, it isn't real.
>
> See CLAUDE.md §1 (Session Startup Protocol) and §15 (Implementation Plan Protocol) for the rules that govern this document.

**Last updated:** 2026-05-01 (late evening) — Reza + Claude (**WIF Phases 9 + 10 closed.** Phase 9 cutover complete in Production; Phase 10 closed via Option D — IAM compensating control documented; `0.0.0.0/0` retained intentionally with explicit re-evaluation triggers. Phase 11 queued for +30d.)

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

- **Status:** 🟢 **Phase 9 COMPLETE 2026-05-01** — Production now serving 100% of traffic via WIF + Cloud SQL Connector + IAM DB auth. Phase 10 (remove `0.0.0.0/0`) queued for +24h after stability is observed; Phase 11 (remove fallback path) queued for +30d.
- **Started:** 2026-04-30
- **Owner:** Reza (GCP/Vercel ops) + Claude (code)
- **Last touched:** 2026-05-01 — Phase 9 cutover landed via PRs #563 + #564; full doc sync this commit (CLAUDE.md §13.6, CDR matrix §3.2, CDR WIF evidence §7, infrastructure §5.5, MASTER_BLUEPRINT identity stack, Cloud SQL ops, migration appendix, IMPLEMENTATION_PLAN, CHANGELOG_2026_05_01).
- **Why this matters:** Closed CDR `§3.2` DB-tier compliance gap (no long-lived password in env vars; full GCP audit trail under the SA principal; instance auth surface restricted to authenticated IAM identities). Implements CLAUDE.md `§13.6` (production DB accessible only via GCP IAM). Eliminates the long-lived password-in-URL fragility that broke prod on 2026-04-30.

**Phases:**
- [x] 1 — Service account `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com` with `Cloud SQL Client` + `Cloud SQL Instance User` roles
- [x] 2 — Cloud SQL IAM user added to `monitrax-db-prod`
- [x] 3 — Postgres grants on `public` schema (CONNECT, USAGE, ALL on tables/sequences, default privileges)
- [x] 4 — Workload Identity Pool `vercel-pool` created in GCP
- [x] 5 — OIDC provider `vercel-oidc` configured with attribute condition `project_id == 'prj_UYQF...'`
- [x] 6 — WIF principal bound to service account (`roles/iam.workloadIdentityUser`)
- [x] 7 — Vercel env vars added (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `CLOUD_SQL_CONNECTION_NAME`, `USE_CLOUD_SQL_CONNECTOR=false`); Vercel OIDC enabled at project level
- [x] 8 — **Code PR shipped** — `lib/db.ts` refactor with feature-flag branch + `prisma/schema.prisma` `previewFeatures = ["driverAdapters"]` + new packages (`@google-cloud/cloud-sql-connector`, `@prisma/adapter-pg@^5.22.0`, `pg`) + 6 doc updates + 3 new docs (see CHANGELOG_2026_04_30.md). Build green; default flag `false` so merge is zero-risk.
- [x] 9 — **COMPLETE 2026-05-01.** Production cutover to `USE_CLOUD_SQL_CONNECTOR=true` with full IAM DB auth chain working end-to-end. The cutover surfaced four issues, all resolved within the day:
  1. **OIDC token retrieval (PR #563)** — Vercel delivers the OIDC token as the per-request `x-vercel-oidc-token` HTTP header, NOT as `process.env.VERCEL_OIDC_TOKEN` (that env var only exists at build time / in `vercel env pull` output). Switched to `getVercelOidcToken()` from `@vercel/oidc` and added a Proxy-based lazy init so the auth chain runs inside a request context instead of at module load.
  2. **mTLS handshake / TLS alert 42 (PR #564 + GCP-side fix)** — Server rejected the ephemeral client cert at handshake. Root cause: the SA was never registered as a Cloud IAM **database** user on the instance (Phase 1 had been ✅-ticked but the per-instance `gcloud sql users create ... --type=CLOUD_IAM_SERVICE_ACCOUNT` step was missed). Fixed by creating the user + running `public`-schema GRANTs from Cloud SQL Studio as `monitrax_user`. Documented in `04_WIF_TROUBLESHOOTING.md` §3.G.
  3. **SCRAM no-password / SASL error (PR #564)** — The Cloud SQL Connector wraps the TLS socket but does NOT inject a Postgres-level password. In IAM-auth mode the password pg must send is the SA's OAuth access token; the application has to supply it. Added `password: async () => authClient.getAccessToken()` callback to `pg.Pool` in `buildConnectorPrisma()` so pg fetches a fresh token per connection. Documented in §3.H.
  4. **28P01 / trailing whitespace on `CLOUD_SQL_DB_USER` (PR #564)** — Vercel env var had a trailing space from a copy-paste. Postgres treats `...iam` and `...iam ` as different identifiers. Vercel env var corrected; defensive `.trim()` added on all WIF env-var reads in `lib/db.ts`. Documented in §3.J.
  Pro plan + region pinning to `syd1` confirmed. Separate observation: `/api/health` still routes via Edge → `iad1` despite `vercel.json` `regions: ["syd1"]` (non-blocking; revisit during Phase 10).
- [x] 10 — **CLOSED 2026-05-01 via "Option D" — IAM compensating control documented; `0.0.0.0/0` retained intentionally.** Re-evaluation discovered that removing `0.0.0.0/0` is not as simple as the original plan implied: Cloud SQL Connector with public IP still requires the source IP to be in authorized networks (the connector provides cert-based mTLS *over* the TCP layer the ACL gate-keeps; it does not bypass the ACL). Vercel does not publish a stable egress IP range to whitelist (per Vercel docs); the only stable path is the paid Vercel Static IP add-on (~AU$30-50/mo). Decision: at zero users, the marginal security improvement vs the operational/financial cost is not justified. Without a static credential, the network ACL is no longer protecting anything an attacker could exploit — IAM auth is the controlling boundary. Documented in `CDR_WIF_AUTHENTICATION_EVIDENCE.md` §8 with the explicit migration path to Vercel Static IP + restricted networks when triggered (first paying user / pre-Basiq submission / anomalous connection attempts). Optional one-time annotation: rename the authorized-network entry label to `public-iam-protected-cdr-3.2-doc` so the GCP console makes the intent visible to future operators / auditors.
- [ ] 11 — **Queued for +30d (target ≥ 2026-05-31).** Drop the legacy `buildStandardPrisma()` branch from `lib/db.ts`; remove `DATABASE_URL` from the Vercel **runtime** env scope (keep in **build** env scope so `prisma migrate deploy` keeps working); disable / drop the `monitrax_user` Postgres user.

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

**Blocking:** Awaiting user testing of Phase 1c/1d in production. **Unblocked 2026-05-01** — WIF Phase 9 cutover is complete and Production DB auth is stable, so Phase 36 Phase 2 can resume next.

**Why this was paused:** WIF (workstream 1) was the higher-priority hardening. With Phase 9 now landed, we can ship the remaining UX migration into a stable, IAM-authenticated DB.

---

## 📋 Up Next (queued, agreed, not started)

| # | Item | Phase / area | Trigger to start |
|---|---|---|---|
| 1 | **WIF Phase 11** — drop legacy `buildStandardPrisma()` branch from `lib/db.ts`; remove `DATABASE_URL` from runtime env scope (keep build scope so `prisma migrate deploy` works); disable / drop `monitrax_user` | WIF | +30 days after Phase 9 (target ≥ 2026-05-31) |
| 2 | **WIF Phase 12 (conditional)** — switch from `0.0.0.0/0` to Vercel Static IP + restricted authorized networks. Trigger: first paying user OR pre-Basiq-submission OR anomalous connection attempts in Cloud Logging. Migration path documented in `CDR_WIF_AUTHENTICATION_EVIDENCE.md` §8 (~15 min end-to-end) | WIF | Trigger-based (see triggers ↑) |
| 3 | **CMEK (Customer-Managed Encryption Keys)** for Cloud SQL data-at-rest | CDR §3.3 / §5.7 hardening | After Phase 11 lands and is stable |
| 4 | **Phase 36 Phase 2** — full legacy page retirement | UX | Now unblocked — Reza confirms current Phase 1c/1d works in prod |
| 5 | **Incident Response Plan WIF section** | `docs/policy/INCIDENT_RESPONSE_PLAN.md` | Next housekeeping pass — capture Phase 9 cutover lessons formally |
| 6 | **Apply `connection_limit` via Prisma datasource override (Option α)** instead of URL — only if pool exhaustion still observed after WIF | Perf | Only if needed |
| 7 | **Onboarding wizard PR 3c** — data source hygiene (staleness indicators, upgrade-this-account button, balance age heat-map) | Phase 12 — see `MASTER_BLUEPRINT.md` line 206 | After current hardening sprint |

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

### 2026-05-01
- **Step 1a Phase 9 — WIF Production cutover COMPLETE.** Production now serves 100% of traffic via Workload Identity Federation + Cloud SQL Connector + IAM database authentication. Four issues surfaced and resolved within the day: (1) PR #563 — OIDC token reading switched to per-request header via `getVercelOidcToken()` + Proxy lazy init; (2) GCP-side fix — created the missing Cloud IAM database user on the instance + ran `public`-schema GRANTs as `monitrax_user`; (3) PR #564 commit `a29667a` — added `password: async () => authClient.getAccessToken()` callback to `pg.Pool` for IAM-mode Postgres auth; (4) PR #564 commit `34e764c` — defensive `.trim()` on all WIF env vars after a trailing-space copy-paste artifact triggered 28P01. Doc sync (this commit): CLAUDE.md §13.6, CDR matrix §3.2, CDR WIF evidence §7 (cutover record), infrastructure §5.5, MASTER_BLUEPRINT identity stack, Cloud SQL ops, migration appendix, IMPLEMENTATION_PLAN, CHANGELOG_2026_05_01, runbook §3.G/§3.H/§3.I/§3.J.

### 2026-04-30
- **Step 1a Phase 8 (PR #560)** — `lib/db.ts` Cloud SQL Connector branch behind `USE_CLOUD_SQL_CONNECTOR` flag; `previewFeatures = ["driverAdapters"]`; new packages (`@google-cloud/cloud-sql-connector`, `@prisma/adapter-pg@^5.22.0`, `pg`); 6 doc updates (CLAUDE.md §13.6, CDR matrix §3.2, infra §5.5, MASTER_BLUEPRINT, migration appendix, Cloud SQL ops); 3 new docs (`04_WIF_TROUBLESHOOTING.md`, `CDR_WIF_AUTHENTICATION_EVIDENCE.md`, `CHANGELOG_2026_04_30.md`); incidental dead-barrel removal in `lib/portal/index.ts` to unbreak the client bundle. Build green. Default flag value `false` — zero-risk merge.
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
