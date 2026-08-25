# RING-3 HANDOUT — P-9: the M2.6 LIVE-CHECK sweep (7 outstanding items, one session)

**For:** Matrix HQ (Claude-in-Chrome relay, account-first on Reza's data) · **Authorised:** Reza GO on P-6…P-11, 2026-08-25 · **Discharges:** gate-review finding **B3** (`M2_7_GATE_REVIEW.md` §0) — the second half of the M2.6 close.
**Written:** 2026-08-25, BEFORE the run (D-21 discipline applied to verification — every expectation stated falsifiably in both directions; movement predicted, never discovered).
**Source list:** `M2_DEPTH_SWEEP_CATALOGUE.md` §LIVE-CHECK items 3, 4, 5, 6, 7, 8, 10. Items 1, 2, 9 are already covered by the #1601 and #1606 pack Ring-3s and are NOT re-run here.
**Read-only law:** this sweep RENDERS and OBSERVES. It writes NOTHING without an explicit per-item note below. Any data movement observed is a FAIL of the sweep itself.

## Identity assertion
Reza's account (`userId 91b6d7ce-…`), PROD, FY2025-26 where a window applies. Deployed SHA read via the admin relay if reachable; else `sha:null` + shaNote (RULE A).

## The seven checks

| # | Item | Falsifiable expectation |
|---|---|---|
| S3 | **Pack generation time** on Reza's FY volume (387 txns, the N+1 concern) | Time `GET /api/bookkeeping/tax-pack/export?fy=FY2025-26&format=json` wall-clock from the network log. **PASS < 10s · FAIL ≥ 10s** (record the actual ms either way — the number is the artefact). A second run recorded too (cache/warm effect visible). |
| S4 | **Vision/OCR live in PROD** | Reach the receipt-scan entry point. **If configured:** the scan UI accepts an image and returns extracted fields with NO invented defaults (MON-174's 5%/360mo class). **If not configured:** the `VISION_NOT_CONFIGURED` path surfaces an HONEST visible state — a message, not a silent spinner, not a fake success. **FAIL = silent failure or fabricated data.** Which branch PROD is on is itself a recorded finding. |
| S5 | **Empty-state-on-failure class** | On kept surfaces (activity · documents · balances · properties list), a failed data fetch renders the explicit **LoadFailedState** (PR-3 fix), never a healthy-looking zero-state. Method: client-side fetch override forcing a 500 on the page's own data route, reload, observe, remove override. Server untouched. If the relay cannot inject, the item is recorded NOT RUN — never faked. |
| S6 | **Mobile bottom bar at 375px** | Resize to 375×812. Bottom bar renders per D-16/D-19: kept tabs + More fold, no horizontal overflow, NO hidden-module tab visible, every tab target reachable (kept route, no 404). **FAIL = overflow, a gated tab, or a dead tab target.** |
| S7 | **Fresh-account onboarding** | **REZA-ASSISTED.** Matrix cannot create accounts (standing rule). If Reza supplies a fresh v1 account this session, the check runs: onboarding completes on kept modules only, no gated step, no parallel-engine number shown (MON-171 watch). Otherwise recorded in `sectionsNotRun` — honestly outstanding, not silently dropped. |
| S8 | **Cash FAB → balances Cash-Wallet visibility** | Open the Cash quick-add from the FAB (observation only — CANCELLED before any save). Then the balances page: **MON-172 predicts FAIL** — a CASH account is NOT visible on balances. If a Cash Wallet row IS visible and correct, MON-172 is CLEARED for this surface and the registry note updated instead. Either way the observation closes the item. |
| S10 | **Global-FAB receipt → property Documents** | Path check to the submit boundary: global FAB → receipt attach → property picker offers kept properties. **The write step (one small test document) runs ONLY on Reza's explicit nod in-session**; with the nod, the document must appear in that property's Documents section (PR-3 fix verified) and is then deleted by Reza or left flagged for his cleanup. Without the nod: path check recorded, write step in `sectionsNotRun`. |

## mustNotMove (read-only run — NOTHING moves)
- Scoreboard quick metrics: property value **$4,990,000** · net worth **$3,401,782** · LVR **40.8%** · cashflow strip 6/6 worst-first.
- Pack totals byte-identical to the #1612-era capture if S3's export is compared.
- No new transaction, document, account or property exists after the run that did not exist before (S10's authorised test document excepted, and it is named in the envelope if created).

## Result format
`matrix-result/v1` JSON, validated with `npm run matrix:check -- <file>` before acting on it; posted to the PR. `sectionsNotRun[]` mandatory — S7 (and S10's write step, if un-nodded) land there, and a non-empty list forbids PASS → the honest ceiling is PARTIAL.

## Coverage boundary
This sweep verifies the seven live items above on ONE account, ONE viewport pair, ONE day. It does NOT verify: hidden-module surfaces (D-20) · XLSX/PDF pack rendering · the MON-185 data cleanup · load behaviour beyond Reza's own FY volume · S5 on routes the override cannot reach.
