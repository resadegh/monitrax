# Phase 12 Track G — Unified Conversational Onboarding

> **Status:** 🟡 IN PROGRESS — G.0 ✅ (PR #845, +hotfix #846) · G.1a ✅ (companion on the household step — paced one-line-at-a-time + accent glow + typewriter; PRs #847/#848/#849) · G.2 ✅ (standalone chat retired) 2026-05-21. **G.1b 🟢 next** — roll the companion to all 12 steps. G.3–G.5 queued.
> **Author:** Claude, 2026-05-20. **Owner:** Reza.
> **Driver:** Reza, 2026-05-20 — *"having these two separated is not the best idea … the AI chat is clunky, doesn't get the questions, and it just breaks. And the form is very dry, old-school. Combine these two together."* Scope sharpened 2026-05-21 — see §3.
> **Supersedes:** Track F's queued **F.10** (conversational enrichment) — see §7. **Re-sequences** F.9 — see §6.

---

## 1. Problem

Monitrax onboarding ships **two separate experiences** for the same job — populating the user's financial data:

1. **The form wizard** (`components/onboarding/wizard/`) — a robust 12-step form. Reliable, validated, fully wired to the real tables (Track F). But **dry** — a tax-spreadsheet feel, no guidance, no warmth.
2. **The AI chat** (`components/onboarding/wizard-chat/`) — a conversational path: 8 per-topic state machines (`householdScript.ts` …) + an LLM extraction engine. **Brittle** — it does structured data capture through free-form NLP, so it "doesn't get the questions" and "breaks". It already gives up and hands the user to the *form* for its final review step.

Two implementations of one job is a CLAUDE.md §12.1 (zero-tolerance for bloat) / §12.3 (no competing implementations) violation. The user must also *choose* a path up front (`OnboardingModeSelector`) — a decision they have no basis to make.

The chat is brittle for a structural reason: **a typed form field cannot "not understand" an answer; free-form extraction can.** The form is dry for a structural reason: **it has no guide.** They are complementary, not competing.

## 2. Why it matters

A dry form loses users at the highest-friction moment of the product (onboarding = TRAIL stage **T, Track**). A brittle chat loses *trust* — if the AI fumbles "two kids and a dog", the user assumes the whole product is flaky. Merging them lets each do what it is structurally good at: the **form is the skeleton** (reliable, validated capture that cannot break); the **companion is the soul** (warmth, narration, "why this matters", reflection). The result is the form's reliability *and* the chat's engagement — and it removes an architecture violation rather than adding one. The growth lens adds urgency: onboarding friction is where activation is won or lost, and a guided, human setup is a real first-session win.

## 3. The decision

**One onboarding surface.** The form wizard is the system of record for capture. An AI **companion** hosts it: per step it invites the user to act, reads what they entered, reacts warmly, and hands off to the next step.

**Scope — the companion *guides*; it does not chat freely (Reza, 2026-05-21).** The onboarding companion's only job is to *lead the user through setup* — *"let's start with your household"*, *"now tell me about your properties"* — react to what they enter, and bridge to the next step. It is **push-only**: it does not field free-form questions and does not answer complex queries. The *full* conversational AI — the one the user talks *with* and asks anything — belongs to **My Guide** (TRAIL stage L), a **separate surface, explicitly out of Track G scope**. Keeping onboarding tightly scoped — guide + form, nothing else — is what keeps it fast, reliable, and un-intimidating. (An earlier 2026-05-21 proposal to add a Q&A composer to the onboarding companion was considered and **rejected** for this reason.)

**Guide-only — no extraction.** The companion narrates, reacts and bridges; the user fills the form fields. The brittle free-form *extraction* path is retired. The "type a sentence and watch the fields fill" accelerator is **deferred** (G.4) — additive magic for a stable base, never carried through the rebuild.

**The companion is a guide, not an adviser.** It invites, reflects, normalises, encourages, and explains the product. It **never** gives financial advice, tax tips, or investment opinions (AFSL boundary — consistent with `lib/ai/onboarding-agent/gateway.ts` header + PHASE_12 §10.2).

## 4. Target architecture

| Disposition | What |
|---|---|
| **Keep — untouched** | The 12-step form wizard spine (`WizardContainer`, the step components), `WizardData`, the Track F `lib/onboarding/*Sync.ts` real-table layers. The reliability is the asset; we do not rebuild it. |
| **Add** | `CompanionPanel` (the companion that hosts each step) · `companionGateway.ts` (a warm, bounded, AFSL-safe reflection LLM call) · `/api/onboarding/companion` (the route). |
| **Delete (G.1b)** | `AIHelper.tsx` — today a passive Q&A drawer with **mocked** responses. The onboarding companion does not do Q&A (§3), so AIHelper is not evolved — it is removed. |
| ~~Delete (G.2)~~ | ✅ **DONE 2026-05-21** — deleted the 8 chat script state-machines, `ConversationalSetup.tsx`, the `wizard-chat/` chat UI, `OnboardingModeSelector`, `ConversationalModeToggle`, and the `CONVERSATIONAL_ONBOARDING` flag (gate lib + context + public API route + seed entry + admin special-case). 24 files removed. Onboarding entry → wizard only. |
| **Defer (dormant)** | The extraction gateway + delta schemas + per-topic extract tools — kept, not deleted. Re-used by the G.4 accelerator. |

## 5. The guided-conversation model — the companion as host

Onboarding is reframed from "a 12-step form with a helper" into **a guided conversation the companion hosts**. Same 12 steps, same reliable forms underneath — but the experience becomes one continuous, narrated journey. Each step is one *beat* in that conversation, and every beat has three companion moves:

| Move | What | How it's produced |
|---|---|---|
| **Invitation** | The companion opens the step with a warm, human invitation to act — *"Let's start with the people who share your home — add everyone below."* Not a form header. | **Scripted** per step. Instant, never fails. |
| **Reaction** | Once the user has entered something, the companion reads it and responds with something true and warm — *"A family of four, two of you earning — a solid base."* | **LLM** (`generateCompanionReflection`, Haiku). Reads a counts-only snapshot. |
| **Bridge** | The companion acknowledges the step is done and hands off to the next — *"That's your household mapped. Next, let's look at where your money lives."* This connective tissue is what turns 12 forms into one conversation. | **Scripted**; names the next step. |

Two further moves make it feel alive across the whole journey (G.1b):

- **Memory** — later steps reference earlier answers, read **deterministically** from `WizardData` (*"you mentioned two kids — I've made sure their costs have a home"*). No LLM, no guesswork — the system visibly listening.
- **Adaptive narration** — when the wizard skips a step (a renter has no property step), the companion *says so* — *"Since you're renting, we'll skip straight to your savings."* The user feels it tailoring to them, not just hiding fields.

### Presentation — paced, one line at a time

The companion shows **one line at a time**, not a stacked chat thread (Reza, 2026-05-21 — *"rather than a text message feel"*): a single **companion line** that swaps *in place* as the beat advances (greeting → invitation → reaction → bridge), plus a single compact **"you" line** summarising what the user has entered (e.g. *"2 adults · 3 pets · 3 cars"*). A phase machine drives the sequence and **always starts at the greeting on mount** — so a returning user with existing data sees the conversation *play out in order, paced*, never jump straight to the end. This keeps the panel short (critical on mobile) and makes it read as a live exchange, not a transcript. Each companion line is **one sentence** — the LLM reaction is capped at one short sentence server-side.

**Visual treatment — accent, not a soft card (Reza, 2026-05-21).** The companion must read as *the* AI surface, not blend into the page. It carries an Apple-Intelligence-style accent **glow halo**, a crisp lifted card (indigo-tinted shadow + ring), and a larger companion line. Each line **types out** character-by-character with a blinking caret — the modern-AI "typing" feel. The reaction is preceded by a typing-dots indicator (think → speak). All motion honours `prefers-reduced-motion`.

### The contract (invariants)

- **Voice.** Warm, calm, brief. Australian English. Warm-words rule (CLAUDE.md §14 — "spending" not "expenses", "home" not "PPOR"). Celebrates small wins, normalises, never shames.
- **Push-only.** The companion leads + reacts + bridges. It does **not** field free-form questions (that is My Guide — §3), and it does **not** do extraction — the user fills the form.
- **Never advice.** No financial advice, tax tips, investment opinions, or "you should…". Guide, not adviser (AFSL boundary).
- **Minimal, de-identified data.** The companion is sent a **counts/flags snapshot** — never names, never balances, never CDR values. Household → `{memberCount, incomeEarnerCount, childCount, adultCount, petCount, carCount}`.
- **Never a dependency.** Every LLM call degrades gracefully — slow, failed, or AI-disabled, the scripted invitation + bridge stay and the form works perfectly. *This is the structural fix for "it breaks."*
- **Model.** `claude-haiku-4-5` — fast, warm, well within range for a short reflection.

## 6. Build sequence (each PR independently shippable)

| PR | Scope |
|---|---|
| **G.0** | ✅ **DONE** (PR #845 + auth hotfix #846) — static companion prototype on the household step: `CompanionPanel` + `companionGateway` + `/api/onboarding/companion`. |
| **G.1** | **The conversational guide.** The companion becomes the host of each step — invitation + reaction + bridge (§5). **G.1a** (this PR) — the household step in the guided-conversation style, for Reza to merge + evaluate. **G.1b** — roll to all 12 steps + memory + adaptive narration; remove `AIHelper`. |
| ~~G.2~~ | ✅ **DONE 2026-05-21** — retired the standalone chat: deleted the 8 script state-machines, `ConversationalSetup` + the `wizard-chat/` UI, the mode-selector + toggle, the `CONVERSATIONAL_ONBOARDING` flag (gate + context + route + seed). Onboarding entry → wizard only. The extraction gateway / tools / schemas + the `chat/extract` route are kept **dormant** for G.4. |
| **G.3** | Fold in Track F's **F.9** — retire `/api/onboarding/bulk-create` + drop entity data from `UserPreference.onboardingDraft`. Sequenced here because G.2 removes the chat's write path. |
| **G.4** | *(later)* The optional "describe it in your own words" accelerator — repurpose the dormant extraction gateway as a form pre-fill, form always primary. |
| **G.5** | *(later)* Document upload (was F.11) — upload a payslip / rates notice, the companion reads it. |

## 7. F.10 / F.11 disposition

- **F.10 (conversational enrichment) — SUPERSEDED.** F.10 was specified as new "follow-up-offer states" bolted onto the chat **script state machines** (PHASE_12 §10). Track G deletes those machines. Its *intent* — progressively offering optional enrichment fields — is **absorbed into Track G**: the companion nudges, the form reveals an optional field (progressive disclosure on the reliable surface). The §10.2 four-lens constraints carry forward.
- **F.11 (document upload) — RE-HOMED, not redundant.** Re-parented from "mid-chat" to "mid-onboarding companion" as **G.5**. Still deferred.

## 8. Risks / considerations

- **The companion must never become a dependency.** Enforced by §5: graceful degradation on every call. If this slips, we have re-created the brittleness we are removing.
- **AFSL boundary.** The reaction must stay reflection/encouragement/product-explanation — never advice. The companion system prompt hard-codes this; reviewers check reflection copy stays neutral.
- **Cognitive load.** The companion shows **one line at a time** (not a stacked thread) — each line one short sentence, paced, swapped in place. Calm by construction; the panel never grows into a wall of text. Financial stress already costs the user ~13 IQ points (Mani et al., CLAUDE.md §0); the companion gives clarity back.
- **Scope creep.** The onboarding companion is push-only by design (§3). Any pull toward "let the user ask it things" must be resisted and routed to My Guide — otherwise we re-grow the brittle free-form surface we are removing.
- **Layout.** G.0/G.1a place the companion as a full-width card **above** the form ("the form opens underneath" — Reza). A desktop side-rail is a possible G.1b refinement once the wizard shell is widened.
- **Cost / rate-limit.** Reflections are LLM calls. The snapshot is counts-only, so reflections fire on *structural* changes (a member added), not keystrokes; a client-side debounce + signature-dedup + the server daily cap bound spend. Invitation, bridge and memory are scripted/deterministic — zero LLM cost.

## 9. G.1a — what this prototype ships

The **household step**, rebuilt in the guided-conversation style (§5) — for Reza to merge, try, and react to before G.1b rolls it across all 12 steps.

- `components/onboarding/wizard/CompanionPanel.tsx` — the step's **host**, as a **paced, one-line-at-a-time** exchange: a phase machine (greeting → invitation → reaction → bridge) that always starts at the greeting on mount and advances on timers/events; one companion line + one compact "you" line, both swapped in place (no stacked thread). A "typing" indicator covers the reaction fetch.
- `components/onboarding/wizard/WizardContainer.tsx` — passes the next step's label so the bridge is concrete.
- `lib/ai/onboarding-agent/companionGateway.ts` — the reaction prompt capped at **one short sentence** (≤18 words).
- `styles/wizard-animations.css` — `companion-bubble-enter` (line swap) + `companion-typing-dot` (typing indicator); both respect `prefers-reduced-motion`.
- Scope is the **household step only**; `AIHelper` stays on the other 11 steps until G.1b removes it.

### Pacing iteration (2026-05-21)

The first G.1a build stacked all four turns as a chat thread and, for a returning user with existing data, showed them all at once — the conversation "jumped to the end". Fixed: the phase machine resets to the greeting on every mount and paces the sequence; the panel now shows one line at a time, replaced in place — *"rather than a text message feel"* (Reza).

### Accent + typewriter iteration (2026-05-21)

Reza feedback on the paced build: *"the ai box is not visible enough … same font size and shape … blending into the whole page … needs to be accent and bold … Apple-like … feels modern when the text is typing."* Fixed: the companion card now has an accent **glow halo** + a lifted crisp surface (indigo shadow + ring), a larger companion line, and each line **types out** with a blinking caret. `companion-glow` + `companion-caret` keyframes added to `wizard-animations.css`; all motion respects `prefers-reduced-motion`.

---

*Track G supersedes PHASE_12 F.10 and re-sequences F.9 → G.3. See `IMPLEMENTATION_PLAN.md` Up Next for live status.*
