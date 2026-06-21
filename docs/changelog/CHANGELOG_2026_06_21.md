# Changelog - 2026-06-21

## Session: loan-ledger-tracking-shk180

### Changes Made
- **Type**: Research + planning (Phase 51 scoping). No code/schema changes yet — design phase.
- **Scope**: new workstream **0·LOAN** — loan ledger, repayment matching, low-effort categorisation.
- **Why**: Reza raised two linked problems — (1) multiple loans all repaid from one offset
  account with the same payee name → impossible to track which repayment feeds which loan, and
  marking them all as "loan repayment" corrupts per-property expense + tax numbers; (2)
  transaction categorisation + relationships are "the most overwhelming and confusing task."
  Reza chose **scope = include loan-statement import now** (exact interest, because offset
  accounts make a `rate × balance` estimate wrong), and asked for **deep research + a
  professional recommendation**.

### What was done
- **Deep-research pass** — 5 parallel cited research streams: low-effort categorisation UX,
  transfer detection/exclusion, loan/liability modelling + variable-IO matching, AU-tax interest
  deductibility (ATO-grounded), CDR/Basiq loan+transaction data model. Plus a **codebase audit**
  of the current `Loan` / `UnifiedTransaction` / categorisation / import / tax model.
- **Recommendation captured** as a Phase doc — loan = liability account with its own quarantined
  ledger; actual-vs-actual transfer-matching with a confirm-queue; interest taken from the loan's
  own interest line; CDR-forward store (QIF now → Basiq later, same store/engine); plus a
  review-exceptions-only categorisation overhaul.

### Key research findings (cited in the Phase doc; full source lists below)
- **Categorisation:** auto-categorise-by-default + review-only-exceptions; "apply to past+future"
  on first correction is the highest-leverage affordance; **no AU app maps categories to ATO
  labels** (differentiator); auto-categorise achievable without ML via Basiq-supplied categories.
- **Transfer detection:** PocketSmith reference algo (amount + opposite direction + small date
  window + tie-breaker; leave-unmatched-if-ambiguous; "Awaiting confirmation" queue). Loan split:
  principal = transfer-to-liability (excluded), interest = expense (counted).
- **Loan modelling:** for IO/variable/offset loans, match the **actual** loan-account transaction,
  never a predicted fixed amount (YNAB: a loan account can't model an offset; Xero: fixed split
  breaks when interest varies). Rate changes have no first-class schedule anywhere → actual
  interest sidesteps it.
- **AU tax (ATO):** interest deductible / principal not (must split); **offset ≠ redraw** (private
  redraw permanently taints to mixed-purpose, TR 2000/2); actual charged interest is authoritative
  (offset breaks `rate × balance`); mixed-purpose = deductible fraction, proportionate repayment.
- **CDR/Basiq:** loan interest/repayments arrive as `loan-interest`/`loan-repayment` transactions;
  `BankingLoanAccount` carries repaymentType/offsetAccountIds; design store on `sourceSystem` +
  `sourceId` + content-hash so Basiq upgrades QIF rows in place; one-loan-per-account CDS limit.

### Files Added / Modified
- `docs/blueprint/PHASE_51_LOAN_LEDGER_AND_CATEGORISATION.md` (NEW) — research + recommendation +
  phased plan + locked decisions + risks + Stitch surfaces.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — new **0·LOAN** workstream (design phase).
- `docs/IMPLEMENTATION_PLAN.md` — hub Last updated.

### Build Status
- N/A — docs-only PR. No code, schema, or migration changes.

### Doc-sync (CLAUDE.md §16)
Surfaces changed:
- [x] strategic decision (scope chosen; new workstream registered) → `01_ACTIVE_WORKSTREAMS.md`,
      `PHASE_51_*.md`, hub
- [ ] visual / config / infra / identity / deploy / security / operational — none (planning only)

### Stitch / §18.2.1
- No UI shipped. Phase 51.1 surfaces (loan import dialog · Repayments tab · confirm queue) are
  flagged Stitch-first; designs are the next step before any React.

### Next steps
- Generate Phase 51.1 Stitch designs (seed §18.7.2 vocabulary; light+dark × desktop+mobile).
- Confirm the two-records transfer model (§7) and the first categorisation lever to sequence.

### Update — designs approved + shipped (Reza: "looks good, ship it and document all of this")
- **Decision (Reza, 2026-06-21):** fold the statement upload into **existing** surfaces — no
  standalone import dialog (§12.1 / §18.2.1). Ledger import lives inline in a new loan-detail
  **Repayments tab**; the create page keeps its "attach to auto-fill" drop zone (extended
  post-create to offer ledger import).
- **Stitch designs (project `1859462351962811110`), approved:**
  - Repayments tab — screen `309e4b0c5df54b38936fb07af5ed140b` (dark) — inline import + summary
    strip (Interest this FY w/ Deductible chip, Principal paid, Current balance) + ledger
    (Date/Amount/Interest/Principal/Status; Linked vs Confirm pills; IO row = full interest, $0
    principal) + "actual statement interest = accountant's figure" footer.
  - Import affordance — screen `f160bad2d6ab4479910341150060eb8d` (light) — drop-zone panel,
    reused inside the Repayments tab.
  - Artefacts committed under `.stitch/designs/phase51/`.
- **Still owed before build:** confirmation-queue design + create-page handoff + full
  light/dark × desktop/mobile variant matrix. Build-time: use canonical navy dark tokens
  (`#050913`), not Stitch's green-tinted default.
- **PR #1166** marked ready + merged (research + plan + approved core designs). Build (Phase
  51.1 code) is the next step.

### Research source lists (deep-research pass)
- Categorisation: Monarch / Copilot / PocketSmith / YNAB / Frollo / WeMoney / Pocketbook / Up help docs.
- Transfers: PocketSmith Transfer-marking + mortgage-as-transfer; Monarch/Copilot/YNAB/Frollo/WeMoney.
- Loan modelling: PocketSmith Learn Center; YNAB loan/offset docs; Xero Central; ASIC Moneysmart (offset vs redraw).
- AU tax: ATO "Interest expenses" / "Apportioning rental interest" / "How to claim rental expenses"; TR 2000/2.
- CDR/Basiq: Basiq v2.1 reference + CDR policy; Consumer Data Standards AU (BankingLoanAccount, scopes).
