# Phase 41i.6 — Surface-Level Numerical Audit

> **Status:** 🟡 **DRAFT — awaiting Reza sign-off** on the strategic decisions in §10 before any code lands.
> **Estimated effort:** ~6 days across 3 sub-PRs (41i.6a registry → 41i.6b CI lint → 41i.6c runtime harness + Full Scan).
> **Hard prerequisite:** Phase 41i.0–5 ✅ (calc-audit foundation + persistent findings + alerting). Phase 41h ✅ (AI advisor structural validators — same HR-1 lineage).
> **Last updated:** 2026-05-07 — Claude (initial draft).

---

## 1. Strategic positioning

Reza brief 2026-05-07:

> "I need the calc Audit agent to be able to review all relevant calculations of monitrax and the results, for example the cashflow numbers, the expense tile or even a tax calculations and highlight any possible miscalculations to the Admin portal with a possible Full scan option. This way we can continuously make sure all calculations and produced numbers in monitrax is accurate and trustworthy and not some made up incorrect numbers."

Phase 41i.6 is the **trustworthiness commitment**: a structural guarantee that **every number a user sees on a Monitrax surface traces to a canonical source and that the value rendered matches the value the canonical source returns**. It catches a class of bug the existing Phase 41i layers cannot:

- A component renders `incomes[0].amount * 12` inline instead of consuming `snapshot.cashflow.annualIncome`.
- A tile reads `quickMetrics.savings` when it should read `quickMetrics.savingsRate.value`.
- A page caches a stale snapshot.
- A surface does its own math (CLAUDE.md §6.1 violation that slipped through review).

---

## 2. How this layer extends Phase 41i

| Layer | What it catches | Catches surface bugs? |
|---|---|---|
| **L1 — Deterministic regression** (41i.0+1) | Engine output drifts from canonical fixture (`capTracker(FY24-25)` returns ≠ $30,000) | ❌ |
| **L2 — Temporal anomaly** (41i.5) | Patterns of finding-frequency spikes / regression after long stable period | ❌ |
| **L3 — Persistent findings + lifecycle** (41i.3) | Workflow on top of L1/L2 — every finding persists with full audit trail | ❌ |
| **L3b — Per-user "Audit this user"** (41i.3b queued) | Engine output for THAT specific user's data drifts from stored snapshot | ❌ — engine-level only |
| **L4 — Surface-level numerical audit** (THIS PR) | The **rendered tile shows X** but the **canonical engine for that data says Y** | ✅ |

L4 is the missing layer. L1/L2/L3/L3b all live at the **engine** layer — they confirm engines are correct. L4 confirms the **bridge** between engine and rendered UI is correct.

---

## 3. The four lenses that drove this design

| Lens | What it asked | What it locked in |
|---|---|---|
| **Architect** | Don't fork a new audit system; extend the existing one. Reuse `CalcAuditFinding` lifecycle. Surface descriptors must be discoverable via filesystem + registered explicitly so the registry IS the spec. | New enum value `L4_SURFACE_AUDIT` on `CalcAuditFindingSource`. New `lib/calc-audit/surfaces/` folder containing one descriptor per surface. Single canonical full-scan harness invoked by both the cron path (future) and the manual Full Scan button. |
| **Financial adviser** | A wrong number on a surface = user makes a bad decision = advice failed. The whole reason HR-1 / HR-2 / HR-3 exist is to prevent this. This is the operationalization of HR-1 at the rendering layer. | **HR-3 is extended** in `PHASE_41_REGULATORY_ARCHITECTURE.md` from "calc-engine drift" to "calc-engine drift OR surface-rendering drift." Reviewers reject any new financial surface that doesn't ship with a registered surface descriptor. |
| **Designer** | Admin sees ONE queue. Don't split L1/L2/L3/L4 into separate pages. Filter chips per source. Full Scan button has a clear progress UI because full scans are slow at scale. | Single `/admin/calc-audit` page with new `[L4_SURFACE_AUDIT]` filter chip + new `[Full scan]` action button + per-finding card variant showing surfaceId + canonical source path + actual rendered value + diff. |
| **Behaviour psychologist** | This is a HUGE confidence multiplier — for Reza personally and for advisors-using-Monitrax-with-clients. The current build is fast; without this, "did we show the right number?" lingers as background anxiety. | "The audit is silent — that's the system working as designed (HR-3)." The empty-state copy framing carries forward. |

---

## 4. Architecture decisions (D-41i.6-1 → D-41i.6-5)

| # | Decision | Recommendation | Open / Confirmed |
|---|---|---|---|
| **D-41i.6-1** | **Coverage scope at v1** — every user-facing financial surface, or top N? | **Top 10 highest-impact surfaces at v1**, expand list as workstream matures. v1 list: cashflow tile, expense tile, income tile, net-worth tile, health-score tile, tax page summary, debt-freedom tile, emergency-fund tile, properties net-equity tile, investments total tile. | OPEN |
| **D-41i.6-2** | **Diff tolerance** — exact-match (zero cents) for AUD; what about ratios + percentages? | **AUD: exact match (zero cents).** Ratios + percentages: tolerance of 0.01 (one basis point). Health scores (0–100): tolerance of 0.5. Documented per descriptor; descriptor `tolerance` field overrides default. | OPEN |
| **D-41i.6-3** | **Static + runtime, or runtime only?** Static analysis catches bugs before they ship; runtime catches data-dependent drift. | **Both, phased.** 41i.6b ships the CI static-analysis pass first (fast feedback, catches the bug class at the PR level). 41i.6c ships the runtime audit harness for data-dependent cases. They're complementary. | OPEN |
| **D-41i.6-4** | **Full Scan vs targeted scan** — manually triggered, scheduled, both? | **Both.** Manual `[Full scan]` button on `/admin/calc-audit` (immediate, with progress UI). Scheduled daily Cloud Scheduler trigger reusing the 41i.5 shared-secret auth pattern (deferred to PROD until first paying users — it's a per-user iteration that costs Xero rate budget at scale). | OPEN |
| **D-41i.6-5** | **What does a finding contain?** Just the diff, or the full canonical chain? | **Full canonical chain.** Each L4 finding records: `surfaceId`, `route`, `canonicalSource: { service, method, fieldPath }`, `canonicalValue`, `renderedValue`, `diffAmount`, `diffPercent`, `userId` (so the admin can drill into the offending user's data without leaving the queue). | OPEN |

---

## 5. Sub-PR sequence (3 PRs, ~6 days)

| Sub-PR | Scope | Estimated days | Ships independently? |
|---|---|---|---|
| **41i.6a** | **Surface descriptor registry + first 10 descriptors.** New `lib/calc-audit/surfaces/` folder containing one descriptor per surface (`cashflowTile.ts`, `expenseTile.ts`, ...). New `surfaceRegistry.ts` (parallel to `engineRegistry.ts`) — singleton + bootstrap-on-import + `assertDescriptor()` guard. Extends `CalcAuditFinding` schema with `source: L4_SURFACE_AUDIT` enum value (additive migration). Tests for registry shape + descriptor invariants + first-10 coverage assertion. | 2 | ✅ Schema + registry only; no UI surface change yet |
| **41i.6b** | **CI static-analysis pass.** New `scripts/lint-financial-surfaces.ts` — grep every component file under `app/dashboard/`, `app/portal/`, and `components/` for inline financial math patterns: `Math.round(.*\* (12\|365))`, `\b(income\|expense\|revenue\|cashflow)\.\w+ [+\-*\/]`, `total\.\w+ [+\-*\/] \d`. Configured exception annotation: `/* @financial-math-allowed: <reason> */` flagged inline (e.g. for unit conversion explicitly justified). Integrated as a pre-build CI gate. Tests for the lint rule fixture matrix (positive cases must fail; exception annotations must pass; non-financial math must pass). | 1 | ✅ CI-only; no schema or runtime changes |
| **41i.6c** | **Runtime audit harness + Full Scan button.** New `lib/calc-audit/surfaceAudit.ts` — `runSurfaceAuditForUser(userId, surfaceIds?)` resolves canonical source per descriptor + computes `renderedValue` via the descriptor's `extractRenderedValue()` projection + diffs + persists findings. New `POST /api/admin/calc-audit/full-scan` (admin-session OR Cloud Scheduler shared secret per the 41i.5 pattern) — iterates every USER × every registered surface; streams progress to the response (NDJSON); persists per-finding rows. New `[Full scan]` button on `/admin/calc-audit` with progress streaming + cancel affordance + post-completion summary. New filter chip `[L4_SURFACE_AUDIT]` on the existing finding list. Per-finding card variant rendering surfaceId + canonical source + canonical value + rendered value + diff. Tests for the audit harness pure-logic helpers (extractRenderedValue, diffWithTolerance, surfacePartitioning); end-to-end runtime path smoke-tested manually. | 3 | ✅ Final PR — closes Phase 41i.6 |

**Sequencing rule:** 41i.6a ships first (the registry is the spec); 41i.6b and 41i.6c can ship in parallel after 41i.6a lands. 41i.6b is independent of the runtime harness.

---

## 6. Surface descriptor — typed shape

```typescript
// lib/calc-audit/surfaces/types.ts
export interface SurfaceDescriptor {
  /** Stable identifier — never rename; used as the audit-finding key. */
  surfaceId: string; // e.g. 'tile.cashflow.monthly'

  /** Human-readable description for the admin queue card. */
  description: string;

  /** Route the surface lives on (for the admin "open this surface" deeplink). */
  route: string; // e.g. '/dashboard/cfo'

  /** Canonical source the value MUST come from. */
  canonicalSource: {
    /** Module path (relative to repo root) — used by the static-analysis pass. */
    service: string; // e.g. 'lib/services/masterFinancialService.ts'
    /** Function name — used by both lints + runtime. */
    method: string; // e.g. 'getMasterFinancialSnapshot'
    /** Dotted field path on the returned object. */
    fieldPath: string; // e.g. 'cashflow.monthly'
  };

  /** Diff tolerance per D-41i.6-2. Defaults: AUD 0; ratios 0.01; scores 0.5. */
  tolerance?: {
    absolute?: number; // e.g. 0 for AUD
    relative?: number; // e.g. 0.01 for 1bp
  };

  /**
   * Runtime extractor — given the canonical-source result, returns the
   * SAME projection the surface renders. This is the bridge that the
   * audit harness compares against the rendered DOM value.
   */
  extractRenderedValue: (sourceResult: unknown) => number | null;

  /**
   * Optional — when the surface has any conditional rendering logic
   * (e.g. "show '—' when zero"), describe it here so the harness
   * doesn't fire spurious findings for the zero state.
   */
  renderConditions?: {
    skipWhenZero?: boolean;
    skipWhenNull?: boolean;
  };
}
```

**Example registration:**

```typescript
// lib/calc-audit/surfaces/cashflowTile.ts
import type { SurfaceDescriptor } from './types';

export const cashflowMonthlyTile: SurfaceDescriptor = {
  surfaceId: 'tile.cashflow.monthly',
  description: 'Monthly cashflow tile on /dashboard/cfo',
  route: '/dashboard/cfo',
  canonicalSource: {
    service: 'lib/services/masterFinancialService.ts',
    method: 'getMasterFinancialSnapshot',
    fieldPath: 'cashflow.monthly',
  },
  tolerance: { absolute: 0 }, // AUD — zero cents
  extractRenderedValue: (snap) =>
    (snap as MasterFinancialSnapshot).cashflow?.monthly ?? null,
  renderConditions: { skipWhenNull: true },
};
```

The registry imports every descriptor at module load; the bootstrap throws on duplicate `surfaceId`.

---

## 7. CI static-analysis pass (41i.6b)

**The lint detects three patterns:**

| Pattern | Example | Verdict |
|---|---|---|
| Inline frequency conversion | `income.amount * 12`, `expense.weekly * 52` | ❌ — must use `lib/utils/frequencies.ts:toMonthly()` / `toAnnual()` (CLAUDE.md §6.2 SSOT) |
| Inline arithmetic on financial fields | `total.income - total.expenses`, `revenue - opex` | ❌ — must consume the canonical service result |
| Hardcoded financial constants | `0.10` for GST, `0.15` for SMSF tax, `30000` for super cap | ❌ — must come from `lib/tax-engine/config/taxYearConfig.ts` |

**Exception annotation** — when inline math is genuinely correct (e.g. UI-only formatting of a currency that's already canonical), the line carries:

```typescript
const monthlyDisplay = annualValue / 12; /* @financial-math-allowed: UI-only display formatting; canonical annual already from getMasterFinancialSnapshot */
```

The lint records every annotated exception in a JSON sidecar (`.audit/financial-math-exceptions.json`) so reviewers can audit accumulated exceptions over time.

**Run as a pre-build CI step:** `npm run lint:financial-surfaces` is added to the existing `vercel-build` script; failures abort the build (per CLAUDE.md §12.12 — schema-level safety pattern).

---

## 8. Runtime audit harness (41i.6c)

**Algorithm:**

```
function runSurfaceAuditForUser(userId, surfaceIds = ALL):
  findings = []
  for descriptor in surfaceIds.map(id => registry.get(id)):
    sourceResult = await call(descriptor.canonicalSource)(userId)
    canonicalValue = descriptor.extractRenderedValue(sourceResult)

    if descriptor.renderConditions?.skipWhenNull && canonicalValue === null:
      continue
    if descriptor.renderConditions?.skipWhenZero && canonicalValue === 0:
      continue

    # The rendered value comes from a parallel canonical-source resolution
    # that mirrors what the component would render. This is NOT a headless
    # browser — it's a server-side re-derivation that proves the bridge.
    renderedValue = await reDeriveSurfaceValue(descriptor, userId)

    diff = computeDiff(canonicalValue, renderedValue, descriptor.tolerance)

    if diff.exceedsTolerance:
      findings.push(createFinding({
        source: 'L4_SURFACE_AUDIT',
        severity: severityFromDiff(diff),
        engineName: descriptor.surfaceId,
        userId,
        summary: `${descriptor.surfaceId}: canonical $${canonicalValue} vs rendered $${renderedValue} (Δ ${diff.amount})`,
        failedAssertions: [{
          path: descriptor.canonicalSource.fieldPath,
          expected: canonicalValue,
          actual: renderedValue,
          diff: diff.amount,
        }],
      }))
  return findings
```

**Key structural choice:** the harness re-derives the surface value **from the canonical source itself**. It does NOT scrape the rendered DOM. Rationale:
- A headless-browser scrape introduces flakiness (auth + token + SSR + hydration races).
- The component-level audit catches the bug at the right layer: did the component CONSUME the canonical source correctly (vs. inline math / wrong field path)?
- The static-analysis pass (41i.6b) catches the COMPLEMENTARY bug class: components that bypass the canonical source entirely.
- Together they cover the surface bridge structurally.

**Persistence:** every finding lands in the existing `CalcAuditFinding` table with `source: L4_SURFACE_AUDIT`, `engineName: <surfaceId>`, `userId: <target user>`. The 41i.4 alerting layer fires on severity ≥ HIGH with no further changes.

---

## 9. Schema additions (41i.6a)

**Single additive migration** — extends the existing `CalcAuditFindingSource` enum:

```sql
-- Phase 41i.6a — Surface-level audit source
ALTER TYPE "CalcAuditFindingSource" ADD VALUE 'L4_SURFACE_AUDIT';
```

CLAUDE.md §12.11: N/A — pure enum extension; no row mutations.
CLAUDE.md §12.12: migration ships in same PR as schema.

No other schema changes. The existing `CalcAuditFinding` row shape covers everything the harness needs (`engineName` ← `surfaceId`; `userId` already present from 41i.3b's queued spec).

---

## 10. UI changes (41i.6c)

| Surface | Change |
|---|---|
| `/admin/calc-audit` page | New `[Full scan]` action button next to the existing `[Refresh]` button. Streams NDJSON progress; renders per-user-completed counter + ETA + cancel affordance. |
| Findings list filter chips | New `[L4_SURFACE_AUDIT]` chip alongside `[L1_DIFFERENTIAL]` / `[L2_ANOMALY]` / `[L3_ON_DEMAND]`. |
| Per-finding card variant (when `source === 'L4_SURFACE_AUDIT'`) | Renders: `surfaceId`, `description`, `route` (clickable deeplink), `canonicalSource: service.method.fieldPath`, `canonicalValue` (formatted AUD), `renderedValue` (formatted AUD), `diff` (formatted AUD + relative %), `userId` (clickable deeplink to user-detail page when 41i.3b's per-user surface ships). |
| Lifecycle counts tile | Adds an `L4_SURFACE_AUDIT` counter to the existing 5-stat lifecycle row. |

---

## 11. Test plan (per sub-PR)

| Sub-PR | Test focus |
|---|---|
| **41i.6a** | Migration applies cleanly (enum value added); registry rejects duplicates + missing fields; first-10 descriptors all register cleanly; descriptor invariants (`canonicalSource.service` ends with `.ts`; `fieldPath` non-empty; `extractRenderedValue` is a function). |
| **41i.6b** | Lint fixture matrix: 10 positive cases (each must fail the lint); 5 negative cases (must pass); 5 annotated-exception cases (must pass + record annotation in sidecar JSON). |
| **41i.6c** | Pure-logic helpers — `extractRenderedValue` per descriptor; `computeDiff` with tolerance variants (zero / 1bp / 0.5pt); `severityFromDiff` mapping; `surfacePartitioning` (skips zero / null per `renderConditions`). End-to-end runtime path smoke-tested manually after deploy. |

---

## 12. Reza sign-off block

Tick each before 41i.6a starts:

- [ ] **D-41i.6-1** confirmed: top 10 surfaces at v1 (cashflow / expense / income / net-worth / health / tax / debt-freedom / emergency-fund / property-equity / investment-total)
- [ ] **D-41i.6-2** confirmed: diff tolerance — AUD 0 cents; ratios 0.01 (1bp); scores 0.5pt
- [ ] **D-41i.6-3** confirmed: ship both static (41i.6b) AND runtime (41i.6c)
- [ ] **D-41i.6-4** confirmed: manual Full Scan now; scheduled Cloud Scheduler full scan deferred to PROD-ready
- [ ] **D-41i.6-5** confirmed: full canonical chain on every L4 finding (surfaceId / route / canonical source / canonical value / rendered value / diff / userId)
- [ ] **HR-3 extension** confirmed: `PHASE_41_REGULATORY_ARCHITECTURE.md` updates HR-3 from "calc-engine drift" to "calc-engine drift OR surface-rendering drift"
- [ ] **Sub-PR sequence** approved (3 PRs, ~6 days)
- [ ] **Schema migration** acknowledged: `ALTER TYPE ADD VALUE` only; CLAUDE.md §12.11 N/A; §12.12 satisfied
- [ ] **CI integration** confirmed: 41i.6b adds `npm run lint:financial-surfaces` to `vercel-build` as a pre-build gate

---

## 13. Out of scope (deferred to PROD)

- **Headless-browser DOM scrape** — the runtime harness re-derives from canonical source instead. Headless-browser end-to-end audit would catch one additional bug class (where a component renders a hardcoded literal entirely disconnected from the data) but is high-cost / high-flakiness. The 41i.6b static-analysis pass catches that bug class structurally instead.
- **Scheduled daily Cloud Scheduler full scan** — deferred until first paying users (a full scan iterates every USER × every SURFACE, costing query budget at scale).
- **Auto-bisect** — when a finding fires, the system today doesn't auto-bisect (find the commit that introduced the drift). Future work.
- **Per-finding "fix recipe" suggestions** — when a finding fires, the admin queue could surface "the canonical source returns X; the component reads Y; the most likely fix is to update component path Y → X." Future work.

---

## 14. Approval status

🟡 **DRAFT — awaiting Reza sign-off.**

Once §12 ticks are complete, this doc moves to **APPROVED** and 41i.6a starts. No code lands until then. Per the locked-in 41e + 41f patterns: design doc → sign-off → schema → service → UI.
