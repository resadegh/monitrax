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

## 10. Roadmap — growing Neobrain smarter (the scope the user wants)

Ordered cheapest/safest first. Each increment must mean **fewer confirmations**, behind the same confirm-gated contract (§0.2 psychology lens).

1. **Unify the two learning stores.** Transaction-side (`MerchantMapping`) and document-side (`learnedRouting`/`VendorEntityHint`) are the same idea ("the user taught us X"). Converge their write/read into one Neobrain memory API.
2. **Retire the legacy `AILearningPattern`** in favour of `TransactionSignature`/`SignatureContribution` (cheaper, k-safe, auditable) — §12.3.
3. **KB embeddings (Phase 52.5b, deferred):** pgvector in Cloud SQL vs Vertex Vector Search (§12.7 evaluation) for semantic near-miss matching beyond token-prefix.
4. **From categorising → explaining → anticipating:** recurring-bill detection, anomaly flags, "this looks tax-deductible" — each a *suggestion* surfaced at the right TRAIL stage.
5. **CDR/Basiq ingestion (Phase 51.3):** the same store/engine, source-agnostic (QIF now → Basiq later).
6. **Backfill the Neobrain Neomatrix domain** as engines are added (learned-routing read/retention-clock/receipt-matcher nodes; ui-surface nodes for the review inbox + scan flow).

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
5. **Receipt matching in two places** → **kept, different jobs**: `reconcileSuggestedAction` (Phase 50 D.2) guards against duplicate *record* writes at confirm-time; `receiptMatcher` (Phase 42) matches a receipt to an existing *transaction*. §4.
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

*Phase 54 v1.0 — Neobrain consolidation SSOT. Documentation/model only; no behaviour changed. Governed by CLAUDE.md §0 (four lenses), §12.2.1 (one source), §13.3 (CDR sanitisation), §19.1 (actuals), Part 21 (Neomatrix). Update this doc — not the superseded phase docs — when the AI-perception architecture changes (§16 doc-sync).*
