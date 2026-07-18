<!--
Monitrax PR template — the blocks below are MANDATORY per CLAUDE.md.
Delete a block only if its trigger genuinely doesn't apply, and say so.
-->

## Summary

<!-- What this PR does and why. -->

## Gate (§20.6)

`Gate (§20.6): Document X/10 (doc: <name+section>) · Requirements X/10 · Logic X/10`
<!-- One line on what the self-review changed + the honest coverage boundary:
     "verifies X, does NOT verify Y" — never "tested/complete". -->

## Fix discipline (docs/architecture/MATRIX_FIX_DISCIPLINE.md — required for ANY PR that fixes a money/cashflow/tax/loan/income/expense value)

- [ ] **Holistic end-to-end map done FIRST:** every producer + every consumer of this value enumerated (FIX_PROTOCOL.md §3 censuses); four lenses read.
- [ ] **Canonical producer, not a surface:** the change is in the one canonical producer (`lib/calculations/*`, `lib/services/masterFinancialService.ts`, `lib/utils/frequencies.ts`, tax engine); any bypassing surface migrated in THIS PR — never a second copy.
- [ ] **Lints pass, exceptions did not rise:** `npm run lint:financial-surfaces` + `npm run lint:source-lock` green; `.audit/source-lock-exceptions.json` counts ratcheted DOWN for every bypass fixed here.
- [ ] **Cross-surface Ring-3:** the value reads identically on EVERY surface it appears (income ↔ tax ↔ cashflow ↔ property ↔ expenses ↔ balances) — tax-only or single-surface verification is a FAIL. **Run id:** VR-___ (or "pending — issue stays FIXING until recorded").
- [ ] **No new producer, no new duplicate record, no closed issue re-opened.**

## Neo-sync (CLAUDE.md §21.2.2 THIRD RULE — required on EVERY PR; mark N/A with a reason, never skip)

- [ ] **Neomatrix** updated in THIS PR for any producer/lineage/surface change (§21.2.1; `neomatrix:check` green) — or N/A: no financial producer/lineage touched.
- [ ] **NeoAudit** ratchet test added/updated for the bug class (Part 23.2.6 Promote) — or N/A: not a fix PR.
- [ ] **Neobrain** docs updated (Phase 54) — intake/reconciliation/categorisation/AI-grounding moved — or N/A: untouched.
- [ ] **Nothing sandbox-only:** every artefact this work produced (docs, run records, scorecards, briefs) is in this PR or already in-repo.

## What was wrong / What changed / What you'll see (§19.5 plain trio — required on every fix PR)

- **What was wrong:**
- **What changed:**
- **What you'll see:**

## Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config (env vars, Vercel, OIDC, etc.)
- [ ] GCP infrastructure (Cloud SQL, IAM, etc.)
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure (new failure mode / diagnostic / lesson)
- [ ] strategic decision (Open Question resolved / workstream parked or revived)

Docs updated in this PR:
- <!-- path/to/doc:section — what was updated (one line per checked surface) -->

## Testing

- [ ] Build passes (`npm run build`)
- [ ] Lint passes
- [ ] Vitest suites affected by this change run green (name them; state what they verify AND what they do not)
