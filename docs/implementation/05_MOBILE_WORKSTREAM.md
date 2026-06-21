# 05 — Mobile Workstream (`0·MOB`)

> Live tracker for the Monitrax mobile companion app. This spoke is the **you-are-here**;
> the fixed spec lives in the `docs/mobile/*` tree (master index: `docs/mobile/00_INDEX.md`).
> SSOT rule: this spoke owns mobile *status*; it cross-references the spec docs, never copies them.

## Scope boundary (read first)

- This spoke tracks the **main-repo half** of mobile: design docs + Stitch artefacts,
  the `/api/v1/mobile/*` backend (blueprint §7), and the `@monitrax/core` shared package (§11).
- The **React Native app** lives in a **separate `monitrax-mobile` repo** (blueprint §3.4).
  When that repo is stood up it gets its OWN STATE.md / CLAUDE.md / continuity-gate, cross-linked here.
- **Spec vs tracker (CLAUDE.md §15.6):** `docs/mobile/blueprint/PHASE_15_MOBILE_COMPANION_APP.md`
  and `docs/mobile/implementation/01_IMPLEMENTATION_PLAN.md` (the 7-sprint roadmap) are the
  fixed *build spec*. THIS spoke is the *live status*. They never both claim "the live plan".

## `0·MOB` — Mobile Companion App (Phase 15)

- **Status:** 🟡 Active — **design phase**.
- **Started:** 2026-06-19.
- **Owner:** Reza + Claude (chat = PM + Stitch design direction · Code = repo writes · future `monitrax-mobile` = RN build).
- **Last touched:** 2026-06-21 (locked light+dark design set — 7 screens).
- **Why this matters:** the mobile design-system + blueprint §13 visual sections predate the
  §18.7 glass vocabulary (authored 2026-06-01) and the Phase 45 glass migration — so the
  documented mobile look has drifted from the current web app. Realigning it (Stitch-first) is
  the design-phase goal before any RN build.

### Phase checklist
- [x] Governance scaffolding (#1163)
- [~] Monitrax Mobile **DESIGN.md** — rich-glass v3 vocabulary defined; `01_DESIGN_SYSTEM.md` surgical realignment pending a Code follow-up
- [x] Stand up the **Monitrax Mobile Stitch project + design system** — project `4167588157712714472`; canonical design-system asset `f73ad289d43a49f79bf3fc4f773996ab` ("My Wealth Glass")
- [x] Daily Pulse home **spike** — generated, iterated, **locked**
- [~] MVP screen set — **7 of the matrix locked light + dark: Daily Pulse · Triage · Scanner · Insights · Accounts (My Wealth) · Spending (transaction feed) · Cashflow mini.** Remaining: Quick-add · Health detail · Biometric unlock · Notification prefs · home-screen widget
- [~] **v3 design-doc** + **blueprint §13** realignment — screen specs authored (`docs/mobile/design/02_SCREEN_SPECIFICATIONS.md`, now covering all 7 locked screens); `01_DESIGN_SYSTEM.md` realignment + §13 pending Code
- [ ] RN conversion in `monitrax-mobile` (separate repo)

### Decision log
- **D1 — glass translation: PROCEEDING.** Translate the web glass-on-ivory vocabulary into native materials (warm ivory `#FAFAF7` / deep navy `#050913` ground, native blur/material cards, sky→indigo gradient money, per-entity sub-palettes) — NOT the doc's current flat slate-on-white `#FFFFFF`. SSOT-consistent; native craft (SF Pro, springs, haptics) retained.
- **D2 — TRAIL in the IA: PROCEEDING on hybrid** unless Reza redirects. Keep the task-oriented companion tabs; make Daily Pulse lead with the TRAIL stage; document the deviation from the web 5-tab TRAIL bar (CLAUDE.md §14). *Tab set realigned to Home/Spending/Accounts/More + Scan FAB.*
- **D3 — home-screen widget:** *design* it now; **build-sequence (MVP vs Tier 3) = Reza's call.**
- **D5 — sequencing:** design proceeds now; the *build* gates on **Basiq accredited + live** + the §15.1 P0 backend pre-reqs (API versioning, Cloud Armor, FCM).
- **D6 — design direction (LOCKED 2026-06-21):** rich / premium "Copilot-like" (big charts, generous tasteful colour, bento, real depth) over the rejected flat "Clean Wealth" pivot. Journey: glass → Clean (rejected) → rich.
- **D7 — quality loop (process, STANDING):** every Stitch generation is self-reviewed + scored vs benchmarks (Copilot Money, Apple Health/Wallet) + requirements, refined **up to 5 passes**, bar **>9/10**; only the best is presented; **approval = lock, no re-roll.**
- **D8 — interactivity (requirement, STANDING):** tiles + charts have defined interaction states (tap / long-press / scrub + pressed; hover = web only). Mocks depict; RN builds; captured in `02_SCREEN_SPECIFICATIONS.md`.
- **D-TYPE — font lock:** SF Pro (iOS) · Roboto (Android) · Inter (web + Stitch proxy).
- **Design-system SSOT:** canonical = `f73ad289d43a49f79bf3fc4f773996ab` ("My Wealth Glass"); `b61f869b24f84efb8317684e781b2a54` ("Clean Wealth") **deprecated**. Richness is prompt-driven — restate the full visual spec in every Stitch prompt.

### Screen lock status (light + dark)
| Screen | Light | Dark | Stitch screen IDs (light / dark) |
|---|---|---|---|
| Daily Pulse (Home) | ✅ locked | ✅ | `9cb9d480…` / `b163f385…` |
| Triage (Review) | ✅ locked | ✅ | `9262005b…` / `dcca169d…` |
| Scanner | ✅ locked | ✅ (reuse — mode-agnostic) | `2ced2652…` / `fd2fdc85…` |
| Insights | ✅ locked | ✅ | `3164a83c…` / `14898be9…` |
| Accounts (My Wealth) | ✅ locked | ✅ | `34d23df5…` / `2526df08…` |
| Spending (transaction feed) | ✅ locked | ✅ | `2cffe68c…` / `d917b81b…` |
| Cashflow mini | ✅ locked | ✅ | `c8e33271…` / `a21642d3…` |

### Open for Reza
- **D2** — confirm the hybrid IA (or request the 5-tab TRAIL bar).
- **D3** — widget in MVP vs Tier 3.
- **D4 — COMPLIANCE BLOCKER (notification content).** Some blueprint §9.2 push copy risks the CDR "no figures in push body" rule (§9.5) **and** the AFSL "information, not advice" boundary. Notification *content* is **held** for Reza compliance sign-off. Does NOT block the visual design work.

### Follow-ups (Code session)
- Commit Stitch artefacts (PNG + HTML, light + dark) under `docs/mobile/design/stitch/` — now **7 screens'** worth.
- Surgically realign `docs/mobile/design/01_DESIGN_SYSTEM.md` to rich-glass v3 (preserve valid motion/haptics/gesture/a11y/icon sections).
- Realign blueprint §13 to reference the v3 design system + locked artefacts.
- Apply the copy/data fixes in `02_SCREEN_SPECIFICATIONS.md` (incl. the Spending-dark donut-legend standardisation).

### Cross-references (not copies)
- Spec tree + index: `docs/mobile/00_INDEX.md`
- Master spec: `docs/mobile/blueprint/PHASE_15_MOBILE_COMPANION_APP.md`
- Design system: `docs/mobile/design/01_DESIGN_SYSTEM.md` · Screen specs: `docs/mobile/design/02_SCREEN_SPECIFICATIONS.md`
- Design law: `CLAUDE.md` §18 (Stitch-first) + §18.7 (glass vocabulary)
