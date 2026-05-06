# Calculation Audit — Backfill Runbook

> **Audience:** Monitrax engineers + admins responding to a confirmed calc bug.
> **When to use:** A `CalcAuditFinding` has been triaged to `FIX_REQUIRED` and the underlying engine bug has been fixed in code. This runbook covers identifying which users were affected and remediating their stored data.
> **Per HR-3:** every step here happens admin-side. Users are contacted via existing support tooling — they NEVER see a "we got your numbers wrong" UI.

---

## Decision tree

```
1. Bug confirmed (finding → FIX_REQUIRED)
2. Code fix shipped + finding → FIXED
3. Did the bug affect stored values?
   ├─ NO  (calc engine produces values on-the-fly; no DB rows changed)
   │     → No backfill needed. Mark finding FIXED + close.
   └─ YES (engine output is persisted somewhere — snapshot table, report cache,
            cached aggregate)
         → Continue to step 4.
4. Identify the affected user set (see "Identifying affected users" below)
5. Decide remediation strategy (see "Remediation strategies")
6. Execute remediation (per strategy)
7. Notify affected users via existing support tooling (see "Notification policy")
8. Verify with audit re-run
9. Close finding (already FIXED) + add admin notes summarising the backfill
```

---

## Identifying affected users

**Default assumption: most calc engines are pure** and don't persist their output. The Phase 41e engines all live under `lib/tax-engine/` and are invoked on every page load — there's no stored cache to backfill. Verify before assuming you need a backfill.

If the engine DOES persist output (e.g. a future health-score history table, a cached snapshot for performance), the affected user set is identified by:

1. Query the persistent table for rows produced by the buggy engine version
2. Filter by the engine's input shape that triggers the bug (e.g. `frequency: 'WEEKLY'` if the bug only fires on weekly inputs)
3. Cross-check with the finding's `failedAssertions` to confirm the affected scenario matches

```sql
-- Example: find users whose stored health snapshot was produced by the
-- buggy engine version. Replace with the actual table when health
-- caching ships.
SELECT DISTINCT user_id, computed_at
FROM health_snapshots
WHERE computed_at >= '<bug-introduced-date>'
  AND computed_at <  '<bug-fixed-date>'
ORDER BY computed_at;
```

---

## Remediation strategies

Pick the strategy that matches the persistence + impact:

### Strategy A — Re-compute on next access
- **When**: Stored values are cached for performance, not used for assertions/decisions.
- **How**: Invalidate the cache (set `valid_until = NOW()` or delete the row). Next user access triggers fresh compute against the fixed engine.
- **Cost**: Lowest. No active backfill needed.
- **Risk**: Stale value visible until next access (typically minutes-hours).

### Strategy B — Active backfill via batch
- **When**: Stored values feed downstream calcs or are referenced in audit-trail surfaces.
- **How**: Run a one-shot backfill script that re-invokes the fixed engine for each affected row and updates in place.
- **Pre-requisite**: Backfill script must be idempotent (safe to re-run) and respect CLAUDE.md §12.11 (destructive write checklist).
- **Skeleton**:

  ```ts
  import { prisma } from '@/lib/db';
  import { engine } from '@/lib/<path>';

  async function backfill() {
    const affected = await prisma.<table>.findMany({
      where: { /* affected criteria */ },
    });
    let fixed = 0;
    for (const row of affected) {
      const recomputed = engine(reconstructInput(row));
      await prisma.<table>.update({
        where: { id: row.id },
        data: { /* recomputed fields */ },
      });
      fixed++;
    }
    return fixed;
  }
  ```

- **Cost**: Engineering hours; observable cutover.
- **Risk**: Bugs in the backfill itself. Mitigate with a dry-run mode (log-only first pass) + idempotency.

### Strategy C — Compensating snapshot
- **When**: Affected values were already shown to users in a tax return / report and you can't retroactively change history.
- **How**: Don't overwrite; record a corrected version + flag the original as superseded. Users see the corrected version going forward.
- **Cost**: Schema work (add `supersededBy` / `correctedAt` columns).
- **Risk**: Auditability — the original wrong value must remain queryable for compliance.

---

## Notification policy

Per **HR-3 (Phase 41 §1 invariant 11)**: users do NOT see in-app warnings or banners about calc errors. Notifications happen via existing support tooling:

1. **Triage**: confirm impact severity (CRITICAL / HIGH / MEDIUM / LOW)
2. **Decide**: does the user need to be told?
   - **YES** when: the wrong number was used in a tax decision, lender submission, or financial commitment that the user took action on
   - **NO** when: the value was a glance-at metric and the wrong-by-correct-now diff is < $100 (use admin discretion)
3. **Channel**: email via Monitrax's existing customer-support flow (NOT the AI advisor surface)
4. **Copy**: plain, factual, never anxiety-inducing
   - Do say: *"During a routine review we identified a calculation update. Your <metric> has been updated from $X to $Y. The reason: <plain-English explanation of the bug>."*
   - Do NOT say: *"We made a mistake."* / *"There was an error."* / anything that triggers user anxiety beyond what the situation requires
5. **Audit log**: record every user notified via `createAuditLog({ action: 'CALC_AUDIT_USER_NOTIFIED', ... })`

---

## Verification

After backfill:

1. **Re-run the audit**: `GET /api/admin/calc-audit` — confirm no new findings
2. **Spot-check 5 affected users**: query their stored values, verify they match the corrected calculation
3. **Add admin notes** to the original `CalcAuditFinding`:
   - How many users were affected
   - Which strategy was used (A / B / C)
   - Backfill duration
   - Notification count
4. **Mark finding `FIXED`** if it isn't already
5. **Add a row** to `IMPLEMENTATION_PLAN.md` Recently Completed with the bug + fix + backfill summary

---

## Severity → response time SLA

| Severity | Initial triage | Fix | Backfill |
|---|---|---|---|
| `CRITICAL` | < 1 hr | Same day | Within 24 hr |
| `HIGH` | < 4 hr | < 3 days | Within 7 days |
| `MEDIUM` | Next business day | Next sprint | When convenient |
| `LOW` | Weekly review | Backlog | Optional |
| `INFO` | Weekly review | Backlog | Not applicable |

---

## CLAUDE.md compliance reminders

- Backfill scripts that update existing rows MUST satisfy CLAUDE.md §12.11 destructive-write checklist (3 questions in the PR body).
- Schema changes MUST ship the matching migration in the same PR per CLAUDE.md §12.12.
- Audit logs MUST sanitise CDR data per CLAUDE.md §13.3 (don't leak account balances etc. into log metadata).
- Notification copy MUST go through the warm-words rule (CLAUDE.md §0.4 + §14) — no "we got it wrong", no shame language.
