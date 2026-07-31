# RING-3 HANDOUT — VR-045: the T1 income flip, repaired

**Prepared by:** Code session (Fable 5), 2026-07-31 · **Source run:** `docs/verification/runs/VR-044.md` (**FAIL — 22 declared paths missed**)
**Under test:** PR **#1548** `fix/mon-140-banked-input-feed` — **MERGED** `e4040dbb` · prod `dpl_B2rYVXJVDvvVqEH1HzJzJ5VGa1tW` **READY** 04:14 UTC
**SHA to verify:** `0756fe3d` (`origin/main` HEAD, incl. #1549 docs)
**Contract:** `.audit/expected-moves-t1.json` @ `f1c87afb`, declared against `3028c08a` / `treeHash 6f2369a6…`
**Registry:** MON-128 · MON-137 · MON-140 — all `FIXING`, all `changesNumbers: true`. This run is the §24.2 #7 per-fix number verification that gates them to `VERIFIED`. **MON-138** is the fourth member of this tranche (`expected-moves-t1.json` `_meta.tranche`) and needs a §2b capture before it can move — see there.

> **Read VR-044 first.** T1-B was a **partial** flip: the tax half landed to the dollar, the income half never reached `masterFinancialService`, and Home ended up showing **$12,476/mo** and **$38,547/mo** side by side, both labelled Income. This run decides whether #1548 closed that.

---

## §0 How to run this

1. Paste the **canonical brief** — `VERIFICATION_PLAYBOOK.md` §3.3, **verbatim** — first. That is the complete sweep and it is not replaced by this document.
2. Then paste **this overlay**. It scopes the extra scrutiny for the T1 repair.
3. VR-044 §7 standing rules are **binding**:
   - **Never validate a number through the admin portal's own user.** Admin creds open the relay door; the data behind it is always `?userId=` scoped to the account under test.
   - **Assert identity from a known figure before reading any rendered number** — net worth **$3,401,782** · 6 properties · 5 loans · entity *"Reza"* $2,651,782. A run that cannot prove its account is **void**, and is reported as void, never as numbers.
   - **Separate browser profiles.** The admin login silently overwrites the user session.
   - **Complete, not sampled.** Every number, every surface.

---

## §1 The mechanism that failed, and the repair

VR-044 §3 named the gap to the cent:

```
505,564.05 − 347,162.61 = 158,401.44      the gap
     13,200.12 × 12     = 158,401.44      the banked engine's one-off total, annualised
```

Ten one-off income rows were annualised ×12. **Root cause (MON-140, §19.2-verified):** `masterFinancialService.ts:668` handed the banked engine a `select`-narrowed income row **missing `isRecurring`**, so `receivedBanked.ts:28` could not gate one-offs. `moneyFlowService` passed full rows and was correct — same engine, **different inputs**. The MON-028 class.

**Fix:** the required income column set is written down **once** and every loader reads it. Home can no longer be handed a partial row.

**VR-044 §6's alternative diagnosis is answered:** it was **not** a stale-snapshot/regeneration defect. The consumer was fed a starved row. The forward fix was taken over the revert on that evidence.

---

## §2 THE DECIDING CHECK — all 22 declared paths must now land

Producer tree via the admin relay, `?userId=91b6d7ce…`. **Every row must equal "Declared". VR-044's "Was" column is the failure state — seeing it again means the repair did not take.**

| Path (`masterFinancialService.getMasterFinancialSnapshot.…`) | Declared | Was (VR-044 FAIL) |
|---|---|---|
| `income.annual.all.grossTotal` | **347,162.61** | 505,564.05 |
| `income.annual.all.netTotal` | **304,158.61** | 462,560.05 |
| `income.annual.all.taxableIncome` | **347,162.61** | 505,564.05 |
| `…byType.SALARY.gross` | **192,719.50** | 227,519.50 |
| `…byType.SALARY.net` | **149,715.50** | 184,515.50 |
| `…byType.OTHER` | **leaves the run-rate** | 123,601.44 still present |
| `cashflow.annualGrossIncome` | **347,162.61** | 505,564.05 |
| `cashflow.monthlyGrossIncome` | **28,930.22** | 42,130.34 |
| `cashflow.annualNetIncome` / `.annualIncome` | **304,158.61** | 462,560.05 |
| `cashflow.monthlyNetIncome` / `.monthlyIncome` | **25,346.55** | 38,546.67 |
| `cashflow.monthlyCashflow` / `.monthlySurplus` | **15,047.71** | 28,247.83 |
| `cashflow.annualCashflow` / `.annualSurplus` | **180,572.52** | 338,973.94 |
| `cashflow.savingsRate` | **59.37** | 73.28 |
| `cashflow.debtServiceRatio` | **34.78** | 22.87 |
| `cashflow.taxableIncome` | **347,162.61** | 505,564.05 |
| `quickMetrics.monthlyIncome` | **25,346.55** | 38,546.67 |
| `quickMetrics.monthlyGrossIncome` | **28,930.22** | 42,130.34 |
| `quickMetrics.monthlyCashflow` | **15,047.71** | 28,247.83 |
| `quickMetrics.savingsRate` | **59.37** | 73.28 |
| `quickMetrics.keptAfterEssentials` | **23,864.36** | 37,064.48 |
| `quickMetrics.keptMargin` | **82.49** | 87.98 |
| `debt.metrics.debtToIncomeRatio` | **677.24** | 445.33 |

**Identity that must hold exactly:** `grossTotal 347,162.61 − paygWithholding 43,004.00 = netTotal 304,158.61`.
**Composition:** salary gross 192,719.50 + rental 154,443.11 = 347,162.61 · salary banked 149,715.50 + rental 154,443.11 = 304,158.61.

---

## §2b MON-138 — a capture, not yet a verdict

MON-138 (PAYG Schedule 1 band selection had 1-dollar gaps: fractional weekly earnings between integer band bounds withheld **$0**) shipped in #1545 and is `changesNumbers: true`, so §23.2.3 will not let it reach `VERIFIED` on a formula argument alone.

**Its correctness is already proven at Ring 0** — `tests/tax/mon128T1WithholdingConfig.test.ts:121` pins `$500.50/wk → $22/wk` on the FY24-25 tables, across both the Float and Decimal twins.

**What is NOT yet established is whether this run can verify it at Ring 3 at all.** So capture, do not judge:

- Across every income row on the account, is there any with a **WEEKLY or FORTNIGHTLY** frequency whose gross amount is **not a whole dollar** (e.g. `$500.50`, `$1,842.31`)? List each: source name, frequency, exact gross, and the withholding shown for it.
- If such a row exists, its withholding must be **non-zero** — the defect was $0 withholding above the tax-free threshold.
- **If no such row exists on this account, say so plainly.** That is the expected answer and it is not a failure.

**Disposition, decided in advance so the run does not have to improvise:** no fractional weekly/fortnightly row ⇒ MON-138 has **no Ring-3 surface on this dataset** and **stays `FIXING`**. It is not verified by this run and must not be swept into a tranche PASS. Closing it then needs Reza's call between (a) a recorded Ring-0-sufficient exemption for a defect with no reachable surface on the reference account, or (b) VR-044 §7 rule 5 — a second dataset carrying the shape Reza's does not have.

---

## §3 The contradiction must be GONE from Home

VR-044 §4's headline: two Income figures, 3.1× apart, both visible without scrolling.

| Home tile | Must read | VR-044 read |
|---|---|---|
| `ENTITY CASHFLOW · Income` | **+$12,476/mo** | +$12,476 ✅ (was already flipped) |
| `THIS MONTH'S BUDGET · Income` | **$25,347** | $38,547 ❌ |
| `THIS MONTH'S BUDGET · Saved` | **$15,048** | $28,248 ❌ |
| `HEALTH · Debt / income` | **677%** | 445% ❌ |
| `HEALTH` score | **53** | 53 ✅ |

**The single most important read in this run:** the two Home income figures must now tell **one** story. Producer-level equivalent — `moneyFlowService.getMoneyFlow.totalIncome` **304,158.61** must equal `masterFinancialService` net/banked **304,158.61**. In VR-044 these were 304,158.61 vs 462,560.05.

Also re-read the consequential figures VR-044 saw move off the unflipped producer — they must return: Home *"spending more than you earn"* **$12,597** (was $11,757) · daily spending budget **$903** (was $911) · entity cashflow total **−$17,003** (was −$19,759) · Reza's entity line **−$17,379/mo** (was −$20,135).

---

## §4 `mustNotMove` — the regression cluster, byte-identical

VR-044 §5 held these **13/13, 13/13, and all** against VR-042/VR-043. **Any movement here is a new defect caused by #1548.**

- `/dashboard/balances` — net position −$1,758,089 · cash $304,304 · credit −$2,496 · debt $2,059,898 · net worth $3,401,782 · assets $5,461,679 · liquid $301,808 (9%) · accessible $67,871 (2%) · locked $3,032,102 (89%) · property equity $2,955,102 · personal assets $102,000 · less HECS −$25,000 · all five loan rows with rates and offset.
- `/dashboard/expenses` — total outgoings $14,261/mo · $171,138/yr · Pareto $1,482 · recurring $1,482 (5) · one-off $50,840 (132) · loans $12,779 (5) · all five per-loan costs with basis labels · insurance $812/$9,747.
- `/dashboard/tax` — **everything**, and it must stay exactly where T1-B put it: PAYG withheld **$43,004** · Estimated **refund $5,218** · total income $317,751 (19 sources) · deductions $172,325 (137) · taxable $145,426 · tax on income $34,878 · Medicare $2,909 · gross/net tax $37,786 · effective 26.0% · marginal 37.0% · negative-gearing warning $50,334.
- **Producer:** `cashflow.monthlyLoanRepayments` **8,816.65** (T2) · `expensesByCategory` **{OTHER: 1,482.19}** (T3) · engine taxable **145,426**, net tax **37,786** (T4).

---

## §5 KNOWN NON-FINDINGS — do not raise these as defects

Pre-declared so this run does not repeat the VR-029 false-fail.

1. **`perMember[].taxPosition.paygWithheld` = 11,129** against a top-level **43,004**. This is **deliberate and in-scope-deferred**, not a defect. `lib/tax-engine/position/userTaxPosition.ts:286-288` states it verbatim: *"Per member positions below stay on stored rows this tranche (their movement is NOT declared in expectedMoves; T6 scope)."* The top-level figure is the §1.1 two-pass banked derivation (`:289-300`); per-member positions call the engine on stored rows (`:364`). Per-member refunds **−17,205** and **+827** against a top-level **+5,218** follow from the same deferral. **Record the values, mark T6, do not fail the run.**
2. **Home annual income $239K · monthly cashflow −$6,073 · saving rate −30.5%** — MON-139's producer, correctly untouched (T6).
3. **`renderedPartC.payg` — instrument repaired.** VR-044 §4 caught this pin still holding the retired 11,129, which would have reported "unchanged — PASS". It was repointed to **43,004** in #1548 (`lib/matrix/goldenBaseline.ts:172`), with the maintenance rule now in the file header. Treat the pin as trustworthy again for this run.

---

## §6 Verdict format

| Item | Verdict |
|---|---|
| §2 — all 22 declared paths land on their declared value | PASS / FAIL (list every miss) |
| §2b — fractional weekly/fortnightly income rows | LIST them, or state NONE FOUND (not a pass/fail) |
| §3 — Home shows ONE income story; moneyFlow ≡ master | PASS / FAIL |
| §4 — regression cluster byte-identical | PASS / FAIL |
| §5 — no undeclared movement outside the income family | PASS / FAIL |
| §3.3 canonical sweep — coverage object complete, `skipped: []` | PASS / INCOMPLETE |

**If §2 and §3 both PASS and §4 holds:** MON-128, MON-137 and MON-140 move `FIXING → VERIFIED` with `VR-045` in the notes. **MON-138 does not move on this run unless §2b found a fractional row** — so the T1 tranche closes three-quarters, not whole, and MON-138's disposition goes to Reza per §2b.
**If any of §2, §3 or §4 fails:** report the exact misses. The T1-B brief §5 revert contract applies to the tranche, not to #1548 alone — Code re-diagnoses from Stage 1 (`FIX_PROTOCOL.md`), and the issues stay `FIXING`.

Every new FAIL outside the declared set becomes a fresh `MON-###` via `npm run issues:raise`.

---

## §7 Gate (§20.6)

`Gate (§20.6): Document 10/10 (VERIFICATION_PLAYBOOK §3.2/§3.3, VR-044, expected-moves-t1.json) · Requirements 10/10 · Logic 10/10`

Self-review changed three things. (1) I had drafted the per-member `11,129` divergence as an unregistered second PAYG producer and a §12.2.1 finding — reading `userTaxPosition.ts:286-288` showed it is an explicit, commented T6 deferral, so it moved from "raise this" to §5's do-not-fail list; shipping the first version would have manufactured a false FAIL. (2) I had the overlay standing alone; playbook §3.2 rule 1 requires the §3.3 canonical brief be handed over verbatim and un-improvised, so §0 now sequences the canonical sweep first and states this document does not replace it. (3) The `renderedPartC.payg` instrument was asserted repaired from VR-044's recommendation — verified in source at `lib/matrix/goldenBaseline.ts:172` before it was written down as trustworthy.

**Coverage boundary, stated precisely:** this handout verifies that the 22 declared producer paths land on their declared values, that Home renders one income story, and that the named regression cluster is unmoved. It does **NOT** verify the correctness of the declared values themselves (that is VR-043 §3's relay derivation plus the Ring-0 fixtures), it does **NOT** resolve MON-138 (§2b is a capture that decides whether Ring 3 can reach it at all), and it does **NOT** verify any surface outside the §3.3 canonical sweep plus the paths named here.

**Amendment, 2026-07-31 (§2b added).** The first version of this handout named only MON-128/137/140 and would have let a §2/§3/§4 PASS read as "the T1 tranche is closed." `.audit/expected-moves-t1.json` `_meta.tranche` declares **four** members — MON-138 is one, is `changesNumbers: true`, and shipped in the same #1545. Sweeping it into a tranche PASS with no reachable surface would have been exactly the verified-by-claim-not-numbers failure `FIX_PROTOCOL.md` §1 exists to stop.
