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
