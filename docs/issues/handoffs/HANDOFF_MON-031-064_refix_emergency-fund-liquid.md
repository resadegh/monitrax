# CODE BRIEF (Opus 4.8) — MON-031/064 RE-FIX: emergency-fund "Liquid savings" still reads GROSS (VR-017 FAIL)

**Paste into a fresh Claude Code session on OPUS 4.8.** This is the §7 retro re-fix after the cross-surface Ring-3 (VR-017) FAILED. #1452 netted ONE liquid producer but a **sibling emergency-fund producer was missed** — same Mechanism-B shape as MON-032. Contained wiring fix. MON-031/064 is FIXING; do NOT re-open, do NOT patch a surface.

## 0. Boot ritual + hardened guardrails (FIRST, no exception)
1. `git clone`/`pull` resadegh/monitrax → main → pull. Pin HEAD; cite `file:line`; re-verify anchors live.
2. Read `STATE.md` → `CLAUDE.md` (Part 0 laws, §12.2.1 SSOT, §20.6/§20.7 self-review, §21.2.2 neo-sync) → `MATRIX_FIX_DISCIPLINE.md` (8 gates) → `CALC_SSOT_WALL.md` → `FIX_PROTOCOL.md` → **`docs/verification/runs/VR-017.md`** (the FAIL evidence + §7 retro).
3. STEP 0 = holistic map: enumerate EVERY producer of a "liquid savings / emergency-fund" figure and EVERY surface that shows it or a months-covered derived from it.

## What #1452 fixed vs what it MISSED (live, VR-017, prod pin #1452 `cdbcb9cd`, confirmed live via Vercel)
`#1452` netted `quickMetrics.liquidCash` → the **liquid-today / cash / balance** surfaces correctly read **$301,808** (net of the $2,496 Qantas card): Balances "Liquid today", Home "Cash" tile, /cashflow "Balance". ✓

**Still GROSS ($304,304) — the FAIL:**
| Surface | Shows |
|---|---|
| My Safety Net — "Liquid savings" | **$304,304** + Emergency **11.7 mo** (= 304,304 ÷ 25,973 burn) |
| Home dashboard — Health "Emergency" + "EMERGENCY STRONG" tile + "Solid Emergency Fund" insight | **11.7 mo** (gross basis) |
| (likely also) CFO emergency-fund months · insights `freeToday` |

The gap is exactly the $2,496 card. So the Safety-Net "Liquid savings" headline **and** the emergency-fund **months-covered** are fed by a DIFFERENT source than `quickMetrics.liquidCash` — a `liquidSavings` / `emergencyFund` computation reading **gross spendable accounts directly**. `ring2.liquidCashParity` passed because it asserted buckets ≡ quickMetrics ≡ the safety-net *route* — it never covered the live "Liquid savings" field or the months identity, so the miss shipped.

## The re-fix (route the emergency-fund path through the ONE canonical net figure)
1. Find the emergency-fund/liquid-savings producer (grep the surfaces above back to their source — likely a `liquidSavings`/`emergencyFund`/`monthsCovered` field in `masterFinancialService` or a safety-net calc that sums `LIQUID_ACCOUNT_TYPES` gross, NOT `quickMetrics.liquidCash`). Cite `file:line`.
2. Point it at the canonical **net** `quickMetrics.liquidCash` (deployable = spendable − credit cards, per Reza's confirmed definition). Every emergency-fund consumer — Safety Net "Liquid savings", Home Health "Emergency"/"EMERGENCY" tile/"Solid Emergency Fund" insight, CFO emergency, insights `freeToday` — must read that one figure.
3. **Months-covered identity (I9):** emergency months = net liquid ÷ monthly burn ($25,973) → 301,808 ÷ 25,973 = **11.6**, everywhere (currently 11.7 gross). No surface computes months off a gross liquid source.
4. Keep the Qantas card as its own Credit −$2,496 liability line (already correct — don't hide it).

## Ratchets (gates 1-3 + 8)
- Ring-0: "Liquid savings" and emergency months are **identical on every surface** and equal the net figure ($301,808 / 11.6) — no surface shows $304,304 / 11.7.
- Ring-1: `lint:source-lock` green; no surface sums raw `LIQUID_ACCOUNT_TYPES` for a liquid/emergency figure inline; exception count does not rise.
- Ring-2 golden: **extend `tests/golden/ring2.liquidCashParity.test.ts`** to assert (a) the Safety-Net "Liquid savings" field == `quickMetrics.liquidCash` and (b) **emergency monthsCovered == net liquid ÷ burn** (the identity the current golden missed) — so this exact miss can never ship again.
- Neo-sync (gate 8): Neomatrix models the emergency-fund figure as a CONSUMER of `quickMetrics.liquidCash` (not its own producer); NeoAudit gets the extended golden; Neobrain untouched; nothing sandbox-only.

## Cross-surface Ring-3 (gate 4 — Matrix, after merge)
Matrix re-runs live: "Liquid savings"/liquid == $301,808 and emergency months == 11.6 on Safety Net, Home (Cash + emergency + health), CFO, /cashflow, Balances — identical, with the `VR-___` run id. Regression guard: net worth $3,401,782 + buckets tie, per-property cashflow, tax $89,287/$142,319 all unchanged. MON-031 + MON-064 → VERIFIED only when identical everywhere.

## Definition of done → handback
Single-producer wiring PR behind CI + green source-lock + the extended golden; Neomatrix/NeoAudit updated same PR; PR-template checklist incl. Ring-3 run-id; self-scored 10/10 (gate 7). **Reza merges.** Then Matrix cross-surface Ring-3.

---
*Prepared by The Matrix. Re-fix after VR-017 FAIL (#1452 missed the emergency-fund sibling producer). Opus 4.8, contained wiring fix — no schema change. The golden extension is mandatory: the original golden's blind spot is why this shipped.*
