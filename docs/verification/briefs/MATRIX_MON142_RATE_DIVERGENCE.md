# MATRIX HANDOUT — MON-142 rate divergence, and five schema reads

**Prepared by:** Code session (Opus 5), 2026-08-03 · **For:** The Matrix (Claude-in-Chrome, Reza's browser)
**Kind:** `ring3` — reads rendered surfaces + live data, returns a verdict.
**Contract:** §3.0b (handout) + §3.0c (`matrix-result/v1` return) of `docs/implementation/MON-131_COMPLETION_BRIEF.md`.

---

## §1 Why this exists — and why it is NOT a question for Reza

Monitrax stores **6.690%** on both Bankwest interest-only loans. The repayments already in the app imply
about **6.2697%**. Code's first instinct was to ask Reza to check with his bank. **That was wrong**, and
Reza corrected it (2026-08-03):

> *"Why are the data and Monitrax stored numbers different? That's a red flag. Ask the Matrix to confirm
> and verify. You always have to work based on the data provided in the app."*

He is right, and the SSOT shape makes it precise:

- The **stored rate is a FACT** — asserted by a user or a document. One home, never derived.
- The **implied rate is DERIVED** — one engine, `lib/calculations/effectiveLoanRate.ts`, from the
  repayment transactions already in the app.
- When they diverge, the app's job is to **surface the divergence**, never to silently prefer one.
  Overwriting the fact with the derivation would destroy the evidence that they disagreed.
- **The divergence is a data-integrity finding Monitrax should raise by itself.** It does not today.
  That is exactly what MON-142 is.

This run confirms the divergence is real and consistent **from the app's own data**, before any engine is
wired to a surface.

**§2 carries five schema reads as well** — the facts that T4–T7 need. The schema audit (brief §5.2) found
homes for all five; what is unknown is whether they are **populated** on Reza's account. That is a read,
not a question.

---

## §2 What to do

**Build precondition:** any production build from **`affa74f3`** (2026-08-02) or later. Nothing in this
run depends on a recent change — but record the SHA you ran against, as always.

**Identity, asserted BEFORE any number is read** (§3.0b): net worth **$3,401,782** · **6** properties ·
**5** loans. If any of those three disagree, stop and report that instead of the numbers. Admin
credentials open doors; they are not the account under test.

**Read-only throughout.** No writes, no edits, no action controls.

### Part A — MON-142, the two Bankwest interest-only loans

On each loan's detail surface, read and report:

| # | Check id | What to read |
|---|---|---|
| A1 | `loan.io1.storedRate` | The interest rate Monitrax displays for the first Bankwest IO loan (principal **$482,000**) |
| A2 | `loan.io2.storedRate` | Same, for the second (principal **$228,000**) |
| A3 | `loan.io1.monthlyRepayment` | The monthly repayment shown for loan 1 |
| A4 | `loan.io2.monthlyRepayment` | The monthly repayment shown for loan 2 |
| A5 | `loan.io1.rateStalenessSurfaced` | **Does any surface tell the user the stored rate may be stale?** Report `false` if nothing does |
| A6 | `loan.io2.rateStalenessSurfaced` | Same for loan 2 |

### Part B — the five schema reads (facts for T4–T7)

These have **no predicted value**. Set `expected` to the literal string `"UNKNOWN — report observed"` and
put what you find in `observed`. **Do not invent a prediction to fill the field** — an unknown honestly
reported is the deliverable.

| # | Check id | What to read |
|---|---|---|
| B1 | `property.types` | For each of the 6 properties: its type (HOME / INVESTMENT / RENTAL) |
| B2 | `property.availableDays` | For each: is `availableDaysPerYear` populated, and with what? (Nullable and recent — **empty is a legitimate finding**) |
| B3 | `property.depreciationSchedules` | For each: are there depreciation-schedule rows, and how many? |
| B4 | `super.totalBalance` | The total superannuation balance the app shows |
| B5 | `tax.div293` | Whether a Division 293 amount is shown, and its value |

---

## §3 Falsifiable predictions — Part A only

Stated in advance so a mismatch is informative. **Do not adjust anything to fit these.**

| Field | Predicted | Why |
|---|---|---|
| A1, A2 stored rate | **6.690%** on both | the stored `Loan.interestRateAnnual` FACT |
| A3 monthly repayment | **$2,518.34** | measured at the 915704f0 capture |
| A4 monthly repayment | **$1,191.25** | same |
| implied rate, both loans | **≈ 6.2697%** | derived: repayment ÷ balance × 12, interest-only |
| divergence | **−0.42026 pp, IDENTICAL on both loans** | the strongest evidence it is one lender changing one rate, not a data-entry slip |
| A5, A6 | **`false`** — nothing surfaces the staleness | this absence **is** MON-142 |

**The identical divergence is the load-bearing prediction.** Two loans drifting by exactly the same
amount is what a real rate change looks like. Two loans drifting by *different* amounts would mean
something else is wrong, and that would be the finding — report it plainly rather than rounding them
together.

**If A5 or A6 come back `true`**, something already surfaces staleness and MON-142's scope is narrower
than recorded. Say so.

---

## §4 What must NOT have moved

The regression cluster, unchanged since the T2 capture: net worth **$3,401,782** · committed outgoings
**$14,261** · LVR **41.3%** · health **53** · loans total **$12,779/mo** on `/dashboard/expenses`. This
run changes nothing, so any movement here is a separate finding.

---

## §5 How to return it (§3.0c)

**One fenced ```json block conforming to `matrix-result/v1`, then your human note.** The JSON is what
Code consumes; the note is what Reza reads. **Never only the note.**

- `kind`: `"ring3"` · `runId`: the next free `VR-NNN`
- `sha`: the **full 40-character** commit the run executed against
- `account.identityAssertion`: **both** expected and observed for net worth / properties / loans
- `checks[]`: one entry per A1–A6 and B1–B5, each with `expected`, `observed`, `pass`
- `verdict`: **PASS** only if every Part-A prediction landed. Part-B reads are informational — an
  unknown answered honestly does not fail the run
- `coverage.notVerified`: required. At minimum, state that this run **does not** verify what the correct
  rate is (only that stored and implied disagree, consistently), and that it changes nothing

Code validates with `npm run matrix:check -- <file.json>` before acting on it. A result that cannot be
trusted to say PASS or FAIL is rejected rather than interpreted.

---

## §6 Coverage boundary, stated up front

This run establishes **that** the stored rate and the transaction-implied rate disagree, and whether they
disagree identically across both loans. It does **not** establish which one is correct — the bank's
actual rate is outside the app, and no read here can settle it. What it does settle is that Monitrax
holds enough evidence to *tell its own user* the stored figure looks stale, and currently does not.

It verifies no calculation and changes no number.
