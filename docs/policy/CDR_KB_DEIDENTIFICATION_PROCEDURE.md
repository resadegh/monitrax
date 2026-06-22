# CDR / KB De-identification Procedure — Shared Categorisation Knowledge Base (Phase 52)

> **Purpose.** This is the written de-identification procedure that must be **reviewed and signed
> off** before the shared categorisation knowledge base (Phase 52) is enabled (CLAUDE.md §13;
> the Phase 52 build gate). It documents exactly what enters the shared store, how it is
> de-identified, and why the residual re-identification risk is low.
>
> Canonical design: `docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md`.
> Disclosure to users: Privacy Policy §4.1 + §6.2; CDR consent notice.

## 1. What the shared knowledge base stores

The shared table (`transaction_signatures`) is **aggregate-only**. Per row:

| Stored | Example | Identifying? |
|---|---|---|
| `pattern` — normalised merchant signature | `WOOLWORTHS` | No (a merchant name) |
| `categoryVotes` — aggregate tally | `{ "Food & Dining>Groceries": 412 }` | No |
| `distinctUserCount` | `412` | No |
| `topCategory` / `confidence` / `isGlobal` | `…` / `0.97` / `true` | No |
| `mcc` | `5411` | No |
| `amountHint{Min,Med,Max}` — coarse range | `12 / 80 / 240` | No (coarse, aggregate) |

**Explicitly NOT stored in the shared table:** `userId`, account identifiers, BSBs, transaction
amounts tied to a user, transaction dates, balances, raw descriptions, or anything that can identify
a consumer or an account. The shared table has **no `userId` column** by construction.

The **private** ledger (`signature_contributions`) holds `(signatureId, userId, category)` — a user's
own vote, never exposed cross-user, deleted on account reset (`RESET_DELETE_MODELS`).

## 2. The de-identification mechanism

Implemented in `lib/categorisation/kb/scrubSignature.ts` (`scrubToSignature`), applied **before**
any contribution is formed:

1. **REJECT** descriptions that are transfers / non-merchant / person-bearing — `transfer`, `tfr`,
   `PayID`, `Osko`, `NPP`, `to/from acct`, `ATM`, `cash out`, `withdrawal`. These are where names and
   account numbers appear; they never form a signature.
2. **STRIP** identifiers before normalising — BSBs (`NNN-NNN`), card masks (`xxxx1234`), dates,
   reference tails, long digit runs (account/ref numbers), and payment-method noise
   (`eftpos`/`visa`/`pos`/`direct debit`).
3. **NORMALISE** to a canonical uppercase merchant signature (`normaliseDescription`).
4. **REJECT** if no stable alphabetic merchant token (≥3 letters) remains.

Tested: `tests/categorisation/scrubSignature.test.ts` (11 cases — accepts merchants, rejects
transfers/PII/numbers-only).

## 3. k-anonymity graduation (second layer)

A pattern is **private/provisional** until **≥ k = 5 distinct users** have independently confirmed it
(`distinctUserCount >= KB_GRADUATION_K`). Only then does it graduate (`isGlobal = true`) and become a
shared prior. A pattern seen by fewer than k users is **never** used cross-user — so any residual
identifying string that escaped §2 cannot reach other users, and is pruned by housekeeping if stale.

## 4. Re-identification risk assessment

- The unit of knowledge is a **merchant → category** mapping with aggregate counts — not transactions.
- No amounts (beyond a coarse aggregate range), dates, account ids, or user ids are stored in the
  shared table.
- A merchant signature is shared only after ≥5 users confirm it (k-anonymity), so it cannot encode an
  individual.
- **Residual risk: low.** The realistic worst case is an unusual merchant string that survived §2 and
  reached k users with the same category — which is, by definition, a genuine shared merchant pattern,
  not personal data.

## 5. Reversibility & retention

- **Account reset / deletion** removes the user's `signature_contributions`; the shared aggregate
  self-heals on the next recompute (the user's vote is no longer counted).
- **Housekeeping** (`runKbHousekeeping`, weekly) prunes stale sub-k provisionals.
- The shared aggregates contain no CDR data, so they fall outside CDR deletion-on-consent-withdrawal
  (the consumer's CDR data and private votes are deleted; the de-identified aggregate is not CDR data).

## 6. Disclosure

Disclosed to users in: Privacy Policy §4.1 (+ §6.2 for CDR-derived patterns), the CDR consent notice,
`CDR_DATA_MINIMISATION.md`, and the CDR compliance matrix.

## 7. Sign-off (required before enablement)

| Step | Owner | Status / Date |
|---|---|---|
| Procedure reviewed | Reza (+ compliance adviser if engaged) | ☐ pending |
| Privacy Policy + consent-notice PDFs regenerated from updated `.md` and served | Reza | ☐ pending |
| `KB_WRITE_ENABLED=true` set (Vercel Production) | Reza | ☐ pending |
| Housekeeping Cloud Scheduler job created | Reza | ☐ pending |
| `KB_READ_ENABLED=true` set (after patterns graduate) | Reza | ☐ pending |

Until row 1 is signed off, `KB_WRITE_ENABLED` and `KB_READ_ENABLED` remain **false** (the code default).
