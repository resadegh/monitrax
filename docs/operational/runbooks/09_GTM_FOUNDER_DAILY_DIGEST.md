# Runbook — GTM Founder Daily Digest workflow

> **Audience:** Reza (operator) + future BAU support
> **Last Updated:** 2026-05-14 (evening — cron live)
> **Owning workstream:** `IMPLEMENTATION_PLAN.md` §0d (GTM Automation)
> **Spec doc:** `docs/marketing/GTM_EXECUTION_PLAN.md` Step 1.6
> **Status:** 🟢 Live — cron published, error notifications wired, first manual execution successful 2026-05-14. First scheduled run: 2026-05-15 06:45 Sydney. Confirmed ✅ DONE when 3 useful digests received without intervention.

---

## What this is

An n8n workflow that lands one plain-text email in `admin@monitrax.com.au` every weekday at 07:00 Sydney time. The email is a 5-section operations brief written by `claude-sonnet-4-6` from real-time data sources, designed to surface the things that *change how the founder spends the morning* — without being noise.

This document is the operator's reference. If something is wrong with the digest, read this before touching the workflow.

---

## Where it lives

| Thing | Location |
|---|---|
| **n8n workflow** | `https://n8n.monitrax.com.au/workflow/jQWmSbqEvY3vkAy2` |
| **Workflow name** | `Founder Daily Digest v1` |
| **Owner account in n8n** | `admin@monitrax.com.au` (workspace owner) |
| **n8n instance VPS** | Hetzner Cloud `n8n-1` (CPX22, Nuremberg) — see `GTM_TOOL_STACK.md` |
| **Source spec** | `docs/marketing/GTM_EXECUTION_PLAN.md` Step 1.6 |
| **Build session changelog** | `docs/changelog/CHANGELOG_2026_05_14.md` |

---

## Architecture (one paragraph)

```
Cron @ 06:45 Sydney
  ├── Branch A: Gmail Unread (reza@try-monitrax.com, filtered)
  └── Branch B: HTTP GET n8n /api/v1/executions?status=error
        ↓
      Merge (append)
        ↓
      Compose Digest Context (Set, executeOnce: true)
        ↓
      Claude Sonnet 4.6 (Anthropic node)
        ↓
      Extract Digest Body (Set, defensive fallback chain)
        ↓
      Gmail Send → admin@monitrax.com.au
```

Plus 5 disabled `[STUB]` branches (Airtable / Stripe / Sentry / Cal.com / Smartlead) waiting to be wired when each tool comes online. They are NOT connected to the trigger — they will not fire.

---

## Credentials inventory (in n8n)

| Name (exact) | Type | Scope | Auth as |
|---|---|---|---|
| `Gmail - try-monitrax mailbox (read)` | Gmail OAuth2 API | Read unread mail (last 24h, filtered) | `reza@try-monitrax.com` |
| `Gmail - monitrax.com.au (send)` | Gmail OAuth2 API | Send the digest | `admin@monitrax.com.au` |
| `Anthropic API - Monitrax` | Anthropic API | Call `claude-sonnet-4-6` | API key `reza-onboarding-api-key` |
| `n8n API - X-N8N-API-KEY header` | Header Auth | Read n8n's own execution log | n8n internal API key `digest-self-monitor` (rotated 2026-05-14) |

**Both Gmail credentials are backed by a single Google Cloud OAuth client:** project `monitrax-479700` → `n8n - Monitrax Gmail OAuth` (Web application, redirect `https://n8n.monitrax.com.au/rest/oauth2-credential/callback`). The OAuth consent screen is in Testing mode with `admin@monitrax.com.au` + `reza@try-monitrax.com` listed as test users — **both must remain test users**, removing either will break the corresponding credential at next refresh.

---

## Daily / weekly operator checks

### Daily (passive — only if no digest arrived)
- **No 07:00 email in `admin@monitrax.com.au` Primary inbox?** Two-stage check:
  1. **Has n8n's error-notification email already arrived?** If error notifications are wired (set up via the n8n Production Checklist on 2026-05-14), a failed cron run sends Reza a heads-up within minutes. If you got that email, go straight to the failing-node diagnosis in "Common failure modes" below.
  2. **No error email either?** Go to `https://n8n.monitrax.com.au/workflow/jQWmSbqEvY3vkAy2/executions`. Look for the run at ~06:45 Sydney. If it errored, click in — n8n shows the failing node + the error. If the run *succeeded* but no email is in Primary inbox, check **Gmail's All Mail and Sent folders** — Gmail by default hides self-sent mail from Inbox; the `Monitrax Daily` Gmail filter (set up 2026-05-14) should override this, but verify the filter is still in place.

### Weekly
- **Open `https://n8n.monitrax.com.au/home/executions`**, filter to this workflow, scan the last 7 days. All green? Continue. Any red? Click the failing one, follow the "Common failure modes" section below.
- **Anthropic credit:** check `console.anthropic.com` → Credits. This workflow uses ~AU$0.15–0.60/mo on its own; if total credit is dropping fast it means another workflow has come online (sanity check).
- **Smartlead warmup health:** unrelated to this digest but the Gmail Unread branch reads the warmup mailbox, so a Smartlead account suspension shows up here as "Gmail unread always empty even when mail clearly arrived". Cross-check Smartlead dashboard.

### Quarterly
- **Rotate the n8n internal API key** (`digest-self-monitor`): n8n Settings → n8n API → delete old key → create new → paste into n8n Credentials → `n8n API - X-N8N-API-KEY header` → Save. The workflow picks it up immediately (no restart).
- **Rotate the Anthropic API key** if there has been any reason to suspect exposure (chat paste, screen-share, repo leak). Console → API Keys → Create new → update n8n credential → revoke old.
- **Check the Google Cloud OAuth client** — `console.cloud.google.com/auth/clients` (project `monitrax-479700`). If the consent screen has been auto-moved to Production (Google sometimes prompts), confirm the test-user setup is still appropriate. If the user count exceeds 100 (cap for Testing mode), rethink — but that's not a v1 problem.

---

## Common failure modes (in order of likelihood)

### 1. "No 07:00 email arrived this morning"

**First check:** is the workflow toggled ACTIVE? Top-right of the workflow editor in n8n — there's a toggle next to "Save". If it's off, the cron is dormant by design (this is the post-build default until first sign-off — see Step 1.6 "Still to do").

**Second check:** workflow timezone. Workflow Settings → Timezone → must be `Australia/Sydney`. If it shows `UTC` or `Etc/UTC`, the cron is firing at 06:45 UTC (16:45 Sydney) — change + save + you'll get tomorrow's digest at the right time, today's is already past.

**Third check:** look at the most recent execution. If it ran but failed at a specific node, follow that node's debugging path below.

### 2. "Gmail Send node fails with `invalid_grant` or `Token has been expired or revoked`"

Gmail OAuth2 refresh token broke. Most common cause: the underlying Google account's password was changed, or n8n was offline for >6 months. Re-authorise:

1. n8n → Credentials → `Gmail - monitrax.com.au (send)` (or `(read)` for the other one)
2. Click "Sign in with Google" / "Reconnect"
3. Authorise as the matching Google account (`admin@monitrax.com.au` for send, `reza@try-monitrax.com` for read)
4. Save
5. Re-run the workflow manually to confirm

If reauth fails with "Access blocked: This app's request is invalid":
- Open `console.cloud.google.com/auth/audience` (project `monitrax-479700`)
- Confirm both mailbox emails are still in the **Test users** list. If one was removed, re-add it.
- Confirm publishing status is still **Testing** (not Production — Production would need Google verification which we deliberately avoid for an internal app).

### 3. "Claude node fails with 401 or `invalid_api_key`"

Anthropic API key expired, was revoked, or hit a credit limit.

1. `console.anthropic.com/settings/keys` — confirm `reza-onboarding-api-key` still exists. If revoked, create a new key and update the n8n credential.
2. `console.anthropic.com/settings/billing` — confirm credit is > 0. If exhausted, top up via the console (~AU$5 buys ~3 years of this workflow at current volume).
3. Confirm the model ID in the Anthropic node is still `claude-sonnet-4-6` (model IDs can be retired; if Sonnet 4.6 is no longer available, swap to the latest Sonnet from `console.anthropic.com/docs/about-claude/models`).

### 4. "n8n Executions HTTP node fails with 401"

n8n internal API key (the Header Auth credential `n8n API - X-N8N-API-KEY header`) is wrong or deleted.

1. n8n → Settings → n8n API → check `digest-self-monitor` still exists. If missing, create a new key.
2. n8n → Credentials → `n8n API - X-N8N-API-KEY header` → paste the new key into the **Value** field → Save.
3. Re-run the workflow.

### 5. "Digest arrived but the content is wrong / weird / wrong tone"

Don't touch the workflow code. Open the **Claude - Compose Digest** node → the **system** field in `options` is the editable prompt. Edit, save the workflow, fire one manual `execute_workflow` to preview, iterate.

Common tone fixes:
- **Too clipped / cold:** soften the "chief of staff who respects your time" line.
- **Too motivational / fortune-cookie:** the "ONE PATTERN" section is the usual offender. Tighten to "**One factual observation under 15 words. No advice. No encouragement.**".
- **Bad action prioritisation:** add a line in the system prompt anchoring on TRAIL stage or current GTM phase.

### 6. "Digest fires twice / fires at the wrong time"

- **Twice:** workflow was activated twice (e.g., toggled, deactivated, reactivated without saving). Open Executions log to see double-fires. Deactivate + save + reactivate once.
- **Wrong time:** see check 1 above — timezone setting.

### 7. "Stub node started firing accidentally"

A `[STUB]` node was connected to the trigger or merge node by mistake. Open the workflow → confirm none of the five `[STUB] *` nodes have an incoming edge from the trigger / merge / any other active node. Disconnect any rogue connection + save.

---

## How to add a new data source (Airtable, Stripe, Sentry, Cal.com, Smartlead)

Each `[STUB]` node has a sticky note above it with the exact wiring steps. General pattern:

1. Open the relevant stub (e.g. `[STUB] Stripe Charges`)
2. Replace the placeholder URL with the real endpoint
3. Add credentials (create a new n8n credential first if needed)
4. Connect the **Schedule Trigger** → stub node (drag a line)
5. Connect stub node → **Sync Active Sources** (the Merge node)
6. Increment the Merge node's `numberInputs` parameter by 1
7. Update the **Compose Digest Context** node to read from the new source — add a new `assignments` entry pulling the relevant fields, stringify them, expose them as `<source>_json` for the prompt
8. Update the **Claude - Compose Digest** system prompt to include the new section + tell Claude what to do with the data
9. Rename the node — drop the `[STUB]` prefix
10. Save + run a manual test before letting the cron pick it up

**Each new source counts as a Step in the GTM plan** — update `GTM_EXECUTION_PLAN.md` + `IMPLEMENTATION_PLAN.md` when one ships.

---

## Reza-side knobs (no engineering needed)

| Knob | Where | When to use |
|---|---|---|
| **Publish / Unpublish the workflow** | "Publish" dropdown, top-right of editor (kb: `⇧ P`). On n8n 2.20.x this replaces the older Active/Inactive toggle — Publish = activate, Unpublish = pause. | Pause when on holiday, when warmup is paused, or during a noisy debug session. Workflow state is preserved across unpublish/republish — no rebuild needed. |
| **Edit the system prompt** | Claude - Compose Digest node → `options.system` field | Tone tweaks, section reorder, fallback-line wording |
| **Change recipient** | Gmail Send node → "To" field | Forwarding to a VA, redirecting during incident |
| **Change cron time** | Schedule Trigger node → `triggerAtHour` / `triggerAtMinute` | Different morning preference |
| **Change Gmail noise filter** | Gmail Unread node → Search field | Add more `-from:` exclusions when a recurring noisy sender slips through |
| **Bump or lower Claude verbosity** | Anthropic node → `maxTokens` (1500 default), `temperature` (0.4 default) | If digest is too long / too short / too creative |

---

## Costs

| Component | Approx. monthly |
|---|---|
| Anthropic API (Sonnet 4.6, ~1 run/day × ~$0.005–0.02) | ~AU$0.15–0.60 |
| n8n VPS share | already covered in Hetzner CPX22 (~AU$15/mo all-in, multi-purpose host) |
| Google Workspace (mailbox already provisioned) | already covered (~AU$8.40/mo) |
| Google Cloud OAuth client + Gmail API | $0 |
| **Net cost of this workflow** | **< AU$1/mo** |

Cost is bounded by the cron firing once per day. A spike would mean the cron is wrong (firing more than once) — check daily-checks above.

---

## Why this exists (for the next operator)

Per CLAUDE.md §0 (Advisory Mindset) + the GTM plan: a solo founder cannot also be the operations queue. The Daily Digest is the single highest-leverage automation in the GTM stack — it converts "20 things to check in the morning" into "one email at 7am, then go". Don't be tempted to add more data sources prematurely (stub queue exists for a reason); don't be tempted to switch to HTML (plain text is easier to iterate); don't be tempted to add a "weekly summary" sibling until this one has run cleanly for a month.

Iterate on **prompt**, not **wiring**. Wiring is the cheapest part to change; prompt is where the value lives.
