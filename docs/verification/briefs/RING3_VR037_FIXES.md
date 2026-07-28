# RING-3 HANDOUT — VR-037 findings fixed: MON-104…110 (+ MON-111 tracked)

**Prepared by:** Code session (Fable 5), 2026-07-28 · **Source run:** `docs/verification/runs/VR-037.md` (at `ff65e40`)
**PR-A:** #1519 `fix/mon-104-110-capture-ssot` — **MERGED** (`ab9f65e1`) · changes NO number
**PR-B:** #1520 `fix/mon-106-fy2026-27-config` — draft, awaiting **Reza's number-changing click** · moves tax owing by ≈$268
**Registry:** MON-104…111 raised via `issues:raise`; 104/105/107/108/109/110 → FIXING on #1519; 106 → FIXING on #1520; 111 = tracked deferral (OPEN, no code by design — lands with Phase 41e.6/41e.7 company dispatch).

---

## Per-issue: root cause → structural fix → guardrail → status

| Issue | Root cause (§19.2-verified) | Structural fix | Guardrail (permanent, in CI) | PR |
|---|---|---|---|---|
| **MON-104** | Capture write path persisted raw `?fy=` (psi-assessment:37 / div152-assessment:40 / smsf-return:30) while the read path normalised — a disagreeing FY = an orphaned, invisible row | ONE canonical resolver (`resolveRequestedTaxYear`/`isTaxYearConfigured` in `taxYearConfig.ts`) on write+read of all three routes; unconfigured FY → 400, nothing persisted | `mon104FyResolver.test.ts`: resolver contract + REAL-handler round-trip + rejection-persists-nothing + 3-route topology lock | #1519 ✅ |
| **MON-105** | Div 152 card gated inside `isPsiRelevant` (page.tsx:113/:274) — INDIVIDUAL/PERSONAL_NAME/fixed·hybrid·testamentary trusts/deceased estates shut out | `lib/tax-engine/eligibility.ts`: Div 152's OWN grammar (entity-type-agnostic per s152-10; SMSF-only exclusion), independent of PSI's | `mon105Div152Eligibility.test.ts`: reachability ×6 types + not-aliases + page topology | #1519 ✅ |
| **MON-106** | No FY2026-27 config → silent FY25-26 fallback: 16% on the $18,201–45,000 band vs the legislated 15%; header/table mismatch on screen | `TAX_YEAR_2026_27` (base amounts re-derived, provisions cited); engine-stated `configStale` → amber banner (announce, never substitute); indexed items carried forward, commented | Clock-derived CI guard (red build every 1 July without a current-FY config) + Ring-0 walk + bracket-integrity + configStale contract (`mon106Fy2026_27Config.test.ts`) | #1520 ⏳ Reza |
| **MON-107** | Card hardcoded `s86-15` on every branch (PsiAssessmentCard:253); engine `citations` discarded — $0 PSB branch cited the attribution provision | Card renders `result.citations` via pure `components/tax/citationLine.ts`; literal deleted | `mon107PsiCitationLine.test.ts`: PSB-determination line contains s87-60, never s86-15 (real classifier output) | #1519 ✅ |
| **MON-108** | Engine embedded citation in `steps[].concession` AND emitted `citation` → doubled `(s152-205) (s152-205)` | Fixed at the PRODUCER, both twins: clean labels; `citation` sole carrier | `mon108ConcessionLabels.test.ts`: no label matches `/\(s\d/`, all branches, both twins | #1519 ✅ |
| **MON-109** | `0.8` inline (psiClassifier:181 + PSI card:212); `180`/`$6M`/`$2M`/`$500k` re-typed on the Div 152 card | Engine exports `ONE_CLIENT_THRESHOLD`/`MNAV_THRESHOLD`/`TURNOVER_THRESHOLD`/`RETIREMENT_LIFETIME_CAP`/`FIFTEEN_YEAR_MONTHS`; cards read them (comparisons AND formatted copy) | NeoAudit threshold-trace detector (NEOAUDIT.md §7): threshold numerals in `components/tax/**` fail CI (`mon109ThresholdTrace.test.ts`) | #1519 ✅ |
| **MON-110** | `Div152Result` lacked `gainBeforeConcessions` → card computed `steps[0].runningGain + steps[0].reduction` (§8.3 breach) | Both twins state `gainBeforeConcessions` (ONE definition, Float ≡ Decimal); card renders it; reconstruction deleted | `mon110GainBeforeConcessions.test.ts`: parity incl. the new field + the no-surface-arithmetic audit (VR-037 Part D's hand check, now CI) | #1519 ✅ |
| **MON-111** | s86-15 attribution reaches only the entity surface; household position never receives it (documented 41e.6/41e.7 deferral) | Tracked registry entry — routing lands with the company dispatch, NOT here | Registry lifecycle (OPEN; gate blocks silent closure) | — |

## Ring-3 on PR-A (#1519 — merged; runnable now)

Entity: any owned COMPANY-type (e.g. Renew Group Holding) + any INDIVIDUAL/PERSONAL_NAME entity. No numbers move anywhere — the household cluster must stay byte-identical to the VR-037 Part C baseline.

1. **Citations (MON-107/108):** on the COMPANY entity tax view, enter the VR-037 PSI fixture ($150k/$135k/1) + ATO determination **Yes** → the $0 PSB strip's citation line must include **s87-60** and must NOT include s86-15. Flip determination off (attribution branch) → s86-15 present. Div 152 fixture → each concession row cites **once**: `50% active asset reduction (s152-205)`. Withdraw fixtures after (Clear + save), per the standing constraint.
2. **Reachability (MON-105):** open an **INDIVIDUAL** (or PERSONAL_NAME) entity's tax page → the "Sold a business asset this year?" card renders (was "no dedicated tax view"). SMSF still shows its fund view only.
3. **FY round-trip (MON-104):** save a PSI questionnaire on FY 2025-26, reload → values present with assessment. (The 400-reject path is CI-proven; no live probe needed.)
4. **Regression guards:** household `/dashboard/tax` ≡ `/cashflow` ≡ CFO byte-identical to the VR-037 baseline (Part C table) — pre-PR-B.

## Ring-3 on PR-B (#1520 — AFTER Reza's click)

Verify the number moved **correctly** (against the Ring-0 walk), not to a target:

| Figure | Pre (VR-037 baseline) | Expected post | Why |
|---|---|---|---|
| Tax on income | $35,146 | **$34,878** | 31,020 + 10,426 × 37% = 34,877.62 (Ring-0) |
| Medicare levy | $2,909 | **$2,909** | untouched |
| Gross/net tax | $38,054 | **≈$37,786** | −268.00 |
| Tax owing | $26,926 | **≈$26,658** | −268.00 |
| Total income / deductions / taxable | $317,751 / $172,325 / $145,426 | **unchanged** | brackets only |
| Header vs bracket table vs footnote | "2026-27" over FY25-26 table | **all FY26-27, agreeing** | config landed |
| Amber stale banner | (was the silent mismatch) | **absent** (fires only for an unconfigured FY) | announce-never-substitute guard |
| Convergence | — | tax ≡ /cashflow ≡ CFO move by the SAME −$268 | one canonical bundle |

Every affected figure moves by exactly the band saving; any figure that moves by anything else, or any figure that should move and doesn't, is a new MON-###.

## Notes for the Matrix

- **Fixtures:** the VR-037 governance constraint was honoured — nothing in Reza's data was created/edited; Ring-3 fixtures should again be entered and withdrawn.
- **Known non-findings:** (a) entity-page FY dropdown still lists 2025-26/2024-25/2023-24 (no 2026-27 option) — pre-existing display list, surfaced as follow-up, not a regression; (b) historical `?financialYear=` requests compute on the CURRENT config and now show the stale banner — pre-existing behaviour made visible (candidate new issue, not a PR-B defect).
- **Build-fail retro (FIX_PROTOCOL §7 class):** PR-B's first preview build failed because the tax-page banner shifted two grandfathered financial-math baseline lines (798/801 → 815/818) and the lint had only been run pre-edit. Re-pinned (debt count unchanged); lesson recorded in STATE.md — the full vercel-build gate chain runs locally after every surface edit.

*Registry moves on your verdicts: PASS → MON-104/105/107/108/109/110 (+106 after its run) → VERIFIED with the run ID in the notes.*
