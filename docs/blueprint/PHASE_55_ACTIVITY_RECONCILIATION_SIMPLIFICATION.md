# Phase 55 — Activity / Transaction-Reconciliation Simplification

> **Origin (Reza, 2026-06-26):** the Activity page showed *"a lot of mixed and incorrect messaging… we need to simplify this section as it is very confusing for the user, even myself."* Approved the **3-state model** below the same day.
>
> **TRAIL stage:** Track (My Accounts). **Domain:** Neobrain (the *presentation* of Neobrain's categorisation/transfer output). **Status:** design approved + SSOT logic shipped; UI wiring in progress.

---

## 1. Problem — five overlapping signals per row

A transaction row rendered up to **five independent status signals that measure different things** but looked like equal-weight pills, so they contradicted each other:

| Signal | Source field | What it actually meant |
|---|---|---|
| Confidence band (High/Med/Low) | `confidenceScore` | how sure the AI was |
| "✓ Looks right" chip | (an action) | a button to confirm — *not a status* |
| Category pill ("OTHER"/"Uncategorised") | `categoryLevel1` | the raw stored category string |
| "Confirmed" / "Not confirmed yet" | `userCorrectedCategory` | whether the user signed off |
| Link / transfer state | `incomeId`/`expenseId`/`isTransfer` | what the row is tied to |

Because these are **orthogonal**, a single row could legitimately be *AI-categorised* **and** *not user-confirmed* **and** *linked to income* all at once — and the UI showed all three as competing pills. The four issues Reza reported are all this one root cause:

- **#1** "Showing uncategorised first" is a **sort label**, but it persisted over the High/confirmed band → header contradicts the rows; and the bands are confidence jargon.
- **#2** Salary showed **"OTHER"** because the pill read raw `categoryLevel1`, while the *truth* (linked to an Income entry) lived in a different field → the pill ignored the stronger signal.
- **#3** "Looks right" (action) + "Uncategorised" (category) + "Not confirmed yet" (state) on one row, styled identically → reads as gibberish.
- **#4** A loan repayment marked `isTransfer=true` still showed "Uncategorised" (its `categoryLevel1` was null — the pill read the raw field, not the transfer state). Stale pre-fix rows compound it.

## 2. Why it matters (four-lens synthesis)

A reconciliation screen has exactly one job: tell the user *"is this done, or does it need me?"* The old screen forced them to reconcile five signals per row — adding cognitive load at the precise moment a user is already avoiding their finances (behaviour-psychology lens: financial stress already costs ~13 IQ points; the tool must give them back, not take more). It's a trust problem, not a polish problem — Reza couldn't parse his own product.

## 3. The model — ONE derived status per row

Every row computes **one** status from the underlying fields. SSOT: `lib/bookkeeping/transactionStatus.ts` → `deriveRowStatus(tx)`, read by **both** the row and the summary header (CLAUDE.md §12.2 — the two can never disagree again).

### 3.1 Two derivation rules that kill the contradictions

**Rule A — the label is the STRONGEST signal, not raw `categoryLevel1`** (priority order):
1. `isTransfer` → **"Transfer"**
2. `incomeId` → **"Income"**
3. `expenseId` → its category, else **"Expense"**
4. `categoryLevel1` → the category
5. else → **"Uncategorised"**

*(Fixes #2 — a salary linked to income reads "Income", never "OTHER". Fixes #4's display — a transfer reads "Transfer" even when its stored `categoryLevel1` is null, so the fix doesn't even wait on the data backfill.)*

**Rule B — exactly one of three mutually-exclusive states, with at most ONE action:**

| State | When | Row shows | Action |
|---|---|---|---|
| **✅ Done** | `userCorrectedCategory` OR `isTransfer` OR linked (`incomeId`/`expenseId`) | the derived label + a quiet emerald check; **recedes** | none |
| **🟡 Suggested** | has `categoryLevel1`, not yet confirmed | the suggested category + **one** sky→indigo "Confirm" | Confirm |
| **⚪ Needs a category** | no category, not linked, not transfer | "Uncategorised" | Add category |

*(Fixes #3 — no row ever shows "Looks right" + "Uncategorised" + "Not confirmed yet" at once. One status, one action.)*

### 3.2 The header reframe (fixes #1)

The top summary stops being **confidence bands** (High/Med/Low — AI jargon that contradicted the confirm-state) and becomes the **action-state progress story**, computed by `summariseRowStates()`:

> **"238 done · 12 to confirm · 116 need a category"** + a 3-segment progress bar (emerald done / sky to-confirm / slate remainder).

The filter chips match the three states. The misleading **"Showing uncategorised first"** banner is removed when a state chip is active (a sort is not a filter). `confidenceScore` becomes an internal sort key only — never a user-facing label.

## 4. The visual (Stitch — §18.2.1 design-of-record)

Glass vocabulary per §18.7.2 (warm-ivory / deep-navy ground, `bg-card/70` backdrop-blur, hairline borders, layered float shadow, Inter + `tabular-nums`, emerald = money-positive/done, rose = spend, slate = transfer, sky→indigo = the single per-row action). Done rows recede; actionable rows get a 2px sky left-edge accent + faint lift so the eye lands on "what wants me."

- **Project:** `1859462351962811110`
- **Desktop light:** screen `8a9b44bd20a04ad8aa2fc94047815cc4` — `.stitch/designs/phase55/activity-reconciliation-desktop-light.{html,png}`
- **Desktop dark:** screen `5f21123f07804c939297b24d2896150d` — `.stitch/designs/phase55/activity-reconciliation-desktop-dark.{html,png}`
- **§18.8 quality gate:** light v1 9.0 → v2 9.2 (deeper glass + brand-gradient action + contrast-of-attention + 3-colour bar); dark 9.3. Both > 9.
- **Mobile:** follows §18.7.6 Compact Dashboard — the KPI/summary reflows; the **row list stays vertical** (rows are destinations, never a carousel). No new composition → governed by §18.7.6, not a separate Stitch screen.

## 5. Implementation

| Piece | File | Notes |
|---|---|---|
| **SSOT status helper** | `lib/bookkeeping/transactionStatus.ts` | `deriveRowStatus()` + `summariseRowStates()`. Pure, framework-agnostic. Tests: `tests/bookkeeping/transactionStatus.test.ts` (8 cases, one per issue). |
| **Row status cluster** | `app/dashboard/activity/page.tsx` (TransactionRow) | replace the 5 competing signals with: derived label pill + one action (`Confirm`/`Add category`) + quiet done-check. Keep the icon, swipe gestures, layout. |
| **Header / banner** | `app/dashboard/activity/page.tsx` | action-state counts via `summariseRowStates`; relabel bands; drop the misleading sort banner when a state chip is active. |
| **Stale-transfer backfill** | one-time guarded update | `UnifiedTransaction` where `isTransfer=true AND categoryLevel1 IS NULL` → apply the confirmed-transfer field-set (Phase-54.1 helper). §12.11-safe (only already-marked transfers, metadata only). |

## 6. Risks / considerations

- Reframing bands "confidence → action-state" is a real IA shift — it's the right call (confidence is AI-jargon that caused half the confusion) and is design-approved.
- The backfill is a prod data write — show the exact `where`/`set` before running (§12.11).
- The display fix (Rule A) makes stale `isTransfer` rows read "Transfer" immediately, so the backfill is data-cleanliness (so cashflow/exports see the category), not a display dependency — lower urgency, still done.

## 7. Reviewer enforcement

Reject any change that re-introduces a second status signal on the row outside `deriveRowStatus`, shows a raw `categoryLevel1` where the stronger signal (transfer/link) should win, or surfaces "confidence" wording to the user. The helper is the one source.
