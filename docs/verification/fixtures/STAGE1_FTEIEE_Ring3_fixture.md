# MATRIX — Stage 1 (FTE/IEE capture) Ring-3 fixture spec

**From:** The Matrix · **For:** the Code session (build the triggering golden to THESE numbers) + the Matrix's own Stage-1 Ring-3. **Source:** MON-098 engine (`classifyFteIeeDistributions`, FTDT/TFN 47%) + the capture-feature brief (`6b2ded9c`) + MON-100 reachability. **Consistent with the MON-098 ratchet values (FTDT $47,000-on-$100,000; withholding $37,600-on-$80,000; IEE exemption).**

## Why this exists
Reza has **no FTE-electing trust** (ReNew Holding = company, Renew Super = SMSF), so the FTDT/TFN fire path can't be proven on his live data — only inertness can. This spec pins the **exact seeded-trust golden** so (a) Code builds the CI triggering test to numbers the Matrix would assert live, and (b) if a triggering entity is ever seeded, the Ring-3 is deterministic. Safe-default reminder: **absent capture = overlay inert = byte-unchanged** — this fixture only fires because every field below is explicitly entered.

## Seeded entity — "Matrix Test Trust" (family-trust election IN FORCE, FY2026-27)
`hasFamilyTrustElection = true`. Test individual = the trust's specified individual. Five beneficiaries exercising every branch:

| # | Beneficiary | `relationship` | Distribution | `hasQuotedTfn` | `coveredByIee` | Expected engine result |
|---|---|---|---|---|---|---|
| B1 | Inside, TFN ok | `FAMILY_MEMBER` | $100,000 | true | — | No FTDT, no withholding (inside family + TFN) |
| B2 | **Outside family** | `OUTSIDE_FAMILY` | $100,000 | true | false | **FTDT 47% = $47,000** (Sch 2F s271-15) |
| B3 | **No TFN** | `FAMILY_MEMBER` | $80,000 | **false** | — | **TFN withholding 47% = $37,600** (Pt VA) — applies regardless of family status |
| B4 | Outside but **IEE-covered** | `OUTSIDE_FAMILY` | $50,000 | true | **true** | **No FTDT** — IEE validly extends the family group |
| B5 | **Not entered** | `null` | $60,000 | `null` | — | **UNCOMPUTED** — `UC-FTDT-OUTSIDE-FAMILY` / `UC-FTE-CONTROL-TEST` surfaced, NEVER defaulted to a firing (or a zero) state |

## Expected aggregate (the golden the Code test must assert)
- **Total FTDT: $47,000** (B2 only).
- **Total TFN withholding: $37,600** (B3 only).
- **IEE exemption applied** on B4 (no FTDT despite OUTSIDE_FAMILY).
- **UNCOMPUTED flags present** for B5 (surfaced with citation; not zeroed, not fired).
- **Float === Decimal** on every line.
- Non-firing beneficiaries (B1) contribute **$0** adjustment.

## Matrix Ring-3 assertions (VR-0NN, after Stage 1 merges)
**On the seeded trust's entity view (`/dashboard/tax` entity + `/api/tax/entity/[trustId]` via the MON-100 orchestrator route):**
1. An **FTDT line = $47,000** with citation (ITAA 1936 Sch 2F s271-15) appears.
2. A **TFN-withholding line = $37,600** with citation (Pt VA) appears.
3. B4 shows **no FTDT** (IEE note); B5 shows the **UNCOMPUTED** flag, not a dollar.
4. `crossCutting.fteIeeByEntity` now present in the entity response (Stage 0 passthrough activates because overlay keys exist).
5. **Cross-surface convergence:** the trust's position (with FTDT/withholding) reads identically on the tax page ≡ /cashflow ≡ CFO — the one orchestrator producer (MON-020 + MON-100).

**Inertness lock (Reza's real data — the live half I can actually run):**
6. Household cluster **byte-identical** to baseline: Income $317,751 / Deductions $172,325 / Taxable $145,426 / Owing $26,926 / Net $38,054 / Medicare $2,909.
7. **No FTDT line, no TFN-withholding line, no `crossCutting` key** on any of Reza's surfaces or his real entities (personal / ReNew Holding / Renew Super) — none has an FTE election, so the overlay stays inert.
8. Any unexplained movement on Reza's numbers = **FAIL**, raise immediately.

## Guardrail checks (fold into the run)
- **Safe default:** flip the seeded trust's `hasFamilyTrustElection` to false (or blank all three fields) → the FTDT/withholding lines vanish and its position returns byte-identical to pre-capture. Proves capture is the ONLY thing that fires it.
- **SSOT:** the FTDT/withholding figures are produced once by `entityTaxFactsAssembler → input.fteIeeByEntity → classifyFteIeeDistributions`; no surface re-derives (Ring-1 source-lock).
- **Reform/config:** the 47% rate traces to the engine config, not a capture-layer literal.

---
*Prepared by The Matrix. The FTDT $47,000 / withholding $37,600 golden matches the MON-098 ratchet; Code builds the Stage-1 triggering test to these numbers so the Matrix Ring-3 (fire path on the seeded trust + inertness on Reza) is deterministic. Reza stays byte-identical by construction — he has no FTE-electing trust.*
