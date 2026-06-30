# Changelog — 2026-06-30

## Session: mobile-activity-redesign-plan

### Changes Made
- **Type**: Planning + research (no app code)
- **Scope**: Documented 4 mobile-Activity issues Reza reported (2026-06-30) + a detailed per-issue fix plan, with the list redesign researched against Copilot Money / YNAB / Rocket Money / Monarch / Apple Card.
- **Root causes (verified in source)**:
  1. **FAB overlap** — `CashQuickAddButton` (`:150`, mounted in the Activity page) and `GlobalScanReceipt` (`:489`, mounted globally in `DashboardLayout`) both `fixed` bottom-right with no shared owner.
  2. **Cramped list** — desktop `TransactionRow` (`activity/page.tsx:1706`) reflowed to phone, not redesigned → truncation.
  3. **No on-row Confirm (mobile)** — action cluster is `hidden sm:block` (`:1683`), desktop-only; mobile relies on the hidden swipe.
  4. **Footer scrolls / black gap** — `min-h-screen` (`100vh`) + document scroll + `fixed` `EditorialBottomNav` (`:61`) rubber-bands on iOS Safari's dynamic viewport.
- **Research**: a sourced competitive report (Copilot review-dot + finite card-stack + AI-guess-first picker; YNAB on-row approve + magic action bar + mobile undo; Rocket finite swipe card-stack; Apple Card row restraint; Material/HIG FAB + safe-area mechanics). Captured in the Phase doc §2.
- **Plan**: PR-A FAB (one owner / speed-dial) · PR-B scroll (`100dvh` + `overscroll-contain` + safe-area) · **PR-C** mobile row redesign + on-row Confirm + swipe grammar + half-sheet picker + Review card-stack — **Stitch-first, §18.8 ≥9/10** before React.

### Files Modified
- `docs/blueprint/PHASE_56_MOBILE_ACTIVITY_REDESIGN.md` (NEW) — issues, root causes, research summary, per-issue plan, sequencing, open decisions.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — new `0·MOBILE-ACTIVITY` workstream.
- `docs/IMPLEMENTATION_PLAN.md` — hub `Last updated` bumped.

### Verification
- Docs-only; no app/financial code → no neomatrix/lint gates affected. Self-review (§20.5): plan grounded in source (root causes at file:line) + sourced research; redesign explicitly gated behind Stitch §18.8 ≥9/10 + Reza sign-off (not built).

### PR
- Branch: `claude/mobile-activity-redesign-plan`
- Status: draft
