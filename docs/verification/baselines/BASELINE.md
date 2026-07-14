# Ring-3 Regression Baseline

> The Part-F snapshot of the most recent accepted real-data run. Every new run's Part F is diffed against this; every delta must be bucketed **unchanged / expected (data added or fix shipped — Reza confirms) / UNEXPLAINED → new MON-### issue**. See `docs/verification/VERIFICATION_PLAYBOOK.md` §3.4.

**Accepted run:** VR-003 (2026-07-14, production, POST-fix, comprehensive two-phase sweep — `coverage.everyEntityOpened: true`). This baseline captures the **post-fix state**: MON-028/029/030/017 verified. Remaining known-open items are annotated below — do NOT treat those as correct; they are tracked in the registry.

```json
{
  "asOf": "2026-07-14 (prod, post-fix, VR-003)",
  "netWorth": 3401782,
  "totalAssets": 5461679,
  "totalLiabilities": 2059898,
  "portfolioEquity": 2955102,
  "properties": {
    "LasVegas":      { "cashflowYrDetail": 15000,   "cashflowYrList": 15000,   "cashflowYrHome": 15000,   "yieldDetail": 3.95, "yieldList": 3.95 },
    "Broadbeach":    { "cashflowYrDetail": 15879,   "cashflowYrList": 15879,   "cashflowYrHome": 15876,   "yieldDetail": 5.03, "yieldList": 5.03 },
    "ThornlandLot1": { "cashflowYrDetail": -74614,  "cashflowYrList": -74614,  "cashflowYrHome": -74616,  "yieldDetail": 4.76, "yieldList": 4.76 },
    "ThornlandLot2": { "cashflowYrDetail": 3580,    "cashflowYrList": 3580,    "cashflowYrHome": 3576,    "yieldDetail": 3.76, "yieldList": 3.76 },
    "HOME":          { "cashflowYrDetail": -321280, "cashflowYrList": -321280, "cashflowYrHome": -315240, "yieldDetail": 0.12, "yieldList": 0.12 },
    "Guildford":     { "cashflowYrDetail": -28303,  "cashflowYrList": null,    "cashflowYrHome": -28308,  "yieldDetail": null, "yieldList": null }
  },
  "totalMonthlyExpenses": 25973,
  "estimatedAnnualTax": 42721,
  "safetyScore": 63,
  "healthScoreHome": 50,
  "healthScoreCfo": 50,
  "healthGradeHome": "C",
  "healthGradeCfo": "C",
  "emergencyFundMonths": 11.7,
  "savingsRateCfo": -30.5,
  "savingsRateHome": -30.5,
  "balances": { "liquid": 301808, "accessible": 67871, "locked": 3032102 }
}
```

## Annotations — known-open values in this baseline (tracked in the registry)

| Value | Status | Expected change once fixed |
|---|---|---|
| `HOME.cashflowYrHome` −315,240 vs detail/list −321,280 (Δ6,040) | **OPEN (MON-035)** — Home-tile-only producer | Home tile ×12 converges to −321,280 |
| `HOME.yield` (Home tile 0.9% vs detail/list 0.12%) | **OPEN (MON-036)** | one yield on every surface |
| `HOME`/`ThornlandLot1`/`Guildford` expense-card inflation (Battery ×2 + one-offs as monthly) | **OPEN (MON-037, critical)** — drives HOME −321,280, inflated tax deductions ($367,440), `totalMonthlyExpenses` basis split | HOME cashflow rises; deductions/tax fall to real; expense cards de-inflate |
| Safety Net liquid 304,304 vs Balances liquid 301,808 (Δ2,496) | **FIXING (MON-031)** | one liquid figure |
| Tax recommendations "save 3685%" / $6.27M | **OPEN (MON-040)** | plausible figures |
| Vehicle depreciation −200% / −66.7% (appreciation mislabelled) | **OPEN (MON-041)** | appreciation shown correctly, % in range |
| Household "4 vehicles" vs Assets 5 | **OPEN (MON-042)** | consistent count |
| Income Home 239K vs Activity 484K vs Tax 524,831 | **OPEN (MON-043)** | one figure or labelled bases |
| CFO refinance offered on 104% LVR loan | **OPEN (MON-038)** | no refinance offered > 100% LVR |
| netWorth identity off by $1 (Assets−Liab and Liquid+Accessible+Locked both 3,401,781 vs 3,401,782) | Tolerance/rounding — watched, not chased | Exact after bucket-producer unification |
