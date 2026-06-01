# Changelog — 2026-06-01

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
