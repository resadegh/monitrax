# FIX BRIEF — MON-037 · One-off expenses annualised ×12 (expense side)

> **Issue:** MON-037 · **status:** FIXING · **severity:** critical · **changesNumbers:** true
> **Pinned HEAD:** `b0a6da2` (2026-07-15) · **Registry:** `docs/issues/ISSUES.json` · **Tracker:** VR-002 / VR-004
> **Twin:** MON-053 (income side) — same defect class; see that brief. Work them as one cluster; the Ring-1 source-lock is shared.
> **Rule zero:** re-read the MON-037 entry live before executing — statuses move fast.

---

## The defect (one paragraph)
Several one-off property costs (a battery, a subdivision fee, a paint job) are stored as `frequency: MONTHLY` and multiplied ×12, massively overstating monthly expenses, property cashflow and tax deductions; there is also an apparent duplicate battery entry. The engine + card are already fixed; what remains is the duplicate reconcile and the live re-verify.

## Ownership legend (who does each step)
- 🤖 **MATRIX** — this Cowork session does it autonomously; no action from you.
- 💻 **CODE** — written in a desktop Claude Code session *(or by Matrix-via-PR if you enable full-auto — see the decision I've put to you separately)*.
- ✋ **YOU** — a gate only you can clear (charter carve-out).

---

## Full circle — the 10-step loop for MON-037

| # | Step | Owner | Concrete action | Done when |
|---|---|---|---|---|
| 1 | Find | ✅ done | VR-002 surfaced it (one-offs tagged MONTHLY on HOME/Thornland/Guildford). | — |
| 2 | Trace | ✅ done | Root cause §19.2-verified: `propertyCashflow.ts:172`, `taxPositionCalculator.ts:195/688`. | — |
| 3a | Fix RC-A (engine) | ✅ done | **PR #1395** — `isRecurring` gate excludes one-offs from run-rate + counts them once in tax; threaded through 9 producers. | merged |
| 3b | Fix card | ✅ done | **PR #1400** — `PropertyExpensesCard` renders recurring rows only (Σrows === total); one-offs as a footnote. | merged |
| 3c | **Fix RC-B (duplicate Battery)** | 💻 CODE | Reconcile Battery / Battery System / Battery Replacement on HOME (ESTIMATE+ACTUAL both 136,620/yr) — de-dup ESTIMATE vs ACTUAL for the same underlying cost. | one battery cost remains |
| 3d | **Fix RC-C (frequency detection)** | 💻 CODE | Infer non-recurring from a single-transaction feed instead of trusting stored `MONTHLY`. **Shared with MON-053 §3.4 gate — build once, for both.** | single-txn → not defaulted MONTHLY |
| 4 | Model | 🤖 MATRIX | Re-pin the touched Neomatrix anchors in the SAME fix PR (§21.2.1). | graph delta in PR |
| 5 | Ratchet | 💻 CODE | Add a Ring-2 dedup-reconciliation test (extend `tests/dashboard/propertyExpensesCard.test.ts`); MON-037 Ring-0 already exists (`tests/calculations/mon037OneOffEngines.test.ts`). | test added |
| 6 | PR | 🤖 MATRIX | Open the fix PR (one issue / one PR), §8 template, 10/10 self-score, STATE.md + plan spoke in the same PR. | PR open |
| 7 | Merge | ✋ YOU | Money-touching merge = your click (charter carve-out). Matrix shepherds CI to green first. | merged |
| 8 | Deploy verify | 🤖 MATRIX | Confirm the Vercel prod deploy is READY. | READY |
| 9 | Ring-3 (Chrome) | 🤖 MATRIX | Claude-in-Chrome on your real data: HOME expenses card row↔total reconciles, no duplicate battery, cashflow/yr correct. | symptom gone, no regression |
| 10 | Promote | 🤖 MATRIX | Grow NeoAudit + broaden the canonical Chrome brief `docs/verification/VERIFICATION_PLAYBOOK.md` §3.3 (dedup-reconciliation class). Set status VERIFIED. | registry VERIFIED |

**What YOU actually touch for MON-037:** one approval — the merge at step 7 (because it changes money numbers). Everything else is automated or lives in the Code session.

---

## Model routing (per your directive)
- **Opus 4.8** for the whole of MON-037 remainder (RC-B dedup + RC-C detection + tests). It's well-specified reconciliation with no novel diagnosis. No Fable 5 needed here.

## Gates & pause points
- `changesNumbers=true` → cannot reach VERIFIED without a linked test + a Chrome PASS (steps 5 + 9).
- The only human gate is the **merge** (step 7).

## Ring-3 verification targets (real data)
On HOME (and Thornland Lot 1 / Guildford): the expenses card lists only recurring rows and Σrows === the shown total; **no duplicate battery**; property Cashflow/yr excludes one-offs; tax deductions stay at the healed **$39,554** (not the old $367,440). Every recurring row unchanged.

## Definition of done
RC-B + RC-C shipped with the reconciliation ratchet; STATE.md + plan updated same PR; Chrome Ring-3 PASS → **MON-037 VERIFIED**, promoted into NeoAudit.

---
*Sources (pinned `b0a6da2`): `docs/issues/ISSUES.json` MON-037; `docs/issues/FIX_PROTOCOL.md`; VR-002/VR-004. Prepared by The Matrix.*
