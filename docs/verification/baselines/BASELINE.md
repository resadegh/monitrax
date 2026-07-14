# Ring-3 Regression Baseline

> The Part-F snapshot of the most recent accepted real-data run. Every new run's Part F is diffed against this; every delta must be bucketed **unchanged / expected (data added or fix shipped — Reza confirms) / UNEXPLAINED → new MON-### issue**. See `docs/verification/VERIFICATION_PLAYBOOK.md` §3.4.

**Accepted run:** VR-006 (2026-07-14, production, fully-merged deploy incl. #1405/#1406, comprehensive two-phase sweep — `coverage.everyEntityOpened: true`). This baseline captures the **post-MON-035/036/037-fix state**: HOME cashflow converged across all surfaces (−$8,668), one-offs excluded from the run-rate, tax recalculated. MON-035/036/037/040/041/048 verified here. Remaining known-open items are annotated below — do NOT treat those as correct; they are tracked in the registry.

> Supersedes VR-003 (pre-fix: HOME −$321,280, Thornland Lot 1 −$74,614, estimatedAnnualTax $42,721). The large cashflow/tax deltas VR-003→VR-006 are **expected** — they are the MON-035 (one 12-month window) + MON-037 (one-off exclusion) + loan-interest-floor fixes landing.

```json
{
  "asOf": "2026-07-14 (prod, post-fix, VR-006)",
  "netWorth": 3401782,
  "totalAssets": 5461679,
  "totalLiabilities": 2059898,
  "portfolioEquity": 2955102,
  "properties": {
    "LasVegas":      { "cashflowYrDetail": 15000,  "cashflowYrList": 15000,  "cashflowYrHome": 15000,  "yieldDetail": 3.95, "yieldList": 3.95 },
    "Broadbeach":    { "cashflowYrDetail": 15879,  "cashflowYrList": 15879,  "cashflowYrHome": 15876,  "yieldDetail": 5.03, "yieldList": 5.03 },
    "ThornlandLot1": { "cashflowYrDetail": -31068, "cashflowYrList": -31068, "cashflowYrHome": -31068, "yieldDetail": 4.76, "yieldList": 4.76 },
    "ThornlandLot2": { "cashflowYrDetail": 3580,   "cashflowYrList": 3580,   "cashflowYrHome": 3576,   "yieldDetail": 3.76, "yieldList": 3.76 },
    "HOME":          { "cashflowYrDetail": -8668,  "cashflowYrList": -8668,  "cashflowYrHome": -8664,  "yieldDetail": 0.12, "yieldList": 0.12 },
    "Guildford":     { "cashflowYrDetail": -7387,  "cashflowYrList": null,   "cashflowYrHome": -7392,  "yieldDetail": null, "yieldList": null }
  },
  "totalMonthlyExpenses": 25973,
  "estimatedAnnualTax": 194218,
  "safetyScore": 63,
  "healthScoreHome": 50,
  "healthScoreCfo": 50,
  "healthGradeHome": "C",
  "healthGradeCfo": "C",
  "emergencyFundMonths": 11.7,
  "savingsRateCfo": -30.5,
  "savingsRateHome": -30.5,
  "balances": { "liquid": 301808, "accessible": 67871, "locked": 3032102 },
  "vehicleCountHousehold": 4,
  "vehicleCountAssets": 5
}
```

## Annotations — known-open values in this baseline (tracked in the registry)

| Value | Status | Expected change once fixed |
|---|---|---|
| `Guildford.cashflowYrList` null (list tile omits the line; detail −7,387 / Home −7,392 show it) | **OPEN (MON-039c)** — cross-surface render | list tile shows −7,387 like the other two |
| Medicare absent on `/cashflow` + CFO tax cards (itemised only on `/dashboard/tax` = $9,706) | **OPEN (MON-039a)** | Medicare line on both tax summary cards |
| `/cashflow` "MONEY IN $0" beside "1 income source fed this month" | **OPEN (MON-039b)** | copy distinguishes actuals from declared source count |
| CFO "Neg. Gearing Benefit $157,746" ~4× total deductions $39,554 | **DIAGNOSED (MON-045, HIGH)** — Option 1 approved, awaiting build | benefit < total deductions; deductions include loan interest |
| `estimatedAnnualTax` $194,218 (declared-gross basis; excludes auto loan interest) | Tracked via **MON-045** | falls once property loan interest is auto-deducted |
| Household "4 vehicles" (declared) vs Assets 5 (incl. excavator) | **OPEN (MON-042)** — fork | consistent, or relabelled scope |
| Income Home $239K "Last 12 months" (actuals) vs Tax $524,831 declared gross ("Other" $192,698 declared-only) | **OPEN (MON-043)** — fork; numbers correct per basis | basis label surfaced; optional data-completeness nudge |
| Docs: Settings "24 · 12MB" vs Vault "6 · 14.0 MB" | **OPEN (MON-049)** | one consistent count + storage |
| Month-end balance CFO $301,712 vs cashflow forecast $301,639 (Δ$73) | **OPEN (MON-050)** | one forecast figure |
| netWorth identity off by $1 (Liquid+Accessible+Locked 3,401,781 vs 3,401,782) | Tolerance/rounding — watched, not chased | Exact after bucket-producer unification |
| HOME shows yield 0.12% | **Not a bug** — HOME is tagged INVESTMENT PROPERTY (name is misleading; Guildford is the primary residence) | n/a |
