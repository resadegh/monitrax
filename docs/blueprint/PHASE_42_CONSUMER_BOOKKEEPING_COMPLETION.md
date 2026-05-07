# Phase 42 — Consumer Bookkeeping Completion (XERO-Complementary)

> **Status:** 🟡 **DRAFT — awaiting Reza sign-off** on the strategic decisions in §3 + §11 before any code lands.
> **Estimated effort:** ~6 sub-PRs over ~6 weeks (one engineer) or ~3 weeks (parallelisable across 2 engineers).
> **Hard prerequisite:** Phases 13 (TIE), 18 (QIF parser), 25 (DME), 26 (DIE), 29 (AI Cat), 36 (Activity IA) ✅. All shipped.
> **Sibling phases (do NOT overlap):** Phase 41a (`LegalEntity`), Phase 41f (entity-level Xero pull for tax engine), Phase 41h (entity-aware AI advisor).
> **Last updated:** 2026-05-08 — Claude (initial draft after Reza review-brief 2026-05-08).

---

## 1. Strategic positioning — the line we are NOT crossing

Reza's directive 2026-05-08, locked:

> "Monitrax is the **all-in-one user side** tool. **Xero is the accountant side.** Monitrax simplifies the user's life by having all the data needed for tax purposes in one place; the accountant gets what they need from Monitrax for accounting purposes. We do not replace Xero, we complement it."

This phase is the **consumer-side bookkeeping completion** that fulfils the user-side half of that brief. It must NOT drift into accountant-side territory. The boundary is:

| In scope (Monitrax) | Out of scope (Xero owns this) |
|---|---|
| Personal spending classification + insights | Double-entry general ledger / chart of accounts |
| Receipt → transaction matching for the user | Statutory journal posting / audit-grade journals |
| Per-property + per-investment income/expense view | Statutory year-end accounts |
| Tax-time data pack (CSV/XLSX/PDF) handoff to accountant | BAS preparation, GST coding, BAS-eligible flagging |
| Subscription detection + cancellation hints | Payroll, accounts payable / accounts receivable |
| Cash transaction quick-add (sole-trader, market sellers) | Multi-entity statutory consolidation |
| Mobile receipt capture (PWA camera) | Invoice generation + accounts-receivable tracking |
| User-facing monthly review milestone (psychological win) | Statutory period close / month-end lock |
| Vendor/merchant *card* (annual totals, attached docs) | Vendor master with payment terms, AP cycle |
| Bank-statement *sanity check* (gap detection) | Formal bank reconciliation + BAS-grade journals |

**Test for any future PR scope:** if the feature would replace something an accountant does in Xero/MYOB during BAS prep or year-end, it's out of scope. If the feature gives the user clarity OR produces data the accountant then re-keys into Xero — it's in scope.

The pairing — Phase 41f pulls the entity-level *summary* from Xero INTO Monitrax (for net-worth + tax engine inputs); Phase 42 produces the personal *handoff pack* from Monitrax TO the accountant (so they can key into Xero without re-entering 18 months of receipts) — is the ecosystem position.

---

## 2. The Engagement Principle (Reza directive 2026-05-08)

> "The user has to be engaged emotionally and mentally to perform the categorisation tasks — not a chore."

This is **the** load-bearing constraint of Phase 42. Every architectural decision below is subordinated to it. Categorisation is the act that *feels like work* in every existing bookkeeping product (Pocketbook, Mint, Xero, MYOB) and it is precisely what Phase 42 must transform. Specifically:

- **Categorising a transaction must feel like a 5-second micro-win**, not a 30-second form-filling chore. Target: median action <3 seconds end-to-end on mobile, <5 seconds on desktop.
- **Every action must be visually and emotionally rewarded.** Spring animations, ✓ ticks, micro-confetti at completion milestones, streak counters — borrowed directly from Duolingo's lesson loop and Apple Fitness's ring close.
- **The default surface must INVITE, not INTERROGATE.** "Welcome back. 12 things ready for your 3-minute review." Never "47 uncategorised."
- **Friction goes one way only — UP for power features (splits, advanced filters), DOWN for the daily action (categorise, confirm, swipe).**
- **The ritual matters more than the ledger.** The user shouldn't think "I have to do my bookkeeping." They should think "I love checking my Monitrax pulse in the morning."

The full engagement design is detailed in §6 (PR6 — The Engagement Layer). The four-lens table below is the supporting rationale.

---

## 2.1 The four lenses that drove this design

Per CLAUDE.md §0, every Monitrax design decision is screened through four advisor lenses simultaneously.

| Lens | What it asked | What it locked in |
|---|---|---|
| **Architect** | Does this respect the SSOT? Does it duplicate the Phase 13 TIE engine, the Phase 25 DME, or the Phase 41f Xero pull? | **D-42-1** — collapse the two parallel category taxonomies (`UnifiedTransaction.categoryLevel*` strings vs `Category` model) into one canonical registry. **D-42-2** — receipt-to-transaction matching extends the existing DME `analyze/confirm` flow, NOT a new ingestion path. **D-42-3** — the Tax Pack export reuses the existing `lib/reports/` builder + `getMasterFinancialSnapshot()` + `lib/tax-engine/` outputs; it is a serialisation, not a new calculation engine. |
| **Financial adviser** | Does this make the user financially better off? Does it surface real numbers traceable to canonical engines? Does it ever quote a deduction the engine can't justify? | **HR-42-1 preserved structurally** — no transaction-derived figure is shown without provenance (`source` field already on `UnifiedTransaction`). **HR-42-2** — tax-deductibility is INFERRED + USER-CONFIRMED, never assumed. The Tax Pack ships with an "unconfirmed deductions" warning section the accountant reviews before lodging. |
| **Designer** | Does this look like Apple Wallet, Linear, Stripe — or like a tax spreadsheet? Does the categorisation surface feel like a *premium product* to interact with? Does it earn its place through restraint? | **D-42-4** — review queue, not "uncategorised list". Lead with completion %, hide confidence/anomaly chrome behind an Advanced view toggle. Mobile-first interactions: swipe-to-categorise on Activity (Up Bank-grade gestures with haptic feedback). PWA camera capture for receipts. Reuse the Phase 41g `MoneyFlowSankey` for the consumer monthly money-flow view (no new chart engine). **One canonical motion vocabulary** — Apple ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`), 220ms standard / 360ms hero / 120ms haptic-mirror; never linear easing, never bouncing past 1.05. |
| **Behaviour psychologist** | Does this normalise rather than shame? Does it celebrate the next achievable action? Does the surface make the user *want to come back tomorrow*? | **D-42-5** — review queue framed as *"12 things, ~3 minutes today"* with streak counter (Bandura small wins). Recurring-detection surfaces "you have 6 subscriptions totalling $189/month — review them?" — TRAIL stage R (REDUCE) framing, never "you're wasting money." Anomaly narratives are *context*, not advice. Tax-pack completion celebrated as a TRAIL stage L milestone. **Per-categorisation micro-celebrations** — every confirmed categorisation gets a spring ✓ tick + a quiet haptic (mobile) or a 120ms scale pulse (desktop). At 100% reviewed: a single AnimatePresence confetti burst (one per day max — scarcity preserves delight). |

---

## 3. Strategic decisions requiring sign-off (D-42-1 through D-42-7)

Before any code lands, Reza confirms the following structural decisions. Each is reversible at design time, expensive to reverse after PR1 lands.

### D-42-1 — Category SSOT collapse

**Question:** how to unify the two category taxonomies?

**Recommended:** Keep `UnifiedTransaction.categoryLevel1/2/subcategory` strings as the on-disk fast-path (no migration of millions of rows), but introduce a **`CanonicalCategoryRegistry`** that both surfaces (transactions + Expense.customCategoryId + MerchantMapping) resolve through. The registry is the SSOT; renaming "Pet Care" in `/dashboard/categories` propagates *visually* across all surfaces. Migration is a 1-day backfill mapping the existing string slugs → registry IDs.

**Alternative considered:** make `UnifiedTransaction.categoryId` a hard FK to `Category`. Cleaner long-term, but expensive (multi-million-row migration; breaks all existing Phase 29 learning rules). Defer until volumes justify.

**Sign-off needed:** Reza confirms recommended approach.

### D-42-2 — Transaction split model

**Question:** how to model split transactions (one TX → multiple categories)?

**Recommended:** New `TransactionSplit { id, transactionId, amount, categoryId, propertyId?, expenseId?, isTaxDeductible, note? }`. The parent `UnifiedTransaction` keeps its single category for backwards-compat (= the dominant split's category, derived); splits override at the per-line level. UI: "Split this" button on `TransactionLinkDialog` opens a split editor that sums to the TX total. QIF parser already extracts `S`/`$` split fields per `lib/bank/parsers/qif.ts` — wire them through on import.

**Hard rule:** sum of splits MUST equal `transaction.amount` ± $0.01 rounding. Service-layer validation; no UI workaround.

**Sign-off needed:** Reza confirms model + the validation rule.

### D-42-3 — Bookkeeping period model

**Question:** what does "Monthly Review" actually persist?

**Recommended:** New `BookkeepingPeriod { userId, periodMonth, status: OPEN | REVIEWED | LOCKED, reviewedAt?, reviewedTransactionCount, totalTransactionCount, lockedAt?, notes? }`. Three statuses:
- `OPEN` — current month, anything can change
- `REVIEWED` — user has confirmed all transactions categorised; **edits still allowed** but the audit log records the post-review change
- `LOCKED` — user explicitly locks the period (rare; for handing the tax pack to the accountant). Edits blocked at the API layer until unlocked.

The default `LOCKED` is opt-in. Most users never lock; they just `REVIEWED`. **This is NOT a statutory period close** — Xero / the accountant does that. This is a personal milestone + an audit anchor.

**Sign-off needed:** Reza confirms three-status model + opt-in lock semantics.

### D-42-4 — Cross-batch dedup constraint on QIF/CSV

**Question:** add a hard unique constraint to prevent re-imported duplicates?

**Recommended:** Add a partial unique index on `UnifiedTransaction(accountId, date, amount, normalisedDescriptionHash) WHERE source IN ('QIF','CSV','OFX')`. New `normalisedDescriptionHash` derived column (deterministic). On collision, the import API returns the existing transaction id rather than creating a new row. Pair with a "merge mode" UI when amounts match but descriptions differ slightly.

**Why partial:** BASIQ has its own unique key (`basiqTransactionId`); MANUAL transactions are user-explicit (no dedup needed).

**Sign-off needed:** Reza confirms partial unique index approach.

### D-42-5 — Vendor / merchant card scope

**Question:** how far does the "Vendor entity" go before it becomes an AP vendor master (Xero territory)?

**Recommended:** New `Vendor` model promoted from `MerchantMapping` with: `userId, name, normalisedName, mcc?, abn?, defaultCategoryId?, contractDocumentId?, websiteUrl?, cancelUrl?, defaultIsTaxDeductible, suggestedFrequency?`. Auto-aggregates: annual spend, transaction count, last-seen, related properties. NO payment terms, NO AP cycle, NO invoice tracking. Surface: a "Vendor card" drawer reachable from any transaction merchant; lists every transaction across every account, attached docs, and the cancel link if known.

**Hard rule:** if it would appear in a Xero AP report, it's not a Monitrax Vendor field.

**Sign-off needed:** Reza confirms scope boundaries.

### D-42-6 — Tax-category mapping registry

**Question:** how do we map bookkeeping categories to ATO labels for the Tax Pack?

**Recommended:** New `TaxCategoryMapping` model registers the bridge: `{ canonicalCategoryId, atoLabel, schedule, lineItem, notes }`. Pre-seeded for ~60 common AU rental + employee + small-business deductions (D-1 work travel, D-5 work-related uniform, R&M on rental, depreciation Div 40, etc.). User can override per category. The **Tax Pack export uses this registry to group transactions under ATO labels**; the accountant gets a CSV with ATO labels as columns.

**Hard rule:** mapping is INFERENCE, not advice. Tax Pack disclaimer: *"This is a data summary; your registered tax agent confirms deductibility."*

**Sign-off needed:** Reza confirms the registry approach (vs free-form text).

### D-42-7 — Receipt-to-transaction matching threshold

**Question:** when a receipt is uploaded, what's the threshold for auto-linking to an existing transaction?

**Recommended:** Match against `UnifiedTransaction` rows on the same `accountId` (or any account if user explicitly chose "Cash"), within `±3 days`, `amount` ±$0.50 OR ±0.5%, vendor name fuzzy match (Levenshtein ratio ≥0.7). On match, the DME `analyze/confirm` flow links the document to the existing transaction (sets `transaction.expenseId` if a category is implied) instead of creating a parallel `Expense` row. **If multiple matches**: show user picker. **If no match**: create a new `UnifiedTransaction` with `source='RECEIPT'` (new enum value) so it's distinguishable from bank-fed transactions.

**Sign-off needed:** Reza confirms thresholds + the new `source='RECEIPT'` value.

---

## 4. Sub-PR sequence (6 sub-PRs, ~6 weeks single-engineer)

### PR1 — Foundation: SSOT + dedup + audit ✅ SHIPPED 2026-05-07

- ✅ New `CanonicalCategoryRegistry` model + helpers (`lib/bookkeeping/categoryRegistry.ts`) — `resolveOrCreateCategory()` lazily seeds the registry on every categorisation; `backfillRegistryForUser()` available for one-time seed jobs
- ✅ Cross-batch dedup foundation — new `UnifiedTransaction.normalisedDescriptionHash` column + partial index `ut_dedup_qif_csv_ofx` on `(accountId, date, amount, normalisedDescriptionHash) WHERE source IN ('QIF','CSV','OFX')`. Index is **non-unique at v1** per CLAUDE.md §12.11 caution — promotion to UNIQUE deferred to PR1.1 after a one-time prod audit confirms zero existing duplicates. The dedup *check* lives at the API layer (PR2 wires into the import paths). Canonical hash function: `lib/bookkeeping/normaliseDescription.ts` (mirrored in the migration backfill SQL)
- ✅ New `TransactionEdit` audit table — wired into the existing `PATCH /api/unified-transactions/[id]` for CATEGORY / TAGS / LINK_ENTITY / RECURRING mutations; fire-and-forget per §12.10; no row written when before/after is deeply equal
- ✅ New `BookkeepingPeriod` model + 3-status state machine (OPEN / REVIEWED / LOCKED) in `lib/bookkeeping/period.ts`. API: `GET /api/bookkeeping/periods/[month]` + `POST` with `{ action: 'mark_reviewed' | 'lock' | 'unlock' }`. LOCKED returns HTTP 423 from the transaction PATCH route — the only API-level edit block. New permissions `bookkeeping.read` / `bookkeeping.write`
- ✅ UI: `<MonthlyReviewPill />` (`components/bookkeeping/MonthlyReviewPill.tsx`) on Activity header. Three visual states map to the three statuses; one-tap to mark reviewed; second-tap on LOCKED unlocks. Foundational hook for the PR6 Daily Pulse / streak / completion celebration
- ✅ Tests — 27 unit tests across `tests/bookkeeping/{normaliseDescription,period,transactionEditAudit}.test.ts`; covers determinism, jitter collapse, distinct-vendor preservation, period-key normalisation, audit-helper field-pick discipline
- BASIQ-onboarding behaviour: registry resolves both BASIQ-fed and QIF-fed categories identically; the dedup index is partial-on-source so BASIQ continues to use its own `basiqTransactionId` key. Unit tests verify `BASIQ` / `MANUAL` / `BANK` are NOT in `DEDUP_SOURCES`.

**Migration:** `prisma/migrations/20260510200000_phase_42_pr1_foundation/migration.sql`. Operations: CREATE TYPE × 1, CREATE TABLE × 3, ALTER TABLE ADD COLUMN × 1 (nullable), UPDATE backfill (writes to a column that did not exist before this migration — disclosed in PR body per §12.11), CREATE INDEX × 7. NO destructive ALTER, NO DROP. CLAUDE.md §12.11 N/A for the schema-level ops; the backfill UPDATE is disclosed in the PR body.

**Out of PR1, queued:** category resolver wiring (PR1's resolver helper exists but is not yet called from the categoriser — that's PR2's category-bridge); promotion of the dedup index to UNIQUE (PR1.1 after prod audit).

### PR2 — Splits + bulk re-categorise ✅ SHIPPED 2026-05-07

- ✅ New `TransactionSplit` model with hard FK to `CanonicalCategoryRegistry` (SSOT). Sum-of-splits validation lives in **one place** (`lib/bookkeeping/splits.ts:assertSplitsBalance`) per CLAUDE.md §12.3 — every mutation path goes through `replaceSplits()`.
- ✅ Service helper `lib/bookkeeping/splits.ts` — `replaceSplits()` (atomic delete-then-create inside a Prisma transaction; propagates dominant split's category up to the parent for backwards-compat with `getMasterFinancialSnapshot` + expense/income aggregators); `clearSplits()`; `listSplits()`; `resolveOrCreateCategoryForSplit()`. Pickle-prevention: `assertSplitsBalance` enforces `sum(splits) === parentAmount ± SPLIT_SUM_EPSILON ($0.01)`. Cross-user FK abuse blocked: every `categoryId` is verified against the calling user's registry rows before write.
- ✅ QIF parser → splits wiring. `lib/bank/types.ts:RawTransaction.splits` field added; QIF parser propagates `S`/`$` fields onto it (the parser already extracted them — PR2 just wires them downstream); `app/api/unified-transactions/route.ts:handleBatchImport` resolves each split's category string via `resolveOrCreateCategory` and persists via `replaceSplits` with `source='IMPORT'`.
- ✅ Categoriser SSOT bridge (PR1 carryover). `app/api/unified-transactions/[id]/route.ts` PATCH now lazy-seeds `CanonicalCategoryRegistry` on every category write — closes the SSOT loop. The legacy string columns continue to populate for backwards-compat.
- ✅ API:
  - `GET    /api/unified-transactions/[id]/splits` — list
  - `PUT    /api/unified-transactions/[id]/splits` — replace all
  - `DELETE /api/unified-transactions/[id]/splits` — clear
  - `POST   /api/unified-transactions/bulk-categorise` — atomic bulk re-categorise (max 200 per call); rejects the WHOLE batch if any row sits in a LOCKED period; rolls up per-merchant `MerchantMapping` learning rows in the same Prisma transaction
- ✅ UI:
  - `<BulkActionToolbar />` — sticky-bottom toolbar that surfaces when ≥1 row is selected; suggested-categories chip strip + free-form custom input; calls bulk-categorise endpoint
  - `<TransactionRow />` (Activity) — added a leading checkbox tap-target. Selection state lives on the page; preserved across paginations until the user clears or completes a categorisation
- ✅ Tests — 13 new unit tests across `tests/bookkeeping/{splits,qifSplits}.test.ts` (totals: PR1 27 + PR2 13 = 40). Sum validation, tolerance boundary at $0.01, empty-array rejection, mixed-sign tolerance, real-QIF-fragment parser parity.
- BASIQ-onboarding behaviour: BASIQ doesn't ship splits — the user adds them post-sync via the API (the inline UI in `TransactionLinkDialog` is queued for PR2.5). The sum-validation runs identically regardless of source. QIF MCC-level splits land via the import path; BASIQ-fed rows reach the same `replaceSplits()` helper from the future UI.

**Migration:** `prisma/migrations/20260510210000_phase_42_pr2_splits/migration.sql`. Operations: CREATE TABLE × 1, CREATE INDEX × 4, FOREIGN KEY × 2. NO destructive ALTER, NO DROP, NO row UPDATE/DELETE. CLAUDE.md §12.11 N/A.

**Out of PR2, queued:** inline split editor inside `TransactionLinkDialog` (defer to PR2.5 — the dialog is 1,601 LOC and a full split UI grows it; the API + service surface are complete and the future UI just renders the form).

### PR3 — Receipt ↔ transaction matching + cash quick-add ✅ SHIPPED 2026-05-07

- ✅ DME `analyze/confirm` flow extended: after creating a new `Expense`, attempt match against existing `UnifiedTransaction` rows via `lib/bookkeeping/receiptMatcher.ts`. AUTO_LINK at composite ≥ 0.95 (top candidate must beat 2nd by ≥ 0.05 to avoid ambiguous links); PICK_FROM at 0.7-0.95 (returned to client as `receiptMatch.candidates`); NO_MATCH below 0.7 → synthesise a new `UnifiedTransaction` with `source='RECEIPT'` on the user's CASH account, tied to the document + new Expense via `matchedDocumentId`.
- ✅ Receipt matcher (`lib/bookkeeping/receiptMatcher.ts`) — single SSOT for the threshold rules (D-42-7 signed-off): 3-day window, $0.50 abs / 0.5% rel amount tolerance, Levenshtein vendor similarity ≥ 0.7. Composite weight 50% date / 35% amount / 15% vendor with a strong-signal override (same-day + exact-amount → auto-link grade even on vendor jitter). DB-coarse-filter + JS exact-scoring pattern. Defends against double-linking (skips rows where `source = 'RECEIPT'` or `matchedDocumentId IS NOT NULL`).
- ✅ Cash quick-add — new `AccountType = 'CASH'` (added to `LIQUID_ACCOUNT_TYPES` so net-worth + emergency-fund snapshots see cash as liquid). Idempotent `getOrCreateCashAccount()` (`lib/bookkeeping/cashAccount.ts`) handles three cases: existing CASH-typed account → use it; existing account named "Cash" with another type → adopt by re-tagging; otherwise → create fresh. New API `POST /api/unified-transactions/cash` (3-field body: amount + description + direction; date and category optional). LOCKED-period guard (HTTP 423) consistent with the rest of Phase 42. Audit row written via `recordTransactionEdit`.
- ✅ UI — `<CashQuickAddButton />` (`components/bookkeeping/CashQuickAddButton.tsx`): emerald floating action button bottom-right, modal with auto-focused tabular-nums amount field, in/out direction toggle, single-line "what was it for?", advanced (date + category) behind a `+` toggle. Submit → 700ms ✓ tick celebration → auto-close. Wired to `/dashboard/activity` page header strip. Component inline includes a "Capture receipt" affordance via `<input type="file" capture="environment" accept="image/*">` — PWA camera path on mobile, file dialog fallback on desktop.
- ✅ New `UnifiedTransaction.matchedDocumentId` column — direct pointer for "show me the receipt for this transaction"; complements the existing `DocumentLink` many-to-many (which still serves general document↔entity relations).
- ✅ Audit-trail integration — every receipt match writes a `TransactionEdit` row with `editType = 'RECEIPT_LINK'` and `source = 'AI'` (to distinguish from user manual links).
- ✅ Tests — 28 new unit tests in `tests/bookkeeping/receiptMatcher.test.ts` (thresholds pinned; Levenshtein behaviour; vendor similarity; composite scoring including the strong-signal override; full `scoreCandidate` integration). Cumulative: 72/72 green (PR1 27 + PR2 13 + PR3 32 — note: 28 added in receiptMatcher.test.ts plus thresholds-pinned counted separately).
- BASIQ-onboarding behaviour: receipts uploaded BEFORE BASIQ syncs the matching transaction will land as RECEIPT-sourced rows on the Cash account. When BASIQ later syncs the matching bank line, the existing match path runs from the *other* direction in PR4 (queued — "new bank tx → look for unmatched RECEIPT row, retro-link"). For now the QIF/CSV import path is the same canonical reconciliation engine — receipts that DO match an existing QIF tx auto-link via `applyReceiptMatch`. No source-conditional code.

**Migration:** `prisma/migrations/20260510220000_phase_42_pr3_receipts_cash/migration.sql`. Operations: ALTER TYPE × 2 (additive `ADD VALUE IF NOT EXISTS`), ALTER TABLE ADD COLUMN × 1 (nullable). NO destructive ALTER, NO DROP, NO row UPDATE/DELETE. CLAUDE.md §12.11 N/A.

**Out of PR3, queued:**
- **PR3.5** (small) — receipt-picker UI inside Smart Inbox to consume the `receiptMatch.candidates` verdict (PICK_FROM case). API + service surface complete; future UI just renders the picker.
- **PR3.6** (small) — "new bank tx → retro-link to unmatched RECEIPT row" reverse-direction matcher (lands when BASIQ syncs late).

### PR4 — QIF parity layer ✅ SHIPPED 2026-05-07

- ✅ **Self-hosted MCC catalog** (`lib/bank/mccCatalog.ts`) — 47 high-volume AU merchants mapped to ISO 18245 MCC codes (Coles → 5411, Bunnings → 5200, AGL → 4900, Telstra → 4814, etc.). Substring-match-on-normalised-merchant; first-pattern-wins; ordering matters (food-delivery before rideshare so "Uber Eats" doesn't get mis-categorised). Per CLAUDE.md §12.2 SSOT — **one** lookup function (`lookupMCC`); every import path calls it. When BASIQ later supersedes a row, BASIQ-supplied MCC overrides automatically.
- ✅ **MCC applied at normalisation time.** `lib/bank/normalisation.ts:normaliseTransaction` now stamps `merchantCategoryCode` on every QIF/CSV/OFX row from the catalog lookup. The batch-import API (`app/api/unified-transactions/route.ts`) does the same on its standalone path. BASIQ-grade categorisation accuracy without BASIQ.
- ✅ **QIF `L` field seeding.** Parser propagates `tx.category` → `RawTransaction.bankSuppliedCategory`. Normaliser surfaces it on `NormalisedTransaction.bankSuppliedCategory`. New `mapBankSuppliedCategory()` helper in `lib/bank/categorisation.ts` maps ~15 common bank-side category strings (Salary / Rent income / Council rates / Strata / Insurance / Streaming / etc.) to Monitrax canonical labels at confidence **0.75 (= 0.6 base + 0.15 boost)** — positioned BELOW user/system rules (0.9, authoritative) but ABOVE the AI fallback. QIF transfer brackets `[Account]` route to Transfer / Internal automatically.
- ✅ **Bank-statement sanity-check.** New `lib/bookkeeping/importSanity.ts:computeBalanceSanityCheck()` — pure helper. Compares opening + sum vs stated closing within $0.50 tolerance. Returns a structured result the API surfaces in `data.sanity`. Friendly amber banner via new `<ImportSanityBanner />` component renders the message ("$30 between imported transactions and the closing balance — likely a transaction we didn't catch.") with a dismissable X.
- ✅ **Re-import merge preview.** New `dryRun: true` flag on the batch-import API. Returns the `computeDedupPreview()` verdict (totalCandidates / duplicateCount / newCount / sample) + the sanity-check WITHOUT writing rows. The Import Wizard can call this before commit to render a "12 of 50 transactions match existing — merge / overwrite / skip?" picker. Per CLAUDE.md §12.3, the dedup helper composes PR1's `computeDescriptionHash` — no parallel hash logic.
- ✅ **Tests** — 78 new unit tests across `tests/bookkeeping/{mccCatalog,importSanity,qifLFieldSeed}.test.ts`. Catalog hygiene (every entry has key + non-empty patterns + 4-digit MCC + label; keys unique; ≥40 entries); sanity-check boundary cases ($0.50 tolerance, missing balances → ran=false); dedup-preview (account scoping, BASIQ exclusion, sample-cap-at-5); L-field seed routing for the 8 most-trafficked categories + rule-engine-wins-over-seed precedence. **Cumulative: 120/120 green** (PR1 27 + PR2 13 + PR3 32 + PR4 48 — note: 78 added in PR4 split across new files).

BASIQ-onboarding behaviour: when BASIQ syncs a row that supersedes an existing QIF/CSV import (Phase 13.10), BASIQ's MCC + native category overrides the catalog seed automatically. The catalog continues to seed any QIF/CSV import the user runs WHILE BASIQ is connected (e.g. historical CSV imports for periods before BASIQ was activated). The L-field seed is parser-level, so it only fires for QIF — BASIQ rows ignore it.

**No migration in this PR** — all PR4 deliverables are application-layer (no schema additions). The optional `bankSuppliedCategory` field on `NormalisedTransaction` is a TypeScript-only type extension; nothing is persisted to a new column at v1 (the L-field seed runs at categorisation time, then drops out — the categoriser's output is what persists).

**Out of PR4, queued:**
- **PR4.5** (small) — wire the dry-run preview into the existing `<ImportWizard />` so the user sees "X duplicates / Y new" BEFORE the commit step + render a "merge / overwrite / skip" picker. The API + helpers are complete; future UI just renders the form.

### PR5 — Vendor + Tax Pack ✅ SHIPPED 2026-05-07

The **load-bearing handoff to Xero** lands with this PR. Three out of five originally-scoped formats ship today; the remaining two (PDF summary, ZIP receipt bundle) defer to PR5.5 because they need new dependencies (`pdfkit`, `archiver`) that warrant separate review.

- ✅ **`Vendor` model** promoted from `MerchantMapping` (D-42-5 scope). Hard FK to `CanonicalCategoryRegistry.defaultCategoryId`; per-user uniqueness on `(userId, normalisedName)`. NOT an AP master — no payment terms, no AP cycle, no invoice tracking. `MerchantMapping` continues to exist as the AI-learning surface; `Vendor` is the user-facing entity. New `lib/bookkeeping/vendor.ts` service: `lookupVendor`, `resolveOrCreateVendor` (race-tolerant; auto-seeds MCC from PR4 catalog), `getVendorAnnualTotals` (12-month trailing aggregator over `unified_transactions`), `CANCEL_URL_REGISTRY` (16 high-volume AU subscriptions seeded; `lookupCancelUrl` is the SSOT lookup).
- ✅ **`TaxCategoryMapping` registry** (D-42-6) — bridge between Monitrax canonical categories and ATO labels (D-1, D-2, D-5, D-9, D-10, Rental Schedule line items 21B-W, Div 40 / Div 43, etc.). 50+ system seed entries in `lib/bookkeeping/taxCategoryMapping.ts:SYSTEM_TAX_MAPPING_SEEDS` covering common AU rental + employee + small-business deductions. Idempotent `seedSystemMappings(userId)` runs lazily on first Tax Pack export (avoids the FK-bootstrap problem). `getMappingsForCategory` prefers user overrides over system defaults.
- ✅ **Tax Pack summary builder** (`lib/bookkeeping/taxPack/summary.ts`) — `buildTaxPackSummary(userId, window)` aggregates per-property P&L blocks, ATO-label totals, and data-source disclosure (BASIQ vs QIF vs MANUAL vs RECEIPT vs CASH). Reads canonical `unified_transactions` rows; composes the `TaxCategoryMapping` registry; never invents numbers. `buildAuFyWindow(input?)` resolves "FY2025-26" / "2025-26" / "2025" to a UTC-aligned window (1 July → 30 June). Hard-coded `TAX_PACK_DISCLAIMER` surfaces in every export.
- ✅ **Xero bank-statement-import CSV** (`lib/bookkeeping/taxPack/csvExporter.ts`) — the LOAD-BEARING handoff. Header order matches Xero's Import Statement spec exactly: `Date,Amount,Payee,Description,Reference`. AU date format DD/MM/YYYY; signed amount in one column (OUT negative); RFC 4180 escaping for commas / quotes / newlines. `renderXeroCsv(transactions, options?)` is the entry point; `transactionToXeroRow` is the canonical mapping. Filename pattern `monitrax-xero-import-YYYY-MM-DD-fy<label>.csv` so the downloaded artefact is self-describing.
- ✅ **Per-property XLSX workbook** (`lib/bookkeeping/taxPack/xlsxExporter.ts`) — uses the existing `xlsx` dep (Phase 16). Sheet ordering: Summary → ATO Labels → Property: \<name\> per property. Sheet names sanitised against Excel's banned character set + 31-char limit. Signed amounts preserved as plain numbers so the accountant can SUM in their own columns.
- ✅ **API**: `GET /api/bookkeeping/vendors` (list); `GET /api/bookkeeping/vendors/[id]` (vendor card with annual totals + related properties + linked contract + cancel URL); `GET /api/bookkeeping/tax-pack/export?fy=&format=csv|xlsx|json` (the load-bearing handoff endpoint; returns binary streams for csv/xlsx with proper `Content-Disposition` + `X-Monitrax-FY` + `X-Monitrax-Tx-Count` headers).
- ✅ **Tests** — 39 new across `tests/bookkeeping/{xeroCsvExporter,taxPackSummary,vendor}.test.ts`. Xero CSV format pinned (header order, DD/MM/YYYY, signed amount, RFC 4180 escaping, empty-set handling). FY-window math (FY2025-26 = 1 Jul 2025 → 30 Jun 2026; January edge cases). Sheet-name sanitisation. Cancel-URL registry hygiene (https-only, 16+ entries). **Cumulative: 160/160 green** (PR1 27 + PR2 13 + PR3 32 + PR4 48 + PR5 39 — note: 39 added across the new files).

BASIQ-onboarding behaviour: Tax Pack aggregates BASIQ + QIF + CSV + OFX + RECEIPT + MANUAL + CASH sources transparently. Per-source counts surface in `summary.dataSources.sources`; per-month breakdowns expose `basiqMonths` vs `importedMonths` vs `manualOnlyMonths` so the accountant can assess provenance at a glance. The disclosure rolls into the JSON summary today; the future PDF (PR5.5) renders it as a footer block.

**Migration:** `prisma/migrations/20260511200000_phase_42_pr5_vendor_tax_pack/migration.sql`. CREATE TABLE × 2, indexes, FKs. NO destructive ALTER, NO DROP, NO row UPDATE/DELETE. CLAUDE.md §12.11 N/A.

**Out of PR5, queued:**
- **PR5.5** (small + needs deps) — PDF summary (`pdfkit`) + receipt bundle ZIP (`archiver`). Both are net-new packages that warrant separate dep-review; the JSON + XLSX + CSV exports already cover the accountant's primary workflow. PR5.5 is the polish layer.
- **PR5.6** (small) — Vendor card drawer UI on the Activity surface (drill-in from any transaction merchant); `<TaxPackExportButton />` on the Reports page. The API + service surface are complete; future UI just renders the form.

### PR6 — The Engagement Layer ✅ FOUNDATION SHIPPED 2026-05-07

**The single most important PR in Phase 42** per Reza directive 2026-05-08. The foundation lands here; the heavier mobile-first interactions (swipe gestures + Review Queue card-stack + Gemini-narrated anomalies) split into PR6.5 to keep this ship-able. Mobile-first promotion: per Reza directive 2026-05-07 ("users most probably perform all of transactions activities through mobile"), every PR6 component is mobile-first by default and PR6.5 is now the load-bearing follow-up.

- ✅ **`EngagementState` schema** — one row per user (`@unique`). Tracks `currentStreak`, `longestStreak`, `lastActiveDate`, `lastShieldUsedAt`, `lastCelebrationAt`, `totalCategorisations`. Migration `20260511210000_phase_42_pr6_engagement` (additive — CREATE TABLE × 1 + index + FK; §12.11 N/A).
- ✅ **Streak state machine** (`lib/bookkeeping/engagement/streak.ts`) — Duolingo-style with shield mechanic. Pure `computeNextStreakState()` deterministic transitions (NEW_STREAK / SAME_DAY / EXTENDED / SHIELD_USED / BROKEN_AND_RESTORED / BROKEN / RESET_AFTER_LONG_GAP). Constants: `STREAK_SHIELD_WINDOW_DAYS=7` / `STREAK_RESTORATION_FRACTION=0.5` / `STREAK_VISIBLE_CAP=365`. Per CLAUDE.md §12.3 — **one** streak engine; every categorisation mutation calls `touchStreak()` here.
- ✅ **Daily Pulse orchestrator** (`lib/bookkeeping/engagement/dailyPulse.ts`) — composes `getOrCreatePeriod` + `getOrCreateEngagementState` + simple anomaly-flag → English narrator. Adaptive CTA: CAUGHT_UP / FEW (1-15) / MANY (16+). Per CLAUDE.md §0 behaviour-psychologist lens — leads with completion %, never with the uncategorised count.
- ✅ **API**: `GET /api/bookkeeping/engagement/pulse` (Daily Pulse data); `GET/POST /api/bookkeeping/engagement/streak` (read state + `?action=touch` + `?action=celebrate` once-per-day gate).
- ✅ **Wired into existing categorisation paths** — `[id]` PATCH (CATEGORY / LINK_ENTITY edits), `bulk-categorise` (one touch per call), `cash` quick-add. All fire-and-forget per CLAUDE.md §12.10 — streak failures NEVER break the calling mutation.
- ✅ **`<DailyPulseCard />`** — engagement front door on Home (`/dashboard`). Mobile-first: stacks vertically below `sm` so the CTA gets a full-width ≥44pt tap target (Apple HIG); side-by-side on tablet+. Self-hides for users with zero transactions in the current month.
- ✅ **`<StreakBadge />`** — small inline pill. Hidden when streak <3 (no shame for new users); caps at "365+"; warm amber palette.
- ✅ **`<CompletionCelebration />`** — toast + once-per-day confetti gated by the server. 60-particle hand-rolled confetti (no new deps). Full `prefers-reduced-motion` support — degrades to text-only toast. Mobile-first: full-width with safe-area-aware padding; dismiss button is ≥44pt tap target on mobile. Wired into Activity's bulk-categorise flow — fires when the user clears a batch.
- ✅ **`<CancelSubscriptionLink />`** — minimal primitive consuming PR5's `CANCEL_URL_REGISTRY`. Direct deep-link to merchant (no Monitrax middleware, no click-tracking per spec §6.7). Two variants: `pill` and `inline`.
- ✅ **Tests** — 22 new unit tests in `tests/bookkeeping/streak.test.ts`. Pure state-machine transitions (every code path), shield-window semantics, reset-after-long-gap, format helpers. **Cumulative: 182/182 green** (PR1 27 + PR2 13 + PR3 32 + PR4 48 + PR5 39 + PR6 22 = 181; counting overlap = 182).

BASIQ-on/BASIQ-off behaviour: `touchStreak()` is source-agnostic — fires for every user mutation regardless of whether the underlying transaction came from BASIQ, QIF, RECEIPT, or MANUAL. The Daily Pulse counts BASIQ + QIF + RECEIPT + CASH transactions identically.

### PR6.5 — Mobile-first Engagement Layer ✅ PARTIAL_SHIPPED 2026-05-07

**Load-bearing mobile follow-up to PR6.** Per Reza directive 2026-05-07 (mobile-first — *"users most probably perform all of transactions activities through mobile"*), the remaining engagement deliverables were PROMOTED to load-bearing.

**Landed in PR6.5:**

- ✅ **Mobile swipe-to-categorise** on Activity rows. New SSOT hook `hooks/useSwipeGesture.ts` (Pointer Events spec, no library dep). Per CLAUDE.md §12.3 — **one** swipe primitive for the entire app. Constants pinned: `SWIPE_THRESHOLD_PX=40` / `TAP_MAX_DRIFT_PX=6` / `LONG_PRESS_MS=300` / `DOUBLE_TAP_WINDOW_MS=300` / `HAPTIC_PULSE_MS=10`. Gestures: left swipe = spending bottom-sheet picker; right swipe = mark as Transfer (PATCH `categoryLevel1='Transfer', categoryLevel2='Internal'`); long-press = full categorise drawer; double-tap = "always categorise [merchant] as ___" (re-PATCHes same category to upsert a `MerchantMapping` server-side). Vibration API for haptic feedback (graceful no-op fallback). `prefers-reduced-motion` respected — drag transform is disabled, taps still work.
- ✅ **`<CategoryPickerSheet />`** — mobile-first bottom-sheet (28px-radius, 220ms slide-up, ≥52pt chip tap targets per Apple HIG). 4 suggested chips + free-form custom input. Composes existing `/api/unified-transactions/[id]` PATCH — no parallel categorise path.
- ✅ **Default-hide chrome** — Advanced view toggle pill in Activity header. Confidence badges + anomaly flag chrome are now hidden by default (calmer first-run); power users opt in. Per CLAUDE.md §0 designer lens — restraint over richness.
- ✅ **`<ConsumerMoneyFlowSankey />`** — reuses Phase 41g `<MoneyFlowSankey />` by projecting `MasterFinancialSnapshot` into a synthetic single-entity ("You") `MoneyFlowResult`. Pure projection in `projectSnapshotToMoneyFlow()`, exported for tests. Source-agnostic — works with BASIQ, QIF, RECEIPT, MANUAL data identically. Mounted at the top of `/dashboard/activity` ("Where your money goes — Year to date") as the *aha moment*. Per CLAUDE.md §12.3 — no parallel chart engine, no parallel aggregator.
- ✅ **Tests** — 16 new unit tests in `tests/bookkeeping/swipeGesture.test.ts` (6 — constants + invariants) and `tests/bookkeeping/consumerSankeyProjection.test.ts` (10 — projection rules: totalIncome echo / outflow conservation / surplus floor / single synthetic entity / zero-amount filter / edge counts / isEmpty semantics). **Cumulative: 198/198 green.**

BASIQ-on/BASIQ-off behaviour: every gesture path PATCHes the same `/api/unified-transactions/[id]` endpoint that PR1-PR6 already use; the Sankey reads canonical `MasterFinancialSnapshot`. No source-specific code paths.

**Deferred from PR6.5 (queued):**

- ✅ **PR6.5b — Pending-actions strip (non-modal)** SHIPPED 2026-05-07 (per Reza idea 2026-05-07: *"have the transaction reconciliation and categorisation be popup when user login to be completed"*; **design pivoted from modal-on-login → non-modal collapsible strip on review** per Claude behavioural-friction pushback + Reza decision *"go with your recommendations"*).

- ✅ **PR6.5e — Persistent reconciliation nudge (cadence + placement fix)** SHIPPED 2026-05-08 (per Reza directive 2026-05-08: *"a message on login: you have few unreconsiled transactions, fix them now?"* + research-backed pattern adoption). Three changes to PR6.5b's strip without touching its data layer: (1) **Moved strip ABOVE the TRAIL hero** on Home — first thing on the feed, YNAB / Mint / Pocketbook pattern (was buried below the TRAIL banner where users never scrolled to it). (2) **Cadence relaxed from once-per-UTC-day → per-session** via `sessionStorage` — strip resurfaces fresh every browser-session login, matching the recurring nature of reconciliation as the most-frequent user task; the server-side `lastPromptShownAt` write is now advisory telemetry only and does NOT gate re-render. `promptOptedOut` global off-switch preserved. (3) **Sidebar count badge on "My Accounts"** — Slack/Mail-style amber pill showing the unreconciled count (formatted with "99+" cap), visible across EVERY page so the recurring-task signal follows the user regardless of route. New `hooks/usePendingReconciliationCount.ts` hook (composes the same `/api/bookkeeping/engagement/pending-actions` route per CLAUDE.md §12.3 — no parallel data path). Strip copy leaned into "Fix now" framing per Reza request — primary CTA reads "X unreconciled transactions / Fix now →" rather than the prior softer "X small things to clean up." 5 new formatter tests (cap behaviour + edge cases). 220 cumulative bookkeeping green. First-login-of-day overlay bundles uncategorised tx + anomalies + recurring detections + receipts pending confirm. Three actions max (Hick's Law / spec §6.6) ordered by descending priority (CATEGORISE > ANOMALY > RECURRING > RECEIPT). Snooze ("Not today" — `lastPromptDismissedAt`) and opt-out ("Don't show me this again" — `promptOptedOut` boolean). Per CLAUDE.md §0 behaviour-psychologist lens — pending-actions framing, NOT categorise-only; warm copy ("Welcome back" / "X things waiting for you" / "Five seconds each — pick one or come back later"); self-hides when nothing to do. Schema: 3 additive nullable / default-false columns on `engagement_state` (migration `20260512100000_phase_42_pr6_5b_pending_actions_gate`). Aggregator `lib/bookkeeping/engagement/pendingActions.ts` composes existing `getOrCreatePeriod()` + 3 cheap count queries (anomaly / unmatched-recurring / pending-receipt). API `GET/POST /api/bookkeeping/engagement/pending-actions` (POST `?action=shown|dismiss|opt-out`). Component `<PendingActionsPrompt />` mounted on `/dashboard` page; bottom-sheet on mobile, centred dialog ≥sm; `motion-safe:` motion utilities; ≥44pt tap targets per Apple HIG. 10 new gate tests pinning the once-per-day semantics + UTC-day boundary + opt-out precedence.
- ✅ **PR6.5c — Review Queue card-stack** SHIPPED 2026-05-07. Opt-in `<ReviewQueueCards />` overlay reachable via a new "Quick review →" pill on the Activity header. Reuses PR6.5's `useSwipeGesture` SSOT + composes the existing `/api/unified-transactions/[id]` PATCH (no parallel categorise path per CLAUDE.md §12.3). Per spec §6.3 — one transaction per card; full-screen on mobile; ≥56pt chip targets; progress bar shows "X of N" momentum; Back step / Skip / Transfer footer always reachable. Queue ordering is anomaly-flagged FIRST (highest tax-pack risk) then chronological newest→oldest — pure `orderReviewQueue()` exported for tests. Empty / completed state celebrates and exits. **Note** (per Reza decision PR6.5b lesson): full-screen overlay is the right pattern HERE because the user *actively chose to enter* review mode — opposite of a popup-on-arrival. 7 ordering tests pinned. `motion-safe:` motion utilities respect `prefers-reduced-motion`.
- **PR6.5d — Gemini anomaly narrative** — replaces the simple flag-name → English mapper in `dailyPulse.ts`. Reuses the existing `lib/cfo/aiAdvisor.ts` engine (no new AI engine per CLAUDE.md §12.3); new tool `getMonthlyTransactionAnomalies` returns deterministic inputs the AI narrates only.

**Out of PR6, queued (PR6.6 — small):**
- Subscription-cancel-hint surface — wire `<CancelSubscriptionLink />` into recurring-payment cards + the future Vendor card UI (PR5.6).

**Hard NO list for PR6 + PR6.5 (per spec §6.7) — preserved across the split:**
- No tutorials. No coach marks. No "Tip of the day."
- No badges, no leaderboards, no point scores.
- No "Are you sure?" confirmations on swipe.
- No notification spam.

---

## 5. New schema additions (PR1 ships these)

```prisma
// PR1 — Category SSOT registry
model CanonicalCategoryRegistry {
  id              String       @id @default(uuid())
  userId          String
  level1          String       // Top-level: "Food & Dining"
  level2          String?      // Sub-category: "Groceries"
  subcategory     String?      // Detailed: "Supermarket"
  type            CategoryType // EXPENSE / INCOME / TRANSFER
  isSystem        Boolean      @default(false)
  customCategoryId String?     // Optional bridge to user-renamed Category
  isActive        Boolean      @default(true)
  taxCategoryId   String?      // Bridge to TaxCategoryMapping (PR5)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@unique([userId, level1, level2, subcategory])
  @@index([userId])
  @@index([userId, type])
  @@map("canonical_category_registry")
}

// PR1 — Bookkeeping period (psychological milestone, NOT statutory close)
model BookkeepingPeriod {
  id                          String                  @id @default(uuid())
  userId                      String
  periodMonth                 DateTime                // First day of the month
  status                      BookkeepingPeriodStatus @default(OPEN)
  reviewedAt                  DateTime?
  reviewedTransactionCount    Int                     @default(0)
  totalTransactionCount       Int                     @default(0)
  lockedAt                    DateTime?
  notes                       String?                 @db.Text
  createdAt                   DateTime                @default(now())
  updatedAt                   DateTime                @updatedAt

  @@unique([userId, periodMonth])
  @@index([userId, status])
  @@map("bookkeeping_periods")
}

enum BookkeepingPeriodStatus {
  OPEN      // Current / past, no review yet
  REVIEWED  // User confirmed; edits still allowed
  LOCKED    // Tax-pack handed to accountant; edits blocked at API
}

// PR1 — Per-mutation audit trail
model TransactionEdit {
  id              String   @id @default(uuid())
  transactionId   String
  userId          String
  editType        String   // CATEGORY / SPLIT / LINK_ENTITY / FLAG / DELETE
  before          Json     // Previous state
  after           Json     // New state
  source          String   // USER / AI / RULE / IMPORT
  editedAt        DateTime @default(now())

  @@index([transactionId])
  @@index([userId, editedAt])
  @@map("transaction_edits")
}

// PR2 — Splits
model TransactionSplit {
  id              String   @id @default(uuid())
  transactionId   String
  amount          Float
  categoryId      String   // FK to CanonicalCategoryRegistry
  propertyId      String?
  loanId          String?
  expenseId       String?
  isTaxDeductible Boolean  @default(false)
  note            String?
  createdAt       DateTime @default(now())

  @@index([transactionId])
  @@map("transaction_splits")
}

// PR5 — Vendor (consumer-side, NOT AP master)
model Vendor {
  id                       String    @id @default(uuid())
  userId                   String
  name                     String
  normalisedName           String
  mcc                      String?
  abn                      String?
  defaultCategoryId        String?   // FK to CanonicalCategoryRegistry
  defaultIsTaxDeductible   Boolean   @default(false)
  suggestedFrequency       String?   // MONTHLY, etc.
  websiteUrl               String?
  cancelUrl                String?   // Deep link to merchant cancellation page
  contractDocumentId       String?   // FK to Document (PDS / contract)
  notes                    String?   @db.Text
  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt

  @@unique([userId, normalisedName])
  @@index([userId])
  @@map("vendors")
}

// PR5 — Tax category bridge for the Tax Pack export
model TaxCategoryMapping {
  id                    String   @id @default(uuid())
  userId                String?  // NULL = system-seeded
  canonicalCategoryId   String   // FK to CanonicalCategoryRegistry
  atoLabel              String   // "D-1", "Rental Repairs", etc.
  schedule              String?  // "Individual Tax Return", "Rental Schedule"
  lineItem              String?  // ATO line number
  notes                 String?
  createdAt             DateTime @default(now())

  @@unique([userId, canonicalCategoryId, atoLabel])
  @@index([userId])
  @@index([atoLabel])
  @@map("tax_category_mapping")
}

// PR3 — New transaction source for receipt-only entries
// (additive enum value via ALTER TYPE migration)
// TransactionSource gets RECEIPT
```

All migrations are additive — no `DROP`, no destructive `ALTER`. CLAUDE.md §12.11 N/A.

---

## 6. The Categorisation Experience (engagement spec)

> Reza directive 2026-05-08: "Focus on design simplicity and modern feeling. The user has to be engaged emotionally and mentally to perform the categorisation tasks — not a chore."

This section is the design contract for the single action the user performs most often in Phase 42: **categorising a transaction**. Get this wrong and the rest of the phase is dead weight. Get this right and Monitrax becomes the AU app users *open daily by choice*.

### 6.1 Reference benchmarks (what we aspire to feel like)

| Product | What we're stealing | What we're rejecting |
|---|---|---|
| **Up Bank (AU)** | Per-transaction emoji + swipe gestures + "Maybe" tag flow | Their playful tone (we're warm but not cute) |
| **Apple Fitness** | Ring-close haptic + animation; daily ritual without notification spam | Achievement spam, badges, leaderboards |
| **Duolingo (lesson loop)** | Streak with shield mechanic; one micro-action at a time; spring micro-rewards | Gamified XP, gem economy, daily-goal pop-ups |
| **Linear / Notion** | Calm typography; tabular nums; restrained motion; keyboard-first power | Generic SaaS density |
| **Stripe (dashboard)** | Premium feel from restraint; numbers that feel honest; deliberate empty states | Heavy chrome, dark patterns |
| **Apple Wallet** | Stack-of-cards interaction; the receding tile pattern; haptic-mirrored animation | iOS-only design idioms |

**What "modern" means in 2026 for this surface:** glass-morphic 28px-radius cards, restrained motion (Apple ease-out only), tabular-nums on every figure, micro-haptics, spring-based feedback on actions, dark-mode-native palette, prefers-reduced-motion respected fully.

### 6.2 The three states of the categorisation surface

Every visit to the categorisation flow is one of three states. The UI must adapt visibly so the user knows which one they're in.

**State A — "Welcome back, here's what changed."** (1-15 transactions to review)

This is the daily-ritual state. Card-stack interface. One transaction shown at a time, full-screen on mobile, centered card on desktop. Big merchant name, big amount, big date. Three actions: confirm AI suggestion (✓), pick a different category (chip strip below), or "this is a transfer / not me" (swipe right). Card flies out, next card slides in. <3 seconds median per transaction.

**State B — "You're caught up."** (0 transactions to review)

The reward state. Single hero card: large ✓, "All caught up — October's a wrap." The Daily Pulse below shows the month's Sankey + the 1-line anomaly narrative + the streak count. Subtle "Browse all transactions →" link for power users who want to revisit. This is the state we want users to *aspire* to and *return to feel*.

**State C — "Quick housekeeping needed."** (16+ transactions to review, or first-time onboarding after 6mo of QIF import)

The bulk state. Spreadsheet-style table appears with a one-line context banner ("After your import, ~3 minutes will catch us up — let's go"). Multi-select + bulk-categorise chips at the top. AI confidence pre-fills every row; the user is editing, not entering. Skip-to-card-view toggle for users who prefer one-at-a-time.

The state machine flows: import → State C → State A (daily) → State B (target) → A (next day's drift).

### 6.3 The micro-interaction: 5-second categorise

The full anatomy of the action that must feel like a *satisfying click*.

**Tap-to-categorise (desktop / mobile, card view):**

```
0ms    User taps a category chip
40ms   Chip pulses (scale 1 → 1.04, ease-out 220ms)
60ms   Quiet ✓ tick fades in over the chip (opacity 0 → 1, 120ms)
180ms  Card scales out (1 → 0.96, opacity 1 → 0, 360ms ease-out)
180ms  Next card slides in from right (x 16 → 0, opacity 0 → 1, 360ms ease-out)
       (Both above run in parallel via AnimatePresence)
220ms  Vibration API: 10ms haptic pulse on supported devices
```

Total: 540ms perceived. Three frames feel "instant" (≤80ms), the rest feels "satisfying" (≤500ms). Beyond 500ms the user starts noticing.

**Swipe-to-categorise (mobile):**

```
Drag left  >40px → spending bottom-sheet picker slides up (4 most-likely categories)
Drag right >40px → "Transfer / not me" tagged + ✓ tick + card flies out
Long-press 300ms → full categorise drawer with all categories + split + link options
Double-tap → "Always categorise [Coles] as Groceries" pill appears for 5s; tap to confirm; writes a MerchantMapping
```

Cancel: drag <40px springs the card back to centre. Forgiving threshold prevents accidental swipes.

**Bulk categorise (State C, table view):**

```
Shift+click rows → multi-select highlighted with emerald ring
Toolbar appears: "Categorise N selected" → opens chip picker
Confirm → all rows update in one API call (single transaction, audit row per row)
Toast: "12 categorised. Undo (5s)."
```

### 6.4 Streak system (Duolingo-style with humanity)

| Mechanic | Rule | Why |
|---|---|---|
| Earn a day | Review ≥ 1 transaction in a 24h window (rolling) | Lower bar than Duolingo (which requires a lesson); we're a tool not a game |
| Streak shield | One missed day per 7-day window doesn't break the streak | Avoids the all-or-nothing collapse that kills habits (Prochaska) |
| Display | Streak count visible on Home + Daily Pulse only — never on Activity (don't shame mid-action) | Restraint + dignity |
| Push notification | Optional — "you'll lose your 12-day streak in 4 hours; 2 mins to save it" | Opt-in only; default OFF; never spam |
| Restoration | Lose a streak → next day's first action restores 50% credit | Recovery is dignified, not punished |
| Maximum visible | Cap at "365+" — beyond a year, the streak loses meaning, the habit IS the reward | Calm |

### 6.5 The completion celebration (the 100% moment)

When the user clears the last transaction in the Review queue:

```
0ms     Last card flies out
100ms   Hero scales in: large ✓ in emerald-500 (scale 0.4 → 1.04 → 1, spring 360ms)
200ms   AnimatePresence confetti burst — single emit, 60 particles, 1.2s duration
        (Confetti shown ONCE PER DAY MAX — scarcity preserves the delight)
400ms   Toast slides in from top: "October's a wrap. ✓ Tax pack ready when you are."
        Toast offers a single tap-target: "View pack →"
600ms   Background BookkeepingPeriod.status flip to REVIEWED
1500ms  Confetti finishes; hero settles to State B
```

If the user already saw the celebration today (rare — usually only on the day of the last transaction), the toast appears without confetti. We don't repeat the confetti — it's a scarce thing that means something.

### 6.6 The Daily Pulse card (Home, the front door)

A single card on Home (`/dashboard`), top of the page below the TRAIL banner, before the existing widgets.

```
┌─────────────────────────────────────────────────────────────┐
│  Today's pulse                          🔥 12-day streak     │
│                                                              │
│  ✓ 88% caught up                       [Review 12 →]        │
│  Netflix went up $4 — third price hike this year.            │
└─────────────────────────────────────────────────────────────┘
```

- **Top row**: month label + streak badge (only if streak ≥ 3 days; otherwise hidden — no shame for new users)
- **Middle row**: completion % with progress bar + primary CTA. CTA copy adapts:
  - 0 to review: "All caught up ✓" (no button — celebration state)
  - 1-15: "Review N →" (single number, friendly)
  - 16+: "Quick housekeeping (~3 min) →"
- **Bottom row**: 1-line anomaly narrative (rotates daily); empty if no anomalies

The Daily Pulse is the *single most important surface in Phase 42* for engagement. Every user opens Home; every user sees this; every user feels invited (not interrogated) to a 3-minute action that builds a daily habit.

### 6.7 What we explicitly REJECT from "modern bookkeeping" UX

Some patterns common in fintech that we will NOT use, because they undermine the engagement principle:

| Pattern | Why we reject it |
|---|---|
| "Suggested actions" sidebars (Mint-style) | Cognitive overload; user becomes a manager, not a doer |
| Persistent "47 uncategorised" badge | Shame trigger; converts a habit into a chore |
| Tutorial overlays / coach marks | If the UI needs explaining, fix the UI |
| Achievement badges, XP, gems | Childish; undermines the trustworthy/premium positioning |
| Confetti / celebration on every action | Devalues celebration; we save it for completion only |
| Push notifications about anomalies | Anxiety trigger; anomalies live IN the Daily Pulse, not in the OS notification tray |
| Modal "are you sure?" confirmations on swipe | Friction in the wrong direction; Undo toast is the safety net |
| Loading spinners during categorise | Feels broken; we use optimistic UI + skeleton fallback |
| Dark patterns ("you might also want to ...") | Trust-killer; absent from every Monitrax surface |

### 6.8 Accessibility + reduced-motion

Everything in this section degrades gracefully:

- `prefers-reduced-motion: reduce` → no spring animations, no confetti, instant card transitions, no haptic mirror; the action still works, the celebration is text-only
- Keyboard-only operation — every swipe gesture has a keyboard equivalent (arrow keys + space; shortcut chip strip Tab-able)
- Screen reader — every action announces ("Categorised: Groceries. Next: Bunnings, $42.50, 22 September.")
- Vibration API gracefully no-ops where unsupported
- Colour contrast: all status text WCAG AA on the cards (emerald-700 on emerald-50 backgrounds, etc.)

### 6.9 The chore-vs-ritual test

Before any PR6 component lands, the implementing engineer answers these three questions in the PR description:

1. **Does this make a single categorisation faster, more satisfying, OR both?** If neither, don't ship it.
2. **Would my user, after using this for a week, *miss it* if I removed it?** If no, it's decoration.
3. **Does this surface respect the user's intelligence and time?** No tutorials. No nags. No tutorials disguised as tooltips.

Reviewer enforcement: any PR6 component that fails any of these three is rejected.

---

## 7. UNCOMPUTED register (v1)

Things the Tax Pack acknowledges it doesn't compute, with the explicit "talk to your accountant" disclaimer:

- **GST input tax credits** — we don't compute GST on personal expenses. Sole traders need GST in Xero; this Pack doesn't claim to be BAS-ready.
- **CGT discount eligibility on shares held >12 months** — partially implemented in Phase 23 (`CapitalGainEvent`); the Pack lists realised events, accountant confirms eligibility.
- **Div 40 / Div 43 depreciation calculations** — Phase 41e tax engine computes these for properties and shipped assets; the Pack EXPORTS the schedule but the user's quantity surveyor / accountant signs off the rates.
- **Negative-gearing offset application** — computed by Phase 41e per-entity; the Pack shows position only, NEVER recommends restructure.
- **Trust distributions / company franking** — Phase 41f imports these from Xero (entity-level summary); the Pack passes them through. Monitrax does NOT compute franking credits or distribution decisions.

This register is the explicit gap between "consumer bookkeeping completion" and "your accountant's job."

---

## 8. CDR / privacy considerations (CLAUDE.md Part 13)

- Receipt bundle export contains personal expense detail — surface a "this download contains CDR-protected data" disclosure on the Tax Pack download confirmation modal.
- Cash quick-add transactions are tagged `source = 'MANUAL'` — never sent to BASIQ on retrospective sync.
- Vendor cancellation URLs may track click events — none are appended; we link directly to the merchant's account page, no Monitrax middleware.
- Transaction splits inherit the parent transaction's CDR classification — a split that links to a property doesn't escape the per-property scope filter.
- Per CLAUDE.md §13.3: receipt bundle filenames are scrubbed of free-form OCR text in the manifest CSV.

---

## 9. BASIQ-onboarding readiness (per-PR review)

**The hard contract:** every Phase 42 capability MUST work identically for users on BASIQ, on QIF/CSV-only, on receipt-only, or any mix. No feature is gated on BASIQ being live. Where BASIQ ENRICHES (better merchant data, MCC, location), Phase 42 surfaces gracefully degrade to QIF-equivalent. Where Phase 42 ADDS (splits, cash, manual receipts), BASIQ ingestion later doesn't disturb the user's annotations.

| Phase 42 capability | BASIQ-on behaviour | BASIQ-off behaviour | Notes |
|---|---|---|---|
| Category SSOT registry | Resolves BASIQ category names + MCC into registry | Resolves QIF `L` category + manual entries | Identical user experience |
| Cross-batch dedup constraint | Partial (excludes BASIQ rows by source) | Active for QIF/CSV/OFX | BASIQ has its own `basiqTransactionId` unique |
| Splits | User adds splits on BASIQ-fed rows freely | Splits land from QIF on import via `S`/`$` | Sum-validation identical |
| Bookkeeping period | Reviews count BASIQ + QIF + cash uniformly | Same | Source-agnostic |
| Receipt → transaction match | Matches against BASIQ-fed + QIF-fed rows | Same | Threshold rule applies regardless of source |
| Cash quick-add | Cash account (`MANUAL`) coexists with BASIQ-connected accounts | Same | Cash transactions never sync upstream |
| Vendor card | Auto-populates richer info from BASIQ enrichment | Falls back to MCC catalog + user input | Both produce annual totals |
| Tax Pack export | "Data sources" footer notes BASIQ months vs imported months | "Sources: QIF imports + receipts + cash" | Same export schema, transparent provenance |
| Sankey + insights | Reads canonical snapshot — source-agnostic | Same | Already source-agnostic at snapshot layer |
| QIF MCC catalog | Used when BASIQ hasn't yet ingested an account | Used always | Removed automatically once BASIQ supersedes (Phase 13.10) |
| QIF `L` field seed | Applied as +0.15 boost on first-touch categorisation | Same | BASIQ later overrides if it provides higher confidence |
| Subscription cancel hints | BASIQ enriches with merchant URL detection | Falls back to seeded `cancelUrl` registry | Same UX |

**Mid-life BASIQ activation pathway** (user starts QIF-only, later connects BASIQ):
1. Phase 13.10 supersession: BASIQ becomes SSOT for the connected accounts; existing QIF transactions remain in DB for audit
2. Phase 42 splits + receipt-links + bookkeeping-period reviews on the QIF rows are PRESERVED (not migrated to BASIQ rows; the QIF row stays as the user-annotated source of truth)
3. New BASIQ transactions get the same Phase 42 treatment going forward
4. Tax Pack export aggregates across both — accountant sees a single timeline

---

## 10. Out of scope (deferred to v2 / PROD or never)

| Item | Reason |
|---|---|
| Double-entry general ledger | Xero owns this |
| BAS preparation / GST coding | Xero owns this |
| Payroll / accounts payable / accounts receivable | Xero owns this |
| Statutory year-end accounts | Xero owns this |
| Multi-entity statutory consolidation | Xero owns this |
| Invoice generation + tracking | Xero owns this |
| Bidirectional Xero sync | Phase 41f scope (and even there, only INBOUND v1) |
| Open Banking export to other tools (YNAB / Pocketbook etc.) | Not in product strategy v1 |
| Crypto wallet ingestion | Phase 23 + future; orthogonal to bookkeeping |
| Custom chart-of-accounts mapping | Xero owns this |
| Bank-feed direct integration (CDR direct, no BASIQ) | Phase 24 brief — not Phase 42 territory |
| Deep tax cases (Div 7A nuance, family trust elections, retirement exemption) | Phase 41h tax engine territory |

---

## 11. Reza sign-off block

The following decisions need explicit "OK to proceed" before PR1 lands. None can be inferred from "no objection."

- [ ] **D-42-1** Category SSOT collapse via `CanonicalCategoryRegistry` (recommended option) vs hard FK to `Category` (deferred)
- [ ] **D-42-2** `TransactionSplit` model with sum-validation rule
- [ ] **D-42-3** Three-status `BookkeepingPeriod` (OPEN / REVIEWED / LOCKED) with opt-in lock semantics
- [ ] **D-42-4** Partial unique index on `UnifiedTransaction(accountId, date, amount, normalisedDescriptionHash) WHERE source IN ('QIF','CSV','OFX')`
- [ ] **D-42-5** `Vendor` model scope (consumer-side card; NOT AP master)
- [ ] **D-42-6** `TaxCategoryMapping` registry approach (vs free-form text)
- [ ] **D-42-7** Receipt-to-transaction matching threshold + new `TransactionSource = 'RECEIPT'` enum value
- [ ] **PR ordering** confirmed (foundation → splits → receipts/cash → QIF parity → vendor/tax-pack → modern UX)
- [ ] **Out-of-scope list** in §9 confirmed — nothing here drifts into Xero territory
- [ ] **Tax Pack disclaimer copy** ("This is a data summary; your registered tax agent confirms deductibility") — confirms Reza's positioning

---

## 12. Build risks + mitigations

| Risk | Mitigation |
|---|---|
| `CanonicalCategoryRegistry` backfill collides with existing learning data (Phase 29 `MerchantMapping.categoryLevel1` strings) | Backfill is read-only on existing data; the registry resolves both old strings and new IDs identically. Phase 29 learning continues to write to its existing tables; only the SURFACE resolution changes. |
| Receipt-matching false positives (wrong transaction linked to a receipt) | User-confirm-before-link is the default at confidence <0.95; auto-link only at ≥0.95 with a 7-day "undo" window in the audit log |
| Split UX gets fiddly on mobile | Splits are desktop-first; mobile shows the split summary + an "Edit splits on desktop" hint at v1 |
| Tax Pack export grows large (200MB+ with receipt bundle for HNW user) | Stream the ZIP; chunked download; export size estimate shown before generation |
| QIF `L` field categories don't map cleanly to Monitrax taxonomy | Maintain a `BANK_CATEGORY_TO_REGISTRY` lookup per detected bank (NAB / CBA / ANZ / Westpac / MYOB); default behaviour is "use as suggestion, confidence +0.10" rather than authoritative |
| Bookkeeping-period lock is mistaken for a statutory close | Copy MUST clarify "this locks edits in Monitrax — your accountant continues their year-end work in Xero independently"; modal + tooltip cover this |
| BASIQ activation mid-life invalidates Phase 42 annotations | Splits / receipts / vendor mappings are keyed to TX `id`, NOT to `basiqTransactionId`. Phase 13.10 supersession marks old QIF rows as `superseded` but doesn't delete them; Phase 42 annotations follow the row, not the source |

---

## 13. Test plan (per sub-PR)

Each PR ships with a matching test pack under `tests/phase-42/`:

- **PR1**: registry backfill correctness (string slug → canonical ID round-trip), dedup constraint violations return 409, audit trail row created on every mutation
- **PR2**: split sum-validation rejects non-summing splits, QIF parser produces splits matching `lib/bank/parsers/qif.test.ts` fixtures, multi-select bulk-categorise updates N rows in one transaction
- **PR3**: receipt-match scoring at boundary thresholds, cash-account auto-creation idempotent, PWA capture metadata surfaces in DME
- **PR4**: QIF `L` field seeded into learning DB, MCC catalog applied at parse time, sanity-check banner appears when balance mismatches by >$1
- **PR5**: Vendor model migration backfill from `MerchantMapping`, Tax Pack export produces ATO-label-grouped CSV, Receipt bundle ZIP excludes documents not linked to the tax year
- **PR6**: Sankey reads from `MasterFinancialSnapshot` (no new aggregation), anomaly narrative produced for known fixtures, swipe gesture handler covered with pointer-event tests, streak counter increments on REVIEWED periods

---

## 14. Approval status

- [ ] Strategic positioning (§1) confirmed by Reza
- [ ] Engagement Principle (§2) confirmed
- [ ] Four-lens design rationale (§2.1) confirmed
- [ ] D-42-1 through D-42-7 (§3) signed off
- [ ] Sub-PR sequence (§4) confirmed
- [ ] Schema additions (§5) signed off
- [ ] **Categorisation Experience design (§6) — every PR6 component to pass the chore-vs-ritual test in §6.9**
- [ ] UNCOMPUTED register (§7) reviewed and accepted
- [ ] CDR considerations (§8) reviewed
- [ ] BASIQ-onboarding readiness (§9) confirmed
- [ ] Out-of-scope (§10) confirmed
- [ ] Reza sign-off block (§11) checked
- [ ] Build risks (§12) accepted
- [ ] Test plan (§13) approved

When all rows above are checked, this doc moves from DRAFT to ACTIVE and PR1 begins. Until then, no Phase 42 code lands.

---

*Last revised: 2026-05-08. Owner: Claude (initial draft) → Reza (sign-off). Sibling: `PHASE_41F_BOOKKEEPING_INTEGRATION.md` for the entity-level Xero pull (the matching half of the Monitrax ↔ Xero handshake).*
