# FIX HANDOFF — Rectify Cluster ① · MON-037 + MON-053 (the one-off ×12 defect class)

> **For:** a desktop **Claude Code** session (visible, with Reza) · **From:** The Matrix (Cowork orchestrator)
> **Pinned HEAD:** `b0a6da2` (merge of #1419, 2026-07-15) · **Registry:** `docs/issues/ISSUES.json` @ this HEAD (74 issues)
> **Rule zero:** every anchor below was read from the repo at this HEAD. Re-read `ISSUES.json` for live per-issue status before you start — statuses move fast. Cite `file:line`; never fix from this brief alone where the code has moved.
> **Bypass note:** this doc lives under `docs/issues/` (not a continuity-gate substantive path) — but the FIX PRs it describes touch `lib/`, `app/`, `components/`, `prisma/`, so THEY must update STATE.md + a plan spoke in the same PR (CLAUDE.md §15/§16.5).

---

## 0. Why these two are ONE cluster

Both are the **same defect class**: a **one-off amount stored as `frequency: MONTHLY` and annualised ×12**, inflating a headline financial number.

- **MON-037** fixed it for **expenses** (a one-off battery / subdivision fee / paint job counted ×12).
- **MON-053** is the **income-side twin** — the *identical* bug, the *same engine file*, never given the same treatment: two single ATO deposits become **~$120,600 of phantom income** inside the declared gross of **$524,831/yr — and it is taxed**.

FIX_PROTOCOL §1 calls this failure mode **F1 (partial-producer fix)**: MON-023 was fixed on the surface only → survived as MON-037; MON-037 was fixed for expenses only → survived as MON-053. The thing that actually kills the pattern is the **Ring-1 source-lock** (below), which covers BOTH income and expense annualisation sites. Work them together or the pattern re-spawns a third time.

### ⚠️ Hard sequencing (from the MON-053 registry note)
**MON-053 must land BEFORE MON-045 stage 2.** MON-045's Ring-3 verifies the CFO neg-gearing benefit against the tax base; if MON-045 lands first it verifies against a base inflated by ~$120.6K of phantom income, and when MON-053 then lands the number moves again — invalidating MON-045's Ring-3 and burning a full real-data cycle. Order: **land MON-053 → re-baseline → then MON-045 stage 2.**

---

## 1. Model routing (per Reza, 2026-07-15) — which model to run in Code

| Work | Model | Why |
|---|---|---|
| **MON-053 — diagnosis confirm + engine core** (Float guard at `:128`, Decimal twin at `:636`, one-off-income tax semantics, Float/Decimal parity reasoning) | **Fable 5** | Subtle AU tax-correctness; a wrong number here ships money-language error. Highest correctness stakes in the cluster. |
| **MON-053 — data-model migration** (add `Income.isRecurring`) | **Fable 5** to design/approve the migration shape; **Opus 4.8** may apply it once the column + default are specified | Schema change is irreversible-ish → design stakes high, mechanics low. |
| **MON-053 — producer threading P1–P5, gate wiring, read-path map, tests** | **Opus 4.8** | Mechanical, fully specified below (exact files/lines). Cheaper model handles it cleanly. |
| **MON-037 — remaining work** (RC-B duplicate-Battery reconcile + Ring-3 re-verify) | **Opus 4.8** | Well-specified reconciliation + verification; no novel diagnosis left. |

Cluster summary: **start MON-053 on Fable 5 for the engine/tax core, hand the mechanical propagation + MON-037 remainder to Opus 4.8.**

---

## 2. MON-037 — where it stands and what remains  (status: FIXING · critical · changesNumbers)

**Done:**
- RC-A engine fix merged (**PR #1395**): `isRecurring` gate added to the two engines the general MON-023 fix never reached — `lib/calculations/propertyCashflow.ts:172` excludes one-offs from run-rate; `lib/tax-engine/position/taxPositionCalculator.ts:195/688` count a one-off ONCE (not ×frequency). Threaded `isRecurring` through all 9 producers/callers + entity Prisma selects. Ratchet: `tests/calculations/mon037OneOffEngines.test.ts`.
- Card-fix merged (**PR #1400**): `PropertyExpensesCard` now renders only recurring rows (`expenses.filter(isRecurring !== false)`) so Σrows === shown total; one-offs surfaced as a footnote. Ratchet: `tests/dashboard/propertyExpensesCard.test.ts`. This closed the VR-004 "$0 total over non-zero rows" UI regression.
- Ring-3 (VR-004) already proved the tax number healed: deductions dropped **$367,440 → $39,554** (the ×12 inflation gone).

**Remaining (Opus 4.8):**
1. **RC-B — duplicate "Battery" reconcile.** Battery / Battery System / Battery Replacement on HOME include ESTIMATE+ACTUAL both at 136,620/yr. Scoped as a dedup follow-up, out of RC-A. De-dup ESTIMATE vs ACTUAL for the same underlying cost.
2. **RC-C — frequency detection** (follow-up): infer non-recurring from a single-transaction feed rather than trusting the stored `MONTHLY` (this overlaps MON-053's gate fix — see §3.4; do it once, for both).
3. **Ring-3 re-verify** the card + reconciliation on real data (Chrome), then MON-037 → VERIFIED.

**Anchors:** `lib/calculations/propertyCashflow.ts:172` · `lib/tax-engine/position/taxPositionCalculator.ts:195,688` · test `tests/calculations/mon037OneOffEngines.test.ts` · tracker VR-002/VR-004.

---

## 3. MON-053 — full fix spec  (status: DIAGNOSED · critical · changesNumbers · tracker VR-007)

**Symptom (real data):** `Ato Ato001100022493651` = **$9,098** shown "$9,098/mo — $109,176/yr" and `Ato Ato002000023189359` = **$952** shown "$952/mo — $11,424/yr". Each is **exactly ONE deposit, dated 27 May**, stored as `Income{frequency: MONTHLY}`, extrapolated ×12 into the declared-gross tax base of $524,831/yr — **and taxed.**

**Fix philosophy (§4.3): REMOVE THE CULPRIT — do NOT add a compensating adjustment.** A one-off income is currently *inexpressible* in the data model; that is the real defect. Five parts, all anchored:

### 3.1 Data model — `prisma/schema.prisma`  *(Fable 5 to design; migration = pause point, see §5)*
- `model Income`:**1865** has **no** `isRecurring` column; `model Expense` has `isRecurring Boolean @default(true)` (see :**1950**). `enum Frequency`:**183–190** has WEEKLY/FORTNIGHTLY/MONTHLY/QUARTERLY/ANNUAL/HALF_YEARLY — **no ONE_OFF member.**
- **Do:** add `isRecurring Boolean @default(true)` to `model Income`, mirroring `Expense` exactly, + a migration. `default(true)` keeps every existing row behaving as today (no silent reclassification).

### 3.2 Engine — `lib/tax-engine/position/taxPositionCalculator.ts`  *(Fable 5)*
- `IncomeItem`:**30–42** has no `isRecurring` field; `:128` annualises unconditionally (`annualize(income.amount, income.frequency)`). `ExpenseItem`:**44–63** already carries `isRecurring?`:**62** and the MON-037 guard at `:194–197` counts a one-off once.
- **Do:** add `isRecurring?: boolean` to `IncomeItem`; apply the **identical MON-037 guard** at `:128`.
- **THE DECIMAL TWIN (do not miss — this is the §12.2.1 duplicate that keeps the bug alive):** `:636` annualises income **unguarded** while `:694–697` already guards the expense. Guard `:636` the same way. Also `lib/calc-audit/engines/decimal-tax-engine-income-position.ts` carries the same unguarded annualise — guard it too.

### 3.3 Producers P1–P5 — thread `isRecurring` through  *(Opus 4.8)*
Every one defaults `frequency` to `MONTHLY`, which is the mechanism. Verified runtime census (`grep -rn "income.create"`):
- **P1** `app/api/income/route.ts:240` — the MAIN income CRUD create (frequency required :196, passed :247). *(Was missing from the original triage; it is the primary producer.)*
- **P2** `app/api/transactions/[id]/link/route.ts:417` — `const frequency = body.frequency || 'MONTHLY'`:346 → create :417.
- **P3** `app/api/documents/analyze/confirm/route.ts:459` — frequency default :456–457 → create :459.
- **P4** `app/api/onboarding/complete/route.ts:230`.
- **P5** `lib/db/tenant.ts:168` — generic tenant wrapper, passes data straight through.
- (`lib/testing/loader.ts:460` is test fixtures, not runtime — update for fixtures but it is not a producer.)

### 3.4 Gate — `components/transactions/TransactionLinkDialog.tsx`  *(Opus 4.8; folds in MON-037 RC-C)*
- `:373–377`: `if (tp?.detectedFrequency && (tp.count ?? 0) >= 2)` pre-ticks recurring — **structurally blind to the single-transaction case:** with `count === 1` it neither sets a frequency nor marks non-recurring, so the `MONTHLY` default silently wins (exactly the ATO rows).
- The expense payload already sends `isRecurring: isRecurringExpense`:**610–611**; the income path has no equivalent.
- **Do:** gate `>= 1` so a single transaction is *classified* not defaulted; send `isRecurring` on the income payload mirroring the expense path.

### 3.5 Read path — `lib/tax-engine/position/userTaxPosition.ts`  *(Opus 4.8)*
- `:94–105` maps `IncomeItem` and passes `frequency: income.frequency`:**99** straight to `toAnnual` (`lib/utils/frequencies.ts:7`, MONTHLY ×12 at `:13–14`).
- **Do:** carry `isRecurring` through this map, or the engine fix never receives it.

**All 18 rootCause anchors** are in the MON-053 registry entry — re-read them live before editing.

---

## 4. Tests / ratchets required (§5 — a bug at Ring 3 proves a hole in Rings 0–2)
- **Ring-0** — a one-off income counts ONCE, on **both** the Float and Decimal engines (mirror `tests/calculations/mon037OneOffEngines.test.ts`).
- **Ring-1 SOURCE-LOCK (the ancestor-killer)** — assert that **any** `IncomeItem`/`ExpenseItem` annualisation site is one-off-guarded, so a new unguarded annualisation *cannot be added*. This is the ratchet that ends the pattern rather than this one instance.
- **Ring-2** — Float/Decimal parity on the Golden Household.
- **Gate (§7):** MON-053 is `changesNumbers=true`, so it **cannot reach VERIFIED without** (a) a linked §19.4 holistic propagation test — the `test` field is **null today and MUST be set** by the fix PR — and (b) a resolving `semanticKey` + a Chrome PASS verdict.

---

## 5. Pause points — get Reza's confirmation (autonomy grant carve-outs)
1. **Schema migration** (`Income.isRecurring` + migration file) — schema/DB change (§12.11). Confirm before applying.
2. **`changesNumbers` fix before its Ring-3** — MON-053 moves the declared gross and the tax estimate; per the grant, a number-changing fix is confirmed with Reza before its real-data Ring-3 verification.
3. Everything else (engine guard, producer threading, gate, tests) proceeds autonomously through the PR.

---

## 6. Ring-3 (Chrome) verification targets — the numbers that must move  *(the ONLY thing that makes VERIFIED)*
On Reza's real production data, after the fix deploys READY:
- The two ATO rows each count **ONCE**, not ×12.
- `/dashboard/income`: stops showing "$9,098/mo — $109,176/yr" and "$952/mo — $11,424/yr".
- `/dashboard/tax`: declared gross **falls from $524,831/yr by ~$120,600**.
- `/cashflow` and CFO: the tax estimate (**$194,218**) falls accordingly.
- **Regression guard:** every *other* income row unchanged; net worth and the VR-006/VR-007 baselines otherwise stable (the two known $1 sub-dollar artifacts are watched, not chased).
- **Blast radius is a lower bound:** VR-007 read 1 of 16 Activity pages — check for further one-off income rows while you're in there.

---

## 7. The 10-step loop — where Code picks up
`1 Find` ✅ (VR-002 → MON-037; VR-007 → MON-053) → **`2 Trace` ✅ (both §19.2-verified — start at `3 Fix`)** → `3 Fix` (§3 above) → **`4 Model`** update Neomatrix anchors in the SAME PR (§21.2.1 — MON-037 already re-pinned masterFinancialService 1822→1823, taxPositionCalculator 92→101, propertyCashflow 130→137; re-pin again for the income guard) → `5 Ratchet` (§4) → `6 PR` (one issue/one PR, §8 template, 10/10 self-score + CI) → `7 Merge` → `8 Deploy verify` READY → `9 Ring-3` (§6) → **`10 Promote`** grow NeoAudit + broaden the canonical Chrome brief `docs/verification/VERIFICATION_PLAYBOOK.md` §3.3 (a one-off-income "read the cadence LABEL" class, mirroring the MON-048 cadence-badge lesson).

## 8. Definition of done (cluster ①)
MON-053 engine + model + producers + gate + read-path shipped with Ring-0/1/2 ratchets; STATE.md + plan spoke updated same PR; Chrome Ring-3 PASS on the four target numbers → MON-053 VERIFIED. MON-037 RC-B reconciled + Ring-3 re-verified → MON-037 VERIFIED. Re-baseline (VR-008) **after** MON-053 lands. THEN MON-045 stage 2 is unblocked.

---
*Sources (this session, pinned `b0a6da2`): `docs/issues/ISSUES.json` (MON-037, MON-053, MON-045 entries); `docs/issues/FIX_PROTOCOL.md` §1–§8; `docs/verification/runs/VR-007.md`. Prepared by The Matrix.*
