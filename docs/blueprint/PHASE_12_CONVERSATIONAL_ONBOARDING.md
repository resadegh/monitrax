# Phase 12 — Conversational Onboarding (Parallel Input Modality)

> **Living document.** Parallel input modality to the existing form-based
> wizard documented in `PHASE_12_SETUP_AND_ONBOARDING.md`. A conversational
> AI agent (voice + text) asks the user about their financial picture,
> stages the answers, and converges on the **same review screen** and
> **same bulk-create endpoint** the form-wizard already uses. The form
> wizard is NOT changed or replaced.

**Owner:** Claude (engineer) | **Reviewer:** Reza
**Status:** 🟡 IN FLIGHT 2026-05-17 — Track E.0 + E.1 + E.2a + E.2b + E.3 + E.4 + E.5 shipped covering **Household + Properties topics** (PR #771 + #773 merged; PR #4 ships Properties topic — Household → Properties chat chain → form-mode handoff at debts step). Deferred to **E.2b.2**: first-encounter persistence + optional sound + mic-level→orb-ripple sync (need schema additions or web-audio wiring). Remaining topics — debts / accounts / investments / super / assets / income-expenses — queued one or two per follow-up PR.
**Parent doc:** `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md` (Twin-Track Plan — Track B "/onboarding new wizard" defines the canonical data contract this track reuses)
**Related:**
- `CLAUDE.md` §0 (advisory mindset), §6.1–§6.4 (architecture enforcement), §12.2 (SSOT), §12.5 (secure by design), §12.11 (destructive write checklist), §13 (CDR compliance), §14 (TRAIL)
- `lib/ai/tax-advisor/gateway.ts` (existing closed-discriminant tool gateway — pattern reused, not extended)
- `lib/ai/anthropic.ts` + `lib/ai/gemini.ts` (existing LLM clients)
- `components/onboarding/wizard/ReviewStep.tsx` (canonical pre-write review surface — chat-mode terminates here)
- `app/api/onboarding/bulk-create/route.ts` (canonical write endpoint — UNCHANGED by this track)

---

## Table of Contents

1. Why this exists
2. Hard rules (non-negotiable)
3. What this is NOT
4. Track E — Phase breakdown (E.0 → E.6, with E.2 split into E.2a + E.2b)
4a. Visual & motion design — "presence, not persona"
5. Data contract
6. Voice I/O strategy (v1)
7. Security, CDR, and AFSL boundary
8. Risk register
9. Open questions for Reza
10. Validation checklist
11. Files: stay / new / never-touched
12. Changelog

---

## 1. Why this exists

Form-based onboarding wizards have ~30–50% abandonment industry-wide. The failure mode is concentrated in two user groups:

1. **Users who don't recognise the terminology** — "offset account", "LVR", "novated lease", "investment property vs PPOR". A form forces them to look up the word or guess.
2. **Users who feel overwhelmed by field count** — even a tightly designed 12-step wizard is visually 12 forms long. The cognitive tax is real (Mani et al. 2013 — financial stress already costs 13 IQ points; the system should give them back, not take more).

A conversational mode — agent asks one question at a time, user replies in plain English by voice or text, agent extracts the structured field, agent batches a per-topic confirmation — addresses both at once. The agent translates between user-language ("the loan against my home", "what I get paid each fortnight") and system-fields (`Loan.principal`, `Income.frequency = FORTNIGHTLY`) without forcing the user to learn the system's vocabulary.

This is not a new wizard. It is a new **input modality** over the existing wizard's data contract. Same staged payload, same review screen, same bulk-create endpoint. The agent is structurally incapable of writing to the database autonomously: it only stages state changes, which the user reviews and confirms before any write occurs.

**TRAIL alignment:** Stage **T (Track)**. The whole point of this track is to get the user from zero to *"Monitrax knows my picture"* faster than the form path can. Track-stage promise honoured, no later-stage features exposed prematurely.

## 2. Hard rules (non-negotiable)

These are the load-bearing constraints. Every implementation decision must respect every one of them.

1. **Two front doors, one house.** The chat mode populates the same `OnboardingState` the form-mode wizard populates. A user can switch between modes mid-flow without losing staged data.
2. **No autonomous DB writes.** The agent stages a structured `WizardStateDelta`. Nothing reaches a Prisma write until the user confirms a recap. Even then, the write goes through the existing `ReviewStep` → `/api/onboarding/bulk-create` path — the agent never calls a Prisma client directly. CLAUDE.md §12.11 "no surprise writes" is enforced structurally.
3. **No hallucinated numbers.** The agent extracts only what the user explicitly said. It never volunteers, infers, or estimates a number the user did not provide. If a number is ambiguous ("around 800k-ish"), the agent asks one clarifying question and accepts the user's answer verbatim. The extraction tool's output schema rejects free-form text in numeric fields.
4. **Confirmation cadence is per topic, not per field.** End each topic (Property, Loan, Account, Investment, etc.) with a recap card — *"Quick recap: home at 4 Brilliant Way, worth $850k, owner you + Sarah, no mortgage yet — anything to change?"* — and stage the writes only after the user confirms "Looks right". Per-field confirmations feel like a robot reading back a survey; per-topic recaps feel like a competent assistant taking notes.
5. **Voice is browser-native for v1.** Web Speech API for STT (speech-to-text), Web Speech Synthesis (optional, off by default) for agent replies. Zero audio leaves the device. No new vendor credential surface. No new CDR-relevant data egress.
6. **The final ReviewStep is the only write boundary.** Both form-mode and chat-mode converge on the existing `components/onboarding/wizard/ReviewStep.tsx` before `/api/onboarding/bulk-create` runs. Even the final "Confirm and save" click is the canonical existing button — the chat does not bypass the review.
7. **The agent is not the CFO.** The CFO / AI advisor lives at `/dashboard/cfo` and uses `lib/ai/tax-advisor/gateway.ts` with a different tool registry and different safety boundary. The onboarding agent is strictly an extractive data-entry assistant. Do not blend the two surfaces or the two gateways.

## 3. What this is NOT

- ❌ A replacement for the form-based wizard. Form-mode is the default; chat-mode is opt-in via a toggle.
- ❌ The CFO / AI advisor. That lives elsewhere with a different gateway, a different tool registry, and a different safety boundary.
- ❌ A reason to bypass the §12.11 destructive-write checklist.
- ❌ A new SSOT for onboarding data. Same `OnboardingState` shape Track B defines.
- ❌ A reason to send raw user audio to a cloud STT vendor in v1.
- ❌ A reason to expand CDR data egress. `§13.3` "never log CDR data" still applies — to LLM logs as well as application logs.
- ❌ A surface for personal financial advice. The agent asks and extracts; it does not recommend. AFSL/TPB boundary is preserved structurally — there is no advice-recommendation tool registered.

## 4. Track E — Phase breakdown (E.0 → E.6, with E.2 split into E.2a + E.2b)

Track E sits alongside Tracks A–D from the parent doc. It depends only on Track B's data contract (`OnboardingState` shape + `/api/onboarding/bulk-create` endpoint + `ReviewStep` component), which already exists in production.

**Phase order:** E.0 → E.1 → **E.2a (static chat shell, validates the data loop)** → E.3 → E.4 → **E.2b (motion + presence orb, layered on once the loop works)** → E.5 → E.6.

The E.2 split is deliberate (per 2026-05-17 design pass). E.2a is the absolute minimum visual layer needed to prove the data loop end-to-end — bubbles, recap cards, ReviewStep handoff, but no animation polish, no presence orb, no typewriter. Once E.2a + E.3 + E.4 ship and a fictitious user can complete a topic via chat without polish, E.2b lifts the whole surface from "competent chatbot" to "premium fintech assistant with presence" using the design rules in §4a. Two reasons for the split: (a) reduces risk of polishing something that doesn't function; (b) the design lift is a substantial design-review surface — better as its own PR with focused acceptance criteria.

### E.0 — Feature flag + route toggle

**Scope**: 1 new flag, 1 new gate hook, 1 toggle component, 1 page edit.

**Depends on**: nothing (greenfield).

**Deliverables**:
- New entry under `GlobalFeatureFlag` (key `CONVERSATIONAL_ONBOARDING`, default `enabled = false`).
- New gate hook `useConversationalOnboardingGate()` mirroring `BasiqGateContext` (server-side reader + client React hook).
- New toggle on `/onboarding` page: **"Fill in a form"** (default, existing behaviour) | **"Chat with Monitrax"** (new, flag-gated). Toggle only renders when flag is ON; otherwise form-mode is the only path.
- No changes to existing `WizardContainer` or any form step. Zero risk of regression on the form path.

**Acceptance gate**: with the flag OFF, the `/onboarding` page is byte-for-byte the existing experience.

### E.1 — Agent gateway + extractor tool

**Scope**: 1 new gateway file, 1 new tool, 1 new provider wiring.

**Depends on**: E.0.

**Deliverables**:
- New gateway file `lib/ai/onboarding-agent/gateway.ts` following the closed-discriminant pattern from `lib/ai/tax-advisor/gateway.ts`. Closed tool kind: `EXTRACT_WIZARD_STEP_DELTA` (single value for v1 — adding new values is a deliberate, reviewed extension).
- Single tool registered for v1: `extractWizardStepDelta`.
  - **Input**: `{ topic, currentStateSubset, userMessage, recentTranscript }` — `currentStateSubset` is the subset of `OnboardingState` relevant to the current topic; `recentTranscript` is the last ~4 turns for disambiguation; nothing else.
  - **Output**: `WizardStateDelta` (see §5.1) — structured, schema-validated at the gateway boundary, free-form text rejected.
- The LLM is constrained to extraction only via:
  - System prompt that explicitly forbids volunteering numbers, advice, or fields outside the input topic.
  - Tool-use mode (Anthropic) / function-calling mode (Gemini) — the model cannot return raw text in v1; only the structured tool call shape.
  - Gateway validator rejects any response that fails Zod parsing.
- **Provider choice for v1**: **Claude (Anthropic)** via existing `lib/ai/anthropic.ts`. Rationale: tool-use reliability + structured-output adherence + alignment with the rest of the structured-write surfaces. Gemini stays the default for the main tax-advisor surface (Q-AI-PROVIDER 2026-05-16). This is a sibling, not a re-litigation. Provider remains swappable via the abstract `AIProvider` interface (`lib/ai/tax-advisor/providers/types.ts`).
- Daily cost cap per user enforced at the gateway (reusing the existing `lib/ai/usage` instrumentation pattern). v1 cap: 200 turns/user/day (sets a clear safety net well above typical 30–60 turn sessions).

**Acceptance gate**: gateway rejects every malformed tool output. The model cannot return a number in a string field. The model cannot return a field outside the current topic.

### E.2a — Conversational shell (text-only, static)

**Scope**: 1 new component tree under `components/onboarding/wizard-chat/`.

**Depends on**: E.1.

**Goal**: prove the data loop works end-to-end with the absolute minimum visual layer. Static bubbles, no presence orb, no typewriter, no audio. Once this ships and a fictitious user can complete a Household topic via chat → recap → ReviewStep, layer §E.2b on top.

**Deliverables**:
- New file `components/onboarding/wizard-chat/ConversationalSetup.tsx` — top-level orchestrator.
- New sub-components: `ChatThread.tsx` (renders the message stream), `AgentMessage.tsx` (agent reply bubble — static, no presence orb yet), `UserMessage.tsx` (user reply bubble), `ChatComposer.tsx` (text input + opt-in mic button), `TopicRecapCard.tsx` (the per-topic confirmation card, see §4 E.3).
- Structural visual design:
  - Single column, max-w-[640px] centered (one notch wider than the form wizard's 520px to accommodate the recap cards).
  - One agent message + one user reply per turn. No multi-paragraph agent monologues.
  - Restrained motion: 200ms fade-in on new messages, no bounce, no typing-indicator gimmick. Static end-state — no typewriter, no orb. **All motion polish lands in E.2b**, deliberately separate.
  - Typography matches the form wizard's `TYPE_SCALE` tokens (do NOT introduce a new scale).
  - Dark mode parity from day one — same tokens as the form wizard.
- Text-first by default. Mic button is opt-in per turn (tap to speak, tap to stop). Mic permission requested only when the user taps the mic — never on page load.
- TTS (agent reply spoken aloud) is OFF by default. Optional user-controlled toggle to enable Web Speech Synthesis. Text bubbles remain the canonical channel even when TTS is on.
- Conversation state lives in client component state. **Architectural correction (2026-05-17, build session):** the original plan referenced `OnboardingState.chatTranscript` as a server-side mirror — but `OnboardingState` is a hook return type (`hooks/useOnboardingState.ts`), NOT a Prisma model. The canonical server-side store for in-progress onboarding is `UserPreference.onboardingDraft` (Json). v1 keeps chat transcript in client state only (lost on hard reload — accepted trade-off for a 5–10 turn flow); the staged WizardData delta is persisted via the existing `saveDraft()` → `UserPreference.onboardingDraft` path so form-mode picks up seamlessly. Resume-after-reload of mid-conversation chat is a follow-up if/when usage shows it matters.

**Acceptance gate**: a fictitious user can complete the Household topic via chat → recap → ReviewStep without any animation polish. The data loop is what's being validated.

### E.2b — Motion, presence, and the "alive" layer

**Scope**: 1 new tokens module + 1 new primitive + motion wiring across E.2a's components.

**Depends on**: E.2a (must be shipped + green).

**Goal**: lift the chat surface from "competent chatbot" to "premium fintech assistant with presence." This is where the design-lens recommendations from §4a land in code. Built as a deliberate second pass so we don't polish something that doesn't function.

**Deliverables**:
- New file `components/onboarding/wizard-chat/design/motionTokens.ts` — canonical SSOT for every animation duration / easing / stagger in the chat surface (see §4a.1 below for the token list).
- New file `components/onboarding/wizard-chat/design/audioTokens.ts` — canonical SSOT for the notification tone path + Web Audio API analyser config (mic ripple sync). Used by `useVoiceInput.ts` and the optional notification cue.
- New primitive `components/onboarding/wizard-chat/primitives/PresenceOrb.tsx` — the SVG presence element rendered next to the agent's messages. Four states: `idle`, `listening`, `thinking`, `settled`. `prefers-reduced-motion` collapses to a static dot. See §4a.2 for the full spec.
- Motion wiring across E.2a's components:
  - `AgentMessage` gains the typewriter render (35 chars/sec, ease-out per word boundary).
  - `ChatThread` gains the 600–800ms "thinking" pause before the typewriter starts.
  - `TopicRecapCard` gains the staggered field-assembly animation (fields fade in 80ms apart; the "Looks right" button activates only after the last field has settled).
  - `ConversationalSetup` gains the first-encounter sequence (~1.2s, played once per user, never replayed).
  - "Change something" → previous recap dims to 0.5 opacity, stays visible above the new recap (the visible-trail trust signal from §4a.5).
- Optional notification tone implemented (off by default; user-controlled toggle; preference persists on `UserPreference`).
- `prefers-reduced-motion: reduce` static fallback for EVERY animation — not bolted on, tested as a peer of the animated path.

**Acceptance gate**: D.0 design-quality pass per parent doc §7 — must clear every §7.2 criterion (premium look, dark-mode parity, prefers-reduced-motion honoured, mobile responsive, no clutter) PLUS the §4a-specific criteria (orb states transition smoothly, typewriter respects word boundaries, recap-card assembly delays the CTA correctly, first-encounter sequence plays exactly once, "Change something" preserves the prior recap visibly).

### E.3 — Per-topic confirmation cards

**Scope**: 1 new component + integration with the chat thread.

**Depends on**: E.2.

**Deliverables**:
- At the end of each topic (Welcome, Household, Properties, Debts, Accounts, Investments, Super, Assets, Income, Expenses — matching the existing wizard's 12-step topic set), the agent emits a recap card.
- The recap card is a structured component rendered inline in the chat thread:
  - List of fields the agent staged for this topic, each as `<label>: <value>` rows.
  - Currency formatted via `lib/utils/formatters.ts` (canonical SSOT).
  - Frequency normalised via `lib/utils/frequencies.ts` (e.g. fortnightly income shown as fortnightly, not auto-converted to monthly — match what the user said).
  - Primary button: **"Looks right"** (advances + stages the delta into `OnboardingState`).
  - Secondary button: **"Change something"** (opens a localised correction flow).
- "Change something" flow:
  - Agent asks: *"What would you like to change?"*
  - User describes the diff in plain English ("the home is worth 900, not 850").
  - Agent calls `extractWizardStepDelta` again with the diff context.
  - Agent re-emits the recap card with the updated values.
  - User can iterate until satisfied, then tap "Looks right".
- "Looks right" stages the delta into `OnboardingState` (client + server mirror) and the agent moves to the next topic.
- **No DB write occurs at this step.** The staged data lives in `OnboardingState` and is only written by `/api/onboarding/bulk-create` after the user confirms the final ReviewStep.

**Acceptance gate**: a user can complete a full 10-topic conversation, edit any field via "Change something", and arrive at the ReviewStep with every value matching what they confirmed.

### E.4 — Convergence on the existing ReviewStep

**Scope**: 1 file edit (page-level routing).

**Depends on**: E.3.

**Deliverables**:
- After the user taps "Looks right" on the last topic recap, the page transitions to the existing `components/onboarding/wizard/ReviewStep.tsx` with the staged `OnboardingState` pre-populated.
- The ReviewStep is the canonical pre-write surface. The user can edit any field via the existing form UI before clicking "Confirm and save".
- "Confirm and save" calls the existing `POST /api/onboarding/bulk-create` endpoint with the staged payload.
- This is the **single write boundary**. Both form-mode and chat-mode terminate here. The chat-mode never calls `/api/onboarding/bulk-create` directly — it hands off to ReviewStep.

**Acceptance gate**: a chat-mode session and a form-mode session for the same fictitious user produce identical `bulk-create` payloads (modulo `source` tagging — see §5.3).

### E.5 — Audit + observability + cost control

**Scope**: 3 new audit actions, 1 cost-cap config row, 1 admin dashboard tile.

**Depends on**: E.1.

**Deliverables**:
- 3 new `AuditAction` enum values (additive migration):
  - `ONBOARDING_AGENT_EXTRACTION` — emitted on every successful `extractWizardStepDelta` tool call. Metadata: `{ topic, deltaFieldNames }`. **Field names only, never values** (CDR §13.3 sanitisation). The `sanitizeCdrMetadata()` helper from `lib/security/cdrAuditCompliance.ts` is the gate.
  - `ONBOARDING_AGENT_TOPIC_CONFIRMED` — emitted when the user taps "Looks right". Metadata: `{ topic }`.
  - `ONBOARDING_AGENT_MODE_SWITCHED` — emitted when the user toggles between form-mode and chat-mode mid-flow. Metadata: `{ from, to }`.
- LLM token usage logged via existing `lib/ai/usage` instrumentation. Daily cap per user enforced at the gateway (default 200 turns/user/day).
- Admin dashboard tile (under existing `/admin/scheduler` or a new `/admin/ai-usage` page — decision deferred to E.5 implementation) showing daily aggregate: turns, tokens, est. cost, distribution by topic, error rate.

**Acceptance gate**: every agent extraction produces an audit row. No audit row contains a CDR value. Daily cap demonstrably enforced (manual test: trigger 201 turns, observe rate-limit response).

### E.6 — Doc-sync + IMPLEMENTATION_PLAN

**Scope**: this doc + parent doc pointer + IMPLEMENTATION_PLAN entries.

**Depends on**: nothing (doc-only, shipped with E.0).

**Deliverables**:
- This doc (`PHASE_12_CONVERSATIONAL_ONBOARDING.md`) created and kept current.
- Parent doc `PHASE_12_SETUP_AND_ONBOARDING.md` gains a "Related" line pointing to this doc.
- `docs/IMPLEMENTATION_PLAN.md`:
  - New entry in **📋 Up Next** (queued, agreed, not started) tagged "Conversational onboarding (Track E)".
  - New entry in **❓ Open Questions** — `Q-CONV-1` (STT provider strategy for v2 — Web Speech API for v1, decision on cloud STT deferred to post-v1 feedback).
- When E.0 ships, flip this doc's Status header to "🟡 In flight". Move the Up Next entry to Active Workstreams.
- When E.4 ships, flip Status to "✅ Complete" and add to Recently Completed.
- Per CLAUDE.md §16.5, every PR that touches a Track E surface includes the doc-sync block.

## 4a. Visual & motion design — "presence, not persona"

> **The load-bearing design decision for Track E was made 2026-05-17 (Reza + Claude architect-mode session).** The user-facing question — *"can it feel like a person?"* — is answered structurally: **presence, not persona.** The agent has no avatar, no name, no character voice. It has *presence* — through motion, rhythm, warmth, and attentive micro-interactions. This section is the canonical spec for that presence.

### Why this answer (the four lenses, compressed)

- **Financial-adviser lens:** finance demands gravitas. Mercury, Stripe, Apple Cash, XPLAN — zero mascots. A cartoon mascot undermines telling someone *"I'm adding $850,000 to your asset profile."*
- **Behavioural-psychologist lens:** anthropomorphism creates the **expert-friend confusion** — users transfer trust meant for licensed advice onto a "friend" who is structurally an extractor. Presence-without-persona keeps the role honest: the agent is a smart notebook taking down what the user said, not a person making suggestions.
- **Architect lens:** persona = character logic (voice, copy, fallbacks, name moderation, brand reviews) — surface area that bloats. Presence = bounded component-level work (motion primitives, micro-interactions).
- **Growth/marketing lens (dissent surfaced):** a persona would be more meme-able. Real, but not load-bearing for the B2B-led wedge (brokers + advisers want premium, not viral). Revisit only as a marketing decision post-Basiq, not as a chat-avatar decision.

If Phase 6 (consumer scale, post-Basiq) ever shows that viral differentiation requires a persona, that's a marketing copy + tone decision — not a re-architecting of the chat surface. The architecture below does not preclude a future persona; it just refuses to bake one in early before validation.

### 4a.1 Motion tokens (canonical, SSOT — implemented in E.2b)

These are the only motion values the chat surface uses. Every animation must read from `motionTokens.ts`. Hard-coding durations or easings is a code-review reject.

| Token | Value | Used by |
|---|---|---|
| `MESSAGE_FADE_IN_MS` | 200 | Bubble fade-in on new message |
| `MESSAGE_FADE_IN_EASING` | `cubic-bezier(0.22, 1, 0.36, 1)` | Bubble fade-in |
| `THINKING_PAUSE_MIN_MS` | 600 | Pause between user message and agent typewriter start |
| `THINKING_PAUSE_MAX_MS` | 800 | Upper bound (jitter inside the window to feel natural, not metronomic) |
| `TYPEWRITER_CHARS_PER_SEC` | 35 | Agent message typewriter speed |
| `TYPEWRITER_WORD_BOUNDARY_EASING` | `ease-out` per-word | Word-by-word reveal feels human; char-by-char feels mechanical |
| `RECAP_FIELD_STAGGER_MS` | 80 | Gap between successive field reveals in `TopicRecapCard` |
| `RECAP_CARD_RISE_MS` | 320 | Card glides up from below the agent's bubble |
| `RECAP_CARD_RISE_EASING` | `cubic-bezier(0.22, 1, 0.36, 1)` | Same as the form wizard's progress bar — visual continuity |
| `RECAP_CTA_DELAY_MS` | 120 | "Looks right" button activates this long after the last field settles |
| `ORB_BREATHE_MS` | 2400 | Idle pulse cycle (sinusoidal scale 0.96→1.0, opacity 0.7→1.0) |
| `ORB_LISTEN_RIPPLE_SYNC` | live | Ripples sync to Web Audio `AnalyserNode` audio level — see §6 |
| `ORB_THINKING_SHIMMER_MS` | 1600 | Slower shimmer + hue drift while LLM call is in flight |
| `ORB_SETTLED_GLOW_MS` | 480 | Momentary glow on message complete, then back to breathing |
| `FIRST_ENCOUNTER_TOTAL_MS` | 1200 | Total runtime of the first-time-open sequence |
| `MISTAKE_RECOVERY_DIM_OPACITY` | 0.5 | Previous recap card dims (stays visible) when user taps "Change something" |
| `REDUCED_MOTION_STATIC_FALLBACK` | true | If `prefers-reduced-motion: reduce`, every motion above collapses to its static end-state. Mandatory. |

### 4a.2 PresenceOrb primitive — the canonical SVG (E.2b)

**File**: `components/onboarding/wizard-chat/primitives/PresenceOrb.tsx`.

**What it is**: a small circular SVG element rendered next to the agent's messages. NOT a face. NOT a robot. NOT a logo. Think Apple Intelligence's iridescent glow or Siri's circular waveform — ambient intelligence, not a character.

**Visual baseline**:
- Circular, 28px diameter on desktop, 24px on mobile.
- Base fill: warm-ivory (same as the form wizard's primary background).
- Iridescent overlay: a slow rotating linear gradient `from-blue-400/20 via-violet-400/20 to-blue-400/20` — subtle, never garish.
- Soft outer shadow at rest: `shadow-[0_8px_24px_-12px_rgba(99,102,241,0.25)]`.
- Dark-mode parity from day one — base flips to a slightly cooler ivory; iridescence stays.

**Four states** (typed via a `state` prop, never inferred):

| State | When | Animation |
|---|---|---|
| `idle` | Agent has spoken, waiting for user reply | Breathing — sinusoidal scale 0.96 → 1.0, opacity 0.7 → 1.0, cycle `ORB_BREATHE_MS` |
| `listening` | User is holding-to-speak via mic | Concentric ripples sync to Web Audio `AnalyserNode` audio level; max 3 ripple rings; ripple opacity 0.0 → 0.4 → 0.0 over 800ms each |
| `thinking` | LLM call in flight | Iridescent overlay rotates `ORB_THINKING_SHIMMER_MS`; base hue drifts 0° → 15° → 0° on the same cycle |
| `settled` | Agent just finished typing a message | Momentary glow `ORB_SETTLED_GLOW_MS`, then back to `idle` |

**`prefers-reduced-motion` fallback**: collapses to a static 4px circle (no animation, no iridescence, no ripples). Tested as a peer of the animated path — not bolted on.

**File-header JSDoc** (per CLAUDE.md §16.4): documents the four states, the `prefers-reduced-motion` fallback rule, the "no face / no character" design constraint, the references (Apple Intelligence + Siri waveform), and links to this §4a section.

### 4a.3 Conversation rhythm — the magic moment

The three timing beats that make the chat feel attentive instead of mechanical:

1. **Pre-typewriter pause** — when the user sends a message, the agent waits 600–800ms (jittered) BEFORE the typewriter starts, even if the LLM has already replied. This is the "I'm reading what you said" beat. Tiny, load-bearing. Without it the agent feels like a robot finishing the user's sentence; with it the agent feels like a person taking the message in.
2. **Typewriter cadence** — 35 chars/sec, eased per word boundary. Fast enough to not feel sluggish, slow enough to feel alive. Char-by-char looks mechanical; word-by-word reads natural.
3. **Recap-card assembly** — when a topic ends, the card glides up from below the agent's last bubble (`RECAP_CARD_RISE_MS`); fields fade in `RECAP_FIELD_STAGGER_MS` apart in document order; the "Looks right" button activates `RECAP_CTA_DELAY_MS` after the last field settles. The user watches the agent's notes come together. **This is the trust-building moment** — the visual proof that the agent has organised what was said before asking for confirmation.

### 4a.4 First-encounter sequence (plays exactly once per user)

First time chat-mode opens, the orb is small + centered + alone in an empty surface. Sequence:

1. T+0: orb visible at 50% size, idle breathing.
2. T+300ms: orb expands to working size, settled-glow fires.
3. T+500ms: surface chrome (composer, header) fades in around the orb.
4. T+700ms: first agent message types out next to the orb.
5. T+1200ms: ready for user input.

Stored as "seen" in `UserPreference.chatFirstEncounterAt` (Json field on `onboardingDraft`, or a dedicated column if storage frequency makes it worth it). Never replayed. Subsequent visits skip directly to the working chat surface. (E.2b deliverable — v1 ships without first-encounter sequence, see Status.)

### 4a.5 Mistake-recovery transparency

When the user taps "Change something" on a recap card, the previous card **dims to `MISTAKE_RECOVERY_DIM_OPACITY` and stays visible** above the new card. The agent NEVER silently overwrites its own notes.

Why: the visible trail is the trust signal. Users can see what the agent thought before, what they corrected, and what the agent thinks now. Hiding the prior version is the same anti-pattern as silently editing a chat message — it erodes the user's belief that the agent is keeping honest notes.

### 4a.6 What we say NO to (load-bearing dissent surfaced)

These are explicit pins so a future PR can't drift in by accident:

- ❌ **Avatar / face / robot / mascot.** The orb is a presence cue, not a character.
- ❌ **Name** (e.g. "Monty", "Tracksy", "Monnie"). Sub-brand drift + persona-confusion + AFSL-boundary fuzz.
- ❌ **Character voice** different from the Monitrax product voice. The agent speaks in the warm-words register from CLAUDE.md §14, not a stylised "AI personality."
- ❌ **Emojis in agent messages.** Already against the warm-words rule.
- ❌ **Three-dot typing indicator.** The orb's `thinking` state replaces it. Three dots are a chatbot tell.
- ❌ **Fake typing slowness** that's slower than the actual LLM reply. Patronising.
- ❌ **Sound on by default.** User may be in a meeting or on transit. Off by default; persist preference if enabled.
- ❌ **Cleo-style snark, Replika-style warmth, Schwabby-style cartoon.** Wrong audience tone.

If a future session is tempted to break any of these, the §8 risk register entry **E-R11 (Persona drift)** is the reviewer's reject reason.

### 4a.7 Reference benchmarks (cite for grounding, do not copy)

- **Apple Intelligence (iOS 18.x)** — iridescent glow on Siri; rainbow border on summon; response composes field-by-field. The closest analogue to what we're building.
- **Siri's circular waveform** — the canonical pattern for "I'm listening, this is what I'm hearing."
- **Linear's command palette** — ambient warmth + restraint; static text feels alive without animation gimmickry.
- **Mercury's account-open flow** — deliberate pacing, warm typography, calm — proof that "premium fintech" reads as restraint not richness.
- **Notion AI** — typewriter cadence + rolling block of generated content; reference for the agent's message render.
- **Stripe onboarding modals** — sequential focus chain; reference for the recap-card field assembly.
- **NOT** Cleo, NOT Schwabby, NOT Erica, NOT Replika. Wrong tone for Monitrax.

### 4a.8 Reusability — the orb is the brand surface for AI

Once `PresenceOrb` ships, it becomes the canonical AI-presence element for ALL future AI surfaces in Monitrax:

- `/dashboard/cfo` (the existing AI Guide surface) — orb replaces today's static icon (separate workstream, not in Track E).
- Future agent surfaces (e.g. Phase 32C marketplace introduction agent, if it ever exists) — same orb, same four states.

Changing the orb later is expensive because it becomes a brand surface. Worth a 30-min design review with Reza on the actual SVG before E.2b ships.

---

## 5. Data contract

### 5.1 `WizardStateDelta` (agent tool output)

```ts
type WizardStateDelta = {
  topic:
    | 'welcome'
    | 'household'
    | 'entities'
    | 'properties'
    | 'debts'
    | 'accounts'
    | 'investments'
    | 'super'
    | 'assets'
    | 'income'
    | 'expenses';

  // Per-topic field subset. The agent can only populate fields that
  // belong to the current topic. Fields are typed at the gateway
  // boundary — numeric fields are `number | null`, never `string`.
  fields: Partial<Record<string, string | number | boolean | null>>;

  // Field names the user mentioned but the agent could not extract
  // a value for (ambiguity, missing context, conflicting statements).
  // Prompts the agent's NEXT message to ask a clarifying question.
  unresolved: string[];

  // Optional natural-language summary of what the agent heard. Used
  // ONLY to compose the recap card text — never written to the DB.
  // Sanitised — must not contain raw CDR values (the recap card
  // re-formats from `fields`, not from this string).
  rationale?: string;
};
```

The agent's tool can ONLY return this shape. Free-form replies are rejected at the gateway boundary. The Zod schema for `WizardStateDelta` is the single source of truth — the LLM provider's schema (Anthropic `input_schema` / Gemini `function_declarations`) is derived from the Zod schema.

### 5.2 Transcript + staged-state persistence (corrected 2026-05-17 build session)

Append-only JSON array stored on the existing `OnboardingState` row:

```ts
type ChatTranscriptEntry = {
  role: 'agent' | 'user';
  text: string;
  ts: number; // unix ms
};

// Stored as JSONB on OnboardingState (additive column —
// migration: `chatTranscript Json @default("[]")`).
type OnboardingState = {
  // ... existing fields unchanged
  chatTranscript: ChatTranscriptEntry[];
};
```

**Security posture:**
- Stored in the same security envelope as the rest of `OnboardingState` (encrypted at rest via CMEK when CMEK is enabled per CDR §3.3; not logged; deleted when the user revokes onboarding consent or via the CDR data-lifecycle sweep).
- Contains user-provided natural-language text — may include names, addresses, balances. Treated as CDR-derived data for retention purposes even though it predates CDR consent (since the data IS the user's financial picture).
- Audit metadata never references transcript content. The `ONBOARDING_AGENT_EXTRACTION` audit row contains `{ topic, deltaFieldNames }` — never the transcript text and never field values.

### 5.3 `source` tagging on the bulk-create payload

The bulk-create payload includes a `source` field per row (existing Track B convention — `source: ONBOARDING`). Chat-mode adds a discriminator on the rows it produces:

```ts
source: 'ONBOARDING_CHAT' // for chat-mode rows
source: 'ONBOARDING'      // for form-mode rows (existing — unchanged)
```

Reason: enables product analytics on chat-mode adoption + confidence calibration (per parent doc §3.5, confidence UI mapping). Existing form-mode behaviour is byte-for-byte unchanged.

## 6. Voice I/O strategy (v1)

**STT (speech-to-text)**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
- Browser-native, no audio leaves the device, no vendor credential, no CDR egress.
- Quality varies by browser — strongest in Chrome (Google's STT under the hood), weakest in Safari iOS (limited language support, no continuous mode).
- Text-only fallback always available — when the API is unavailable or fails, the mic button is hidden and the user types normally. The chat works without voice.
- Partial transcripts stream to the input field as the user speaks; the user confirms (Enter / send button) before the message is sent to the agent.

**TTS (text-to-speech, optional)**: Web Speech Synthesis API.
- OFF by default. User-controlled toggle.
- Voice quality is generally adequate for short agent replies. Browser-default voice; no voice selection in v1.
- Text bubbles remain the canonical channel even when TTS is on (TTS supplements, doesn't replace).

**Why NOT cloud STT in v1:**
- New CDR-relevant vendor (Whisper / Google STT) = new accreditation surface, new credential, new data-egress audit obligation.
- v1 user-experience benefit is not yet validated. Until v1 ships and feedback shows quality is the blocker, the added complexity isn't justified.
- See Q-CONV-1 below — cloud STT is a documented v2 option, not a foreclosed decision.

## 7. Security, CDR, and AFSL boundary

This section is the security-and-compliance lens on Track E. Every other section is also written through this lens; this section is the consolidation.

| Surface | Concern | Mitigation |
|---|---|---|
| LLM sees user's natural-language input (which may contain names, addresses, balances) | PII / CDR-derived data egress to a third party | Provider choice is reviewed (Anthropic / Google) — both are existing Monitrax dependencies with established CDR-compatibility posture (Phase 33g.2 feedback chat + tax-advisor surface already use them). Transcripts are NOT used for LLM provider training (Anthropic + Google's enterprise/API tier defaults exclude training on API content). No log retention beyond the provider's mandated minimum. |
| LLM hallucinates a number | False precision = financial-adviser failure (CLAUDE.md §0 + §12.14 HR-1) | Extraction-only tool calls; numeric fields typed at the gateway; per-topic recap confirmation; ReviewStep as the second checkpoint; user explicitly confirms before any DB write. |
| Audio recording leaves the device | New PII surface | Web Speech API only in v1 — no audio leaves the browser. |
| Agent provides personal financial advice | AFSL/TPB violation | Agent has NO advice-recommendation tool registered. The agent is structurally extractive only. AFSL boundary is preserved structurally, not by copy. |
| Chat transcript persists beyond consent | CDR retention violation | Transcript stored on `OnboardingState` row; deleted alongside the rest of `OnboardingState` when the user revokes consent or via the CDR data-lifecycle sweep (`lib/services/cdrDataLifecycle.ts` per CLAUDE.md §13.2). |
| Audit row leaks CDR values | CDR §13.3 violation | Every Track E audit row uses `sanitizeCdrMetadata()` and contains field NAMES only, never values. Test pinned. |
| Cost spike from a runaway session | Operational + economic risk | Daily turn cap per user enforced at the gateway (default 200/day). LLM token usage logged. Admin tile surfaces aggregate cost (E.5). |
| LLM provider outage breaks onboarding | New external dependency | Toggle defaults to form-mode. When the gateway returns an unrecoverable error, the chat surfaces a calm message — *"Our chat assistant is having a moment. Let's switch to the form for now."* — and switches the user to form-mode with their staged state intact. |
| Schema change required | CLAUDE.md §12.11 / §12.12 violation risk | Schema additions for Track E are additive only. v1 PR adds 3 enum values to `AuditAction` (`ONBOARDING_AGENT_EXTRACTION`, `ONBOARDING_AGENT_TOPIC_CONFIRMED`, `ONBOARDING_AGENT_MODE_SWITCHED`) via `ALTER TYPE ... ADD VALUE IF NOT EXISTS` — idempotent, no destructive ops, §12.11 N/A. Migration file ships in the same PR (§12.12). The chat transcript itself lives in client state only (correction: original plan named a non-existent `OnboardingState` Prisma model). |

## 8. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| E-R1 | Agent hallucinates a number the user did not give | Low (extraction tool + schema validation) | High (false financial data) | LLM constrained to extraction-only tool calls; per-topic recap requires explicit confirmation; numeric fields are typed at the gateway; ReviewStep is the final checkpoint. |
| E-R2 | User confirms a recap without reading it | Medium (humans skim) | Medium (wrong data lands) | Recap card explicitly lists every field; recap design uses generous spacing + clear typography (not a dense JSON dump); ReviewStep is a second checkpoint at the end of the entire conversation. |
| E-R3 | Web Speech API quality varies (Safari iOS) | High | Low (text fallback) | Text-first by default; mic is opt-in per turn; the chat works without voice. |
| E-R4 | LLM cost per session is higher than expected | Medium | Low–medium | Extraction-only tool calls produce small outputs (~200–500 tokens/turn); daily cap per user (200 turns/day) sets a ceiling; prompt-caching on the static step context reduces input tokens; admin tile surfaces aggregate cost (E.5). |
| E-R5 | LLM provider sees PII in the user's reply | Medium (inherent to the design) | Low (existing providers, established posture) | Anthropic + Google API tiers exclude training on API content; transcripts not shared beyond the provider; same posture as existing `lib/ai/tax-advisor/*` surfaces. |
| E-R6 | User abandons mid-conversation | Medium | Low | The staged WizardData fields persist via the existing `saveDraft()` → `UserPreference.onboardingDraft` path, so form-mode picks up where chat left off. The chat transcript itself is client-only in v1 — a hard reload restarts the chat (but the data already saved is preserved). Server-side transcript persistence is a follow-up if usage signals the loss matters. |
| E-R7 | "AI advisor" scope creep into the onboarding agent | Medium (tempting) | High (AFSL boundary risk) | Two separate gateways: `lib/ai/onboarding-agent/gateway.ts` (extractive only, one tool) vs `lib/ai/tax-advisor/gateway.ts` (FACT_LOOKUP / SCENARIO_RUN, AFSL-bounded). Never blend. Code-review enforcement. |
| E-R8 | Chat transcript contains sensitive PII at rest | Low | Medium | Encrypted at rest (CMEK when enabled); deleted via CDR data-lifecycle sweep; never logged. |
| E-R9 | Provider outage degrades UX | Low | Low (text fallback to form) | Toggle defaults to form-mode; calm fallback message on gateway error; form-mode is always available. |
| E-R10 | Schema-migration drift (chatTranscript column) | Low | High (R12-class incident) | §12.12 enforced — schema change + migration file in the same PR; additive column with default; rollback-safe. |
| E-R11 | **Persona drift** — a future PR adds an avatar, a name, a character voice, or emojis to the agent, eroding the "presence, not persona" design rule from §4a | Medium (tempting; persona is more meme-able) | High (AFSL-boundary fuzz + sub-brand drift + trust erosion if persona-claimed advice gets a number wrong) | §4a.6 explicit NO-list pinned in this doc; reviewer rejects any PR that adds avatar/name/character voice/emojis to the agent without an explicit Reza decision flipping the rule in §4a; the architecture below (PresenceOrb primitive, motion tokens, no name field anywhere in the schema or copy) makes persona-addition a deliberate architectural change rather than an incidental drift. Revisit only as a Phase 6 (consumer scale, post-Basiq) marketing-tone decision, never as a chat-avatar decision. |

## 9. Open questions for Reza

**Q-CONV-1 — Voice STT provider strategy for v2:**
v1 ships on the Web Speech API (browser-native, no audio leaves the device). For v2 we may want cloud STT (Whisper / Google STT) for better accuracy on Australian financial vocabulary and varied accents. The tradeoff is a new CDR-relevant vendor + new credential surface + new audit obligation.

**Claude recommendation:** stay on Web Speech API until v1 user feedback shows quality is the blocker. Re-open Q-CONV-1 if/when that signal arrives. Not blocking v1.

(Decision deferred to post-v1. Documented in `IMPLEMENTATION_PLAN.md` Open Questions.)

## 10. Validation checklist

Same as Track B validation (parent doc §12.3) plus the Track-E-specific items:

- [ ] Toggle between form-mode and chat-mode at any step preserves staged state in both directions.
- [ ] Agent never writes to a Prisma model directly. Verified by grep: no `prisma.*` calls inside `lib/ai/onboarding-agent/*` or `components/onboarding/wizard-chat/*`.
- [ ] Recap cards list every field the agent staged with the value the agent extracted. Pin-tested per topic.
- [ ] ReviewStep is the only write boundary. Verified by static analysis: `bulk-create` callers = `ReviewStep` only.
- [ ] Mode-switch and topic-confirmation events are audited with sanitised metadata (field names only, no values). Test pinned.
- [ ] Text-only fallback works when mic is unavailable. Tested in Safari iOS + an environment with mic permission denied.
- [ ] Daily LLM cost cap enforced at the gateway. Tested: 201st turn returns a rate-limit response.
- [ ] Feature flag default OFF. With flag OFF, `/onboarding` is byte-for-byte the existing experience.
- [ ] Dark mode parity with the form wizard. Tokens reused, no new scale.
- [ ] `prefers-reduced-motion: reduce` honoured — all chat animations respect the preference.
- [ ] Mobile responsive — 375px, 414px, 768px breakpoints render without horizontal scroll.
- [ ] D.0 design quality pass — clears every §7.2 criterion from the parent doc.
- [ ] CDR §13.3 — no CDR values in any Track E audit row.
- [ ] CDR §13.2 — chat transcript deleted alongside `OnboardingState` when consent is revoked or via the lifecycle sweep.
- [ ] AFSL boundary — agent's tool registry contains the single `extractWizardStepDelta` tool. No advice-recommendation tool exists.

## 11. Files: stay / new / never-touched

### 11.1 Files that STAY UNCHANGED (zero risk of regression)

| File | Reason |
|---|---|
| `components/onboarding/wizard/WizardContainer.tsx` | Form-mode wizard — Track E does not touch it. |
| `components/onboarding/wizard/ReviewStep.tsx` | Canonical pre-write review surface — Track E hands off to it unchanged. |
| `app/api/onboarding/bulk-create/route.ts` | Canonical write endpoint — Track E never calls it directly; ReviewStep does. |
| `app/api/onboarding/state/route.ts` | Existing state read/write — Track E's chat transcript persists via the existing `OnboardingState` pattern, no new endpoint. |
| `app/api/onboarding/estimates/*` | Track B estimate routes — Track E does not call them. |
| `lib/ai/tax-advisor/gateway.ts` | CFO / tax-advisor surface — separate gateway, separate concerns. |
| All 12 existing form steps under `components/onboarding/wizard/*Step.tsx` | Form-mode flow unchanged. |

### 11.2 Files that get EXTENDED (edits only)

| File | Edit |
|---|---|
| `app/onboarding/page.tsx` | Add mode toggle when `CONVERSATIONAL_ONBOARDING` flag is ON. Form-mode is the default. |
| `prisma/schema.prisma` | Additive in v1 PR: 3 new `AuditAction` enum values (`ONBOARDING_AGENT_EXTRACTION`, `ONBOARDING_AGENT_TOPIC_CONFIRMED`, `ONBOARDING_AGENT_MODE_SWITCHED`). Migration `20260517100000_phase_12_track_e_audit_actions/migration.sql` uses `ALTER TYPE ... ADD VALUE IF NOT EXISTS` — idempotent on dev, additive on prod. **Architectural correction**: original plan named `OnboardingState.chatTranscript` / `OnboardingState.firstChatEncounterAt` — but `OnboardingState` is not a Prisma model. v1 persists nothing transcript-related (client-only). E.2b may add `UserPreference.chatNotificationSoundEnabled` + a transcript-resume column if usage motivates it. |
| `lib/security/cdrAuditCompliance.ts` | Confirm `sanitizeCdrMetadata()` handles the new audit-action metadata shapes (no actual code change expected — additive metadata fields with sanitised values). |
| `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md` | Add "Related" line pointing to this doc. |
| `docs/IMPLEMENTATION_PLAN.md` | Add Up Next entry + Open Question `Q-CONV-1`. |
| `CLAUDE.md` | No edit required — Track E follows existing rules (§6, §12.2, §12.5, §13). |

### 11.3 Files that are NEW

| File | Phase | Purpose |
|---|---|---|
| `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` | E.6 | This doc. |
| `lib/ai/onboarding-agent/gateway.ts` | E.1 | Closed-discriminant gateway with the single `extractWizardStepDelta` tool. |
| `lib/ai/onboarding-agent/tools/extractWizardStepDelta.ts` | E.1 | Tool implementation: system prompt, schema, Anthropic + Gemini bindings. |
| `lib/ai/onboarding-agent/schemas/wizardStateDelta.ts` | E.1 | Zod schema for `WizardStateDelta` — single source of truth for the tool's output shape. |
| `components/onboarding/wizard-chat/ConversationalSetup.tsx` | E.2a | Top-level chat orchestrator (static in E.2a, gains first-encounter sequence in E.2b). |
| `components/onboarding/wizard-chat/ChatThread.tsx` | E.2a | Message stream renderer (gains thinking-pause + typewriter wiring in E.2b). |
| `components/onboarding/wizard-chat/AgentMessage.tsx` | E.2a | Agent reply bubble (static in E.2a, gains typewriter + adjacent `PresenceOrb` in E.2b). |
| `components/onboarding/wizard-chat/UserMessage.tsx` | E.2a | User reply bubble. |
| `components/onboarding/wizard-chat/ChatComposer.tsx` | E.2a | Text input + opt-in mic button (gains mic-level → orb-ripple sync in E.2b). |
| `components/onboarding/wizard-chat/TopicRecapCard.tsx` | E.3 | Per-topic confirmation card (gains staggered field-assembly + dim-on-recovery in E.2b). |
| `components/onboarding/wizard-chat/primitives/PresenceOrb.tsx` | E.2b | Canonical SVG presence element. Four states (idle / listening / thinking / settled). `prefers-reduced-motion` collapses to a static dot. File-header JSDoc per §16.4. Reusable across future AI surfaces (e.g. `/dashboard/cfo`). |
| `components/onboarding/wizard-chat/design/motionTokens.ts` | E.2b | Canonical SSOT for every animation duration/easing/stagger used in the chat surface (see §4a.1). Hard-coding values elsewhere is a code-review reject. |
| `components/onboarding/wizard-chat/design/audioTokens.ts` | E.2b | Canonical SSOT for the optional notification tone + Web Audio `AnalyserNode` config used by mic ripples. |
| `hooks/useVoiceInput.ts` | E.2a | Web Speech API STT wrapper with text-only fallback (audio-level analyser wiring added in E.2b). |
| `hooks/useVoiceOutput.ts` | E.2a | Web Speech Synthesis TTS wrapper (optional). |
| `prisma/migrations/<timestamp>_phase_12_track_e_chat_transcript/migration.sql` | E.0 | Additive: `chatTranscript Json @default("[]")` on `OnboardingState`. §12.12 enforced. |
| `prisma/migrations/<timestamp>_phase_12_track_e_audit_actions/migration.sql` | E.5 | Additive: 3 new `AuditAction` enum values. §12.12 enforced. |

### 11.4 Files that should NEVER be touched by this track

- `lib/services/masterFinancialService.ts` — chat-mode reads via the same API as form-mode (post-bulk-create); never directly.
- Any `lib/calculations/*` engine — chat-mode is an input layer, not a calc layer.
- Any `app/dashboard/*` page — chat-mode lives entirely under `/onboarding`.
- Any CDR / Basiq surface — chat-mode is manual data entry; Basiq integration is orthogonal.

## 12. Changelog

- **2026-05-17** — Doc created (rev 1). Plan locked. Build NOT started. Reza directive 2026-05-17: explore feasibility for a parallel conversational onboarding mode alongside the existing form wizard; no code changes; draft the plan first. Architect-mode synthesis converged on the "two front doors, one house" model: same data contract, same review screen, same write endpoint; chat-mode is a parallel input modality, not a parallel wizard.
- **2026-05-17 (rev 2)** — Design pass. Reza directive: *"make a very good animation, interactive, maybe engaging design… user sees the AI agent as sort of, like, a person… make your judgment."* Architect-mode synthesis (4-lens: financial / behavioural / architect / visual) concluded **presence, not persona**: lift the chat surface with rich micro-motion + warmth + rhythm, but do NOT anthropomorphise (no avatar, no name, no character voice). Rationale documented in §4a. Concrete additions to this doc: (a) new §4a "Visual & motion design" with seven sub-sections — why-this-answer, motion tokens (SSOT, ~17 tokens), `PresenceOrb` primitive (4 states + reduced-motion fallback), conversation rhythm (the three timing beats), first-encounter sequence (~1.2s, plays once per user), mistake-recovery transparency rule, NO-list (load-bearing dissent pinned), reference benchmarks, orb-as-canonical-AI-surface for future reuse; (b) E.2 split into **E.2a (static chat shell, validates the data loop)** + **E.2b (motion + presence orb, layered on once the loop works)** — phase order is now E.0 → E.1 → E.2a → E.3 → E.4 → E.2b → E.5 → E.6; (c) new risk row **E-R11 (Persona drift)** — pinned reviewer-reject rule for any future PR that tries to add avatar/name/character-voice/emojis to the agent; (d) §11.2 schema row gains `OnboardingState.firstChatEncounterAt` (pins the once-per-user first-encounter animation) + `UserPreference.chatNotificationSoundEnabled` (off by default; persists user's optional notification-tone preference); (e) §11.3 files-new table adds `PresenceOrb.tsx`, `motionTokens.ts`, `audioTokens.ts` under E.2b. References: Apple Intelligence + Siri waveform + Linear command palette + Mercury onboarding + Notion AI + Stripe sequential focus — explicitly NOT Cleo / Schwabby / Erica / Replika.
- **2026-05-17 (rev 3 — build session 1 of Track E)** — Status flipped 📋 → 🟡 IN FLIGHT. Reza directive: *"770 is merged let's go and start"* + *"no live users so you can go full steam"*. PR #2 ships the functional **Household-topic vertical slice** end-to-end behind the `CONVERSATIONAL_ONBOARDING` feature flag: E.0 (flag infrastructure mirroring `basiqGate`), E.1 (Anthropic gateway + `extractWizardStepDelta` tool with Zod-validated `WizardStateDelta` schema), E.2a-Household (static chat shell — `ConversationalSetup`, `ChatThread`, `AgentMessage`, `UserMessage`, `ChatComposer`, `TopicRecapCard` + `useVoiceInput` Web Speech API hook), E.3-Household (state-machine-driven scripted asks + recap card), E.4 (handoff to form-mode at step 1 with the staged Household data merged into `UserPreference.onboardingDraft`), E.5 (audit actions + sanitised metadata). E.2b motion polish + remaining topics queued for follow-up PRs. **Architectural correction** captured in §5.2 + §8 + §11.2: the rev-1 plan named a non-existent `OnboardingState` Prisma model as the chat persistence target; v1 corrects to keep transcript in client state only and persist staged WizardData via the existing `saveDraft()` → `UserPreference.onboardingDraft` path. v1 ship list: 3 feature-flag files + 1 admin-route + 1 layout edit + 1 toggle component + 1 voice hook + 3 onboarding-agent files (gateway + schema + tool) + 2 API endpoints (extract + topic-confirmed) + 7 chat-UI components + 1 page edit + 1 schema migration (3 additive `AuditAction` enum values).
- **2026-05-17 (rev 4 — build session 2 of Track E: E.2b motion polish shipped)** — Reza directive: *"Continue"* — after PR #771 (rev 3 functional Household slice) merged. PR #3 ships the **E.2b "presence, not persona" visual identity** layer over the working chat loop. New files: (a) `components/onboarding/wizard-chat/design/motionTokens.ts` — canonical SSOT for every animation duration / easing / stagger (`MESSAGE_FADE_IN_MS`, `THINKING_PAUSE_MIN/MAX_MS`, `TYPEWRITER_CHARS_PER_SEC`, `RECAP_FIELD_STAGGER_MS`, `RECAP_CARD_RISE_MS`, `RECAP_CTA_DELAY_MS`, `ORB_BREATHE_MS`, `ORB_THINKING_SHIMMER_MS`, `ORB_SETTLED_GLOW_MS`, `MISTAKE_RECOVERY_DIM_OPACITY`) + `useReducedMotion()` hook + `jitteredThinkingPauseMs()` helper. Hard-coding values elsewhere = code-review reject. (b) `components/onboarding/wizard-chat/primitives/PresenceOrb.tsx` — canonical SVG primitive, 4 states (`idle` / `listening` / `thinking` / `settled`), warm-ivory iridescent overlay, file-header JSDoc per §16.4, reduced-motion → static 4px dot. (c) `components/onboarding/wizard-chat/design/presenceOrb.css` — keyframes for the 4 orb states + defense-in-depth `@media (prefers-reduced-motion: reduce)` killswitch. Component changes: `AgentMessage` gains typewriter render (35 chars/sec, word-boundary ease, jittered ±15%, cursor caret while typing); `ChatThread` anchors a single PresenceOrb to the latest agent message (older agent messages render plain — one orb at a time = no visual noise), flips orb state `thinking → settled → idle` on typewriter completion, renders a standalone thinking-orb block before the very first agent turn; `TopicRecapCard` gains staggered field reveal (`RECAP_FIELD_STAGGER_MS` apart, document order) + delayed CTA enable (`RECAP_CTA_DELAY_MS` after last field settles — prevents reflex-tap-confirm-without-reading); `ConversationalSetup` adds pre-typewriter pause (jittered 600–800ms after API response BEFORE appending agent message — the "I'm reading what you said" beat), tracks `newestAnimatedMessageId` so only freshly-appended messages typewrite, implements full mistake-recovery dim-and-keep trail (snapshots prior recap into `historicalRecaps[]` on "Change something"; dimmed snapshots render above the active recap as a visible audit trail). Doc-sync: `06_UI_UX_FOUNDATION.md` §14 pointer + reuse policy + NO-list pin; `08_BRAND_UI_DESIGN.md` "AI surface visual identity" pointer to §4a. Deferred to **E.2b.2** (needs schema additions or web-audio wiring): first-encounter sequence persistence (needs `UserPreference.chatFirstEncounterAt` column), optional notification tone toggle (needs `UserPreference.chatNotificationSoundEnabled`), mic-level → orb-ripple sync (needs Web Audio `AnalyserNode` wiring through `useVoiceInput`). tsc clean. No schema changes. No CDR posture change.
- **2026-05-17 (rev 5 — build session 3 of Track E: Properties topic shipped)** — Reza directive: *"continue"* — after PR #773 (E.2b motion polish) merged. PR #4 ships the **second chat topic — Properties** — chaining Household → Properties as a continuous conversation that ends with a handoff to form mode at the debts step (`currentStep = 4`). New files: `lib/ai/onboarding-agent/schemas/wizardStateDelta.ts` extends the discriminated union with `propertiesStateDeltaSchema` (`{ name, type?, currentValue?, hasLoan? }` per property, max 10; `ownsProperty` sentinel for "no property" path); `lib/ai/onboarding-agent/tools/extractWizardStepDelta.ts` adds `PROPERTIES_SYSTEM_PROMPT` with full AU vocabulary mapping (HOME/PPOR/principal-place-of-residence/etc. → HOME; investment-property/IP/rental → INVESTMENT; number normalisation 850k/1.2m/$850,000 → integer AUD; positional-merge rule echoing all staged properties on every turn; no advice / no market commentary); `components/onboarding/wizard-chat/propertiesScript.ts` (state machine — INTRO → ASKING_OWNERSHIP → ASKING_PROPERTY_TYPE/VALUE/LOAN per incomplete property → ASKING_MORE → RECAP, with 2-retry loop-break protection). Component changes: `ConversationalSetup.tsx` refactored to be topic-aware (`chatTopic: 'household' | 'properties'`; per-topic script states; `handleSubmit` routes to the right script + system prompt; `handleConfirm` pivots `household → properties` instead of redirecting, then on `properties` confirm saves merged WizardData + redirects to form mode at currentStep=4; `historicalRecaps` keyed by topic so the mistake-recovery trail labels correctly). `app/api/onboarding/chat/extract/route.ts` + `app/api/onboarding/chat/topic-confirmed/route.ts` accept both topics. **What chat captures per property (bare minimum):** name, type (HOME/INVESTMENT), currentValue (integer AUD), hasLoan (flag only). **What chat does NOT capture (deferred to form mode):** address (form validates AU address format), purchasePrice (defaults to currentValue on bulk-create), purchaseDate / acquisitionContractDate (Phase 41E reform context — date picker is better than ear), isNewBuild + newBuildEvidence (compliance-sensitive; form gates correctly), loan details / rental income / expenses (separate steps in form). **Hard rules verified**: agent never writes to Prisma directly (grep-verified); per-property numeric extraction from user only (Zod rejects strings in numeric fields; system prompt mandates; LLM omits unstated values); positional-merge prevents property duplication; AFSL boundary structural (no advice tool registered; system prompt explicitly forbids commentary on market / valuations / suburb quality). Phase order now E.0 → E.1 → E.2a (Household + Properties) → E.3 (recap cards) → E.4 (form-mode handoff) → E.2b (motion) → E.5 (audit) — same phases, expanded scope. tsc clean.
