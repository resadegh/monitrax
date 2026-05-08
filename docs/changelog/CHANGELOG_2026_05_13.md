# Changelog — 2026-05-13

## Session: claude/phase-33g4-consumer-status-polling-Q6tyx (Phase 33g.4 — consumer thread-status + live polling)

### Changes Made
- **Type:** Polish + UX completion (follow-up to Phase 33g.3 PR #732)
- **Scope:** Consumer drawer now surfaces thread status to the user + auto-refreshes while in thread view so admin replies / status changes appear without close+reopen

### Files Modified
- `components/help/FeedbackChatDrawer.tsx`:
  - New `threadStatus: Status | null` state, set on every entry into the thread view (open from list, after-create, polled refresh) and cleared on reset/back-to-list
  - New `CLOSED_STATUSES` (`SHIPPED` / `WONT_FIX` / `DUPLICATE`) + `isThreadClosed()` helper + `CLOSED_MESSAGE` lookup with copy specific to each closed reason
  - Thread-view header gains a status chip (same colour palette as the threads-list rows)
  - Thread view renders a closed-state banner above the composer + disables composer (textarea + send button) when the thread is closed; placeholder updates to "This thread is closed. Start a new one to continue."
  - New `useEffect` polling loop: while `open && view === 'thread' && threadId && token`, hits `GET /api/portal/feedback/[id]` every 8 seconds; merges any new messages by ID (skipping `local-*` optimistic placeholders) and reflects status changes; clears on view change or close; skips while a submit is in-flight to avoid stepping on the existing `pollForAiReply` loop

### Files NOT Modified
- API endpoints — the GET endpoint already returns `status` + `messages` for the caller's own thread.
- Service layer / schema — no changes.

### Build status
- Vercel preview is the source of truth.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [x] visual design system / component pattern — status chip + closed-state banner + polling loop in the drawer
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated:
- `docs/IMPLEMENTATION_PLAN.md` — new 2026-05-13 Recently Completed entry
- `docs/changelog/CHANGELOG_2026_05_13.md` — this session block

§12.11 destructive-write checklist: NOT REQUIRED — UI-only change.
§12.12 schema migration: NOT REQUIRED — no schema change.

### Test plan (manual, post-deploy)

**Status visibility:**
- [ ] Open the consumer drawer on a thread that is `OPEN` → header shows amber "Open" chip below the subject.
- [ ] In `/admin/feedback`, mark the thread `IN_REVIEW` → within ~8s the chip in the consumer drawer flips to sky-blue "In review".
- [ ] Mark the thread `SHIPPED` → chip flips to emerald "Shipped"; closed-state banner appears above the composer; textarea + send button disabled with tooltip-style placeholder.
- [ ] Repeat for `WONT_FIX` and `DUPLICATE` — distinct copy per reason in `CLOSED_MESSAGE`.

**Live polling:**
- [ ] Open the consumer drawer on an `OPEN` thread.
- [ ] In `/admin/feedback`, post a reply to the same thread.
- [ ] Within ~8s, the new reply appears in the consumer drawer's conversation pane (emerald bubble for `MONITRAX_ADMIN`).
- [ ] Polling stops when the user clicks back-to-list, closes the drawer, or navigates to a different page.

### PR
- Branch: `claude/phase-33g4-consumer-status-polling-Q6tyx`
