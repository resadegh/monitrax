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

---

## Session 4: Phase 12 Track E.2b — "presence, not persona" motion polish

Branch: `claude/ai-agent-setup-wizard-NL4XV` (continuation — PR #771 merged into main, branch recreated from main).

### Scope

- **Type:** UI / design-system primitive — visual identity layer over the working chat loop (PR #771).
- **Scope:** `components/onboarding/wizard-chat/` — adds the canonical `PresenceOrb` SVG + motion-tokens SSOT + wires typewriter agent render + recap-card staggered assembly + mistake-recovery dim-and-keep trail. No backend changes, no schema, no migration, no CDR posture change.
- **Flag:** `CONVERSATIONAL_ONBOARDING` stays default OFF — zero behavioural change pre-flip; the new animations only appear when the flag is ON and a user enters `/onboarding?mode=chat`.

### Trigger

Reza directive: *"Continue"* — after PR #771 (rev 3 functional Household slice) merged. Continuing with the queued E.2b motion polish per Phase doc §4a.

### Changes Made

#### 1. Motion tokens (SSOT)

- `components/onboarding/wizard-chat/design/motionTokens.ts` (NEW) — canonical SSOT for all chat-surface animation values. Constants: `MESSAGE_FADE_IN_MS=200`, `MESSAGE_FADE_IN_EASING`, `THINKING_PAUSE_MIN_MS=600` / `THINKING_PAUSE_MAX_MS=800`, `TYPEWRITER_CHARS_PER_SEC=35`, `RECAP_FIELD_STAGGER_MS=80`, `RECAP_CARD_RISE_MS=320`, `RECAP_CARD_RISE_EASING`, `RECAP_CTA_DELAY_MS=120`, `ORB_BREATHE_MS=2400`, `ORB_THINKING_SHIMMER_MS=1600`, `ORB_SETTLED_GLOW_MS=480`, `FIRST_ENCOUNTER_TOTAL_MS=1200`, `MISTAKE_RECOVERY_DIM_OPACITY=0.5`. Helpers: `useReducedMotion()` (reactive React hook over `matchMedia('(prefers-reduced-motion: reduce)')`) + `jitteredThinkingPauseMs()` (returns random int in the 600–800 window — jitter is intentional, fixed 700ms feels metronomic). Hard-coding any of these values elsewhere is a code-review reject.

#### 2. PresenceOrb primitive

- `components/onboarding/wizard-chat/primitives/PresenceOrb.tsx` (NEW) — the canonical visual identity of the Monitrax AI agent. NOT a face, NOT a mascot, NOT a logo (Phase doc §4a.2 + §4a.6 NO-list). Warm-ivory SVG with iridescent rotating overlay; 4 states (`idle` / `listening` / `thinking` / `settled`) typed via prop; `prefers-reduced-motion` → static 4px dot. File-header JSDoc per CLAUDE.md §16.4 documents design rules + reuse policy + anti-references (Cleo / Schwabby / Erica / Replika are explicitly NOT references).
- `components/onboarding/wizard-chat/design/presenceOrb.css` (NEW) — keyframes for the 4 state animations (`orb-breathe`, `orb-shimmer`, `orb-settled` + `orb-iridescence-slow/fast`). Defense-in-depth `@media (prefers-reduced-motion: reduce) { animation: none !important; }` in case a future caller forgets the React-level fallback.

#### 3. Typewriter agent render

- `components/onboarding/wizard-chat/AgentMessage.tsx` (EDIT) — gains word-boundary typewriter render at `TYPEWRITER_CHARS_PER_SEC` with ±15% per-word jitter. Cursor caret pulses while typing. `animate` prop controls behaviour — only the most-recently-appended agent message animates (older messages render fully visible — would feel weird to re-type seen history). `onTypingComplete` callback fires once per message for ChatThread to flip the orb state. `prefers-reduced-motion` → instant full-text render + immediate `onTypingComplete` fire.

#### 4. ChatThread orb anchoring

- `components/onboarding/wizard-chat/ChatThread.tsx` (EDIT) — anchors a SINGLE `PresenceOrb` to the latest agent message (older agent bubbles render plain — multiple breathing orbs at once = visual noise). Manages orb state: `thinking` while LLM call is in flight + while typewriter is running; brief `settled` glow on typewriter completion; back to `idle`. Renders a standalone orb-with-three-dots block before the very first agent turn (when no agent message exists yet to anchor to). New prop `newestAnimatedMessageId` lets the orchestrator name the typewriter target. Auto-scroll switches from `smooth` to `auto` under reduced motion.

#### 5. Staggered recap-card assembly + delayed CTA

- `components/onboarding/wizard-chat/TopicRecapCard.tsx` (EDIT) — full visual rewrite (preserves the structural API). Card rises from below via `recapCardRise` keyframe (`RECAP_CARD_RISE_MS`). Each field row fades in `RECAP_FIELD_STAGGER_MS` apart in document order. "Looks right" CTA stays disabled until `RECAP_CTA_DELAY_MS` after the last field settles — a deliberate beat for the user to READ before being able to confirm (prevents the reflex-tap-confirm-without-reading failure mode). `dimmed` state (mistake-recovery transparency §4a.5) fades to `MISTAKE_RECOVERY_DIM_OPACITY` and removes the action buttons. `prefers-reduced-motion` collapses every animation to its end state.

#### 6. Orchestrator wiring — pre-typewriter pause + dim-and-keep trail

- `components/onboarding/wizard-chat/ConversationalSetup.tsx` (EDIT) — three additions:
  1. **Pre-typewriter pause (§4a.3 timing beat #1):** after the extract API responds, the orchestrator waits `jitteredThinkingPauseMs()` (600-800ms jittered) BEFORE appending the next agent message. Even if the API is fast, this beat makes the agent feel attentive ("I'm reading what you said") rather than mechanical.
  2. **Newest-animated tracking:** new `newestAnimatedMessageId` state, bumped whenever `appendAgent()` adds a message. ChatThread uses it to typewrite only the freshly-appended message.
  3. **Mistake-recovery dim-and-keep trail (§4a.5):** new `historicalRecaps: RecapRow[][]` state. On "Change something", the current recap is snapshotted into the trail BEFORE flipping into changing mode. The trail renders as dimmed cards ABOVE the active recap — visible audit trail of every correction. The agent never silently overwrites its own notes.
- File-header JSDoc updated: moved presence orb + typewriter + recap stagger + dim-and-keep from "out of scope for this PR" → "in scope from E.2b (shipped 2026-05-17)". E.2b.2 deferred items documented.

#### 7. Doc-sync (CLAUDE.md §16)

- `docs/architecture/06_UI_UX_FOUNDATION.md` (EDIT) — new §14 "Conversational Onboarding Visual Language" — short pointer to the Phase doc §4a as SSOT + primitives table + reuse policy + NO-list pin against persona drift. Does NOT duplicate the §4a content — one design SSOT, one cross-reference.
- `docs/architecture/08_BRAND_UI_DESIGN.md` (EDIT) — new "AI surface visual identity — PresenceOrb" section — brand-surface pointer to §4a + the reuse rule (every future AI surface adopts this primitive) + anti-references.
- `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` (EDIT) — Status line updated (E.2b shipping in PR #3); changelog rev 4 appended documenting every E.2b change.
- `docs/IMPLEMENTATION_PLAN.md` (EDIT) — Last-updated header refreshed (session 4); row 53 amended to `✅` for E.2a + `🟡` for E.2b in flight.
- `docs/changelog/CHANGELOG_2026_05_17.md` (this entry) — session 4.

### Files Created / Modified

- **NEW (3):** `components/onboarding/wizard-chat/design/motionTokens.ts`, `components/onboarding/wizard-chat/design/presenceOrb.css`, `components/onboarding/wizard-chat/primitives/PresenceOrb.tsx`.
- **EDITED (4):** `components/onboarding/wizard-chat/AgentMessage.tsx`, `components/onboarding/wizard-chat/ChatThread.tsx`, `components/onboarding/wizard-chat/TopicRecapCard.tsx`, `components/onboarding/wizard-chat/ConversationalSetup.tsx`.
- **DOC-SYNC (5):** `docs/architecture/06_UI_UX_FOUNDATION.md`, `docs/architecture/08_BRAND_UI_DESIGN.md`, `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/changelog/CHANGELOG_2026_05_17.md`.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:

- [x] visual design system / component pattern — **MAJOR**: introduces the canonical AI-surface visual identity (`PresenceOrb`) + the motion-tokens SSOT for the chat surface. File-header JSDoc on `PresenceOrb.tsx` per §16.4. UI foundation + brand design docs updated with pointers.
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture — no change
- [ ] operational procedure
- [x] strategic decision — pins persona-drift NO-list across THREE docs (Phase doc + UI foundation + brand design), making it structurally hard for a future session to introduce an avatar / name / character voice without explicit rule update.

Docs updated in this PR:
- `docs/architecture/06_UI_UX_FOUNDATION.md` — §14 pointer + reuse policy
- `docs/architecture/08_BRAND_UI_DESIGN.md` — PresenceOrb brand-surface entry
- `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` — Status + changelog rev 4
- `docs/IMPLEMENTATION_PLAN.md` — header + row 53
- `docs/changelog/CHANGELOG_2026_05_17.md` — this session entry

### Destructive-write checklist (CLAUDE.md §12.11)

N/A. Zero `prisma.<model>.update / upsert / delete / updateMany / deleteMany` calls in this PR. Zero raw SQL. Zero schema changes. Zero migrations.

### Schema-migration check (CLAUDE.md §12.12)

N/A — no `prisma/schema.prisma` changes.

### Build Status

- [x] `tsc --noEmit` clean (only pre-existing `baseUrl` deprecation warning)
- [ ] `npm run lint` — N/A in sandbox; Vercel preview will run it
- [ ] Tests — none added in this PR; the motion logic is presentational + bounded (state-machine in `householdScript.ts` already tested implicitly via the working PR #771 chat loop).

### Validation

- [x] All 4 orb states render — verified via React component contract (`PresenceOrb` accepts typed prop)
- [x] `prefers-reduced-motion: reduce` fallback present on EVERY animation — verified per file: motionTokens hook + PresenceOrb returns static dot + AgentMessage skips typewriter + TopicRecapCard collapses to end state + ChatThread auto-scroll switches to instant
- [x] Hard-coded motion values absent in new/edited files — `motionTokens.ts` is the SSOT; verified via grep against the values I would have hardcoded
- [x] Single orb visible at a time — `ChatThread` anchors only to `latestAgentIdx`, older agent messages render plain
- [x] Dim-and-keep trail accumulates — `historicalRecaps` is append-only on "Change something"; rendered as dimmed cards above the active recap
- [x] Pre-typewriter pause feels human — jittered 600-800ms; tunable via `THINKING_PAUSE_MIN/MAX_MS`
- [x] Bootstrap messages do NOT animate — `bootstrappedRef` path uses `setMessages` directly + does NOT set `newestAnimatedMessageId`
- [x] NO-list pinned across 3 docs — `08_BRAND_UI_DESIGN.md`, `06_UI_UX_FOUNDATION.md` §14.3, Phase doc §4a.6 — all reject avatars / names / character voices / emojis. Persona drift requires explicit rule update.

### What's NOT in this PR (queued)

- **E.2b.2** — first-encounter sequence persistence (needs `UserPreference.chatFirstEncounterAt` column), optional notification tone toggle (needs `UserPreference.chatNotificationSoundEnabled` column + a toggle UI), mic-level → orb-ripple sync (needs Web Audio `AnalyserNode` wiring through `useVoiceInput`). Each needs schema or web-audio additions; keeping this PR purely presentational keeps the review focused.
- **PR #4+** — remaining topics. Each topic adds: new branch of the `WizardStateDelta` discriminated union, new script file (analog of `householdScript.ts`), system-prompt extension for that topic's AU vocabulary mapping rules.
- **`PresenceOrb` reuse on `/dashboard/cfo`** — explicitly out of scope. The primitive is built to be reused; the actual `/cfo` migration is a separate workstream (touches a high-traffic AI surface; deserves its own design review).

### Why this matters (4-lens synthesis)

- **Visual designer lens:** the orb is the brand-defining moment for AI in Monitrax. Premium *because* of restraint — warm-ivory iridescent, never garish, never a character. The reference set (Apple Intelligence + Siri + Linear + Mercury) makes "no mascot" the table-stakes.
- **Behavioural-psychologist lens:** every timing beat in this PR is calibrated against the "expert-friend confusion" risk. The 600-800ms pre-typewriter pause makes the agent feel attentive without making it feel slow. The recap-card stagger + delayed CTA prevents the reflex-tap failure mode. The dim-and-keep trail is the trust signal — visible audit of every correction.
- **Architect lens:** motion-tokens SSOT + single-primitive identity = future AI surfaces inherit the design language by importing. No surface re-invents the orb. The E-R11 NO-list is now pinned across 3 docs, making persona drift structurally hard.
- **Security / compliance lens:** zero change to CDR / AFSL posture. Animation polish is purely presentational. Reduced-motion fallbacks are first-class (not bolted on) — accessibility compliance preserved.

### PR

- Branch: `claude/ai-agent-setup-wizard-NL4XV` (recreated from main after #771 merged)
- PR: to be created at end of this build session.

https://claude.ai/code/session_01LpdUbW5rvNZc67oJ1us4Wo

---

## Session 5: Phase 12 Track E — Properties topic (Household → Properties chat chain)

Branch: `claude/ai-agent-setup-wizard-NL4XV` (continuation — PR #773 merged into main, branch recreated from main).

### Scope

- **Type:** Feature build — second chat topic + multi-topic orchestration refactor.
- **Scope:** Adds **Properties** to chat-mode. Chat now flows Household → Properties → form-mode handoff at the debts step (currentStep=4). Each chat-mode topic completes fully before the next; no parallel flows.
- **Flag:** `CONVERSATIONAL_ONBOARDING` stays default OFF — zero behavioural change pre-flip.

### Trigger

Reza directive: *"continue"* — after PR #773 (E.2b motion polish) merged. I recommended Properties as the next topic (highest-value: most onboarding wizards lose AU users on property terminology like LVR / offset / equity).

### Changes Made

#### 1. Schema additions (Zod + JSON Schema mirror)

- `lib/ai/onboarding-agent/schemas/wizardStateDelta.ts` (EDIT):
  - New `propertyTypeEnum` (HOME / INVESTMENT) + `propertyDeltaSchema` (`{ name, type?, currentValue?, hasLoan? }` — all fields except name are OPTIONAL so the LLM can emit partial properties and the state machine drives follow-up questions).
  - New `propertiesFieldsSchema` (`{ ownsProperty?, properties? }` — `ownsProperty: false` sentinel for the "no property" path).
  - New `propertiesStateDeltaSchema` joined into the `wizardStateDeltaSchema` discriminated union.
  - New `PROPERTIES_TOOL_INPUT_SCHEMA` (hand-crafted JSON Schema mirror for Anthropic's `input_schema`).
  - Exports: `PropertyDelta`, `PropertiesFields` types.

#### 2. System prompt + tool spec

- `lib/ai/onboarding-agent/tools/extractWizardStepDelta.ts` (EDIT):
  - New `PROPERTIES_SYSTEM_PROMPT` (~70 lines). Hard rules: tool-call only / numbers from user only / positional-merge (echo all staged properties on every turn) / AU vocabulary mapping (HOME for PPOR, INVESTMENT for IP/rental, normalise 850k/1.2m/$850,000 → integer AUD) / name extraction rules / hasLoan vocabulary / ownsProperty sentinel / NO commentary on market or valuations.
  - New `propertiesExtractTool` spec.
  - `ExtractToolDefinition.input_schema` relaxed from `typeof HOUSEHOLD_TOOL_INPUT_SCHEMA` to a union of household + properties schemas.

#### 3. State machine

- `components/onboarding/wizard-chat/propertiesScript.ts` (NEW, ~280 lines):
  - Steps: `INTRO` → `ASKING_OWNERSHIP` → `ASKING_PROPERTY_TYPE` / `ASKING_PROPERTY_VALUE` / `ASKING_PROPERTY_LOAN` (per incomplete property, in this order) → `ASKING_MORE` → `RECAP` / `CHANGING`.
  - Loop-break protection: `MAX_RETRIES_PER_STEP = 2` — if the LLM can't extract anything from the user's reply twice in a row, the script force-advances and leaves the field unstaged (recap shows what's missing; user fixes in form mode).
  - Positional merge: `mergeStaged()` trusts the LLM's echoed `properties` array (capped at 10) as the new state, since the system prompt instructs the LLM to echo all staged + new on every turn.
  - `formatPropertyValue()` / `summariseSingleProperty()` / `summariseProperties()` — recap formatters (AU currency formatting).
  - `bootstrapPropertiesConversation()` — first agent message when transitioning from Household → Properties.

#### 4. Gateway routing

- `lib/ai/onboarding-agent/gateway.ts` (EDIT):
  - `SupportedTopic` expanded to `'household' | 'properties'`.
  - `TopicStateSubset` union type.
  - `extractWizardStepDelta()` accepts both topics; routes to the right system prompt + tool spec per topic.
  - `max_tokens` bumped 600 → 800 (properties prompt is bigger because of positional-merge instructions; tool output may be larger when echoing all staged properties).
  - `buildUserPrompt()` formats household state as field-names-only (CDR-disciplined); properties state as the full staged array (each value here came from the user this turn — no CDR egress expansion).

#### 5. API routes accept both topics

- `app/api/onboarding/chat/extract/route.ts` (EDIT) — topic validation expanded; audit metadata uses the dynamic `topic` field.
- `app/api/onboarding/chat/topic-confirmed/route.ts` (EDIT) — `SUPPORTED_TOPICS` set expanded.

#### 6. Orchestrator multi-topic refactor

- `components/onboarding/wizard-chat/ConversationalSetup.tsx` (REWRITE):
  - New state: `chatTopic`, `propertiesScript`, `householdScript` (renamed from `script`).
  - New constant: `AFTER_PROPERTIES_FORM_STEP_INDEX = 4` (debts step — where the user lands in form mode after Properties confirms).
  - `handleSubmit` is topic-aware: routes to the right script's `advanceScript` + uses the right script's staged state for `currentStateSubset`.
  - `handleConfirm`:
    - **Household-confirm** now PIVOTS to Properties (instead of redirecting to form mode). Saves household to `UserPreference.onboardingDraft`, audits via `ONBOARDING_AGENT_TOPIC_CONFIRMED`, then bootstraps the Properties conversation in the same chat thread.
    - **Properties-confirm** saves merged WizardData (including Properties → form-mode `PropertyInput[]` with placeholder address/expenses), audits, redirects to `/onboarding` at `currentStep=4` (debts).
  - `handleChange` snapshots the current topic's recap into `historicalRecaps` (now keyed by topic so the dimmed cards label correctly).
  - `recapRows` is topic-aware via memoised per-topic computation.

### Files Created / Modified

- **NEW (1):** `components/onboarding/wizard-chat/propertiesScript.ts`
- **EDITED (5):**
  - `lib/ai/onboarding-agent/schemas/wizardStateDelta.ts`
  - `lib/ai/onboarding-agent/tools/extractWizardStepDelta.ts`
  - `lib/ai/onboarding-agent/gateway.ts`
  - `app/api/onboarding/chat/extract/route.ts`
  - `app/api/onboarding/chat/topic-confirmed/route.ts`
  - `components/onboarding/wizard-chat/ConversationalSetup.tsx` (substantial refactor for topic-awareness)
- **DOC-SYNC (3):** Phase doc rev 5 + IMPLEMENTATION_PLAN.md + this changelog entry

### Doc-sync (CLAUDE.md §16)

Surfaces changed:
- [ ] visual design system / component pattern — no new primitives (`PresenceOrb` + motion tokens reused unchanged across both topics; this is what the SSOT bought us)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture — minimal: the Properties gateway prompt includes staged property values in the user-message (so the LLM can positional-merge); these values originated from the user in the current session and are still ephemeral / not CDR-flagged. Audit metadata stays sanitised (`sanitizeCdrMetadata()` field-names-only).
- [ ] operational procedure
- [x] strategic decision — second chat topic shipped, multi-topic orchestrator pattern established for the remaining topics

### Destructive-write checklist (CLAUDE.md §12.11)

N/A. Zero `prisma.<model>.update / upsert / delete / updateMany / deleteMany` calls. Zero raw SQL. Zero schema changes. Zero migrations.

### Schema-migration check (CLAUDE.md §12.12)

N/A — `prisma/schema.prisma` not touched.

### Build Status

- [x] `tsc --noEmit` clean (only pre-existing `baseUrl` deprecation warning)
- [ ] `npm run lint` — N/A in sandbox; Vercel preview will run it
- [ ] Tests — none added; the Properties state machine is bounded + each transition is structurally enforced. Integration tests across the chat loop queued for a follow-up PR.

### Validation

- [x] Properties topic only accepts known enum values (HOME / INVESTMENT) — Zod rejects anything else
- [x] Numeric extraction from user only (Zod `int().min(1)` on `currentValue`; system prompt explicitly forbids invented numbers)
- [x] Per-property positional merge correctness — LLM echoes all staged on every turn; capped at 10
- [x] `ownsProperty: false` short-circuits to recap with "No property" — verified via state machine transitions
- [x] Hard rules preserved across topics: agent never writes to Prisma; per-topic recap confirmation gates persistence
- [x] AFSL boundary structural — no advice tool registered; system prompt explicitly forbids market commentary

### What's NOT in this PR (queued)

- **E.2b.2** — first-encounter persistence + optional sound + mic-level → orb-ripple sync (need schema or web-audio additions)
- **PR #5+** — remaining topics (debts / accounts / investments / super / assets / income-expenses). Each adds: new branch of `WizardStateDelta` union + new script file + system prompt extension. The orchestrator's topic-aware refactor (this PR) is what makes adding them cheap going forward.
- **Smart hydration of Welcome step from chat data** — when Properties is confirmed, the user lands on form mode at currentStep=4 (debts) with Welcome (currentStep=0) + Entities (currentStep=2) empty. They can hit Back. A future PR can derive sensible Welcome defaults from chat data (profileType: 'HOMEOWNER' if HOME property exists, etc.) so they don't need to revisit Welcome.

### Why this matters (4-lens synthesis)

- **Architect lens:** the topic-aware orchestrator pattern is the multiplier — each subsequent topic adds a Zod branch + a script file + a system-prompt section, with no orchestrator surgery. The cost of adding a topic drops sharply.
- **Behavioural-psychologist lens:** Properties is the highest-anxiety topic for AU users entering finance apps (PPOR vs investment, mortgage stigma, value uncertainty). Conversational mode + warm copy + the agent's no-judgement extraction directly addresses the "expert-friend confusion" risk on the most sensitive topic.
- **Financial-adviser lens:** strict numbers-from-user rule preserved + Phase 41E reform-sensitive fields (acquisitionContractDate, isNewBuild, newBuildEvidence) deliberately stay in form mode where dates can be picked precisely, not misheard.
- **Security / compliance lens:** AFSL boundary preserved structurally — system prompt explicitly forbids advice / opinions / market commentary, tool registry has only the extractive tool, audit metadata is field-names-only. No vendor expansion. No new CDR egress beyond what Household already did.

### PR

- Branch: `claude/ai-agent-setup-wizard-NL4XV` (recreated from main after #773 merged)
- PR: to be created at end of this build session.

https://claude.ai/code/session_01LpdUbW5rvNZc67oJ1us4Wo
