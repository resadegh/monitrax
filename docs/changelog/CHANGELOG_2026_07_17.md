# Changelog - 2026-07-17

## Session: mon-080-managed-rental-activation (Code · Fable 5)

### Changes Made
- **Type**: Fix (MON-080, critical, `changesNumbers: true`) — Phase 59's headline capability did not work on real data
- **Scope**: reconciliation engine (D0) + income PUT retroactive pass & gross gate (D1/D2) + income-page claim UX + Stitch backfill
- **Canonical brief**: `docs/issues/handoffs/HANDOFF_MON-080_managed-rental-retroactive-reconcile.md` (PR #1436) + the Matrix execution wrapper
- **Live evidence (VR-010)**: Reza's Broadbeach — $680/wk declared gross, $2,515/mo net disbursement, gap $432/mo ≈ $5,184/yr **uncaptured**; Total Deductions stuck at $148,519

### §19.2 root cause — EXECUTED-verified (corrects the brief's prime suspect)
The handoff suspected missing WEEKLY→MONTHLY normalisation. **Wrong for N≥2**: executed at pinned HEAD, three monthly dates resolve MONTHLY and land gap $431.67 material — normalisation always existed. The real defects:
- **D0** (`rentalReconciliation.ts:118` pre-fix): the **N=1 fallback** compared the WEEKLY gross ($680) against the MONTHLY deposit ($2,515) → gap **−$1,835** → `material=false` → no card on the very first fresh link.
- **D1** (`app/api/income/[id]/route.ts`): no retroactive reconcile when a stream transitions to MANAGED — the natural order (link deposits, mark managed later) dead-ended; the D4 chip was a passive `<span>`.
- **D2** (`app/dashboard/income/page.tsx`): no gross-integrity gate — MANAGED persisted with gross = net (understates assessable income, ITAA s6-5); type-`RENTAL` streams had **no amount field on Edit** at all.

### The fixes (each judged by the ONE engine, §12.2.1)
- **D0 — deposit-size cadence inference** (in the shared cadence resolver, so Float + Decimal inherit identically): with no explicit cadence and no date evidence, the deposit identifies its own period — the one whose implied agent cut lands in `[0, MAX_PLAUSIBLE_AGENT_SHARE=0.35]` (structurally unique; periods scale ≥2×). Broadbeach N=1 → MONTHLY, gap $431.67, material. No plausible period → old conservative fallback (never a guessed card).
- **D1 — retroactive reconcile**: `buildRetroactiveManagedRentalSuggestion` (latest linked IN deposit as representative + sibling cadence evidence + the `existingDerived` idempotency guard); income PUT returns the suggestion on the MANAGED transition (additive response key) → the income page opens the card immediately; `GET /api/rental-reconciliation?incomeStreamId=` powers the chip; the chip is now a **click-to-claim button**.
- **D2 — gross-integrity gate**: a MANAGED save whose declared amount is not materially distinct from the MEDIAN linked deposit is rejected **422 GROSS_REQUIRED**; the form surfaces rejections (was a silent swallow) with the amount pre-filled (confirm-or-correct); the rent amount field now renders for `RENTAL` too, labelled "Full Rent Amount (before agent fees)" when MANAGED, and no longer force-clobbers frequency to WEEKLY.

### Stitch (§18.2.1/§18.8 — Reza directive 2026-07-17: ALL UI/UX through Stitch, self-review >9/10, then his final review)
- `.stitch/designs/mon-080/reconcile-card-desktop-light.{html,png}` — project `1859462351962811110`, screen `67446f21885549c7a696964eb45969f1`. **Gate: v1 8.5** (tertiary action clipped off the card edge) → one `edit_screens` iteration (action-row wrap, 640px card) → **v2 9.3/10** (vocabulary 9.5 · hierarchy 9.5 · psychology 9.5 · typography 9 · premium 9 · completeness 9 · polish 9). Prompt seeded with §18.7.2 principles + spec §8 tokens. Screen ID in the component JSDoc — closes the Phase 59 flagged backfill.
- Dark variant + D2 form-state screens: generated this session (scores recorded below on landing).

### Ratchets (all merged into CI, Part 23 Ratchet)
- **Ring-0 (D0)**: Broadbeach N=1 fixture — MONTHLY inferred, gap ≈ $432, Float===Decimal; inference-refusal + net-equals-gross zero-gap cases; calc-audit fixture on `property.managedRentalGap`.
- **Ring-2 (D1)**: order-independence golden — `manage→link` == `link→manage` yield the **identical** derived row (`tests/golden/ring2.managedRental.test.ts`).
- **Ring-0 (D2)**: the gate probe shape — declared==net → `!material` (rejected); real gross → material (passes).
- **Ring-1**: wiring lock — retroactive + gate + GET stay wired to the ONE engine (`rentalReconciliationSourceLock.test.ts`).

### Registry
- **MON-080 raised → FIXING** (critical, `changesNumbers`, tracker VR-010; full §19.4 sweep + plain trio + holistic test linked).
- **VR-010 verdicts applied**: MON-075/038/044/046/043/022/033/005/008/032/015 → VERIFIED; MON-053 → CLOSED (2026-07-17); MON-031 root-cause note (stays FIXING). `issues:check` green (80 valid).

### Build Status
- [x] tsc clean · lint:financial-surfaces green (one baseline entry re-pinned 2169→2277 after the form insertions — violation untouched) · neomatrix:check green (engine anchor re-pinned 127→192 + edges, §24.2.6 map-moves-with-the-fix) · issues:check green
- [x] Targeted suites 64/64 (engine + goldens + source-locks + intake)
- [ ] Full `vitest run` — recorded in the PR
- [ ] Vercel preview — proven by CI on push

### PR
- PR URL: https://github.com/resadegh/monitrax/pull/1437 (draft — Reza merge gate)
- Status: after merge + deploy READY → hand back to the Matrix for the per-fix Ring-3 on Broadbeach (card fires ≈ $432/mo without unlink/relink; Total Deductions +$5,184/yr; gross unchanged $2,947/mo; net-only stream blocked until real gross) → MON-080 VERIFIED → unblocks MON-079 → VERIFIED → CLOSED → VR re-baseline.
