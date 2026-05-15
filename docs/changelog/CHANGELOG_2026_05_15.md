# Changelog — 2026-05-15

## Session 1: Step 1.6 first scheduled morning run successful (Day 1 of 3)

Branch: standalone observation, no commits (until Day 3 / DONE).

The cron published last night fired automatically at 06:45 Sydney. Digest landed in `admin@monitrax.com.au` Primary inbox (Gmail filter caught the self-send routing). Quality reviewed through the four lenses — **both prompt-improvement candidates from yesterday self-resolved in the wild without intervention:**

| Yesterday's gap | This morning's output |
|---|---|
| Self-referential — Claude told Reza to "fix the failing workflow" not knowing it's the digest | ✅ *"Both errors are from this digest workflow itself (jQWmSbqEvY3vkAy2)... I should self-diagnose"* |
| TZ confusion — said "yesterday morning" for same-day errors | ✅ *"triggered manually at 21:06 and 21:09 Sydney time last night (Thu 14 May)"* |

ONE PATTERN today: *"Both workflow failures were manual runs at night — suggests you were testing, not a scheduled breakage."* Genuinely insightful.

**Day 1 of 3 toward Step 1.6 ✅ DONE.** Days 2 + 3 are Sat 16 May + Sun 17 May.

---

## Session 2: GTM Step 1.2 — Airtable CRM DONE

Branch: `claude/gtm-step-1-2-airtable-crm`

### Scope
- **Type:** Feature (operational tooling, not product code)
- **Scope:** GTM CRM SSOT — first production consumer is the Founder Daily Digest CRM ACTIVITY section
- **CDR scope:** Out of scope — Airtable holds operator/CRM data only, no CDR data

### What was done

**Airtable CRM live.** Base `Monitrax CRM` at `airtable.com/appEDHNU0mtbWznHp` — system of record for every later GTM workflow.

- **7 tables built** (one extra beyond v1 spec):
  - `Leads` — raw imports, unverified
  - `Contacts` — verified humans
  - `Companies` — generic
  - `Brokerages & Employer Orgs` — extra table, decision deferred to first real broker contact
  - `Deals` — 8-stage pipeline
  - `Reviews` — paid Financial Health Reviews (AU$197 default per Q-GTM-1)
  - `Activities` — every touch logged; queried by the digest
- **Linked records** properly single-link except `Activities.Contact` (multi-link for meeting-style entries)
- **PAT** `n8n-monitrax-crm` — least-privilege (3 scopes, base-restricted)
- **n8n credential** `Airtable - Monitrax CRM` (Airtable Personal Access Token API type)
- **Digest workflow updated via Chat-Claude** (MCP):
  - `[STUB] Airtable Activities` HTTP node replaced with real Airtable Search-Records node
  - Filter formula: `IS_AFTER({Created}, DATEADD(NOW(), -1, 'days'))`
  - Connected: Schedule Trigger → Airtable node → Merge (numberInputs bumped 2 → 3)
  - Compose Context extended with `airtable_activities_json`
  - Claude system prompt extended with **CRM ACTIVITY** section between WORKFLOW HEALTH and AWAITING DATA — groups by Direction (Inbound first), orders by Created desc, caps at 8 items with "+N more in CRM" overflow, skips pure Status Change entries unless they advance a deal stage. "Airtable Activities (Step 1.2 - CRM)" removed from pending-sources list.

### End-to-end production test
- Sonnet 4.6, 1,232 input / 411 output tokens
- Cost: ~AU$0.005 per run
- Email landed in `admin@monitrax.com.au`
- CRM ACTIVITY rendered "No CRM activity in the last 24h" — the one real Activity record was a pure Status Change, correctly filtered by the prompt rule. Empty-state path verified.

### Side cleanup
- **Airtable AI augmentation fields deleted** — `Summary (AI)` / `Next Suggested Action (AI)` / `Sentiment (AI)` were throwing `emptyDependency` errors on records with empty `Body`. Not in v1 spec, not used by the digest, removed for cleanliness. Re-add later if needed when real Body content flows in.

### Architectural decisions
1. **PAT scoped to ONE base, never "all current and future bases"** — least-privilege principle. If the PAT leaks, blast radius is the CRM only, not every future Airtable base.
2. **Single-link by default on Linked Record fields** — Airtable's default is multi-link; we explicitly turned it OFF for join fields (Leads.Company, Contacts.Company, Deals.Company, Reviews.Contact). Multi-link kept only for `Activities.Contact` (meetings can have multiple attendees).
3. **Filter at the Airtable query, not the Claude prompt** — `IS_AFTER({Created}, DATEADD(NOW(), -1, 'days'))` filter formula runs on Airtable's side, returning only last-24h records. Cheaper than pulling everything and filtering in n8n / Claude. Same pattern as the Gmail noise filter from Step 1.6.
4. **CRM ACTIVITY positioned BEFORE TOP 3 ACTIONS in the digest** — the prompt section order is psychologically deliberate: things-that-changed (Inbox, Workflow, AWAITING DATA, CRM) come first, THEN top actions. Reza reads context → decides → doesn't read action without context. Don't reorder without thinking.

### Files modified in this PR

- `docs/marketing/GTM_EXECUTION_PLAN.md` — Step 1.2 fully expanded with build details, credentials inventory, gotchas, deferred scope
- `docs/marketing/GTM_TOOL_STACK.md` — Airtable 🟡 → 🟢 Active 2026-05-15; **new "What's live RIGHT NOW" at-a-glance section** added at top (per Reza directive: "the number of apps is getting overwhelming")
- `docs/IMPLEMENTATION_PLAN.md` — header refreshed; workstream 0d Phase 1 checkbox annotation updated
- `docs/operational/runbooks/09_GTM_FOUNDER_DAILY_DIGEST.md` — Airtable Activities branch added to architecture diagram + credentials inventory + common-failure-modes
- This file — two sessions captured

### Build status
- Doc-only. No app code, no schema, no migration.

### Painful lessons memorialised
1. **Airtable renamed "bases" to "apps"** in the UI. Same concept, new word. "Build an app on your own" creates a new blank base.
2. **Default Linked Record allows MULTIPLE records.** For most join fields you want single-link — flip the toggle OFF on creation.
3. **Personal Access Tokens replaced API keys** in Airtable. Old API-key URLs throw 404. Use `airtable.com/create/tokens`.
4. **Airtable AI augmentation fields are eager** — they error when their dependency field is empty. Don't add them until real content is flowing.
5. **The "What's live right now" section in GTM_TOOL_STACK.md** exists specifically because the long table of planned-vs-active tools was hard to scan. Future-Reza thanks current-Reza.

### Next Steps
1. Saturday + Sunday: cron runs automatically; observe 2 more mornings → Step 1.6 ✅ DONE
2. Optional now: Step 0.1 (AFSL boundary doc) — 30 min draft + park for lawyer
3. Optional weekend prep: Step 2.1 (lock broker ICP) + Step 2.2 (Apollo lead-list scope) — both pure-thinking work, no tools needed
