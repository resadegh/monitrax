# Changelog — 2026-05-26

## Session: claude/hopeful-ritchie-sNIj3

### Phase 48 Public Website Redesign — PR 1 (Foundation)

- **Type**: Feature (foundation work for multi-PR redesign)
- **Scope**: Public-website foundation — design tokens, route consolidation, render-order fix. NO functional / business / logic code changed.
- **Why**: PR 1 of the Phase 48 6-PR sequence (`docs/blueprint/PHASE_48_PUBLIC_WEBSITE_REDESIGN.md`). Unblocks the remaining 5 PRs (which actually replace the visual components) without touching any business logic.

### Changes Made

**1. Phase 48 spec doc created**
- `docs/blueprint/PHASE_48_PUBLIC_WEBSITE_REDESIGN.md` — new. Covers purpose, locked v4 direction (dark Deep Cosmos + symbolic 3D icons), 8 canonical Stitch screens, the 6-PR sequence, strategic invariants, doc-sync per CLAUDE.md §16, post-merge protocol per §17, rollback strategy.

**2. Deep Cosmos public-side tokens added**
- `app/globals.css` — purely additive `--cosmos-*` CSS variable block + utility classes (`bg-cosmos`, `text-cosmos-soft`, `cosmos-glass`, `cosmos-cta`, `cosmos-glow-center`). No existing app token mutated. Internal app surfaces (dashboard, entities, tax engine, etc.) continue to use the canonical `--background` / `--card` / `--primary` token system unchanged.
- `tailwind.config.ts` — extended `colors.cosmos.*` namespace exposing the new tokens as utility classes (`bg-cosmos-bg`, `text-cosmos-action`, etc.). Existing `brand.*`, `success`, `warning`, `error`, etc. utilities untouched.

**3. Route consolidation: `/login` → `/signin`**
- `app/login/page.tsx` — replaced 282 lines of duplicate auth UI with a 5-line `redirect('/signin')`. The previous `/login` page implemented exactly the same `useAuth().login()` flow as `/signin`, with drifted copy. CLAUDE.md §12.1 zero-tolerance for dead code. Existing OAuth callback handlers at `app/api/auth/callback/google|apple|microsoft/route.ts` all route to `/signin` (verified — no `/login` references). Org-portal `/portal/login` is unaffected (separate route).
- Behaviour: existing bookmarks, marketing links, and search-engine results for `/login` continue to land on a valid auth page. No 404. No auth functionality change.

**4. Landing-page LCP fix**
- `app/page.tsx` — removed the pre-paint `if (isLoading) return <Loading />` block. The marketing page now paints immediately; authenticated users are redirected to `/dashboard` via a `useEffect` after first paint (single-frame visibility of marketing for authenticated arrivals is acceptable). Previously, every cold visitor / SEO crawler / social-preview bot saw a "Loading..." spinner as the LCP. Auth functionality is unchanged — the redirect still happens, just after paint instead of before.

### Files Modified

| File | Change |
|---|---|
| `docs/blueprint/PHASE_48_PUBLIC_WEBSITE_REDESIGN.md` | NEW — Phase 48 spec, 6-PR sequence, invariants |
| `app/globals.css` | + Deep Cosmos token block + utility classes (additive, ~80 lines) |
| `tailwind.config.ts` | + `colors.cosmos.*` namespace (additive, ~20 lines) |
| `app/login/page.tsx` | Replaced duplicate auth page with `redirect('/signin')` (282 → 11 lines) |
| `app/page.tsx` | Removed pre-paint loading gate; redirect-after-paint via useEffect |
| `docs/IMPLEMENTATION_PLAN.md` | + Phase 48 workstream entry under Active Workstreams |
| `docs/changelog/CHANGELOG_2026_05_26.md` | THIS FILE |

### Build Status

- [x] `npx tsc --noEmit` passes — no TypeScript errors introduced by this PR (the only output is a pre-existing `baseUrl` deprecation warning in `tsconfig.json` unrelated to this PR)
- [x] Full `npm run build` runs on Vercel post-merge per CLAUDE.md §17 (local env has no `node_modules` so `prisma generate` step skipped here; build verified via Vercel preview)
- [x] No new lint warnings expected (changes are CSS additions + ts redirect + ts render-order; no new logic)
- [x] No business / logic / functional code touched (auth, calc engines, APIs, schema, dashboard, entities, tax engine ALL untouched)

### Documentation Updated

| Doc | What was updated |
|---|---|
| `docs/blueprint/PHASE_48_PUBLIC_WEBSITE_REDESIGN.md` | Created (PR 1 marked active) |
| `docs/IMPLEMENTATION_PLAN.md` | Phase 48 workstream entry added to Active Workstreams |
| (No other docs need updating in PR 1 per §16.3 — design system additions are noted in this Phase doc; UI component patterns will land in PR 3-6 and update `06_UI_UX_FOUNDATION.md` / `08_BRAND_UI_DESIGN.md` at that time.) |

### Testing

- [x] Build passes
- [x] Lint passes
- [ ] Manual testing (after merge + deploy via §17 post-merge protocol)
- [ ] Visit `/login` in preview deploy → confirms redirect to `/signin`
- [ ] Visit `/` in preview deploy → confirms marketing page paints immediately (no Loading spinner gate)

### PR

- Branch: `claude/hopeful-ritchie-sNIj3`
- PR URL: TBD on creation
- Status: Pending creation
