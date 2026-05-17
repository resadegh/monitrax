# Monitrax UNCOMPUTED Register

> Per Phase 41 §10 convention. Single canonical list of every `UC-*`
> identifier the tax engine + AI advisor can surface, what triggers
> it, where it surfaces, and the planned removal trigger.
>
> **The register exists because UNCOMPUTED is a load-bearing safety
> primitive — it's how the engine says "I cannot compute this and
> refuse to guess" without crashing.** Every UC-* code must:
>   1. Map to exactly one engine module / tool / surface that
>      emits it.
>   2. Be self-describing in its rationale (a future engineer
>      reading the audit log should understand WHY it fired).
>   3. Carry a removal trigger — what event would let us replace
>      the UNCOMPUTED with a real number.

## Phase 41E reform 2026-27 — UC-* codes (Stage 1 ship)

Added across PRs #764–#769. All shipped with `commencementVerified
=== false` defaults, so every UC-* listed here fires for every
relevant user input at Stage 1.

| UC-* code | Emitted by | Trigger | Surfaced in | Removal trigger |
|---|---|---|---|---|
| `UC-CGT-INDEXATION-PENDING-EXPOSURE-DRAFT` | `lib/tax-engine/divisions/cgtIndexation.ts:applyCgtIndexation` | Any caller invokes the module while `cgtIndexationCommencementVerified === false` (default for every FY at Stage 1). | Tax-position summaries / AI advisor scenario tools that touch post-reform CGT disposals. | Stage 2 ships the indexation mechanic + Treasury exposure draft + Royal Assent confirmed; flag flips, code path returns real numbers. |
| `UC-CGT-MIN-RATE-PENDING-EXPOSURE-DRAFT` | `lib/tax-engine/divisions/cgtMinimumRate.ts:applyCgtMinimumRate` | Same — `cgtMinRateCommencementVerified === false`. | Same as above (paired with indexation). | Same as above (paired flag flip). |
| `UC-TRUST-MIN-TAX-PENDING-EXPOSURE-DRAFT` | `lib/tax-engine/divisions/trustMinimumTax.ts:applyTrustMinimumTax` | Trust entity is `DISCRETIONARY` AND `trustMinTaxCommencementVerified === false`. | Trust tax-position summaries / AI advisor M3 narration. | Stage 2 ships the M3 mechanic (depends on Phase 41f.4 trust-deed extracted rules for beneficiary-credit dispatch). |
| `UC-TRUST-TYPE-UNKNOWN` | `lib/tax-engine/divisions/trustMinimumTax.ts:applyTrustMinimumTax` | Entity has `type === DISCRETIONARY_TRUST \| UNIT_TRUST` but `trustType === null`. | Entity-edit form (prompts trust-subtype selector); AI advisor reform-impact summary. | User confirms trust subtype in the entity edit form or onboarding wizard. |
| `UC-FR-CGT-PENDING-ROYAL-ASSENT` | `lib/tax-engine/divisions/foreignResidentCgt.ts:applyForeignResidentCgt` | Entity is foreign-resident AND `foreignResidentCgtCommencementVerified === false`. | Foreign-resident CGT position; AI advisor M4 narration. | Royal Assent of the Bill (exposure draft was final 24 Apr 2026 — Stage 2 mechanic is code-ready, just gated on Royal Assent). |
| `UC-LOSS-CARRYBACK-PENDING-BILL` | `lib/tax-engine/divisions/lossRefundability.ts:applyLossRefundability` | Company is eligible (turnover < $1B + has current-FY loss) AND `lossCarryBackCommencementVerified === false`. | Company tax position; AI advisor M5 narration. | Bill text final + Royal Assent (mirrors 2020-22 COVID stimulus mechanic per Treasury). |
| `UC-NEG-GEARING-QUARANTINE-SCOPE-PENDING-DRAFT` | `lib/tax-engine/divisions/negativeGearing.ts:applyNegativeGearing` | Caller passes `regime === POST_REFORM_RESTRICTED` (i.e. reform is live and the property is post-cut-over residential, not a new build). | Negative-gearing calc results when the reform branch activates. | Treasury exposure draft pins whether the loss carry-forward is per-property or per-entity. |
| `UC-PROPERTY-CONTRACT-DATE-UNKNOWN` | `lib/tax-engine/divisions/negativeGearing.ts:applyNegativeGearing` + `divisions/negativeGearingRegime.ts:deriveNegativeGearingRegime` | Property is residential + target FY post-1-Jul-2027 + `acquisitionContractDate IS NULL`. | Property detail UI (TaxTreatmentBadge renders "Confirm contract date"); AI advisor reform-impact summary; negative-gearing engine result. | User confirms contract date in property edit / onboarding wizard / property settings. |
| `UC-NEW-BUILD-UNCONFIRMED` | Same — `negativeGearing.ts` + `negativeGearingRegime.ts` | Post-cut-over residential property + `isNewBuild === null`. | Property detail UI ("Confirm new-build status" badge); AI advisor narration. | User confirms `isNewBuild` + `newBuildEvidence` in property edit form / wizard. |
| `UC-FOREIGN-RESIDENT-CGT` *(existing — pre-41E)* | `lib/tax-engine/divisions/cgtDiscount.ts:calculateCgtDiscount` | Asset disposal with `isForeignResident === true` (Subdiv 115-D apportionment not computed in v1). | CGT discount calc result. | Phase 41E Measure 4 takes over the foreign-resident path entirely (when M4 commencement flag flips, `cgtDiscount` delegates to `foreignResidentCgt.ts` and this UC is retired). |

## Surface pairing

| UI surface | UC-* codes shown to user |
|---|---|
| Property detail dialog / PropertyTile badge | `UC-PROPERTY-CONTRACT-DATE-UNKNOWN`, `UC-NEW-BUILD-UNCONFIRMED` |
| Entity detail / entity edit form | `UC-TRUST-TYPE-UNKNOWN` |
| `/dashboard/cfo/ask` AI advisor (reform-impact summary) | All of the above + the Stage-1 pending codes (advisor narrates "Monitrax will compute your projected impact once Treasury publishes the exposure draft" per the per-measure status field in the knowledge pack) |

## Operator playbook

When you see a UC-* code in an audit log or admin queue:

1. **Look up the code in this register.** Every code self-describes its trigger.
2. **Identify whether the trigger is data (missing user input) or status (rule not commenced).**
   - Data triggers → UI prompts the user to fill in the missing field. No engineer action needed.
   - Status triggers → resolved by Stage 2 / Stage 3 PRs as Treasury publishes drafts + Royal Assent.
3. **Check the matching `commencementVerified` flag in `lib/tax-engine/config/taxYearConfig.ts`** — if a status-triggered UC-* fires when the flag is `true`, something is broken (the defensive throw should catch this in tests; see `tests/tax-engine/divisions/reformActivationRoundTrip.test.ts`).

## When this register is updated

- **Every new Stage 2 mechanic PR** removes the corresponding `UC-*-PENDING-*` row from the "active" section + adds a "retired" entry below with the activation date + PR number.
- **Every new UC-* code** introduced by Phase 41 / Phase 41E follow-ups must be appended to this register in the same PR (CLAUDE.md §16 doc-sync — the register is the canonical home).
- The register lives under `docs/operational/` (not `docs/blueprint/`) because it's an operator's tool, not a design spec.
