# CAPTURE HANDOUT — commit the golden-baseline REFERENCE TREE, and prove the diff chain works

**Prepared by:** Code session (Opus 5), 2026-08-04 · **Kind:** `capture` (measurements, not a verdict)
**Registry:** **MON-157** — the reference has always been persisted as a *hash*, never as a *tree*.
**Runs in:** the **admin** Chrome profile (§0). One session, three calls.

---

## §0 Read this before you decide what this handout is for

You asked for the T2 whole-tree sweep — the `POST /golden-baseline/diff` call that returns
`CLEAN` / `EXPECTED_ONLY` / `STOP` and closes **G7**. **That call cannot be run for T2, and this handout
is not it.** The reason is worth stating plainly rather than burying, because it is a defect in our
process, not in the app:

`diffBaselines(oldTree, newTree, expectedMoves)` (`lib/matrix/goldenBaseline.ts:244`) flattens **both
sides** to numeric leaves. It needs a **tree** on the old side. What we kept from T1 is a **hash** —
`347006b9…`, recorded as a string in the prose of `VR-045.md`. A hash proves *something* moved; it
cannot say *what*, which is exactly the question G7 asks. The route's own comment says so:
*"a matching treeHash proves nothing moved anywhere. Localising a mismatch still needs the full tree."*

`git log --all` over `.audit/golden-baseline*` returns **nothing** — no such file has ever been
committed, on any branch, in the repository's history. The capture CLI writes one and prints
**"COMMIT IT"**; it was never run to completion into a commit, because it needs a database the build
container cannot reach, and the relay that *can* reach it returned the tree into a chat session that
then ended. That is a §21.2.2 rule-4 failure: the instrument's reference lived in a session instead of
in the repo.

**Consequence, stated once so nobody re-litigates it later.** T2's pre-migration tree is gone — the code
has changed and the live data has moved on, so it cannot be re-captured. **T2's G7 stays at HALF
permanently**, with its fifteen declared paths verified live (VR-047B A2) and the whole-tree question
unanswered. This handout cannot fix that. What it does is make sure **T3 is the last tranche that could
ever have this problem.**

---

## §1 The second Chrome profile

The rule this satisfies is VR-044 §7 rule 4: **the admin login silently overwrites the user session.**
Signing into `/admin/login` in the profile holding Reza's user session is what voided VR-044's first
attempt and VR-046's. A separate profile is the control, not a nicety.

1. Chrome → profile avatar → **Add** → **Continue without an account** → name it **`Monitrax Admin`**.
2. In that window **only**, sign in at `/admin/login`.
3. Everything below runs in the **admin** window. Reza's normal profile stays signed in as the user.

> **HOW to call a relay — this line is load-bearing.** Run every call below as a **page-context fetch
> from the already-authenticated admin tab**:
> ```js
> await fetch('<url>', { credentials: 'include' }).then(r => r.json())
> ```
> **Do NOT navigate to the URL in the address bar.** Admin auth is Bearer/GCP, not cookie-based, so a
> navigation arrives unauthenticated and returns `SESSION_INVALID`. Every one of the 39 relay calls that
> has ever succeeded used the page-context fetch; not one used navigation. VR-047B's first attempt
> navigated, read the failure as an app defect, and nearly shipped an auth change to fix something that
> was not broken. (`lib/admin/auth.ts:501` reads an `admin_session` cookie that nothing writes —
> **MON-155** — which is what made the wrong story plausible.)

**The identity rule binds inside the admin window.** Admin credentials open the door; they are never the
account under test. Every URL carries `?userId=91b6d7ce-d9f1-4ac0-96ce-fc958dca2a3c`, and a response
whose echoed `userId` differs is **void** — report it as void, never as numbers.

---

## §2 Call 1 — the hash summary (small, and it is the tripwire)

```js
await fetch('/api/admin/matrix/golden-baseline?userId=91b6d7ce-d9f1-4ac0-96ce-fc958dca2a3c&format=hash',
  { credentials: 'include' }).then(r => r.json())
```

~400 bytes. **Return it verbatim.** Three fields decide whether Call 2 is even worth making:

- **`captureErrors`** must be **`[]`**. This is the partial-capture tripwire. A capture that throws
  serialises as a `__captureError` stub with **zero** numeric leaves, so a tree can be missing an entire
  producer's numeric content while still looking like a valid eight-tree capture (drift-log D8). A
  reference committed with a non-empty `captureErrors` is worse than no reference: every future diff
  would read the missing tree's absence as "nothing moved there."
- **`perTree`** — eight keys, each with a leaf count. Report all eight. A count near zero on a tree that
  should be rich is the same failure wearing a different mask.
- **`sha`** — the deployed commit. Must contain `e3a3715` (the PR #1580 merge) or be later on `main`.

**Expected `leafCount` is around 1,759** — the figure VR-045 recorded at `3cdaa8c4`. It has no reason to
be exact: T1's income flip removed an `OTHER` subtree and T2 added `debt.summary` coverage, so the count
legitimately drifts. **Report what you see; do not adjust anything to match this number.** It is written
here as an order-of-magnitude sanity check, not a prediction. A `leafCount` of 40, or of 17,000, means
something is wrong with the capture, not with the app.

---

## §3 Call 2 — the full tree (this is the artefact)

```js
await fetch('/api/admin/matrix/golden-baseline?userId=91b6d7ce-d9f1-4ac0-96ce-fc958dca2a3c',
  { credentials: 'include' }).then(r => r.json())
```

**~282 KB. Return `data.tree` VERBATIM.** This payload *is* the deliverable — it becomes
`.audit/golden-baseline-<sha>.json`, the reference every subsequent tranche diffs against.

**Do not summarise it, do not round it, do not omit a subtree because it looks uninteresting.** The five
paths T2 nearly missed all looked uninteresting, and the whole point of a whole-tree reference is that
it contains the leaves nobody thought to name.

**If it exceeds one message,** split it across messages **at the eight top-level keys** — the tree is an
object keyed by `file:function`:

```
lib/services/masterFinancialService.ts:getMasterFinancialSnapshot
lib/tax-engine/position/userTaxPosition.ts:getUserTaxPosition
lib/cfo/scoreCalculator.ts:computeCFOComponents
lib/cfo/riskRadar.ts:scanForRisks
lib/services/moneyFlowService.ts:getMoneyFlow
lib/health/buildHealthInput.ts:buildHealthInput
lib/health/aggregateEngine.ts:generateHealthReport
lib/services/loanCosts.ts:resolveLoanCostsForUser
```

Say which keys are in which message. **Reassembly is verified, not assumed**: Code re-hashes the
reassembled tree with the same `hashBaseline` construction and compares it to Call 1's `treeHash`. A
mismatch means the paste lost something, and the capture is re-run rather than committed.

### Identity — assert these BEFORE reporting anything

Read them out of the tree itself and state observed-vs-expected. If any is wrong, the capture is scoped
to the wrong account and is **void**:

| Where | Expected |
|---|---|
| `masterFinancialService…` → net worth | **3,401,781.52** |
| `loanCosts…resolveLoanCostsForUser` | **5** loans, monthly total **12,779.292814353912** |
| `masterFinancialService…` → `debt.summary.totalRepayments` | **12,779.292814353912** |
| echoed `userId` | `91b6d7ce-d9f1-4ac0-96ce-fc958dca2a3c` |

**One thing to expect and not report as a defect:** the `moneyFlowService` capture runs on the
**DECLARED** loan basis. That is deliberate — the T2-B seam is merged and inert, and the reference must
record **today's** behaviour, not a behaviour no surface uses. Its loan leg therefore understates by
**$3,792.92/month**, exactly as **MON-156** declares. A reference that quietly captured the *better*
number would make the next tranche's diff report a move that never happened.

---

## §4 Call 3 — the self-diff, which proves the chain end to end

```js
await fetch('/api/admin/matrix/golden-baseline/diff', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: '91b6d7ce-d9f1-4ac0-96ce-fc958dca2a3c',
    expectedMoves: [],
    baseline: /* the EXACT data.tree object from Call 2 */,
  }),
}).then(r => r.json())
```

The route captures **fresh** server-side and diffs it against what you POST. Posting Call 2's tree back
therefore compares two captures taken minutes apart on unchanged code.

**Prediction, falsifiable:** `verdict: "CLEAN"`, with `unexpected: []`, `added: []`, `removed: []` and
`declared: []`. Report `moves.unchanged` as the leaf count that held.

**A non-CLEAN verdict here is a real finding, not noise.** Calendar-derived leaves are already filtered
out of the comparison (`isVolatileLeaf`, T1-B §1.4), so a leaf that moves between two captures on
identical code and unchanged data is **non-determinism in a producer** — which is precisely what MON-134
was, and precisely the class this instrument exists to catch. If it happens: report the moved paths with
both values and **stop**. Do not re-run until it comes out clean; a reference chosen because it was the
run that agreed with itself is not a reference.

This call is why the handout has three parts instead of two. Committing a tree we have never
successfully diffed would leave the whole chain — capture → serialise → POST → flatten → verdict —
untested at the exact moment T3 starts depending on it.

---

## §5 What this establishes, and what it does not

**Establishes:** a committed, hash-verified whole-tree reference at a known commit, and that the
capture → diff → verdict chain returns a correct verdict end to end. **T3's G7 becomes runnable as
designed** — one POST, three possible outcomes, `MOVED-UNDECLARED` stops the tranche.

**Does not establish:** anything about **T2**. T2's G7 stays HALF and this handout does not change that
(§0). It verifies **no rendered surface** and **no number's correctness** — a reference records what the
app currently produces, including anything currently wrong. It is a *baseline*, not a *verdict*: the
$3,792.92 money-flow understatement is captured **as-is**, deliberately.

**Not a check of the numbers.** Nothing here asks whether a figure is right. Three of the four identity
values above are asserted only to prove the capture is scoped to Reza's account.

---

## §6 Return format (§3.0c)

> **Return one fenced ```json block conforming to `matrix-result/v1`, then your human note.**
> The JSON is what Code consumes; the note is what Reza reads. Never only the note.

- `kind: "capture"`, `verdict: "CAPTURE_ONLY"`, `runId: "VR-048"`.
- `payload` = `{ hashSummary: <Call 1 verbatim>, tree: <Call 2 verbatim>, selfDiff: <Call 3 verbatim> }`.
- `account.identityAssertion` = the §3 table, with **both** `expected` and `observed`. A bare
  `pass: true` is an assertion about nothing and the validator rejects it.
- `sha` = the full 40-char commit from Call 1. This run reads the relay, so the account-first null-sha
  exemption does **not** apply — a capture has no excuse for an unknown build.

Validate with `npm run matrix:check -- <file.json>` before acting on it. Exit 0 means well-formed and
self-consistent, **not** that it passed.

**If Call 1 shows a non-empty `captureErrors`:** stop after Call 1 and report it. Do not make Call 2 —
a tree captured with a failed producer must not be committed as a reference, and the failing producer
becomes its own finding.

---

## §7 Gate (§20.6)

`Gate (§20.6): Document 10/10 (MON-131_COMPLETION_BRIEF §3.0b/§3.0c · MON-131_TRANCHE_LEDGER G7 · lib/matrix/goldenBaseline.ts read in source · VERIFICATION_PLAYBOOK §3.2) · Requirements 10/10 · Logic 10/10`

Self-review changed the handout twice, and both changes came from reading source rather than trusting
the ledger. **(1)** The first draft was what Reza asked for — the `POST /diff` call that closes G7 — and
it would have failed at the relay with `MISSING_BASELINE`, because the baseline tree it told the Matrix
to post does not exist anywhere. Checking `git log --all` before writing the instruction is what turned
a broken request into MON-157 and this handout. **(2)** The first draft also passed the whole of
`.audit/expected-moves-t2.json` as `expectedMoves`. The route's type is
`Array<{pathPrefix, why?, arithmetic?}>` — the contract file is a different shape, so the declared moves
would have silently matched nothing and every one of them would have been reported as
`MOVED-UNDECLARED`. That is a false STOP, which is worse than no run: it manufactures a stopped tranche.

**Coverage boundary.** This handout captures and verifies a reference artefact. It verifies **no**
rendered surface, closes **no** gate for T2, and asserts **nothing** about whether any captured number
is correct.
