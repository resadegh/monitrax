# Changelog - 2026-06-22

## Session: phase52-kb-schema-shk180 (Phase 52 — build increment 52.1: KB schema + PII-scrubber)

### Changes Made
- **Type**: Feature (Phase 52 build #1) — the shared categorisation knowledge-base schema + the
  de-identification gate. No write-back / consumption yet (the gate ships first, per the build gate).
- **Scope**: `prisma/schema.prisma`, `lib/categorisation/kb/scrubSignature.ts` (new), `lib/services/accountReset.ts`.

### Schema (additive only)
- **`TransactionSignature`** (`transaction_signatures`) — the SHARED, de-identified KB. **No userId**,
  no amounts/dates/balances. `categoryVotes` (JSON, top-N), `topCategory`, `confidence`,
  `distinctUserCount`, `isGlobal` (graduates at k), coarse `amountHint*`. **Unique
  `(region, pattern, matchType)`** = the dedup + lookup key (anti-bloat by construction) + indexes
  on `(region,pattern)`, `mcc`, `isGlobal`.
- **`SignatureContribution`** (`signature_contributions`) — PRIVATE per-`(signature, user)` ledger;
  **`@@unique(signatureId, userId)`** (one vote per user per pattern → distinct-user count + revisable
  vote, no double-count). Cascade-deletes from signature + user.
- New enums `SignatureMatchType`, `SignatureSource`. Migration `20260622000000_add_categorisation_kb`.
- `SignatureContribution` → `RESET_DELETE_MODELS` (account-reset guardrail; the shared signature is
  de-identified aggregate with no userId and self-heals on recompute).

### PII-scrubber (the de-identification gate)
- **`scrubToSignature(raw)`** → `{ok, pattern}` | `{ok:false, reason}`. Layered: (1) REJECT
  transfer-shaped / non-merchant descriptions (transfer/tfr/payid/osko/npp/atm/cash-out/withdrawal —
  where names + account numbers live), (2) STRIP BSBs/card-masks/dates/refs/long-digit-runs +
  payment-method noise (eftpos/visa/pos/direct-debit), (3) normalise → UPPERCASE canonical signature,
  (4) REJECT if no stable merchant token remains. k-anonymity is the second layer. 11 tests.

### Build Status
- [x] `prisma validate` valid · `generate` ok · `tsc --noEmit` clean · `npm run build` passes
- [x] 15/15 tests (scrubber 11 + accountReset guardrail) green

### Destructive write checklist (CLAUDE.md §12.11)
- **None.** Additive only — 2 enum types, 2 new tables. No update/delete/drop; no `db push`. Migration present (§12.12).

### Phase 41E reform compliance (CLAUDE.md §12.14)
- N/A — categorisation infrastructure; no tax-engine function, no financial calc, no per-asset tax UI.

### Security / CDR (CLAUDE.md §13)
- The shared table is de-identified by construction (no userId/amount/date); the scrubber rejects
  PII/transfers before any signature is formed. **Build gate still in force:** the flag-gated
  write-back + a written de-identification procedure + PDF regen precede any cross-user write going live.

### Doc-sync (CLAUDE.md §16)
- [x] data model (schema + migration §12.12) + security/CDR posture → Phase 52 doc §7, `02_UP_NEXT.md`.
- [ ] infra / identity / deploy / UI — none.

---

## Session: phase52-writeback-shk180 (Phase 52 — build increment 52.1b: flag-gated write-back)

### Changes Made
- **Type**: Feature (Phase 52 build #2) — the KB write-back service, gated OFF by default.
- **Scope**: `lib/categorisation/kb/recordContribution.ts` (new).

### Solution
- **`recordContribution({userId, rawDescription, category, mcc?})`** — scrub (de-identify) → upsert the
  shared `TransactionSignature` (dedup on `(region,pattern,matchType)`) → upsert the user's private
  `SignatureContribution` (one revisable vote) → **incrementally** update `categoryVotes` +
  `distinctUserCount` + graduation (`isGlobal` at k=5). Incremental (O(1) per write, no full ledger
  scan) so it scales to popular merchants.
- Pure, unit-tested helpers: **`applyVoteDelta()`** (new vote / vote-change / zero-drop / **top-N cap**)
  and **`summariseVotes()`** (dominant category + confidence + graduation at k).
- **Build gate: `KB_WRITE_ENABLED` defaults FALSE** — no cross-user write happens until explicitly
  enabled (after the written de-identification procedure is signed off). No consumer reads the shared
  prior yet (that's 52.2), so nothing is live.

### Files Added
- `lib/categorisation/kb/recordContribution.ts`
- `tests/categorisation/recordContribution.test.ts` (10 tests — vote maths, graduation, default-OFF gate)

### Build Status
- [x] `tsc --noEmit` clean · `npm run build` passes · 10/10 tests green

### Destructive write checklist (CLAUDE.md §12.11)
- Writes (`upsert`/`update`) target the **feature's own** rows: the shared `TransactionSignature`
  (de-identified aggregate; upsert keyed on the unique pattern) + the caller's own
  `SignatureContribution` (keyed on `(signatureId, userId)`). No other user's data is touched; no
  user-entered financial value is overwritten. **Entire path is gated OFF by default.**

### Phase 41E reform compliance (§12.14)
- N/A — categorisation infrastructure; no tax-engine function, calc, or per-asset tax UI.

### Security / CDR (CLAUDE.md §13)
- De-identification runs first (`scrubToSignature`); the shared row holds no userId/amount/date.
  Build gate (`KB_WRITE_ENABLED=false`) + the pending written de-identification procedure keep any
  cross-user write off until signed off.

### Doc-sync (CLAUDE.md §16)
- [x] code (KB write-back) → Phase 52 doc §7.
- [ ] schema / infra / UI — none (no schema change; reuses 52.1 tables).

---

## Session: phase52-lookup-shk180 (Phase 52 — build increment 52.2: shared-KB lookup primitive)

### Changes Made
- **Type**: Feature (Phase 52 build #3) — the read-path lookup primitive, gated OFF.
- **Scope**: `lib/categorisation/kb/lookupCategory.ts` (new).

### Solution
- **`lookupSharedCategory(rawDescription)`** — scrub → fetch the signature → return the community
  category ONLY for **graduated** (`isGlobal`, ≥k users) patterns above the confidence floor
  (`KB_MIN_CONFIDENCE` 0.6); a miss returns null (caller falls through to rules → later Gemini).
- Pure **`interpretSignature()`** carries the gating (isGlobal + confidence) — unit-tested.
- Gated by **`KB_READ_ENABLED` (default OFF)**; harmless even when on (nothing graduates until writes
  are enabled). 7 tests.

### Files Added
- `lib/categorisation/kb/lookupCategory.ts`
- `tests/categorisation/lookupCategory.test.ts` (7 tests — gating, default-OFF read gate)

### Build Status
- [x] `tsc --noEmit` clean · `npm run build` passes · 7/7 tests green

### Destructive write checklist (CLAUDE.md §12.11)
- **None.** Read-only (a single `findUnique`).

### Phase 41E (§12.14) — N/A. Security/CDR — read-only of de-identified, graduated patterns; gated.

### Doc-sync (CLAUDE.md §16)
- [x] code (read primitive) → Phase 52 doc §7 (52.2 / 52.2b split).
- [ ] schema / infra / UI — none.

### Next
- **52.2b** — wire `lookupSharedCategory` into `categoriseTransaction` (user mapping → rules → KB
  prior → fallback) with canonical-category → level resolution; measure hit-rate.

---

## Session: phase52-wiring-shk180 (Phase 52 — build 52.1c + 52.2b: wire the KB loop end-to-end)

### Changes Made
- **Type**: Feature (Phase 52 build #4) — connect the KB read + write into the live flows (gated OFF).
- **Scope**: `lib/tie/categorisation.ts`, `app/api/unified-transactions/[id]/route.ts`,
  `lib/categorisation/kb/categoryPath.ts` (new).

### Solution
- **52.2b (read-wire):** `lookupSharedCategory` inserted into `categoriseTransaction` precedence —
  user mapping → rules → **KB prior** → fallback. New `source: 'KB'`. `KB_READ_ENABLED` default OFF →
  returns null with **no DB hit**, so existing behaviour is unchanged until enabled. (Gemini-on-miss
  52.3 will slot in after the KB prior.)
- **52.1c (write-hook):** `recordContribution()` called (fire-and-forget, gated) from the category
  correction endpoint (`PATCH /api/unified-transactions/[id]`) alongside the per-user `MerchantMapping`
  upsert — so a confirmation feeds both the user's private mapping AND (gated) the shared KB.
- **`encode/decodeCategoryPath`** — round-trips the 3-level category through the KB's single `category`
  key (lossless, no registry-id dependency).

### Files Added / Modified
- `lib/categorisation/kb/categoryPath.ts` (NEW) + `tests/categorisation/categoryPath.test.ts` (4 tests).
- `lib/tie/categorisation.ts` — KB prior step + `source: 'KB'` + imports.
- `app/api/unified-transactions/[id]/route.ts` — fire-and-forget `recordContribution` hook + imports.

### Build Status
- [x] `tsc` clean · `npm run build` passes · 32/32 categorisation tests green (codec + lookup + write + scrub).

### Destructive write checklist (CLAUDE.md §12.11)
- The write-hook calls the §12.11-guarded `recordContribution` (own rows only) — fire-and-forget,
  gated OFF. No new direct writes; no schema change.

### Phase 41E (§12.14) — N/A. Security/CDR — both paths gated; scrubber de-identifies before any write.

### Doc-sync (CLAUDE.md §16)
- [x] code (read+write wiring) → Phase 52 doc §7 (52.1c / 52.2b ticked).
- [ ] schema / infra / UI — none.

### Note
- Batch categorisation does one indexed `findUnique` per uncategorised tx **only when KB_READ_ENABLED
  is on** (no-op otherwise); batch the KB lookups if profiling shows a need once enabled.
- `bulk-categorise` + `transactions/[id]/link` correction paths can get the same write-hook later (52.1c follow-up).

---

## Session: phase52-housekeeping-shk180 (Phase 52 — KB housekeeping job)

### Changes Made
- **Type**: Feature (Phase 52) — KB tidy-up / anti-bloat job (answers Reza's housekeeping question).
- **Scope**: `lib/categorisation/kb/housekeeping.ts` (new), `app/api/categorisation/kb/housekeeping/route.ts` (new).

### Solution
- **`runKbHousekeeping()`** — prunes **stale, sub-k, never-reinforced provisional** signatures
  (graduated/`isGlobal` patterns are NEVER pruned; near-k kept) older than `KB_STALE_PROVISIONAL_MONTHS`
  (12mo), and returns a **KB-health report** (total / global / provisional / pruned). Pure
  `isStaleProvisional()` predicate (unit-tested).
- **`POST /api/categorisation/kb/housekeeping`** — `CRON_SECRET` + timing-safe auth (mirrors
  `/api/cdr/lifecycle`), for GCP Cloud Scheduler (weekly). Audited.

### Files Added
- `lib/categorisation/kb/housekeeping.ts` · `app/api/categorisation/kb/housekeeping/route.ts`
- `tests/categorisation/kbHousekeeping.test.ts` (4 tests)

### Build Status
- [x] `tsc` clean · `npm run build` passes · 4/4 tests green

### Destructive write checklist (CLAUDE.md §12.11)
- `transactionSignature.deleteMany` — guarded `isGlobal:false` (never a shared/graduated pattern) AND
  `distinctUserCount < k` AND `lastConfirmedAt < cutoff` (12mo). Removes only de-identified, low-value
  provisional aggregate rows; cascade-deletes their (dead-pattern) contributions. No user-owned
  financial data; intended bounded cleanup. **Guard:** the triple `where` filter. Confirmation: NOT
  REQUIRED — operates only on the feature's own de-identified provisional rows.

### Phase 41E (§12.14) — N/A. Security/CDR — operates on de-identified aggregate rows only; cron-auth'd.

### Doc-sync (CLAUDE.md §16)
- [x] code (housekeeping job + cron endpoint) → Phase 52 doc §6b (item 8 ticked).
- [ ] infra — **operator TODO**: create the Cloud Scheduler job once the KB is enabled (noted in doc).

---

## Session: phase52-enablement-shk180 (Phase 52 — enablement procedure + runbook)

### Changes Made
- **Type**: Compliance + operational docs (the build-gate artifacts for enabling the KB). No code.
- **Why**: Reza asked for enablement guidance; the gate requires a written de-identification procedure
  to sign off before flipping the flags.

### Added / Updated
- `docs/policy/CDR_KB_DEIDENTIFICATION_PROCEDURE.md` (NEW) — the sign-off artifact: what the shared KB
  stores (aggregate-only, no userId/amount/date), the de-identification mechanism (scrubber rules),
  k-anonymity second layer, re-identification risk assessment (low), reversibility, disclosure, and a
  sign-off checklist.
- `docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md` §10 — **enablement runbook** (staged: sign-off
  → PDF regen → `KB_WRITE_ENABLED` → Scheduler job → let patterns graduate → `KB_READ_ENABLED` →
  monitor; instant flag rollback).
- `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` — status flipped DESIGN → **BUILT — GATED OFF**,
  awaiting procedure sign-off + PDF regen.

### Doc-sync (CLAUDE.md §16)
- [x] security / CDR posture + policy → de-identification procedure, compliance matrix, Phase 52 §10.
- [ ] code / infra — none (operator enablement steps documented, not executed).

---

## Session: phase52-gemini-onmiss-shk180 (Phase 52 — build 52.3: Gemini-on-miss RAG)

### Changes Made
- **Type**: Feature (Phase 52 #5) — the LLM tail of the categoriser, gated OFF (cost control).
- **Scope**: `lib/categorisation/kb/geminiOnMiss.ts` (new), `lib/tie/categorisation.ts` (step 4 wire).

### Solution
- **`geminiCategoriseOnMiss(rawDescription)`** — last resort after user-mapping → rules → KB prior all
  miss. Sends the **de-identified signature** (never raw PII/transfers — scrubbed first) + the valid
  AU taxonomy + up to 12 graduated KB examples (RAG few-shot) to Gemini Flash; validates `categoryLevel1`
  against the taxonomy; clamps confidence; **never throws into the hot path** (returns null on any error).
  Confirmed answers write back via the 52.1c hook → the tail shrinks over time.
- Wired as **step 4** in `categoriseTransaction` (after the KB prior, before fallback).
- Gated by **`KB_GEMINI_ENABLED` (default OFF)** — AI categorisation was cut 2026-05-09 for cost; this
  brings it back only for the genuine unknown tail, only when enabled.
- Pure `buildCategorisationPrompt()` (JSON-only contract + RAG examples) unit-tested.

### Files Added / Modified
- `lib/categorisation/kb/geminiOnMiss.ts` (NEW) + `tests/categorisation/geminiOnMiss.test.ts` (6 tests).
- `lib/tie/categorisation.ts` — step-4 wire + import.

### Build Status
- [x] `tsc` clean · `npm run build` passes · 42/42 categorisation tests green.

### Destructive write checklist (§12.11) — None (read-only DB; LLM call). 
### Phase 41E (§12.14) — N/A. Security/CDR — only the de-identified signature reaches Gemini; gated.

### Doc-sync (CLAUDE.md §16)
- [x] code (Gemini-on-miss + wire) → Phase 52 doc §7 (52.3 ticked).
- [ ] schema / infra / UI — none.

---

## Session: phase52-seed-shk180 (Phase 52 — build 52.4: seed the KB with curated AU merchants)

### Changes Made
- **Type**: Feature (Phase 52 #6) — day-one KB seed so the (now-enabled) READ path is useful immediately.
- **Scope**: `lib/categorisation/kb/seedData.ts` + `seedKb.ts` (new), `app/api/categorisation/kb/seed/route.ts` (new), `lib/categorisation/kb/recordContribution.ts` (sticky isGlobal).

### Solution
- **`AU_MERCHANT_SEEDS`** — ~80 curated AU merchants (Woolworths/Coles/Bunnings/Telstra/AGL/Netflix/
  Qantas/…) → valid `CATEGORY_HIERARCHY` paths, in bank-feed-normalised form for exact-match hit-rate.
- **`seedCategorisationKb()`** — scrubs each merchant → pattern, inserts as `source:SEED`,
  `isGlobal:true`, confidence 1.0, via idempotent `createMany({ skipDuplicates })` (never clobbers
  accumulated user votes on an existing pattern). `POST /api/categorisation/kb/seed` (CRON_SECRET).
- **Sticky `isGlobal`** in `recordContribution` (`sig.isGlobal || summary.isGlobal`) — a seed or
  graduated pattern can't be demoted by a later vote or a reset-driven decrement.
- 4 seed-integrity tests (count, valid categories, all scrub cleanly, no dup patterns). Dropped bare
  "BP" (2-letter → scrubber rejects; appears as "BP <location>" in feeds anyway — embeddings later).

### Build Status
- [x] `tsc` clean · `npm run build` passes · 46/46 categorisation tests green.

### Destructive write checklist (§12.11) — None (createMany inserts, skipDuplicates; sticky-isGlobal is an additive flag rule). No schema change.
### Phase 41E (§12.14) — N/A. Security/CDR — seeds are public merchant→category facts; no user data.

### Doc-sync (CLAUDE.md §16)
- [x] code (seed + endpoint + sticky isGlobal) → Phase 52 doc §7 (52.4 ticked).
- [ ] infra — operator TODO: run `POST /api/categorisation/kb/seed` once (then graduated merchants exist for READ).

### Operator note
- After deploy, run the seed once: `POST /api/categorisation/kb/seed` with `Authorization: Bearer <CRON_SECRET>`. Re-run safely whenever the seed list grows.

---

## Session: phase52-seed-expand-shk180 (Phase 52 — build 52.4.1: expand the curated AU seed)

### Changes Made
- **Type**: Data (Phase 52) — expand the KB seed from 84 → ~276 curated AU merchants for better day-one READ coverage.
- **Scope**: `lib/categorisation/kb/seedData.ts`.

### Solution
- Hand-curated ~276 well-known AU merchants across all spending categories (groceries, fast food,
  cafes, fuel, PT, rideshare, parking, car maintenance, tolls, department/electronics/home/clothing/
  online retail, furniture, energy/internet/mobile/water, pharmacy/gym/optical/health-insurance,
  streaming/gaming/cinemas/events/books, beauty, flights/hotels/car-rental, insurers, brokers,
  courses). All in bank-feed-normalised form; valid `CATEGORY_HIERARCHY` paths; unique scrubbed
  patterns (4 integrity tests pass).
- **Provenance (licence-clean):** independently-stated public-knowledge facts (merchant → category),
  hand-assembled — NOT copied from any provider's compilation, and NOT derived from Basiq/CDR output
  (per the 2026-06-22 dataset research + the copyright-facts vs CDR-purpose analysis). Defensible in
  an audit; every row is a public fact. HF (MIT) / MCC (Unlicense) remain available for future bulk
  expansion under their licences.

### Build Status
- [x] `npm run build` passes · 4/4 seed-integrity tests green (count, valid categories, scrub-clean, no dup patterns).

### Destructive write checklist (§12.11) — None (data array only; seeded via existing idempotent createMany). No schema change.
### Phase 41E (§12.14) — N/A. Security/CDR — public merchant facts only; no user/CDR data.

### Doc-sync (CLAUDE.md §16)
- [x] data (seed list) — no behaviour/schema change; same `seedCategorisationKb()` path.

### Operator note
- Re-run `POST /api/categorisation/kb/seed` after deploy to load the ~192 new merchants (idempotent — existing 84 are skipped, new ones created).

---

## Session: phase52-fuzzy-prefix-shk180 (Phase 52 — build 52.5a: deterministic fuzzy prefix fallback)

### Changes Made
- **Type**: Feature (Phase 52) — fuzzy matching for the dominant "brand + store/location suffix" feed shape, no infra.
- **Scope**: `lib/categorisation/kb/lookupCategory.ts`.

### Solution
- `lookupSharedCategory` now does **exact match → then a token-prefix fallback**: the longest graduated
  pattern that is a whole-token leading prefix of the signature wins. "WOOLWORTHS METRO 1234" →
  `WOOLWORTHS`; safe against same-token bleed ("WOOLWORTHSX") and different-second-token brands
  ("APPLE MUSIC" ≠ "APPLE STORE"). Pure `isTokenPrefix()` / `pickPrefixMatch()` helpers (unit-tested);
  the DB pass is a wildcard-safe `$queryRaw` (`$1 LIKE pattern || ' %'`, patterns are alphanumeric).
- Transparent to the categoriser (still calls `lookupSharedCategory`); gated by `KB_READ_ENABLED`.
- No infra/schema change. Embeddings (non-prefix variants like "WW METRO" → "WOOLWORTHS") deferred to 52.5b.

### Build Status
- [x] `tsc` clean · `npm run build` passes · 53/53 categorisation tests green (6 new prefix tests).

### Destructive write checklist (§12.11) — None (read-only $queryRaw). Phase 41E — N/A. Security/CDR — reads de-identified graduated patterns only; gated.

### Doc-sync (CLAUDE.md §16)
- [x] code (fuzzy prefix) → Phase 52 doc §7 (52.5a ✅; 52.5b embeddings + 52.5c UI scoped as larger follow-ups).

### Doc-sync sweep (Reza directive — "update all relevant documents into 1181")
Full Phase 51 + 52 documentation brought current in this PR:
- `docs/blueprint/MASTER_BLUEPRINT.md` — added **Phase 51 + Phase 52** rows to the phase-status table (§3.4).
- `docs/00_INDEX.md` — indexed `PHASE_51_*` + `PHASE_52_*`.
- `docs/operational/runbooks/14_CATEGORISATION_KB_OPERATIONS.md` (NEW) — **BAU runbook**: flags, seed/housekeeping endpoints, CRON_SECRET, Cloud Scheduler setup, KB-health monitoring, re-seed, troubleshooting, compliance guardrails. Indexed in `operational/00_INDEX.md`.
- `docs/bau-framework/06_CDR_COMPLIANCE_OPERATIONS.md` — KB de-identified cross-user learning section (CDR posture + links).
- `docs/implementation/04_RECENTLY_COMPLETED.md` — Phase 51.1 + Phase 52 completion entries.
- `docs/implementation/02_UP_NEXT.md` — Phase 52 status → ENGINE SHIPPED + LIVE (52.5b/c remaining).
- `docs/IMPLEMENTATION_PLAN.md` — hub Last updated.
- (Compliance already merged earlier: `policy/CDR_KB_DEIDENTIFICATION_PROCEDURE.md`, `compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md`, privacy policy §4.1/§6.2, `policy/CDR_DATA_MINIMISATION.md`, CDR consent notice.)

---

## Session: phase52-review-ui-design-shk180 (Phase 52.5c — review-exceptions inbox design + §18.8 quality gate)

### Changes Made
- **Type**: Design (Stitch) + process rule (CLAUDE.md §18.8). No app code.

### CLAUDE.md §18.8 — Stitch output quality gate (NEW, Reza directive 2026-06-22)
- Every Stitch output must be **self-reviewed against a 7-lens rubric and score > 9/10 before being
  presented**; sub-9 designs are iterated until they pass; the scores are shown for auditability;
  reviewers reject sub-9 designs or sub-9→React conversions. Applies to all surfaces + all sessions.
  Protocol version bumped 2.2 → 2.3.

### Design — review-categories inbox (52.5c)
- Stitch screen generated (v1 `291a1716`, **scored 8.0/10 → rejected** per the new gate), then refined
  via `edit_screens` (v2 `fdf91885`, **scored 9.2/10 → passes**). v2 = true sky→indigo gradient + glow,
  TRAIL-coloured category pills + secondary community-confidence cues, refined emerald checkboxes,
  merchant-primary hierarchy, amber "Needs a look" accent strip, sky-tinted "apply to all <merchant> —
  past & future" learn-once sub-panel, calm "All caught up" empty state. Artefact:
  `.stitch/designs/phase52/review-categories-inbox-v2.png`.
- **Next:** Reza nod → React build (ReviewQueue component + review-queue / bulk-confirm / apply-rule
  endpoints, reuse `recordContribution` for the learn-once rule) + dark + mobile variants (all through the §18.8 gate).

### Doc-sync (CLAUDE.md §16)
- [x] design system / process → CLAUDE.md §18.8 + Phase 52 doc §7 + this changelog.

---

## Session: phase52-review-ui-design-shk180 (Phase 52.5c — KB write-back across ALL human confirmation surfaces)

### Changes Made
- **Type**: Feature (engine wiring) — make the shared categorisation KB learn from every genuine human categorisation path, not just the single-transaction edit.
- **Scope**: `lib/categorisation/kb/`, `lib/bank/reviewQueue.ts`, `app/api/unified-transactions/{bulk-categorise,[id]}/route.ts`.
- **Root cause (gap found on build per §10):** before this, only `PATCH /api/unified-transactions/[id]` fed the shared KB (`recordContribution`). The bulk/review confirmation paths — `bulk-categorise` (power-user "Categorise N selected"), `bulk-confirm` (the Phase 49 "AI bookkeeper" medium/low bands), the per-row "✓ Looks right" affordance, and the per-batch review route — all wrote the PRIVATE `merchantMapping` but **never fed the cross-user KB**. So the AI engine could not learn from the highest-volume categorisation paths.
- **Solution:** one canonical learn-once helper `recordKbContribution()` (`lib/categorisation/kb/recordFromConfirmation.ts`, §12.2 SSOT) — encode triple → gate (`KB_WRITE_ENABLED`) → scrub → swallow. Wired into:
  - `confirmReviewItem` (`lib/bank/reviewQueue.ts`) — covers bulk-confirm bands + per-row "✓ Looks right" + per-batch review in one place.
  - `bulk-categorise` route — once per distinct merchant in the batch.
  - single PATCH — refactored off the inline `recordContribution`/`encodeCategoryPath` onto the same helper.
  - All callers pass the **canonical category triple** (same vocabulary the KB stores → no vote fragmentation).
- **Echo-chamber-safe:** import-time AI auto-accept (`bulkConfirmAutoAccepted`) and `bulkConfirmHighBand` are deliberately NOT wired — only a genuine human confirm/edit/re-categorise is a real k-anonymity vote.

### Link Transaction dialog — KB question (Reza, 2026-06-22)
- Investigated: the Link Transaction dialog (`/api/transactions/[id]/link`) runs in the **legacy flat-enum** category vocabulary; the KB runs in the canonical 3-level hierarchy. Wiring it directly would fragment KB graduation + surface mismatched names. **Deliberately deferred** to a thin `enum ↔ canonical` vocabulary bridge (Phase 52 doc §8b; `02_UP_NEXT.md`).

### Files Modified
- `lib/categorisation/kb/recordFromConfirmation.ts` (NEW) — canonical learn-once helper.
- `lib/bank/reviewQueue.ts` — `confirmReviewItem` now calls `recordKbContribution` after the queue update.
- `app/api/unified-transactions/bulk-categorise/route.ts` — per-distinct-merchant KB write-back.
- `app/api/unified-transactions/[id]/route.ts` — refactored onto the shared helper.
- `docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md` — §7 (52.5c shipped), §8b (vocabulary-bridge follow-up), §9 (review-inbox placement open Q).
- `docs/implementation/02_UP_NEXT.md` — 52.5c status + vocabulary-bridge Up Next.

### Build Status
- [x] `npx tsc --noEmit` passes.

### Doc-sync (CLAUDE.md §16)
- [x] code (KB engine wiring) → Phase 52 doc §7/§8b/§9 + this changelog + `02_UP_NEXT.md`. No design/config/infra/identity/security surface changed (endpoints reused, no new env vars, no schema change).

---

## Session: phase52-review-ui-design-shk180 (Phase 52.5c — Link/reconciliation tool SSOT audit + KB read/write)

### Changes Made
- **Type**: Feature + SSOT remediation. Reza ask 2026-06-22: *"are you performing an audit and review on the link / reconciliation tool to make sure it will be SSOT and read/write to the new KB AI engine?"*
- **Audit finding**: `/api/transactions/[id]/link` (the Link/reconciliation dialog) was the one categorisation surface off-SSOT on two axes — it wrote raw **legacy flat codes** to `merchantMapping`, **never** seeded the `CanonicalCategoryRegistry` (§12.2), and **never** read/wrote the shared KB. Everything else uses the canonical 3-level triple.
- **Fix**:
  - NEW `lib/categorisation/kb/categoryBridge.ts` — the single documented correspondence between the legacy flat-code vocabulary and the canonical hierarchy: `legacyCodeToCanonical()` + `canonicalToLegacyCode()` (deterministic → no KB vote fragmentation). 12 tests.
  - `learnCanonicalFromLink()` in the link route — at every `learnMerchant` site (link-to-income/expense, create-income, create-expense): bridge code → triple → `resolveOrCreateCategory` (seed registry) + `recordKbContribution` (teach KB). Skips loan links (Phase 51 ledger owns repayments) + custom categories (free-text, never graduate).
  - READ: `suggestedCategory` now consults `lookupSharedCategory` (graduated community KB) and maps the canonical answer back to a legacy code for the dialog's `CategorySelect`.
  - Both gated (`KB_WRITE_ENABLED`/`KB_READ_ENABLED`), de-identified, fire-and-forget.
- **Remaining (non-blocking tech-debt)**: `merchantMapping.categoryLevel1` still stores the legacy code at these sites (keeps the dialog's existing read working); full `merchantMapping`→canonical unification retires the bridge later.

### Files Modified
- `lib/categorisation/kb/categoryBridge.ts` (NEW) + `tests/categorisation/categoryBridge.test.ts` (NEW, 12 tests).
- `app/api/transactions/[id]/link/route.ts` — `learnCanonicalFromLink()` helper + 3 write sites + KB read fallback for `suggestedCategory`.
- `docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md` §7 + §8b (audit + fix).
- `docs/implementation/02_UP_NEXT.md` — item flipped to DONE.

### Build Status
- [x] `npx tsc --noEmit` passes.
- [x] `vitest run tests/categorisation/` — 64/64 pass (incl. 12 new bridge tests).

### Doc-sync (CLAUDE.md §16)
- [x] code (link-tool SSOT + KB wiring) → Phase 52 §7/§8b + this changelog + `02_UP_NEXT`. No design/config/infra/identity/security surface changed (no new endpoints, env vars, or schema).

---

## Session: phase52-review-ui-design-shk180 (Phase 52.5c-UI — dedicated Review categories inbox)

### Changes Made
- **Type**: Feature (UI) — dedicated full-page categorisation triage inbox (Reza decision 2026-06-22: dedicated page, not a refresh of the inline card).
- **Scope**: `app/dashboard/activity/review/`, `components/bookkeeping/`.
- Reuses the existing, now-KB-wired endpoints (GET `bulk-confirm` summary + GET `review-queue?band=` + POST `review-queue` confirm/skip) — **no new endpoints**. Confirming routes through `confirmReviewItem` → `recordKbContribution`, so the inbox teaches the shared KB.

### Stitch (§18 + §18.8 gate) — 4-variant matrix, all > 9/10
- desktop light `fdf91885` 9.2 (approved earlier) · desktop dark `c31ae9ca` **9.4** (vs v1 ~9.1) · mobile light "Unified Feed" `c203a7d7` **9.3** (vs "Stacked" ~9.0) · mobile dark `0fc7905b` **9.3**.
- Artefacts: `.stitch/designs/phase52/review-categories-inbox-v2{,-dark,-mobile,-mobile-dark}.{html,png}`.

### Files Modified
- `components/bookkeeping/ReviewCategoriesInbox.tsx` (NEW) — glass-vocabulary inbox (header progress, bulk-confirm, per-row confirm/skip, amber "Needs a look" low band, "All caught up" empty state); light/dark via editorial tokens; mobile-responsive.
- `app/dashboard/activity/review/page.tsx` (NEW) — DashboardLayout wrapper.
- `components/bookkeeping/ConfidenceReviewCard.tsx` — "Open review inbox →" deep-link (entry point).
- `.stitch/designs/phase52/*` — 6 new artefacts (3 PNG + 3 HTML for dark/mobile/mobile-dark).
- `docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md` §7 + §9 (shipped).

### Build Status
- [x] `npx tsc --noEmit` passes.
- [x] `eslint` clean on new/changed files.

### Doc-sync (CLAUDE.md §16 + §18.8)
- [x] design system / Stitch → Phase 52 §7/§9 + this changelog; 4-variant matrix at ≥9 recorded; artefacts committed. No config/infra/identity/security surface changed.

---

## Session: loan-import-discoverability-and-inbox-booked-shk180 (Phase 51 follow-ups — import discoverability + Transaction Resolution Precedence)

### Issue 1 — loan-statement import not discoverable
- **Symptom (Reza):** imported-statement option not visible on the loan account; user looked on the loan **edit form** (which only has the Gemini "Attach document to auto-fill" for form fields), not the loan **detail dialog → Repayments tab** where the QIF/CSV/OFX import lives.
- **Fix:** `LoanDetailDialog` gains an `initialTab` prop (controlled Tabs); Balances loan rows gain an "Import statement" action (mirrors AccountRowView) that deep-links to detail → Repayments. `openLoanDetail(loan, tab?)`.

### Issue 2 — reconcile/link doesn't recognise loan repayments (the important one)
- **Root cause (audit):** the Phase 51 ledger matcher lives ONLY in the loan Repayments tab ("Find offset matches", matches against the loan's LINKED offset account). The Activity reconcile/link dialog was **never wired to the ledger** — it matched loans by `loan.minRepayment` (0 for interest-only) → "No matching entries found" → fell back to batching all same-description "Periodical Payment To Bankwest" rows together (the cross-loan collision Phase 51 set out to solve).
- **Reza directive:** categorisation must first check ALL the user's accounts/ledgers to see if a txn is a transfer / loan repayment / etc., BEFORE the KB engine.
- **Fix (suggest-first, reconcile-surface-first — Reza decisions):**
  - `lib/bookkeeping/resolveTransaction.ts` (NEW) — `resolveTransactionMatches()` matches a txn against all loan ledgers (exact amount + date window) + other accounts (opposite-direction sibling = transfer). Ranked candidates; nothing auto-applied.
  - `linkRepaymentToTransaction()` (matchRepayments.ts) — confirm a ledger-repayment↔txn link from the Activity side (LoanTransaction→LINKED, funding txn→isTransfer + loanId). §12.11-safe.
  - `/api/transactions/[id]/link` GET returns `resolution` + **suppresses same-vendor batch** when resolved; POST gains `action:'linkLoanRepayment'`.
  - `TransactionLinkDialog` surfaces "Loan repayment — <loan> · Link as repayment" / "Transfer <to/from> <account> · Mark as transfer" at the TOP of Suggested, above categorisation.

### Files
- NEW `lib/bookkeeping/resolveTransaction.ts`; `lib/bookkeeping/loanLedger/matchRepayments.ts` (+`linkRepaymentToTransaction`); `app/api/transactions/[id]/link/route.ts` (resolution GET + suppress batch + linkLoanRepayment POST); `components/transactions/TransactionLinkDialog.tsx` (resolution UI); `components/loans/LoanDetailDialog.tsx` (`initialTab`); `app/dashboard/balances/page.tsx` (loan-row import entry); docs.

### Destructive write checklist (CLAUDE.md §12.11)
- `linkRepaymentToTransaction` — `prisma.unifiedTransaction.updateMany({ where:{ id, userId }, data:{ isTransfer:true, loanId }})` + `loanTransaction.update`.
  1. **`where` matches:** the single txn the user explicitly picked in the dialog (by id, scoped to userId) + the one ledger row.
  2. **Columns overwritten:** `isTransfer` (→true), `loanId` (→ the loan); LoanTransaction `matchStatus/matchedTransactionId/matchConfidence`. No user-entered amount/description/category touched.
  3. **Guard:** id + userId; the action IS the user's explicit confirmation in the Link dialog.
  - User confirmation: NOT REQUIRED — user-initiated, own rows, reversible (unlink).

### Build Status
- [x] `npx tsc --noEmit` passes.
- [x] `eslint` clean on changed files (1 pre-existing exhaustive-deps warning on the existing loadMatches effect — not introduced here).

### Doc-sync (CLAUDE.md §16)
- [x] code (loan import discoverability + resolution precedence) → Phase 51 doc §6 (51.2) + this changelog. No design-token/config/infra/identity/security surface changed; no schema change.
