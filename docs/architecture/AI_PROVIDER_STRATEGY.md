# AI provider strategy — Gemini vs Claude vs (future)

> **What this is:** the engineering position on LLM-provider choice for the Monitrax AI advisor. Written 2026-05-13 in response to Reza's question: *"I would like you to review the monitrax AI function currently using Gemini ai. I wonder if it would make sense to change it to Claude ai engine?"*
>
> **What this is not:** a benchmark, a sales pitch, or a final decision. The decision is owned by Reza; this doc lays out the facts so it can be made calmly.
>
> **TL;DR:** The boundary that makes the Monitrax advisor safe — HR-1 (numbers from the app), HR-2 (claims from AU law), D-2 (no recommendations) — is **architectural, not provider-dependent**. Swapping LLMs does not change the answer the user sees by anywhere near as much as the tool registry does. The provider interface (`lib/ai/tax-advisor/providers/types.ts`) was deliberately written provider-agnostic; adding a `ClaudeProvider` is a one-file change. **Recommendation: keep Gemini 2.0 Flash as the default for the main tax-advisor surface; pilot Claude on a specific high-conversational surface where the existing Anthropic dep from Phase 33g.2 already provides cost control.**

> ### 🔴 STATUS UPDATE 2026-07-01 — Anthropic/Claude DISABLED, Monitrax is Gemini-only
> Reza directive (2026-07-01, on receiving a ~US$26.54/mo Sonnet bill): *"disable that and only stay on gemini for simplicity."* The four non-advice Claude call sites (onboarding chat extract on Sonnet; onboarding companion, feedback triage, and anomaly narrator on Haiku) are switched **OFF** via a code-default kill-switch: `isAnthropicConfigured()` (`lib/ai/anthropic.ts:62`) now requires `ANTHROPIC_ENABLED === 'true'` and defaults OFF, so it fails **closed** — zero Claude spend even with `ANTHROPIC_API_KEY` still set. Every call site degrades gracefully (onboarding chat → form-only wizard; companion → scripted intro; feedback → form-only drawer; anomaly narrator → deterministic copy). The tax-advisor / CFO surface was **already Gemini-only** (no `claudeProvider.ts` was ever built), so no advice surface is affected. The `@anthropic-ai/sdk` dep is retained; re-enable is a one-flag change (`ANTHROPIC_ENABLED=true`). The provider-agnostic analysis below remains accurate as the record of *why a swap is cheap* — it is not a live recommendation to run Claude.

**Anchors:** `lib/ai/tax-advisor/providers/types.ts` (provider interface), `lib/ai/tax-advisor/gateway.ts` (10-step pipeline), `lib/ai/tax-advisor/policy/validators.ts` (HR-1/HR-2/D-2 runtime enforcement), `lib/ai/tax-advisor/registry.ts` (closed `FACT_LOOKUP | SCENARIO_RUN` discriminant), `lib/ai/anthropic.ts` (Phase 33g.2 — existing Anthropic dep + cost cap), `lib/ai/gemini.ts` (Document Intelligence), `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §5 + §11.1 (AFSL boundary + Phase 41h tool sequence), `docs/blueprint/PHASE_41E_REFORM_2026_27.md` (companion doc — reform-aware tools land in the same registry), CLAUDE.md §0 (advisory mindset), §12.7 (GCP-first).

---

## 1. What the question is actually asking

Reza's question has two parts that look similar but are different problems:

**Part A — "Which LLM is best for the AI math + advice surface?"**
This is the surface question and the easy half. Math, citation handling, and conversational quality vary across models; the gap is real but smaller than people assume once the model is wrapped in a structured tool harness.

**Part B — "Can the AI advise on whether to sell a property under the new tax rules, or restructure into a trust / company?"**
This is the load-bearing question and the hard half. **The answer doesn't depend on the LLM — it depends on the architecture.** Phase 41 already decided (D-2): the AFSL / TPB / NCCP boundary is enforced *structurally*, by the tool registry having no `RECOMMENDATION` kind, not by prompt disclaimers. No LLM — Gemini, Claude, GPT-5, anything — can recommend a sell-or-hold or a structure change inside this gateway, because the tools it has access to literally cannot emit one. Swapping LLMs does not unlock that capability; it would also not make the LLM safer than it already is in this harness.

So we treat the question as Part A only, with Part B answered by reference to Phase 41 §5 (Tier 1 = facts via the engine + AI; Tier 2 = personal-circumstance reasoning via Ask-a-Pro).

---

## 2. What's already in place (so a provider swap is one file)

The gateway was built to be provider-agnostic from the day it shipped (Phase 41h.1, 2026-05-06). The relevant surface area:

| Layer | File | Provider-aware? |
|---|---|---|
| **Gateway** | `lib/ai/tax-advisor/gateway.ts` | No — only calls `provider.invoke({ systemPrompt, userMessage, tools, executeTool, traceId, options })` |
| **Provider interface** | `lib/ai/tax-advisor/providers/types.ts` | Defines `AIProvider.name: string` (`'gemini' \| 'mock' \| 'claude'` already enumerated in the JSDoc) |
| **Gemini provider** | `lib/ai/tax-advisor/providers/geminiProvider.ts` | Yes — wraps `@google/generative-ai`, model `gemini-2.0-flash`, MAX_TURNS=8 |
| **Mock provider** | `lib/ai/tax-advisor/providers/mockProvider.ts` | Yes — deterministic for tests |
| **System prompt** | `lib/ai/tax-advisor/policy/systemPrompt.ts` | No — pure Monitrax persona + HR-1/HR-2/D-2 wording |
| **Response schema** | `lib/ai/tax-advisor/policy/responseSchema.ts` | No — Zod, provider-agnostic |
| **Validators** | `lib/ai/tax-advisor/policy/validators.ts` | No — runs after the provider returns, catches HR-1/HR-2/D-2 leaks |
| **Tool registry** | `lib/ai/tax-advisor/registry.ts` + `lib/ai/tax-advisor/tools/*.ts` | No — closed `FACT_LOOKUP \| SCENARIO_RUN` discriminant; never an `RECOMMENDATION` |
| **Audit sink** | `lib/ai/tax-advisor/audit/auditLogger.ts` + `productionAuditSink.ts` | No — CDR-sanitised, fire-and-forget; Action `AI_ADVISOR_INVOCATION` |

**Cost of adding Claude as a provider option:** one new file — `lib/ai/tax-advisor/providers/claudeProvider.ts` (≈250 LOC by analogy with `geminiProvider.ts`) — plus one DI wiring change in the per-route `runAdvisorQuery` call site. Tests: ~12 new (mocked Anthropic SDK, MAX_TURNS guard, JSON-mode parity, token usage aggregation). No gateway / validator / registry change.

Anthropic SDK is **already** in the codebase from Phase 33g.2 (2026-05-10, `lib/ai/anthropic.ts`) — used today for the live-feedback chat triage on Haiku 4.5 with a US$50/mo hard cap at the console. So infrastructure-wise we already have:

- `@anthropic-ai/sdk` installed
- `ANTHROPIC_API_KEY` plumbed into the Vercel env scope
- Cost-cap pattern proven (no surprise bills)
- CDR-boundary pattern proven (CLAUDE.md §13.3 — feedback chat receives no CDR data)

**This is the load-bearing point.** The decision is not "should we adopt Claude for the first time?" — it's "we already pay for Claude on one surface; should we extend it to a second surface?". That changes the cost equation materially.

---

## 3. What changes (and what doesn't) when you swap the LLM

### 3.1 Things that don't change when the LLM swaps

These are guaranteed by the architecture, not by the model:

| Property | Why it survives any LLM swap |
|---|---|
| **HR-1 — numbers come from the app, never AI memory** | `lib/ai/tax-advisor/policy/validators.ts` rejects any `value` in the AI response that wasn't returned by a tool call in the same session. A model that hallucinates `$1,247.32` for "your projected tax under the indexation regime" without a `runReformedCgtScenario` tool call gets a `BLOCKED_VALIDATION` status. Gemini-bound or Claude-bound, same wall. |
| **HR-2 — citations come from AU law, never AI memory** | Validator chain also rejects any `IdentifiedCitation` not in the session's collected citations. Models cannot quote "ITAA 1997 s115-25" unless a tool returned that citation. |
| **D-2 — no recommendations** | The tool registry has only `FACT_LOOKUP` and `SCENARIO_RUN` kinds (`registry.ts` enforces this at registration time — `assertToolKind` throws on anything else). And the validator chain catches recommendation verbs (`"you should"`, `"I recommend"`, `"transfer to"`, `"salary sacrifice"`, etc.) in free-text fields and routes the response to `BLOCKED_RECOMMENDATION` → Ask-a-Pro. |
| **CDR sanitisation** | Tools return aggregates (e.g. `getEntityTaxPosition` → the position, not the transactions). The LLM never sees raw CDR data. CLAUDE.md §13.3 boundary is at the tool layer, not the LLM. |
| **Audit trail** | `AdminAuditLog` row per invocation (action `AI_ADVISOR_INVOCATION`), CDR-safe metadata, fire-and-forget pattern. Provider-agnostic. |
| **Boundary copy + Ask-a-Pro routing** | `RouteToPro` card + `askAProRouting.ts` map (ADVISER→FINANCIAL_ADVISOR, ACCOUNTANT→TAX_AGENT, BROKER→MORTGAGE_BROKER). Provider-agnostic. |

So if a user asks *"Should I sell my Brunswick property under the new CGT rules?"*, the answer they see — regardless of LLM — is structurally forced into the shape: numbers from `runReformedCgtScenario` + Ask-a-Pro CTA. The LLM's job is to *narrate* those numbers cleanly, not to decide them.

### 3.2 Things that do change when the LLM swaps

| Property | Gemini 2.0 Flash | Claude Haiku 4.5 / Sonnet 4.6 |
|---|---|---|
| **Conversational quality** in narrating tool outputs | Solid; occasional flatness. | Stronger — particularly on clarification questions and on holding a line ("I can show you the numbers; the sell-or-hold decision needs a registered advisor — here's why"). This is Anthropic's well-known strength and matches Phase 33g.2's reasoning for using Claude on the feedback chat. |
| **Multi-turn tool-use reliability** at MAX_TURNS=8 | Good — Gemini 2.0 Flash handles function-calling loops cleanly under the schema-validated harness; occasional retries when JSON mode + structured output disagree (mitigated already by `responseMimeType: "application/json"` + Zod post-parse). | Anthropic's function-calling API is mature; same kind of multi-turn pattern works. Marginal differences. |
| **Arithmetic / "mathematical AI"** | LLMs are not calculators. Even Gemini's "math" reputation does not mean it can compute compounded indexation against a CPI table in its head — neither can Claude. **Math reliability comes from the deterministic engine (`lib/tax-engine/*`), not the model.** The model's job is to call the right tool and narrate the result. | Same — math from the engine, narration from the model. |
| **Knowledge recency** | Knowledge cut-off (Gemini 2.0 Flash: ~Q4 2024). Cannot reliably know the 12 May 2026 Budget measures from memory — **which is exactly why HR-2 binds claims to the knowledge pack, not the model.** | Claude Haiku 4.5 cut-off is later (~Q1-Q2 2025) but **still pre-Budget** — same constraint applies. Phase 41E reform-2026-27 knowledge pack carries the facts; the LLM only narrates from the pack. |
| **Latency p95** | Gemini 2.0 Flash is among the fastest in its class. Typical 1-2s for single-turn answers under the existing 30s timeout cap. | Claude Haiku 4.5 is comparable to Gemini Flash; Claude Sonnet 4.6 is slower but stronger reasoning. |
| **Cost** at Monitrax scale | Gemini 2.0 Flash on the Google AI Studio tier is the cheapest mainstream provider. | Claude Haiku 4.5 sits ~2-3× the per-token cost of Gemini Flash but still well under any meaningful budget at MVP scale; Sonnet 4.6 is materially more. Cost-cap pattern from Phase 33g.2 already controls runaway risk (`isAnthropicConfigured()` graceful disable + console hard cap). |
| **GCP-first posture** (CLAUDE.md §12.7) | Native GCP. Wired into the existing Vercel-region pinning for low-latency. | Not GCP-native, but the existing Anthropic dep is already accepted infra; the §12.7 cost-justification test from Phase 33g.2 passes for the same reason (Claude's conversational quality is the GCP-service gap). |
| **Vendor lock-in** | Same — both providers used through the `AIProvider` interface; neither is more locked-in than the other in this codebase. | Same. |

### 3.3 What this means for Reza's specific use cases

Reza's brief gave four example user questions. For each, the answer flow is determined by the tool registry, not the LLM:

**Q1: "Should I sell my investment property due to negative cashflow + recent law changes?"**

- Tools the LLM calls (regardless of provider): `getEntityTaxPosition` (current position) → `getReformedTaxRegimeStatus(propertyId)` (Phase 41E new — is it grandfathered?) → `runReformedCgtScenario(propertyId, hypotheticalSaleDate)` (Phase 41E new — under both regimes).
- Validator behaviour: any "you should sell" / "I recommend selling" verb → `BLOCKED_RECOMMENDATION` → Ask-a-Pro `TAX_AGENT` + `FINANCIAL_ADVISOR` route.
- LLM's job: narrate the three tool outputs in plain English + surface the Ask-a-Pro CTA. The narration is marginally better in Claude. **Decisional safety is identical**.

**Q2: "Should I restructure into a discretionary trust / company / SMSF?"**

- Tools the LLM calls: `getTrustDeedRules` (if applicable) → `runStructuringScenario({ assets, candidateStructure })` (Phase 41E new — projects tax under both pre-reform and post-Measure-3 rules) → `getTrustReformImpact` (Phase 41E new — the 3-year rollover window).
- Validator behaviour: any "transfer to / move into / shift to" verb on a structural change → `BLOCKED_RECOMMENDATION` → Ask-a-Pro `TAX_AGENT` route.
- LLM's job: present the comparative numbers honestly (including the Measure 3 cost on a discretionary trust from FY 2028-29). Claude is slightly stronger at holding the boundary in a multi-turn conversation; Gemini handles it cleanly with the system prompt.

**Q3: "How do the new law changes affect *my* portfolio?"**

- Tools: `getReformedTaxRegimeStatus` per asset → aggregated narration from the knowledge pack.
- Validator behaviour: no recommendation surface; pure facts.
- LLM's job: clean stage-matched narration. Both providers do this well.

**Q4: "Can Monitrax do X?"** (capacity Q)

- Tool: none — this is product capability narration. The system prompt holds the answer.
- Validator behaviour: HR-1/HR-2 don't apply (no claims about user data, no claims about AU law); D-2 still applies (no advice).
- LLM's job: friendly product narration. Both providers do this well. **This is where Claude's conversational strength shines most.**

---

## 4. Decision matrix

| Surface | Volume | Conversational weight | Math weight | Cost sensitivity | Recommended provider |
|---|---|---|---|---|---|
| **Main tax-advisor surface** (`/dashboard/cfo/ask`, `/api/ai-advisor/ask`) — Phase 41h.0-7 | Medium (every user, on-demand) | High but tightly bound by validator | High — every numeric claim flows from a tool. LLM math irrelevant. | Medium — provider gets called per user per question | **Gemini 2.0 Flash** (default — incumbent + cheapest + GCP-first per CLAUDE.md §12.7) |
| **Feedback chat triage** (`lib/services/feedbackService.ts`) — Phase 33g.2 | Low | Very high — clarification + triage | Zero | Capped at US$50/mo | **Claude Haiku 4.5** (already in place — keep) |
| **Capacity Q&A** ("how does Monitrax handle X?") — currently part of main advisor | Medium | Very high | Zero | Medium | **Pilot Claude Haiku 4.5** — see §5 |
| **Document Intelligence** (`lib/ai/gemini.ts`) — bank-statement / PDF parsing | Low (per upload) | Zero | High (numeric extraction) | Low | **Gemini 2.0 Flash** (Vision strength — keep) |
| **Synthesis / summary work** (admin-side, batch) | Very low | High | Low | Low | **Claude Opus 4.7** is the right tool when this lands; already reserved in `ANTHROPIC_MODELS.OPUS` |

---

## 5. Recommended posture

1. **Keep Gemini 2.0 Flash as the default for the main tax-advisor surface.** It is incumbent, GCP-native, cheapest, and the validator chain enforces the boundary. Swapping it wholesale would burn engineering time on a swap that doesn't change the user's safety or, materially, the user's answer quality.

2. **Add `ClaudeProvider` as a sibling implementation of `AIProvider`** — a one-file change at `lib/ai/tax-advisor/providers/claudeProvider.ts`, wrapping the existing `lib/ai/anthropic.ts` client. Wire it behind a config flag (`process.env.AI_ADVISOR_PROVIDER === 'claude'`) so we can A/B at the call-site without redeploying.

3. **Pilot Claude on one specific surface first** — the "capacity Q&A" branch of the main advisor (where the user asks *"can Monitrax do X?"*) — for two reasons: (a) it's the highest conversational weight + zero math weight branch, so Claude's strength is at maximum and its cost is at minimum; (b) it's the lowest-risk path to validate the provider integration end-to-end without putting reform-aware tax-advisor traffic through a not-yet-stress-tested provider.

4. **Re-evaluate at two checkpoints:**
   - **Phase 41E Stage 2 (when Measure 1+2 exposure draft lands)** — reform-aware tax-advisor traffic will spike. Measure how Gemini handles the new tools; measure how Claude handles the same flow in the pilot.
   - **Phase 32C marketplace launch** — Ask-a-Pro routing volume will spike. The boundary copy needs to hold under sustained conversational pressure. Claude is empirically better at "calmly holding a line under push-back" in adversarial conversations; this matters for AFSL compliance more than raw answer quality.

5. **Do NOT migrate Document Intelligence** (`lib/ai/gemini.ts`) **off Gemini.** Gemini Vision's PDF/bank-statement parsing strength is the reason that integration exists. Claude has Vision now too, but the Document Intelligence harness in this codebase is already tuned for Gemini and the marginal quality gain doesn't justify the rewrite.

---

## 6. Implementation roadmap (when Reza approves)

**Stage A — `ClaudeProvider` implementation (1 PR, ~3 days)**

1. `lib/ai/tax-advisor/providers/claudeProvider.ts` — implements `AIProvider`, wraps `getAnthropicClient()`, translates the gateway request → Anthropic SDK `messages.create` with `tools` parameter → multi-turn loop (MAX_TURNS=8 — same defensive cap) → returns `ProviderInvokeResponse` with `tokenUsage` from `response.usage`. JSON mode via `response_format` + Zod post-parse.
2. `lib/ai/tax-advisor/providers/__tests__/claudeProvider.test.ts` — 12 tests: schema parity with Gemini, MAX_TURNS guard, timeout guard, token usage aggregation, JSON parse failure handling, ProviderError wrapping.
3. Wire flag at `lib/ai/tax-advisor/runAdvisorQuery.ts`: `const provider = process.env.AI_ADVISOR_PROVIDER === 'claude' ? new ClaudeProvider() : new GeminiProvider();`. Default = Gemini.
4. Audit metadata gains `providerName` field (already typed in `AuditEntry` shape).
5. CHANGELOG + this doc + IMPLEMENTATION_PLAN entry.

**Stage B — Pilot on capacity-Q&A branch (1 PR, ~2 days)**

1. Detection in the gateway: classify the user question as `CAPACITY` vs `TAX_FACT` (simple regex / keyword pass — `monitrax`, `app can`, `how do i`, etc., escalate to `CAPACITY`).
2. Route capacity questions through `ClaudeProvider`; route tax-fact questions through `GeminiProvider`. Both go through the same gateway / validators / audit.
3. A/B observability: dashboard at `/admin/ai-advisor/metrics` adds a "provider breakdown" panel (avg latency, validation outcomes, blocked-recommendation rate, token spend).
4. Cost cap proven by Phase 33g.2 pattern (US$50/mo at the Anthropic console; graceful disable when `ANTHROPIC_API_KEY` absent).

**Stage C — Evaluate + decide (per Phase 41E Stage 2 trigger)**

When Measure 1+2 exposure draft lands and reform tools are populated, run a one-week side-by-side eval on a sample of real (audit-logged, anonymised) reform-aware questions. Compare validation-outcome distribution. If Claude wins on `BLOCKED_RECOMMENDATION` accuracy (catching the genuinely Tier 2 questions) by a meaningful margin, expand to the full tax-advisor surface. If Gemini holds, keep it.

---

## 7. What this doc deliberately does NOT recommend

- **Wholesale Gemini → Claude migration today.** Without a pilot + observability, this is a gut-feel swap. The codebase's safety doesn't depend on it.
- **A new "math-specialised" LLM** (e.g. WolframAlpha LLM, custom fine-tunes). Math correctness in Monitrax comes from `lib/tax-engine/*`, not the model. Any "math LLM" introduces a new dep + new attack surface for zero gain.
- **An LLM that "knows the new tax laws."** No LLM "knows" them — they were announced 12 May 2026, post-cutoff for every public model. The Phase 41E reform-2026-27 knowledge pack is the source of truth, injected via system prompt + tool results. The LLM only narrates from the pack (HR-2).
- **Removing the AI advisor entirely** in favour of pure deterministic outputs. The advisor's job is *narrating* the engine's numbers in plain English + routing to Ask-a-Pro. That conversational layer is the difference between "a tax calculator" and "a CFO Guide" — and that's the core TRAIL framework promise (CLAUDE.md §14, Stage 5: Live).

---

## 8. Sources + cross-references

- `lib/ai/tax-advisor/providers/types.ts` — provider interface (the architectural fact this doc depends on)
- `lib/ai/tax-advisor/providers/geminiProvider.ts` — current Gemini adapter
- `lib/ai/tax-advisor/providers/mockProvider.ts` — pattern for the new `claudeProvider.ts`
- `lib/ai/anthropic.ts` — existing Phase 33g.2 Anthropic client + US$50/mo cap pattern
- `lib/ai/tax-advisor/gateway.ts` — 10-step pipeline; provider-agnostic
- `lib/ai/tax-advisor/policy/validators.ts` — HR-1 / HR-2 / D-2 runtime enforcement
- `lib/ai/tax-advisor/registry.ts` — closed `FACT_LOOKUP | SCENARIO_RUN` discriminant
- `lib/ai/tax-advisor/index.ts` — current 11-tool registry bootstrap
- `lib/ai/tax-advisor/askAProRouting.ts` — Tier 2 routing map
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §5 (Tier 1 / Tier 2) + §9 (versioning protocol) + §11.1 (Phase 41h sequence)
- `docs/blueprint/PHASE_41E_REFORM_2026_27.md` (companion doc — reform-aware tools land in the same registry under the same boundary)
- `docs/blueprint/PHASE_33G_LIVE_FEEDBACK.md` (the original Anthropic adoption + cost-control rationale)
- CLAUDE.md §0 (four-lens advisory mindset), §12.7 (GCP-first), §13.3 (CDR sanitisation)
- Anthropic API docs: <https://docs.anthropic.com/en/api/messages> (Tool use for Claude reference)
- Google AI Studio Gemini API docs: <https://ai.google.dev/gemini-api/docs/function-calling>

---

*Last updated: 2026-05-13. Owner: Reza (decision) + Claude (architecture). Status: Awaiting Reza's call on Stage A go/no-go.*
