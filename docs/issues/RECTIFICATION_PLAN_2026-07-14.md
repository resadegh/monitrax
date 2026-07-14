# Monitrax Rectification Plan — Open Chat-Audit Findings (2026-07-14)

> **Status: DRAFT — per-issue root causes being verified in source before this plan is presented for Reza's "go".**
> **This is a PLANNING document. No code is changed by this plan. Fixing starts only on Reza's explicit approval, one issue at a time, in the cluster order below.**

Governing request (Reza, 2026-07-14):

> *"create a comprehensive plan for the issues, the root cause and the holistic process for that issue considering all monitrax and consulting neomatrix. the plan should have detailed solution that has gone through your rigorous review and 10/10 scored. I don't want any fix to break anything else, or the fix is an assumption or a surface fix rather than first understanding the full process and fixing the root cause. tackle each issue separately, spend enough time and effort to fix it once."*
>
> *"each fix needs to have its own review by numbers you get from claude chrome to make sure the fix has removed the issue and it is not causing further issues."*

---

## 1. What this plan is (and is not)

- **It IS** a per-issue, verified-to-source root-cause + holistic-process + detailed-solution plan for every OPEN chat-audit finding in the registry, each independently scored to an honest 10/10 (§20.5/§20.6) before presentation.
- **It IS NOT** a batch fix, an assumption, or a surface patch. Every root cause is proven at a real `file:line` read in source (§19.2). Where a cause cannot be proven, the issue is marked ⚠️ UNVERIFIED and does **not** get a "solution" until it is.
- **The fix philosophy is REMOVE THE CULPRIT, never wrap it** (§23.2 rule 1). A duplicate/rogue producer is deleted and the surface repointed to the ONE canonical source (§12.2.1). No compensating calculation, no UI-side correction, no "second producer that agrees."

## 2. The non-negotiable per-issue process (applied to EVERY issue below)

Each issue is fixed **on its own**, start to finish, before the next is touched. The lifecycle for one issue:

1. **Understand the full process first (§10, §21.5).** Consult the Neomatrix for the number's canonical engine + lineage + `file:line`; read the producing engine and EVERY consumer end-to-end. Never assume; never guess.
2. **Verify the root cause (§19.2).** Establish the four-step audit: input contract + units (proven from schema + writer + callers) → the correct rule/law/formula (authority cited) → a hand-computed worked example → the verdict against the current code (✅/❌ with wrong# vs correct#/⚠️).
3. **Confirm it is ONE source (§12.2.1).** If two+ producers exist, the fix deletes the rogue one(s) and repoints to canonical — not patch-both.
4. **Design the remove-the-culprit fix** with exact `file:line` changes.
5. **Map the full downstream flow (§19.4).** Enumerate every consumer via the Neomatrix lineage + a grep of every render site. If the number is an unmodelled blind spot, MODEL it first (§21.2.1).
6. **Add the lowest-ring permanent test (§23.2 Ratchet).** Wrong formula → Ring-0 fixture; duplicate producer → Ring-1 model+lint; plumbing/serialization → Ring-2 golden route test; cross-surface parity → Ring-2 parity-matrix; render/label → Ring-2 display guard. The test must FAIL if the bug (or its class) recurs.
7. **Build to an honest 10/10** on the §20.6 tri-axis (Document / Requirements / Logic) — or STOP and surface the blocker.
8. **Ship as its own draft PR** with the §20.6 gate line, the §19.2 evidence, the §19.4 sweep, the plain-English `{issue, fix, check}` trio, and the doc-sync block.
9. **PER-FIX RING-3 CHROME VERIFICATION (the new requirement — see §3).** Before the issue moves to VERIFIED, a targeted Claude-in-Chrome re-check captures the SPECIFIC numbers and confirms (a) the issue's symptom is GONE and (b) NO new discrepancy was introduced. Only then does the registry entry advance to VERIFIED.
10. **Promote the finding into the NeoAudit structure (§23.2 rule 6).** The Ratchet test from step 6 becomes permanent; parity coverage grows; the Chrome brief shrinks.

## 3. The per-fix Ring-3 Chrome verification loop (NEW — Reza 2026-07-14)

> *"each fix needs to have its own review by numbers you get from claude chrome to make sure the fix has removed the issue and it is not causing further issues."*

Every fix gets its **own** targeted real-data verification — not a batched sweep at the end. The loop per issue:

**A. Before the fix (baseline capture).** From the current registry entry + the VR run that found it, record the EXACT wrong numbers and the surfaces they appear on. This is the "before" the fix must move.

**B. After the fix is live on the PR preview / prod.** Issue a **targeted, single-issue Chrome brief** that:
1. Names the exact surfaces and the exact numbers to read (e.g. "HOME property: Cashflow/yr on the detail page, the Properties list tile, and the Home dashboard tile — report all three verbatim").
2. Asks for the numbers **verbatim** (a machine-readable capture), not a judgement.
3. Includes a **regression guard**: names the 2–4 NEAREST surfaces that the fix could plausibly have disturbed (its §19.4 downstream consumers) and asks Chrome to report THOSE numbers too, so a new discrepancy shows up immediately.

**C. The comparing session (me) evaluates the captured numbers against:**
- the fix's expected post-fix value (the §19.2 worked example), and
- the pre-fix baseline (symptom must be GONE), and
- the regression-guard surfaces (must still agree — no NEW divergence).

**D. Verdict.**
- **PASS** (symptom gone AND no new divergence) → advance the registry entry to VERIFIED with the run ID recorded; promote the Ratchet test (§23.2 rule 6).
- **FAIL** (symptom persists OR a new divergence appeared) → the issue stays FIXING; re-diagnose (the fix was a surface patch or disturbed a neighbour) and iterate. **A fix that removes issue X but breaks Y is not a fix.**

This makes "the fix removed the issue and caused no further issues" a captured-evidence gate, not a claim. Each issue below carries its **Chrome verification spec** (the surfaces + numbers + regression-guard list) so the per-fix brief is pre-written.

## 4. Cluster order (fix highest-leverage root causes first)

The open issues cluster into six root-cause groups. They are fixed in this order because earlier clusters are HUBS whose fix propagates to (and in some cases resolves) later symptoms — doing them first shrinks the surface of everything after.

| # | Cluster | Issues | Why this order |
|---|---|---|---|
| ① | **Expense hub** (one-offs treated as recurring; duplicate expenses) | MON-037 (+ audit ties to MON-023/024/025/022) | **Critical hub (§19.4).** One-off/duplicate expense handling cascades into HOME cashflow, tax deductions, expense totals, discretionary %, safety. Fix first — it moves the most downstream numbers. |
| ② | **Cross-surface cashflow** (Home tile ≠ detail/list) | MON-035 (+ MON-014 residual) | The property-cashflow SSOT is nearly unified; MON-035 is the residual rogue producer. Fixing it locks per-property cashflow everywhere. |
| ③ | **Rental yield** (three values across surfaces) | MON-036 (+ MON-033) | Same rogue-producer class as ②, on the yield number. |
| ④ | **Liquidity labelling** (Balances ≠ Safety Net) | MON-031 | Copy-only disambiguation (already diagnosed not-a-math-bug); low risk, quick. |
| ⑤ | **Tax + recommendations** (implausible savings %, refinance on 104% LVR) | MON-040, MON-038 (+ MON-018/019/020 context) | Recommendation-engine scale/gate bugs; contained to the CFO/tax advice surfaces. |
| ⑥ | **Display / labelling / counts** (income 3-way, vehicle count, depreciation sign, minor display) | MON-043, MON-042, MON-041, MON-039 | MON-043 is a genuine multi-producer income reconciliation; the rest are display/label/count guards. |

---

## 5. Per-issue plans

> Filled as each root cause is **verified in source** (§19.2). Each entry: verified root cause (`file:line`) · the correct rule/authority · worked example · remove-the-culprit fix · lowest-ring test · §19.4 downstream sweep · the per-fix Chrome verification spec · honest 10/10 gate. **Entries marked ⏳ are still under source-verification and are NOT yet presentable.**

### Cluster ① — Expense hub

#### MON-037 — One-off expenses shown as recurring MONTHLY (+ Battery duplicate) ⏳
_(root cause under source-verification — expenseAggregator `isRecurring` handling, the write paths that set frequency/isRecurring, the reconcile/document-analysis duplicate path, and the per-property expense card producer)_

_Known ground truth (verified this session):_ `lib/calculations/propertyCashflow.ts:130` (`computePropertyCashflow`) sums **every** expense passed to it and has **no `isRecurring` field** on its `CashflowExpense` input (lines 41–45) — so one-off filtering must occur upstream of this engine, and any surface that feeds it un-filtered one-offs will over-count. The Tier-2 oracle (`tests/golden/tier2/snapshotOracle.ts:91`) filters `e.isRecurring !== false` for the master monthly-expense figure, confirming the master path DOES honour `isRecurring` — the divergence to prove is which surface(s) ignore it.

### Cluster ② — Cross-surface cashflow

#### MON-035 — HOME cashflow tile ≠ detail/list (Δ 6040/yr) ⏳

### Cluster ③ — Rental yield

#### MON-036 — HOME rental yield reads 0.12 / 0.9 / 1.05 across surfaces ⏳

### Cluster ④ — Liquidity labelling

#### MON-031 — Liquid savings Balances $301,808 vs Safety Net $304,304 ⏳
_(already DIAGNOSED not-a-math-bug in the registry: the $2,496 gap IS the credit-card balance; Safety Net shows gross liquid, Balances shows net-of-cards. Plan = copy disambiguation only, changesNumbers=false.)_

### Cluster ⑤ — Tax + recommendations

#### MON-040 — Tax recs show "save 3685%" / $6.27M ⏳
#### MON-038 — Refinance offered on a 104% LVR loan ⏳

### Cluster ⑥ — Display / labelling / counts

#### MON-043 — Annual income 3 ways: Home $239K / Activity $484K / Tax $524,831 ⏳
#### MON-042 — Household 4 vehicles vs Assets 5 ⏳
#### MON-041 — Vehicle depreciation shown as −200% / −66.7% ⏳
#### MON-039 — Minor display (Medicare line, Money-In 0, list-tile cashflow) ⏳

---

## 6. Review gate

This plan is presented to Reza only after every ⏳ is resolved to a verified root cause and each issue's plan is independently scored to an honest 10/10 on the §20.6 tri-axis. The 3× self-review outcome and what it changed will be recorded here before presentation.
