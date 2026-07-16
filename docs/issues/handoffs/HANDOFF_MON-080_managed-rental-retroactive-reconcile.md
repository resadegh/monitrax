# FIX BRIEF — MON-080 · Managed-rental reconcile is order-dependent (mark-managed doesn't reconcile already-linked deposits)

> **Raise as:** MON-080 · **status:** DIAGNOSED · **severity:** high · **changesNumbers:** true (creates deductions)
> **Blocks:** MON-079 → VERIFIED (Phase 59 acceptance). MON-079 stays FIXING until this ships.
> **Found:** VR-010 follow-on, live Ring-3 with Reza 2026-07-16. **Pinned HEAD** `77527bec` (#1434 merged).
> **Live fixture:** Reza's Broadbeach — managed gross $2,947/mo ($680/wk), net $2,515/mo (2 txns), gap **$432/mo ≈ $5,184/yr** currently **uncaptured**.
> **Rule zero:** re-read anchors live before executing.

## The defect (one paragraph)
Phase 59's suggest-and-confirm deduction card only ever fires from the **transaction-link** route (`app/api/transactions/[id]/link/route.ts:333,568` → `buildManagedRentalSuggestion`). Marking a rental stream `rentalMode='MANAGED'` via the income PATCH route (`app/api/income/[id]/route.ts`) performs **no** reconciliation of disbursements that are **already linked**. So the feature only works in the order *mark-managed → then link*. In the natural order — reconcile deposits as they arrive, later mark the stream agent-managed — the card never appears and the deduction is never created. The user is left with the D4 nudge chip "Missing management-fee deductions?" (`app/dashboard/income/page.tsx:1125`) which is a **passive `<span>` with only a `title` tooltip** (no onClick) — and whose tooltip tells them to "mark this stream as agent-managed", which they already did. Dead end. Confirmed live: Reza's Broadbeach is managed + linked + gap detected (−$432/mo) but the deduction is not captured; the only current escape is to unlink and relink each deposit, which no user would discover.

## Root cause (anchors, pinned 77527bec)
- `app/api/income/[id]/route.ts:126-142` — PATCH sets `rentalMode`/`grossAmount`; **no retroactive reconcile pass**.
- `lib/services/managedRentalService.ts:81` — `buildManagedRentalSuggestion` is only wired into the link route; no caller on the mark-managed transition.
- `app/dashboard/income/page.tsx:1125-1131` — the "Missing management-fee deductions?" chip is a non-interactive `<span>` (tooltip only).

## The fix — remove the order-dependency (CLAUDE.md §23.2.1: kill the cause)
1. **Retroactive reconcile on transition to MANAGED.** In the income PATCH, when a rental stream transitions to `rentalMode='MANAGED'` (with a gross set), run `reconcileManagedRental` over its **already-linked** disbursements (reuse `buildManagedRentalSuggestion`'s context builder — rule, sibling dates, `existingDerived`). If material and no existing derived expense: either (a) surface the suggest-and-confirm on next income-page load, or (b) auto-apply when the user already has a learn-once rule for that agent. Respect the `existingDerived` idempotency guard — **never double-create** a derived expense.
2. **Make the nudge actionable.** `app/dashboard/income/page.tsx:1125` — turn the chip into a button that opens `ManagedRentalReconcileCard` for the stream's already-linked disbursement(s). One-click claim path for the reconcile-first-then-manage order.
3. **Idempotency / no double-count.** The confirm endpoint recomputes via the one engine before persisting (per `ManagedRentalReconcileCard` JSDoc) — ensure the retroactive path routes through the same single producer (§12.2.1) so Float/Decimal parity and the `existingDerived` guard hold.

## Ratchets (Part 5 style)
- **Ring-0:** mark-managed-AFTER-link on a stream with a material gap → a suggestion is produced retroactively (currently returns nothing).
- **Ring-2 (golden):** the two sequences — *manage→link* and *link→manage* — must yield the **identical** derived deduction on the golden household (order-independence invariant).
- **Ring-1 source-lock:** all reconcile paths (link route + retroactive PATCH path) go through `reconcileManagedRental` only.

## Model routing (per Reza's directive)
- **Fable 5** → the income-PATCH retroactive reconcile pass + engine wiring + idempotency (subtle: touches tax deductions + reconciliation engine + the `existingDerived`/learn-once rule interplay).
- **Opus 4.8** → the nudge-chip → card UI wiring (Stitch §8, reuse `ManagedRentalReconcileCard`) + all three ratchets.

## Full circle
Find ✅ (this run) → Trace ✅ (anchors above) → Fix (Fable 5 engine/route + Opus UI) → Model (re-pin any Neomatrix reconcile anchors same PR §21.2.1) → Ratchet (3 rings) → PR (§20.6 10/10) → **Merge = Reza** (changesNumbers + schema-adjacent) → Deploy READY → **Ring-3 = Matrix** on Reza's Broadbeach (mark managed → deduction auto-appears ≈ $432/mo, gross unchanged, no double-count) → MON-080 VERIFIED → unblocks MON-079 → VERIFIED → CLOSED.

## Ring-3 targets (real data — the live fixture)
After the fix, on Reza's already-managed already-linked Broadbeach: the ~$432/mo (~$5,184/yr) management-fee deduction is captured **without any unlink/relink**; Total Deductions rises by the gap; gross rental income unchanged at $2,947/mo; no double-count on Tax / dashboard / CFO.

---
*Prepared by The Matrix. Sources: live `www.monitrax.com.au` (read-only) + pinned code `77527bec`. This is a genuine order-of-operations gap surfaced by Reza during the MON-079 Ring-3.*
