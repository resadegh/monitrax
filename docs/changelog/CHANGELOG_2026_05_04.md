# Changelog — 2026-05-04

## Session: claude/phase-36-2a-loan-detail-dialog-lS5cs

### Changes Made
- **Type:** Refactor + Feature (UX)
- **Scope:** Phase 36 Phase 2a — extract `LoanDetailDialog` and wire it inline on `/dashboard/balances`
- **Description:** Closes the first sub-phase of Phase 36 Phase 2 (legacy `/dashboard/accounts` + `/dashboard/loans` retirement). The inline 6-tab loan detail dialog living in `app/dashboard/loans/page.tsx` (lines 633–963) is now a shared component at `components/loans/LoanDetailDialog.tsx`, mirroring the `AccountDetailDialog` pattern from Phase 1. Used on both the legacy loans page (replacing the inline — parity refactor) and on Balances (new — loan rows now open the dialog inline instead of navigating to `/dashboard/loans/{id}`).

### Why this matters
Phase 1 already did this for accounts: clicking an account row on Balances opens an inline dialog instead of forcing a redirect-then-second-click. Phase 2a extends the same pattern to loans, which closes the last "have to leave Balances to drill in" gap and unblocks Phase 2d (the actual route redirect). Per CLAUDE.md §12.2 (SSOT), this PR also pulls the dialog's calculations into the canonical `lib/utils/calculations.ts` and `lib/utils/frequencies.ts` helpers — the legacy page was duplicating `Math.max(0, principal - offset)` math and a hand-rolled frequency-to-annual switch.

### Files Modified
- `components/loans/LoanDetailDialog.tsx` (NEW, ~620 lines) — shared loan detail modal. 6 tabs (Overview / Property / Offset / Expenses / Strategy / Linked). Footer: Close + optional Delete (with AlertDialog two-step confirmation) + Edit. Self-contained `LoanDetail` + `LoanDetailExpense` types, structurally compatible with `/api/loans`. Calculations: `calculateEffectivePrincipal`, `calculateLVR`, `toAnnual` — all canonical SSOT. File-header JSDoc per CLAUDE.md §16.4.
- `app/dashboard/loans/page.tsx` — replaced the inline detail dialog with the new component (parity refactor; behaviour preserved end-to-end except Delete now uses the AlertDialog confirmation instead of `window.confirm()`). Removed dead helpers `convertToAnnual` + `calculateLinkedExpenses` (only used by the extracted dialog). Removed unused imports (`Dialog`, `Tabs`, `LinkedDataPanel`, `EntityStrategyTab`, `Lightbulb`, `Link2`).
- `app/dashboard/balances/page.tsx` — widened `LoanRow` type to carry every field the dialog needs (`isInterestOnly`, `termMonthsRemaining`, `minRepayment`, `repaymentFrequency`, `extraRepaymentCap`, `expenses`, `_links`/`_meta`, plus richer `property` and `offsetAccount` fields). All these fields are already returned by `/api/loans` — just declared. New state hooks: `editingLoan`, `detailLoan`, `loanDetailOpen`. New handlers: `openLoanDetail`, `openLoanEdit` (lazy-loads property + asset lookups same way `openLoanCreate` does), `handleDeleteLoan` (mirrors `handleDeleteAccount`). `LoanRowView` is now a `<button>` calling `onClick` instead of a `<Link>` redirecting to `/dashboard/loans/{id}`. `LoanFormDialog` `editing` prop now driven by `editingLoan` state (was hard-coded `null`); reset to create mode on close. `LoanDetailDialog` rendered at page level with full callbacks wired (edit / delete / GRDCS-linked-navigate).

### Files NOT modified (intentional)
- `lib/utils/calculations.ts` / `lib/utils/frequencies.ts` — canonical SSOT, used as-is per CLAUDE.md §12.2.
- `app/api/loans/route.ts` — no API contract change; the dialog consumes the existing response shape.
- `prisma/schema.prisma` — no schema change.
- Sidebar, sidebar `matchRoutes`, `BasiqHeroCard`, `DashboardEmptyStateGrid`, `SetupNextActionPanel` — left for Phase 2b / 2e (separate PR).

### Build Status
- [x] `npm run build` passes locally.
- [x] TypeScript compiles clean.

### Tests
- [x] Manual code-review: dialog mounts on legacy loans page (parity) and on Balances (new). Edit flow plumbs back to `LoanFormDialog` in edit mode. Delete flow uses AlertDialog confirmation, calls `/api/loans/{id}` DELETE, reloads list.
- [ ] Preview deploy: open Balances → click any loan row → verify all 6 tabs render with the same numbers as the legacy `/dashboard/loans` detail. Click Edit → verify the form opens populated. Confirm Delete → verify the loan disappears from the Cash + Debt sections.
- [ ] Preview deploy: open `/dashboard/loans` directly → confirm the dialog still renders identically (parity check — this is the safety net before Phase 2d redirects the route away).

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new shared component; per §16.4 file-header JSDoc + canonical pattern reference)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #4 reflowed with sub-phase status (2a ✅ shipped; 2c + 2e flagged no-op; 2b + 2d remain). Last-updated header rewritten. Recently Completed entry under 2026-05-04.
- `docs/changelog/CHANGELOG_2026_05_04.md` — this file.
- File-header JSDoc on `components/loans/LoanDetailDialog.tsx` documents the design rules + SSOT mapping per CLAUDE.md §16.4.

Phase 36 spec (`docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md`) is left for the closing Phase 2d PR — that's where the route retirement is recorded.

### Risk
- **Risk:** Low.
- **Surfaces touched:** one shared component (new), two pages (one is being retired anyway, one is the migration target). API contract unchanged. Schema unchanged. Calculations now flow through canonical SSOT (was duplicated; now reuses `lib/utils/calculations.ts`).
- **Reversibility:** Trivial single-PR revert; the legacy inline dialog is preserved verbatim in git history if rollback is needed.
- **Behavioural delta:** Loan delete on the legacy page now uses an AlertDialog instead of `window.confirm()` — this is a UX upgrade matching the AccountDetailDialog pattern, not a regression.

### PR
- Branch: `claude/phase-36-2a-loan-detail-dialog-lS5cs`
- PR URL: (to be added after `mcp__github__create_pull_request`)
