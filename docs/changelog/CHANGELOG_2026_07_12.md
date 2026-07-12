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

---

## Session: chat-audit-findings-issues-m9518i (continued) — Ring 2 service-tier

### Change: NeoAudit Ring 2 — Golden Household end-to-end through the REAL master service

- **Type**: Test infrastructure (Ring 2 of the Part-23 four-ring defense)
- **Scope**: `tests/golden/` — no production code changed
- **Why**: Rings 0/1 verify engines and wiring; nothing verified the full
  fetch → map → engine → snapshot ASSEMBLY on known data. The MON-028 class
  (a select silently dropping a field, a mapping feeding an engine partial
  inputs) lives exactly there.
- **Solution**:
  - `tests/golden/goldenHousehold.ts` — the Golden Household "Avalon": fixture
    rows shaped exactly like `fetchAllUserData`'s Prisma selects, every headline
    number hand-computed (§19.2) with derivations documented in the header.
    Deliberate constraints: NET salary (GROSS would route through the full
    PAYG tables — Ring 0's job), no transactions (declared basis), amounts
    chosen for exact conversions (600/wk = 2,600/mo).
  - `tests/golden/ring2.masterSnapshot.test.ts` — mocks `@/lib/db` with a Proxy
    that THROWS on any model the golden DB doesn't serve (a new query in the
    service fails loudly), runs the REAL `getMasterFinancialSnapshot`, and
    asserts the manifest: net-worth assembly (SMSF + SOLD exclusions), declared
    cashflow + savings rate 50.96, MON-009 rental dedup, emergency fund,
    per-property equity/LVR/yield/cashflow, quickMetrics mirrors, the
    MON-028-class INPUT-PARITY check (engine run directly on golden inputs ==
    snapshot), and the Ring-3 tie (computeSelfAuditReport ALL PASS).
  - Two NEGATIVE CONTROLS prove the harness can fail: dropping the loan from
    the engine inputs breaks parity; zeroing liabilities fails the report (I1).

### Verified locally (vitest now runs in-container)
- `tests/golden/ring2.masterSnapshot.test.ts` — **16/16 pass**
- Full `tests/golden` + `tests/verification` — **74/74 pass**
- `npm run neomatrix:check` + `lint:financial-surfaces` — green (tests/ not census-scoped)

### Observation (flagged, not fixed here)
- Running the tax engine logs "Tax config not found for 2026-27, using latest
  available (2025-26)" — FY 2026-27 began 1 Jul 2026; the engine falls back to
  2025-26 rates (per the Phase 41E commencement gating this is by design until
  rates are verified, but worth Reza's awareness that FY26-27 config is absent).

### Addendum: Ring 2 route-tier (same PR)
- `tests/golden/ring2.propertyRoute.test.ts` — invokes the ACTUAL
  `GET /api/properties/[id]` handler (the MON-028 type specimen) in-process on
  the golden household. Real: handler body, `verifyOwnership`,
  `enrichPropertiesWithActuals` (prisma reads served by the golden DB),
  NextResponse serialization. Mocked (honest scope): `withPermission` injects
  the golden user (token verification is Ring-1/unit territory); `@/lib/db`
  `findUnique` honours `where.id` so the 404/ownership path stays live.
  Asserts: `linkedTransactions` PRESENT in the serialized JSON (the exact
  MON-028 dropped-field regression), relations survive serialization with the
  fields the page's engine needs, page-level parity (serialized payload →
  `computePropertyCashflow` reproduces the manifest numbers), unknown id → 404.
- Local run: 4/4; full golden+verification suites 78/78.
