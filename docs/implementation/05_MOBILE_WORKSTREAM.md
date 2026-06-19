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
- **Last touched:** 2026-06-19 (governance scaffolding).
- **Why this matters:** the mobile design-system + blueprint §13 visual sections predate the
  §18.7 glass vocabulary (authored 2026-06-01) and the Phase 45 glass migration — so the
  documented mobile look has drifted from the current web app. Realigning it (Stitch-first) is
  the design-phase goal before any RN build.

### Phase checklist
- [x] Governance scaffolding (this PR)
- [ ] Monitrax Mobile **DESIGN.md** — translate the §18.7.2 glass-on-ivory vocabulary into a native mobile design system
- [ ] Stand up the **Monitrax Mobile Stitch project + design system** (record project ID here)
- [ ] Daily Pulse home **spike** — generate against the design system, iterate to lock the look
- [ ] MVP screen set (4-variant matrix: mobile light/dark) — Daily Pulse · Triage · Scanner · Insights/Alerts · Transaction feed · Cashflow mini · Quick-add · Health detail · Biometric unlock · Notification prefs · home-screen widget
- [ ] **v3 design-doc** (`docs/mobile/design/01_DESIGN_SYSTEM.md`) + **blueprint §13** realignment to §18.7, referencing the locked Stitch artefacts
- [ ] RN conversion in `monitrax-mobile` (separate repo)

### Decision log
- **D1 — glass translation: PROCEEDING.** Translate the web glass-on-ivory vocabulary into native materials (warm ivory `#FAFAF7` / deep navy `#050913` ground, native blur/material cards, sky→indigo gradient money, per-entity sub-palettes) — NOT the doc's current flat slate-on-white `#FFFFFF`. SSOT-consistent; native craft (SF Pro, springs, haptics) retained.
- **D2 — TRAIL in the IA: PROCEEDING on hybrid** unless Reza redirects. Keep the task-oriented companion tabs (Home/Triage/Alerts/More); make Daily Pulse lead with the TRAIL stage; document the deviation from the web 5-tab TRAIL bar (CLAUDE.md §14).
- **D3 — home-screen widget:** *design* it now (strongest native-only differentiator + wealth-OS differentiation vs spending-tracker rivals); **build-sequence (MVP vs Tier 3) = Reza's call.**
- **D5 — sequencing:** design proceeds now; the *build* gates on **Basiq accredited + live** (integration is built, accreditation is the real gate) + the §15.1 P0 backend pre-reqs (API versioning, Cloud Armor, FCM).

### Open for Reza
- **D2** — confirm the hybrid IA (or request the 5-tab TRAIL bar).
- **D3** — widget in MVP vs Tier 3.
- **D4 — COMPLIANCE BLOCKER (notification content).** Some blueprint §9.2 push copy (e.g. "Your offset account could save $2,400/year") risks the CDR "no figures in push body" rule (§9.5) **and** the AFSL "information, not advice" boundary. Notification *content* is **held** for Reza compliance sign-off. Does NOT block the visual design work.

### Cross-references (not copies)
- Spec tree + index: `docs/mobile/00_INDEX.md`
- Master spec: `docs/mobile/blueprint/PHASE_15_MOBILE_COMPANION_APP.md`
- Design system (to be realigned): `docs/mobile/design/01_DESIGN_SYSTEM.md`
- Design law: `CLAUDE.md` §18 (Stitch-first) + §18.7 (glass vocabulary)
