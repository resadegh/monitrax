# Changelog — 2026-05-11

## Session: claude/phase-33g2-polish-Q6tyx (Phase 33g.2 polish — CLAUDE_AI styling + per-thread AI-disable)

### Changes Made
- **Type:** Polish (follow-up to Phase 33g.2 PR #730)
- **Scope:** Surface `CLAUDE_AI` author role distinctly in both feedback inboxes + give Reza a per-thread AI-disable override

### Files Created
- `prisma/migrations/20260511100000_add_feedback_ai_disabled/migration.sql` — additive `ADD COLUMN ... DEFAULT false`; zero rows touched (CLAUDE.md §12.11 not required).
- `docs/changelog/CHANGELOG_2026_05_11.md` — this session block.

### Files Modified
- `prisma/schema.prisma` — `FeedbackThread.aiDisabled Boolean @default(false)` added.
- `lib/services/feedbackService.ts`:
  - `UpdateAdminFieldsInput.aiDisabled?: boolean` added.
  - `updateAdminFields()` writes the field through.
  - `respondToFeedbackThread()` selects `aiDisabled` + new early-bail guard: when true, no AI call fires regardless of global key.
- `app/api/admin/feedback/[id]/route.ts` — PATCH whitelists `aiDisabled` in the body destructure + service-call.
- `app/admin/feedback/page.tsx`:
  - `ThreadDetail.aiDisabled: boolean` added.
  - Conversation bubble: CLAUDE_AI now violet-tinted with ✨ glyph + "Monitrax AI" label; CONSUMER labelled "Consumer" (was lumped with "Adviser"); MONITRAX_ADMIN labelled "Monitrax (you)" for clarity.
  - New **Disable AI on this thread** checkbox alongside "Tag for AI synthesis", with hover-tooltip explaining the use case (sensitive CDR/AFSL threads).
- `app/portal/feedback/page.tsx`:
  - Conversation bubble: CLAUDE_AI now violet-tinted with ✨ glyph + "Monitrax AI" label.
  - User-side bubble logic broadened so ADVISER **and** CONSUMER both render as "You" (an org-attached user posting via the consumer drawer is still posting their own message).

### Build status
- Schema + migration paired in same PR (CLAUDE.md §12.12 satisfied).
- Vercel preview is the source of truth.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern — distinct CLAUDE_AI bubble across two pages
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [x] security / CDR posture — new per-thread AI-disable lever for sensitive threads
- [ ] operational procedure
- [ ] strategic decision

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — new 2026-05-11 Recently Completed entry
- `docs/changelog/CHANGELOG_2026_05_11.md` — this session block

§12.11 destructive-write checklist: NOT REQUIRED — purely additive ADD COLUMN with default.
§12.12 schema migration: SATISFIED — `schema.prisma` change paired with migration in same PR.

### Test plan (manual, post-deploy)

**Visual:**
1. Open `/admin/feedback` on a thread that has both human + AI messages — AI bubbles should be violet with a ✨ glyph + "Monitrax AI" label.
2. Same on `/portal/feedback` — adviser sees their own messages as "You", AI replies as violet "Monitrax AI", Reza's replies as emerald "Monitrax".

**Per-thread AI disable:**
1. In `/admin/feedback`, tick "Disable AI on this thread" on a thread where AI is currently replying.
2. The next consumer/adviser reply on that thread does NOT trigger an AI response (verify by checking the thread; only the user message + your eventual manual reply appear).
3. Untick — AI re-engages on the next user reply.

### PR
- Branch: `claude/phase-33g2-polish-Q6tyx`
