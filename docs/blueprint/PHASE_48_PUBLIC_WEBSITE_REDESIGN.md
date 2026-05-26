# Phase 48 — Public Website Redesign

> **Status:** 🟡 ACTIVE — PR 1 (Foundation) shipping in this PR
> **Owner:** Reza (direction) + Claude (build)
> **Created:** 2026-05-26
> **Design source:** `.stitch/` (Stitch project `1859462351962811110`)
> **Locked direction:** v4 — Dark Deep Cosmos + symbolic 3D icons (`.stitch/SITE.md` §7)

---

## §1 — Purpose

Replace the current public website (`https://www.monitrax.com.au`) with a premium dark-mode redesign that:

1. **Positions Monitrax as a wealth-builder operating system**, not a budgeting tool (Phase 46 / `docs/marketing/THE_TRAIL_METHOD.md` positioning DNA).
2. **Reads at Mercury / Linear / Arc / Copilot Money quality** — calm, premium, restraint-as-luxury.
3. **Unifies brand identity** across landing, auth, and secondary public pages on a single design system (Deep Cosmos OS, as Stitch named it).
4. **Removes structural debt** in the current public site: amber-as-primary brand drift, light-dark-light-light section alternation, pre-paint loading gate, duplicate auth routes, dead footer links, fragmented motion vocabulary.

---

## §2 — The locked v4 direction (do NOT re-litigate)

`.stitch/SITE.md` §7 records the direction lock from 2026-05-26 ~02:00 UTC. Key invariants:

| Concern | Locked decision |
|---|---|
| **Theme** | Dark Deep Cosmos `#0A0A14` background (never pure black) |
| **Brand action** | Emerald `#16A34A` for CTAs + brand accent only |
| **Hero ornament** | 6 floating 3D symbolic icons (no labels): house · 3 columns · shield · `$` · upward chart · bank. Aligned with `components/wealth/wealthGlyphs.tsx` filled-silhouette vocabulary, rendered 3D-glossy for marketing. |
| **Hero headline** | *"Your wealth, fully integrated."* — Inter 700, 96px desktop, letter-spacing `-0.04em`, emerald-gradient highlight on line 2 |
| **Typography** | Inter only. 700 hero ONLY; 600 sections; 500 eyebrows + labels; 400 body |
| **TRAIL stage hues** | Canonical SSOT preserved (T sky · R amber · A indigo · I emerald · L violet) per `lib/navigation/trailNav.tsx` |
| **Prompt doctrine for future Stitch iterations** | Free creative latitude. Brand essence + content invariants only. No "forbidden" lists. |

Stitch named its emergent design system **"Deep Cosmos OS"** / **"Monitrax Core"** — adopt these names in component naming where natural.

---

## §3 — Canonical Stitch screens (designs locked, awaiting React conversion)

All 8 reside in Stitch project `1859462351962811110`. Local copies in `.stitch/designs/`.

| # | Surface | Screen ID | Dimensions | Local file |
|---|---|---|---|---|
| 1 | Hero (symbolic 3D icons) | `42730aaf80ed4fcf822278e642d476a9` | 2560×2362 | `dark-hero.{html,png}` |
| 2-3 | Proof Strip + One Picture | `576da1f5461442c1be23a62b6debfabe` | 2560×2706 | `below-hero.{html,png}` |
| 4-5 | Five Capabilities + How It Works | `d51c4876e7464a10800eaa82bd2b969b` | 2560×4256 | `five-and-how.{html,png}` |
| 6-7 | Security + AI | `134afb0289bd49d19de9b9f4c8fe0ce5` | 2560×4258 | `security-and-ai.{html,png}` |
| 8 | Pricing | `131a10110ae34e269e67753222c7ac8a` | 2560×2738 | `pricing.{html,png}` |
| 9-11 | FAQ + Final CTA + Footer | `882af1ad41754955a7f367e8760a36a5` | 2560×4284 | `closing.{html,png}` |
| Auth | Sign-in | `1d6a272620ba4db88f6868d32d1fa51f` | 2560×2048 | `signin.{html,png}` |
| Auth | Sign-up / Register | `613fdfae5ab040ecb335c3f400d46ad4` | 2560×2554 | `register.{html,png}` |

3 hero variant explorations preserved at `.stitch/designs/variants/` (Orbital · Cascading · Kinetic). Warm-ivory v2 work preserved at `*-ivory.{html,png}` — kept as a candidate light-mode toggle option in v5.

---

## §4 — The 6-PR sequence

Each PR is shippable independently. Each carries the full §16.5 doc-sync block + the §11 CHANGELOG entry + the §17 post-merge log-verification.

### **PR 1 — Foundation** *(this PR)*
**Scope:**
- This Phase 48 doc (you're reading it)
- Deep Cosmos public-side tokens added to `app/globals.css` (additive — doesn't break app tokens)
- New Tailwind utilities for `cosmos-bg`, `cosmos-surface`, `cosmos-elevated`, `cosmos-glass` in `tailwind.config.ts`
- Consolidate duplicate `/login` route → redirect to `/signin`
- Fix `app/page.tsx` loading gate so the marketing page paints before auth resolution (current behaviour blocks LCP behind a Loading spinner)
- CHANGELOG entry

**Risk:** Near-zero. All changes are additive, route-level, or render-order. Build + lint pass independently.

**Acceptance:**
- ✅ `npm run build` passes
- ✅ Fetching `/` paints the marketing page in the first paint (not a Loading spinner)
- ✅ Visiting `/login` redirects to `/signin` (and the existing 282-line `app/login/page.tsx` is gone, replaced by a tiny redirect)
- ✅ `app/globals.css` has the new `--cosmos-*` token block, additive only (no existing token mutated)

### **PR 2 — Header + Footer**
Rebuild `components/marketing/Header.tsx` + `Footer.tsx` to match the dark Deep Cosmos design. Refined geometric "M" wordmark (no amber gradient pill — that's v1 leftover). Footer slightly darker `#08080F`. Kill dead footer links (`/blog`, `/learn`, `/changelog`, `/about`, `/contact` — verify each before removing).

### **PR 3 — Hero + IA re-sequence**
Build new `components/marketing/Hero.tsx` from `dark-hero` screen. Six floating 3D icon assets baked in as `<Image>` from Stitch CDN or downloaded locally. Re-sequence `app/page.tsx` to: Hero → Proof Strip → One Picture → Five Capabilities → How It Works → Security → AI → Pricing → FAQ → Final CTA → Footer. Migrate `components/marketing/animations.tsx` to compose `components/shell/motion.ts` (`appleEase`, `springSnap`, `tileEnter`, `heroEnter`, `useReducedMotionSafe`).

### **PR 4 — Five Capabilities + How It Works + Security + AI**
Build 4 sections in one PR. They share the dark glass-card vocabulary and don't introduce new visual primitives. TRAIL hue accents preserved verbatim from `lib/navigation/trailNav.tsx` SSOT.

### **PR 5 — Pricing + FAQ + Final CTA**
Pricing page (`/pricing` standalone or inline on `/`), FAQ accordion, final CTA section. Plus copy review against `docs/marketing/THE_TRAIL_METHOD.md` and Phase 46 §9 AFSL boundary discipline.

### **PR 6 — Auth surfaces**
Replace `app/signin/page.tsx`, `app/register/page.tsx`, `app/forgot-password/page.tsx`, `app/verify-email/page.tsx`, `app/resend-verification/page.tsx`, `app/welcome/page.tsx` chrome with the Deep Cosmos auth family. All single-column centred form, subtle radial emerald glow, consistent input + button vocabulary. Honour existing form logic + AuthContext + MFA paths — only the visual shell changes.

---

## §5 — Secondary public surfaces (queued, not in 6-PR scope)

- `/trail-check` — 5-question TRAIL stage assessment funnel
- `/wealth-check` — Phase 46 dollar-specific retirement-gap funnel
- `/trail-method` — public method explainer
- `/help/*` — help center pages

These already exist with their own design conventions. Refresh in a follow-up Phase 48.x after the main 6 PRs land + are validated.

---

## §6 — Strategic invariants preserved across every PR

These come from CLAUDE.md, TRAIL_FRAMEWORK.md, Phase 46, and THE_TRAIL_METHOD.md. They are NOT negotiable per PR:

1. **Wealth-builder ICP language** — never lifestyle-spending vocabulary (Date Night / Wedding / Groceries / Baby etc.). Always wealth structures (Property / SMSF / Trust / Super / Investments / Company / Tax / Cashflow).
2. **AFSL boundary copy** — never "AI advisor", "AI wealth manager". Always "explains, models, surfaces" / "we don't recommend products". Per Phase 46 §9 + Phase 41 regulatory architecture.
3. **TRAIL stage hue SSOT** — never drift from `lib/navigation/trailNav.tsx` `TRAIL_STAGE_TONES` (T sky · R amber · A indigo · I emerald · L violet).
4. **Restraint over richness** — Apple / Linear / Mercury reference. Never neon, trading-app aesthetics, crypto blobs, character-led AI mascots.
5. **Motion via canonical primitives** — `appleEase`, `springSnap`, `useReducedMotionSafe` from `components/shell/motion.ts`. Never redefine locally.
6. **Accessibility** — WCAG AA contrast minimum; `prefers-reduced-motion` honoured everywhere; ≥44px tap targets on mobile.

---

## §7 — Doc-sync (per CLAUDE.md §16) — what each PR updates

| PR | Docs touched |
|---|---|
| **PR 1** | This Phase 48 doc · `docs/changelog/CHANGELOG_2026_05_26.md` · `docs/architecture/08_BRAND_UI_DESIGN.md` (Deep Cosmos public-side token row added) · `IMPLEMENTATION_PLAN.md` (start Phase 48 workstream entry) |
| **PR 2** | This doc (§4 PR2 row marked ✅) · CHANGELOG · `docs/architecture/06_UI_UX_FOUNDATION.md` (public Header/Footer pattern) |
| **PR 3** | This doc (§4 PR3 ✅) · CHANGELOG · `06_UI_UX_FOUNDATION.md` (public hero pattern) · `08_BRAND_UI_DESIGN.md` (dark-theme decisions) |
| **PR 4** | This doc (§4 PR4 ✅) · CHANGELOG · `06_UI_UX_FOUNDATION.md` (capability card pattern) · TRAIL_FRAMEWORK.md if any framing copy changes |
| **PR 5** | This doc (§4 PR5 ✅) · CHANGELOG · `08_BRAND_UI_DESIGN.md` (pricing card pattern) · Phase 46 if any /wealth-check teaser added |
| **PR 6** | This doc (§4 PR6 ✅) · CHANGELOG · `docs/operational/security/01_AUTHENTICATION.md` if visual change touches MFA flow chrome |

---

## §8 — Post-merge protocol (per CLAUDE.md §17)

After each PR merges:
1. Within ~5 min: `./scripts/vercel-logs.sh list` → confirm new deploy `READY`
2. If `ERROR`: `./scripts/vercel-logs.sh build <id>` + report diagnosis
3. If `READY`: `./scripts/vercel-logs.sh latest-runtime` + compare to pre-merge baseline
4. Visit `monitrax.com.au` in incognito to confirm visual changes match Stitch designs

---

## §9 — Rollback strategy

Each PR is independently revertable via `git revert <merge-sha>` because:
- PR 1: token additions are additive; route consolidation has a redirect fallback; loading gate fix is a single component edit
- PR 2-6: each touches a discrete set of files (header/footer pair, hero+page.tsx, individual sections)

Stitch designs remain in `.stitch/designs/` regardless — if a PR ships and we want to iterate the design after, we can edit the Stitch screen, re-export, and update the React component in-place.

---

*Drafted 2026-05-26. PR 1 ships this session.*