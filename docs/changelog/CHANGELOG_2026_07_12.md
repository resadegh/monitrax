# Changelog — 2026-07-12

## Session: chat-audit-findings-issues-m9518i

### Change: NeoAudit "Audit account" picker — run Ring-3 self-audit on any user

- **Type**: Feature
- **Scope**: NeoAudit R3-self (admin panel + endpoints)
- **Why**: The self-audit panel (`/admin/neoaudit`) was hard-wired to
  `getMasterFinancialSnapshot(auth.userId)` — it could only ever audit the
  logged-in admin account, which holds empty test data ($3.9M net worth, $0
  liabilities, 3 properties with $0 mortgages). Reza couldn't point Ring-3 at a
  real account. The advisories (shipped 2026-07-12) correctly flagged the admin
  account as test data — this change lets him select a real one.
- **Solution**:
  - Extracted the invariant + advisory computation into ONE shared
    `lib/verification/selfAuditInvariants.ts` (`computeSelfAuditReport`), so the
    self endpoint and the new admin endpoint run identical logic (§12.2.1/§12.3
    — no second producer).
  - New admin endpoint `GET /api/admin/neoaudit?userId=…`, gated exactly like
    the existing user-detail endpoint (`isAdminPortalAccessible` +
    `verifyAdminGCPAuth` + `hasPermission(role, 'users:read')`), audit-logged
    via `adminAuditLog` (action `NEOAUDIT_RUN`; metadata carries only the
    PASS/FAIL shape — no dollar figure, §13.2/§13.3).
  - Panel gains an "Audit account" picker (fed by `/api/admin/users`): default
    "My account (self)" → the self endpoint; a selected user → the admin
    endpoint. "Auditing account:" shows the selected email.
- **CDR (§13)**: no posture expansion — reuses the same admin-data-access path
  already used to view a user's financials in the portal; returns aggregates +
  accounting identities only (net worth, totals, per-property equity), never raw
  transactions/BSBs; every run audit-logged.

### Files Modified / Added
- `lib/verification/selfAuditInvariants.ts` — **new**; the ONE shared invariant + advisory computation.
- `app/api/verify/invariants/route.ts` — refactored to a thin wrapper on the shared function.
- `app/api/admin/neoaudit/route.ts` — **new**; admin-gated, audit-logged, targeted audit.
- `components/admin/neoaudit/NeoAuditPanel.tsx` — "Audit account" picker; self vs admin endpoint routing.
- `tests/verification/selfAuditInvariants.test.ts` — source locks updated for the split; adds admin-endpoint gating + audit-log locks.
- `docs/blueprint/NEOAUDIT.md` — R3-self node + build-plan step 2 document the admin variant.
- `docs/financial-logic/graph/structural/structural-graph.json` — Layer-0 census registers the two new files.
- `.audit/financial-math-exceptions.json` — regenerated (the 4 annotated identity assertions moved route→lib).

### Build Status
- [x] `npm run neomatrix:check` — census gate 0 uncovered, invariants hold, markdown fresh
- [x] `npm run lint:financial-surfaces` — 0 new violations (4 annotated exceptions carried across the move)
- [x] Source-lock literals pre-verified against the actual files
- [ ] TypeScript / vitest — CI (local tsc/vitest unavailable; verified by CI + Vercel build)

### Verification note (§19.4/§23)
No financial number changed — this is a new READ surface over the existing
canonical snapshot. The invariant maths is unchanged (moved verbatim into the
shared lib); the same computation now runs against a selectable user. Ring-3
real-data confirmation is Reza selecting his real account in the panel.
