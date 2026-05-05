# Changelog — 2026-05-07

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
