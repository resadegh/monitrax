# Changelog — 2026-05-14

## Session: claude/phase-33g5-unread-badges-Q6tyx (Phase 33g.5 — unread badges + admin-list live refresh)

### Changes Made
- **Type:** UX completion (closes the "I don't know there's a reply waiting" gap on both sides of the feedback loop)
- **Scope:** Slack-style unread badges on the consumer FeedbackButton + per-row unread dots in the drawer's Your-threads list + 12s polling on `/admin/feedback`

### Files Created
- `hooks/useUnreadFeedback.ts` — polls `GET /api/portal/feedback` every 30s; derives unread state from localStorage watermark + last-message author check; pauses on hidden tab; returns `{unreadCount, unreadThreadIds, markSeen}`.
- `docs/changelog/CHANGELOG_2026_05_14.md` — this session block.

### Files Modified
- `components/help/FeedbackButton.tsx` — wires `useUnreadFeedback`; renders red pill badge top-right of the icon when count > 0 (caps at "9+"); calls `markSeen()` on drawer open; aria-label + title carry the unread count for screen-reader / hover discoverability.
- `components/help/FeedbackChatDrawer.tsx` — accepts new `unreadThreadIds?: Set<string>` prop; per-row unread dot + rose-tinted bg ring in the Your-threads list when row is in the set.
- `app/admin/feedback/page.tsx` — 12s polling `useEffect` refreshes the threads list AND the open thread detail; `visibilitychange` listener triggers immediate refresh when the tab returns from background; both clear on unmount.
- `docs/IMPLEMENTATION_PLAN.md` — new 2026-05-14 Recently Completed entry.

### Files NOT Modified
- `app/api/portal/feedback/route.ts` (GET) — already scopes to caller's threads + returns the `messages` array with author roles.
- `app/api/admin/feedback/route.ts` + `[id]/route.ts` — untouched.
- Schema, migrations, service layer — no changes.

### Build status
- Vercel preview is the source of truth.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern — unread badge primitive on the FeedbackButton, per-row unread dots in the drawer list, polling loop on admin inbox
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — new 2026-05-14 Recently Completed entry
- `docs/changelog/CHANGELOG_2026_05_14.md` — this session block

§12.11 destructive-write checklist: NOT REQUIRED — UI-only change.
§12.12 schema migration: NOT REQUIRED — no schema change.

### Test plan (manual, post-deploy)

**Consumer unread badge:**
- [ ] As a consumer with no prior threads → button has no badge.
- [ ] Submit a thread → badge stays at 0 (your own message doesn't trigger your own unread).
- [ ] As Reza in `/admin/feedback`, post a reply on the thread.
- [ ] Within ~30s on the consumer side, the FeedbackButton shows a red "1" pill.
- [ ] Open the drawer → Your-threads list shows the row with a red dot + rose tint.
- [ ] Click the row → enters thread view → close drawer → button badge is 0 (because `markSeen()` fired on open).
- [ ] Reza posts another reply → badge returns to "1" within 30s.

**Admin live refresh:**
- [ ] In `/admin/feedback`, leave the page open with a thread selected.
- [ ] As a consumer, post a reply on that thread (or a new thread).
- [ ] Within ~12s, the threads list row updates (last-reply timestamp + count) AND, if the affected thread is selected, the detail pane shows the new message.
- [ ] Switch tabs → wait 30s → return to the inbox tab → list refreshes immediately on tab return.

### PR
- Branch: `claude/phase-33g5-unread-badges-Q6tyx`
