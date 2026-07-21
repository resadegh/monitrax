# CODE BRIEF (Fable 5) — MON-094: tax "Other Income" pulls non-assessable ATO refunds into the taxable gross

**Paste into a fresh Claude Code session on FABLE 5** (tax-facing). One fix. A live number is wrong: tax "Other Income" $10,300 includes ~$10,050 of ATO tax **refunds**, which are not assessable income → your taxable income and tax owing are overstated. DIAGNOSED with an S19.2-verified census (registry MON-094); **no schema change needed** — the mechanism already exists, it just isn't wired through. This brief also folds in the MON-093 registry flip (see §5).

## 0. Boot ritual + hardened guardrails (FIRST, no exception)
1. `git clone`/`pull` resadegh/monitrax → main → pull. Pin HEAD (currently `c7c7c80`, merge of #1473); cite `file:line`; re-verify every anchor live before judging (Reza's data is in flux — read the CURRENT stored rows).
2. Read `STATE.md` → `CLAUDE.md` (Part 0 laws, §12.2.1 SSOT detection kit, §12.11 no-silent-rewrite-of-Reza's-rows, §20.6/§20.7 self-review, §21.2.2 neo-sync) → `MATRIX_FIX_DISCIPLINE.md` (8 gates) → `CALC_SSOT_WALL.md` → `docs/verification/runs/VR-019.md` items 11/19 + `docs/verification/runs/VR-020.md` §D (the pre-fix baseline: Other Income $10,300).
3. STEP-0 holistic map before code. Four lenses. The census below is your starting map — confirm it live, don't assume it.

---

## THE DEFECT (census — confirmed live at `c7c7c80`, distinct from CLOSED MON-053)

**MON-053 is NOT this bug.** MON-053 was ×12 over-annualisation; the one-off guard at `lib/tax-engine/position/taxPositionCalculator.ts:157-163` already counts `isRecurring=false` income **once** (Float + Decimal twins). The income page shows one-offs as `$0/mo` (Wall B2 `monthlyRunRate` excludes them) while tax counts them **once** in the annual gross — **both are the designed semantics.** This bug is "counted-once-but-should-be-ZERO," not "counted-too-many-times." Do not re-touch the one-off path.

**The real defect is classification.** Trace:
1. `prisma/schema.prisma` `IncomeType` enum has only SALARY / RENT / RENTAL / INVESTMENT / OTHER — so an ATO-refund income row can **only** be typed `OTHER`.
2. `lib/tax-engine/income/taxabilityRules.ts:224` — the `OTHER` / `default` branch returns **taxable-for-safety** (`taxableAmount: amount`, category `SALARY_WAGES`, cites ITAA s6-5).
3. `lib/tax-engine/position/taxPositionCalculator.ts:201` — the `default` case adds that to `incomeBreakdown.other`, counted once → the $10,300 line.
4. **The exemption mechanism ALREADY EXISTS but is severed:** `Income.taxCategory` (`TaxCategory?`, `prisma/schema.prisma:567` — includes `TAX_EXEMPT:594`, `GOVERNMENT_EXEMPT:585`, `GIFTS`; Phase 20, "replaces isTaxable") and `taxabilityRules` has exempt handling — BUT `lib/tax-engine/position/userTaxPosition.ts:172-185` maps DB rows → `IncomeItem` and **does not carry `taxCategory`** (verified: the map lists id/name/type/amount/frequency/isRecurring/propertyId/investmentAccountId/grossAmount/paygWithholding/franking* — no taxCategory). So a row-level exemption can never reach the engine.

**Evidence (VR-019/VR-020, live):** `Ato Ato002000023189359` $9,098 + `Ato Ato001100022493651` $952 (both One-Off on `/dashboard/income`) + Col/Service NSW, all inside tax "Other Income" $10,300.

---

## REZA'S RULE (build to this — confirm the exact list before merge, §12.11)
**Assessable-only, exclude all non-assessable — auto.** Tax declared gross = recurring declared income + genuine one-off **assessable** receipts (counted once, never annualised). **EXCLUDE** non-assessable receipts:
- **ATO tax refunds** (not assessable — ITAA; a refund of tax already paid is not income),
- **internal transfers** (own-account movements),
- **loan / director-loan drawdowns** (borrowings aren't income),
- **reconciliation artifacts**.

Genuine one-off **assessable** income (e.g. a real casual payment) still counts **once**. The **exact descriptor→non-assessable mapping is a confirm-before-merge decision** — build the classifier + the preview, present the list, Reza approves it in the PR. **No silent rewrite of his existing rows (§12.11)** — mis-classified rows are surfaced for his per-row confirm, not auto-flipped.

---

## THE FIX (row-level non-assessable override + intake tagging — NO schema change)
The census gives the exact shape; anchor each edit:

**(a) Carry `taxCategory` into the engine.** In `userTaxPosition.ts:172-185`, add `taxCategory: income.taxCategory ?? undefined` to the `IncomeItem` map; add the field to the `IncomeItem` type. In `taxPositionCalculator.ts` (before the `determineTaxability` type switch at ~:163) and/or in `taxabilityRules.ts`, **respect a row-level non-assessable override**: if `taxCategory ∈ {TAX_EXEMPT, GOVERNMENT_EXEMPT, …non-assessable}` → `taxableAmount 0`, routed to an **exempt/non-assessable bucket**, NOT `incomeBreakdown.other`. Float + Decimal twins both. This is the load-bearing fix — it works even for already-stored rows once they carry the category.

**(b) Tag at intake.** `lib/intake/classifyIntake.ts:157` — ATO-refund descriptors (+ internal transfers, loan drawdowns) classified **non-assessable** at link time → set `taxCategory = TAX_EXEMPT` (or a dedicated NON_ASSESSABLE value if you add one to the enum — enum-only addition, additive) + `taxNotes`. New receipts land correct automatically.

**(c) Surface existing mis-classified rows for Reza's confirm (§12.11).** The two ATO rows + any internal-transfer/loan rows already stored as plain `OTHER`/taxable: present them (Admin surface or a tax-page "review these" affordance) with the suggested non-assessable reclassification; **Reza confirms per row** — no silent flip. Reuse the intake-duplicates preview-and-confirm pattern (#1459) if it fits.

**(d) Do NOT touch** the one-off annualisation path, the salary/rental/dividend/interest branches, or MON-053's guard.

---

## Ratchets (gates 1-3 + 8)
- **Ring-0/2 golden** (`tests/tax/…` or `tests/golden/ring2.*`): an **ATO-refund one-off contributes $0** to taxable income (fails on pre-fix code — it currently adds `amount`); a **genuine one-off assessable receipt counts once** (not ×12, not $0); a recurring salary is unchanged. Pin the live shape: Other Income drops from $10,300 to ≈ $250 (the non-ATO, non-transfer remainder — confirm the exact residual live).
- **Ring-1 source-lock:** `npm run lint:source-lock` green; exception count ratchet-down; taxability decided in the ONE engine, no surface re-derives assessability.
- **Neo-sync (gate 8):** Neomatrix models the row-level non-assessable override on `engine.taxPositionCalculator.calculateTaxPosition` + the `classifyIntake` non-assessable tag (`engine.intake.classifyIntake`); NeoAudit gets both goldens; Neobrain updated (intake classification touched); anchors re-pinned; **nothing sandbox-only.**
- **10/10 self-review** before presenting; the exact exclusion list confirmed by Reza at merge.

## Cross-surface Ring-3 (gate 4 — Matrix, after merge)
After Reza merges + confirms the reclassification, the Matrix verifies live (`VR-021`): tax "Other Income" drops to the **assessable-only** subset (ATO $9,098 + $952 gone); TOTAL INCOME falls by ~$10,050 from $327,801; taxable income + tax owing fall correspondingly; income page ↔ tax stay consistent per basis; **regression guards unchanged** — Broadbeach rent $2,947/$35,360/5.89% (MON-093), loan $1,191, liquid $301,808, salary $195,620, one-off labels intact.

## Sequencing & merge authority
Single PR (all tax-facing, one engine). CI + green source-lock + goldens + neo-sync + 10/10 self-score. **Reza merges** (number-changing + tax) and **confirms the exclusion list + the per-row reclassifications** (§12.11). Matrix runs the cross-surface Ring-3 after.

---

## 5. FOLD-IN: apply the MON-093 VERIFIED verdict (registry + cursor — pending Code write)
The Matrix ran VR-020 (PR #1474) and verified MON-093. Apply the verdict in this same session (or its own tiny commit):
- **`docs/issues/ISSUES.json`** (via `npm run issues:*` tooling, not a hand-edit): MON-093 `FIXING → VERIFIED`, note "VR-020 (#1474): Broadbeach ×4.5 rental cross-surface inflation dead — property $2,947/mo declared, $35,360/yr, 5.89% yield; detail≡list ($15,879/yr); tax rental total $121,881 < old Broadbeach-alone $135,941; amber cadence chip live; guards clean."
- **`STATE.md`** cursor → advance to the merge of #1473, note MON-093 VERIFIED at VR-020, and set the new "Next" to MON-094 (this brief). Keep MON-091 FIXING (write-checks 13/14 await Reza's authorisation).
- Regenerate `docs/issues/ISSUES.md` from JSON if that's the build step.

---
*Prepared by The Matrix from the MON-094 census (S19.2-verified) + VR-019/VR-020. Assessable-only rule = Reza's decision (confirm exact list at merge). Row-level `taxCategory` override + intake tagging — no schema change; the field already exists. Serves tax correctness (ATO refunds aren't assessable) + the SSOT first law (one engine decides assessability).*
