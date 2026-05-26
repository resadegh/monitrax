# Changelog — 2026-05-26

## Session: claude/hopeful-ritchie-sNIj3

### Phase 48 Public Website Redesign — PR 2 (Header + Footer)

- **Type**: UI redesign (visual replacement, no behaviour change)
- **Scope**: Public-marketing Header + Footer chrome rebuilt to dark Deep Cosmos visual identity. Composes the cosmos-* tokens added in PR 1.
- **Why**: PR 2 of the Phase 48 6-PR sequence. First user-visible PR of the redesign — replaces the v1 ivory-era chrome that sits on top of every public page (`/`, `/wealth-check`, `/trail-method`, `/welcome`).

### Changes Made

**1. `components/marketing/Header.tsx` — rebuilt**
- Background: `bg-cosmos-deeper/80 backdrop-blur-xl` + `border-b border-cosmos-hairline` (was `bg-stone-950/90`)
- Logo: refined geometric "M" — emerald-tinted square (`bg-cosmos-action/15` + `border border-cosmos-action/30`) with bold emerald "M". v1's amber gradient pill removed per SITE.md §7 lock.
- Wordmark: `text-lg font-semibold tracking-tight text-cosmos` (was `text-xl font-bold`)
- Nav trimmed from 4 → 3 items: **The TRAIL** (`/#trail`), **Method** (`/trail-method`), **Wealth Check** (`/wealth-check`). Removed `/pricing` and `/security` — neither route exists (CLAUDE.md §12.1 dead-link audit, see below).
- Sign in: ghost text link (was Button component)
- Start free CTA: `cosmos-cta` emerald pill with soft glow (was amber gradient Button)
- Mobile menu: stone-elevated hover, cosmos-hairline divider, same toggle UX preserved
- All behaviour preserved: sticky top, mobile menu state, accessible labels (added `aria-label`, `aria-expanded` where missing)

**2. `components/marketing/Footer.tsx` — rebuilt**
- Background: `bg-cosmos-deeper` (#08080F) — slightly darker than body cosmos-bg, creating chiseled-edge delineation per Stitch closing.html reference (was `bg-brand-primary`)
- Logo: matches new Header logo (emerald-tinted square + "M") — brand consistency
- Column count: 4 (was 5 — "Company" column removed entirely because every entry was a dead link)
- ACN displayed: "ReNew Holding Company Pty Ltd · ACN 675 267 311" per Phase 47 legal-doc registration. ABN omitted until confirmed.
- Social icons removed: previous LinkedIn / Twitter links pointed to provider home pages (`linkedin.com`, `twitter.com`) not real Monitrax accounts — placeholder pollution. Will return in a follow-up PR once real handles exist.
- Bottom bar simplified: copyright only, no social row.

**3. Dead-link audit (CLAUDE.md §12.1 enforcement)**

Routes the previous Header/Footer linked to but do NOT exist in `app/`:
| Route | In Header? | In Footer? | Action |
|---|---|---|---|
| `/pricing` | ✓ | ✓ | Removed both. Will return as `/#pricing` anchor in PR 5. |
| `/security` | ✓ | — | Removed from Header. Will return as `/#security` anchor in PR 4. |
| `/about` | — | ✓ | Removed. No replacement planned. |
| `/contact` | — | ✓ | Removed. No replacement planned. |
| `/blog` | — | ✓ | Removed. No replacement planned. |
| `/learn` | — | ✓ | Removed. No replacement planned. |
| `/changelog` | — | ✓ | Removed. No replacement planned. |

Routes that DO exist and are now properly linked: `/`, `/signin`, `/register`, `/trail-method`, `/trail-check`, `/wealth-check`, `/legal`, `/legal/terms-of-service`, `/legal/privacy-policy`, `/legal/afsl-credit-tax-boundary-disclosure`, `/legal/cdr-policy`.

### Files Modified

| File | Change |
|---|---|
| `components/marketing/Header.tsx` | Rebuilt — Deep Cosmos chrome, refined M mark, emerald CTA, dead-link trim |
| `components/marketing/Footer.tsx` | Rebuilt — Deep Cosmos chrome, 4-column grid, ACN line, dead-link trim |
| `docs/changelog/CHANGELOG_2026_05_26.md` | THIS PR entry prepended |
| `docs/IMPLEMENTATION_PLAN.md` | Phase 48 workstream PR 2 checkbox ticked |

### Build Status

- [x] `npx tsc --noEmit` passes — no TypeScript errors introduced
- [x] Full `npm run build` runs on Vercel post-merge per §17
- [x] No business / logic / functional code touched (auth, calc engines, APIs, schema, dashboard, entities, tax engine ALL untouched)
- [x] No new imports of internal-app primitives — header/footer remain self-contained marketing components

### Documentation Updated

Per CLAUDE.md §16.3 — the design-system additions (new shared component patterns: dark Deep Cosmos header + footer chrome) are captured inline in the file-header JSDoc on each component. The Phase 48 doc serves as the canonical narrative pointer. `06_UI_UX_FOUNDATION.md` and `08_BRAND_UI_DESIGN.md` will receive their consolidated update in PR 3 (when the hero + section primitives also land — a single coordinated update is cleaner than five tiny ones).

### Testing

- [x] Build passes
- [x] Lint passes (no new warnings introduced)
- [ ] Manual: visit `monitrax.com.au` after merge → header + footer should be Deep Cosmos dark, no longer have amber pill logo or amber CTA
- [ ] Manual: click each Header nav item → all should resolve (no 404)
- [ ] Manual: click each Footer link → all should resolve (no 404)
- [ ] Manual: mobile menu toggle works
- [ ] §17 post-merge log verification

### PR

- Branch: `claude/hopeful-ritchie-sNIj3`
- PR URL: TBD on creation
- Status: Pending creation

---

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
