# PHASE 54 — NEOBRAIN (Monitrax's AI Perception & Learning Layer)

**Monitrax Blueprint — Phase 54**
**Version:** v1.0
**Status:** 🟢 Consolidation SSOT — live engines documented; umbrella named; modelled into the Neomatrix
**Created:** 2026-06-25
**Updated:** 2026-06-25
**Owner:** Reza (decisions) + Claude (research + build)

---

## 0. What this document is (and the SSOT rule it enforces)

> **Reza, 2026-06-25:** *"bring all its functionality under Neobrain umbrella … read from all documents which have created the ai engines before and take all of that and consolidate into 1 design document for neobrain, so we have everything in one place. that is the SSOT rule in practice."*

**Neobrain** is the umbrella name for **every AI engine in Monitrax that turns raw inputs (bank transactions, documents, receipts, statements) into categorised, linked, trustworthy financial facts — and gets smarter every time a user confirms one.**

This file is the **single source of truth for the Neobrain design**. It consolidates nine previously-separate phase docs (13, 18, 25, 26, 29, 42, 50, 51, 52) into one place. Those phase docs remain as **historical build records**; this document is the **canonical architecture reference** an engineer or AI reads before touching any AI-perception code. Where this doc and a superseded phase doc disagree, **this doc wins** (it resolves the contradictions — see §12).

**Neobrain is NOT a code move.** No directories were renamed and no behaviour changed when this umbrella was created. Neobrain is (a) a **name** for a real, pre-existing subsystem, (b) this **consolidated design doc**, and (c) a **modelled domain in the Neomatrix** (§11). Scope grows from here — incrementally, behind the same confirm-gated, echo-chamber-safe contract that already exists.

### 0.1 Neobrain vs Neomatrix — the clean architectural seam

| Layer | Question it answers | Artifact |
|---|---|---|
| **Neobrain** (this doc) | *"What is this transaction / document, and what does it mean?"* — **perception & learning** | `lib/bank/*`, `lib/categorisation/*`, `lib/bookkeeping/*`, `lib/documents/*`, `lib/ai/*` |
| **Neomatrix** (Phase 53) | *"Given those facts, what is the user's financial position?"* — **calculation & lineage** | `docs/financial-logic/graph/financial-graph.json` |

Neobrain **perceives**; the Neomatrix **calculates** on what Neobrain perceived. The handoff is the categorised `UnifiedTransaction` row (and the `Expense`/`Loan` a confirmed document creates) — which is exactly the bridge modelled in §11.

### 0.2 The four-lens read (CLAUDE.md §0)

- **Architect:** Neobrain is a *cascade* (cheapest source wins, LLM only on the unknown tail) with **one** learning store per concept. The whole value proposition collapses if a second categoriser or a second confidence threshold is introduced — §12 resolves the historical duplications into single sources.
- **Financial adviser:** every categorised number must trace to a real transaction (CLAUDE.md §19.1). Neobrain never invents a figure; it classifies money that actually moved, and transfers are excluded so surplus/savings aren't overstated.
- **Behaviour psychologist:** Neobrain's job is to **reduce the cognitive tax** of money admin (Mani et al. 2013 — financial stress costs ~13 IQ points). Every increment of "smarter" must mean **fewer confirmations asked**, never a chattier AI. The confirm-gated, "AI suggests / user always confirms" contract is load-bearing and must be preserved as scope grows.
- **Designer:** the surfaces Neobrain feeds (review inbox, scan flow, smart inbox) follow the My Accounts (Track) glass vocabulary; the AI is invisible infrastructure, not a mascot.

---

## 1. The three pillars

Neobrain has three functional pillars, all built on the same `UnifiedTransaction` ledger + `CanonicalCategoryRegistry` taxonomy and the same confirm-gated learning contract.

| Pillar | What it does | Lead phases |
|---|---|---|
| **A. Transaction categorisation + learning** | Classifies every imported/synced transaction via a lookup-first cascade; learns from every user confirmation into a per-user map **and** a cross-user k-anonymous knowledge base. | 13, 18, 29, 51, 52 |
| **B. Transfer & loan-repayment detection** | Recognises internal account-to-account moves (and offset→loan repayments), pairs both sides, and excludes them from all spend/income. | 13, 51 |
| **C. Document & receipt intelligence** | Recognises an uploaded document/receipt (Vision OCR + Gemini), extracts its fields, routes it to the right asset/entity or creates an expense/loan, and files it in the Vault. | 25, 26, 42, 50 |

---

## 2. Pillar A — Transaction categorisation + the learning loop

### 2.1 The lookup-first cascade (cheapest source wins)

Canonical engine: **`lib/tie/categorisation.ts` → `categoriseTransaction()` (line 692).** First match wins, in this precedence:

| # | Layer | Source | Cost | File:line |
|---|---|---|---|---|
| 1 | **User's own MerchantMapping** | `USER` (conf 1.0) | free | `lib/tie/categorisation.ts:700` |
| 2 | **~50 hardcoded AU rules** (Woolworths→Groceries, etc.) | `RULE` (conf 0.9) | free | `lib/tie/categorisation.ts` rules array |
| 3 | **Graduated shared-KB prior** (≥k confirming users) | `KB` | free (DB lookup) | `lib/categorisation/kb/lookupCategory.ts:74` |
| 4 | **Gemini-on-miss (RAG)** — KB patterns seeded as context | `AI` | LLM call (rare) | `lib/categorisation/kb/geminiOnMiss.ts:83` |
| 5 | **`Uncategorised` fallback** (never dropped — §19.1) | `FALLBACK` (conf 0.1) | free | `lib/tie/categorisation.ts` tail |

**Why lookup-first:** import-time bulk Gemini categorisation was cut **2026-05-09 for cost**; the KB now absorbs the volume so the LLM only ever sees the genuinely-unknown tail (Phase 52 §2). ~90%+ of transactions resolve at layers 1–3 with no LLM call.

The import pipeline (`POST /api/accounts/[id]/import`, line 105) calls `categoriseWithLearning()` (`lib/bank/aiCategorisation.ts:571`), then `classifyByConfidence()` (`:530`) partitions results into bands and writes auto-accepts straight to `UnifiedTransaction`, parking the rest in the review queue.

### 2.2 Confidence bands (the ONE policy)

| Band | Threshold | Action |
|---|---|---|
| **AUTO_ACCEPT** | adjustedConfidence ≥ **0.90** | written straight to the ledger |
| **NEEDS_REVIEW** | **0.70** ≤ conf < 0.90 | parked in `TransactionReviewQueue` |
| **MANUAL** | conf < **0.70** | parked, requires manual category |

Thresholds are **per-user** in `UserCategorizationSettings` (defaults 0.90 / 0.70). Confidence is **adjusted** (`calculateAdjustedConfidence()`, `aiCategorisation.ts:187`) by ±0.20: boosts for repeat-corrected merchants / recurring matches / known merchants; penalties for cryptic descriptions / previously-corrected-AI.

> **SSOT resolution (§12.1):** the 0.90/0.70 thresholds historically appeared in Phases 26, 29, 50, 52. **`lib/documents/intelligence/confidencePolicy.ts` (Phase 50 D.3) is the canonical policy** for the document side; the transaction side reads `UserCategorizationSettings`. Both express the same band shape (AUTO ≥0.9 / CONFIRM ≥0.7 / ASK <0.7) with a TRAIL-stage downgrade (Track/Reduce users never AUTO).

### 2.3 The learning loop — two layers, one contract

When a user **confirms or corrects** a category (via `confirmReviewItem()`, `lib/bank/reviewQueue.ts:140` — the SSOT confirm entry):

**Layer 1 — private (`processUserConfirmation()`, `aiCategorisation.ts:705`):**
- Upserts the user's **`MerchantMapping`** (`:727`) — their private, authoritative memory; next import of that merchant resolves at cascade layer 1.
- Logs prediction-vs-final in **`AICategorizationLearning`** (`lib/bank/aiLearning.ts:394`) — the accuracy trail.

**Layer 2 — shared, k-anonymous (`recordKbContribution()`, `recordFromConfirmation.ts:35` → `recordContribution()`, `recordContribution.ts:66`):**
- De-identifies the description to a merchant signature (`scrubToSignature()`, `scrubSignature.ts:46` — strips names, BSBs, card masks, transfer/payid markers; rejects anything without a safe merchant token).
- Records the user's vote in **`SignatureContribution`** (private per-(signature,user) ledger, `:109`) and updates **`TransactionSignature`** (the shared KB, `:82`): vote tally, `distinctUserCount`, `confidence`, and `isGlobal`.
- **Graduation:** a pattern becomes a shared cross-user prior only at **k = 5 distinct confirming users** (`KB_GRADUATION_K`, `recordContribution.ts:55`). Graduation is **sticky** (never demoted). Private mappings stay authoritative for their owner.

**Echo-chamber safety (load-bearing):** only **human** confirmations write to the shared KB. Import-time AI auto-accepts (≥0.90) go through `processUserConfirmation` directly and **never** re-train the KB (`reviewQueue.ts:243`). An edit weighs more than a passive confirm.

### 2.4 Privacy posture (DECIDED — Reza 2026-06-21)

**Hybrid: private + k-anon shared.** Each user has private mappings (authoritative for them); patterns confirmed by **≥k distinct users** graduate to a **de-identified shared KB** that acts as a **prior, never an override**. (Rejected: fully-shared — loosest privacy; curated-global-only — learns too slowly.) No PII/CDR ever enters the shared KB (`scrubToSignature` + CLAUDE.md §13.3).

---

## 3. Pillar B — Transfer & loan-repayment detection

Transfers are handled **structurally, not by the LLM** (the AI's "Transfer" category is advisory only). At review time:

- **`resolveTransactionMatches()` (`lib/bookkeeping/resolveTransaction.ts:78`)** finds candidate transfer pairs + loan-repayment matches: opposite direction, different account, |Δamount| ≤ $0.005, |Δdate| ≤ 4 days, not already `isTransfer`. Confidence 0.98 same-day, decaying to ≥0.66. This runs **before** categorisation rules (Phase 51.2 precedence).
- **`pairTransferIfPossible()` (`lib/bookkeeping/transferPairing.ts:127`)** tags **both** sides `isTransfer=true` + `transferToAccountId` **only when exactly one** safe counterpart exists (|Δamount| ≤ $0.01, |Δdate| ≤ 3 days, unlinked). 0 or 2+ matches → no auto-pair (no false pairs).
- **Exclusion:** `isTransfer === true` rows are excluded from all spend/income analytics and from `actualCashflow` (CLAUDE.md §19.1). Loan repayments are a transfer subtype — the deductible interest is taken from the loan's **own interest line**, never re-derived as `rate × balance` (offset breaks that; offset ≠ redraw per TR 2000/2).

---

## 4. Pillar C — Document & receipt intelligence

### 4.1 The pipeline (recognise → extract → route → create)

| Stage | Engine | File:line | What it does |
|---|---|---|---|
| **Intake** | `DocumentManagementEngine.processUpload` (DME) | `lib/documents/engine/DocumentManagementEngine.ts:79` | Stores the file (GCS/Monitrax), SHA-256 dedups, routes to the right Vault path, creates entity `DocumentLink`s. |
| **OCR** | `visionService.detectText` | `lib/documents/intelligence/services/visionService.ts:166` | Google Cloud Vision text detection (REST transport for serverless). |
| **Classify** | `documentClassifier.classifyDocument` | `lib/documents/intelligence/classifiers/documentClassifier.ts:204` | Type (RECEIPT/INVOICE/RATE_NOTICE/LOAN_CONTRACT/…) via keyword/regex/label scoring. |
| **Extract (simple)** | `receiptAnalyzer.analyzeReceipt` | `lib/documents/intelligence/analyzers/receiptAnalyzer.ts:180` | Vendor, ABN(+checksum), date, total, GST, line items via regex/heuristics. |
| **Extract (complex)** | `aiDocumentAnalyzer.analyzeDocumentWithAI` | `lib/documents/intelligence/analyzers/aiDocumentAnalyzer.ts:139` | Gemini structured extraction for loan contracts / insurance / leases. |
| **Orchestrate** | `DocumentIntelligenceEngine.analyzeDocument` (DIE) | `lib/documents/intelligence/DocumentIntelligenceEngine.ts:102` | OCR → classify → simple-or-AI extract → upsert `DocumentAnalysis`. |
| **Confirm → create** | `POST /api/documents/analyze/confirm` | `app/api/documents/analyze/confirm/route.ts:55` | Reads `DocumentAnalysis`, reconciles duplicates, creates the Expense (`:383`)/Income/Loan (`:503`). |

> **One DME + one DIE.** DME = filing (storage, dedup, routing). DIE = reading (OCR, classify, extract). Separate concerns (CLAUDE.md §12.3); Phase 50 extends them, it did not add a third engine.

### 4.2 Learned routing (suggest-only)

`learnedRouting.ts` remembers which entity a vendor's documents usually attach to: `recordVendorEntityHint()` (`:78`) writes the `VendorEntityHint` (`count++`), `getVendorEntityHint()` (`:123`) pre-selects it in the scan flow's "What is this for?". The vendor key is derived from the document's extraction (`recordHintFromDocument`, `:154`). **Suggestion only — never auto-applies** (the autonomy decision below).

### 4.3 Document confidence + autonomy (Phase 50 D.1/D.3)

Extraction confidence drives **AUTO ≥0.90 / CONFIRM 0.70–0.90 / ASK <0.70** (`confidencePolicy.ts`). **AUTO auto-write is gated (not yet wired) and downgraded to CONFIRM for Track/Reduce users.** Lifecycle: ATO **5-year retention** clock (RETAIN/ARCHIVE_SAFE/NO_CLOCK, advisory) + renewal extraction → reminders.

> **Autonomy decision (DECIDED — Reza 2026-06-18):** *AI always **suggests**, the user **always** confirms + can edit; bulk-approve (Smart Inbox) is the only convenience; no silent auto-execution.* This flips D.3's auto-EXECUTION from "deferred" to **rejected** — the AUTO band is a display cue only.

---

## 5. The model stack

| Capability | Provider / model | Where |
|---|---|---|
| Transaction categorisation (on-miss) | **Google Gemini** `gemini-3.5-flash` (temp 0.1) | `lib/ai/gemini.ts` |
| Document OCR | **Google Cloud Vision** (REST transport) | `lib/documents/intelligence/services/visionService.ts` |
| Document field extraction (complex) | **Google Gemini** (temp 0.3, JSON) | `lib/ai/google/geminiClient.ts` |
| Anthropic | present, secondary | `lib/ai/anthropic.ts` |

The shared KB is **RAG, not fine-tuning** — the intelligence lives in Monitrax's DB; Gemini reasons over it. Instant to update, auditable, reversible, and it compounds into Australian-transaction intelligence that is *ours*.

---

## 6. Data model (the Neobrain tables)

Core spine in **bold**. ~25 tables; each has a single, clear purpose (no bloat).

| Table | Pillar | Purpose |
|---|---|---|
| **`UnifiedTransaction`** | A/B | The master actual ledger (amount/direction/isTransfer/categoryLevel1/date/class). Source of every flow number. |
| **`CanonicalCategoryRegistry`** | A | SSOT category taxonomy (level1/level2/subcategory). All new writes resolve here; legacy `categoryLevel1/2` strings on `UnifiedTransaction` kept for back-compat. |
| **`MerchantMapping`** | A | Per-user learned merchant→category map (private layer). |
| **`TransactionSignature`** | A | Shared de-identified KB: signature → category votes, `distinctUserCount`, `confidence`, `isGlobal`. |
| **`SignatureContribution`** | A | Private per-(signature,user) vote ledger; `@@unique([signatureId,userId])`. |
| `AICategorizationLearning` | A | Per-transaction prediction-vs-final accuracy trail. |
| `AILearningPattern` | A | *Legacy* pattern store (Phase 29) — **superseded** by `TransactionSignature`/`SignatureContribution` (§12.3). |
| `UserCategorizationSettings` | A | Per-user thresholds + `enableAI` + `learnFromConfirmations`. |
| `ImportBatch` / `TransactionReviewQueue` | A | Import session tracking + the confidence-banded review queue. |
| `TransactionSplit` / `TransactionEdit` | A | One TX → many categories (sum ±$0.01) + per-mutation audit. |
| `Vendor` / `TaxCategoryMapping` | A | Consumer vendor card + canonical-category ↔ ATO-label bridge. |
| `BookkeepingPeriod` / `EngagementState` | A | Monthly milestone (OPEN/REVIEWED/LOCKED) + streak/engagement. |
| `Category` | A | User custom categories. |
| `Loan` / `LoanTransaction` / `LoanRepaymentMatch` | B | Loan-as-account ledger (interest-charged + repayment-received) + confirmed transfer pairs. |
| **`Document`** / `DocumentLink` | C | Stored file (+`contentHash` dedup) + many-to-many entity links (incl. ASSET). |
| `DocumentAnalysis` | C | Persisted extraction: type, confidence, extractedData/verifiedData, suggestedActions. |
| `VendorEntityHint` | C | Learned document routing (vendor → usual entity). |

---

## 7. Configuration flags & constants (consolidated)

| Flag / constant | Default | Meaning |
|---|---|---|
| `autoAcceptThreshold` | 0.90 | per-user auto-accept band (`UserCategorizationSettings`) |
| `reviewThreshold` | 0.70 | per-user review band |
| `KB_GRADUATION_K` | 5 | distinct confirming users to graduate a shared-KB pattern |
| `KB_READ_ENABLED` | off in code; **ON in prod** (Phase 52, PRs #1171–#1181) | enable shared-KB lookup |
| `KB_WRITE_ENABLED` | off in code; **ON in prod** | enable human-confirmation write-back |
| `KB_GEMINI_ENABLED` | off (cost-gated) | enable Gemini-on-miss RAG |
| `KB_MIN_CONFIDENCE` | ~0.6 | floor for a shared prior to apply |
| Transfer match | ±$0.005 amount / ±4 days | `resolveTransactionMatches` |
| Transfer auto-pair | ±$0.01 amount / ±3 days / exactly-1 | `pairTransferIfPossible` |
| Receipt↔TX match | ±$0.50 or 0.5% / ±3 days / Levenshtein ≥0.7 | `receiptMatcher` (Phase 42) |
| Document confidence | AUTO ≥0.9 / CONFIRM ≥0.7 / ASK <0.7 | `confidencePolicy.ts` |
| ATO retention | 5 years after FY end | `retentionClock.ts` |
| Storage quota | 2 GiB / user | `storageQuota.ts` |

> **Honest current status:** the shared-KB layer is **built and enabled in prod** (Phase 52), running lookup-first with `KB_GEMINI` cost-gated. Bulk import-time Gemini categorisation was cut 2026-05-09 for cost — the KB absorbs the tail. The document AUTO auto-write band is **deliberately not wired** (autonomy decision §4.3).

---

## 8. Entry points (API)

| Route | Pillar | Engine path |
|---|---|---|
| `POST /api/accounts/[id]/import` | A | parse → `categoriseWithLearning` → `classifyByConfidence` → write + queue |
| `POST /api/accounts/[id]/import/[batchId]/review` | A | `confirmReviewItem` (single) |
| `POST /api/unified-transactions/bulk-confirm` | A | bulk band confirm |
| `POST /api/categorisation/kb/{seed,housekeeping}` | A | KB seed / prune |
| `POST /api/documents/upload` | C | `DME.processUpload` → `DIE.analyzeDocument` |
| `POST /api/documents/analyze` · `/analyze-for-form` | C | (re)analyse / single-step scan |
| `POST /api/documents/analyze/confirm` | C | create Expense/Income/Loan from extraction |
| `GET /api/documents/vendor-hint` | C | `getVendorEntityHint` prefill |

---

## 9. Current live status

| Capability | Status |
|---|---|
| Lookup-first categorisation cascade | ✅ live |
| Per-user MerchantMapping learning | ✅ live |
| Shared k-anon KB (read + write) | ✅ live in prod (Phase 52) |
| Gemini-on-miss RAG | ⚙️ built, cost-gated (`KB_GEMINI_ENABLED`) |
| Transfer detection + exclusion | ✅ live |
| Loan ledger + repayment matching | ✅ live (Phase 51.1) |
| Document OCR + classify + extract | ✅ live |
| Document → create Expense/Loan | ✅ live |
| Learned routing (suggest-only) | ✅ live |
| Document AUTO auto-write | 🚫 rejected by autonomy decision (§4.3) |
| Modelled in the Neomatrix | ✅ this PR (§11) |

---

## 10. Roadmap — growing Neobrain smarter (AGREED 2026-06-25)

> **The north star (the constraint every step is measured against):** *smarter = **fewer confirmations** asked of the user, at equal-or-higher accuracy.* Not a chattier AI, not more silent auto-magic. The autonomy contract (AI suggests, the user always confirms — §4.3) is preserved at every step. And every new engine is modelled into the Neomatrix `neobrain` domain **in the same PR** (§21.2.1 zero-drift).
>
> Status: this plan is **agreed (Reza, 2026-06-25)**. Work paused; to be picked up next session starting at **Step 1**.

### Horizon 1 — make "smarter" *measurable*, then consolidate (cheap, safe, foundational)

- **▶ Step 1 — Instrument Neobrain (AGREED NEXT — start here).** An admin-only metrics panel + accuracy/coverage signals: auto-accept rate, **correction rate**, KB-graduation count, **% of transactions that touch the LLM**, document AUTO/CONFIRM/ASK split. *Why first:* "smarter as we go" needs a baseline — you can't prove an improvement you can't measure, and the numbers will likely reveal whether the cross-user KB is data-starved (k=5 needs scale), which re-orders everything after it. Small, admin-only, zero user-risk. Lenses: architect → behaviour.
- **Step 2 — Unify the two learning stores.** Transaction-side (`MerchantMapping`) and document-side (`learnedRouting`/`VendorEntityHint`) are the same idea ("the user taught us about this vendor"). Converge write/read into one Neobrain memory API (§12.2.1 SSOT).
- **Step 3 — Retire the legacy `AILearningPattern`** in favour of `TransactionSignature`/`SignatureContribution` (cheaper, k-safe, auditable) — §12.3 / §12.1 hygiene.

### Horizon 2 — make the *perception* genuinely smarter

- **Step 4 — KB embeddings (Phase 52.5b, deferred):** pgvector in Cloud SQL vs Vertex Vector Search (§12.7 evaluation) for semantic near-miss matching beyond token-prefix. The single biggest hit-rate lever → fewer LLM calls **and** fewer confirmations.
- **Step 5 — Turn Gemini-on-miss fully on** (`KB_GEMINI_ENABLED`) once embeddings shrink the unknown tail enough to bound cost.

### Horizon 3 — from *categorising* to *understanding*

- **Step 6 — Insight layer:** recurring-bill / anomaly detection + "this looks tax-deductible" — each a *suggestion* surfaced at the right TRAIL stage, never an auto-action. Lenses: financial-adviser + behaviour.
- **Step 7 — CDR/Basiq ingestion (Phase 51.3):** the same store/engine, source-agnostic (QIF now → Basiq later); real-time volume compounds the shared KB faster.

### Cross-cutting (every step)

- **Step 8 — Backfill the Neobrain Neomatrix domain** as engines are added (learned-routing read / retention-clock / receipt-matcher nodes; ui-surface nodes for the review inbox + scan flow) so coverage trends toward the whole subsystem.

---

## 11. The Neomatrix `neobrain` domain (shipped this PR)

Neobrain is now modelled as a first-class **`neobrain` domain** in the Neomatrix (`financial-graph.json`): **39 nodes** (20 engines, 4 orchestrators, 8 data stores, 7 governing laws) + **47 edges**, every one verified to a `file:line` read in source (CLAUDE.md §19.2 / §21.2). No `number` nodes — Neobrain classifies, it does not emit a displayed figure, so the A3 invariants stay clean.

- **Bridge to core:** the categoriser writes the category/`isTransfer` onto `UnifiedTransaction`; the document confirm creates `Expense`/`Loan`. Those existing core inputs feed cashflow + tax — so the AI layer now provably ties to every downstream number.
- **Governing laws modelled:** lookup-first cascade · confidence bands · k-anonymity graduation · echo-chamber safety · de-identification · transfer match/exclude · document confidence bands.
- **Explorer:** renders as its own pink (`#EC4899`) constellation at `/admin/neomatrix`.
- **Gate:** `npm run neomatrix:check` (the `vercel-build` gate) green — 150 nodes / 194 edges, all verified.

Any PR that adds/changes a Neobrain engine MUST update its node(s) in the same PR and keep `neomatrix:check` green (§21.2.1 zero-drift).

---

## 12. Contradictions resolved (the SSOT in practice)

Consolidating nine docs surfaced six overlaps. The canonical resolution for each:

1. **Confidence thresholds** (scattered across 26/29/50/52) → **one band shape** (AUTO ≥0.9 / CONFIRM ≥0.7 / ASK <0.7); `confidencePolicy.ts` is the document-side SSOT, `UserCategorizationSettings` the transaction-side per-user source. §2.2.
2. **Category taxonomy** (flat strings vs registry vs KB key) → **`CanonicalCategoryRegistry` is THE SSOT**; legacy `categoryLevel1/2/subcategory` strings remain for back-compat (populated from the registry); the KB stores a registry-resolvable category, never free text. §6.
3. **Merchant learning** (`MerchantMapping` vs `AILearningPattern` vs KB) → **Phase 52's two-layer model owns it**: `MerchantMapping` = private layer; `TransactionSignature`+`SignatureContribution` = shared k-anon layer; **`AILearningPattern` is superseded** (retire — §10.2).
4. **Transfer/loan detection** → **Phase 51 precedence is SSOT**: `resolveTransactionMatches()` runs *before* the categoriser; loan repayments are a transfer subtype with interest taken from the loan ledger. §3.
5. **Receipt matching in two places** → **kept, different jobs**: `reconcileSuggestedAction` (Phase 50 D.2) guards against duplicate *record* writes at confirm-time; `receiptMatcher` (Phase 42) matches a receipt to an existing *transaction*. §4. **Mechanism A (2026-07-19, MON-084/085/074/076):** `reconcileSuggestedAction` now decides through the ONE intake classifier's `source-signature` policy (`lib/intake/classifyIntake.ts` — identity = type + normalised name + owner, candidates ACROSS scopes, scope-compatibility rule: same scope or one side scopeless). INCOME converges across amount drift (a declared row and its reconciled twin are the same source); EXPENSE stays amount-bounded (same name at a far amount = two real costs — the confirm-loop conservatism). The link route's income + expense create branches, `POST /api/income` (409 on exact manual duplicate) and onboarding complete route through the same policy — one row per real source at every intake door. Neomatrix: `engine.intake.classifyIntake` + `law.intake.oneRowPerSource` (neobrain domain). **MON-094 (2026-07-21):** the classifier additionally exports `detectNonAssessable(name)` — conservative descriptor detection of NON-ASSESSABLE receipts (ATO tax refunds `Ato Ato00…`, internal transfers, loan drawdowns). The link route stores the detection at income create (`taxCategory: TAX_EXEMPT` + `taxNotes`), and `/api/tax/non-assessable-review` (+ `/admin/tax-review`) re-derives it for Reza's per-row confirmed reclassification of existing rows — assessability itself is decided ONLY by `determineTaxability`'s `NON_ASSESSABLE_TAX_CATEGORIES` override (one engine). Reza's rule 2026-07-21: tax gross = assessable income only; a false negative costs a click on the review surface, a false positive would silently understate tax, so the pattern list stays tight and lives in ONE function.
6. **`/analyze` vs `/analyze-for-form`** → **`analyze-for-form` is the proven single-step scan path** (Phase 50 A); the two-step `/analyze` is legacy (My Vault reprocessing) with known reliability caveats.

---

## 13. Source phase docs (superseded by this SSOT)

This document consolidates and supersedes the **design content** of the following. They remain as build history; for current architecture, read **this** doc.

| Phase | Contributed |
|---|---|
| **13** Transactional Intelligence | TIE, category hierarchy, `MerchantMapping` learning, recurring detection |
| **18** Bank Transactions | QIF/CSV import, AU bank detection, deterministic rules, Basiq priority |
| **25** Document Management Engine | DME, rule engine, provider abstraction, `Document`/`DocumentLink` |
| **26** Document Intelligence Engine | OCR + Gemini extraction, classifier, `DocumentAnalysis`, form auto-fill |
| **29** AI Transaction Categorisation | Gemini pipeline, confidence bands, learning DB, review queue, duplicate detection |
| **42** Consumer Bookkeeping Completion | `CanonicalCategoryRegistry`, splits, receipt matcher, vendor, tax-pack, engagement |
| **50** AI Document Router | dedup, reconciliation, confidence policy SSOT, learned routing, lifecycle, GCS |
| **51** Loan Ledger & Categorisation | loan-as-account ledger, transfer matching, resolution precedence, reconcile redesign |
| **52** Shared Categorisation KB | two-layer RAG KB, k-anon graduation, PII scrubber, Gemini-on-miss, write-back unification |

---

## 14. Neobrain on manual reconciliation — auto-apply (2026-06-27)

The first **behaviour** addition since the v1.0 consolidation. Until now Neobrain's learning loop (cascade → `applyToSimilarTransactions`) ran only on the **Basiq import** path, against `transactionReviewQueue`. On the live `unifiedTransaction` reconciliation surface (the Activity page + link dialog), categorising one transaction recorded the merchant mapping but did **not** propagate to other already-imported same-merchant rows.

**Added (Reza decision 2026-06-27 — auto-apply over suggest-only):** when a user categorises a transaction, Neobrain auto-applies that **user-confirmed** decision to other uncategorised same-merchant rows. This is not AI auto-execution — it extends the user's *own* decision to identical rows. Four guardrails bound it, and an Undo keeps it visible + reversible (refining the 2026-06-18 "AI suggests, user confirms" autonomy rule for the "propagate my own decision" case):

| Guardrail | Rule |
|---|---|
| 1 — exact merchant | standardised-merchant equality, never fuzzy/contains |
| 2 — same direction | IN/OUT must match — a same-merchant refund never sweeps into an expense category (§19.1) |
| 3 — uncategorised only | still-uncategorised + unlinked rows only; never overwrites, never touches transfers/investments |
| 4 — user-scoped | scoped to the authenticated user (§12.11); excludes the source row + explicit batch ids |

**Surfaces:** `lib/bookkeeping/applyToSimilarUnified.ts` (`applyCategoryToSimilarUnified` sweep + pure `buildSimilarUncategorisedWhere` guardrail builder + `getLearnedCategorySuggestions` read side — all SSOT-reuse the `merchantMapping` the link route writes); link route returns `autoApplied{count,appliedIds}` + a batch `unlink` for Undo; `/api/unified-transactions` GET enriches `suggestedCategoryLevel1`; the link dialog shows "applied to N · Undo"; the Activity page shows a sky "Suggested" pill on uncategorised rows. **Not** included: routing file/QIF imports through the full cascade (deferred — the bigger option).

---

## 15. Neobrain as the factual-grounding layer — Monitrax's "personal financial intelligence" (design, 2026-06-27)

> **Status:** DESIGN / not yet built. Reza directive 2026-06-27: *"I want neobrain to have 2 sets of data that the gemini ai agent makes all the ai decision and feedbacks based on these factual numbers and data … neobrain should be the reference for any ai feedback to avoid ai gemini to assume or guess based on fictitious numbers"* + *"be mindful of what data will be stored … just useful and relevant data for neobrain"* + *"something like the apple intelligence concept."*
>
> This section is the signed-off (9.4/10, §20.4) corrected plan. The v1 plan scored 7.2 and was held back; the gaps it surfaced (§15.7) are baked into this version.

### 15.1 The concept — three pillars (the Apple Intelligence mapping)

Neobrain becomes Monitrax's personal financial intelligence layer. Apple Intelligence is three things; each has a clean Monitrax analog:

| Apple Intelligence pillar | Neobrain pillar | State today |
|---|---|---|
| **Semantic Index** (structured personal data the model grounds on) | **Personal Financial Index** — the *FactPack*, a read-through assembled view over the canonical SSOTs | Mostly built (the snapshot is the index) |
| **App Intents** (typed registry of what the model can do/answer) | **Capability Registry** — typed Intents Neobrain orchestrates over | Partially built (tax tools + scenarios, scattered) |
| **Private Cloud Compute** (data stays private, never trains the model) | **CDR-grade privacy guarantee** | Enforced server-side (§13) — but the model-provider terms need explicit verification, see §15.6 Phase 0 |

**Why this fits Monitrax better than a phone:** Apple indexes on-device because they hold no server copy. Monitrax already holds the canonical data server-side, so the Index is a **zero-storage assembled view, not a duplicated index** — the Apple concept without Apple's storage cost. And Apple's "never trains on your data" pitch is, for a CDR-regulated money app, a requirement Monitrax already designs for.

### 15.2 The grounding contract (the anti-hallucination core)

The proven pattern already lives in the two highest-stakes surfaces — generalise it to ONE contract every AI surface uses:

- **CFO/Guide** (`lib/cfo/aiAdvisor.ts`): Gemini may not write a number; it attaches an `evidence.snapshotPath`, the server resolves it against `getMasterFinancialSnapshot()`, and any path that doesn't resolve is dropped (`resolveSnapshotPath`).
- **Tax advisor** (`lib/ai/tax-advisor/`): tool-calling + a validator that rejects any bare number not referencing a tool result (HR-1/HR-2).

**The one Neobrain rule:** *every figure in AI output is a typed reference into the FactPack; the server resolves it; a validator strips/rejects any un-referenced number. If a fact is not in the FactPack, the AI says it does not have it — it never estimates.*

Three states the contract must distinguish (gap-fix, §15.7-G5):
- **`value`** — present and fresh → render it.
- **`zero`** — genuinely $0 (e.g. no debt) → render "$0", a real fact.
- **`absent`** — not connected / not provided → refuse with a One Clear Action ("connect your loan to see this"), never "$0".

Each FactPack slice carries **`asOf` + staleness** (gap-fix G4); the AI qualifies "as of <date>" and refuses on stale-beyond-threshold rather than presenting a stale number as current.

### 15.3 The two datasets → three fact-types, mapped to existing canonical sources (zero new storage)

Reza named two datasets; the correctness rule needs three fact-**types**, each with a single canonical source. **Neobrain references these at request time and stores nothing new.**

| Fact-type | Canonical source (already exists) | New storage? |
|---|---|---|
| **1. User-specific values** (loans, properties, income, expenses, cashflow, debt, tax, super, emergency fund, health) | `getMasterFinancialSnapshot()` — the §6.1 SSOT | **None** — read-through |
| **2. App-level values** (category taxonomy, ATO brackets/thresholds, super caps) | `CATEGORY_HIERARCHY` (`lib/tie/types.ts`) + `taxYearConfig.ts` | **None** — config |
| **3. Derived facts** (projections, scenario outputs, health score) | Named engines ONLY (`lib/cfo/scenarios/*`, `lib/health/*`, `masterFinancialService`) — never AI prose | **None** — computed on demand |

**Provenance:** the **Neomatrix is the citation map for all three** — it encodes formula → authority → `file:line`, and (Phase 53 §9) **holds no values itself**. So the Neomatrix answers *"why is this number what it is / where did it come from"*; the snapshot/config/engines hold the *values*. (Gap-fix G3 — v1 wrongly conflated "app facts" with the Neomatrix.)

### 15.4 Storage discipline (Reza's explicit constraint)

- **Persist nothing new.** The FactPack is assembled fresh per request from the snapshot + config + engines, then discarded. No raw transactions, no PII, no duplicated snapshot table.
- **Reuse the one cache that already exists** (the 24h CFO advice cache + fingerprint). No second cache. Surfaces cache *rendered output*, never the raw FactPack.
- **Scope per capability:** each Intent declares which FactPack slices it needs (a debt question doesn't load depreciation schedules). Minimal payload = your storage point AND lower token cost / egress on every Gemini call.

### 15.5 Durability — bypass-proof at the build gate

For Neobrain to be *the* reference (not a convention), bypass must be impossible at build time, like `lint-financial-surfaces` / `neomatrix:check`:

- **`lint:ai-grounding`** ✅ **SHIPPED (Phase B.2, 2026-06-29)** — fails the build if any file making a user-facing Gemini text-gen call is neither REGISTERED (a grounded financial-narrative surface that keeps ≥1 grounding marker) nor ALLOWLISTED (a non-narrative/infra call, with a reason). File-registry enforcement (a single-gateway routing assertion was the original v1 design, but the Vertex one-gateway dedupe is parked to Basiq go-live (§15.6.1), so the gate enforces *grounding presence per surface* now — bypass-proof without depending on the parked gateway). `scripts/lint-ai-grounding.mjs`, wired into `vercel-build`.
- **One gateway** — delete the duplicate `lib/ai/gemini.ts` (self-flagged "known SSOT-violation duplicate" of `lib/ai/google/geminiClient.ts`); everything routes through one door.
- **Acceptance gate (ship blocker, §19/§20):** a hallucination test suite — golden FactPacks + adversarial prompts that try to elicit invented figures — asserting **zero un-referenced numbers** in output. No surface ships grounded until it passes.

### 15.6 Phased delivery (re-sequenced for risk — gap-fix G7)

| Phase | Scope | Why this order |
|---|---|---|
| **0 — Privacy verify ✅ DONE (2026-06-27)** | Verified Google's terms (not recalled). **Finding:** the app uses the **consumer Gemini Developer API** (`@google/generative-ai` + `GEMINI_API_KEY`); free tier *trains* on data + human-reviews (✅ confirmed NOT in use — paid tier, Reza 2026-06-27), paid tier doesn't train but *caches "in any country"* → conflicts with CDR matrix row 2.3 (AU-only). Recorded as CDR matrix Finding F-AI-1. | Gate cleared **with a remediation decision** (below), not a clean pass. |
| **0.5 — Migrate AI gateway to Vertex AI** ⏸ **PARKED (Reza 2026-06-28) → Basiq go-live** | Swap `@google/generative-ai` (API key) → `@google-cloud/vertexai` (project/location, WIF auth) behind ONE gateway interface; AU region (`australia-southeast1`) for data residency; no behaviour change to callers. **Deferred** — see §15.6.1 + `docs/compliance/CDR_BASIQ_GOLIVE_CUTOVER.md`. | Vertex gives contractual no-training + **AU residency** + DPA — restores row 2.3 for the AI path. **But** a live probe (2026-06-28) showed Sydney regional serves only `gemini-2.5-flash` (no `3.x`, no pro), so cutting over now = a capability downgrade. With no Basiq plan yet, Reza chose to keep the capable paid-tier models and defer the cutover (a documented pre-condition of go-live). |
| **A — Personal Financial Index** | `lib/neobrain/factPack.ts` — typed FactPack assembler over the 3 fact-types; `asOf`/staleness; `value`/`zero`/`absent`. | The Index everything grounds on. |
| **B — Grounding validator + gate** | `lib/neobrain/grounding.ts` (generalises `resolveSnapshotPath` + the tax validator) **DONE**; **`lint:ai-grounding` gate SHIPPED (Phase B.2, 2026-06-29)** — `scripts/lint-ai-grounding.mjs`, wired into `vercel-build` after `lint:financial-surfaces`. Walks `lib/`+`app/` for any user-facing Gemini text-gen call; each file must be REGISTERED (grounded, keeps ≥1 marker) or ALLOWLISTED (non-narrative/infra, with a reason). New AI call in an un-listed file → build fails. 15 AI-call files · 6 grounded · 9 allowlisted · 0 stale (raw-grep cross-checked). Test: `tests/neobrain/lintAiGrounding.test.ts`. | One contract, enforced — a new ungrounded surface fails the build, not the next audit (§22). |
| **C — Close the free-form surfaces FIRST** | Migrate `app/api/ai/debt-analysis`, `app/api/budget-analysis/generate`, `aiDocumentAnalyzer` onto the FactPack. **Live free-text surfaces grounded (2026-06-29):** cashflow summary (#1292), AI Advisor Q&A (#1294), CFO follow-up chat (#1295) via `groundNarrative`; debt-analysis projections engine-grounded (C.1). **C.2 — budget-analysis variable estimation (2026-06-29):** honest finding — this is *estimation, not narration of actuals* (the AI estimates untracked expenses, so `groundNarrative` would wrongly redact every legitimate estimate); it was already well-grounded (deterministic structural numbers + `validateVariableExpenseResponse` + ABS-benchmark fallback). Closed the one real gap — `groundVariableExpenseTotal` recomputes the headline total = Σ category estimates so it can't drift (±$50) from the visible breakdown. Document extraction stays confidence-governed (`confidencePolicy`), not narrated-aggregate — allowlisted. | These are where hallucination actually happens — net-new grounding = pure win, no regression risk. |
| **D — Migrate the proven surfaces LAST** | **CFO tax-rule grounding DONE (2026-06-29).** Research correction: the CFO is *already* number-grounded (`resolveSnapshotPath` = the original anti-hallucination guarantee the validator generalised), so a full FactPack migration would *restrict* its rich context-path citations — a downgrade. Instead: injected the canonical CURRENT TAX LAW into the CFO prompt (the real gap — tax *rules* from memory; reform-aware §12.14), number-grounding untouched; extracted `renderTaxLawLines` so the tax-law text is SSOT. **Resolver convergence (CFO `resolveSnapshotPath` ↔ Neobrain `resolveFactRef`) deliberately deferred** as a follow-up — needs the FactPack to cover the CFO's reach first. | Don't destabilise trust-critical working code; add grounding it lacks (tax law) without touching grounding it has (numbers). |
| **E — Capability Registry** | Lift the tax tools + scenarios into one typed Intent catalog Neobrain orchestrates over. | The "App Intents" pillar. |

Model the new modules in the Neomatrix `neobrain` domain (§21.2.1).

#### 15.6.1 Phase 0.5 operator provisioning (Vertex AI cutover) — ⏸ PARKED to Basiq go-live

> **⏸ PARKED (Reza 2026-06-28).** The canonical, self-contained playbook for this cutover is **`docs/compliance/CDR_BASIQ_GOLIVE_CUTOVER.md`** — read that when the Basiq trigger fires. This subsection is kept as the in-Phase summary; the cutover doc is the SSOT.
>
> **Why parked:** a live probe against `australia-southeast1` (Cloud Shell, 2026-06-28) showed Sydney **regional** serving only `gemini-2.5-flash` of our models — `gemini-3.5-flash` (current primary) and all pro models (`gemini-2.5-pro`, `gemini-3.1-pro-preview`) return **404** there. Cutting over today = a one-tier flash downgrade + loss of the pro tier. With **no Basiq plan**, Reza chose to keep the capable paid-tier (no-train) models now and defer the AU-residency cutover to go-live.
>
> **Already pre-staged (inert — no code reads these):** steps 1, 2, and 4-partial below are **done**. They cost nothing and are kept so the future cutover is a code+flag change, not a fresh provisioning round.

Operator steps (✅ = already done, pre-staged; ☐ = remaining at cutover). All non-secret identifiers, same as the existing Cloud SQL bootstrap vars (§13.6):

1. ✅ **Enable the Vertex AI API**: `gcloud services enable aiplatform.googleapis.com` (done 2026-06-28).
2. ✅ **Grant the runtime SA Vertex access** — `roles/aiplatform.user` granted to `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com` (the WIF SA Vercel already impersonates for Cloud SQL); least-privilege, not editor (done 2026-06-28).
3. ✅ **Region = `australia-southeast1`** (Sydney) for AU data residency → restores CDR matrix row 2.3.
4. ⚠️ **Env vars** — `VERTEX_PROJECT=monitrax-479700` + `VERTEX_LOCATION=australia-southeast1` are **set** on Vercel (Prod+Preview, 2026-06-28). `USE_VERTEX` is **deliberately unset** (the current Gemini path stays active until the gateway ships). No new secret — auth is the existing OIDC/WIF token.
5. ☐ **At cutover: re-probe in-region model availability** (Sydney's roster changes over time) and pin `VERTEX_MODEL_FLASH`/`VERTEX_MODEL_PRO` to whatever is AU-resident then; never silently fall back to a US/global region (that re-breaks row 2.3). Verified roster as of 2026-06-28: only `gemini-2.5-flash`.

**Code plan (safe, no-break) — to write at cutover:** a provider-pluggable gateway — Vertex when `USE_VERTEX=true` + project/location present, else the current **paid** Gemini API (the working path) as fallback. Same call interface, so no caller changes; the duplicate `lib/ai/gemini.ts` is repointed/removed in the same or the immediately-following PR (4 callers: `geminiOnMiss`, `trust-deed/geminiExtractor`, `analyze-for-form`, `entities/[id]/trust-deed`). `@google-cloud/vertexai` added to `package.json` (Approved-Dependencies §13.8). Model IDs come from configurable `VERTEX_MODEL_FLASH`/`VERTEX_MODEL_PRO` env vars (decouples the Sydney-resident model from code). Update `09_INFRASTRUCTURE_AND_DEPLOYMENT.md` + `docs/operational/security/02_IAM_AND_PERMISSIONS.md` in the cutover PR (§16.3).

### 15.7 The fork (Reza decision) + deferred scope

- **Read-vs-act fork → recorded as READ-AND-COMPUTE for v1** (Reza "ship it" 2026-06-27, taking the recommended default). Neobrain v1 grounds answers + runs scenarios + suggests; it does **not** execute money-moving/data-changing actions except behind the existing "suggest → confirm → undo" model (the §14 auto-apply is the template). **Action Intents deferred to v2** — a finance app earns the right to act only after it has proven it never lies about a number. *Flip this by changing this line if the decision changes.*
- **Proactive pillar deferred to v2** (gap-fix G8): Apple Intelligence is proactive + TRAIL-stage-matched, not just grounded Q&A. v1 is grounding (reactive); proactive contextual insight is named-deferred, not dropped.

### 15.8 Self-review record (§20.4)

3× adversarial review against requirements. **v1 = 7.2/10 (held back).** 8 gaps found and fixed: (G1) no bypass-proof gate → `lint:ai-grounding`; (G2) over-claimed privacy → Phase 0 verify-task; (G3) 2 fact-types → 3 + Neomatrix-is-provenance-not-values; (G4) no staleness → `asOf`/stale-refusal; (G5) zero-vs-absent → 3-state contract; (G6) no acceptance criteria → hallucination test suite; (G7) sequencing risk → free-form surfaces first, proven surfaces last; (G8) proactive pillar silently dropped → named-deferred. **v2 = 9.4/10** (the missing 0.6 is the Phase-0 privacy verification — a genuine unknown, not scored as solved until checked).

### 15.9 Tax-law grounding (Option A, 2026-06-29)

Reza asked whether the FactPack (the data the AI grounds feedback on) includes the relevant **rules and laws** (tax law, etc.), not just numbers. Gap found: the FactPack carried the user's tax *numbers* (engine-computed → grounded) but not the tax *laws* — so a general surface explaining *why* a number holds (a bracket, a rate, a cap) drew the rule from the model's training memory, the exact hallucination risk grounding exists to kill. The dedicated tax-advisor was already grounded (tools + knowledge pack); the general surfaces were not.

**Fix (Option A — match the engine):** `FactPack.reference.taxRules`, built by the pure `buildTaxRulesReference(config)` **entirely from `getCurrentTaxYearConfig()`** (the canonical SSOT — §12.2.1, never re-typed): resident brackets, tax-free threshold, Medicare levy + threshold, LITO, Super Guarantee rate, concessional/non-concessional caps, Div 293, CGT discount + min-hold, transfer balance cap, and the **8 Phase 41E reform measures with commencement status** (the engine's `*CommencementVerified` flags → "in-effect" vs "announced-not-in-effect"; §12.14). `buildGroundingClause` surfaces this as a CURRENT TAX LAW block with two new rules: ground every tax-rule statement on it (never recall from memory) and never present an un-assented reform as current law. The most-cited single rules are also resolvable `app` facts. Scope deliberately **matches what the engine canonically models** — no broader AU tax (FBT detail, state taxes, GST) until those have canonical sources (Option B, deferred).

---

## 16. Phase 54.1 — merchant-noise denoising (P1, 2026-07-01)

> **Origin (Reza, 2026-07-01):** a live CBA feed row `"09:19hjs North Parramattanorthmead"` (time `09:19` + `HJS` = Hungry Jacks + suburb, all glued in one line) would **not** match a later `"13:42hjs Blacktown"` from the same vendor — so Neobrain never recognises them as one merchant. Reza's follow-up insight reframed the fix: *"the large number of possible transaction descriptions might be very hard to code"* — you cannot hand-code the long tail.

### 16.1 The verified gap (no guessing — read in source)

Two independent merchant-identity keys existed, neither of which stripped the leading time or resolved the `hjs` abbreviation:

| Key | Producer | Match | Why HJS failed |
|---|---|---|---|
| Per-user `merchantStandardised` | `normaliseMerchantName` (`lib/bank/normalisation.ts:95`) | EXACT equality (auto-apply + suggestions) + substring by rules | date regex was `\d{2}/\d{2}` only (no colon-time); `hjs` in no table |
| Shared-KB signature | `scrubToSignature` (`lib/categorisation/kb/scrubSignature.ts`) | EXACT + graduated token-prefix | date regex `[\/\-.]` (no `:`); `hjs` in no table |

Both reduced the two rows to **different** strings → learning never carried across time/location noise.

### 16.2 The fix (build ON existing work — §12.2.1)

ONE shared, pure helper `lib/bank/merchantNoise.ts` used by **both** producers (so they can never drift):

1. **`stripTransactionTimes`** — removes glued/standalone `HH:MM(:SS)`. General: helps *every* timestamped row and cleans the input for the AI layer too. This is the structural win.
2. **`expandMerchantAliases`** — rewrites **evidence-gated, whole-token** AU abbreviations to the canonical name (`hjs → hungry jacks`, verified from Reza's sample). Applied *after* time-strip (order matters — `09:19hjs` has no word boundary before `hjs` until the time is removed). The canonical name then resolves via the existing `MERCHANT_MAPPINGS` / `CATEGORISATION_RULES` / KB seed.

Result: `09:19hjs North Parramatta` and `13:42hjs Blacktown` **both → "Hungry Jacks"** → import-time rules *and* per-user auto-apply match.

**Scope discipline:** conservative on trailing location (no arbitrary trailing-word stripping — that would risk merging `SMITH ST CAFE` with `SMITH ST BAR`; the guarded token-prefix mechanism owns trailing-location, and unifying the two keys is **P2**). The alias table is kept **tiny and evidence-gated** — it is *not* the long-tail answer (§16.4). A wrong alias mis-files real money (§19), so entries are never populated speculatively.

### 16.3 Worked example (§19.2) + over-merge guardrail

- `renormaliseMerchant('09:19hjs North Parramattanorthmead')` → `'Hungry Jacks'`; `renormaliseMerchant('13:42hjs Blacktown')` → `'Hungry Jacks'` → equal ✓ (pinned in `tests/neobrain/merchantNoise.test.ts`).
- **Over-merge guardrail (§19):** `'08:00 SMITH ST CAFE MANLY'` ≠ `'22:00 SMITH ST BAR MANLY'` (distinct merchants stay distinct) ✓. Whole-token alias never rewrites a substring (`'ashjs'` unchanged) ✓. Existing `scrubToSignature` behaviour unchanged (`WOOLWORTHS 1234 SYDNEY` → `WOOLWORTHS SYDNEY`) ✓.

### 16.4 The long tail is NOT solved by code (Reza's point) — deferred to the AI+KB layer

Hand-maintaining an alias table caps out fast. The scalable answer is the already-built-but-gated **shared KB (layer 3) + Gemini-on-miss (layer 4)**: the AI reads a messy description *once*, a human confirms, and it's remembered forever (the tail shrinks, doesn't grow). **P1 (this section) is the free/safe denoise that makes every layer — including the AI — better.** Enabling the AI+KB tail is a **separate plan** (Reza decision 2026-07-01: "ship P1 denoise now, then plan turning on AI+KB tail"), presented for cost/accuracy sign-off before any build.

### 16.5 Neomatrix (§21.2)

- `engine.scrubSignature.scrubToSignature` anchor 46→47 + formula updated (denoise pre-step).
- **New:** `engine.normalisation.normaliseMerchantName` (the per-user identity producer — a modelled gap, §21.2.1 rule 4) + `law.neobrain.merchantNoise` (the shared denoise rule). Edges: normaliser → `categoriseTransaction` (feeds), both producers → `law.neobrain.merchantNoise` (governed-by). `npm run neomatrix:check` green.

### 16.6 Self-review record (§20.4)

3× adversarial review against requirement. **v1 8.5 → v2 10/10.** The critique changed the build: (a) do **not** introduce a competing `merchantKey()` — harden the existing SSOT normaliser + a shared helper (§12.2.1); (b) leading-time strip is unconditionally safe, but trailing-location strip is **not** — keep it conservative (over-merge misstates spend-by-category + tax sums, §19); (c) split the known-abbreviation fix (P1, ships now) from per-user key-unification (P2, behaviour-changing, separate PR). Financial build → **10/10 required** and met (worked example + over-merge guardrail + no regression).

### 16.7 P2 — shared numeric-noise strip + per-user key unification (2026-07-01)

> **Reza chose the reframed P2** after I surfaced a regression finding: a *naive* "merge the two keys" would break known-merchant location-independence (Woolworths Sydney and Melbourne both resolve to "Woolworths" today; the KB signature keeps location, so switching to it would stop them matching). The safe reframe keeps that behaviour.

**The two keys have complementary semantics** — `merchantStandardised` (per-user) resolves **known** merchants to a canonical short name (location-independent) and keeps everything for unknowns; `scrubToSignature` (KB) keeps location but strips more numeric noise. Rather than merge the *outputs* (which regresses), P2 unifies the **transforms**: the numeric-noise strip is extracted to ONE shared helper `stripMerchantNumericNoise` (BSB / card masks / reference tails / long free-standing digit runs) used by **both** producers (§12.2.1).

**What P2 delivers:** the per-user identity key now strips store-numbers/refs/card-masks, so `SOMESHOP 1234 SYDNEY` and `SOMESHOP 9981 SYDNEY` (same store, different store number) collapse to one key → per-user auto-apply matches them. **No location stripping** — `SOMESHOP SYDNEY` ≠ `SOMESHOP MELBOURNE` stay distinct (cross-location matching for *unknown* merchants remains the guarded KB token-prefix / AI-tail job, not done here). **No regression** — known merchants still resolve to their canonical short name regardless of location, and digits glued inside a token (`1300SMILES`) are preserved (word-boundary-anchored).

**Discovery seam (the three per-user match sites all key on `merchantStandardised`):** `buildSimilarUncategorisedWhere` (auto-apply), `getLearnedCategorySuggestions` (suggestion pill), and the `MerchantMapping` write. Because they all key on the output of `normaliseMerchantName`, improving that ONE producer fixes all three — **no schema change, no match-site change**.

**Verification (§19.2):** `SOMESHOP 1234 SYDNEY` == `SOMESHOP 9981 SYDNEY` → `"Someshop Sydney"` ✓; over-merge guardrail `…SYDNEY` ≠ `…MELBOURNE` ✓; no-regression `WOOLWORTHS 1234 SYDNEY` == `WOOLWORTHS TOWN HALL MELBOURNE` → `"Woolworths"` ✓; `scrubToSignature` refactor keeps all prior tests green (38 passed). **Self-review §20.4: v1 9.0 → v2 10/10** (the reframe from the regression finding was the 10/10 unlock).

**Neomatrix:** `stripMerchantNumericNoise` folded into `law.neobrain.merchantNoise` + both producer node formulas; `neomatrix:check` green.

---

## 17. Phase 54.2 — reconcile onto ONE AI categoriser (Step-2a, 2026-07-01)

> **Finding that reshaped Step-2** (verified file:line, not guessed): there were **two** AI categorisers. Enabling the gated `geminiCategoriseOnMiss` (`KB_GEMINI_ENABLED`) would not have touched the main import — because the import ran a *different*, older bulk-Gemini path.

### 17.1 The two engines (the §12.2.1 violation)

| Path | Engine | Gate | Used by |
|---|---|---|---|
| **A (retired)** | `categoriseWithLearning` → `categoriseInBatches` (`aiCategorisation.ts`) | `settings.enableAI` (**default true**) + `GEMINI_API_KEY` | main import (`app/api/accounts/[id]/import/route.ts:247`) + Basiq sync (`basiqSync.ts:471`) |
| **B (canonical)** | `categoriseTransaction` → `geminiCategoriseOnMiss` (KB cascade) | `KB_GEMINI_ENABLED` (default off) | single-row (`unified-transactions/route.ts`) |

Path A could **auto-file an AI guess silently** (its results flowed through `classifyByConfidence`, which auto-accepts ≥0.90) — contradicting "AI proposes, user confirms" and the KB echo-chamber rule.

### 17.2 The reconciliation (surgical — Reza decision 2026-07-01)

- **Route import unknowns through the KB cascade** — `categoriseWithLearning`'s `needsAI` branch now calls **`categoriseUnknownsViaCascade`** (`aiCategorisation.ts:684`), a thin adapter that maps `NormalisedTransaction → UnifiedTransaction` and calls `categoriseTransactionBatch` with **no** `merchantMappings` (skips the cascade's layer-1 — merchant-learning already ran), so unknowns get rules → shared-KB prior → Gemini-on-miss → fallback. **The import route + Basiq sync are unchanged** — the adapter preserves the consumed `AICategorizationResult` shape.
- **AI never auto-files** — `classifyByConfidence` now demotes `source==='AI'` out of `autoAccept` (always review → user confirm). New `law.neobrain.aiNeverAutoFiles`. Deterministic sources (RULE/USER/KB/transfer) auto-file as before.
- **Retire Path A** — `categoriseInBatches` + `categoriseWithAI` marked `@deprecated` (no runtime caller); **full deletion is the immediate follow-up PR** (kept here to isolate the behaviour change from the code removal, and because this container can't compile-verify a large deletion — the preview build confirms the cascade path first).

### 17.3 Behaviour changes (flagged — not silent)

1. **AI at import now needs `KB_GEMINI_ENABLED=true`** (operator env). Until flipped, imports categorise via rules + shared-KB only; genuinely-unknown merchants land **uncategorised in review** (not AI-guessed). **Flip the flag when merging** to keep AI on import — now propose→confirm, never silent.
2. **`isEssential`/`isRecurring` on AI-unknowns default `false`** (the cascade doesn't infer them; the user sets them on confirm). Learned/rule rows keep theirs.
3. **Transfer parity preserved** — both engines use the `isTransferDescription` SSOT.

### 17.4 Verification (§19.2) + self-review (§20.4)

- `classifyByConfidence`: AI@0.97 → **needsReview** (never auto-file) ✓; RULE/USER/KB@≥0.90 → autoAccept ✓; anything <0.70 → requiresManual ✓ (`tests/neobrain/cascadeReconcile.test.ts`, 10 tests).
- Adapter: `CategorisationResult → AICategorizationResult` maps category/confidence/source, defaults essential/recurring false, derives direction, undefined → Uncategorised (never drops a row) ✓.
- 48 neobrain/scrub tests pass; Neomatrix anchors fixed (`classifyByConfidence:549`, `categoriseWithLearning:718`, `processUserConfirmation:851`) + new `engine.aiCategorisation.categoriseUnknownsViaCascade` + `law.neobrain.aiNeverAutoFiles`; `neomatrix:check` green.
- **Financial build §20.4: v1 8.5 → v2 10/10.** The critique tightened scope to surgical (swap the one call, keep the import structure), separated the risky deletion into a follow-up, and forced the source-guard to be exclusive/exhaustive across the three bands.
- **Step-2b (deferred, decided):** the "compare online" enrichment will use **Gemini-native Google-Search grounding** (same provider, de-identified token only) — a separate PR after this lands + `KB_GEMINI_ENABLED` is on.

---

## 18. Phase 54.2b — grounded merchant identification ("compare online", 2026-07-01)

> **Reza's vision:** *"the AI helper to read the transaction description, compare against the merchant list and even compare online … 'this looks like Hungry Jacks, is that correct?'"* Reza decision 2026-07-01: build now on the current SDK, **gated off**; verify on prod when enabled.

### 18.1 What it does

A **last-resort** step inside `geminiCategoriseOnMiss` (`lib/categorisation/kb/geminiOnMiss.ts`): when the free/cheap **ungrounded** pass missed or scored `< 0.6`, and grounding is enabled, a single **Gemini 2.x `google_search`-grounded** call looks the merchant up on the web and proposes a **merchant NAME + category** — surfaced as *"This looks like Hungry Jacks — confirm?"* (`merchantGuess` on `GeminiCategoryResult`).

### 18.2 The guarantees (built on what already exists)

- **De-identified egress only (CDR §13.3):** `scrubToSignature` runs ONCE at the top of `geminiCategoriseOnMiss`; both the ungrounded LLM call **and** the grounded web search receive only the scrubbed token (e.g. `HUNGRY JACKS NORTH PARRAMATTA`) — never the raw description, amount, or account. Same egress class already accepted for Gemini-on-miss.
- **Never auto-files:** grounded results are `source: 'AI'` → demoted out of auto-accept by `classifyByConfidence` (§54.2) → always the user's confirm.
- **Cost-bounded:** grounded call is LAST resort only (ungrounded miss / `<0.6`), separate gate.
- **Never breaks categorisation:** any grounding error (incl. the pinned SDK not supporting the tool) → the ungrounded result is kept; grounding is pure enrichment.

### 18.3 The gate + the SDK caveat

- **`KB_GEMINI_GROUNDING_ENABLED`** (default **off**) — merging egresses nothing; enabling is a CDR-posture decision (operator).
- `@google/generative-ai@0.24.1` under-types the 2.x tool (its `Tool` only declares `googleSearchRetrieval`); we pass the correct `googleSearch` tool via a narrow cast — forwarded to the REST API. Grounding is incompatible with JSON mode, so it is a **text** call parsed by `parseGroundedMerchantResult` (strips fences, validates level1, clamps confidence). **This path cannot be verified in the sandbox** (no API key + live search); it is verified on prod when the flag is turned on.

### 18.4 Data residency (the Vertex path)

Runs today on the **global** Gemini API (pre-Basiq, per Reza's standing decision — synthetic data, de-identified token only). At Basiq go-live it rides the **Vertex-AU (`australia-southeast1`) cutover** (§15.6.1, parked on Sydney model availability), where Google-Search grounding is first-class + AU-resident. Expect this grounded call to be **re-pointed at Vertex** then.

### 18.5 Neomatrix + tests + self-review

- **Neomatrix (§21.2):** new `engine.kbGrounding.geminiIdentifyMerchantGrounded` + edges (`scrubToSignature → grounded-identify` feeds; `geminiCategoriseOnMiss → grounded-identify` feeds; `→ law.neobrain.deidentification` governed-by); `geminiCategoriseOnMiss` formula + anchor updated. `neomatrix:check` green.
- **Tests:** `tests/neobrain/groundedIdentify.test.ts` (9) — parser robustness (fences / prose / null merchant / invalid level1 / clamp / unparseable) + gating (off by default → no web-search call).
- **Self-review §20.4: v1 8.5 → v2 10/10** — the critique made grounding a bounded last-resort (not every unknown), forced the de-id-once-at-top ordering, and made every failure fall back to the ungrounded result so categorisation can never break.

---

## 19. Phase 54.2d — re-categorise backfill for EXISTING rows (2026-07-01)

> **Reza, seeing a pre-change HJS row still noisy:** *"I have checked the transaction and it is still the same as before. no AI suggestion."* The honest gap: every engine improvement this session runs at **import time** — nothing re-touches rows already in the ledger.

### 19.1 What it does

A **user-triggered** backfill (`recategoriseUncategorised`, `lib/bank/recategoriseExisting.ts`) that re-runs the current **denoiser + deterministic cascade** over the user's existing **uncategorised** rows, so the improvements reach data already imported. Surfaced as a **"Re-scan existing"** button on the Review tile (`ConfidenceReviewCard`), `POST /api/unified-transactions/recategorise`.

### 19.2 Safe + cost-free by design

- **Deterministic layers only** — `categoriseTransaction(..., { skipAiOnMiss: true })` (new option) skips the paid Gemini/grounded layer, so a full-ledger re-scan can never trigger an unbounded LLM bill. The AI tail stays import-time / on-demand.
- **Re-normalises `merchantStandardised`** (P1/P2) → `16:49hjs North Parramattanorthmead` becomes **Hungry Jacks**, which then matches the rules **and** the read-time suggestion. This alone fixes the HJS class.
- **§12.11 guarded** — only touches rows that are **still uncategorised + unlinked + not transfer/investment** (guard re-asserted at write time via `updateMany`); only **fills** a category from a **non-AI RULE/USER/KB** match ≥ 0.9. A category the user set is **never** clobbered; AI **never** auto-files (§54.2).
- **SSOT** — reuses the one cascade + the one `renormaliseMerchant`; no parallel categoriser. Pure write-policy `planBackfillWrite` is unit-tested.

### 19.3 Scope note

54.2d/f v1 does **not** run the grounded AI over existing unknown rows — those get a clean name + rules/suggestion, and once the user categorises one, auto-apply sweeps its siblings. **54.2g (below) adds that opt-in AI tail.**

### 19.4 Verify + self-review

`tests/neobrain/recategoriseBackfill.test.ts` (9) — write-policy (AI/FALLBACK never fill; RULE/USER/KB ≥0.9 fill; rename only when changed; never write "Unknown") + `skipAiOnMiss` (rules still resolve, unknowns fall back with no LLM). `tsc` clean; Neomatrix new `engine.recategorise.recategoriseUncategorised` + edges; `neomatrix:check` green. **§20.4 v1 8.5 → 10/10** (the critique forced deterministic-only for cost safety + the write-time guard re-assertion).

## 19A. Phase 54.2g — cost-bounded AI re-scan over unknowns ("Ask AI for the rest") (2026-07-01)

**What it does.** An OPT-IN second pass on the "Re-scan existing" tile. After the free deterministic pass, the rows STILL unknown are handed to a cost-bounded Gemini tail (`aiSuggestDistinctUnknowns`) that proposes a category — and, when the grounded pass names the merchant, a clean display name — as an unconfirmed **suggestion** the user confirms.

**Cost bound (the load-bearing design).**
- **One Gemini call per DISTINCT merchant** — still-unknown rows are grouped by de-identified signature (`scrubToSignature`), so N noisy rows from one vendor cost ONE call, and every row of that vendor reuses the single result.
- **Hard cap** `MAX_AI_MERCHANTS_PER_RUN = 50` distinct merchants per run; `aiCapped` surfaces "more remain — run again" (no silent truncation).
- **Opt-in + gated** — a separate "Ask AI for the rest" button; no-op when `KB_GEMINI_ENABLED` is off. The free deterministic button is unchanged.

**Stored so future similar rows need no call?** Yes — via **user confirmation**, never by caching an unconfirmed guess (§54.2 anti-echo-chamber). On confirm the existing learning fires: private `merchantMapping` (that user → zero AI thereafter) + a shared-KB vote (`recordContribution`) that graduates to a global prior at K distinct users (everyone → zero AI). Within a run, signature-dedup already prevents per-row re-calls.

**Never auto-files (§54.2).** `planAiSuggestionWrite` writes `categoryLevel1/2/subcategory/confidenceScore` (+ cleaned name from a grounded guess) but NEVER `userCorrectedCategory` — the row stays in the review queue. §12.11 guard re-asserted at write time; only de-identified signatures reach the LLM (transfers/PII skipped).

**Tidy-up scope (answering Reza's Q).** Merchant-name tidy-up is automatic-by-code at IMPORT for ALL rows (`normaliseMerchantName`), and a full-ledger `POST /unified-transactions/renormalize` route re-cleans all rows regardless of category.

**54.2g.1 — broadened (Reza 2026-07-01: "yes … broaden the tidy up").** The "Re-scan existing" button now tidies names on **ALL** rows regardless of category via a shared `renameAllMerchants(userId)` — a cosmetic, name-only, §12.11-safe pass (touches only the derived `merchantStandardised`, never category/amount/links/`userCorrectedCategory`), run as **Pass A** before the uncategorised category-fill Pass B. The `renormalize` route was repointed to the same helper (SSOT §12.2.1 — one source, no duplicate loop). So a row confirmed long ago now also gets "16 49hjs North Parramatta" → "Hungry Jacks" without its category being touched.

**Verify + self-review.** `tests/neobrain/recategoriseBackfill.test.ts` (+5, 14 total; 116 neobrain green) — `planAiSuggestionWrite` never sets `userCorrectedCategory`, cleans name from a grounded guess, no-op on null/empty level1. `tsc` clean; Neomatrix new `engine.recategorise.aiSuggestDistinctUnknowns` node + edges (`recategorise → aiTail → geminiCategoriseOnMiss`), anchors fixed (§21.2.1), `neomatrix:check` green (149/149). **§20.4 financial build 10/10** (v1 per-row → dedup-by-signature + cap; durable no-repeat = confirmation→KB graduation, not guess-caching).

---

*Phase 54 v1.0 — Neobrain consolidation SSOT. §14 (2026-06-27) adds the manual-reconciliation auto-apply loop; §15 (2026-06-27) is the factual-grounding-layer design (Apple Intelligence concept — Personal Financial Index + Capability Registry + privacy guarantee; zero-storage; bypass-proof gate; read-and-compute v1). Governed by CLAUDE.md §0 (four lenses), §12.2.1 (one source), §13.3 (CDR sanitisation), §19.1 (actuals), §20.4 (10/10 financial builds), Part 21 (Neomatrix). Update this doc — not the superseded phase docs — when the AI-perception architecture changes (§16 doc-sync).*
