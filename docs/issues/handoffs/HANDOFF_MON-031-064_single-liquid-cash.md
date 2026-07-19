# CODE BRIEF (Opus 4.8) — MON-031 / MON-064: ONE canonical "liquid cash" producer

**Paste into a fresh Claude Code session on OPUS 4.8** (balances/liquidity aggregation — not tax-subtle; contained). Next Calc-SSOT Wall Mechanism-B migration after the tax-engine collapse (VR-016). Single-producer fix — small and clean.

## 0. Boot ritual + the hardened guardrails (FIRST, no exception)
1. `git clone`/`pull` resadegh/monitrax → main → pull. Pin HEAD; cite `file:line` at that HEAD; re-verify anchors live.
2. Read `STATE.md` → `CLAUDE.md` (Part 0 laws, §12.2.1 SSOT, §20.6/§20.7 self-review, §21.2.2 neo-sync) → `docs/architecture/MATRIX_FIX_DISCIPLINE.md` (8 gates) → `CALC_SSOT_WALL.md` → `docs/issues/FIX_PROTOCOL.md`. Repo law, hardened 10/10 (#1444).
3. **STEP 0 = holistic map:** enumerate every producer of "liquid / available / reachable cash" and every surface that shows it. Four lenses. Fix scope = the whole map.

## The defect — MON-031 / MON-064 (same value, two numbers)
"Liquid cash" reads **two different values** across surfaces (Matrix live, VR-015/016, `www.monitrax.com.au`):

| Surface | "Liquid" shows | Basis |
|---|---|---|
| My Safety Net | **$304,304** | GROSS cash: NAB Everyday $414 + Guildford Offset $303,890 |
| Balances ("Liquid today / Reachable today") · Home ("Cash") · /cashflow ("Balance") | **$301,808** | NET of the Qantas credit-card balance |

**The gap is exactly $2,496 = the Qantas credit-card balance** ($304,304 − $2,496 = $301,808). So the Safety Net surface computes liquidity **gross of revolving credit**, while balances/home/cashflow compute it **net of it**. Two producers, one concept — a §12.2.1 violation (Mechanism B).

## DECISION REQUIRED (Reza) — carry as a confirm gate, do not guess silently
Which is the canonical "liquid cash"?
- **Recommended: the NET figure ($301,808)** — "cash you can actually deploy after clearing the card." It's the more honest deployable number AND it's what 3 of 4 surfaces already show, so migrating **Safety Net onto it** is the smaller, lower-risk change. The credit-card balance stays visible as its own liability line (it already is: Credit −$2,496).
- Alternative: gross cash ($304,304) as "liquid assets", with credit shown separately as a liability (some frameworks keep assets and liabilities unnetted).
Code proposes the canonical definition + migrates to it; **Reza confirms before merge** (this changes a number he sees on the Safety Net page).

## The fix (single canonical producer)
1. Identify/introduce ONE canonical liquidity producer (likely in `lib/calculations/*` / `masterFinancialService` — cite where balances/home/cashflow already derive $301,808) and route the **Safety Net** page through it. Delete the Safety Net's independent gross-cash computation.
2. No surface re-derives "liquid" from raw account balances; all read the one producer. Keep the credit-card balance as its own labelled liability, not folded silently.
3. Do NOT change the other three surfaces' number (they're the reference) unless the confirmed definition says gross — in which case migrate ALL four to the one producer and the change is deliberate + Reza-confirmed.

## Ratchets (gates 1-3 + 8)
- Ring-0: "liquid / available / reachable cash" is **identical on every surface** (Safety Net ≡ Balances ≡ Home ≡ /cashflow).
- Ring-1: `lint:source-lock` green; no surface sums raw account balances for liquidity inline; exception count does not rise (ratchet-down — currently 80).
- Ring-2 golden: a `tests/golden/` case asserting the one liquidity figure across the safety-net, balances, and cashflow producers for the golden household — so a second liquidity computation can't reappear.
- **Neo-sync (gate 8):** model the canonical liquidity producer + the "one liquid figure, all surfaces" invariant in the **Neomatrix**; add the golden as the **NeoAudit** ratchet; **Neobrain** untouched (no intake change); nothing sandbox-only.

## Cross-surface Ring-3 (gate 4 — Matrix, after merge)
Matrix re-runs live: the same liquid figure reads identically on Safety Net, Balances, Home, and /cashflow, with the recorded `VR-___` run id. MON-031 + MON-064 → VERIFIED only when identical everywhere. Regression guard: net worth $3.4M, cash total, tax $89,287/$142,319 all unchanged.

## Definition of done → handback
Single-producer PR behind CI + green source-lock + the new golden; Neomatrix/NeoAudit updated in the SAME PR; PR-template checklist complete incl. Ring-3 run-id field; self-scored to an honest 10/10 (gate 7). **Reza confirms the definition + merges** (money-facing number change). Then Matrix cross-surface Ring-3 → VERIFIED.

---
*Prepared by The Matrix. Next Mechanism-B migration after the tax-engine collapse (VR-016). Opus 4.8 (liquidity aggregation, not tax-facing). Contained single-producer fix — no schema change. Live evidence: Safety Net $304,304 vs Balances/Home/Cashflow $301,808, gap = Qantas card $2,496.*
