# Changelog - 2026-06-12

## Session: gallant-gates-kb264m (continued)

### Changes Made — Phase 47 Stage F planned: Structure Capture Completion
- **Type**: Planning / documentation (no code)
- **Scope**: `docs/blueprint/PHASE_47_ENTITY_OWNERSHIP_FABRIC.md` (new §4 Stage F), `docs/IMPLEMENTATION_PLAN.md`
- **Driver**: Reza compared his advisor-drawn **Renew Group structure chart** against Monitrax (2026-06-12) and asked whether everything is capturable — bare trusts/bare trustee companies, directors, secretaries, members, shareholders with share classes/counts. Then: *"plan the build to add all possible entities and their relationship not just this example. The onboarding wizard should be able to capture most of this but fine tuning and further details should be also available through my structure page."*
- **Audit findings (verified in code this session)**:
  - The Phase 44 schema represents EVERY chart element (19 `LegalEntityType`s incl. `BARE_TRUST` built for the SMSF LRBA case, 19 `EntityRelationshipType`s incl. `SECRETARY_OF`, `ShareParcel` with class/quantity/paid/CGT-date, `BeneficialOwnershipBasis.BARE_TRUST`).
  - The capture surfaces don't: API whitelist (`app/api/entities/route.ts`) + create dialog stop at the original 7 types and 5 roles; the only relationship-creation UI is the onboarding wizard skeleton (5 edge types); `ShareParcel` has **no writer anywhere**.
  - **Capability-regression discovery**: Phase 44 1c HAD a full relationship editor (`EntityDetailDialog` — add/end/delete + live `classifyEdge` validity preview); it was deleted 2026-05-31 with the legacy `EntityCanvas` retirement and the Wealth Universe's `EntityDetailPanel` never inherited it. Stage F is restoration + completion in the universe's design language, not greenfield — the rules engine, only-writer service, and API routes are all live.
- **The plan (4 PRs, one per sub-stage)**: F1 unlock the full entity-type grammar (API whitelist + two-tier "Common / More structures" picker + universe classification) → F2 "Roles & People" editor on My Structure (full 19-type grammar, end-dating, beneficial-ownership "actually held for…" row, live validity preview; Stitch-first) → F3 ShareParcel writer (nested route + parcel rows under shareholder/unitholder edges; dispose-never-delete for CGT history) → F4 onboarding-wizard fine-tune (same two-tier picker + optional per-entity "More detail" disclosure; D2 unchanged). Golden acceptance test `renewStructure.golden.test.ts` reproduces the Renew chart node-for-node.

### Files Modified
- `docs/blueprint/PHASE_47_ENTITY_OWNERSHIP_FABRIC.md` — §4 Stage F spec (gap matrix, F1–F4, F-G golden test, sequencing rationale, TRAIL mapping)
- `docs/IMPLEMENTATION_PLAN.md` — Stage F row added to the Phase 47 workstream checklist; Last touched updated

### Build Status
- Docs-only PR — no build-affecting changes (build verified green this session at WX.5.4).

### §17.2 post-merge verification — PR #1060 (WX.5.4)
- Prod deploy `dpl_6MLy28ed4rwHVbW1RaNMcdWMp1xJ` reached `READY` (2026-06-11 02:52:45), runtime logs clean — reported to Reza in session.

### Addendum — F2a "Entity File" per-type role templates (Reza, same day)
- Reza: *"there is an easy way to mark the company director, shareholders, trustee, beneficiary, etc for any entity based on the required type of entity… make sure all related information is captured and stored and used where and when needed."*
- Stage F spec amended: F2 gains **F2a** — canonical `lib/entity-graph/roleTemplates.ts` (per-type required/expected/optional roles, guidance layer beside the validity matrix's law layer), chart-style filled/missing role rows on the entity panel, per-entity completeness chip (invitation framing, never shame), explicit consumption map (panel, universe popover, accountant-review, Stage D tax facts, Stage E reports), and F4 re-pointed to the same template SSOT so wizard and editor can't drift.
---

## Session: email-verification-gcp-3ivh5a — unified `/auth/action` handler

### Changes Made
- **Type**: Feature (consolidation) + incident fix — resolves Open Question Q-AUTH-1
- **Scope**: Authentication / Firebase email action links

### Incident context (2026-06-12)
Sign-in hung (`auth/network-request-failed`) and every email-verification link
returned **403 `API_KEY_HTTP_REFERRER_BLOCKED`** ("Requests from referer
https://monitrax-479700.firebaseapp.com/ are blocked"). Root cause: a GCP
**API-key HTTP-referrer restriction** in the console, compounded by a
two-key split:
- App sign-in uses the **Monitrax Auth (Web)** key (= Vercel
  `NEXT_PUBLIC_FIREBASE_API_KEY`).
- Firebase's **hosted** action handler (`firebaseapp.com/__/auth/action`)
  signs verify/reset links with the **project's default web key**, which on
  this project is the **"Monitrax frontend (Maps Embed + Places)"** key —
  whose referrer allow-list didn't include `firebaseapp.com`.

The link's `apiKey=…` URL param proved the two keys differed. The project has
**no registered Firebase Web app** (config injected via env vars), which is
why the hosted handler's default key drifted to an unrelated Maps key.

### Solution
New prefetch-safe **`/auth/action`** page (`app/auth/action/page.tsx`) — the
single Monitrax-hosted target for Firebase's "Customise action URL". Handles
`verifyEmail` + `resetPassword` + `recoverEmail`. Because the code is applied
by OUR client SDK, it uses the app's **Monitrax Auth (Web)** key on
`www.monitrax.com.au` — the firebaseapp.com hosted handler and the Maps key
leave the auth path entirely. Prefetch-safe: read-only validation on load
(`checkActionCode` / `verifyPasswordResetCode`), code consumed only on an
explicit button tap (verify/recover) or form submit (reset). Closes the
password-reset prefetch exposure (Q-AUTH-1) too.

### Files Modified
- `app/auth/action/page.tsx` — NEW unified handler (verify / reset / recover)
- `lib/context/AuthContext.tsx` — verification continue-URL `/verify-email` → `/dashboard`

### Operator steps (Reza — Firebase/GCP console)
1. **Customise action URL** → Firebase → Authentication → Templates →
   `https://www.monitrax.com.au/auth/action` (covers verify + reset + recover).
2. **Monitrax Auth (Web)** key: Websites = `www.monitrax.com.au/*`,
   `monitrax.com.au/*`, `monitrax-479700.firebaseapp.com/*`, `localhost:*`;
   APIs = Identity Toolkit + Token Service.
3. No Vercel change — `NEXT_PUBLIC_FIREBASE_API_KEY` already = Monitrax Auth (Web).
4. (Optional hygiene) drop auth scopes/referrers from the Maps key.

### Build Status
| Step | Status | Notes |
|------|--------|-------|
| tsc --noEmit | PASS | no errors in changed files |
| Lint | PASS | `next lint` 0 warnings/errors |
| Build | PASS | `next build` ✓ — `/auth/action` 4.61 kB |

### Documentation Updated
- `docs/operational/security/01_AUTHENTICATION.md` — unified handler + new
  § Troubleshooting (`API_KEY_HTTP_REFERRER_BLOCKED`, two-key split, no-web-app note)
- `docs/IMPLEMENTATION_PLAN.md` — Q-AUTH-1 marked DECIDED/BUILT

---

## Session: serene-goodall-6smazx — Phase 49.14 (confidence bands as list filters + the discrepancy fix)

Reza live-test report (2026-06-12, three parts): (1) transactions in the list LOOK confident
(calm category tones) while the card says nothing high/medium remains; (2) "Review low"
shows DIFFERENT items than the list; (3) wants high/medium/low as filters so each band's
transactions + confirmed status are visible and comparable. Plus the simplicity directive:
*"we need to make sure the solution is simple enough for everyone to understand."*

**Root causes found:**
1. **Pill-tint bug** — the Phase 49.12 `uncertain` check had a `> 0` guard, so rows with
   confidenceScore EXACTLY 0 (the AI-fallback rows written during the Gemini outage) never
   took the rose tint — they wore calm category tones and masqueraded as confident. Fixed:
   `confidenceScore !== null && < 0.9 && !userCorrectedCategory`.
2. **Two populations, one band name** — "Review low" listed TransactionReviewQueue items
   (imports not yet in the books) while the main list holds BOOKED low-score transactions
   (outage-era fallback rows). Different tables → different lists → Reza's discrepancy.

**Fix — the confidence bands are now plain list filters (Stitch-first per §18.2.1; design
deliberately SIMPLIFIED to one list + plain words after Reza's directive — screens
84594a33076847f6909990ceffc08e66 → simplified 05d687e487894fd988a904280f47184a, artefact
`.stitch/designs/phase49.14/confidence-lens-desktop-light.{html,png}`):**
- Three chips — High (emerald) / Medium (amber) / Low (rose) — counts now include
  EVERYTHING in the band (queue + booked) so the chip number matches what clicking shows.
- Clicking a band shows: the "New — confirm to add" card (queue items, plain-English header
  replacing the old clinical blurbs) followed by the band-filtered booked list.
- Every booked row in band mode carries a plain status chip: emerald "✓ Confirmed" vs ghost
  "Not confirmed yet" — and any unconfirmed row gets the one-tap "✓ Looks right" confirm
  (previously only uncertain rows had it).
- NEW `confidence=high|medium|low` filter on GET /api/unified-transactions (high ≥0.9,
  medium 0.7–0.9, low <0.7 incl. score-0 fallback rows; NULL = no AI, excluded).
- `getConfidenceSummary` gains txMedium/txLow (booked rows in those score ranges).

### Files Modified
- `app/api/unified-transactions/route.ts` — confidence band filter param
- `lib/bank/bulkConfirm.ts` — txMedium/txLow in the summary
- `app/dashboard/activity/page.tsx` — band chips ×3 with combined counts, band-lens render
  (queue card + filtered booked list), per-row ✓ Confirmed / Not confirmed chips, pill
  score-0 tint fix, plain-English queue header copy
- `.stitch/designs/phase49.14/confidence-lens-desktop-light.{html,png}` — NEW artefact

### Build Status
- [x] tsc clean (after `prisma generate` for the merged audit-enum values)
- [x] Build passes (`npm run build`)

### §17.2 post-merge verification — PR #1081
- Production deploy `dpl_9LdfsWTs9NUBNAVBoWGcopjsYaQa` reached `READY` after ~3 min.
  Runtime logs clean — only pre-existing DEP0169 noise.

---

## Session: gracious-sagan-42r5le — Admin portal: user detail real data + GCP-enforced suspend + full-portal audit

### Changes Made
- **Type**: Fix + Feature + Cleanup
- **Scope**: Admin portal user management (`/admin/users/[userId]`), Identity Platform admin module, subscription API
- **Root Cause**: The Phase 33 user-detail page shipped as scaffold and was never wired — it rendered a hardcoded `mockUser` ("John Smith") regardless of which user was clicked, and Suspend/Impersonate/Update Subscription were `console.log` stubs. The ADMIN_PORTAL_COMPLETION_PLAN mock-data inventory only listed top-level pages, so the detail page slipped through when the list pages migrated to real data. Separately, "suspension" had no enforcement anywhere: nothing in the consumer app reads `UserSubscription.status`, so even a wired DB flag would have been cosmetic.
- **Solution**:
  1. Rewired `app/admin/users/[userId]/page.tsx` to the existing `GET /api/admin/users/:userId` — real profile, entity counts, subscription, org memberships; loading/error/retry states; mock data and the fabricated activity feed deleted (an honest smaller page beats a fake-rich one); Impersonate button removed (no backend exists — queued for its own design pass).
  2. Suspend/reactivate enforced at the IAM authority per Reza's directive ("portal is used as a UI but IAM and IDM is done through GCP"): new `setIdentityDisabledByEmail()` in `lib/auth/identityPlatformAdmin.ts` (Identity Platform Admin REST `accounts:update {disableUser}`, same WIF impersonation chain + `roles/firebaseauth.admin` grant as the right-to-erasure executor). The subscription PATCH disables/enables the GCP identity FIRST and only then mirrors `UserSubscription.status`; if the identity call fails the route returns 502 and writes nothing. Lockout: sign-in + refresh blocked immediately; already-issued ID tokens expire ≤1h (stateless JWKS verification — deliberately no per-request revocation query, §12.10 + the 2026-05-20 pool incident).
  3. Audit: `USER_SUSPENDED` / `USER_REACTIVATED` actions with the Identity Platform outcome in metadata; 404 added when the target user doesn't exist.
  4. §12.1 dead code: `lib/admin/services/` deleted entirely (8 files — client fetch-wrapper layer with zero importers, calling endpoints that don't exist, e.g. `POST .../suspend`). §12.2: the users list page's local `TIER_MRR` map replaced with canonical `USER_TIER_LIMITS[].monthlyPrice`.

### Full admin portal dummy-data audit (same session, Reza request)
Audited every page under `app/admin/**` against `app/api/admin/**`:
- **REAL (22+ pages):** login/MFA, dashboard, analytics, audit-logs (+compliance/export), billing, users list, organizations list, security, settings, feature flags (incl. create modal), CDR compliance, GCP security-findings / errors / uptime / scheduler, support + support/logs, feedback, marketplace listings (+detail), AI advisor demo, calc-audit. All actions wired to live endpoints.
- **Gaps found (queued in IMPLEMENTATION_PLAN Up Next):**
  - `/admin/organizations/[orgId]` — fully mock ("Acme Accounting", 3 stub handlers, `page.tsx:20-67`); backend GET/PATCH + license routes exist → frontend wiring only.
  - `POST /api/admin/users/[userId]/impersonate` does not exist — `/admin/support/impersonate` calls it and 404s. Needs a design pass (audit/CDR implications) before building.

### Files Modified
- `app/admin/users/[userId]/page.tsx` — full rewrite: mock → real API data + wired suspend/reactivate/tier-change
- `app/admin/users/page.tsx` — local `TIER_MRR` → canonical `USER_TIER_LIMITS`
- `app/api/admin/users/[userId]/subscription/route.ts` — user-existence check (404), IAM-authority-first suspend/reactivate orchestration, richer audit actions
- `lib/auth/identityPlatformAdmin.ts` — `setIdentityDisabledByEmail()` + scope/suspension-semantics header docs
- `lib/admin/index.ts` — header note updated for the services deletion
- `lib/admin/services/*` — DELETED (8 files, orphaned)

### Documentation Updated
- `docs/operational/security/01_AUTHENTICATION.md` — new § User Suspension (Admin Portal)
- `docs/operational/security/02_IAM_AND_PERMISSIONS.md` — `roles/firebaseauth.admin` row + least-privilege custom role now includes `firebaseauth.users.update`
- `docs/blueprint/ADMIN_PORTAL_COMPLETION_PLAN.md` — mock-data inventory corrected + 2026-06-12 re-audit note
- `docs/blueprint/PHASE_33_ADMIN_PORTAL.md` — Phase 33.3 status updated
- `docs/IMPLEMENTATION_PLAN.md` — Recently Completed entry + Up Next row for the remaining gaps

### Build Status
- [x] Build passes (`npm run build`)
- [x] Changed files lint clean (repo lint baseline of 99 pre-existing errors unchanged)
- [ ] Tests — no test suite covers the admin portal pages (pre-existing)

### Destructive writes (§12.11)
- `prisma.userSubscription.upsert` in the subscription PATCH (pre-existing operation, modified in this PR) — see the PR body checklist. No schema change; no migration needed.

### Commit History
| Hash | Message |
|------|---------|
| ecbc5f3 | fix(admin): wire user detail page to real data + GCP-enforced suspend |

---

## Session: gracious-sagan-42r5le (PR 2) — Admin org-detail page real data + license-suspension enforcement

### Changes Made
- **Type**: Fix + Feature
- **Scope**: Admin portal org management (`/admin/organizations/[orgId]`), portal access-control layer
- **Root Cause**: Same disease as the user-detail page (PR #1084) — the Phase 33 org-detail page was scaffold-only: hardcoded "Acme Accounting" mock, `orgId` never used, Update License / Suspend buttons were `console.log` stubs. And `OrganizationLicense.status = 'suspended'` was read by NOTHING in the portal layer — a suspended firm would have retained full access to client financial data.
- **Solution**:
  1. `app/admin/organizations/[orgId]/page.tsx` — full rewrite onto `GET /api/admin/organizations/:orgId`: real org profile, license, members table, portal settings (ABN, portal enabled), client count; license management (plan/limits/notes) and suspend/reactivate (reason required) wired to `PATCH .../license`; mock members/activity deleted.
  2. **Enforcement** — new `lib/portal/licenseGuard.ts` → `isOrgLicenseSuspended()` wired into the three canonical portal access points: `lib/portal/adviserClientAccess.ts` `verifyAdviserClientAccess()` (new `ORG_SUSPENDED` 403 error code — the canonical client-data gate), `lib/services/masterFinancialService.ts` `loadOrganizationClient()` (scoped-snapshot consent verifier returns null), `lib/auth/guards.ts` `withPortalFeatureGate()` (403 before plan-tier check).
  3. Semantics (deliberate contrast with user suspension): org suspension is a firm-level billing/compliance state — members keep their personal Monitrax accounts and identities; the firm loses portal access to CLIENT data and gated features. Client consent rows are NOT revoked; access resumes on reactivation.

### Files Modified
- `app/admin/organizations/[orgId]/page.tsx` — full rewrite: mock → real API data + wired license/suspend actions
- `lib/portal/licenseGuard.ts` — NEW: canonical `isOrgLicenseSuspended()` helper (file-header documents semantics + wiring points)
- `lib/portal/adviserClientAccess.ts` — license check as layer 3; new `ORG_SUSPENDED` error code
- `lib/services/masterFinancialService.ts` — `loadOrganizationClient()` denies suspended orgs
- `lib/auth/guards.ts` — `withPortalFeatureGate()` denies suspended orgs

### Documentation Updated
- `docs/operational/security/03_CDR_COMPLIANCE.md` — new § Organization Suspension Cuts Client-Data Access
- `docs/blueprint/PHASE_33_ADMIN_PORTAL.md` — Phase 33.2 status
- `docs/blueprint/ADMIN_PORTAL_COMPLETION_PLAN.md` — org-detail gap closed
- `docs/IMPLEMENTATION_PLAN.md` — Recently Completed entry; Up Next row reduced to the impersonation gap

### Build Status
- [x] Build passes (`npm run build`)
- [x] Changed files lint clean (repo baseline unchanged)
- [x] Tests: 105/105 (tests/calculations + tests/portal via vitest)

### Destructive writes (§12.11)
- `prisma.organizationLicense.upsert` in the license PATCH — pre-existing operation, NOT modified in this PR (frontend now calls it; checklist in PR body for transparency).

### §17.2 post-merge verification — PR #1084 (user-detail PR, earlier this session)
- Production deploy `dpl_ozk25Q8LkMPSG32d62ivd4zm1po5` reached `READY` (~3 min build).
- Runtime logs: empty response — no traffic on the new deploy yet at 03:20 UTC (§17.6 "no logs in retention window" case, not an error). Preview of the same commit built + served green pre-merge. Re-scan on first traffic.

---

## Session: gracious-sagan-42r5le (PR 3) — Real Last Login + activity timeline, impersonation 404 removed, users-list N+1 fixed

### Changes Made
- **Type**: Feature + Fix + Cleanup
- **Scope**: Admin portal user management + support tools
- **Root Cause**: (a) The user list/detail pages showed "Last Login: -" and no activity because the APIs never exposed data that already exists in `LoginAttempt` and `AuditLog`. (b) `/admin/support/impersonate`'s Impersonate button called `POST /api/admin/users/[userId]/impersonate` — an endpoint that was never built — so every click 404'd; its "recent sessions" table queried a non-existent audit action and was permanently empty. (c) The users list API ran a per-user `userSubscription.findUnique` loop (N+1, §12.10).
- **Solution**:
  1. `GET /api/admin/users/:userId` returns `lastLoginAt` (latest successful `LoginAttempt`) + `recentActivity` (last 10 `AuditLog` events — action/status/entityType/ip/timestamp only; **metadata deliberately excluded** per CDR §13.3). Detail page renders real Last Login + a real Recent Activity card.
  2. Users list API batched to 2 page-level queries (`userSubscription.findMany` + `loginAttempt.groupBy`); list shows real Last Login.
  3. `/admin/support/impersonate` repurposed to an honest "User Lookup" page — search routes to the real user-detail profile; broken action + empty sessions table deleted; support-landing tile copy updated; dead `ADMIN_API_ROUTES.USER_IMPERSONATE` constant removed (§12.1). Real impersonation queued in `IMPLEMENTATION_PLAN.md` Up Next pending a design doc (recommended: read-only view-as via the `viewerContext` pattern, time-boxed, fully audited).

### Files Modified
- `app/api/admin/users/[userId]/route.ts` — `lastLoginAt` + `recentActivity` (batched Promise.all)
- `app/api/admin/users/route.ts` — N+1 → 2 batched queries; `lastLoginAt` in payload
- `app/admin/users/[userId]/page.tsx` — Last Login cell + Recent Activity card
- `app/admin/users/page.tsx` — real Last Login column
- `app/admin/support/impersonate/page.tsx` — rewrite: User Lookup (honest interim)
- `app/admin/support/page.tsx` — tile copy
- `lib/admin/constants.ts` — dead `USER_IMPERSONATE` route constant removed

### Documentation Updated
- `docs/IMPLEMENTATION_PLAN.md` — PR 3 completed entry; Up Next row now scoped to the impersonation design pass with the recommended shape
- `docs/blueprint/PHASE_33_ADMIN_PORTAL.md` — Phase 33.3 activity logs ✅
- `docs/blueprint/ADMIN_PORTAL_COMPLETION_PLAN.md` — impersonation interim fix noted

### Build Status
- [x] Build passes (`npm run build`)
- [x] Changed files lint clean (repo baseline unchanged)

### Destructive writes (§12.11)
- None — this PR adds reads only (findFirst/findMany/groupBy) and UI changes.
## Session: trusting-cerf-v19b70 — "Start fresh" full data reset (Settings → Privacy Danger Zone)

### Changes Made
- **Type**: Feature
- **Scope**: Account lifecycle — new reset executor service, API endpoint, Settings UI, audit action
- **Why**: Reza (2026-06-12): *"sometimes users data will get so out of hand they want to start over, a fresh start as a new user. or just delete all their data and logoff for good. I don't see an option for that in the settings."* Research findings: (a) "delete and leave for good" already exists (Settings → Security Danger Zone, 30-day grace, `accountDeletion.ts`) but was undiscoverable — Reza himself looked in the Privacy danger zone and didn't find it; (b) "wipe data, keep account" did not exist (`lib/testing/reset.ts` is testing-only and incomplete).
- **Solution**:
  1. **`lib/services/accountReset.ts`** — canonical reset executor, sibling of `accountDeletion.ts`. Classifies all 74 user-owned Prisma models into exported DELETE (51) / KEEP (22) / CDR-delegated (1) lists with documented rationale (legal consents, audit logs, AFSL-retained adviser communications, auth/security, billing, integrations and app preferences survive). CDR purge delegates to `deleteCDRData()` (remote Basiq + local). Single 60s transaction: 7 Restrict-bearing entity models first (same proven order as `accountDeletion.ts`), then the rest, then User onboarding flags reset (`onboardingCompleted=false`, `onboardingStep=0`, `basiqUserId=null`) so the wizard treats them as day one.
  2. **DMMF drift test** `tests/services/accountReset.classification.test.ts` (4 tests) — fails the build if a new user-owned model is unclassified, double-classified, lacks a `userId` column while in DELETE, or if the Restrict-aware wipe order is violated. Same structural-drift defence as the 2026-06-11 AuditAction enum fix.
  3. **`POST /api/account/reset`** — `withPermission('account.delete')`, server-side type-RESET re-validation (400), active-adviser-link guard via `OrganizationClient` non-ARCHIVED statuses (409), `maxDuration=120`. Audited `USER_DATA_RESET` (new enum value + additive migration `20260615000000_add_user_data_reset_audit_action`).
  4. **`components/settings/StartFreshDialog.tsx`** — Stitch-first (§18.2.1) glass dialog: centred modal desktop / bottom sheet mobile, rose→amber destructive sub-palette, WHAT GOES vs WHAT STAYS comparison grid (behaviour-psychology: transparency reduces anxiety), export-first JSON nudge (reuses `/api/account/export`), type-RESET gate, success routes to `/onboarding`.
  5. **Privacy page Danger Zone** (`app/dashboard/settings/privacy/page.tsx`) gains two cards following the existing card pattern: "Start Fresh" (opens the dialog) and "Delete Account" (cross-link to Settings → Security — the discoverability fix; the full 30-day flow stays canonical there, §12.4 no duplication).

### Stitch (CLAUDE.md §18)
- Project `1859462351962811110`, screens: `a1e90a99dc7c4ea38bc4d82a96e910b5` (desktop light), `e25724ebe7ec43d5806268cbf6c0dcb2` (desktop dark), `63d60c3325a2490e8af081b7ec47e197` (mobile light), `e7a8d990084742259a0c8b38d6ef815c` (mobile dark).
- Artefacts committed: `.stitch/designs/start-fresh/start-fresh-dialog{,-dark,-mobile,-mobile-dark}-v1.{html,png}`. Prompts seeded with §18.7.2 principles (glass, radii, rose-for-destruction money signal, warm copy).
- The two Danger-Zone cards follow the page's existing approved card pattern (§18.2.1 "single control added within an approved section" tweak class); the dialog is the new composition and carries the Stitch pass.

### Files Modified
- `lib/services/accountReset.ts` — NEW canonical reset executor + classification lists
- `tests/services/accountReset.classification.test.ts` — NEW DMMF drift test (4 tests)
- `app/api/account/reset/route.ts` — NEW endpoint
- `components/settings/StartFreshDialog.tsx` — NEW dialog (Stitch-sourced)
- `app/dashboard/settings/privacy/page.tsx` — Danger Zone: + Start Fresh card, + Delete Account cross-link, dialog mount
- `prisma/schema.prisma` — `USER_DATA_RESET` enum value
- `prisma/migrations/20260615000000_add_user_data_reset_audit_action/migration.sql` — NEW additive migration
- `docs/architecture/07_API_STANDARDS.md` — endpoint section
- `docs/architecture/03_DATA_MODEL.md` — §N.5 addendum (USER_DATA_RESET)
- `docs/IMPLEMENTATION_PLAN.md` — Recently Completed entry

### Destructive write checklist (CLAUDE.md §12.11)
Operations: `deleteMany({ where: { userId } })` across the 51 RESET_DELETE_MODELS + `user.update({ where: { id: userId } })` in `lib/services/accountReset.ts`.
1. **`where` matches:** only rows belonging to the requesting user (`userId` from the verified bearer token; never from the body). The drift test asserts every DELETE model has a literal `userId` column.
2. **Columns/rows:** all financial-data rows for that user (that is the feature); on User only onboarding flags + `basiqUserId` are overwritten — identity/email/password/security/trusted-contact untouched.
3. **Guard:** explicit type-RESET confirmation validated client AND server side; active-adviser-link 409 block; single transaction (all-or-nothing); KEEP list excludes legal/compliance/billing/auth models; classification enforced by test.
User confirmation: feature explicitly requested and approved by Reza 2026-06-12 ("go ahead and build it based on your recommendations").

### Build Status
- [x] `tsc --noEmit` — 0 errors
- [x] `npm run build` — green (418 pages, `/api/account/reset` registered)
- [x] `npx vitest run` — 2469 passed, 0 failed (incl. 4 new classification tests)
- [ ] Manual prod verification post-merge (§17.2)

---

## Session: gallant-gates-kb264m (continued) — Phase 47 F1 build

### Changes Made — F1: full entity-type grammar unlocked
- **Type**: Feature (Stage F PR 1 of 4; Reza: "go")
- **Scope**: entity capture surfaces — catalog, service, API routes, My Structure dialog, universe classification
- **Solution**:
  - **`lib/entities/entityTypeCatalog.ts` (new, canonical SSOT)** — two tiers (7 common / 12 extended = the full 19-type Phase 44 grammar), warm labels + one-line descriptions (§14.3), trust-family + company-family groupings, `deriveTrustType` (keeps Phase 41E Measure-3 dispatch correct by construction: FIXED/HYBRID/TESTAMENTARY/BARE map to correctly-EXCLUDED subtypes, §12.14), per-type field applicability, default roles. Consumed by the dialog AND both API routes; F4 re-points the wizard.
  - **Service** (`legalEntityService.ts`): Create/Update inputs + summary gain `companySubtype`/`dateOfBirth`/`vestingDate`/`deedDate`/`estateAdministrationStatus` (per-type gated persistence); trustType persists for the whole trust family with auto-derive; trustType input unions widened to the Prisma enum (HYBRID/TESTAMENTARY).
  - **API** (`/api/entities` POST + `[id]` PUT): whitelists → all 19 types + 6 roles (CORPORATE_TRUSTEE was missing); extended fields validated at the boundary (closed enums, ISO dates).
  - **Dialog** (`app/dashboard/entities/page.tsx`): two-tier `EntityTypePicker` (Common cards first paint; "More structures (12)" expander, auto-open when editing an extended-type entity); per-type conditional fields; Role picker includes Corporate trustee; dialog scrollable.
  - **Universe** (`wealthExplorerLayout.classifyEntity`): trust family + deceased estate → trust vocabulary; custodian/platform → trustee-company; foreign company/assoc/co-op/strata → other-company.
- **Stitch (§18.2.1)**: section-level composition designed first — light `eb5dd4a37e5c47b087d2405f50d13f49` + dark `c3c62699a61c4439a5d06a5ac7fcb5af`, artefacts at `.stitch/designs/phase47-f1/add-entity-two-tier-picker{,-dark}.{html,png}`, recorded in `.stitch/metadata.json`. Mobile variants ride F2's Stitch pass (consolidated with Stage A's OWED debt).
- **No schema change** — every column already existed (Phase 44 1a); no migration (§12.12 n/a).
- **Tests**: 7 new catalog tests + extended-type universe classification test — 104 total green across wealth-explorer/ownership/entities/entity-graph suites.

### Files Modified
- `lib/entities/entityTypeCatalog.ts` (new), `lib/services/legalEntityService.ts`, `app/api/entities/route.ts`, `app/api/entities/[id]/route.ts`, `app/dashboard/entities/page.tsx`, `lib/data/wealthExplorerLayout.ts`, `tests/entities/entityTypeCatalog.test.ts` (new), `tests/wealth-explorer/semanticZoomLayout.test.ts`, `.stitch/{metadata.json,designs/phase47-f1/*}`, `docs/blueprint/PHASE_47_ENTITY_OWNERSHIP_FABRIC.md`, `docs/IMPLEMENTATION_PLAN.md`

### Build Status
- [x] tsc 0 (after `prisma generate` — client was stale post main-merge) / eslint 0 / financial gate 0 / 104 tests / `npm run build` 0

### §17.2 post-merge verification — PR #1089 (Stage F plan)
- Prod deploy `dpl_GMHhTQBaQp4zKFR3juoBoKQoYEBo` reached `READY` (2026-06-12 07:43:00) — docs-only merge, clean.

---

## Session: gallant-gates-kb264m (continued) — Phase 47 F2 build

### Changes Made — F2: "Roles & People" editor (the Entity File)
- **Type**: Feature (Stage F PR 2 of 4)
- **Scope**: `lib/entity-graph/roleTemplates.ts` (new, F2a SSOT), `components/wealth-explorer/RolesAndPeopleSection.tsx` (new), wired into `EntityDetailPanel` (desktop) + `WealthUniverseMobile` (sheet)
- **Solution**: restores the relationship editing deleted with the legacy EntityCanvas (2026-05-31), in universe vocabulary + the F2a Entity File pattern:
  - Per-type template rows (company → Directors/Shareholders/Secretary; trust → Trustee/Beneficiaries/Appointor/Settlor; SMSF → Trustee/Members; bare trust → Trustee + Held-for, both required — the LRBA shape; deceased estate → Executor/Administrator anyOf row). Filled rows = counterpart chips with end-role affordance (closes the edge, keeps history); empty required/expected rows = quiet dashed invitations.
  - "Structure file N/M" completeness chip (invitation framing).
  - "More roles" → full 19-type grammar (graphMeta groups) with **live §6.2 validity preview** via pure `classifyEdge` — exactly the deleted 1c dialog's contract: amber records, red blocks.
  - Counterpart quick-create (INDIVIDUAL) inline.
  - "Actually held for…" — lists + records `BeneficialOwnershipOverride` rows on the entity's assets (basis picker incl. Bare trust / Nominee / Custodian).
  - All writes via the retained Phase 44 client + routes; no new fetch layer, nothing financial computed in the component (§8.3/§8.4).
- **Stitch (§18)**: Entity File panel screen `88f4ac2d8f6544bdbacb90fbb4bf9072`, artefact `.stitch/designs/phase47-f2/entity-file-roles-people-dark.{html,png}` (dark — the panel is the dark universe surface).
- **Tests**: 7 role-template tests; 111 total green. tsc/eslint/gate/build all pass.

---

## Session: gallant-gates-kb264m (continued) — Phase 47 F3 build

### Changes Made — F3: share parcels (the "[500 ORD]" detail becomes data)
- **Type**: Feature (Stage F PR 3 of 4)
- **Solution**:
  - **Service** (`entityRelationshipService` — stays the ONLY graph writer §8.4): `listShareParcels` / `addShareParcel` / `updateShareParcel` / `deleteShareParcel`. Ownership resolves through the parent SHAREHOLDER_OF/UNITHOLDER_OF edge inside the transaction (§12.11 composite guard); kind auto-derives (UNIT for unitholder edges); **disposal sets `disposedAt`, never deletes** — CGT history is sacred. All writes audited.
  - **API**: `/api/entities/relationships/[id]/parcels` (GET/POST) + `/[parcelId]` (PATCH incl. dispose / DELETE for mistakes), boundary-validated.
  - **UI**: each shareholder/unitholder chip in Roles & People gains a lazy parcel block — "500 ordinary · acquired 12 Mar 2021 · $1.00 paid", inline add form (quantity/class/paid/date), dispose action; disposed parcels render dimmed with their date.
  - **Universe**: `WealthGraphEdge.equitySummary` ("500 ORD" — active parcels, k-format, mixed-class aware) labels ownership ribbons: "Shareholder · 500 ORD".
- **Reza addition (same day)**: *"if entity is SMSF only available options for that entity is showing"* — the add-role dialog now lists the F2a template's roles first under "Suggested for this entity", with the full grammar grouped under "All roles ·" (guidance, never gates §14.3; the validity engine still judges everything live).
- **Tests/verify**: 111 green; tsc/eslint/financial-gate/build all pass. No schema change (ShareParcel shipped in 44 1a).

### §12.11 — destructive writes in this change
- `tx.shareParcel.update` / `tx.shareParcel.delete` (`entityRelationshipService.ts`): (1) where matches — only the parcel id confirmed in-transaction to hang off an edge with `userId = caller`; (2) columns — parcel detail fields the user explicitly edited / the row itself on mistaken-entry delete; (3) guard — `requireParcelEdge` join through `entityRelationship.userId` + parcel `relationshipId` check inside the same transaction. User confirmation: NOT REQUIRED (user-initiated edit of their own captured rows; dispose path never deletes).

---

## Session: gallant-gates-kb264m (continued) — Phase 47 F4 + F-LAW + golden test

### Changes Made — F4: wizard fine-tune + the law-completeness gap + the Renew golden test
- **Type**: Feature (Stage F PR 4 of 4 — Stage F capture surfaces COMPLETE)
- **F-LAW (Reza: "review the Australian laws and enable every possible entity and combinations")**: full audit written into the phase doc — the Phase 44 grammar holds against the AU structural inventory (companies all 5 ASIC forms, all trust shapes, SMSF w/ SIS rules, estates, associations/co-ops/strata/custodians, co-ownership per TR 93/32, explicit OTHER-flagged exclusions). **One material gap found + fixed: `partnershipSubtype`** (GENERAL/LIMITED/INCORPORATED_LIMITED/VCLP/ESVCLP — Div 5A taxes corporate LPs as companies; VCLP/ESVCLP carry 41E Measure 7). Nullable column + additive migration `20260612120000_add_partnership_subtype` + catalog + service + both API routes + dialog field.
- **F4 wizard**: type domain re-pointed to the catalog SSOT (two-tier grouped select: Common / More structures — full 19-type grammar, zero added friction); `rolesForEntityType` re-pointed to the F2a templates (wizard ↔ Entity File can never drift); optional roles (secretary/settlor/appointor/guardian/executor/administrator) behind a per-entity "More detail" disclosure (auto-opens when edges exist); ReviewStep note extended ("fine-tune roles, share details and unusual structures in My Structure"). **Documented scope trim**: share quick-entry stays OUT of the wizard — parcels live in F3's editor (growth lens: CGT detail mid-onboarding is friction without payoff; "finishable later" is genuinely true now).
- **F-G golden test** (`tests/entity-graph/renewStructure.golden.test.ts`): Reza's advisor chart node-for-node — 10 entities, 29 edges (directors, secretaries, shareholders, members, beneficiaries incl. bucket-company, ATF links, spouse, LRBA bare trust held for the SMSF). Asserts: nothing IMPOSSIBLE, the SMSF passes SIS s17A member⇔director rules **VALID**, the universe renders every node with the right vocabulary, every chart row is capturable via its type template. **Passes.**
- **Verify**: 2,488 tests green (full suite); tsc/eslint/financial gate/build all pass.

### §12.12 — schema change
- `prisma/schema.prisma` + matching migration `prisma/migrations/20260612120000_add_partnership_subtype/migration.sql` in the same PR (single additive nullable TEXT column — no destructive DDL).
