# Basiq Integration Toggle — Operator Runbook

> **Operator runbook for the platform-wide Basiq Open-Banking master
> switch.** When `BASIQ_INTEGRATION` is OFF (the production default
> as of 2026-05-14), every "Connect bank" affordance is hidden across
> the consumer app, the onboarding wizard, the setup wizard, and the
> settings surfaces. When ON, all of it lights up — no deploy
> required.

**Owner:** Director (Reza)
**Last reviewed:** 2026-05-14
**Source of truth:** this file. CLAUDE.md §13.6 (CDR posture) +
`lib/featureFlags/basiqGate.ts` (canonical reader).

---

## 1. Why this exists

Reza directive 2026-05-14: while Basiq accreditation is in flight,
no user should see Connect-Bank buttons that lead nowhere. Hidden
(not deleted) UI keeps the codebase ready for the moment the
accreditation lands — at which point flipping a single admin
toggle exposes every Basiq surface platform-wide.

Two layers of protection:
- **Client layer** — `useBasiqEnabled()` React hook gates every
  visible Basiq affordance. When the flag is OFF, the affordance
  isn't rendered at all.
- **Server layer** — `basiqRouteGuard()` short-circuits every
  `/api/basiq/*` route with `503 BASIQ_DISABLED`. Defense in depth
  against stale UI / curl / hostile probes.

The flag itself lives in the existing `GlobalFeatureFlag` Prisma
table (Phase 33 admin infra) under the key `BASIQ_INTEGRATION`.
Defaults to `enabled=false`.

---

## 2. Surfaces gated by the flag

| Surface | Behaviour when OFF |
|---|---|
| `/dashboard` `<BasiqHeroCard />` | Not rendered |
| `/dashboard` `AccountsEmptyState` tile | Title becomes "Add your accounts"; CTA points to manual-add path |
| `/dashboard/setup` Setup Tray hero | `<BasiqHeroCard />` self-hides |
| `/dashboard/setup` `<SetupNextActionPanel />` | Skips "Connect your bank" priority; uses "Add your accounts" instead |
| `/dashboard/balances` Connect-Bank toolbar button | Not rendered; `?action=connect-basiq` deep-link silently no-ops + strips the param |
| `/onboarding` wizard accounts step | "Tier 1 — Connect your bank" tile + the "or" divider hidden; only Import + Manual remain |
| `/dashboard/settings/connections` page | Replaced with "Bank connections aren't available yet" notice |
| `/dashboard/settings` sidebar nav | "Bank connections" entry hidden under "My money data" |
| `POST /api/basiq/connect` | 503 `BASIQ_DISABLED` |
| `GET /api/basiq/connections` | 503 `BASIQ_DISABLED` |
| `GET /api/basiq/connections/[id]` | 503 `BASIQ_DISABLED` |
| `DELETE /api/basiq/connections/[id]` | 503 `BASIQ_DISABLED` |
| `POST /api/basiq/sync` | 503 `BASIQ_DISABLED` |
| `POST /api/basiq/webhook` | 503 `BASIQ_DISABLED` |

Manual-add + CSV/OFX/QIF import remain live in all states. The
file-import path is the only way to add accounts while Basiq is
OFF (Reza directive 2026-05-14: "we will only use file import for
now").

---

## 3. Pre-requisites (one-time, post-deploy)

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

✅ Seed complete.
```

---

## 4. Toggling the switch

### Disable (default state)

1. Sign in to `/admin` as SUPER_ADMIN.
2. Navigate to **Feature Flags**.
3. Find `BASIQ_INTEGRATION`.
4. Toggle to **off**.

The change propagates within ≤30 seconds across all Vercel function
instances (in-process cache TTL). The current Vercel instance flushes
its cache immediately via the PATCH handler. All Basiq UI affordances
disappear on the next page load; in-flight requests already in
client-side React state stay until the user refreshes (acceptable —
nothing destructive happens).

### Enable (when Basiq accreditation lands)

Same flow, toggle ON. Pre-requisites for ON state:

| Item | Why |
|---|---|
| Basiq production API keys configured in env | The `/lib/basiq` client needs these to make any call |
| `CRON_SECRET` set on Vercel | Required by the existing Basiq sync paths |
| Domain whitelisted with Basiq | Bank-redirect URLs need to resolve |
| Webhook signing secret configured | `/api/basiq/webhook` rejects unsigned deliveries |

If those env vars aren't ready, flipping the flag produces a
visible UI but `/api/basiq/*` calls fail at the Basiq client
layer (not the gate), surfacing as connection errors instead of
503s. Fix the env vars first; then flip the flag.

---

## 5. Verifying the toggle works

After flipping, check:

| Surface | OFF expectation | ON expectation |
|---|---|---|
| `/dashboard` first paint after sign-in | No "Connect your bank" hero card | Hero card visible (if not already connected) |
| `/dashboard/balances` | No "Connect Bank" toolbar button | Button present |
| `/onboarding` accounts step | Only Import + Manual tiles | All 3 tiles incl. "Connect your bank — Recommended" |
| `/dashboard/settings/connections` | "Bank connections aren't available yet" notice | Connections list (empty if no connections) |
| `curl https://www.monitrax.com.au/api/feature-flags/basiq` | `{"enabled":false}` | `{"enabled":true}` |
| `curl -X POST https://www.monitrax.com.au/api/basiq/sync` (auth required) | `503 BASIQ_DISABLED` | Normal sync flow |

---

## 6. When things go wrong

### Toggled ON but Connect Bank still hidden after 30s

1. Hard-refresh the consumer dashboard (clears stale React state).
2. Confirm `/api/feature-flags/basiq` returns `{"enabled":true}`.
3. If the public endpoint disagrees with the admin page, the DB
   row may not have been updated. Check the AdminAuditLog for the
   PATCH event; check the row directly via `prisma studio`.

### Toggled ON but Connect Bank flow fails with non-503 error

The flag is on but Basiq env vars or accreditation aren't ready.
Flip the flag back to OFF until the operational pre-requisites in
§4 are confirmed. Production users seeing a broken flow is worse
than not seeing the flow at all.

### Webhook deliveries rejected with 503 after enabling

Cloud-side caching can lag. Wait 30 seconds, then re-trigger from
Basiq's webhook console. If still failing, check Vercel function
logs for the actual reason — some Vercel function instances may
still hold the old cached value if they haven't been hit since
the flag flip; force a deploy or wait for them to recycle.

---

## 7. Compliance evidence

For Basiq accreditation submission, this runbook + the gate
implementation form a useful artefact: the platform has a
**deliberate master switch** for CDR data ingestion. We are
demonstrably **not** collecting CDR data while the switch is OFF.

Screenshot:
- `/admin/feature-flags` showing `BASIQ_INTEGRATION` toggle
- `curl https://www.monitrax.com.au/api/feature-flags/basiq`
  returning `{"enabled":false}`
- A hit on `/api/basiq/sync` returning `503 BASIQ_DISABLED` (the
  defense-in-depth proof)

These three artefacts paired with the policy in
`CDR_DATA_RETENTION_SCHEDULE.md` give auditors the policy + the
proof of enforcement.
