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
- Status: Open
