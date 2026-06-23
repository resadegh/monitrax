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

---

## Session: recon-link-redesign-shk180 (Phase 51 — reconcile/link dialog Stitch redesign)

### Design (Stitch-first §18.2.1 + §18.8 gate)
- Redesigned the Link/reconcile modal for simplicity: one clear action + progressive disclosure ("More options"), keeping every function (audit table in PR). In-app glass vocabulary (§18.7.2).
- Stitch 4-variant matrix (focused state) + expanded state, all >9 per §18.8: focused desktop-dark `c1d12153` 9.3 / desktop-light `1a219881` 9.3 / mobile-light `6b4e490f` 9.3 / mobile-dark `b054603f` 9.1; expanded desktop-dark `e7a9afdc` 9.1 / desktop-light `88d0d73a` 9.1. v1 expanded scored 8.5 (green primary) → fixed to sky→indigo, re-scored.
- Artefacts: `.stitch/designs/phase51-recon-redesign/recon-link-*.{html,png}` (project 1859462351962811110).
- Stitch note: `edit_screens` updates HTML but its preview thumbnail re-renders lazily; use `generate`/`variants` for immediate faithful renders. Stitch remains the sole UI design platform (§18).

### Next (same PR): React restructure of TransactionLinkDialog (collapsed primary action + showMore disclosure, all handlers preserved).

### Doc-sync (§16): Phase 51 doc §10 + this changelog.

---

## Session: recon-link-react-conversion-shk180 (Phase 51 — reconcile/link dialog React conversion)

### Changes
- Converted the approved Stitch redesign (PR #1184) into the live `TransactionLinkDialog`:
  - **Collapsed one-clear-action view** at rest: leads with the Phase 51.2 resolution cards (loan repayment / transfer); when none, a single primary "Categorise this transaction" CTA. A quiet "More options ▾" / "Not a repayment? More options" reveals the rest.
  - **Full tabbed UI (Suggested / All / Create / Split) reveals under `showMore`** (or automatically when a `currentLink` already exists, so unlink/change stays reachable).
  - **Same-vendor batch gated behind `showMore`** (was always-on) — keeps the collapsed view to one action; still server-suppressed when a resolution match exists.
  - Resolution cards extracted to a shared `resolutionCards` const (no duplication between collapsed + expanded).
  - **No function removed** — link / create / split / transfer / investment / batch / receipt / vendor card / merchant-learning all preserved, just demoted behind disclosure.
- `showMore` resets closed on every dialog open.

### Files
- `components/transactions/TransactionLinkDialog.tsx` — showMore state + collapsed view + disclosure gating + shared resolution const.

### Build Status
- [x] `npx tsc --noEmit` passes.
- [x] `eslint` — only the pre-existing loadMatches exhaustive-deps warning (not introduced here).

### Doc-sync (§16 + §18): design artefacts shipped in #1184; this commit is the React conversion. Phase 51 doc §10 + this changelog.

---

## Session: recon-link-v3-fidelity-shk180 (Phase 51 — dialog v3 visual fidelity follow-up)

Reza feedback on the #1185 ship: the dialog "almost looks the same as before … More options is exactly like before … doesn't look like the v3 Stitch." Correct — #1185 applied the *structure* (collapsed view + disclosure) but reused the old hero styling + the old 4-tab wall. This commit brings the visual vocabulary in line with the approved v3:
- Header: sky eyebrow "Link transaction" + warm subtitle ("We think we know what this is." when a resolution match exists, else "How would you like to handle this?").
- Hero: larger `text-2xl tabular-nums` amount.
- Collapsed primary CTA: sky→indigo brand gradient (was default green); opens Create directly.
- **"More options" is now a slim-row menu** (Categorise / Suggested matches / Link to existing / Split) that navigates to ONE focused section at a time with a "Back to options" affordance — replacing the 4-tab wall. Controlled `moreView` state; resets to 'menu' on open.

### Files: `components/transactions/TransactionLinkDialog.tsx`. tsc + eslint clean (pre-existing loadMatches warning only).
### Doc-sync (§16/§18): matches the merged v3 artefacts in `.stitch/designs/phase51-recon-redesign/`; this changelog.

---

## Session: review-inbox-booked-uncategorised-shk180 (Phase 52.5c-fix — inbox showed "All caught up" while hundreds uncategorised)

### Bug (Reza, live test 2026-06-22)
The Review categories inbox (`/dashboard/activity/review`) showed "All caught up" while Activity showed "Low · 283" + many Uncategorised rows.

### Root cause
The inbox read ONLY the import **staging queue** (`TransactionReviewQueue` via `review-queue?band=`), which was empty. The 283 are **booked `UnifiedTransaction`s** that are low/medium-confidence + uncategorised (`txLow`/`txMedium` — the gap explicitly noted in `lib/bank/bulkConfirm.ts` `getConfidenceSummary`). The inbox never read that population, so its `items.length === 0` empty-state fired.

### Fix
`components/bookkeeping/ReviewCategoriesInbox.tsx` now also fetches booked uncategorised transactions via `GET /api/unified-transactions?uncategorized=true` (the SSOT "needs review" set — unlinked + `userCorrectedCategory != true`, same definition behind the Activity "Uncategorised" badge + Home pending count). They render in a new "Needs a category (N)" section; each row opens the v3 `TransactionLinkDialog` to categorise (reuses the Phase 51 surface — no new endpoint). Empty state now fires only when staged queue AND booked uncategorised are both empty; header "to review" + progress include the booked total. Staged bulk-confirm bar gated to staged items only.

### Files: `components/bookkeeping/ReviewCategoriesInbox.tsx`. tsc + eslint clean.
### §18.2.1 backfill owed: the "Needs a category" section reuses the existing staged-row glass vocabulary (not a net-new composition), but a Stitch artefact for the two-section inbox is owed as a follow-up backfill.
### Doc-sync (§16): Phase 52 doc + this changelog.

---

## Session: activity-confidence-band-filter-fix-shk180 (Activity "High" band shows nothing)

### Bug (Reza, 2026-06-22)
On `/dashboard/activity`, clicking the "High · 83" band chip showed "No transactions match" despite the count; "Low · 283" worked; no Medium chip (expected — 0 medium).

### Root cause
`tileFilter` defaults to `'uncategorized'`, and the band chip set `confidenceBand` WITHOUT clearing it, so the list query AND-ed both: `confidence=high & uncategorized=true`. High-confidence rows are auto-filed (categorised), so the intersection is empty. Low only appeared to work because low-confidence rows happen to be uncategorised. The band counts intentionally count the WHOLE band, so the list was inconsistent with the count.

### Fix
`app/dashboard/activity/page.tsx` — when a confidence band is active it is the SOLE lens (takes precedence over the uncategorized/spend/income tile filters). High now shows all high-confidence transactions, matching its chip count.

### Files: `app/dashboard/activity/page.tsx`. tsc + eslint clean (pre-existing warning only).
### Doc-sync (§16): this changelog. No config/schema/infra change.

---

## Session: ai-bookkeeper-tile-and-bands-shk180 (AI-bookkeeper tile hidden + Medium band missing)

### Bugs (Reza, 2026-06-22)
1. The "Your AI bookkeeper" tile (entry point to the review inbox) never appeared, despite 283 uncategorised booked transactions.
2. The Medium confidence band chip was missing on Activity.

### Root causes + fixes
1. `components/bookkeeping/ConfidenceReviewCard.tsx` — the show/hide gate counted only the staging queue (`medium + low + highUnconfirmed`), ignoring booked low/medium rows (`txMedium/txLow`). Same gap as the inbox. Now `pending` includes `txMedium + txLow`, so the card (and its "Open review inbox" link) appears whenever there is booked review work.
2. `app/dashboard/activity/page.tsx` — the three confidence bands hid at 0, so Medium (genuinely 0 for this user) wasn't shown. The three core bands now always render, so the lens is predictable ("Medium · 0" instead of a missing chip).

### Files: `components/bookkeeping/ConfidenceReviewCard.tsx`, `app/dashboard/activity/page.tsx`. tsc + eslint clean (pre-existing warning only).
### Doc-sync (§16): this changelog. No config/schema/infra change.

---

## Session: ai-use-disclosure-kb-shk180 (legal — disclose shared categorisation KB in AI Use Disclosure)

### Context (Reza, 2026-06-22)
Item 3 of the review session: ensure privacy/compliance docs needing user review are published. Finding: the 13 legal docs are ALREADY published at `/legal` (3 consent-captured at signup), and the **Privacy Policy §4.1 already fully discloses the shared categorisation KB**. The only gap: the **AI Use Disclosure** didn't mention the cross-user de-identified learning.

### Change (DRAFT — needs Reza sign-off before merge)
- `docs/legal/07_ai_use_disclosure.md` — added **§5.1 "Learning from your categorisations (shared knowledge base)"**, mirroring Privacy Policy §4.1 (de-identified patterns, k-anonymity, no PII/amounts/dates, user categorisations take precedence, not sold, not for general-AI training, CDR de-identification). Version bumped v1.0 → **v1.1-2026-06-23**.
- AI Use Disclosure is a **supporting** (non-consent-captured) doc, so the version bump does not trigger re-consent.

### Files: `docs/legal/07_ai_use_disclosure.md`. Doc-only; no code/schema/infra.
### Note: legal text — recommend Reza (and ideally legal counsel) confirm wording before merge/publish.

---

## Session: skip-button-and-tile-ssot-shk180 (reconcile Skip broken + AI-tile SSOT violation)

### Bugs (Reza, 2026-06-23)
1. In the reconcile/Link dialog, **"Skip for now" did nothing**.
2. **SSOT violation:** the AI-bookkeeper tile showed "0 low — nothing waiting" while the Activity band chip below showed "Low · 283" — two different values for the same thing.

### Root causes + fixes
1. `app/dashboard/activity/page.tsx` `onNavigateNext` always reopened `current[0]`. On a Skip (which doesn't change the list), that re-opened the SAME first transaction → looked broken. Now it finds the current transaction's index and advances to the NEXT one (`idx + 1`); after a confirm/categorise the row is gone (`idx === -1`) so it falls back to `current[0]` (the new first) — that path still works. Closes when none remain.
2. `components/bookkeeping/ConfidenceReviewCard.tsx` — the tile's medium/low **counts** used staging-only `medium`/`low`, while the Activity chips count the whole band (staging + booked = `+ txMedium/txLow`). The tile now shows `mediumCount = medium + txMedium` and `lowCount = low + txLow`, matching the chips (e.g. "Review 283 low"). `confirmBand('medium')` still bulk-confirms only the staging portion; booked rows route to the per-band review surface (`onReviewBand`). Single canonical band-count definition across both surfaces.

### Files: `app/dashboard/activity/page.tsx`, `components/bookkeeping/ConfidenceReviewCard.tsx`. tsc + eslint clean (pre-existing warning only).
### Doc-sync (§16): this changelog. No config/schema/infra change.
---

## Session: cashflow-actuals-phase1-shk180 (Cashflow correctness Phase 1 — actual-transaction headlines)

### Changes Made
- **Type**: Fix (financial correctness) — headline cashflow tiles were computed from DECLARED
  records (Expense/Income/Loan × frequency) and silently dropped uncategorised / unlinked OUT
  transactions, producing a falsely optimistic surplus / margin / runway. This phase adds an
  ACTUAL-transaction path to the canonical snapshot and repoints the 5 worst-offending surfaces.
- **Scope**: `lib/calculations/actualCashflow.ts` (new pure engine), `lib/services/masterFinancialService.ts`
  (new actual fields on `quickMetrics`), 5 API routes.
- **Root Cause**: `calculateCashflow()` (cashflowOrchestrator) only sees declared records. The only
  transactions master loaded were `incomeId/expenseId NOT null` (for budgetVariance) — every
  uncategorised/unlinked OUT transaction was invisible to every headline number.
- **Solution**: extracted the correct aggregation pattern (already present in `lib/tie/analytics.ts`
  + `lib/calculations/moneyStoryTrend.ts`) into one pure, unit-tested engine and surfaced its output
  on `quickMetrics` as ADDITIVE fields (declared fields untouched for back-compat).

### New canonical engine — `lib/calculations/actualCashflow.ts`
- `computeActualCashflow(transactions, { now })` → `{ currentMonthOutflow, currentMonthInflow,
  currentMonthNet, avgMonthlyOutflow, avgMonthlyInflow, outflowByCategory, hasActualData }`.
- Rules: excludes `isTransfer === true`; `Math.abs(amount)`; OUT/IN by `direction`; null category →
  `'Uncategorised'` (INCLUDED in totals); trailing-3-FULL-month average with a fixed /3 divisor
  (a zero-spend month is a real data point). Empty input → all zeros, `hasActualData=false`.

### New master snapshot fields (additive — `quickMetrics`)
- `actualMonthlyOutflow` — current calendar-month OUT (abs, ex-transfers, incl. Uncategorised)
- `actualMonthlyInflow` — current calendar-month IN
- `actualNetCashflow` — inflow − outflow (can be negative)
- `actualAvgMonthlyOutflow` — trailing-3-full-month avg OUT (for rate/runway tiles)
- `actualOutflowByCategory` — current-month OUT by category (null → 'Uncategorised')
- `hasActualData` — true if any non-transfer txn in the trailing ~4-month window
- New SEPARATE fetch of ALL `unifiedTransaction` rows (trailing 4 months, `{date, amount, direction,
  categoryLevel1, isTransfer}`). The existing linked-only fetch (budgetVariance) is UNCHANGED.

### 5 repoints (headline = actual; declared kept for plan/back-compat)
1. `app/api/cashflow/intelligence/route.ts` `buildWaterfallData` — money-out + per-category + surplus
   now from `actualOutflowByCategory` + `actualMonthlyInflow` (no separate loan line — loans already
   appear as OUT txns). Master fetched once, reused for saving-opportunities.
2. `app/api/cashflow/intelligence/route.ts` `buildBudgetComparison` — the "Actual" column now from
   `actualOutflowByCategory` (was `expense.amount × frequency` — i.e. Actual==Plan).
3. `app/api/dashboard/insights/route.ts` Money-Story — `kept`/`keptMargin`/`surplus` switch the spend
   side to actuals (kept = net income − actualMonthlyOutflow) when `hasActualData`, else declared.
   Ribbon left as-is (already actual).
4. `app/api/safety-net/route.ts` — months-covered + scenario survivability now use
   `actualAvgMonthlyOutflow` from master; route thinned to use the snapshot (removed local reduces).
5. `app/api/cashflow/summary/route.ts` `buildSummaryInput` — `netSurplus`/spend use actual outflow so
   the Gemini narrative stops asserting a false surplus.

### Files Modified
- `lib/calculations/actualCashflow.ts` — NEW pure engine
- `tests/calculations/actualCashflow.test.ts` — NEW (10 tests: transfers, uncategorised, abs, IN/OUT
  split, trailing average, empty input)
- `lib/services/masterFinancialService.ts` — new fetch + helper call + 6 new quickMetrics fields + type
- `lib/calc-audit/engines/decimal-cfo-scenarios.ts` — `makeSnapshot()` literal extended for the new fields
- `app/api/cashflow/intelligence/route.ts`, `app/api/dashboard/insights/route.ts`,
  `app/api/safety-net/route.ts`, `app/api/cashflow/summary/route.ts` — repoints

### Build Status
- [x] `npx tsc --noEmit` clean (0 errors)
- [x] `npx eslint --no-ignore` clean on all touched files (0 errors)
- [x] `npm run build` passes
- [x] `npx vitest run tests/calculations` (108) + `tests/cfo` (259) green

### Documentation Updated
- `docs/architecture/01_ARCHITECTURE_OVERVIEW.md` — noted the actual-transaction fields on the master snapshot
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — workstream entry

### Doc-sync (CLAUDE.md §16)
- [architecture] `docs/architecture/01_ARCHITECTURE_OVERVIEW.md` — master snapshot now exposes actual-transaction cashflow fields alongside declared.

### Phase 2 still needed
- Repoint remaining declared-only surfaces (budget page, debt-freedom runway, health-score savings-rate
  input, CFO scenarios baseline) to the actual fields.
- Surface plan-vs-actual explicitly in the UI (show both, label clearly) rather than swapping silently.
- Consider promoting `essential vs discretionary` onto the actual breakdown (needs category→essential map).
- Add a confidence/coverage signal so a partial-month or low-transaction-coverage user isn't shown an
  understated actual as gospel.

---

## Session: phase2-reports-runway-shk180 (P0 — Reports cashflowRunway on declared spend)

### Bug (audit domain B P0, verified 2026-06-23)
`lib/reports/contextBuilder.ts:224` computed cashflowRunway by dividing liquid assets by `calculateMonthlyExpenses(userId)` — a local `prisma.expense` declared reduce, never reading transactions → overstated runway in the report a user hands an adviser.

### Fix
Use `getMasterFinancialSnapshot().quickMetrics.actualAvgMonthlyOutflow` (all OUT txns incl. loans + uncategorised) when `hasActualData`; fall back to declared `calculateMonthlyExpenses` only when no transactions. (The `999` no-data sentinel is retained — pre-existing; flagged as a separate UX follow-up.)

### Tests: tsc clean; tests/reports 8/8 green.
### Doc-sync (§16): this changelog; audit docs/audit/AUDIT_CASHFLOW_SSOT.md.
## Session: phase2-emergencyfund-actuals-shk180 (P0 — emergency-fund runway on declared spend)

### Bug (audit domain B P0, verified 2026-06-23)
`lib/services/masterFinancialService.ts:1904` computed emergency-fund months-of-cover from `monthlyExpenses.all.total` (DECLARED expenses, excludes loans). When actual spend > declared, runway was overstated (e.g. $20k liquid, $3k declared → "6.7 months"; true at $5k actual = 4.0). Cascades into `healthScore.emergencyFund`. The actual field (`actualCashflow.avgMonthlyOutflow`, in scope at :1857) existed but was unused.

### Fix
Gate on `hasActualData`: use `actualCashflow.avgMonthlyOutflow` (trailing-3-month avg of ALL OUT txns incl. loans + uncategorised) when transactions exist; fall back to declared only when none. Mirrors the Phase 1 + cashflow/summary precedent. `buildEmergencyFundMetrics` math itself was already verified ✅ correct — only the input changed.

### Tests: tsc clean; cfo + calculations 367/367 green (snapshot shape unchanged).
### Doc-sync (§16): this changelog; audit in docs/audit/AUDIT_CASHFLOW_SSOT.md (shipped via #1196).
### Remaining domain-B (queued): Reports cashflowRunway (contextBuilder declared); P1 two monthlyCashflow definitions; declared-only surfaces (financial-health, cashflow lite, intelligence forecast/health, insights); P2 MORTGAGE liability classifier.
## Session: fix-loan-interest-100x-p0-shk180 (P0 — loan interest 100× too low)

### Bug (audit P0, verified 2026-06-23)
`Loan.interestRateAnnual` is a DECIMAL (0.0625 = 6.25% — `prisma/schema.prisma:1624`, `LoanFormDialog` saves `/100`). Three engines divided the already-decimal rate by 100 AGAIN → 100× understated:
- `lib/calculations/loanAggregator.ts` (the canonical SSOT debt engine) float `:95` + Decimal `:234` — `/100/12`. Every consumer of `debtSummary.totalInterest` inherited it. $100k @ 0.06 gave **$5/mo** instead of **$500/mo**.
- `lib/cfo/decisionSupport/loanDecisionSupport.ts:218` — `weightedInterestRate / 100` (already decimal) → CFO loan rate 100× too low.
- `app/api/cashflow/intelligence/route.ts:439` — deductible investment-loan interest `/100` → deduction 100× too low → overstated taxable income + estimated tax.

### Fix
Removed the extra `/100` at all three sites (`/12` and `.div(12)` only; weightedInterestRate used as-is; deductible interest = principal × rate). Fixed the stale Decimal docstring. **Corrected the masking fixtures** `lib/calc-audit/engines/decimal-calculations.ts` (`6.25/6.85` percent → `0.0625/0.0685` decimal) — these fed percent into loanAggregator, coincidentally cancelling the /100 and hiding the bug from the shadow test.

### Not touched (verified correct)
`debtPlanner`, `payDownLoan`, `redirectToOffset`, `refinanceLoan`, `calculatePayoffMonths` — all already use the decimal rate correctly (audit ✅). `loanDecisionSupport:219` `debtToIncomeRatio / 100` is a DIFFERENT field (DTI), out of scope.

### Tests: `tests/calculations/loanInterestRate.test.ts` ($100k @ 0.06 → $500/mo, $6,000/yr, float+Decimal parity). tsc clean; aggregators shadow + calc-audit 200/200; CFO 259/259 green.
### Doc-sync (§16): this changelog. No config/schema/infra change. (AUDIT_DEBT_WHATIF.md on main via #1194.)

### Addendum (fix-loan-interest-100x) — caught a compensating ×100 caller
Self-review surfaced `lib/cfo/decisionSupport/loanDecisionSupport.ts:179` passing `interestRateAnnual * 100` (percent) INTO `aggregateLoanRepayments`. With the OLD aggregator `/100`, the two cancelled (loanDecisionSupport was coincidentally correct). Removing the aggregator `/100` alone would have made loanDecisionSupport's interest + weightedAverageRate **100× too HIGH**. Fixed `:179` to pass the decimal as-is — paired with the `:218` `weightedAverageRate` (no /100) fix. Verified the only OTHER aggregator caller (`masterFinancialService:1826`) already passes the decimal. All other `*100` occurrences are display/onboarding (not fed to the aggregator). tsc clean; 462 tests green (cfo + loan + aggregators + calc-audit).
## Session: fix-tax-bracket-boundary-p0-shk180 (P0 — income tax = $0 at every bracket boundary)

### Bug (audit P0, verified by hand 2026-06-23)
`lib/tax-engine/core/incomeTaxCalculator.ts` looped with `if (taxableIncome <= bracket.min) break;`. Since `tax` is only assigned inside the bracket-match block, an income EXACTLY equal to a bracket minimum broke out with `tax` still 0 → **$0 tax returned at $45,001 / $135,001 / $190,001 / $18,201**. Feeds `/api/tax`, `/api/tax/position`, super optimiser.

### Fix
`<=` → strict `<` (float path) and `.lte` → `.lt` (Decimal sibling). `bracket.min` is the inclusive lower bound (prior max + 1), so income equal to it belongs in that bracket.

### Audit correction (facts over deference)
The audit also claimed `incomeInBracket = taxableIncome − bracket.min + 1` over-taxes and should drop the `+1`. **That is wrong** — the `+1` correctly compensates for `min` being prior-max+1 (e.g. $50,000 → 4288 + (50000−45001+1)×0.30 = $5,788 ✓ ATO). The `+1` was NOT touched. The audit's "$135,001 → $26,888" figure was also wrong; the buggy output was $0 (hand-traced).

### Tests: `tests/tax-engine/incomeTaxBoundary.test.ts` (4 tests — every boundary + interior + monotonicity, ATO FY24-25 values). tsc clean; decimal/calc-audit parity 220/220 green.
### Doc-sync (§16): this changelog. No config/schema/infra change. (Audit doc AUDIT_TAX.md already on main via #1194.)
