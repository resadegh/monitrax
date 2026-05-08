# Changelog — 2026-05-12

## Session: claude/phase-33g3-consumer-thread-list-Q6tyx (Phase 33g.3 — Consumer "Your threads" view)

### Changes Made
- **Type:** Feature (closes the consumer one-shot drawer gap from Phase 33g.2)
- **Scope:** `<FeedbackChatDrawer />` becomes a three-view state machine; consumers can now come back to see Reza's replies and continue conversations

### Files Modified
- `components/help/FeedbackChatDrawer.tsx`:
  - New `DrawerView = 'list' | 'new' | 'thread'` state machine
  - `ThreadSummary` interface mirroring the GET-endpoint shape
  - `STATUS_LABEL` + `STATUS_TONE` lookups + `relTime` helper for the list rendering
  - `mapAuthorRole()` helper consolidating role → bubble role mapping (ADVISER + CONSUMER → user; CLAUDE_AI → ai; MONITRAX_ADMIN → monitrax)
  - `fetchThreads()` callback hits `GET /api/portal/feedback` (already scoped to caller via service layer); `useEffect` runs on first open and sets default view based on whether the user has any threads
  - `openThread()` populates the message state from a list row + switches to thread view
  - `backToList()` resets the working state + refreshes the list silently
  - `startNewThread()` switches to the new-thread form
  - After submitting a new thread, view auto-flips to `thread` (was: stayed on `new` with metadata pickers visible)
  - Header gains a back-arrow button when in `thread` or in `new` (with prior threads)
  - Header label is context-aware: `Your previous threads` / `What's on your mind?` / `<thread subject>`
  - Body renders one of three blocks based on view; composer hidden on list view; success/typing indicators gated on thread view
  - List view shows last-message preview with role-prefixed text + status chip + relative time + `+ New thread` button at the bottom

### Files NOT Modified
- `app/api/portal/feedback/route.ts` — already scopes the GET to `auth.userId`. The endpoint comment says "adviser lists own threads" but the implementation works for any caller; that comment can be updated in a future polish.
- Schema, migrations, service layer — no changes. Pure UI/UX.

### Build Status
- Vercel preview is the source of truth.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern — three-view state machine inside an existing drawer
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — new 2026-05-12 Recently Completed entry
- `docs/changelog/CHANGELOG_2026_05_12.md` — this session block

§12.11 destructive-write checklist: NOT REQUIRED — UI-only change.
§12.12 schema migration: NOT REQUIRED — no schema change.

### Test plan (manual, post-deploy)

**First-time user:**
1. Sign in as a consumer with no prior feedback → click feedback button.
2. Drawer opens with the **What's on your mind?** view (no list — they have no threads yet).
3. Submit a message → drawer auto-switches to thread view; AI replies (or success message) appear inline.

**Returning user:**
1. Sign in as a consumer who already submitted feedback → click feedback button.
2. Drawer opens with **Your previous threads** list. Each row shows subject + status chip + last-reply preview + age.
3. Click a row → drawer switches to thread view with full history.
4. Type a reply, send → message appears immediately. AI (if on) auto-replies inline.
5. Click back-arrow → drawer returns to the updated list (newly active thread bubbles to top).
6. Click `+ New thread` → drawer switches to the new-thread form (note: back-arrow still appears now that prior threads exist).

**Edge cases:**
- Esc / X / backdrop dismiss work in all three views.
- Thread list refreshes after a new thread is created (silent — no flicker on the list).
- iOS Safari: bottom-sheet still scrolls correctly on list view.

### PR
- Branch: `claude/phase-33g3-consumer-thread-list-Q6tyx`
