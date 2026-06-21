# Phase 51 — Loan Ledger, Repayment Matching & Low-Effort Categorisation

> **Origin (Reza, 2026-06-21):** *"I have multiple loans and all repayments go from
> my main offset account with the same name, so it's hard to track them… if I mark
> them all as loan repayment the property expense and tax calculations won't be
> perfect… categorisation should be performed from the transactional accounts only;
> the loan accounts' transactions should be linkable from a transactional account."*
> Plus: *"the transactional categorisation and its relationships is the most
> overwhelming and confusing task for me or users."*
>
> Reza decision (2026-06-21): **scope = "include loan-statement import now"** (exact
> interest from the statement, because offset accounts make a `rate × balance`
> estimate wrong). This phase was scoped from a deep-research pass (5 cited research
> streams + a codebase audit) — see §3.
>
> TRAIL stage: **Track** (My Accounts) + **Reduce** (My Budget / Tax).

This phase builds on existing engines — it does **not** reinvent them: `UnifiedTransaction`
(already has `isTransfer` / `transferToAccountId` / `source` / `normalisedDescriptionHash` /
`loanId`), the TIE categorisation engine + `MerchantMapping` learning, the `Loan` model
(`isInterestOnly` / `offsetAccountId` / `propertyId`), and the Basiq/CDR scaffolding.

---

## 1. The problem (four-lens framing)

- **Architect:** all loans are repaid from one offset account with an identical payee
  name. There is no loan-side ledger to match against, and interest is *estimated*
  (`rate × balance`), so there is nothing authoritative to attribute to tax.
- **Financial adviser:** marking the whole repayment as an expense is wrong — principal
  is not deductible and the loan balance already reflects it (double-count + overstated
  deduction). The deductible figure is the **actual interest charged**, which an offset
  makes impossible to estimate.
- **Behaviour psychologist:** categorisation is overwhelming because the app makes the
  user decide on every transaction and hand-build relationships. The cure is to make the
  user **review exceptions only**.
- **Designer:** the transaction surface must stay calm — loan mechanics belong on the
  loan, not bolted onto the transaction list.

## 2. Bottom line (the recommended best option)

**Model each loan as a liability account that carries its own transaction ledger
(interest-charged + repayment-received), quarantined from categorisation — and bridge it
to spending via an "actual-vs-actual" transfer-matching engine with a confirm-queue,
taking the deductible interest straight from the loan's own interest line.** Import that
ledger via QIF/CSV now; the *identical* store + engine light up when CDR/Basiq switches on
(only the ingestion source changes). Pair it with a "review-exceptions-only" categorisation
inbox. This is the PocketSmith + Xero correctness model, CDR-native, and it fixes both pain
points without making the transaction surface heavier.

## 3. Research evidence (deep-research pass, 2026-06-21)

Five parallel research streams (cited; full source lists in the session changelog). Key findings:

**3.1 Categorisation UX** — Every modern app auto-categorises by default and has the user
**review only exceptions** (Copilot "To Review = 0"; YNAB approve step). The single
highest-leverage affordance in the market is the **"apply to all past + future?"** prompt on
the first correction (Monarch/Copilot, with a backfill checkbox). Copilot gates on confidence
("not confident → don't apply"; surfaces top-2 guesses). **No AU app maps categories to ATO
labels** (Monarch does it US-only → clear differentiator). PocketSmith proves auto-categorise
works **without ML** by leaning on provider-supplied categories (Basiq supplies these).

**3.2 Transfer detection** — PocketSmith is the gold-standard reference: match by **amount +
opposite direction + small date window (~1 day example) + merchant/account tie-breaker**, and
**leave unmarked when ambiguous** rather than guess, surfaced in an **"Awaiting confirmation"**
queue. Loan repayment treatment (PocketSmith, documented): **principal = transfer to the
liability (excluded from spend), interest = expense (counted)** — prevents double-counting.
Anti-double-count has two models: YNAB single-record-across-two-accounts vs everyone-else
two-records-both-flagged-and-excluded.

**3.3 Loan modelling + variable-IO matching** — Premium model = liability account with its own
ledger when a feed exists (PocketSmith feed path; Xero chart-of-accounts). **For IO / variable /
offset loans, match the ACTUAL loan-account transaction — never a predicted fixed amount**: Xero
users hit the "fixed split is wrong when interest varies" wall; YNAB's own docs state a loan
account computes interest as `balance × rate ÷ 12` and therefore **cannot model an offset**.
Rate changes have **no first-class schedule anywhere** — taking the actual interest charge
sidesteps the problem entirely. PocketSmith's ASB pre-split is the exact reference for "the loan
ledger shows interest separately."

**3.4 AU tax (ATO-grounded)** — Interest on an investment loan is deductible; **principal is
not** (must split). **Offset ≠ redraw:** spending from an offset never changes deductibility
(interest just rises, all deductible); a private **redraw** is a *new borrowing* that permanently
taints the loan into **mixed-purpose** (TR 2000/2) and isn't undone by later repayment. **Actual
charged interest is authoritative** — offset interest is computed on the daily *net* balance, so
`rate × balance` structurally overstates the deduction. Mixed-purpose = a deductible **fraction**
(not a boolean); repayments hit both portions proportionately (TR 2000/2 monthly method).
Interest-only = same principles, whole repayment is interest. Negative gearing offsets other
income at the marginal rate; projections must respect the **§12.14 reform regime-gate**.

**3.5 CDR/Basiq** — A loan is an account whose interest/repayments arrive as transactions classed
**`loan-interest` / `loan-repayment`**; `BankingLoanAccount` carries `repaymentType`,
`repaymentFrequency`, `offsetAccountIds[]`, rates. Posted transaction IDs are stable; pending IDs
churn (treat as ephemeral). Design: a source-agnostic store keyed on `sourceSystem` + `sourceId`
(stable posted ID) + **content hash** — a Basiq row **upgrades the matching QIF row in place**
instead of duplicating. Min scopes: `bank:accounts.basic` + `accounts.detail` + `transactions`
(+ `regular_payments`). **CDS allows only one loan per account** → don't hard-assume 1 account =
1 loan (split-loan case).

## 4. Codebase reality (audit, 2026-06-21)

| Area | Today | Gap |
|---|---|---|
| `UnifiedTransaction` | has `isTransfer`, `transferToAccountId`, `source` (incl QIF/CSV/BASIQ), `normalisedDescriptionHash`, `loanId`/`propertyId` FKs, `basiqTransactionId` | no `class` (loan-interest/loan-repayment); no automated **transfer-pair** matching; transfer is a flag, not a confirmed pair |
| `Loan` | `isInterestOnly`, `interestRateAnnual`, `minRepayment`, `repaymentFrequency`, `offsetAccountId`, `propertyId`, `RateType`, `fixedExpiry` | no own transaction ledger; no `deductibleFraction`; interest is estimated `rate × balance` in `LoanDetailDialog` |
| Import | QIF/CSV/OFX into TRANSACTIONAL/SAVINGS/OFFSET/CREDIT_CARD/CASH accounts | **no import INTO a loan account** |
| Categorisation | rules-first TIE (90 rules) + learn-on-correction `MerchantMapping`; QIF `L`-field mapped (provider-category pattern) | no review-exceptions **inbox**; no confidence gate; no "apply to past+future" prompt; no ATO-label mapping surfaced |
| Loan UI | `LoanDetailDialog`: Overview / Property / Offset / Expenses / Strategy / Linked | no **Repayments** tab |
| Tax | negative-gearing engine per entity; interest deductibility | no per-property **actual-interest** attribution (done via manual Expense links); no offset/redraw apportionment |
| CDR/Basiq | consent + sync scaffolding | loan ingestion not wired |

## 5. Recommended architecture

**5.1 Data model — one source-agnostic store, loans included.**
- A loan **Account** record per loan so its ledger lives in `UnifiedTransaction` (`accountId =
  loan`, new `class ∈ {loan-interest, loan-repayment, …}`), **flagged out of categorisation +
  the spending view**.
- Add `sourceSystem` + `sourceId` alongside the existing content hash → a future Basiq row
  upgrades the QIF row in place. Pending transactions treated as ephemeral.
- On `Loan`: add `deductibleFraction` (not a boolean) for later mixed-purpose state.
- **Do not assume 1 account = 1 loan** (CDS split-loan limit).

**5.2 Matching engine — actual-vs-actual, never predicted.**
Detect offset outflow ↔ loan repayment-received by **amount + opposite direction + small date
window (±N days) + payee/account tie-breaker**; **leave unmatched when ambiguous**. Surface in an
**"Awaiting confirmation"** queue. On confirm: mark the transfer (paired), pull the **interest
straight from the loan's interest-charged transaction**, record interest as a deductible expense
on the linked property, principal as a transfer (excluded from spend). Robust to variable IO,
days-in-month, and rate changes *by construction*.

**5.3 Interest/principal split + tax.** Interest from the loan line (never re-derived). IO →
whole repayment = interest. Offset = separate account (already `offsetAccountId`), never netted
into the loan balance. **Redraw = a purpose-classification event** that can taint the loan to
mixed-purpose — v1 **flags** it for review (no silent auto-apportionment). Never present an
estimate as a tax figure (false precision).

**5.4 Categorisation overhaul — "do 500" → "confirm 8."** Auto-categorise on import (reuse TIE +
Basiq categories; no ML needed to start) → **confidence gate** (don't apply low-confidence;
surface top-2) → small **review inbox with a finish line** → on correction, **"apply to past +
future"** rule (reuse `MerchantMapping` + the Phase 50 D.6 Smart-Inbox/bulk-approve pattern). Map
each category to an **ATO label behind the scenes**.

## 6. Phasing (each new surface is Stitch-first per §18.2.1)

- **Phase 51.1 — manual QIF (now):** loan-scoped import on the loan dialog → loan ledger
  (quarantined) · actual-vs-actual matching + confirm queue · loan **Repayments** tab (matched
  repayments, interest/principal, running balance) · use actual interest for tax, label estimates.
- **Phase 51.2 — categorisation overhaul:** review-exceptions inbox · "apply to past+future" rules
  · confidence gate · ATO-label mapping · generalised transfer detection (CC payments,
  inter-account).
- **Phase 51.3 — CDR/Basiq:** swap ingestion source only (same store, same engine). Loan txns
  auto-arrive; `offsetAccountIds` drives auto-linking; TR 2000/2 mixed-purpose apportionment as the
  accuracy capstone.

## 7. Locked decisions & open questions

- **DECIDED (2026-06-21):** scope includes loan-statement import now (Reza).
- **RECOMMENDED (confirm):** two-records-both-flagged transfer model (linked by a pair ID) over
  YNAB single-record — matches existing `isTransfer`/`transferToAccountId` + survives independent
  CDR feeds.
- **OPEN:** TR 2000/2 exact apportionment formula needs tax-professional sign-off before it drives
  a displayed number (Phase 51.3).
- **OPEN:** which categorisation pain to sequence first (auto-categorise-by-default vs
  transfer/relationship confusion).

## 8. Risks
- Tainting tax numbers via offset/redraw confusion → §5.3 keeps them distinct; redraw is a flagged
  event, not auto-computed.
- False precision → never show estimated interest as a tax figure.
- §12.14 reform gate → negative-gearing projections stay regime-aware.
- Split loans → schema must not assume 1 account = 1 loan.

## 9. Stitch surfaces to design (Phase 51.1)
1. **Loan-scoped import dialog** (on `LoanDetailDialog`) — import this loan's statement (QIF/CSV).
2. **Repayments tab** — matched repayments, interest/principal split, running balance.
3. **"Awaiting confirmation" review queue** — suggested offset↔loan matches, one-tap confirm/bulk.

All seed the §18.7.2 in-app glass vocabulary; light + dark × desktop + mobile per §18.7.2.
