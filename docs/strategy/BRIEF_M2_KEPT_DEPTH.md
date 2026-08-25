# CODE BRIEF — P-10: kept-surface depth (make the visible thing correct)

**From:** Matrix HQ · **Authorised:** Reza GO on P-6…P-11 (2026-08-25) + Reza 2026-08-25: *"let's fix this issue first"* (the intake pipeline, PR-1 below) · **Law:** D-22 — refinement only, never reinvent, 100% depth before the next function. Every item below is a defect on a KEPT surface. No new features. No hidden-module work (D-20).
**Registry duty:** findings F1–F10 below are NEW (registered from the P-9 live sweep, verdict envelope on the PR). Assign MON ids and add them to `docs/issues/ISSUES.md` + `ISSUES.json` in PR-1 (Neo-sync discipline). Statuses: OPEN → FIXING in the same PR that fixes them.
**Ring-3 gate:** each PR merges on its own predictions (below); the registry flips FIXING → VERIFIED only on the Matrix's PASS. The P-9 handout + envelope (`RING3_M2_6_LIVE_SWEEP.md`, PR comment) is the baseline of record for every "today it does X" claim.

---

## PR-1 — the intake pipeline (Reza's active blocker; sequence FIRST)

**Today, verified live on both viewports:** the Smart Inbox is display-only. Checkboxes and Select-all never register (counter pinned at "0 selected", Approve unreachable) — **F1**. Pencil-edits accept input, the row header live-updates, then Done + reload reverts everything — **F2**. Net effect **F3**: "edit any, then approve" is false; the dashboard's intake counter (48) and vault's "awaiting review" (4) can never clear. A real expense of Reza's (Bunnings $203.78, doc `View recent photos.png`) is stranded pending right now.

1. **F1/F3 — make select + approve work.** Find why the checkbox state never binds (suspect: controlled input without a handler, or state keyed to an id the API payload doesn't carry). Approve must save the item exactly as the review card shows it.
2. **F2 — make Done persist.** The edit must write through (PATCH the intake item) and survive reload. If Done was always local-draft-only by design, that design contradicts the surface's own copy — persist it.
3. **F7 — upload size truth.** `POST /api/documents` 413s at 6.2MB behind a "Max 10.0 MB" promise (platform body cap ~4.5MB). Either raise the real limit (direct-to-storage upload) or lower the promise to the enforced number — the UI and the enforcement must agree. Do NOT silently keep two numbers.
4. **F8 — parse the failure honestly.** Non-JSON error bodies (413 et al.) must surface as a human message, never `Unexpected token 'R'…`. One guarded response-parse helper at the fetch seam, not per-call patches.
5. **F5 — vendor extraction.** The extractor chose a mis-transcribed document-type word ("Invnice" from "** TAX INVOICE **") over the page-dominant merchant (BUNNINGS). Prefer merchant-position/prominence signals; never emit a value that appears nowhere on the document. Amount/date behaviour is good — do not touch what works (amount was exact; date honestly read).
6. **F4 — one count.** Sidebar "ALL DOCUMENTS" shows exactly 2× the hero/dashboard count and increments +2 per upload. One producer for "total documents"; the tree total must equal the hero total.

**Ring-3 predictions (PR-1):** the stranded Bunnings item becomes editable (vendor/date corrections survive reload), selectable, and approvable; after approve it books as a FY2026-27 expense (EFT date 2026-08-20) · sidebar total ≡ hero total (both = grid count) and +1 per upload · a >4.5MB, <10MB file either uploads or is refused with the SAME limit the UI states, in a human sentence · mustNotMove: pack totals, scoreboard metrics, balances hero.

## PR-2 — the loan-cost truth on kept surfaces (MON-151 + the latent offset thread)

7. **MON-151 (CONFIRMED LIVE, quantified #1612):** property-detail Tax position card computes interest on the FULL balance — Guildford $23,576.09/yr vs canonical offset-netted $4,613.35/yr = **$18,962.73/yr overstated**. Route the card's interest through the canonical offset-aware leg (`resolveLoanCostsForUser` / masterFinancialService semantics). The no-offset control (Broadbeach $1,271.10/mo) must not move.
8. **B1-latent (gate review + #1612):** `/api/properties` ships loans with `offsetBalance` FIELD_ABSENT, so `resolveLoanMonthlyCost`'s `principal − offsetBalance` netting silently no-ops everywhere under `app/dashboard/properties/`. Today the actuals path masks it; any loan whose interest floor binds renders wrong (HECS already shows `flooredToInterest: true`). Thread the offset into the payload; do not fork a second producer (D-22).

**Ring-3 predictions (PR-2):** Guildford tax-position interest moves $23,576.09 → ~$4,613/yr (card net moves ~$2,513 → ~$21,476/yr) · Broadbeach byte-identical · rendered cashflow figures do NOT move (actuals path binds; the thread closes the latent leg only) · balances dialog stays correct (it already nets).

## PR-3 — kept display + sweep highs (batchable, changesNumbers: NO except where marked)

9. **F6:** scoreboard tiles must render loading skeletons while fetching and LoadFailedState on failure — never $0/0.0%/empty-state copy as interim truth (observed against REAL transient 503s).
10. **MON-087 (crash):** property-context Add Expense dialog — Radix `Select.Item` empty value.
11. **MON-171…178 kept items** per the M2.6 catalogue triage: wizard parallel engine (171, changesNumbers YES — align to real engines) · CASH on balances + property attach on cash quick-add (172 + catalogue #40; F-S8 evidence) · HALF_YEARLY 6× (173, YES) · OCR invented 5%/360mo defaults (174) · raw minRepayment beside engine total (175) · convertToAnnual lint-laundering (176) · recurring 4.33/2.17 approximations (177, ruling recorded) · "Net Taxable Income" framing (178).
12. **F9:** help drawer — must not open from the Upload button's click region; X/Escape/outside-click must dismiss.
13. **F10:** basiq/connections 403 on every load — gate the call on the flag state or treat 403 as a quiet state.

**Ring-3 predictions (PR-3):** per item in its PR body, written BEFORE the fix (D-21). The K6 correction stands recorded: the activity money-flow widget renders on both viewports from a non-money-flow producer — PR-3 must NOT "fix" it into the gated /api/money-flow route.

---

**Sequencing law:** PR-1 ships alone and first (Reza is blocked on it). PR-2 next (numbers move; predictions first). PR-3 batches the rest. One brief, one close: M2's kept-depth box closes when all three PRs are VERIFIED — that plus S7 (Reza's fresh-account run, scheduled post-PR-1) discharges B3/B4 of the gate review.
**Out of scope:** anything hidden-module (D-20) · the pack generators question (P-7, awaiting Reza) · Stitch backfill (blocked on tooling) · MON-185 data cleanup (Reza's runbook).
