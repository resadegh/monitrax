# Phase 33g — Adviser Feedback Inbox (async)

> **Status:** PROPOSAL (2026-05-05) — awaiting Reza go/no-go.
> **Owner:** Claude (proposal author) → Reza (decision).
> **Branch:** `claude/phase-33g-adviser-feedback-proposal-Q6tyx` (this PR is doc-only; no code lands until approval).
> **Trigger:** Reza brief 2026-05-05 — "I thought of a feedback system to provide to the advisers after the pitch and the pilot users, this feedback system should allow a direct chat with yourself in order to go back and forth with the feedback and requirements, then you can analyse, create a plan and present to me for a way forward."
> **Decision so far:** Reza picked the **async** shape over live-AI-chat (cheaper, faster to ship, narrower compliance surface; live chat queued as a future evolution if volume justifies it).

---

## TL;DR

A purpose-built **adviser → Monitrax feedback inbox** at `/portal/feedback` (write side) and `/admin/feedback` (read side), with threaded replies, structured tags (Bug / Feature / UX / Praise / Question / Compliance concern), severity, status workflow, and a Markdown export endpoint Reza can pipe into a Claude Code session for periodic synthesis. Effort: **~4 dev days** including doc-sync. Sequenced to ship **before the lighthouse pitch** so the inbox is live when the first design partners start using the product.

---

## 1. Problem

After the lighthouse pitch and during the pilot phase, advisers will form opinions about Monitrax that we need to capture **before** they crystallise into churn or before a competitor learns them first. Today there is no in-product channel for that signal — they'd have to email Reza, which:

1. **Doesn't scale** — gets buried in the inbox; no triage, no status, no priority.
2. **Loses context** — adviser doesn't say "the loan tile on `/dashboard/balances` is wrong"; they say "loans are broken." We need the surface tag + the route they were on.
3. **Doesn't feed back** — adviser hears nothing; they assume their feedback hit `/dev/null`.
4. **Reads as un-product-ised** — "email the founder" is fine for one or two design partners, embarrassing at five paying orgs.

The flip side — building anything elaborate before we have signal volume — wastes dev days and produces a black hole that'll be empty for the first six months. **Async, threaded, low-ceremony** is the right shape now.

---

## 2. Why this shape

| Lens (CLAUDE.md §0) | What it asks | Answer |
|---|---|---|
| **Architect** | Are we duplicating an engine? | No. Phase 32C PR4d builds `ProfessionalConversation` (adviser↔client). This is Monitrax↔adviser. Different participants, different retention rules (24mo vs 7yr), different status workflow (bug-tracker shape vs message-only). Forcing them through one schema would create a discriminator nightmare. **Decision: separate `FeedbackThread` + `FeedbackMessage` models.** |
| **Designer** | Does it look like Linear / Stripe / Mercury? | Practice glass card, warm-ivory, threaded replies, status chips. Reuses `PracticeGlassCard` + `TrailStageChip` palette. Zero new design tokens. |
| **Behaviour psychologist** | Does it help advisers act, not overwhelm them? | One CTA per page. The "submit" form auto-fills `surfaceRoute` from where they came from (so they don't have to remember). SLA stated up-front: *"first reply within 48 hours, every time."* That's the dopamine loop. |
| **Financial adviser** | Are we exposing CDR data risk? | Adviser feedback may name real clients ("Sarah Kim's loan tile is broken"). UX nudge above input: *"If you reference a specific client, please use a non-identifying tag like 'Client A' — feedback contents are subject to retention rules."* Not a hard block (we can't programmatically detect names with current infra) — Cloud DLP integration queued under §13.9 P2 will harden later. |

---

## 3. Solution

### 3.1 UX surfaces

**Adviser side — `/portal/feedback`:**

1. **List view** (top): the adviser's own threads, newest first, with status chip + last-reply age. *"4 open · 12 replied · 3 shipped."*
2. **New thread CTA** (top-right): opens an inline drawer with subject + tag + severity + body + auto-filled `surfaceRoute` (from `document.referrer` if available, otherwise blank).
3. **Thread detail**: full conversation, reply box at the bottom, status visible + read-only (only Monitrax can flip status).

Plus **two integration points** so advisers don't have to navigate to `/portal/feedback` to leave feedback:

- **Help drawer** (Phase 33b shipped) gets a "Send feedback →" footer link beside "Open full Help Center →". Pre-fills `surfaceRoute` with `pathname` at the moment they opened the drawer.
- **`PracticeHeader`** gets a small "Feedback" affordance in the action slot (matches the design language of the existing badge).

**Reza side — `/admin/feedback`:**

1. **Inbox list**: all threads across all advisers, filterable by status / severity / tag / org. Default sort: oldest open first (so nothing rots).
2. **Thread detail**: full conversation, reply box, status flipper (Open / In Review / Planned / Shipped / Won't fix / Duplicate), internal-notes textarea (adviser doesn't see), "Tag for Claude analysis" toggle.
3. **Markdown export** (button): downloads a single `.md` file containing every thread tagged for analysis (or a date-range slice). This is the file you paste into a Claude Code session for synthesis.

### 3.2 Data model

```
FeedbackThread
  id              String   @id (uuid)
  userId          String   FK → users (the adviser submitting)
  organizationId  String   FK → organizations (org context)
  subject         String   // free-text, ≤120 chars
  surfaceRoute    String?  // e.g. "/portal/clients/abc/view" — optional
  surfaceTag      Enum     // BUG | FEATURE | UX | PRAISE | QUESTION | COMPLIANCE
  severity        Enum     // LOW | MEDIUM | HIGH
  status          Enum     // OPEN | IN_REVIEW | PLANNED | SHIPPED | WONT_FIX | DUPLICATE
  internalNotes   String?  // Reza-only; never returned to adviser-facing API
  taggedForAi     Boolean  // included in Markdown export when true
  createdAt       DateTime
  updatedAt       DateTime
  lastReviewedAt  DateTime?

FeedbackMessage
  id          String   @id (uuid)
  threadId    String   FK → feedback_threads ON DELETE CASCADE
  authorId    String   FK → users (Reza or adviser)
  authorRole  Enum     // ADVISER | MONITRAX_ADMIN
  body        String   // markdown, rendered via lib/help/markdown.ts
  createdAt   DateTime
```

**Migration shape:** additive only — two new tables + four new enums (`FeedbackSurfaceTag`, `FeedbackSeverity`, `FeedbackStatus`, `FeedbackAuthorRole`). Zero schema risk per CLAUDE.md §12.11 (no destructive writes), §12.12 (matching `prisma/migrations/<ts>_add_feedback_inbox/migration.sql` ships in the same PR).

### 3.3 API routes

All under `withPermission()` — CLAUDE.md §6.1 + §12.5:

- `POST /api/portal/feedback` — adviser creates thread + first message (auth: `feedback.write`)
- `GET /api/portal/feedback` — adviser lists own threads (auth: `feedback.read`, scoped to `userId === authReq.user.userId`)
- `GET /api/portal/feedback/[id]` — adviser reads own thread (same scope check)
- `POST /api/portal/feedback/[id]/reply` — adviser replies on own thread (same scope check)
- `GET /api/admin/feedback` — Reza lists all threads (auth: `feedback.admin`, gated to MONITRAX_ADMIN role)
- `PATCH /api/admin/feedback/[id]` — Reza flips status / writes internal note / toggles `taggedForAi`
- `POST /api/admin/feedback/[id]/reply` — Reza replies as `MONITRAX_ADMIN`
- `GET /api/admin/feedback/export.md?since=YYYY-MM-DD&taggedOnly=true` — Markdown bundle for Claude analysis

### 3.4 Claude analysis loop (the "for me to analyse" piece)

This is **not** an in-app feature — it's a workflow. The loop:

1. Reza periodically (weekly?) hits the export endpoint.
2. Saves the `.md` to e.g. `~/feedback-export-2026-05-12.md`.
3. Opens a Claude Code session in the monitrax repo and pastes / attaches the file.
4. Asks: *"Synthesise themes, prioritise by frequency × severity, propose a plan that slots into IMPLEMENTATION_PLAN.md Up Next."*
5. I produce a structured synthesis + a draft plan; Reza picks what to ship.

No additional tooling needed — this is what Claude Code is good at. If the volume gets high enough that the manual loop becomes a chore, **Phase 33g.2** (live AI chat in-app) is the natural evolution.

---

## 4. Implementation plan (the build itself, post-approval)

| # | Task | Effort | Notes |
|---|---|---|---|
| 1 | Prisma schema + migration (4 enums + 2 tables) | 0.5d | Additive only; no destructive write. |
| 2 | Permission registry + RBAC (`feedback.read/write/admin`) | 0.25d | Reuses `lib/auth/guards.ts` + Phase 32B PR3 plan-tier pattern. |
| 3 | API routes (8 endpoints above) | 0.75d | Thin wrappers per CLAUDE.md §12.3; business logic stays in a new `lib/services/feedbackService.ts`. |
| 4 | Adviser-side `/portal/feedback` UI (list + detail + new-thread drawer) | 1d | `PracticeGlassCard` + `TrailStageChip` palette. Reuses `lib/help/markdown.ts` for message rendering. |
| 5 | Help drawer footer link + `PracticeHeader` affordance | 0.25d | Two small edits — drop-in "Send feedback →" link in `<HelpDrawer />` footer + a button in `PracticeHeader`. |
| 6 | Reza-side `/admin/feedback` UI (inbox list + detail + export) | 1d | Follows the existing `/admin` patterns. |
| 7 | Markdown export endpoint + tested round-trip with a Claude Code session | 0.25d | Verify the export format actually works for synthesis. |
| 8 | Doc-sync + changelog + IMPLEMENTATION_PLAN flip | 0.25d | CLAUDE.md §15 + §16. |
| **Total** | | **~4 dev days** | One focused session. |

**Sequencing:**
- Sits inside the Phase 33 umbrella (Help / Training / FAQ / Compliance / **Feedback**) → name: **Phase 33g — Adviser Feedback Inbox**.
- Slots into Demo-Complete Critical Path week 13/14 alongside Phase 33b/c/d (already shipped or in-flight).
- **Trigger to start: Reza approves this proposal.** No external dependency, no other phase blocks it.

---

## 5. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Adviser pastes real CDR data (client name, balance, BSB) into the body | UX nudge above input + Cloud DLP integration queued under CLAUDE.md §13.9 P2 (post-MVP hardening). Status workflow lets Reza flag a thread as `COMPLIANCE` + redact in `internalNotes` before any AI synthesis. |
| Inbox becomes a black hole — advisers send things, hear nothing | "First reply within 48 hours" SLA stated above the form. Cloud Scheduler daily cron flags any `OPEN` thread > 48h with no `MONITRAX_ADMIN` reply (alert to Reza, not the adviser). |
| Markdown export unintentionally exfiltrates `internalNotes` | Export is server-side; `internalNotes` is excluded from the export query. Adviser-facing API never returns `internalNotes`. Both gates enforced in `lib/services/feedbackService.ts`, not at the route. |
| Off-the-record flag misused for formal complaints | Disclaimer above the form: *"For formal complaints, escalate via Settings → Support."* Off-the-record is **editorial** (Reza treats it as such), not **legal** — we still log everything. |
| Phase 32C PR4d (`ProfessionalConversation`) ships first and architects feel pressure to merge schemas | Doc this rationale in `lib/services/feedbackService.ts` file-header JSDoc + add a Reversed Decisions row pre-emptively in `IMPLEMENTATION_PLAN.md` so a future session doesn't try to consolidate. |

---

## 6. Compliance posture (CDR §13)

| Concern | Posture |
|---|---|
| Data residency | Cloud SQL `monitrax-db-prod` (australia-southeast1) — same as everything else. No new infra. |
| Encryption at rest | Default Cloud SQL encryption now; CMEK queued in Up Next #3 will cover automatically. |
| Audit log | Every status flip + every reply writes an `AuditLog` row (`FEEDBACK_THREAD_REPLIED` / `FEEDBACK_THREAD_STATUS_CHANGED`). Two new `AuditAction` enum values via additive migration. |
| Retention | Default 24 months; threads tagged `COMPLIANCE` retained 7yr (mirrors `ProfessionalConversation` retention rule). |
| Consent | No consumer CDR data exposed — feedback is adviser-authored. If an adviser pastes client data, it's their breach to disclose; we mitigate via UX nudge + (post-MVP) DLP. |
| MFA | Reza-side `/admin/feedback` requires MFA per CLAUDE.md §13.4. Adviser-side does not (adviser is writing, not reading CDR data). |
| Audience scoping | Adviser sees own threads only. Reza sees everything. No cross-org leakage possible. |

---

## 7. Out of scope (this phase)

| Out of scope | When to revisit |
|---|---|
| Consumer-side feedback (D2C users) | Phase 33h — after consumer pilot starts. Same schema, separate UI. |
| Live AI chat in-app (Anthropic Claude API in the loop) | Phase 33g.2 — when async volume > 5 threads/day and the manual Claude Code synthesis loop becomes a chore. |
| Inbound email gateway (SendGrid Inbound Parse) | Phase 32C PR4d ships this for `ProfessionalConversation`; reuse later if needed. Not required now. |
| Public-facing feedback widget on `/help` | Marketing surface, not pilot tool. Defer indefinitely. |
| Auto-categorisation via Gemini | Pilot volume is too low to train on. Manual triage by Reza is fine to ~50 threads/week. |
| Voting / upvotes (Productboard-style) | We have ~5 advisers. Counting votes is meaningless until ~50. |

---

## 8. Acceptance criteria (post-build)

1. An adviser can submit a feedback thread from `/portal/feedback` and from the help drawer footer; thread appears in their list immediately.
2. Reza can see the thread in `/admin/feedback`, reply, flip status, write an internal note that the adviser cannot see.
3. Adviser sees the reply on next visit; thread status visible (read-only).
4. SLA cron correctly flags `OPEN` threads > 48h without admin reply.
5. Markdown export endpoint produces a single `.md` file that, when fed to a fresh Claude Code session in this repo, produces a coherent synthesis + draft plan.
6. `npx tsc --noEmit` clean. Vercel preview build green (migration applies).
7. `IMPLEMENTATION_PLAN.md` Up Next entry → SHIPPED. Today's changelog entry. CLAUDE.md §16.5 doc-sync block populated in the build PR.

---

## 9. Open questions for Reza

1. **Naming:** "Feedback" vs "Send feedback" vs "Tell us" — designer preference?
2. **Email notification on reply:** do you want SendGrid pings to the adviser when you reply, or in-app only? (Adds 0.25d if yes; reuses Phase 32C PR4d email infra if available, otherwise stub for now.)
3. **Severity defaults:** should new threads default to `MEDIUM` or force the adviser to pick? (Forcing reduces noise; defaulting reduces friction.)
4. **Internal-notes audit:** every edit to `internalNotes` audited, or just first-write? (Audited-on-every-edit is the safer posture.)
5. **First-reply SLA cron:** is 48 hours the right number? Tighter (24h) reads more like a serious product but costs Reza weekend time.

---

## 10. Recommendation

**Approve and let me ship it.** Four dev days, additive schema, no compliance surface beyond what's already in CLAUDE.md §13, and it's the structural bridge between the lighthouse pitch and the design-partner conversion path in `LIGHTHOUSE_ADVISER_PITCH.md` §5. The `/admin/feedback` inbox is also the place you'll spend a lot of time during the pilot — building it as a proper surface rather than scrolling email is itself a productivity win.

**One clear next action:** confirm "go" on the open questions in §9 and I'll open the build PR.

---

*Last updated: 2026-05-05*
*Status: PROPOSAL — pending Reza go/no-go on §9 open questions.*
