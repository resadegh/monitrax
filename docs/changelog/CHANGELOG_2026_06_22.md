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
