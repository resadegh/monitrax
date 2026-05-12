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

---

## Session: claude/monotrax-marketing-strategy-gSktV (GTM Automation playbook — B2B-led launch plan)

### Changes Made
- **Type:** Strategy + planning doc (no code, no schema, no infra)
- **Scope:** Go-to-market — full executable playbook for taking Monitrax from pre-revenue to first paying customers via a B2B-led wedge (mortgage-broker pilots + paid Financial Health Review service), with consumer subscriptions parked behind the Basiq economics gate.
- **Why:** Reza asked for a no-fluff GTM strategy + the workflows / tools / automation processes to minimise founder involvement and maximise return. Architect-mode multi-lens synthesis (financial / growth-marketing / behavioural / architect / security/compliance) produced a B2B-first 90-day playbook + a 6-phase execution plan with step-by-step actions, "done when" criteria, and a "tell Claude to execute step X.Y" protocol.

### Files Created
- `docs/marketing/GTM_EXECUTION_PLAN.md` — the executable playbook. Phases 0–6 (Pre-flight → Foundations → Outbound pipeline → Review service → Broker onboarding → Basiq decision gate → Consumer scale). Each step has Goal / Time / Prerequisites / Action / Done-when / Gotcha. Includes status tracker (unchecked boxes per step), tool + monthly cost summary (~$800–1,200/mo pre-Basiq, ~$2,800–3,200/mo post-Basiq), 5 Open Questions Q-GTM-1..5 surfaced for Reza, and the "how to ask Claude to execute a step" protocol.

### Files Modified
- `docs/IMPLEMENTATION_PLAN.md`:
  - Header `**Last updated:**` line refreshed to 2026-05-11 with GTM context; prior 2026-05-10 entry preserved as `**Earlier (2026-05-10):**`.
  - New active workstream `0d. GTM Automation — B2B-led launch playbook (executable plan)` added between `0c. Settings overhaul` and `0. Phase 14.6`. Covers status, owner, why-it-matters, the Basiq gate ($3–5k MRR + $15k cash on hand before kicking off Basiq onboarding), all 6 phases with checkboxes, success metrics, tool stack + burn, open questions, risks, 4-lens why-it-matters.
  - Open Questions table: added Q-GTM-1 (Review price), Q-GTM-2 (sending domain), Q-GTM-3 (first aggregator), Q-GTM-4 (VA hire timing), Q-GTM-5 (AFSL boundary approach).
  - "Open as of …" tail line updated from 2026-05-07 to 2026-05-11 with the 5 new GTM questions surfaced.
  - Reversed Decisions table: new 2026-05-11 entry capturing the **rejection of consumer-first GTM as the primary 90-day motion** (three structural reasons — Basiq economics + pre-Basiq product gap + consumer fintech CAC payback — and the lesson "do not re-attempt without explicit user sign-off").
- `docs/changelog/CHANGELOG_2026_05_11.md` — this session block.

### Build status
- N/A — doc-only PR. No code, no schema, no Vercel build surface.

### Doc-sync (CLAUDE.md §16)

Surfaces changed in this PR:
- [ ] visual design system / component pattern
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture (the AFSL boundary is referenced and tracked as Q-GTM-5 + Step 0.1 of the plan, but no posture change in this PR — that lands when Step 0.1 is executed)
- [ ] operational procedure
- [x] strategic decision — new workstream added; 5 Open Questions surfaced; consumer-first GTM rejection logged in Reversed Decisions

Docs updated in this PR:
- `docs/marketing/GTM_EXECUTION_PLAN.md` — new file, the canonical playbook
- `docs/IMPLEMENTATION_PLAN.md` — new workstream `0d`, 5 new Open Questions, new Reversed Decisions entry
- `docs/changelog/CHANGELOG_2026_05_11.md` — this entry

### Testing
- [x] Read-through review of the plan for internal consistency (phase ordering, gate conditions, cost math)
- [x] Cross-reference Basiq gate logic with CLAUDE.md §13 (CDR compliance) — manual-entry / CSV-import path is structurally CDR-clean (no CDR data in scope until Basiq is live)
- [x] AFSL boundary flagged as Step 0.1 + Q-GTM-5 — not deferred, not hand-waved

### Risks / considerations
- The plan deliberately does NOT start product work for the broker product (refinance-trigger engine, co-branded referral link, multi-tenancy) until Phase 4. Spec-only at that stage; build only on the first signed pilot. This is the right sequencing to avoid building speculative product.
- Open Questions Q-GTM-1..5 are blocking for Phase 2 of the plan, NOT for shipping this PR. The PR is the plan, not the execution.
- Consumer-first GTM is now in Reversed Decisions — any future session proposing "let's just do SEO + paid ads from day one" needs to be pointed back at the 2026-05-11 lesson before relitigating.

### Update (same session, 2026-05-11) — GTM decisions logged + Step 1.3 guide
- **Q-GTM-1 DECIDED — $197** for the first 5 friendly Reviews (Reza's call; Claude flagged the public price needs a $297 intermediate rung — recorded as non-blocking, public price TBD after Reviews #3–5).
- **Q-GTM-2 DECIDED — separate sending domain `try-monitrax.com` via Smartlead** (DFY managed inbox `reza@try-monitrax.com`). Reza initially questioned the need for a separate domain (proposed `admin@monitrax.com.au`); Claude made the deliverability case (cold-outreach spam signals are tracked per sending domain; a burn routes the primary domain's product + CDR-consent email to spam with weeks-to-months recovery, right at launch); Reza agreed.
- Delivered Reza a full step-by-step Step 1.3 setup guide (GoDaddy domain purchase + redirect → Smartlead DFY mailbox → GoDaddy DNS records SPF/DKIM/DMARC/tracking → warmup toggle → 2–3 week passive warm), with Claude on standby for the GoDaddy DNS field-mapping (GoDaddy's host-field auto-append behaviour is the common trip-up).
- Docs updated: `IMPLEMENTATION_PLAN.md` (Q-GTM-1 + Q-GTM-2 marked ✅ DECIDED in Open Questions; workstream 0d open-questions list refreshed; "Open as of" tail line updated to leave only Q-GTM-3/4/5 open); `GTM_EXECUTION_PLAN.md` (Step 1.3 rewritten as the concrete Smartlead/GoDaddy guide; Step 3.2 price decision recorded; Open Questions table updated with decisions + Claude recommendations for the three still open).
- Still open: Q-GTM-3 (first aggregator — rec Finsure), Q-GTM-4 (VA hire timing — rec mid-Phase 2 small scope), Q-GTM-5 (AFSL boundary — rec DIY + lawyer review for v1).

### Update 2 (2026-05-12) — `try-monitrax.com` purchased + cost register created
- Reza purchased **`try-monitrax.com`** on GoDaddy; advised to choose **"Keep Separate"** (not GoDaddy's "Connect"/Domain-Connect) so the DNS zone stays clean for the Smartlead email records. GoDaddy step done; next is Smartlead signup → DFY managed inbox `reza@try-monitrax.com` → GoDaddy DNS (SPF/DKIM/DMARC/tracking) → warmup toggle.
- Reza asked whether Smartlead / n8n are the right picks → Claude confirmed both with brief rationale (Smartlead: best price+API for solo-scale cold outbound, Instantly the friendlier-UI alternative; n8n self-hosted: power+near-zero cost, n8n Cloud the no-VPS alternative). Rationale recorded in the new cost register's Decision Log.
- **New file `docs/marketing/GTM_TOOL_STACK.md`** — living tool stack + cost register (SSOT for GTM tooling costs). Per-tool table (purpose / plan / list price / ≈AUD/mo / status / notes), cost summary (pre-Basiq lean ~$550–900/mo · fuller ~$900–1,300/mo · post-Basiq ~$2,900–3,300/mo + ~$10k Basiq initial), tool-choice decision log, "related non-GTM costs" pointers (Vercel/GCP/Basiq tracked elsewhere), and a "how to keep this current" block.
- `GTM_EXECUTION_PLAN.md` — inline Tools table replaced with a pointer to `GTM_TOOL_STACK.md` + headline cost numbers (the register is now the SSOT). `IMPLEMENTATION_PLAN.md` workstream 0d — canonical-docs line + tool-stack line + Q-GTM-2 line updated to reference the register and record the domain purchase.

### PR
- Branch: `claude/monotrax-marketing-strategy-gSktV`
- Awaiting PR creation per Reza directive.
