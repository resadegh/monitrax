# Changelog — 2026-05-10

## Session: claude/phase-33g2-live-ai-feedback-Q6tyx (Phase 33g.2 — Live AI feedback chat SHIPPED)

### Changes Made
- **Type:** Feature (closes Up Next #39)
- **Scope:** Consumer-side floating feedback button + chat-style drawer + Anthropic Claude (Haiku 4.5) live-AI triage gated on env-var presence
- **Description:** Reza directive 2026-05-10 — *"continue"* (resuming after the cost-control PR landed). Approach approved earlier: ship the consumer surface NOW with AI gated on `ANTHROPIC_API_KEY` env presence, so the UI lands visible during the next pitch even before Reza completes the Anthropic console signup + budget cap. Same drawer UI in both modes; only the success message + AI typing indicator differ.

### Files Created
- `lib/ai/anthropic.ts` — first Anthropic SDK client in the codebase. Singleton init + `isAnthropicConfigured()` gate + `generateAnthropicCompletion()` + cost-tracking metadata in result shape (`tokensIn/tokensOut/model`). Defaults to `claude-haiku-4-5`; `claude-opus-4-7` reserved for synthesis-only (never per-message replies).
- `app/api/portal/feedback/ai-status/route.ts` — `GET` endpoint returning `{ aiEnabled: boolean }`. Drawer uses this on mount to decide chat-vs-form mode.
- `components/help/FeedbackButton.tsx` — floating top-right affordance, 36px circle, `MessageSquarePlus` glyph, slightly LEFT of `<HelpDrawerButton />`. Same warm-ivory glass aesthetic as Phase 33b drawer button.
- `components/help/FeedbackChatDrawer.tsx` — chat-style slide-in/bottom-sheet drawer. Pre-thread metadata pickers (subject + tag + severity); message bubbles colour-coded by author (user = slate-900 right-aligned; AI = emerald-tinted with Sparkles icon; Monitrax-admin = white left-aligned); composer with ⌘/Ctrl+Enter shortcut; viewport-aware placement; `prefers-reduced-motion`-aware; body-scroll lock for iOS Safari. AI typing indicator only renders when `aiEnabled === true`. Polling: after submit, polls `/api/portal/feedback/[id]` up to 6× over 12s for AI reply (background fire-and-forget on the server).
- `prisma/migrations/20260510120000_add_feedback_ai_role/migration.sql` — additive `ALTER TYPE ADD VALUE IF NOT EXISTS` for `FeedbackAuthorRole.CONSUMER`, `FeedbackAuthorRole.CLAUDE_AI`, `AuditAction.FEEDBACK_AI_REPLIED`. Idempotent + safe to retry. No tables created, no rows touched (CLAUDE.md §12.11 not required).
- `docs/changelog/CHANGELOG_2026_05_10.md` — this session block.

### Files Modified
- `prisma/schema.prisma` — extended `FeedbackAuthorRole` enum with `CONSUMER` + `CLAUDE_AI` values; extended `AuditAction` with `FEEDBACK_AI_REPLIED`.
- `package.json` — added `@anthropic-ai/sdk@^0.30.1` dependency (alphabetical position at top of deps).
- `lib/services/feedbackService.ts`:
  - `CreateThreadInput.authorRole` (optional, defaults to `'ADVISER'` for backward compat).
  - `ReplyInput.authorRole` widened to `'ADVISER' | 'CONSUMER' | 'MONITRAX_ADMIN' | 'CLAUDE_AI'`; ownership check broadened from "ADVISER === own" to "any human === own".
  - Added `isFeedbackAiEnabled()` — server-side gate keyed off Anthropic SDK readiness.
  - Added `respondToFeedbackThread(threadId)` — fire-and-forget AI reply. Hard guards: bails on absent key / Reza-handled status / consecutive AI replies / >6 AI turns. System prompt enforces AFSL boundary (general info only; redirects financial questions to `/dashboard/cfo` AI Guide; never personal product advice). CDR boundary: AI ONLY sees thread messages — never user snapshot or CDR data.
  - Audit posture: AI replies write `FEEDBACK_AI_REPLIED` (separate from `FEEDBACK_THREAD_REPLIED`) with `{model, tokensIn, tokensOut, turnIndex}` metadata for spend attribution. Errors audit as `status=FAILURE` and bail silently — user-facing reply path NEVER breaks on AI failures.
  - Notify-on-reply stub renamed comment from "swap for SendGrid" to "swap for Resend" (per cost-control decision 2026-05-09).
- `app/api/portal/feedback/route.ts` — POST accepts optional `authorRole: 'ADVISER' | 'CONSUMER'` from request body (defaults to ADVISER for backward compat). Triggers `respondToFeedbackThread()` fire-and-forget after thread creation.
- `app/api/portal/feedback/[id]/reply/route.ts` — same fire-and-forget AI trigger after every adviser/consumer reply.
- `components/DashboardLayout.tsx` — imports `FeedbackButton`; mounts it alongside `AiChatButton` and `HelpDrawerButton`. Suppressed during onboarding modals (same gate as the others).
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #39 → SHIPPED + new 2026-05-10 Recently Completed entry.
- `docs/operational/cost-control/00_VENDOR_INVENTORY.md` — Anthropic row flipped from "queued" to "WIRED 2026-05-10" with the service-path pointer.
- `docs/blueprint/PHASE_33G_ADVISER_FEEDBACK_INBOX.md` — header status block extended with the 33g.2 ship line.

### Build Status
- [x] Schema + migration paired in same PR (CLAUDE.md §12.12 satisfied).
- [ ] `npx tsc --noEmit` — Vercel preview is the source of truth (local `node_modules` not present).

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern — new `<FeedbackButton />` + `<FeedbackChatDrawer />` consumer chrome
- [x] application config — new `ANTHROPIC_API_KEY` env var (registered in cost-control inventory + setup runbook)
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture — AI sees only conversation text; new `FEEDBACK_AI_REPLIED` audit action; AFSL boundary in system prompt
- [ ] operational procedure (no new runbook this round; cost-control runbook §4 already covers Anthropic setup)
- [x] strategic decision — Up Next #39 closed

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — Up Next #39 → SHIPPED + Recently Completed (§15)
- `docs/changelog/CHANGELOG_2026_05_10.md` — this session block (§11)
- `docs/operational/cost-control/00_VENDOR_INVENTORY.md` — Anthropic row updated to "WIRED"
- `docs/blueprint/PHASE_33G_ADVISER_FEEDBACK_INBOX.md` — header status block extended

§12.11 destructive-write checklist: NOT REQUIRED — no UPDATE/DELETE on existing rows; migration is purely additive `ALTER TYPE ADD VALUE`.
§12.12 schema migration: SATISFIED — `prisma/schema.prisma` changes paired with `prisma/migrations/20260510120000_add_feedback_ai_role/migration.sql` in the same PR.

### Test plan (manual, post-deploy)

**Without `ANTHROPIC_API_KEY` set (form-only mode):**
1. Sign in to consumer Monitrax → land on `/dashboard`.
2. Top-right shows three floating buttons in this order (right to left): help `?`, feedback `MessageSquarePlus`, AI chat (bottom-right).
3. Click feedback button → drawer slides in from right (≥md) or up from bottom (<md).
4. Header subtitle reads *"We'll reply within 48 hours, every time."* (no AI typing indicator).
5. Type a message + tag + severity → Send. Drawer shows the user message + a green "Thanks — your feedback is in" success block.
6. `/admin/feedback` shows the thread with `authorRole: CONSUMER` on the first message.

**With `ANTHROPIC_API_KEY` set (AI mode):**
1. Same drawer; subtitle reads *"AI will reply with clarifying questions before passing it to Reza."*
2. Send first message → user bubble appears + "Monitrax AI is typing…" indicator.
3. Within ~5s an AI reply appears in an emerald bubble with the Sparkles icon — should ask a clarifying question.
4. Reply → AI replies again (up to 6 turns, then stops asking new questions).
5. `/admin/feedback` thread shows alternating CONSUMER + CLAUDE_AI messages; audit log shows `FEEDBACK_AI_REPLIED` rows with `{model, tokensIn, tokensOut, turnIndex}` metadata.

**Hard guards:**
- AI does NOT reply twice in a row without user input.
- AI stops at 6 turns per thread.
- Setting status to `PLANNED` / `SHIPPED` etc. in `/admin/feedback` stops AI replies.
- Anthropic API errors do NOT break the user-facing reply path; failure audited.

### PR
- Branch: `claude/phase-33g2-live-ai-feedback-Q6tyx`
- Single PR opens after this commit lands on the branch.
