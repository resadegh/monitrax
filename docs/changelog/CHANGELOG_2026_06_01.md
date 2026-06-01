# Changelog — 2026-06-01

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
- Status: Draft (pending review)
