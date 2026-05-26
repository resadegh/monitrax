# Phase 48.7.1 — Public Secondary Pages Stitch-Designed Rebuild

> **Status:** 📋 QUEUED — Stitch designs deferred from 2026-05-26 session (3 generations timed out client-side without surfacing screens in the project).
> **Trigger:** Phase 48.7 (2026-05-26) shipped `/trail-method`, `/wealth-check`, `/trail-check` as sed-based token migrations — pages match the cosmos palette but retain v1 structural composition. Reza directive 2026-05-26: ship the proper Stitch-designed rebuilds + codify Stitch-first as a permanent rule (now CLAUDE.md §18).
> **Created:** 2026-05-26
> **Owner:** Reza (direction) + Claude (build)

---

## §1 — Purpose

Replace the v1 structural composition on three secondary public pages with proper Stitch-designed Deep Cosmos layouts that match the design vocabulary of the Phase 48 landing + auth surfaces (glass cards, hero patterns, motion choreography), not just the color palette.

## §2 — Why this exists as its own phase

Per CLAUDE.md §18 (added 2026-05-26): all non-trivial UI/UX changes must begin in Stitch. Phase 48.7 was a token migration (acceptable under §18.2 as a "token swap"), not a redesign. The proper Stitch-designed rebuild is this phase.

## §3 — Scope (3 pages, 1 PR per page)

| Page | Current state | Target state |
|---|---|---|
| `/trail-method` | v1 long-form text + alternating section bands | Editorial Stitch design with glass cards, 5-stage horizontal node visualization, citation cards |
| `/wealth-check` | v1 centered-card with stacked sliders + result panel | Single-page funnel — hero + inline-form + result reveal + 3 lever cards (Phase 46 make-or-break, design quality matters) |
| `/trail-check` | v1 quiz stepper with progress dots | Stage-quiz with cosmos-glass per-question card + result-reveal with hero-scale stage letter |

## §4 — Stitch prompts (ready to fire)

The 3 prompts below were drafted in the 2026-05-26 session and are ready to use. Fire each via `mcp__stitch__generate_screen_from_text` against the canonical project `1859462351962811110`. Each prompt is self-contained and encodes the v4 locked direction.

### §4.1 trail-method prompt

```
Design a long-form editorial public-website page for Monitrax (Australian
wealth operating system) explaining "The TRAIL Method" framework.

CRITICAL: dark Deep Cosmos theme — background #0A0A14 (never pure black) —
MATCHING the existing canonical Hero screen 42730aaf80ed4fcf822278e642d476a9
in this same project. Inter typography only, max weight 600. Emerald #16A34A
is the ONLY brand action color. TRAIL stage canonical hues (do not drift):
T sky #0EA5E9 · R amber #F59E0B · A indigo #6366F1 · I emerald #16A34A · L
violet #8B5CF6.

Structure (8 sections, vertically stacked, generous whitespace):

1. Hero — eyebrow "THE TRAIL METHOD" (uppercase 0.18em tracking, cosmos-
   action emerald), display headline "Your path from financial stress to
   financial freedom." (Inter 600, ~64px desktop, emerald gradient on the
   SECOND line "to financial freedom"), italic subtitle "A guide for
   households outgrowing budget apps." Centered, subtle radial emerald
   glow behind, NO sub-CTA (hero is purely declarative).

2. Problem — asymmetric 2-column. Left (60% width): large pull-quote in
   semibold "You're not bad with money. You just don't have a path."
   (italic emerald accent on key phrase). Right (40%): 3 vertical glass-
   cards stacked, each showing a statistic in large emerald number +
   caption: "72% feel stressed about money" / "−13 IQ points under
   financial worry (Mani et al., Science 2013)" / "1 in 3 Australians use
   spreadsheets to manage wealth".

3. Origin — "Where TRAIL comes from". Centered eyebrow + headline. 3
   glass-card row: Barefoot Investor / Dave Ramsey Baby Steps / Behavioural
   Economics. Each card has small icon, source name, one-sentence summary
   of how TRAIL stands on its shoulders.

4. The Five — full-width hero band. Headline "Five capabilities. The order
   that compounds." Below: horizontal connected-node visualization — 5
   large circles connected by hairline emerald gradient, each circle is a
   TRAIL stage letter (T R A I L) in its canonical hue. Below each circle:
   stage name + one-line tagline. This is the centrepiece visual.

5. Deep dives — 5 alternating sections, one per TRAIL stage. Pattern:
   left-text/right-glass-card → flip → flip → flip → flip. Each section:
   stage letter at large scale (in stage hue), stage name, italic
   milestone quote, 3-sentence prose, key milestone in semibold. The glass
   card on each contains a representative metric or quote from real
   research (e.g. for Reduce: "$340/month in forgotten subscriptions,
   average Australian household").

6. Why TRAIL works — "The science". 2×2 grid of citation glass-cards.
   Bandura self-efficacy / Prochaska stage-matched intervention / Thaler
   "Save More Tomorrow" / Mani et al. cognitive tax of poverty. Each card
   has author + year + one-sentence finding + how TRAIL uses it.

7. The Monitrax difference — 3 glass-card row: "Always on" / "Personalised
   to your numbers" / "Stage-aware guidance". Each card emerald accent +
   brief copy.

8. Final CTA — emerald cosmos-cta button "Take the free TRAIL Check →"
   centered, reassurance line below "Sixty seconds. Five questions. Your
   personalised path."

Design philosophy: restraint > richness (Mercury / Stripe / Linear
references). Editorial pull-quotes elevate the writing. Wealth-builder ICP
framing (avoid generic budget-app language). Glass-card vocabulary:
backdrop-blur, cosmos-hairline border, inset top-edge highlight. Motion is
implicit, not loud.
```

### §4.2 wealth-check prompt

```
Design a dramatic single-page conversion funnel for Monitrax (Australian
wealth operating system) — the "Wealth Check" tool.

CRITICAL: dark Deep Cosmos theme — background #0A0A14 — MATCHING the
canonical Hero screen 42730aaf80ed4fcf822278e642d476a9 in this same
project. Inter typography only, max weight 600. Emerald #16A34A is the
ONLY brand action color. This is Phase 46 — the make-or-break funnel.
Design quality matters.

Structure (vertically stacked, single page):

1. Hero — eyebrow "WEALTH CHECK" (uppercase 0.18em tracking, cosmos-action
   emerald), display headline "Are you on track?" (Inter 600, ~64px
   desktop, white), subtitle "Three questions. Thirty seconds. A specific
   answer in dollars — not a grade." Centered, subtle radial emerald glow
   behind.

2. Form — large glass-panel (cosmos-glass, rounded-2xl, generous padding
   ~48px). 3 stacked questions:
   a) "Your age" — horizontal slider (range 25–65), current value
      (e.g. 38) shown LARGE in cosmos-action emerald on the right side,
      tabular-nums. Slider track is cosmos-hairline, fill + handle
      cosmos-action.
   b) "Household income (annual, before tax)" — horizontal slider $40k–
      $400k+, current value LARGE in emerald right side. Format $XXXk.
   c) "Total net worth (everything you own, minus what you owe)" — heading
      + small explainer "Pick the band that fits. We use the midpoint — no
      need to be exact." Below: 6 horizontal glass-card chips in a 3×2
      grid (or single row on wide). Each chip shows the band + a one-word
      qualifier: "Under $50k — Just getting started" / "$50k–$200k —
      Building momentum" / "$200k–$500k — Foundations in place" / "$500k–
      $1m — Compound stage" / "$1m–$2m — Established" / "$2m+ — Wealth-
      builder". Selected chip gets emerald border + emerald/10 background
      + emerald subtle ring.

3. Primary CTA: emerald cosmos-cta button "See where you stand" full-width
   inside the panel, ~56px height. Below it: small italic "We don't store
   your answers. Just the computation."

4. Result reveal (shown after compute, slides in with subtle motion):
   Centered above the form OR replacing it. Eyebrow "YOUR PROJECTION".
   Large emerald gradient number e.g. "$1.4m" representing projected
   retirement balance at 67. Below: one-line qualifier "You're projected
   to land in the top 32% of households at your stage." NO false precision
   — this is illustrative.

5. Three lever cards below result (in a 3-column glass row, cosmos-glass):
   each card uses one TRAIL stage hue:
   - REDUCE (amber): "Increase super contribution by 2%" + "Projected
     impact: meaningful over 25y" + tiny "Learn more →" link
   - ANCHOR (indigo): "Pay down non-deductible debt first" + qualitative
     impact + link
   - INVEST (emerald): "Open a regular investment account" + qualitative
     impact + link

6. Final CTA — separated section below: "Want the full picture?" headline
   + cosmos-cta "Start free →" button + small "No credit card. No bank
   connection required." reassurance.

Design philosophy: clear hierarchy (input → compute → result → next step),
zero manipulation copy, no scarcity hooks, premium fintech feel
(Mercury / Linear). Wealth-builder ICP — language addresses households
outgrowing budget apps, not beginners. Result line must use QUALITATIVE
comparisons (percentile bands, qualifier phrases) not hard $/yr promises —
per AFSL-line we can't quote calc numbers we can't trace.
```

### §4.3 trail-check prompt

```
Design a 5-question quiz interface for Monitrax (Australian wealth
operating system) — the "TRAIL Check" tool that identifies the user's
TRAIL stage.

CRITICAL: dark Deep Cosmos theme — background #0A0A14 — MATCHING the
canonical Hero screen 42730aaf80ed4fcf822278e642d476a9 in this same
project. Inter typography only, max weight 600. Emerald #16A34A is the
ONLY brand action color. TRAIL stage canonical hues: T sky · R amber · A
indigo · I emerald · L violet.

Render TWO compositions on the same screen, one above the other (so we
can iterate both states):

— STATE 1 (quiz in progress) — TOP HALF of canvas:

1. Hero — eyebrow "TRAIL CHECK" (uppercase 0.18em tracking, cosmos-action
   emerald), display headline "What stage are you on?" (Inter 600 ~48px),
   subtitle "Sixty seconds. Five questions. One personalised path."
   Centered.

2. Progress dots — horizontal row of 5 dots immediately under hero, each
   in canonical TRAIL hue (sky, amber, indigo, emerald, violet). Active
   dot is FILLED in its hue with a subtle glow; inactive dots are 1.5px
   outlined hairline. Connected by hairline cosmos-action gradient between
   them. Show question 3-of-5 active (i.e. first 3 dots filled, last 2
   outlined).

3. Question card — large cosmos-glass rounded-2xl card, generous padding.
   Top: small "Question 3 of 5" label in cosmos-muted. Below: large
   question prose Inter 600 ~32px "How is your debt situation?" — left-
   aligned. Below the question: 4 vertically stacked answer chips. Each
   chip: full-width cosmos-glass row with rounded-xl border, left padding
   contains a custom radio circle, right contains the answer text. Hover
   state implies hover, one selected (Answer 3) shows emerald border +
   emerald/10 fill. Answers:
   • "Debt-free, never carried any"
   • "Small debts but on top of it"
   • "Some debt, working to pay it down"
   • "Multiple debts, feels unmanageable"

4. Bottom of card: row with "Back" ghost button (left) and emerald
   cosmos-cta "Continue →" (right). Below the card: small italic "Your
   answers stay on your device. No account required."

— STATE 2 (result reveal) — BOTTOM HALF of canvas (visually separated by
section break):

1. Eyebrow "YOUR STAGE" (cosmos-muted)

2. The stage letter at hero scale ~200px tall in canonical hue with subtle
   glow — for this demo show A (Anchor) — in indigo #6366F1.

3. Stage name large headline below "You're on the ANCHOR stage."
   (Inter 600, white).

4. Italic subtitle "You're past survival mode. Time to build the safety
   net that keeps you stable."

5. Two cosmos-glass cards side-by-side:
   - LEFT: "What this means" — 3 short bullet points
   - RIGHT: "Your next 3 moves" — 3 actionable items, each prefixed by a
     small numbered glyph + emerald accent

6. Final CTA centered: emerald cosmos-cta "Start your trail with Monitrax
   →" + "Personalised guidance, all 5 stages, free to start." reassurance
   below

Design philosophy: restraint > richness (Mercury / Apple / Stripe
references). Sophisticated quiz UI — premium feel, not gamified. Wealth-
builder ICP framing — questions/answers speak to households outgrowing
budget apps, not beginners. Stage-color SSOT is non-negotiable.
```

## §5 — Logic preservation (CRITICAL)

For each page, the existing form state machines + calc functions + framer-motion logic MUST be preserved verbatim during React conversion. Only the JSX shell + Tailwind classes change. Pages with significant state:

- **`/wealth-check`** — age slider state, income slider state, net-worth band selection, computation function → result reveal with motion. Defined in `app/wealth-check/page.tsx`. DO NOT touch the calc.
- **`/trail-check`** — 5-question stepper, answer tracking, stage computation, result reveal. Defined in `app/trail-check/page.tsx`. DO NOT touch the stage-identification logic.
- **`/trail-method`** — mostly stateless content page; the only logic is the `Reveal` scroll-animation wrapper.

## §6 — The 3-PR sequence

Each page is its own PR — cleaner blast radius than a single mega-PR.

| # | PR | Trigger |
|---|---|---|
| **PR a** | `/trail-method` Stitch-designed rebuild | Stitch design approved by Reza |
| **PR b** | `/wealth-check` Stitch-designed rebuild | Stitch design approved by Reza |
| **PR c** | `/trail-check` Stitch-designed rebuild | Stitch design approved by Reza |

For each PR:
1. Generate Stitch screen via `mcp__stitch__generate_screen_from_text`
2. Show preview PNG to Reza, iterate via `mcp__stitch__edit_screens` if needed
3. Download HTML + PNG to `.stitch/designs/<page>.{html,png}` via `bash scripts/fetch-stitch.sh`
4. Convert to React via `react-components` skill — JSX rewrite only, all logic preserved
5. Document the Stitch screen ID in the file-header JSDoc
6. Update `.stitch/SITE.md` §4 Sitemap row to mark the page complete
7. Ship via the existing CLAUDE.md §16 + §17 protocols

## §7 — Open question (for next session)

The 2026-05-26 session fired 3 `mcp__stitch__generate_screen_from_text` calls; all timed out client-side at 60s and no new screens surfaced in the project list. Possible causes:

1. Stitch backend congestion (likely — multiple generations queued in a hot session)
2. API endpoint partially down
3. Project-level rate limit

**Next-session diagnostic step:** fire ONE generation first (just `/trail-method` from §4.1). If it surfaces within 5 min, the issue was congestion + we can fire the other two. If it doesn't, file a Stitch support issue or pivot to using `mcp__stitch__edit_screens` against an existing landing screen as a template.

## §8 — Acceptance

- [ ] 3 new Stitch screens approved by Reza
- [ ] HTML + PNG downloaded to `.stitch/designs/`
- [ ] 3 React conversions shipped + merged + production-verified
- [ ] No business logic touched (form state machines preserved)
- [ ] File-header JSDoc on each page documents the Stitch screen ID
- [ ] `.stitch/SITE.md` §4 Sitemap rows for all 3 pages flipped to ✅

---

*Drafted 2026-05-26. Picks up where the 2026-05-26 session left off after CLAUDE.md §18 + Phase 48.7 shipped.*
