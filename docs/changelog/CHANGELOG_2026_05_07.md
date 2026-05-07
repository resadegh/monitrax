# Changelog — 2026-05-07

## Session: claude/phase-41i6c-runtime-harness (Phase 41i.6c — Runtime audit harness + Full Scan; CLOSES PHASE 41i.6)

### Strategy
Third + final sub-PR of Phase 41i.6 (the trustworthiness commitment). **CLOSES PHASE 41i.6.** HR-3 invariant 11 fully realised — calc-engine drift (L1/L2/L3) + surface-rendering drift (L4) both caught structurally.

Per spec doc `PHASE_41I_6_SURFACE_AUDIT.md` §8 + §10 — the harness re-derives from canonical source (does NOT scrape DOM); the static-analysis pass (41i.6b shipped in PR #701) catches the COMPLEMENTARY bug class of components bypassing the canonical source entirely.

### Type
- **Type**: Feature (Phase 41i.6 sub-PR — CLOSES PHASE 41i.6)
- **Scope**: New harness lib + Full Scan API route + admin UI updates + 12 new tests. Zero new dependencies.

### Files Created
- `lib/calc-audit/surfaceAudit.ts` — `runSurfaceAuditForUser` iterates registered descriptors. Records HIGH-severity finding when canonical source throws or extractor throws; MEDIUM when canonical returns null without `skipWhenNull` allowance; SKIPS when null/zero matches `renderConditions`. `runSurfaceAuditFullScan` async-generator yields `FullScanProgress` events (`PROGRESS` per user / `DONE` with totals / `ERROR`). Idempotent dedup via `recordSurfaceFinding` (refresh existing OPEN; create new).
- `app/api/admin/calc-audit/full-scan/route.ts` — `POST` with dual auth (admin session via `verifyAdminGCPAuth` + `audit:read` permission OR Cloud Scheduler shared secret via `CALC_AUDIT_SCHEDULER_SHARED_SECRET` constant-time compare; same pattern as 41i.5 anomaly-scan). Streams `application/x-ndjson` with `X-Accel-Buffering: no` for live progress. Body: `{ userLimit?, descriptorIds? }` (clamped + filtered).
- `tests/calc-audit/surfaces/surfaceAudit.test.ts` — 12 tests with mocked Prisma. Coverage: canonical throw → HIGH; extractor throw → HIGH; null with skip → SKIPPED; null without skip → MEDIUM; zero with skip → SKIPPED; zero without skip → OK; happy path → OK; multi-descriptor iteration in order; dedup pattern (UPDATE existing OPEN, CREATE new, scoped findFirst query).

### Files Modified
- `app/admin/calc-audit/page.tsx` — extended `Finding` type with `L4_SURFACE_AUDIT` source + `userId` field. New scan state. New `runFullScan` callback that POSTs to `/full-scan` and reads NDJSON via `ReadableStream.getReader()` + `TextDecoder`, parses each line, accumulates aggregate counters, updates UI per event. AdminHeader action prop now contains both `[Re-run differential]` + `[Full scan (L4)]` buttons. New scan-progress card. New source-filter chip row above the findings list (chip click sets `sourceFilter`; findings list filtered by selection).
- `docs/IMPLEMENTATION_PLAN.md` — Last-updated header + §6 status flipped to CLOSED pending merge + 41i.6c ticked.

### Architecture Decisions
- **Async-generator full-scan over batch endpoint** — yields one `PROGRESS` event per user; the API streams as NDJSON. Lets the admin UI render live progress without waiting for the entire scan. Cancel affordance is v2 per D-41i.6-4.
- **Dedup pattern matches 41i.3 (`recordDifferentialFindings`)** — `findFirst → update | create` scoped to `(source, engineName, userId, resolution)`. Re-runs for a user with persistent issues refresh the existing finding instead of spamming the queue. Terminal states excluded from findFirst (won't resurrect closed findings; creates new instead).
- **Dual auth mirrors 41i.5** — admin session OR Cloud Scheduler shared secret with constant-time compare. Cloud-Scheduler scheduled scans deferred to PROD per D-41i.6-4; manual `[Full scan]` button is the v1 path.
- **Cross-validators are a typed extension point** — v1 doesn't ship any. Each descriptor today only validates that its canonical source returns a sane value. Future PRs add `descriptor.crossValidate(userId, sourceResult)` to independently re-derive + diff against canonical → fires HIGH-severity drift findings.
- **NDJSON over Server-Sent Events** — simpler client integration via Fetch API + `ReadableStream.getReader()` vs `EventSource` setup; lets the response be replayed for debugging.
- **`X-Accel-Buffering: no`** — disables Vercel/proxy buffering so the client sees per-line progress immediately.

### Build Status
- [x] `npx tsc --noEmit` — clean (only pre-existing `stripe` issue, unrelated)
- [x] `npx prisma generate` — clean
- [x] `npx vitest run tests/calc-audit/surfaces` — 65 / 65 pass (30 registry + 23 lint + 12 new harness)
- [x] `npx vitest run tests/calc-audit tests/integrations` — 215 / 215 pass (no regression)
- [x] `npm run lint:financial-surfaces` — passes (no new violations; 28 grandfathered)

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new scan-progress card pattern + source-filter chip pattern; compose existing AdminCard primitives)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (HR-3 invariant 11 fully realised — calc-engine + surface-rendering drift both caught structurally)
- [ ] operational procedure
- [x] strategic decision (CLOSES PHASE 41i.6 — trustworthiness commitment operationally complete; future PRs add cross-validators per descriptor)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — Last-updated header + §6 Active Workstream sub-PR ticks + status flipped to CLOSED.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
The harness contains `prisma.calcAuditFinding.update`. Filled in advance:

**`recordSurfaceFinding` UPDATE:**
1. WHERE clause matches: `{ id: existing.id }` after pre-fetch via `findFirst({ where: { source: 'L4_SURFACE_AUDIT', engineName: surfaceId, userId, resolution: { in: ['OPEN', 'INVESTIGATING'] } } })`.
2. Columns overwritten: `severity`, `summary`, `failedAssertions`, `errorMessage`, `detectedAt` — all owned by the surface-audit code path.
3. Guard: rows updated were created by this same code path on a prior run. Terminal states excluded from the findFirst — closed findings cannot be resurrected; new findings are created instead.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A — no `prisma/schema.prisma` changes (`L4_SURFACE_AUDIT` enum value landed in PR #699 / 41i.6a).

### PR
- Branch: `claude/phase-41i6c-runtime-harness`
- Status: pending push + open

---

## Session: claude/phase-41i6b-static-analysis (Phase 41i.6b — CI static-analysis pass for inline financial math)

### Strategy
Second sub-PR of Phase 41i.6 (the trustworthiness commitment). Builds the **PR-time bug catcher** — a CI lint that rejects three patterns of inline financial math that violate CLAUDE.md §6.1 + §6.2 SSOT (canonical-source consumption + canonical-utility helpers). Per spec doc `PHASE_41I_6_SURFACE_AUDIT.md` §7.

The lint walks `app/dashboard/`, `app/portal/`, `components/` looking for:
1. Inline frequency conversion (`income.amount * 12`) → must use `lib/utils/frequencies.ts:toMonthly()`/`toAnnual()`
2. Inline arithmetic between financial fields (`total.income - total.expenses`) → must consume canonical service result
3. Hardcoded financial constants (GST 0.10, SMSF tax 0.15, super cap 30000, etc.) → must come from `taxYearConfig.ts`

### Key architectural choice — baseline mechanism
The first dry-run found 28 pre-existing violations across `ExpenseWizard.tsx`, `DebtQualityWidget.tsx`, `InsightWidgets.tsx`, `AssetsStep.tsx`, `ReviewStep.tsx`. Wiring to `vercel-build` immediately would break every build until those are resolved. **Resolution**: implemented a baseline file (`.audit/financial-math-baseline.json`) — pre-existing violations are grandfathered; only NEW violations not in baseline fail the build. Stale baseline entries (when a violation is later resolved) surface as warnings to nudge cleanup.

This pattern lets us:
- Ship the gate from day 1 (no half-built lint)
- Not break existing builds
- Build a clear TODO list (the baseline file IS the cleanup queue)
- Catch new violations at PR-review time immediately

### Type
- **Type**: Feature (Phase 41i.6 sub-PR — CI quality gate)
- **Scope**: New lint script + npm script + vercel-build wiring + baseline + 23 new tests. Zero new dependencies.

### Files Created
- `scripts/lint-financial-surfaces.ts` — `runLint()` walks scan dirs + applies 3 detectors (`FREQUENCY_PATTERNS` regex array + `INLINE_ARITHMETIC_REGEX` + `HARDCODED_CONSTANT_REGEX`). `scanFile()` exported for testability — called per-file with synthetic content in tests. `loadBaseline()` reads `.audit/financial-math-baseline.json`. `matchesBaseline()` compares (file, line, pattern, match) tuple. `regenerateBaseline()` writes the JSON when invoked with `BASELINE_REGENERATE=1`. `main()` CLI runner: prints scan summary + writes annotated-exceptions sidecar + reports stale baseline + exits 0 / 1 based on new-violation count.
- `.audit/financial-math-baseline.json` — 28 grandfathered pre-existing violations (auto-generated; entries tracked over time as they're resolved).
- `tests/calc-audit/surfaces/lintFinancialSurfaces.test.ts` — 23 detector tests across 6 describe blocks. Pattern 1 frequency (5 positive cases × 5 frequency variants). Pattern 2 inline arithmetic (3 positive cases). Pattern 3 hardcoded constants (2 positive cases). Negative cases (5 — non-financial multiplication, non-financial subtraction, hardcoded literal NOT next to financial field, UI sizing, canonical helper invocation). Annotation honouring (5 — `//`, `/* */`, case-insensitive marker, multi-word reason, non-matching comment doesn't mark). Source-line context capture (3 — full source line, multi-line file line numbering, 1-indexed column).

### Files Modified
- `package.json`:
  - New `lint:financial-surfaces` npm script (uses `npx ts-node` with explicit `--compiler-options` to bypass the project tsconfig's ESM module setting).
  - `vercel-build` script extended: `npm run lint:financial-surfaces && prisma migrate deploy && prisma generate && next build`. The lint runs FIRST so a violating PR fails fast (before the more expensive Prisma + Next build steps).
- `docs/IMPLEMENTATION_PLAN.md` — Last-updated header rewritten + §6 Active Workstream sub-PR ticks (41i.6a + 41i.6b ✅; 41i.6c NEXT).
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Architecture Decisions
- **Standalone Node script over ESLint plugin** — the existing eslint config is general-purpose TS/React linting; financial-math detection is a domain-specific concern that's better as a focused tool. Lower complexity + clearer ownership.
- **Baseline mechanism (grandfathering) over breaking the build immediately**. Pre-existing 28 violations would have broken every build for days/weeks. The baseline pattern is the standard "introduce-lint-to-existing-codebase" approach (used by Stripe, Airbnb, etc.). Reviewers MUST scrutinise any PR that grows the baseline (regenerating is gated behind `BASELINE_REGENERATE=1` env var + a clear log message).
- **Stale-baseline warnings** — when a violation is resolved (e.g. a component migrated to canonical source), the baseline entry no longer matches. The lint surfaces this as a warning so the entry can be removed from the JSON, shrinking the baseline over time.
- **Run lint FIRST in `vercel-build`** — fails fast. Saves ~30s of Prisma + Next build cost on a violating PR.
- **Detection regex tuned for false-positive avoidance**:
  - Pattern 1 only fires on identifiers containing `income/expense/amount/revenue/salary/wage/cost/cashflow/earnings/payment` — avoids flagging `page * 12` (pagination) or `index * 52` (iteration).
  - Pattern 2 requires BOTH operands to look financial — avoids `node.left - node.right` (DOM math) or `position.x + position.y` (coordinates).
  - Pattern 3 requires the hardcoded constant to appear on a line that ALSO contains a financial-field hint — avoids flagging `const opacity = 0.15` (UI styling).
- **Annotation reasons recorded in sidecar** — `.audit/financial-math-exceptions.json` gives reviewers a list of "currently-exempted" cases over time. If the count grows unbounded, that's a signal the lint is too aggressive (or the codebase has accumulated tech debt).
- **No 41i.6c runtime harness in this PR** — runtime audit lands separately. 41i.6b is purely the static-analysis layer.

### Build Status
- [x] `npx tsc --noEmit` — clean (only pre-existing `stripe` issue, unrelated)
- [x] `npm run lint:financial-surfaces` — passes (28 grandfathered, 0 new)
- [x] `BASELINE_REGENERATE=1 npm run lint:financial-surfaces` — successfully writes baseline
- [x] `npx vitest run tests/calc-audit/surfaces` — 53 / 53 pass (30 prior registry + 23 new lint detector)
- [x] Spot-check `npx vitest run tests/calc-audit tests/integrations tests/tax-engine/divisions/div7aLoanClassifierSurplusCap.test.ts` — 244 / 244 pass (no regression)

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [x] application config (new `lint:financial-surfaces` npm script + extended `vercel-build` script)
- [ ] GCP infrastructure
- [ ] identity / auth
- [x] deployment / build (`vercel-build` now runs the lint as a pre-build gate; failing lint aborts the deploy before Prisma + Next steps run)
- [x] security / CDR posture (HR-3 invariant 11 — the trustworthiness commitment — gains its first PR-time enforcement layer; reviewers reject any PR that introduces inline financial math without an annotation OR that grows the baseline without explicit justification)
- [ ] operational procedure
- [x] strategic decision (baseline mechanism — pre-existing violations grandfathered; new violations fail the build; stale baseline entries warn; baseline regeneration gated behind explicit env var + reviewer scrutiny)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — Last-updated header + §6 Active Workstream sub-PR ticks.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — no Prisma writes anywhere in this PR.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A — no `prisma/schema.prisma` changes.

### PR
- Branch: `claude/phase-41i6b-static-analysis`
- Status: pending push + open

---

## Session: claude/phase-41i6a-surface-audit-registry (Phase 41i.6a — Surface descriptor registry + 10 descriptors + L4_SURFACE_AUDIT enum migration)

### Strategy
First sub-PR of Phase 41i.6 (the **trustworthiness commitment** per Reza brief 2026-05-07). Builds the structural foundation: registry + typed shapes + first 10 high-impact descriptors + the `L4_SURFACE_AUDIT` enum value.

Per spec doc `PHASE_41I_6_SURFACE_AUDIT.md` §2 + §6 + §9: this PR is **registry + schema only**. CI static-analysis pass lands in 41i.6b; runtime audit harness + `[Full scan]` button lands in 41i.6c.

### Type
- **Type**: Feature (Phase 41i.6 sub-PR — registry foundation)
- **Scope**: New `lib/calc-audit/surfaces/` module + 1 schema enum migration + 30 new tests. Zero new dependencies.

### Files Created
- `lib/calc-audit/surfaces/types.ts` — `SurfaceDescriptor` + `SurfaceValueKind` (AUD / PERCENT / RATIO / SCORE / COUNT / MONTHS / DATE) + `DEFAULT_TOLERANCE_BY_KIND` + `exceedsTolerance()` helper.
- `lib/calc-audit/surfaces/registry.ts` — `surfaceRegistry` singleton + exported `assertDescriptor()` (every invariant: charset / route prefix / canonicalSource shape / .ts-or-/api/ guard / function guards).
- `lib/calc-audit/surfaces/descriptors/masterSnapshotDescriptors.ts` — 6 descriptors backed by direct master-snapshot field paths (net-worth / health-score / emergency-fund / investment-total / property-equity / tax-estimated-refund).
- `lib/calc-audit/surfaces/descriptors/cashflowDescriptors.ts` — 4 descriptors backed by `quickMetrics.*` paths on master (cashflow / income / expense / debt-total). Today these tiles consume from `/api/cfo` / `/api/calculate/cashflow` / `/api/ai/debt-analysis` per the recon — pointing the descriptors at master means 41i.6c will fire L4 findings whenever the rendered value diverges.
- `lib/calc-audit/surfaces/index.ts` — auto-bootstrap on import (idempotent for hot-reload).
- `prisma/migrations/20260511100000_add_l4_surface_audit_source/migration.sql` — `ALTER TYPE "CalcAuditFindingSource" ADD VALUE 'L4_SURFACE_AUDIT'`. Pure additive.
- `tests/calc-audit/surfaces/registry.test.ts` — 30 tests: bootstrap (size = 10, alphabetical, byCanonicalService groups all under master, byRoute across 7 routes, duplicate rejection) + assertDescriptor invariants + descriptor invariants for v1 top-10 + exceedsTolerance (AUD zero-cents + SCORE 0.5pt + MONTHS zero + descriptor-level override + zero-canonical no-divide + negative-cashflow boundary).

### Files Modified
- `prisma/schema.prisma` — `CalcAuditFindingSource` enum extended with `L4_SURFACE_AUDIT`.
- `docs/IMPLEMENTATION_PLAN.md` — Last-updated header + §6 Active Workstream sub-PR ticks.

### Architecture Decisions
- **All 10 v1 descriptors point at master snapshot per CLAUDE.md §6.1 SSOT**, not at each tile's actual current canonical source. Today, 4 of the 10 tiles consume from non-master endpoints (architectural drift). Pointing the descriptors at master means the 41i.6c runtime harness will fire L4 findings on first run for any drift; future PRs migrate these tiles to consume from master, and the audit catches any rendered-value drift during the migration.
- **Registry mirrors `calcEngineRegistry` + `taxAdvisorToolRegistry` patterns** from 41i.0 + 41h.0 — singleton + bootstrap + duplicate-rejection + `__testOnlyClear`.
- **`SurfaceValueKind` + `DEFAULT_TOLERANCE_BY_KIND`** drives per-kind diff tolerance — descriptor-level `tolerance` overrides for special cases.
- **`exceedsTolerance` permissive when both bounds set**: passing EITHER absolute OR relative bounds counts as "not exceeding."
- **`invokeCanonicalSource` returns the raw source result; `extractRenderedValue` projects to a number** — two-phase split lets the harness memoise per-userId calls.
- **Two descriptor files (master + cashflow) instead of 10 micro-files** — composition + readability.
- **No 41i.6c runtime invoker plumbing in this PR** — descriptors carry `invokeCanonicalSource` functions but the harness that calls them lands in 41i.6c.

### Build Status
- [x] `npx tsc --noEmit` — clean (only pre-existing `stripe` issue, unrelated)
- [x] `npx prisma generate` — clean
- [x] `npx vitest run tests/calc-audit/surfaces` — 30 / 30 pass
- [x] `npx vitest run tests/calc-audit tests/integrations tests/tax-engine/divisions/div7aLoanClassifierSurplusCap.test.ts` — 191 / 191 pass (no regression)

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (HR-3 invariant 11 was already extended in PR #694; this PR ships the structural enforcement scaffold)
- [ ] operational procedure
- [x] strategic decision (all 10 v1 descriptors point at master snapshot per CLAUDE.md §6.1 SSOT)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/changelog/CHANGELOG_2026_05_07.md` (this entry)

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — no Prisma writes. Migration is `ALTER TYPE ADD VALUE` only.

### Schema Migration Checklist (CLAUDE.md §12.12)
- [x] `prisma/schema.prisma` modified
- [x] Matching migration at `prisma/migrations/20260511100000_add_l4_surface_audit_source/migration.sql`
- [x] Pure additive (`ALTER TYPE ADD VALUE`)
- [x] `npx prisma generate` clean

### PR
- Branch: `claude/phase-41i6a-surface-audit-registry`
- Status: pending push + open

---

## Session: claude/phase-41f4-trust-deed-parser (Phase 41f.4 — Trust-deed parser; CLOSES PHASE 41f CORE)

### Strategy
Implements `PHASE_41F_BOOKKEEPING_INTEGRATION.md` §7 (4-step confirm-before-apply trust-deed flow) on top of the schema landed in PR #691. **Closes Phase 41f core.** No additional sign-off needed — D-41F-3 was approved 2026-05-07 in the original 41F sign-off block.

Architectural choice: use `unpdf` (already installed; serverless-friendly) for PDF text extraction instead of Vision OCR + image conversion. Vision OCR works on images; trust deeds are typically typeset PDFs where text extraction is faster + cheaper + more deterministic. Scanned-PDF fallback documented as `UC-TRUST-DEED-SCANNED-PDF` (deferred to v2).

### Type
- **Type**: Feature (Phase 41f sub-PR — closes 41f core)
- **Scope**: New `lib/integrations/trust-deed/` module + new `lib/services/trustDeedRulesService.ts` consumer-side reader + 3 API routes + 1 consumer page + 36 new tests. Zero new dependencies — uses existing `unpdf` + existing Phase 41h `generateGeminiJSONCompletion`.

### Files Created
- `lib/integrations/trust-deed/types.ts` — Zod schemas for `Beneficiary` / `DistributionRule` / `TrusteePower` / `LoanProvision` / `UncomputedNote` / `TrustDeedExtraction` (top-level). Per-rule `confidence` field (0..1) on every typed rule. `CONFIDENCE_THRESHOLD = 0.7` exposed as a constant. `highConfidenceOnly()` helper that filters out below-threshold rules — used by Phase 41e consumers via the read-only service.
- `lib/integrations/trust-deed/pdfTextExtractor.ts` — wraps `unpdf` (already installed; no new deps). Returns `{ text, pageCount, pages[] }`. Throws `TrustDeedExtractionError` with typed `code` (`PDF_PARSE_ERROR` / `SCANNED_PDF_DETECTED` / `EMPTY_PDF`) on failure. SCANNED_PDF heuristic: if extracted text < 100 chars, surface friendly error + UC for v2.
- `lib/integrations/trust-deed/geminiExtractor.ts` — strict structured-output Gemini call. System prompt explicitly states: never invent rules; never recommend; never cite tax law; every rule carries confidence (0..1) — use 0.7+ when unambiguous, below 0.7 when interpretation needed; flag uncertain clauses to `uncomputedNotes` with verbatim source text. Truncates deeds > 250k chars + appends global UC note. Throws `GeminiExtractionError` (`GEMINI_NOT_CONFIGURED` / `EXTRACTION_FAILED` / `SCHEMA_INVALID`).
- `lib/integrations/trust-deed/extractionService.ts` — orchestrator. `createExtraction()` loads document → PDF → Gemini → persists new `TrustDeedExtractedRules` row with `status = EXTRACTED`. `updateExtractedRules()` user edits during review (only EXTRACTED rows editable). `confirmExtraction()` / `rejectExtraction()` lifecycle transitions guarded by `ALLOWED_TRANSITIONS` — EXTRACTED → CONFIRMED \| REJECTED; both terminal. `getLatestExtractionForEntity()` reader. `isAllowedTransition()` exported for tests + future callers.
- `lib/integrations/trust-deed/index.ts` — public surface re-exports.
- `lib/services/trustDeedRulesService.ts` — **read-only consumer service for Phase 41e callers**. `getConfirmedRulesForEntity(legalEntityId)` returns latest CONFIRMED with `highConfidenceOnly()` already applied + defensive Zod re-validation on read (returns null if persisted JSON drifts from schema — fail closed, never hand a malformed shape to a tax engine).
- `app/api/entities/[id]/trust-deed/route.ts` — `GET` returns status + entity + latest rules + Document metadata. `POST` accepts multipart PDF upload (25 MB cap), restricted to `DISCRETIONARY_TRUST` / `UNIT_TRUST` entities, persists PDF to existing Document model (Phase 26 vault, MONITRAX storage), runs `createExtraction()`, returns persisted rules + documentId. 503 with `GEMINI_NOT_CONFIGURED` when env unset; 400 NOT_A_TRUST_ENTITY for non-trust types; 422 SCANNED_PDF_DETECTED for image-based PDFs.
- `app/api/entities/[id]/trust-deed/[rulesId]/route.ts` — `PATCH` user edits during review (only EXTRACTED). `POST` lifecycle transition with body `{ action: 'CONFIRM' | 'REJECT', rejectionReason? }`. Defence-in-depth ownership check: `findFirst({ where: { id: rulesId, legalEntityId: id } })`.
- `app/dashboard/entities/[id]/trust-deed/page.tsx` — 4-step UI. Upload card with read-only / encrypted-at-rest / never-modifies-PDF reassurance. Extracted-rule cards: beneficiaries / distribution rules / trustee power / loan provisions / vesting date — all with **per-rule confidence chips** (≥0.7 emerald, <0.7 amber "review carefully"). UNCOMPUTED notes card with verbatim source text + plain-English rationale. Confirm / Reject / Re-upload action bar (with confirm() guards). `<ScopeBoundaryCard />` reinforces §1.1 boundary (DOES vs DOES NOT).
- `tests/integrations/trust-deed/types.test.ts` — 26 tests: BeneficiarySchema bound checks (empty name / 200-char limit / unknown type / percentageEntitlement 0..1 / confidence 0..1 / null acceptance) + DistributionRuleSchema (discretionary / proportionate / streamed / unknown type / unknown incomeType) + TrustDeedExtractionSchema (complete / empty arrays / 50-item sanity bound / missing overallConfidence) + `highConfidenceOnly()` (filters beneficiaries / distribution rules / loan provisions; keeps uncomputedNotes always; boundary case at exactly 0.7 — threshold is inclusive; null loanProvisions input).
- `tests/integrations/trust-deed/lifecycle.test.ts` — 10 tests: exhaustive 3×3 transition matrix proves only EXTRACTED → CONFIRMED and EXTRACTED → REJECTED are allowed. CONFIRMED + REJECTED are terminal — no transitions out (no un-confirm, no un-reject, no self-transitions). Re-uploading the deed creates a NEW row.

### Architecture Decisions
- **`unpdf` over Vision OCR for v1**. Vision OCR is image-based + requires PDF→image conversion. Most trust deeds are typeset → text extraction is faster + cheaper + more deterministic. `unpdf` is already installed (Phase 26 vault dep). Scanned-PDF case surfaces `UC-TRUST-DEED-SCANNED-PDF` for v2 (Vision OCR fallback).
- **Per-rule confidence + `highConfidenceOnly()` filter**. Every rule Gemini extracts carries 0..1 confidence. The consumer-side service filters out rules below 0.7 BEFORE handing to any tax engine. This means: even after a user CONFIRMs the extraction, the tax engine still only consumes high-confidence rules (defence-in-depth — if the user confirms a low-confidence rule by mistake, the consumer-side filter catches it).
- **Lifecycle is locked + terminal**. EXTRACTED is the only state with outgoing transitions. CONFIRMED and REJECTED are terminal — re-uploading the deed creates a NEW row; existing rows are never re-activated. Audit trail is preserved.
- **Typed contract is locked; consumer wiring is deferred**. The Zod-validated `TrustDeedExtraction` shape + `getConfirmedRulesForEntity()` reader are shipped in this PR. Wiring into MasterTaxPosition (Phase 41e.17) + AI advisor tools (Phase 41h `getEntityTaxPosition` / `runDiv7aRefinanceScenario` / etc.) is a follow-up — that wiring touches every existing caller of those engines + would require its own design + tests. The contract is locked first; consumers integrate when ready.
- **Defensive re-validation on read**. `getConfirmedRulesForEntity()` Zod-revalidates the persisted JSON before handing back to a consumer. Should never fail in practice (the extraction service Zod-validates at write time), but if the schema ever drifts, we fail closed — return null + log warning rather than hand a malformed shape to a tax engine.
- **Restricted to trust-shaped entities**. The POST upload route returns 400 `NOT_A_TRUST_ENTITY` for `PERSONAL_NAME` / `COMPANY` / `SMSF` / `SOLE_TRADER` / `PARTNERSHIP`. Trust-deed parsing only makes sense for `DISCRETIONARY_TRUST` / `UNIT_TRUST`.
- **Inline storage at v1**. PDFs persist to `Document.fileContent` (MONITRAX storage). External-storage providers (GCS / S3) are deferred — the extraction service surfaces a clear error if encountered. Most users at this stage will be on inline storage; bulk-storage support is a Phase 26 follow-up.
- **No new dependencies**. Uses existing `unpdf` + existing `generateGeminiJSONCompletion` from `lib/ai/gemini.ts` (which Phase 41h uses). Keeps the dependency footprint flat per CLAUDE.md §12.7+§12.8.

### Build Status
- [x] `npx tsc --noEmit` — clean (only pre-existing `stripe` issue, unrelated)
- [x] `npx vitest run tests/integrations/trust-deed` — 36 / 36 pass
- [x] `npx vitest run tests/tax-engine/divisions/div7aLoanClassifierSurplusCap.test.ts tests/integrations` — 88 / 88 pass (Phase 41f Xero suite + Phase 41f.3 Div 7A surplus cap suite still green; no regression from the new module)

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new trust-deed page composes existing Card / Button / Badge primitives + reuses the connect-bookkeeping page's `ScopeBoundaryCard` pattern + new per-rule confidence-chip pattern; no new reusable design primitive — `06_UI_UX_FOUNDATION.md` not touched per §16.3 first row)
- [x] application config (uses existing `GEMINI_API_KEY` env var — no new config; documented `GEMINI_NOT_CONFIGURED` 503 response)
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (Zod-validated structured extraction; per-rule confidence; defensive Zod re-validation on read; storage + understanding only per §1.1 — never modifies the user's PDF; audit logs sanitised via existing `sanitizeMetadata`)
- [ ] operational procedure
- [x] strategic decision (`unpdf` over Vision OCR for v1; consumer wiring deferred until typed contract is locked)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — Last-updated header + Active Workstream §5 sub-PR ticks (41f.4 ✅) + status flipped to CORE COMPLETE pending merge + Blocking line updated to flag the 41f.5 vs Phase 42 reconciliation question.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
The new routes contain `prisma.trustDeedExtractedRules.update` (PATCH edits, lifecycle transitions). Filled in advance:

**`update` calls in `extractionService.ts` (`updateExtractedRules`, `transitionStatus`):**
1. WHERE clause matches: `{ id: rulesId }` after pre-fetch via `findUnique({ where: { id: rulesId } })`. Only the row uniquely owned by the calling user (defence-in-depth ownership check at the route layer via `findFirst({ where: { id: rulesId, legalEntityId } })` before the service is invoked).
2. Columns overwritten: lifecycle state (`status`, `confirmedAt`, `rejectedAt`, `rejectionReason`) for `transitionStatus`; JSON shape columns (`beneficiaries`, `distributionRules`, `vestingDate`, `trusteePower`, `loanProvisions`, `uncomputedNotes`) for `updateExtractedRules`. All fields owned by this code path.
3. Guard: rows being updated were created by this service via `createExtraction()`. The `ALLOWED_TRANSITIONS` map blocks any transition out of CONFIRMED or REJECTED; the `NOT_EDITABLE` guard blocks PATCH on CONFIRMED / REJECTED rows.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A — no `prisma/schema.prisma` changes. The `TrustDeedExtractedRules` model + `TrustDeedRuleStatus` enum landed in PR #691 (Phase 41f.1).

### PR
- Branch: `claude/phase-41f4-trust-deed-parser`
- Status: pending push + open

---

## Session: claude/phase-41i6-and-41f5-design (Phase 41i.6 + 41f.5 design docs + 41F spec doc data-conflict strategy)

### Strategy
Substantive doc-sync session captures three strategic Reza directives from 2026-05-07:

1. **The trustworthiness commitment.** Reza brief: *"I need the calc Audit agent to be able to review all relevant calculations of monitrax and the results... continuously make sure all calculations and produced numbers in monitrax is accurate and trustworthy and not some made up incorrect numbers."* Captured as **Phase 41i.6 — Surface-Level Numerical Audit**. Extends HR-3 from "calc-engine drift" to "surface-rendering drift." This was the missing layer: L1/L2/L3 catch engine-level bugs; L4 catches the bridge between engine and rendered UI.

2. **The Xero data-conflict strategy.** Reza brief: *"how do we make sure the integration doesn't fail due to inconsistency of data... if we have a transaction that has 2 different categories in the Xero and Monitrax what will be the action ?"* Captured as `PHASE_41F_BOOKKEEPING_INTEGRATION.md` §1.2 — locked-in model: Xero owns the transaction record, Monitrax owns the wealth-strategy lens on top, never overwrite, always show both perspectives, provenance is the structural defence. 10-row risk register logged for the eventual transaction-level scope-up.

3. **The "mini-Xero" answer.** Reza brief: *"Can Monitrax by itself act as a mini XERO for the user so they don't need to have both systems...?"* Captured as **Phase 41f.5 Monitrax Express** (separate spec doc) — locked-in answer: Monitrax does NOT replace Xero (different category, 12+ months of engineering, crowds out wealth-strategy moat); Monitrax DOES offer "Monitrax Express" for users with personal entities but no Xero subscription yet — categorised income/expense per entity (already shipped Phases 1–19 + 41a) + receipt OCR linkage (Phase 26) + Money Flow Sankey (Phase 41d) + NEW "Export for accountant" CSV bundle. Scope explicitly excludes GL / AR/AP / payroll / BAS / bank reconciliation / lodgment.

Locked sequence going forward: 41f.4 (close 41f core) → 41i.6 (the trustworthiness layer) → 41f.5 (Monitrax Express). ~13-14 days total.

### Type
- **Type**: Docs (two new spec docs + four canonical-doc updates; no code)
- **Scope**: New `PHASE_41I_6_SURFACE_AUDIT.md` + new `PHASE_41F_5_MONITRAX_EXPRESS.md`; updates to `PHASE_41F_BOOKKEEPING_INTEGRATION.md` + `PHASE_41_REGULATORY_ARCHITECTURE.md` + `IMPLEMENTATION_PLAN.md` + `MASTER_BLUEPRINT.md`.

### Files Created
- `docs/blueprint/PHASE_41I_6_SURFACE_AUDIT.md` — 14 sections: strategic positioning + how 41i.6 extends Phase 41i (L1/L2/L3/L3b/L4 layer table) + four-lens design rationale + 5 strategic decisions (D-41i.6-1 through D-41i.6-5) + 3-sub-PR sequence + `SurfaceDescriptor` typed shape with example + CI static-analysis pass detail (lint pattern matrix + exception annotation pattern) + runtime audit harness algorithm + schema additions (`L4_SURFACE_AUDIT` enum value) + UI changes (`[Full scan]` button + `[L4_SURFACE_AUDIT]` filter chip + per-finding card variant) + per-sub-PR test plan + Reza sign-off block (9 ticks).
- `docs/blueprint/PHASE_41F_5_MONITRAX_EXPRESS.md` — 14 sections: strategic positioning (the "mini-Xero" answer) + scope boundary (DOES vs DOES NOT) + four-lens design rationale + storage-model decision (D-41F.5-1 — extend Income/Expense vs new model — recommended A) + single-PR sequence + new `BookkeepingClassification` enum + `Income.bookkeepingClassification` + `Expense.bookkeepingClassification` + `LegalEntity.expressMode` schema additions (additive migration) + CSV export bundle structure + 4 strategic decisions (D-41F.5-1 through D-41F.5-4) + UNCOMPUTED v1 register (6 items) + CDR posture + Reza sign-off block (8 ticks) + out-of-scope explicit list + build risks.

### Files Modified
- `docs/blueprint/PHASE_41F_BOOKKEEPING_INTEGRATION.md`:
  - Status header flipped 🟡 DRAFT → 🟢 APPROVED 2026-05-07; reflects PR #690/#691/#692/#693 all merged.
  - **New §1.1 — explicit scope boundary** (storage + understanding only; never create legal documents; never write back to Xero; never file with regulators) with DOES vs DOES NOT table + reviewer enforcement clause.
  - **New §1.2 — data-conflict strategy** (Xero owns transactions, Monitrax owns wealth lens; provenance is the structural defence; UNCOMPUTED for ambiguous cases; 10-row risk register for transaction-level scope-up).
  - **New §16 — Phase 41f.5 follow-up** cross-link to `PHASE_41F_5_MONITRAX_EXPRESS.md` with the migration-story matrix (4 user shapes × 4 Monitrax modes).
  - §12 sign-off block flipped to all ticked + new ticks for §1.1 / §1.2 / §16.
  - §15 Approval status flipped to APPROVED.

- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md`:
  - **§1 invariant 11 (HR-3) extended** from "calc-engine drift" to ALSO cover "surface-rendering drift." Reviewers reject any PR introducing a financial surface without a corresponding `SurfaceDescriptor` registration once Phase 41i.6 ships.
  - **§11.2 sub-PR table extended** with new 41i.6 row (queued; 3 sub-PRs ~6 days; reframes 41i.5 as "CLOSES PHASE 41i CORE" rather than "CLOSES PHASE 41i").

- `docs/IMPLEMENTATION_PLAN.md`:
  - Last-updated header rewritten — captures both spec-doc ships + 41F doc updates + locked sequence.
  - §5 Active Workstream Phase 41f — sub-PR ticks (41f.0 ✅ + 41f.1 ✅ + 41f.2 ✅ + 41f.3 ✅) + new 41f.4 NEXT row + new 41f.5 ROW (after 41i.6); Blocking line updated.
  - **New §6 Active Workstream — Phase 41i.6 Surface-Level Numerical Audit** with 4-sub-PR checklist + 5 D-41i.6 decisions + hard constraints + risk + blocking + dependencies.

- `docs/blueprint/MASTER_BLUEPRINT.md`:
  - Phase 41f row reflects shipped sub-PRs (#690–#693) + cross-links to §1.1 + §1.2 + Phase 41f.5.
  - **New Phase 41f.5 row** below 41f.
  - **New Phase 41i.6 row** below the existing Phase 41i row (which is reframed from "Complete" → "Core complete; 41i.6 surface-audit IN FLIGHT").

### Architecture Decisions
- **41i.6 is L4, not a fork.** Reuse `CalcAuditFinding` lifecycle + `findingService` + alerting. New enum value `L4_SURFACE_AUDIT` on `CalcAuditFindingSource`. Same admin queue, new filter chip.
- **Static + runtime, both.** 41i.6b CI lint catches the bug class at PR review (fast feedback, prevents the bug from ever shipping); 41i.6c runtime harness catches data-dependent drift. Complementary.
- **Top 10 surfaces at v1, expandable.** Don't try to register every surface day-one; ship the highest-impact surfaces first (cashflow / expense / income / net-worth / health / tax / debt-freedom / emergency-fund / property-equity / investment-total) + grow the registry as descriptors become a habit.
- **41i.6 ships AFTER 41f.4 to cover 41f's surfaces in its first pass.** Sequencing matters — running the audit before 41f's snapshot card has a registered descriptor would create a coverage gap.
- **41f.5 ships AFTER 41i.6 so its new Books tab + Express CSV-export surface lands with audit coverage from day 1.** Same logic — the audit is the structural floor; new surfaces sit on top of it.
- **41f.5 is "feeder, not substitute".** The CSV export's README is canonical: *"Express produces categorised records for your accountant. Bank reconciliation, journal entries, depreciation, and BAS lodgment remain your accountant's responsibility."* Locked-in copy.
- **41f.5 storage = Option A (extend Income/Expense).** Reuses ALL existing UI + service layer + audit + Phase 26 receipt linkage. Schema additions are tiny (3 columns + 1 enum). Zero parallel infrastructure.
- **41f spec doc §1.2 data-conflict strategy is forward-looking.** No code change ships in this PR — the strategy is locked-in for the eventual transaction-level scope-up (currently PROD-deferred per §11). 10-row risk register documents what we'll need to handle when we get there.

### Build Status
- N/A — docs-only.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (HR-3 invariant 11 extended in `PHASE_41_REGULATORY_ARCHITECTURE.md`; the structural commitment that calc-correctness flows admin-only is reinforced and broadened)
- [ ] operational procedure
- [x] strategic decision (5 D-41i.6 decisions surfaced for sign-off; 4 D-41F.5 decisions surfaced for sign-off; 41F spec doc §1.1 scope boundary + §1.2 data-conflict strategy + §16 cross-link locked in; sequence locked: 41f.4 → 41i.6 → 41f.5)

Docs updated in this PR:
- `docs/blueprint/PHASE_41I_6_SURFACE_AUDIT.md` (new)
- `docs/blueprint/PHASE_41F_5_MONITRAX_EXPRESS.md` (new)
- `docs/blueprint/PHASE_41F_BOOKKEEPING_INTEGRATION.md` (§1.1 + §1.2 + §16 + §12 ticks + §15 status)
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` (HR-3 extended + 41i.6 row in §11.2)
- `docs/IMPLEMENTATION_PLAN.md` (Last-updated header + §5 sub-PR ticks + new §6 active workstream + Up Next sequence)
- `docs/blueprint/MASTER_BLUEPRINT.md` (Phase 41f row updated; new Phase 41f.5 row; new Phase 41i.6 row; Phase 41i row reframed as "Core complete")
- `docs/changelog/CHANGELOG_2026_05_07.md` (this entry)

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A for this PR (docs-only). The 41i.6a + 41f.5 schema migrations are scoped in their respective spec docs:
- **41i.6a**: `ALTER TYPE "CalcAuditFindingSource" ADD VALUE 'L4_SURFACE_AUDIT'` — pure enum extension; no row mutations.
- **41f.5**: 3 column additions + 1 new enum (`BookkeepingClassification`) — pure additive; sane defaults; no row mutations; no constraint relaxation.

Both checklists will be re-validated at implementation-PR time.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A for this PR (docs-only). Each implementation PR will Prisma-generate its migration per the §12.12 protocol.

### PR
- Branch: `claude/phase-41i6-and-41f5-design`
- Status: pending push + open

---

## Session: claude/phase-41f3-snapshot-import (Phase 41f.3 — Xero snapshot import + Div 7A surplus wiring)

### Strategy
Implements PHASE_41F_BOOKKEEPING_INTEGRATION.md §5 sub-PR #41f.3 on top of the OAuth handshake landed in PR #692. End-to-end Xero snapshot pull pipeline + first wiring point into the Phase 41e tax engine. **Zero new dependencies** — `fetch`-based Xero reports + tolerant JSON parsing.

### Type
- **Type**: Feature (Phase 41f sub-PR — closes 41f.3 in the active workstream; unblocks 41f.4)
- **Scope**: Three new lib modules + two new API routes + UI snapshot card + opt-in Div 7A signature extension. **Phase 41e.6 Div 7A classifier signature change is opt-in** — no legacy caller breaks (449 existing tax-engine tests still pass).

### Files Created
- `lib/integrations/xero/tokenRefresh.ts` — `getValidAccessToken(integration)` returns a fresh access token, refreshing via Xero's token endpoint when expired (60-second skew buffer to avoid races). Persists rotated tokens (Xero rotates the refresh token on every refresh — both must be persisted atomically). On refresh failure stamps `connectionError = 'TOKEN_REFRESH_FAILED'` + clears `isConnected` so the UI surfaces a re-connect prompt. Throws typed `TokenRefreshError` with `code: NOT_CONFIGURED | NO_REFRESH_TOKEN | NOT_CONNECTED | REFRESH_FAILED`.
- `lib/integrations/xero/reportParser.ts` — typed parsers for Xero BalanceSheet + ProfitAndLoss responses. Tolerant: required totals (Total Assets / Liabilities / Equity / Revenue / Net Profit Before Tax) throw `XeroReportParseError`; optional line items (cash / receivables / payables / debt / depreciation / interest / etc.) return `undefined` when not present in the org's chart of accounts. Walks the `Reports[0].Rows` tree by section title regex (case-insensitive). Parses comma-formatted numerics. Extracts period from `ReportTitles` ("For the period 1 Jul 2024 to 30 Jun 2025") with month-year fallback.
- `lib/integrations/xero/snapshotPuller.ts` — `pullSnapshot({ integrationId, fiscalPeriod?, pulledByUserId })` orchestrates the end-to-end pull: (1) refresh-if-needed access token via tokenRefresh; (2) parallel fetch of BS + P&L for the resolved period (defaults to current AU FY); (3) parse via reportParser; (4) compute simplified s109Y surplus (`max(0, retainedEarnings + netProfitAfterTax)`); (5) idempotent persist via findUnique on `legalEntityId_fiscalPeriod` + update | create (Prisma upsert can't model the partial unique index from 41f.1); (6) stamp `lastSyncAt + lastSyncStatus = COMPLETED` on the integration. Throws typed `SnapshotPullError` with `code: NOT_CONNECTED | TOKEN_REFRESH_FAILED | XERO_API_ERROR | PARSE_ERROR`. Stamps `lastSyncStatus = FAILED` + `lastSyncError` on any error before re-throwing. Exports `resolveFiscalPeriod`, `currentAustralianFY`, `computeSimplifiedDistributableSurplus` for unit-test consumption.
- `app/api/entities/[id]/accounting/refresh/route.ts` — `POST` with optional `{ fiscalPeriod }` body. Defence-in-depth ownership via `listEntitiesForUser`. 404 ENTITY_NOT_FOUND / NO_INTEGRATION; 409 NOT_CONNECTED; 502 XERO_API_ERROR; 500 PARSE_ERROR; 503 XERO_NOT_CONFIGURED via typed `SnapshotPullError.code → HTTP status` map. Audit log via `logCRUD` with CDR-safe metadata (no balances or P&L line items — only entity / tenant / fiscal-period identifiers). Decimal columns serialized as numbers; rawProviderPayload omitted from the response.
- `app/api/entities/[id]/accounting/snapshots/route.ts` — `GET ?limit=N` (default 12, max 50). Returns the latest N `EntityAccountingSnapshot` rows for the entity, newest first. Raw payload omitted. Decimal serialization same as refresh route.
- `tests/integrations/xero/snapshotPuller.test.ts` — 10 tests: fiscal period resolution (FY label / ISO range / default current FY / July boundary / June boundary); simplified s109Y surplus (retained + net profit / fallback to net profit alone / floors at 0 for net loss / handles current-year loss against prior retained).
- `tests/integrations/xero/reportParser.test.ts` — 8 tests: BS extraction (totals + retained + receivables + payables + cash); comma-formatted numerics; optional line items return undefined; missing top-level section throws; empty envelope throws; P&L extraction (revenue + COGS + opex + NPBT + tax + NPAT + depreciation + interest + period); fallback to before-tax when after-tax absent; missing required throws.
- `tests/tax-engine/divisions/div7aLoanClassifierSurplusCap.test.ts` — 11 tests: legacy path (no surplus → UC-DIV7A-DISTRIBUTABLE-SURPLUS); cap binds (gross > surplus → caps total + pro-rata distribute + UC-DIV7A-SURPLUS-CAPPED + UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE); cap doesn't bind (gross ≤ surplus → unchanged + only ESTIMATE flag); surplus = 0 (zeroes deemed); negative/NaN surplus treated as "not provided" (forgiving); citations always include s109Y when surplus opt used.

### Files Modified
- `lib/integrations/xero/index.ts` — re-exports the three new modules + their public types.
- `lib/tax-engine/divisions/div7aLoanClassifier.ts` — `classifyDiv7ALoans(loans, options?)` extended with optional `Div7AClassifyOptions.distributableSurplus`. When provided + cap binds: caps `totalDeemedDividend` at the surplus + pro-rata distributes `deemedDividendAmount` across loans (rounded to 2dp); emits `UC-DIV7A-SURPLUS-CAPPED` + `UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE`. When provided + cap doesn't bind: emits only `UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE`. When NOT provided: legacy `UC-DIV7A-DISTRIBUTABLE-SURPLUS` flag (unchanged from Phase 41h.5). Negative or NaN surplus treated as "not provided" (forgiving caller error).
- `app/dashboard/entities/[id]/connect-bookkeeping/page.tsx` — added `latestSnapshot` state + `fetchLatestSnapshot` (auto-fetched when integration is connected) + `handleRefresh` + Refresh button on `<ConnectedCard />`. New `<SnapshotCard />` component renders: pulled-at timestamp; BS section (Total Assets / Liabilities / Equity / Retained Earnings); P&L section (Revenue / Operating Expenses / NPBT / NPAT); Tax-engine input section (simplified s109Y surplus + caveat). Loading + refreshing states inline. New `<Section>` + `<Metric>` helpers with currency formatting + tabular-nums alignment.
- `docs/IMPLEMENTATION_PLAN.md` — Last-updated header + Active Workstream §5 sub-PR ticks (41f.0 ✅ + 41f.1 ✅ + 41f.2 ✅ + 41f.3 ✅) + Blocking line.

### Architecture Decisions
- **Lazy token refresh, not proactive scheduler.** The refresh helper inspects `tokenExpiresAt` on every call and refreshes if within 60s of expiry. No Cloud Scheduler cron — Xero refresh tokens last 60 days (60-day inactivity TTL), so a daily cron would be wasteful for users who pull snapshots regularly anyway.
- **Idempotent overwrite on `(legalEntityId, fiscalPeriod)`.** Re-pulling the same period overwrites the existing row. Persisted `pulledAt` stamps the latest pull. Historical snapshots for prior fiscal periods stay queryable via the snapshots list endpoint. Caller never has to check "does this snapshot exist already?" — just `pullSnapshot()` and the puller handles upsert semantics.
- **Tolerant report parsing.** Real Xero orgs vary in chart-of-accounts naming (some use "Bank", others "Cash on Hand"; some use "Trade Debtors", others "Accounts Receivable"). The parser uses regex section + row matchers that cover both Australian and Anglo-American accounting vocabularies. Required totals throw — those exist on every BS/P&L.
- **`computeSimplifiedDistributableSurplus` is exported.** Unit-testable separately from the puller orchestration. Documented in the file's JSDoc as the simplified estimate per spec doc §9 (UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE) — the full s109Y formula additionally accounts for paid-up capital + non-commercial loans + prior-year frankable distributions, which require off-Xero data.
- **Div 7A signature change is opt-in.** Adding `options?: Div7AClassifyOptions` as the 2nd parameter is fully backward-compatible. Every existing caller (Phase 41h.5 `getDiv7aRiskTool` + Phase 41h.6 `runDiv7aRefinanceScenarioTool` + Phase 41i.2 calc-audit fixture) compiles unchanged. Future callers (the eventual D-41F-5 wiring service that resolves the latest snapshot for a company entity and feeds it into Div 7A) opt in by passing the surplus.
- **Pro-rata cap distribution preserves per-loan visibility.** When the surplus cap binds, the AI advisor still needs to narrate per-loan numbers ("loan L1's deemed dividend is capped at $30k of the $60k structural exposure due to s109Y"). Pro-rata distribution maintains that narrative.
- **`UC-DIV7A-DISTRIBUTABLE-SURPLUS-ESTIMATE` always fires when surplus is provided + deemed > 0.** Even when the cap doesn't bind, the simplified-surplus caveat must reach the user — the full s109Y might bind even if our simplified estimate doesn't.
- **`logCRUD` with CDR-safe metadata only.** The refresh-route audit log captures entity / tenant / fiscal-period identifiers — never balances or P&L line items. Per CLAUDE.md §13.3.

### Build Status
- [x] `npx tsc --noEmit` — clean (only pre-existing `stripeBillingService.ts` "stripe" module-not-found, unrelated)
- [x] `npx vitest run tests/integrations/xero` — 41 / 41 pass (was 23 from 41f.2; +18 from 41f.3 — 10 snapshotPuller + 8 reportParser)
- [x] `npx vitest run tests/tax-engine/divisions/div7aLoanClassifierSurplusCap.test.ts` — 11 / 11 pass
- [x] `npx vitest run tests/tax-engine` — 449 / 449 pass (existing Div 7A + Phase 41h tools + Phase 41e + 41i suites all green; signature change is opt-in)

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new `<SnapshotCard />` + `<Section>` + `<Metric>` helpers — composes existing primitives; no new reusable design primitive)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (audit-log metadata explicitly CDR-safe per §13.3 — no balances or P&L line items in the refresh route audit row; raw provider payload kept server-side, never returned to the client)
- [ ] operational procedure
- [x] strategic decision (Div 7A surplus wiring is opt-in via Div7AClassifyOptions — preserves backward compatibility with all Phase 41h tool callers; new UNCOMPUTED flag set replaces legacy flag for surplus-aware callers per spec doc §9)

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — Last-updated header + Active Workstream §5 sub-PR ticks + Blocking line.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
The snapshot puller does an `update | create` and the refresh route's puller call also stamps `lastSyncAt` on the integration. Both are filled in advance:

**`snapshotPuller.ts` `update | create` on `EntityAccountingSnapshot`:**
1. WHERE for update: `{ id: existing.id }` where existing was just `findUnique({ where: { legalEntityId_fiscalPeriod: { legalEntityId, fiscalPeriod } } })`. Only the row uniquely owned by `(legalEntityId, fiscalPeriod)` per the 41f.1 unique index.
2. Columns overwritten: every snapshot field (BS / P&L / tax-engine inputs / pulledAt). All snapshot data owned exclusively by this puller.
3. Guard: the row, if it exists, was created by this same puller on a prior pull for the same period. Overwrite is the intent (idempotent re-pull).

**`snapshotPuller.ts` `update` on `AccountingIntegration` (lastSyncAt stamping):**
1. WHERE: `{ id: integration.id }` — the row that was passed in.
2. Columns overwritten: `lastSyncAt`, `lastSyncStatus`, `lastSyncError`. All sync-tracking fields owned by this code path.
3. Guard: the integration row was loaded inside the same `pullSnapshot` call.

**`tokenRefresh.ts` `update` on `AccountingIntegration` (token rotation):**
1. WHERE: `{ id: integration.id }`.
2. Columns overwritten: `accessToken`, `refreshToken`, `tokenExpiresAt`, `tokenScope`, `connectionError` (or `isConnected = false` + `connectionError` on refresh failure). All OAuth-token state owned by this code path + 41f.2 callback.
3. Guard: same as above — integration row passed in from caller.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A — no `prisma/schema.prisma` changes (schema landed in PR #691).

### PR
- Branch: `claude/phase-41f3-snapshot-import`
- Status: pending push + open

---

## Session: claude/phase-41f2-xero-oauth (Phase 41f.2 — Xero OAuth + connect surface)

### Strategy
Implements the OAuth handshake + persistence layer per `PHASE_41F_BOOKKEEPING_INTEGRATION.md` §5 (sub-PR #41f.2) on top of the schema landed by PR #691. No data import yet — the integration sits idle in `isConnected: true` state until 41f.3 ships the snapshot puller. **No new dependencies.** The official `xero-node` SDK was evaluated and rejected for v1: the OAuth 2.0 flow is so standard (RFC 6749 / RFC 7009) that 200 lines of `fetch`-based code is simpler than the SDK's transitive dependency footprint, and aligns with CLAUDE.md §12.7+§12.8 (minimum-custom-code / managed-service-first / simplicity-over-cleverness).

### Type
- **Type**: Feature (Phase 41f sub-PR — closes 41f.2 in the active workstream; unblocks 41f.3)
- **Scope**: New `lib/integrations/xero/` module + 4 API routes + 1 consumer page + 23 tests. Zero changes to existing files outside docs.

### Files Created
- `lib/integrations/xero/config.ts` — env-var resolution + `isXeroConfigured()` guard. Constants for Xero endpoint URLs + `XERO_SCOPES` (read-only — `offline_access` + `accounting.reports.read` + `accounting.transactions.read` + `accounting.contacts.read`; no write scopes per §1.1 boundary). Falls back to `NEXTAUTH_SECRET` for the state HMAC if `XERO_OAUTH_STATE_SECRET` is unset.
- `lib/integrations/xero/state.ts` — HMAC-SHA256-signed stateless OAuth state token. 15-minute TTL. Tamper rejection (signature mismatch, mutated payload, malformed token, missing fields, expired). Stateless because Vercel functions don't share memory — the request that issues state runs on a different instance from the request that validates it on callback.
- `lib/integrations/xero/oauth.ts` — `buildAuthorizeUrl(entityId, userId, config)` + `exchangeCodeForTokens(code, config)` + `refreshAccessToken(refreshToken, config)` + `revokeRefreshToken(refreshToken, config)` (RFC 7009; best-effort) + `listConnectedTenants(accessToken)`. `XeroOAuthError` thrown on any non-200 from Xero with the status code attached. Pure `fetch` — zero new deps.
- `lib/integrations/xero/index.ts` — public surface re-exports.
- `app/api/entities/[id]/accounting/route.ts` — `GET` returns the integration status (configured + entity summary + integration row) for the connect surface. USER_ENTITY scope only via `where: { scope: 'USER_ENTITY', legalEntityId, userId }`.
- `app/api/entities/[id]/accounting/connect/route.ts` — `POST` returns the Xero authorize URL with HMAC state. 503 with `XERO_NOT_CONFIGURED` when env vars unset. Gated by `entity.write` permission. No `AccountingIntegration` row created here — we wait for the verified callback.
- `app/api/entities/[id]/accounting/disconnect/route.ts` — `POST` best-effort revokes the Xero refresh token + soft-disconnects locally (clears tokens, sets `isConnected = false`, stamps `connectionError = 'USER_DISCONNECTED'`). Audit log via `logCRUD()`.
- `app/api/integrations/xero/callback/route.ts` — `GET` single registered redirect URI. Verifies HMAC state (the auth anchor — only authenticated `entity.write` requests can issue valid state). Exchanges code for tokens. Lists Xero tenants and picks the first (multi-tenant deferred to v2 per UC-XERO-MULTI-ENTITY-SAME-TENANT). Upserts the `AccountingIntegration` row (USER_ENTITY scope) via `findFirst → update | create` (Prisma upsert can't model the partial unique index — same effective semantics). Redirects back to the connect-bookkeeping page with `?result=success` or `?result=error&reason=...`.
- `app/dashboard/entities/[id]/connect-bookkeeping/page.tsx` — three-state UI (not-configured / not-connected / connected) + warm-tone `Connect Xero` CTA + `Disconnect` affordance + dedicated §1.1 scope-boundary card explaining DOES vs DOES NOT. Reads `?result=` + `?reason=` query params to render success / error toast after the user returns from Xero.
- `tests/integrations/xero/state.test.ts` — 12 tests: round-trip, unique nonces, tamper rejection (wrong secret / mutated payload / mutated signature / malformed / empty / empty payload), expired token, near-boundary acceptance, non-string token, missing fields.
- `tests/integrations/xero/config.test.ts` — 6 tests: empty env, partial env, state-secret missing, NEXTAUTH_SECRET fallback, full config, secret precedence.
- `tests/integrations/xero/oauth.test.ts` — 5 tests: RFC 6749 params, distinct state per (entityId, userId), client_secret never exposed, redirect_uri encoding, read-only scopes only.

### Architecture Decisions
- **Stateless HMAC OAuth state** instead of the in-memory store pattern in `lib/auth/oauth.ts`. The existing pattern works in dev but breaks in serverless prod (each Vercel function has its own memory). HMAC-SHA256 over `{e: entityId, u: userId, n: nonce, x: expiresAt}` truncated to 32 bytes is stateless, tamper-proof, and short-lived (15 min). Tested against tampering at every layer.
- **HMAC state IS the auth anchor on the callback** — browser redirects from Xero don't carry our `Authorization: Bearer` token, so the standard `withPermission()` pattern can't gate the callback. Instead we trust the signed state because issuing it requires going through `/api/entities/[id]/accounting/connect` which IS `withPermission('entity.write')`-gated. Result: the callback validates state + does defence-in-depth ownership check + persists. Documented in the callback file's top-of-file JSDoc.
- **Single registered redirect URI** (`/api/integrations/xero/callback`). Xero rejects per-entity callback paths as unregistered. The state encodes the `entityId` so the callback can route the resulting tokens to the right `LegalEntity`.
- **Best-effort Xero revoke on disconnect** — failures don't block the local soft-disconnect. Local row is the source of truth for "no longer connected." Per CLAUDE.md §12.10 fire-and-forget pattern.
- **Soft-disconnect (not hard-delete)** — `AccountingIntegration` row stays, tokens are nulled, `connectionError = 'USER_DISCONNECTED'`. Historical sync logs + audit trail remain queryable. Hard-delete affordance deferred to PROD per spec doc §11.
- **Read-only Xero scopes** — never request write scopes. `accounting.transactions.read` is on the consent screen even though Phase 41f v1 doesn't pull transactions (deferred to v2) — the consent screen is consistent with the eventual full read scope so users don't need to re-consent later.
- **Tenant selection v1 is "first one"** — the user typically has one Xero tenant per accounting integration. Multi-tenant selection deferred to v2 per UC-XERO-MULTI-ENTITY-SAME-TENANT. The `AccountingIntegration.providerOrganization` field stores the chosen tenant name for UI display.
- **No `xero-node` SDK** — the OAuth flow + tenant list is `fetch`-based. Per CLAUDE.md §12.7+§12.8: minimum custom code, simplicity over cleverness. We re-evaluate at 41f.3 if the BS/P&L parsing outgrows our typed wrappers.
- **Token storage is plain `@db.Text` columns** — no app-layer encryption. Cloud SQL CMEK at-rest encryption (Phase 9) is the authoritative protection per CLAUDE.md §13.6. Tokens never leave the server (refresh runs server-side per request).

### Build Status
- [x] `npx tsc --noEmit` — clean (only pre-existing `stripeBillingService.ts` "stripe" module-not-found, unrelated)
- [x] `npx vitest run tests/integrations/xero` — 23 / 23 pass

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new connect-bookkeeping page composes existing Card / Button / lucide-icon primitives + the warm-amber + emerald palettes already in use; no new reusable primitive — `06_UI_UX_FOUNDATION.md` not touched per §16.3 "single component, no system change")
- [x] application config (new env vars: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_OAUTH_REDIRECT_URI`, `XERO_OAUTH_STATE_SECRET` — all non-CDR business credentials per §1.1; runtime resolution gated by `isXeroConfigured()` so dev/demo works without keys)
- [ ] GCP infrastructure
- [ ] identity / auth (no new auth provider; Firebase Auth unchanged; Xero OAuth is a SECONDARY identity for a third-party integration, not a Monitrax sign-in path)
- [ ] deployment / build
- [x] security / CDR posture (HMAC-signed stateless OAuth state with tamper rejection; Xero tokens stored as `@db.Text` with CMEK at-rest encryption; CDR posture explicitly Privacy Act 1988 not CDR per spec doc §10; right-to-erasure via existing ON DELETE CASCADE FKs from 41f.1)
- [ ] operational procedure
- [x] strategic decision (zero new dependencies — `xero-node` SDK explicitly evaluated and rejected; documented inline in `lib/integrations/xero/oauth.ts` JSDoc + this changelog)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — Last-updated header rewritten + Active Workstream §5 sub-PR ticks (41f.0 ✅ + 41f.1 ✅ + 41f.2 ✅ — duplicate 41f.3 line removed) + Up Next #30 row + Blocking line.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
The disconnect route does an `update` and the callback does `findFirst → update | create`. Both are filled in advance:

**`update` in `disconnect/route.ts`:**
1. WHERE clause matches: `{ id: integration.id }` where `integration` was just `findFirst({ where: { scope: 'USER_ENTITY', legalEntityId, userId: auth.userId } })`. Only the row uniquely owned by the calling user for this entity.
2. Columns overwritten: `accessToken`, `refreshToken`, `tokenExpiresAt`, `tokenScope`, `isConnected`, `connectionError`, `syncEnabled`, `autoSyncEnabled`. All integration-lifecycle state owned by this code path.
3. Guard: the rows being updated were created by this code path (the connect callback is the only writer of these fields).

**`update | create` in `callback/route.ts`:**
1. WHERE clause matches: `{ scope: 'USER_ENTITY', legalEntityId, provider: 'XERO' }` for findFirst, then `{ id }` for the update. Only the unique-per-(entity, scope, provider) row.
2. Columns overwritten / created: tokens + tenant metadata + connection state. All written exclusively by this callback.
3. Guard: the partial unique index `accounting_integrations_entity_provider_uniq` (Phase 41f.1 migration) prevents two USER_ENTITY rows for the same (entityId, provider). New rows are this callback's; existing rows were created by this same callback on a prior connection.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A — no `prisma/schema.prisma` changes (schema landed in PR #691).

### PR
- Branch: `claude/phase-41f2-xero-oauth`
- Status: pending push + open

---

## Session: claude/phase-41f1-schema-migration (Phase 41f.1 — Schema migration)

### Strategy
Implements the schema design from `docs/blueprint/PHASE_41F_BOOKKEEPING_INTEGRATION.md` §4 + §6 (PR #690 merged 2026-05-07; D-41F-1 through D-41F-5 ✅ APPROVED). No service or UI changes — pure schema. Sets the foundation for 41f.2 (Xero OAuth) which starts after this lands on main.

### Type
- **Type**: Schema migration (Phase 41f follow-up — closes 41f.1 in the active workstream)
- **Scope**: `prisma/schema.prisma` + new migration SQL. Two new enums (`AccountingIntegrationScope`, `TrustDeedRuleStatus`), one extended model (`AccountingIntegration`), two new models (`EntityAccountingSnapshot`, `TrustDeedExtractedRules`), three new back-relations on `User` + `LegalEntity`.

### Files Created
- `prisma/migrations/20260510100000_add_phase_41f_bookkeeping/migration.sql` — hand-crafted (per Phase 41i.3 pattern; no DATABASE_URL in env). Three concerns in one migration: (1) extend `accounting_integrations` with `scope`/`userId`/`legalEntityId` columns + drop the original full-table unique + add two partial unique indexes per scope + add the XOR `CHECK` constraint + add FKs with cascade-on-delete + scope/user/entity indexes; (2) create `entity_accounting_snapshots` table with provenance (`sourceProvider` / `sourceTenantId` / `pulledAt` / `pulledByUserId`) + period (`fiscalPeriod` / `periodStartDate` / `periodEndDate`) + Balance Sheet (totals + 8 optional line items) + P&L (revenue / COGS / opEx / NPBT / tax / NPAT / depreciation / interest) + tax-engine inputs (`distributableSurplus` for Div 7A / `trustNetIncome` for Div 6E / `smsfMemberBalances` for SIS) + `rawProviderPayload` JSON for forensic re-derivation + idempotent unique key on `(legalEntityId, fiscalPeriod)`; (3) create `trust_deed_extracted_rules` with provenance (`uploadedDocumentId` FK to Phase 26 Document model + `extractedAt` + `extractorVersion` + `extractedByUserId`) + 4-step lifecycle (`status: EXTRACTED | CONFIRMED | REJECTED` + `confirmedAt` / `rejectedAt` / `rejectionReason`) + extracted rules (beneficiaries / distributionRules / vestingDate / trusteePower / loanProvisions / uncomputedNotes — all JSON with Zod validation at write time) + `rawExtractorPayload` JSON. CLAUDE.md §12.11 destructive-write checklist filled in verbatim at the top of the file.

### Files Modified
- `prisma/schema.prisma`:
  - **Enums** added: `AccountingIntegrationScope` (`ORG | USER_ENTITY`); `TrustDeedRuleStatus` (`EXTRACTED | CONFIRMED | REJECTED`).
  - **`AccountingIntegration` model** extended: `scope` discriminator with default `ORG`; nullable `userId` + `legalEntityId` columns; `organizationId` made nullable; original `@@unique([organizationId, provider])` replaced by raw-SQL partial unique indexes (Prisma can't model `WHERE` on `@@unique`); new `user` + `legalEntity` relations with `onDelete: Cascade`; new indexes on `userId`, `legalEntityId`, `scope`. Inline JSDoc records the XOR invariant + the OAuth-encryption-at-rest posture (CMEK on Cloud SQL Text columns).
  - **New `EntityAccountingSnapshot` model** with full Balance Sheet / P&L / tax-engine-input columns + provenance + idempotent overwrite key + `legalEntity` relation cascading on entity delete. Inline JSDoc cross-links to spec doc §6.1.
  - **New `TrustDeedExtractedRules` model** with 4-step lifecycle + Zod-validated JSON columns + Phase 26 vault FK. Inline JSDoc reinforces §1.1 scope boundary ("storage + understanding only").
  - **`User` model** — new `accountingIntegrations` back-relation (cascading on user delete via the FK).
  - **`LegalEntity` model** — three new back-relations (`accountingIntegrations`, `accountingSnapshots`, `trustDeedExtractedRules`), all cascading on entity delete.
- `docs/IMPLEMENTATION_PLAN.md`:
  - `Last updated` header rewritten — Phase 41f.1 schema migration shipping (this PR); 41f.0 PR #690 marked merged.
  - Active Workstream §5 — 41f.0 ticked + ✅ APPROVED 2026-05-07; 41f.1 ticked + full summary; 5 D-41F decisions marked ✅ APPROVED.
  - Up Next #30 status flipped to "🟡 IN FLIGHT — 41f.0 design doc PR #690 ✅ MERGED 2026-05-07; 41f.1 schema migration shipping (this PR)".

### Architecture Decisions
- **Hand-crafted migration SQL** — no DATABASE_URL in dev env so `prisma migrate dev` would fail. Following the Phase 41i.3 + 41h.5 pattern of authoring the migration manually + verifying against `prisma validate` + `prisma generate`. Vercel build runs `prisma migrate deploy` on every deploy (CLAUDE.md §12.12) — first deploy after merge will apply this migration to dev (Vercel Preview against `monitrax-db-dev`) before the production deploy.
- **Partial unique indexes via raw SQL** — Prisma can't model `WHERE` clauses on `@@unique`. Two indexes: `accounting_integrations_org_provider_uniq` (`WHERE scope = 'ORG'`) + `accounting_integrations_entity_provider_uniq` (`WHERE scope = 'USER_ENTITY'`). Same provider can be connected once per ORG and once per USER_ENTITY, but never twice within the same scope.
- **XOR `CHECK` constraint catches malformed inserts** — `(scope = 'ORG' AND organizationId IS NOT NULL AND userId IS NULL AND legalEntityId IS NULL) OR (scope = 'USER_ENTITY' AND organizationId IS NULL AND userId IS NOT NULL AND legalEntityId IS NOT NULL)`. Rejects any insert that doesn't match exactly one shape. App-level constructor in 41f.2 will enforce the same invariant before insert.
- **`onDelete: Cascade` on all three USER_ENTITY-side FKs** — deleting a User cascades through `AccountingIntegration` (via userId FK); deleting a LegalEntity cascades through `AccountingIntegration` (via legalEntityId FK), `EntityAccountingSnapshot`, and `TrustDeedExtractedRules`. Right-to-erasure compliance (CLAUDE.md Part 13).
- **`rawProviderPayload` + `rawExtractorPayload` JSON columns** — kept for forensic re-derivation if our typed shape evolves. Phase 41i (calc audit system) can recompute from raw if the typed columns drift.
- **No `pulledByUserId` FK** — kept as TEXT, not a FK, because audit-trail rows survive user deletion (compliance archive). Same pattern Phase 32C PR4d uses for `senderRole` on `ConversationMessage`.
- **Existing Phase 32 caller (`prisma.accountingIntegration.count({ where: { organizationId } })`) is unaffected** — the WHERE filter naturally excludes USER_ENTITY-scope rows whose `organizationId` is NULL. No code change required in `app/api/portal/organizations/[orgId]/route.ts:96`.

### Build Status
- [x] `prisma validate` — clean
- [x] `prisma generate` — generated Prisma Client (v5.22.0) cleanly
- [x] `npx tsc --noEmit` — clean (only pre-existing `stripeBillingService.ts` "stripe" module-not-found, unrelated)

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (new `accessToken`/`refreshToken` columns inherit existing CMEK encryption at rest; new `tfn`/PII-bearing trust-deed JSON inherits the existing Phase 26 vault encryption posture; ON DELETE CASCADE preserves right-to-erasure)
- [ ] operational procedure
- [x] strategic decision (Option A schema-extension approach implemented per D-41F-1 sign-off)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — Last updated header + Active Workstream §5 sub-PR ticks + Up Next #30 row flipped.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
**Filled in verbatim at the top of `prisma/migrations/20260510100000_add_phase_41f_bookkeeping/migration.sql`:**
1. WHERE clause matches: N/A — pure ALTER TABLE / CREATE INDEX / CREATE TABLE. No row UPDATE / DELETE / UPSERT.
2. Columns overwritten / rows deleted: NONE.
3. Guard ensuring this only mutates rows I created: N/A — schema only. Pre-flight verified zero rows in `accounting_integrations` (the model was added by Phase 32 portal but its callers ship outside the stub layer; no production users have connected accounting yet).

The one existing-constraint touch is `ALTER COLUMN organization_id DROP NOT NULL`. This is structurally non-destructive (relaxes a constraint, doesn't tighten one). The new XOR `CHECK` constraint catches any malformed insert.

### Schema Migration Checklist (CLAUDE.md §12.12)
- [x] `prisma/schema.prisma` modified
- [x] Matching migration at `prisma/migrations/20260510100000_add_phase_41f_bookkeeping/migration.sql`
- [x] Migration is purely additive on row data; the only existing-constraint touch is `ALTER COLUMN ... DROP NOT NULL` (relaxing, not tightening) on a column with zero existing rows
- [x] `npx prisma validate` clean
- [x] `npx prisma generate` clean

### PR
- Branch: `claude/phase-41f1-schema-migration`
- Status: pending push + open

---

## Session: claude/phase-41f0-design-doc (Phase 41f.0 — Bookkeeping Integration design doc)

### Strategy
Kicks off Phase 41f (personal Xero / MYOB / QuickBooks integration, Up Next #30). Following the locked-in 41e pattern: a design doc PR ships before any code or schema, gating the work on Reza's strategic sign-off across 5 decisions (D-41F-1 through D-41F-5). The sub-PR sequence matches Reza's ~10-day estimate: 41f.0 design (this PR, 1 day) → 41f.1 schema (1 day) → 41f.2 Xero OAuth (3 days) → 41f.3 snapshot import + Div 7A wiring (3 days) → 41f.4 trust-deed parser (2-3 days).

### Type
- **Type**: Docs (design doc; doc-only PR; no code)
- **Scope**: New `docs/blueprint/PHASE_41F_BOOKKEEPING_INTEGRATION.md` + cross-links from `MASTER_BLUEPRINT.md` + `PHASE_41_REGULATORY_ARCHITECTURE.md` + new Active Workstream entry in `IMPLEMENTATION_PLAN.md` + flipped Up Next #30 row.

### Files Created
- `docs/blueprint/PHASE_41F_BOOKKEEPING_INTEGRATION.md` — 15 sections covering: strategic positioning ("Monitrax CONSUMES Xero, never replaces it"), the four-lens design rationale, building-blocks recon (Phase 32 portal stubs / Phase 41a `LegalEntity` / Phase 26 OCR + Gemini SDK), architecture decision §4 (Option A extend `AccountingIntegration` with scope discriminator vs Option B new model — recommended A), full sub-PR sequence §5, new `EntityAccountingSnapshot` + `TrustDeedExtractedRules` Prisma model definitions §6, 4-step trust-deed confirm-before-apply flow §7, the 5 strategic decisions §8 (D-41F-1 through D-41F-5), UNCOMPUTED v1 register §9 (8 items), CDR / privacy posture §10 (Xero is non-CDR business data; OAuth tokens CMEK-encrypted; trust-deed PDFs in existing Phase 26 vault), out-of-scope §11 (bidirectional sync, transaction-level data, MYOB / QB, multi-tenant, real-time webhooks, adviser-impersonation, Sankey integration — all PROD), Reza sign-off block §12 (9 ticks gating 41f.1 start), risks + mitigations §13, per-sub-PR test plan §14.

### Files Modified
- `docs/IMPLEMENTATION_PLAN.md`:
  - `Last updated` header rewritten — Phase 41f kicked off with 41f.0 design doc; positioning preserved verbatim ("Monitrax CONSUMES Xero data, never replaces it").
  - New Active Workstream §5 "Phase 41f — Personal Bookkeeping Integration (Xero v1)" with 5-sub-PR checklist + 5 D-41F decisions + hard constraints + risk/blocking/closes.
  - Up Next #30 (Phase 41f) row rewritten to reflect 🟡 IN FLIGHT state + sub-PR sequence + 5 D-41F decisions + cross-link to design doc; trigger flipped from "After 41c" (long-shipped) → "After 41c (✅ shipped) — UNBLOCKED, IN FLIGHT".
- `docs/blueprint/MASTER_BLUEPRINT.md`:
  - Phase 41f row rewritten from "Xero Bidirectional Sync — 📋 Planned (~10 days)" to "Personal Bookkeeping Integration — 🟡 In Progress (~10 days, 5 sub-PRs)" with full sub-PR map, positioning quote, v1 vs v2 vs PROD scope cuts.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md`:
  - New §11.1.1 "Phase 41f — Personal Bookkeeping Integration" inserted between §11.1 (Phase 41h sub-PR sequence) and §11.2 (Phase 41i). Cross-links to the spec doc, full sub-PR table, HR-1 / HR-2 / D-2 preservation in 41f context.

### Architecture Decisions (5 gated on Reza sign-off — see PHASE_41F_BOOKKEEPING_INTEGRATION.md §8)
- **D-41F-1 (recommended A)** — extend `AccountingIntegration` with scope discriminator. Reuses Phase 32 OAuth + sync-log + entity-mapping infrastructure verbatim; additive migration; future-proofs adviser-impersonation use case (Phase 32 adviser connecting client books on behalf).
- **D-41F-2 (recommended Xero only at v1)** — Reza's positioning quote names Xero specifically. MYOB + QuickBooks → v2 (the existing enum keeps them open). UI can show "MYOB — Coming soon" tile.
- **D-41F-3 (recommended 4-step)** — trust deed parsing runs as upload → extract → user-confirms-each-rule → apply. Trust deed is a legal instrument; misinterpretation has tax + legal blast radius; the 5-minute friction is the feature.
- **D-41F-4 (recommended entity-detail-only at v1)** — imported P&L renders on entity detail at v1; Money Flow Sankey integration → v2. Avoids re-thinking Phase 41d under time pressure.
- **D-41F-5 (recommended auto-feed with override)** — distributable surplus auto-feeds Phase 41e.6 Div 7A classifier with audit log + per-loan override. Keeps the engine flowing; user friction only when they want to override.

### Build Status
- N/A — docs-only.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture (CDR posture documented in spec doc §10 but no live code change yet)
- [ ] operational procedure
- [x] strategic decision (5 strategic decisions D-41F-1 through D-41F-5 surfaced in `PHASE_41F_BOOKKEEPING_INTEGRATION.md` §8 + §12 Reza sign-off block; phase moved from queued → in-flight in `IMPLEMENTATION_PLAN.md` + `MASTER_BLUEPRINT.md`)

Docs updated in this PR:
- `docs/blueprint/PHASE_41F_BOOKKEEPING_INTEGRATION.md` — new spec doc.
- `docs/IMPLEMENTATION_PLAN.md` — Last updated header + new Active Workstream §5 + Up Next #30 flipped to in-flight.
- `docs/blueprint/MASTER_BLUEPRINT.md` — Phase 41f row rewritten (Planned → In Progress).
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` — new §11.1.1 cross-linking to the spec doc.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A for this PR (docs-only). The §12.11 checklist for the 41f.1 schema migration is **filled in advance** in `PHASE_41F_BOOKKEEPING_INTEGRATION.md` §4: the only existing-constraint touch is `ALTER COLUMN organization_id DROP NOT NULL` on `accounting_integrations`; pre-flight verified zero existing rows. The XOR check constraint catches malformed inserts. 41f.1 will re-validate before merge.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A for this PR (docs-only). The 41f.1 migration plan is fully scripted in spec doc §4 and will be Prisma-generated at 41f.1 implementation time per the §12.12 protocol.

### PR
- Branch: `claude/phase-41f0-design-doc`
- Status: pending push + open

---

## Session: claude/docs-post-688-merge (Doc-sync — Phase 41 status reflection)

### Strategy
Flat doc-sync pass after PRs #687 (41h.6) + #688 (41h.7) landed on main. CLAUDE.md §16.7 captures the failure mode this prevents: documenting decisions only after the fact leaves the plan stale and the next session re-litigating completed work.

### Type
- **Type**: Docs (per-PR doc-sync; no code changes)
- **Scope**: `IMPLEMENTATION_PLAN.md` Last-updated header + Up Next #29/39/40 markers + `MASTER_BLUEPRINT.md` Phase 41e/41h/41i status rows + `CHANGELOG_2026_05_07.md` PR-status markers.

### Files Modified
- `docs/IMPLEMENTATION_PLAN.md`:
  - `Last updated` header refreshed to reflect Phase 41h FULLY COMPLETE (8 sub-PRs 41h.0 → 41h.7 all merged) + Phase 41i FULLY COMPLETE (5 sub-PRs 41i.0+1 → 41i.5).
  - Up Next #29 (Phase 41e) flipped from queued → ✅ SHIPPED 2026-05-05 (18 sub-PRs from 41e.−1 cleanup through 41e.17 MasterTaxPosition orchestrator); the work was the foundation Phase 41h's tools wrap.
  - Up Next #39 (Phase 41h.6) marker `(this PR)` → `(PR #687 merged)`.
  - Up Next #40 (Phase 41h.7) marker `(this PR)` → `(PR #688 merged)`.
  - Recently Completed entries for 41h.6 + 41h.7 same flip.
- `docs/blueprint/MASTER_BLUEPRINT.md`:
  - Phase 41e row flipped from 📋 Planned (~28 days) → ✅ Complete (May 2026); module list expanded with sub-PR map (41e.1 → 41e.17).
  - Phase 41h row flipped from 📋 Planned (~7 days) → ✅ Complete (May 2026); registry state captured (10 canonical tools — 6 FACT_LOOKUP + 4 SCENARIO_RUN); three structural enforcement layers documented; user-facing surface graduation noted (TRAIL Stage 5 — Live, per CLAUDE.md §14).
  - New Phase 41i row inserted after 41h: ✅ Complete (May 2026) with HR-3 framing, 5 sub-PR map, three calc-audit layers (L1 deterministic regression / L2 temporal anomaly / L3 persistent-findings foundation), Slack + email alerting threshold, 41i.3b deferral note.
- `docs/changelog/CHANGELOG_2026_05_07.md`:
  - Phase 41h.7 session "pending push + open" → "PR #688 merged 2026-05-07".
  - Phase 41h.6 session "pending push + open" → "PR #687 merged 2026-05-07".

### Architecture Decisions
- **Doc-sync passes are surgical, not editorial.** Every flip is a status update to a specific marker — no rewrites of historical content. Per CLAUDE.md §15.5 format discipline.
- **Phase 41i row inserted in Master Blueprint as a peer to 41h** rather than as a sub-bullet under it. Reason: 41i is HR-3-aligned, scope-wise cross-app (not just tax), and has its own admin-portal surface — peer-level visibility makes the calc-audit safety net legible to future operators reading the blueprint.
- **Phase 41e row consolidated into a single ✅ Complete entry** rather than enumerating each of the 18 sub-PRs. Reason: the Master Blueprint is the strategic/status doc per §15.6 — sub-PR detail belongs in the Phase doc + the per-day changelogs (where it already lives).

### Build Status
- N/A — docs-only.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Phase 41e + 41h + 41i statuses flipped from Planned → Complete on the master strategic blueprint; Last-updated headers + per-row markers refreshed across the live plan)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` (Last updated header + Up Next #29/#39/#40 + Recently Completed flip).
- `docs/blueprint/MASTER_BLUEPRINT.md` (Phase 41e + 41h flipped to Complete; new Phase 41i row inserted).
- `docs/changelog/CHANGELOG_2026_05_07.md` (this session entry + PR status flips on 41h.6/41h.7 sessions).

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — no Prisma writes anywhere in this PR.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A — no `prisma/schema.prisma` changes.

### PR
- Branch: `claude/docs-post-688-merge`
- Status: pending push + open

---

## Session: claude/phase-41h7-trail-aligned-ia (Phase 41h.7 — TRAIL-aligned IA)

### Strategy
- Closes Up Next #40. Graduates the AI advisor from orphan deep-link `/dashboard/cfo/ask` (integration scaffold from 41h.4) to natural-IA placement under "My Guide" (TRAIL Stage 5 — Live, per CLAUDE.md §14).
- Two design options surveyed: (A) sidebar child + CTA card on parent page; (B) fold inline as a tab on `/dashboard/cfo`. **Chose A** — the CFO Actions page already has 5+ sections (AIAdviceSection / Health Hero / Insight Tiles / Risk Radar / Monthly Progress); adding inline ask form would overload it. Designer lens: restraint over density. Behavioural-psychology lens: a focused conversation surface is better for asking a specific question than fighting for attention on a busy parent page.
- URL stable (`/dashboard/cfo/ask`) — no audit-log search updates needed.

### Type
- **Type**: Enhancement (Phase 41h follow-up — closes Up Next #40)
- **Scope**: Information architecture + sidebar + parent-page CTA card. Routing + IA + visual hooks only.
- **No code changes to**: `components/ai-advisor/*`, `lib/ai/tax-advisor/*`, `app/api/ai-advisor/ask/route.ts`. All primitives provider-agnostic from 41h.3 onwards.

### Files Modified
- `components/DashboardLayout.tsx` — `reachNavItems[].children` for "My Guide" extended with new `{ name: 'Ask the Advisor', href: '/dashboard/cfo/ask' }` entry; `matchRoutes` extended with `/dashboard/cfo/ask` so My Guide stays highlighted on the conversation surface; inline JSDoc records the 41h.7 graduation decision and the architect-lens rationale (URL stable, primitives untouched).
- `app/dashboard/cfo/page.tsx` — new restrained Apple-glass CTA card directly below `<AIAdviceSection />`. Brain icon (matching My Guide sidebar lucide-icon), warm-amber palette (border-amber-100/60 / bg-amber-50/40 with dark-mode variants), single-line affordance "Have a specific question? — Ask the advisor about your tax position, contribution headroom, land tax, or a 'what if' scenario. Answers cite the rule and the number from your data." → `<Button asChild size="sm">` wrapping `<Link href="/dashboard/cfo/ask">Ask the Advisor →</Link>`. Inline JSDoc records the 41h.7 design rationale.
- `app/dashboard/cfo/ask/page.tsx` — page-header rewarmed: title "Ask the AI advisor" → "Ask the Advisor"; description softened ("the advisor never invents either"). Top-of-file JSDoc updated to reflect graduated placement (no longer "future iteration may hoist").

### Files Created
- None — the change is config + a small CTA card composed of existing primitives.

### Architecture Decisions
- **Sidebar child + parent CTA over fold-inline-tab.** Two affordances, one canonical surface. The advisor stays a focused conversation page rather than competing with the AI advice / health / tiles / risk on the Actions tab.
- **URL stability.** `/dashboard/cfo/ask` preserved — audit logs from 41h.4 onwards remain searchable; downstream `runAdvisorQuery` helper untouched.
- **Provider-agnostic primitives untouched.** `components/ai-advisor/*` was built provider-agnostic in 41h.3; this change validates the design — graduating the advisor required zero component changes.
- **No new design primitive.** The CTA card uses existing Card / CardContent / Button primitives + the lucide-Brain icon already used by the sidebar item + the existing amber palette already used elsewhere in the tile system. CLAUDE.md §16.4 inline-JSDoc requirements N/A (no new reusable primitive introduced).
- **Tests skipped (deliberate).** DashboardLayout is a client component depending on `useAuth` / `useUISyncEngine` / `useOnboardingState` / context providers — adding mock layers for a routing-config change is more cost than benefit. Structural floor is `tsc --noEmit` clean (verified). The existing 12 AI-advisor component tests from 41h.3 cover the underlying ask/answer surface end-to-end. CLAUDE.md §0 architect lens — don't add tests for the sake of it.

### Build Status
- [x] `npx tsc --noEmit` — clean (only pre-existing `stripeBillingService.ts` "stripe" module-not-found, unrelated to this PR).

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern — new restrained CTA card pattern on `/dashboard/cfo` (no new reusable primitive — composes existing Card / Button / Brain / amber palette; `06_UI_UX_FOUNDATION.md` not touched per §16.3 first row "single component, no system change").
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (Option A "sidebar child + CTA card" chosen over Option B "fold inline as a tab"; rationale in PR + IMPLEMENTATION_PLAN.md + this changelog)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #40` — marked SHIPPED with summary; `Last updated` header refreshed; new Recently Completed entry prepended.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md:§11.1` — sub-PR table extended with new 41h.7 SHIPPED row.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.
- Inline JSDoc on `components/DashboardLayout.tsx` (sidebar item rationale) + `app/dashboard/cfo/page.tsx` (CTA card rationale) + `app/dashboard/cfo/ask/page.tsx` (graduated-placement note).

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — no Prisma writes anywhere in this PR.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A — no `prisma/schema.prisma` changes.

### PR
- Branch: `claude/phase-41h7-trail-aligned-ia`
- **Status: PR #688 merged 2026-05-07.**

---

## Session: claude/phase-41h6-scenario-run-tools (Phase 41h.6 — SCENARIO_RUN tools expansion)

### Strategy
- Closes Up Next #39: SCENARIO_RUN tools expansion. Builds on the locked-in pattern from 41h.5 (`runContributionScenario`).
- Three new SCENARIO_RUN tools wrapping the highest-value tax engines:
  1. `runCgtScenario` — wraps `applyCapitalLossNetting` (Div 102-A / s100-50 / s115-100)
  2. `runLandTaxScenario` — wraps `calculateCrossStateLandTax` (per-state Land Tax Acts)
  3. `runDiv7aRefinanceScenario` — wraps `classifyDiv7ALoans` (Div 7A — s109B-s109ZE, s109N safe harbour)
- Each adapter is a small file under `lib/ai/tax-advisor/tools/` returning baseline + scenario + delta numerical fields per the locked-in `scenario.{baseline,input,result,delta}.*` path convention.
- All HR-1/HR-2/D-2 boundaries preserved at every layer:
  - **HR-1**: every number computed by the underlying engine; the tool composes inputs and subtracts.
  - **HR-2**: every citation lifted from the engine's `AuthorityCitation[]` with stable `cit-N` ids.
  - **D-2**: `kind === 'SCENARIO_RUN'`; descriptions explicitly disclaim "Does NOT recommend whether to ...". Returning a scenario number is a fact, not a recommendation.

### Type
- **Type**: Feature (Phase 41h follow-up — closes Up Next #39)
- **Scope**: AI advisor tool registry — 3 new SCENARIO_RUN tools, registry size 7 → 10
- **Authority**: ITAA 1997 Div 102-A / s100-50 / s115-100 (CGT); per-state Land Tax Acts (NSW 1956, VIC 2005, QLD 2010, SA 1936, WA 2002, TAS 2000, ACT 2004, NT 1992); ITAA 1936 Div 7A s109B-s109ZE + s109N MRP safe harbour.

### Files Created
- `lib/ai/tax-advisor/tools/runCgtScenario.ts` — wraps `applyCapitalLossNetting`. Inputs: `entityType`, `currentEvents`, `hypotheticalEvents`, optional `carryForwardLosses` / `isComplying` / `isForeignResident`. Returns 9 numericFields: baseline (`assessableNetCapitalGain`, `netGainBeforeDiscount`); scenario inputs (`hypotheticalGains`, `hypotheticalLosses`, `hypotheticalEventCount`); scenario result (`assessableNetCapitalGain`, `netGainBeforeDiscount`); delta (`assessableNetCapitalGain`, `netGainBeforeDiscount`). Citations from the underlying engine.
- `lib/ai/tax-advisor/tools/runLandTaxScenario.ts` — wraps `calculateCrossStateLandTax`. Inputs: `ownershipType`, `isForeignOwner`, `currentProperties`, `hypotheticalProperties`. Returns 10 numericFields covering baseline + scenario + delta on `grandTotalTax` + `grandTotalForeignSurcharge` + `statesAssessed`, plus echoed sum of hypothetical taxable land values.
- `lib/ai/tax-advisor/tools/runDiv7aRefinanceScenario.ts` — wraps `classifyDiv7ALoans`. Inputs: `currentLoans`, `loanIdsToRefinance` (flips `hasComplianceAgreement: true` on listed loans, leaves others untouched), optional `overrideYearsRemaining` / `overrideBenchmarkRate`. Returns 8 numericFields covering baseline + scenario + delta on `totalDeemedDividend` + `compliantLoanCount`.
- `tests/ai/tax-advisor/tools-41h6.test.ts` — 36 new tests: per-tool baseline + scenario + delta presence; zero-hypothetical → zero-delta idempotency invariant for all three; foreign-owner residential hypothetical increases foreign-surcharge delta; refinance only flips listed loanIds; HR-1/HR-2/D-2 contract per tool (`kind === 'SCENARIO_RUN'`, banned-word check on tool names, every citationId resolves, every tool exposes all four `scenario.*` path roots).

### Files Modified
- `lib/ai/tax-advisor/index.ts` — bootstrap registers all 3 new tools; `CANONICAL_TOOLS` now `FACT_LOOKUP × 6 + SCENARIO_RUN × 4 = 10`. Public re-exports added for the three new tool consts.
- `tests/ai/tax-advisor/registry.test.ts` — registry size assertion 7 → 10; alphabetical name list extended with `runCgtScenario`, `runDiv7aRefinanceScenario`, `runLandTaxScenario`.
- `tests/ai/tax-advisor/tools-41h5.test.ts` — registry-state assertions updated for new size 10 + 4 SCENARIO_RUNs (the existing 41h.5 tool-level assertions remain untouched).
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #39 marked SHIPPED with summary; `Last updated` header refreshed; new Recently Completed entry prepended for 2026-05-07 (Phase 41h.6).
- `docs/architecture/03_DATA_MODEL.md` — new §10.41 "Phase 41h.6 — SCENARIO_RUN tools expansion" with the three tools, locked-in pattern, hard-rule preservation, registry state, test coverage.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` — §11.1 sub-PR table extended with new 41h.6 SHIPPED row; 41h.5 row updated to "CLOSES PHASE 41h CORE" so the doc remains internally consistent.

### Architecture Decisions
- **Pattern reuse over re-design.** The 41h.5 SCENARIO_RUN pattern (returns baseline + scenario + delta numerical fields under a stable four-root path scheme) is reused verbatim. No bespoke shape per tool — the AI advisor's runtime validator can rely on a single contract across all SCENARIO_RUN tools.
- **Adapter-only — no engine changes.** Each tool is a thin wrapper that composes inputs (current + hypothetical) and calls the existing pure calc engine twice (baseline + scenario). Deltas are subtraction. Zero changes to `lib/tax-engine/`.
- **Citations lifted from the engine, not duplicated.** Each tool maps the engine's `citations[]` to `IdentifiedCitation[]` with stable `cit-N` ids. No tool-side citation invention. HR-2 preserved structurally.
- **D-2 preserved by description, not just by `kind`.** Every tool description starts with the kind (`SCENARIO_RUN: ...`) and explicitly disclaims "Does NOT recommend whether to ...". The locked-in test (`description either fact_lookup-disclaim or scenario_run-disclaim`) covers both shapes.
- **Test for the contract, not the engine.** The 41h.6 test suite asserts the SHAPE of the SCENARIO_RUN tool output (baseline + scenario + delta paths exist; deltas are well-typed; zero-hypothetical produces zero-delta as an idempotency invariant). The underlying engine's correctness is owned by the engine's own test suite + the calc-audit fixtures (Phase 41i.2 — 36 engines × 45 fixtures all green).
- **Refinance scenario uses opt-in loan list.** `loanIdsToRefinance` is the explicit set of loans to flip `hasComplianceAgreement: true`. Loans NOT in the list are untouched. This preserves the user's mental model ("what if I refinanced loan L1?" — not "what if I refinanced everything?").

### Build Status
- [x] `npx tsc --noEmit` — clean (only pre-existing `stripeBillingService.ts` "stripe" module-not-found, unrelated to this PR).
- [x] `npx vitest run tests/ai/tax-advisor` — 147 pass (was 111). All registry / 41h.0-5 / 41h.6 / runAdvisorQuery / Gemini / gateway / askAProRouting suites green.
- [x] `npx vitest run tests/ai/tax-advisor/tools-41h6.test.ts` — 36 / 36 pass.
- [x] `npx vitest run tests/ai/tax-advisor/tools-41h5.test.ts` — 34 / 34 pass after registry-state assertions updated.
- [x] `npx vitest run tests/ai/tax-advisor/registry.test.ts` — 23 / 23 pass after size + alphabetical assertions updated.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (locked-in SCENARIO_RUN pattern reused for 3 more tools — registry size 7 → 10; pattern proven across the 4 highest-value tax surfaces)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #39` — marked SHIPPED with summary; `Last updated` header refreshed; new Recently Completed entry prepended.
- `docs/architecture/03_DATA_MODEL.md:§10.41` — new section "Phase 41h.6 — SCENARIO_RUN tools expansion" with full registry state + tool details + hard-rule preservation table.
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md:§11.1` — sub-PR table extended with 41h.6 SHIPPED row.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — no Prisma writes anywhere in this PR. All changes are pure-function adapter code under `lib/ai/tax-advisor/tools/` plus tests + docs.

### Schema Migration Checklist (CLAUDE.md §12.12)
N/A — no `prisma/schema.prisma` changes.

### PR
- Branch: `claude/phase-41h6-scenario-run-tools`
- **Status: PR #687 merged 2026-05-07.**

---

## Session: claude/phase-41i5-l2-anomaly-detection (Phase 41i.5 — L2 anomaly detection. CLOSES PHASE 41i.)

### Strategy
Closes Phase 41i. The L2 layer — temporal pattern detection over the `CalcAuditFinding` history. Per HR-3 admin-side only. Per the architect call, scoped to operate on **existing finding history** (not per-user calc data) so it ships useful from day 1, not gated on production user volume.

### Two patterns
| Pattern | Fires when | Severity |
|---|---|---|
| `HIGH_FREQUENCY` | Engine produces > threshold findings in `lookbackDays` (default 5/7d) | MEDIUM (or HIGH if > 2× threshold) |
| `REGRESSION_AFTER_STABLE_PERIOD` | Engine quiet ≥ 30 days then sudden new findings with prior-to-recent gap ≥ 14 days | HIGH |

Both surface as `source: 'L2_ANOMALY'` findings flowing through the existing 41i.3 lifecycle + 41i.4 alerting.

### What ships
- `lib/calc-audit/anomalyDetection.ts` (NEW): scanner + pure-logic helpers (`detectHighFrequencyPatterns`, `detectRegressionPattern`)
- `app/api/admin/calc-audit/anomaly-scan/route.ts` (NEW): endpoint with two auth paths — admin session OR Cloud Scheduler shared secret
- `docs/operational/calc-audit/cloud-scheduler-setup.md` (NEW): gcloud + Vercel ops runbook
- `tests/calc-audit/anomalyDetection.test.ts` (NEW): 17 tests for both patterns

### Cloud Scheduler integration
Single `gcloud scheduler jobs create http` command. 3 AM AEST daily default. Shared-secret bearer auth via `CALC_AUDIT_SCHEDULER_SHARED_SECRET` env var (constant-time-ish comparison). Pause/resume/delete + body-tuning commands documented.

### Dedup
Same pattern as 41i.3's `recordDifferentialFindings` — existing OPEN/INVESTIGATING `L2_ANOMALY` findings for `(engineName, kind)` are refreshed instead of duplicated. Daily scans don't spam the queue.

### Tests (17 new — 649 total)
- `detectHighFrequencyPatterns` (6) — empty input; over-threshold; boundary case; HIGH escalation; multi-engine independence; evidence shape
- `detectRegressionPattern` (6) — long quiet period; first-ever findings; recent prior doesn't fire; gap < threshold doesn't fire; evidence shape; prior inside lookback returns null
- Default constants (5) — exposed; sanity invariant (stable period > regression gap)

### Phase 41i is COMPLETE
All 5 sub-PRs shipped:
- 41i.0 + 41i.1 — Foundation + L1 fixture differential
- 41i.2 — Engine adapter expansion (14 → 36 engines)
- 41i.3 — L3 audit foundation: persistent findings + lifecycle
- 41i.4 — Alerting + workflow + backfill runbook
- 41i.5 — L2 anomaly detection (this PR)

Three calc-audit layers all live (L1 deterministic + L2 temporal + L3 foundation). HR-3 maintained — admin-side only.

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.40
- `docs/operational/calc-audit/cloud-scheduler-setup.md` (new ops runbook)
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.2 41i.5 SHIPPED row marked **CLOSES PHASE 41i**

### Deferred (not blocking)
- 41i.3b — Per-user "Audit this user" (needs per-engine user-data adapters)
- Prisma mock layer for unit tests (currently DB-touching paths smoke-tested manually)
- OIDC auth for Cloud Scheduler (v1 uses shared-secret bearer)

### Next per Reza's roadmap
1. SCENARIO_RUN tools expansion — `runCgtScenario`, `runLandTaxScenario`, `runDiv7aRefinanceScenario`
2. TRAIL-aligned IA — graduate AI advisor from `/dashboard/cfo/ask` to "My Guide" placement (CLAUDE.md §14)

---

## Session: claude/phase-41i4-alerting-workflow (Phase 41i.4 — Alerting + workflow SHIPPED)

### Strategy
Closes the alerting layer on top of 41i.3's lifecycle. With L1 (fixtures) + L3 foundation (persistent findings + lifecycle) + alerting now live, the calc audit safety net is functionally complete. Per HR-3 — admin-side only.

### What ships
- `lib/calc-audit/alertingService.ts` (NEW): two-channel dispatcher (Slack + email) with severity threshold gating
- `lib/calc-audit/findingService.ts` (MODIFIED): fire-and-forget alert hooks on creation + escalation
- `docs/operational/calc-audit/backfill-runbook.md` (NEW): admin SOP for fixing engine bugs + remediating affected users
- `tests/setup/server-only-stub.ts` (NEW): vitest alias for the Next.js `server-only` runtime guard
- `vitest.config.ts` (MODIFIED): wires the stub via `resolve.alias`

### Channels
| Channel | Activation env vars | Behaviour when unset |
|---|---|---|
| Slack webhook | `SLACK_CALC_AUDIT_WEBHOOK_URL` | No-op |
| Email (SendGrid) | `SENDGRID_API_KEY` + `MONITRAX_CALC_AUDIT_ALERT_EMAIL` | No-op (both vars required together) |

### Threshold
- Default: HIGH (only HIGH + CRITICAL findings fire)
- Override: `CALC_AUDIT_ALERT_THRESHOLD` env var
- Invalid values fall back to HIGH (misconfig must not break audit pipeline)

### Triggers
- `CREATED` — new finding ≥ threshold
- `ESCALATED_TO_FIX_REQUIRED` — admin transition (real bug confirmed)
- NO alert on refresh (existing OPEN/INVESTIGATING re-detected) or on FIXED / FALSE_POSITIVE close

### Fire-and-forget
Per CLAUDE.md §12.10. `Promise.all` with per-channel `.catch(() => {})` wrapping. Delivery failures NEVER block the underlying audit operation.

### Backfill runbook (`docs/operational/calc-audit/backfill-runbook.md`)
Admin SOP for the workflow after a confirmed bug:
1. Decision tree from finding → FIX_REQUIRED → backfill scope
2. Identifying affected users (default assumption: most engines pure)
3. Three remediation strategies (re-compute on next access / active backfill / compensating snapshot)
4. Notification policy per HR-3 (existing support tooling, never in-app banners; warm-words copy guidance)
5. Severity → response time SLA matrix
6. CLAUDE.md compliance reminders (§12.11 / §12.12 / §13.3 / §0.4)

### Tests (26 new — 632 total)
- resolveThreshold (3) — default HIGH; valid env override; invalid env fallback
- meetsThreshold (6) — all severity levels against thresholds
- recordAlert threshold gating (4) — CRITICAL fires; MEDIUM/LOW don't; lowered threshold raises gate
- recordAlert no-channels safety (5) — graceful degradation across env permutations
- buildSlackPayload (4) — trigger labels; severity emojis; structured fields contain key data
- buildEmailBody (4) — trigger copy; engine/severity rendered; finding id + portal link; failed assertions

### Test infra
New `tests/setup/server-only-stub.ts` + vitest config alias so any module importing Next.js's `server-only` runtime guard can be unit-tested in node environment. Future server-side libs benefit too.

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.39
- `docs/operational/calc-audit/backfill-runbook.md` (new admin runbook)
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.2 41i.4 SHIPPED row

### Next
**41i.5** — L2 Cloud Scheduler anomaly detection. Deferred until Cloud Scheduler infra is in place; not an immediate dependency since L1 + L3 + alerting are live.

---

## Session: claude/phase-41i3-l3-persistent-findings (Phase 41i.3 — L3 audit foundation: persistent findings + lifecycle SHIPPED)

### Strategy
Persistence layer for the calc audit system. Every drift / error event from `runDifferential()` is now recorded to a DB-backed queue with full lifecycle workflow. Foundation for 41i.4 alerting and 41i.3b per-user audit.

### Schema
```prisma
enum CalcAuditFindingSource { L1_DIFFERENTIAL  L3_ON_DEMAND  L2_ANOMALY }
enum CalcAuditFindingSeverity { INFO  LOW  MEDIUM  HIGH  CRITICAL }
enum CalcAuditFindingResolution { OPEN  INVESTIGATING  FALSE_POSITIVE  FIX_REQUIRED  FIXED }

model CalcAuditFinding {
  id, detectedAt, source, engineName, fixtureName?, userId?,
  severity, resolution, summary, failedAssertions?, errorMessage?,
  adminNotes?, resolvedAt?, resolvedBy?, createdAt, updatedAt
  @@map("calc_audit_findings")
}
```

CLAUDE.md §12.11 N/A — additive table. §12.12 satisfied — `prisma/migrations/20260507120000_add_calc_audit_finding/migration.sql` ships in same PR (hand-crafted; no DATABASE_URL in this env).

### Lifecycle
```
OPEN → INVESTIGATING → FIX_REQUIRED → FIXED
       └─ FALSE_POSITIVE
       
Terminal states (FIXED, FALSE_POSITIVE) → INVESTIGATING (re-open only path)
```

Locked in `ALLOWED_TRANSITIONS`. Self-transitions forbidden.

### What ships
- `lib/calc-audit/findingService.ts` (NEW): `recordDifferentialFindings()` (auto-persist FAIL/ERROR + dedupe by engine+fixture), `listFindings()`, `getFindingCountsByResolution()`, `updateFindingResolution()` (with validated transition + structured `FindingTransitionError`)
- `app/api/admin/calc-audit/route.ts` (MODIFIED): auto-persists on every differential run; returns persistence counts + countsByResolution
- `app/api/admin/calc-audit/findings/route.ts` (NEW): GET list with filters (resolution/source/engineName)
- `app/api/admin/calc-audit/findings/[id]/route.ts` (NEW): PATCH lifecycle update (admin email as resolvedBy)
- `app/admin/calc-audit/page.tsx` (MODIFIED): Findings queue section above engine catalogue + lifecycle counts tile + per-finding cards with context-aware transition buttons

### Auto-persist + dedup
- Every `GET /api/admin/calc-audit` runs the differential AND persists FAIL/ERROR results
- Dedupe: existing OPEN/INVESTIGATING finding for the same `(engineName, fixtureName)` is **refreshed** (latest detectedAt + summary) instead of duplicated
- Severity defaults: FAIL → MEDIUM; ERROR → HIGH

### Tests (9 new — 606 total)
- ALLOWED_TRANSITIONS lifecycle invariants (every state has correct next-states; terminal states re-open only via INVESTIGATING; self-transitions forbidden)
- `FindingTransitionError` shape (NOT_FOUND / INVALID_TRANSITION codes)

Codebase doesn't carry a Prisma mocking layer (`tests/sanity/` uses real DB). Pure-logic locked in tests; end-to-end persistence smoke-tested manually after deploy.

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.38
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.2 41i.3 SHIPPED row

### Deferred
- **41i.3b — Per-user "Audit this user"** — requires per-engine adapters that fetch user data from DB and reconstruct each engine's input. 36 engines × different input shapes = substantial workstream. Foundation now in place.

### Next
**41i.4** — Alerting + workflow (Slack/email when severity ≥ HIGH; the lifecycle workflow is in place to support it).

---

## Session: claude/phase-41i2-engine-adapter-expansion (Phase 41i.2 — Calc audit engine adapter expansion SHIPPED)

### Strategy
Closes the "add more engines" item in the Phase 41i.2 sequence. Extends the calc audit registry from **14 → 36 engines** so every Phase 41e module the AI advisor relies on has assertion-based audit coverage. Drift in any of these now fails CI before users see wrong numbers (HR-3).

### What ships
```
lib/calc-audit/engines/
├── tax.ts              # (existing) 7 NSW + cross-state + loss + GST + capTracker engines
├── tax-divisions.ts    # NEW — 8 division/classifier/orchestrator adapters
├── tax-state.ts        # NEW — 14 state adapters (7 land tax + 7 stamp duty for VIC/QLD/SA/WA/TAS/ACT/NT)
├── core.ts             # (existing) 4 core financial calc adapters
└── property.ts         # (existing) 3 property metric adapters
```

### TAX divisions adapters (8 in `tax-divisions.ts`)
- `tax.cgtNetting` — `applyCapitalLossNetting` (Div 102-A / s100-50 / s115-100)
- `tax.div7aClassifier` — `classifyDiv7ALoans` (ITAA 1936 s109B-s109ZE)
- `tax.psiClassifier` — `classifyPsi` (ITAA 1997 Part 2-42 + s86-15)
- `tax.fteIeeClassifier` — `classifyFteIeeDistributions` (Sch 2F ITAA 1936)
- `tax.div152` — `applyDiv152` (Div 152 small business CGT concessions)
- `tax.smsfTriumvirate` — `classifySmsfTriumvirate` full (SIS Act s62/Pt 8/s67A; s295-550/-160)
- `tax.highIncomeSuperTax` — `calculateHighIncomeSuperTax` (Div 293)
- `tax.masterTaxPosition` — `buildMasterTaxPosition` (Phase 41e.17 orchestrator)

### State adapters (14 in `tax-state.ts`)
7 land tax + 7 stamp duty adapters covering VIC / QLD / SA / WA / TAS / ACT / NT — both regimes now span **all 8 states/territories** (NSW shipped in 41i.0+1).

### Registry now 36 engines / 45 fixtures
| Category | Count | Note |
|---|---|---|
| TAX | 29 | was 7 |
| CORE | 4 | unchanged |
| PROPERTY | 3 | unchanged |

All 45 fixtures green against current engine implementations. tsc clean.

### Tests (2 new — 597 total)
- TAX category includes all Phase 41i.2 division/classifier adapters
- TAX category covers all 8 states for both land tax + stamp duty

The existing "every fixture passes against current implementation" test now enforces **45 PASSes** (was 19) — any future engine refactor changing canonical output forces a deliberate fixture update + reviewer sign-off.

### Smoke-test discipline (lessons re-learned)
While building the adapters, my first draft had wrong type assumptions for several engines:
- `CapitalLossNettingInput.events[*]` — uses `id` + `monthsHeld` (not `eventId` + `discountEligible`)
- `PsiTestResult` is a string union `'PASS' | 'FAIL'` (not an object with `.passed`)
- `FteIeeBeneficiaryInput` uses `distributionAmount` + `relationship: FamilyGroupRelationship` (`'FAMILY_MEMBER'`, not `'SPOUSE'`)
- `Div152Input` uses `gainAfterDiv115` + `maxNetAssetValue` + `aggregatedTurnover` (not `nominalGain` + flat `concessionsClaimed`)
- `calculateHighIncomeSuperTax` takes `(input, TaxYearConfig)` returning structured object (not single args returning number)
- `Div7AClassificationResult.highestSeverity` for NO_AGREEMENT loans is `'NO_AGREEMENT'` (not `'DEEMED_DIVIDEND'` — DEEMED_DIVIDEND is the operative outcome at the top of the rank, but NO_AGREEMENT is the per-loan classification)

The audit system caught all of these as fixture failures before this PR shipped — exactly as designed.

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.37
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.2 41i.2 SHIPPED row

### Next
**41i.3** — L3 on-demand "Audit this user" admin action + persistent `CalcAuditFinding` Prisma model.

---

## Session: claude/phase-41h5-tool-registry-expansion (Phase 41h.5 — Tool registry expansion + SCENARIO_RUN. CLOSES PHASE 41h.)

### Strategy
Closes Phase 41h by expanding the tool registry from 3 → 7 (4 new tools: 3 FACT_LOOKUP + 1 SCENARIO_RUN). Establishes the SCENARIO_RUN pattern for "what if" simulations while preserving all HR-1 / HR-2 / D-2 boundaries.

### What ships
```
lib/ai/tax-advisor/tools/
├── getCgtExposure.ts            # NEW (FACT_LOOKUP) wraps applyCapitalLossNetting
├── getDiv7aRisk.ts              # NEW (FACT_LOOKUP) wraps classifyDiv7ALoans
├── getInHouseAssetRatio.ts      # NEW (FACT_LOOKUP) wraps classifySmsfTriumvirate (Pt 8 portion)
└── runContributionScenario.ts   # NEW (SCENARIO_RUN) — first SCENARIO_RUN tool
```

### Registry now (7 tools)
| Domain | FACT_LOOKUP | SCENARIO_RUN |
|---|---|---|
| Super | `getContributionCapHeadroom` | `runContributionScenario` |
| CGT | `getCgtExposure` | — |
| Land tax | `getLandTaxPosition` | — |
| Stamp duty + entity tax | `getEntityTaxPosition` | — |
| Div 7A | `getDiv7aRisk` | — |
| SMSF | `getInHouseAssetRatio` | — |

### SCENARIO_RUN pattern (locked in this PR)
- Structurally identical to FACT_LOOKUP — same `ToolResult` shape
- Semantic difference: FACT_LOOKUP = current state; SCENARIO_RUN = hypothetical
- Returns BOTH baseline + scenario + delta numerical fields so AI narrates the change without computing it (HR-1 preserved — delta is computed in the tool, not by the AI)
- D-2 preserved: "if you contribute $5k more, your headroom becomes $3k" is a fact; "you should contribute $5k more" remains forbidden (no recommendation tool exists in registry)

### Tests (34 new — 595 total, +34)
- Registry size + kind discriminator (4)
- getCgtExposure (3) — net gain after netting + discount; cites Div 102-A/s100-50/s115; citationIds resolve
- getDiv7aRisk (3) — compliant loan; NO_AGREEMENT deemed dividend; zero-loan input
- getInHouseAssetRatio (3) — within 5% cap; exceed cap → BREACH with breach amount + percentage; cites Pt 8 SIS Act
- runContributionScenario (5) — baseline+scenario+delta; zero-hypothetical = zero-delta; cap-crossing surfaces excess tax delta; cites s291-20/s292-85/Div 291; citationIds resolve
- HR-1/HR-2/D-2 contract per tool (16) — 4 tools × 4 contract checks (stable path, well-formed citations, no banned words, description disclaim)

Updated existing 41h.0 registry test to expect `size = 7` + alphabetical with new tools.

tsc clean.

### Phase 41h is COMPLETE
All 6 sub-PRs shipped:
- 41h.0 — Tool registry foundation (3 FACT_LOOKUP)
- 41h.1 — AI Policy Gateway (5-status pipeline; HR-1/HR-2/D-2 enforcement)
- 41h.2 — Gemini provider adapter + production audit sink
- 41h.3 — Practice surface UI (admin demo)
- 41h.4 — Ask-a-Pro router + user-facing surface graduation
- 41h.5 — Tool registry expansion + SCENARIO_RUN (this PR)

**Three structural enforcement layers all live:**
1. Tool layer — closed `ToolKind` discriminant; no `RECOMMENDATION` kind
2. Schema layer — Zod `RawAIResponseSchema`; typed segments
3. Validator layer — runtime resolution against `ToolSession`; rejects fabricated numbers / citations / recommendation language

**Calc audit safety net** (Phase 41i) catches calc drift silently before users see wrong numbers (HR-3).

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.36
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.1 41h.5 SHIPPED row marked **CLOSES PHASE 41h**

### Next
Phase 41 core scope is complete. Future iterations:
- More SCENARIO_RUN tools (`runCgtScenario`, `runLandTaxScenario`, `runDiv7aRefinanceScenario`)
- Graduate advisor surface from `/dashboard/cfo/ask` to "My Guide" per TRAIL framework
- 41i.2-5 follow-ups (more audit engines, L3 on-demand, alerting, L2 anomaly detection)

---

## Session: claude/phase-41h4-ask-a-pro-router (Phase 41h.4 — Ask-a-Pro router + user-facing surface graduation SHIPPED)

### Strategy
Graduates the AI advisor from admin-demo to user-facing. The Tier 2 routing card now links to the existing Phase 32C marketplace, scoped to the right discipline based on the AI's `askAProRouting.profession`. Same gateway, same components — just the surface graduates.

### Profession → Discipline mapping (locked in)
| Profession | Marketplace `discipline` | Licensing |
|---|---|---|
| ADVISER | FINANCIAL_ADVISOR | AFSL — personal financial advice + product recommendations |
| ACCOUNTANT | TAX_AGENT | TPB — personal tax advice |
| BROKER | MORTGAGE_BROKER | NCCP — credit advice + product recommendations |

**Intentionally narrow** — reviewers reject any change that broadens it (e.g. routing AFSL questions to TPB-only agents).

### Files
- `lib/ai/tax-advisor/askAProRouting.ts` — `professionToDiscipline()` + `buildAskAProDeepLink()`
- `lib/ai/tax-advisor/runAdvisorQuery.ts` — shared gateway helper used by both admin + user-facing routes
- `app/api/ai-advisor/ask/route.ts` — user-facing endpoint (`report.read` permission via `withPermission`)
- `app/api/admin/ai-advisor/ask/route.ts` — refactored to delegate to `runAdvisorQuery`
- `app/dashboard/cfo/ask/page.tsx` — user-facing page using existing 41h.3 components
- `components/ai-advisor/TaxAdvisorAnswer.tsx` — `RouteToPro` now has clickable CTA + accepts `originalQuestion` prop

### Deep-link contract
`buildAskAProDeepLink({ profession, question?, reason? })` → `/marketplace?discipline=<mapped>&question=<encoded>&reason=<encoded>`. CDR data is NEVER placed in URL — sensitive snapshot context is opt-in inside the request submission form.

### Both routes coexist
- `/api/admin/ai-advisor/ask` — admin diagnostic; `audit:read`; `/admin/ai-advisor`
- `/api/ai-advisor/ask` — user-facing; `report.read`; `/dashboard/cfo/ask`

Both delegate to `runAdvisorQuery` — single source of truth for provider wiring + validation.

### Tests (17 new — 561 total, 544 → 561, +17)
- `professionToDiscipline` (3) — all three professions correctly mapped
- `buildAskAProDeepLink` (5) — base path; discipline param; question + reason encoding; omits when not supplied; URL-special chars round-trip
- `runAdvisorQuery` validation (4) — empty / whitespace / over-cap rejected; cap edge accepted
- `runAdvisorQuery` config (1) — `NOT_CONFIGURED` when `GEMINI_API_KEY` unset
- `RouteToPro` CTA wiring (4) — Tier 2 ADVISER href + copy; BLOCKED_RECOMMENDATION default to ADVISER; ACCOUNTANT → TAX_AGENT; BROKER → MORTGAGE_BROKER

tsc clean.

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.35
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.1 41h.4 SHIPPED row

### Next
**41h.5** — Tool registry expansion (`runScenario` SCENARIO_RUN tool + additional fact lookups: CGT exposure, Div 7A risk, in-house asset ratio, contribution-cap deltas). Closes Phase 41h.

---

## Session: claude/phase-41h3-practice-surface-ui (Phase 41h.3 — AI Advisor Practice surface UI SHIPPED)

### Strategy
Resumes Phase 41h after 41i's calc-audit safety net shipped. First user-shaped surface for the AI advisor: components that take the gateway's `GatewayResponse` and render it with citations next to numbers, AFSL/TPB/NCCP boundary footer, UNCOMPUTED flags surfaced explicitly, and Tier 2 → Ask-a-Pro routing card. Lives behind admin portal as the integration surface until 41h.4 (Ask-a-Pro routing) and 41h.5 (tool registry expansion) graduate it to user-facing dashboards.

### Architecture
```
components/ai-advisor/
├── TaxAdvisorAnswer.tsx           # Top-level renderer — branches per response.status
├── TaxAdvisorBoundaryFooter.tsx   # AFSL/TPB/NCCP footer with citations
├── TaxAdvisorUncomputedFlag.tsx   # Per-flag amber-accent renderer
├── TaxAdvisorAskForm.tsx          # Question textarea + example chips
└── index.ts                       # public surface

app/api/admin/ai-advisor/ask/route.ts  # POST — wraps gateway w/ GeminiProvider + ProductionAuditSink
app/admin/ai-advisor/page.tsx          # admin demo page (AdminFeatureGate)
```

### Status routing (5 outcomes)
| Gateway status | UI surface |
|---|---|
| `OK` + `TIER_1_FACTS` | Inline segments + UNCOMPUTED section + boundary footer + trace metadata |
| `OK` + `TIER_2_ROUTE_TO_PRO` | Routing card with profession-specific copy + reason + trace |
| `BLOCKED_RECOMMENDATION` | Auto-routes to default ADVISER Tier 2 card |
| `BLOCKED_VALIDATION` / `SCHEMA_INVALID` | Generic accuracy error (don't expose validator detail) + trace |
| `PROVIDER_ERROR` | "AI is temporarily unavailable" + trace |

### API route behaviour
- Admin-only (`audit:read` permission via `verifyAdminGCPAuth`)
- 503 `AI_ADVISOR_NOT_CONFIGURED` when `GEMINI_API_KEY` unset (clear message, never silent fail)
- Question length capped at 2,000 chars (defensive)
- Wraps gateway with `GeminiProvider` (real Gemini calls) + `ProductionAuditSink` (writes to existing AuditLog Prisma table; CDR-safe metadata only per CLAUDE.md §13.3; fire-and-forget per §12.10)

### Test infra change
Updated `vitest.config.ts`:
- `include: ['tests/**/*.test.{ts,tsx}']` (was just `.ts`) — unblocks future React component tests
- Coverage `include` adds `components/**/*.{ts,tsx}`

### Tests (12 new — 544 total)
- Boundary footer (2) — renders boundary statement verbatim; renders citations inline
- UNCOMPUTED flag (2) — with citation; without citation
- Status routing (5) — PROVIDER_ERROR + trace; BLOCKED_VALIDATION generic; SCHEMA_INVALID same; BLOCKED_RECOMMENDATION → ADVISER; OK + TIER_1 + segments + boundary
- Tier 2 routing (1) — TIER_2_ROUTE_TO_PRO renders profession-specific copy + reason
- UNCOMPUTED section (1) — flags render in dedicated section
- Trace metadata (1) — trace + duration + tokens always at bottom

Tests use `react-dom/server.renderToString` — no RTL setup needed.

### Smoke-test path
1. Set `GEMINI_API_KEY` in env
2. Navigate to `/admin/ai-advisor` (admin portal enabled)
3. Pick example question or type one
4. Real Gemini call → tool dispatch → validated answer with citations + boundary footer

If `GEMINI_API_KEY` unset, page loads but submission shows clear "not configured" error.

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.34
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.1 41h.3 SHIPPED row

### Next
**41h.4** — Ask-a-Pro router (detects recommendation-shaped questions; routes to marketplace per Phase 32C; graduates advisor to user-facing dashboards).

---

## Session: claude/phase-41i-fixture-contract-corrections (Phase 41i — Audit anomaly triage + JSDoc contract docs)

### Triage outcome
After Phase 41i shipped (PR #671), Reza asked whether the 5 anomalies the audit agent flagged during fixture authoring were real calc errors. Triaged each:

| # | Finding | Verdict |
|---|---|---|
| 1 | `expenseAggregator` frequency conversion | **Not a bug** — engine works with UPPERCASE `Frequency` enum (`'MONTHLY'`); my fixture used lowercase which falls through `toAnnual`'s default branch |
| 2 | `incomeAggregator` frequency + PAYG | **Not a bug** — UPPERCASE enum required + `paygWithholding` is a pre-converted annual figure (asymmetric with `amount`); fixture used wrong contract |
| 3 | `loanAggregator` frequency conversion | **Not a bug** — same UPPERCASE `RepaymentFrequency` enum requirement |
| 4 | `netWorth` MORTGAGE classification | **Not a bug** — engine recognises `'HOME'`/`'INVESTMENT'` (case-insensitive) per app-wide convention, verified in `intelligence/portfolioEngine.ts`, `health/types.ts`, `testing/types.ts`. `'MORTGAGE'` not used as a real loan type anywhere except my fixture |
| 5 | GST `G1` baseline = $12k | **Not a bug** — export GST-free correctly contributes to G1 per BAS rules; my fixture comment was wrong |

**Net: zero engine bugs. All 5 were fixture-authoring errors on my part.** But the audit system did exactly its job — surfaced the gap between my mental model and engine reality.

### Changes
- **Fixture contract corrections** (`lib/calc-audit/engines/core.ts`):
  - `core.netWorth`: replaced `type: 'MORTGAGE'` with `type: 'HOME'` (correct vocabulary). Added new fixture (`Loan with unrecognised type → personal loan`) as a **negative test** that locks in the current classifier behaviour for non-mortgage types.
  - `core.incomeAggregator`: switched to UPPERCASE `'WEEKLY'`/`'ANNUAL'` enum; set `salaryType: 'GROSS'` for SALARY entries; passed PAYG as pre-converted annual ($26k = $500 × 52). Now correctly asserts $109,200 gross / $26,000 PAYG / $104k SALARY breakdown.
  - `core.expenseAggregator`: switched to UPPERCASE `'MONTHLY'`. Now correctly asserts $36,000 annual ($24k housing + $12k food).
  - `core.loanAggregator`: switched to UPPERCASE `'MONTHLY'` + `type: 'HOME'`. Now correctly asserts $30,000/yr ($2,500 × 12).
- **Engine JSDoc contracts**:
  - `lib/calculations/incomeAggregator.ts` — `getGrossAmount` and `getPaygAmount` now document the UPPERCASE enum + PAYG-is-pre-converted-annual contracts
  - `lib/calculations/expenseAggregator.ts` — `aggregateExpenses` documents the UPPERCASE enum contract + warns about silent fall-through bug if violated
  - `lib/calculations/loanAggregator.ts` — `aggregateLoanRepayments` documents the UPPERCASE `RepaymentFrequency` enum
  - `lib/calculations/netWorthCalculator.ts` — `calculateTotalLiabilities` documents the loan-classifier vocabulary (`'HOME'`/`'INVESTMENT'`/`'CREDIT_CARD'`) + cross-references the parallel definitions in `intelligence/portfolioEngine.ts`, `health/types.ts`, `testing/types.ts`
- **18 fixtures → 19 fixtures** (added the negative-test for loan classifier)
- **532 total tests** (unchanged — fixture count grows but the "every fixture passes" test is still 1)
- tsc clean

### Why this matters
This is the second-order win from the calc audit system. By forcing fixtures to use real input contracts (and failing when they don't), the audit caught **5 places where my mental model differed from the engine**. Those gaps now live as JSDoc on the engine helpers, so the next engineer touching this code (human or AI) sees the contract requirement before they hit the same trap.

The audit system also ships a **negative-test fixture** that locks in current "fall-through" behaviour for the loan classifier — any future change to the classifier (tightening the matched types, adding new buckets) will now be caught by the audit.

### Tests
- 532 total (unchanged — but fixture count went from 18 to 19; per-fixture passes are aggregated into a single "every fixture passes" test)
- All audit fixtures green with proper contracts

### Next
**Phase 41h.3** (Practice surface UI for the AI advisor) resumes after this PR merges.

---

## Session: claude/phase-32c-pr4d-conversations (Phase 32C PR4d — In-app conversations + email-through-app SHIPPED)

### Changes Made
- **Type:** Feature (Demo-Complete Critical Path; closes Up Next #16; closes the relationship loop after PR4c)
- **Scope:** Two-way in-app conversation thread between consumer + professional, mirrored via SendGrid email; auto-created when an adviser accepts a marketplace request; 7yr compliance archive on every message.

### Files Created
- `prisma/migrations/20260507100000_add_conversations/migration.sql` — additive: 5 new `AuditAction` values + 2 new enums (`ConversationRole`, `MessageChannel`) + 3 tables (`professional_conversations` + `conversation_participants` + `conversation_messages`) + indexes + FKs.
- `lib/services/conversationService.ts` — canonical service (~530 lines). `createForAcceptedRequest`, `createOrgScopedConversation`, `assertParticipant`, `listMessages`, `getConversationDetails`, `listConversationsForUser`, `listConversationsForOrg`, `postMessage`, `softDeleteFromUserView`, `closeConversation`, `findConversationByReplyToSlug`, `buildReplyToAddress` re-export, typed-codes `ConversationServiceError`.
- `lib/email/conversationEmail.ts` — zero-dep SendGrid v3 outbound. Activated by `SENDGRID_API_KEY`; falls through to console-log + audit when unset. `buildReplyToAddress` helper. Footer carries reply-to + 7yr disclosure.
- `app/api/conversations/route.ts` — GET list user's conversations + POST ensure-or-create org-scoped conversation (caller-owns-link check).
- `app/api/conversations/[id]/route.ts` — GET detail + POST softDelete / close.
- `app/api/conversations/[id]/messages/route.ts` — GET poll (with `since` + `markAsRead`) + POST send.
- `app/api/conversations/inbound/route.ts` — SendGrid Inbound Parse webhook. Extracts conversation slug from `to` header, verifies sender-email matches consumer participant, posts as EMAIL_IN with channel bypass.
- `app/api/portal/conversations/route.ts` — adviser inbox list (org-scoped).
- `components/conversations/ConversationThread.tsx` — thread component (~300 lines). 5s poll loop, optimistic-add on send with rollback, scroll-to-bottom, ⌘/Ctrl+Enter to send, channel badges, prefers-reduced-motion-aware via Tailwind `motion-safe:*`, 7yr archive disclosure footer with viewer-role-aware copy.
- `app/portal/conversations/page.tsx` — adviser inbox list.
- `app/portal/conversations/[id]/page.tsx` — adviser thread page.
- `app/dashboard/conversations/page.tsx` — user-side list.
- `app/dashboard/conversations/[id]/page.tsx` — user thread page.

### Files Modified
- `prisma/schema.prisma` — `AuditAction` extended with 5 new values (CONVERSATION_CREATED / MESSAGE_SENT / EMAIL_OUTBOUND / EMAIL_INBOUND / SOFT_DELETED_FROM_USER); reverse relations on `User` (conversationParticipations + conversationMessages) + `OrganizationMember` (conversationParticipations) + `Organization` (conversations) + `ProfessionalRequest` (conversation 1-1); 3 new models + 2 new enums appended at end-of-file.
- `lib/services/index.ts` — re-exports the new conversation service surface.
- `lib/services/professionalRequestService.ts` — `acceptRequest` now calls `createForAcceptedRequest` AFTER the inner transaction commits (best-effort; failure doesn't roll back accept). `getRequestForOrg` + `listRequestsForUser` now include `conversation: { id }` so the request detail / tracker can deeplink.
- `app/portal/requests/[id]/page.tsx` — accepted-state card now shows "Open conversation →" alongside "Open client view →".
- `app/dashboard/requests/page.tsx` — accepted-state card surfaces "Open conversation →" deeplink + revised copy ("The conversation is open — keep chatting in-app or by email").
- `components/ask-a-pro/AskAProfessionalDialog.tsx` — `MemberCard` rewritten from placeholder `<Link href="/portal-message?memberId=...">` to `<button>` that calls `POST /api/conversations` ensure-or-create endpoint and routes to `/dashboard/conversations/<id>`. `OrgScopeView` now passes `orgClientId` + `orgName` down to MemberCard so the create call has the auth-gate inputs.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #16 marked SHIPPED with summary; new Recently Completed entry prepended for 2026-05-07.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 7 conversation thread demo path populated end-to-end.

### Architecture Decisions
- **Conversation auto-create runs AFTER the accept transaction commits**, not inside. `createForAcceptedRequest` has its own internal transaction; nesting would either error or compromise the consent invariant. Best-effort: a conversation-create failure does NOT roll back accept (the engagement is already in audit + ClientLink); ops can re-run idempotently.
- **`assertParticipant` is the single access-control gate.** Every read/write goes through it; cross-org leakage is structurally impossible because the API can't return a conversation without matching a `ConversationParticipant` row. Mirrors the pattern from PR4c's request access control.
- **Sender role FROZEN at send time.** `senderRole` on `ConversationMessage` is recorded as it was at send time, even if the person later leaves the org. Audit trail stays accurate.
- **Retention column on every message** (not just a global config). Per-tenant retention policy upgrade is a single column edit.
- **Outbound email is fire-and-forget.** The in-app message has already landed before the email send is attempted; SendGrid failures don't surface to the user. PROD wires retries.
- **`replyToSlug` is unguessable + per-conversation.** 32-char hex (16 random bytes). Inbound webhook routes by slug, not by conversation id, so a leaked id can't be used to inject inbound replies into another thread.
- **VIEWER seats excluded from participants.** They can't take inbound (per portal-permissions design); they shouldn't appear in the participant list either.
- **ZERO new dependencies.** SendGrid v3 via raw fetch (no `@sendgrid/mail` package), thread component uses Tailwind `motion-safe:*` utilities (no `framer-motion` import).

### Build Status
- [x] `npx tsc --noEmit` — clean, exit 0.
- [x] `npx next build` — green; all 9 conversation routes registered (`/api/conversations`, `/api/conversations/[id]`, `/api/conversations/[id]/messages`, `/api/conversations/inbound`, `/api/portal/conversations`, `/dashboard/conversations`, `/dashboard/conversations/[id]`, `/portal/conversations`, `/portal/conversations/[id]`).

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new `<ConversationThread />` reusable across both portal and dashboard surfaces; new conversation-list card pattern; channel-badge pattern)
- [x] application config (`SENDGRID_API_KEY` env var documented in conversationEmail.ts; `MONITRAX_INBOUND_FROM_ADDRESS` + `MONITRAX_INBOUND_DOMAIN` env vars introduced for reply-to construction)
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (7yr retention column + soft-delete-from-user-view + audit logging on every conversation event; `assertParticipant` centralised access control; PROD-deferred hardening list documented)
- [ ] operational procedure
- [x] strategic decision (conversation auto-create as best-effort post-transaction; sender role frozen; outbound mirror fire-and-forget)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #16` — marked SHIPPED with summary.
- `docs/IMPLEMENTATION_PLAN.md:Recently Completed 2026-05-07` — new entry prepended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md:Step 7` — conversation demo path populated end-to-end.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — additive migration only (CREATE TYPE / CREATE TABLE / ALTER TYPE ADD VALUE). No row mutations on existing tables. The `markAsRead` flow does call `prisma.conversationParticipant.update` — but only on rows the same flow created (the participant row guards by id and role; can't accidentally touch another participant's read state).

### Schema Migration Checklist (CLAUDE.md §12.12)
- [x] `prisma/schema.prisma` modified
- [x] Matching migration at `prisma/migrations/20260507100000_add_conversations/migration.sql`
- [x] Migration is purely additive (no `DROP`, no `ALTER ... DROP COLUMN`, no `TRUNCATE`)
- [x] `npx prisma validate` clean
- [x] `npx prisma generate` clean

### PR
- Branch: `claude/phase-32c-pr4d-conversations`
- Status: pending push + open


---

## Session: phase-42-pr1-foundation

### Changes Made
- **Type**: Feature — first sub-PR of the Phase 42 stream (XERO-complementary consumer bookkeeping)
- **Scope**: Schema foundation + service helpers + period API + per-mutation audit + minimal UI hook
- **Description**: Implements the foundational layer described in `PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` §4 PR1. Three new tables, one new enum, one new column on `unified_transactions`. All schema changes additive. Spec context: Reza directives 2026-05-08 (1) Monitrax does not replace Xero — produces personal tax-pack handoff TO Xero; (2) categorisation must engage emotionally, not feel like a chore. PR1 is the foundation; the engagement layer ships in PR6 with the Daily Pulse / streak / completion celebration.

### Files Modified / Added
- `prisma/schema.prisma` — added `BookkeepingPeriodStatus` enum + `CanonicalCategoryRegistry` / `BookkeepingPeriod` / `TransactionEdit` models; added `UnifiedTransaction.normalisedDescriptionHash` + secondary index `ut_dedup_qif_csv_ofx`. Three new back-relations on `User`. JSDoc comments throughout point at the spec doc + PR2-6 forward links.
- `prisma/migrations/20260510200000_phase_42_pr1_foundation/migration.sql` — additive migration. Operations: CREATE TYPE × 1, CREATE TABLE × 3, ALTER TABLE ADD COLUMN × 1 (nullable), UPDATE backfill, CREATE INDEX × 7. NO destructive ALTER, NO DROP. Backfill SQL mirrors the JS canonical hash function in `lib/bookkeeping/normaliseDescription.ts`.
- `lib/bookkeeping/normaliseDescription.ts` (NEW) — canonical description normaliser + md5 hash. Deterministic; mirrors the migration backfill SQL exactly.
- `lib/bookkeeping/categoryRegistry.ts` (NEW) — `resolveOrCreateCategory()` (race-tolerant lazy seed) + `backfillRegistryForUser()` (one-time bulk seed from existing strings on `unified_transactions` + `merchant_mappings`).
- `lib/bookkeeping/period.ts` (NEW) — 3-status state machine. `getOrCreatePeriod()` always refreshes `totalTransactionCount` + `reviewedTransactionCount` from canonical ledger state. `markPeriodReviewed()` / `lockPeriod()` / `unlockPeriod()` are idempotent. `isPeriodEditable()` is the LOCKED guard used by the PATCH route.
- `lib/bookkeeping/transactionEditAudit.ts` (NEW) — fire-and-forget audit helper. `pickCategoryFields()` + `pickLinkFields()` keep audit JSON snapshots tight. `deepEqual` short-circuit avoids no-op rows.
- `lib/auth/permissions.ts` — added `bookkeeping.read` (all roles) + `bookkeeping.write` (OWNER/ADMIN/CONTRIBUTOR).
- `app/api/bookkeeping/periods/[month]/route.ts` (NEW) — thin route handler. GET + POST with action enum. Strict YYYY-MM regex on the path param.
- `app/api/unified-transactions/[id]/route.ts` — wired `isPeriodEditable()` LOCKED guard (HTTP 423) + `recordTransactionEdit()` audit calls for CATEGORY / TAGS / LINK_ENTITY / RECURRING mutations.
- `components/bookkeeping/MonthlyReviewPill.tsx` (NEW) — minimal UI affordance on Activity header. Three visual states map to BookkeepingPeriodStatus. One-tap to mark reviewed; one-tap on LOCKED to unlock. Foundational hook for the PR6 Daily Pulse / streak surface.
- `app/dashboard/activity/page.tsx` — wired `<MonthlyReviewPill />` into the page hero header.
- `tests/bookkeeping/normaliseDescription.test.ts` (NEW) — 15 unit tests on hash determinism + jitter collapse + distinct-vendor preservation + DEDUP_SOURCES type-guard.
- `tests/bookkeeping/period.test.ts` (NEW) — 8 unit tests on period-key normalisation + month boundaries + round-trip formatting.
- `tests/bookkeeping/transactionEditAudit.test.ts` (NEW) — 4 unit tests on field-pick discipline + null/undefined coercion.
- `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` — PR1 row in §4 flipped from spec to ✅ SHIPPED with the full deliverable list + migration reference + queued items (PR1.1 unique-promotion).
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #42 updated with "PR1 of 6 SHIPPED, PR2 next session"; Recently Completed has a full 2026-05-07 entry.
- `docs/architecture/03_DATA_MODEL.md` — new §10.42 documenting the schema additions + service surface + tests + migration.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern (the pill is a one-off; no new design primitive)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (per-mutation audit trail = AFSL/TPB compliance + pairs with Phase 32B PR3 read-side audit)
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` §4 PR1 — flipped to ✅ SHIPPED
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #42 updated; Recently Completed entry
- `docs/architecture/03_DATA_MODEL.md` §10.42 — schema documentation
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)

Operations in this PR that touch existing rows:
- `prisma/migrations/20260510200000_phase_42_pr1_foundation/migration.sql` — `UPDATE "unified_transactions" SET "normalisedDescriptionHash" = md5(...) WHERE "source" IN ('QIF', 'CSV', 'OFX') AND "normalisedDescriptionHash" IS NULL`

For that operation:
1. **`where` clause matches:** `unified_transactions` rows with `source IN ('QIF','CSV','OFX')` AND `normalisedDescriptionHash IS NULL`. The IS NULL clause makes the migration idempotent — re-running computes hashes only for rows still missing one.
2. **Columns overwritten / rows deleted:** `normalisedDescriptionHash` only — a column that did not exist before this migration. NO existing user data is overwritten. The column was added (nullable) in the previous statement of the same migration; the UPDATE backfills the only column it can possibly touch.
3. **Guard ensuring this only mutates rows I created:** the column is brand-new in this migration. Every value in it after the migration is computed by THIS migration's `md5(...)` expression — there is no pre-existing data to clobber.

User confirmation: NOT REQUIRED — the UPDATE writes to a column that was created in the same migration; no user-entered data is at risk; the `IS NULL` guard makes it idempotent.

Other destructive Prisma operations: NONE in this PR. The `unified-transactions/[id]` PATCH route already does an `update`; this PR adds an `isPeriodEditable()` guard *before* it (HTTP 423 on LOCKED periods) — strictly tightening the guard, never loosening.

### Build Status
- [x] `npx prisma generate` clean
- [x] `npx tsc --noEmit` clean (only pre-existing `stripe` module noise; not from this PR)
- [x] `npx vitest run tests/bookkeeping/` — 27/27 green
- [x] Manual schema review of the migration file

### PR
- Branch: `claude/phase-42-pr1-foundation`
- Status: pending push + open


---

## Session: phase-42-pr2-splits-bulk

### Changes Made
- **Type**: Feature — second sub-PR of the Phase 42 stream
- **Scope**: Per-line transaction splits + bulk re-categorise + QIF S/$ wire-up + categoriser SSOT bridge (PR1 carryover)
- **Description**: Implements the per-line split layer described in `PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` §4 PR2 + closes the PR1 SSOT loop. One new table, one new API surface (3 routes for splits + 1 bulk endpoint), one new UI component (BulkActionToolbar), one Activity-page row enhancement (checkbox + selection state). Honours the user's explicit constraints: no duplicate calculations (single SSOT for sum-validation in `lib/bookkeeping/splits.ts`); single source of truth for all data (every split's `categoryId` is a hard FK to the PR1 `CanonicalCategoryRegistry`); no fork of canonical engines (`getMasterFinancialSnapshot` etc. continue to read the parent transaction's `categoryLevel*` — splits are an additive layer, the dominant split's category is propagated up).

### Files Modified / Added
- `prisma/schema.prisma` — `TransactionSplit` model + back-relation on `UnifiedTransaction` + back-relation on `CanonicalCategoryRegistry`.
- `prisma/migrations/20260510210000_phase_42_pr2_splits/migration.sql` — additive migration. CREATE TABLE × 1, CREATE INDEX × 4, FK × 2. NO destructive ALTER, NO DROP, NO row UPDATE/DELETE.
- `lib/bookkeeping/splits.ts` (NEW) — canonical service for all split mutations. Single SSOT for the sum-validation rule (`assertSplitsBalance`). Race-tolerant `replaceSplits` (atomic delete-then-create inside a Prisma transaction); `clearSplits`; `listSplits`; `resolveOrCreateCategoryForSplit`; `SplitValidationError` discriminated by `code`. Cross-user FK abuse defence: every `categoryId` verified to belong to the calling user before write. Dominant-split category propagation keeps every existing canonical engine working unchanged.
- `lib/bank/types.ts` — `RawTransactionSplit` interface + `RawTransaction.splits?` field.
- `lib/bank/parsers/qif.ts` — propagates `QIFTransaction.splits` (already extracted by the parser) onto `RawTransaction.splits` so the import path can persist them.
- `app/api/unified-transactions/route.ts` — `handleBatchImport` body type accepts `splits?` per transaction; persists via `replaceSplits` with `source='IMPORT'`; per-row split validation failures surface as row-level errors but don't block the parent import.
- `app/api/unified-transactions/[id]/route.ts` — PATCH path now lazy-seeds `CanonicalCategoryRegistry` on every category write (PR1 SSOT-bridge carryover; closes the loop).
- `app/api/unified-transactions/[id]/splits/route.ts` (NEW) — GET / PUT / DELETE handlers. PUT replaces all splits with sum-validation; DELETE clears. LOCKED-period guard returns HTTP 423.
- `app/api/unified-transactions/bulk-categorise/route.ts` (NEW) — atomic bulk re-categorise. Max 200 per call. Rolls up per-merchant `MerchantMapping` learning + writes per-row `TransactionEdit` audit rows + LOCKED-period guard rejects the WHOLE batch.
- `components/bookkeeping/BulkActionToolbar.tsx` (NEW) — sticky-bottom toolbar with suggested-category chip strip + free-form custom-category input. Mobile-first; `prefers-reduced-motion`-friendly.
- `app/dashboard/activity/page.tsx` — `selectedIds` state + `toggleSelected` + `<BulkActionToolbar />` mount. `<TransactionRow />` gets a leading checkbox (rendered as a sibling element with `stopPropagation` so tapping the checkbox doesn't open the link dialog).
- `tests/bookkeeping/splits.test.ts` (NEW) — 10 tests on sum-validation: exact match, $0.01 tolerance, beyond-tolerance rejection, empty-array rejection, mixed-sign tolerance, single + many split cases, zero-amount parent, error-message content.
- `tests/bookkeeping/qifSplits.test.ts` (NEW) — 3 tests on real-QIF-fragment parsing: splits propagated, splits absent when not present in source, split sum equals parent amount.
- `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` — PR2 row in §4 flipped from spec to ✅ SHIPPED.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #42 updated with PR1+PR2 SHIPPED + PR3 next; Recently Completed entry added.
- `docs/architecture/03_DATA_MODEL.md` — new §10.43 documenting the schema additions + service surface + tests + migration.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (audit-trail extends to SPLIT mutations; per-row TransactionEdit on bulk path)
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` §4 PR2 — flipped to ✅ SHIPPED
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #42 status; Recently Completed entry
- `docs/architecture/03_DATA_MODEL.md` §10.43 — schema documentation
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)

Operations in this PR that touch existing rows:
- `lib/bookkeeping/splits.ts:replaceSplits` — `prisma.unifiedTransaction.update` propagates the dominant split's category up to the parent (`categoryLevel*` fields).

For that operation:
1. **`where` clause matches:** the parent transaction already verified by `findUnique({ where: { id } })` + `userId` ownership check at the top of `replaceSplits`. One row.
2. **Columns overwritten / rows deleted:** `categoryLevel1`, `categoryLevel2`, `subcategory`, `userCorrectedCategory`, `confidenceScore` on the parent. The dominant-split-propagation rule is the contract — replacing splits IS an explicit user action that intends to update the parent's category to reflect the new dominant split.
3. **Guard ensuring this only mutates rows I created:** ownership-checked at the top of `replaceSplits`; the FK from `transaction_splits.transactionId` to `unified_transactions.id` is the structural guard that the call refers to a real, owned transaction.

User confirmation: NOT REQUIRED — this is the documented split-propagation contract per `PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` §3 D-42-2; ownership-checked; user-initiated.

Other destructive Prisma operations:
- `prisma.transactionSplit.deleteMany({ where: { transactionId } })` inside `replaceSplits` — the canonical "replace" semantics. Bounded to a single transaction id; ownership-checked above. The `before` snapshot is captured for `TransactionEdit` audit before the delete.
- `prisma.unifiedTransaction.updateMany` inside the bulk-categorise endpoint — `where: { id: { in: ids }, userId: auth.userId }`. Ownership double-checked: every id pre-verified to belong to `auth.userId` before the update; the `where` clause re-asserts ownership defensively.

### Build Status
- [x] `npx prisma generate` clean
- [x] `npx tsc --noEmit` clean (only pre-existing `stripe` module noise; not from this PR)
- [x] `npx vitest run tests/bookkeeping/` — 40/40 green (27 from PR1 + 13 from PR2)

### PR
- Branch: `claude/phase-42-pr2-splits-bulk`
- Status: pending push + open


---

## Session: phase-42-pr3-receipts-cash

### Changes Made
- **Type**: Feature — third sub-PR of the Phase 42 stream
- **Scope**: Receipt → transaction matching extends DME analyze/confirm; new `TransactionSource.RECEIPT` enum value; new `AccountType.CASH` with idempotent auto-creation; cash quick-add API + FAB component; PWA camera-capture affordance.
- **Description**: Implements `PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` §4 PR3. Single SSOT for the threshold rules in `lib/bookkeeping/receiptMatcher.ts` (D-42-7 signed-off): 3-day window, $0.50 abs / 0.5% rel amount tolerance, Levenshtein vendor similarity, 50/35/15 composite weighting with strong-signal override. AUTO_LINK / PICK_FROM / NO_MATCH verdict drives the analyze/confirm flow. NO_MATCH synthesises a RECEIPT-sourced UnifiedTransaction on the user's Cash account so receipts ALWAYS land in the canonical ledger. Cash quick-add ships as the 3-second sole-trader path.

### Files Modified / Added
- `prisma/schema.prisma` — `TransactionSource.RECEIPT` + `AccountType.CASH` + `UnifiedTransaction.matchedDocumentId` (nullable). JSDoc throughout points at the spec doc + PR sequencing.
- `prisma/migrations/20260510220000_phase_42_pr3_receipts_cash/migration.sql` — additive only. ALTER TYPE × 2 (`ADD VALUE IF NOT EXISTS`), ALTER TABLE ADD COLUMN × 1 (nullable). NO destructive ALTER, NO DROP, NO row UPDATE/DELETE.
- `lib/types/prisma-enums.ts` — `AccountType` extended with `CASH`; `LIQUID_ACCOUNT_TYPES` includes `CASH` (cash is liquid for emergency-fund + net-worth purposes).
- `lib/bookkeeping/receiptMatcher.ts` (NEW) — single SSOT for threshold rules. Pure helpers (`daysBetween`, `scoreDate`, `scoreAmount`, `levenshtein`, `vendorSimilarity`, `compositeScore`, `scoreCandidate`) + DB-touching `findReceiptMatches`. Defends against double-linking (skips RECEIPT-sourced rows + rows already with matchedDocumentId).
- `lib/bookkeeping/cashAccount.ts` (NEW) — idempotent `getOrCreateCashAccount(userId)`. Three-case resolution: existing CASH-typed → use; existing "Cash"-named with another type → adopt by re-tagging (preserves balance + other user-set fields); otherwise → fresh CASH account with $0 opening balance + auto-resolved PERSONAL_NAME LegalEntity (Phase 41a).
- `app/api/unified-transactions/cash/route.ts` (NEW) — POST endpoint. 3-field body (amount + description + direction); optional date + category. LOCKED-period guard returns HTTP 423. SSOT bridge through `resolveOrCreateCategory`. Updates Cash account's `currentBalance` to reflect the new transaction. Audit row via `recordTransactionEdit`.
- `app/api/documents/analyze/confirm/route.ts` — extended CREATE_EXPENSE path with `applyReceiptMatch()` helper. AUTO_LINK updates the matched UnifiedTransaction's `expenseId` + `matchedDocumentId` and writes a `TransactionEdit` (editType=RECEIPT_LINK, source=AI). NO_MATCH synthesises a RECEIPT-sourced row on the user's Cash account. PICK_FROM returns candidates in `receiptMatch.candidates` for the future PR3.5 picker UI.
- `components/bookkeeping/CashQuickAddButton.tsx` (NEW) — emerald FAB bottom-right with modal. Auto-focused tabular-nums amount; in/out direction toggle; single-line description; advanced (date + category) behind a `+` toggle. 700ms ✓ tick celebration → auto-close. Inline `<input type="file" capture="environment" accept="image/*">` for PWA camera path on mobile.
- `app/dashboard/activity/page.tsx` — wired `<CashQuickAddButton />` so `onCreated` triggers `fetchTransactions` + `fetchSummary`.
- `tests/bookkeeping/receiptMatcher.test.ts` (NEW) — 32 unit tests on thresholds-as-pinned, daysBetween (UTC-day-boundary semantics), Levenshtein, vendorSimilarity normalisation, compositeScore weighting + strong-signal override, scoreCandidate integration.
- `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` — PR3 row in §4 flipped to ✅ SHIPPED with the full deliverable list + queued items (PR3.5).
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #42 updated to "PR1+PR2+PR3 of 6 SHIPPED, PR4 next"; new Recently Completed entry.
- `docs/architecture/03_DATA_MODEL.md` — new §10.44 documenting the schema additions + service surface + threshold rules + tests + migration.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture (audit-trail extended to RECEIPT_LINK mutations; AI-source attribution distinguishes auto-links from manual user links)
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` §4 PR3 → ✅ SHIPPED
- `docs/IMPLEMENTATION_PLAN.md` Up Next #42 status; Recently Completed entry
- `docs/architecture/03_DATA_MODEL.md` §10.44 — schema documentation
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)

Operations in this PR that touch existing rows:

1. `lib/bookkeeping/cashAccount.ts:getOrCreateCashAccount` — `prisma.account.update({ where: { id }, data: { type: 'CASH' } })` ON the adoption path (existing account named "Cash" with another type).
   - **`where` clause matches:** the row found by `findFirst({ where: { userId, name: 'Cash' } })` in the same function — single row, ownership-checked.
   - **Columns overwritten / rows deleted:** `type` only — flips e.g. `TRANSACTIONAL` → `CASH`. Balance, name, institution, balanceSource, basiq fields all preserved.
   - **Guard:** the function only enters this path when no `type='CASH'` row exists AND a row literally named "Cash" exists. The intent is unambiguous adoption; a user who manually creates an account named "Cash" wants this to be the cash account.

2. `app/api/documents/analyze/confirm/route.ts:applyReceiptMatch` — `prisma.unifiedTransaction.update({ where: { id }, data: { expenseId, matchedDocumentId } })` on the AUTO_LINK path.
   - **`where` clause matches:** the matched-transaction id from `findReceiptMatches`. The matcher's coarse-filter already restricts to `userId` (one user's transactions only) and skips already-linked rows (`matchedDocumentId: null`).
   - **Columns overwritten / rows deleted:** `expenseId` + `matchedDocumentId` only. The previous `expenseId` value is captured in the `TransactionEdit` `before` snapshot before the update.
   - **Guard:** matcher pre-flight + audit-row before-snapshot; AUTO_LINK threshold (≥0.95 composite, beats 2nd by ≥0.05) is the user's signed-off threshold for "this is the same purchase."

3. `app/api/unified-transactions/cash/route.ts` — `prisma.account.update({ where: { id }, data: { currentBalance: { increment }, balanceLastUpdatedAt } })` on the cash account.
   - **`where` clause matches:** the cash account id returned by `getOrCreateCashAccount(auth.userId)` — single row, freshly verified to belong to the calling user.
   - **Columns overwritten / rows deleted:** `currentBalance` (incremented by the signed transaction amount) + `balanceLastUpdatedAt`.
   - **Guard:** cash account is auto-created or adopted in the same request; the user explicitly initiated the cash-add via the FAB. The increment-by-amount semantic is the documented contract for cash logs.

User confirmation: NOT REQUIRED for any of the three. Each is user-initiated through a documented endpoint; ownership-checked; audit-trailed where data identity (rather than system-managed counters) is at stake.

### Build Status
- [x] `npx prisma generate` clean
- [x] `npx tsc --noEmit` clean (only pre-existing `stripe` module noise)
- [x] `npx vitest run tests/bookkeeping/` — 72/72 green (PR1 27 + PR2 13 + PR3 32)

### PR
- Branch: `claude/phase-42-pr3-receipts-cash`
- Status: pending push + open


---

## Session: phase-42-pr4-qif-parity

### Changes Made
- **Type**: Feature — fourth sub-PR of the Phase 42 stream
- **Scope**: QIF parity layer — MCC catalog + L-field seed + bank-statement sanity-check + re-import dry-run preview
- **Description**: Closes the gap between QIF/CSV/OFX imports and BASIQ-grade categorisation accuracy. ~50 hard-coded AU merchants get MCC codes at import time; QIF `L` field becomes a +0.15 confidence seed; the source file's stated balances feed a sanity-check banner; a new `dryRun: true` flag returns the dedup verdict without committing. No schema changes — all deliverables are application-layer.

### Files Modified / Added
- `lib/bank/mccCatalog.ts` (NEW) — single SSOT for merchant → MCC. 47 entries across 14 category bands. Pure functions: `lookupMCC` (substring match, first-wins), `getMccEntry` (key-direct lookup), `normaliseMerchantForMcc`. Exposes `MCC_CATALOG_READONLY` for admin/inspector tooling.
- `lib/bank/types.ts` — `NormalisedTransaction` gains `merchantCategoryCode?` + `bankSuppliedCategory?`. `RawTransaction` gains `bankSuppliedCategory?`.
- `lib/bank/parsers/qif.ts` — QIF parser propagates `tx.category` (`L` field) onto `RawTransaction.bankSuppliedCategory`.
- `lib/bank/normalisation.ts` — `normaliseTransaction` calls `lookupMCC(merchantStandardised)` and stamps `merchantCategoryCode` + propagates `bankSuppliedCategory`.
- `lib/bank/categorisation.ts` — `categoriseTransaction` checks `bankSuppliedCategory` AFTER rules but BEFORE the uncategorised fallback. New `mapBankSuppliedCategory()` helper translates ~15 common bank-side category strings to Monitrax canonical labels at confidence 0.75. QIF `[Account]` brackets route to Transfer / Internal.
- `lib/bookkeeping/importSanity.ts` (NEW) — `computeBalanceSanityCheck()` (opening + sum vs closing within $0.50 tolerance) + `computeDedupPreview()` (composes PR1's `computeDescriptionHash`; account-scoped; BASIQ rows excluded; sample-cap-at-5).
- `app/api/unified-transactions/route.ts` — POST body accepts `openingBalance? + closingBalance? + dryRun? + source?`. `handleBatchImport` accumulates `importedSignedSum` across rows + calls `computeBalanceSanityCheck` at the end + surfaces `data.sanity` in the response. New `buildDryRunPreview()` helper runs the dedup-preview + sanity-check WITHOUT writing rows. MCC catalog applied at write time + propagated to `merchantCategoryCode` on the `prisma.unifiedTransaction.create` call. Source pluggable from request body.
- `components/bookkeeping/ImportSanityBanner.tsx` (NEW) — amber dismissable banner consuming the `data.sanity` shape.
- `tests/bookkeeping/mccCatalog.test.ts` (NEW) — 23 tests on catalog hygiene + 11 high-volume merchants pinned + Uber-vs-UberEats disambiguation.
- `tests/bookkeeping/importSanity.test.ts` (NEW) — 17 tests on sanity-check boundary cases + dedup-preview account scoping + BASIQ exclusion + sample-cap-at-5.
- `tests/bookkeeping/qifLFieldSeed.test.ts` (NEW) — 8 tests on seed routing + rule-engine-wins precedence + transfer-bracket handling.
- `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` — PR4 row in §4 flipped to ✅ SHIPPED with full deliverable list.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #42 updated to "PR1+PR2+PR3+PR4 of 6 SHIPPED, PR5 next"; new Recently Completed entry.
- `docs/architecture/03_DATA_MODEL.md` — new §10.45 documenting the type extensions + service surface + categorisation precedence + tests.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

(Pure application-layer feature work; no schema, no infra, no compliance posture changes.)

Docs updated in this PR:
- `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` §4 PR4 → ✅ SHIPPED
- `docs/IMPLEMENTATION_PLAN.md` Up Next #42 status; Recently Completed entry
- `docs/architecture/03_DATA_MODEL.md` §10.45 — type-extension + service-surface documentation
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)

NONE. PR4 introduces no Prisma `update` / `upsert` / `delete` / `updateMany` / `deleteMany` operations beyond what already existed in `handleBatchImport` (the `prisma.unifiedTransaction.create` call is bare insert). The MCC catalog is read-only; the L-field seed is a categoriser-pass-through; the sanity-check + dedup preview are pure data-in / data-out helpers.

### Build Status
- [x] `npx prisma generate` clean
- [x] `npx tsc --noEmit` clean (only pre-existing `stripe` module noise)
- [x] `npx vitest run tests/bookkeeping/` — 120/120 green (PR1 27 + PR2 13 + PR3 32 + PR4 48)

### PR
- Branch: `claude/phase-42-pr4-qif-parity`
- Status: pending push + open


---

## Session: phase-42-pr5-vendor-tax-pack

### Changes Made
- **Type**: Feature — fifth sub-PR of the Phase 42 stream; the load-bearing handoff to Xero
- **Scope**: Vendor model + TaxCategoryMapping registry + Tax Pack export (CSV + XLSX + JSON)
- **Description**: Closes the consumer ↔ accountant handoff loop. The accountant downloads `monitrax-xero-import-<fy>.csv` from `/api/bookkeeping/tax-pack/export?format=csv` and imports it directly into Xero's Bank Statement Import. Per-property P&L workbook ships as XLSX (one sheet per property + Summary + ATO Labels). Structured JSON for programmatic consumers. PDF + ZIP receipt-bundle deferred to PR5.5 (need new deps).

### Files Modified / Added
- `prisma/schema.prisma` — `Vendor` model (consumer-side card; NOT AP master) + `TaxCategoryMapping` model (system-seeded ATO label bridge); back-relations on `User` + `CanonicalCategoryRegistry`.
- `prisma/migrations/20260511200000_phase_42_pr5_vendor_tax_pack/migration.sql` — additive only (CREATE TABLE × 2 + indexes + FKs; §12.11 N/A).
- `lib/bookkeeping/vendor.ts` (NEW) — service helpers + 16-entry CANCEL_URL_REGISTRY for high-volume AU subscriptions.
- `lib/bookkeeping/taxCategoryMapping.ts` (NEW) — 50+ system seed entries + idempotent `seedSystemMappings`.
- `lib/bookkeeping/taxPack/summary.ts` (NEW) — canonical aggregator with FY-window resolution + per-property P&L blocks + ATO label totals + data-source disclosure.
- `lib/bookkeeping/taxPack/csvExporter.ts` (NEW) — Xero bank-statement-import CSV format pinned (header order, DD/MM/YYYY, signed amount, RFC 4180 escaping).
- `lib/bookkeeping/taxPack/xlsxExporter.ts` (NEW) — per-property P&L workbook using existing `xlsx` dep (Phase 16); sheet-name sanitisation against Excel's banned characters + 31-char limit.
- `app/api/bookkeeping/vendors/route.ts` (NEW) — list endpoint.
- `app/api/bookkeeping/vendors/[id]/route.ts` (NEW) — vendor card with annual totals + related properties + linked contract + cancel URL.
- `app/api/bookkeeping/tax-pack/export/route.ts` (NEW) — load-bearing handoff endpoint. CSV / XLSX / JSON formats. `Content-Disposition` headers for download UX; `X-Monitrax-FY` + `X-Monitrax-Tx-Count` headers for programmatic consumers.
- `tests/bookkeeping/xeroCsvExporter.test.ts` (NEW) — 22 tests on Xero CSV format contract.
- `tests/bookkeeping/taxPackSummary.test.ts` (NEW) — 9 tests on FY-window math + sheet-name sanitisation.
- `tests/bookkeeping/vendor.test.ts` (NEW) — 8 tests on name normalisation + cancel-URL registry hygiene.
- `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` — PR5 row in §4 flipped to ✅ SHIPPED.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #42 updated to "5 of 6 SHIPPED, PR6 (Engagement Layer) next"; new Recently Completed entry.
- `docs/architecture/03_DATA_MODEL.md` — new §10.46 documenting schema + service surface + Xero CSV contract.
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

(Pure application-layer feature work + additive schema.)

Docs updated:
- `docs/blueprint/PHASE_42_CONSUMER_BOOKKEEPING_COMPLETION.md` §4 PR5 → ✅ SHIPPED
- `docs/IMPLEMENTATION_PLAN.md` Up Next #42 status; Recently Completed entry
- `docs/architecture/03_DATA_MODEL.md` §10.46 — schema + service surface + Xero CSV contract
- `docs/changelog/CHANGELOG_2026_05_07.md` — this entry

### Destructive write checklist (CLAUDE.md §12.11)

NONE. PR5 introduces no Prisma `update` / `upsert` / `delete` / `updateMany` / `deleteMany` operations. All writes are CREATEs:
- `seedSystemMappings` writes new `TaxCategoryMapping` rows; uses try/catch around `create` for race-tolerance (concurrent seeds collapse on the unique index)
- `resolveOrCreateVendor` writes new `Vendor` rows; same pattern

Both are idempotent on the unique index — re-running is safe. No existing rows touched.

### Build Status
- [x] `npx prisma generate` clean
- [x] `npx tsc --noEmit` clean (only pre-existing `stripe` module noise)
- [x] `npx vitest run tests/bookkeeping/` — 160/160 green (PR1 27 + PR2 13 + PR3 32 + PR4 48 + PR5 39)

### PR
- Branch: `claude/phase-42-pr5-vendor-tax-pack`
- Status: pending push + open
