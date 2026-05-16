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

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure (new failure mode / diagnostic / lesson)
- [x] **strategic decision** (Open Question added: Q-AI-PROVIDER; new Phase 41E workstream added)

Docs updated in this PR:
- `docs/blueprint/PHASE_41E_REFORM_2026_27.md` — NEW design doc for the eight tax-law reforms
- `docs/architecture/AI_PROVIDER_STRATEGY.md` — NEW provider-strategy doc
- `docs/IMPLEMENTATION_PLAN.md` — new Active Workstream §7 + new Q-AI-PROVIDER + new Recently Completed entry + top header refresh
- `docs/blueprint/MASTER_BLUEPRINT.md` — new `41E reform 2026-27` row in Planned table
- `docs/changelog/CHANGELOG_2026_05_16.md` — this file

### PR

- Branch: `claude/phase-41e-reform-2026-27-MG8mr`
- Status: Open
