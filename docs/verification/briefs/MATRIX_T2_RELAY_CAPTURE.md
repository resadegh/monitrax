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

**Authentication:** admin session required (`audit:read`). **Omit `?userId=`** — the route resolves the sole user automatically.

**If it returns `MULTIPLE_USERS`,** the response body lists candidates. Pick the one that is **Reza's account** and re-call as `?userId=<id>`. Do not guess: confirm against a known figure (§3) before accepting any payload as his.

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

## §5 What I expect to see — stated in advance so a mismatch is informative

These are **falsifiable predictions**, not instructions. If the payload disagrees with any of them, that disagreement is the finding, and it matters more than the numbers themselves. **Do not adjust anything to fit these.**

| Field | Expected | Why |
|---|---|---|
| `summary.oldMonthlyLoanCost` | **≈ 8,816.65** | the current `masterFinancialService` figure, in which both interest-only loans contribute $0 |
| `summary.newMonthlyLoanCost` | **≈ 12,779** | what `/dashboard/expenses` already renders — canonical and Ring-3-verified at VR-041 |
| `summary.deltaMonthly` | **≈ +3,962** | the understatement T2 exists to close (≈ $47,548/yr) |
| `moneyFlowSkip.skippedLoans` | **the 2 interest-only loans** (Broadbeach, Thornland Lot 2) | `moneyFlowService.ts:382` is `if (!loan.minRepayment \|\| <= 0) continue` — I read that in source but have never seen it execute |
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

Self-review changed three things. (1) I had written `?userId=91b6d7ce…` as the call, copying the truncated form from the run docs — I do not have the full id, and pasting a truncated one would have failed or, worse, silently resolved elsewhere. The route auto-resolves a sole user, so the handout now omits it and handles `MULTIPLE_USERS` explicitly. (2) I had listed §5's figures as things to confirm, which invites confirmation bias in exactly the way VR-045 §2b nearly went wrong when a pre-declared expected answer almost buried a real result; they are now stated as falsifiable predictions with "do not adjust anything to fit these." (3) I had no identity check, because a relay feels safe — but VR-044's first attempt was voided by precisely this, so `loanCount === 5` is now a hard precondition.

**Coverage, stated precisely:** this handout produces the measured inputs for T2's contract. It verifies nothing, and it is not a Ring-3 run — no rendered surface is read and no correctness claim follows from it.
