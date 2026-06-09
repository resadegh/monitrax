# Changelog — 2026-06-09

## Session: Phase 45.3 — dashboard Properties + Investments tabs glass migration (UI only)

### Context

After Phase 45.2.5 shipped, Reza ran an audit on `/dashboard` and identified the Properties + Investments tile pair (the tabbed section at the bottom of the page) as still on the OLD shadcn `<Card className="hover:shadow-md transition-shadow">` vanilla vocabulary while the rest of the app's My Wealth surfaces ran the §18.7.2 glass language. Audit confirmed three coexisting design eras on the dashboard (§18.7.2 glass / Phase 38 editorial / shadcn vanilla); Phase 45.3 fires the first round of the new `0·DG` (Dashboard Glass) workstream that brings the tiles Reza screenshotted onto the §18.7.2 polished sub-pattern.

Reza directive — **NO BACKEND CHANGES across the entire 0·DG workstream**. UI vocabulary swap only. Reviewer rejection trigger codified in IMPLEMENTATION_PLAN.md.

### Changes Made

- **Type**: Feature — UI vocabulary swap, two new co-located components, two inline `<Card>` blocks replaced.
- **Scope**: `app/dashboard/page.tsx` Properties tab (line 984) + Investments tab (line 1053). Two new components at `components/dashboard/tiles/`.
- **Sub-palette mapping** (per §18.7.5): Properties = sky→indigo (matches Properties Asset Spotlight); Investments = indigo→violet (matches investments Asset Spotlight).
- **Stitch-first**: full 8-variant matrix generated and locked before the React port (4 variants per tab — desktop light + dark + mobile light + dark per §18.7.2 dark-mode enforcement).

### Files Modified

- `components/dashboard/tiles/DashboardPropertyTile.tsx` — NEW. ~140 LOC. Glass tile + sky→indigo sub-palette. Consumes `PortfolioSnapshot.properties[number]`. Navigates to `/dashboard/properties/[id]` on click.
- `components/dashboard/tiles/DashboardInvestmentTile.tsx` — NEW. ~150 LOC. Glass tile + indigo→violet sub-palette. Consumes `PortfolioSnapshot.investments.accounts[number]`. Hero balance uses gradient text-fill per §18.7.2 money-signal row. Empty state shows "Add holdings" CTA (psychology lens: celebrate next achievable action). `incomeNode` slot preserves the existing `<InvestmentIncomeDisplay compact />` chip.
- `app/dashboard/page.tsx` — added imports for the two new tiles; replaced ~52 lines of inline Properties `<Card>` with `<DashboardPropertyTile>` (now ~10 lines); replaced ~50 lines of inline Investments `<Card>` with `<DashboardInvestmentTile>` (now ~14 lines including `incomeNode` slot).
- `.stitch/designs/phase45.3/` — NEW. 8 PNG + 8 HTML files (4 Properties tab variants from earlier commits + 4 Investments tab variants added this session). Full design audit trail locked.

### Documentation Updated

- `docs/IMPLEMENTATION_PLAN.md` — Workstream `0·DG` (Dashboard Glass migration) opened earlier this session as a new top-of-list active workstream; row 78 now flipped from queued/in-flight to ✅ SHIPPED with full execution detail. Rows 79-81 (Phase 45.4 KPI row + Net Worth hero; Phase 45.5 insight widgets; Phase 45.6 MoneyStoryHeroV2 + WealthUniverse + DailyPulse) remain queued.
- `docs/changelog/CHANGELOG_2026_06_09.md` — this entry.

### Build Status

- [x] `npx tsc --noEmit` — 0 errors.
- [x] `npm run build` — production build green; no new dynamic routes; bundle size unchanged.
- [x] ESLint clean on touched files. 1 pre-existing warning (`useEffect` missing-dep on `loadDashboardData` in `app/dashboard/page.tsx` line 333) — unrelated to this PR.

### §16.5 Doc-sync block

Surfaces changed in this PR:
- [x] visual design system / component pattern (two new co-located primitives `<DashboardPropertyTile>` + `<DashboardInvestmentTile>` extending the §18.7.2 polished sub-pattern to the dashboard home)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture (no CDR-classified data touched — UI vocabulary swap only)
- [ ] operational procedure
- [ ] strategic decision (workstream `0·DG` opened earlier this PR; Phase 45.3 is the first ship)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md`:workstream `0·DG` — full scope documented + row 78 flipped from queued/in-flight to ✅ shipped.
- `docs/changelog/CHANGELOG_2026_06_09.md`:Phase 45.3 session — this entry.

### Destructive write checklist (§12.11)

None — Phase 45.3 is purely presentational. No Prisma writes anywhere in this PR. Reviewer rejection trigger for the 0·DG workstream codified in IMPLEMENTATION_PLAN.md: any PR touching `app/api/`, `lib/calculations/`, `lib/services/`, `prisma/`, or any non-presentational layer.

### Phase 41E reform compliance (§12.14)

No tax-engine code modified. No financial calc touched. No column added to `Property` / `Investment` / `LegalEntity`. No new AI tool. No new per-asset tax UI. N/A.

---

## Session: Phase 45.2.5 — user-uploadable property hero photo (v1, properties only)

### Context

Continuation of the Phase 45.2.x polish backlog. The Asset Spotlight detail pages shipped in #1024/#1027/#1028 use a curated decor photo (the Cremorne apartment interior) as the L1 photo canvas. Reza's directive during the Phase 45.2 design pass: *"is there an option for the user to change the background photo if they want?"* This session ships that affordance — scoped tightly to properties only per Reza 2026-06-09 *"v1 properties only"*. Investments + SMSF remain on their decor photos until evidence the personalisation lifts engagement.

### Changes Made

- **Type**: Feature — first personalisation extension of the §18.7.4 Cremorne pattern
- **Scope**: schema (`Property.heroImage Bytes? + heroImageMime String?` additive nullable), migration, new auth-gated `/api/properties/[id]/hero-image` route (GET stream / POST upload / DELETE clear), new `<ChangePhotoDialog>` component, properties detail page wiring (Camera button + dynamic L1 photo source), Stitch design pass (full 4-variant matrix).
- **Why inline-DB v1 (not GCS)**: no new infrastructure dependency to ship the affordance; Postgres BYTEA TOAST-compresses fine at the 5MB cap; photos are decor not evidence per §18.7.4 (NOT CDR-classified); storage backend can swap to GCS later via `lib/documents/storage` without touching the API surface or dialog component.
- **Stitch-first**: design pass produced 4 variants (desktop light + dark, mobile light + dark — mobile is a bottom sheet with stacked full-width CTAs, touch-target priority). Sky→indigo sub-palette matches the Properties Asset Spotlight (continuation of context, not a system dialog). Drop zone with drag/drop + click-to-browse + file requirements + "Reset to default" CTA (only when a custom photo already exists). Behaviour-psychology lens: reset CTA copy avoids "Remove" — every path is reversible.
- **Bearer-auth + image elements**: the GET endpoint can't be loaded directly via `<img src>` because Image elements don't send Authorization headers. Solution: detail page fetches the bytes via authenticated `fetch()` → `URL.createObjectURL(blob)` → plain `<img>` (next/image can't optimise blob: URLs). Default decor still goes through next/image. Blob URL revoked on unmount + on photo replacement.
- **Prisma `omit`**: list and detail GET responses for properties now `omit` the heavy bytea + expose `hasHeroImage: boolean`. Required enabling Prisma `omitApi` preview feature on the `generator client` (Prisma 5.22 still gates query-level `omit` behind it).

### Files Modified

- `prisma/schema.prisma` — added `heroImage Bytes?` + `heroImageMime String?` to `Property`; enabled `omitApi` preview feature.
- `prisma/migrations/20260609060000_phase_45_2_5_property_hero_image/migration.sql` — NEW. `ALTER TABLE properties ADD COLUMN heroImage BYTEA + heroImageMime TEXT`.
- `app/api/properties/[id]/hero-image/route.ts` — NEW. ~180 LOC. GET/POST/DELETE with `withPermission('property.read'/'property.write')` + `verifyOwnership` + `createAuditLog` (`PROPERTY_HERO_IMAGE_UPDATED` / `_REMOVED`). MIME allowlist (jpeg/png/webp) + 5MB cap server-side.
- `app/api/properties/[id]/route.ts` — added `omit: { heroImage: true }` to the existing findUnique; response now includes `hasHeroImage: boolean` derived from `heroImageMime !== null`.
- `app/api/properties/route.ts` — added `omit: { heroImage: true }` to the list findMany so list payloads stay lean.
- `components/properties/ChangePhotoDialog.tsx` — NEW. ~290 LOC. Centred-on-desktop / bottom-sheet-on-mobile dialog. File picker + drag/drop + client-side MIME/size validation + preview + "Reset to default" CTA + error surfacing.
- `app/dashboard/properties/[id]/page.tsx` — added Camera icon button to the hero action cluster; added second `useEffect` to fetch the hero-image bytes via authenticated `fetch()` → Blob URL when `property.hasHeroImage`; swapped the L1 `<Image>` to a plain `<img>` when the Blob URL is set; mounted `<ChangePhotoDialog>` at the page root with `photoVersion` state to force re-fetch after save/reset.
- `.stitch/designs/phase45.2.5/change-photo-dialog{,-dark,-mobile,-mobile-dark}-v1.{html,png}` — full 4-variant Stitch matrix (project 1859462351962811110, screen IDs 5e16be2e04c246f4a269d8c65b32349e + 6dd660e5c116479788b2384a0e1866d4 + da480d605e2c4a2195e1a498e91fd6af + e8a992cc054d49ebabd5c8a5964715c3).

### Documentation Updated

- `CLAUDE.md` §18.7.4 replicate queue — added the ticked-off entry for the user-uploadable hero photo (Phase 45.2.5), including the 4 implementation learnings (inline-DB v1 / `omitApi` preview / blob URL + plain `<img>` / Bearer-auth fetch pattern).
- `docs/IMPLEMENTATION_PLAN.md` — row 77 flipped from queued to ✅ shipped with the full execution detail (schema + migration + API + dialog + page wiring + Stitch matrix + scope cap rationale).

### Build Status

- [x] `npx prisma generate` clean.
- [x] `npx tsc --noEmit` — 0 errors.
- [x] `npm run build` — production build green; new route `/api/properties/[id]/hero-image` registers as dynamic ƒ.
- [ ] Manual UI test — pending session-end prod verification per §17.2.

### §16.5 Doc-sync block

Surfaces changed in this PR:
- [x] visual design system / component pattern (new `<ChangePhotoDialog>` primitive + §18.7.4 queue extension)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture (photos are decor not evidence per §18.7.4 — non-CDR; audit-log entries added for upload + remove)
- [ ] operational procedure
- [x] strategic decision (Reza scope cap: v1 properties only — investments + SMSF deferred)

Docs updated in this PR:
- `CLAUDE.md` §18.7.4 — Cremorne replicate queue extended with ticked-off entry for the user-uploadable hero photo (implementation learnings codified for future replication).
- `docs/IMPLEMENTATION_PLAN.md` row 77 — flipped from queued to ✅ shipped with full execution detail + scope-cap decision recorded.
- `docs/changelog/CHANGELOG_2026_06_09.md` — this entry.
- `prisma/schema.prisma` JSDoc — added on the new `heroImage` + `heroImageMime` columns explaining the v1 inline-DB choice + future GCS migration path.
- `app/api/properties/[id]/hero-image/route.ts` JSDoc — file-header explanation of v1 architecture + §12.11 destructive-write commentary inline.
- `components/properties/ChangePhotoDialog.tsx` JSDoc — Stitch screen IDs + design vocabulary references + behaviour-psychology rationale.

### Destructive write checklist (§12.11)

Operations in this PR that touch existing rows:
- `app/api/properties/[id]/hero-image/route.ts:POST` — `prisma.property.update({ where: { id }, data: { heroImage, heroImageMime } })`
- `app/api/properties/[id]/hero-image/route.ts:DELETE` — `prisma.property.update({ where: { id }, data: { heroImage: null, heroImageMime: null } })`

For each operation:
1. **`where` clause matches**: a single property row keyed by id, gated by `verifyOwnership(existing, auth.userId, 'Property')` immediately before the write — only this user's row can be touched.
2. **Columns overwritten**: only the new `heroImage` BYTEA + `heroImageMime` TEXT columns. Both are decorative (the L1 photo on the Asset Spotlight hero canvas), carry no canonical financial data, and are NOT CDR-classified.
3. **Guard ensuring this only mutates rows I created**: ownership check + the operation is the user's explicit intent (uploading a new photo REPLACES the previous one — confirmed by the dialog UX; clicking "Reset to default" clears the columns — confirmed by the named CTA).

User confirmation: NOT REQUIRED — additive nullable columns, replacement of decorative bytes the user just chose to replace, fully reversible (re-upload or reset at any time).

### Schema migration (§12.12)

Matching migration file in the same PR: `prisma/migrations/20260609060000_phase_45_2_5_property_hero_image/migration.sql`. Migration is purely additive (`ADD COLUMN heroImage BYTEA + ADD COLUMN heroImageMime TEXT`), no `DROP`, no `ALTER ... DROP`, no backfill required — existing properties default to NULL → fallback to the default Cremorne apartment decor on the detail page.

---

## Session: Phase 45.2.1 — investments detail (Asset Spotlight, first non-property application)

### Context

Continuation of the Phase 45.x polish backlog. Phase 45.2 (properties detail hero, PR #1024) shipped the canonical §18.7.5 Asset Spotlight template + the Cremorne-Wide variant + the polished-tile sub-pattern. Phase 45.2.1 ships the **first non-property application** of the template, proving it's portable across asset classes with only the per-asset swaps documented in §18.7.5's mapping table.

This session also resolved a P0 prod incident along the way (PR #1026, merged earlier this session): on the properties detail page that shipped in #1024, the L1 photo wrapper used `absolute inset-0 -z-30` but the parent only had `relative`, not `isolate` — so the negative z-index bubbled up to the nearest stacking context (DashboardLayout's `bg-background` wrapper) and the photo rendered behind it. Hotfix added `isolate` to the page container in both the source file AND the §18.7.5 template documentation, so future replications inherit the fix.

### Changes Made

#### Phase 45.2.1 — investments detail (this PR)

- **Type**: Feature — first non-property application of the Asset Spotlight template
- **Scope**: `app/dashboard/investments/accounts/[id]/page.tsx` (new), `app/dashboard/investments/accounts/page.tsx` (CTA rewire), `public/decor/investments-skyline.jpg` (new asset, ~272KB)
- **Description**: New detail route at `/dashboard/investments/accounts/[id]` rendering a single investment account using the §18.7.5 Asset Spotlight composition with indigo→violet sub-palette (Stage I Invest). Hero shows portfolio value + cost basis + gain%; mini-grid shows YTD return / Asset mix / Cash balance; 4-tile polished KPI row shows Dividends / Distributions / Franking credits / Capital gains; left column stacks Portfolio Holdings + Recent Activity; right column stacks Performance scenarios / Tax position / Holdings insight. Photo: financial-district skyline at golden hour (Sydney CBD glass towers).
- **Stitch design pass** (project `1859462351962811110`): v1/v2 redescribed the design in prose — drifted on fonts, tile shadows, spacing. v3 switched to `generate_variants` from the v5 properties source (REFINE creative range + TEXT_CONTENT + COLOR_SCHEME aspects) — inherited every load-bearing structural element verbatim per Reza's *"I want all designs to be similar"* direction. v4 swapped only the photo (apartment-adjacent → Sydney CBD skyline) per Reza's *"background photo of an apartment doesn't suit the investment page"* feedback. Then mode-flip + mobile-reflow generated the full 4-variant matrix.
- **KPI math (v1)**: inline helpers `portfolioValue`, `sumCostBasis`, `gainPercentage`, `ytdReturnPct`, `assetMixLabel`, `dividendsTotal`, `distributionsTotal`, `frankingTotal`, `realizedGains`. Franking + realized gains use coarse proxies (franking% × dividend × 30/70 gross-up; sell proceeds − avgPrice cost) until canonical tax/CGT engines surface per-tx values.
- **List page CTA rewire**: `onView` callback changed from `handleViewDetails(account)` to `router.push(\`/dashboard/investments/accounts/${account.id}\`)`. The detail dialog code remains in the list page but is now unreachable — flagged in CLAUDE.md §12.1 follow-up for cleanup in a subsequent PR.

### Files Modified

- `app/dashboard/investments/accounts/[id]/page.tsx` — NEW. ~600 LOC. Asset Spotlight composition with co-located sub-components (MiniKpi, PolishedKpiTile, HoldingsCard, RecentActivityCard, InsightCard).
- `app/dashboard/investments/accounts/page.tsx` — added `useRouter` import, replaced `onView` dialog handler with `router.push` to the new detail route.
- `public/decor/investments-skyline.jpg` — NEW. ~272KB.
- `.stitch/designs/phase45.2.1/investments-detail-hero{,-v2,-v3,-v4,-dark,-dark-v4,-mobile,-mobile-v4,-mobile-dark,-mobile-dark-v4}.{html,png}` — full design audit trail. Canonical v4 matrix locked.

### Documentation Updated

- `CLAUDE.md` §18.7.4 replicate queue — ticked off `/dashboard/investments/accounts/[id]` with detailed per-surface tuning learnings (the "use `generate_variants` from the closest existing Asset Spotlight artefact" pattern is the key one for SMSF and any future sibling).
- `CLAUDE.md` §18.7.5 per-asset mapping table — confirmed Investment column; updated Mini-KPI 3 from "Risk" to "Cash balance" (matches what shipped).
- `docs/IMPLEMENTATION_PLAN.md` row 74 — flipped to ✅ shipped with the per-surface tuning learnings.
- `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` §5.1 — added Phase 45.2.1 entry; updated §18.7.4 replicate queue note (only SMSF + income-banner remaining).
- `docs/changelog/CHANGELOG_2026_06_09.md` — this file.

### Build Status

- [x] TypeScript compilation passes (`npx tsc --noEmit -p .`)
- [x] No new ESLint warnings on the new file
- [x] Manual testing: dev server pending verification before merge

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] visual design system / component pattern (first non-property application of Asset Spotlight; new sub-component idioms for HoldingsCard / RecentActivityCard tied to investment-shaped data)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Reza directive *"I want all designs to be similar"* drove the `generate_variants` from v5 properties source pattern — codified into the §18.7.4 queue tick-off as the recommended approach for future sibling pages)

Docs updated in this PR:
- `CLAUDE.md:§18.7.4 (queue tick-off)` — investments detail shipped, with the `generate_variants` pattern documented as the recommended approach for future siblings (SMSF, loans).
- `CLAUDE.md:§18.7.5 (per-asset mapping)` — confirmed Investment column matches what shipped (Mini-KPI 3 Cash balance not Risk).
- `docs/IMPLEMENTATION_PLAN.md:row 74` — flipped to ✅ shipped.
- `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md:§5.1` — Phase 45.2.1 entry + updated queue.

### Destructive write checklist (CLAUDE.md §12.11)

No destructive Prisma writes in this PR. NEW route is GET-only (read account + holdings + transactions). The list page CTA rewire is a navigation change only.

User confirmation: NOT REQUIRED — no destructive writes.

### Schema change (CLAUDE.md §12.12)

No `prisma/schema.prisma` changes in this PR.

### Phase 41E reform compliance (CLAUDE.md §12.14)

No `lib/tax-engine/*` modifications. New file does not introduce any tax-affected calculations beyond the franking gross-up approximation (already used elsewhere). No FW-1/FW-2/FW-3/FW-4/FW-5 triggers.

Functions/tools touched: none in `lib/tax-engine/*`. Inline `frankingTotal()` helper in `app/dashboard/investments/accounts/[id]/page.tsx` uses 30/70 gross-up — a long-established AU constant unaffected by the reform; if Phase 41E later changes franking treatment, this helper would be swapped for the canonical engine alongside every other franking site.

### PR

- PR URL: pending creation

---

## Session: Asset Spotlight hero photo quality + investments subject pivot

### Context

Reza feedback after Phase 45.2.1 shipped:
> "Also just note the existing default background photos look low resolution and not a good quality, can we fix it? Also the investment photo isnt really related to investments. It gives feeling of apartment blocks. change the photo on that as well"

Two callouts:
1. **Resolution** — the previous decor assets (`cremorne-apartment.jpg` 80KB, `investments-skyline.jpg` 278KB) were downloaded from Stitch's CDN at the default 512-wide preview, then served undersized behind a 1200px hero canvas. Visible softness at native scale.
2. **Subject misfit** — the Sydney CBD glass-tower skyline used for investments read as "high-density apartment blocks" rather than "investment account." The visual decision needed to swap to a subject that's unmistakably NOT residential and that aligns with the financial-adviser-lens vocabulary of long-term growth.

### Changes Made

- **Type**: Asset / decor refresh
- **Scope**: `public/decor/cremorne-apartment.jpg` (re-rendered in place), `public/decor/investments-horizon.jpg` (NEW, replaces `investments-skyline.jpg`), `app/dashboard/investments/accounts/[id]/page.tsx` (path swap)
- **Properties photo**: re-rendered via Stitch with an explicit "Architectural Digest / Dwell magazine tier" prompt — Sydney waterfront Cremorne/Mosman aesthetic, golden-hour light on wide-plank oak, low-profile cream linen sofa, brass fixtures, cognac leather accents. Same subject as before (apartment interior is appropriate for the Properties module), but at full 1376×768 native resolution (170KB JPEG) instead of the previous 80KB CDN-shrunk version. Both `app/dashboard/properties/[id]/page.tsx` and the `sellProperty` what-if lever inherit the upgrade because they reference the same path.
- **Investments photo**: completely swapped to an aerial mountain horizon at golden hour. New file `investments-horizon.jpg` (228KB, 1376×768). The CBD skyline is retired. Rationale: per the financial-adviser lens, long-term growth / compound horizon is a more honest visual metaphor for an investment account than urban density, and the new asset is unmistakably NOT residential — solves both of Reza's callouts in one pivot.
- **Path swap**: `app/dashboard/investments/accounts/[id]/page.tsx:328` changed `/decor/investments-skyline.jpg` → `/decor/investments-horizon.jpg`.

### Files Modified

- `public/decor/cremorne-apartment.jpg` — re-rendered, 80KB → 170KB.
- `public/decor/investments-horizon.jpg` — NEW, 228KB.
- `public/decor/investments-skyline.jpg` — DELETED.
- `app/dashboard/investments/accounts/[id]/page.tsx` — single path change.

### Documentation Updated

- `CLAUDE.md` §18.7.4 queue note for `/dashboard/investments/accounts/[id]` — added a post-ship update documenting both pivots (resolution upgrade + subject swap from skyline to horizon) and the rationale per the financial-adviser lens.

### Build Status

- [x] TypeScript compilation passes (`npx tsc --noEmit -p .`)
- [x] Manual review of both photos by Reza before commit (approved)

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] visual design system / component pattern — decor asset subject + quality
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision — investments hero subject pivots from "urban skyline" to "mountain horizon" as the canonical investment-class decor; documented in §18.7.4 queue note for future siblings (SMSF, loans) to know the established vocabulary

Docs updated in this PR:
- `CLAUDE.md:§18.7.4 (queue tick-off for investments)` — appended a post-ship update describing both pivots and the rationale.
- `docs/changelog/CHANGELOG_2026_06_09.md` — this entry.

### Destructive write checklist (CLAUDE.md §12.11)

No destructive Prisma writes in this PR. Only static asset replacements + a single path change.

User confirmation: NOT REQUIRED — no destructive writes.

### Schema change (CLAUDE.md §12.12)

No `prisma/schema.prisma` changes in this PR.

---

## Session: Phase 45.2.2 — SMSF detail (Asset Spotlight, third asset class)

### Context

Continuation of the Phase 45.x polish backlog per Reza's "Finish SMSF first, then upload-photo" sequencing decision earlier this session. Phase 45.2.2 ships the third asset-class application of the §18.7.5 Asset Spotlight template, completing the three single-asset detail pages (properties + investments + SMSF) covered by the §18.7.4 replicate queue.

### Changes Made

- **Type**: Feature — third asset-class application of Asset Spotlight
- **Scope**: `app/dashboard/investments/super/[id]/page.tsx` (new), `app/dashboard/investments/super/page.tsx` (CTA rewire), `public/decor/smsf-lobby.jpg` (new asset, ~144KB)
- **Description**: New detail route at `/dashboard/investments/super/[id]` rendering a single super/SMSF account using the §18.7.5 Asset Spotlight composition with sky→indigo sub-palette (same Stage I Invest as properties — SMSF shares the "long-term anchored asset" mood; codified explicitly in the §18.7.5 mapping table so future sessions don't accidentally apply investments' indigo→violet here). Hero: member balance + concessional YTD with cap-utilization pill. Mini-grid: Concessional used % / Non-Concessional used % / 1Y return. 4-tile polished KPI row: SG inflows / Salary sacrifice / Personal deductible / Carry-forward avail. Left column: Contributions breakdown + Recent activity. Right column: Cap optimisation / Tax position / Pension phase insights.
- **Data flow (v1)**: fetches `/api/tax/super` (the same endpoint the list page uses) and filters client-side to the requested account. Matches the existing list-page pattern. No new GET endpoint scaffolded (PUT/DELETE exist at `/api/tax/super/[id]` but not GET; adding GET is a follow-up cleanup).
- **List page CTA rewire**: `handleViewDetails` changed from `setDetailAccount(account)` modal state to `router.push` to the new detail route.

### Documentation Updated

- `CLAUDE.md` §18.7.4 queue tick-off for SMSF + §18.7.5 per-asset mapping table SMSF column updated to reflect what shipped.
- `docs/IMPLEMENTATION_PLAN.md` row 75 — flipped to ✅ shipped.
- `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` §5.1 — Phase 45.2.2 entry + queue updated.

### Build Status

- [x] TypeScript compilation passes (`npx tsc --noEmit -p .`)
- [x] Reza approved the 4-variant Stitch matrix before React port

### Doc-sync block (CLAUDE.md §16.5)

Surfaces changed in this PR:
- [x] visual design system / component pattern — third asset-class application of Asset Spotlight
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision — sub-palette decision (sky→indigo NOT indigo→violet for SMSF) codified explicitly in §18.7.5 mapping table

Docs updated in this PR:
- `CLAUDE.md:§18.7.4 (queue tick-off for SMSF)` — shipped with per-surface tuning learnings
- `CLAUDE.md:§18.7.5 (per-asset mapping)` — SMSF column updated to match what shipped
- `docs/IMPLEMENTATION_PLAN.md:row 75` — flipped to ✅ shipped
- `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md:§5.1` — Phase 45.2.2 entry + queue
- `docs/changelog/CHANGELOG_2026_06_09.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)

No destructive Prisma writes in this PR. New route is GET-only. The list page CTA rewire is a navigation change only.

User confirmation: NOT REQUIRED — no destructive writes.

### Schema change (CLAUDE.md §12.12)

No `prisma/schema.prisma` changes in this PR.

### Phase 41E reform compliance (CLAUDE.md §12.14)

No `lib/tax-engine/*` modifications. Cap values pulled from `/api/tax/super`'s `position.caps.*.cap`, which the canonical `taxYearConfig` engine sources. If Phase 41E later changes super cap thresholds, the canonical engine is the only update site.

Functions/tools touched: none in `lib/tax-engine/*`.
