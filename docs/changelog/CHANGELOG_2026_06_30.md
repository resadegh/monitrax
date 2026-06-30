# Changelog — 2026-06-30

## Session: mobile-tap-to-categorise (Phase 56.1)

### Changes Made
- **Type**: Fix (mobile UX wiring) — Reza feedback on shipped PR-C
- **Scope**: Activity page row-tap target + the category picker sheet
- **Description**: Reza reported (2026-06-30) that tapping a transaction still opened the **old Link Transaction dialog** (Categorise / More options / Skip), not the new category-picker half-sheet built in PR-C — the clean flow was only reachable via the undiscoverable swipe-left. Fix: the row **tap** (`onClick`, used by the row body + the mobile "+ Add" + the desktop Add/suggested pills) now opens the **new `CategoryPickerSheet`** (Suggested hero) directly. Categorise is the primary intent → it's now the default tap. The full Link/route dialog (link-to-account/entity, mark transfer, skip) is preserved one step away: **long-press** (mobile, unchanged) + a new quiet **"More options"** link in the picker (the only path on desktop, which has no long-press) → so nothing is lost.

### Files Modified
- `app/dashboard/activity/page.tsx` — row `onClick` → `setPickerTx(tx)` (was `setShowLinkDialog`); first `CategoryPickerSheet` instance gains `onMoreOptions` → opens the legacy `TransactionLinkDialog` for the advanced router; header + row JSDoc comments corrected.
- `components/bookkeeping/CategoryPickerSheet.tsx` — new optional `onMoreOptions?: () => void` prop + a quiet bottom "More options — link to an account, mark transfer, or skip" button rendered only when provided.

### Verification (§19 — no fabricated numbers)
- Pure UX wiring. No new endpoint or categoriser (§12.2.1) — tap reuses the existing PR-C picker (PATCH `/api/unified-transactions/[id]`). `TransactionLinkDialog` is still mounted (long-press + queue-edit + More options) — not dead code. No financial number touched; `neomatrix:check` green.
- Static pass: prop declared/destructured/rendered; `pickerTx`/`linkingTransaction` state exist; `onLongPress` still routes to the link dialog. Local build/vitest not runnable in sandbox — CI is the gate.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (tap target re-pointed to the already-shipped PR-C picker + a quiet "More options" affordance — true tweak to an existing surface, §18.2.1 code-first allowed; no new section composition)
- [ ] application config · [ ] GCP infra · [ ] identity/auth · [ ] deployment/build · [ ] security/CDR · [ ] operational procedure · [ ] strategic decision

Docs updated: `PHASE_56_MOBILE_ACTIVITY_REDESIGN.md` (56.1 + 56.2 deck plan), `01_ACTIVE_WORKSTREAMS.md`, this changelog, component JSDoc.

### Testing
- [x] `neomatrix:check` — OK. [ ] CI is the gate for Build + vitest.
- [x] Self-review gate (§20.4/§20.5): 3× vs requirement → 10/10 (tap opens the new picker; advanced router preserved via long-press + More options so desktop loses nothing; no duplicate categoriser/endpoint; no fabricated data).

### Follow-up (Phase 56.2 — the card-deck, Reza decision "A" 2026-06-30)
- Reza wants the mobile Activity view to become a **finite swipeable card-deck** ("browse like a notebook"), set as the **default landing when there's work to do** (unreviewed/uncategorised items exist), with the list always one tap away. This is the deferred "Review Mode". It's a new section composition → **Stitch-first, §18.8 ≥9/10, sign-off before React** — designed next, shipped as a separate PR.

### PR
- Branch: `claude/mobile-tap-to-categorise`
- Status: draft

---

## Session: mobile-activity-row-redesign (Phase 56 PR-C)

### Changes Made
- **Type**: Feature (mobile UI) — Stitch-first redesign, Reza-signed-off
- **Scope**: Mobile transaction row + on-row Confirm + category-picker "Suggested" hero on the Activity page
- **Description**: Builds PR-C of the Phase 56 plan after design sign-off. Four Stitch screens (Activity list light/dark + category picker light/dark) self-reviewed to **9.4/10** (§18.8). The mobile `TransactionRow` body (`md:hidden`) is rebuilt to the Apple-Wallet-restraint layout — 44px gradient gem + unreviewed dot (sky + white ring) + clean name line + one quiet `category · time` line + a **locked amount column** (44px trailing lane reserved on every row) + a **trailing one-tap ✓ Confirm** when the AI proposed a category (→ existing Phase-49 `onConfirm` PATCH) / **+ Add** when uncategorised. Fixes Issue 2 (cramped reflow) + Issue 3 (no on-row Confirm). Desktop row unchanged. The category picker leads with a **"Suggested"** hero (top guess = emphasised one-tap "Best match", sky-tinted) when a real Neobrain suggestion exists; plain default grid otherwise. Per-row bulk-select checkbox is now desktop-only (biggest mobile cramping contributor; not in the design).

### Files Modified
- `app/dashboard/activity/page.tsx` — new `md:hidden` mobile `TransactionRow` body (gem/dot/name/category·time/locked amount/trailing ✓ Confirm or + Add); desktop body wrapped `hidden md:flex` (unchanged); checkbox `hidden md:flex`; `gemGradient`/`dotTone`/`timeStr` helpers; `Plus` import; picker wired `suggestions={tx.suggestedCategoryLevel1 ? [..] : undefined}`; Phase 56 header JSDoc + screen IDs.
- `components/bookkeeping/CategoryPickerSheet.tsx` — `hasRealSuggestions` gate; "Suggested" hero (emphasised top guess + secondary chips) when real suggestions present, plain grid otherwise; `Sparkles` import; Phase 56 header JSDoc + screen IDs.
- `docs/blueprint/PHASE_56_MOBILE_ACTIVITY_REDESIGN.md` — status → Shipping; Open Decisions resolved; Build Log (decisions + honest deferrals).
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — `0·MOBILE-ACTIVITY` PR-C built.
- `.stitch/designs/phase56/*` — 4 Stitch artefacts (HTML + PNG), committed earlier this PR.

### Decisions & honest deferrals
- **Swipe grammar kept** (left=categorise, right=transfer): Issue 3 = "confirm not on the row" → fixed with a **visible button**, not another hidden gesture. No risky behaviour remap; transfer-swipe preserved.
- **NOT shipped (deferred, documented):** the design's confidence-% pills (no real ranked score — fabricating one is false precision, §19); the apply-scope / make-a-rule footer (separate endpoint work); the finite card-stack Review Mode (Reza's call — fast-follow). Icons swap Material-Symbols stand-ins → Lucide.

### Verification (§19 — no fabricated numbers)
- The row shows only **real** data: `tx.amount`/`direction`/`currency` via `formatCurrency`, the time from `tx.date`, the category from `deriveRowStatus` (SSOT), the suggestion from `tx.suggestedCategoryLevel1` (Neobrain). **No invented confidence %.** The ✓ Confirm reuses the existing Phase-49 `confirmRow` PATCH (no new calc/endpoint). `neomatrix:check` green (FE only, no graph impact).
- Local build/lint not runnable in this sandbox (no `node_modules`) — CI is the gate (Build verification + vitest + neomatrix:check). Manual static pass done (imports, in-scope vars, JSX balance, prop wiring).

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (new mobile row composition — Stitch-first §18.2.1, 4 screens §18.8 9.4/10, artefacts + screen IDs in JSDoc)
- [ ] application config · [ ] GCP infra · [ ] identity/auth · [ ] deployment/build · [ ] security/CDR · [ ] operational procedure · [ ] strategic decision

Docs updated: `PHASE_56_MOBILE_ACTIVITY_REDESIGN.md`, `01_ACTIVE_WORKSTREAMS.md`, this changelog, component JSDoc headers.

### Testing
- [x] `neomatrix:check` — OK. [ ] CI is the gate for Build + vitest.
- [x] Self-review gate (§20.4/§20.5): 3× vs requirement → 10/10. Built on existing machinery (no duplicate categoriser/endpoint §12.2.1); honest deferrals not silent drops (§19); desktop untouched; Stitch-first design at 9.4 + sign-off.

### PR
- Branch: `claude/mobile-activity-row-redesign`
- Status: draft

---

## Session: mobile-shell-fixes (Phase 56 PR-A + PR-B)

### Changes Made
- **Type**: Fix (mobile UI shell)
- **Scope**: Floating action buttons (FAB) + dashboard scroll container on mobile
- **Description**: The two approved quick wins from the Phase 56 mobile-activity plan (Reza 2026-06-30: "ok go with recommendations" — ship PR-A + PR-B now; PR-C row redesign comes via a Stitch ≥9/10 pass). **PR-A** — on mobile (`<md`) the green "quick add cash" `+` FAB overlapped the global scan/camera FAB (both bottom-right). It now stacks **above** the camera FAB on the same right edge with a clear gap, and restores the normal corner position at `md+` (where the camera FAB is hidden). **PR-B** — iOS Safari's document-level rubber-band dragged the whole page (including the fixed bottom nav) up, revealing a black gap. Fixed by switching the dashboard shell from `min-h-screen` (100vh) to `min-h-[100dvh]` (dynamic viewport, tracks the collapsing toolbar) plus `overscroll-behavior-y: contain` on both the shell and `body`.

### Files Modified
- `components/bookkeeping/CashQuickAddButton.tsx` — `+` FAB className: mobile position `bottom-[calc(9.5rem+env(safe-area-inset-bottom,0px))] right-4` (stacks above the camera FAB) → `md:bottom-8 md:right-8` desktop; `z-[35]` keeps it above the fixed bottom nav.
- `components/DashboardLayout.tsx` — shell wrapper `min-h-screen` → `min-h-[100dvh] overscroll-y-contain`.
- `app/globals.css` — `body { overscroll-behavior-y: contain; }`.

### Verification (§19 — no financial number)
- **No financial-graph impact** — pure front-end CSS/positioning. `neomatrix:check` green (235 nodes, 312 edges, markdown fresh).
- PR-B requires on-device iOS Safari verification (Reza) — the `100dvh` + `overscroll-behavior` combination is the canonical fix but its effect on the rubber-band is device/OS-version sensitive.

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (FAB stacking + scroll container — true tweaks to existing surfaces, §18.2.1 code-first allowed; no new section composition)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `docs/changelog/CHANGELOG_2026_06_30.md` — this entry

Note: the Phase 56 plan doc (`PHASE_56_MOBILE_ACTIVITY_REDESIGN.md`) + the
`0·MOBILE-ACTIVITY` workstream entry live in the separate docs PR (#1302,
off `main`). When #1302 merges, its workstream PR-A/PR-B rows are flipped to
shipped referencing this PR. Keeping the plan/tracking in one PR and the code
in another avoids a cross-branch doc conflict; the changelog above is this PR's
self-contained record.

### Testing
- [ ] Local build/vitest not runnable in this remote sandbox (incomplete `node_modules`) — CI is the gate (Build + vitest + `neomatrix:check`).
- [x] `neomatrix:check` run locally — OK.
- [x] Self-review gate (§20.4/§20.5): 3× against requirement → 10/10 (both fixes are the canonical, minimal, reversible solutions; no new section composition so §18.2.1 allows code-first; PR-C row redesign correctly deferred to Stitch).

### PR
- Branch: `claude/mobile-shell-fixes`
- Status: merged (#1303)

---

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
- Status: merged (#1302)
