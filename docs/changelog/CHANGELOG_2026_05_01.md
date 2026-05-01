# Changelog — 2026-05-01

## Session: claude/review-monitrax-docs-GgeVM

### Outcome

**WIF Phase 9 cutover COMPLETE.** Production database authentication is
now fully on Workload Identity Federation + Cloud SQL Connector + IAM
database auth, end-to-end. `/api/health` returns 200 with
`{"status":"healthy","database":"connected"}`; the dashboard loads;
all API routes 200. No long-lived password is required at runtime.

### Context

Previous session shipped PR #563 — switched `lib/db.ts` to read the Vercel
OIDC token via `getVercelOidcToken()` (from the `x-vercel-oidc-token`
request header, not `process.env.VERCEL_OIDC_TOKEN`) and added a Proxy
to defer connector init until the first method call inside a request
context. With `USE_CLOUD_SQL_CONNECTOR=true` in Vercel Production after
the merge, every API route returned 401 in the browser and the Vercel
function logs surfaced:

```
PrismaClientKnownRequestError: ... C0D85FC5...:error:0A000412:
SSL routines:ssl3_read_bytes:ssl/tls alert bad certificate:
ssl/record/rec_layer_s3.c:912:SSL alert number 42
code: 'ERR_SSL_SSL/TLS_ALERT_BAD_CERTIFICATE'
clientVersion: '5.22.0'
```

### Diagnosis

The OIDC fix from PR #563 worked. Every layer up to and including the
SQL Admin API call (which mints an ephemeral client cert) succeeded.
The failure is at the **mutual-TLS handshake** between the Cloud SQL
Connector and the instance — TLS alert 42 (`bad_certificate`) is sent
**by the server**, meaning the Cloud SQL instance is rejecting the
ephemeral client cert at handshake.

Likely causes (in order of probability):

1. The instance flag `cloudsql.iam_authentication` is OFF. IAM
   authentication is opt-in per Cloud SQL instance — without the
   flag, the instance refuses IAM-issued certs at TLS layer.
2. The SA `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com`
   has `roles/cloudsql.client` (enough to mint a cert) but not
   `roles/cloudsql.instanceUser` (required for the instance to
   accept the cert for IAM-mode auth).
3. `CLOUD_SQL_CONNECTION_NAME` env var has a typo, so the cert is
   minted for instance A but the connector opens a TCP socket to
   instance B.

### Changes Made

- **Type:** Diagnostic + docs
- **Scope:** `lib/db.ts`, WIF runbook, IMPLEMENTATION_PLAN

### Files Modified

- `lib/db.ts` —
  (1) wrapped `prisma.<model>.<method>()` and `prisma.$<method>()`
  calls in the lazy connector Proxy with TLS error detection. When
  pg surfaces a TLS error, the original is rewrapped with a clear
  pointer to `04_WIF_TROUBLESHOOTING.md` §3.G + the three most-likely
  causes; original preserved as `cause`.
  (2) Added `password: async () => authClient.getAccessToken()` to
  the `pg.Pool` config in `buildConnectorPrisma()` so pg has the
  SA's OAuth access token to send during Postgres-level auth. This
  fixes the `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must
  be a string` error that surfaced after the TLS layer was unblocked.
- `docs/operational/security/04_WIF_TROUBLESHOOTING.md` —
  added §3.G "TLS bad_certificate" with verification gcloud commands
  + the most-common fix; added §3.H "SASL no-password" documenting
  the password-callback fix; added §3.I for the transient
  `socket disconnected before secure TLS` error seen during the
  instance restart that toggling the IAM flag triggers.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 9 entry expanded with the
  new blocker, the §3.G GCP-side fix that resolved it, and the §3.H
  follow-on code fix.

### Build Status

- [x] `npm run build` — passes
- [x] TypeScript-only changes to `lib/db.ts`; no schema change; no
  destructive Prisma writes
- [x] Manually verified end-to-end against Production:
  `/api/health` → 200, dashboard loads, balances render

### Commits

| Hash | Message |
|---|---|
| `5c0229b` | fix(db): wrap pg TLS handshake errors with runbook pointer; doc §3.G |
| `a29667a` | fix(db): supply SA OAuth token as pg password for Cloud SQL IAM auth |
| `34e764c` | fix(db): trim WIF env vars on read; runbook §3.J for 28P01 + trailing whitespace |
| (this commit) | docs: WIF Phase 9 doc sync — mark complete across all references |

### Operational status (end of session)

- ✅ `USE_CLOUD_SQL_CONNECTOR=true` in Vercel **Production**
- ✅ `/api/health` returns 200 with
  `{"status":"healthy","database":"connected"}`
- ✅ `/dashboard/balances` loads; all API routes 200
- ✅ No long-lived password in any runtime env var
- ✅ Cloud Logging shows STS + IAM Credentials calls under
  `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com`

### Layer-by-layer status

| Layer | Status |
|---|---|
| OIDC token retrieval (per-request header) | ✅ |
| STS token exchange | ✅ |
| Service account impersonation | ✅ |
| SQL Admin API ephemeral cert minting | ✅ |
| mTLS handshake to Cloud SQL instance | ✅ |
| Postgres IAM auth (SA token as password) | ✅ |
| `public`-schema query authorization | ✅ |

### Phase 9 timeline (single-day cutover)

| When | What |
|---|---|
| Morning | Cutover attempt blocked by `VERCEL_OIDC_TOKEN not set`. PR #563 (OIDC header + Proxy lazy init) merged. |
| Early afternoon | After redeploy, surfaced TLS alert 42 / `bad_certificate`. PR #564 commit `5c0229b` added error wrapper + runbook §3.G. |
| Mid afternoon | Ran §3.G verification commands; found SA was not a Cloud IAM DB user on the instance. `gcloud sql users create` + GRANTs in Cloud SQL Studio as `monitrax_user`. |
| Late afternoon | Surfaced SASL no-password. PR #564 commit `a29667a` added `password` callback to `pg.Pool` + runbook §3.H. |
| Early evening | Surfaced 28P01 with trailing space in error. Vercel env var corrected. PR #564 commit `34e764c` added `.trim()` defence + runbook §3.J. |
| Evening | `/api/health` 200. Phase 9 complete. Doc sync (this commit). |

### Phase 10 decision (same evening)

The original WIF roadmap had Phase 10 = "remove `0.0.0.0/0` from
authorized networks 24h after stable Phase 9". On re-evaluation
this evening, that turns out to be more nuanced than originally
documented:

- Cloud SQL Connector with **public IP** still requires the source
  IP to be in authorized networks. The connector provides cert-based
  mTLS *over* the TCP layer the ACL gate-keeps; it does not bypass
  the ACL.
- Vercel **does not publish a stable egress IP range** for runtime
  functions ([Vercel docs explicitly state this](https://vercel.com/docs/security/secure-backend-access/static-ip)).
  The pool is shared across all Vercel customers and changes
  without notice.
- The only stable path to a restricted authorized-networks list is
  Vercel Static IP (paid Pro add-on, ~AU$30-50/mo per region).

Decision: **keep `0.0.0.0/0`, document IAM as the compensating
control.** Rationale documented in
`docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md` §8:

> The network ACL was historically protecting a long-lived
> database password. That password no longer exists. Without a
> Vercel-issued OIDC token tied to project `prj_UYQF...` plus
> the WIF binding plus the per-instance Cloud IAM user, no
> source IP can authenticate. The auth surface is fully
> IAM-protected.

Re-evaluation triggers documented for future sessions:
- First paying user lands
- Before Basiq accreditation submission
- Anomalous connection attempts in Cloud Logging

Migration path to Vercel Static IP + restricted networks documented
in §8 (~15 min end-to-end when triggered).

Files updated for the Phase 10 decision (this commit):

- `CLAUDE.md` §13.6 — Phase 10 decision noted; Phase 11 timeline
- `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` §3.2 —
  reworded as "DONE (DB tier — restricted by IAM as compensating
  control)"; full rationale inline
- `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md` — new §8
  with the decision, the question/answer table, attacker-model
  analysis, re-evaluation triggers, and the migration path
- `docs/IMPLEMENTATION_PLAN.md` — Phase 10 ✅; Phase 12
  conditional entry added to Up Next; Phase 11 still queued for
  +30d

### `/api/health` region pin (same evening)

Side observation from earlier in the day — GCP uptime check showed
`/api/health` running in `iad1` despite project default `syd1`.
Fixed by adding explicit Next.js App Router exports
(`runtime = 'nodejs'`, `dynamic = 'force-dynamic'`,
`preferredRegion = 'syd1'`) to `app/api/health/route.ts`. Commit
`2d0f68e` on PR #565.

### Next steps

- **Phase 11** (queued, +30 days, target ≥ 2026-05-31): drop legacy
  `buildStandardPrisma()` branch, remove `DATABASE_URL` from runtime
  env scope (keep build scope for `prisma migrate deploy`),
  disable / drop `monitrax_user`.
- **Phase 12** (conditional): Vercel Static IP migration when one
  of the documented triggers fires.
- **Optional today:** annotate the GCP authorized-network entry
  label (one gcloud command — see PR description) so the GCP
  console makes the intent visible to future operators.

### Refs

- `docs/IMPLEMENTATION_PLAN.md` — Workstream #1, Phase 9
- `docs/operational/security/04_WIF_TROUBLESHOOTING.md` §3.G
- PR #563 (precursor — OIDC header fix)
- `docs/changelog/CHANGELOG_2026_04_30.md` — Phase 8 ship

---

## Session: claude/review-monitrax-docs-lS5cs (evening)

### Context

User reported two issues on the Home dashboard:

1. The `T R A I L` banner *looks* like an interactive tile with
   clickable letters but isn't — only the small "Go to <Stage>"
   link in the top-right does anything.
2. Clicking that link from Stage T sends the user to the legacy
   `/dashboard/accounts` page, which Phase 36 is in the middle of
   retiring. The new canonical page is `/dashboard/balances`.

The user also asked us to leave Basiq-related references (i.e.
hrefs that carry `?action=connect-basiq` or `?action=add`) in
place — those depend on the legacy page until Phase 36 Phase 2b
ports the Connect Bank UI to Balances.

### Changes Made

- **Type**: Enhancement + cleanup
- **Scope**: Home dashboard TRAIL banner; cross-codebase legacy
  `/dashboard/accounts` href repoint (Basiq excluded).
- **Solution**:
  1. Rewrote `components/dashboard/TrailStageIndicator.tsx` to
     make the five `T R A I L` circles real interactive tabs:
     bigger letters, hover/focus previews the stage's full
     description (sourced from `TRAIL_FRAMEWORK.md` §2 — headline,
     narrative, key question), first click selects (sticky),
     second click on the same letter navigates. Added an inline
     `Open <Stage>` button in the spotlight panel as an explicit
     nav affordance, plus a "You are here" pill so the user can
     always see their actual stage even while exploring others.
  2. Swept the codebase for non-Basiq `/dashboard/accounts`
     hrefs and repointed them to `/dashboard/balances`:
     `TrailStageIndicator` Track href, `LinkedDataPanel`
     `ADD_LINK_ROUTES.account`, `ModuleHealthBlock` `accounts`
     and `offsetAccounts` drill-downs, `app/dashboard/cfo/page.tsx`
     Month-End Balance metric card `router.push`,
     `app/api/cashflow/intelligence/route.ts` Build Emergency
     Buffer `learnMoreUrl`.
  3. Documented the remaining Basiq `?action=` hrefs as tech-debt
     row #9 in `docs/IMPLEMENTATION_PLAN.md` so the next person
     working on Phase 36 Phase 2b knows to flip them in the same
     PR.

### Files Modified

- `components/dashboard/TrailStageIndicator.tsx` — full rewrite:
  interactive tabs, spotlight panel, hover preview, click-to-
  select, second-click-to-navigate, You-are-here pill, inline
  Open-stage CTA. Track href swapped to `/dashboard/balances`.
- `components/LinkedDataPanel.tsx` — `ADD_LINK_ROUTES.account`
  → `/dashboard/balances`.
- `components/health/ModuleHealthBlock.tsx` — `accounts.href`
  and `offsetAccounts.href` → `/dashboard/balances`.
- `app/dashboard/cfo/page.tsx` — Month-End Balance card
  `router.push` → `/dashboard/balances`.
- `app/api/cashflow/intelligence/route.ts` — Build Emergency
  Buffer `learnMoreUrl` → `/dashboard/balances`.
- `docs/IMPLEMENTATION_PLAN.md` — ticked Phase 36 Phase 2.0;
  added tech-debt row #9 (remaining Basiq `?action=` hrefs);
  added 2026-05-01 entries to Recently Completed.
- `docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md` —
  new §7 Phase 2.0 sub-section, restructured Phase 2 sub-phases
  to call out 2b's Basiq dependency; new §9 documenting the
  banner redesign + the rule that stage copy must stay in sync
  with `TRAIL_FRAMEWORK.md` §2.

### Files Deliberately NOT Modified (per user direction)

- `components/dashboard/BasiqHeroCard.tsx` — `?action=connect-basiq`
  and `?action=add` hrefs.
- `components/dashboard/DashboardEmptyStateGrid.tsx` — same.
- `components/setup/SetupNextActionPanel.tsx` — same.
- `app/dashboard/accounts/page.tsx` — legacy page, kept alive
  because Phase 36 Phase 2b/2c haven't shipped yet.

### Documentation Updated

- `docs/IMPLEMENTATION_PLAN.md`
- `docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md`
- `docs/changelog/CHANGELOG_2026_05_01.md` (this file)

### Build Status

- [x] `npm run build` — PASS (Prisma generate + full Next.js build; all routes compiled, no type errors).
- [⚠] `npm run lint` — pre-existing repo state: no `.eslintrc*` or `eslint.config*` file present, so `next lint` drops into interactive ESLint setup and can't run non-interactively. Not introduced by this PR. TypeScript checking ran as part of `next build` and passed.

### Risk

Low. UI-only on the Home page + 4 individual href constants in
non-critical paths. No API contracts touched. No financial
calculations touched. No DB queries touched. Default render of
the new banner mirrors today's behaviour for users who never
interact with the letters, so the change is opt-in from a UX
standpoint.

### TRAIL Alignment

The redesign makes the home page's primary feature actually teach
the TRAIL framework — every visitor can hover the letters and
read what each stage means in their own time. This was the
explicit intent of TRAIL_FRAMEWORK §1 ("People don't need
another spreadsheet. They need a guide.") that the prior banner
visually implied but didn't deliver.

---

## Session: claude/review-monitrax-docs-lS5cs (night) — Dead-code audit + soft-delete pass

### Context

Reza requested a dead-code audit across the wizard/onboarding/marketing/trail-* surfaces after PR #566 surfaced concerns about accumulated cruft. The audit (run via Explore agent) covered 22 surfaces and re-verified the 9 existing tech-debt items in `IMPLEMENTATION_PLAN.md`.

Reza explicitly requested a **soft-delete first, hard-delete later** workflow so he can test the app fully and confirm nothing breaks before destructive deletions ship.

### Audit findings (summary)

| Status | Count | Notes |
|---|---|---|
| ALIVE | 15 | Marketing TRAIL components on `/`, wizard v2 steps, `OnboardingWelcomeModal`, setup pages |
| DEAD (verified zero callers) | 4 | `/api/auth/login`, `/api/auth/register`, `components/onboarding/linear/` (~18 files), `lib/cfo/trailStage.ts` |
| ORPHAN_CHAIN | 1 | `LinearWizardContainer` plus its 17 children — full directory orphaned by v2 wizard |
| URL_REACHABLE_ONLY | 2 | `/trail-check`, `/trail-method` (intentional public marketing URLs) |
| INACCURATE PLAN ENTRIES | 1 | tech-debt #1 claimed both snapshot routes were dead — only `/api/financial-snapshot` is dead; `/api/portfolio/snapshot` has 3 live callers |

### Soft-deletes shipped this session

**1. `app/api/auth/login/route.ts` — 410 Gone stub.**
Replaced 148-line handler with a ~20-line stub that returns HTTP 410 with a JSON deprecation payload. Both `POST` and `GET` are wired so accidental browser navigation also returns the 410. Each hit logs `[deprecated-route] POST /api/auth/login hit after soft-delete. ip=… ua=…` to Vercel function logs. The original imports (`prisma`, `lib/auth`, `lib/session`, `lib/security/accountLockout`) are dropped — those utilities remain in active use elsewhere (OAuth callbacks, magic link, passkey, admin lockout) and continue to work; only this route stops touching them.

**2. `app/api/auth/register/route.ts` — 410 Gone stub.**
Same pattern. Original imports dropped (`sendVerificationEmail`, `hashPassword`, `generateToken` are still alive in their own modules — used by `verify-email`, `resend-verification`, OAuth callbacks, portal registration, admin tools).

**3. `components/onboarding/linear/LinearWizardContainer.tsx` — `@deprecated` JSDoc marker.**
No runtime change (already unreachable per audit — zero importers from outside the directory). The marker at the top of the entry file documents the deletion trigger (≥ 2026-05-15) and points at the directory-wide deletion target.

### Why "soft-delete first"

Per Reza's explicit instruction. The 410 stubs convert "silently succeeded against a stale auth path" into "loud failure with diagnostic payload" — if any forgotten frontend caller, external integration, or automation still hits these routes during the 2-week soft-delete window, it will:
- Fail visibly (not silently)
- Log the source IP and user-agent in Vercel function logs
- Tell the caller exactly what to migrate to (Firebase Auth SDK)

If the soft-delete window passes with zero `[deprecated-route]` warnings, the hard-delete PR is a trivial 2-file removal.

### Files Modified

- `app/api/auth/login/route.ts` — full rewrite to 410 stub (~50 lines)
- `app/api/auth/register/route.ts` — full rewrite to 410 stub (~50 lines)
- `components/onboarding/linear/LinearWizardContainer.tsx` — `@deprecated` JSDoc header prepended; original header preserved below
- `docs/IMPLEMENTATION_PLAN.md` — split tech-debt #1 into #1a (`/api/portfolio/snapshot` — needs migration) and #1b (`/api/financial-snapshot` + service); updated #2 with soft-delete state + hard-delete trigger date; added new entries #10 (`components/onboarding/linear/`) and #11 (`lib/cfo/trailStage.ts`); appended Recently Completed entry summarizing audit + soft-delete
- `docs/changelog/CHANGELOG_2026_05_01.md` — this entry

### Files NOT Modified

- `app/api/portfolio/snapshot/route.ts` — has 3 live callers; needs migration PR before deletion
- `app/api/financial-snapshot/route.ts` and `lib/services/financialSnapshot.ts` — service still used by `dashboard/insights`; needs migration PR
- `lib/cfo/trailStage.ts` — Phase 17 spec placeholder; queued for either Phase 17 wire-up or future deletion
- All TRAIL marketing components, wizard v2, all onboarding live surfaces — confirmed alive
- `lib/portal/auth.ts` — already tracked as #8; no change

### Build Status

- [x] `npm run build` — pending verification before commit
- [⚠] `npm run lint` — repo lacks `.eslintrc*`; same pre-existing state as PR #566

### Hard-delete schedule

| Date | Action |
|---|---|
| 2026-05-01 | Soft-delete shipped (this PR) |
| 2026-05-01 → 2026-05-15 | Reza tests the app + monitors Vercel logs for `[deprecated-route]` warnings |
| ≥ 2026-05-15 | If logs are clean, hard-delete PR removes `app/api/auth/login/route.ts`, `app/api/auth/register/route.ts`, and `components/onboarding/linear/` directory |

### Risk

**Very low.** The 410 stubs introduce no new runtime behaviour against any code path that is currently used. The linear-wizard `@deprecated` marker is a comment — zero runtime impact. The IMPLEMENTATION_PLAN updates are documentation only. No financial calculations, no DB queries, no schema changes, no destructive Prisma writes (CLAUDE.md §12.11 N/A), no schema migrations (§12.12 N/A).
