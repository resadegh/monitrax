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

## 6b. Scale, indexing & anti-bloat controls (Reza Q, 2026-06-21)

**The key fact:** the `TransactionSignature` table is bounded by the number of **distinct merchant
patterns**, not by transaction volume. 10M transactions from 100k users still collapse to ~tens of
thousands of AU merchant signatures. The KB grows **asymptotically** (toward "all AU merchants"), not
linearly with usage — *provided normalisation is good*. So the controls are:

1. **Structural dedup (no pile-up by construction).** Every contribution does an **upsert** keyed on a
   **UNIQUE index `(region, pattern, matchType)`** — a second occurrence of the same pattern NEVER
   inserts a new row; it increments counts/votes in place. There is no "similar data piling up" because
   identical normalised signatures are the same row.

2. **Normalisation quality is control #1.** Weak normalisation = "WW METRO 1234" and "WOOLWORTHS 4521"
   become separate rows (cardinality leak). Invest in the normaliser/scrubber; **monitor the
   cardinality-to-transaction ratio** as the canary — if signature count grows ~linearly with
   transactions, normalisation is leaking and needs tuning. Embeddings (§6) later collapse the fuzzy tail.

3. **Indexing plan:**
   - `TransactionSignature`: **unique** `(region, pattern, matchType)` (lookup + dedup key); index `mcc`;
     **partial index on the graduated set** (`WHERE distinctUserCount >= k`, or an `isGlobal` flag) so the
     hot shared-prior lookups scan a small subset; vector index (pgvector ivfflat/hnsw) added with embeddings.
   - `SignatureContribution`: **`@@unique([signatureId, userId])`** (this is also the anti-bloat guarantee —
     one row per user per pattern, ever), index `signatureId` (tallying), index `userId` (per-user reads +
     account-reset deletion).
   - Hot path = a single indexed equality lookup on `(region, pattern)` → stays fast at any scale.

4. **Long-tail pruning.** Seen-by-one / sub-k **provisional** signatures that aren't reinforced within a
   window (e.g. 12 months) are pruned by a scheduled job — they're low-value and likely noise. Only
   **graduated** (≥k) patterns are kept indefinitely.

5. **Vote compaction (optional, later).** For strongly-established signatures (distinctUserCount ≫ k,
   stable high confidence), retain the aggregate `categoryVotes` + a capped/rolling sample rather than
   every contribution row forever. Cap `categoryVotes` to **top-N categories + "other"** (never a
   50-entry distribution).

6. **Recency weighting / slow decay.** Weight recent confirmations higher so the KB stays current when a
   merchant's category drifts, and stale patterns age out naturally — keeps it *useful* as it grows, not
   just *bigger*.

7. **Storage discipline.** Narrow columns; integer minor units for amount hints; **no raw description
   stored** (only the de-identified signature + counts); JSON votes capped.

8. **Housekeeping job (GCP-first §12.7) — ✅ BUILT.** `lib/categorisation/kb/housekeeping.ts`
   (`runKbHousekeeping` + pure `isStaleProvisional`) prunes stale sub-k provisionals (graduated
   patterns never pruned) and returns a KB-health report; exposed at
   `POST /api/categorisation/kb/housekeeping` (CRON_SECRET, mirrors `/api/cdr/lifecycle`) for GCP
   Cloud Scheduler (weekly). 4 tests. **Operator TODO:** create the Scheduler job once the KB is
   enabled. Future: recompute/compaction + richer metrics. Originally a Cloud Scheduler job: prune stale provisionals, recompute
   confidence, compact ledgers, and emit **KB-health metrics** — signature cardinality, cardinality/txn
   ratio, **lookup hit-rate (% categorised without an LLM call)**, provisional-vs-graduated ratio, p95
   lookup latency, table sizes. Hit-rate going up + cardinality flattening = the KB getting *richer*
   without bloating.

**Net control:** richer (more graduated patterns, better votes) while row-count stays bounded by the
merchant universe — because dedup is the unique index, not an afterthought, and pruning + compaction trim
the low-value tail.

## 7. Phasing (each step shippable + testable)

- **52.1 — KB schema + PII-scrubber:** ✅ (in progress this PR) `TransactionSignature` (shared,
  de-identified; unique `(region,pattern,matchType)` dedup key + indexes) + `SignatureContribution`
  (private per-user ledger, `@@unique(signatureId,userId)`) + enums + migration
  `20260622000000_add_categorisation_kb` (additive). **`scrubToSignature()`** de-identification gate
  (rejects transfers/PII, strips numbers/dates/refs/method-noise → canonical signature) — 11 tests.
  `SignatureContribution` classified in `accountReset` (RESET_DELETE). **No write-back / consumption
  yet** — the gate ships first (per the build gate).
- **52.1b — write-back service (flag-gated):** ✅ `recordContribution()` — scrub → upsert signature →
  upsert the user's contribution → **incrementally** update votes + `distinctUserCount` + graduation
  (`isGlobal` at k=5), O(1) per write (no ledger scan → scales). Pure `applyVoteDelta()` (top-N cap) +
  `summariseVotes()`. **GATED OFF by default** (`KB_WRITE_ENABLED`) until the de-identification
  procedure is signed off. 10 tests.
- **52.2 — lookup primitive (read path):** ✅ `lookupSharedCategory()` + pure `interpretSignature()`
  — returns the community category only for **graduated** (`isGlobal`) patterns above the confidence
  floor; gated `KB_READ_ENABLED` (default OFF). 7 tests.
- **52.1c — write hook:** ✅ `recordContribution()` called (fire-and-forget, gated) from the category
  correction endpoint (`PATCH /api/unified-transactions/[id]`) alongside the per-user `MerchantMapping`
  upsert. A confirmation now feeds both the user's private mapping AND (gated) the shared KB.
- **52.2b — wired into the categoriser:** ✅ `lookupSharedCategory` inserted into `categoriseTransaction`
  (user mapping → rules → **KB prior** → fallback); `encode/decodeCategoryPath` round-trips the 3-level
  category through the KB's single `category` key; new `source: 'KB'`. Gated `KB_READ_ENABLED` (no-op
  with no DB hit when off). Gemini-on-miss (52.3) slots in after the KB prior.
- **52.3 — Gemini-on-miss (RAG): ✅** `geminiCategoriseOnMiss()` — wired as step 4 in
  `categoriseTransaction` (after the KB prior). Sends the de-identified signature + valid taxonomy +
  graduated KB examples (RAG) to Gemini; validates level1; never throws into the hot path. Gated
  `KB_GEMINI_ENABLED` (default OFF, cost control). Confirmed answers write back via 52.1c. 6 tests.
- **52.4 — seed ✅:** `AU_MERCHANT_SEEDS` (~80 curated AU merchants → valid taxonomy) seeded via
  `seedCategorisationKb()` (idempotent `createMany skipDuplicates`) as `source:SEED`, `isGlobal:true`
  (curated → bypasses k-anonymity; `isGlobal` made sticky so a later vote/reset can't demote it).
  `POST /api/categorisation/kb/seed` (CRON_SECRET). Makes graduated merchants exist day-one so READ
  is useful immediately. 4 integrity tests. **Embeddings (fuzzy tail) deferred to 52.5.**
- **52.5a — fuzzy prefix fallback ✅:** `lookupSharedCategory` now does exact → then a deterministic
  **token-prefix** fallback (`isTokenPrefix`/`pickPrefixMatch` + a wildcard-safe `$queryRaw`): the
  longest graduated pattern that is a whole-token leading prefix of the signature wins — handles
  "BRAND + store/location suffix" ("WOOLWORTHS METRO 1234" → `WOOLWORTHS`), the dominant AU feed shape.
  No infra/schema change. 6 tests.
- **52.5b — embeddings (fuzzy tail):** non-prefix variants ("WW METRO" → "WOOLWORTHS") via vector
  similarity (pgvector in Cloud SQL or Vertex). Needs the `vector` extension (operator) + a vector
  column + an embeddings model. **Deferred — larger infra increment.**
- **52.5c — KB write-back across ALL human confirmation surfaces ✅ (this PR):** the central gap found
  on build (CLAUDE.md §10 research-before-action): before this, **only** the single-transaction PATCH
  taught the shared KB. The bulk/review confirmation paths — `bulk-categorise` (power-user "Categorise N
  selected"), `bulk-confirm` (the "AI bookkeeper" medium/low bands), the per-row "✓ Looks right"
  affordance, and the per-batch review route — all wrote the PRIVATE `merchantMapping` but **never fed
  the cross-user KB**. So the AI engine couldn't learn from the highest-volume categorisation paths.
  Fix: one canonical learn-once helper `recordKbContribution()` (`lib/categorisation/kb/recordFromConfirmation.ts`,
  CLAUDE.md §12.2 SSOT) wired into (a) `confirmReviewItem` (covers bulk-confirm bands + per-row +
  per-batch review in one place), (b) the `bulk-categorise` route (once per distinct merchant), and
  (c) the single PATCH (refactored onto the same helper). All pass the canonical category triple — the
  same vocabulary the KB stores → **no vote fragmentation**. **Echo-chamber-safe:** import-time AI
  auto-accept (`bulkConfirmAutoAccepted`) and `bulkConfirmHighBand` are deliberately NOT wired — only a
  genuine human confirm/edit/re-categorise is a real k-anonymity vote. Fire-and-forget + gated OFF by
  default (`KB_WRITE_ENABLED`).
- **52.5c — Link / reconciliation tool SSOT + KB read/write ✅ (this PR):** the Link dialog was the one
  categorisation surface bypassing BOTH the canonical category registry AND the KB (it wrote raw legacy
  flat codes). New bridge `categoryBridge.ts` (`legacyCodeToCanonical` / `canonicalToLegacyCode`, 12
  tests) + `learnCanonicalFromLink()` in the link route now: (WRITE) bridge code → canonical triple →
  seed `CanonicalCategoryRegistry` + teach the KB at every learnMerchant site (skips loans + custom);
  (READ) `suggestedCategory` consults the graduated community KB, mapped back to a legacy code for the
  dialog. Full detail: §8b.
- **52.5c-UI — review-exceptions inbox surface:** review-exceptions inbox + "apply to past/future"
  learn-once toggle, powered by this engine. **Stitch-first; UI increment.** Design ✅ (light, **9.2/10**
  per §18.8 gate; v1 `291a1716` scored 8.0 → rejected) — Stitch screen
  `fdf91885d9854bf48ebdeb97bbcd2762`, `.stitch/designs/phase52/review-categories-inbox-v2.png`
  (finishable "96% categorised — 8 to review" header + progress bar; high-confidence pre-checked +
  bulk Confirm; per-row AI category + community-confidence cue; expanded "apply to all <merchant> —
  past & future" learn-once toggle; amber "Needs a look" exceptions; calm "All caught up" empty state).
  **DECIDED + SHIPPED (Reza, 2026-06-22): dedicated full-page inbox.** `app/dashboard/activity/review/page.tsx`
  + `components/bookkeeping/ReviewCategoriesInbox.tsx` on the §18.7.2 glass vocabulary, reusing the
  existing KB-wired endpoints (GET `bulk-confirm` summary + GET `review-queue?band=` items + POST
  `review-queue` confirm/skip) — **no new endpoints**. Confirming routes through `confirmReviewItem` →
  `recordKbContribution`, so the inbox teaches the KB. Entry point: an "Open review inbox →" deep-link
  added to the inline Phase 49 `ConfidenceReviewCard` (the card stays for at-a-glance; the page is the
  calm full-screen triage). **Stitch 4-variant matrix, all > 9 per §18.8:** desktop light `fdf91885`
  (9.2) / desktop dark `c31ae9ca` (9.4) / mobile light `c203a7d7` (9.3) / mobile dark `0fc7905b` (9.3);
  artefacts `.stitch/designs/phase52/review-categories-inbox-v2{,-dark,-mobile,-mobile-dark}.{html,png}`.
  Header "N% categorised — M to review" + progress; medium band pre-selected for bulk confirm; per-row
  confirm/skip; amber "Needs a look" for the low band; calm "All caught up" empty state.

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

## 8b. Link / reconciliation tool — SSOT audit + KB read/write ✅ (Reza, 2026-06-22)

Reza asked (2026-06-22): *"are you performing an audit and review on the link / reconciliation tool to
make sure it will be SSOT and read/write to the new KB AI engine?"* — Yes. Findings + fix:

**Audit finding.** The Link Transaction dialog (`components/transactions/TransactionLinkDialog.tsx` →
`/api/transactions/[id]/link`) was the **one categorisation surface off-SSOT on two axes**:
1. It wrote raw **legacy flat codes** (`EXPENSE_CATEGORIES`/`INCOME_TYPES`: `GROCERIES`, `SALARY`, …)
   to the private `merchantMapping` and **never seeded the `CanonicalCategoryRegistry`** (§12.2 SSOT) —
   unlike the PATCH / bulk-categorise / review paths, which all go through `resolveOrCreateCategory`.
2. It **never fed nor consulted the shared KB**.
The KB, the TIE categoriser, and the registry all speak the **canonical 3-level hierarchy**
(`Food & Dining` > `Groceries`). Writing flat codes straight into the KB would fragment graduation
(`GROCERIES` vs `Food & Dining>Groceries` for the same merchant) and surface mismatched names on read.

**Fix (this PR).** A single bridge `lib/categorisation/kb/categoryBridge.ts` —
`legacyCodeToCanonical(code, direction)` + `canonicalToLegacyCode(level1, level2, direction)` (12 tests)
— is the one documented correspondence between the two vocabularies. The link route now:
- **WRITE:** at each `learnMerchant` site (link-to-income/expense, create-income, create-expense) calls
  `learnCanonicalFromLink()` → bridges the chosen code → canonical triple → seeds the canonical registry
  (`resolveOrCreateCategory`) **and** teaches the shared KB (`recordKbContribution`, the same learn-once
  helper as every other surface). Skips loan links (Phase 51 ledger owns repayments) and custom
  categories (free-text, never graduate).
- **READ:** when there's no private/global learned mapping and no engine prediction, `suggestedCategory`
  now consults `lookupSharedCategory()` and maps the graduated community answer back to a legacy code via
  `canonicalToLegacyCode` so the dialog's `CategorySelect` can pre-select it.
Both write + read are gated (`KB_WRITE_ENABLED`/`KB_READ_ENABLED`), de-identified, fire-and-forget.

**Remaining (smaller, documented tech-debt, NOT blocking):** `merchantMapping.categoryLevel1` still
stores the legacy code at these sites (so the dialog's existing read keeps working); the full
`merchantMapping` → canonical-triple unification is the larger §12.2 cleanup that retires the bridge.
Until then the bridge guarantees the KB + registry get clean canonical data.

## 9. Open questions
- k value (start k=5?) — tune with data.
- Exact PII-scrub ruleset (person-to-person detection, name/number stripping) — needs a tested
  scrubber before any shared write.
- Embedding backend (pgvector in Cloud SQL vs Vertex Vector Search) — §12.7 evaluation at 52.4.
- ~~Review inbox placement~~ **DECIDED (Reza, 2026-06-22): dedicated full-page triage inbox** (v2 design),
  reusing the now-KB-wired `review-queue` (item-level confirm/skip/edit/transfer) + `bulk-confirm` (band
  summary + whole-band confirm) endpoints — no new endpoints. Complements the inline Phase 49
  `ConfidenceReviewCard` (which becomes a likely entry point into the page). **Build plan (Stitch-first,
  §18):** (1) generate dark + mobile variants from the approved v2 light screen (`fdf91885`), each
  through the §18.8 ≥9 gate → 4-variant matrix; (2) `app/dashboard/activity/review/page.tsx` +
  `components/bookkeeping/ReviewCategoriesInbox.tsx` on the §18.7.2 glass vocabulary; (3) "apply to all
  &lt;merchant&gt; — past & future" learn-once toggle → `editReviewItem` w/ applyToSimilar (already feeds
  the KB via `confirmReviewItem`); (4) nav entry from the Activity confidence card; (5) docs + changelog.

## 10. Enablement runbook (how to switch the KB on)

The engine is built + merged but **gated OFF**. Enable in this order (staged: write first so data
accumulates, read later once patterns graduate):

1. **Sign off the de-identification procedure** — `docs/policy/CDR_KB_DEIDENTIFICATION_PROCEDURE.md`
   §7 (the build-gate prerequisite).
2. **Regenerate + serve the legal PDFs** — `monitrax_privacy_policy_v1.pdf` (now has §4.1) + the CDR
   consent notice, from the updated `.md`, so users see the disclosure before any cross-user write.
3. **Enable WRITE** — set `KB_WRITE_ENABLED=true` (Vercel → Production). De-identified votes start
   accumulating as users confirm categories. **Nothing changes for users yet** (reads still off).
4. **Create the housekeeping Cloud Scheduler job** — weekly `POST /api/categorisation/kb/housekeeping`
   with `Authorization: Bearer <CRON_SECRET>` (mirror the CDR-lifecycle job).
5. **Let patterns graduate** — a pattern needs ≥k=5 distinct users. Monitor the housekeeping health
   report (`globalSignatures` rising).
6. **Enable READ** — once `globalSignatures > 0` and looks sane, set `KB_READ_ENABLED=true`. The
   categoriser now uses the shared prior (step 3 of the precedence chain).
7. **Monitor** — hit-rate (% categorised without an LLM), cardinality, global vs provisional, via the
   health report. Tune `KB_MIN_CONFIDENCE` / k if needed.

**Rollback:** set either flag back to `false` — instant, no data loss (the KB just stops being
written/read). All flags default OFF, so a missing env var = disabled.
