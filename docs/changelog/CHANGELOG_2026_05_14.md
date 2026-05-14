# Changelog — 2026-05-14

## Session: GTM Step 1.6 — Founder Daily Digest built (awaiting first live cron run)

Branch: `claude/monotrax-marketing-strategy-gSktV`

### Scope
- **Type:** Feature (operational tooling, not product code)
- **Scope:** GTM automation — first real n8n workflow ships
- **TRAIL alignment:** N/A (internal ops, not user-facing)
- **CDR scope:** Out of scope — n8n is GTM-ops only, never pulls CDR data (per CLAUDE.md §13.6 boundary)

### What was done

**Founder Daily Digest v1 workflow built and configured in n8n.**

- Workflow at `https://n8n.monitrax.com.au/workflow/jQWmSbqEvY3vkAy2` (18 nodes, currently inactive — toggle off until first real-test run is reviewed)
- Built via the Anthropic n8n connector (Claude Desktop Chat mode, MCP)
- Architecture: cron @ 06:45 Sydney → parallel Gmail Unread (read on `reza@try-monitrax.com`) + n8n self-monitoring (`/api/v1/executions?status=error`) → Merge → Compose Context → Claude summariser (`claude-sonnet-4-6`, plain text, 5-section structure) → Extract Body → Gmail Send (to `admin@monitrax.com.au`)
- 5 disabled stub branches for future data sources: Airtable Activities, Stripe Charges, Sentry Issues, Cal.com Bookings, Smartlead Replies — each with sticky-note wiring instructions on the n8n canvas
- 4 n8n credentials wired: 2× Gmail OAuth2 (read + send), Anthropic API, Header Auth for the n8n internal API
- Google Cloud OAuth client `n8n - Monitrax Gmail OAuth` created in project `monitrax-479700` to back the Gmail credentials (self-hosted n8n requires BYO OAuth client; ~15 min extra setup first time)
- OAuth consent screen configured: External, Testing mode, test users `admin@monitrax.com.au` + `reza@try-monitrax.com`
- System prompt enforces warm-words rule, "no AI tics, no motivational-poster mode", explicit "(fallback - low inbox signal)" tag when inbox is thin, "ONE PATTERN under 20 words" constraint

**Architectural decisions made this session:**

1. **Model: Sonnet 4.6, not Opus 4.7** — daily structured summarisation is well within Sonnet's quality envelope; Opus is ~5× the cost for negligible quality gain on this prompt class. Opus reserved for high-stakes Review reports (Step 3).
2. **Recipient: `admin@monitrax.com.au`, not `reza@monitrax.com.au`** — the latter mailbox doesn't exist in the Workspace; creating one would cost another seat for purely cosmetic value. Self-send to `admin@` is the cheapest correct fix.
3. **Gmail noise filter applied at the Gmail node** (`-category:promotions -category:social -from:noreply` etc.) — drops obvious noise before Claude sees it. Reduces input tokens + improves signal density.
4. **`simple: true` on Gmail node** — metadata only (from/subject/date/labels), no email body. Claude reasons from subject lines. Flip to `false` only if subject-only signal proves insufficient after a week of production runs.
5. **Stubs disabled, not deleted** — workflow grows in place rather than getting rebuilt as each data source comes online. Lower future-friction.

**Operational runbook created:** `docs/operational/runbooks/09_GTM_FOUNDER_DAILY_DIGEST.md` — daily checks, credential rotation, adding a new data source, common failure modes, Reza-side knobs.

### Files modified

- `docs/marketing/GTM_EXECUTION_PLAN.md` — Step 1.6 expanded with everything built, credentials inventory, gotchas, deferred scope
- `docs/marketing/GTM_TOOL_STACK.md` — Anthropic API flipped 🟡 Planned → 🟢 Active 2026-05-14; new row for Google Cloud OAuth client; two new entries in Decision Log (model choice + recipient choice)
- `docs/IMPLEMENTATION_PLAN.md` — header refreshed; workstream 0d Phase 1 checkbox progress noted (Step 1.1, 1.3, 1.6 all advanced)
- `docs/operational/runbooks/09_GTM_FOUNDER_DAILY_DIGEST.md` — new runbook
- `.gitignore` — `.claude/settings.local.json` added (already committed in `aeeff91`)

### Documentation Updated (per CLAUDE.md §16.3 matrix)

- **GTM execution plan + tool stack:** ✅ (both updated)
- **Operational runbook:** ✅ (new file created)
- **Implementation Plan + Active Workstreams:** ✅
- **CHANGELOG:** ✅ (this file)

### Build Status

- TypeScript compilation: N/A (no app code touched)
- Build: N/A
- Tests: N/A
- Lint: N/A

This is a doc-only PR. No app code, no schema, no migration. The product code on `main` is unchanged.

### Painful gotchas worth memorialising

1. **n8n auto-assigns credentials by type, not name.** Send node initially used the read credential. Fix: manually pick the right credential per node, then save. Check both Gmail nodes for absence of the red "!" warning before activating.
2. **Self-hosted n8n Gmail OAuth requires BYO Google Cloud OAuth client** (Client ID + Secret). n8n Cloud has a shared one; self-hosted doesn't.
3. **OAuth consent screen test users must include both mailboxes.** Most common silent OAuth failure pre-publish — Testing-mode apps only authorise listed test users.
4. **Workflow timezone is not the instance timezone.** Set per-workflow under Workflow Settings → Timezone → `Australia/Sydney`. Forgetting this = cron fires at 4:45pm Sydney every day, not 6:45am.
5. **n8n API keys are sensitive — never paste into chat.** A key was exposed in a chat paste during a "Code session takeover" attempt (Code sandbox blocks `n8n.monitrax.com.au`, 403 Host not in allowlist, so the takeover failed anyway). Rotated within minutes. Future direct-API access needs a dedicated read-only service-account key.

### Commits

| Hash | Message |
|---|---|
| `aeeff91` | chore(gitignore): exclude .claude/settings.local.json from version control |
| (next) | docs(gtm): Step 1.6 — Founder Daily Digest built; runbook + tool-stack + plan sync |

### PR

- Branch: `claude/monotrax-marketing-strategy-gSktV` (continuation of the GTM Automation workstream — 10+ doc-only commits before this session)
- PR URL: TBD on push

### Next Steps (out of this session)

1. Reza: fire first real `execute_workflow` end-to-end via Chat-Claude → review the actual email body that lands in `admin@monitrax.com.au`
2. If sign-off: Reza manually activates the cron toggle in n8n UI
3. Three useful digests received without touching it → Step 1.6 flips ✅ DONE
4. Move to Step 1.2 (Airtable CRM) or Step 2 (Outbound pipeline)

---

## Session: GTM Step 1.6 — cron activation milestone (same day, evening)

Follow-up PR off main (PR #757 merged earlier in the day).

### What was done
- ✅ First real `execute_workflow` ran end-to-end successfully (the manual run after the Anthropic credential was wired in). Email landed in `admin@monitrax.com.au` **Sent** folder (Gmail default hides self-sends from Inbox — handled below).
- ✅ **Workflow PUBLISHED** in n8n (n8n 2.20.x calls activation "Publish"; same as the older Activate toggle). Cron now firing daily at 06:45 Sydney; first scheduled run lands 2026-05-15 morning.
- ✅ **Error notifications wired** via the n8n Production Checklist popup — workflow-failure emails go to `admin@monitrax.com.au` (so a 6:45am cron failure surfaces within minutes instead of being noticed days later).
- ✅ **Gmail filter** set up at `admin@monitrax.com.au` to surface self-sent `Monitrax Daily` emails into Primary inbox + star them.
- ❌ "Track time saved" — skipped (vanity metric, no operational value).

### First-run email quality review (4 lenses)
- **Behaviour psychologist:** Excellent. Claude synthesised data into actionable diagnosis ("Same workflow failed twice within 4 minutes... likely a config or credential issue, not a logic problem"). Action 2 found a real insight ("inbox empty may be a visibility gap, not a signal gap — wire the Smartlead webhook"). Fallback tag working as designed on action 3. ONE PATTERN noticed a genuine debugging-pattern.
- **Designer:** Plain text, ALL CAPS headers, dashes, no markdown leak. Apple Mail auto-linked `Cal.com` cosmetically.
- **Architect:** Two minor prompt issues found but deferred (iterate from real production output, not pre-tuning):
  1. **Self-referential workflow ID** — Claude told Reza to "fix the failing workflow" not knowing the failing workflow IS the digest itself (those were our manual debugging runs from earlier in the day).
  2. **UTC→Sydney timezone interpretation** — ONE PATTERN said "yesterday morning" but the timestamped errors were ~90 minutes earlier same day. Claude is reading UTC stamps without converting to Sydney TZ.
- **Verdict:** Ship as-is. Both issues are 30-second prompt-tweaks editable in-place on the Claude node; cheaper to learn from 3 days of real runs than pre-tune.

### Files modified in this follow-up
- `docs/marketing/GTM_EXECUTION_PLAN.md` — Step 1.6 header flipped 🟡 → 🟢; "Still to do before ✅ DONE" section replaced with "Activation milestones" section + the Production Checklist hygiene.
- `docs/IMPLEMENTATION_PLAN.md` — header refreshed for evening activation; workstream 0d Phase 1 checkbox annotation updated (Step 1.6 BUILT → LIVE).
- `docs/operational/runbooks/09_GTM_FOUNDER_DAILY_DIGEST.md` — status header flipped 🟡 Built → 🟢 Live; "Publish / Unpublish the workflow" replaces "Activate / pause the cron" (n8n 2.20.x terminology); daily-check section expanded to leverage the new error-notification email as the first signal of failure.
- This file — new session entry appended below the morning one.

### Build status
- Doc-only. No app code, no schema, no migration.

### Painful lessons (today's evening session)
1. **n8n 2.20.x renames "Active/Inactive" to "Publish/Unpublish"** — surface change only, same activation semantics. Older runbook screenshots use the old terms.
2. **Gmail hides self-sent mail from Inbox by default** — self-send is delivered, just routed to Sent + All Mail. Fix: a Gmail filter (`from:admin to:admin subject:"Monitrax Daily"`) → star, mark important, categorise as Primary, never spam.
3. **The Production Checklist popup is worth reading once** — error notifications setup takes 30 seconds and converts "silent 6:45am failure" into "an inbox notification within minutes". Skip the vanity items.

### Next Steps (genuinely now)
1. Tomorrow 2026-05-15 06:45 Sydney: cron fires. Reza reads the first scheduled digest.
2. Three useful mornings in a row → Step 1.6 flips ✅ DONE in a follow-up commit.
3. Open question for Reza, no rush: do the two prompt tweaks (self-referential workflow ID + UTC→Sydney TZ) now in the Claude node `options.system` field, or wait until a real morning surfaces the same friction?
4. After ✅ DONE on Step 1.6, next GTM step: **Step 1.2 (Airtable CRM)** is the gating dependency for several stubs in the digest workflow. Or jump to **Phase 2 (Outbound pipeline)** if Smartlead warmup is healthy.
