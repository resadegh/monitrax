# FIX BRIEF — MON-080 · Managed-rental deduction never captured on real data (D0) + activation gaps (D1/D2)

> **Two coupled activation defects + one headline runtime defect in the Phase 59 managed-rental flow — fix together.**
> D0: the reconcile card does NOT fire on a fresh link (deduction never captured — observed live).
> D1: marking managed doesn't reconcile already-linked deposits (order-dependency).
> D2: marking managed never prompts for the true gross when it's undeclared (gross-integrity).

> **Raise as:** MON-080 · **status:** DIAGNOSED · **severity:** CRITICAL (was high) · **changesNumbers:** true (creates deductions)
> **Blocks:** MON-079 → VERIFIED (Phase 59 acceptance). MON-079 stays FIXING until this ships.
> **Found:** VR-010 follow-on, live Ring-3 with Reza 2026-07-16/17. **Pinned HEAD** `77527bec` (#1434 merged).
> **Live fixture:** Reza's Broadbeach — managed gross $680/wk ($2,947/mo), net $2,515/mo (2 txns), gap **$432/mo ≈ $5,184/yr** — **uncaptured; Total Deductions unchanged at $148,519**.
> **Rule zero:** re-read anchors live before executing.

## ⚠️ D0 — the reconcile card does NOT fire on a fresh link either (observed live 2026-07-17)
Escalation from the live Ring-3. On Reza's Broadbeach, after a clean **unlink → relink** of a net deposit to the MANAGED "Rent - Broadbeach" stream (gross $680/wk, deposit $2,515, monthly), **no confirm card appeared and Total Deductions stayed at $148,519** — the deduction is never captured. So the failure is not only order-dependency (D1) — the card does not fire even on a fresh link. Per the guards in `buildManagedRentalSuggestion` (`lib/services/managedRentalService.ts:88-145`) the only non-error way to return null on a fresh link (no rule, no existingDerived) is `!reconciliation.material`. So `reconcileManagedRental` is returning `material=false` for a **WEEKLY-declared gross vs a MONTHLY disbursement** with few linked siblings.

**Diagnosis checklist (Code session):**
1. **Cadence inference** — with `disbursementFrequency=null` (no rule) the period is inferred from `disbursementDates`; at link time only 1–2 siblings are linked, so a MONTHLY cadence may not resolve → wrong `grossPerDisbursementPeriod` → gap not material. Confirm the inference and its behaviour at N=1.
2. **Frequency-mismatch normalisation** — declared gross WEEKLY ($680) must normalise to the disbursement period (monthly $2,947) before the gap; verify `reconcileManagedRental` does this and isn't comparing $680 (weekly) to $2,515 (monthly) → a spurious negative/"immaterial" gap.
3. **Field check** — confirm the reconcile reads the field that actually holds the gross (`income.amount` vs a separate `grossAmount`).
4. **Ratchet** — add a Ring-2 golden fixture of this exact shape (WEEKLY gross, MONTHLY net, ~15% gap) → the confirm card MUST fire and yield ~$432/mo.

This makes MON-080 **critical**: Phase 59's headline capability (capturing the agent-cost deduction) does not work on real data. Fix D0 first; D1/D2 below still stand.

## Defect 1 (D1) — order-dependency
The suggest-and-confirm card only ever fires from the **transaction-link** route (`app/api/transactions/[id]/link/route.ts:333,568` → `buildManagedRentalSuggestion`). Marking a stream `rentalMode='MANAGED'` via the income PATCH route (`app/api/income/[id]/route.ts`) performs **no** reconciliation of already-linked disbursements. The D4 nudge chip "Missing management-fee deductions?" (`app/dashboard/income/page.tsx:1125`) is a **passive `<span>`** (tooltip only) whose tooltip says "mark this stream as agent-managed" — which the user already did. Dead end.

## Defect 2 (D2) — no gross-integrity prompt when the real rent is undeclared
The managed toggle (`app/dashboard/income/page.tsx:1620-1665`) only shows helper copy "Enter the full rent above" + an optional agent-name field; it assumes the amount is already the gross and never validates it. A stream auto-created from a **net** deposit has `amount = net` → marking it MANAGED leaves gross = net → gap 0 → no deduction AND assessable income understated (ATO assesses gross, s6-5). The Edit modal has no amount field, so the gross can't even be entered mid-stream.

## The fix — D0 first, then remove order-dependency (D1) + enforce gross integrity (D2)
1. **D0: make the card actually fire.** Fix the cadence/normalisation so a material WEEKLY-gross vs MONTHLY-net gap produces a card on link. Ring-2 golden fixture as above.
2. **Retroactive reconcile on transition to MANAGED (D1).** In the income PATCH, when a stream transitions to MANAGED, run `reconcileManagedRental` over its already-linked disbursements (reuse the context builder — rule, sibling dates, `existingDerived`); surface the suggest-and-confirm or auto-apply via the learn-once rule. Respect the `existingDerived` idempotency guard — never double-create.
3. **Make the nudge actionable (D1).** Turn the `app/dashboard/income/page.tsx:1125` chip into a button that opens `ManagedRentalReconcileCard` for the already-linked disbursement(s).
4. **Idempotency / no double-count.** Route the retroactive path through the same single producer (§12.2.1) so Float/Decimal parity and the `existingDerived` guard hold.
5. **Gross-integrity prompt (D2).** On transition to MANAGED, if no gross distinct from the deposits exists (`amount` ≈ mean net), require the real gross before saving: "It looks like you haven't entered the actual rent for <property> — what's the full rent before your agent's fees?" **Pre-populate with the currently declared amount + frequency when one exists — editable — a confirm-or-correct, never a blank re-entry.** Expose that field in the Edit modal too. Never let a stream sit MANAGED with gross = net.

## Ratchets (Part 5 style)
- **Ring-0 (D0):** WEEKLY-gross + MONTHLY-net, ~15% gap, N=1 linked disbursement → card fires, gap ~$432/mo.
- **Ring-0 (D2):** marking MANAGED with `amount === net deposit` must block/prompt; when a gross exists the prompt pre-fills it.
- **Ring-0 (D1):** mark-managed-AFTER-link on a material-gap stream → suggestion produced retroactively.
- **Ring-2 (golden):** *manage→link* and *link→manage* yield the **identical** derived deduction (order-independence).
- **Ring-1 source-lock:** all reconcile paths go through `reconcileManagedRental` only.

## Model routing (per Reza's directive)
- **Fable 5** → D0 cadence/normalisation fix + the income-PATCH retroactive pass + engine wiring + idempotency + the D2 gross gate (subtle: tax deductions + reconciliation engine + assessable-income correctness).
- **Opus 4.8** → the nudge-chip → card UI, the D2 gross prompt (pre-populated) + Edit-modal amount field, and the ratchets.

## Full circle
Find ✅ → Trace ✅ → Fix (Fable 5 engine/route + Opus UI) → Model (re-pin Neomatrix reconcile anchors same PR §21.2.1) → Ratchet → PR (§20.6 10/10) → **Merge = Reza** → Deploy READY → **Ring-3 = Matrix** on Reza's Broadbeach (link → card fires → deduction ≈ $432/mo, gross unchanged $2,947/mo, no double-count) → MON-080 VERIFIED → unblocks MON-079 → VERIFIED → CLOSED.

## Ring-3 targets (real data — the live fixture)
On Reza's Broadbeach: linking a net deposit to the managed stream fires the card and captures ~$432/mo (~$5,184/yr); Total Deductions rises from $148,519 by the gap; gross rental income unchanged at $2,947/mo; no double-count on Tax / dashboard / CFO. D1: marking managed reconciles already-linked deposits with no unlink/relink. D2: a net-only stream marked MANAGED is blocked until the real gross is entered (pre-filled when known).

---
*Prepared by The Matrix. Sources: live `www.monitrax.com.au` (read-only for observation; the reconcile writes were Reza-driven) + pinned code `77527bec`. Three managed-rental defects surfaced by Reza during the MON-079 Ring-3.*
