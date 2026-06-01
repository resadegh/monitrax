# Changelog — 2026-06-01

## Session: account-deletion-executor-LFNFt — Right-to-erasure hard-delete executor

### Changes Made
- **Type**: Feature (compliance — closes a Privacy Act APP 11.2 / CDR §3.2 gap)
- **Scope**: Account deletion. `/api/account/delete-request` only ever set a
  30-day soft-delete timer; the schema comment + that route's docstring both
  promised a Cloud Scheduler hard-delete that **never existed**. "Delete my
  account" therefore erased nothing. This session builds that missing executor.

### Decision audit (CLAUDE.md §0 advisory mindset)

- **Architect / security lens drove the design.** Research surfaced that there
  is **no `firebase-admin` SDK** server-side (consumer tokens are verified with
  raw JWKS / `jwt.verify`, `lib/auth/gcpTokenVerifier.ts`) and `User.id` is a
  generated UUID — the Firebase UID lives on `OAuthAccount.providerUserId`. So
  deleting the auth identity is not a function call; it needs the **Identity
  Platform Admin REST API** authenticated with the existing WIF service account.
- **Resurrection is the load-bearing risk.** The auto-provisioning path
  (`lib/auth/gcpIdentity.ts`) re-creates a `User` row for any valid Firebase
  token. Deleting the data while leaving the identity = the account silently
  resurrects (empty) on next login. Hence **identity-first, abort-on-failure**:
  if the identity can't be removed, NO data is deleted and the soft-delete flags
  stay set so the next nightly run retries. No half-deleted, resurrectable
  accounts — ever.
- **Restrict-aware DB deletion.** The schema has exactly **7 `onDelete: Restrict`
  relations**, all `entity → LegalEntity`; everything else is Cascade/SetNull.
  A naive `user.delete()` can fail non-deterministically (it cascades
  `LegalEntity` while a `Property` still references it). Fix: delete the 7 entity
  models first, then `user.delete()` cascades the rest. Precedent:
  `lib/testing/reset.ts` (which predates `Asset` and misses it — the prod path
  covers all 7).
- **Behaviour-psychology lens on the UI.** The dialog copy said data is
  "anonymised" — but the executor does a true hard-delete. Corrected to
  "permanently and irreversibly deleted" (honesty over comfort), and added a
  **type-to-confirm** ("type DELETE") friction step matching the gravity, with
  the 30-day grace framed as the warm safety net.
- **Scope confirmed with Reza** (AskUserQuestion): "Build full executor now"
  — ships with the one-time IAM grant documented as the prerequisite to arm it.

### Files created
- `lib/auth/identityPlatformAdmin.ts` — WIF-authenticated Identity Platform
  Admin REST helper. `deleteIdentityByEmail(email)` → `{ status, deletedUids }`
  where status ∈ `deleted` / `not_found` / `skipped` (no GCP auth) / `failed`.
  Reuses the OIDC→STS→IAM-Credentials impersonation chain from `lib/db.ts`
  (no new secret), adds `cloud-platform` scope. Never throws.
- `lib/services/accountDeletion.ts` — `deleteUserAccount(userId, trigger)`
  (identity → CDR → ordered DB cascade → `USER_DELETED` audit) +
  `executeScheduledDeletions()` (sequential over due users).
- `app/api/account/lifecycle/route.ts` — Cloud Scheduler endpoint
  (`CRON_SECRET` bearer, timing-safe; mirrors `/api/cdr/lifecycle`).

### Files modified
- `app/dashboard/settings/security/page.tsx` — type-to-confirm input + honest
  hard-delete copy + reset-on-close.

### Destructive-write checklist (CLAUDE.md §12.11)
- `prisma.user.delete` + 7 `deleteMany` in `lib/services/accountDeletion.ts`.
  1. **WHERE matches:** only users with `deletionRequestedAt != null` AND
     `deletionScheduledFor <= now` — i.e. users who self-requested deletion and
     whose 30-day grace expired. Per-user re-read inside `deleteUserAccount`.
  2. **Rows:** full hard-delete of the user + owned entities (intended — this IS
     the erasure feature).
  3. **Guard:** identity-deletion runs first and ABORTS the data delete on
     failure; the trigger is the user's own expired, self-set timer.
  - User confirmation: granted 2026-06-01 ("Build full executor now").
- No `prisma/schema.prisma` change → no migration needed (§12.12 N/A).

### Build Status
- [x] `npx tsc --noEmit` — 0 errors project-wide
- [x] `npm run build` — passes; `/api/account/lifecycle` registered (ƒ Dynamic)
- [x] `next lint` on touched files — clean

### Reza-side console steps to arm the executor (documented)
1. Grant the WIF SA `roles/firebaseauth.admin` — runbook §6b / IAM doc.
2. Create the `monitrax-account-deletion-executor` Cloud Scheduler job — §4a.
   Until both are done, deletions safely no-op (abort-on-failure).

### Documentation updated in this PR
- `docs/operational/runbooks/05_RETENTION_SCHEDULERS.md` — §4a (the job) + §6b
  (the IAM grant) + jobs table row
- `docs/operational/security/02_IAM_AND_PERMISSIONS.md` — `firebaseauth.admin`
  grant + "Account-deletion executor" section
- `docs/operational/security/01_AUTHENTICATION.md` — "Account Deletion (Identity
  Removal)" section (identity-first / resurrection rationale)
- `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` — row 5.3a flipped from
  "Pending" to shipped + summary line
- `docs/IMPLEMENTATION_PLAN.md` — workstream completed + dead-promise closed
- `docs/changelog/CHANGELOG_2026_06_01.md` (this entry)

---

## Session: stitch-dashboard-redesign-LIlK9 — Dashboard chrome cleanup

### Changes Made
- **Type**: Bug fix (regression) + UX cleanup
- **Scope**: Dashboard chrome — desktop sidebar sign-out + AI / Help / Feedback bubble placement.
- **Origin**: Reza directive 2026-06-01:
  1. "there is no signout option on desktop, it used to be next to the account email"
  2. "the ai, help and feedback bubbles are over the search field and covering that … maybe its better to have them on the sidebar under a tab called help?"

### Decision audit (CLAUDE.md §0 advisory mindset)

Two issues, two decisions:

1. **Sign-out regression — restore in place.** Confirmed regression in
   commit `810d849` (Phase R2b chrome swap, 2026-05-27). The old
   `DashboardLayout`'s navy sidebar had an inline `<LogOut>` icon
   button next to the user row (line 555-573 of the pre-swap file).
   The editorial sidebar swap dropped it. No design call — restore
   the same affordance in the editorial sidebar.

2. **Bubble collision — fold into topbar right cluster, not sidebar.**
   Reza proposed a sidebar "Help" tab. Architect-mode review (the
   four lenses):
   - **Designer**: Linear / Mercury / Stripe pattern is a unified
     chrome-row at top-right, not a sidebar tab. Folding into the
     topbar's existing right cluster (search · bell · avatar) reads
     as one cohesive chrome strip.
   - **Behaviour psychologist**: AI Chat is a primary feature, not a
     help sub-item. Burying it under a Help sidebar entry demotes
     it from a 1-tap affordance to a 2-tap drill-down. That's a
     regression on the AI value proposition.
   - **Architect**: The 3 components were already designed as a
     header-bar cluster (per the docstring in `AiChatButton.tsx`
     from Reza directive 2026-05-07: "utility affordances belong in
     the header bar (Maps / Stocks / Settings pattern)"). The Phase
     R2b chrome swap broke them by adding a new search pill in the
     same fixed-top-right area without updating the bubble offsets.
     The structural fix is to put the buttons inside the topbar's
     right cluster — making the design intent explicit instead of
     racing two `fixed` clusters for the same pixels.
   - **Financial adviser**: N/A.

   Reza was given three options + Architect's recommendation;
   chose: "Fold into topbar right cluster."

### Implementation

#### 1. Sign-out restoration

- `components/editorial/shell/EditorialSidebar.tsx` — new optional
  `onSignOut?: () => void` prop. When provided, the account row
  restructures from a single `<Link>` into a flex container with
  the `<Link>` covering the avatar + name area and a sibling
  `<button>` with a `<LogOut>` icon. Click targets never overlap.
  Sign-out icon is hover-tinted red (`hover:bg-red-50
  hover:text-red-600`) — destructive-action signalling per the
  pre-swap pattern.
- `components/DashboardLayout.tsx` — passes `onSignOut={logout}` to
  `EditorialSidebar`. `logout` is the existing `useAuth()` callback
  (same one the mobile MoreSheet uses) — no new auth wiring.

#### 2. Bubble fold-in

- `components/AiChatButton.tsx`, `components/help/HelpDrawerButton.tsx`,
  `components/help/FeedbackButton.tsx` — each gains an optional
  `placement?: 'fixed' | 'inline'` prop. Default `'fixed'`
  (back-compat for any consumer outside `DashboardLayout`). When
  `'inline'`, the `fixed top-..right-..z-40` classes are dropped
  so the trigger sits inline in its parent's flow. Drawer/panel
  rendering is unchanged (still `fixed` — they're full-viewport
  overlays).
- `components/editorial/shell/EditorialTopBar.tsx` — new optional
  `chromeButtons?: React.ReactNode` prop. Rendered as a
  `<div className="hidden items-center gap-2 md:flex">` slot in
  the right cluster, between the search pill and the
  `<NotificationBell>`. Hidden on mobile so mobile keeps its
  existing floating-bubble pattern.
- `components/DashboardLayout.tsx` — passes the three buttons (with
  `placement="inline"`) via `chromeButtons` to `EditorialTopBar`.
  Order matches the legacy floating layout: 💬 Feedback · 🤖 AI ·
  ? Help. The original floating block is now wrapped in
  `<div className="md:hidden">` so mobile users keep the existing
  pattern unchanged.

Result on desktop right cluster:
```
[ Search 240px ] [ Feedback ] [ AI ] [ Help ] [ Bell ] [ Avatar ]
                gap-3        gap-2          gap-2  gap-3      gap-3
                            ↑ chromeButtons slot ↑
```

Result on mobile: no change — three bubbles stay `fixed top-right`
as before. The desktop inline buttons are `hidden md:flex`.

### State independence note

Because mobile + desktop render separate instances of each button
component (mobile-fixed + desktop-inline), open/close state is
independent per viewport. Resizing during use (e.g. opening AI on
desktop then dragging the window narrow) loses the open state — the
mobile instance starts closed. This is acceptable: viewport changes
mid-interaction are rare, and the affordance to reopen is one tap
away in both modes. The alternative (lifting state to a shared
context) would meaningfully increase complexity for a corner-case
benefit.

### Files modified
- `components/editorial/shell/EditorialSidebar.tsx` — restore sign-out
- `components/editorial/shell/EditorialTopBar.tsx` — `chromeButtons` slot
- `components/AiChatButton.tsx` — `placement` prop
- `components/help/HelpDrawerButton.tsx` — `placement` prop
- `components/help/FeedbackButton.tsx` — `placement` prop
- `components/DashboardLayout.tsx` — wire `onSignOut`, slot, mobile gate

### Documentation updated in this PR
- `docs/changelog/CHANGELOG_2026_06_01.md` (this file)
- `docs/IMPLEMENTATION_PLAN.md` — `↩️ Reversed Decisions` row added
  for the bubble-vs-search collision; `🗑️ Dead Code / Tech Debt`
  entry for the obsolete coordinated-offset rule in the three
  button file headers (now decorative — the inline placement
  doesn't use those offsets) — kept in code as audit history.

### CLAUDE.md compliance recap
- **§0 four-lens review** — designer / behaviour / architect lenses
  drove the bubble-placement decision (sidebar Help tab was
  considered + overridden with reasoning surfaced to user).
- **§12.1 zero dead code** — no orphans; the new `placement="fixed"`
  default keeps the components back-compat for any external
  consumer.
- **§14 warm-words / behaviour psychologist** — restoring sign-out
  is a security-trust obligation (a missing sign-out creates a
  panic moment).
- **§16 doc-sync** — this changelog + IMPLEMENTATION_PLAN updates
  shipped in the same PR per §16.5.

### Testing
- [x] `npm run build` — passes
- [x] `npm run lint:financial-surfaces` — 0 new violations
- [ ] Manual UI verification — desktop: sign-out icon visible next
  to account row, AI/Help/Feedback sit in topbar right cluster
  without covering search; mobile: floating bubbles still appear
  at top-right

---

## Session: balances-empty-state-add-fix-LFNFt

### Changes Made
- **Type**: Fix (prod regression — first-run users could not add anything)
- **Scope**: `app/dashboard/balances/page.tsx` (`EmptyState`)
- **Root Cause**: The dashboard redesign's Balances `EmptyState` ("Connect your
  first account") wired its **Add account** / **Add loan** buttons as bare
  `<Link>`s to `/dashboard/accounts` and `/dashboard/loans` — which navigate
  away instead of opening the add-form dialog. The page's real add flow is the
  `AccountFormDialog` / `LoanFormDialog`, opened by `setAccountPickerOpen(true)`
  / `setLoanPickerOpen(true)` (the same handlers the toolbar uses, and the
  `?action=add-account` / `?action=add-loan` deep-link handler). A same-page
  `?action=` `<Link>` wouldn't have worked either — that handler runs once on
  mount (`[]` deps), so a soft client nav wouldn't re-trigger it. Net effect:
  a brand-new user (no accounts/loans) had **no working way to add** — exactly
  the empty state where it matters most.
- **Solution**: `EmptyState` now takes `onAddAccount` / `onAddLoan` callbacks
  and the buttons call them directly (opening the always-mounted form dialogs),
  matching the working toolbar behaviour. Reza reported it from the live mobile
  app (net position $0, empty state).

### Files Modified
- `app/dashboard/balances/page.tsx` — `EmptyState` buttons → `onClick` handlers
  that open `AccountFormDialog` / `LoanFormDialog` (were `<Link>`s navigating
  away). Render site passes `onAddAccount`/`onAddLoan`.

### Build Status
- [x] `tsc --noEmit` — 0 errors (whole project)
- [x] `npm run lint:financial-surfaces` — exit 0 (no new violations)
- [x] `next build` — ✓ Compiled successfully

### Diagnosis evidence (§17.3)
- Prod runtime logs (`vercel-logs.sh latest-runtime`) returned nothing — correct
  for a client-side wiring bug (a button that navigates instead of opening a
  dialog produces no server log). Diagnosed from code: traced the empty-state
  buttons (`<Link>` to bare list routes) vs the working toolbar handlers
  (`setAccountPickerOpen`/`setLoanPickerOpen`) + the `?action=` switch.

### Destructive write checklist (CLAUDE.md §12.11)
N/A — UI wiring fix, no schema, no Prisma writes.

### PR
- Branch: `claude/balances-empty-state-add-fix-LFNFt`
- Status: Merged (PR #958) — prod deploy `dpl_ETzY2rC4...` READY.

---

## Session: qif-import-ai-resilience-LFNFt

### Changes Made
- **Type**: Fix (prod — QIF import hard-failed on AI categorisation error)
- **Scope**: `lib/bank/aiCategorisation.ts` → `categoriseWithLearning`
- **Root Cause**: The QIF/CSV import (`/api/accounts/[id]/import`) calls
  `categoriseWithLearning` → `categoriseInBatches` → `categoriseWithAI`, which
  calls Gemini. The unconfigured case is handled (falls back to uncategorised),
  but a **configured-but-failing** Gemini call (rate limit, timeout, quota,
  model change, outage, malformed JSON) **throws** — and nothing on the path
  (`categoriseInBatches`, `categoriseWithLearning`) catches it. It bubbles to
  the import route's generic `catch` → `500 "Failed to process import"`. So one
  transient upstream blip discards the user's entire (successfully parsed)
  upload. The import code itself hadn't changed — a stable path failing
  suddenly points to the external dependency (Gemini), and the path had zero
  resilience to it. Reza reported "uploading a QIF file and it just errored".
- **Solution**: AI categorisation is an **enrichment**, not a prerequisite for
  importing transactions. Wrapped the `categoriseInBatches` call in
  `categoriseWithLearning` in try/catch; on any AI error it falls back to
  uncategorised + confidence 0 (the same path already used when Gemini is
  unconfigured), so every transaction still imports and lands in the review
  queue for manual categorisation. The upload never fails because the AI is
  down.

### Files Modified
- `lib/bank/aiCategorisation.ts` — `categoriseWithLearning` step 4: AI call now
  in try/catch with a shared `uncategorisedFallback` helper (covers both the
  unconfigured and the failed-call cases).

### Diagnosis evidence (§17.3)
- Prod runtime logs (`vercel-logs.sh latest-runtime` / `runtime <id>`)
  **timed out** (curl 28, 25s cap) — the runtime-logs stream returned nothing
  within the window. Diagnosed from code instead: traced the import route's
  generic 500 → `categoriseWithLearning` (line 560) → `categoriseInBatches`
  (no try/catch) → `categoriseWithAI` (throws at the Gemini call / unconfigured
  guard). Stable import code + sudden failure ⇒ external (Gemini) failure on an
  unguarded path.
- **Caveat surfaced to Reza:** without the error text I can't be 100% certain
  THIS upload's error was the AI path vs another cause (e.g. a 400 "No
  transactions found" on an unrecognised QIF variant). The fix is correct
  hardening regardless; asked Reza for the exact dialog error to confirm.

### Build Status
- [x] `tsc --noEmit` — 0 errors (whole project)
- [x] `npm run lint:financial-surfaces` — exit 0 (no new violations)
- [x] `next build` — ✓ Compiled successfully

### Destructive write checklist (CLAUDE.md §12.11)
N/A — resilience/try-catch change, no schema, no Prisma writes.

### PR
- Branch: `claude/qif-import-ai-resilience-LFNFt`
- Status: Merged (PR #959).

---

## Session: auth-forgot-password-and-show-password-LFNFt

### Changes Made
- **Type**: Fix (prod — broken forgot-password link) + UX (show-password toggle)
- **Scope**: Auth pages (`/signin`, `/register`, new `/forgot-password`) + `AuthContext`
- **Two reports (Reza, live app):**
  1. "When signing in, I checked forgot password and got [404]." — `/signin`
     linked to `/forgot-password` but **no such route existed** → hard 404, so
     users could not reset their password at all.
  2. "Show password is not available." — the auth password fields were plain
     masked inputs with no reveal toggle.

### Solution
1. **Forgot-password page (new).** `app/forgot-password/page.tsx` mirrors the
   `/signin` Deep Cosmos `AuthShell` chrome (functional dead-link target, not a
   new design surface → §18 Stitch-first exempt). Uses Firebase
   `sendPasswordResetEmail` via a new `resetPassword(email)` on `AuthContext`.
   **Anti-enumeration (§13):** success and `auth/user-not-found` render the same
   neutral confirmation; only `auth/invalid-email` / `auth/too-many-requests`
   show distinct errors.
2. **Show-password toggle.** New reusable `components/auth/AuthPasswordInput.tsx`
   (native `cosmos-input` + an Eye/EyeOff button that toggles input type only,
   never the value). Applied to `/signin` (1 field) and `/register` (password +
   confirm). The toggle is keyboard-focusable with `aria-pressed`/`aria-label`.

### Files Modified / Created
- `lib/context/AuthContext.tsx` — `sendPasswordResetEmail` import + `resetPassword`
  method + type + provider value.
- `app/forgot-password/page.tsx` — **NEW.** The reset page.
- `components/auth/AuthPasswordInput.tsx` — **NEW.** Reusable show/hide field.
- `app/signin/page.tsx` — password field → `<AuthPasswordInput>`.
- `app/register/page.tsx` — password + confirm fields → `<AuthPasswordInput>`.

### Documentation Updated
- `docs/operational/security/01_AUTHENTICATION.md` — new "Password Reset" section
  (flow, anti-enumeration, "email not arriving → check Identity Platform template").
- `docs/changelog/CHANGELOG_2026_06_01.md` — this entry.

### Build Status
- [x] `tsc --noEmit` — 0 errors (whole project)
- [x] `npm run lint:financial-surfaces` — exit 0 (no new violations)
- [x] `next build` — ✓ Compiled (`/forgot-password` route built)

### Destructive write checklist (CLAUDE.md §12.11)
N/A — new page + a Firebase client call (`sendPasswordResetEmail`); no schema, no Prisma writes.

### UI/UX Stitch-first (CLAUDE.md §18)
N/A — `/forgot-password` is a **missing dead-link target route** (functional, not visual; §18.2 exempt). Reuses the existing `AuthShell` + `cosmos-*` vocabulary; the only new primitive is `AuthPasswordInput`, which matches `cosmos-input`. No new design vocabulary.

### PR
- Branch: `claude/auth-forgot-password-and-show-password-LFNFt`
- Status: Draft (pending review)

---

## Session: brave-shannon-mr1ye — My Wealth → Superannuation (Phase 39.4) + §18.7 governance

### Changes Made
- **Type**: Feature + Governance + Doc-sync
- **Scope**: My Wealth (TRAIL Stage I — Invest) — new Superannuation surface; shared cap-meter; CLAUDE.md design-principles rule.
- **Origin**: Continuation of the Phase 39.4 design gate (PR #961, merged). Reza: "Continue."

### What shipped
1. **CLAUDE.md §18.7 (PR #961, merged)** — "Canonical design principles ARE the Stitch design guidance." Every Stitch prompt must seed the §18.7.2 My Wealth glass digest; the digest must be kept current in the same PR when the design language changes. Protocol → v2.2.
2. **My Wealth → Superannuation page** (`/dashboard/investments/super`) — Stitch-first (desktop `1c01d0c1…`, mobile `e7a87730…`). Reuses the existing `/api/tax/super` endpoints; no new aggregation/snapshot logic.
3. **`SuperCapMeter`** (`components/wealth/SuperCapMeter.tsx`) — canonical concessional/non-concessional cap meters (§12.2 SSOT). Tax page (`app/dashboard/tax/page.tsx`) refactored to consume it, deleting its duplicated inline meter markup.
4. **`SuperAccountTile`** (`components/wealth/SuperAccountTile.tsx`) — Stage I glass tile, indigo→violet Super palette, `SuperFilledGlyph` watermark, emerald gain pill, gradient CTA (§18.7.2).
5. **`PUT /api/tax/super/[id]`** extended to accept `memberNumber`, `fundABN`, `taxableComponent`, `taxFreeComponent`, `investmentOption` (was name/fundName/currentBalance only). Ownership-guarded single-row update.
6. **Nav** — "Superannuation" child under My Wealth in `lib/navigation/trailNav.tsx`.

### Files Modified / Created
- `app/dashboard/investments/super/page.tsx` — NEW page.
- `components/wealth/SuperCapMeter.tsx` — NEW shared component (SSOT).
- `components/wealth/SuperAccountTile.tsx` — NEW tile.
- `app/api/tax/super/[id]/route.ts` — extended PUT field set + JSDoc.
- `app/dashboard/tax/page.tsx` — consume `SuperCapMeter` (removed inline meters).
- `lib/navigation/trailNav.tsx` — nav child.
- `CLAUDE.md` — §18.7 + version bump.
- `.stitch/designs/super-wealth-{desktop,mobile}.{html,png}` — design artifacts.
- `.stitch/metadata.inapp-wealth.json` — NEW (records the in-app Stitch project).

### Documentation Updated
- `docs/blueprint/PHASE_39_MY_WEALTH_REDESIGN.md` — §3.4 Superannuation.
- `docs/architecture/06_UI_UX_FOUNDATION.md` — SuperCapMeter pattern + where-replicated.
- `docs/IMPLEMENTATION_PLAN.md` — Recently Completed (2026-06-01) + Dead Code #26 (cap-default drift) + #27 (onboarding SUPERS duplicate).
- `.stitch/SITE.md` §4 — cross-reference to the in-app project.
- `.stitch/metadata.inapp-wealth.json` — screen IDs + React port.

### Build Status
- [x] `tsc --noEmit` — 0 errors in changed files (only pre-existing `baseUrl` deprecation notice).
- [x] `next build` — ✓ Compiled (`/dashboard/investments/super` 6.37 kB; `/dashboard/tax` still builds after refactor).

### Destructive write checklist (CLAUDE.md §12.11)
`PUT /api/tax/super/[id]` → `prisma.superannuationAccount.update`:
1. **`where` matches:** single row by verified `id`, after `verifyOwnership(existing, auth.userId)` — only the caller's own account.
2. **Columns overwritten:** only fields present in the request body (partial update; `undefined` skipped) — user-entered super fields.
3. **Guard:** `verifyOwnership` + `where: { id }`; no bulk update.
- User confirmation: NOT REQUIRED — single-row, ownership-guarded, user-initiated edit of own record.

### Phase 41E reform-awareness (CLAUDE.md §12.14)
No trigger hit: no new `lib/tax-engine/*` function, no CGT/neg-gearing/trust/FBT/PAYG calc added (the page CONSUMES existing `/api/tax/super` output), no column added to `Property`/`Investment`/`LegalEntity`, no new AI tool. Super contribution caps are not reform-grandfathered (FW-5 per-asset-tax-position trigger N/A — caps are not a CGT/neg-gear position).

### UI/UX Stitch-first (CLAUDE.md §18)
Followed. In-app My Wealth surface designed in Stitch (desktop + mobile) BEFORE React; prompts seeded with §18.7.2 principles; artifacts committed; screen IDs in the component file-header JSDoc + `.stitch/metadata.inapp-wealth.json`.

### PR
- Branch: `claude/brave-shannon-mr1ye`
- Status: Draft (pending review)
