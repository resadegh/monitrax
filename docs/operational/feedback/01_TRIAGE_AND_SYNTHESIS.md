# Adviser Feedback Inbox — Triage + Synthesis Runbook

> **Audience:** Reza (or future Monitrax founder/PM/support operator).
> **Status:** v1 (2026-05-05). Phase 33g shipped per `docs/blueprint/PHASE_33G_ADVISER_FEEDBACK_INBOX.md`.
> **Adviser-facing companion:** `docs/help/org-professional/sending-feedback.md` — read this once so you know exactly what advisers see.

The Adviser Feedback Inbox is the structured channel between pilot advisers and Monitrax. This runbook covers the operational practice — daily triage, the SLA, the weekly Claude Code synthesis ritual, and the escape hatches for the things that go sideways.

## 1. The shape

| Surface | Audience | URL |
|---|---|---|
| Adviser write side | Org-attached advisers | `/portal/feedback` |
| Admin (Reza) read side | Monitrax admins (via `verifyAdminGCPAuth`) | `/admin/feedback` |
| Markdown export | Monitrax admins | `/api/admin/feedback/export?since=&taggedOnly=` |
| Help article | Advisers | `/help/org-professional/sending-feedback` |

Everything routes through `lib/services/feedbackService.ts` — the canonical CRUD + audit boundary. Don't bypass it; the service-layer guards are what keep `internalNotes` from leaking and what guarantees every state transition is audit-logged.

## 2. Daily ritual (≈ 10 minutes)

1. **Open `/admin/feedback`.** Default sort is oldest open first — top of the list is what's been waiting longest.
2. **Filter to `Open`** if the inbox is busy. The filter chips at the top of the page do this with one click.
3. **For each `Open` thread:**
   - Read the body. Note the `surfaceTag`, `severity`, and `surfaceRoute` (the page the adviser was on when they submitted).
   - Write a short reply. Even *"Thanks — looking at this, will come back with detail by end of week"* is enough to flip the status off `Open`. Silence is the worst response.
   - The service auto-flips `OPEN → IN_REVIEW` on your first reply. No manual click needed.
   - Add `internalNotes` if there's something Reza-only worth capturing (a guess at the root cause, a link to a PR you're about to open, a "duplicate of thread X" pointer). The adviser never sees these. **Every edit is audit-logged** with the *length-delta only* — body of the note is never logged — so feel free to iterate.
4. **Tag for AI synthesis** any thread that's substantive enough to belong in the weekly themes review. Bug reports + UX feedback usually qualify; one-line praise usually doesn't. Use judgement — too few tags miss signal, too many drown the synthesis.
5. **Update status as work progresses.** `Planned` when the work is on the next sprint. `Shipped` when the fix is live in prod. `Won't fix` / `Duplicate` are honest closes — explain why in your reply, not just in `internalNotes`.

### SLA target

**48 hours from `Open` → first admin reply.** Stated to advisers in the form copy ("We aim to reply within 48 hours, every time"). This is the trust commitment — under-promise, over-deliver.

> **Cron-based 48h flagging is queued as a follow-up PR**, not yet live. Until then the SLA is enforced manually by hitting `/admin/feedback?status=OPEN` and looking at the relTime ("3d ago" = you missed it). If volume grows past ~5 threads/week, ship the cron.

## 3. Weekly synthesis ritual (≈ 30 minutes)

This is the load-bearing operational step the whole inbox is designed for. It's how you turn 20+ disconnected feedback threads into a focused plan.

### 3.1 Export

In `/admin/feedback`, click **Export tagged (.md)**. This downloads `monitrax-feedback-YYYY-MM-DD-tagged.md` — a single Markdown file containing every AI-tagged thread + its full message history.

Server-side, the export:

- Excludes `internalNotes` for **every** thread (regardless of `taggedForAi`).
- Includes only threads where `taggedForAi = true`.
- Optionally accepts `?since=YYYY-MM-DD` to scope to a date range. Default is all-time.
- Logs the export as an `EXPORT` audit row tied to your admin ID.

> If you want **all** threads (including untagged) for a one-off audit, use **Export all (.md)** instead. Same shape, same exclusions for `internalNotes`. Reach for tagged-only by default — it's what the synthesis loop is calibrated for.

### 3.2 Synthesise with Claude Code

1. Save the `.md` somewhere you can reach it (e.g. `~/Downloads/monitrax-feedback-2026-05-12-tagged.md`).
2. Open a fresh **Claude Code session in the monitrax repo** (this matters — the session needs the IMPLEMENTATION_PLAN.md context to propose a sensible plan).
3. Paste or attach the file and use a prompt like:

```
Attached: this week's adviser feedback export from /admin/feedback (taggedForAi only).

Synthesise themes by frequency × severity. Group adjacent feedback (e.g. multiple
threads about the same surface or same flow). For each theme, propose a plan item
that slots into IMPLEMENTATION_PLAN.md Up Next — keep the proposal tight, don't
write code yet.

Flag any thread that mentions specific client identifiers — call them out so I
can redact + check we're not breaching CDR/privacy posture.

Output:
1. Top 3 themes by impact × frequency
2. For each theme, a one-paragraph proposed Up Next entry
3. Anything that should NOT be on the roadmap (and why)
4. Any flagged threads (PII / CDR concern)
```

4. Read the synthesis. Push back if it's off — Claude is a junior PM here, not a senior one. Iterate.
5. **You make the call.** Decide which themes ship next. Add the chosen items to `docs/IMPLEMENTATION_PLAN.md` Up Next as new entries with a reference back to the source thread IDs.

### 3.3 Close the loop

For each thread that drove an item into Up Next:

- Reply on the thread: *"This is going on the roadmap as Up Next #N — will share when it ships."*
- Flip status to `Planned`.
- Optionally, untag for AI (so it doesn't keep appearing in next week's synthesis until it ships).

When the work ships, come back and:

- Reply: *"This shipped in PR #X — try it out, let me know."*
- Flip status to `Shipped`.

That's the dopamine loop the adviser sees — *"I told them, they listened, they shipped, they came back."* It's the difference between a feedback inbox that works and one that becomes a graveyard.

## 4. Handling client / CDR data leaks

Despite the soft UX nudge above the adviser input, advisers will occasionally drop client names, balances, or BSBs into a thread body. The runbook for this:

1. **Tag the thread `COMPLIANCE`** if it identifies a real client. This auto-extends retention to 7 years per the compliance archive policy and surfaces the thread in any compliance-class filter.
2. **Reply to the adviser.** Polite, short:
   > *"Quick note — we noticed this thread mentions a specific client. For our shared retention/CDR posture, can you add a follow-up message confirming the client has consented to their details being in this thread, or rephrase using a non-identifying tag like 'Client A' going forward? We'll keep this thread retained per our compliance archive policy."*
3. **Consider redacting in a reply** if the leak is severe (full names + balances + account numbers). The original message can't be deleted — the FeedbackMessage table is append-only by design — but a reply with the redaction is the cleanest paper trail.
4. **If it crosses the line** (active CDR consent breach + real consumer data + no consent recorded): treat as an **incident**. Follow `docs/policy/INCIDENT_RESPONSE_PLAN.md` from §3 onwards. The audit trail in the `feedback_threads` + `audit_logs` tables is the evidence base — preserve it, don't try to clean it up.
5. **Cloud DLP integration** is queued for PROD per CLAUDE.md §13.9 P2. Once it lands, suspect threads will be flagged automatically in `/admin/feedback`. Until then, manual vigilance on the COMPLIANCE-tagged threads is the gate.

## 5. Audit log questions

Every state change writes an `AuditLog` row. The three relevant action codes:

| Action | Fires when |
|---|---|
| `FEEDBACK_THREAD_REPLIED` | Adviser submits a thread (`isFirstMessage: true` in metadata) OR adviser replies OR admin replies |
| `FEEDBACK_THREAD_STATUS_CHANGED` | Admin changes status; metadata = `{ from, to }` |
| `FEEDBACK_INTERNAL_NOTE_UPDATED` | Admin edits `internalNotes`; metadata = `{ previousLength, nextLength }` only — body NEVER logged |

To query:

```sql
SELECT created_at, action, metadata
FROM audit_logs
WHERE entity_type = 'FeedbackThread'
  AND entity_id = '<thread-id>'
ORDER BY created_at ASC;
```

Or via the existing `/admin/audit-logs` UI — filter by `entity_type = FeedbackThread`.

## 6. Common operational questions

### "I replied as admin but the status didn't change"

Check the thread status before your reply. The auto-flip is `OPEN → IN_REVIEW` only. If the status was already `IN_REVIEW`, `PLANNED`, etc., your reply doesn't change it — you have to flip status manually if you want it moved. By design.

### "An adviser is replying every 30 minutes; how do I slow this down?"

There's no rate-limit on adviser replies in v1. If a thread becomes a chat-blast, post a reply asking the adviser to consolidate their thoughts and let you respond. If that fails, change status to `IN_REVIEW` if it isn't already, and reply with a target response date — most adviser-side over-replying is anxiety about being heard. Naming a date kills it.

### "An adviser submitted feedback that should really be a feature request — what's the workflow?"

Already correct: that's what the `Feature` tag is for. Reply acknowledging, tag for AI synthesis, and let the next weekly synthesis pick it up. Don't flip to `Planned` until you've actually scoped + sequenced it in `IMPLEMENTATION_PLAN.md` — `Planned` is a commitment, not an aspiration.

### "An adviser submitted a duplicate of an existing thread"

Reply pointing at the canonical thread (by ID), and flip status to `Duplicate`. The adviser will see a status chip change + your reply with the link. Internal notes can carry the linkage for your future reference.

### "How do I delete a thread?"

You can't via the UI in v1. Threads are append-only by design (audit posture). If you absolutely need to delete one (CDR breach, accidental submission with sensitive content), do it via the database with a `prisma.feedbackThread.delete({ where: { id } })` — and log the operational action in this runbook + `docs/changelog/` per CLAUDE.md §11. The cascade on `feedback_messages` removes child rows automatically. Audit log rows pointing at the deleted entity remain (correct posture per CLAUDE.md §13.3 — the *fact* of the action is retained even when the *entity* is gone).

### "An adviser is asking when a fix will ship"

Be honest. If it's `Planned`, point them at the Up Next # in your reply and give a rough sprint window without committing to a date. If it's not `Planned` yet, say so + name the trigger condition for it to become planned ("we're tracking this; if we hear it from one more adviser this month, it goes on the next sprint").

## 7. The forward path

| Trigger | Action | Refs |
|---|---|---|
| Volume > 5 threads/week | Ship the SLA cron (Cloud Scheduler hits a new `/api/admin/feedback/sla-check`, posts to internal Slack/email) | Phase 33g design doc §4 task 6 (deferred) |
| Volume > 10 threads/week with synthesis getting noisy | Consider promoting to **Phase 33g.2 — Live AI Chat** (the alternative branch from the original brief) — Anthropic Claude API in-app, sync conversation, transcript still lands here | Phase 33g design doc §7 |
| Compliance tag rate > 5% of threads | Bring forward Cloud DLP integration (P2 in CLAUDE.md §13.9) | CLAUDE.md §13.9 |
| Phase 32C PR4d (in-app conversations) ships | Swap `notifyAdviserOfReply()` stub in `lib/services/feedbackService.ts` for the SendGrid path | Phase 33g design doc §9.2 |
| First paying org (org-attached pilot starts) | Audit `/admin/feedback?organizationId=` filter actually works end-to-end with real org data | — |
| Annual review (next: 2027-05-05) | Re-read this runbook + adviser-facing help article + design doc; update lastReviewed dates; flag stale references | CLAUDE.md §16.4 |

## 8. References

- **Design doc:** `docs/blueprint/PHASE_33G_ADVISER_FEEDBACK_INBOX.md`
- **Adviser help article:** `docs/help/org-professional/sending-feedback.md`
- **Service:** `lib/services/feedbackService.ts`
- **Schema:** `prisma/schema.prisma` (search "PHASE 33g")
- **Migration:** `prisma/migrations/20260505180000_add_feedback_inbox/migration.sql`
- **Permissions:** `lib/auth/permissions.ts` (`feedback.read`, `feedback.write`)
- **Routes:** `app/api/portal/feedback/`, `app/api/admin/feedback/`
- **UI:** `app/portal/feedback/page.tsx`, `app/admin/feedback/page.tsx`
- **CDR policy:** `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md`
- **Incident runbook (escalation path for CDR breaches):** `docs/policy/INCIDENT_RESPONSE_PLAN.md`

---

*Last reviewed: 2026-05-05. Next review due: 2027-05-05 (annual cadence) or whenever volume triggers the §7 forward-path actions, whichever is first.*
