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
