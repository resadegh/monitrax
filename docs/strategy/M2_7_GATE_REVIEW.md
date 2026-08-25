# M2.7 — GATE REVIEW (D-17 ritual) · the M2 launch gate

**Run:** 2026-08-25 · **By:** 🟩 Matrix HQ (Cowork, Opus 5) · **Authorised by:** Reza ruling 2026-08-25d ("Matrix's next work = the M2.7 gate review")
**Method:** evidence-audited against the repo at `origin/main` (post-#1609) and against live PROD reads from this session. Nothing below is recalled — every claim carries a file, a PR, or a live capture. Where something could not be determined, it says so.
**Governing law applied:** **D-22** (refinement only · never reinvent · 100% depth before the next function) and **D-20** (kept-surface depth outranks hidden-module work).

---

## VERDICT — ⛔ **THE M2 GATE DOES NOT CLOSE.**

The M2 gate reads: *"Ring-3 PASS on live data across kept quantities **AND** the M2.6 sweep's launch-blocking gaps closed."* Neither half is satisfied yet, and the review found one **new live-number defect on the most important kept surface**. This is the gate doing its job — the same way the 2026-08-19 pack FAIL did.

Four blocking findings, in severity order:

| # | Finding | Why it blocks |
|---|---|---|
| **B1** | **The offset is not threaded into the property pages' cashflow engine.** `resolveLoanMonthlyCost` nets the offset (`lib/calculations/propertyCashflow.ts:246` — `l.principal - l.offsetBalance`), but **no `offsetBalance` is passed anywhere under `app/dashboard/properties/`**; both call sites (`page.tsx:496`, `[id]/page.tsx:180`) hand `computePropertyCashflow` loans without it. Guildford carries a **$303,889.96** offset (the very figure MON-143's fix verified elsewhere). | A **kept-surface number is computed on the full balance** on the properties list, the property detail page and the scoreboard cashflow strip. Same class as the already-registered **MON-151** ("per-property tax position derives interest as stored rate × FULL balance, ignoring the linked offset — the same D21 breach MON-143 fixed… in a different producer"). NEW, unregistered, and squarely inside D-22's "make the visible parts correct". |
| **B2** | **M2.2 was mis-stated, and the real gap is larger than the box.** T2's Ring-3 **did** pass (ledger `MON-131_TRANCHE_LEDGER.md:419`, G8 ✅ on VR-047 + VR-047B) — but it verified the `masterFinancialService → resolveLoanCostsForUser` leg, read on **Home's budget tile and `/dashboard/expenses`**, and **both of those surfaces are unreachable today** (MODULE_HOUSEHOLD hidden; HomeClient unmounted — zero importers). The **kept** property surfaces use a *different* producer — `resolveLoanMonthlyCost` via `computePropertyCashflow` — which **has never had a Ring-3**. The one kept surface fed by the verified leg is the `/dashboard/activity` Sankey, and that screen is **absent from VR-047's verified list** (`VR-047.md:74-78`). | The launch gate claims "Ring-3 PASS across kept quantities". For loan cost, the evidence covers a path that today feeds almost nothing kept. Not plan drift — a genuine coverage hole. |
| **B3** | **The M2.6 sweep's live half was never run.** The catalogue's ten **LIVE-CHECK (Matrix)** items (`M2_DEPTH_SWEEP_CATALOGUE.md:45-55`) have **no result artefact**. The sweep itself says why it matters: *"this sweep never rendered a page or touched PROD data"* (`:3`). Items 1, 2 and 9 are now **incidentally covered** by the two pack Ring-3s (#1601, #1606). **Seven remain unexecuted:** pack generation time on Reza's FY volume · Vision/OCR live in PROD (`VISION_NOT_CONFIGURED` path) · the empty-state-on-failure class · mobile bottom bar at 375px · onboarding on a fresh v1 account · Cash FAB → balances Cash-Wallet visibility · global-FAB receipt → property Documents. | The gate's second half is *"the M2.6 sweep's launch-blocking gaps closed"*. Seven of its ten live checks have not been looked at once. |
| **B4** | **21 OPEN/FIXING critical-or-high issues cite KEPT surfaces.** Of 39 OPEN/FIXING critical+high in the registry: **21 kept · 12 hidden-only · 6 mixed**. Of the **7 criticals, none is hidden-only** — five are kept (MON-001, MON-037, MON-136, MON-164, MON-165) and two are cross-cutting (MON-129, MON-131). Kept highs include a **crash**: MON-087, *"Property-context Add Expense dialog crashes (Radix `Select.Item` empty value)"*. | D-22 clause 3: a function is done when its numbers are verified, its surface has no dead ends, and its depth items are closed. On that test the kept surface is not done. |

**What IS closed and should not be re-litigated:** the D-12 pack trio (MON-168/169/170 VERIFIED, #1601 Ring-3) · the punch-list five (MON-180…184/186 VERIFIED, #1606 Ring-3, all 17 checks) · M2.1 census · M2.4 dialog SSOT · M2.5's five-condition close · MON-160/161/163 · T2's G7, permanently HALF by Reza's 2026-08-04 ruling (MON-157).

---

## 1. Progress vs plan — box by box, against evidence

| Box | Plan says | Evidence | Verdict |
|---|---|---|---|
| M2.1 census | done | 12-row kept table + two scope corrections (#1595) | ✅ stands |
| **M2.2 T2 Ring-3** | "still pending" | Ledger `:419` G8 ✅ (VR-047 PASS-SCOPED + VR-047B PARTIAL); MON-143 + MON-130 VERIFIED. **But** both read surfaces now hidden, and the kept path uses a different producer | ⚠️ **RE-SCOPE — see P-6.** Neither "done" nor "pending as written" |
| M2.3 fixes built | built, Ring-3 pending | FAIL 08-19 → M3 PR-1 → PASS 08-22 | ✅ stands |
| M2.4 dialog SSOT | done | both inline blocks deleted; ratchet + source-lock 4→3 | ✅ stands |
| M2.5 five-condition | CLOSED | per-condition evidence; census AT seed (`.audit/producer-census.json:7` `loanCost: 30` = seed 30) | ✅ stands, with the census's own honesty note: *"READ THE COUNT HONESTLY: 30 is not 1"* (`:290`) |
| M2.6 depth sweep | build half done, "Matrix's live half remains" | 49 findings; 11 fixed in-PR, 12 registered (MON-168…179), 21 deferred (19 → M3.6, **2 tagged M3.1**: #10 depreciation absent from the pack, #11 per-loan interest in neither pack). **Live half: 0 of 10 executed, 3 incidentally covered** | ❌ **NOT closed** (B3) |
| M2.7 gate review | — | this document | ▶ running |

**Slipped-and-named (never silently dropped):** finding **#19** (`M2_DEPTH_SWEEP_CATALOGUE.md:23`) — two competing pack generators on the reports page — carries **no MON id** and is explicitly *"flagged for a ruling, not assumed"* (`:58`). It has been awaiting Reza since 2026-08-19. Partially overtaken: the legacy Tax-Time tile is now gated to `MODULE_TAX` (#1605), so the *exposure* is closed; the *duplicate-generator* question is not. → **P-7.**

---

## 2. Market + regulatory re-check (2026-08-25)

**Competitors — one correction to our own record, one new datum.**
- **TaxTank: our $15/mo figure STANDS.** A "from $6/month" headline now fronts their pricing page, but that is the cheapest non-property tank (Holdings/Money). The **Property Tank is $15/mo ($180/yr)** — unchanged. **New pricing mechanic worth recording: 5 properties included; additional properties $36/property/year.** On Reza's 6-property portfolio that is **$216/yr** — the concrete number to price against at M5.2, replacing the flat "$15/mo" anchor.
- **propkt is now running comparison content** ("Best Rental Property Tax Software in Australia (2026): 6 Options Reviewed") — a category-education play. Watchlist item; no product change observed.
- No new entrant observed since the 2026-08-19 sweep. Watchlist unchanged: TaxTank · The Property Accountant · Moorr · Propva · propkt.

**Regulatory — the open verification item STAYS OPEN, and our own model needs a primary-source pass.**
The ATO now has a live page for the reform (`ato.gov.au/about-ato/new-legislation/…/tax-reform-boosting-home-ownership-…`), which resolves the plan's "guidance still unpublished" to *"published, but high-level"*. Read against our §7 record:

| Our §7 claim | ATO primary source says |
|---|---|
| quarantined residential losses — **per-property vs pooled OPEN** | **Still not addressed.** The open verification item stands; the Corrs-vs-PwC conflict is unresolved by the ATO |
| deemed disposal + 1-Jul-2027 valuation | **Not mentioned at all** on the ATO page |
| cost-base indexation | **Confirmed**, plus a detail we had not recorded: indexation replaces the 50% CGT discount **together with a 30% minimum tax rate on capital gains** for individuals, trusts and partnerships |
| record-keeping / substantiation guidance | **Not addressed** |
| NG limited to new builds | **Confirmed** — and this framing is sharper than our §7 wording |

**Consequence:** two of our four reform claims are **secondary-source only**. That does not affect v1 (the pack ships regardless), but it hard-blocks any R2 loss-ledger or cost-base work until the Act itself is read — which the plan already requires. **Recommend the §7 row be corrected to say exactly which claims are ATO-confirmed and which are not.** → **P-8.**

**The "9-in-10 rental returns wrong" stat:** still not re-verified against an ATO-primary source; ATO publishes a 2026 rental properties guide but no refreshed compliance statistic was found in this pass. **Remains barred from marketing copy (M5.1) until primary-sourced.**

---

## 3. Upgrade proposals — each needs Reza's ruling (D-18/D-22: none actioned unilaterally)

**P-6 — RE-SCOPE M2.2 to the kept path. (Recommended.)** Rewrite the box as *"T2-KEPT: Ring-3 the loan-cost path the KEPT surfaces actually use"* — `resolveLoanMonthlyCost` → `computePropertyCashflow`, read on the properties list, a property detail page, the balances loan dialog, and the `/dashboard/activity` Sankey (the one kept consumer of the already-verified leg). The old handout's Home/`/dashboard/expenses` table is retired as unreachable, with VR-047/047B's evidence **kept as the record for the leg they did cover**. This turns a mis-stated box into an honest, runnable one — and it is where B1 gets caught or cleared.

**P-7 — Rule on depth-sweep finding #19 (two pack generators).** Awaiting since 08-19. Options: (a) delete the legacy generator now that its tile is gated, (b) keep it dark as the R2 seed, (c) leave as-is and re-raise at M3.1. **Recommend (b)** — hidden ≠ deleted, and M3.1 restructures the surviving pack anyway.

**P-8 — Correct §7's reform row to separate ATO-confirmed from secondary-source claims. (Recommended.)** Cheap, and it stops a future session treating "deemed disposal" as settled fact.

**P-9 — Run the seven outstanding LIVE-CHECK items as ONE Matrix+Chrome sweep. (Recommended.)** They are cheap individually and expensive to keep deferring; batching them is one session, and it discharges the gate's second half.

**P-10 — Group the kept-surface depth debt into ONE Code brief rather than trickling it.** The nine kept OPEN highs from the sweep (MON-171…178) plus the kept crash (MON-087) plus B1 are all "make the visible thing correct" work. One brief, one Ring-3, one close — which is exactly D-22 clause 3. **Recommend adopting**, sequenced AFTER P-6's re-scoped Ring-3 so the loan-cost truth is known before the properties page is touched again.

**P-11 — Matrix satellite docs, to keep the plan writable.** Every Matrix plan write currently re-uploads the whole ~86 KB plan through the GitHub connector (the sandbox can read GitHub but any credential-bearing push is classifier-blocked). Gate reviews and Ring-3 verdicts should live in their own files — this document is the first — with the plan carrying the cursor, the box state and a pointer. SSOT is preserved (one home per fact); the plan stops growing without bound. **Recommend adopting.**

---

## 4. Cursor + §9

Updated in the same PR as this document (§0 same-turn law).

---

## Coverage boundary

**This review establishes:** the M2 box-by-box state against repo evidence; the M2.2 coverage hole and its cause; the unexecuted live-check inventory; the kept-vs-hidden split of every OPEN/FIXING critical+high issue; a competitor pricing re-check and an ATO primary-source read.

**It does NOT establish:** that B1 actually moves a rendered number — that is a prediction from source, and the P-6 Ring-3 is what confirms or refutes it on live data (no number is claimed here) · live PROD feature-flag values beyond what this session read on Reza's account · that the "fixed in PR-3" claims are true at commit level (`git` was unavailable in-session; they rest on the catalogue's own assertions) · anything about hidden-module surfaces, which stay HELD under D-20.
