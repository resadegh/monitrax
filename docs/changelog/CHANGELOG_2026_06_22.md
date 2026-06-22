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
