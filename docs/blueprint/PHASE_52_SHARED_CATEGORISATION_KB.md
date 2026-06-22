# Phase 52 — Shared Categorisation Knowledge Base (AI transaction recognition engine)

> **Origin (Reza, 2026-06-21):** *"a comprehensive AI categorisation and transaction recognition
> engine which should have a database that keeps getting updated as we go by all users' inputs…
> the AI itself would not learn from Monitrax categorisation unless there is a database kept in
> Monitrax DB and updated every time users confirm or categorise transactions. AI should always
> refer to this database for any categorisation… this way the Monitrax Gemini AI will get smarter
> about Australian transactions."*
>
> This is the **engine that powers Phase 51.2** (the categorisation-overwhelm overhaul). TRAIL
> stage: **Track** (My Accounts).

## 1. What this is (named correctly)

A **living knowledge base in Monitrax's DB that the AI consults on every categorisation, enriched
by every user's confirmations** — i.e. **retrieval-augmented (RAG)**, NOT fine-tuning Gemini.
The intelligence lives in our DB; Gemini reasons over it. Instant to update, auditable, reversible,
and it compounds into Australian-transaction intelligence that is *ours*.

It is the cross-user evolution of the existing per-user `MerchantMapping` (learn-on-correction).

## 2. The two-layer architecture (load-bearing — keeps it cheap + fast)

Most transactions must NEVER touch the LLM:

1. **Deterministic lookup (free, instant)** — merchant/pattern → category. ~90%+ of transactions
   are repeat/known merchants → resolve by lookup, no Gemini call.
2. **Gemini-on-miss (rare, RAG)** — only for genuinely unknown/ambiguous descriptions; the KB is
   fed to Gemini as *context* ("closest known AU patterns + community categories — classify this").
   Gemini's answer, once user-confirmed, **writes back to the KB**.

**Lookup-first, LLM-on-miss, both feed the same growing KB.** This is why it's viable — AI
categorisation was cut 2026-05-09 for cost; the KB absorbs the volume so the LLM only sees the tail.

## 3. DECIDED — sharing/privacy posture (Reza, 2026-06-21)

**Hybrid: private + k-anon shared.** Each user has **private** mappings (authoritative for them);
patterns confirmed by **≥k distinct users** graduate to a **de-identified shared KB** that acts as a
**prior** (never an override). Gets collectively smart while keeping a clean privacy line.
(Rejected: fully-shared — loosest privacy; curated-global-only — learns too slowly.)

## 4. Data model — the knowledge unit

Store a **de-identified merchant signature → category distribution**, NOT a copy of transactions.

```
TransactionSignature (the SHARED KB — aggregate only, never per-user rows)
  id
  pattern            // normalised signature, e.g. "WOOLWORTHS" — reuse normaliseDescription()
                     //   (uppercased; store-numbers / dates / ref-numbers / BPAY refs stripped)
  matchType          // EXACT | TOKEN(keyword) | MCC | REGEX | EMBEDDING
  region             // 'AU' (Australian focus; future-proofs multi-region)
  mcc                // merchant category code when known (strong signal)
  categoryVotes      // JSON distribution e.g. { "Groceries": 412, "Household": 18 } ← self-correcting
  distinctUserCount  // k-anonymity gate
  amountHintMin/Med/Max  // WEAK secondary tiebreaker only — coarse range, never a user's figure
  confidence         // derived = dominant share of categoryVotes
  source             // SEED | USER_CONFIRMED | AI_SUGGESTED
  lastConfirmedAt
```

Per-user layer stays in `MerchantMapping` (or its evolution): private, authoritative-for-that-user.

**Indicators ranked by trust:**
1. **Keywords / normalised merchant** — PRIMARY (~80% of signal).
2. **MCC** — STRONG (seed from existing `lib/bank/mccCatalog.ts`).
3. **Price/amount** — WEAK tiebreaker only (ambiguous merchants); coarse range, most privacy-sensitive.

The `categoryVotes` distribution makes it self-correcting: confidence = dominant share; one user
can't flip an established pattern.

### 4.1 How we identify "the same pattern" and keep count (Reza Q, 2026-06-21)

**Identification = normalisation into a canonical signature.** Two users' raw descriptions
("WOOLWORTHS 1234 SYDNEY 05/06", "WW METRO 4521") must collapse to the *same key*. The pipeline:

1. **Normalise** raw description → signature via the existing `normaliseDescription()` (uppercase;
   strip digits/dates/reference numbers/store numbers/BPAY refs/location tails; collapse whitespace)
   + merchant standardisation + MCC. The **normalised signature is the identity key** — same
   signature = "the same pattern".
2. **A private contribution ledger does the counting** — a per-`(signature, user)` row:

   ```
   SignatureContribution (PRIVATE — never exposed cross-user)
     signatureId    // FK to the TransactionSignature key
     userId
     category       // what THIS user categorised it as (FK CanonicalCategoryRegistry)
     updatedAt
     @@unique([signatureId, userId])   // one vote per user per pattern; lets them change it
   ```

   This ledger is the **source of truth for counts**: `distinctUserCount` = COUNT(distinct userId)
   for the signature; `categoryVotes` = tally of `category` across contributions. The `@@unique`
   guarantees a user is counted once and can revise their vote (revisions re-tally, no double-count).
3. **Graduation at k.** A signature is **private/provisional** until `distinctUserCount ≥ k` (k≥5 at
   launch) — used only for its contributing users. Once it crosses k, it graduates to **shared/global**
   and becomes a prior for everyone. (The shared `TransactionSignature` row exposes only the aggregate
   `categoryVotes` + `distinctUserCount` — never the contribution ledger.)
4. **Variant collapse.** v1 matches on exact-normalised signature + token + MCC. The fuzzy tail
   ("WW METRO" vs "WOOLWORTHS") is handled later by **embeddings** (§6 upgrade) so near-variants map
   to the same signature.

So: **normalise → identity key; per-user contribution ledger → distinct-user count + vote tally →
graduate to shared at k.** The ledger also enforces the §5 guardrails (per-user override = the user's
own contribution always wins; k-anonymity = the graduation gate).

## 5. Guardrails (this is where it lives or dies — compliance + architect)

Cross-user learning from CDR-derived data → privacy is the GATING constraint (Part 13).

1. **Scrub PII before the shared KB write.** Bank descriptions can contain people/addresses/account
   numbers ("TFR TO JOHN SMITH", "RENT 12 SMITH ST"). Drop person-to-person transfers; strip
   names/numbers from the signature. A *merchant* enters the global KB; a *person* never does.
2. **k-anonymity graduation** — a pattern goes shared only after **≥k distinct users** (e.g. k≥5)
   confirm it. Seen-by-one stays private (low value + potentially identifying).
3. **Per-user override always wins** — a user's own correction beats the crowd for them. Global is a
   prior, never an override; nobody's screen changes because a stranger categorised differently.
4. **Poisoning resistance** — free from the vote distribution + the k-gate.
5. **CDR stance documented** in `CDR_BASIQ_COMPLIANCE_MATRIX.md` before Basiq submission:
   de-identified aggregate categorisation intelligence vs consumer-data disclosure.

## 6. Integration (reuse, not rebuild)

New layer in the **existing** TIE precedence chain:
`user's own mapping → shared-KB prior → rules → bank/MCC → Gemini-on-miss (KB as context)`.
Evolve `MerchantMapping` into the two-tier (private + shared) model. **Seed** the KB from
`mccCatalog` + a curated AU merchant list so it's smart on **day one**. Canonical categories stay in
`CanonicalCategoryRegistry` (SSOT — votes reference registry rows).

**Upgrade path:** vector **embeddings** (pgvector / Vertex) so "WW METRO 1234" matches "WOOLWORTHS"
semantically. Start with normalised-exact + token + MCC (deterministic, free); add embeddings only
for the fuzzy tail (GCP-first, §12.7).

## 7. Phasing (each step shippable + testable)

- **52.1 — KB schema + write-back:** `TransactionSignature` table + the PII-scrub + k-anon
  graduation + vote-update service. Confirmations feed it (no UI change yet).
- **52.2 — lookup-first categoriser:** insert the shared-KB prior into the TIE precedence chain;
  measure hit-rate. Still no LLM.
- **52.3 — Gemini-on-miss (RAG):** KB-as-context prompt for the unknown tail; confirmed answers
  write back. Cost-gated.
- **52.4 — seed + embeddings:** seed from mccCatalog + curated AU list; add the embedding fuzzy-match
  for the tail.
- **52.5 — surfaces (= Phase 51.2):** review-exceptions inbox + "apply to past/future" + ATO-label
  mapping, powered by this engine.

## 8. Risks
- **Privacy/CDR** (the dominant one) — §5 guardrails; needs the documented CDR stance.
- **Cost** — mitigated by lookup-first; LLM only on the tail.
- **Quality/poisoning** — vote distribution + k-gate + per-user override.
- **Cold start** — solved by seeding.
- **Category drift** — votes reference the canonical registry; never free-text categories.

## 8a. Legal & compliance documentation (updated 2026-06-21)

The de-identified cross-user learning is disclosed in the documents users rely on / sign off:

- **`docs/legal/privacy-policy.md` §4.1** (new) — what the shared knowledge base is, that it stores
  only de-identified patterns + aggregate counts, PII-scrubbing, k-anonymity, per-user precedence,
  no sale / no general-model training; **§6.2** cross-reference for CDR-derived patterns.
- **`docs/legal/05_cdr_consent_notice_template.md`** — a plain-English "improving categorisation
  (de-identified)" disclosure in the CDR consent notice.
- **`docs/policy/CDR_DATA_MINIMISATION.md`** — the minimisation controls (de-identify before use,
  PII scrub, k-anonymity, no sale/no training, consumer precedence).
- **`docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`** — the CDR posture row (de-identified data;
  Privacy Safeguard alignment; status = DESIGN until the PII-scrubber + written de-identification
  procedure ship).

**PDF regeneration owed:** `docs/legal/monitrax_privacy_policy_v1.pdf` (+ any consent-notice PDF) are
generated artefacts — regenerate from the updated `.md` before they're served to users. **Build-time
gate:** no shared-KB write ships until the PII-scrubber + the written de-identification procedure are
implemented and signed off (compliance matrix status flips DESIGN → IMPLEMENTED).

## 9. Open questions
- k value (start k=5?) — tune with data.
- Exact PII-scrub ruleset (person-to-person detection, name/number stripping) — needs a tested
  scrubber before any shared write.
- Embedding backend (pgvector in Cloud SQL vs Vertex Vector Search) — §12.7 evaluation at 52.4.
