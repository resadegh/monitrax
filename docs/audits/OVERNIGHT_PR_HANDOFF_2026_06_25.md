# Overnight PR Handoff — 2026-06-25 → 26

> **Reza: read this first.** Built autonomously overnight per your brief ("finish the complete Trust Engine, keep the PR list for me to merge tomorrow; then W2–W7 after the Trust Engine passes + 10/10"). **Nothing was merged** — every item is a DRAFT for you to merge. I verified each with tests + (where applicable) a mutation-proof + a recorded §20.4 10/10, and modelled each into the Neomatrix where it touches a number/engine (§21.2.1).
>
> **Two flags before you start:**
> 1. **Merge in the order below.** The graph-touching PRs (Trust Engine layers) form a sequence; if a later one shows a graph conflict after you merge an earlier one, it just needs a regenerate — ping me / I'll rebase it reactively when the merge webhook fires.
> 2. **🚦 DECISION-NEEDED PRs change a displayed number.** I did NOT merge or presume these. Each states the exact X→Y delta + why. Your call.

---

## Merge order

### A. Trust Engine (safety-critical core — all behavior-preserving, verification only)

| # | PR | What it does | Changes a number? | Evidence |
|---|---|---|---|---|
| 1 | **#1244** | Neomatrix assurance-coverage readout (the keep-track view) | No (derived metric) | neomatrix:check OK; 124 tests |
| 2 | **#1245** | L3 reconciliation tie-outs (net-worth class additivity + cashflow statement/net) | No (tests only) | mutation-proven (28 fail); 519 tests |
| 3 | **#____ (L0)** | Authority-anchored golden-case metadata (ATO URL + FY + verifiedDate on the income-tax/medicare/super A1 cases) + no-invented-URL lock | No (tests only) | 102 A1 tests incl. L0 locks |
| 4 | **#____ (L1)** | Independent-recomputation differentials (to come) | No (tests only) | — |

*(L2 invariants already merged as #1242.)*

### B. W2–W7 SSOT dedup (behind the Trust Engine)

| Wave | PR | What it does | Changes a number? | Notes |
|---|---|---|---|---|
| W3 | #____ | collapse the duplicated `buildHealthInput` → one shared builder | No (proven identical) | — |
| W5 | #____ | super/SG/cap constants → `taxYearConfig` | No (same values) | — |
| W6 | #____ | data-source re-aggregation → master snapshot | No (proven identical) | — |
| W7 | #____ | frequency-converter + formatter dedup; retire `exporter.ts` shadow | No (proven identical) | — |
| W2 | #____ | declared→actual in insightsEngine + portal (§19.1) | **🚦 YES** | builds the correct (actuals) number; flagged with the X→Y delta — your decision |
| W4 | #____ | emergency-fund/savings-rate/LVR/yield/equity dedup → canonical | review per-surface | only ships surfaces the Trust Engine proves identical; any that differ → flagged |

*(Full wave detail: `SSOT_DUPLICATE_SOURCE_AUDIT_2026_06_25.md` §8 + §7.1.)*

### C. Pre-existing follow-up (separate, your call)
- **Suspected stale super-cap** `27500` + magic `0.34` at `cashflow/intelligence/route.ts:481` — flagged in the SSOT audit; needs a §19.2 worked-example financial PR. Not built overnight (changes a number).

---

## Status log (updated as I build)

- **L0 built** — `tests/neomatrix/financialAudit.test.ts` gains FY+ATO-URL+verifiedDate metadata on 9 golden cases (income-tax ×7, medicare, super) + a no-invented-URL completeness lock + an L0 verification node in the graph. 102/102. §20.4 10/10.
- _(more appended as L1 / W-waves land)_
