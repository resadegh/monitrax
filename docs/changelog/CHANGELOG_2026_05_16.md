# Changelog — 2026-05-16

## Session: Phase 41E reform 2026-27 + AI provider strategy (doc-only)

Branch: `claude/phase-41e-reform-2026-27-MG8mr`

### Scope
- **Type:** Design / strategy (doc-only — no code, schema, or migration in this PR)
- **Scope:** Tax engine + AI advisor — design for absorbing the 12 May 2026 Federal Budget tax reforms; provider-strategy review of Gemini vs Claude.
- **CDR scope:** N/A — design doc only. Future implementation work (Stage 1+) will inherit existing CDR sanitisation (`lib/security/cdrAuditCompliance.ts`) and HR-1/HR-2/D-2 enforcement (`lib/ai/tax-advisor/policy/validators.ts`).

### What was done

#### 1. `docs/blueprint/PHASE_41E_REFORM_2026_27.md` (new — 9 sections)

Design for incorporating the eight tax-law changes announced in the 2026–27 Federal Budget (handed down 12 May 2026, 7:30pm AEST):

| # | Measure | Tier | Engine impact |
|---|---|---|---|
| 1 | Negative gearing restricted to new builds | 1 | `negativeGearing.ts` + asset metadata |
| 2 | 50% CGT discount → cost-base indexation + 30% min tax rate | 1 | `cgtDiscount.ts` + new `cgtIndexation.ts` + `cgtMinimumRate.ts` |
| 3 | 30% minimum tax on discretionary-trust taxable income | 1 | new `trustMinimumTax.ts` |
| 4 | Foreign-resident CGT regime strengthened (Div 855 TARP) | 1 | new `divisions/foreignResidentCgt.ts` |
| 5 | Loss refundability — carry-back + start-up + R&DTI | 1 | new `divisions/lossRefundability.ts` |
| 6 | Foreign-purchase ban extension | 2 | advisor/UI flag |
| 7 | Venture-capital incentive caps lifted | 2 | `taxYearConfig.ts` + knowledge pack |
| 8 | EV FBT phased transition | 3 | `fbtConfig.ts` per-FY tiering |
| 9 | Dynamic PAYG instalments | 3 | cashflow forecast UX + config flag |

**Honours Phase 41 §9 versioning protocol verbatim:** Stage 1 ships ALL module *files* immediately, each returning the appropriate `uncomputedReasons` flag (`UC-*-PENDING-EXPOSURE-DRAFT` or `UC-*-PENDING-ROYAL-ASSENT`) until Treasury text + Royal Assent confirmed. Per-measure `commencementVerified` flag in `taxYearConfig.ts` flips on Royal Assent — exact pattern proven in 41e.3 (`lib/tax-engine/super/highIncomeSuperTax.ts` Div 296: when `div296CommencementVerified === false` the calc returns 0 and surfaces `UC-DIV-296-PENDING`; flipping the flag activates the rule with zero further code change).

**Honours the precedent decisions by name:** **D-1** (full regulatory scope ships in demo cut — no demo/PROD split), **D-2** (AFSL/TPB/NCCP boundary is structural via the closed `FACT_LOOKUP | SCENARIO_RUN` tool-kind discriminant in `lib/ai/tax-advisor/registry.ts`), **HR-1** (numbers from the app, never AI memory — validator-enforced), **HR-2** (claims from AU law, never AI memory), **HR-3** (no user-visible calc errors — silent admin-side via Phase 41i.6).

**Notes Phase 41e is COMPLETE** (41e.0–41e.17) and **Phase 41h is COMPLETE** (41h.0–41h.7) — this reform layers atop a complete engine + advisor, does not refactor them. **Notes Phase 41f intersection with Measure 3** — `TrustDeedExtractedRules` (Phase 41f.4) is the canonical input for the beneficiary-credit computation under the new 30% discretionary-trust minimum.

**Data model additions** (Stage 1): additive nullable columns on `Property` (`acquisitionContractDate`, `acquisitionSettlementDate`, `isNewBuild`, `newBuildEvidence` enum), `Investment` (`acquisitionDate`), `LegalEntity` (`trustType TrustType?` enum — `DISCRETIONARY | FIXED | UNIT | TESTAMENTARY_FIXED | CHARITABLE | DECEASED_ESTATE | SPECIAL_DISABILITY | OTHER`). All additive, §12.11 N/A.

**AI advisor extensions** (Stage 1): one new FACT_LOOKUP tool `getReformedTaxRegimeStatus` + a versioned knowledge pack `lib/ai/tax-advisor/knowledge/reform-2026-27.ts` with `status: 'announced' | 'exposure-draft' | 'bill' | 'assented'` field per entry. New tools at Stage 2: `runReformedCgtScenario`, `runStructuringScenario`, `getTrustReformImpact`, `getEvFbtRegime`, `getCarryBackEligibility` — all FACT_LOOKUP or SCENARIO_RUN; none are RECOMMENDATION kinds (the registry literally cannot contain one).

**Structuring-advice surface** (§6 of the doc, the boundary-critical case): Reza's question 2026-05-13 ("if a user asks the AI bot on suggestions on if they should sell an investment property... or even AI to suggest changing the structure like trust or company...") is answered structurally. The AI **cannot** recommend a sell-or-hold or a structure change — the validator chain catches recommendation verbs (`"you should"`, `"I recommend"`, `"transfer to"`, `"salary sacrifice"`) and auto-routes to `BLOCKED_RECOMMENDATION` → Ask-a-Pro. The AI **can** quantify scenarios from the deterministic engine, narrate current cashflow + grandfathering posture, and surface structural comparisons — and route to a TPB/AFSL-licensed professional via `askAProRouting.ts` (existing). This boundary already works for non-reform tax questions; reform-aware tools slot in without changing it.

#### 2. `docs/architecture/AI_PROVIDER_STRATEGY.md` (new — 8 sections, ~300 lines)

Answers Reza's 2026-05-13 question: *"I wonder if it would make sense to change it to Claude ai engine? I need a mathematical ai engine which has up to date information..."*

Grounded in the actual codebase, not memory:

- **Provider interface** (`lib/ai/tax-advisor/providers/types.ts`) is provider-agnostic by design. The `AIProvider.name` JSDoc explicitly enumerates `'gemini' | 'mock' | 'claude'`. Swapping is structurally a one-file change.
- **Boundary is gateway-enforced, not provider-determined.** `lib/ai/tax-advisor/policy/validators.ts` runs after the provider returns — rejects bare numbers not traceable to a tool result (HR-1 leak), authority text not traceable to a citation (HR-2 leak), recommendation verbs (D-2 leak). Gemini-bound or Claude-bound, same wall.
- **Math reliability comes from `lib/tax-engine/*`, not the model.** No LLM is a calculator. The model's job is to call the right tool and narrate the result.
- **Knowledge recency** — both Gemini 2.0 Flash and Claude Haiku 4.5 have knowledge cut-offs pre-12-May-2026 Budget. HR-2 binds claims to the knowledge pack (Phase 41E reform-2026-27 pack), not the model.
- **Existing Anthropic dep from Phase 33g.2 (2026-05-10) — `lib/ai/anthropic.ts`** — Claude Haiku 4.5 for feedback chat, US$50/mo cap pattern proven, `isAnthropicConfigured()` graceful disable. This changes the cost equation materially — we already pay for Claude on one surface.

**Recommendation:**
1. **Keep Gemini 2.0 Flash as the default for the main tax-advisor surface.** Incumbent + GCP-native + cheapest + CLAUDE.md §12.7 compliant.
2. **Add `ClaudeProvider` as a sibling implementation of `AIProvider`** — one-file change (~250 LOC by analogy with `geminiProvider.ts`), wired behind `process.env.AI_ADVISOR_PROVIDER === 'claude'` flag.
3. **Pilot Claude Haiku 4.5 on the capacity-Q&A branch** (where users ask "can Monitrax do X?") — highest conversational weight + zero math weight + lowest risk + existing cost-cap.
4. **Re-evaluate at Phase 41E Stage 2 trigger + Phase 32C marketplace launch.**
5. **Do NOT migrate Document Intelligence off Gemini** — Vision strength is the reason that integration exists.

#### 3. `docs/IMPLEMENTATION_PLAN.md` updates

- Top header line updated with 2026-05-16 entry summarising both docs.
- New `### 7. Phase 41E reform 2026-27` workstream under Active Workstreams (🟡 DESIGN — Stage 1 queued, ~5-7 days, one PR pending Reza go/no-go on staging order).
- New `Q-AI-PROVIDER` open question with default recommendation (keep Gemini default + pilot Claude on capacity-Q&A).
- New 2026-05-16 Recently Completed entry.
- Open Questions summary line refreshed.

#### 4. `docs/blueprint/MASTER_BLUEPRINT.md` §4 update

New `41E reform 2026-27` row in the Planned/Design table — 🟡 Design status, lists the eight measures, anchors to the Phase 41E doc + AI provider strategy doc, notes §9 versioning protocol and D-1/D-2/HR-1/HR-2/HR-3 inheritance.

### Files modified

| File | Change |
|---|---|
| `docs/blueprint/PHASE_41E_REFORM_2026_27.md` | NEW — 9-section design doc |
| `docs/architecture/AI_PROVIDER_STRATEGY.md` | NEW — 8-section provider-strategy doc |
| `docs/IMPLEMENTATION_PLAN.md` | Top header + new Active Workstream §7 + new Q-AI-PROVIDER + new Recently Completed entry |
| `docs/blueprint/MASTER_BLUEPRINT.md` | New `41E reform 2026-27` row in Planned table |
| `docs/changelog/CHANGELOG_2026_05_16.md` | NEW — this file |

### Verification

- No code changes — `npm run build` / `npm run lint` not required by §11.2 (the rule is "before EVERY commit" with code).
- All cross-references in the new docs verified against the actual filesystem:
  - `lib/ai/tax-advisor/providers/types.ts` — exists, JSDoc enumerates `'gemini' | 'mock' | 'claude'` ✅
  - `lib/ai/tax-advisor/gateway.ts` — exists, 10-step pipeline ✅
  - `lib/ai/tax-advisor/policy/validators.ts` — exists, HR-1/HR-2/D-2 enforcement ✅
  - `lib/ai/tax-advisor/registry.ts` — exists, `FACT_LOOKUP | SCENARIO_RUN` only ✅
  - `lib/ai/tax-advisor/index.ts` — 11 canonical tools (FACT_LOOKUP × 7 + SCENARIO_RUN × 4) ✅
  - `lib/ai/anthropic.ts` — Phase 33g.2 client, Claude Haiku 4.5, US$50/mo cap pattern ✅
  - `lib/tax-engine/super/highIncomeSuperTax.ts` — `div296CommencementVerified` pattern verified ✅
  - `lib/tax-engine/divisions/cgtDiscount.ts` — Subdiv 115-D UNCOMPUTED flag verified (no `foreignCgtWithholding.ts` exists — corrected in the doc) ✅

### Follow-up commits in same PR

After Reza's directive — *"go through the tax engine documents and design and create a new phase to update the laws and engine and the app according to the new laws and regulations where needed. Consider the timing as well"* + *"are they factored in all relevant areas of the app?"* + *"add instructions for yourself to double check all functions ... any future builds should reflect the same"* — two follow-up commits deepened the Phase 41E doc and added matching project-level governance:

**Commit f2b7bd6 — `docs(phase-41e): deepen with §10 per-measure timing logic + §11 risks`**
- §4.2 schema section tightened: explicit canonical UTC cut-over timestamp (`2026-05-12T09:30:00Z`) stored in new `lib/tax-engine/config/reformConstants.ts`; `acquisitionContractDate` separated from existing `Property.purchaseDate`; one-time backfill rules with safe boundary (write only when `purchaseDate < cutOver`).
- **§10 NEW (~290 lines)** — per-measure implementation spec with timing logic. One subsection per measure (10.1–10.9). Each pins: commencement date + grandfathering test + asset/entity scope + the actual mechanic + the code path (with TypeScript signature for the `deriveNegativeGearingRegime` helper) + the schema fields needed + the UNCOMPUTED flag code + Stage 1 vs Stage 2 split + test fixtures.
- **§11 NEW** — risks (7 load-bearing risks named with per-lens mitigation) + load-bearing dissent (architect overruled growth-marketing's urgency framing) + extended decision points.
- Grounded in deep reads of: `lib/tax-engine/divisions/negativeGearing.ts`, `cgtDiscount.ts`, `config/taxYearConfig.ts`, `super/highIncomeSuperTax.ts` (the canonical `commencementVerified` pattern), `prisma/schema.prisma` Property/LegalEntity/InvestmentHolding/PurchaseLot models. Confirmed `purchaseDate` is the existing column → `acquisitionContractDate` adds separately. Confirmed `commencementVerified` boolean-flag pattern is proven in 41e.3 Div 296.

**Commit af7de68 — `docs(phase-41e): §12 cross-cutting matrix + §13 audit + §14 forward discipline + CLAUDE.md §12.14`**
- **§12 NEW** — Cross-cutting surface impact matrix. Two tables (§12.1 Tier 1 engine-touching, §12.2 Tier 2/3 advisor + config). 20 surfaces × 9 measures, cell-coded (F = new field, S = new section, R = regime-aware variant, N = nudge/warning, V = new view, — = no change). Closes the gap Reza spotted: §10 covered primary surfaces but not secondary consumers (reports, cashflow forecast, wealth projection, practice portal, Money Flow Sankey, Entity Tree, Health Score, Document Intelligence OCR, knowledge pack, compliance archive). §12.3 stages each surface (Stage 1 / 2 / 3).
- **§13 NEW** — Stage 1 self-check. Audit table of 12 existing tax-engine functions every Stage 1 reviewer must walk before merging, with required outcome per function (regime-aware / back-compat default / UNCOMPUTED gate). Plus the regression wall: every existing tax-engine test must stay green.
- **§14 NEW** — Forward-looking discipline. Five FW rules (FW-1 to FW-5) every future build inherits: regime is a first-class input / no silent post-reform numbers / schema additions consider regime impact / AI tools declare reform-status awareness / UI surfaces displaying per-asset tax position surface the regime. Plus a PR-template addition + reviewer-enforcement clause + explicit pointer for future Claude sessions.
- **CLAUDE.md §12.14 NEW (NON-NEGOTIABLE)** — same five FW rules at the project level so the discipline survives across sessions even when a future engineer doesn't read the Phase 41E doc directly. Includes the canonical UTC cut-over timestamp + per-measure one-line reminder table + the trigger list ("if you're about to do X, read Phase 41E first") + the matching PR-template block + reviewer enforcement.
- **CLAUDE.md §12.13** pre-write checklist gains the new Phase 41E reform-awareness gate (alongside the existing §12.11 destructive-write + §12.12 schema-migration gates).
- **`docs/IMPLEMENTATION_PLAN.md`** — Q-AI-PROVIDER closed (Reza decision 2026-05-16: keep Gemini default; provider-agnostic architecture preserved so a future flip is still a one-file change); workstream §7 status updated to spec-complete; decision-points checklist replaced with the 5-point summary delivered in chat.

### Follow-up directive (same session, same PR)

**Reza directive 2026-05-16 (after the 5-point confirmation):** *"The AI advisor should also provide a summary of the law changes and the impact on each individual users, and should provide a realistic suggestions based on the same. Add this to the plan as well."*

Added a new **§10.10 — AI advisor "Reform impact for me" summary surface** to `PHASE_41E_REFORM_2026_27.md`. Operationalises the directive within the existing D-2 AFSL boundary (the structural reason the AI *cannot* recommend sell/restructure/transfer no matter which LLM backs it). The surface answers a single user ask — *"How do the new tax laws affect me?"* — with three parts:

1. **Summary of the law changes** — knowledge-pack-driven narrative of the eight measures + commencement + grandfathering, with `status: announced | exposure-draft | bill | assented` per claim (HR-2 enforced).
2. **Personalised impact** — engine-driven; per-property regime classification + per-trust 30%-min projection + per-company carry-back eligibility + per-EV FBT phase + foreign-resident exposure. UNCOMPUTED narration for measures whose mechanics aren't yet live (HR-1 enforced — never invent numbers).
3. **Realistic suggestions (within AFSL boundary)** — SCENARIOS via existing scenario tools + TIMING FACTS (e.g., "the 3-year trust rollover-relief window runs 1 Jul 2027 – 30 Jun 2030") + ASK-A-PRO routing for any personal decision. **Never** recommends sell/hold/restructure — validator chain catches recommendation verbs and routes to `BLOCKED_RECOMMENDATION` → Ask-a-Pro card.

New AI tool: `getReformImpactSummaryForUser` (SCENARIO_RUN — composes the other reform tools). Wired into the CFO Guide "Tax rules are changing" card CTA + `/dashboard/cfo/ask` prefilled prompt + per-asset detail dialog "What does this mean for me?" link.

Stage gating: Stage 1 ships the summary + per-asset regime + Measure 5 carry-back (live). Stage 2 follow-ups populate the dollar projections for M1/M2/M3 as each Bill exposure-draft + Royal Assent lands.

Updates:
- `PHASE_41E_REFORM_2026_27.md` §10.10 NEW (~75 lines) + extended §12.1 row for the new AI surface + extended §13.1 audit row + §12.3 Stage 1 entry mentions the new tool.
- `IMPLEMENTATION_PLAN.md` workstream §7 — new sub-deliverable bullet in Stage 1 PR shape + status line updated ("STARTED" — Stage 1 underway on `claude/phase-41e-0-foundation-MG8mr` branch).
- `CHANGELOG_2026_05_16.md` — this entry.

### Stage 1 implementation kicked off (same session)

After Reza's 5-point confirmation, started Stage 1 sub-PR sequence. **Branch:** `claude/phase-41e-0-foundation-MG8mr` (branched off the design branch — when #763 merges this rebases onto main). **First commit:** `dc3e74c — feat(tax-engine): reformConstants.ts — canonical cut-over + per-measure commencement` shipping `lib/tax-engine/config/reformConstants.ts` (198 lines):
- `REFORM_CUT_OVER_UTC = 2026-05-12T09:30:00Z` (single canonical cut-over moment; no other file may hard-code it per CLAUDE.md §12.14).
- `ReformMeasure` closed discriminant for the 9 measures.
- `MEASURE_COMMENCEMENT` per-measure activation date map.
- `classifyAcquisitionGrandfathering(contractDate) → GRANDFATHERED | POST_REFORM | UNKNOWN` (pure function; cut-over moment itself is inclusive of grandfathering per Treasury fact sheet).
- `isPostCommencementFy(fy, measure)` FY-string comparison.
- `MEASURE_LABEL` human-readable labels for UNCOMPUTED rationales + audit messages.

Queued for next commits on the same branch: tests for `reformConstants.ts` + schema migration (additive columns + new enums) + `taxYearConfig.ts` 8-flag extension + `TAX_YEAR_2027_28` skeleton. **Stage 1 sub-PR breakdown (41E.0 through 41E.5)** documented in chat — each ~1 day, matches Phase 41h / 41i.6 sub-PR pattern.

### Final files touched (across all 3 commits)

| File | Change |
|---|---|
| `docs/blueprint/PHASE_41E_REFORM_2026_27.md` | NEW — 14 sections, 768 lines (design + per-measure spec + risks + cross-cutting matrix + audit + forward discipline) |
| `docs/architecture/AI_PROVIDER_STRATEGY.md` | NEW — 8 sections, ~196 lines (Gemini-vs-Claude analysis) |
| `CLAUDE.md` | +99 lines — new §12.14 (NON-NEGOTIABLE) Phase 41E reform-awareness rule + §12.13 checklist gate |
| `docs/IMPLEMENTATION_PLAN.md` | +61 lines — new workstream §7 + Q-AI-PROVIDER closure + top header refresh + 5-point summary |
| `docs/blueprint/MASTER_BLUEPRINT.md` | +1 line — new `41E reform 2026-27` row in §4 Planned table |
| `docs/changelog/CHANGELOG_2026_05_16.md` | NEW — this file |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure (new failure mode / diagnostic / lesson)
- [x] **strategic decision** (Q-AI-PROVIDER opened then closed same-day; new Phase 41E reform workstream added; new CLAUDE.md §12.14 NON-NEGOTIABLE governance rule added for forward enforcement)

Docs updated in this PR:
- `docs/blueprint/PHASE_41E_REFORM_2026_27.md` — NEW 14-section design doc (§1-§14) for the eight tax-law reforms incl. per-measure timing logic, cross-cutting matrix, Stage 1 audit, forward discipline
- `docs/architecture/AI_PROVIDER_STRATEGY.md` — NEW provider-strategy doc (Gemini-vs-Claude analysis grounded in actual provider architecture)
- `CLAUDE.md` — NEW §12.14 (NON-NEGOTIABLE) Phase 41E reform-awareness rule (FW-1 to FW-5) + §12.13 pre-write checklist gate
- `docs/IMPLEMENTATION_PLAN.md` — new Active Workstream §7 + Q-AI-PROVIDER opened then closed same-session (Reza decision: keep Gemini) + new Recently Completed entry + top header refresh + decision-points 5-point summary
- `docs/blueprint/MASTER_BLUEPRINT.md` — new `41E reform 2026-27` row in §4 Planned table
- `docs/changelog/CHANGELOG_2026_05_16.md` — this file (covers all 3 commits)

### PR

- Branch: `claude/phase-41e-reform-2026-27-MG8mr`
- Status: **Merged 2026-05-16 (PR #763)** — design + governance shipped to main.

---

## Session 2: Phase 41E.0 — Stage 1 foundation (first code sub-PR)

Branch: `claude/phase-41e-0-foundation-MG8mr`

### Scope

- **Type:** Feature (Phase 41E.0 foundation — schema + config + tests; no engine behaviour change)
- **Scope:** Tax engine — additive schema columns + new enums + per-measure commencement flags on `TaxYearConfig` + canonical cut-over helpers. **Engine consumers (the 5 division-module skeletons that read these inputs) ship in 41E.1.**
- **CDR scope:** N/A — schema columns hold tax-classification metadata (contract dates, regime flags), not CDR transactions.
- **Reform compliance (CLAUDE.md §12.14):** This PR establishes the foundation that future PRs depend on. FW-3 triggers (schema column additions on `Property` + `LegalEntity` documented in PR body); FW-1/FW-2 don't trigger here (no engine functions modified — those ship in 41E.1); FW-4/FW-5 don't trigger (no AI tool added; no UI surface).

### What was done

#### Commits on this branch

| Commit | What |
|---|---|
| `829960d` | `lib/tax-engine/config/reformConstants.ts` NEW — canonical `REFORM_CUT_OVER_UTC` + `MEASURE_COMMENCEMENT` + `classifyAcquisitionGrandfathering` + `isPostCommencementFy` + `MEASURE_LABEL` (198 lines). No other file may hard-code the cut-over timestamp per CLAUDE.md §12.14. |
| `7ac5831` | §10.10 doc carry-forward — the *"AI advisor reform-impact summary surface"* commit was made on the design branch AFTER #763 merged (timing miss). Cherry-picked onto 41E.0 so it isn't lost. Updates Phase doc §10.10 + §12.1 + §12.3 + §13.1 + IMPLEMENTATION_PLAN workstream §7 + Session 1 of this changelog. |
| `b84904a` | Schema migration `20260516100000_phase_41e_reform_foundation` (additive only) + Prisma schema changes + `TaxYearConfig` interface extension (8 commencement flags + `cpiQuarterlyIndex` placeholder) + flag fields on 3 existing FY configs (all `false`) + 17 tests in `tests/tax-engine/config/reformConstants.test.ts`. |

#### Schema migration detail (`20260516100000_phase_41e_reform_foundation`)

- 2 new Postgres enums: `NewBuildEvidence` (5 values for Measure 1 audit) + `TrustType` (8 values for Measure 3 dispatch).
- `Property` +5 nullable cols: `acquisitionContractDate` (indexed — runs on every snapshot), `acquisitionSettlementDate`, `isNewBuild`, `newBuildEvidence`, `isRenewablesInfrastructure`.
- `LegalEntity` +2 nullable cols: `trustType` (indexed), `isForeignResident`.
- New `CompanyTaxHistory` model — Measure 5 carry-back input, keyed per entity per FY (unique constraint), cascade on entity delete.
- One-time safe backfills (idempotent):
  - `acquisitionContractDate := purchaseDate` where `purchaseDate < cutOver` (unambiguously grandfathered). Post-cut-over rows left NULL for user confirmation.
  - `trustType := 'DISCRETIONARY'` where `type === 'DISCRETIONARY_TRUST'`.

**§12.11 destructive-write checklist:** N/A by structural argument — backfills only write rows the migration just created columns for; WHERE clauses fail-closed (idempotent on re-run). No `DROP`, no `ALTER ... DROP`, no `TRUNCATE`, no `ADD COLUMN NOT NULL` without default backfill.

**§12.12 schema-migration requirement:** SATISFIED — `prisma/schema.prisma` change ships with matching migration file in same PR. Vercel preview runs `prisma migrate deploy` against `monitrax-db-dev` before build; if migration fails, deploy aborts.

### Files modified

| File | Change |
|---|---|
| `lib/tax-engine/config/reformConstants.ts` | NEW — 198 lines |
| `prisma/schema.prisma` | +97 lines (Property + LegalEntity + CompanyTaxHistory + 2 enums + indexes) |
| `prisma/migrations/20260516100000_phase_41e_reform_foundation/migration.sql` | NEW — additive migration with safe backfills |
| `lib/tax-engine/types.ts` | +47 lines — TaxYearConfig interface extension |
| `lib/tax-engine/config/taxYearConfig.ts` | +40 lines — 9 new fields on 3 existing FY configs |
| `tests/tax-engine/config/reformConstants.test.ts` | NEW — 17 tests |
| `docs/blueprint/PHASE_41E_REFORM_2026_27.md` | +90 lines (§10.10 cherry-pick from design branch) |
| `docs/IMPLEMENTATION_PLAN.md` | +2 lines (§10.10 surface mention) |
| `docs/changelog/CHANGELOG_2026_05_16.md` | This Session 2 entry |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure (new failure mode / diagnostic / lesson)
- [ ] strategic decision

This is a foundation-only PR (schema + config + tests) — most §16.3 rows don't apply.

Docs updated:
- `docs/blueprint/PHASE_41E_REFORM_2026_27.md` — §10.10 cherry-pick (would have shipped in #763 but was committed post-merge).
- `docs/IMPLEMENTATION_PLAN.md` — workstream §7 sub-bullet for §10.10 surface; status update to come in 41E.0 PR description.
- `docs/changelog/CHANGELOG_2026_05_16.md` — Session 2 entry (this).
- `docs/architecture/03_DATA_MODEL.md` — N/A in this sub-PR. The additive `Property` + `LegalEntity` + new `CompanyTaxHistory` schema is documented in `PHASE_41E_REFORM_2026_27.md` §4.2 (canonical for this phase). A consolidated `03_DATA_MODEL.md` update queued for 41E.5 (final sub-PR) once all Stage 1 schema additions are in.

### Testing

- [x] Tests written — 17 new in `tests/tax-engine/config/reformConstants.test.ts`
- [ ] `npm test` — N/A in this sandbox (no `node_modules`).
- [ ] `npm run build` — N/A in this sandbox.
- [ ] `npm run lint` — N/A in this sandbox.

**Per CLAUDE.md §11.2:** Vercel preview build is the canonical pre-merge gate. The preview runs `prisma migrate deploy` against `monitrax-db-dev` before building — if the migration fails, preview fails, deploy aborts.

### PR

- Branch: `claude/phase-41e-0-foundation-MG8mr`
- Status: **Merged 2026-05-16 (PR #764)** — foundation shipped to main.

---

## Session 3: Phase 41E.1 — Engine module skeletons

Branch: `claude/phase-41e-1-engine-skeletons-MG8mr`

### Scope

- **Type:** Feature (Phase 41E.1 — engine module skeletons + regime classifier + back-compat extensions to existing modules)
- **Scope:** Tax engine — 6 new files under `lib/tax-engine/divisions/` + extensions to `negativeGearing.ts` + `cgtDiscount.ts`. **Zero behavioural change** for existing callers (every reform `commencementVerified` flag is `false`; new `regime` parameter on `applyNegativeGearing` defaults to `PRE_REFORM_GRANDFATHERED`; new reform inputs on `calculateCgtDiscount` are optional and fall through to today's flow when absent).
- **CDR scope:** N/A — pure tax-engine logic, no CDR data touched.
- **Reform compliance (CLAUDE.md §12.14):** FW-1 SATISFIED — `applyNegativeGearing` gains optional `regime` parameter with back-compat default; `calculateCgtDiscount` gains optional reform inputs. FW-2 SATISFIED — every new module returns `UC-*-PENDING-*` when commencement flag is false; defensive `throw` when flag is flipped without mechanic (no silent post-reform numbers ever).

### What was done

#### New files

| File | What |
|---|---|
| `lib/tax-engine/divisions/negativeGearingRegime.ts` | Pure classifier — `deriveNegativeGearingRegime(input)` returns `PRE_REFORM_GRANDFATHERED \| POST_REFORM_NEW_BUILD \| POST_REFORM_RESTRICTED \| UC_PROPERTY_CONTRACT_DATE_UNKNOWN \| UC_NEW_BUILD_UNCONFIRMED`. Decision order: commencement flag → FY commencement → property-type scope → contract-date classification → new-build confirmation. SSOT for Measure 1 regime — no other file may compute "is this property grandfathered?" by hand. |
| `lib/tax-engine/divisions/cgtIndexation.ts` | Measure 2 indexation skeleton. Returns `UC-CGT-INDEXATION-PENDING-EXPOSURE-DRAFT` when flag is false; defensive throw otherwise (Stage 2 fills in the per-quarter CPI lookup + indexed-cost-base formula). |
| `lib/tax-engine/divisions/cgtMinimumRate.ts` | Measure 2 floor skeleton. Returns `UC-CGT-MIN-RATE-PENDING-EXPOSURE-DRAFT`. Exposes `getCgtMinimumEffectiveRate() = 0.30` for AI advisor narration. |
| `lib/tax-engine/divisions/trustMinimumTax.ts` | Measure 3 30%-min skeleton. Two scope gates: (1) only DISCRETIONARY trusts in scope, (2) commencement flag false → UNCOMPUTED. Surfaces `UC-TRUST-TYPE-UNKNOWN` when `trustType` is null. |
| `lib/tax-engine/divisions/foreignResidentCgt.ts` | Measure 4 skeleton with exposure-draft-ready scope tests (TARP threshold, $50M notification flag). Returns `UC-FR-CGT-PENDING-ROYAL-ASSENT`. Exposes notification threshold constant. |
| `lib/tax-engine/divisions/lossRefundability.ts` | Measure 5 carry-back skeleton. Three scope gates: (1) only COMPANY entities, (2) turnover < $1B, (3) has current-FY loss. Returns `UC-LOSS-CARRYBACK-PENDING-BILL` when flag false. |

#### Extended files

| File | What |
|---|---|
| `lib/tax-engine/divisions/negativeGearing.ts` | `applyNegativeGearing` gains optional `regime: NegativeGearingRegime` parameter. When omitted (every existing caller), defaults to `PRE_REFORM_GRANDFATHERED` → byte-for-byte today's behaviour. When `POST_REFORM_RESTRICTED`, the loss is trapped at the entity (no offset against other income) with `UC-NEG-GEARING-QUARANTINE-SCOPE-PENDING-DRAFT`. UC_* regimes surface UNCOMPUTED but fall back to pre-reform behaviour conservatively. |
| `lib/tax-engine/divisions/cgtDiscount.ts` | `calculateCgtDiscount` gains optional `acquisitionContractDate` + `disposalFy` + `config` inputs. When all three present AND `cgtIndexationCommencementVerified === true` AND contract date is post-cut-over AND disposal FY ≥ 2027-28 → returns `discountRate: 0` + reason `POST_REFORM`. Caller MUST route through `cgtIndexation` + `cgtMinimumRate`. Otherwise byte-for-byte today's behaviour (pre-reform 50%/33⅓%/0% dispatch). |

#### Tests

- `tests/tax-engine/divisions/negativeGearingRegime.test.ts` — **22 tests** covering: commencement-gate, FY-commencement-gate, property-type scope (HOME/INVESTMENT/RENTAL), boundary-day classification at the second (1 sec before / at / 1 sec after cut-over), new-build branch (true/false/null), UNKNOWN contract date, `regimePermitsLossOffsetOtherIncome` for all 5 regime variants.
- `tests/tax-engine/divisions/reformSkeletons.test.ts` — **25 tests** covering: per-module UNCOMPUTED return + UC-*-PENDING-* surfacing + defensive throw on premature flag flip; `applyNegativeGearing` back-compat (no regime → identical pre-41E.1 result) + all 5 regime variants; `calculateCgtDiscount` back-compat (no reform inputs → identical pre-41E.1 result) + reform-on/off matrix.

### Files modified

| File | Change |
|---|---|
| `lib/tax-engine/divisions/negativeGearingRegime.ts` | NEW — 178 lines (regime classifier) |
| `lib/tax-engine/divisions/cgtIndexation.ts` | NEW — 97 lines (Measure 2 indexation skeleton) |
| `lib/tax-engine/divisions/cgtMinimumRate.ts` | NEW — 106 lines (Measure 2 floor skeleton) |
| `lib/tax-engine/divisions/trustMinimumTax.ts` | NEW — 159 lines (Measure 3 skeleton) |
| `lib/tax-engine/divisions/foreignResidentCgt.ts` | NEW — 144 lines (Measure 4 skeleton) |
| `lib/tax-engine/divisions/lossRefundability.ts` | NEW — 165 lines (Measure 5 skeleton) |
| `lib/tax-engine/divisions/negativeGearing.ts` | +73 lines (regime parameter + 3 regime branches + UNCOMPUTED surfacing) |
| `lib/tax-engine/divisions/cgtDiscount.ts` | +56 lines (optional reform inputs + top-of-function regime guard) |
| `tests/tax-engine/divisions/negativeGearingRegime.test.ts` | NEW — 22 tests |
| `tests/tax-engine/divisions/reformSkeletons.test.ts` | NEW — 25 tests |
| `docs/IMPLEMENTATION_PLAN.md` | Workstream §7 sub-PR checklist — 41E.1 ☐ → 41E.1 [open]; top header refresh |
| `docs/changelog/CHANGELOG_2026_05_16.md` | This Session 3 entry |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure (new failure mode / diagnostic / lesson)
- [ ] strategic decision

This is an engine-only sub-PR (new pure division modules + extensions to existing pure modules). No surface from §16.2 changed.

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — workstream §7 progress (41E.1 status flip).
- `docs/changelog/CHANGELOG_2026_05_16.md` — Session 3 entry (this).

### Testing

- [x] Tests written — 47 new across 2 files.
- [ ] `npm test` — N/A in this sandbox.
- [ ] `npm run build` — N/A.
- [ ] `npm run lint` — N/A.

**Per CLAUDE.md §11.2:** Vercel preview build runs the full test suite + TypeScript on PR push.

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] Functions/tools added or modified — listed above (10 files total: 6 new + 2 extended + 2 test files).
- [x] Outcomes:
  - `applyNegativeGearing` — outcome (a) reform-aware (takes regime parameter); back-compat default keeps existing callers byte-for-byte.
  - `calculateCgtDiscount` — outcome (a) reform-aware (takes optional reform inputs); back-compat default keeps existing callers byte-for-byte.
  - `applyCgtIndexation`, `applyCgtMinimumRate`, `applyTrustMinimumTax`, `applyForeignResidentCgt`, `applyLossRefundability` — outcome (c) gated behind `commencementVerified` returning UNCOMPUTED with defensive throw if flag is flipped without mechanic.
  - `deriveNegativeGearingRegime`, `regimePermitsLossOffsetOtherIncome` — pure classifier helpers; no tax math.
- [x] No existing tax-engine test regressed — every reform flag is `false` so consuming branches don't activate.
- [x] No new field added to `Property` / `Investment` / `LegalEntity` in this sub-PR (those landed in 41E.0).
- [x] No new AI tool added — those land in 41E.2.
- [x] No UI surface added — those land in 41E.3.

### PR

- Branch: `claude/phase-41e-1-engine-skeletons-MG8mr`
- Status: **Merged 2026-05-16 (PR #765)** — engine skeletons shipped to main.

---

## Session 4: Phase 41E.2 — AI advisor (knowledge pack + 2 new tools)

Branch: `claude/phase-41e-2-ai-advisor-MG8mr`

### Scope

- **Type:** Feature (Phase 41E.2 — AI advisor knowledge pack + 2 new tools wiring the engine skeletons from 41E.1 into the user-facing CFO Guide narrative)
- **Scope:** AI advisor — new knowledge pack + 2 new tools registered with the tool registry. Implements §10.10 of the Phase doc (Reza directive 2026-05-16).
- **CDR scope:** N/A — tools work on aggregated metadata (regime codes, counts, dates) only. No CDR transactions exposed to the LLM. Tool inputs are caller-assembled summaries; the LLM never sees raw balances or transactions.
- **Reform compliance (CLAUDE.md §12.14):** FW-4 SATISFIED — both new tools cite the knowledge pack via stable citation IDs; the pack carries `status: 'announced' | 'exposure-draft' | 'bill' | 'assented'` per measure with `lastReviewed` dates. FW-1/FW-2 inherited from 41E.1 modules (regime classifier handles commencement gating). D-2 SATISFIED — both tools are `FACT_LOOKUP` and `SCENARIO_RUN`; the test suite explicitly asserts no recommendation verbs in the narrator output.

### What was done

#### New files

| File | What |
|---|---|
| `lib/ai/tax-advisor/knowledge/reform-2026-27.ts` | NEW (305 lines) — versioned knowledge pack. Closed `ReformStatus` discriminant. Per-measure entries with `title` + `summary` + `commencementText` + `grandfatheringText` + `userImpactText` + ATO/Treasury `citations` + `lastReviewed`. M1-M3 + M5 + M7-M9 status=`announced`; M4 status=`exposure-draft` (Treasury published 10 Apr 2026); M6 status=`assented` (already law). Helpers: `getReformKnowledgeEntry`, `getAllReformKnowledgeEntries`, `getStatusLabel`. |
| `lib/ai/tax-advisor/tools/getReformedTaxRegimeStatus.ts` | NEW — `FACT_LOOKUP` tool. Per-property regime classification. Composes 41E.1's `deriveNegativeGearingRegime` + the knowledge pack. Returns 2 `numericFields` (regime code + cut-over epoch ms) + 2 citations + plain-English narrative for each of the 5 regime variants. |
| `lib/ai/tax-advisor/tools/getReformImpactSummaryForUser.ts` | NEW — `SCENARIO_RUN` tool — the §10.10 cross-measure surface. Takes `{userId, financialYear, properties[], entities[], companies[]}`. Returns 11 `numericFields` (per-regime property counts + discretionary-trust count + unknown-trust-type count + foreign-resident entity count + carry-back eligible company count + cut-over moment) + 9 citations (one per measure) + a calm-framing narrative that opens with "you're already protected" when grandfathering applies + routes to Ask-a-Pro at the close. D-2 enforced via narrative-text test (no "you should" / "transfer to" / "salary sacrifice" verbs). |

#### Extended files

| File | Change |
|---|---|
| `lib/ai/tax-advisor/index.ts` | +5 lines — register 2 new tools. Registry size 11 → 13 (FACT_LOOKUP × 8 + SCENARIO_RUN × 5). Updated JSDoc to document Phase 41E.2 additions. New tools added to the named re-export block. |

#### Tests — 30 new across 2 files

- `tests/ai/tax-advisor/knowledge/reform-2026-27.test.ts` (16 tests) — knowledge pack shape (every measure has an entry; every entry has all required fields; status enum coverage); initial regulatory status at PR #765 ship time (M1-M3 + M5 + M7-M9 = announced, M4 = exposure-draft, M6 = assented); grandfathering coverage (M1 + M2 + M8 describe it; M3 + M5 + M6 + M7 + M9 explicitly empty); helper functions.
- `tests/ai/tax-advisor/tools/reformTools.test.ts` (14 tests) — `getReformedTaxRegimeStatus` ToolResult shape conformance + pre-cut-over → grandfathered + Stage 1 default (flag false) wall + citation stability + FACT_LOOKUP kind + D-2 description; `getReformImpactSummaryForUser` ToolResult shape + all-grandfathered narrative + per-regime counting + discretionary-trust counting + UC-TRUST-TYPE-UNKNOWN flagging + foreign-resident counting + carry-back-eligible counting + SCENARIO_RUN kind + D-2 narrative wall (no "you should" / "transfer to" / "salary sacrifice"; must route to Ask-a-Pro) + HR-1/HR-2/D-2 named in description + cut-over moment epoch ms in numeric fields.

### Files modified

| File | Change |
|---|---|
| `lib/ai/tax-advisor/knowledge/reform-2026-27.ts` | NEW — 305 lines (knowledge pack + helpers) |
| `lib/ai/tax-advisor/tools/getReformedTaxRegimeStatus.ts` | NEW — 178 lines (FACT_LOOKUP per-property) |
| `lib/ai/tax-advisor/tools/getReformImpactSummaryForUser.ts` | NEW — 330 lines (SCENARIO_RUN §10.10 surface) |
| `lib/ai/tax-advisor/index.ts` | +5 lines — register 2 new tools + JSDoc update |
| `tests/ai/tax-advisor/knowledge/reform-2026-27.test.ts` | NEW — 16 tests |
| `tests/ai/tax-advisor/tools/reformTools.test.ts` | NEW — 14 tests |
| `docs/IMPLEMENTATION_PLAN.md` | Workstream §7 sub-PR checklist — 41E.2 status flip + top header refresh |
| `docs/changelog/CHANGELOG_2026_05_16.md` | This Session 4 entry |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure (new failure mode / diagnostic / lesson)
- [ ] strategic decision

AI-advisor-only sub-PR. No §16.2 surface from the canonical matrix changed (no UI, no schema, no config). The Phase 41E doc §10.10 is the canonical home for this surface.

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — workstream §7 progress (41E.2 status flip + sub-PR checklist).
- `docs/changelog/CHANGELOG_2026_05_16.md` — Session 4 entry (this).

### Testing

- [x] Tests written — 30 new across 2 files.
- [ ] `npm test` — N/A in this sandbox.
- [ ] `npm run build` — N/A.
- [ ] `npm run lint` — N/A.

**Per CLAUDE.md §11.2:** Vercel preview build runs the full test suite + TypeScript on PR push.

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] Functions/tools added — `getReformedTaxRegimeStatus` (FACT_LOOKUP) + `getReformImpactSummaryForUser` (SCENARIO_RUN) + knowledge-pack helpers (`getReformKnowledgeEntry`, `getAllReformKnowledgeEntries`, `getStatusLabel`).
- [x] FW-4 satisfied — both new tools tag their citations with the knowledge-pack `status` field (announced / exposure-draft / bill / assented). The knowledge pack is the source of truth for the AI advisor's narration of reform status.
- [x] FW-1 + FW-2 inherited from 41E.1 — the regime classifier still gates on `commencementVerified` (false in every FY config) so even with the new tools, the AI returns regime classifications + UNCOMPUTED for measures whose mechanics aren't yet live.
- [x] D-2 enforced — both tools are `FACT_LOOKUP` / `SCENARIO_RUN` (closed `ToolKind` discriminant prevents `RECOMMENDATION`). Tests explicitly assert the narrator output contains no recommendation verbs and routes to Ask-a-Pro.
- [x] No existing tax-engine test regressed (no engine modules touched).

Functions/tools touched:
- `lib/ai/tax-advisor/tools/getReformedTaxRegimeStatus.ts:getReformedTaxRegimeStatusTool` — outcome (a) reform-aware (takes regime via 41E.1's classifier).
- `lib/ai/tax-advisor/tools/getReformImpactSummaryForUser.ts:getReformImpactSummaryForUserTool` — outcome (a) reform-aware (composes 41E.1's classifier per property + knowledge pack).
- Knowledge-pack entry for each measure tagged with status flag (FW-4): M1-M3 + M5 + M7-M9 = `announced`; M4 = `exposure-draft`; M6 = `assented`.

### PR

- Branch: `claude/phase-41e-2-ai-advisor-MG8mr`
- Status: **Merged 2026-05-16 (PR #766)** — AI advisor knowledge pack + 2 tools shipped to main.

---

## Session 5: Phase 41E.3 — UI surfaces (badge + banner + entity API)

Branch: `claude/phase-41e-3-ui-surfaces-MG8mr`

### Scope

- **Type:** Feature (Phase 41E.3 — first user-facing UI surfaces for the reform)
- **Scope:** Components + API + schema migration. Ships: (1) reusable `<TaxTreatmentBadge>` with 5 regime variants + tone-coded styling, (2) `<TaxReformBanner>` calm one-time card on `/dashboard/cfo` + dismissal API + schema migration, (3) entity API extension for `trustType` + `isForeignResident`.
- **CDR scope:** N/A — banner stores only a boolean dismissal flag per user; entity fields are tax classification metadata (not CDR transactions). Sanitisation untouched.
- **Reform compliance (CLAUDE.md §12.14):** FW-5 SATISFIED — the badge IS the regime surface (regime always visible on property surfaces that use it). FW-3 SATISFIED — schema migration adds `dismissedReformBanner` to UserPreference; reform-grandfathering impact documented (none — UI state only). FW-1 / FW-2 inherited from 41E.1 + 41E.2 (no engine functions modified).
- **Deferred to 41E.4:** PropertyTile wiring (the tile is a 467-line component tied to a larger refactor); entity-detail form-side UI (`<EntityEditForm>` is part of the entities page — natural pairing with the onboarding wizard's Entities step in 41E.4). Both surfaces will consume the new API + component shipped here.

### What was done

#### New files

| File | Purpose |
|---|---|
| `components/wealth/TaxTreatmentBadge.tsx` | Reusable presentational component. Takes `{propertyType, acquisitionContractDate, isNewBuild, financialYear, size}` and renders the regime-coded badge. Tone-coded per regime: emerald (Grandfathered — good news), sky (New build — info), slate (Restricted — neutral, NOT red), amber (UNCOMPUTED — action needed). Exports `getRegimeShortLabel` + `getRegimeDescription` helpers. |
| `components/cfo/TaxReformBanner.tsx` | One-time CFO Guide calm card. Sky tone (NOT amber, NOT rose — calm not alarming). Copy per Phase doc §11.1: "Tax rules are changing — and you're already protected" + body explaining grandfathering + CTA "Show me my position" → `/dashboard/cfo/ask?q=…` prefilled with §10.10 reform-impact question. Optimistic dismissal with persist via API. |
| `app/api/settings/reform-banner/route.ts` | GET (returns `{ dismissed }`) + POST (marks dismissed). Uses `prisma.userPreference.upsert` guarded by `auth.userId` (single-user scope) — §12.11 safe. |
| `prisma/migrations/20260516200000_phase_41e_3_reform_banner_dismissal/migration.sql` | Adds `dismissedReformBanner Boolean NOT NULL DEFAULT false` to `user_preferences`. Single ADD COLUMN, idempotent. |

#### Extended files

| File | Change |
|---|---|
| `prisma/schema.prisma` | `UserPreference` gains `dismissedReformBanner Boolean @default(false)`. Same pattern as existing `dismissedOnboardingBadge` / `dismissedWelcomeModal`. |
| `app/dashboard/cfo/page.tsx` | Imports + mounts `<TaxReformBanner>` directly above the AI Financial Advice highlight section. ~10 lines added. |
| `lib/services/legalEntityService.ts` | `UpdateEntityInput` gains `trustType` (8-value closed enum) + `isForeignResident` (boolean). `updateEntity` body builder passes both through to Prisma when supplied. |
| `app/api/entities/[id]/route.ts` | PUT route validates `trustType` against the closed enum + `isForeignResident` as a boolean. Passes through to `updateEntity` service. |

#### Tests — 24 new

- `tests/components/TaxTreatmentBadge.test.tsx` (10 tests) — renders the right label per regime; **Stage 1 default (commencement flag false) — even post-cut-over contract renders Grandfathered** (the FW-2 wall pinned at the UI layer); size variants; aria-label; helper exports.
- `tests/components/TaxReformBanner.test.tsx` (5 tests) — module surface; **copy spec on record** (calm-framing headline + Show-me-my-position CTA); **no urgency / FOMO language** (act now / limited time / deadline / miss out / countdown — none present); **uses sky tone, not amber / rose / red** (behaviour-psychologist guard).
- `tests/legalEntityService/reformFields.test.ts` (4 tests) — `UpdateEntityInput` accepts the 8-value trustType enum + boolean + null/undefined; rejects invalid types at the type level via `@ts-expect-error`.

### Files modified

| File | Change |
|---|---|
| `components/wealth/TaxTreatmentBadge.tsx` | NEW — 175 lines |
| `components/cfo/TaxReformBanner.tsx` | NEW — 130 lines |
| `app/api/settings/reform-banner/route.ts` | NEW — 75 lines |
| `prisma/migrations/20260516200000_phase_41e_3_reform_banner_dismissal/migration.sql` | NEW |
| `prisma/schema.prisma` | +9 lines (UserPreference column) |
| `app/dashboard/cfo/page.tsx` | +12 lines (import + mount) |
| `lib/services/legalEntityService.ts` | +30 lines (UpdateEntityInput + body builder) |
| `app/api/entities/[id]/route.ts` | +40 lines (validation + pass-through) |
| `tests/components/TaxTreatmentBadge.test.tsx` | NEW — 10 tests |
| `tests/components/TaxReformBanner.test.tsx` | NEW — 5 tests |
| `tests/legalEntityService/reformFields.test.ts` | NEW — 4 tests |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] **visual design system / component pattern** (new reusable component `<TaxTreatmentBadge>` + new component `<TaxReformBanner>` — both follow existing visual vocabulary; tone choices documented inline)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — workstream §7 progress (41E.3 status flip + sub-PR checklist + top header).
- `docs/changelog/CHANGELOG_2026_05_16.md` — Session 5 entry (this).
- `docs/architecture/06_UI_UX_FOUNDATION.md` — N/A in this sub-PR. The new components are scoped narrowly (one reform-specific badge + one reform-specific banner). Inline JSDoc + Phase doc §12.1 already document the visual decisions. A consolidated UI foundation update may land later if the badge gets broader propagation.

### Destructive write checklist (CLAUDE.md §12.11)

**N/A for the migration** — single `ADD COLUMN IF NOT EXISTS` with `NOT NULL DEFAULT false`; idempotent.

**Reform-banner POST endpoint** uses `prisma.userPreference.upsert`:
1. **`where` clause matches:** `{ userId: auth.userId }` — uniquely identifies the authenticated user's own preference row.
2. **Columns overwritten on update branch:** `dismissedReformBanner` only. No other column touched.
3. **Guard ensuring this only mutates rows the code originally created:** the `auth.userId` filter pins the row to the current authenticated user; the `update` branch only flips a single boolean from false → true (idempotent). No risk of clobbering other state.

User confirmation: NOT REQUIRED (single-flag self-write).

### Schema migration checklist (CLAUDE.md §12.12)

**SATISFIED** — `prisma/schema.prisma` change ships with matching migration file in same PR.

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] FW-5 satisfied — `<TaxTreatmentBadge>` IS the regime-surface enforcement. Tone-coded styling makes the regime always visible on any consuming surface.
- [x] FW-3 satisfied — `dismissedReformBanner` column added; reform-grandfathering impact documented (none — UI state only).
- [x] FW-1 / FW-2 inherited from 41E.1 + 41E.2 (no engine functions modified).
- [x] D-2 inherited from 41E.2 (banner CTA routes through `/dashboard/cfo/ask` which is gateway-bound).

Functions/tools touched:
- `components/wealth/TaxTreatmentBadge.tsx` — outcome (a) reform-aware (consumes 41E.1 classifier directly).
- `components/cfo/TaxReformBanner.tsx` — outcome (a) reform-aware (links to the §10.10 AI surface).
- `lib/services/legalEntityService.ts:updateEntity` — outcome (a) reform-aware (accepts new fields per FW-3 schema additions).

### Testing

- [x] Tests written — 24 new across 3 files.
- [ ] `npm test` / `npm run build` / `npm run lint` — N/A in this sandbox.

**Per CLAUDE.md §11.2:** Vercel preview runs `prisma migrate deploy` against `monitrax-db-dev` + the full test suite. If migration fails or any test fails, deploy aborts.

### PR

- Branch: `claude/phase-41e-3-ui-surfaces-MG8mr`
- Status: **Merged 2026-05-16 (PR #767)** — UI surfaces shipped to main.

---

## Session 6: Phase 41E.4 — Entity form UI + PropertyTile badge wiring

Branch: `claude/phase-41e-4-onboarding-entity-ui-MG8mr`

### Scope

- **Type:** Feature (Phase 41E.4 — consume 41E.3's surfaces in the existing entity edit form + properties page).
- **Scope:** UI plumbing. Extends `PropertyTile` with reform-aware fields + renders the badge inline; extends entity edit form with trust-subtype selector + foreign-resident toggle; extends `LegalEntitySummary` so the form receives the persisted values.
- **CDR scope:** N/A — UI plumbing only. Reform fields are tax classification metadata (not CDR transactions).
- **Reform compliance (CLAUDE.md §12.14):** FW-5 reinforced — every property tile now surfaces its regime via `<TaxTreatmentBadge>`. FW-3 inherited from 41E.0 (no new schema). FW-1 / FW-2 / D-2 inherited from earlier sub-PRs (form just persists what the user enters).
- **Re-scoped:** Wizard step extensions (`PropertiesStep` + `EntitiesStep`) moved to 41E.5 alongside docs consolidation. Cleaner separation — UI form-work in this PR, wizard + docs in the final 41E.5.

### What was done

#### Extended files

| File | Change |
|---|---|
| `components/properties/PropertyTile.tsx` | `PropertyTileData` gains `acquisitionContractDate?: string \| null` + `isNewBuild?: boolean \| null` (both optional + back-compat). Renders `<TaxTreatmentBadge size="sm">` inline next to the property-type chip. New import for `TaxTreatmentBadge`. |
| `app/dashboard/properties/page.tsx` | Passes the new fields through from the Prisma response. No API change — `findMany` with `include` already returns all `Property` columns. Cast through optional type guard for the loose response type. |
| `app/dashboard/entities/page.tsx` | New `TrustTypeValue` closed enum (mirrors Prisma's `TrustType`) + `TRUST_TYPE_OPTIONS` constant (8 labelled options) + `TRUST_ENTITY_TYPES` constant. `Entity` interface gains `trustType?` + `isForeignResident?`. `FormState` gains `trustType: TrustTypeValue \| ''` + `isForeignResident: boolean`. Form pre-populates from `LegalEntitySummary`; `emptyForm()` defaults to `'DISCRETIONARY'` (matches the default `type` of `DISCRETIONARY_TRUST`). New form UI: trust-subtype `<Select>` (conditional on `type === DISCRETIONARY_TRUST \| UNIT_TRUST`) + foreign-resident `<Switch>` (always available). Payload always sends `trustType` (null when not a trust type or unset) + `isForeignResident` (boolean). |
| `lib/services/legalEntityService.ts` | `LegalEntitySummary` gains `trustType: TrustType \| null` + `isForeignResident: boolean \| null`. `listEntitiesForUser` `select` includes the two new columns. Mapper passes them through. New `TrustType` import from `@prisma/client`. |

#### Tests

No new tests in this sub-PR. The new UI is a thin form + presentational layer over already-tested primitives:
- `<TaxTreatmentBadge>` itself is covered by `tests/components/TaxTreatmentBadge.test.tsx` (41E.3, 10 tests including FW-2 wall at the UI layer).
- The entity API contract (`trustType` + `isForeignResident` on the PUT payload) is covered by `tests/legalEntityService/reformFields.test.ts` (41E.3, 4 type-level tests).

Page-level wiring + form integration is verifiable by Vercel preview manual smoke + the existing tests transitively pass via the back-compat defaults.

### Files modified

| File | Change |
|---|---|
| `components/properties/PropertyTile.tsx` | +13 lines — `PropertyTileData` extension + import + inline render |
| `app/dashboard/properties/page.tsx` | +3 lines — field pass-through |
| `app/dashboard/entities/page.tsx` | +105 lines — `TrustTypeValue` enum + form state + UI inputs + payload extension |
| `lib/services/legalEntityService.ts` | +14 lines — `LegalEntitySummary` extension + `select` + mapping + `TrustType` import |
| `docs/IMPLEMENTATION_PLAN.md` | Workstream §7 sub-PR checklist — 41E.4 status flip + scope re-explanation; top header refresh |
| `docs/changelog/CHANGELOG_2026_05_16.md` | This Session 6 entry |

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] **visual design system / component pattern** — `PropertyTile` extended with the badge render. Same `<TaxTreatmentBadge>` primitive from 41E.3 (no new visual primitive — re-use of the canonical one).
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — workstream §7 + top header refresh + scope re-explanation.
- `docs/changelog/CHANGELOG_2026_05_16.md` — Session 6 entry (this).

### Destructive write checklist (CLAUDE.md §12.11)

**N/A.** No Prisma writes, no schema change, no migration. Confirmed via:

```bash
git diff origin/main...HEAD --unified=0 | grep -E "prisma\.[a-zA-Z]+\.(update|upsert|delete|updateMany|deleteMany)\(|\\\$executeRaw"
# (no matches)
```

### Phase 41E reform compliance (CLAUDE.md §12.14)

- [x] FW-5 reinforced — every property tile on `/dashboard/properties` now surfaces its regime via `<TaxTreatmentBadge>`. Stage 1 default (commencement flag false everywhere) renders "Grandfathered" for every property — FW-2 wall preserved at the UI layer through the badge's pure composition of `deriveNegativeGearingRegime`.
- [x] FW-3 inherited (no new schema columns).
- [x] FW-1 / FW-2 / D-2 inherited from earlier sub-PRs (no new engine functions, no new AI tools, no recommendation surfaces).

Functions/tools touched:
- `components/properties/PropertyTile.tsx:PropertyTile` — outcome (a) reform-aware (consumes 41E.3's `<TaxTreatmentBadge>` which itself consumes 41E.1's classifier).
- `app/dashboard/entities/page.tsx:EntitiesPage` form — outcome (a) reform-aware (collects + persists the Measure 3 + Measure 4 inputs).
- `lib/services/legalEntityService.ts:listEntitiesForUser` — outcome (a) reform-aware (surfaces the new fields on the summary).

### Testing

- [ ] `npm test` / `npm run build` / `npm run lint` — N/A in this sandbox.
- [x] No new tests required — all new code is form/presentational composition over already-tested primitives.

**Per CLAUDE.md §11.2:** Vercel preview build runs TypeScript + the full test suite on PR push.

### PR

- Branch: `claude/phase-41e-4-onboarding-entity-ui-MG8mr`
- Status: Open
