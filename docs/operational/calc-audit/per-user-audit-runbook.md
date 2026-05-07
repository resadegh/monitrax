# Calculation Audit — Per-User "Audit this user" Runbook

> **Audience:** Monitrax engineers + admin support team responding to a per-user calc concern (user emails support saying "my number looks wrong"; CSAT escalation; pre-paying-user QA pass).
> **When to use:** You need to audit ONE user's calc-engine output without running a full L1 / L2 / L4 scan. The on-demand surface is `/admin/calc-audit` → "Audit this user" card.
> **Per HR-3:** every step here is admin-side. Users never see "we audited you" UI; findings flow to the existing `CalcAuditFinding` queue (source `L3_ON_DEMAND`).

Source files (the things that matter when this runbook fails):
- Harness: `lib/calc-audit/userAudit/harness.ts`
- Adapters: `lib/calc-audit/userAudit/adapters/{coreAdapters,propertyAdapters,taxAdapters}.ts`
- API: `app/api/admin/calc-audit/audit-user/[userId]/route.ts`
- Admin UI: `app/admin/calc-audit/page.tsx` (the "Audit this user" card)

---

## What "Audit this user" does

For one user, the harness:

1. Iterates every registered `UserAuditAdapter` (8 at v1: 4 core + 3 property + 1 tax).
2. For each, calls `adapter.fetchInput(userId)` → if it returns `null`, the adapter is **SKIPPED** (`NO_DATA`).
3. Looks up the matching `CalcEngine` in the engine registry → if missing, **SKIPPED** (`NO_ADAPTER`).
4. Runs `engine.execute(input)`:
   - Throws → records `L3_ON_DEMAND` finding at `HIGH` severity.
5. Calls `adapter.validateOutput(output)` (optional):
   - Returns `{ ok: false, reason, severity? }` → records finding at the adapter-specified severity (default `HIGH`).
6. Returns `OK` for every adapter that passed.

The dedup pattern is identical to L1 / L4: `findFirst → update | create` scoped to `(source: L3_ON_DEMAND, engineName, userId, resolution: {in: [OPEN, INVESTIGATING]})`. Re-running for the same user with the same persistent issue updates the existing finding rather than spamming the queue.

## When to run it

| Trigger | Action |
|---|---|
| User emails support: "my number looks wrong" | Run "Audit this user" with their userId; check report; cross-reference to existing OPEN findings before reaching out. |
| Lighthouse adviser pitch fixture user added | Run for each seeded user (Sarah / David+Emma / Olivia) to confirm baseline OK. |
| Suspected calc drift on one user reported via Sentry / Cloud Logging | Run "Audit this user" to confirm whether the drift surfaces; if YES, escalate to engineering. |
| Trust-deed CONFIRMED + tax engine results look wrong | Run with the user's userId — `tax.masterTaxPosition` adapter exercises the deed validation overlay. Check for `UC-DEED-*` flags in the orchestrator output. |

## How to run it

1. Open `/admin/calc-audit` (admin GCP session + `audit:read` permission required).
2. Find the user via Firestore admin / Cloud SQL query → copy their UUID.
3. Paste the UUID into the **Audit this user** card → click button.
4. Wait ~2-5 seconds (depends on entity count).
5. The card renders per-engine outcomes:
   - **OK** (green) — adapter ran cleanly, all invariants passed.
   - **SKIPPED** (grey) — adapter returned `null` (`NO_DATA`) or engine not registered (`NO_ADAPTER`).
   - **FINDING** (severity-coloured chip) — a finding was recorded; click through to the existing finding queue.

## Outcome interpretation

### All OK + few SKIPPED

Healthy. SKIPPED is normal for users who don't yet have data in that domain (e.g. user with no LegalEntity rows → `tax.masterTaxPosition` skipped with `NO_DATA`). No action needed.

### FINDING with `severity = HIGH`

Engine output violates a physical invariant. Common causes:

| Adapter | Likely cause | Fix path |
|---|---|---|
| `core.netWorth` | NaN/Infinity from a `currentValue` of `0` somewhere | Run user data audit on Property + Account tables; look for null/zero values in calc inputs |
| `core.incomeAggregator` | `netTotal > grossTotal + 1c` — PAYG cannot be negative | Check `Income.paygWithholding` rows; one of them is negative |
| `core.expenseAggregator` | `total != essential + discretionary` within 1c | Off-by-one in classifier or new expense category not bucketed |
| `core.loanAggregator` | `weightedInterestRate` not finite — divide-by-zero on `totalPrincipal=0` | Check `Loan.principal` rows; one is 0 but `minRepayment > 0` |
| `property.LVR` | LVR > 500% — `loanBalance >> propertyValue` | User entered a 6-figure loan against a $50k property; data-entry issue |
| `property.rentalYield` | Yield > 100% — `annualRent > propertyValue` | Likely user set rent in dollars/week but Monitrax read it as monthly. Check `Income.frequency` |

### FINDING with `severity = CRITICAL`

Identity violation — the engine math fundamentally broke.

| Adapter | Identity that broke | Action |
|---|---|---|
| `core.netWorth` | `netWorth != assets - liabilities` within 1c | **Stop the line.** Engine math is wrong. Page on-call. |
| `tax.masterTaxPosition` | `taxableIncome > assessableIncome + 1c` | **Stop the line.** Deductions made the assessable bigger — orchestrator broken. Page on-call. |
| `tax.masterTaxPosition` | `estimatedRefund != paygWithheld − netTax` | **Stop the line.** Aggregation broken. Page on-call. |

### FINDING with deed-related UNCOMPUTED flags

The `tax.masterTaxPosition` adapter exercises the trust-deed validation overlay added in 41f.4-extension. Findings under this surface point at user-data/deed mismatches, not engine bugs:

| UNCOMPUTED ID | What it means | Support response |
|---|---|---|
| `UC-DEED-BENEFICIARY-NOT-IN-DEED-{entityId}-{benId}` | User's annual trustee resolution distributed to someone the deed doesn't list. | Tell user: deed appears out of date OR resolution is wrong. They re-upload an amended deed (deed flow at `/dashboard/entities/[id]/trust-deed`) OR fix the resolution. |
| `UC-DEED-BENEFICIARY-EXCLUDED-{entityId}-{benId}` | **CRITICAL.** User distributed to an EXCLUDED beneficiary. May trigger s100A consequences. | Tell user: do NOT lodge with this resolution. Engage their tax agent. |
| `UC-DEED-FIXED-DISTRIBUTION-MISMATCH-{entityId}-{benId}` | FIXED/PROPORTIONATE deed rule and runtime allocation differ >1c. | Tell user: reconcile resolution against deed. |
| `UC-DEED-FIXED-BENEFICIARY-MISSING-{entityId}-{name}` | FIXED rule names a beneficiary who didn't get a distribution this FY. | Tell user: trustee resolution incomplete; deed mandates this beneficiary. |
| `UC-DEED-PRESENT-NO-RESOLUTION-{entityId}` | Trust has CONFIRMED deed but no FY trustee resolution provided. | Tell user: pass `EntityTaxFacts.trustDistribution` in their snapshot — Div 6 needs it. |
| `UC-DEED-SUB-TRUST-UPE-PRESENT-{entityId}` | Informational. Deed has sub-trust UPE provisions. | No action needed unless beneficiary has unpaid present entitlement (then Div 7A sub-trust path applies). |

## When the audit itself fails

The harness has its own error path — if `runUserAudit` throws (not adapter-throws, but harness-level), the API returns `500 AUDIT_HARNESS_ERROR` with a truncated error message.

| Symptom | Likely cause | Fix |
|---|---|---|
| 404 USER_NOT_FOUND | The userId doesn't exist | Verify in Cloud SQL: `SELECT id FROM users WHERE id = '...'`. Likely typo. |
| 500 AUDIT_HARNESS_ERROR with `Cannot read properties of undefined` | Adapter has a Prisma query that the user's data doesn't match | Read the `lib/calc-audit/userAudit/adapters/...ts` for the affected engine. Schema drift; bump the adapter. |
| 500 with `[Phase 41i.3b] UserAuditAdapter already registered` | Hot-reload registered the adapter twice | Restart the process. Production rare. |
| Audit completes with `enginesScanned: 0` | Adapter list is empty — bootstrap failed | Check `lib/calc-audit/userAudit/index.ts` imports. Missing import for the new adapter file. |

## Runbook upkeep

When a new calc engine ships, the HR-3 reviewer rule (CLAUDE.md §6 / Phase 41 §11) requires either:
1. A matching `UserAuditAdapter` registered, OR
2. PR description that explicitly justifies why per-user audit doesn't apply (e.g. engine is a pure utility with no user data — `lib/utils/frequencies.ts:toAnnual`).

Reviewers MUST reject any PR that adds a calc engine without one of those.

## Related

- [Calc Audit Backfill Runbook](./backfill-runbook.md) — when a finding has been triaged to FIX_REQUIRED + the bug is fixed.
- [Cloud Scheduler Setup](./cloud-scheduler-setup.md) — for L2 anomaly + L4 surface scheduled scans.
- [PHASE_41_REGULATORY_ARCHITECTURE.md §11](../../blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md) — HR-3 invariant 11 and the four audit layers.
- [PHASE_41I_6_SURFACE_AUDIT.md](../../blueprint/PHASE_41I_6_SURFACE_AUDIT.md) — L4 surface audit (companion to per-user L3).
