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
- Status: Draft (pending review)
