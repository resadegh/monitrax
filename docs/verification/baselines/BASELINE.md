# Ring-3 Regression Baseline

> The Part-F snapshot of the most recent accepted real-data run. Every new run's Part F is diffed against this; every delta must be bucketed **unchanged / expected (data added or fix shipped — Reza confirms) / UNEXPLAINED → new MON-### issue**. See `docs/verification/VERIFICATION_PLAYBOOK.md` §3.4.

**Accepted run:** VR-001 (2026-07-11, production, pre-MON-028-fix). **This baseline captures a KNOWN-BROKEN state** — the annotations below say which values are wrong and what they should become once fixes land. Do NOT treat every value here as correct; treat it as "what the app showed on 2026-07-11".

```json
{
  "asOf": "2026-07-11 (prod, pre-#1359)",
  "netWorth": 3401782,
  "totalAssets": 5461679,
  "totalLiabilities": 2059898,
  "portfolioEquity": 2955102,
  "properties": {
    "LasVegas":      { "cashflowYrDetail": null,   "cashflowYrList": 15000,   "cashflowYrHome": 15000 },
    "Broadbeach":    { "cashflowYrDetail": 50281,  "cashflowYrList": 15879,   "cashflowYrHome": 15876,  "yieldDetail": 10.92, "yieldList": 5.03 },
    "ThornlandLot1": { "cashflowYrDetail": -46897, "cashflowYrList": -74614,  "cashflowYrHome": -74616, "yieldDetail": 7.51,  "yieldList": 4.76 },
    "ThornlandLot2": { "cashflowYrDetail": null,   "cashflowYrList": 3580,    "cashflowYrHome": 3576 },
    "Laguna":        { "cashflowYrDetail": null,   "cashflowYrList": -321280, "cashflowYrHome": -315240 },
    "Guildford":     { "cashflowYrDetail": -47955, "cashflowYrList": null,    "cashflowYrHome": -28308 }
  },
  "totalMonthlyExpenses": 25973,
  "estimatedAnnualTax": 42721,
  "safetyScore": 70,
  "healthScoreHome": 50,
  "healthScoreCfo": 46,
  "emergencyFundMonths": 11.7,
  "savingsRateCfo": 75.4,
  "savingsRateHome": -30.5,
  "balances": { "liquid": 301808, "accessible": 67871, "locked": 3032102 }
}
```

## Annotations — known-broken values in this baseline

| Value | Status | Expected change |
|---|---|---|
| `properties.*.cashflowYrDetail` + `yieldDetail` | **BROKEN (MON-028)** — detail page was declared-only | After #1359: detail converges to the list/Home value (Broadbeach → ~15,879; ThornlandLot1 → ~−74,614; Guildford → ~−28,308) |
| `savingsRateCfo` (75.4) vs `savingsRateHome` (−30.5) vs a 0.0% Home insight | **BROKEN (MON-029)** — three producers | One canonical value everywhere once fixed |
| `healthScoreHome` 50 vs `healthScoreCfo` 46 vs `safetyScore` 70 | **BROKEN (MON-030)** — multiple score producers | One canonical engine (or explicitly distinct, labelled metrics) |
| `balances.liquid` 301,808 vs Safety Net "Liquid savings" 304,304 | **BROKEN (MON-031)** — $2,496 producer gap | One value |
| Laguna list −321,280 vs Home −315,240 | **UNEXPLAINED $6,040/yr gap** — same class as MON-028? To investigate | Converge |
| netWorth identity off by $1 | Tolerance/rounding — watch, don't chase yet | Exact after bucket-producer unification |
| Safety score "Positive Cashflow 15/15" on −$6,073/mo | **BROKEN (MON-017 residual)** | Sub-score reflects reality |
