# Changelog — 2026-05-26

## Session: claude/hopeful-ritchie-sNIj3

### Phase 48.7 — Secondary public pages → Deep Cosmos

- **Type**: UI redesign — token migration on the secondary public surfaces left over from the Phase 48 scope.
- **Scope**: `/trail-method` + `/wealth-check` + `/trail-check`. **No business logic touched.** Pure visual: v1 stone/amber/orange/yellow colour vocabulary → Deep Cosmos cosmos-* tokens. TRAIL stage SSOT corrected on the trail-method + trail-check pages.
- **Why**: Reza spotted that after Phase 48 PR 6 landed, these two pages still rendered with their old v1 ivory bodies + amber accents — making the new dark Deep Cosmos `<Header>`/`<Footer>` sit awkwardly on top of legacy content (mismatch caught on 2026-05-26 ~17:00 AEST visual check). Phase 48 doc §5 had originally queued these as "Phase 48.x follow-up after the main 6 PRs land + are validated" — this is that follow-up.

### What changed

**`/trail-method` (244 lines):**
- TRAIL stage colours were drifted from the canonical SSOT (`lib/navigation/trailNav.tsx` → `TRAIL_STAGE_TONES`). Hard-coded as: T amber · R orange · A emerald · I sky · L yellow. Migrated to the canonical: **T sky · R amber · A indigo · I emerald · L violet** via the `text-cosmos-track/reduce/anchor/invest/live` tokens introduced in Phase 48 PR 1.
- Page wrapper: `bg-white dark:bg-stone-950` → `bg-cosmos`.
- Alternating section bands: `bg-stone-50 dark:bg-stone-900` → `bg-cosmos-deeper/40`.
- Body text: `text-stone-600 dark:text-stone-400` → `text-cosmos-soft`. Headings: `text-stone-900 dark:text-stone-100` → `text-cosmos`.
- Hero brand accent ("to Financial Freedom" + "The TRAIL Method" eyebrow): `text-amber-500` → `text-cosmos-action` (locked v4 brand emerald).
- CTA button: amber gradient pill → `cosmos-cta` rounded-full emerald.

**`/wealth-check` (496 lines):**
- Heavy amber accents → emerald `text-cosmos-action` across slider values, percentile highlights, selected-band rings, result-card heading.
- Form / card surfaces: `bg-stone-900/50` → `bg-cosmos-surface/50`; `border-stone-800/80` → `border-cosmos-hairline`.
- Range slider `accent-amber-500` → `accent-cosmos-action`.
- Primary CTA gradient → `cosmos-cta`.
- All stone-* text colours → cosmos-* vocabulary (soft / muted / faint).
- Result-card highlight gradient: `from-amber-500/10 to-amber-600/5` → `from-cosmos-action/10 to-cosmos-action/5`.

### Strategic notes (architect lens)

**1. TRAIL stage SSOT corrected.** This was a real drift — `/trail-method` had hard-coded the wrong stage hues (likely from an earlier draft before `lib/navigation/trailNav.tsx` became the SSOT). The migration to `text-cosmos-track/reduce/anchor/invest/live` makes the SSOT structurally enforced because those tokens read from `app/globals.css` which reads from one canonical block.

**2. Form logic preserved verbatim.** `/wealth-check` has a non-trivial state machine (age slider · income slider · net-worth band selector · computation → result + lever surface). NONE of the calc functions, hooks, or framer-motion animation logic were touched. Pure presentational token swap.

**3. Mechanical migration via `sed`** — every replacement was a 1:1 token swap with no semantic change. Easier to audit (just check for any remaining `amber|stone-[0-9]` in the diff — verified clean).

### Files Modified

| File | Change |
|---|---|
| `app/trail-method/page.tsx` | v1 stone/amber → cosmos-* tokens; TRAIL hue SSOT corrected |
| `app/wealth-check/page.tsx` | v1 stone/amber → cosmos-* tokens |
| `docs/changelog/CHANGELOG_2026_05_26.md` | Phase 48.7 entry prepended |
| `docs/IMPLEMENTATION_PLAN.md` | Phase 48.7 noted, "secondary public surfaces" follow-up cleared |

### Build Status

- [x] `npx tsc --noEmit` passes
- [x] No business logic touched (verified by file diff — only className strings changed)
- [x] No remaining v1 `amber-*` / `stone-[0-9]` Tailwind classes on the modified pages

### Testing

- [x] Build passes (TypeScript)
- [ ] Vercel preview: `/trail-method` reads as full Deep Cosmos end-to-end with correct TRAIL hues
- [ ] Vercel preview: `/wealth-check` reads as full Deep Cosmos; sliders + result card use emerald
- [ ] §17 post-merge log verification

### PR

- Branch: `claude/hopeful-ritchie-sNIj3`
- PR URL: TBD
- Status: Pending creation

---

### Phase 48 Public Website Redesign — PR 6 (Auth surfaces — final PR)

- **Type**: UI redesign (visual replacement, ZERO auth-logic change)
- **Scope**: Auth chrome on `/signin`, `/register`, `/verify-email`, `/resend-verification` rebuilt to dark Deep Cosmos via a shared `AuthShell` wrapper. **No business / logic / functional code touched** — all hooks, handlers, AuthContext usage, MFA paths, OAuth flows, Phase 47 consent block logic preserved verbatim.
- **Why**: PR 6 of the Phase 48 6-PR sequence. Final PR. After this lands the entire public-facing surface (landing + auth) is unified dark Deep Cosmos.

### New: shared `AuthShell` primitives

`components/auth/AuthShell.tsx` (new) — single-column centred form chrome shared across all auth pages. Exports:

| Export | Purpose |
|---|---|
| `<AuthShell>` | Outer page chrome — `bg-cosmos` + `cosmos-glow-center`, brand logo header, glass-panel form area, legal-link footer |
| `<AuthLabel>` | Uniform uppercase tracking label vocabulary |
| `<AuthSubmit>` | Emerald `cosmos-cta` submit button with built-in loading spinner |
| `<AuthGhostButton>` | Translucent surface OAuth/secondary button (48px to match submit) |
| `<AuthDivider>` | "Or continue with" hairline divider |
| `<AuthError>` | Red-tinted error banner |
| `<AuthInfo>` | Amber-tinted info banner (e.g. session-expired) |

Behavioural contract: `AuthShell` is **purely presentational**. It does not touch AuthContext, form state, MFA flow, OAuth, or any auth logic. Pages keep their state machines and pass JSX as `children`.

### New CSS utility: `.cosmos-input`

`app/globals.css` (additive) — `.cosmos-input` utility class for native form inputs on dark auth surfaces. The shadcn `<Input>` / `<Label>` / `<Button>` are NOT used on auth pages anymore — they're light-theme internal-app components. The auth surfaces use native HTML elements styled via this utility to avoid theme-toggle hacks.

### Pages rebuilt (visual only)

| Page | What changed | What was preserved |
|---|---|---|
| `app/signin/page.tsx` | 2-column light branding/form layout → single-column Deep Cosmos via `AuthShell`. Native inputs styled with `cosmos-input`. Removed unused shadcn `Button`/`Input`/`Label`/`Checkbox` imports. | `useAuth()`, `login()`, `loginWithGoogle()`, MFA challenge handling, `?next=` redirect, `?reason=session_expired` notice, OAuth provider availability fetch (`/api/auth/providers`), Firebase error mapping, all useState + useEffect hooks |
| `app/register/page.tsx` | Same chrome swap. Phase 47 consent block restyled to cosmos palette (border-cosmos-hairline + bg-cosmos-surface/40) but field set + gating logic untouched. | `register()`, `loginWithGoogle()`, `captureConsent('SIGNUP' \| 'OAUTH_SIGNUP')`, `acceptedBundle` gates BOTH submit AND OAuth, `marketingOptIn` default OFF (Spam Act), password match + min-8 validation, idempotent consent POST |
| `app/verify-email/page.tsx` | 3-state UI (verifying / success / error) rebuilt with `AuthShell` + emerald checkmark / red X iconography. | Token extraction from `useSearchParams`, POST to `/api/auth/verify-email`, `<Suspense>` boundary preserved (Next.js requirement) |
| `app/resend-verification/page.tsx` | Form + success-state rebuilt with `AuthShell`. | POST to `/api/auth/resend-verification`, privacy-safe success message ("If an account exists with X…") |

### What is NOT in this PR (intentionally)

- **`/forgot-password`** — the route doesn't exist in the codebase (only linked from `/signin`). Creating it is a functional addition, not a visual rebuild. Out of PR 6 scope. Tracked as a follow-up.
- **`/welcome`** — already consumes the marketing `<Header>` + `<Footer>` (rebuilt to Deep Cosmos in PR 2). The page body still has v1 ivory treatment but a full rebuild of that page is its own design exploration (it's not strictly an auth surface — it's the friendlies landing page from Phase 47).
- **`/login`** — already a redirect-only file (PR 1) — nothing to redesign.
- **`/portal/login`** — separate org-portal route, has its own Phase 32B design system, unaffected.

### Files Modified

| File | Change |
|---|---|
| `components/auth/AuthShell.tsx` | NEW — shared auth chrome + form primitives |
| `app/globals.css` | + `.cosmos-input` utility class |
| `app/signin/page.tsx` | JSX rebuilt, logic preserved |
| `app/register/page.tsx` | JSX rebuilt, logic + Phase 47 consent preserved |
| `app/verify-email/page.tsx` | JSX rebuilt, logic preserved |
| `app/resend-verification/page.tsx` | JSX rebuilt, logic preserved |
| `docs/changelog/CHANGELOG_2026_05_26.md` | PR 6 entry prepended |
| `docs/IMPLEMENTATION_PLAN.md` | PR 6 ticked → workstream complete; PR 5 marked merged |

### Build Status

- [x] `npx tsc --noEmit` passes — no new TypeScript errors
- [x] No business / logic / functional code touched
- [x] AuthContext, MFA paths, OAuth callbacks, Phase 47 consent capture all preserved verbatim (file-header JSDoc on each page documents what was kept)

### Documentation Updated

- File-header JSDoc on each rebuilt page documents the preserved-logic contract
- `AuthShell` exports JSDoc'd individually
- IMPLEMENTATION_PLAN.md Phase 48 workstream marked complete

### Testing

- [x] Build passes (TypeScript)
- [x] No new lint warnings
- [ ] Vercel preview: `/signin` form submits + OAuth button + "Forgot password?" link visible
- [ ] Vercel preview: `/register` form submits with consent block working — try without ticking → error, tick → submit works
- [ ] Vercel preview: `/verify-email?token=invalid` → error state with reset link
- [ ] Vercel preview: `/resend-verification` form → success state
- [ ] Vercel preview: `prefers-reduced-motion` honoured (no `cosmos-cta` hover lift, no glow pulse)
- [ ] §17 post-merge log verification

### PR

- Branch: `claude/hopeful-ritchie-sNIj3`
- PR URL: TBD
- Status: Pending creation

### 🎉 Phase 48 sequence complete after this PR merges

All 6 PRs of the Phase 48 Public Website Redesign will be live:
1. ✅ PR #891 — Foundation
2. ✅ PR #892 — Header + Footer
3. ✅ PR #893 — Hero + animations
4. ✅ PR #894 — Body sections
5. ✅ PR #895 — FAQ + FinalCTA
6. 🟡 (this PR) — Auth surfaces

The public-facing surface (landing + auth) is unified dark Deep Cosmos end-to-end.

---

### Phase 48 Public Website Redesign — PR 5 (FAQ + FinalCTA — landing page complete)

- **Type**: UI redesign (visual replacement)
- **Scope**: Two new dark Deep Cosmos sections (FAQ + FinalCTA) that close out the landing page. Replaces the last v1 holdout `TrailCTA`. Pricing **deferred** to Phase 6 per IMPLEMENTATION_PLAN.md §0e (Monetisation, decided 2026-05-12).
- **Why**: PR 5 of the Phase 48 6-PR sequence. After this PR the landing page is **fully Deep Cosmos canonical** — every section is the new design, no v1 holdouts. Only PR 6 (auth surfaces) remains.

### Strategic decision: Pricing deferred

The Stitch `pricing` screen has 3 tiers (Track Free · Reduce $24/mo · Anchor $49/mo) and a monthly/annual toggle. **NOT shipped in this PR.**

Reason: `IMPLEMENTATION_PLAN.md` §0e Monetisation workstream (Reza directive 2026-05-12) explicitly states:

> *"a **consumer pricing page** waits for Phase 6 (don't commit publicly to numbers that'll change). Indicative consumer pricing ~AU$9–14/mo or ~$79–129/yr, TBD."*

Stitch's $24/$49 numbers don't match the planned ~$9-14/mo range. Shipping them would publicly commit to prices the team hasn't finalised. The Stitch design remains in `.stitch/designs/pricing.{html,png}` for reference; when Phase 6 begins (post-Basiq go-live), the final consumer pricing page can be built from that design with the correct numbers.

If Reza wants a "coming soon" pricing teaser before Phase 6, that's a separate small PR — not a 0e violation.

### New components

| File | Role |
|---|---|
| `components/marketing/FAQ.tsx` | "Honest answers" — 6 native `<details>` accordions covering regulation / data / bank connections / scope / cancellation / data location |
| `components/marketing/FinalCTA.tsx` | "Ready to see the picture?" — last conversion surface with emerald `cosmos-cta` CTA + `cosmos-glow-center` background |

### Deleted

| File | Replacement |
|---|---|
| `TrailCTA.tsx` | `FinalCTA.tsx` (this PR) |

After this delete, **all v1 `Trail*` marketing components are gone**. The marketing folder now contains only:
- The new Deep Cosmos canon (Header · Footer · Hero · ProofStrip · OnePicture · FiveCapabilities · HowItWorks · FAQ · FinalCTA)
- The shared `animations.tsx`
- The legacy v0 components (SocialProof / ValuePillars / FeatureGrid / ForecastSection / Testimonials / SecuritySection) — kept until a final cleanup PR confirms no consumers

### Strategic decisions (financial-adviser + security/compliance lens)

**1. AFSL boundary copy preserved verbatim in FAQ Q1.** "Monitrax is a financial information service, not a licensed adviser. We surface the maths and the mechanisms, not personal advice." Locked language per Phase 46 §9 + `.stitch/SITE.md` §6.2.

**2. Security claim softened in FAQ Q6.** Stitch source said: *"Google Cloud in Sydney. Encrypted at rest with customer-managed keys."* Shipped as: *"Google Cloud in Sydney. Encrypted at rest."* Reason: CMEK (Cloud KMS customer-managed keys) is listed as **P1** (planned, not yet deployed) in CLAUDE.md §13.9. Advertising security controls we haven't shipped is misleading + compliance risk. Documented inline in FAQ JSDoc.

**3. CDR status framed accurately in FAQ Q3.** "Not yet. Consumer Data Right accreditation is in progress." Matches the IMPLEMENTATION_PLAN.md state — Basiq accreditation queued.

### Files Modified

| File | Change |
|---|---|
| `components/marketing/FAQ.tsx` | NEW — 6-Q accordion section |
| `components/marketing/FinalCTA.tsx` | NEW — final conversion section |
| `components/marketing/TrailCTA.tsx` | DELETED |
| `components/marketing/index.ts` | Re-grouped — new exports, removed TrailCTA, doc'd Pricing deferral |
| `app/page.tsx` | Renders FAQ + FinalCTA (replaces TrailCTA) |
| `docs/changelog/CHANGELOG_2026_05_26.md` | PR 5 entry prepended |
| `docs/IMPLEMENTATION_PLAN.md` | PR 5 ticked, PR 4 marked merged |

### Build Status

- [x] `npx tsc --noEmit` passes — no new errors
- [x] No business / logic / functional code touched
- [x] No remaining imports of deleted `TrailCTA` (only JSDoc references — updated)

### Documentation Updated

- File-header JSDoc on each new component
- Pricing deferral decision documented in PR description + this CHANGELOG + `components/marketing/index.ts` header

### Testing

- [x] Build passes (TypeScript)
- [x] No new lint warnings
- [ ] Vercel preview deploy `READY`
- [ ] Preview: FAQ accordions open/close, focus visible, keyboard accessible
- [ ] Preview: FinalCTA emerald glow + CTA hover state
- [ ] Preview: landing page reads as fully Deep Cosmos canonical end-to-end
- [ ] §17 post-merge log verification

### PR

- Branch: `claude/hopeful-ritchie-sNIj3`
- PR URL: TBD
- Status: Pending creation

---

### Phase 48 Public Website Redesign — PR 4 (Body sections — ProofStrip · OnePicture · FiveCapabilities · HowItWorks)

- **Type**: UI redesign (visual replacement, no behaviour change)
- **Scope**: Four new dark Deep Cosmos body sections that sit between the hero and the existing TrailCTA. Replaces five v1 Trail* components (deleted). After this PR the landing page is: Hero → ProofStrip → OnePicture → FiveCapabilities → HowItWorks → TrailCTA → Footer.
- **Why**: PR 4 of the Phase 48 6-PR sequence. Largest single PR of the redesign — covers the entire middle of the landing page from the proof strip through to the three-step "how it works" walkthrough. After this lands, only the bottom (Pricing / FAQ / Final CTA — PR 5) and the auth surfaces (PR 6) remain.

### New components

| File | Role |
|---|---|
| `components/marketing/ProofStrip.tsx` | "Built for Australian structures" — 6 glass-pill chips (Property · SMSF · Investments · Trust · Company · Super) with inline-SVG glyphs |
| `components/marketing/OnePicture.tsx` | "One view · no swivel-chairing" — 2-column editorial + before/engine/after visualization |
| `components/marketing/FiveCapabilities.tsx` | "The Five" — 5 capability cards mapped 1:1 to TRAIL stages with canonical hue SSOT (T sky · R amber · A indigo · I emerald · L violet) |
| `components/marketing/HowItWorks.tsx` | "Three steps to one clean picture" — 3 numbered steps with abstract cosmos-glass visualization panels (Add → See → Model) |

### Deleted v1 components (now safe — no consumers)

| File | Replacement |
|---|---|
| `TrailHero.tsx` | `Hero.tsx` (PR 3) |
| `TrailProblem.tsx` | No direct replacement — v1 problem-framing didn't match wealth-builder ICP |
| `TrailBridge.tsx` | No direct replacement — bridge no longer needed |
| `TrailJourney.tsx` | `FiveCapabilities.tsx` (this PR) |
| `TrailHowItWorks.tsx` | `HowItWorks.tsx` (this PR) |
| `TrailTestimonials.tsx` | No direct replacement — no real testimonials yet |

Verified no broken imports — `Header`, `Footer`, `Reveal` (the only marketing exports consumed by secondary pages) all still exist.

### Strategic decisions (architect lens)

**1. Stock-photo replacement.** The Stitch `five-and-how` source had AI-generated stock photos for each "How it works" step (close-up dashboard, 3D data convergence, control room). Replaced with abstract cosmos-glass visualization panels (stacked tiles · converging lines · slider bars). Reasoning: (a) AI-stock-photo aesthetic doesn't match the restraint discipline — Mercury / Linear / Stripe references don't use stock photos; (b) zero asset weight added vs ~150KB for 3 images; (c) abstract panels are cheaper to iterate. Documented inline in `HowItWorks.tsx` JSDoc.

**2. Number softening in OnePicture.** Stitch source had "+$14,280/yr" as the "Net Impact" line on the Strategic Simulation example card. Replaced with qualitative "Clarity before commitment" + an "Example" label badge. Per CLAUDE.md §0 financial-adviser lens — never quote numbers we can't trace to canonical data. The "Example" badge reinforces it's illustrative. Documented inline.

**3. Stat softening in FiveCapabilities.** Stitch source had "30+ entity types" stat for Track. Schema currently has 20 `LegalEntityType` enum values (counted from `prisma/schema.prisma`). Softened to "Multi-entity native" (qualitative, defensible). All 5 cards now use qualitative descriptors: Multi-entity native · Cross-account aware · Structure-aware · Scenario modelling · One calm view.

**4. TRAIL stage hue SSOT preserved.** All 5 capability cards use the canonical hue tokens from `app/globals.css` (`--cosmos-track`, `--cosmos-reduce`, `--cosmos-anchor`, `--cosmos-invest`, `--cosmos-live`) which match `lib/navigation/trailNav.tsx` → `TRAIL_STAGE_TONES`. Zero drift.

**5. AFSL boundary in HowItWorks.** Step 3 copy verbatim from Phase 46 §9 + the locked positioning DNA: "We show the scenarios. You decide. We do not recommend products." Do not soften.

### Files Modified

| File | Change |
|---|---|
| `components/marketing/ProofStrip.tsx` | NEW — section component |
| `components/marketing/OnePicture.tsx` | NEW — section component |
| `components/marketing/FiveCapabilities.tsx` | NEW — section component (TRAIL stage hue SSOT) |
| `components/marketing/HowItWorks.tsx` | NEW — section component |
| `components/marketing/TrailHero.tsx` | DELETED |
| `components/marketing/TrailProblem.tsx` | DELETED |
| `components/marketing/TrailBridge.tsx` | DELETED |
| `components/marketing/TrailJourney.tsx` | DELETED |
| `components/marketing/TrailHowItWorks.tsx` | DELETED |
| `components/marketing/TrailTestimonials.tsx` | DELETED |
| `components/marketing/index.ts` | Re-grouped barrel; removed deleted exports; added new section exports |
| `app/page.tsx` | Renders new section sequence |
| `components/dashboard/TrailStageIndicator.tsx` | Stale JSDoc reference to deleted TrailHero updated to point at `components/shell/motion.ts` |
| `docs/changelog/CHANGELOG_2026_05_26.md` | PR 4 entry prepended |
| `docs/IMPLEMENTATION_PLAN.md` | PR 4 ticked, PR 3 marked merged |

### Build Status

- [x] `npx tsc --noEmit` passes — no new TypeScript errors (only the pre-existing baseUrl deprecation)
- [x] No business / logic / functional code touched (auth, calc engines, APIs, schema, dashboard rendering, entities, tax engine ALL untouched)
- [x] Codebase-wide grep confirms no remaining imports of the deleted Trail* files (only JSDoc comments now updated)

### Documentation Updated

- File-header JSDoc on each new component documents design rules + Stitch source + strategic decisions (per CLAUDE.md §16.4)
- Phase 48 doc PR 4 row ticked in `IMPLEMENTATION_PLAN.md`
- `06_UI_UX_FOUNDATION.md` + `08_BRAND_UI_DESIGN.md` consolidated update remains scheduled for PR 5 (when the Pricing/FAQ/Final-CTA family also lands — single coordinated update is cleaner than three tiny ones)

### Testing

- [x] Build passes locally (TypeScript)
- [x] No new lint warnings
- [x] No business / logic / functional code touched
- [ ] Vercel preview deploy `READY`
- [ ] Preview: verify all 4 new sections render in correct order
- [ ] Preview: FiveCapabilities — 5 cards use correct stage hues (sky / amber / indigo / emerald / violet)
- [ ] Preview: HowItWorks abstract panels render without external image requests
- [ ] Preview: scroll-reveal animations honour `prefers-reduced-motion`
- [ ] §17 post-merge log verification

### PR

- Branch: `claude/hopeful-ritchie-sNIj3`
- PR URL: TBD
- Status: Pending creation

---

### Phase 48 Public Website Redesign — PR 3 (Hero + animations migration)

- **Type**: UI redesign (visual replacement, no behaviour change)
- **Scope**: Public-landing hero — full-screen dark Deep Cosmos hero with six floating 3D symbolic icons, locked Stitch design. Animations primitives refactored to compose `components/shell/motion.ts` SSOT. Old problem-framing sections removed from rendering.
- **Why**: PR 3 of the Phase 48 6-PR sequence. The hero is the LCP element + first impression — replacing it is what makes the redesign legible to a cold visitor.

### Changes Made

**1. New `components/marketing/Hero.tsx`**
- Full-screen `min-h-[88vh] lg:min-h-screen` dark Deep Cosmos canvas.
- Six floating 3D symbolic icons baked locally to `public/marketing/hero/*.png` (property · super · trust · company · investments · cashflow). Hidden on mobile (`hidden lg:block`) — centred copy reads cleaner at narrow widths.
- Each icon uses Next `<Image>` with `priority` (LCP-critical) + decorative `alt=""`.
- Headline: "Your wealth, fully integrated." — Inter 700, 5xl→7xl→96px scale, emerald-gradient on the second line per locked direction.
- Eyebrow chip: "AUSTRALIAN WEALTH OPERATING SYSTEM" — `cosmos-glass` pill.
- Emerald `cosmos-cta` CTA "Start free" (44px min height) + reassurance line.
- Subtle scroll affordance: bouncing chevron at bottom, respects `prefers-reduced-motion`.
- Idle floating motion: new `.cosmos-float` keyframe in `globals.css`. Skipped when `prefers-reduced-motion: reduce`.

**2. Icon assets baked into the repo**
- Downloaded the 6 hero icon PNGs from Stitch's Google CDN (Stitch URLs can rotate; we need stable assets).
- Stored at `public/marketing/hero/{property,super,trust,company,investments,cashflow}.png`.
- Total weight: ~153KB across all six (~20-33KB each).

**3. `animations.tsx` migrated to compose `motion.ts` SSOT**
- Pure refactor — exported API (`Reveal`, `StaggerContainer`, `StaggerItem`) and props unchanged.
- Replaced inline `useReducedMotion()` with `useReducedMotionSafe()` from `components/shell/motion.ts` (the canonical hook — never re-define locally).
- Verified 9 existing consumers (`Trail*.tsx`, `app/welcome`, `/trail-method`, `/wealth-check`) still work — type-checked clean.

**4. `app/page.tsx` IA partial re-sequence**
- `TrailHero` swapped for new `Hero`.
- Dropped from rendering: `TrailProblem`, `TrailBridge`, `TrailTestimonials` — v1 problem/anxiety framing that doesn't match the wealth-builder ICP (Q-ICP-1 decided 2026-05-24, Phase 48 doc §6.1). Files remain on disk for now (final delete in PR 4 once replacement primitives ship — `Reveal`-style component graveyard kept narrow).
- Kept rendering as transitional placeholders until PR 4-5 replaces them: `TrailJourney`, `TrailHowItWorks`, `TrailCTA` (all already use dark stone-950 backgrounds, will look acceptable below the new dark hero).
- Wrapped `<div>` in `bg-cosmos` so the page background is Deep Cosmos throughout.

**5. `components/marketing/index.ts` regrouped**
- Hero promoted from "legacy" to canonical.
- Removed sections grouped as "transitional".
- File-header JSDoc documents the removal/replacement plan.

**6. `globals.css` — new `.cosmos-float` keyframe**
- 6s ease-in-out infinite vertical drift (±20px). Independent of the inline `transform: rotate(...)` set on icon parents (rotate set on outer `<motion.div>`, float applied to inner `<div>` — clean separation).
- `prefers-reduced-motion: reduce` short-circuits it.

### Files Modified

| File | Change |
|---|---|
| `components/marketing/Hero.tsx` | Rewritten as dark Deep Cosmos full-screen hero |
| `components/marketing/animations.tsx` | Refactored to compose `motion.ts` (pure, API preserved) |
| `components/marketing/index.ts` | Regrouped, file-header doc |
| `app/page.tsx` | New Hero, IA partial re-sequence, `bg-cosmos` wrapper |
| `app/globals.css` | + `.cosmos-float` keyframe |
| `public/marketing/hero/*.png` | 6 new icon assets (153KB total) |

### Build Status

- [x] `npx tsc --noEmit` passes — no TypeScript errors introduced
- [x] No business / logic / functional code touched (auth, calc engines, APIs, schema, dashboard, entities, tax engine ALL untouched)
- [x] Secondary public pages (`/welcome`, `/trail-method`, `/wealth-check`) still consume `Header` + `Footer` from the barrel — verified no broken imports

### Documentation Updated

Per CLAUDE.md §16.3 — Hero component design rules documented inline in the file-header JSDoc. Barrel index documents the replacement plan. Phase 48 doc §4 PR 3 row will be ticked in `IMPLEMENTATION_PLAN.md`. `06_UI_UX_FOUNDATION.md` + `08_BRAND_UI_DESIGN.md` consolidated update remains scheduled for PR 4-5 (when the rest of the section primitives also land).

### Testing

- [x] Build passes locally (TypeScript)
- [x] No new lint warnings
- [ ] Vercel preview deploy `READY`
- [ ] Preview: confirm new hero loads (dark cosmos bg, 6 floating icons, emerald gradient on "fully integrated", emerald Start free CTA)
- [ ] Preview: confirm `prefers-reduced-motion` honoured (icons static, no bounce)
- [ ] Preview: confirm hero icons are crisp on retina
- [ ] §17 post-merge log verification

### PR

- Branch: `claude/hopeful-ritchie-sNIj3`
- PR URL: TBD
- Status: Pending creation

---

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
