# Changelog — 2026-06-09

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
