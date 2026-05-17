# Changelog — 2026-05-17

## Session: Phase 12 Track E — Conversational onboarding (plan only, no code)

Branch: `claude/ai-agent-setup-wizard-NL4XV`

### Scope

- **Type:** Design / plan (doc-only — no code, no schema, no migration, no runtime change in this PR)
- **Scope:** Onboarding — design for a parallel AI-agent + voice conversational input modality alongside the existing form-based wizard. Existing form wizard is NOT touched.
- **CDR scope:** N/A in this PR — design only. Future Track E implementation will inherit existing CDR sanitisation (`lib/security/cdrAuditCompliance.ts`), the existing audit-write pattern, and the existing `OnboardingState` security envelope. No new vendor or new data egress in v1 (Web Speech API only — no audio leaves the browser).

### Trigger

Reza directive 2026-05-17 (voice): build a parallel conversational + voice input mode alongside the existing form-based onboarding wizard; the agent asks the user in plain English, the user replies by text or mic; the agent extracts the structured answer, types on the user's behalf, and asks for confirmation; never hallucinate / never generate numbers; do not change or delete the existing wizard.

### Architect-mode synthesis

Converged on **"two front doors, one house"**: chat-mode is a parallel input modality over Track B's existing data contract — same `OnboardingState`, same `ReviewStep`, same `/api/onboarding/bulk-create`. Form-mode is unchanged. The agent has ONE tool (`extractWizardStepDelta`) and ONE write boundary (the existing `ReviewStep`). Per-topic recap confirmation (not per-field — feels less robotic). Voice via the browser-native Web Speech API for v1 — no audio leaves the device, no new CDR vendor.

### Changes Made

#### 1. `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` (NEW — 12 sections)

Master plan doc for Track E. Twelve sections:

1. Why this exists (form abandonment, terminology friction, cognitive tax)
2. Hard rules (seven non-negotiable constraints: two-front-doors, no autonomous writes, no hallucinated numbers, per-topic confirmation cadence, Web Speech API only in v1, ReviewStep as the only write boundary, agent ≠ CFO)
3. What this is NOT (replacement / CFO / advice surface / new SSOT)
4. Phase breakdown E.0–E.6 (feature flag + toggle → gateway + extractor tool → conversational shell → per-topic recap cards → convergence on ReviewStep → audit + cost control → doc-sync)
5. Data contract (`WizardStateDelta` Zod schema + `OnboardingState.chatTranscript` server mirror + `source` tagging on bulk-create)
6. Voice I/O strategy (Web Speech API STT + optional Web Speech Synthesis TTS; text-only fallback; opt-in per turn)
7. Security, CDR, and AFSL boundary (full table of concerns and mitigations)
8. Risk register (10 items E-R1 to E-R10)
9. Open question for Reza (`Q-CONV-1` — STT v2 strategy, deferred)
10. Validation checklist (15 Track-E-specific items + parent doc's Track B items)
11. Files: stay / new / never-touched (canonical SSOT for which files Track E may touch)
12. Changelog

Sibling to existing `PHASE_12_SETUP_AND_ONBOARDING.md` (the form-wizard SSOT) — same pattern as the other Phase 12 docs (`PHASE_12_WIZARD_REDESIGN_PLAN.md`, `PHASE_12_ONBOARDING_TOUR.md`).

#### 2. `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md` (parent — Related line added)

Adds a "Related" pointer to the new sibling doc with a one-paragraph explanation of the relationship: form-mode (Track B) is unchanged; chat-mode (Track E) is a parallel front door over the same data contract; this parent doc remains the SSOT for the form surface + data contract; the new doc is the SSOT for the chat surface.

#### 3. `docs/IMPLEMENTATION_PLAN.md`

- Header `Last updated:` flipped to 2026-05-17 with a paragraph summarising the architect-mode synthesis + the "two front doors, one house" model + the doc-only nature of this PR.
- New row 53 in `📋 Up Next` — Track E queued, trigger = "After CLAUDE.md §16 doc-sync block lands + Reza green-light to start E.0".
- New open question `Q-CONV-1` (STT provider for v2 of the conversational onboarding agent) — Claude recommendation = stay on Web Speech API until v1 feedback shows quality is the blocker; not blocking v1.
- Open-questions summary line refreshed to include Q-CONV-1.

### Files Modified

- `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` — NEW (~700 lines)
- `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md` — Related line added (no other changes)
- `docs/IMPLEMENTATION_PLAN.md` — header updated, Up Next row added, Open Question added, summary refreshed
- `docs/changelog/CHANGELOG_2026_05_17.md` — NEW (this file)

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure (new failure mode / diagnostic / lesson)
- [x] strategic decision (new workstream queued, new Open Question opened)

Docs updated in this PR:
- `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` — NEW master plan for Track E
- `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md` — Related line added
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 53 + Open Question Q-CONV-1 + header
- `docs/changelog/CHANGELOG_2026_05_17.md` — this file

### Build Status

- N/A — doc-only PR, no code touched, no build implications.

### Validation

- [x] No code changes — verified by `git diff --stat` (docs/ only).
- [x] No schema changes — `prisma/schema.prisma` not touched.
- [x] No migration files added — `prisma/migrations/` not touched.
- [x] No CDR data flow changes — design only.
- [x] §12.11 destructive-write checklist — N/A by structural argument (no Prisma write in this PR).
- [x] §12.12 schema-deploy protocol — N/A (no schema change in this PR).
- [x] §16.5 doc-sync block — included in PR description (above).

### What's NOT in this PR

- No code. No schema. No migration. No runtime change.
- Existing `/onboarding` form wizard is byte-for-byte unchanged.
- Track E build (E.0–E.6) does not start until Reza explicitly green-lights.
- Q-CONV-1 (cloud STT for v2) deferred until v1 user feedback signals quality is the blocker.

### Why this matters (4-lens synthesis)

- **Architect lens:** Track E reuses Track B's data contract, write endpoint, and review surface. Zero new SSOT. The "two front doors, one house" pattern keeps CLAUDE.md §12.2 honest — no duplicate wizard, no duplicate bulk-create, no parallel calc engine.
- **Behavioural-psychologist lens:** form-based wizards punish users who don't know terminology or feel overwhelmed by field count (the two largest abandonment triggers in fintech onboarding). A conversational agent translates between user-language and system-fields without forcing the user to learn the vocabulary. Per-topic recap (not per-field) avoids the robot-reading-back-a-survey feel.
- **Financial-adviser lens:** strict no-hallucination rule + ReviewStep as the second checkpoint = no false-precision risk in the data the user starts with. The agent records what the user said; it never volunteers numbers.
- **Security / compliance lens:** Web Speech API only in v1 = no audio leaves the device, no new vendor, no new credential surface, no new CDR egress audit. AFSL boundary preserved structurally (no advice tool registered). Chat transcript persists in the same security envelope as the existing onboarding data and is deleted by the existing CDR data-lifecycle sweep.

### PR

- Branch: `claude/ai-agent-setup-wizard-NL4XV`
- PR: created (rev 2) — see PR URL in commit / release notes.

https://claude.ai/code/session_01LpdUbW5rvNZc67oJ1us4Wo

---

## Session: Phase 12 Track E — design pass (rev 2, plan only, no code)

Branch: `claude/ai-agent-setup-wizard-NL4XV` (same branch, follow-up commit)

### Scope

- **Type:** Design / plan refinement (doc-only — no code, no schema, no migration, no runtime change in this PR)
- **Scope:** Onboarding chat surface — fold the visual + motion design language into `PHASE_12_CONVERSATIONAL_ONBOARDING.md`. Architect-mode lensed pass.
- **CDR scope:** N/A in this PR — design only. The "presence, not persona" rule actively *strengthens* the AFSL-boundary posture (no character voice + no advice surface) without changing any code path.

### Trigger

Reza directive 2026-05-17 (voice, follow-up): *"make a very good animation, interactive, maybe engaging design… user sees the AI agent as sort of, like, a person… make your judgment."*

### Architect-mode synthesis (the decision)

**Presence, not persona.** Lift the chat surface with rich micro-motion + warmth + rhythm, but do NOT anthropomorphise (no avatar, no name, no character voice, no emojis).

| Lens | Why |
|---|---|
| Financial-adviser | Finance demands gravitas. Mercury / Stripe / Apple Cash / XPLAN all have zero mascots. A cartoon mascot undermines telling someone *"I'm adding $850k to your asset profile."* |
| Behavioural-psychologist | Anthropomorphism creates the **expert-friend confusion** — users transfer trust meant for licensed advice onto a "friend" character. AFSL boundary fuzz. Presence-without-persona keeps the role honest: the agent is a smart notebook taking notes, not a person making suggestions. |
| Architect | Persona = character logic (voice, copy, fallbacks, brand reviews) — surface area that bloats. Presence = bounded component-level work (motion primitives, micro-interactions). |
| Visual designer | The opportunity is "presence without persona" — Apple Intelligence iridescent orb, Siri waveform, Linear command palette. Premium *because* of restraint, not despite it. |
| Growth/marketing (dissent surfaced) | A persona is more meme-able. Real, but not load-bearing for the B2B-led wedge. Revisit only as a Phase 6 marketing-tone decision, never as a chat-avatar decision. |

### Changes Made

#### 1. `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` — rev 2

New §4a "Visual & motion design — 'presence, not persona'" with seven sub-sections:

- §4a (intro) — the load-bearing decision + four-lens rationale (compressed)
- §4a.1 — motion tokens (canonical SSOT, ~17 named tokens covering fade-in, thinking-pause, typewriter cadence, recap-card stagger + rise + CTA delay, orb breathe / listen-ripple / thinking-shimmer / settled-glow, first-encounter total, mistake-recovery dim opacity, `prefers-reduced-motion` mandate)
- §4a.2 — `PresenceOrb` primitive (canonical SVG; 4 states `idle / listening / thinking / settled`; warm-ivory base + iridescent rotating overlay; ~28px desktop / 24px mobile; `prefers-reduced-motion` → static 4px dot; file-header JSDoc per §16.4)
- §4a.3 — conversation rhythm (the three timing beats: pre-typewriter pause, typewriter cadence, recap-card assembly)
- §4a.4 — first-encounter sequence (~1.2s timeline, plays exactly once per user via `OnboardingState.firstChatEncounterAt`)
- §4a.5 — mistake-recovery transparency (previous recap dims to 0.5 opacity, stays visible — never silently overwritten)
- §4a.6 — NO-list (load-bearing dissent pinned: no avatar / no name / no character voice / no emojis / no 3-dot typing / no fake slowness / no sound-on-by-default / no Cleo-Schwabby-Erica-Replika tone)
- §4a.7 — reference benchmarks (Apple Intelligence + Siri + Linear + Mercury + Notion AI + Stripe — explicit anti-references too)
- §4a.8 — orb reusability (canonical AI-presence element for ALL future AI surfaces; e.g. `/dashboard/cfo` in a separate workstream)

§4 phase breakdown updated: E.2 split into **E.2a (static chat shell, validates the data loop)** + **E.2b (motion + presence orb, layered on once the loop works)**. Phase order is now E.0 → E.1 → E.2a → E.3 → E.4 → E.2b → E.5 → E.6. Reasoning documented inline: reduces risk of polishing something that doesn't function + the design lift is a substantial design-review surface better as its own PR with focused acceptance criteria.

§8 risk register: new row **E-R11 — Persona drift**. Reviewer-reject rule for any future PR that tries to add avatar/name/character-voice/emojis to the agent. Re-opening the persona question is a Phase 6 marketing-tone decision, never a chat-avatar decision.

§11.2 schema row updated: gains `OnboardingState.firstChatEncounterAt DateTime?` (pins the once-per-user first-encounter animation) + `UserPreference.chatNotificationSoundEnabled Boolean @default(false)` (off by default, persists optional notification-tone toggle).

§11.3 files-new table updated: phase column flipped from `E.2` to `E.2a` / `E.2b` per the split; three new rows added for `PresenceOrb.tsx`, `motionTokens.ts`, `audioTokens.ts` (all E.2b).

#### 2. `docs/IMPLEMENTATION_PLAN.md`

- Header `Last updated:` flipped to "2026-05-17 (session 2 — design pass)" with full architect-mode synthesis paragraph.
- Up Next row 53 refreshed — adds the "presence, not persona" design lens, the E-R11 risk pin, and the phase-order update (E.2a / E.2b split).

### Files Modified

- `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` — rev 2 (§4a inserted ~150 lines + §4 phase intro updated + E.2 split into E.2a/E.2b + E-R11 risk row added + §11.2/§11.3 updated + §12 changelog entry appended)
- `docs/IMPLEMENTATION_PLAN.md` — Last-updated header + Up Next row 53 refreshed
- `docs/changelog/CHANGELOG_2026_05_17.md` — this append

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR (cumulative — covers both session 1 and session 2 on this branch):

- [x] visual design system / component pattern (rev 2 introduces the visual-design SSOT for Track E — motion tokens, presence orb spec, conversation rhythm rules — but the canonical UI foundation docs `06_UI_UX_FOUNDATION.md` + `08_BRAND_UI_DESIGN.md` are deliberately NOT touched in this plan-only PR; they get the entries when the `PresenceOrb` primitive actually ships in E.2b, with the file-header JSDoc per §16.4 landing in the same PR as the component itself — this is the §16.4 + §16.3 sequencing for plan-vs-build that avoids documenting tokens that don't exist yet)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture (no change — but the "presence, not persona" rule *strengthens* AFSL-boundary posture without code change)
- [ ] operational procedure
- [x] strategic decision (Track E remains queued; design lens locked at rev 2; persona-drift pinned as E-R11 reviewer-reject rule)

Docs updated in this PR:
- `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` — rev 1 + rev 2 (full master plan + design pass)
- `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md` — Related line pointing to the new sibling (rev 1)
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 53 + Open Question Q-CONV-1 (rev 1) + Last-updated header + Up Next row 53 refreshed for design pass (rev 2)
- `docs/changelog/CHANGELOG_2026_05_17.md` — this file (both sessions)

### Build Status

- N/A — doc-only PR, no code touched, no build implications.

### Validation

- [x] No code changes — verified by `git diff main --stat` (docs/ only).
- [x] No schema changes — `prisma/schema.prisma` not touched.
- [x] No migration files added — `prisma/migrations/` not touched.
- [x] No CDR data flow changes — design only.
- [x] §12.11 destructive-write checklist — N/A by structural argument (no Prisma write in this PR).
- [x] §12.12 schema-deploy protocol — N/A (no schema change in this PR; planned additions documented for future E.0/E.2b PRs).
- [x] §16.5 doc-sync block — included in this PR description.

### What's NOT in this PR

- No code. No schema. No migration. No runtime change.
- Existing `/onboarding` form wizard is byte-for-byte unchanged.
- `06_UI_UX_FOUNDATION.md` + `08_BRAND_UI_DESIGN.md` deliberately NOT updated — those get the `PresenceOrb` + motion-tokens entries when the component actually ships in E.2b (avoids documenting tokens that don't exist yet).
- Track E build (E.0 → E.6) does not start until Reza explicitly green-lights.

### Why this matters (4-lens synthesis)

- **Architect lens:** the E.2 split (static shell + motion layer as two separate phases) prevents the failure mode of polishing something that doesn't function. The motion tokens being a separate SSOT module means future AI surfaces inherit the same design language by importing the tokens.
- **Behavioural-psychologist lens:** the "expert-friend confusion" risk is *the* trust failure mode for AI-in-finance. The presence-not-persona decision is the structural mitigation; the E-R11 reviewer-reject pin is the durability mechanism (so a future session can't quietly add a name + face).
- **Financial-adviser lens:** finance demands gravitas. Premium *because* of restraint. The reference set (Mercury / Stripe / Apple Cash / XPLAN) makes "no mascot" the table-stakes, not the controversial choice.
- **Security / compliance lens:** AFSL boundary is preserved structurally (no character voice + the agent's tool registry has only the one extractive tool). Persona drift would be a real AFSL fuzz risk — pinning E-R11 means the rule survives future sessions.
