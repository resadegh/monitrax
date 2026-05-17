# Conversational Onboarding Toggle — Operator Runbook

> **Operator runbook for the platform-wide chat-mode master switch.**
> When `CONVERSATIONAL_ONBOARDING` is OFF (the production default
> as of 2026-05-17), `/onboarding` shows only the form-based wizard
> (Phase 12 Track B) — byte-for-byte the existing experience. When
> ON, a "Chat with Monitrax" pill toggle appears next to "Fill in a
> form" at the top of `/onboarding`, opening a parallel chat surface
> that walks the user through 8 topics conversationally + hands off
> to form-mode review at the end.

**Owner:** Director (Reza)
**Last reviewed:** 2026-05-17
**Source of truth:** this file. `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` (design + scope) + `lib/featureFlags/conversationalOnboardingGate.ts` (canonical reader).

---

## 1. Why this exists

Phase 12 Track E shipped a parallel conversational input modality
over the existing form-wizard's data contract. The same staged
`OnboardingState`, the same `ReviewStep`, the same
`/api/onboarding/bulk-create` endpoint — chat-mode is just a new
front door. Form-mode is unchanged.

The flag exists for two reasons:

1. **Gradual rollout** — chat-mode requires Anthropic API access. We
   want the option to ship the code without exposing the surface to
   users until the operator confirms the vendor key + cost cap are
   in place.
2. **Cost / quality experimentation** — the operator can flip ON for
   friendlies-only (via per-user override in the existing
   `FeatureFlagOverride` table) before flipping ON globally.

Two layers of protection:

- **Client layer** — `useConversationalOnboardingEnabled()` React
  hook gates the mode-toggle component. When the flag is OFF, the
  toggle isn't rendered; `?mode=chat` query param is ignored and
  the page falls through to form-mode.
- **Server layer** — `/api/onboarding/chat/extract` and
  `/api/onboarding/chat/topic-confirmed` routes still respond but
  the chat UI never gets a chance to call them. (Defense in depth
  via the existing `withPermission('settings.write')` gate; no
  separate route guard needed because the routes are useless
  without the chat UI.)

The flag lives in the existing `GlobalFeatureFlag` Prisma table
under the key `CONVERSATIONAL_ONBOARDING`. Defaults to
`enabled = false`.

---

## 2. Surfaces gated by the flag

| Surface | Behaviour when OFF |
|---|---|
| `/onboarding` mode-toggle pill (top of page) | Not rendered |
| `/onboarding?mode=chat` URL | Falls through to form-mode (chat surface not shown) |
| `<ConversationalSetup />` component | Never mounted |
| `<PresenceOrb />` ambient SVG | Never mounted |
| Web Speech API mic button | Never mounted |
| `POST /api/onboarding/chat/extract` | Still responsive (no separate guard); no UI invokes it |
| `POST /api/onboarding/chat/topic-confirmed` | Still responsive; no UI invokes it |

When the flag is OFF, `/onboarding` is byte-for-byte the existing
form-wizard experience. Zero behavioural change.

---

## 3. Pre-requisites (one-time, post-deploy)

### 3.1 Seed the flag row

The flag row needs to exist in the DB before the admin page can
toggle it. Run the seed once after first deploy:

```bash
npm run seed:feature-flags
```

Idempotent — re-running upserts the row + refreshes the description
without overwriting `enabled`. Output:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEATURE FLAG SEED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ BASIQ_INTEGRATION — enabled=false
  ✓ CONVERSATIONAL_ONBOARDING — enabled=false
✅ Seed complete.
```

### 3.2 Set `ANTHROPIC_API_KEY` in Vercel Production env

Chat-mode calls Anthropic Claude Haiku 4.5 for structured-output
extraction. Without the key, the extract endpoint returns
`503 AGENT_NOT_CONFIGURED` and the chat surface shows a calm error
banner ("Chat-mode is temporarily unavailable. Try the form
instead.").

- Vercel → Project → Settings → Environment Variables → Production
- Key: `ANTHROPIC_API_KEY`
- Value: starts with `sk-ant-`
- **Trigger a redeploy** — env vars apply to the next deployment,
  not the running one. Either push a commit to `main` or click
  "Redeploy" on the latest production deployment.

### 3.3 Set the Anthropic cost cap (one-time, console.anthropic.com)

Phase 33g.2 pattern — set a hard monthly ceiling so a runaway
session can't blow the budget.

- https://console.anthropic.com → Settings → Limits → Workspace
- Hard monthly cap: **US$50/mo**
- This cap covers BOTH the feedback chat (Phase 33g.2) AND the
  onboarding chat (Phase 12 Track E) — they share the same key.

See `docs/operational/cost-control/00_VENDOR_INVENTORY.md` row
"Anthropic API" for the cost rationale + per-feature breakdown.

---

## 4. Toggle procedure

### 4.1 To enable chat-mode globally

1. Navigate to `/admin/feature-flags` (SUPER_ADMIN required).
2. Find the `CONVERSATIONAL_ONBOARDING` row.
3. Toggle the "Enabled" switch ON.
4. The change propagates **instantly** on the toggling Vercel
   instance via the cache invalidation hook in
   `app/api/admin/feature-flags/[key]/route.ts`. Warm peer instances
   pick it up within ≤30 seconds via the in-process cache TTL in
   `lib/featureFlags/conversationalOnboardingGate.ts`.
5. Verify by visiting `/onboarding` in an incognito window — the
   "Chat with Monitrax" pill toggle should appear next to "Fill in
   a form" at the top.

### 4.2 To enable for specific users only (friendlies beta)

1. Use the existing `FeatureFlagOverride` mechanism:
   - Navigate to `/admin/feature-flags`.
   - Click the `CONVERSATIONAL_ONBOARDING` row → "Add user
     override".
   - Add the user's `userId` + set `enabled: true` for that
     override.
2. The global flag stays OFF; only the listed users see chat-mode.
3. Useful for the friendlies private-beta cohort
   (`IMPLEMENTATION_PLAN.md` workstream 0f).

### 4.3 To disable (rollback)

1. Same path, toggle OFF.
2. `/onboarding` reverts to form-only within ≤30s on all warm
   instances.
3. **No data loss** — any in-progress chat-mode user sees the
   toggle vanish on next page load and gets the form-mode wizard;
   their staged data (in `UserPreference.onboardingDraft`) is
   preserved.

---

## 5. Verification checklist (after enabling)

- [ ] `/onboarding` shows the pill toggle ("Fill in a form" /
      "Chat with Monitrax").
- [ ] Clicking "Chat with Monitrax" navigates to
      `/onboarding?mode=chat`.
- [ ] The chat surface renders with the `PresenceOrb` SVG (warm-
      ivory iridescent circle next to the agent's first message).
- [ ] The agent's first message types out via the typewriter
      animation (or appears statically under `prefers-reduced-motion:
      reduce`).
- [ ] The mic button appears in the composer if the browser
      supports Web Speech API (Chrome / Edge; absent in Firefox).
- [ ] Reply "yes, my partner Sarah and our kid" → agent extracts
      household + asks about pets.
- [ ] Walk through all 8 topics → final recap → "Looks right" →
      lands on `/onboarding` form-mode at the review step with
      every field pre-filled.

If any check fails, see §6 troubleshooting.

---

## 6. Troubleshooting

### 6.1 Toggle doesn't appear after flipping ON

- Verify the flag row exists: visit `/admin/feature-flags`. If
  `CONVERSATIONAL_ONBOARDING` is missing, run the seed (§3.1).
- Check the in-process cache TTL — wait 30s, refresh `/onboarding`.
- Check the public endpoint manually:
  ```bash
  curl https://www.monitrax.com.au/api/feature-flags/conversational-onboarding
  ```
  Should return `{"enabled": true}`.

### 6.2 Chat returns "Chat-mode is temporarily unavailable"

- `ANTHROPIC_API_KEY` not set in the deployed function env (see
  §3.2). Vercel env vars apply to the **next deployment**, not the
  running one.
- After adding the key, push a commit or click "Redeploy" on the
  latest production deployment.
- Verify the key is loaded by checking the server-side audit log
  after a test message — `ONBOARDING_AGENT_EXTRACTION` with
  `status: FAILURE` + `reason: ANTHROPIC_NOT_CONFIGURED` confirms
  the key is missing.

### 6.3 User sees 429 / "Daily chat limit reached"

- By design — 200 extractions per user per day cap, enforced at
  `app/api/onboarding/chat/extract/route.ts` via audit-log count
  over a rolling 24h window.
- User can switch to form-mode for the rest of the day. Cap resets
  automatically at the 24h mark.
- If the cap is consistently hit, consider raising
  `DAILY_CAP_PER_USER` in the extract route. Operationally not
  expected — a complete chat walkthrough is ~30-60 turns.

### 6.4 Extraction misses obvious values (e.g. "$80k" comes back as 80, not 80000)

- LLM normalisation gap. Capture the user's message verbatim +
  the staged delta + open a follow-up ticket to tune the topic's
  system prompt in
  `lib/ai/onboarding-agent/tools/extractWizardStepDelta.ts`.
- The system prompts have AU-specific normalisation rules per
  topic; if a pattern repeatedly misses, add it to the prompt.

### 6.5 Agent volunteers a number or makes a recommendation

- **This should never happen.** The system prompts explicitly
  forbid invented numbers + advice. The agent's tool registry
  contains only the extraction tool; there is no advice surface.
- If you observe this, capture the message + the user's input + the
  conversation history. Open a P1 follow-up: the system prompt
  needs hardening + the AFSL-boundary rule per topic (Phase 12 §2
  hard rule #3) is at risk.

### 6.6 Audit log noise

Three audit actions log per chat session:

- `ONBOARDING_AGENT_EXTRACTION` — fires on every successful LLM
  tool call. Metadata: `{ topic, deltaFieldNames }` —
  field-names-only, never values (CDR §13.3 sanitisation).
- `ONBOARDING_AGENT_TOPIC_CONFIRMED` — fires when the user taps
  "Looks right" on a per-topic recap. Metadata: `{ topic,
  deltaFieldNames }`.
- `ONBOARDING_AGENT_MODE_SWITCHED` — enum value exists but no call
  site fires it yet; reserved for a future PR that wires the
  form↔chat audit trail.

Volume estimate: ~10-30 extraction rows + 8 topic-confirmed rows
per complete chat walkthrough. Search via `/admin/audit-log` with
filters.

---

## 7. Cost monitoring

Anthropic usage from chat-mode is monitored via:

- **Per-extraction tokens** logged in audit metadata
  (`tokensIn`, `tokensOut`, `model`).
- **Console-side cap** at console.anthropic.com → Settings →
  Limits → US$50/mo workspace cap.
- **Operational alert** (planned A10 in
  `08_OBSERVABILITY_SLOS.md`) — alerts on Anthropic latency
  spikes + daily token-spend trend.

Estimated cost: ~AU$0.0001 per extraction (Haiku 4.5 ~200-500
tokens in + ~200 tokens out). A full chat walkthrough (~30-60
extractions) costs ~AU$0.003-0.006 per user. The US$50/mo cap
covers ~10,000-25,000 walkthroughs / month.

---

## 8. Related docs

- `docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md` — master
  plan + design (12 sections; §4a is the visual-design SSOT for
  the chat surface)
- `docs/architecture/06_UI_UX_FOUNDATION.md` §14 — UI-foundation
  pointer to the chat surface's visual primitives
- `docs/architecture/08_BRAND_UI_DESIGN.md` — brand-surface entry
  for the AI visual identity (PresenceOrb)
- `docs/operational/cost-control/00_VENDOR_INVENTORY.md` — Anthropic
  row (shared between Phase 33g.2 feedback chat + Phase 12 Track E
  onboarding chat)
- `docs/operational/runbooks/06_BASIQ_INTEGRATION_TOGGLE.md` — the
  sibling runbook this one is modelled on
- `CLAUDE.md` §13.3 (audit metadata sanitisation), §14 (TRAIL Stage
  T — Track), §16 (doc-sync protocol)
