# CODE BRIEF (Fable 5) — the CAPTURE FEATURE: make the PSI / FTE-IEE / Div 152 overlays live (the Neo-G4 unlock)

**Paste into a fresh Claude Code session. MAJOR, STAGED feature — schema + assembler + UI; UI is STITCH-FIRST.** Neo-G4 wired the three overlays into `buildMasterTaxPosition` (MON-097/098/099, main `6b2ded9c`, A6 island list empty) but they are **inert by construction** — inputs uncaptured AND the entity tax route bypasses the orchestrator. This closes both. **Prevention framing: the deliverable is the CAPTURE + REACHABILITY controls (schema fields, one assembler producer, safe defaults, source-lock) — a triggering user's corrected number is only the test fixture.**

## §0 Standing corrections
1. **Stitch routing:** every UI/screen/section is **Stitch-first** (fourth law, §18.2.1) — design in THIS Code session, §18.8 ≥9/10, final design to Reza BEFORE build.
2. **Model routing:** executes in the Code session regardless of header.
3. **Baseline discipline:** inertness = cluster moves only by explainable data deltas + a NEW correct line appears only for a triggering entity. Non-triggering users (incl. Reza) stay byte-identical to the post-depreciation baseline (Income $317,751 / Deductions $172,325 / Taxable $145,426 / Owing $26,926 / Net $38,054 / Medicare $2,909).

## 0. Boot ritual + STEP-0 census
`git clone`/pull → main → pin HEAD (`6b2ded9c` or later). Read STATE.md → CLAUDE.md (Part 0 laws, §12.2.1 SSOT, §12.11 schema-migration gate, §12.14 reform-awareness, §18.2.1 Stitch-first, §19.2, §21.2.2 neo-sync) → the MON-097/098/099 diffs → `lib/services/entityTaxFactsAssembler.ts` + `lib/services/distributionResolutionService.ts` + `prisma/schema.prisma` (EntityRelationship :880, DistributionResolution :1058, DistributionAllocation :1085) + the three engine Input types.

**Matrix STEP-0 census (verified @ `6b2ded9c` — the gap map):**
| Overlay | Engine input needs | Captured today | Gap |
|---|---|---|---|
| **FTE/IEE** (`FteIeeInput`) | `hasFamilyTrustElection` + per-beneficiary `distributionAmount`, `relationship` (Sch 2F s272-95), `hasQuotedTfn`, `coveredByIee` | election + distributions EXIST | **3 per-beneficiary fields** — SMALLEST gap |
| **PSI** (`PsiInput`) | `totalPsiIncome`, `incomeFromLargestClient`, `unrelatedClientCount` + `gainedClientsViaDirectAdvertising`, results/premises/employment | NONE | **zero capture** — broadest trigger |
| **Div 152** (`Div152Input`) | `gainAfterDiv115`, `maxNetAssetValue`, `aggregatedTurnover`, `isActiveAsset`, `monthsHeld`, `isRetirementOrIncapacity`, `retirementExemptionUsedToDate` | NONE | **zero capture** — rarest trigger |

## STAGE 0 (ENABLING — do FIRST): reachability
`/api/tax/entity/[entityId]` calls `calculateEntityTaxPositionDecimal` directly, bypassing `buildMasterTaxPosition` — captured inputs never hit the wired overlays on the entity route. Route the entity tax path THROUGH the orchestrator (or a thin documented adapter feeding the overlays) so the one producer is the single path. Ring-1 source-lock: no second entity-tax assembler. **Capture without this is still inert.** (May be the standalone "reachability brief" the handout named — lands before Stage 1.)

## STAGES 1-3 (staged capture — smallest-gap-first)
Each stage = **schema (Reza's migration click) → assembler (the ONE producer of the overlay Input) → Stitch-first UI → ratchet → Matrix Ring-3**. Safe default: **absent capture = overlay inert = today's numbers byte-unchanged.**

### Stage 1 — FTE/IEE (smallest gap → fastest full-loop proof)
- **Schema:** `relationship` (Sch 2F family-group enum), `hasQuotedTfn Boolean`, `coveredByIee Boolean?` on the beneficiary/`DistributionAllocation` row.
- **Assembler:** build `FteIeeInput` from election + allocations + new fields → `input.fteIeeByEntity`; UNCOMPUTED where a control-test fact is absent (never default to firing).
- **UI (Stitch-first):** per-beneficiary relationship / TFN-quoted / IEE-covered on the distribution editor — mirror the MON-088 tri-state persist pattern (null = conservative).

### Stage 2 — PSI (broadest value, zero capture)
- **Schema + assembler:** per-entity PSI-facts (total PSI income, largest-client income, unrelated-client count + direct-advertising flag, results/premises/employment) → `input.psiByEntity`. s86-60 net-attribution stays the flagged sub-PR.
- **UI (Stitch-first):** a PSI/PSB self-assessment questionnaire on the entity tax view; UNCOMPUTED where unanswered.

### Stage 3 — Div 152 (rarest, episodic)
- **Schema + assembler:** CGT-event capture (gain after Div 115, MNAV, turnover, active-asset, months held, retirement/incapacity, retirement-exemption-used-to-date) → `input.div152ByEntity`. Connected-entity aggregation stays UNCOMPUTED (engine warns near threshold).
- **UI (Stitch-first):** a "small-business asset sale" flow on the CGT/disposal surface.

## Guardrails (every stage — 8 gates)
SSOT (one assembler → one input → one position; Ring-1 source-lock) · safe default (no capture → inert → byte-identical; extend the absent-input parity tests per stage) · reform/config-aware (47% / $6M / $2M / retirement cap from config) · neo-sync (model capture nodes + assembler→overlay edges; Neobrain intake update; NeoAudit goldens) · schema migration = Reza's click (§12.11) · number-changing on triggering data = Reza confirms before Ring-3.

## After each stage → Matrix Ring-3 (VR-0NN)
Triggering test entity → the overlay fires (FTDT / TFN-withholding / PSI-attribution / Div-152-concession line with citations + UNCOMPUTED), converged tax ≡ /cashflow ≡ CFO. Non-triggering user (Reza) → byte-identical, no overlay line.

---

# ANNEX — Batch VERIFIED→CLOSED promotion review (Matrix recommendation)

All of the following hold promotion evidence (a pushed VR run + a CI ratchet + registry VERIFIED). **Matrix recommends CLOSED** on the next Code registry pass:

- **Depreciation/tax-core:** MON-003, MON-026 (VR-029), MON-034 (reports 12×), MON-097 (VR-029), MON-098, MON-099 (VR-032).
- **Cross-surface identities:** MON-002, MON-009, MON-010, MON-011, MON-012, MON-013, MON-014, MON-019, MON-021 (VR-030).
- **Earlier VERIFIED arc:** MON-077, MON-088 (VR-028), MON-091 (VR-031), MON-093 (VR-020), MON-094 (VR-022), MON-095 (VR-023), MON-096 (VR-024).

21 issues. Each has a VR doc under `docs/verification/runs/` + a ratchet in CI; none has open follow-up that blocks CLOSED (the s86-60 PSI sub-PR + capture feature are NEW work, not reopeners). Recommend the Code session flip these VERIFIED→CLOSED in one pass and update STATE.md.

*Prepared by The Matrix (`6b2ded9c`). Capture + reachability = the Neo-G4 unlock; promotion review banks the session's verified wins.*
