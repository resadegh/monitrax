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

---

## Session: Phase 12 Track E — build PR (E.0 + E.1 + E.2a-Household + E.3 + E.4 + E.5, functional vertical slice)

Branch: `claude/ai-agent-setup-wizard-NL4XV` (continuation — PR #770 merged into main, branch fast-forwarded, new commits land in PR #2).

### Scope

- **Type:** Feature build — first functional code for the Conversational Onboarding track.
- **Scope:** Onboarding `/onboarding?mode=chat` — Household topic only, end-to-end, behind the `CONVERSATIONAL_ONBOARDING` feature flag (default OFF).
- **CDR scope:** No CDR data flows. Chat extracts household composition (members, pets, cars) — non-CDR data. Audit metadata is field-name-only via `sanitizeCdrMetadata()`. Anthropic provider receives only the user's free-text reply + agent's prior turn (4-turn window) + scripted system prompt — no balances, no account data, no CDR-derived state.

### Trigger

Reza directives 2026-05-17 (build session):
1. *"770 is merged let's go and start"*
2. *"Note we still don't have live users so you can go full steam"* — adjusted scope from "feature-flag-only first PR" → "functional Household vertical slice end-to-end behind the flag" in a single PR.

### Changes Made

#### 1. Feature-flag infrastructure (E.0)

- `lib/featureFlags/conversationalOnboardingGate.ts` (NEW) — server reader `isConversationalOnboardingEnabled()` with 30s in-process cache + `invalidateConversationalOnboardingGateCache()` hook, mirroring `basiqGate.ts` byte-for-byte structurally.
- `lib/featureFlags/ConversationalOnboardingGateContext.tsx` (NEW) — client provider + `useConversationalOnboardingEnabled()` hook, mirrors `BasiqGateContext.tsx`.
- `app/api/feature-flags/conversational-onboarding/route.ts` (NEW) — public unauthenticated `GET` returning `{ enabled: boolean }`, fails closed.
- `prisma/seed-feature-flags.ts` (EDIT) — adds `CONVERSATIONAL_ONBOARDING` row, default `enabled: false`. Idempotent upsert — re-seed doesn't clobber operator-flipped state.
- `app/api/admin/feature-flags/[key]/route.ts` (EDIT) — extends the cache-invalidation block to call `invalidateConversationalOnboardingGateCache()` on the new flag.
- `app/onboarding/layout.tsx` (EDIT) — wraps children with `<ConversationalOnboardingGateProvider>` (nested inside the existing `<BasiqGateProvider>`).

#### 2. Anthropic gateway (E.1)

- `lib/ai/onboarding-agent/schemas/wizardStateDelta.ts` (NEW) — canonical Zod schema for the LLM's tool output. v1 household-only discriminated union; hand-crafted JSON Schema mirror for Anthropic's `input_schema`. Numeric fields strictly typed (`integer`, `number`), enums constrained to canonical AU values.
- `lib/ai/onboarding-agent/tools/extractWizardStepDelta.ts` (NEW) — tool spec + system prompt. System prompt enforces hard rules: (a) tool-call output only, never plain text; (b) numbers come from the user, never the model; (c) AU vocabulary mapping ("partner" → PARTNER, "kids" → CHILD, etc.); (d) no advice / no opinions / no commentary; (e) unresolved field names land in `unresolved` rather than guessed.
- `lib/ai/onboarding-agent/gateway.ts` (NEW) — `extractWizardStepDelta()` function. Calls `client.messages.create({ tools, tool_choice: { type: 'tool', name: '...' } })` to force a tool call, validates the LLM input against the Zod schema, returns `{ ok, delta, model, tokensIn, tokensOut }` or `{ ok: false, reason }`. Uses Haiku 4.5 (cheap conversational triage). Provider-error / schema-violation paths are first-class return values, not exceptions. `isOnboardingAgentAvailable()` exported for client-side gating.

#### 3. Chat API endpoints (E.5 audit + E.1 server)

- `app/api/onboarding/chat/extract/route.ts` (NEW) — `withPermission('settings.write')`. Validates body (topic, message ≤1000 chars, transcript ≤4 turns). Enforces daily cap (200 extractions / user / day via audit-log count over 24h window). Calls gateway, writes `ONBOARDING_AGENT_EXTRACTION` audit row on every call (SUCCESS or FAILURE — sanitised metadata: `topic`, `deltaFieldNames`, `reason` if failure, token counts). Returns standard `{ success, data, error, meta }` envelope.
- `app/api/onboarding/chat/topic-confirmed/route.ts` (NEW) — fires when user taps "Looks right" on the recap card. Writes a single `ONBOARDING_AGENT_TOPIC_CONFIRMED` audit row with sanitised field-name list. No DB writes beyond the audit log — staged WizardData persists via the existing `saveDraft()` path.

#### 4. Chat UI components (E.2a + E.3)

- `components/onboarding/ConversationalModeToggle.tsx` (NEW) — renders inline at top of `/onboarding` ONLY when flag is ON. Two pills — "Fill in a form" / "Chat with Monitrax". Routes to `/onboarding` or `/onboarding?mode=chat`.
- `components/onboarding/wizard-chat/types.ts` (NEW) — local `ChatMessage` type.
- `components/onboarding/wizard-chat/householdScript.ts` (NEW) — state machine + scripted agent copy. Three asks (members, pets, cars) with retry-once-then-advance loop-break protection. Pure (no React, no fetch). Exports `advanceScript()` + `bootstrapHouseholdConversation()` + recap formatters.
- `components/onboarding/wizard-chat/AgentMessage.tsx` + `UserMessage.tsx` (NEW) — bubble components. Static in E.2a (no presence orb / typewriter — those land in E.2b).
- `components/onboarding/wizard-chat/ChatThread.tsx` (NEW) — message stream + auto-scroll-to-bottom + thinking-indicator (three pulsing dots; `prefers-reduced-motion` collapses).
- `components/onboarding/wizard-chat/ChatComposer.tsx` (NEW) — textarea + send button + opt-in mic button (hidden when Web Speech API unsupported).
- `components/onboarding/wizard-chat/TopicRecapCard.tsx` (NEW) — recap card with "Looks right" / "Change something" actions. Dim-but-keep state ready for E.2b animation.
- `components/onboarding/wizard-chat/ConversationalSetup.tsx` (NEW) — top-level orchestrator. Owns chat thread + script state + staged HouseholdFields. On "Looks right", merges chat-staged into existing `UserPreference.onboardingDraft` WizardData via `saveDraft()`, fires `ONBOARDING_AGENT_TOPIC_CONFIRMED` audit, redirects to `/onboarding` (form mode) at `currentStep=1` (Household — pre-filled).

#### 5. Voice hook (E.2a — partial)

- `hooks/useVoiceInput.ts` (NEW) — Web Speech API wrapper. `SpeechRecognition` / `webkitSpeechRecognition` (browser-native). Interim transcripts stream to the input field; final transcript fires `onFinal(text)`. Text-only fallback when API unsupported (Safari iOS). Mic permission requested only when user taps the mic — never on page load. Audio never leaves the device (CLAUDE.md §13.6 environment separation — no new CDR vendor surface).

#### 6. Mode routing (E.4)

- `app/onboarding/page.tsx` (EDIT) — reads `?mode=chat` query param. When flag is ON + `mode=chat`, renders `<ConversationalSetup />`; otherwise renders `<WizardContainer />` (form mode — unchanged behaviour). `<ConversationalModeToggle />` rendered above whichever mode is active.

#### 7. Schema migration (E.5)

- `prisma/schema.prisma` (EDIT) — 3 additive `AuditAction` enum values (`ONBOARDING_AGENT_EXTRACTION`, `ONBOARDING_AGENT_TOPIC_CONFIRMED`, `ONBOARDING_AGENT_MODE_SWITCHED`). The third (`MODE_SWITCHED`) is added to the schema in this PR but not yet fired by a call site — it's queued for a follow-up PR when the form↔chat toggle hand-off needs auditing.
- `prisma/migrations/20260517100000_phase_12_track_e_audit_actions/migration.sql` (NEW) — `ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS '...'` × 3. Idempotent. §12.11 N/A (additive, no destructive ops). §12.12 compliant (schema change + migration ship in the same PR).

#### 8. Doc-sync

- `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` (EDIT) — Status flipped 📋 → 🟡 IN FLIGHT. Architectural correction in §5.2 + §8 (E-R10 row) + §11.2: rev-1 plan named non-existent `OnboardingState` Prisma model as the chat persistence target. v1 corrects to keep transcript client-only + persist staged WizardData via `UserPreference.onboardingDraft`. Changelog entry appended (rev 3).
- `docs/IMPLEMENTATION_PLAN.md` (EDIT) — Last-updated header refreshed with session-3 build summary. Up Next row 53 amended with strikethrough + "🟡 IN FLIGHT (this PR)" marker + scope detail.
- `docs/changelog/CHANGELOG_2026_05_17.md` (this entry) — session 3.

### Files Modified / Created

- **NEW (19):** `lib/featureFlags/conversationalOnboardingGate.ts`, `lib/featureFlags/ConversationalOnboardingGateContext.tsx`, `app/api/feature-flags/conversational-onboarding/route.ts`, `lib/ai/onboarding-agent/gateway.ts`, `lib/ai/onboarding-agent/schemas/wizardStateDelta.ts`, `lib/ai/onboarding-agent/tools/extractWizardStepDelta.ts`, `app/api/onboarding/chat/extract/route.ts`, `app/api/onboarding/chat/topic-confirmed/route.ts`, `components/onboarding/ConversationalModeToggle.tsx`, `components/onboarding/wizard-chat/types.ts`, `components/onboarding/wizard-chat/householdScript.ts`, `components/onboarding/wizard-chat/AgentMessage.tsx`, `components/onboarding/wizard-chat/UserMessage.tsx`, `components/onboarding/wizard-chat/ChatThread.tsx`, `components/onboarding/wizard-chat/ChatComposer.tsx`, `components/onboarding/wizard-chat/TopicRecapCard.tsx`, `components/onboarding/wizard-chat/ConversationalSetup.tsx`, `hooks/useVoiceInput.ts`, `prisma/migrations/20260517100000_phase_12_track_e_audit_actions/migration.sql`.
- **EDITED (5):** `prisma/schema.prisma`, `prisma/seed-feature-flags.ts`, `app/api/admin/feature-flags/[key]/route.ts`, `app/onboarding/layout.tsx`, `app/onboarding/page.tsx`.
- **DOC-SYNC (3):** `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/changelog/CHANGELOG_2026_05_17.md`.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:

- [x] visual design system / component pattern — new chat UI primitives under `components/onboarding/wizard-chat/`. NOT yet documented in `06_UI_UX_FOUNDATION.md` / `08_BRAND_UI_DESIGN.md` because these are E.2a static scaffolding components, not the canonical Track E design language (which lives in `PresenceOrb` + `motionTokens` shipping in E.2b). Phase doc §4a remains the SSOT for the design language until the polish ships. Decision pinned in PR description so a future session understands the §16.4 sequencing.
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture — new audit actions (`ONBOARDING_AGENT_*`) with field-name-only sanitised metadata. No CDR data flow change. New Anthropic call surface — already covered by Phase 33g.2 vendor posture; reuses `ANTHROPIC_API_KEY` + cost cap pattern. New `withPermission('settings.write')`-gated route.
- [ ] operational procedure
- [x] strategic decision — Track E flipped 📋 → 🟡 IN FLIGHT (Reza "go full steam" directive). Architectural correction in Phase doc §5.2 (`OnboardingState` → `UserPreference.onboardingDraft`).

Docs updated in this PR:
- `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` — Status flip + §5.2/§8/§11.2 corrections + changelog rev 3.
- `docs/IMPLEMENTATION_PLAN.md` — header refreshed + row 53 amended to "IN FLIGHT (this PR)".
- `docs/changelog/CHANGELOG_2026_05_17.md` — session 3.

### Destructive-write checklist (CLAUDE.md §12.11)

N/A. This PR contains:
- ZERO `prisma.<model>.update / upsert / delete / updateMany / deleteMany` calls
- ZERO raw SQL `UPDATE` / `DELETE`
- ONE schema migration — additive `ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS '...'` × 3. Idempotent. No `DROP`, no `ALTER ... DROP COLUMN`, no `TRUNCATE`, no non-default `NOT NULL` adds.

Verified by `git diff main --unified=0 | grep -E "prisma\\.[a-zA-Z]+\\.(update|upsert|delete|updateMany|deleteMany)\\(|\\\$executeRaw"` → no matches.

### Schema-migration check (CLAUDE.md §12.12)

✅ `prisma/schema.prisma` modified + matching migration at `prisma/migrations/20260517100000_phase_12_track_e_audit_actions/migration.sql` ship in the SAME PR. The Vercel preview build will run `prisma migrate deploy` against `monitrax-db-dev` before building — if migration fails, preview deploy aborts (old code keeps running).

### Build Status

- [x] TypeScript compilation passes (`tsc --noEmit` — only pre-existing `baseUrl` deprecation warning, no actual type errors from new files)
- [ ] `npm run lint` — N/A in sandbox (`next` binary not installed; Vercel preview will run it canonically)
- [ ] Tests — none added in this PR; the gateway's Zod validation is structurally enforced (any malformed LLM output fails closed). Integration tests for the chat loop queued for a follow-up PR.

### Validation

- [x] Flag default OFF — when `CONVERSATIONAL_ONBOARDING.enabled = false`, the toggle is hidden + `/onboarding?mode=chat` falls through to form-mode. `/onboarding` is byte-for-byte unchanged.
- [x] Agent never writes to a Prisma model — verified by grep: no `prisma.*` calls inside `lib/ai/onboarding-agent/*` or `components/onboarding/wizard-chat/*`. The gateway returns a structured delta only; persistence is via `saveDraft()` → `/api/onboarding/state` (existing endpoint).
- [x] Numeric extraction from user only — system prompt mandates it; Zod schema rejects strings in numeric fields; failed extraction lands in `unresolved` not in `fields`.
- [x] Per-topic recap confirmation gates persistence — the orchestrator calls `saveDraft()` ONLY on the "Looks right" path; nothing reaches the DB before user confirmation.
- [x] Voice input audio never leaves the device — `useVoiceInput` is browser-native Web Speech API only. No vendor STT.
- [x] Audit metadata sanitised — both endpoints use `sanitizeCdrMetadata()` and pass field NAMES only, never values.
- [x] Daily cap enforced — `/api/onboarding/chat/extract` counts `ONBOARDING_AGENT_EXTRACTION` rows in the last 24h, returns 429 above 200.
- [x] AFSL boundary preserved — the agent's tool registry contains the single `extractWizardStepDelta` tool. No advice surface, no recommendation tool. System prompt explicitly forbids advice / opinions.

### What's NOT in this PR (queued)

- **E.2b motion polish** — PresenceOrb SVG (4 states), typewriter agent message render, recap-card field-by-field assembly animation, first-encounter sequence (~1.2s), mistake-recovery dim-and-keep transition, optional notification tone. Phase doc §4a is the spec. Queued for PR #3.
- **Remaining topics** — entities, properties, debts, accounts, investments, super, assets, income-expenses. Each topic adds: a new branch of the `WizardStateDelta` discriminated union, a new script file (analog of `householdScript.ts`), an Anthropic system-prompt extension for that topic's mapping rules. One or two topics per follow-up PR.
- **Server-side transcript persistence** — chat transcript is client-only in v1 (lost on hard reload). Acceptable for a 5-10 turn flow. If usage signals it matters, add a transcript blob to `UserPreference.onboardingDraft` JSON or a dedicated column.
- **Mode-switch audit firing** — `ONBOARDING_AGENT_MODE_SWITCHED` enum value is in the schema but no call site fires it yet (the toggle is a `<Link>` navigation, not a state mutation). If a future PR wires a form↔chat audit trail, this is the canonical action.

### Why this matters (4-lens synthesis)

- **Architect lens:** the chat surface is a thin extraction layer over the existing form-wizard's data contract. ZERO new SSOT — `UserPreference.onboardingDraft` is the canonical store, `saveDraft()` is the canonical write, the form-wizard is the canonical UI for the rest of the topics. SSOT preserved (CLAUDE.md §12.2).
- **Behavioural-psychologist lens:** the chat reduces the cognitive tax of the Household step for users who'd rather talk than fill out a form. The state machine + LLM-as-extractor design keeps the agent helpful (translates user-language → system-fields) but structurally incapable of opining on the user's choices. Per-topic recap is the trust moment — the user sees what the agent heard before any DB write.
- **Financial-adviser lens:** the agent NEVER recommends, advises, or comments on the user's household structure. The tool registry has one tool and it's extraction-only. AFSL boundary preserved structurally, not by copy.
- **Security / compliance lens:** Anthropic provider posture already established (Phase 33g.2). Audit metadata sanitised. No new vendor (Web Speech API for voice is browser-native — no audio egress). Daily cost cap enforced at the gateway. With flag OFF, zero behavioural change.

### PR

- Branch: `claude/ai-agent-setup-wizard-NL4XV` (continuation from PR #770)
- PR: to be created at end of this build session.

https://claude.ai/code/session_01LpdUbW5rvNZc67oJ1us4Wo
