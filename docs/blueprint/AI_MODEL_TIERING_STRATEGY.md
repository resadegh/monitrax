# AI Model-Tiering Strategy — cost vs quality as usage grows

> **Status:** Strategy agreed (Reza 2026-06-28). **Step 1 (instrumentation) shipping now**; tiering execution gated on the measured baseline.
>
> **Owner doc for the residency cutover this interacts with:** `docs/compliance/CDR_BASIQ_GOLIVE_CUTOVER.md`. **Subsystem:** `docs/blueprint/PHASE_54_NEOBRAIN.md`.

---

## 1. The question

As app usage grows, AI (Gemini) cost grows with it. We want to **protect quality where it's visible and cut cost where it scales** — without a blunt global model downgrade. Reza (2026-06-28): *"I don't want to compromise the quality but I also need to think about the cost as the App usage grows."*

## 2. The principle — tier by (volume × reasoning), not globally

The AI surfaces split into three tiers, and the split maps almost perfectly onto cost: **volume is highest where reasoning need is lowest.**

| Tier | Surfaces | Volume | Reasoning need | Model call |
|---|---|---|---|---|
| **1 — High-volume classification** | transaction **categorisation** (the LLM-on-miss tail) | **Highest** (scales with users × transactions) | Low — "which category is this merchant?" | **Cheapest adequate flash** (`gemini-2.5-flash`) |
| **2 — Grounded advice narrative** | CFO advice, debt analysis, cashflow summary, financial advisor, budget analysis | Medium | Medium — but **the numbers are facts** (Neobrain grounding), the model only narrates | **Cheap flash is fine** (`2.5-flash`); `3.5` optional polish |
| **3 — Genuine multi-step reasoning** | complex tax scenarios, multi-step what-ifs | **Lowest** | High | **Keep the best** (`pro` / `3.5-flash`) — cost impact negligible at low volume |

Why this works: **Neobrain grounding** means user-facing figures are verified facts supplied by the FactPack and enforced by the validator (`lib/neobrain/grounding.ts`) — the model phrases them, it does not compute them. So a flash-tier step-down on Tiers 1–2 touches *phrasing*, not *financial correctness*. Tier 3 is where reasoning depth genuinely matters, and it's also where volume (and therefore cost) is lowest — so we keep quality there for free.

## 3. The cost evidence

Per 1M tokens (USD, Google list price 2026-06-10, from `lib/ai/google/modelConfig.ts`):

| Model | Input /1M | Output /1M | Role |
|---|---|---|---|
| **`gemini-2.5-flash`** | **$0.30** | **$2.50** | cheap flash (also the only AU-resident model — see cutover doc) |
| `gemini-3.5-flash` | $1.50 | $9.00 | current flash primary (~5× / ~3.6× the cost of 2.5) |
| `gemini-2.5-pro` | $1.25 | $10.00 | pro |
| `gemini-3.1-pro-preview` | $2.00 | $12.00 | current pro primary |

Routing the high-volume **categorisation** surface to `2.5-flash` is the single biggest lever — ~5× cheaper on the slice that scales linearly with usage, with effectively zero quality cost on a classification task.

## 4. The plan — measure first, then tier (Reza decision 2026-06-28: "go with that")

**Step 1 — Instrument (shipping now).** An admin **AI Usage & Cost** panel (`/admin/ai-usage`) backed by an `AiUsageEvent` telemetry log written fire-and-forget from the canonical Gemini chokepoints (`lib/ai/google/geminiClient.ts`). Shows total spend + tokens + call volume **by surface** and **by model** over a window. This is the **measurable baseline** — we don't guess where the money goes, we measure it (the §19 "don't guess" discipline applied to cost). No prompt/response content is stored (counts + cost only).

**Step 2 — Tier (after the baseline confirms the distribution).** Route per-surface models via the existing per-use-case aliases in `lib/ai/google/modelConfig.ts` (`GEMINI_MODELS.QUICK_RESPONSE` / `FINANCIAL_ADVISOR` / `DOCUMENT_ANALYSIS` vs `PRO`) — a config change, not a refactor:
- Categorisation → `gemini-2.5-flash` (expected biggest saving).
- Advice narrative → `2.5-flash` (grounding carries correctness) or keep `3.5` for polish.
- Complex reasoning → keep `pro`/`3.5`.
If a surface ever reads worse on `2.5`, bumping it back is a one-line config change.

## 5. Honest caveats

- **The volume distribution is currently estimated, not measured.** Categorisation is *expected* to dominate spend; Step 1 exists precisely to confirm that before any tiering. Don't tier on the estimate — tier on the panel.
- **The 2.5-vs-3.5 quality gap is real but small where it matters** (classification + grounded narration) and larger for free-form reasoning — hence Tier 3 keeps the best model.

## 6. Interaction with the Basiq/CDR residency cutover

The tiering target (`gemini-2.5-flash` for high-volume work) **pre-aligns** with the only model served in the AU-resident Vertex region (`australia-southeast1`) — see `docs/compliance/CDR_BASIQ_GOLIVE_CUTOVER.md`. So this cost work and the (deferred) residency cutover point at the same model: at go-live the high-volume surfaces are already on the AU-resident, cheaper model, and only Tier-3 reasoning surfaces face the capability/residency trade-off the cutover doc records.

## 7. Surfaces instrumented in Step 1 (and the gaps)

Labelled at the call site (`surface` on the completion options): `categorisation`, `cfo-advisor`, `debt-analysis`, `financial-advisor`, `budget-analysis`, `document-intelligence`. Every other Gemini call still through the canonical chokepoints is recorded under `unknown` (counted, just unattributed). Two surfaces bypass the canonical chokepoints and are **not yet** in the telemetry — the tax-advisor multi-turn provider (`lib/ai/tax-advisor/providers/geminiProvider.ts`, computes tokens but not cost) and the cashflow summary (`lib/cashflow-intelligence/geminiSummary.ts`, direct SDK). Both are follow-ups (v1.1): route them through the canonical path or add a cost calc + `recordAiUsage` call.
