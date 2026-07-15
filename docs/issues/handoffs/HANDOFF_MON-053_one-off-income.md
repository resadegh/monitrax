# FIX BRIEF — MON-053 · One-off income annualised ×12 (income side)

> **Issue:** MON-053 · **status:** DIAGNOSED · **severity:** critical · **changesNumbers:** true
> **Pinned HEAD:** `b0a6da2` (2026-07-15) · **Registry:** `docs/issues/ISSUES.json` (18 `file:line` anchors) · **Tracker:** VR-007
> **Twin:** MON-037 (expense side, already engine-fixed) — this is the identical bug on income. Shares the Ring-1 source-lock.
> **⚠️ Sequencing: MON-053 lands BEFORE MON-045 stage 2** (or MON-045's Ring-3 verifies against a base inflated by ~$120.6K, burning a real-data cycle).
> **Rule zero:** re-read the MON-053 entry + all 18 anchors live before executing.

> **✅ CONFIRMED EXECUTION MODEL (Reza, 2026-07-15):** Hybrid — Matrix auto-writes the mechanical parts (producers, gate, read-path, tests, PR, CI, deploy-verify, Ring-3, promote) via PR; the **subtle engine/tax core + schema-migration design go through a desktop Code session on Fable 5.** Because MON-053 **contains a schema migration, you approve the migration AND click the merge** (schema PRs are exempt from Matrix auto-merge — your delegation).

## The defect (one paragraph)
Two one-off ATO deposits — `Ato Ato001100022493651` ($9,098) and `Ato Ato002000023189359` ($952), each a **single transaction dated 27 May** — are stored as `Income{frequency: MONTHLY}` and multiplied ×12 into $109,176/yr and $11,424/yr, adding **~$120,600 of phantom income** to the declared gross of **$524,831/yr — and you are taxed on it.** A one-off income is currently *inexpressible* in the data model (that is the real defect): `model Income` has no `isRecurring` column and `enum Frequency` has no `ONE_OFF`. Fix = remove the culprit, don't add a compensating adjustment.

## Ownership legend
- 🤖 **MATRIX** — this Cowork session does it autonomously.
- 💻 **CODE** — desktop Claude Code session on **Fable 5** (subtle engine + migration design).
- ✋ **YOU** — a gate only you can clear.

---

## Full circle — the 10-step loop for MON-053

| # | Step | Owner | Concrete action | Done when |
|---|---|---|---|---|
| 1 | Find | ✅ done | VR-007 headline finding. | — |
| 2 | Trace | ✅ done | Root cause §19.2-verified, 18 anchors in the registry. | — |
| 3.1 | **Data model** | ✋ YOU → 💻 | Add `isRecurring Boolean @default(true)` to `model Income` (`prisma/schema.prisma:1865`), mirroring `Expense:1950`, **+ a migration.** *Schema/DB change = your approval before it's applied (§12.11); designed in the Fable 5 Code session.* | migration written |
| 3.2 | **Engine (Fable 5)** | 💻 CODE | `taxPositionCalculator.ts`: add `isRecurring?` to `IncomeItem:30-42`; apply the MON-037 guard at `:128`; **guard the Decimal twin at `:636`** (expense already guarded `:694-697`) + `lib/calc-audit/engines/decimal-tax-engine-income-position.ts`. | both engines count a one-off once |
| 3.3 | **Producers P1–P5** | 🤖 MATRIX | Thread `isRecurring` through: P1 `app/api/income/route.ts:240` (main CRUD), P2 `transactions/[id]/link/route.ts:417`, P3 `documents/analyze/confirm/route.ts:459`, P4 `onboarding/complete/route.ts:230`, P5 `lib/db/tenant.ts:168`. | all 5 pass the flag |
| 3.4 | **Gate** | 🤖 MATRIX | `TransactionLinkDialog.tsx:373-377`: change `>= 2` to `>= 1` so a single transaction is classified not defaulted; send `isRecurring` on the income payload (mirror expense `:610-611`). **Also satisfies MON-037 RC-C.** | single-txn classified |
| 3.5 | **Read path** | 🤖 MATRIX | `userTaxPosition.ts:94-105`: carry `isRecurring` through the map (`:99`) or the engine never receives it. | flag reaches engine |
| 4 | Model | 🤖 MATRIX | Re-pin Neomatrix income-guard anchors in the SAME PR (§21.2.1). | graph delta in PR |
| 5 | Ratchet | 🤖 MATRIX | Ring-0 (one-off income counts once, Float **and** Decimal); **Ring-1 SOURCE-LOCK** (any Income/Expense annualisation site must be one-off-guarded — the ancestor-killer); Ring-2 Float/Decimal parity on the Golden Household. Set the registry `test` field (null today; gate requires it). | 3 rings added |
| 6 | PR | 🤖 MATRIX | Assemble the fix PR (engine from Code + mechanical from Matrix), §8 template, 10/10 self-score, STATE.md + plan spoke same PR. | PR open |
| 7 | Merge | ✋ YOU | **Schema migration present → your click** (exempt from auto-merge). Matrix shepherds CI green first. | merged |
| 8 | Deploy verify | 🤖 MATRIX | Vercel prod deploy READY. | READY |
| 9 | Ring-3 (Chrome) | 🤖 MATRIX | Claude-in-Chrome on your real data (targets below); captures + verdict posted for your record. | symptom gone |
| 10 | Promote + re-baseline | 🤖 MATRIX | Grow NeoAudit; broaden Chrome brief §3.3 ("read the cadence LABEL", one-off-income class); set VERIFIED; run **VR-008 re-baseline**. Then MON-045 stage 2 unblocks. | VERIFIED + VR-008 |

**What YOU actually touch for MON-053:** three points — approve the schema migration (3.1), do the engine/migration in a Fable 5 Code session (3.2), click the merge (7). Everything else is automated.

---

## Model routing (per your directive)
- **Fable 5** → 3.1 migration *design*, 3.2 engine core + the Decimal twin (subtle AU tax-correctness, highest stakes).
- **Opus 4.8 / Matrix** → 3.3 producers, 3.4 gate, 3.5 read path, migration *application* once specified, and all tests (mechanical, fully specified above).

## Gates & pause points
1. **Schema migration** — your approval before applying (§12.11).
2. **Merge** — your click (schema PR, exempt from auto-merge).
3. Producers/gate/read-path/tests proceed through the PR without intervention.

## Ring-3 verification targets (real data)
The two ATO rows each count **ONCE**, not ×12 → `/dashboard/income` stops showing "$9,098/mo · $109,176/yr" and "$952/mo · $11,424/yr"; `/dashboard/tax` declared gross **falls ~$120,600 from $524,831/yr**; the tax estimate (**$194,218** on `/cashflow` + CFO) falls accordingly; every other income row unchanged. Blast radius is a lower bound — VR-007 read 1 of 16 Activity pages; check for further one-off income rows.

## Definition of done
Model + engine (Float+Decimal) + producers + gate + read-path shipped with Ring-0/1/2 ratchets and the `test` field set; STATE.md + plan updated same PR; Chrome Ring-3 PASS on the four targets → **MON-053 VERIFIED**; **VR-008 re-baseline** run; MON-045 stage 2 unblocked.

---
*Sources (pinned `b0a6da2`): `docs/issues/ISSUES.json` MON-053 (18 anchors); `docs/issues/FIX_PROTOCOL.md` §1–§8; `docs/verification/runs/VR-007.md`. Prepared by The Matrix.*
