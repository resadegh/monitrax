# MATRIX HANDOUT — T2 loan-cost relay capture

**Prepared by:** Code session (Opus 5), 2026-07-31 · **For:** The Matrix (Claude-in-Chrome, Reza's browser)
**Ships in:** PR **#1557**, merged `2627dcdf` · prod deploy `dpl_DNpfhHhDc8tSa9EQ9fVDLQpjvWZN`
**Purpose:** produce the **measured** before/after values that become T2's `expectedMoves` (MON-131 ledger §2 gate **G3**).

> **This is a CAPTURE, not a verification run.** No verdict is asked for and none should be given. Return the payload; the Code session does the analysis. It is one HTTP GET — there is no sweep, no page-reading, and no interaction with the app UI.

---

## §1 Why this exists at all

`expectedMoves` must be **computed on live data, never predicted**. Previews bind to the dev database, so the real before/after values exist only in production. T1 is the cautionary case: a value declared as *rounded-monthly × 12* instead of measured produced a two-cent contract defect that VR-045 §2.1 had to catch and correct.

So the relay runs **both** loan-cost paths against the same live rows and returns them side by side.

---

## §2 The call

```
GET https://<prod-host>/api/admin/matrix/golden-baseline/t2-loan-cost
```

**Authentication:** admin session required (`audit:read`).

**The explicit `?userId=` IS REQUIRED — corrected 2026-07-31 after the first capture.** This handout originally said to omit it and let the route auto-resolve a sole user. That is wrong in this environment: **13 accounts exist**, so the bare call returns `400 MULTIPLE_USERS` and the auto-resolve path is unusable. Call:

```
GET /api/admin/matrix/golden-baseline/t2-loan-cost?userId=91b6d7ce-d9f1-4ac0-96ce-fc958dca2a3c
```

That id was confirmed 9/9 against Reza's own rendered screens in VR-042 (net worth 3,401,782 · taxable 145,426 · deductions 172,325). Still assert §3's precondition on the response before accepting it — a correct-looking id is not proof the payload came back scoped to it.

---

## §3 Non-negotiable safety rules (VR-044 §7, adopted at Reza's direction)

1. **Admin credentials open the relay door — they are NOT the account under test.** The data must be `?userId=`-scoped to Reza's account. A payload captured against the admin user's own (empty) account is void.
2. **Assert identity before accepting the payload.** Reza's account: net worth **$3,401,782** · **6** properties · **5** loans. This relay returns `summary.loanCount` — **it must be 5.** If it is not, stop and report that, not the numbers.
3. **Read-only.** One GET. No writes, no clicks on any action control, no page mutations.
4. **Separate browser profiles.** Signing into `/admin/login` silently overwrites the user session — that is exactly what voided VR-044's first attempt.

---

## §4 What to return

**Return the ENTIRE JSON response, verbatim, in a single fenced ```json block.** Do not summarise it, do not round anything, do not omit fields you think are uninteresting. The payload is the deliverable.

Then, separately, a short human note answering only these:

- Did `summary.loanCount` equal **5**?
- Was there any non-200 status or error body?
- Anything that looks obviously wrong to you (report it as an observation, not a verdict).

---

## §4b Status — this is now a RE-capture

The first capture ran 2026-07-31 at `2627dcdf` and **succeeded**. It is being re-run because **the relay was incomplete**, not because the capture failed: `cashflow.annualCashflow` / `.annualSurplus` move by **$47,551.71** and were missing from the declared paths — an undeclared move that gate G7 stops the tranche on. The repaired relay ships in PR **#1559**; capture against a build that includes it.

Two findings from the first run are already recorded and need no re-verification: **MON-143** (the canonical interest floor does not net the offset — D21) and the confirmation of §2.1's stale-rate diagnosis.

## §5 What I expect to see — stated in advance so a mismatch is informative

These are **falsifiable predictions**, not instructions. If the payload disagrees with any of them, that disagreement is the finding, and it matters more than the numbers themselves. **Do not adjust anything to fit these.**

| Field | Expected | Why |
|---|---|---|
| `summary.oldMonthlyLoanCost` | **≈ 8,816.65** | the current `masterFinancialService` figure, in which both interest-only loans contribute $0 |
| `summary.newMonthlyLoanCost` | **≈ 12,779** | what `/dashboard/expenses` already renders — canonical and Ring-3-verified at VR-041 |
| `summary.deltaMonthly` | **≈ +3,962** | the understatement T2 exists to close (≈ $47,548/yr) |
| `moneyFlowSkip.skippedLoans` | **3 loans** — both interest-only **plus HECS**, totalling **3,792.92** | corrected after the first capture: the skip is keyed on *no declared repayment*, NOT on interest-only, so HECS (`isInterestOnly: false`) is caught too. My original prediction said two and was one short |
| per-loan `effectiveRate.flags` | **`RATE_STALE` on the two Bankwest IO loans** | stored 6.690% vs an implied ≈6.268% (MON-142) |
| per-loan `newBasis` | mostly **`ACTUALS`**; `INTEREST_FLOOR` on the HECS row | HECS has no linked repayments, so it floors to interest |

**If `moneyFlowSkip.skippedLoans` comes back empty**, my reading of line 382 was wrong and several statements I have made about entity money-flow need retracting. That is a genuinely useful outcome — report it plainly.

---

## §6 Error modes and what they mean

| Response | Meaning | Action |
|---|---|---|
| `503` `ADMIN_PORTAL_NOT_ENABLED` | the admin portal feature flag is off in prod | report it; nothing else to try |
| `401` | not signed in as admin, or the session expired | sign in, re-call |
| `403` `INSUFFICIENT_PERMISSIONS` | the admin role lacks `audit:read` | report it |
| `400` `MULTIPLE_USERS` | more than one user exists | pick Reza's from `details`, re-call with `?userId=` |
| `500` | a producer threw | **return the error body verbatim** — a failure here is itself T2 evidence |

---

## §7 What happens with it

The payload's `paths[]` array becomes `.audit/expected-moves-t2.json`, per-path with its arithmetic. That is gate **G3**, and it must be committed **before** the first line of the T2 migration — the migration then collapses `loanCost`'s 31 producer sites onto the one canonical engine, and a Ring-3 run verifies it.

**Nothing in this capture changes a number.** The relay reads both paths; it writes nothing.

---

## §8 Gate (§20.6)

`Gate (§20.6): Document 10/10 (T2 brief §5 · MON-131 ledger §2 G3 · VR-044 §7 · VR-045 §2.1) · Requirements 10/10 · Logic 10/10`

Self-review changed three things. (1) I had written `?userId=91b6d7ce…` as the call, copying the truncated
form from the run docs — I did not hold the full id, and a truncated one would have failed or resolved
elsewhere. I replaced it with "omit it, the route auto-resolves a sole user". **The first capture proved
that wrong too — 13 accounts exist, so the bare call 400s.** §2 now carries the full id, supplied by the
Matrix and provenance-checked to VR-042. Recorded as two successive errors rather than one clean fix,
because the lesson is that I twice guessed at an environment fact instead of measuring it. (2) I had listed §5's figures as things to confirm, which invites confirmation bias in exactly the way VR-045 §2b nearly went wrong when a pre-declared expected answer almost buried a real result; they are now stated as falsifiable predictions with "do not adjust anything to fit these." (3) I had no identity check, because a relay feels safe — but VR-044's first attempt was voided by precisely this, so `loanCount === 5` is now a hard precondition.

**Coverage, stated precisely:** this handout produces the measured inputs for T2's contract. It verifies nothing, and it is not a Ring-3 run — no rendered surface is read and no correctness claim follows from it.
