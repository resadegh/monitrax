# ADMIN-RELAY HANDOUT — close VR-047's §2, and capture T2-B

**Prepared by:** Code session (Opus 5), 2026-08-03 · **Kind:** `capture` (measurements, not a verdict)
**Why it exists:** VR-047 ran the account-first half of the T2 Ring-3 and passed everything it could
reach, but `§2`, `§2b` and the build precondition all need the admin relay — and the account-first law
forbids opening admin in the same browser profile. This handout is the admin half.

> ## ⚠️ PART B IS PARKED — run PART A only
>
> **Reza's decision, 2026-08-03 (Lever 2 of `docs/strategy/MON-131_SCOPE_FILTER.md`): strip the
> Money-Flow Sankey widget from `/dashboard/activity` and keep only its intake path.** That removes
> `moneyFlowService`'s loan leg from the v1 surface, and with it the reason to capture, declare and
> migrate T2-B.
>
> **PART A still runs, and is unaffected by that decision.** It verifies `masterFinancialService`,
> which feeds the property pages — kept scope under every lever. It is what moves MON-130 and MON-143
> to `VERIFIED`.
>
> PART B is kept below rather than deleted: the T2-B scaffold is merged and inert, so if the widget is
> ever un-hidden the capture is one request away. **Do not run it today.**

---

## §0 The second Chrome profile — set this up once

The rule this exists to satisfy is VR-044 §7 rule 4: *the admin login silently overwrites the user
session*. Signing into `/admin/login` in the profile that holds Reza's user session is what voided
VR-044's first attempt **and** VR-046's first attempt. A separate profile is not a nicety; it is the
control that stops a run reading admin's own empty account and reporting it as Reza's.

1. Chrome → profile avatar (top-right) → **Add** → **Continue without an account** → name it
   **`Monitrax Admin`**. Pick a distinct colour; the whole point is telling the two windows apart.
2. In that new window **only**, sign in at `/admin/login`.
3. Leave Reza's normal profile signed into the app as the user. **Never sign admin into it.**
4. Keep both windows open side by side. Everything below runs in the **admin** window.

**The identity rule still binds inside the admin window.** Admin credentials open the door; they are
never the account under test. Every URL below carries `?userId=91b6d7ce-d9f1-4ac0-96ce-fc958dca2a3c`,
and a response whose echoed `userId` differs, or whose `summary.loanCount` is not **5**, is **void** —
report it as void, never as numbers.

---

## PART A — finish VR-047

### A1. The build precondition (STOP IF FAIL)

> **HOW to call a relay — this line is load-bearing.** Run it as a **page-context fetch from an
> already-authenticated admin tab**:
> ```js
> await fetch('<url>', { credentials: 'include' }).then(r => r.json())
> ```
> **Do NOT navigate to the URL in the address bar.** Admin auth is Bearer/GCP, not cookie-based, so a
> navigation arrives unauthenticated and returns `SESSION_INVALID`. Every one of the 39 relay calls
> that has ever succeeded used the page-context fetch; not one used navigation. VR-047B's first
> attempt navigated, read the failure as an app defect, and nearly shipped an auth change to fix
> something that was not broken. (`lib/admin/auth.ts:501` reads an `admin_session` cookie that
> nothing writes — MON-155 — which is what made the wrong story plausible.)

```
GET /api/admin/matrix/golden-baseline/t2-loan-cost?userId=91b6d7ce-d9f1-4ac0-96ce-fc958dca2a3c
```

Two things to read before anything else:

- **`sha`** — must be `1e2317b` (the PR #1575 merge) or a later commit on `main` that contains it.
- **`moveCount` / `paths`** — must be **empty** for the `cashflow.*` and `debt.*` blocks.

Zero moves is **the migration having landed**, not the relay going quiet: before the migration this
route compared the old producer against the new one and reported 15 moves; now master *is* the new
producer, so it compares the canonical path against itself. **Any remaining move means a producer has
drifted back off the canonical resolver** — stop and report it.

### A2. §2 — the 15 declared paths, and the identity that matters most

The same response carries the producer values. Report the observed value for **every** row of the
handout's §2 table (`docs/verification/briefs/RING3_T2_LOAN_COST.md`), including the ones that match.

**The single most important check in PART A** is the four-expression identity, because it is the one
thing VR-047 could not reach and a correct-looking tile cannot establish:

> `cashflow.monthlyLoanRepayments`, `debt.metrics.monthlyRepayments`, `debt.summary.totalRepayments`
> and `quickMetrics.monthlyLoanRepayments` must **all** read **12,779.29**.

They are built by four different expressions inside one service. Before T2 they agreed only because
they all read the same wrong thing. **A divergence between them now is a defect, not rounding.**

Two exactness traps, both already paid for once: `annualLoanRepayments` is **153,351.51** (not
…48 — the engine multiplies the *unrounded* monthly), and `annualCashflow` is **133,020.78** (not
.79 — deriving from annual components rounds the other way).

### A3. §2b — observe the `byType` split, do not judge it

Report every key, its repayments figure, and the total. **PASS is: keys unchanged and the total is
12,779.29.** The per-type split was deliberately not predicted — the committed capture carries each
loan's name, principal and basis but not its `type`, and inventing five numbers to check against
would have been worse than declaring the bound honestly.

---

## PART B — capture T2-B

```
GET /api/admin/matrix/golden-baseline/t2b-money-flow?userId=91b6d7ce-d9f1-4ac0-96ce-fc958dca2a3c
```

**Return the response VERBATIM.** This one is a capture, not a verdict: the payload *is* the
deliverable and it becomes `.audit/expected-moves-t2b.json`. Do not summarise it, do not round it, do
not omit rows that look uninteresting — the five paths T2 nearly missed all looked uninteresting.

### What it measures

Both arms run the **real** `getMoneyFlow` against the same live data — once on the declared basis
(today's behaviour), once on the canonical one — and every numeric leaf is diffed. Nothing is
enumerated by name. That method exists because T2's hand-written list missed five paths across three
rounds, and the Matrix's own diagnosis was that adding two names fixed two names and did not fix the
method.

### Read these three fields carefully — they are where a wrong declaration would come from

1. **`summary.skippedByOldBasis`** should be **3** and `monthlyUnderstatement` **3792.92**. If it is
   2, the run has hit the same off-by-one the first T2 capture did: the skip keys on *no declared
   repayment*, not on interest-only, so **HECS is caught too**.
2. **`summary.newOutflowEqualsIncome`** — report it whichever way it lands, and do not treat
   `totalOutflow === totalIncome` as an invariant that must hold. Surplus is floored at zero
   (`max(0, income − … − loans − …)`), so raising the loan leg does **not** simply move
   `Loan repayments` by the delta: an entity already at zero surplus absorbs nothing, one above zero
   absorbs part. Whether the identity survives is a property of Reza's data.
3. **`moves[]`** — the per-entity paths. These are what the contract will be written from, so a
   truncated list becomes a missing declaration and a stopped tranche at G7.

### What PART B is NOT

Not a verdict. It asks for no PASS/FAIL, checks nothing against a prediction, and **changes nothing** —
the route reads both paths and the default basis is untouched. There is no user-visible effect to look
for, and if you find one, that is itself the finding.

---

## §6 Return format (§3.0c)

> **Return one fenced ```json block conforming to `matrix-result/v1`, then your human note.**
> The JSON is what Code consumes; the note is what Reza reads. Never only the note.

Two results, because they are two kinds:

- **PART A** → `kind: "ring3"`, `runId: "VR-047B"`, with a `checks[]` entry per §2 row and per §2b
  key. If A1 fails, `verdict: "FAIL"` and stop — do not run PART B.
- **PART B** → `kind: "capture"`, `verdict: "CAPTURE_ONLY"`, `payload` = **the verbatim response**.

Validate both with `npm run matrix:check -- <file.json>` before acting on them. Exit 0 means
well-formed and self-consistent, **not** that it passed — read `verdict`. A FAIL is a valid result.

**If PART A passes in full,** MON-130 and MON-143 can finally move `FIXING → VERIFIED`, citing VR-047
(the rendered half) and VR-047B (the producer half) together. Neither half is sufficient alone, and
that is the point of running both.

**`sectionsNotRun[]` is required** (added after VR-047, which returned PASS while its own findings said
the deciding section had never run). For a PART-A-only session that is `["PART B — parked by Reza's
Lever 2 decision"]`, and the verdict is `PARTIAL`, not `PASS` — an honest partial is a first-class
result; what the validator now refuses is a partial wearing PASS.

---

## §7 Gate (§20.6)

`Gate (§20.6): Document 10/10 (MON-131_COMPLETION_BRIEF §3.0b/§3.0c · VR-047 · RING3_T2_LOAN_COST §2/§2b · VERIFICATION_PLAYBOOK §3.2) · Requirements 10/10 · Logic 10/10`

Self-review changed two things. (1) The first draft ordered the T2-B capture first, since it is the
new work — wrong order: if the build precondition fails, every T2-B measurement is taken against a
build that has since been replaced, which is exactly what invalidated the second T2 capture. PART A
now gates PART B explicitly. (2) It initially told the run to check that `totalOutflow === totalIncome`
still holds; that is an invariant of the *old* tree which the surplus floor may legitimately break, so
asking for it as a check would have manufactured a failure. It is now a field to **report**.

**Coverage boundary.** This handout completes the producer half of the T2 Ring-3 and captures the
inputs for T2-B's declaration. It verifies **no** rendered surface (VR-047 did that), does **not**
declare T2-B's `expectedMoves` (that is written from PART B's payload, before any T2-B migration
code), and touches **none** of the loan-cost producers outside `masterFinancialService` and
`moneyFlowService`.
