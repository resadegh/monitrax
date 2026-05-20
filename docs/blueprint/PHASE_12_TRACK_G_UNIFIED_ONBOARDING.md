# Phase 12 Track G — Unified Conversational Onboarding

> **Status:** 🟡 IN PROGRESS — G.0 (companion prototype, household step) 🟢 building 2026-05-20. G.1–G.5 queued.
> **Author:** Claude, 2026-05-20. **Owner:** Reza.
> **Driver:** Reza, 2026-05-20 — *"having these two separated is not the best idea … the AI chat is clunky, doesn't get the questions, and it just breaks. And the form is very dry, old-school. Combine these two together … the AI lives there actively … and the form also opens underneath to capture the questions and answers, and AI reads that information and provides feedback. I want this engaging, clean, modern."*
> **Supersedes:** Track F's queued **F.10** (conversational enrichment) — see §7. **Re-sequences** F.9 — see §6 / §8.

---

## 1. Problem

Monitrax onboarding ships **two separate experiences** for the same job — populating the user's financial data:

1. **The form wizard** (`components/onboarding/wizard/`) — a robust 12-step form. Reliable, validated, fully wired to the real tables (Track F). But **dry** — a tax-spreadsheet feel, no guidance, no warmth.
2. **The AI chat** (`components/onboarding/wizard-chat/`) — a conversational path: 8 per-topic state machines (`householdScript.ts` …) + an LLM extraction engine. **Brittle** — it does structured data capture through free-form NLP, so it "doesn't get the questions" and "breaks". It already gives up and hands the user to the *form* for its final review step.

Two implementations of one job is a CLAUDE.md §12.1 (zero-tolerance for bloat) / §12.3 (no competing implementations) violation. The user must also *choose* a path up front (`OnboardingModeSelector`) — a decision they have no basis to make.

The chat is brittle for a structural reason: **a typed form field cannot "not understand" an answer; free-form extraction can.** The form is dry for a structural reason: **it has no guide.** They are complementary, not competing.

## 2. Why it matters

A dry form loses users at the highest-friction moment of the product (onboarding = TRAIL stage **T, Track**). A brittle chat loses *trust* — if the AI fumbles "two kids and a dog", the user assumes the whole product is flaky. Merging them lets each do what it is structurally good at: the **form is the skeleton** (reliable, validated capture that cannot break); the **AI is the soul** (warmth, narration, "why this matters", reflection). The result is the form's reliability *and* the chat's engagement — and it removes an architecture violation rather than adding one. The growth lens adds urgency: onboarding friction is where activation is won or lost, and a guided, human setup is a real first-session win.

## 3. The decision (Reza, 2026-05-20)

**One onboarding surface.** The form wizard is the system of record for capture. An AI **companion** lives alongside it: per step it introduces the domain in TRAIL language, explains *why it matters*, reads what the user has entered, and reacts with warm reflection and encouragement.

**Guide-only for v1.** The companion narrates + reflects; the user fills the form fields. The brittle free-form *extraction* path is retired from the critical path. The "type a sentence and watch the fields fill" accelerator is **deferred** (G.4) — additive magic to be re-introduced on a stable base, never carried through the rebuild.

**The companion is a guide, not an adviser.** It reflects, normalises, encourages, and explains the product. It **never** gives financial advice, tax tips, or investment opinions (AFSL boundary — consistent with the onboarding agent's existing "no advice surface" contract, `lib/ai/onboarding-agent/gateway.ts` header, and PHASE_12 §10.2).

## 4. Target architecture

| Disposition | What |
|---|---|
| **Keep — untouched** | The 12-step form wizard spine (`WizardContainer`, the step components), `WizardData`, the Track F `lib/onboarding/*Sync.ts` real-table layers. The reliability is the asset; we do not rebuild it. |
| **Evolve** | `AIHelper.tsx` (today: a passive Q&A drawer with **mocked** responses) → an active, docked **companion** that narrates each step and reads the user's entries. G.2 folds its question-answering into the companion. |
| **Add** | `CompanionPanel` (the docked companion UI) · `companionGateway.ts` (a warm, bounded, AFSL-safe reflection LLM call) · `/api/onboarding/companion` (the route). |
| **Delete (G.2)** | The 8 chat script state-machines, `ConversationalSetup.tsx`, the `wizard-chat/` chat UI, `OnboardingModeSelector`, `ConversationalModeToggle`, the `CONVERSATIONAL_ONBOARDING` flag. Net **dead-code removal**. |
| **Defer (dormant)** | The extraction gateway + delta schemas + per-topic extract tools — kept, not deleted. Re-used by the G.4 accelerator. |

## 5. The companion contract

- **Voice.** Warm, calm, brief (≤2 sentences per reflection). Australian English. Warm-words rule (CLAUDE.md §14 — "spending" not "expenses", "home" not "PPOR"). Celebrates the small win of finishing a step. Normalises, never shames.
- **What it does.** (a) A scripted, instant **intro** per step — *why this step matters*, no LLM, never fails. (b) An LLM **reflection** that reads what the user entered and reacts.
- **What it never does.** Financial advice, tax/investment opinions, "you should…", any number it was not given. It is extraction-free and advice-free.
- **What it sees — minimal, de-identified.** The companion is sent a **counts/roles/flags snapshot**, never raw PII or CDR values. Household → `{memberCount, incomeEarnerCount, childCount, adultCount, petCount, carCount}`. Never member names, never balances. This is a load-bearing security-lens decision: the reflection is warm without names, and the data-egress surface to Anthropic stays minimal. CDR-imported actuals are never sent (consistent with the F-reconcile-handoff decision — onboarding is the *plan*, not the actuals).
- **Never a dependency.** Every companion call degrades gracefully. Slow, failed, rate-limited, or AI-disabled → the scripted intro stays, the form works perfectly. The companion is enhancement; the form is never gated on it. *This is the structural fix for "it breaks."*
- **Model.** `claude-haiku-4-5` — a short warm reflection is well within Haiku's range, and Haiku's lower latency makes the companion feel responsive. (Extraction needs Sonnet for schema reliability; reflection does not.)

## 6. Build sequence (each PR independently shippable)

| PR | Scope |
|---|---|
| **G.0** | **Companion prototype — household step only.** `CompanionPanel` + `companionGateway` + `/api/onboarding/companion`, wired into the household step. A real, deployable proof of the concept for Reza to evaluate **before** the full build. |
| **G.1** | Roll the companion to all 12 steps — per-step scripted intros + per-step reflection context. |
| **G.2** | Retire the standalone chat — delete the script state-machines, `ConversationalSetup`, the mode-selector + toggle, the feature flag. Fold `AIHelper`'s Q&A into the companion. Onboarding entry → wizard only. |
| **G.3** | Fold in Track F's **F.9** — retire `/api/onboarding/bulk-create` + drop entity data from `UserPreference.onboardingDraft`. Sequenced here because G.2 removes the chat's write path; doing F.9 first would be wasted motion. |
| **G.4** | *(later)* The optional "describe it in your own words" accelerator — repurpose the dormant extraction gateway as a form pre-fill, form always primary. |
| **G.5** | *(later)* Document upload (was F.11) — upload a payslip / rates notice, the companion reads it. |

## 7. F.10 / F.11 disposition

- **F.10 (conversational enrichment) — SUPERSEDED.** F.10 was specified as new "follow-up-offer states" bolted onto the chat **script state machines** (PHASE_12 §10). G.2 deletes those machines, so F.10 *as specified* is redundant. Its *intent* — progressively offering optional enrichment fields so day-one data is more complete — is **absorbed into Track G**: the companion nudges, and the form reveals an optional field (progressive disclosure on the reliable surface). Cleaner than the chat version. F.10 is closed as superseded; the §10.2 four-lens constraints (cap the chain, equal-weight "Skip", advice-impact priority, AFSL-neutral copy) carry forward into the Track G companion.
- **F.11 (document upload) — RE-HOMED, not redundant.** A distinct capability (the document pipeline). Re-parented from "mid-chat" to "mid-onboarding companion" as **G.5**. Still deferred.

## 8. Risks / considerations

- **The companion must never become a dependency.** Enforced by §5: graceful degradation on every call. If this slips, we have re-created the brittleness we are removing.
- **AFSL boundary.** "Feedback" must stay reflection/encouragement/product-explanation — never advice. The companion system prompt hard-codes this; reviewers must check reflection copy stays neutral.
- **Cognitive load.** The panel must be calm — 1–2 message bubbles, not a chat log. Financial stress already costs the user ~13 IQ points (Mani et al., CLAUDE.md §0); the companion gives clarity back, it does not add a second thing to read.
- **Layout.** G.0 places the companion as a full-width card **above** the form ("the form opens underneath" — Reza's words) — zero disruption to the wizard shell, identical on mobile and desktop. A desktop side-rail is a G.1 refinement once the wizard shell is widened.
- **Cost / rate-limit.** Reflections are LLM calls. G.0 caps them: the snapshot is counts-only, so reflections fire on *structural* changes (a member added), not keystrokes; a client-side debounce + signature-dedup + the server daily cap bound spend.
- **`IMPLEMENTATION_PLAN.md` + Track F.** Track G re-sequences F.9 (now G.3) and supersedes F.10. The plan is updated in the G.0 PR.

## 9. G.0 — what the prototype ships

- `components/onboarding/wizard/CompanionPanel.tsx` — the docked companion. Scripted household intro (instant) + an auto-fetched reflection that reads the de-identified household snapshot.
- `lib/ai/onboarding-agent/companionGateway.ts` — `generateCompanionReflection()`: a warm, bounded, advice-free Haiku call.
- `app/api/onboarding/companion/route.ts` — `POST`, `withPermission('settings.write')`, the standard `{success,data,error,meta}` envelope, a daily cap, graceful failure.
- `WizardContainer.tsx` — renders `CompanionPanel` above `HouseholdStep`; the header "Need help?" trigger is suppressed on the household step (the companion is the help there).
- Scope is **household only** so Reza can evaluate the concept before G.1 rolls it everywhere.

---

*Track G supersedes PHASE_12 F.10 and re-sequences F.9 → G.3. See `IMPLEMENTATION_PLAN.md` Up Next for live status.*
