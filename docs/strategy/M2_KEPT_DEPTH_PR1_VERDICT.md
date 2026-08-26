# P-10 PR-1 — RING-3 VERDICT (kept-surface intake pipeline)

**Run:** 2026-08-25/26 AEST, account-first on Reza's live PROD session · **Verdict: PARTIAL** (7 checks; 6 PASS, 1 FAIL, 1 section not run)
**Handout:** `docs/strategy/BRIEF_M2_KEPT_DEPTH.md` §PR-1 — predictions committed in #1613 BEFORE the fix code (#1614). D-21 satisfied by the brief itself; no separate handout cut.
**Envelope:** validated `matrix-result/v1`, posted on #1614. **Satellite doc pattern: P-11.**

## 1. The acceptance test — PASSED, and Reza's expense is booked

Reza's real Bunnings receipt ($203.78, Bunnings Smithfield, EFT 20/08/2026) had been stranded pending since the P-9 sweep because approve was impossible. This run cleared it end to end:

| # | Prediction | Result |
|---|---|---|
| 1 | **MON-188** edits survive reload | ✅ `Invnice → Bunnings`, `2026-03-20 → 2026-08-20`, Done, hard reload → both held. Reverted on two clean attempts pre-fix. |
| 2 | **MON-187/189** select + approve work | ✅ checkbox on first click · counter `1 selected` · `POST /api/documents/analyze/confirm` → **200** · row cleared · badge `2 → 1 worth a check` · awaiting review `4 → 3`, persisted. |
| 3 | Books to **FY2026-27** at the corrected date | ✅ ledger row `Bunnings · Cash · 20 Aug` · chip `Expense` · $204, under *Thursday 20 August*. |
| 4 | **MON-190** ONE document total | ✅ sidebar **9** ≡ hero **9** ≡ grid **9** ≡ dashboard tile **9**. Pre-fix the same page read 18 vs 9. |
| 5 | **MON-193/194** stated limit = enforced limit | ✅ drop-zone copy now `Max 4.0 MB per file`; the same 6.2MB file that returned 413 pre-fix is refused with that limit in a plain sentence (Reza-observed). |
| 6 | **mustNotMove** | ✅ byte-identical: $4,990,000 · 40.8% owned LVR · $3,401,782 · strip 6/6 worst-first · EOFY FY2025-26 = 12 · intake 48. |

**Registry flips authorised: MON-187 · 188 · 189 · 190 · 193 · 194 → VERIFIED.**

**MON-191 (vendor extraction) is NOT authorised — it stays FIXING.** This run corrected an *already-extracted* item by hand; no new receipt was uploaded, so the new `extractVendor` never executed. It flips on a run that uploads a fresh receipt and observes the merchant beat the document-type word. Recorded here so the gap is not read as an oversight later.

## 2. Why PARTIAL — S7 blocked

`sectionsNotRun[]`: **S7 fresh-account onboarding.** Setting it up surfaced finding G3 below; each attempt also terminated Reza's live session, so the setup was abandoned rather than retried. S7 remains the last outstanding M2.6 LIVE-CHECK item and now depends on G3.

## 3. Findings — G1…G7 (NEW; Code assigns MON ids)

**G1 · HIGH — a one-off is annualised on a kept surface, through the door PR-1 just opened.**
Immediately before the approve, the activity money-flow widget (*Annual reference period*, $304K income/yr) read **Essentials $18K / Surplus $95K**. Immediately after approving the single **$203.78** one-off: **Essentials $20K / Surplus $93K**, total income unchanged. A one-off counted *once* cannot move a $K-rounded figure at all; `203.78 × 12 = $2,445` fits the observed ~$2K move — the observation **refutes "counted once"**. This is the **MON-129 / MON-001 one-off-gate class**.
*Hypothesis to verify in source, NOT asserted:* the confirm path writes the expense without `isRecurring: false`, so a `=== false` gate never fires against `null` — the MON-135 tri-state / MON-140 input-feed shape.
*Honest boundary:* the ×12 mechanism is **inferred from rounded display figures**, not measured; the relay JS tool was classifier-blocked, so exact values could not be read.
*Note on `changesNumbers: NO`:* PR-1's declaration stands. No producer changed — a new **row** did. G1 is a pre-existing producer defect made newly reachable.

**G2 · MEDIUM — three display defects on the row the approve wrote.** The amount renders **`--$204`** (double minus glyph); the day-group subtotal for *Thursday 20 August* reads **`+$204` in positive/green** on a day whose only row is a $204 expense (sign inverted); the row carries an **up/incoming arrow**. The underlying sign is correct (`THIS MONTH · SPENDING -$204 · NET CASHFLOW -$204`), so all three are presentational.

**G3 · MEDIUM — the create-account route bounces a returning visitor into the previous session.** From the signed-out `/signin` page, clicking **"create an account →"** lands in `/dashboard` fully authenticated as the previous user instead of opening a registration form. **Observed twice.** Blocks fresh-account onboarding in any browser that has held a session.
*Negative control, recorded so this is not over-read:* a **direct URL navigation** to `/signin` immediately after sign-out held correctly, with empty fields. So sign-out itself appears to work, and the defect looks specific to the create-account route. Mechanism **not established** — this is an observation with its control, not a diagnosis.

**G4 · LOW — raw enum rendered as an action label.** One inbox row reads `SET_REMINDER · $215.59` beside the humanised `Add as expense · $203.78 · 2026-08-20`. The MON-187 action-resolution fix reaches the value but not the label for every action type.

**G5 · LOW — help drawer opens uninvited from the vault Upload button** (4th reproduction across two sessions; already carried as MON-195 for PR-3). Recorded only as a further reproduction under automation-click conditions.

**G6 · LOW — the public marketing site promises hidden capability to a prospective v1 user.** The landing page still reads *"AUSTRALIAN WEALTH OPERATING SYSTEM — Property, super, investments, trusts, cashflow and tax — read by one engine."* Super, investments and trusts are all hidden modules. This is the queued **M5.1** positioning rewrite, observed live rather than assumed.

**G7 · LOW — the upload drop zone is separated from the button that opens it (Reza-reported, Matrix-corroborated).** Clicking **Upload** in the vault hero reveals the "Upload documents" panel and its drag-and-drop box **below the Smart Inbox**, far down the page from the button that summoned it — the action and its target are separated by an unrelated section. Matrix independently hit this twice during the P-9 sweep, hunting for the drop zone by scrolling. The panel belongs immediately beneath the hero tile carrying the Upload button.

## 4. Coverage boundary

**Establishes:** every PR-1 prediction on live data; the acceptance expense booked to the correct FY at the corrected date; the four document totals agreeing; the upload limit told and enforced as one number; mustNotMove byte-identical.

**Does NOT establish:** S7 onboarding (blocked, G3) · MON-191's extractor (never exercised — no new upload) · the `+1 per upload` half of MON-190 (no upload completed) · pack totals byte-for-byte (JS tool blocked; the EOFY tile at 12 is the proxy) · the ×12 mechanism behind G1 (inferred, not measured) · the mechanism behind G3 · whether the approve path's choice of a **Cash** account is intended — note MON-172 means CASH accounts do not render on the balances page, so this expense's account is invisible there.

## 5. Routing the UI findings — Stitch-first, ≥9/10 (Reza, 2026-08-26)

**G7 and G2 are section-level UI changes and MUST NOT be fixed code-first.** Reza's ruling on this verdict: *"as this is a UI change it should pass through Stitch and your 9/10 review."* That is §18.2.1 (the STRICT in-app ruling — section-level compositions go through Stitch) plus §18.8 (every Stitch output self-reviewed on the 7-lens rubric and only presented above 9/10). Ownership follows the 2026-08-25a ruling: 🟩 Matrix generates and shows Reza preview PNGs; 🟦 Code commits the artefacts + JSDoc screen IDs only after his nod.

| Finding | Route |
|---|---|
| **G7** upload panel renders below the Smart Inbox | **STITCH-FIRST.** Re-composition of the vault page's section order — the drop zone belongs immediately under the hero tile carrying the Upload button. |
| **G2** `--$204` · inverted `+$204` day subtotal · income arrow on an expense | **STITCH-FIRST for the row treatment** (amount sign, day-subtotal sign, direction glyph are §18.7.2 money-signal vocabulary). The underlying data is correct, so this is presentation only. |
| G4 raw `SET_REMINDER` label | Copy fix, not a composition change — Code may fix directly; the label vocabulary is a §18.7.2 concern only if the chip styling changes. |
| G1 · G3 · G5 · G6 | Not UI compositions — normal Code routing (G1 = producer/engine, G3 = auth route, G5 = existing MON-195, G6 = M5.1 marketing). |

**⛔ BLOCKER, unchanged since 2026-08-25:** Stitch tooling is down — `generate_screen_from_text` times out at the 60s MCP boundary with no retrievable screen, and `list_screens` returns EMPTY for the in-app project `5991501424852019479`. **So G7 and G2 cannot start.** They are recorded here as Stitch-gated and BLOCKED rather than quietly routed to Code, which is exactly the drift D-22 was raised to stop. No design will be invented as a workaround (the M3.4 precedent). Options for Reza in the next relay: retry the tooling, supply a working Stitch project, or rule a one-off exception in writing for these two narrowly-scoped presentational fixes.
