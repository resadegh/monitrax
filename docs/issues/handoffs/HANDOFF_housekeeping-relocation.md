# CODE BRIEF (Opus 4.8) — Housekeeping relocation: move personal-data tools OFF the staff admin portal INTO the Monitrax app

**Paste into a fresh Claude Code session on OPUS 4.8** (UI + relocation; no financial-engine math). Gated on Reza's design approval (PR #1477 artefacts). One PR. The engine fix (#1475) is live and correct — **do not touch the tax engine, detector, or intake-merge logic.** This is surface relocation + a nav section.

## Why (VR-021 FAIL — the mandate)
VR-021 failed live on **surface placement**: the MON-094 Tax review page was built on the **staff admin portal**, which authenticates as `admin@monitrax.com.au` (a different principal than the consumer account owning the income). Its `prisma.income.findMany({ where: { userId } })` ran against the staff account → "Nothing to review", while the two ATO rows stayed fully taxable (Taxable Income $185,481 unchanged after recalc). **Reza's standing ruling: personal-data review/write tools live in the Monitrax app, never the staff admin portal.** Audit found exactly TWO such tools: `tax-review` + `intake-duplicates`.

## 0. Boot ritual + hardened guardrails (FIRST, no exception)
1. `git clone`/`pull` resadegh/monitrax → main → pull. Pin HEAD (currently `ff38f34`, merge of #1477); cite `file:line`; re-verify anchors live.
2. Read `STATE.md` (cursor = MON-094 / VR-021 FAIL) → `CLAUDE.md` (Part 0 laws, §18.2.1 Stitch-first, §18.4-5 screen-ID JSDoc, §18.7.2 variant matrix, §20.5 fork-gate, §20.6 tri-axis, §21.2.2 neo-sync) → `docs/issues/FIX_PROTOCOL.md` (§7 ledger) → the MON-094 registry entry (incl. the Stage-4 FAIL note) → **PR #1477** (design artefacts + the Stitch **screen ID** — read it from the PR; it is NOT embedded in the HTML) → this brief.
3. §20.5 gate ON. This is a design-approved UI relocation — build to the approved screen, no invented layout.

## Design inputs (verified on main)
- Approved artefacts: `.stitch/designs/housekeeping/housekeeping-tax-desktop-light-v{1,2}.{html,png}` — **desktop only, LIGHT** so far. **Item 6 first:** generate the **dark + mobile** variants (§18.7.2 four-variant matrix: desktop/mobile × light/dark) in the desktop Stitch session and land them BEFORE the React conversion, so the build consumes the theme the app actually renders (the app dashboard is dark). Do not hand-map light→dark by eye.
- Screen ID → the file-header JSDoc of each new page (§18.4-5), sourced from PR #1477.

## Build (one PR)

**1. Nav — new top-level "Housekeeping" section.** `lib/navigation/trailNav.tsx` (after `Settings`, which is the current last entry at :181; amber identity per the approved design; broom/sparkle icon) + `components/editorial/shell/EditorialSidebar.tsx` + `components/editorial/shell/EditorialBottomNav.tsx`, mirroring the existing section→sub-tab pattern (e.g. My Wealth → Properties/Investments). Two sub-tabs: **"Tax classification"** (`/dashboard/housekeeping/tax`) + **"Duplicate income"** (`/dashboard/housekeeping/duplicates`). Count badges read LIVE from the two GET endpoints (below) — the badge is the length of the pending list; 0 → no badge.

**2. Relocate tax-review → `/dashboard/housekeeping/tax`.** React conversion of the approved screen. **User session auth** — the existing `app/api/tax/non-assessable-review/route.ts` is ALREADY user-permissioned (`GET withPermission('income.read')`, `POST withPermission('income.write')`, keyed on `auth.userId`), so the page consumes it via the normal user session; **drop the admin token-interceptor workaround entirely** (no `safeAdminFetch`/`authHeaders`). Typed-**RECLASSIFY** per-row confirm (per the design); the summary bar computes from the live suggestions; empty-state per the design language.

**3. Relocate intake-duplicates → `/dashboard/housekeeping/duplicates`.** Same treatment over `app/api/intake/duplicates/route.ts` (also already `income.read`/`income.write` on `auth.userId`). Typed-**MERGE**, per-group, **no merge-all**. Merge logic UNCHANGED — this is a surface move, not a logic change.

**4. Delete both admin pages.** Remove `app/admin/tax-review/page.tsx` + `app/admin/intake-duplicates/page.tsx` and their admin-nav entries (`components/admin/layout/AdminSidebar.tsx`). **A surviving admin copy = a second surface = reject** (this is exactly the VR-021 defect class).

**5. AFSL guard.** Reuse the canonical `components/tax/BoundaryFootnote.tsx` (it renders "general information only — not personal advice. Consult a TPB / AFSL / NCCP." with **NO licence number**). The new pages MUST NOT emit "AFSL <number>" (the `AFSL 523411 compliant` pattern seen on the income page). Add a test asserting no `/AFSL\s*\d/` match in the two new page trees.

**6. Dark + mobile.** (See Design inputs.) Consume the dark + mobile Stitch variants; generate them first if not yet landed.

**7. Process.**
- **FIX_PROTOCOL §7 ledger retro** in this PR: *what escaped* — the principal/account-scope was never checked at design time, so a user-data tool shipped on a staff-auth surface; *gate change* — **user-data review/write surfaces never live on the staff admin portal; the design gate asserts the surface's session principal owns the data.**
- Registry: MON-094 `fixPRs += this PR` (stays FIXING until VR-022).
- Neo-sync (§21.2.2): structural graph gains the two `/dashboard/housekeeping/*` files, loses the two `app/admin/*` pages; Neobrain doc pointer updates (surface moved, engine unchanged).
- §20.6 tri-axis 10/10 recorded.

**8. Ratchet (topology test).** Assert the two personal-data routes/pages are reachable ONLY under `/dashboard/*` — no `app/admin/*` page imports `non-assessable-review` or `intake/duplicates`, and the two deleted admin pages do not reappear. This locks the VR-021 class shut.

## Guardrails
- No engine/detector/merge-logic changes (#1475 + intake merge stay byte-identical). CI green; `lint:source-lock` green; source-lock exception count ratchet-down or unchanged.
- **Reza merges.** No number changes in this PR (pure relocation) — but it UNBLOCKS the numbers, so treat the VR-022 re-run as mandatory before VERIFIED.

## After merge → VR-022 (the Matrix, from the NEW user surface)
Reza opens `/dashboard/housekeeping/tax` (his own session — principal now owns the rows), does the two typed-RECLASSIFY confirms. The Matrix runs **VR-022** (Part B of the MON-094 handout, unchanged): **principal check FIRST** (the review lists the two ATO rows under Reza's account, not empty) → Other Income $10,300 → ~$250 → Total Income −~$10,050 from $327,801 → taxable + tax fall in step → guards clean (salary $195,620; Broadbeach $2,947/$35,360/5.89%; loan $1,191; liquid $301,808; one-off labels) → **MON-094 → VERIFIED**. Duplicate-income tab: confirm it lists Reza's groups under his account (the same principal fix).

---
*Prepared by The Matrix. Grounded on HEAD `ff38f34` (#1477). Surface relocation only — engine (#1475) untouched. Closes the VR-021 principal-mismatch class: personal-data tools live in the app, session-scoped to the owner. Opus 4.8 (UI). Reza merges → VR-022 → VERIFIED.*
