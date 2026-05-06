# Changelog — 2026-05-06

## Session: claude/phase-41h2-gemini-provider (Phase 41h.2 — Gemini provider adapter + production audit sink SHIPPED)

### Strategy lock-in (Reza brief 2026-05-06 part 2)
**HR-3 added to Phase 41 §1 operating principles** as the third hard rule: *"User-visible calc errors are unacceptable. The Calculation Audit System is a silent admin-side safety net — never a user-facing surface."* Errors flow detect → admin alert → admin investigates → if real bug, fix code + backfill via existing data-update flow → user contacted via existing support tooling. Reviewers reject any PR that adds a user-facing surface for calc-correctness warnings.

Phase 41i (Calculation Audit System) sub-PR sequence locked in §11.2 of Phase 41 doc. Cross-app scope — not just tax-engine. Three layers: L1 deterministic fixture differential (CI-gated, no AI), L2 anomaly detection agent (AI batch via Cloud Scheduler — deferred), L3 on-demand admin-portal "Audit this user" (AI grounded in tool calls — same HR-1/HR-2 discipline).

Sequencing: option 2 — pause Phase 41h after this PR, build 41i, then resume 41h.3+.

### Changes
- New `lib/ai/tax-advisor/providers/geminiProvider.ts` — `GeminiProvider` implements `AIProvider`:
  - `toolToFunctionDeclaration()` converts `TaxAdvisorTool` → Gemini `FunctionDeclaration` (OpenAPI subset)
  - Chat session with `systemInstruction` (Monitrax persona) + `tools` parameter + `responseMimeType: 'application/json'`
  - Multi-turn dispatch loop capped at MAX_TURNS=8: send → check `response.functionCalls()` → execute via `request.executeTool()` callback → send back as `functionResponse` parts → repeat until final JSON text
  - Token usage aggregated across all turns from `usageMetadata`
  - 30s default timeout per turn (`withTimeout` Promise.race guard)
  - Dependency-injection constructor — tests inject mock client, production reads `GEMINI_API_KEY` env
  - Throws typed `ProviderError` on API key missing / non-JSON response / MAX_TURNS exceeded / timeout
- New `lib/ai/tax-advisor/audit/productionAuditSink.ts` — `ProductionAuditSink` implements `AuditSink`:
  - Wires gateway `AuditEntry` → existing `createAuditLog()` pipeline (`lib/security/auditLog.ts` → Prisma `AuditLog` table)
  - Action: `AI_ADVISOR_INVOCATION`; entityType: `AI_ADVISOR`; entityId: traceId
  - Outcome→status mapping: `OK→SUCCESS` / `BLOCKED_VALIDATION→BLOCKED` / `BLOCKED_RECOMMENDATION→BLOCKED` / `PROVIDER_ERROR→FAILURE` / `SCHEMA_INVALID→FAILURE`
  - CDR-safe metadata only (CLAUDE.md §13.3) — no raw question / response text
  - Fire-and-forget per CLAUDE.md §12.10 — DB write failure logs to `console.error` and trace ID lets us reconstruct from Cloud Logging; never blocks response

### Tests (8 new)
- Tool schema conversion (1) — `toolToFunctionDeclaration` produces OpenAPI-shaped declaration with type/properties/required
- Constructor (2) — no API key throws ProviderError; injected client OK
- Single-turn invoke (2) — JSON response parsed correctly with token usage; non-JSON throws ProviderError
- Multi-turn function calling (3) — function call dispatched via `executeTool` callback then continues to final answer; token usage aggregated across turns; MAX_TURNS guard throws after 8 turns

### 513 total tests (505 → 513, +8). tsc clean.

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.32
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.1 41h.2 SHIPPED + new §1 invariant 11 (HR-3) + new §11.2 (Phase 41i sub-PR sequence)
- `docs/IMPLEMENTATION_PLAN.md` Recently Completed

41i.0 (Calculation Audit System foundation — cross-app) is next.

---

## Session: claude/phase-41h1-ai-policy-gateway (Phase 41h.1 — AI Policy Gateway SHIPPED)

### Strategy reframe (Reza brief 2026-05-06)
Reza proposed a **centralised AI engine** that defines rules and guidelines for Gemini, making Gemini Monitrax-centric (not generic). The reframe expands Phase 41h.1 from "just a validator" to a full **AI Policy Gateway** — the single entry point every Gemini call goes through, holding system prompt + tool registry binding + HR-1/HR-2/D-2 enforcement + audit logging + boundary footer assembly + provider abstraction.

This is the industry-standard pattern for regulated AI deployments (Anthropic constitutional AI wrapper, Azure AI Content Safety + grounding gateway, financial-firm LLM gateways). The gateway lets Gemini retain general-knowledge smarts for paraphrasing / education / structure while binding numbers + citations to Monitrax's calc engines.

### Three structural enforcement layers (now complete)
1. **Tool layer** (41h.0) — closed `ToolKind` discriminant; no `RECOMMENDATION` kind exists at the type level.
2. **Schema layer** (this PR) — Zod runtime shape validation. Every numeric/citation/UC reference must use the typed segment, not free text.
3. **Validator layer** (this PR) — Runtime resolution against the `ToolSession`. Fabricated paths/ids/flags rejected before reaching the user.

### Architecture (industry-standard layered pattern)
```
lib/ai/tax-advisor/
├── gateway.ts                  # createTaxAdvisorGateway() — public surface
├── policy/
│   ├── systemPrompt.ts         # Monitrax persona + HR-1/HR-2/D-2 in prose + tool catalogue
│   ├── responseSchema.ts       # Zod schema (4 segment types + tier discriminator)
│   └── validators.ts           # HR-1/HR-2/D-2 runtime post-processor (6 issue codes)
├── providers/
│   ├── types.ts                # AIProvider interface + ProviderError + invoke req/resp shapes
│   └── mockProvider.ts         # Deterministic provider for tests + dev
├── audit/
│   └── auditLogger.ts          # AuditEntry + AuditSink (CDR-safe, InMemorySink + ConsoleSink)
├── tools/                      # (existing — 3 canonical FACT_LOOKUP tools)
├── registry.ts                 # (existing — closed-set ToolKind discriminant)
├── types.ts                    # (existing — NumericField / IdentifiedCitation / ToolSession)
└── index.ts                    # bootstrap + public re-exports
```

### Public surface
```ts
import { createTaxAdvisorGateway, MockProvider, InMemoryAuditSink } from '@/lib/ai/tax-advisor';

const gateway = createTaxAdvisorGateway({
  provider: new MockProvider(), // or GeminiProvider in 41h.2
  auditSink: new InMemoryAuditSink(),
});

const r = await gateway.ask({
  userId: 'user-1',
  question: "What's my super contribution cap headroom?",
  fyLabel: 'FY24-25',
});

// r.status: 'OK' | 'BLOCKED_VALIDATION' | 'BLOCKED_RECOMMENDATION' | 'PROVIDER_ERROR' | 'SCHEMA_INVALID'
// r.answer: validated RawAIResponse (only when status === 'OK')
// r.citations: aggregated IdentifiedCitation[] across all tools called
// r.uncomputed: aggregated UncomputedFlag[]
// r.boundary: AFSL/TPB/NCCP boundary footer envelope
// r.validationIssues: ValidationIssue[] (when blocked)
// r.tokenUsage / r.durationMs / r.traceId: observability
```

### Pipeline (per call)
1. Trace ID + start clock
2. Build Monitrax system prompt (persona + tool catalogue from registry)
3. Empty `ToolSession`
4. Provider.invoke with `executeTool` callback that records every call into session
5. Zod shape validation (`responseSchema.ts`)
6. HR-1/HR-2/D-2 validation against session (`validators.ts`)
7. Assemble citations + UNCOMPUTED + AFSL boundary via existing `renderBoundaryFootnote`
8. Audit-write via injected `AuditSink` (CDR-safe — no raw question/response leakage)
9. Return typed `GatewayResponse`. Never throws.

### Validator catches (6 issue codes)
- `HR1_NUMBER_NOT_IN_SESSION` — NUMBER_REF whose path doesn't resolve in session
- `HR1_BARE_FINANCIAL_NUMBER_IN_TEXT` — `$30,000` / `27%` embedded in TEXT (must be NUMBER_REF)
- `HR2_CITATION_NOT_IN_SESSION` — CITATION_REF whose composite id doesn't resolve
- `D2_RECOMMENDATION_LEAK` — "you should" / "I recommend" / "transfer to" / "salary sacrifice more" in TIER_1
- `UC_FLAG_NOT_IN_SESSION` — UNCOMPUTED_NOTE flagId not in any tool result
- `TIER2_MISSING_ROUTING` — `tier === 'TIER_2_ROUTE_TO_PRO'` without `askAProRouting`

### CDR-safe audit
Per CLAUDE.md §13.3, the audit entry carries traceId / userId / provider / toolsInvoked / outcome / validationIssueCodes / durationMs / tokenUsage — but **NOT** the user's raw question or AI's response text. Trace ID retrieves full payload from the production-store-of-record (sealed, access-logged).

### Tests (33 new; 505 total, 472 → 505, +33; tsc clean)
- Zod schema (6) — well-formed Tier 1/Tier 2; rejects malformed NUMBER_REF / CITATION_REF / empty segments / unknown tier
- HR-1 validator (6) — real path passes; unknown tool rejected; fabricated path rejected; bare `$30,000` in TEXT rejected; bare `50%` in TEXT rejected; clean TEXT passes
- HR-2 validator (3) — real cit passes; fabricated cit-id rejected; cit for un-invoked tool rejected
- D-2 validator (3) — "you should" rejected in Tier 1; "I recommend" rejected; same language allowed in Tier 2
- UC + Tier 2 (2) — fabricated UC flag rejected; Tier 2 missing routing rejected
- System prompt (3) — embeds HR-1/HR-2/D-2; lists every tool; explicitly forbids recommending
- Gateway end-to-end (8) — OK / fabricated-number BLOCKED / fabricated-cit BLOCKED / "you should" BLOCKED_RECOMMENDATION / valid Tier 2 OK / SCHEMA_INVALID / PROVIDER_ERROR / unregistered-tool ProviderError
- Audit (2) — records all metadata; CDR-safe (no raw question/response leak)

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.31
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.1 row updated (41h.1 SHIPPED 2026-05-06)

41h.2 (Gemini provider adapter — implements `AIProvider` to translate gateway → Gemini SDK → gateway response) is next.

---

## Session: claude/phase-41h0-tool-registry-foundation (Phase 41h.0 — AI Tax Advisor tool registry foundation SHIPPED)

### Strategy lock-in (Reza brief 2026-05-05)
Two **hard rules** added as Phase 41 invariants alongside D-1 (full demo scope) and D-2 (structural AFSL boundary):
- **HR-1: Numbers come from the app, never the AI.** AI may not estimate / round / project / fabricate any monetary figure, percentage, ratio, or threshold. Numbers come from Phase 41e + Phase 20 calc engines.
- **HR-2: Claims come from AU law, never AI memory.** AI may not cite a section / ruling / threshold from training-data recall. Citations come from `AuthorityCitation[]` lifted from Phase 41e modules.

Enforced structurally at three layers:
1. **Tool layer** (this PR) — finite, code-reviewed registry. `ToolKind` discriminant is a closed set `'FACT_LOOKUP' | 'SCENARIO_RUN'`. **No `RECOMMENDATION` kind exists** — a recommendation tool cannot be added without changing the type system. Reviewers reject any PR that adds a kind here.
2. **Schema layer** (Phase 41h.1) — typed AI response objects: every numeric field references a `numericFields[].path`; every citation references a `citations[].id`.
3. **Validator layer** (Phase 41h.1) — post-processor rejects responses whose numbers / citations don't resolve back to the `ToolSession`.

### Changes
- New module `lib/ai/tax-advisor/`:
  - `types.ts` — `ToolKind`, `NumericField` (path / unit / label / citationIds), `IdentifiedCitation` extends `AuthorityCitation` with stable `id`, `ToolResult` (numericFields + citations + uncomputed + narrativeText + raw), `TaxAdvisorTool<TInput>` execute contract, `ToolInputSchema` (Gemini-compatible), `ToolSession` aggregator + 4 lookup helpers (`findNumericFieldInSession`, `findCitationInSession`, `collectSessionCitations`, `collectSessionUncomputed`)
  - `registry.ts` — singleton `ToolRegistry` (register / get / list / size) + `assertToolKind` runtime guard
  - `index.ts` — auto-bootstrap on import (idempotent)
  - `tools/getContributionCapHeadroom.ts` — wraps `capTracker.trackContributionCaps`; 10 numeric fields with citations s291-20, s291-20(3), s292-85, s292-85(2)
  - `tools/getLandTaxPosition.ts` — wraps `crossStateAggregator.calculateCrossStateLandTax`; grand totals + per-state breakdown with all 8 states' Land Tax Acts surfaced
  - `tools/getEntityTaxPosition.ts` — wraps `entityTaxRouter.calculateEntityTaxPosition`; assessableIncome / taxableIncome / netTax / paygWithheld / estimatedRefund + (when present) netCapitalGain / cgtDiscountAmount

### Tests (23 new; 472 total, 449 → 472, +23; tsc clean)
- Registry bootstrap (3 tools, alphabetical, duplicate-throws, undefined-for-unknown)
- HR-1/HR-2/D-2 structural enforcement (no RECOMMENDATION kind allowed; every numericField has stable path/unit/label/citationIds; every citationId resolves to actual citation; every citation has kind/reference/lastReviewed/id)
- Per-tool fact correctness (FY24-25 cap = $30k; cross-state aggregation; entity router PERSONAL_NAME path)
- Session lookup helpers (resolve real paths/ids; return undefined for fabricated paths/ids — the structural defence against HR-1/HR-2 violations)
- Tool description / tool name banned-word checks (no `recommend` / `estimate` / `guess` / `suggest`)

### Per going-forward commitment
- `docs/architecture/03_DATA_MODEL.md` new §10.30 (Phase 41h.0)
- `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` new §11.1 (Phase 41h sub-PR sequence + HR-1/HR-2 hard rules formalised)

41h.1 (response schema + validator that rejects fabricated numbers / citations at runtime) is next.

---

## Session: claude/phase-32c-pr4c-request-lifecycle (Phase 32C PR4c — ProfessionalRequest lifecycle SHIPPED)

### Changes Made
- **Type:** Feature (Demo-Complete Critical Path; closes Up Next #15; closes the marketplace loop end-to-end)
- **Scope:** D2C user → marketplace listing → compose question → submit → adviser inbox → ACCEPT (lead-fee billing intent recorded + ClientLink materialised) / DECLINE / WITHDRAW. The bridge between Phase 32C PR4a (marketplace listings) + PR4b (AskAProfessional picker) and the engagement consent flow.

### Files Created
- `prisma/migrations/20260506100000_add_professional_request_lifecycle/migration.sql` — additive: 5 new `AuditAction` values + 2 new enums (`RequestStatus`, `LeadFeeTier`) + `professional_requests` table + indexes + FKs (`users`.cascade, `professional_listings`.cascade, `organization_members`.SetNull).
- `lib/services/professionalRequestService.ts` — canonical service (~330 lines). `submitRequest` / `listRequestsForUser` / `listInboxForOrg` / `getRequestForOrg` / `acceptRequest` / `declineRequest` / `withdrawRequest`. Status-transition guards. `classifyNetWorthTier` helper. Typed-codes `ProfessionalRequestServiceError` for `NOT_FOUND` / `FORBIDDEN` / `INVALID_STATUS_TRANSITION` / `LISTING_NOT_AVAILABLE` / `ORG_USER_PUBLIC_BLOCKED` / `INCOMPLETE_INPUT` / `PAYLOAD_TOO_LARGE`. Submit-time lead-fee tier resolution from `getMasterFinancialSnapshot()` (failures fall through to EMERGING). 8KB snapshot-context size cap.
- `app/api/professional-requests/route.ts` — D2C list (GET) + submit (POST). `withPermission('report.read')`.
- `app/api/professional-requests/[id]/route.ts` — D2C withdraw (POST). `withPermission('report.read')`.
- `app/api/portal/professional-requests/route.ts` — adviser inbox list (GET). `withPermission('org.read')` + active-membership check. Status-filterable.
- `app/api/portal/professional-requests/[id]/route.ts` — adviser detail (GET) + accept/decline (POST). OWNER/ADMIN/ADVISOR can respond; VIEWER read-only. Action body: `{ action: 'accept' | 'decline', declineReason?, organizationId }`.
- `components/ask-a-pro/ComposeRequestDialog.tsx` — modal with context-aware AI starter prompts (10 contexts × 1-3 starters each), 20-char min question, opt-in "Share my headline metrics" checkbox, sticky header with title + discipline label, body-scroll lock, Esc to close, prefers-reduced-motion-aware via Tailwind `motion-safe:*`. Submit handler hits `/api/professional-requests` POST; on success, navigates to `/dashboard/requests?just=<id>`.
- `app/marketplace/[slug]/ConnectCta.tsx` — client component for the listing-detail Connect CTA. Opens ComposeRequestDialog. Auth-gate fallback: API 401 → dialog falls through to "Create a free Monitrax account" nudge; org-attached user → `ORG_USER_PUBLIC_BLOCKED` 403 → friendly leaky-funnel guardrail message.
- `app/portal/requests/page.tsx` — adviser inbox. Defaults to SUBMITTED filter with badge count. Status-filter pills (Awaiting / Accepted / Declined / Withdrawn / All). Request cards with requester avatar + question preview + lead-fee tier + amount + context label. Click → drill-in.
- `app/portal/requests/[id]/page.tsx` — adviser detail. Question + requester profile (Monitrax member-since date + shared-metrics indicator) + lead-fee panel + accept/decline action bar. Decline requires ≥5-char reason. Accepted requests surface "Open client view" deeplink to existing Phase 32B drill-in. Read-only for VIEWER.
- `app/dashboard/requests/page.tsx` — user-side tracker. Lists submissions with status pills, decline reason inline if rejected, withdraw action for SUBMITTED, `?just=<id>` highlight after submit.

### Files Modified
- `prisma/schema.prisma` — `AuditAction` enum extended with 5 new values (PROFESSIONAL_REQUEST_SUBMITTED/ACCEPTED/DECLINED/WITHDRAWN/EXPIRED); `User` gained `professionalRequests ProfessionalRequest[]`; `ProfessionalListing` gained `requests ProfessionalRequest[]`; `OrganizationMember` gained `respondedRequests ProfessionalRequest[]`; new `ProfessionalRequest` model + `RequestStatus` + `LeadFeeTier` enums appended at end-of-file.
- `lib/services/index.ts` — re-exports the new request-lifecycle service surface (`submitRequest`, `listRequestsForUser`, `listInboxForOrg`, `getRequestForOrg`, `acceptRequest`, `declineRequest`, `withdrawRequest`, `classifyNetWorthTier`, `ProfessionalRequestServiceError`, types).
- `components/ask-a-pro/AskAProfessionalDialog.tsx` — public-scope listing click now opens `ComposeRequestDialog` instead of bare-navigating to `/marketplace/[slug]`. Picker stays open underneath; on submit, navigates to `/dashboard/requests?just=<id>`. PublicScopeView listing card converted from `<Link>` to `<button onPickListing>`. CTA copy updated from "View →" to "Send a question →".
- `components/ask-a-pro/index.ts` — barrel updated to export `ComposeRequestDialog`.
- `app/marketplace/[slug]/page.tsx` — Connect CTA replaced from inline `<Link>` (signup placeholder) with new `<ConnectCta />` client component.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #15 marked SHIPPED with full summary; new Recently Completed entry prepended for 2026-05-06.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md` — Step 6c updated: end-to-end demo now runs without verbal bridges (compose dialog ships in this PR).

### Architecture Decisions
- **Lead-fee charge as billing intent, not actual charge.** PR4c records `leadFeeChargedAt` at accept-time. PR6 (Stripe test-mode billing) reads this column and creates the actual Stripe Invoice. CLAUDE.md §0 architect lens: keep the data model honest with payment plumbing as a separate gate. Lets PR4c ship without Stripe wired and lets PR6 ship without re-touching the request lifecycle.
- **Lead-fee tier frozen at submit-time.** The listing's per-tier rate (`leadFeeTierEmerging` / `leadFeeTierGrowing` / `leadFeeTierEstablished`) is read at submit and the resolved amount stored on the request. Downstream tier-rate edits on the listing don't retroactively change in-flight requests. Snapshot failures (brand-new user with no data) fall through to EMERGING — keeps submit unblockable; the adviser sees the actual data on accept anyway.
- **Accept transaction.** Lifecycle transition + `OrganizationClient.upsert` (status=INVITED, consentStatus=PENDING) run in a single `prisma.$transaction` so a half-applied state is impossible. The user is invited through the existing consent flow — the engagement only fully starts once they grant consent. This keeps the consent invariant.
- **Idempotent submit.** Duplicate submit on the same listing returns the existing SUBMITTED request rather than creating a second one. Prevents accidental double-submits from impatient users / unreliable networks.
- **Snapshot-context size cap.** `snapshotContextJson` capped at 8KB at the service boundary. Prevents bloat from arbitrary user-pasted JSON; oversized requests rejected with `PAYLOAD_TOO_LARGE`. At v1 the user opts in to a single `{ shareMetrics: true }` flag; richer per-metric toggles defer to a follow-up.
- **Leaky-funnel guardrail at the service boundary.** Org-attached users (any active+granted OrganizationClient) cannot submit public marketplace requests via this surface — service rejects with `ORG_USER_PUBLIC_BLOCKED`. Mirrors the strategic decision in IMPLEMENTATION_PLAN.md Up Next #15 (2026-05-04): orgs pay for Monitrax to be their CRM + comms channel; the platform must not redirect their clients to competitors.
- **Org-attached path uses the existing connection.** Org-attached users (already have a ClientLink) continue to use the placeholder `/portal-message?memberId=<id>` (PR4d wires the in-app conversation thread). PR4c does NOT introduce a parallel request flow for org-attached users — they go through messaging, not picking a new professional.
- **ZERO new dependencies.** Reused existing patterns; the dialog uses Tailwind `motion-safe:*` utilities instead of pulling framer-motion just for two animations.

### Build Status
- [x] `npx tsc --noEmit` — clean, exit 0.
- [x] `npx next build` — green; all 7 new routes registered (`/api/professional-requests`, `/api/professional-requests/[id]`, `/api/portal/professional-requests`, `/api/portal/professional-requests/[id]`, `/dashboard/requests`, `/portal/requests`, `/portal/requests/[id]`).

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern (new `<ComposeRequestDialog />` + adviser inbox card pattern + user-side request tracker)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [x] strategic decision (lead-fee charge modelled as billing intent at accept; tier frozen at submit; idempotent submit; 8KB snapshot-context cap)

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md:Up Next #15` — marked SHIPPED with summary.
- `docs/IMPLEMENTATION_PLAN.md:Recently Completed 2026-05-06` — new entry prepended.
- `docs/pitch/LIGHTHOUSE_ADVISER_PITCH.md:Step 6c` — end-to-end demo path now runs without verbal bridges.
- `docs/changelog/CHANGELOG_2026_05_06.md` — this entry.

### Destructive Write Checklist (CLAUDE.md §12.11)
N/A — migration is purely additive (CREATE TYPE / CREATE TABLE / ALTER TYPE ADD VALUE). No `update`, `upsert`, `delete`, `updateMany`, `deleteMany`, or raw SQL `UPDATE`/`DELETE` on existing rows.

The accept flow does call `prisma.organizationClient.upsert()` — but it's the §12.11 SAFE upsert pattern: the `update` branch is a no-op (`update: {}`), so existing OrganizationClient rows are never mutated by this code path. New rows are created with `status: INVITED, consentStatus: PENDING` (the consent invite path); existing rows are left untouched.

### Schema Migration Checklist (CLAUDE.md §12.12)
- [x] `prisma/schema.prisma` modified
- [x] Matching migration at `prisma/migrations/20260506100000_add_professional_request_lifecycle/migration.sql`
- [x] Migration is purely additive
- [x] `npx prisma validate` clean
- [x] `npx prisma generate` clean

### PR
- Branch: `claude/phase-32c-pr4c-request-lifecycle`
- Status: pending push + open
