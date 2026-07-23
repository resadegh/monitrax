# CODE BRIEF (Fable 5) — MON-096: the MON-093 cadence chip false-fires on MANAGED rentals

**Paste into a fresh Claude Code session on FABLE 5** (property/rental semantics; display-only, **changesNumbers: no**). One small, safe fix. Raise MON-096 first (`npm run issues:raise`), then fix in the same PR.

## Why (Reza's live finding, 2026-07-23)
Broadbeach rent is correctly declared **$680/week gross**, **managed** (payment path "Through a property manager", agent fee $432/mo derived). The agent collects weekly and **disburses monthly** (net ~$2,515/mo). Everything reconciles: $680/wk = $2,947/mo gross − $432 fee = $2,515/mo net. **The data is correct.**

But the property page shows the amber MON-093 chip: *"declared weekly, but payments look monthly — check the row's frequency."* For a **managed** rental this is a **false positive** — a weekly lease arriving as monthly agent disbursements is the *normal, expected* state, not a mis-declared row. Telling the user to "check the frequency" is misleading; there is nothing to fix.

## Root cause (verified at HEAD `dea8eee`)
`lib/calculations/propertyCashflow.ts:316-323` computes `rentCadenceSuspect` purely from *declared frequency ≠ detected-payment frequency*:
```
const declaredRentFrequency = rentalRows[0]?.frequency ?? null;
const rentCadenceSuspect =
  rent.usedActuals && rent.detectedFrequency && rent.detectedFrequency !== 'IRREGULAR' &&
  declaredRentFrequency && String(declaredRentFrequency).toUpperCase() !== rent.detectedFrequency
    ? { declared: ..., detected: ... } : null;
```
It **never consults `rentalMode`** — even though the input rows carry it (`:48 rentalMode?: string | null`, already used for the MANAGED gross-up at `:249`). For a MANAGED stream the bank actuals are the agent's monthly *net* payout, so `detectedFrequency` is (correctly) MONTHLY while the declared lease cadence is WEEKLY → the chip fires by construction for every managed weekly/fortnightly lease.

## The fix (one line of intent, in the ONE producer)
Suppress `rentCadenceSuspect` when the contributing rental stream is **MANAGED** — the lease cadence legitimately differs from the disbursement cadence there. Add to the guard:
```
&& !rentalRows.some((r) => r.rentalMode === 'MANAGED')
```
(or gate on the contributing rows if a property can mix DIRECT + MANAGED streams — check `rentalRows` for any MANAGED and suppress for that stream). DIRECT/STATEMENT streams keep the chip (the Broadbeach ×4 class MON-093 guarded was a DIRECT mis-declaration — that protection must stay).

**Optional (recommended) — don't go silent, reassure:** for a MANAGED stream where declared ≠ detected, render a NEUTRAL (non-amber) subtitle instead of the warning, e.g. *"declared weekly · paid monthly by your agent (normal for managed rentals)"*. This turns a false alarm into a correct explanation. Keep the property page consumer (`app/dashboard/properties/[id]/page.tsx:728-735`) reading a single field — extend `rentCadenceSuspect` to `{ declared, detected, managed: boolean }` or add a sibling `rentCadenceManaged` flag so the page picks warning vs neutral copy; do not compute mode in the page (§12.2.1 — one producer).

## Guardrails
- **changesNumbers: no** — display only; `monthlyRent`/`annualRent`/tax untouched. No money number may move (regression: Broadbeach $2,947/mo, $35,360/yr, 5.89%, tax $14,921, net $2,515 all unchanged).
- **Ratchet:** golden/unit on `computePropertyCashflow` — a MANAGED weekly-declared stream with monthly actuals → `rentCadenceSuspect` is null (or `managed:true`); a **DIRECT** weekly-declared stream with monthly actuals still flags (the MON-093 class stays guarded); a DIRECT stream whose cadences agree → no flag. This is the RED-on-pre-fix test.
- **Neo-sync:** the `rentCadenceSuspect` node gains the rentalMode input; NeoAudit gets the golden; nothing sandbox-only.
- §20.6 10/10; **Reza merges** (though no numbers move, it changes a user-facing warning).

## After merge → Matrix re-check (VR-0NN)
The Matrix re-opens Broadbeach live: the amber "check the row's frequency" chip is **gone** (or replaced by the neutral managed-rental note); all money numbers unchanged; a DIRECT mis-declared test property (if any) still shows the warning. MON-096 → VERIFIED.

---
*Prepared by The Matrix from Reza's live check (his data is correct; the chip was the bug). Display-only, MANAGED-aware suppression in the ONE cashflow producer; MON-093's DIRECT protection preserved.*
