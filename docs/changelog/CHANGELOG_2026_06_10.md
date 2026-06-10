# Changelog - 2026-06-10

## Session: email-verification-gcp-3ivh5a

### Changes Made
- **Type**: Feature + Fix + Dead-code removal
- **Scope**: Authentication / email verification / CDR gating
- **Root Cause**: Users could register with any fake email and use the app
  fully. Two verification systems coexisted, neither enforced:
  1. Firebase/GCP Identity Platform's `email_verified` claim was already
     parsed (`lib/auth/gcpTokenVerifier.ts:159`) and synced on user creation
     (`lib/auth/gcpIdentity.ts:251`) — but **no guard anywhere read it**.
  2. The Phase 05 custom module (`lib/security/emailVerification.ts`,
     Resend-backed) stored tokens in an **in-memory `Map`** — broken by
     design on Vercel serverless (the function instance that issues a token
     is almost never the one asked to verify it) — and was never called
     during registration anyway.
- **Solution**: GCP-first (CLAUDE.md §12.7). Firebase is now the single
  verification SSOT; the broken custom system is deleted. Posture chosen by
  Reza: **soft gate + hard-block CDR**, Firebase-native email template first.

### Architecture decisions
- **Gate reads the live token claim, never the DB row.** Firebase's
  `email_verified` only flips on token refresh, so `confirmEmailVerified()`
  force-refreshes (`getIdToken(true)`) before re-checking; server guards get
  the claim via the new `AuthContext.emailVerified` field. The DB columns
  (`User.emailVerified` / `emailVerifiedAt`) are bookkeeping that converges
  lazily (one-way false→true, guarded by the Google-signed claim).
- **Hard-block surface = the elevated CDR guards.** `requireVerifiedEmail`
  runs inside `withMFARequired` + `withActiveConsent` → 403
  `EMAIL_VERIFICATION_REQUIRED`. Covers Basiq connect and CDR data routes.
  Compliance rationale: consent notices and breach notifications must reach
  an inbox the account holder owns.
- **Soft gate everywhere else.** Dashboard stays open; `VerifyEmailBanner`
  names the one locked thing (bank connections) with resend/re-check
  actions. The interstitial offers "Skip for now" (behaviour-psychology
  lens: small-win moment, not a security scolding).
- **OAuth unaffected** — Google sign-ins arrive `email_verified: true`.

### Files Modified
- `lib/auth/context.ts` — `AuthContext.emailVerified` (live claim) + lazy DB
  true-up in `findOrSyncUser` fast path
- `lib/auth/guards.ts` — `requireVerifiedEmail` helper, wired into
  `withMFARequired` + `withActiveConsent`
- `lib/context/AuthContext.tsx` — `sendEmailVerification` on register
  (best-effort), `resendVerificationEmail()`, `confirmEmailVerified()`
- `app/register/page.tsx` — password signups route to `/verify-email-sent`;
  auth-redirect effect made verification-aware (race fix)
- `app/verify-email/page.tsx` — rewritten for Firebase `oobCode` /
  continue-URL shapes via `applyActionCode`
- `app/resend-verification/page.tsx` — rewritten signed-in-only (Firebase
  client SDK can only send to `currentUser`)
- `app/api/auth/verify-email/route.ts` — rewritten as claim-based DB true-up
  (verifies bearer token, requires `email_verified` claim, flips row, audits
  `EMAIL_VERIFIED`)
- `components/DashboardLayout.tsx` — renders `VerifyEmailBanner`
- `lib/security/index.ts` — removed re-exports of deleted module
- `package.json` / `package-lock.json` — `resend` dependency removed

### Files Created
- `app/verify-email-sent/page.tsx` — post-signup interstitial (Stitch screen
  `33717abc960b4fb6881a5de0d077abff`, project `1859462351962811110`)
- `components/auth/VerifyEmailBanner.tsx` — dashboard soft-gate banner
- `.stitch/designs/email-verification/verify-email-sent.{html,png}` — Stitch
  artefacts (§18.4)

### Files Deleted
- `lib/security/emailVerification.ts` (416 lines — in-memory token store,
  broken on serverless)
- `app/api/auth/resend-verification/route.ts` (consumer of the above)

### Stitch pass (§18)
Prompt seeded with the Deep Cosmos auth vocabulary (dark #0A0A14 + emerald
radial glow + centred 440px frosted card + hairline borders + single emerald
action colour) referencing the canonical `signin`/`register` screens.
One generation, on-target first pass. Implemented by composing existing
`AuthShell` primitives (per §18.1 step 5).

### Destructive write checklist (CLAUDE.md §12.11)
Operations touching existing rows:
- `lib/auth/context.ts` / `app/api/auth/verify-email/route.ts`:
  `prisma.user.update(...)`
1. **`where` matches:** the single User row linked (via
   `OAuthAccount.providerUserId`) to the verified Google-signed token's
   `uid` — i.e. the caller's own row only.
2. **Columns overwritten:** `emailVerified` (false→true only),
   `emailVerifiedAt` (null→now). System bookkeeping, never user-entered data.
3. **Guard:** write only fires when the cryptographically verified Firebase
   token carries `email_verified: true`; verified rows are never re-written.
User confirmation: NOT REQUIRED — one-way bookkeeping flip guarded by a
verified identity-provider claim; cannot clobber user-entered data.

### Documentation Updated
- `docs/operational/security/01_AUTHENTICATION.md` — new § Email Verification
  (flow, enforcement, resend, console diagnosis + optional action-URL config)
- `docs/operational/security/03_CDR_COMPLIANCE.md` — Pre-Consent Requirement:
  Verified Email
- `docs/operational/runbooks/11_EMAIL_NOTIFICATIONS_AUDIT.md` — path 1
  migrated Resend → Firebase; provider split updated (Resend: 0 paths)
- `docs/blueprint/PHASE_05_BACKEND_INTEGRATION.md` — §10 + status row +
  IMPLEMENTED-05-06 marked SUPERSEDED with pointers to current files
- `docs/IMPLEMENTATION_PLAN.md` — Recently Completed entry 2026-06-10
- `.stitch/SITE.md` §4 + `.stitch/metadata.json` — `verify-email-sent` screen

### Build Status
| Step | Status | Notes |
|------|--------|-------|
| Initial state | n/a | fresh clone, no node_modules |
| Final build | PASS | `next build` ✓ — `/verify-email-sent` 2.81 kB in route map |
| Lint (changed files) | PASS | `next lint` 0 warnings/errors |

### Follow-ups / deferred
- Portal (`/portal/*`) registration sets `emailVerified: false` with a
  "Require email verification" comment but still has no gate — B2B flow,
  separate design system; queue separately.
- Branded verification email (Admin SDK `generateEmailVerificationLink` +
  provider) if Firebase-template deliverability disappoints.
- Operator step (Reza): optionally customise the GCP Identity Platform
  "Email address verification" template (sender name + action URL →
  `https://www.monitrax.com.au/verify-email`); default hosted handler works
  without it.

### PR
- PR URL: (added after push)
- Status: Open (draft)
