# Changelog — 2026-05-07

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
