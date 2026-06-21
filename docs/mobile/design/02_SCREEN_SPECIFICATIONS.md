# Monitrax Mobile — Screen Specifications

**Date:** 2026-06-21 | **Version:** 1.0 | **Status:** ACTIVE
**Owner:** Reza + Claude (design direction)
**Design system:** `docs/mobile/design/01_DESIGN_SYSTEM.md` (rich-glass v3 — realignment in progress) · CLAUDE.md §18.7.2
**Tracker:** `docs/implementation/05_MOBILE_WORKSTREAM.md` (0·MOB)

> Source of record for the RN/Expo build of the 5 locked screens (light + dark).
> Figures shown are placeholders; **all real values come from the single calc engine**
> (`lib/calculations/*`, `lib/services/masterFinancialService.ts`) — never hand-derived.
> Canonical mock figures: net worth **$1,284,200**, change **+$4,830 (0.4%)**.
>
> Interaction states are mandatory (design-system §5). Stitch mockups DEPICT them; the RN build
> IMPLEMENTS them. "Hover" = web/desktop only; on touch the equivalents are press / long-press / scrub.
> Artefact files live in `docs/mobile/design/stitch/{light,dark}/` (added in a Code follow-up).

---

## 1. Daily Pulse — Home (tab screen)
**Artefacts:** `stitch/light/daily-pulse.*` (screen `9cb9d480…`) · `stitch/dark/daily-pulse.*` (screen `b163f385…`)
**Layout:** header ("Good morning, Reza" + avatar + bell, slim TRAIL row, Invest active) -> **net-worth hero** (large sky->indigo gradient $, emerald change pill, luminous area chart, 1M·3M·1Y·ALL) -> **bento pair** (spending donut + category legend · cash-flow tile, Net +$3,210) -> **accounts strip** (entity gems + sparklines + change pills) -> **amber highlight** ("Electricity up 15% this quarter · $47 more · See details") -> **to-review row** (merchant logos) -> tab bar + Scan FAB.
**Interaction:** hero chart scrub -> tooltip; account cards tap -> detail, long-press -> peek; highlight tap -> detail (observation, no action).
**Compliance:** emerald growth-only; amber-not-red; spending donut is a neutral category legend (NO budget %); observation-only highlight.

## 2. Triage — Review (focused flow, no tab bar)
**Artefacts:** `stitch/light/triage.*` (screen `9262005b…`) · `stitch/dark/triage.*` (screen `dcca169d…`)
**Layout:** header (back · "Review" · Skip, "3 of 12" progress) -> **hero transaction card** (stacked): Woolworths logo + emerald ring · merchant + "Everyday · Up Bank · 27 May" · large sky->indigo gradient "$84.20" · emerald **category gem** "Groceries · 92%" + sparkle · observation "Your 3rd grocery shop this week" · meta "Debit card ··42 / Pending" · faint emerald(right)/amber(left) swipe washes -> swipe hint -> **action row** (amber Flag · emerald Accept w/ check · grey Change) -> queue dots.
**Interaction:** swipe right = accept (emerald), left = flag (amber); tap Change -> category picker; card press state.
**Compliance:** AI auto-categorisation is a suggestion the user confirms; emerald/amber semantics; observation micro-insight only.

## 3. Scanner — Scan a receipt (focused full-bleed modal, no tab bar; mode-agnostic light/dark)
**Artefacts:** `stitch/light/scanner.*` (screen `2ced2652…` / polished `fd2fdc85…`) · dark reuses the same (dark camera in both modes).
**Layout:** cinematic dark viewfinder (receipt on warm wood, vignette) -> top scrim with close/torch in circular containers -> four glowing sky->indigo **corner brackets** + scan-line -> emerald "Receipt detected" chip + sparkle -> floating "TOTAL $84.20" intelligence chip -> segmented Receipt·Document·Statement -> bottom: recents strip · large gradient **shutter** (ring + glow) · import -> helper "Hold steady — captured automatically".
**Interaction:** auto-capture on detection; tap shutter = manual; tap recents/import = picker; segmented control switches mode.
**Compliance:** in-app live-extract figure OK; no advice; communicates the auto-extraction method.

## 4. Insights (pushed screen, no tab bar)
**Artefacts:** `stitch/light/insights.*` (screen `3164a83c…`) · `stitch/dark/insights.*` (screen `14898be9…`)
**Layout:** header (back · "Insights" · filter, sub "What we noticed this month") -> filter chips (All·Spending·Bills·Net worth) -> **flagship** "Net worth is up $4,830 this month" (emerald gem, +0.4% pill, luminous area chart, month axis) -> **bento pair** (Electricity: amber gem + 4-quarter bar chart + "$47 more than last quarter" · Groceries: sky gem + donut "$820" + legend + "12 shops this month") -> **cash-flow** (rounded gradient bars, Net +$3,210) -> **subscriptions** (merchant logos, "3 renew this week · $47 total", "Next: Netflix · 14 Oct") -> footer "Monitrax surfaces observations, not financial advice."
**Interaction:** cards tap -> detail; charts scrub -> tooltip; filter chips switch the feed.
**Compliance:** strictly observation; net-worth growth emerald, increases amber; **no targets / "on track" / advice**; disclaimer footer required.

## 5. Accounts — My Wealth (tab screen)
**Artefacts:** `stitch/light/accounts.*` (screen `34d23df5…`) · `stitch/dark/accounts.*` (screen `2526df08…`)
**Layout:** header ("My Wealth" + privacy eye + sort) -> **net-worth hero** (gradient $1,284,200, +$4,830 pill, 1M·3M·1Y·ALL, scrubbable chart w/ tooltip) -> **allocation** stacked bar by entity + legend -> **Assets** ("$1,097,000": Home $840,000 amber · Super $214,500 sky · Investments $92,300 indigo · Cash $24,900 slate — gems, sparklines, change pills, chevrons) -> **Liabilities** ("$612,800": Mortgage, amber, "42% paid") -> tab bar (Accounts active) + Scan FAB.
**Interaction (depicted in mock):** hero chart scrubber + "May · $1,272,400" tooltip; Super tile in **pressed** state; Home tile **··· long-press** hint; every tile tap -> entity detail.
**Compliance:** "My Wealth" never "Portfolio"; liabilities amber never red; in-app figures OK; observation only.

---

## Copy / data fixes to apply (carried into the build + the Code follow-up)
- Net-worth figures standardise to **$1,284,200 / +$4,830** (fix Accounts-dark pill that read +$4,890; fix the Insights $412,840 instance).
- Daily Pulse dark highlight CTA: **"Review providers" -> "See details"**.
- Accounts liability label: **"Home Insurance Mortgage" -> "Mortgage"**.
- **Rental reconciliation:** allocation lists Rental but Assets has no Rental tile — add a Rental (teal) tile *or* drop Rental from allocation so the entity set is coherent. (Real list = engine.)

## Status of artefacts + design-system realignment
- Stitch artefacts (PNG + HTML, light + dark) are generated and live in chat outputs; they land under
  `docs/mobile/design/stitch/` in a **Code follow-up** (binary + large-HTML commits are unsafe via the chat connector).
- `01_DESIGN_SYSTEM.md` realignment to the rich-glass v3 vocabulary is a **Code follow-up** (large surgical edit
  preserving the still-valid motion/haptics/gesture/a11y/icon sections).
- Blueprint §13 realignment to reference this spec + the design system is a **Code follow-up**.
